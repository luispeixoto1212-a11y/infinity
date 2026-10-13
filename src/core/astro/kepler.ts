import { centuriesSinceJ2000 } from './time';
import { DEG, type Vec3, wrapDeg180 } from './vector';
import {
  JPL_TABLE_1,
  type ElementSet,
  type MajorPlanetKey,
  type OsculatingElements,
} from './elements';

/**
 * Resolve a equação de Kepler M = E − e·sin E pelo método iterativo indicado pelo JPL.
 * @param meanAnomalyDeg anomalia média (graus)
 * @param e excentricidade (0 ≤ e < 1)
 * @returns anomalia excêntrica E (graus)
 */
export function solveKepler(meanAnomalyDeg: number, e: number, toleranceDeg = 1e-6): number {
  if (!(e >= 0 && e < 1)) throw new RangeError(`Excentricidade fora do intervalo elíptico: ${e}`);
  const M = wrapDeg180(meanAnomalyDeg);
  const eStar = e / DEG; // e* = 57,29578·e
  let E = M + eStar * Math.sin(M * DEG);
  for (let i = 0; i < 50; i += 1) {
    const dM = M - (E - eStar * Math.sin(E * DEG));
    const dE = dM / (1 - e * Math.cos(E * DEG));
    E += dE;
    if (Math.abs(dE) <= toleranceDeg) break;
  }
  return E;
}

/** Elementos da Tabela 1 avaliados numa data (séculos T desde J2000). */
export function elementsAtCenturies(key: MajorPlanetKey, T: number): ElementSet {
  const { base, ratePerCentury: r } = JPL_TABLE_1[key];
  return {
    a: base.a + r.a * T,
    e: base.e + r.e * T,
    I: base.I + r.I * T,
    L: base.L + r.L * T,
    varpi: base.varpi + r.varpi * T,
    Omega: base.Omega + r.Omega * T,
  };
}

/**
 * Converte coordenadas no plano orbital em coordenadas eclípticas J2000:
 * r_ecl = R_z(−Ω)·R_x(−I)·R_z(−ω)·r′.
 */
export function orbitalPlaneToEcliptic(
  xp: number,
  yp: number,
  omegaDeg: number,
  nodeDeg: number,
  inclinationDeg: number,
): Vec3 {
  const w = omegaDeg * DEG;
  const O = nodeDeg * DEG;
  const I = inclinationDeg * DEG;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cO = Math.cos(O);
  const sO = Math.sin(O);
  const cI = Math.cos(I);
  const sI = Math.sin(I);
  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    z: sw * sI * xp + cw * sI * yp,
  };
}

function positionFromAnomaly(
  a: number,
  e: number,
  E: number,
  omega: number,
  node: number,
  incl: number,
): Vec3 {
  const xp = a * (Math.cos(E * DEG) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E * DEG);
  return orbitalPlaneToEcliptic(xp, yp, omega, node, incl);
}

/** Posição heliocêntrica (UA, eclíptica J2000) de um planeta pela Tabela 1 do JPL. */
export function planetPositionAu(key: MajorPlanetKey, jdTdb: number): Vec3 {
  const el = elementsAtCenturies(key, centuriesSinceJ2000(jdTdb));
  const omega = el.varpi - el.Omega;
  const M = el.L - el.varpi;
  const E = solveKepler(M, el.e);
  return positionFromAnomaly(el.a, el.e, E, omega, el.Omega, el.I);
}

/** Posição heliocêntrica (UA, eclíptica J2000) a partir de elementos osculadores (dois corpos). */
export function osculatingPositionAu(el: OsculatingElements, jdTdb: number): Vec3 {
  const M = el.M0 + el.n * (jdTdb - el.epochJd);
  const E = solveKepler(M, el.e);
  return positionFromAnomaly(el.a, el.e, E, el.peri, el.node, el.i);
}

/** Amostra a elipse orbital (UA, eclíptica J2000) com os elementos de uma data. */
export function samplePlanetOrbitAu(key: MajorPlanetKey, jdTdb: number, segments = 256): Vec3[] {
  const el = elementsAtCenturies(key, centuriesSinceJ2000(jdTdb));
  return sampleEllipse(el.a, el.e, el.varpi - el.Omega, el.Omega, el.I, segments);
}

export function sampleOsculatingOrbitAu(el: OsculatingElements, segments = 256): Vec3[] {
  return sampleEllipse(el.a, el.e, el.peri, el.node, el.i, segments);
}

function sampleEllipse(
  a: number,
  e: number,
  omega: number,
  node: number,
  incl: number,
  segments: number,
): Vec3[] {
  const pts: Vec3[] = [];
  for (let k = 0; k <= segments; k += 1) {
    const E = (360 * k) / segments;
    pts.push(positionFromAnomaly(a, e, E, omega, node, incl));
  }
  return pts;
}

/** Longitude e latitude eclípticas heliocêntricas (graus) e distância (UA) de um vetor. */
export function toSpherical(v: Vec3): { lonDeg: number; latDeg: number; r: number } {
  const r = Math.hypot(v.x, v.y, v.z);
  const lon = Math.atan2(v.y, v.x) / DEG;
  const lat = Math.asin(v.z / r) / DEG;
  return { lonDeg: lon < 0 ? lon + 360 : lon, latDeg: lat, r };
}
