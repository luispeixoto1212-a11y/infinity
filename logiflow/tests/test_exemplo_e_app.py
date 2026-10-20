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
    # Alteração intencional na 1.2.0: novo separador «Exceções» a seguir a «Encomendas».
    # Alteração intencional na 1.3.0: novo separador «Histórico», acrescentado no fim.
    # Os separadores anteriores mantêm os mesmos nomes e a mesma ordem.
    separadores = [t.label.split(" ", 1)[1] for t in at.tabs]
    assert [s for s in separadores if not s.startswith("Exceções") and s != "Histórico"] == [
        "Encomendas", "Resumo", "Desempenho", "Qualidade dos dados (11)", "Exportar"]
    assert separadores[1] == "Exceções (18)"
    assert separadores == ["Encomendas", "Exceções (18)", "Resumo", "Desempenho", "Qualidade dos dados (11)",
                           "Exportar", "Histórico"]


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


# Painel de exceções (versão 1.2) ----------------------------------------------------

def _metricas(at: AppTest) -> dict[str, str]:
    return {m.label: m.value for m in at.metric}


def _mostrar(at: AppTest) -> str:
    return next(c.value for c in at.caption if "encomendas com exceções" in c.value)


def _local(at: AppTest, tipo: str, rotulo: str):
    return next(w for w in getattr(at, tipo) if w.label == rotulo)


def test_app_painel_de_excecoes_com_o_exemplo():
    at = _app_exemplo()
    assert not at.exception and not at.error
    m = _metricas(at)
    assert (m["Prioridade alta"], m["Prioridade média"], m["Prioridade baixa"]) == ("8", "1", "9")
    assert m["Encomendas com exceções"] == "18"
    assert m["Atrasadas"] == "8"  # o mesmo número do indicador do topo
    assert "**18** de 18" in _mostrar(at)
    assert "Descarregar estas 18 exceções (.xlsx)" in [b.proto.label for b in at.get("download_button")]


def test_app_filtros_do_painel_combinados_e_exportacao_do_visivel():
    at = _app_exemplo()
    _local(at, "multiselect", "Prioridade").set_value(["Alta"]).run()
    assert "**8** de 18" in _mostrar(at)
    _local(at, "multiselect", "Categoria").set_value(["Pendente há demasiado tempo"]).run()
    assert "**6** de 18" in _mostrar(at)
    _local(at, "text_input", "Pesquisar exceções").set_value("eletro").run()
    assert "**1** de 18" in _mostrar(at)
    rotulos = [b.proto.label for b in at.get("download_button")]
    assert "Descarregar estas 1 exceções (.xlsx)" in rotulos
    _local(at, "button", "Limpar filtros do painel").click().run()
    assert "**18** de 18" in _mostrar(at)


def test_app_filtro_por_cliente_e_ordenacao_no_painel():
    at = _app_exemplo()
    cliente = _local(at, "selectbox", "Filtrar por cliente")
    assert cliente.options[0] == "Todos os clientes" and "Vinhos Encosta Serena, Lda." in cliente.options
    cliente.set_value("Vinhos Encosta Serena, Lda.").run()
    assert "**2** de 18" in _mostrar(at) and not at.exception  # ENC-26-0049 e ENC-26-0053
    _local(at, "selectbox", "Ordenar por").set_value("Antiguidade").run()
    assert not at.exception and "**2** de 18" in _mostrar(at)


def test_app_filtros_do_painel_nao_afetam_os_outros_separadores():
    at = _app_exemplo()
    antes = _metricas(at)
    caption_encomendas = next(c.value for c in at.caption if c.value.startswith("A mostrar 60"))
    _local(at, "multiselect", "Prioridade").set_value(["Baixa"]).run()
    _local(at, "text_input", "Pesquisar exceções").set_value("ENC-26-0059").run()
    depois = _metricas(at)
    for rotulo in ("Encomendas", "Entregues", "Pendentes", "Atrasadas", "Linhas com erros",
                   "Entregas no prazo", "Tempo médio de entrega", "Entregas com atraso",
                   "Prioridade alta", "Encomendas com exceções"):
        assert depois[rotulo] == antes[rotulo], rotulo
    assert any(c.value == caption_encomendas for c in at.caption)
    assert "**2** de 18" in _mostrar(at)  # as duas ocorrências do número repetido


def test_app_filtros_globais_aplicam_se_ao_painel():
    at = _app_exemplo()
    next(t for t in at.text_input if t.label == "Pesquisar").set_value("Ferragens").run()
    separador = next(t.label for t in at.tabs if "Exceções" in t.label)
    m = _metricas(at)
    assert separador.endswith(f"Exceções ({m['Encomendas com exceções']})")
    assert int(m["Encomendas com exceções"]) < 18
    assert "**" in _mostrar(at) and not at.exception


def test_app_painel_sem_excecoes_mostra_estado_vazio_sem_exportacao():
    at = _app_exemplo()
    next(m for m in at.multiselect if m.label == "Estado").set_value(["Entregue"]).run()
    next(s for s in at.selectbox if s.label == "Validação").set_value("Sem erros").run()
    assert any("Não há exceções nas 35 encomendas apresentadas" in s.value for s in at.success)
    assert not any("exceções (.xlsx)" in b.proto.label for b in at.get("download_button"))
    assert next(t.label for t in at.tabs if "Exceções" in t.label).endswith("Exceções (0)")


def test_app_filtros_do_painel_sem_resultados():
    at = _app_exemplo()
    _local(at, "text_input", "Pesquisar exceções").set_value("não existe").run()
    assert any("Nenhuma exceção corresponde aos filtros do painel" in i.value for i in at.info)
    assert not any("exceções (.xlsx)" in b.proto.label for b in at.get("download_button"))
