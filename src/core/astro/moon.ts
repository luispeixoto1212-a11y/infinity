import { centuriesSinceJ2000 } from './time';
import { solveKepler, orbitalPlaneToEcliptic } from './kepler';
import type { Vec3 } from './vector';

/**
 * Posição geocêntrica aproximada da Lua a partir dos seus elementos médios
 * (J. Meeus, "Astronomical Algorithms", 2.ª ed., cap. 47: L′, M′ e Ω com termos lineares).
 *
 * Não inclui as perturbações periódicas (evecção, variação, equação anual…),
 * pelo que o erro na longitude pode chegar a cerca de 1,3°. Suficiente para orientar
 * a Lua na cena, mas não para efemérides de observação.
 */
export const MOON_MEAN_ELEMENTS = {
  semiMajorAxisKm: 384_400,
  eccentricity: 0.0549,
  inclinationDeg: 5.145,
  L0: 218.3164477,
  Lrate: 481267.88123421,
  M0: 134.9633964,
  Mrate: 477198.8675055,
  node0: 125.0445479,
  nodeRate: -1934.1362891,
  /** Precessão geral em longitude (graus/século): converte do equinócio da data para J2000. */
  precessionRate: 1.396971,
} as const;

export const MOON_POSITION_MAX_ERROR_DEG = 1.5;

/** Vetor geocêntrico da Lua (km, eclíptica J2000 aproximada). */
export function moonGeocentricKm(jdTdb: number): Vec3 {
  const T = centuriesSinceJ2000(jdTdb);
  const m = MOON_MEAN_ELEMENTS;
  // Os elementos de Meeus referem-se ao equinócio da data; retira-se a precessão acumulada desde J2000.
  const precession = m.precessionRate * T;
  const L = m.L0 + m.Lrate * T - precession;
  const M = m.M0 + m.Mrate * T;
  const node = m.node0 + m.nodeRate * T - precession;
  const varpi = L - M;
  const omega = varpi - node;
  const E = solveKepler(M, m.eccentricity);
  const a = m.semiMajorAxisKm;
  const rad = Math.PI / 180;
  const xp = a * (Math.cos(E * rad) - m.eccentricity);
  const yp = a * Math.sqrt(1 - m.eccentricity ** 2) * Math.sin(E * rad);
  return orbitalPlaneToEcliptic(xp, yp, omega, node, m.inclinationDeg);
}
