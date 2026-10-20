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
import math
import re
from dataclasses import dataclass
from pathlib import Path, PurePath

import altair as alt
import pandas as pd
import streamlit as st

from logiflow import __version__, comparacao, copias
from logiflow import campos as C
from logiflow import desempenho as D
from logiflow import excecoes as E
from logiflow import historico as H
from logiflow import persistencia as P
from logiflow.exemplo import (
    DATA_REFERENCIA_EXEMPLO,
    FICHEIRO_EXEMPLO_CSV,
    FICHEIRO_EXEMPLO_DIA2_XLSX,
    FICHEIRO_EXEMPLO_XLSX,
)
from logiflow.exportacao import (
    exportar_dados_limpos,
    exportar_desempenho,
    exportar_excecoes,
    exportar_relatorio,
)
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
COR_BARRAS_SECUNDARIAS = "#a8a69e"  # períodos com poucas entregas avaliadas
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


def _texto_para_ficheiro(texto: str) -> str:
    """Texto livre (por exemplo, um nome de cliente) seguro para usar num nome de ficheiro."""
    return re.sub(r"[^\w\-]+", "_", texto, flags=re.UNICODE).strip("_")[:40] or "cliente"


def _dias(valor: float | None) -> str:
    """Dias com uma casa decimal e vírgula: 3,3."""
    return "—" if valor is None else f"{valor:.1f}".replace(".", ",")


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


@st.cache_data(show_spinner="A preparar o relatório de desempenho…", max_entries=16)
def _excel_desempenho(_resultado: ResultadoValidacao, _tabela: pd.DataFrame, chave: tuple, nome: str,
                      prazo_padrao: int | None, periodo: str, cliente: str | None) -> bytes:
    return exportar_desempenho(_resultado, _tabela, nome, prazo_padrao, periodo, cliente)


@st.cache_data(show_spinner="A preparar o Excel das exceções…", max_entries=16)
def _excel_excecoes(excecoes: pd.DataFrame, nome: str, data_referencia: dt.date, filtros: tuple) -> bytes:
    # O conteúdo da tabela entra na chave da cache: o ficheiro corresponde sempre ao que está visível.
    return exportar_excecoes(excecoes, nome, data_referencia, filtros)


@st.cache_data(show_spinner="A preparar o relatório…", max_entries=8)
def _excel_relatorio(_resultado: ResultadoValidacao, _tabela: pd.DataFrame, _ind: Indicadores,
                     chave: tuple, nome: str, prazo_padrao: int | None) -> bytes:
    return exportar_relatorio(_resultado, _tabela, _ind, nome, prazo_padrao)


# Estado da sessão -------------------------------------------------------------

def _iniciar_estado() -> None:
    st.session_state.setdefault("usar_exemplo", False)
    st.session_state.setdefault("data_referencia", dt.date.today())
    st.session_state.setdefault("prazo_padrao", 0)
    st.session_state.setdefault("periodo_desempenho", D.SEMANA)
    st.session_state.setdefault("comparar_desempenho", C.rotulo(C.CLIENTE))
    st.session_state.setdefault("guardar_historico", True)


def _abrir_exemplo() -> None:
    st.session_state.usar_exemplo = True
    st.session_state.data_referencia = DATA_REFERENCIA_EXEMPLO


def _fechar_exemplo() -> None:
    st.session_state.usar_exemplo = False
    if st.session_state.data_referencia == DATA_REFERENCIA_EXEMPLO:
        st.session_state.data_referencia = dt.date.today()


def _ficheiro_alterado() -> None:
    _fechar_exemplo()
    # Cada ficheiro carregado é uma nova importação: volta a verificar-se o histórico (o mesmo
    # conteúdo não é gravado duas vezes, mas a mensagem passa a dizer que já tinha sido importado).
    for chave in [c for c in st.session_state if str(c).startswith("historico_registo_")]:
        del st.session_state[chave]


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
        d1, d2, d3 = st.columns(3)
        d1.download_button("Exemplo em Excel (.xlsx)", FICHEIRO_EXEMPLO_XLSX.read_bytes(),
                           file_name=FICHEIRO_EXEMPLO_XLSX.name, icon=":material/download:",
                           mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                           on_click="ignore")
        d2.download_button("Exemplo em CSV", FICHEIRO_EXEMPLO_CSV.read_bytes(),
                           file_name=FICHEIRO_EXEMPLO_CSV.name, icon=":material/download:",
                           mime="text/csv", on_click="ignore")
        d3.download_button("Exemplo do dia seguinte (.xlsx)", FICHEIRO_EXEMPLO_DIA2_XLSX.read_bytes(),
                           file_name=FICHEIRO_EXEMPLO_DIA2_XLSX.name, icon=":material/download:",
                           mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                           on_click="ignore")
        st.caption("O «dia seguinte» é o mesmo ficheiro exportado um dia depois (entregas, mudanças de estado, "
                   "encomendas novas). Importe os dois Excel, um a seguir ao outro, para experimentar o "
                   "histórico e a comparação.")


