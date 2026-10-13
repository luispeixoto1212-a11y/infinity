import { formatNumber, formatScientific, kelvinToCelsius } from '../../core/format';
import type { Fact } from '../../data/types';

const AU_KM = 149_597_870.7;

export interface FormattedFact {
  /** Valor principal com unidade, pronto a mostrar. */
  text: string;
  /** Conversão auxiliar (por exemplo, em dias, anos, °C ou UA). */
  secondary?: string;
}

function fixed(v: number, digits?: number): string {
  return digits === undefined ? formatNumber(v, 4) : formatNumber(v, digits, digits);
}

/** Converte segundos em "8 min 19 s". */
export function formatDurationSeconds(s: number): string {
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (sec || parts.length === 0) parts.push(`${sec} s`);
  return parts.join(' ');
}

export function formatFact(f: Fact): FormattedFact {
  const q = f.qualifier ? `${f.qualifier} ` : '';
  if (typeof f.value === 'string') {
    return { text: f.unit ? `${f.value} ${f.unit}` : f.value };
  }
  if (Array.isArray(f.value)) {
    const [a, b] = f.value;
    const text = `${q}${fixed(a, f.digits)}–${fixed(b, f.digits)} ${f.unit}`.trim();
    if (f.unit === 'K') {
      return {
        text,
        secondary: `≈ ${formatNumber(kelvinToCelsius(a), 0)} a ${formatNumber(kelvinToCelsius(b), 0)} °C`,
      };
    }
    return { text };
  }

  const v = f.value;
  const pm = f.uncertainty !== undefined ? ` ± ${fixed(f.uncertainty, f.digits)}` : '';
  const num = f.scientific ? formatScientific(v, f.digits ?? 4) : fixed(v, f.digits);

  switch (f.unit) {
    case '1e6 km': {
      const km = v * 1e6;
      const au = km / AU_KM;
      const text = v < 1 ? `${q}${formatNumber(km, 0)} km` : `${q}${num} milhões de km`;
      return { text, secondary: v < 1 ? undefined : `≈ ${formatNumber(au, au < 10 ? 3 : 2)} UA` };
    }
    case 'h': {
      const abs = Math.abs(v);
      const text = `${q}${num}${pm} h`;
      const retro = v < 0 ? 'retrógrada' : undefined;
      const days = abs >= 48 ? `≈ ${formatNumber(abs / 24, 2)} dias` : undefined;
      const secondary = [days, retro].filter(Boolean).join(', ') || undefined;
      return { text, secondary };
    }
    case 'd': {
      const text = `${q}${num} dias`;
      return { text, secondary: v >= 700 ? `≈ ${formatNumber(v / 365.25, 2)} anos` : undefined };
    }
    case 'yr':
      return { text: `${q}${num} anos` };
    case 'K':
      return { text: `${q}${num}${pm} K`, secondary: f.scientific ? undefined : `≈ ${formatNumber(kelvinToCelsius(v), 0)} °C` };
    case 's':
      return { text: `${q}${formatDurationSeconds(v)}` };
    case 'AU':
      return { text: `${q}${num} UA`, secondary: `≈ ${formatNumber((v * AU_KM) / 1e6, 1)} milhões de km` };
    case '':
      return { text: `${q}${num}${pm}` };
    case '°':
      return { text: `${q}${num}${pm}°` };
    default:
      return { text: `${q}${num}${pm} ${f.unit}` };
  }
}
