/**
 * Espaço profundo para além do catálogo Messier: objetos do céu austral que Messier não podia ver de Paris,
 * remanescentes de supernovas e pulsares. Cada valor tem a fonte ao lado; nada é estimado nesta aplicação a não
 * ser o que está marcado como calculado (conversões de unidades, tamanho real a partir do tamanho aparente).
 *
 * Posições, tipos, dimensões e magnitudes: OpenNGC (CC BY-SA 4.0) quando o objeto lá está; caso contrário, a fonte
 * indicada em cada objeto. Distâncias: fichas do Hubble Caldwell Catalog da NASA, comunicados da NASA/STScI/ESA e
 * artigos científicos (Nuvens de Magalhães e pulsar de Vela). Consultado a 21/10/2026.
 */
import type { ValueKind } from '../../data/types';
import type { DeepSkyCategory, DeepSkySubtype, SkyObject } from './deepSkyData';

export interface SourceRef {
  title: string;
  url: string;
}

export interface BeyondFact {
  label: string;
  value: string;
  kind: ValueKind;
  source: SourceRef;
  note?: string;
}

export type BeyondGroup = 'galaxies' | 'nebulae' | 'clusters' | 'remnants';

export interface BeyondObject extends SkyObject {
  catalog: 'beyond';
  group: BeyondGroup;
  namePt: string;
  /** Designações de catálogo (NGC 3372, Caldwell 92…). */
  designations: string[];
  /** Outros nomes para a pesquisa (em inglês, sem acentos…). */
  aliases: string[];
  tagline: string;
  description: string;
  /** Fonte da descrição. */
  descriptionSource: SourceRef;
  highlights: Array<{ text: string; source: SourceRef }>;
  distance?: { ly: number; approx: boolean; source: SourceRef; note?: string };
  /** Porque não indicamos distância, quando não há. */
  distanceMissing?: string;
  magSource?: SourceRef;
  magNote?: string;
  position: SourceRef;
  positionNote?: string;
  sizeSource?: SourceRef;
  hubbleType?: string;
  facts: BeyondFact[];
  imageQuery?: { q: string; mustInclude: string[] };
}

export const BEYOND_CHECKED = '2026-10-21';

// ------------------------------------------------------------------ fontes

const OPENNGC: SourceRef = { title: 'OpenNGC', url: 'https://github.com/mattiaverga/OpenNGC' };
const caldwell = (n: number): SourceRef => ({
  title: `NASA — Hubble Caldwell Catalog: Caldwell ${n}`,
  url: `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-${n}`,
});
const PIETRZYNSKI: SourceRef = { title: 'Pietrzyński et al. (2019), Nature — distância à Grande Nuvem de Magalhães com 1 % de precisão (arXiv:1903.08096)', url: 'https://arxiv.org/abs/1903.08096v1' };
const GRACZYK: SourceRef = { title: 'Graczyk et al. (2020), The Astrophysical Journal — distância à Pequena Nuvem de Magalhães (arXiv:2010.08754)', url: 'https://export.arxiv.org/abs/2010.08754' };
const WEBB_CARINA: SourceRef = { title: 'ESA/Webb — Cosmic Cliffs in Carina (weic2205a)', url: 'https://esawebb.org/images/weic2205a/' };
const WEBB_TARANTULA: SourceRef = { title: 'ESA/Webb — Tarantula Nebula (weic2212a)', url: 'https://esawebb.org/images/weic2212a/' };
const WEBB_RING: SourceRef = {
  title: 'NASA — Webb captures dying star’s final performance in fine detail (12/07/2022)',
  url: 'https://science.nasa.gov/universe/nebulae/nasas-webb-captures-dying-stars-final-performance-in-fine-detail',
};
const STSCI_HORSEHEAD: SourceRef = { title: 'STScI — Horsehead Nebula: Euclid, Hubble e Webb (2024)', url: 'https://www.astropix.org/image/stsci/2024-119c' };
const STSCI_VEIL: SourceRef = { title: 'STScI — Veil Nebula (Hubble, 2015)', url: 'https://www.astropix.org/image/stsci/2015-29a' };
const JPL_SN1987A: SourceRef = {
  title: 'NASA/JPL — Webb finds evidence for neutron star at heart of young supernova remnant (22/02/2024)',
  url: 'https://www.jpl.nasa.gov/news/webb-finds-evidence-for-neutron-star-at-heart-of-young-supernova-remnant/',
};
const HUBBLE_SN1987A: SourceRef = { title: 'ESA/Hubble — Image of Supernova 1987A (ann1111a)', url: 'https://www.astropix.org/image/esahubble/ann1111a' };
const WEBB_CASA: SourceRef = { title: 'NASA — Webb reveals never-before-seen details in Cassiopeia A (07/04/2023)', url: 'https://science.nasa.gov/missions/webb/webb-reveals-never-before-seen-details-in-cassiopeia-a/' };
const CHANDRA_CASA: SourceRef = { title: 'Chandra — First Light: Cassiopeia A (1999)', url: 'https://www.astropix.org/image/chandra/285' };
const DODSON: SourceRef = { title: 'Dodson et al. (2003) — paralaxe do pulsar de Vela por VLBI (arXiv:astro-ph/0302374)', url: 'https://arxiv.org/abs/astro-ph/0302374v1' };
const CHANDRA_VELA: SourceRef = { title: 'NASA/Chandra — Vela Pulsar (2013)', url: 'https://www.chandra.si.edu/photo/2013/vela/vela_hand.pdf' };
const NRAO_PULSAR: SourceRef = { title: 'NRAO — Tick Tock, Pulsating Star', url: 'https://public.nrao.edu/tick-tock-pulsating-star/' };
const LINDA_HALL_BELL: SourceRef = { title: 'Linda Hall Library — Jocelyn Bell Burnell', url: 'https://www.lindahall.org/about/news/scientist-of-the-day/jocelyn-bell-burnell' };
const WIKI_B1919: SourceRef = { title: 'Wikipédia (en) — PSR B1919+21 (coordenadas do SIMBAD)', url: 'https://en.wikipedia.org/wiki/PSR_B1919%2B21' };
const NOBEL_1993: SourceRef = { title: 'Prémio Nobel da Física de 1993 — comunicado de imprensa', url: 'https://www.nobelprize.org/prizes/physics/1993/press-release/' };
const WEISBERG: SourceRef = { title: 'Weisberg, Nice e Taylor (2010), ApJ 722, 1030 — temporização do PSR B1913+16 (arXiv:1011.0718)', url: 'https://ar5iv.arxiv.org/html/1011.0718' };
const WIKI_B1913: SourceRef = { title: 'Wikipédia (en) — Hulse–Taylor pulsar (coordenadas B1950 do SIMBAD)', url: 'https://en.wikipedia.org/wiki/Hulse%E2%80%93Taylor_pulsar' };

