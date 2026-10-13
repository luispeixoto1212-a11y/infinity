/**
 * Registo central de fontes. Cada valor apresentado na aplicação aponta para uma destas entradas.
 * "accessed" é a data em que a fonte foi consultada para esta versão; "updated" é a data de
 * atualização indicada pela própria fonte, quando existe.
 */

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  accessed: string;
  updated?: string;
  license?: string;
  note?: string;
}

const ACCESSED = '2026-10-13';

const list = [
  {
    id: 'nasa-factsheet',
    title: 'Planetary Fact Sheet (métrico)',
    publisher: 'NASA NSSDCA (D. R. Williams)',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
    accessed: ACCESSED,
    updated: '2025-03-18',
  },
  {
    id: 'nasa-sun',
    title: 'Sun Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html',
    accessed: ACCESSED,
    updated: '2024-05-09',
  },
  {
    id: 'nasa-mercury',
    title: 'Mercury Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html',
    accessed: ACCESSED,
    updated: '2024-01-11',
  },
  {
    id: 'nasa-venus',
    title: 'Venus Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html',
    accessed: ACCESSED,
    updated: '2024-01-11',
  },
  {
    id: 'nasa-earth',
    title: 'Earth Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
    accessed: ACCESSED,
    updated: '2024-11-15',
  },
  {
    id: 'nasa-moon',
    title: 'Moon Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    accessed: ACCESSED,
    updated: '2024-01-11',
  },
  {
    id: 'nasa-mars',
    title: 'Mars Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    accessed: ACCESSED,
    updated: '2025-05-19',
  },
  {
    id: 'nasa-jupiter',
    title: 'Jupiter Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html',
    accessed: ACCESSED,
    updated: '2024-10-02',
  },
  {
    id: 'nasa-saturn',
    title: 'Saturn Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html',
    accessed: ACCESSED,
    updated: '2025-03-18',
  },
  {
    id: 'nasa-saturn-rings',
    title: 'Saturnian Rings Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html',
    accessed: ACCESSED,
    updated: '2022-04-19',
  },
  {
    id: 'nasa-uranus',
    title: 'Uranus Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html',
    accessed: ACCESSED,
    updated: '2024-10-02',
  },
  {
    id: 'nasa-uranus-rings',
    title: 'Uranian Rings Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranringfact.html',
    accessed: ACCESSED,
    updated: '2015-10-14',
  },
  {
    id: 'nasa-neptune',
    title: 'Neptune Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html',
    accessed: ACCESSED,
    updated: '2024-10-03',
  },
  {
    id: 'nasa-pluto',
    title: 'Pluto Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html',
    accessed: ACCESSED,
    updated: '2024-01-11',
  },
  {
    id: 'nasa-asteroids',
    title: 'Asteroid Fact Sheet',
    publisher: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/asteroidfact.html',
    accessed: ACCESSED,
    updated: '2019-09-27',
    note: 'Os elementos orbitais desta tabela referem-se à época JD 2457400.5 (2016-01-13).',
  },
  {
    id: 'jpl-approx',
    title: 'Approximate Positions of the Planets (Tabela 1, 1800–2050)',
    publisher: 'NASA/JPL Solar System Dynamics (E. M. Standish)',
    url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
    accessed: ACCESSED,
  },
  {
    id: 'jpl-sbdb',
    title: 'Small-Body Database: 1 Ceres e 134340 Plutão (elementos osculadores)',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html',
    accessed: ACCESSED,
  },
  {
    id: 'jpl-sat-discovery',
    title: 'Planetary Satellite Discovery Circumstances',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/sats/discovery.html',
    accessed: ACCESSED,
    note: 'Lista 460 satélites (exclui a Lua): Marte 2, Júpiter 115, Saturno 293; Úrano, Neptuno e Plutão somam 50.',
  },
  {
    id: 'jpl-sat-phys',
    title: 'Planetary Satellite Physical Parameters',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/sats/phys_par/',
    accessed: ACCESSED,
  },
  {
    id: 'jpl-sat-elem',
    title: 'Planetary Satellite Mean Elements',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/sats/elem/',
    accessed: ACCESSED,
    note: 'Períodos siderais usados para contar as voltas no ajuste das órbitas das luas de Saturno (para Fobos e Deimos, a ficha de Marte da NASA).',
  },
  {
    id: 'nasa-3d-resources',
    title: 'NASA 3D Resources: mapas das luas e de Plutão',
    publisher: 'NASA (Ames, JPL e outros centros)',
    url: 'https://github.com/nasa/NASA-3D-Resources',
    accessed: ACCESSED,
    license: 'Sem direitos de autor (diretrizes de media da NASA)',
    note: 'Zonas sem imagens (preenchidas a negro no original) receberam um tom neutro uniforme.',
  },
  {
    id: 'horizons-moons',
    title: 'Horizons System: vetores das luas em relação ao planeta (2025–2028)',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/horizons/',
    accessed: ACCESSED,
    note: 'Ajuste com 2025-09-08, 2026-10-13 e 2027-10-13; verificação com 2026-03-27 e 2028-10-13. Efemérides MAR099, JUP365, SAT441, URA184, NEP098 e PLU060, conforme indicado pelo Horizons.',
  },
  {
    id: 'nasa-io',
    title: 'Io',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/jupiter/moons/io/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-europa',
    title: 'Europa',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/jupiter/moons/europa/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-ganymede',
    title: 'Ganymede',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/jupiter/moons/ganymede/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-callisto',
    title: 'Callisto',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/jupiter/moons/callisto/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-titan',
    title: 'Titan: factos',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/saturn/moons/titan/facts/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-enceladus',
    title: 'Enceladus',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/saturn/moons/enceladus/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-mimas',
    title: 'Mimas',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/saturn/moons/mimas/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-tethys',
    title: 'Tethys',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/saturn/moons/tethys/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-dione',
    title: 'Dione',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/saturn/moons/dione/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-rhea',
    title: 'Rhea',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/saturn/moons/rhea/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-iapetus',
    title: 'Iapetus',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/saturn/moons/iapetus/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-phobos',
    title: 'Phobos',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/mars/moons/phobos/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-deimos',
    title: 'Deimos',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/mars/moons/deimos/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-miranda',
    title: 'Miranda',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/uranus/moons/miranda/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-uranus-moons',
    title: 'Uranus Moons',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/uranus/moons/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-triton',
    title: 'Triton',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/neptune/moons/triton/',
    accessed: ACCESSED,
  },
  {
    id: 'nasa-charon',
    title: 'Charon',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/dwarf-planets/pluto/moons/charon/',
    accessed: ACCESSED,
  },
  {
    id: 'webb-uranus-moon',
    title: 'Webb descobre um novo satélite de Úrano (S/2025 U1)',
    publisher: 'NASA/ESA/CSA Webb — notícia de agosto de 2025',
    url: 'https://www.astronomy.com/science/webb-spots-a-new-tiny-moon-orbiting-uranus/',
    accessed: ACCESSED,
  },
  {
    id: 'naif-pck',
    title: 'PCK pck00011.tpc — orientação e rotação (IAU WGCCRE 2015, Archinal et al. 2018)',
    publisher: 'NASA/JPL NAIF',
    url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',
    accessed: ACCESSED,
  },
  {
    id: 'meeus',
    title: 'Astronomical Algorithms, 2.ª ed., cap. 47 (elementos médios da Lua)',
    publisher: 'J. Meeus, Willmann-Bell (1998)',
    url: 'https://search.worldcat.org/search?q=Astronomical+Algorithms+Meeus',
    accessed: ACCESSED,
  },
  {
    id: 'jpl-horizons',
    title: 'Horizons System (DE441) — vetores usados para validar os cálculos',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/horizons/',
    accessed: ACCESSED,
  },
  {
    id: 'esa-bepicolombo',
    title: 'BepiColombo — chegada a Mercúrio',
    publisher: 'Space.com (com base em comunicados da ESA)',
    url: 'https://www.space.com/bepicolombo-thruster-issues-mercury-arrival-delay-2026',
    accessed: ACCESSED,
  },
  {
    id: 'sss-textures',
    title: 'Texturas planetárias Solar System Scope',
    publisher: 'INOVE / Solar System Scope (cópias incluídas nos exemplos do Qt 3D)',
    url: 'https://www.solarsystemscope.com/textures/',
    accessed: ACCESSED,
    license: 'CC BY 4.0',
    note: 'Baseadas em dados e imagens da NASA. Os anéis de Saturno foram adaptados para um perfil radial.',
  },
  {
    id: 'bsc',
    title: 'Yale Bright Star Catalogue, 5.ª ed. (via d3-celestial)',
    publisher: 'Hoffleit & Warren (1991); dados preparados por O. Frohn',
    url: 'https://github.com/ofrohn/d3-celestial',
    accessed: ACCESSED,
    license: 'BSD-3-Clause (d3-celestial)',
  },
  {
    id: 'nasa-images',
    title: 'NASA Image and Video Library (API pública)',
    publisher: 'NASA',
    url: 'https://images.nasa.gov/',
    accessed: ACCESSED,
    license: 'Diretrizes de utilização de media da NASA',
  },
] as const satisfies readonly Source[];

export type SourceId = (typeof list)[number]['id'];

export const SOURCES: Record<SourceId, Source> = Object.fromEntries(list.map((s) => [s.id, s])) as Record<
  SourceId,
  Source
>;

export const ALL_SOURCES: readonly Source[] = list;
