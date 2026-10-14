import { centuriesSinceJ2000 } from './time';
import { precessionMatrix, meanObliquityDeg, mulMat3Vec, transposeMat3 } from './precession';
import { equatorialToEcliptic } from './orientation';
import { DEG, type Vec3, wrapDeg360 } from './vector';
import { J2000_JD } from './time';

/**
 * Posição geocêntrica da Lua pela teoria ELP-2000/82 truncada de J. Meeus
 * ("Astronomical Algorithms", 2.ª ed., cap. 47, tabelas 47.A e 47.B: 60 termos em longitude e distância
 * e 60 em latitude, mais as correções aditivas A1, A2, A3).
 *
 * Precisão indicada por Meeus: cerca de 10″ em longitude e 4″ em latitude. Os testes comparam
 * o resultado com o JPL Horizons (DE441) em cinco datas entre 2000 e 2030.
 */

/** Argumentos fundamentais (graus), Meeus eq. 47.1–47.5. */
function fundamentalArguments(T: number) {
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  return {
    Lp: 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000,
    D: 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000,
    M: 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000,
    Mp: 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000,
    F: 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000,
  };
}

// Tabela 47.A: D, M, M′, F, Σl (10⁻⁶ grau), Σr (10⁻³ km)
const LR_TERMS = [
  0, 0, 1, 0, 6288774, -20905355, 2, 0, -1, 0, 1274027, -3699111, 2, 0, 0, 0, 658314, -2955968, 0, 0, 2, 0, 213618, -569925,
  0, 1, 0, 0, -185116, 48888, 0, 0, 0, 2, -114332, -3149, 2, 0, -2, 0, 58793, 246158, 2, -1, -1, 0, 57066, -152138,
  2, 0, 1, 0, 53322, -170733, 2, -1, 0, 0, 45758, -204586, 0, 1, -1, 0, -40923, -129620, 1, 0, 0, 0, -34720, 108743,
  0, 1, 1, 0, -30383, 104755, 2, 0, 0, -2, 15327, 10321, 0, 0, 1, 2, -12528, 0, 0, 0, 1, -2, 10980, 79661,
  4, 0, -1, 0, 10675, -34782, 0, 0, 3, 0, 10034, -23210, 4, 0, -2, 0, 8548, -21636, 2, 1, -1, 0, -7888, 24208,
  2, 1, 0, 0, -6766, 30824, 1, 0, -1, 0, -5163, -8379, 1, 1, 0, 0, 4987, -16675, 2, -1, 1, 0, 4036, -12831,
  2, 0, 2, 0, 3994, -10445, 4, 0, 0, 0, 3861, -11650, 2, 0, -3, 0, 3665, 14403, 0, 1, -2, 0, -2689, -7003,
  2, 0, -1, 2, -2602, 0, 2, -1, -2, 0, 2390, 10056, 1, 0, 1, 0, -2348, 6322, 2, -2, 0, 0, 2236, -9884,
  0, 1, 2, 0, -2120, 5751, 0, 2, 0, 0, -2069, 0, 2, -2, -1, 0, 2048, -4950, 2, 0, 1, -2, -1773, 4130,
  2, 0, 0, 2, -1595, 0, 4, -1, -1, 0, 1215, -3958, 0, 0, 2, 2, -1110, 0, 3, 0, -1, 0, -892, 3258,
  2, 1, 1, 0, -810, 2616, 4, -1, -2, 0, 759, -1897, 0, 2, -1, 0, -713, -2117, 2, 2, -1, 0, -700, 2354,
  2, 1, -2, 0, 691, 0, 2, -1, 0, -2, 596, 0, 4, 0, 1, 0, 549, -1423, 0, 0, 4, 0, 537, -1117,
  4, -1, 0, 0, 520, -1571, 1, 0, -2, 0, -487, -1739, 2, 1, 0, -2, -399, 0, 0, 0, 2, -2, -381, -4421,
  1, 1, 1, 0, 351, 0, 3, 0, -2, 0, -340, 0, 4, 0, -3, 0, 330, 0, 2, -1, 2, 0, 327, 0,
  0, 2, 1, 0, -323, 1165, 1, 1, -1, 0, 299, 0, 2, 0, 3, 0, 294, 0, 2, 0, -1, -2, 0, 8752,
];

