import { useCallback, useMemo, useRef, useState } from 'react';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { CosmologyCalculator } from './CosmologyCalculator';
import { COSMIC_EVENTS } from './cosmicEvents';
import { CATEGORY_ORDER, TIMELINE_COLORS, TimelineChart, clampDomain } from './TimelineChart';
import { type ScaleMode, coordinate, cosmicCalendar, formatSinceBigBang, formatYears, fullDomain, timeEvent } from './timeScale';

const MODES: ScaleMode[] = ['history', 'early', 'linear'];

export default function TimelinePage() {
  const { t } = useI18n();
  const tt = t.timeline;
  const events = useMemo(() => COSMIC_EVENTS.map(timeEvent), []);
  const [mode, setMode] = useState<ScaleMode>('history');
  const [domains, setDomains] = useState<Record<ScaleMode, [number, number]>>(() => ({
    early: fullDomain('early'),
    history: fullDomain('history'),
    linear: fullDomain('linear'),
  }));
  const [selectedId, setSelectedId] = useState<string | null>('cmb');
  const detailRef = useRef<HTMLElement>(null);
  const domain = domains[mode];
  const setDomain = useCallback((d: [number, number]) => setDomains((all) => ({ ...all, [mode]: d })), [mode]);
  const selected = events.find((e) => e.id === selectedId) ?? null;

  const zoom = (factor: number) => {
    const [a, b] = domain;
    const c = (a + b) / 2;
    setDomain(clampDomain(mode, [c - ((b - a) / 2) * factor, c + ((b - a) / 2) * factor]));
  };

  /** Seleciona e, se o acontecimento estiver fora da vista, centra-a nele. */
  const select = (id: string, scroll = false) => {
    setSelectedId(id);
    const e = events.find((x) => x.id === id);
    if (e) {
      const v = coordinate(e, mode);
      const [a, b] = domain;
      if (v < a || v > b) setDomain(clampDomain(mode, [v - (b - a) / 2, v + (b - a) / 2]));
    }
    if (scroll) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const byCategory = CATEGORY_ORDER.map((c) => ({ c, list: events.filter((e) => e.category === c).sort((a, b) => a.seconds - b.seconds) }));
  const cal = selected ? cosmicCalendar(selected.yearsAgo) : null;

  return (
    <div className="page page--wide timeline-page">
      <header className="page-head">
        <h1 className="page-title">{tt.title}</h1>
        <p className="page-lede">{tt.lede}</p>
      </header>

      <div className="tl-toolbar">
        <div className="segmented" role="group" aria-label={tt.modes.label}>
          {MODES.map((m) => (
            <button key={m} type="button" className={mode === m ? 'is-active' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {tt.modes[m]}
            </button>
          ))}
        </div>
        <div className="tl-zoom">
          <button type="button" className="icon-btn" onClick={() => zoom(1 / 1.6)} aria-label={tt.zoomIn}>
            +
          </button>
          <button type="button" className="icon-btn" onClick={() => zoom(1.6)} aria-label={tt.zoomOut}>
            −
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setDomain(fullDomain(mode))}>
            {tt.reset}
          </button>
        </div>
      </div>
      <p className="section-note tl-mode-note">{tt.modeNotes[mode]}</p>

      <TimelineChart events={events} mode={mode} domain={domain} onDomainChange={setDomain} selectedId={selectedId} onSelect={(id) => select(id)} />
      <p id="tl-help" className="section-note">
        {tt.help}
      </p>

      <section ref={detailRef} className="tl-detail" aria-live="polite" aria-label={selected?.title ?? tt.pick}>
        {selected ? (
          <>
            <div className="tl-detail-head">
              <span className="tl-detail-cat" style={{ color: TIMELINE_COLORS[selected.category] }}>
                {tt.categories[selected.category]}
              </span>
              <span className={`tl-kind tl-kind--${selected.kind}`}>{tt.kinds[selected.kind]}</span>
            </div>
            <h2 className="tl-detail-title">{selected.title}</h2>
            <p className="tl-detail-when">{selected.whenText}</p>
            <p>{selected.description}</p>
            <dl className="tl-detail-facts">
              <div>
                <dt>{tt.detail.since}</dt>
                <dd>{formatSinceBigBang(selected.seconds)}</dd>
              </div>
              <div>
                <dt>{tt.detail.ago}</dt>
                <dd>{formatYears(selected.yearsAgo)}</dd>
              </div>
              <div>
                <dt title={tt.detail.calendarNote}>{tt.detail.calendar}</dt>
                <dd>{cal?.text}</dd>
              </div>
            </dl>
            <p className="section-note">
              {tt.detail.calendarNote} {tt.detail.computed}
              {selected.source ? (
                <>
                  {' '}
                  {tt.detail.source}:{' '}
                  {selected.source.url ? (
                    <a href={selected.source.url} target="_blank" rel="noopener noreferrer">
                      {selected.source.title}
                    </a>
                  ) : (
                    selected.source.title
                  )}
                  .
                </>
              ) : null}
            </p>
            {selected.link ? (
              <a className="btn btn--small" href={href(selected.link)}>
                {tt.detail.open}
                <Icon name="chevron" size={14} />
              </a>
            ) : null}
          </>
        ) : (
          <p className="section-note">{tt.pick}</p>
        )}
      </section>

      <details className="tl-list">
        <summary>{tt.listTitle}</summary>
        <div className="tl-list-grid">
          {byCategory.map(({ c, list }) => (
            <section key={c} aria-label={tt.categories[c]}>
              <h3 style={{ color: TIMELINE_COLORS[c] }}>{tt.categories[c]}</h3>
              <ol>
                {list.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="tl-list-item" onClick={() => select(e.id, true)} aria-current={e.id === selectedId ? 'true' : undefined}>
                      <span>{e.title}</span>
                      <span className="tl-list-when">{e.whenText}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </details>

      <section className="tl-explain" aria-labelledby="tl-explain-title">
        <h2 id="tl-explain-title">{tt.explainTitle}</h2>
        <div className="tl-explain-grid">
          <div className="tl-explain-text">
            {tt.explain.map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
          </div>
          <div>
            <h3>{tt.calc.title}</h3>
            <CosmologyCalculator />
          </div>
        </div>
      </section>
    </div>
  );
}
