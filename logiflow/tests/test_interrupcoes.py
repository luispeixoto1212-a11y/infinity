"""Interrupções reais (revisão da 1.3.0): o processo é terminado de repente a meio de cada
operação (``os._exit``, como um fecho forçado) e verifica-se o que fica no disco e o que
acontece no arranque seguinte. Também: bloqueios de outras janelas e bases com erros.

Tudo em pastas temporárias. Regra verificada em todos os casos: nunca fica uma base de dados
vazia no lugar de uma com dados, nada fica a meio e nenhum dado se perde sem aviso."""

from __future__ import annotations

import hashlib
import os
import sqlite3
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

from logiflow import conservacao as R
from logiflow import copias as B
from logiflow import historico as H
from logiflow import persistencia as P

from .conftest import CABECALHO, csv_bytes, guardar

RAIZ = Path(__file__).resolve().parent.parent
DIA1 = csv_bytes(CABECALHO, *(f"A{i};Cliente {i};01/10/2026;Porto;Pendente" for i in range(300)))
DIA2 = csv_bytes(CABECALHO, *(f"B{i};Cliente {i};02/10/2026;Faro;Entregue" for i in range(300)))


def _interromper(cenario: str, base: Path, extra: str = "") -> int:
    resultado = subprocess.run([sys.executable, "-m", "tests.processo_interrompido", cenario, str(base), extra],
                               cwd=RAIZ, capture_output=True, text=True, timeout=120)
    assert resultado.returncode == 9, resultado.stderr[-2000:]  # terminado no ponto pretendido
    return resultado.returncode


def _nomes(caminho_db: Path) -> list[str]:
    return list(H.listar_importacoes(caminho_db)[0]["nome_ficheiro"])


def _integra(caminho_db: Path) -> bool:
    with P.ligar(caminho_db) as ligacao:
        return P.verificar_integridade(ligacao) == "ok"


def _hash(caminho: Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def _envelhecer(*ficheiros: Path, segundos: float) -> None:
    for ficheiro in ficheiros:
        momento = time.time() - segundos
        os.utime(ficheiro, (momento, momento))


def _com_copia(base_dados: Path, pasta_copia: Path) -> Path:
    """Base com dia1 e dia2; a cópia só tem dia1."""
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, pasta_copia).caminho
    guardar(base_dados, DIA2, "dia2.csv")
    return copia


# Importação ---------------------------------------------------------------------------------------

def test_importacao_interrompida_nao_deixa_nada_a_meio(base_dados):
    guardar(base_dados, DIA1, "dia1.csv")
    _interromper("importacao", base_dados)
    assert _integra(base_dados)
    lista = H.listar_importacoes(base_dados)[0].set_index("id")
    assert lista.loc[1, "estado"] == H.CONCLUIDA and lista.loc[2, "estado"] == H.EM_PROCESSAMENTO
    assert H.carregar_fotografia(base_dados, 2).empty and len(H.carregar_fotografia(base_dados, 1)) == 300
    # Passados 2 minutos (simulado), o arranque seguinte marca-a como falhada.
    with P.ligar(base_dados) as ligacao, P.transacao(ligacao):
        ligacao.execute("UPDATE importacoes SET iniciada_em = '2026-01-01T00:00:00+00:00' WHERE id = 2")
    assert P.preparar_base_dados(base_dados).interrompidas_marcadas == 1
    assert H.obter_importacao(base_dados, 2)["estado"] == H.FALHADA


def test_importacao_interrompida_bloqueia_o_mesmo_ficheiro_so_dois_minutos():
    assert P.MINUTOS_ATE_INTERROMPIDA == 2


# Recuperação de cópias ---------------------------------------------------------------------------------

