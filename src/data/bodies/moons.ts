import { SATELLITE_ELEMENTS, type SatelliteKey } from '../moonOrbits';
import type { BodyId, CelestialBody, Fact, LocalizedText, Mission, StructureLayer } from '../types';
import type { SourceId } from '../sources';
import { fact, pt } from './helpers';

/** Constante da gravitação em km³/(kg·s²), para converter GM em massa. */
const G_KM = 6.6743e-20;

interface Physical {
  /** Raio médio (km) e incerteza, JPL. */
  r: number;
  rUnc: number;
  /** GM (km³/s²), JPL. */
  gm: number;
  /**
   * Densidade média (g/cm³) publicada pelo JPL, ou 'derived' para a calcular a partir de GM e do raio
   * (usado quando o valor da tabela não é coerente com o GM e o raio da mesma tabela).
   */
  density: number | 'derived';
}

/** Dados físicos a partir dos parâmetros do JPL (diâmetro, massa e gravidade são calculados). */
function physicalFacts(p: Physical): Fact[] {
  const small = p.r < 100;
  return [
    fact('diameter', p.r * 2, 'km', 'derived', 'jpl-sat-phys', {
      uncertainty: p.rUnc * 2,
      digits: small ? 1 : 0,
      note: pt('Calculado: 2 × raio médio publicado pelo JPL.'),
    }),
    fact('mass', p.gm / G_KM, 'kg', 'derived', 'jpl-sat-phys', {
      scientific: true,
      digits: 4,
      note: pt('Calculado: GM ÷ G, a partir do parâmetro gravitacional (GM) medido.'),
    }),
    p.density === 'derived'
      ? fact('density', Math.round(((p.gm / G_KM) / ((4 / 3) * Math.PI * (p.r * 1000) ** 3))), 'kg/m³', 'derived', 'jpl-sat-phys', {
          note: pt(
            'Calculado: massa ÷ volume da esfera com o raio médio. A tabela do JPL indica 1853 kg/m³, valor que não é coerente com o GM e o raio da própria tabela.',
          ),
        })
      : fact('density', Math.round(p.density * 1000), 'kg/m³', 'measured', 'jpl-sat-phys'),
    fact('gravity', (p.gm / (p.r * p.r)) * 1000, 'm/s²', 'derived', 'jpl-sat-phys', {
      digits: p.gm / (p.r * p.r) * 1000 < 0.1 ? 4 : 3,
      note: pt('Calculado: GM ÷ raio² (sem efeito da rotação).'),
    }),
  ];
}

/** Dados orbitais a partir do ajuste às efemérides do JPL Horizons. */
function orbitFacts(key: SatelliteKey, retrogradeSpin: boolean): Fact[] {
  const el = SATELLITE_ELEMENTS[key];
  const P = 360 / el.n;
  const note = pt('Ajustado a vetores do JPL Horizons (2025–2027) e verificado em 2026 e 2028; valor osculador a 13/10/2026.');
  return [
    fact('distancePlanet', Math.round(el.a), 'km', 'derived', 'horizons-moons', {
      qualifier: '≈',
      note: pt('Semieixo maior da órbita em torno do planeta. ' + note['pt-PT']),
    }),
    fact('orbitalPeriod', P, 'd', 'derived', 'horizons-moons', {
      digits: P < 2 ? 4 : 3,
      note: pt('Período sideral em torno do planeta, a partir do movimento médio ajustado ao JPL Horizons.'),
    }),
    fact('siderealRotation', (retrogradeSpin ? -1 : 1) * P * 24, 'h', 'derived', 'horizons-moons', {
      digits: 1,
      note: pt(
        retrogradeSpin
          ? 'Rotação síncrona: dura o mesmo que a órbita. O sinal negativo indica rotação retrógrada em relação ao polo norte definido pela IAU.'
          : 'Rotação síncrona: dura o mesmo que a órbita, por isso mostra sempre a mesma face ao planeta.',
      ),
    }),
    fact('eccentricity', el.e, '', 'derived', 'horizons-moons', { qualifier: '≈', digits: 4, note }),
    fact('inclinationEquator', el.inclinationToEquator, '°', 'derived', 'horizons-moons', {
      digits: 2,
      note: pt(
        el.inclinationToEquator > 90
          ? 'Ângulo entre a órbita e o equador do planeta. Acima de 90° a lua orbita em sentido contrário à rotação do planeta.'
          : 'Ângulo entre a órbita e o equador do planeta.',
      ),
    }),
  ];
}

interface MoonSpec {
  id: BodyId & SatelliteKey;
  slug: string;
  parent: BodyId;
  name: LocalizedText;
  aliases: string[];
  tagline: string;
  description: string[];
  phys: Physical;
  retrogradeSpin?: boolean;
  discovery: string;
  extraFacts?: Fact[];
  structure?: { layers: StructureLayer[]; note?: string };
  atmosphere?: CelestialBody['atmosphere'];
  features?: string[];
  discoveries?: string[];
  missions: Mission[];
  nasaSource: SourceId;
  color: string;
  accent: string;
  mapNote?: string;
  atmosphereGlow?: string;
  query: string;
}

