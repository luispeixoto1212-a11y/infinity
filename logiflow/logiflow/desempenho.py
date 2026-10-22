"""Desempenho operacional: entregas no prazo, tempos de entrega e comparação
por cliente, destino e período.

Regras (as mesmas do resto da aplicação, sem inventar dados):

* Só se usam as encomendas **sem erros** — as mesmas dos «dados limpos».
  Linhas duplicadas ou com datas inválidas distorceriam as taxas e as médias.
* **Taxa de entregas no prazo** = entregues no prazo ÷ entregas avaliadas. Uma
  entrega só é avaliada se tiver o estado «Entregue», data de entrega e prazo
  (data prevista ou prazo padrão). Sem entregas avaliadas, a taxa não existe
  (``None``) em vez de ser 0 % ou 100 %.
* **Tempo de entrega** = data de entrega − data da encomenda, em dias, só para
  encomendas entregues com as duas datas. Uma entrega anterior à encomenda é
  incoerente: fica de fora das médias e é contada à parte.
* Taxas com menos de ``AMOSTRA_MINIMA`` entregas avaliadas são assinaladas:
  servem de indicação, não de conclusão.
* Clientes e destinos escritos de formas diferentes (maiúsculas, acentos,
  pontuação) são agrupados; mostra-se a grafia mais frequente.
"""

from __future__ import annotations

import datetime as dt
from collections import Counter
from dataclasses import dataclass

import pandas as pd

from . import campos as C
from .indicadores import (
    COL_DIAS_ATRASO,
    COL_SITUACAO,
    SIT_ATRASADA,
    SIT_ENTREGUE_ATRASO,
    SIT_ENTREGUE_PRAZO,
    SIT_SEM_PRAZO,
    calcular_indicadores,
)
from .validacao import COL_TEM_ERRO

AMOSTRA_MINIMA = 5

SEMANA, MES = "Semana", "Mês"
PERIODOS = (SEMANA, MES)
_MESES = ("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
          "agosto", "setembro", "outubro", "novembro", "dezembro")

# (mínimo, máximo, rótulo) em dias desde a data da encomenda; None = sem limite.
FAIXAS_ANTIGUIDADE = ((0, 2, "Até 2 dias"), (3, 5, "3 a 5 dias"), (6, 10, "6 a 10 dias"),
                      (11, None, "Mais de 10 dias"))
FAIXA_FUTURA = "Data da encomenda posterior à referência"

COL_TEMPO = "tempo_entrega_dias"
_COL_INCOERENTE = "_entrega_incoerente"

# Colunas das tabelas apresentadas (nomes prontos a mostrar e a exportar).
ENCOMENDAS = "Encomendas"
ENTREGUES = "Entregues"
PENDENTES = "Pendentes"
ATRASADAS = "Pendentes atrasadas"
AVALIADAS = "Entregas avaliadas"
NO_PRAZO = "No prazo"
TAXA = "Taxa no prazo"
TEMPO_MEDIO = "Tempo médio de entrega (dias)"
OBSERVACAO = "Observação"
PERIODO = "Período"
INICIO_PERIODO = "Início do período"
REGISTADAS = "Encomendas registadas"
ENTREGAS = "Entregas efetuadas"
ANTIGUIDADE = "Antiguidade (desde a data da encomenda)"
DAS_QUAIS_ATRASADAS = "Das quais atrasadas"

OBS_POUCAS = f"Poucas entregas avaliadas (<{AMOSTRA_MINIMA})"
OBS_SEM_AVALIADAS = "Sem entregas avaliadas"


# Base de cálculo -------------------------------------------------------------

def base_desempenho(tabela: pd.DataFrame) -> pd.DataFrame:
    """Encomendas sem erros, com o tempo de entrega calculado.

    ``tabela`` é a tabela devolvida por ``aplicar_prazos``.
    """
    base = tabela[~tabela[COL_TEM_ERRO]].copy()
    entregue = base[C.ESTADO] == C.ENTREGUE
    dias = pd.to_numeric((base[C.DATA_ENTREGA] - base[C.DATA]).dt.days, errors="coerce")
    base[COL_TEMPO] = dias.where(entregue & (dias >= 0))
    base[_COL_INCOERENTE] = entregue & (dias < 0)
    return base


def _avaliadas(base: pd.DataFrame) -> pd.Series:
    return base[COL_SITUACAO].isin([SIT_ENTREGUE_PRAZO, SIT_ENTREGUE_ATRASO])


