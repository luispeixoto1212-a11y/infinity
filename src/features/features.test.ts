import { describe, expect, it } from 'vitest';
import { buildIndex, editDistance, normalize, search } from './search/searchIndex';
import { formatFact, formatDurationSeconds } from './body/formatFact';
import { barWidths, comparisonRows } from './body/EarthComparison';
import { getBody, getFact } from '../data/catalog';
import { parseHash, routeToHash, type Route } from '../app/router';
import { formatNumber, formatScientific } from '../core/format';
import { SPEEDS, clampSpeedIndex, rateFor } from './explorer/timeControl';

describe('pesquisa', () => {
  const index = buildIndex();
  const first = (q: string) => search(index, q)[0]?.entry.id;

  it('normaliza acentos e maiúsculas', () => {
    expect(normalize('  JÚPITER ')).toBe('jupiter');
    expect(normalize('Vénus')).toBe('venus');
  });

  it('encontra nomes portugueses, ingleses e espanhóis', () => {
    expect(first('jupiter')).toBe('jupiter');
    expect(first('Vénus')).toBe('venus');
    expect(first('Moon')).toBe('moon');
    expect(first('Plutón')).toBe('pluto');
    expect(first('sun')).toBe('sun');
    expect(first('urano')).toBe('uranus');
  });

  it('aceita prefixos e pequenos erros de escrita', () => {
    expect(first('satur')).toBe('saturn');
    expect(first('netuno')).toBe('neptune');
    expect(first('saturo')).toBe('saturn');
    expect(first('mrate')).toBe('mars');
  });

  it('encontra as luas pelos nomes em português e em inglês', () => {
    expect(first('Ganímedes')).toBe('ganymede');
    expect(first('Ganymede')).toBe('ganymede');
    expect(first('Tritão')).toBe('triton');
    expect(first('Titan')).toBe('titan');
    expect(first('Caronte')).toBe('charon');
    expect(first('Io')).toBe('io');
    expect(first('encelado')).toBe('enceladus');
    expect(search(index, 'lua galileana').map((r) => r.entry.id)).toEqual(
      expect.arrayContaining(['io', 'europa', 'ganymede', 'callisto']),
    );
  });

  it('em caso de empate, o planeta aparece antes das suas luas', () => {
    expect(first('saturo')).toBe('saturn');
    expect(search(index, 'Saturno')[0]?.entry.id).toBe('saturn');
  });

  it('encontra secções da aplicação', () => {
    expect(first('fontes')).toBe('page:data');
    expect(search(index, 'sistema solar').map((r) => r.entry.id)).toContain('page:solar-system');
  });

  it('devolve lista vazia quando não há correspondência', () => {
    expect(search(index, 'xyzzy')).toEqual([]);
    expect(search(index, '   ')).toEqual([]);
  });

  it('cada resultado de objeto abre a ficha correta', () => {
    const r = search(index, 'Terra')[0]!;
    expect(r.entry.route).toEqual({ name: 'body', slug: 'terra' });
    expect(r.entry.bodyId).toBe('earth');
  });

  it('distância de edição com transposição', () => {
    expect(editDistance('marte', 'mrate')).toBe(1);
    expect(editDistance('saturno', 'saturno')).toBe(0);
  });
});

