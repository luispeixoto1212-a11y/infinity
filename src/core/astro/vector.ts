export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const DEG = Math.PI / 180;

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function normalize(v: Vec3): Vec3 {
  const l = length(v);
  return l === 0 ? { x: 0, y: 0, z: 0 } : scale(v, 1 / l);
}

/** Ângulo entre dois vetores, em graus. */
export function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const c = dot(a, b) / (length(a) * length(b));
  return Math.acos(Math.min(1, Math.max(-1, c))) / DEG;
}

/** Normaliza um ângulo em graus para o intervalo [0, 360). */
export function wrapDeg360(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Normaliza um ângulo em graus para o intervalo [-180, 180). */
export function wrapDeg180(deg: number): number {
  return wrapDeg360(deg + 180) - 180;
}