function moon(spec: MoonSpec): CelestialBody {
  return {
    id: spec.id,
    slug: spec.slug,
    type: 'moon',
    parent: spec.parent,
    name: spec.name,
    aliases: spec.aliases,
    tagline: pt(spec.tagline),
    description: spec.description.map(pt),
    meanRadiusKm: spec.phys.r,
    facts: [
      ...physicalFacts(spec.phys),
      ...orbitFacts(spec.id, spec.retrogradeSpin ?? false),
      ...(spec.extraFacts ?? []),
      fact('discovery', spec.discovery, '', 'measured', spec.nasaSource),
    ],
    atmosphere: spec.atmosphere,
    structure: spec.structure
      ? { layers: spec.structure.layers, note: spec.structure.note ? pt(spec.structure.note) : undefined }
      : undefined,
    features: (spec.features ?? []).map(pt),
    discoveries: (spec.discoveries ?? []).map(pt),
    missions: spec.missions,
    sources: [spec.nasaSource, 'jpl-sat-phys', 'horizons-moons', 'jpl-sat-elem', 'nasa-3d-resources'],
    orbit: { kind: 'satellite', key: spec.id },
    render: {
      texture: spec.id,
      color: spec.color,
      accent: spec.accent,
      synchronous: true,
      atmosphereGlow: spec.atmosphereGlow,
      visualNote: pt(
        (spec.mapNote ? `${spec.mapNote} ` : '') +
          'A distância ao planeta está muito comprimida na vista 3D e a posição é aproximada (modelo ajustado a 2025–2027).',
      ),
    },
    imageQuery: { q: spec.query, mustInclude: [spec.name.en!.toLowerCase()] },
  };
}

const layer = (name: string, description: string): StructureLayer => ({ name: pt(name), description: pt(description) });
const mission = (
  name: string,
  agency: string,
  when: string,
  kind: Mission['kind'],
  summary: string,
  timeSensitive = false,
): Mission => ({ name, agency, when: pt(when), kind, summary: pt(summary), timeSensitive });

const VOYAGER2_URANUS = mission(
  'Voyager 2',
  'NASA',
  'Sobrevoo de Úrano em 1986',
  'flyby',
  'Única sonda a visitar o sistema de Úrano; fotografou sobretudo o hemisfério sul das luas, então iluminado.',
);
const CASSINI = mission('Cassini', 'NASA/ESA/ASI', 'Em órbita de Saturno de 2004 a 2017', 'orbiter', 'Fez sobrevoos próximos das principais luas de Saturno.');
const GALILEO = mission('Galileo', 'NASA', 'Em órbita de Júpiter de 1995 a 2003', 'orbiter', 'Primeira sonda em órbita de Júpiter; estudou as quatro luas galileanas em sobrevoos repetidos.');
const UNMAPPED_URANUS =
  'Mapa da NASA a partir das imagens da Voyager 2: o hemisfério que estava no escuro em 1986 não foi fotografado e aparece com um tom neutro uniforme.';

// ------------------------------------------------------------------ Marte

export const phobos = moon({
  id: 'phobos',
  slug: 'fobos',
  parent: 'mars',
  name: { 'pt-PT': 'Fobos', en: 'Phobos', es: 'Fobos' },
  aliases: ['Phobos', 'Fobos', 'Marte I'],
  tagline: 'A maior lua de Marte, que se aproxima lentamente do planeta.',
  description: [
    'Fobos é um corpo irregular e escuro que dá três voltas a Marte por dia, numa órbita tão baixa que nem sempre é visível de todos os pontos da superfície marciana.',
    'Aproxima-se de Marte cerca de 1,8 metros por século. A este ritmo, dentro de uns 50 milhões de anos deverá colidir com o planeta ou desfazer-se num anel.',
  ],
  phys: { r: 11.08, rUnc: 0.04, gm: 0.0007087, density: 1.872 },
  discovery: '17 de agosto de 1877, Asaph Hall',
  features: ['A cratera Stickney, com cerca de 9 a 10 km, domina uma das faces.'],
  missions: [
    mission('Mars Express', 'ESA', 'Em órbita de Marte desde 2003', 'orbiter', 'Obteve imagens próximas de Fobos em vários sobrevoos.', true),
    mission('Mars Reconnaissance Orbiter', 'NASA', 'Em órbita de Marte desde 2006', 'orbiter', 'Fotografou Fobos em alta resolução.', true),
  ],
  nasaSource: 'nasa-phobos',
  color: '#7d736a',
  accent: '#a39889',
  mapNote: 'Fobos é muito irregular; aqui aparece como esfera com o seu mapa de superfície.',
  query: 'Phobos Mars moon',
});

