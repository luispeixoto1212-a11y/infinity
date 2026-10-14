# Universe Infinity

Atlas científico interativo para explorar o Universo em 3D. Esta versão cobre a **Fase 1 (fundação)**, a **Fase 2 (Sistema Solar)** e a **Fase 3 (espaço profundo e exoplanetas)**: uma vista 3D com as posições reais dos planetas e de 21 luas na data atual, fichas científicas com fontes para 32 objetos do Sistema Solar, os 110 objetos Messier com um mapa do céu interativo, 509 estrelas com o diagrama H–R, buracos negros notáveis, o catálogo completo de exoplanetas do NASA Exoplanet Archive e uma página que explica os métodos e valida os cálculos.

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
| `npm run test:e2e` | Testes de interface num navegador real (Playwright). Na primeira vez: `npx playwright install chromium` |
| `npm run test:all` | Tipos, testes unitários e testes de interface |

Não são precisas chaves de API. A galeria de fotografias usa a API pública da NASA Image and Video Library, que não pede chave; se estiveres sem ligação, a ficha continua a funcionar e mostra uma mensagem clara.

## O que já funciona

**Exploração 3D (página inicial)**
- Sol, 8 planetas, Plutão e Ceres nas posições calculadas para a data simulada, com texturas reais (Solar System Scope, CC BY 4.0).
- 21 luas: a Lua, Fobos e Deimos, as quatro galileanas, sete de Saturno (incluindo Titã e Encélado), as cinco grandes de Úrano, Tritão e Caronte. Aparecem com as suas órbitas quando a câmara se aproxima do planeta, com mapas reais da NASA e rotação síncrona (mostram sempre a mesma face ao planeta).
- Lista de objetos agrupada por planeta, com as luas de cada um num grupo que abre e fecha.
- Cerca de 5000 estrelas reais do Yale Bright Star Catalogue como fundo, com cor estimada a partir do índice B−V.
- Câmara com rodar, aproximar e deslocar (rato, teclado e toque); voo suave até cada objeto, que fica seguido enquanto se move.
- Seleção por clique, toque ou etiqueta; painel com distâncias atuais ao Sol e à Terra (e, nas luas, ao planeta) e tempo de viagem da luz.
- Controlo do tempo: pausar, sete velocidades (tempo real a 1 ano/s), sentido inverso, voltar a "Agora".
- Órbitas e etiquetas configuráveis, três perspetivas, recentrar, ecrã inteiro, qualidade gráfica automática/alta/reduzida.
- Orientação dos eixos e rotação segundo o modelo da IAU: o lado iluminado da Terra corresponde à hora real.
- Anéis de Saturno (com as dimensões da NASA) e os dez anéis principais de Úrano.

**Fichas científicas** (`#/objeto/<nome>`)
- Modelo 3D interativo com a inclinação do eixo, dados com unidades, tipo de valor (medido, calculado, médio, estimativa) e fonte em cada linha.
- Atmosfera com composição por volume, estrutura interna, luas (contagem com data de referência e diâmetros do JPL), anéis, características, descobertas, missões e comparação com a Terra.
- Fichas para as 20 luas principais além da nossa: diâmetro, massa e gravidade calculados a partir dos parâmetros do JPL, densidade, distância ao planeta, período orbital, inclinação face ao equador do planeta, temperatura (quando a NASA a indica), atmosfera de Titã, estrutura interna e missões.
- Fotografias obtidas em tempo real da NASA, com título, data e crédito da própria fonte.

**Exoplanetas** (`#/exoplanetas`)
- Os 6445 planetas confirmados do NASA Exoplanet Archive (tabela PSCompPars, versão de 13/10/2026), com contagem de sistemas e o planeta mais próximo.
- Número de planetas por método de descoberta, com a explicação de cada método.
- Gráfico de descobertas por ano (colunas empilhadas por método, com valores ao passar o cursor e vista em tabela).
- Diagrama período orbital × raio (escalas logarítmicas) com os planetas do Sistema Solar como referência; clicar num ponto abre a ficha.
- Catálogo completo com pesquisa (nome, estrela ou designação alternativa), filtro por método, ordenação e páginas.
- Ficha de cada exoplaneta (`#/exoplaneta/<nome>`): massa, raio, período, semieixo maior, excentricidade, energia recebida, temperatura de equilíbrio e distância, cada valor marcado como medido, estimado ou calculado; animação das órbitas do sistema à escala, com a faixa entre o fluxo de Vénus e o de Marte e comparação opcional com o Sistema Solar interior; comparação de tamanho com a Terra e Júpiter; dados da estrela; planetas do sistema; descoberta e fontes.
- 11 exoplanetas em destaque com textos baseados em páginas da NASA (Proxima Centauri b, TRAPPIST-1 e, 51 Pegasi b, K2-18 b, WASP-39 b, 55 Cancri e, entre outros).

