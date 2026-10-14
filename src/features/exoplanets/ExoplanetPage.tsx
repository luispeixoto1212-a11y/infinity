import { useEffect } from 'react';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { SourcesList } from '../../components/SourcesList';
import { formatNumber, formatSignificant } from '../../core/format';
import { FactRows, type FactRow } from '../../components/FactRows';
import { useI18n } from '../../i18n';
import { earthSym, formatDistanceLy, formatPeriod } from './CatalogTable';
import {
  EARTH_MASSES_PER_JUPITER,
  EARTH_RADII_PER_JUPITER,
  insolation,
  lightYears,
  massEarth,
  radiusEarth,
  semiMajorAxis,
  sizeClass,
  snapshotDate,
  stellarLuminosity,
  type Exoplanet,
  type ExoplanetCatalog,
} from './exoplanetData';
import { findFeatured } from './featured';
import { OrbitView } from './OrbitView';
import { PeriodRadiusPlot } from './PeriodRadiusPlot';
import { useExoplanets } from './useExoplanets';

function plusMinus(err: number | undefined, factor: number): string {
  return err ? ` ± ${formatSignificant(err * factor, 2)}` : '';
}

function planetRows(p: Exoplanet, t: ReturnType<typeof useI18n>['t']): FactRow[] {
  const rows: Omit<FactRow, 'source'>[] = [];
  const me = massEarth(p);
  if (me !== undefined) {
    rows.push({
      label: t.exo.facts.mass,
      value: `${p.massMeasured ? '' : '≈ '}${formatSignificant(me, 3)}${p.massMeasured ? plusMinus(p.massErrJ, EARTH_MASSES_PER_JUPITER) : ''} M⊕`,
      secondary: `${formatSignificant(p.massJ!, 3)} ${t.exo.jupiterMasses}`,
      kind: p.massMeasured ? 'measured' : 'estimate',
      note: p.massMeasured ? (p.method === 'rv' && !p.radiusMeasured ? t.exo.notes.massMinimum : undefined) : t.exo.notes.massEstimate,
    });
  }
  const re = radiusEarth(p);
  if (re !== undefined) {
    rows.push({
      label: t.exo.facts.radius,
      value: `${p.radiusMeasured ? '' : '≈ '}${formatSignificant(re, 3)}${p.radiusMeasured ? plusMinus(p.radiusErrJ, EARTH_RADII_PER_JUPITER) : ''} R⊕`,
      secondary: `${formatSignificant(p.radiusJ!, 3)} ${t.exo.jupiterRadii}`,
      kind: p.radiusMeasured ? 'measured' : 'estimate',
      note: p.radiusMeasured ? t.exo.notes.radiusMeasured : p.method === 'imaging' ? t.exo.notes.radiusImaging : t.exo.notes.radiusEstimate,
    });
  }
  if (p.period) {
    rows.push({
      label: t.exo.facts.period,
      value: formatPeriod(p.period),
      secondary: p.period >= 1 && p.period < 730 ? undefined : `${formatSignificant(p.period, 4)} dias`,
      kind: 'measured',
    });
  }
  const a = semiMajorAxis(p);
  if (a) {
    rows.push({
      label: t.exo.facts.a,
      value: `${a.derived ? '≈ ' : ''}${formatSignificant(a.value, 3)} UA`,
      secondary: `${formatNumber(a.value * 149.6, a.value < 1 ? 1 : 0)} milhões de km`,
      kind: a.derived ? 'derived' : 'measured',
      note: a.derived ? t.exo.notes.aDerived : undefined,
    });
  }
  if (p.e !== undefined) rows.push({ label: t.exo.facts.e, value: formatSignificant(p.e, 2), kind: 'measured' });
  const flux = insolation(p);
  if (flux !== undefined) {
    rows.push({ label: t.exo.facts.flux, value: t.exo.times(formatSignificant(flux, 2)), kind: 'derived', note: t.exo.notes.flux });
  }
  if (p.teq !== undefined) {
    rows.push({
      label: t.exo.facts.teq,
      value: `${formatNumber(p.teq, 0)} K`,
      secondary: `≈ ${formatNumber(p.teq - 273.15, 0)} °C`,
      kind: 'estimate',
      note: t.exo.notes.teq,
    });
  }
  if (p.distPc !== undefined) {
    rows.push({
      label: t.exo.facts.distance,
      value: `${formatSignificant(lightYears(p.distPc), 4)} ${t.exo.lightYears}`,
      secondary: `${formatSignificant(p.distPc, 4)} parsecs`,
      kind: 'measured',
      note: t.exo.notes.distance,
    });
  }
  return withSource(rows, t);
}

