/**
 * Catálogo de exoplanetas: tabela PSCompPars do NASA Exoplanet Archive, na cópia diária distribuída
 * pelo projeto Open Exoplanet Catalogue (ver tools/build_exoplanets.py e public/data/exoplanets.json).
 *
 * Os valores não são alterados (apenas arredondados a 5 algarismos significativos na conversão).
 * O arquivo preenche alguns raios e massas com valores calculados (relação massa–raio); como a
 * cópia não guarda essa indicação, a aplicação trata como estimativa todo o valor sem incerteza
 * publicada, e como dependente de modelos o raio de planetas observados por imagem direta.
 */

import { formatDate } from '../../core/format';

export type DiscoveryMethod = 'transit' | 'rv' | 'microlensing' | 'imaging' | 'timing' | 'other';

export const DISCOVERY_METHODS: readonly DiscoveryMethod[] = ['transit', 'rv', 'microlensing', 'imaging', 'timing', 'other'];

export interface HostStar {
  teff?: number;
  /** Raio em raios solares. */
  radius?: number;
  /** Massa em massas solares. */
  mass?: number;
  spectralType?: string;
  vmag?: number;
}

export interface Exoplanet {
  name: string;
  slug: string;
  host: string;
  altNames: string[];
  method: DiscoveryMethod;
  year?: number;
  /** Período orbital (dias). */
  period?: number;
  /** Semieixo maior (UA). */
  a?: number;
  e?: number;
  /** Massa em massas de Júpiter (pode ser a massa mínima, M·sin i). */
  massJ?: number;
  massErrJ?: number;
  /** Massa com incerteza publicada (tratada como medida). */
  massMeasured: boolean;
  /** Raio em raios de Júpiter. */
  radiusJ?: number;
  radiusErrJ?: number;
  /** Raio com incerteza publicada e não dependente de modelos de imagem direta. */
  radiusMeasured: boolean;
  /** Temperatura de equilíbrio (K). */
  teq?: number;
  inclination?: number;
  /** Distância ao Sistema Solar (parsecs). */
  distPc?: number;
  /** Ascensão reta e declinação (graus, J2000). */
  ra?: number;
  dec?: number;
  star: HostStar;
  systemPlanets: number;
  discoveryRef?: string;
  /** Telescópio espacial usado na descoberta, 'ground' para observatórios em terra. */
  facility?: string;
}

export interface ExoplanetCatalog {
  snapshot: string;
  source: string;
  via: string;
  planets: Exoplanet[];
  bySlug: Map<string, Exoplanet>;
  byHost: Map<string, Exoplanet[]>;
}

/** Massas e raios de Júpiter em unidades terrestres (os mesmos fatores usados pelo NASA Exoplanet Archive). */
export const EARTH_MASSES_PER_JUPITER = 317.83;
export const EARTH_RADII_PER_JUPITER = 11.209;
export const LY_PER_PC = 3.26156;
/** Temperatura efetiva do Sol (K), IAU 2015 Resolution B3. */
export const SUN_TEFF = 5772;

export function exoSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Cell = string | number | null;

interface RawCatalog {
  source: string;
  via: string;
  snapshot: string;
  columns: string[];
  rows: Cell[][];
}

const METHOD_SET = new Set<string>(DISCOVERY_METHODS);

function num(v: Cell | undefined): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(v: Cell | undefined): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

