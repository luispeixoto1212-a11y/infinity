"""Verificação usada pelo CI no Windows (não é preciso usá-la no dia a dia).

Confirma, numa instalação real, que o histórico fica na pasta de dados do utilizador
(``%LOCALAPPDATA%\\LogiFlow`` no Windows), fora da pasta da aplicação, e que sobrevive
a uma reinstalação (``instalar.bat``) e ao arranque (``iniciar.bat``):

    python scripts/verificar_historico_ci.py gravar      (só numa instalação sem histórico)
    python scripts/verificar_historico_ci.py confirmar

Grava apenas o ficheiro de exemplo (dados fictícios).
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


def main(fase: str) -> None:
    caminho = P.caminho_base_dados()
    if sys.platform == "win32":
        assert caminho.parent == Path(os.environ["LOCALAPPDATA"]) / "LogiFlow", "pasta de dados inesperada"
    assert RAIZ not in caminho.resolve().parents, "a base de dados está dentro da pasta da aplicação"
    info = P.preparar_base_dados(caminho)
    if fase == "gravar":
        assert info.criada, "já existia uma base de dados: esta verificação só grava numa instalação nova"
        conteudo = EXEMPLO.read_bytes()
        lido = ler_ficheiro(EXEMPLO.name, conteudo)
        resultado = validar(lido, detetar_colunas(lido.colunas), REF)
        tabela = aplicar_prazos(resultado.tabela, REF, None)
        dados = H.preparar_dados(EXEMPLO.name, conteudo, lido.folha, resultado.mapeamento, resultado, tabela,
                                 REF, None, H.ORIGEM_EXEMPLO)
        assert H.registar_importacao(caminho, dados).situacao == H.GUARDADA
    elif fase == "confirmar":
        lista, total = H.listar_importacoes(caminho)
        assert not info.criada and total == 1 and int(lista.loc[0, "linhas_lidas"]) == 60, "o histórico perdeu-se"
    else:
        raise SystemExit("Use: gravar | confirmar")
    print(f"Histórico ({fase}): ok")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
