import {
  AmbientLight,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  PerspectiveCamera,
  PointLight,
  Points,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { osculatingPositionAu, planetPositionAu } from '../../../core/astro/kepler';
import { moonGeocentricKm } from '../../../core/astro/moon';
import { AU_KM, planetocentricOffsetKm, referenceRadiusKm } from '../../../core/astro/positions';
import { sampleSatelliteOrbitKm, satelliteOrbitNormal } from '../../../core/astro/satellites';
import {
  SCENE_SCALE,
  bodyRadiusToScene,
  eclipticToScene,
  heliocentricAuToScene,
  moonDistanceToScene,
  moonRadiusToScene,
} from '../../../core/astro/scale';
import { clampToValidity } from '../../../core/astro/time';
import { type Vec3, length as vlen, normalize as vnorm, sub as vsub } from '../../../core/astro/vector';
import { tr } from '../../../data/catalog';
import type { BodyId, CelestialBody } from '../../../data/types';
import { createBodyVisual, type BodyVisual } from './bodies';
import { createOrbitLine, heliocentricOrbitPoints, type OrbitLine } from './orbits';
import type { QualitySettings } from './quality';
import { SmallBodyLayer, type SmallBodyLayerItem } from './smallBodies';
import { createStarfield, fetchStarCatalog, STAR_SPHERE_RADIUS } from './stars';
import { disposeTextureCache, runLimited } from './textures';

export type ViewMode = 'overview' | 'top' | 'edge';

export interface LiveInfo {
  distanceSunAu: number;
  distanceEarthAu: number;
  /** Só para luas: distância atual ao centro do planeta (km). */
  distanceParentKm?: number;
}

interface MoonOrbit {
  line: Line;
  group: Group;
  material: LineBasicMaterial;
  computedAt: number;
  /** Intervalo (dias) ao fim do qual a órbita é recalculada. */
  refreshDays: number;
}

export interface EngineCallbacks {
  onSelect(id: BodyId | null): void;
  onTime(jdTdb: number, clamped: boolean): void;
  onReady(): void;
  onQualityReduced(): void;
  onTextureError(file: string): void;
  onStarsError(): void;
  onContextLost(): void;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  labelLayer: HTMLElement;
  bodies: readonly CelestialBody[];
  quality: QualitySettings;
  autoQuality: boolean;
  reducedMotion: boolean;
  initialJd: number;
  callbacks: EngineCallbacks;
}

interface Flight {
  fromPos: Vector3;
  fromTarget: Vector3;
  start: number;
  duration: number;
  /** Destino fixo (vistas) ou relativo a um corpo (seguimento). */
  toPos?: Vector3;
  toTarget?: Vector3;
  bodyId?: BodyId;
  offset?: Vector3;
}

interface Label {
  id: BodyId;
  el: HTMLButtonElement;
  priority: number;
  width: number;
}

const PICK_MIN_PX = 14;
/** As luas (etiquetas, órbitas e seleção) só aparecem com a câmara a menos de N raios do planeta. */
const MOON_NEAR_RADII = 45;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class SolarSystemEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly visuals = new Map<BodyId, BodyVisual>();
  private readonly orbits = new Map<BodyId, OrbitLine>();
  private readonly labels: Label[] = [];
  private readonly positionsAu = new Map<BodyId, Vec3>();
  private readonly positionsScene = new Map<BodyId, Vector3>();
  private readonly starGroup = new Group();
  private stars?: Points;
  private readonly moonOrbits = new Map<BodyId, MoonOrbit>();
  private readonly nearParent = new Map<BodyId, boolean>();
  private showOrbits = true;
  private smallLayer: SmallBodyLayer | null = null;
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private lastFrame = 0;
  private lastTimeEmit = 0;
  private disposed = false;

  private jd: number;
  private rateDaysPerSecond = 1 / 86_400;
  private paused = false;
  private clamped = false;
  private selected: BodyId | null = null;
  private following: BodyId | null = null;
  private flight: Flight | null = null;
  private showLabels = true;

  // Medição de desempenho
  private fpsFrames = 0;
  private fpsStart = 0;
  private slowWindows = 0;
  private qualityReduced = false;
  private readonly startedAt = performance.now();

  private pointerDown: { x: number; y: number; t: number } | null = null;

  constructor(private readonly opts: EngineOptions) {
    const { canvas, quality } = opts;
    this.jd = opts.initialJd;

    this.renderer = new WebGLRenderer({ canvas, antialias: quality.tier === 'high', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio));
    this.renderer.setClearColor(new Color('#03050c'), 1);

    this.camera = new PerspectiveCamera(45, 1, 0.02, STAR_SPHERE_RADIUS * 3);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 2200;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.9;

    this.scene.add(new AmbientLight(0x8fa6c8, 0.22));
    const sunLight = new PointLight(0xfff4e6, 3.4, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(this.starGroup);

    this.buildBodies();
    this.updatePositions();
    this.buildOrbits();
    this.buildLabels();
    void this.loadStars();
    void this.upgradeTextures();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    const overview = this.viewPose('overview');
    if (opts.reducedMotion) {
      this.camera.position.copy(overview.pos);
      this.controls.target.copy(overview.target);
    } else {
      this.camera.position.copy(overview.pos).multiplyScalar(1.9).add(new Vector3(0, 120, 0));
      this.controls.target.copy(overview.target);
      this.startFlight({ toPos: overview.pos, toTarget: overview.target }, 2600);
    }

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.controls.addEventListener('start', this.onControlsStart);

    this.lastFrame = performance.now();
    this.fpsStart = this.lastFrame;
    this.raf = requestAnimationFrame(this.frame);
    opts.callbacks.onReady();
  }

  // ---------------------------------------------------------------- construção

  private buildBodies() {
    for (const body of this.opts.bodies) {
      const radius =
        body.type === 'star'
          ? SCENE_SCALE.sunRadiusUnits
          : body.type === 'moon'
            ? moonRadiusToScene(body.meanRadiusKm)
            : bodyRadiusToScene(body.meanRadiusKm);
      const visual = createBodyVisual(body, radius, {
        quality: this.opts.quality,
        onTextureError: (f) => this.opts.callbacks.onTextureError(f),
      });
      this.visuals.set(body.id, visual);
      this.scene.add(visual.group);
    }
  }

  private buildOrbits() {
    for (const body of this.opts.bodies) {
      const pts = heliocentricOrbitPoints(body, this.jd);
      if (!pts) continue;
      const orbit = createOrbitLine(body, pts, this.jd);
      this.orbits.set(body.id, orbit);
      this.scene.add(orbit.line);
    }
    for (const body of this.opts.bodies) {
      if (body.orbit.kind !== 'lunar-mean' && body.orbit.kind !== 'satellite') continue;
      const group = new Group();
      const material = new LineBasicMaterial({
        color: new Color(body.render.accent),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const line = new Line(new BufferGeometry(), material);
      line.name = `${body.id}-orbit`;
      line.frustumCulled = false;
      group.add(line);
      this.scene.add(group);
      // A órbita da Lua (Meeus) precessa: recalculada a cada 3 dias simulados; as restantes são elipses fixas.
      this.moonOrbits.set(body.id, {
        line,
        group,
        material,
        computedAt: Number.NaN,
        refreshDays: body.orbit.kind === 'lunar-mean' ? 3 : 3650,
      });
      this.updateMoonOrbit(body);
    }
  }

  /** Distância de desenho de uma lua ao planeta, a partir da distância real (km). */
  private moonSceneDistance(body: CelestialBody, distanceKm: number): number {
    const parent = body.parent ? this.visuals.get(body.parent) : undefined;
    if (!parent) return 1;
    return moonDistanceToScene(distanceKm, referenceRadiusKm(parent.body), parent.radius);
  }

  private updateMoonOrbit(body: CelestialBody) {
    const orbit = this.moonOrbits.get(body.id);
    if (!orbit) return;
    const offsets =
      body.orbit.kind === 'satellite'
        ? sampleSatelliteOrbitKm(body.orbit.key, this.jd, 180)
        : Array.from({ length: 121 }, (_, i) => moonGeocentricKm(this.jd + (27.321661 * i) / 120));
    const pts: number[] = [];
    for (const o of offsets) {
      const d = this.moonSceneDistance(body, vlen(o));
      const s = eclipticToScene(vnorm(o));
      pts.push(s.x * d, s.y * d, s.z * d);
    }
    const g = orbit.line.geometry;
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    g.computeBoundingSphere();
    orbit.computedAt = this.jd;
  }

  private buildLabels() {
    const layer = this.opts.labelLayer;
    for (const body of this.opts.bodies) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `space-label space-label--${body.type}`;
      const name = tr(body.name);
      el.textContent = name;
      el.dataset.body = body.id;
      el.style.setProperty('--accent', body.render.accent);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.select(body.id, { fly: true });
      });
      layer.appendChild(el);
      const priority =
        body.type === 'star'
          ? 1000
          : body.type === 'planet'
            ? 500 + body.meanRadiusKm / 1000
            : body.type === 'dwarf-planet'
              ? 200
              : body.meanRadiusKm / 100;
      this.labels.push({ id: body.id, el, priority, width: name.length * 7.5 + 22 });
    }
  }

  private async loadStars() {
    try {
      const catalog = await fetchStarCatalog(this.abort.signal);
      if (this.disposed) return;
      this.stars = createStarfield(catalog, this.opts.quality.starMagLimit, this.renderer.getPixelRatio());
      this.starGroup.add(this.stars);
    } catch (err) {
      if (!this.disposed && !(err instanceof DOMException && err.name === 'AbortError')) this.opts.callbacks.onStarsError();
    }
  }

  private async upgradeTextures() {
    // Primeiro o Sol e os planetas interiores (mais visíveis na vista inicial), depois os restantes
    const ordered = [...this.visuals.values()];
    await runLimited(ordered.map((v) => () => v.upgradeTextures()), 2);
  }

  // ---------------------------------------------------------------- posições

  private computePositionAu(body: CelestialBody): Vec3 {
    switch (body.orbit.kind) {
      case 'jpl-approx':
        return planetPositionAu(body.orbit.key, this.jd);
      case 'osculating':
        return osculatingPositionAu(body.orbit.elements, this.jd);
      case 'lunar-mean':
      case 'satellite': {
        const parent = (body.parent && this.positionsAu.get(body.parent)) || { x: 0, y: 0, z: 0 };
        const m = planetocentricOffsetKm(body, this.jd)!;
        return { x: parent.x + m.x / AU_KM, y: parent.y + m.y / AU_KM, z: parent.z + m.z / AU_KM };
      }
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  private readonly tmpX = new Vector3();
  private readonly tmpY = new Vector3();

  private updatePositions() {
    for (const body of this.opts.bodies) {
      const au = this.computePositionAu(body);
      this.positionsAu.set(body.id, au);
      let scene: Vector3;
      const offset = planetocentricOffsetKm(body, this.jd);
      if (offset && body.parent) {
        const parentScene = this.positionsScene.get(body.parent) ?? new Vector3();
        const dir = eclipticToScene(vnorm(offset));
        const d = this.moonSceneDistance(body, vlen(offset));
        scene = new Vector3(parentScene.x + dir.x * d, parentScene.y + dir.y * d, parentScene.z + dir.z * d);
      } else {
        const s = heliocentricAuToScene(au);
        scene = new Vector3(s.x, s.y, s.z);
      }
      const prev = this.positionsScene.get(body.id);
      if (prev) prev.copy(scene);
      else this.positionsScene.set(body.id, scene);
      const visual = this.visuals.get(body.id);
      if (!visual) continue;
      visual.group.position.copy(scene);
      if (body.render.synchronous && body.orbit.kind === 'satellite' && body.parent) {
        // Rotação síncrona: longitude 0° virada para o planeta; polo norte IAU do lado norte do plano
        // invariável (exceto no sistema de Plutão, onde a IAU usa a regra da mão direita).
        const parentScene = this.positionsScene.get(body.parent);
        const parentType = this.visuals.get(body.parent)?.body.type;
        if (parentScene) {
          const h = satelliteOrbitNormal(body.orbit.key);
          const sign = parentType === 'dwarf-planet' || h.z >= 0 ? 1 : -1;
          const n = eclipticToScene({ x: h.x * sign, y: h.y * sign, z: h.z * sign });
          this.tmpY.set(n.x, n.y, n.z).normalize();
          this.tmpX.copy(parentScene).sub(scene).normalize();
          visual.orientSynchronous(this.tmpX, this.tmpY);
        }
      } else {
        visual.updateOrientation(this.jd);
      }
      if (visual.atmosphere) {
        const sunDir = visual.atmosphere.uniforms.uSunDir!.value as Vector3;
        sunDir.copy(scene).negate().normalize();
      }
    }
    for (const [id, orbit] of this.moonOrbits) {
      const body = this.visuals.get(id)?.body;
      const parentScene = body?.parent ? this.positionsScene.get(body.parent) : undefined;
      if (parentScene) orbit.group.position.copy(parentScene);
      if (body && !(Math.abs(this.jd - orbit.computedAt) < orbit.refreshDays)) this.updateMoonOrbit(body);
    }
    // As elipses dos planetas mudam muito devagar: recalculadas a cada 5 anos simulados
    for (const [id, orbit] of this.orbits) {
      if (Math.abs(this.jd - orbit.computedAt) > 1826) {
        const body = this.visuals.get(id)?.body;
        const pts = body ? heliocentricOrbitPoints(body, this.jd) : null;
        if (pts) orbit.update(pts, this.jd);
      }
    }
    this.smallLayer?.update(this.jd);
  }

  /** Atualiza, para cada lua, se a câmara está suficientemente perto do planeta. */
  private updateNearParent() {
    for (const [id, visual] of this.visuals) {
      const parentId = visual.body.type === 'moon' ? visual.body.parent : undefined;
      if (!parentId) continue;
      const parent = this.visuals.get(parentId);
      const parentPos = this.positionsScene.get(parentId);
      if (!parent || !parentPos) continue;
      const near =
        this.selected === id ||
        this.selected === parentId ||
        this.camera.position.distanceTo(parentPos) < parent.radius * MOON_NEAR_RADII;
      this.nearParent.set(id, near);
      const orbit = this.moonOrbits.get(id);
      if (orbit) orbit.line.visible = this.showOrbits && near;
    }
  }

  private isPickable(id: BodyId): boolean {
    return this.nearParent.get(id) ?? true;
  }

  // ---------------------------------------------------------------- API pública

  getTime(): number {
    return this.jd;
  }

  setTime(jdTdb: number) {
    const c = clampToValidity(jdTdb);
    this.jd = c.jd;
    this.clamped = c.clamped;
    this.updatePositions();
    this.emitTime(true);
  }

  setRate(daysPerSecond: number) {
    this.rateDaysPerSecond = daysPerSecond;
    this.clamped = false;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.clamped = false;
  }

  setShowOrbits(show: boolean) {
    this.showOrbits = show;
    for (const o of this.orbits.values()) o.line.visible = show;
    this.smallLayer?.setShowOrbits(show);
    this.updateNearParent();
  }

  /** Mostra (ou retira, com null) a camada de asteroides e cometas. */
  setSmallBodies(items: readonly SmallBodyLayerItem[] | null, onOpen: (slug: string) => void = () => {}) {
    this.smallLayer?.dispose();
    this.smallLayer = null;
    if (!items || this.disposed) return;
    this.smallLayer = new SmallBodyLayer(items, this.opts.labelLayer, onOpen, this.renderer.getPixelRatio());
    this.smallLayer.setShowOrbits(this.showOrbits);
    this.smallLayer.update(this.jd);
    this.scene.add(this.smallLayer.group);
  }

  setShowLabels(show: boolean) {
    this.showLabels = show;
    this.opts.labelLayer.toggleAttribute('hidden', !show);
  }

  getLiveInfo(id: BodyId): LiveInfo | null {
    const p = this.positionsAu.get(id);
    const e = this.positionsAu.get('earth');
    if (!p || !e) return null;
    const info: LiveInfo = { distanceSunAu: vlen(p), distanceEarthAu: id === 'earth' ? 0 : vlen(vsub(p, e)) };
    const body = this.visuals.get(id)?.body;
    const offset = body ? planetocentricOffsetKm(body, this.jd) : null;
    if (offset) info.distanceParentKm = vlen(offset);
    return info;
  }

  select(id: BodyId | null, options: { fly?: boolean; emit?: boolean } = {}) {
    if (this.selected) {
      this.visuals.get(this.selected)?.setHighlighted(false);
      this.orbits.get(this.selected)?.setHighlighted(false);
      this.labels.find((l) => l.id === this.selected)?.el.classList.remove('is-selected');
    }
    this.selected = id;
    if (id) {
      this.visuals.get(id)?.setHighlighted(true);
      this.orbits.get(id)?.setHighlighted(true);
      this.labels.find((l) => l.id === id)?.el.classList.add('is-selected');
      if (options.fly !== false) this.flyToBody(id);
    }
    if (options.emit !== false) this.opts.callbacks.onSelect(id);
  }

  flyToBody(id: BodyId) {
    const visual = this.visuals.get(id);
    const pos = this.positionsScene.get(id);
    if (!visual || !pos) return;
    const ringFactor = visual.body.render.rings?.style === 'saturn' ? 2.4 : 1;
    const dist =
      visual.body.type === 'moon' ? Math.max(visual.radius * 7, 0.6) : Math.max(visual.radius * 5.5 * ringFactor, 2.2);
    // Ver o corpo do lado iluminado, ligeiramente de lado para mostrar o terminador
    const toSun = pos.lengthSq() > 0 ? pos.clone().negate().normalize() : new Vector3(0, 0, 1);
    const side = new Vector3(0, 1, 0).cross(toSun).normalize();
    const offset = toSun
      .multiplyScalar(Math.cos(MathUtils.degToRad(40)))
      .add(side.multiplyScalar(Math.sin(MathUtils.degToRad(40))))
      .add(new Vector3(0, 0.28, 0))
      .normalize()
      .multiplyScalar(dist);
    if (id === 'sun') offset.set(0, 0.35, 1).normalize().multiplyScalar(SCENE_SCALE.sunRadiusUnits * 6);
    this.following = id;
    this.controls.minDistance = visual.radius * 1.4;
    this.startFlight({ bodyId: id, offset }, 1600);
  }

  setView(mode: ViewMode) {
    this.following = null;
    this.controls.minDistance = 3;
    const pose = this.viewPose(mode);
    this.startFlight({ toPos: pose.pos, toTarget: pose.target }, 1400);
  }

  recenter() {
    this.select(null, { fly: false });
    this.setView('overview');
  }

  resize() {
    const parent = this.opts.canvas.parentElement ?? this.opts.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.resizeObserver.disconnect();
    const c = this.opts.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('webglcontextlost', this.onContextLost);
    this.controls.removeEventListener('start', this.onControlsStart);
    this.controls.dispose();
    this.smallLayer?.dispose();
    this.smallLayer = null;
    for (const v of this.visuals.values()) v.dispose();
    for (const o of this.orbits.values()) o.dispose();
    for (const o of this.moonOrbits.values()) {
      o.line.geometry.dispose();
      o.material.dispose();
    }
    if (this.stars) {
      this.stars.geometry.dispose();
      (this.stars.material as { dispose(): void }).dispose();
    }
    for (const l of this.labels) l.el.remove();
    void disposeTextureCache();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ---------------------------------------------------------------- câmara

  private viewPose(mode: ViewMode): { pos: Vector3; target: Vector3 } {
    const aspect = this.camera.aspect || 1.6;
    const base = 520 / Math.min(1, aspect * 1.1);
    const target = new Vector3(0, 0, 0);
    switch (mode) {
      case 'top':
        return { pos: new Vector3(0, base * 1.08, 0.001), target };
      case 'edge':
        return { pos: new Vector3(0, base * 0.03, base * 1.05), target };
      default: {
        const el = MathUtils.degToRad(32);
        return { pos: new Vector3(base * 0.25, base * Math.sin(el), base * Math.cos(el)), target };
      }
    }
  }

  private startFlight(dest: Omit<Flight, 'fromPos' | 'fromTarget' | 'start' | 'duration'>, duration: number) {
    this.flight = {
      ...dest,
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      start: performance.now(),
      duration: this.opts.reducedMotion ? 0 : duration,
    };
    this.controls.enabled = false;
  }

  private updateFlight(now: number) {
    const f = this.flight;
    if (!f) return;
    const p = f.duration === 0 ? 1 : Math.min(1, (now - f.start) / f.duration);
    const e = easeInOutCubic(p);
    let toPos: Vector3;
    let toTarget: Vector3;
    if (f.bodyId && f.offset) {
      const bp = this.positionsScene.get(f.bodyId) ?? new Vector3();
      toTarget = bp.clone();
      toPos = bp.clone().add(f.offset);
    } else {
      toPos = f.toPos ?? this.camera.position;
      toTarget = f.toTarget ?? this.controls.target;
    }
    this.camera.position.lerpVectors(f.fromPos, toPos, e);
    this.controls.target.lerpVectors(f.fromTarget, toTarget, e);
    if (p >= 1) {
      this.flight = null;
      this.controls.enabled = true;
    }
  }

  private followSelected(prevPos: Vector3 | undefined) {
    if (!this.following || this.flight || !prevPos) return;
    const now = this.positionsScene.get(this.following);
    if (!now) return;
    const delta = now.clone().sub(prevPos);
    this.camera.position.add(delta);
    this.controls.target.add(delta);
  }

  // ---------------------------------------------------------------- ciclo

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    const prevFollow = this.following ? this.positionsScene.get(this.following)?.clone() : undefined;
    if (!this.paused && !this.clamped) {
      const next = this.jd + this.rateDaysPerSecond * dt;
      const c = clampToValidity(next);
      this.jd = c.jd;
      if (c.clamped) {
        this.clamped = true;
        this.paused = true;
        this.emitTime(true);
      }
      this.updatePositions();
    }
    this.followSelected(prevFollow);
    this.updateFlight(now);
    this.controls.update(dt);
    this.updateNearParent();
    this.starGroup.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    if (this.showLabels) this.updateLabels();
    if (now - this.lastTimeEmit > 125) this.emitTime(false);
    this.measurePerformance(now);
  };

  private emitTime(force: boolean) {
    this.lastTimeEmit = performance.now();
    if (force || !this.paused) this.opts.callbacks.onTime(this.jd, this.clamped);
  }

  private measurePerformance(now: number) {
    if (!this.opts.autoQuality || this.qualityReduced) return;
    this.fpsFrames += 1;
    const elapsed = now - this.fpsStart;
    if (elapsed < 2000) return;
    const fps = (this.fpsFrames * 1000) / elapsed;
    this.fpsFrames = 0;
    this.fpsStart = now;
    if (now - this.startedAt < 4000 || document.hidden) return;
    this.slowWindows = fps < 28 ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= 2) {
      this.qualityReduced = true;
      this.renderer.setPixelRatio(1);
      this.resize();
      this.opts.callbacks.onQualityReduced();
    }
  }

  // ---------------------------------------------------------------- etiquetas e seleção

  private projectToScreen(world: Vector3, out: { x: number; y: number; visible: boolean }) {
    const v = world.clone().project(this.camera);
    const canvas = this.opts.canvas;
    out.visible = v.z > -1 && v.z < 1;
    out.x = ((v.x + 1) / 2) * canvas.clientWidth;
    out.y = ((1 - v.y) / 2) * canvas.clientHeight;
  }

  /** Raio aparente (em píxeis) de uma esfera de raio r na posição p. */
  private screenRadius(p: Vector3, r: number): number {
    const dist = this.camera.position.distanceTo(p);
    if (dist <= r) return 1e4;
    const fov = MathUtils.degToRad(this.camera.fov);
    return (r / (dist * Math.tan(fov / 2))) * (this.opts.canvas.clientHeight / 2);
  }

  private updateLabels() {
    const placed: Array<{ x: number; y: number; w: number }> = [];
    const scr = { x: 0, y: 0, visible: false };
    const sorted = [...this.labels].sort((a, b) => {
      if (a.id === this.selected) return -1;
      if (b.id === this.selected) return 1;
      return b.priority - a.priority;
    });
    for (const label of sorted) {
      const pos = this.positionsScene.get(label.id);
      const visual = this.visuals.get(label.id);
      if (!pos || !visual) continue;
      this.projectToScreen(pos, scr);
      let show = scr.visible;
      if (!this.isPickable(label.id)) show = false;
      const rPx = this.screenRadius(pos, visual.radius);
      const y = scr.y + Math.min(rPx, 220) + 8;
      if (show) {
        for (const p of placed) {
          if (Math.abs(p.y - y) < 18 && Math.abs(p.x - scr.x) < (p.w + label.width) / 2) {
            show = label.id === this.selected;
            break;
          }
        }
      }
      if (show) {
        placed.push({ x: scr.x, y, w: label.width });
        label.el.style.transform = `translate3d(${scr.x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
        label.el.classList.remove('is-hidden');
        label.el.tabIndex = 0;
      } else {
        label.el.classList.add('is-hidden');
        label.el.tabIndex = -1;
      }
    }
    // Asteroides e cometas: só onde não se sobrepõem às etiquetas dos planetas e das luas
    for (const label of this.smallLayer?.labels() ?? []) {
      this.projectToScreen(label.pos, scr);
      const y = scr.y + 10;
      let show = scr.visible;
      if (show) {
        for (const p of placed) {
          if (Math.abs(p.y - y) < 16 && Math.abs(p.x - scr.x) < (p.w + label.width) / 2) {
            show = false;
            break;
          }
        }
      }
      if (show) {
        placed.push({ x: scr.x, y, w: label.width });
        label.el.style.transform = `translate3d(${scr.x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
        label.el.classList.remove('is-hidden');
        label.el.tabIndex = 0;
      } else {
        label.el.classList.add('is-hidden');
        label.el.tabIndex = -1;
      }
    }
  }

  private pick(x: number, y: number): BodyId | null {
    let best: { id: BodyId; dist: number; depth: number } | null = null;
    const scr = { x: 0, y: 0, visible: false };
    for (const [id, visual] of this.visuals) {
      const pos = this.positionsScene.get(id);
      if (!pos) continue;
      if (!this.isPickable(id)) continue;
      this.projectToScreen(pos, scr);
      if (!scr.visible) continue;
      const r = Math.max(this.screenRadius(pos, visual.radius), PICK_MIN_PX);
      const d = Math.hypot(scr.x - x, scr.y - y);
      if (d <= r) {
        const depth = this.camera.position.distanceTo(pos);
        if (!best || depth < best.depth) best = { id, dist: d, depth };
      }
    }
    return best?.id ?? null;
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
    const rect = this.opts.canvas.getBoundingClientRect();
    const id = this.pick(e.clientX - rect.left, e.clientY - rect.top);
    if (id) this.select(id, { fly: true });
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || this.pointerDown) return;
    const rect = this.opts.canvas.getBoundingClientRect();
    const id = this.pick(e.clientX - rect.left, e.clientY - rect.top);
    this.opts.canvas.style.cursor = id ? 'pointer' : 'grab';
  };

  private readonly onControlsStart = () => {
    // O utilizador assumiu o controlo: cancela voos em curso, mas mantém o seguimento do objeto.
    this.flight = null;
    this.controls.enabled = true;
  };

  private readonly onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.opts.callbacks.onContextLost();
  };
}
