"""Testes das cópias de segurança e da recuperação (versão 1.3), incluindo falhas reais:
cópias inválidas, danificadas, de outra aplicação ou de versões diferentes, base atual
danificada e falha a meio da recuperação."""

from __future__ import annotations

import hashlib
import os
import sqlite3
import threading
import time
from pathlib import Path

import pytest

from logiflow import copias as B
from logiflow import historico as H
from logiflow import persistencia as P

from .conftest import CABECALHO, csv_bytes, guardar

DIA1 = csv_bytes(CABECALHO, "A1;Cliente Um;01/10/2026;Porto;Pendente")
DIA2 = csv_bytes(CABECALHO, "A1;Cliente Um;01/10/2026;Porto;Entregue", "A2;Cliente Dois;02/10/2026;Faro;Pendente")


def _hash(caminho: Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


@pytest.fixture
def destino(tmp_path) -> Path:
    pasta = tmp_path / "copias externas"
    pasta.mkdir()
    return pasta


def _nomes(caminho_db: Path) -> list[str]:
    return list(H.listar_importacoes(caminho_db)[0]["nome_ficheiro"])


# 11. Criação e validação ---------------------------------------------------------------------------

def test_criar_copia_valida_com_nome_inequivoco(base_dados, destino):
    guardar(base_dados, DIA1, "dia1.csv")
    info = B.criar_copia(base_dados, destino)
    assert info.valida and info.importacoes == 1 and info.versao_esquema == P.esquema_atual()
    assert info.caminho.parent == destino and info.caminho.name.startswith("logiflow-copia-")
    assert info.caminho.suffix == ".db"
    assert not Path(f"{info.caminho}-wal").exists()  # ficheiro único, autónomo
    with P.ligar(info.caminho, so_leitura=True) as ligacao:
        assert ligacao.execute("PRAGMA journal_mode").fetchone()[0] == "delete"
    with P.ligar(base_dados) as ligacao:
        assert ligacao.execute("SELECT detalhe FROM eventos WHERE tipo = 'copia_criada'").fetchall() == [(info.caminho.name,)]
    assert B.listar_copias(destino) == [info.caminho]


def test_copias_seguidas_nunca_se_sobrescrevem(base_dados, destino):
    primeira = B.criar_copia(base_dados, destino).caminho
    assinatura = _hash(primeira)
    segunda = B.criar_copia(base_dados, destino).caminho
    terceira = B.criar_copia(base_dados, destino).caminho
    assert len({primeira, segunda, terceira}) == 3 and _hash(primeira) == assinatura
    with pytest.raises(FileExistsError):
        P.copiar_sqlite(base_dados, primeira)
    assert _hash(primeira) == assinatura


def test_copia_e_consistente_com_a_aplicacao_a_escrever(base_dados, destino, monkeypatch):
    monkeypatch.setattr(P, "TEMPO_ESPERA_S", 0.2)
    guardar(base_dados, DIA1)
    escrita = sqlite3.connect(base_dados, isolation_level=None)
    try:
        escrita.execute("BEGIN IMMEDIATE")
        escrita.execute("INSERT INTO eventos (momento, tipo) VALUES ('x', 'por_confirmar')")
        info = B.criar_copia(base_dados, destino)  # outra «janela» tem uma escrita a meio
    finally:
        escrita.execute("ROLLBACK")
        escrita.close()
    with P.ligar(info.caminho, so_leitura=True) as ligacao:
        assert ligacao.execute("SELECT COUNT(*) FROM eventos WHERE tipo = 'por_confirmar'").fetchone()[0] == 0
        assert ligacao.execute("SELECT COUNT(*) FROM encomendas_historico").fetchone()[0] == 1


def test_destino_das_copias_e_validado(tmp_path, destino):
    assert B.validar_pasta_destino(f'  "{destino}"  ') == destino.resolve()
    for texto, mensagem in [("", "Indique a pasta"), ("relativa", "caminho completo"),
                            (str(tmp_path / "nao-existe"), "não existe")]:
        with pytest.raises(P.ErroPersistencia, match=mensagem):
            B.validar_pasta_destino(texto)
    ficheiro = tmp_path / "ficheiro.txt"
    ficheiro.write_text("x")
    with pytest.raises(P.ErroPersistencia, match="não é uma pasta"):
        B.validar_pasta_destino(str(ficheiro))
    assert sorted(p.name for p in destino.iterdir()) == []  # a validação não deixa ficheiros


@pytest.mark.skipif(os.name != "posix" or os.geteuid() == 0, reason="permissões POSIX (o root escreve sempre)")
def test_destino_sem_permissao_de_escrita(destino):
    destino.chmod(0o500)
    try:
        with pytest.raises(P.ErroPersistencia, match="Não é possível escrever"):
            B.validar_pasta_destino(str(destino))
    finally:
        destino.chmod(0o700)


@pytest.mark.parametrize("conteudo, mensagem", [
    (b"", "não é uma base de dados SQLite"),
    (b"texto qualquer " * 100, "não é uma base de dados SQLite"),
    (b"SQLite format 3\x00" + b"\xff" * 5000, "danificada"),
])
def test_copias_invalidas_sao_identificadas(destino, conteudo, mensagem):
    caminho = destino / "logiflow-copia-invalida.db"
    caminho.write_bytes(conteudo)
    info = B.validar_copia(caminho)
    assert not info.valida and mensagem in info.mensagem


def test_copia_com_paginas_danificadas_falha_a_integridade(base_dados, destino):
    guardar(base_dados, DIA2)
    copia = B.criar_copia(base_dados, destino).caminho
    dados = bytearray(copia.read_bytes())
    pagina = 4096
    assert len(dados) >= 4 * pagina
    dados[3 * pagina + 8:4 * pagina] = b"\x07" * (pagina - 8)  # estraga uma página de dados
    copia.write_bytes(bytes(dados))
    info = B.validar_copia(copia)
    assert not info.valida and "danificada" in info.mensagem


def test_copia_de_outra_aplicacao_vazia_ou_mais_recente(base_dados, destino, monkeypatch):
    outra = destino / "logiflow-outra.db"
    with sqlite3.connect(outra) as ligacao:
        ligacao.execute("CREATE TABLE coisas (x)")
    ligacao.close()
    assert "não é uma base de dados do LogiFlow" in B.validar_copia(outra).mensagem
    vazia = destino / "logiflow-vazia.db"
    sqlite3.connect(vazia).close()
    assert vazia.stat().st_size == 0 and not B.validar_copia(vazia).valida
    seguinte = P.esquema_atual() + 1
    monkeypatch.setitem(P.MIGRACOES, seguinte, ("CREATE TABLE futura (x)",))
    P.preparar_base_dados(base_dados)
    futura = B.criar_copia(base_dados, destino).caminho
    monkeypatch.delitem(P.MIGRACOES, seguinte)
    info = B.validar_copia(futura)
    assert not info.valida and "versão mais recente" in info.mensagem


def test_validar_nao_altera_a_copia(base_dados, destino):
    copia = B.criar_copia(base_dados, destino).caminho
    assinatura, modificada = _hash(copia), copia.stat().st_mtime_ns
    assert B.validar_copia(copia).valida
    assert _hash(copia) == assinatura and copia.stat().st_mtime_ns == modificada
    assert sorted(p.name for p in destino.iterdir()) == [copia.name]  # sem -wal nem -shm


# 11. Recuperação ---------------------------------------------------------------------------------------

def test_recuperar_repoe_os_dados_e_guarda_a_base_atual(base_dados, destino):
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, destino).caminho
    assinatura_copia = _hash(copia)
    guardar(base_dados, DIA2, "dia2.csv")  # depois da cópia
    assert _nomes(base_dados) == ["dia2.csv", "dia1.csv"]

    resultado = B.restaurar_copia(base_dados, copia)
    assert resultado.importacoes == 1 and not resultado.base_anterior_danificada
    assert _nomes(base_dados) == ["dia1.csv"]
    assert len(H.carregar_fotografia(base_dados, 1)) == 1
    assert "foi guardada como «logiflow-antes-da-recuperacao-" in resultado.mensagem
    # A base que estava em uso não se perdeu: tem as duas importações.
    preservada = resultado.preservada_em
    assert preservada.parent == base_dados.parent / P.NOME_PASTA_COPIAS
    assert B.validar_copia(preservada).importacoes == 2
    assert _hash(copia) == assinatura_copia  # a cópia usada não foi alterada
    assert not list(base_dados.parent.glob(".recuperacao-*"))  # sem ficheiros temporários deixados
    assert H.contar_eventos(base_dados, "recuperacao_concluida") == 1
    with P.ligar(base_dados) as ligacao:
        assert P.verificar_integridade(ligacao) == "ok"
        assert ligacao.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert P.preparar_base_dados(base_dados).versao_esquema == P.esquema_atual()  # o arranque seguinte funciona


