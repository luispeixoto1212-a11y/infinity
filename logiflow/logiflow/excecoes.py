"""Painel de exceções: as encomendas que precisam de intervenção.

Categorias (uma encomenda pode estar em várias):

* **Atrasada** — estado «Pendente» ou «Em trânsito», prazo conhecido e já
  ultrapassado na data de referência (a mesma regra dos indicadores do topo).
  Sem prazo, nunca se conclui que está atrasada.
* **Prazo próximo** — por entregar, com prazo hoje ou amanhã. As datas não têm
  hora, por isso «nas próximas 48 horas» corresponde a prazo no próprio dia da
  referência ou no dia seguinte.
* **Pendente há demasiado tempo** — por entregar há pelo menos
  ``LIMITE_PENDENCIA_DIAS`` dias, contados desde uma data da encomenda válida.
* **Dados incompletos ou inválidos** — erros de validação já existentes que não
  são duplicados (campo obrigatório vazio, data inválida).
* **Possível duplicado** — n.º de encomenda repetido, segundo a regra de
  validação já existente.

Prioridade (a mais alta das categorias da encomenda):

* **Alta** — atrasada.
* **Média** — prazo próximo ou pendente há demasiado tempo.
* **Baixa** — só problemas de qualidade de dados (sem urgência demonstrada).

Cada linha do ficheiro aparece no máximo uma vez, com todos os motivos. Os
prazos calculados com o prazo padrão são identificados como tal.
"""

from __future__ import annotations

import datetime as dt
from collections import Counter
from collections.abc import Iterable, Sequence

import pandas as pd

from . import campos as C
from .datas import formatar_data
from .indicadores import COL_DIAS_ATRASO, COL_ORIGEM_PRAZO, COL_PRAZO, COL_SITUACAO, SIT_ATRASADA
from .validacao import AVISO, COL_LINHA, ERRO, TIPO_DUPLICADO

LIMITE_PENDENCIA_DIAS = 5
JANELA_PRAZO_PROXIMO_DIAS = 1  # 0 = vence hoje, 1 = vence amanhã (≈ próximas 48 horas)

CAT_ATRASADA = "Atrasada"
CAT_PRAZO_PROXIMO = "Prazo próximo"
CAT_PENDENCIA = "Pendente há demasiado tempo"
CAT_DADOS = "Dados incompletos ou inválidos"
CAT_DUPLICADO = "Possível duplicado"
CATEGORIAS = (CAT_ATRASADA, CAT_PRAZO_PROXIMO, CAT_PENDENCIA, CAT_DADOS, CAT_DUPLICADO)

ALTA, MEDIA, BAIXA = "Alta", "Média", "Baixa"
PRIORIDADES = (ALTA, MEDIA, BAIXA)
PRIORIDADE_DA_CATEGORIA = {
    CAT_ATRASADA: ALTA,
    CAT_PRAZO_PROXIMO: MEDIA,
    CAT_PENDENCIA: MEDIA,
    CAT_DADOS: BAIXA,
    CAT_DUPLICADO: BAIXA,
}
REGRAS = {
    CAT_ATRASADA: "Pendente ou em trânsito, com prazo conhecido já ultrapassado na data de referência.",
    CAT_PRAZO_PROXIMO: "Pendente ou em trânsito, com prazo hoje ou amanhã (próximas 48 horas; as datas não têm hora).",
    CAT_PENDENCIA: f"Pendente ou em trânsito há {LIMITE_PENDENCIA_DIAS} ou mais dias, desde uma data da encomenda válida.",
    CAT_DADOS: "Erro de validação: campo obrigatório vazio ou data inválida.",
    CAT_DUPLICADO: "N.º de encomenda repetido no ficheiro (todas as ocorrências).",
}

