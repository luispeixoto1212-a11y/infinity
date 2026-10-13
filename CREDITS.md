# Créditos e licenças

## Texturas planetárias

**Solar System Scope** — <https://www.solarsystemscope.com/textures/>
Licença: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
Baseadas em dados de elevação e imagens da NASA.

Ficheiros em `public/textures/` (Sol, Mercúrio, Vénus, Terra, Lua, Marte, Júpiter, Saturno, Úrano, Neptuno, nuvens e mapas de relevo da Terra, Lua, Marte, Mercúrio e Vénus). Obtidos a partir das cópias incluídas nos exemplos do Qt 3D (`examples/qt3d/planets-qml/images/solarsystemscope`), com a mesma licença.

Alterações feitas para esta aplicação: redimensionamento (2048 e 512 px), conversão das nuvens da Terra num mapa de transparência e conversão da textura dos anéis de Saturno num perfil radial.

## Mapas das luas e de Plutão

**NASA 3D Resources** — <https://github.com/nasa/NASA-3D-Resources> (pasta *Images and Textures*).
Material da NASA sem direitos de autor, usado segundo as [diretrizes de media da NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/); a NASA não endossa esta aplicação.

Mapas de Io, Europa, Ganimedes, Calisto, Mimas, Encélado, Tétis, Dione, Reia, Titã, Jápeto, Fobos, Deimos, Miranda, Ariel, Umbriel, Titânia, Oberon, Tritão, Caronte e Plutão, baseados em imagens das sondas Voyager, Galileo, Cassini, Viking e New Horizons.

Alterações feitas para esta aplicação: redimensionamento (até 1024 px e 512 px) e, em Io, nas luas de Úrano e em Tritão, as zonas que nenhuma sonda fotografou (a negro no original) foram preenchidas com um tom neutro uniforme. O hemisfério escuro de Jápeto é real e foi mantido.

## Catálogo de estrelas

**Yale Bright Star Catalogue, 5.ª edição** (Hoffleit & Warren, 1991), na versão preparada pelo projeto **d3-celestial** de Olaf Frohn — <https://github.com/ofrohn/d3-celestial>.
Licença BSD-3-Clause; o texto completo está em `public/data/LICENSE-d3-celestial.txt`.

## Dados científicos

- NASA NSSDCA — Planetary Fact Sheets (D. R. Williams).
- NASA/JPL Solar System Dynamics — Approximate Positions of the Planets, Small-Body Database, Planetary Satellite Discovery Circumstances, Planetary Satellite Physical Parameters, Planetary Satellite Mean Elements, Horizons (vetores dos planetas e das luas).
- NASA Science — páginas de cada lua (descrições, temperaturas e missões).
- NASA/JPL NAIF — PCK pck00011.tpc (modelo de orientação da IAU WGCCRE 2015, Archinal et al. 2018).
- J. Meeus, *Astronomical Algorithms*, 2.ª ed. (elementos médios da Lua).

A lista completa, com datas de consulta, está na página "Dados e métodos" da aplicação e em `src/data/sources.ts`.

## Exoplanetas

**NASA Exoplanet Archive** — tabela Planetary Systems Composite Parameters (PSCompPars), <https://exoplanetarchive.ipac.caltech.edu/>.
*This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.*

A cópia usada (13/10/2026) é a distribuída diariamente pelo **Open Exoplanet Catalogue** em <https://github.com/OpenExoplanetCatalogue/oec_gzip> (licença MIT, © 2014 Open Exoplanet Catalogue). Conversão para JSON por `scripts/build_exoplanets.py`, sem alteração de valores.

Os textos dos exoplanetas em destaque resumem páginas da NASA Science e do JPL, citadas em cada ficha.

## Fotografias

As fotografias das fichas são pedidas em tempo real à NASA Image and Video Library. Os títulos, datas e créditos vêm da própria API; cada imagem liga à página original, onde estão as condições de utilização.

## Tipos de letra

Cormorant Garamond e IBM Plex Sans, via Google Fonts (SIL Open Font License).