export function parseCatalog(raw: unknown): ExoplanetCatalog {
  const r = raw as RawCatalog;
  if (!r || !Array.isArray(r.columns) || !Array.isArray(r.rows)) throw new Error('Formato do catálogo de exoplanetas inválido');
  const col = (name: string) => {
    const i = r.columns.indexOf(name);
    if (i < 0) throw new Error(`Coluna em falta: ${name}`);
    return i;
  };
  const C = {
    name: col('name'), host: col('host'), alt: col('alt'), method: col('method'), year: col('year'), period: col('period'),
    a: col('a'), e: col('e'), massJ: col('massJ'), massErr: col('massErr'), massHasErr: col('massHasErr'),
    radiusJ: col('radiusJ'), radiusErr: col('radiusErr'), radiusHasErr: col('radiusHasErr'), teq: col('teq'), incl: col('incl'),
    dist: col('dist'), ra: col('ra'), dec: col('dec'), stTeff: col('stTeff'), stRad: col('stRad'), stMass: col('stMass'),
    stSpec: col('stSpec'), stVmag: col('stVmag'), sysPlanets: col('sysPlanets'), discRef: col('discRef'), facility: col('facility'),
  };
  const planets: Exoplanet[] = [];
  for (const row of r.rows) {
    const name = str(row[C.name]);
    if (!name) continue;
    const methodRaw = str(row[C.method]) ?? 'other';
    const method = (METHOD_SET.has(methodRaw) ? methodRaw : 'other') as DiscoveryMethod;
    const radiusJ = num(row[C.radiusJ]);
    const massJ = num(row[C.massJ]);
    planets.push({
      name,
      slug: exoSlug(name),
      host: str(row[C.host]) ?? name,
      altNames: (str(row[C.alt]) ?? '').split('|').filter(Boolean),
      method,
      year: num(row[C.year]),
      period: num(row[C.period]),
      a: num(row[C.a]),
      e: num(row[C.e]),
      massJ,
      massErrJ: num(row[C.massErr]),
      massMeasured: massJ !== undefined && row[C.massHasErr] === 1,
      radiusJ,
      radiusErrJ: num(row[C.radiusErr]),
      radiusMeasured: radiusJ !== undefined && row[C.radiusHasErr] === 1 && method !== 'imaging',
      teq: num(row[C.teq]),
      inclination: num(row[C.incl]),
      distPc: num(row[C.dist]),
      ra: num(row[C.ra]),
      dec: num(row[C.dec]),
      star: {
        teff: num(row[C.stTeff]),
        radius: num(row[C.stRad]),
        mass: num(row[C.stMass]),
        spectralType: str(row[C.stSpec]),
        vmag: num(row[C.stVmag]),
      },
      systemPlanets: num(row[C.sysPlanets]) ?? 1,
      discoveryRef: str(row[C.discRef]),
      facility: str(row[C.facility]),
    });
  }
  const bySlug = new Map(planets.map((p) => [p.slug, p]));
  const byHost = new Map<string, Exoplanet[]>();
  for (const p of planets) {
    const list = byHost.get(p.host);
    if (list) list.push(p);
    else byHost.set(p.host, [p]);
  }
  for (const list of byHost.values()) list.sort((x, y) => (x.a ?? x.period ?? 0) - (y.a ?? y.period ?? 0));
  return { snapshot: r.snapshot, source: r.source, via: r.via, planets, bySlug, byHost };
}

let catalogPromise: Promise<ExoplanetCatalog> | null = null;

