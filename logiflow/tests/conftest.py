"""Funções de apoio partilhadas pelos testes."""

from __future__ import annotations

import datetime as dt
import io

import pytest
from openpyxl import Workbook

from logiflow.campos import detetar_colunas
from logiflow.importacao import ler_ficheiro
from logiflow.indicadores import aplicar_prazos, calcular_indicadores
from logiflow.validacao import validar

REFERENCIA = dt.date(2026, 10, 20)
CABECALHO = "N.º Encomenda;Cliente;Data;Destino;Estado"


def csv_bytes(*linhas: str, codificacao: str = "utf-8") -> bytes:
    return ("\n".join(linhas) + "\n").encode(codificacao)


def xlsx_bytes(linhas: list[list[object]], folhas: dict[str, list[list[object]]] | None = None) -> bytes:
    livro = Workbook()
    folha = livro.active
    folha.title = "Encomendas"
    for linha in linhas:
        folha.append(linha)
    for nome, conteudo in (folhas or {}).items():
        extra = livro.create_sheet(nome)
        for linha in conteudo:
            extra.append(linha)
    memoria = io.BytesIO()
    livro.save(memoria)
    return memoria.getvalue()


def processar(conteudo: bytes, nome: str = "teste.csv", referencia: dt.date = REFERENCIA,
              prazo_padrao: int | None = None):
    """Lê, valida e calcula prazos/indicadores, como a aplicação faz."""
    lido = ler_ficheiro(nome, conteudo)
    resultado = validar(lido, detetar_colunas(lido.colunas), referencia)
    tabela = aplicar_prazos(resultado.tabela, referencia, prazo_padrao)
    return lido, resultado, tabela, calcular_indicadores(tabela)


@pytest.fixture
def referencia() -> dt.date:
    return REFERENCIA
