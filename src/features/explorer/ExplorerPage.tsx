import { useCallback, useEffect, useRef, useState } from 'react';
import { BODIES, PRIMARY_BODIES, findBodyBySlug, getBody } from '../../data/catalog';
import type { BodyId } from '../../data/types';
import { dateToJulianDayTdb } from '../../core/astro/time';
import { useI18n } from '../../i18n';
import { navigate, href } from '../../app/router';
import { isTypingTarget, openShortcuts, uiStore } from '../../state/ui';
import { pushHistory, setPreference, usePreferences } from '../../state/userData';
import { SolarSystemEngine, type ViewMode } from './engine/SolarSystemEngine';
import { QUALITY, detectQualityTier, isWebGLAvailable, prefersReducedMotion } from './engine/quality';
import { DEFAULT_SPEED_INDEX, SPEEDS, clampSpeedIndex, rateFor } from './timeControl';
import { TimeDock } from './TimeDock';
import { ViewToolbar } from './ViewToolbar';
import { QuickNav } from './QuickNav';
import { InfoPanel } from './InfoPanel';
import { Icon } from '../../components/Icon';

const NUMBER_KEYS: BodyId[] = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

type Status = 'loading' | 'ready' | 'no-webgl' | 'lost';

export default function ExplorerPage({ focus }: { focus?: string }) {
  const { t } = useI18n();
  const prefs = usePreferences();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SolarSystemEngine | null>(null);
  const jdRef = useRef(dateToJulianDayTdb(new Date()));

  const [status, setStatus] = useState<Status>('loading');
  const [jd, setJd] = useState(jdRef.current);
  const [clamped, setClamped] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<BodyId | null>(null);
  const [view, setViewState] = useState<ViewMode>('overview');
  const [notices, setNotices] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const addNotice = useCallback((msg: string) => {
    setNotices((n) => (n.includes(msg) ? n : [...n, msg]));
  }, []);

  // Estado atual lido pelo motor quando é (re)criado
  const live = useRef({ paused, speedIndex, direction, prefs });
  live.current = { paused, speedIndex, direction, prefs };

  // ------------------------------------------------------------ criação do motor 3D
  useEffect(() => {
    const canvas = canvasRef.current;
    const labelLayer = labelRef.current;
    if (!canvas || !labelLayer) return;
    if (!isWebGLAvailable()) {
      setStatus('no-webgl');
      return;
    }
    const pref = live.current.prefs.quality;
    const tier = pref === 'auto' ? detectQualityTier() : pref;
    let engine: SolarSystemEngine;
    try {
      engine = new SolarSystemEngine({
        canvas,
        labelLayer,
        bodies: BODIES,
        quality: QUALITY[tier],
        autoQuality: pref === 'auto',
        reducedMotion: prefersReducedMotion(),
        initialJd: jdRef.current,
        callbacks: {
          onSelect: (id) => {
            setSelected(id);
            if (id) pushHistory(id);
          },
          onTime: (value, isClamped) => {
            jdRef.current = value;
            setJd(value);
            setClamped(isClamped);
            if (isClamped) setPaused(true);
          },
          onReady: () => setStatus('ready'),
          onQualityReduced: () => addNotice(t.explorer.qualityReduced),
          onTextureError: () => addNotice('Algumas texturas não carregaram; esses objetos aparecem com uma cor aproximada.'),
          onStarsError: () => addNotice('O catálogo de estrelas não carregou; o fundo aparece sem estrelas.'),
          onContextLost: () => setStatus('lost'),
        },
      });
    } catch (err) {
      console.error(err);
      setStatus('no-webgl');
      return;
    }
    engineRef.current = engine;
    const s = live.current;
    engine.setRate(rateFor(s.speedIndex, s.direction));
    engine.setPaused(s.paused);
    engine.setShowOrbits(s.prefs.showOrbits);
    engine.setShowLabels(s.prefs.showLabels);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [prefs.quality, addNotice, t]);

  // ------------------------------------------------------------ sincronização de controlos
  useEffect(() => engineRef.current?.setRate(rateFor(speedIndex, direction)), [speedIndex, direction]);
  useEffect(() => engineRef.current?.setPaused(paused), [paused]);
  useEffect(() => engineRef.current?.setShowOrbits(prefs.showOrbits), [prefs.showOrbits]);
  useEffect(() => engineRef.current?.setShowLabels(prefs.showLabels), [prefs.showLabels]);

  // Rota /explorar/:slug → selecionar e voar até ao objeto
  useEffect(() => {
    if (status !== 'ready' || !focus) return;
    const body = findBodyBySlug(focus);
    if (body) engineRef.current?.select(body.id, { fly: true });
    navigate({ name: 'explore' }, { replace: true });
  }, [focus, status]);

  // Ecrã inteiro
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const fullscreenSupported = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);
  const toggleFullscreen = useCallback(() => {
    if (!fullscreenSupported) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen().catch(() => undefined);
  }, [fullscreenSupported]);

  // ------------------------------------------------------------ ações
  const selectBody = useCallback((id: BodyId | null) => {
    engineRef.current?.select(id, { fly: id !== null });
    setNavOpen(false);
  }, []);

  const goNow = useCallback(() => {
    engineRef.current?.setTime(dateToJulianDayTdb(new Date()));
    setSpeedIndex(0);
    setDirection(1);
    setPaused(false);
    setClamped(false);
  }, []);

  const setView = useCallback((mode: ViewMode) => {
    setViewState(mode);
    engineRef.current?.setView(mode);
  }, []);

  const recenter = useCallback(() => {
    setViewState('overview');
    engineRef.current?.recenter();
  }, []);

  const togglePause = useCallback(() => {
    if (paused && clamped) {
      // Ao retomar depois do limite, inverte o sentido para voltar ao intervalo válido
      setDirection((d) => (d === 1 ? -1 : 1));
      setClamped(false);
    }
    setPaused(!paused);
  }, [paused, clamped]);

  // ------------------------------------------------------------ atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) || uiStore.get().searchOpen || uiStore.get().shortcutsOpen) return;
      const k = e.key;
      if (k === ' ') {
        if (e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        togglePause();
      } else if (k === '[') setSpeedIndex((i) => clampSpeedIndex(i - 1));
      else if (k === ']') setSpeedIndex((i) => clampSpeedIndex(i + 1));
      else if (k === 'o' || k === 'O') setPreference('showOrbits', !live.current.prefs.showOrbits);
      else if (k === 'l' || k === 'L') setPreference('showLabels', !live.current.prefs.showLabels);
      else if (k === 'r' || k === 'R') recenter();
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else if (k === '?') openShortcuts();
      else if (k === 'Escape') selectBody(null);
      else if (/^[1-9]$/.test(k)) {
        const id = NUMBER_KEYS[Number(k) - 1];
        if (id) selectBody(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause, recenter, toggleFullscreen, selectBody]);

  const touchOnly = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
  const liveInfo = selected ? engineRef.current?.getLiveInfo(selected) ?? null : null;
  const speedLabel = t.explorer.speeds[SPEEDS[speedIndex]!.key];

  return (
    <div ref={rootRef} className={`explorer${fullscreen ? ' is-fullscreen' : ''}`}>
      <div className="explorer-stage">
        <canvas
          ref={canvasRef}
          className="explorer-canvas"
          role="img"
          aria-label={t.explorer.sceneLabel}
          tabIndex={-1}
        />
        <div ref={labelRef} className="label-layer" />
        {status === 'loading' ? (
          <div className="stage-status" role="status">
            <span className="spinner" aria-hidden="true" />
            {t.explorer.loading}
          </div>
        ) : null}
        {status === 'no-webgl' || status === 'lost' ? (
          <div className="stage-fallback" role="alert">
            <p>{status === 'lost' ? t.explorer.webglLost : t.explorer.webglUnavailable}</p>
            {status === 'lost' ? (
              <button type="button" className="btn" onClick={() => location.reload()}>
                {t.errors.reload}
              </button>
            ) : null}
            <div className="fallback-list">
              {PRIMARY_BODIES.map((b) => (
                <a key={b.id} className="btn btn--ghost" href={href({ name: 'body', slug: b.slug })}>
                  {b.name['pt-PT']}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {status === 'ready' ? (
        <>
          <QuickNav selected={selected} onSelect={selectBody} open={navOpen} onClose={() => setNavOpen(false)} />

          <ViewToolbar
            view={view}
            onView={setView}
            onRecenter={recenter}
            fullscreen={fullscreen}
            fullscreenSupported={fullscreenSupported}
            onFullscreen={toggleFullscreen}
            onToggleNav={() => setNavOpen((v) => !v)}
            navOpen={navOpen}
          />

          {selected ? (
            <InfoPanel
              body={getBody(selected)}
              live={liveInfo}
              onClose={() => selectBody(null)}
              onFocus={() => engineRef.current?.flyToBody(selected)}
            />
          ) : null}

          <div className="explorer-bottom">
            {!prefs.hintDismissed ? (
              <aside className="hint-card" aria-labelledby="hint-title">
                <h2 id="hint-title">{t.explorer.hintTitle}</h2>
                <ul>
                  {t.explorer.hints
                    .filter((h) => !(touchOnly && h.includes('atalhos')))
                    .map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                </ul>
                <button type="button" className="btn btn--small" onClick={() => setPreference('hintDismissed', true)}>
                  {t.explorer.hintDismiss}
                </button>
              </aside>
            ) : null}
            <TimeDock
              jd={jd}
              paused={paused}
              clamped={clamped}
              speedIndex={speedIndex}
              speedLabel={speedLabel}
              direction={direction}
              onTogglePause={togglePause}
              onSlower={() => setSpeedIndex((i) => clampSpeedIndex(i - 1))}
              onFaster={() => setSpeedIndex((i) => clampSpeedIndex(i + 1))}
              onReverse={() => setDirection((d) => (d === 1 ? -1 : 1))}
              onNow={goNow}
            />
          </div>

          <p className="scale-note">
            <strong>{t.explorer.scaleTitle}.</strong> <span className="scale-note-body">{t.explorer.scaleBody}</span>{' '}
            <a href={href({ name: 'data' })}>{t.explorer.scaleMore}</a>
          </p>

          <button type="button" className="icon-btn shortcuts-btn" onClick={openShortcuts} aria-label={t.shortcuts.title}>
            <Icon name="keyboard" />
          </button>
        </>
      ) : null}

      <div className="notices" aria-live="polite">
        {notices.map((n) => (
          <div key={n} className="notice">
            <span>{n}</span>
            <button
              type="button"
              className="icon-btn icon-btn--small"
              aria-label="Fechar aviso"
              onClick={() => setNotices((all) => all.filter((x) => x !== n))}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        {clamped ? <div className="notice">{t.explorer.clamped}</div> : null}
      </div>
    </div>
  );
}
