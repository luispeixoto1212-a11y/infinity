"""Testes do painel de exceções (lógica, sem interface)."""

from __future__ import annotations

import datetime as dt

import pandas as pd
import pytest

from logiflow import excecoes as E
from logiflow.indicadores import calcular_indicadores

from .conftest import CABECALHO, csv_bytes, processar

REF = dt.date(2026, 10, 20)  # terça-feira
COMPLETO = CABECALHO + ";Data Prevista;Data de Entrega"


def _excecoes(*linhas: str, cabecalho: str = COMPLETO, prazo_padrao: int | None = None, referencia=REF):
    _, resultado, tabela, _ = processar(csv_bytes(cabecalho, *linhas), referencia=referencia,
                                        prazo_padrao=prazo_padrao)
    return E.identificar_excecoes(tabela, resultado.problemas, referencia)


def _por_numero(excecoes: pd.DataFrame) -> dict[str, pd.Series]:
    return {r[E.NUMERO]: r for _, r in excecoes.iterrows()}


# 1. Atrasadas -------------------------------------------------------------------

def test_atrasadas_com_prazo_ultrapassado():
    x = _por_numero(_excecoes(
        "E1;A;16/10/2026;Porto;Pendente;17/10/2026;",        # 3 dias de atraso (4 dias por entregar)
        "E2;A;16/10/2026;Porto;Em trânsito;19/10/2026;",     # 1 dia de atraso
        "E3;A;15/10/2026;Porto;Entregue;17/10/2026;18/10/2026",   # entregue: não é exceção
        "E4;A;15/10/2026;Porto;Cancelada;17/10/2026;",       # cancelada: não é exceção
    ))
    assert set(x) == {"E1", "E2"}
    assert x["E1"][E.CATEGORIAS_COL] == E.CAT_ATRASADA and x["E1"][E.PRIORIDADE] == E.ALTA
    assert x["E1"][E.DIAS_ATRASO] == 3 and x["E2"][E.DIAS_ATRASO] == 1
    assert x["E1"][E.MOTIVOS] == "Atrasada há 3 dias (data prevista 17/10/2026)"


def test_atrasadas_coincidem_com_o_indicador_do_topo():
    linhas = ["E1;A;15/10/2026;Porto;Pendente;17/10/2026;", "E2;A;15/10/2026;Porto;Pendente;30/10/2026;",
              "E3;A;10/10/2026;Porto;Em trânsito;12/10/2026;"]
    _, resultado, tabela, ind = processar(csv_bytes(COMPLETO, *linhas), referencia=REF)
    x = E.identificar_excecoes(tabela, resultado.problemas, REF)
    assert E.contagens(x)["por_categoria"][E.CAT_ATRASADA] == ind.atrasadas == 2


def test_prazo_padrao_aparece_como_calculado_e_nao_como_facto():
    x = _por_numero(_excecoes("E1;A;10/10/2026;Porto;Pendente", cabecalho=CABECALHO, prazo_padrao=3))
    assert x["E1"][E.ORIGEM_PRAZO] == "Prazo padrão (3 dias)"
    assert "prazo calculado 13/10/2026, prazo padrão (3 dias)" in x["E1"][E.MOTIVOS]


# 2. Prazo próximo (48 horas) ------------------------------------------------------------

@pytest.mark.parametrize("prazo, esperado", [
    ("19/10/2026", E.CAT_ATRASADA),        # ontem: atrasada, não «próximo»
    ("20/10/2026", E.CAT_PRAZO_PROXIMO),   # hoje
    ("21/10/2026", E.CAT_PRAZO_PROXIMO),   # amanhã
    ("22/10/2026", None),                  # depois de amanhã: fora da janela
])
def test_janela_de_48_horas(prazo, esperado):
    x = _excecoes(f"E1;A;18/10/2026;Porto;Pendente;{prazo};")
    if esperado is None:
        assert x.empty
    else:
        assert x.loc[0, E.CATEGORIAS_COL] == esperado


def test_prazo_proximo_tem_prioridade_media_e_diz_quando():
    x = _por_numero(_excecoes("E1;A;18/10/2026;Porto;Em trânsito;20/10/2026;",
                              "E2;A;18/10/2026;Porto;Pendente;21/10/2026;"))
    assert x["E1"][E.PRIORIDADE] == x["E2"][E.PRIORIDADE] == E.MEDIA
    assert x["E1"][E.MOTIVOS].startswith("Prazo termina hoje")
    assert x["E2"][E.MOTIVOS].startswith("Prazo termina amanhã")


