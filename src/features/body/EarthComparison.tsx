import { formatNumber } from '../../core/format';
import { getBody, numericFact } from '../../data/catalog';
import type { CelestialBody, FactKey } from '../../data/types';
import { useI18n } from '../../i18n';

const ROWS: Array<{ key: FactKey; abs?: boolean }> = [
  { key: 'diameter' },
  { key: 'mass' },
  { key: 'gravity' },
  { key: 'density' },
  { key: 'orbitalPeriod' },
  { key: 'siderealRotation', abs: true },
  { key: 'meanDistanceSun' },
];

export interface ComparisonRow {
  key: FactKey;
  body: number;
  earth: number;
  ratio: number;
}

export function comparisonRows(body: CelestialBody, earth: CelestialBody): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  for (const r of ROWS) {
    // O período orbital de uma lua é em torno do seu planeta: não é comparável com o ano terrestre.
    if (body.type === 'moon' && r.key === 'orbitalPeriod') continue;
    let a = numericFact(body, r.key);
    let b = numericFact(earth, r.key);
    if (a === undefined || b === undefined || b === 0) continue;
    if (r.abs) {
      a = Math.abs(a);
      b = Math.abs(b);
    }
    rows.push({ key: r.key, body: a, earth: b, ratio: a / b });
  }
  return rows;
}

/** Largura das barras: linear quando a diferença é pequena; logarítmica quando é grande. */
export function barWidths(ratio: number): { body: number; earth: number; log: boolean } {
  if (ratio >= 1 / 12 && ratio <= 12) {
    const max = Math.max(1, ratio);
    return { body: ratio / max, earth: 1 / max, log: false };
  }
  // Escala log: 1 década = largura fixa, com mínimo visível
  const decades = Math.log10(ratio);
  const span = Math.max(1, Math.ceil(Math.abs(decades)));
  if (ratio > 1) return { body: 1, earth: Math.max(0.04, 1 - Math.abs(decades) / (span + 0.5)), log: true };
  return { body: Math.max(0.04, 1 - Math.abs(decades) / (span + 0.5)), earth: 1, log: true };
}

function formatRatio(r: number): string {
  if (r >= 100) return formatNumber(r, 0);
  if (r >= 10) return formatNumber(r, 1);
  if (r >= 0.01) return formatNumber(r, 2);
  return r.toExponential(1).replace('.', ',');
}

export function EarthComparison({ body }: { body: CelestialBody }) {
  const { t } = useI18n();
  if (body.id === 'earth') return null;
  const earth = getBody('earth');
  const rows = comparisonRows(body, earth);
  if (rows.length === 0) return null;
  const anyLog = rows.some((r) => barWidths(r.ratio).log);

  return (
    <section className="body-section" aria-labelledby="compare-title">
      <h2 id="compare-title">{t.body.comparison}</h2>
      <div className="compare-legend" aria-hidden="true">
        <span className="swatch swatch--body" style={{ background: body.render.accent }} /> {body.name['pt-PT']}
        <span className="swatch swatch--earth" /> Terra
      </div>
      <dl className="compare">
        {rows.map((r) => {
          const w = barWidths(r.ratio);
          return (
            <div key={r.key} className="compare-row">
              <dt>{t.facts[r.key]}</dt>
              <dd>
                <span className="compare-bars" aria-hidden="true">
                  <span className="bar bar--body" style={{ width: `${w.body * 100}%`, background: body.render.accent }} />
                  <span className="bar bar--earth" style={{ width: `${w.earth * 100}%` }} />
                </span>
                <span className="compare-ratio">
                  {t.body.times(formatRatio(r.ratio))}
                  {w.log ? <span className="log-tag"> (escala log.)</span> : null}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="section-note">
        {anyLog ? t.body.comparisonNote : 'Valores da NASA; barras à mesma escala em cada linha.'}
      </p>
    </section>
  );
}