function starRows(p: Exoplanet, t: ReturnType<typeof useI18n>['t']): FactRow[] {
  const s = p.star;
  const rows: Omit<FactRow, 'source'>[] = [];
  if (s.spectralType) rows.push({ label: t.exo.star.spectralType, value: s.spectralType, kind: 'measured' });
  if (s.teff) rows.push({ label: t.exo.star.teff, value: `${formatNumber(s.teff, 0)} K`, kind: 'measured' });
  if (s.radius) rows.push({ label: t.exo.star.radius, value: `${formatSignificant(s.radius, 3)} ${t.exo.star.solarRadii}`, kind: 'measured' });
  if (s.mass) rows.push({ label: t.exo.star.mass, value: `${formatSignificant(s.mass, 3)} ${t.exo.star.solarMasses}`, kind: 'measured' });
  const L = stellarLuminosity(s);
  if (L) rows.push({ label: t.exo.star.luminosity, value: `${formatSignificant(L, 2)} ${t.exo.star.solarLum}`, kind: 'derived', note: t.exo.star.lumNote });
  if (s.vmag !== undefined) rows.push({ label: t.exo.star.vmag, value: formatNumber(s.vmag, 2), kind: 'measured', note: t.exo.star.vmagNote });
  return withSource(rows, t);
}

/** Valores calculados indicam a aplicação; os restantes, o NASA Exoplanet Archive (com o símbolo ⊕ ajustado). */
function withSource(rows: Omit<FactRow, 'source'>[], t: ReturnType<typeof useI18n>['t']): FactRow[] {
  return rows.map((r) => ({
    ...r,
    value: typeof r.value === 'string' ? earthSym(r.value) : r.value,
    source: r.kind === 'derived' ? 'Calculado nesta aplicação' : t.exo.sourceRow,
  }));
}

