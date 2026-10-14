/**
 * Paralaxes do Hipparcos (nova redução, van Leeuwen 2007; VizieR I/311/hip2), consultadas diretamente a
 * 2026-10-14 e independentes do catálogo AT-HYG usado pela aplicação. Servem para verificar as distâncias.
 * [número HIP, paralaxe (mas), erro (mas)]
 */
export const HIPPARCOS_CHECK: ReadonlyArray<[number, number, number]> = [
  [32349, 379.21, 1.58], // Sírio
  [30438, 10.55, 0.56], // Canopus
  [69673, 88.83, 0.54], // Arcturus
  [91262, 130.23, 0.36], // Vega
  [24608, 76.2, 0.46], // Capella
  [24436, 3.78, 0.34], // Rigel
  [37279, 284.56, 1.26], // Procyon
  [27989, 6.55, 0.83], // Betelgeuse
  [97649, 194.95, 0.57], // Altair
  [21421, 48.94, 0.77], // Aldebaran
  [80763, 5.89, 1.0], // Antares
  [65474, 13.06, 0.7], // Spica
  [37826, 96.54, 0.27], // Pollux
  [113368, 129.81, 0.47], // Fomalhaut
  [102098, 2.31, 0.32], // Deneb
  [49669, 41.13, 0.35], // Regulus
  [11767, 7.54, 0.11], // Polaris
  [71683, 754.81, 4.11], // Rigil Kentaurus
  [70890, 771.64, 2.6], // Proxima Centauri
  [87937, 548.31, 1.51], // Estrela de Barnard
  [7588, 23.39, 0.57], // Achernar
];
