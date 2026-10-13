import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { closeShortcuts, useUi } from '../state/ui';
import { Icon } from './Icon';

export function ShortcutsDialog() {
  const { t } = useI18n();
  const { shortcutsOpen } = useUi();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (shortcutsOpen && !d.open) d.showModal();
    else if (!shortcutsOpen && d.open) d.close();
  }, [shortcutsOpen]);

  return (
    <dialog
      ref={ref}
      className="sheet-dialog"
      aria-labelledby="shortcuts-title"
      onClose={closeShortcuts}
      onClick={(e) => {
        if (e.target === ref.current) closeShortcuts();
      }}
    >
      <div className="sheet-dialog-inner">
        <div className="sheet-dialog-head">
          <h2 id="shortcuts-title">{t.shortcuts.title}</h2>
          <button type="button" className="icon-btn" onClick={closeShortcuts} aria-label={t.shortcuts.close}>
            <Icon name="close" />
          </button>
        </div>
        <dl className="shortcut-list">
          {t.shortcuts.items.map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}
