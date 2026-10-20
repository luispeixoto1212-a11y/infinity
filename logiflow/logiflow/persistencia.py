"""Persistência local em SQLite: onde ficam os dados, ligações, esquema e migrações.

Princípios:

* A base de dados fica numa pasta de dados do utilizador, própria do sistema
  operativo — nunca na pasta de instalação nem na pasta de trabalho atual:

  - Windows: ``%LOCALAPPDATA%\\LogiFlow``
  - macOS: ``~/Library/Application Support/LogiFlow``
  - Linux: ``$XDG_DATA_HOME/logiflow`` (por omissão ``~/.local/share/logiflow``)

  A variável de ambiente ``LOGIFLOW_DADOS`` (caminho absoluto) permite escolher
  outra pasta; os testes usam-na para trabalhar em pastas temporárias.
* O esquema é versionado (``PRAGMA user_version``) e só evolui por migrações
  explícitas e não destrutivas. Antes de migrar uma base de dados com dados, é
  feita uma cópia de segurança automática.
* Uma base de dados danificada, de outra aplicação ou de uma versão mais recente
  **nunca** é substituída nem apagada: a operação é recusada com uma mensagem.
* Cada operação abre e fecha a sua própria ligação; as alterações de vários
  registos fazem-se numa transação; as consultas são sempre parametrizadas.
"""

from __future__ import annotations

import contextlib
import datetime as dt
import errno
import os
import sqlite3
import sys
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

NOME_APLICACAO = "LogiFlow"
NOME_BASE_DADOS = "logiflow.db"
NOME_PASTA_COPIAS = "copias"
VARIAVEL_PASTA = "LOGIFLOW_DADOS"
APLICACAO_ID = 0x4C474657  # «LGFW»: identifica um ficheiro SQLite como base de dados do LogiFlow
TEMPO_ESPERA_S = 5.0       # espera máxima por uma base de dados ocupada por outra janela
MINUTOS_ATE_INTERROMPIDA = 10
TAMANHO_MAXIMO_MENSAGEM = 500

TABELAS_OBRIGATORIAS = frozenset({"importacoes", "encomendas_historico", "eventos"})


class ErroPersistencia(Exception):
    """Erro com uma mensagem pronta a mostrar ao utilizador."""


class BaseDadosDanificada(ErroPersistencia):
    pass


class BaseDadosIncompativel(ErroPersistencia):
    pass


# Pasta de dados ------------------------------------------------------------------

def _casa(ambiente: Mapping[str, str], plataforma: str) -> Path:
    variavel = "USERPROFILE" if plataforma.startswith("win") else "HOME"
    return Path(ambiente[variavel]) if ambiente.get(variavel) else Path.home()


def pasta_dados(ambiente: Mapping[str, str] | None = None, plataforma: str | None = None) -> Path:
    """Pasta onde ficam a base de dados e as cópias de segurança (não é criada aqui)."""
    ambiente = os.environ if ambiente is None else ambiente
    plataforma = sys.platform if plataforma is None else plataforma
    escolhida = ambiente.get(VARIAVEL_PASTA, "").strip()
    if escolhida:
        caminho = Path(escolhida).expanduser()
        if not caminho.is_absolute():
            raise ErroPersistencia(f"A variável {VARIAVEL_PASTA} tem de indicar um caminho absoluto.")
        return caminho
    if plataforma.startswith("win"):
        base = ambiente.get("LOCALAPPDATA") or ambiente.get("APPDATA")
        return (Path(base) if base else _casa(ambiente, plataforma) / "AppData" / "Local") / NOME_APLICACAO
    if plataforma == "darwin":
        return _casa(ambiente, plataforma) / "Library" / "Application Support" / NOME_APLICACAO
    xdg = ambiente.get("XDG_DATA_HOME", "")  # caminho POSIX: verificado com as regras POSIX
    base = Path(xdg) if xdg and PurePosixPath(xdg).is_absolute() else _casa(ambiente, plataforma) / ".local" / "share"
    return base / "logiflow"


def caminho_base_dados(pasta: Path | None = None) -> Path:
    return (pasta if pasta is not None else pasta_dados()) / NOME_BASE_DADOS


def criar_pasta(pasta: Path) -> Path:
    """Cria a pasta (e as intermédias) só para o utilizador atual, se ainda não existir.

    Em Windows, a pasta fica no perfil do utilizador, que já é privado; em Linux e
    macOS, uma pasta criada aqui fica com permissões 700. Uma pasta já existente não
    é alterada.
    """
    if not pasta.exists():
        pasta.mkdir(parents=True, mode=0o700)
        if os.name == "posix":
            os.chmod(pasta, 0o700)  # o mkdir está sujeito à umask
    elif not pasta.is_dir():
        raise ErroPersistencia(f"O caminho de dados existe mas não é uma pasta: {pasta}")
    return pasta


