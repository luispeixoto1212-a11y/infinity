import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../app/router';
import { constellationName } from '../data/constellations';
import { SOURCES } from '../data/sources';
import { BLACK_HOLES, schwarzschildRadiusKm } from './deepsky/blackHoles';
import { formatHorizon } from './deepsky/BlackHolesPage';
import { formatDec, formatLightYears, formatRa, parseDeepSky, physicalSizeLy } from './deepsky/deepSkyData';
import { sortDeepSky } from './deepsky/DeepSkyPage';
import { milkyWayLevel, parseBrightStars, parseSkyMap } from './deepsky/skyMapData';
import { SKY_HEIGHT, SKY_WIDTH, eclipticPoints, polylinePaths, project, unproject } from './deepsky/skyProjection';
import { ARCHIVE_CHECK } from './exoplanets/archiveCheck';
import { parseCatalog } from './exoplanets/exoplanetData';
import { buildIndex, search } from './search/searchIndex';
import { deepSkyEntries, starEntries } from './search/spaceIndex';
import { HIPPARCOS_CHECK } from './stars/hipparcosCheck';
import { luminosityClass, parseStars, spectralClass, temperatureFromColor, visualLuminosity } from './stars/starData';
import { describeSpectralType, filterStars, sortStars } from './stars/starView';
import { ptPT } from '../i18n/pt-PT';

const json = (path: string) => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'));
const dso = parseDeepSky(json('deepsky.json'));
const stars = parseStars(json('star-catalog.json'));
const m = (n: number) => dso.find((o) => o.m === n)!;
const star = (slug: string) => stars.find((s) => s.slug === slug)!;

describe('projeção do mapa do céu (Hammer–Aitoff)', () => {
  it('o centro do mapa fica a 12 h e a ascensão reta cresce para a esquerda', () => {
    const c = project(180, 0);
    expect(c.x).toBeCloseTo(0, 12);
    expect(c.y).toBeCloseTo(0, 12);
    expect(project(270, 0).x).toBeLessThan(0);
    expect(project(90, 0).x).toBeGreaterThan(0);
    expect(project(180, 90).y).toBeCloseTo(-Math.SQRT2, 9);
    expect(project(180, -90).y).toBeCloseTo(Math.SQRT2, 9);
  });

  it('a projeção inversa devolve as coordenadas originais', () => {
    for (let ra = 1; ra < 360; ra += 37) {
      for (let dec = -85; dec <= 85; dec += 17) {
        const p = project(ra, dec);
        const back = unproject(p.x, p.y)!;
        expect(back.ra, `${ra} ${dec}`).toBeCloseTo(ra, 6);
        expect(back.dec, `${ra} ${dec}`).toBeCloseTo(dec, 6);
      }
    }
    expect(unproject(SKY_WIDTH, 0)).toBeNull();
    expect(unproject(0, SKY_HEIGHT)).toBeNull();
  });

  it('corta as linhas que atravessam a margem do mapa (0 h)', () => {
    expect(polylinePaths([[340, 0], [350, 0], [10, 0], [20, 0]])).toHaveLength(2);
    expect(polylinePaths([[100, 0], [110, 5], [120, 10]])).toHaveLength(1);
  });

  it('a eclíptica atinge a obliquidade da Terra no solstício', () => {
    const pts = eclipticPoints(1);
    const top = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(top[1]).toBeCloseTo(23.4393, 3);
    expect(top[0]).toBeCloseTo(90, 6);
  });
});

describe('dados do mapa do céu', () => {
  it('as linhas e as etiquetas cobrem as 88 constelações com nomes portugueses', () => {
    const map = parseSkyMap(json('sky-map.json'));
    // A Serpente tem duas partes (cabeça e cauda), cada uma com a sua etiqueta
    expect(new Set(map.labels.map(([abbr]) => abbr)).size).toBe(88);
    for (const [abbr] of map.labels) expect(constellationName(abbr), abbr).not.toBe(abbr);
    expect(Object.keys(map.lines).length).toBeGreaterThanOrEqual(88);
  });

  it('as estrelas do mapa vêm do catálogo da aplicação até à magnitude 4,5', () => {
    const bright = parseBrightStars(json('stars.json'));
    expect(bright.length).toBeGreaterThan(500);
    expect(bright.every((s) => s.mag <= 4.5)).toBe(true);
    const brightest = bright.reduce((a, b) => (b.mag < a.mag ? b : a));
    expect(brightest.name).toBe('Sirius');
  });

  it('a amostragem da Via Láctea interpola e dá a volta às 0 h', () => {
    const levels = new Uint8Array(4 * 2);
    levels[0] = 4; // célula junto às 24 h (x = 0)
    levels[3] = 2; // célula junto às 0 h (x = 3)
    const grid = { width: 4, height: 2, levels };
    expect(milkyWayLevel(grid, 360 - 45, 45)).toBeCloseTo(4, 6); // centro da célula x = 0
    // Exatamente na margem (0 h): metade de cada lado
    expect(milkyWayLevel(grid, 0, 45)).toBeCloseTo(3, 6);
  });
});

