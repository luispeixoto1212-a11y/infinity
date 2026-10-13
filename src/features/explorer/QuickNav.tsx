import { BodyThumb } from '../../components/BodyThumb';
import { Icon } from '../../components/Icon';
import { BODIES, tr } from '../../data/catalog';
import type { BodyId } from '../../data/types';
import { useI18n } from '../../i18n';

interface Props {
  selected: BodyId | null;
  onSelect(id: BodyId): void;
  open: boolean;
  onClose(): void;
}

export function QuickNav({ selected, onSelect, open, onClose }: Props) {
  const { t } = useI18n();
  return (
    <nav className={`quick-nav${open ? ' is-open' : ''}`} aria-label={t.explorer.quickNav}>
      <div className="quick-nav-head">
        <h2>{t.explorer.objects}</h2>
        <button type="button" className="icon-btn icon-btn--small quick-nav-close" onClick={onClose} aria-label={t.panel.close}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <ul>
        {BODIES.map((b) => (
          <li key={b.id} className={b.type === 'moon' ? 'is-child' : undefined}>
            <button
              type="button"
              className={selected === b.id ? 'is-selected' : undefined}
              aria-current={selected === b.id ? 'true' : undefined}
              onClick={() => onSelect(b.id)}
            >
              <BodyThumb body={b} size={22} />
              <span>{tr(b.name)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
