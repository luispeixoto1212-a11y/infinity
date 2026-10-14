/**
 * Valores de referência do JPL Horizons (efemérides DE441) para validar o planetário.
 * Consultados em 2026-10-14 na API do Horizons (https://ssd.jpl.nasa.gov/api/horizons.api),
 * modo OBSERVER. Instantes em UT (dia juliano).
 *
 * Geocêntricos (centro 500@399): ascensão reta e declinação astrométricas ICRF (quantidade 1, graus),
 * magnitude aparente APmag (quantidade 9), distância delta (UA, quantidade 20) e ângulo de fase
 * Sol–alvo–observador (quantidade 24, graus). Para a Lua a magnitude não é comparável com rigor
 * (o Horizons usa outra lei de fase), mas fica registada.
 *
 * Topocêntricos (quantidade 4): azimute (a partir do norte, para este) e altura aparentes sem atmosfera.
 */

export interface GeocentricReference {
  id: 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
  jdUt: number;
  raDeg: number;
  decDeg: number;
  /** null quando o Horizons não indica magnitude (Sol). */
  mag: number | null;
  deltaAu: number;
  /** null para o Sol e para a Lua (não pedido). */
  phaseDeg: number | null;
}

export const HORIZONS_SKY_CONSULTED = '2026-10-14';

export const HORIZONS_GEOCENTRIC: GeocentricReference[] = [
  { id: 'moon', jdUt: 2451545.0, raDeg: 222.45893, decDeg: -10.90338, mag: -8.566, deltaAu: 0.00268998925442, phaseDeg: null },
  { id: 'moon', jdUt: 2455276.0, raDeg: 49.55752, decDeg: 22.52557, mag: -8.416, deltaAu: 0.00258687776847, phaseDeg: null },
  { id: 'moon', jdUt: 2460311.0, raDeg: 164.22906, decDeg: 10.1653, mag: -10.993, deltaAu: 0.00270632989537, phaseDeg: null },
  { id: 'moon', jdUt: 2461327.5, raDeg: 235.68999, decDeg: -24.92873, mag: -7.413, deltaAu: 0.00267263037834, phaseDeg: null },
  { id: 'moon', jdUt: 2462668.0, raDeg: 259.2381, decDeg: -22.68116, mag: -12.731, deltaAu: 0.00239602201887, phaseDeg: null },
  { id: 'sun', jdUt: 2461327.5, raDeg: 198.74283, decDeg: -7.92933, mag: null, deltaAu: 0.99765124663132, phaseDeg: null },
  { id: 'sun', jdUt: 2462668.0, raDeg: 83.49451, decDeg: 23.30052, mag: null, deltaAu: 1.01572503900279, phaseDeg: null },
  { id: 'mercury', jdUt: 2461327.5, raDeg: 221.83236, decDeg: -19.27355, mag: 0.046, deltaAu: 0.97512214402234, phaseDeg: 80.3838 },
  { id: 'mercury', jdUt: 2462668.0, raDeg: 72.14797, decDeg: 22.10084, mag: -1.349, deltaAu: 1.25920904942413, phaseDeg: 35.4756 },
  { id: 'venus', jdUt: 2461327.5, raDeg: 210.9052, decDeg: -20.57422, mag: -4.35, deltaAu: 0.29030465290158, phaseDeg: 155.9113 },
  { id: 'venus', jdUt: 2462668.0, raDeg: 49.29368, decDeg: 16.33519, mag: -3.903, deltaAu: 1.32701616821408, phaseDeg: 49.3115 },
  { id: 'mars', jdUt: 2461327.5, raDeg: 131.48244, decDeg: 19.28373, mag: 1.032, deltaAu: 1.57256953339623, phaseDeg: 36.9736 },
  { id: 'mars', jdUt: 2462668.0, raDeg: 77.50893, decDeg: 23.42164, mag: 1.376, deltaAu: 2.53996288899185, phaseDeg: 3.6396 },
  { id: 'jupiter', jdUt: 2461327.5, raDeg: 144.00644, decDeg: 14.96129, mag: -1.918, deltaAu: 5.75762766226735, phaseDeg: 9.2535 },
  { id: 'jupiter', jdUt: 2462668.0, raDeg: 226.47669, decDeg: -16.29915, mag: -2.436, deltaAu: 4.52802099976389, phaseDeg: 6.2664 },
  { id: 'saturn', jdUt: 2461327.5, raDeg: 10.4201, decDeg: 1.53568, mag: 0.38, deltaAu: 8.44792286747823, phaseDeg: 1.0942 },
  { id: 'saturn', jdUt: 2462668.0, raDeg: 59.65969, decDeg: 18.63334, mag: 0.194, deltaAu: 10.021830148728, phaseDeg: 2.4685 },
  { id: 'uranus', jdUt: 2461327.5, raDeg: 62.94599, decDeg: 20.95356, mag: 5.631, deltaAu: 18.715598689532, phaseDeg: 2.0695 },
  { id: 'uranus', jdUt: 2462668.0, raDeg: 77.59043, decDeg: 23.00379, mag: 5.763, deltaAu: 20.1998972475629, phaseDeg: 0.283 },
  { id: 'neptune', jdUt: 2461327.5, raDeg: 2.51824, decDeg: -0.45593, mag: 7.683, deltaAu: 28.9284826725118, phaseDeg: 0.5918 },
  { id: 'neptune', jdUt: 2462668.0, raDeg: 12.26132, decDeg: 3.62912, mag: 7.772, deltaAu: 30.1631951562329, phaseDeg: 1.8465 },
];

export interface TopocentricReference {
  id: 'sun' | 'moon' | 'saturn';
  place: string;
  latDeg: number;
  lonDeg: number;
  jdUt: number;
  azDeg: number;
  altDeg: number;
}

const LISBON = { place: 'Lisboa', latDeg: 38.7223, lonDeg: -9.1393 };
const SYDNEY = { place: 'Sydney', latDeg: -33.8688, lonDeg: 151.2093 };

export const HORIZONS_TOPOCENTRIC: TopocentricReference[] = [
  { id: 'moon', ...LISBON, jdUt: 2461327.25, azDeg: 225.697707, altDeg: 10.418931 },
  { id: 'moon', ...LISBON, jdUt: 2461328.375, azDeg: 243.787998, altDeg: -11.345405 },
  { id: 'moon', ...LISBON, jdUt: 2462668.0, azDeg: 343.539961, altDeg: -73.706762 },
  { id: 'sun', ...LISBON, jdUt: 2461327.25, azDeg: 260.232815, altDeg: -0.590644 },
  { id: 'sun', ...LISBON, jdUt: 2461328.375, azDeg: 290.02714, altDeg: -35.524247 },
  { id: 'saturn', ...SYDNEY, jdUt: 2461327.5, azDeg: 209.903286, altDeg: -54.102768 },
  { id: 'saturn', ...SYDNEY, jdUt: 2462668.0, azDeg: 197.887829, altDeg: -74.188622 },
];

/** Tempo sideral aparente local em Lisboa (horas) indicado pelo Horizons, 2026-10-13 18:00 UT. */
export const HORIZONS_LISBON_LAST = { jdUt: 2461327.25, hours: 18.8781472026 };
