"""Testes da deteção de colunas e da validação das encomendas."""

from __future__ import annotations

import datetime as dt

import pytest

from logiflow import campos as C
from logiflow.datas import interpretar_data
from logiflow.importacao import ler_ficheiro
from logiflow.validacao import (
    AVISO,
    ERRO,
    TIPO_DATA_INVALIDA,
    TIPO_DUPLICADO,
    TIPO_ESTADO,
    TIPO_INCOERENCIA,
    TIPO_VAZIO,
    validar,
)

from .conftest import CABECALHO, REFERENCIA, csv_bytes, processar


# Colunas ---------------------------------------------------------------------

def test_deteta_colunas_com_nomes_variados():
    colunas = ["Nº encomenda", "NOME DO CLIENTE", "Data da Encomenda", "Localidade", "Situação",
               "Prazo de Entrega", "Data Efetiva de Entrega", "Peso (kg)"]
    mapa = C.detetar_colunas(colunas)
    assert mapa == {
        C.NUMERO: "Nº encomenda", C.CLIENTE: "NOME DO CLIENTE", C.DATA: "Data da Encomenda",
        C.DESTINO: "Localidade", C.ESTADO: "Situação", C.DATA_PREVISTA: "Prazo de Entrega",
        C.DATA_ENTREGA: "Data Efetiva de Entrega",
    }


@pytest.mark.parametrize("cabecalho", ["N.º Encomenda", "N.º  encomenda ", "Nº Encomenda", "N° Encomenda",
                                       "numero da encomenda", "NÚMERO DE ENCOMENDA"])
def test_variantes_do_numero_de_encomenda(cabecalho):
    assert C.campo_da_coluna(cabecalho) == C.NUMERO


def test_exemplos_mostrados_ao_utilizador_sao_reconhecidos():
    for campo in C.CAMPOS:
        assert campo.exemplos, campo.nome
        for exemplo in (campo.rotulo, *campo.exemplos):
            assert C.campo_da_coluna(exemplo) == campo.nome, exemplo


def test_colunas_obrigatorias_em_falta():
    mapa = C.detetar_colunas(["Encomenda", "Cliente", "Observações"])
    assert C.campos_em_falta(mapa) == [C.DATA, C.DESTINO, C.ESTADO]


def test_coluna_escolhida_para_dois_campos():
    mapa = {C.NUMERO: "A", C.CLIENTE: "A", C.DATA: "B"}
    assert C.colunas_repetidas(mapa) == {"A": [C.NUMERO, C.CLIENTE]}


def test_validar_recusa_mapeamento_incompleto():
    lido = ler_ficheiro("e.csv", csv_bytes("Encomenda;Cliente", "E1;A"))
    with pytest.raises(ValueError, match="Faltam colunas obrigatórias"):
        validar(lido, C.detetar_colunas(lido.colunas), REFERENCIA)


def test_mapeamento_manual():
    lido = ler_ficheiro("e.csv", csv_bytes("Ref;Quem;Quando;Para onde;Como está", "E1;A;01/10/2026;Porto;Pendente"))
    mapa = {C.NUMERO: "Ref", C.CLIENTE: "Quem", C.DATA: "Quando", C.DESTINO: "Para onde", C.ESTADO: "Como está"}
    resultado = validar(lido, mapa, REFERENCIA)
    assert resultado.linhas_com_erro == 0
    assert resultado.tabela.iloc[0][C.DESTINO] == "Porto"


# Campos vazios e duplicados --------------------------------------------------

def _problemas(resultado, tipo=None):
    p = resultado.problemas
    return p if tipo is None else p[p["Tipo"] == tipo]


def test_campos_obrigatorios_vazios():
    _, resultado, _, _ = processar(csv_bytes(
        CABECALHO,
        "E1;;01/10/2026;Porto;Pendente",
        "E2;Loja;01/10/2026;   ;Pendente",
        ";Loja;01/10/2026;Porto;",
    ))
    vazios = _problemas(resultado, TIPO_VAZIO)
    assert set(zip(vazios["Linha"], vazios["Campo"])) == {
        (2, "Cliente"), (3, "Destino"), (4, "N.º Encomenda"), (4, "Estado")}
    assert (vazios["Gravidade"] == ERRO).all()
    assert resultado.linhas_com_erro == 3


def test_duplicados_ignoram_maiusculas_e_espacos():
    _, resultado, _, _ = processar(csv_bytes(
        CABECALHO,
        "ENC-1;A;01/10/2026;Porto;Pendente",
        " enc-1 ;B;02/10/2026;Braga;Entregue",
        "ENC-2;C;03/10/2026;Faro;Pendente",
    ))
    duplicados = _problemas(resultado, TIPO_DUPLICADO)
    assert sorted(duplicados["Linha"]) == [2, 3]
    assert "linhas 2, 3" in duplicados.iloc[0]["Descrição"]
    assert "idênticas" not in duplicados.iloc[0]["Descrição"]


def test_duplicados_identicos_sao_assinalados():
    linha = "E1;A;01/10/2026;Porto;Pendente"
    _, resultado, _, _ = processar(csv_bytes(CABECALHO, linha, linha))
    assert all("idênticas" in d for d in _problemas(resultado, TIPO_DUPLICADO)["Descrição"])


def test_numeros_vazios_nao_contam_como_duplicados():
    _, resultado, _, _ = processar(csv_bytes(CABECALHO, ";A;01/10/2026;Porto;Pendente", ";B;01/10/2026;Porto;Pendente"))
    assert _problemas(resultado, TIPO_DUPLICADO).empty