def _barra_lateral_ficheiro():
    st.sidebar.header("1. Ficheiro")
    enviado = st.sidebar.file_uploader(
        "Ficheiro de encomendas", type=["csv", "xlsx"], key="ficheiro",
        on_change=_ficheiro_alterado,
        help=f"CSV (separado por ; ou ,) ou Excel .xlsx, até {TAMANHO_MAXIMO_MB} MB. "
             "O ficheiro é processado neste computador. O ficheiro original não é guardado; com a opção "
             "«Guardar importações no histórico» ligada, fica guardado neste computador um registo da importação.",
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
    detalhes.append(f"{_n(lido.total_linhas)} {'encomenda lida' if lido.total_linhas == 1 else 'encomendas lidas'}")
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


# Títulos curtos no ecrã (o Excel usa os nomes completos); a explicação fica na ajuda.
_CONFIG_DESEMPENHO = {
    D.TAXA: st.column_config.ProgressColumn("Taxa no prazo", format="percent", min_value=0, max_value=1,
                                            help="Entregues no prazo ÷ entregas avaliadas"),
    D.TEMPO_MEDIO: st.column_config.NumberColumn("Tempo médio", format="localized",
                                                 help="Tempo médio de entrega, em dias: data de entrega − "
                                                      "data da encomenda"),
    D.AVALIADAS: st.column_config.NumberColumn("Avaliadas",
                                               help="Entregas avaliadas: estado «Entregue», com data de "
                                                    "entrega e prazo"),
    D.ATRASADAS: st.column_config.NumberColumn("Atrasadas",
                                               help="Pendentes com o prazo ultrapassado. Vazio quando as "
                                                    "pendentes não têm prazo"),
    D.REGISTADAS: st.column_config.NumberColumn("Registadas", help="Encomendas registadas no período "
                                                                  "(pela data da encomenda)"),
    D.ENTREGAS: st.column_config.NumberColumn("Entregas", help="Entregas efetuadas no período "
                                                              "(pela data de entrega)"),
    D.OBSERVACAO: st.column_config.TextColumn("Observação", width="medium"),
}


def _grafico_taxa_periodo(por_periodo: pd.DataFrame) -> alt.Chart:
    avaliados = por_periodo[por_periodo[D.AVALIADAS] > 0]
    dados = pd.DataFrame({
        "periodo": avaliados[D.PERIODO],
        "taxa": avaliados[D.TAXA].astype(float),
        "no_prazo": avaliados[D.NO_PRAZO],
        "avaliadas": avaliados[D.AVALIADAS],
    })
    # Com poucas entregas, o rótulo diz quantas são (uma barra de 0 % nem se vê).
    dados["rotulo"] = [f"{t:.0%}" if n >= D.AMOSTRA_MINIMA else f"{t:.0%} (só {n})"
                       for t, n in zip(dados["taxa"], dados["avaliadas"])]
    base = alt.Chart(dados).encode(
        x=alt.X("periodo:N", sort=list(dados["periodo"]), title=None,
                axis=alt.Axis(labelAngle=0, ticks=False, domain=False, labelFontSize=12, labelLimit=160)),
        y=alt.Y("taxa:Q", title=None, scale=alt.Scale(domain=[0, 1.12]), axis=None),
        tooltip=[alt.Tooltip("periodo:N", title="Período"), alt.Tooltip("taxa:Q", title="Taxa no prazo", format=".1%"),
                 alt.Tooltip("no_prazo:Q", title="No prazo", format="d"),
                 alt.Tooltip("avaliadas:Q", title="Entregas avaliadas", format="d")],
    )
    # Períodos com poucas entregas avaliadas ficam a cinzento: são indicação, não conclusão.
    cor = alt.condition(alt.datum.avaliadas >= D.AMOSTRA_MINIMA, alt.value(COR_BARRAS),
                        alt.value(COR_BARRAS_SECUNDARIAS))
    barras = base.mark_bar(size=24, cornerRadiusEnd=4).encode(color=cor)
    valores = base.mark_text(baseline="bottom", dy=-4, fontSize=12, color=COR_TEXTO_SECUNDARIO).encode(
        text="rotulo:N")
    return (barras + valores).properties(height=220).configure_view(stroke=None)


def _separador_desempenho(tabela: pd.DataFrame, data_referencia: dt.date) -> str:
    """Desenha o separador e devolve o agrupamento por período escolhido (para a exportação)."""
    periodo = st.session_state.get("periodo_desempenho") or D.SEMANA
    r = D.resumir(tabela)
    if r.base == 0:
        st.info("Não há encomendas sem erros entre as apresentadas. O desempenho só é calculado com "
                "encomendas sem erros.", icon=":material/filter_alt:")
        return periodo
    nota_base = f"Calculado sobre **{_n(r.base)} {'encomenda' if r.base == 1 else 'encomendas'} sem erros**"
    if r.excluidas_com_erros:
        nota_base += (f"; {_n(r.excluidas_com_erros)} com erros "
                      f"{'fica' if r.excluidas_com_erros == 1 else 'ficam'} de fora até serem corrigidas")
    st.caption(nota_base + ". Os filtros acima também se aplicam.")

    c1, c2, c3 = st.columns(3)
    if r.taxa_no_prazo is None:
        c1.metric("Entregas no prazo", "—", border=True, delta="sem data de entrega e prazo",
                  delta_color="off", delta_arrow="off",
                  help="Só se avaliam entregas com o estado «Entregue», data de entrega e prazo "
                       "(data prevista ou prazo padrão).")
    else:
        c1.metric("Entregas no prazo", _pct(r.no_prazo, r.avaliadas), border=True,
                  delta=f"{_n(r.no_prazo)} de {_n(r.avaliadas)} entregas avaliadas",
                  delta_color="off", delta_arrow="off",
                  help="Entregues até ao prazo (inclusive) ÷ entregas com data de entrega e prazo.")
    c2.metric("Tempo médio de entrega", f"{_dias(r.tempo_medio_dias)} dias" if r.com_tempo else "—", border=True,
              delta=(f"mediana {_dias(r.tempo_mediano_dias)} dias · {_n(r.com_tempo)} entregas"
                     if r.com_tempo else "sem datas de entrega"),
              delta_color="off", delta_arrow="off", help="Data de entrega − data da encomenda.")
    c3.metric("Entregas com atraso", _n(r.com_atraso), border=True,
              delta=f"atraso médio {_dias(r.atraso_medio_dias)} dias" if r.com_atraso else "nenhuma",
              delta_color="off", delta_arrow="off", help="Entregues depois do prazo.")
    notas = []
    if r.amostra_pequena:
        notas.append(f"Só {r.avaliadas} entregas avaliadas: a taxa serve de indicação, não de conclusão.")
    if r.incoerentes:
        notas.append(f"{_n(r.incoerentes)} entrega(s) com data anterior à encomenda ficaram fora do tempo médio.")
    if r.entregues_sem_data:
        notas.append(f"{_n(r.entregues_sem_data)} entrega(s) sem data de entrega não entram no tempo médio "
                     "nem na evolução por período.")
    for nota in notas:
        st.caption(nota)

    st.markdown("##### Evolução por período")
    periodo = st.segmented_control("Agrupar por", D.PERIODOS, key="periodo_desempenho", required=True) or D.SEMANA
    por_periodo = D.por_periodo(tabela, periodo)
    if (por_periodo[D.AVALIADAS] > 0).any():
        st.altair_chart(_grafico_taxa_periodo(por_periodo), width="stretch")
        legenda = "Taxa de entregas no prazo, pela data de entrega. Passe o rato sobre as barras para ver " \
                  "quantas entregas foram avaliadas."
        if ((por_periodo[D.AVALIADAS] > 0) & (por_periodo[D.AVALIADAS] < D.AMOSTRA_MINIMA)).any():
            legenda += f" Barras a cinzento: menos de {D.AMOSTRA_MINIMA} entregas avaliadas (pouco fiável)."
        st.caption(legenda)
    st.dataframe(por_periodo.drop(columns=D.INICIO_PERIODO).round({D.TEMPO_MEDIO: 1}), hide_index=True,
                 width="stretch", column_config={D.PERIODO: st.column_config.TextColumn(periodo),
                                                 **_CONFIG_DESEMPENHO}, placeholder="—")
    st.caption("Encomendas registadas contam pela data da encomenda; entregas, pela data de entrega.")

    st.markdown("##### Comparação")
    campo = {C.rotulo(C.CLIENTE): C.CLIENTE, C.rotulo(C.DESTINO): C.DESTINO}
    escolha = st.segmented_control("Comparar por", list(campo), key="comparar_desempenho",
                                   required=True) or C.rotulo(C.CLIENTE)
    st.dataframe(D.por_grupo(tabela, campo[escolha]).round({D.TEMPO_MEDIO: 1}), hide_index=True,
                 width="stretch", column_config=_CONFIG_DESEMPENHO, placeholder="—")
    st.caption("Ordenado pelo número de encomendas. Escritas diferentes do mesmo nome (maiúsculas, acentos, "
               "pontuação) são agrupadas.")

    st.markdown("##### Pendentes por antiguidade")
    st.dataframe(D.antiguidade_pendentes(tabela, data_referencia), hide_index=True, width="content",
                 placeholder="—")
    st.caption(f"Dias desde a data da encomenda até à data de referência ({data_referencia:%d/%m/%Y}).")
    return periodo


_CONFIG_EXCECOES = {
    E.PRIORIDADE: st.column_config.TextColumn(E.PRIORIDADE, width="small",
                                              help="Alta: atrasada · Média: prazo próximo ou pendente há "
                                                   "demasiado tempo · Baixa: só qualidade de dados"),
    E.CATEGORIAS_COL: st.column_config.TextColumn(E.CATEGORIAS_COL, width=290),
    E.MOTIVOS: st.column_config.TextColumn(E.MOTIVOS, width=520),
    E.PRAZO: st.column_config.DateColumn(E.PRAZO, format="DD/MM/YYYY",
                                         help="Vazio quando o prazo não é conhecido"),
    E.ORIGEM_PRAZO: st.column_config.TextColumn(E.ORIGEM_PRAZO,
                                                help="«Data prevista» do ficheiro ou prazo calculado com o prazo padrão"),
    E.DIAS_ATRASO: st.column_config.NumberColumn(E.DIAS_ATRASO, format="%d"),
    E.DIAS_POR_ENTREGAR: st.column_config.NumberColumn(E.DIAS_POR_ENTREGAR, format="%d",
                                                       help="Desde a data da encomenda; só com data válida"),
    E.AVISOS: st.column_config.TextColumn(E.AVISOS, width="medium"),
    E.LINHA: st.column_config.NumberColumn(E.LINHA, format="%d", width="small",
                                           help="Número da linha no ficheiro original"),
}
_CHAVES_EXCECOES = ("pesquisa", "categorias", "prioridades", "cliente", "ordem")
TODOS_OS_CLIENTES = "Todos os clientes"


def _limpar_filtros_excecoes(assinatura: str) -> None:
    for chave in _CHAVES_EXCECOES:
        st.session_state.pop(f"exc_{chave}_{assinatura}", None)


def _separador_excecoes(todas: pd.DataFrame, apresentadas: int, nome: str, assinatura: str,
                        data_referencia: dt.date, filtros_topo: bool) -> None:
    """Painel de exceções. Os filtros daqui só afetam este painel e a sua exportação."""
    st.caption("Encomendas que precisam de intervenção, entre as apresentadas (os filtros do topo "
               "aplicam-se). Cada linha do ficheiro aparece uma só vez, com todos os motivos e a "
               "prioridade mais alta; uma encomenda pode estar em várias categorias.")
    if todas.empty:
        st.success(f"Não há exceções nas {_n(apresentadas)} encomendas apresentadas: nenhuma atrasada, "
                   "nenhuma a vencer hoje ou amanhã, nenhuma por entregar há "
                   f"{E.LIMITE_PENDENCIA_DIAS} ou mais dias e nenhum erro de dados.",
                   icon=":material/check_circle:")
        return

    totais = E.contagens(todas)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Prioridade alta", _n(totais["por_prioridade"][E.ALTA]), border=True, delta="atrasadas",
              delta_color="off", delta_arrow="off", help="Pendentes com o prazo já ultrapassado.")
    c2.metric("Prioridade média", _n(totais["por_prioridade"][E.MEDIA]), border=True,
              delta="prazo próximo ou pendência", delta_color="off", delta_arrow="off",
              help=f"Prazo hoje ou amanhã, ou por entregar há {E.LIMITE_PENDENCIA_DIAS} ou mais dias.")
    c3.metric("Prioridade baixa", _n(totais["por_prioridade"][E.BAIXA]), border=True,
              delta="só qualidade de dados", delta_color="off", delta_arrow="off",
              help="Erros de dados ou números repetidos, sem urgência operacional demonstrada.")
    c4.metric("Encomendas com exceções", _n(totais["encomendas"]), border=True,
              delta=f"de {_n(apresentadas)} apresentadas", delta_color="off", delta_arrow="off",
              help="Cada encomenda conta uma vez, mesmo que esteja em várias categorias.")

    with st.expander("Categorias e regras", icon=":material/info:"):
        st.dataframe(pd.DataFrame([{
            "Categoria": c, "Encomendas": totais["por_categoria"][c],
            "Prioridade": E.PRIORIDADE_DA_CATEGORIA[c], "Regra": E.REGRAS[c],
        } for c in E.CATEGORIAS]), hide_index=True, width="stretch",
            column_config={"Regra": st.column_config.TextColumn(width="large")})
        st.caption("Os totais por categoria não se somam: uma encomenda pode estar em várias. Encomendas "
                   "só com avisos (por exemplo, estado não reconhecido) não entram no painel; continuam em "
                   "«Qualidade dos dados».")

    chave = {k: f"exc_{k}_{assinatura}" for k in _CHAVES_EXCECOES}
    f1, f2, f3, f4, f5 = st.columns([2.0, 2.3, 2.0, 2.2, 2.0], vertical_alignment="bottom")
    pesquisa = f1.text_input("Pesquisar exceções", placeholder="N.º ou cliente", key=chave["pesquisa"],
                             icon=":material/search:")
    categorias = f2.multiselect("Categoria", E.CATEGORIAS, placeholder="Todas", key=chave["categorias"],
                                format_func=lambda c: f"{c} ({totais['por_categoria'][c]})")
    prioridades = f3.multiselect("Prioridade", E.PRIORIDADES, placeholder="Todas", key=chave["prioridades"])
    cliente = f4.selectbox("Filtrar por cliente", [TODOS_OS_CLIENTES, *E.clientes(todas)], key=chave["cliente"])
    ordem = f5.selectbox("Ordenar por", E.ORDENACOES, key=chave["ordem"],
                         help="Prioridade: Alta → Média → Baixa e, dentro de cada uma, mais dias de atraso e "
                              "mais dias por entregar primeiro. Antiguidade: mais dias por entregar primeiro.")
    cliente = None if cliente == TODOS_OS_CLIENTES else cliente

    visiveis = E.ordenar(E.filtrar(todas, pesquisa, categorias, prioridades, cliente), ordem)
    # A coluna vazia à direita evita que a barra de ferramentas da tabela tape o botão.
    resumo, limpar, _ = st.columns([5, 2, 1.3], vertical_alignment="center")
    resumo.caption(f"A mostrar **{_n(len(visiveis))}** de {_n(len(todas))} encomendas com exceções. "
                   "Estes filtros só afetam este painel e a sua exportação.")
    limpar.button("Limpar filtros do painel", on_click=_limpar_filtros_excecoes, args=(assinatura,),
                  icon=":material/filter_alt_off:", type="tertiary")
    if visiveis.empty:
        st.info("Nenhuma exceção corresponde aos filtros do painel.", icon=":material/filter_alt:")
        return
    st.dataframe(E.visiveis(visiveis), hide_index=True, width="stretch",
                 column_config=_CONFIG_EXCECOES, placeholder="—")

    # Exportação: exatamente as linhas visíveis, pela mesma ordem.
    filtros = (
        ("Filtros do topo aplicados", "Sim" if filtros_topo else "Não"),
        ("Pesquisa", pesquisa.strip() or "—"),
        ("Categorias", ", ".join(categorias) or "Todas"),
        ("Prioridades", ", ".join(prioridades) or "Todas"),
        ("Cliente", cliente or TODOS_OS_CLIENTES),
        ("Ordenação", ordem),
    )
    pedido = f"exportar_excecoes_{assinatura}"
    assinatura_vista = (tuple(visiveis[E.LINHA]), filtros, data_referencia)
    if len(visiveis) > LIMITE_EXPORTACAO_IMEDIATA and st.session_state.get(pedido) != assinatura_vista:
        if not st.button(f"Preparar Excel das {_n(len(visiveis))} exceções", icon=":material/build:"):
            return
        st.session_state[pedido] = assinatura_vista
    try:
        dados = _excel_excecoes(visiveis, nome, data_referencia, filtros)
    except Exception as erro:  # noqa: BLE001
        st.error(f"Não foi possível gerar o Excel das exceções: {type(erro).__name__}: {_md(erro)}")
        return
    sufixo = _texto_para_ficheiro(cliente) if cliente else ("filtradas" if len(visiveis) < len(todas) else "todas")
    st.download_button(f"Descarregar estas {_n(len(visiveis))} exceções (.xlsx)", dados,
                       file_name=f"{_nome_seguro(nome)}_excecoes_{sufixo}_{dt.date.today():%Y%m%d}.xlsx",
                       mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                       type="primary", icon=":material/download:", on_click="ignore")


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
                        assinatura: str, data_referencia: dt.date, prazo: int | None, periodo: str) -> None:
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

    with st.container(border=True):
        st.markdown("##### Relatório de desempenho")
        descricao, opcoes = st.columns([3, 2], gap="large")
        descricao.markdown(
            "- **Resumo**: taxa de entregas no prazo, tempo médio de entrega e atrasos, com a regra usada.\n"
            f"- **Por período** (agrupado por **{periodo.lower()}**, como no separador «Desempenho»), "
            "**por cliente** e **por destino**.\n"
            "- **Pendentes por antiguidade** e a lista de **entregas com atraso**.\n\n"
            "Usa só as encomendas sem erros. Escolha um cliente para gerar um relatório **só com as "
            "encomendas dele**, que pode enviar-lhe."
        )
        todos = "Todos os clientes"
        cliente = opcoes.selectbox("Âmbito do relatório", [todos, *D.clientes(tabela_completa)],
                                   key=f"ambito_desempenho_{assinatura}")
        cliente = None if cliente == todos else cliente
        try:
            dados = _excel_desempenho(resultado, tabela_completa, chave, nome, prazo, periodo, cliente)
        except Exception as erro:  # noqa: BLE001
            opcoes.error(f"Não foi possível gerar o relatório de desempenho: {type(erro).__name__}: {_md(erro)}")
        else:
            sufixo = "todos" if cliente is None else _texto_para_ficheiro(cliente)
            opcoes.download_button("Descarregar relatório de desempenho (.xlsx)", dados,
                                   file_name=f"{base}_desempenho_{sufixo}_{carimbo}.xlsx", mime=mime,
                                   type="primary", icon=":material/download:", on_click="ignore")


