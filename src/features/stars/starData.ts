/**
 * Estrelas com nome próprio da IAU e todas as estrelas a menos de 20 anos-luz, do AT-HYG v3.2
 * (subconjunto HYGLike; D. Nash / astronexus, CC BY-SA 4.0). Gerado por scripts/build_stars.py.
 */

export type DistanceSource = 'gaia-dr3' | 'gaia-dr2' | 'hipparcos' | 'gliese' | 'other';

export interface Star {
  id: number;
  slug: string;
  name: string;
  hasProperName: boolean;
  /** Designação de Bayer ou Flamsteed (α Orionis) ou de catálogo (Gliese 551). */
  designation?: string;
  constellation?: string;
  hip?: number;
  hd?: number;
  hr?: number;
  gliese?: string;
  ra?: number;
  dec?: number;
  /** Distância em parsecs. */
  distPc?: number;
  distSource?: DistanceSource;
  mag?: number;
  absMag?: number;
  spectralType?: string;
  /** Índice de cor B−V. */
  colorIndex?: number;
  /** Velocidade radial (km/s; positiva = a afastar-se). */
  radialVelocity?: number;
}

interface RawStar {
  id: number;
  name: string;
  proper: boolean;
  des: string | null;
  con: string | null;
  hip: number | null;
  hd: number | null;
  hr: number | null;
  gl: string | null;
  ra: number | null;
  dec: number | null;
  dist: number | null;
  distSrc: DistanceSource | null;
  mag: number | null;
  absmag: number | null;
  spect: string | null;
  ci: number | null;
  rv: number | null;
}

export function starSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const u = <T,>(v: T | null): T | undefined => (v === null ? undefined : v);

export function parseStars(raw: unknown): Star[] {
  const r = raw as { stars?: RawStar[] };
  if (!r || !Array.isArray(r.stars)) throw new Error('Formato do catálogo de estrelas inválido');
  return r.stars.map((s) => ({
    id: s.id,
    slug: starSlug(s.name),
    name: s.name,
    hasProperName: s.proper,
    designation: u(s.des),
    constellation: u(s.con),
    hip: u(s.hip),
    hd: u(s.hd),
    hr: u(s.hr),
    gliese: s.gl ? s.gl.replace(/^Gl /, 'Gliese ') : undefined,
    ra: u(s.ra),
    dec: u(s.dec),
    distPc: u(s.dist),
    distSource: u(s.distSrc),
    mag: u(s.mag),
    absMag: u(s.absmag),
    spectralType: u(s.spect),
    colorIndex: u(s.ci),
    radialVelocity: u(s.rv),
  }));
}

let starsPromise: Promise<Star[]> | null = null;

export function loadStars(fetchImpl: typeof fetch = fetch): Promise<Star[]> {
  if (!starsPromise) {
    starsPromise = fetchImpl('data/star-catalog.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(parseStars)
      .catch((err: unknown) => {
        starsPromise = null;
        throw err;
      });
  }
  return starsPromise;
}

let hrPromise: Promise<Float32Array> | null = null;

/** Pontos do diagrama H-R: pares (B−V, magnitude absoluta). */
export function loadHrDiagram(fetchImpl: typeof fetch = fetch): Promise<Float32Array> {
  if (!hrPromise) {
    hrPromise = fetchImpl('data/hr-diagram.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ points: Array<[number, number]> }>;
      })
      .then((d) => {
        const arr = new Float32Array(d.points.length * 2);
        d.points.forEach(([ci, m], i) => {
          arr[i * 2] = ci;
          arr[i * 2 + 1] = m;
        });
        return arr;
      })
      .catch((err: unknown) => {
        hrPromise = null;
        throw err;
      });
  }
  return hrPromise;
}

// ------------------------------------------------------------------ grandezas e classificações

export const LY_PER_PC = 3.26156;
/** Magnitude absoluta visual do Sol usada nas comparações (valor convencional). */
export const SUN_ABS_MAG_V = 4.83;

export function lightYearsFromPc(pc: number): number {
  return pc * LY_PER_PC;
}

/** Luminosidade no visível em relação ao Sol, a partir da magnitude absoluta (sem correção bolométrica). */
export function visualLuminosity(absMag: number): number {
  return 10 ** (0.4 * (SUN_ABS_MAG_V - absMag));
}

/**
 * Temperatura efetiva aproximada a partir do índice de cor B−V (Ballesteros 2012, aproximação de corpo negro):
 * T = 4600 K × [1 / (0,92 (B−V) + 1,7) + 1 / (0,92 (B−V) + 0,62)].
 */
export function temperatureFromColor(bv: number): number | undefined {
  if (bv < -0.4 || bv > 2.0) return undefined;
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' | 'L' | 'T' | 'Y' | 'D' | 'W' | 'C' | 'S';

/** Classe espectral principal (ignora prefixos como "sd" de subanã). */
export function spectralClass(spect?: string): SpectralClass | undefined {
  if (!spect) return undefined;
  const s = spect.replace(/^(sd|esd|d|g|k|c)(?=[OBAFGKM])/, '');
  const c = s.charAt(0).toUpperCase();
  return 'OBAFGKMLTYDWCS'.includes(c) && c ? (c as SpectralClass) : undefined;
}

export type LuminosityClass = 'Ia' | 'Iab' | 'Ib' | 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII';

/** Classe de luminosidade de Morgan–Keenan, quando indicada no tipo espectral. */
export function luminosityClass(spect?: string): LuminosityClass | undefined {
  if (!spect) return undefined;
  if (/^sd/i.test(spect)) return 'VI';
  if (/^D/.test(spect)) return 'VII';
  const s = spect.replace(/\s+/g, '').replace(/IAB/g, 'Iab').replace(/IA/g, 'Ia').replace(/IB/g, 'Ib');
  // Sufixos como "p", "e" ou "n" (peculiar, emissão, linhas largas) podem seguir a classe
  const m = /(VII|VI|IV|V|III|II|Iab|Ia|Ib|I)(?![IV]|ab|a|b)/.exec(s);
  if (!m) return undefined;
  return m[1] as LuminosityClass;
}

/** Cor aproximada de uma estrela a partir do índice B−V (só para desenho). */
export function colorFromBv(bv?: number): string {
  if (bv === undefined) return '#e9edf8';
  const stops: Array<[number, [number, number, number]]> = [
    [-0.4, [155, 176, 255]],
    [0.0, [202, 215, 255]],
    [0.3, [248, 247, 255]],
    [0.6, [255, 244, 234]],
    [0.9, [255, 226, 186]],
    [1.3, [255, 196, 140]],
    [2.0, [255, 160, 100]],
  ];
  const v = Math.max(-0.4, Math.min(2.0, bv));
  for (let i = 1; i < stops.length; i += 1) {
    const [b1, c1] = stops[i]!;
    const [b0, c0] = stops[i - 1]!;
    if (v <= b1) {
      const t = (v - b0) / (b1 - b0);
      const c = c0.map((x, k) => Math.round(x + (c1[k]! - x) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  return 'rgb(255, 160, 100)';
}
