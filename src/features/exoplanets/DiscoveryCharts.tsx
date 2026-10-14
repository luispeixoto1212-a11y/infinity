import { useMemo, useState } from 'react';
import { formatNumber } from '../../core/format';
import { useElementSize } from '../../components/useElementSize';
import { useI18n } from '../../i18n';
import {
  DISCOVERY_METHODS,
  METHOD_GROUPS,
  countByMethod,
  discoveriesByYear,
  type Exoplanet,
  type MethodGroup,
  type YearBin,
} from './exoplanetData';

/** Ordem fixa das cores categóricas (validada para o fundo escuro da aplicação). */
export const GROUP_COLOR: Record<MethodGroup, string> = {
  transit: 'var(--series-1)',
  rv: 'var(--series-2)',
  microlensing: 'var(--series-3)',
  others: 'var(--series-4)',
};

// ------------------------------------------------------------------ métodos (barras horizontais)

export function MethodBars({ planets }: { planets: readonly Exoplanet[] }) {
  const { t } = useI18n();
  const counts = useMemo(() => countByMethod(planets), [planets]);
  const max = Math.max(...Object.values(counts));
  const total = planets.length;
  const rows = [...DISCOVERY_METHODS].sort((a, b) => counts[b] - counts[a]);
  return (
    <ul className="method-bars">
      {rows.map((m) => {
        const n = counts[m];
        const pct = (n / total) * 100;
        return (
          <li key={m}>
            <div className="method-bars-head">
              <span className="method-bars-name">{t.exo.methods[m]}</span>
              <span className="method-bars-value">
                <strong>{formatNumber(n, 0)}</strong>
                <span>{pct >= 1 ? `${formatNumber(pct, 0)} %` : `${formatNumber(pct, 1)} %`}</span>
              </span>
            </div>
            <div className="method-bars-track" aria-hidden="true">
              <span style={{ width: `${Math.max(0.6, (n / max) * 100)}%` }} />
            </div>
            <p className="method-bars-help">{t.exo.methodHelp[m]}</p>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------ descobertas por ano (colunas empilhadas)

function niceStep(max: number, ticks = 4): number {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Segmento com cantos arredondados só em cima (o topo da coluna). */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function YearChart({ planets, currentYear }: { planets: readonly Exoplanet[]; currentYear: number }) {
  const { t } = useI18n();
  const bins = useMemo(() => discoveriesByYear(planets), [planets]);
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const height = width < 560 ? 260 : 320;
  const m = { top: 28, right: 8, bottom: 30, left: 44 };
  const innerW = Math.max(0, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;
  const maxTotal = Math.max(1, ...bins.map((b) => b.total));
  const step = niceStep(maxTotal);
  const yMax = Math.ceil(maxTotal / step) * step;
  const band = bins.length ? innerW / bins.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => m.top + innerH - (v / yMax) * innerH;
  const peak = bins.reduce<YearBin | null>((best, b) => (!best || b.total > best.total ? b : best), null);
  const labelEvery = band < 14 ? 6 : band < 22 ? 4 : 2;
  const hovered = hover !== null ? bins[hover] : undefined;

  return (
    <div className="chart">
      <ul className="chart-legend" aria-label="Legenda">
        {METHOD_GROUPS.map((g) => (
          <li key={g}>
            <span className="chart-swatch" style={{ background: GROUP_COLOR[g] }} />
            {t.exo.groups[g]}
          </li>
        ))}
      </ul>
      <div ref={ref} className="chart-plot" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={`${t.exo.yearsTitle}: ${bins[0]?.year ?? ''}–${bins.at(-1)?.year ?? ''}`}>
            {Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step).map((v) => (
              <g key={v}>
                <line x1={m.left} x2={width - m.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'chart-baseline' : 'chart-grid'} />
                <text x={m.left - 8} y={y(v)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
                  {formatNumber(v, 0)}
                </text>
              </g>
            ))}
            {bins.map((b, i) => {
              const x = m.left + i * band + (band - barW) / 2;
              let acc = 0;
              const visible = METHOD_GROUPS.filter((g) => b.groups[g] > 0);
              const top = visible.at(-1);
              return (
                <g key={b.year} className={hover === i ? 'chart-col is-hover' : 'chart-col'}>
                  {visible.map((g) => {
                    const v = b.groups[g];
                    const y0 = y(acc);
                    acc += v;
                    const y1 = y(acc);
                    // 2 px de fundo entre segmentos (exceto na base)
                    const gap = acc - v > 0 ? 2 : 0;
                    const h = Math.max(0, y0 - y1 - gap);
                    if (h < 0.5) return null;
                    return g === top ? (
                      <path key={g} d={topRoundedRect(x, y1, barW, h, 4)} fill={GROUP_COLOR[g]} />
                    ) : (
                      <rect key={g} x={x} y={y1} width={barW} height={h} fill={GROUP_COLOR[g]} />
                    );
                  })}
                  {(i % labelEvery === 0 || i === bins.length - 1) && (
                    <text x={x + barW / 2} y={height - m.bottom + 18} className="chart-tick" textAnchor="middle">
                      {b.year}
                    </text>
                  )}
                  <rect
                    x={m.left + i * band}
                    y={m.top}
                    width={band}
                    height={innerH}
                    className="chart-hit"
                    tabIndex={0}
                    role="img"
                    aria-label={`${b.year}: ${b.total}`}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover((h) => (h === i ? null : h))}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover((h) => (h === i ? null : h))}
                  />
                </g>
              );
            })}
            {peak ? (
              <text
                x={m.left + bins.indexOf(peak) * band + band / 2}
                y={y(peak.total) - 8}
                className="chart-label"
                textAnchor="middle"
              >
                {formatNumber(peak.total, 0)}
              </text>
            ) : null}
          </svg>
        ) : null}
        {hovered && width > 0 ? (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(width - 170, Math.max(0, m.left + (hover ?? 0) * band + band / 2 - 85)),
              top: 4,
            }}
            role="status"
          >
            <div className="chart-tooltip-title">
              {hovered.year}
              {hovered.year === currentYear ? ` (${t.exo.yearsPartial(currentYear).replace('.', '')})` : ''}
            </div>
            <div className="chart-tooltip-row is-total">
              <strong>{formatNumber(hovered.total, 0)}</strong>
              <span>{t.exo.totalCol}</span>
            </div>
            {METHOD_GROUPS.map((g) => (
              <div key={g} className="chart-tooltip-row">
                <span className="chart-key" style={{ background: GROUP_COLOR[g] }} />
                <strong>{formatNumber(hovered.groups[g], 0)}</strong>
                <span>{t.exo.groups[g]}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <p className="section-note">{t.exo.yearsPartial(currentYear)}</p>
      <details className="chart-table">
        <summary>{t.exo.showTable}</summary>
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">{t.exo.yearCol}</th>
                {METHOD_GROUPS.map((g) => (
                  <th key={g} scope="col" className="num">
                    {t.exo.groups[g]}
                  </th>
                ))}
                <th scope="col" className="num">
                  {t.exo.totalCol}
                </th>
              </tr>
            </thead>
            <tbody>
              {bins.map((b) => (
                <tr key={b.year}>
                  <th scope="row">{b.year}</th>
                  {METHOD_GROUPS.map((g) => (
                    <td key={g} className="num">
                      {formatNumber(b.groups[g], 0)}
                    </td>
                  ))}
                  <td className="num">{formatNumber(b.total, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
