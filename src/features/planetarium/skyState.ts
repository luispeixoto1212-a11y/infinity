/**
 * Estado do céu num instante e num lugar: matriz de rotação, posições topocêntricas do Sol, da Lua e dos
 * planetas, crepúsculo, fase da Lua, horas de nascer e pôr e janelas de visibilidade da noite.
 */
import { type Mat3, mulMat3Vec } from '../../core/astro/precession';
import {
  type GeocentricBody,
  type MoonPhaseName,
  type Observer,
  type RiseSet,
  type SkyBodyId,
  type SkyPlanetKey,
  type TwilightPhase,
  SKY_PLANETS,
  enuToHorizontal,
  enuToJ2000,
  findRiseSet,
  geocentricBodies,
  horizonMatrix,
  jdTtFromUt,
  localSiderealDeg,
  moonPhaseName,
  moonSunLongitudeDiffDeg,
  nextMoonPhaseJd,
  observerOffsetEnuKm,
  refractionDeg,
  saturnRingTiltDeg,
  skyMatrix,
  topocentricEnuKm,
  twilightPhase,
  unitToRaDec,
} from '../../core/astro/sky';
import { dateToJulianDayUtc, MS_PER_DAY, UNIX_EPOCH_JD } from '../../core/astro/time';
import { type Vec3, length, wrapDeg360 } from '../../core/astro/vector';

export interface SkyBodyState extends GeocentricBody {
  /** Direção topocêntrica (vetor unitário este–norte–zénite), sem refração. */
  enu: Vec3;
  azDeg: number;
  /** Altura geométrica e altura aparente (com refração). */
  altDeg: number;
  apparentAltDeg: number;
  /** Ascensão reta e declinação topocêntricas (J2000). */
  raDeg: number;
  decDeg: number;
  topoDistanceKm: number;
}

export interface SkyInstant {
  date: Date;
  jdUt: number;
  jdTt: number;
  observer: Observer;
  /** Equador J2000 → este–norte–zénite. */
  matrix: Mat3;
  /** Equador médio da data → este–norte–zénite (grelha equatorial). */
  dateMatrix: Mat3;
  lstDeg: number;
  sunAltDeg: number;
  twilight: TwilightPhase;
  bodies: SkyBodyState[];
  moonDiffDeg: number;
  moonPhase: MoonPhaseName;
  saturnRingTiltDeg: number;
}

export function computeSkyInstant(date: Date, observer: Observer): SkyInstant {
  const jdUt = dateToJulianDayUtc(date);
  const jdTt = jdTtFromUt(jdUt);
  const matrix = skyMatrix(jdUt, observer);
  const lstDeg = localSiderealDeg(jdUt, observer.lonDeg);
  const obsEnu = observerOffsetEnuKm(observer);
  const bodies = geocentricBodies(jdTt).map((b): SkyBodyState => {
    const topo = topocentricEnuKm(b.geoJ2000Km, matrix, obsEnu);
    const d = length(topo);
    const enu = { x: topo.x / d, y: topo.y / d, z: topo.z / d };
    const h = enuToHorizontal(enu);
    const { raDeg, decDeg } = unitToRaDec(enuToJ2000(enu, matrix));
    return { ...b, enu, azDeg: h.azDeg, altDeg: h.altDeg, apparentAltDeg: h.altDeg + refractionDeg(h.altDeg), raDeg, decDeg, topoDistanceKm: d };
  });
  const sunAlt = bodies.find((b) => b.id === 'sun')!.altDeg;
  const moonDiffDeg = moonSunLongitudeDiffDeg(jdTt);
  return {
    date,
    jdUt,
    jdTt,
    observer,
    matrix,
    dateMatrix: horizonMatrix(observer.latDeg, lstDeg),
    lstDeg,
    sunAltDeg: sunAlt,
    twilight: twilightPhase(sunAlt),
    bodies,
    moonDiffDeg,
    moonPhase: moonPhaseName(moonDiffDeg),
    saturnRingTiltDeg: saturnRingTiltDeg(jdTt),
  };
}

