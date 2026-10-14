import { useMemo } from 'react';
import type { SkyBodyId } from '../../core/astro/sky';
import { formatNumber } from '../../core/format';
import { constellationName } from '../../data/constellations';
import { useI18n } from '../../i18n';
import { type Place, formatClock } from './places';
import { BODY_COLORS, BODY_NAMES_PT } from './skyRenderer';
import type { SkyScene } from './skyScene';
import { type NightReport, type SkyInstant, compassPoint, jdToDate, upcomingMoonPhases } from './skyState';

export interface TonightPanelProps {
  inst: SkyInstant;
  night: NightReport;
  place: Place;
  scene: SkyScene | null;
  onPick: (id: SkyBodyId) => void;
}

const ROWS: SkyBodyId[] = ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

export function TonightPanel({ inst, night, place, scene, onPick }: TonightPanelProps) {
  const { t } = useI18n();
  const tt = t.planetarium.tonight;
  const clock = (jd: number | null) => (jd === null ? '—' : formatClock(jdToDate(jd), place.timeZone));
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: place.timeZone }),
    [place.timeZone],
  );
  // As fases só mudam de dia para dia: recalcula-se com a data arredondada à hora
  const hourKey = Math.floor(inst.jdUt * 24);
  const phases = useMemo(() => upcomingMoonPhases(hourKey / 24), [hourKey]);
  const moon = inst.bodies.find((b) => b.id === 'moon')!;

  return (
    <section className="tonight" aria-labelledby="tonight-title">
      <h2 id="tonight-title" className="section-title">
        {tt.title}
      </h2>
      <div className="tonight-grid">
        <div className="tonight-card">
          <dl className="tonight-facts">
            <div>
              <dt>{tt.sunset}</dt>
              <dd>{clock(night.sunset)}</dd>
            </div>
            <div>
              <dt>{tt.sunrise}</dt>
              <dd>{clock(night.sunrise)}</dd>
            </div>
            {night.darkFrom !== null && night.darkTo !== null ? (
              <div>
                <dt>{tt.darkness}</dt>
                <dd>
                  {clock(night.darkFrom)}–{clock(night.darkTo)}
                </dd>
              </div>
            ) : null}
          </dl>
          {night.polarNight ? <p className="section-note">{tt.polarNight}</p> : null}
          {night.noDarkness ? <p className="section-note">{tt.noDarkness}</p> : null}
          {!night.noDarkness && !night.polarNight && night.darkFrom === null ? <p className="section-note">{tt.noAstroDark}</p> : null}
        </div>
        <div className="tonight-card">
          <h3 className="tonight-sub">{tt.moon}</h3>
          <p className="tonight-moon">
            <strong>{t.planetarium.phases[inst.moonPhase]}</strong> · {formatNumber(moon.illuminatedFraction * 100, 0)} %
          </p>
          <h4 className="tonight-sub tonight-sub--small">{tt.nextPhases}</h4>
          <ul className="tonight-phases">
            {phases.map((p) => (
              <li key={p.phase}>
                <span>{t.planetarium.phases[p.phase]}</span>
                <span>{dateFmt.format(p.date)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <h3 className="tonight-sub">{tt.planets}</h3>
      <div className="table-scroll">
        <table className="data-table tonight-table">
          <thead>
            <tr>
              <th scope="col">{tt.colBody}</th>
              <th scope="col">{tt.colNow}</th>
              <th scope="col" className="num">
                {tt.colMag}
              </th>
              <th scope="col">{tt.colCon}</th>
              <th scope="col">{tt.colWindow}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((id) => {
              const b = inst.bodies.find((x) => x.id === id)!;
              const w = night.windows[id];
              const con = scene?.locator.find(b.raDeg, b.decDeg);
              return (
                <tr key={id}>
                  <th scope="row">
                    <button type="button" className="tonight-body" onClick={() => onPick(id)}>
                      <span className="tonight-dot" style={{ background: BODY_COLORS[id] }} aria-hidden="true" />
                      {BODY_NAMES_PT[id]}
                    </button>
                  </th>
                  <td>{b.apparentAltDeg > 0 ? tt.up(formatNumber(b.apparentAltDeg, 0), compassPoint(b.azDeg).long) : tt.down}</td>
                  <td className="num">{formatNumber(b.magnitude, 1)}</td>
                  <td>{con ? constellationName(con) : '—'}</td>
                  <td>
                    {w ? (
                      <>
                        {w.to - w.from < 0.02 ? tt.around(clock(w.from)) : tt.window(clock(w.from), clock(w.to))}
                        <span className="tonight-best"> · {tt.best(clock(w.bestJd), formatNumber(w.bestAltDeg, 0))}</span>
                      </>
                    ) : (
                      <span className="tonight-none">{tt.notVisible}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="section-note">{tt.method}</p>
    </section>
  );
}
