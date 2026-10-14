import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useElementSize } from '../../components/useElementSize';
import { DEG } from '../../core/astro/vector';
import type { SkyScene } from './skyScene';
import {
  type DrawnBody,
  type RenderOptions,
  type SelectionKey,
  type ViewParams,
  MAX_FOV,
  MIN_FOV,
  makeProjector,
  paintBackground,
  pickAt,
  renderSky,
} from './skyRenderer';
import type { SkyInstant } from './skyState';

export function clampView(v: ViewParams): ViewParams {
  return {
    azDeg: ((v.azDeg % 360) + 360) % 360,
    altDeg: Math.max(-30, Math.min(90, v.altDeg)),
    fovDeg: Math.max(MIN_FOV, Math.min(MAX_FOV, v.fovDeg)),
  };
}

/** Graus por píxel no centro da vista (projeção estereográfica). */
function degPerPixel(view: ViewParams, w: number, h: number): number {
  return ((4 * Math.tan((view.fovDeg * DEG) / 4)) / Math.min(w, h)) / DEG;
}

export interface SkyCanvasProps {
  scene: SkyScene | null;
  inst: SkyInstant;
  view: ViewParams;
  onViewChange: (v: ViewParams) => void;
  options: RenderOptions;
  onSelect: (key: SelectionKey | null) => void;
  label: string;
  describedBy?: string;
}

export function SkyCanvas({ scene, inst, view, onViewChange, options, onSelect, label, describedBy }: SkyCanvasProps) {
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const drawnRef = useRef<DrawnBody[]>([]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; view: ViewParams; moved: boolean; pinchDist?: number } | null>(null);

  // Desenho
  useEffect(() => {
    const canvas = canvasRef.current;
    const { width, height } = size;
    if (!canvas || width < 2 || height < 2) return;
    const id = requestAnimationFrame(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(width * dpr);
      const H = Math.round(height * dpr);
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (!bgRef.current) bgRef.current = document.createElement('canvas');
      const p = makeProjector(view, width, height);
      paintBackground(bgRef.current, p, inst, scene, options);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawnRef.current = renderSky(ctx, bgRef.current, p, view, inst, scene, options);
    });
    return () => cancelAnimationFrame(id);
  }, [size, view, inst, scene, options]);

  // Roda do rato (não passiva, para impedir o deslocamento da página)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0015)));
      onViewChange(clampView({ ...viewRef.current, fovDeg: viewRef.current.fovDeg * f }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wrapRef, onViewChange]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { startX: e.clientX, startY: e.clientY, view: viewRef.current, moved: false };
    } else if (pts.length === 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = { startX: (a.x + b.x) / 2, startY: (a.y + b.y) / 2, view: viewRef.current, moved: true, pinchDist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && g.pinchDist) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0) onViewChange(clampView({ ...g.view, fovDeg: (g.view.fovDeg * g.pinchDist) / d }));
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    if (!g.moved) e.currentTarget.setPointerCapture?.(e.pointerId);
    g.moved = true;
    const k = degPerPixel(g.view, size.width, size.height);
    const cosAlt = Math.max(0.35, Math.cos(g.view.altDeg * DEG));
    onViewChange(clampView({ ...g.view, azDeg: g.view.azDeg - (dx * k) / cosAlt, altDeg: g.view.altDeg + dy * k }));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // Fim de um gesto de pinça: continua a arrastar com o dedo que ficou
      const [rest] = [...pointers.current.values()];
      if (rest) gesture.current = { startX: rest.x, startY: rest.y, view: viewRef.current, moved: true };
      return;
    }
    gesture.current = null;
    if (g && !g.moved && e.type === 'pointerup') {
      const rect = e.currentTarget.getBoundingClientRect();
      const p = makeProjector(viewRef.current, size.width, size.height);
      onSelect(pickAt(e.clientX - rect.left, e.clientY - rect.top, p, viewRef.current, inst, scene, options, drawnRef.current));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const v = viewRef.current;
    const step = Math.max(1, v.fovDeg / 12);
    const actions: Record<string, () => ViewParams> = {
      ArrowLeft: () => ({ ...v, azDeg: v.azDeg - step }),
      ArrowRight: () => ({ ...v, azDeg: v.azDeg + step }),
      ArrowUp: () => ({ ...v, altDeg: v.altDeg + step }),
      ArrowDown: () => ({ ...v, altDeg: v.altDeg - step }),
      '+': () => ({ ...v, fovDeg: v.fovDeg / 1.25 }),
      '=': () => ({ ...v, fovDeg: v.fovDeg / 1.25 }),
      '-': () => ({ ...v, fovDeg: v.fovDeg * 1.25 }),
      _: () => ({ ...v, fovDeg: v.fovDeg * 1.25 }),
    };
    const act = actions[e.key];
    if (act) {
      e.preventDefault();
      onViewChange(clampView(act()));
    } else if (e.key === 'Escape') {
      onSelect(null);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="planetarium-stage"
      tabIndex={0}
      role="application"
      aria-roledescription="planetário"
      aria-label={label}
      aria-describedby={describedBy}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} className="planetarium-canvas" aria-hidden="true" />
    </div>
  );
}
