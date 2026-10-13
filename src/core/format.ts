/**
 * Formatação de números e unidades em português de Portugal.
 * Usa Intl.NumberFormat('pt-PT'): vírgula decimal e espaço como separador de milhares.
 */

export const LOCALE = 'pt-PT';

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

export function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('');
}

/** Número com o número de casas decimais indicado (ou automático). */
export function formatNumber(value: number, maxFractionDigits = 2, minFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: minFractionDigits,
  }).format(value);
}

/**
 * Notação científica legível: 3,3010 × 10²³.
 * @param significant algarismos significativos a mostrar
 */
export function formatScientific(value: number, significant = 4): string {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exp;
  const digits = Math.max(0, significant - 1);
  return `${formatNumber(mantissa, digits, digits)} × 10${toSuperscript(exp)}`;
}

/** Escolhe notação científica para valores muito grandes ou muito pequenos. */
export function formatSmart(value: number, maxFractionDigits = 2): string {
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e9 || abs < 1e-3)) return formatScientific(value, 3);
  return formatNumber(value, maxFractionDigits);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Converte kelvin em graus Celsius. */
export function kelvinToCelsius(k: number): number {
  return k - 273.15;
}
