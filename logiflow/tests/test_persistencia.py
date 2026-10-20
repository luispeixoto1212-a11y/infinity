"""Testes da persistência SQLite (versão 1.3): criação, migrações, reabertura, bases
danificadas ou incompatíveis, bloqueios e localização da pasta de dados."""

from __future__ import annotations

import hashlib
import os
import sqlite3
import subprocess
import sys
import threading
from pathlib import Path

import pytest

from logiflow import historico as H
from logiflow import persistencia as P

from .conftest import CABECALHO, csv_bytes, guardar

RAIZ = Path(__file__).resolve().parent.parent
CSV_SIMPLES = csv_bytes(CABECALHO, "A1;Cliente Um;01/10/2026;Porto;Pendente", "A2;Cliente Dois;02/10/2026;Faro;Entregue")


def _hash(caminho: Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def _migracao_seguinte(monkeypatch, instrucoes=None) -> int:
    """Simula uma versão futura com mais um esquema (só acrescenta, como as migrações reais)."""
    instrucoes = instrucoes or ("ALTER TABLE importacoes ADD COLUMN nota TEXT",
                                "CREATE TABLE futura (chave TEXT PRIMARY KEY, valor TEXT)")
    numero = P.esquema_atual() + 1
    monkeypatch.setitem(P.MIGRACOES, numero, tuple(instrucoes))
    return numero


# 1. Criação inicial ---------------------------------------------------------------------

def test_criacao_inicial_da_base_de_dados(pasta_dados_temporaria):
    caminho = P.caminho_base_dados()
    assert caminho.parent == pasta_dados_temporaria and not caminho.exists()
    info = P.preparar_base_dados(caminho)
    assert info.criada and info.versao_esquema == P.esquema_atual() == 2 and info.migrada_de is None
    assert info.copia_antes_da_migracao is None and info.integra
    with P.ligar(caminho) as ligacao:
        app_id, versao, tabelas = P.ler_identificacao(ligacao)
        assert (app_id, versao) == (P.APLICACAO_ID, 2)
        assert P.TABELAS_OBRIGATORIAS <= tabelas and P.tabelas_obrigatorias(2) <= tabelas
        assert {"preferencias", "eliminacoes"} <= tabelas
        assert ligacao.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert ligacao.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        # Uma base nova regista a criação no esquema atual (não uma migração por cada esquema).
        assert ligacao.execute("SELECT tipo, detalhe FROM eventos").fetchall() == [("base_dados_criada", "esquema 2")]
        assert P.verificar_integridade(ligacao) == "ok"


@pytest.mark.skipif(os.name != "posix", reason="permissões POSIX")
def test_pasta_de_dados_criada_so_para_o_utilizador(tmp_path):
    pasta = tmp_path / "nova" / "logiflow"
    P.preparar_base_dados(pasta / P.NOME_BASE_DADOS)
    assert (pasta.stat().st_mode & 0o777) == 0o700


def test_pasta_existente_nao_e_alterada_e_caminho_que_e_ficheiro_e_recusado(tmp_path):
    existente = tmp_path / "existente"
    existente.mkdir(mode=0o755)
    modo = existente.stat().st_mode
    P.criar_pasta(existente)
    assert existente.stat().st_mode == modo
    ficheiro = tmp_path / "ficheiro"
    ficheiro.write_text("x")
    with pytest.raises(P.ErroPersistencia, match="não é uma pasta"):
        P.criar_pasta(ficheiro)


def test_integridade_referencial_ativa(base_dados):
    with P.ligar(base_dados) as ligacao, pytest.raises(sqlite3.IntegrityError):
        ligacao.execute("INSERT INTO encomendas_historico (importacao_id, linha, numero, chave, cliente, destino, "
                        "estado, estado_original, estado_reconhecido, tem_erro, erros, avisos) "
                        "VALUES (999, 2, 'X', 'x', '', '', '', '', 0, 0, '', '')")


def test_ligacao_fica_sempre_fechada(base_dados):
    with P.ligar(base_dados) as ligacao:
        pass
    with pytest.raises(sqlite3.ProgrammingError):
        ligacao.execute("SELECT 1")
    with pytest.raises(RuntimeError), P.ligar(base_dados) as ligacao:
        raise RuntimeError("falha a meio")
    with pytest.raises(sqlite3.ProgrammingError):
        ligacao.execute("SELECT 1")


def test_transacao_desfaz_tudo_em_caso_de_erro(base_dados):
    with P.ligar(base_dados) as ligacao:
        with pytest.raises(ValueError), P.transacao(ligacao):
            P.registar_evento(ligacao, "teste")
            P.registar_evento(ligacao, "teste")
            raise ValueError
        assert ligacao.execute("SELECT COUNT(*) FROM eventos WHERE tipo = 'teste'").fetchone()[0] == 0


# 2. Migrações e reabertura -----------------------------------------------------------------

def test_migracao_de_esquema_preserva_dados_e_faz_copia_antes(base_dados, monkeypatch):
    guardar(base_dados, CSV_SIMPLES)
    antes = H.carregar_fotografia(base_dados, 1)
    atual = P.esquema_atual()
    seguinte = _migracao_seguinte(monkeypatch)

    info = P.preparar_base_dados(base_dados)
    assert (info.criada, info.migrada_de, info.versao_esquema) == (False, atual, seguinte)
    copia = info.copia_antes_da_migracao
    assert copia is not None and copia.parent == base_dados.parent / P.NOME_PASTA_COPIAS
    assert copia.name.startswith(f"logiflow-antes-migracao-v{atual}-para-v{seguinte}-")
    with P.ligar(copia, so_leitura=True) as ligacao:  # a cópia ficou no esquema antigo, íntegra
        assert P.ler_identificacao(ligacao)[1] == atual and P.verificar_integridade(ligacao) == "ok"
    with P.ligar(base_dados) as ligacao:
        assert P.ler_identificacao(ligacao)[1] == seguinte
        assert "nota" in [c[1] for c in ligacao.execute("PRAGMA table_info(importacoes)")]
        assert ligacao.execute("SELECT detalhe FROM eventos WHERE tipo = 'migracao'").fetchall() == [
            (f"esquema {seguinte}",)]
    assert H.carregar_fotografia(base_dados, 1).equals(antes)

    # Reabrir de novo (próximo arranque): nada a migrar, nenhuma cópia nova.
    info = P.preparar_base_dados(base_dados)
    assert (info.criada, info.migrada_de, info.copia_antes_da_migracao) == (False, None, None)
    assert len(list((base_dados.parent / P.NOME_PASTA_COPIAS).iterdir())) == 1


def test_migracao_que_falha_e_desfeita_e_a_base_fica_como_estava(base_dados, monkeypatch):
    guardar(base_dados, CSV_SIMPLES)
    atual = P.esquema_atual()
    _migracao_seguinte(monkeypatch, ("CREATE TABLE nova (x)", "ISTO NÃO É SQL"))
    with pytest.raises(sqlite3.OperationalError):
        P.preparar_base_dados(base_dados)
    with P.ligar(base_dados) as ligacao:
        _, versao, tabelas = P.ler_identificacao(ligacao)
    assert versao == atual and "nova" not in tabelas
    assert len(H.carregar_fotografia(base_dados, 1)) == 2


def test_base_de_versao_mais_recente_e_recusada_sem_alteracoes(base_dados, monkeypatch):
    seguinte = _migracao_seguinte(monkeypatch)
    P.preparar_base_dados(base_dados)
    monkeypatch.delitem(P.MIGRACOES, seguinte)  # «voltar» a uma versão antiga da aplicação
    assinatura = _hash(base_dados)
    with pytest.raises(P.BaseDadosIncompativel, match="versão mais recente"):
        P.preparar_base_dados(base_dados)
    assert _hash(base_dados) == assinatura


# 3. Persistência após fechar e voltar a abrir -------------------------------------------------

def test_dados_persistem_noutro_processo(base_dados):
    """Um processo novo (como abrir a aplicação outra vez) encontra a importação gravada."""
    registo = guardar(base_dados, CSV_SIMPLES, "dia1.csv")
    codigo = (
        "from logiflow import historico as H, persistencia as P\n"
        "c = P.caminho_base_dados(); i = P.preparar_base_dados(c)\n"
        "lista, total = H.listar_importacoes(c)\n"
        "print(i.criada, total, lista.loc[0, 'nome_ficheiro'], len(H.carregar_fotografia(c, int(lista.loc[0, 'id']))))\n"
    )
    saida = subprocess.run([sys.executable, "-c", codigo], cwd=RAIZ, capture_output=True, text=True, check=True,
                           env={**os.environ, P.VARIAVEL_PASTA: str(base_dados.parent)})
    assert saida.stdout.split() == ["False", "1", "dia1.csv", "2"]
    assert registo.importacao_id == 1


def test_importacao_interrompida_fica_falhada_no_arranque_seguinte(base_dados):
    with P.ligar(base_dados) as ligacao, P.transacao(ligacao):
        for momento in ("2026-10-19T08:00:00+00:00", P.agora_utc()):
            ligacao.execute("INSERT INTO importacoes (iniciada_em, nome_ficheiro, origem, hash_conteudo, "
                            "impressao_digital, versao_formato, versao_aplicacao, estado) "
                            "VALUES (?, 'a.csv', 'ficheiro', 'h', 'i', 1, 'x', 'em_processamento')", (momento,))
    info = P.preparar_base_dados(base_dados)
    assert info.interrompidas_marcadas == 1  # só a antiga; a recente pode estar a decorrer noutra janela
    estados = H.listar_importacoes(base_dados)[0].set_index("id")["estado"].to_dict()
    assert estados == {1: H.FALHADA, 2: H.EM_PROCESSAMENTO}


# 12. Base de dados corrompida ou incompatível ---------------------------------------------------

def test_base_danificada_nunca_e_substituida(pasta_dados_temporaria):
    caminho = P.caminho_base_dados()
    caminho.write_bytes(b"nao e uma base de dados " * 200)
    assinatura = _hash(caminho)
    with pytest.raises(P.BaseDadosDanificada, match="Não foi alterada nem apagada"):
        P.preparar_base_dados(caminho)
    assert _hash(caminho) == assinatura
    assert sorted(p.name for p in pasta_dados_temporaria.iterdir()) == [P.NOME_BASE_DADOS]


def test_base_com_paginas_danificadas_e_detetada(base_dados):
    guardar(base_dados, CSV_SIMPLES)
    with P.ligar(base_dados) as ligacao:
        ligacao.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    dados = bytearray(base_dados.read_bytes())
    dados[100:4096] = b"\xff" * (4096 - 100)  # estraga o resto da 1.ª página (esquema)
    base_dados.write_bytes(bytes(dados))
    assinatura = _hash(base_dados)
    with pytest.raises(P.BaseDadosDanificada):
        P.preparar_base_dados(base_dados)
    assert _hash(base_dados) == assinatura


def test_base_de_outra_aplicacao_e_recusada(pasta_dados_temporaria):
    caminho = P.caminho_base_dados()
    with sqlite3.connect(caminho) as ligacao:
        ligacao.execute("CREATE TABLE clientes (nome TEXT)")
    ligacao.close()
    assinatura = _hash(caminho)
    with pytest.raises(P.BaseDadosIncompativel, match="não é uma base de dados do LogiFlow"):
        P.preparar_base_dados(caminho)
    assert _hash(caminho) == assinatura


def test_base_incompleta_e_recusada(base_dados):
    with P.ligar(base_dados) as ligacao:
        ligacao.execute("DROP TABLE eventos")
        ligacao.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    assinatura = _hash(base_dados)
    with pytest.raises(P.BaseDadosIncompativel, match="incompleta"):
        P.preparar_base_dados(base_dados)
    assert _hash(base_dados) == assinatura


def test_ficheiro_vazio_e_inicializado(pasta_dados_temporaria):
    caminho = P.caminho_base_dados()
    caminho.write_bytes(b"")
    assert P.preparar_base_dados(caminho).criada


# Bloqueios e várias janelas ----------------------------------------------------------------------

def test_base_ocupada_da_erro_claro_e_nao_altera_nada(base_dados, monkeypatch):
    monkeypatch.setattr(P, "TEMPO_ESPERA_S", 0.2)
    bloqueio = sqlite3.connect(base_dados, isolation_level=None)
    try:
        bloqueio.execute("BEGIN IMMEDIATE")
        with pytest.raises(sqlite3.OperationalError) as erro:
            guardar(base_dados, CSV_SIMPLES)
        assert P.mensagem_segura(erro.value) == "A base de dados estava ocupada por outra janela do LogiFlow."
    finally:
        bloqueio.execute("ROLLBACK")
        bloqueio.close()
    assert H.listar_importacoes(base_dados)[1] == 0


def test_duas_janelas_a_gravar_o_mesmo_ficheiro_ao_mesmo_tempo(base_dados):
    resultados, erros = [], []

    def gravar():
        try:
            resultados.append(guardar(base_dados, CSV_SIMPLES).situacao)
        except Exception as erro:  # pragma: no cover — registado para o assert
            erros.append(erro)

    linhas = [threading.Thread(target=gravar) for _ in range(4)]
    for linha in linhas:
        linha.start()
    for linha in linhas:
        linha.join()
    assert not erros
    assert sorted(resultados) == [H.GUARDADA, H.REPETIDA, H.REPETIDA, H.REPETIDA]
    assert H.listar_importacoes(base_dados)[1] == 1


def test_mensagens_guardadas_nao_contem_dados_das_encomendas():
    assert P.mensagem_segura(RuntimeError("Cliente Secreto, Lda.")) == "Erro técnico (RuntimeError)."
    assert len(P.mensagem_segura(P.ErroPersistencia("x" * 2000))) == P.TAMANHO_MAXIMO_MENSAGEM


def _erro_em_uso_windows() -> PermissionError:
    erro = PermissionError(13, "O ficheiro está a ser utilizado por outro processo")
    erro.winerror = 32  # ERROR_SHARING_VIOLATION
    return erro


@pytest.mark.parametrize("erro, esperado", [
    (_erro_em_uso_windows(), "está a ser usado por outro programa"),
    (PermissionError(13, "C:/pasta"), "Sem permissão para alterar o ficheiro ou a pasta"),
    (FileNotFoundError(2, "D:/pen"), "deixou de estar disponível (por exemplo, uma pen USB retirada)"),
    (sqlite3.OperationalError("unable to open database file"), "Não foi possível abrir a base de dados"),
    (sqlite3.OperationalError("database is locked"), "ocupada por outra janela"),
    (sqlite3.OperationalError("disk I/O error"), "Erro de leitura ou escrita no disco"),
    (sqlite3.DatabaseError("database disk image is malformed"), "pode estar danificada"),
    (OSError(28, "No space left on device"), "Não há espaço livre no disco"),
])
def test_mensagens_de_erro_explicam_o_problema(erro, esperado):
    mensagem = P.mensagem_segura(erro)
    assert esperado in mensagem and "C:/pasta" not in mensagem and "D:/pen" not in mensagem


# 15. Caminhos de dados em Windows, macOS e Linux -----------------------------------------------------

@pytest.mark.parametrize("ambiente, plataforma, esperado", [
    ({"LOCALAPPDATA": r"C:\Utilizadores\exemplo\AppData\Local"}, "win32",
     Path(r"C:\Utilizadores\exemplo\AppData\Local") / "LogiFlow"),
    ({"APPDATA": r"C:\Utilizadores\exemplo\AppData\Roaming"}, "win32",
     Path(r"C:\Utilizadores\exemplo\AppData\Roaming") / "LogiFlow"),
    ({"USERPROFILE": r"C:\Utilizadores\exemplo"}, "win32",
     Path(r"C:\Utilizadores\exemplo") / "AppData" / "Local" / "LogiFlow"),
    ({"HOME": "/home/exemplo"}, "darwin", Path("/home/exemplo/Library/Application Support/LogiFlow")),
    ({"HOME": "/home/exemplo"}, "linux", Path("/home/exemplo/.local/share/logiflow")),
    ({"HOME": "/home/exemplo", "XDG_DATA_HOME": "/dados/xdg"}, "linux", Path("/dados/xdg/logiflow")),
    ({"HOME": "/home/exemplo", "XDG_DATA_HOME": "relativo"}, "linux", Path("/home/exemplo/.local/share/logiflow")),
])
def test_pasta_de_dados_por_sistema_operativo(ambiente, plataforma, esperado):
    assert P.pasta_dados(ambiente, plataforma) == esperado


def test_pasta_escolhida_pela_variavel_tem_de_ser_absoluta(tmp_path):
    assert P.pasta_dados({P.VARIAVEL_PASTA: str(tmp_path)}, "win32") == tmp_path
    with pytest.raises(P.ErroPersistencia, match="caminho absoluto"):
        P.pasta_dados({P.VARIAVEL_PASTA: "dados"}, "linux")


def test_pasta_de_dados_nao_depende_da_pasta_atual_nem_da_instalacao(tmp_path, monkeypatch):
    sem_variavel = {k: v for k, v in os.environ.items() if k != P.VARIAVEL_PASTA}
    antes = P.pasta_dados(sem_variavel)
    monkeypatch.chdir(tmp_path)
    assert P.pasta_dados(sem_variavel) == antes
    assert antes.is_absolute()
    assert RAIZ not in antes.parents and antes != RAIZ  # fora da pasta da aplicação (substituída nas atualizações)
    assert P.caminho_base_dados(antes).name == P.NOME_BASE_DADOS


def test_testes_usam_pasta_temporaria(pasta_dados_temporaria):
    assert P.pasta_dados() == pasta_dados_temporaria


def test_duas_janelas_a_arrancar_ao_mesmo_tempo(pasta_dados_temporaria):
    """Duas sessões a criar a base de dados ao mesmo tempo não aplicam a migração duas vezes."""
    caminho, erros, barreira = P.caminho_base_dados(), [], threading.Barrier(4)

    def arrancar():
        try:
            barreira.wait()
            P.preparar_base_dados(caminho)
        except Exception as erro:  # pragma: no cover — registado para o assert
            erros.append(erro)

    linhas = [threading.Thread(target=arrancar) for _ in range(4)]
    for linha in linhas:
        linha.start()
    for linha in linhas:
        linha.join()
    assert not erros
    with P.ligar(caminho) as ligacao:
        assert P.ler_identificacao(ligacao)[1] == P.esquema_atual()
        assert ligacao.execute("SELECT COUNT(*) FROM eventos WHERE tipo = 'base_dados_criada'").fetchone()[0] == 1
