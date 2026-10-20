"""Testes do histórico de importações (versão 1.3): estados, transações, rollback,
deduplicação, preservação do histórico e normalização do que é guardado."""

from __future__ import annotations

import datetime as dt

import pytest

from logiflow import historico as H
from logiflow import persistencia as P
from logiflow.excecoes import contagens, identificar_excecoes
from logiflow.exemplo import DATA_REFERENCIA_EXEMPLO, FICHEIRO_EXEMPLO_CSV, FICHEIRO_EXEMPLO_XLSX
from logiflow.importacao import ErroImportacao, ler_ficheiro

from .conftest import CABECALHO, REFERENCIA, csv_bytes, guardar, processar, xlsx_bytes

LIMPO = csv_bytes(CABECALHO, "A1;Cliente Um;01/10/2026;Porto;Entregue", "A2;Cliente Dois;02/10/2026;Faro;Pendente")
COM_AVISO = csv_bytes(CABECALHO, "A1;Cliente Um;01/10/2026;Porto;A confirmar")
SEM_VALIDAS = csv_bytes(CABECALHO, "A1;;01/10/2026;Porto;Pendente", "A1;X;31/02/2026;;Pendente")


def _estado_completo(caminho):
    """Tudo o que está guardado (para provar que nada mudou)."""
    with P.ligar(caminho) as ligacao:
        importacoes = ligacao.execute("SELECT * FROM importacoes ORDER BY id").fetchall()
        linhas = ligacao.execute("SELECT * FROM encomendas_historico ORDER BY id").fetchall()
    return importacoes, linhas


# 4. Importações válidas, inválidas, vazias e com avisos -------------------------------------------

def test_importacao_valida_fica_concluida_com_totais(base_dados):
    registo = guardar(base_dados, LIMPO, "dia1.csv")
    assert (registo.situacao, registo.estado, registo.importacao_id) == (H.GUARDADA, H.CONCLUIDA, 1)
    assert registo.importacao_anterior_id is None
    assert "importação n.º 1" in registo.mensagem
    imp = H.obter_importacao(base_dados, 1)
    assert (imp["linhas_lidas"], imp["encomendas_validas"], imp["linhas_com_erros"], imp["linhas_com_avisos"]) == (2, 2, 0, 0)
    assert (imp["ind_entregues"], imp["ind_pendentes"], imp["ind_atrasadas"]) == (1, 1, None)
    assert imp["concluida_em"] and imp["mensagem_erro"] is None and imp["origem"] == "ficheiro"
    assert imp["versao_formato"] == H.VERSAO_FORMATO and imp["data_referencia"] == REFERENCIA.isoformat()
    assert H.contar_eventos(base_dados, "importacao_concluida") == 1


def test_importacao_com_avisos_nao_e_falha(base_dados):
    registo = guardar(base_dados, COM_AVISO)
    assert (registo.situacao, registo.estado) == (H.GUARDADA, H.CONCLUIDA_COM_AVISOS)
    imp = H.obter_importacao(base_dados, 1)
    assert (imp["encomendas_validas"], imp["linhas_com_erros"], imp["linhas_com_avisos"]) == (1, 0, 1)


def test_ficheiro_sem_encomendas_validas_e_guardado_sem_apagar_o_historico(base_dados):
    guardar(base_dados, LIMPO, "dia1.csv")
    antes = H.carregar_fotografia(base_dados, 1)
    registo = guardar(base_dados, SEM_VALIDAS, "dia2.csv")
    assert (registo.situacao, registo.estado, registo.importacao_anterior_id) == (H.GUARDADA, H.CONCLUIDA_COM_AVISOS, 1)
    imp = H.obter_importacao(base_dados, 2)
    assert (imp["linhas_lidas"], imp["encomendas_validas"], imp["linhas_com_erros"]) == (2, 0, 2)
    assert H.carregar_fotografia(base_dados, 1).equals(antes)
    assert H.listar_importacoes(base_dados)[1] == 2


@pytest.mark.parametrize("conteudo, nome", [(b"", "vazio.csv"), (b"so;um;cabecalho\n", "sem_linhas.csv"),
                                            (b"PK\x03\x04 lixo", "estragado.xlsx")])
