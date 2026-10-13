import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  Vector2,
  Vector3,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { bodyFrameEcliptic } from '../../../core/astro/orientation';
import { eclipticToScene } from '../../../core/astro/scale';
import { daysSinceJ2000 } from '../../../core/astro/time';
import { numericFact } from '../../../data/catalog';
import type { CelestialBody } from '../../../data/types';
import { createAtmosphereMaterial, createSunGlowMaterial } from './effects';
import type { QualitySettings } from './quality';
import { loadTexture } from './textures';

export interface BodyVisual {
  body: CelestialBody;
  /** Grupo posicionado na cena. */
  group: Group;
  /** Grupo orientado segundo o polo e a rotação do corpo. */
  orient: Group;
  mesh: Mesh;
  radius: number;
  atmosphere?: ShaderMaterial;
  /** Carrega as texturas de alta resolução. */
  upgradeTextures(): Promise<void>;
  /** Atualiza a orientação (polo e meridiano) para a data indicada. */
  updateOrientation(jdTdb: number): void;
  /** Rotação síncrona: longitude 0° na direção `towardPlanet`, polo norte segundo `north` (cena). */
  orientSynchronous(towardPlanet: Vector3, north: Vector3): void;
  setHighlighted(on: boolean): void;
  dispose(): void;
}

export interface BodyVisualOptions {
  quality: QualitySettings;
  onTextureError?: (file: string) => void;
}

const tmpX = new Vector3();
const tmpY = new Vector3();
const tmpZ = new Vector3();
const tmpM = new Matrix4();

function toThree(v: { x: number; y: number; z: number }, out: Vector3): Vector3 {
  const s = eclipticToScene(v);
  return out.set(s.x, s.y, s.z);
}

