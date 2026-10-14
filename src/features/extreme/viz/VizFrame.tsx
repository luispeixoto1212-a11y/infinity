import type { ReactNode } from 'react';
import { Icon } from '../../../components/Icon';
import { useI18n } from '../../../i18n';

/** Moldura comum das visualizações: título, selo "calculado" ou "ilustração" e nota. */
export function VizFrame({
  title,
  kind,
  note,
  children,
  playing,
  onToggle,
}: {
  title: string;
  kind: 'calculated' | 'illustrative';
  note: string;
  children: ReactNode;
  playing?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useI18n();
  const tx = t.extreme;
  return (
    <figure className="viz">
      <figcaption className="viz-head">
        <span className="viz-title">{title}</span>
        <span className={`viz-kind viz-kind--${kind}`}>{kind === 'calculated' ? tx.calculated : tx.illustrative}</span>
        {onToggle ? (
          <button type="button" className="icon-btn icon-btn--small viz-play" onClick={onToggle} aria-label={playing ? tx.pause : tx.play}>
            <Icon name={playing ? 'pause' : 'play'} size={14} />
          </button>
        ) : null}
      </figcaption>
      {children}
      <p className="viz-note">{note}</p>
    </figure>
  );
}
