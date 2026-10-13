/**
 * Tabela 1 de E. M. Standish (JPL), "Approximate Positions of the Planets":
 * elementos keplerianos e respetivas taxas, referidos à eclíptica e equinócio médios de J2000,
 * válidos entre 1800 e 2050 d.C.
 * Fonte: https://ssd.jpl.nasa.gov/planets/approx_pos.html (consultado em 2026-10-13).
 *
 * Unidades: a [UA, UA/século]; e [–, /século]; I, L, ϖ (long. do periélio), Ω (long. do nó) [graus, graus/século].
 */

export type MajorPlanetKey =
  | 'mercury'
  | 'venus'
  | 'emb'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

export interface ElementSet {
  a: number;
  e: number;
  I: number;
  L: number;
  varpi: number;
  Omega: number;
}

export interface KeplerianTableRow {
  base: ElementSet;
  ratePerCentury: ElementSet;
  /** Erros máximos indicados pelo JPL para 1800–2050: longitude e latitude heliocêntricas (″) e distância (milhares de km). */
  stated: { lambdaArcsec: number; phiArcsec: number; rhoThousandKm: number };
}

export const JPL_TABLE_1: Record<MajorPlanetKey, KeplerianTableRow> = {
  mercury: {
    base: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.2503235, varpi: 77.45779628, Omega: 48.33076593 },
    ratePerCentury: { a: 0.00000037, e: 0.00001906, I: -0.00594749, L: 149472.67411175, varpi: 0.16047689, Omega: -0.12534081 },
    stated: { lambdaArcsec: 15, phiArcsec: 1, rhoThousandKm: 1 },
  },
  venus: {
    base: { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.9790995, varpi: 131.60246718, Omega: 76.67984255 },
    ratePerCentury: { a: 0.0000039, e: -0.00004107, I: -0.0007889, L: 58517.81538729, varpi: 0.00268329, Omega: -0.27769418 },
    stated: { lambdaArcsec: 20, phiArcsec: 1, rhoThousandKm: 4 },
  },
  emb: {
    base: { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, varpi: 102.93768193, Omega: 0.0 },
    ratePerCentury: { a: 0.00000562, e: -0.00004392, I: -0.01294668, L: 35999.37244981, varpi: 0.32327364, Omega: 0.0 },
    stated: { lambdaArcsec: 20, phiArcsec: 8, rhoThousandKm: 6 },
  },
  mars: {
    base: { a: 1.52371034, e: 0.0933941, I: 1.84969142, L: -4.55343205, varpi: -23.94362959, Omega: 49.55953891 },
    ratePerCentury: { a: 0.00001847, e: 0.00007882, I: -0.00813131, L: 19140.30268499, varpi: 0.44441088, Omega: -0.29257343 },
    stated: { lambdaArcsec: 40, phiArcsec: 2, rhoThousandKm: 25 },
  },
  jupiter: {
    base: { a: 5.202887, e: 0.04838624, I: 1.30439695, L: 34.39644051, varpi: 14.72847983, Omega: 100.47390909 },
    ratePerCentury: { a: -0.00011607, e: -0.00013253, I: -0.00183714, L: 3034.74612775, varpi: 0.21252668, Omega: 0.20469106 },
    stated: { lambdaArcsec: 400, phiArcsec: 10, rhoThousandKm: 600 },
  },
  saturn: {
    base: { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, varpi: 92.59887831, Omega: 113.66242448 },
    ratePerCentury: { a: -0.0012506, e: -0.00050991, I: 0.00193609, L: 1222.49362201, varpi: -0.41897216, Omega: -0.28867794 },
    stated: { lambdaArcsec: 600, phiArcsec: 25, rhoThousandKm: 1500 },
  },
  uranus: {
    base: { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, varpi: 170.9542763, Omega: 74.01692503 },
    ratePerCentury: { a: -0.00196176, e: -0.00004397, I: -0.00242939, L: 428.48202785, varpi: 0.40805281, Omega: 0.04240589 },
    stated: { lambdaArcsec: 50, phiArcsec: 2, rhoThousandKm: 1000 },
  },
  neptune: {
    base: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, varpi: 44.96476227, Omega: 131.78422574 },
    ratePerCentury: { a: 0.00026291, e: 0.00005105, I: 0.00035372, L: 218.45945325, varpi: -0.32241464, Omega: -0.00508664 },
    stated: { lambdaArcsec: 10, phiArcsec: 1, rhoThousandKm: 200 },
  },
};

/**
 * Elementos osculadores heliocêntricos (eclíptica e equinócio J2000) do JPL Small-Body Database.
 * Propagados como problema de dois corpos: a precisão degrada-se com a distância à época.
 */
export interface OsculatingElements {
  /** Época (Dia Juliano TDB). */
  epochJd: number;
  a: number;
  e: number;
  /** Inclinação (graus). */
  i: number;
  /** Longitude do nó ascendente (graus). */
  node: number;
  /** Argumento do periélio (graus). */
  peri: number;
  /** Anomalia média na época (graus). */
  M0: number;
  /** Movimento médio (graus/dia). */
  n: number;
}

/** 1 Ceres — JPL SBDB, solução de 2021-04-13, época JD 2461200.5 (consultado em 2026-10-13). */
export const CERES_ELEMENTS: OsculatingElements = {
  epochJd: 2461200.5,
  a: 2.765552595034094,
  e: 0.07969229514816586,
  i: 10.58802780183462,
  node: 80.24862682043221,
  peri: 73.29421453021587,
  M0: 274.4193463761342,
  n: 0.21430445064843,
};

/** 134340 Plutão — JPL SBDB (efemérides DE441), época JD 2457588.5 (consultado em 2026-10-13). */
export const PLUTO_ELEMENTS: OsculatingElements = {
  epochJd: 2457588.5,
  a: 39.58862938517124,
  e: 0.2518378778576892,
  i: 17.14771140999114,
  node: 110.2923840543057,
  peri: 113.7090015158565,
  M0: 38.68366347318184,
  n: 0.003956838955553025,
};
