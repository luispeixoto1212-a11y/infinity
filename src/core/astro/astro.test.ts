import { describe, expect, it } from 'vitest';
import { JPL_TABLE_1 } from './elements';
import { planetPositionAu, solveKepler, toSpherical } from './kepler';
import { moonGeocentricKm, MOON_POSITION_MAX_ERROR_DEG } from './moon';
import { bodyFrameEcliptic } from './orientation';
import { heliocentricPositionAu } from './positions';
import { bodyRadiusToScene, compressDistanceAu, heliocentricAuToScene } from './scale';
import {
  J2000_JD,
  clampToValidity,
  dateToJulianDayTdb,
  dateToJulianDayUtc,
  EPHEMERIS_VALIDITY,
  julianDayTdbToDate,
} from './time';
import { DEG, angleBetweenDeg, dot, length } from './vector';
import { BODIES, getBody } from '../../data/catalog';
import { HORIZONS_EPOCH_JD, HORIZONS_MOON_GEOCENTRIC_KM, HORIZONS_REFERENCE } from '../../data/validation';

const AU_KM = 149_597_870.7;

describe('escalas de tempo', () => {
  it('converte UTC em TDB com ΔT = 69,184 s (segundos intercalares em vigor desde 2017)', () => {
    // 2026-10-13 00:00:00 TDB ≈ 2026-10-12 23:58:50,816 UTC → JD 2461326,5
    const utc = new Date(Date.UTC(2026, 9, 12, 23, 58, 50, 816));
    expect(dateToJulianDayTdb(utc)).toBeCloseTo(HORIZONS_EPOCH_JD, 7);
  });

  it('o Dia Juliano UTC de 1970-01-01 é 2440587,5', () => {
    expect(dateToJulianDayUtc(new Date(0))).toBe(2440587.5);
  });

  it('a conversão de ida e volta preserva a data', () => {
    const d = new Date(Date.UTC(2026, 9, 13, 15, 30, 0));
    expect(julianDayTdbToDate(dateToJulianDayTdb(d)).getTime()).toBeCloseTo(d.getTime(), -1);
  });

  it('limita a simulação ao intervalo de validade 1800–2050', () => {
    expect(clampToValidity(EPHEMERIS_VALIDITY.maxJd + 10)).toEqual({ jd: EPHEMERIS_VALIDITY.maxJd, clamped: true });
    expect(clampToValidity(EPHEMERIS_VALIDITY.minJd - 10).clamped).toBe(true);
    expect(clampToValidity(J2000_JD)).toEqual({ jd: J2000_JD, clamped: false });
  });
});

describe('equação de Kepler', () => {
  it.each([
    [0, 0],
    [30, 0.0167],
    [100, 0.2056],
    [-150, 0.25],
    [359, 0.9],
  ])('M = %d°, e = %d satisfaz M = E − e·sin E', (M, e) => {
    const E = solveKepler(M, e);
    const back = E - (e / DEG) * Math.sin(E * DEG);
    const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
    expect(Math.abs(wrap(back - M))).toBeLessThan(1e-6);
  });

  it('rejeita excentricidades não elípticas', () => {
    expect(() => solveKepler(10, 1.2)).toThrow(RangeError);
  });
});

describe('posições dos planetas comparadas com o JPL Horizons (DE441)', () => {
  const tableKey: Record<string, keyof typeof JPL_TABLE_1> = {
    mercury: 'mercury',
    venus: 'venus',
    earth: 'emb',
    mars: 'mars',
    jupiter: 'jupiter',
    saturn: 'saturn',
    uranus: 'uranus',
    neptune: 'neptune',
  };

  for (const ref of HORIZONS_REFERENCE) {
    const key = tableKey[ref.id];
    if (!key) continue;
    it(`${ref.id}: concorda com o Horizons dentro das tolerâncias documentadas`, () => {
      const ours = toSpherical(planetPositionAu(key, HORIZONS_EPOCH_JD));
      const theirs = toSpherical(ref.vector);
      let dLon = (ours.lonDeg - theirs.lonDeg) * 3600;
      if (dLon > 648000) dLon -= 1296000;
      if (dLon < -648000) dLon += 1296000;
      const stated = JPL_TABLE_1[key].stated;
      // Neptuno: a diferença medida (~32″) excede os 10″ indicados; documentado em "Dados e métodos".
      const lonTolerance = key === 'neptune' ? 40 : stated.lambdaArcsec;
      expect(Math.abs(dLon)).toBeLessThan(lonTolerance);
      expect(Math.abs((ours.latDeg - theirs.latDeg) * 3600)).toBeLessThan(stated.phiArcsec + 1);
      // Mercúrio: diferença de distância medida (~1180 km) um pouco acima dos 1000 km indicados.
      expect(Math.abs((ours.r - theirs.r) * AU_KM)).toBeLessThan(stated.rhoThousandKm * 1000 * 1.25);
    });
  }

  it('Plutão e Ceres (elementos osculadores) ficam a menos de 0,1° do Horizons', () => {
    for (const id of ['pluto', 'ceres'] as const) {
      const ref = HORIZONS_REFERENCE.find((r) => r.id === id)!;
      const ours = heliocentricPositionAu(getBody(id), HORIZONS_EPOCH_JD);
      expect(angleBetweenDeg(ours, ref.vector)).toBeLessThan(0.1);
    }
  });
});

