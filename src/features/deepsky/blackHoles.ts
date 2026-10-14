import type { SourceId } from '../../data/sources';

/**
 * Buracos negros notáveis. Cada número vem da fonte indicada; o raio do horizonte é calculado
 * pela aplicação (raio de Schwarzschild, buraco negro sem rotação).
 */
export type BlackHoleKind = 'supermassive' | 'stellar' | 'merger';

export interface BlackHole {
  id: string;
  name: string;
  kind: BlackHoleKind;
  /** Massa em massas solares (para uma fusão, a do buraco negro final). */
  massSun?: number;
  massText?: string;
  distanceLy: number;
  distanceText: string;
  where: string;
  summary: string;
  facts: string[];
  sources: SourceId[];
}

export const BLACK_HOLES: readonly BlackHole[] = [
  {
    id: 'sgr-a',
    name: 'Sagitário A*',
    kind: 'supermassive',
    massSun: 4e6,
    massText: 'cerca de 4 milhões de massas solares',
    distanceLy: 27_000,
    distanceText: 'cerca de 27 000 anos-luz',
    where: 'Centro da Via Láctea, na direção da constelação de Sagitário',
    summary:
      'O buraco negro supermassivo no centro da nossa galáxia. A colaboração Event Horizon Telescope divulgou a primeira imagem da sua sombra a 12 de maio de 2022.',
    facts: ['Primeira imagem: 12 de maio de 2022 (Event Horizon Telescope)'],
    sources: ['nasa-black-holes', 'bu-sgr-a-2022'],
  },
  {
    id: 'm87',
    name: 'M87*',
    kind: 'supermassive',
    massSun: 6.5e9,
    massText: '6,5 mil milhões de massas solares',
    distanceLy: 55_000_000,
    distanceText: 'cerca de 55 milhões de anos-luz',
    where: 'Centro da galáxia elíptica M87, no Enxame da Virgem',
    summary:
      'Em abril de 2019 tornou-se o primeiro buraco negro fotografado: a imagem do Event Horizon Telescope mostra o anel de luz à volta da sua sombra.',
    facts: ['Primeira imagem de um buraco negro: abril de 2019'],
    sources: ['nasa-svs-m87'],
  },
  {
    id: 'cyg-x-1',
    name: 'Cygnus X-1',
    kind: 'stellar',
    massSun: 21.2,
    massText: 'cerca de 21 massas solares',
    distanceLy: 7_240,
    distanceText: 'cerca de 7240 anos-luz',
    where: 'Constelação do Cisne, em órbita com uma estrela supergigante',
    summary:
      'O primeiro buraco negro descoberto. Medições publicadas em 2021 aumentaram a sua massa para cerca de 21 sóis e a distância para cerca de 7240 anos-luz.',
    facts: ['Revisão da massa e da distância: fevereiro de 2021 (revista Science)'],
    sources: ['sciam-cyg-x-1-2021'],
  },
  {
    id: 'gaia-bh1',
    name: 'Gaia BH1',
    kind: 'stellar',
    distanceLy: 1_560,
    distanceText: 'cerca de 1560 anos-luz',
    where: 'Constelação de Ofiúco',
    summary: 'O buraco negro conhecido mais próximo da Terra. Foi encontrado pelo movimento da estrela que o orbita, medido pela missão Gaia.',
    facts: ['Detetado pelo efeito na órbita de uma estrela companheira'],
    sources: ['nasa-black-holes', 'esa-gaia-black-holes'],
  },
  {
    id: 'gaia-bh3',
    name: 'Gaia BH3',
    kind: 'stellar',
    massSun: 33,
    massText: 'cerca de 33 massas solares',
    distanceLy: 1_926,
    distanceText: 'cerca de 1926 anos-luz',
    where: 'Constelação da Águia',
    summary: 'O buraco negro de origem estelar mais massivo descoberto na Via Láctea, anunciado pela ESA em 2024.',
    facts: ['O mais massivo de origem estelar conhecido na nossa galáxia'],
    sources: ['esa-gaia-black-holes'],
  },
  {
    id: 'gw150914',
    name: 'GW150914',
    kind: 'merger',
    massSun: 62,
    massText: 'cerca de 62 massas solares (após a fusão de buracos negros com 36 e 29)',
    distanceLy: 1_300_000_000,
    distanceText: 'cerca de 1300 milhões de anos-luz',
    where: 'Galáxia distante (fusão de dois buracos negros)',
    summary:
      'As primeiras ondas gravitacionais detetadas, a 14 de setembro de 2015, pelo LIGO. Vieram da fusão de dois buracos negros; cerca de 3 massas solares foram convertidas em ondas gravitacionais numa fração de segundo.',
    facts: ['Detetado a 14 de setembro de 2015', 'Energia emitida: cerca de 3 massas solares'],
    sources: ['aei-gw150914'],
  },
];

/** Raio de Schwarzschild por massa solar: 2GM☉/c² ≈ 2,953 km. */
export const SCHWARZSCHILD_KM_PER_SUN = 2.953;

export function schwarzschildRadiusKm(massSun: number): number {
  return SCHWARZSCHILD_KM_PER_SUN * massSun;
}

/** Referências de tamanho para comparar com os horizontes (km). */
export const SIZE_REFERENCES: ReadonlyArray<{ label: string; km: number }> = [
  { label: 'Raio da Terra', km: 6371 },
  { label: 'Raio do Sol', km: 695_700 },
  { label: 'Órbita da Terra (1 UA)', km: 149_597_870.7 },
  { label: 'Órbita de Neptuno (30 UA)', km: 4_495_000_000 },
];
