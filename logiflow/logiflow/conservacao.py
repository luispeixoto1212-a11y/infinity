"""Conservação de dados do histórico: prazo configurável e eliminação de importações.

Ajuda a aplicar uma política de conservação; **não garante, por si só, o cumprimento do
RGPD** — o prazo e o procedimento devem ser definidos por quem é responsável pelos dados.

O que acontece ao «eliminar os dados» de uma importação (por pedido ou por ter passado o
prazo de conservação):

* as encomendas guardadas dessa importação (cliente, destino, datas…) são apagadas;
* o nome do ficheiro, a folha, a correspondência de colunas e a mensagem de erro deixam de
  existir (podem conter nomes); ficam só as datas, o estado e os totais, sem dados pessoais;
* o conteúdo apagado é sobrescrito no ficheiro da base de dados (``secure_delete``) e o
  diário WAL é esvaziado, quando nenhuma outra janela o está a ler;
* a eliminação fica registada — na base de dados e num ficheiro à parte,
  ``registo-eliminacoes.json``, na pasta de dados — pelo conteúdo e pelo momento da
  importação (nunca só pelo n.º). Este registo não tem dados pessoais e serve para voltar a
  eliminar os mesmos dados se uma cópia de segurança antiga for recuperada (pela aplicação
  ou à mão). O ficheiro é escrito **antes** de a eliminação ser confirmada na base de dados:
  se a aplicação for fechada a meio, a eliminação é concluída no arranque seguinte.

As cópias de segurança são fotografias do passado: eliminar na base de dados não elimina
nas cópias. A aplicação reaplica as eliminações e o prazo ao recuperar uma cópia e assinala
as cópias que podem conter dados eliminados (apagá-las exige confirmação).
"""

from __future__ import annotations

import calendar
import contextlib
import datetime as dt
import json
import os
import sqlite3
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

from .persistencia import (
    ErroPersistencia,
    agora_utc,
    ligar,
    registar_evento,
    transacao,
)

PRAZOS_MESES = (3, 6, 12, 24, 36)  # além de «sem limite» (None)
CHAVE_PRAZO = "prazo_conservacao_meses"
NOME_REGISTO = "registo-eliminacoes.json"
FORMATO_REGISTO = 1
MANUAL = "manual"
PRAZO = "prazo"
MOTIVOS = {MANUAL: "pedido manual", PRAZO: "prazo de conservação"}
NOME_ELIMINADO = "(eliminado)"
_BLOCO = 500  # n.º máximo de parâmetros por instrução IN (...)


@dataclass(frozen=True)
class Eliminacao:
    impressao_digital: str
    iniciada_em: str
    momento: str
    motivo: str

    @property
    def chave(self) -> tuple[str, str]:
        return self.impressao_digital, self.iniciada_em


@dataclass(frozen=True)
class Politica:
    """O que deve estar eliminado: o prazo em vigor e as eliminações registadas."""
    prazo_meses: int | None
    eliminacoes: tuple[Eliminacao, ...] = ()
    avisos: tuple[str, ...] = ()


@dataclass(frozen=True)
class ResumoConservacao:
    por_prazo: int = 0
    por_registo: int = 0
    manuais: int = 0
    linhas: int = 0
    avisos: tuple[str, ...] = ()

    @property
    def importacoes(self) -> int:
        return self.por_prazo + self.por_registo + self.manuais


# Prazo -------------------------------------------------------------------------------------

def descrever_prazo(meses: int | None) -> str:
    return "Sem limite" if meses is None else f"{meses} meses"


def _meses_antes(dia: dt.date, meses: int) -> dt.date:
    ano, mes = divmod(dia.year * 12 + dia.month - 1 - meses, 12)
    ultimo = calendar.monthrange(ano, mes + 1)[1]
    return dt.date(ano, mes + 1, min(dia.day, ultimo))


def data_limite(meses: int, hoje: dt.date | None = None) -> dt.date:
    """Primeiro dia que ainda se conserva: as importações feitas **antes** deste dia ultrapassam o prazo."""
    return _meses_antes(hoje or dt.date.today(), meses)