# Colunas da tabela de exceções (nomes prontos a mostrar e a exportar).
PRIORIDADE = "Prioridade"
NUMERO = "N.º Encomenda"
CLIENTE = "Cliente"
DESTINO = "Destino"
ESTADO = "Estado"
PRAZO = "Prazo"
ORIGEM_PRAZO = "Origem do prazo"
DIAS_ATRASO = "Dias de atraso"
DIAS_POR_ENTREGAR = "Dias por entregar"
CATEGORIAS_COL = "Categorias"
MOTIVOS = "Motivos"
AVISOS = "Avisos de validação"
LINHA = "Linha"
COLUNAS = [PRIORIDADE, NUMERO, CLIENTE, CATEGORIAS_COL, MOTIVOS, ESTADO, PRAZO, ORIGEM_PRAZO, DIAS_ATRASO,
           DIAS_POR_ENTREGAR, DESTINO, AVISOS, LINHA]

# Colunas auxiliares (não mostradas nem exportadas): ordenação e filtro por categoria.
_ORDEM = "_ordem_prioridade"
_CAT = {c: f"_cat_{i}" for i, c in enumerate(CATEGORIAS)}
_ORDEM_PRIORIDADE = {ALTA: 0, MEDIA: 1, BAIXA: 2}

ORDENAR_PRIORIDADE = "Prioridade"    # Alta → Baixa; depois mais dias de atraso e por entregar
ORDENAR_ANTIGUIDADE = "Antiguidade"  # mais dias por entregar primeiro
ORDENACOES = (ORDENAR_PRIORIDADE, ORDENAR_ANTIGUIDADE)


def _dias(n: int) -> str:
    return f"{n} dia" if n == 1 else f"{n} dias"


def _descrever_prazo(prazo: pd.Timestamp, origem: str) -> str:
    """Indica sempre se o prazo vem do ficheiro ou foi calculado com o prazo padrão."""
    if origem.startswith("Prazo padrão"):
        return f"prazo calculado {formatar_data(prazo)}, {origem.lower()}"
    return f"data prevista {formatar_data(prazo)}"


def _por_linha(problemas: pd.DataFrame, mascara: pd.Series) -> dict[int, list[str]]:
    selecionados = problemas[mascara]
    resultado: dict[int, list[str]] = {}
    for linha, descricao in zip(selecionados["Linha"], selecionados["Descrição"]):
        resultado.setdefault(int(linha), []).append(str(descricao))
    return resultado


def tabela_vazia() -> pd.DataFrame:
    return pd.DataFrame(columns=[*COLUNAS, _ORDEM, *_CAT.values()])


