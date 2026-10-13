import { useEffect, useMemo, useRef, useState } from 'react';
import { formatSignificant } from '../../core/format';
import { solveKepler } from '../../core/astro/kepler';
import { Icon } from '../../components/Icon';
import { prefersReducedMotion, useElementSize } from '../../components/useElementSize';
import { useI18n } from '../../i18n';
import {
  MARS_FLUX,
  VENUS_FLUX,
  distanceForFlux,
  radiusEarth,
  semiMajorAxis,
  stellarLuminosity,
  type Exoplanet,
  type HostStar,
} from './exoplanetData';

interface OrbitBody {
  planet: Exoplanet;
  a: number;
  e: number;
  period?: number;
  /** Direção do periastro no desenho (ilustrativa). */
  angle: number;
  phase: number;
  size: number;
}

/** Cor aproximada de uma estrela a partir da temperatura (apenas indicativa). */
export function starColor(teff?: number): string {
  if (!teff) return '#fff4e0';
  if (teff < 3500) return '#ffb27a';
  if (teff < 4500) return '#ffcf96';
  if (teff < 5500) return '#ffe9c4';
  if (teff < 6500) return '#fff6e8';
  if (teff < 8000) return '#f2f4ff';
  return '#cfdcff';
}

const SOLAR_ORBITS = [
  { name: 'Mercúrio', a: 0.387 },
  { name: 'Vénus', a: 0.723 },
  { name: 'Terra', a: 1 },
  { name: 'Marte', a: 1.524 },
];

function niceAu(target: number): number {
  const steps = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  return steps.reduce((best, s) => (Math.abs(Math.log(s / target)) < Math.abs(Math.log(best / target)) ? s : best), steps[0]!);
}

function letter(p: Exoplanet): string {
  const parts = p.name.split(' ');
  const last = parts.at(-1) ?? p.name;
  return last.length <= 2 ? last : p.name;
}

