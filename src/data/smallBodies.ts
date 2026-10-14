import type { ValueKind } from './types';

/**
 * Asteroides, cometas, planetas anões transneptunianos e visitantes interestelares selecionados.
 *
 * Órbitas: elementos osculadores do JPL Horizons em várias épocas (public/data/small-bodies.json, gerado por
 * scripts/build_small_bodies.py a partir das respostas guardadas em scripts/data/small-bodies/).
 * Dados físicos e de descoberta: JPL Small-Body Database (SBDB), com a referência de cada valor tal como a SBDB a
 * indica (scripts/data/small-bodies/sbdb-physical.txt), e páginas da NASA/ESA quando a SBDB não tem o valor.
 * Consultados em 14/10/2026.
 */

export const SMALL_BODIES_CHECKED = '2026-10-14';

export type SmallBodyKind = 'asteroid' | 'tno' | 'comet' | 'interstellar';

export type OrbitClass =
  | 'main-belt'
  | 'apollo'
  | 'aten'
  | 'amor'
  | 'trojan'
  | 'tno'
  | 'jupiter-family'
  | 'halley-type'
  | 'encke-type'
  | 'long-period'
  | 'hyperbolic';

export interface SourceRef {
  title: string;
  url: string;
}

export interface SmallFact {
  label: string;
  value: string;
  kind: ValueKind;
  source: SourceRef;
  note?: string;
}

export interface SmallBodyMission {
  /** Id da ficha de missão na aplicação, quando existe. */
  missionId?: string;
  name: string;
  when: string;
  text: string;
  source?: SourceRef;
}

export interface SmallBody {
  /** Chave dos dados orbitais (small-bodies.json). */
  id: string;
  slug: string;
  name: string;
  designation: string;
  aliases: string[];
  kind: SmallBodyKind;
  /** Planeta anão reconhecido pela IAU. */
  dwarf?: boolean;
  orbitClass: OrbitClass;
  /** Objeto próximo da Terra (NEO) e potencialmente perigoso (PHA), segundo a SBDB. */
  neo: boolean;
  pha: boolean;
  tagline: string;
  description: string;
  highlights: string[];
  facts: SmallFact[];
  discovery: { text: string; source: SourceRef };
  missions: SmallBodyMission[];
  /** Nota sobre a precisão da posição (encontros próximos, épocas). */
  orbitNote?: string;
  accent: string;
  imageQuery?: { q: string; mustInclude: string[] };
}

