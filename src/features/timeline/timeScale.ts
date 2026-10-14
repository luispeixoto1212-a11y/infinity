/**
 * Escalas de tempo da linha temporal: tempo desde o Big Bang em escala logarítmica (primeiros instantes),
 * anos antes do presente em escala logarítmica (história completa) e tempo linear (proporções reais).
 */
import { PLANCK18, SECONDS_PER_YEAR, ageAtRedshift, ageNow } from '../../core/astro/cosmology';
import { toSuperscript } from '../../core/format';
import type { CosmicEvent } from './cosmicEvents';

export type ScaleMode = 'early' | 'history' | 'linear';

/** Idade do Universo (anos) com a cosmologia do Planck 2018 calculada pela aplicação. */
export const AGE_YEARS = ageNow(PLANCK18) * 1e9;
/** Ano (decimal) usado como "presente". */
export const PRESENT_YEAR_CE = 2026.79;

export interface TimedEvent extends CosmicEvent {
  /** Segundos desde o Big Bang. */
  seconds: number;
  /** Anos antes do presente. */
  yearsAgo: number;
}

export function timeEvent(e: CosmicEvent): TimedEvent {
  const t = e.time;
  let seconds: number;
  let yearsAgo: number;
  if ('secondsAfterBB' in t) {
    seconds = t.secondsAfterBB;
    yearsAgo = AGE_YEARS - seconds / SECONDS_PER_YEAR;
  } else if ('redshift' in t) {
    const ageYears = ageAtRedshift(t.redshift, PLANCK18) * 1e9;
    seconds = ageYears * SECONDS_PER_YEAR;
    yearsAgo = AGE_YEARS - ageYears;
  } else if ('yearsAgo' in t) {
    yearsAgo = t.yearsAgo;
    seconds = (AGE_YEARS - yearsAgo) * SECONDS_PER_YEAR;
  } else {
    yearsAgo = PRESENT_YEAR_CE - t.yearCE;
    seconds = (AGE_YEARS - yearsAgo) * SECONDS_PER_YEAR;
  }
  return { ...e, seconds, yearsAgo };
}

/** Coordenada de um acontecimento na escala escolhida. */
export function coordinate(e: { seconds: number; yearsAgo: number }, mode: ScaleMode): number {
  if (mode === 'early') return Math.log10(e.seconds);
  if (mode === 'history') return -Math.log10(Math.max(e.yearsAgo, 0.1));
  return e.seconds / SECONDS_PER_YEAR / 1e9;
}

/** Domínio completo de cada escala (coordenadas), da esquerda para a direita. */
export function fullDomain(mode: ScaleMode): [number, number] {
  if (mode === 'early') return [-44.5, Math.log10(AGE_YEARS * SECONDS_PER_YEAR) + 0.4];
  if (mode === 'history') return [-Math.log10(AGE_YEARS) - 0.15, 0.5];
  return [-0.2, AGE_YEARS / 1e9 + 0.2];
}

/** Menor intervalo visível permitido em cada escala. */
export function minSpan(mode: ScaleMode): number {
  if (mode === 'linear') return 1e-8; // cerca de 10 anos
  return 0.5;
}

// ——— Formatação ———

const nf = (v: number, d = 0) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: d }).format(v);

/** Duração em anos, por extenso: "372 mil anos", "13,8 mil milhões de anos". */
export function formatYears(years: number): string {
  const a = Math.abs(years);
  if (a >= 1e9) return `${nf(years / 1e9, a >= 1e10 ? 1 : 2)} mil milhões de anos`;
  if (a >= 1e6) return `${nf(years / 1e6, a >= 1e8 ? 0 : 1)} milhões de anos`;
  if (a >= 1e4) return `${nf(years / 1e3, 0)} mil anos`;
  if (a >= 2) return `${nf(years, 0)} anos`;
  if (a >= 1) return '1 ano';
  return `${nf(years * 12, 0)} meses`;
}

