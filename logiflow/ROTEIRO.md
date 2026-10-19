# Roteiro do LogiFlow — avaliação das próximas melhorias

Avaliação feita sobre a versão 1.0.0 (importação, validação, indicadores, filtros e
exportação de dados limpos e relatório; sem persistência, sem utilizadores). As estimativas
de esforço são indicativas, para um programador que conheça o projeto.

**Estado:** a melhoria 1 (Relatório de desempenho operacional) foi implementada na
versão 1.1.0. As restantes **não estão implementadas**.

## Resumo e recomendação

| Melhoria | Valor comercial | Esforço | Risco | Estado |
| --- | --- | --- | --- | --- |
| 1. Relatório de desempenho operacional | Alto | Baixo–médio (2–3 dias) | Baixo | **Implementada (1.1.0)** |
| 4. Painel de exceções com prioridades | Alto (parte já coberta) | Baixo–médio (2–3 dias) | Baixo–médio | Não implementada — próxima candidata |
| 3. Modelos de importação reutilizáveis | Médio | Baixo–médio (3–4 dias) | Baixo–médio | Não implementada |
| 5. Relatório operacional profissional (PDF) | Médio–alto | Médio–alto (4–6 dias) | Médio | Não implementada |
| 2. Histórico de importações | Médio–alto | Médio (5–8 dias) | Médio–alto (RGPD) | Não implementada |
| 6. Preparação para várias empresas | Baixo a curto prazo | Alto (semanas) | Muito alto | Não implementada |

A melhoria 1 tem a melhor relação entre valor, esforço e risco: responde à pergunta que
justifica a compra («qual é o nosso nível de serviço, e onde falhamos?»), produz um
entregável que a transportadora pode enviar a cada cliente, usa apenas dados já validados e
não guarda dados nem acrescenta dependências. Serve ainda de base às melhorias 5 e 2.

Ordem sugerida a seguir: **4 → 3 → 5 → 2 → 6**.

---

## 1. Relatório de desempenho operacional

- **Problema que resolve:** o gestor não consegue responder, com números, a «que
  percentagem entregamos no prazo?», «quanto tempo demoramos?» e «com que clientes, destinos
  ou semanas falhamos?». A versão 1.0 só conta as entregas com atraso.
- **Valor para o cliente:** alto. Clientes empresariais exigem provas de cumprimento de
  prazos; um relatório por cliente é um argumento de retenção e de venda para a própria
  transportadora.
- **Complexidade:** baixa a média. Cálculos sobre a tabela já validada; um separador novo e um
  Excel novo; sem dependências novas.
- **Riscos técnicos e de segurança:** métricas enganadoras com poucos dados ou datas em falta
  (mitigação: denominadores sempre visíveis, aviso de amostra pequena, «não disponível» quando
  não há dados); fuga de dados de outros clientes num relatório por cliente (mitigação:
  filtrar antes de calcular e testar); nomes vindos do ficheiro gravados no Excel (mitigação:
  a proteção existente contra fórmulas).
- **Testes necessários:** taxa no prazo e denominadores; tempo de entrega com datas
  incoerentes; exclusão das linhas com erros; agrupamento por cliente/destino com variações de
  escrita; agrupamento por semana e mês; antiguidade das pendentes; relatório por cliente sem
  dados de outros clientes; injeção de fórmulas; interface; regressão das funcionalidades 1.0.
- **Dependências:** nenhuma.

## 2. Histórico de importações

- **Problema que resolve:** cada sessão perde-se; não há comparação entre semanas nem registo
  do que foi importado e quando.
- **Valor para o cliente:** médio a alto, mas só se materializa após semanas de uso.
- **Complexidade:** média. Base de dados SQLite, esquema e migrações, deteção de reimportação
  do mesmo ficheiro, apagamento e prazo de conservação.
- **Riscos técnicos e de segurança:** passa a haver dados de clientes guardados em disco —
  obrigações do RGPD (finalidade, conservação, apagamento, cópias de segurança); corrupção da
  base de dados; acessos simultâneos de vários separadores; quebra da garantia atual «nada é
  guardado». Alternativa de menor risco: guardar apenas indicadores agregados, sem nomes.
