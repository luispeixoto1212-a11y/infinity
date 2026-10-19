# Guião de demonstração do LogiFlow (cerca de 12 minutos)

Objetivo: mostrar a um potencial cliente (uma transportadora ou distribuidora) que o LogiFlow
transforma uma folha de Excel desarrumada em números fiáveis, mede o nível de serviço e produz
relatórios prontos a enviar — incluindo um relatório para cada cliente dele — sem inventar dados.

## Antes da reunião (15 minutos, no dia anterior)

1. Instale e abra a aplicação no portátil que vai usar (`instalar.bat`, depois `iniciar.bat`).
2. Clique em «Experimentar com o ficheiro de exemplo» e confirme que vê **60 encomendas,
   41 entregues, 11 pendentes, 8 atrasadas e 9 linhas com erros**.
3. Descarregue uma vez o relatório, os dados limpos e o relatório de desempenho de um cliente,
   para confirmar que o Excel os abre.
4. No separador «Desempenho», confirme **74,3 % de entregas no prazo (26 de 35)**, **3,3 dias**
   de tempo médio de entrega e **9 entregas com atraso**.
5. Use o browser em ecrã inteiro (F11) e feche os outros separadores.
6. Se possível, peça ao cliente um **ficheiro real de exportação** (pode ser só um mês). Teste-o
   antes da reunião, porque o cabeçalho pode precisar de ser escolhido em «Correspondência de
   colunas».

> Use apenas o ficheiro de exemplo (fictício) ou dados que o cliente lhe tenha autorizado a usar.
> Não mostre dados de outros clientes.

## Durante a demonstração

### 1. O problema (1 minuto)

> «Hoje as encomendas estão numa folha de Excel ou numa exportação do vosso sistema. Para saber
> quantas estão atrasadas, alguém tem de as contar à mão, e os erros (números repetidos, datas
> mal escritas) só se descobrem tarde.»

### 2. Importar (1 minuto)

- Mostre o ecrã inicial: «Colunas esperadas». Diga que os cabeçalhos podem variar («Nº
  Encomenda», «Localidade», «Situação»...).
- Clique em **«Experimentar com o ficheiro de exemplo»**. Sublinhe que são dados fictícios.
- Aponte para a barra lateral: «Os ficheiros são processados neste computador e não são guardados
  nem enviados para a internet.»

### 3. Indicadores (2 minutos)

- Leia os cinco cartões: 60 encomendas, 41 entregues, 11 pendentes, **8 atrasadas**, 9 com erros.
- Passe o rato pelo **?** de «Atrasadas» para mostrar a regra: compara a data prevista com a data
  de referência.
- Mensagem-chave: **«A aplicação nunca assume que uma encomenda foi entregue.»** Só conta como
  entregue o que o ficheiro diz ser «Entregue». Se não houver data prevista, o indicador de
  atrasos mostra «—» em vez de inventar um número.
- Na barra lateral, mude a **data de referência** para 25/10/2026 e veja as atrasadas
  aumentarem. Volte a pôr 20/10/2026.

### 4. Pesquisa e filtros (2 minutos)

- Escreva «Braga» em **Pesquisar**: a tabela e os indicadores atualizam-se.
- Limpe a pesquisa. Em **Mais filtros → Situação face ao prazo**, escolha «Atrasada». Ficam as
  8 encomendas que é preciso acompanhar hoje.
- Clique em **Limpar todos os filtros**.
- No separador **Resumo**, mostre o gráfico por estado e a lista de atrasadas, ordenada pelos
  dias de atraso.

### 5. Qualidade dos dados (2 minutos) — o momento «uau»

- Abra o separador **Qualidade dos dados (11)**.
- Mostre três exemplos, com o número da linha do ficheiro original:
  - **Linhas 23 e 24:** o mesmo n.º de encomenda com dados diferentes. A aplicação não escolhe
    qual é a certa: assinala as duas.
  - **Linha 32:** a data 31/02/2026, que não existe.
  - **Linha 51:** tem data de entrega, mas o estado diz «Em trânsito». É um aviso: a encomenda
    **não** é contada como entregue.
