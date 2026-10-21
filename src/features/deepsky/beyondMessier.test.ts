import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../../app/router';
import { ConstellationLocator, parseConstellationBounds } from '../../core/astro/constellationLocator';
import { beyondEntries } from '../search/spaceIndex';
import { BEYOND, BEYOND_GROUPS, LY_PER_PC, beyondSources, findBeyond } from './beyondMessier';
import { displayName, isMessier, physicalSizeLy } from './deepSkyData';

describe('espaço profundo para além do Messier: catálogo', () => {
  it('ids, designações curtas e grupos sem repetições', () => {
    expect(BEYOND.length).toBe(18);
    expect(new Set(BEYOND.map((o) => o.id)).size).toBe(BEYOND.length);
    expect(new Set(BEYOND.map((o) => o.label)).size).toBe(BEYOND.length);
    for (const o of BEYOND) {
      // Não podem colidir com os endereços dos objetos Messier (#/espaco-profundo/m31)
      expect(o.id, o.id).not.toMatch(/^m\d+$/);
      expect(isMessier(o)).toBe(false);
      expect(displayName(o)).toBe(o.namePt);
    }
    expect(BEYOND_GROUPS.flatMap((g) => g.ids).sort()).toEqual(BEYOND.map((o) => o.id).sort());
  });

  it('cada objeto tem descrição, destaques e fontes com ligação', () => {
    for (const o of BEYOND) {
      expect(o.description.length, o.id).toBeGreaterThan(120);
      expect(o.highlights.length, o.id).toBeGreaterThanOrEqual(2);
      for (const s of beyondSources(o)) expect(s.url, `${o.id}: ${s.title}`).toMatch(/^https:\/\//);
      // Ou há distância com fonte, ou a ficha explica porque não a indica
      expect(Boolean(o.distance) !== Boolean(o.distanceMissing), o.id).toBe(true);
      if (o.mag !== undefined) expect(o.magSource, o.id).toBeDefined();
      if (o.majorArcmin !== undefined) expect(o.sizeSource, o.id).toBeDefined();
    }
  });

  it('a constelação indicada coincide com os limites oficiais da IAU para a posição', () => {
    const bounds = parseConstellationBounds(JSON.parse(readFileSync('public/data/constellation-bounds.json', 'utf8')));
    const locator = new ConstellationLocator(bounds);
    for (const o of BEYOND) {
      expect(o.ra, o.id).toBeGreaterThanOrEqual(0);
      expect(o.ra, o.id).toBeLessThan(360);
      expect(Math.abs(o.dec), o.id).toBeLessThanOrEqual(90);
      expect(locator.find(o.ra, o.dec), o.id).toBe(o.constellation);
    }
  });

  it('as distâncias em anos-luz correspondem aos valores publicados em parsecs', () => {
    // Pietrzyński et al. 2019: 49,59 kpc; Graczyk et al. 2020: 62,44 kpc; Dodson et al. 2003: 293 pc
    expect(findBeyond('gnm')!.distance!.ly / (49_590 * LY_PER_PC)).toBeCloseTo(1, 2);
    expect(findBeyond('pnm')!.distance!.ly / (62_440 * LY_PER_PC)).toBeCloseTo(1, 2);
    expect(findBeyond('pulsar-vela')!.distance!.ly / (293 * LY_PER_PC)).toBeCloseTo(1, 2);
    // A SN 1987A e a Tarântula estão na Grande Nuvem: as distâncias das fontes são coerentes a 5 %
    const lmc = findBeyond('gnm')!.distance!.ly;
    for (const id of ['sn1987a', 'ngc2070']) expect(Math.abs(findBeyond(id)!.distance!.ly / lmc - 1), id).toBeLessThan(0.06);
  });

  it('tamanho real calculado: ordem de grandeza coerente com o diâmetro publicado', () => {
    // Nebulosa de Carina: 120′ a 7500 anos-luz ≈ 260 anos-luz (a NASA indica cerca de 300)
    const carina = physicalSizeLy(findBeyond('ngc3372')!)!;
    expect(carina).toBeGreaterThan(200);
    expect(carina).toBeLessThan(350);
  });

  it('rotas e pesquisa', () => {
    expect(parseHash('#/espaco-profundo/gnm')).toEqual({ name: 'deep-sky-object', id: 'gnm' });
    for (const o of BEYOND) expect(parseHash(routeToHash({ name: 'deep-sky-object', id: o.id }))).toEqual({ name: 'deep-sky-object', id: o.id });
    expect(findBeyond('NGC5139')?.namePt).toBe('Omega Centauri');
    const entries = beyondEntries(BEYOND);
    expect(entries).toHaveLength(BEYOND.length);
    const lmc = entries.find((e) => e.id === 'dso:gnm')!;
    expect(lmc.terms).toEqual(expect.arrayContaining(['LMC', 'Large Magellanic Cloud', 'ESO56-115']));
    expect(entries.find((e) => e.id === 'dso:ngc5139')!.terms).toContain('NGC5139');
  });
});