def test_copia_invalida_nao_toca_na_base_atual(base_dados, destino):
    guardar(base_dados, DIA1)
    lixo = destino / "logiflow-copia-lixo.db"
    lixo.write_bytes(b"lixo" * 1000)
    with P.ligar(base_dados) as ligacao:
        ligacao.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    assinatura = _hash(base_dados)
    with pytest.raises(P.ErroPersistencia, match="A base de dados atual não foi alterada"):
        B.restaurar_copia(base_dados, lixo)
    assert _hash(base_dados) == assinatura
    assert not (base_dados.parent / P.NOME_PASTA_COPIAS).exists() or not list((base_dados.parent / P.NOME_PASTA_COPIAS).iterdir())


def test_recuperar_com_a_base_atual_danificada(base_dados, destino):
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, destino).caminho
    base_dados.write_bytes(b"danificada" * 500)
    for sufixo in ("-wal", "-shm"):
        Path(f"{base_dados}{sufixo}").unlink(missing_ok=True)
    estragada = _hash(base_dados)
    with pytest.raises(P.BaseDadosDanificada):
        P.preparar_base_dados(base_dados)

    resultado = B.restaurar_copia(base_dados, copia)
    assert resultado.base_anterior_danificada and "estava danificada" in resultado.mensagem
    assert _hash(resultado.preservada_em) == estragada  # copiada byte a byte, nunca apagada
    assert resultado.preservada_em.name.startswith("logiflow-danificada-")
    assert _nomes(base_dados) == ["dia1.csv"]