def _media(valores: pd.Series) -> float | None:
    valores = valores.dropna()
    return float(valores.mean()) if len(valores) else None


def _mediana(valores: pd.Series) -> float | None:
    valores = valores.dropna()
    return float(valores.median()) if len(valores) else None


# Resumo ------------------------------------------------------------------------

@dataclass(frozen=True)
class ResumoDesempenho:
    base: int                         # encomendas sem erros consideradas
    excluidas_com_erros: int
    entregues: int
    avaliadas: int                    # entregues com data de entrega e prazo
    no_prazo: int
    com_atraso: int
    atraso_medio_dias: float | None   # entre as entregues com atraso
    com_tempo: int                    # entregas com tempo de entrega calculável
    tempo_medio_dias: float | None
    tempo_mediano_dias: float | None
    incoerentes: int                  # entrega antes da encomenda (fora das médias)
    entregues_sem_data: int           # entregues sem data de entrega
    pendentes: int
    atrasadas: int | None             # None = não é possível determinar
    pendentes_sem_prazo: int
    data_inicio: dt.date | None       # primeira e última data de encomenda da base
    data_fim: dt.date | None

    @property
    def taxa_no_prazo(self) -> float | None:
        return self.no_prazo / self.avaliadas if self.avaliadas else None

    @property
    def amostra_pequena(self) -> bool:
        return 0 < self.avaliadas < AMOSTRA_MINIMA


def resumir(tabela: pd.DataFrame) -> ResumoDesempenho:
    """Indicadores de desempenho de uma tabela já passada por ``aplicar_prazos``."""
    base = base_desempenho(tabela)
    ind = calcular_indicadores(base)
    situacao = base[COL_SITUACAO]
    atraso = situacao == SIT_ENTREGUE_ATRASO
    entregue = base[C.ESTADO] == C.ENTREGUE
    datas = base[C.DATA].dropna()
    return ResumoDesempenho(
        base=len(base),
        excluidas_com_erros=int(tabela[COL_TEM_ERRO].sum()),
        entregues=ind.entregues,
        avaliadas=int(_avaliadas(base).sum()),
        no_prazo=int((situacao == SIT_ENTREGUE_PRAZO).sum()),
        com_atraso=int(atraso.sum()),
        atraso_medio_dias=_media(base.loc[atraso, COL_DIAS_ATRASO].astype("Float64")),
        com_tempo=int(base[COL_TEMPO].notna().sum()),
        tempo_medio_dias=_media(base[COL_TEMPO]),
        tempo_mediano_dias=_mediana(base[COL_TEMPO]),
        incoerentes=int(base[_COL_INCOERENTE].sum()),
        entregues_sem_data=int((entregue & base[C.DATA_ENTREGA].isna()).sum()),
        pendentes=ind.pendentes,
        atrasadas=ind.atrasadas,
        pendentes_sem_prazo=ind.pendentes_sem_prazo,
        data_inicio=datas.min().date() if len(datas) else None,
        data_fim=datas.max().date() if len(datas) else None,
    )


# Comparação por cliente ou destino ------------------------------------------------

def _grafia_mais_comum(valores: pd.Series) -> str:
    contagem = Counter(valores)  # mantém a ordem de aparecimento: em empate, ganha a primeira
    return max(contagem, key=contagem.get) if contagem else ""


def _observacao(entregues: int, avaliadas: int) -> str:
    if avaliadas == 0:
        return OBS_SEM_AVALIADAS if entregues else ""
    return OBS_POUCAS if avaliadas < AMOSTRA_MINIMA else ""


def chave_grupo(valores: pd.Series) -> pd.Series:
    """Chave de agrupamento: ignora maiúsculas, acentos, pontuação e espaços."""
    return valores.map(C.normalizar_texto)


