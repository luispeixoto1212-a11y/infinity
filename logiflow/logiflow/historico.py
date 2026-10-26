"""Histórico de importações: registo transacional, deduplicação e consultas.

O que é guardado (por importação):

* metadados: nome do ficheiro (sem pasta), tamanho, hash SHA-256 do conteúdo, folha,
  correspondência de colunas, estado, totais, data de referência e prazo padrão usados;
* uma «fotografia» de cada linha: os 7 campos validados (n.º, cliente, data, destino,
  estado, data prevista, data de entrega), o texto original das datas inválidas e o
  resultado da validação existente (erros e avisos).

O que **não** é guardado: o ficheiro original nem as colunas extra (podem conter dados
pessoais desnecessários) e nenhum caminho de pasta do utilizador.

Estados:

* ``em_processamento`` — registada, a gravar as linhas (estado transitório);
* ``concluida`` — gravada, sem erros nem avisos de validação;
* ``concluida_com_avisos`` — gravada, mas há linhas com erros ou avisos (incluindo o caso
  de nenhuma encomenda válida): problemas de qualidade dos dados não são falhas;
* ``falhada`` — o ficheiro não pôde ser lido, ou a gravação falhou e foi desfeita.

Deduplicação: a «impressão digital» de uma importação é o hash do conteúdo + folha +
correspondência de colunas + versão do formato. O mesmo conteúdo, com a mesma leitura,
não volta a ser gravado (é indicada a importação existente). Um ficheiro diferente com
os mesmos n.ºs de encomenda é uma importação nova — é isso que permite comparar.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import sqlite3
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath

import pandas as pd

from . import __version__
from . import campos as C
from .datas import formatar_data
from .excecoes import ALTA, BAIXA, MEDIA, contagens, identificar_excecoes
from .indicadores import calcular_indicadores
from .persistencia import (
    ErroPersistencia,
    agora_utc,
    ligar,
    mensagem_segura,
    registar_evento,
    transacao,
)
from .validacao import (
    COL_AVISOS,
    COL_ERROS,
    COL_ESTADO_ORIGINAL,
    COL_ESTADO_RECONHECIDO,
    COL_LINHA,
    COL_TEM_ERRO,
    ResultadoValidacao,
)

VERSAO_FORMATO = 1  # formato da «fotografia»; muda se os campos guardados mudarem

EM_PROCESSAMENTO = "em_processamento"
CONCLUIDA = "concluida"
CONCLUIDA_COM_AVISOS = "concluida_com_avisos"
FALHADA = "falhada"
ESTADOS = (CONCLUIDA, CONCLUIDA_COM_AVISOS, FALHADA, EM_PROCESSAMENTO)
ESTADOS_CONCLUIDOS = (CONCLUIDA, CONCLUIDA_COM_AVISOS)
ROTULOS_ESTADO = {
    CONCLUIDA: "Concluída",
    CONCLUIDA_COM_AVISOS: "Concluída com avisos",
    FALHADA: "Falhada",
    EM_PROCESSAMENTO: "Em processamento",
}

ORIGEM_FICHEIRO = "ficheiro"
ORIGEM_EXEMPLO = "exemplo"

GUARDADA = "guardada"
REPETIDA = "repetida"
FALHOU = "falhou"

_COLUNAS_FOTOGRAFIA = (
    "importacao_id", "linha", "numero", "chave", "cliente", "destino", "estado", "estado_original",
    "estado_reconhecido", "data", "data_original", "data_prevista", "data_prevista_original",
    "data_entrega", "data_entrega_original", "tem_erro", "erros", "avisos",
)


# Preparação dos dados a guardar ----------------------------------------------------

def hash_conteudo(conteudo: bytes) -> str:
    return hashlib.sha256(conteudo).hexdigest()


def impressao_digital(hash_ficheiro: str, folha: str | None, mapeamento: dict[str, str | None]) -> str:
    """Identifica «este conteúdo, lido desta maneira». Ver a política de deduplicação acima."""
    dados = {"conteudo": hash_ficheiro, "folha": folha or "", "formato": VERSAO_FORMATO,
             "mapeamento": sorted((k, v or "") for k, v in mapeamento.items())}
    return hashlib.sha256(json.dumps(dados, sort_keys=True).encode()).hexdigest()


def nome_sem_pasta(nome: str) -> str:
    """Só o nome do ficheiro: nunca se guarda a pasta do utilizador (aceita / e \\)."""
    return PureWindowsPath(nome).name or "(sem nome)"


def chave_encomenda(numero: str) -> str | None:
    """A mesma regra da validação de duplicados: espaços nas pontas e maiúsculas não contam."""
    numero = numero.strip()
    return numero.casefold() if numero else None


def _texto_original(valor: object) -> str:
    if isinstance(valor, (dt.date, dt.datetime)):
        return valor.strftime("%Y-%m-%d")
    return "" if valor is None else str(valor).strip()


def _iso(serie: pd.Series) -> list[str | None]:
    return [None if pd.isna(v) else v for v in serie.dt.strftime("%Y-%m-%d")]


def linhas_fotografia(resultado: ResultadoValidacao) -> list[tuple]:
    """Uma tupla por linha (sem o id da importação), pela ordem de ``_COLUNAS_FOTOGRAFIA[1:]``.

    Usa os valores já validados e normalizados por ``validar``; das datas inválidas guarda
    também o texto original, para não confundir «inválida» com «vazia».
    """
    tabela = resultado.tabela
    datas: dict[str, tuple[list, list]] = {}
    for campo in C.CAMPOS_DATA:
        iso = _iso(tabela[campo])
        coluna = resultado.mapeamento.get(campo)
        originais = (resultado.originais[coluna].map(_texto_original).tolist() if coluna
                     else [""] * len(tabela))
        datas[campo] = (iso, [o if (i is None and o) else None for i, o in zip(iso, originais)])
    numeros = tabela[C.NUMERO].tolist()
    return list(zip(
        tabela[COL_LINHA].astype(int).tolist(),
        numeros,
        [chave_encomenda(n) for n in numeros],
        tabela[C.CLIENTE].tolist(),
        tabela[C.DESTINO].tolist(),
        tabela[C.ESTADO].tolist(),
        tabela[COL_ESTADO_ORIGINAL].tolist(),
        [int(bool(r)) for r in tabela[COL_ESTADO_RECONHECIDO]],
        *(lista for campo in C.CAMPOS_DATA for lista in datas[campo]),
        [int(bool(e)) for e in tabela[COL_TEM_ERRO]],
        tabela[COL_ERROS].tolist(),
        tabela[COL_AVISOS].tolist(),
    ))


@dataclass(frozen=True)
class DadosImportacao:
    """Tudo o que é preciso para registar uma importação — sem o ficheiro original."""
    nome_ficheiro: str
    origem: str
    hash_conteudo: str
    tamanho_bytes: int
    folha: str | None
    mapeamento: dict[str, str | None]
    resultado: ResultadoValidacao
    data_referencia: dt.date
    prazo_padrao_dias: int | None
    entregues: int
    pendentes: int
    atrasadas: int | None
    excecoes: dict[str, int]

    @property
    def impressao_digital(self) -> str:
        return impressao_digital(self.hash_conteudo, self.folha, self.mapeamento)


def preparar_dados(nome: str, conteudo: bytes, folha: str | None, mapeamento: dict[str, str | None],
                   resultado: ResultadoValidacao, tabela_com_prazos: pd.DataFrame, data_referencia: dt.date,
                   prazo_padrao_dias: int | None, origem: str = ORIGEM_FICHEIRO) -> DadosImportacao:
    """Reúne os totais com as regras existentes (indicadores do topo e exceções), calculados
    sobre o ficheiro inteiro — sem filtros — e congelados no momento da importação."""
    ind = calcular_indicadores(tabela_com_prazos)
    exc = contagens(identificar_excecoes(tabela_com_prazos, resultado.problemas, data_referencia))
    return DadosImportacao(
        nome_ficheiro=nome_sem_pasta(nome), origem=origem, hash_conteudo=hash_conteudo(conteudo),
        tamanho_bytes=len(conteudo), folha=folha, mapeamento=dict(mapeamento), resultado=resultado,
        data_referencia=data_referencia, prazo_padrao_dias=prazo_padrao_dias, entregues=ind.entregues,
        pendentes=ind.pendentes, atrasadas=ind.atrasadas, excecoes=dict(exc["por_prioridade"]))


# Registo -------------------------------------------------------------------------------

@dataclass(frozen=True)
class ResultadoRegisto:
    situacao: str                      # GUARDADA, REPETIDA ou FALHOU
    importacao_id: int | None
    estado: str | None
    mensagem: str
    importacao_anterior_id: int | None = None


def _ultima_concluida(ligacao: sqlite3.Connection, antes_de: int | None = None) -> int | None:
    sql = "SELECT MAX(id) FROM importacoes WHERE estado IN (?, ?) AND dados_eliminados_em IS NULL"
    parametros: list = list(ESTADOS_CONCLUIDOS)
    if antes_de is not None:
        sql += " AND id < ?"
        parametros.append(antes_de)
    return ligacao.execute(sql, parametros).fetchone()[0]


def _inserir_fotografia(ligacao: sqlite3.Connection, importacao_id: int, linhas: Iterable[tuple]) -> None:
    marcadores = ", ".join("?" * len(_COLUNAS_FOTOGRAFIA))
    ligacao.executemany(
        f"INSERT INTO encomendas_historico ({', '.join(_COLUNAS_FOTOGRAFIA)}) VALUES ({marcadores})",
        ((importacao_id, *linha) for linha in linhas))


def registar_importacao(caminho_db: Path, dados: DadosImportacao) -> ResultadoRegisto:
    """Grava uma importação em duas fases.

    1. Numa transação curta: verifica se o mesmo conteúdo já foi importado (deduplicação) e
       cria o registo «em processamento».
    2. Numa segunda transação: grava a fotografia, confirma que os totais gravados batem
       certo e marca a importação como concluída. Se algo falhar, tudo o que foi gravado
       nesta fase é desfeito e a importação fica «falhada», com uma mensagem segura.

    Nenhuma importação anterior é alterada ou apagada, em caso algum.
    """
    resultado = dados.resultado
    com_erros = resultado.linhas_com_erro
    com_avisos = int((resultado.tabela[COL_AVISOS] != "").sum())
    estado_final = CONCLUIDA if com_erros == 0 and com_avisos == 0 else CONCLUIDA_COM_AVISOS
    impressao = dados.impressao_digital

    with ligar(caminho_db) as ligacao:
        with transacao(ligacao):
            existente = ligacao.execute(
                "SELECT id, estado, iniciada_em FROM importacoes WHERE impressao_digital = ? AND estado IN (?, ?, ?) "
                "AND dados_eliminados_em IS NULL ORDER BY id LIMIT 1",  # dados eliminados: pode importar de novo
                (impressao, *ESTADOS_CONCLUIDOS, EM_PROCESSAMENTO)).fetchone()
            if existente is not None:
                registar_evento(ligacao, "importacao_repetida", existente[0])
                if existente[1] == EM_PROCESSAMENTO:
                    return ResultadoRegisto(
                        REPETIDA, existente[0], existente[1],
                        f"Este conteúdo está a ser guardado noutra janela (importação n.º {existente[0]}). "
                        "Não foi criado nenhum registo duplicado.")
                quando = formatar_momento(existente[2])
                return ResultadoRegisto(
                    REPETIDA, existente[0], existente[1],
                    f"Este conteúdo já tinha sido importado em {quando} (importação n.º {existente[0]}). "
                    "Não foi criado nenhum registo duplicado.")
            anterior = _ultima_concluida(ligacao)
            cursor = ligacao.execute(
                "INSERT INTO importacoes (iniciada_em, nome_ficheiro, origem, tamanho_bytes, hash_conteudo, folha, "
                "mapeamento, impressao_digital, versao_formato, versao_aplicacao, estado, linhas_lidas, "
                "data_referencia, prazo_padrao_dias, importacao_anterior_id) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (agora_utc(), dados.nome_ficheiro, dados.origem, dados.tamanho_bytes, dados.hash_conteudo,
                 dados.folha, json.dumps(dados.mapeamento, ensure_ascii=False), impressao, VERSAO_FORMATO,
                 __version__, EM_PROCESSAMENTO, resultado.total, dados.data_referencia.isoformat(),
                 dados.prazo_padrao_dias, anterior))
            importacao_id = cursor.lastrowid

        try:
            linhas = linhas_fotografia(resultado)  # só depois de saber que não é repetida
            with transacao(ligacao):
                _inserir_fotografia(ligacao, importacao_id, linhas)
                gravadas, erros_gravados = ligacao.execute(
                    "SELECT COUNT(*), COALESCE(SUM(tem_erro), 0) FROM encomendas_historico WHERE importacao_id = ?",
                    (importacao_id,)).fetchone()
                if gravadas != resultado.total or erros_gravados != com_erros:
                    raise ErroPersistencia("Os totais gravados não coincidem com os do ficheiro; a gravação foi desfeita.")
                ligacao.execute(
                    "UPDATE importacoes SET estado = ?, concluida_em = ?, encomendas_validas = ?, linhas_com_erros = ?, "
                    "linhas_com_avisos = ?, ind_entregues = ?, ind_pendentes = ?, ind_atrasadas = ?, exc_alta = ?, "
                    "exc_media = ?, exc_baixa = ? WHERE id = ?",
                    (estado_final, agora_utc(), resultado.linhas_validas, com_erros, com_avisos, dados.entregues,
                     dados.pendentes, dados.atrasadas, dados.excecoes.get(ALTA, 0), dados.excecoes.get(MEDIA, 0),
                     dados.excecoes.get(BAIXA, 0), importacao_id))
                registar_evento(ligacao, "importacao_concluida", importacao_id, f"estado={estado_final}; "
                                f"linhas={resultado.total}; erros={com_erros}; avisos={com_avisos}")
        except Exception as erro:  # noqa: BLE001 — a falha é registada e comunicada, nunca ignorada
            mensagem = mensagem_segura(erro)
            with transacao(ligacao):
                ligacao.execute("UPDATE importacoes SET estado = ?, concluida_em = ?, mensagem_erro = ? WHERE id = ?",
                                (FALHADA, agora_utc(), mensagem, importacao_id))
                registar_evento(ligacao, "importacao_falhada", importacao_id, "falha na gravação")
            return ResultadoRegisto(FALHOU, importacao_id, FALHADA,
                                    f"Não foi possível guardar no histórico: {mensagem} Nada desta importação ficou "
                                    "gravado e o histórico anterior não foi alterado.", anterior)

    rotulo = ROTULOS_ESTADO[estado_final].lower()
    return ResultadoRegisto(GUARDADA, importacao_id, estado_final,
                            f"Guardada no histórico como importação n.º {importacao_id} ({rotulo}).", anterior)


def registar_falha_leitura(caminho_db: Path, nome: str, conteudo: bytes, folha: str | None, erro: BaseException,
                           origem: str = ORIGEM_FICHEIRO) -> ResultadoRegisto:
    """Regista um ficheiro que não pôde ser lido (só metadados e uma mensagem segura)."""
    mensagem = mensagem_segura(erro)
    hash_ficheiro = hash_conteudo(conteudo)
    with ligar(caminho_db) as ligacao, transacao(ligacao):
        cursor = ligacao.execute(
            "INSERT INTO importacoes (iniciada_em, concluida_em, nome_ficheiro, origem, tamanho_bytes, hash_conteudo, "
            "folha, impressao_digital, versao_formato, versao_aplicacao, estado, mensagem_erro) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (agora_utc(), agora_utc(), nome_sem_pasta(nome), origem, len(conteudo), hash_ficheiro, folha,
             impressao_digital(hash_ficheiro, folha, {}), VERSAO_FORMATO, __version__, FALHADA, mensagem))
        registar_evento(ligacao, "importacao_falhada", cursor.lastrowid, "ficheiro ilegível")
    return ResultadoRegisto(FALHOU, cursor.lastrowid, FALHADA,
                            f"Registada no histórico como importação falhada (n.º {cursor.lastrowid}).")


# Consultas ------------------------------------------------------------------------------

COLUNAS_LISTA = ["id", "iniciada_em", "concluida_em", "nome_ficheiro", "origem", "estado", "linhas_lidas",
                 "encomendas_validas", "linhas_com_erros", "linhas_com_avisos", "ind_entregues", "ind_pendentes",
                 "ind_atrasadas", "exc_alta", "exc_media", "exc_baixa", "data_referencia", "prazo_padrao_dias",
                 "importacao_anterior_id", "mensagem_erro", "folha", "mapeamento", "tamanho_bytes",
                 "hash_conteudo", "versao_aplicacao", "versao_formato", "dados_eliminados_em", "motivo_eliminacao"]


def formatar_momento(iso: str | None) -> str:
    """Momento guardado em UTC, mostrado na hora local: dd/mm/aaaa hh:mm."""
    if not iso:
        return "—"
    return dt.datetime.fromisoformat(iso).astimezone().strftime("%d/%m/%Y %H:%M")


def _condicoes(pesquisa: str, estados: Sequence[str], inicio: dt.date | None,
               fim: dt.date | None) -> tuple[str, list]:
    condicoes, parametros = [], []
    if pesquisa.strip():
        # LIKE com o carácter de escape: % e _ escritos pelo utilizador são texto literal.
        texto = pesquisa.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        condicoes.append("nome_ficheiro LIKE ? ESCAPE '\\'")
        parametros.append(f"%{texto}%")
    if estados:
        condicoes.append(f"estado IN ({', '.join('?' * len(estados))})")
        parametros.extend(estados)
    if inicio is not None:  # datas locais → limites em UTC
        condicoes.append("iniciada_em >= ?")
        parametros.append(_limite_utc(inicio))
    if fim is not None:
        condicoes.append("iniciada_em < ?")
        parametros.append(_limite_utc(fim + dt.timedelta(days=1)))
    return (" WHERE " + " AND ".join(condicoes)) if condicoes else "", parametros


def _limite_utc(dia: dt.date) -> str:
    local = dt.datetime.combine(dia, dt.time()).astimezone()
    return local.astimezone(dt.timezone.utc).isoformat(timespec="seconds")


def listar_importacoes(caminho_db: Path, pesquisa: str = "", estados: Sequence[str] = (),
                       inicio: dt.date | None = None, fim: dt.date | None = None,
                       limite: int = 50, deslocamento: int = 0) -> tuple[pd.DataFrame, int]:
    """Uma página do histórico (mais recentes primeiro) e o total que corresponde aos filtros."""
    onde, parametros = _condicoes(pesquisa, estados, inicio, fim)
    with ligar(caminho_db) as ligacao:
        total = ligacao.execute(f"SELECT COUNT(*) FROM importacoes{onde}", parametros).fetchone()[0]
        linhas = ligacao.execute(
            f"SELECT {', '.join(COLUNAS_LISTA)} FROM importacoes{onde} ORDER BY id DESC LIMIT ? OFFSET ?",
            [*parametros, int(limite), int(deslocamento)]).fetchall()
    return pd.DataFrame(linhas, columns=COLUNAS_LISTA), int(total)


def obter_importacao(caminho_db: Path, importacao_id: int) -> dict | None:
    with ligar(caminho_db) as ligacao:
        linha = ligacao.execute(f"SELECT {', '.join(COLUNAS_LISTA)} FROM importacoes WHERE id = ?",
                                (int(importacao_id),)).fetchone()
    return dict(zip(COLUNAS_LISTA, linha)) if linha else None


def importacoes_concluidas(caminho_db: Path, limite: int = 500) -> pd.DataFrame:
    """Importações que podem ser comparadas (concluídas e com dados; as mais recentes primeiro)."""
    with ligar(caminho_db) as ligacao:
        linhas = ligacao.execute(
            "SELECT id, iniciada_em, nome_ficheiro, linhas_lidas FROM importacoes WHERE estado IN (?, ?) "
            "AND dados_eliminados_em IS NULL ORDER BY id DESC LIMIT ?", (*ESTADOS_CONCLUIDOS, int(limite))).fetchall()
    return pd.DataFrame(linhas, columns=["id", "iniciada_em", "nome_ficheiro", "linhas_lidas"])


def anterior_concluida(caminho_db: Path, importacao_id: int) -> int | None:
    with ligar(caminho_db) as ligacao:
        return _ultima_concluida(ligacao, antes_de=int(importacao_id))


def carregar_fotografia(caminho_db: Path, importacao_id: int, limite: int | None = None) -> pd.DataFrame:
    """As linhas guardadas de uma importação (todas, ou as primeiras ``limite``)."""
    colunas = list(_COLUNAS_FOTOGRAFIA[1:])
    sql = f"SELECT {', '.join(colunas)} FROM encomendas_historico WHERE importacao_id = ? ORDER BY linha"
    parametros: list = [int(importacao_id)]
    if limite is not None:
        sql += " LIMIT ?"
        parametros.append(int(limite))
    with ligar(caminho_db) as ligacao:
        linhas = ligacao.execute(sql, parametros).fetchall()
    return pd.DataFrame(linhas, columns=colunas)


def campos_presentes(importacao: dict) -> set[str]:
    """Campos que tinham coluna no ficheiro dessa importação."""
    mapeamento = json.loads(importacao.get("mapeamento") or "{}")
    return {campo for campo, coluna in mapeamento.items() if coluna}


def contar_eventos(caminho_db: Path, tipo: str | None = None) -> int:
    with ligar(caminho_db) as ligacao:
        if tipo is None:
            return ligacao.execute("SELECT COUNT(*) FROM eventos").fetchone()[0]
        return ligacao.execute("SELECT COUNT(*) FROM eventos WHERE tipo = ?", (tipo,)).fetchone()[0]


def descrever_data(iso: object, original: object) -> str:
    """Data guardada para mostrar: dd/mm/aaaa, o texto original entre «» se era inválida, ou —.

    Valores em falta podem chegar como ``None`` ou como ``NaN`` (pandas)."""
    if isinstance(iso, str) and iso:
        return formatar_data(dt.date.fromisoformat(iso))
    if isinstance(original, str) and original:
        return f"«{original}»"
    return "—"
