import { Icon } from '../../components/Icon';
import { formatDateTime } from '../../core/format';
import { dateToJulianDayTdb, julianDayTdbToDate } from '../../core/astro/time';
import { useI18n } from '../../i18n';
import { SPEEDS } from './timeControl';

interface Props {
  jd: number;
  paused: boolean;
  clamped: boolean;
  speedIndex: number;
  speedLabel: string;
  direction: 1 | -1;
  onTogglePause(): void;
  onSlower(): void;
  onFaster(): void;
  onReverse(): void;
  onNow(): void;
}

export function TimeDock(p: Props) {
  const { t } = useI18n();
  const date = julianDayTdbToDate(p.jd);
  const offsetMinutes = Math.abs(p.jd - dateToJulianDayTdb(new Date())) * 1440;
  const isNow = offsetMinutes < 2 && p.speedIndex === 0 && p.direction === 1 && !p.paused;

  return (
    <section className="time-dock" aria-label={t.explorer.simulatedTime}>
      <div className="time-readout">
        <span className="time-label">{isNow ? 'Agora' : t.explorer.simulatedTime}</span>
        <time dateTime={date.toISOString()} className="time-value" aria-live="off">
          {formatDateTime(date)}
        </time>
      </div>

      <div className="time-controls" role="group" aria-label={t.explorer.speed}>
        <button
          type="button"
          className="icon-btn"
          onClick={p.onSlower}
          disabled={p.speedIndex === 0}
          aria-label={t.explorer.slower}
          title={`${t.explorer.slower} ([)`}
        >
          <Icon name="slower" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--primary"
          onClick={p.onTogglePause}
          aria-label={p.paused ? t.explorer.play : t.explorer.pause}
          title={`${p.paused ? t.explorer.play : t.explorer.pause} (Espaço)`}
        >
          <Icon name={p.paused ? 'play' : 'pause'} filled={p.paused} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={p.onFaster}
          disabled={p.speedIndex === SPEEDS.length - 1}
          aria-label={t.explorer.faster}
          title={`${t.explorer.faster} (])`}
        >
          <Icon name="faster" />
        </button>
        <output className="speed-readout" aria-live="polite">
          {p.direction === -1 ? '−' : ''}
          {p.speedLabel}
        </output>
        <button
          type="button"
          className={`icon-btn${p.direction === -1 ? ' is-on' : ''}`}
          onClick={p.onReverse}
          aria-pressed={p.direction === -1}
          aria-label={t.explorer.reverse}
          title={t.explorer.reverse}
        >
          <Icon name="reverse" />
        </button>
        <button type="button" className="btn btn--small btn--ghost" onClick={p.onNow} title={t.explorer.nowHint}>
          <Icon name="now" size={16} />
          {t.explorer.now}
        </button>
      </div>
    </section>
  );
}
