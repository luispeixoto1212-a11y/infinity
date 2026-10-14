/**
 * Céu visto de um lugar da Terra: tempo sideral, coordenadas horizontais, refração,
 * posições aparentes do Sol, da Lua e dos planetas, magnitudes, fases e horas de nascer e pôr.
 *
 * Referências: J. Meeus, "Astronomical Algorithms", 2.ª ed. (1998), caps. 11, 12, 13, 15, 16, 21, 41, 47 e 48.
 * Simplificações (todas abaixo de 1′): não se aplica a nutação (≤ 17″) nem a aberração anual (≤ 20,5″);
 * UT1 ≈ UTC (diferença < 0,9 s, ou seja < 14″ no tempo sideral).
 */
import type { MajorPlanetKey } from './elements';
import { planetPositionAu } from './kepler';
import { moonEquatorialJ2000Km } from './moon';
import { equatorialToEcliptic, OBLIQUITY_J2000_DEG } from './orientation';
import { type Mat3, mulMat3, mulMat3Vec, precessionMatrix, transposeMat3 } from './precession';
import { J2000_JD, TT_MINUS_UTC_SECONDS } from './time';
import { DEG, type Vec3, angleBetweenDeg, dot, length, normalize, wrapDeg360 } from './vector';

export const AU_KM = 149_597_870.7;
/** Tempo de luz por unidade astronómica (dias). */
const LIGHT_DAYS_PER_AU = 0.0057755183;
/** Razão de massas Terra/Lua (JPL DE440). */
export const EARTH_MOON_MASS_RATIO = 81.3005682;
/** Raio equatorial e achatamento do elipsoide WGS84. */
const EARTH_EQUATORIAL_RADIUS_KM = 6378.137;
const EARTH_AXIS_RATIO = 1 - 1 / 298.257223563;

export interface Observer {
  /** Latitude geodésica (graus, norte positivo). */
  latDeg: number;
  /** Longitude (graus, este positivo). */
  lonDeg: number;
  /** Altitude acima do nível do mar (m). */
  heightM?: number;
}

export interface Horizontal {
  /** Azimute medido a partir do norte, no sentido do este (graus). */
  azDeg: number;
  /** Altura acima do horizonte (graus). */
  altDeg: number;
}

export const jdTtFromUt = (jdUt: number) => jdUt + TT_MINUS_UTC_SECONDS / 86400;

