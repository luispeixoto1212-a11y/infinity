import { SATELLITE_ELEMENTS, type SatelliteKey } from '../../data/moonOrbits';
import { orbitalPlaneToEcliptic, solveKepler } from './kepler';
import { DEG, type Vec3 } from './vector';

/** Posição da lua em relação ao centro do planeta (km, eclíptica J2000). */
export function satelliteOffsetKm(key: SatelliteKey, jdTdb: number): Vec3 {
  const el = SATELLITE_ELEMENTS[key];
  const M = el.M0 + el.n * (jdTdb - el.epochJd);
  const E = solveKepler(M, el.e);
  const xp = el.a * (Math.cos(E * DEG) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E * DEG);
  return orbitalPlaneToEcliptic(xp, yp, el.peri, el.node, el.i);
}

/** Normal da órbita (sentido do movimento, regra da mão direita), eclíptica J2000. */
export function satelliteOrbitNormal(key: SatelliteKey): Vec3 {
  const el = SATELLITE_ELEMENTS[key];
  const i = el.i * DEG;
  const O = el.node * DEG;
  return { x: Math.sin(i) * Math.sin(O), y: -Math.sin(i) * Math.cos(O), z: Math.cos(i) };
}

/** Período orbital sideral (dias), a partir do movimento médio ajustado. */
export function satellitePeriodDays(key: SatelliteKey): number {
  return 360 / SATELLITE_ELEMENTS[key].n;
}

/** Amostra a órbita (km, relativa ao planeta) ao longo de um período, a partir de uma data. */
export function sampleSatelliteOrbitKm(key: SatelliteKey, fromJd: number, segments = 180): Vec3[] {
  const P = satellitePeriodDays(key);
  const pts: Vec3[] = [];
  for (let k = 0; k <= segments; k += 1) pts.push(satelliteOffsetKm(key, fromJd + (P * k) / segments));
  return pts;
}