@pytest.mark.parametrize("ponto, esperado", [
    ("antes-de-preservar", ["dia2.csv", "dia1.csv"]),
    ("depois-de-preservar", ["dia2.csv", "dia1.csv"]),
    ("durante-a-substituicao", ["dia2.csv", "dia1.csv"]),
    ("antes-da-verificacao-final", ["dia1.csv"]),
])
def test_recuperacao_interrompida_deixa_sempre_uma_base_valida(base_dados, tmp_path, ponto, esperado):
    copia = _com_copia(base_dados, tmp_path)
    _interromper(f"recuperar-{ponto}", base_dados, str(copia))
    # A base em uso continua inteira: ou a de antes, ou já a recuperada — nunca uma mistura.
    assert _integra(base_dados) and _nomes(base_dados) == esperado
    # O bloqueio de manutenção ficou para trás: enquanto «vivo», as outras janelas não gravam.
    bloqueio = P.caminho_manutencao(base_dados)
    assert bloqueio.exists() and P.manutencao_ativa(base_dados)
    with pytest.raises(P.ManutencaoEmCurso):
        guardar(base_dados, csv_bytes(CABECALHO, "C1;X;01/10/2026;Porto;Pendente"), "dia3.csv")
    # Sem sinal de vida há mais de um minuto, é ignorado.
    _envelhecer(bloqueio, segundos=P.SEGUNDOS_MANUTENCAO_ABANDONADA + 5)
    assert not P.manutencao_ativa(base_dados)
    # Os temporários da recuperação interrompida são limpos quando têm mais de uma hora.
    temporarios = list(base_dados.parent.glob(".recuperacao-*"))
    assert temporarios
    _envelhecer(*temporarios, segundos=2 * 3600)
    info = P.preparar_base_dados(base_dados)
    assert info.temporarios_limpos >= 1 and not list(base_dados.parent.glob(".recuperacao-*"))
    assert _nomes(base_dados) == esperado
    assert guardar(base_dados, csv_bytes(CABECALHO, "C1;X;01/10/2026;Porto;Pendente"), "dia3.csv").situacao == H.GUARDADA


@pytest.mark.parametrize("ponto", ["danificada-depois-de-preservar", "danificada-antes-da-troca"])
def test_recuperacao_interrompida_com_base_danificada_nunca_deixa_base_vazia(base_dados, tmp_path, ponto):
    """A lacuna A1: antes, a base danificada era movida e, se o processo terminasse, o arranque
    seguinte criava uma base vazia. Agora é copiada byte a byte e trocada de uma só vez."""
    copia = _com_copia(base_dados, tmp_path)
    with P.ligar(base_dados) as ligacao:
        ligacao.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    base_dados.write_bytes(b"danificada" * 500)
    wal = Path(f"{base_dados}-wal")
    wal.write_bytes(b"conteudo do wal antigo")
    originais = {"": _hash(base_dados), "-wal": _hash(wal)}

    _interromper(f"recuperar-{ponto}", base_dados, str(copia))
    assert base_dados.exists() and _hash(base_dados) == originais[""]  # a danificada continua no lugar
    with pytest.raises(P.BaseDadosDanificada):
        P.preparar_base_dados(base_dados)  # o arranque seguinte não cria uma base vazia
    [guardada] = list((base_dados.parent / P.NOME_PASTA_COPIAS).glob("logiflow-danificada-*.db"))
    assert _hash(guardada) == originais[""] and _hash(Path(f"{guardada}-wal")) == originais["-wal"]
    # Com o bloqueio abandonado, a recuperação pode ser repetida e conclui-se.
    _envelhecer(P.caminho_manutencao(base_dados), segundos=P.SEGUNDOS_MANUTENCAO_ABANDONADA + 5)
    resultado = B.restaurar_copia(base_dados, copia)
    assert resultado.base_anterior_danificada and _nomes(base_dados) == ["dia1.csv"]


def test_base_danificada_nunca_e_aberta_pelo_sqlite_antes_de_ser_guardada(base_dados, tmp_path):
    """A lacuna A2: abrir uma base danificada pode apagar ou alterar o -wal. Os três ficheiros
    são guardados byte a byte, iguais aos originais."""
    copia = _com_copia(base_dados, tmp_path)
    with P.ligar(base_dados) as ligacao:
        ligacao.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    base_dados.write_bytes(b"danificada" * 500)
    for sufixo, conteudo in (("-wal", b"wal da base danificada"), ("-shm", b"shm da base danificada")):
        Path(f"{base_dados}{sufixo}").write_bytes(conteudo)
    resultado = B.restaurar_copia(base_dados, copia)
    guardada = resultado.preservada_em
    assert Path(f"{guardada}-wal").read_bytes() == b"wal da base danificada"
    assert Path(f"{guardada}-shm").read_bytes() == b"shm da base danificada"
    assert guardada.read_bytes() == b"danificada" * 500


