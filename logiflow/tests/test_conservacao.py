"""Testes da conservação de dados (revisão da 1.3.0): prazo, eliminação de importações,
registo de eliminações e coerência com as cópias de segurança e a recuperação."""

from __future__ import annotations

import datetime as dt
import json
import shutil
import sqlite3
from pathlib import Path

import pytest

from logiflow import comparacao as K
from logiflow import conservacao as R
from logiflow import copias as B
from logiflow import historico as H
from logiflow import persistencia as P

from .conftest import CABECALHO, csv_bytes, guardar

HOJE = dt.date(2026, 10, 20)
DIA1 = csv_bytes(CABECALHO, "A1;Cliente Confidencial Um;01/10/2026;Rua Secreta 1;Pendente",
                 "A2;Cliente Dois;02/10/2026;Faro;Entregue")
DIA2 = csv_bytes(CABECALHO, "A1;Cliente Confidencial Um;01/10/2026;Rua Secreta 1;Entregue",
                 "A3;Cliente Três;03/10/2026;Braga;Pendente")
DIA3 = csv_bytes(CABECALHO, "B1;Cliente Quatro;05/10/2026;Porto;Pendente")


def _mudar_data(caminho_db: Path, importacao_id: int, iniciada_em: str) -> None:
    """Simula uma importação feita noutra data (os testes não podem esperar meses)."""
    with P.ligar(caminho_db) as ligacao, P.transacao(ligacao):
        ligacao.execute("UPDATE importacoes SET iniciada_em = ? WHERE id = ?", (iniciada_em, importacao_id))


def _estado(caminho_db: Path) -> dict[int, tuple]:
    with P.ligar(caminho_db) as ligacao:
        importacoes = ligacao.execute("SELECT id, nome_ficheiro, dados_eliminados_em IS NOT NULL, motivo_eliminacao, "
                                      "linhas_lidas, ind_entregues FROM importacoes ORDER BY id").fetchall()
        linhas = dict(ligacao.execute("SELECT importacao_id, COUNT(*) FROM encomendas_historico GROUP BY 1").fetchall())
    return {i: (nome, eliminada, motivo, lidas, entregues, linhas.get(i, 0))
            for i, nome, eliminada, motivo, lidas, entregues in importacoes}


def _bytes_da_base(caminho_db: Path) -> bytes:
    conteudo = caminho_db.read_bytes()
    wal = Path(f"{caminho_db}-wal")
    return conteudo + (wal.read_bytes() if wal.exists() else b"")


# Prazo de conservação ----------------------------------------------------------------------------

def test_sem_prazo_por_omissao_nada_e_eliminado(base_dados):
    guardar(base_dados, DIA1)
    _mudar_data(base_dados, 1, "2020-01-01T08:00:00+00:00")
    assert R.ler_prazo(base_dados) is None
    resumo = R.aplicar_conservacao(base_dados, hoje=HOJE)
    assert resumo.importacoes == 0 and _estado(base_dados)[1][5] == 2


@pytest.mark.parametrize("hoje, meses, esperado", [
    (dt.date(2026, 10, 20), 12, dt.date(2025, 10, 20)),
    (dt.date(2026, 3, 31), 1 * 3, dt.date(2025, 12, 31)),
    (dt.date(2026, 5, 31), 3, dt.date(2026, 2, 28)),   # fevereiro sem dia 31
    (dt.date(2028, 5, 31), 3, dt.date(2028, 2, 29)),   # ano bissexto
    (dt.date(2026, 1, 15), 36, dt.date(2023, 1, 15)),
])
def test_data_limite_em_meses_de_calendario(hoje, meses, esperado):
    assert R.data_limite(meses, hoje) == esperado


def test_prazo_elimina_so_as_importacoes_antigas_e_mantem_os_totais(base_dados):
    guardar(base_dados, DIA1, "antiga.csv")
    guardar(base_dados, DIA2, "recente.csv")
    _mudar_data(base_dados, 1, "2025-09-01T08:00:00+00:00")  # mais de 12 meses antes de HOJE
    assert R.previsao(base_dados, 12, hoje=HOJE) == 1 and R.previsao(base_dados, None, hoje=HOJE) == 0

    resumo = R.definir_prazo(base_dados, 12, hoje=HOJE)
    assert (resumo.por_prazo, resumo.linhas) == (1, 2)
    estado = _estado(base_dados)
    assert estado[1] == (R.NOME_ELIMINADO, 1, R.PRAZO, 2, 1, 0)  # totais ficam; linhas e nome não
    assert estado[2] == ("recente.csv", 0, None, 2, 1, 2)
    imp = H.obter_importacao(base_dados, 1)
    assert imp["folha"] is None and imp["mapeamento"] is None and imp["mensagem_erro"] is None
    assert R.ler_prazo(base_dados) == 12
    assert R.aplicar_conservacao(base_dados, hoje=HOJE).importacoes == 0  # idempotente