// ------------------------------------------------------------------ utilitários

/** "13:26:45.89" (horas) → graus. */
function hms(s: string): number {
  const [h, m, sec] = s.split(':').map(Number);
  return ((h ?? 0) + (m ?? 0) / 60 + (sec ?? 0) / 3600) * 15;
}

/** "-47:28:36.7" → graus. */
function dms(s: string): number {
  const neg = s.trim().startsWith('-');
  const [d, m, sec] = s.replace(/^[+-]/, '').split(':').map(Number);
  const v = (d ?? 0) + (m ?? 0) / 60 + (sec ?? 0) / 3600;
  return neg ? -v : v;
}

/** Anos-luz por parsec (IAU). */
export const LY_PER_PC = 3.26156;

const GROUP_CATEGORY: Record<BeyondGroup, DeepSkyCategory> = { galaxies: 'galaxy', nebulae: 'nebula', clusters: 'cluster', remnants: 'other' };

type Input = Omit<BeyondObject, 'catalog' | 'category' | 'ra' | 'dec' | 'distanceLy' | 'subtype'> & {
  subtype: DeepSkySubtype;
  raHms: string;
  decDms: string;
};

function make(o: Input): BeyondObject {
  const { raHms, decDms, ...rest } = o;
  return {
    ...rest,
    catalog: 'beyond',
    category: GROUP_CATEGORY[o.group],
    ra: hms(raHms),
    dec: dms(decDms),
    ...(o.distance ? { distanceLy: o.distance.ly } : {}),
  };
}

// ------------------------------------------------------------------ catálogo

