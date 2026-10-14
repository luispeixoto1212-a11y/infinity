import { formatNumber, formatSignificant } from '../../core/format';
import { lightYearsFromPc, luminosityClass, spectralClass, type Star } from './starData';

/** Distância de uma estrela em anos-luz, já formatada (com casas decimais só para as muito próximas). */
export function formatStarDistance(s: Star): string {
  if (s.distPc === undefined) return '—';
  const ly = lightYearsFromPc(s.distPc);
  if (ly < 100) return `${formatNumber(ly, 2)} anos-luz`;
  if (ly < 10_000) return `${formatNumber(Math.round(ly), 0)} anos-luz`;
  return `${formatSignificant(ly, 2)} anos-luz`;
}

export type StarSort = 'name' | 'mag' | 'distance' | 'con';

export function sortStars(list: readonly Star[], sort: StarSort, constellationName: (c?: string) => string): Star[] {
  const collator = new Intl.Collator('pt-PT');
  const num = (v: number | undefined) => (v === undefined ? Number.POSITIVE_INFINITY : v);
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'mag':
        return num(a.mag) - num(b.mag) || collator.compare(a.name, b.name);
      case 'distance':
        return num(a.distPc) - num(b.distPc) || collator.compare(a.name, b.name);
      case 'con':
        return collator.compare(constellationName(a.constellation), constellationName(b.constellation)) || num(a.mag) - num(b.mag);
      default:
        return collator.compare(a.name, b.name);
    }
  });
}

/** Normaliza para pesquisa: sem acentos nem maiúsculas, letras gregas pelo nome latino abreviado. */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const GREEK_NAMES: Record<string, string> = {
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ε: 'epsilon',
  ζ: 'zeta',
  η: 'eta',
  θ: 'theta',
  ι: 'iota',
  κ: 'kappa',
  λ: 'lambda',
  μ: 'mu',
  ν: 'nu',
  ξ: 'xi',
  ο: 'omicron',
  π: 'pi',
  ρ: 'rho',
  σ: 'sigma',
  τ: 'tau',
  υ: 'upsilon',
  φ: 'phi',
  χ: 'chi',
  ψ: 'psi',
  ω: 'omega',
};

/** Texto pesquisável de uma estrela: nome, designação (com e sem letras gregas) e números de catálogo. */
export function starSearchText(s: Star): string {
  const des = s.designation ?? '';
  const greekSpelled = des.replace(/[α-ω]/g, (c) => GREEK_NAMES[c] ?? c);
  const parts = [s.name, des, greekSpelled, s.gliese ?? '', s.hip ? `hip ${s.hip}` : '', s.hd ? `hd ${s.hd}` : '', s.hr ? `hr ${s.hr}` : ''];
  return plain(parts.join(' '));
}

export function filterStars(list: readonly Star[], query: string): Star[] {
  const q = plain(query.trim());
  if (!q) return [...list];
  return list.filter((s) => starSearchText(s).includes(q));
}

/** Descrição do tipo espectral em português (classe e, quando indicada, classe de luminosidade). */
export function describeSpectralType(
  spect: string | undefined,
  classes: Record<string, string>,
  lumClasses: Record<string, string>,
): string | undefined {
  const c = spectralClass(spect);
  if (!c) return undefined;
  const base = classes[c];
  const l = luminosityClass(spect);
  if (!base) return undefined;
  if (!l || c === 'D') return base;
  return `${base}, ${lumClasses[l]}`;
}
