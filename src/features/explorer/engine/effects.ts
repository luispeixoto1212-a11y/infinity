import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  FrontSide,
  ShaderMaterial,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';

/** Textura radial suave gerada em canvas (brilho do Sol). */
export function createGlowTexture(inner: string, outer: string, size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.18, inner);
    g.addColorStop(0.42, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function createSunGlowMaterial(): SpriteMaterial {
  return new SpriteMaterial({
    map: createGlowTexture('rgba(255,236,190,0.95)', 'rgba(255,170,70,0.22)'),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
}

/**
 * Brilho atmosférico ilustrativo (efeito de Fresnel), mais intenso no lado iluminado.
 * Não é uma simulação de dispersão atmosférica.
 */
export function createAtmosphereMaterial(color: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uSunDir: { value: new Vector3(1, 0, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = viewMatrix * world;
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uSunDir;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldNormal;
      void main() {
        float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
        float fresnel = pow(rim, 3.0);
        float lit = smoothstep(-0.25, 0.55, dot(vWorldNormal, uSunDir));
        float a = fresnel * lit * 0.9;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
  });
}