def test_copia_interrompida_nunca_aparece_como_copia(base_dados, tmp_path):
    guardar(base_dados, DIA1)
    destino = tmp_path / "pen"
    destino.mkdir()
    _interromper("copia", base_dados, str(destino))
    parciais = list(destino.glob("*.parcial*"))
    assert parciais and B.listar_copias(destino) == []  # nada com nome de cópia
    _envelhecer(*parciais, segundos=2 * 3600)
    info = B.criar_copia(base_dados, destino)  # a cópia seguinte limpa as interrompidas antigas
    assert info.valida and B.listar_copias(destino) == [info.caminho]
    assert not list(destino.glob("*.parcial*"))


def test_copia_parcial_recente_nao_e_apagada(base_dados, tmp_path):
    """Uma cópia em curso noutra janela (recente) nunca é apagada pela limpeza."""
    guardar(base_dados, DIA1)
    em_curso = tmp_path / "logiflow-copia-20261020-120000.db.parcial"
    em_curso.write_bytes(b"a ser escrita")
    B.criar_copia(base_dados, tmp_path)
    assert em_curso.exists()


# Migrações ------------------------------------------------------------------------------------------------

def test_migracao_interrompida_e_desfeita_e_repetida_no_arranque_seguinte(base_dados):
    guardar(base_dados, DIA1, "dia1.csv")
    atual = P.esquema_atual()
    _interromper("migracao", base_dados)
    with P.ligar(base_dados) as ligacao:
        _, versao, tabelas = P.ler_identificacao(ligacao)
    assert versao == atual and "futura" not in tabelas and _integra(base_dados)
    # A cópia de antes da migração foi publicada (validada) antes de se mexer na base.
    [copia] = list((base_dados.parent / P.NOME_PASTA_COPIAS).glob("logiflow-antes-migracao-*.db"))
    assert B.validar_copia(copia).valida and not list(copia.parent.glob("*.parcial"))
    assert _nomes(base_dados) == ["dia1.csv"]


def test_migracao_real_do_esquema_1_interrompida(pasta_dados_temporaria, monkeypatch):
    caminho = P.caminho_base_dados()
    with monkeypatch.context() as m:
        m.setattr(P, "MIGRACOES", {1: P.MIGRACOES[1]})
        P.preparar_base_dados(caminho)
    _interromper("migracao-1-para-2", caminho)
    with P.ligar(caminho) as ligacao:
        _, versao, tabelas = P.ler_identificacao(ligacao)
    assert versao == 1 and "eliminacoes" not in tabelas
    info = P.preparar_base_dados(caminho)
    assert (info.migrada_de, info.versao_esquema) == (1, 2)


# Eliminação ------------------------------------------------------------------------------------------------

def test_eliminacao_interrompida_e_concluida_no_arranque_seguinte(base_dados):
    guardar(base_dados, DIA1, "dia1.csv")
    _interromper("eliminar", base_dados, "1")
    # A eliminação não chegou a ser confirmada na base, mas ficou no registo à parte.
    assert len(H.carregar_fotografia(base_dados, 1)) == 300
    assert len(R.ler_registo(base_dados)[0]["eliminacoes"]) == 1
    resumo = R.aplicar_conservacao(base_dados)
    assert resumo.por_registo == 1 and H.carregar_fotografia(base_dados, 1).empty


# Outras janelas: bloqueio de manutenção e base ocupada --------------------------------------------------

def test_janela_que_grava_durante_uma_recuperacao_nao_perde_dados(base_dados, tmp_path, monkeypatch):
    """A lacuna A4: uma gravação começada noutra janela antes da recuperação termina e fica na
    cópia da base em uso (a recuperação espera por ela). As gravações começadas depois são
    recusadas — ver ``test_bloqueio_de_manutencao_de_outra_janela``."""
    copia = _com_copia(base_dados, tmp_path)
    dentro, continuar = threading.Event(), threading.Event()
    original = H._inserir_fotografia

    def inserir_devagar(ligacao, importacao_id, linhas):
        original(ligacao, importacao_id, linhas)
        dentro.set()
        continuar.wait(10)

    monkeypatch.setattr(H, "_inserir_fotografia", inserir_devagar)
    resultados, erros = {}, []

    def correr(nome, funcao):
        try:
            resultados[nome] = funcao()
        except Exception as erro:  # pragma: no cover — mostrado no assert
            erros.append(erro)

    janela = threading.Thread(target=correr, args=("janela", lambda: guardar(
        base_dados, csv_bytes(CABECALHO, "C1;X;01/10/2026;Porto;Pendente"), "dia3.csv")))
    janela.start()
    assert dentro.wait(10)  # a outra janela está a meio da gravação, com a base bloqueada para escrita
    recuperacao = threading.Thread(target=correr, args=("recuperacao", lambda: B.restaurar_copia(base_dados, copia)))
    recuperacao.start()
    for _ in range(50):  # a recuperação já começou: bloqueio criado, à espera da gravação
        if P.manutencao_ativa(base_dados):
            break
        time.sleep(0.05)
    assert P.manutencao_ativa(base_dados)
    continuar.set()
    janela.join(20)
    recuperacao.join(60)
    assert not erros, erros
    assert resultados["janela"].situacao == H.GUARDADA
    preservada = resultados["recuperacao"].preservada_em
    assert _nomes(preservada) == ["dia3.csv", "dia2.csv", "dia1.csv"]  # a gravação da outra janela não se perdeu
    assert _nomes(base_dados) == ["dia1.csv"] and not P.manutencao_ativa(base_dados)


