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
    # Os cinco indicadores principais (topo da página) mantêm-se como na versão 1.0.
    principais = [(m.label, m.value) for m in at.metric][:5]
    assert principais == [("Encomendas", "60"), ("Entregues", "41"), ("Pendentes", "11"),
                          ("Atrasadas", "8"), ("Linhas com erros", "9")]
    assert [t.label.split(" ", 1)[1] for t in at.tabs] == [
        "Encomendas", "Resumo", "Desempenho", "Qualidade dos dados (11)", "Exportar"]


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
    # Dados limpos, relatório e relatório de desempenho: os três só existem depois do pedido.
    assert len(at.get("download_button")) == 3 and not at.exception


# Desempenho operacional (versão 1.1) ------------------------------------------

def _app_exemplo() -> AppTest:
    at = _app().run()
    at.button(key="usar_exemplo_inicio").click().run()
    return at


def test_app_separador_desempenho_com_o_exemplo():
    at = _app_exemplo()
    assert not at.exception and not at.error
    valores = {m.label: (m.value, m.delta) for m in at.metric}
    assert valores["Entregas no prazo"] == ("74,3%", "26 de 35 entregas avaliadas")
    assert valores["Tempo médio de entrega"] == ("3,3 dias", "mediana 3,0 dias · 35 entregas")
    assert valores["Entregas com atraso"] == ("9", "atraso médio 1,6 dias")
    assert any("51 encomendas sem erros" in c.value and "9 com erros" in c.value for c in at.caption)


def test_app_desempenho_por_mes_e_por_destino():
    at = _app_exemplo()
    agrupar = next(b for b in at.get("button_group") if b.label == "Agrupar por")
    agrupar.set_value("Mês").run()
    comparar = next(b for b in at.get("button_group") if b.label == "Comparar por")
    comparar.set_value("Destino").run()
    assert not at.exception
    assert any("agrupado por **mês**" in m.value for m in at.markdown)


def test_app_desempenho_respeita_os_filtros():
    at = _app_exemplo()
    next(t for t in at.text_input if t.label == "Pesquisar").set_value("Ferragens").run()
    valores = {m.label: m.value for m in at.metric}
    assert valores["Entregas no prazo"] == "50,0%"  # 4 de 8 entregas da Ferragens Ponte Nova


def test_app_desempenho_sem_datas_de_entrega():
    at = _app_exemplo()
    next(s for s in at.selectbox if s.label.startswith("Data de Entrega")).set_value("(nenhuma)").run()
    valores = {m.label: m.value for m in at.metric}
    assert valores["Entregas no prazo"] == "—" and valores["Tempo médio de entrega"] == "—"
    assert valores["Entregues"] == "41"  # os indicadores da versão 1.0 não mudam


def test_app_relatorio_de_desempenho_por_cliente():
    at = _app_exemplo()
    ambito = next(s for s in at.selectbox if s.label == "Âmbito do relatório")
    assert ambito.options[0] == "Todos os clientes" and "Ferragens Ponte Nova" in ambito.options
    ambito.set_value("Ferragens Ponte Nova").run()
    assert not at.exception and not at.error
    rotulos = [b.proto.label for b in at.get("download_button")]
    assert "Descarregar relatório de desempenho (.xlsx)" in rotulos
