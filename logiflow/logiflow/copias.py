"""Cópias de segurança e recuperação da base de dados do histórico.

Cópias:

* feitas com a API de cópia do SQLite (consistentes mesmo com a aplicação aberta), para um
  ficheiro **novo** com nome inequívoco (``logiflow-copia-AAAAMMDD-HHMMSS.db``); nunca se
  sobrescreve um ficheiro existente;
* escritas primeiro como ``….db.parcial`` e só publicadas com o nome final depois de
  validadas: uma cópia interrompida nunca aparece como cópia;
* se a base de dados em uso tiver erros de integridade, a cópia não é descartada: fica como
  ``logiflow-copia-com-erros-…`` (pode servir para salvar dados), mas não serve para recuperar.

Recuperação (``restaurar_copia``), por esta ordem — a base em uso só é tocada no passo 6:

1. a cópia é validada (só leitura); se for inválida ou incompatível, nada muda;
2. um bloqueio de manutenção impede as outras janelas de gravar; espera-se pelas gravações
   que já tinham começado;
3. a base em uso é examinada só para leitura (sem tocar no seu ``-wal``);
4. a cópia é recuperada para um ficheiro temporário, atualizada para o esquema atual, sujeita
   às eliminações já feitas e ao prazo de conservação em vigor (dados eliminados não voltam),
   e validada;
5. a base em uso é preservada na pasta ``copias``: com a API de cópia, se estiver íntegra; byte
   a byte, com os ficheiros auxiliares, se estiver danificada ou for incompatível (antes de
   qualquer abertura pelo SQLite);
6. substituição: numa base íntegra, com a API de cópia (as outras janelas veem o antes ou o
   depois); numa base danificada, com uma troca de ficheiro atómica (nunca fica sem base);
7. verificação final; se falhar, a base anterior é reposta automaticamente.
"""

from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import os
import re
import shutil
import sqlite3
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path

from . import conservacao
from .persistencia import (
    NOME_PASTA_COPIAS,
    PREFIXO_TEMPORARIO,
    SUFIXO_PARCIAL,
    SUFIXOS_AUXILIARES,
    BaseDadosOcupada,
    ErroPersistencia,
    ExameBaseDados,
    ativar_wal,
    bloqueio_manutencao,
    copiar_paginas,
    copiar_sqlite,
    criar_pasta,
    esquema_atual,
    examinar_base_dados,
    ler_identificacao,
    ligar,
    limpar_temporarios,
    nome_unico,
    preparar_base_dados,
    publicar,
    registar_evento,
    transacao,
    verificar_compatibilidade,
    verificar_integridade,
)

PREFIXO_COPIA = "logiflow-copia"
PREFIXO_COPIA_COM_ERROS = "logiflow-copia-com-erros"
PREFIXO_ANTES_RECUPERACAO = "logiflow-antes-da-recuperacao"
PREFIXO_DANIFICADA = "logiflow-danificada"
_CARIMBO = re.compile(r"-(\d{8}-\d{6})(?:-\d+)?\.db$")

InfoCopia = ExameBaseDados  # resultado da validação de uma cópia


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


def validar_copia(caminho: Path) -> InfoCopia:
    """Verifica uma cópia sem a alterar (abre-a só para leitura)."""
    return examinar_base_dados(caminho, "A cópia")


