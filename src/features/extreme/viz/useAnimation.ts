import { useEffect, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '../../../components/useElementSize';

/** Verdadeiro enquanto o elemento está visível no ecrã (as animações param fora de vista). */
export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = '100px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/**
 * Corre draw(t) a cada frame enquanto o canvas está visível. Com "reduzir movimento" ativo no sistema,
 * desenha uma só imagem fixa (salvo se o utilizador carregar em reproduzir).
 */
export function useCanvasAnimation(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void,
  deps: unknown[],
): { canvasRef: RefObject<HTMLCanvasElement | null>; playing: boolean; setPlaying: (v: boolean) => void } {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inView = useInView(canvasRef);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      const W = Math.max(1, Math.round(r.width * dpr));
      const H = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return r;
    };
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const r = resize();
      // O carimbo do rAF pode ser ligeiramente anterior ao instante em que a animação foi agendada
      if (playing) tRef.current += Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      drawRef.current(ctx, r.width, r.height, tRef.current);
      if (playing && inView) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, inView, ...deps]);

  return { canvasRef, playing, setPlaying };
}