def limite_utc(meses: int, hoje: dt.date | None = None) -> str:
    """Início do prazo em UTC (ISO), comparável com ``importacoes.iniciada_em``."""
    local = dt.datetime.combine(data_limite(meses, hoje), dt.time()).astimezone()
    return local.astimezone(dt.timezone.utc).isoformat(timespec="seconds")


def _validar_prazo(meses: int | None) -> int | None:
    if meses is not None and meses not in PRAZOS_MESES:
        raise ErroPersistencia("Prazo de conservação inválido.")
    return meses


def _prazo_da_base(ligacao: sqlite3.Connection) -> int | None:
    linha = ligacao.execute("SELECT valor FROM preferencias WHERE chave = ?", (CHAVE_PRAZO,)).fetchone()
    if linha is None or linha[0] in (None, ""):
        return None
    try:
        return _validar_prazo(int(linha[0]))
    except (ValueError, ErroPersistencia):
        return None


def ler_prazo(caminho_db: Path) -> int | None:
    """O prazo em vigor: o do registo de eliminações (o mais recente) ou, sem registo, o da base."""
    registo, _ = ler_registo(caminho_db)
    if registo is not None and "prazo_meses" in registo:
        return registo["prazo_meses"]
    with ligar(caminho_db) as ligacao:
        return _prazo_da_base(ligacao)


def previsao(caminho_db: Path, meses: int | None, hoje: dt.date | None = None) -> int:
    """Quantas importações (ainda com dados) seriam eliminadas com este prazo."""
    if meses is None:
        return 0
    with ligar(caminho_db) as ligacao:
        return ligacao.execute(
            "SELECT COUNT(*) FROM importacoes WHERE dados_eliminados_em IS NULL AND estado != 'em_processamento' "
            "AND iniciada_em < ?", (limite_utc(meses, hoje),)).fetchone()[0]


# Registo de eliminações fora da base de dados ---------------------------------------------------

def caminho_registo(caminho_db: Path) -> Path:
    return caminho_db.parent / NOME_REGISTO


def _ler_eliminacoes(lista: object) -> list[Eliminacao]:
    if not isinstance(lista, list):
        raise ValueError("lista de eliminações inválida")
    eliminacoes = []
    for item in lista:
        if not isinstance(item, dict):
            raise ValueError("eliminação inválida")
        eliminacao = Eliminacao(str(item["impressao_digital"]), str(item["iniciada_em"]), str(item["momento"]),
                                str(item["motivo"]))
        if eliminacao.motivo not in MOTIVOS:
            raise ValueError("motivo inválido")
        eliminacoes.append(eliminacao)
    return eliminacoes


def ler_registo(caminho_db: Path) -> tuple[dict | None, str | None]:
    """(conteúdo, aviso). Sem ficheiro: (None, None). Ilegível: (None, aviso)."""
    ficheiro = caminho_registo(caminho_db)
    if not ficheiro.exists():
        return None, None
    try:
        dados = json.loads(ficheiro.read_text(encoding="utf-8"))
        if not isinstance(dados, dict) or dados.get("formato") != FORMATO_REGISTO:
            raise ValueError("formato desconhecido")
        prazo = dados.get("prazo_meses")
        return {"prazo_meses": _validar_prazo(None if prazo is None else int(prazo)),
                "eliminacoes": _ler_eliminacoes(dados.get("eliminacoes", []))}, None
    except (OSError, ValueError, KeyError, TypeError, ErroPersistencia):
        return None, (f"O registo de eliminações ({NOME_REGISTO}) não pôde ser lido e foi ignorado; as "
                      "eliminações confirmam-se só pela base de dados.")


