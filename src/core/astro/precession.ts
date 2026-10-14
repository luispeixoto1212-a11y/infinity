import { J2000_JD } from './time';
import { DEG, type Vec3 } from './vector';

/** Matriz 3 × 3 guardada por linhas. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

export function mulMat3Vec(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}

export function mulMat3(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
    }
  }
  return r as unknown as Mat3;
}

export function transposeMat3(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** Dia juliano (TT) da época B1875.0, a dos limites oficiais das constelações (Delporte, 1930). */
export const B1875_JD = 2405889.258550475;

/**
 * Matriz de precessão do equador médio de jdFrom para o de jdTo (TT), com os ângulos ζ, z, θ
 * de Lieske et al. (1977), modelo IAU 1976, na forma geral de J. Meeus (cap. 21, eq. 21.2).
 * Aplica-se a vetores equatoriais: v(jdTo) = P · v(jdFrom).
 */
export function precessionMatrix(jdFrom: number, jdTo: number): Mat3 {
  const T = (jdFrom - J2000_JD) / 36525;
  const t = (jdTo - jdFrom) / 36525;
  const a = 2306.2181 + 1.39656 * T - 0.000139 * T * T;
  const zeta = (a * t + (0.30188 - 0.000344 * T) * t * t + 0.017998 * t * t * t) / 3600;
  const z = (a * t + (1.09468 + 0.000066 * T) * t * t + 0.018203 * t * t * t) / 3600;
  const theta =
    ((2004.3109 - 0.8533 * T - 0.000217 * T * T) * t - (0.42665 + 0.000217 * T) * t * t - 0.041833 * t * t * t) / 3600;
  const cz = Math.cos(zeta * DEG);
  const sz = Math.sin(zeta * DEG);
  const cZ = Math.cos(z * DEG);
  const sZ = Math.sin(z * DEG);
  const ct = Math.cos(theta * DEG);
  const st = Math.sin(theta * DEG);
  return [
    cz * cZ * ct - sz * sZ,
    -sz * cZ * ct - cz * sZ,
    -cZ * st,
    cz * sZ * ct + sz * cZ,
    -sz * sZ * ct + cz * cZ,
    -sZ * st,
    cz * st,
    -sz * st,
    ct,
  ];
}

/** Obliquidade média da eclíptica da data (graus), IAU 1980 (Meeus eq. 22.2). */
export function meanObliquityDeg(jdTt: number): number {
  const T = (jdTt - J2000_JD) / 36525;
  return 23.43929111 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
}