def test_recuperacao_com_a_base_ocupada_desiste_sem_alterar_nada(base_dados, tmp_path, monkeypatch):
    copia = _com_copia(base_dados, tmp_path)
    monkeypatch.setattr(P, "TEMPO_ESPERA_S", 0.5)
    outra = subprocess.Popen([sys.executable, "-c", (
        "import sqlite3,sys,time; c=sqlite3.connect(sys.argv[1], isolation_level=None); c.execute('BEGIN IMMEDIATE');"
        "print('ok', flush=True); time.sleep(20)"), str(base_dados)], stdout=subprocess.PIPE, text=True)
    try:
        outra.stdout.readline()
        inicio = time.monotonic()
        with pytest.raises(sqlite3.OperationalError) as erro:
            B.restaurar_copia(base_dados, copia)
        assert time.monotonic() - inicio < 10  # antes ficava à espera sem limite
        assert "ocupada" in P.mensagem_segura(erro.value)
    finally:
        outra.kill()
        outra.wait()
    assert _nomes(base_dados) == ["dia2.csv", "dia1.csv"]
    assert not P.manutencao_ativa(base_dados) and not list(base_dados.parent.glob(".recuperacao-*"))


def test_copia_de_paginas_desiste_se_o_destino_continuar_ocupado(tmp_path, monkeypatch):
    """A lacuna A3: a API de cópia do Python repete sem fim enquanto a base está ocupada."""
    monkeypatch.setattr(P, "TEMPO_MAXIMO_OCUPADA_S", 1.0)
    origem, destino = tmp_path / "origem.db", tmp_path / "destino.db"
    P.preparar_base_dados(origem)
    P.preparar_base_dados(destino)
    outra = subprocess.Popen([sys.executable, "-c", (
        "import sqlite3,sys,time; c=sqlite3.connect(sys.argv[1], isolation_level=None); c.execute('BEGIN IMMEDIATE');"
        "c.execute(\"INSERT INTO eventos (momento, tipo) VALUES ('x','outra')\"); print('ok', flush=True); time.sleep(20)"),
        str(destino)], stdout=subprocess.PIPE, text=True)
    try:
        outra.stdout.readline()
        inicio = time.monotonic()
        with P.ligar(origem) as fonte:
            alvo = sqlite3.connect(destino, timeout=0.2, isolation_level=None)
            try:
                with pytest.raises(P.BaseDadosOcupada, match="continuou ocupada"):
                    P.copiar_paginas(fonte, alvo)
            finally:
                alvo.close()
        assert time.monotonic() - inicio < 8
    finally:
        outra.kill()
        outra.wait()


