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
- NASA/JPL Solar System Dynamics — Approximate Positions of the Planets, Small-Body Database (dados físicos e de descoberta dos asteroides e cometas, com a referência original de cada valor), Planetary Satellite Discovery Circumstances, Planetary Satellite Physical Parameters, Planetary Satellite Mean Elements, Horizons (vetores dos planetas e das luas; elementos osculadores e posições de validação dos asteroides e cometas).
- Asteroides e cometas: páginas da NASA Science (Éris, Haumea, Makemake, ʻOumuamua, 2I/Borisov, 3I/ATLAS, Hale–Bopp, missões), ESA (Giotto, Makemake), JAXA (Hayabusa) e os artigos citados em cada ficha (Sicardy et al. 2011; Ortiz et al. 2012 e 2017; Pál et al. 2012; Spencer et al. 2020).
- NASA Science — páginas de cada lua (descrições, temperaturas e missões).
- NASA/JPL NAIF — PCK pck00011.tpc (modelo de orientação da IAU WGCCRE 2015, Archinal et al. 2018).
- J. Meeus, *Astronomical Algorithms*, 2.ª ed. (1998): teoria da Lua ELP-2000/82 truncada (cap. 47), tempo sideral (cap. 12), precessão (cap. 21), refração (cap. 16), magnitudes dos planetas (cap. 41) e fases (cap. 48).
- J. H. Lieske et al. (1977), modelo de precessão IAU 1976; T. Sæmundsson (1986), fórmula da refração.

A lista completa, com datas de consulta, está na página "Dados e métodos" da aplicação e em `src/data/sources.ts`.

## Espaço profundo e estrelas

- **OpenNGC** (M. Verga e colaboradores) — <https://github.com/mattiaverga/OpenNGC>, licença [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Posições, tipos, dimensões e magnitudes dos objetos Messier e da maioria dos objetos para além do Messier. Os dados derivados em `public/data/deepsky.json` são distribuídos com a mesma licença.
- **NASA Hubble Messier Catalog** — <https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/>. Distâncias, nomes comuns e descrições (traduzidas e resumidas) de 89 objetos.
- **Para além do catálogo Messier** (consultado a 21/10/2026): NASA Hubble Caldwell Catalog (Caldwell 34, 63, 65, 77, 80, 92, 94, 103 e 106); NASA Webb (Anel do Sul, 2022; Cassiopeia A, 2023); NASA/JPL (SN 1987A, 2024); NASA/Chandra (pulsar de Vela; imagem de primeira luz de Cassiopeia A); ESA/Webb (weic2205a, weic2212a); ESA/Hubble (SN 1987A); STScI (Cabeça de Cavalo, 2024; Véu, 2015); Pietrzyński et al. 2019 (*Nature*) e Graczyk et al. 2020 (*ApJ*) para as Nuvens de Magalhães; Dodson et al. 2003 (*ApJ*) para a paralaxe do pulsar de Vela; Weisberg, Nice e Taylor 2010 (*ApJ* 722, 1030) e o comunicado do Prémio Nobel da Física de 1993 para o pulsar de Hulse–Taylor; NRAO e Linda Hall Library para a descoberta do primeiro pulsar; coordenadas de PSR B1919+21 e PSR B1913+16 do SIMBAD, como indicadas na Wikipédia. Textos resumidos e traduzidos; a fonte de cada valor está na ficha.
- **Cantat-Gaudin et al. 2020**, A&A 640, A1 (via VizieR, CDS) — distâncias de 13 enxames abertos a partir da Gaia DR2. *This research has made use of the VizieR catalogue access tool, CDS, Strasbourg, France.*
- **AT-HYG v3.2** (D. Nash / astronexus) — <https://github.com/astronexus/HYG-Database>, licença [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Estrelas, distâncias (Gaia DR3, Hipparcos, Gliese) e diagrama H–R. Os dados derivados em `public/data/star-catalog.json`, `public/data/hr-diagram.json` e `public/data/star-map.json` (mapa 3D) são distribuídos com a mesma licença.
- **Hipparcos, nova redução** (van Leeuwen 2007; VizieR I/311) — paralaxes usadas apenas para verificar as distâncias nos testes.
- **d3-celestial** (O. Frohn), BSD-3-Clause — linhas e posições das etiquetas das constelações e contorno da Via Láctea (`public/data/sky-map.json`, `public/data/milky-way.png`) e limites das constelações (`public/data/constellation-bounds.json`), estes de A. C. Davenhall e S. K. Leggett (1989), *Catalogue of Constellation Boundary Data*, VizieR VI/49, que reproduz os limites oficiais da IAU (E. Delporte, 1930).
- Buracos negros: NASA Science, Boston University, NASA Scientific Visualization Studio, Scientific American, ESA e Max Planck Institute for Gravitational Physics, citados em cada caso na página.

## Exoplanetas

**NASA Exoplanet Archive** — tabela Planetary Systems Composite Parameters (PSCompPars), <https://exoplanetarchive.ipac.caltech.edu/>.
*This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.*

A cópia usada (13/10/2026) é a distribuída diariamente pelo **Open Exoplanet Catalogue** em <https://github.com/OpenExoplanetCatalogue/oec_gzip> (licença MIT, © 2014 Open Exoplanet Catalogue). Conversão para JSON por `scripts/build_exoplanets.py`, sem alteração de valores.

Os textos dos exoplanetas em destaque resumem páginas da NASA Science e do JPL, citadas em cada ficha.

## Fotografias

As fotografias das fichas são pedidas em tempo real à NASA Image and Video Library. Os títulos, datas e créditos vêm da própria API; cada imagem liga à página original, onde estão as condições de utilização.

## Tipos de letra

Cormorant Garamond e IBM Plex Sans, via Google Fonts (SIL Open Font License).