def test_entregue_ou_cancelada_com_prazo_proximo_nao_e_excecao():
    assert _excecoes("E1;A;18/10/2026;Porto;Entregue;20/10/2026;19/10/2026",
                     "E2;A;18/10/2026;Porto;Cancelada;21/10/2026;").empty


# 3. Datas ausentes ou inválidas ----------------------------------------------------------

def test_sem_prazo_nao_se_conclui_atraso_nem_prazo_proximo():
    x = _excecoes("E1;A;18/10/2026;Porto;Pendente", cabecalho=CABECALHO)
    assert x.empty  # 2 dias por entregar, sem prazo: nada a assinalar


def test_data_prevista_invalida_fica_como_dado_invalido_e_nao_como_atraso():
    x = _por_numero(_excecoes("E1;A;18/10/2026;Porto;Pendente;brevemente;"))
    assert x["E1"][E.CATEGORIAS_COL] == E.CAT_DADOS
    assert x["E1"][E.PRIORIDADE] == E.BAIXA
    assert pd.isna(x["E1"][E.PRAZO]) and x["E1"][E.ORIGEM_PRAZO] == ""
    assert "Data Prevista inválida" in x["E1"][E.MOTIVOS]


def test_data_da_encomenda_invalida_impede_calcular_a_pendencia_mas_o_erro_continua_visivel():
    x = _por_numero(_excecoes("E1;A;31/02/2026;Porto;Pendente;;", prazo_padrao=3))
    assert x["E1"][E.CATEGORIAS_COL] == E.CAT_DADOS
    assert pd.isna(x["E1"][E.DIAS_POR_ENTREGAR]) and pd.isna(x["E1"][E.PRAZO])
    assert "Data inválida" in x["E1"][E.MOTIVOS]


def test_campos_vazios_aparecem_como_dados_incompletos():
    x = _por_numero(_excecoes("E1;;18/10/2026;Porto;Pendente;30/10/2026;",
                              "E2;B;18/10/2026;;Pendente;30/10/2026;"))
    assert x["E1"][E.MOTIVOS] == "Cliente está vazio" and x["E2"][E.MOTIVOS] == "Destino está vazio"


def test_estado_desconhecido_nao_e_tratado_como_por_entregar():
    """«A confirmar» não diz se foi entregue: não se calculam atraso nem pendência."""
    assert _excecoes("E1;A;01/10/2026;Porto;A confirmar;05/10/2026;").empty


# 4. Vários motivos sem linhas duplicadas ----------------------------------------------------

def test_varios_motivos_numa_so_linha_com_a_prioridade_mais_alta():
    x = _excecoes(
        "E1;A;01/10/2026;Porto;Pendente;05/10/2026;",
        "E1;B;02/10/2026;Braga;Pendente;30/10/2026;",
    )
    assert len(x) == 2  # duas linhas do ficheiro, uma linha de painel cada
    primeira = x[x[E.LINHA] == 2].iloc[0]
    assert primeira[E.CATEGORIAS_COL] == " · ".join([E.CAT_ATRASADA, E.CAT_PENDENCIA, E.CAT_DUPLICADO])
    assert primeira[E.PRIORIDADE] == E.ALTA
    motivos = primeira[E.MOTIVOS]
    assert "Atrasada há 15 dias" in motivos and "Por entregar há 19 dias" in motivos and "repetido 2 vezes" in motivos
    segunda = x[x[E.LINHA] == 3].iloc[0]
    assert segunda[E.PRIORIDADE] == E.MEDIA  # pendente há 18 dias + duplicado; prazo ainda não passou
    assert list(x[E.LINHA]).count(2) == 1


def test_avisos_de_validacao_ficam_visiveis_sem_mudar_a_prioridade():
    x = _por_numero(_excecoes("E1;A;10/10/2026;Porto;Em trânsito;12/10/2026;14/10/2026"))
    assert x["E1"][E.PRIORIDADE] == E.ALTA
    assert "não é contada como entregue" in x["E1"][E.AVISOS]


