import { useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useElementSize } from '../../components/useElementSize';
import { useI18n } from '../../i18n';
import type { TimelineCategory } from './cosmicEvents';
import { type ScaleMode, type TimedEvent, coordinate, fullDomain, minSpan, ticksFor } from './timeScale';

export const CATEGORY_ORDER: TimelineCategory[] = ['cosmos', 'galaxies', 'solar-system', 'life', 'astronomy', 'space'];
export const TIMELINE_COLORS: Record<TimelineCategory, string> = {
  cosmos: '#c3a6ff',
  galaxies: '#7aa2ff',
  'solar-system': '#ffc874',
  life: '#7fd6c2',
  astronomy: '#ff9d6b',
  space: '#5fc2e8',
};

const LANE_H = 58;
const AXIS_H = 34;
const RIGHT = 18;

export interface TimelineChartProps {
  events: TimedEvent[];
  mode: ScaleMode;
  domain: [number, number];
  onDomainChange: (d: [number, number]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function clampDomain(mode: ScaleMode, d: [number, number]): [number, number] {
  const [f0, f1] = fullDomain(mode);
  let span = Math.min(f1 - f0, Math.max(minSpan(mode), d[1] - d[0]));
  let a = d[0] + (d[1] - d[0] - span) / 2;
  if (a < f0) a = f0;
  if (a + span > f1) a = f1 - span;
  if (span > f1 - f0) span = f1 - f0;
  return [a, a + span];
}

export function TimelineChart({ events, mode, domain, onDomainChange, selectedId, onSelect }: TimelineChartProps) {
  const { t } = useI18n();
  const tt = t.timeline;
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const width = Math.max(300, size.width);
  // Em ecrãs estreitos, o nome de cada faixa fica por cima da faixa, para dar o espaço todo ao eixo
  const narrow = width < 640;
  const LEFT = narrow ? 10 : 132;
  const plotW = width - LEFT - RIGHT;
  const height = AXIS_H + CATEGORY_ORDER.length * LANE_H + 6;
  const [d0, d1] = domain;
  const x = (v: number) => LEFT + ((v - d0) / (d1 - d0)) * plotW;
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const drag = useRef<{ x: number; domain: [number, number]; pinch?: number } | null>(null);
  const pointers = useRef(new Map<number, number>());

  const ticks = useMemo(() => ticksFor(mode, d0, d1, Math.max(3, Math.floor(plotW / 110))), [mode, d0, d1, plotW]);

  // Etiquetas sem sobreposição: em cada faixa, duas linhas (acima e abaixo do marcador)
  const placed = useMemo(() => {
    const out: Array<{ e: TimedEvent; cx: number; lane: number; labelRow: 0 | 1 | null; labelX: number }> = [];
    const lastEnd: Record<string, [number, number]> = {};
    const sorted = [...events].sort((a, b) => coordinate(a, mode) - coordinate(b, mode));
    for (const e of sorted) {
      const v = coordinate(e, mode);
      if (v < d0 - (d1 - d0) * 0.02 || v > d1 + (d1 - d0) * 0.02) continue;
      const cx = x(v);
      const lane = CATEGORY_ORDER.indexOf(e.category);
      const w = Math.min(170, e.title.length * 6.4) + 8;
      // Junto à margem direita, a etiqueta passa para a esquerda do marcador
      const labelX = Math.min(cx + 8, LEFT + plotW - w);
      const ends = (lastEnd[e.category] ??= [-Infinity, -Infinity]);
      let labelRow: 0 | 1 | null = null;
      for (const r of [0, 1] as const) {
        if (labelX - 4 > ends[r]) {
          labelRow = r;
          ends[r] = labelX + w;
          break;
        }
      }
      out.push({ e, cx, lane, labelRow, labelX });
    }
    return out;
    // x depende de d0, d1 e plotW
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, mode, d0, d1, plotW, LEFT]);

  const zoomAt = (factor: number, px?: number) => {
    const [a, b] = domainRef.current;
    const center = px === undefined ? (a + b) / 2 : a + ((px - LEFT) / plotW) * (b - a);
    onDomainChange(clampDomain(mode, [center - (center - a) * factor, center + (b - center) * factor]));
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const [a, b] = domainRef.current;
        const dv = (e.deltaX / plotW) * (b - a);
        onDomainChange(clampDomain(mode, [a + dv, b + dv]));
        return;
      }
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(Math.max(-0.4, Math.min(0.4, e.deltaY * 0.002))), e.clientX - rect.left);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapRef, mode, plotW, LEFT, onDomainChange]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('.tl-event')) return;
    pointers.current.set(e.pointerId, e.clientX);
    const xs = [...pointers.current.values()];
    drag.current = xs.length === 2 ? { x: (xs[0]! + xs[1]!) / 2, domain: domainRef.current, pinch: Math.abs(xs[0]! - xs[1]!) } : { x: e.clientX, domain: domainRef.current };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, e.clientX);
    const g = drag.current;
    const [a, b] = g.domain;
    const xs = [...pointers.current.values()];
    if (xs.length >= 2 && g.pinch) {
      const dist = Math.abs(xs[0]! - xs[1]!);
      if (dist > 10) {
        const c = (a + b) / 2;
        const f = g.pinch / dist;
        onDomainChange(clampDomain(mode, [c - ((b - a) / 2) * f, c + ((b - a) / 2) * f]));
      }
      return;
    }
    const dv = ((e.clientX - g.x) / plotW) * (b - a);
    onDomainChange(clampDomain(mode, [a - dv, b - dv]));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const [a, b] = domainRef.current;
    const step = (b - a) * 0.1;
    if (e.key === 'ArrowLeft') onDomainChange(clampDomain(mode, [a - step, b - step]));
    else if (e.key === 'ArrowRight') onDomainChange(clampDomain(mode, [a + step, b + step]));
    else if (e.key === '+' || e.key === '=') zoomAt(1 / 1.5);
    else if (e.key === '-' || e.key === '_') zoomAt(1.5);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={wrapRef}
      className="tl-chart"
      tabIndex={0}
      role="group"
      aria-label={tt.chartAria}
      aria-describedby="tl-help"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <clipPath id="tl-clip">
            <rect x={LEFT} y={0} width={plotW} height={height} />
          </clipPath>
        </defs>
        {CATEGORY_ORDER.map((c, i) => (
          <g key={c}>
            <rect x={0} y={AXIS_H + i * LANE_H} width={width} height={LANE_H} className={i % 2 ? 'tl-lane tl-lane--alt' : 'tl-lane'} />
            <text x={10} y={narrow ? AXIS_H + i * LANE_H + 12 : AXIS_H + i * LANE_H + LANE_H / 2 + 4} className={narrow ? 'tl-lane-label tl-lane-label--top' : 'tl-lane-label'} fill={TIMELINE_COLORS[c]}>
              {tt.categories[c]}
            </text>
          </g>
        ))}
        <g clipPath="url(#tl-clip)">
          {ticks.map((tk) => (
            <g key={`${tk.value}`}>
              <line x1={x(tk.value)} x2={x(tk.value)} y1={AXIS_H - 6} y2={height} className="tl-grid" />
              <text x={x(tk.value)} y={AXIS_H - 12} textAnchor="middle" className="tl-tick">
                {tk.label}
              </text>
            </g>
          ))}
          {placed.map(({ e, cx, lane, labelRow, labelX }) => {
            const cy = AXIS_H + lane * LANE_H + LANE_H / 2 + (narrow ? 5 : 0);
            const sel = e.id === selectedId;
            return (
              <g
                key={e.id}
                className={sel ? 'tl-event is-selected' : 'tl-event'}
                role="button"
                tabIndex={0}
                aria-label={`${e.title}: ${e.whenText}`}
                aria-pressed={sel}
                onClick={() => onSelect(e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onSelect(e.id);
                  }
                }}
              >
                <title>{`${e.title} — ${e.whenText}`}</title>
                <circle cx={cx} cy={cy} r={11} className="tl-hit" />
                {sel ? <circle cx={cx} cy={cy} r={9} className="tl-ring" /> : null}
                <circle cx={cx} cy={cy} r={5} fill={TIMELINE_COLORS[e.category]} className={e.kind === 'estimate' || e.kind === 'model' ? 'tl-dot tl-dot--soft' : 'tl-dot'} />
                {labelRow !== null ? (
                  <text
                    x={labelX}
                    y={labelRow === 0 ? cy - 9 : cy + 17}
                    className="tl-label"
                  >
                    {e.title.length > 26 ? `${e.title.slice(0, 25)}…` : e.title}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
