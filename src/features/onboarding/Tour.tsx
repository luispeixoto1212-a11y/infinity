import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { navigate, type Route } from '../../app/router';
import { KindBadge } from '../../components/FactRows';
import { Icon, type IconName } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { closeTour, openSearch, useUi } from '../../state/ui';
import { markTourSeen } from '../../state/userData';

type StepId = 'welcome' | 'explore' | 'planetarium' | 'search' | 'sections' | 'data';

const ICONS: Record<StepId, IconName> = {
  welcome: 'star',
  explore: 'orbit',
  planetarium: 'sky',
  search: 'search',
  sections: 'list',
  data: 'info',
};

/** O que faz o botão de cada passo: abrir a secção (fecha a visita) ou a pesquisa. */
const ACTIONS: Partial<Record<StepId, Route | 'search'>> = {
  explore: { name: 'explore' },
  planetarium: { name: 'planetarium' },
  search: 'search',
  sections: { name: 'solar-system' },
  data: { name: 'data' },
};

/** Visita guiada opcional: seis passos curtos, navegáveis com o rato, o teclado (setas) ou o toque. */
export function Tour() {
  const { t } = useI18n();
  const tt = t.tour;
  const { tourOpen } = useUi();
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [i, setI] = useState(0);
  const steps = tt.steps;
  const step = steps[i]!;
  const id = step.id as StepId;
  const last = i === steps.length - 1;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (tourOpen && !d.open) {
      setI(0);
      d.showModal();
    } else if (!tourOpen && d.open) d.close();
  }, [tourOpen]);

  // O foco acompanha o título do passo, para os leitores de ecrã anunciarem o novo conteúdo
  useEffect(() => {
    if (tourOpen) headingRef.current?.focus();
  }, [i, tourOpen]);

  const close = () => {
    markTourSeen();
    closeTour();
  };

  const go = (n: number) => setI(Math.max(0, Math.min(steps.length - 1, n)));

  const runAction = () => {
    const action = ACTIONS[id];
    if (!action) return;
    close();
    if (action === 'search') openSearch();
    else navigate(action);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(i + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(i - 1);
    }
  };

  const action = 'action' in step ? step.action : undefined;

  return (
    <dialog
      ref={ref}
      className="sheet-dialog tour-dialog"
      aria-labelledby="tour-step-title"
      onClose={close}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="sheet-dialog-inner">
        <div className="sheet-dialog-head">
          <p className="tour-kicker">
            {tt.title} · {tt.step(i + 1, steps.length)}
          </p>
          <button type="button" className="icon-btn" onClick={close} aria-label={tt.close}>
            <Icon name="close" />
          </button>
        </div>

        <div className="tour-step">
          <span className="tour-icon" aria-hidden="true">
            <Icon name={ICONS[id]} size={28} />
          </span>
          <h2 id="tour-step-title" ref={headingRef} tabIndex={-1}>
            {step.title}
          </h2>
          <p>{step.text}</p>
          {'kinds' in step ? (
            <div className="tour-kinds">
              <p>{step.kinds}</p>
              <ul>
                {(['measured', 'derived', 'average', 'estimate'] as const).map((k) => (
                  <li key={k}>
                    <KindBadge kind={k} /> <span>{t.valueKindsHelp[k]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {action ? (
            <button type="button" className="btn btn--ghost btn--small tour-action" onClick={runAction}>
              {action}
            </button>
          ) : null}
        </div>

        <ol className="tour-dots" aria-label={tt.title}>
          {steps.map((s, n) => (
            <li key={s.id}>
              <button type="button" aria-label={`${tt.step(n + 1, steps.length)}: ${s.title}`} aria-current={n === i ? 'step' : undefined} onClick={() => go(n)} />
            </li>
          ))}
        </ol>

        <div className="tour-nav">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => go(i - 1)} disabled={i === 0}>
            {tt.prev}
          </button>
          {last ? (
            <button type="button" className="btn btn--small" onClick={close}>
              {tt.finish}
            </button>
          ) : (
            <button type="button" className="btn btn--small" onClick={() => go(i + 1)}>
              {tt.next}
            </button>
          )}
        </div>
        <p className="section-note tour-later">{tt.later}</p>
      </div>
    </dialog>
  );
}
