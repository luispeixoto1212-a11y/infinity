import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConstellationLocator, parseConstellationBounds } from './constellationLocator';
import { moonEquatorialJ2000Km, MOON_POSITION_MAX_ERROR_DEG } from './moon';
import { radecToUnit } from './orientation';
import { mulMat3Vec, precessionMatrix } from './precession';
import {
  bodyAltitudeDeg,
  enuToHorizontal,
  findRiseSet,
  geocentricBodies,
  gmstDeg,
  horizontalToEnu,
  jdTtFromUt,
  localSiderealDeg,
  moonPhaseName,
  moonSunLongitudeDiffDeg,
  nextMoonPhaseJd,
  observerOffsetEnuKm,
  refractionDeg,
  skyMatrix,
  topocentricEnuKm,
  twilightPhase,
  unitToRaDec,
} from './sky';
import { angleBetweenDeg } from './vector';
import { HORIZONS_GEOCENTRIC, HORIZONS_LISBON_LAST, HORIZONS_TOPOCENTRIC } from '../../data/skyValidation';

const AU_KM = 149_597_870.7;
const LISBON = { latDeg: 38.7223, lonDeg: -9.1393 };

describe('tempo sideral e precessão', () => {
  it('reproduz os exemplos 12.a e 12.b de Meeus', () => {
    expect(gmstDeg(2446895.5)).toBeCloseTo(197.693195, 5);
    expect(gmstDeg(2446896.30625)).toBeCloseTo(128.7378734, 5);
  });

  it('concorda com o tempo sideral local do Horizons (diferença = equação dos equinócios, < 1,2 s)', () => {
    const lst = localSiderealDeg(HORIZONS_LISBON_LAST.jdUt, LISBON.lonDeg) / 15;
    expect(Math.abs(lst - HORIZONS_LISBON_LAST.hours) * 3600).toBeLessThan(1.2);
  });

  it('reproduz o exemplo 21.b de Meeus (θ Persei, J2000 → 2028-11-13,19)', () => {
    const v = mulMat3Vec(precessionMatrix(2451545, 2462088.69), radecToUnit(41.054063, 49.22775));
    const { raDeg, decDeg } = unitToRaDec(v);
    expect(raDeg).toBeCloseTo(41.547214, 5);
    expect(decDeg).toBeCloseTo(49.348483, 5);
  });

  it('a precessão de ida e volta devolve a direção inicial', () => {
    const v = radecToUnit(123.4, -56.7);
    const back = mulMat3Vec(precessionMatrix(2470000, 2451545), mulMat3Vec(precessionMatrix(2451545, 2470000), v));
    expect(angleBetweenDeg(v, back) * 3600).toBeLessThan(0.01);
  });
});

describe('Lua (ELP-2000/82 truncada, Meeus cap. 47) face ao JPL Horizons', () => {
  for (const ref of HORIZONS_GEOCENTRIC.filter((r) => r.id === 'moon')) {
    it(`JD ${ref.jdUt}: posição a menos de ${MOON_POSITION_MAX_ERROR_DEG * 3600}″ e distância a menos de 50 km`, () => {
      const m = moonEquatorialJ2000Km(jdTtFromUt(ref.jdUt));
      expect(angleBetweenDeg(m, radecToUnit(ref.raDeg, ref.decDeg))).toBeLessThan(MOON_POSITION_MAX_ERROR_DEG);
      expect(Math.abs(Math.hypot(m.x, m.y, m.z) - ref.deltaAu * AU_KM)).toBeLessThan(50);
    });
  }
});

describe('Sol e planetas geocêntricos face ao JPL Horizons', () => {
  // Erros esperados: os da Tabela 1 do JPL, ampliados pela proximidade (Saturno até ~300″).
  const TOL_ARCSEC: Record<string, number> = { saturn: 330, jupiter: 120 };
  for (const ref of HORIZONS_GEOCENTRIC) {
    it(`${ref.id}, JD ${ref.jdUt}: direção, distância, fase e magnitude`, () => {
      const b = geocentricBodies(jdTtFromUt(ref.jdUt)).find((x) => x.id === ref.id)!;
      const err = angleBetweenDeg(b.geoJ2000Km, radecToUnit(ref.raDeg, ref.decDeg)) * 3600;
      expect(err).toBeLessThan(TOL_ARCSEC[ref.id] ?? 60);
      expect(Math.abs(b.distanceAu - ref.deltaAu) / ref.deltaAu).toBeLessThan(1e-3);
      if (ref.phaseDeg !== null) expect(Math.abs(b.phaseAngleDeg - ref.phaseDeg)).toBeLessThan(0.05);
      if (ref.mag !== null) expect(Math.abs(b.magnitude - ref.mag)).toBeLessThan(0.15);
    });
  }
});

