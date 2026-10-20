"""Cópias de segurança e recuperação da base de dados do histórico.

* Uma cópia é feita com a API de cópia do SQLite (consistente mesmo com a aplicação
  aberta), para um ficheiro **novo** com nome inequívoco (``logiflow-copia-AAAAMMDD-HHMMSS.db``);
  nunca se sobrescreve um ficheiro existente. Cada cópia é validada depois de criada.
* Uma cópia só é aceite para recuperação se for um ficheiro SQLite íntegro, do LogiFlow,
  de um esquema que esta versão conhece e com as tabelas obrigatórias.
* A recuperação nunca começa por mexer na base de dados atual: a cópia é primeiro
  recuperada para um ficheiro temporário, atualizada (se for de um esquema anterior) e
  validada. Só depois a base atual é preservada (cópia ``logiflow-antes-da-recuperacao-…``,
  ou, se estiver danificada, movida para ``logiflow-danificada-…``) e substituída.
"""

from __future__ import annotations

import datetime as dt
import os
import sqlite3
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path

from .persistencia import (
    NOME_PASTA_COPIAS,
    BaseDadosIncompativel,
    ErroPersistencia,
    copiar_sqlite,
    criar_pasta,
    esquema_atual,
    ler_identificacao,
    ligar,
    nome_unico,
    preparar_base_dados,
    registar_evento,
    transacao,
    verificar_compatibilidade,
    verificar_integridade,
)

PREFIXO_COPIA = "logiflow-copia"
PREFIXO_ANTES_RECUPERACAO = "logiflow-antes-da-recuperacao"
PREFIXO_DANIFICADA = "logiflow-danificada"
CABECALHO_SQLITE = b"SQLite format 3\x00"
SUFIXOS_AUXILIARES = ("-wal", "-shm", "-journal")


def pasta_copias_predefinida(caminho_db: Path) -> Path:
    return caminho_db.parent / NOME_PASTA_COPIAS


def validar_pasta_destino(texto: str) -> Path:
    """Valida a pasta escolhida pelo utilizador para guardar cópias. Não cria pastas."""
    texto = (texto or "").strip().strip('"').strip()
    if not texto:
        raise ErroPersistencia("Indique a pasta onde guardar a cópia.")
    pasta = Path(texto).expanduser()
    if not pasta.is_absolute():
        raise ErroPersistencia("Indique o caminho completo da pasta (por exemplo, D:\\Cópias LogiFlow).")
    if not pasta.exists():
        raise ErroPersistencia("A pasta indicada não existe. Crie-a primeiro ou escolha outra.")
    if not pasta.is_dir():
        raise ErroPersistencia("O caminho indicado não é uma pasta.")
    try:
        with tempfile.TemporaryFile(dir=pasta):
            pass
    except OSError:
        raise ErroPersistencia("Não é possível escrever na pasta indicada (sem permissão ou só de leitura).") from None
    return pasta.resolve()


@dataclass(frozen=True)
class InfoCopia:
    caminho: Path
    valida: bool
    mensagem: str
    versao_esquema: int | None = None
    importacoes: int | None = None


def validar_copia(caminho: Path) -> InfoCopia:
    """Verifica uma cópia sem a alterar (abre-a só para leitura)."""
    caminho = Path(caminho)
    if not caminho.is_file():
        return InfoCopia(caminho, False, "O ficheiro não existe.")
    try:
        with open(caminho, "rb") as ficheiro:
            cabecalho = ficheiro.read(len(CABECALHO_SQLITE))
    except OSError:
        return InfoCopia(caminho, False, "Não foi possível ler o ficheiro.")
    if cabecalho != CABECALHO_SQLITE:
        return InfoCopia(caminho, False, "O ficheiro não é uma base de dados SQLite.")
    try:
        with ligar(caminho, so_leitura=True) as ligacao:
            app_id, versao, tabelas = ler_identificacao(ligacao)
            if verificar_compatibilidade(app_id, versao, tabelas, "A cópia"):
                return InfoCopia(caminho, False, "A cópia está vazia (não tem o histórico do LogiFlow).")
            integridade = verificar_integridade(ligacao)
            if integridade != "ok":
                return InfoCopia(caminho, False, "A cópia está danificada (falhou a verificação de integridade).",
                                 versao)
            total = ligacao.execute("SELECT COUNT(*) FROM importacoes").fetchone()[0]
    except BaseDadosIncompativel as erro:
        return InfoCopia(caminho, False, str(erro))
    except sqlite3.DatabaseError:
        return InfoCopia(caminho, False, "A cópia está danificada ou não pode ser lida.")
    return InfoCopia(caminho, True, f"Cópia válida: esquema {versao}, {total} importação(ões).", versao, total)


