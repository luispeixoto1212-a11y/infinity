import { CERES_ELEMENTS, PLUTO_ELEMENTS } from '../../core/astro/elements';
import type { CelestialBody } from '../types';
import { DISTANCE_NOTE, ROTATION_NOTE, fact, pt } from './helpers';

export const ceres: CelestialBody = {
  id: 'ceres',
  slug: 'ceres',
  type: 'dwarf-planet',
  parent: 'sun',
  name: { 'pt-PT': 'Ceres', en: 'Ceres', es: 'Ceres' },
  aliases: ['Ceres', '1 Ceres', 'A801 AA', 'asteroide', 'cintura de asteroides'],
  symbol: '⚳',
  tagline: pt('O maior objeto da cintura de asteroides e o único planeta anão no Sistema Solar interior.'),
  description: [
    pt(
      'Ceres foi o primeiro objeto da cintura de asteroides a ser descoberto, em 1801. Classificado durante muito tempo como asteroide, é desde 2006 considerado um planeta anão: é massivo o suficiente para ter uma forma quase esférica, mas partilha a sua região orbital com muitos outros corpos.',
    ),
    pt(
      'A sonda Dawn revelou uma superfície rica em minerais formados em água e depósitos brilhantes de sais, sinal de que Ceres teve, e talvez ainda tenha, salmoura no interior.',
    ),
  ],
  meanRadiusKm: 469.7,
  facts: [
    fact('dimensions', '965 × 961 × 891', 'km', 'measured', 'nasa-asteroids', { note: pt('Dimensões dos três eixos.') }),
    fact('diameter', 939, 'km', 'derived', 'nasa-asteroids', {
      qualifier: '≈',
      note: pt('Calculado: média das três dimensões.'),
    }),
    fact('mass', 9.393e20, 'kg', 'estimate', 'nasa-asteroids', {
      scientific: true,
      digits: 4,
      note: pt('A tabela de asteroides da NASA avisa que as massas são, em geral, estimativas.'),
    }),
    fact('density', 2170, 'kg/m³', 'derived', 'nasa-asteroids', {
      qualifier: '≈',
      note: pt('Calculado: massa ÷ volume do elipsoide com as dimensões indicadas.'),
    }),
    fact('gravity', 0.28, 'm/s²', 'derived', 'nasa-asteroids', {
      qualifier: '≈',
      note: pt('Calculado: G·M ÷ R², com R = 469,5 km (metade do diâmetro médio).'),
    }),
    fact('semiMajorAxisAu', 2.768, 'AU', 'measured', 'nasa-asteroids'),
    fact('siderealRotation', 9.074, 'h', 'measured', 'nasa-asteroids', { note: ROTATION_NOTE }),
    fact('orbitalPeriod', 1680, 'd', 'derived', 'nasa-asteroids', {
      qualifier: '≈',
      note: pt('A fonte indica 4,60 anos.'),
    }),
    fact('inclination', 10.59, '°', 'measured', 'nasa-asteroids', { note: pt('Em relação à eclíptica.') }),
    fact('eccentricity', 0.0758, '', 'measured', 'nasa-asteroids'),
    fact('discovery', '1 de janeiro de 1801, Giuseppe Piazzi (Palermo)', '', 'measured', 'nasa-asteroids'),
  ],
  structure: {
    layers: [
      { name: pt('Crosta'), description: pt('Mistura de rocha, gelo e sais hidratados.') },
      { name: pt('Interior'), description: pt('Parcialmente diferenciado, com material rochoso mais denso em profundidade.') },
    ],
    note: pt('A presença atual de salmoura em profundidade é uma interpretação dos dados da Dawn, não uma observação direta.'),
  },
  moons: { count: 0, asOf: '2026-10-13', sourceId: 'nasa-asteroids', notable: [] },
  features: [
    pt('As manchas brilhantes da cratera Occator são depósitos de sais, sobretudo carbonato de sódio.'),
    pt('Ahuna Mons é uma montanha isolada interpretada como um criovulcão.'),
  ],
  discoveries: [pt('Em 2014, o observatório espacial Herschel detetou vapor de água libertado por Ceres.')],
  missions: [
    {
      name: 'Dawn',
      agency: 'NASA',
      when: pt('Em órbita de 2015 a 2018'),
      kind: 'orbiter',
      summary: pt('Primeira sonda a orbitar dois corpos diferentes: Vesta e, depois, Ceres.'),
    },
  ],
  sources: ['nasa-asteroids', 'jpl-sbdb'],
  orbit: { kind: 'osculating', elements: CERES_ELEMENTS },
  render: {
    color: '#8d8880',
    accent: '#b3ada3',
    visualNote: pt(
      'Representação ilustrativa: cor uniforme. A textura de Ceres disponível na fonte usada é assinalada como fictícia, por isso não é utilizada. A orientação do eixo é aproximada.',
    ),
  },
  imageQuery: { q: 'Ceres Dawn', mustInclude: ['ceres'] },
};