def test_ficheiro_ilegivel_fica_registado_como_falhado_so_com_metadados(base_dados, conteudo, nome):
    with pytest.raises(ErroImportacao) as erro:
        ler_ficheiro(nome, conteudo)
    registo = H.registar_falha_leitura(base_dados, f"C:\\Utilizadores\\exemplo\\{nome}", conteudo, None, erro.value)
    assert (registo.situacao, registo.estado) == (H.FALHOU, H.FALHADA)
    imp = H.obter_importacao(base_dados, registo.importacao_id)
    assert imp["nome_ficheiro"] == nome  # sem a pasta do utilizador
    assert imp["estado"] == H.FALHADA and imp["mensagem_erro"] == str(erro.value)[:P.TAMANHO_MAXIMO_MENSAGEM]
    assert imp["linhas_lidas"] is None and H.carregar_fotografia(base_dados, registo.importacao_id).empty


def test_totais_guardados_sao_os_dos_indicadores_e_das_excecoes(base_dados):
    conteudo = FICHEIRO_EXEMPLO_XLSX.read_bytes()
    lido, resultado, tabela, ind = processar(conteudo, FICHEIRO_EXEMPLO_XLSX.name, DATA_REFERENCIA_EXEMPLO)
    dados = H.preparar_dados(FICHEIRO_EXEMPLO_XLSX.name, conteudo, lido.folha, resultado.mapeamento, resultado,
                             tabela, DATA_REFERENCIA_EXEMPLO, None, H.ORIGEM_EXEMPLO)
    assert H.registar_importacao(base_dados, dados).estado == H.CONCLUIDA_COM_AVISOS
    imp = H.obter_importacao(base_dados, 1)
    assert (imp["linhas_lidas"], imp["ind_entregues"], imp["ind_pendentes"], imp["ind_atrasadas"],
            imp["linhas_com_erros"]) == (ind.total, ind.entregues, ind.pendentes, ind.atrasadas, ind.com_erros)
    assert (60, 41, 11, 8, 9) == (ind.total, ind.entregues, ind.pendentes, ind.atrasadas, ind.com_erros)
    por_prioridade = contagens(identificar_excecoes(tabela, resultado.problemas, DATA_REFERENCIA_EXEMPLO))["por_prioridade"]
    assert (imp["exc_alta"], imp["exc_media"], imp["exc_baixa"]) == (por_prioridade["Alta"], por_prioridade["Média"],
                                                                     por_prioridade["Baixa"]) == (8, 1, 9)
    assert imp["origem"] == H.ORIGEM_EXEMPLO and imp["folha"] == "Encomendas"


def test_gravar_nao_altera_os_dados_usados_pelo_resto_da_aplicacao(base_dados):
    conteudo = FICHEIRO_EXEMPLO_XLSX.read_bytes()
    lido, resultado, tabela, _ = processar(conteudo, "x.xlsx", DATA_REFERENCIA_EXEMPLO)
    copias = (resultado.tabela.copy(), resultado.problemas.copy(), tabela.copy(), dict(resultado.mapeamento))
    dados = H.preparar_dados("x.xlsx", conteudo, lido.folha, resultado.mapeamento, resultado, tabela,
                             DATA_REFERENCIA_EXEMPLO, None)
    H.registar_importacao(base_dados, dados)
    assert resultado.tabela.equals(copias[0]) and resultado.problemas.equals(copias[1])
    assert tabela.equals(copias[2]) and resultado.mapeamento == copias[3]


# 5 e 7. Falhas a meio da transação, rollback e preservação do histórico ---------------------------

def test_falha_a_meio_da_gravacao_desfaz_tudo_e_preserva_o_anterior(base_dados, monkeypatch):
    guardar(base_dados, LIMPO, "dia1.csv")
    antes = _estado_completo(base_dados)
    original = H._inserir_fotografia

    def falha_a_meio(ligacao, importacao_id, linhas):
        original(ligacao, importacao_id, list(linhas)[:1])  # grava uma parte…
        raise RuntimeError("Cliente Secreto, Lda.")        # …e falha

    monkeypatch.setattr(H, "_inserir_fotografia", falha_a_meio)
    registo = guardar(base_dados, COM_AVISO, "dia2.csv")
    assert (registo.situacao, registo.estado, registo.importacao_id) == (H.FALHOU, H.FALHADA, 2)
    assert "Nada desta importação ficou gravado" in registo.mensagem and "Secreto" not in registo.mensagem

    importacoes, linhas = _estado_completo(base_dados)
    assert importacoes[0] == antes[0][0] and linhas == antes[1]  # a anterior e as suas linhas intactas
    imp = H.obter_importacao(base_dados, 2)
    assert imp["estado"] == H.FALHADA and imp["mensagem_erro"] == "Erro técnico (RuntimeError)."
    assert H.carregar_fotografia(base_dados, 2).empty
    assert H.contar_eventos(base_dados, "importacao_falhada") == 1