def por_grupo(tabela: pd.DataFrame, campo: str) -> pd.DataFrame:
    """Desempenho por cliente (``campos.CLIENTE``) ou por destino (``campos.DESTINO``).

    Ordenado pelo número de encomendas (do maior para o menor).
    """
    rotulo = C.rotulo(campo)
    colunas = [rotulo, ENCOMENDAS, ENTREGUES, PENDENTES, ATRASADAS, AVALIADAS, NO_PRAZO, TAXA,
               TEMPO_MEDIO, OBSERVACAO]
    base = base_desempenho(tabela)
    if base.empty:
        return pd.DataFrame(columns=colunas)

    situacao = base[COL_SITUACAO]
    pendente = base[C.ESTADO].isin(C.ESTADOS_POR_ENTREGAR)
    dados = pd.DataFrame({
        "chave": chave_grupo(base[campo]),
        "nome": base[campo],
        "encomendas": 1,
        "entregues": base[C.ESTADO] == C.ENTREGUE,
        "pendentes": pendente,
        "pendentes_sem_prazo": situacao == SIT_SEM_PRAZO,
        "atrasadas": situacao == SIT_ATRASADA,
        "avaliadas": _avaliadas(base),
        "no_prazo": situacao == SIT_ENTREGUE_PRAZO,
        "tempo": base[COL_TEMPO],
    })
    grupos = dados.groupby("chave", sort=False)
    somas = grupos[["encomendas", "entregues", "pendentes", "pendentes_sem_prazo", "atrasadas",
                    "avaliadas", "no_prazo"]].sum()
    tempos = grupos["tempo"].mean()
    nomes = grupos["nome"].agg(_grafia_mais_comum)

    linhas = []
    for chave, s in somas.iterrows():
        avaliadas, pendentes = int(s["avaliadas"]), int(s["pendentes"])
        # Se nenhuma pendente do grupo tem prazo, não se sabe quantas estão atrasadas.
        atrasadas = pd.NA if pendentes and int(s["pendentes_sem_prazo"]) == pendentes else int(s["atrasadas"])
        linhas.append({
            rotulo: nomes[chave] or "(vazio)",
            ENCOMENDAS: int(s["encomendas"]),
            ENTREGUES: int(s["entregues"]),
            PENDENTES: pendentes,
            ATRASADAS: atrasadas,
            AVALIADAS: avaliadas,
            NO_PRAZO: int(s["no_prazo"]),
            TAXA: s["no_prazo"] / avaliadas if avaliadas else pd.NA,
            TEMPO_MEDIO: tempos[chave] if pd.notna(tempos[chave]) else pd.NA,
            OBSERVACAO: _observacao(int(s["entregues"]), avaliadas),
        })
    resultado = pd.DataFrame(linhas, columns=colunas)
    ordem = resultado[rotulo].str.casefold()
    resultado = resultado.assign(_o=ordem).sort_values([ENCOMENDAS, "_o"], ascending=[False, True])
    resultado = resultado.drop(columns="_o").reset_index(drop=True)
    return resultado.astype({ATRASADAS: "Int64", TAXA: "Float64", TEMPO_MEDIO: "Float64"})


def clientes(tabela: pd.DataFrame) -> list[str]:
    """Clientes das encomendas sem erros (grafia mais frequente), por ordem alfabética."""
    base = tabela[~tabela[COL_TEM_ERRO]]
    if base.empty:
        return []
    nomes = base.groupby(chave_grupo(base[C.CLIENTE]), sort=False)[C.CLIENTE].agg(_grafia_mais_comum)
    return sorted((n for n in nomes if n), key=str.casefold)


def filtrar_cliente(tabela: pd.DataFrame, cliente: str) -> pd.DataFrame:
    """Só as encomendas de um cliente (com as mesmas regras de agrupamento)."""
    return tabela[chave_grupo(tabela[C.CLIENTE]) == C.normalizar_texto(cliente)]


# Por período -----------------------------------------------------------------------

def _inicio_periodo(datas: pd.Series, periodo: str) -> pd.Series:
    datas = datas.dt.normalize()
    if periodo == SEMANA:
        return datas - pd.to_timedelta(datas.dt.weekday, unit="D")  # segunda-feira
    return datas - pd.to_timedelta(datas.dt.day - 1, unit="D")      # dia 1 do mês


def rotulo_periodo(inicio: pd.Timestamp, periodo: str) -> str:
    if periodo == SEMANA:
        fim = inicio + pd.Timedelta(days=6)
        return f"{inicio:%d/%m} a {fim:%d/%m/%Y}"
    return f"{_MESES[inicio.month - 1]} de {inicio.year}"


