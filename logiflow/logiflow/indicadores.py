"""Prazos de entrega e indicadores.

Como se decide se uma encomenda está atrasada:

1. O prazo de cada encomenda é a "Data Prevista" do ficheiro, se existir.
2. Se não existir, e o utilizador tiver definido um prazo padrão (por exemplo,
   3 dias), o prazo é a data da encomenda + esse número de dias.
3. Sem nenhum dos dois, o atraso **não é calculado** — a aplicação mostra
   "não disponível" em vez de inventar um valor.

Uma encomenda pendente (estado "Pendente" ou "Em trânsito") está atrasada
quando a data de referência (normalmente hoje) já passou o prazo. Uma
encomenda que vence hoje ainda está no prazo.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import pandas as pd

from . import campos as C
from .validacao import COL_ESTADO_RECONHECIDO, COL_TEM_ERRO

COL_PRAZO = "prazo"
COL_ORIGEM_PRAZO = "origem_prazo"
COL_SITUACAO = "situacao_prazo"
COL_DIAS_ATRASO = "dias_atraso"

SIT_ATRASADA = "Atrasada"
SIT_NO_PRAZO = "No prazo"
SIT_ENTREGUE_PRAZO = "Entregue no prazo"
SIT_ENTREGUE_ATRASO = "Entregue com atraso"
SIT_ENTREGUE = "Entregue (sem dados de prazo)"
SIT_SEM_PRAZO = "Sem dados de prazo"
SIT_NAO_APLICAVEL = "Não aplicável"

SITUACOES = (SIT_ATRASADA, SIT_NO_PRAZO, SIT_SEM_PRAZO, SIT_ENTREGUE_ATRASO,
             SIT_ENTREGUE_PRAZO, SIT_ENTREGUE, SIT_NAO_APLICAVEL)


def aplicar_prazos(
    tabela: pd.DataFrame,
    data_referencia: dt.date,
    prazo_padrao_dias: int | None = None,
) -> pd.DataFrame:
    """Acrescenta à tabela o prazo, a situação face ao prazo e os dias de atraso."""
    resultado = tabela.copy()
    referencia = pd.Timestamp(data_referencia)

    prazo = resultado[C.DATA_PREVISTA].copy()
    origem = pd.Series("", index=resultado.index, dtype=object)
    origem[prazo.notna()] = "Data prevista"
    if prazo_padrao_dias:
        calculado = resultado[C.DATA] + pd.Timedelta(days=int(prazo_padrao_dias))
        usar_padrao = prazo.isna() & calculado.notna()
        prazo[usar_padrao] = calculado[usar_padrao]
        origem[usar_padrao] = f"Prazo padrão ({int(prazo_padrao_dias)} dias)"

    estado = resultado[C.ESTADO]
    entrega = resultado[C.DATA_ENTREGA]
    por_entregar = estado.isin(C.ESTADOS_POR_ENTREGAR)
    entregue = estado == C.ENTREGUE
    tem_prazo = prazo.notna()

    situacao = pd.Series(SIT_NAO_APLICAVEL, index=resultado.index, dtype=object)
    dias = pd.Series(pd.NA, index=resultado.index, dtype="Int64")

    atrasada = por_entregar & tem_prazo & (referencia > prazo)
    situacao[por_entregar & ~tem_prazo] = SIT_SEM_PRAZO
    situacao[por_entregar & tem_prazo] = SIT_NO_PRAZO
    situacao[atrasada] = SIT_ATRASADA
    dias[atrasada] = (referencia - prazo[atrasada]).dt.days

    entregue_avaliavel = entregue & tem_prazo & entrega.notna()
    entregue_tarde = entregue_avaliavel & (entrega > prazo)
    situacao[entregue] = SIT_ENTREGUE
    situacao[entregue_avaliavel] = SIT_ENTREGUE_PRAZO
    situacao[entregue_tarde] = SIT_ENTREGUE_ATRASO
    dias[entregue_tarde] = (entrega[entregue_tarde] - prazo[entregue_tarde]).dt.days

    resultado[COL_PRAZO] = prazo
    resultado[COL_ORIGEM_PRAZO] = origem
    resultado[COL_SITUACAO] = situacao
    resultado[COL_DIAS_ATRASO] = dias
    return resultado


@dataclass(frozen=True)
class Indicadores:
    total: int
    entregues: int
    pendentes: int                    # "Pendente" + "Em trânsito"
    atrasadas: int | None             # None = não é possível determinar
    pendentes_sem_prazo: int
    entregues_com_atraso: int
    canceladas: int
    devolvidas: int
    estado_nao_reconhecido: int
    sem_estado: int
    com_erros: int
    por_estado: dict[str, int]

    @property
    def taxa_entrega(self) -> float | None:
        return self.entregues / self.total if self.total else None


def calcular_indicadores(tabela: pd.DataFrame) -> Indicadores:
    """Calcula os indicadores de uma tabela já passada por ``aplicar_prazos``."""
    estado = tabela[C.ESTADO]
    situacao = tabela[COL_SITUACAO]
    pendentes = int(estado.isin(C.ESTADOS_POR_ENTREGAR).sum())
    sem_prazo = int((situacao == SIT_SEM_PRAZO).sum())

    if pendentes == 0:
        atrasadas: int | None = 0
    elif sem_prazo == pendentes:
        atrasadas = None
    else:
        atrasadas = int((situacao == SIT_ATRASADA).sum())

    contagem = estado.replace("", "(sem estado)").value_counts()
    por_estado = {e: int(contagem.get(e, 0)) for e in C.ESTADOS_CANONICOS}
    for e, n in contagem.items():
        if e not in por_estado:
            por_estado[str(e)] = int(n)

    return Indicadores(
        total=len(tabela),
        entregues=int((estado == C.ENTREGUE).sum()),
        pendentes=pendentes,
        atrasadas=atrasadas,
        pendentes_sem_prazo=sem_prazo,
        entregues_com_atraso=int((situacao == SIT_ENTREGUE_ATRASO).sum()),
        canceladas=int((estado == C.CANCELADA).sum()),
        devolvidas=int((estado == C.DEVOLVIDA).sum()),
        estado_nao_reconhecido=int(((estado != "") & ~tabela[COL_ESTADO_RECONHECIDO]).sum()),
        sem_estado=int((estado == "").sum()),
        com_erros=int(tabela[COL_TEM_ERRO].sum()),
        por_estado=por_estado,
    )
