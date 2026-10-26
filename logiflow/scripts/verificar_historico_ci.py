"""Verificação usada pelo CI no Windows (não é preciso usá-la no dia a dia).

Confirma, numa instalação real, que o histórico fica na pasta de dados do utilizador
(``%LOCALAPPDATA%\\LogiFlow`` no Windows), fora da pasta da aplicação, e que sobrevive
a uma reinstalação (``instalar.bat``) e ao arranque (``iniciar.bat``):

    python scripts/verificar_historico_ci.py gravar      (só numa instalação sem histórico)
    python scripts/verificar_historico_ci.py confirmar

Grava apenas o ficheiro de exemplo (dados fictícios) e recusa-se a gravar se já existir
uma base de dados. As mensagens são escritas sem acentos e a saída em UTF-8, para se
lerem bem no registo do CI (no Windows, a saída redirecionada usa a página de código
do sistema). As verificações não usam ``assert``, que o ``python -O`` desligaria.
"""

import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from logiflow import historico as H  # noqa: E402
from logiflow import persistencia as P  # noqa: E402
from logiflow.campos import detetar_colunas  # noqa: E402
from logiflow.exemplo import DATA_REFERENCIA_EXEMPLO as REF  # noqa: E402
from logiflow.exemplo import FICHEIRO_EXEMPLO_XLSX as EXEMPLO  # noqa: E402
from logiflow.importacao import ler_ficheiro  # noqa: E402
from logiflow.indicadores import aplicar_prazos  # noqa: E402
from logiflow.validacao import validar  # noqa: E402


def _exigir(condicao: bool, mensagem: str) -> None:
    if not condicao:
        print(f"ERRO: {mensagem}", file=sys.stderr)
        raise SystemExit(1)


def main(fase: str) -> None:
    for fluxo in (sys.stdout, sys.stderr):
        fluxo.reconfigure(encoding="utf-8", errors="replace")
    _exigir(fase in ("gravar", "confirmar"), "use: gravar | confirmar")
    caminho = P.caminho_base_dados()
    if sys.platform == "win32":
        _exigir(caminho.parent == Path(os.environ["LOCALAPPDATA"]) / "LogiFlow", "pasta de dados inesperada")
    _exigir(RAIZ not in caminho.resolve().parents, "a base de dados esta dentro da pasta da aplicacao")
    if fase == "gravar":
        _exigir(not caminho.exists(), "ja existe uma base de dados: esta verificacao so grava numa instalacao nova")
        info = P.preparar_base_dados(caminho)
        _exigir(info.criada, "a base de dados nao foi criada")
        conteudo = EXEMPLO.read_bytes()
        lido = ler_ficheiro(EXEMPLO.name, conteudo)
        resultado = validar(lido, detetar_colunas(lido.colunas), REF)
        tabela = aplicar_prazos(resultado.tabela, REF, None)
        dados = H.preparar_dados(EXEMPLO.name, conteudo, lido.folha, resultado.mapeamento, resultado, tabela,
                                 REF, None, H.ORIGEM_EXEMPLO)
        _exigir(H.registar_importacao(caminho, dados).situacao == H.GUARDADA, "a importacao nao foi gravada")
    else:
        _exigir(caminho.exists(), "a base de dados desapareceu")
        info = P.preparar_base_dados(caminho)
        lista, total = H.listar_importacoes(caminho)
        _exigir(not info.criada and total == 1 and int(lista.loc[0, "linhas_lidas"]) == 60,
                "o historico perdeu-se")
    print(f"Historico ({fase}): ok")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
