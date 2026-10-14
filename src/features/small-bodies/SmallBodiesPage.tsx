import { useEffect, useMemo } from 'react';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { LoadState } from '../../components/LoadState';
import { useAsync } from '../../components/useAsync';
import { formatNumber } from '../../core/format';
import { type SmallBodyOrbitData, loadSmallBodyOrbits, smallBodyPositionAu } from '../../core/astro/smallBody';
import { dateToJulianDayTdb } from '../../core/astro/time';
import { length } from '../../core/astro/vector';
import { SMALL_BODIES, SMALL_BODY_GROUPS, type SmallBody } from '../../data/smallBodies';
import { useI18n } from '../../i18n';
import { setPreference } from '../../state/userData';
import { OrbitMap } from './OrbitMap';

/** Primeira grandeza de tamanho disponível (diâmetro, dimensões ou núcleo). */
export function sizeFact(b: SmallBody) {
  return b.facts.find((f) => /^(Diâmetro|Dimensões|Núcleo)/.test(f.label));
}

export function SmallBodyBadges({ b }: { b: SmallBody }) {
  const { t } = useI18n();
  const ts = t.smallBodies;
  if (!b.neo && !b.pha) return null;
  return (
    <span className="sb-badges">
      {b.neo ? (
        <span className="sb-badge" title={ts.neoHelp}>
          {ts.neo}
        </span>
      ) : null}
      {b.pha ? (
        <span className="sb-badge sb-badge--pha" title={ts.phaHelp}>
          {ts.pha}
        </span>
      ) : null}
    </span>
  );
}

function Card({ b, data, jd }: { b: SmallBody; data: SmallBodyOrbitData | null; jd: number }) {
  const { t } = useI18n();
  const ts = t.smallBodies;
  const epochs = data?.orbits[b.id];
  const r = epochs ? length(smallBodyPositionAu(epochs, jd)) : null;
  const size = sizeFact(b);
  return (
    <li className="sb-card" style={{ ['--accent' as string]: b.accent }}>
      <a href={href({ name: 'small-body', slug: b.slug })}>
        <span className="sb-card-kicker">
          {b.dwarf ? `${ts.dwarf} · ` : ''}
          {ts.classes[b.orbitClass]}
        </span>
        <span className="sb-card-name">{b.name}</span>
        <span className="sb-card-des">{b.designation}</span>
        <span className="sb-card-tag">{b.tagline}</span>
        <span className="sb-card-meta">
          {r !== null ? (
            <span>
              {ts.distanceSun}: <strong>{formatNumber(r, r < 10 ? 2 : 1)} UA</strong>
            </span>
          ) : null}
          {size ? (
            <span>
              {size.label.replace(/^Núcleo: /, 'Núcleo, ')}: <strong>{size.value}</strong>
            </span>
          ) : null}
        </span>
        <SmallBodyBadges b={b} />
      </a>
    </li>
  );
}

export default function SmallBodiesPage() {
  const { t } = useI18n();
  const ts = t.smallBodies;
  const { state, retry } = useAsync(loadSmallBodyOrbits);
  const data = state.status === 'ready' ? state.value : null;
  const jd = useMemo(() => dateToJulianDayTdb(new Date()), []);
  useEffect(() => {
    document.title = `${ts.title} — Universe Infinity`;
  }, [ts.title]);

  const mapBodies = useMemo(
    () => (data ? SMALL_BODIES.filter((b) => data.orbits[b.id]).map((b) => ({ id: b.id, name: b.name, color: b.accent, epochs: data.orbits[b.id]! })) : []),
    [data],
  );

  return (
    <div className="page small-bodies-page">
      <a className="back-link" href={href({ name: 'solar-system' })}>
        <Icon name="back" size={16} />
        {t.nav.solarSystem}
      </a>
      <header className="page-head">
        <h1 className="page-title">{ts.title}</h1>
        <p className="page-lede">{ts.lede}</p>
      </header>

      <LoadState state={state} retry={retry} loading="A carregar as órbitas…" error={ts.loadError} retryLabel="Tentar de novo" />

      {data ? (
        <section className="body-section" aria-labelledby="sb-map">
          <h2 id="sb-map">{ts.orbitsToday}</h2>
          <ul className="sb-legend">
            {SMALL_BODY_GROUPS.map((g) => (
              <li key={g.kind}>
                <span className="sb-swatch" style={{ background: SMALL_BODIES.find((b) => b.kind === g.kind)?.accent }} aria-hidden="true" />
                {ts.kinds[g.kind]}
              </li>
            ))}
          </ul>
          <OrbitMap bodies={mapBodies} jd={jd} maxAu={100} labelBodies={false} ariaLabel={ts.orbitMapAllAria} />
          <a className="btn btn--small" href={href({ name: 'explore' })} onClick={() => setPreference('showSmallBodies', true)}>
            <Icon name="comet" size={16} />
            {ts.inSpace}
          </a>
        </section>
      ) : null}

      {SMALL_BODY_GROUPS.map((g) => (
        <section key={g.kind} className="body-section" aria-labelledby={`sb-${g.kind}`}>
          <h2 id={`sb-${g.kind}`}>{ts.kinds[g.kind]}</h2>
          <ul className="sb-grid">
            {g.ids.map((id) => {
              const b = SMALL_BODIES.find((x) => x.id === id)!;
              return <Card key={id} b={b} data={data} jd={jd} />;
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
