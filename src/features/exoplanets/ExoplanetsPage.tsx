import { useMemo } from 'react';
import { href } from '../../app/router';
import { formatNumber } from '../../core/format';
import { SourcesList } from '../../components/SourcesList';
import { useI18n } from '../../i18n';
import { CatalogTable, earthSym, formatDistanceLy, formatRadiusEarth } from './CatalogTable';
import { MethodBars, YearChart } from './DiscoveryCharts';
import { countSystems, radiusEarth, sizeClass, snapshotDate, type ExoplanetCatalog } from './exoplanetData';
import { FEATURED_EXOPLANETS, findFeatured } from './featured';
import { PeriodRadiusPlot } from './PeriodRadiusPlot';
import { useExoplanets } from './useExoplanets';

function Stats({ catalog }: { catalog: ExoplanetCatalog }) {
  const { t } = useI18n();
  const { planets, byHost } = catalog;
  const multi = [...byHost.values()].filter((l) => l.length > 1).length;
  const nearest = planets.reduce((best, p) => (p.distPc !== undefined && (!best || p.distPc < (best.distPc ?? Infinity)) ? p : best), planets[0]!);
  return (
    <dl className="stat-row">
      <div className="stat">
        <dt>{t.exo.stats.planets}</dt>
        <dd>{formatNumber(planets.length, 0)}</dd>
      </div>
      <div className="stat">
        <dt>{t.exo.stats.systems}</dt>
        <dd>{formatNumber(countSystems(planets), 0)}</dd>
      </div>
      <div className="stat">
        <dt>{t.exo.stats.multi}</dt>
        <dd>{formatNumber(multi, 0)}</dd>
      </div>
      <div className="stat">
        <dt>{t.exo.stats.nearest}</dt>
        <dd>
          <a href={href({ name: 'exoplanet', slug: nearest.slug })}>{findFeatured(nearest.name)?.displayName ?? nearest.name}</a>
          <span className="stat-sub">{formatDistanceLy(nearest.distPc)}</span>
        </dd>
      </div>
    </dl>
  );
}

function Featured({ catalog }: { catalog: ExoplanetCatalog }) {
  const { t } = useI18n();
  const byName = new Map(catalog.planets.map((p) => [p.name, p]));
  return (
    <ul className="featured-grid">
      {FEATURED_EXOPLANETS.map((f) => {
        const p = byName.get(f.name);
        if (!p) return null;
        const r = radiusEarth(p);
        return (
          <li key={f.name}>
            <a className="featured-card" href={href({ name: 'exoplanet', slug: p.slug })}>
              <span className="featured-name">{f.displayName ?? p.name}</span>
              <span className="featured-meta">
                {formatDistanceLy(p.distPc)} · {p.year} · {t.exo.methods[p.method]}
              </span>
              <span className="featured-summary">{f.summary}</span>
              <span className="featured-tags">
                {r !== undefined ? (
                  <span className="tag">
                    {t.exo.sizeClasses[sizeClass(r)]}
                    {p.radiusMeasured ? '' : ' (estimado)'}
                  </span>
                ) : null}
                <span className="tag">{earthSym(formatRadiusEarth(p))}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default function ExoplanetsPage() {
  const { t } = useI18n();
  const { state, retry } = useExoplanets();
  const catalog = state.status === 'ready' ? state.catalog : null;
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="page exo-page">
      <header className="page-head">
        <h1 className="page-title">{t.exo.title}</h1>
        <p className="page-lede">{t.exo.lede(catalog ? snapshotDate(catalog.snapshot) : '…')}</p>
      </header>

      {state.status === 'loading' ? (
        <div className="page-loading page-loading--inline" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>{t.exo.loading}</span>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className="notice-box" role="alert">
          <p>{t.exo.loadError}</p>
          <button type="button" className="btn btn--small" onClick={retry}>
            {t.exo.retry}
          </button>
        </div>
      ) : null}

      {catalog ? (
        <>
          <Stats catalog={catalog} />

          <section className="body-section" aria-labelledby="exo-methods">
            <h2 id="exo-methods">{t.exo.methodsTitle}</h2>
            <p className="section-lede">{t.exo.methodsIntro}</p>
            <MethodBars planets={catalog.planets} />
          </section>

          <section className="body-section" aria-labelledby="exo-years">
            <h2 id="exo-years">{t.exo.yearsTitle}</h2>
            <p className="section-lede">{t.exo.yearsIntro}</p>
            <YearChart planets={catalog.planets} currentYear={currentYear} />
          </section>

          <section className="body-section" aria-labelledby="exo-scatter">
            <h2 id="exo-scatter">{t.exo.scatterTitle}</h2>
            <p className="section-lede">{t.exo.scatterIntro}</p>
            <PeriodRadiusPlot planets={catalog.planets} />
          </section>

          <section className="body-section" aria-labelledby="exo-featured">
            <h2 id="exo-featured">{t.exo.featuredTitle}</h2>
            <Featured catalog={catalog} />
          </section>

          <section className="body-section" id="catalogo" aria-labelledby="exo-catalog">
            <h2 id="exo-catalog">{t.exo.catalogTitle}</h2>
            <p className="section-lede">{t.exo.catalogIntro}</p>
            <CatalogTable planets={catalog.planets} />
          </section>

          <section className="body-section" aria-labelledby="exo-sources">
            <h2 id="exo-sources">{t.body.sources}</h2>
            <SourcesList ids={['nasa-exoplanet-archive', 'oec', 'nasa-exoplanets']} showNotes />
          </section>
        </>
      ) : null}
    </div>
  );
}
