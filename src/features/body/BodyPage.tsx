import { useEffect, type CSSProperties } from 'react';
import { href } from '../../app/router';
import { FavoriteButton } from '../../components/FavoriteButton';
import { Icon } from '../../components/Icon';
import { formatDate, formatNumber } from '../../core/format';
import { BODIES, findBodyById, findBodyBySlug, tr } from '../../data/catalog';
import { SOURCES } from '../../data/sources';
import type { CelestialBody } from '../../data/types';
import { useI18n } from '../../i18n';
import { pushHistory } from '../../state/userData';
import { AtmosphereSection } from './AtmosphereSection';
import { EarthComparison } from './EarthComparison';
import { FactsTable } from './FactsTable';
import { GlobeViewer } from './GlobeViewer';
import { NasaGallery } from './NasaGallery';

function isoToText(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return formatDate(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)));
}

function Neighbours({ body }: { body: CelestialBody }) {
  const i = BODIES.findIndex((b) => b.id === body.id);
  const prev = BODIES[i - 1];
  const next = BODIES[i + 1];
  return (
    <nav className="neighbours" aria-label="Objetos vizinhos">
      {prev ? (
        <a href={href({ name: 'body', slug: prev.slug })} className="neighbour neighbour--prev">
          <Icon name="back" size={16} />
          {tr(prev.name)}
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a href={href({ name: 'body', slug: next.slug })} className="neighbour neighbour--next">
          {tr(next.name)}
          <Icon name="chevron" size={16} />
        </a>
      ) : null}
    </nav>
  );
}

