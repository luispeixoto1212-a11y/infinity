"""Testes da comparação entre importações (versão 1.3): categorias, chaves repetidas ou
em falta, normalização e ausência de conclusões inventadas."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd
import pytest

from logiflow import comparacao as K
from logiflow import historico as H
from logiflow.exemplo import FICHEIRO_EXEMPLO_DIA2_XLSX, FICHEIRO_EXEMPLO_XLSX
from logiflow.importacao import ErroImportacao

from .conftest import CABECALHO, csv_bytes, guardar, xlsx_bytes

CAB = CABECALHO + ";Data Entrega"


def _comparar(base_dados, anterior: bytes, atual: bytes, nome_a="a.csv", nome_b="b.csv"):
    a = guardar(base_dados, anterior, nome_a)
    b = guardar(base_dados, atual, nome_b)
    assert a.situacao == b.situacao == H.GUARDADA
    return K.comparar_importacoes(base_dados, a.importacao_id, b.importacao_id)


def _situacoes(resultado) -> dict[str, str]:
    return dict(zip(resultado.tabela["N.º Encomenda"], resultado.tabela["Situação"]))


# 8. Novas, alteradas, sem alterações e não encontradas ---------------------------------------------

def test_quatro_categorias(base_dados):
    anterior = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;", "A2;Dois;02/10/2026;Faro;Pendente;",
                         "A3;Três;03/10/2026;Braga;Em trânsito;")
    atual = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Entregue;05/10/2026", "A2;Dois;02/10/2026;Faro;Pendente;",
                      "A4;Quatro;04/10/2026;Évora;Pendente;")
    resultado = _comparar(base_dados, anterior, atual)
    assert resultado.disponivel and not resultado.parcial and not resultado.avisos
    assert resultado.contagens == {K.NOVA: 1, K.ALTERADA: 1, K.SEM_ALTERACOES: 1, K.NAO_ENCONTRADA: 1}
    assert _situacoes(resultado) == {"A4": K.NOVA, "A1": K.ALTERADA, "A2": K.SEM_ALTERACOES, "A3": K.NAO_ENCONTRADA}
    alteracoes = dict(zip(resultado.tabela["N.º Encomenda"], resultado.tabela["Alterações"]))
    assert alteracoes["A1"] == "Estado: Pendente → Entregue; Data de Entrega: — → 05/10/2026"
    assert alteracoes["A2"] == alteracoes["A3"] == alteracoes["A4"] == ""
    linhas = resultado.tabela.set_index("N.º Encomenda")
    assert linhas.loc["A3", "Cliente"] == "Três" and linhas.loc["A3", "Linha (anterior)"] == 4
    assert pd.isna(linhas.loc["A4", "Linha (anterior)"]) and linhas.loc["A4", "Linha (atual)"] == 4


def test_nao_encontrada_nunca_vira_entregue_nem_cancelada(base_dados):
    anterior = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;", "A2;Dois;02/10/2026;Faro;Pendente;")
    atual = csv_bytes(CAB, "A2;Dois;02/10/2026;Faro;Pendente;")
    resultado = _comparar(base_dados, anterior, atual)
    assert set(resultado.tabela["Situação"]) <= set(K.CATEGORIAS)
    linha = resultado.tabela.set_index("N.º Encomenda").loc["A1"]
    assert linha["Situação"] == K.NAO_ENCONTRADA and linha["Alterações"] == ""
    # A fotografia da importação anterior continua a dizer «Pendente»: nada foi inferido nem alterado.
    assert H.carregar_fotografia(base_dados, 1).set_index("numero").loc["A1", "estado"] == "Pendente"


def test_exemplo_dia_1_e_dia_2(base_dados):
    resultado = _comparar(base_dados, FICHEIRO_EXEMPLO_XLSX.read_bytes(), FICHEIRO_EXEMPLO_DIA2_XLSX.read_bytes(),
                          "dia1.xlsx", "dia2.xlsx")
    assert resultado.contagens == {K.NOVA: 5, K.ALTERADA: 7, K.SEM_ALTERACOES: 46, K.NAO_ENCONTRADA: 3}
    assert (len(resultado.excluidas_anterior), len(resultado.excluidas_atual)) == (4, 4)  # ENC-26-0022 e 0059 repetidos
    assert set(resultado.excluidas_anterior["N.º Encomenda"]) == {"ENC-26-0022", "ENC-26-0059"}
    assert not resultado.parcial and len(resultado.avisos) == 1
    situacoes = _situacoes(resultado)
    assert [n for n, s in situacoes.items() if s == K.NAO_ENCONTRADA] == ["ENC-26-0001", "ENC-26-0002", "ENC-26-0003"]
    assert [n for n, s in situacoes.items() if s == K.NOVA] == [f"ENC-26-{n:04d}" for n in range(61, 66)]


def test_exemplo_dia_2_corresponde_ao_gerador():
    """O Excel do dia seguinte guardado no projeto tem exatamente as linhas que o gerador produz."""
    import importlib.util

    from logiflow.importacao import ler_ficheiro

    caminho = Path(__file__).resolve().parent.parent / "scripts" / "gerar_exemplo.py"
    spec = importlib.util.spec_from_file_location("gerar_exemplo", caminho)
    gerador = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gerador)
    lido = ler_ficheiro(FICHEIRO_EXEMPLO_DIA2_XLSX.name, FICHEIRO_EXEMPLO_DIA2_XLSX.read_bytes())

    def texto(valor):
        return valor.isoformat() if isinstance(valor, (dt.date, dt.datetime)) else str(valor)

    lidas = [[texto(v.date() if isinstance(v, dt.datetime) else v) for v in linha]
             for linha in lido.dados.itertuples(index=False)]
    assert lidas == [[texto(v) for v in linha] for linha in gerador.gerar_dia2()]
    assert list(lido.colunas) == gerador.CABECALHO


# 9. Identificadores repetidos e chaves insuficientes ---------------------------------------------------

def test_numeros_repetidos_ficam_fora_dos_dois_lados(base_dados):
    anterior = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;", "A2;Dois;02/10/2026;Faro;Pendente;",
                         "a2 ;Dois-bis;02/10/2026;Faro;Pendente;", "A3;Três;03/10/2026;Braga;Pendente;",
                         "A5;Cinco;03/10/2026;Braga;Pendente;")
    atual = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;", "A2;Dois;02/10/2026;Faro;Entregue;03/10/2026",
                      "A3;Três;03/10/2026;Braga;Pendente;", "A3;Três;03/10/2026;Braga;Pendente;",
                      "A5;Cinco;03/10/2026;Braga;Pendente;")
    resultado = _comparar(base_dados, anterior, atual)
    assert resultado.disponivel
    # A2 está repetido na anterior e A3 na atual: nenhum dos dois é emparelhado, de nenhum dos lados.
    assert _situacoes(resultado) == {"A1": K.SEM_ALTERACOES, "A5": K.SEM_ALTERACOES}
    assert list(resultado.excluidas_anterior["Motivo"]) == [K.MOTIVO_REPETIDO, K.MOTIVO_REPETIDO, K.MOTIVO_REPETIDO_OUTRA]
    assert list(resultado.excluidas_atual["Motivo"]) == [K.MOTIVO_REPETIDO_OUTRA, K.MOTIVO_REPETIDO, K.MOTIVO_REPETIDO]
    assert resultado.parcial and "Comparação parcial" in resultado.avisos[0]  # 3 de 5 e 3 de 5 de fora


def test_numeros_vazios_ficam_fora(base_dados):
    anterior = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;", ";Sem número;02/10/2026;Faro;Pendente;",
                         *(f"B{i};X;02/10/2026;Faro;Pendente;" for i in range(8)))
    atual = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;", *(f"B{i};X;02/10/2026;Faro;Pendente;" for i in range(8)))
    resultado = _comparar(base_dados, anterior, atual)
    assert resultado.contagens[K.SEM_ALTERACOES] == 9 and not resultado.parcial  # 1 de 10 fora (≤ 20 %)
    assert list(resultado.excluidas_anterior.itertuples(index=False, name=None)) == [(3, "", K.MOTIVO_VAZIO)]
    assert "Ficaram de fora 1 linha(s)" in resultado.avisos[0]


def test_sem_chaves_utilizaveis_nao_ha_comparacao(base_dados):
    anterior = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;")
    atual = csv_bytes(CAB, ";Um;01/10/2026;Porto;Pendente;", "B;X;01/10/2026;Porto;Pendente;",
                      "B;Y;01/10/2026;Porto;Pendente;")
    resultado = _comparar(base_dados, anterior, atual)
    assert not resultado.disponivel and "não tem nenhum n.º de encomenda" in resultado.motivo
    assert resultado.tabela.empty and sum(resultado.contagens.values()) == 0
    assert len(resultado.excluidas_atual) == 3


def test_chave_ignora_maiusculas_e_espacos_nas_pontas_mas_nao_zeros(base_dados):
    anterior = csv_bytes(CAB, "ENC-1;Um;01/10/2026;Porto;Pendente;", "0007;Sete;01/10/2026;Porto;Pendente;")
    atual = csv_bytes(CAB, "  enc-1 ;Um;01/10/2026;Porto;Pendente;", "7;Sete;01/10/2026;Porto;Pendente;")
    situacoes = _situacoes(_comparar(base_dados, anterior, atual))
    assert situacoes["enc-1"] == K.SEM_ALTERACOES
    assert (situacoes["7"], situacoes["0007"]) == (K.NOVA, K.NAO_ENCONTRADA)  # 0007 e 7 não são o mesmo n.º


# 10. Normalização de datas, valores vazios e tipos -------------------------------------------------------

def test_normalizacao_consistente(base_dados):
    anterior = xlsx_bytes([
        ["N.º Encomenda", "Cliente", "Data", "Destino", "Estado", "Data Prevista"],
        [1001.0, "Cliente  Um", dt.date(2026, 10, 1), "Porto", "entregue", dt.date(2026, 10, 5)],
        ["A2", "Dois", dt.datetime(2026, 10, 2, 9, 30), "Faro", "Em espera", "31/02/2026"],
        ["A3", "TRÊS", "03/10/2026", "Braga", "Pendente", ""],
        ["A4", "Quatro", "04/10/2026", "Évora", "Pendente", "07/10/2026"],
    ])
    atual = csv_bytes(
        "N.º Encomenda;Cliente;Data;Destino;Estado;Data Prevista",
        "1001; Cliente Um ;01-10-2026;Porto;Entregue;2026-10-05",   # espaços, formato da data, sinónimo do estado
        "A2;Dois;02/10/2026;Faro;em espera;30/02/2026",             # estado não reconhecido: compara o texto
        "A3;Três;03/10/2026;Braga;Pendente;06/10/2026",             # maiúsculas no cliente contam; vazio → data
        "A4;Quatro;04/10/2026;Évora;Pendente;",                      # data → vazio
    )
    resultado = _comparar(base_dados, anterior, atual, "a.xlsx", "b.csv")
    alteracoes = dict(zip(resultado.tabela["N.º Encomenda"], resultado.tabela["Alterações"]))
    assert _situacoes(resultado)["1001"] == K.SEM_ALTERACOES
    assert alteracoes["A2"] == "Estado: Em espera → em espera; Data Prevista: «31/02/2026» → «30/02/2026»"
    assert alteracoes["A3"] == "Cliente: TRÊS → Três; Data Prevista: — → 06/10/2026"
    assert alteracoes["A4"] == "Data Prevista: 07/10/2026 → —"


def test_campo_que_so_existe_numa_importacao_nao_e_comparado(base_dados):
    anterior = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Entregue;03/10/2026")
    atual = csv_bytes(CABECALHO, "A1;Um;01/10/2026;Porto;Entregue")
    resultado = _comparar(base_dados, anterior, atual)
    assert _situacoes(resultado) == {"A1": K.SEM_ALTERACOES}  # a falta da coluna não é uma alteração
    assert "data_entrega" in resultado.campos_ignorados and "data_entrega" not in resultado.campos_comparados
    assert any("Data de Entrega" in aviso and "só existia" in aviso for aviso in resultado.avisos)


# Escolha das importações ----------------------------------------------------------------------------------

def test_ordem_das_importacoes_e_casos_invalidos(base_dados):
    anterior = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;")
    atual = csv_bytes(CAB, "A1;Um;01/10/2026;Porto;Pendente;", "A2;Dois;01/10/2026;Porto;Pendente;")
    guardar(base_dados, anterior)
    guardar(base_dados, atual)
    invertida = K.comparar_importacoes(base_dados, 2, 1)  # a de n.º mais baixo é sempre a anterior
    assert _situacoes(invertida) == {"A1": K.SEM_ALTERACOES, "A2": K.NOVA}
    assert "duas importações diferentes" in K.comparar_importacoes(base_dados, 1, 1).motivo
    assert "já não existe" in K.comparar_importacoes(base_dados, 1, 99).motivo
    falhada = H.registar_falha_leitura(base_dados, "x.csv", b"", None, ErroImportacao("vazio"))
    assert "concluídas" in K.comparar_importacoes(base_dados, 1, falhada.importacao_id).motivo


@pytest.mark.parametrize("categoria", K.CATEGORIAS)
def test_categorias_tem_os_nomes_pedidos(categoria):
    assert categoria in {"Nova", "Alterada", "Sem alterações", "Não encontrada na importação atual"}
