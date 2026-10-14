import { useEffect, useMemo } from 'react';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { findBodyBySlug, tr } from '../../data/catalog';
import { findSmallBody } from '../../data/smallBodies';
import { useI18n } from '../../i18n';
import { NasaGallery } from '../body/NasaGallery';
import { CATEGORY_COLORS } from './MissionTimeline';
import { StatusBadge, checkedDateText } from './MissionsPage';
import { type Mission, MISSIONS_CHECKED, decimalYear, findMission, formatMissionDate } from './missionsData';

function MissionView({ m }: { m: Mission }) {
  const { t } = useI18n();
  const tm = t.missions;
  useEffect(() => {
    document.title = `${m.name} — ${tm.title} — Universe Infinity`;
  }, [m.name, tm.title]);
  const future = decimalYear(m.launch) > decimalYear(MISSIONS_CHECKED);
  const bodies = m.bodies.flatMap((slug) => {
    const b = findBodyBySlug(slug);
    if (b) return [{ key: b.id, name: tr(b.name), href: href({ name: 'body', slug: b.slug }) }];
    const sb = findSmallBody(slug);
    return sb ? [{ key: `sb-${sb.id}`, name: sb.name, href: href({ name: 'small-body', slug: sb.slug }) }] : [];
  });
  const gallery = useMemo(() => m.imageQuery, [m.imageQuery]);

  return (
    <article className="page mission-detail" style={{ ['--mission-color' as string]: CATEGORY_COLORS[m.category] }}>
      <a className="back-link" href={href({ name: 'missions' })}>
        <Icon name="back" size={16} />
        {tm.back}
      </a>
      <header className="mission-hero">
        <p className="body-kicker">{tm.categories[m.category]}</p>
        <h1 className="page-title">{m.name}</h1>
        <p className="page-lede">{m.summary}</p>
      </header>

      <div className="mission-layout">
        <div className="mission-main">
          <section className="mission-status-box" aria-labelledby="ms-status">
            <h2 id="ms-status" className="visually-hidden">
              {tm.status}
            </h2>
            <StatusBadge status={m.status} />
            <p>{m.statusText}</p>
            <p className="section-note">
              {tm.verifiedOn(checkedDateText())}
              {m.statusSource ? (
                <>
                  {' · '}
                  {tm.statusSource}:{' '}
                  <a href={m.statusSource.url} target="_blank" rel="noopener noreferrer">
                    {m.statusSource.title}
                  </a>{' '}
                  ({m.statusSource.publisher})
                </>
              ) : null}
            </p>
          </section>

          <section className="body-section" aria-labelledby="ms-timeline">
            <h2 id="ms-timeline">{tm.timeline}</h2>
            <ol className="mission-events">
              {m.events.map((e) => (
                <li key={`${e.date}-${e.text}`} className={e.planned ? 'is-planned' : undefined}>
                  <span className="mission-event-date">
                    {formatMissionDate(e.date)}
                    {e.planned ? <em> ({tm.planned})</em> : null}
                  </span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="body-section" aria-labelledby="ms-objectives">
            <h2 id="ms-objectives">{tm.objectives}</h2>
            <ul className="prose-list">
              {m.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>

          <section className="body-section" aria-labelledby="ms-instruments">
            <h2 id="ms-instruments">{tm.instruments}</h2>
            {m.instruments.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <tbody>
                    {m.instruments.map(([name, desc]) => (
                      <tr key={name}>
                        <th scope="row">{name}</th>
                        <td>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="section-note">{tm.instrumentsNone}</p>
            )}
          </section>

          {m.discoveries.length ? (
            <section className="body-section" aria-labelledby="ms-discoveries">
              <h2 id="ms-discoveries">{tm.discoveries}</h2>
              <ul className="prose-list">
                {m.discoveries.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {gallery ? <NasaGallery query={gallery} note={tm.galleryNote} /> : null}
        </div>

        <aside className="mission-aside">
          <section className="body-section" aria-labelledby="ms-facts">
            <h2 id="ms-facts" className="visually-hidden">
              {tm.status}
            </h2>
            <dl className="mission-facts">
              <div>
                <dt>{future ? tm.launchPlanned : tm.launched}</dt>
                <dd>{formatMissionDate(m.launch)}</dd>
              </div>
              {m.vehicle ? (
                <div>
                  <dt>{tm.vehicle}</dt>
                  <dd>{m.vehicle}</dd>
                </div>
              ) : null}
              <div>
                <dt>{tm.destination}</dt>
                <dd>{m.destination}</dd>
              </div>
              <div>
                <dt>{tm.agencies}</dt>
                <dd>{m.agencies.map((a) => tm.agencyNames[a] ?? a).join('; ')}</dd>
              </div>
              {m.end ? (
                <div>
                  <dt>{tm.ended}</dt>
                  <dd>{formatMissionDate(m.end)}</dd>
                </div>
              ) : m.plannedUntil ? (
                <div>
                  <dt>{tm.until}</dt>
                  <dd>{formatMissionDate(m.plannedUntil)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          {bodies.length ? (
            <section className="body-section" aria-labelledby="ms-related">
              <h2 id="ms-related">{tm.related}</h2>
              <ul className="chips">
                {bodies.map((b) => (
                  <li key={b.key}>
                    <a className="chip" href={b.href}>
                      {b.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="body-section" aria-labelledby="ms-sources">
            <h2 id="ms-sources">{tm.sources}</h2>
            <ul className="sources">
              {m.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>
                  <span className="source-meta"> — {s.publisher}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </article>
  );
}

export default function MissionPage({ id }: { id: string }) {
  const { t } = useI18n();
  const m = findMission(id.toLowerCase());
  if (!m) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t.notFound.title}</h1>
        <p>{t.missions.notFound}</p>
        <a className="btn" href={href({ name: 'missions' })}>
          {t.missions.back}
        </a>
      </div>
    );
  }
  return <MissionView m={m} />;
}
