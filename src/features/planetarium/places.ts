/**
 * Lugares predefinidos do planetário e conversão entre a hora local de um fuso horário (IANA) e UTC.
 * Coordenadas geográficas aproximadas do centro de cada localidade (graus decimais, WGS84).
 */

export interface Place {
  id: string;
  name: string;
  region: 'pt' | 'world';
  latDeg: number;
  lonDeg: number;
  heightM: number;
  /** Fuso horário IANA, usado para mostrar e introduzir a hora local. */
  timeZone: string;
}

export const PLACES: Place[] = [
  { id: 'lisboa', name: 'Lisboa', region: 'pt', latDeg: 38.7223, lonDeg: -9.1393, heightM: 50, timeZone: 'Europe/Lisbon' },
  { id: 'porto', name: 'Porto', region: 'pt', latDeg: 41.1579, lonDeg: -8.6291, heightM: 100, timeZone: 'Europe/Lisbon' },
  { id: 'braga', name: 'Braga', region: 'pt', latDeg: 41.5454, lonDeg: -8.4265, heightM: 190, timeZone: 'Europe/Lisbon' },
  { id: 'guimaraes', name: 'Guimarães', region: 'pt', latDeg: 41.4425, lonDeg: -8.2918, heightM: 175, timeZone: 'Europe/Lisbon' },
  { id: 'braganca', name: 'Bragança', region: 'pt', latDeg: 41.8061, lonDeg: -6.7567, heightM: 690, timeZone: 'Europe/Lisbon' },
  { id: 'coimbra', name: 'Coimbra', region: 'pt', latDeg: 40.2033, lonDeg: -8.4103, heightM: 75, timeZone: 'Europe/Lisbon' },
  { id: 'evora', name: 'Évora', region: 'pt', latDeg: 38.5714, lonDeg: -7.9135, heightM: 300, timeZone: 'Europe/Lisbon' },
  {
    id: 'monsaraz',
    name: 'Monsaraz (Dark Sky Alqueva)',
    region: 'pt',
    latDeg: 38.4432,
    lonDeg: -7.3806,
    heightM: 340,
    timeZone: 'Europe/Lisbon',
  },
  { id: 'faro', name: 'Faro', region: 'pt', latDeg: 37.0194, lonDeg: -7.9322, heightM: 10, timeZone: 'Europe/Lisbon' },
  { id: 'funchal', name: 'Funchal', region: 'pt', latDeg: 32.6669, lonDeg: -16.9241, heightM: 50, timeZone: 'Atlantic/Madeira' },
  { id: 'ponta-delgada', name: 'Ponta Delgada', region: 'pt', latDeg: 37.7412, lonDeg: -25.6756, heightM: 20, timeZone: 'Atlantic/Azores' },
  { id: 'rio', name: 'Rio de Janeiro', region: 'world', latDeg: -22.9068, lonDeg: -43.1729, heightM: 10, timeZone: 'America/Sao_Paulo' },
  { id: 'sao-paulo', name: 'São Paulo', region: 'world', latDeg: -23.5505, lonDeg: -46.6333, heightM: 760, timeZone: 'America/Sao_Paulo' },
  { id: 'luanda', name: 'Luanda', region: 'world', latDeg: -8.839, lonDeg: 13.2894, heightM: 70, timeZone: 'Africa/Luanda' },
  { id: 'maputo', name: 'Maputo', region: 'world', latDeg: -25.9692, lonDeg: 32.5732, heightM: 50, timeZone: 'Africa/Maputo' },
  { id: 'praia', name: 'Praia (Cabo Verde)', region: 'world', latDeg: 14.933, lonDeg: -23.5133, heightM: 30, timeZone: 'Atlantic/Cape_Verde' },
  { id: 'bissau', name: 'Bissau', region: 'world', latDeg: 11.8817, lonDeg: -15.617, heightM: 10, timeZone: 'Africa/Bissau' },
  { id: 'sao-tome', name: 'São Tomé', region: 'world', latDeg: 0.3365, lonDeg: 6.7273, heightM: 10, timeZone: 'Africa/Sao_Tome' },
  { id: 'dili', name: 'Díli', region: 'world', latDeg: -8.5569, lonDeg: 125.5603, heightM: 10, timeZone: 'Asia/Dili' },
  { id: 'macau', name: 'Macau', region: 'world', latDeg: 22.1987, lonDeg: 113.5439, heightM: 20, timeZone: 'Asia/Macau' },
  { id: 'madrid', name: 'Madrid', region: 'world', latDeg: 40.4168, lonDeg: -3.7038, heightM: 650, timeZone: 'Europe/Madrid' },
  { id: 'londres', name: 'Londres', region: 'world', latDeg: 51.5074, lonDeg: -0.1278, heightM: 20, timeZone: 'Europe/London' },
  { id: 'paris', name: 'Paris', region: 'world', latDeg: 48.8566, lonDeg: 2.3522, heightM: 40, timeZone: 'Europe/Paris' },
  { id: 'reiquiavique', name: 'Reiquiavique', region: 'world', latDeg: 64.1466, lonDeg: -21.9426, heightM: 20, timeZone: 'Atlantic/Reykjavik' },
  { id: 'nova-iorque', name: 'Nova Iorque', region: 'world', latDeg: 40.7128, lonDeg: -74.006, heightM: 10, timeZone: 'America/New_York' },
  { id: 'quito', name: 'Quito (Equador)', region: 'world', latDeg: -0.1807, lonDeg: -78.4678, heightM: 2850, timeZone: 'America/Guayaquil' },
  {
    id: 'atacama',
    name: 'San Pedro de Atacama',
    region: 'world',
    latDeg: -22.9087,
    lonDeg: -68.1997,
    heightM: 2400,
    timeZone: 'America/Santiago',
  },
  { id: 'mauna-kea', name: 'Mauna Kea (Havai)', region: 'world', latDeg: 19.8207, lonDeg: -155.4681, heightM: 4205, timeZone: 'Pacific/Honolulu' },
  { id: 'cidade-do-cabo', name: 'Cidade do Cabo', region: 'world', latDeg: -33.9249, lonDeg: 18.4241, heightM: 20, timeZone: 'Africa/Johannesburg' },
  { id: 'toquio', name: 'Tóquio', region: 'world', latDeg: 35.6762, lonDeg: 139.6503, heightM: 40, timeZone: 'Asia/Tokyo' },
  { id: 'sydney', name: 'Sydney', region: 'world', latDeg: -33.8688, lonDeg: 151.2093, heightM: 20, timeZone: 'Australia/Sydney' },
  { id: 'polo-norte', name: 'Polo Norte', region: 'world', latDeg: 90, lonDeg: 0, heightM: 0, timeZone: 'UTC' },
  { id: 'polo-sul', name: 'Polo Sul', region: 'world', latDeg: -90, lonDeg: 0, heightM: 2835, timeZone: 'UTC' },
];

