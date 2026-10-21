import { useMemo, useState } from 'react';
import { href } from '../../app/router';
import { LoadState } from '../../components/LoadState';
import { SourcesList } from '../../components/SourcesList';
import { useAsync } from '../../components/useAsync';
import { formatNumber } from '../../core/format';
import { constellationName } from '../../data/constellations';
import { useI18n } from '../../i18n';
import { DeepSkyGlyph } from './DeepSkyGlyph';
import { BEYOND, BEYOND_GROUPS, type BeyondObject } from './beyondMessier';
import { formatLightYears, loadDeepSky, type DeepSkyCategory, type DeepSkyObject } from './deepSkyData';
import { SkyMap } from './SkyMap';
import { SpaceTabs } from './SpaceTabs';

type Filter = DeepSkyCategory | 'all';
type Sort = 'm' | 'distance' | 'mag' | 'size';
type ViewMode = 'cards' | 'table';

const FEATURED = [31, 42, 45, 1, 16, 51, 104, 13, 57, 87];
const FEATURED_IDS = FEATURED.map((m) => `m${m}`);
// A SN 1987A e a Tarântula ficam dentro da Grande Nuvem: na vista geral, só esta tem etiqueta
const BEYOND_IDS = BEYOND.map((o) => o.id).filter((id) => id !== 'sn1987a' && id !== 'ngc2070');

export function sortDeepSky(list: readonly DeepSkyObject[], sort: Sort): DeepSkyObject[] {
  const val: Record<Sort, (o: DeepSkyObject) => number | undefined> = {
    m: (o) => o.m,
    distance: (o) => o.distanceLy,
    mag: (o) => o.mag,
    size: (o) => (o.majorArcmin === undefined ? undefined : -o.majorArcmin),
  };
  const get = val[sort];
  return [...list].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === undefined && y === undefined) return a.m - b.m;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return x - y || a.m - b.m;
  });
}

function Card({ o }: { o: DeepSkyObject }) {
  const { t } = useI18n();
  return (
    <a className="dso-card" href={href({ name: 'deep-sky-object', id: o.id })}>
      <DeepSkyGlyph subtype={o.subtype} size={44} />
      <span className="dso-card-text">
        <span className="dso-card-id">M{o.m}</span>
        <span className="dso-card-name">{o.namePt ?? t.space.subtypes[o.subtype]}</span>
        <span className="dso-card-meta">
          {o.namePt ? `${t.space.subtypes[o.subtype]} · ` : ''}
          {constellationName(o.constellation)}
        </span>
        <span className="dso-card-meta">{o.distanceLy ? formatLightYears(o.distanceLy) : t.space.noDistance}</span>
      </span>
    </a>
  );
}

function BeyondCard({ o }: { o: BeyondObject }) {
  const { t } = useI18n();
  return (
    <a className="dso-card" href={href({ name: 'deep-sky-object', id: o.id })}>
      <DeepSkyGlyph subtype={o.subtype} size={44} />
      <span className="dso-card-text">
        <span className="dso-card-id">{o.label}</span>
        <span className="dso-card-name">{o.namePt}</span>
        <span className="dso-card-meta">
          {t.space.subtypes[o.subtype]} · {constellationName(o.constellation)}
        </span>
        <span className="dso-card-meta">{o.distance ? `${o.distance.approx ? '≈ ' : ''}${formatLightYears(o.distance.ly)}` : t.space.noDistance}</span>
      </span>
    </a>
  );
}