export const deimos = moon({
  id: 'deimos',
  slug: 'deimos',
  parent: 'mars',
  name: { 'pt-PT': 'Deimos', en: 'Deimos', es: 'Deimos' },
  aliases: ['Deimos', 'Marte II'],
  tagline: 'A pequena lua exterior de Marte, coberta por uma camada espessa de poeira.',
  description: [
    'Deimos é a menor das duas luas de Marte, com cerca de 15 × 12 × 11 km, e demora cerca de 30 horas a completar uma órbita.',
    'A superfície parece mais lisa do que a de Fobos porque o rególito, que pode ter até 100 metros de espessura, preenche parcialmente as crateras. A sua composição escura é semelhante à de asteroides da cintura exterior.',
  ],
  phys: { r: 6.2, rUnc: 0.24, gm: 0.0000962, density: 1.471 },
  discovery: '11 de agosto de 1877, Asaph Hall',
  missions: [
    mission('Viking 2', 'NASA', '1977', 'orbiter', 'O orbitador fez sobrevoos próximos de Deimos.'),
  ],
  nasaSource: 'nasa-deimos',
  color: '#8a8075',
  accent: '#b0a596',
  mapNote: 'Deimos é muito irregular; aqui aparece como esfera com o seu mapa de superfície.',
  query: 'Deimos Mars moon',
});

// ------------------------------------------------------------------ Júpiter

export const io = moon({
  id: 'io',
  slug: 'io',
  parent: 'jupiter',
  name: { 'pt-PT': 'Io', en: 'Io', es: 'Ío' },
  aliases: ['Io', 'Ío', 'Júpiter I', 'lua galileana'],
  tagline: 'O mundo vulcanicamente mais ativo do Sistema Solar.',
  description: [
    'Io é um pouco maior do que a Lua e tem centenas de vulcões, alguns com fontes de lava que sobem dezenas de quilómetros, e lagos de lava de silicatos fundidos.',
    'Está presa num "cabo de guerra" gravitacional entre Júpiter e as luas Europa e Ganimedes. A deformação provocada por estas forças de maré aquece o seu interior.',
  ],
  phys: { r: 1821.49, rUnc: 0.5, gm: 5959.91547, density: 3.5276 },
  discovery: 'Janeiro de 1610, Galileu Galilei',
  structure: {
    layers: [
      layer('Crosta', 'Rochas de silicatos cobertas de compostos de enxofre e lava recente.'),
      layer('Manto', 'Rocha de silicatos, aquecida pelas marés.'),
      layer('Núcleo', 'Ferro e sulfureto de ferro.'),
    ],
    note: 'Modelo inferido a partir da gravidade e da densidade.',
  },
  features: [
    'As cores amarelas, vermelhas e brancas vêm de compostos de enxofre depositados pelas erupções.',
    'Io, Europa e Ganimedes estão em ressonância orbital: por cada órbita de Ganimedes, Europa faz duas e Io faz quatro.',
  ],
  missions: [
    GALILEO,
    mission('Juno', 'NASA', 'Sobrevoos próximos em 2023 e 2024', 'orbiter', 'Passou a cerca de 1500 km de Io, obtendo imagens detalhadas da atividade vulcânica.'),
  ],
  nasaSource: 'nasa-io',
  color: '#d4b45c',
  accent: '#e3c56a',
  mapNote: 'Mapa da NASA a partir de imagens da Voyager e da Galileo; os polos sem dados aparecem com um tom neutro.',
  query: 'Io Jupiter moon volcano',
});

export const europa = moon({
  id: 'europa',
  slug: 'europa',
  parent: 'jupiter',
  name: { 'pt-PT': 'Europa', en: 'Europa', es: 'Europa' },
  aliases: ['Europa', 'Júpiter II', 'lua galileana'],
  tagline: 'Uma crosta de gelo sobre um oceano de água salgada.',
  description: [
    'Há fortes indícios de que existe um oceano de água salgada por baixo da crosta de gelo de Europa, com cerca do dobro da água de todos os oceanos da Terra.',
    'Por isso, Europa pode ser um dos lugares mais promissores do Sistema Solar para procurar ambientes atuais adequados a alguma forma de vida. Não há qualquer evidência de vida: é essa possibilidade que a missão Europa Clipper vai avaliar.',
  ],
  phys: { r: 1560.8, rUnc: 0.3, gm: 3202.7121, density: 3.013 },
  discovery: 'Janeiro de 1610, Galileu Galilei',
  structure: {
    layers: [
      layer('Crosta de gelo', 'Gelo de água fraturado, com linhas avermelhadas.'),
      layer('Oceano', 'Água líquida salgada (inferida a partir de dados magnéticos e da superfície).'),
      layer('Manto', 'Rocha.'),
      layer('Núcleo', 'Metálico.'),
    ],
    note: 'A espessura da crosta de gelo ainda é debatida.',
  },
  features: ['A superfície é jovem e quase sem crateras, cruzada por fraturas e cristas.'],
  missions: [
    GALILEO,
    mission('Juno', 'NASA', 'Sobrevoo a 29 de setembro de 2022', 'orbiter', 'Passagem próxima com imagens de alta resolução.'),
    mission('Europa Clipper', 'NASA', 'Lançada a 14 de outubro de 2024; chegada prevista para 2030', 'orbiter', 'Vai determinar se há lugares sob a superfície capazes de suportar vida.', true),
  ],
  nasaSource: 'nasa-europa',
  color: '#c9c2b4',
  accent: '#d8d0bf',
  mapNote: 'Mapa da NASA a partir de imagens da Voyager e da Galileo (tons de cinzento).',
  query: 'Europa Jupiter moon',
});

