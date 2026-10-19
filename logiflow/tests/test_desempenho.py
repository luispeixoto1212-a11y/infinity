"""Testes do desempenho operacional (taxa no prazo, tempos, comparações)."""

from __future__ import annotations

import datetime as dt

import pandas as pd
import pytest

from logiflow import campos as C
from logiflow import desempenho as D

from .conftest import CABECALHO, csv_bytes, processar

COMPLETO = CABECALHO + ";Data Prevista;Data de Entrega"


def _tabela(*linhas: str, prazo_padrao: int | None = None, referencia: dt.date = dt.date(2026, 10, 20)):
    return processar(csv_bytes(COMPLETO, *linhas), referencia=referencia, prazo_padrao=prazo_padrao)[2]


# Resumo ---------------------------------------------------------------------------

def test_taxa_no_prazo_e_denominadores():
    tabela = _tabela(
        "E1;A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",   # no prazo (3 dias)
        "E2;A;01/10/2026;Porto;Entregue;05/10/2026;05/10/2026",   # no prazo, no próprio dia (4 dias)
        "E3;B;01/10/2026;Braga;Entregue;05/10/2026;08/10/2026",   # 3 dias de atraso (7 dias)
        "E4;B;01/10/2026;Braga;Entregue;;06/10/2026",             # sem prazo: não avaliada (5 dias)
        "E5;B;01/10/2026;Braga;Pendente;05/10/2026;",             # pendente atrasada
    )
    r = D.resumir(tabela)
    assert (r.base, r.entregues, r.avaliadas, r.no_prazo, r.com_atraso) == (5, 4, 3, 2, 1)
    assert r.taxa_no_prazo == pytest.approx(2 / 3)
    assert r.atraso_medio_dias == 3
    assert r.com_tempo == 4
    assert r.tempo_medio_dias == pytest.approx((3 + 4 + 7 + 5) / 4)
    assert r.tempo_mediano_dias == pytest.approx(4.5)
    assert (r.pendentes, r.atrasadas) == (1, 1)
    assert r.amostra_pequena  # só 3 entregas avaliadas
    assert (r.data_inicio, r.data_fim) == (dt.date(2026, 10, 1), dt.date(2026, 10, 1))


def test_sem_entregas_avaliadas_a_taxa_nao_existe():
    """Sem data de entrega nem prazo, não se inventa uma taxa (nem 0 % nem 100 %)."""
    r = D.resumir(processar(csv_bytes(CABECALHO, "E1;A;01/10/2026;Porto;Entregue"))[2])
    assert r.entregues == 1 and r.avaliadas == 0
    assert r.taxa_no_prazo is None and r.tempo_medio_dias is None and r.atraso_medio_dias is None
    assert not r.amostra_pequena
    assert r.entregues_sem_data == 1


def test_linhas_com_erros_ficam_de_fora():
    tabela = _tabela(
        "E1;A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",
        "E2;A;01/10/2026;Porto;Entregue;05/10/2026;09/10/2026",
        "E2;A;01/10/2026;Porto;Entregue;05/10/2026;09/10/2026",   # duplicado: as duas ocorrências saem
        "E4;;01/10/2026;Porto;Entregue;05/10/2026;09/10/2026",    # cliente vazio: erro
    )
    r = D.resumir(tabela)
    assert (r.base, r.excluidas_com_erros, r.avaliadas, r.taxa_no_prazo) == (1, 3, 1, 1.0)


def test_entrega_anterior_a_encomenda_fica_fora_das_medias():
    tabela = _tabela(
        "E1;A;10/10/2026;Porto;Entregue;12/10/2026;08/10/2026",   # incoerente (aviso, não erro)
        "E2;A;10/10/2026;Porto;Entregue;12/10/2026;12/10/2026",
    )
    r = D.resumir(tabela)
    assert r.incoerentes == 1 and r.com_tempo == 1 and r.tempo_medio_dias == 2


def test_prazo_padrao_tambem_conta_para_a_taxa():
    tabela = _tabela("E1;A;01/10/2026;Porto;Entregue;;03/10/2026",
                     "E2;A;01/10/2026;Porto;Entregue;;06/10/2026", prazo_padrao=3)
    r = D.resumir(tabela)
    assert (r.avaliadas, r.no_prazo, r.com_atraso) == (2, 1, 1)


