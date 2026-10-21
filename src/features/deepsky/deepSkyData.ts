/**
 * Catálogo Messier: posições, tipos, dimensões e magnitudes do OpenNGC (CC BY-SA 4.0) e distâncias do
 * NASA Hubble Messier Catalog (89 objetos) e da Gaia (13 enxames abertos, Cantat-Gaudin et al. 2020).
 * Gerado por scripts/build_deepsky.py.
 */
import { MESSIER_NAMES_PT, MESSIER_NOTES_PT } from './deepSkyText';

export type DeepSkyCategory = 'galaxy' | 'nebula' | 'cluster' | 'other';
export type DeepSkySubtype =
  | 'spiral'
  | 'barred-spiral'
  | 'elliptical'
  | 'lenticular'
  | 'irregular'
  | 'galaxy'
  | 'globular'
  | 'open'
  | 'emission'
  | 'reflection'
  | 'planetary'
  | 'snr'
  | 'star-cloud'
  | 'double-star'
  | 'asterism'
  | 'dark'
  | 'pulsar';

/** Campos comuns a todos os objetos do espaço profundo (Messier e restantes), usados nos mapas e no planetário. */
export interface SkyObject {
  id: string;
  /** Designação curta mostrada nos mapas (M31, NGC 3372, ω Cen…). */
  label: string;
  category: DeepSkyCategory;
  subtype: DeepSkySubtype;
  /** Ascensão reta e declinação (graus, J2000). */
  ra: number;
  dec: number;
  constellation: string;
  /** Eixos maior e menor aparentes (minutos de arco). */
  majorArcmin?: number;
  minorArcmin?: number;
  mag?: number;
  distanceLy?: number;
  namePt?: string;
}

export interface DeepSkyObject extends SkyObject {
  m: number;
  /** Designação NGC/IC formatada (NGC 224) ou outra designação (Melotte 22). */
  catalogId?: string;
  /** Magnitude visual: OpenNGC (V) ou, na falta, a indicada pela NASA. */
  mag?: number;
  magSource?: 'openngc' | 'nasa';
  hubbleType?: string;
  /** Distância (anos-luz): a indicada pela NASA ou, para 13 enxames abertos, a da Gaia (Cantat-Gaudin et al. 2020). */
  distanceSource?: 'nasa' | 'gaia-cg2020';
  distanceApprox: boolean;
  nameEn?: string;
  notePt?: string;
  season?: string;
  hasNasaPage: boolean;
}

interface RawObject {
  m: number;
  ngc: string | null;
  other: string | null;
  cat: DeepSkyCategory;
  sub: DeepSkySubtype;
  ra: number;
  dec: number;
  con: string;
  maj: number | null;
  min: number | null;
  vmag: number | null;
  nasaMag: number | null;
  hubble: string | null;
  commonEn: string | null;
  distLy: number | null;
  distSrc?: 'nasa' | 'gaia-cg2020' | null;
  distText: string | null;
  nasaName: string | null;
  season: string | null;
  nasaPage: boolean;
}

function formatCatalogId(ngc: string | null, other: string | null): string | undefined {
  if (ngc) {
    const m = /^(NGC|IC)0*(\d+)(.*)$/.exec(ngc);
    return m ? `${m[1]} ${m[2]}${m[3]}` : ngc;
  }
  return other ?? undefined;
}

const SEASONS: Record<string, string> = {
  January: 'janeiro',
  February: 'fevereiro',
  March: 'março',
  April: 'abril',
  May: 'maio',
  June: 'junho',
  July: 'julho',
  August: 'agosto',
  September: 'setembro',
  October: 'outubro',
  November: 'novembro',
  December: 'dezembro',
  Spring: 'primavera (hemisfério norte)',
  'winter months': 'inverno (hemisfério norte)',
  'summer months in the Northern Hemisphere': 'verão (hemisfério norte)',
  'spring, particularly March': 'primavera, sobretudo março (hemisfério norte)',
};

