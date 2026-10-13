import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
} from 'three';
import { equatorialToEcliptic, radecToUnit } from '../../../core/astro/orientation';
import { eclipticToScene } from '../../../core/astro/scale';

/** Catálogo processado (Yale Bright Star Catalogue via d3-celestial), servido em public/data/stars.json. */
export interface StarCatalog {
  source: string;
  epoch: string;
  columns: string[];
  stars: Array<[number, number, number, number, number, string, string, string]>;
}

export function isStarCatalog(v: unknown): v is StarCatalog {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Partial<StarCatalog>;
  return (
    Array.isArray(c.stars) &&
    c.stars.length > 0 &&
    c.stars.every((s) => Array.isArray(s) && typeof s[0] === 'number' && typeof s[1] === 'number' && typeof s[2] === 'number')
  );
}

export async function fetchStarCatalog(signal?: AbortSignal): Promise<StarCatalog> {
  const res = await fetch('data/stars.json', { signal });
  if (!res.ok) throw new Error(`Catálogo de estrelas indisponível (${res.status})`);
  const json: unknown = await res.json();
  if (!isStarCatalog(json)) throw new Error('Catálogo de estrelas com formato inválido');
  return json;
}

/**
 * Cor aproximada de uma estrela a partir do índice B−V:
 * temperatura pela fórmula de Ballesteros (2012) e cor de corpo negro aproximada.
 */
export function bvToRgb(bv: number): [number, number, number] {
  const b = Math.min(2, Math.max(-0.4, bv));
  const t = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  // Aproximação de Tanner Helland para a cor de corpo negro (t em kelvin)
  const k = t / 100;
  let r: number;
  let g: number;
  let bl: number;
  if (k <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(k) - 161.1195681661;
    bl = k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(k - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(k - 60, -0.0755148492);
    bl = 255;
  }
  const clamp = (x: number) => Math.min(255, Math.max(0, x)) / 255;
  return [clamp(r), clamp(g), clamp(bl)];
}

export const STAR_SPHERE_RADIUS = 6000;

export function createStarfield(catalog: StarCatalog, magLimit: number, pixelRatio: number): Points {
  const rows = catalog.stars.filter((s) => s[2] <= magLimit);
  const positions = new Float32Array(rows.length * 3);
  const colors = new Float32Array(rows.length * 3);
  const sizes = new Float32Array(rows.length);
  rows.forEach((s, i) => {
    const ecl = equatorialToEcliptic(radecToUnit(s[0], s[1]));
    const p = eclipticToScene(ecl);
    positions.set([p.x * STAR_SPHERE_RADIUS, p.y * STAR_SPHERE_RADIUS, p.z * STAR_SPHERE_RADIUS], i * 3);
    const [r, g, b] = bvToRgb(s[3]);
    // Fluxo relativo ∝ 10^(−0,4·m); o tamanho cresce com a raiz do fluxo, com limites para legibilidade.
    const flux = Math.pow(10, -0.4 * (s[2] - 6));
    const size = Math.min(10, Math.max(1.6, 1.5 * Math.pow(flux, 0.3)));
    const brightness = Math.min(1, 0.55 + 0.45 * Math.pow(flux, 0.25) / 2.5);
    colors.set([r * brightness, g * brightness, b * brightness], i * 3);
    sizes[i] = size;
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('size', new BufferAttribute(sizes, 1));

  const material = new ShaderMaterial({
    uniforms: { uPixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute float size;
      varying vec3 vColor;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        gl_FragColor = vec4(vColor * a, a);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  points.name = 'starfield';
  points.frustumCulled = false;
  points.renderOrder = -10;
  return points;
}
