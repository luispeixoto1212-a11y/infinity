import type { CelestialBody } from '../../data/types';
import { osculatingPositionAu, planetPositionAu } from './kepler';
import { moonGeocentricKm } from './moon';
import type { Vec3 } from './vector';

const AU_KM = 149_597_870.7;

/** Posição heliocêntrica verdadeira (UA, eclíptica J2000) de qualquer corpo do catálogo. */
export function heliocentricPositionAu(body: CelestialBody, jdTdb: number): Vec3 {
  switch (body.orbit.kind) {
    case 'jpl-approx':
      return planetPositionAu(body.orbit.key, jdTdb);
    case 'osculating':
      return osculatingPositionAu(body.orbit.elements, jdTdb);
    case 'lunar-mean': {
      const e = planetPositionAu('emb', jdTdb);
      const m = moonGeocentricKm(jdTdb);
      return { x: e.x + m.x / AU_KM, y: e.y + m.y / AU_KM, z: e.z + m.z / AU_KM };
    }
    default:
      return { x: 0, y: 0, z: 0 };
  }
}