export function parseDeepSky(raw: unknown): DeepSkyObject[] {
  const r = raw as { objects?: RawObject[] };
  if (!r || !Array.isArray(r.objects)) throw new Error('Formato do catálogo Messier inválido');
  return r.objects.map((o) => ({
    m: o.m,
    id: `m${o.m}`,
    label: `M${o.m}`,
    catalogId: formatCatalogId(o.ngc, o.other),
    category: o.cat,
    subtype: o.sub,
    ra: o.ra,
    dec: o.dec,
    constellation: o.con,
    majorArcmin: o.maj ?? undefined,
    minorArcmin: o.min ?? undefined,
    mag: o.vmag ?? o.nasaMag ?? undefined,
    magSource: o.vmag !== null ? 'openngc' : o.nasaMag !== null ? 'nasa' : undefined,
    hubbleType: o.hubble ?? undefined,
    distanceLy: o.distLy ?? undefined,
    distanceSource: o.distLy === null ? undefined : (o.distSrc ?? 'nasa'),
    distanceApprox: /about|~/i.test(o.distText ?? ''),
    namePt: MESSIER_NAMES_PT[o.m],
    nameEn: o.nasaName ?? o.commonEn ?? undefined,
    notePt: MESSIER_NOTES_PT[o.m],
    season: o.season ? (SEASONS[o.season] ?? o.season) : undefined,
    hasNasaPage: o.nasaPage,
  }));
}

let promise: Promise<DeepSkyObject[]> | null = null;

export function loadDeepSky(fetchImpl: typeof fetch = fetch): Promise<DeepSkyObject[]> {
  if (!promise) {
    promise = fetchImpl('data/deepsky.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(parseDeepSky)
      .catch((err: unknown) => {
        promise = null;
        throw err;
      });
  }
  return promise;
}

export function isMessier(o: SkyObject): o is DeepSkyObject {
  return 'm' in o;
}

export function displayName(o: SkyObject): string {
  return o.namePt ?? (isMessier(o) ? `Messier ${o.m}` : o.label);
}

export function nasaHubblePage(m: number): string {
  return `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-${m}/`;
}

/** Tamanho real aproximado (anos-luz) a partir do tamanho aparente e da distância: D ≈ d × θ. */
export function physicalSizeLy(o: SkyObject): number | undefined {
  if (!o.majorArcmin || !o.distanceLy) return undefined;
  const theta = (o.majorArcmin / 60) * (Math.PI / 180);
  return o.distanceLy * theta;
}

/** Diâmetro aparente médio da Lua cheia (minutos de arco). */
export const FULL_MOON_ARCMIN = 31;

/** Ascensão reta em horas, minutos e segundos. */
export function formatRa(deg: number): string {
  const h = (((deg / 15) % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = Math.round(((h - hh) * 60 - mm) * 60);
  const [m2, s2] = ss === 60 ? [mm + 1, 0] : [mm, ss];
  return `${hh} h ${String(m2).padStart(2, '0')} min ${String(s2).padStart(2, '0')} s`;
}

/** Declinação em graus, minutos e segundos de arco. */
export function formatDec(deg: number): string {
  const sign = deg < 0 ? '−' : '+';
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60);
  const [m2, s2] = s === 60 ? [m + 1, 0] : [m, s];
  return `${sign}${d}° ${String(m2).padStart(2, '0')}′ ${String(s2).padStart(2, '0')}″`;
}

/** Distância em anos-luz, por extenso em pt-PT (milhares, milhões). */
export function formatLightYears(ly: number): string {
  const fmt = (v: number, d: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: d }).format(v);
  if (ly >= 1e9) return `${fmt(ly / 1e9, 1)} mil milhões de anos-luz`;
  if (ly >= 1e6) return `${fmt(ly / 1e6, ly < 1e7 ? 1 : 0)} milhões de anos-luz`;
  return `${fmt(ly, 0)} anos-luz`;
}
