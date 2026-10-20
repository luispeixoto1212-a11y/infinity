# Histórico, base de dados, conservação e cópias de segurança

Funcionalidades novas **em validação para a versão 1.3.0** (o código já as tem; a versão mostrada
na aplicação continua a ser 1.2.0 até à verificação final).

Este documento explica, para quem instala e para quem mantém o LogiFlow:

1. [Onde ficam os dados](#1-onde-ficam-os-dados)
2. [O que é guardado — e o que não é](#2-o-que-é-guardado--e-o-que-não-é)
3. [Quando é guardado e estados de uma importação](#3-quando-é-guardado-e-estados-de-uma-importação)
4. [Importações repetidas (deduplicação)](#4-importações-repetidas-deduplicação)
5. [Comparação entre importações](#5-comparação-entre-importações)
6. [Conservação dos dados: prazo e eliminação](#6-conservação-dos-dados-prazo-e-eliminação)
7. [Esquema da base de dados](#7-esquema-da-base-de-dados)
8. [Migrações de esquema](#8-migrações-de-esquema)
9. [Cópias de segurança](#9-cópias-de-segurança)
10. [Recuperar uma cópia na aplicação](#10-recuperar-uma-cópia-na-aplicação)
11. [Verificação no arranque e modo só de leitura](#11-verificação-no-arranque-e-modo-só-de-leitura)
12. [Recuperação manual (sem a aplicação)](#12-recuperação-manual-sem-a-aplicação)
13. [Atualizar a partir da versão 1.2.0](#13-atualizar-a-partir-da-versão-120)
14. [Várias janelas abertas ao mesmo tempo](#14-várias-janelas-abertas-ao-mesmo-tempo)
15. [Falhas testadas](#15-falhas-testadas)
16. [Limitações e riscos conhecidos](#16-limitações-e-riscos-conhecidos)

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
├── logiflow.db                 ← o histórico
├── logiflow.db-wal / -shm      ← ficheiros do SQLite (com a aplicação aberta)
├── registo-eliminacoes.json    ← o que foi eliminado e o prazo em vigor (sem dados pessoais; ver secção 6)
├── logiflow.db.manutencao      ← só durante uma recuperação de cópia (ver secção 14)
├── .recuperacao-….db           ← só durante uma recuperação (temporário)
└── copias\                     ← cópias automáticas e, por omissão, as cópias de segurança
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

**Proteção de dados.** O cliente e o destino podem ser dados pessoais (por exemplo, um cliente
particular). A aplicação permite definir um **prazo de conservação** e **eliminar os dados de uma
importação** (secção 6). Isto ajuda a aplicar uma política de conservação, mas **não garante, por
si só, o cumprimento do RGPD**: o prazo, o procedimento para as cópias e a informação aos titulares
devem ser definidos por quem é responsável pelos dados na empresa. Para não guardar nada, desligue
«Guardar importações no histórico» na barra lateral.

## 3. Quando é guardado e estados de uma importação

- **Ficheiros carregados:** com a opção **«Guardar importações no histórico»** ligada (barra
  lateral, ligada por omissão), cada ficheiro carregado é gravado **uma vez**, logo que as
  colunas obrigatórias estejam identificadas. Mexer em filtros ou separadores não volta a gravar.
- **Ficheiro de exemplo:** nunca é gravado sozinho; há um botão «Guardar o exemplo no histórico»
  no separador «Histórico».
- **Ficheiro ilegível** (vazio, CSV mal formado, Excel danificado…): fica registada uma importação
  **falhada**, só com os metadados e a mensagem de erro.
- **Base de dados com erros:** nada é gravado (modo só de leitura, secção 11).
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

Nenhuma importação anterior é alterada ou apagada por uma importação nova — também quando o
ficheiro novo tem zero linhas válidas. Se a aplicação for fechada a meio de uma gravação, nada fica
a meio (a transação não é confirmada) e a importação fica «em processamento»; no arranque
seguinte, as que estejam nesse estado há mais de **2 minutos** passam a «falhada» e o mesmo
ficheiro pode voltar a ser gravado. (Gravar 100 000 encomendas demora cerca de 1,5 s.)

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
| O mesmo ficheiro depois de os seus dados terem sido **eliminados** | Pode ser gravado de novo (a eliminada não conta). |
| O mesmo conteúdo guardado noutra codificação (UTF-8 / Windows-1252) | Importação nova (o conteúdo, em bytes, é diferente). |

As linhas de cada importação ficam sempre separadas: o n.º de encomenda nunca é uma chave global.

## 5. Comparação entre importações

No separador «Histórico», em «Comparar duas importações» (ou no botão «Comparar com a importação
anterior» dos detalhes). A importação de n.º mais baixo é sempre a «anterior». Importações
falhadas ou com os dados eliminados não podem ser comparadas.

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

## 6. Conservação dos dados: prazo e eliminação

> Ajuda a aplicar uma política de conservação; **não é, por si só, garantia de cumprimento do
> RGPD**. O prazo e o tratamento das cópias devem ser decididos por quem é responsável pelos dados.

**Prazo de conservação** (separador «Histórico» → «Conservação dos dados»): sem limite (por
omissão), 3, 6, 12, 24 ou 36 meses, contados em meses de calendário a partir da data da importação.

- Ao escolher um prazo que já apanha importações, a aplicação diz quantas e de antes de que data,
  e **pede confirmação**; os dados são eliminados ao guardar.
- O prazo é aplicado de novo **sempre que a aplicação é aberta**; o separador «Histórico» diz
  quantas importações foram eliminadas nessa altura. Importações «em processamento» nunca são
  eliminadas pelo prazo.

**Eliminar os dados de uma importação** (detalhes da importação → «Eliminar os dados desta
importação», com confirmação).

**O que acontece numa eliminação** (por prazo ou a pedido):

- as encomendas guardadas dessa importação são apagadas;
- o nome do ficheiro passa a «(eliminado)»; a folha, a correspondência de colunas e a mensagem de
  erro deixam de existir (podem conter nomes);
- ficam o n.º, as datas, o estado e os **totais** (sem dados pessoais) e a indicação de quando e
  porquê foi eliminada;
- o conteúdo apagado é **sobrescrito no ficheiro** (`PRAGMA secure_delete`) e o diário WAL é
  esvaziado — se nenhuma outra janela o estiver a ler; caso contrário, isso acontece no próximo
  ponto de controlo do SQLite. (Algumas versões do SQLite já sobrescrevem por omissão — é o caso da
  usada no Linux de desenvolvimento — e outras não; por isso a aplicação pede-o sempre, e um teste
  verifica-o simulando um SQLite que não o faz.)
- a eliminação fica **registada** na base de dados e no ficheiro `registo-eliminacoes.json`, na
  pasta de dados. O registo identifica cada importação pelo **conteúdo e momento da importação**
  (nunca só pelo n.º, que pode repetir-se depois de recuperar uma cópia) e não tem dados pessoais.

**Ordem segura.** O registo à parte é escrito **antes** de a eliminação ser confirmada na base de
dados. Se a aplicação for fechada a meio, a eliminação é concluída no arranque seguinte (testado
com um processo terminado a meio). Um registo à parte ilegível nunca é apagado: é guardado como
`registo-eliminacoes.ilegivel-….json`, a aplicação avisa e escreve um novo a partir da base.

**Cópias de segurança e eliminações — comportamento definido:**

| Situação | O que acontece |
| --- | --- |
| Eliminar dados na base | **As cópias de segurança já feitas não mudam** (são fotografias do passado). |
| Recuperar uma cópia na aplicação | Antes de a cópia ser posta em uso, são-lhe aplicadas **todas as eliminações registadas e o prazo em vigor** (o atual, não o da cópia). Os dados eliminados **não voltam**; a mensagem diz quantas importações foram eliminadas de novo. |
| Recuperação manual (copiar uma cópia por cima da base) | No arranque seguinte, a aplicação lê `registo-eliminacoes.json` e volta a eliminar. Por isso, **não apague esse ficheiro** ao recuperar à mão. |
| Base em uso danificada, ao recuperar | Usa-se o `registo-eliminacoes.json` (a base danificada não é lida). |
| Lista de cópias de uma pasta | Cada cópia é aberta **só para leitura** e assinalada se **contiver** dados de importações eliminadas ou anteriores ao prazo (verificação pelo conteúdo, não pela data do ficheiro). |
| Apagar cópias | Só a pedido, com confirmação: «Apagar as cópias assinaladas» apaga apenas ficheiros `logiflow-*.db` dessa pasta. Nunca automaticamente. |
| Cópias noutras pastas, discos, pens ou computadores | A aplicação não as vê: a rotação e destruição dessas cópias é responsabilidade de quem as guarda. Se uma delas for recuperada **noutro computador** (sem o `registo-eliminacoes.json` deste), os dados eliminados reaparecem lá. |

## 7. Esquema da base de dados

Esquema 2 (`PRAGMA user_version = 2`; `PRAGMA application_id = 0x4C474657`, «LGFW», que identifica
o ficheiro como base de dados do LogiFlow). Modo de diário WAL; integridade referencial ligada em
cada ligação (`PRAGMA foreign_keys = ON`); espera até 5 segundos por uma base ocupada.

**`importacoes`** — uma linha por importação.

| Coluna | Conteúdo |
| --- | --- |
| `id` | Identificador único (nunca reutilizado na mesma base). |
| `iniciada_em`, `concluida_em` | Momentos em UTC (ISO 8601); mostrados na hora local. |
| `nome_ficheiro`, `origem` | Nome sem pasta (ou «(eliminado)»); `ficheiro` ou `exemplo`. |
| `tamanho_bytes`, `hash_conteudo` | Tamanho e SHA-256 do ficheiro. |
| `folha`, `mapeamento` | Folha do Excel e correspondência campo → coluna (JSON). |
| `impressao_digital` | Usada na deduplicação (secção 4) e, com `iniciada_em`, no registo de eliminações. |
| `versao_formato`, `versao_aplicacao` | Versão do formato da fotografia e da aplicação que gravou. |
| `estado` | `em_processamento`, `concluida`, `concluida_com_avisos` ou `falhada`. |
| `linhas_lidas`, `encomendas_validas`, `linhas_com_erros`, `linhas_com_avisos` | Totais da validação. |
| `data_referencia`, `prazo_padrao_dias` | Regras de prazo em vigor. |
| `ind_entregues`, `ind_pendentes`, `ind_atrasadas` | Indicadores do topo no momento (atrasadas vazio = não calculável). |
| `exc_alta`, `exc_media`, `exc_baixa` | Encomendas com exceções por prioridade. |
| `mensagem_erro` | Mensagem segura (sem dados das encomendas), só nas falhadas. |
| `importacao_anterior_id` | A última importação concluída (e com dados) antes desta. |
| `dados_eliminados_em`, `motivo_eliminacao` | Esquema 2: quando e porquê (`manual` ou `prazo`) os dados foram eliminados. |

**`encomendas_historico`** — a «fotografia» de cada linha, ligada à sua importação
(`importacao_id`, com `ON DELETE CASCADE`; única por `importacao_id` + `linha`): `linha`,
`numero`, `chave` (n.º normalizado), `cliente`, `destino`, `estado`, `estado_original`,
`estado_reconhecido`, `data`/`data_original`, `data_prevista`/`data_prevista_original`,
`data_entrega`/`data_entrega_original` (data em `AAAA-MM-DD`; o texto original só quando a data
era inválida), `tem_erro`, `erros`, `avisos`.

**`eventos`** — registo mínimo de operações: `momento`, `tipo` (`base_dados_criada`, `migracao`,
`importacao_concluida`, `importacao_repetida`, `importacao_falhada`, `copia_criada`,
`recuperacao_concluida`, `dados_eliminados`, `prazo_conservacao`), `importacao_id` e um `detalhe`
curto, **sem dados das encomendas**.

**`preferencias`** (esquema 2) — `chave`, `valor`, `alterada_em` (por exemplo, o prazo de
conservação). **`eliminacoes`** (esquema 2) — `momento`, `impressao_digital`, `iniciada_em`,
`motivo`; única por (`impressao_digital`, `iniciada_em`).

Índices: `importacoes (impressao_digital, estado)`, `importacoes (iniciada_em)`,
`encomendas_historico (importacao_id, chave)`, `eventos (momento)`.

## 8. Migrações de esquema

- Cada versão do esquema tem uma migração numerada em `logiflow/persistencia.py` (`MIGRACOES`).
  As migrações **só acrescentam** tabelas, colunas e índices: nenhuma apaga ou reescreve dados.
  A migração 2 acrescenta as duas colunas e as duas tabelas da conservação de dados.
- No arranque, a aplicação lê `user_version` e aplica as migrações em falta, **cada uma numa
  transação** (se falhar ou se a aplicação for fechada a meio, é desfeita e a base fica como
  estava; testado com um processo terminado a meio).
- **Antes de migrar** uma base com dados, é feita uma cópia, **validada antes de ser publicada**:
  `copias\logiflow-antes-migracao-vX-para-vY-AAAAMMDD-HHMMSS.db`. Se a base tiver erros e a cópia
  não passar a validação, a migração **não é feita** e a base não é alterada.
- Uma base **mais recente** do que a aplicação (por exemplo, depois de voltar a uma versão
  antiga), de **outra aplicação** ou **incompleta** é recusada sem ser alterada.
- Uma base **danificada** nunca é substituída nem apagada: a aplicação continua a funcionar sem
  histórico e indica como recuperar uma cópia.
- Duas janelas a arrancar ao mesmo tempo não aplicam a mesma migração duas vezes (a versão é
  verificada de novo dentro da transação).

## 9. Cópias de segurança

No separador «Histórico» → «Cópias de segurança»:

- **Pasta de destino** configurável: por omissão, `copias` dentro da pasta de dados. Tem de ser
  um caminho completo de uma pasta **que já exista** e onde se possa escrever; caso contrário,
  a aplicação explica porquê. **Recomendação:** guarde cópias também noutro disco ou numa pen USB
  — uma cópia no mesmo disco não protege contra avarias do disco.
- **Como é feita:** com a API de cópia do próprio SQLite (consistente mesmo com a aplicação aberta
  e com outra janela a gravar), num ficheiro **único e autónomo** (sem `-wal`). Se a base estiver
  ocupada por outra janela durante mais de 30 segundos, desiste com uma mensagem clara.
- **Publicada só depois de validada:** a cópia é escrita como `….db.parcial`, validada (cabeçalho
  SQLite, identificação do LogiFlow, esquema conhecido, tabelas, `PRAGMA integrity_check`) e só
  então recebe o nome final. Uma cópia interrompida (pen retirada, aplicação fechada) **nunca
  aparece como cópia**; os `.parcial` com mais de uma hora são apagados na cópia seguinte para a
  mesma pasta (e no arranque, na pasta de dados).
- **Nome inequívoco:** `logiflow-copia-AAAAMMDD-HHMMSS.db`; se já existir, `…-2.db`, `…-3.db`.
  **Nunca se sobrescreve** um ficheiro existente.
- **Base em uso com erros:** a cópia não é descartada; fica como `logiflow-copia-com-erros-….db`
  (pode servir para tentar salvar dados) e a mensagem diz que **não serve para recuperar**.
- «Verificar a cópia escolhida» repete a validação **sem alterar** a cópia (aberta só para leitura).

## 10. Recuperar uma cópia na aplicação

Escolha a cópia, marque «Confirmo que quero substituir o histórico atual por esta cópia» e carregue
em «Recuperar a cópia escolhida». Por esta ordem — **a base em uso só é tocada no passo 6**:

1. A cópia é validada (só leitura). Se for inválida, danificada, de outra aplicação ou de uma
   versão mais recente, **nada é alterado** e a mensagem diz porquê.
2. Um **bloqueio de manutenção** impede as outras janelas de gravar; a recuperação **espera pelas
   gravações que já tinham começado**, para ficarem na cópia de segurança da base em uso.
3. A base em uso é examinada **só para leitura** (sem tocar no seu `-wal`).
4. A cópia é recuperada para um **ficheiro temporário**, atualizada para o esquema atual (se for de
   uma versão anterior), sujeita às **eliminações registadas e ao prazo em vigor** (secção 6) e
   validada de novo (integridade, esquema e número de importações).
5. A base em uso é **preservada** na pasta `copias`:
   - íntegra: com a API de cópia (`logiflow-antes-da-recuperacao-….db`, validada);
   - danificada: **copiada byte a byte, com o `-wal` e o `-shm`, sem nunca ser aberta pelo
     SQLite** (`logiflow-danificada-….db`), e comparada com o original;
   - incompatível: copiada byte a byte (`logiflow-antes-da-recuperacao-….db`).
6. Substituição: base íntegra — com a API de cópia (as outras janelas veem o antes ou o depois);
   base danificada, incompatível ou inexistente — com uma **troca de ficheiro atómica**: em nenhum
   momento a pasta fica sem base de dados.
7. Verificação final; se falhar, a base anterior é **reposta automaticamente**. Se nem isso for
   possível, a mensagem indica o nome da cópia intacta para a recuperação manual.

A cópia usada nunca é alterada. O ficheiro aberto na aplicação não é gravado outra vez
automaticamente; há um botão para o gravar, se quiser. Uma recuperação interrompida (aplicação
fechada) deixa sempre uma base válida — a de antes ou a recuperada — e nunca uma base vazia; o
bloqueio de manutenção deixa de contar ao fim de 1 minuto sem sinal de vida e os temporários com
mais de uma hora são apagados no arranque.

## 11. Verificação no arranque e modo só de leitura

Ao abrir a aplicação, a base de dados é verificada (`PRAGMA quick_check`: cerca de 0,05 s em 30 MB).
Se a estrutura estiver legível mas houver **erros nos dados**:

- o histórico fica **só de leitura** nessa sessão: nada é gravado nem eliminado (gravar numa base
  danificada pode piorar o estado);
- o resto da aplicação (importar, validar, exportar) funciona normalmente;
- o separador «Histórico» explica o problema e permite **recuperar uma cópia**; uma cópia feita
  nesse estado fica «com erros» (secção 9).

O mesmo acontece se for detetado um erro de base danificada durante a sessão. Se a base nem
puder ser aberta, o histórico fica indisponível (sem modo só de leitura) e a recuperação de cópias
continua acessível.

## 12. Recuperação manual (sem a aplicação)

Use este procedimento se a aplicação não abrir ou não conseguir recuperar uma cópia.

1. **Feche o LogiFlow** (feche a janela preta do `iniciar.bat`).
2. Abra a pasta de dados: no Windows, tecla Windows + R, escreva `%LOCALAPPDATA%\LogiFlow` e
   carregue em Enter.
3. **Não apague nada.** Crie uma pasta, por exemplo `guardado-AAAAMMDD`, e **mova** para lá
   `logiflow.db` e, se existirem, `logiflow.db-wal` e `logiflow.db-shm` (os três juntos).
   **Deixe ficar** `registo-eliminacoes.json`: é ele que impede que dados eliminados voltem.
4. Copie a cópia de segurança que quer usar (por exemplo, `copias\logiflow-copia-….db`) para a
   pasta de dados e mude-lhe o nome para `logiflow.db`.
5. Abra o LogiFlow. Se a cópia for de uma versão anterior do esquema, é atualizada no arranque
   (com cópia automática antes); as eliminações registadas e o prazo são aplicados de novo, e o
   separador «Histórico» diz quantas importações foram eliminadas. Confirme as importações.
6. Guarde a pasta `guardado-AAAAMMDD` até ter a certeza de que não precisa dela.

Para verificar um ficheiro sem o LogiFlow, pode usar uma ferramenta gratuita como o *DB Browser
for SQLite* (abrir **só para leitura**) ou, numa linha de comandos com Python:

```powershell
.venv\Scripts\python.exe -c "import sqlite3,sys,pathlib; c=sqlite3.connect(pathlib.Path(sys.argv[1]).resolve().as_uri()+'?mode=ro',uri=True); print(c.execute('PRAGMA integrity_check').fetchone()[0], c.execute('SELECT COUNT(*) FROM importacoes').fetchone()[0])" "C:\caminho\da\copia.db"
```

(Deve mostrar `ok` e o número de importações.)

### Apagar todo o histórico

Feche o LogiFlow e apague a pasta de dados (`%LOCALAPPDATA%\LogiFlow`), **incluindo a pasta
`copias`** e o `registo-eliminacoes.json`. Cópias guardadas noutras pastas ou discos têm de ser
apagadas à mão. No arranque seguinte é criada uma base de dados vazia.

## 13. Atualizar a partir da versão 1.2.0

A versão 1.2.0 não guardava nada, por isso **não há dados a migrar**.

1. Feche o LogiFlow.
2. Substitua a pasta da aplicação pela nova (ou extraia o ZIP novo por cima). A pasta `.venv`
   pode ficar; se a apagar, volte a correr `instalar.bat`.
3. Corra `instalar.bat` (as dependências são as mesmas — o SQLite faz parte do Python — mas
   correr de novo não faz mal).
4. Abra com `iniciar.bat`. No primeiro arranque é criada a base de dados em
   `%LOCALAPPDATA%\LogiFlow` (aparece no separador «Histórico»).

Quem já testou uma versão de validação anterior da 1.3.0 tem uma base no esquema 1: é atualizada
automaticamente para o esquema 2 no arranque, com cópia prévia validada (secção 8).

Nas atualizações seguintes, a base de dados **fica fora da pasta substituída** e não é tocada
pelo `instalar.bat` nem pelo `iniciar.bat` (o CI no Windows verifica-o: grava uma importação, corre
o `instalar.bat` outra vez e o `iniciar.bat`, e confirma que continua lá). Para voltar à 1.2.0,
basta usar a pasta antiga: a 1.2.0 ignora a base de dados (que continua lá para quando voltar à
versão nova).

## 14. Várias janelas abertas ao mesmo tempo

O SQLite em modo WAL permite ler enquanto outra janela grava. Cada operação abre e fecha a sua
própria ligação; as gravações usam transações curtas e esperam até 5 segundos se a base estiver
ocupada. Se ainda assim estiver ocupada, a mensagem é «A base de dados estava ocupada por outra
janela do LogiFlow», nada fica a meio e o botão «Tentar guardar de novo» permite repetir. Duas
janelas a gravar o mesmo ficheiro ao mesmo tempo dão uma importação (a outra é indicada como
repetida).

**Durante uma recuperação de cópia**, o ficheiro `logiflow.db.manutencao` (renovado a cada 5 s)
faz com que as outras janelas **recusem gravar**, com a mensagem «Está a decorrer uma recuperação
de cópia de segurança noutra janela… Nada foi gravado». A verificação é feita dentro de cada
transação e a recuperação espera pelas gravações já começadas: nenhuma gravação se perde entre a
cópia da base em uso e a substituição. Se a janela que recupera for fechada a meio, o bloqueio
deixa de contar ao fim de 1 minuto.

Isto é para várias janelas **no mesmo computador**: o LogiFlow continua a não ser uma aplicação
multiutilizador em rede.

## 15. Falhas testadas

**Automaticamente** (`tests/test_interrupcoes.py`, `tests/test_conservacao.py`,
`tests/test_copias.py`, `tests/test_persistencia.py`), sempre em pastas temporárias:

- processo **terminado de repente** (como um fecho forçado) a meio de: uma importação, uma
  recuperação (em quatro pontos, e em dois pontos com a base danificada), uma cópia de segurança,
  uma migração (incluindo a real do esquema 1 para o 2) e uma eliminação;
- outra janela a gravar durante uma recuperação; outra janela com a base bloqueada para lá do
  limite de espera; bloqueio de manutenção de outro processo;
- ficheiro recusado pelo Windows por estar em uso (simulado), base com páginas danificadas,
  cabeçalho danificado, base de outra aplicação, de esquema mais recente ou incompleta;
- recuperação de cópias antigas (dados eliminados não voltam), recuperação manual seguida de
  arranque, registo de eliminações ilegível, n.ºs de importação repetidos depois de recuperar.

**Ainda por verificar à mão** (ver a lista de verificações do lançamento): bloqueios reais de
ficheiros no Windows (antivírus, OneDrive, outro programa com a base aberta), pens USB retiradas a
meio de uma cópia, falhas de energia reais e discos cheios reais.

## 16. Limitações e riscos conhecidos

- **Conformidade:** a conservação e a eliminação ajudam a cumprir uma política, mas não são, por si
  só, garantia de cumprimento do RGPD.
- **Cópias fora da pasta indicada:** a aplicação não vê nem elimina cópias noutras pastas, discos,
  pens ou computadores; recuperada noutro computador, uma cópia antiga tem os dados que entretanto
  foram eliminados neste.
- **Sem eliminação por cliente:** só por importação e por prazo (não há «apagar todos os dados do
  cliente X» em todas as importações).
- **Sem cópias automáticas periódicas:** só as cópias automáticas antes de uma migração e de uma
  recuperação. As cópias de segurança são feitas a pedido.
- **Espaço libertado:** depois de eliminar, o ficheiro da base não encolhe (o espaço é reutilizado;
  o conteúdo apagado é sobrescrito).
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