/** Transforma uma direção J2000 em vetor este–norte–zénite. */
export function toEnu(inst: SkyInstant, v: Vec3): Vec3 {
  return mulMat3Vec(inst.matrix, v);
}

export const jdToDate = (jdUt: number) => new Date((jdUt - UNIX_EPOCH_JD) * MS_PER_DAY);

// ——— Acontecimentos do dia e da noite ———

export interface VisibilityWindow {
  /** Primeiro e último instante (JD UT) em que está acima de 10° com o céu escuro (Sol abaixo de −6°). */
  from: number;
  to: number;
  /** Altura máxima durante a escuridão e instante em que ocorre. */
  bestAltDeg: number;
  bestJd: number;
}

export interface NightReport {
  /** Início (meio-dia local) e fim (meio-dia seguinte) do período analisado (JD UT). */
  startJd: number;
  endJd: number;
  sunset: number | null;
  sunrise: number | null;
  /** Fim do crepúsculo astronómico (noite completa) e início do seguinte. */
  darkFrom: number | null;
  darkTo: number | null;
  /** O Sol nunca desce abaixo de −6° (noites brancas) ou nunca sobe acima do horizonte. */
  noDarkness: boolean;
  polarNight: boolean;
  windows: Partial<Record<SkyBodyId, VisibilityWindow>>;
  moonIllumination: number;
}

/** Limite de altura para considerar um astro bem visível (acima de casas e árvores). */
export const VISIBLE_ALT_DEG = 10;
/** Altura do Sol a partir da qual o céu está suficientemente escuro para ver planetas e estrelas brilhantes. */
export const DARK_SUN_ALT_DEG = -6;

/**
 * Analisa a noite que começa no meio-dia local (noonJdUt) e termina 24 h depois, por amostragem a cada
 * 10 minutos: pôr e nascer do Sol, escuridão astronómica e, para a Lua e cada planeta, a janela em que
 * está acima de 10° com o Sol abaixo de −6°.
 */
export function analyzeNight(noonJdUt: number, observer: Observer): NightReport {
  const step = 10 / 1440;
  const n = 144;
  const obsEnu = observerOffsetEnuKm(observer);
  const ids: SkyBodyId[] = ['moon', ...SKY_PLANETS];
  const sunAlts: number[] = [];
  const alts: Record<string, number[]> = {};
  for (const id of ids) alts[id] = [];
  let moonIllum = 0;
  for (let i = 0; i <= n; i++) {
    const jd = noonJdUt + i * step;
    const m = skyMatrix(jd, observer);
    for (const b of geocentricBodies(jdTtFromUt(jd))) {
      const alt = enuToHorizontal(topocentricEnuKm(b.geoJ2000Km, m, obsEnu)).altDeg;
      if (b.id === 'sun') sunAlts.push(alt);
      else alts[b.id]?.push(alt);
      if (b.id === 'moon' && i === n / 2) moonIllum = b.illuminatedFraction;
    }
  }
  const sunCross = (h0: number, dir: 'down' | 'up'): number | null => {
    for (let i = 0; i < n; i++) {
      const a = sunAlts[i]! - h0;
      const b = sunAlts[i + 1]! - h0;
      if (dir === 'down' ? a > 0 && b <= 0 : a <= 0 && b > 0) return noonJdUt + (i + a / (a - b)) * step;
    }
    return null;
  };
  const windows: NightReport['windows'] = {};
  for (const id of ids) {
    let from: number | null = null;
    let to: number | null = null;
    let best = -90;
    let bestJd = 0;
    for (let i = 0; i <= n; i++) {
      const alt = alts[id]![i]!;
      if (sunAlts[i]! < DARK_SUN_ALT_DEG && alt > VISIBLE_ALT_DEG) {
        const jd = noonJdUt + i * step;
        if (from === null) from = jd;
        to = jd;
        if (alt > best) {
          best = alt;
          bestJd = jd;
        }
      }
    }
    if (from !== null && to !== null) windows[id] = { from, to, bestAltDeg: best, bestJd };
  }
  return {
    startJd: noonJdUt,
    endJd: noonJdUt + 1,
    sunset: sunCross(-0.8333, 'down'),
    sunrise: sunCross(-0.8333, 'up'),
    darkFrom: sunCross(-18, 'down'),
    darkTo: sunCross(-18, 'up'),
    noDarkness: sunAlts.every((a) => a >= DARK_SUN_ALT_DEG),
    polarNight: sunAlts.every((a) => a < -0.8333),
    windows,
    moonIllumination: moonIllum,
  };
}