export const ganymede = moon({
  id: 'ganymede',
  slug: 'ganimedes',
  parent: 'jupiter',
  name: { 'pt-PT': 'Ganimedes', en: 'Ganymede', es: 'Ganímedes' },
  aliases: ['Ganymede', 'Ganimedes', 'Ganímedes', 'Júpiter III', 'lua galileana'],
  tagline: 'A maior lua do Sistema Solar, maior do que o planeta Mercúrio.',
  description: [
    'Ganimedes é a maior lua do Sistema Solar e a única conhecida com campo magnético próprio, gerado por um núcleo de ferro. Esse campo produz auroras perto dos polos.',
    'Há fortes indícios de um oceano subterrâneo de água salgada. A superfície mistura regiões escuras, antigas e com muitas crateras, com regiões claras, mais jovens e deformadas por processos tectónicos.',
  ],
  phys: { r: 2631.2, rUnc: 1.7, gm: 9887.83275, density: 1.9416 },
  discovery: 'Janeiro de 1610, Galileu Galilei',
  structure: {
    layers: [
      layer('Crosta de gelo', 'Gelo de água misturado com rocha.'),
      layer('Oceano', 'Água salgada, possivelmente em camadas intercaladas com gelo.'),
      layer('Manto', 'Rocha.'),
      layer('Núcleo', 'Ferro metálico, responsável pelo campo magnético.'),
    ],
  },
  missions: [
    GALILEO,
    mission('Juno', 'NASA', 'Sobrevoo em 2021', 'orbiter', 'Primeiras imagens próximas desde a Galileo.'),
    mission('JUICE', 'ESA', 'Lançada em 2023', 'orbiter', 'Planeia entrar em órbita de Ganimedes depois de estudar Júpiter, Europa e Calisto.', true),
  ],
  nasaSource: 'nasa-ganymede',
  color: '#a99f92',
  accent: '#c2b6a6',
  mapNote: 'Mapa da NASA a partir de imagens da Voyager e da Galileo.',
  query: 'Ganymede Jupiter moon',
});

export const callisto = moon({
  id: 'callisto',
  slug: 'calisto',
  parent: 'jupiter',
  name: { 'pt-PT': 'Calisto', en: 'Callisto', es: 'Calisto' },
  aliases: ['Callisto', 'Calisto', 'Júpiter IV', 'lua galileana'],
  tagline: 'O objeto com mais crateras do Sistema Solar.',
  description: [
    'Calisto é a segunda maior lua de Júpiter e a terceira maior do Sistema Solar. A superfície, antiga, está saturada de crateras de impacto.',
    'Os dados da Galileo nos anos 1990 sugeriram que Calisto pode ter um oceano salgado por baixo da superfície.',
  ],
  phys: { r: 2410.3, rUnc: 1.5, gm: 7179.2834, density: 1.834 },
  discovery: 'Janeiro de 1610, Galileu Galilei',
  structure: {
    layers: [
      layer('Crosta', 'Gelo e rocha, com muitas crateras.'),
      layer('Possível oceano', 'Água salgada sugerida por medições magnéticas.'),
      layer('Interior', 'Mistura de gelo e rocha, pouco diferenciada.'),
    ],
    note: 'Modelo inferido; a existência do oceano não está confirmada.',
  },
  missions: [GALILEO],
  nasaSource: 'nasa-callisto',
  color: '#6e665c',
  accent: '#9a8f80',
  mapNote: 'Mapa da NASA a partir de imagens da Voyager e da Galileo; as zonas mais lisas correspondem a áreas com pouca cobertura de imagens.',
  query: 'Callisto Jupiter moon',
});

// ------------------------------------------------------------------ Saturno

export const mimas = moon({
  id: 'mimas',
  slug: 'mimas',
  parent: 'saturn',
  name: { 'pt-PT': 'Mimas', en: 'Mimas', es: 'Mimas' },
  aliases: ['Mimas', 'Saturno I'],
  tagline: 'A pequena lua marcada por uma cratera gigante.',
  description: [
    'Mimas tem cerca de 400 km de diâmetro. A cratera Herschel, com cerca de 130 km, ocupa aproximadamente um terço da sua largura e tem paredes de cerca de 5 km de altura.',
  ],
  phys: { r: 198.2, rUnc: 0.4, gm: 2.50349, density: 1.1501 },
  discovery: '17 de setembro de 1789, William Herschel',
  missions: [CASSINI],
  nasaSource: 'nasa-mimas',
  color: '#bcbab5',
  accent: '#d3d1cc',
  mapNote: 'Mapa da NASA a partir de imagens da Cassini.',
  query: 'Mimas Saturn moon Herschel',
});