/** Tempo desde o Big Bang: segundos, minutos, horas ou anos. */
export function formatSinceBigBang(seconds: number): string {
  if (seconds < 1e-3) {
    const exp = Math.floor(Math.log10(seconds));
    const mant = seconds / 10 ** exp;
    return `${Math.abs(mant - 1) < 0.05 ? '' : `${nf(mant, 1)} × `}10${toSuperscript(exp)} s`;
  }
  if (seconds < 60) return `${nf(seconds, seconds < 10 ? 2 : 0)} s`;
  if (seconds < 3600) return `${nf(seconds / 60, 0)} minutos`;
  if (seconds < 86400 * 2) return `${nf(seconds / 3600, 0)} horas`;
  if (seconds < SECONDS_PER_YEAR) return `${nf(seconds / 86400, 0)} dias`;
  return formatYears(seconds / SECONDS_PER_YEAR);
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Calendário cósmico: a história do Universo comprimida num ano (o Big Bang à meia-noite de 1 de janeiro
 * e o presente à meia-noite de 31 de dezembro). Devolve o dia e a hora correspondentes.
 */
export function cosmicCalendar(yearsAgo: number): { text: string; secondsBeforeMidnight: number } {
  const fraction = 1 - yearsAgo / AGE_YEARS;
  const secondsInYear = 365 * 86400;
  const s = Math.min(secondsInYear - 1e-9, Math.max(0, fraction * secondsInYear));
  const secondsBeforeMidnight = secondsInYear - s;
  const dayOfYear = Math.floor(s / 86400);
  const date = new Date(Date.UTC(2001, 0, 1) + dayOfYear * 86400000);
  const sod = s - dayOfYear * 86400;
  const hh = Math.floor(sod / 3600);
  const mm = Math.floor((sod % 3600) / 60);
  const ss = Math.floor(sod % 60);
  let text = `${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (secondsBeforeMidnight < 3600) {
    text = secondsBeforeMidnight < 1 ? `31 de dezembro, ${nf(secondsBeforeMidnight * 1000, 0)} ms antes da meia-noite` : `31 de dezembro, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return { text, secondsBeforeMidnight };
}

// ——— Marcas do eixo ———

export interface Tick {
  value: number;
  label: string;
}

const NAMED_SECONDS: Array<[number, string]> = [
  [0, '1 s'],
  [Math.log10(60), '1 min'],
  [Math.log10(3600), '1 h'],
  [Math.log10(86400), '1 dia'],
  [Math.log10(SECONDS_PER_YEAR), '1 ano'],
  [Math.log10(SECONDS_PER_YEAR * 1e3), 'mil anos'],
  [Math.log10(SECONDS_PER_YEAR * 1e6), '1 milhão de anos'],
  [Math.log10(SECONDS_PER_YEAR * 1e9), 'mil milhões'],
];

function yearsAgoShort(y: number): string {
  if (y >= 1e9) return `${nf(y / 1e9, 1)} mil M`;
  if (y >= 1e6) return `${nf(y / 1e6, 1)} M`;
  if (y >= 1e3) return `${nf(y / 1e3, 1)} mil`;
  return nf(y, 1);
}

function niceStep(span: number, target: number): number {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** Marcas do eixo para o intervalo visível [d0, d1]. */
export function ticksFor(mode: ScaleMode, d0: number, d1: number, maxTicks = 8): Tick[] {
  const span = d1 - d0;
  if (mode === 'early') {
    if (span < 26) {
      const named = NAMED_SECONDS.filter(([v]) => v >= d0 && v <= d1);
      if (named.length >= 3) return named.map(([value, label]) => ({ value, label }));
    }
    const step = Math.max(1, Math.ceil(span / maxTicks));
    const out: Tick[] = [];
    for (let v = Math.ceil(d0 / step) * step; v <= d1; v += step) out.push({ value: v, label: v === 0 ? '1 s' : `10${toSuperscript(v)} s` });
    return out;
  }
  if (mode === 'history') {
    const step = Math.max(1, Math.ceil(span / maxTicks));
    const out: Tick[] = [];
    for (let v = Math.ceil(d0 / step) * step; v <= d1; v += step) {
      const ya = 10 ** -v;
      if (ya < 1) continue;
      out.push({ value: v, label: `há ${yearsAgoShort(ya)}` });
    }
    return out;
  }
  // Linear: marcas em anos antes do presente
  const ageGyr = AGE_YEARS / 1e9;
  const ya0 = (ageGyr - d1) * 1e9;
  const ya1 = (ageGyr - d0) * 1e9;
  const step = niceStep(ya1 - ya0, maxTicks);
  const out: Tick[] = [];
  for (let ya = Math.ceil(ya0 / step) * step; ya <= ya1; ya += step) {
    const value = ageGyr - ya / 1e9;
    out.push({ value, label: ya <= 0 ? 'hoje' : ya >= AGE_YEARS - step / 2 ? 'Big Bang' : `há ${yearsAgoShort(ya)}` });
  }
  return out;
}
