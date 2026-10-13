import { BufferGeometry, Color, Float32BufferAttribute, Line, LineBasicMaterial } from 'three';
import { sampleOsculatingOrbitAu, samplePlanetOrbitAu } from '../../../core/astro/kepler';
import { heliocentricAuToScene } from '../../../core/astro/scale';
import type { Vec3 } from '../../../core/astro/vector';
import type { CelestialBody } from '../../../data/types';

export interface OrbitLine {
  line: Line;
  material: LineBasicMaterial;
  bodyId: string;
  /** Data (JD) para a qual a elipse foi calculada. */
  computedAt: number;
  setHighlighted(on: boolean): void;
  update(points: Vec3[], jd: number): void;
  dispose(): void;
}

const BASE_OPACITY = 0.28;

export function heliocentricOrbitPoints(body: CelestialBody, jd: number): Vec3[] | null {
  switch (body.orbit.kind) {
    case 'jpl-approx':
      return samplePlanetOrbitAu(body.orbit.key, jd, 360).map(heliocentricAuToScene);
    case 'osculating':
      return sampleOsculatingOrbitAu(body.orbit.elements, 360).map(heliocentricAuToScene);
    default:
      return null;
  }
}

export function createOrbitLine(body: CelestialBody, points: Vec3[], jd: number): OrbitLine {
  const geometry = new BufferGeometry();
  const material = new LineBasicMaterial({
    color: new Color(body.render.accent),
    transparent: true,
    opacity: BASE_OPACITY,
    depthWrite: false,
  });
  const line = new Line(geometry, material);
  line.name = `${body.id}-orbit`;
  line.frustumCulled = false;
  const orbit: OrbitLine = {
    line,
    material,
    bodyId: body.id,
    computedAt: jd,
    setHighlighted(on) {
      material.opacity = on ? 0.85 : BASE_OPACITY;
    },
    update(pts, when) {
      const arr: number[] = [];
      for (const p of pts) arr.push(p.x, p.y, p.z);
      geometry.setAttribute('position', new Float32BufferAttribute(arr, 3));
      geometry.computeBoundingSphere();
      orbit.computedAt = when;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      line.removeFromParent();
    },
  };
  orbit.update(points, jd);
  return orbit;
}
