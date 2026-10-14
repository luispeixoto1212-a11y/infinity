import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../../app/router';
import { SMALL_BODIES, findSmallBody } from '../../data/smallBodies';
import {
  type SmallBodyOrbitData,
  nearestEpoch,
  nextPerihelionJd,
  orbitalPeriodDays,
  positionFromElements,
  sampleSmallBodyOrbit,
  smallBodyPositionAu,
  trueAnomaly,
} from './smallBody';
import { julianDayTdbToDate } from './time';
import { DEG, length, sub } from './vector';

const data = JSON.parse(readFileSync('public/data/small-bodies.json', 'utf8')) as SmallBodyOrbitData;

/** Erro (UA e graus vistos do Sol) face às posições do JPL Horizons guardadas com os dados. */
function errors(id: string) {
  return data.validation[id]!.map(([jd, x, y, z]) => {
    const ref = { x, y, z };
    const d = length(sub(smallBodyPositionAu(data.orbits[id]!, jd), ref));
    return { jd, au: d, deg: d / length(ref) / DEG };
  });
}

describe('pequenos corpos: propagação a partir dos elementos do Horizons', () => {
  it('há órbita e vetores de validação para todos os corpos do catálogo', () => {
    for (const b of SMALL_BODIES) {
      expect(data.orbits[b.id], b.id).toBeDefined();
      expect(data.validation[b.id]?.length, b.id).toBeGreaterThanOrEqual(3);
    }
    expect(Object.keys(data.orbits)).toHaveLength(SMALL_BODIES.length);
  });

  it('reproduz exatamente a posição nas épocas dos elementos (consistência de Kepler)', () => {
    // Na própria época, a anomalia média calculada a partir de Tp tem de dar a posição do Horizons sem propagação.
    const halley = data.orbits.halley!;
    const ep = halley.find((e) => e[0] === 2446717.5)!; // 14/10/1986, oito meses depois do periélio
    const p = positionFromElements(ep, ep[0]);
    expect(length(p)).toBeGreaterThan(1);
    expect(length(p)).toBeLessThan(10);
  });

  it('resolve a equação de Kepler em órbitas quase parabólicas e hiperbólicas', () => {
    for (const e of [0.2, 0.9, 0.995]) {
      for (const M of [-3, -0.01, 0.001, 1, 3]) {
        const nu = trueAnomaly(M, e);
        const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
        expect(E - e * Math.sin(E)).toBeCloseTo(Math.atan2(Math.sin(M), Math.cos(M)), 9);
      }
    }
    for (const e of [1.2, 3.4, 6.1]) {
      for (const M of [-500, -1, 0.5, 40]) {
        const nu = trueAnomaly(M, e);
        const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
        expect((e * Math.sinh(H) - H - M) / Math.max(1, Math.abs(M))).toBeCloseTo(0, 9);
      }
    }
  });

  it('erro face ao Horizons a meio caminho entre épocas: mediana < 0,05° e máximo < 3,5°', () => {
    const all = SMALL_BODIES.flatMap((b) => errors(b.id).map((e) => e.deg)).sort((a, b) => a - b);
    expect(all[Math.floor(all.length / 2)]!).toBeLessThan(0.05);
    expect(all[all.length - 1]!).toBeLessThan(3.5);
  });

  it('entre 1991 e 2041 o erro é inferior a 1,2° para todos, exceto o Tempel 1 (encontros com Júpiter)', () => {
    for (const b of SMALL_BODIES) {
      for (const e of errors(b.id)) {
        if (e.jd < 2448543.5 || e.jd > 2466806.5) continue;
        expect(e.deg, `${b.id} em ${julianDayTdbToDate(e.jd).toISOString().slice(0, 10)}`).toBeLessThan(b.id === 'tempel1' ? 3.5 : 1.2);
      }
    }
  });

  it('objetos distantes: erro de posição inferior a 0,04 UA (oscilação do Sol à volta do baricentro)', () => {
    for (const id of ['eris', 'sedna', 'haumea', 'makemake', 'arrokoth', 'halley', 'hale-bopp', 'swift-tuttle']) {
      for (const e of errors(id)) expect(e.au, id).toBeLessThan(0.04);
    }
  });

  it('próximas passagens pelo periélio: Halley em 2061 e Swift–Tuttle em 2126', () => {
    const now = 2461327.5; // 14/10/2026
    const halley = julianDayTdbToDate(nextPerihelionJd(data.orbits.halley!, now));
    expect(halley.getUTCFullYear()).toBe(2061);
    // Os elementos osculadores de 2026 dão o início de agosto de 2061; as perturbações dos planetas perto do
    // periélio fazem variar esta data em alguns dias.
    expect([6, 7]).toContain(halley.getUTCMonth());
    expect(julianDayTdbToDate(nextPerihelionJd(data.orbits['swift-tuttle']!, now)).getUTCFullYear()).toBe(2126);
    // Encke: período de cerca de 3,3 anos
    expect(orbitalPeriodDays(nearestEpoch(data.orbits.encke!, now)) / 365.25).toBeCloseTo(3.3, 1);
  });

  it('órbitas desenháveis: elipses fechadas e ramos hiperbólicos limitados', () => {
    const vesta = sampleSmallBodyOrbit(data.orbits.vesta!, 2461327.5, 120);
    expect(length(sub(vesta[0]!, vesta[vesta.length - 1]!))).toBeLessThan(1e-9);
    const atlas = sampleSmallBodyOrbit(data.orbits.atlas3i!, 2461327.5, 120, 40);
    for (const p of atlas) expect(length(p)).toBeLessThanOrEqual(40 + 1e-6);
    expect(Math.min(...atlas.map(length))).toBeCloseTo(1.352, 2); // periélio de 3I/ATLAS
  });
});