export const pluto: CelestialBody = {
  id: 'pluto',
  slug: 'plutao',
  type: 'dwarf-planet',
  parent: 'sun',
  name: { 'pt-PT': 'Plutão', en: 'Pluto', es: 'Plutón' },
  aliases: ['Pluto', 'Plutón', 'Plutão', '134340', 'cintura de Kuiper'],
  symbol: '♇',
  tagline: pt('Um planeta anão gelado da cintura de Kuiper, com um coração de gelo de azoto.'),
  description: [
    pt(
      'Plutão foi descoberto em 1930 por Clyde Tombaugh e considerado o nono planeta até 2006, quando a União Astronómica Internacional criou a categoria de planeta anão. Orbita na cintura de Kuiper, numa órbita excêntrica e inclinada.',
    ),
    pt(
      'Em 2015, a sonda New Horizons revelou montanhas de gelo de água, glaciares de gelo de azoto e uma atmosfera fina com camadas de neblina. Caronte, a sua maior lua, tem cerca de metade do diâmetro de Plutão.',
    ),
  ],
  meanRadiusKm: 1188,
  facts: [
    fact('diameter', 2376, 'km', 'measured', 'nasa-factsheet'),
    fact('mass', 1.303e22, 'kg', 'measured', 'nasa-pluto', { scientific: true, digits: 4 }),
    fact('density', 1854, 'kg/m³', 'measured', 'nasa-pluto'),
    fact('gravity', 0.62, 'm/s²', 'measured', 'nasa-pluto', { note: pt('Valor médio à superfície.') }),
    fact('escapeVelocity', 1.3, 'km/s', 'measured', 'nasa-factsheet'),
    fact('meanDistanceSun', 5906.4, '1e6 km', 'average', 'nasa-factsheet', { digits: 1, note: DISTANCE_NOTE }),
    fact('perihelion', 4436.8, '1e6 km', 'measured', 'nasa-factsheet'),
    fact('aphelion', 7375.9, '1e6 km', 'measured', 'nasa-factsheet'),
    fact('siderealRotation', -153.2928, 'h', 'measured', 'nasa-pluto', { note: ROTATION_NOTE }),
    fact('dayLength', 153.282, 'h', 'measured', 'nasa-pluto'),
    fact('orbitalPeriod', 90560, 'd', 'measured', 'nasa-pluto'),
    fact('orbitalVelocity', 4.7, 'km/s', 'average', 'nasa-factsheet'),
    fact('inclination', 17.16, '°', 'measured', 'nasa-pluto', { note: pt('Em relação à eclíptica.') }),
    fact('eccentricity', 0.2444, '', 'measured', 'nasa-pluto'),
    fact('obliquity', 119.51, '°', 'measured', 'nasa-pluto'),
    fact('meanTemperature', -225, '°C', 'average', 'nasa-factsheet'),
    fact('temperatureRange', [24, 38], 'K', 'measured', 'nasa-pluto'),
    fact('surfacePressure', 1.3e-5, 'bar', 'measured', 'nasa-pluto', {
      qualifier: '~',
      scientific: true,
      digits: 1,
      note: pt('Cerca de 13 microbar; varia ao longo da órbita.'),
    }),
  ],
  atmosphere: {
    summary: pt('Atmosfera fina de azoto, com metano e monóxido de carbono.'),
    components: [
      { formula: 'N₂', name: pt('Azoto'), value: 99, unit: '%' },
      { formula: 'CH₄', name: pt('Metano'), value: 0.5, unit: '%' },
      { formula: 'CO', name: pt('Monóxido de carbono'), value: 0.05, unit: '%' },
    ],
    sourceId: 'nasa-pluto',
    note: pt('Valores aproximados ("cerca de"), com vestígios de HCN e hidrocarbonetos.'),
  },
  structure: {
    layers: [
      { name: pt('Crosta de gelos'), description: pt('Gelos de azoto, metano e monóxido de carbono sobre gelo de água.') },
      { name: pt('Possível oceano'), description: pt('Camada de água líquida em profundidade: hipótese apoiada por alguns modelos, não confirmada.') },
      { name: pt('Núcleo rochoso'), description: pt('Rocha que representa grande parte da massa.') },
    ],
  },
  moons: {
    count: 5,
    asOf: '2026-10-13',
    sourceId: 'nasa-pluto',
    notable: [{ name: pt('Caronte'), radiusKm: 606.0, radiusUncertaintyKm: 0.5 }],
  },
  features: [
    pt('Sputnik Planitia é uma vasta planície de gelo de azoto na metade ocidental da região em forma de coração, Tombaugh Regio.'),
    pt('Plutão e Caronte orbitam um centro de massa comum situado fora de Plutão.'),
  ],
  discoveries: [
    pt('Descoberto a 18 de fevereiro de 1930 por Clyde Tombaugh, no Observatório Lowell.'),
    pt('A 14 de julho de 2015, a New Horizons fez o primeiro sobrevoo de Plutão.'),
  ],
  missions: [
    {
      name: 'New Horizons',
      agency: 'NASA',
      when: pt('Sobrevoo em 2015'),
      kind: 'flyby',
      summary: pt('Primeiras imagens detalhadas de Plutão e Caronte; prosseguiu para a cintura de Kuiper.'),
    },
  ],
  sources: ['nasa-factsheet', 'nasa-pluto', 'jpl-sbdb', 'naif-pck'],
  orbit: { kind: 'osculating', elements: PLUTO_ELEMENTS },
  pole: { ra: [132.993, 0], dec: [-6.163, 0], pm: [302.695, 56.3625225] },
  render: {
    color: '#c8b49c',
    accent: '#dcc7ac',
    visualNote: pt(
      'Representação ilustrativa: cor uniforme aproximada, sem mapa global com licença verificada nesta versão.',
    ),
  },
  imageQuery: { q: 'Pluto New Horizons', mustInclude: ['pluto'] },
};