/** Tempo sideral médio de Greenwich (graus), Meeus eq. 12.4. */
export function gmstDeg(jdUt: number): number {
  const d = jdUt - J2000_JD;
  const T = d / 36525;
  return wrapDeg360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Tempo sideral local (graus). */
export function localSiderealDeg(jdUt: number, lonDeg: number): number {
  return wrapDeg360(gmstDeg(jdUt) + lonDeg);
}

/**
 * Matriz do equador médio da data para o referencial local este–norte–zénite,
 * para a latitude geodésica e o tempo sideral local indicados.
 */
export function horizonMatrix(latDeg: number, lstDeg: number): Mat3 {
  const sf = Math.sin(latDeg * DEG);
  const cf = Math.cos(latDeg * DEG);
  const st = Math.sin(lstDeg * DEG);
  const ct = Math.cos(lstDeg * DEG);
  return [-st, ct, 0, -sf * ct, -sf * st, cf, cf * ct, cf * st, sf];
}

/** Matriz completa: equador J2000 (ICRF) → este–norte–zénite do observador no instante jdUt. */
export function skyMatrix(jdUt: number, obs: Observer): Mat3 {
  const P = precessionMatrix(J2000_JD, jdTtFromUt(jdUt));
  return mulMat3(horizonMatrix(obs.latDeg, localSiderealDeg(jdUt, obs.lonDeg)), P);
}

export function enuToHorizontal(v: Vec3): Horizontal {
  const r = length(v);
  return { azDeg: wrapDeg360(Math.atan2(v.x, v.y) / DEG), altDeg: Math.asin(Math.max(-1, Math.min(1, v.z / r))) / DEG };
}

export function horizontalToEnu(h: Horizontal): Vec3 {
  const ca = Math.cos(h.altDeg * DEG);
  return { x: ca * Math.sin(h.azDeg * DEG), y: ca * Math.cos(h.azDeg * DEG), z: Math.sin(h.altDeg * DEG) };
}

/** Posição do observador em relação ao centro da Terra, no referencial este–norte–zénite (km). */
export function observerOffsetEnuKm(obs: Observer): Vec3 {
  const phi = obs.latDeg * DEG;
  const u = Math.atan(EARTH_AXIS_RATIO * Math.tan(phi));
  const h = (obs.heightM ?? 0) / 1000 / EARTH_EQUATORIAL_RADIUS_KM;
  const rhoSin = EARTH_AXIS_RATIO * Math.sin(u) + h * Math.sin(phi);
  const rhoCos = Math.cos(u) + h * Math.cos(phi);
  // Latitude geocêntrica φ′ e raio ρ (em raios equatoriais)
  const phiGeo = Math.atan2(rhoSin, rhoCos);
  const rho = Math.hypot(rhoSin, rhoCos) * EARTH_EQUATORIAL_RADIUS_KM;
  return { x: 0, y: rho * Math.sin(phiGeo - phi), z: rho * Math.cos(phi - phiGeo) };
}

/**
 * Refração atmosférica (graus) para uma altura verdadeira, em condições normais (1010 hPa, 10 °C):
 * fórmula de Sæmundsson (Meeus eq. 16.4). Abaixo de −1,5° atenua-se até zero em −4°.
 */
export function refractionDeg(altTrueDeg: number): number {
  const h = Math.max(altTrueDeg, -1.5);
  const r = (1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG) + 0.0019279) / 60;
  if (altTrueDeg >= -1.5) return Math.max(0, r);
  return r * Math.max(0, (altTrueDeg + 4) / 2.5);
}

/** Converte um vetor do equador J2000 para ascensão reta e declinação (graus). */
export function unitToRaDec(v: Vec3): { raDeg: number; decDeg: number } {
  const r = length(v);
  return { raDeg: wrapDeg360(Math.atan2(v.y, v.x) / DEG), decDeg: Math.asin(v.z / r) / DEG };
}

/** Eclíptica J2000 → equador J2000. */
export function eclipticToEquatorial(v: Vec3): Vec3 {
  const e = OBLIQUITY_J2000_DEG * DEG;
  const c = Math.cos(e);
  const s = Math.sin(e);
  return { x: v.x, y: c * v.y - s * v.z, z: s * v.y + c * v.z };
}

// ——— Corpos do Sistema Solar ———