export function createBodyVisual(body: CelestialBody, radius: number, opts: BodyVisualOptions): BodyVisual {
  const { quality } = opts;
  const disposables: Array<{ dispose(): void }> = [];
  const group = new Group();
  group.name = body.id;
  const orient = new Group();
  group.add(orient);

  const geometry = new SphereGeometry(radius, quality.sphereSegments, Math.round(quality.sphereSegments / 2));
  disposables.push(geometry);

  const isSun = body.type === 'star';
  const textured = Boolean(body.render.texture);
  let material: MeshBasicMaterial | MeshPhongMaterial;
  if (isSun) {
    material = new MeshBasicMaterial({ color: new Color(body.render.color) });
  } else {
    material = new MeshPhongMaterial({
      color: new Color(body.render.color),
      shininess: body.id === 'earth' ? 14 : 2,
      specular: new Color(body.id === 'earth' ? 0x2a3440 : 0x050505),
    });
  }
  disposables.push(material);
  const mesh = new Mesh(geometry, material);
  mesh.name = `${body.id}-surface`;
  orient.add(mesh);

  const tryLoad = async (file: string, color: boolean): Promise<Texture | null> => {
    try {
      return await loadTexture(file, { color, anisotropy: 4 });
    } catch {
      opts.onTextureError?.(file);
      return null;
    }
  };

  const applyMap = (tex: Texture | null) => {
    if (!tex) return;
    material.map = tex;
    material.color.set(0xffffff);
    material.needsUpdate = true;
  };

  // Texturas de baixa resolução: carregadas logo à partida
  if (textured && body.render.texture) {
    void tryLoad(`${body.render.texture}-512.jpg`, true).then((t) => {
      if (!material.map) applyMap(t);
    });
  }

  // Sol: brilho aditivo à volta do disco
  let glow: Sprite | undefined;
  if (isSun) {
    const glowMat = createSunGlowMaterial();
    disposables.push(glowMat, glowMat.map!);
    glow = new Sprite(glowMat);
    glow.scale.setScalar(radius * 7);
    glow.renderOrder = 2;
    group.add(glow);
  }

  // Nuvens da Terra (mapa estático, ilustrativo)
  let clouds: Mesh | undefined;
  let cloudMat: MeshPhongMaterial | undefined;
  if (body.render.clouds) {
    const cg = new SphereGeometry(radius * 1.012, quality.sphereSegments, Math.round(quality.sphereSegments / 2));
    cloudMat = new MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    disposables.push(cg, cloudMat);
    clouds = new Mesh(cg, cloudMat);
    clouds.name = `${body.id}-clouds`;
    clouds.visible = false;
    orient.add(clouds);
  }

  // Brilho atmosférico (ilustrativo)
  let atmosphere: ShaderMaterial | undefined;
  if (body.render.atmosphereGlow) {
    const ag = new SphereGeometry(radius * 1.06, 64, 32);
    atmosphere = createAtmosphereMaterial(body.render.atmosphereGlow);
    disposables.push(ag, atmosphere);
    const shell = new Mesh(ag, atmosphere);
    shell.name = `${body.id}-atmosphere`;
    group.add(shell);
  }

  // Anéis
  let ringMat: MeshLambertMaterial | undefined;
  const ringInfo = body.render.rings;
  if (ringInfo) {
    const eqRadiusKm = numericFact(body, 'equatorialRadius') ?? body.meanRadiusKm;
    const kmToScene = radius / eqRadiusKm;
    if (ringInfo.style === 'saturn') {
      const inner = ringInfo.innerKm * kmToScene;
      const outer = ringInfo.outerKm * kmToScene;
      const rg = new RingGeometry(inner, outer, 192, 1);
      const pos = rg.attributes.position!;
      const uv = rg.attributes.uv!;
      const v2 = new Vector2();
      for (let i = 0; i < pos.count; i += 1) {
        v2.set(pos.getX(i), pos.getY(i));
        uv.setXY(i, (v2.length() - inner) / (outer - inner), 0.5);
      }
      rg.rotateX(-Math.PI / 2);
      ringMat = new MeshLambertMaterial({
        color: new Color(0xd8ccb0),
        transparent: true,
        opacity: 0.95,
        side: DoubleSide,
        depthWrite: false,
      });
      disposables.push(rg, ringMat);
      const ring = new Mesh(rg, ringMat);
      ring.name = `${body.id}-rings`;
      ring.renderOrder = 1;
      orient.add(ring);
      void tryLoad('saturn-rings.png', true).then((t) => {
        if (t && ringMat) {
          ringMat.map = t;
          // A face não iluminada dos anéis não é negra: deixa passar parte da luz (difusão).
          ringMat.emissiveMap = t;
          ringMat.emissive.set(0x3a362e);
          ringMat.color.set(0xffffff);
          ringMat.needsUpdate = true;
        }
      });
    } else if (ringInfo.radiiKm) {
      const lineMat = new LineBasicMaterial({ color: 0x9fb0bb, transparent: true, opacity: 0.35, depthWrite: false });
      disposables.push(lineMat);
      for (const rKm of ringInfo.radiiKm) {
        const r = rKm * kmToScene;
        const pts: number[] = [];
        for (let k = 0; k < 128; k += 1) {
          const a = (k / 128) * Math.PI * 2;
          pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
        }
        const lg = new BufferGeometry();
        lg.setAttribute('position', new Float32BufferAttribute(pts, 3));
        disposables.push(lg);
        const loop = new LineLoop(lg, lineMat);
        loop.name = `${body.id}-ring-line`;
        orient.add(loop);
      }
    }
  }

  const rotationHours = numericFact(body, 'siderealRotation');

  const visual: BodyVisual = {
    body,
    group,
    orient,
    mesh,
    radius,
    atmosphere,
    async upgradeTextures() {
      const jobs: Promise<void>[] = [];
      if (body.render.texture && quality.hiResTextures) {
        jobs.push(tryLoad(`${body.render.texture}-2k.jpg`, true).then(applyMap));
      }
      if (body.render.normalMap && quality.normalMaps && material instanceof MeshPhongMaterial) {
        const m = material;
        jobs.push(
          tryLoad(`${body.render.normalMap}.jpg`, false).then((t) => {
            if (t) {
              m.normalMap = t;
              m.normalScale.set(0.6, 0.6);
              m.needsUpdate = true;
            }
          }),
        );
      }
      if (body.id === 'earth' && material instanceof MeshPhongMaterial) {
        const m = material;
        jobs.push(
          tryLoad('earth-specular.jpg', false).then((t) => {
            if (t) {
              m.specularMap = t;
              m.needsUpdate = true;
            }
          }),
        );
      }
      if (clouds && cloudMat) {
        const c = clouds;
        const cm = cloudMat;
        jobs.push(
          tryLoad('earth-clouds-alpha.jpg', false).then((t) => {
            if (t) {
              cm.alphaMap = t;
              cm.needsUpdate = true;
              c.visible = true;
            }
          }),
        );
      }
      await Promise.all(jobs);
    },
    updateOrientation(jdTdb: number) {
      if (body.pole) {
        const f = bodyFrameEcliptic(body.pole, jdTdb);
        toThree(f.primeMeridian, tmpX);
        toThree(f.north, tmpY);
        toThree(f.east90, tmpZ).negate();
        tmpM.makeBasis(tmpX, tmpY, tmpZ);
        orient.quaternion.setFromRotationMatrix(tmpM);
      } else if (rotationHours) {
        // Sem modelo de polo (Ceres): eixo perpendicular à eclíptica, fase arbitrária.
        const turns = (daysSinceJ2000(jdTdb) * 24) / rotationHours;
        orient.rotation.set(0, (turns % 1) * Math.PI * 2, 0);
      }
    },
    orientSynchronous(towardPlanet: Vector3, north: Vector3) {
      tmpY.copy(north).normalize();
      tmpX.copy(towardPlanet).addScaledVector(tmpY, -towardPlanet.dot(tmpY)).normalize();
      tmpZ.crossVectors(tmpX, tmpY);
      tmpM.makeBasis(tmpX, tmpY, tmpZ);
      orient.quaternion.setFromRotationMatrix(tmpM);
    },
    setHighlighted(on: boolean) {
      if (material instanceof MeshPhongMaterial) {
        material.emissive.set(on ? 0x0b1430 : 0x000000);
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      group.removeFromParent();
    },
  };
  return visual;
}

