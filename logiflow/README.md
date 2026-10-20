# LogiFlow — Gestor de Encomendas e Entregas

Aplicação para pequenas transportadoras e empresas de distribuição: importa a lista de
encomendas (Excel ou CSV), verifica a qualidade dos dados, mostra indicadores e o desempenho
operacional (entregas no prazo, tempos de entrega, por cliente, destino e período) e exporta
dados limpos e relatórios em Excel — incluindo um relatório de desempenho por cliente, pronto
a enviar. Funciona no seu computador, sem internet; o histórico das importações fica guardado
só neste computador (e pode ser desligado).

**Versão 1.2.0**, com as funcionalidades da **1.3.0 em validação**: separador «Histórico» —
histórico de importações guardado localmente (SQLite), comparação entre importações e cópias de
segurança com recuperação (ver [Histórico de importações](#histórico-de-importações) e
[docs/HISTORICO.md](docs/HISTORICO.md)). O número da versão só passa a 1.3.0 depois de todos os
testes e verificações finais (incluindo o CI em Windows e Linux) passarem. A 1.2.0 trouxe o
separador «Exceções» e a 1.1.0 o separador «Desempenho». A avaliação das próximas melhorias está
em [ROTEIRO.md](ROTEIRO.md).

![Ecrã principal com o ficheiro de exemplo](docs/ecra_encomendas.png)

## O que faz

| Funcionalidade | Onde está |
| --- | --- |
| Importar ficheiros **Excel (.xlsx)** e **CSV** (separados por `;` ou `,`) | Barra lateral → «1. Ficheiro» |
| Validar as colunas obrigatórias: n.º de encomenda, cliente, data, destino e estado | Automático; pode corrigir em «Correspondência de colunas» |
| Tabela com pesquisa e filtros por estado, data, situação face ao prazo e validação | Separador «Encomendas» |
| Detetar campos vazios, números de encomenda duplicados e datas inválidas | Separador «Qualidade dos dados» |
| Indicadores: total, entregues, pendentes e atrasadas | Topo da página |
| **Painel de exceções**: atrasadas, prazo nas próximas 48 horas, pendentes há 5 ou mais dias, dados incompletos ou inválidos e possíveis duplicados, com prioridade, filtros e exportação | Separador «Exceções» |
| Desempenho: taxa de entregas no prazo, tempo médio de entrega, comparação por cliente, destino e período, antiguidade das pendentes | Separador «Desempenho» |
| Exportar dados limpos e relatório em Excel | Separador «Exportar» |
| Exportar o relatório de desempenho, de todos os clientes ou de um só | Separador «Exportar» |
| **Histórico de importações** guardado neste computador: lista com pesquisa e filtros, detalhes e encomendas guardadas | Separador «Histórico» (último) |
| **Comparar duas importações**: encomendas novas, alteradas, sem alterações e não encontradas | Separador «Histórico» |
| **Cópias de segurança** da base de dados e recuperação validada | Separador «Histórico» |
| Ficheiro de exemplo com dados fictícios (e o mesmo ficheiro «do dia seguinte») | Botão «Experimentar com o ficheiro de exemplo» |

---

## Instalação no Windows (passo a passo)

Só é preciso fazer isto uma vez.

### 1. Instalar o Python

1. Abra <https://www.python.org/downloads/> e descarregue o **Python 3.13** (ou mais recente; o
   mínimo é o 3.11).
2. Execute o instalador. **No primeiro ecrã, marque a caixa «Add python.exe to PATH»** e carregue
   em «Install Now».

> Em alternativa, numa janela do PowerShell: `winget install -e --id Python.Python.3.13`

### 2. Obter o projeto

Descarregue o repositório do GitHub (botão verde **Code → Download ZIP**) e extraia-o, por
exemplo, para `C:\LogiFlow`. A aplicação está dentro da pasta **`logiflow`**.

### 3. Instalar a aplicação

Abra a pasta `logiflow` e faça **duplo clique em `instalar.bat`**. O script:

- confirma que o Python está instalado e é a versão 3.11 ou superior;
- cria uma pasta `.venv` (um «ambiente virtual»: uma instalação de Python só para esta
  aplicação, que não mexe no resto do computador);
- instala as bibliotecas indicadas em `requirements.txt` (demora 1 a 3 minutos na primeira vez).

> Se o Windows mostrar «O Windows protegeu o seu PC», clique em **Mais informações → Executar
> mesmo assim**. Acontece com qualquer script descarregado da internet.

### 4. Abrir a aplicação