def criar_copia(caminho_db: Path, pasta_destino: Path) -> InfoCopia:
    """Cria, valida e só então publica uma cópia nova em ``pasta_destino``. Nunca sobrescreve
    ficheiros. Com a base em uso danificada, guarda a cópia como «com erros» (``valida`` falso)."""
    if not caminho_db.is_file():
        raise ErroPersistencia("Ainda não existe histórico para copiar.")
    limpar_temporarios(pasta_destino)  # cópias interrompidas há mais de uma hora (nunca publicadas)
    for _ in range(5):  # outro processo pode criar um ficheiro com o mesmo nome entretanto
        destino = nome_unico(pasta_destino, PREFIXO_COPIA)
        com_erros = nome_unico(pasta_destino, PREFIXO_COPIA_COM_ERROS)
        try:
            exame = copiar_sqlite(caminho_db, destino, destino_se_com_erros=com_erros)
            break
        except FileExistsError:
            continue
    else:
        raise ErroPersistencia("Não foi possível escolher um nome livre para a cópia. Tente de novo.")
    if exame.com_erros:
        return dataclasses.replace(exame, mensagem=(
            f"A base de dados em uso tem erros (falhou a verificação de integridade). A cópia foi guardada como "
            f"«{exame.caminho.name}» para se tentar salvar dados, mas não serve para recuperar o histórico."))
    try:
        with ligar(caminho_db) as ligacao, transacao(ligacao):
            registar_evento(ligacao, "copia_criada", detalhe=exame.caminho.name)  # só o nome, sem a pasta
    except (sqlite3.Error, ErroPersistencia):
        pass  # base ocupada: a cópia já está feita e validada; só o registo da operação fica por fazer
    return exame


def momento_copia(caminho: Path) -> dt.datetime:
    """Quando a cópia foi feita (pelo nome; se não tiver data no nome, pela data do ficheiro)."""
    encontrado = _CARIMBO.search(caminho.name)
    if encontrado:
        return dt.datetime.strptime(encontrado.group(1), "%Y%m%d-%H%M%S").astimezone()
    return dt.datetime.fromtimestamp(caminho.stat().st_mtime).astimezone()


def listar_copias(pasta: Path) -> list[Path]:
    """Ficheiros de cópia do LogiFlow numa pasta (os mais recentes primeiro). Não valida.
    Cópias por publicar (``.parcial``) e ficheiros auxiliares não aparecem."""
    if not pasta.is_dir():
        return []
    copias = [p for p in pasta.glob("logiflow-*.db") if p.is_file()]
    return sorted(copias, key=lambda p: (momento_copia(p), p.name), reverse=True)


@dataclass(frozen=True)
class CopiaListada:
    caminho: Path
    momento: dt.datetime
    tamanho_bytes: int
    legivel: bool                # foi possível ler a lista de importações da cópia
    contem_eliminados: bool      # tem dados de importações que entretanto foram eliminados
    contem_fora_do_prazo: bool   # tem dados de importações anteriores ao prazo de conservação

    @property
    def assinalada(self) -> bool:
        return self.contem_eliminados or self.contem_fora_do_prazo


_cache_conteudo: dict[tuple[str, int, int], list[tuple[str, str]] | None] = {}


def _importacoes_com_dados(caminho: Path) -> list[tuple[str, str]] | None:
    """(impressão digital, início) das importações cujos dados a cópia ainda tem. Lida só para
    leitura; ``None`` se a cópia não puder ser lida. Guardada em memória enquanto o ficheiro não muda."""
    estado = caminho.stat()
    chave = (str(caminho), estado.st_mtime_ns, estado.st_size)
    if chave not in _cache_conteudo:
        try:
            with ligar(caminho, so_leitura=True) as ligacao:
                colunas = {c[1] for c in ligacao.execute("PRAGMA table_info(importacoes)")}
                condicao = " WHERE dados_eliminados_em IS NULL" if "dados_eliminados_em" in colunas else ""
                _cache_conteudo[chave] = ligacao.execute(
                    f"SELECT impressao_digital, iniciada_em FROM importacoes{condicao}").fetchall()
        except sqlite3.DatabaseError:
            _cache_conteudo[chave] = None
    return _cache_conteudo[chave]


def avaliar_copias(pasta: Path, caminho_db: Path) -> list[CopiaListada]:
    """As cópias de uma pasta, com a indicação das que têm dados que já não deviam existir:
    importações eliminadas ou anteriores ao prazo de conservação. A verificação é feita pelo
    conteúdo de cada cópia (aberta só para leitura), não pela data do ficheiro."""
    politica = conservacao.politica_em_vigor(caminho_db) if caminho_db.exists() else conservacao.Politica(None)
    eliminadas = {e.chave for e in politica.eliminacoes}
    limite = conservacao.limite_utc(politica.prazo_meses) if politica.prazo_meses else None
    avaliadas = []
    for caminho in listar_copias(pasta):
        com_dados = _importacoes_com_dados(caminho)
        avaliadas.append(CopiaListada(
            caminho, momento_copia(caminho), caminho.stat().st_size, com_dados is not None,
            bool(com_dados and any(chave in eliminadas for chave in com_dados)),
            bool(com_dados and limite and any(iniciada < limite for _, iniciada in com_dados))))
    return avaliadas


