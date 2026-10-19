"""Localização do ficheiro de exemplo (dados fictícios) e data usada na demonstração."""

import datetime as dt
from pathlib import Path

PASTA_EXEMPLO = Path(__file__).resolve().parent.parent / "dados_exemplo"
FICHEIRO_EXEMPLO_XLSX = PASTA_EXEMPLO / "encomendas_exemplo.xlsx"
FICHEIRO_EXEMPLO_CSV = PASTA_EXEMPLO / "encomendas_exemplo.csv"

# As datas do exemplo são fixas (setembro e outubro de 2026). Para a demonstração
# mostrar sempre os mesmos atrasos, a aplicação usa esta data de referência
# quando se abre o exemplo; o utilizador pode alterá-la na barra lateral.
DATA_REFERENCIA_EXEMPLO = dt.date(2026, 10, 20)
