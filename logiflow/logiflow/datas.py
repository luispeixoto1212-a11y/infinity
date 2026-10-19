"""Interpretação de datas.

Regras (deliberadamente estritas, para não inventar datas):

* Datas escritas como texto são lidas no formato português, dia primeiro:
  ``03/04/2026`` é 3 de abril. Também se aceita o formato ISO ``2026-04-03``.
* Células de data do Excel são usadas tal como estão.
* Números soltos (por exemplo ``45930``) não são convertidos: podem ser uma
  data em formato interno do Excel, mas também outra coisa qualquer.
* Datas impossíveis (``31/02/2026``) ou com o ano fora de 2000–2100 são inválidas.
"""

from __future__ import annotations

import datetime as dt
import re

ANO_MINIMO = 2000
ANO_MAXIMO = 2100

_FORMATOS_DATA = (
    "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
)
_FORMATOS_HORA = ("", " %H:%M", " %H:%M:%S", "T%H:%M", "T%H:%M:%S")
_FORMATOS = tuple(d + h for d in _FORMATOS_DATA for h in _FORMATOS_HORA)

MOTIVO_FORMATO = "formato não reconhecido (use dd/mm/aaaa)"
MOTIVO_INEXISTENTE = "data inexistente no calendário (dia ou mês impossível)"
MOTIVO_ANO = f"ano fora do intervalo aceite ({ANO_MINIMO}–{ANO_MAXIMO})"

# Texto com aspeto de data (ex.: 31/02/2026), usado só para escolher a mensagem de erro.
_PARECE_DATA = re.compile(r"^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})([ T].*)?$")


def _plausivel(data: dt.date) -> bool:
    return ANO_MINIMO <= data.year <= ANO_MAXIMO


def interpretar_data(valor: object) -> tuple[dt.date | None, str | None]:
    """Converte um valor numa data.

    Devolve ``(data, None)`` se for válida, ``(None, None)`` se o valor estiver
    vazio e ``(None, motivo)`` se não for possível interpretá-lo.
    """
    if valor is None:
        return None, None
    if isinstance(valor, dt.datetime):
        data = valor.date()
        return (data, None) if _plausivel(data) else (None, MOTIVO_ANO)
    if isinstance(valor, dt.date):
        return (valor, None) if _plausivel(valor) else (None, MOTIVO_ANO)

    texto = str(valor).strip()
    if not texto:
        return None, None

    ano_implausivel = False
    for formato in _FORMATOS:
        try:
            data = dt.datetime.strptime(texto, formato).date()
        except ValueError:
            continue
        if _plausivel(data):
            return data, None
        ano_implausivel = True
    if ano_implausivel:
        return None, MOTIVO_ANO
    return None, MOTIVO_INEXISTENTE if _PARECE_DATA.match(texto) else MOTIVO_FORMATO


def formatar_data(valor: dt.date | dt.datetime | None) -> str:
    """Data no formato português (dd/mm/aaaa); vazio se não houver data."""
    if valor is None:
        return ""
    try:
        return valor.strftime("%d/%m/%Y")
    except (AttributeError, ValueError):  # NaT do pandas, por exemplo
        return ""
