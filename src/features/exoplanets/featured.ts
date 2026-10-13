import type { SourceId } from '../../data/sources';

/**
 * Exoplanetas em destaque. Os textos resumem apenas factos indicados nas fontes citadas;
 * os números mostrados na ficha vêm sempre do catálogo (NASA Exoplanet Archive).
 */
export interface FeaturedExoplanet {
  /** Nome exatamente como no NASA Exoplanet Archive. */
  name: string;
  /** Nome mais conhecido, quando difere da designação do arquivo. */
  displayName?: string;
  summary: string;
  sources: SourceId[];
}

export const FEATURED_EXOPLANETS: readonly FeaturedExoplanet[] = [
  {
    name: 'Proxima Cen b',
    displayName: 'Proxima Centauri b',
    summary:
      'Orbita Proxima Centauri, a estrela mais próxima do Sol. Foi descoberto em 2016 pelo método da velocidade radial: conhece-se a massa mínima, mas o raio é apenas uma estimativa.',
    sources: ['nasa-exo-proxima-b'],
  },
  {
    name: 'TRAPPIST-1 e',
    summary:
      'Um dos sete planetas do tamanho da Terra que orbitam TRAPPIST-1, uma anã ultrafria a cerca de 40 anos-luz. O sistema foi anunciado em 2017 com dados do telescópio espacial Spitzer; segundo a NASA, três dos planetas ficam na zona habitável.',
    sources: ['nasa-trappist1-2017', 'nasa-exo-trappist-1e'],
  },
  {
    name: '51 Peg b',
    displayName: '51 Pegasi b',
    summary:
      'Anunciado em 1995 por Michel Mayor e Didier Queloz, é reconhecido como o primeiro exoplaneta encontrado em órbita de uma estrela normal, semelhante ao Sol. É um gigante gasoso muito próximo da estrela.',
    sources: ['nasa-first-exoplanet', 'nasa-exo-51-peg-b'],
  },
  {
    name: 'PSR B1257+12 c',
    summary:
      'Pertence ao primeiro sistema de exoplanetas confirmado: Alexander Wolszczan anunciou em 1992 dois planetas em órbita de um pulsar e confirmou o terceiro dois anos depois.',
    sources: ['nasa-first-exoplanet'],
  },
  {
    name: 'K2-18 b',
    summary:
      'Em 2023, o telescópio James Webb detetou metano e dióxido de carbono na sua atmosfera e falta de amoníaco, o que é compatível com um oceano por baixo de uma atmosfera rica em hidrogénio. A possível deteção de sulfureto de dimetilo foi apresentada como incerta.',
    sources: ['nasa-k2-18b-webb', 'nasa-exo-k2-18b'],
  },
  {
    name: 'WASP-39 b',
    summary: 'Em julho de 2022 tornou-se o primeiro exoplaneta estudado pelo telescópio espacial James Webb. É um gigante gasoso com menos de um terço da massa de Júpiter.',
    sources: ['nasa-exo-wasp-39b'],
  },
  {
    name: '55 Cnc e',
    displayName: '55 Cancri e',
    summary:
      'Um planeta rochoso muito quente, a 41 anos-luz. Em 2024, observações do Webb indicaram que provavelmente tem uma atmosfera com monóxido ou dióxido de carbono: o lado de dia está a cerca de 1540 °C, menos do que seria de esperar sem atmosfera.',
    sources: ['jpl-55cnc-e-2024', 'nasa-exo-55-cnc-e'],
  },
  {
    name: 'Kepler-452 b',
    summary: 'Descrito pela NASA como um «primo da Terra»: orbita uma estrela semelhante ao Sol, na zona habitável, onde poderia existir água líquida.',
    sources: ['nasa-exo-kepler-452b'],
  },
  {
    name: 'Kepler-186 f',
    summary: 'Planeta pouco maior do que a Terra em órbita de uma anã vermelha (tipo M), descoberto com o telescópio espacial Kepler em 2014.',
    sources: ['nasa-exo-kepler-186f'],
  },
  {
    name: 'TOI-700 d',
    summary: 'Planeta pouco maior do que a Terra em órbita de uma anã vermelha (tipo M), anunciado em 2020.',
    sources: ['nasa-exo-toi-700d'],
  },
  {
    name: 'HR 8799 b',
    summary:
      'Um dos quatro gigantes gasosos do sistema HR 8799, fotografados diretamente. Foi anunciado em 2008 e está tão longe da estrela que demora centenas de anos a completar uma órbita.',
    sources: ['nasa-exo-hr-8799b'],
  },
];

export function findFeatured(name: string): FeaturedExoplanet | undefined {
  return FEATURED_EXOPLANETS.find((f) => f.name === name);
}
