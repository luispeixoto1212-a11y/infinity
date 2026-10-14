import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { PLANCK18, ageAtScaleFactor } from '../../../core/astro/cosmology';
import { formatNumber } from '../../../core/format';
import { useI18n } from '../../../i18n';
import { useInView } from './useAnimation';
import { VizFrame } from './VizFrame';

/** Equação da lente pontual: posição na fonte β para a posição no céu θ (em unidades do raio de Einstein). */
export function lensMap(x: number, y: number): [number, number] {
  const r2 = x * x + y * y || 1e-12;
  return [x - x / r2, y - y / r2];
}

/** Ampliação total de uma fonte pontual à distância u (em raios de Einstein) do eixo da lente. */
export function pointLensMagnification(u: number): number {
  return (u * u + 2) / (u * Math.sqrt(u * u + 4));
}

/**
 * Lente gravitacional pontual (calculada): cada píxel é traçado de volta até ao plano da fonte com a equação
 * da lente, β = θ − θ_E² θ/|θ|². Arraste a galáxia de fundo para ver os arcos e o anel de Einstein.
 */
export function LensingViz() {
  const { t } = useI18n();
  const tx = t.extreme.lensing;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inView = useInView(canvasRef);
  const [src, setSrc] = useState<[number, number]>([0.35, 0.15]);
  const dragging = useRef(false);
  const W = 240;
  const H = 160;
  const scale = 52; // píxeis (da imagem interna) por raio de Einstein

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !inView) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const sigma = 0.16;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = (i + 0.5 - W / 2) / scale;
        const y = (j + 0.5 - H / 2) / scale;
        const [bx, by] = lensMap(x, y);
        // Galáxia de fundo: núcleo gaussiano e disco mais ténue, ligeiramente alongado
        const dx = bx - src[0];
        const dy = by - src[1];
        const q = (dx * dx) / (sigma * sigma) + (dy * dy) / (sigma * sigma * 0.55);
        const core = Math.exp(-q * 2.2);
        const disk = Math.exp(-q * 0.45) * 0.5;
        const v = Math.min(1, core + disk);
        const o = (j * W + i) * 4;
        d[o] = 4 + 120 * v + 120 * core;
        d[o + 1] = 6 + 150 * v + 80 * core;
        d[o + 2] = 18 + 230 * v;
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Lente (galáxia em primeiro plano), raio de Einstein e posição real da fonte
    ctx.fillStyle = 'rgba(255, 210, 150, 0.9)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 200, 116, 0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(W / 2 + src[0] * scale, H / 2 + src[1] * scale, sigma * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [src, inView]);

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (((e.clientX - r.left) / r.width) * W - W / 2) / scale;
    const y = (((e.clientY - r.top) / r.height) * H - H / 2) / scale;
    setSrc([Math.max(-2, Math.min(2, x)), Math.max(-1.4, Math.min(1.4, y))]);
  };
  const u = Math.hypot(src[0], src[1]);

  return (
    <VizFrame title={tx.title} kind="calculated" note={tx.note}>
      <canvas
        ref={canvasRef}
        className="viz-canvas viz-canvas--pixel"
        role="img"
        aria-label={tx.aria(formatNumber(u, 2))}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => dragging.current && move(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      />
      <div className="viz-controls viz-controls--row">
        <label className="field">
          <span className="field-label">{tx.offset(formatNumber(u, 2))}</span>
          <input type="range" min={0} max={2} step={0.01} value={Math.min(2, src[0])} onChange={(e) => setSrc([Number(e.target.value), 0])} aria-label={tx.slider} />
        </label>
        <p className="viz-big">{tx.magnification(formatNumber(pointLensMagnification(Math.max(u, 0.01)), u < 0.05 ? 0 : 2))}</p>
      </div>
    </VizFrame>
  );
}

// ——— Gráficos ———

const G_KPC = 4.30091e-6; // kpc (km/s)² / M☉

/** Modelo simplificado da curva de rotação de uma galáxia como a Via Láctea (parâmetros ilustrativos). */
export function rotationCurve(rKpc: number): { visible: number; total: number } {
  const Mb = 1.5e10;
  const a = 0.6;
  const Md = 6e10;
  const Rd = 2.6;
  const vinf = 240;
  const rc = 6;
  const Mvis = (Mb * rKpc * rKpc) / (rKpc + a) ** 2 + Md * (1 - (1 + rKpc / Rd) * Math.exp(-rKpc / Rd));
  const visible = Math.sqrt((G_KPC * Mvis) / rKpc);
  const halo2 = vinf ** 2 * (1 - (rc / rKpc) * Math.atan(rKpc / rc));
  return { visible, total: Math.sqrt(visible ** 2 + halo2) };
}

interface ChartProps {
  series: Array<{ points: Array<[number, number]>; color: string; label: string; dashed?: boolean }>;
  xMax: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  xTicks: number[];
  yTicks: number[];
  marker?: { x: number; y: number; label: string };
  aria: string;
}

