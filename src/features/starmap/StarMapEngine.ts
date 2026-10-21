import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { QualitySettings } from '../explorer/engine/quality';
import { bvToRgb } from '../explorer/engine/stars';
import { type StarMapData, visualLuminosityAt } from './starMapData';

/**
 * Cena do mapa estelar. Unidade: 1 parsec. As coordenadas galácticas (x para o centro da Galáxia, y no sentido da
 * rotação, z para o polo norte galáctico) passam para a cena com o polo norte galáctico para cima:
 * cena = (x, z, −y).
 */
export function galacticToScene(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, z, -y);
}

export const RINGS_PC = [10, 25, 50, 100] as const;

export interface StarMapLabels {
  sun: string;
  ring: (pc: number) => string;
  galacticCenter: string;
  northPole: string;
}

export interface StarMapEngineOptions {
  canvas: HTMLCanvasElement;
  labelLayer: HTMLElement;
  data: StarMapData;
  quality: QualitySettings;
  reducedMotion: boolean;
  labels: StarMapLabels;
  onSelect: (index: number | null) => void;
}

interface Flight {
  fromPos: Vector3;
  toPos: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  start: number;
  duration: number;
}

interface DomLabel {
  el: HTMLSpanElement;
  pos: Vector3;
  /** Índice da estrela (as etiquetas de estrelas escondem-se quando a estrela está filtrada). */
  star?: number;
}

const INITIAL_POS = new Vector3(55, 135, 225);

