import type { CelestialBody } from '../types';
import { fact, pt } from './helpers';

export const sun: CelestialBody = {
  id: 'sun',
  slug: 'sol',
  type: 'star',
  name: { 'pt-PT': 'Sol', en: 'Sun', es: 'Sol' },
  aliases: ['Sun', 'Sol', 'Hélio', 'Helios', 'estrela', 'G2V'],
  symbol: '☉',
  tagline: pt('A estrela no centro do Sistema Solar, uma anã amarela de tipo espectral G2 V.'),
  description: [
    pt(
      'O Sol é uma esfera de plasma, sobretudo hidrogénio e hélio, que produz energia por fusão nuclear no seu núcleo, onde a temperatura ultrapassa 15 milhões de kelvin. Essa energia demora muito tempo a atravessar o interior por radiação e convecção até ser emitida pela fotosfera, a superfície visível.',
    ),
    pt(
      'Contém mais de 99% da massa do Sistema Solar e a sua gravidade mantém em órbita todos os planetas, planetas anões, asteroides e cometas. A luz do Sol demora cerca de 8 minutos e 19 segundos a chegar à Terra.',
    ),
  ],
  meanRadiusKm: 695_700,
  facts: [
    fact('equatorialRadius', 695_700, 'km', 'measured', 'nasa-sun', {
      note: pt('Raio médio volumétrico.'),
    }),
    fact('diameter', 1_391_400, 'km', 'derived', 'nasa-sun', { note: pt('Calculado: 2 × raio médio.') }),
    fact('mass', 1.9884e30, 'kg', 'measured', 'nasa-sun', { scientific: true, digits: 5 }),
    fact('density', 1408, 'kg/m³', 'measured', 'nasa-sun'),
    fact('gravity', 274.0, 'm/s²', 'measured', 'nasa-sun', { digits: 1, note: pt('À superfície, no equador.') }),
    fact('escapeVelocity', 617.6, 'km/s', 'measured', 'nasa-sun'),
    fact('luminosity', 3.828e26, 'W', 'measured', 'nasa-sun', { scientific: true, digits: 4 }),
    fact('effectiveTemperature', 5772, 'K', 'measured', 'nasa-sun'),
    fact('spectralType', 'G2 V', '', 'measured', 'nasa-sun'),
    fact('siderealRotation', 609.12, 'h', 'measured', 'nasa-sun', {
      note: pt('À latitude de 16°. O Sol não roda como um corpo rígido: o equador roda mais depressa do que os polos.'),
    }),
    fact('centralTemperature', 1.571e7, 'K', 'estimate', 'nasa-sun', {
      scientific: true,
      digits: 4,
      note: pt('Valor de modelos do interior solar.'),
    }),
    fact('centralPressure', 2.477e11, 'bar', 'estimate', 'nasa-sun', { scientific: true, digits: 4 }),
    fact('centralDensity', 1.622e5, 'kg/m³', 'estimate', 'nasa-sun', { scientific: true, digits: 4 }),
    fact('distanceEarth', 149.6, '1e6 km', 'average', 'nasa-sun'),
    fact('lightTime', 499, 's', 'derived', 'nasa-sun', {
      note: pt('Calculado: distância média (149,6 × 10⁶ km) ÷ velocidade da luz (299 792,458 km/s).'),
    }),
  ],
  atmosphere: {
    summary: pt('Composição da fotosfera (fração do número de átomos).'),
    components: [
      { formula: 'H', name: pt('Hidrogénio'), value: 90.965, unit: '%' },
      { formula: 'He', name: pt('Hélio'), value: 8.889, unit: '%' },
    ],
    sourceId: 'nasa-sun',
    note: pt('O restante (cerca de 0,15%) corresponde a elementos mais pesados, como oxigénio, carbono, néon e ferro.'),
  },
  structure: {
    layers: [
      {
        name: pt('Coroa'),
        description: pt('Atmosfera exterior, muito ténue e com temperaturas de milhões de kelvin; dá origem ao vento solar.'),
      },
      { name: pt('Cromosfera'), description: pt('Camada fina acima da fotosfera, visível durante os eclipses totais.') },
      { name: pt('Fotosfera'), description: pt('A superfície visível, onde surgem as manchas solares.') },
      {
        name: pt('Zona convectiva'),
        description: pt('O plasma sobe e desce em células de convecção que transportam o calor até à superfície.'),
      },
      {
        name: pt('Zona radiativa'),
        description: pt('A energia propaga-se por radiação, absorvida e reemitida muitas vezes.'),
      },
      { name: pt('Núcleo'), description: pt('Região central onde ocorre a fusão do hidrogénio em hélio.') },
    ],
  },
  features: [
    pt('A atividade magnética segue um ciclo de cerca de 11 anos, marcado pelo número de manchas solares.'),
    pt('O vento solar, um fluxo de partículas carregadas, enche a heliosfera muito para lá da órbita de Neptuno.'),
    pt('Erupções e ejeções de massa coronal podem provocar tempestades geomagnéticas e auroras na Terra.'),
  ],
  discoveries: [
    pt('Em dezembro de 2024, a sonda Parker Solar Probe passou a cerca de 6,1 milhões de km da superfície solar, a aproximação mais próxima de sempre de um objeto humano.'),
  ],
  missions: [
    {
      name: 'SOHO',
      agency: 'ESA/NASA',
      when: pt('Lançado em 1995'),
      kind: 'observatory',
      summary: pt('Observatório no ponto de Lagrange L1 que estuda o interior, a atmosfera e o vento solar.'),
    },
    {
      name: 'Solar Dynamics Observatory',
      agency: 'NASA',
      when: pt('Lançado em 2010'),
      kind: 'observatory',
      summary: pt('Imagens contínuas do Sol em vários comprimentos de onda para estudar a atividade magnética.'),
    },
    {
      name: 'Parker Solar Probe',
      agency: 'NASA',
      when: pt('Lançada em 2018'),
      kind: 'probe',
      summary: pt('Atravessa a coroa solar para estudar a origem do vento solar.'),
    },
    {
      name: 'Solar Orbiter',
      agency: 'ESA/NASA',
      when: pt('Lançado em 2020'),
      kind: 'probe',
      summary: pt('Observa o Sol de perto e a partir de órbitas progressivamente inclinadas, para estudar as regiões polares.'),
    },
  ],
  sources: ['nasa-sun', 'naif-pck', 'sss-textures'],
  orbit: { kind: 'none' },
  pole: { ra: [286.13, 0], dec: [63.87, 0], pm: [84.176, 14.1844] },
  render: { texture: 'sun', color: '#ffcf6b', accent: '#ffc874' },
  imageQuery: { q: 'Sun Solar Dynamics Observatory', mustInclude: ['sun', 'solar'] },
};
