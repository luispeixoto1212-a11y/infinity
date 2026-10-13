import { describe, expect, it } from 'vitest';
import { BODIES, findBodyBySlug, getBody, getFact, numericFact, validateCatalog } from './catalog';
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