# Datas -------------------------------------------------------------------------

@pytest.mark.parametrize("texto, esperado", [
    ("03/04/2026", dt.date(2026, 4, 3)),        # dia primeiro (formato português)
    ("3/4/2026", dt.date(2026, 4, 3)),
    ("03-04-2026", dt.date(2026, 4, 3)),
    ("03.04.26", dt.date(2026, 4, 3)),
    ("2026-04-03", dt.date(2026, 4, 3)),        # ISO
    ("2026-04-03 14:30:00", dt.date(2026, 4, 3)),
    (dt.datetime(2026, 4, 3, 10, 0), dt.date(2026, 4, 3)),  # célula de data do Excel
])
def test_datas_validas(texto, esperado):
    assert interpretar_data(texto) == (esperado, None)


@pytest.mark.parametrize("texto, motivo", [
    ("31/02/2026", "inexistente"),
    ("13/13/2026", "inexistente"),
    ("ontem", "formato"),
    ("45930", "formato"),        # número solto: não se adivinha que seja uma data
    ("01/01/1900", "ano fora"),
    ("01/01/2206", "ano fora"),
])
def test_datas_invalidas(texto, motivo):
    data, erro = interpretar_data(texto)
    assert data is None and motivo in erro


def test_data_vazia_nao_e_invalida():
    assert interpretar_data("  ") == (None, None)


def test_datas_invalidas_sao_erro_e_indicam_a_linha():
    _, resultado, _, _ = processar(csv_bytes(
        CABECALHO + ";Data Prevista",
        "E1;A;31/02/2026;Porto;Pendente;05/10/2026",
        "E2;B;01/10/2026;Porto;Pendente;depois",
        "E3;C;01/10/2026;Porto;Pendente;",
    ))
    invalidas = _problemas(resultado, TIPO_DATA_INVALIDA)
    assert set(zip(invalidas["Linha"], invalidas["Campo"])) == {(2, "Data"), (3, "Data Prevista")}
    assert invalidas.iloc[0]["Valor no ficheiro"] == "31/02/2026"
    assert resultado.linhas_com_erro == 2  # a data prevista vazia (E3) não é erro


# Estados -----------------------------------------------------------------------

@pytest.mark.parametrize("texto, canonico", [
    ("entregue", C.ENTREGUE), ("ENTREGUE", C.ENTREGUE), ("em transito", C.EM_TRANSITO),
    ("Em Trânsito", C.EM_TRANSITO), ("expedida", C.EM_TRANSITO), ("por expedir", C.PENDENTE),
    ("anulada", C.CANCELADA), ("devolvido", C.DEVOLVIDA),
    ("concluída", None), ("ok", None), ("", None),
])
def test_normalizacao_de_estados(texto, canonico):
    assert C.normalizar_estado(texto) == canonico


def test_estado_desconhecido_e_aviso_e_nao_conta_como_entregue():
    _, resultado, _, ind = processar(csv_bytes(CABECALHO, "E1;A;01/10/2026;Porto;Concluída"))
    estado = _problemas(resultado, TIPO_ESTADO)
    assert len(estado) == 1 and estado.iloc[0]["Gravidade"] == AVISO
    assert resultado.linhas_com_erro == 0          # a linha é aproveitada...
    assert ind.entregues == 0 and ind.pendentes == 0  # ...mas não é contada como entregue nem pendente
    assert ind.estado_nao_reconhecido == 1


def test_data_de_entrega_nao_torna_a_encomenda_entregue():
    _, resultado, _, ind = processar(csv_bytes(
        CABECALHO + ";Data de Entrega", "E1;A;01/10/2026;Porto;Pendente;03/10/2026"))
    assert ind.entregues == 0 and ind.pendentes == 1
    avisos = _problemas(resultado, TIPO_INCOERENCIA)
    assert any("não é contada como entregue" in d for d in avisos["Descrição"])


def test_incoerencias_de_datas_sao_avisos():
    _, resultado, _, _ = processar(csv_bytes(
        CABECALHO + ";Data Prevista;Data de Entrega",
        "E1;A;10/10/2026;Porto;Entregue;08/10/2026;05/10/2026",
        "E2;A;30/12/2026;Porto;Pendente;;",
    ))
    descricoes = list(_problemas(resultado, TIPO_INCOERENCIA)["Descrição"])
    assert "Data prevista anterior à data da encomenda" in descricoes
    assert "Data de entrega anterior à data da encomenda" in descricoes
    assert any("posterior à data de referência" in d for d in descricoes)
    assert resultado.linhas_com_erro == 0


def test_numeros_de_linha_correspondem_ao_ficheiro_original():
    _, resultado, _, _ = processar(csv_bytes(
        "Lista de encomendas", "", CABECALHO, "E1;A;01/10/2026;Porto;Pendente", "", "E2;;01/10/2026;Porto;Pendente"))
    assert list(resultado.tabela["linha"]) == [4, 6]
    assert list(_problemas(resultado)["Linha"]) == [6]


def test_colunas_extra_sao_mantidas():
    _, resultado, _, _ = processar(csv_bytes(CABECALHO + ";Peso (kg)", "E1;A;01/10/2026;Porto;Pendente;12,5"))
    assert list(resultado.extras.columns) == ["Peso (kg)"]
    assert resultado.extras.iloc[0]["Peso (kg)"] == "12,5"