export type SkyPlanetKey = Exclude<MajorPlanetKey, 'emb'>;
export type SkyBodyId = 'sun' | 'moon' | SkyPlanetKey;
export const SKY_PLANETS: SkyPlanetKey[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
export const SKY_BODY_IDS: SkyBodyId[] = ['sun', 'moon', ...SKY_PLANETS];

/** Raios equatoriais (km), IAU WGCCRE 2015 / NASA, para o diâmetro aparente. */
const RADIUS_KM: Record<SkyBodyId, number> = {
  sun: 695700,
  moon: 1737.4,
  mercury: 2440.53,
  venus: 6051.8,
  mars: 3396.19,
  jupiter: 71492,
  saturn: 60268,
  uranus: 25559,
  neptune: 24764,
};

/** Polo norte de Saturno (IAU 2015), para a inclinação dos anéis. */
const SATURN_POLE = { ra: 40.589, raRate: -0.036, dec: 83.537, decRate: -0.004 };

/** Posição heliocêntrica da Terra (UA, eclíptica J2000): baricentro Terra–Lua menos a parte da Lua. */
export function earthHeliocentricAu(jdTt: number): Vec3 {
  const emb = planetPositionAu('emb', jdTt);
  const moon = equatorialToEcliptic(moonEquatorialJ2000Km(jdTt));
  const f = 1 / (1 + EARTH_MOON_MASS_RATIO) / AU_KM;
  return { x: emb.x - moon.x * f, y: emb.y - moon.y * f, z: emb.z - moon.z * f };
}

export interface GeocentricBody {
  id: SkyBodyId;
  /** Vetor geocêntrico astrométrico (km), equador J2000, corrigido do tempo de luz. */
  geoJ2000Km: Vec3;
  distanceAu: number;
  /** Distância ao Sol (UA); 0 para o Sol. */
  sunDistanceAu: number;
  /** Ângulo de fase Sol–corpo–Terra (graus). */
  phaseAngleDeg: number;
  /** Fração iluminada do disco (0 a 1). */
  illuminatedFraction: number;
  /** Magnitude visual aparente (calculada). */
  magnitude: number;
  /** Diâmetro aparente (segundos de arco). */
  diameterArcsec: number;
  /** Elongação ao Sol (graus). */
  elongationDeg: number;
}

function saturnRingTerms(saturnHelio: Vec3, saturnGeo: Vec3, jdTt: number): { B: number; dU: number } {
  const T = (jdTt - J2000_JD) / 36525;
  const ra = (SATURN_POLE.ra + SATURN_POLE.raRate * T) * DEG;
  const dec = (SATURN_POLE.dec + SATURN_POLE.decRate * T) * DEG;
  const pole = equatorialToEcliptic({ x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) });
  const toEarth = normalize({ x: -saturnGeo.x, y: -saturnGeo.y, z: -saturnGeo.z });
  const toSun = normalize({ x: -saturnHelio.x, y: -saturnHelio.y, z: -saturnHelio.z });
  const B = Math.asin(dot(pole, toEarth)) / DEG;
  const proj = (v: Vec3) => {
    const k = dot(v, pole);
    return { x: v.x - k * pole.x, y: v.y - k * pole.y, z: v.z - k * pole.z };
  };
  return { B, dU: angleBetweenDeg(proj(toEarth), proj(toSun)) };
}

/**
 * Magnitude visual pelas fórmulas do Astronomical Almanac de 1984 (Meeus, cap. 41, eq. 41.x),
 * com i = ângulo de fase em graus. Exatidão típica de 0,1 a 0,2 magnitudes face ao JPL Horizons.
 */
export function planetMagnitude(key: SkyPlanetKey, r: number, delta: number, i: number, ring?: { B: number; dU: number }): number {
  const base = 5 * Math.log10(r * delta);
  switch (key) {
    case 'mercury':
      return -0.42 + base + 0.038 * i - 0.000273 * i * i + 0.000002 * i * i * i;
    case 'venus':
      return -4.4 + base + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
    case 'mars':
      return -1.52 + base + 0.016 * i;
    case 'jupiter':
      return -9.4 + base + 0.005 * i;
    case 'saturn': {
      const B = ring ? Math.abs(ring.B) * DEG : 0;
      return -8.88 + base + 0.044 * (ring?.dU ?? 0) - 2.6 * Math.sin(B) + 1.25 * Math.sin(B) ** 2;
    }
    case 'uranus':
      return -7.19 + base;
    case 'neptune':
      return -6.87 + base;
  }
}

/** Magnitude da Lua em função do ângulo de fase (Allen, "Astrophysical Quantities"). */
export function moonMagnitude(phaseAngleDeg: number, distanceKm: number): number {
  const i = Math.abs(phaseAngleDeg);
  return -12.73 + 0.026 * i + 4e-9 * i ** 4 + 5 * Math.log10(distanceKm / 384400);
}