export const enceladus = moon({
  id: 'enceladus',
  slug: 'encelado',
  parent: 'saturn',
  name: { 'pt-PT': 'Encélado', en: 'Enceladus', es: 'Encélado' },
  aliases: ['Enceladus', 'Encélado', 'Encelado', 'Saturno II'],
  tagline: 'Uma lua gelada que expele jatos de água a partir de um oceano global.',
  description: [
    'Encélado tem apenas cerca de 500 km de diâmetro, mas é o corpo mais refletor do Sistema Solar. Em 2005, a Cassini descobriu jatos de vapor de água e partículas de gelo a sair de fraturas perto do polo sul, as "riscas de tigre".',
    'As medições de gravidade mostram um oceano global por baixo do gelo. Os jatos alimentam o anel E de Saturno e contêm vapor de água, dióxido de carbono, metano, sais, sílica e compostos orgânicos.',
  ],
  phys: { r: 252.1, rUnc: 0.2, gm: 7.21037, density: 1.6097 },
  discovery: '28 de agosto de 1789, William Herschel',
  extraFacts: [
    fact('meanTemperature', -201, '°C', 'average', 'nasa-enceladus', { qualifier: '≈', note: pt('Temperatura à superfície indicada pela NASA.') }),
  ],
  structure: {
    layers: [
      layer('Crosta de gelo', 'Com 20 a 25 km de espessura média e apenas 1 a 5 km no polo sul.'),
      layer('Oceano global', 'Água líquida salgada que alimenta os jatos.'),
      layer('Núcleo', 'Rochoso e poroso.'),
    ],
  },
  features: [
    'Os jatos saem a cerca de 400 m/s; a maior parte do material volta a cair como neve.',
    'Nanopartículas de sílica no anel E indicam interação entre água quente e rocha no fundo do oceano, a mais de 90 °C.',
  ],
  discoveries: ['A Cassini descobriu os jatos em 2005 e mostrou que vêm de um oceano global.'],
  missions: [CASSINI],
  nasaSource: 'nasa-enceladus',
  color: '#e8ecef',
  accent: '#f2f5f7',
  mapNote: 'Mapa da NASA a partir de imagens da Cassini; as zonas lisas e claras correspondem a áreas com pouca cobertura.',
  query: 'Enceladus plumes Cassini',
});

export const tethys = moon({
  id: 'tethys',
  slug: 'tetis',
  parent: 'saturn',
  name: { 'pt-PT': 'Tétis', en: 'Tethys', es: 'Tetis' },
  aliases: ['Tethys', 'Tétis', 'Tetis', 'Saturno III'],
  tagline: 'Uma lua quase toda de gelo de água, com uma cratera enorme.',
  description: [
    'Com uma densidade próxima da da água, Tétis deve ser composta quase só por gelo de água. A cratera Odisseu, com cerca de 400 km, ocupa quase dois quintos da sua largura.',
    'O desfiladeiro Ithaca Chasma tem cerca de 100 km de largura, 3 a 5 km de profundidade e 2000 km de comprimento. As pequenas luas Telesto e Calipso partilham a sua órbita, 60° à frente e atrás.',
  ],
  phys: { r: 531.1, rUnc: 0.6, gm: 41.21353, density: 0.984 },
  discovery: '21 de março de 1684, Giovanni Cassini',
  missions: [CASSINI],
  nasaSource: 'nasa-tethys',
  color: '#cfcdc8',
  accent: '#e0ded9',
  mapNote: 'Mapa da NASA a partir de imagens da Cassini.',
  query: 'Tethys Saturn moon',
});

export const dione = moon({
  id: 'dione',
  slug: 'dione',
  parent: 'saturn',
  name: { 'pt-PT': 'Dione', en: 'Dione', es: 'Dione' },
  aliases: ['Dione', 'Saturno IV'],
  tagline: 'Uma lua gelada com falésias de gelo brilhante.',
  description: [
    'As imagens da Cassini mostraram que as faixas claras de Dione são paredes de gelo com centenas de metros de altura, em zonas fraturadas onde o material escuro caiu e expôs gelo limpo.',
    'Duas pequenas luas partilham a sua órbita: Helena, 60° à frente, e Polideuces, 60° atrás.',
  ],
  phys: { r: 561.4, rUnc: 0.4, gm: 73.11607, density: 1.4781 },
  discovery: '21 de março de 1684, Giovanni Cassini',
  missions: [CASSINI],
  nasaSource: 'nasa-dione',
  color: '#c4c2bd',
  accent: '#d9d7d2',
  mapNote: 'Mapa da NASA a partir de imagens da Cassini; as zonas lisas correspondem a áreas com pouca cobertura.',
  query: 'Dione Saturn moon',
});

