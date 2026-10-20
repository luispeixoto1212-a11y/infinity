"""Volumes grandes (versão 1.3): gravar, listar e comparar importações de 100 000
encomendas em tempos aceitáveis. Os limites são largos, para não falharem em
computadores mais lentos; os tempos medidos estão no README."""

from __future__ import annotations

import time

import pytest

from logiflow import comparacao as K
from logiflow import historico as H
from logiflow import persistencia as P

from .conftest import guardar

N = 100_000
ESTADOS = ["Entregue", "Pendente", "Em trânsito", "Cancelada"]


def _ficheiro(n: int, alteracao: int = 0) -> bytes:
    linhas = ["N.º Encomenda;Cliente;Data;Destino;Estado;Data Prevista;Data Entrega"]
    for i in range(n):
        estado = ESTADOS[(i + (1 if alteracao and i % alteracao == 0 else 0)) % 4]
        entrega = f"{(i % 25) + 3:02d}/10/2026" if estado == "Entregue" else ""
        linhas.append(f"E{i:07d};Cliente {i % 500};{(i % 28) + 1:02d}/09/2026;Destino {i % 40};{estado};"
                      f"{(i % 25) + 2:02d}/10/2026;{entrega}")
    return ("\n".join(linhas) + "\n").encode()


@pytest.fixture(scope="module")
def grande(tmp_path_factory):
    """Duas importações de 100 000 encomendas (a 2.ª com 1 % de alterações)."""
    caminho = tmp_path_factory.mktemp("volume") / P.NOME_BASE_DADOS
    P.preparar_base_dados(caminho)
    tempos = {}
    inicio = time.perf_counter()
    r1 = guardar(caminho, _ficheiro(N), "grande1.csv")
    tempos["ler_validar_gravar_1"] = time.perf_counter() - inicio
    inicio = time.perf_counter()
    r2 = guardar(caminho, _ficheiro(N, alteracao=100), "grande2.csv")
    tempos["ler_validar_gravar_2"] = time.perf_counter() - inicio
    return caminho, r1, r2, tempos


def test_gravar_100_mil_encomendas(grande):
    caminho, r1, r2, tempos = grande
    assert r1.situacao == r2.situacao == H.GUARDADA
    assert H.obter_importacao(caminho, r2.importacao_id)["linhas_lidas"] == N
    assert max(tempos.values()) < 60, tempos


def test_lista_do_historico_rapida_com_muitas_importacoes(grande):
    caminho, *_ = grande
    with P.ligar(caminho) as ligacao, P.transacao(ligacao):  # 2 000 importações de outros dias
        ligacao.executemany(
            "INSERT INTO importacoes (iniciada_em, nome_ficheiro, origem, hash_conteudo, impressao_digital, "
            "versao_formato, versao_aplicacao, estado, linhas_lidas) VALUES (?, ?, 'ficheiro', 'h', ?, 1, 'x', "
            "'concluida', 10)",
            [(f"2026-0{1 + i % 9}-1{i % 10}T08:00:00+00:00", f"dia_{i}.csv", f"i{i}") for i in range(2_000)])
    inicio = time.perf_counter()
    for _ in range(10):  # o que a interface faz em cada interação, 10 vezes
        lista, total = H.listar_importacoes(caminho, limite=50)
        H.importacoes_concluidas(caminho)
        H.obter_importacao(caminho, int(lista.loc[0, "id"]))
    media = (time.perf_counter() - inicio) / 10
    assert total == 2_002 and len(lista) == 50
    assert media < 0.5, media


def test_comparar_100_mil_encomendas(grande):
    caminho, r1, r2, _ = grande
    inicio = time.perf_counter()
    resultado = K.comparar_importacoes(caminho, r1.importacao_id, r2.importacao_id)
    duracao = time.perf_counter() - inicio
    assert resultado.disponivel and resultado.contagens[K.ALTERADA] == N // 100
    assert resultado.contagens[K.SEM_ALTERACOES] == N - N // 100
    assert duracao < 30, duracao


def test_fotografia_limitada_para_mostrar(grande):
    caminho, r1, *_ = grande
    inicio = time.perf_counter()
    primeiras = H.carregar_fotografia(caminho, r1.importacao_id, limite=5_000)
    assert len(primeiras) == 5_000 and time.perf_counter() - inicio < 2
