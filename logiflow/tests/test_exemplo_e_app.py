"""Testes do ficheiro de exemplo e da interface (sem abrir o navegador)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

from logiflow.exemplo import DATA_REFERENCIA_EXEMPLO, FICHEIRO_EXEMPLO_CSV, FICHEIRO_EXEMPLO_XLSX
from logiflow.validacao import AVISO, ERRO

from .conftest import processar

RAIZ = Path(__file__).resolve().parent.parent


def _gerador():
    spec = importlib.util.spec_from_file_location("gerar_exemplo", RAIZ / "scripts" / "gerar_exemplo.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.mark.parametrize("ficheiro", [FICHEIRO_EXEMPLO_CSV, FICHEIRO_EXEMPLO_XLSX])
def test_exemplo_tem_a_composicao_documentada(ficheiro):
    _, resultado, _, ind = processar(ficheiro.read_bytes(), nome=ficheiro.name, referencia=DATA_REFERENCIA_EXEMPLO)
    assert (ind.total, ind.entregues, ind.pendentes, ind.atrasadas, ind.com_erros) == (60, 41, 11, 8, 9)
    gravidades = resultado.problemas["Gravidade"].value_counts()
    assert gravidades[ERRO] == 9 and gravidades[AVISO] == 2


def test_exemplo_corresponde_ao_gerador(tmp_path):
    """O CSV guardado no projeto é exatamente o que o gerador produz (dados reprodutíveis)."""
    gerador = _gerador()
    assert gerador.DATA_REFERENCIA == DATA_REFERENCIA_EXEMPLO
    destino = tmp_path / "exemplo.csv"
    gerador.gravar_csv(gerador.gerar(), destino)
    assert destino.read_bytes() == FICHEIRO_EXEMPLO_CSV.read_bytes()


def _app() -> AppTest:
    return AppTest.from_file(str(RAIZ / "app.py"), default_timeout=60)


def test_app_abre_no_ecra_inicial():
    at = _app().run()
    assert not at.exception
    assert at.title[0].value == "LogiFlow"
    assert any("Como começar" in m.value for m in at.markdown)


def test_app_com_ficheiro_de_exemplo():
    at = _app().run()
    at.button(key="usar_exemplo_inicio").click().run()
    assert not at.exception and not at.error
    valores = {m.label: m.value for m in at.metric}
    assert valores == {"Encomendas": "60", "Entregues": "41", "Pendentes": "11",
                       "Atrasadas": "8", "Linhas com erros": "9"}
    assert [t.label.split(" ", 1)[1] for t in at.tabs] == [
        "Encomendas", "Resumo", "Qualidade dos dados (11)", "Exportar"]


def test_app_filtro_por_estado_atualiza_indicadores():
    at = _app().run()
    at.button(key="usar_exemplo_inicio").click().run()
    filtro = next(m for m in at.multiselect if m.label == "Estado")
    filtro.set_value(["Entregue"]).run()
    valores = {m.label: m.value for m in at.metric}
    assert valores["Encomendas"] == "41" and valores["Pendentes"] == "0"


def test_app_filtro_de_validacao_e_limpar_filtros():
    at = _app().run()
    at.button(key="usar_exemplo_inicio").click().run()
    next(s for s in at.selectbox if s.label == "Validação").set_value("Com erros").run()
    assert {m.label: m.value for m in at.metric}["Encomendas"] == "9"
    next(b for b in at.button if b.label == "Limpar todos os filtros").click().run()
    assert {m.label: m.value for m in at.metric}["Encomendas"] == "60"


def test_app_sem_data_prevista_mostra_atrasos_indisponiveis():
    at = _app().run()
    at.button(key="usar_exemplo_inicio").click().run()
    selecao = next(s for s in at.selectbox if s.label.startswith("Data Prevista"))
    selecao.set_value("(nenhuma)").run()
    assert {m.label: m.value for m in at.metric}["Atrasadas"] == "—"
    at.number_input(key="prazo_padrao").set_value(3).run()
    assert {m.label: m.value for m in at.metric}["Atrasadas"] != "—"


def test_app_exportacoes_disponiveis_com_o_exemplo():
    at = _app().run()
    at.button(key="usar_exemplo_inicio").click().run()
    rotulos = [b.proto.label for b in at.get("download_button")]
    assert "Descarregar dados limpos (.xlsx)" in rotulos and "Descarregar relatório (.xlsx)" in rotulos


def test_app_ficheiro_grande_so_exporta_a_pedido():
    """Acima do limite, os Excel só são gerados quando o utilizador pede (com aviso do tempo)."""
    codigo = (RAIZ / "app.py").read_text(encoding="utf-8")
    assert "LIMITE_EXPORTACAO_IMEDIATA = 5_000" in codigo
    at = AppTest.from_string(codigo.replace("LIMITE_EXPORTACAO_IMEDIATA = 5_000", "LIMITE_EXPORTACAO_IMEDIATA = 10"),
                             default_timeout=60).run()
    at.button(key="usar_exemplo_inicio").click().run()
    assert not at.get("download_button")
    next(b for b in at.button if b.label == "Preparar ficheiros Excel").click().run()
    assert len(at.get("download_button")) == 2 and not at.exception
