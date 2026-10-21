/**
 * Dados do planetário, carregados uma vez e convertidos em vetores unitários (equador J2000):
 * estrelas do Yale Bright Star Catalogue (até à magnitude 6), linhas, nomes e limites das constelações,
 * objetos Messier e a grelha da Via Láctea.
 */
import { type ConstellationBounds, ConstellationLocator, parseConstellationBounds } from '../../core/astro/constellationLocator';
import { radecToUnit } from '../../core/astro/orientation';
import { B1875_JD, mulMat3Vec, precessionMatrix } from '../../core/astro/precession';
import { J2000_JD } from '../../core/astro/time';
import { DEG, type Vec3 } from '../../core/astro/vector';
import { CONSTELLATIONS } from '../../data/constellations';
import { findBodyBySlug } from '../../data/catalog';
import type { SkyBodyId } from '../../core/astro/sky';
import type { SelectionKey } from './skyRenderer';
import { BEYOND } from '../deepsky/beyondMessier';
import { type SkyObject, loadDeepSky } from '../deepsky/deepSkyData';
import { type MilkyWayGrid, loadMilkyWay, loadSkyMap } from '../deepsky/skyMapData';
import { colorFromBv, loadStars } from '../stars/starData';

export interface SceneStars {
  count: number;
  /** Componentes dos vetores unitários J2000. */
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  ra: Float32Array;
  dec: Float32Array;
  mag: Float32Array;
  bv: Float32Array;
  hip: Int32Array;
  color: string[];
  name: Array<string | undefined>;
  /** Letra de Bayer ou número de Flamsteed (α, 58…). */
  letter: Array<string | undefined>;
  con: Array<string | undefined>;
}

export interface ScenePolyline {
  abbr: string;
  /** Vértices x, y, z consecutivos (J2000). */
  pts: Float64Array;
}

export interface SkyScene {
  stars: SceneStars;
  lines: ScenePolyline[];
  bounds: ScenePolyline[];
  labels: Array<{ abbr: string; v: Vec3; rank: number }>;
  dsos: Array<{ obj: SkyObject; v: Vec3 }>;
  locator: ConstellationLocator;
  /** HIP → identificador da ficha da estrela (para as estrelas com ficha). */
  starPages: Map<number, string>;
  milkyWay: MilkyWayGrid | null;
}

function fetchJson(url: string): Promise<unknown> {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

export function parseSceneStars(raw: unknown): SceneStars {
  const r = raw as { columns?: string[]; stars?: unknown[][] };
  if (!r || !Array.isArray(r.columns) || !Array.isArray(r.stars)) throw new Error('Formato do catálogo de estrelas inválido');
  const col = (name: string) => r.columns!.indexOf(name);
  const [iRa, iDec, iMag, iBv, iHip, iName, iDes, iCon] = ['raDeg', 'decDeg', 'vmag', 'bv', 'hip', 'name', 'desig', 'constellation'].map(col) as number[];
  const list = r.stars.filter((s) => typeof s[iRa!] === 'number' && typeof s[iDec!] === 'number' && typeof s[iMag!] === 'number');
  // Mais brilhantes primeiro: o desenho e a escolha de etiquetas dependem desta ordem
  list.sort((a, b) => (a[iMag!] as number) - (b[iMag!] as number));
  const n = list.length;
  const out: SceneStars = {
    count: n,
    x: new Float64Array(n),
    y: new Float64Array(n),
    z: new Float64Array(n),
    ra: new Float32Array(n),
    dec: new Float32Array(n),
    mag: new Float32Array(n),
    bv: new Float32Array(n),
    hip: new Int32Array(n),
    color: [],
    name: [],
    letter: [],
    con: [],
  };
  list.forEach((s, i) => {
    const ra = s[iRa!] as number;
    const dec = s[iDec!] as number;
    const v = radecToUnit(ra, dec);
    out.x[i] = v.x;
    out.y[i] = v.y;
    out.z[i] = v.z;
    out.ra[i] = ra;
    out.dec[i] = dec;
    out.mag[i] = s[iMag!] as number;
    const bv = typeof s[iBv!] === 'number' ? (s[iBv!] as number) : NaN;
    out.bv[i] = bv;
    out.hip[i] = typeof s[iHip!] === 'number' ? (s[iHip!] as number) : 0;
    out.color.push(colorFromBv(Number.isNaN(bv) ? undefined : bv));
    out.name.push(typeof s[iName!] === 'string' && s[iName!] ? (s[iName!] as string) : undefined);
    out.letter.push(typeof s[iDes!] === 'string' && s[iDes!] ? (s[iDes!] as string) : undefined);
    out.con.push(typeof s[iCon!] === 'string' && s[iCon!] ? (s[iCon!] as string) : undefined);
  });
  return out;
}

/** Designação de Bayer/Flamsteed completa: "α Orionis". */
export function starDesignation(letter?: string, con?: string): string | undefined {
  if (!letter || !con) return undefined;
  const gen = CONSTELLATIONS[con]?.genitive;
  return gen ? `${letter} ${gen}` : `${letter} ${con}`;
}

function polylineFromRaDec(points: Array<[number, number]>): Float64Array {
  const pts = new Float64Array(points.length * 3);
  points.forEach(([ra, dec], i) => {
    const v = radecToUnit(ra, dec);
    pts[i * 3] = v.x;
    pts[i * 3 + 1] = v.y;
    pts[i * 3 + 2] = v.z;
  });
  return pts;
}

const P_TO_B1875 = precessionMatrix(J2000_JD, B1875_JD);
const P_FROM_B1875 = precessionMatrix(B1875_JD, J2000_JD);
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * Os limites são arcos de ascensão reta ou declinação constantes em B1875: cada lado é subdividido
 * nesse referencial (passos de 1° no máximo) e convertido para J2000, para ficar curvo onde deve.
 */
export function densifyBoundaryRing(ring: Array<[number, number]>): Float64Array {
  const b = ring.map(([ra, dec]) => {
    const v = mulMat3Vec(P_TO_B1875, radecToUnit(ra, dec));
    return [Math.atan2(v.y, v.x) / DEG, Math.asin(Math.max(-1, Math.min(1, v.z))) / DEG] as [number, number];
  });
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) {
    const [a1, d1] = b[i]!;
    const [a2, d2] = b[(i + 1) % b.length]!;
    const da = wrap180(a2 - a1);
    const dd = d2 - d1;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(da) * Math.cos(((d1 + d2) / 2) * DEG), Math.abs(dd))));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const v = mulMat3Vec(P_FROM_B1875, radecToUnit(a1 + da * t, d1 + dd * t));
      out.push(v.x, v.y, v.z);
    }
  }
  if (out.length >= 3) out.push(out[0]!, out[1]!, out[2]!);
  return Float64Array.from(out);
}