def test_prazo_aplicado_em_cada_arranque(base_dados):
    R.definir_prazo(base_dados, 6, hoje=HOJE)
    guardar(base_dados, DIA1)
    assert R.aplicar_conservacao(base_dados, hoje=HOJE).importacoes == 0
    # Seis meses depois, a mesma importação passa o prazo (simulado com a data de hoje).
    resumo = R.aplicar_conservacao(base_dados, hoje=HOJE + dt.timedelta(days=200))
    assert resumo.por_prazo == 1 and _estado(base_dados)[1][5] == 0


def test_prazo_invalido_e_recusado(base_dados):
    with pytest.raises(P.ErroPersistencia, match="Prazo de conservação inválido"):
        R.definir_prazo(base_dados, 7)


def test_importacao_em_processamento_nao_e_eliminada_pelo_prazo(base_dados):
    R.definir_prazo(base_dados, 3, hoje=HOJE)
    with P.ligar(base_dados) as ligacao, P.transacao(ligacao):
        ligacao.execute("INSERT INTO importacoes (iniciada_em, nome_ficheiro, origem, hash_conteudo, impressao_digital, "
                        "versao_formato, versao_aplicacao, estado) VALUES ('2020-01-01T00:00:00+00:00', 'x.csv', "
                        "'ficheiro', 'h', 'i', 1, 'x', 'em_processamento')")
    assert R.aplicar_conservacao(base_dados, hoje=HOJE).importacoes == 0


# Eliminar uma importação -----------------------------------------------------------------------------

def test_eliminar_importacao_apaga_dados_e_permite_reimportar(base_dados):
    guardar(base_dados, DIA1, "dia1.csv")
    guardar(base_dados, DIA2, "dia2.csv")
    resumo = R.eliminar_importacao(base_dados, 1)
    assert (resumo.manuais, resumo.linhas) == (1, 2)
    assert _estado(base_dados)[1] == (R.NOME_ELIMINADO, 1, R.MANUAL, 2, 1, 0)
    assert _estado(base_dados)[2][5] == 2  # a outra importação não foi tocada
    assert R.eliminar_importacao(base_dados, 1).importacoes == 0  # idempotente
    # Não entra em comparações nem como «anterior»; o mesmo ficheiro pode voltar a ser importado.
    assert list(H.importacoes_concluidas(base_dados)["id"]) == [2]
    assert "foram eliminados" in K.comparar_importacoes(base_dados, 1, 2).motivo
    novo = guardar(base_dados, DIA1, "dia1-de-novo.csv")
    assert (novo.situacao, novo.importacao_id, novo.importacao_anterior_id) == (H.GUARDADA, 3, 2)


def test_eliminar_em_processamento_ou_inexistente_e_recusado(base_dados):
    with pytest.raises(P.ErroPersistencia, match="já não existe"):
        R.eliminar_importacao(base_dados, 99)
    with P.ligar(base_dados) as ligacao, P.transacao(ligacao):
        ligacao.execute("INSERT INTO importacoes (iniciada_em, nome_ficheiro, origem, hash_conteudo, impressao_digital, "
                        "versao_formato, versao_aplicacao, estado) VALUES (?, 'x.csv', 'ficheiro', 'h', 'i', 1, 'x', "
                        "'em_processamento')", (P.agora_utc(),))
    with pytest.raises(P.ErroPersistencia, match="ainda está a ser gravada"):
        R.eliminar_importacao(base_dados, 1)


def _sqlite_sem_apagamento_seguro(monkeypatch):
    """Simula o SQLite do Python para Windows, que (ao contrário do de várias distribuições Linux)
    não sobrescreve por omissão o conteúdo apagado: o código tem de o pedir explicitamente."""
    import contextlib

    original = R.ligar

    @contextlib.contextmanager
    def ligar(caminho, **opcoes):
        with original(caminho, **opcoes) as ligacao:
            ligacao.execute("PRAGMA secure_delete = OFF")
            yield ligacao

    monkeypatch.setattr(R, "ligar", ligar)


