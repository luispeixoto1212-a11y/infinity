import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { setPreference, usePreferences, type QualityPreference } from '../../state/userData';
import type { ViewMode } from './engine/SolarSystemEngine';

interface Props {
  view: ViewMode;
  onView(mode: ViewMode): void;
  onRecenter(): void;
  fullscreen: boolean;
  fullscreenSupported: boolean;
  onFullscreen(): void;
  onToggleNav(): void;
  navOpen: boolean;
}

const VIEWS: ViewMode[] = ['overview', 'top', 'edge'];

export function ViewToolbar(p: Props) {
  const { t } = useI18n();
  const prefs = usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [menuOpen]);

  return (
    <div className="view-toolbar" role="toolbar" aria-label="Controlos da vista" ref={wrapRef}>
      <button
        type="button"
        className={`icon-btn nav-toggle-objects${p.navOpen ? ' is-on' : ''}`}
        onClick={p.onToggleNav}
        aria-expanded={p.navOpen}
        aria-label={t.explorer.objects}
        title={t.explorer.objects}
      >
        <Icon name="list" />
      </button>
      <button
        type="button"
        className={`icon-btn${prefs.showOrbits ? ' is-on' : ''}`}
        aria-pressed={prefs.showOrbits}
        onClick={() => setPreference('showOrbits', !prefs.showOrbits)}
        aria-label={t.explorer.orbits}
        title={`${t.explorer.orbits} (O)`}
      >
        <Icon name="orbit" />
      </button>
      <button
        type="button"
        className={`icon-btn${prefs.showLabels ? ' is-on' : ''}`}
        aria-pressed={prefs.showLabels}
        onClick={() => setPreference('showLabels', !prefs.showLabels)}
        aria-label={t.explorer.labels}
        title={`${t.explorer.labels} (L)`}
      >
        <Icon name="label" />
      </button>
      <button
        type="button"
        className={`icon-btn${prefs.showSmallBodies ? ' is-on' : ''}`}
        aria-pressed={prefs.showSmallBodies}
        onClick={() => setPreference('showSmallBodies', !prefs.showSmallBodies)}
        aria-label={t.smallBodies.layer}
        title={`${t.smallBodies.layer} (A)`}
      >
        <Icon name="comet" />
      </button>
      <div className="popover-wrap">
        <button
          type="button"
          className={`icon-btn${menuOpen ? ' is-on' : ''}`}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t.explorer.view}
          title={t.explorer.view}
        >
          <Icon name="view" />
        </button>
        {menuOpen ? (
          <div id={menuId} className="popover" role="group" aria-label={t.explorer.view}>
            <fieldset>
              <legend>{t.explorer.view}</legend>
              {VIEWS.map((v) => (
                <label key={v} className="radio-row">
                  <input
                    type="radio"
                    name="view-mode"
                    checked={p.view === v}
                    onChange={() => {
                      p.onView(v);
                      setMenuOpen(false);
                    }}
                  />
                  {t.explorer.views[v]}
                </label>
              ))}
            </fieldset>
            <label className="select-row">
              <span>{t.explorer.quality}</span>
              <select
                value={prefs.quality}
                onChange={(e) => setPreference('quality', e.target.value as QualityPreference)}
              >
                {(['auto', 'high', 'low'] as const).map((q) => (
                  <option key={q} value={q}>
                    {t.explorer.qualityOptions[q]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>
      <button type="button" className="icon-btn" onClick={p.onRecenter} aria-label={t.explorer.recenter} title={`${t.explorer.recenter} (R)`}>
        <Icon name="recenter" />
      </button>
      {p.fullscreenSupported ? (
        <button
          type="button"
          className="icon-btn"
          onClick={p.onFullscreen}
          aria-pressed={p.fullscreen}
          aria-label={p.fullscreen ? t.explorer.exitFullscreen : t.explorer.fullscreen}
          title={`${p.fullscreen ? t.explorer.exitFullscreen : t.explorer.fullscreen} (F)`}
        >
          <Icon name={p.fullscreen ? 'exitFullscreen' : 'fullscreen'} />
        </button>
      ) : null}
    </div>
  );
}