def test_tabela_vazia():
    tabela = _tabela("E1;A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026").iloc[0:0]
    r = D.resumir(tabela)
    assert r.base == 0 and r.taxa_no_prazo is None and r.data_inicio is None
    assert D.por_grupo(tabela, C.CLIENTE).empty and D.por_periodo(tabela).empty


# Por cliente e destino ------------------------------------------------------------------

def test_por_cliente_agrupa_variacoes_de_escrita():
    tabela = _tabela(
        "E1;Loja Ávila, Lda.;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",
        "E2;LOJA AVILA LDA;01/10/2026;Porto;Entregue;05/10/2026;07/10/2026",
        "E3;Loja Ávila, Lda.;01/10/2026;Porto;Pendente;05/10/2026;",
        "E4;Café Sol;01/10/2026;Faro;Entregue;05/10/2026;05/10/2026",
    )
    grupos = D.por_grupo(tabela, C.CLIENTE).set_index("Cliente")
    assert list(grupos.index) == ["Loja Ávila, Lda.", "Café Sol"]  # mais encomendas primeiro; grafia mais frequente
    avila = grupos.loc["Loja Ávila, Lda."]
    assert (avila[D.ENCOMENDAS], avila[D.ENTREGUES], avila[D.PENDENTES], avila[D.ATRASADAS]) == (3, 2, 1, 1)
    assert (avila[D.AVALIADAS], avila[D.NO_PRAZO], avila[D.TAXA]) == (2, 1, 0.5)
    assert avila[D.TEMPO_MEDIO] == pytest.approx(4.5)
    assert avila[D.OBSERVACAO] == D.OBS_POUCAS


def test_por_cliente_sem_amostra_pequena_e_sem_avaliadas():
    linhas = [f"E{i};A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026" for i in range(5)]
    linhas.append("X1;B;01/10/2026;Porto;Entregue;;")
    grupos = D.por_grupo(_tabela(*linhas), C.CLIENTE).set_index("Cliente")
    assert grupos.loc["A", D.OBSERVACAO] == "" and grupos.loc["A", D.TAXA] == 1.0
    assert grupos.loc["B", D.OBSERVACAO] == D.OBS_SEM_AVALIADAS and pd.isna(grupos.loc["B", D.TAXA])


def test_pendentes_sem_prazo_nao_contam_como_nao_atrasadas():
    """Sem prazo não se sabe se estão atrasadas: fica vazio, não 0."""
    grupos = D.por_grupo(processar(csv_bytes(CABECALHO, "E1;A;01/10/2026;Porto;Pendente"))[2], C.CLIENTE)
    assert grupos.loc[0, D.PENDENTES] == 1 and pd.isna(grupos.loc[0, D.ATRASADAS])


def test_por_destino():
    tabela = _tabela("E1;A;01/10/2026;Évora;Entregue;05/10/2026;04/10/2026",
                     "E2;B;01/10/2026;evora;Entregue;05/10/2026;08/10/2026",
                     "E3;B;01/10/2026;Faro;Entregue;05/10/2026;05/10/2026")
    grupos = D.por_grupo(tabela, C.DESTINO).set_index("Destino")
    assert grupos.loc["Évora", D.ENCOMENDAS] == 2 and grupos.loc["Évora", D.TAXA] == 0.5


def test_lista_e_filtro_de_clientes():
    tabela = _tabela("E1;Loja Ávila;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",
                     "E2;loja avila;01/10/2026;Porto;Pendente;05/10/2026;",
                     "E3;Café Sol;01/10/2026;Faro;Entregue;05/10/2026;05/10/2026",
                     "E4;Erro Lda;31/02/2026;Faro;Entregue;05/10/2026;05/10/2026")  # só em linhas com erro
    assert D.clientes(tabela) == ["Café Sol", "Loja Ávila"]
    assert list(D.filtrar_cliente(tabela, "LOJA ÁVILA")[C.NUMERO]) == ["E1", "E2"]


# Por período ------------------------------------------------------------------------------

