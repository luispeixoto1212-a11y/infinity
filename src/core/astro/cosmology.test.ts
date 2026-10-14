import { describe, expect, it } from 'vitest';
import {
  PLANCK18,
  PLANCK18_AGE_GYR,
  accelerationOnsetZ,
  ageAtRedshift,
  ageNow,
  comovingDistanceMpc,
  flatCosmology,
  hubbleTimeGyr,
  lookbackTimeGyr,
  matterRadiationEqualityZ,
  redshiftAtAge,
  summarizeRedshift,
} from './cosmology';

describe('cosmologia ΛCDM (Planck 2018)', () => {
  it('a idade calculada coincide com a publicada pelo Planck (13,787 ± 0,020 mil milhões de anos)', () => {
    expect(Math.abs(ageNow() - PLANCK18_AGE_GYR.value)).toBeLessThan(PLANCK18_AGE_GYR.sigma / 4);
  });

  it('sem radiação, a integração coincide com a solução analítica matéria + Λ', () => {
    const c = { ...flatCosmology(70, 0.3), omegaR: 0, omegaL: 0.7 };
    const analytic = (z: number) => ((2 / 3) * hubbleTimeGyr(c) * Math.asinh(Math.sqrt(0.7 / 0.3) * (1 + z) ** -1.5)) / Math.sqrt(0.7);
    for (const z of [0, 0.5, 2, 10, 100]) expect(ageAtRedshift(z, c)).toBeCloseTo(analytic(z), 4);
  });

  it('num Universo só de matéria (Einstein–de Sitter), a idade é 2/3 do tempo de Hubble e Dc = 2 DH (1 − 1/√(1+z))', () => {
    const c = { H0: 70, omegaM: 1, omegaR: 0, omegaL: 0 };
    expect(ageNow(c)).toBeCloseTo((2 / 3) * hubbleTimeGyr(c), 5);
    const DH = 299792.458 / 70;
    expect(comovingDistanceMpc(3, c)).toBeCloseTo(2 * DH * (1 - 1 / 2), 2);
  });

  it('a radiação cósmica de fundo foi emitida cerca de 372 mil anos depois do Big Bang, a cerca de 13,9 Gpc', () => {
    expect(ageAtRedshift(1089.8) * 1e6).toBeGreaterThan(360);
    expect(ageAtRedshift(1089.8) * 1e6).toBeLessThan(385);
    expect(comovingDistanceMpc(1089.8) / 1000).toBeCloseTo(13.88, 1);
  });

  it('as galáxias a z ≈ 14 viram a luz partir cerca de 280–290 milhões de anos depois do Big Bang', () => {
    expect(ageAtRedshift(14.44) * 1000).toBeCloseTo(283, -1);
    expect(ageAtRedshift(14.32) * 1000).toBeCloseTo(286, -1);
    const s = summarizeRedshift(14.32);
    expect(s.distanceNowGly).toBeCloseTo(33.8, 0);
    expect(s.distanceThenGly).toBeCloseTo(2.2, 1);
    expect(s.lookbackGyr).toBeCloseTo(13.5, 1);
  });

  it('igualdade matéria–radiação perto de z ≈ 3400 (Planck: 3387 ± 21) e aceleração a partir de z ≈ 0,64', () => {
    expect(Math.abs(matterRadiationEqualityZ() - 3387) / 3387).toBeLessThan(0.01);
    expect(accelerationOnsetZ()).toBeCloseTo(0.64, 2);
  });

  it('o tempo de viagem da luz é nulo para z = 0 e a conversão idade → z é inversa', () => {
    expect(lookbackTimeGyr(0)).toBeCloseTo(0, 6);
    for (const z of [0.1, 1, 6, 20]) expect(redshiftAtAge(ageAtRedshift(z))).toBeCloseTo(z, 3);
  });

  it('parâmetros: Universo plano', () => {
    expect(PLANCK18.omegaM + PLANCK18.omegaR + PLANCK18.omegaL).toBeCloseTo(1, 12);
    expect(PLANCK18.omegaR).toBeGreaterThan(8e-5);
    expect(PLANCK18.omegaR).toBeLessThan(1e-4);
  });
});
