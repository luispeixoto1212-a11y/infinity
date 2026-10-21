import { useEffect, useMemo, useRef, useState } from 'react';
import { href } from '../../app/router';
import { KindBadge } from '../../components/FactRows';
import { Icon } from '../../components/Icon';
import { LoadState } from '../../components/LoadState';
import { SourcesList } from '../../components/SourcesList';
import { useAsync } from '../../components/useAsync';
import { formatNumber } from '../../core/format';
import type { ValueKind } from '../../data/types';
import { useI18n } from '../../i18n';
import { QUALITY, detectQualityTier, isWebGLAvailable, prefersReducedMotion } from '../explorer/engine/quality';
import { SpaceTabs } from '../deepsky/SpaceTabs';
import { LY_PER_PC, colorFromBv, loadStars, temperatureFromColor, type Star } from '../stars/starData';
import { StarMapEngine } from './StarMapEngine';
import {
  DEFAULT_FILTER,
  LUMINOSITY_BINS,
  SPECTRAL_GROUPS,
  type LuminosityBin,
  type SpectralGroup,
  type StarMapData,
  type StarMapFilter,
  distanceLy,
  distancePc,
  galacticLonLat,
  loadStarMap,
  nearestVisible,
  searchStarMap,
  visibleMask,
  visualLuminosityAt,
} from './starMapData';

const fmtInt = (n: number) => new Intl.NumberFormat('pt-PT').format(n);

function formatLy(ly: number): string {
  return `${formatNumber(ly, ly < 100 ? 2 : 1)} anos-luz`;
}

interface Fact {
  label: string;
  value: string;
  kind: ValueKind;
  source: string;
  note?: string;
}

function selectedFacts(d: StarMapData, i: number, t: ReturnType<typeof useI18n>['t']): Fact[] {
  const tm = t.starMap;
  const out: Fact[] = [];
  const pc = distancePc(d, i);
  out.push({
    label: tm.facts.distance,
    value: `${formatLy(pc * LY_PER_PC)} · ${formatNumber(pc, 2)} pc`,
    kind: 'measured',
    source: `${tm.kindSource.catalog} (${tm.sources[d.distSrc[i]!]})`,
    note: tm.notes.distance,
  });
  if (d.spect[i]) out.push({ label: tm.facts.spect, value: d.spect[i]!, kind: 'measured', source: tm.kindSource.catalog });
  const mag = d.mag[i]!;
  if (!Number.isNaN(mag)) out.push({ label: tm.facts.mag, value: formatNumber(mag, 2), kind: 'measured', source: tm.kindSource.catalog });
  const absMag = d.absMag[i]!;
  if (!Number.isNaN(absMag)) {
    out.push({ label: tm.facts.absMag, value: formatNumber(absMag, 2), kind: 'derived', source: tm.kindSource.catalog, note: t.space.starNotes.absMag });
    const lum = visualLuminosityAt(d, i)!;
    out.push({
      label: tm.facts.luminosity,
      value: t.space.sunTimes(lum >= 100 ? fmtInt(Math.round(lum)) : formatNumber(lum, lum < 0.01 ? 5 : lum < 1 ? 3 : 1)),
      kind: 'derived',
      source: tm.kindSource.calc,
      note: t.space.starNotes.luminosity,
    });
  }
  const ci = d.ci[i]!;
  if (!Number.isNaN(ci)) {
    out.push({ label: tm.facts.color, value: formatNumber(ci, 2), kind: 'measured', source: tm.kindSource.catalog });
    const temp = temperatureFromColor(ci);
    if (temp) out.push({ label: tm.facts.temperature, value: `≈ ${fmtInt(Math.round(temp / 100) * 100)} K`, kind: 'estimate', source: tm.kindSource.calc, note: t.space.starNotes.temperature });
  }
  const { l, b } = galacticLonLat(d, i);
  out.push({ label: tm.facts.galactic, value: `l = ${formatNumber(l, 2)}°, b = ${formatNumber(b, 2)}°`, kind: 'derived', source: tm.kindSource.calc, note: tm.notes.galactic });
  return out;
}