export const rhea = moon({
  id: 'rhea',
  slug: 'reia',
  parent: 'saturn',
  name: { 'pt-PT': 'Reia', en: 'Rhea', es: 'Rea' },
  aliases: ['Rhea', 'Reia', 'Rea', 'Saturno V'],
  tagline: 'A segunda maior lua de Saturno, fria e coberta de crateras.',
  description: [
    'Reia é composta sobretudo por gelo de água e tem mais crateras do que Dione e Tétis. Em 2010, a Cassini detetou uma exosfera muito ténue com oxigénio e dióxido de carbono.',
  ],
  phys: { r: 763.5, rUnc: 0.6, gm: 153.94175, density: 1.2372 },
  discovery: '23 de dezembro de 1672, Giovanni Cassini',
  extraFacts: [
    fact('temperatureRange', [-220, -174], '°C', 'measured', 'nasa-rhea', { note: pt('Das zonas à sombra às zonas iluminadas.') }),
  ],
  missions: [CASSINI],
  nasaSource: 'nasa-rhea',
  color: '#c9c7c2',
  accent: '#dedcd7',
  mapNote: 'Mapa da NASA a partir de imagens da Cassini; as zonas lisas e claras correspondem a áreas com pouca cobertura.',
  query: 'Rhea Saturn moon',
});

export const titan = moon({
  id: 'titan',
  slug: 'tita',
  parent: 'saturn',
  name: { 'pt-PT': 'Titã', en: 'Titan', es: 'Titán' },
  aliases: ['Titan', 'Titã', 'Tita', 'Titán', 'Saturno VI'],
  tagline: 'A única lua com uma atmosfera densa e o único mundo, além da Terra, com lagos à superfície.',
  description: [
    'Titã é maior do que o planeta Mercúrio e tem uma atmosfera de azoto e metano mais densa do que a da Terra. À superfície há lagos e mares de metano e etano líquidos, rios, nuvens e chuva, num ciclo semelhante ao da água na Terra.',
    'As medições de gravidade da Cassini sugerem um oceano de água líquida, provavelmente com sais e amoníaco, entre 55 e 80 km abaixo da superfície gelada.',
  ],
  phys: { r: 2574.76, rUnc: 0.02, gm: 8978.1371, density: 1.8814 },
  discovery: '1655, Christiaan Huygens',
  extraFacts: [
    fact('meanTemperature', -179, '°C', 'average', 'nasa-titan', { qualifier: '≈' }),
    fact('surfacePressure', 1.6, 'bar', 'derived', 'nasa-titan', {
      qualifier: '≈',
      digits: 1,
      note: pt('A NASA indica uma pressão cerca de 60% superior à da Terra, semelhante à que se sente a 15 m de profundidade no mar.'),
    }),
  ],
  atmosphere: {
    summary: pt('Atmosfera densa, sobretudo de azoto, com uma névoa laranja de compostos orgânicos.'),
    components: [
      { formula: 'N₂', name: pt('Azoto'), value: 95, unit: '%' },
      { formula: 'CH₄', name: pt('Metano'), value: 5, unit: '%' },
    ],
    sourceId: 'nasa-titan',
    note: pt('Valores aproximados ("cerca de"); há pequenas quantidades de outros compostos de carbono. A fração de metano varia com a altitude.'),
  },
  structure: {
    layers: [
      layer('Crosta de gelo', 'Gelo de água, coberto por sedimentos orgânicos.'),
      layer('Oceano', 'Água líquida com sais e amoníaco, 55 a 80 km abaixo da superfície.'),
      layer('Gelo de alta pressão', 'Camadas de gelo comprimido.'),
      layer('Núcleo', 'Rochoso.'),
    ],
    note: 'Modelo inferido a partir das medições da Cassini e da descida da Huygens.',
  },
  discoveries: ['A 14 de janeiro de 2005, a sonda Huygens pousou em Titã, a aterragem mais distante alguma vez feita.'],
  missions: [
    mission('Cassini–Huygens', 'NASA/ESA/ASI', '2004–2017; Huygens pousou em 2005', 'lander', 'A Cassini cartografou Titã por radar; a Huygens mediu a atmosfera durante a descida e fotografou a superfície.'),
    mission('Dragonfly', 'NASA', 'Lançamento previsto para 2028', 'probe', 'Um aparelho com rotores que vai voar entre vários locais de Titã para estudar a química pré-biótica.', true),
  ],
  nasaSource: 'nasa-titan',
  color: '#d9a24a',
  accent: '#e8b45c',
  atmosphereGlow: '#e8b45c',
  mapNote: 'O mapa mostra a névoa laranja da atmosfera, tal como Titã aparece em luz visível.',
  query: 'Titan Saturn moon Cassini',
});