def test_bloqueio_de_manutencao_de_outra_janela(base_dados):
    """Com uma recuperação a decorrer noutro processo, nenhuma escrita é feita aqui."""
    guardar(base_dados, DIA1, "dia1.csv")
    outra = subprocess.Popen([sys.executable, "-m", "tests.processo_interrompido", "manutencao", str(base_dados)],
                             cwd=RAIZ, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    try:
        assert outra.stdout.readline().strip() == "bloqueado"
        for acao in (lambda: guardar(base_dados, DIA2, "dia2.csv"), lambda: R.eliminar_importacao(base_dados, 1),
                     lambda: R.definir_prazo(base_dados, 12), lambda: P.preparar_base_dados(base_dados)):
            with pytest.raises(P.ManutencaoEmCurso):
                acao()
        with pytest.raises(P.ManutencaoEmCurso, match="Já está a decorrer"):
            with P.bloqueio_manutencao(base_dados, "outra"):
                pass
    finally:
        outra.communicate("fim\n", timeout=30)
    assert not P.caminho_manutencao(base_dados).exists()
    assert _nomes(base_dados) == ["dia1.csv"] and len(H.carregar_fotografia(base_dados, 1)) == 300


# Base com erros nos dados (lacuna A5) ------------------------------------------------------------------

def _danificar_paginas_de_dados(caminho_db: Path) -> None:
    with P.ligar(caminho_db) as ligacao:
        ligacao.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        paginas = ligacao.execute("PRAGMA page_count").fetchone()[0]
    dados = bytearray(caminho_db.read_bytes())
    meio = (paginas // 2) * 4096
    dados[meio + 8:meio + 4096] = b"\x5a" * (4096 - 8)
    caminho_db.write_bytes(bytes(dados))


def test_base_com_erros_nos_dados_fica_so_de_leitura(base_dados, tmp_path):
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, tmp_path).caminho
    guardar(base_dados, DIA2, "dia2.csv")
    _danificar_paginas_de_dados(base_dados)
    antes = _hash(base_dados)
    info = P.preparar_base_dados(base_dados)
    assert not info.integra and info.verificacao != "ok"  # detetado no arranque, sem lançar erro
    assert _hash(base_dados) == antes  # e sem gravar nada (nem as marcações do arranque)
    # Não é descartada: a cópia fica «com erros», para salvar dados, e não serve para recuperar.
    resultado = B.criar_copia(base_dados, tmp_path)
    assert not resultado.valida and resultado.com_erros
    assert resultado.caminho.name.startswith("logiflow-copia-com-erros-") and resultado.caminho.exists()
    assert "não serve para recuperar" in resultado.mensagem
    with pytest.raises(P.ErroPersistencia, match="A cópia não foi recuperada"):
        B.restaurar_copia(base_dados, resultado.caminho)
    # A cópia boa recupera; a base com erros fica guardada, byte a byte.
    recuperado = B.restaurar_copia(base_dados, copia)
    assert recuperado.base_anterior_danificada and _hash(recuperado.preservada_em) == antes
    assert _nomes(base_dados) == ["dia1.csv"] and P.preparar_base_dados(base_dados).integra


def test_migracao_de_uma_base_com_erros_e_recusada_sem_alteracoes(pasta_dados_temporaria, monkeypatch):
    caminho = P.caminho_base_dados()
    with monkeypatch.context() as m:
        m.setattr(P, "MIGRACOES", {1: P.MIGRACOES[1]})
        P.preparar_base_dados(caminho)
        with P.ligar(caminho) as ligacao, P.transacao(ligacao):
            ligacao.executemany("INSERT INTO eventos (momento, tipo, detalhe) VALUES ('x', 'enchimento', ?)",
                                [("y" * 500,) for _ in range(200)])
    _danificar_paginas_de_dados(caminho)
    antes = _hash(caminho)
    with pytest.raises(P.BaseDadosDanificada, match="A base de dados não foi alterada"):
        P.preparar_base_dados(caminho)
    assert _hash(caminho) == antes
    assert not list((caminho.parent / P.NOME_PASTA_COPIAS).glob("*.db"))  # nenhuma cópia «válida» publicada


def test_ficheiro_em_uso_no_windows_deixa_tudo_como_estava(base_dados, tmp_path, monkeypatch):
    """Simula o Windows a recusar a troca (ficheiro aberto por outro programa): a base danificada e
    os seus auxiliares ficam exatamente como estavam e a mensagem explica o motivo."""
    copia = _com_copia(base_dados, tmp_path)
    with P.ligar(base_dados) as ligacao:
        ligacao.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    base_dados.write_bytes(b"danificada" * 500)
    wal = Path(f"{base_dados}-wal")
    wal.write_bytes(b"wal da base danificada")
    antes = (_hash(base_dados), _hash(wal))
    real = os.replace

    def em_uso(origem, destino):
        if Path(destino) == base_dados:
            erro = PermissionError(13, "O ficheiro está a ser utilizado por outro processo")
            erro.winerror = 32
            raise erro
        return real(origem, destino)

    monkeypatch.setattr(os, "replace", em_uso)
    with pytest.raises(PermissionError) as erro:
        B.restaurar_copia(base_dados, copia)
    monkeypatch.setattr(os, "replace", real)
    assert "está a ser usado por outro programa" in P.mensagem_segura(erro.value)
    assert (_hash(base_dados), _hash(wal)) == antes
    assert not P.manutencao_ativa(base_dados) and not list(base_dados.parent.glob(".recuperacao-*"))
