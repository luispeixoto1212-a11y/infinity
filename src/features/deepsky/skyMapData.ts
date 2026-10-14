/**
 * Dados do mapa do céu: linhas e etiquetas das constelações e contorno da Via Láctea (d3-celestial,
 * BSD-3-Clause; gerados por scripts/build_skymap.py) e estrelas brilhantes do Yale Bright Star Catalogue.
 */

export interface SkyMapData {
  /** Por constelação: segmentos de linha, cada um com pontos [ascensão reta, declinação] em graus. */
  lines: Record<string, Array<Array<[number, number]>>>;
  /** [abreviatura, ascensão reta, declinação, ordem de importância 1–3]. */
  labels: Array<[string, number, number, number]>;
}

export interface BrightStar {
  ra: number;
  dec: number;
  mag: number;
  bv?: number;
  name?: string;
}

export function parseSkyMap(raw: unknown): SkyMapData {
  const r = raw as Partial<SkyMapData>;
  if (!r || typeof r.lines !== 'object' || !Array.isArray(r.labels)) throw new Error('Formato do mapa do céu inválido');
  return { lines: r.lines as SkyMapData['lines'], labels: r.labels };
}

/** Converte o catálogo de estrelas da aplicação (colunas) nas estrelas até à magnitude indicada. */
export function parseBrightStars(raw: unknown, maxMag = 4.5): BrightStar[] {
  const r = raw as { columns?: string[]; stars?: unknown[][] };
  if (!r || !Array.isArray(r.columns) || !Array.isArray(r.stars)) throw new Error('Formato do catálogo de estrelas inválido');
  const col = (name: string) => r.columns!.indexOf(name);
  const [iRa, iDec, iMag, iBv, iName] = [col('raDeg'), col('decDeg'), col('vmag'), col('bv'), col('name')];
  const out: BrightStar[] = [];
  for (const s of r.stars) {
    const mag = s[iMag] as number;
    if (typeof mag !== 'number' || mag > maxMag) continue;
    out.push({
      ra: s[iRa] as number,
      dec: s[iDec] as number,
      mag,
      bv: typeof s[iBv] === 'number' ? (s[iBv] as number) : undefined,
      name: typeof s[iName] === 'string' && s[iName] ? (s[iName] as string) : undefined,
    });
  }
  return out;
}

function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  return fetchImpl(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

let skyPromise: Promise<{ map: SkyMapData; stars: BrightStar[] }> | null = null;

export function loadSkyMap(fetchImpl: typeof fetch = fetch): Promise<{ map: SkyMapData; stars: BrightStar[] }> {
  if (!skyPromise) {
    skyPromise = Promise.all([fetchJson('data/sky-map.json', fetchImpl), fetchJson('data/stars.json', fetchImpl)])
      .then(([m, s]) => ({ map: parseSkyMap(m), stars: parseBrightStars(s) }))
      .catch((err: unknown) => {
        skyPromise = null;
        throw err;
      });
  }
  return skyPromise;
}

/** Grelha da Via Láctea: 720 × 360 valores (0 a 5) em projeção equiretangular, 0,5° por célula. */
export interface MilkyWayGrid {
  width: number;
  height: number;
  levels: Uint8Array;
}

let mwPromise: Promise<MilkyWayGrid> | null = null;

export function loadMilkyWay(): Promise<MilkyWayGrid> {
  if (!mwPromise) {
    mwPromise = new Promise<MilkyWayGrid>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D indisponível'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const levels = new Uint8Array(c.width * c.height);
        for (let i = 0; i < levels.length; i += 1) levels[i] = Math.round(data[i * 4]! / 51);
        resolve({ width: c.width, height: c.height, levels });
      };
      img.onerror = () => reject(new Error('Não foi possível carregar a Via Láctea'));
      img.src = 'data/milky-way.png';
    }).catch((err: unknown) => {
      mwPromise = null;
      throw err;
    });
  }
  return mwPromise;
}

/** Nível da Via Láctea (0 a 5, com interpolação bilinear entre células) numa posição do céu. */
export function milkyWayLevel(grid: MilkyWayGrid, ra: number, dec: number): number {
  const fx = ((360 - ra) / 360) * grid.width - 0.5;
  const fy = ((90 - dec) / 180) * grid.height - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.max(0, Math.min(grid.height - 1, Math.floor(fy)));
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = Math.max(0, Math.min(1, fy - y0));
  const wrap = (x: number) => ((x % grid.width) + grid.width) % grid.width;
  const at = (x: number, y: number) => grid.levels[y * grid.width + wrap(x)]!;
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x0 + 1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}
