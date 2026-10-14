import { useEffect, useMemo } from 'react';
import { href } from '../../app/router';
import { FactRows, type FactRow } from '../../components/FactRows';
import { Icon } from '../../components/Icon';
import { LoadState } from '../../components/LoadState';
import { SourcesList } from '../../components/SourcesList';
import { useAsync } from '../../components/useAsync';
import { formatNumber } from '../../core/format';
import { constellationName } from '../../data/constellations';
import { useI18n } from '../../i18n';
import { NasaGallery } from '../body/NasaGallery';
import { DeepSkyGlyph, SUBTYPE_COLOR } from './DeepSkyGlyph';
import { SkyMap } from './SkyMap';
import {
  FULL_MOON_ARCMIN,
  displayName,
  formatDec,
  formatLightYears,
  formatRa,
  loadDeepSky,
  nasaHubblePage,
  physicalSizeLy,
  type DeepSkyObject,
} from './deepSkyData';

/** Tamanho no céu comparado com a Lua cheia (à mesma escala). */
function SkySize({ o }: { o: DeepSkyObject }) {
  const { t } = useI18n();
  if (!o.majorArcmin) {
    return (
      <div className="sky-size sky-size--empty">
        <DeepSkyGlyph subtype={o.subtype} size={120} />
      </div>
    );
  }
  const maxArc = Math.max(o.majorArcmin, FULL_MOON_ARCMIN);
  const px = 150 / maxArc;
  const moonR = (FULL_MOON_ARCMIN / 2) * px;
  const a = Math.max(1.5, (o.majorArcmin / 2) * px);
  const b = Math.max(1.5, ((o.minorArcmin ?? o.majorArcmin) / 2) * px);
  const ratio = o.majorArcmin / FULL_MOON_ARCMIN;
  return (
    <figure className="sky-size">
      <svg viewBox="0 0 340 200" role="img" aria-label={`${t.space.facts.size}: ${formatNumber(o.majorArcmin, 1)} minutos de arco; ${t.space.moonTimes(formatNumber(ratio, 2))}`}>
        <circle cx={90} cy={100} r={moonR} fill="#d8d4c8" opacity="0.85" />
        <text x={90} y={190} textAnchor="middle" className="size-label">
          Lua cheia
        </text>
        <ellipse cx={250} cy={100} rx={a} ry={b} fill={SUBTYPE_COLOR[o.subtype]} opacity="0.55" transform="rotate(-25 250 100)" />
        <ellipse cx={250} cy={100} rx={a} ry={b} fill="none" stroke={SUBTYPE_COLOR[o.subtype]} strokeWidth="1.2" transform="rotate(-25 250 100)" />
        <text x={250} y={190} textAnchor="middle" className="size-label">
          M{o.m}
        </text>
      </svg>
      <figcaption className="section-note">
        Tamanho no céu à mesma escala que a Lua cheia (cerca de 31′). A forma e a orientação são ilustrativas.
      </figcaption>
    </figure>
  );
}

function rows(o: DeepSkyObject, t: ReturnType<typeof useI18n>['t']): FactRow[] {
  const OPEN = 'OpenNGC';
  const NASA = 'NASA (Hubble)';
  const nasaUrl = o.hasNasaPage ? nasaHubblePage(o.m) : undefined;
  const out: FactRow[] = [
    { label: t.space.facts.type, value: t.space.subtypes[o.subtype], kind: 'measured', source: OPEN },
    { label: t.space.facts.constellation, value: constellationName(o.constellation), kind: 'measured', source: OPEN },
  ];
  if (o.distanceLy) {
    const gaia = o.distanceSource === 'gaia-cg2020';
    out.push({
      label: t.space.facts.distance,
      value: `${o.distanceApprox || gaia ? '≈ ' : ''}${formatLightYears(o.distanceLy)}`,
      kind: 'measured',
      note: gaia ? t.space.notes.distanceGaia : t.space.notes.distance,
      source: gaia ? 'Gaia (Cantat-Gaudin et al. 2020)' : NASA,
      sourceUrl: gaia ? 'https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/A+A/640/A1' : nasaUrl,
    });
    out.push({
      label: t.space.facts.lightTravel,
      value: formatLightYears(o.distanceLy).replace('anos-luz', 'anos'),
      kind: 'derived',
      note: t.space.notes.lightTravel,
      source: 'Calculado nesta aplicação',
    });
  }
  if (o.mag !== undefined) {
    out.push({
      label: t.space.facts.mag,
      value: formatNumber(o.mag, 1),
      kind: 'measured',
      note: o.magSource === 'nasa' ? t.space.notes.magNasa : t.space.notes.magOpen,
      source: o.magSource === 'nasa' ? NASA : OPEN,
      sourceUrl: o.magSource === 'nasa' ? nasaUrl : undefined,
    });
  }
  if (o.majorArcmin) {
    out.push({
      label: t.space.facts.size,
      value: `${formatNumber(o.majorArcmin, o.majorArcmin < 10 ? 1 : 0)}′${o.minorArcmin ? ` × ${formatNumber(o.minorArcmin, o.minorArcmin < 10 ? 1 : 0)}′` : ''}`,
      secondary: t.space.moonTimes(formatNumber(o.majorArcmin / FULL_MOON_ARCMIN, 2)),
      kind: 'measured',
      note: t.space.notes.size,
      source: OPEN,
    });
  }
  const phys = physicalSizeLy(o);
  if (phys) {
    out.push({
      label: t.space.facts.physical,
      value: `≈ ${formatLightYears(phys >= 1000 ? Math.round(phys / 100) * 100 : Math.round(phys))}`,
      kind: 'derived',
      note: t.space.notes.physical,
      source: 'Calculado nesta aplicação',
    });
  }
  if (o.hubbleType) out.push({ label: t.space.facts.hubble, value: o.hubbleType, kind: 'measured', source: OPEN });
  out.push({ label: t.space.facts.ra, value: formatRa(o.ra), kind: 'measured', source: OPEN });
  out.push({ label: t.space.facts.dec, value: formatDec(o.dec), kind: 'measured', source: OPEN });
  if (o.season) out.push({ label: t.space.facts.season, value: o.season, kind: 'average', note: t.space.notes.season, source: NASA, sourceUrl: nasaUrl });
  return out;
}