# Histórico (versão 1.3) ------------------------------------------------------------
# A base de dados é verificada (e criada ou atualizada) uma vez por sessão, ao abrir a
# aplicação. Qualquer problema com o histórico é mostrado no separador «Histórico» e
# nunca impede o resto da aplicação de funcionar.

POR_PAGINA_HISTORICO = 50
LIMITE_LINHAS_HISTORICO = 5_000  # linhas mostradas de uma vez (encomendas guardadas e comparações)
ROTULOS_ORIGEM = {H.ORIGEM_FICHEIRO: "Ficheiro", H.ORIGEM_EXEMPLO: "Exemplo"}


@dataclass(frozen=True)
class _Historico:
    caminho: Path | None
    info: P.InfoBaseDados | None
    erro: str | None

    @property
    def disponivel(self) -> bool:
        return self.info is not None


def _historico() -> _Historico:
    try:
        caminho = P.caminho_base_dados()
    except P.ErroPersistencia as erro:
        return _Historico(None, None, str(erro))
    preparada = st.session_state.get("hist_base_preparada")
    if preparada is None or preparada[0] != str(caminho):
        try:
            with st.spinner("A preparar o histórico…"):
                preparada = (str(caminho), P.preparar_base_dados(caminho))
        except Exception as erro:  # noqa: BLE001 — sem histórico, o resto da aplicação continua a funcionar
            return _Historico(caminho, None, P.mensagem_segura(erro))  # volta a tentar na próxima interação
        st.session_state.hist_base_preparada = preparada
    return _Historico(caminho, preparada[1], None)