export class StarMapEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly points: Points;
  private readonly visAttr: BufferAttribute;
  private readonly positions: Float32Array;
  private readonly marker: Points;
  private readonly guides: Array<Line | LineLoop> = [];
  private readonly sun: Points;
  private readonly fixedLabels: DomLabel[] = [];
  private starLabels: DomLabel[] = [];
  private mask: Uint8Array;
  private selected: number | null = null;
  private flight: Flight | null = null;
  private raf = 0;
  private disposed = false;
  private readonly resizeObserver: ResizeObserver;
  private pointerDown: { x: number; y: number; t: number } | null = null;

  constructor(private readonly opts: StarMapEngineOptions) {
    const { canvas, data, quality } = opts;
    this.renderer = new WebGLRenderer({ canvas, antialias: quality.tier === 'high', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio));
    this.renderer.setClearColor(new Color('#03050c'), 1);

    this.camera = new PerspectiveCamera(50, 1, 0.01, 5000);
    this.camera.position.copy(INITIAL_POS);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 650;
    this.controls.rotateSpeed = 0.6;
    this.controls.target.set(0, 0, 0);
    // Arrastar a vista interrompe uma viagem em curso
    this.controls.addEventListener('start', () => {
      this.flight = null;
    });

    // ---------------------------------------------------------- estrelas
    this.positions = new Float32Array(data.n * 3);
    const colors = new Float32Array(data.n * 3);
    const lum = new Float32Array(data.n);
    for (let i = 0; i < data.n; i += 1) {
      const p = galacticToScene(data.x[i]!, data.y[i]!, data.z[i]!);
      this.positions.set([p.x, p.y, p.z], i * 3);
      const ci = data.ci[i]!;
      const [r, g, b] = Number.isNaN(ci) ? [0.9, 0.92, 1] : bvToRgb(ci);
      colors.set([r, g, b], i * 3);
      // Sem magnitude absoluta, desenha-se como uma estrela ténue
      lum[i] = visualLuminosityAt(data, i) ?? 0.01;
    }
    this.mask = new Uint8Array(data.n).fill(1);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('aLum', new BufferAttribute(lum, 1));
    this.visAttr = new BufferAttribute(new Float32Array(data.n).fill(1), 1);
    geometry.setAttribute('aVis', this.visAttr);
    const pixelRatio = this.renderer.getPixelRatio();
    const material = new ShaderMaterial({
      uniforms: { uPixelRatio: { value: pixelRatio }, uScale: { value: 70 } },
      vertexShader: /* glsl */ `
        attribute float aLum;
        attribute float aVis;
        uniform float uPixelRatio;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          if (aVis < 0.5) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            return;
          }
          gl_Position = projectionMatrix * mv;
          // Tamanho ilustrativo: cresce com a luminosidade e diminui com a distância à câmara
          float raw = uScale * pow(aLum, 0.25) / max(-mv.z, 0.05);
          vAlpha = clamp(raw / 2.0, 0.45, 1.0);
          gl_PointSize = clamp(raw, 2.0, 22.0) * uPixelRatio;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.05, d);
          a = a * a * vAlpha;
          gl_FragColor = vec4(vColor * a, a);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // ---------------------------------------------------------- Sol e marcador da seleção
    this.sun = this.singlePoint(new Vector3(0, 0, 0), '#ffd27a', 11, 'disc');
    this.scene.add(this.sun);
    this.marker = this.singlePoint(new Vector3(0, 0, 0), '#9dbbff', 26, 'ring');
    this.marker.visible = false;
    this.scene.add(this.marker);

    // ---------------------------------------------------------- guias: anéis de distância e direções
    for (const pc of RINGS_PC) {
      const pts: number[] = [];
      for (let k = 0; k < 128; k += 1) {
        const a = (k / 128) * Math.PI * 2;
        const p = galacticToScene(pc * Math.cos(a), pc * Math.sin(a), 0);
        pts.push(p.x, p.y, p.z);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pts, 3));
      const ring = new LineLoop(g, new LineBasicMaterial({ color: 0x5f78b8, transparent: true, opacity: pc === 100 ? 0.45 : 0.28 }));
      this.scene.add(ring);
      this.guides.push(ring);
      this.addFixedLabel(opts.labels.ring(pc), galacticToScene(pc * Math.cos(-0.35), pc * Math.sin(-0.35), 0), 'starmap-label--ring');
    }
    const gcLine = this.line([galacticToScene(0, 0, 0), galacticToScene(115, 0, 0)], 0xffc874, 0.6);
    const ngpLine = this.line([galacticToScene(0, 0, 0), galacticToScene(0, 0, 60)], 0x9dbbff, 0.45);
    this.guides.push(gcLine, ngpLine);
    this.addFixedLabel(opts.labels.galacticCenter, galacticToScene(72, 0, 0), 'starmap-label--gc');
    this.addFixedLabel(opts.labels.northPole, galacticToScene(0, 0, 62), 'starmap-label--ngp');
    this.addFixedLabel(opts.labels.sun, new Vector3(0, 0, 0), 'starmap-label--sun');

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------- construção

  private singlePoint(p: Vector3, color: string, size: number, shape: 'disc' | 'ring'): Points {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([p.x, p.y, p.z], 3));
    const m = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(color) }, uSize: { value: size * this.renderer.getPixelRatio() } },
      vertexShader: /* glsl */ `
        uniform float uSize;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize;
        }
      `,
      fragmentShader:
        shape === 'disc'
          ? /* glsl */ `
        uniform vec3 uColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d);
          gl_FragColor = vec4(uColor * a, a);
        }`
          : /* glsl */ `
        uniform vec3 uColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.06, 0.0, abs(d - 0.4));
          gl_FragColor = vec4(uColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const pts = new Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = 10;
    return pts;
  }

  private line(points: Vector3[], color: number, opacity: number): Line {
    const g = new BufferGeometry().setFromPoints(points);
    const l = new Line(g, new LineDashedMaterial({ color, transparent: true, opacity, dashSize: 3, gapSize: 2 }));
    l.computeLineDistances();
    this.scene.add(l);
    return l;
  }

  private makeLabel(text: string, cls: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = `starmap-label ${cls}`;
    el.textContent = text;
    this.opts.labelLayer.appendChild(el);
    return el;
  }

  private addFixedLabel(text: string, pos: Vector3, cls: string) {
    this.fixedLabels.push({ el: this.makeLabel(text, cls), pos });
  }

  // ---------------------------------------------------------------- API

  /** Estrelas que passam os filtros (1) e as que ficam escondidas (0). */
  setMask(mask: Uint8Array) {
    this.mask = mask;
    const arr = this.visAttr.array as Float32Array;
    for (let i = 0; i < mask.length; i += 1) arr[i] = mask[i]!;
    this.visAttr.needsUpdate = true;
  }

  /** Estrelas com etiqueta permanente (as mais conhecidas). */
  setStarLabels(indices: readonly number[]) {
    for (const l of this.starLabels) l.el.remove();
    this.starLabels = indices.map((i) => ({
      el: this.makeLabel(this.opts.data.des[i]!, i === this.selected ? 'starmap-label--star is-selected' : 'starmap-label--star'),
      pos: this.starPos(i),
      star: i,
    }));
  }

  select(index: number | null) {
    this.selected = index;
    if (index === null) {
      this.marker.visible = false;
    } else {
      const p = this.starPos(index);
      (this.marker.geometry.getAttribute('position') as BufferAttribute).setXYZ(0, p.x, p.y, p.z);
      this.marker.geometry.getAttribute('position').needsUpdate = true;
      this.marker.visible = true;
    }
    for (const l of this.starLabels) l.el.classList.toggle('is-selected', l.star === index);
  }

  /** Viagem animada até uma estrela (ou de volta ao Sol, com null). */
  travelTo(index: number | null) {
    const target = index === null ? new Vector3(0, 0, 0) : this.starPos(index);
    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-9) dir.set(0.5, 0.6, 0.8);
    const dist = index === null ? INITIAL_POS.length() : Math.max(4, Math.min(12, target.length() * 0.25));
    const toPos = target.clone().add(dir.normalize().multiplyScalar(dist));
    this.fly(toPos, target, 1600);
  }

  /** Aproxima (factor < 1) ou afasta (factor > 1) a câmara do ponto central. */
  zoom(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);
    const len = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, offset.length()));
    offset.setLength(len);
    this.fly(this.controls.target.clone().add(offset), this.controls.target.clone(), 350);
  }

  reset() {
    this.fly(INITIAL_POS.clone(), new Vector3(0, 0, 0), 1200);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.opts.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.opts.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    for (const obj of [this.points, this.sun, this.marker, ...this.guides]) {
      obj.geometry.dispose();
      const m = obj.material;
      (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    }
    for (const l of [...this.fixedLabels, ...this.starLabels]) l.el.remove();
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------- internos

  private starPos(i: number): Vector3 {
    return new Vector3(this.positions[i * 3]!, this.positions[i * 3 + 1]!, this.positions[i * 3 + 2]!);
  }

  private fly(toPos: Vector3, toTarget: Vector3, duration: number) {
    if (this.opts.reducedMotion) {
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTarget);
      this.flight = null;
      return;
    }
    this.flight = { fromPos: this.camera.position.clone(), toPos, fromTarget: this.controls.target.clone(), toTarget, start: performance.now(), duration };
  }

  private resize() {
    const parent = this.opts.canvas.parentElement ?? this.opts.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600) return;
    const rect = this.opts.canvas.getBoundingClientRect();
    this.opts.onSelect(this.pick(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height));
  };

  /** A estrela visível mais próxima do ponto clicado (até 14 píxeis), ou null. */
  private pick(px: number, py: number, w: number, h: number): number | null {
    this.camera.updateMatrixWorld();
    const m = this.camera.projectionMatrix.clone().multiply(this.camera.matrixWorldInverse).elements;
    let best: number | null = null;
    let bestD = 14 * 14;
    let bestDepth = Infinity;
    for (let i = 0; i < this.mask.length; i += 1) {
      if (!this.mask[i]) continue;
      const x = this.positions[i * 3]!;
      const y = this.positions[i * 3 + 1]!;
      const z = this.positions[i * 3 + 2]!;
      const cw = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
      if (cw <= 0) continue;
      const sx = ((m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / cw + 1) * 0.5 * w;
      const sy = (1 - (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / cw) * 0.5 * h;
      const d = (sx - px) ** 2 + (sy - py) ** 2;
      // Em empate aproximado, prefere a estrela mais perto da câmara
      if (d < bestD - 4 || (d < bestD + 4 && cw < bestDepth)) {
        best = i;
        bestD = Math.min(d, bestD);
        bestDepth = cw;
      }
    }
    return best;
  }

  /**
   * Coloca as etiquetas no ecrã. As etiquetas das estrelas são escondidas quando ficariam por cima de outra já
   * colocada (as fixas e a da estrela selecionada primeiro; depois as estrelas pela ordem recebida).
   */
  private placeLabels() {
    const w = this.opts.labelLayer.clientWidth;
    const h = this.opts.labelLayer.clientHeight;
    const v = new Vector3();
    const boxes: Array<[number, number, number, number]> = [];
    const place = (l: DomLabel, avoidOverlap: boolean) => {
      if (l.star !== undefined && !this.mask[l.star]) {
        l.el.style.display = 'none';
        return;
      }
      v.copy(l.pos).project(this.camera);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) {
        l.el.style.display = 'none';
        return;
      }
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      // Caixa aproximada do texto (deslocado 9 px para a direita e para cima, como no CSS)
      const box: [number, number, number, number] = [x + 9, y - 9, x + 9 + (l.el.textContent?.length ?? 4) * 6.4, y + 7];
      if (avoidOverlap && boxes.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) {
        l.el.style.display = 'none';
        return;
      }
      boxes.push(box);
      l.el.style.display = '';
      l.el.style.transform = `translate(${x}px, ${y}px)`;
    };
    this.fixedLabels.forEach((l) => place(l, false));
    const sel = this.starLabels.find((l) => l.star === this.selected);
    if (sel) place(sel, false);
    this.starLabels.forEach((l) => {
      if (l !== sel) place(l, true);
    });
  }

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    if (this.flight) {
      const f = this.flight;
      const t = Math.min(1, (now - f.start) / f.duration);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(f.fromPos, f.toPos, e);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
      if (t >= 1) this.flight = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };
}
