import { Fragment, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { href } from '../../app/router';
import { formatNumber, formatSignificant } from '../../core/format';
import { useI18n } from '../../i18n';
import {
  DISCOVERY_METHODS,
  lightYears,
  massEarth,
  queryCatalog,
  radiusEarth,
  type CatalogQuery,
  type DiscoveryMethod,
  type Exoplanet,
  type SortKey,
} from './exoplanetData';

const PAGE_SIZE = 50;

/** O símbolo ⊕ não existe na fonte da interface: é mostrado num tamanho ajustado. */
export function earthSym(text: string): ReactNode {
  const parts = text.split('⊕');
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <span className="earth-sym">⊕</span> : null}
    </Fragment>
  ));
}

export function formatPeriod(days: number): string {
  if (days < 1) return `${formatSignificant(days * 24, 3)} h`;
  if (days < 730) return `${formatSignificant(days, 3)} d`;
  return `${formatSignificant(days / 365.25, 3)} anos`;
}

export function formatRadiusEarth(p: Exoplanet): string {
  const r = radiusEarth(p);
  if (r === undefined) return '—';
  return `${p.radiusMeasured ? '' : '≈ '}${formatSignificant(r, 3)} R⊕`;
}

export function formatMassEarth(p: Exoplanet): string {
  const m = massEarth(p);
  if (m === undefined) return '—';
  return `${p.massMeasured ? '' : '≈ '}${formatSignificant(m, 3)} M⊕`;
}

export function formatDistanceLy(pc?: number): string {
  if (pc === undefined) return '—';
  const ly = lightYears(pc);
  return `${ly < 100 ? formatNumber(ly, 1) : formatNumber(ly, 0)} a.l.`;
}

export function CatalogTable({ planets }: { planets: readonly Exoplanet[] }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [method, setMethod] = useState<DiscoveryMethod | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('distance');
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(0);
  const deferredText = useDeferredValue(text);

  const rows = useMemo(() => {
    const query: CatalogQuery = { text: deferredText, method, sort, descending };
    return queryCatalog(planets, query);
  }, [planets, deferredText, method, sort, descending]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const setSortKey = (key: SortKey) => {
    if (key === sort) setDescending((d) => !d);
    else {
      setSort(key);
      // Ano e tamanhos começam pelos maiores; nome e distância pelos menores
      setDescending(key === 'year' || key === 'radius' || key === 'mass');
    }
    setPage(0);
  };

  const header = (key: SortKey, label: string, numeric = false) => (
    <th scope="col" className={numeric ? 'num' : undefined} aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="sort-btn" onClick={() => setSortKey(key)} aria-label={t.exo.sortBy(label.toLowerCase())}>
        {label}
        <span aria-hidden="true" className="sort-mark">
          {sort === key ? (descending ? '↓' : '↑') : ''}
        </span>
      </button>
    </th>
  );

  return (
    <div className="exo-catalog">
      <div className="catalog-controls">
        <label className="field">
          <span>{t.exo.searchLabel}</span>
          <input
            type="search"
            value={text}
            placeholder={t.exo.searchPlaceholder}
            onChange={(e) => {
              setText(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="field">
          <span>{t.exo.methodFilter}</span>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as DiscoveryMethod | 'all');
              setPage(0);
            }}
          >
            <option value="all">{t.exo.allMethods}</option>
            {DISCOVERY_METHODS.map((m) => (
              <option key={m} value={m}>
                {t.exo.methods[m]}
              </option>
            ))}
          </select>
        </label>
        <p className="catalog-count" aria-live="polite">
          {rows.length === 0 ? t.exo.noMatches : t.exo.showing(current * PAGE_SIZE + 1, current * PAGE_SIZE + slice.length, rows.length)}
        </p>
      </div>
      <div className="table-scroll">
        <table className="data-table exo-table">
          <thead>
            <tr>
              {header('name', t.exo.columns.name)}
              <th scope="col">{t.exo.columns.method}</th>
              {header('year', t.exo.columns.year, true)}
              {header('distance', t.exo.columns.distance, true)}
              {header('period', t.exo.columns.period, true)}
              {header('radius', t.exo.columns.radius, true)}
              {header('mass', t.exo.columns.mass, true)}
            </tr>
          </thead>
          <tbody>
            {slice.map((p) => (
              <tr key={p.slug}>
                <th scope="row">
                  <a href={href({ name: 'exoplanet', slug: p.slug })}>{p.name}</a>
                  {p.host !== p.name.replace(/\s+\S+$/, '') ? <span className="exo-host">{p.host}</span> : null}
                </th>
                <td>{t.exo.methods[p.method]}</td>
                <td className="num">{p.year ?? '—'}</td>
                <td className="num">{formatDistanceLy(p.distPc)}</td>
                <td className="num">{p.period ? formatPeriod(p.period) : '—'}</td>
                <td className="num">{earthSym(formatRadiusEarth(p))}</td>
                <td className="num">{earthSym(formatMassEarth(p))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="pager" aria-label="Páginas do catálogo">
          <button type="button" className="btn btn--ghost btn--small" disabled={current === 0} onClick={() => setPage(current - 1)}>
            {t.exo.prev}
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button type="button" className="btn btn--ghost btn--small" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            {t.exo.next}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
