"""Definição dos campos de uma encomenda e deteção automática de colunas.

Os ficheiros reais chegam com cabeçalhos muito diferentes ("N.º Encomenda",
"Nº encomenda", "Numero da Encomenda"...). Aqui definimos, para cada campo,
a lista de nomes aceites. A comparação ignora maiúsculas, acentos e pontuação,
mas não tenta adivinhar: se um cabeçalho não constar da lista, o utilizador
escolhe a coluna manualmente na interface.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# Nomes internos dos campos (usados no código) ------------------------------
NUMERO = "numero_encomenda"
CLIENTE = "cliente"
DATA = "data"
DESTINO = "destino"
ESTADO = "estado"
DATA_PREVISTA = "data_prevista"
DATA_ENTREGA = "data_entrega"


@dataclass(frozen=True)
class Campo:
    nome: str            # nome interno
    rotulo: str          # nome apresentado ao utilizador
    obrigatorio: bool
    sinonimos: tuple[str, ...]
    descricao: str
    exemplos: tuple[str, ...] = ()  # cabeçalhos aceites, escritos como aparecem nos ficheiros


CAMPOS: tuple[Campo, ...] = (
    Campo(
        NUMERO, "N.º Encomenda", True,
        ("n encomenda", "no encomenda", "nº encomenda", "n.º encomenda", "numero encomenda",
         "numero de encomenda", "numero da encomenda", "num encomenda", "encomenda",
         "n da encomenda", "id encomenda", "referencia encomenda", "ref encomenda",
         "order", "order id", "order number"),
        "Identificador único da encomenda.",
        ("Nº Encomenda", "Número da Encomenda", "Encomenda", "Order ID"),
    ),
    Campo(
        CLIENTE, "Cliente", True,
        ("cliente", "nome cliente", "nome do cliente", "customer", "client"),
        "Nome do cliente ou empresa.",
        ("Nome do Cliente", "Customer"),
    ),
    Campo(
        DATA, "Data", True,
        ("data", "data encomenda", "data da encomenda", "data de encomenda", "data pedido",
         "data do pedido", "data registo", "order date", "date"),
        "Data em que a encomenda foi registada.",
        ("Data da Encomenda", "Data do Pedido", "Order Date"),
    ),
    Campo(
        DESTINO, "Destino", True,
        ("destino", "localidade", "cidade", "local de entrega", "morada de entrega",
         "destino entrega", "destination"),
        "Local de entrega (localidade, morada ou código).",
        ("Localidade", "Cidade", "Local de Entrega"),
    ),
    Campo(
        ESTADO, "Estado", True,
        ("estado", "estado encomenda", "estado da encomenda", "situacao", "status"),
        "Situação atual da encomenda (por exemplo: Pendente, Em trânsito, Entregue).",
        ("Situação", "Estado da Encomenda", "Status"),
    ),
    Campo(
        DATA_PREVISTA, "Data Prevista", False,
        ("data prevista", "data prevista entrega", "data prevista de entrega",
         "data prevista para entrega", "prazo", "prazo entrega", "prazo de entrega",
         "data limite", "data limite entrega", "data limite de entrega", "due date"),
        "Data combinada para a entrega. Necessária para calcular atrasos "
        "(em alternativa, pode definir um prazo padrão).",
        ("Prazo de Entrega", "Data Limite", "Due Date"),
    ),
    Campo(
        DATA_ENTREGA, "Data de Entrega", False,
        ("data entrega", "data de entrega", "data da entrega", "data efetiva entrega",
         "data efetiva de entrega", "data real entrega", "entregue em", "delivery date"),
        "Data em que a encomenda foi efetivamente entregue.",
        ("Data da Entrega", "Data Efetiva de Entrega", "Entregue em"),
    ),
)

CAMPOS_POR_NOME: dict[str, Campo] = {c.nome: c for c in CAMPOS}
CAMPOS_OBRIGATORIOS: tuple[str, ...] = tuple(c.nome for c in CAMPOS if c.obrigatorio)
CAMPOS_DATA: tuple[str, ...] = (DATA, DATA_PREVISTA, DATA_ENTREGA)


def rotulo(nome_campo: str) -> str:
    return CAMPOS_POR_NOME[nome_campo].rotulo


# Estados ------------------------------------------------------------------
ENTREGUE = "Entregue"
PENDENTE = "Pendente"
EM_TRANSITO = "Em trânsito"
CANCELADA = "Cancelada"
DEVOLVIDA = "Devolvida"

ESTADOS_CANONICOS: tuple[str, ...] = (PENDENTE, EM_TRANSITO, ENTREGUE, CANCELADA, DEVOLVIDA)
# Encomendas que ainda têm de ser entregues (contam como "pendentes").
ESTADOS_POR_ENTREGAR: frozenset[str] = frozenset({PENDENTE, EM_TRANSITO})

# Só se reconhece um estado quando o texto é inequívoco. Por exemplo,
# "concluída" não está aqui porque pode não significar "entregue".
_SINONIMOS_ESTADO: dict[str, tuple[str, ...]] = {
    ENTREGUE: ("entregue", "entregues", "entrega efetuada", "entrega concluida", "delivered"),
    PENDENTE: ("pendente", "pendentes", "por expedir", "a aguardar expedicao",
               "aguarda expedicao", "em preparacao", "pending"),
    EM_TRANSITO: ("em transito", "em distribuicao", "expedida", "expedido", "enviada",
                  "enviado", "em rota", "saiu para entrega", "in transit", "shipped"),
    CANCELADA: ("cancelada", "cancelado", "anulada", "anulado", "cancelled", "canceled"),
    DEVOLVIDA: ("devolvida", "devolvido", "devolucao", "returned"),
}


def normalizar_texto(valor: object) -> str:
    """Converte texto para uma forma comparável.

    Minúsculas, sem acentos, sem pontuação e com espaços simples:
    "  N.º  Encomenda " -> "n encomenda".
    """
    # "º" e "ª" têm de sair antes da normalização Unicode, que os converte em "o"/"a".
    texto = str(valor).casefold().replace("º", " ").replace("ª", " ")
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(ch for ch in texto if not unicodedata.combining(ch))
    texto = re.sub(r"[^0-9a-z]+", " ", texto)
    return " ".join(texto.split())


_MAPA_ESTADOS: dict[str, str] = {
    normalizar_texto(sinonimo): canonico
    for canonico, sinonimos in _SINONIMOS_ESTADO.items()
    for sinonimo in (canonico, *sinonimos)
}

_MAPA_COLUNAS: dict[str, str] = {
    normalizar_texto(texto): campo.nome
    for campo in CAMPOS
    for texto in (campo.rotulo, *campo.sinonimos)
}


def normalizar_estado(valor: str) -> str | None:
    """Devolve o estado canónico ou ``None`` se o texto não for reconhecido."""
    return _MAPA_ESTADOS.get(normalizar_texto(valor))


def campo_da_coluna(nome_coluna: str) -> str | None:
    """Devolve o campo a que corresponde um cabeçalho, ou ``None``."""
    return _MAPA_COLUNAS.get(normalizar_texto(nome_coluna))


def detetar_colunas(colunas: list[str]) -> dict[str, str | None]:
    """Associa cada campo à primeira coluna do ficheiro com um nome reconhecido.

    Devolve um dicionário ``{campo: nome_da_coluna_ou_None}`` com todos os campos.
    """
    mapeamento: dict[str, str | None] = {c.nome: None for c in CAMPOS}
    for coluna in colunas:
        campo = campo_da_coluna(coluna)
        if campo is not None and mapeamento[campo] is None:
            mapeamento[campo] = coluna
    return mapeamento


def campos_em_falta(mapeamento: dict[str, str | None]) -> list[str]:
    """Campos obrigatórios que não têm coluna associada."""
    return [nome for nome in CAMPOS_OBRIGATORIOS if not mapeamento.get(nome)]


def colunas_repetidas(mapeamento: dict[str, str | None]) -> dict[str, list[str]]:
    """Colunas escolhidas para mais do que um campo: ``{coluna: [campos]}``."""
    usados: dict[str, list[str]] = {}
    for campo, coluna in mapeamento.items():
        if coluna:
            usados.setdefault(coluna, []).append(campo)
    return {coluna: campos for coluna, campos in usados.items() if len(campos) > 1}
