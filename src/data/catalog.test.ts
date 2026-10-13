import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { BODIES, MOON_BODIES, PRIMARY_BODIES, findBodyBySlug, getBody, getFact, moonsOf, numericFact, siblingsOf, validateCatalog } from './catalog';
import { ALL_SOURCES, SOURCES } from './sources';
import type { CelestialBody } from './types';

const PLANETS = BODIES.filter((b) => b.type === 'planet');

describe('catálogo de objetos', () => {
  it('não tem problemas de coerência', () => {
    expect(validateCatalog()).toEqual([]);
  });

  it('deteta problemas num catálogo inválido', () => {
    const broken: CelestialBody = {
      ...getBody('mars'),
      id: 'mars',
      slug: 'Marte Inválido',
      facts: [{ key: 'mass', value: Number.NaN, unit: 'kg', kind: 'measured', sourceId: 'nasa-mars' }],
    };
    const problems = validateCatalog([broken]).map((i) => i.problem);
    expect(problems).toContain('slug inválido: Marte Inválido');
    expect(problems).toContain('valor não finito em mass');
    expect(problems).toContain('falta o facto obrigatório diameter');
  });

  it('inclui o Sol, os oito planetas, a Lua, Plutão e Ceres', () => {
    expect(PLANETS.map((p) => p.id)).toEqual([
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ]);
    expect(BODIES.map((b) => b.id)).toEqual(expect.arrayContaining(['sun', 'moon', 'pluto', 'ceres']));
  });

  it('cada planeta tem os dados pedidos para a ficha', () => {
    for (const p of PLANETS) {
      for (const key of ['diameter', 'mass', 'gravity', 'meanDistanceSun', 'orbitalPeriod', 'meanTemperature'] as const) {
        expect(getFact(p, key), `${p.id}: ${key}`).toBeDefined();
      }
      expect(getFact(p, 'dayLength') ?? getFact(p, 'siderealRotation'), `${p.id}: dia`).toBeDefined();
      expect(p.atmosphere, `${p.id}: atmosfera`).toBeDefined();
      expect(p.structure?.layers.length, `${p.id}: estrutura`).toBeGreaterThan(1);
      expect(p.moons, `${p.id}: luas`).toBeDefined();
      expect(p.missions.length, `${p.id}: missões`).toBeGreaterThan(0);
      expect(p.sources.length).toBeGreaterThan(2);
    }
  });

  it('as contagens de luas têm data de referência e os valores consultados', () => {
    const counts = Object.fromEntries(BODIES.filter((b) => b.moons).map((b) => [b.id, b.moons!.count]));
    expect(counts).toMatchObject({ mercury: 0, venus: 0, earth: 1, mars: 2, jupiter: 115, saturn: 293, uranus: 29, neptune: 16, pluto: 5 });
    // Coerência com o total do JPL: 460 satélites, sem a Lua
    const jplTotal = counts.mars! + counts.jupiter! + counts.saturn! + counts.uranus! + counts.neptune! + counts.pluto!;
    expect(jplTotal).toBe(460);
  });

  it('valores de referência coincidem com a ficha da NASA', () => {
    expect(numericFact(getBody('earth'), 'diameter')).toBe(12756);
    expect(numericFact(getBody('jupiter'), 'diameter')).toBe(142984);
    expect(numericFact(getBody('mars'), 'orbitalPeriod')).toBe(686.98);
    expect(numericFact(getBody('venus'), 'surfacePressure')).toBe(92);
    expect(numericFact(getBody('saturn'), 'density')).toBeLessThan(1000);
  });

  it('a soma das componentes atmosféricas em % não ultrapassa 100%', () => {
    for (const b of BODIES) {
      if (!b.atmosphere) continue;
      const total = b.atmosphere.components.filter((c) => c.unit === '%').reduce((s, c) => s + c.value, 0);
      expect(total, b.id).toBeLessThanOrEqual(100.5);
    }
  });

  it('os objetos sem textura fiável estão assinalados como ilustrativos', () => {
    for (const b of BODIES.filter((x) => !x.render.texture)) {
      expect(b.render.visualNote?.['pt-PT'], b.id).toMatch(/ilustrativa/i);
    }
  });

  it('encontra objetos pelo slug em português', () => {
    expect(findBodyBySlug('neptuno')?.id).toBe('neptune');
    expect(findBodyBySlug('plutao')?.id).toBe('pluto');
    expect(findBodyBySlug('inexistente')).toBeUndefined();
  });
});