export const DEFAULT_PLACE_ID = 'lisboa';

export function findPlace(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

/** Fuso horário do dispositivo (ou UTC se o navegador não o indicar). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

/** Data e hora de parede num fuso horário. */
export function wallTimeIn(date: Date, tz: string): WallTime & { second: number } {
  const parts = formatterFor(tz).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

/** Diferença (minutos) entre a hora local do fuso e UTC no instante indicado. */
export function timeZoneOffsetMinutes(date: Date, tz: string): number {
  const w = wallTimeIn(date, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Converte uma hora de parede num fuso horário no instante UTC correspondente.
 * Nas mudanças de hora, uma hora inexistente avança uma hora e uma hora repetida corresponde
 * a uma das duas ocorrências (a da hora de inverno).
 */
export function wallTimeToDate(w: WallTime, tz: string): Date {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  let t = guess - timeZoneOffsetMinutes(new Date(guess), tz) * 60000;
  const off2 = timeZoneOffsetMinutes(new Date(t), tz);
  t = guess - off2 * 60000;
  const back = wallTimeIn(new Date(t), tz);
  if (back.hour !== w.hour || back.minute !== w.minute) {
    // Hora inexistente (o relógio salta para a frente): usa o desvio anterior à mudança
    const off1 = timeZoneOffsetMinutes(new Date(guess - 86400000 / 2), tz);
    t = guess - Math.min(off1, off2) * 60000;
  }
  return new Date(t);
}

/** Valor para um campo &lt;input type="datetime-local"&gt; (AAAA-MM-DDTHH:MM) na hora local do fuso. */
export function toDateTimeLocalValue(date: Date, tz: string): string {
  const w = wallTimeIn(date, tz);
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(w.year, 4)}-${p(w.month)}-${p(w.day)}T${p(w.hour)}:${p(w.minute)}`;
}

export function parseDateTimeLocalValue(value: string): WallTime | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

/** "UTC+1", "UTC−3", "UTC+5:30". */
export function formatUtcOffset(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const sign = minutes > 0 ? '+' : '−';
  const a = Math.abs(minutes);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** Hora local (HH:MM) de um instante num fuso. */
export function formatClock(date: Date, tz: string): string {
  const w = wallTimeIn(date, tz);
  return `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
}

/** Meia-noite local (início do dia civil) do dia que contém o instante, devolvida como Date. */
export function startOfLocalDay(date: Date, tz: string): Date {
  const w = wallTimeIn(date, tz);
  return wallTimeToDate({ year: w.year, month: w.month, day: w.day, hour: 0, minute: 0 }, tz);
}

/** Coordenadas em texto: 38,72° N, 9,14° O. */
export function formatLatLon(latDeg: number, lonDeg: number): string {
  const f = (v: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(Math.abs(v));
  return `${f(latDeg)}° ${latDeg >= 0 ? 'N' : 'S'}, ${f(lonDeg)}° ${lonDeg >= 0 ? 'E' : 'O'}`;
}
