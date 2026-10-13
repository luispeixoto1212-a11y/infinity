import type { Vec3 } from '../core/astro/vector';

/**
 * Vetores heliocêntricos de referência do JPL Horizons (efemérides DE441; Plutão: plu060;
 * Ceres: solução JPL#48), eclíptica e equinócio J2000, em UA, para 2026-10-13 00:00 TDB
 * (JD 2461326,5). Consultados em 2026-10-13. Usados para validar os cálculos da aplicação,
 * tanto nos testes automáticos como na página "Dados e métodos".
 */
export const HORIZONS_EPOCH_JD = 2461326.5;

export const HORIZONS_REFERENCE: Array<{ id: string; target: string; vector: Vec3 }> = [
  { id: 'mercury', target: 'Mercury Barycenter (199)', vector: { x: 0.2323234864567537, y: -0.3623689472891269, z: -0.05092214818009169 } },
  { id: 'venus', target: 'Venus Barycenter (299)', vector: { x: 0.7072613984458568, y: 0.1578203921569187, z: -0.03863929204229381 } },
  { id: 'earth', target: 'Earth-Moon Barycenter (3)', vector: { x: 0.9418082780149146, y: 0.3298835816798076, z: -0.00002579590631671904 } },
  { id: 'mars', target: 'Mars Barycenter (4)', vector: { x: -0.03415195876904606, y: 1.57205428199479, z: 0.03378190644832824 } },
  { id: 'jupiter', target: 'Jupiter Barycenter (5)', vector: { x: -3.559263178056845, y: 3.941139783288298, z: 0.06326221878451932 } },
  { id: 'saturn', target: 'Saturn Barycenter (6)', vector: { x: 9.242660175116331, y: 1.832247407116397, z: -0.3998240432362191 } },
  { id: 'uranus', target: 'Uranus Barycenter (7)', vector: { x: 8.888372654268473, y: 17.28794413238016, z: -0.05104211072869066 } },
  { id: 'neptune', target: 'Neptune Barycenter (8)', vector: { x: 29.83548968423944, y: 1.41797514569158, z: -0.7167509592421687 } },
  { id: 'pluto', target: 'Pluto (999)', vector: { x: 19.99637695846238, y: -29.35726247423178, z: -2.641955490586832 } },
  { id: 'ceres', target: '1 Ceres (A801 AA)', vector: { x: 0.1549575356434838, y: 2.65913332952652, z: 0.05563588664633524 } },
];

/** Vetor geocêntrico da Lua (km, eclíptica J2000) do JPL Horizons (DE441) para a mesma data. */
export const HORIZONS_MOON_GEOCENTRIC_KM: Vec3 = {
  x: -270526.8077008485,
  y: -287810.1873700487,
  z: -34524.02236662571,
};
