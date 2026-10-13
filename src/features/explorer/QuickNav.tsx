import { useEffect, useState } from 'react';
import { BodyThumb } from '../../components/BodyThumb';
import { Icon } from '../../components/Icon';
import { PRIMARY_BODIES, findBodyById, moonsOf, tr } from '../../data/catalog';
import type { BodyId, CelestialBody } from '../../data/types';
import { useI18n } from '../../i18n';

interface Props {
  selected: BodyId | null;
  onSelect(id: BodyId): void;
  open: boolean;
  onClose(): void;
}

export function QuickNav({ selected, onSelect, open, onClose }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<BodyId>>(new Set());

  // Ao selecionar uma lua (no espaço ou pela pesquisa), abre o grupo do seu planeta
  useEffect(() => {
    const parent = selected ? findBodyById(selected)?.parent : undefined;
    if (parent && parent !== 'sun') setExpanded((s) => (s.has(parent) ? s : new Set(s).add(parent)));
  }, [selected]);

  const toggle = (id: BodyId) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const item = (b: CelestialBody, child = false) => (
    <button
      type="button"
      className={`quick-nav-item${selected === b.id ? ' is-selected' : ''}${child ? ' is-child' : ''}`}
      aria-current={selected === b.id ? 'true' : undefined}
      onClick={() => onSelect(b.id)}
    >
      <BodyThumb body={b} size={child ? 18 : 22} />
      <span>{tr(b.name)}</span>
    </button>
  );

  return (
    <nav className={`quick-nav${open ? ' is-open' : ''}`} aria-label={t.explorer.quickNav}>
      <div className="quick-nav-head">
        <h2>{t.explorer.objects}</h2>
        <button type="button" className="icon-btn icon-btn--small quick-nav-close" onClick={onClose} aria-label={t.panel.close}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <ul>
        {PRIMARY_BODIES.map((b) => {
          const moons = moonsOf(b.id);
          const isOpen = expanded.has(b.id);
          return (
            <li key={b.id} className={moons.length > 0 && isOpen ? 'is-expanded' : undefined}>
              <div className="quick-nav-row">
                {item(b)}
                {moons.length > 0 ? (
                  <button
                    type="button"
                    className={`quick-nav-moons${isOpen ? ' is-open' : ''}`}
                    aria-expanded={isOpen}
                    aria-controls={`moons-${b.id}`}
                    aria-label={`${t.explorer.moonsToggle(moons.length)} de ${tr(b.name)}`}
                    onClick={() => toggle(b.id)}
                  >
                    {moons.length}
                    <Icon name="chevron" size={12} />
                  </button>
                ) : null}
              </div>
              {moons.length > 0 && isOpen ? (
                <ul id={`moons-${b.id}`} className="quick-nav-sub">
                  {moons.map((m) => (
                    <li key={m.id}>{item(m, true)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
