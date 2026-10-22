"""Testes do script de verificação usado pelo CI no Windows (scripts/verificar_historico_ci.py).

Corre o script num processo à parte, sempre com pastas temporárias e com a codificação de
saída do Windows (cp1252) simulada, como acontece no registo do CI. No Windows, o script só
aceita a base de dados em ``%LOCALAPPDATA%\\LogiFlow``: os testes dão ao processo um
LOCALAPPDATA temporário com essa estrutura (só no ambiente do processo filho), sem tocar na
pasta real nem desligar a proteção."""

from __future__ import annotations

import hashlib
import os
import subprocess
import sys
from pathlib import Path

import pytest

from logiflow import persistencia as P

RAIZ = Path(__file__).resolve().parent.parent
SCRIPT = RAIZ / "scripts" / "verificar_historico_ci.py"


@pytest.fixture
def pasta_ci(tmp_path):
    """Pasta de dados temporária com a estrutura exigida no Windows:
    ``<LOCALAPPDATA temporário>\\LogiFlow`` (ainda não existe, como numa instalação nova)."""
    local = tmp_path / "AppData" / "Local"
    local.mkdir(parents=True)
    return local / "LogiFlow"


def _correr(pasta: Path, *argumentos: str, localappdata: Path | None = None,
            otimizado: bool = False) -> subprocess.CompletedProcess:
    """A base de dados fica em ``pasta`` (LOGIFLOW_DADOS); LOCALAPPDATA é a pasta-mãe, salvo
    indicação em contrário. As duas variáveis apontam sempre para pastas temporárias."""
    opcoes = ["-O"] if otimizado else []
    ambiente = {**os.environ,
                "PYTHONIOENCODING": "cp1252",  # a página de código do Windows
                P.VARIAVEL_PASTA: str(pasta),
                "LOCALAPPDATA": str(localappdata if localappdata is not None else pasta.parent)}
    return subprocess.run([sys.executable, *opcoes, str(SCRIPT), *argumentos], cwd=RAIZ, capture_output=True,
                          env=ambiente, timeout=120)


def _fotografia(raiz: Path) -> dict[str, tuple]:
    """Tudo o que existe dentro da pasta: as pastas e, de cada ficheiro, o tamanho, a data e o conteúdo."""
    return {str(p.relative_to(raiz)): ("pasta",) if p.is_dir()
            else (p.stat().st_size, p.stat().st_mtime_ns, hashlib.sha256(p.read_bytes()).hexdigest())
            for p in raiz.rglob("*")}


def test_gravar_e_confirmar_com_saida_legivel(pasta_ci):
    gravar = _correr(pasta_ci, "gravar")
    assert gravar.returncode == 0, gravar.stderr.decode("utf-8", "replace")
    assert gravar.stdout.decode("utf-8") == f"Historico (gravar): ok{os.linesep}"
    assert (pasta_ci / "logiflow.db").is_file()
    confirmar = _correr(pasta_ci, "confirmar")
    assert confirmar.returncode == 0, confirmar.stderr.decode("utf-8", "replace")
    assert confirmar.stdout.decode("utf-8").startswith("Historico (confirmar): ok")


@pytest.mark.parametrize("otimizado", [False, True])
def test_nao_grava_numa_base_existente_mesmo_com_python_otimizado(pasta_ci, otimizado):
    primeira = _correr(pasta_ci, "gravar")
    assert primeira.returncode == 0, primeira.stderr.decode("utf-8", "replace")
    base = pasta_ci / "logiflow.db"
    antes = base.read_bytes()
    segunda = _correr(pasta_ci, "gravar", otimizado=otimizado)
    assert segunda.returncode == 1
    assert "ERRO: ja existe uma base de dados" in segunda.stderr.decode("utf-8")
    assert base.read_bytes() == antes  # a base existente não foi aberta nem alterada


def test_confirmar_sem_historico_falha(pasta_ci):
    resultado = _correr(pasta_ci, "confirmar", otimizado=True)
    assert resultado.returncode == 1 and "ERRO: a base de dados desapareceu" in resultado.stderr.decode("utf-8")
    assert not (pasta_ci / "logiflow.db").exists()


def test_argumento_invalido(pasta_ci):
    resultado = _correr(pasta_ci, "outra-coisa")
    assert resultado.returncode == 1 and "use: gravar | confirmar" in resultado.stderr.decode("utf-8")
    assert not pasta_ci.exists()


@pytest.mark.skipif(sys.platform != "win32", reason="a proteção da pasta de dados só existe no Windows")
@pytest.mark.parametrize("com_base", [False, True], ids=["pasta-inexistente", "base-existente"])
@pytest.mark.parametrize("fase", ["gravar", "confirmar"])
def test_windows_recusa_pasta_fora_de_localappdata(tmp_path, monkeypatch, fase, com_base):
    """Uma pasta de dados fora de %LOCALAPPDATA%\\LogiFlow é recusada (mesmo com python -O), sem
    criar nem alterar nada: nem a pasta indicada, nem a base que lá exista, nem a pasta autorizada."""
    local = tmp_path / "AppData" / "Local"
    local.mkdir(parents=True)
    fora = tmp_path / "OutraPasta"
    if com_base:  # base fictícia e vazia, no esquema 1: se o script a abrisse, migrava-a (e alterava-a)
        with monkeypatch.context() as m:
            m.setattr(P, "MIGRACOES", {1: P.MIGRACOES[1]})
            P.preparar_base_dados(fora / P.NOME_BASE_DADOS)
    antes = _fotografia(tmp_path)
    resultado = _correr(fora, fase, localappdata=local, otimizado=True)
    assert resultado.returncode == 1
    assert "ERRO: pasta de dados inesperada" in resultado.stderr.decode("utf-8")
    assert resultado.stdout == b""
    assert _fotografia(tmp_path) == antes
    assert not (local / "LogiFlow").exists()
