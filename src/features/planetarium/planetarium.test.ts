import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { radecToUnit } from '../../core/astro/orientation';
import { dateToJulianDayUtc } from '../../core/astro/time';
import {
  PLACES,
  formatLatLon,
  formatUtcOffset,
  parseDateTimeLocalValue,
  startOfLocalDay,
  timeZoneOffsetMinutes,
  toDateTimeLocalValue,
  wallTimeIn,
  wallTimeToDate,
} from './places';
import { DOME_VIEW, makeProjector, projectVec, starRadius, unprojectScreen } from './skyRenderer';
import { type SkyScene, densifyBoundaryRing, parseSceneStars, resolveTarget } from './skyScene';
import { analyzeNight, compassPoint, computeSkyInstant, twilightMagnitudeLimit } from './skyState';

const LISBON = { latDeg: 38.7223, lonDeg: -9.1393 };

describe('fusos horários e hora local', () => {
  it('converte hora de Lisboa no inverno e no verão', () => {
    expect(wallTimeToDate({ year: 2026, month: 1, day: 15, hour: 21, minute: 0 }, 'Europe/Lisbon').toISOString()).toBe('2026-01-15T21:00:00.000Z');
    expect(wallTimeToDate({ year: 2026, month: 7, day: 15, hour: 21, minute: 0 }, 'Europe/Lisbon').toISOString()).toBe('2026-07-15T20:00:00.000Z');
  });

  it('trata os Açores, Sydney e o Rio de Janeiro', () => {
    expect(wallTimeToDate({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 }, 'Atlantic/Azores').toISOString()).toBe('2026-01-01T01:00:00.000Z');
    expect(wallTimeToDate({ year: 2026, month: 1, day: 1, hour: 12, minute: 0 }, 'Australia/Sydney').toISOString()).toBe('2026-01-01T01:00:00.000Z');
    expect(timeZoneOffsetMinutes(new Date('2026-10-14T12:00:00Z'), 'America/Sao_Paulo')).toBe(-180);
  });

  it('uma hora inexistente (mudança para a hora de verão) avança e a conversão inversa é coerente', () => {
    // Em Lisboa, a 2026-03-29 os relógios passam da 01:00 para as 02:00
    const d = wallTimeToDate({ year: 2026, month: 3, day: 29, hour: 1, minute: 30 }, 'Europe/Lisbon');
    const w = wallTimeIn(d, 'Europe/Lisbon');
    expect(w.hour).toBe(2);
    expect(w.minute).toBe(30);
  });

  it('o valor do campo de data e hora faz o caminho de ida e volta', () => {
    const d = new Date('2026-10-14T21:00:00Z');
    const v = toDateTimeLocalValue(d, 'Europe/Lisbon');
    expect(v).toBe('2026-10-14T22:00');
    expect(wallTimeToDate(parseDateTimeLocalValue(v)!, 'Europe/Lisbon').getTime()).toBe(d.getTime());
    expect(parseDateTimeLocalValue('2026-13-01T00:00')).toBeNull();
    expect(parseDateTimeLocalValue('lixo')).toBeNull();
  });

  it('formata desvios e coordenadas em pt-PT', () => {
    expect(formatUtcOffset(60)).toBe('UTC+1');
    expect(formatUtcOffset(-180)).toBe('UTC−3');
    expect(formatUtcOffset(330)).toBe('UTC+5:30');
    expect(formatUtcOffset(0)).toBe('UTC');
    expect(formatLatLon(38.7223, -9.1393)).toBe('38,72° N, 9,14° O');
  });

  it('o início do dia local é a meia-noite local', () => {
    const s = startOfLocalDay(new Date('2026-10-14T23:30:00Z'), 'Europe/Lisbon');
    expect(s.toISOString()).toBe('2026-10-14T23:00:00.000Z');
  });

  it('todos os lugares predefinidos têm coordenadas e fusos válidos', () => {
    for (const p of PLACES) {
      expect(Math.abs(p.latDeg)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lonDeg)).toBeLessThanOrEqual(180);
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: p.timeZone })).not.toThrow();
    }
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
  });
});

describe('projeção estereográfica', () => {
  it('na cúpula, o zénite fica ao centro, o norte em cima e o este à esquerda', () => {
    const p = makeProjector(DOME_VIEW, 800, 600);
    const zen = projectVec(p, 0, 0, 1)!;
    expect(zen.x).toBeCloseTo(400, 6);
    expect(zen.y).toBeCloseTo(300, 6);
    const north = projectVec(p, 0, 1, 0)!;
    const east = projectVec(p, 1, 0, 0)!;
    expect(north.y).toBeLessThan(300);
    expect(Math.abs(north.x - 400)).toBeLessThan(1e-6);
    expect(east.x).toBeLessThan(400);
    // O horizonte toca a margem (16 px) da menor dimensão
    expect(300 - north.y).toBeCloseTo(284, 6);
  });

  it('projetar e desprojetar devolve a mesma direção', () => {
    const p = makeProjector({ azDeg: 123, altDeg: 30, fovDeg: 70 }, 1024, 700);
    for (const [x, y] of [
      [100, 100],
      [512, 350],
      [900, 650],
    ] as const) {
      const v = unprojectScreen(p, x, y);
      expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 9);
      const q = projectVec(p, v.x, v.y, v.z)!;
      expect(q.x).toBeCloseTo(x, 6);
      expect(q.y).toBeCloseTo(y, 6);
    }
  });

  it('as estrelas brilhantes são maiores do que as ténues', () => {
    expect(starRadius(-1.4, 90)).toBeGreaterThan(starRadius(2, 90));
    expect(starRadius(2, 90)).toBeGreaterThan(starRadius(6, 90));
    expect(starRadius(6, 90)).toBeGreaterThan(0.5);
  });
});