describe('coordenadas horizontais topocêntricas face ao JPL Horizons', () => {
  for (const ref of HORIZONS_TOPOCENTRIC) {
    it(`${ref.id} em ${ref.place}, JD ${ref.jdUt}`, () => {
      const obs = { latDeg: ref.latDeg, lonDeg: ref.lonDeg };
      const b = geocentricBodies(jdTtFromUt(ref.jdUt)).find((x) => x.id === ref.id)!;
      const h = enuToHorizontal(topocentricEnuKm(b.geoJ2000Km, skyMatrix(ref.jdUt, obs), observerOffsetEnuKm(obs)));
      const err = angleBetweenDeg(horizontalToEnu(h), horizontalToEnu(ref)) * 3600;
      // Lua e Sol: < 30″ (paralaxe incluída); Saturno herda o erro da Tabela 1 (~300″).
      expect(err).toBeLessThan(ref.id === 'saturn' ? 330 : 30);
    });
  }

  it('a paralaxe desloca a Lua cerca de 1° perto do horizonte', () => {
    const jd = 2461327.25;
    const b = geocentricBodies(jdTtFromUt(jd)).find((x) => x.id === 'moon')!;
    const m = skyMatrix(jd, LISBON);
    const geo = enuToHorizontal(mulMat3Vec(m, b.geoJ2000Km));
    const topo = enuToHorizontal(topocentricEnuKm(b.geoJ2000Km, m, observerOffsetEnuKm(LISBON)));
    expect(geo.altDeg - topo.altDeg).toBeGreaterThan(0.8);
    expect(geo.altDeg - topo.altDeg).toBeLessThan(1.0);
  });
});

describe('refração, nascer e ocaso', () => {
  it('a refração vale ~34′ no horizonte, ~1′ a 45° e 0 no zénite', () => {
    expect(refractionDeg(0) * 60).toBeGreaterThan(28);
    expect(refractionDeg(0) * 60).toBeLessThan(36);
    expect(refractionDeg(45) * 60).toBeCloseTo(1.0, 0);
    expect(Math.abs(refractionDeg(90))).toBeLessThan(1e-4);
    expect(refractionDeg(-5)).toBe(0);
  });

  // Horizons, Lisboa, 2026-10-14 (UT, resolução de 1 minuto): Sol 06:45 / 12:23 / 18:00; Lua 10:46 / 15:22 / 19:56.
  const day = 2461327.5;
  const minutes = (jd: number | null) => (jd === null ? NaN : (jd - day) * 1440);
  it('nascer, passagem e ocaso do Sol em Lisboa a menos de 2 minutos do Horizons', () => {
    const rs = findRiseSet((jd) => bodyAltitudeDeg('sun', jd, LISBON), day, -0.8333);
    expect(Math.abs(minutes(rs.rise) - (6 * 60 + 45))).toBeLessThan(2);
    expect(Math.abs(minutes(rs.transit) - (12 * 60 + 23))).toBeLessThan(2);
    expect(Math.abs(minutes(rs.set) - 18 * 60)).toBeLessThan(2);
    expect(rs.transitAltDeg).toBeCloseTo(43.03 - refractionDeg(43), 1);
  });

  it('nascer, passagem e ocaso da Lua em Lisboa a menos de 2 minutos do Horizons', () => {
    const rs = findRiseSet((jd) => bodyAltitudeDeg('moon', jd, LISBON), day, -0.8333);
    expect(Math.abs(minutes(rs.rise) - (10 * 60 + 46))).toBeLessThan(2);
    expect(Math.abs(minutes(rs.transit) - (15 * 60 + 22))).toBeLessThan(2);
    expect(Math.abs(minutes(rs.set) - (19 * 60 + 56))).toBeLessThan(2);
  });

  it('deteta astros circumpolares e sempre abaixo do horizonte', () => {
    const polaris = radecToUnit(37.95, 89.26);
    const alt = (jd: number) => enuToHorizontal(mulMat3Vec(skyMatrix(jd, LISBON), polaris)).altDeg;
    expect(findRiseSet(alt, day, -0.5667).alwaysUp).toBe(true);
    const sigmaOct = radecToUnit(317.2, -88.96);
    const alt2 = (jd: number) => enuToHorizontal(mulMat3Vec(skyMatrix(jd, LISBON), sigmaOct)).altDeg;
    expect(findRiseSet(alt2, day, -0.5667).alwaysDown).toBe(true);
  });

  it('classifica o crepúsculo pela altura do Sol', () => {
    expect(twilightPhase(10)).toBe('day');
    expect(twilightPhase(-3)).toBe('civil');
    expect(twilightPhase(-9)).toBe('nautical');
    expect(twilightPhase(-15)).toBe('astronomical');
    expect(twilightPhase(-30)).toBe('night');
  });
});

