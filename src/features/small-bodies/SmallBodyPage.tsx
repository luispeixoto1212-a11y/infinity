import { useEffect, useMemo } from 'react';
import { href } from '../../app/router';
import { type FactRow, FactRows } from '../../components/FactRows';
import { Icon } from '../../components/Icon';
import { LoadState } from '../../components/LoadState';
import { useAsync } from '../../components/useAsync';
import { LOCALE, formatNumber } from '../../core/format';
import { planetPositionAu } from '../../core/astro/kepler';
import { AU_KM } from '../../core/astro/positions';
import {
  type SmallBodyOrbitData,
  loadSmallBodyOrbits,
  nearestEpoch,
  nextPerihelionJd,
  orbitalPeriodDays,
  perihelionAphelion,
  semiMajorAxis,
  smallBodyPositionAu,
  validationError,
} from '../../core/astro/smallBody';
import { UNIX_EPOCH_JD, dateToJulianDayTdb } from '../../core/astro/time';
import { length, sub } from '../../core/astro/vector';
import { type SmallBody, findSmallBody } from '../../data/smallBodies';
import { useI18n } from '../../i18n';
import { setPreference } from '../../state/userData';
import { NasaGallery } from '../body/NasaGallery';
import { OrbitMap } from './OrbitMap';
import { SmallBodyBadges } from './SmallBodiesPage';

/** Data (dia) de um dia juliano na escala TDB, sem conversão de fuso horário. */
function formatJdDate(jd: number): string {
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date((jd - UNIX_EPOCH_JD) * 86_400_000));
}

const HORIZONS = { title: 'JPL Horizons', url: 'https://ssd.jpl.nasa.gov/horizons/' };

function orbitRows(b: SmallBody, data: SmallBodyOrbitData, jd: number, t: ReturnType<typeof useI18n>['t']): FactRow[] {
  const ts = t.smallBodies;
  const r = ts.rows;
  const epochs = data.orbits[b.id]!;
  const el = nearestEpoch(epochs, jd);
  const pos = smallBodyPositionAu(epochs, jd);
  const earth = planetPositionAu('emb', jd);
  const dSun = length(pos);
  const dEarth = length(sub(pos, earth));
  const { q, Q } = perihelionAphelion(el);
  const a = semiMajorAxis(el);
  const P = orbitalPeriodDays(el);
  const hyper = el[1] >= 1;
  const comp = ts.computed;
  const rows: FactRow[] = [
    { label: r.distanceSun, value: `${formatNumber(dSun, dSun < 10 ? 3 : 2)} UA`, secondary: `${formatNumber((dSun * AU_KM) / 1e6, 0)} milhões de km`, kind: 'derived', source: comp, note: ts.notes.distance },
    { label: r.distanceEarth, value: `${formatNumber(dEarth, dEarth < 10 ? 3 : 2)} UA`, secondary: `${formatNumber((dEarth * AU_KM) / 1e6, 0)} milhões de km`, kind: 'derived', source: comp },
    { label: r.lightTime, value: dEarth * 499.005 < 3600 ? `${formatNumber((dEarth * 499.005) / 60, 1)} min` : `${formatNumber((dEarth * 499.005) / 3600, 1)} h`, kind: 'derived', source: comp },
    { label: r.q, value: `${formatNumber(q, q < 10 ? 3 : 1)} UA`, kind: 'measured', source: ts.horizons, sourceUrl: HORIZONS.url },
  ];
  if (!hyper) {
    rows.push(
      { label: r.Q, value: `${formatNumber(Q, Q < 10 ? 3 : 1)} UA`, kind: 'derived', source: comp },
      { label: r.a, value: `${formatNumber(a, a < 10 ? 3 : 1)} UA`, kind: 'derived', source: comp },
      {
        label: r.period,
        value: P < 1000 ? ts.days(formatNumber(P, 0)) : ts.years(formatNumber(P / 365.25, P < 365.25 * 100 ? 2 : 0)),
        kind: 'derived',
        source: comp,
        note: b.id === 'sedna' || b.id === 'hale-bopp' ? ts.notes.sedna : 'Calculado: P = 2π·√(a³/GM☉).',
      },
    );
  } else {
    rows.push({ label: r.a, value: `${formatNumber(a, 3)} UA`, kind: 'derived', source: comp, note: ts.notes.hyperbolic });
  }
  rows.push(
    { label: r.e, value: formatNumber(el[1], 4), kind: 'measured', source: ts.horizons, sourceUrl: HORIZONS.url },
    { label: r.i, value: `${formatNumber(el[3], 2)}°`, kind: 'measured', source: ts.horizons, sourceUrl: HORIZONS.url },
  );
  const tpJd = nextPerihelionJd(epochs, jd);
  rows.push({
    label: hyper || tpJd < jd ? r.lastPerihelion : r.nextPerihelion,
    value: formatJdDate(tpJd),
    kind: 'derived',
    source: comp,
    note: ts.notes.perihelion,
  });
  rows.push({ label: r.epoch, value: `${formatJdDate(el[0])} (TDB)`, kind: 'measured', source: ts.horizons, sourceUrl: HORIZONS.url });
  return rows;
}

