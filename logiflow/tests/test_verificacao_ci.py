"""Testes do script de verificação usado pelo CI no Windows (scripts/verificar_historico_ci.py).

Corre o script num processo à parte, com a pasta de dados temporária dos testes e com a
codificação de saída do Windows (cp1252) simulada, como acontece no registo do CI."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
SCRIPT = RAIZ / "scripts" / "verificar_historico_ci.py"


def _correr(*argumentos: str, otimizado: bool = False) -> subprocess.CompletedProcess:
    opcoes = ["-O"] if otimizado else []
    ambiente = {**os.environ, "PYTHONIOENCODING": "cp1252"}  # a página de código do Windows
    return subprocess.run([sys.executable, *opcoes, str(SCRIPT), *argumentos], cwd=RAIZ, capture_output=True,
                          env=ambiente, timeout=120)


def test_gravar_e_confirmar_com_saida_legivel(pasta_dados_temporaria):
    gravar = _correr("gravar")
    assert gravar.returncode == 0, gravar.stderr.decode("utf-8", "replace")
    assert gravar.stdout.decode("utf-8") == f"Historico (gravar): ok{os.linesep}"
    assert (pasta_dados_temporaria / "logiflow.db").is_file()
    confirmar = _correr("confirmar")
    assert confirmar.returncode == 0 and confirmar.stdout.decode("utf-8").startswith("Historico (confirmar): ok")


@pytest.mark.parametrize("otimizado", [False, True])
def test_nao_grava_numa_base_existente_mesmo_com_python_otimizado(pasta_dados_temporaria, otimizado):
    assert _correr("gravar").returncode == 0
    base = pasta_dados_temporaria / "logiflow.db"
    antes = base.read_bytes()
    segunda = _correr("gravar", otimizado=otimizado)
    assert segunda.returncode == 1
    assert "ERRO: ja existe uma base de dados" in segunda.stderr.decode("utf-8")
    assert base.read_bytes() == antes  # a base existente não foi aberta nem alterada


def test_confirmar_sem_historico_falha(pasta_dados_temporaria):
    resultado = _correr("confirmar", otimizado=True)
    assert resultado.returncode == 1 and "ERRO: a base de dados desapareceu" in resultado.stderr.decode("utf-8")
    assert not (pasta_dados_temporaria / "logiflow.db").exists()


def test_argumento_invalido(pasta_dados_temporaria):
    resultado = _correr("outra-coisa")
    assert resultado.returncode == 1 and "use: gravar | confirmar" in resultado.stderr.decode("utf-8")
