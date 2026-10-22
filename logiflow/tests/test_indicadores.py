"""Testes dos prazos, atrasos e indicadores."""

from __future__ import annotations

import datetime as dt

from logiflow.indicadores import (
    COL_DIAS_ATRASO,
    COL_SITUACAO,
    SIT_ATRASADA,
    SIT_ENTREGUE,
    SIT_ENTREGUE_ATRASO,
    SIT_ENTREGUE_PRAZO,
    SIT_NAO_APLICAVEL,
    SIT_NO_PRAZO,
    SIT_SEM_PRAZO,
)

from .conftest import CABECALHO, csv_bytes, processar

COM_PREVISTA = CABECALHO + ";Data Prevista;Data de Entrega"


def _situacoes(tabela):
    return dict(zip(tabela["numero_encomenda"], tabela[COL_SITUACAO]))


def test_contagens_basicas():
    _, _, _, ind = processar(csv_bytes(
        CABECALHO,
        "E1;A;01/10/2026;Porto;Entregue",
        "E2;A;01/10/2026;Porto;Entregue",
        "E3;A;01/10/2026;Porto;Pendente",
        "E4;A;01/10/2026;Porto;Em trânsito",
        "E5;A;01/10/2026;Porto;Cancelada",
        "E6;A;01/10/2026;Porto;Devolvida",
        "E7;A;01/10/2026;Porto;",
    ))
    assert (ind.total, ind.entregues, ind.pendentes, ind.canceladas, ind.devolvidas, ind.sem_estado) == (7, 2, 2, 1, 1, 1)
    assert ind.com_erros == 1  # estado vazio
    assert ind.por_estado["Entregue"] == 2 and ind.por_estado["(sem estado)"] == 1


def test_atrasos_com_data_prevista(referencia):
    # referência: 20/10/2026
    _, _, tabela, ind = processar(csv_bytes(
        COM_PREVISTA,
        "E1;A;10/10/2026;Porto;Pendente;15/10/2026;",      # passou o prazo há 5 dias
        "E2;A;10/10/2026;Porto;Em trânsito;20/10/2026;",   # vence hoje: ainda no prazo
        "E3;A;10/10/2026;Porto;Pendente;25/10/2026;",
        "E4;A;10/10/2026;Porto;Cancelada;12/10/2026;",     # cancelada nunca está atrasada
    ), referencia=referencia)
    assert _situacoes(tabela) == {"E1": SIT_ATRASADA, "E2": SIT_NO_PRAZO, "E3": SIT_NO_PRAZO, "E4": SIT_NAO_APLICAVEL}
    assert tabela.set_index("numero_encomenda").loc["E1", COL_DIAS_ATRASO] == 5
    assert ind.atrasadas == 1


def test_entregas_no_prazo_e_com_atraso():
    _, _, tabela, ind = processar(csv_bytes(
        COM_PREVISTA,
        "E1;A;01/10/2026;Porto;Entregue;05/10/2026;05/10/2026",
        "E2;A;01/10/2026;Porto;Entregue;05/10/2026;08/10/2026",
        "E3;A;01/10/2026;Porto;Entregue;05/10/2026;",          # sem data de entrega: não se avalia
    ))
    assert _situacoes(tabela) == {"E1": SIT_ENTREGUE_PRAZO, "E2": SIT_ENTREGUE_ATRASO, "E3": SIT_ENTREGUE}
    assert tabela.set_index("numero_encomenda").loc["E2", COL_DIAS_ATRASO] == 3
    assert ind.entregues_com_atraso == 1 and ind.entregues == 3


def test_sem_datas_de_prazo_atrasos_nao_disponiveis():
    _, _, tabela, ind = processar(csv_bytes(CABECALHO, "E1;A;01/01/2026;Porto;Pendente"))
    assert ind.atrasadas is None  # não se inventa um valor
    assert _situacoes(tabela) == {"E1": SIT_SEM_PRAZO}


def test_prazo_padrao(referencia):
    _, _, tabela, ind = processar(csv_bytes(
        CABECALHO,
        "E1;A;10/10/2026;Porto;Pendente",   # prazo 13/10 -> atrasada 7 dias
        "E2;A;18/10/2026;Porto;Pendente",   # prazo 21/10 -> no prazo
    ), referencia=referencia, prazo_padrao=3)
    assert _situacoes(tabela) == {"E1": SIT_ATRASADA, "E2": SIT_NO_PRAZO}
    assert ind.atrasadas == 1
    assert tabela.iloc[0]["origem_prazo"] == "Prazo padrão (3 dias)"
    assert tabela.iloc[0][COL_DIAS_ATRASO] == 7


def test_prazo_padrao_so_se_aplica_sem_data_prevista(referencia):
    _, _, tabela, _ = processar(csv_bytes(
        COM_PREVISTA,
        "E1;A;10/10/2026;Porto;Pendente;30/10/2026;",  # tem data prevista: prevalece
        "E2;A;10/10/2026;Porto;Pendente;;",            # sem data prevista: usa o prazo padrão
    ), referencia=referencia, prazo_padrao=2)
    assert list(tabela["origem_prazo"]) == ["Data prevista", "Prazo padrão (2 dias)"]
    assert _situacoes(tabela) == {"E1": SIT_NO_PRAZO, "E2": SIT_ATRASADA}


def test_atrasos_parciais_indicam_pendentes_sem_prazo():
    _, _, _, ind = processar(csv_bytes(
        COM_PREVISTA,
        "E1;A;01/10/2026;Porto;Pendente;05/10/2026;",
        "E2;A;01/10/2026;Porto;Pendente;;",
    ))
    assert ind.atrasadas == 1 and ind.pendentes_sem_prazo == 1


def test_sem_pendentes_nao_ha_atrasadas():
    _, _, _, ind = processar(csv_bytes(CABECALHO, "E1;A;01/10/2026;Porto;Entregue"))
    assert ind.atrasadas == 0


def test_data_de_referencia_altera_os_atrasos():
    conteudo = csv_bytes(COM_PREVISTA, "E1;A;01/10/2026;Porto;Pendente;10/10/2026;")
    assert processar(conteudo, referencia=dt.date(2026, 10, 10))[3].atrasadas == 0
    assert processar(conteudo, referencia=dt.date(2026, 10, 11))[3].atrasadas == 1