# 5. Antiguidade só com data fiável -------------------------------------------------------------

@pytest.mark.parametrize("data, dias, pendencia", [
    ("15/10/2026", 5, True),    # exatamente 5 dias
    ("16/10/2026", 4, False),   # 4 dias: ainda não
    ("01/10/2026", 19, True),
])
def test_pendencia_a_partir_de_5_dias(data, dias, pendencia):
    x = _excecoes(f"E1;A;{data};Porto;Pendente", cabecalho=CABECALHO)
    if pendencia:
        assert x.loc[0, E.CATEGORIAS_COL] == E.CAT_PENDENCIA and x.loc[0, E.DIAS_POR_ENTREGAR] == dias
        assert x.loc[0, E.PRIORIDADE] == E.MEDIA
    else:
        assert x.empty


def test_data_da_encomenda_no_futuro_nao_gera_antiguidade():
    x = _excecoes("E1;A;25/10/2026;Porto;Pendente;21/10/2026;")
    linha = x.iloc[0]
    assert linha[E.CATEGORIAS_COL] == E.CAT_PRAZO_PROXIMO  # o prazo é conhecido e vence amanhã
    assert pd.isna(linha[E.DIAS_POR_ENTREGAR])


def test_entregues_nao_tem_dias_por_entregar():
    x = _excecoes("E1;A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",
                  "E1;A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026")  # duplicado: entra no painel
    assert set(x[E.CATEGORIAS_COL]) == {E.CAT_DUPLICADO} and x[E.DIAS_POR_ENTREGAR].isna().all()


# 6. Ordenação ---------------------------------------------------------------------------

def test_ordenacao_por_prioridade_e_antiguidade():
    x = _excecoes(
        ";A;18/10/2026;Porto;Entregue;;",                    # Baixa (cliente vazio... n.º vazio)
        "M1;A;18/10/2026;Porto;Pendente;20/10/2026;",        # Média (vence hoje)
        "A1;A;15/10/2026;Porto;Pendente;19/10/2026;",        # Alta, 1 dia de atraso
        "A2;A;12/10/2026;Porto;Pendente;14/10/2026;",        # Alta, 6 dias de atraso
        "M2;A;01/10/2026;Porto;Pendente;30/10/2026;",        # Média, 19 dias por entregar
    )
    assert list(x[E.NUMERO]) == ["A2", "A1", "M2", "M1", ""]
    assert list(x[E.PRIORIDADE]) == [E.ALTA, E.ALTA, E.MEDIA, E.MEDIA, E.BAIXA]
    antiguidade = E.ordenar(x, E.ORDENAR_ANTIGUIDADE)
    assert list(antiguidade[E.NUMERO]) == ["M2", "A2", "A1", "M1", ""]
    with pytest.raises(ValueError):
        E.ordenar(x, "Alfabética")


# 7. Pesquisa e filtros ---------------------------------------------------------------------

def _amostra():
    return _excecoes(
        "ENC-1;Loja Ávila;12/10/2026;Porto;Pendente;14/10/2026;",    # Alta
        "ENC-2;loja avila;18/10/2026;Porto;Pendente;21/10/2026;",    # Média
        "ENC-3;Café Sol;18/10/2026;Faro;Pendente;brevemente;",       # Baixa (dados)
        "ENC-4;Café Sol;10/10/2026;Faro;Pendente;30/10/2026;",       # Média (pendência)
    )


def test_pesquisa_por_numero_ou_cliente_sem_acentos():
    x = _amostra()
    assert list(E.filtrar(x, pesquisa="enc-3")[E.NUMERO]) == ["ENC-3"]
    assert set(E.filtrar(x, pesquisa="AVILA")[E.NUMERO]) == {"ENC-1", "ENC-2"}
    assert E.filtrar(x, pesquisa="Faro").empty  # o destino não entra na pesquisa
    # Texto simples, sem expressões regulares: só pontuação não filtra nem dá erro.
    assert len(E.filtrar(x, pesquisa="([*")) == len(x)


