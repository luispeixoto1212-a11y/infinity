/** Velocidades da simulação, em dias simulados por segundo real. */
export const SPEEDS = [
  { key: 'realtime', daysPerSecond: 1 / 86_400 },
  { key: 'minute', daysPerSecond: 60 / 86_400 },
  { key: 'hour', daysPerSecond: 1 / 24 },
  { key: 'day', daysPerSecond: 1 },
  { key: 'week', daysPerSecond: 7 },
  { key: 'month', daysPerSecond: 30.436875 },
  { key: 'year', daysPerSecond: 365.25 },
] as const;

export type SpeedKey = (typeof SPEEDS)[number]['key'];

export const DEFAULT_SPEED_INDEX = 3;

export function clampSpeedIndex(i: number): number {
  return Math.min(SPEEDS.length - 1, Math.max(0, i));
}

export function rateFor(index: number, direction: 1 | -1): number {
  const s = SPEEDS[clampSpeedIndex(index)]!;
  return s.daysPerSecond * direction;
}
