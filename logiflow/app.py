"""LogiFlow — interface gráfica.

Para iniciar (na pasta logiflow):   streamlit run app.py

Este ficheiro só trata do ecrã. As regras (leitura, validação, indicadores e
exportação) estão no pacote ``logiflow/`` e têm testes automáticos.

Como funciona o Streamlit: sempre que o utilizador mexe num controlo, o script
é executado de novo de cima a baixo. Por isso, as operações mais pesadas
(ler e validar o ficheiro, gerar os Excel) ficam em cache.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import re
from pathlib import PurePath

import altair as alt
import pandas as pd
import streamlit as st

from logiflow import __version__
from logiflow import campos as C
from logiflow.exemplo import (
    DATA_REFERENCIA_EXEMPLO,
    FICHEIRO_EXEMPLO_CSV,
    FICHEIRO_EXEMPLO_XLSX,
)
from logiflow.exportacao import exportar_dados_limpos, exportar_relatorio
from logiflow.importacao import (
    TAMANHO_MAXIMO_MB,
    ErroImportacao,
    FicheiroLido,
    ler_ficheiro,
    listar_folhas,
)
from logiflow.indicadores import (
    COL_DIAS_ATRASO,
    COL_PRAZO,
    COL_SITUACAO,
    SIT_ATRASADA,
    SITUACOES,
    Indicadores,
    aplicar_prazos,
    calcular_indicadores,
)
from logiflow.validacao import (
    AVISO,
    COL_AVISOS,
    COL_ERROS,
    COL_LINHA,
    COL_TEM_ERRO,
    ERRO,
    ResultadoValidacao,
    validar,
)

NENHUMA = "(nenhuma)"
# Acima deste número de encomendas, os Excel só são gerados a pedido (podem demorar).
LIMITE_EXPORTACAO_IMEDIATA = 5_000
COR_BARRAS = "#2a78d6"
COR_TEXTO_SECUNDARIO = "#52514e"
VALIDACAO_ERRO, VALIDACAO_AVISO, VALIDACAO_OK = "✖ Erro", "⚠ Aviso", "✔ OK"


# Utilitários de apresentação ------------------------------------------------

def _n(valor: int) -> str:
    """Número com separador de milhares português: 12 345."""
    return f"{valor:,}".replace(",", " ")


def _pct(parte: int, total: int) -> str:
    if not total:
        return "—"
    return f"{parte / total * 100:.1f}".replace(".", ",") + "%"


def _md(texto: object) -> str:
    """Escapa texto vindo dos ficheiros antes de o mostrar em Markdown."""
    return re.sub(r"([\\`*_{}\[\]()#+\-.!|<>~$:])", r"\\\1", str(texto))


def _nome_seguro(nome: str) -> str:
    base = re.sub(r"[^\w\-]+", "_", PurePath(nome).stem, flags=re.UNICODE).strip("_")
    return (base or "encomendas")[:60]


# Leitura e processamento (em cache) -----------------------------------------

@st.cache_data(show_spinner="A ler o ficheiro…", max_entries=8)
def _carregar(nome: str, conteudo: bytes, folha: str | None) -> FicheiroLido:
    return ler_ficheiro(nome, conteudo, folha)


@st.cache_data(show_spinner=False, max_entries=8)
def _folhas(conteudo: bytes) -> list[str]:
    return listar_folhas(conteudo)


@st.cache_data(show_spinner="A validar as encomendas…", max_entries=8)
def _validar(_lido: FicheiroLido, assinatura: str, mapeamento: tuple, data_referencia: dt.date) -> ResultadoValidacao:
    return validar(_lido, dict(mapeamento), data_referencia)


@st.cache_data(show_spinner="A preparar o ficheiro de dados limpos…", max_entries=8)
def _excel_limpos(_resultado: ResultadoValidacao, chave: tuple, nome: str) -> bytes:
    return exportar_dados_limpos(_resultado, nome)


@st.cache_data(show_spinner="A preparar o relatório…", max_entries=8)
def _excel_relatorio(_resultado: ResultadoValidacao, _tabela: pd.DataFrame, _ind: Indicadores,
                     chave: tuple, nome: str, prazo_padrao: int | None) -> bytes:
    return exportar_relatorio(_resultado, _tabela, _ind, nome, prazo_padrao)


# Estado da sessão -------------------------------------------------------------

def _iniciar_estado() -> None:
    st.session_state.setdefault("usar_exemplo", False)
    st.session_state.setdefault("data_referencia", dt.date.today())
    st.session_state.setdefault("prazo_padrao", 0)


def _abrir_exemplo() -> None:
    st.session_state.usar_exemplo = True
    st.session_state.data_referencia = DATA_REFERENCIA_EXEMPLO


def _fechar_exemplo() -> None:
    st.session_state.usar_exemplo = False
    if st.session_state.data_referencia == DATA_REFERENCIA_EXEMPLO:
        st.session_state.data_referencia = dt.date.today()


def _ficheiro_alterado() -> None:
    _fechar_exemplo()


# Ecrãs ------------------------------------------------------------------------

def _estilo() -> None:
    # Os textos do carregador de ficheiros vêm do Streamlit em inglês ("Upload",
    # "20MB per file"); são substituídos aqui por texto em português.
    st.markdown(
        """
        <style>
          .block-container {padding-top: 2rem; padding-bottom: 2rem; max-width: 1500px;}
          [data-testid="stMetricValue"] {font-size: 2rem;}
          .lf-subtitulo {color: #52514e; margin-top: -0.6rem; margin-bottom: 1rem;}
          .lf-rodape {color: #6b6b67; font-size: 0.8rem;}
          [data-testid="stFileUploaderDropzone"] button [data-testid="stMarkdownContainer"] p {font-size: 0;}
          [data-testid="stFileUploaderDropzone"] button [data-testid="stMarkdownContainer"] p::after {
            content: "Escolher ficheiro"; font-size: 0.875rem;}
          [data-testid="stFileUploaderDropzoneInstructions"] span {font-size: 0;}
          [data-testid="stFileUploaderDropzoneInstructions"] span::after {
            content: "CSV ou XLSX · até TAMANHO MB"; font-size: 0.75rem;}
        </style>
        """.replace("TAMANHO", str(TAMANHO_MAXIMO_MB)),
        unsafe_allow_html=True,  # só CSS fixo escrito aqui; nunca conteúdo dos ficheiros
    )


def _cabecalho() -> None:
    st.title("LogiFlow")
    st.markdown(
        '<p class="lf-subtitulo">Gestor de Encomendas e Entregas — importe, valide e '
        "analise as encomendas da sua transportadora.</p>",
        unsafe_allow_html=True,
    )


def _boas_vindas() -> None:
    st.markdown("### Como começar")
    c1, c2, c3 = st.columns(3, border=True)
    c1.markdown("**1. Importar**  \nCarregue um ficheiro **CSV** ou **Excel (.xlsx)** na barra lateral "
                f"(até {TAMANHO_MAXIMO_MB} MB).")
    c2.markdown("**2. Rever**  \nA aplicação verifica colunas, campos vazios, números duplicados e datas "
                "inválidas, e calcula os indicadores.")
    c3.markdown("**3. Exportar**  \nDescarregue os dados limpos e um relatório em Excel, prontos a partilhar.")

    st.button("Experimentar com o ficheiro de exemplo", type="primary", icon=":material/play_arrow:",
              on_click=_abrir_exemplo, key="usar_exemplo_inicio")
    st.caption("O ficheiro de exemplo tem 60 encomendas fictícias, com alguns erros colocados de propósito.")

    st.markdown("### Colunas esperadas")
    linhas = []
    for campo in C.CAMPOS:
        exemplos = ", ".join(f"«{s}»" for s in campo.exemplos)
        linhas.append({
            "Coluna": campo.rotulo,
            "Obrigatória": "Sim" if campo.obrigatorio else "Não",
            "Para que serve": campo.descricao,
            "Também aceite como": exemplos,
        })
    st.dataframe(pd.DataFrame(linhas), hide_index=True, width="stretch",
                 column_config={"Para que serve": st.column_config.TextColumn(width="large")})
    st.caption("Maiúsculas, acentos e pontuação nos cabeçalhos são ignorados. Se um cabeçalho não for "
               "reconhecido, pode escolher a coluna certa depois de importar. Outras colunas são mantidas.")

    with st.expander("Descarregar o ficheiro de exemplo"):
        d1, d2 = st.columns(2)
        d1.download_button("Exemplo em Excel (.xlsx)", FICHEIRO_EXEMPLO_XLSX.read_bytes(),
                           file_name=FICHEIRO_EXEMPLO_XLSX.name, icon=":material/download:",
                           mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                           on_click="ignore")
        d2.download_button("Exemplo em CSV", FICHEIRO_EXEMPLO_CSV.read_bytes(),
                           file_name=FICHEIRO_EXEMPLO_CSV.name, icon=":material/download:",
                           mime="text/csv", on_click="ignore")


def _barra_lateral_ficheiro():
    st.sidebar.header("1. Ficheiro")
    enviado = st.sidebar.file_uploader(
        "Ficheiro de encomendas", type=["csv", "xlsx"], key="ficheiro",
        on_change=_ficheiro_alterado,
        help=f"CSV (separado por ; ou ,) ou Excel .xlsx, até {TAMANHO_MAXIMO_MB} MB. "
             "O ficheiro é processado neste computador e não é guardado.",
    )
    if enviado is None:
        if st.session_state.usar_exemplo:
            st.sidebar.info("A ver o **ficheiro de exemplo** (dados fictícios).", icon=":material/science:")
            st.sidebar.button("Fechar exemplo", on_click=_fechar_exemplo, icon=":material/close:")
        else:
            st.sidebar.button("Usar ficheiro de exemplo", on_click=_abrir_exemplo,
                              icon=":material/science:", key="usar_exemplo_lateral")
    return enviado


def _barra_lateral_regras(tem_data_prevista: bool) -> tuple[dt.date, int | None]:
    st.sidebar.header("2. Regras de prazo")
    data_referencia = st.sidebar.date_input(
        "Data de referência", key="data_referencia", format="DD/MM/YYYY",
        help="Data usada para decidir se uma encomenda pendente já passou o prazo. Normalmente é hoje.",
    )
    prazo = st.sidebar.number_input(
        "Prazo padrão de entrega (dias)", min_value=0, max_value=365, step=1, key="prazo_padrao",
        help="Usado apenas nas encomendas sem «Data Prevista»: prazo = data da encomenda + estes dias. "
             "Deixe 0 para não usar.",
    )
    if not tem_data_prevista and not prazo:
        st.sidebar.caption("O ficheiro não tem «Data Prevista». Para calcular atrasos, defina um prazo padrão.")
    if st.session_state.usar_exemplo and data_referencia == DATA_REFERENCIA_EXEMPLO:
        st.sidebar.caption("No exemplo, a data de referência é 20/10/2026 para a demonstração ser sempre igual.")
    return data_referencia, int(prazo) or None


def _escolher_colunas(lido: FicheiroLido, assinatura: str) -> dict[str, str | None] | None:
    """Mostra a correspondência de colunas. Devolve ``None`` se não for possível continuar."""
    automatico = C.detetar_colunas(lido.colunas)
    em_falta_auto = C.campos_em_falta(automatico)
    opcoes = [NENHUMA, *lido.colunas]
    mapeamento: dict[str, str | None] = {}
    with st.expander("Correspondência de colunas", expanded=bool(em_falta_auto), icon=":material/view_column:"):
        st.caption("Indique que coluna do ficheiro corresponde a cada campo. A deteção é automática, "
                   "mas pode corrigi-la aqui.")
        colunas_ecra = st.columns(4)
        for k, campo in enumerate(C.CAMPOS):
            sugestao = automatico.get(campo.nome)
            escolha = colunas_ecra[k % 4].selectbox(
                campo.rotulo + (" *" if campo.obrigatorio else " (opcional)"),
                opcoes, index=opcoes.index(sugestao) if sugestao else 0,
                key=f"mapa_{campo.nome}_{assinatura}", help=campo.descricao,
            )
            mapeamento[campo.nome] = None if escolha == NENHUMA else escolha
        st.caption("Os campos assinalados com \\* são obrigatórios.")

    em_falta = C.campos_em_falta(mapeamento)
    if em_falta:
        nomes = ", ".join(f"**{C.rotulo(c)}**" for c in em_falta)
        encontradas = ", ".join(f"«{_md(c)}»" for c in lido.colunas)
        dica = ""
        if len(lido.colunas) == 1:
            dica = ("\n\nSó foi encontrada uma coluna: o separador do CSV pode não ter sido reconhecido. "
                    "Use ponto e vírgula (;) ou vírgula (,).")
        st.error(
            f"**Faltam colunas obrigatórias:** {nomes}.\n\n"
            f"Colunas encontradas no ficheiro: {encontradas}.\n\n"
            "Abra «Correspondência de colunas» acima e escolha a coluna certa para cada campo, "
            "ou corrija o cabeçalho no ficheiro e importe-o de novo." + dica,
            icon=":material/error:",
        )
        return None
    repetidas = C.colunas_repetidas(mapeamento)
    if repetidas:
        for coluna, campos in repetidas.items():
            st.error(f"A coluna «{_md(coluna)}» foi escolhida para mais do que um campo: "
                     + ", ".join(C.rotulo(c) for c in campos) + ". Cada coluna só pode ser usada uma vez.",
                     icon=":material/error:")
        return None
    return mapeamento


def _resumo_ficheiro(lido: FicheiroLido, resultado: ResultadoValidacao | None, exemplo: bool) -> None:
    detalhes = [f"**{_md(lido.nome)}**", lido.formato]
    if lido.folha:
        detalhes.append(f"folha «{_md(lido.folha)}»")
    if lido.codificacao:
        detalhes.append(f"{lido.codificacao}, separador {lido.separador}")
    detalhes.append(f"{_n(lido.total_linhas)} encomendas lidas")
    if resultado is not None:
        detalhes.append(f"{_n(resultado.linhas_validas)} válidas")
        if resultado.linhas_com_erro:
            detalhes.append(f"{_n(resultado.linhas_com_erro)} com erros")
    icone = ":material/science:" if exemplo else ":material/description:"
    st.markdown(f"{icone} " + " · ".join(detalhes))
    if lido.avisos:
        with st.expander(f"Notas sobre a leitura do ficheiro ({len(lido.avisos)})", icon=":material/info:"):
            for aviso in lido.avisos:
                st.markdown(f"- {_md(aviso)}")


# Filtros ----------------------------------------------------------------------

_CHAVES_FILTRO = ("pesquisa", "estados", "periodo", "situacoes", "validacao")


def _limpar_filtros(assinatura: str) -> None:
    for chave in _CHAVES_FILTRO:
        st.session_state.pop(f"f_{chave}_{assinatura}", None)


def _filtros(tabela: pd.DataFrame, assinatura: str) -> tuple[pd.DataFrame, list[str]]:
    """Desenha a linha de filtros e devolve a tabela filtrada e notas a mostrar."""
    notas: list[str] = []
    estados = [e for e in C.ESTADOS_CANONICOS if (tabela[C.ESTADO] == e).any()]
    estados += sorted(e for e in tabela[C.ESTADO].unique() if e not in C.ESTADOS_CANONICOS and e)
    if (tabela[C.ESTADO] == "").any():
        estados.append("(sem estado)")
    datas_validas = tabela[C.DATA].dropna()

    # Filtros principais sempre visíveis; os restantes num painel "Mais filtros",
    # para a linha caber em ecrãs de portátil (1366 px).
    c1, c2, c3, c4 = st.columns([2.4, 2, 2.6, 1.4], vertical_alignment="bottom")
    pesquisa = c1.text_input("Pesquisar", placeholder="N.º, cliente ou destino",
                             key=f"f_pesquisa_{assinatura}", icon=":material/search:")
    escolhidos = c2.multiselect("Estado", estados, placeholder="Todos", key=f"f_estados_{assinatura}")
    periodo = None
    if not datas_validas.empty:
        minimo, maximo = datas_validas.min().date(), datas_validas.max().date()
        periodo = c3.date_input("Data da encomenda", value=(minimo, maximo), min_value=minimo,
                                max_value=maximo, format="DD/MM/YYYY", key=f"f_periodo_{assinatura}")
    else:
        c3.text_input("Data da encomenda", value="Sem datas válidas", disabled=True)

    chave_situacoes, chave_validacao = f"f_situacoes_{assinatura}", f"f_validacao_{assinatura}"
    ativos = bool(st.session_state.get(chave_situacoes)) + (st.session_state.get(chave_validacao, "Todas") != "Todas")
    with c4.popover(f"Mais filtros ({ativos})" if ativos else "Mais filtros",
                    icon=":material/tune:", width="stretch"):
        situacoes = st.multiselect("Situação face ao prazo",
                                   [s for s in SITUACOES if (tabela[COL_SITUACAO] == s).any()],
                                   placeholder="Todas", key=chave_situacoes)
        validacao = st.selectbox("Validação", ["Todas", "Com erros", "Com avisos", "Sem erros"],
                                 key=chave_validacao)
        st.button("Limpar todos os filtros", on_click=_limpar_filtros, args=(assinatura,),
                  icon=":material/filter_alt_off:", width="stretch")

    filtro = pd.Series(True, index=tabela.index)
    if pesquisa.strip():
        # Pesquisa por texto simples (sem expressões regulares), sem distinguir acentos nem maiúsculas.
        alvo = C.normalizar_texto(pesquisa)
        texto = (tabela[C.NUMERO] + " " + tabela[C.CLIENTE] + " " + tabela[C.DESTINO]).map(C.normalizar_texto)
        filtro &= texto.str.contains(alvo, regex=False)
    if escolhidos:
        estado = tabela[C.ESTADO].replace("", "(sem estado)")
        filtro &= estado.isin(escolhidos)
    if periodo and len(periodo) == 2 and (periodo[0], periodo[1]) != (minimo, maximo):
        inicio, fim = pd.Timestamp(periodo[0]), pd.Timestamp(periodo[1])
        sem_data = int(tabela[C.DATA].isna().sum())
        filtro &= tabela[C.DATA].between(inicio, fim)
        if sem_data:
            notas.append(f"{_n(sem_data)} encomenda(s) sem data válida ficam fora do filtro de datas.")
    if situacoes:
        filtro &= tabela[COL_SITUACAO].isin(situacoes)
    if validacao == "Com erros":
        filtro &= tabela[COL_TEM_ERRO]
    elif validacao == "Com avisos":
        filtro &= tabela[COL_AVISOS] != ""
    elif validacao == "Sem erros":
        filtro &= ~tabela[COL_TEM_ERRO]
    return tabela[filtro], notas


# Indicadores ------------------------------------------------------------------

def _indicadores(ind: Indicadores, total_ficheiro: int) -> None:
    c1, c2, c3, c4, c5 = st.columns(5)
    filtrado = ind.total != total_ficheiro
    c1.metric("Encomendas", _n(ind.total), border=True,
              delta=f"de {_n(total_ficheiro)} no ficheiro" if filtrado else "total no ficheiro",
              delta_color="off", delta_arrow="off",
              help="Linhas de encomenda importadas que correspondem aos filtros.")
    c2.metric("Entregues", _n(ind.entregues), border=True,
              delta=f"{_pct(ind.entregues, ind.total)} do total", delta_color="off", delta_arrow="off",
              help="Só conta como entregue uma encomenda com o estado «Entregue» no ficheiro.")
    c3.metric("Pendentes", _n(ind.pendentes), border=True,
              delta=f"{_pct(ind.pendentes, ind.total)} do total", delta_color="off", delta_arrow="off",
              help="Encomendas ainda por entregar: estados «Pendente» e «Em trânsito». "
                   "Não inclui canceladas nem devolvidas.")
    if ind.atrasadas is None:
        c4.metric("Atrasadas", "—", border=True, delta="sem datas para calcular", delta_color="off",
                  delta_arrow="off",
                  help="Não é possível determinar atrasos: falta a «Data Prevista» no ficheiro e não "
                       "foi definido um prazo padrão na barra lateral.")
    else:
        c4.metric("Atrasadas", _n(ind.atrasadas), border=True,
                  delta=f"de {_n(ind.pendentes)} pendentes", delta_color="off", delta_arrow="off",
                  help="Pendentes cujo prazo já passou na data de referência. Uma encomenda que vence "
                       "hoje ainda está no prazo.")
    c5.metric("Linhas com erros", _n(ind.com_erros), border=True,
              delta="a corrigir" if ind.com_erros else "nenhum erro",
              delta_color="off", delta_arrow="off",
              help="Linhas com campos obrigatórios vazios, números duplicados ou datas inválidas.")

    notas = []
    if ind.pendentes_sem_prazo and ind.atrasadas is not None:
        notas.append(f"{_n(ind.pendentes_sem_prazo)} pendente(s) sem dados de prazo não foram avaliadas quanto a atrasos.")
    sem_classificacao = ind.estado_nao_reconhecido + ind.sem_estado
    if sem_classificacao:
        notas.append(f"{_n(sem_classificacao)} encomenda(s) sem estado ou com estado não reconhecido não contam "
                     "como entregues nem como pendentes.")
    if ind.entregues_com_atraso:
        notas.append(f"{_n(ind.entregues_com_atraso)} encomenda(s) foram entregues depois do prazo.")
    for nota in notas:
        st.caption(nota)


# Separadores ------------------------------------------------------------------

def _tabela_ecra(tabela: pd.DataFrame, resultado: ResultadoValidacao, prazo_padrao: int | None) -> pd.DataFrame:
    presentes = resultado.campos_presentes
    tem_prazo = C.DATA_PREVISTA in presentes or bool(prazo_padrao)
    df = pd.DataFrame({
        "Linha": tabela[COL_LINHA],
        "Validação": [
            VALIDACAO_ERRO if erro else VALIDACAO_AVISO if aviso else VALIDACAO_OK
            for erro, aviso in zip(tabela[COL_TEM_ERRO], tabela[COL_AVISOS])
        ],
        "N.º Encomenda": tabela[C.NUMERO],
        "Cliente": tabela[C.CLIENTE],
        "Data": tabela[C.DATA],
        "Destino": tabela[C.DESTINO],
        "Estado": tabela[C.ESTADO],
        "Situação": tabela[COL_SITUACAO],
    })
    if tem_prazo:
        df["Dias de atraso"] = tabela[COL_DIAS_ATRASO]
    if C.DATA_PREVISTA in presentes:
        df["Data Prevista"] = tabela[C.DATA_PREVISTA]
    if prazo_padrao:
        df["Prazo"] = tabela[COL_PRAZO]
    if C.DATA_ENTREGA in presentes:
        df["Data de Entrega"] = tabela[C.DATA_ENTREGA]
    df["Problemas"] = [
        "; ".join(p for p in (e, a) if p) for e, a in zip(tabela[COL_ERROS], tabela[COL_AVISOS])
    ]
    for coluna in resultado.extras.columns:
        nome = coluna if coluna not in df.columns else f"{coluna} (ficheiro)"
        df[nome] = resultado.extras.loc[tabela.index, coluna]
    return df


_CONFIG_COLUNAS = {
    "Linha": st.column_config.NumberColumn("Linha", format="%d", width="small",
                                           help="Número da linha no ficheiro original"),
    "Data": st.column_config.DateColumn("Data", format="DD/MM/YYYY"),
    "Data Prevista": st.column_config.DateColumn("Data Prevista", format="DD/MM/YYYY"),
    "Data de Entrega": st.column_config.DateColumn("Data de Entrega", format="DD/MM/YYYY"),
    "Prazo": st.column_config.DateColumn("Prazo", format="DD/MM/YYYY",
                                         help="Data prevista ou, se não existir, data da encomenda + prazo padrão"),
    "Validação": st.column_config.TextColumn("Validação", width="small"),
    "Dias de atraso": st.column_config.NumberColumn("Dias de atraso", format="%d"),
    "Problemas": st.column_config.TextColumn("Problemas", width="large"),
}


def _separador_encomendas(tabela: pd.DataFrame, resultado: ResultadoValidacao, prazo_padrao: int | None) -> None:
    if tabela.empty:
        st.info("Nenhuma encomenda corresponde aos filtros escolhidos.", icon=":material/filter_alt:")
        return
    st.dataframe(_tabela_ecra(tabela, resultado, prazo_padrao), hide_index=True, width="stretch",
                 height=520, column_config=_CONFIG_COLUNAS, placeholder="—")
    st.caption(f"A mostrar {_n(len(tabela))} de {_n(resultado.total)} encomendas. "
               "Clique no título de uma coluna para ordenar.")


def _grafico_estados(ind: Indicadores) -> alt.Chart:
    dados = pd.DataFrame(
        [{"Estado": e, "Encomendas": n} for e, n in ind.por_estado.items()
         if n > 0 or e in C.ESTADOS_CANONICOS]
    )
    maximo = max(1, int(dados["Encomendas"].max()))
    base = alt.Chart(dados).encode(
        y=alt.Y("Estado:N", sort=list(dados["Estado"]), title=None,
                axis=alt.Axis(ticks=False, domain=False, labelLimit=220, labelFontSize=13)),
        x=alt.X("Encomendas:Q", title=None, axis=None, scale=alt.Scale(domain=[0, maximo * 1.15])),
        tooltip=[alt.Tooltip("Estado:N"), alt.Tooltip("Encomendas:Q", format="d")],
    )
    barras = base.mark_bar(color=COR_BARRAS, size=20, cornerRadiusEnd=4)
    valores = base.mark_text(align="left", dx=6, fontSize=13, color=COR_TEXTO_SECUNDARIO).encode(
        text=alt.Text("Encomendas:Q", format="d"))
    return (barras + valores).properties(height=36 * len(dados) + 10).configure_view(stroke=None)


def _separador_resumo(tabela: pd.DataFrame, ind: Indicadores) -> None:
    if tabela.empty:
        st.info("Nenhuma encomenda corresponde aos filtros escolhidos.", icon=":material/filter_alt:")
        return
    esquerda, direita = st.columns([3, 2], gap="large")
    with esquerda:
        st.markdown("##### Encomendas por estado")
        st.altair_chart(_grafico_estados(ind), width="stretch")
    with direita:
        st.markdown("##### Situação face ao prazo")
        contagem = tabela[COL_SITUACAO].value_counts()
        st.dataframe(
            pd.DataFrame([{"Situação": s, "Encomendas": int(contagem.get(s, 0)),
                           "% do total": _pct(int(contagem.get(s, 0)), len(tabela))}
                          for s in SITUACOES if contagem.get(s, 0)]),
            hide_index=True, width="stretch",
        )
    st.markdown("##### Encomendas atrasadas")
    atrasadas = tabela[tabela[COL_SITUACAO] == SIT_ATRASADA].sort_values(COL_DIAS_ATRASO, ascending=False)
    if ind.atrasadas is None:
        st.caption("Não é possível determinar atrasos sem «Data Prevista» ou prazo padrão.")
    elif atrasadas.empty:
        st.caption("Não há encomendas atrasadas.")
    else:
        st.dataframe(
            pd.DataFrame({
                "N.º Encomenda": atrasadas[C.NUMERO], "Cliente": atrasadas[C.CLIENTE],
                "Destino": atrasadas[C.DESTINO], "Estado": atrasadas[C.ESTADO],
                "Prazo": atrasadas[COL_PRAZO], "Dias de atraso": atrasadas[COL_DIAS_ATRASO],
            }),
            hide_index=True, width="stretch", column_config=_CONFIG_COLUNAS, placeholder="—",
        )


def _separador_qualidade(tabela: pd.DataFrame, resultado: ResultadoValidacao) -> None:
    problemas = resultado.problemas
    problemas = problemas[problemas["Linha"].isin(tabela[COL_LINHA])]
    if problemas.empty:
        st.success("Não foram encontrados problemas nas encomendas apresentadas.", icon=":material/check_circle:")
        return
    st.markdown(
        "**Erros** — a linha não entra nos dados limpos e é exportada à parte, com o motivo.  \n"
        "**Avisos** — a linha é aproveitada, mas convém confirmar."
    )
    contagem = (problemas.groupby(["Tipo", "Gravidade"]).size().unstack(fill_value=0)
                .reindex(columns=[ERRO, AVISO], fill_value=0).reset_index()
                .rename(columns={ERRO: "Erros", AVISO: "Avisos", "Tipo": "Tipo de problema"}))
    st.dataframe(contagem, hide_index=True, width="content")
    st.dataframe(problemas, hide_index=True, width="stretch", height=420,
                 column_config={"Linha": _CONFIG_COLUNAS["Linha"],
                                "Descrição": st.column_config.TextColumn("Descrição", width="large")})
    if len(tabela) != resultado.total:
        st.caption("Só são mostrados os problemas das encomendas que correspondem aos filtros.")


def _separador_exportar(resultado: ResultadoValidacao, tabela_completa: pd.DataFrame, nome: str,
                        assinatura: str, data_referencia: dt.date, prazo: int | None) -> None:
    st.caption("As exportações incluem **sempre todas as encomendas do ficheiro**, independentemente dos filtros.")
    base = _nome_seguro(nome)
    carimbo = dt.date.today().strftime("%Y%m%d")
    chave = (assinatura, tuple(sorted(resultado.mapeamento.items())), data_referencia, prazo)
    mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    # Ficheiros grandes: gerar só a pedido, para não bloquear a aplicação sem aviso.
    pedido = f"exportar_{assinatura}"
    preparar = resultado.total <= LIMITE_EXPORTACAO_IMEDIATA or st.session_state.get(pedido) == chave
    if not preparar:
        segundos = max(5, round(resultado.total / 100_000 * 40))
        st.info(f"Este ficheiro tem {_n(resultado.total)} encomendas. A preparação dos ficheiros Excel pode "
                f"demorar cerca de {segundos} segundos.", icon=":material/hourglass_top:")
        if st.button("Preparar ficheiros Excel", type="primary", icon=":material/build:"):
            st.session_state[pedido] = chave
            preparar = True
    if not preparar:
        return

    c1, c2 = st.columns(2, border=True)
    with c1:
        st.markdown("##### Dados limpos")
        st.markdown(
            f"- **Encomendas válidas** ({_n(resultado.linhas_validas)}): datas como datas, espaços retirados, "
            "estados uniformizados.\n"
            f"- **Linhas com erros** ({_n(resultado.linhas_com_erro)}): valores originais e motivo — "
            "nada é apagado.\n"
            "- **Informação**: origem e verificação dos totais."
        )
        try:
            dados = _excel_limpos(resultado, chave, nome)
        except Exception as erro:  # noqa: BLE001 — mostrar ao utilizador em vez de falhar em silêncio
            st.error(f"Não foi possível gerar o ficheiro: {type(erro).__name__}: {_md(erro)}")
        else:
            st.download_button("Descarregar dados limpos (.xlsx)", dados, file_name=f"{base}_dados_limpos_{carimbo}.xlsx",
                               mime=mime, type="primary", icon=":material/download:", on_click="ignore")
    with c2:
        st.markdown("##### Relatório")
        st.markdown(
            "- **Resumo**: indicadores, regra de prazo e qualidade dos dados.\n"
            "- **Por estado**, **Atrasadas** e **Problemas**.\n"
            "- **Todas as encomendas**, com a situação face ao prazo."
        )
        try:
            ind_total = calcular_indicadores(tabela_completa)
            dados = _excel_relatorio(resultado, tabela_completa, ind_total, chave, nome, prazo)
        except Exception as erro:  # noqa: BLE001
            st.error(f"Não foi possível gerar o relatório: {type(erro).__name__}: {_md(erro)}")
        else:
            st.download_button("Descarregar relatório (.xlsx)", dados, file_name=f"{base}_relatorio_{carimbo}.xlsx",
                               mime=mime, type="primary", icon=":material/download:", on_click="ignore")


# Programa principal -------------------------------------------------------------

def _obter_ficheiro(enviado) -> tuple[str, bytes] | None:
    if enviado is not None:
        return enviado.name, enviado.getvalue()
    if st.session_state.usar_exemplo:
        return FICHEIRO_EXEMPLO_XLSX.name, FICHEIRO_EXEMPLO_XLSX.read_bytes()
    return None


def main() -> None:
    _iniciar_estado()
    _estilo()
    _cabecalho()

    enviado = _barra_lateral_ficheiro()
    origem = _obter_ficheiro(enviado)
    if origem is None:
        _barra_lateral_regras(tem_data_prevista=True)
        _rodape()
        _boas_vindas()
        return
    nome, conteudo = origem

    folha = None
    try:
        if PurePath(nome).suffix.lower() == ".xlsx":
            folhas = _folhas(conteudo)
            if len(folhas) > 1:
                folha = st.sidebar.selectbox("Folha do Excel", folhas, key=f"folha_{hashlib.sha256(conteudo).hexdigest()[:12]}")
        lido = _carregar(nome, conteudo, folha)
    except ErroImportacao as erro:
        _barra_lateral_regras(tem_data_prevista=True)
        _rodape()
        st.error(f"**Não foi possível importar «{_md(nome)}».**\n\n{_md(erro)}", icon=":material/error:")
        return

    assinatura = hashlib.sha256(conteudo + (folha or "").encode()).hexdigest()[:12]
    exemplo = enviado is None
    topo = st.container()  # preenchido no fim, mas aparece acima da correspondência de colunas
    mapeamento = _escolher_colunas(lido, assinatura)
    data_referencia, prazo = _barra_lateral_regras(
        tem_data_prevista=bool(mapeamento and mapeamento.get(C.DATA_PREVISTA)))
    _rodape()
    if mapeamento is None:
        with topo:
            _resumo_ficheiro(lido, None, exemplo)
        return

    resultado = _validar(lido, assinatura, tuple(sorted(mapeamento.items())), data_referencia)
    tabela = aplicar_prazos(resultado.tabela, data_referencia, prazo)

    with topo:
        _resumo_ficheiro(lido, resultado, exemplo)
    filtrada, notas_filtro = _filtros(tabela, assinatura)
    for nota in notas_filtro:
        st.caption(nota)
    ind = calcular_indicadores(filtrada)
    _indicadores(ind, resultado.total)

    n_problemas = len(resultado.problemas)
    separadores = st.tabs([
        ":material/table_rows: Encomendas",
        ":material/bar_chart: Resumo",
        f":material/rule: Qualidade dos dados ({_n(n_problemas)})",
        ":material/download: Exportar",
    ])
    with separadores[0]:
        _separador_encomendas(filtrada, resultado, prazo)
    with separadores[1]:
        _separador_resumo(filtrada, ind)
    with separadores[2]:
        _separador_qualidade(filtrada, resultado)
    with separadores[3]:
        _separador_exportar(resultado, tabela, nome, assinatura, data_referencia, prazo)


def _rodape() -> None:
    st.sidebar.divider()
    st.sidebar.markdown(
        f'<p class="lf-rodape">LogiFlow {__version__} · Os ficheiros são processados neste computador '
        "e não são guardados nem enviados para a internet.</p>",
        unsafe_allow_html=True,
    )


st.set_page_config(
    page_title="LogiFlow — Encomendas e Entregas",
    page_icon="🚚",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={"About": "**LogiFlow** — Gestor de Encomendas e Entregas.\n\nDados processados localmente."},
)

try:
    main()
except Exception as erro:  # noqa: BLE001 — último recurso: nunca mostrar um ecrã em branco
    st.error(
        "**Ocorreu um erro inesperado.** Os seus ficheiros não foram alterados. "
        "Tente importar novamente; se o problema persistir, guarde esta mensagem para o suporte.\n\n"
        f"Detalhe técnico: {type(erro).__name__}: {_md(erro)}",
        icon=":material/error:",
    )