let scenePromise: Promise<SkyScene> | null = null;

export function loadSkyScene(): Promise<SkyScene> {
  if (!scenePromise) {
    scenePromise = Promise.all([
      fetchJson('data/stars.json'),
      loadSkyMap(),
      fetchJson('data/constellation-bounds.json'),
      loadDeepSky(),
      loadStars().catch(() => []),
      loadMilkyWay().catch(() => null),
    ])
      .then(([starsRaw, sky, boundsRaw, dsos, catalog, milkyWay]) => {
        const bounds: ConstellationBounds = parseConstellationBounds(boundsRaw);
        const starPages = new Map<number, string>();
        for (const s of catalog) if (s.hip) starPages.set(s.hip, s.slug);
        return {
          stars: parseSceneStars(starsRaw),
          lines: Object.entries(sky.map.lines).flatMap(([abbr, segs]) => segs.map((seg) => ({ abbr, pts: polylineFromRaDec(seg) }))),
          bounds: Object.entries(bounds).flatMap(([abbr, rings]) => rings.map((ring) => ({ abbr, pts: densifyBoundaryRing(ring) }))),
          labels: sky.map.labels.map(([abbr, ra, dec, rank]) => ({ abbr, v: radecToUnit(ra, dec), rank })),
          dsos: [...dsos, ...BEYOND].map((obj) => ({ obj, v: radecToUnit(obj.ra, obj.dec) })),
          locator: new ConstellationLocator(bounds),
          starPages,
          milkyWay,
        };
      })
      .catch((err: unknown) => {
        scenePromise = null;
        throw err;
      });
  }
  return scenePromise;
}

/** Resolve o alvo do endereço (#/planetario/<alvo>): corpo do Sistema Solar, objeto do espaço profundo ou estrela com ficha. */
export function resolveTarget(target: string, scene: SkyScene): SelectionKey | null {
  const body = findBodyBySlug(target);
  const SKY_IDS: string[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  if (body && SKY_IDS.includes(body.id)) return { kind: 'body', id: body.id as SkyBodyId };
  const dso = scene.dsos.find((d) => d.obj.id === target.toLowerCase());
  if (dso) return { kind: 'dso', id: dso.obj.id };
  for (const [hip, slug] of scene.starPages) {
    if (slug !== target) continue;
    const s = scene.stars;
    for (let i = 0; i < s.count; i++) if (s.hip[i] === hip) return { kind: 'star', index: i };
  }
  return null;
}
