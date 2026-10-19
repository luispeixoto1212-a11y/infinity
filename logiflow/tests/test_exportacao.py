"""Testes das exportações para Excel."""

from __future__ import annotations

import datetime as dt
import io

from openpyxl import load_workbook

from logiflow.exportacao import exportar_dados_limpos, exportar_relatorio

from .conftest import CABECALHO, csv_bytes, processar

FICHEIRO = csv_bytes(
    CABECALHO + ";Data Prevista;Observações",
    "E1;Loja A;01/10/2026;Porto;Entregue;03/10/2026;Frágil",
    "E2;Loja B;31/02/2026;Braga;Pendente;05/10/2026;",          # data inválida -> erro
    "E3;Loja C;02/10/2026;Faro;em transito;04/10/2026;",        # atrasada na referência 20/10
    "E3;Loja D;03/10/2026;Évora;Pendente;30/10/2026;",           # duplicado -> erro
    # Valor malicioso, entre aspas como o Excel o gravaria num CSV.
    'E5;"=HYPERLINK(""http://exemplo.invalid"";""clique"")";04/10/2026;Viseu;Pendente;30/10/2026;=1+1',
)


def _abrir(conteudo: bytes):
    return load_workbook(io.BytesIO(conteudo))


def _linhas(folha):
    return [list(r) for r in folha.iter_rows(values_only=True)]


def test_dados_limpos_nao_perdem_nenhuma_linha():
    _, resultado, _, _ = processar(FICHEIRO)
    livro = _abrir(exportar_dados_limpos(resultado, "teste.csv"))
    assert livro.sheetnames == ["Encomendas válidas", "Linhas com erros", "Informação"]
    validas = _linhas(livro["Encomendas válidas"])[1:]
    com_erros = _linhas(livro["Linhas com erros"])[1:]
    assert len(validas) + len(com_erros) == resultado.total == 5
    assert sorted(r[0] for r in validas) == ["E1", "E5"]
    info = {r[0]: r[1] for r in _linhas(livro["Informação"]) if r[0]}
    assert info["Total confere (válidas + com erros = lidas)"] == "Sim"


def test_linhas_com_erros_mantem_valores_originais_e_motivo():
    _, resultado, _, _ = processar(FICHEIRO)
    folha = _abrir(exportar_dados_limpos(resultado, "teste.csv"))["Linhas com erros"]
    linhas = _linhas(folha)
    cabecalho = linhas[0]
    assert cabecalho[0] == "Linha no ficheiro" and cabecalho[-2:] == ["Erros", "Avisos"]
    por_linha = {r[0]: dict(zip(cabecalho, r)) for r in linhas[1:]}
    assert por_linha[3]["Data"] == "31/02/2026"        # texto original preservado
    assert "Data inválida" in por_linha[3]["Erros"]
    assert "repetido" in por_linha[4]["Erros"] and "repetido" in por_linha[5]["Erros"]


def test_dados_limpos_normalizados():
    _, resultado, _, _ = processar(FICHEIRO)
    folha = _abrir(exportar_dados_limpos(resultado, "teste.csv"))["Encomendas válidas"]
    cabecalho = [c.value for c in folha[1]]
    assert cabecalho == ["N.º Encomenda", "Cliente", "Data", "Destino", "Estado", "Data Prevista",
                         "Observações", "Avisos", "Linha no ficheiro"]
    e1 = folha[2]
    assert e1[2].value == dt.datetime(2026, 10, 1)     # data guardada como data do Excel
    assert e1[2].number_format == "DD/MM/YYYY"
    assert e1[6].value == "Frágil"                     # coluna extra preservada


def test_texto_com_formula_e_gravado_como_texto():
    """Proteção contra injeção de fórmulas: nada vindo do ficheiro é gravado como fórmula."""
    _, resultado, tabela, ind = processar(FICHEIRO)
    for conteudo in (exportar_dados_limpos(resultado, "t.csv"),
                     exportar_relatorio(resultado, tabela, ind, "t.csv")):
        livro = _abrir(conteudo)
        encontrados = 0
        for folha in livro.worksheets:
            for linha in folha.iter_rows():
                for celula in linha:
                    assert celula.data_type != "f", f"fórmula em {folha.title}!{celula.coordinate}"
                    if isinstance(celula.value, str) and celula.value.startswith("=HYPERLINK"):
                        encontrados += 1
        assert encontrados >= 1  # o valor continua lá, como texto


def test_relatorio_tem_folhas_e_valores_coerentes():
    _, resultado, tabela, ind = processar(FICHEIRO)
    livro = _abrir(exportar_relatorio(resultado, tabela, ind, "teste.csv"))
    assert livro.sheetnames == ["Resumo", "Por estado", "Atrasadas", "Problemas", "Todas as encomendas"]

    resumo = {r[0]: r[1] for r in _linhas(livro["Resumo"]) if r[0]}
    assert resumo["Total de encomendas"] == 5
    assert resumo["Entregues"] == 1
    assert resumo["Pendentes"] == 4
    # E2 tem a data da encomenda inválida, mas a data prevista (05/10) é válida: também está atrasada.
    assert resumo["Atrasadas"] == ind.atrasadas == 2
    assert resumo["Linhas com erros"] == 3
    assert resumo["Data de referência"] == dt.datetime(2026, 10, 20)

    atrasadas = _linhas(livro["Atrasadas"])
    assert len(atrasadas) - 1 == ind.atrasadas
    assert [(r[0], r[7]) for r in atrasadas[1:]] == [("E3", 16), ("E2", 15)]  # mais atrasada primeiro

    assert len(_linhas(livro["Problemas"])) - 1 == len(resultado.problemas)
    assert len(_linhas(livro["Todas as encomendas"])) - 1 == resultado.total


def test_relatorio_sem_prazos_indica_que_atrasos_nao_estao_disponiveis():
    _, resultado, tabela, ind = processar(csv_bytes(CABECALHO, "E1;A;01/10/2026;Porto;Pendente"))
    livro = _abrir(exportar_relatorio(resultado, tabela, ind, "teste.csv"))
    resumo = {r[0]: r[1] for r in _linhas(livro["Resumo"]) if r[0]}
    assert resumo["Atrasadas"] == "Não disponível"
    assert "não foram calculados" in resumo["Prazo usado para atrasos"]
    assert "Não é possível determinar atrasos" in livro["Atrasadas"]["A1"].value


def test_exportacoes_a_partir_de_excel():
    from .conftest import xlsx_bytes
    conteudo = xlsx_bytes([
        ["N.º Encomenda", "Cliente", "Data", "Destino", "Estado"],
        ["E1", "A", dt.datetime(2026, 10, 1), "Porto", "Entregue"],
        ["E2", "", dt.datetime(2026, 10, 2), "Porto", "Pendente"],
    ])
    _, resultado, tabela, ind = processar(conteudo, nome="t.xlsx")
    livro = _abrir(exportar_dados_limpos(resultado, "t.xlsx"))
    erros = _linhas(livro["Linhas com erros"])
    assert erros[1][3] == dt.datetime(2026, 10, 2)  # data original do Excel mantida como data
    assert _abrir(exportar_relatorio(resultado, tabela, ind, "t.xlsx"))["Resumo"]["A1"].value.startswith("LogiFlow")
