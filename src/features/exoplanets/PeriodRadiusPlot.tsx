import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { formatSignificant } from '../../core/format';
import { useElementSize } from '../../components/useElementSize';
import { numericFact, PRIMARY_BODIES, tr } from '../../data/catalog';
import { useI18n } from '../../i18n';
import { radiusEarth, type Exoplanet } from './exoplanetData';

interface Point {
  x: number;
  y: number;
  period: number;
  radius: number;
  planet?: Exoplanet;
  label?: string;
}

const EARTH_RADIUS_KM = 6371;
const m = { top: 14, right: 16, bottom: 42, left: 52 };

/** Planetas do Sistema Solar com período e raio médio da NASA, para referência. */
function solarSystemPoints(): Point[] {
  return PRIMARY_BODIES.filter((b) => b.type === 'planet').map((b) => ({
    x: 0,
    y: 0,
    period: numericFact(b, 'orbitalPeriod') ?? 0,
    radius: b.meanRadiusKm / EARTH_RADIUS_KM,
    label: tr(b.name),
  }));
}

function logTicks(min: number, max: number, candidates: number[]): number[] {
  return candidates.filter((v) => v >= min && v <= max);
}

function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

interface Props {
  planets: readonly Exoplanet[];
  /** Planeta a destacar (ficha de um exoplaneta). */
  highlight?: Exoplanet;
  compact?: boolean;
}

