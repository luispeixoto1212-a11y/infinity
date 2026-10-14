import { useDeferredValue, useMemo, useState } from 'react';
import { href } from '../../app/router';
import { LoadState } from '../../components/LoadState';
import { SourcesList } from '../../components/SourcesList';
import { useAsync } from '../../components/useAsync';
import { formatNumber } from '../../core/format';
import { constellationName } from '../../data/constellations';
import { useI18n } from '../../i18n';
import { SpaceTabs } from '../deepsky/SpaceTabs';
import { HrDiagram } from './HrDiagram';
import { colorFromBv, lightYearsFromPc, loadHrDiagram, loadStars, type Star } from './starData';
import { filterStars, formatStarDistance, sortStars, type StarSort } from './starView';

const PAGE_SIZE = 50;

function StarDot({ s }: { s: Star }) {
  return <span className="star-dot" style={{ background: colorFromBv(s.colorIndex) }} aria-hidden="true" />;
}

function StarTable({ stars, rank }: { stars: Star[]; rank?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="table-scroll">
      <table className="data-table exo-table star-table">
        <thead>
          <tr>
            {rank ? (
              <th scope="col" className="num">
                #
              </th>
            ) : null}
            <th scope="col">{t.space.starColumns.name}</th>
            <th scope="col">{t.space.starColumns.con}</th>
            <th scope="col" className="num">
              {t.space.starColumns.mag}
            </th>
            <th scope="col" className="num">
              {t.space.starColumns.distance}
            </th>
            <th scope="col">{t.space.starColumns.spect}</th>
          </tr>
        </thead>
        <tbody>
          {stars.map((s, i) => (
            <tr key={s.id}>
              {rank ? <td className="num">{i + 1}</td> : null}
              <th scope="row">
                <a className="star-link" href={href({ name: 'star', slug: s.slug })}>
                  <StarDot s={s} />
                  <span>
                    {s.name}
                    {s.designation && s.designation !== s.name ? <span className="star-des">{s.designation}</span> : null}
                  </span>
                </a>
              </th>
              <td>{constellationName(s.constellation)}</td>
              <td className="num">{s.mag !== undefined ? formatNumber(s.mag, 2) : '—'}</td>
              <td className="num">{formatStarDistance(s)}</td>
              <td>{s.spectralType ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllStars({ stars }: { stars: Star[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<StarSort>('mag');
  const [page, setPage] = useState(0);
  const deferred = useDeferredValue(query);
  const list = useMemo(() => sortStars(filterStars(stars, deferred), sort, constellationName), [stars, deferred, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = list.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="body-section" aria-labelledby="stars-all">
      <h2 id="stars-all">{t.space.allStarsTitle}</h2>
      <div className="catalog-controls">
        <label className="field">
          <span>{t.space.searchStars}</span>
          <input
            type="search"
            value={query}
            placeholder={t.space.searchStarsPlaceholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="field">
          <span>{t.space.sortLabel}</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as StarSort);
              setPage(0);
            }}
          >
            {(['mag', 'distance', 'name', 'con'] as const).map((k) => (
              <option key={k} value={k}>
                {t.space.starSorts[k]}
              </option>
            ))}
          </select>
        </label>
        <p className="catalog-count" aria-live="polite">
          {t.space.starCount(list.length)}
        </p>
      </div>
      {list.length === 0 ? <p className="muted">{t.space.noStarResults}</p> : <StarTable stars={slice} />}
      {pages > 1 ? (
        <nav className="pager" aria-label={t.space.pagerLabel}>
          <button type="button" className="btn btn--ghost btn--small" disabled={current === 0} onClick={() => setPage(current - 1)}>
            ← {t.space.prevPage}
          </button>
          <span>{t.space.pageOf(current + 1, pages)}</span>
          <button type="button" className="btn btn--ghost btn--small" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            {t.space.nextPage} →
          </button>
        </nav>
      ) : null}
    </section>
  );
}

function Overview({ stars }: { stars: Star[] }) {
  const { t } = useI18n();
  const brightest = useMemo(() => sortStars(stars.filter((s) => s.hasProperName && s.mag !== undefined), 'mag', constellationName).slice(0, 15), [stars]);
  const nearest = useMemo(() => sortStars(stars.filter((s) => s.distPc !== undefined), 'distance', constellationName).slice(0, 15), [stars]);
  const named = stars.filter((s) => s.hasProperName).length;
  const nearestStar = nearest[0];
  const brightestStar = brightest[0];

  return (
    <>
      <dl className="stat-row">
        <div className="stat">
          <dt>{t.space.statStars}</dt>
          <dd>{formatNumber(stars.length, 0)}</dd>
        </div>
        <div className="stat">
          <dt>{t.space.statNamed}</dt>
          <dd>{formatNumber(named, 0)}</dd>
        </div>
        {nearestStar ? (
          <div className="stat">
            <dt>{t.space.statNearest}</dt>
            <dd>
              <a href={href({ name: 'star', slug: nearestStar.slug })}>{nearestStar.name}</a>
              <span className="stat-sub">{formatNumber(lightYearsFromPc(nearestStar.distPc!), 2)} anos-luz</span>
            </dd>
          </div>
        ) : null}
        {brightestStar ? (
          <div className="stat">
            <dt>{t.space.statBrightest}</dt>
            <dd>
              <a href={href({ name: 'star', slug: brightestStar.slug })}>{brightestStar.name}</a>
              <span className="stat-sub">
                {t.space.starColumns.mag} {formatNumber(brightestStar.mag!, 2)}
              </span>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="two-col">
        <section className="body-section" aria-labelledby="stars-brightest">
          <h2 id="stars-brightest">{t.space.brightestTitle}</h2>
          <p className="section-note">{t.space.brightestNote}</p>
          <StarTable stars={brightest} rank />
        </section>
        <section className="body-section" aria-labelledby="stars-nearest">
          <h2 id="stars-nearest">{t.space.nearestTitle}</h2>
          <p className="section-note">{t.space.nearestNote}</p>
          <StarTable stars={nearest} rank />
        </section>
      </div>
    </>
  );
}

function HrSection() {
  const { t } = useI18n();
  const { state, retry } = useAsync(loadHrDiagram);
  return (
    <section className="body-section" aria-labelledby="stars-hr">
      <h2 id="stars-hr">{t.space.hrTitle}</h2>
      <p className="section-lede">{t.space.hrIntro}</p>
      <LoadState state={state} retry={retry} loading={t.space.loading} error={t.space.loadError} retryLabel={t.space.retry} />
      {state.status === 'ready' ? <HrDiagram points={state.value} /> : null}
    </section>
  );
}

export default function StarsPage() {
  const { t } = useI18n();
  const { state, retry } = useAsync(loadStars);
  return (
    <div className="page space-page">
      <header className="page-head">
        <h1 className="page-title">{t.space.starsTitle}</h1>
        <p className="page-lede">{t.space.starsLede}</p>
      </header>
      <SpaceTabs current="stars" />
      <LoadState state={state} retry={retry} loading={t.space.loading} error={t.space.loadError} retryLabel={t.space.retry} />
      {state.status === 'ready' ? <Overview stars={state.value} /> : null}
      <HrSection />
      {state.status === 'ready' ? <AllStars stars={state.value} /> : null}
      <section className="body-section" aria-labelledby="stars-sources">
        <h2 id="stars-sources">{t.body.sources}</h2>
        <SourcesList ids={['athyg']} showNotes />
        <p className="section-note">{t.space.starsLicenseNote}</p>
      </section>
    </div>
  );
}