describe('catálogo Messier', () => {
  it('tem os 110 objetos: 89 com distância da NASA e 13 enxames abertos com distância da Gaia', () => {
    expect(dso).toHaveLength(110);
    expect(dso.filter((o) => o.distanceSource === 'nasa').length).toBe(89);
    expect(dso.filter((o) => o.distanceSource === 'gaia-cg2020').map((o) => o.m)).toEqual([6, 18, 21, 23, 34, 36, 37, 38, 39, 41, 47, 50, 93]);
    expect(dso.filter((o) => o.distanceSource === 'gaia-cg2020').every((o) => o.subtype === 'open')).toBe(true);
    // Sem distância: M25, M26, M29, M40, M52, M73, M97, M103
    expect(dso.filter((o) => !o.distanceLy).map((o) => o.m)).toEqual([25, 26, 29, 40, 52, 73, 97, 103]);
    expect(new Set(dso.map((o) => o.id)).size).toBe(110);
  });

  it('valores de referência das páginas da NASA', () => {
    expect(m(31).distanceLy).toBe(2_500_000);
    expect(m(42).distanceLy).toBe(1500);
    expect(m(45).distanceLy).toBe(445);
    expect(m(87).distanceLy).toBe(54_000_000);
    expect(m(1).subtype).toBe('snr');
    expect(m(57).subtype).toBe('planetary');
    expect(m(13).subtype).toBe('globular');
    expect(constellationName(m(31).constellation)).toBe('Andrómeda');
  });

  it('a distância NASA de todos os objetos coincide com a transcrição independente das mesmas páginas', () => {
    // Transcrição feita a 2026-10-14 (distância em anos-luz) para verificar scripts/data/messier_nasa.tsv
    const check: Record<number, number> = { 1: 6500, 7: 980, 16: 7000, 24: 10_000, 33: 3_000_000, 51: 31_000_000, 54: 90_000, 76: 3400, 81: 11_600_000, 104: 28_000_000, 110: 2_700_000 };
    for (const [n, ly] of Object.entries(check)) expect(m(Number(n)).distanceLy, `M${n}`).toBe(ly);
  });

  it('ordena por distância e calcula o tamanho real aproximado', () => {
    // Plêiades, Presépio e M7 (NASA); M39 (311 parsecs ≈ 1014 anos-luz, Gaia) é o quarto
    expect(sortDeepSky(dso, 'distance').slice(0, 4).map((o) => o.m)).toEqual([45, 44, 7, 39]);
    expect(m(39).distanceLy).toBe(Math.round(311 * 3.26156));
    const size = physicalSizeLy(m(31))!;
    expect(size).toBeCloseTo(2_500_000 * ((m(31).majorArcmin! / 60) * Math.PI) / 180, 6);
  });

  it('formata coordenadas e distâncias em português', () => {
    expect(formatRa(83.633)).toBe('5 h 34 min 32 s');
    expect(formatDec(22.0145)).toBe('+22° 00′ 52″');
    expect(formatDec(-5.39)).toBe('−5° 23′ 24″');
    expect(formatLightYears(2_500_000)).toBe('2,5 milhões de anos-luz');
    expect(formatLightYears(54_000_000)).toBe('54 milhões de anos-luz');
  });
});

describe('estrelas (AT-HYG)', () => {
  it('nomes e endereços únicos; o Sol não está incluído', () => {
    expect(stars.length).toBeGreaterThan(450);
    expect(new Set(stars.map((s) => s.slug)).size).toBe(stars.length);
    expect(stars.some((s) => s.name === 'Sol')).toBe(false);
  });

  it('as distâncias coincidem com as paralaxes do Hipparcos consultadas diretamente', () => {
    for (const [hip, plx, err] of HIPPARCOS_CHECK) {
      const s = stars.find((x) => x.hip === hip);
      expect(s, `HIP ${hip}`).toBeDefined();
      const dHip = 1000 / plx;
      // Para as estrelas com distância da Gaia, a diferença tem de caber no erro do Hipparcos
      const tol = s!.distSource === 'hipparcos' ? 0.01 : Math.max(0.01, (2 * err) / plx);
      expect(Math.abs(s!.distPc! / dHip - 1), `${s!.name}`).toBeLessThan(tol);
    }
  });

  it('a mais próxima é Proxima Centauri e a mais brilhante é Sírio', () => {
    expect(sortStars(stars, 'distance', constellationName)[0]!.name).toBe('Proxima Centauri');
    expect(sortStars(stars.filter((s) => s.hasProperName), 'mag', constellationName)[0]!.name).toBe('Sirius');
  });

  it('classifica os tipos espectrais', () => {
    expect(spectralClass('M2Ib')).toBe('M');
    expect(luminosityClass('M2Ib')).toBe('Ib');
    expect(luminosityClass('G2V')).toBe('V');
    expect(luminosityClass('K0IIIvar')).toBe('III');
    expect(describeSpectralType('M2Ib', ptPT.space.spectralClasses, ptPT.space.luminosityClasses)).toBe(
      'Estrela vermelha e fria (classe M), supergigante menos luminosa',
    );
  });

  it('temperatura a partir da cor e luminosidade a partir da magnitude absoluta', () => {
    expect(temperatureFromColor(0.656)!).toBeGreaterThan(5600);
    expect(temperatureFromColor(0.656)!).toBeLessThan(6000);
    expect(temperatureFromColor(3)).toBeUndefined();
    expect(visualLuminosity(4.83)).toBeCloseTo(1, 9);
    expect(visualLuminosity(-0.17)).toBeCloseTo(100, 6);
  });

  it('pesquisa por nome, designação grega por extenso ou número de catálogo', () => {
    expect(filterStars(stars, 'alpha orionis').map((s) => s.slug)).toContain('betelgeuse');
    expect(filterStars(stars, 'hip 32349')[0]!.slug).toBe('sirius');
    expect(filterStars(stars, 'VÉGA').map((s) => s.slug)).toContain('vega'); // sem acentos nem maiúsculas
    expect(filterStars(stars, 'vega').map((s) => s.slug)).toContain('vega');
  });

  it('Sírio está a cerca de 8,6 anos-luz', () => {
    expect(star('sirius').distPc! * 3.26156).toBeCloseTo(8.6, 1);
  });
});