export const iapetus = moon({
  id: 'iapetus',
  slug: 'japeto',
  parent: 'saturn',
  name: { 'pt-PT': 'Jápeto', en: 'Iapetus', es: 'Jápeto' },
  aliases: ['Iapetus', 'Jápeto', 'Japeto', 'Saturno VIII'],
  tagline: 'Uma lua com duas cores: uma face muito escura e outra brilhante.',
  description: [
    'O hemisfério que segue à frente na órbita é muito escuro (albedo de 0,03 a 0,05), enquanto o outro é muito mais claro (0,5 a 0,6). A explicação mais provável é a segregação térmica: o material escuro aquece, o gelo sublima e volta a congelar nas zonas mais frias.',
    'Uma cadeia de montanhas com cerca de 10 km de altura percorre o equador.',
  ],
  phys: { r: 734.3, rUnc: 2.8, gm: 120.51511, density: 1.0887 },
  discovery: '25 de outubro de 1671, Giovanni Cassini',
  missions: [CASSINI],
  nasaSource: 'nasa-iapetus',
  color: '#9b9488',
  accent: '#c4bcae',
  mapNote: 'Mapa da NASA a partir de imagens da Cassini; a região negra é real (Cassini Regio).',
  query: 'Iapetus Saturn moon',
});

// ------------------------------------------------------------------ Úrano

export const miranda = moon({
  id: 'miranda',
  slug: 'miranda',
  parent: 'uranus',
  name: { 'pt-PT': 'Miranda', en: 'Miranda', es: 'Miranda' },
  aliases: ['Miranda', 'Úrano V'],
  tagline: 'A menor das grandes luas de Úrano, com uma das paisagens mais estranhas do Sistema Solar.',
  description: [
    'Miranda tem cerca de 500 km de diâmetro. Tem três grandes estruturas chamadas coronas, conjuntos de cristas e vales com poucas crateras, únicas entre os objetos conhecidos.',
    'Os seus desfiladeiros de falha chegam a ser 12 vezes mais profundos do que o Grand Canyon: uma rocha largada da falésia mais alta demoraria cerca de 10 minutos a chegar à base.',
  ],
  phys: { r: 235.8, rUnc: 0.7, gm: 4.3, density: 1.178 },
  retrogradeSpin: true,
  discovery: '16 de fevereiro de 1948, Gerard Kuiper',
  missions: [VOYAGER2_URANUS],
  nasaSource: 'nasa-miranda',
  color: '#a5a5a3',
  accent: '#c7c7c4',
  mapNote: UNMAPPED_URANUS,
  query: 'Miranda Uranus moon',
});

export const ariel = moon({
  id: 'ariel',
  slug: 'ariel',
  parent: 'uranus',
  name: { 'pt-PT': 'Ariel', en: 'Ariel', es: 'Ariel' },
  aliases: ['Ariel', 'Úrano I'],
  tagline: 'A mais brilhante das grandes luas de Úrano.',
  description: [
    'Ariel tem a superfície mais clara e, aparentemente, mais jovem das cinco grandes luas de Úrano. Vales e escarpas de falha cruzam o terreno cheio de crateras.',
  ],
  phys: { r: 578.9, rUnc: 0.6, gm: 83.5, density: 1.539 },
  retrogradeSpin: true,
  discovery: '1851, William Lassell',
  missions: [VOYAGER2_URANUS],
  nasaSource: 'nasa-uranus-moons',
  color: '#b3b2ae',
  accent: '#d0cfcb',
  mapNote: UNMAPPED_URANUS,
  query: 'Ariel Uranus moon',
});

export const umbriel = moon({
  id: 'umbriel',
  slug: 'umbriel',
  parent: 'uranus',
  name: { 'pt-PT': 'Umbriel', en: 'Umbriel', es: 'Umbriel' },
  aliases: ['Umbriel', 'Úrano II'],
  tagline: 'A mais escura das grandes luas de Úrano.',
  description: [
    'Umbriel tem uma superfície escura e antiga, muito marcada por crateras. Foi descoberta em 1851 por William Lassell, na mesma noite de observação de Ariel.',
  ],
  phys: { r: 584.7, rUnc: 2.8, gm: 85.1, density: 1.523 },
  retrogradeSpin: true,
  discovery: '1851, William Lassell',
  missions: [VOYAGER2_URANUS],
  nasaSource: 'nasa-uranus-moons',
  color: '#77756f',
  accent: '#9c9a93',
  mapNote: UNMAPPED_URANUS,
  query: 'Umbriel Uranus moon',
});

export const titania = moon({
  id: 'titania',
  slug: 'titania',
  parent: 'uranus',
  name: { 'pt-PT': 'Titânia', en: 'Titania', es: 'Titania' },
  aliases: ['Titania', 'Titânia', 'Úrano III'],
  tagline: 'A maior lua de Úrano.',
  description: [
    'Titânia é a maior das luas de Úrano, com quase 1600 km de diâmetro. Foi descoberta por William Herschel em 1787, tal como Oberon. As imagens da Voyager 2 mostram crateras e grandes sistemas de falhas.',
  ],
  phys: { r: 788.9, rUnc: 1.8, gm: 226.9, density: 1.653 },
  retrogradeSpin: true,
  discovery: '1787, William Herschel',
  missions: [VOYAGER2_URANUS],
  nasaSource: 'nasa-uranus-moons',
  color: '#a8a39c',
  accent: '#c9c3ba',
  mapNote: UNMAPPED_URANUS,
  query: 'Titania Uranus moon',
});

