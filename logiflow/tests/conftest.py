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


def guardar(caminho_db, conteudo: bytes, nome: str = "teste.csv", referencia: dt.date = REFERENCIA,
            prazo_padrao: int | None = None, origem: str = "ficheiro"):
    """Lê, valida e guarda no histórico, como a aplicação faz ao importar um ficheiro."""
    from logiflow import historico

    lido, resultado, tabela, _ = processar(conteudo, nome, referencia, prazo_padrao)
    dados = historico.preparar_dados(nome, conteudo, lido.folha, resultado.mapeamento, resultado, tabela,
                                     referencia, prazo_padrao, origem)
    return historico.registar_importacao(caminho_db, dados)


@pytest.fixture
def base_dados(pasta_dados_temporaria):
    """Uma base de dados do histórico nova, numa pasta temporária."""
    from logiflow.persistencia import caminho_base_dados, preparar_base_dados

    caminho = caminho_base_dados()
    preparar_base_dados(caminho)
    return caminho


@pytest.fixture(autouse=True)
def pasta_dados_temporaria(tmp_path_factory):
    """Cada teste usa uma pasta de dados própria e temporária: os testes nunca tocam no
    histórico real do utilizador. (Usa um MonkeyPatch próprio, para que um
    ``monkeypatch.undo()`` dentro de um teste não desfaça esta proteção.)"""
    pasta = tmp_path_factory.mktemp("dados_logiflow")
    with pytest.MonkeyPatch.context() as protecao:
        protecao.setenv("LOGIFLOW_DADOS", str(pasta))
        yield pasta


def _fotografia_da_pasta_real() -> dict[str, tuple[int, int]]:
    import os

    from logiflow.persistencia import VARIAVEL_PASTA, pasta_dados

    pasta = pasta_dados({k: v for k, v in os.environ.items() if k != VARIAVEL_PASTA})
    if not pasta.is_dir():
        return {}
    return {str(p): (p.stat().st_size, p.stat().st_mtime_ns) for p in pasta.rglob("*") if p.is_file()}


@pytest.fixture(autouse=True, scope="session")
def pasta_real_nunca_e_tocada():
    """Garante, no fim da bateria, que a pasta de dados real (a predefinida) não foi
    criada nem alterada pelos testes."""
    antes = _fotografia_da_pasta_real()
    yield
    assert _fotografia_da_pasta_real() == antes, "Os testes alteraram a pasta de dados real do LogiFlow."