describe('fases da Lua', () => {
  it('2030-06-15 é quase lua cheia (99,9 % iluminada no Horizons)', () => {
    const jd = jdTtFromUt(2462668);
    const moon = geocentricBodies(jd).find((b) => b.id === 'moon')!;
    expect(moon.illuminatedFraction).toBeGreaterThan(0.995);
    expect(moonPhaseName(moonSunLongitudeDiffDeg(jd))).toBe('full');
  });

  it('a 2024-01-01 a Lua estava minguante e 74 % iluminada', () => {
    const jd = jdTtFromUt(2460311);
    const moon = geocentricBodies(jd).find((b) => b.id === 'moon')!;
    expect(moon.illuminatedFraction).toBeCloseTo(0.7404, 2);
    expect(moonPhaseName(moonSunLongitudeDiffDeg(jd))).toBe('waning-gibbous');
  });

  it('encontra a lua nova de 2024-01-11 11:57 UT', () => {
    const jd = nextMoonPhaseJd(jdTtFromUt(2460311), 0);
    const expected = 2460321.0 + (11 * 60 + 57) / 1440 - 0.5;
    expect(Math.abs(jd - 69.184 / 86400 - expected) * 1440).toBeLessThan(5);
  });
});

describe('constelação de uma direção (limites da IAU)', () => {
  const bounds = parseConstellationBounds(JSON.parse(readFileSync('public/data/constellation-bounds.json', 'utf8')));
  const locator = new ConstellationLocator(bounds);

  it('tem os limites das 88 constelações', () => {
    expect(Object.keys(bounds)).toHaveLength(88);
  });

  it('identifica estrelas conhecidas e os polos', () => {
    expect(locator.find(101.287, -16.716)).toBe('CMa'); // Sírio
    expect(locator.find(88.793, 7.407)).toBe('Ori'); // Betelgeuse
    expect(locator.find(279.235, 38.784)).toBe('Lyr'); // Vega
    expect(locator.find(186.65, -63.099)).toBe('Cru'); // Ácrux
    expect(locator.find(37.95, 89.264)).toBe('UMi'); // Estrela Polar
    expect(locator.find(0, 90)).toBe('UMi');
    expect(locator.find(0, -90)).toBe('Oct');
    // 10 Ursae Majoris fica, pelos limites oficiais, no Lince
    expect(locator.find(135.16, 41.783)).toBe('Lyn');
  });

  it('concorda com a constelação indicada pelo AT-HYG para todas as estrelas do catálogo', () => {
    const cat = JSON.parse(readFileSync('public/data/star-catalog.json', 'utf8')) as {
      stars: Array<{ ra: number | null; dec: number | null; con: string | null }>;
    };
    let total = 0;
    let wrong = 0;
    for (const s of cat.stars) {
      if (!s.con || s.ra === null || s.dec === null) continue;
      total++;
      if (locator.find(s.ra, s.dec) !== s.con) wrong++;
    }
    expect(total).toBeGreaterThan(500);
    expect(wrong).toBe(0);
  });
});
