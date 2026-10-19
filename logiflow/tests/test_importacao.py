"""Testes da leitura de ficheiros CSV e Excel."""

from __future__ import annotations

import datetime as dt
import io
import zipfile

import pytest
from openpyxl import Workbook

from logiflow import importacao
from logiflow.importacao import ErroImportacao, ler_ficheiro, listar_folhas

from .conftest import CABECALHO, csv_bytes, xlsx_bytes


# CSV -------------------------------------------------------------------------

def test_csv_ponto_e_virgula_em_windows_1252_mantem_acentos():
    conteudo = csv_bytes(CABECALHO, "E1;Câmara Óptica;01/10/2026;Évora;Em trânsito", codificacao="cp1252")
    lido = ler_ficheiro("encomendas.csv", conteudo)
    assert lido.codificacao == "Windows-1252"
    assert lido.separador == "ponto e vírgula (;)"
    assert lido.dados.iloc[0].tolist() == ["E1", "Câmara Óptica", "01/10/2026", "Évora", "Em trânsito"]


def test_csv_virgula_utf8_com_bom():
    conteudo = "﻿N.º Encomenda,Cliente,Data,Destino,Estado\nE1,\"Loja, Lda.\",01/10/2026,Porto,Pendente\n"
    lido = ler_ficheiro("e.csv", conteudo.encode("utf-8"))
    assert lido.codificacao == "UTF-8"
    assert lido.colunas[0] == "N.º Encomenda"  # o BOM não fica colado ao primeiro cabeçalho
    assert lido.dados.iloc[0]["Cliente"] == "Loja, Lda."


def test_csv_utf16_do_excel():
    texto = CABECALHO.replace(";", "\t") + "\nE1\tLoja\t01/10/2026\tPorto\tPendente\n"
    lido = ler_ficheiro("e.csv", texto.encode("utf-16"))
    assert lido.codificacao == "UTF-16"
    assert lido.dados.iloc[0]["Destino"] == "Porto"


def test_zeros_a_esquerda_e_texto_nao_sao_convertidos():
    lido = ler_ficheiro("e.csv", csv_bytes(CABECALHO, "000123;NA;01/10/2026;1e5;Pendente"))
    linha = lido.dados.iloc[0]
    assert linha["N.º Encomenda"] == "000123"
    assert linha["Cliente"] == "NA"        # não é transformado em "valor em falta"
    assert linha["Destino"] == "1e5"       # não é transformado em número


def test_linhas_vazias_sao_ignoradas_e_comunicadas():
    lido = ler_ficheiro("e.csv", csv_bytes(CABECALHO, "E1;A;01/10/2026;Porto;Pendente", ";;;;", "",
                                           "E2;B;02/10/2026;Braga;Entregue"))
    assert lido.total_linhas == 2
    assert lido.linhas == [2, 5]          # números de linha do ficheiro original
    assert lido.linhas_vazias_ignoradas == 2
    assert any("vazia" in a for a in lido.avisos)


def test_valores_a_mais_numa_linha_nao_se_perdem():
    lido = ler_ficheiro("e.csv", csv_bytes(CABECALHO, "E1;A;01/10/2026;Porto;Pendente;valor extra"))
    assert "Coluna sem nome (F)" in lido.colunas
    assert lido.dados.iloc[0]["Coluna sem nome (F)"] == "valor extra"
    assert any("não tem cabeçalho" in a for a in lido.avisos)


def test_cabecalhos_repetidos_sao_renomeados():
    lido = ler_ficheiro("e.csv", csv_bytes(CABECALHO + ";Notas;Notas", "E1;A;01/10/2026;Porto;Pendente;x;y"))
    assert lido.colunas[-2:] == ["Notas", "Notas (2)"]
    assert lido.dados.iloc[0]["Notas (2)"] == "y"


def test_csv_que_e_na_verdade_um_excel():
    with pytest.raises(ErroImportacao, match="extensão .csv"):
        ler_ficheiro("e.csv", xlsx_bytes([["a"]]))


def test_csv_binario_e_recusado():
    with pytest.raises(ErroImportacao, match="binários"):
        ler_ficheiro("e.csv", b"abc\x00\x01\x02")


def test_csv_com_aspas_por_fechar_nao_perde_linhas_em_silencio():
    conteudo = csv_bytes(CABECALHO, 'E1;"Loja A;01/10/2026;Porto;Pendente', "E2;B;02/10/2026;Braga;Entregue")
    with pytest.raises(ErroImportacao, match="aspas"):
        ler_ficheiro("e.csv", conteudo)


def test_csv_com_campo_em_varias_linhas_entre_aspas_e_aceite():
    conteudo = csv_bytes(CABECALHO + ";Notas", 'E1;A;01/10/2026;Porto;Pendente;"Linha 1\nLinha 2"',
                         'E2;Monitor 5" Lda;02/10/2026;Braga;Entregue;')
    lido = ler_ficheiro("e.csv", conteudo)
    assert lido.dados["Notas"].tolist() == ["Linha 1\nLinha 2", ""]
    assert lido.dados.iloc[1]["Cliente"] == 'Monitor 5" Lda'


# Excel -----------------------------------------------------------------------