**Espaço profundo** (`#/espaco-profundo`, `#/estrelas`, `#/buracos-negros`)
- Os 110 objetos Messier: posições, tipos, tamanhos aparentes e magnitudes do OpenNGC; distâncias e descrições das páginas do NASA Hubble Messier Catalog (89 objetos) e, para 13 enxames abertos, distâncias da Gaia (Cantat-Gaudin et al. 2020).
- Mapa do céu interativo (projeção de Hammer–Aitoff): constelações com nomes portugueses, eclíptica, estrelas até à magnitude 4,5, Via Láctea e os objetos Messier coloridos por tipo; aproximar, deslocar, filtrar por tipo e abrir a ficha com um clique.
- Catálogo em cartões ou tabela, com filtros e ordenação; ficha de cada objeto com dados e fontes por linha, tamanho no céu comparado com a Lua cheia, tamanho real aproximado (calculado), localização no mapa do céu e fotografias da NASA.
- Estrelas (AT-HYG v3.2): as 460 com nome próprio aprovado pela IAU e todas as conhecidas a menos de 20 anos-luz; as mais brilhantes e as mais próximas, pesquisa por nome, designação ou número de catálogo, e diagrama de Hertzsprung–Russell com 21 402 estrelas a menos de 100 parsecs.
- Ficha de cada estrela: distância (Gaia DR3 ou Hipparcos), magnitudes, tipo espectral explicado, cor, temperatura e luminosidade estimadas, posição no diagrama H–R.
- Buracos negros: Sagitário A*, M87*, Cygnus X-1, Gaia BH1, Gaia BH3 e GW150914, com massa, distância e fontes, e a escala dos horizontes (raio de Schwarzschild calculado).

**Planetário** (`#/planetario`)
- O céu visto de qualquer lugar da Terra, a qualquer data e hora entre 1800 e 2050: 5044 estrelas (até à magnitude 6), linhas, nomes e limites oficiais das 88 constelações, Via Láctea, objetos Messier, Sol, Lua (com a fase desenhada) e planetas.
- Vista em cúpula (céu inteiro, norte em cima e este à esquerda) ou virada para o horizonte; arrastar, aproximar com a roda ou dois dedos, teclado (setas, + e −), botões N, E, S, O e zénite, ecrã inteiro.
- 33 lugares predefinidos (cidades portuguesas, países lusófonos, observatórios, polos), coordenadas personalizadas ou a localização do dispositivo; data e hora na hora local do lugar, com fuso horário e mudança de hora corretos.
- Tempo real, passos de ±1 h e ±1 dia, animação até 1 dia sideral por segundo e sentido inverso.
- Comparação lado a lado de dois lugares no mesmo instante (por exemplo, Lisboa e Rio de Janeiro).
- Camadas configuráveis (grelhas altazimutal e equatorial, eclíptica, chão, atmosfera) e magnitude limite com predefinições para cidade, subúrbios e campo escuro; com a atmosfera ligada, o céu de dia e o crepúsculo escondem as estrelas mais ténues.
- Clicar num astro mostra altura (com refração), azimute, magnitude, distância, fase, constelação, coordenadas e horas de nascer, passagem meridiana e ocaso, com ligação para a ficha.
- "Esta noite": pôr e nascer do Sol, noite astronómica, fase da Lua e próximas fases, e para a Lua e cada planeta a posição atual, a magnitude, a constelação e a janela de visibilidade da noite.
- Botões "Ver no céu" nas fichas dos planetas, da Lua, do Sol, das estrelas e dos objetos Messier.