def _gravar_registo(caminho_db: Path, prazo: int | None, eliminacoes: Iterable[Eliminacao]) -> None:
    """Escrita atómica (ficheiro novo + troca de nome). Um registo ilegível é guardado à parte,
    nunca apagado. Chamada dentro de uma transação de escrita (as janelas não se atropelam)."""
    ficheiro = caminho_registo(caminho_db)
    if ficheiro.exists() and ler_registo(caminho_db)[0] is None:
        carimbo = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        os.replace(ficheiro, ficheiro.with_name(f"registo-eliminacoes.ilegivel-{carimbo}-{uuid.uuid4().hex[:6]}.json"))
    conteudo = {
        "formato": FORMATO_REGISTO,
        "aplicacao": "LogiFlow",
        "descricao": "Registo das importações cujos dados foram eliminados (sem dados pessoais).",
        "atualizado_em": agora_utc(),
        "prazo_meses": prazo,
        "eliminacoes": [e.__dict__ for e in sorted(eliminacoes, key=lambda e: (e.momento, e.chave))],
    }
    temporario = ficheiro.with_name(f".{NOME_REGISTO}.{uuid.uuid4().hex}.tmp")
    try:
        with open(temporario, "w", encoding="utf-8") as saida:
            json.dump(conteudo, saida, ensure_ascii=False, indent=1)
            saida.flush()
            os.fsync(saida.fileno())
        os.replace(temporario, ficheiro)
    finally:
        temporario.unlink(missing_ok=True)


# Política em vigor --------------------------------------------------------------------------------

def _eliminacoes_da_base(ligacao: sqlite3.Connection) -> list[Eliminacao]:
    return [Eliminacao(*linha) for linha in ligacao.execute(
        "SELECT impressao_digital, iniciada_em, momento, motivo FROM eliminacoes ORDER BY id")]


def _unir(*listas: Iterable[Eliminacao]) -> tuple[Eliminacao, ...]:
    unidas: dict[tuple[str, str], Eliminacao] = {}
    for lista in listas:
        for eliminacao in lista:
            unidas.setdefault(eliminacao.chave, eliminacao)
    return tuple(unidas.values())


def politica_em_vigor(caminho_db: Path, *, ler_base: bool = True) -> Politica:
    """Junta as eliminações registadas na base de dados (se for legível) e no registo à parte.
    O prazo é o do registo (a última definição feita) ou, sem registo, o da base de dados."""
    registo, aviso = ler_registo(caminho_db)
    avisos = [aviso] if aviso else []
    da_base: list[Eliminacao] = []
    prazo_base = None
    if ler_base and caminho_db.exists():
        try:
            with ligar(caminho_db) as ligacao:
                da_base = _eliminacoes_da_base(ligacao)
                prazo_base = _prazo_da_base(ligacao)
        except sqlite3.DatabaseError:
            avisos.append("A base de dados em uso não pôde ser lida: usaram-se só as eliminações do registo à parte.")
    prazo = registo["prazo_meses"] if registo is not None else prazo_base
    return Politica(prazo, _unir(da_base, registo["eliminacoes"] if registo else []), tuple(avisos))


# Eliminar ------------------------------------------------------------------------------------------

def _em_blocos(ids: Sequence[int]) -> Iterable[Sequence[int]]:
    for inicio in range(0, len(ids), _BLOCO):
        yield ids[inicio:inicio + _BLOCO]


def _eliminar(ligacao: sqlite3.Connection, ids: Sequence[int], motivo: str, momento: str) -> int:
    """Apaga as encomendas e anonimiza os metadados das importações indicadas. Devolve o
    n.º de linhas apagadas. Tem de correr dentro de uma transação, com ``secure_delete``."""
    linhas = 0
    for bloco in _em_blocos(list(ids)):
        marcas = ", ".join("?" * len(bloco))
        ligacao.execute(f"INSERT OR IGNORE INTO eliminacoes (momento, impressao_digital, iniciada_em, motivo) "
                        f"SELECT ?, impressao_digital, iniciada_em, ? FROM importacoes WHERE id IN ({marcas})",
                        (momento, motivo, *bloco))
        linhas += ligacao.execute(f"DELETE FROM encomendas_historico WHERE importacao_id IN ({marcas})",
                                  bloco).rowcount
        ligacao.execute(f"UPDATE importacoes SET dados_eliminados_em = ?, motivo_eliminacao = ?, nome_ficheiro = ?, "
                        f"folha = NULL, mapeamento = NULL, mensagem_erro = NULL WHERE id IN ({marcas})",
                        (momento, motivo, NOME_ELIMINADO, *bloco))
    return linhas