def test_recuperar_copia_de_esquema_anterior_atualiza_o_esquema(base_dados, destino, monkeypatch):
    guardar(base_dados, DIA1)
    copia_antiga = B.criar_copia(base_dados, destino).caminho
    antigo = P.esquema_atual()
    seguinte = antigo + 1
    monkeypatch.setitem(P.MIGRACOES, seguinte, ("ALTER TABLE importacoes ADD COLUMN nota TEXT",))
    P.preparar_base_dados(base_dados)

    resultado = B.restaurar_copia(base_dados, copia_antiga)
    assert resultado.versao_copia == antigo and f"atualizada para o {seguinte}" in resultado.mensagem
    with P.ligar(base_dados) as ligacao:
        assert P.ler_identificacao(ligacao)[1] == seguinte
    with P.ligar(copia_antiga, so_leitura=True) as ligacao:
        assert P.ler_identificacao(ligacao)[1] == antigo  # a cópia ficou como estava


def test_falha_no_fim_da_recuperacao_repoe_a_base_anterior(base_dados, destino, monkeypatch):
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, destino).caminho
    guardar(base_dados, DIA2, "dia2.csv")
    original, chamadas = B._validar_base, []

    def validar_e_falhar_na_base_final(caminho):
        chamadas.append(caminho)
        if caminho == base_dados:
            raise P.ErroPersistencia("A verificação final da base recuperada falhou.")
        return original(caminho)

    monkeypatch.setattr(B, "_validar_base", validar_e_falhar_na_base_final)
    with pytest.raises(P.ErroPersistencia, match="verificação final"):
        B.restaurar_copia(base_dados, copia)
    monkeypatch.setattr(B, "_validar_base", original)
    assert _nomes(base_dados) == ["dia2.csv", "dia1.csv"]  # a base anterior voltou a ficar em uso
    assert not list(base_dados.parent.glob(".recuperacao-*"))


