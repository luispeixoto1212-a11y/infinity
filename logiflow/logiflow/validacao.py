"""Validação das encomendas.

Cada problema encontrado fica registado com a linha do ficheiro original,
para o utilizador o poder corrigir na origem. Há dois níveis:

* **Erro**: a linha não pode ser usada tal como está (campo obrigatório vazio,
  n.º de encomenda duplicado, data inválida). Não entra nos "dados limpos",
  mas é exportada à parte, com os valores originais e a descrição do erro.
* **Aviso**: a linha é aproveitada, mas há algo a confirmar (por exemplo, um
  estado que a aplicação não reconhece ou datas incoerentes).

Nenhuma encomenda é dada como entregue sem que o estado o diga explicitamente.
"""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from dataclasses import dataclass, field

import pandas as pd

from . import campos as C
from .datas import formatar_data, interpretar_data
from .importacao import FicheiroLido

ERRO = "Erro"
AVISO = "Aviso"

TIPO_VAZIO = "Campo obrigatório vazio"
TIPO_DUPLICADO = "N.º de encomenda duplicado"
TIPO_DATA_INVALIDA = "Data inválida"
TIPO_ESTADO = "Estado não reconhecido"
TIPO_INCOERENCIA = "Dados incoerentes"

# Colunas da tabela produzida pela validação (nomes internos).
COL_LINHA = "linha"
COL_ESTADO_ORIGINAL = "estado_original"
COL_ESTADO_RECONHECIDO = "estado_reconhecido"
COL_TEM_ERRO = "tem_erro"
COL_ERROS = "erros"
COL_AVISOS = "avisos"

COLUNAS_PROBLEMAS = ["Linha", "N.º Encomenda", "Gravidade", "Tipo", "Campo", "Descrição", "Valor no ficheiro"]


@dataclass
class ResultadoValidacao:
    tabela: pd.DataFrame          # uma linha por encomenda, com valores normalizados
    extras: pd.DataFrame          # colunas do ficheiro que não correspondem a nenhum campo
    originais: pd.DataFrame       # valores exatamente como foram lidos
    problemas: pd.DataFrame       # uma linha por problema (ver COLUNAS_PROBLEMAS)
    mapeamento: dict[str, str | None]
    data_referencia: dt.date
    campos_presentes: list[str] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.tabela)

    @property
    def linhas_com_erro(self) -> int:
        return int(self.tabela[COL_TEM_ERRO].sum())

    @property
    def linhas_validas(self) -> int:
        return self.total - self.linhas_com_erro


def _texto(valor: object) -> str:
    if isinstance(valor, (dt.date, dt.datetime)):
        return formatar_data(valor)
    return "" if valor is None else str(valor).strip()