export const BEYOND: readonly BeyondObject[] = [
  // ---------------------------------------------------------------- galáxias
  make({
    id: 'gnm',
    label: 'GNM',
    namePt: 'Grande Nuvem de Magalhães',
    group: 'galaxies',
    subtype: 'irregular',
    hubbleType: 'SBm',
    designations: ['ESO 56-115', 'Nubecula Major'],
    aliases: ['Large Magellanic Cloud', 'LMC', 'Grande Nuvem de Magalhaes', 'GNM'],
    raHms: '05:23:34.5',
    decDms: '-69:45:22',
    constellation: 'Dor',
    majorArcmin: 646,
    minorArcmin: 550,
    mag: 0.29,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: OPENNGC,
    distance: {
      ly: 162_000,
      approx: true,
      source: PIETRZYNSKI,
      note: '49,59 ± 0,09 (estatística) ± 0,54 (sistemática) quiloparsecs, medidos com 20 binárias eclipsantes; convertido para anos-luz nesta aplicação (1 pc = 3,26156 anos-luz).',
    },
    tagline: 'A galáxia mais brilhante do céu depois da Via Láctea (magnitude 0,3), visível a olho nu no hemisfério sul.',
    description:
      'Uma galáxia anã que orbita a Via Láctea. No céu austral vê-se a olho nu como uma mancha clara com mais de 10 graus de comprimento — cerca de 20 vezes o diâmetro da Lua cheia. Contém a Nebulosa da Tarântula e foi lá que explodiu a supernova SN 1987A.',
    descriptionSource: caldwell(103),
    highlights: [
      {
        text: 'A distância foi medida em 2019 com 1 % de precisão a partir de 20 binárias eclipsantes. É um degrau da escala de distâncias usada para medir a constante de Hubble, a taxa de expansão do Universo.',
        source: PIETRZYNSKI,
      },
      { text: 'Alberga a Nebulosa da Tarântula (30 Doradus): segundo a NASA, nenhuma região de formação de estrelas da nossa galáxia é tão grande ou tão prolífica.', source: caldwell(103) },
      { text: 'A supernova SN 1987A, observada da Terra em fevereiro de 1987, explodiu nesta galáxia.', source: JPL_SN1987A },
    ],
    facts: [],
    imageQuery: { q: 'Large Magellanic Cloud', mustInclude: ['large magellanic cloud', 'lmc'] },
  }),
  make({
    id: 'pnm',
    label: 'PNM',
    namePt: 'Pequena Nuvem de Magalhães',
    group: 'galaxies',
    subtype: 'irregular',
    hubbleType: 'SBm',
    designations: ['NGC 292', 'Nubecula Minor'],
    aliases: ['Small Magellanic Cloud', 'SMC', 'Pequena Nuvem de Magalhaes', 'PNM', 'NGC292'],
    raHms: '00:52:44.78',
    decDms: '-72:49:43.0',
    constellation: 'Tuc',
    majorArcmin: 299.92,
    minorArcmin: 179.89,
    mag: 2.3,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: OPENNGC,
    distance: {
      ly: 204_000,
      approx: true,
      source: GRACZYK,
      note: '62,44 ± 0,47 (estatística) ± 0,81 (sistemática) quiloparsecs, medidos com binárias eclipsantes; convertido para anos-luz nesta aplicação.',
    },
    tagline: 'Uma galáxia anã vizinha da Grande Nuvem, a cerca de 204 000 anos-luz.',
    description:
      'Galáxia anã irregular visível a olho nu no céu austral, na constelação do Tucano. No céu fica ao lado do enxame globular 47 Tucanae, mas este pertence à Via Láctea e está cerca de 12 vezes mais perto: é apenas um alinhamento na nossa linha de visão.',
    descriptionSource: GRACZYK,
    highlights: [
      { text: 'A distância foi medida em 2020 com uma precisão melhor do que 2 %, também com binárias eclipsantes de estrelas gigantes.', source: GRACZYK },
      { text: 'O enxame 47 Tucanae, que aparece ao lado, está a cerca de 16 700 anos-luz; a Pequena Nuvem, a cerca de 204 000 (razão calculada nesta aplicação).', source: caldwell(106) },
    ],
    facts: [],
    imageQuery: { q: 'Small Magellanic Cloud', mustInclude: ['small magellanic cloud', 'smc'] },
  }),
  make({
    id: 'ngc5128',
    label: 'Cen A',
    namePt: 'Centaurus A',
    group: 'galaxies',
    subtype: 'lenticular',
    hubbleType: 'S0',
    designations: ['NGC 5128', 'Caldwell 77'],
    aliases: ['Centaurus A', 'Cen A', 'Centauro A', 'NGC5128'],
    raHms: '13:25:27.62',
    decDms: '-43:01:08.8',
    constellation: 'Cen',
    majorArcmin: 25.88,
    minorArcmin: 19.77,
    mag: 7.22,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: OPENNGC,
    magNote: 'Magnitude V do OpenNGC. A NASA indica 6,7.',
    distance: { ly: 11_000_000, approx: true, source: caldwell(77) },
    tagline: 'A galáxia ativa mais próxima da Terra.',
    description:
      'A cerca de 11 milhões de anos-luz, é a galáxia ativa mais próxima. No centro, um buraco negro supermassivo vai consumindo os restos de material, e esse processo emite ondas de rádio, raios X e raios gama. Tem cerca de 60 000 anos-luz de diâmetro. A NASA descreve-a como uma galáxia elíptica peculiar; o OpenNGC classifica-a como S0 (lenticular).',
    descriptionSource: caldwell(77),
    highlights: [
      { text: 'Descoberta por James Dunlop em 1826.', source: caldwell(77) },
      { text: 'Um disco inclinado de gás quente, com 130 anos-luz, rodeia o buraco negro central.', source: caldwell(77) },
      { text: 'Supernovas: uma do tipo Ia em 1986, descoberta por Robert Evans, e outra em 2016.', source: caldwell(77) },
    ],
    facts: [{ label: 'Diâmetro', value: '≈ 60 000 anos-luz', kind: 'measured', source: caldwell(77) }],
    imageQuery: { q: 'Centaurus A', mustInclude: ['centaurus a', 'ngc 5128'] },
  }),
  make({
    id: 'ngc253',
    label: 'NGC 253',
    namePt: 'Galáxia do Escultor',
    group: 'galaxies',
    subtype: 'spiral',
    hubbleType: 'SABc',
    designations: ['NGC 253', 'Caldwell 65'],
    aliases: ['Sculptor Galaxy', 'Silver Coin', 'Silver Dollar', 'Galaxia do Escultor', 'NGC253'],
    raHms: '00:47:33.12',
    decDms: '-25:17:17.6',
    constellation: 'Scl',
    majorArcmin: 26.79,
    minorArcmin: 4.58,
    mag: 7.6,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: caldwell(65),
    magNote: 'Magnitude indicada pela NASA. A magnitude V do OpenNGC para este objeto (11,1) não é coerente com a magnitude B (7,9), por isso não a usamos.',
    distance: { ly: 10_000_000, approx: true, source: caldwell(65), note: 'Valor do texto da página da NASA; uma legenda da mesma página indica cerca de 13 milhões de anos-luz.' },
    tagline: 'Uma galáxia espiral em surto de formação de estrelas.',
    description:
      'Galáxia espiral vista quase de perfil (é seis vezes mais comprida do que larga no céu), a cerca de 10 milhões de anos-luz. As observações do Hubble mostraram que forma estrelas a um ritmo muito elevado, o que lhe vale a classificação de galáxia com surto de formação estelar (starburst).',
    descriptionSource: caldwell(65),
    highlights: [
      { text: 'Descoberta em 1783 por Caroline Herschel.', source: caldwell(65) },
      { text: 'Do hemisfério sul vê-se melhor na primavera; do norte, baixa no céu do sul, no outono.', source: caldwell(65) },
    ],
    facts: [],
    imageQuery: { q: 'NGC 253 Sculptor galaxy', mustInclude: ['ngc 253', 'sculptor'] },
  }),
  // ---------------------------------------------------------------- nebulosas
  make({
    id: 'ngc3372',
    label: 'NGC 3372',
    namePt: 'Nebulosa de Carina',
    group: 'nebulae',
    subtype: 'emission',
    designations: ['NGC 3372', 'Caldwell 92'],
    aliases: ['Carina Nebula', 'Eta Carinae Nebula', 'Nebulosa da Quilha', 'Nebulosa de Eta Carinae', 'NGC3372'],
    raHms: '10:45:08.53',
    decDms: '-59:52:00.1',
    constellation: 'Car',
    majorArcmin: 120,
    minorArcmin: 120,
    mag: 4.8,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: caldwell(92),
    magNote: 'Magnitude indicada pela NASA («cerca de 4,8»). O OpenNGC só tem magnitude B (3,0).',
    distance: { ly: 7_500, approx: true, source: caldwell(92) },
    tagline: 'Uma enorme região de formação de estrelas, com cerca de 300 anos-luz, onde está Eta Carinae.',
    description:
      'A cerca de 7500 anos-luz, na constelação da Quilha (Carina), vê-se a olho nu no céu austral. Tem cerca de 300 anos-luz e contém Eta Carinae, um sistema de pelo menos duas estrelas: a maior, Eta Car A, tem cerca de 100 vezes a massa do Sol e brilha 5 milhões de vezes mais.',
    descriptionSource: caldwell(92),
    highlights: [
      { text: 'Descoberta por Nicolas-Louis de Lacaille em 1752, a partir do cabo da Boa Esperança.', source: caldwell(92) },
      {
        text: 'Os «Penhascos Cósmicos» fotografados pelo Webb em infravermelho são a orla de uma cavidade de gás em NGC 3324, no canto noroeste da Nebulosa de Carina, a cerca de 7600 anos-luz.',
        source: WEBB_CARINA,
      },
    ],
    facts: [{ label: 'Diâmetro', value: '≈ 300 anos-luz', kind: 'measured', source: caldwell(92) }],
    imageQuery: { q: 'Carina Nebula', mustInclude: ['carina'] },
  }),
  make({
    id: 'ngc2070',
    label: '30 Dor',
    namePt: 'Nebulosa da Tarântula',
    group: 'nebulae',
    subtype: 'emission',
    designations: ['NGC 2070', '30 Doradus', 'Caldwell 103'],
    aliases: ['Tarantula Nebula', '30 Doradus', 'Nebulosa da Tarantula', 'NGC2070'],
    raHms: '05:38:42.36',
    decDms: '-69:06:03.2',
    constellation: 'Dor',
    majorArcmin: 16,
    minorArcmin: 16,
    mag: 4,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: caldwell(103),
    magNote: 'Magnitude indicada pela NASA. O OpenNGC indica V = 7,25 para NGC 2070.',
    distance: {
      ly: 170_000,
      approx: true,
      source: caldwell(103),
      note: 'Valor arredondado da NASA. A distância geométrica da Grande Nuvem de Magalhães, onde a nebulosa está, é de cerca de 162 000 anos-luz (Pietrzyński et al. 2019).',
    },
    tagline: 'Na Grande Nuvem de Magalhães, uma região de formação de estrelas maior do que qualquer uma da nossa galáxia.',
    description:
      'Fica na Grande Nuvem de Magalhães e é tão brilhante que se vê a olho nu do hemisfério sul (magnitude 4), apesar da distância. Segundo a NASA, nenhuma região de formação de estrelas da Via Láctea é tão grande ou tão prolífica.',
    descriptionSource: caldwell(103),
    highlights: [
      { text: 'Registada pela primeira vez por Nicolas-Louis de Lacaille em 1751.', source: caldwell(103) },
      { text: 'O mosaico do Webb de 2022 abrange 340 anos-luz e mostra dezenas de milhares de estrelas jovens que a poeira escondia.', source: WEBB_TARANTULA },
    ],
    facts: [],
    imageQuery: { q: 'Tarantula Nebula', mustInclude: ['tarantula', '30 doradus'] },
  }),
  make({
    id: 'ngc7293',
    label: 'NGC 7293',
    namePt: 'Nebulosa da Hélice',
    group: 'nebulae',
    subtype: 'planetary',
    designations: ['NGC 7293', 'Caldwell 63'],
    aliases: ['Helix Nebula', 'Nebulosa da Helice', 'NGC7293'],
    raHms: '22:29:38.57',
    decDms: '-20:50:14.4',
    constellation: 'Aqr',
    majorArcmin: 16.33,
    mag: 7.3,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: OPENNGC,
    distance: { ly: 650, approx: true, source: caldwell(63) },
    tagline: 'O que resta de uma estrela de massa média, a cerca de 650 anos-luz.',
    description:
      'Uma nebulosa planetária: as camadas exteriores expelidas por uma estrela de massa média no fim da vida, iluminadas pelo que resta dela. O anel brilhante tem quase três anos-luz e, no céu, ocupa quase metade da largura da Lua cheia.',
    descriptionSource: caldwell(63),
    highlights: [
      { text: 'Descoberta pelo astrónomo alemão Karl Ludwig Harding em 1823.', source: caldwell(63) },
      { text: 'Os «nós cometários» da orla interior têm cabeças pelo menos duas vezes maiores do que o Sistema Solar.', source: caldwell(63) },
    ],
    facts: [{ label: 'Diâmetro do anel brilhante', value: '≈ 3 anos-luz', kind: 'measured', source: caldwell(63) }],
    imageQuery: { q: 'Helix Nebula', mustInclude: ['helix'] },
  }),
  make({
    id: 'ngc3132',
    label: 'NGC 3132',
    namePt: 'Nebulosa do Anel do Sul',
    group: 'nebulae',
    subtype: 'planetary',
    designations: ['NGC 3132'],
    aliases: ['Southern Ring Nebula', 'Eight-Burst Nebula', 'Nebulosa do Anel do Sul', 'NGC3132'],
    raHms: '10:07:01.73',
    decDms: '-40:26:11.7',
    constellation: 'Vel',
    majorArcmin: 0.5,
    mag: 9.2,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: OPENNGC,
    distance: { ly: 2_500, approx: true, source: WEBB_RING },
    tagline: 'Duas estrelas em órbita apertada no centro de uma nebulosa planetária, fotografadas pelo Webb.',
    description:
      'Uma nebulosa planetária a cerca de 2500 anos-luz, moldada por duas estrelas em órbita apertada. A mais ténue, uma anã branca quente e densa, expele anéis de gás e poeira há milhares de anos; a mais brilhante está numa fase anterior da evolução e deverá, no futuro, criar a sua própria nebulosa planetária.',
    descriptionSource: WEBB_RING,
    highlights: [
      { text: 'Fotografada pelo Webb e divulgada a 12 de julho de 2022: pela primeira vez viu-se que a estrela mais ténue está rodeada de poeira.', source: WEBB_RING },
      { text: 'O movimento das duas estrelas mistura o gás e a poeira e cria os padrões assimétricos da nebulosa.', source: WEBB_RING },
    ],
    facts: [],
    imageQuery: { q: 'Southern Ring Nebula', mustInclude: ['southern ring', 'ngc 3132'] },
  }),
  make({
    id: 'b33',
    label: 'B33',
    namePt: 'Nebulosa Cabeça de Cavalo',
    group: 'nebulae',
    subtype: 'dark',
    designations: ['Barnard 33'],
    aliases: ['Horsehead Nebula', 'Barnard 33', 'Cabeca de Cavalo', 'B 33'],
    raHms: '05:40:59.0',
    decDms: '-02:27:30',
    constellation: 'Ori',
    majorArcmin: 6,
    minorArcmin: 4,
    position: OPENNGC,
    sizeSource: OPENNGC,
    distance: { ly: 1_300, approx: true, source: STSCI_HORSEHEAD },
    tagline: 'Uma nuvem de poeira em forma de cabeça de cavalo, recortada contra o brilho de IC 434.',
    description:
      'Uma nuvem densa de gás e poeira que bloqueia a luz da nebulosa de emissão IC 434, por trás dela. Fica a cerca de 1300 anos-luz, no lado ocidental da nuvem molecular Orion B, na constelação de Orion.',
    descriptionSource: STSCI_HORSEHEAD,
    highlights: [
      { text: 'Em 2024, o Webb obteve a imagem infravermelha mais nítida deste objeto até então.', source: STSCI_HORSEHEAD },
      { text: 'O Euclid (ESA) fotografou-a em novembro de 2023, em cerca de uma hora de observação.', source: STSCI_HORSEHEAD },
      { text: 'Foi a imagem do 23.º aniversário do Hubble, em 2013, em infravermelho.', source: STSCI_HORSEHEAD },
    ],
    facts: [],
    imageQuery: { q: 'Horsehead Nebula', mustInclude: ['horsehead'] },
  }),
  // ---------------------------------------------------------------- enxames
  make({
    id: 'ngc5139',
    label: 'ω Cen',
    namePt: 'Omega Centauri',
    group: 'clusters',
    subtype: 'globular',
    designations: ['NGC 5139', 'Caldwell 80'],
    aliases: ['Omega Centauri', 'omega Cen', 'Omega Centauro', 'NGC5139'],
    raHms: '13:26:45.89',
    decDms: '-47:28:36.7',
    constellation: 'Cen',
    majorArcmin: 27,
    mag: 5.33,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: OPENNGC,
    magNote: 'Magnitude V do OpenNGC. A NASA indica 3,7.',
    distance: { ly: 17_000, approx: true, source: caldwell(80) },
    tagline: 'Cerca de 10 milhões de estrelas: um enxame globular quase tão maciço como uma pequena galáxia.',
    description:
      'A cerca de 17 000 anos-luz, na constelação do Centauro, reúne cerca de 10 milhões de estrelas ligadas pela gravidade, num diâmetro de cerca de 450 anos-luz. É cerca de 10 vezes mais maciço do que outros grandes enxames globulares.',
    descriptionSource: caldwell(80),
    highlights: [
      { text: 'Ptolomeu registou-o há quase 2000 anos como uma estrela; Edmond Halley descreveu-o como nebulosa em 1677 e John Herschel identificou-o como enxame em 1836.', source: caldwell(80) },
      { text: 'Só se vê a latitudes setentrionais baixas e no hemisfério sul; a melhor época é o outono austral.', source: caldwell(80) },
    ],
    facts: [
      { label: 'Estrelas', value: '≈ 10 milhões', kind: 'estimate', source: caldwell(80) },
      { label: 'Diâmetro', value: '≈ 450 anos-luz', kind: 'measured', source: caldwell(80) },
    ],
    imageQuery: { q: 'Omega Centauri', mustInclude: ['omega centauri'] },
  }),
  make({
    id: 'ngc104',
    label: '47 Tuc',
    namePt: '47 Tucanae',
    group: 'clusters',
    subtype: 'globular',
    designations: ['NGC 104', 'Caldwell 106'],
    aliases: ['47 Tucanae', '47 Tuc', '47 do Tucano', 'NGC104'],
    raHms: '00:24:05.36',
    decDms: '-72:04:53.2',
    constellation: 'Tuc',
    majorArcmin: 31.8,
    mag: 4.09,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: OPENNGC,
    magNote: 'Magnitude V do OpenNGC. A NASA indica 4,0.',
    distance: { ly: 16_700, approx: true, source: caldwell(106) },
    tagline: 'Um enxame globular com pelo menos meio milhão de estrelas, ao lado da Pequena Nuvem de Magalhães.',
    description:
      'A cerca de 16 700 anos-luz, na constelação do Tucano, contém pelo menos meio milhão de estrelas e vê-se a olho nu. No céu fica junto à Pequena Nuvem de Magalhães, que está cerca de 12 vezes mais longe.',
    descriptionSource: caldwell(106),
    highlights: [
      { text: 'Descoberto por Nicolas-Louis de Lacaille em 1751.', source: caldwell(106) },
      { text: 'O Hubble seguiu anãs brancas jovens a afastarem-se do centro do enxame, numa migração lenta de cerca de 40 milhões de anos.', source: caldwell(106) },
    ],
    facts: [{ label: 'Estrelas', value: 'pelo menos 500 000', kind: 'estimate', source: caldwell(106) }],
    imageQuery: { q: '47 Tucanae', mustInclude: ['47 tucanae', '47 tuc'] },
  }),
  make({
    id: 'ngc4755',
    label: 'NGC 4755',
    namePt: 'Caixa de Joias',
    group: 'clusters',
    subtype: 'open',
    designations: ['NGC 4755', 'Caldwell 94', 'Enxame de Kappa Crucis'],
    aliases: ['Jewel Box', 'Kappa Crucis Cluster', 'Caixinha de Joias', 'NGC4755'],
    raHms: '12:53:37.08',
    decDms: '-60:21:22.7',
    constellation: 'Cru',
    majorArcmin: 7.8,
    mag: 4.2,
    position: OPENNGC,
    sizeSource: OPENNGC,
    magSource: caldwell(94),
    distance: { ly: 6_500, approx: true, source: caldwell(94) },
    tagline: 'Um enxame jovem de pouco mais de 100 estrelas, junto ao Cruzeiro do Sul.',
    description:
      'Um enxame aberto com cerca de 16 milhões de anos, a cerca de 6500 anos-luz, na constelação do Cruzeiro do Sul. Vê-se a olho nu (magnitude 4,2). A luz que vemos hoje partiu antes de as Grandes Pirâmides do Egito serem construídas.',
    descriptionSource: caldwell(94),
    highlights: [
      { text: 'Descoberto por Nicolas-Louis de Lacaille em 1752.', source: caldwell(94) },
      { text: 'A maioria dos enxames abertos dissolve-se em algumas centenas de milhões de anos.', source: caldwell(94) },
    ],
    facts: [
      { label: 'Idade', value: '≈ 16 milhões de anos', kind: 'estimate', source: caldwell(94) },
      { label: 'Estrelas', value: 'pouco mais de 100', kind: 'measured', source: caldwell(94) },
    ],
    imageQuery: { q: 'Jewel Box cluster NGC 4755', mustInclude: ['jewel box', 'ngc 4755'] },
  }),
  // ---------------------------------------------------------------- remanescentes e estrelas de neutrões
  make({
    id: 'ngc6960',
    label: 'NGC 6960',
    namePt: 'Nebulosa do Véu',
    group: 'remnants',
    subtype: 'snr',
    designations: ['NGC 6960', 'Caldwell 34', 'Laço do Cisne'],
    aliases: ['Veil Nebula', 'Cygnus Loop', 'Western Veil', 'Witch’s Broom', 'Vassoura da Bruxa', 'Laco do Cisne', 'Nebulosa do Veu', 'NGC6960'],
    raHms: '20:45:58.18',
    decDms: '+30:35:42.5',
    constellation: 'Cyg',
    majorArcmin: 210,
    minorArcmin: 160,
    position: OPENNGC,
    positionNote: 'Posição de NGC 6960, o filamento ocidental. O remanescente completo, o Laço do Cisne, estende-se por cerca de 3,5° (tamanho do OpenNGC).',
    sizeSource: OPENNGC,
    distance: { ly: 2_100, approx: true, source: STSCI_VEIL, note: 'O comunicado do Hubble indica 2100 anos-luz (640 parsecs); a ficha Caldwell da NASA arredonda para 2000.' },
    tagline: 'Os filamentos de uma estrela que explodiu há milhares de anos, espalhados por seis luas cheias de céu.',
    description:
      'Restos de uma estrela com cerca de 20 vezes a massa do Sol que explodiu como supernova. A onda de choque continua a embater em gás interestelar mais denso e faz brilhar os filamentos. O remanescente tem cerca de 110 anos-luz de diâmetro e fica a cerca de 2100 anos-luz.',
    descriptionSource: STSCI_VEIL,
    highlights: [
      { text: 'William Herschel identificou-a em 1784; Williamina Fleming descobriu em 1904 uma parte mais ténue, o Triângulo de Pickering.', source: caldwell(34) },
      { text: 'Idade: o comunicado do Hubble de 2015 indica que a explosão foi há cerca de 8000 anos; a ficha Caldwell da NASA fala apenas em «vários milhares de anos».', source: STSCI_VEIL },
      { text: 'Comparando imagens do Hubble de 1997 e de 2015, vê-se a expansão do remanescente ao longo de 18 anos.', source: caldwell(34) },
    ],
    facts: [
      { label: 'Diâmetro', value: '≈ 110 anos-luz', kind: 'measured', source: STSCI_VEIL },
      { label: 'Massa da estrela que explodiu', value: '≈ 20 massas solares', kind: 'estimate', source: STSCI_VEIL },
    ],
    imageQuery: { q: 'Veil Nebula', mustInclude: ['veil'] },
  }),
  make({
    id: 'sn1987a',
    label: 'SN 1987A',
    namePt: 'Supernova 1987A',
    group: 'remnants',
    subtype: 'snr',
    designations: ['SN 1987A'],
    aliases: ['SN 1987A', 'SN1987A', 'Supernova 1987A'],
    raHms: '05:35:28.0',
    decDms: '-69:16:11.2',
    constellation: 'Dor',
    position: HUBBLE_SN1987A,
    positionNote: 'Centro da imagem do Hubble de 2011 (ICRS).',
    distance: { ly: 160_000, approx: true, source: JPL_SN1987A },
    tagline: 'Uma estrela que explodiu na Grande Nuvem de Magalhães, vista da Terra em fevereiro de 1987.',
    description:
      'A supernova foi observada pela primeira vez em fevereiro de 1987 e atingiu o brilho máximo em maio. Cerca de duas horas antes da primeira observação em luz visível, três observatórios detetaram uma rajada de neutrinos que durou apenas alguns segundos.',
    descriptionSource: JPL_SN1987A,
    highlights: [
      {
        text: 'Em 2024, o Webb detetou no centro do remanescente sinais fortes de árgon ionizado: a melhor prova até hoje da emissão de uma estrela de neutrões recém-nascida (Fransson et al., revista Science).',
        source: JPL_SN1987A,
      },
      { text: 'Está a cerca de 160 000 anos-luz: a luz da explosão viajou esse tempo até chegar à Terra.', source: JPL_SN1987A },
    ],
    facts: [{ label: 'Observada pela primeira vez', value: 'fevereiro de 1987', kind: 'measured', source: JPL_SN1987A }],
    imageQuery: { q: 'SN 1987A', mustInclude: ['1987a'] },
  }),
  make({
    id: 'cas-a',
    label: 'Cas A',
    namePt: 'Cassiopeia A',
    group: 'remnants',
    subtype: 'snr',
    designations: ['Cassiopeia A'],
    aliases: ['Cassiopeia A', 'Cas A', 'CasA'],
    raHms: '23:23:27.4',
    decDms: '+58:48:50.6',
    constellation: 'Cas',
    position: CHANDRA_CASA,
    positionNote: 'Centro da imagem de «primeira luz» do Chandra (ICRS), que mostra o remanescente inteiro.',
    distance: { ly: 11_000, approx: true, source: WEBB_CASA, note: 'Algumas páginas mais antigas da NASA e da ESA indicam 10 000 anos-luz.' },
    tagline: 'O remanescente de uma supernova cuja luz chegou à Terra há cerca de 340 anos.',
    description:
      'Restos de uma estrela que explodiu a cerca de 11 000 anos-luz, na constelação de Cassiopeia. Vista da Terra, a explosão aconteceu há cerca de 340 anos; hoje o remanescente tem cerca de 10 anos-luz de diâmetro.',
    descriptionSource: WEBB_CASA,
    highlights: [
      { text: 'Foi o objeto da imagem de «primeira luz» do observatório de raios X Chandra, divulgada em agosto de 1999.', source: CHANDRA_CASA },
      { text: 'O Webb fotografou-o em infravermelho em 2023, com pormenores nunca vistos.', source: WEBB_CASA },
    ],
    facts: [{ label: 'Diâmetro', value: '≈ 10 anos-luz', kind: 'measured', source: WEBB_CASA }],
    imageQuery: { q: 'Cassiopeia A', mustInclude: ['cassiopeia a', 'cas a'] },
  }),
  make({
    id: 'pulsar-vela',
    label: 'PSR B0833−45',
    namePt: 'Pulsar de Vela',
    group: 'remnants',
    subtype: 'pulsar',
    designations: ['PSR B0833−45', 'PSR J0835−4510'],
    aliases: ['Vela pulsar', 'Pulsar das Velas', 'B0833-45', 'J0835-4510', 'PSR B0833-45'],
    raHms: '08:35:20.61153',
    decDms: '-45:10:34.8755',
    constellation: 'Vel',
    position: DODSON,
    positionNote: 'Posição medida por VLBI para a época 2000,0.',
    distance: {
      ly: 956,
      approx: true,
      source: DODSON,
      note: '293 (+19/−17) parsecs, a partir de uma paralaxe de 3,4 ± 0,2 milissegundos de arco; convertido para anos-luz nesta aplicação. A NASA (Chandra) arredonda para cerca de 1000 anos-luz.',
    },
    tagline: 'Uma estrela de neutrões que dá mais de 11 voltas por segundo.',
    description:
      'O que resta do núcleo de uma estrela que explodiu como supernova na constelação da Vela: uma estrela de neutrões que roda mais de 11 vezes por segundo. Como um farol, emite feixes de radiação que varrem a Terra a cada rotação.',
    descriptionSource: CHANDRA_VELA,
    highlights: [
      { text: 'A distância foi medida geometricamente: uma paralaxe de 3,4 ± 0,2 milissegundos de arco, obtida com radiotelescópios afastados (VLBI), equivale a 293 parsecs.', source: DODSON },
      { text: 'A NASA indica que fica a cerca de 1000 anos-luz e dá mais de 11 rotações completas por segundo.', source: CHANDRA_VELA },
    ],
    facts: [{ label: 'Rotação', value: 'mais de 11 voltas por segundo', kind: 'measured', source: CHANDRA_VELA }],
    imageQuery: { q: 'Vela pulsar', mustInclude: ['vela pulsar'] },
  }),
  make({
    id: 'psr-b1919',
    label: 'PSR B1919+21',
    namePt: 'PSR B1919+21',
    group: 'remnants',
    subtype: 'pulsar',
    designations: ['CP 1919', 'PSR J1921+2153'],
    aliases: ['CP 1919', 'LGM-1', 'PSR B1919+21', 'B1919+21', 'primeiro pulsar', 'first pulsar'],
    raHms: '19:21:44.815',
    decDms: '+21:53:02.25',
    constellation: 'Vul',
    position: WIKI_B1919,
    positionNote: 'Coordenadas J2000 do SIMBAD, tal como indicadas na Wikipédia.',
    distanceMissing: 'As estimativas publicadas têm uma incerteza muito grande (300 parsecs, com margem de −200 a +800), por isso não indicamos um valor.',
    tagline: 'O primeiro pulsar descoberto, em 1967.',
    description:
      'Em 1967, Jocelyn Bell Burnell, então estudante de doutoramento, reparou num sinal invulgar nos registos de um radiotelescópio que ela e outros quatro estudantes tinham construído. O sinal repetia-se com uma regularidade notável, um impulso a cada 1,33730 segundos. Era o primeiro pulsar: uma estrela de neutrões em rotação.',
    descriptionSource: NRAO_PULSAR,
    highlights: [
      { text: 'O NRAO data de 6 de agosto de 1967 a primeira vez que Bell Burnell reparou no sinal, uma pequena «sujidade» no papel do registador.', source: NRAO_PULSAR },
      { text: 'A Linda Hall Library situa a 28 de novembro de 1967 o dia em que ela viu que o registador tinha captado algo estranho.', source: LINDA_HALL_BELL },
      { text: 'Em 1974, o orientador de Bell Burnell, Antony Hewish, recebeu metade do Prémio Nobel da Física pela descoberta dos pulsares; a outra metade foi para Martin Ryle, por outro trabalho.', source: LINDA_HALL_BELL },
    ],
    facts: [{ label: 'Período dos impulsos', value: '1,33730 s', kind: 'measured', source: NRAO_PULSAR }],
  }),
  make({
    id: 'psr-b1913',
    label: 'PSR B1913+16',
    namePt: 'Pulsar de Hulse–Taylor',
    group: 'remnants',
    subtype: 'pulsar',
    designations: ['PSR B1913+16', 'PSR J1915+1606'],
    aliases: ['Hulse-Taylor', 'Hulse–Taylor', 'binary pulsar', 'pulsar binário', 'PSR B1913+16', 'B1913+16'],
    raHms: '19:15:28.01',
    decDms: '+16:06:27.6',
    constellation: 'Aql',
    position: WIKI_B1913,
    positionNote: 'Calculada nesta aplicação a partir das coordenadas B1950 do SIMBAD (indicadas na Wikipédia), com a conversão FK4 → ICRS da biblioteca astropy.',
    distanceMissing: 'As estimativas de distância publicadas variam muito, por isso não indicamos um valor.',
    tagline: 'O primeiro pulsar binário e a primeira prova, ainda que indireta, das ondas gravitacionais.',
    description:
      'Descoberto em 1974 por Russell Hulse e Joseph Taylor com o radiotelescópio de 300 metros de Arecibo, em Porto Rico. É um pulsar que roda cerca de 17 vezes por segundo (um impulso a cada 0,05903 s) e está em órbita de uma companheira, com um período orbital inferior a oito horas.',
    descriptionSource: NOBEL_1993,
    highlights: [
      { text: 'A órbita está a encolher: o período orbital diminui cerca de 75 milionésimos de segundo por ano, porque o sistema perde energia sob a forma de ondas gravitacionais.', source: NOBEL_1993 },
      { text: 'A diminuição observada é 0,997 ± 0,002 vezes a prevista pela relatividade geral de Einstein.', source: WEISBERG },
      { text: 'Hulse e Taylor receberam o Prémio Nobel da Física de 1993 por esta descoberta.', source: NOBEL_1993 },
    ],
    facts: [
      { label: 'Período de rotação', value: '0,05903 s', kind: 'measured', source: NOBEL_1993 },
      { label: 'Período orbital', value: 'menos de 8 horas', kind: 'measured', source: NOBEL_1993 },
      { label: 'Diminuição do período orbital', value: '≈ 75 µs por ano', kind: 'measured', source: NOBEL_1993 },
    ],
  }),
];

export const BEYOND_GROUPS: ReadonlyArray<{ group: BeyondGroup; ids: string[] }> = (['galaxies', 'nebulae', 'clusters', 'remnants'] as const).map((group) => ({
  group,
  ids: BEYOND.filter((o) => o.group === group).map((o) => o.id),
}));

export function findBeyond(id: string): BeyondObject | undefined {
  const key = id.toLowerCase();
  return BEYOND.find((o) => o.id === key);
}

/** Todas as fontes de um objeto, sem repetições, pela ordem em que aparecem. */
export function beyondSources(o: BeyondObject): SourceRef[] {
  const all = [
    o.position,
    ...(o.sizeSource ? [o.sizeSource] : []),
    ...(o.magSource ? [o.magSource] : []),
    ...(o.distance ? [o.distance.source] : []),
    o.descriptionSource,
    ...o.highlights.map((h) => h.source),
    ...o.facts.map((f) => f.source),
  ];
  return [...new Map(all.map((s) => [s.url, s])).values()];
}