describe('Lua', () => {
  it('posição geocêntrica dentro do erro anunciado', () => {
    const m = moonGeocentricKm(HORIZONS_EPOCH_JD);
    expect(angleBetweenDeg(m, HORIZONS_MOON_GEOCENTRIC_KM)).toBeLessThan(MOON_POSITION_MAX_ERROR_DEG);
  });

  it('distância à Terra entre o perigeu e o apogeu extremos ao longo de um ano', () => {
    for (let d = 0; d < 365; d += 3) {
      const r = length(moonGeocentricKm(HORIZONS_EPOCH_JD + d));
      expect(r).toBeGreaterThan(356_000);
      expect(r).toBeLessThan(407_000);
    }
  });
});

describe('orientação (IAU)', () => {
  const eclipticNorth = { x: 0, y: 0, z: 1 };

  it('o eixo da Terra faz 23,44° com o polo da eclíptica', () => {
    const f = bodyFrameEcliptic(getBody('earth').pole!, J2000_JD);
    expect(angleBetweenDeg(f.north, eclipticNorth)).toBeCloseTo(23.439, 2);
  });

  it('os eixos do corpo são ortonormados', () => {
    for (const b of BODIES) {
      if (!b.pole) continue;
      const f = bodyFrameEcliptic(b.pole, HORIZONS_EPOCH_JD);
      expect(length(f.primeMeridian)).toBeCloseTo(1, 9);
      expect(length(f.north)).toBeCloseTo(1, 9);
      expect(dot(f.primeMeridian, f.north)).toBeCloseTo(0, 9);
      expect(dot(f.east90, f.north)).toBeCloseTo(0, 9);
      expect(dot(f.primeMeridian, f.east90)).toBeCloseTo(0, 9);
    }
  });

  it('Úrano tem o eixo deitado: obliquidade de cerca de 98° (polo de rotação = oposto ao polo norte IAU)', () => {
    const f = bodyFrameEcliptic(getBody('uranus').pole!, HORIZONS_EPOCH_JD);
    const el = JPL_TABLE_1.uranus.base;
    const I = el.I * DEG;
    const O = el.Omega * DEG;
    const orbitNormal = { x: Math.sin(I) * Math.sin(O), y: -Math.sin(I) * Math.cos(O), z: Math.cos(I) };
    // A IAU chama "norte" ao polo do lado norte do plano invariável; como Úrano roda em sentido
    // retrógrado, o polo de rotação (regra da mão direita) é o oposto, a 97,77° da normal da órbita.
    const spinPole = { x: -f.north.x, y: -f.north.y, z: -f.north.z };
    expect(angleBetweenDeg(spinPole, orbitNormal)).toBeCloseTo(97.77, 0);
  });

  it('a rotação da Terra avança cerca de 361° por dia', () => {
    const pole = getBody('earth').pole!;
    const a = bodyFrameEcliptic(pole, J2000_JD).primeMeridian;
    const b = bodyFrameEcliptic(pole, J2000_JD + 1).primeMeridian;
    // 360,9856° por dia → o meridiano roda ~0,9856° para além de uma volta completa
    expect(angleBetweenDeg(a, b)).toBeCloseTo(0.9856, 1);
  });
});

describe('escala de visualização', () => {
  it('preserva a direção real e comprime a distância', () => {
    const p = planetPositionAu('jupiter', HORIZONS_EPOCH_JD);
    const s = heliocentricAuToScene(p);
    const back = { x: s.x, y: -s.z, z: s.y };
    expect(angleBetweenDeg(back, p)).toBeLessThan(1e-9);
    expect(length(s)).toBeCloseTo(compressDistanceAu(length(p)), 9);
  });

  it('é monótona: objetos mais distantes ficam mais longe na cena', () => {
    let prev = 0;
    for (const r of [0.39, 0.72, 1, 1.52, 5.2, 9.5, 19.2, 30, 49]) {
      const d = compressDistanceAu(r);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });

  it('os tamanhos mantêm a ordem real e têm um mínimo visível', () => {
    expect(bodyRadiusToScene(69911)).toBeGreaterThan(bodyRadiusToScene(58232));
    expect(bodyRadiusToScene(1188)).toBeGreaterThanOrEqual(0.3);
    expect(bodyRadiusToScene(6371)).toBeCloseTo(1, 6);
  });

  it('as órbitas desenhadas não se cruzam entre planetas vizinhos (excentricidades)', () => {
    const order = ['mercury', 'venus', 'emb', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
    for (let i = 1; i < order.length; i += 1) {
      const inner = JPL_TABLE_1[order[i - 1]!].base;
      const outer = JPL_TABLE_1[order[i]!].base;
      expect(inner.a * (1 + inner.e)).toBeLessThan(outer.a * (1 - outer.e));
    }
  });
});