def validar(
    lido: FicheiroLido,
    mapeamento: dict[str, str | None],
    data_referencia: dt.date,
) -> ResultadoValidacao:
    """Valida as encomendas de um ficheiro lido.

    ``mapeamento`` indica, para cada campo, a coluna do ficheiro correspondente.
    Todos os campos obrigatórios têm de estar mapeados.
    """
    em_falta = C.campos_em_falta(mapeamento)
    if em_falta:
        nomes = ", ".join(C.rotulo(c) for c in em_falta)
        raise ValueError(f"Faltam colunas obrigatórias: {nomes}")

    dados = lido.dados
    n = len(dados)
    problemas: list[dict[str, object]] = []
    erros: list[list[str]] = [[] for _ in range(n)]
    avisos: list[list[str]] = [[] for _ in range(n)]

    def coluna(campo: str) -> list[object]:
        nome = mapeamento.get(campo)
        return list(dados[nome]) if nome else [""] * n

    numeros = [_texto(v) for v in coluna(C.NUMERO)]

    def registar(i: int, gravidade: str, tipo: str, campo: str, descricao: str, valor: object) -> None:
        problemas.append({
            "Linha": lido.linhas[i],
            "N.º Encomenda": numeros[i],
            "Gravidade": gravidade,
            "Tipo": tipo,
            "Campo": C.rotulo(campo),
            "Descrição": descricao,
            "Valor no ficheiro": _texto(valor),
        })
        (erros if gravidade == ERRO else avisos)[i].append(descricao)

    # 1. Campos obrigatórios vazios ---------------------------------------
    valores_campo: dict[str, list[object]] = {campo: coluna(campo) for campo in C.CAMPOS_POR_NOME}
    for campo in C.CAMPOS_OBRIGATORIOS:
        for i, valor in enumerate(valores_campo[campo]):
            if not _texto(valor):
                registar(i, ERRO, TIPO_VAZIO, campo, f"{C.rotulo(campo)} está vazio", valor)

    # 2. Números de encomenda duplicados (ignora maiúsculas e espaços nas pontas)
    grupos: dict[str, list[int]] = defaultdict(list)
    for i, numero in enumerate(numeros):
        if numero:
            grupos[numero.casefold()].append(i)
    for indices in grupos.values():
        if len(indices) < 2:
            continue
        linhas_txt = ", ".join(str(lido.linhas[i]) for i in indices)
        identicas = all(
            [_texto(v) for v in dados.iloc[i]] == [_texto(v) for v in dados.iloc[indices[0]]]
            for i in indices[1:]
        )
        detalhe = " — as linhas são idênticas (provável registo repetido)" if identicas else ""
        for i in indices:
            registar(
                i, ERRO, TIPO_DUPLICADO, C.NUMERO,
                f"N.º {numeros[i]} repetido {len(indices)} vezes (linhas {linhas_txt}){detalhe}",
                numeros[i],
            )

    # 3. Datas ------------------------------------------------------------
    datas: dict[str, list[dt.date | None]] = {}
    for campo in C.CAMPOS_DATA:
        convertidas: list[dt.date | None] = []
        for i, valor in enumerate(valores_campo[campo]):
            data, motivo = interpretar_data(valor)
            if motivo:
                registar(i, ERRO, TIPO_DATA_INVALIDA, campo, f"{C.rotulo(campo)} inválida: {motivo}", valor)
            convertidas.append(data)
        datas[campo] = convertidas

    # 4. Estados ----------------------------------------------------------
    estados_originais = [_texto(v) for v in valores_campo[C.ESTADO]]
    estados: list[str] = []
    reconhecidos: list[bool] = []
    for i, original in enumerate(estados_originais):
        canonico = C.normalizar_estado(original) if original else None
        if original and canonico is None:
            registar(
                i, AVISO, TIPO_ESTADO, C.ESTADO,
                f"Estado «{original}» não reconhecido — não conta como entregue nem como pendente",
                original,
            )
        estados.append(canonico or original)
        reconhecidos.append(canonico is not None)

    # 5. Incoerências (avisos) --------------------------------------------
    for i in range(n):
        data, prevista, entrega = datas[C.DATA][i], datas[C.DATA_PREVISTA][i], datas[C.DATA_ENTREGA][i]
        if data and data > data_referencia:
            registar(i, AVISO, TIPO_INCOERENCIA, C.DATA,
                     f"Data da encomenda posterior à data de referência ({formatar_data(data_referencia)})",
                     valores_campo[C.DATA][i])
        if data and prevista and prevista < data:
            registar(i, AVISO, TIPO_INCOERENCIA, C.DATA_PREVISTA,
                     "Data prevista anterior à data da encomenda", valores_campo[C.DATA_PREVISTA][i])
        if data and entrega and entrega < data:
            registar(i, AVISO, TIPO_INCOERENCIA, C.DATA_ENTREGA,
                     "Data de entrega anterior à data da encomenda", valores_campo[C.DATA_ENTREGA][i])
        if entrega and estados[i] != C.ENTREGUE:
            registar(i, AVISO, TIPO_INCOERENCIA, C.DATA_ENTREGA,
                     f"Tem data de entrega mas o estado é «{estados_originais[i] or 'vazio'}» — "
                     "não é contada como entregue", valores_campo[C.DATA_ENTREGA][i])
        if entrega and entrega > data_referencia:
            registar(i, AVISO, TIPO_INCOERENCIA, C.DATA_ENTREGA,
                     f"Data de entrega posterior à data de referência ({formatar_data(data_referencia)})",
                     valores_campo[C.DATA_ENTREGA][i])

    # Tabela final ----------------------------------------------------------
    tabela = pd.DataFrame({
        COL_LINHA: lido.linhas,
        C.NUMERO: numeros,
        C.CLIENTE: [_texto(v) for v in valores_campo[C.CLIENTE]],
        C.DATA: pd.to_datetime(pd.Series(datas[C.DATA], dtype=object)),
        C.DESTINO: [_texto(v) for v in valores_campo[C.DESTINO]],
        C.ESTADO: estados,
        COL_ESTADO_ORIGINAL: estados_originais,
        COL_ESTADO_RECONHECIDO: reconhecidos,
        C.DATA_PREVISTA: pd.to_datetime(pd.Series(datas[C.DATA_PREVISTA], dtype=object)),
        C.DATA_ENTREGA: pd.to_datetime(pd.Series(datas[C.DATA_ENTREGA], dtype=object)),
        COL_TEM_ERRO: [bool(e) for e in erros],
        COL_ERROS: ["; ".join(e) for e in erros],
        COL_AVISOS: ["; ".join(a) for a in avisos],
    })

    colunas_mapeadas = {c for c in mapeamento.values() if c}
    extras = dados[[c for c in dados.columns if c not in colunas_mapeadas]].map(_texto)
    extras = extras.reset_index(drop=True)

    tabela_problemas = pd.DataFrame(problemas, columns=COLUNAS_PROBLEMAS)
    if not tabela_problemas.empty:
        ordem_gravidade = tabela_problemas["Gravidade"].map({ERRO: 0, AVISO: 1})
        tabela_problemas = (
            tabela_problemas.assign(_g=ordem_gravidade)
            .sort_values(["Linha", "_g"], kind="stable")
            .drop(columns="_g")
            .reset_index(drop=True)
        )

    return ResultadoValidacao(
        tabela=tabela,
        extras=extras,
        originais=dados.reset_index(drop=True),
        problemas=tabela_problemas,
        mapeamento=dict(mapeamento),
        data_referencia=data_referencia,
        campos_presentes=[c for c, col in mapeamento.items() if col],
    )