def _esvaziar_diario(ligacao: sqlite3.Connection) -> None:
    """Passa as páginas já sobrescritas para o ficheiro principal e esvazia o diário WAL (se
    outra janela estiver a ler, fica para o próximo ponto de controlo do SQLite)."""
    with contextlib.suppress(sqlite3.Error):
        ligacao.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchall()


def _chaves(ligacao: sqlite3.Connection, ids: Sequence[int]) -> list[tuple[str, str]]:
    chaves: list[tuple[str, str]] = []
    for bloco in _em_blocos(list(ids)):
        chaves += ligacao.execute(f"SELECT impressao_digital, iniciada_em FROM importacoes WHERE id IN "
                                  f"({', '.join('?' * len(bloco))})", bloco).fetchall()
    return chaves


def _gravar_prazo(ligacao: sqlite3.Connection, meses: int | None, momento: str) -> None:
    ligacao.execute("INSERT INTO preferencias (chave, valor, alterada_em) VALUES (?, ?, ?) ON CONFLICT (chave) "
                    "DO UPDATE SET valor = excluded.valor, alterada_em = excluded.alterada_em",
                    (CHAVE_PRAZO, None if meses is None else str(meses), momento))


def aplicar(caminho_db: Path, politica: Politica, *, gravar_registo: bool = True,
            hoje: dt.date | None = None) -> ResumoConservacao:
    """Garante que a base de dados cumpre a política: elimina os dados das importações
    registadas como eliminadas e das que ultrapassam o prazo. Idempotente: sem nada a fazer,
    não grava nada.

    ``gravar_registo=False`` serve para preparar uma cópia recuperada num ficheiro temporário
    (o registo à parte é o da pasta de dados, não o dessa cópia)."""
    avisos = list(politica.avisos)
    registadas = {e.chave: e for e in politica.eliminacoes}
    limite = limite_utc(politica.prazo_meses, hoje) if politica.prazo_meses else None
    with ligar(caminho_db) as ligacao:
        ligacao.execute("PRAGMA secure_delete = ON")
        with transacao(ligacao):
            por_registo: dict[str, list[int]] = {MANUAL: [], PRAZO: []}
            por_prazo: list[int] = []
            for importacao_id, impressao, iniciada, estado in ligacao.execute(
                    "SELECT id, impressao_digital, iniciada_em, estado FROM importacoes "
                    "WHERE dados_eliminados_em IS NULL").fetchall():
                registada = registadas.get((impressao, iniciada))
                if registada is not None:
                    por_registo[registada.motivo].append(importacao_id)
                elif limite and estado != "em_processamento" and iniciada < limite:
                    por_prazo.append(importacao_id)
            momento = agora_utc()
            novas = [Eliminacao(i, n, momento, PRAZO) for i, n in _chaves(ligacao, por_prazo)]
            da_base = _eliminacoes_da_base(ligacao)
            todas = _unir(da_base, politica.eliminacoes, novas)
            chaves_da_base = {e.chave for e in da_base}
            em_falta_na_base = [e for e in todas if e.chave not in chaves_da_base and e not in novas]
            mudar_prazo = _prazo_da_base(ligacao) != politica.prazo_meses
            registo, _ = ler_registo(caminho_db)
            registo_desatualizado = gravar_registo and (
                registo is None or registo["prazo_meses"] != politica.prazo_meses
                or {e.chave for e in registo["eliminacoes"]} != {e.chave for e in todas})
            n_registo = len(por_registo[MANUAL]) + len(por_registo[PRAZO])
            if not (n_registo or por_prazo or em_falta_na_base or mudar_prazo or registo_desatualizado):
                return ResumoConservacao(avisos=tuple(avisos))
            if registo_desatualizado:  # primeiro o registo à parte: se algo falhar, conclui-se no arranque seguinte
                try:
                    _gravar_registo(caminho_db, politica.prazo_meses, todas)
                except OSError as erro:
                    avisos.append(f"Não foi possível atualizar o registo de eliminações ({type(erro).__name__}); "
                                  "as eliminações ficaram registadas só na base de dados.")
            ligacao.executemany(
                "INSERT OR IGNORE INTO eliminacoes (momento, impressao_digital, iniciada_em, motivo) VALUES (?, ?, ?, ?)",
                [(e.momento, e.impressao_digital, e.iniciada_em, e.motivo) for e in em_falta_na_base])
            linhas = sum(_eliminar(ligacao, ids, motivo, momento) for motivo, ids in por_registo.items() if ids)
            linhas += _eliminar(ligacao, por_prazo, PRAZO, momento) if por_prazo else 0
            if mudar_prazo:
                _gravar_prazo(ligacao, politica.prazo_meses, momento)
            if n_registo or por_prazo:
                registar_evento(ligacao, "dados_eliminados",
                                detalhe=f"prazo={len(por_prazo)}; registo={n_registo}; linhas={linhas}")
        if n_registo or por_prazo:
            _esvaziar_diario(ligacao)
    return ResumoConservacao(len(por_prazo), n_registo, 0, linhas, tuple(avisos))


