/**
 * Valores obtidos diretamente da API TAP do NASA Exoplanet Archive (tabela pscomppars) a 2026-10-14,
 * independentes da cópia usada pela aplicação (Open Exoplanet Catalogue, 2026-10-13). Servem para
 * verificar nos testes que a cópia corresponde ao arquivo.
 * Colunas: pl_name, pl_orbper (dias), pl_orbsmax (UA), pl_rade (R⊕), pl_bmasse (M⊕), pl_eqt (K), disc_year.
 */
export const ARCHIVE_CHECK_DATE = '2026-10-14';

export const ARCHIVE_CHECK: ReadonlyArray<[string, number, number, number, number, number | null, number]> = [
  ['TRAPPIST-1 b', 1.510826, 0.01154, 1.116, 1.374, 397.6, 2016],
  ['TRAPPIST-1 e', 6.101013, 0.02925, 0.92, 0.692, 249.7, 2017],
  ['TRAPPIST-1 h', 18.772866, 0.06189, 0.755, 0.326, 171.7, 2017],
  ['Proxima Cen b', 11.18465, 0.04848, 1.02, 1.055, 218, 2016],
  ['Proxima Cen d', 5.12338, 0.02881, 0.692, 0.26, 282, 2025],
  ['Kepler-452 b', 384.843, 1.046, 1.63, 3.29, 265, 2015],
  ['Kepler-186 f', 129.9441, 0.432, 1.17, 1.71, 177, 2014],
  ['51 Peg b', 4.2307966, 0.052, 14.1, 193.87532827, 1328.93, 1995],
  ['HD 209458 b', 3.52474859, 0.04707, 15.58051, 232.0159, 1459, 1999],
  ['WASP-39 b', 4.0552941, 0.04828, 14.336311, 89.31023, 1166, 2011],
  ['K2-18 b', 32.939623, 0.1429, 2.37, 8.92, 284, 2015],
  ['55 Cnc e', 0.7365474, 0.01544, 1.875, 7.99, 1958, 2004],
  ['KOI-351 h', 331.60296, 0.97062, 11.252, 203, 294, 2013],
  ['TOI-700 d', 37.423457, 0.1642, 1.145, 1.58, 268.8, 2020],
  ['PSR B1257+12 c', 66.5419, 0.36, 1.91, 4.3, null, 1992],
  ['Kepler-16 b', 228.776, 0.7048, 8.4493, 105.833, 205.9, 2011],
];