/** Objetos fora do catálogo Messier: céu austral, remanescentes de supernovas e pulsares (dados no código, sem pedido à rede). */
function BeyondMessier() {
  const { t } = useI18n();
  const tb = t.beyond;
  return (
    <section className="body-section" aria-labelledby="dso-beyond">
      <h2 id="dso-beyond">{tb.title}</h2>
      <p className="section-lede">{tb.lede}</p>
      <h3 className="sb-subtitle">{tb.mapTitle}</h3>
      <SkyMap objects={BEYOND} labelled={BEYOND_IDS} ariaLabel={tb.mapAria} />
      <p className="section-note">{tb.mapNote}</p>
      {BEYOND_GROUPS.map((g) => (
        <div key={g.group} className="dso-beyond-group">
          <h3 className="sb-subtitle">{tb.groups[g.group]}</h3>
          <ul className="dso-grid">
            {g.ids.map((id) => {
              const o = BEYOND.find((x) => x.id === id)!;
              return (
                <li key={id}>
                  <BeyondCard o={o} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function CatalogTable({ list }: { list: DeepSkyObject[] }) {
  const { t } = useI18n();
  return (
    <div className="table-scroll">
      <table className="data-table exo-table">
        <thead>
          <tr>
            <th scope="col">{t.space.columns.m}</th>
            <th scope="col">{t.space.columns.name}</th>
            <th scope="col">{t.space.columns.type}</th>
            <th scope="col">{t.space.columns.con}</th>
            <th scope="col" className="num">
              {t.space.columns.mag}
            </th>
            <th scope="col" className="num">
              {t.space.columns.size}
            </th>
            <th scope="col" className="num">
              {t.space.columns.distance}
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.m}>
              <th scope="row">
                <a href={href({ name: 'deep-sky-object', id: o.id })}>M{o.m}</a>
              </th>
              <td>{o.namePt ?? '—'}</td>
              <td>{t.space.subtypes[o.subtype]}</td>
              <td>{constellationName(o.constellation)}</td>
              <td className="num">{o.mag !== undefined ? formatNumber(o.mag, 1) : '—'}</td>
              <td className="num">{o.majorArcmin !== undefined ? `${formatNumber(o.majorArcmin, o.majorArcmin < 10 ? 1 : 0)}′` : '—'}</td>
              <td className="num">{o.distanceLy ? formatLightYears(o.distanceLy).replace(' anos-luz', ' a.l.') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Atlas({ objects }: { objects: DeepSkyObject[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('m');
  const [mode, setMode] = useState<ViewMode>('cards');
  const filtered = useMemo(() => objects.filter((o) => filter === 'all' || o.category === filter), [objects, filter]);
  const list = useMemo(() => sortDeepSky(filtered, sort), [filtered, sort]);
  const featured = FEATURED.map((m) => objects.find((o) => o.m === m)).filter((o): o is DeepSkyObject => Boolean(o));

  const chips = (
    <div className="chips" role="radiogroup" aria-label={t.space.filterLabel}>
      {(['all', 'galaxy', 'nebula', 'cluster', 'other'] as const).map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={filter === f}
          className={filter === f ? 'chip is-active' : 'chip'}
          onClick={() => setFilter(f)}
        >
          {t.space.filters[f]}
          <span className="chip-count">{f === 'all' ? objects.length : objects.filter((o) => o.category === f).length}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <section className="body-section" aria-labelledby="dso-featured">
        <h2 id="dso-featured">{t.space.featuredTitle}</h2>
        <ul className="dso-featured">
          {featured.map((o) => (
            <li key={o.m}>
              <Card o={o} />
            </li>
          ))}
        </ul>
      </section>

      <section className="body-section" aria-labelledby="dso-map">
        <h2 id="dso-map">{t.space.skyMap.title}</h2>
        <p className="section-lede">{t.space.skyMap.intro}</p>
        <div className="catalog-controls">{chips}</div>
        <SkyMap objects={filtered} labelled={FEATURED_IDS} />
      </section>

      <section className="body-section" aria-labelledby="dso-all">
        <h2 id="dso-all">Catálogo Messier</h2>
        <div className="catalog-controls">
          {chips}
          <label className="field">
            <span>{t.space.sortLabel}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {(['m', 'distance', 'mag', 'size'] as const).map((k) => (
                <option key={k} value={k}>
                  {t.space.sorts[k]}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented" role="tablist" aria-label={t.space.viewLabel}>
            {(['cards', 'table'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'is-active' : undefined} onClick={() => setMode(m)}>
                {t.space.viewModes[m]}
              </button>
            ))}
          </div>
          <p className="catalog-count" aria-live="polite">
            {t.space.count(list.length)}
          </p>
        </div>
        {mode === 'cards' ? (
          <ul className="dso-grid">
            {list.map((o) => (
              <li key={o.m}>
                <Card o={o} />
              </li>
            ))}
          </ul>
        ) : (
          <CatalogTable list={list} />
        )}
      </section>
    </>
  );
}

export default function DeepSkyPage() {
  const { t } = useI18n();
  const { state, retry } = useAsync(loadDeepSky);
  return (
    <div className="page space-page">
      <header className="page-head">
        <h1 className="page-title">{t.space.deepTitle}</h1>
        <p className="page-lede">{t.space.deepLede}</p>
      </header>
      <SpaceTabs current="deep-sky" />
      <LoadState state={state} retry={retry} loading={t.space.loading} error={t.space.loadError} retryLabel={t.space.retry} />
      {state.status === 'ready' ? <Atlas objects={state.value} /> : null}
      <BeyondMessier />
      <section className="body-section" aria-labelledby="dso-sources">
        <h2 id="dso-sources">{t.body.sources}</h2>
        <SourcesList ids={['openngc', 'nasa-hubble-messier', 'cantat-gaudin-2020', 'nasa-hubble-caldwell']} showNotes />
        <p className="section-note">As fontes de cada objeto fora do catálogo Messier estão na respetiva ficha.</p>
        <p className="section-note">Os ícones indicam o tipo de objeto; não são imagens dos objetos. As fotografias estão em cada ficha.</p>
      </section>
    </div>
  );
}