def aplicar_conservacao(caminho_db: Path, hoje: dt.date | None = None) -> ResumoConservacao:
    """No arranque e depois de importar: aplica o prazo e as eliminações registadas."""
    return aplicar(caminho_db, politica_em_vigor(caminho_db), hoje=hoje)


def definir_prazo(caminho_db: Path, meses: int | None, hoje: dt.date | None = None) -> ResumoConservacao:
    """Muda o prazo e aplica-o de imediato (a interface pede confirmação antes)."""
    politica = politica_em_vigor(caminho_db)
    resumo = aplicar(caminho_db, Politica(_validar_prazo(meses), politica.eliminacoes, politica.avisos), hoje=hoje)
    with ligar(caminho_db) as ligacao, transacao(ligacao):
        registar_evento(ligacao, "prazo_conservacao", detalhe=f"meses={'sem limite' if meses is None else meses}")
    return resumo


def eliminar_importacao(caminho_db: Path, importacao_id: int) -> ResumoConservacao:
    """Elimina os dados de uma importação, a pedido (a interface pede confirmação antes)."""
    avisos: list[str] = []
    with ligar(caminho_db) as ligacao:
        ligacao.execute("PRAGMA secure_delete = ON")
        with transacao(ligacao):
            linha = ligacao.execute("SELECT impressao_digital, iniciada_em, estado, dados_eliminados_em "
                                    "FROM importacoes WHERE id = ?", (int(importacao_id),)).fetchone()
            if linha is None:
                raise ErroPersistencia("Esta importação já não existe no histórico.")
            impressao, iniciada, estado, eliminada = linha
            if eliminada:
                return ResumoConservacao()
            if estado == "em_processamento":
                raise ErroPersistencia("Esta importação ainda está a ser gravada. Tente de novo dentro de momentos.")
            momento = agora_utc()
            nova = Eliminacao(impressao, iniciada, momento, MANUAL)
            registo, aviso = ler_registo(caminho_db)
            if aviso:
                avisos.append(aviso)
            prazo = registo["prazo_meses"] if registo is not None else _prazo_da_base(ligacao)
            todas = _unir(_eliminacoes_da_base(ligacao), registo["eliminacoes"] if registo else [], [nova])
            try:  # primeiro o registo à parte (ver a explicação no início do módulo)
                _gravar_registo(caminho_db, prazo, todas)
            except OSError as erro:
                avisos.append(f"Não foi possível atualizar o registo de eliminações ({type(erro).__name__}); a "
                              "eliminação ficou registada só na base de dados.")
            linhas = _eliminar(ligacao, [int(importacao_id)], MANUAL, momento)
            registar_evento(ligacao, "dados_eliminados", int(importacao_id), f"manual; linhas={linhas}")
        _esvaziar_diario(ligacao)
    return ResumoConservacao(manuais=1, linhas=linhas, avisos=tuple(avisos))


def ultima_eliminacao(caminho_db: Path) -> dt.datetime | None:
    """Momento (UTC) da eliminação mais recente — base de dados ou registo à parte."""
    politica = politica_em_vigor(caminho_db)
    momentos = [e.momento for e in politica.eliminacoes]
    return dt.datetime.fromisoformat(max(momentos)) if momentos else None
