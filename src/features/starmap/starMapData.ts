/**
 * Mapa 3D da vizinhança do Sol: estrelas do AT-HYG v3.2 a menos de 100 parsecs, em coordenadas galácticas
 * (parsecs, Sol na origem; x para o centro da Galáxia, y no sentido da rotação galáctica, z para o polo norte
 * galáctico). Gerado por scripts/build_star_map.py.
 */
import { LY_PER_PC, SUN_ABS_MAG_V, spectralClass } from '../stars/starData';

export type MapDistanceSource = 'gaia-dr3' | 'gaia-dr2' | 'hipparcos' | 'gliese' | 'other';

export interface StarMapData {
  n: number;
  maxPc: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  /** Magnitude absoluta V (NaN quando falta). */
  absMag: Float32Array;
  /** Índice de cor B−V (NaN quando falta). */
  ci: Float32Array;
  /** Magnitude aparente V vista da Terra (NaN quando falta). */
  mag: Float32Array;
  spect: Array<string | null>;
  /** Nome próprio ou designação (Bayer, Flamsteed, Gliese, HIP, HD). */
  des: string[];
  /** Id do catálogo de estrelas com ficha (0 quando a estrela não tem ficha). */
  catalogId: Int32Array;
  distSrc: MapDistanceSource[];
}

const SRC: Record<string, MapDistanceSource> = { G: 'gaia-dr3', '2': 'gaia-dr2', H: 'hipparcos', J: 'gliese', O: 'other' };

interface Raw {
  n: number;
  maxPc: number;
  x: number[];
  y: number[];
  z: number[];
  M: Array<number | null>;
  ci: Array<number | null>;
  V: Array<number | null>;
  sp: Array<string | null>;
  des: string[];
  id: number[];
  src: string[];
}

const nanArray = (v: Array<number | null>) => Float32Array.from(v, (x) => (x === null ? NaN : x));

export function parseStarMap(raw: unknown): StarMapData {
  const r = raw as Raw;
  const keys: Array<keyof Raw> = ['x', 'y', 'z', 'M', 'ci', 'V', 'sp', 'des', 'id', 'src'];
  if (!r || typeof r.n !== 'number' || keys.some((k) => !Array.isArray(r[k]) || (r[k] as unknown[]).length !== r.n)) {
    throw new Error('Formato do mapa estelar inválido');
  }
  return {
    n: r.n,
    maxPc: r.maxPc,
    x: Float32Array.from(r.x),
    y: Float32Array.from(r.y),
    z: Float32Array.from(r.z),
    absMag: nanArray(r.M),
    ci: nanArray(r.ci),
    mag: nanArray(r.V),
    spect: r.sp,
    des: r.des,
    catalogId: Int32Array.from(r.id),
    distSrc: r.src.map((c) => SRC[c] ?? 'other'),
  };
}

let promise: Promise<StarMapData> | null = null;

export function loadStarMap(fetchImpl: typeof fetch = fetch): Promise<StarMapData> {
  if (!promise) {
    promise = fetchImpl('data/star-map.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(parseStarMap)
      .catch((err: unknown) => {
        promise = null;
        throw err;
      });
  }
  return promise;
}

// ---------------------------------------------------------------- grandezas derivadas

export function distancePc(d: StarMapData, i: number): number {
  return Math.hypot(d.x[i]!, d.y[i]!, d.z[i]!);
}

export function distanceLy(d: StarMapData, i: number): number {
  return distancePc(d, i) * LY_PER_PC;
}

/** Longitude e latitude galácticas (graus) a partir da posição. */
export function galacticLonLat(d: StarMapData, i: number): { l: number; b: number } {
  const x = d.x[i]!;
  const y = d.y[i]!;
  const z = d.z[i]!;
  const l = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const b = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  return { l, b };
}

/** Luminosidade no visível em relação ao Sol (sem correção bolométrica). */
export function visualLuminosityAt(d: StarMapData, i: number): number | undefined {
  const m = d.absMag[i]!;
  return Number.isNaN(m) ? undefined : 10 ** (0.4 * (SUN_ABS_MAG_V - m));
}

// ---------------------------------------------------------------- filtros

export type SpectralGroup = 'OB' | 'A' | 'F' | 'G' | 'K' | 'M' | 'other';
export const SPECTRAL_GROUPS: readonly SpectralGroup[] = ['OB', 'A', 'F', 'G', 'K', 'M', 'other'];

export function spectralGroup(spect: string | null): SpectralGroup {
  const c = spectralClass(spect ?? undefined);
  if (c === 'O' || c === 'B') return 'OB';
  if (c === 'A' || c === 'F' || c === 'G' || c === 'K' || c === 'M') return c;
  return 'other';
}

/** Classes de luminosidade no visível, em relação ao Sol. */
export type LuminosityBin = 'all' | 'gt100' | '1to100' | '0.01to1' | 'lt0.01';
export const LUMINOSITY_BINS: readonly LuminosityBin[] = ['all', 'gt100', '1to100', '0.01to1', 'lt0.01'];

export function inLuminosityBin(lum: number | undefined, bin: LuminosityBin): boolean {
  if (bin === 'all') return true;
  if (lum === undefined) return false;
  if (bin === 'gt100') return lum > 100;
  if (bin === '1to100') return lum > 1 && lum <= 100;
  if (bin === '0.01to1') return lum > 0.01 && lum <= 1;
  return lum <= 0.01;
}

export interface StarMapFilter {
  maxPc: number;
  groups: ReadonlySet<SpectralGroup>;
  luminosity: LuminosityBin;
}

export const DEFAULT_FILTER: StarMapFilter = { maxPc: 100, groups: new Set(SPECTRAL_GROUPS), luminosity: 'all' };

/** 1 para as estrelas que passam os filtros, 0 para as restantes. */
export function visibleMask(d: StarMapData, f: StarMapFilter): Uint8Array {
  const out = new Uint8Array(d.n);
  for (let i = 0; i < d.n; i += 1) {
    // No limite do mapa não se filtra pela distância (evita perder estrelas a 100,0004 pc por arredondamento)
    if (f.maxPc < d.maxPc && distancePc(d, i) > f.maxPc) continue;
    if (!f.groups.has(spectralGroup(d.spect[i] ?? null))) continue;
    if (!inLuminosityBin(visualLuminosityAt(d, i), f.luminosity)) continue;
    out[i] = 1;
  }
  return out;
}

/** Índices das estrelas visíveis, da mais próxima para a mais afastada. */
export function nearestVisible(d: StarMapData, mask: Uint8Array, count: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < d.n; i += 1) if (mask[i]) idx.push(i);
  idx.sort((a, b) => distancePc(d, a) - distancePc(d, b));
  return idx.slice(0, count);
}

/** Procura por nome ou designação (sem acentos nem maiúsculas). */
export function searchStarMap(d: StarMapData, query: string, limit = 8): number[] {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const q = norm(query);
  if (q.length < 2) return [];
  const starts: number[] = [];
  const contains: number[] = [];
  for (let i = 0; i < d.n; i += 1) {
    const name = norm(d.des[i]!);
    if (name.startsWith(q)) starts.push(i);
    else if (name.includes(q)) contains.push(i);
  }
  const byDist = (a: number, b: number) => distancePc(d, a) - distancePc(d, b);
  return [...starts.sort(byDist), ...contains.sort(byDist)].slice(0, limit);
}