**Missões espaciais** (`#/missoes`)
- 36 missões, de Sputnik 1 (1957) ao Dragonfly (lançamento previsto para 2028): Apollo 11, Artemis II e III, Voyager 1 e 2, Viking, Galileo, Cassini–Huygens, Spirit e Opportunity, Curiosity, Perseverance e Ingenuity, Juno, New Horizons, BepiColombo, JUICE, Europa Clipper, Rosetta, Dawn, Hayabusa2, OSIRIS-REx/APEX, DART, Hera, Lucy, Psyche, Tianwen-2, Chandrayaan-3, Chang'e 6, Hubble, James Webb, Kepler, Gaia, Roman e Parker Solar Probe, entre outras.
- Linha do tempo interativa (1957–2036), com o planeado a tracejado, filtros por tipo e estado e pesquisa.
- Ficha de cada missão: objetivos, agências, foguetão, destino, cronologia (com os acontecimentos previstos assinalados), instrumentos, descobertas, ligações às fichas dos planetas e luas, fontes oficiais e fotografias da NASA.
- Estado atual verificado a 14/10/2026, com a fonte e a data de cada verificação; quando não foi possível confirmar (Juno), a ficha diz isso.

**Linha temporal do Universo** (`#/linha-temporal`)
- 54 acontecimentos, da era de Planck à Artemis II: Universo primordial, primeiras estrelas e galáxias (incluindo as mais distantes confirmadas pelo James Webb), Via Láctea, Sistema Solar e Terra, etapas da vida, história da astronomia (com Pedro Nunes) e exploração espacial.
- Três escalas com zoom e deslocamento (rato, toque e teclado): primeiros instantes (logarítmica desde o Big Bang), história completa (logarítmica antes do presente) e proporções reais (linear).
- Cada acontecimento indica se a data é medida, estimada, prevista por um modelo ou um registo histórico, com fonte, tempo desde o Big Bang, tempo antes do presente e posição no calendário cósmico.
- Explicação da diferença entre idade do Universo, tempo de viagem da luz e distância, com uma calculadora cosmológica (ΛCDM do Planck 2018): para um desvio para o vermelho dá a idade do Universo na emissão, o tempo de viagem da luz e as distâncias hoje, na emissão e de luminosidade.

**Asteroides e cometas** (`#/asteroides-e-cometas`, a partir do Sistema Solar)
- 26 pequenos corpos: asteroides visitados por sondas (Vesta, Eros, Itokawa, Ryugu, Bennu, Didymos, Psique, Pátroclo), próximos da Terra (Apophis, Faetonte), transneptunianos e planetas anões (Arrokoth, Éris, Haumea, Makemake, Sedna), cometas (Halley, Encke, Tempel 1, 67P, Wild 2, Swift–Tuttle, Hale–Bopp) e os três visitantes interestelares (ʻOumuamua, 2I/Borisov e 3I/ATLAS).
- Órbitas a partir de elementos osculadores do JPL Horizons em várias épocas (de 20 em 20 anos entre 1806 e 2046; de 5 em 5 anos entre 1991 e 2041 nos corpos com encontros próximos com planetas; à volta do periélio nos interestelares), propagadas como problema de dois corpos (elíptico ou hiperbólico) e validadas contra posições do Horizons.
- Fichas com distância ao Sol e à Terra hoje, mapa da órbita com os planetas, elementos da órbita, próxima passagem pelo periélio, dados físicos da JPL Small-Body Database com a referência original de cada valor, descoberta, missões (com ligação às fichas de missão) e precisão da posição.
- Camada opcional na vista 3D (botão do cometa ou tecla A), com órbitas e etiquetas que abrem a ficha.

**Fenómenos extremos** (`#/fenomenos-extremos`, no separador do Espaço profundo)
- Dez temas: formação dos buracos negros, horizonte de acontecimentos, disco de acreção, ondas gravitacionais, lentes gravitacionais, estrelas de neutrões e pulsares, supernovas, quasares, matéria escura e energia escura.
- Cada tema explicado em três níveis (iniciante, intermédio, avançado, com as equações), números-chave marcados como medidos, calculados ou estimados, e fontes (artigos científicos).
- Visualizações calculadas: horizonte, esfera de fotões, dilatação do tempo e marés para qualquer massa (da Terra a M87*); lente gravitacional pontual traçada píxel a píxel; expansão do Universo com e sem energia escura. Visualizações ilustrativas, assinaladas como tal: disco de acreção, fusão de buracos negros com o sinal "chirp", pulsar e curva de rotação de uma galáxia.
- As animações param fora do ecrã e respeitam a opção "reduzir movimento" do sistema.