def identificar_excecoes(tabela: pd.DataFrame, problemas: pd.DataFrame,
                         data_referencia: dt.date) -> pd.DataFrame:
    """Uma linha por encomenda com pelo menos uma exceção, ordenada por prioridade.

    ``tabela`` é a tabela devolvida por ``aplicar_prazos`` (eventualmente já com os
    filtros do topo aplicados); ``problemas`` é ``ResultadoValidacao.problemas``.
    Não altera nenhum dos dois.
    """
    if tabela.empty:
        return tabela_vazia()
    referencia = pd.Timestamp(data_referencia)
    por_entregar = tabela[C.ESTADO].isin(C.ESTADOS_POR_ENTREGAR)
    prazo = tabela[COL_PRAZO]
    dias_para_prazo = (prazo - referencia).dt.days
    idade = (referencia - tabela[C.DATA]).dt.days
    # Dias por entregar só quando a data da encomenda é válida e não é posterior à referência.
    dias_por_entregar = idade.where(por_entregar & tabela[C.DATA].notna() & (idade >= 0))

    visiveis = problemas[problemas["Linha"].isin(set(tabela[COL_LINHA]))]
    erro = visiveis["Gravidade"] == ERRO
    duplicados = _por_linha(visiveis, erro & (visiveis["Tipo"] == TIPO_DUPLICADO))
    erros_dados = _por_linha(visiveis, erro & (visiveis["Tipo"] != TIPO_DUPLICADO))
    avisos = _por_linha(visiveis, visiveis["Gravidade"] == AVISO)

    linhas = tabela[COL_LINHA].astype(int)
    categorias = {
        CAT_ATRASADA: tabela[COL_SITUACAO] == SIT_ATRASADA,
        CAT_PRAZO_PROXIMO: por_entregar & prazo.notna() & dias_para_prazo.between(0, JANELA_PRAZO_PROXIMO_DIAS),
        CAT_PENDENCIA: dias_por_entregar >= LIMITE_PENDENCIA_DIAS,
        CAT_DADOS: linhas.isin(list(erros_dados)),
        CAT_DUPLICADO: linhas.isin(list(duplicados)),
    }
    alguma = pd.concat(list(categorias.values()), axis=1).any(axis=1)
    if not alguma.any():
        return tabela_vazia()

    # Construção por listas (colunas extraídas de uma vez): muito mais rápido do que ler
    # célula a célula, o que importa porque o painel é recalculado a cada interação.
    sub = tabela[alguma]
    presencas = list(zip(*(categorias[c][alguma].tolist() for c in CATEGORIAS)))
    prazos = sub[COL_PRAZO].tolist()
    origens = sub[COL_ORIGEM_PRAZO].tolist()
    atrasos = sub[COL_DIAS_ATRASO].tolist()
    para_prazo = dias_para_prazo[alguma].tolist()
    pendencias = dias_por_entregar[alguma].tolist()
    datas_txt = sub[C.DATA].dt.strftime("%d/%m/%Y").tolist()

    registos = []
    for k, linha in enumerate(sub[COL_LINHA].astype(int).tolist()):
        presentes = [c for c, tem in zip(CATEGORIAS, presencas[k]) if tem]
        prazo_k = prazos[k]
        origem = origens[k] if pd.notna(prazo_k) else ""
        motivos = []
        dias_atraso = pd.NA
        if CAT_ATRASADA in presentes:
            dias_atraso = int(atrasos[k])
            motivos.append(f"Atrasada há {_dias(dias_atraso)} ({_descrever_prazo(prazo_k, origem)})")
        if CAT_PRAZO_PROXIMO in presentes:
            quando = "hoje" if int(para_prazo[k]) == 0 else "amanhã"
            motivos.append(f"Prazo termina {quando} ({_descrever_prazo(prazo_k, origem)})")
        dias_pend = pendencias[k]
        if CAT_PENDENCIA in presentes:
            motivos.append(f"Por entregar há {_dias(int(dias_pend))} (encomenda de {datas_txt[k]})")
        motivos += erros_dados.get(linha, [])
        motivos += duplicados.get(linha, [])
        prioridade = min((PRIORIDADE_DA_CATEGORIA[c] for c in presentes), key=_ORDEM_PRIORIDADE.get)
        registo = {
            PRIORIDADE: prioridade,
            CATEGORIAS_COL: " · ".join(presentes),
            MOTIVOS: "; ".join(motivos),
            PRAZO: prazo_k,
            ORIGEM_PRAZO: origem,
            DIAS_ATRASO: dias_atraso,
            DIAS_POR_ENTREGAR: int(dias_pend) if pd.notna(dias_pend) else pd.NA,
            AVISOS: "; ".join(avisos.get(linha, [])),
            LINHA: linha,
            _ORDEM: _ORDEM_PRIORIDADE[prioridade],
        }
        registo.update({_CAT[c]: c in presentes for c in CATEGORIAS})
        registos.append(registo)
    copiados = {NUMERO: C.NUMERO, CLIENTE: C.CLIENTE, ESTADO: C.ESTADO, DESTINO: C.DESTINO}
    for coluna, origem_col in copiados.items():
        for registo, valor in zip(registos, sub[origem_col].tolist()):
            registo[coluna] = valor

    excecoes = pd.DataFrame(registos, columns=[*COLUNAS, _ORDEM, *_CAT.values()])
    excecoes = excecoes.astype({DIAS_ATRASO: "Int64", DIAS_POR_ENTREGAR: "Int64"})
    return ordenar(excecoes, ORDENAR_PRIORIDADE)


