# Histórico, base de dados e cópias de segurança

Funcionalidades novas **em validação para a versão 1.3.0** (o código já as tem; a versão mostrada
na aplicação continua a ser 1.2.0 até à verificação final no CI em Windows e Linux).

Este documento explica, para quem instala e para quem mantém o LogiFlow:

1. [Onde ficam os dados](#1-onde-ficam-os-dados)
2. [O que é guardado — e o que não é](#2-o-que-é-guardado--e-o-que-não-é)
3. [Quando é guardado e estados de uma importação](#3-quando-é-guardado-e-estados-de-uma-importação)
4. [Importações repetidas (deduplicação)](#4-importações-repetidas-deduplicação)
5. [Comparação entre importações](#5-comparação-entre-importações)
6. [Esquema da base de dados](#6-esquema-da-base-de-dados)
7. [Migrações de esquema](#7-migrações-de-esquema)
8. [Cópias de segurança](#8-cópias-de-segurança)
9. [Recuperar uma cópia na aplicação](#9-recuperar-uma-cópia-na-aplicação)
10. [Recuperação manual (sem a aplicação)](#10-recuperação-manual-sem-a-aplicação)
11. [Atualizar a partir da versão 1.2.0](#11-atualizar-a-partir-da-versão-120)
12. [Várias janelas abertas ao mesmo tempo](#12-várias-janelas-abertas-ao-mesmo-tempo)
13. [Limitações e riscos conhecidos](#13-limitações-e-riscos-conhecidos)

---

## 1. Onde ficam os dados

O histórico é um ficheiro **SQLite** (`logiflow.db`), guardado numa pasta de dados do utilizador,
**fora da pasta da aplicação**. Assim, substituir a pasta do LogiFlow numa atualização não apaga o
histórico, e a base de dados nunca vai parar ao Git.

| Sistema | Pasta de dados |
| --- | --- |
| Windows | `%LOCALAPPDATA%\LogiFlow` (por exemplo, `C:\Users\<utilizador>\AppData\Local\LogiFlow`) |
| macOS | `~/Library/Application Support/LogiFlow` |
| Linux | `$XDG_DATA_HOME/logiflow` ou, sem essa variável, `~/.local/share/logiflow` |

Dentro dessa pasta:

```
LogiFlow\
├── logiflow.db          ← o histórico
├── logiflow.db-wal      ← ficheiros temporários do SQLite (só com a aplicação aberta)
├── logiflow.db-shm
└── copias\              ← cópias automáticas e, por omissão, as cópias de segurança
```

- O caminho completo aparece no separador **«Histórico»** («Base de dados: …»).
- A pasta não depende da pasta onde a aplicação é iniciada: é sempre a mesma para o mesmo
  utilizador do Windows.
- **Permissões:** em Windows, a pasta fica no perfil do utilizador, que só ele (e os
  administradores) pode ler. Em Linux e macOS, a pasta é criada com permissões `700` (só o dono).
- **Outra pasta:** defina a variável de ambiente `LOGIFLOW_DADOS` com um caminho **absoluto**
  (por exemplo, `D:\Dados\LogiFlow`). Um caminho relativo é recusado com uma mensagem. Os testes
  automáticos usam esta variável para trabalhar sempre em pastas temporárias.
- O `.gitignore` do projeto exclui `*.db`, `*.db-wal`, `*.db-shm`, `*.sqlite` e `*.sqlite3`.

## 2. O que é guardado — e o que não é

| Guardado | Não guardado |
| --- | --- |
| Nome do ficheiro (**sem a pasta**: `C:\…\semana42.xlsx` fica `semana42.xlsx`) | O ficheiro original |
| Tamanho e «impressão digital» SHA-256 do conteúdo | As colunas extra do ficheiro (observações, telefones, moradas…) |
| Folha do Excel e correspondência de colunas usada | Caminhos de pastas do utilizador |
| Estado, momento de início e de conclusão, versão da aplicação | Credenciais ou dados de acesso |
| Data de referência e prazo padrão em vigor na importação | |
| Totais: linhas lidas, válidas, com erros, com avisos; entregues, pendentes, atrasadas; exceções por prioridade | |
| Por cada linha: os 7 campos do LogiFlow já validados (n.º, cliente, data, destino, estado, data prevista, data de entrega), o texto original das datas inválidas, o estado tal como estava escrito e os erros/avisos da validação | |
| Registo de operações (eventos), **sem dados das encomendas** | |

**Proteção de dados (RGPD).** O cliente e o destino podem ser dados pessoais (por exemplo, um
cliente particular). Quem usa o LogiFlow é responsável por definir por quanto tempo guarda o
histórico. Nesta versão não há apagamento nem prazo de conservação automáticos — ver
[Limitações](#13-limitações-e-riscos-conhecidos) e, para apagar tudo, a
[secção 10](#apagar-todo-o-histórico). Para não guardar nada, desligue «Guardar importações no
histórico» na barra lateral.

## 3. Quando é guardado e estados de uma importação

- **Ficheiros carregados:** com a opção **«Guardar importações no histórico»** ligada (barra
  lateral, ligada por omissão), cada ficheiro é gravado **uma vez por sessão**, logo que as
  colunas obrigatórias estejam identificadas. Mexer em filtros ou separadores não volta a gravar.
- **Ficheiro de exemplo:** nunca é gravado sozinho; há um botão «Guardar o exemplo no histórico»
  no separador «Histórico».
- **Ficheiro ilegível** (vazio, CSV mal formado, Excel danificado…): fica registada uma importação
  **falhada**, só com os metadados e a mensagem de erro.
- Os totais são calculados com as **mesmas regras** dos cartões do topo e do painel de exceções,
  sobre o ficheiro inteiro (sem filtros), e ficam **congelados**: nunca são recalculados.

| Estado | Significado |
| --- | --- |
| **Em processamento** | Transitório: a importação foi registada e as linhas estão a ser gravadas. |
| **Concluída** | Gravada; nenhuma linha com erros ou avisos de validação. |
| **Concluída com avisos** | Gravada; há linhas com erros ou avisos (inclui o caso de **zero encomendas válidas**). Problemas de qualidade dos dados não são falhas. |
| **Falhada** | O ficheiro não pôde ser lido, ou a gravação falhou e foi desfeita. Nenhuma linha fica gravada. |

**Gravação transacional, em duas fases:**

1. Numa transação curta: verifica se o mesmo conteúdo já existe (secção 4) e cria o registo
   «em processamento».
2. Numa segunda transação: grava todas as linhas, **confirma que o número de linhas e de linhas
   com erros gravadas coincide** com o ficheiro e só então marca a importação como concluída.
   Se algo falhar (disco cheio, base ocupada, erro inesperado), tudo o que foi gravado nesta
   fase é desfeito e a importação fica «falhada», com uma mensagem que não contém dados das
   encomendas.

Nenhuma importação anterior é alterada ou apagada, em caso algum — também quando o ficheiro novo
tem zero linhas válidas. Se a aplicação for fechada a meio de uma gravação, a importação fica
«em processamento»; no arranque seguinte, as que estejam nesse estado há mais de 10 minutos
passam a «falhada» (os seus dados nunca chegaram a ser confirmados).

## 4. Importações repetidas (deduplicação)

A **impressão digital** de uma importação é o SHA-256 de: conteúdo do ficheiro + folha do Excel +
correspondência de colunas + versão do formato da fotografia.

| Situação | Resultado |
| --- | --- |
| O mesmo ficheiro outra vez (mesmo com outro nome) | **Não é gravado.** Mensagem: «Este conteúdo já tinha sido importado em … (importação n.º X). Não foi criado nenhum registo duplicado.» |
| O mesmo conteúdo a ser gravado noutra janela nesse momento | Não é gravado; a mensagem diz que está a ser gravado noutra janela. |
| Um ficheiro **diferente** com os mesmos n.ºs de encomenda (por exemplo, a exportação do dia seguinte) | **Importação nova.** É isto que permite comparar. |
| O mesmo ficheiro lido de outra forma (outra folha, outra correspondência de colunas) | Importação nova: os dados resultantes são outros. |
| O mesmo ficheiro depois de uma tentativa **falhada** | Pode ser gravado (a falhada não conta). |
| O mesmo conteúdo guardado noutra codificação (UTF-8 / Windows-1252) | Importação nova (o conteúdo, em bytes, é diferente). |

As linhas de cada importação ficam sempre separadas: o n.º de encomenda nunca é uma chave global.

## 5. Comparação entre importações

No separador «Histórico», em «Comparar duas importações» (ou no botão «Comparar com a importação
anterior» dos detalhes). A importação de n.º mais baixo é sempre a «anterior».

| Categoria | Regra |
| --- | --- |
| **Nova** | O n.º existe na importação atual e não existia na anterior. |
| **Alterada** | Existe nas duas e pelo menos um campo comparado mudou (a coluna «Alterações» diz qual: «Estado: Pendente → Entregue»). |
| **Sem alterações** | Existe nas duas e nenhum campo comparado mudou. |
| **Não encontrada na importação atual** | Existia na anterior e não aparece na atual. **Não** quer dizer entregue, cancelada nem apagada: o ficheiro mais recente pode simplesmente não a incluir. A aplicação nunca infere estados. |

**Chave das encomendas.** O n.º de encomenda, com a mesma regra da deteção de duplicados:
espaços nas pontas e maiúsculas/minúsculas não contam (`ENC-1` = ` enc-1 `). Zeros à esquerda
contam (`0007` ≠ `7`): são valores diferentes e não se juntam sem uma regra explícita.

**Chaves insuficientes.** Linhas sem n.º, ou com um n.º **repetido em qualquer das duas
importações**, não podem ser emparelhadas com segurança: ficam fora da comparação (dos dois lados)
e são listadas em «Linhas fora da comparação», com o motivo. Se num dos lados nenhuma linha
puder ser emparelhada, a comparação não é feita. Se ficarem de fora mais de 20 % das linhas de
um dos lados, o resultado é marcado como **comparação parcial**.

**Campos comparados e normalização** (aplicada da mesma forma aos dois lados):

| Campo | Regra |
| --- | --- |
| Cliente, Destino | Espaços repetidos e nas pontas não contam. Maiúsculas contam (`TRÊS` → `Três` é uma alteração). |
| Estado | Sinónimos reconhecidos contam como o mesmo estado (`entregue` = `Entregue`). Um estado não reconhecido é comparado pelo texto. |
| Data, Data Prevista, Data de Entrega | Conta a data, não a forma como estava escrita (`01/10/2026` = `2026-10-01` = célula de data do Excel). Uma data inválida é comparada pelo texto original. Vazio ≠ data. |
| Números do Excel | O `1001` de uma célula numérica é lido como `1001` (regra já existente da importação). |

Só se comparam os campos que existiam **nas duas** importações; um campo que só existe numa delas
não é comparado e há um aviso. A comparação usa os dados guardados e não recalcula indicadores
nem exceções antigas.

## 6. Esquema da base de dados

Esquema 1 (`PRAGMA user_version = 1`; `PRAGMA application_id = 0x4C474657`, «LGFW», que identifica
o ficheiro como base de dados do LogiFlow). Modo de diário WAL; integridade referencial ligada em
cada ligação (`PRAGMA foreign_keys = ON`); espera até 5 segundos por uma base ocupada.

**`importacoes`** — uma linha por importação.

| Coluna | Conteúdo |
| --- | --- |
| `id` | Identificador único (nunca reutilizado). |
| `iniciada_em`, `concluida_em` | Momentos em UTC (ISO 8601); mostrados na hora local. |
| `nome_ficheiro`, `origem` | Nome sem pasta; `ficheiro` ou `exemplo`. |
| `tamanho_bytes`, `hash_conteudo` | Tamanho e SHA-256 do ficheiro. |
| `folha`, `mapeamento` | Folha do Excel e correspondência campo → coluna (JSON). |
| `impressao_digital` | Usada na deduplicação (secção 4). |
| `versao_formato`, `versao_aplicacao` | Versão do formato da fotografia e da aplicação que gravou. |
| `estado` | `em_processamento`, `concluida`, `concluida_com_avisos` ou `falhada`. |
| `linhas_lidas`, `encomendas_validas`, `linhas_com_erros`, `linhas_com_avisos` | Totais da validação. |
| `data_referencia`, `prazo_padrao_dias` | Regras de prazo em vigor. |
| `ind_entregues`, `ind_pendentes`, `ind_atrasadas` | Indicadores do topo no momento (atrasadas vazio = não calculável). |
| `exc_alta`, `exc_media`, `exc_baixa` | Encomendas com exceções por prioridade. |
| `mensagem_erro` | Mensagem segura (sem dados das encomendas), só nas falhadas. |
| `importacao_anterior_id` | A última importação concluída antes desta (referência para comparar). |

**`encomendas_historico`** — a «fotografia» de cada linha, ligada à sua importação
(`importacao_id`, com `ON DELETE CASCADE`; única por `importacao_id` + `linha`): `linha`,
`numero`, `chave` (n.º normalizado), `cliente`, `destino`, `estado`, `estado_original`,
`estado_reconhecido`, `data`/`data_original`, `data_prevista`/`data_prevista_original`,
`data_entrega`/`data_entrega_original` (data em `AAAA-MM-DD`; o texto original só quando a data
era inválida), `tem_erro`, `erros`, `avisos`.

**`eventos`** — registo mínimo de operações: `momento`, `tipo` (`base_dados_criada`, `migracao`,
`importacao_concluida`, `importacao_repetida`, `importacao_falhada`, `copia_criada`,
`recuperacao_concluida`), `importacao_id` e um `detalhe` curto, **sem dados das encomendas**.

Índices: `importacoes (impressao_digital, estado)`, `importacoes (iniciada_em)`,
`encomendas_historico (importacao_id, chave)`, `eventos (momento)`.

## 7. Migrações de esquema

- Cada versão do esquema tem uma migração numerada em `logiflow/persistencia.py` (`MIGRACOES`).
  As migrações **só acrescentam** tabelas, colunas e índices: nenhuma apaga ou reescreve dados.
- No arranque, a aplicação lê `user_version` e aplica as migrações em falta, **cada uma numa
  transação** (se falhar, é desfeita e a base fica como estava).
- **Antes de migrar** uma base com dados, é feita automaticamente uma cópia:
  `copias\logiflow-antes-migracao-vX-para-vY-AAAAMMDD-HHMMSS.db`.
- Uma base **mais recente** do que a aplicação (por exemplo, depois de voltar a uma versão
  antiga), de **outra aplicação** ou **incompleta** é recusada sem ser alterada.
- Uma base **danificada** nunca é substituída nem apagada: a aplicação continua a funcionar sem
  histórico e indica como recuperar uma cópia.
- Duas janelas a arrancar ao mesmo tempo não aplicam a mesma migração duas vezes (a versão é
  verificada de novo dentro da transação).

## 8. Cópias de segurança

No separador «Histórico» → «Cópias de segurança»:

- **Pasta de destino** configurável: por omissão, `copias` dentro da pasta de dados. Tem de ser
  um caminho completo de uma pasta **que já exista** e onde se possa escrever; caso contrário,
  a aplicação explica porquê. **Recomendação:** guarde cópias também noutro disco ou numa pen USB
  — uma cópia no mesmo disco não protege contra avarias do disco.
- **Como é feita:** com a API de cópia do próprio SQLite (consistente mesmo com a aplicação aberta
  e com outra janela a gravar), num ficheiro **único e autónomo** (sem `-wal`).
- **Nome inequívoco:** `logiflow-copia-AAAAMMDD-HHMMSS.db`; se já existir, `…-2.db`, `…-3.db`.
  **Nunca se sobrescreve** um ficheiro existente (criação exclusiva).
- **Validação** logo depois de criada: cabeçalho SQLite, identificação do LogiFlow, esquema
  conhecido, tabelas obrigatórias e `PRAGMA integrity_check`. Uma cópia que falhe é descartada e
  a mensagem diz porquê. «Verificar a cópia escolhida» repete a validação, **sem alterar** a cópia
  (é aberta só para leitura).

## 9. Recuperar uma cópia na aplicação

1. Escolha a cópia, marque «Confirmo que quero substituir o histórico atual por esta cópia» e
   carregue em «Recuperar a cópia escolhida».
2. A cópia é validada. Se for inválida, danificada, de outra aplicação ou de uma versão mais
   recente, **nada é alterado** e a mensagem diz porquê.
3. A cópia é recuperada primeiro para um **ficheiro temporário** na pasta de dados, atualizada
   para o esquema atual (se for de uma versão anterior) e validada outra vez (integridade, esquema
   e número de importações).
4. Só então a base em uso é **preservada**: copiada para
   `copias\logiflow-antes-da-recuperacao-AAAAMMDD-HHMMSS.db`, ou, se estiver danificada,
   **movida** (não apagada) para `copias\logiflow-danificada-AAAAMMDD-HHMMSS.db`.
5. O conteúdo é substituído (API de cópia do SQLite) e validado uma última vez. Se essa validação
   falhar, a base anterior é reposta automaticamente.
6. A cópia usada nunca é alterada. O ficheiro aberto na aplicação não é gravado outra vez
   automaticamente; há um botão para o gravar, se quiser.

Testado com falhas reais (testes automáticos em `tests/test_copias.py` e
`tests/test_historico_app.py`): cópias vazias, de texto, com páginas danificadas, de outra
aplicação e de esquema mais recente; base atual danificada; falha na verificação final. Isto não
é uma garantia contra todas as avarias possíveis (por exemplo, um disco que falha durante a
cópia) — por isso a recomendação de guardar cópias noutro disco.

## 10. Recuperação manual (sem a aplicação)

Use este procedimento se a aplicação não abrir ou não conseguir recuperar uma cópia.

1. **Feche o LogiFlow** (feche a janela preta do `iniciar.bat`).
2. Abra a pasta de dados: no Windows, tecla Windows + R, escreva `%LOCALAPPDATA%\LogiFlow` e
   carregue em Enter.
3. **Não apague nada.** Crie uma pasta, por exemplo `guardado-AAAAMMDD`, e **mova** para lá
   `logiflow.db` e, se existirem, `logiflow.db-wal` e `logiflow.db-shm` (os três juntos).
4. Copie a cópia de segurança que quer usar (por exemplo, `copias\logiflow-copia-….db`) para a
   pasta de dados e mude-lhe o nome para `logiflow.db`.
5. Abra o LogiFlow. No separador «Histórico», confirme as importações. Se a cópia for de uma
   versão anterior do esquema, é atualizada no arranque (com cópia automática antes).
6. Guarde a pasta `guardado-AAAAMMDD` até ter a certeza de que não precisa dela.

Para verificar um ficheiro sem o LogiFlow, pode usar uma ferramenta gratuita como o *DB Browser
for SQLite* (abrir **só para leitura**) ou, numa linha de comandos com Python:

```powershell
.venv\Scripts\python.exe -c "import sqlite3,sys,pathlib; c=sqlite3.connect(pathlib.Path(sys.argv[1]).resolve().as_uri()+'?mode=ro',uri=True); print(c.execute('PRAGMA integrity_check').fetchone()[0], c.execute('SELECT COUNT(*) FROM importacoes').fetchone()[0])" "C:\caminho\da\copia.db"
```

(Deve mostrar `ok` e o número de importações.)

### Apagar todo o histórico

Feche o LogiFlow e apague a pasta de dados (`%LOCALAPPDATA%\LogiFlow`), **incluindo a pasta
`copias`**, se também quiser apagar as cópias. Cópias guardadas noutras pastas ou discos têm de
ser apagadas à mão. No arranque seguinte é criada uma base de dados vazia.

## 11. Atualizar a partir da versão 1.2.0

A versão 1.2.0 não guardava nada, por isso **não há dados a migrar**.

1. Feche o LogiFlow.
2. Substitua a pasta da aplicação pela nova (ou extraia o ZIP novo por cima). A pasta `.venv`
   pode ficar; se a apagar, volte a correr `instalar.bat`.
3. Corra `instalar.bat` (as dependências são as mesmas — o SQLite faz parte do Python — mas
   correr de novo não faz mal).
4. Abra com `iniciar.bat`. No primeiro arranque é criada a base de dados em
   `%LOCALAPPDATA%\LogiFlow` (aparece no separador «Histórico»).

Nas atualizações seguintes, a base de dados **fica fora da pasta substituída** e não é tocada
pelo `instalar.bat` nem pelo `iniciar.bat` (o CI no Windows verifica-o: grava uma importação, corre
o `instalar.bat` outra vez e o `iniciar.bat`, e confirma que continua lá); se o esquema mudar, a migração é automática, com
cópia prévia (secção 7). Para voltar à 1.2.0, basta usar a pasta antiga: a 1.2.0 ignora a base de
dados (que continua lá para quando voltar à versão nova).

## 12. Várias janelas abertas ao mesmo tempo

O SQLite em modo WAL permite ler enquanto outra janela grava. Cada operação abre e fecha a sua
própria ligação; as gravações usam transações curtas e esperam até 5 segundos se a base estiver
ocupada. Se ainda assim estiver ocupada, a mensagem é «A base de dados estava ocupada por outra
janela do LogiFlow», nada fica a meio e o botão «Tentar guardar de novo» permite repetir. Duas
janelas a gravar o mesmo ficheiro ao mesmo tempo dão uma importação (a outra é indicada como
repetida). Isto é para várias janelas **no mesmo computador**: o LogiFlow continua a não ser uma
aplicação multiutilizador em rede.

## 13. Limitações e riscos conhecidos

- **Sem apagamento seletivo nem prazo de conservação** na aplicação (só apagar tudo, à mão).
  Necessário antes de uso com dados pessoais em larga escala.
- **Sem cópias automáticas periódicas:** só a cópia automática antes de uma migração. As cópias de
  segurança são feitas a pedido.
- **O histórico é deste computador:** não é partilhado entre computadores nem utilizadores; não há
  autenticação nem permissões dentro da aplicação.
- **Encriptação:** a base de dados não é encriptada; depende da proteção da conta do Windows (e,
  idealmente, do BitLocker).
- **Ecrã:** as listas de encomendas guardadas e as comparações mostram no máximo 5 000 linhas de
  cada vez (filtrar por situação para ver as restantes).
- **Espaço em disco:** cerca de 15 MB por cada 100 000 encomendas guardadas. Sem prazo de
  conservação, a base de dados cresce sempre (por exemplo, 100 000 encomendas por dia são cerca de
  5 GB por ano).
- **Tempos** (100 000 encomendas, medidos em Linux no ambiente de desenvolvimento): gravar ≈ 1,5 s
  uma vez por ficheiro; consultas da lista ≈ 2 ms por interação; comparar ≈ 3 s, a pedido.
- **Escolha das importações a comparar:** as listas mostram as 500 importações concluídas mais
  recentes.
- **Comparação pelo n.º de encomenda:** se o sistema de origem reutilizar números ou mudar o
  formato (`0007` → `7`), as encomendas não são emparelhadas.
- Uma base de dados num disco de rede ou numa pasta sincronizada (OneDrive, Dropbox) não é
  recomendada: o SQLite pode ficar bloqueado ou danificado por sincronizações a meio.