function SizeCompare({ planet }: { planet: Exoplanet }) {
  const { t } = useI18n();
  const r = radiusEarth(planet);
  if (r === undefined) return null;
  const items = [
    { label: 'Terra', r: 1, color: '#6ea8ff' },
    { label: planet.name, r, color: '#e9edf8' },
    { label: 'Júpiter', r: EARTH_RADII_PER_JUPITER, color: '#d9b38c' },
  ].sort((a, b) => a.r - b.r);
  const maxR = Math.max(...items.map((i) => i.r));
  const px = 70 / maxR;
  const gap = 24;
  // Cada item ocupa o maior entre o diâmetro e a largura aproximada da etiqueta
  let x = 4;
  const placed = items.map((i) => {
    const rad = Math.max(1.2, i.r * px);
    const slot = Math.max(rad * 2, i.label.length * 6.6, 48);
    const cx = x + slot / 2;
    x += slot + gap;
    return { ...i, rad, cx };
  });
  const w = x - gap + 4;
  return (
    <figure className="size-compare">
      <svg viewBox={`0 0 ${w} 190`} width="100%" style={{ maxWidth: w * 1.4 }} role="img" aria-label={`${t.exo.sizeTitle}: ${placed.map((p) => `${p.label} ${formatSignificant(p.r, 3)} R⊕`).join(', ')}`}>
        {placed.map((p) => (
          <g key={p.label}>
            <circle cx={p.cx} cy={150 - p.rad} r={p.rad} fill={p.color} opacity={p.label === planet.name ? 1 : 0.85} />
            <text x={p.cx} y={172} textAnchor="middle" className="size-label">
              {p.label}
            </text>
            <text x={p.cx} y={186} textAnchor="middle" className="size-sub">
              {formatSignificant(p.r, 3)} R<tspan className="earth-sym">⊕</tspan>
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="section-note">
        {t.exo.sizeNote} {planet.radiusMeasured ? '' : t.exo.sizeEstimate}
      </figcaption>
    </figure>
  );
}

function ExoplanetView({ planet, catalog }: { planet: Exoplanet; catalog: ExoplanetCatalog }) {
  const { t } = useI18n();
  const featured = findFeatured(planet.name);
  const system = catalog.byHost.get(planet.host) ?? [planet];
  const r = radiusEarth(planet);
  const title = featured?.displayName ?? planet.name;

  useEffect(() => {
    document.title = `${title} — ${t.exo.title} — Universe Infinity`;
  }, [title, t]);

  return (
    <article className="exo-detail">
      <header className="exo-hero">
        <div className="exo-hero-text">
          <a className="back-link" href={href({ name: 'exoplanets' })}>
            <Icon name="back" size={16} />
            {t.exo.back}
          </a>
          <p className="body-kicker">
            {t.categories.exoplanet}
            {r !== undefined ? ` · ${t.exo.sizeClasses[sizeClass(r)]}${planet.radiusMeasured ? '' : ' (estimado)'}` : ''}
          </p>
          <h1 className="body-name">{title}</h1>
          {featured?.displayName ? <p className="exo-alt">{planet.name}</p> : null}
          <p className="body-tagline">
            {t.exo.orbits(planet.host)}
            {planet.year ? `, ${t.exo.discoveredIn(planet.year, t.exo.methods[planet.method])}` : ''}.{' '}
            {planet.distPc !== undefined ? `${formatDistanceLy(planet.distPc).replace('a.l.', t.exo.lightYears)} do Sistema Solar.` : ''}
          </p>
          {featured ? <p className="exo-summary">{featured.summary}</p> : null}
          {planet.altNames.length ? <p className="section-note">Outras designações: {planet.altNames.join(', ')}</p> : null}
        </div>
        <div className="exo-hero-orbit">
          <OrbitView planets={system} star={planet.star} highlight={planet} />
        </div>
      </header>

      <div className="body-content">
        <div className="body-main">
          <section className="body-section" aria-labelledby="exo-facts">
            <h2 id="exo-facts">{t.body.keyFacts}</h2>
            <FactRows rows={planetRows(planet, t)} />
          </section>

          <section className="body-section" aria-labelledby="exo-size">
            <h2 id="exo-size">{t.exo.sizeTitle}</h2>
            <SizeCompare planet={planet} />
          </section>

          {planet.radiusMeasured && planet.period ? (
            <section className="body-section" aria-labelledby="exo-context">
              <h2 id="exo-context">{t.exo.scatterTitle}</h2>
              <PeriodRadiusPlot planets={catalog.planets} highlight={planet} compact />
            </section>
          ) : null}

          <section className="body-section" aria-labelledby="exo-star">
            <h2 id="exo-star">{t.exo.starTitle(planet.host)}</h2>
            <FactRows rows={starRows(planet, t)} />
          </section>
        </div>

        <aside className="body-aside">
          <section className="body-section" aria-labelledby="exo-system">
            <h2 id="exo-system">{t.exo.systemTitle}</h2>
            <p className="section-note">{t.exo.systemCount(system.length)}</p>
            <ol className="system-list">
              {system.map((p) => {
                const a = semiMajorAxis(p);
                return (
                  <li key={p.slug} className={p === planet ? 'is-current' : undefined}>
                    {p === planet ? (
                      <span aria-current="page">{p.name}</span>
                    ) : (
                      <a href={href({ name: 'exoplanet', slug: p.slug })}>{p.name}</a>
                    )}
                    <span className="system-list-meta">
                      {a ? `${formatSignificant(a.value, 3)} UA` : ''}
                      {p.period ? ` · ${formatPeriod(p.period)}` : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="body-section" aria-labelledby="exo-discovery">
            <h2 id="exo-discovery">{t.exo.discoveryTitle}</h2>
            <dl className="mini-facts">
              <div>
                <dt>{t.exo.discovery.method}</dt>
                <dd>{t.exo.methods[planet.method]}</dd>
              </div>
              {planet.year ? (
                <div>
                  <dt>{t.exo.discovery.year}</dt>
                  <dd>{planet.year}</dd>
                </div>
              ) : null}
              {planet.discoveryRef ? (
                <div>
                  <dt>{t.exo.discovery.reference}</dt>
                  <dd>{planet.discoveryRef}</dd>
                </div>
              ) : null}
              {planet.facility ? (
                <div>
                  <dt>{t.exo.discovery.facility}</dt>
                  <dd>{planet.facility === 'ground' ? t.exo.discovery.ground : planet.facility}</dd>
                </div>
              ) : null}
            </dl>
            <p className="section-note">{t.exo.methodHelp[planet.method]}</p>
          </section>

          <section className="body-section" aria-labelledby="exo-sources">
            <h2 id="exo-sources">{t.body.sources}</h2>
            <SourcesList ids={['nasa-exoplanet-archive', ...(featured?.sources ?? []), 'oec']} />
            <p className="section-note">Dados na versão de {snapshotDate(catalog.snapshot)}.</p>
          </section>
        </aside>
      </div>
    </article>
  );
}

export default function ExoplanetPage({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { state, retry } = useExoplanets();

  if (state.status === 'loading') {
    return (
      <div className="page-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        <span>{t.exo.loading}</span>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="page page--narrow">
        <div className="notice-box" role="alert">
          <p>{t.exo.loadError}</p>
          <button type="button" className="btn btn--small" onClick={retry}>
            {t.exo.retry}
          </button>
        </div>
      </div>
    );
  }
  const planet = state.catalog.bySlug.get(slug);
  if (!planet) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t.notFound.title}</h1>
        <p>{t.exo.notFound}</p>
        <a className="btn" href={href({ name: 'exoplanets' })}>
          {t.exo.title}
        </a>
      </div>
    );
  }
  return <ExoplanetView planet={planet} catalog={state.catalog} />;
}
