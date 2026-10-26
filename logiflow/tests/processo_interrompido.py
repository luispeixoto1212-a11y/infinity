"""Auxiliar dos testes de interrupção: corre uma operação num processo à parte e termina-o
de repente (``os._exit``, como um fecho forçado ou uma falha de energia) num ponto exato.

Uso (a partir da pasta logiflow): ``python -m tests.processo_interrompido <cenário> <base> [<extra>]``.
Só é chamado pelos testes, sempre com pastas temporárias. O código de saída 9 indica que o
processo foi terminado no ponto pretendido; 0, que a operação terminou sem ser interrompida.
"""

from __future__ import annotations

import contextlib
import os
import sys
from pathlib import Path

from logiflow import conservacao as R
from logiflow import copias as B
from logiflow import historico as H
from logiflow import persistencia as P

from .conftest import CABECALHO, csv_bytes, guardar

TERMINADO = 9


def _morrer(*_args, **_kwargs):
    os._exit(TERMINADO)


def _depois(funcao, n_chamada: int = 1):
    """Chama a função original e termina o processo a seguir à n-ésima chamada."""
    chamadas = []

    def embrulho(*args, **kwargs):
        resultado = funcao(*args, **kwargs)
        chamadas.append(1)
        if len(chamadas) == n_chamada:
            os._exit(TERMINADO)
        return resultado
    return embrulho


def _antes(funcao, n_chamada: int = 1):
    """Termina o processo na n-ésima chamada, antes de a função correr."""
    chamadas = []

    def embrulho(*args, **kwargs):
        chamadas.append(1)
        if len(chamadas) == n_chamada:
            os._exit(TERMINADO)
        return funcao(*args, **kwargs)
    return embrulho


def _copiar_e_morrer_a_meio(fonte, alvo, paginas=-1):
    """API de cópia página a página, terminando o processo a meio da cópia."""
    def progresso(estado, restantes, total):
        if restantes < total / 2:
            os._exit(TERMINADO)
    fonte.backup(alvo, pages=1, progress=progresso)


def main(cenario: str, base: Path, extra: str = "") -> None:
    if cenario == "importacao":  # a meio da transação que grava as encomendas
        H._inserir_fotografia = _depois(H._inserir_fotografia)
        guardar(base, csv_bytes(CABECALHO, *(f"Z{i};Cliente {i};01/10/2026;Porto;Pendente" for i in range(2000))),
                "interrompida.csv")
    elif cenario.startswith("recuperar-"):
        ponto = cenario.removeprefix("recuperar-")
        if ponto == "antes-de-preservar":       # cópia preparada no temporário; base em uso intacta
            B.copiar_sqlite = _antes(B.copiar_sqlite, 2)
        elif ponto == "depois-de-preservar":    # base em uso já copiada para «copias»
            B.copiar_sqlite = _depois(B.copiar_sqlite, 2)
        elif ponto == "durante-a-substituicao":  # a meio da cópia de páginas para a base em uso
            original = B.copiar_paginas
            chamadas = []

            def copiar(fonte, alvo, paginas=-1):
                chamadas.append(1)
                if len(chamadas) == 3:  # 1.ª: cópia → temporário; 2.ª: preservação; 3.ª: substituição
                    return _copiar_e_morrer_a_meio(fonte, alvo)
                return original(fonte, alvo, paginas)
            B.copiar_paginas = copiar
            P.copiar_paginas = copiar
        elif ponto == "antes-da-verificacao-final":
            B._validar_base = _antes(B._validar_base, 2)
        elif ponto == "danificada-depois-de-preservar":  # cópia byte a byte feita; base danificada no lugar
            B._copiar_em_bruto = _depois(B._copiar_em_bruto)
        elif ponto == "danificada-antes-da-troca":  # auxiliares já retirados; troca por fazer
            real = os.replace

            def substituir(origem, destino):
                if Path(destino) == base:
                    os._exit(TERMINADO)
                return real(origem, destino)
            B.os.replace = substituir
        B.restaurar_copia(base, Path(extra))
    elif cenario == "copia":  # a meio da cópia de segurança
        P.copiar_paginas = _copiar_e_morrer_a_meio
        B.criar_copia(base, Path(extra))
    elif cenario == "migracao":  # dentro da transação de uma migração (esquema seguinte simulado)
        P.MIGRACOES[P.esquema_atual() + 1] = ("CREATE TABLE futura (x)", "INSERT INTO futura VALUES (1)")
        P.registar_evento = _depois(P.registar_evento)
        P.preparar_base_dados(base)
    elif cenario == "migracao-1-para-2":  # migração real do esquema 1 para o 2
        P.registar_evento = _depois(P.registar_evento)
        P.preparar_base_dados(base)
    elif cenario == "eliminar":  # registo à parte já escrito; eliminação na base por confirmar
        R._eliminar = _morrer
        R.eliminar_importacao(base, int(extra))
    elif cenario == "manutencao":  # recuperação a decorrer: segura o bloqueio e fica à espera
        with P.bloqueio_manutencao(base, "teste"):
            print("bloqueado", flush=True)
            with contextlib.suppress(Exception):
                sys.stdin.readline()
        return
    else:
        raise SystemExit(f"cenário desconhecido: {cenario}")


if __name__ == "__main__":
    main(sys.argv[1], Path(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else "")