export default function BodyPage({ slug }: { slug: string }) {
  const { t } = useI18n();
  const body = findBodyBySlug(slug);

  useEffect(() => {
    if (!body) return;
    pushHistory(body.id);
    document.title = `${tr(body.name)} — Universe Infinity`;
  }, [body]);

  if (!body) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t.notFound.title}</h1>
        <p>{t.body.notFound}</p>
        <a className="btn" href={href({ name: 'solar-system' })}>
          {t.nav.solarSystem}
        </a>
      </div>
    );
  }

  const parent = body.parent && body.parent !== 'sun' ? findBodyById(body.parent) : undefined;

  return (
    <article className="body-page" style={{ '--accent': body.render.accent } as CSSProperties}>
      <header className="body-hero">
        <div className="body-hero-text">
          <a className="back-link" href={href({ name: 'solar-system' })}>
            <Icon name="back" size={16} />
            {t.nav.solarSystem}
          </a>
          <p className="body-kicker">
            {t.categories[body.type]}
            {parent ? (
              <>
                {' '}
                de <a href={href({ name: 'body', slug: parent.slug })}>{tr(parent.name)}</a>
              </>
            ) : null}
          </p>
          <h1 className="body-name">
            {tr(body.name)}
            {body.symbol ? (
              <span className="body-symbol" aria-hidden="true">
                {body.symbol}
              </span>
            ) : null}
          </h1>
          <p className="body-tagline">{tr(body.tagline)}</p>
          <div className="body-actions">
            <a className="btn" href={href({ name: 'explore', focus: body.slug })}>
              <Icon name="orbit" size={16} />
              {t.body.viewInSpace}
            </a>
            <FavoriteButton id={body.id} withText />
          </div>
          {body.render.visualNote ? (
            <p className="info-note">
              <Icon name="info" size={16} />
              <span>
                <strong>{body.render.texture ? 'Sobre a imagem 3D: ' : `${t.body.illustrative}. `}</strong>
                {tr(body.render.visualNote)}
              </span>
            </p>
          ) : null}
        </div>
        <GlobeViewer body={body} />
      </header>

      <div className="body-content">
        <div className="body-main">
          <section className="body-section body-intro" aria-label="Descrição">
            {body.description.map((p, i) => (
              <p key={i}>{tr(p)}</p>
            ))}
          </section>

          <FactsTable body={body} />

          {body.atmosphere ? <AtmosphereSection atmosphere={body.atmosphere} accent={body.render.accent} /> : null}

          {body.structure ? (
            <section className="body-section" aria-labelledby="structure-title">
              <h2 id="structure-title">{t.body.structure}</h2>
              <ol className="layers">
                {body.structure.layers.map((l, i) => (
                  <li key={i}>
                    <span className="layer-name">{tr(l.name)}</span>
                    <span className="layer-desc">{tr(l.description)}</span>
                  </li>
                ))}
              </ol>
              <p className="section-note">
                Camadas da superfície para o centro.{body.structure.note ? ` ${tr(body.structure.note)}` : ''}
              </p>
            </section>
          ) : null}

          <EarthComparison body={body} />

          {body.features.length > 0 || body.discoveries.length > 0 ? (
            <section className="body-section two-col" aria-label={`${t.body.features} e ${t.body.discoveries}`}>
              {body.features.length > 0 ? (
                <div>
                  <h2>{t.body.features}</h2>
                  <ul className="prose-list">
                    {body.features.map((f, i) => (
                      <li key={i}>{tr(f)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {body.discoveries.length > 0 ? (
                <div>
                  <h2>{t.body.discoveries}</h2>
                  <ul className="prose-list">
                    {body.discoveries.map((f, i) => (
                      <li key={i}>{tr(f)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {body.missions.length > 0 ? (
            <section className="body-section" aria-labelledby="missions-title">
              <h2 id="missions-title">{t.body.missions}</h2>
              <ol className="missions">
                {body.missions.map((m) => (
                  <li key={m.name}>
                    <div className="mission-head">
                      <span className="mission-name">{m.name}</span>
                      <span className="mission-agency">{m.agency}</span>
                    </div>
                    <p className="mission-when">
                      {tr(m.when)}, {t.missionKinds[m.kind].toLowerCase()}
                    </p>
                    <p>{tr(m.summary)}</p>
                    {m.timeSensitive ? (
                      <p className="mission-flag">
                        {t.body.timeSensitive} {isoToText('2026-10-13')}.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <NasaGallery body={body} />
        </div>

        <aside className="body-aside">
          {body.moons ? (
            <section className="aside-card" aria-labelledby="moons-title">
              <h2 id="moons-title">{t.body.moons}</h2>
              <p className="moons-count">
                <span className="big-number">{body.moons.count}</span>
                <span>{t.body.moonsCount(body.moons.count, isoToText(body.moons.asOf))}</span>
              </p>
              {body.moons.note ? <p className="section-note">{tr(body.moons.note)}</p> : null}
              {body.moons.notable.length > 0 ? (
                <>
                  <h3>{t.body.notableMoons}</h3>
                  <table className="data-table data-table--compact">
                    <thead>
                      <tr>
                        <th scope="col">Nome</th>
                        <th scope="col" className="num">
                          {t.body.meanDiameter}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {body.moons.notable.map((m) => (
                        <tr key={tr(m.name)}>
                          <th scope="row">
                            {m.bodyId ? (
                              <a href={href({ name: 'body', slug: findBodyById(m.bodyId)?.slug ?? '' })}>{tr(m.name)}</a>
                            ) : (
                              tr(m.name)
                            )}
                          </th>
                          <td className="num">
                            {formatNumber(m.radiusKm * 2, m.radiusKm < 100 ? 1 : 0)} ± {formatNumber(m.radiusUncertaintyKm * 2, m.radiusUncertaintyKm * 2 < 0.1 ? 2 : 1)} km
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="section-note">Diâmetro = 2 × raio médio publicado pelo JPL (Planetary Satellite Physical Parameters).</p>
                </>
              ) : null}
            </section>
          ) : null}

          {body.render.rings ? (
            <section className="aside-card" aria-labelledby="rings-title">
              <h2 id="rings-title">Anéis</h2>
              <p>
                {body.render.rings.style === 'saturn' ? 'Anéis principais (C, B e A)' : 'Anéis principais'} entre{' '}
                {formatNumber(body.render.rings.innerKm, 0)} km e {formatNumber(body.render.rings.outerKm, 0)} km do centro.
              </p>
              <p className="section-note">
                Fonte:{' '}
                <a href={SOURCES[body.render.rings.sourceId].url} target="_blank" rel="noopener noreferrer">
                  {SOURCES[body.render.rings.sourceId].title}
                </a>
              </p>
            </section>
          ) : null}

          <section className="aside-card" aria-labelledby="sources-title">
            <h2 id="sources-title">{t.body.sources}</h2>
            <ul className="sources">
              {body.sources.map((id) => {
                const s = SOURCES[id];
                return (
                  <li key={id}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title}
                    </a>
                    <span className="source-meta">
                      {s.publisher}
                      {s.updated ? `; ${t.body.updated} ${s.updated}` : ''}; {t.body.accessed} {s.accessed}
                      {s.license ? `; ${t.body.license} ${s.license}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      <Neighbours body={body} />
    </article>
  );
}