def test_por_semana_usa_segunda_a_domingo():
    tabela = _tabela(
        "E1;A;05/10/2026;Porto;Entregue;08/10/2026;07/10/2026",   # registada e entregue na semana de 05/10
        "E2;A;11/10/2026;Porto;Entregue;13/10/2026;14/10/2026",   # domingo 11/10; entregue na semana seguinte, com atraso
        "E3;A;12/10/2026;Porto;Entregue;;13/10/2026",             # entregue sem prazo: conta como entrega, não avaliada
    )
    semanas = D.por_periodo(tabela, D.SEMANA)
    assert list(semanas[D.PERIODO]) == ["05/10 a 11/10/2026", "12/10 a 18/10/2026"]
    assert list(semanas[D.REGISTADAS]) == [2, 1]
    assert list(semanas[D.ENTREGAS]) == [1, 2]
    assert list(semanas[D.AVALIADAS]) == [1, 1]
    assert list(semanas[D.NO_PRAZO]) == [1, 0]
    assert list(semanas[D.TAXA]) == [1.0, 0.0]


def test_por_mes_com_nomes_em_portugues():
    tabela = _tabela("E1;A;30/09/2026;Porto;Entregue;03/10/2026;02/10/2026",
                     "E2;A;15/12/2026;Porto;Pendente;20/12/2026;", referencia=dt.date(2026, 12, 31))
    meses = D.por_periodo(tabela, D.MES)
    assert list(meses[D.PERIODO]) == ["setembro de 2026", "outubro de 2026", "dezembro de 2026"]
    assert list(meses[D.REGISTADAS]) == [1, 0, 1] and list(meses[D.ENTREGAS]) == [0, 1, 0]
    assert pd.isna(meses.loc[0, D.TAXA])


def test_periodo_invalido():
    with pytest.raises(ValueError):
        D.por_periodo(_tabela("E1;A;01/10/2026;Porto;Pendente;;"), "Ano")


# Antiguidade das pendentes e entregas com atraso -------------------------------------------

def test_antiguidade_das_pendentes():
    tabela = _tabela(
        "E1;A;19/10/2026;Porto;Pendente;25/10/2026;",      # 1 dia
        "E2;A;16/10/2026;Porto;Em trânsito;18/10/2026;",   # 4 dias, atrasada
        "E3;A;01/10/2026;Porto;Pendente;05/10/2026;",      # 19 dias, atrasada
        "E4;A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",  # entregue: não conta
    )
    faixas = D.antiguidade_pendentes(tabela, dt.date(2026, 10, 20)).set_index(D.ANTIGUIDADE)
    assert list(faixas.index) == ["Até 2 dias", "3 a 5 dias", "6 a 10 dias", "Mais de 10 dias"]
    assert list(faixas[D.PENDENTES]) == [1, 1, 0, 1]
    assert list(faixas[D.DAS_QUAIS_ATRASADAS]) == [0, 1, 0, 1]


def test_antiguidade_sem_prazo_e_data_futura():
    tabela = processar(csv_bytes(CABECALHO, "E1;A;01/10/2026;Porto;Pendente",
                                 "E2;A;25/10/2026;Porto;Pendente"))[2]
    faixas = D.antiguidade_pendentes(tabela, dt.date(2026, 10, 20)).set_index(D.ANTIGUIDADE)
    assert pd.isna(faixas.loc["Mais de 10 dias", D.DAS_QUAIS_ATRASADAS])  # sem prazo: desconhecido
    assert faixas.loc[D.FAIXA_FUTURA, D.PENDENTES] == 1


def test_entregas_com_atraso_ordenadas():
    tabela = _tabela("E1;A;01/10/2026;Porto;Entregue;03/10/2026;04/10/2026",
                     "E2;A;01/10/2026;Porto;Entregue;03/10/2026;08/10/2026",
                     "E3;A;01/10/2026;Porto;Entregue;03/10/2026;03/10/2026")
    atrasos = D.entregas_com_atraso(tabela)
    assert list(atrasos[C.NUMERO]) == ["E2", "E1"] and list(atrasos["dias_atraso"]) == [5, 1]
