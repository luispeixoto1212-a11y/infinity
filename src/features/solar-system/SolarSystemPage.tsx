import { useState } from 'react';
import { href } from '../../app/router';
import { BodyThumb } from '../../components/BodyThumb';
import { Icon } from '../../components/Icon';
import { formatNumber } from '../../core/format';
import { MOON_BODIES, PRIMARY_BODIES, findBodyById, getBody, getFact, numericFact, tr } from '../../data/catalog';
import type { CelestialBody } from '../../data/types';
import { useI18n } from '../../i18n';

const AU_KM = 149_597_870.7;

function distanceText(b: CelestialBody): string {
  if (b.id === 'sun') return '—';
  if (b.type === 'moon') {
    const d = numericFact(b, 'distanceEarth');
    return d ? `${formatNumber(d * 1e6, 0)} km da Terra` : '—';
  }
  const mkm = numericFact(b, 'meanDistanceSun');
  if (mkm) return `${formatNumber((mkm * 1e6) / AU_KM, mkm > 1000 ? 1 : 2)} UA`;
  const au = numericFact(b, 'semiMajorAxisAu');
  return au ? `${formatNumber(au, 2)} UA` : '—';
}

function yearText(b: CelestialBody): string {
  if (b.type === 'star' || b.type === 'moon') return '—';
  const d = numericFact(b, 'orbitalPeriod');
  if (!d) return '—';
  return d < 700 ? `${formatNumber(d, 0)} dias` : `${formatNumber(d / 365.25, 1)} anos`;
}

function diameterKm(b: CelestialBody): number {
  return numericFact(b, 'diameter') ?? b.meanRadiusKm * 2;
}