**Ferramentas**
- Pesquisa global (Ctrl K ou `/`) com resultados enquanto se escreve, que também encontra missões e conceitos científicos, nomes em português, inglês e espanhol, tolerância a acentos e pequenos erros, e opção "Ver no espaço". Inclui os objetos Messier, as estrelas com nome e os 6445 exoplanetas (índices leves carregados só quando a pesquisa abre).
- Favoritos e histórico guardados no navegador, sem conta.
- Lista do Sistema Solar, tabela das luas principais e comparação de tamanhos reais à mesma escala.
- Página "Dados e métodos" com a validação das posições dos planetas, das luas e do planetário contra o JPL Horizons, calculada no próprio navegador.
- Atalhos de teclado (prima `?` na vista 3D).

## Rigor científico

- **Posições**: Tabela 1 de E. M. Standish (JPL), válida de 1800 a 2050; a simulação para nesses limites. Plutão e Ceres usam elementos osculadores do JPL Small-Body Database; a Lua usa a teoria ELP-2000/82 truncada de Meeus (cap. 47), com diferenças de 9″ a 22″ face ao Horizons entre 2000 e 2030.
- **Luas**: órbitas ajustadas a vetores do JPL Horizons (época 2026-10-13; movimento médio ajustado a 2025-09-08 e 2027-10-13, contando as voltas com o período sideral publicado). Verificação independente em 2026-03-27 e 2028-10-13 (datas fora do ajuste): 14 das 20 luas ficam abaixo de 1° nas duas datas; as restantes são Fobos (5,4°), Mimas (4,9°), Miranda (3,1°), Europa (2,3°), Tétis (2,1°) e Encélado (1,6°). As posições das luas são indicativas para datas distantes.
- **Validação**: para 2026-10-13, as diferenças face ao Horizons (DE441) vão de 1″ (Úrano) a 266″ (Saturno), dentro dos erros indicados pelo JPL, exceto Neptuno (32″ contra 10″ indicados) e a distância de Mercúrio (~1200 km contra 1000 km). Isto está documentado na aplicação e nos testes.
- **Planetário**: precessão IAU 1976, tempo sideral de Meeus (eq. 12.4), latitude geodésica WGS84, tempo de luz, Terra separada do baricentro Terra–Lua, paralaxe da Lua e refração de Sæmundsson; sem nutação nem aberração (≤ 20″). Comparado com o JPL Horizons em 2000–2030: Sol, Lua, Mercúrio, Vénus, Marte, Úrano e Neptuno a menos de 35″, Júpiter a menos de 90″ e Saturno a menos de 5′ (erros da Tabela 1 do JPL); azimute e altura da Lua e do Sol em Lisboa a menos de 10″; nascer e ocaso a menos de 2 minutos; magnitudes dos planetas a menos de 0,15. As constelações usam os limites oficiais da IAU testados no equinócio de 1875 e coincidem com o catálogo AT-HYG nas 509 estrelas verificadas. As cores do céu, o brilho do crepúsculo e o tamanho dos astros no ecrã são ilustrativos e estão assinalados.
- **Exoplanetas**: valores do NASA Exoplanet Archive sem alterações (só arredondados a 5 algarismos significativos). Como a cópia usada não indica quais raios e massas o arquivo calculou pela relação massa–raio, só são tratados como medidos os valores com incerteza publicada; o raio de planetas fotografados diretamente é sempre estimativa. A energia recebida (S = L / a²) e a luminosidade da estrela (L = R² (T / 5772 K)⁴) são calculadas e marcadas como tal.
- **Espaço profundo e estrelas**: as páginas da NASA dos objetos Messier foram transcritas duas vezes, de forma independente, e coincidem nos 89 objetos; as distâncias das estrelas foram comparadas com paralaxes do Hipparcos consultadas diretamente (21 estrelas) e 16 exoplanetas com consultas diretas à API do NASA Exoplanet Archive. O tamanho real dos objetos, a temperatura e a luminosidade das estrelas e o raio dos horizontes dos buracos negros são calculados e marcados como tal; a Via Láctea do mapa do céu é ilustrativa.
- **Escala**: a vista 3D mostra direções reais, mas distâncias comprimidas e tamanhos ampliados. A escala está identificada no ecrã e explicada em "Dados e métodos".
- **Dados**: fichas da NASA NSSDCA e parâmetros do JPL, com data de atualização e de consulta. Valores calculados pela aplicação estão marcados como tal. A densidade de Caronte é calculada a partir do GM e do raio, porque o valor da tabela do JPL (1,853 g/cm³) não é coerente com esses dois números (dariam cerca de 1,70 g/cm³).
- **Representações ilustrativas**: Ceres aparece com cor uniforme (sem textura com licença verificada); a superfície de Vénus vem de radar com cores ilustrativas; nos mapas das luas, as zonas que nenhuma sonda fotografou têm um tom neutro uniforme; Fobos e Deimos, muito irregulares, são desenhados como esferas. Tudo isto está assinalado.