const sbdb = (sstr: string, label: string): SourceRef => ({
  title: `JPL Small-Body Database — ${label}`,
  url: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(sstr)}`,
});
const nasa = (path: string, title: string): SourceRef => ({ title: `NASA Science — ${title}`, url: `https://science.nasa.gov/${path}` });
const doi = (id: string, title: string): SourceRef => ({ title, url: `https://doi.org/${id}` });

const f = (label: string, value: string, kind: ValueKind, source: SourceRef, note?: string): SmallFact =>
  note ? { label, value, kind, source, note } : { label, value, kind, source };

const LCDB_NOTE = 'Curva de luz com cobertura incompleta: a base de dados avisa que o período pode estar errado em cerca de 30 %.';
const ROT = 'Período de rotação';
const DIAM = 'Diâmetro';
const DIM = 'Dimensões';
const DENS = 'Densidade';
const MASS = 'Massa';
const ALB = 'Albedo geométrico';
const SPEC = 'Tipo espectral';
const HMAG = 'Magnitude absoluta (H)';
const NUC = 'Núcleo';

const COLORS: Record<SmallBodyKind, string> = {
  asteroid: '#c9a77c',
  tno: '#9fb7d9',
  comet: '#7fd6e0',
  interstellar: '#e39ad1',
};

export const SMALL_BODIES: SmallBody[] = [
  // ——————————————————————————————————————————————————————— Cintura principal
  (() => {
    const s = sbdb('4', '4 Vesta');
    return {
      id: 'vesta',
      slug: 'vesta',
      name: 'Vesta',
      designation: '4 Vesta',
      aliases: ['4 Vesta', 'Vesta', 'A807 FA', 'Dawn'],
      kind: 'asteroid',
      orbitClass: 'main-belt',
      neo: false,
      pha: false,
      tagline: 'O segundo corpo mais massivo da cintura de asteroides, um pequeno mundo diferenciado com núcleo de ferro.',
      description:
        'Vesta foi estudado de perto pela sonda Dawn, que o orbitou entre 2011 e 2012. Tem crosta, manto e núcleo, como os planetas rochosos, e no polo sul guarda a enorme bacia de impacto Rheasilvia. É também a origem provável de um grupo de meteoritos encontrados na Terra (os HED).',
      highlights: [
        'A bacia Rheasilvia tem cerca de 500 km de diâmetro, quase tanto como o próprio Vesta, e um pico central entre os mais altos do Sistema Solar.',
        'Os meteoritos HED (howarditos, eucritos e diogenitos) têm composição semelhante à superfície medida pela Dawn.',
      ],
      facts: [
        f(DIAM, '522,77 ± 0,1 km', 'measured', s, 'Park et al. (2025), Nature Astronomy.'),
        f(DIM, '569,24 × 554,48 × 452,66 km', 'measured', s, 'Park et al. (2025).'),
        f(MASS, '2,59 × 10²⁰ kg', 'derived', s, 'Calculado: GM = 17,2882844 km³/s² (Park et al. 2025) dividido por G.'),
        f(DENS, '3,460 ± 0,005 g/cm³', 'measured', s, 'Park et al. (2025).'),
        f(ROT, '5,3421276 h', 'measured', s, 'Park et al. (2025).'),
        f(ALB, '0,42 ± 0,05', 'measured', s, 'IRAS.'),
        f(SPEC, 'V', 'measured', s, 'Classificação de Tholen e de Bus e Binzel.'),
        f(HMAG, '3,25', 'measured', s),
      ],
      discovery: { text: '29 de março de 1807, por Heinrich Wilhelm Olbers, em Bremen.', source: s },
      missions: [
        { missionId: 'dawn', name: 'Dawn', when: '2011–2012', text: 'Em órbita de Vesta durante cerca de 14 meses, antes de seguir para Ceres.' },
      ],
      accent: COLORS.asteroid,
      imageQuery: { q: 'Vesta Dawn', mustInclude: ['vesta'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('2', '2 Pallas');
    return {
      id: 'pallas',
      slug: 'palas',
      name: 'Palas',
      designation: '2 Palas',
      aliases: ['2 Pallas', 'Pallas', 'Palas', 'A802 FA'],
      kind: 'asteroid',
      orbitClass: 'main-belt',
      neo: false,
      pha: false,
      tagline: 'Um dos maiores asteroides, numa órbita muito inclinada em relação à dos planetas.',
      description:
        'Palas foi o segundo asteroide a ser descoberto, um ano depois de Ceres. A sua órbita está inclinada cerca de 35° em relação à eclíptica, o que torna difícil enviar-lhe uma sonda. Imagens do Very Large Telescope mostraram uma superfície coberta de crateras.',
      highlights: [
        'A inclinação da órbita (cerca de 35°) é muito maior do que a de Ceres ou Vesta.',
        'A superfície crivada de crateras sugere muitos impactos a grande velocidade, consequência da órbita inclinada.',
      ],
      facts: [
        f(DIAM, '513 ± 6 km', 'measured', s, 'Marsset et al. (2020), Nature Astronomy, com ótica adaptativa.'),
        f(DIM, '568 × 532 × 448 km', 'measured', s, 'Marsset et al. (2020).'),
        f(MASS, '2,04 × 10²⁰ kg', 'derived', s, 'Calculado: GM = 13,63 ± 0,18 km³/s² (Vernazza et al. 2021) dividido por G.'),
        f(DENS, '2,89 ± 0,08 g/cm³', 'measured', s, 'Marsset et al. (2020).'),
        f(ROT, '7,8132214 h', 'measured', s, 'Carry et al. (2010).'),
        f(ALB, '0,155', 'measured', s, 'Vernazza et al. (2021).'),
        f(SPEC, 'B', 'measured', s),
        f(HMAG, '4,12', 'measured', s),
      ],
      discovery: { text: '28 de março de 1802, por Heinrich Wilhelm Olbers, em Bremen.', source: s },
      missions: [],
      accent: COLORS.asteroid,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('16', '16 Psyche');
    return {
      id: 'psyche',
      slug: 'psique',
      name: 'Psique',
      designation: '16 Psique',
      aliases: ['16 Psyche', 'Psyche', 'Psique', 'A852 FA', 'asteroide metálico'],
      kind: 'asteroid',
      orbitClass: 'main-belt',
      neo: false,
      pha: false,
      tagline: 'Um asteroide invulgarmente denso, possivelmente rico em metal, destino da sonda Psyche.',
      description:
        'A densidade e o brilho no radar de Psique sugerem uma grande proporção de metal. Uma hipótese é que seja parte do núcleo de um corpo diferenciado que perdeu as camadas exteriores em colisões; outra é que seja uma mistura de rocha e metal. A sonda Psyche da NASA, lançada em 2023, deverá chegar em 2029 para o esclarecer.',
      highlights: [
        'A densidade (cerca de 4,2 g/cm³) é bem maior do que a da maioria dos asteroides.',
        'A origem como núcleo exposto de um protoplaneta é uma hipótese, não uma conclusão.',
      ],
      facts: [
        f(DIAM, '222 km (−1/+4)', 'measured', s, 'Shepard et al. (2021), Planetary Science Journal.'),
        f(DIM, '278 × 238 × 171 km', 'measured', s, 'Shepard et al. (2021).'),
        f(MASS, '2,40 × 10¹⁹ kg', 'derived', s, 'Calculado: GM = 1,601 ± 0,017 km³/s² (Farnocchia et al. 2024) dividido por G.'),
        f(DENS, '4,17 ± 0,15 g/cm³', 'measured', s, 'Farnocchia et al. (2024).'),
        f(ROT, '4,196 h', 'measured', s, 'Lightcurve Database (Warner et al.).'),
        f(ALB, '0,120 ± 0,004', 'measured', s, 'IRAS.'),
        f(SPEC, 'M (Tholen) · X (Bus e Binzel)', 'measured', s),
        f(HMAG, '6,20', 'measured', s),
      ],
      discovery: { text: '17 de março de 1852, por Annibale de Gasparis, em Nápoles.', source: s },
      missions: [{ missionId: 'psyche', name: 'Psyche', when: 'chegada prevista em 2029', text: 'Primeira missão a um asteroide possivelmente metálico.' }],
      accent: COLORS.asteroid,
    } satisfies SmallBody;
  })(),
  // ——————————————————————————————————————————————————————— Próximos da Terra
  (() => {
    const s = sbdb('433', '433 Eros');
    return {
      id: 'eros',
      slug: 'eros',
      name: 'Eros',
      designation: '433 Eros',
      aliases: ['433 Eros', 'Eros', 'A898 PA', 'NEAR Shoemaker'],
      kind: 'asteroid',
      orbitClass: 'amor',
      neo: true,
      pha: false,
      tagline: 'O primeiro asteroide próximo da Terra a ser descoberto e o primeiro a ser orbitado por uma sonda.',
      description:
        'Eros é um asteroide alongado do grupo Amor: aproxima-se da órbita da Terra sem a cruzar. Em 2000 a sonda NEAR Shoemaker entrou em órbita à sua volta e, em fevereiro de 2001, pousou na superfície, embora não tivesse sido concebida para isso.',
      highlights: [
        'A NEAR Shoemaker foi a primeira sonda a orbitar e a pousar num asteroide.',
        'Tem uma forma de amendoim alongado, com cerca de 34 km de comprimento.',
      ],
      facts: [
        f(DIAM, '16,84 ± 0,06 km', 'derived', s, 'Diâmetro da esfera com o volume medido (2503 ± 25 km³), Yeomans et al. (2000).'),
        f(DIM, '34,4 × 11,2 × 11,2 km', 'measured', s, 'Veverka et al. (2000).'),
        f(MASS, '6,69 × 10¹⁵ kg', 'derived', s, 'Calculado: GM = 4,463 × 10⁻⁴ km³/s² (Yeomans et al. 2000) dividido por G.'),
        f(DENS, '2,67 ± 0,03 g/cm³', 'measured', s, 'Yeomans et al. (2000); porosidade estimada de 10 a 30 %.'),
        f(ROT, '5,27 h', 'measured', s, 'Lightcurve Database.'),
        f(ALB, '0,25 ± 0,06', 'measured', s, 'Veverka et al. (2000).'),
        f(SPEC, 'S', 'measured', s),
        f(HMAG, '10,40', 'measured', s),
      ],
      discovery: { text: '13 de agosto de 1898, por Gustav Witt, em Berlim.', source: s },
      missions: [
        {
          name: 'NEAR Shoemaker (NASA)',
          when: '2000–2001',
          text: 'Em órbita a partir de 14 de fevereiro de 2000; pousou a 12 de fevereiro de 2001.',
          source: nasa('mission/near-shoemaker/', 'NEAR Shoemaker'),
        },
      ],
      accent: COLORS.asteroid,
      imageQuery: { q: 'Eros NEAR', mustInclude: ['eros'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('25143', '25143 Itokawa');
    return {
      id: 'itokawa',
      slug: 'itokawa',
      name: 'Itokawa',
      designation: '25143 Itokawa',
      aliases: ['25143 Itokawa', 'Itokawa', '1998 SF36', 'Hayabusa'],
      kind: 'asteroid',
      orbitClass: 'apollo',
      neo: true,
      pha: true,
      tagline: 'Um pequeno "monte de entulho" de onde vieram as primeiras amostras de um asteroide.',
      description:
        'Itokawa é um asteroide do tipo S com pouco mais de meio quilómetro, formado por blocos e cascalho mal agregados: quase metade do volume é espaço vazio. A sonda japonesa Hayabusa visitou-o em 2005 e trouxe partículas da superfície para a Terra em 2010.',
      highlights: [
        'Porosidade de cerca de 41 %: é um agregado de fragmentos, não uma rocha maciça.',
        'As partículas trazidas pela Hayabusa confirmaram a ligação entre os asteroides do tipo S e os meteoritos condritos comuns.',
      ],
      facts: [
        f(DIAM, '0,33 km', 'derived', s, 'Esferoide com o mesmo volume (1,84 × 10⁷ m³), Fujiwara et al. (2006), Science.'),
        f(DIM, '535 × 294 × 209 m', 'measured', s, 'Fujiwara et al. (2006).'),
        f(MASS, '3,51 × 10¹⁰ kg (± 3 %)', 'measured', s, 'Fujiwara et al. (2006).'),
        f(DENS, '1,9 ± 0,13 g/cm³', 'measured', s),
        f(ROT, '12,132 h', 'measured', s, 'Lightcurve Database.'),
        f(SPEC, 'S(IV)', 'measured', s, 'Binzel et al. (2001).'),
        f(HMAG, '19,26', 'measured', s),
      ],
      discovery: { text: '26 de setembro de 1998, pelo programa LINEAR, em Socorro (Novo México).', source: s },
      missions: [
        {
          name: 'Hayabusa (JAXA)',
          when: '2005–2010',
          text: 'Chegou a Itokawa em setembro de 2005 e a cápsula com as partículas aterrou na Austrália a 13 de junho de 2010.',
          source: { title: 'JAXA — Hayabusa', url: 'https://global.jaxa.jp/projects/sas/hayabusa/' },
        },
      ],
      orbitNote: 'Os encontros próximos com a Terra alteram ligeiramente a órbita: entre 1991 e 2041 usam-se épocas de 5 em 5 anos.',
      accent: COLORS.asteroid,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('162173', '162173 Ryugu');
    return {
      id: 'ryugu',
      slug: 'ryugu',
      name: 'Ryugu',
      designation: '162173 Ryugu',
      aliases: ['162173 Ryugu', 'Ryugu', '1999 JU3', 'Hayabusa2'],
      kind: 'asteroid',
      orbitClass: 'apollo',
      neo: true,
      pha: true,
      tagline: 'Um asteroide escuro em forma de pião, rico em carbono, de onde a Hayabusa2 trouxe amostras.',
      description:
        'Ryugu é um asteroide do tipo C (carbonáceo), muito escuro e poroso, com a forma de um pião. A Hayabusa2 estudou-o de 2018 a 2019, recolheu material da superfície e de uma cratera artificial, e enviou-o para a Terra em dezembro de 2020.',
      highlights: [
        'Reflete apenas cerca de 4,5 % da luz que recebe: é mais escuro do que o carvão.',
        'A densidade de 1,19 g/cm³ indica um agregado muito poroso.',
      ],
      facts: [
        f(DIAM, '896 ± 4 m', 'measured', s, 'Watanabe et al. (2019), Science.'),
        f(DIM, '1004 × 876 m', 'measured', s, 'Watanabe et al. (2019).'),
        f(MASS, '4,5 × 10¹¹ kg', 'derived', s, 'Calculado: GM = 3,00 × 10⁻⁸ km³/s² (Watanabe et al. 2019) dividido por G.'),
        f(DENS, '1,19 ± 0,02 g/cm³', 'measured', s),
        f(ROT, '7,63262 h', 'measured', s, 'Watanabe et al. (2019).'),
        f(ALB, '0,045 ± 0,002', 'measured', s, 'Sugita et al. (2019).'),
        f(SPEC, 'Cb', 'measured', s),
        f(HMAG, '19,55', 'measured', s),
      ],
      discovery: { text: '10 de maio de 1999, pelo programa LINEAR, em Socorro (Novo México).', source: s },
      missions: [
        { missionId: 'hayabusa2', name: 'Hayabusa2', when: '2018–2020', text: 'Duas recolhas de amostras em 2019; a cápsula aterrou na Austrália a 6 de dezembro de 2020.' },
      ],
      orbitNote: 'Os encontros próximos com a Terra alteram ligeiramente a órbita: entre 1991 e 2041 usam-se épocas de 5 em 5 anos.',
      accent: COLORS.asteroid,
      imageQuery: { q: 'Ryugu Hayabusa2', mustInclude: ['ryugu'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('101955', '101955 Bennu');
    return {
      id: 'bennu',
      slug: 'bennu',
      name: 'Bennu',
      designation: '101955 Bennu',
      aliases: ['101955 Bennu', 'Bennu', '1999 RQ36', 'OSIRIS-REx'],
      kind: 'asteroid',
      orbitClass: 'apollo',
      neo: true,
      pha: true,
      tagline: 'O asteroide visitado pela OSIRIS-REx, que trouxe 121,6 g da sua superfície para a Terra.',
      description:
        'Bennu é um pequeno asteroide carbonáceo, com cerca de meio quilómetro, formado por fragmentos de um corpo maior. É um dos asteroides com a órbita mais bem conhecida, porque a sonda OSIRIS-REx o seguiu de perto durante quase dois anos. A cápsula com as amostras aterrou no Utah em setembro de 2023.',
      highlights: [
        'A probabilidade acumulada de colisão com a Terra até 2300 é de cerca de 1 em 2700, segundo a análise da órbita feita com os dados da OSIRIS-REx (Farnocchia et al. 2021).',
        'A superfície liberta pequenas partículas para o espaço, um fenómeno observado pela primeira vez num asteroide.',
      ],
      facts: [
        f(DIAM, '484,44 ± 0,30 m', 'measured', s, 'Diâmetro médio, Daly et al. (2020), Science Advances.'),
        f(DIM, '504,7 × 491,8 × 456,7 m', 'measured', s, 'Daly et al. (2020).'),
        f(MASS, '7,33 × 10¹⁰ kg', 'derived', s, 'Calculado: GM = 4,8904 × 10⁻⁹ km³/s² (Chesley et al. 2020) dividido por G.'),
        f(DENS, '1,194 ± 0,003 g/cm³', 'measured', s, 'Daly et al. (2020).'),
        f(ROT, '4,296061 h', 'measured', s, 'Hergenrother et al. (2019); a rotação está a acelerar lentamente.'),
        f(ALB, '0,044 ± 0,002', 'measured', s, 'Hergenrother et al. (2019).'),
        f(SPEC, 'B', 'measured', s),
        f(HMAG, '20,21 ± 0,03', 'measured', s),
      ],
      discovery: { text: '11 de setembro de 1999, pelo programa LINEAR, em Socorro (Novo México).', source: s },
      missions: [
        { missionId: 'osiris-rex', name: 'OSIRIS-REx', when: '2018–2023', text: 'Recolha de amostras a 20 de outubro de 2020; cápsula na Terra a 24 de setembro de 2023.' },
      ],
      orbitNote: 'Entre 1991 e 2041 usam-se épocas de 5 em 5 anos. O Horizons não tem efemérides de Bennu antes de 1900.',
      accent: COLORS.asteroid,
      imageQuery: { q: 'Bennu OSIRIS-REx', mustInclude: ['bennu'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('99942', '99942 Apophis');
    return {
      id: 'apophis',
      slug: 'apophis',
      name: 'Apophis',
      designation: '99942 Apophis',
      aliases: ['99942 Apophis', 'Apophis', 'Apófis', '2004 MN4', 'OSIRIS-APEX'],
      kind: 'asteroid',
      orbitClass: 'aten',
      neo: true,
      pha: true,
      tagline: 'Vai passar a cerca de 32 000 km da superfície da Terra a 13 de abril de 2029, sem risco de colisão.',
      description:
        'Pouco depois da descoberta, em 2004, Apophis chegou a ter uma probabilidade de colisão com a Terra em 2029 de cerca de 2,7 %. Observações posteriores, incluindo de radar, afastaram esse risco: em 2021 a NASA concluiu que não há risco de impacto durante pelo menos os próximos 100 anos. A passagem de 2029 será visível a olho nu em parte do mundo e vai mudar a sua órbita.',
      highlights: [
        'Na passagem de 2029 ficará mais perto da Terra do que os satélites geoestacionários.',
        'A gravidade da Terra vai alterar a órbita: o semieixo maior passa de cerca de 0,92 UA para cerca de 1,10 UA (elementos do Horizons antes e depois da passagem).',
      ],
      facts: [
        f(DIAM, '0,34 ± 0,04 km', 'measured', s, 'Modelo 3D a partir de radar (2012–2013), Brozović et al. (2018).'),
        f(ROT, '30,56 ± 0,01 h', 'measured', s, 'Pravec et al. (2014); rotação "em cambalhota" (não principal).'),
        f(ALB, '0,35 ± 0,10', 'measured', s, 'Brozović et al. (2018).'),
        f(SPEC, 'Sq', 'measured', s, 'Binzel et al. (2009).'),
        f(HMAG, '19,09 ± 0,19', 'measured', s),
      ],
      discovery: { text: '19 de junho de 2004, em Kitt Peak (Arizona), pela equipa de David Tholen.', source: s },
      missions: [
        {
          name: 'OSIRIS-APEX (NASA)',
          when: 'chegada prevista em 2029',
          text: 'A sonda OSIRIS-REx, rebatizada, deverá estudar Apophis logo a seguir à passagem junto à Terra.',
          source: nasa('mission/osiris-apex/', 'OSIRIS-APEX'),
        },
      ],
      orbitNote:
        'A passagem de 13 de abril de 2029 muda a órbita. A aplicação usa elementos de 15 de março e de 14 de maio de 2029 (antes e depois); nos dias à volta da passagem a posição é aproximada.',
      accent: COLORS.asteroid,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('65803', '65803 Didymos');
    return {
      id: 'didymos',
      slug: 'didymos',
      name: 'Didymos',
      designation: '65803 Didymos',
      aliases: ['65803 Didymos', 'Didymos', 'Dimorphos', '1996 GT', 'DART', 'Hera'],
      kind: 'asteroid',
      orbitClass: 'apollo',
      neo: true,
      pha: true,
      tagline: 'Um asteroide duplo: a sua pequena lua, Dimorphos, foi atingida pela sonda DART em 2022.',
      description:
        'Didymos tem cerca de 780 m e roda em pouco mais de duas horas. À sua volta orbita Dimorphos, com cerca de 160 m. A 26 de setembro de 2022 a sonda DART da NASA colidiu com Dimorphos para testar se é possível desviar um asteroide: o período da órbita de Dimorphos encurtou cerca de 32 minutos. Nenhum dos dois representa perigo para a Terra.',
      highlights: [
        'Foi a primeira vez que a humanidade alterou de forma mensurável o movimento de um corpo celeste.',
        'A sonda Hera da ESA vai estudar o sistema depois do impacto.',
      ],
      facts: [
        f(DIAM, '0,78 ± 0,03 km', 'measured', s, 'Radar, Naidu et al. (2020), Icarus.'),
        f(DIM, '797 × 783 × 761 m', 'measured', s, 'Naidu et al. (2020).'),
        f(DENS, '2,17 ± 0,35 g/cm³', 'measured', s, 'Naidu et al. (2020).'),
        f(ROT, '2,2593 h', 'measured', s, 'Lightcurve Database.'),
        f(SPEC, 'S', 'measured', s),
        f(HMAG, '18,11', 'measured', s),
      ],
      discovery: { text: '11 de abril de 1996, pelo programa Spacewatch, em Kitt Peak (Arizona).', source: s },
      missions: [
        { missionId: 'dart', name: 'DART', when: '2022', text: 'Impacto em Dimorphos a 26 de setembro de 2022.' },
        { missionId: 'hera', name: 'Hera', when: 'chegada prevista em 2026', text: 'Vai medir as consequências do impacto da DART.' },
      ],
      orbitNote: 'Entre 1991 e 2041 usam-se épocas de 5 em 5 anos. A posição é a do centro do sistema duplo, aproximadamente.',
      accent: COLORS.asteroid,
      imageQuery: { q: 'Didymos Dimorphos DART', mustInclude: ['dimorphos'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('3200', '3200 Phaethon');
    return {
      id: 'phaethon',
      slug: 'faetonte',
      name: 'Faetonte',
      designation: '3200 Faetonte',
      aliases: ['3200 Phaethon', 'Phaethon', 'Faetonte', '1983 TB', 'Gemínidas', 'Geminids'],
      kind: 'asteroid',
      orbitClass: 'apollo',
      neo: true,
      pha: true,
      tagline: 'Um asteroide que passa muito perto do Sol e é a origem da chuva de meteoros das Gemínidas.',
      description:
        'Faetonte aproxima-se do Sol a cerca de 0,14 UA, mais perto do que Mercúrio, e a superfície aquece a centenas de graus. Os detritos que perdeu ao longo do tempo espalham-se ao longo da órbita e, quando a Terra os atravessa em dezembro, produzem as Gemínidas.',
      highlights: [
        'É invulgar uma chuva de meteoros ter origem num asteroide e não num cometa.',
        'Foi o primeiro asteroide descoberto a partir de imagens de um satélite (IRAS).',
      ],
      facts: [
        f(DIAM, '6,25 ± 0,15 km', 'measured', s, 'Radar de Arecibo em 2017, Taylor et al. (2019).'),
        f(ROT, '3,604 h', 'measured', s, 'Lightcurve Database.'),
        f(ALB, '0,107 ± 0,011', 'measured', s, 'IRAS.'),
        f(SPEC, 'F (Tholen) · B (Bus e Binzel)', 'measured', s),
        f(HMAG, '14,38', 'measured', s),
      ],
      discovery: { text: '11 de outubro de 1983, em imagens do satélite IRAS.', source: s },
      missions: [],
      accent: COLORS.asteroid,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('617', '617 Patroclus');
    return {
      id: 'patroclus',
      slug: 'patroclo',
      name: 'Pátroclo',
      designation: '617 Pátroclo',
      aliases: ['617 Patroclus', 'Patroclus', 'Pátroclo', 'Menoetius', 'Menécio', 'troiano', 'Lucy'],
      kind: 'asteroid',
      orbitClass: 'trojan',
      neo: false,
      pha: false,
      tagline: 'Um par de asteroides troianos que partilham a órbita de Júpiter, último destino da sonda Lucy.',
      description:
        'Os troianos de Júpiter seguem o planeta na mesma órbita, 60° à frente ou atrás dele. Pátroclo é na verdade um sistema duplo: dois corpos de tamanho semelhante, Pátroclo e Menécio, orbitam-se mutuamente. A sonda Lucy deverá visitá-los em 2033.',
      highlights: [
        'Os troianos são considerados restos pouco alterados da formação dos planetas exteriores.',
        'A superfície é muito escura (albedo de cerca de 5 %).',
      ],
      facts: [
        f(DIAM, '140,4 ± 0,9 km', 'estimate', s, 'Diâmetro equivalente do sistema a partir do infravermelho (NEOWISE), Grav et al. (2012).'),
        f(ROT, '102,8 h', 'measured', s, 'Igual ao período orbital do par, Lightcurve Database.'),
        f(ALB, '0,047 ± 0,003', 'estimate', s, 'NEOWISE.'),
        f(SPEC, 'P', 'measured', s),
        f(HMAG, '8,22', 'measured', s),
      ],
      discovery: { text: '17 de outubro de 1906, por August Kopff, em Heidelberg.', source: s },
      missions: [{ missionId: 'lucy', name: 'Lucy', when: 'passagem prevista em 2033', text: 'Último destino da missão aos troianos.' }],
      accent: COLORS.asteroid,
    } satisfies SmallBody;
  })(),
  // ——————————————————————————————————————————————————————— Transneptunianos
  (() => {
    const s = sbdb('486958', '486958 Arrokoth');
    const sp = doi('10.1126/science.aay3999', 'Spencer et al. (2020), Science 367, eaay3999');
    return {
      id: 'arrokoth',
      slug: 'arrokoth',
      name: 'Arrokoth',
      designation: '486958 Arrokoth',
      aliases: ['486958 Arrokoth', 'Arrokoth', '2014 MU69', 'Ultima Thule', 'New Horizons'],
      kind: 'tno',
      orbitClass: 'tno',
      neo: false,
      pha: false,
      tagline: 'Um objeto da cintura de Kuiper formado por dois lobos unidos suavemente, o mais distante já visitado por uma sonda.',
      description:
        'A New Horizons passou por Arrokoth a 1 de janeiro de 2019, a mais de 6,6 mil milhões de km do Sol. É um "binário de contacto": dois corpos que se formaram juntos e se uniram devagar, sem uma colisão violenta. É um dos objetos mais primitivos que conhecemos.',
      highlights: [
        'A união lenta dos dois lobos apoia modelos em que os planetesimais se formaram pelo colapso de nuvens de partículas.',
        'A cor avermelhada vem de compostos orgânicos formados pela radiação.',
      ],
      facts: [
        f(DIM, '≈ 36 × 20 × 10 km', 'measured', sp, 'Lobo maior: 20,6 × 19,9 × 9,4 km; lobo menor: 15,4 × 13,8 × 9,8 km.'),
        f(ROT, '15,92 ± 0,02 h', 'measured', sp),
        f(HMAG, '11,06', 'measured', s),
      ],
      discovery: { text: '26 de junho de 2014, em imagens do telescópio espacial Hubble, durante a procura de um alvo para a New Horizons.', source: s },
      missions: [{ missionId: 'new-horizons', name: 'New Horizons', when: '2019', text: 'Passagem a 1 de janeiro de 2019.' }],
      orbitNote: 'Para objetos distantes, os elementos heliocêntricos oscilam com o movimento do Sol à volta do centro de massa do Sistema Solar; o erro de posição é de cerca de 0,03 UA.',
      accent: COLORS.tno,
      imageQuery: { q: 'Arrokoth New Horizons', mustInclude: ['arrokoth'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('136199', '136199 Eris');
    const occ = { title: 'Sicardy et al. (2011), Nature — notícia em phys.org', url: 'https://phys.org/news/2011-10-faraway-eris-pluto-twin-dwarf.html' };
    const n = nasa('dwarf-planets/eris/', 'Eris');
    return {
      id: 'eris',
      slug: 'eris',
      name: 'Éris',
      designation: '136199 Éris',
      aliases: ['136199 Eris', 'Eris', 'Éris', '2003 UB313', 'Dysnomia', 'Disnomia', 'planeta anão'],
      kind: 'tno',
      dwarf: true,
      orbitClass: 'tno',
      neo: false,
      pha: false,
      tagline: 'Um planeta anão quase do tamanho de Plutão, cuja descoberta levou à definição de planeta de 2006.',
      description:
        'Éris tem praticamente o mesmo diâmetro de Plutão e é mais massivo. A sua descoberta, anunciada em 2005, obrigou a União Astronómica Internacional a definir o que é um planeta, o que em 2006 levou à criação da categoria de planeta anão. Tem uma lua, Disnomia.',
      highlights: [
        'Uma ocultação de uma estrela em novembro de 2010 permitiu medir o diâmetro com um erro de apenas 12 km.',
        'A superfície é extremamente refletora (albedo de cerca de 0,96), provavelmente por gelo fresco.',
      ],
      facts: [
        f(DIAM, '2326 ± 12 km', 'measured', occ, 'Ocultação estelar de novembro de 2010 (Sicardy et al. 2011).'),
        f(DENS, '2,52 g/cm³', 'derived', occ, 'Com a massa obtida da órbita de Disnomia.'),
        f(ALB, '0,96', 'measured', occ),
        f(ROT, '25,9 h', 'estimate', s, LCDB_NOTE),
        f(HMAG, '−1,26', 'measured', s),
      ],
      discovery: { text: 'Em imagens de 21 de outubro de 2003 do Observatório Palomar, por Mike Brown, Chad Trujillo e David Rabinowitz; anunciada em janeiro de 2005.', source: n },
      missions: [],
      orbitNote: 'Para objetos distantes, os elementos heliocêntricos oscilam com o movimento do Sol à volta do centro de massa do Sistema Solar; o erro de posição é de cerca de 0,03 UA.',
      accent: COLORS.tno,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('136108', '136108 Haumea');
    const occ = { title: 'Ortiz et al. (2017), Nature 550 — notícia em Sky & Telescope', url: 'https://skyandtelescope.org/astronomy-news/dwarf-planet-haumea-has-a-ring/' };
    const n = nasa('dwarf-planets/haumea/', 'Haumea');
    return {
      id: 'haumea',
      slug: 'haumea',
      name: 'Haumea',
      designation: '136108 Haumea',
      aliases: ['136108 Haumea', 'Haumea', '2003 EL61', 'Namaka', "Hi'iaka", 'planeta anão'],
      kind: 'tno',
      dwarf: true,
      orbitClass: 'tno',
      neo: false,
      pha: false,
      tagline: 'Um planeta anão alongado que roda em menos de quatro horas e tem um anel.',
      description:
        'Haumea roda tão depressa que ficou achatado num elipsoide alongado. Em 2017, a observação de uma ocultação estelar revelou um anel à sua volta, o primeiro encontrado num objeto da cintura de Kuiper. Tem duas luas, Namaka e Hiʻiaka.',
      highlights: ['É o primeiro objeto da cintura de Kuiper em que se descobriu um anel.', 'Uma rotação dura cerca de 3,9 horas, uma das mais rápidas entre os corpos grandes do Sistema Solar.'],
      facts: [
        f(DIM, '≈ 2322 km (eixo maior) · ≈ 1026 km (eixo menor)', 'measured', occ, 'Forma deduzida da ocultação estelar de janeiro de 2017 (Ortiz et al. 2017).'),
        f(DENS, '≈ 1,9 g/cm³', 'derived', occ),
        f('Anel', 'raio ≈ 2287 km, largura ≈ 70 km', 'measured', occ),
        f(ROT, '3,9154 h', 'measured', s, 'Lightcurve Database.'),
        f(HMAG, '0,14', 'measured', s),
      ],
      discovery: { text: 'Imagens de 7 de março de 2003 do Observatório de Sierra Nevada (Espanha); a IAU não atribui um descobridor oficial.', source: n },
      missions: [],
      orbitNote: 'Para objetos distantes, os elementos heliocêntricos oscilam com o movimento do Sol à volta do centro de massa do Sistema Solar; o erro de posição é de cerca de 0,03 UA.',
      accent: COLORS.tno,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('136472', '136472 Makemake');
    const occ = { title: 'ESO — "Dwarf planet Makemake lacks atmosphere" (eso1246); Ortiz et al. (2012), Nature 491, 566', url: 'https://www.eso.org/public/news/eso1246/' };
    const n = nasa('dwarf-planets/makemake/', 'Makemake');
    return {
      id: 'makemake',
      slug: 'makemake',
      name: 'Makemake',
      designation: '136472 Makemake',
      aliases: ['136472 Makemake', 'Makemake', '2005 FY9', 'planeta anão'],
      kind: 'tno',
      dwarf: true,
      orbitClass: 'tno',
      neo: false,
      pha: false,
      tagline: 'Um planeta anão brilhante da cintura de Kuiper, coberto de gelo de metano e sem atmosfera global.',
      description:
        'Makemake é um pouco mais pequeno do que Plutão. Uma ocultação estelar observada em abril de 2011 mostrou que não tem uma atmosfera global significativa e permitiu medir a forma. Em 2016 o Hubble descobriu-lhe uma pequena lua.',
      highlights: ['Na superfície foram detetados metano e etano gelados.', 'A pequena lua descoberta em 2016 é mais de 1300 vezes mais ténue do que Makemake.'],
      facts: [
        f(DIM, '1430 ± 9 × 1502 ± 45 km', 'measured', occ, 'Eixos do esferoide achatado deduzidos da ocultação de 23 de abril de 2011.'),
        f(DENS, '≈ 1,7 ± 0,3 g/cm³', 'estimate', occ),
        f(ALB, '0,77 ± 0,03', 'measured', occ),
        f(ROT, '22,83 h', 'estimate', s, LCDB_NOTE),
        f(HMAG, '−0,25', 'measured', s),
      ],
      discovery: { text: 'Março de 2005, no Observatório Palomar, por Mike Brown, Chad Trujillo e David Rabinowitz.', source: n },
      missions: [],
      orbitNote: 'Para objetos distantes, os elementos heliocêntricos oscilam com o movimento do Sol à volta do centro de massa do Sistema Solar; o erro de posição é de cerca de 0,03 UA.',
      accent: COLORS.tno,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('90377', '90377 Sedna');
    const h = doi('10.1051/0004-6361/201218874', 'Pál et al. (2012), Astronomy & Astrophysics 541, L6');
    return {
      id: 'sedna',
      slug: 'sedna',
      name: 'Sedna',
      designation: '90377 Sedna',
      aliases: ['90377 Sedna', 'Sedna', '2003 VB12', 'nuvem de Oort interior'],
      kind: 'tno',
      orbitClass: 'tno',
      neo: false,
      pha: false,
      tagline: 'Um mundo avermelhado numa órbita enorme, que nunca se aproxima de Neptuno.',
      description:
        'O periélio de Sedna fica a cerca de 76 UA do Sol, muito para lá de Neptuno, e o afélio a centenas de UA: uma volta demora mais de dez mil anos. Uma órbita assim não se explica pela influência dos planetas conhecidos e é estudada como pista para o passado do Sistema Solar (uma estrela que passou perto, por exemplo).',
      highlights: ['Passa pelo periélio por volta de 2075–2076 (elementos do Horizons).', 'É um dos objetos mais vermelhos do Sistema Solar.'],
      facts: [
        f(DIAM, '995 ± 80 km', 'estimate', h, 'Modelo térmico com observações do Herschel e do Spitzer.'),
        f(ALB, '0,32 ± 0,06', 'estimate', h),
        f(ROT, '10,27 h', 'estimate', s, LCDB_NOTE),
        f(HMAG, '1,50', 'measured', s),
      ],
      discovery: { text: '14 de novembro de 2003, no Observatório Palomar, por Mike Brown, Chad Trujillo e David Rabinowitz.', source: s },
      missions: [],
      orbitNote: 'Os elementos heliocêntricos de corpos tão distantes oscilam muito (o semieixo maior varia entre cerca de 490 e 540 UA de época para época); a posição tem um erro de cerca de 0,03 UA, mas o período calculado é só indicativo.',
      accent: COLORS.tno,
    } satisfies SmallBody;
  })(),
  // ——————————————————————————————————————————————————————— Cometas
  (() => {
    const s = sbdb('1P', '1P/Halley');
    return {
      id: 'halley',
      slug: 'halley',
      name: 'Cometa Halley',
      designation: '1P/Halley',
      aliases: ['1P/Halley', 'Halley', 'Cometa Halley', "Halley's Comet", 'Giotto', 'Oriónidas', 'Eta Aquáridas'],
      kind: 'comet',
      orbitClass: 'halley-type',
      neo: true,
      pha: false,
      tagline: 'O cometa periódico mais famoso: volta a cada 75–76 anos e regressa em 2061.',
      description:
        'Edmond Halley percebeu que os cometas de 1531, 1607 e 1682 eram o mesmo objeto e previu o seu regresso, confirmado no Natal de 1758. Em 1986 a sonda Giotto, da ESA, fotografou de perto o núcleo, escuro e em forma de batata. A poeira que deixa na órbita produz as chuvas de meteoros Oriónidas e Eta Aquáridas.',
      highlights: ['A próxima passagem pelo periélio será em meados de 2061.', 'A órbita é retrógrada: percorre-a no sentido contrário ao dos planetas.'],
      facts: [
        f(`${NUC}: dimensões`, '14,9 × 8,2 km', 'measured', s, 'Imagens da Giotto, Keller et al. (1987).'),
        f(`${NUC}: diâmetro efetivo`, '11 km', 'derived', s, 'Lamy et al. (2004), Comets II.'),
        f(ALB, '0,04 ± 0,01', 'measured', s),
      ],
      discovery: { text: 'O regresso previsto por Halley foi observado pela primeira vez a 25 de dezembro de 1758, por Johann Georg Palitzsch; o cometa é registado desde a Antiguidade.', source: s },
      missions: [
        {
          name: 'Giotto (ESA)',
          when: '1986',
          text: 'Passou a cerca de 600 km do núcleo a 14 de março de 1986. As sondas soviéticas Vega 1 e 2 e as japonesas Sakigake e Suisei também o observaram.',
          source: { title: 'ESA — Giotto overview', url: 'https://www.esa.int/Science_Exploration/Space_Science/Giotto_overview' },
        },
      ],
      accent: COLORS.comet,
      imageQuery: { q: 'Halley comet 1986', mustInclude: ['halley'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('2P', '2P/Encke');
    return {
      id: 'encke',
      slug: 'encke',
      name: 'Cometa Encke',
      designation: '2P/Encke',
      aliases: ['2P/Encke', 'Encke', 'Cometa Encke', 'Táuridas'],
      kind: 'comet',
      orbitClass: 'encke-type',
      neo: true,
      pha: false,
      tagline: 'Um cometa com um dos períodos mais curtos: dá uma volta ao Sol em cerca de 3,3 anos.',
      description:
        'O cometa Encke tem uma órbita pequena, que fica dentro da de Júpiter. Foi o segundo cometa periódico a ser identificado, depois do Halley, quando Johann Encke calculou em 1819 que várias aparições eram do mesmo objeto. A poeira que perde está associada às Táuridas.',
      highlights: ['Passa pelo periélio a cerca de 0,34 UA do Sol, dentro da órbita de Mercúrio.', 'É observado em quase todas as passagens desde o século XIX.'],
      facts: [
        f(`${NUC}: diâmetro efetivo`, '4,8 km', 'estimate', s, 'Lamy et al. (2004), Comets II.'),
        f(ROT, '11,08 h', 'estimate', s, LCDB_NOTE),
        f(ALB, '0,046 ± 0,023', 'estimate', s),
      ],
      discovery: { text: '17 de janeiro de 1786, por Pierre Méchain; a periodicidade foi calculada por Johann Encke em 1819.', source: s },
      missions: [],
      orbitNote: 'Cometa com forças não gravitacionais e aproximações a Júpiter: entre 1991 e 2041 usam-se épocas de 5 em 5 anos.',
      accent: COLORS.comet,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('9P', '9P/Tempel 1');
    return {
      id: 'tempel1',
      slug: 'tempel-1',
      name: 'Cometa Tempel 1',
      designation: '9P/Tempel 1',
      aliases: ['9P/Tempel 1', 'Tempel 1', 'Deep Impact', 'Stardust-NExT'],
      kind: 'comet',
      orbitClass: 'jupiter-family',
      neo: false,
      pha: false,
      tagline: 'O cometa atingido de propósito pela sonda Deep Impact em 2005.',
      description:
        'A 4 de julho de 2005, um projétil de cerca de 370 kg lançado pela Deep Impact colidiu com o núcleo de Tempel 1 e levantou uma nuvem de material do interior. Em 2011 a sonda Stardust, numa missão alargada, voltou ao cometa e fotografou a zona do impacto.',
      highlights: ['Foi a primeira vez que se escavou material do interior de um cometa.', 'A Stardust-NExT permitiu comparar a superfície antes e depois de uma passagem pelo periélio.'],
      facts: [
        f(`${NUC}: dimensões`, '7,6 × 4,9 km', 'measured', s, "Modelo de forma preliminar, A'Hearn et al. (2005), Science."),
        f(`${NUC}: diâmetro efetivo`, '6,0 ± 0,2 km', 'measured', s, "A'Hearn et al. (2005)."),
        f(ROT, '40,7 h', 'measured', s, "A'Hearn et al. (2005)."),
        f(ALB, '0,05 ± 0,02', 'estimate', s),
      ],
      discovery: { text: '3 de abril de 1867, por Wilhelm Tempel, em Marselha.', source: s },
      missions: [
        { name: 'Deep Impact (NASA)', when: '2005', text: 'Impacto a 4 de julho de 2005.', source: nasa('mission/deep-impact/', 'Deep Impact') },
        { name: 'Stardust-NExT (NASA)', when: '2011', text: 'Passagem a 14 de fevereiro de 2011.', source: nasa('mission/stardust/', 'Stardust') },
      ],
      orbitNote: 'Aproximações a Júpiter mudam a órbita (entre 2021 e 2026 a distância do periélio passou de 1,5 para 1,8 UA, segundo os elementos do Horizons): entre 1991 e 2041 usam-se épocas de 5 em 5 anos, e mesmo assim o erro chega a 3° em 2034.',
      accent: COLORS.comet,
      imageQuery: { q: 'Tempel 1 Deep Impact', mustInclude: ['tempel'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('67P', '67P/Churyumov-Gerasimenko');
    return {
      id: '67p',
      slug: '67p',
      name: '67P/Churyumov–Gerasimenko',
      designation: '67P/Churyumov–Gerasimenko',
      aliases: ['67P', 'Churyumov-Gerasimenko', 'Churyumov', 'Rosetta', 'Philae'],
      kind: 'comet',
      orbitClass: 'jupiter-family',
      neo: true,
      pha: false,
      tagline: 'O cometa em forma de pato acompanhado durante dois anos pela Rosetta, onde pousou o Philae.',
      description:
        'A Rosetta, da ESA, chegou ao 67P em agosto de 2014 e acompanhou-o na passagem pelo periélio de 2015. O módulo Philae pousou na superfície a 12 de novembro de 2014. O núcleo tem dois lobos e uma densidade muito baixa, o que indica um corpo extremamente poroso.',
      highlights: [
        'Densidade de apenas 0,53 g/cm³: o núcleo é sobretudo espaço vazio.',
        'A Rosetta mediu a composição do gás e da poeira libertados ao longo de dois anos.',
      ],
      facts: [
        f(`${NUC}: diâmetro efetivo`, '3,4 ± 0,1 km', 'measured', s, 'Sierks et al. (2015), Science.'),
        f(MASS, '9,92 × 10¹² kg', 'derived', s, 'Calculado: GM = 662,2 × 10⁻⁹ km³/s² (Pätzold et al. 2016) dividido por G.'),
        f(DENS, '0,533 ± 0,006 g/cm³', 'measured', s, 'Pätzold et al. (2016), Nature.'),
        f(ROT, '12,761 h (antes de 2015) · 12,404 h (depois)', 'measured', s, 'Mottola et al. (2014); a rotação acelerou durante a passagem pelo periélio.'),
      ],
      discovery: { text: '22 de outubro de 1969, por Klim Churyumov, em imagens de Svetlana Gerasimenko obtidas em Alma-Ata.', source: s },
      missions: [{ missionId: 'rosetta', name: 'Rosetta', when: '2014–2016', text: 'Em órbita do cometa; o Philae pousou a 12 de novembro de 2014.' }],
      orbitNote: 'Uma aproximação a Júpiter entre 2016 e 2021 mudou a órbita (a inclinação passou de 7,1° para 3,9°, segundo os elementos do Horizons): entre 1991 e 2041 usam-se épocas de 5 em 5 anos.',
      accent: COLORS.comet,
      imageQuery: { q: 'comet 67P Rosetta', mustInclude: ['67p'] },
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('81P', '81P/Wild 2');
    return {
      id: 'wild2',
      slug: 'wild-2',
      name: 'Cometa Wild 2',
      designation: '81P/Wild 2',
      aliases: ['81P/Wild 2', 'Wild 2', 'Stardust'],
      kind: 'comet',
      orbitClass: 'jupiter-family',
      neo: false,
      pha: false,
      tagline: 'O cometa de onde a Stardust trouxe poeira para a Terra.',
      description:
        'Até 1974 a órbita de Wild 2 ficava, aproximadamente, entre as de Júpiter e de Úrano. Uma passagem próxima de Júpiter nesse ano trouxe-o para o Sistema Solar interior, onde foi descoberto em 1978. A sonda Stardust atravessou a sua cabeleira em 2004 e a cápsula com partículas recolhidas aterrou no Utah em 2006.',
      highlights: ['Entre as partículas havia minerais formados a alta temperatura, perto do Sol, o que mostra mistura de material no Sistema Solar jovem.', 'A amostra continha glicina, um aminoácido.'],
      facts: [f(`${NUC}: diâmetro efetivo`, '4,0 km', 'estimate', s, 'Lamy et al. (2004), Comets II.')],
      discovery: { text: '6 de janeiro de 1978, por Paul Wild, em Berna (Suíça).', source: s },
      missions: [
        { name: 'Stardust (NASA)', when: '2004–2006', text: 'Passagem a 2 de janeiro de 2004; cápsula na Terra a 15 de janeiro de 2006.', source: nasa('mission/stardust/', 'Stardust') },
      ],
      orbitNote: 'A aproximação a Júpiter de 1974 mudou completamente a órbita; antes disso a posição usa elementos de outra configuração orbital.',
      accent: COLORS.comet,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('109P', '109P/Swift-Tuttle');
    return {
      id: 'swift-tuttle',
      slug: 'swift-tuttle',
      name: 'Cometa Swift–Tuttle',
      designation: '109P/Swift–Tuttle',
      aliases: ['109P/Swift-Tuttle', 'Swift-Tuttle', 'Swift Tuttle', 'Perseidas', 'Perseids'],
      kind: 'comet',
      orbitClass: 'halley-type',
      neo: true,
      pha: false,
      tagline: 'O cometa que dá origem às Perseidas, as "estrelas cadentes" de agosto.',
      description:
        'Swift–Tuttle tem um núcleo grande, com cerca de 26 km, e uma órbita de cerca de 133 anos. Todos os anos, em agosto, a Terra atravessa a poeira que ele deixou e vemos as Perseidas. A última passagem pelo periélio foi em dezembro de 1992.',
      highlights: ['A próxima passagem pelo periélio é em 2126 (calculado com os elementos do Horizons).', 'É o maior objeto conhecido que passa repetidamente perto da órbita da Terra.'],
      facts: [f(`${NUC}: diâmetro efetivo`, '26 km', 'estimate', s, 'Lamy et al. (2004), Comets II.')],
      discovery: { text: '16 de julho de 1862, por Lewis Swift (Marathon, Nova Iorque) e, três dias depois, por Horace Tuttle.', source: s },
      missions: [],
      accent: COLORS.comet,
    } satisfies SmallBody;
  })(),
  (() => {
    const s = sbdb('C/1995 O1', 'C/1995 O1 (Hale-Bopp)');
    const n = nasa('solar-system/comets/c-1995-o1-hale-bopp/', 'Hale-Bopp');
    return {
      id: 'hale-bopp',
      slug: 'hale-bopp',
      name: 'Cometa Hale–Bopp',
      designation: 'C/1995 O1 (Hale–Bopp)',
      aliases: ['C/1995 O1', 'Hale-Bopp', 'Hale Bopp', 'grande cometa de 1997'],
      kind: 'comet',
      orbitClass: 'long-period',
      neo: false,
      pha: false,
      tagline: 'O grande cometa de 1997, visível a olho nu durante 18 meses.',
      description:
        'Hale–Bopp foi descoberto em 1995, ainda muito longe do Sol, o que já indicava um núcleo grande e ativo. Passou pelo periélio a 1 de abril de 1997 e foi um dos cometas mais observados de sempre. Só voltará daqui a cerca de 2500 anos.',
      highlights: ['Visível a olho nu durante 18 meses em 1996 e 1997, um recorde.', 'O núcleo tem cerca de 60 km, muito maior do que o da maioria dos cometas.'],
      facts: [
        f(`${NUC}: diâmetro`, '60 ± 20 km', 'estimate', s, 'Fernández (2002).'),
        f(ALB, '0,04 ± 0,03', 'estimate', s),
        f('Período orbital (NASA)', '≈ 2534 anos', 'estimate', n),
      ],
      discovery: { text: '23 de julho de 1995, de forma independente por Alan Hale (Novo México) e Thomas Bopp (Arizona).', source: n },
      missions: [],
      orbitNote: 'Os elementos heliocêntricos de um cometa de longo período variam muito longe do Sol; o período calculado a partir deles é só indicativo.',
      accent: COLORS.comet,
    } satisfies SmallBody;
  })(),
  // ——————————————————————————————————————————————————————— Interestelares
  (() => {
    const s = sbdb('1I', "1I/'Oumuamua");
    const n = nasa('solar-system/comets/oumuamua/', "'Oumuamua");
    return {
      id: 'oumuamua',
      slug: 'oumuamua',
      name: 'ʻOumuamua',
      designation: '1I/ʻOumuamua',
      aliases: ['1I', "'Oumuamua", 'Oumuamua', 'A/2017 U1', 'interestelar'],
      kind: 'interstellar',
      orbitClass: 'hyperbolic',
      neo: false,
      pha: false,
      tagline: 'O primeiro objeto vindo de outra estrela a ser observado no Sistema Solar.',
      description:
        'ʻOumuamua foi descoberto em outubro de 2017, já depois de passar pelo periélio, numa órbita hiperbólica: não está preso ao Sol e saiu do Sistema Solar. É muito alongado e acelerou ligeiramente mais do que a gravidade explica, sem que se visse uma cabeleira, o que continua a ser estudado.',
      highlights: ['A órbita hiperbólica (excentricidade ≈ 1,2) mostra que veio de fora do Sistema Solar.', 'Passou pelo periélio a 9 de setembro de 2017, a cerca de 0,26 UA do Sol.'],
      facts: [
        f(DIM, 'até ≈ 400 m de comprimento', 'estimate', n, 'Cerca de dez vezes mais comprido do que largo, segundo a NASA.'),
        f(ROT, '7,94 h', 'estimate', s, LCDB_NOTE),
        f(HMAG, '22,08 ± 0,45', 'measured', s),
      ],
      discovery: { text: '19 de outubro de 2017, com o telescópio Pan-STARRS1 da Universidade do Havai.', source: n },
      missions: [],
      orbitNote: 'Inclui épocas de janeiro de 2017, setembro de 2017 e junho de 2018, à volta da passagem pelo periélio.',
      accent: COLORS.interstellar,
    } satisfies SmallBody;
  })(),
  (() => {
    const n = nasa('solar-system/comets/2i-borisov/', '2I/Borisov');
    return {
      id: 'borisov',
      slug: 'borisov',
      name: '2I/Borisov',
      designation: '2I/Borisov (C/2019 Q4)',
      aliases: ['2I', 'Borisov', 'C/2019 Q4', 'interestelar'],
      kind: 'interstellar',
      orbitClass: 'hyperbolic',
      neo: false,
      pha: false,
      tagline: 'O primeiro cometa interestelar conhecido, descoberto por um astrónomo amador.',
      description:
        'Ao contrário de ʻOumuamua, 2I/Borisov tinha o aspeto de um cometa comum, com cabeleira e cauda. Passou pelo periélio em dezembro de 2019, a cerca de 2 UA do Sol, e mostrou que os cometas de outros sistemas planetários podem ser parecidos com os nossos.',
      highlights: ['Excentricidade de cerca de 3,4, muito acima de 1.', 'A velocidade, de cerca de 177 000 km/h segundo a NASA, é demasiado grande para ficar presa ao Sol.'],
      facts: [f(`${NUC}`, 'menos de 1 km (estimativa da NASA: cerca de 975 m)', 'estimate', n)],
      discovery: { text: '30 de agosto de 2019, por Gennady Borisov, astrónomo amador na Crimeia.', source: n },
      missions: [],
      orbitNote: 'Inclui épocas de junho de 2019, dezembro de 2019 e junho de 2020, à volta da passagem pelo periélio.',
      accent: COLORS.interstellar,
    } satisfies SmallBody;
  })(),
  (() => {
    const n = nasa('solar-system/comets/3i-atlas/', '3I/ATLAS');
    return {
      id: 'atlas3i',
      slug: '3i-atlas',
      name: '3I/ATLAS',
      designation: '3I/ATLAS (C/2025 N1)',
      aliases: ['3I', '3I/ATLAS', 'ATLAS', 'C/2025 N1', 'interestelar'],
      kind: 'interstellar',
      orbitClass: 'hyperbolic',
      neo: false,
      pha: false,
      tagline: 'O terceiro objeto interestelar, um cometa descoberto em julho de 2025.',
      description:
        'O telescópio ATLAS, no Chile, detetou-o a 1 de julho de 2025. A órbita é muito hiperbólica (excentricidade ≈ 6,1) e quase no plano dos planetas, mas percorrida em sentido contrário. Passou pelo periélio no fim de outubro de 2025, a cerca de 1,4 UA do Sol, e nunca se aproximou da Terra a menos de cerca de 1,8 UA.',
      highlights: ['É o objeto com a órbita mais aberta alguma vez observado.', 'Foi observado por muitos telescópios e sondas durante a passagem pelo Sistema Solar interior.'],
      facts: [f(NUC, 'entre cerca de 0,44 e 5,6 km', 'estimate', n, 'Limites indicados pela NASA a partir de observações do Hubble (agosto de 2025).')],
      discovery: { text: '1 de julho de 2025, pelo telescópio ATLAS em Río Hurtado (Chile), financiado pela NASA.', source: n },
      missions: [],
      orbitNote: 'Inclui épocas de julho de 2025, outubro de 2025 e março de 2026, à volta da passagem pelo periélio.',
      accent: COLORS.interstellar,
    } satisfies SmallBody;
  })(),
];

export function findSmallBody(slug: string): SmallBody | undefined {
  return SMALL_BODIES.find((b) => b.slug === slug);
}

export const SMALL_BODY_GROUPS: { kind: SmallBodyKind; ids: string[] }[] = (['asteroid', 'tno', 'comet', 'interstellar'] as const).map((kind) => ({
  kind,
  ids: SMALL_BODIES.filter((b) => b.kind === kind).map((b) => b.id),
}));