def test_excel_datas_ficam_datas_e_numeros_ficam_texto():
    conteudo = xlsx_bytes([
        ["N.º Encomenda", "Cliente", "Data", "Destino", "Estado"],
        [1001, "Loja", dt.datetime(2026, 10, 1), "Porto", "Pendente"],
        [1002.0, "Loja", "02/10/2026", 4100, "Entregue"],
    ])
    lido = ler_ficheiro("e.xlsx", conteudo)
    assert lido.formato == "Excel"
    assert lido.dados["N.º Encomenda"].tolist() == ["1001", "1002"]
    assert isinstance(lido.dados.iloc[0]["Data"], dt.datetime)
    assert lido.dados.iloc[1]["Destino"] == "4100"


def test_excel_com_titulo_antes_do_cabecalho():
    conteudo = xlsx_bytes([
        ["Relatório de encomendas — outubro"],
        [],
        ["N.º Encomenda", "Cliente", "Data", "Destino", "Estado"],
        ["E1", "Loja", "01/10/2026", "Porto", "Pendente"],
    ])
    lido = ler_ficheiro("e.xlsx", conteudo)
    assert lido.linha_cabecalho == 3
    assert lido.linhas == [4]
    assert lido.colunas == ["N.º Encomenda", "Cliente", "Data", "Destino", "Estado"]
    assert any("cabeçalho foi encontrado na linha 3" in a for a in lido.avisos)


def test_excel_varias_folhas():
    conteudo = xlsx_bytes(
        [["N.º Encomenda", "Cliente", "Data", "Destino", "Estado"], ["E1", "A", "01/10/2026", "Porto", "Pendente"]],
        folhas={"Outubro": [["N.º Encomenda", "Cliente", "Data", "Destino", "Estado"],
                            ["E9", "B", "09/10/2026", "Faro", "Entregue"]]},
    )
    assert listar_folhas(conteudo) == ["Encomendas", "Outubro"]
    assert ler_ficheiro("e.xlsx", conteudo).dados.iloc[0, 0] == "E1"
    lido = ler_ficheiro("e.xlsx", conteudo, folha="Outubro")
    assert lido.folha == "Outubro" and lido.dados.iloc[0, 0] == "E9"
    with pytest.raises(ErroImportacao, match="não existe"):
        ler_ficheiro("e.xlsx", conteudo, folha="Inexistente")


def test_formulas_do_excel_nao_sao_calculadas():
    """Uma fórmula sem valor guardado fica vazia: a aplicação nunca a executa."""
    livro = Workbook()
    folha = livro.active
    folha.append(["N.º Encomenda", "Cliente", "Data", "Destino", "Estado"])
    folha.append(["E1", "=1+1", "01/10/2026", "Porto", "Pendente"])
    memoria = io.BytesIO()
    livro.save(memoria)
    lido = ler_ficheiro("e.xlsx", memoria.getvalue())
    assert lido.dados.iloc[0]["Cliente"] == ""


# Ficheiros recusados ---------------------------------------------------------

@pytest.mark.parametrize("nome, conteudo, mensagem", [
    ("e.txt", b"abc", "não suportado"),
    ("e.xls", b"abc", "Excel 97-2003"),
    ("e.csv", b"", "vazio"),
    ("e.xlsx", b"isto nao e um excel", "não é um Excel"),
    ("e.xlsx", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 100, "palavra-passe"),
    ("e.xlsx", b"PK\x03\x04 danificado", "danificado"),
    ("e.csv", b";;;\n;;;\n", "não contém dados"),
    ("e.csv", CABECALHO.encode() + b"\n", "só tem o cabeçalho"),
])
def test_ficheiros_invalidos_tem_mensagem_clara(nome, conteudo, mensagem):
    with pytest.raises(ErroImportacao, match=mensagem):
        ler_ficheiro(nome, conteudo)


def test_ficheiro_demasiado_grande(monkeypatch):
    monkeypatch.setattr(importacao, "TAMANHO_MAXIMO", 100)
    with pytest.raises(ErroImportacao, match="limite"):
        ler_ficheiro("e.csv", b"x" * 101)


def test_bomba_zip_e_recusada(monkeypatch):
    monkeypatch.setattr(importacao, "TAMANHO_DESCOMPRIMIDO_MAXIMO", 1000)
    memoria = io.BytesIO()
    with zipfile.ZipFile(memoria, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("xl/worksheets/sheet1.xml", "0" * 100_000)  # comprime muito, descomprime muito
    with pytest.raises(ErroImportacao, match="segurança"):
        ler_ficheiro("e.xlsx", memoria.getvalue())


def test_demasiadas_linhas(monkeypatch):
    monkeypatch.setattr(importacao, "MAX_LINHAS", 3)
    linhas = [CABECALHO] + [f"E{i};A;01/10/2026;Porto;Pendente" for i in range(10)]
    with pytest.raises(ErroImportacao, match="mais de 3 linhas"):
        ler_ficheiro("e.csv", csv_bytes(*linhas))


def test_celula_maior_do_que_o_excel_aceita():
    with pytest.raises(ErroImportacao, match="32767"):
        ler_ficheiro("e.csv", csv_bytes(CABECALHO, "E1;" + "x" * 40_000 + ";01/10/2026;Porto;Pendente"))