def test_totais_inconsistentes_impedem_a_confirmacao(base_dados, monkeypatch):
    original = H._inserir_fotografia
    monkeypatch.setattr(H, "_inserir_fotografia", lambda lig, i, linhas: original(lig, i, list(linhas)[:-1]))
    registo = guardar(base_dados, LIMPO)
    assert registo.situacao == H.FALHOU and "não coincidem" in registo.mensagem
    assert H.carregar_fotografia(base_dados, registo.importacao_id).empty


def test_depois_de_uma_falha_o_mesmo_ficheiro_pode_ser_gravado(base_dados, monkeypatch):
    original = H._inserir_fotografia
    monkeypatch.setattr(H, "_inserir_fotografia", lambda *a: (_ for _ in ()).throw(OSError(28, "disco cheio")))
    assert guardar(base_dados, LIMPO).situacao == H.FALHOU
    assert H.obter_importacao(base_dados, 1)["mensagem_erro"] == "Não há espaço livre no disco."
    monkeypatch.setattr(H, "_inserir_fotografia", original)
    registo = guardar(base_dados, LIMPO)
    assert (registo.situacao, registo.importacao_id, registo.importacao_anterior_id) == (H.GUARDADA, 2, None)


def test_falha_de_leitura_nao_altera_o_historico(base_dados):
    guardar(base_dados, LIMPO)
    antes = _estado_completo(base_dados)
    H.registar_falha_leitura(base_dados, "mau.csv", b"", None, ErroImportacao("O ficheiro está vazio."))
    importacoes, linhas = _estado_completo(base_dados)
    assert importacoes[:1] == antes[0] and linhas == antes[1] and len(importacoes) == 2


# 6. Importações repetidas e deduplicação ----------------------------------------------------------

def test_mesmo_conteudo_nao_cria_duplicado(base_dados):
    primeiro = guardar(base_dados, LIMPO, "dia1.csv")
    segundo = guardar(base_dados, LIMPO, "outro-nome.csv")  # o nome não conta: conta o conteúdo
    assert (segundo.situacao, segundo.importacao_id) == (H.REPETIDA, primeiro.importacao_id)
    assert "já tinha sido importado" in segundo.mensagem and "Não foi criado nenhum registo duplicado" in segundo.mensagem
    assert H.listar_importacoes(base_dados)[1] == 1
    assert H.contar_eventos(base_dados, "importacao_repetida") == 1


def test_ficheiro_diferente_com_os_mesmos_numeros_e_uma_importacao_nova(base_dados):
    guardar(base_dados, LIMPO, "dia1.csv")
    dia2 = LIMPO.replace(b"Pendente", b"Entregue")
    registo = guardar(base_dados, dia2, "dia2.csv")
    assert (registo.situacao, registo.importacao_id, registo.importacao_anterior_id) == (H.GUARDADA, 2, 1)
    # As linhas de cada importação ficam separadas (não há chave global pelo n.º de encomenda).
    assert list(H.carregar_fotografia(base_dados, 1)["estado"]) == ["Entregue", "Pendente"]
    assert list(H.carregar_fotografia(base_dados, 2)["estado"]) == ["Entregue", "Entregue"]


