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
  feita uma cópia de segurança automática (validada).
* Uma base de dados danificada, de outra aplicação ou de uma versão mais recente
  **nunca** é substituída nem apagada: a operação é recusada com uma mensagem.
* Cada operação abre e fecha a sua própria ligação; as alterações de vários
  registos fazem-se numa transação; as consultas são sempre parametrizadas.
* Uma cópia de um ficheiro SQLite é escrita primeiro com o sufixo ``.parcial`` e só
  recebe o nome final depois de validada: uma cópia interrompida nunca parece válida.
* Durante uma recuperação de cópia de segurança, um ficheiro de «manutenção» ao lado da
  base de dados impede as outras janelas de gravar (verificado dentro de cada transação).
"""

from __future__ import annotations

import contextlib
import datetime as dt
import errno
import json
import os
import sqlite3
import sys
import threading
import time
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

NOME_APLICACAO = "LogiFlow"
NOME_BASE_DADOS = "logiflow.db"
NOME_PASTA_COPIAS = "copias"
VARIAVEL_PASTA = "LOGIFLOW_DADOS"
APLICACAO_ID = 0x4C474657  # «LGFW»: identifica um ficheiro SQLite como base de dados do LogiFlow
TEMPO_ESPERA_S = 5.0       # espera máxima, por operação, por uma base de dados ocupada por outra janela
TEMPO_MAXIMO_OCUPADA_S = 30.0  # numa cópia (API de cópia do SQLite): desiste se continuar ocupada
MINUTOS_ATE_INTERROMPIDA = 2   # gravar 100 000 encomendas demora ~1,5 s: 2 minutos é muito folgado
SEGUNDOS_MANUTENCAO_ABANDONADA = 60  # o bloqueio de manutenção é renovado a cada 5 s enquanto dura
HORAS_ATE_LIMPAR_TEMPORARIOS = 1
TAMANHO_MAXIMO_MENSAGEM = 500

SUFIXO_PARCIAL = ".parcial"
SUFIXO_MANUTENCAO = ".manutencao"
PREFIXO_TEMPORARIO = ".recuperacao-"
SUFIXOS_AUXILIARES = ("-wal", "-shm", "-journal")
CABECALHO_SQLITE = b"SQLite format 3\x00"

TABELAS_POR_ESQUEMA = {
    1: frozenset({"importacoes", "encomendas_historico", "eventos"}),
    2: frozenset({"preferencias", "eliminacoes"}),
}
TABELAS_OBRIGATORIAS = TABELAS_POR_ESQUEMA[1]  # as do primeiro esquema (ver ``tabelas_obrigatorias``)

_WINERROR_EM_USO = {32, 33}  # ERROR_SHARING_VIOLATION, ERROR_LOCK_VIOLATION


class ErroPersistencia(Exception):
    """Erro com uma mensagem pronta a mostrar ao utilizador."""


class BaseDadosDanificada(ErroPersistencia):
    pass


class BaseDadosIncompativel(ErroPersistencia):
    pass


class BaseDadosOcupada(ErroPersistencia):
    pass


class ManutencaoEmCurso(ErroPersistencia):
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


# Bloqueio de manutenção (recuperação de cópias) ---------------------------------------

def caminho_manutencao(caminho_db: Path) -> Path:
    return Path(f"{caminho_db}{SUFIXO_MANUTENCAO}")


def manutencao_ativa(caminho_db: Path) -> bool:
    """Há uma recuperação em curso noutra janela? Um bloqueio sem sinal de vida há mais
    de ``SEGUNDOS_MANUTENCAO_ABANDONADA`` (a janela foi fechada a meio) é ignorado."""
    try:
        idade = time.time() - caminho_manutencao(caminho_db).stat().st_mtime
    except (FileNotFoundError, NotADirectoryError):
        return False
    return idade <= SEGUNDOS_MANUTENCAO_ABANDONADA


MENSAGEM_MANUTENCAO = ("Está a decorrer uma recuperação de cópia de segurança noutra janela do LogiFlow. "
                       "Nada foi gravado; tente de novo dentro de momentos.")


@contextlib.contextmanager
def bloqueio_manutencao(caminho_db: Path, operacao: str) -> Iterator[Path]:
    """Impede as outras janelas de gravar enquanto dura (ver ``transacao``). Um fio de
    execução renova o ficheiro a cada 5 s; se a aplicação for fechada a meio, o bloqueio
    fica abandonado e deixa de contar ao fim de ``SEGUNDOS_MANUTENCAO_ABANDONADA``."""
    ficheiro = caminho_manutencao(caminho_db)
    criar_pasta(ficheiro.parent)
    try:
        descritor = os.open(ficheiro, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        if manutencao_ativa(caminho_db):
            raise ManutencaoEmCurso("Já está a decorrer uma recuperação de cópia de segurança noutra janela "
                                    "do LogiFlow. Espere que termine.") from None
        ficheiro.unlink(missing_ok=True)  # abandonado por uma janela fechada a meio
        try:
            descritor = os.open(ficheiro, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            raise ManutencaoEmCurso("Já está a decorrer uma recuperação de cópia de segurança noutra janela "
                                    "do LogiFlow. Espere que termine.") from None
    with os.fdopen(descritor, "w", encoding="utf-8") as saida:
        json.dump({"operacao": operacao, "inicio": agora_utc()}, saida)
    parar = threading.Event()

    def renovar() -> None:
        while not parar.wait(5):
            with contextlib.suppress(OSError):
                os.utime(ficheiro)

    fio = threading.Thread(target=renovar, name="logiflow-manutencao", daemon=True)
    fio.start()
    try:
        yield ficheiro
    finally:
        parar.set()
        fio.join()
        ficheiro.unlink(missing_ok=True)


# Ligações e transações -------------------------------------------------------------

def agora_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


@contextlib.contextmanager
def ligar(caminho: Path, *, so_leitura: bool = False) -> Iterator[sqlite3.Connection]:
    """Ligação à base de dados, sempre fechada no fim.

    ``so_leitura`` abre o ficheiro sem o poder alterar nem criar (usado para validar
    cópias de segurança: não lê nem altera ficheiros ``-wal``).
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