@pytest.mark.parametrize("como", ["manual", "prazo"])
def test_dados_eliminados_deixam_de_estar_no_ficheiro(base_dados, monkeypatch, como):
    """Sem «secure_delete» e sem esvaziar o diário, o texto apagado continuaria no disco."""
    _sqlite_sem_apagamento_seguro(monkeypatch)
    guardar(base_dados, DIA1, "dia1.csv")
    guardar(base_dados, DIA3, "dia3.csv")
    assert b"Rua Secreta 1" in _bytes_da_base(base_dados)
    if como == "manual":
        R.eliminar_importacao(base_dados, 1)
    else:
        _mudar_data(base_dados, 1, "2020-01-01T08:00:00+00:00")
        R.definir_prazo(base_dados, 12, hoje=HOJE)
    conteudo = _bytes_da_base(base_dados)
    assert b"Rua Secreta 1" not in conteudo and b"Cliente Confidencial Um" not in conteudo
    assert b"dia1.csv" not in conteudo
    assert b"Cliente Quatro" in conteudo  # o que não foi eliminado continua lá


def test_registo_de_eliminacoes_sem_dados_pessoais(base_dados):
    guardar(base_dados, DIA1, "dia1.csv")
    R.eliminar_importacao(base_dados, 1)
    texto = R.caminho_registo(base_dados).read_text(encoding="utf-8")
    registo = json.loads(texto)
    assert registo["formato"] == 1 and registo["prazo_meses"] is None and len(registo["eliminacoes"]) == 1
    assert set(registo["eliminacoes"][0]) == {"impressao_digital", "iniciada_em", "momento", "motivo"}
    assert "Confidencial" not in texto and "dia1.csv" not in texto and "Rua" not in texto
    with P.ligar(base_dados) as ligacao:
        detalhes = " ".join(r[0] for r in ligacao.execute("SELECT detalhe FROM eventos"))
    assert "Confidencial" not in detalhes and "dia1" not in detalhes


# Recuperação de cópias: os dados eliminados não voltam ---------------------------------------------------

def test_recuperar_copia_antiga_volta_a_eliminar(base_dados, tmp_path):
    guardar(base_dados, DIA1, "dia1.csv")
    guardar(base_dados, DIA2, "dia2.csv")
    copia = B.criar_copia(base_dados, tmp_path).caminho  # feita antes da eliminação: tem os dados de dia1
    R.eliminar_importacao(base_dados, 1)

    resultado = B.restaurar_copia(base_dados, copia)
    assert resultado.reeliminadas == 1 and "foram eliminados de novo" in resultado.mensagem
    assert _estado(base_dados)[1] == (R.NOME_ELIMINADO, 1, R.MANUAL, 2, 1, 0)
    assert _estado(base_dados)[2][5] == 2
    assert b"Cliente Dois" not in _bytes_da_base(base_dados)  # só existia na importação eliminada
    # A cópia continua igual (é uma fotografia do passado) e fica assinalada.
    assert [c.contem_eliminados for c in B.avaliar_copias(tmp_path, base_dados)] == [True]


def test_recuperar_volta_a_aplicar_o_prazo_atual_e_nao_o_da_copia(base_dados, tmp_path):
    guardar(base_dados, DIA1, "dia1.csv")
    _mudar_data(base_dados, 1, "2025-01-01T08:00:00+00:00")
    copia = B.criar_copia(base_dados, tmp_path).caminho  # sem prazo, com a importação antiga
    R.definir_prazo(base_dados, 12, hoje=HOJE)
    assert _estado(base_dados)[1][1] == 1
    B.restaurar_copia(base_dados, copia)
    assert R.ler_prazo(base_dados) == 12
    assert _estado(base_dados)[1][1] == 1 and _estado(base_dados)[1][5] == 0


def test_recuperar_com_a_base_danificada_usa_o_registo_a_parte(base_dados, tmp_path):
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, tmp_path).caminho
    R.eliminar_importacao(base_dados, 1)
    for sufixo in ("-wal", "-shm"):
        Path(f"{base_dados}{sufixo}").unlink(missing_ok=True)
    base_dados.write_bytes(b"danificada" * 500)  # a base (com o registo de eliminações interno) perdeu-se
    resultado = B.restaurar_copia(base_dados, copia)
    assert resultado.reeliminadas == 1 and _estado(base_dados)[1][5] == 0