def test_mesmo_conteudo_lido_de_outra_forma_e_outra_importacao(base_dados):
    """Outra folha do Excel ou outra correspondência de colunas dão outros dados."""
    conteudo = xlsx_bytes([CABECALHO.split(";"), ["A1", "C", dt.date(2026, 10, 1), "Porto", "Pendente"]],
                          folhas={"Outra": [CABECALHO.split(";"), ["B1", "D", dt.date(2026, 10, 2), "Faro", "Pendente"]]})
    lido, resultado, tabela, _ = processar(conteudo, "a.xlsx")
    base = dict(nome="a.xlsx", conteudo=conteudo, mapeamento=resultado.mapeamento, resultado=resultado,
                tabela_com_prazos=tabela, data_referencia=REFERENCIA, prazo_padrao_dias=None)
    assert H.registar_importacao(base_dados, H.preparar_dados(folha="Encomendas", **base)).situacao == H.GUARDADA
    assert H.registar_importacao(base_dados, H.preparar_dados(folha="Encomendas", **base)).situacao == H.REPETIDA
    assert H.registar_importacao(base_dados, H.preparar_dados(folha="Outra", **base)).situacao == H.GUARDADA
    outra = dict(base, mapeamento={**resultado.mapeamento, "data_prevista": "Data"})
    assert H.registar_importacao(base_dados, H.preparar_dados(folha="Encomendas", **outra)).situacao == H.GUARDADA


def test_impressao_digital_ignora_a_ordem_do_mapeamento():
    a = H.impressao_digital("h", "F", {"cliente": "Cliente", "data": "Data"})
    assert a == H.impressao_digital("h", "F", {"data": "Data", "cliente": "Cliente"})
    assert a != H.impressao_digital("h", "G", {"cliente": "Cliente", "data": "Data"})
    assert a != H.impressao_digital("h2", "F", {"cliente": "Cliente", "data": "Data"})


def test_conteudo_a_ser_gravado_noutra_janela_nao_e_duplicado(base_dados):
    with P.ligar(base_dados) as ligacao, P.transacao(ligacao):
        _, resultado, tabela, _ = processar(LIMPO)
        impressao = H.impressao_digital(H.hash_conteudo(LIMPO), None, resultado.mapeamento)
        ligacao.execute("INSERT INTO importacoes (iniciada_em, nome_ficheiro, origem, hash_conteudo, impressao_digital, "
                        "versao_formato, versao_aplicacao, estado) VALUES (?, 'a.csv', 'ficheiro', 'h', ?, 1, 'x', "
                        "'em_processamento')", (P.agora_utc(), impressao))
    registo = guardar(base_dados, LIMPO)
    assert (registo.situacao, registo.estado) == (H.REPETIDA, H.EM_PROCESSAMENTO)
    assert "noutra janela" in registo.mensagem


# 10. O que é guardado: normalização e dados mínimos --------------------------------------------------

def test_fotografia_guarda_datas_normalizadas_e_o_texto_das_invalidas(base_dados):
    conteudo = xlsx_bytes([
        ["N.º Encomenda", "Cliente", "Data", "Destino", "Estado", "Data Prevista", "Data de Entrega", "Telefone"],
        [1001.0, " Cliente  A ", dt.datetime(2026, 10, 1, 15, 30), "Porto", "entregue", "31/02/2026", dt.date(2026, 10, 3), "910000000"],
        ["B-2", "Cliente B", "02-10-2026", "Faro", "Em espera", "", "", "920000000"],
    ])
    guardar(base_dados, conteudo, "a.xlsx")
    foto = H.carregar_fotografia(base_dados, 1)
    a, b = foto.iloc[0], foto.iloc[1]
    assert (a["numero"], a["chave"], a["cliente"]) == ("1001", "1001", "Cliente  A")
    assert (a["data"], a["data_original"]) == ("2026-10-01", None)        # hora descartada, como na validação
    assert (a["data_prevista"], a["data_prevista_original"]) == (None, "31/02/2026")
    assert (a["data_entrega"], a["estado"], a["estado_original"], a["estado_reconhecido"]) == ("2026-10-03", "Entregue", "entregue", 1)
    assert a["tem_erro"] == 1 and "Data Prevista inválida" in a["erros"]
    with P.ligar(base_dados) as ligacao:  # vazia ≠ inválida: na base de dados, a vazia fica NULL nos dois campos
        assert ligacao.execute("SELECT data, data_prevista, data_prevista_original FROM encomendas_historico "
                               "WHERE linha = 3").fetchone() == ("2026-10-02", None, None)
    assert (b["estado"], b["estado_reconhecido"], b["tem_erro"]) == ("Em espera", 0, 0) and b["avisos"]
    assert H.descrever_data(a["data_prevista"], a["data_prevista_original"]) == "«31/02/2026»"
    assert H.descrever_data(b["data_prevista"], b["data_prevista_original"]) == "—"
    assert H.descrever_data(float("nan"), float("nan")) == "—"