function SmallBodyView({ b }: { b: SmallBody }) {
  const { t } = useI18n();
  const ts = t.smallBodies;
  const { state, retry } = useAsync(loadSmallBodyOrbits);
  const data = state.status === 'ready' ? state.value : null;
  const jd = useMemo(() => dateToJulianDayTdb(new Date()), []);
  useEffect(() => {
    document.title = `${b.name} — ${ts.title} — Universe Infinity`;
  }, [b.name, ts.title]);

  const epochs = data?.orbits[b.id];
  const maxAu = useMemo(() => {
    if (!epochs) return 6;
    const el = nearestEpoch(epochs, jd);
    const extent = el[1] < 1 ? perihelionAphelion(el).Q : Math.max(length(smallBodyPositionAu(epochs, jd)), el[2] * 4);
    return Math.min(120, Math.max(6, extent * 1.15));
  }, [epochs, jd]);
  const err = data ? validationError(data, b.id) : null;

  const physical: FactRow[] = b.facts.map((f) => ({
    label: f.label,
    value: f.value,
    kind: f.kind,
    source: f.source.title.replace(/^JPL Small-Body Database — .*/, 'JPL SBDB'),
    sourceUrl: f.source.url,
    ...(f.note ? { note: f.note } : {}),
  }));

  return (
    <article className="page small-body-detail" style={{ ['--accent' as string]: b.accent }}>
      <a className="back-link" href={href({ name: 'small-bodies' })}>
        <Icon name="back" size={16} />
        {ts.back}
      </a>
      <header className="sb-hero">
        <p className="body-kicker">
          {b.dwarf ? ts.dwarf : ts.kindOne[b.kind]} · {ts.classes[b.orbitClass]}
        </p>
        <h1 className="page-title">{b.name}</h1>
        <p className="sb-designation">{b.designation}</p>
        <p className="page-lede">{b.tagline}</p>
        <SmallBodyBadges b={b} />
        {ts.classHelp[b.orbitClass] ? <p className="section-note">{ts.classHelp[b.orbitClass]}</p> : null}
      </header>

      <div className="mission-layout">
        <div className="mission-main">
          <section className="body-section" aria-labelledby="sb-about">
            <h2 id="sb-about" className="visually-hidden">
              {b.name}
            </h2>
            <p className="prose">{b.description}</p>
            <h3 className="sb-subtitle">{ts.highlights}</h3>
            <ul className="prose-list">
              {b.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>

          <section className="body-section" aria-labelledby="sb-orbit">
            <h2 id="sb-orbit">{ts.orbitTitle}</h2>
            <LoadState state={state} retry={retry} loading="A carregar a órbita…" error={ts.loadError} retryLabel="Tentar de novo" />
            {data && epochs ? (
              <>
                <OrbitMap bodies={[{ id: b.id, name: b.name, color: b.accent, epochs }]} jd={jd} maxAu={maxAu} labelBodies ariaLabel={ts.orbitMapAria(b.name)} />
                <h3 className="sb-subtitle">{ts.orbitTable}</h3>
                <FactRows rows={orbitRows(b, data, jd, t)} />
                {b.orbitNote ? <p className="section-note">{b.orbitNote}</p> : null}
              </>
            ) : null}
          </section>

          <section className="body-section" aria-labelledby="sb-physical">
            <h2 id="sb-physical">{ts.physical}</h2>
            <FactRows rows={physical} />
          </section>

          {b.imageQuery ? <NasaGallery query={b.imageQuery} note={ts.galleryNote} /> : null}
        </div>

        <aside className="mission-aside">
          <section className="body-section" aria-labelledby="sb-discovery">
            <h2 id="sb-discovery">{ts.discovery}</h2>
            <p>{b.discovery.text}</p>
            <p className="section-note">
              <a href={b.discovery.source.url} target="_blank" rel="noopener noreferrer">
                {b.discovery.source.title}
              </a>
            </p>
          </section>
          <section className="body-section" aria-labelledby="sb-missions">
            <h2 id="sb-missions">{ts.missions}</h2>
            {b.missions.length ? (
              <ul className="sb-missions">
                {b.missions.map((m) => (
                  <li key={m.name}>
                    <strong>
                      {m.missionId ? <a href={href({ name: 'mission', id: m.missionId })}>{m.name}</a> : m.name}
                    </strong>{' '}
                    <span className="sb-when">({m.when})</span>
                    <span className="sb-mission-text">{m.text}</span>
                    {m.source ? (
                      <a className="source-meta" href={m.source.url} target="_blank" rel="noopener noreferrer">
                        {m.source.title}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="section-note">{ts.missionsNone}</p>
            )}
          </section>
          {err ? (
            <section className="body-section" aria-labelledby="sb-precision">
              <h2 id="sb-precision">{ts.precision}</h2>
              <p className="section-note">{ts.precisionText(`${formatNumber(err.deg, err.deg < 0.1 ? 3 : 2)}°`, formatNumber(err.au, 3))}</p>
            </section>
          ) : null}
          <section className="body-section">
            <a className="btn btn--small" href={href({ name: 'explore' })} onClick={() => setPreference('showSmallBodies', true)} title={ts.inSpaceHelp}>
              <Icon name="comet" size={16} />
              {ts.inSpace}
            </a>
          </section>
          <section className="body-section" aria-labelledby="sb-sources">
            <h2 id="sb-sources">{ts.sources}</h2>
            <ul className="sources">
              {[...new Map([...b.facts.map((f) => f.source), b.discovery.source, HORIZONS].map((s) => [s.url, s])).values()].map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
            <p className="section-note">{ts.sourcesNote}</p>
          </section>
        </aside>
      </div>
    </article>
  );
}

export default function SmallBodyPage({ slug }: { slug: string }) {
  const { t } = useI18n();
  const b = findSmallBody(slug.toLowerCase());
  if (!b) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t.notFound.title}</h1>
        <p>{t.smallBodies.notFound}</p>
        <a className="btn" href={href({ name: 'small-bodies' })}>
          {t.smallBodies.back}
        </a>
      </div>
    );
  }
  return <SmallBodyView b={b} />;
}