/** Posições geocêntricas astrométricas (J2000) do Sol, da Lua e dos planetas, com fase e magnitude. */
export function geocentricBodies(jdTt: number): GeocentricBody[] {
  const earth = earthHeliocentricAu(jdTt);
  const sunGeoEcl = { x: -earth.x, y: -earth.y, z: -earth.z };
  const sunDist = length(earth);
  const out: GeocentricBody[] = [];
  const sunDir = normalize(sunGeoEcl);

  out.push({
    id: 'sun',
    geoJ2000Km: eclipticToEquatorial({ x: sunGeoEcl.x * AU_KM, y: sunGeoEcl.y * AU_KM, z: sunGeoEcl.z * AU_KM }),
    distanceAu: sunDist,
    sunDistanceAu: 0,
    phaseAngleDeg: 0,
    illuminatedFraction: 1,
    magnitude: -26.74 + 5 * Math.log10(sunDist),
    diameterArcsec: (2 * Math.atan(RADIUS_KM.sun / (sunDist * AU_KM))) / DEG * 3600,
    elongationDeg: 0,
  });

  const moonEq = moonEquatorialJ2000Km(jdTt);
  const moonEcl = equatorialToEcliptic(moonEq);
  const moonDist = length(moonEq);
  const sunKm = { x: sunGeoEcl.x * AU_KM, y: sunGeoEcl.y * AU_KM, z: sunGeoEcl.z * AU_KM };
  const moonPhase = angleBetweenDeg({ x: sunKm.x - moonEcl.x, y: sunKm.y - moonEcl.y, z: sunKm.z - moonEcl.z }, {
    x: -moonEcl.x,
    y: -moonEcl.y,
    z: -moonEcl.z,
  });
  out.push({
    id: 'moon',
    geoJ2000Km: moonEq,
    distanceAu: moonDist / AU_KM,
    sunDistanceAu: sunDist,
    phaseAngleDeg: moonPhase,
    illuminatedFraction: (1 + Math.cos(moonPhase * DEG)) / 2,
    magnitude: moonMagnitude(moonPhase, moonDist),
    diameterArcsec: (2 * Math.asin(RADIUS_KM.moon / moonDist)) / DEG * 3600,
    elongationDeg: angleBetweenDeg(moonEcl, sunGeoEcl),
  });

  for (const key of SKY_PLANETS) {
    let tau = 0;
    let helio = planetPositionAu(key, jdTt);
    let geo = helio;
    for (let k = 0; k < 3; k++) {
      helio = planetPositionAu(key, jdTt - tau);
      geo = { x: helio.x - earth.x, y: helio.y - earth.y, z: helio.z - earth.z };
      tau = length(geo) * LIGHT_DAYS_PER_AU;
    }
    const delta = length(geo);
    const r = length(helio);
    const phase = angleBetweenDeg({ x: -helio.x, y: -helio.y, z: -helio.z }, { x: -geo.x, y: -geo.y, z: -geo.z });
    const ring = key === 'saturn' ? saturnRingTerms(helio, geo, jdTt) : undefined;
    out.push({
      id: key,
      geoJ2000Km: eclipticToEquatorial({ x: geo.x * AU_KM, y: geo.y * AU_KM, z: geo.z * AU_KM }),
      distanceAu: delta,
      sunDistanceAu: r,
      phaseAngleDeg: phase,
      illuminatedFraction: (1 + Math.cos(phase * DEG)) / 2,
      magnitude: planetMagnitude(key, r, delta, phase, ring),
      diameterArcsec: (2 * Math.atan(RADIUS_KM[key] / (delta * AU_KM))) / DEG * 3600,
      elongationDeg: angleBetweenDeg(geo, sunDir),
    });
  }
  return out;
}

/** Inclinação dos anéis de Saturno vista da Terra (graus; positivo = face norte visível). */
export function saturnRingTiltDeg(jdTt: number): number {
  const earth = earthHeliocentricAu(jdTt);
  const helio = planetPositionAu('saturn', jdTt);
  const geo = { x: helio.x - earth.x, y: helio.y - earth.y, z: helio.z - earth.z };
  return saturnRingTerms(helio, geo, jdTt).B;
}