- Mensagem-chave: **«Nenhum dado é apagado em silêncio.»**

### 6. Desempenho (2 minutos) — o argumento de venda

> «Os vossos clientes perguntam-vos: “quantas das minhas encomendas chegaram a horas?”. Agora
> têm a resposta em segundos.»

- Abra o separador **Desempenho**: **74,3 % de entregas no prazo**, «26 de 35 entregas
  avaliadas». Sublinhe que o denominador está sempre visível e que só entram as 51 encomendas
  sem erros.
- No gráfico por semana, aponte a primeira semana a cinzento, «0% (só 2)»: **com poucas
  entregas, a aplicação avisa em vez de tirar conclusões.**
- Em **Comparação → Cliente**, mostre que a «Ferragens Ponte Nova» tem 50 % no prazo em
  8 entregas: «é com este cliente que têm de falar». Mude para **Destino**.
- Mostre **Pendentes por antiguidade**: 5 pendentes com 6 a 10 dias, todas atrasadas.

### 7. Exportar (2 minutos)

- Separador **Exportar** → descarregue os **Dados limpos** e abra-os no Excel:
  - folha «Encomendas válidas» (51 linhas);
  - folha «Linhas com erros» (9 linhas, com os valores originais e o motivo);
  - folha «Informação», que confirma que 51 + 9 = 60.
- Descarregue o **Relatório** e mostre a folha «Resumo»: pronto a enviar à direção ou ao cliente
  final.
- Em **Relatório de desempenho**, escolha o âmbito **«Ferragens Ponte Nova»** e descarregue.
  Abra-o: só tem as encomendas desse cliente (taxa no prazo, entregas com atraso, por semana e
  por destino). Mensagem-chave: **«Pode enviar este ficheiro ao cliente: não tem dados de mais
  ninguém.»**

### 8. Fecho (1 minuto)

- Resuma: **importa → valida → mostra o que interessa → exporta**, sem instalar servidores nem
  pagar serviços externos, e com os dados a ficarem no computador da empresa.
- Proponha o passo seguinte: experimentar com um mês de dados reais do cliente.

## Perguntas frequentes do cliente

| Pergunta | Resposta honesta |
| --- | --- |
| «Funciona com o nosso Excel?» | Sim, se for .xlsx ou CSV. Os cabeçalhos são reconhecidos automaticamente ou escolhidos à mão. O .xls antigo tem de ser guardado como .xlsx. |
| «Os dados vão para a nuvem?» | Não. A aplicação corre no computador e só aceita ligações dele próprio. Nada é guardado. |
| «Guarda o histórico?» | Não nesta versão. O desempenho é calculado sobre o ficheiro aberto; para comparar meses, importe um ficheiro com esse período. O histórico está avaliado no ROTEIRO, não implementado. |
| «Dá um PDF com o nosso logótipo?» | Não nesta versão: o relatório de desempenho é em Excel, preparado para imprimir. O PDF está avaliado no ROTEIRO, não implementado. |
| «Os números são fiáveis com poucos dados?» | A aplicação mostra sempre quantas entregas foram avaliadas e assinala taxas com menos de 5 entregas. |
| «Dá para várias pessoas ao mesmo tempo?» | Não nesta versão: é uma aplicação local, para um posto de trabalho. |
| «E se o ficheiro tiver erros?» | É para isso que serve: aponta cada erro com a linha, para o corrigir na origem, sem perder nada. |
| «Liga-se ao nosso software ou às transportadoras?» | Não. Trabalha a partir de ficheiros exportados. |

## Se algo correr mal durante a demonstração

- **O browser não abre:** abra manualmente o endereço que aparece na janela preta (normalmente
  <http://localhost:8501>).
- **A aplicação parece parada:** carregue em F5 no browser e volte a abrir o exemplo.
- **O ficheiro do cliente dá «Faltam colunas obrigatórias»:** aproveite para mostrar a
  «Correspondência de colunas» e escolher as colunas certas. Também é uma funcionalidade.
