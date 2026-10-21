/**
 * Desenho do céu local em Canvas 2D, em projeção estereográfica (conserva as formas das constelações).
 * Referencial: este (x), norte (y), zénite (z). O azimute conta-se a partir do norte, para este.
 */
import { refractionDeg, type SkyBodyId } from '../../core/astro/sky';
import { DEG, type Vec3 } from '../../core/astro/vector';
import { constellationName } from '../../data/constellations';
import { SUBTYPE_COLOR } from '../deepsky/DeepSkyGlyph';
import { milkyWayLevel } from '../deepsky/skyMapData';
import type { SkyScene } from './skyScene';
import { type SkyInstant, twilightMagnitudeLimit } from './skyState';

export interface ViewParams {
  azDeg: number;
  altDeg: number;
  /** Campo de visão (graus) na menor dimensão do ecrã. */
  fovDeg: number;
}

export const MIN_FOV = 4;
export const MAX_FOV = 200;
export const DOME_VIEW: ViewParams = { azDeg: 180, altDeg: 90, fovDeg: 180 };
export const HORIZON_VIEW: ViewParams = { azDeg: 180, altDeg: 25, fovDeg: 100 };

export interface Layers {
  constellationLines: boolean;
  constellationNames: boolean;
  boundaries: boolean;
  starNames: boolean;
  azGrid: boolean;
  eqGrid: boolean;
  ecliptic: boolean;
  milkyWay: boolean;
  deepSky: boolean;
  planets: boolean;
}

export const DEFAULT_LAYERS: Layers = {
  constellationLines: true,
  constellationNames: true,
  boundaries: false,
  starNames: true,
  azGrid: false,
  eqGrid: false,
  ecliptic: false,
  milkyWay: true,
  deepSky: true,
  planets: true,
};

export interface RenderOptions {
  layers: Layers;
  /** Magnitude limite escolhida (poluição luminosa). */
  magLimit: number;
  /** Simula o brilho do céu de dia e no crepúsculo. */
  atmosphere: boolean;
  /** Esconde o que está abaixo do horizonte. */
  ground: boolean;
  /** Seleção atual (para o anel de destaque). */
  selected: SelectionKey | null;
}

export type SelectionKey = { kind: 'star'; index: number } | { kind: 'body'; id: SkyBodyId } | { kind: 'dso'; id: string };

export const sameSelection = (a: SelectionKey | null, b: SelectionKey | null) =>
  !!a &&
  !!b &&
  a.kind === b.kind &&
  (a.kind === 'star' ? a.index === (b as { index: number }).index : a.kind === 'body' ? a.id === (b as { id: string }).id : a.id === (b as { id: string }).id);

// ——— Projeção ———

export interface Projector {
  width: number;
  height: number;
  cx: number;
  cy: number;
  scale: number;
  f: Vec3;
  r: Vec3;
  u: Vec3;
}

export function makeProjector(view: ViewParams, width: number, height: number): Projector {
  const A = view.azDeg * DEG;
  const h = view.altDeg * DEG;
  const f = { x: Math.sin(A) * Math.cos(h), y: Math.cos(A) * Math.cos(h), z: Math.sin(h) };
  const r = { x: Math.cos(A), y: -Math.sin(A), z: 0 };
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  // Margem de 16 px para os pontos cardeais ficarem dentro do ecrã na vista em cúpula
  const scale = Math.max(40, Math.min(width, height) / 2 - 16) / Math.tan((view.fovDeg * DEG) / 4);
  return { width, height, cx: width / 2, cy: height / 2, scale, f, r, u };
}

/** Projeta um vetor unitário; devolve null se estiver muito atrás do observador. */
export function projectVec(p: Projector, x: number, y: number, z: number): { x: number; y: number } | null {
  const d = 1 + x * p.f.x + y * p.f.y + z * p.f.z;
  if (d < 0.02) return null;
  const X = (x * p.r.x + y * p.r.y + z * p.r.z) / d;
  const Y = (x * p.u.x + y * p.u.y + z * p.u.z) / d;
  return { x: p.cx + p.scale * X, y: p.cy - p.scale * Y };
}

