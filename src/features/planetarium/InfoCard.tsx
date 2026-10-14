import { useMemo } from 'react';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { type RiseSet, enuToHorizontal, refractionDeg } from '../../core/astro/sky';
import { mulMat3Vec } from '../../core/astro/precession';
import { radecToUnit } from '../../core/astro/orientation';
import { formatNumber } from '../../core/format';
import { constellationName } from '../../data/constellations';
import { findBodyById } from '../../data/catalog';
import { useI18n } from '../../i18n';
import { displayName, formatDec, formatLightYears, formatRa } from '../deepsky/deepSkyData';
import { type Place, formatClock } from './places';
import { BODY_NAMES_PT, type SelectionKey } from './skyRenderer';
import type { SkyScene } from './skyScene';
import { starDesignation } from './skyScene';
import { type SkyInstant, bodyRiseSet, compassPoint, fixedRiseSet, jdToDate } from './skyState';

const AU_KM = 149_597_870.7;

interface InfoRow {
  label: string;
  value: string;
}

export interface InfoCardProps {
  selection: SelectionKey;
  inst: SkyInstant;
  scene: SkyScene | null;
  place: Place;
  /** Início do dia civil local (JD UT) para o nascer e o ocaso. */
  dayStartJd: number;
  onClose: () => void;
  onCenter: () => void;
}