def criar_copia(caminho_db: Path, pasta_destino: Path) -> InfoCopia:
    """Cria e valida uma cópia nova em ``pasta_destino``. Nunca sobrescreve ficheiros."""
    if not caminho_db.is_file():
        raise ErroPersistencia("Ainda não existe histórico para copiar.")
    for _ in range(5):  # outro processo pode criar um ficheiro com o mesmo nome entretanto
        destino = nome_unico(pasta_destino, PREFIXO_COPIA)
        try:
            copiar_sqlite(caminho_db, destino)
            break
        except FileExistsError:
            continue
    else:
        raise ErroPersistencia("Não foi possível escolher um nome livre para a cópia. Tente de novo.")
    info = validar_copia(destino)
    if not info.valida:
        destino.unlink(missing_ok=True)  # o ficheiro acabado de criar, inválido; o original não é tocado
        raise ErroPersistencia(f"A cópia criada não passou a validação e foi descartada: {info.mensagem}")
    try:
        with ligar(caminho_db) as ligacao, transacao(ligacao):
            registar_evento(ligacao, "copia_criada", detalhe=destino.name)  # só o nome, sem a pasta
    except sqlite3.OperationalError:
        pass  # base ocupada por outra janela: a cópia já está feita e validada; só o registo fica por fazer
    return info


def listar_copias(pasta: Path) -> list[Path]:
    """Ficheiros de cópia do LogiFlow numa pasta (os mais recentes primeiro). Não valida."""
    if not pasta.is_dir():
        return []
    copias = [p for p in pasta.glob("logiflow-*.db") if p.is_file()]
    return sorted(copias, key=lambda p: (p.stat().st_mtime, p.name), reverse=True)


@dataclass(frozen=True)
class ResultadoRecuperacao:
    importacoes: int
    versao_copia: int
    preservada_em: Path | None   # cópia da base de dados que estava em uso
    danificada_movida: bool      # a base em uso estava danificada e foi movida (não apagada)
    mensagem: str


def _apagar_temporario(caminho: Path) -> None:
    for sufixo in ("", *SUFIXOS_AUXILIARES):
        Path(f"{caminho}{sufixo}").unlink(missing_ok=True)


def _validar_base(caminho: Path) -> int:
    """Número de importações de uma base de dados no esquema atual; erro se não for válida."""
    with ligar(caminho) as ligacao:
        app_id, versao, tabelas = ler_identificacao(ligacao)
        if verificar_compatibilidade(app_id, versao, tabelas, "A base recuperada") or versao != esquema_atual():
            raise ErroPersistencia("A base recuperada não ficou no esquema esperado.")
        if verificar_integridade(ligacao) != "ok":
            raise ErroPersistencia("A base recuperada falhou a verificação de integridade.")
        return ligacao.execute("SELECT COUNT(*) FROM importacoes").fetchone()[0]


def _base_legivel(caminho: Path) -> bool:
    try:
        with ligar(caminho) as ligacao:
            ler_identificacao(ligacao)
            return verificar_integridade(ligacao) == "ok"
    except sqlite3.DatabaseError:
        return False


def _mover_danificada(caminho_db: Path, pasta_copias: Path) -> Path:
    """Afasta a base danificada (e os ficheiros auxiliares) sem a apagar."""
    destino = nome_unico(pasta_copias, PREFIXO_DANIFICADA)
    for sufixo in SUFIXOS_AUXILIARES:
        auxiliar = Path(f"{caminho_db}{sufixo}")
        if auxiliar.exists():
            os.replace(auxiliar, Path(f"{destino}{sufixo}"))
    os.replace(caminho_db, destino)
    return destino


