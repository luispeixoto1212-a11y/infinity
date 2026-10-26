"""Comparação entre duas importações guardadas no histórico.

Cada encomenda é identificada pelo n.º de encomenda, com a mesma regra da validação de
duplicados (espaços nas pontas e maiúsculas/minúsculas não contam). Categorias:

* **Nova** — o n.º existe na importação atual e não existia na anterior;
* **Alterada** — existe nas duas e pelo menos um campo comparado mudou;
* **Sem alterações** — existe nas duas e nenhum campo comparado mudou;
* **Não encontrada na importação atual** — existia na anterior e não aparece na atual.
  Isto **não** quer dizer que foi entregue nem cancelada: o ficheiro mais recente pode
  simplesmente não a incluir (outro período, outro filtro no sistema de origem…).

Linhas sem n.º, ou com um n.º repetido em qualquer das duas importações, não podem ser
emparelhadas com segurança: ficam fora da comparação e são listadas à parte, com o motivo.
Se nenhuma linha puder ser emparelhada num dos lados, a comparação não é feita; se ficarem
de fora mais de 20 % das linhas, a comparação é marcada como parcial.

Só se comparam os campos que existiam nas duas importações. Normalização (igual dos dois
lados): no cliente e no destino, espaços repetidos não contam; no estado, sinónimos
reconhecidos contam como o mesmo estado («entregue» = «Entregue»); nas datas, conta a
data (não a forma como estava escrita) e uma data inválida é comparada pelo texto original.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from . import campos as C
from .historico import (
    ESTADOS_CONCLUIDOS,
    campos_presentes,
    carregar_fotografia,
    descrever_data,
    obter_importacao,
)

NOVA = "Nova"
ALTERADA = "Alterada"
SEM_ALTERACOES = "Sem alterações"
NAO_ENCONTRADA = "Não encontrada na importação atual"
CATEGORIAS = (NOVA, ALTERADA, SEM_ALTERACOES, NAO_ENCONTRADA)

LIMIAR_PARCIAL = 0.20

CAMPOS_COMPARADOS = (C.CLIENTE, C.DESTINO, C.ESTADO, C.DATA, C.DATA_PREVISTA, C.DATA_ENTREGA)
_COLUNA_FOTOGRAFIA = {C.CLIENTE: "cliente", C.DESTINO: "destino", C.ESTADO: "estado", C.DATA: "data",
                      C.DATA_PREVISTA: "data_prevista", C.DATA_ENTREGA: "data_entrega"}

MOTIVO_VAZIO = "N.º de encomenda vazio"
MOTIVO_REPETIDO = "N.º de encomenda repetido nesta importação"
MOTIVO_REPETIDO_OUTRA = "N.º de encomenda repetido na outra importação"

COLUNAS_RESULTADO = ["Situação", "N.º Encomenda", "Cliente", "Alterações", "Linha (anterior)", "Linha (atual)"]
COLUNAS_EXCLUIDAS = ["Linha", "N.º Encomenda", "Motivo"]


@dataclass(frozen=True)
class ResultadoComparacao:
    disponivel: bool
    motivo: str = ""
    tabela: pd.DataFrame = field(default_factory=lambda: pd.DataFrame(columns=COLUNAS_RESULTADO))
    contagens: dict[str, int] = field(default_factory=lambda: dict.fromkeys(CATEGORIAS, 0))
    excluidas_anterior: pd.DataFrame = field(default_factory=lambda: pd.DataFrame(columns=COLUNAS_EXCLUIDAS))
    excluidas_atual: pd.DataFrame = field(default_factory=lambda: pd.DataFrame(columns=COLUNAS_EXCLUIDAS))
    campos_comparados: tuple[str, ...] = ()
    campos_ignorados: tuple[str, ...] = ()
    parcial: bool = False
    avisos: tuple[str, ...] = ()


# Normalização ---------------------------------------------------------------------------

def _espacos(serie: pd.Series) -> pd.Series:
    return serie.fillna("").astype(str).str.replace(r"\s+", " ", regex=True).str.strip()


def _valores_comparaveis(fotografia: pd.DataFrame, campo: str) -> pd.Series:
    """Valor de um campo, normalizado da mesma forma nas duas importações."""
    if campo in (C.CLIENTE, C.DESTINO):
        return _espacos(fotografia[_COLUNA_FOTOGRAFIA[campo]])
    if campo == C.ESTADO:
        reconhecido = fotografia["estado_reconhecido"].astype(int) == 1
        return pd.Series(np.where(reconhecido, fotografia["estado"].fillna("").astype(str),
                                  _espacos(fotografia["estado_original"])), index=fotografia.index)
    coluna = _COLUNA_FOTOGRAFIA[campo]
    iso = fotografia[coluna]
    original = _espacos(fotografia[f"{coluna}_original"])
    return pd.Series(np.where(iso.notna(), iso.astype(object), np.where(original != "", "inválida:" + original, "")),
                     index=fotografia.index)


def _valor_mostrado(fotografia: pd.DataFrame, campo: str) -> pd.Series:
    """Valor como é mostrado ao utilizador (datas em dd/mm/aaaa; vazio como —)."""
    coluna = _COLUNA_FOTOGRAFIA[campo]
    if campo in C.CAMPOS_DATA:
        return pd.Series([descrever_data(i, o) for i, o in zip(fotografia[coluna], fotografia[f"{coluna}_original"])],
                         index=fotografia.index, dtype=object)
    texto = _espacos(fotografia[coluna] if campo != C.ESTADO else fotografia["estado"])
    return texto.where(texto != "", "—")


# Validação das chaves --------------------------------------------------------------------

def _chaves_repetidas(fotografia: pd.DataFrame) -> set[str]:
    contagem = fotografia["chave"].dropna().value_counts()
    return set(contagem[contagem > 1].index)


def _excluidas(fotografia: pd.DataFrame, repetidas_aqui: set[str], repetidas_outra: set[str]) -> pd.DataFrame:
    chave = fotografia["chave"]
    motivo = pd.Series(np.select(
        [chave.isna(), chave.isin(repetidas_aqui), chave.isin(repetidas_outra)],
        [MOTIVO_VAZIO, MOTIVO_REPETIDO, MOTIVO_REPETIDO_OUTRA], default=""), index=fotografia.index)
    fora = fotografia[motivo != ""]
    return pd.DataFrame({"Linha": fora["linha"].astype(int).to_numpy(),
                         "N.º Encomenda": fora["numero"].to_numpy(),
                         "Motivo": motivo[motivo != ""].to_numpy()}, columns=COLUNAS_EXCLUIDAS)


# Comparação --------------------------------------------------------------------------------

def comparar(anterior: pd.DataFrame, atual: pd.DataFrame, campos_anterior: set[str],
             campos_atual: set[str]) -> ResultadoComparacao:
    """Compara duas fotografias (``historico.carregar_fotografia``). Função pura."""
    comparados = tuple(c for c in CAMPOS_COMPARADOS if c in campos_anterior and c in campos_atual)
    ignorados = tuple(c for c in CAMPOS_COMPARADOS if (c in campos_anterior) != (c in campos_atual))

    rep_anterior, rep_atual = _chaves_repetidas(anterior), _chaves_repetidas(atual)
    ambiguas = rep_anterior | rep_atual
    exc_anterior = _excluidas(anterior, rep_anterior, rep_atual)
    exc_atual = _excluidas(atual, rep_atual, rep_anterior)
    validas_anterior = anterior[anterior["chave"].notna() & ~anterior["chave"].isin(ambiguas)]
    validas_atual = atual[atual["chave"].notna() & ~atual["chave"].isin(ambiguas)]

    if validas_anterior.empty or validas_atual.empty:
        lado = "anterior" if validas_anterior.empty else "atual"
        return ResultadoComparacao(
            False, f"A importação {lado} não tem nenhum n.º de encomenda que se possa emparelhar com segurança "
                   "(vazios ou repetidos). A comparação não foi feita.",
            excluidas_anterior=exc_anterior, excluidas_atual=exc_atual,
            campos_comparados=comparados, campos_ignorados=ignorados)

    def _lado(fotografia: pd.DataFrame, sufixo: str) -> pd.DataFrame:
        dados = {"chave": fotografia["chave"], f"numero{sufixo}": fotografia["numero"],
                 f"linha{sufixo}": fotografia["linha"].astype(int), f"cliente_mostrado{sufixo}": _valor_mostrado(fotografia, C.CLIENTE)}
        for campo in comparados:
            dados[f"{campo}{sufixo}"] = _valores_comparaveis(fotografia, campo)
            dados[f"{campo}_mostrado{sufixo}"] = _valor_mostrado(fotografia, campo)
        return pd.DataFrame(dados)

    juntas = _lado(validas_anterior, "_a").merge(_lado(validas_atual, "_b"), on="chave", how="outer", indicator=True)
    so_anterior = (juntas["_merge"] == "left_only").to_numpy()
    so_atual = (juntas["_merge"] == "right_only").to_numpy()
    ambas = ~so_anterior & ~so_atual

    mudou = {campo: ambas & (juntas[f"{campo}_a"] != juntas[f"{campo}_b"]).to_numpy() for campo in comparados}
    alterada = np.zeros(len(juntas), dtype=bool)
    for marcas in mudou.values():
        alterada |= marcas
    situacao = np.select([so_atual, so_anterior, alterada], [NOVA, NAO_ENCONTRADA, ALTERADA], default=SEM_ALTERACOES)

    descricoes = [[] for _ in range(len(juntas))]
    for campo in comparados:
        indices = np.flatnonzero(mudou[campo])
        if not len(indices):
            continue
        antes = juntas[f"{campo}_mostrado_a"].to_numpy()
        depois = juntas[f"{campo}_mostrado_b"].to_numpy()
        rotulo = C.rotulo(campo)
        for i in indices:
            descricoes[i].append(f"{rotulo}: {antes[i]} → {depois[i]}")

    tabela = pd.DataFrame({
        "Situação": situacao,
        "N.º Encomenda": juntas["numero_b"].where(juntas["numero_b"].notna(), juntas["numero_a"]),
        "Cliente": juntas["cliente_mostrado_b"].where(juntas["cliente_mostrado_b"].notna(), juntas["cliente_mostrado_a"]),
        "Alterações": ["; ".join(d) for d in descricoes],
        "Linha (anterior)": juntas["linha_a"].astype("Int64"),
        "Linha (atual)": juntas["linha_b"].astype("Int64"),
    }, columns=COLUNAS_RESULTADO)
    ordem = tabela["Situação"].map({c: i for i, c in enumerate(CATEGORIAS)})
    tabela = (tabela.assign(_o=ordem, _n=tabela["N.º Encomenda"].str.casefold())
              .sort_values(["_o", "_n"], kind="stable").drop(columns=["_o", "_n"]).reset_index(drop=True))
    contagens = {c: int((situacao == c).sum()) for c in CATEGORIAS}

    avisos = []
    fracoes = [len(exc_anterior) / len(anterior), len(exc_atual) / len(atual)]
    parcial = max(fracoes) > LIMIAR_PARCIAL
    if parcial:
        avisos.append(
            f"Comparação parcial: ficaram de fora {len(exc_anterior)} de {len(anterior)} linhas da importação anterior "
            f"e {len(exc_atual)} de {len(atual)} da atual (n.º vazio ou repetido). Os totais abaixo não cobrem "
            "essas linhas.")
    elif len(exc_anterior) or len(exc_atual):
        avisos.append(f"Ficaram de fora {len(exc_anterior)} linha(s) da importação anterior e {len(exc_atual)} da "
                      "atual (n.º vazio ou repetido) — ver a lista abaixo.")
    if ignorados:
        nomes = ", ".join(C.rotulo(c) for c in ignorados)
        avisos.append(f"Não comparado(s), porque só existia(m) numa das importações: {nomes}.")

    return ResultadoComparacao(True, "", tabela, contagens, exc_anterior, exc_atual, comparados, ignorados,
                               parcial, tuple(avisos))


def comparar_importacoes(caminho_db: Path, id_anterior: int, id_atual: int) -> ResultadoComparacao:
    """Carrega duas importações guardadas e compara-as (a anterior é a de n.º mais baixo)."""
    if id_anterior == id_atual:
        return ResultadoComparacao(False, "Escolha duas importações diferentes.")
    id_anterior, id_atual = sorted((int(id_anterior), int(id_atual)))
    info_anterior = obter_importacao(caminho_db, id_anterior)
    info_atual = obter_importacao(caminho_db, id_atual)
    if info_anterior is None or info_atual is None:
        return ResultadoComparacao(False, "Uma das importações escolhidas já não existe no histórico.")
    if info_anterior["estado"] not in ESTADOS_CONCLUIDOS or info_atual["estado"] not in ESTADOS_CONCLUIDOS:
        return ResultadoComparacao(False, "Só se podem comparar importações concluídas (as falhadas não têm dados).")
    if info_anterior["dados_eliminados_em"] or info_atual["dados_eliminados_em"]:
        return ResultadoComparacao(False, "Os dados de uma das importações escolhidas foram eliminados; não é "
                                          "possível compará-la.")
    return comparar(carregar_fotografia(caminho_db, id_anterior), carregar_fotografia(caminho_db, id_atual),
                    campos_presentes(info_anterior), campos_presentes(info_atual))
