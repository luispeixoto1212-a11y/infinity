import { useEffect } from 'react';
import { href } from '../../app/router';
import { FactRows, type FactRow } from '../../components/FactRows';
import { Icon } from '../../components/Icon';
import { LoadState } from '../../components/LoadState';
import { SourcesList } from '../../components/SourcesList';
import { useAsync } from '../../components/useAsync';
import { formatNumber, formatSignificant } from '../../core/format';
import { constellationLatin, constellationName } from '../../data/constellations';
import { useI18n } from '../../i18n';
import { formatDec, formatRa } from '../deepsky/deepSkyData';
import { HrDiagram } from './HrDiagram';
import {
  colorFromBv,
  lightYearsFromPc,
  loadHrDiagram,
  loadStars,
  temperatureFromColor,
  visualLuminosity,
  type Star,
} from './starData';
import { describeSpectralType, formatStarDistance } from './starView';

const SOURCE = 'AT-HYG v3.2';
const CALC = 'Calculado nesta aplicação';

function distanceNote(s: Star, t: ReturnType<typeof useI18n>['t']): string {
  switch (s.distSource) {
    case 'gaia-dr3':
    case 'gaia-dr2':
      return t.space.starNotes.gaia;
    case 'hipparcos':
      return t.space.starNotes.hipparcos;
    case 'gliese':
      return t.space.starNotes.gliese;
    default:
      return t.space.starNotes.other;
  }
}

export function starRows(s: Star, t: ReturnType<typeof useI18n>['t']): FactRow[] {
  const rows: FactRow[] = [];
  if (s.designation && s.designation !== s.name) rows.push({ label: t.space.starFacts.designation, value: s.designation, kind: 'measured', source: SOURCE });
  if (s.constellation) {
    rows.push({
      label: t.space.starFacts.constellation,
      value: constellationName(s.constellation),
      secondary: constellationLatin(s.constellation) !== constellationName(s.constellation) ? constellationLatin(s.constellation) : undefined,
      kind: 'measured',
      source: SOURCE,
    });
  }
  if (s.distPc !== undefined) {
    rows.push({
      label: t.space.starFacts.distance,
      value: formatStarDistance(s),
      secondary: `${formatSignificant(s.distPc, 4)} parsecs`,
      kind: 'measured',
      note: distanceNote(s, t),
      source: SOURCE,
    });
  }
  if (s.mag !== undefined) rows.push({ label: t.space.starFacts.mag, value: formatNumber(s.mag, 2), kind: 'measured', source: SOURCE });
  if (s.absMag !== undefined) {
    rows.push({ label: t.space.starFacts.absMag, value: formatNumber(s.absMag, 2), kind: 'measured', note: t.space.starNotes.absMag, source: SOURCE });
  }
  if (s.spectralType) {
    rows.push({
      label: t.space.starFacts.spect,
      value: s.spectralType,
      secondary: describeSpectralType(s.spectralType, t.space.spectralClasses, t.space.luminosityClasses),
      kind: 'measured',
      source: SOURCE,
    });
  }
  if (s.colorIndex !== undefined) {
    rows.push({ label: t.space.starFacts.color, value: formatNumber(s.colorIndex, 2), kind: 'measured', note: t.space.starNotes.color, source: SOURCE });
    const temp = temperatureFromColor(s.colorIndex);
    if (temp !== undefined) {
      rows.push({
        label: t.space.starFacts.temperature,
        value: `≈ ${formatNumber(Math.round(temp / 100) * 100, 0)} K`,
        kind: 'estimate',
        note: t.space.starNotes.temperature,
        source: CALC,
      });
    }
  }
  if (s.absMag !== undefined) {
    const lum = visualLuminosity(s.absMag);
    rows.push({
      label: t.space.starFacts.luminosity,
      value: t.space.sunTimes(lum >= 100 ? formatNumber(Math.round(lum), 0) : formatSignificant(lum, 2)),
      kind: 'derived',
      note: t.space.starNotes.luminosity,
      source: CALC,
    });
  }
  if (s.radialVelocity !== undefined && s.radialVelocity !== 0) {
    rows.push({ label: t.space.starFacts.rv, value: `${formatNumber(s.radialVelocity, 1)} km/s`, kind: 'measured', note: t.space.starNotes.rv, source: SOURCE });
  }
  if (s.ra !== undefined) rows.push({ label: t.space.starFacts.ra, value: formatRa(s.ra), kind: 'measured', source: SOURCE });
  if (s.dec !== undefined) rows.push({ label: t.space.starFacts.dec, value: formatDec(s.dec), kind: 'measured', source: SOURCE });
  const catalogs = [s.hip ? `HIP ${s.hip}` : '', s.hd ? `HD ${s.hd}` : '', s.hr ? `HR ${s.hr}` : '', s.gliese ?? ''].filter(Boolean).join(' · ');
  if (catalogs) rows.push({ label: t.space.starFacts.catalogs, value: catalogs, kind: 'measured', source: SOURCE });
  return rows;
}