def test_recuperacao_manual_de_uma_copia_e_corrigida_no_arranque(base_dados, tmp_path):
    """Quem segue a recuperação manual (copiar a cópia por cima da base) também não recupera
    dados eliminados: o arranque seguinte reaplica o registo à parte."""
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, tmp_path).caminho
    R.eliminar_importacao(base_dados, 1)
    for sufixo in ("", "-wal", "-shm"):
        Path(f"{base_dados}{sufixo}").unlink(missing_ok=True)
    shutil.copyfile(copia, base_dados)
    assert _estado(base_dados)[1][5] == 2  # antes do arranque, os dados estão lá (é a cópia)
    P.preparar_base_dados(base_dados)
    assert R.aplicar_conservacao(base_dados).por_registo == 1
    assert _estado(base_dados)[1][5] == 0


def test_registo_ilegivel_e_guardado_a_parte_e_avisado(base_dados):
    guardar(base_dados, DIA1, "dia1.csv")
    R.caminho_registo(base_dados).write_text("{isto não é json", encoding="utf-8")
    resumo = R.eliminar_importacao(base_dados, 1)
    assert any("não pôde ser lido" in aviso for aviso in resumo.avisos)
    guardados = list(base_dados.parent.glob("registo-eliminacoes.ilegivel-*.json"))
    assert len(guardados) == 1 and guardados[0].read_text(encoding="utf-8") == "{isto não é json"  # nunca apagado
    assert len(R.ler_registo(base_dados)[0]["eliminacoes"]) == 1


def test_eliminacao_identifica_a_importacao_pelo_conteudo_e_nao_pelo_numero(base_dados, tmp_path):
    """Depois de recuperar uma cópia, os n.ºs podem repetir-se para importações diferentes; o
    registo de eliminações nunca elimina a importação errada."""
    guardar(base_dados, DIA1, "dia1.csv")
    copia = B.criar_copia(base_dados, tmp_path).caminho
    guardar(base_dados, DIA2, "dia2.csv")  # n.º 2
    R.eliminar_importacao(base_dados, 2)
    B.restaurar_copia(base_dados, copia)  # volta a haver só a n.º 1
    nova = guardar(base_dados, DIA3, "dia3.csv")  # recebe outra vez o n.º 2
    assert nova.importacao_id == 2
    R.aplicar_conservacao(base_dados)
    assert _estado(base_dados)[2] == ("dia3.csv", 0, None, 1, 0, 1)  # a nova n.º 2 não foi eliminada


# Cópias assinaladas e apagar cópias --------------------------------------------------------------------

def test_copias_assinaladas_e_apagadas_so_com_pedido(base_dados, tmp_path):
    guardar(base_dados, DIA1, "dia1.csv")
    antiga = B.criar_copia(base_dados, tmp_path).caminho
    R.eliminar_importacao(base_dados, 1)
    recente = B.criar_copia(base_dados, tmp_path).caminho
    outro = tmp_path / "notas.txt"
    outro.write_text("não é uma cópia")
    avaliadas = {c.caminho.name: c for c in B.avaliar_copias(tmp_path, base_dados)}
    assert avaliadas[antiga.name].assinalada and not avaliadas[recente.name].assinalada
    assert B.apagar_copias(tmp_path, [antiga]) == 1
    assert not antiga.exists() and recente.exists() and outro.exists()
    with pytest.raises(P.ErroPersistencia, match="não é uma cópia do LogiFlow"):
        B.apagar_copias(tmp_path, [outro])
    with pytest.raises(P.ErroPersistencia, match="não é uma cópia do LogiFlow"):
        B.apagar_copias(tmp_path, [base_dados])  # a base de dados em uso nunca
    assert outro.exists() and base_dados.exists()


def test_copia_com_dados_fora_do_prazo(base_dados, tmp_path):
    guardar(base_dados, DIA1)
    _mudar_data(base_dados, 1, "2020-01-01T08:00:00+00:00")
    copia = B.criar_copia(base_dados, tmp_path).caminho  # feita agora, mas com uma importação de 2020
    [avaliada] = B.avaliar_copias(tmp_path, base_dados)
    assert avaliada.legivel and not avaliada.assinalada  # sem prazo definido, nada a assinalar
    R.definir_prazo(base_dados, 3)
    [avaliada] = B.avaliar_copias(tmp_path, base_dados)
    assert avaliada.caminho == copia and avaliada.contem_fora_do_prazo and avaliada.contem_eliminados
    # Uma cópia feita depois de aplicado o prazo já não tem esses dados.
    depois = B.criar_copia(base_dados, tmp_path).caminho
    assert not {c.caminho: c for c in B.avaliar_copias(tmp_path, base_dados)}[depois].assinalada


