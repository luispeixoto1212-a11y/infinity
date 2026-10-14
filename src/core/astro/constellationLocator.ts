import { B1875_JD, mulMat3Vec, precessionMatrix } from './precession';
import { J2000_JD } from './time';
import { radecToUnit } from './orientation';
import { DEG, wrapDeg360 } from './vector';

/** Limites das constelações: por abreviatura, anéis de vértices [ascensão reta, declinação] J2000 (graus). */
export type ConstellationBounds = Record<string, Array<Array<[number, number]>>>;

interface Ring {
  abbr: string;
  /** Vértices em B1875: ascensão reta e declinação alternadas (graus). */
  pts: Float64Array;
  /** O anel rodeia o polo norte celeste de B1875 (Ursa Menor). */
  northCap: boolean;
}

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const P_J2000_TO_B1875 = precessionMatrix(J2000_JD, B1875_JD);

function toB1875(raDeg: number, decDeg: number): [number, number] {
  const v = mulMat3Vec(P_J2000_TO_B1875, radecToUnit(raDeg, decDeg));
  return [wrapDeg360(Math.atan2(v.y, v.x) / DEG), Math.asin(Math.max(-1, Math.min(1, v.z))) / DEG];
}

/**
 * Identifica a constelação de uma direção do céu.
 *
 * Os limites oficiais (Delporte, 1930) são arcos de ascensão reta e de declinação constantes no equinócio
 * de B1875. Por isso os vértices e o ponto são levados para B1875 por precessão e o teste faz-se nesse
 * referencial: um raio do ponto até ao polo norte, ao longo do meridiano, cruza um número ímpar de
 * limites se o ponto estiver dentro (regra invertida para o anel que contém o polo).
 */
export class ConstellationLocator {
  private readonly rings: Ring[] = [];

  constructor(bounds: ConstellationBounds) {
    for (const [abbr, rings] of Object.entries(bounds)) {
      for (const ring of rings) {
        const pts = new Float64Array(ring.length * 2);
        let winding = 0;
        let decSum = 0;
        ring.forEach(([ra, dec], i) => {
          const [a, d] = toB1875(ra, dec);
          pts[i * 2] = a;
          pts[i * 2 + 1] = d;
          decSum += d;
        });
        const n = ring.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          winding += wrap180(pts[j * 2]! - pts[i * 2]!);
        }
        this.rings.push({ abbr, pts, northCap: Math.abs(winding) > 180 && decSum / n > 0 });
      }
    }
  }

  /** Abreviatura da IAU (por exemplo "Ori") da constelação que contém a direção J2000 indicada. */
  find(raJ2000: number, decJ2000: number): string | null {
    const [ra, dec] = toB1875(raJ2000, decJ2000);
    for (const ring of this.rings) {
      if (this.inside(ring, ra, dec)) return ring.abbr;
    }
    return null;
  }

  private inside(ring: Ring, ra: number, dec: number): boolean {
    const p = ring.pts;
    const n = p.length / 2;
    let crossings = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a1 = p[i * 2]!;
      const d1 = p[i * 2 + 1]!;
      const span = wrap180(p[j * 2]! - a1);
      if (Math.abs(span) < 1e-9) continue;
      const off = wrap180(ra - a1);
      const within = span > 0 ? off >= 0 && off < span : off < 0 && off >= span;
      if (!within) continue;
      const edgeDec = d1 + (off / span) * (p[j * 2 + 1]! - d1);
      if (edgeDec > dec) crossings++;
    }
    return (crossings % 2 === 1) !== ring.northCap;
  }
}

export function parseConstellationBounds(raw: unknown): ConstellationBounds {
  const r = raw as { bounds?: ConstellationBounds };
  if (!r || typeof r.bounds !== 'object' || r.bounds === null) throw new Error('Formato dos limites das constelações inválido');
  return r.bounds;
}