export function InfoCard({ selection, inst, scene, place, dayStartJd, onClose, onCenter }: InfoCardProps) {
  const { t } = useI18n();
  const ti = t.planetarium.info;
  const obs = inst.observer;

  const info = useMemo(() => {
    const rows: InfoRow[] = [];
    let title = '';
    let subtitle = '';
    let link: string | null = null;
    let enu: { x: number; y: number; z: number } | null = null;
    let raDeg = 0;
    let decDeg = 0;
    if (selection.kind === 'body') {
      const b = inst.bodies.find((x) => x.id === selection.id);
      if (!b) return null;
      title = BODY_NAMES_PT[b.id];
      subtitle = b.id === 'sun' ? ti.star : b.id === 'moon' ? t.planetarium.phases[inst.moonPhase] : ti.planet;
      const catalogBody = findBodyById(b.id);
      if (catalogBody) link = href({ name: 'body', slug: catalogBody.slug });
      enu = b.enu;
      raDeg = b.raDeg;
      decDeg = b.decDeg;
      rows.push({ label: ti.magnitude, value: formatNumber(b.magnitude, 1) });
      rows.push({
        label: ti.distance,
        value:
          b.id === 'moon'
            ? `${formatNumber(Math.round(b.topoDistanceKm), 0)} km`
            : `${formatNumber(b.topoDistanceKm / AU_KM, 3)} UA`,
      });
      if (b.id !== 'sun') {
        if (b.id === 'moon' || b.id === 'mercury' || b.id === 'venus' || b.id === 'mars') {
          rows.push({ label: ti.illumination, value: `${formatNumber(b.illuminatedFraction * 100, 0)} %` });
        }
        rows.push({ label: ti.elongation, value: `${formatNumber(b.elongationDeg, 1)}°` });
      }
      const d = b.diameterArcsec;
      rows.push({ label: ti.diameter, value: d >= 120 ? `${formatNumber(d / 60, 1)}′` : `${formatNumber(d, 1)}″` });
      if (b.id === 'saturn') rows.push({ label: ti.ringTilt, value: `${formatNumber(inst.saturnRingTiltDeg, 1)}°` });
    } else if (selection.kind === 'star' && scene) {
      const s = scene.stars;
      const i = selection.index;
      const name = s.name[i];
      const des = starDesignation(s.letter[i], s.con[i]);
      title = name ?? des ?? `HIP ${s.hip[i]}`;
      subtitle = name && des ? des : ti.star;
      raDeg = s.ra[i]!;
      decDeg = s.dec[i]!;
      enu = mulMat3Vec(inst.matrix, { x: s.x[i]!, y: s.y[i]!, z: s.z[i]! });
      rows.push({ label: ti.magnitude, value: formatNumber(s.mag[i]!, 2) });
      if (!Number.isNaN(s.bv[i]!)) rows.push({ label: 'B−V', value: formatNumber(s.bv[i]!, 2) });
      const slug = s.hip[i] ? scene.starPages.get(s.hip[i]!) : undefined;
      if (slug) link = href({ name: 'star', slug });
    } else if (selection.kind === 'dso' && scene) {
      const d = scene.dsos.find((o) => o.obj.id === selection.id);
      if (!d) return null;
      const o = d.obj;
      title = `M${o.m}${o.namePt ? ` · ${o.namePt}` : ''}`;
      subtitle = t.space.subtypes[o.subtype];
      raDeg = o.ra;
      decDeg = o.dec;
      enu = mulMat3Vec(inst.matrix, d.v);
      if (o.mag !== undefined) rows.push({ label: ti.magnitude, value: formatNumber(o.mag, 1) });
      if (o.distanceLy) rows.push({ label: ti.distance, value: formatLightYears(o.distanceLy) });
      if (o.majorArcmin) rows.push({ label: ti.diameter, value: `${formatNumber(o.majorArcmin, 1)}′` });
      link = href({ name: 'deep-sky-object', id: o.id });
      if (!o.namePt) title = displayName(o);
    }
    if (!enu) return null;
    const h = enuToHorizontal(enu);
    const apparent = h.altDeg + refractionDeg(h.altDeg);
    const con = scene?.locator.find(raDeg, decDeg);
    return { rows, title, subtitle, link, h, apparent, raDeg, decDeg, con };
  }, [selection, inst, scene, t, ti]);

  // Nascer e ocaso no dia civil local: só depende do dia e do lugar, não do instante exato
  const riseSet = useMemo<RiseSet | null>(() => {
    if (selection.kind === 'body') return bodyRiseSet(selection.id, dayStartJd, obs);
    if (!scene) return null;
    if (selection.kind === 'star') {
      const s = scene.stars;
      return fixedRiseSet({ x: s.x[selection.index]!, y: s.y[selection.index]!, z: s.z[selection.index]! }, dayStartJd, obs);
    }
    const d = scene.dsos.find((o) => o.obj.id === selection.id);
    return d ? fixedRiseSet(radecToUnit(d.obj.ra, d.obj.dec), dayStartJd, obs) : null;
    // obs muda de identidade a cada instante; o que importa são as coordenadas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, dayStartJd, obs.latDeg, obs.lonDeg, scene]);

  if (!info) return null;
  const clock = (jd: number | null) => (jd === null ? ti.noEvent : formatClock(jdToDate(jd), place.timeZone));
  const dir = compassPoint(info.h.azDeg);

  return (
    <section className="sky-info" aria-label={info.title}>
      <header className="sky-info-head">
        <div>
          <h2 className="sky-info-title">{info.title}</h2>
          <p className="sky-info-sub">{info.subtitle}</p>
        </div>
        <button type="button" className="icon-btn icon-btn--small" onClick={onClose} aria-label={ti.close}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <dl className="sky-info-rows">
        <div>
          <dt>{ti.altitude}</dt>
          <dd>
            {formatNumber(info.apparent, 1)}°{info.apparent < 0 ? ` (${ti.belowHorizon})` : ''}
          </dd>
        </div>
        <div>
          <dt>{ti.azimuth}</dt>
          <dd>
            {formatNumber(info.h.azDeg, 1)}° ({dir.long})
          </dd>
        </div>
        {info.rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
        {info.con ? (
          <div>
            <dt>{ti.constellation}</dt>
            <dd>{constellationName(info.con)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{ti.raDec}</dt>
          <dd>
            {formatRa(info.raDeg)} / {formatDec(info.decDeg)}
          </dd>
        </div>
        {riseSet ? (
          riseSet.alwaysUp ? (
            <div className="sky-info-wide">
              <dd>{ti.circumpolar}</dd>
            </div>
          ) : riseSet.alwaysDown ? (
            <div className="sky-info-wide">
              <dd>{ti.neverRises}</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>{ti.rise}</dt>
                <dd>{clock(riseSet.rise)}</dd>
              </div>
              <div>
                <dt>{ti.transit}</dt>
                <dd>
                  {clock(riseSet.transit)}
                  {riseSet.transit !== null ? ` (${formatNumber(riseSet.transitAltDeg, 0)}°)` : ''}
                </dd>
              </div>
              <div>
                <dt>{ti.set}</dt>
                <dd>{clock(riseSet.set)}</dd>
              </div>
            </>
          )
        ) : null}
      </dl>
      <p className="sky-info-note">{ti.refractionNote}</p>
      <div className="sky-info-actions">
        <button type="button" className="btn btn--small btn--ghost" onClick={onCenter}>
          <Icon name="recenter" size={15} />
          {ti.center}
        </button>
        {info.link ? (
          <a className="btn btn--small" href={info.link}>
            {ti.openPage}
          </a>
        ) : null}
      </div>
    </section>
  );
}