def _barra_lateral_historico() -> None:
    st.sidebar.header("3. Histórico")
    st.sidebar.toggle(
        "Guardar importações no histórico", key="guardar_historico",
        help="Guarda neste computador um registo de cada ficheiro importado (nome, data, totais) e os sete "
             "campos de cada encomenda, para consultar e comparar no separador «Histórico». O ficheiro "
             "original e as outras colunas não são guardados. O ficheiro de exemplo só é guardado a pedido.",
    )


def _chave_registo(conteudo: bytes, lido: FicheiroLido, mapeamento: dict[str, str | None]) -> str:
    return f"historico_registo_{H.impressao_digital(H.hash_conteudo(conteudo), lido.folha, mapeamento)}"


def _gravar_importacao(hist: _Historico, chave: str, origem: str, nome: str, conteudo: bytes, lido: FicheiroLido,
                       mapeamento: dict[str, str | None], resultado: ResultadoValidacao, tabela: pd.DataFrame,
                       data_referencia: dt.date, prazo: int | None) -> H.ResultadoRegisto:
    """Grava a importação e guarda o resultado na sessão (para não gravar de novo a cada interação)."""
    try:
        dados = H.preparar_dados(nome, conteudo, lido.folha, mapeamento, resultado, tabela, data_referencia,
                                 prazo, origem)
        registo = H.registar_importacao(hist.caminho, dados)
    except Exception as erro:  # noqa: BLE001 — comunicado ao utilizador, nunca ignorado
        registo = H.ResultadoRegisto(H.FALHOU, None, None,
                                     f"Não foi possível guardar no histórico: {P.mensagem_segura(erro)}")
    st.session_state[chave] = registo
    return registo