function ListView() {
  const { t } = useI18n();
  return (
    <div className="table-scroll">
      <table className="data-table system-table">
        <thead>
          <tr>
            <th scope="col">{t.solarSystem.columns.name}</th>
            <th scope="col">{t.solarSystem.columns.type}</th>
            <th scope="col" className="num">
              {t.solarSystem.columns.distance}
            </th>
            <th scope="col" className="num">
              {t.solarSystem.columns.diameter}
            </th>
            <th scope="col" className="num">
              {t.solarSystem.columns.year}
            </th>
            <th scope="col" className="num">
              {t.solarSystem.columns.moons}
            </th>
          </tr>
        </thead>
        <tbody>
          {PRIMARY_BODIES.map((b) => {
            const dia = getFact(b, 'diameter');
            return (
              <tr key={b.id}>
                <th scope="row">
                  <a className="system-name" href={href({ name: 'body', slug: b.slug })}>
                    <BodyThumb body={b} size={b.type === 'star' ? 34 : 28} />
                    <span>{tr(b.name)}</span>
                  </a>
                </th>
                <td>{t.categories[b.type]}</td>
                <td className="num">{distanceText(b)}</td>
                <td className="num">
                  {dia?.qualifier ? `${dia.qualifier} ` : ''}
                  {formatNumber(diameterKm(b), 0)} km
                </td>
                <td className="num">{yearText(b)}</td>
                <td className="num">{b.moons ? b.moons.count : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MoonsTable() {
  const { t } = useI18n();
  const c = t.solarSystem.moonColumns;
  return (
    <section className="body-section moons-section" aria-labelledby="moons-title">
      <h2 id="moons-title">{t.solarSystem.moonsTitle}</h2>
      <p className="section-note">{t.solarSystem.moonsIntro}</p>
      <div className="table-scroll">
        <table className="data-table system-table">
          <thead>
            <tr>
              <th scope="col">{c.name}</th>
              <th scope="col">{c.parent}</th>
              <th scope="col" className="num">{c.distance}</th>
              <th scope="col" className="num">{c.diameter}</th>
              <th scope="col" className="num">{c.period}</th>
            </tr>
          </thead>
          <tbody>
            {MOON_BODIES.map((m) => {
              const parent = m.parent ? findBodyById(m.parent) : undefined;
              const dist = numericFact(m, 'distancePlanet') ?? (numericFact(m, 'distanceEarth') ?? 0) * 1e6;
              const period = numericFact(m, 'orbitalPeriod');
              return (
                <tr key={m.id}>
                  <th scope="row">
                    <a className="system-name system-name--small" href={href({ name: 'body', slug: m.slug })}>
                      <BodyThumb body={m} size={24} />
                      <span>{tr(m.name)}</span>
                    </a>
                  </th>
                  <td>{parent ? tr(parent.name) : '—'}</td>
                  <td className="num">{formatNumber(dist, 0)} km</td>
                  <td className="num">{formatNumber(diameterKm(m), diameterKm(m) < 100 ? 1 : 0)} km</td>
                  <td className="num">{period ? `${formatNumber(period, 2)} dias` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Diâmetros à mesma escala; o Sol aparece como um arco à esquerda. */
function SizeView() {
  const { t } = useI18n();
  const items = PRIMARY_BODIES.filter((b) => b.type !== 'star').flatMap((b) => (b.id === 'earth' ? [b, getBody('moon')] : [b]));
  const sun = getBody('sun');
  const pxPerKm = 150 / diameterKm(getBody('jupiter'));
  const sunR = (diameterKm(sun) / 2) * pxPerKm;
  const gap = 18;
  let x = 70;
  const placed = items.map((b) => {
    const r = Math.max((diameterKm(b) / 2) * pxPerKm, 0.6);
    // Reserva espaço para a etiqueta, para os nomes dos corpos pequenos não se sobreporem
    const half = Math.max(r, (tr(b.name).length * 7 + 8) / 2);
    const cx = x + half;
    x = cx + half + gap;
    return { b, r, cx };
  });
  const width = x + 20;
  const height = 240;
  const cy = 118;

  return (
    <figure className="size-figure">
      <div className="size-scroll" tabIndex={0} role="region" aria-label="Comparação de tamanhos (deslizar na horizontal)">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Diâmetros dos planetas, planetas anões e Lua à mesma escala, com o arco do Sol à esquerda.">
          <defs>
            <radialGradient id="sun-arc" cx="1" cy="0.5" r="1">
              <stop offset="0" stopColor="#ffd98a" />
              <stop offset="1" stopColor="#ff9f43" />
            </radialGradient>
          </defs>
          <circle cx={46 - sunR} cy={cy + 10} r={sunR} fill="url(#sun-arc)" opacity="0.9" />
          <text x={6} y={22} className="size-label" style={{ fill: '#3b2a10', fontWeight: 600 }}>
            {tr(sun.name)}
          </text>
          {placed.map(({ b, r, cx }) => (
            <g key={b.id}>
              <a href={href({ name: 'body', slug: b.slug })} aria-label={tr(b.name)}>
                <circle cx={cx} cy={cy} r={r} fill={b.render.accent} />
                {r < 3 ? <circle cx={cx} cy={cy} r={6} fill="none" stroke={b.render.accent} strokeOpacity="0.6" /> : null}
              </a>
              <text x={cx} y={cy + Math.max(r, 6) + 18} textAnchor="middle" className="size-label">
                {tr(b.name)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="section-note">
        {t.solarSystem.sizeNote} Os anéis não estão representados. Objetos com menos de 3 píxeis aparecem assinalados por um círculo.
      </figcaption>
    </figure>
  );
}

export function SolarSystemPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<'list' | 'size'>('list');
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">{t.solarSystem.title}</h1>
        <p className="page-lede">{t.solarSystem.intro}</p>
        <div className="segmented" role="tablist" aria-label="Modo de visualização">
          {(['list', 'size'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? 'is-active' : undefined}
              onClick={() => setMode(m)}
            >
              {t.solarSystem.viewModes[m]}
            </button>
          ))}
        </div>
      </header>
      <div role="tabpanel">
        {mode === 'list' ? (
          <>
            <ListView />
            <MoonsTable />
          </>
        ) : (
          <SizeView />
        )}
      </div>
      <section className="body-section sb-promo" aria-labelledby="ss-small">
        <h2 id="ss-small">{t.smallBodies.title}</h2>
        <p>{t.smallBodies.lede}</p>
        <a className="btn" href={href({ name: 'small-bodies' })}>
          <Icon name="comet" size={16} />
          {t.smallBodies.title}
        </a>
      </section>
    </div>
  );
}
