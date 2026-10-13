import { centuriesSinceJ2000, daysSinceJ2000 } from './time';
import { DEG, type Vec3, wrapDeg360 } from './vector';

/** Obliquidade da eclíptica em J2000 (IAU), usada para converter do equador para a eclíptica. */
export const OBLIQUITY_J2000_DEG = 23.43928;

/**
 * Parâmetros de orientação da IAU (WGCCRE 2015, Archinal et al. 2018), tal como no ficheiro
 * NAIF pck00011.tpc: α0 = a0 + a1·T, δ0 = d0 + d1·T (T em séculos), W = w0 + w1·d (d em dias).
 * Apenas os termos constante e linear: suficiente para a visualização.
 */
export interface PoleModel {
  ra: [number, number];
  dec: [number, number];
  pm: [number, number];
}

/** Converte um vetor do equador J2000 (ICRF) para a eclíptica J2000. */
export function equatorialToEcliptic(v: Vec3): Vec3 {
  const e = OBLIQUITY_J2000_DEG * DEG;
  const c = Math.cos(e);
  const s = Math.sin(e);
  return { x: v.x, y: c * v.y + s * v.z, z: -s * v.y + c * v.z };
}

/** Vetor unitário (equatorial J2000) para ascensão reta e declinação em graus. */
export function radecToUnit(raDeg: number, decDeg: number): Vec3 {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  return { x: Math.cos(d) * Math.cos(a), y: Math.cos(d) * Math.sin(a), z: Math.sin(d) };
}

export interface BodyFrame {
  /** Eixo do meridiano de referência (longitude 0°) no equador do corpo. */
  primeMeridian: Vec3;
  /** Eixo 90° E no equador do corpo. */
  east90: Vec3;
  /** Polo norte (IAU) do corpo. */
  north: Vec3;
}

/**
 * Eixos do referencial fixo ao corpo, expressos na eclíptica J2000.
 * Matriz da IAU: M = R_z(W)·R_x(90° − δ0)·R_z(90° + α0); os eixos do corpo são as linhas de M.
 */
export function bodyFrameEcliptic(model: PoleModel, jdTdb: number): BodyFrame {
  const T = centuriesSinceJ2000(jdTdb);
  const d = daysSinceJ2000(jdTdb);
  const alpha = (model.ra[0] + model.ra[1] * T) * DEG;
  const delta = (model.dec[0] + model.dec[1] * T) * DEG;
  const W = wrapDeg360(model.pm[0] + model.pm[1] * d) * DEG;

  // Linhas de R_x(90° − δ)·R_z(90° + α)
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  const sd = Math.sin(delta);
  const cd = Math.cos(delta);
  // Nodo (direção do nó ascendente do equador do corpo no equador terrestre) e eixo intermédio
  const nodeAxis: Vec3 = { x: -sa, y: ca, z: 0 };
  const midAxis: Vec3 = { x: -sd * ca, y: -sd * sa, z: cd };
  const north: Vec3 = { x: cd * ca, y: cd * sa, z: sd };

  const cW = Math.cos(W);
  const sW = Math.sin(W);
  const pm: Vec3 = {
    x: cW * nodeAxis.x + sW * midAxis.x,
    y: cW * nodeAxis.y + sW * midAxis.y,
    z: cW * nodeAxis.z + sW * midAxis.z,
  };
  const east: Vec3 = {
    x: -sW * nodeAxis.x + cW * midAxis.x,
    y: -sW * nodeAxis.y + cW * midAxis.y,
    z: -sW * nodeAxis.z + cW * midAxis.z,
  };
  return {
    primeMeridian: equatorialToEcliptic(pm),
    east90: equatorialToEcliptic(east),
    north: equatorialToEcliptic(north),
  };
}