def test_falha_no_fim_com_a_base_danificada_deixa_a_danificada_no_lugar(base_dados, destino, monkeypatch):
    """Alteração intencional (revisão da 1.3.0): a base danificada é copiada, não movida; a cópia fica."""
    guardar(base_dados, DIA1)
    copia = B.criar_copia(base_dados, destino).caminho
    base_dados.write_bytes(b"danificada" * 500)
    for sufixo in ("-wal", "-shm"):
        Path(f"{base_dados}{sufixo}").unlink(missing_ok=True)
    estragada = _hash(base_dados)
    original = B._validar_base
    monkeypatch.setattr(B, "_validar_base",
                        lambda c: (_ for _ in ()).throw(P.ErroPersistencia("falhou")) if c == base_dados else original(c))
    with pytest.raises(P.ErroPersistencia):
        B.restaurar_copia(base_dados, copia)
    assert _hash(base_dados) == estragada  # tal como estava, para recuperação manual
    guardadas = list((base_dados.parent / P.NOME_PASTA_COPIAS).glob("logiflow-danificada-*.db"))
    assert len(guardadas) == 1 and _hash(guardadas[0]) == estragada  # e também guardada à parte, igual
    assert not list(base_dados.parent.glob(".recuperacao-*"))
    assert not P.caminho_manutencao(base_dados).exists()  # o bloqueio foi libertado


# Base em uso danificada e outra janela a gravar logo depois da troca de ficheiro -------------------------
# A base recuperada é posta no lugar fora do modo WAL; ao passá-la para WAL, o SQLite não usa o prazo de
# espera se outra janela tiver o bloqueio de escrita. A recuperação espera (até ao prazo) e, se desistir,
# repõe a base anterior.

class _OutraJanela:
    """Mal a base recuperada fica no lugar, outra janela começa a gravar (bloqueio de escrita do SQLite)."""

    def __init__(self, base_dados: Path, monkeypatch, segundos: float | None = None):
        self.ligacao, self.terminada, self._fecho, self._relogio = None, False, threading.Lock(), None
        real = os.replace

        def substituir(origem, destino):
            real(origem, destino)
            if Path(destino) == base_dados and self.ligacao is None:
                self.ligacao = sqlite3.connect(str(base_dados), isolation_level=None, check_same_thread=False)
                self.ligacao.execute("BEGIN IMMEDIATE")
                if segundos is not None:
                    self._relogio = threading.Timer(segundos, self.terminar)
                    self._relogio.start()

        monkeypatch.setattr(os, "replace", substituir)

    def terminar(self) -> None:
        with self._fecho:
            if self.ligacao is not None and not self.terminada:
                self.ligacao.execute("ROLLBACK")
                self.ligacao.close()
                self.terminada = True

    def fechar(self) -> None:
        if self._relogio is not None:
            self._relogio.cancel()
            self._relogio.join()
        self.terminar()


def _base_danificada_com_copia(base_dados: Path, destino: Path) -> tuple[Path, str]:
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, destino).caminho
    base_dados.write_bytes(b"danificada" * 500)
    for sufixo in ("-wal", "-shm"):
        Path(f"{base_dados}{sufixo}").unlink(missing_ok=True)
    return copia, _hash(base_dados)


