import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MARS_FLUX,
  VENUS_FLUX,
  countByMethod,
  countSystems,
  discoveriesByYear,
  distanceForFlux,
  exoSlug,
  insolation,
  lightYears,
  loadExoplanets,
  massEarth,
  parseCatalog,
  queryCatalog,
  radiusEarth,
  semiMajorAxis,
  sizeClass,
  stellarLuminosity,
  type Exoplanet,
} from './exoplanetData';
import { FEATURED_EXOPLANETS } from './featured';
import { exoplanetEntries } from '../search/exoplanetIndex';
import { buildIndex, search } from '../search/searchIndex';
import { SOURCES } from '../../data/sources';

const raw = JSON.parse(readFileSync(new URL('../../../public/data/exoplanets.json', import.meta.url), 'utf8'));
const catalog = parseCatalog(raw);
const get = (name: string) => catalog.planets.find((p) => p.name === name)!;

describe('catálogo de exoplanetas (NASA Exoplanet Archive)', () => {
  it('tem a contagem da versão incluída e nomes e endereços únicos', () => {
    expect(catalog.snapshot).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(catalog.planets.length).toBe(6445);
    expect(new Set(catalog.planets.map((p) => p.name)).size).toBe(catalog.planets.length);
    expect(catalog.bySlug.size).toBe(catalog.planets.length);
    expect(countSystems(catalog.planets)).toBe(catalog.byHost.size);
  });

  it('as contagens por método somam o total e o trânsito domina', () => {
    const c = countByMethod(catalog.planets);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(catalog.planets.length);
    expect(c.transit).toBe(4781);
    expect(c.rv).toBe(1203);
    expect(c.transit).toBeGreaterThan(c.rv);
  });

  it('as descobertas por ano somam o total e começam em 1992', () => {
    const bins = discoveriesByYear(catalog.planets);
    expect(bins[0]!.year).toBe(1992);
    expect(bins.reduce((s, b) => s + b.total, 0)).toBe(catalog.planets.length);
    for (const b of bins) expect(Object.values(b.groups).reduce((s, v) => s + v, 0)).toBe(b.total);
    const peak = bins.reduce((a, b) => (b.total > a.total ? b : a));
    expect(peak.year).toBe(2016);
  });

  it('valores de referência coincidem com as páginas da NASA', () => {
    // NASA Science: Proxima Centauri b com 1,055 massas terrestres, 0,04848 UA e 11,2 dias
    const prox = get('Proxima Cen b');
    expect(massEarth(prox)).toBeCloseTo(1.055, 2);
    expect(prox.a).toBeCloseTo(0.04848, 5);
    expect(prox.period).toBeCloseTo(11.2, 1);
    // TRAPPIST-1 e: 0,692 massas terrestres, 6,1 dias, 0,02925 UA
    const t1e = get('TRAPPIST-1 e');
    expect(massEarth(t1e)).toBeCloseTo(0.692, 2);
    expect(t1e.a).toBeCloseTo(0.02925, 5);
    // HR 8799 b: 7 massas de Júpiter a 68 UA, órbita de 465,8 anos
    const hr = get('HR 8799 b');
    expect(hr.massJ).toBe(7);
    expect(hr.period! / 365.25).toBeCloseTo(465.4, 0);
    expect(catalog.byHost.get('TRAPPIST-1')!.map((p) => p.name.at(-1))).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('distingue valores medidos de estimativas', () => {
    const prox = get('Proxima Cen b');
    expect(prox.radiusMeasured).toBe(false); // velocidade radial: raio estimado (a NASA indica "estimate")
    expect(prox.massMeasured).toBe(true);
    expect(get('TRAPPIST-1 e').radiusMeasured).toBe(true);
    expect(get('55 Cnc e').radiusMeasured).toBe(true); // descoberto por velocidade radial, mas transita
    expect(get('HR 8799 b').radiusMeasured).toBe(false); // imagem direta: raio de modelos
  });

  it('o carregamento usa o ficheiro de dados e propaga erros HTTP', async () => {
    const ok = (async () => new Response(JSON.stringify(raw), { status: 200 })) as typeof fetch;
    await expect(loadExoplanets(ok)).resolves.toHaveProperty('planets');
    expect(() => parseCatalog({ foo: 1 })).toThrow();
  });
});

describe('grandezas derivadas', () => {
  it('converte unidades de Júpiter para terrestres', () => {
    const p = { massJ: 1, radiusJ: 1 } as Exoplanet;
    expect(massEarth(p)).toBeCloseTo(317.83, 2);
    expect(radiusEarth(p)).toBeCloseTo(11.209, 3);
    expect(lightYears(1)).toBeCloseTo(3.26156, 5);
  });

  it('classes de tamanho da missão Kepler', () => {
    expect(sizeClass(1)).toBe('earth');
    expect(sizeClass(1.5)).toBe('super-earth');
    expect(sizeClass(3.9)).toBe('neptune');
    expect(sizeClass(11.2)).toBe('jupiter');
    expect(sizeClass(20)).toBe('larger');
  });

  it('luminosidade e fluxo: o Sol e a Terra dão 1', () => {
    expect(stellarLuminosity({ radius: 1, teff: 5772 })).toBeCloseTo(1, 10);
    const earthLike = { a: 1, star: { radius: 1, teff: 5772 } } as Exoplanet;
    expect(insolation(earthLike)).toBeCloseTo(1, 10);
    expect(distanceForFlux(1, VENUS_FLUX)).toBeCloseTo(0.723, 3);
    expect(distanceForFlux(1, MARS_FLUX)).toBeCloseTo(1.524, 3);
  });

  it('a terceira lei de Kepler recupera o semieixo maior da Terra', () => {
    const p = { period: 365.25, star: { mass: 1 } } as Exoplanet;
    const a = semiMajorAxis(p)!;
    expect(a.derived).toBe(true);
    expect(a.value).toBeCloseTo(1, 6);
    // Com dados reais: TRAPPIST-1 e pela lei de Kepler fica perto do valor publicado
    const t1e = get('TRAPPIST-1 e');
    const k = semiMajorAxis({ ...t1e, a: undefined })!;
    expect(Math.abs(k.value / t1e.a! - 1)).toBeLessThan(0.03);
  });

  it('TRAPPIST-1 e recebe menos energia do que a Terra e mais do que Marte', () => {
    const s = insolation(get('TRAPPIST-1 e'))!;
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThan(MARS_FLUX);
  });
});

describe('tabela do catálogo', () => {
  it('pesquisa por planeta, estrela ou designação alternativa', () => {
    const base = { method: 'all' as const, sort: 'name' as const, descending: false };
    expect(queryCatalog(catalog.planets, { ...base, text: 'trappist-1' }).length).toBe(7);
    expect(queryCatalog(catalog.planets, { ...base, text: 'HIP 70890 b' }).map((p) => p.name)).toEqual(['Proxima Cen b']);
    expect(queryCatalog(catalog.planets, { ...base, text: 'xyzzy' })).toEqual([]);
  });

  it('ordena por distância com os valores em falta no fim', () => {
    const rows = queryCatalog(catalog.planets, { text: '', method: 'all', sort: 'distance', descending: false });
    expect(rows[0]!.host).toBe('Proxima Cen');
    expect(rows.at(-1)!.distPc).toBeUndefined();
    const desc = queryCatalog(catalog.planets, { text: '', method: 'all', sort: 'distance', descending: true });
    expect(desc.at(-1)!.distPc).toBeUndefined();
  });

  it('filtra por método', () => {
    const rows = queryCatalog(catalog.planets, { text: '', method: 'imaging', sort: 'year', descending: true });
    expect(rows.length).toBe(97);
    expect(rows.every((p) => p.method === 'imaging')).toBe(true);
  });

  it('gera endereços legíveis e estáveis', () => {
    expect(exoSlug('Proxima Cen b')).toBe('proxima-cen-b');
    expect(exoSlug('PSR B1257+12 c')).toBe('psr-b1257-12-c');
    expect(exoSlug('2MASS J0249-0557 A c')).toBe('2mass-j0249-0557-a-c');
  });
});

describe('exoplanetas em destaque', () => {
  it('existem no catálogo e citam fontes registadas', () => {
    for (const f of FEATURED_EXOPLANETS) {
      expect(catalog.planets.some((p) => p.name === f.name), f.name).toBe(true);
      expect(f.sources.length, f.name).toBeGreaterThan(0);
      for (const s of f.sources) expect(SOURCES[s], `${f.name}: ${s}`).toBeDefined();
    }
  });
});

describe('pesquisa global com exoplanetas', () => {
  const idx = JSON.parse(readFileSync(new URL('../../../public/data/exoplanet-index.json', import.meta.url), 'utf8'));
  const entries = exoplanetEntries(idx.rows);
  const index = buildIndex(undefined, entries);
  const first = (q: string) => search(index, q)[0]?.entry;

  it('o índice leve tem os mesmos planetas que o catálogo', () => {
    expect(entries.length).toBe(catalog.planets.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it('encontra exoplanetas pelo nome, nome comum e sistema', () => {
    expect(first('TRAPPIST-1 e')?.route).toEqual({ name: 'exoplanet', slug: 'trappist-1-e' });
    expect(first('Proxima Centauri b')?.route).toEqual({ name: 'exoplanet', slug: 'proxima-cen-b' });
    expect(first('51 Pegasi b')?.title).toBe('51 Pegasi b');
  });

  it('os objetos do Sistema Solar continuam a aparecer primeiro', () => {
    expect(first('Saturno')?.id).toBe('saturn');
    expect(first('Terra')?.id).toBe('earth');
    expect(first('Io')?.id).toBe('io');
  });
});