def ordenar(excecoes: pd.DataFrame, criterio: str = ORDENAR_PRIORIDADE) -> pd.DataFrame:
    """Ordenação determinística. Prioridade: Alta → Baixa, depois mais dias de atraso, mais
    dias por entregar e linha do ficheiro. Antiguidade: mais dias por entregar primeiro."""
    if criterio not in ORDENACOES:
        raise ValueError(f"Ordenação inválida: {criterio!r}")
    if criterio == ORDENAR_PRIORIDADE:
        chaves, ascendente = [_ORDEM, DIAS_ATRASO, DIAS_POR_ENTREGAR, LINHA], [True, False, False, True]
    else:
        chaves, ascendente = [DIAS_POR_ENTREGAR, _ORDEM, DIAS_ATRASO, LINHA], [False, True, False, True]
    return excecoes.sort_values(chaves, ascending=ascendente, na_position="last", kind="stable").reset_index(drop=True)


def filtrar(excecoes: pd.DataFrame, pesquisa: str = "", categorias: Iterable[str] = (),
            prioridades: Iterable[str] = (), cliente: str | None = None) -> pd.DataFrame:
    """Filtros do painel. Devolve uma cópia filtrada; não altera ``excecoes``.

    * ``pesquisa``: texto no n.º da encomenda ou no cliente (sem distinguir acentos nem
      maiúsculas; texto simples, sem expressões regulares).
    * ``categorias``: encomendas com **pelo menos uma** das categorias escolhidas.
    * ``prioridades``: encomendas com uma das prioridades escolhidas.
    * ``cliente``: só esse cliente (escritas diferentes do mesmo nome contam como iguais).
    """
    mascara = pd.Series(True, index=excecoes.index)
    alvo = C.normalizar_texto(pesquisa)  # só pontuação ou espaços → sem efeito, como a pesquisa do topo
    if alvo:
        texto = (excecoes[NUMERO].astype(str) + " " + excecoes[CLIENTE].astype(str)).map(C.normalizar_texto)
        mascara &= texto.str.contains(alvo, regex=False)
    categorias = [c for c in categorias if c in _CAT]
    if categorias:
        mascara &= excecoes[[_CAT[c] for c in categorias]].astype(bool).any(axis=1)
    prioridades = list(prioridades)
    if prioridades:
        mascara &= excecoes[PRIORIDADE].isin(prioridades)
    if cliente is not None:
        mascara &= excecoes[CLIENTE].astype(str).map(C.normalizar_texto) == C.normalizar_texto(cliente)
    return excecoes[mascara].copy()


def clientes(excecoes: pd.DataFrame) -> list[str]:
    """Clientes com exceções (grafia mais frequente de cada um), por ordem alfabética."""
    nomes: dict[str, Counter] = {}
    for nome in excecoes[CLIENTE].astype(str):
        if nome.strip():
            nomes.setdefault(C.normalizar_texto(nome), Counter())[nome] += 1
    return sorted((max(c, key=c.get) for c in nomes.values()), key=str.casefold)


def contagens(excecoes: pd.DataFrame) -> dict[str, dict[str, int] | int]:
    """Totais por prioridade e por categoria. As categorias **não se somam**: uma
    encomenda pode estar em várias."""
    return {
        "encomendas": len(excecoes),
        "por_prioridade": {p: int((excecoes[PRIORIDADE] == p).sum()) for p in PRIORIDADES},
        "por_categoria": {c: int(excecoes[_CAT[c]].astype(bool).sum()) for c in CATEGORIAS},
    }


def visiveis(excecoes: pd.DataFrame, colunas: Sequence[str] = COLUNAS) -> pd.DataFrame:
    """Só as colunas que se mostram e exportam (sem as auxiliares)."""
    return excecoes[list(colunas)]