def apagar_copias(pasta: Path, caminhos: list[Path]) -> int:
    """Apaga cópias escolhidas pelo utilizador (a interface pede confirmação antes). Só aceita
    ficheiros ``logiflow-*.db`` dessa pasta; apaga também os ficheiros auxiliares de cada uma."""
    pasta = pasta.resolve()
    validados = []
    for caminho in caminhos:
        caminho = Path(caminho)
        if (caminho.resolve().parent != pasta or not caminho.name.startswith("logiflow-")
                or caminho.suffix != ".db" or not caminho.is_file()):
            raise ErroPersistencia(f"«{caminho.name}» não é uma cópia do LogiFlow nesta pasta. Nada foi apagado.")
        validados.append(caminho)
    for caminho in validados:
        for sufixo in ("", *SUFIXOS_AUXILIARES):
            Path(f"{caminho}{sufixo}").unlink(missing_ok=True)
    return len(validados)


def descrever_copia(caminho: Path) -> str:
    """«nome — dd/mm/aaaa hh:mm — 123 KB» para listas de escolha."""
    quando = momento_copia(caminho).strftime("%d/%m/%Y %H:%M")
    return f"{caminho.name} — {quando} — {max(1, round(caminho.stat().st_size / 1024))} KB"


# Recuperação ---------------------------------------------------------------------------------------

@dataclass(frozen=True)
class ResultadoRecuperacao:
    importacoes: int
    versao_copia: int
    preservada_em: Path | None       # cópia da base de dados que estava em uso
    base_anterior_danificada: bool   # estava danificada: foi guardada byte a byte, sem alterações
    mensagem: str
    reeliminadas: int = 0            # importações da cópia cujos dados voltaram a ser eliminados
    avisos: tuple[str, ...] = ()


def _apagar_com_auxiliares(caminho: Path) -> None:
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


def _esperar_gravacoes(caminho_db: Path) -> None:
    """Espera que terminem as gravações que outras janelas já tinham começado (as novas já são
    recusadas pelo bloqueio de manutenção). Assim, ficam todas na cópia da base em uso."""
    with ligar(caminho_db) as ligacao:
        ligacao.execute("BEGIN IMMEDIATE")
        ligacao.execute("COMMIT")


def _hash(caminho: Path) -> str:
    resumo = hashlib.sha256()
    with open(caminho, "rb") as ficheiro:
        for bloco in iter(lambda: ficheiro.read(1 << 20), b""):
            resumo.update(bloco)
    return resumo.hexdigest()


def _copiar_em_bruto(caminho_db: Path, pasta_copias: Path, prefixo: str) -> Path:
    """Copia byte a byte a base e os seus ficheiros auxiliares, **sem os abrir com o SQLite**
    (abrir uma base danificada pode alterar ou apagar o ``-wal``). Cada ficheiro é escrito como
    ``.parcial``, comparado com o original e só depois publicado."""
    destino = nome_unico(pasta_copias, prefixo)
    publicados: list[Path] = []
    try:
        for sufixo in (*SUFIXOS_AUXILIARES, ""):  # a base principal por último: só aparece quando tudo está copiado
            origem = Path(f"{caminho_db}{sufixo}")
            if not origem.exists():
                continue
            final = Path(f"{destino}{sufixo}")
            parcial = Path(f"{final}{SUFIXO_PARCIAL}")
            with open(origem, "rb") as entrada, open(parcial, "xb") as saida:
                shutil.copyfileobj(entrada, saida, 1 << 20)
                saida.flush()
                os.fsync(saida.fileno())
            if _hash(parcial) != _hash(origem):
                raise ErroPersistencia("A cópia dos ficheiros da base em uso não ficou igual ao original.")
            publicar(parcial, final)
            publicados.append(final)
    except BaseException:
        for sufixo in (*SUFIXOS_AUXILIARES, ""):
            Path(f"{destino}{sufixo}{SUFIXO_PARCIAL}").unlink(missing_ok=True)
        for ficheiro in publicados:  # só cópias acabadas de fazer; o original não é tocado
            ficheiro.unlink(missing_ok=True)
        raise
    return destino