export const oberon = moon({
  id: 'oberon',
  slug: 'oberon',
  parent: 'uranus',
  name: { 'pt-PT': 'Oberon', en: 'Oberon', es: 'Oberón' },
  aliases: ['Oberon', 'Oberón', 'Úrano IV'],
  tagline: 'A segunda maior lua de Úrano e a mais afastada das cinco grandes.',
  description: [
    'Oberon é a segunda maior lua de Úrano e a mais exterior das cinco grandes. A superfície antiga está coberta de crateras, algumas com depósitos escuros no fundo.',
  ],
  phys: { r: 761.4, rUnc: 2.6, gm: 205.3, density: 1.664 },
  retrogradeSpin: true,
  discovery: '1787, William Herschel',
  missions: [VOYAGER2_URANUS],
  nasaSource: 'nasa-uranus-moons',
  color: '#9a948c',
  accent: '#bdb6ac',
  mapNote: UNMAPPED_URANUS,
  query: 'Oberon Uranus moon',
});

// ------------------------------------------------------------------ Neptuno e Plutão

export const triton = moon({
  id: 'triton',
  slug: 'tritao',
  parent: 'neptune',
  name: { 'pt-PT': 'Tritão', en: 'Triton', es: 'Tritón' },
  aliases: ['Triton', 'Tritão', 'Tritao', 'Tritón', 'Neptuno I'],
  tagline: 'A grande lua de Neptuno que orbita ao contrário, provavelmente capturada da cintura de Kuiper.',
  description: [
    'Tritão é a única grande lua do Sistema Solar que orbita em sentido contrário à rotação do seu planeta. Por isso, pensa-se que seja um objeto da cintura de Kuiper capturado pela gravidade de Neptuno.',
    'Em 1989, a Voyager 2 encontrou géiseres ativos e mediu à superfície cerca de −235 °C. A crosta de azoto congelado reflete cerca de 70% da luz solar.',
  ],
  phys: { r: 1352.6, rUnc: 2.4, gm: 1428.49546, density: 2.0649 },
  retrogradeSpin: true,
  discovery: '10 de outubro de 1846, William Lassell',
  extraFacts: [fact('meanTemperature', -235, '°C', 'measured', 'nasa-triton', { note: pt('Medida pela Voyager 2 em 1989.') })],
  structure: {
    layers: [
      layer('Crosta', 'Azoto congelado.'),
      layer('Manto', 'Gelo.'),
      layer('Núcleo', 'Rocha e metal, inferidos a partir da densidade média (cerca de 2 g/cm³).'),
    ],
    note: 'Modelo inferido.',
  },
  missions: [mission('Voyager 2', 'NASA', 'Sobrevoo em 1989', 'flyby', 'Única visita a Tritão; descobriu géiseres de azoto.')],
  nasaSource: 'nasa-triton',
  color: '#c2b5a6',
  accent: '#d9cbb9',
  mapNote: 'Mapa da NASA a partir das imagens da Voyager 2, que só fotografou parte da superfície; o resto aparece com um tom neutro uniforme.',
  query: 'Triton Neptune moon Voyager',
});

export const charon = moon({
  id: 'charon',
  slug: 'caronte',
  parent: 'pluto',
  name: { 'pt-PT': 'Caronte', en: 'Charon', es: 'Caronte' },
  aliases: ['Charon', 'Caronte', 'Plutão I'],
  tagline: 'A maior lua de Plutão, com metade do seu tamanho.',
  description: [
    'Caronte tem cerca de metade do diâmetro de Plutão: é o maior satélite conhecido em relação ao corpo que orbita. Os dois estão em rotação síncrona mútua e mostram sempre a mesma face um ao outro.',
    'A região polar norte, avermelhada, foi a característica mais marcante das imagens da New Horizons em 2015.',
  ],
  phys: { r: 606.0, rUnc: 0.5, gm: 106.1, density: 'derived' },
  discovery: 'Junho de 1978, James Christy e Robert Harrington',
  missions: [mission('New Horizons', 'NASA', 'Sobrevoo em 2015', 'flyby', 'Primeiras imagens detalhadas de Caronte.')],
  nasaSource: 'nasa-charon',
  color: '#9d958d',
  accent: '#c0b7ad',
  mapNote: 'Mapa da NASA a partir das imagens da New Horizons.',
  query: 'Charon Pluto moon New Horizons',
});

export const MOONS: readonly CelestialBody[] = [
  phobos,
  deimos,
  io,
  europa,
  ganymede,
  callisto,
  mimas,
  enceladus,
  tethys,
  dione,
  rhea,
  titan,
  iapetus,
  miranda,
  ariel,
  umbriel,
  titania,
  oberon,
  triton,
  charon,
];
