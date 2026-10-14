import { describe, expect, it } from 'vitest';
import { parseHash } from '../../app/router';
import { COSMIC_EVENTS } from './cosmicEvents';
import { AGE_YEARS, coordinate, cosmicCalendar, formatSinceBigBang, formatYears, fullDomain, ticksFor, timeEvent } from './timeScale';

describe('linha temporal do Universo', () => {
  const events = COSMIC_EVENTS.map(timeEvent);

  it('tem acontecimentos de todas as categorias pedidas, com identificadores únicos', () => {
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    for (const c of ['cosmos', 'galaxies', 'solar-system', 'life', 'astronomy', 'space']) {
      expect(events.filter((e) => e.category === c).length, c).toBeGreaterThanOrEqual(3);
    }
  });

  it('todos os tempos são coerentes: entre o Big Bang e hoje', () => {
    for (const e of events) {
      expect(e.seconds, e.id).toBeGreaterThan(0);
      expect(e.yearsAgo, e.id).toBeGreaterThanOrEqual(0);
      expect(e.yearsAgo, e.id).toBeLessThanOrEqual(AGE_YEARS);
    }
  });

  it('a ordem cronológica bate certo com o conhecimento estabelecido', () => {
    const t = (id: string) => events.find((e) => e.id === id)!.seconds;
    const order = ['planck-era', 'inflation', 'hadrons', 'bbn', 'equality', 'cmb', 'first-stars', 'mom-z14', 'jades-z14', 'reionization', 'gaia-enceladus', 'solar-system', 'earth', 'moon', 'zircon', 'first-life', 'goe', 'cambrian', 'kpg', 'homo-sapiens', 'copernicus', 'sputnik', 'artemis2'];
    for (let i = 1; i < order.length; i++) expect(t(order[i]!), `${order[i - 1]} < ${order[i]}`).toBeGreaterThan(t(order[i - 1]!));
  });

  it('a radiação de fundo fica a ~372 mil anos e o Sistema Solar a 4567 milhões de anos atrás', () => {
    const cmb = events.find((e) => e.id === 'cmb')!;
    expect(cmb.seconds / 31_557_600 / 1e3).toBeCloseTo(372, -1);
    const ss = events.find((e) => e.id === 'solar-system')!;
    expect(ss.yearsAgo).toBe(4.5673e9);
  });

  it('as coordenadas de cada escala ficam dentro do domínio completo', () => {
    for (const mode of ['early', 'history', 'linear'] as const) {
      const [a, b] = fullDomain(mode);
      for (const e of events) {
        const v = coordinate(e, mode);
        expect(v, `${mode} ${e.id}`).toBeGreaterThanOrEqual(a);
        expect(v, `${mode} ${e.id}`).toBeLessThanOrEqual(b);
      }
    }
  });

  it('gera marcas legíveis nos três modos', () => {
    expect(ticksFor('early', ...fullDomain('early')).length).toBeGreaterThan(3);
    expect(ticksFor('history', ...fullDomain('history')).map((t) => t.label)).toContain('há 10 mil M');
    const lin = ticksFor('linear', ...fullDomain('linear'));
    expect(lin.some((t) => t.label === 'hoje')).toBe(true);
  });

  it('calendário cósmico: o Sistema Solar no fim de agosto/início de setembro e o Homo sapiens no último quarto de hora', () => {
    expect(cosmicCalendar(4.5673e9).text).toMatch(/(agosto|setembro)/);
    const hs = cosmicCalendar(300e3);
    expect(hs.secondsBeforeMidnight).toBeLessThan(15 * 60);
    expect(cosmicCalendar(0).secondsBeforeMidnight).toBeCloseTo(0, 6);
  });

  it('formata tempos em português', () => {
    expect(formatYears(13.787e9)).toBe('13,8 mil milhões de anos');
    expect(formatYears(4.5673e9)).toBe('4,57 mil milhões de anos');
    expect(formatYears(372e3)).toBe('372 mil anos');
    expect(formatSinceBigBang(1e-36)).toBe('10⁻³⁶ s');
    expect(formatSinceBigBang(180)).toBe('3 minutos');
  });

  it('rota #/linha-temporal', () => {
    expect(parseHash('#/linha-temporal')).toEqual({ name: 'timeline' });
  });
});