def restaurar_copia(caminho_db: Path, copia: Path) -> ResultadoRecuperacao:
    """Substitui o histórico atual pelo de uma cópia, sem nunca perder a base atual."""
    info = validar_copia(copia)
    if not info.valida:
        raise ErroPersistencia(f"A cópia não foi recuperada: {info.mensagem} A base de dados atual não foi alterada.")
    pasta = criar_pasta(caminho_db.parent)
    pasta_copias = criar_pasta(pasta / NOME_PASTA_COPIAS)

    # 1. Recuperar para um ficheiro temporário, atualizar o esquema e validar.
    temporario = pasta / f".recuperacao-{uuid.uuid4().hex}.db"
    try:
        copiar_sqlite(copia, temporario, origem_so_leitura=True)
        preparar_base_dados(temporario, copia_antes_de_migrar=False)
        total = _validar_base(temporario)
        if total != info.importacoes:
            raise ErroPersistencia("O número de importações recuperadas não coincide com o da cópia.")

        # 2. Preservar a base atual (cópia, ou afastá-la se estiver danificada).
        preservada, danificada = None, False
        if caminho_db.exists() and caminho_db.stat().st_size > 0:
            if _base_legivel(caminho_db):
                preservada = nome_unico(pasta_copias, PREFIXO_ANTES_RECUPERACAO)
                copiar_sqlite(caminho_db, preservada)
            else:
                preservada, danificada = _mover_danificada(caminho_db, pasta_copias), True

        # 3. Substituir o conteúdo (API de cópia: as outras janelas veem o antes ou o depois).
        try:
            with ligar(temporario) as fonte, ligar(caminho_db) as alvo:
                fonte.backup(alvo)
                alvo.execute("PRAGMA journal_mode = WAL")
            recuperadas = _validar_base(caminho_db)
            if recuperadas != total:
                raise ErroPersistencia("A verificação final da base recuperada falhou.")
        except Exception:
            if danificada:  # repõe a base danificada exatamente como estava
                _apagar_temporario(caminho_db)  # só o ficheiro incompleto criado agora
                for sufixo in ("", *SUFIXOS_AUXILIARES):
                    if Path(f"{preservada}{sufixo}").exists():
                        os.replace(Path(f"{preservada}{sufixo}"), Path(f"{caminho_db}{sufixo}"))
            elif preservada is not None:
                with ligar(preservada, so_leitura=True) as fonte, ligar(caminho_db) as alvo:
                    fonte.backup(alvo)  # repõe o que estava em uso
            raise
        with ligar(caminho_db) as ligacao, transacao(ligacao):
            registar_evento(ligacao, "recuperacao_concluida", detalhe=f"copia={copia.name}; esquema={info.versao_esquema}")
    finally:
        _apagar_temporario(temporario)

    partes = [f"Histórico recuperado da cópia «{copia.name}» ({total} importação(ões))."]
    if info.versao_esquema != esquema_atual():
        partes.append(f"A cópia era do esquema {info.versao_esquema} e foi atualizada para o {esquema_atual()}.")
    if danificada:
        partes.append(f"A base que estava em uso estava danificada e foi guardada à parte como «{preservada.name}».")
    elif preservada is not None:
        partes.append(f"A base que estava em uso foi guardada como «{preservada.name}», na pasta das cópias.")
    return ResultadoRecuperacao(total, info.versao_esquema or 0, preservada, danificada, " ".join(partes))


def descrever_copia(caminho: Path) -> str:
    """«nome — dd/mm/aaaa hh:mm — 123 KB» para listas de escolha."""
    estado = caminho.stat()
    quando = dt.datetime.fromtimestamp(estado.st_mtime).strftime("%d/%m/%Y %H:%M")
    return f"{caminho.name} — {quando} — {max(1, round(estado.st_size / 1024))} KB"