def por_periodo(tabela: pd.DataFrame, periodo: str = SEMANA) -> pd.DataFrame:
    """Encomendas registadas (pela data da encomenda) e entregas (pela data de entrega)
    por semana (segunda a domingo) ou por mês, por ordem cronológica.

    As entregas sem data de entrega não podem ser colocadas num período e não aparecem
    aqui (o resumo indica quantas são).
    """
    if periodo not in PERIODOS:
        raise ValueError(f"Período inválido: {periodo!r}")
    colunas = [PERIODO, INICIO_PERIODO, REGISTADAS, ENTREGAS, AVALIADAS, NO_PRAZO, TAXA,
               TEMPO_MEDIO, OBSERVACAO]
    base = base_desempenho(tabela)
    registadas = _inicio_periodo(base[C.DATA].dropna(), periodo).value_counts()

    entregas = base[(base[C.ESTADO] == C.ENTREGUE) & base[C.DATA_ENTREGA].notna()]
    dados = pd.DataFrame({
        "inicio": _inicio_periodo(entregas[C.DATA_ENTREGA], periodo),
        "entregas": 1,
        "avaliadas": _avaliadas(entregas),
        "no_prazo": entregas[COL_SITUACAO] == SIT_ENTREGUE_PRAZO,
        "tempo": entregas[COL_TEMPO],
    })
    somas = dados.groupby("inicio")[["entregas", "avaliadas", "no_prazo"]].sum()
    tempos = dados.groupby("inicio")["tempo"].mean()

    linhas = []
    for inicio in sorted(set(registadas.index) | set(somas.index)):
        s = somas.loc[inicio] if inicio in somas.index else None
        n_entregas = int(s["entregas"]) if s is not None else 0
        avaliadas = int(s["avaliadas"]) if s is not None else 0
        no_prazo = int(s["no_prazo"]) if s is not None else 0
        tempo = tempos.get(inicio, pd.NA)
        linhas.append({
            PERIODO: rotulo_periodo(inicio, periodo),
            INICIO_PERIODO: inicio,
            REGISTADAS: int(registadas.get(inicio, 0)),
            ENTREGAS: n_entregas,
            AVALIADAS: avaliadas,
            NO_PRAZO: no_prazo,
            TAXA: no_prazo / avaliadas if avaliadas else pd.NA,
            TEMPO_MEDIO: tempo if pd.notna(tempo) else pd.NA,
            OBSERVACAO: _observacao(n_entregas, avaliadas),
        })
    resultado = pd.DataFrame(linhas, columns=colunas)
    return resultado.astype({TAXA: "Float64", TEMPO_MEDIO: "Float64"})


# Antiguidade das pendentes ----------------------------------------------------------

def _linha_antiguidade(rotulo: str, grupo: pd.DataFrame) -> dict[str, object]:
    sem_prazo = int((grupo[COL_SITUACAO] == SIT_SEM_PRAZO).sum())
    # Se nenhuma pendente da faixa tem prazo, não se sabe quantas estão atrasadas.
    atrasadas = pd.NA if len(grupo) and sem_prazo == len(grupo) else int((grupo[COL_SITUACAO] == SIT_ATRASADA).sum())
    return {ANTIGUIDADE: rotulo, PENDENTES: len(grupo), DAS_QUAIS_ATRASADAS: atrasadas}


def antiguidade_pendentes(tabela: pd.DataFrame, data_referencia: dt.date) -> pd.DataFrame:
    """Pendentes («Pendente» e «Em trânsito») por dias desde a data da encomenda."""
    base = base_desempenho(tabela)
    pendentes = base[base[C.ESTADO].isin(C.ESTADOS_POR_ENTREGAR)]
    idade = (pd.Timestamp(data_referencia) - pendentes[C.DATA]).dt.days
    linhas = []
    for minimo, maximo, rotulo in FAIXAS_ANTIGUIDADE:
        mascara = idade >= minimo
        if maximo is not None:
            mascara &= idade <= maximo
        linhas.append(_linha_antiguidade(rotulo, pendentes[mascara]))
    if (idade < 0).any():
        linhas.append(_linha_antiguidade(FAIXA_FUTURA, pendentes[idade < 0]))
    return pd.DataFrame(linhas, columns=[ANTIGUIDADE, PENDENTES, DAS_QUAIS_ATRASADAS]).astype(
        {DAS_QUAIS_ATRASADAS: "Int64"})


def entregas_com_atraso(tabela: pd.DataFrame) -> pd.DataFrame:
    """Encomendas sem erros entregues depois do prazo, das mais atrasadas para as menos."""
    base = base_desempenho(tabela)
    return base[base[COL_SITUACAO] == SIT_ENTREGUE_ATRASO].sort_values(
        [COL_DIAS_ATRASO, C.NUMERO], ascending=[False, True], kind="stable")