## Arquitetura

- **React 19 + TypeScript + Vite**, com **Three.js** usado diretamente (sem React Three Fiber). Motivo: o motor 3D é uma classe independente da interface, mais fácil de testar e com controlo explícito da libertação de recursos WebGL.
- Sem dependências além de React e Three.js: router por hash, store reativa e i18n são pequenos módulos próprios.
- As secções com 3D são carregadas só quando necessárias (divisão do código); as texturas carregam primeiro em 512 px e depois em 2048 px.

```
src/
  app/            Estrutura, barra superior, router por hash, tratamento de erros
  core/astro/     Tempo (UTC→TDB), Kepler, Lua (ELP-2000/82), órbitas das luas, orientação IAU, escala da cena, cosmologia ΛCDM,
                  precessão, céu local (tempo sideral, horizonte, refração, magnitudes, nascer e ocaso),
                  constelação de uma direção
  core/           Formatação pt-PT, armazenamento local seguro, store
  data/           Catálogo de objetos (planetas, planetas anões, luas), fontes,
                  órbitas das luas e vetores de validação do Horizons
  features/
    explorer/     Vista 3D: motor (engine/), painel, tempo, barra de vista, lista
    body/         Fichas: globo 3D, tabela de dados, atmosfera, comparação, galeria
    search/       Índice e diálogo de pesquisa
    solar-system/ Lista e comparação de tamanhos
    favorites/    Favoritos e histórico
    about/        Dados e métodos
  i18n/           Textos da interface (pt-PT; preparado para en e es)
  features/exoplanets/  Catálogo, gráficos, vista das órbitas e fichas dos exoplanetas
  features/deepsky/     Objetos Messier, mapa do céu, buracos negros
  features/stars/       Catálogo de estrelas, diagrama H–R e fichas
  features/planetarium/ Planetário: lugares e fusos, estado do céu, desenho em Canvas 2D, painéis
  features/missions/    Missões espaciais: dados verificados, linha do tempo, fichas
  features/timeline/    Linha temporal do Universo e calculadora cosmológica
  features/extreme/     Fenómenos extremos: textos em três níveis e visualizações
  services/       Cliente da NASA Image and Video Library
public/
  textures/       Texturas (512 px e 2048 px)
  data/stars.json Catálogo de estrelas processado
  data/exoplanets.json, data/exoplanet-index.json  Exoplanetas (NASA Exoplanet Archive)
  data/deepsky.json                Objetos Messier (OpenNGC + NASA + Gaia)
  data/star-catalog.json, data/hr-diagram.json   Estrelas (AT-HYG)
  data/sky-map.json, data/milky-way.png          Constelações e Via Láctea (d3-celestial)
  data/constellation-bounds.json                 Limites oficiais das constelações (IAU, via d3-celestial)
scripts/
  build_exoplanets.py  Regenera os dados dos exoplanetas a partir da cópia diária do arquivo
  build_deepsky.py     Regenera os objetos Messier (OpenNGC + transcrições em scripts/data/)
  build_stars.py       Regenera as estrelas a partir do AT-HYG
  build_skymap.py      Regenera as constelações, os seus limites e a Via Láctea a partir do d3-celestial
```

### Atualizar os exoplanetas