/** Vetor topocêntrico (km) no referencial este–norte–zénite, a partir do vetor geocêntrico J2000. */
export function topocentricEnuKm(geoJ2000Km: Vec3, matrix: Mat3, observerEnuKm: Vec3): Vec3 {
  const g = mulMat3Vec(matrix, geoJ2000Km);
  return { x: g.x - observerEnuKm.x, y: g.y - observerEnuKm.y, z: g.z - observerEnuKm.z };
}

/** Direção J2000 de um vetor dado no referencial este–norte–zénite. */
export function enuToJ2000(v: Vec3, matrix: Mat3): Vec3 {
  return mulMat3Vec(transposeMat3(matrix), v);
}

// ——— Fases da Lua ———

export type MoonPhaseName =
  | 'new'
  | 'waxing-crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full'
  | 'waning-gibbous'
  | 'last-quarter'
  | 'waning-crescent';

/** Diferença de longitude eclíptica Lua − Sol (0–360°): 0 lua nova, 90 quarto crescente, 180 cheia, 270 quarto minguante. */
export function moonSunLongitudeDiffDeg(jdTt: number): number {
  const earth = earthHeliocentricAu(jdTt);
  const sunLon = Math.atan2(-earth.y, -earth.x) / DEG;
  const m = equatorialToEcliptic(moonEquatorialJ2000Km(jdTt));
  return wrapDeg360(Math.atan2(m.y, m.x) / DEG - sunLon);
}

/** Nome da fase: as fases principais ocupam ±6° (cerca de meio dia) em torno do instante exato. */
export function moonPhaseName(diffDeg: number): MoonPhaseName {
  const d = wrapDeg360(diffDeg);
  const near = (x: number) => Math.abs(((d - x + 540) % 360) - 180) <= 6;
  if (near(0)) return 'new';
  if (near(90)) return 'first-quarter';
  if (near(180)) return 'full';
  if (near(270)) return 'last-quarter';
  if (d < 90) return 'waxing-crescent';
  if (d < 180) return 'waxing-gibbous';
  if (d < 270) return 'waning-gibbous';
  return 'waning-crescent';
}