/** Nascer, passagem e ocaso de um corpo no dia civil local que começa em dayStartJdUt. */
export function bodyRiseSet(id: SkyBodyId, dayStartJdUt: number, observer: Observer): RiseSet {
  const obsEnu = observerOffsetEnuKm(observer);
  const alt = (jd: number) => {
    const b = geocentricBodies(jdTtFromUt(jd)).find((x) => x.id === id)!;
    return enuToHorizontal(topocentricEnuKm(b.geoJ2000Km, skyMatrix(jd, observer), obsEnu)).altDeg;
  };
  return findRiseSet(alt, dayStartJdUt, id === 'sun' || id === 'moon' ? -0.8333 : -0.5667, 1, 15);
}

/** Nascer, passagem e ocaso de uma direção fixa (estrela ou objeto do espaço profundo). */
export function fixedRiseSet(dirJ2000: Vec3, dayStartJdUt: number, observer: Observer): RiseSet {
  const alt = (jd: number) => enuToHorizontal(mulMat3Vec(skyMatrix(jd, observer), dirJ2000)).altDeg;
  return findRiseSet(alt, dayStartJdUt, -0.5667, 1, 15);
}

/** Próximas fases principais da Lua a partir do instante (datas UT). */
export function upcomingMoonPhases(jdUt: number): Array<{ phase: 'new' | 'first-quarter' | 'full' | 'last-quarter'; date: Date }> {
  const jdTt = jdTtFromUt(jdUt);
  const list = (
    [
      ['new', 0],
      ['first-quarter', 90],
      ['full', 180],
      ['last-quarter', 270],
    ] as const
  ).map(([phase, deg]) => ({ phase, jd: nextMoonPhaseJd(jdTt, deg) }));
  return list
    .filter((p) => Number.isFinite(p.jd))
    .sort((a, b) => a.jd - b.jd)
    .map((p) => ({ phase: p.phase, date: jdToDate(p.jd - 69.184 / 86400) }));
}

/** Rumo da bússola (8 pontos) para um azimute. */
export const COMPASS_8 = ['norte', 'nordeste', 'este', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'] as const;
export const COMPASS_8_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

export function compassPoint(azDeg: number): { long: (typeof COMPASS_8)[number]; short: (typeof COMPASS_8_SHORT)[number] } {
  const i = Math.round(wrapDeg360(azDeg) / 45) % 8;
  return { long: COMPASS_8[i]!, short: COMPASS_8_SHORT[i]! };
}

/** Limite de magnitude do céu em função da altura do Sol (estimativa ilustrativa do brilho do céu). */
export function twilightMagnitudeLimit(sunAltDeg: number): number {
  const table: Array<[number, number]> = [
    [10, -5],
    [0, -4],
    [-3, -1],
    [-6, 1.5],
    [-9, 3],
    [-12, 4.5],
    [-15, 5.6],
    [-18, 6.5],
  ];
  if (sunAltDeg >= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [a1, m1] = table[i]!;
    const [a0, m0] = table[i - 1]!;
    if (sunAltDeg >= a1) return m0 + ((m1 - m0) * (a0 - sunAltDeg)) / (a0 - a1);
  }
  return 6.5;
}

export const isPlanet = (id: SkyBodyId): id is SkyPlanetKey => (SKY_PLANETS as string[]).includes(id);
