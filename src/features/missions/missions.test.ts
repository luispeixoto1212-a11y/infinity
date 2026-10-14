import { describe, expect, it } from 'vitest';
import { findBodyBySlug } from '../../data/catalog';
import { findSmallBody } from '../../data/smallBodies';
import { parseHash, routeToHash } from '../../app/router';
import { MISSIONS, MISSIONS_CHECKED, decimalYear, findMission, formatMissionDate } from './missionsData';

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

describe('missões espaciais: coerência dos dados', () => {
  it('tem as missões pedidas (Apollo, Voyager, Hubble, Webb, Cassini, New Horizons, rovers, Parker, asteroides)', () => {
    for (const id of ['apollo-11', 'voyager-1', 'voyager-2', 'hubble', 'jwst', 'cassini-huygens', 'new-horizons', 'curiosity', 'perseverance', 'mer', 'parker-solar-probe', 'osiris-rex', 'dart', 'hera', 'lucy', 'psyche']) {
      expect(findMission(id), id).toBeDefined();
    }
  });

  it('identificadores únicos e datas no formato AAAA[-MM[-DD]]', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) {
      expect(m.launch, m.id).toMatch(DATE);
      if (m.end) expect(m.end, m.id).toMatch(DATE);
      if (m.plannedUntil) expect(m.plannedUntil, m.id).toMatch(DATE);
      for (const e of m.events) expect(e.date, `${m.id}: ${e.text}`).toMatch(DATE);
    }
  });

  it('a cronologia de cada missão está por ordem e começa no lançamento', () => {
    for (const m of MISSIONS) {
      const years = m.events.map((e) => decimalYear(e.date));
      for (let i = 1; i < years.length; i++) expect(years[i]!, m.id).toBeGreaterThanOrEqual(years[i - 1]!);
      if (m.end) expect(decimalYear(m.end), m.id).toBeGreaterThanOrEqual(decimalYear(m.launch));
    }
  });

  it('os acontecimentos marcados como previstos são futuros e os restantes já ocorreram', () => {
    const today = decimalYear(MISSIONS_CHECKED);
    for (const m of MISSIONS) {
      for (const e of m.events) {
        if (e.planned) expect(decimalYear(e.date), `${m.id}: ${e.text}`).toBeGreaterThan(today - 0.1);
        else expect(decimalYear(e.date), `${m.id}: ${e.text}`).toBeLessThanOrEqual(today);
      }
    }
  });

  it('missões em curso ou futuras indicam a fonte do estado; concluídas têm data de fim', () => {
    for (const m of MISSIONS) {
      if (m.status === 'completed') expect(m.end, m.id).toBeDefined();
      else expect(m.statusSource, m.id).toBeDefined();
      if (m.status === 'planned') expect(decimalYear(m.launch), m.id).toBeGreaterThan(decimalYear(MISSIONS_CHECKED));
    }
  });

  it('todas as fontes têm endereço https e as fichas relacionadas existem', () => {
    for (const m of MISSIONS) {
      expect(m.sources.length, m.id).toBeGreaterThan(0);
      for (const s of [...m.sources, ...(m.statusSource ? [m.statusSource] : [])]) expect(s.url, m.id).toMatch(/^https:\/\//);
      for (const slug of m.bodies) expect(findBodyBySlug(slug) ?? findSmallBody(slug), `${m.id} → ${slug}`).toBeDefined();
    }
  });
});

describe('missões espaciais: datas e rotas', () => {
  it('formata datas com a precisão disponível', () => {
    expect(formatMissionDate('1969-07-20')).toBe('20 de julho de 1969');
    expect(formatMissionDate('2027-08')).toBe('agosto de 2027');
    expect(formatMissionDate('2028')).toBe('2028');
  });

  it('converte datas em anos decimais', () => {
    expect(decimalYear('2000-01-01')).toBeCloseTo(2000, 6);
    expect(decimalYear('2026-10-14')).toBeCloseTo(2026.786, 2);
    expect(decimalYear('2028')).toBeCloseTo(2028.5, 1);
  });

  it('rotas #/missoes e #/missoes/<id>', () => {
    expect(parseHash('#/missoes')).toEqual({ name: 'missions' });
    expect(parseHash('#/missoes/voyager-1')).toEqual({ name: 'mission', id: 'voyager-1' });
    expect(routeToHash({ name: 'mission', id: 'hubble' })).toBe('#/missoes/hubble');
  });
});