/** Instante (JD TT) da próxima fase principal a partir de jdTt (0, 90, 180 ou 270 graus). */
export function nextMoonPhaseJd(jdTt: number, targetDeg: number): number {
  const f = (jd: number) => ((moonSunLongitudeDiffDeg(jd) - targetDeg + 540) % 360) - 180;
  let a = jdTt;
  let fa = f(a);
  for (let step = 0; step < 40; step++) {
    const b = a + 1;
    const fb = f(b);
    if (fa < 0 && fb >= 0 && fb - fa < 90) {
      let lo = a;
      let hi = b;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (f(mid) < 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
    a = b;
    fa = fb;
  }
  return NaN;
}

// ——— Nascer, passagem meridiana e ocaso ———

export interface RiseSet {
  rise: number | null;
  transit: number | null;
  set: number | null;
  transitAltDeg: number;
  /** Sempre acima (circumpolar) ou sempre abaixo do horizonte no intervalo. */
  alwaysUp: boolean;
  alwaysDown: boolean;
}

/**
 * Procura o nascer, a passagem meridiana (altura máxima) e o ocaso entre jdStart e jdStart + spanDays (UT),
 * por amostragem a cada stepMinutes e bisseção. h0 é a altura geométrica do centro no instante do nascer:
 * −0,5667° para estrelas e planetas e −0,8333° para o Sol e a Lua (refração e semidiâmetro).
 */
export function findRiseSet(
  altitudeAt: (jdUt: number) => number,
  jdStart: number,
  h0: number,
  spanDays = 1,
  stepMinutes = 10,
): RiseSet {
  const step = stepMinutes / 1440;
  const n = Math.ceil(spanDays / step);
  let rise: number | null = null;
  let set: number | null = null;
  let maxI = 0;
  let maxAlt = -Infinity;
  let anyUp = false;
  let anyDown = false;
  const alts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = altitudeAt(jdStart + i * step) - h0;
    alts.push(a);
    if (a > 0) anyUp = true;
    else anyDown = true;
    if (a + h0 > maxAlt) {
      maxAlt = a + h0;
      maxI = i;
    }
  }
  const refine = (i: number) => {
    let lo = jdStart + i * step;
    let hi = lo + step;
    const sLo = Math.sign(alts[i]!);
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (Math.sign(altitudeAt(mid) - h0) === sLo) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  for (let i = 0; i < n; i++) {
    const a = alts[i]!;
    const b = alts[i + 1]!;
    if (rise === null && a <= 0 && b > 0) rise = refine(i);
    if (set === null && a > 0 && b <= 0) set = refine(i);
  }
  // Máximo por secção dourada no intervalo em torno da melhor amostra
  let lo = jdStart + Math.max(0, maxI - 1) * step;
  let hi = jdStart + Math.min(n, maxI + 1) * step;
  const g = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 40; k++) {
    const m1 = hi - g * (hi - lo);
    const m2 = lo + g * (hi - lo);
    if (altitudeAt(m1) < altitudeAt(m2)) lo = m1;
    else hi = m2;
  }
  const transit = (lo + hi) / 2;
  const transitAlt = altitudeAt(transit);
  const interior = maxI > 0 && maxI < n;
  return {
    rise,
    set,
    transit: interior ? transit : null,
    transitAltDeg: transitAlt,
    alwaysUp: anyUp && !anyDown,
    alwaysDown: anyDown && !anyUp,
  };
}

/** Altura geométrica (sem refração) de um corpo do Sistema Solar visto de um lugar. */
export function bodyAltitudeDeg(id: SkyBodyId, jdUt: number, obs: Observer): number {
  const jdTt = jdTtFromUt(jdUt);
  const body = geocentricBodyById(id, jdTt);
  const m = skyMatrix(jdUt, obs);
  return enuToHorizontal(topocentricEnuKm(body, m, observerOffsetEnuKm(obs))).altDeg;
}

/** Vetor geocêntrico J2000 (km) de um só corpo, sem calcular os restantes. */
export function geocentricBodyById(id: SkyBodyId, jdTt: number): Vec3 {
  if (id === 'moon') return moonEquatorialJ2000Km(jdTt);
  const earth = earthHeliocentricAu(jdTt);
  if (id === 'sun') return eclipticToEquatorial({ x: -earth.x * AU_KM, y: -earth.y * AU_KM, z: -earth.z * AU_KM });
  let tau = 0;
  let geo: Vec3 = { x: 0, y: 0, z: 0 };
  for (let k = 0; k < 3; k++) {
    const helio = planetPositionAu(id, jdTt - tau);
    geo = { x: helio.x - earth.x, y: helio.y - earth.y, z: helio.z - earth.z };
    tau = length(geo) * LIGHT_DAYS_PER_AU;
  }
  return eclipticToEquatorial({ x: geo.x * AU_KM, y: geo.y * AU_KM, z: geo.z * AU_KM });
}

/** Altura geométrica de uma estrela (direção fixa J2000) vista de um lugar. */
export function fixedAltitudeDeg(dirJ2000: Vec3, jdUt: number, obs: Observer): number {
  return enuToHorizontal(mulMat3Vec(skyMatrix(jdUt, obs), dirJ2000)).altDeg;
}

/** Fase do crepúsculo a partir da altura do Sol. */
export type TwilightPhase = 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';
export function twilightPhase(sunAltDeg: number): TwilightPhase {
  if (sunAltDeg > -0.8333) return 'day';
  if (sunAltDeg > -6) return 'civil';
  if (sunAltDeg > -12) return 'nautical';
  if (sunAltDeg > -18) return 'astronomical';
  return 'night';
}
