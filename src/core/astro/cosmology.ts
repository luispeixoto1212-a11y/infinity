/**
 * Cosmologia ΛCDM plana com os parâmetros do Planck 2018 (Planck Collaboration 2020, A&A 641, A6,
 * tabela 2, última coluna: TT,TE,EE+lowE+lensing+BAO): H0 = 67,66 km/s/Mpc, Ωm = 0,3111.
 * A radiação inclui fotões (T = 2,7255 K) e neutrinos (Neff = 3,046); Ωλ fecha o Universo plano.
 *
 * Idade e distâncias por integração numérica (regra de Simpson) em função do fator de escala a = 1/(1+z),
 * numa forma sem singularidades: t(a) = tH ∫₀ᵃ a′ da′/√(Ωr + Ωm a′ + ΩΛ a′⁴) e
 * Dc(z) = DH ∫ₐ¹ da′/√(Ωr + Ωm a′ + ΩΛ a′⁴).
 */

export interface Cosmology {
  H0: number;
  omegaM: number;
  omegaR: number;
  omegaL: number;
}

const T_CMB = 2.7255;
const N_EFF = 3.046;

export function flatCosmology(H0: number, omegaM: number): Cosmology {
  const h = H0 / 100;
  // Ωγ h² = 2,47282 × 10⁻⁵ (T/2,7255 K)⁴; neutrinos sem massa: fator 1 + 0,2271 Neff
  const omegaG = (2.47282e-5 * (T_CMB / 2.7255) ** 4) / (h * h);
  const omegaR = omegaG * (1 + 0.2271 * N_EFF);
  return { H0, omegaM, omegaR, omegaL: 1 - omegaM - omegaR };
}

export const PLANCK18 = flatCosmology(67.66, 0.3111);
/** Idade do Universo publicada pelo Planck 2018 (mil milhões de anos) e a sua incerteza. */
export const PLANCK18_AGE_GYR = { value: 13.787, sigma: 0.02 };

/** Segundos num ano juliano. */
export const SECONDS_PER_YEAR = 31_557_600;
/** Anos-luz num megaparsec. */
export const LY_PER_MPC = 3.261563777e6;
const C_KM_S = 299_792.458;

/** Tempo de Hubble 1/H0 (mil milhões de anos). */
export const hubbleTimeGyr = (c: Cosmology) => 977.792221 / c.H0;
/** Distância de Hubble c/H0 (Mpc). */
export const hubbleDistanceMpc = (c: Cosmology) => C_KM_S / c.H0;

function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  if (b <= a) return 0;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** Idade do Universo (mil milhões de anos) quando o fator de escala era a. */
export function ageAtScaleFactor(a: number, c: Cosmology = PLANCK18): number {
  // Para a muito pequeno, a escala logarítmica evita perder a era da radiação na integração
  if (a < 1e-3) {
    const f = (u: number) => {
      const x = Math.exp(u);
      return (x * x) / Math.sqrt(c.omegaR + c.omegaM * x + c.omegaL * x ** 4);
    };
    return hubbleTimeGyr(c) * simpson(f, Math.log(a) - 30, Math.log(a), 4000);
  }
  const early = ageAtScaleFactor(1e-3 * 0.999999, c);
  const f = (x: number) => x / Math.sqrt(c.omegaR + c.omegaM * x + c.omegaL * x ** 4);
  return early + hubbleTimeGyr(c) * simpson(f, 1e-3 * 0.999999, a, 4000);
}

/** Idade do Universo (mil milhões de anos) quando a luz com desvio para o vermelho z foi emitida. */
export const ageAtRedshift = (z: number, c: Cosmology = PLANCK18) => ageAtScaleFactor(1 / (1 + z), c);

/** Idade atual do Universo (mil milhões de anos). */
export const ageNow = (c: Cosmology = PLANCK18) => ageAtScaleFactor(1, c);

/** Tempo de viagem da luz (mil milhões de anos) desde a emissão com desvio z. */
export const lookbackTimeGyr = (z: number, c: Cosmology = PLANCK18) => ageNow(c) - ageAtRedshift(z, c);

/** Distância comóvel (distância própria hoje), em Mpc. */
export function comovingDistanceMpc(z: number, c: Cosmology = PLANCK18): number {
  const a = 1 / (1 + z);
  const f = (x: number) => 1 / Math.sqrt(c.omegaR + c.omegaM * x + c.omegaL * x ** 4);
  return hubbleDistanceMpc(c) * simpson(f, a, 1, 4000);
}

export interface RedshiftSummary {
  z: number;
  /** Idade do Universo na emissão (mil milhões de anos). */
  ageAtEmissionGyr: number;
  /** Tempo de viagem da luz (mil milhões de anos) = distância percorrida pela luz (mil milhões de anos-luz). */
  lookbackGyr: number;
  /** Distância hoje (comóvel) e no momento da emissão (mil milhões de anos-luz). */
  distanceNowGly: number;
  distanceThenGly: number;
  /** Distância de luminosidade (mil milhões de anos-luz), usada com o brilho aparente. */
  luminosityDistanceGly: number;
  /** Fator de escala: o Universo era 1/(1+z) do tamanho atual. */
  scaleFactor: number;
}

export function summarizeRedshift(z: number, c: Cosmology = PLANCK18): RedshiftSummary {
  const age = ageAtRedshift(z, c);
  const now = ageNow(c);
  const dc = (comovingDistanceMpc(z, c) * LY_PER_MPC) / 1e9;
  return {
    z,
    ageAtEmissionGyr: age,
    lookbackGyr: now - age,
    distanceNowGly: dc,
    distanceThenGly: dc / (1 + z),
    luminosityDistanceGly: dc * (1 + z),
    scaleFactor: 1 / (1 + z),
  };
}

/** Desvio para o vermelho em que a idade do Universo era ageGyr (bisseção em log(1+z)). */
export function redshiftAtAge(ageGyr: number, c: Cosmology = PLANCK18): number {
  let lo = 0;
  let hi = Math.log(1e5);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ageAtRedshift(Math.exp(mid) - 1, c) > ageGyr) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2) - 1;
}

/** Igualdade matéria–radiação: 1 + z = Ωm/Ωr. */
export const matterRadiationEqualityZ = (c: Cosmology = PLANCK18) => c.omegaM / c.omegaR - 1;
/** A expansão começa a acelerar quando Ωm (1+z)³ = 2 ΩΛ (parâmetro de desaceleração nulo). */
export const accelerationOnsetZ = (c: Cosmology = PLANCK18) => Math.cbrt((2 * c.omegaL) / c.omegaM) - 1;
/** A energia escura passa a dominar quando Ωm (1+z)³ = ΩΛ. */
export const darkEnergyDominationZ = (c: Cosmology = PLANCK18) => Math.cbrt(c.omegaL / c.omegaM) - 1;