/** Direção (este–norte–zénite) do ponto do ecrã indicado. */
export function unprojectScreen(p: Projector, sx: number, sy: number): Vec3 {
  const X = (sx - p.cx) / p.scale;
  const Y = -(sy - p.cy) / p.scale;
  const rho2 = X * X + Y * Y;
  const k = 1 / (1 + rho2);
  const a = 2 * X * k;
  const b = 2 * Y * k;
  const c = (1 - rho2) * k;
  return {
    x: a * p.r.x + b * p.u.x + c * p.f.x,
    y: a * p.r.y + b * p.u.y + c * p.f.y,
    z: a * p.r.z + b * p.u.z + c * p.f.z,
  };
}

/** Aplica a refração a um vetor este–norte–zénite (eleva os astros perto do horizonte). */
function refract(x: number, y: number, z: number): [number, number, number] {
  if (z < -0.07 || z > 0.5) return [x, y, z];
  const alt = Math.asin(Math.max(-1, Math.min(1, z))) / DEG;
  const R = refractionDeg(alt);
  if (R === 0) return [x, y, z];
  const na = (alt + R) * DEG;
  const hz = Math.hypot(x, y) || 1e-12;
  const c = Math.cos(na) / hz;
  return [x * c, y * c, Math.sin(na)];
}

// ——— Cores ———

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const BODY_COLORS: Record<SkyBodyId, string> = {
  sun: '#ffd76a',
  moon: '#e9e6dc',
  mercury: '#cdbfae',
  venus: '#fff2cf',
  mars: '#ff8a5c',
  jupiter: '#f3dcb2',
  saturn: '#e9d398',
  uranus: '#b9eef2',
  neptune: '#93b4ff',
};

export const BODY_NAMES_PT: Record<SkyBodyId, string> = {
  sun: 'Sol',
  moon: 'Lua',
  mercury: 'Mercúrio',
  venus: 'Vénus',
  mars: 'Marte',
  jupiter: 'Júpiter',
  saturn: 'Saturno',
  uranus: 'Úrano',
  neptune: 'Neptuno',
};

/** Quanto o céu está iluminado pelo Sol (0 = noite, 1 = dia). */
export function daylight(inst: SkyInstant, atmosphere: boolean): number {
  return atmosphere ? smooth(-12, 3, inst.sunAltDeg) : 0;
}

/** Magnitude limite efetiva: a menor entre a escolhida e a permitida pelo brilho do céu. */
export function effectiveMagLimit(inst: SkyInstant, opts: Pick<RenderOptions, 'atmosphere' | 'magLimit'>): number {
  return opts.atmosphere ? Math.min(opts.magLimit, twilightMagnitudeLimit(inst.sunAltDeg)) : opts.magLimit;
}

/**
 * Fundo (céu, Via Láctea e chão) desenhado píxel a píxel a um quarto da resolução.
 * As cores do céu de dia e do crepúsculo são ilustrativas.
 */