function ObjectView({ o, all }: { o: DeepSkyObject; all: DeepSkyObject[] }) {
  const { t } = useI18n();
  const name = displayName(o);
  const prev = all.find((x) => x.m === o.m - 1);
  const next = all.find((x) => x.m === o.m + 1);
  const query = useMemo(
    () => ({ q: `Messier ${o.m}`, mustInclude: [`m${o.m}`, `messier ${o.m}`, ...(o.nameEn ? [o.nameEn.replace(/^The /, '').toLowerCase()] : [])] }),
    [o.m, o.nameEn],
  );

  const focus = useMemo(() => ({ ra: o.ra, dec: o.dec, zoom: 5 }), [o.ra, o.dec]);
  useEffect(() => {
    document.title = `${name} — ${t.nav.deepSpace} — Universe Infinity`;
  }, [name, t]);

  return (
    <article className="exo-detail dso-detail">
      <header className="exo-hero">
        <div className="exo-hero-text">
          <a className="back-link" href={href({ name: 'deep-sky' })}>
            <Icon name="back" size={16} />
            {t.nav.deepSpace}
          </a>
          <p className="body-kicker">{t.space.subtypes[o.subtype]}</p>
          <h1 className="body-name">{name}</h1>
          <p className="exo-alt">
            {o.namePt ? `M${o.m}` : ''}
            {o.catalogId ? `${o.namePt ? ' · ' : ''}${o.catalogId}` : ''}
            {o.nameEn && !o.namePt ? ` · ${o.nameEn}` : ''}
          </p>
          <p className="body-tagline">
            {constellationName(o.constellation)}
            {o.distanceLy ? ` · ${formatLightYears(o.distanceLy)}` : ''}
          </p>
          {o.notePt ? (
            <p className="exo-summary">
              {o.notePt} <span className="quote-source">(NASA)</span>
            </p>
          ) : null}
          {o.m === 102 ? <p className="info-note">{t.space.m102}</p> : null}
          {!o.hasNasaPage ? <p className="section-note">{o.distanceLy ? t.space.noNasaPageGaia : t.space.noNasaPage}</p> : null}
        </div>
        <div className="exo-hero-orbit">
          <SkySize o={o} />
        </div>
      </header>

      <div className="body-content">
        <div className="body-main">
          <section className="body-section" aria-labelledby="dso-facts">
            <h2 id="dso-facts">{t.body.keyFacts}</h2>
            <FactRows rows={rows(o, t)} />
          </section>
          <section className="body-section" aria-labelledby="dso-where">
            <h2 id="dso-where">{t.space.skyMap.whereTitle}</h2>
            <p className="section-note">{t.space.whereNote(constellationName(o.constellation))}</p>
            <SkyMap objects={all} highlightId={o.id} focus={focus} compact />
          </section>
          <NasaGallery query={query} note={t.space.galleryNote} />
        </div>
        <aside className="body-aside">
          <section className="body-section" aria-labelledby="dso-sources">
            <h2 id="dso-sources">{t.body.sources}</h2>
            {o.hasNasaPage ? (
              <p>
                <a href={nasaHubblePage(o.m)} target="_blank" rel="noopener noreferrer">
                  {t.space.nasaPage}
                </a>
              </p>
            ) : null}
            <SourcesList ids={o.distanceSource === 'gaia-cg2020' ? ['openngc', 'cantat-gaudin-2020'] : ['openngc', 'nasa-hubble-messier']} />
          </section>
          <nav className="dso-pager" aria-label="Objeto anterior e seguinte">
            {prev ? (
              <a className="btn btn--ghost btn--small" href={href({ name: 'deep-sky-object', id: prev.id })}>
                ← M{prev.m}
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a className="btn btn--ghost btn--small" href={href({ name: 'deep-sky-object', id: next.id })}>
                M{next.m} →
              </a>
            ) : null}
          </nav>
        </aside>
      </div>
    </article>
  );
}

export default function DeepSkyObjectPage({ id }: { id: string }) {
  const { t } = useI18n();
  const { state, retry } = useAsync(loadDeepSky);
  if (state.status !== 'ready') {
    return (
      <div className="page page--narrow">
        <LoadState state={state} retry={retry} loading={t.space.loading} error={t.space.loadError} retryLabel={t.space.retry} />
      </div>
    );
  }
  const o = state.value.find((x) => x.id === id.toLowerCase());
  if (!o) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t.notFound.title}</h1>
        <p>{t.body.notFound}</p>
        <a className="btn" href={href({ name: 'deep-sky' })}>
          {t.nav.deepSpace}
        </a>
      </div>
    );
  }
  return <ObjectView o={o} all={state.value} />;
}