function LineChart({ series, xMax, yMax, xLabel, yLabel, xTicks, yTicks, marker, aria }: ChartProps) {
  const W = 420;
  const Hh = 250;
  const m = { l: 48, r: 14, t: 14, b: 40 };
  const x = (v: number) => m.l + (v / xMax) * (W - m.l - m.r);
  const y = (v: number) => Hh - m.b - (v / yMax) * (Hh - m.t - m.b);
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="viz-chart" role="img" aria-label={aria}>
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="vc-grid" />
          <text x={m.l - 6} y={y(v) + 4} textAnchor="end" className="vc-tick">
            {formatNumber(v, 1)}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <text key={`x${v}`} x={x(v)} y={Hh - m.b + 16} textAnchor="middle" className="vc-tick">
          {formatNumber(v, 0)}
        </text>
      ))}
      <text x={(m.l + W - m.r) / 2} y={Hh - 6} textAnchor="middle" className="vc-axis">
        {xLabel}
      </text>
      <text x={12} y={(m.t + Hh - m.b) / 2} textAnchor="middle" className="vc-axis" transform={`rotate(-90 12 ${(m.t + Hh - m.b) / 2})`}>
        {yLabel}
      </text>
      {series.map((s) => (
        <polyline
          key={s.label}
          points={s.points.map(([a, b]) => `${x(a)},${y(b)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={2.2}
          strokeDasharray={s.dashed ? '6 5' : undefined}
        />
      ))}
      {marker ? (
        <g>
          <circle cx={x(marker.x)} cy={y(marker.y)} r={5} className="vc-marker" />
          <text x={x(marker.x) + 8} y={y(marker.y) - 8} className="vc-marker-label">
            {marker.label}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function Legend({ items }: { items: Array<{ color: string; label: string; dashed?: boolean }> }) {
  return (
    <ul className="viz-legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className={it.dashed ? 'viz-swatch viz-swatch--dashed' : 'viz-swatch'} style={{ borderColor: it.color, background: it.dashed ? 'transparent' : it.color }} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Curva de rotação: só com a matéria visível (cai) e com um halo de matéria escura (plana). */
export function RotationViz() {
  const { t } = useI18n();
  const tx = t.extreme.rotation;
  const data = useMemo(() => {
    const vis: Array<[number, number]> = [];
    const tot: Array<[number, number]> = [];
    for (let r = 0.3; r <= 30; r += 0.3) {
      const v = rotationCurve(r);
      vis.push([r, v.visible]);
      tot.push([r, v.total]);
    }
    return { vis, tot };
  }, []);
  return (
    <VizFrame title={tx.title} kind="illustrative" note={tx.note}>
      <LineChart
        series={[
          { points: data.tot, color: '#7aa2ff', label: tx.withHalo },
          { points: data.vis, color: '#ffc874', label: tx.visible, dashed: true },
        ]}
        xMax={30}
        yMax={300}
        xTicks={[0, 5, 10, 15, 20, 25, 30]}
        yTicks={[0, 100, 200, 300]}
        xLabel={tx.x}
        yLabel={tx.y}
        marker={{ x: 8.2, y: 229, label: tx.sun }}
        aria={tx.aria}
      />
      <Legend
        items={[
          { color: '#7aa2ff', label: tx.withHalo },
          { color: '#ffc874', label: tx.visible, dashed: true },
        ]}
      />
    </VizFrame>
  );
}

/** Fator de escala a(t): Universo com energia escura (Planck 2018) e só com matéria, com o mesmo H₀. */
export function ExpansionViz() {
  const { t } = useI18n();
  const tx = t.extreme.expansion;
  const data = useMemo(() => {
    const lcdm: Array<[number, number]> = [];
    for (let a = 0.01; a <= 3.2; a += 0.02) {
      const tt = ageAtScaleFactor(a, PLANCK18);
      if (tt > 30) break;
      lcdm.push([tt, a]);
    }
    const t0 = (2 / 3) * (977.792221 / PLANCK18.H0);
    const eds: Array<[number, number]> = [];
    for (let tt = 0; tt <= 30; tt += 0.25) eds.push([tt, (tt / t0) ** (2 / 3)]);
    return { lcdm, eds, now: ageAtScaleFactor(1, PLANCK18), t0 };
  }, []);
  return (
    <VizFrame title={tx.title} kind="calculated" note={tx.note(formatNumber(data.now, 2), formatNumber(data.t0, 1))}>
      <LineChart
        series={[
          { points: data.lcdm, color: '#c3a6ff', label: tx.lcdm },
          { points: data.eds, color: '#7fd6c2', label: tx.matter, dashed: true },
        ]}
        xMax={30}
        yMax={3}
        xTicks={[0, 5, 10, 15, 20, 25, 30]}
        yTicks={[0, 1, 2, 3]}
        xLabel={tx.x}
        yLabel={tx.y}
        marker={{ x: data.now, y: 1, label: tx.today }}
        aria={tx.aria}
      />
      <Legend
        items={[
          { color: '#c3a6ff', label: tx.lcdm },
          { color: '#7fd6c2', label: tx.matter, dashed: true },
        ]}
      />
    </VizFrame>
  );
}