function SelectedPanel({
  data,
  index,
  star,
  onTravel,
  onBack,
  onClear,
}: {
  data: StarMapData;
  index: number;
  star?: Star;
  onTravel: () => void;
  onBack: () => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const tm = t.starMap;
  return (
    <section className="starmap-selected" aria-labelledby="starmap-selected-title" aria-live="polite">
      <div className="starmap-selected-head">
        <span className="star-dot" style={{ background: colorFromBv(Number.isNaN(data.ci[index]!) ? undefined : data.ci[index]!) }} aria-hidden="true" />
        <h2 id="starmap-selected-title">{star?.name ?? data.des[index]}</h2>
        <button type="button" className="icon-btn" onClick={onClear} aria-label={tm.clear}>
          <Icon name="close" size={18} />
        </button>
      </div>
      {star?.designation && star.designation !== data.des[index] ? <p className="star-des">{star.designation}</p> : null}
      <dl className="starmap-facts">
        {selectedFacts(data, index, t).map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>
              <span className="starmap-fact-value">{f.value}</span>
              <span className="starmap-fact-meta">
                <KindBadge kind={f.kind} /> {f.source}
              </span>
              {f.note ? <span className="starmap-fact-note">{f.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      <div className="starmap-actions">
        <button type="button" className="btn btn--small" onClick={onTravel}>
          {tm.travel}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
          {tm.backToSun}
        </button>
        {star ? (
          <a className="btn btn--ghost btn--small" href={href({ name: 'star', slug: star.slug })}>
            {tm.openPage}
          </a>
        ) : null}
        {star && star.hip && star.mag !== undefined && star.mag <= 6 ? (
          <a className="btn btn--ghost btn--small" href={href({ name: 'planetarium', target: star.slug })}>
            <Icon name="sky" size={15} />
            {tm.viewInSky}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function MapView({ data, stars, slug }: { data: StarMapData; stars: Star[]; slug?: string }) {
  const { t } = useI18n();
  const tm = t.starMap;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<StarMapEngine | null>(null);
  const [webgl] = useState(isWebGLAvailable);
  const [filter, setFilter] = useState<StarMapFilter>(DEFAULT_FILTER);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(stars.map((s) => [s.id, s])), [stars]);
  const indexById = useMemo(() => {
    const m = new Map<number, number>();
    for (let i = 0; i < data.n; i += 1) if (data.catalogId[i]) m.set(data.catalogId[i]!, i);
    return m;
  }, [data]);
  const mask = useMemo(() => visibleMask(data, filter), [data, filter]);
  const count = useMemo(() => mask.reduce((a, v) => a + v, 0), [mask]);
  const nearest = useMemo(() => nearestVisible(data, mask, 15), [data, mask]);
  const results = useMemo(() => searchStarMap(data, query), [data, query]);
  const gaiaCount = useMemo(() => data.distSrc.filter((s) => s === 'gaia-dr3').length, [data]);
  // Etiquetas permanentes: estrelas com nome próprio muito brilhantes no céu ou muito próximas
  const labelled = useMemo(
    () =>
      stars
        .filter((s) => s.hasProperName && s.distPc !== undefined && ((s.mag ?? 99) <= 1.6 || s.distPc <= 5))
        // Por ordem de brilho no céu: quando as etiquetas se sobrepõem, ficam as das estrelas mais conhecidas
        .sort((a, b) => (a.mag ?? 99) - (b.mag ?? 99))
        .map((s) => indexById.get(s.id))
        .filter((i): i is number => i !== undefined),
    [stars, indexById],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!webgl || !canvas || !layer) return;
    const engine = new StarMapEngine({
      canvas,
      labelLayer: layer,
      data,
      quality: QUALITY[detectQualityTier()],
      reducedMotion: prefersReducedMotion(),
      labels: {
        sun: tm.sun,
        ring: (pc) => tm.ring(pc, fmtInt(Math.round(pc * LY_PER_PC))),
        galacticCenter: tm.galacticCenter,
        northPole: tm.northPole,
      },
      onSelect: setSelected,
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [data, webgl, tm]);

  useEffect(() => engineRef.current?.setMask(mask), [mask]);
  useEffect(() => engineRef.current?.setStarLabels(labelled), [labelled]);
  useEffect(() => engineRef.current?.select(selected), [selected]);

  // Endereço #/mapa-estelar/<estrela>: seleciona a estrela e viaja até ela
  useEffect(() => {
    if (!slug) return;
    const s = stars.find((x) => x.slug === slug);
    const i = s ? indexById.get(s.id) : undefined;
    if (i === undefined) return;
    setSelected(i);
    engineRef.current?.travelTo(i);
  }, [slug, stars, indexById]);

  const show = (i: number) => {
    // Uma estrela escolhida na lista ou na pesquisa fica sempre visível
    if (!mask[i]) setFilter(DEFAULT_FILTER);
    setSelected(i);
    engineRef.current?.travelTo(i);
  };

  const toggleGroup = (g: SpectralGroup) =>
    setFilter((f) => {
      const groups = new Set(f.groups);
      if (groups.has(g)) groups.delete(g);
      else groups.add(g);
      return { ...f, groups };
    });

  const selectedStar = selected !== null && data.catalogId[selected] ? byId.get(data.catalogId[selected]!) : undefined;

  return (
    <>
      <div className="starmap-layout">
        <div className="starmap-stage-wrap">
          {webgl ? (
            <div className="starmap-stage">
              <canvas ref={canvasRef} className="starmap-canvas" role="img" aria-label={tm.canvasLabel} />
              <div ref={labelsRef} className="starmap-labels" aria-hidden="true" />
              <div className="starmap-zoom">
                <button type="button" className="icon-btn" onClick={() => engineRef.current?.zoom(0.6)} aria-label={tm.zoomIn}>
                  +
                </button>
                <button type="button" className="icon-btn" onClick={() => engineRef.current?.zoom(1.6)} aria-label={tm.zoomOut}>
                  −
                </button>
                <button type="button" className="icon-btn" onClick={() => engineRef.current?.reset()} aria-label={tm.reset}>
                  <Icon name="recenter" size={18} />
                </button>
              </div>
            </div>
          ) : (
            <p className="notice">{tm.noWebgl}</p>
          )}
          <p className="section-note">{tm.help}</p>
        </div>

        <aside className="starmap-side">
          <div className="field starmap-search">
            <label htmlFor="starmap-search">{tm.searchLabel}</label>
            <input id="starmap-search" type="search" value={query} placeholder={tm.searchPlaceholder} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            {query.trim().length >= 2 ? (
              results.length ? (
                <ul className="starmap-results">
                  {results.map((i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => {
                          show(i);
                          setQuery('');
                        }}
                      >
                        <span>{data.des[i]}</span>
                        <span className="starmap-result-dist">{formatLy(distanceLy(data, i))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="section-note">{tm.searchNone}</p>
              )
            ) : null}
          </div>

          {selected !== null ? (
            <SelectedPanel
              data={data}
              index={selected}
              star={selectedStar}
              onTravel={() => engineRef.current?.travelTo(selected)}
              onBack={() => engineRef.current?.travelTo(null)}
              onClear={() => setSelected(null)}
            />
          ) : (
            <p className="section-note starmap-hint">{tm.selectedNone}</p>
          )}

          <fieldset className="starmap-filters">
            <legend>{tm.filters}</legend>
            <p className="catalog-count" aria-live="polite">
              {tm.count(fmtInt(count))}
            </p>
            <label className="field" htmlFor="starmap-dist">
              <span>
                {tm.maxDistance}: <strong>{tm.maxDistanceValue(filter.maxPc, fmtInt(Math.round(filter.maxPc * LY_PER_PC)))}</strong>
              </span>
              <input
                id="starmap-dist"
                type="range"
                min={5}
                max={100}
                step={5}
                value={filter.maxPc}
                onChange={(e) => setFilter((f) => ({ ...f, maxPc: Number(e.target.value) }))}
              />
            </label>
            <p className="starmap-filter-title">{tm.spectral}</p>
            <div className="chips">
              {SPECTRAL_GROUPS.map((g) => (
                <button key={g} type="button" className={filter.groups.has(g) ? 'chip is-active' : 'chip'} aria-pressed={filter.groups.has(g)} onClick={() => toggleGroup(g)}>
                  {tm.groups[g]}
                </button>
              ))}
            </div>
            <p className="starmap-filter-title" id="starmap-lum-title">
              {tm.luminosity}
            </p>
            <div className="chips" role="radiogroup" aria-labelledby="starmap-lum-title">
              {LUMINOSITY_BINS.map((b: LuminosityBin) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={filter.luminosity === b}
                  className={filter.luminosity === b ? 'chip is-active' : 'chip'}
                  onClick={() => setFilter((f) => ({ ...f, luminosity: b }))}
                >
                  {tm.luminosityBins[b]}
                </button>
              ))}
            </div>
          </fieldset>
        </aside>
      </div>

      <section className="body-section" aria-labelledby="starmap-nearest">
        <h2 id="starmap-nearest">{tm.nearestTitle}</h2>
        <p className="section-note">{tm.nearestNote}</p>
        <div className="table-scroll">
          <table className="data-table exo-table star-table">
            <thead>
              <tr>
                <th scope="col">{tm.columns.name}</th>
                <th scope="col" className="num">
                  {tm.columns.distance}
                </th>
                <th scope="col">{tm.columns.spect}</th>
                <th scope="col" className="num">
                  {tm.columns.mag}
                </th>
                <th scope="col">
                  <span className="visually-hidden">{tm.show}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {nearest.map((i) => (
                <tr key={i} className={i === selected ? 'is-selected' : undefined}>
                  <th scope="row">
                    <span className="star-link">
                      <span className="star-dot" style={{ background: colorFromBv(Number.isNaN(data.ci[i]!) ? undefined : data.ci[i]!) }} aria-hidden="true" />
                      <span>{data.des[i]}</span>
                    </span>
                  </th>
                  <td className="num">{formatLy(distanceLy(data, i))}</td>
                  <td>{data.spect[i] ?? '—'}</td>
                  <td className="num">{Number.isNaN(data.mag[i]!) ? '—' : formatNumber(data.mag[i]!, 2)}</td>
                  <td>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => show(i)} aria-label={`${tm.show}: ${data.des[i]}`}>
                      {tm.show}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="body-section" aria-labelledby="starmap-about">
        <h2 id="starmap-about">{tm.aboutTitle}</h2>
        <ul className="prose-list">
          <li>{tm.about.positions}</li>
          <li>{tm.about.distances(fmtInt(gaiaCount), fmtInt(data.n))}</li>
          <li>{tm.about.missing}</li>
          <li>{tm.about.illustrative}</li>
        </ul>
        <SourcesList ids={['athyg']} showNotes />
      </section>
    </>
  );
}

const loadAll = () => Promise.all([loadStarMap(), loadStars()]);

export default function StarMapPage({ slug }: { slug?: string }) {
  const { t } = useI18n();
  const tm = t.starMap;
  const { state, retry } = useAsync(loadAll);
  useEffect(() => {
    document.title = `${tm.title} — Universe Infinity`;
  }, [tm.title]);
  const n = state.status === 'ready' ? fmtInt(state.value[0].n) : undefined;
  return (
    <div className="page space-page starmap-page">
      <header className="page-head">
        <h1 className="page-title">{tm.title}</h1>
        <p className="page-lede">{tm.lede(n)}</p>
      </header>
      <SpaceTabs current="star-map" />
      <LoadState state={state} retry={retry} loading={tm.loading} error={tm.loadError} retryLabel={tm.retry} />
      {state.status === 'ready' ? <MapView data={state.value[0]} stars={state.value[1]} slug={slug} /> : null}
    </div>
  );
}