def test_recuperar_sobre_base_danificada_espera_por_outra_janela_a_gravar(base_dados, destino, monkeypatch):
    copia, estragada = _base_danificada_com_copia(base_dados, destino)
    janela = _OutraJanela(base_dados, monkeypatch, segundos=0.5)
    try:
        resultado = B.restaurar_copia(base_dados, copia)
    finally:
        janela.fechar()
    assert janela.ligacao is not None  # a outra janela estava mesmo a gravar durante a passagem a WAL
    assert resultado.base_anterior_danificada and _hash(resultado.preservada_em) == estragada
    assert _nomes(base_dados) == ["dia1.csv"]
    with P.ligar(base_dados) as ligacao:
        assert ligacao.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert not list(base_dados.parent.glob(".recuperacao-*"))
    assert not P.caminho_manutencao(base_dados).exists()


def test_recuperar_sobre_base_danificada_desiste_no_fim_do_prazo(base_dados, destino, monkeypatch):
    """Se a outra janela continuar a gravar, desiste ao fim do prazo (não fica a tentar para sempre) e a
    base anterior volta ao lugar tal como estava; depois, sem a outra janela, a recuperação funciona."""
    copia, estragada = _base_danificada_com_copia(base_dados, destino)
    copia_antes = _hash(copia)
    monkeypatch.setattr(P, "TEMPO_ESPERA_S", 0.5)
    janela = _OutraJanela(base_dados, monkeypatch)
    repor = B._repor_em_bruto

    def repor_depois_de_a_outra_janela_terminar(preservada, caminho_db):
        janela.terminar()  # (no Windows, um ficheiro aberto noutra ligação não pode ser substituído)
        repor(preservada, caminho_db)

    monkeypatch.setattr(B, "_repor_em_bruto", repor_depois_de_a_outra_janela_terminar)
    resultado = {}

    def recuperar():
        inicio = time.monotonic()
        try:
            B.restaurar_copia(base_dados, copia)
        except Exception as erro:
            resultado["erro"] = erro
        resultado["segundos"] = time.monotonic() - inicio

    fio = threading.Thread(target=recuperar, daemon=True)
    try:
        fio.start()
        fio.join(20)
        desistiu = not fio.is_alive()
    finally:
        janela.fechar()
        fio.join(20)
    assert desistiu, "continuou a tentar depois do prazo"
    erro = resultado.get("erro")
    assert isinstance(erro, sqlite3.OperationalError) and erro.sqlite_errorcode == sqlite3.SQLITE_BUSY
    assert "ocupada por outra janela" in P.mensagem_segura(erro)
    assert 0.5 <= resultado["segundos"] < 10
    assert _hash(base_dados) == estragada  # a base anterior voltou ao lugar, igual byte a byte
    assert not [s for s in P.SUFIXOS_AUXILIARES if Path(f"{base_dados}{s}").exists()]
    guardadas = list((base_dados.parent / P.NOME_PASTA_COPIAS).glob("logiflow-danificada-*.db"))
    assert len(guardadas) == 1 and _hash(guardadas[0]) == estragada
    assert _hash(copia) == copia_antes  # a cópia de origem não foi alterada
    assert not list(base_dados.parent.glob(".recuperacao-*")) and not list(base_dados.parent.rglob("*.parcial"))
    assert not P.caminho_manutencao(base_dados).exists()
    assert B.restaurar_copia(base_dados, copia).importacoes == 1  # sem a outra janela, recupera
    assert _nomes(base_dados) == ["dia1.csv"]


def test_recuperar_quando_ainda_nao_ha_base_de_dados(pasta_dados_temporaria, tmp_path, destino):
    origem = tmp_path / "outra" / P.NOME_BASE_DADOS
    P.preparar_base_dados(origem)
    guardar(origem, DIA1, "dia1.csv")
    copia = B.criar_copia(origem, destino).caminho
    caminho = P.caminho_base_dados()
    assert not caminho.exists()
    resultado = B.restaurar_copia(caminho, copia)
    assert resultado.preservada_em is None and _nomes(caminho) == ["dia1.csv"]


def test_nao_ha_copia_sem_base_de_dados(pasta_dados_temporaria, destino):
    with pytest.raises(P.ErroPersistencia, match="Ainda não existe histórico"):
        B.criar_copia(P.caminho_base_dados(), destino)