describe('buracos negros', () => {
  it('raio de Schwarzschild a partir da massa', () => {
    expect(schwarzschildRadiusKm(1)).toBeCloseTo(2.953, 3);
    const sgr = BLACK_HOLES.find((b) => b.id === 'sgr-a')!;
    expect(schwarzschildRadiusKm(sgr.massSun!) / 1e6).toBeCloseTo(11.8, 1);
    expect(formatHorizon(schwarzschildRadiusKm(6.5e9))).toBe('130 UA');
    expect(formatHorizon(schwarzschildRadiusKm(21.2))).toBe('63 km');
  });

  it('cada buraco negro tem fontes que existem', () => {
    for (const b of BLACK_HOLES) {
      expect(b.sources.length, b.id).toBeGreaterThan(0);
      for (const s of b.sources) expect(SOURCES[s], `${b.id}: ${s}`).toBeDefined();
    }
  });
});

describe('exoplanetas: cópia do arquivo verificada contra consultas diretas', () => {
  it('período, semieixo, raio, massa e ano coincidem com a API TAP do NASA Exoplanet Archive', () => {
    const catalog = parseCatalog(json('exoplanets.json'));
    const MJ = 317.828; // massas terrestres por massa de Júpiter
    const RJ = 11.209; // raios terrestres por raio de Júpiter
    for (const [name, per, a, rade, masse, , year] of ARCHIVE_CHECK) {
      const p = catalog.planets.find((x) => x.name === name);
      expect(p, name).toBeDefined();
      expect(Math.abs(p!.period! / per - 1), `${name} período`).toBeLessThan(1e-4);
      expect(Math.abs(p!.a! / a - 1), `${name} semieixo`).toBeLessThan(1e-3);
      expect(Math.abs((p!.radiusJ! * RJ) / rade - 1), `${name} raio`).toBeLessThan(0.01);
      expect(Math.abs((p!.massJ! * MJ) / masse - 1), `${name} massa`).toBeLessThan(0.01);
      expect(p!.year, `${name} ano`).toBe(year);
    }
  });
});

describe('pesquisa e rotas do espaço profundo', () => {
  const index = buildIndex(undefined, [...deepSkyEntries(dso), ...starEntries(stars)]);
  const first = (q: string) => search(index, q)[0]?.entry.id;

  it('encontra objetos Messier pelo número, nome português, inglês ou NGC', () => {
    expect(first('M31')).toBe('dso:m31');
    expect(first('Plêiades')).toBe('dso:m45');
    expect(first('Crab Nebula')).toBe('dso:m1');
    expect(first('NGC 224')).toBe('dso:m31');
    expect(first('Messier 104')).toBe('dso:m104');
  });

  it('encontra estrelas com nome e as secções', () => {
    expect(first('Betelgeuse')).toBe('star:betelgeuse');
    expect(first('buracos negros')).toBe('page:black-holes');
    expect(first('Sírio')).not.toBe('star:sirius'); // o nome IAU é "Sirius"
    expect(first('Sirius')).toBe('star:sirius');
  });

  it('rotas', () => {
    expect(parseHash('#/espaco-profundo')).toEqual({ name: 'deep-sky' });
    expect(parseHash('#/espaco-profundo/m42')).toEqual({ name: 'deep-sky-object', id: 'm42' });
    expect(parseHash('#/estrelas/vega')).toEqual({ name: 'star', slug: 'vega' });
    expect(parseHash('#/buracos-negros')).toEqual({ name: 'black-holes' });
    expect(routeToHash({ name: 'star', slug: 'sirius' })).toBe('#/estrelas/sirius');
  });
});
