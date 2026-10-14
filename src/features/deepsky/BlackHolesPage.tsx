import { useEffect } from 'react';
import { SourcesList } from '../../components/SourcesList';
import { formatNumber } from '../../core/format';
import type { SourceId } from '../../data/sources';
import { useI18n } from '../../i18n';
import { formatLightYears } from './deepSkyData';
import { BLACK_HOLES, SIZE_REFERENCES, schwarzschildRadiusKm, type BlackHole } from './blackHoles';
import { SpaceTabs } from './SpaceTabs';

const AU_KM = 149_597_870.7;

/** Raio do horizonte em km ou UA, conforme a grandeza. */
export function formatHorizon(km: number): string {
  // Dois algarismos significativos, como as massas de que o raio é calculado
  const round2 = (v: number) => Number(v.toPrecision(2));
  if (km >= 0.05 * AU_KM) return `${formatNumber(round2(km / AU_KM), 2)} UA`;
  if (km >= 1e6) return `${formatNumber(round2(km / 1e6), 1)} milhões de km`;
  return `${formatNumber(round2(km), 0)} km`;
}

function BlackHoleCard({ bh }: { bh: BlackHole }) {
  const { t } = useI18n();
  const rs = bh.massSun !== undefined ? schwarzschildRadiusKm(bh.massSun) : undefined;
  return (
    <article className={`bh-card bh-card--${bh.kind}`} aria-labelledby={`bh-${bh.id}`}>
      <p className="bh-kind">{t.space.bhKinds[bh.kind]}</p>
      <h3 id={`bh-${bh.id}`} className="bh-name">
        {bh.name}
      </h3>
      <p className="bh-summary">{bh.summary}</p>
      <dl className="mini-facts">
        <div>
          <dt>{t.space.bhMass}</dt>
          <dd>{bh.massText ?? t.space.bhMassUnknown}</dd>
        </div>
        <div>
          <dt>{t.space.bhDistance}</dt>
          <dd>{bh.distanceText}</dd>
        </div>
        <div>
          <dt>{t.space.bhWhere}</dt>
          <dd>{bh.where}</dd>
        </div>
        {rs !== undefined ? (
          <div>
            <dt>{t.space.bhHorizon}</dt>
            <dd>≈ {formatHorizon(rs)}</dd>
          </div>
        ) : null}
      </dl>
      {bh.facts.length > 0 ? (
        <ul className="bh-facts">
          {bh.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

const LOG_MIN = 1; // 10 km
const LOG_MAX = 11; // 10^11 km

/** Escala logarítmica dos horizontes, com referências conhecidas. */
function HorizonScale() {
  const { t } = useI18n();
  const items = BLACK_HOLES.filter((b) => b.massSun !== undefined).map((b) => ({ label: b.name, km: schwarzschildRadiusKm(b.massSun!) }));
  const W = 760;
  const left = 34;
  const right = 34;
  const AXIS = 132;
  const x = (km: number) => left + ((Math.log10(km) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (W - left - right);
  const sorted = [...items].sort((a, b) => a.km - b.km);
  const TIERS = [96, 68, 40];
  return (
    <figure className="bh-scale">
      <svg viewBox={`0 0 ${W} 236`} role="img" aria-label={t.space.bhSizesAria(sorted.map((s) => `${s.label}: ${formatHorizon(s.km)}`).join('; '))}>
        <line x1={left} x2={W - right} y1={AXIS} y2={AXIS} className="bh-axis" />
        {Array.from({ length: LOG_MAX - LOG_MIN + 1 }, (_, i) => LOG_MIN + i).map((p) => (
          <g key={p}>
            <line x1={x(10 ** p)} x2={x(10 ** p)} y1={AXIS - 6} y2={AXIS + 6} className="bh-tick" />
            <text x={x(10 ** p)} y={AXIS + 22} textAnchor="middle" className="bh-tick-label">
              10{String(p).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!)} km
            </text>
          </g>
        ))}
        {SIZE_REFERENCES.map((r, i) => (
          <g key={r.label}>
            <line x1={x(r.km)} x2={x(r.km)} y1={AXIS + 30} y2={AXIS + 42 + (i % 2) * 20} className="bh-ref-tick" />
            <text x={x(r.km)} y={AXIS + 58 + (i % 2) * 20} textAnchor="middle" className="bh-ref-label">
              {r.label}
            </text>
          </g>
        ))}
        {sorted.map((s, i) => {
          const ty = TIERS[i % TIERS.length]!;
          return (
            <g key={s.label}>
              <line x1={x(s.km)} x2={x(s.km)} y1={AXIS - 6} y2={ty + 6} className="bh-leader" />
              <circle cx={x(s.km)} cy={AXIS} r={5} className="bh-dot" />
              <text x={x(s.km)} y={ty} textAnchor="middle" className="bh-label">
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="section-note">{t.space.bhSizesIntro}</figcaption>
    </figure>
  );
}

export default function BlackHolesPage() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = `${t.space.bhTitle} — Universe Infinity`;
  }, [t]);
  const sources = Array.from(new Set(BLACK_HOLES.flatMap((b) => b.sources))) as SourceId[];
  return (
    <div className="page space-page">
      <header className="page-head">
        <h1 className="page-title">{t.space.bhTitle}</h1>
        <p className="page-lede">{t.space.bhLede}</p>
      </header>
      <SpaceTabs current="black-holes" />

      <section className="body-section" aria-labelledby="bh-types">
        <h2 id="bh-types">{t.space.bhTypesTitle}</h2>
        <dl className="bh-types">
          {t.space.bhTypes.map(([name, text]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="body-section" aria-labelledby="bh-list">
        <h2 id="bh-list">{t.space.bhListTitle}</h2>
        <div className="bh-grid">
          {BLACK_HOLES.map((bh) => (
            <BlackHoleCard key={bh.id} bh={bh} />
          ))}
        </div>
      </section>

      <section className="body-section" aria-labelledby="bh-sizes">
        <h2 id="bh-sizes">{t.space.bhSizesTitle}</h2>
        <div className="table-scroll">
          <HorizonScale />
        </div>
        <p className="section-note">
          {t.space.bhDistanceNote(formatLightYears(BLACK_HOLES.reduce((m, b) => Math.min(m, b.distanceLy), Infinity)))}
        </p>
      </section>

      <section className="body-section" aria-labelledby="bh-sources">
        <h2 id="bh-sources">{t.body.sources}</h2>
        <SourcesList ids={sources} showNotes />
      </section>
    </div>
  );
}