def _repor_em_bruto(preservada: Path | None, caminho_db: Path) -> None:
    """Põe de volta, de uma só vez, a base que estava em uso (a partir da cópia byte a byte)."""
    if preservada is None:  # não havia base: tira a que foi posta agora (a cópia de origem continua a existir)
        _apagar_com_auxiliares(caminho_db)
        return
    temporario = caminho_db.with_name(f"{PREFIXO_TEMPORARIO}reposicao-{uuid.uuid4().hex}.db")
    shutil.copyfile(preservada, temporario)
    for sufixo in SUFIXOS_AUXILIARES:
        Path(f"{caminho_db}{sufixo}").unlink(missing_ok=True)
    os.replace(temporario, caminho_db)
    for sufixo in SUFIXOS_AUXILIARES:
        if Path(f"{preservada}{sufixo}").exists():
            shutil.copyfile(Path(f"{preservada}{sufixo}"), Path(f"{caminho_db}{sufixo}"))


def _substituir_conteudo(temporario: Path, caminho_db: Path, preservada: Path, total: int) -> None:
    """Base em uso íntegra: substitui o conteúdo com a API de cópia do SQLite."""
    try:
        with ligar(temporario) as fonte, ligar(caminho_db) as alvo:
            copiar_paginas(fonte, alvo)
            alvo.execute("PRAGMA journal_mode = WAL")
        if _validar_base(caminho_db) != total:
            raise ErroPersistencia("A verificação final da base recuperada falhou.")
    except BaseDadosOcupada:
        raise  # a cópia nem começou: a base em uso não foi alterada
    except Exception as erro:
        try:
            with ligar(preservada, so_leitura=True) as fonte, ligar(caminho_db) as alvo:
                copiar_paginas(fonte, alvo)  # repõe o que estava em uso
        except Exception:
            raise ErroPersistencia(
                f"A recuperação falhou e não foi possível repor automaticamente a base anterior. Ela está guardada, "
                f"intacta, como «{preservada.name}» na pasta das cópias: siga a recuperação manual.") from erro
        raise


def _substituir_ficheiro(temporario: Path, caminho_db: Path, preservada: Path | None, total: int) -> None:
    """Base em uso danificada, incompatível ou inexistente: troca de ficheiro atómica."""
    with ligar(temporario) as ligacao:  # ficheiro autónomo, sem -wal, para ser trocado de uma só vez
        ligacao.execute("PRAGMA journal_mode = DELETE")
    try:
        for sufixo in SUFIXOS_AUXILIARES:  # já guardados na cópia byte a byte; não podem ficar junto da base nova
            Path(f"{caminho_db}{sufixo}").unlink(missing_ok=True)
        os.replace(temporario, caminho_db)  # atómico: em nenhum momento fica sem base de dados
    except OSError:  # por exemplo, ficheiro em uso por outro programa (Windows): tudo fica como estava
        if preservada is not None:
            for sufixo in SUFIXOS_AUXILIARES:
                original, guardado = Path(f"{caminho_db}{sufixo}"), Path(f"{preservada}{sufixo}")
                if guardado.exists() and not original.exists():
                    shutil.copyfile(guardado, original)
        raise
    try:
        with ligar(caminho_db) as ligacao:
            ativar_wal(ligacao)  # a base nova ainda não está em WAL: espera se outra janela estiver a gravar
        if _validar_base(caminho_db) != total:
            raise ErroPersistencia("A verificação final da base recuperada falhou.")
    except Exception as erro:
        try:
            _repor_em_bruto(preservada, caminho_db)
        except Exception:
            nome = f"«{preservada.name}»" if preservada else "a cópia de origem"
            raise ErroPersistencia(
                f"A recuperação falhou e não foi possível repor automaticamente a base anterior. Ela está guardada, "
                f"intacta, como {nome} na pasta das cópias: siga a recuperação manual.") from erro
        raise


