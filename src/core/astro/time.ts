/**
 * Escalas de tempo usadas nos cálculos de posição.
 *
 * Os elementos orbitais do JPL estão em TDB (Tempo Dinâmico Baricêntrico).
 * O relógio do sistema dá UTC. Para esta visualização aproximamos TDB ≈ TT = UTC + ΔT,
 * com ΔT = 37 s (segundos intercalares em vigor desde 2017) + 32,184 s.
 * O erro desta aproximação é inferior a 2 ms, irrelevante face à precisão dos elementos.
 */

export const J2000_JD = 2451545.0;
export const UNIX_EPOCH_JD = 2440587.5;
export const MS_PER_DAY = 86_400_000;
export const DAYS_PER_JULIAN_CENTURY = 36525;
export const TT_MINUS_UTC_SECONDS = 69.184;

/** Converte uma data (UTC) em Dia Juliano (UTC). */
export function dateToJulianDayUtc(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** Converte uma data (UTC) em Dia Juliano na escala TDB (aproximada por TT). */
export function dateToJulianDayTdb(date: Date): number {
  return dateToJulianDayUtc(date) + TT_MINUS_UTC_SECONDS / 86_400;
}

/** Converte um Dia Juliano TDB numa data (UTC). */
export function julianDayTdbToDate(jdTdb: number): Date {
  const jdUtc = jdTdb - TT_MINUS_UTC_SECONDS / 86_400;
  return new Date((jdUtc - UNIX_EPOCH_JD) * MS_PER_DAY);
}

/** Séculos julianos desde J2000.0 (T na notação do JPL). */
export function centuriesSinceJ2000(jdTdb: number): number {
  return (jdTdb - J2000_JD) / DAYS_PER_JULIAN_CENTURY;
}

/** Dias desde J2000.0 (d na notação da IAU para a orientação dos corpos). */
export function daysSinceJ2000(jdTdb: number): number {
  return jdTdb - J2000_JD;
}

/**
 * Intervalo de validade da Tabela 1 do JPL ("Approximate Positions of the Planets").
 * Fora deste intervalo os erros crescem; a simulação limita-se a ele.
 */
export const EPHEMERIS_VALIDITY = {
  minJd: dateToJulianDayTdb(new Date(Date.UTC(1800, 0, 1))),
  maxJd: dateToJulianDayTdb(new Date(Date.UTC(2050, 11, 31, 23, 59, 59))),
} as const;

export function clampToValidity(jdTdb: number): { jd: number; clamped: boolean } {
  if (jdTdb < EPHEMERIS_VALIDITY.minJd) return { jd: EPHEMERIS_VALIDITY.minJd, clamped: true };
  if (jdTdb > EPHEMERIS_VALIDITY.maxJd) return { jd: EPHEMERIS_VALIDITY.maxJd, clamped: true };
  return { jd: jdTdb, clamped: false };
}
