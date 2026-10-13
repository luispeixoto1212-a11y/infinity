/**
 * Órbitas das luas (exceto a Lua da Terra), ajustadas a vetores de estado do JPL Horizons.
 *
 * Método: elementos osculadores calculados a partir da posição e velocidade em relação ao planeta
 * a 2026-10-13 00:00 TDB (JD 2461326,5; eclíptica J2000) e um movimento médio n ajustado às
 * posições do Horizons 400 dias antes e 365,25 dias depois. A contagem de voltas entre essas datas usa
 * o período sideral publicado (elementos médios do JPL; ficha de Marte da NASA para Fobos e Deimos).
 * Propagação como órbita kepleriana fixa: a precisão é melhor perto de 2026 e diminui para datas
 * distantes (precessão da órbita e perturbações não incluídas).
 *
 * Unidades: a [km]; i, node (Ω), peri (ω), M0 [graus]; n [graus/dia].
 * inclinationToEquator: ângulo entre a órbita e o equador do planeta (sentido de rotação), em graus.
 * fitErrorDeg: maior diferença angular (vista do planeta) face ao Horizons nas duas datas usadas no ajuste.
 * A verificação independente (outras datas) está em moonValidation.ts.
 * Gerado por tools/moons_build.py (fora do repositório) — fonte: JPL Horizons, consultado em 2026-10-13.
 */
export interface SatelliteElements {
  horizonsId: number;
  epochJd: number;
  a: number;
  e: number;
  i: number;
  node: number;
  peri: number;
  M0: number;
  n: number;
  inclinationToEquator: number;
  fitErrorDeg: number;
}

export const SATELLITE_ELEMENTS = {
  io: { horizonsId: 501, epochJd: 2461326.5, a: 422048.8, e: 0.004835, i: 2.22800, node: 338.40359, peri: 34.06183, M0: 352.95844, n: 203.4885372, inclinationToEquator: 0.03, fitErrorDeg: 0.38 },
  europa: { horizonsId: 502, epochJd: 2461326.5, a: 671280.9, e: 0.008947, i: 2.07634, node: 326.20178, peri: 227.77222, M0: 175.55548, n: 101.3729030, inclinationToEquator: 0.46, fitErrorDeg: 0.38 },
  ganymede: { horizonsId: 503, epochJd: 2461326.5, a: 1070677.8, e: 0.002905, i: 2.34348, node: 339.06620, peri: 1.92991, M0: 300.70815, n: 50.3176398, inclinationToEquator: 0.14, fitErrorDeg: 0.05 },
  callisto: { horizonsId: 504, epochJd: 2461326.5, a: 1882399.8, e: 0.007322, i: 1.95243, node: 336.74753, peri: 33.14235, M0: 106.71955, n: 21.5710868, inclinationToEquator: 0.27, fitErrorDeg: 0.00 },
  mimas: { horizonsId: 601, epochJd: 2461326.5, a: 186028.0, e: 0.021168, i: 28.45053, node: 172.74764, peri: 166.51711, M0: 307.83649, n: 381.9974860, inclinationToEquator: 1.58, fitErrorDeg: 0.91 },
  enceladus: { horizonsId: 602, epochJd: 2461326.5, a: 238405.0, e: 0.003082, i: 28.04358, node: 169.53075, peri: 197.99178, M0: 175.98687, n: 262.7309156, inclinationToEquator: 0.01, fitErrorDeg: 0.12 },
  tethys: { horizonsId: 603, epochJd: 2461326.5, a: 294976.1, e: 0.001064, i: 28.17191, node: 171.82723, peri: 303.54448, M0: 356.51564, n: 190.6979531, inclinationToEquator: 1.09, fitErrorDeg: 1.09 },
  dione: { horizonsId: 604, epochJd: 2461326.5, a: 377660.8, e: 0.001533, i: 28.02565, node: 169.54988, peri: 270.50085, M0: 195.38206, n: 131.5348318, inclinationToEquator: 0.03, fitErrorDeg: 0.13 },
  rhea: { horizonsId: 605, epochJd: 2461326.5, a: 527254.7, e: 0.001291, i: 28.27424, node: 169.96773, peri: 154.79455, M0: 305.21990, n: 79.6901228, inclinationToEquator: 0.30, fitErrorDeg: 0.06 },
  titan: { horizonsId: 606, epochJd: 2461326.5, a: 1221961.2, e: 0.028774, i: 27.70555, node: 169.08072, peri: 178.28734, M0: 306.39822, n: 22.5769654, inclinationToEquator: 0.40, fitErrorDeg: 0.01 },
  iapetus: { horizonsId: 608, epochJd: 2461326.5, a: 3564694.1, e: 0.029452, i: 16.97687, node: 138.86811, peri: 230.77654, M0: 315.67817, n: 4.5380623, inclinationToEquator: 15.81, fitErrorDeg: 0.09 },
  phobos: { horizonsId: 401, epochJd: 2461326.5, a: 9379.2, e: 0.014712, i: 25.63987, node: 82.59226, peri: 283.29162, M0: 127.20061, n: 1128.8510334, inclinationToEquator: 1.00, fitErrorDeg: 1.95 },
  deimos: { horizonsId: 402, epochJd: 2461326.5, a: 23458.5, e: 0.000243, i: 24.12082, node: 81.54471, peri: 26.57752, M0: 223.41444, n: 285.1618227, inclinationToEquator: 1.89, fitErrorDeg: 0.22 },
  miranda: { horizonsId: 705, epochJd: 2461326.5, a: 129871.8, e: 0.001445, i: 97.99284, node: 163.18769, peri: 66.01106, M0: 313.90357, n: 254.6929651, inclinationToEquator: 4.43, fitErrorDeg: 0.25 },
  ariel: { horizonsId: 701, epochJd: 2461326.5, a: 190943.5, e: 0.000502, i: 97.71804, node: 167.66586, peri: 258.81595, M0: 286.13967, n: 142.8354763, inclinationToEquator: 0.02, fitErrorDeg: 0.02 },
  umbriel: { horizonsId: 702, epochJd: 2461326.5, a: 265980.4, e: 0.003333, i: 97.71443, node: 167.72530, peri: 65.76671, M0: 288.32261, n: 86.8686981, inclinationToEquator: 0.08, fitErrorDeg: 0.01 },
  titania: { horizonsId: 703, epochJd: 2461326.5, a: 436252.1, e: 0.001971, i: 97.76214, node: 167.64365, peri: 280.80885, M0: 194.58478, n: 41.3514274, inclinationToEquator: 0.04, fitErrorDeg: 0.16 },
  oberon: { horizonsId: 704, epochJd: 2461326.5, a: 583591.3, e: 0.002479, i: 97.90572, node: 167.70829, peri: 171.10409, M0: 8.61607, n: 26.7394322, inclinationToEquator: 0.19, fitErrorDeg: 0.18 },
  triton: { horizonsId: 801, epochJd: 2461326.5, a: 354767.6, e: 0.000115, i: 129.12646, node: 222.86749, peri: 119.79463, M0: 108.33377, n: 61.2573716, inclinationToEquator: 156.82, fitErrorDeg: 0.22 },
  charon: { horizonsId: 901, epochJd: 2461326.5, a: 19589.1, e: 0.000299, i: 112.88777, node: 227.39308, peri: 263.24734, M0: 208.09652, n: 56.3625415, inclinationToEquator: 0.08, fitErrorDeg: 0.03 },
} as const satisfies Record<string, SatelliteElements>;

export type SatelliteKey = keyof typeof SATELLITE_ELEMENTS;