```bash
git clone --depth 1 https://github.com/OpenExoplanetCatalogue/oec_gzip /tmp/oec_gzip
python3 scripts/build_exoplanets.py /tmp/oec_gzip
```

O script lê `systems-exoplanetarchive.xml.gz` (cópia noturna da tabela PSCompPars do NASA Exoplanet Archive) e reescreve os dois ficheiros em `public/data/`. Os testes verificam a contagem total: ao atualizar, ajuste o número esperado em `src/features/exoplanets/exoplanets.test.ts`.

### Acrescentar uma língua

Criar `src/i18n/en.ts` com o mesmo formato de `pt-PT.ts`, registá-lo em `src/i18n/index.ts` e preencher os campos `en` dos textos científicos em `src/data/`. O seletor de língua só deve ser ativado com a tradução completa.

## Testes

- `npm test` corre 247 testes unitários (incluindo a propagação das órbitas de 26 asteroides e cometas comparada com 105 posições do JPL Horizons, incluindo a coerência das 36 missões, a cosmologia — idade do Planck, solução analítica, distância ao último espalhamento — e a ordem cronológica da linha temporal). Os do planetário comparam com o JPL Horizons o tempo sideral, a Lua em cinco datas, o Sol e os planetas em duas datas (posição, distância, fase e magnitude), o azimute e a altura em Lisboa e em Sydney e as horas de nascer, passagem e ocaso, e verificam os exemplos de Meeus para a precessão e o tempo sideral, a constelação das 509 estrelas com nome, os fusos horários (incluindo a mudança de hora), a projeção, as noites brancas e a noite polar. Os restantes cobrem: escalas de tempo, equação de Kepler, posições dos planetas e das luas comparadas com o JPL Horizons, períodos das luas face aos publicados, Lua, orientação IAU, escala da cena (incluindo as luas fora dos anéis), coerência do catálogo, existência das texturas, catálogo de exoplanetas (contagens, valores de referência das páginas da NASA, distinção medido/estimado, luminosidade, fluxo e terceira lei de Kepler, pesquisa e ordenação, e comparação com consultas diretas à API do arquivo), objetos Messier (distâncias da NASA e da Gaia, ordenação, tamanho real), projeção do mapa do céu (ida e volta, corte na margem, eclíptica), estrelas (distâncias comparadas com as paralaxes do Hipparcos consultadas diretamente, tipos espectrais, temperatura, luminosidade, pesquisa), buracos negros (raio de Schwarzschild), pesquisa global, formatação pt-PT, router, cliente da NASA e armazenamento local.
- `npm run test:e2e` corre 44 testes de interface no Chromium (pasta `e2e/`), sobre a versão de produção: arranque da vista 3D, menu "Mais", pesquisa global (planetas, missões e conceitos), rota inválida, ficha de Marte com favoritos e ligação ao planetário, planetário (painel "Esta noite", mudança de data, alvo vindo de uma ficha, comparação de lugares, animação, teclado), espaço profundo, estrelas, buracos negros, exoplanetas, missões (filtros e ficha), linha temporal (escalas e calculadora), fenómenos extremos, asteroides e cometas (lista, ficha e camada 3D) e página de métodos. Inclui uma verificação automática de acessibilidade (axe-core, WCAG 2.1 A e AA) em 14 páginas, a ausência de deslocamento horizontal em telemóvel em 12 páginas e falha se houver erros na consola. As fontes externas são bloqueadas e a API da NASA é simulada, para os testes não dependerem da rede.

## Publicar no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` publica o site. Para o usar:
1. No repositório, abre **Settings → Pages** e escolhe **GitHub Actions** como origem.
2. Em **Actions**, corre o workflow "Publicar no GitHub Pages".

O workflow `ci.yml` verifica tipos, testes unitários e build em cada push e, a seguir, corre os testes de interface no Chromium.

## Próximos passos

1. **Espaço profundo (complementos)**: mais objetos além do catálogo Messier (Nuvens de Magalhães, Carina, Hélice, pulsares).
2. **Fase 5**: tutorial inicial, desempenho, inglês e espanhol.
3. **Sistema Solar (complementos)**: sombras e eclipses, formas irregulares dos pequenos corpos em 3D.

## Créditos

Ver [CREDITS.md](CREDITS.md).
