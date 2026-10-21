import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../../app/router';
import { parseStars } from '../stars/starData';
import {
  DEFAULT_FILTER,
  distancePc,
  galacticLonLat,
  inLuminosityBin,
  nearestVisible,
  parseStarMap,
  searchStarMap,
  spectralGroup,
  visibleMask,
} from './starMapData';

const data = parseStarMap(JSON.parse(readFileSync('public/data/star-map.json', 'utf8')));
const stars = parseStars(JSON.parse(readFileSync('public/data/star-catalog.json', 'utf8')));
const DEG = Math.PI / 180;

/**
 * Conversão independente da matriz usada no script: fórmulas esféricas com o polo norte galáctico em
 * α = 192,85948°, δ = 27,12825° e a longitude do polo norte celeste l = 122,93192° (J2000).
 */
function galacticFromRaDec(raDeg: number, decDeg: number) {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  const aP = 192.85948 * DEG;
  const dP = 27.12825 * DEG;
  const lNcp = 122.93192 * DEG;
  const sinB = Math.sin(d) * Math.sin(dP) + Math.cos(d) * Math.cos(dP) * Math.cos(a - aP);
  const b = Math.asin(sinB);
  const y = Math.cos(d) * Math.sin(a - aP);
  const x = Math.sin(d) * Math.cos(dP) - Math.cos(d) * Math.sin(dP) * Math.cos(a - aP);
  const l = (lNcp - Math.atan2(y, x)) / DEG;
  return { l: ((l % 360) + 360) % 360, b: b / DEG };
}

describe('mapa estelar: dados', () => {
  it('estrelas a menos de 100 pc, com a maioria das distâncias da Gaia DR3', () => {
    expect(data.n).toBeGreaterThan(20000);
    let max = 0;
    for (let i = 0; i < data.n; i += 1) max = Math.max(max, distancePc(data, i));
    expect(max).toBeLessThanOrEqual(100.001);
    const gaia = data.distSrc.filter((s) => s === 'gaia-dr3').length;
    expect(gaia / data.n).toBeGreaterThan(0.9);
  });

  it('as posições coincidem com a ascensão reta, declinação e distância do catálogo de estrelas', () => {
    const byId = new Map(stars.map((s) => [s.id, s]));
    let checked = 0;
    for (let i = 0; i < data.n; i += 1) {
      const s = byId.get(data.catalogId[i]!);
      if (!s || s.ra === undefined || s.dec === undefined || s.distPc === undefined) continue;
      expect(Math.abs(distancePc(data, i) - s.distPc), s.name).toBeLessThan(0.002 + s.distPc * 1e-4);
      const ref = galacticFromRaDec(s.ra, s.dec);
      const got = galacticLonLat(data, i);
      // As posições estão guardadas ao milésimo de parsec: nas estrelas mais próximas isso equivale a centésimos de grau
      const tol = 0.005 + 0.0015 / s.distPc / DEG;
      expect(Math.abs(got.b - ref.b), s.name).toBeLessThan(tol);
      // Perto dos polos galácticos a longitude é mal definida
      if (Math.abs(ref.b) < 80) expect(Math.abs(((got.l - ref.l + 540) % 360) - 180), s.name).toBeLessThan(tol / Math.cos(ref.b * DEG));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('as estrelas mais próximas e as ligações às fichas', () => {
    const all = visibleMask(data, DEFAULT_FILTER);
    expect(all.reduce((a, v) => a + v, 0)).toBe(data.n);
    const first = nearestVisible(data, all, 3).map((i) => data.des[i]);
    expect(first[0]).toBe('Proxima Centauri');
    const prox = stars.find((s) => s.name === 'Proxima Centauri')!;
    expect(data.catalogId[nearestVisible(data, all, 1)[0]!]).toBe(prox.id);
    expect(data.des[searchStarMap(data, 'siri')[0]!]).toBe('Sirius');
  });
});

describe('mapa estelar: filtros e rotas', () => {
  it('distância, tipo espectral e luminosidade', () => {
    const near = visibleMask(data, { ...DEFAULT_FILTER, maxPc: 5 });
    for (let i = 0; i < data.n; i += 1) if (near[i]) expect(distancePc(data, i)).toBeLessThanOrEqual(5);
    const nNear = near.reduce((a, v) => a + v, 0);
    expect(nNear).toBeGreaterThan(20);
    expect(nNear).toBeLessThan(200);
    const onlyG = visibleMask(data, { ...DEFAULT_FILTER, groups: new Set(['G']) });
    for (let i = 0; i < data.n; i += 1) if (onlyG[i]) expect(spectralGroup(data.spect[i] ?? null)).toBe('G');
    expect(spectralGroup('B9.5V')).toBe('OB');
    expect(spectralGroup('DA2')).toBe('other');
    expect(spectralGroup('sdM4')).toBe('M');
    expect(inLuminosityBin(150, 'gt100')).toBe(true);
    expect(inLuminosityBin(1, '0.01to1')).toBe(true);
    expect(inLuminosityBin(undefined, 'all')).toBe(true);
    expect(inLuminosityBin(undefined, 'lt0.01')).toBe(false);
  });

  it('rotas do mapa', () => {
    expect(parseHash('#/mapa-estelar')).toEqual({ name: 'star-map' });
    expect(parseHash('#/mapa-estelar/sirius')).toEqual({ name: 'star-map', slug: 'sirius' });
    expect(routeToHash({ name: 'star-map', slug: 'vega' })).toBe('#/mapa-estelar/vega');
  });
});