def restaurar_copia(caminho_db: Path, copia: Path) -> ResultadoRecuperacao:
    """Substitui o histórico atual pelo de uma cópia, sem nunca perder a base atual nem fazer
    voltar dados eliminados. Ver a ordem dos passos no início do módulo."""
    info = validar_copia(copia)
    if not info.valida:
        raise ErroPersistencia(f"A cópia não foi recuperada: {info.mensagem} A base de dados atual não foi alterada.")
    pasta = criar_pasta(caminho_db.parent)
    pasta_copias = criar_pasta(pasta / NOME_PASTA_COPIAS)

    with bloqueio_manutencao(caminho_db, "recuperacao"):
        temporario = pasta / f"{PREFIXO_TEMPORARIO}{uuid.uuid4().hex}.db"
        try:
            existe = caminho_db.exists() and caminho_db.stat().st_size > 0
            atual = examinar_base_dados(caminho_db, "A base de dados em uso") if existe else None
            integra = atual is not None and atual.valida
            danificada = atual is not None and not atual.valida and not atual.incompativel
            if integra:
                _esperar_gravacoes(caminho_db)
            politica = conservacao.politica_em_vigor(caminho_db, ler_base=integra)

            copiar_sqlite(copia, temporario, origem_so_leitura=True)
            preparar_base_dados(temporario, copia_antes_de_migrar=False)
            resumo = conservacao.aplicar(temporario, politica, gravar_registo=False)
            total = _validar_base(temporario)
            if total != info.importacoes:
                raise ErroPersistencia("O número de importações recuperadas não coincide com o da cópia.")

            preservada = None
            if integra:
                preservada = copiar_sqlite(caminho_db, nome_unico(pasta_copias, PREFIXO_ANTES_RECUPERACAO)).caminho
                _substituir_conteudo(temporario, caminho_db, preservada, total)
            else:
                if existe:
                    preservada = _copiar_em_bruto(caminho_db, pasta_copias,
                                                  PREFIXO_DANIFICADA if danificada else PREFIXO_ANTES_RECUPERACAO)
                _substituir_ficheiro(temporario, caminho_db, preservada, total)
        finally:
            _apagar_com_auxiliares(temporario)

    avisos = list(resumo.avisos)
    try:  # já sem o bloqueio: o registo da operação e o registo de eliminações à parte
        with ligar(caminho_db) as ligacao, transacao(ligacao):
            registar_evento(ligacao, "recuperacao_concluida", detalhe=f"copia={copia.name}; esquema={info.versao_esquema}")
        avisos += conservacao.aplicar_conservacao(caminho_db).avisos
    except (sqlite3.Error, ErroPersistencia):
        pass  # a recuperação está feita e validada; o arranque seguinte volta a aplicar a conservação

    partes = [f"Histórico recuperado da cópia «{copia.name}» ({total} importação(ões))."]
    if info.versao_esquema != esquema_atual():
        partes.append(f"A cópia era do esquema {info.versao_esquema} e foi atualizada para o {esquema_atual()}.")
    if resumo.importacoes:
        partes.append(f"Por coerência com as eliminações já feitas e com o prazo de conservação em vigor, os dados "
                      f"de {resumo.importacoes} importação(ões) da cópia foram eliminados de novo.")
    if danificada:
        partes.append(f"A base que estava em uso estava danificada: os ficheiros originais foram guardados, sem "
                      f"alterações, como «{preservada.name}», na pasta das cópias.")
    elif atual is not None and not integra:
        partes.append(f"A base que estava em uso não era compatível: foi guardada, sem alterações, como "
                      f"«{preservada.name}», na pasta das cópias.")
    elif preservada is not None:
        partes.append(f"A base que estava em uso foi guardada como «{preservada.name}», na pasta das cópias.")
    partes += avisos
    return ResultadoRecuperacao(total, info.versao_esquema or 0, preservada, danificada, " ".join(partes),
                                resumo.importacoes, tuple(avisos))