def test_colunas_extra_e_ficheiro_original_nao_sao_guardados(base_dados):
    conteudo = FICHEIRO_EXEMPLO_CSV.read_bytes()
    guardar(base_dados, conteudo, "exemplo.csv", DATA_REFERENCIA_EXEMPLO)
    wal = base_dados.parent / (base_dados.name + "-wal")
    texto_bd = base_dados.read_bytes() + (wal.read_bytes() if wal.exists() else b"")
    assert "Vale Azul".encode() in texto_bd  # o teste encontra o que de facto está guardado
    assert b"Cais de carga 2" not in texto_bd and "Contactar a receção".encode() not in texto_bd  # «Observações»
    with P.ligar(base_dados) as ligacao:
        colunas = {c[1] for c in ligacao.execute("PRAGMA table_info(encomendas_historico)")}
        detalhes = " ".join(r[0] for r in ligacao.execute("SELECT detalhe FROM eventos"))
    assert not any("observ" in c for c in colunas)
    assert "Vale Azul" not in detalhes and "ENC-26" not in detalhes  # eventos sem dados das encomendas


@pytest.mark.parametrize("nome, esperado", [
    (r"C:\Utilizadores\exemplo\Documentos\semana 42.xlsx", "semana 42.xlsx"),
    ("/home/exemplo/encomendas.csv", "encomendas.csv"),
    ("encomendas.csv", "encomendas.csv"),
    ("", "(sem nome)"),
])
def test_nome_do_ficheiro_e_guardado_sem_pasta(nome, esperado):
    assert H.nome_sem_pasta(nome) == esperado


def test_chave_da_encomenda_segue_a_regra_dos_duplicados():
    assert H.chave_encomenda("  ENC-1 ") == H.chave_encomenda("enc-1") == "enc-1"
    assert H.chave_encomenda("ENC-0001") != H.chave_encomenda("ENC-1")  # valores distintos não se juntam
    assert H.chave_encomenda("   ") is None


# Consultas: lista paginada e filtros ---------------------------------------------------------------

def _varias(caminho, n):
    for i in range(n):
        guardar(caminho, csv_bytes(CABECALHO, f"A{i};Cliente;01/10/2026;Porto;Pendente"), f"semana_{i}%_x.csv")


def test_lista_paginada_das_mais_recentes_para_as_mais_antigas(base_dados):
    _varias(base_dados, 7)
    pagina1, total = H.listar_importacoes(base_dados, limite=3)
    pagina3, _ = H.listar_importacoes(base_dados, limite=3, deslocamento=6)
    assert total == 7 and list(pagina1["id"]) == [7, 6, 5] and list(pagina3["id"]) == [1]


def test_filtros_do_historico(base_dados):
    _varias(base_dados, 3)
    H.registar_falha_leitura(base_dados, "mau.csv", b"", None, ErroImportacao("vazio"))
    assert H.listar_importacoes(base_dados, pesquisa="SEMANA_1")[1] == 1  # sem distinguir maiúsculas
    assert H.listar_importacoes(base_dados, pesquisa="%")[1] == 3          # % é texto, não «qualquer coisa»
    assert H.listar_importacoes(base_dados, pesquisa="_x")[1] == 3
    assert H.listar_importacoes(base_dados, pesquisa="2_")[1] == 0
    assert H.listar_importacoes(base_dados, estados=[H.FALHADA])[1] == 1
    assert H.listar_importacoes(base_dados, estados=[H.CONCLUIDA, H.FALHADA])[1] == 4
    hoje = dt.date.today()
    assert H.listar_importacoes(base_dados, inicio=hoje, fim=hoje)[1] == 4
    assert H.listar_importacoes(base_dados, fim=hoje - dt.timedelta(days=1))[1] == 0
    assert H.listar_importacoes(base_dados, inicio=hoje + dt.timedelta(days=1))[1] == 0
    assert H.listar_importacoes(base_dados, pesquisa="'; DROP TABLE importacoes; --")[1] == 0
    assert H.listar_importacoes(base_dados)[1] == 4


def test_historico_vazio(base_dados):
    lista, total = H.listar_importacoes(base_dados)
    assert total == 0 and lista.empty and list(lista.columns) == H.COLUNAS_LISTA
    assert H.obter_importacao(base_dados, 1) is None and H.importacoes_concluidas(base_dados).empty
