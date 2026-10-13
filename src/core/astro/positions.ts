import { getBody, numericFact } from '../../data/catalog';
import type { CelestialBody } from '../../data/types';
import { osculatingPositionAu, planetPositionAu } from './kepler';
import { moonGeocentricKm } from './moon';
import { satelliteOffsetKm } from './satellites';
import type { Vec3 } from './vector';

export const AU_KM = 149_597_870.7;

/** Posição de uma lua em relação ao seu planeta (km, eclíptica J2000). */
export function planetocentricOffsetKm(body: CelestialBody, jdTdb: number): Vec3 | null {
  if (body.orbit.kind === 'lunar-mean') return moonGeocentricKm(jdTdb);
  if (body.orbit.kind === 'satellite') return satelliteOffsetKm(body.orbit.key, jdTdb);
  return null;
}

/** Posição heliocêntrica verdadeira (UA, eclíptica J2000) de qualquer corpo do catálogo. */
export function heliocentricPositionAu(body: CelestialBody, jdTdb: number): Vec3 {
  switch (body.orbit.kind) {
    case 'jpl-approx':
      return planetPositionAu(body.orbit.key, jdTdb);
    case 'osculating':
      return osculatingPositionAu(body.orbit.elements, jdTdb);
    case 'lunar-mean':
    case 'satellite': {
      const parent = body.parent ? heliocentricPositionAu(getBody(body.parent), jdTdb) : { x: 0, y: 0, z: 0 };
      const m = planetocentricOffsetKm(body, jdTdb)!;
      return { x: parent.x + m.x / AU_KM, y: parent.y + m.y / AU_KM, z: parent.z + m.z / AU_KM };
    }
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

/** Raio equatorial (km) usado como referência para as distâncias das luas. */
export function referenceRadiusKm(body: CelestialBody): number {
  return numericFact(body, 'equatorialRadius') ?? body.meanRadiusKm;
}