export function OrbitView({ planets, star, highlight }: { planets: readonly Exoplanet[]; star: HostStar; highlight?: Exoplanet }) {
  const { t } = useI18n();
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [solar, setSolar] = useState(false);
  const timeRef = useRef(0);

  const bodies: OrbitBody[] = useMemo(
    () =>
      planets
        .map((p, i): OrbitBody | null => {
          const a = semiMajorAxis(p);
          if (!a) return null;
          const r = radiusEarth(p) ?? 1;
          return {
            planet: p,
            a: a.value,
            e: Math.min(0.95, Math.max(0, p.e ?? 0)),
            period: p.period,
            angle: (i * 137.5 * Math.PI) / 180,
            phase: i * 1.9,
            size: Math.max(2.5, Math.min(7, 2 + Math.log2(1 + r) * 1.4)),
          };
        })
        .filter((b): b is OrbitBody => b !== null),
    [planets],
  );

  const luminosity = stellarLuminosity(star);
  const minPeriod = Math.min(...bodies.map((b) => b.period ?? Infinity));
  const daysPerSecond = Number.isFinite(minPeriod) ? minPeriod / 5 : 1;
  const extent = Math.max(...bodies.map((b) => b.a * (1 + b.e)), solar ? 1.6 : 0) * 1.12;
  const height = Math.min(460, Math.max(280, width * 0.8));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || bodies.length === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cx = width / 2;
    const cy = height / 2;
    const scale = (Math.min(width, height) / 2 - 14) / extent;
    let raf = 0;
    let last = performance.now();

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      // Faixa entre o fluxo de Vénus e o de Marte
      if (luminosity) {
        const r0 = distanceForFlux(luminosity, VENUS_FLUX) * scale;
        const r1 = distanceForFlux(luminosity, MARS_FLUX) * scale;
        ctx.beginPath();
        ctx.arc(cx, cy, r1, 0, Math.PI * 2);
        ctx.arc(cx, cy, r0, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(127, 214, 160, 0.10)';
        ctx.fill();
      }
      // Órbitas do Sistema Solar interior (comparação)
      if (solar) {
        ctx.font = '10px "IBM Plex Sans", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        for (const o of SOLAR_ORBITS) {
          ctx.beginPath();
          ctx.arc(cx, cy, o.a * scale, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 200, 116, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = 'rgba(255, 200, 116, 0.75)';
          ctx.fillText(o.name, cx + o.a * scale * 0.71 + 3, cy - o.a * scale * 0.71 - 2);
        }
      }
      // Estrela
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
      const sc = starColor(star.teff);
      glow.addColorStop(0, sc);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sc;
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      const days = timeRef.current;
      ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
      for (const b of bodies) {
        const isHi = b.planet === highlight;
        const aPx = b.a * scale;
        const bPx = aPx * Math.sqrt(1 - b.e * b.e);
        const c = b.a * b.e * scale;
        // Elipse com a estrela num dos focos
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(b.angle);
        ctx.beginPath();
        ctx.ellipse(-c, 0, aPx, bPx, 0, 0, Math.PI * 2);
        ctx.strokeStyle = isHi ? 'rgba(157, 187, 255, 0.85)' : 'rgba(150, 175, 230, 0.32)';
        ctx.lineWidth = isHi ? 1.6 : 1;
        ctx.stroke();
        // Posição pela equação de Kepler
        const M = b.period ? b.phase + (2 * Math.PI * days) / b.period : b.phase;
        const E = solveKepler(((M % (2 * Math.PI)) * 180) / Math.PI, b.e) * (Math.PI / 180);
        const x = aPx * (Math.cos(E) - b.e);
        const y = bPx * Math.sin(E);
        ctx.beginPath();
        ctx.arc(x, y, isHi ? b.size + 1.5 : b.size, 0, Math.PI * 2);
        ctx.fillStyle = isHi ? '#e9edf8' : '#7aa2ff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#070b19';
        ctx.stroke();
        ctx.restore();
        const gx = cx + x * Math.cos(b.angle) - y * Math.sin(b.angle);
        const gy = cy + x * Math.sin(b.angle) + y * Math.cos(b.angle);
        ctx.fillStyle = isHi ? '#e9edf8' : 'rgba(233, 237, 248, 0.75)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter(b.planet), gx + b.size + 5, gy);
      }

      // Barra de escala
      const au = niceAu(extent / 3);
      const len = au * scale;
      ctx.strokeStyle = 'rgba(233, 237, 248, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(14, height - 16);
      ctx.lineTo(14 + len, height - 16);
      ctx.moveTo(14, height - 20);
      ctx.lineTo(14, height - 12);
      ctx.moveTo(14 + len, height - 20);
      ctx.lineTo(14 + len, height - 12);
      ctx.stroke();
      ctx.fillStyle = 'rgba(233, 237, 248, 0.8)';
      ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${formatSignificant(au, 2)} UA`, 14, height - 22);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing) timeRef.current += dt * daysPerSecond;
      draw();
      raf = requestAnimationFrame(loop);
    };
    draw();
    if (playing) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bodies, width, height, extent, luminosity, solar, star.teff, highlight, playing, daysPerSecond]);

  if (bodies.length === 0) {
    return <p className="section-note">{t.exo.orbitUnknown}</p>;
  }

  return (
    <figure className="orbit-view">
      <div ref={wrapRef} className="orbit-canvas" style={{ height }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${t.exo.orbitTitle}: ${bodies.map((b) => `${b.planet.name}, ${formatSignificant(b.a, 3)} UA`).join('; ')}`}
        />
      </div>
      <div className="orbit-controls">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
          <Icon name={playing ? 'pause' : 'play'} size={14} />
          {playing ? t.exo.orbitPause : t.exo.orbitPlay}
        </button>
        <label className="check">
          <input type="checkbox" checked={solar} onChange={(e) => setSolar(e.target.checked)} />
          {t.exo.orbitSolar}
        </label>
        {Number.isFinite(minPeriod) ? <span className="orbit-speed">{t.exo.orbitSpeed(formatSignificant(daysPerSecond, 2))}</span> : null}
      </div>
      <figcaption className="section-note">
        {t.exo.orbitNote}
        {luminosity ? null : ' A estrela não tem raio ou temperatura publicados, por isso a faixa de fluxo não é desenhada.'}
      </figcaption>
    </figure>
  );
}