def _recusar_durante_manutencao(ligacao: sqlite3.Connection) -> None:
    ficheiro = ligacao.execute("PRAGMA database_list").fetchone()[2]
    if ficheiro and manutencao_ativa(Path(ficheiro)):
        raise ManutencaoEmCurso(MENSAGEM_MANUTENCAO)


@contextlib.contextmanager
def transacao(ligacao: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """Tudo ou nada: confirma no fim ou desfaz se ocorrer qualquer erro.

    Já com o bloqueio de escrita do SQLite, verifica se há uma recuperação em curso noutra
    janela; se houver, não grava nada. Como a recuperação espera pelas gravações que já
    começaram antes de copiar a base atual, nenhuma gravação se perde entre as duas."""
    ligacao.execute("BEGIN IMMEDIATE")
    try:
        _recusar_durante_manutencao(ligacao)
        yield ligacao
    except BaseException:
        ligacao.execute("ROLLBACK")
        raise
    ligacao.execute("COMMIT")


def mensagem_segura(erro: BaseException) -> str:
    """Mensagem curta para mostrar e guardar: as mensagens próprias da aplicação (que não
    contêm dados das encomendas) ou uma explicação do problema técnico."""
    from .importacao import ErroImportacao  # importação local: evita dependência circular

    texto_erro = str(erro).lower()
    if isinstance(erro, (ErroImportacao, ErroPersistencia)):
        texto = str(erro)
    elif isinstance(erro, sqlite3.OperationalError) and ("locked" in texto_erro or "busy" in texto_erro):
        texto = "A base de dados estava ocupada por outra janela do LogiFlow."
    elif isinstance(erro, sqlite3.OperationalError) and "unable to open" in texto_erro:
        texto = ("Não foi possível abrir a base de dados do histórico: a pasta pode não estar acessível ou o "
                 "ficheiro estar a ser usado por outro programa.")
    elif isinstance(erro, sqlite3.DatabaseError) and "disk i/o" in texto_erro:
        texto = "Erro de leitura ou escrita no disco."
    elif isinstance(erro, PermissionError) and getattr(erro, "winerror", None) in _WINERROR_EM_USO:
        texto = ("O ficheiro está a ser usado por outro programa (por exemplo, outra janela do LogiFlow, um "
                 "antivírus ou um programa de sincronização). Feche-o e tente de novo.")
    elif isinstance(erro, PermissionError):
        texto = ("Sem permissão para alterar o ficheiro ou a pasta (pode também estar a ser usado por outro "
                 "programa, como outra janela do LogiFlow ou um antivírus).")
    elif isinstance(erro, FileNotFoundError):
        texto = ("Uma pasta ou um ficheiro deixou de estar disponível (por exemplo, uma pen USB retirada). "
                 "Verifique e tente de novo.")
    elif isinstance(erro, OSError) and erro.errno == errno.ENOSPC:
        texto = "Não há espaço livre no disco."
    elif isinstance(erro, OSError) and erro.errno == errno.EROFS:
        texto = "A pasta só permite leitura."
    elif isinstance(erro, sqlite3.DatabaseError) and "full" in texto_erro:
        texto = "Não há espaço livre no disco."
    elif isinstance(erro, sqlite3.DatabaseError) and any(
            sinal in texto_erro for sinal in ("malformed", "not a database", "corrupt")):
        texto = ("A base de dados do histórico não pode ser lida (pode estar danificada). Pode recuperar uma "
                 "cópia de segurança no separador «Histórico».")
    else:
        texto = f"Erro técnico ({type(erro).__name__})."
    return texto[:TAMANHO_MAXIMO_MENSAGEM]


def base_danificada(erro: BaseException) -> bool:
    """O erro indica que o ficheiro da base de dados está danificado?"""
    return isinstance(erro, sqlite3.DatabaseError) and any(
        sinal in str(erro).lower() for sinal in ("malformed", "not a database", "corrupt"))


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

# Esquema 2 (conservação de dados): só acrescenta colunas e tabelas.
# * importacoes.dados_eliminados_em / motivo_eliminacao: as encomendas e o nome do ficheiro
#   desta importação foram eliminados (por pedido ou por ter passado o prazo); os totais ficam.
# * preferencias: definições (por exemplo, o prazo de conservação).
# * eliminacoes: registo das importações eliminadas, identificadas pelo conteúdo e pelo momento
#   (nunca só pelo n.º), para voltar a eliminá-las se uma cópia antiga for recuperada.
_MIGRACAO_2 = (
    "ALTER TABLE importacoes ADD COLUMN dados_eliminados_em TEXT",
    "ALTER TABLE importacoes ADD COLUMN motivo_eliminacao TEXT",
    """CREATE TABLE preferencias (
        chave TEXT PRIMARY KEY,
        valor TEXT,
        alterada_em TEXT NOT NULL
    )""",
    """CREATE TABLE eliminacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        momento TEXT NOT NULL,
        impressao_digital TEXT NOT NULL,
        iniciada_em TEXT NOT NULL,
        motivo TEXT NOT NULL CHECK (motivo IN ('manual', 'prazo')),
        UNIQUE (impressao_digital, iniciada_em)
    )""",
)

MIGRACOES: dict[int, tuple[str, ...]] = {1: _MIGRACAO_1, 2: _MIGRACAO_2}


def esquema_atual() -> int:
    return max(MIGRACOES)


def tabelas_obrigatorias(versao: int) -> frozenset[str]:
    return frozenset().union(*(t for n, t in TABELAS_POR_ESQUEMA.items() if n <= versao))


@dataclass(frozen=True)
class InfoBaseDados:
    caminho: Path
    versao_esquema: int
    criada: bool
    migrada_de: int | None
    copia_antes_da_migracao: Path | None
    interrompidas_marcadas: int
    verificacao: str = "ok"           # resultado do PRAGMA quick_check («ok» ou o primeiro erro)
    temporarios_limpos: int = 0

    @property
    def integra(self) -> bool:
        return self.verificacao == "ok"


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
    if versao >= 1 and tabelas_obrigatorias(versao) - tabelas:
        raise BaseDadosIncompativel(f"{descricao} está incompleta (faltam tabelas). Não foi alterada.")
    return False


def verificar_integridade(ligacao: sqlite3.Connection, rapida: bool = False) -> str:
    """``"ok"`` ou a primeira mensagem de erro do ``PRAGMA integrity_check`` (ou ``quick_check``)."""
    resultado = ligacao.execute(f"PRAGMA {'quick_check' if rapida else 'integrity_check'}").fetchall()
    return "ok" if resultado == [("ok",)] else str(resultado[0][0])


# Exame de ficheiros e cópias -------------------------------------------------------------

@dataclass(frozen=True)
class ExameBaseDados:
    caminho: Path
    valida: bool
    mensagem: str
    versao_esquema: int | None = None
    importacoes: int | None = None
    com_erros: bool = False     # danificada: não pode ser lida ou falhou a verificação de integridade
    incompativel: bool = False  # legível, mas de outra aplicação, de uma versão mais recente ou incompleta


def examinar_base_dados(caminho: Path, descricao: str = "A cópia") -> ExameBaseDados:
    """Verifica um ficheiro sem o alterar (abre-o só para leitura): cabeçalho SQLite,
    identificação do LogiFlow, esquema conhecido, tabelas e integridade."""
    caminho = Path(caminho)
    if not caminho.is_file():
        return ExameBaseDados(caminho, False, "O ficheiro não existe.")
    try:
        with open(caminho, "rb") as ficheiro:
            cabecalho = ficheiro.read(len(CABECALHO_SQLITE))
    except OSError:
        return ExameBaseDados(caminho, False, "Não foi possível ler o ficheiro.")
    if cabecalho != CABECALHO_SQLITE:
        return ExameBaseDados(caminho, False, "O ficheiro não é uma base de dados SQLite.")
    try:
        with ligar(caminho, so_leitura=True) as ligacao:
            app_id, versao, tabelas = ler_identificacao(ligacao)
            if verificar_compatibilidade(app_id, versao, tabelas, descricao):
                return ExameBaseDados(caminho, False, f"{descricao} está vazia (não tem o histórico do LogiFlow).")
            if verificar_integridade(ligacao) != "ok":
                return ExameBaseDados(caminho, False, f"{descricao} está danificada (falhou a verificação de "
                                      "integridade).", versao, com_erros=True)
            total = ligacao.execute("SELECT COUNT(*) FROM importacoes").fetchone()[0]
    except BaseDadosIncompativel as erro:
        return ExameBaseDados(caminho, False, str(erro), incompativel=True)
    except sqlite3.DatabaseError:
        return ExameBaseDados(caminho, False, f"{descricao} está danificada ou não pode ser lida.", com_erros=True)
    return ExameBaseDados(caminho, True, f"{descricao} é válida: esquema {versao}, {total} importação(ões).",
                          versao, total)


def _apagar_com_auxiliares(caminho: Path) -> None:
    for sufixo in ("", *SUFIXOS_AUXILIARES):
        Path(f"{caminho}{sufixo}").unlink(missing_ok=True)


def publicar(parcial: Path, final: Path) -> None:
    """Dá o nome final a um ficheiro acabado de escrever, **sem nunca substituir** um existente."""
    if os.name == "nt":
        os.rename(parcial, final)  # no Windows, falha se o destino já existir
        return
    try:
        os.link(parcial, final)  # falha se o destino já existir
    except FileExistsError:
        raise
    except OSError:  # sistemas de ficheiros sem ligações (por exemplo, pens USB em FAT/exFAT)
        if final.exists():
            raise FileExistsError(errno.EEXIST, "O ficheiro já existe", str(final)) from None
        os.rename(parcial, final)
        return
    os.unlink(parcial)


def copiar_paginas(fonte: sqlite3.Connection, alvo: sqlite3.Connection, paginas: int = -1) -> None:
    """API de cópia do SQLite com limite de espera: se a base continuar ocupada por outra
    janela durante mais de ``TEMPO_MAXIMO_OCUPADA_S``, desiste (o destino fica como estava)."""
    desde: float | None = None

    def progresso(estado: int, restantes: int, total: int) -> None:
        nonlocal desde
        if estado in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
            agora = time.monotonic()
            desde = desde if desde is not None else agora
            if agora - desde > TEMPO_MAXIMO_OCUPADA_S:
                raise BaseDadosOcupada("A base de dados continuou ocupada por outra janela do LogiFlow. "
                                       "Nada foi alterado; tente de novo dentro de momentos.")
        else:
            desde = None

    fonte.backup(alvo, pages=paginas, progress=progresso, sleep=0.1)


def copiar_sqlite(origem: Path, destino: Path, *, origem_so_leitura: bool = False,
                  destino_se_com_erros: Path | None = None, validar: bool = True) -> ExameBaseDados:
    """Cópia consistente (API de cópia do SQLite) para um ficheiro **novo** e autónomo
    (modo de diário DELETE). Nunca sobrescreve um ficheiro existente.

    A cópia é escrita em ``destino.parcial``, validada e só então publicada com o nome final.
    Se a origem tiver erros de integridade, a cópia é publicada em ``destino_se_com_erros``
    (quando indicado: pode servir para salvar dados) ou apagada. ``origem_so_leitura`` lê a
    origem sem a poder alterar (usado com cópias de segurança)."""
    if destino.exists():
        raise FileExistsError(errno.EEXIST, "O ficheiro já existe", str(destino))
    parcial = Path(f"{destino}{SUFIXO_PARCIAL}")
    with open(parcial, "xb"):  # criação exclusiva: falha se já existir
        pass
    try:
        with ligar(origem, so_leitura=origem_so_leitura) as fonte:
            alvo = sqlite3.connect(str(parcial), timeout=TEMPO_ESPERA_S, isolation_level=None)
            try:
                copiar_paginas(fonte, alvo)
                alvo.execute("PRAGMA journal_mode = DELETE")
            finally:
                alvo.close()
        exame = examinar_base_dados(parcial) if validar else ExameBaseDados(parcial, True, "")
        if exame.valida:
            publicar(parcial, destino)
            return ExameBaseDados(destino, True, exame.mensagem, exame.versao_esquema, exame.importacoes)
        if exame.com_erros and destino_se_com_erros is not None:
            publicar(parcial, destino_se_com_erros)
            return ExameBaseDados(destino_se_com_erros, False, exame.mensagem, exame.versao_esquema,
                                  com_erros=True)
        raise ErroPersistencia(f"A cópia não passou a validação e foi descartada: {exame.mensagem}")
    except BaseException:
        _apagar_com_auxiliares(parcial)  # só o ficheiro novo, criado agora, ainda sem nome final
        raise


def nome_unico(pasta: Path, prefixo: str, momento: dt.datetime | None = None) -> Path:
    """``prefixo-AAAAMMDD-HHMMSS.db``; se já existir (ou estiver a ser escrito), acrescenta ``-2``…"""
    carimbo = (momento or dt.datetime.now()).strftime("%Y%m%d-%H%M%S")
    candidato = pasta / f"{prefixo}-{carimbo}.db"
    n = 2
    while candidato.exists() or Path(f"{candidato}{SUFIXO_PARCIAL}").exists():
        candidato = pasta / f"{prefixo}-{carimbo}-{n}.db"
        n += 1
    return candidato


def limpar_temporarios(pasta: Path, horas: float = HORAS_ATE_LIMPAR_TEMPORARIOS) -> int:
    """Apaga ficheiros temporários do próprio LogiFlow com mais de ``horas``: cópias que não
    chegaram a ser publicadas (``logiflow-*.db.parcial``) e bases temporárias de recuperações
    interrompidas (``.recuperacao-*``). Nenhum deles é a única cópia de dados: são cópias
    incompletas ou cópias de uma cópia que continua a existir. Nunca toca noutros ficheiros."""
    if not pasta.is_dir():
        return 0
    limite = time.time() - horas * 3600
    apagados = 0
    candidatos = [*pasta.glob(f"{PREFIXO_TEMPORARIO}*"), *pasta.glob(f"logiflow-*.db{SUFIXO_PARCIAL}*")]
    for ficheiro in candidatos:
        try:
            if ficheiro.is_file() and ficheiro.stat().st_mtime < limite:
                ficheiro.unlink()
                apagados += 1
        except OSError:
            continue  # em uso ou sem permissão: fica para a próxima vez
    return apagados


# Criar ou atualizar a base de dados -----------------------------------------------------

def preparar_base_dados(caminho: Path, *, copia_antes_de_migrar: bool = True) -> InfoBaseDados:
    """Cria ou atualiza a base de dados. Idempotente: pode ser chamada em cada arranque.

    Nunca substitui nem apaga uma base de dados existente: se estiver danificada ou for
    incompatível, lança uma exceção e deixa o ficheiro como estava. Se a estrutura estiver
    legível mas a verificação rápida encontrar erros nos dados, não lança: devolve o
    resultado em ``verificacao`` e não grava nada (a aplicação passa a modo só de leitura).
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
        destino = nome_unico(pasta_copias, f"logiflow-antes-migracao-v{versao}-para-v{esquema_atual()}")
        try:
            copia = copiar_sqlite(caminho, destino).caminho
        except ErroPersistencia as erro:
            raise BaseDadosDanificada(
                f"Não foi possível fazer a cópia de segurança antes de atualizar a base de dados ({erro}). "
                "A base de dados não foi alterada.") from None

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
                if not nova:
                    registar_evento(ligacao, "migracao", detalhe=f"esquema {numero}")
                elif numero == esquema_atual():
                    registar_evento(ligacao, "base_dados_criada", detalhe=f"esquema {numero}")
        try:
            verificacao = verificar_integridade(ligacao, rapida=True)
        except sqlite3.DatabaseError as erro:
            verificacao = str(erro)
        marcadas = 0
        if verificacao == "ok":
            ativar_wal(ligacao)
            marcadas = marcar_interrompidas(ligacao)
    limpos = 0
    if verificacao == "ok" and not manutencao_ativa(caminho):
        limpos = limpar_temporarios(caminho.parent) + limpar_temporarios(caminho.parent / NOME_PASTA_COPIAS)
    return InfoBaseDados(caminho, esquema_atual(), nova, None if nova or versao == esquema_atual() else versao,
                         copia, marcadas, verificacao, limpos)


def ativar_wal(ligacao: sqlite3.Connection) -> None:
    """Passa a base de dados para o modo WAL (fica gravado no ficheiro; depois disso, não muda nada).

    Esta mudança precisa de um bloqueio exclusivo e, se outra janela estiver a gravar nesse
    instante, o SQLite devolve logo «database is locked», sem usar o prazo de espera. Só nesse
    caso tenta de novo, até ``TEMPO_ESPERA_S`` no total (cada tentativa espera, no máximo, o tempo
    que falta). Os outros erros, ou a base ainda ocupada no fim do prazo, são lançados como antes."""
    limite = time.monotonic() + TEMPO_ESPERA_S
    try:
        while True:
            ligacao.execute(f"PRAGMA busy_timeout = {max(int((limite - time.monotonic()) * 1000), 0)}")
            try:
                ligacao.execute("PRAGMA journal_mode = WAL")
                return
            except sqlite3.OperationalError as erro:
                ocupada = ((getattr(erro, "sqlite_errorcode", None) or 0) & 0xFF) == sqlite3.SQLITE_BUSY
                if not ocupada or time.monotonic() >= limite:
                    raise
            time.sleep(min(0.05, max(limite - time.monotonic(), 0.0)))
    finally:
        ligacao.execute(f"PRAGMA busy_timeout = {int(TEMPO_ESPERA_S * 1000)}")


def marcar_interrompidas(ligacao: sqlite3.Connection, minutos: float | None = None) -> int:
    """Importações que ficaram «em processamento» (a aplicação foi fechada a meio) passam a
    «falhada». Os dados dessas importações nunca chegaram a ser confirmados."""
    minutos = MINUTOS_ATE_INTERROMPIDA if minutos is None else minutos
    limite = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=minutos)).isoformat(timespec="seconds")
    with transacao(ligacao):
        cursor = ligacao.execute(
            "UPDATE importacoes SET estado = 'falhada', concluida_em = ?, mensagem_erro = ? "
            "WHERE estado = 'em_processamento' AND iniciada_em < ?",
            (agora_utc(), "Interrompida antes de concluir (a aplicação foi fechada ou falhou). "
                          "Nenhum dado desta importação foi guardado.", limite))
    return cursor.rowcount
