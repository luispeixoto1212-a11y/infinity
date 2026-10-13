import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  MathUtils,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CelestialBody } from '../../data/types';
import { numericFact } from '../../data/catalog';
import { createBodyVisual } from '../explorer/engine/bodies';
import { QUALITY, detectQualityTier, isWebGLAvailable, prefersReducedMotion } from '../explorer/engine/quality';
import { disposeTextureCache } from '../explorer/engine/textures';
import { BodyThumb } from '../../components/BodyThumb';
import { useI18n } from '../../i18n';

/**
 * Globo interativo de um único objeto. O eixo aparece inclinado segundo a obliquidade
 * (o plano da órbita é horizontal) e a rotação é acelerada para ser visível.
 */
export function GlobeViewer({ body }: { body: CelestialBody }) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!isWebGLAvailable()) {
      setFailed(true);
      return;
    }
    const quality = QUALITY[detectQualityTier()];
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio));
    renderer.setClearColor(new Color('#000000'), 0);

    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.01, 100);
    const ringFactor = body.render.rings?.style === 'saturn' ? 2.35 : 1;
    camera.position.set(0, 0.6, 4.2 * ringFactor);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.6;
    controls.maxDistance = 9 * ringFactor;

    const isSun = body.type === 'star';
    scene.add(new AmbientLight(0x9fb2d0, isSun ? 1 : 0.3));
    const light = new DirectionalLight(0xfff4e6, 3.2);
    light.position.set(5, 3, 4);
    scene.add(light);

    const visual = createBodyVisual(body, 1, { quality });
    scene.add(visual.group);
    void visual.upgradeTextures();

    // Eixo de rotação (linha fina entre os polos)
    const axisMat = new LineBasicMaterial({ color: 0x8fa3c4, transparent: true, opacity: 0.45 });
    const axisGeo = new BufferGeometry();
    axisGeo.setAttribute('position', new Float32BufferAttribute([0, -1.45, 0, 0, 1.45, 0], 3));
    const axis = new Line(axisGeo, axisMat);
    visual.orient.add(axis);

    // Eixo inclinado segundo a obliquidade (em relação ao plano da órbita, horizontal no ecrã)
    // e rotação acelerada: uma volta em ~40 s, no sentido real (negativo = retrógrado).
    // Com rotação retrógrada (período negativo), o polo norte IAU — o do topo da textura — fica a
    // 180° − obliquidade da normal da órbita e o corpo roda no sentido inverso em torno dele.
    // Sem obliquidade conhecida (luas síncronas), o eixo fica perpendicular à órbita e só o sentido muda.
    const obliquityRaw = numericFact(body, 'obliquity');
    const rotation = numericFact(body, 'siderealRotation') ?? 24;
    const spinSign = rotation < 0 ? -1 : 1;
    const obliquity = obliquityRaw === undefined ? 0 : rotation < 0 ? 180 - obliquityRaw : obliquityRaw;
    const tilt = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -MathUtils.degToRad(obliquity));
    const spin = new Quaternion();
    const yAxis = new Vector3(0, 1, 0);
    const reduced = prefersReducedMotion();
    let angle = 0.6;
    const applyOrientation = () => {
      spin.setFromAxisAngle(yAxis, angle);
      visual.orient.quaternion.copy(tilt).multiply(spin);
    };
    applyOrientation();

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let last = performance.now();
    let raf = requestAnimationFrame(function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!reduced) {
        angle += spinSign * ((Math.PI * 2) / 40) * dt;
        applyOrientation();
      }
      if (visual.atmosphere) {
        (visual.atmosphere.uniforms.uSunDir!.value as Vector3).copy(light.position).normalize();
      }
      controls.update(dt);
      renderer.render(scene, camera);
    });

    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      setFailed(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      ro.disconnect();
      controls.dispose();
      axisGeo.dispose();
      axisMat.dispose();
      visual.dispose();
      void disposeTextureCache();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [body]);

  if (failed) {
    return (
      <div className="globe globe--fallback">
        <BodyThumb body={body} size={220} />
        <p className="muted">{t.explorer.webglUnavailable}</p>
      </div>
    );
  }

  return (
    <div className="globe">
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        role="img"
        aria-label={`${t.body.model3d}: ${body.name['pt-PT']}`}
      />
      <p className="globe-hint">{t.body.modelHint}</p>
    </div>
  );
}