describe('luas', () => {
  const MOONS = MOON_BODIES.filter((m) => m.id !== 'moon');

  it('separa os objetos principais (11) das luas (21)', () => {
    expect(PRIMARY_BODIES).toHaveLength(11);
    expect(MOON_BODIES).toHaveLength(21);
    expect(PRIMARY_BODIES.some((b) => b.type === 'moon')).toBe(false);
    expect(MOON_BODIES.every((b) => b.type === 'moon' && b.parent)).toBe(true);
  });

  it('agrupa as luas pelo planeta, por ordem de distância', () => {
    expect(moonsOf('mars').map((m) => m.id)).toEqual(['phobos', 'deimos']);
    expect(moonsOf('jupiter').map((m) => m.id)).toEqual(['io', 'europa', 'ganymede', 'callisto']);
    expect(moonsOf('saturn')).toHaveLength(7);
    expect(moonsOf('uranus').map((m) => m.id)).toEqual(['miranda', 'ariel', 'umbriel', 'titania', 'oberon']);
    expect(moonsOf('neptune').map((m) => m.id)).toEqual(['triton']);
    expect(moonsOf('pluto').map((m) => m.id)).toEqual(['charon']);
    expect(siblingsOf(getBody('europa')).map((m) => m.id)).toContain('callisto');
    expect(siblingsOf(getBody('mars'))).toBe(PRIMARY_BODIES);
  });

  it('cada lua tem os dados da ficha, órbita ajustada e rotação síncrona', () => {
    for (const m of MOONS) {
      for (const key of ['diameter', 'mass', 'density', 'gravity', 'distancePlanet', 'orbitalPeriod', 'siderealRotation', 'inclinationEquator', 'discovery'] as const) {
        expect(getFact(m, key), `${m.id}: ${key}`).toBeDefined();
      }
      expect(m.orbit.kind, m.id).toBe('satellite');
      expect(m.render.synchronous, m.id).toBe(true);
      expect(m.sources, m.id).toEqual(expect.arrayContaining(['jpl-sat-phys', 'horizons-moons']));
      expect(m.description.length, m.id).toBeGreaterThan(0);
      // Rotação síncrona: período de rotação = período orbital
      const rot = Math.abs(numericFact(m, 'siderealRotation')!) / 24;
      expect(rot / numericFact(m, 'orbitalPeriod')!, m.id).toBeCloseTo(1, 9);
    }
  });

  it('a massa calculada a partir de GM é coerente com a densidade e o raio', () => {
    for (const m of MOONS) {
      const mass = numericFact(m, 'mass')!;
      const r = m.meanRadiusKm * 1000;
      const density = mass / ((4 / 3) * Math.PI * r ** 3);
      // Fobos e Deimos são muito irregulares: o raio médio esférico dá um volume aproximado
      const tolerance = ['phobos', 'deimos'].includes(m.id) ? 0.25 : 0.02;
      expect(Math.abs(density / numericFact(m, 'density')! - 1), m.id).toBeLessThan(tolerance);
    }
  });

  it('valores conhecidos: Titã, Ganimedes e Tritão', () => {
    expect(numericFact(getBody('ganymede'), 'diameter')).toBeGreaterThan(numericFact(getBody('titan'), 'diameter')!);
    expect(numericFact(getBody('titan'), 'surfacePressure')).toBeCloseTo(1.5, 0);
    expect(getBody('titan').atmosphere?.components[0]?.formula).toBe('N₂');
    expect(numericFact(getBody('triton'), 'siderealRotation')).toBeLessThan(0);
    expect(numericFact(getBody('triton'), 'inclinationEquator')).toBeGreaterThan(150);
  });

  it('os slugs em português abrem a lua certa', () => {
    expect(findBodyBySlug('ganimedes')?.id).toBe('ganymede');
    expect(findBodyBySlug('tita')?.id).toBe('titan');
    expect(findBodyBySlug('tritao')?.id).toBe('triton');
    expect(findBodyBySlug('caronte')?.id).toBe('charon');
  });

  it('as luas principais referidas nas fichas dos planetas têm ligação para a ficha da lua', () => {
    for (const b of PRIMARY_BODIES) {
      for (const n of b.moons?.notable ?? []) {
        if (n.bodyId) expect(getBody(n.bodyId).parent, `${b.id} → ${n.bodyId}`).toBe(b.id);
      }
    }
    const jupiterLinks = getBody('jupiter').moons?.notable.filter((n) => n.bodyId).length ?? 0;
    expect(jupiterLinks).toBe(4);
  });
});

describe('texturas', () => {
  it('cada textura referida existe nas duas resoluções', () => {
    for (const b of BODIES) {
      if (!b.render.texture) continue;
      for (const size of ['2k', '512']) {
        const file = new URL(`../../public/textures/${b.render.texture}-${size}.jpg`, import.meta.url);
        expect(existsSync(file), `${b.id}: ${b.render.texture}-${size}.jpg`).toBe(true);
      }
    }
  });
});

describe('fontes', () => {
  it('todas têm URL https e data de consulta', () => {
    for (const s of ALL_SOURCES) {
      expect(s.url, s.id).toMatch(/^https:\/\//);
      expect(s.accessed, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (s.updated) expect(s.updated, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('as fontes citadas nos objetos existem', () => {
    for (const b of BODIES) for (const s of b.sources) expect(SOURCES[s], `${b.id}: ${s}`).toBeDefined();
  });
});