describe('formatação em português de Portugal', () => {
  it('usa vírgula decimal e espaço nos milhares', () => {
    expect(formatNumber(3.7, 1)).toBe('3,7');
    expect(formatNumber(142984, 0).replace(/\s/g, ' ')).toBe('142 984');
  });

  it('notação científica com expoente em superíndice', () => {
    expect(formatScientific(5.9722e24, 5)).toBe('5,9722 × 10²⁴');
    expect(formatScientific(3e-15, 1)).toBe('3 × 10⁻¹⁵');
  });

  it('formata durações e factos com conversões', () => {
    expect(formatDurationSeconds(499)).toBe('8 min 19 s');
    const venusRot = formatFact(getFact(getBody('venus'), 'siderealRotation')!);
    expect(venusRot.text).toMatch(/^−?-?5832,6 h$/);
    expect(venusRot.secondary).toContain('retrógrada');
    const jupYear = formatFact(getFact(getBody('jupiter'), 'orbitalPeriod')!);
    expect(jupYear.secondary).toBe('≈ 11,86 anos');
    const dist = formatFact(getFact(getBody('earth'), 'meanDistanceSun')!);
    expect(dist.text).toBe('149,6 milhões de km');
    expect(dist.secondary).toBe('≈ 1 UA');
    const ceresDia = formatFact(getFact(getBody('ceres'), 'diameter')!);
    expect(ceresDia.text.startsWith('≈ ')).toBe(true);
  });

  it('formata os dados das luas', () => {
    // Incerteza com pelo menos um algarismo significativo e o valor com as mesmas casas decimais
    expect(formatFact(getFact(getBody('phobos'), 'diameter')!).text).toBe('22,16 ± 0,08 km');
    expect(formatFact(getFact(getBody('io'), 'diameter')!).text).toBe('3643 ± 1 km');
    // Intervalo com valores negativos usa "a" em vez de hífen
    expect(formatFact(getFact(getBody('rhea'), 'temperatureRange')!).text).toMatch(/^[−-]220 a [−-]174 °C$/);
    const triton = formatFact(getFact(getBody('triton'), 'siderealRotation')!);
    expect(triton.secondary).toContain('retrógrada');
    expect(formatFact(getFact(getBody('mimas'), 'orbitalPeriod')!).text).toBe('0,9424 dias');
  });
});

describe('comparação com a Terra', () => {
  it('calcula razões a partir dos dados', () => {
    const rows = comparisonRows(getBody('jupiter'), getBody('earth'));
    const dia = rows.find((r) => r.key === 'diameter')!;
    expect(dia.ratio).toBeCloseTo(142984 / 12756, 6);
  });

  it('usa escala linear para diferenças pequenas e logarítmica para grandes', () => {
    expect(barWidths(2)).toEqual({ body: 1, earth: 0.5, log: false });
    expect(barWidths(318).log).toBe(true);
    expect(barWidths(0.0022).log).toBe(true);
  });

  it('não compara o período orbital da Lua com o ano terrestre', () => {
    expect(comparisonRows(getBody('moon'), getBody('earth')).some((r) => r.key === 'orbitalPeriod')).toBe(false);
  });
});

describe('router', () => {
  const routes: Route[] = [
    { name: 'explore' },
    { name: 'explore', focus: 'saturno' },
    { name: 'solar-system' },
    { name: 'body', slug: 'marte' },
    { name: 'favorites' },
    { name: 'data' },
    { name: 'exoplanets' },
    { name: 'exoplanet', slug: 'trappist-1-e' },
  ];

  it.each(routes)('ida e volta de %o', (r) => {
    expect(parseHash(routeToHash(r))).toEqual(r);
  });

  it('rotas desconhecidas dão "não encontrada"', () => {
    expect(parseHash('#/galaxias-perdidas').name).toBe('not-found');
    expect(parseHash('#/exoplaneta').name).toBe('not-found');
    expect(parseHash('#/exoplanetas/x').name).toBe('not-found');
    expect(parseHash('#/objeto').name).toBe('not-found');
    expect(parseHash('#/objeto/marte/extra').name).toBe('not-found');
    expect(parseHash('').name).toBe('explore');
  });
});

describe('controlo do tempo', () => {
  it('velocidades crescentes e limites', () => {
    for (let i = 1; i < SPEEDS.length; i += 1) expect(SPEEDS[i]!.daysPerSecond).toBeGreaterThan(SPEEDS[i - 1]!.daysPerSecond);
    expect(clampSpeedIndex(-3)).toBe(0);
    expect(clampSpeedIndex(99)).toBe(SPEEDS.length - 1);
    expect(rateFor(0, 1)).toBeCloseTo(1 / 86400, 12);
    expect(rateFor(3, -1)).toBe(-1);
  });
});
