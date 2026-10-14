import { orbitalPlaneToEcliptic } from './kepler';
import { DEG, type Vec3, length, sub } from './vector';

/**
 * Posições de asteroides e cometas a partir de elementos osculadores do JPL Horizons.
 *
 * Os dados (public/data/small-bodies.json) têm, para cada corpo, elementos heliocêntricos (eclíptica J2000) em várias
 * épocas: de 20 em 20 anos entre 1806 e 2046 e, para os corpos com encontros próximos com planetas ou com forças
 * não gravitacionais importantes, de 5 em 5 anos entre 1991 e 2041. Para uma data, usa-se a época mais próxima e
 * propaga-se como problema de dois corpos (elíptico ou hiperbólico). Os erros resultantes, medidos contra posições do
 * próprio Horizons, estão nos testes e na página "Dados e métodos".
 */

/** [época (DJ TDB), e, q (UA), i (°), Ω (°), ω (°), passagem pelo periélio (DJ TDB)] */
export type EpochElements = [number, number, number, number, number, number, number];

/** Constante de Gauss (rad/dia): movimento médio n = k / a^1,5 com a em UA. */
export const GAUSS_K = 0.01720209895;

export interface SmallBodyOrbitData {
  source: string;
  consulted: string;
  orbits: Record<string, EpochElements[]>;
  validation: Record<string, [number, number, number, number][]>;
}

/** Época mais próxima da data (as épocas estão ordenadas). */
export function nearestEpoch(epochs: readonly EpochElements[], jd: number): EpochElements {
  if (epochs.length === 0) throw new RangeError('Sem épocas');
  let best = epochs[0]!;
  for (const ep of epochs) if (Math.abs(ep[0] - jd) < Math.abs(best[0] - jd)) best = ep;
  return best;
}

/** Semieixo maior (UA); negativo nas órbitas hiperbólicas. */
export function semiMajorAxis(el: EpochElements): number {
  return el[2] / (1 - el[1]);
}

/** Movimento médio (graus/dia). */
export function meanMotionDeg(el: EpochElements): number {
  return (GAUSS_K / Math.abs(semiMajorAxis(el)) ** 1.5) / DEG;
}

/** Período orbital (dias); infinito nas órbitas abertas. */
export function orbitalPeriodDays(el: EpochElements): number {
  return el[1] < 1 ? 360 / meanMotionDeg(el) : Infinity;
}

/** Anomalia verdadeira (rad) a partir da anomalia média (rad), para e < 1 ou e > 1. */
export function trueAnomaly(M: number, e: number): number {
  if (e < 1) {
    const m = Math.atan2(Math.sin(M), Math.cos(M));
    let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
    for (let i = 0; i < 60; i += 1) {
      const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-13) break;
    }
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  }
  let H = Math.asinh(M / e);
  for (let i = 0; i < 100; i += 1) {
    const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
    H -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return 2 * Math.atan2(Math.sqrt(e + 1) * Math.sinh(H / 2), Math.sqrt(e - 1) * Math.cosh(H / 2));
}

/** Posição heliocêntrica (UA, eclíptica J2000) para uma anomalia verdadeira (rad). */
export function positionAtTrueAnomaly(el: EpochElements, nu: number): Vec3 {
  const [, e, q, i, node, peri] = el;
  const r = (q * (1 + e)) / (1 + e * Math.cos(nu));
  return orbitalPlaneToEcliptic(r * Math.cos(nu), r * Math.sin(nu), peri, node, i);
}

/** Posição heliocêntrica (UA, eclíptica J2000) numa data, com os elementos de uma época. */
export function positionFromElements(el: EpochElements, jd: number): Vec3 {
  const M = meanMotionDeg(el) * DEG * (jd - el[6]);
  return positionAtTrueAnomaly(el, trueAnomaly(M, el[1]));
}

/** Posição heliocêntrica (UA, eclíptica J2000) com a época mais próxima da data. */
export function smallBodyPositionAu(epochs: readonly EpochElements[], jd: number): Vec3 {
  return positionFromElements(nearestEpoch(epochs, jd), jd);
}

/**
 * Pontos da órbita (UA) com os elementos da época mais próxima. Nas órbitas abertas desenha-se só o troço até
 * `maxRadiusAu` do Sol; nas fechadas, a elipse completa (pontos mais densos junto ao periélio).
 */
export function sampleSmallBodyOrbit(epochs: readonly EpochElements[], jd: number, segments = 240, maxRadiusAu = 60): Vec3[] {
  const el = nearestEpoch(epochs, jd);
  const e = el[1];
  const pts: Vec3[] = [];
  if (e < 1) {
    for (let k = 0; k <= segments; k += 1) {
      // Amostragem uniforme na anomalia excêntrica: mais pontos onde a órbita curva mais.
      const E = (2 * Math.PI * k) / segments;
      const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
      pts.push(positionAtTrueAnomaly(el, nu));
    }
    return pts;
  }
  const p = el[2] * (1 + e);
  // r(ν) = p/(1+e·cos ν) ≤ maxRadius  ⇒  cos ν ≥ (p/maxRadius − 1)/e
  const nuMax = Math.acos(Math.max(-1, Math.min(1, (p / maxRadiusAu - 1) / e)));
  for (let k = 0; k <= segments; k += 1) pts.push(positionAtTrueAnomaly(el, -nuMax + (2 * nuMax * k) / segments));
  return pts;
}

/** Próxima passagem pelo periélio depois da data (ou a última, nas órbitas abertas). */
export function nextPerihelionJd(epochs: readonly EpochElements[], jd: number): number {
  const el = nearestEpoch(epochs, jd);
  const P = orbitalPeriodDays(el);
  if (!Number.isFinite(P)) return el[6];
  return el[6] + Math.ceil((jd - el[6]) / P) * P;
}

/** Distância do periélio e do afélio (UA). O afélio é infinito nas órbitas abertas. */
export function perihelionAphelion(el: EpochElements): { q: number; Q: number } {
  const a = semiMajorAxis(el);
  return { q: el[2], Q: el[1] < 1 ? a * (1 + el[1]) : Infinity };
}

/** Maior erro de posição face às posições do JPL Horizons guardadas com os dados (graus vistos do Sol e UA). */
export function validationError(data: SmallBodyOrbitData, id: string): { deg: number; au: number } {
  let deg = 0;
  let au = 0;
  for (const [jd, x, y, z] of data.validation[id] ?? []) {
    const ref = { x, y, z };
    const d = length(sub(smallBodyPositionAu(data.orbits[id]!, jd), ref));
    au = Math.max(au, d);
    deg = Math.max(deg, d / length(ref) / DEG);
  }
  return { deg, au };
}

export async function fetchSmallBodyOrbits(signal?: AbortSignal): Promise<SmallBodyOrbitData> {
  const res = await fetch('data/small-bodies.json', { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as SmallBodyOrbitData;
  if (!data || typeof data.orbits !== 'object') throw new Error('Formato de dados inválido');
  return data;
}

let cache: Promise<SmallBodyOrbitData> | null = null;

/** Carrega os elementos uma vez por sessão (partilhado pela lista, fichas e vista 3D). */
export function loadSmallBodyOrbits(): Promise<SmallBodyOrbitData> {
  cache ??= fetchSmallBodyOrbits().catch((err) => {
    cache = null;
    throw err;
  });
  return cache;
}