export function paintBackground(
  canvas: HTMLCanvasElement,
  p: Projector,
  inst: SkyInstant,
  scene: SkyScene | null,
  opts: RenderOptions,
): void {
  const k = 4;
  const w = Math.max(1, Math.ceil(p.width / k));
  const h = Math.max(1, Math.ceil(p.height / k));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const sun = inst.bodies.find((b) => b.id === 'sun')!.enu;
  const day = daylight(inst, opts.atmosphere);
  const glowStrength = opts.atmosphere ? Math.max(0, 1 - Math.abs(inst.sunAltDeg + 3) / 9) : 0;
  const grid = opts.layers.milkyWay ? (scene?.milkyWay ?? null) : null;
  const mwFade = 1 - day;
  const M = inst.matrix;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const v = unprojectScreen(p, (i + 0.5) * k, (j + 0.5) * k);
      const o = (j * w + i) * 4;
      const up = v.z;
      if (opts.ground && up < 0) {
        // Chão: escuro de noite, castanho-esverdeado de dia
        const g = Math.min(1, -up * 3);
        d[o] = mix(16, 52, day) - g * 4;
        d[o + 1] = mix(18, 58, day) - g * 4;
        d[o + 2] = mix(16, 40, day) - g * 4;
        d[o + 3] = 255;
        continue;
      }
      const horizon = 1 - Math.max(0, up);
      // Noite: azul muito escuro, um pouco mais claro junto ao horizonte
      let rr = 4 + 8 * horizon * horizon;
      let gg = 7 + 11 * horizon * horizon;
      let bb = 18 + 18 * horizon * horizon;
      if (day > 0) {
        rr = mix(rr, mix(40, 150, horizon * horizon), day);
        gg = mix(gg, mix(102, 196, horizon * horizon), day);
        bb = mix(bb, mix(188, 236, horizon * horizon), day);
      }
      if (glowStrength > 0) {
        const cosSun = v.x * sun.x + v.y * sun.y + v.z * sun.z;
        const near = Math.exp(-(1 - cosSun) * 6) * Math.pow(horizon, 3) * glowStrength;
        rr += 210 * near;
        gg += 105 * near;
        bb += 40 * near;
      }
      if (grid && mwFade > 0.02) {
        // Direção J2000: transposta da matriz
        const ex = M[0] * v.x + M[3] * v.y + M[6] * v.z;
        const ey = M[1] * v.x + M[4] * v.y + M[7] * v.z;
        const ez = M[2] * v.x + M[5] * v.y + M[8] * v.z;
        const ra = (Math.atan2(ey, ex) / DEG + 360) % 360;
        const dec = Math.asin(Math.max(-1, Math.min(1, ez))) / DEG;
        const level = milkyWayLevel(grid, ra, dec) * mwFade;
        rr += level * 7;
        gg += level * 8;
        bb += level * 11;
      }
      if (!opts.ground && up < 0) {
        rr *= 0.7;
        gg *= 0.7;
        bb *= 0.75;
      }
      d[o] = rr;
      d[o + 1] = gg;
      d[o + 2] = bb;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ——— Desenho dos elementos ———

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface LabelRequest {
  text: string;
  x: number;
  y: number;
  /** Raio do astro: as posições alternativas rodeiam-no. */
  r: number;
  font: string;
  color: string;
  /** Menor = mais importante. */
  priority: number;
  /** Tenta várias posições à volta do astro (direita, esquerda, cima, baixo). */
  around: boolean;
  align?: CanvasTextAlign;
  /** Desenha mesmo que colida (pontos cardeais). */
  force?: boolean;
}

/** Coloca as etiquetas por ordem de importância, sem sobreposições. */
class LabelPlacer {
  private boxes: Box[] = [];
  private queue: LabelRequest[] = [];
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  add(req: LabelRequest) {
    this.queue.push(req);
  }

  flush() {
    const ctx = this.ctx;
    this.queue.sort((a, b) => a.priority - b.priority);
    for (const q of this.queue) {
      ctx.font = q.font;
      const w = ctx.measureText(q.text).width;
      const h = 12;
      const candidates: Array<[number, number, CanvasTextAlign]> = q.around
        ? [
            [q.x + q.r + 4, q.y + 4, 'left'],
            [q.x - q.r - 4, q.y + 4, 'right'],
            [q.x, q.y - q.r - 5, 'center'],
            [q.x, q.y + q.r + 13, 'center'],
          ]
        : [[q.x, q.y, q.align ?? 'left']];
      for (const [x, y, align] of candidates) {
        const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
        const box = { x0: x0 - 2, y0: y - h, x1: x0 + w + 2, y1: y + 3 };
        if (!q.force && this.boxes.some((b) => b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0)) continue;
        this.boxes.push(box);
        ctx.textAlign = align;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(3, 6, 16, 0.75)';
        ctx.strokeText(q.text, x, y);
        ctx.fillStyle = q.color;
        ctx.fillText(q.text, x, y);
        break;
      }
    }
    this.queue = [];
  }
}

/** Traça uma linha poligonal de vetores J2000 (ou já no referencial local), cortada no horizonte. */
function strokePath(
  ctx: CanvasRenderingContext2D,
  p: Projector,
  pts: Float64Array,
  M: readonly number[] | null,
  clipHorizon: boolean,
  closed = false,
) {
  const n = pts.length / 3;
  const maxJump = Math.max(p.width, p.height) * 0.6;
  const toLocal = (i: number): [number, number, number] => {
    const x = pts[i * 3]!;
    const y = pts[i * 3 + 1]!;
    const z = pts[i * 3 + 2]!;
    if (!M) return [x, y, z];
    return [M[0]! * x + M[1]! * y + M[2]! * z, M[3]! * x + M[4]! * y + M[5]! * z, M[6]! * x + M[7]! * y + M[8]! * z];
  };
  const segment = (a: [number, number, number], b: [number, number, number]) => {
    if (clipHorizon) {
      if (a[2] < 0 && b[2] < 0) return;
      if (a[2] < 0 || b[2] < 0) {
        const t = a[2] / (a[2] - b[2]);
        const c: [number, number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0];
        if (a[2] < 0) a = c;
        else b = c;
      }
    }
    const sa = projectVec(p, a[0], a[1], a[2]);
    const sb = projectVec(p, b[0], b[1], b[2]);
    if (!sa || !sb || Math.hypot(sb.x - sa.x, sb.y - sa.y) > maxJump) return;
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
  };
  const count = closed ? n + 1 : n;
  let prev: [number, number, number] | null = null;
  for (let k = 0; k < count; k++) {
    const cur = toLocal(k % n);
    if (prev) {
      // Lados longos são subdivididos ao longo do círculo máximo (a projeção curva-os)
      const cosA = prev[0] * cur[0] + prev[1] * cur[1] + prev[2] * cur[2];
      const parts = cosA > 0.9986 ? 1 : Math.min(30, Math.ceil(Math.acos(Math.max(-1, Math.min(1, cosA))) / (2.5 * DEG)));
      let a = prev;
      for (let j = 1; j <= parts; j++) {
        const t = j / parts;
        let b: [number, number, number] = cur;
        if (j < parts) {
          const bx = prev[0] + (cur[0] - prev[0]) * t;
          const by = prev[1] + (cur[1] - prev[1]) * t;
          const bz = prev[2] + (cur[2] - prev[2]) * t;
          const l = Math.hypot(bx, by, bz) || 1;
          b = [bx / l, by / l, bz / l];
        }
        segment(a, b);
        a = b;
      }
    }
    prev = cur;
  }
}

function circlePoints(fn: (t: number) => Vec3, steps: number): Float64Array {
  const out = new Float64Array((steps + 1) * 3);
  for (let i = 0; i <= steps; i++) {
    const v = fn(i / steps);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}

const ECLIPTIC_J2000 = circlePoints((t) => {
  const l = t * 2 * Math.PI;
  const e = 23.43928 * DEG;
  return { x: Math.cos(l), y: Math.sin(l) * Math.cos(e), z: Math.sin(l) * Math.sin(e) };
}, 180);

/** Raio (px) de uma estrela em função da magnitude. */
export function starRadius(mag: number, fovDeg: number): number {
  const zoom = Math.min(1.7, Math.max(0.85, Math.pow(90 / fovDeg, 0.22)));
  return (0.55 + 4.1 * Math.pow(10, -0.1 * (mag + 1.5))) * zoom;
}

/** Magnitude até à qual as estrelas têm nome no ecrã, consoante a aproximação. */
function starLabelLimit(fovDeg: number): number {
  if (fovDeg >= 140) return 1.3;
  if (fovDeg >= 90) return 2.0;
  if (fovDeg >= 50) return 3.0;
  if (fovDeg >= 20) return 4.2;
  return 5.5;
}

export interface DrawnBody {
  id: SkyBodyId;
  x: number;
  y: number;
  r: number;
}

/** Desenha o disco da Lua com a fase, virado para o Sol. */
function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, illum: number, towardSunRad: number, day: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(towardSunRad);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(40, 42, 50, ${0.85 - day * 0.5})`;
  ctx.fill();
  const t = 1 - 2 * illum;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, Math.abs(t) * r, r, 0, Math.PI / 2, -Math.PI / 2, t > 0);
  ctx.closePath();
  ctx.fillStyle = BODY_COLORS.moon;
  ctx.fill();
  ctx.restore();
}

/**
 * Desenha o céu completo. Devolve as posições no ecrã dos corpos do Sistema Solar desenhados.
 */
export function renderSky(
  ctx: CanvasRenderingContext2D,
  bg: HTMLCanvasElement | null,
  p: Projector,
  view: ViewParams,
  inst: SkyInstant,
  scene: SkyScene | null,
  opts: RenderOptions,
): DrawnBody[] {
  const { width, height } = p;
  const L = opts.layers;
  const M = inst.matrix as unknown as number[];
  const day = daylight(inst, opts.atmosphere);
  const limit = effectiveMagLimit(inst, opts);
  const labels = new LabelPlacer(ctx);
  const drawn: DrawnBody[] = [];

  ctx.clearRect(0, 0, width, height);
  if (bg) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bg, 0, 0, width, height);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lineAlpha = 1 - day * 0.6;

  // Grelhas
  if (L.azGrid) {
    ctx.beginPath();
    for (let alt = 15; alt < 90; alt += 15) {
      const a = alt * DEG;
      strokePath(ctx, p, circlePoints((t) => ({ x: Math.cos(a) * Math.sin(t * 2 * Math.PI), y: Math.cos(a) * Math.cos(t * 2 * Math.PI), z: Math.sin(a) }), 120), null, false);
    }
    for (let az = 0; az < 360; az += 30) {
      const A = az * DEG;
      strokePath(ctx, p, circlePoints((t) => ({ x: Math.sin(A) * Math.cos(t * 90 * DEG), y: Math.cos(A) * Math.cos(t * 90 * DEG), z: Math.sin(t * 90 * DEG) }), 30), null, false);
    }
    ctx.strokeStyle = `rgba(120, 200, 160, ${0.28 * lineAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (L.eqGrid) {
    const D = inst.dateMatrix as unknown as number[];
    ctx.beginPath();
    for (let dec = -75; dec <= 75; dec += 15) {
      const d = dec * DEG;
      strokePath(ctx, p, circlePoints((t) => ({ x: Math.cos(d) * Math.cos(t * 2 * Math.PI), y: Math.cos(d) * Math.sin(t * 2 * Math.PI), z: Math.sin(d) }), 144), D, opts.ground);
    }
    for (let ra = 0; ra < 360; ra += 30) {
      const a = ra * DEG;
      strokePath(ctx, p, circlePoints((t) => ({ x: Math.cos((t * 180 - 90) * DEG) * Math.cos(a), y: Math.cos((t * 180 - 90) * DEG) * Math.sin(a), z: Math.sin((t * 180 - 90) * DEG) }), 72), D, opts.ground);
    }
    ctx.strokeStyle = `rgba(110, 160, 255, ${0.3 * lineAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Equador celeste mais marcado
    ctx.beginPath();
    strokePath(ctx, p, circlePoints((t) => ({ x: Math.cos(t * 2 * Math.PI), y: Math.sin(t * 2 * Math.PI), z: 0 }), 144), D, opts.ground);
    ctx.strokeStyle = `rgba(110, 160, 255, ${0.55 * lineAlpha})`;
    ctx.stroke();
  }
  if (L.ecliptic) {
    ctx.beginPath();
    strokePath(ctx, p, ECLIPTIC_J2000, M, opts.ground);
    ctx.strokeStyle = `rgba(255, 196, 92, ${0.6 * lineAlpha})`;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (scene) {
    if (L.boundaries) {
      ctx.beginPath();
      for (const b of scene.bounds) strokePath(ctx, p, b.pts, M, opts.ground);
      ctx.strokeStyle = `rgba(200, 190, 120, ${0.32 * lineAlpha})`;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (L.constellationLines) {
      ctx.beginPath();
      for (const l of scene.lines) strokePath(ctx, p, l.pts, M, opts.ground);
      ctx.strokeStyle = `rgba(126, 160, 230, ${0.5 * lineAlpha})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // Estrelas (ordenadas da mais brilhante para a mais ténue)
    const s = scene.stars;
    const nameLimit = L.starNames ? Math.min(starLabelLimit(view.fovDeg), limit) : -99;
    const starLabels: Array<[string, number, number, number, number]> = [];
    for (let i = 0; i < s.count; i++) {
      const mag = s.mag[i]!;
      if (mag > limit) break;
      const sx = s.x[i]!;
      const sy = s.y[i]!;
      const sz = s.z[i]!;
      let ex = M[0]! * sx + M[1]! * sy + M[2]! * sz;
      let ey = M[3]! * sx + M[4]! * sy + M[5]! * sz;
      let ez = M[6]! * sx + M[7]! * sy + M[8]! * sz;
      if (opts.ground && ez < -0.01) continue;
      [ex, ey, ez] = refract(ex, ey, ez);
      if (opts.ground && ez < 0) continue;
      const q = projectVec(p, ex, ey, ez);
      if (!q || q.x < -10 || q.y < -10 || q.x > width + 10 || q.y > height + 10) continue;
      const r = starRadius(mag, view.fovDeg);
      const alpha = Math.max(0.25, Math.min(1, limit - mag + 0.4));
      if (mag < 1.6 && day < 0.6) {
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3.2);
        g.addColorStop(0, s.color[i]!);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.35 * alpha;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color[i]!;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (mag <= nameLimit && s.name[i]) starLabels.push([s.name[i]!, q.x, q.y, r, mag]);
    }
    ctx.globalAlpha = 1;

    // Objetos do espaço profundo
    if (L.deepSky) {
      const dsoLimit = Math.min(limit + 1, view.fovDeg > 120 ? 6.5 : 10);
      for (const { obj, v } of scene.dsos) {
        if ((obj.mag ?? 9) > dsoLimit) continue;
        let [ex, ey, ez] = [M[0]! * v.x + M[1]! * v.y + M[2]! * v.z, M[3]! * v.x + M[4]! * v.y + M[5]! * v.z, M[6]! * v.x + M[7]! * v.y + M[8]! * v.z];
        if (opts.ground && ez < 0) continue;
        [ex, ey, ez] = refract(ex, ey, ez);
        const q = projectVec(p, ex, ey, ez);
        if (!q || q.x < 0 || q.y < 0 || q.x > width || q.y > height) continue;
        const sizePx = ((obj.majorArcmin ?? 5) / 60) * DEG * p.scale;
        const rr = Math.max(3.5, Math.min(60, sizePx / 2));
        ctx.strokeStyle = SUBTYPE_COLOR[obj.subtype];
        ctx.globalAlpha = 0.85 * lineAlpha;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (obj.category === 'galaxy') ctx.ellipse(q.x, q.y, rr, rr * 0.55, -0.5, 0, Math.PI * 2);
        else ctx.arc(q.x, q.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (view.fovDeg <= 100 || (obj.mag ?? 9) < 5) {
          labels.add({ text: obj.label, x: q.x, y: q.y, r: rr - 1, around: true, priority: 300 + (obj.mag ?? 9), font: '500 11px "IBM Plex Sans", system-ui, sans-serif', color: 'rgba(200, 214, 240, 0.85)' });
        }
      }
    }

    if (L.constellationNames) {
      const maxRank = view.fovDeg > 140 ? 1 : view.fovDeg > 80 ? 2 : 3;
      for (const lab of scene.labels) {
        if (lab.rank > maxRank) continue;
        const v = lab.v;
        const e = [M[0]! * v.x + M[1]! * v.y + M[2]! * v.z, M[3]! * v.x + M[4]! * v.y + M[5]! * v.z, M[6]! * v.x + M[7]! * v.y + M[8]! * v.z] as const;
        if (opts.ground && e[2] < 0.02) continue;
        const q = projectVec(p, e[0], e[1], e[2]);
        if (!q || q.x < 0 || q.y < 0 || q.x > width || q.y > height) continue;
        labels.add({
          text: constellationName(lab.abbr).toUpperCase(),
          x: q.x,
          y: q.y,
          r: 0,
          around: false,
          align: 'center',
          priority: 200 + lab.rank,
          font: '500 10.5px "IBM Plex Sans", system-ui, sans-serif',
          color: `rgba(160, 182, 235, ${0.75 * lineAlpha})`,
        });
      }
    }
    for (const [text, x, y, r, mag] of starLabels) {
      labels.add({ text, x, y, r, around: true, priority: 100 + mag, font: '12px "IBM Plex Sans", system-ui, sans-serif', color: 'rgba(236, 240, 250, 0.9)' });
    }
  }

  // Sol, Lua e planetas
  if (L.planets) {
    const sunEnu = inst.bodies.find((b) => b.id === 'sun')!.enu;
    const order: SkyBodyId[] = ['neptune', 'uranus', 'saturn', 'jupiter', 'mars', 'venus', 'mercury', 'sun', 'moon'];
    for (const id of order) {
      const b = inst.bodies.find((x) => x.id === id)!;
      if (id !== 'sun' && id !== 'moon' && b.magnitude > limit) continue;
      let [ex, ey, ez] = [b.enu.x, b.enu.y, b.enu.z];
      if (opts.ground && ez < -0.02) continue;
      [ex, ey, ez] = refract(ex, ey, ez);
      const q = projectVec(p, ex, ey, ez);
      if (!q || q.x < -40 || q.y < -40 || q.x > width + 40 || q.y > height + 40) continue;
      const truePx = ((b.diameterArcsec / 3600) * DEG * p.scale) / 2;
      let r: number;
      if (id === 'sun') {
        r = Math.max(truePx, 9);
        const g = ctx.createRadialGradient(q.x, q.y, r * 0.6, q.x, q.y, r * 4);
        g.addColorStop(0, 'rgba(255, 226, 140, 0.55)');
        g.addColorStop(1, 'rgba(255, 200, 80, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = BODY_COLORS.sun;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (id === 'moon') {
        r = Math.max(truePx, 8);
        // Direção do Sol no ecrã, a partir da Lua
        const k = 0.02;
        const toward = projectVec(p, ex + (sunEnu.x - ex) * k, ey + (sunEnu.y - ey) * k, ez + (sunEnu.z - ez) * k);
        const ang = toward ? Math.atan2(toward.y - q.y, toward.x - q.x) : 0;
        drawMoon(ctx, q.x, q.y, r, b.illuminatedFraction, ang, day);
      } else {
        r = Math.max(truePx, Math.min(5.5, 2.2 + Math.max(0, 1.5 - b.magnitude) * 0.7));
        ctx.fillStyle = BODY_COLORS[id];
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      drawn.push({ id, x: q.x, y: q.y, r });
      labels.add({
        text: BODY_NAMES_PT[id],
        x: q.x,
        y: q.y,
        r,
        around: true,
        priority: id === 'sun' || id === 'moon' ? 0 : 10 + b.magnitude,
        font: '600 12.5px "IBM Plex Sans", system-ui, sans-serif',
        color: id === 'sun' ? '#ffe39a' : '#ffffff',
      });
    }
  }

  // Horizonte e pontos cardeais
  ctx.beginPath();
  strokePath(ctx, p, circlePoints((t) => ({ x: Math.sin(t * 2 * Math.PI), y: Math.cos(t * 2 * Math.PI), z: 0 }), 360), null, false);
  ctx.strokeStyle = opts.ground ? 'rgba(180, 196, 170, 0.55)' : 'rgba(180, 196, 170, 0.35)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  for (let i = 0; i < 8; i++) {
    const A = i * 45 * DEG;
    const alt = -1.8 * DEG;
    const q = projectVec(p, Math.sin(A) * Math.cos(alt), Math.cos(A) * Math.cos(alt), Math.sin(alt));
    if (!q || q.x < 0 || q.x > width || q.y < 0 || q.y > height + 20) continue;
    labels.add({
      text: CARD[i]!,
      x: q.x,
      y: Math.min(height - 4, q.y + 12),
      r: 0,
      around: false,
      align: 'center',
      priority: -1,
      force: true,
      font: `${i % 2 ? '500 11px' : '700 14px'} "IBM Plex Sans", system-ui, sans-serif`,
      color: i % 2 ? 'rgba(220, 200, 150, 0.8)' : '#f4d58d',
    });
  }
  // Zénite
  const zen = projectVec(p, 0, 0, 1);
  if (zen && zen.x > 0 && zen.y > 0 && zen.x < width && zen.y < height) {
    ctx.strokeStyle = 'rgba(244, 213, 141, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(zen.x - 5, zen.y);
    ctx.lineTo(zen.x + 5, zen.y);
    ctx.moveTo(zen.x, zen.y - 5);
    ctx.lineTo(zen.x, zen.y + 5);
    ctx.stroke();
  }

  labels.flush();

  // Seleção
  const sel = opts.selected;
  if (sel) {
    const v = selectionEnu(sel, inst, scene);
    if (v) {
      const [ex, ey, ez] = refract(v.x, v.y, v.z);
      const q = projectVec(p, ex, ey, ez);
      if (q) {
        ctx.strokeStyle = '#f4d58d';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 12, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(q.x + Math.cos(a) * 15, q.y + Math.sin(a) * 15);
          ctx.lineTo(q.x + Math.cos(a) * 20, q.y + Math.sin(a) * 20);
          ctx.stroke();
        }
      }
    }
  }
  return drawn;
}

/** Direção atual (este–norte–zénite, sem refração) do objeto selecionado. */
export function selectionEnu(sel: SelectionKey, inst: SkyInstant, scene: SkyScene | null): Vec3 | null {
  const M = inst.matrix;
  if (sel.kind === 'body') return inst.bodies.find((b) => b.id === sel.id)?.enu ?? null;
  if (!scene) return null;
  if (sel.kind === 'star') {
    const s = scene.stars;
    const x = s.x[sel.index];
    const y = s.y[sel.index];
    const z = s.z[sel.index];
    if (x === undefined || y === undefined || z === undefined) return null;
    return { x: M[0] * x + M[1] * y + M[2] * z, y: M[3] * x + M[4] * y + M[5] * z, z: M[6] * x + M[7] * y + M[8] * z };
  }
  const d = scene.dsos.find((o) => o.obj.id === sel.id);
  if (!d) return null;
  const v = d.v;
  return { x: M[0] * v.x + M[1] * v.y + M[2] * v.z, y: M[3] * v.x + M[4] * v.y + M[5] * v.z, z: M[6] * v.x + M[7] * v.y + M[8] * v.z };
}

/** Objeto mais próximo de um ponto do ecrã (até 14 px), entre os que estão desenhados. */
export function pickAt(
  sx: number,
  sy: number,
  p: Projector,
  view: ViewParams,
  inst: SkyInstant,
  scene: SkyScene | null,
  opts: RenderOptions,
  drawn: DrawnBody[],
): SelectionKey | null {
  let best: SelectionKey | null = null;
  let bestD = Infinity;
  for (const b of drawn) {
    const d = Math.hypot(b.x - sx, b.y - sy) - b.r;
    if (d < 14 && d < bestD) {
      bestD = d - 4; // os corpos do Sistema Solar têm prioridade
      best = { kind: 'body', id: b.id };
    }
  }
  if (!scene) return best;
  const M = inst.matrix as unknown as number[];
  const limit = effectiveMagLimit(inst, opts);
  const s = scene.stars;
  for (let i = 0; i < s.count; i++) {
    if (s.mag[i]! > limit) break;
    let [ex, ey, ez] = [
      M[0]! * s.x[i]! + M[1]! * s.y[i]! + M[2]! * s.z[i]!,
      M[3]! * s.x[i]! + M[4]! * s.y[i]! + M[5]! * s.z[i]!,
      M[6]! * s.x[i]! + M[7]! * s.y[i]! + M[8]! * s.z[i]!,
    ];
    if (opts.ground && ez < -0.01) continue;
    [ex, ey, ez] = refract(ex, ey, ez);
    if (opts.ground && ez < 0) continue;
    const q = projectVec(p, ex, ey, ez);
    if (!q) continue;
    // Estrelas brilhantes ganham perante estrelas ténues à mesma distância
    const d = Math.hypot(q.x - sx, q.y - sy) - starRadius(s.mag[i]!, view.fovDeg) + s.mag[i]! * 0.4;
    if (d < 12 && d < bestD) {
      bestD = d;
      best = { kind: 'star', index: i };
    }
  }
  if (opts.layers.deepSky) {
    for (const { obj, v } of scene.dsos) {
      const e = [M[0]! * v.x + M[1]! * v.y + M[2]! * v.z, M[3]! * v.x + M[4]! * v.y + M[5]! * v.z, M[6]! * v.x + M[7]! * v.y + M[8]! * v.z] as const;
      if (opts.ground && e[2] < 0) continue;
      const q = projectVec(p, e[0], e[1], e[2]);
      if (!q) continue;
      const d = Math.hypot(q.x - sx, q.y - sy);
      if (d < 12 && d < bestD) {
        bestD = d;
        best = { kind: 'dso', id: obj.id };
      }
    }
  }
  return best;
}