# Ligações e transações -------------------------------------------------------------

def agora_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


@contextlib.contextmanager
def ligar(caminho: Path, *, so_leitura: bool = False) -> Iterator[sqlite3.Connection]:
    """Ligação à base de dados, sempre fechada no fim.

    ``so_leitura`` abre o ficheiro sem o poder alterar nem criar (usado para validar
    cópias de segurança).
    """
    if so_leitura:
        ligacao = sqlite3.connect(f"{Path(caminho).resolve().as_uri()}?mode=ro&immutable=1", uri=True,
                                  timeout=TEMPO_ESPERA_S, isolation_level=None)
    else:
        ligacao = sqlite3.connect(str(caminho), timeout=TEMPO_ESPERA_S, isolation_level=None)
    try:
        ligacao.execute("PRAGMA foreign_keys = ON")
        ligacao.execute(f"PRAGMA busy_timeout = {int(TEMPO_ESPERA_S * 1000)}")
        yield ligacao
    finally:
        ligacao.close()


@contextlib.contextmanager
def transacao(ligacao: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """Tudo ou nada: confirma no fim ou desfaz se ocorrer qualquer erro."""
    ligacao.execute("BEGIN IMMEDIATE")
    try:
        yield ligacao
    except BaseException:
        ligacao.execute("ROLLBACK")
        raise
    ligacao.execute("COMMIT")


def mensagem_segura(erro: BaseException) -> str:
    """Mensagem curta para guardar: as mensagens próprias da aplicação (que não contêm
    dados das encomendas) ou apenas o tipo de erro técnico."""
    from .importacao import ErroImportacao  # importação local: evita dependência circular

    if isinstance(erro, (ErroImportacao, ErroPersistencia)):
        texto = str(erro)
    elif isinstance(erro, sqlite3.OperationalError) and "locked" in str(erro).lower():
        texto = "A base de dados estava ocupada por outra janela do LogiFlow."
    elif isinstance(erro, PermissionError):
        texto = "Sem permissão para escrever na pasta de dados do LogiFlow."
    elif isinstance(erro, OSError) and erro.errno == errno.ENOSPC:
        texto = "Não há espaço livre no disco."
    elif isinstance(erro, sqlite3.DatabaseError) and "full" in str(erro).lower():
        texto = "Não há espaço livre no disco."
    elif isinstance(erro, sqlite3.DatabaseError) and any(
            sinal in str(erro).lower() for sinal in ("malformed", "not a database", "corrupt")):
        texto = ("A base de dados do histórico não pode ser lida (pode estar danificada). Pode recuperar uma "
                 "cópia de segurança no separador «Histórico».")
    else:
        texto = f"Erro técnico ({type(erro).__name__})."
    return texto[:TAMANHO_MAXIMO_MENSAGEM]


def registar_evento(ligacao: sqlite3.Connection, tipo: str, importacao_id: int | None = None,
                    detalhe: str = "") -> None:
    """Regista uma operação. ``detalhe`` nunca deve conter dados das encomendas."""
    ligacao.execute("INSERT INTO eventos (momento, tipo, importacao_id, detalhe) VALUES (?, ?, ?, ?)",
                    (agora_utc(), tipo, importacao_id, detalhe[:TAMANHO_MAXIMO_MENSAGEM]))


# Esquema e migrações ----------------------------------------------------------------
# Cada migração é uma lista de instruções aplicadas numa só transação. Só se acrescentam
# tabelas, colunas e índices: nenhuma migração apaga ou reescreve dados.

_MIGRACAO_1 = (
    """CREATE TABLE importacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        iniciada_em TEXT NOT NULL,
        concluida_em TEXT,
        nome_ficheiro TEXT NOT NULL,
        origem TEXT NOT NULL CHECK (origem IN ('ficheiro', 'exemplo')),
        tamanho_bytes INTEGER,
        hash_conteudo TEXT NOT NULL,
        folha TEXT,
        mapeamento TEXT,
        impressao_digital TEXT NOT NULL,
        versao_formato INTEGER NOT NULL,
        versao_aplicacao TEXT NOT NULL,
        estado TEXT NOT NULL CHECK (estado IN ('em_processamento', 'concluida', 'concluida_com_avisos', 'falhada')),
        linhas_lidas INTEGER,
        encomendas_validas INTEGER,
        linhas_com_erros INTEGER,
        linhas_com_avisos INTEGER,
        data_referencia TEXT,
        prazo_padrao_dias INTEGER,
        ind_entregues INTEGER,
        ind_pendentes INTEGER,
        ind_atrasadas INTEGER,
        exc_alta INTEGER,
        exc_media INTEGER,
        exc_baixa INTEGER,
        mensagem_erro TEXT,
        importacao_anterior_id INTEGER REFERENCES importacoes (id)
    )""",
    """CREATE TABLE encomendas_historico (
        id INTEGER PRIMARY KEY,
        importacao_id INTEGER NOT NULL REFERENCES importacoes (id) ON DELETE CASCADE,
        linha INTEGER NOT NULL,
        numero TEXT NOT NULL,
        chave TEXT,
        cliente TEXT NOT NULL,
        destino TEXT NOT NULL,
        estado TEXT NOT NULL,
        estado_original TEXT NOT NULL,
        estado_reconhecido INTEGER NOT NULL CHECK (estado_reconhecido IN (0, 1)),
        data TEXT,
        data_original TEXT,
        data_prevista TEXT,
        data_prevista_original TEXT,
        data_entrega TEXT,
        data_entrega_original TEXT,
        tem_erro INTEGER NOT NULL CHECK (tem_erro IN (0, 1)),
        erros TEXT NOT NULL,
        avisos TEXT NOT NULL,
        UNIQUE (importacao_id, linha)
    )""",
    """CREATE TABLE eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        momento TEXT NOT NULL,
        tipo TEXT NOT NULL,
        importacao_id INTEGER REFERENCES importacoes (id) ON DELETE SET NULL,
        detalhe TEXT NOT NULL DEFAULT ''
    )""",
    "CREATE INDEX ix_importacoes_impressao ON importacoes (impressao_digital, estado)",
    "CREATE INDEX ix_importacoes_iniciada ON importacoes (iniciada_em)",
    "CREATE INDEX ix_historico_importacao_chave ON encomendas_historico (importacao_id, chave)",
    "CREATE INDEX ix_eventos_momento ON eventos (momento)",
)

MIGRACOES: dict[int, tuple[str, ...]] = {1: _MIGRACAO_1}


def esquema_atual() -> int:
    return max(MIGRACOES)


@dataclass(frozen=True)
class InfoBaseDados:
    caminho: Path
    versao_esquema: int
    criada: bool
    migrada_de: int | None
    copia_antes_da_migracao: Path | None
    interrompidas_marcadas: int


def ler_identificacao(ligacao: sqlite3.Connection) -> tuple[int, int, set[str]]:
    """(application_id, user_version, tabelas). Lança ``sqlite3.DatabaseError`` se o
    ficheiro não for uma base de dados SQLite legível."""
    app_id = ligacao.execute("PRAGMA application_id").fetchone()[0]
    versao = ligacao.execute("PRAGMA user_version").fetchone()[0]
    tabelas = {r[0] for r in ligacao.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    return app_id, versao, tabelas


def verificar_compatibilidade(app_id: int, versao: int, tabelas: set[str], descricao: str) -> bool:
    """Devolve ``True`` se o ficheiro ainda estiver vazio (pode ser inicializado).

    Lança ``BaseDadosIncompativel`` se não for do LogiFlow ou for de uma versão mais recente.
    """
    if app_id != APLICACAO_ID:
        if app_id == 0 and versao == 0 and not tabelas:
            return True
        raise BaseDadosIncompativel(
            f"{descricao} não é uma base de dados do LogiFlow. Não foi alterada.")
    if versao > esquema_atual():
        raise BaseDadosIncompativel(
            f"{descricao} foi criada por uma versão mais recente do LogiFlow (esquema {versao}; esta versão "
            f"conhece até ao {esquema_atual()}). Atualize a aplicação. Nada foi alterado.")
    em_falta = TABELAS_OBRIGATORIAS - tabelas
    if versao >= 1 and em_falta:
        raise BaseDadosIncompativel(f"{descricao} está incompleta (faltam tabelas). Não foi alterada.")
    return False


def copiar_sqlite(origem: Path, destino: Path, *, origem_so_leitura: bool = False) -> None:
    """Cópia consistente (API de cópia do SQLite) para um ficheiro **novo**, num só ficheiro
    autónomo (modo de diário DELETE). Nunca sobrescreve um ficheiro existente.

    ``origem_so_leitura`` lê a origem sem a poder alterar (usado com cópias de segurança)."""
    with open(destino, "xb"):  # criação exclusiva: falha se já existir
        pass
    try:
        with ligar(origem, so_leitura=origem_so_leitura) as fonte:
            alvo = sqlite3.connect(str(destino), isolation_level=None)
            try:
                fonte.backup(alvo)
                alvo.execute("PRAGMA journal_mode = DELETE")
            finally:
                alvo.close()
    except BaseException:
        destino.unlink(missing_ok=True)  # só o ficheiro novo, criado agora, e incompleto
        raise


def nome_unico(pasta: Path, prefixo: str, momento: dt.datetime | None = None) -> Path:
    """``prefixo-AAAAMMDD-HHMMSS.db``; se já existir, acrescenta ``-2``, ``-3``…"""
    carimbo = (momento or dt.datetime.now()).strftime("%Y%m%d-%H%M%S")
    candidato = pasta / f"{prefixo}-{carimbo}.db"
    n = 2
    while candidato.exists():
        candidato = pasta / f"{prefixo}-{carimbo}-{n}.db"
        n += 1
    return candidato


def preparar_base_dados(caminho: Path, *, copia_antes_de_migrar: bool = True) -> InfoBaseDados:
    """Cria ou atualiza a base de dados. Idempotente: pode ser chamada em cada arranque.

    Nunca substitui nem apaga uma base de dados existente: se estiver danificada ou for
    incompatível, lança uma exceção e deixa o ficheiro como estava.
    """
    criar_pasta(caminho.parent)
    nova = not caminho.exists() or caminho.stat().st_size == 0
    if not nova:
        try:
            with ligar(caminho) as ligacao:
                app_id, versao, tabelas = ler_identificacao(ligacao)
        except sqlite3.DatabaseError:
            raise BaseDadosDanificada(
                "A base de dados do histórico não pode ser lida (pode estar danificada). Não foi alterada "
                "nem apagada. Pode recuperar uma cópia de segurança no separador «Histórico».") from None
        nova = verificar_compatibilidade(app_id, versao, tabelas, "A base de dados do histórico")
    if nova:
        versao = 0

    copia = None
    if not nova and versao < esquema_atual() and copia_antes_de_migrar:
        pasta_copias = criar_pasta(caminho.parent / NOME_PASTA_COPIAS)
        copia = nome_unico(pasta_copias, f"logiflow-antes-migracao-v{versao}-para-v{esquema_atual()}")
        copiar_sqlite(caminho, copia)

    with ligar(caminho) as ligacao:
        for numero in range(versao + 1, esquema_atual() + 1):
            with transacao(ligacao):
                if ligacao.execute("PRAGMA user_version").fetchone()[0] >= numero:
                    continue  # outra janela (ou outro processo) já aplicou esta migração
                for instrucao in MIGRACOES[numero]:
                    ligacao.execute(instrucao)
                if numero == 1:
                    ligacao.execute(f"PRAGMA application_id = {APLICACAO_ID}")
                ligacao.execute(f"PRAGMA user_version = {numero}")
                registar_evento(ligacao, "base_dados_criada" if numero == 1 else "migracao",
                                detalhe=f"esquema {numero}")
        ligacao.execute("PRAGMA journal_mode = WAL")
        marcadas = marcar_interrompidas(ligacao)
    return InfoBaseDados(caminho, esquema_atual(), nova, None if nova or versao == esquema_atual() else versao,
                         copia, marcadas)


def marcar_interrompidas(ligacao: sqlite3.Connection, minutos: int = MINUTOS_ATE_INTERROMPIDA) -> int:
    """Importações que ficaram «em processamento» (a aplicação foi fechada a meio) passam a
    «falhada». Os dados dessas importações nunca chegaram a ser confirmados."""
    limite = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=minutos)).isoformat(timespec="seconds")
    with transacao(ligacao):
        cursor = ligacao.execute(
            "UPDATE importacoes SET estado = 'falhada', concluida_em = ?, mensagem_erro = ? "
            "WHERE estado = 'em_processamento' AND iniciada_em < ?",
            (agora_utc(), "Interrompida antes de concluir (a aplicação foi fechada ou falhou). "
                          "Nenhum dado desta importação foi guardado.", limite))
    return cursor.rowcount


def verificar_integridade(ligacao: sqlite3.Connection) -> str:
    """``"ok"`` ou a primeira mensagem de erro do ``PRAGMA integrity_check``."""
    resultado = ligacao.execute("PRAGMA integrity_check").fetchall()
    return "ok" if resultado == [("ok",)] else str(resultado[0][0])