describe('estado do céu e noite', () => {
  it('o Sol está abaixo do horizonte às 22:00 de Lisboa e acima ao meio-dia', () => {
    const night = computeSkyInstant(new Date('2026-10-14T21:00:00Z'), LISBON);
    expect(night.sunAltDeg).toBeLessThan(-18);
    expect(night.twilight).toBe('night');
    const noon = computeSkyInstant(new Date('2026-10-14T12:23:00Z'), LISBON);
    expect(noon.sunAltDeg).toBeGreaterThan(42);
    expect(noon.twilight).toBe('day');
    // Ao meio-dia solar o Sol está a sul
    expect(Math.abs(noon.bodies.find((b) => b.id === 'sun')!.azDeg - 180)).toBeLessThan(2);
  });

  it('analisa a noite de 14 para 15 de outubro de 2026 em Lisboa', () => {
    const noon = dateToJulianDayUtc(new Date('2026-10-14T11:00:00Z'));
    const r = analyzeNight(noon, LISBON);
    // Horizons: pôr do Sol às 18:00 UT
    expect(Math.abs((r.sunset! - noon) * 1440 - 7 * 60)).toBeLessThan(3);
    expect(r.darkFrom).not.toBeNull();
    expect(r.windows.saturn).toBeDefined();
    expect(r.windows.venus).toBeUndefined(); // Vénus está a 24° do Sol, perto da conjunção inferior
    expect(r.noDarkness).toBe(false);
  });

  it('reconhece as noites brancas no Polo Norte em junho e a noite polar em dezembro', () => {
    const pole = { latDeg: 89.9, lonDeg: 0 };
    expect(analyzeNight(dateToJulianDayUtc(new Date('2026-06-21T12:00:00Z')), pole).noDarkness).toBe(true);
    expect(analyzeNight(dateToJulianDayUtc(new Date('2026-12-21T12:00:00Z')), pole).polarNight).toBe(true);
  });

  it('o limite de magnitude cresce à medida que o Sol desce', () => {
    let prev = -Infinity;
    for (let alt = 10; alt >= -20; alt -= 1) {
      const m = twilightMagnitudeLimit(alt);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
    expect(twilightMagnitudeLimit(-25)).toBe(6.5);
  });

  it('dá o rumo da bússola em português', () => {
    expect(compassPoint(0).long).toBe('norte');
    expect(compassPoint(100).long).toBe('este');
    expect(compassPoint(225).short).toBe('SO');
    expect(compassPoint(350).long).toBe('norte');
  });
});

describe('dados do planetário', () => {
  it('ordena as estrelas do catálogo da mais brilhante para a mais ténue', () => {
    const stars = parseSceneStars(JSON.parse(readFileSync('public/data/stars.json', 'utf8')));
    expect(stars.count).toBeGreaterThan(5000);
    expect(stars.name[0]).toBe('Sirius');
    for (let i = 1; i < stars.count; i++) expect(stars.mag[i]!).toBeGreaterThanOrEqual(stars.mag[i - 1]!);
  });

  it('subdivide os limites das constelações e fecha o anel', () => {
    const pts = densifyBoundaryRing([
      [10, 10],
      [30, 10],
      [30, 20],
      [10, 20],
    ]);
    const n = pts.length / 3;
    expect(n).toBeGreaterThan(40);
    expect(pts[0]).toBeCloseTo(pts[(n - 1) * 3]!, 12);
    // Todos os pontos são vetores unitários
    for (let i = 0; i < n; i++) expect(Math.hypot(pts[i * 3]!, pts[i * 3 + 1]!, pts[i * 3 + 2]!)).toBeCloseTo(1, 9);
  });

  it('resolve os alvos do endereço: planetas, objetos Messier e estrelas', () => {
    const scene = {
      dsos: [{ obj: { id: 'm31' }, v: radecToUnit(10.68, 41.27) }],
      starPages: new Map([[32349, 'sirius']]),
      stars: { count: 2, hip: Int32Array.from([0, 32349]) },
    } as unknown as SkyScene;
    expect(resolveTarget('marte', scene)).toEqual({ kind: 'body', id: 'mars' });
    expect(resolveTarget('lua', scene)).toEqual({ kind: 'body', id: 'moon' });
    expect(resolveTarget('M31', scene)).toEqual({ kind: 'dso', id: 'm31' });
    expect(resolveTarget('sirius', scene)).toEqual({ kind: 'star', index: 1 });
    expect(resolveTarget('terra', scene)).toBeNull();
    expect(resolveTarget('nada', scene)).toBeNull();
  });
});
