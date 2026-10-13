# Universe Infinity

Atlas científico interativo para explorar o Universo em 3D. Esta primeira versão cobre a **Fase 1 (fundação)** e o **núcleo da Fase 2 (Sistema Solar)**: uma vista 3D com as posições reais dos planetas na data atual, fichas científicas com fontes e uma página que explica os métodos e valida os cálculos contra o JPL Horizons.

Interface em português de Portugal.

## Como executar no teu computador

1. Instala o **Node.js 22 LTS** (ou mais recente): <https://nodejs.org/>.
2. Na pasta do projeto, abre um terminal e corre:

   ```bash
   npm install
   npm run dev
   ```

3. Abre o endereço que aparece no terminal (normalmente <http://localhost:5173>).

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run build` | Verifica os tipos (TypeScript) e gera a versão de produção em `dist/` |
| `npm run preview` | Serve a pasta `dist/` localmente |
| `npm test` | Corre os testes automáticos (Vitest) |
| `npm run typecheck` | Só a verificação de tipos |

Não são precisas chaves de API. A galeria de fotografias usa a API pública da NASA Image and Video Library, que não pede chave; se estiveres sem ligação, a ficha continua a funcionar e mostra uma mensagem clara.

## O que já funciona

**Exploração 3D (página inicial)**
- Sol, 8 planetas, Lua, Plutão e Ceres nas posições calculadas para a data simulada, com texturas reais (Solar System Scope, CC BY 4.0).
- Cerca de 5000 estrelas reais do Yale Bright Star Catalogue como fundo, com cor estimada a partir do índice B−V.
- Câmara com rodar, aproximar e deslocar (rato, teclado e toque); voo suave até cada objeto, que fica seguido enquanto se move.
- Seleção por clique, toque ou etiqueta; painel com distâncias atuais ao Sol e à Terra e tempo de viagem da luz.
- Controlo do tempo: pausar, sete velocidades (tempo real a 1 ano/s), sentido inverso, voltar a "Agora".
- Órbitas e etiquetas configuráveis, três perspetivas, recentrar, ecrã inteiro, qualidade gráfica automática/alta/reduzida.
- Orientação dos eixos e rotação segundo o modelo da IAU: o lado iluminado da Terra corresponde à hora real.
- Anéis de Saturno (com as dimensões da NASA) e os dez anéis principais de Úrano.

**Fichas científicas** (`#/objeto/<nome>`)
- Modelo 3D interativo com a inclinação do eixo, dados com unidades, tipo de valor (medido, calculado, médio, estimativa) e fonte em cada linha.
- Atmosfera com composição por volume, estrutura interna, luas (contagem com data de referência e diâmetros do JPL), anéis, características, descobertas, missões e comparação com a Terra.
- Fotografias obtidas em tempo real da NASA, com título, data e crédito da própria fonte.

**Ferramentas**
- Pesquisa global (Ctrl K ou `/`) com resultados enquanto se escreve, nomes em português, inglês e espanhol, tolerância a acentos e pequenos erros, e opção "Ver no espaço".
- Favoritos e histórico guardados no navegador, sem conta.
- Lista do Sistema Solar e comparação de tamanhos reais à mesma escala.
- Página "Dados e métodos" com a validação das posições contra o JPL Horizons, calculada no próprio navegador.
- Atalhos de teclado (prima `?` na vista 3D).

## Rigor científico

- **Posições**: Tabela 1 de E. M. Standish (JPL), válida de 1800 a 2050; a simulação para nesses limites. Plutão e Ceres usam elementos osculadores do JPL Small-Body Database; a Lua usa os elementos médios de Meeus (erro até ~1,5°).
- **Validação**: para 2026-10-13, as diferenças face ao Horizons (DE441) vão de 1″ (Úrano) a 266″ (Saturno), dentro dos erros indicados pelo JPL, exceto Neptuno (32″ contra 10″ indicados) e a distância de Mercúrio (~1200 km contra 1000 km). Isto está documentado na aplicação e nos testes.
- **Escala**: a vista 3D mostra direções reais, mas distâncias comprimidas e tamanhos ampliados. A escala está identificada no ecrã e explicada em "Dados e métodos".
- **Dados**: fichas da NASA NSSDCA e parâmetros do JPL, com data de atualização e de consulta. Valores calculados pela aplicação estão marcados como tal.
- **Representações ilustrativas**: Ceres e Plutão aparecem com cor uniforme (sem textura com licença verificada); a superfície de Vénus vem de radar com cores ilustrativas. Tudo isto está assinalado.

## Arquitetura

- **React 19 + TypeScript + Vite**, com **Three.js** usado diretamente (sem React Three Fiber). Motivo: o motor 3D é uma classe independente da interface, mais fácil de testar e com controlo explícito da libertação de recursos WebGL.
- Sem dependências além de React e Three.js: router por hash, store reativa e i18n são pequenos módulos próprios.
- As secções com 3D são carregadas só quando necessárias (divisão do código); as texturas carregam primeiro em 512 px e depois em 2048 px.

```
src/
  app/            Estrutura, barra superior, router por hash, tratamento de erros
  core/astro/     Tempo (UTC→TDB), Kepler, Lua, orientação IAU, escala da cena
  core/           Formatação pt-PT, armazenamento local seguro, store
  data/           Catálogo de objetos, fontes, vetores de validação do Horizons
  features/
    explorer/     Vista 3D: motor (engine/), painel, tempo, barra de vista, lista
    body/         Fichas: globo 3D, tabela de dados, atmosfera, comparação, galeria
    search/       Índice e diálogo de pesquisa
    solar-system/ Lista e comparação de tamanhos
    favorites/    Favoritos e histórico
    about/        Dados e métodos
  i18n/           Textos da interface (pt-PT; preparado para en e es)
  services/       Cliente da NASA Image and Video Library
public/
  textures/       Texturas (512 px e 2048 px)
  data/stars.json Catálogo de estrelas processado
```

### Acrescentar uma língua

Criar `src/i18n/en.ts` com o mesmo formato de `pt-PT.ts`, registá-lo em `src/i18n/index.ts` e preencher os campos `en` dos textos científicos em `src/data/`. O seletor de língua só deve ser ativado com a tradução completa.

## Testes

- `npm test` corre 72 testes unitários: escalas de tempo, equação de Kepler, posições comparadas com o JPL Horizons, Lua, orientação IAU, escala da cena, coerência do catálogo, pesquisa, formatação pt-PT, router, cliente da NASA e armazenamento local.
- A interface foi também verificada num navegador real (Chromium) em computador e telemóvel: arranque da cena 3D, seleção, controlos do tempo, pesquisa, fichas, favoritos, rotas inválidas e ausência de erros na consola.

## Publicar no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` publica o site. Para o usar:
1. No repositório, abre **Settings → Pages** e escolhe **GitHub Actions** como origem.
2. Em **Actions**, corre o workflow "Publicar no GitHub Pages".

O workflow `ci.yml` verifica tipos, testes e build em cada push.

## Próximos passos

1. **Fase 2 (resto)**: luas principais na vista 3D (galileanas, Titã, Tritão, Caronte), mais asteroides e cometas, fichas para as luas.
2. **Fase 3**: atlas de galáxias, nebulosas, estrelas e exoplanetas (NASA Exoplanet Archive), com galerias.
3. **Fase 4**: planetário com constelações (o catálogo de estrelas já está incluído), linha temporal do Universo, área de missões.
4. **Fase 5**: inglês e espanhol, mais testes de interface, otimização das texturas (KTX2).

## Créditos

Ver [CREDITS.md](CREDITS.md).