def _mensagem_registo(hist: _Historico, exemplo: bool, chave: str) -> None:
    registo = st.session_state.get(chave)
    if registo is not None and registo.situacao == H.FALHOU:
        st.warning(_md(registo.mensagem) + " O resto da aplicação continua a funcionar normalmente.",
                   icon=":material/warning:")
        st.button("Tentar guardar de novo", on_click=st.session_state.pop, args=(chave, None),
                  icon=":material/refresh:", key="hist_tentar_de_novo")
    elif registo is not None and registo.estado == H.EM_PROCESSAMENTO:
        st.caption(f":material/history: {_md(registo.mensagem)}")
        st.button("Verificar de novo", on_click=st.session_state.pop, args=(chave, None),
                  icon=":material/refresh:", key="hist_tentar_de_novo")
    elif registo is not None:
        st.caption(f":material/history: {_md(registo.mensagem)}")
    elif chave in st.session_state:  # depois de recuperar uma cópia, o ficheiro aberto não é gravado sozinho
        st.caption(":material/history: Foi recuperada uma cópia de segurança: este ficheiro não foi gravado "
                   "outra vez no histórico.")
        st.button("Guardar este ficheiro no histórico", on_click=st.session_state.pop, args=(chave, None),
                  icon=":material/save:", key="hist_guardar_depois_de_recuperar")
    elif exemplo:
        st.caption(":material/history: O ficheiro de exemplo não é guardado automaticamente no histórico "
                   "(pode guardá-lo no separador «Histórico»).")
    elif not st.session_state.guardar_historico:
        st.caption(":material/history_toggle_off: Esta importação não foi guardada no histórico "
                   "(opção desligada na barra lateral).")
    elif not hist.disponivel:
        st.warning(f"O histórico não está disponível, por isso esta importação não foi guardada: {_md(hist.erro)}",
                   icon=":material/warning:")


def _registar_falha_leitura(hist: _Historico, nome: str, conteudo: bytes, folha: str | None,
                            erro: ErroImportacao) -> None:
    if not (st.session_state.guardar_historico and hist.disponivel):
        return
    chave = f"historico_falha_{H.hash_conteudo(conteudo + (folha or '').encode())}"
    if chave not in st.session_state:
        try:
            st.session_state[chave] = H.registar_falha_leitura(hist.caminho, nome, conteudo, folha, erro).mensagem
        except Exception as falha:  # noqa: BLE001
            st.session_state[chave] = f"Não foi possível registar a falha no histórico: {P.mensagem_segura(falha)}"
    st.caption(f":material/history: {_md(st.session_state[chave])}")


def _data_iso(valor: object) -> str:
    return dt.date.fromisoformat(valor).strftime("%d/%m/%Y") if isinstance(valor, str) and valor else "—"


def _inteiros(serie: pd.Series) -> list[str]:
    """Contagens para mostrar: 12 345, ou — quando não há valor (por exemplo, numa importação falhada)."""
    return ["—" if pd.isna(v) else _n(int(v)) for v in pd.to_numeric(serie, errors="coerce")]


def _tabela_historico(lista: pd.DataFrame) -> pd.DataFrame:
    excecoes = [
        "—" if pd.isna(a) else f"{int(a)} / {int(m)} / {int(b)}"
        for a, m, b in zip(lista["exc_alta"], lista["exc_media"], lista["exc_baixa"])
    ]
    return pd.DataFrame({
        "N.º": lista["id"].astype(int),
        "Importada em": lista["iniciada_em"].map(H.formatar_momento),
        "Ficheiro": lista["nome_ficheiro"],
        "Origem": lista["origem"].map(ROTULOS_ORIGEM),
        "Estado": lista["estado"].map(H.ROTULOS_ESTADO),
        "Linhas": _inteiros(lista["linhas_lidas"]),
        "Válidas": _inteiros(lista["encomendas_validas"]),
        "Com erros": _inteiros(lista["linhas_com_erros"]),
        "Com avisos": _inteiros(lista["linhas_com_avisos"]),
        "Entregues": _inteiros(lista["ind_entregues"]),
        "Pendentes": _inteiros(lista["ind_pendentes"]),
        "Atrasadas": _inteiros(lista["ind_atrasadas"]),
        "Exceções (alta / média / baixa)": excecoes,
        "Data de referência": lista["data_referencia"].map(_data_iso),
    })


def _primeira_pagina() -> None:
    st.session_state.hist_pagina = 1


def _lista_historico(caminho: Path) -> dict[int, str]:
    """Lista paginada com filtros próprios. Devolve as importações mostradas na página (n.º → nome)."""
    st.markdown("#### Importações guardadas")
    c1, c2, c3 = st.columns([2.4, 2.4, 2], vertical_alignment="bottom")
    pesquisa = c1.text_input("Pesquisar no histórico", placeholder="Nome do ficheiro", key="hist_pesquisa",
                             icon=":material/search:", on_change=_primeira_pagina)
    estados = c2.multiselect("Estado da importação", list(H.ROTULOS_ESTADO), format_func=H.ROTULOS_ESTADO.get,
                             placeholder="Todos", key="hist_estados", on_change=_primeira_pagina)
    periodo = c3.date_input("Importadas entre", value=(), format="DD/MM/YYYY", key="hist_periodo",
                            on_change=_primeira_pagina)
    inicio = periodo[0] if len(periodo) >= 1 else None
    fim = periodo[1] if len(periodo) == 2 else None

    pagina = int(st.session_state.get("hist_pagina", 1))
    lista, total = H.listar_importacoes(caminho, pesquisa, estados, inicio, fim, POR_PAGINA_HISTORICO,
                                        (pagina - 1) * POR_PAGINA_HISTORICO)
    paginas = max(1, math.ceil(total / POR_PAGINA_HISTORICO))
    if pagina > paginas:  # os filtros mudaram e a página deixou de existir
        pagina = st.session_state.hist_pagina = paginas
        lista, total = H.listar_importacoes(caminho, pesquisa, estados, inicio, fim, POR_PAGINA_HISTORICO,
                                            (pagina - 1) * POR_PAGINA_HISTORICO)
    if total == 0:
        filtrado = bool(pesquisa.strip() or estados or periodo)
        st.info("Nenhuma importação corresponde a estes filtros." if filtrado else
                "Ainda não há importações guardadas. Importe um ficheiro com a opção «Guardar importações no "
                "histórico» ligada (barra lateral).", icon=":material/history:")
        return {}
    st.dataframe(_tabela_historico(lista), hide_index=True, width="stretch")
    p1, p2 = st.columns([1, 4], vertical_alignment="bottom")
    p1.number_input("Página do histórico", min_value=1, max_value=paginas, step=1, key="hist_pagina")
    p2.caption(f"{_n(total)} importação(ões) · página {pagina} de {paginas} · {POR_PAGINA_HISTORICO} por página, "
               "das mais recentes para as mais antigas. Os totais são os do momento da importação, com as "
               "regras de prazo então em vigor.")
    return dict(zip(lista["id"].astype(int), lista["nome_ficheiro"]))