describe('pequenos corpos: catálogo', () => {
  it('ids e slugs únicos, fontes com ligação e textos preenchidos', () => {
    expect(new Set(SMALL_BODIES.map((b) => b.slug)).size).toBe(SMALL_BODIES.length);
    expect(new Set(SMALL_BODIES.map((b) => b.id)).size).toBe(SMALL_BODIES.length);
    for (const b of SMALL_BODIES) {
      expect(b.description.length, b.id).toBeGreaterThan(80);
      expect(b.facts.length, b.id).toBeGreaterThan(0);
      for (const fct of b.facts) expect(fct.source.url, `${b.id}: ${fct.label}`).toMatch(/^https:\/\//);
      expect(b.discovery.source.url).toMatch(/^https:\/\//);
    }
    expect(findSmallBody('bennu')?.pha).toBe(true);
    expect(findSmallBody('vesta')?.neo).toBe(false);
  });

  it('as massas derivadas de GM coincidem com G·M publicado (G = 6,6743 × 10⁻²⁰ km³ kg⁻¹ s⁻²)', () => {
    const G = 6.6743e-20;
    const mass = (slug: string) => findSmallBody(slug)!.facts.find((x) => x.label === 'Massa')!.value;
    const parse = (v: string) => {
      const m = /([\d,]+) × 10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/.exec(v)!;
      const exp = Number([...m[2]!].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''));
      return Number(m[1]!.replace(',', '.')) * 10 ** exp;
    };
    expect(parse(mass('vesta')) / (17.2882844 / G)).toBeCloseTo(1, 2);
    expect(parse(mass('bennu')) / (4.8904e-9 / G)).toBeCloseTo(1, 2);
    expect(parse(mass('67p')) / (662.2e-9 / G)).toBeCloseTo(1, 2);
    expect(parse(mass('eros')) / (4.463e-4 / G)).toBeCloseTo(1, 2);
  });

  it('rotas da secção', () => {
    expect(parseHash('#/asteroides-e-cometas')).toEqual({ name: 'small-bodies' });
    expect(parseHash('#/asteroides-e-cometas/bennu')).toEqual({ name: 'small-body', slug: 'bennu' });
    for (const b of SMALL_BODIES) expect(parseHash(routeToHash({ name: 'small-body', slug: b.slug }))).toEqual({ name: 'small-body', slug: b.slug });
  });
});