- **Testes necessários:** gravação e leitura; reimportação; apagamento; migração de esquema;
  base de dados danificada; o que fica (e o que não fica) guardado.
- **Dependências:** é pré-requisito da melhoria 6; beneficia da melhoria 1 (indicadores a
  guardar).

## 3. Modelos de importação reutilizáveis

- **Problema que resolve:** quem recebe sempre ficheiros do mesmo sistema repete a
  correspondência de colunas; não é possível declarar sinónimos próprios de estado (por
  exemplo, «Concluída» = «Entregue» para um cliente concreto).
- **Valor para o cliente:** médio — poupa tempo em importações recorrentes; a deteção
  automática já cobre os cabeçalhos comuns.
- **Complexidade:** baixa a média, se o modelo for um ficheiro JSON descarregado e carregado
  pelo utilizador (sem base de dados).
- **Riscos técnicos e de segurança:** o modelo é uma entrada não confiável (validar o esquema,
  limitar o tamanho, nunca usar `pickle`); um sinónimo mal definido pode dar encomendas como
  entregues — tem de ficar visível que regra foi aplicada.
- **Testes necessários:** gravar/carregar sem perdas; modelos inválidos, enormes ou
  maliciosos; colunas do modelo inexistentes no ficheiro; sinónimos aplicados e auditados.
- **Dependências:** nenhuma (variante em ficheiro); com a melhoria 2, poderia ficar guardado.

## 4. Painel de exceções com prioridades

- **Problema que resolve:** o operador precisa de uma lista única do que resolver hoje
  (atrasadas há mais tempo, a vencer hoje/amanhã, pendentes sem prazo, incoerências, erros de
  dados). Hoje a informação está espalhada pelos separadores Resumo e Qualidade.
- **Valor para o cliente:** alto no uso diário (é o que faz abrir a aplicação todas as
  manhãs); parte já existe (lista de atrasadas ordenada).
- **Complexidade:** baixa a média.
- **Riscos técnicos e de segurança:** regras de prioridade são decisões de negócio — têm de
  ser explícitas, documentadas e, idealmente, configuráveis; nunca prever risco sem datas que
  o suportem.
- **Testes necessários:** cada regra de prioridade; ordenação; casos sem prazo; exportação.
- **Dependências:** nenhuma; reutiliza os prazos e pode usar os indicadores da melhoria 1.

## 5. Relatório operacional profissional

- **Problema que resolve:** o Excel atual é funcional mas «interno»; falta um documento com
  imagem profissional (PDF, logótipo, gráficos) para enviar a clientes e à direção.
- **Valor para o cliente:** médio a alto em vendas; é sobretudo apresentação — o conteúdo de
  valor vem da melhoria 1.
- **Complexidade:** média a alta. Biblioteca de PDF e de gráficos (por exemplo, reportlab e
  matplotlib), fontes com acentos, paginação.
- **Riscos técnicos e de segurança:** novas dependências; logótipo carregado pelo utilizador é
  uma imagem não confiável (validar formato e tamanho); manutenção do layout.
- **Testes necessários:** geração do PDF; conteúdo e acentos; imagens inválidas; tamanho do
  ficheiro.
- **Dependências:** melhoria 1.

## 6. Preparação para utilização futura por várias empresas

- **Problema que resolve:** vender o LogiFlow como serviço a várias empresas, com dados
  separados.
- **Valor para o cliente:** baixo a curto prazo (a aplicação é local, para um posto de
  trabalho); só ganha valor com um modelo de negócio SaaS.
- **Complexidade:** alta. Autenticação, perfis e permissões, separação de dados por empresa,
  alojamento, registos de auditoria, cópias de segurança.
- **Riscos técnicos e de segurança:** muito altos — fuga de dados entre empresas, gestão de
  credenciais, custos de alojamento, obrigações de subcontratante no RGPD.
- **Testes necessários:** isolamento entre empresas, permissões, sessões, testes de intrusão,
  recuperação de cópias de segurança.
- **Dependências:** melhoria 2 (persistência) e melhoria 3 (configuração por empresa).

> A aplicação **não** está preparada para utilização empresarial por vários utilizadores ou
> várias empresas: não tem autenticação, permissões nem separação de dados.