/** Carrega o catálogo uma vez por sessão (o ficheiro só é pedido quando é preciso). */
export function loadExoplanets(fetchImpl: typeof fetch = fetch): Promise<ExoplanetCatalog> {
  if (!catalogPromise) {
    catalogPromise = fetchImpl('data/exoplanets.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(parseCatalog)
      .catch((err: unknown) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

// ------------------------------------------------------------------ grandezas derivadas

export function massEarth(p: Exoplanet): number | undefined {
  return p.massJ === undefined ? undefined : p.massJ * EARTH_MASSES_PER_JUPITER;
}

export function radiusEarth(p: Exoplanet): number | undefined {
  return p.radiusJ === undefined ? undefined : p.radiusJ * EARTH_RADII_PER_JUPITER;
}

export type SizeClass = 'earth' | 'super-earth' | 'neptune' | 'jupiter' | 'larger';

/** Classes de tamanho usadas pela missão Kepler (Borucki et al. 2011), em raios terrestres. */
export function sizeClass(radiusEarthValue: number): SizeClass {
  if (radiusEarthValue < 1.25) return 'earth';
  if (radiusEarthValue < 2) return 'super-earth';
  if (radiusEarthValue < 6) return 'neptune';
  if (radiusEarthValue < 15) return 'jupiter';
  return 'larger';
}

/** Luminosidade da estrela (em luminosidades solares) pela lei de Stefan–Boltzmann: L = R² (T / T☉)⁴. */
export function stellarLuminosity(star: HostStar): number | undefined {
  if (!star.radius || !star.teff) return undefined;
  return star.radius ** 2 * (star.teff / SUN_TEFF) ** 4;
}

/**
 * Semieixo maior em UA: o valor publicado ou, na sua falta, o calculado pela terceira lei de Kepler
 * a partir do período e da massa da estrela (a³ = M · P², com P em anos e M em massas solares).
 */
export function semiMajorAxis(p: Exoplanet): { value: number; derived: boolean } | undefined {
  if (p.a !== undefined && p.a > 0) return { value: p.a, derived: false };
  if (p.period && p.star.mass) {
    const years = p.period / 365.25;
    return { value: Math.cbrt(p.star.mass * years * years), derived: true };
  }
  return undefined;
}

/** Fluxo de energia recebido da estrela, em relação ao que a Terra recebe do Sol (S = L / a²). */
export function insolation(p: Exoplanet): number | undefined {
  const L = stellarLuminosity(p.star);
  const a = semiMajorAxis(p);
  if (!L || !a) return undefined;
  return L / (a.value * a.value);
}

/** Distância a que uma estrela de luminosidade L dá o fluxo S (em unidades terrestres): d = √(L / S). */
export function distanceForFlux(luminosity: number, flux: number): number {
  return Math.sqrt(luminosity / flux);
}

/** Fluxos recebidos por Vénus e por Marte (raio orbital médio da NASA: 0,723 e 1,524 UA). */
export const VENUS_FLUX = 1 / 0.723 ** 2;
export const MARS_FLUX = 1 / 1.524 ** 2;

/** Data da cópia do catálogo (AAAA-MM-DD) por extenso em pt-PT. */
export function snapshotDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formatDate(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12)));
}

export function lightYears(pc: number): number {
  return pc * LY_PER_PC;
}

// ------------------------------------------------------------------ estatísticas

export function countByMethod(planets: readonly Exoplanet[]): Record<DiscoveryMethod, number> {
  const out = Object.fromEntries(DISCOVERY_METHODS.map((m) => [m, 0])) as Record<DiscoveryMethod, number>;
  for (const p of planets) out[p.method] += 1;
  return out;
}

/** Grupos usados no gráfico por ano (os métodos menos frequentes juntam-se em "outros"). */
export type MethodGroup = 'transit' | 'rv' | 'microlensing' | 'others';
export const METHOD_GROUPS: readonly MethodGroup[] = ['transit', 'rv', 'microlensing', 'others'];

export function methodGroup(m: DiscoveryMethod): MethodGroup {
  return m === 'transit' || m === 'rv' || m === 'microlensing' ? m : 'others';
}

export interface YearBin {
  year: number;
  total: number;
  groups: Record<MethodGroup, number>;
}

export function discoveriesByYear(planets: readonly Exoplanet[]): YearBin[] {
  const years = planets.map((p) => p.year).filter((y): y is number => y !== undefined);
  if (years.length === 0) return [];
  const min = Math.min(...years);
  const max = Math.max(...years);
  const bins: YearBin[] = [];
  for (let y = min; y <= max; y += 1) bins.push({ year: y, total: 0, groups: { transit: 0, rv: 0, microlensing: 0, others: 0 } });
  for (const p of planets) {
    if (p.year === undefined) continue;
    const bin = bins[p.year - min]!;
    bin.total += 1;
    bin.groups[methodGroup(p.method)] += 1;
  }
  return bins;
}

export function countSystems(planets: readonly Exoplanet[]): number {
  return new Set(planets.map((p) => p.host)).size;
}

// ------------------------------------------------------------------ pesquisa e ordenação da tabela

export type SortKey = 'name' | 'year' | 'distance' | 'period' | 'radius' | 'mass';

export interface CatalogQuery {
  text: string;
  method: DiscoveryMethod | 'all';
  sort: SortKey;
  descending: boolean;
}

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const SORT_VALUE: Record<Exclude<SortKey, 'name'>, (p: Exoplanet) => number | undefined> = {
  year: (p) => p.year,
  distance: (p) => p.distPc,
  period: (p) => p.period,
  radius: (p) => p.radiusJ,
  mass: (p) => p.massJ,
};

export function queryCatalog(planets: readonly Exoplanet[], q: CatalogQuery): Exoplanet[] {
  const text = normalizeText(q.text);
  let list = planets.filter((p) => q.method === 'all' || p.method === q.method);
  if (text) {
    list = list.filter(
      (p) => normalizeText(p.name).includes(text) || normalizeText(p.host).includes(text) || p.altNames.some((n) => normalizeText(n).includes(text)),
    );
  }
  const dir = q.descending ? -1 : 1;
  if (q.sort === 'name') {
    return [...list].sort((x, y) => dir * x.name.localeCompare(y.name, 'pt-PT', { numeric: true }));
  }
  const get = SORT_VALUE[q.sort];
  // Valores em falta ficam sempre no fim, qualquer que seja o sentido
  return [...list].sort((x, y) => {
    const a = get(x);
    const b = get(y);
    if (a === undefined && b === undefined) return x.name.localeCompare(y.name);
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    return dir * (a - b);
  });
}
