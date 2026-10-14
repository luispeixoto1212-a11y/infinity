import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from '../../app/router';
import { LEVELS, TOPICS } from './topics';
import { schwarzschildRadiusM, spaghettiRadius, tidalAcceleration } from './viz/HorizonViz';
import { lensMap, pointLensMagnification, rotationCurve } from './viz/ModelViz';

describe('fenómenos extremos: física das visualizações', () => {
  it('raio de Schwarzschild: 2,95 km para o Sol e 8,9 mm para a Terra', () => {
    expect(schwarzschildRadiusM(1) / 1000).toBeCloseTo(2.953, 2);
    expect(schwarzschildRadiusM(3.003e-6) * 1000).toBeCloseTo(8.87, 1);
  });

  it('a maré no horizonte é mortal num buraco negro estelar e imperceptível em Sagitário A*', () => {
    const stellar = tidalAcceleration(10, schwarzschildRadiusM(10));
    const sgr = tidalAcceleration(4.3e6, schwarzschildRadiusM(4.3e6));
    expect(stellar / 9.81).toBeGreaterThan(1e6);
    expect(sgr / 9.81).toBeLessThan(1e-3);
    expect(spaghettiRadius(10)).toBeGreaterThan(schwarzschildRadiusM(10));
    expect(spaghettiRadius(4.3e6)).toBeLessThan(schwarzschildRadiusM(4.3e6));
    // A maré diminui com a massa ao quadrado no horizonte
    expect(tidalAcceleration(20, schwarzschildRadiusM(20)) / tidalAcceleration(10, schwarzschildRadiusM(10))).toBeCloseTo(0.25, 6);
  });

  it('lente pontual: o anel de Einstein é a imagem de uma fonte alinhada e as ampliações batem certo', () => {
    for (const a of [0, 1, 2.5]) {
      const [bx, by] = lensMap(Math.cos(a), Math.sin(a));
      expect(Math.hypot(bx, by)).toBeCloseTo(0, 12);
    }
    expect(pointLensMagnification(1)).toBeCloseTo(3 / Math.sqrt(5), 10);
    expect(pointLensMagnification(10)).toBeCloseTo(1, 2);
    // As duas imagens θ± = (u ± √(u²+4))/2 projetam-se na mesma posição da fonte
    const u = 0.4;
    const plus = (u + Math.sqrt(u * u + 4)) / 2;
    const minus = (u - Math.sqrt(u * u + 4)) / 2;
    expect(lensMap(plus, 0)[0]).toBeCloseTo(u, 10);
    expect(lensMap(minus, 0)[0]).toBeCloseTo(u, 10);
  });

  it('modelo de curva de rotação: ~225 km/s junto ao Sol, plana com halo e decrescente sem ele', () => {
    const sun = rotationCurve(8.2);
    expect(sun.total).toBeGreaterThan(210);
    expect(sun.total).toBeLessThan(240);
    expect(Math.abs(rotationCurve(30).total - rotationCurve(10).total)).toBeLessThan(25);
    expect(rotationCurve(30).visible).toBeLessThan(rotationCurve(8.2).visible * 0.7);
  });
});

describe('fenómenos extremos: conteúdos', () => {
  it('cobre os temas pedidos, cada um nos três níveis e com fontes', () => {
    const ids = TOPICS.map((t) => t.id);
    for (const id of ['formacao-buracos-negros', 'horizonte', 'disco-acrecao', 'ondas-gravitacionais', 'lentes-gravitacionais', 'estrelas-de-neutroes', 'supernovas', 'quasares', 'materia-escura', 'energia-escura']) {
      expect(ids, id).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOPICS) {
      for (const l of LEVELS) expect(t.levels[l].length, `${t.id} ${l}`).toBeGreaterThan(0);
      expect(t.sources.length, t.id).toBeGreaterThan(0);
      for (const s of t.sources) expect(s.url, t.id).toMatch(/^https:\/\//);
    }
  });

  it('rotas #/fenomenos-extremos e #/fenomenos-extremos/<tema>', () => {
    expect(parseHash('#/fenomenos-extremos')).toEqual({ name: 'extreme' });
    expect(parseHash('#/fenomenos-extremos/supernovas')).toEqual({ name: 'extreme', topic: 'supernovas' });
    expect(routeToHash({ name: 'extreme', topic: 'quasares' })).toBe('#/fenomenos-extremos/quasares');
  });
});