def _detalhe_importacao(caminho: Path, mostradas: dict[int, str]) -> None:
    if not mostradas:
        return
    ids = list(mostradas)
    # Por omissão mostra a mais recente da página (também quando chega uma importação nova). O valor
    # é definido explicitamente (e não apagado) para o navegador mostrar a mesma escolha.
    if st.session_state.get("hist_detalhe_topo") != ids[0] or st.session_state.get("hist_detalhe") not in ids:
        st.session_state.hist_detalhe = ids[0]
    st.session_state.hist_detalhe_topo = ids[0]
    escolhido = st.selectbox("Importação a consultar", ids, format_func=lambda i: f"N.º {i} — {mostradas[i]}",
                             key="hist_detalhe")
    imp = H.obter_importacao(caminho, escolhido)
    if imp is None:
        st.caption("Esta importação já não existe no histórico.")
        return
    linhas = [
        f"**Estado:** {H.ROTULOS_ESTADO.get(imp['estado'], imp['estado'])} · importada em "
        f"{H.formatar_momento(imp['iniciada_em'])} · concluída em {H.formatar_momento(imp['concluida_em'])}",
        f"**Ficheiro:** {_md(imp['nome_ficheiro'])} ({ROTULOS_ORIGEM.get(imp['origem'], imp['origem'])}, "
        f"{_n(max(1, round((imp['tamanho_bytes'] or 0) / 1024)))} KB"
        + (f", folha «{_md(imp['folha'])}»" if isinstance(imp["folha"], str) and imp["folha"] else "") + ")",
        f"**Regras usadas:** data de referência {_data_iso(imp['data_referencia'])}; prazo padrão "
        + (f"{int(imp['prazo_padrao_dias'])} dia(s)" if pd.notna(imp["prazo_padrao_dias"]) else "não usado"),
        f"**Identificação do conteúdo:** {str(imp['hash_conteudo'])[:16]}… (SHA-256) · LogiFlow "
        f"{_md(imp['versao_aplicacao'])}",
    ]
    anterior = int(imp["importacao_anterior_id"]) if pd.notna(imp["importacao_anterior_id"]) else None
    if anterior is not None:
        linhas.append(f"**Importação anterior concluída:** n.º {anterior}")
    st.markdown("  \n".join(linhas))
    if anterior is not None and imp["estado"] in H.ESTADOS_CONCLUIDOS:
        st.button(f"Comparar com a importação anterior (n.º {anterior})", on_click=_comparar_com_anterior,
                  args=(caminho, anterior, escolhido), icon=":material/compare_arrows:", key="hist_comparar_anterior")
    if isinstance(imp["mensagem_erro"], str) and imp["mensagem_erro"]:
        st.warning(_md(imp["mensagem_erro"]), icon=":material/warning:")
    mapeamento = H.campos_presentes(imp)
    if imp["estado"] not in H.ESTADOS_CONCLUIDOS:
        return
    if st.toggle("Mostrar as encomendas guardadas nesta importação", key="hist_mostrar_fotografia"):
        guardadas = H.carregar_fotografia(caminho, escolhido, limite=LIMITE_LINHAS_HISTORICO)
        dados = {"Linha": guardadas["linha"], "N.º Encomenda": guardadas["numero"], "Cliente": guardadas["cliente"]}
        dados["Data"] = [H.descrever_data(i, o) for i, o in zip(guardadas["data"], guardadas["data_original"])]
        dados["Destino"], dados["Estado"] = guardadas["destino"], guardadas["estado"]
        for campo, coluna in ((C.DATA_PREVISTA, "data_prevista"), (C.DATA_ENTREGA, "data_entrega")):
            if campo in mapeamento:
                dados[C.rotulo(campo)] = [H.descrever_data(i, o)
                                          for i, o in zip(guardadas[coluna], guardadas[f"{coluna}_original"])]
        dados["Erros"], dados["Avisos"] = guardadas["erros"], guardadas["avisos"]
        st.dataframe(pd.DataFrame(dados), hide_index=True, width="stretch")
        total = int(imp["linhas_lidas"] or 0)
        if total > LIMITE_LINHAS_HISTORICO:
            st.caption(f"Mostradas as primeiras {_n(LIMITE_LINHAS_HISTORICO)} de {_n(total)} linhas.")


def _comparar_com_anterior(caminho: Path, anterior: int, atual: int) -> None:
    st.session_state.hist_cmp_anterior, st.session_state.hist_cmp_atual = anterior, atual
    escolha = (min(anterior, atual), max(anterior, atual))
    st.session_state.historico_comparacao = (escolha, comparacao.comparar_importacoes(caminho, *escolha))