function StarHr({ s }: { s: Star }) {
  const { t } = useI18n();
  const { state, retry } = useAsync(loadHrDiagram);
  if (s.colorIndex === undefined || s.absMag === undefined) return null;
  return (
    <section className="body-section" aria-labelledby="star-hr">
      <h2 id="star-hr">{t.space.hrTitle}</h2>
      <p className="section-note">{t.space.hrStarNote(s.name)}</p>
      <LoadState state={state} retry={retry} loading={t.space.loading} error={t.space.loadError} retryLabel={t.space.retry} />
      {state.status === 'ready' ? <HrDiagram points={state.value} highlight={{ label: s.name, bv: s.colorIndex, absMag: s.absMag }} height={380} /> : null}
    </section>
  );
}

function StarView({ s }: { s: Star }) {
  const { t } = useI18n();
  const kind = describeSpectralType(s.spectralType, t.space.spectralClasses, t.space.luminosityClasses);
  useEffect(() => {
    document.title = `${s.name} — ${t.space.starsTitle} — Universe Infinity`;
  }, [s.name, t]);
  const ly = s.distPc !== undefined ? lightYearsFromPc(s.distPc) : undefined;

  return (
    <article className="exo-detail star-detail">
      <header className="exo-hero">
        <div className="exo-hero-text">
          <a className="back-link" href={href({ name: 'stars' })}>
            <Icon name="back" size={16} />
            {t.space.starsTitle}
          </a>
          <p className="body-kicker">{kind ?? t.categories['named-star']}</p>
          <h1 className="body-name">{s.name}</h1>
          {s.designation && s.designation !== s.name ? <p className="exo-alt">{s.designation}</p> : null}
          <p className="body-tagline">
            {s.constellation ? constellationName(s.constellation) : ''}
            {ly !== undefined ? `${s.constellation ? ' · ' : ''}${formatStarDistance(s)}` : ''}
          </p>
          {ly !== undefined ? <p className="exo-summary">{t.space.lightAgo(ly < 100 ? formatNumber(ly, 1) : formatNumber(Math.round(ly), 0))}</p> : null}
          {s.hip && s.mag !== undefined && s.mag <= 6 ? (
            <p className="body-actions">
              <a className="btn btn--ghost btn--small" href={href({ name: 'planetarium', target: s.slug })}>
                <Icon name="sky" size={15} />
                {t.body.viewInSky}
              </a>
            </p>
          ) : null}
        </div>
        <div className="exo-hero-orbit">
          <div className="star-orb" style={{ ['--star-color' as string]: colorFromBv(s.colorIndex) }} aria-hidden="true" />
          <p className="section-note star-orb-note">{t.space.starColorNote}</p>
        </div>
      </header>
      <div className="body-content">
        <div className="body-main">
          <section className="body-section" aria-labelledby="star-facts">
            <h2 id="star-facts">{t.body.keyFacts}</h2>
            <FactRows rows={starRows(s, t)} />
          </section>
          <StarHr s={s} />
        </div>
        <aside className="body-aside">
          <section className="body-section" aria-labelledby="star-sources">
            <h2 id="star-sources">{t.body.sources}</h2>
            <SourcesList ids={['athyg']} />
          </section>
        </aside>
      </div>
    </article>
  );
}

export default function StarPage({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { state, retry } = useAsync(loadStars);
  if (state.status !== 'ready') {
    return (
      <div className="page page--narrow">
        <LoadState state={state} retry={retry} loading={t.space.loading} error={t.space.loadError} retryLabel={t.space.retry} />
      </div>
    );
  }
  const s = state.value.find((x) => x.slug === slug.toLowerCase());
  if (!s) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t.notFound.title}</h1>
        <p>{t.space.starNotFound}</p>
        <a className="btn" href={href({ name: 'stars' })}>
          {t.space.starsTitle}
        </a>
      </div>
    );
  }
  return <StarView s={s} />;
}
