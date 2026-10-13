export type QualityTier = 'high' | 'low';

export interface QualitySettings {
  tier: QualityTier;
  maxPixelRatio: number;
  sphereSegments: number;
  normalMaps: boolean;
  /** Magnitude limite das estrelas desenhadas. */
  starMagLimit: number;
  hiResTextures: boolean;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { tier: 'high', maxPixelRatio: 2, sphereSegments: 96, normalMaps: true, starMagLimit: 6.5, hiResTextures: true },
  low: { tier: 'low', maxPixelRatio: 1.25, sphereSegments: 48, normalMaps: false, starMagLimit: 5.0, hiResTextures: true },
};

/** Heurística inicial; a qualidade é depois ajustada pelo desempenho medido. */
export function detectQualityTier(): QualityTier {
  if (typeof navigator === 'undefined') return 'high';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const smallScreen = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;
  if (cores <= 4 || memory <= 4 || (coarse && smallScreen)) return 'low';
  return 'high';
}

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return gl != null;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