def _comparacao_historico(caminho: Path) -> None:
    st.markdown("#### Comparar duas importações")
    concluidas = H.importacoes_concluidas(caminho)
    if len(concluidas) < 2:
        st.caption("São precisas pelo menos duas importações concluídas para comparar.")
        return
    ids = concluidas["id"].astype(int).tolist()
    rotulos = {int(r.id): f"N.º {int(r.id)} — {r.nome_ficheiro} — {H.formatar_momento(r.iniciada_em)}"
               for r in concluidas.itertuples()}
    for chave, predefinida in (("hist_cmp_atual", ids[0]), ("hist_cmp_anterior", ids[1])):
        if st.session_state.get(chave) not in ids:
            st.session_state[chave] = predefinida
    c1, c2, c3 = st.columns([3, 3, 1.6], vertical_alignment="bottom")
    anterior = c1.selectbox("Importação anterior", ids, format_func=rotulos.get, key="hist_cmp_anterior")
    atual = c2.selectbox("Importação atual", ids, format_func=rotulos.get, key="hist_cmp_atual")
    escolha = tuple(sorted((anterior, atual)))
    if c3.button("Comparar importações", type="primary", disabled=anterior == atual, key="hist_comparar",
                 icon=":material/compare_arrows:", width="stretch"):
        with st.spinner("A comparar…"):
            st.session_state.historico_comparacao = (escolha, comparacao.comparar_importacoes(caminho, *escolha))
    if anterior == atual:
        st.caption("Escolha duas importações diferentes.")
        return
    if anterior > atual:
        st.caption("A importação de n.º mais baixo é sempre tratada como a anterior.")
    guardada = st.session_state.get("historico_comparacao")
    if guardada is None or guardada[0] != escolha:
        st.caption("Carregue em «Comparar importações» para ver as diferenças.")
        return
    resultado: comparacao.ResultadoComparacao = guardada[1]
    if not resultado.disponivel:
        st.warning(_md(resultado.motivo), icon=":material/warning:")
    else:
        st.markdown(" · ".join(f"{categoria}: **{_n(resultado.contagens[categoria])}**"
                               for categoria in comparacao.CATEGORIAS))
        for aviso in resultado.avisos:
            (st.warning if resultado.parcial else st.caption)(_md(aviso))
        st.caption("Compara-se pelo n.º de encomenda (maiúsculas e espaços nas pontas não contam). Campos "
                   "comparados: " + ", ".join(C.rotulo(c) for c in resultado.campos_comparados) + ". "
                   "«Não encontrada na importação atual» quer dizer só que o n.º não aparece no ficheiro mais "
                   "recente — não quer dizer que a encomenda foi entregue nem cancelada.")
        situacoes = st.multiselect("Situações a mostrar", list(comparacao.CATEGORIAS), placeholder="Todas",
                                   key="hist_cmp_situacoes")
        tabela = resultado.tabela
        if situacoes:
            tabela = tabela[tabela["Situação"].isin(situacoes)]
        visiveis = tabela.head(LIMITE_LINHAS_HISTORICO)
        visiveis = visiveis.assign(**{c: _inteiros(visiveis[c]) for c in ("Linha (anterior)", "Linha (atual)")})
        st.dataframe(visiveis, hide_index=True, width="stretch",
                     column_config={"Alterações": st.column_config.TextColumn(width="large")})
        if len(tabela) > LIMITE_LINHAS_HISTORICO:
            st.caption(f"Mostradas as primeiras {_n(LIMITE_LINHAS_HISTORICO)} de {_n(len(tabela))} linhas; "
                       "escolha as situações a mostrar para ver as restantes.")
    fora = len(resultado.excluidas_anterior) + len(resultado.excluidas_atual)
    if fora:
        with st.expander(f"Linhas fora da comparação ({_n(fora)})", icon=":material/link_off:"):
            st.caption("Linhas sem n.º de encomenda, ou com um n.º repetido, não podem ser emparelhadas com "
                       "segurança e não entram nos totais acima.")
            e1, e2 = st.columns(2)
            e1.markdown("**Importação anterior**")
            e1.dataframe(resultado.excluidas_anterior, hide_index=True, width="stretch")
            e2.markdown("**Importação atual**")
            e2.dataframe(resultado.excluidas_atual, hide_index=True, width="stretch")


def _apos_recuperacao() -> None:
    """Depois de recuperar uma cópia, os resultados guardados na sessão deixam de valer."""
    st.session_state.pop("hist_base_preparada", None)
    for chave in list(st.session_state):
        if chave.startswith("historico_registo_"):
            st.session_state[chave] = None  # não volta a gravar automaticamente o ficheiro aberto
    if st.session_state.get("hist_chave_atual"):
        st.session_state[st.session_state.hist_chave_atual] = None
    st.session_state.pop("historico_comparacao", None)
    st.session_state.pop("hist_detalhe_topo", None)  # os detalhes voltam à importação mais recente
    st.session_state.hist_pagina = 1
    st.session_state.hist_confirmar_recuperacao = False


def _criar_copia(caminho_db: Path, pasta: Path) -> None:
    try:
        info = copias.criar_copia(caminho_db, pasta)
    except Exception as erro:  # noqa: BLE001
        st.session_state.hist_aviso = ("erro", f"A cópia não foi criada. {P.mensagem_segura(erro)}")
    else:
        st.session_state.hist_aviso = ("ok", f"Cópia criada e verificada: «{info.caminho.name}». {info.mensagem}")


def _recuperar_copia(caminho_db: Path, copia: Path) -> None:
    try:
        resultado = copias.restaurar_copia(caminho_db, copia)
    except Exception as erro:  # noqa: BLE001
        st.session_state.hist_aviso = ("erro", f"A recuperação não foi feita. {P.mensagem_segura(erro)}")
        st.session_state.hist_confirmar_recuperacao = False
    else:
        _apos_recuperacao()
        st.session_state.hist_aviso = ("ok", resultado.mensagem)


def _guardar_exemplo(hist: _Historico, chave: str, contexto: dict) -> None:
    registo = _gravar_importacao(hist, chave, H.ORIGEM_EXEMPLO, **contexto)
    st.session_state.hist_aviso = ("erro" if registo.situacao == H.FALHOU else "ok", registo.mensagem)


def _secao_copias(hist: _Historico) -> None:
    st.markdown("#### Cópias de segurança")
    predefinida = copias.pasta_copias_predefinida(hist.caminho)
    st.session_state.setdefault("hist_pasta_copias", str(predefinida))
    texto = st.text_input(
        "Pasta das cópias de segurança", key="hist_pasta_copias",
        help="Caminho completo de uma pasta que já exista. Por omissão, a pasta «copias» junto do histórico.")
    st.caption("Recomendação: guarde também cópias noutro disco ou numa pen USB — uma cópia no mesmo disco não "
               "protege contra avarias do disco. Uma cópia nunca substitui um ficheiro existente.")
    try:
        if Path(texto.strip()) == predefinida:
            P.criar_pasta(predefinida)
        pasta = copias.validar_pasta_destino(texto)
    except (P.ErroPersistencia, OSError) as erro:
        st.warning(P.mensagem_segura(erro), icon=":material/warning:")
        return
    st.button("Criar cópia de segurança agora", on_click=_criar_copia, args=(hist.caminho, pasta),
              disabled=not hist.disponivel, icon=":material/backup:", key="hist_criar_copia")

    disponiveis = {p.name: p for p in copias.listar_copias(pasta)}
    if not disponiveis:
        st.caption("Ainda não há cópias do LogiFlow nesta pasta.")
        return
    if st.session_state.get("hist_copia") not in disponiveis:
        st.session_state.hist_copia = next(iter(disponiveis))
    nome = st.selectbox("Cópia de segurança", list(disponiveis),
                        format_func=lambda n: copias.descrever_copia(disponiveis[n]), key="hist_copia")
    escolhida = disponiveis[nome]
    if st.button("Verificar a cópia escolhida", icon=":material/fact_check:", key="hist_verificar_copia"):
        info = copias.validar_copia(escolhida)
        (st.success if info.valida else st.error)(_md(info.mensagem))
    confirmado = st.checkbox("Confirmo que quero substituir o histórico atual por esta cópia (o histórico atual "
                             "é guardado antes, na pasta «copias» junto do histórico).",
                             key="hist_confirmar_recuperacao")
    st.button("Recuperar a cópia escolhida", on_click=_recuperar_copia, args=(hist.caminho, escolhida),
              disabled=not confirmado, type="primary", icon=":material/restore:", key="hist_recuperar")


