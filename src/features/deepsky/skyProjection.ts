/**
 * Projeção de Hammer–Aitoff do céu inteiro em coordenadas equatoriais (J2000).
 * Mantém as áreas (um objeto grande continua grande em qualquer parte do mapa).
 * Como num mapa do céu visto da Terra, a ascensão reta cresce para a esquerda;
 * o centro do mapa fica a 12 h de ascensão reta e as 0 h ficam nas margens.
 */

export const SKY_CENTER_RA = 180;
const SQRT2 = Math.SQRT2;
const D = Math.PI / 180;

/** Largura e altura totais do mapa, nas unidades da projeção. */
export const SKY_WIDTH = 4 * SQRT2;
export const SKY_HEIGHT = 2 * SQRT2;

export interface SkyPoint {
  x: number;
  y: number;
}

/** Longitude relativa ao centro, em graus (−180 a 180); positiva para leste (esquerda do mapa). */
export function relativeRa(raDeg: number): number {
  return ((((raDeg - SKY_CENTER_RA) % 360) + 540) % 360) - 180;
}

/** (ascensão reta, declinação) em graus → (x, y) da projeção; y cresce para baixo, como no SVG. */
export function project(raDeg: number, decDeg: number): SkyPoint {
  const lam = -relativeRa(raDeg) * D;
  const phi = decDeg * D;
  const z = Math.sqrt(1 + Math.cos(phi) * Math.cos(lam / 2));
  return { x: (2 * SQRT2 * Math.cos(phi) * Math.sin(lam / 2)) / z, y: -(SQRT2 * Math.sin(phi)) / z };
}

/** Inverso de project(); devolve null fora da elipse do mapa. */
export function unproject(x: number, y: number): { ra: number; dec: number } | null {
  const yy = -y;
  if ((x / (2 * SQRT2)) ** 2 + (yy / SQRT2) ** 2 > 1) return null;
  const z = Math.sqrt(1 - (x / 4) ** 2 - (yy / 2) ** 2);
  const lam = 2 * Math.atan2(z * x, 2 * (2 * z * z - 1));
  const phi = Math.asin(Math.max(-1, Math.min(1, z * yy)));
  const ra = (((SKY_CENTER_RA - lam / D) % 360) + 360) % 360;
  return { ra, dec: phi / D };
}

/**
 * Converte uma linha (lista de pontos em graus) em percursos SVG, cortando-a onde atravessa
 * a margem do mapa (0 h de ascensão reta), para não desenhar traços de um lado ao outro.
 */
export function polylinePaths(points: ReadonlyArray<readonly [number, number]>, digits = 4): string[] {
  const paths: string[] = [];
  let current: string[] = [];
  let prevRel: number | null = null;
  for (const [ra, dec] of points) {
    const rel = relativeRa(ra);
    if (prevRel !== null && Math.abs(rel - prevRel) > 180) {
      if (current.length > 1) paths.push(current.join(' '));
      current = [];
    }
    const p = project(ra, dec);
    current.push(`${current.length === 0 ? 'M' : 'L'}${p.x.toFixed(digits)} ${p.y.toFixed(digits)}`);
    prevRel = rel;
  }
  if (current.length > 1) paths.push(current.join(' '));
  return paths;
}

/** Pontos da eclíptica (J2000) em ascensão reta e declinação, a cada `step` graus de longitude. */
export function eclipticPoints(step = 2, obliquityDeg = 23.4393): Array<[number, number]> {
  const e = obliquityDeg * D;
  const out: Array<[number, number]> = [];
  for (let l = 0; l <= 360; l += step) {
    const lam = l * D;
    const ra = Math.atan2(Math.cos(e) * Math.sin(lam), Math.cos(lam)) / D;
    const dec = Math.asin(Math.sin(e) * Math.sin(lam)) / D;
    out.push([(ra + 360) % 360, dec]);
  }
  return out;
}

/** Contorno da elipse do mapa (para recortar e desenhar a borda). */
export function outlinePath(segments = 180): string {
  const pts: string[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(`${i === 0 ? 'M' : 'L'}${(2 * SQRT2 * Math.cos(t)).toFixed(4)} ${(SQRT2 * Math.sin(t)).toFixed(4)}`);
  }
  return `${pts.join(' ')} Z`;
}