def test_combinacao_de_filtros():
    x = _amostra()
    assert set(E.filtrar(x, categorias=[E.CAT_PENDENCIA, E.CAT_DADOS])[E.NUMERO]) == {"ENC-1", "ENC-3", "ENC-4"}
    assert set(E.filtrar(x, prioridades=[E.MEDIA])[E.NUMERO]) == {"ENC-2", "ENC-4"}
    assert set(E.filtrar(x, cliente="LOJA ÁVILA")[E.NUMERO]) == {"ENC-1", "ENC-2"}
    combinado = E.filtrar(x, pesquisa="enc", categorias=[E.CAT_PENDENCIA], prioridades=[E.MEDIA], cliente="Café Sol")
    assert list(combinado[E.NUMERO]) == ["ENC-4"]
    assert len(x) == 4  # os filtros não alteram a tabela original


def test_lista_de_clientes_com_excecoes():
    assert E.clientes(_amostra()) == ["Café Sol", "Loja Ávila"]


def test_contagens_por_categoria_nao_se_somam():
    x = _excecoes("E1;A;01/10/2026;Porto;Pendente;05/10/2026;")  # atrasada e pendente há demasiado tempo
    totais = E.contagens(x)
    assert totais["encomendas"] == 1
    assert totais["por_categoria"][E.CAT_ATRASADA] == totais["por_categoria"][E.CAT_PENDENCIA] == 1
    assert sum(totais["por_categoria"].values()) == 2 and totais["por_prioridade"][E.ALTA] == 1


# 8. Filtros globais (tabela já filtrada) ---------------------------------------------------------

def test_so_considera_as_linhas_da_tabela_recebida():
    _, resultado, tabela, _ = processar(csv_bytes(
        COMPLETO,
        "E1;A;01/10/2026;Porto;Pendente;05/10/2026;",
        "E2;;01/10/2026;Braga;Pendente;30/10/2026;",   # erro de dados noutra linha
    ), referencia=REF)
    so_porto = tabela[tabela["destino"] == "Porto"]   # como faz o filtro global
    x = E.identificar_excecoes(so_porto, resultado.problemas, REF)
    assert list(x[E.NUMERO]) == ["E1"]


# 12. Sem exceções -----------------------------------------------------------------------------

def test_sem_excecoes_devolve_tabela_vazia_com_as_colunas():
    x = _excecoes("E1;A;18/10/2026;Porto;Entregue;20/10/2026;19/10/2026",
                  "E2;A;19/10/2026;Porto;Pendente;30/10/2026;")
    assert x.empty and list(E.visiveis(x).columns) == E.COLUNAS
    assert E.contagens(x)["encomendas"] == 0 and E.clientes(x) == []
    assert E.filtrar(x, pesquisa="x", categorias=[E.CAT_ATRASADA]).empty


def test_tabela_vazia_apos_filtros_globais():
    _, resultado, tabela, _ = processar(csv_bytes(COMPLETO, "E1;A;01/10/2026;Porto;Pendente;05/10/2026;"))
    assert E.identificar_excecoes(tabela.iloc[0:0], resultado.problemas, REF).empty


# 13. Compatibilidade: nada é alterado ------------------------------------------------------------

def test_nao_altera_a_tabela_nem_os_problemas_nem_os_indicadores():
    _, resultado, tabela, ind = processar(csv_bytes(
        COMPLETO, "E1;A;01/10/2026;Porto;Pendente;05/10/2026;", "E1;;31/02/2026;Porto;Pendente;;"))
    tabela_antes, problemas_antes = tabela.copy(), resultado.problemas.copy()
    E.identificar_excecoes(tabela, resultado.problemas, REF)
    pd.testing.assert_frame_equal(tabela, tabela_antes)
    pd.testing.assert_frame_equal(resultado.problemas, problemas_antes)
    assert calcular_indicadores(tabela) == ind


def test_todas_as_linhas_com_erros_aparecem_no_painel():
    _, resultado, tabela, _ = processar(csv_bytes(
        COMPLETO,
        "E1;;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",
        "E2;A;31/02/2026;Porto;Entregue;05/10/2026;04/10/2026",
        "E3;A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",
        "E3;A;01/10/2026;Porto;Entregue;05/10/2026;04/10/2026",
        "E5;A;01/10/2026;Porto;;05/10/2026;04/10/2026",
    ))
    x = E.identificar_excecoes(tabela, resultado.problemas, REF)
    assert set(x[E.LINHA]) == set(tabela.loc[tabela["tem_erro"], "linha"]) == {2, 3, 4, 5, 6}