def _separador_historico(hist: _Historico, exemplo: tuple[str, dict] | None = None) -> None:
    st.caption("Registo das importações guardadas neste computador: o que foi importado, quando, com que "
               "resultado, e as diferenças entre importações. O ficheiro original não é guardado.")
    aviso = st.session_state.pop("hist_aviso", None)
    if aviso is not None:
        (st.success if aviso[0] == "ok" else st.error)(_md(aviso[1]))
    if hist.caminho is None:
        st.error(f"**O histórico não está disponível.** {_md(hist.erro)}", icon=":material/error:")
        return
    st.caption(f"Base de dados: {_md(hist.caminho)}")
    if not hist.disponivel:
        st.error(f"**O histórico não está disponível.** {_md(hist.erro)}", icon=":material/error:")
        _secao_copias(hist)
        return
    info = hist.info
    if info.migrada_de is not None:
        copia = f" Antes, foi feita uma cópia: «{info.copia_antes_da_migracao.name}»." if info.copia_antes_da_migracao else ""
        st.info(f"A base de dados do histórico foi atualizada do esquema {info.migrada_de} para o "
                f"{info.versao_esquema}.{copia}", icon=":material/upgrade:")
    if info.interrompidas_marcadas:
        st.caption(f"{_n(info.interrompidas_marcadas)} importação(ões) interrompida(s) numa sessão anterior "
                   "foram marcadas como falhadas (nenhum dado delas tinha sido guardado).")
    if exemplo is not None:
        st.button("Guardar o exemplo no histórico", on_click=_guardar_exemplo, args=(hist, *exemplo),
                  icon=":material/save:", key="hist_guardar_exemplo")
    try:
        mostradas = _lista_historico(hist.caminho)
        _detalhe_importacao(hist.caminho, mostradas)
        st.divider()
        _comparacao_historico(hist.caminho)
    except Exception as erro:  # noqa: BLE001 — por exemplo, base de dados ocupada ou danificada entretanto
        st.error(f"Não foi possível ler o histórico: {_md(P.mensagem_segura(erro))}", icon=":material/error:")
    st.divider()
    _secao_copias(hist)


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
    hist = _historico()
    if origem is None:
        _barra_lateral_regras(tem_data_prevista=True)
        _barra_lateral_historico()
        _rodape()
        _boas_vindas()
        with st.expander("Histórico de importações e cópias de segurança", icon=":material/history:"):
            _separador_historico(hist)
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
        _barra_lateral_historico()
        _rodape()
        st.error(f"**Não foi possível importar «{_md(nome)}».**\n\n{_md(erro)}", icon=":material/error:")
        if enviado is not None:
            _registar_falha_leitura(hist, nome, conteudo, folha, erro)
        return

    assinatura = hashlib.sha256(conteudo + (folha or "").encode()).hexdigest()[:12]
    exemplo = enviado is None
    topo = st.container()  # preenchido no fim, mas aparece acima da correspondência de colunas
    mapeamento = _escolher_colunas(lido, assinatura)
    data_referencia, prazo = _barra_lateral_regras(
        tem_data_prevista=bool(mapeamento and mapeamento.get(C.DATA_PREVISTA)))
    _barra_lateral_historico()
    _rodape()
    if mapeamento is None:
        with topo:
            _resumo_ficheiro(lido, None, exemplo)
        return

    resultado = _validar(lido, assinatura, tuple(sorted(mapeamento.items())), data_referencia)
    tabela = aplicar_prazos(resultado.tabela, data_referencia, prazo)
    contexto = dict(nome=nome, conteudo=conteudo, lido=lido, mapeamento=mapeamento, resultado=resultado,
                    tabela=tabela, data_referencia=data_referencia, prazo=prazo)
    chave_registo = st.session_state.hist_chave_atual = _chave_registo(conteudo, lido, mapeamento)
    if (not exemplo and st.session_state.guardar_historico and hist.disponivel
            and chave_registo not in st.session_state):
        with st.spinner("A guardar no histórico…"):
            _gravar_importacao(hist, chave_registo, H.ORIGEM_FICHEIRO, **contexto)

    with topo:
        _resumo_ficheiro(lido, resultado, exemplo)
        _mensagem_registo(hist, exemplo, chave_registo)
    filtrada, notas_filtro = _filtros(tabela, assinatura)
    for nota in notas_filtro:
        st.caption(nota)
    ind = calcular_indicadores(filtrada)
    _indicadores(ind, resultado.total)

    n_problemas = len(resultado.problemas)
    # Exceções sobre a tabela já filtrada pelos filtros do topo (não a altera).
    excecoes = E.identificar_excecoes(filtrada, resultado.problemas, data_referencia)
    separadores = st.tabs([
        ":material/table_rows: Encomendas",
        f":material/priority_high: Exceções ({_n(len(excecoes))})",
        ":material/bar_chart: Resumo",
        ":material/speed: Desempenho",
        f":material/rule: Qualidade dos dados ({_n(n_problemas)})",
        ":material/download: Exportar",
        ":material/history: Histórico",  # versão 1.3: acrescentado no fim, sem mudar os anteriores
    ])
    with separadores[0]:
        _separador_encomendas(filtrada, resultado, prazo)
    with separadores[1]:
        _separador_excecoes(excecoes, len(filtrada), nome, assinatura, data_referencia,
                            filtros_topo=len(filtrada) != resultado.total)
    with separadores[2]:
        _separador_resumo(filtrada, ind)
    with separadores[3]:
        periodo = _separador_desempenho(filtrada, data_referencia)
    with separadores[4]:
        _separador_qualidade(filtrada, resultado)
    with separadores[5]:
        _separador_exportar(resultado, tabela, nome, assinatura, data_referencia, prazo, periodo)
    with separadores[6]:
        _separador_historico(hist, (chave_registo, contexto) if exemplo else None)


def _rodape() -> None:
    st.sidebar.divider()
    st.sidebar.markdown(
        f'<p class="lf-rodape">LogiFlow {__version__} · Os ficheiros são processados neste computador '
        "e nada é enviado para a internet. O histórico de importações fica guardado só neste computador "
        "(pode desligá-lo acima).</p>",
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
