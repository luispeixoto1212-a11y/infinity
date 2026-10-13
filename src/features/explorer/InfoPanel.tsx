import { useEffect, useRef } from 'react';
import { Icon } from '../../components/Icon';
import { FavoriteButton } from '../../components/FavoriteButton';
import { formatNumber } from '../../core/format';
import { getFact, tr } from '../../data/catalog';
import type { CelestialBody, FactKey } from '../../data/types';
import { useI18n } from '../../i18n';
import { href } from '../../app/router';
import { formatDurationSeconds, formatFact } from '../body/formatFact';
import type { LiveInfo } from './engine/SolarSystemEngine';

const PANEL_FACTS: FactKey[] = ['diameter', 'mass', 'gravity', 'dayLength', 'siderealRotation', 'orbitalPeriod', 'meanTemperature'];
const AU_KM = 149_597_870.7;
const C_KM_S = 299_792.458;

interface Props {
  body: CelestialBody;
  live: LiveInfo | null;
  onClose(): void;
  onFocus(): void;
}

export function InfoPanel({ body, live, onClose, onFocus }: Props) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [body.id]);

  // Duração do dia e rotação sideral: mostra só uma (prioridade ao dia solar)
  const keys = PANEL_FACTS.filter((k) => !(k === 'siderealRotation' && getFact(body, 'dayLength')));
  const facts = keys.map((k) => getFact(body, k)).filter((f): f is NonNullable<typeof f> => Boolean(f));

  return (
    <aside className="info-panel" aria-labelledby="info-title">
      <div className="info-head">
        <div>
          <p className="info-type">{t.categories[body.type]}</p>
          <h2 id="info-title" ref={headingRef} tabIndex={-1}>
            {tr(body.name)}
          </h2>
        </div>
        <div className="info-head-actions">
          <FavoriteButton id={body.id} />
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.panel.close}>
            <Icon name="close" />
          </button>
        </div>
      </div>
      <p className="info-tagline">{tr(body.tagline)}</p>

      {live ? (
        <dl className="live-facts">
          {body.id !== 'sun' ? (
            <div>
              <dt>{t.panel.distanceSun}</dt>
              <dd>
                {formatNumber(live.distanceSunAu, 3, 3)} UA
                <span className="secondary">≈ {formatNumber((live.distanceSunAu * AU_KM) / 1e6, 1)} milhões de km</span>
              </dd>
            </div>
          ) : null}
          {body.id !== 'earth' ? (
            <div>
              <dt>{t.panel.distanceEarth}</dt>
              <dd>
                {body.id === 'moon'
                  ? `${formatNumber(live.distanceEarthAu * AU_KM, 0)} km`
                  : `${formatNumber(live.distanceEarthAu, 3, 3)} UA`}
                <span className="secondary">
                  {t.panel.lightTime} {formatDurationSeconds((live.distanceEarthAu * AU_KM) / C_KM_S)}
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <dl className="info-facts">
        {facts.map((f) => {
          const ff = formatFact(f);
          return (
            <div key={f.key}>
              <dt>{t.facts[f.key]}</dt>
              <dd>
                {ff.text}
                {ff.secondary ? <span className="secondary">{ff.secondary}</span> : null}
              </dd>
            </div>
          );
        })}
      </dl>

      {body.render.visualNote ? (
        <p className="info-note">
          <Icon name="info" size={16} />
          <span>{tr(body.render.visualNote)}</span>
        </p>
      ) : null}

      <div className="info-actions">
        <a className="btn" href={href({ name: 'body', slug: body.slug })}>
          {t.panel.openPage}
        </a>
        <button type="button" className="btn btn--ghost" onClick={onFocus}>
          <Icon name="recenter" size={16} />
          {t.panel.focus}
        </button>
      </div>
    </aside>
  );
}