export function PeriodRadiusPlot({ planets, highlight, compact = false }: Props) {
  const { t } = useI18n();
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const height = compact ? 280 : width < 560 ? 320 : 420;

  const data = useMemo(() => {
    const pts: Point[] = [];
    for (const p of planets) {
      const r = radiusEarth(p);
      if (!p.radiusMeasured || !r || !p.period || p.period <= 0) continue;
      pts.push({ x: 0, y: 0, period: p.period, radius: r, planet: p });
    }
    return pts;
  }, [planets]);
  const solar = useMemo(solarSystemPoints, []);

  const domain = useMemo(() => {
    const all = [...data, ...solar];
    const px = all.map((p) => p.period);
    const py = all.map((p) => p.radius);
    return {
      x0: 10 ** Math.floor(Math.log10(Math.min(...px))),
      x1: 10 ** Math.ceil(Math.log10(Math.max(...px))),
      y0: Math.min(...py) < 0.3 ? 0.2 : 0.3,
      y1: Math.max(30, Math.max(...py) * 1.1),
    };
  }, [data, solar]);

  // Coordenadas no ecrã
  const layout = useMemo(() => {
    const innerW = Math.max(1, width - m.left - m.right);
    const innerH = height - m.top - m.bottom;
    const lx0 = Math.log10(domain.x0);
    const lx1 = Math.log10(domain.x1);
    const ly0 = Math.log10(domain.y0);
    const ly1 = Math.log10(domain.y1);
    const sx = (v: number) => m.left + ((Math.log10(v) - lx0) / (lx1 - lx0)) * innerW;
    const sy = (v: number) => m.top + innerH - ((Math.log10(v) - ly0) / (ly1 - ly0)) * innerH;
    for (const p of data) {
      p.x = sx(p.period);
      p.y = sy(p.radius);
    }
    for (const p of solar) {
      p.x = sx(p.period);
      p.y = sy(p.radius);
    }
    return { sx, sy, innerW, innerH };
  }, [width, height, domain, data, solar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const root = canvas.closest('.chart') ?? document.documentElement;
    const grid = cssVar(root, '--chart-grid', 'rgba(150,175,230,0.12)');
    const ink = cssVar(root, '--dust', '#9aa5c4');
    const ink2 = cssVar(root, '--star', '#e9edf8');
    const series = cssVar(root, '--series-1', '#3987e5');
    const sol = cssVar(root, '--sol', '#ffc874');
    const surface = cssVar(root, '--chart-surface', '#0c1328');

    ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif';
    ctx.lineWidth = 1;
    const xt = logTicks(domain.x0, domain.x1, [0.1, 1, 10, 100, 1000, 1e4, 1e5, 1e6]);
    const yt = logTicks(domain.y0, domain.y1, [0.2, 0.5, 1, 2, 5, 10, 20, 50]);
    ctx.strokeStyle = grid;
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let lastTickEnd = -Infinity;
    for (const v of xt) {
      const x = Math.round(layout.sx(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, m.top);
      ctx.lineTo(x, m.top + layout.innerH);
      ctx.stroke();
      const label = formatSignificant(v, 2);
      const half = ctx.measureText(label).width / 2;
      const lx = Math.min(x, width - 2 - half);
      // Em ecrãs estreitos salta as etiquetas que se sobreporiam à anterior
      if (lx - half < lastTickEnd + 6) continue;
      ctx.fillText(label, lx, m.top + layout.innerH + 6);
      lastTickEnd = lx + half;
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of yt) {
      const y = Math.round(layout.sy(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(m.left, y);
      ctx.lineTo(m.left + layout.innerW, y);
      ctx.stroke();
      ctx.fillText(formatSignificant(v, 2), m.left - 8, y);
    }
    // Títulos dos eixos
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t.exo.scatterX, m.left + layout.innerW / 2, height - 2);
    ctx.save();
    ctx.translate(12, m.top + layout.innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText(t.exo.scatterY, 0, 0);
    ctx.restore();

    // Pontos
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, layout.innerW, layout.innerH);
    ctx.clip();
    ctx.fillStyle = series;
    ctx.globalAlpha = highlight ? 0.28 : 0.5;
    for (const p of data) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Sistema Solar (marcas maiores com anel no tom do fundo e etiqueta)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const p of solar) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = sol;
      ctx.strokeStyle = surface;
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
    // Planeta destacado (desenhado por cima, com a etiqueta reservada primeiro)
    const placed: Array<{ x0: number; x1: number; y: number }> = [];
    const right = m.left + layout.innerW;
    const collides = (a: number, b: number, y: number) => placed.some((q) => Math.abs(q.y - y) < 13 && a < q.x1 + 4 && b > q.x0 - 4);
    const hp = highlight ? data.find((p) => p.planet === highlight) : undefined;
    if (hp && highlight) {
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = ink2;
      ctx.strokeStyle = surface;
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
      const w = ctx.measureText(highlight.name).width;
      const x0 = hp.x + 10 + w > right ? hp.x - 10 - w : hp.x + 10;
      ctx.fillText(highlight.name, x0, hp.y - 12);
      placed.push({ x0, x1: x0 + w, y: hp.y - 12 });
      ctx.font = '11px "IBM Plex Sans", system-ui, sans-serif';
    }
    // Etiquetas do Sistema Solar: à direita, à esquerda, por baixo ou por cima; sem espaço, ficam só no tooltip
    ctx.fillStyle = ink2;
    for (const p of [...solar].sort((a, b) => a.x - b.x)) {
      const label = p.label ?? '';
      const w = ctx.measureText(label).width;
      const options: Array<[number, number]> = [
        [p.x + 8, p.y],
        [p.x - 8 - w, p.y],
        [Math.min(p.x - w / 2, right - w), p.y + 14],
        [Math.min(p.x - w / 2, right - w), p.y - 14],
      ];
      const choice = options.find(([x0, y]) => x0 >= m.left && x0 + w <= right && !collides(x0, x0 + w, y));
      if (!choice) continue;
      ctx.fillText(label, choice[0], choice[1]);
      placed.push({ x0: choice[0], x1: choice[0] + w, y: choice[1] });
    }
    ctx.restore();
  }, [data, solar, width, height, layout, domain, highlight, t]);

  const pick = (clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: Point | null = null;
    let bestD = 14 * 14;
    for (const p of [...solar, ...data]) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  };

  return (
    <div className="chart">
      <ul className="chart-legend" aria-label="Legenda">
        <li>
          <span className="chart-dot" style={{ background: 'var(--series-1)' }} />
          {t.exo.title} ({formatSignificant(data.length, 6)})
        </li>
        <li>
          <span className="chart-dot chart-dot--big" style={{ background: 'var(--sol)' }} />
          {t.exo.solarSystem}
        </li>
      </ul>
      <div ref={wrapRef} className="chart-plot" style={{ height }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${t.exo.scatterTitle}. ${t.exo.scatterIntro}`}
          onPointerMove={(e) => setHover(pick(e.clientX, e.clientY))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const p = pick(e.clientX, e.clientY);
            if (p?.planet && p.planet !== highlight) navigate({ name: 'exoplanet', slug: p.planet.slug });
          }}
          style={{ cursor: hover?.planet ? 'pointer' : 'default' }}
        />
        {hover ? (
          <div
            className="chart-tooltip chart-tooltip--point"
            style={{ left: Math.min(width - 190, Math.max(0, hover.x + 12)), top: Math.max(0, hover.y - 64) }}
            role="status"
          >
            <div className="chart-tooltip-title">{hover.planet?.name ?? hover.label}</div>
            <div className="chart-tooltip-row">
              <strong>{formatSignificant(hover.period, 3)} d</strong>
              <span>{t.exo.columns.period}</span>
            </div>
            <div className="chart-tooltip-row">
              <strong>{formatSignificant(hover.radius, 3)} R⊕</strong>
              <span>{t.exo.columns.radius}</span>
            </div>
          </div>
        ) : null}
      </div>
      {compact ? null : <p className="section-note">{t.exo.scatterHint}</p>}
    </div>
  );
}
