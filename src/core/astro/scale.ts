import type { Vec3 } from './vector';

/**
 * Escala de visualização da cena 3D — NÃO é uma escala física.
 *
 * Distâncias: a direção de cada objeto em relação ao Sol é real; o raio é comprimido
 * por r_cena = K · r_UA^p, para que Mercúrio e Plutão caibam no mesmo ecrã.
 * Tamanhos: os raios crescem com √(R / R_Terra), muito ampliados em relação às distâncias.
 * O Sol é desenhado com tamanho fixo reduzido para não engolir as órbitas interiores.
 */
export const SCENE_SCALE = {
  distanceK: 40,
  distancePower: 0.5,
  earthRadiusUnits: 1,
  minBodyRadius: 0.3,
  sunRadiusUnits: 5,
  moonDistanceEarthRadii: 2.6,
  earthRadiusKm: 6371.0,
} as const;

export function compressDistanceAu(rAu: number): number {
  return SCENE_SCALE.distanceK * Math.pow(Math.max(rAu, 0), SCENE_SCALE.distancePower);
}

/** Inverso de compressDistanceAu (para converter distâncias da cena em UA). */
export function decompressDistance(units: number): number {
  return Math.pow(units / SCENE_SCALE.distanceK, 1 / SCENE_SCALE.distancePower);
}

/** Converte um vetor eclíptico J2000 (UA) para coordenadas da cena (eixo Y = polo norte da eclíptica). */
export function eclipticToScene(v: Vec3): Vec3 {
  return { x: v.x, y: v.z, z: -v.y };
}

/** Posição heliocêntrica (UA) → posição na cena, preservando a direção e comprimindo a distância. */
export function heliocentricAuToScene(v: Vec3): Vec3 {
  const r = Math.hypot(v.x, v.y, v.z);
  if (r === 0) return { x: 0, y: 0, z: 0 };
  const k = compressDistanceAu(r) / r;
  return eclipticToScene({ x: v.x * k, y: v.y * k, z: v.z * k });
}

/** Raio de desenho de um corpo a partir do seu raio médio real (km). */
export function bodyRadiusToScene(radiusKm: number): number {
  const ratio = radiusKm / SCENE_SCALE.earthRadiusKm;
  return Math.max(SCENE_SCALE.minBodyRadius, SCENE_SCALE.earthRadiusUnits * Math.sqrt(ratio));
}

/** Fator de ampliação aproximado dos tamanhos face às distâncias, a uma dada distância (UA). */
export function sizeExaggerationAt(rAu: number, radiusKm: number): number {
  const realRadiusAu = radiusKm / 149_597_870.7;
  const realOnScreen = (realRadiusAu / rAu) * compressDistanceAu(rAu);
  return bodyRadiusToScene(radiusKm) / realOnScreen;
}