Faça **duplo clique em `iniciar.bat`**. Abre-se uma janela preta (deixe-a aberta) e o navegador
mostra a aplicação (normalmente em <http://localhost:8501>). Para fechar, feche essa janela preta.

No primeiro arranque, a aplicação cria a pasta de dados do histórico em
`%LOCALAPPDATA%\LogiFlow` (fora da pasta da aplicação). Não é preciso instalar nada para isso: o
SQLite faz parte do Python.

### Atualizar a partir da versão 1.2.0

1. Feche o LogiFlow e substitua a pasta da aplicação pela nova (ou extraia o ZIP novo por cima).
2. Faça duplo clique em `instalar.bat` (as dependências são as mesmas; não faz mal correr de novo)
   e depois em `iniciar.bat`.

A 1.2.0 não guardava dados, por isso não há nada a migrar. Nas atualizações seguintes, o histórico
fica fora da pasta substituída e, se o formato da base de dados mudar, é atualizado
automaticamente no arranque, com uma cópia de segurança feita antes. Detalhes em
[docs/HISTORICO.md](docs/HISTORICO.md#11-atualizar-a-partir-da-versão-120).

### Alternativa: comandos no PowerShell

Se preferir a linha de comandos (clique com o botão direito na pasta `logiflow` → «Abrir no
Terminal»):

```powershell
# 1. Criar o ambiente virtual (só na primeira vez)
py -3 -m venv .venv

# 2. Instalar as dependências (só na primeira vez)
.venv\Scripts\python.exe -m pip install -r requirements.txt

# 3. Iniciar a aplicação (sempre que a quiser usar)
.venv\Scripts\python.exe -m streamlit run app.py
```

Estes comandos usam diretamente o `python.exe` da pasta `.venv`, por isso não é preciso
«ativar» o ambiente virtual (o que no PowerShell costuma dar erros de permissões).

---

## Como usar

1. **Importe um ficheiro** na barra lateral, ou clique em «Experimentar com o ficheiro de exemplo».
2. **Confirme as colunas.** A aplicação reconhece cabeçalhos comuns («Nº Encomenda», «Localidade»,
   «Situação»...). Se faltar alguma coluna obrigatória, aparece uma mensagem a dizer qual, e pode
   escolher a coluna certa em «Correspondência de colunas».
3. **Reveja os indicadores e a tabela.** Os filtros afetam a tabela, os indicadores e os gráficos.
4. **Abra as «Exceções»**: a lista do que precisa de intervenção, por prioridade. Filtre e exporte.
5. **Veja o «Desempenho»**: taxa de entregas no prazo, tempo de entrega e onde há mais atrasos.
6. **Veja a «Qualidade dos dados»**: cada problema indica a linha do ficheiro original, para o
   poder corrigir na origem.
7. **Exporte** os dados limpos, o relatório e o relatório de desempenho (separador «Exportar»).
8. **Consulte o «Histórico»**: as importações anteriores, as diferenças entre duas importações e as
   cópias de segurança.

### Formato do ficheiro

| Coluna | Obrigatória | Exemplos de cabeçalho aceites |
| --- | --- | --- |
| N.º Encomenda | Sim | Nº Encomenda, Número da Encomenda, Encomenda, Order ID |
| Cliente | Sim | Nome do Cliente, Customer |
| Data | Sim | Data da Encomenda, Data do Pedido, Order Date |
| Destino | Sim | Localidade, Cidade, Local de Entrega |
| Estado | Sim | Situação, Estado da Encomenda, Status |
| Data Prevista | Não | Prazo de Entrega, Data Limite, Due Date |
| Data de Entrega | Não | Data da Entrega, Data Efetiva de Entrega, Entregue em |

- Maiúsculas, acentos e pontuação nos cabeçalhos são ignorados.
- Outras colunas (peso, observações...) são mantidas e aparecem nas exportações.
- Se o Excel tiver um título nas primeiras linhas, o cabeçalho é encontrado automaticamente.
- **Datas:** `dd/mm/aaaa` (também `dd-mm-aaaa`, `dd.mm.aa` e `aaaa-mm-dd`) ou células de data do
  Excel. `03/04/2026` é sempre 3 de abril.
- **CSV:** separado por `;` ou `,`; codificação UTF-8 ou Windows-1252 (a do Excel em português).

### Regras de cálculo

| Indicador | Regra |
| --- | --- |
| **Entregues** | Só as encomendas cujo estado diz «Entregue». Ter uma data de entrega **não** basta: gera um aviso, mas a encomenda não é contada como entregue. |
| **Pendentes** | Estados «Pendente» e «Em trânsito». |
| **Atrasadas** | Pendentes cujo prazo já passou na **data de referência** (normalmente hoje). O prazo é a «Data Prevista»; se não existir, pode definir um **prazo padrão** em dias na barra lateral. Sem nenhum dos dois, o indicador mostra «—» (não disponível) em vez de inventar um valor. Uma encomenda que vence hoje ainda está no prazo. |

Estados reconhecidos (em qualquer combinação de maiúsculas e acentos):

| Estado | Também aceite como |
| --- | --- |
| Pendente | por expedir, a aguardar expedição, em preparação, pending |
| Em trânsito | em distribuição, expedida, enviada, em rota, saiu para entrega, shipped |
| Entregue | entrega efetuada, entrega concluída, delivered |
| Cancelada | anulada, cancelled |
| Devolvida | devolução, returned |

Um estado que não esteja nesta lista (por exemplo, «Concluída») **não é adivinhado**: a linha
recebe um aviso e não conta como entregue nem como pendente.

### Desempenho operacional

![Separador Desempenho com o ficheiro de exemplo](docs/ecra_desempenho.png)

O separador «Desempenho» responde a «qual é o nosso nível de serviço, e onde falhamos?»:

| Indicador | Como é calculado |
| --- | --- |
| **Entregas no prazo** | Entregues até ao prazo (inclusive) ÷ **entregas avaliadas**. Uma entrega é avaliada se tiver o estado «Entregue», data de entrega e prazo (data prevista ou prazo padrão). Mostra-se sempre o denominador («26 de 35 entregas avaliadas»). Sem entregas avaliadas, aparece «—»: não se inventa 0 % nem 100 %. |
| **Tempo médio de entrega** | Data de entrega − data da encomenda, em dias (média e mediana). Entregas com data anterior à encomenda ficam de fora e são contadas à parte. |
| **Entregas com atraso** | Entregues depois do prazo, com o atraso médio em dias. |
| **Evolução por período** | Por semana (segunda a domingo) ou por mês. Encomendas registadas contam pela data da encomenda; entregas e taxa, pela data de entrega. |
| **Comparação** | Por cliente ou por destino: encomendas, entregues, pendentes, atrasadas, taxa no prazo e tempo médio. |
| **Pendentes por antiguidade** | Pendentes por dias desde a data da encomenda (até 2, 3 a 5, 6 a 10, mais de 10), com quantas estão atrasadas. |

Regras importantes:

- **Só entram as encomendas sem erros** (as mesmas dos «dados limpos»): linhas duplicadas ou
  com datas inválidas distorceriam as taxas. O ecrã e o relatório dizem quantas ficaram de fora.
  Por isso, os números do separador podem diferir dos cartões do topo, que contam todas as linhas.
- Os filtros do topo também se aplicam ao separador.
- Taxas com **menos de 5 entregas avaliadas** são assinaladas («Poucas entregas avaliadas») e
  aparecem a cinzento no gráfico: servem de indicação, não de conclusão.
- Clientes e destinos escritos de formas diferentes («Loja Ávila, Lda.» e «LOJA AVILA LDA») são
  agrupados; mostra-se a grafia mais frequente.
- Quando nenhuma pendente de um grupo tem prazo, a coluna «Atrasadas» fica vazia (desconhecido),
  em vez de 0.

### Painel de exceções

![Separador Exceções com o ficheiro de exemplo](docs/ecra_excecoes.png)

O separador «Exceções» responde a «que encomendas precisam de intervenção, e por onde
começo?». Mostra uma linha por linha do ficheiro, com **todos os motivos** e a **prioridade
mais alta** aplicável.

| Categoria | Regra | Prioridade |
| --- | --- | --- |
| **Atrasada** | Estado «Pendente» ou «Em trânsito», prazo conhecido e já ultrapassado na data de referência — a mesma regra do cartão «Atrasadas» do topo. | Alta |
| **Prazo próximo** | Por entregar, com prazo **hoje ou amanhã**. As datas não têm hora, por isso «nas próximas 48 horas» corresponde ao dia da referência e ao seguinte. | Média |
| **Pendente há demasiado tempo** | Por entregar há **5 ou mais dias**, contados desde uma data da encomenda válida até à data de referência. | Média |
| **Dados incompletos ou inválidos** | Erros de validação já existentes que não são duplicados: campo obrigatório vazio ou data inválida. | Baixa |
| **Possível duplicado** | N.º de encomenda repetido, segundo a regra de validação já existente (todas as ocorrências). | Baixa |

Regras importantes:

- **Sem prazo, nunca se conclui que uma encomenda está atrasada** ou com prazo próximo. Sem uma
  data da encomenda válida, os dias por entregar não são calculados — mas o erro de dados
  continua visível no painel.
- **Prazos calculados não são apresentados como factos:** a coluna «Origem do prazo» diz se o
  prazo vem da «Data Prevista» do ficheiro ou do prazo padrão, e os motivos dizem «prazo
  calculado».
- **As categorias sobrepõem-se.** Uma encomenda atrasada há muito tempo é «Atrasada» e «Pendente há
  demasiado tempo»; aparece uma só vez. Por isso, os totais por categoria **não se somam** — o
  total de encomendas com exceções está no cartão «Encomendas com exceções».
- Prioridade: **Alta** = atrasada; **Média** = prazo próximo ou pendente há demasiado tempo;
  **Baixa** = só problemas de qualidade de dados (sem urgência operacional demonstrada).
- Os **avisos de validação** da encomenda (por exemplo, «tem data de entrega mas o estado é Em
  trânsito») aparecem numa coluna própria, sem mudar a prioridade. Encomendas **só com avisos**
  (por exemplo, estado não reconhecido) não entram no painel; continuam em «Qualidade dos dados».
- Ao contrário do separador «Desempenho», o painel considera **todas as linhas importadas**,
  incluindo as que têm erros — são precisamente as que precisam de intervenção.

**Filtros.** Os filtros do topo aplicam-se ao painel. Além disso, o painel tem filtros próprios —
pesquisa por n.º ou cliente, categoria, prioridade, cliente e ordenação (por prioridade ou por
antiguidade) — que **só afetam o painel e a sua exportação**: não mudam os indicadores do topo nem
os outros separadores (verificado por testes automáticos). O botão «Limpar filtros do painel»
repõe-nos.

**Exportação.** O botão «Descarregar estas N exceções (.xlsx)» exporta **exatamente as linhas
visíveis**, pela mesma ordem, com prioridade, categorias e motivos. A folha «Informação» regista
os filtros aplicados e os totais **só das linhas exportadas** — com um cliente escolhido, o
ficheiro não tem dados de mais nenhum. Acima de 5 000 exceções, o Excel é preparado a pedido.

### Erros e avisos

| Tipo | Gravidade | O que acontece à linha |
| --- | --- | --- |
| Campo obrigatório vazio | Erro | Vai para a folha «Linhas com erros» |
| N.º de encomenda duplicado (todas as ocorrências) | Erro | Vai para «Linhas com erros» — a aplicação não escolhe qual é a certa |
| Data inválida (`31/02/2026`, texto, ano fora de 2000–2100) | Erro | Vai para «Linhas com erros» |
| Estado não reconhecido | Aviso | Mantém-se nos dados limpos, com o aviso |
| Datas incoerentes (entrega antes da encomenda, data no futuro...) | Aviso | Mantém-se nos dados limpos, com o aviso |

**Nenhuma linha se perde:** o ficheiro de dados limpos tem as linhas válidas numa folha e as
linhas com erros noutra, com os valores originais e o motivo. A folha «Informação» confirma que
válidas + com erros = total lido. Linhas totalmente vazias são ignoradas, mas a aplicação diz
quantas eram.

### O que é exportado

- **Dados limpos (.xlsx):** «Encomendas válidas» (datas como datas do Excel, espaços retirados,
  estados uniformizados), «Linhas com erros» (valores originais + motivo) e «Informação».
- **Relatório (.xlsx):** «Resumo» (indicadores, regra de prazo usada, qualidade dos dados),
  «Por estado», «Atrasadas», «Problemas» e «Todas as encomendas».
- **Exceções (.xlsx)** (separador «Exceções»): as exceções visíveis depois dos filtros, com
  prioridade, categorias, motivos, prazo e a sua origem, e uma folha «Informação» com os filtros
  aplicados e as regras.
- **Relatório de desempenho (.xlsx):** «Resumo» (âmbito, base de cálculo, regra de prazo,
  indicadores e como foram calculados), «Por período», «Por cliente», «Por destino», «Pendentes
  por antiguidade» e «Entregas com atraso». Preparado para impressão (horizontal, ajustado à
  largura da página).
  - **Âmbito:** «Todos os clientes» ou **um só cliente**. No relatório de um cliente, os dados
    são filtrados antes de qualquer cálculo: **não contém dados de outros clientes** (verificado
    por testes automáticos), por isso pode ser enviado ao próprio cliente.

As exportações incluem sempre todas as encomendas do ficheiro, independentemente dos filtros do
topo (o relatório de desempenho usa as encomendas sem erros, de todos os clientes ou do cliente
escolhido). O histórico não muda o conteúdo de nenhuma exportação (verificado por testes).

### Histórico de importações

![Separador Histórico com duas importações comparadas](docs/ecra_historico.png)

Funcionalidade em validação para a 1.3.0. Explicação completa (onde ficam os dados, esquema,
migrações, cópias e recuperação manual) em [docs/HISTORICO.md](docs/HISTORICO.md).

- **O que fica guardado:** com «Guardar importações no histórico» ligado (barra lateral, ligado
  por omissão), cada ficheiro carregado fica registado: nome (sem a pasta), data e hora, estado,
  totais (linhas, válidas, com erros e avisos, entregues, pendentes, atrasadas, exceções por
  prioridade) e os **7 campos** de cada encomenda, já validados. **Não** se guardam o ficheiro
  original nem as outras colunas. O ficheiro de exemplo só é guardado a pedido.
- **Onde:** num ficheiro SQLite em `%LOCALAPPDATA%\LogiFlow` (Windows; em Linux
  `~/.local/share/logiflow`), fora da pasta da aplicação. O caminho aparece no separador.
- **Estados:** «Concluída», «Concluída com avisos» (há linhas com erros ou avisos — incluindo zero
  encomendas válidas: problemas nos dados não são falhas), «Falhada» (o ficheiro não pôde ser lido,
  ou a gravação falhou e foi **totalmente desfeita**) e «Em processamento» (transitório).
- **Importações repetidas:** o mesmo conteúdo (mesmo com outro nome) não volta a ser gravado — a
  aplicação diz quando foi importado. Um ficheiro **diferente** com os mesmos n.ºs de encomenda é
  uma importação nova: é isso que permite comparar.
- **Lista:** das mais recentes para as mais antigas, 50 por página, com pesquisa pelo nome do
  ficheiro, estado e período. Estes filtros **só afetam o histórico** (verificado por testes).
  Os totais são os do momento da importação; nunca são recalculados.
- **Comparar duas importações** (ou «Comparar com a importação anterior», nos detalhes):

  | Categoria | Significado |
  | --- | --- |
  | Nova | Aparece na importação atual e não na anterior. |
  | Alterada | Aparece nas duas, com diferenças (por exemplo, «Estado: Pendente → Entregue»). |
  | Sem alterações | Aparece nas duas, igual. |
  | Não encontrada na importação atual | Estava na anterior e não aparece na atual. **Não** quer dizer entregue nem cancelada: a aplicação nunca infere estados. |

  As encomendas emparelham-se pelo n.º (maiúsculas e espaços nas pontas não contam). Linhas sem
  n.º ou com n.º repetido em qualquer das duas importações **ficam de fora** e são listadas à
  parte; com mais de 20 % de linhas de fora, a comparação é assinalada como parcial. Espaços a mais,
  sinónimos de estado e formatos de data diferentes não contam como alterações.
- **Cópias de segurança:** botão «Criar cópia de segurança agora», para uma pasta à escolha
  (validada; por omissão `copias` junto do histórico). Cada cópia tem um nome com data e hora,
  nunca substitui outra e é verificada logo a seguir. **Guarde cópias também noutro disco.**
- **Recuperar uma cópia:** a cópia é validada e preparada num ficheiro temporário; só depois o
  histórico atual é guardado à parte (`logiflow-antes-da-recuperacao-….db`) e substituído. Uma
  cópia inválida ou incompatível não altera nada. Há também um
  [procedimento de recuperação manual](docs/HISTORICO.md#10-recuperação-manual-sem-a-aplicação).
- **Se a base de dados estiver danificada**, a aplicação continua a funcionar (importar, validar,
  exportar) e o separador «Histórico» explica o problema e permite recuperar uma cópia. A base
  danificada nunca é apagada.

---

## Segurança e privacidade

- **Tudo local.** A aplicação só aceita ligações do próprio computador (`localhost`) e nada é
  enviado para a internet. A recolha de estatísticas do Streamlit está desligada. Depois da
  instalação, não precisa de internet.
- **O que fica guardado no disco (novo, em validação para a 1.3.0):** o histórico de importações,
  numa base de dados SQLite na pasta de dados do utilizador (`%LOCALAPPDATA%\LogiFlow`), com os
  7 campos de cada encomenda (incluindo cliente e destino, que podem ser dados pessoais) e os
  totais — **nunca** o ficheiro original nem as outras colunas. Pode desligar a gravação na barra
  lateral. Nesta versão não há apagamento seletivo nem prazo de conservação automático: para
  apagar tudo, feche a aplicação e apague essa pasta (ver
  [docs/HISTORICO.md](docs/HISTORICO.md#apagar-todo-o-histórico)). A base de dados não é
  encriptada: depende da proteção da conta do Windows.
- **Base de dados:** consultas sempre parametrizadas, transações em todas as gravações,
  integridade referencial ligada e mensagens de erro guardadas sem dados das encomendas.
- **Sem credenciais nem serviços pagos.**
- **Os ficheiros são tratados como dados, nunca como código.** As fórmulas do Excel não são
  calculadas e as macros nunca são executadas. O pacote `defusedxml` protege contra ficheiros
  Excel com XML malicioso, e os ficheiros comprimidos de forma anómala («bombas ZIP») são recusados.
- **Limites claros:** 20 MB por ficheiro, 200 000 linhas e 200 colunas, com mensagens a explicar.
- **Proteção contra injeção de fórmulas:** um valor como `=HYPERLINK(...)` vindo do ficheiro é
  gravado nas exportações como texto, nunca como fórmula — incluindo os **nomes de colunas**
  extra do ficheiro, que até à versão 1.1.0 eram gravados como fórmula nos cabeçalhos dos dados
  limpos (corrigido e coberto por um teste). Por isso, o botão de exportação CSV
  incorporado nas tabelas está desligado e as exportações fazem-se pelos botões de Excel.
- **CSV mal formado** (por exemplo, aspas por fechar) é recusado com indicação da linha, em vez
  de juntar silenciosamente várias linhas num só campo.

### Dependências e porque são precisas

| Pacote | Para quê |
| --- | --- |
| `streamlit` | A interface no navegador |
| `pandas` | A tabela de encomendas, pesquisa e filtros |
| `openpyxl` | Ler e escrever ficheiros Excel |
| `defusedxml` | Segurança na leitura de Excel (o openpyxl usa-o automaticamente) |
| `pytest` | Só para os testes (`requirements-dev.txt`) |

O histórico usa o **SQLite incluído no Python** (módulo `sqlite3`): nenhuma dependência nova.

---

## Ficheiro de exemplo

`dados_exemplo/encomendas_exemplo.xlsx` e `.csv` têm 60 encomendas **inteiramente fictícias**:
os nomes de empresas foram inventados (qualquer semelhança com empresas reais é coincidência) e
não há pessoas, moradas, contribuintes nem contactos. Os destinos são nomes de localidades.

Inclui problemas colocados de propósito, para a demonstração:

| Linha | Problema |
| --- | --- |
| 9 | Cliente vazio |
| 17 | Destino vazio |
| 23 e 24 | N.º de encomenda repetido, com dados diferentes |
| 32 | Data `31/02/2026` (não existe) |
| 40 | Data prevista «brevemente» |
| 49 | Estado «A confirmar» (aviso) |
| 51 | Tem data de entrega, mas o estado é «Em trânsito» (aviso) |
| 52 | Estado vazio |
| 60 e 61 | Linha repetida por inteiro |

Com a data de referência 20/10/2026 (usada automaticamente quando abre o exemplo), os indicadores
são: 60 encomendas, 41 entregues, 11 pendentes, 8 atrasadas e 9 linhas com erros. No separador
«Exceções»: 18 encomendas com exceções — 8 de prioridade alta, 1 média e 9 baixa. No separador
«Desempenho» (51 encomendas sem erros): 74,3 % de entregas no prazo (26 de 35), tempo médio de
entrega de 3,3 dias e 9 entregas com atraso.

**Exemplo do dia seguinte** (`dados_exemplo/encomendas_exemplo_dia2.xlsx`, para experimentar o
histórico): o mesmo ficheiro exportado um dia depois — 4 encomendas entregues a 20/10/2026, 2 que
passaram a «Em trânsito», 1 data prevista adiada, 5 encomendas novas (ENC-26-0061 a 0065) e as 3
mais antigas (ENC-26-0001 a 0003) já fora da exportação. Comparado com o dia 1: **5 novas,
7 alteradas, 46 sem alterações e 3 não encontradas**; ficam de fora da comparação 4 linhas de cada
lado (os n.ºs ENC-26-0022 e ENC-26-0059, repetidos de propósito). Descarregue-o em «Descarregar o
ficheiro de exemplo», no ecrã inicial.

Para voltar a gerar os ficheiros: `.venv\Scripts\python.exe scripts\gerar_exemplo.py`

---

## Testes automáticos

Faça duplo clique em **`testar.bat`**, ou:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m pytest
```

São 285 testes: os 171 da versão 1.2.0 (um deles atualizado de propósito para exigir o separador
«Histórico» no fim, depois dos restantes) e 114 novos do histórico. Um deles (pasta sem permissão de
escrita) só corre em Linux/macOS sem privilégios de administrador. Verificam:

- **Importação:** codificações, separadores, cabeçalho depois de um título, linhas vazias, colunas
  sem nome, ficheiros inválidos, demasiado grandes ou maliciosos, e fórmulas que não são executadas.
- **Validação:** deteção de colunas, campos vazios, duplicados, datas válidas e inválidas, estados,
  e que nenhuma encomenda é dada como entregue sem o estado o dizer.
- **Indicadores:** atrasos com data prevista, com prazo padrão e sem dados.
- **Desempenho:** taxa no prazo e denominadores, tempos de entrega com datas incoerentes, exclusão
  das linhas com erros, agrupamento por cliente/destino/semana/mês, antiguidade das pendentes e
  casos sem datas («não disponível» em vez de valores inventados).
- **Exceções:** atrasadas, janela de 48 horas (dentro e fora), datas ausentes ou inválidas, vários
  motivos numa só linha, antiguidade só com data válida, prioridades e ordenação, pesquisa e
  combinação de filtros, filtros do topo, e que nada é alterado nos dados nem nos indicadores.
- **Exportações:** nenhuma linha se perde, as datas ficam datas, nada é gravado como fórmula, o
  relatório bate certo com os indicadores, o relatório de desempenho de um cliente não contém
  dados de outros clientes, e a exportação de exceções tem só as linhas filtradas, sem fórmulas
  e sem dados de clientes fora do filtro (também quando não há exceções).
- **Interface:** a aplicação abre, carrega o exemplo, os filtros atualizam os indicadores e o
  desempenho, os filtros do painel de exceções não afetam os outros separadores, e as exportações
  (incluindo o relatório por cliente e as exceções filtradas) ficam disponíveis.
- **Histórico (novo):** criação da base de dados, migração de esquema com cópia prévia e
  reabertura, dados que persistem noutro processo, importações válidas, com avisos, sem linhas
  válidas e ilegíveis, falhas a meio da gravação com rollback e preservação do histórico,
  deduplicação, duas janelas a gravar e a arrancar ao mesmo tempo, base ocupada, comparação
  (novas, alteradas, sem alterações, não encontradas, n.ºs repetidos ou vazios, normalização de
  datas, espaços, estados e números), cópias de segurança (criação, nomes, validação, cópias
  inválidas, danificadas, de outra aplicação ou mais recentes) e recuperação (incluindo base atual
  danificada e falha na verificação final), base danificada ou incompatível que nunca é
  substituída, pastas de dados em Windows/macOS/Linux, filtros do histórico isolados, exportações
  inalteradas e volumes de 100 000 encomendas. Os testes usam sempre pastas temporárias e
  verificam no fim que a pasta de dados real não foi tocada.

No GitHub, o CI corre estes testes em Windows e Linux e, num Windows limpo, corre o `instalar.bat`,
grava uma importação de exemplo na pasta de dados real (`%LOCALAPPDATA%\LogiFlow`), corre o
`instalar.bat` outra vez (como numa atualização) e o `iniciar.bat`, e confirma que o histórico se
mantém (`scripts/verificar_historico_ci.py`).

---

## Estrutura do projeto

```
logiflow/
├── app.py                  ← interface (ecrãs, filtros, botões)
├── logiflow/               ← lógica da aplicação, testável sem interface
│   ├── campos.py           ← colunas aceites, estados e deteção automática
│   ├── importacao.py       ← leitura segura de CSV e Excel
│   ├── datas.py            ← interpretação de datas (dia/mês/ano)
│   ├── validacao.py        ← vazios, duplicados, datas inválidas, avisos
│   ├── indicadores.py      ← prazos, atrasos e indicadores
│   ├── desempenho.py       ← taxa no prazo, tempos de entrega, por cliente/destino/período
│   ├── excecoes.py         ← painel de exceções: categorias, prioridades, filtros
│   ├── exportacao.py       ← Excel de dados limpos, relatório, desempenho e exceções
│   ├── persistencia.py     ← SQLite: pasta de dados, ligações, transações, esquema e migrações
│   ├── historico.py        ← gravar importações (transações, deduplicação) e consultar o histórico
│   ├── comparacao.py       ← comparar duas importações
│   ├── copias.py           ← cópias de segurança e recuperação
│   └── exemplo.py          ← localização dos ficheiros de exemplo
├── tests/                  ← testes automáticos (pytest)
├── dados_exemplo/          ← ficheiros de exemplo (dados fictícios)
├── scripts/gerar_exemplo.py← gera os ficheiros de exemplo
├── scripts/verificar_historico_ci.py ← verificação do histórico usada pelo CI no Windows
├── docs/                   ← capturas de ecrã e HISTORICO.md (base de dados, cópias, recuperação)
├── ROTEIRO.md              ← avaliação das próximas melhorias
├── DEMONSTRACAO.md         ← guião de demonstração a clientes
├── .streamlit/config.toml  ← configuração (só localhost, sem estatísticas, tema)
├── instalar.bat / iniciar.bat / testar.bat  ← atalhos para Windows
├── requirements.txt        ← dependências da aplicação
└── requirements-dev.txt    ← dependências dos testes
```

Porque está separado assim: o `app.py` só desenha o ecrã e chama as funções da pasta `logiflow/`.
Toda a regra de negócio (o que é um erro, o que é um atraso) está num só sítio e é testada
automaticamente, sem abrir o navegador.

---

## Funcionalidades não implementadas e limitações

Estas funcionalidades **não estão implementadas** nesta versão:

- **Ficheiros `.xls` (Excel 97-2003)** e ficheiros Excel protegidos por palavra-passe — guarde
  como `.xlsx`.
- **Editar encomendas dentro da aplicação** — corrija o ficheiro de origem e importe-o de novo.
- **Importar vários ficheiros de uma vez** ou juntar ficheiros.
- **Exportar só as encomendas filtradas**, ou exportar em CSV ou PDF (exporta-se sempre o
  ficheiro completo, em Excel).
- **Utilizadores, palavras-passe, acesso por várias pessoas na rede ou separação de dados por
  empresa.** A aplicação **não** está preparada para utilização empresarial multiutilizador.
- **Integrações** com transportadoras, GPS, mapas, rotas, faturação, e-mail ou SMS.
- **Apagar importações do histórico** uma a uma, **prazo de conservação** automático e **cópias
  de segurança automáticas periódicas** (só há a cópia automática antes de uma migração).
- **Desempenho e exceções ao longo do tempo** a partir do histórico (gráficos de várias
  importações): o histórico guarda os totais de cada importação, mas o separador «Desempenho»
  continua a usar só o ficheiro aberto.
- **Relatório em PDF, logótipo ou personalização da empresa** e **modelos de importação**:
  avaliados em [ROTEIRO.md](ROTEIRO.md), não implementados.
- **Configurar os limites** do desempenho (mínimo de 5 entregas avaliadas; faixas de antiguidade
  2/5/10 dias) e do painel de exceções (48 horas; 5 dias; prioridades): são fixos nesta versão.
- **Exceções para encomendas só com avisos** (por exemplo, estado não reconhecido) e **horas nos
  prazos** (as datas são dias inteiros): não tratados no painel.
- **Datas guardadas como número** (por exemplo, `45930`) não são convertidas, porque não é
  possível ter a certeza de que são datas: aparecem como data inválida.
- **Fórmulas do Excel sem valor guardado** (ficheiros gerados por outros programas) aparecem
  vazias: a aplicação nunca calcula fórmulas.

Outras limitações:

- Ficheiros com mais de 5 000 encomendas: os Excel são preparados a pedido (botão «Preparar
  ficheiros Excel»). Com 100 000 encomendas, pode demorar perto de um minuto.
- **Histórico com ficheiros grandes** (medido com 100 000 encomendas, neste ambiente de
  desenvolvimento em Linux): guardar no histórico acrescenta cerca de 1,5 s, **uma vez** por
  ficheiro carregado; cada interação seguinte demora o mesmo que na 1.2.0 (cerca de +0,05 s; as
  consultas do separador «Histórico» levam cerca de 2 ms, porque a lista é paginada); comparar duas
  importações de 100 000 encomendas demora cerca de 3 s, só quando se carrega no botão. Cada
  100 000 encomendas guardadas ocupam cerca de 15 MB.
- O histórico é deste computador: não é partilhado entre computadores nem utilizadores, e a base de
  dados não é encriptada. Não a coloque numa pasta sincronizada (OneDrive, Dropbox) nem num disco
  de rede.
- As listas de encomendas guardadas e as comparações mostram no máximo 5 000 linhas de cada vez.
- Alguns textos internos do Streamlit aparecem em inglês (menu de ordenação das colunas e nomes
  dos meses no calendário).
- A interface foi pensada para ecrãs de computador (a partir de 1366 × 768); não está otimizada
  para telemóvel.

---

## Resolução de problemas

| Problema | Solução |
| --- | --- |
| «O Python não foi encontrado» ou abre a Microsoft Store | Instale o Python de python.org e marque «Add python.exe to PATH». Feche e volte a abrir a janela. |
| O navegador não abre | Abra manualmente o endereço que aparece na janela preta, em «Local URL» (normalmente <http://localhost:8501>). |
| Abriu-se em <http://localhost:8502> | Já havia outro LogiFlow aberto. Pode fechar a janela preta mais antiga. |
| Acentos trocados num CSV | No Excel, guarde com «CSV UTF-8 (delimitado por vírgulas)». |
| «Faltam colunas obrigatórias» | Abra «Correspondência de colunas» e escolha a coluna certa para cada campo. |
| «A base de dados do histórico não pode ser lida» | A aplicação continua a funcionar. No separador «Histórico», recupere uma cópia de segurança; ou siga a [recuperação manual](docs/HISTORICO.md#10-recuperação-manual-sem-a-aplicação). A base danificada não é apagada. |
| «A base de dados estava ocupada por outra janela» | Outra janela do LogiFlow estava a gravar. Carregue em «Tentar guardar de novo». |
| Não quero guardar histórico | Desligue «Guardar importações no histórico» na barra lateral. |
| O antivírus bloqueia o `.bat` | Os scripts só criam a pasta `.venv` e iniciam a aplicação; pode abri-los no Bloco de Notas para confirmar. Em alternativa, use os comandos do PowerShell acima. |

## Demonstração a clientes

Ver [DEMONSTRACAO.md](DEMONSTRACAO.md): guião de cerca de 16 minutos com o ficheiro de exemplo,
incluindo o painel de exceções, o desempenho, o relatório por cliente e o histórico.