// Tabela 47.B: D, M, M′, F, Σb (10⁻⁶ grau)
const B_TERMS = [
  0, 0, 0, 1, 5128122, 0, 0, 1, 1, 280602, 0, 0, 1, -1, 277693, 2, 0, 0, -1, 173237, 2, 0, -1, 1, 55413,
  2, 0, -1, -1, 46271, 2, 0, 0, 1, 32573, 0, 0, 2, 1, 17198, 2, 0, 1, -1, 9266, 0, 0, 2, -1, 8822,
  2, -1, 0, -1, 8216, 2, 0, -2, -1, 4324, 2, 0, 1, 1, 4200, 2, 1, 0, -1, -3359, 2, -1, -1, 1, 2463,
  2, -1, 0, 1, 2211, 2, -1, -1, -1, 2065, 0, 1, -1, -1, -1870, 4, 0, -1, -1, 1828, 0, 1, 0, 1, -1794,
  0, 0, 0, 3, -1749, 0, 1, -1, 1, -1565, 1, 0, 0, 1, -1491, 0, 1, 1, 1, -1475, 0, 1, 1, -1, -1410,
  0, 1, 0, -1, -1344, 1, 0, 0, -1, -1335, 0, 0, 3, 1, 1107, 4, 0, 0, -1, 1021, 4, 0, -1, 1, 833,
  0, 0, 1, -3, 777, 4, 0, -2, 1, 671, 2, 0, 0, -3, 607, 2, 0, 2, -1, 596, 2, -1, 1, -1, 491,
  2, 0, -2, 1, -451, 0, 0, 3, -1, 439, 2, 0, 2, 1, 422, 2, 0, -3, -1, 421, 2, 1, -1, 1, -366,
  2, 1, 0, 1, -351, 4, 0, 0, 1, 331, 2, -1, 1, 1, 315, 2, -2, 0, -1, 302, 0, 0, 1, 3, -283,
  2, 1, 1, -1, -229, 1, 1, 0, -1, 223, 1, 1, 0, 1, 223, 0, 1, -2, -1, -220, 2, 1, -1, -1, -220,
  1, 0, 1, 1, -185, 2, -1, -2, -1, 181, 0, 1, 2, 1, -177, 4, 0, -2, -1, 176, 4, -1, -1, -1, 166,
  1, 0, 1, -1, -164, 4, 0, 1, -1, 132, 1, 0, -1, -1, -119, 4, -1, 0, -1, 115, 2, -2, 0, 1, 107,
];

export interface LunarEclipticPosition {
  /** Longitude e latitude eclípticas geocêntricas, equinócio médio da data (graus). */
  lonDeg: number;
  latDeg: number;
  /** Distância centro a centro Terra–Lua (km). */
  distanceKm: number;
}

/** Longitude, latitude (equinócio médio da data) e distância geocêntricas da Lua. jdTt em TT/TDB. */
export function moonEclipticOfDate(jdTt: number): LunarEclipticPosition {
  const T = centuriesSinceJ2000(jdTt);
  const { Lp, D, M, Mp, F } = fundamentalArguments(T);
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  const A3 = 313.45 + 481266.484 * T;
  const d = D * DEG;
  const m = M * DEG;
  const mp = Mp * DEG;
  const f = F * DEG;

  let sl = 0;
  let sr = 0;
  for (let i = 0; i < LR_TERMS.length; i += 6) {
    const cm = LR_TERMS[i + 1]!;
    const arg = LR_TERMS[i]! * d + cm * m + LR_TERMS[i + 2]! * mp + LR_TERMS[i + 3]! * f;
    const e = cm === 0 ? 1 : Math.abs(cm) === 1 ? E : E * E;
    sl += LR_TERMS[i + 4]! * e * Math.sin(arg);
    sr += LR_TERMS[i + 5]! * e * Math.cos(arg);
  }
  let sb = 0;
  for (let i = 0; i < B_TERMS.length; i += 5) {
    const cm = B_TERMS[i + 1]!;
    const arg = B_TERMS[i]! * d + cm * m + B_TERMS[i + 2]! * mp + B_TERMS[i + 3]! * f;
    const e = cm === 0 ? 1 : Math.abs(cm) === 1 ? E : E * E;
    sb += B_TERMS[i + 4]! * e * Math.sin(arg);
  }
  // Correções aditivas (ação de Vénus, de Júpiter e achatamento da Terra)
  sl += 3958 * Math.sin(A1 * DEG) + 1962 * Math.sin((Lp - F) * DEG) + 318 * Math.sin(A2 * DEG);
  sb +=
    -2235 * Math.sin(Lp * DEG) +
    382 * Math.sin(A3 * DEG) +
    175 * Math.sin((A1 - F) * DEG) +
    175 * Math.sin((A1 + F) * DEG) +
    127 * Math.sin((Lp - Mp) * DEG) -
    115 * Math.sin((Lp + Mp) * DEG);

  return {
    lonDeg: wrapDeg360(Lp + sl / 1e6),
    latDeg: sb / 1e6,
    distanceKm: 385000.56 + sr / 1000,
  };
}

/** Vetor geocêntrico da Lua (km) no equador médio da data. */
export function moonEquatorialOfDateKm(jdTt: number): Vec3 {
  const p = moonEclipticOfDate(jdTt);
  const eps = meanObliquityDeg(jdTt) * DEG;
  const l = p.lonDeg * DEG;
  const b = p.latDeg * DEG;
  const x = p.distanceKm * Math.cos(b) * Math.cos(l);
  const y = p.distanceKm * Math.cos(b) * Math.sin(l);
  const z = p.distanceKm * Math.sin(b);
  return { x, y: Math.cos(eps) * y - Math.sin(eps) * z, z: Math.sin(eps) * y + Math.cos(eps) * z };
}

/** Vetor geocêntrico da Lua (km) no equador J2000 (ICRF), sem aberração nem nutação. */
export function moonEquatorialJ2000Km(jdTt: number): Vec3 {
  return mulMat3Vec(transposeMat3(precessionMatrix(J2000_JD, jdTt)), moonEquatorialOfDateKm(jdTt));
}

/** Vetor geocêntrico da Lua (km, eclíptica J2000), usado na vista 3D. */
export function moonGeocentricKm(jdTdb: number): Vec3 {
  return equatorialToEcliptic(moonEquatorialJ2000Km(jdTdb));
}

/** Erro máximo da posição da Lua face ao JPL Horizons nas datas de teste (graus). */
export const MOON_POSITION_MAX_ERROR_DEG = 0.01;