def test_copia_ilegivel_aparece_mas_nao_e_assinalada(base_dados, tmp_path):
    (tmp_path / "logiflow-copia-20260101-080000.db").write_bytes(b"lixo" * 100)
    [avaliada] = B.avaliar_copias(tmp_path, base_dados)
    assert not avaliada.legivel and not avaliada.assinalada


# Migração do esquema 1 (versão em validação anterior) para o 2 ----------------------------------------

def _base_no_esquema_1(caminho: Path, monkeypatch) -> None:
    """Uma base criada com o esquema 1 e com dados, como a da primeira versão em validação."""
    with monkeypatch.context() as m:
        m.setattr(P, "MIGRACOES", {1: P.MIGRACOES[1]})
        P.preparar_base_dados(caminho)
    with P.ligar(caminho) as ligacao, P.transacao(ligacao):
        ligacao.execute("INSERT INTO importacoes (iniciada_em, concluida_em, nome_ficheiro, origem, hash_conteudo, "
                        "impressao_digital, versao_formato, versao_aplicacao, estado, linhas_lidas, encomendas_validas, "
                        "linhas_com_erros, linhas_com_avisos) VALUES ('2026-10-01T08:00:00+00:00', "
                        "'2026-10-01T08:00:01+00:00', 'antiga.csv', 'ficheiro', 'h', 'i1', 1, '1.2.0', 'concluida', 1, 1, 0, 0)")
        ligacao.execute("INSERT INTO encomendas_historico (importacao_id, linha, numero, chave, cliente, destino, estado, "
                        "estado_original, estado_reconhecido, tem_erro, erros, avisos) VALUES (1, 2, 'A1', 'a1', "
                        "'Cliente', 'Porto', 'Pendente', 'Pendente', 1, 0, '', '')")


def test_migracao_real_do_esquema_1_para_o_2(pasta_dados_temporaria, monkeypatch):
    caminho = P.caminho_base_dados()
    _base_no_esquema_1(caminho, monkeypatch)
    with P.ligar(caminho) as ligacao:
        assert P.ler_identificacao(ligacao)[1] == 1

    info = P.preparar_base_dados(caminho)
    assert (info.migrada_de, info.versao_esquema, info.integra) == (1, 2, True)
    with P.ligar(info.copia_antes_da_migracao, so_leitura=True) as ligacao:
        assert P.ler_identificacao(ligacao)[1] == 1 and P.verificar_integridade(ligacao) == "ok"
    imp = H.obter_importacao(caminho, 1)
    assert imp["nome_ficheiro"] == "antiga.csv" and imp["dados_eliminados_em"] is None
    assert len(H.carregar_fotografia(caminho, 1)) == 1
    assert guardar(caminho, DIA1, "nova.csv").importacao_anterior_id == 1
    assert R.eliminar_importacao(caminho, 1).linhas == 1  # as funções novas funcionam na base migrada


def test_base_no_esquema_2_sem_as_tabelas_novas_e_recusada(base_dados):
    with P.ligar(base_dados) as ligacao:
        ligacao.execute("DROP TABLE eliminacoes")
    with pytest.raises(P.BaseDadosIncompativel, match="incompleta"):
        P.preparar_base_dados(base_dados)


def test_registo_de_eliminacoes_com_motivo_invalido_e_ignorado(base_dados):
    R.caminho_registo(base_dados).write_text(json.dumps({
        "formato": 1, "prazo_meses": None,
        "eliminacoes": [{"impressao_digital": "x", "iniciada_em": "y", "momento": "z", "motivo": "outro"}]}),
        encoding="utf-8")
    registo, aviso = R.ler_registo(base_dados)
    assert registo is None and "não pôde ser lido" in aviso


def test_eliminacao_com_a_base_ocupada_nao_elimina_nada(base_dados, monkeypatch):
    guardar(base_dados, DIA1)
    monkeypatch.setattr(P, "TEMPO_ESPERA_S", 0.2)
    bloqueio = sqlite3.connect(base_dados, isolation_level=None)
    try:
        bloqueio.execute("BEGIN IMMEDIATE")
        with pytest.raises(sqlite3.OperationalError):
            R.eliminar_importacao(base_dados, 1)
    finally:
        bloqueio.execute("ROLLBACK")
        bloqueio.close()
    assert _estado(base_dados)[1][5] == 2 and not R.caminho_registo(base_dados).exists()
