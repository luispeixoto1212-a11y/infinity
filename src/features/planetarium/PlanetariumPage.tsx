import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { LoadState } from '../../components/LoadState';
import { useAsync } from '../../components/useAsync';
import { readJson, writeJson } from '../../core/storage';
import { formatNumber } from '../../core/format';
import { dateToJulianDayUtc } from '../../core/astro/time';
import { useI18n } from '../../i18n';
import { InfoCard } from './InfoCard';
import { PlacePicker } from './PlacePicker';
import { SkyCanvas, clampView } from './SkyCanvas';
import { TonightPanel } from './TonightPanel';
import {
  DEFAULT_PLACE_ID,
  type Place,
  findPlace,
  formatUtcOffset,
  parseDateTimeLocalValue,
  startOfLocalDay,
  timeZoneOffsetMinutes,
  toDateTimeLocalValue,
  wallTimeIn,
  wallTimeToDate,
  isValidTimeZone,
} from './places';
import {
  DEFAULT_LAYERS,
  DOME_VIEW,
  HORIZON_VIEW,
  type Layers,
  type RenderOptions,
  type SelectionKey,
  type ViewParams,
  effectiveMagLimit,
  selectionEnu,
} from './skyRenderer';
import { loadSkyScene, resolveTarget } from './skyScene';
import { analyzeNight, computeSkyInstant } from './skyState';
import { enuToHorizontal } from '../../core/astro/sky';

export const TIME_MIN = Date.UTC(1800, 0, 1);
export const TIME_MAX = Date.UTC(2050, 11, 31, 23, 59);
const clampTime = (ms: number) => Math.min(TIME_MAX, Math.max(TIME_MIN, ms));

interface SavedSettings {
  place: Place;
  layers: Layers;
  magLimit: number;
  atmosphere: boolean;
  ground: boolean;
}

function isPlace(v: unknown): v is Place {
  const p = v as Place;
  return (
    !!p &&
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    Number.isFinite(p.latDeg) &&
    Math.abs(p.latDeg) <= 90 &&
    Number.isFinite(p.lonDeg) &&
    Math.abs(p.lonDeg) <= 180 &&
    typeof p.timeZone === 'string' &&
    isValidTimeZone(p.timeZone)
  );
}

function isSettings(v: unknown): v is SavedSettings {
  const s = v as SavedSettings;
  return (
    !!s &&
    isPlace(s.place) &&
    typeof s.layers === 'object' &&
    s.layers !== null &&
    Object.keys(DEFAULT_LAYERS).every((k) => typeof (s.layers as unknown as Record<string, unknown>)[k] === 'boolean') &&
    typeof s.magLimit === 'number' &&
    s.magLimit >= 1 &&
    s.magLimit <= 6.5 &&
    typeof s.atmosphere === 'boolean' &&
    typeof s.ground === 'boolean'
  );
}

const SETTINGS_KEY = 'planetarium:v1';
const DEFAULT_SETTINGS: SavedSettings = {
  place: findPlace(DEFAULT_PLACE_ID)!,
  layers: DEFAULT_LAYERS,
  magLimit: 5,
  atmosphere: true,
  ground: true,
};

export default function PlanetariumPage({ target }: { target?: string }) {
  const { t } = useI18n();
  const tp = t.planetarium;
  const { state, retry } = useAsync(loadSkyScene);
  const scene = state.status === 'ready' ? state.value : null;

  const saved = useMemo(() => readJson<SavedSettings>(SETTINGS_KEY, DEFAULT_SETTINGS, isSettings), []);
  const [place, setPlace] = useState<Place>(saved.place);
  const [layers, setLayers] = useState<Layers>(saved.layers);
  const [magLimit, setMagLimit] = useState(saved.magLimit);
  const [atmosphere, setAtmosphere] = useState(saved.atmosphere);
  const [ground, setGround] = useState(saved.ground);
  useEffect(() => {
    writeJson(SETTINGS_KEY, { place, layers, magLimit, atmosphere, ground } satisfies SavedSettings);
  }, [place, layers, magLimit, atmosphere, ground]);

  const [compare, setCompare] = useState(false);
  const [placeB, setPlaceB] = useState<Place>(findPlace('rio')!);

  // Tempo
  const [timeMs, setTimeMs] = useState(() => clampTime(Date.now()));
  const [live, setLive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [reverse, setReverse] = useState(false);
  const [clampedNote, setClampedNote] = useState(false);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTimeMs(clampTime(Date.now())), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTimeMs((ms) => {
        const next = ms + dt * speed * 1000 * (reverse ? -1 : 1);
        if (next <= TIME_MIN || next >= TIME_MAX) {
          setPlaying(false);
          setClampedNote(true);
        }
        return clampTime(next);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, reverse]);

  const setTime = (ms: number) => {
    setLive(false);
    setClampedNote(ms < TIME_MIN || ms > TIME_MAX);
    setTimeMs(clampTime(ms));
  };
  const goNow = () => {
    setPlaying(false);
    setLive(true);
    setClampedNote(false);
    setTimeMs(clampTime(Date.now()));
  };

  const date = useMemo(() => new Date(timeMs), [timeMs]);
  const observer = useMemo(() => ({ latDeg: place.latDeg, lonDeg: place.lonDeg, heightM: place.heightM }), [place]);
  const observerB = useMemo(() => ({ latDeg: placeB.latDeg, lonDeg: placeB.lonDeg, heightM: placeB.heightM }), [placeB]);
  const inst = useMemo(() => computeSkyInstant(date, observer), [date, observer]);
  const instB = useMemo(() => (compare ? computeSkyInstant(date, observerB) : null), [compare, date, observerB]);

  // Noite: do meio-dia local ao meio-dia seguinte
  const noonKey = useMemo(() => {
    const w = wallTimeIn(date, place.timeZone);
    let noon = wallTimeToDate({ year: w.year, month: w.month, day: w.day, hour: 12, minute: 0 }, place.timeZone);
    if (w.hour < 12) noon = new Date(noon.getTime() - 86400000);
    return noon.getTime();
  }, [date, place.timeZone]);
  const night = useMemo(() => analyzeNight(dateToJulianDayUtc(new Date(noonKey)), observer), [noonKey, observer]);
  const dayStartMs = useMemo(() => startOfLocalDay(date, place.timeZone).getTime(), [date, place.timeZone]);
  const dayStartJd = dateToJulianDayUtc(new Date(dayStartMs));

  // Vista e seleção
  const [view, setView] = useState<ViewParams>(DOME_VIEW);
  const [viewB, setViewB] = useState<ViewParams>(DOME_VIEW);
  const [selection, setSelection] = useState<{ key: SelectionKey; side: 'a' | 'b' } | null>(null);

  const centerOn = useCallback(
    (key: SelectionKey, side: 'a' | 'b' = 'a') => {
      const i = side === 'a' ? inst : instB;
      if (!i) return;
      const v = selectionEnu(key, i, scene);
      if (!v) return;
      const h = enuToHorizontal(v);
      const set = side === 'a' ? setView : setViewB;
      set((cur) => clampView({ azDeg: h.azDeg, altDeg: Math.max(h.altDeg, cur.fovDeg >= 150 ? 15 : h.altDeg), fovDeg: Math.min(cur.fovDeg, 90) }));
    },
    [inst, instB, scene],
  );

  // Alvo vindo do endereço
  const targetDone = useRef<string | null>(null);
  useEffect(() => {
    if (!scene || !target || targetDone.current === target) return;
    targetDone.current = target;
    const key = resolveTarget(target, scene);
    if (key) {
      setSelection({ key, side: 'a' });
      centerOn(key);
    }
  }, [scene, target, centerOn]);

  const options = useMemo<RenderOptions>(
    () => ({ layers, magLimit, atmosphere, ground, selected: selection?.side === 'a' ? selection.key : null }),
    [layers, magLimit, atmosphere, ground, selection],
  );
  const optionsB = useMemo<RenderOptions>(
    () => ({ layers, magLimit, atmosphere, ground, selected: selection?.side === 'b' ? selection.key : null }),
    [layers, magLimit, atmosphere, ground, selection],
  );

  // Ecrã inteiro
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const timeLabel = (d: Date, p: Place) => {
    const f = new Intl.DateTimeFormat('pt-PT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: p.timeZone,
    }).format(d);
    return `${f} (${formatUtcOffset(timeZoneOffsetMinutes(d, p.timeZone))})`;
  };

  const effLimit = effectiveMagLimit(inst, { atmosphere, magLimit });
  const selInst = selection?.side === 'b' ? instB : inst;
  const selPlace = selection?.side === 'b' ? placeB : place;
  const selDayStart = selection?.side === 'b' ? dateToJulianDayUtc(startOfLocalDay(date, placeB.timeZone)) : dayStartJd;

  const dirButtons: Array<[string, number]> = [
    ['N', 0],
    ['E', 90],
    ['S', 180],
    ['O', 270],
  ];

  const stageHeader = (p: Place, i: typeof inst) => (
    <div className="planetarium-hud">
      <strong>{p.name}</strong>
      <span>{timeLabel(date, p)}</span>
      <span className={`twilight twilight--${i.twilight}`}>{tp.twilight[i.twilight]}</span>
    </div>
  );

  return (
    <div className="page page--wide planetarium-page">
      <header className="page-head">
        <h1 className="page-title">{tp.title}</h1>
        <p className="page-lede">{tp.lede}</p>
        <p className="sky-disclaimer" role="note">
          <Icon name="info" size={16} />
          {tp.simulated}
        </p>
      </header>

      {state.status !== 'ready' ? (
        <LoadState state={state} retry={retry} loading={tp.loading} error={tp.loadError} retryLabel={tp.retry} />
      ) : null}

      <div ref={stageRef} className={`planetarium-stage-wrap${compare ? ' is-compare' : ''}${fullscreen ? ' is-fullscreen' : ''}`}>
        <div className="planetarium-views">
          <div className="planetarium-view">
            {stageHeader(place, inst)}
            <SkyCanvas
              scene={scene}
              inst={inst}
              view={view}
              onViewChange={setView}
              options={options}
              onSelect={(key) => setSelection(key ? { key, side: 'a' } : null)}
              label={tp.canvasLabel(place.name, timeLabel(date, place))}
              describedBy="planetarium-help"
            />
          </div>
          {compare && instB ? (
            <div className="planetarium-view">
              {stageHeader(placeB, instB)}
              <SkyCanvas
                scene={scene}
                inst={instB}
                view={viewB}
                onViewChange={setViewB}
                options={optionsB}
                onSelect={(key) => setSelection(key ? { key, side: 'b' } : null)}
                label={tp.canvasLabel(placeB.name, timeLabel(date, placeB))}
                describedBy="planetarium-help"
              />
            </div>
          ) : null}
        </div>

        {selection && selInst ? (
          <InfoCard
            selection={selection.key}
            inst={selInst}
            scene={scene}
            place={selPlace}
            dayStartJd={selDayStart}
            onClose={() => setSelection(null)}
            onCenter={() => centerOn(selection.key, selection.side)}
          />
        ) : null}

        <div className="planetarium-toolbar" role="toolbar" aria-label={tp.view.title}>
          <div className="toolbar-group">
            <button
              type="button"
              className={`icon-btn${playing ? ' is-on' : ''}`}
              onClick={() => {
                setLive(false);
                setPlaying((v) => !v);
              }}
              aria-label={playing ? tp.time.pause : tp.time.play}
              aria-pressed={playing}
            >
              <Icon name={playing ? 'pause' : 'play'} size={18} />
            </button>
            <button
              type="button"
              className={`icon-btn${reverse ? ' is-on' : ''}`}
              onClick={() => setReverse((v) => !v)}
              aria-label={tp.time.reverse}
              aria-pressed={reverse}
            >
              <Icon name="reverse" size={18} />
            </button>
            <label className="toolbar-select">
              <span className="visually-hidden">{tp.time.speed}</span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                {tp.time.speeds.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {tp.time.steps.map(([s, label]) => (
              <button key={s} type="button" className="btn btn--small btn--ghost" onClick={() => setTime(timeMs + s * 1000)}>
                {label}
              </button>
            ))}
            <button type="button" className={`btn btn--small${live ? '' : ' btn--ghost'}`} onClick={goNow} aria-pressed={live}>
              <Icon name="now" size={15} />
              {live ? tp.time.live : tp.time.now}
            </button>
          </div>
          <div className="toolbar-group">
            <div className="segmented" role="group" aria-label={tp.view.directions}>
              {dirButtons.map(([label, az]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setView((v) => clampView({ azDeg: az, altDeg: v.altDeg >= 80 ? HORIZON_VIEW.altDeg : v.altDeg, fovDeg: v.fovDeg > 150 ? HORIZON_VIEW.fovDeg : v.fovDeg }))}
                >
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => setView(DOME_VIEW)}>
                {tp.view.zenith}
              </button>
            </div>
            <button type="button" className="icon-btn" onClick={() => setView((v) => clampView({ ...v, fovDeg: v.fovDeg / 1.4 }))} aria-label={tp.view.zoomIn}>
              +
            </button>
            <button type="button" className="icon-btn" onClick={() => setView((v) => clampView({ ...v, fovDeg: v.fovDeg * 1.4 }))} aria-label={tp.view.zoomOut}>
              −
            </button>
            <button type="button" className="icon-btn" onClick={toggleFullscreen} aria-label={fullscreen ? tp.view.exitFullscreen : tp.view.fullscreen}>
              <Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} size={18} />
            </button>
          </div>
        </div>
      </div>
      <p id="planetarium-help" className="section-note">
        {tp.view.help} {tp.view.fov(formatNumber(view.fovDeg, 0))}.
      </p>

      <div className="planetarium-panels">
        <section className="planetarium-panel" aria-labelledby="pl-place">
          <h2 id="pl-place" className="panel-title">
            {tp.place.title}
          </h2>
          <PlacePicker
            place={place}
            onChange={(p) => {
              setPlace(p);
              setSelection(null);
            }}
            date={date}
          />
          <button type="button" className="btn btn--small btn--ghost compare-toggle" onClick={() => setCompare((v) => !v)} aria-pressed={compare}>
            <Icon name="compare" size={16} />
            {compare ? tp.compare.off : tp.compare.toggle}
          </button>
          {compare ? (
            <div className="compare-place">
              <PlacePicker place={placeB} onChange={setPlaceB} date={date} label={tp.compare.second} />
              <p className="section-note">{tp.compare.note}</p>
            </div>
          ) : null}
        </section>

        <section className="planetarium-panel" aria-labelledby="pl-time">
          <h2 id="pl-time" className="panel-title">
            {tp.time.title}
          </h2>
          <label className="field">
            <span className="field-label">{tp.time.input}</span>
            <input
              type="datetime-local"
              min="1800-01-01T00:00"
              max="2050-12-31T23:59"
              value={toDateTimeLocalValue(date, place.timeZone)}
              onChange={(e) => {
                const w = parseDateTimeLocalValue(e.target.value);
                if (!w) return;
                setPlaying(false);
                setTime(wallTimeToDate(w, place.timeZone).getTime());
              }}
            />
          </label>
          <p className="place-coords">
            {tp.time.utc}: {date.toISOString().slice(0, 16).replace('T', ' ')} · {tp.time.lst}: {formatNumber(inst.lstDeg / 15, 2)} h
          </p>
          <p className="section-note">{tp.time.range}</p>
          {clampedNote ? (
            <p className="field-error" role="status">
              {tp.time.clamped}
            </p>
          ) : null}
          <div className="segmented view-mode" role="group" aria-label={tp.view.title}>
            <button type="button" className={view.fovDeg >= 150 && view.altDeg >= 80 ? 'is-active' : ''} onClick={() => setView(DOME_VIEW)}>
              {tp.view.dome}
            </button>
            <button type="button" className={!(view.fovDeg >= 150 && view.altDeg >= 80) ? 'is-active' : ''} onClick={() => setView((v) => clampView({ ...HORIZON_VIEW, azDeg: v.altDeg >= 80 ? 180 : v.azDeg }))}>
              {tp.view.horizon}
            </button>
          </div>
        </section>

        <section className="planetarium-panel" aria-labelledby="pl-layers">
          <h2 id="pl-layers" className="panel-title">
            {tp.layers.title}
          </h2>
          <div className="checks">
            {(Object.keys(DEFAULT_LAYERS) as Array<keyof Layers>).map((k) => (
              <label key={k} className="check">
                <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />
                {tp.layers[k]}
              </label>
            ))}
            <label className="check">
              <input type="checkbox" checked={ground} onChange={(e) => setGround(e.target.checked)} />
              {tp.layers.ground}
            </label>
            <label className="check">
              <input type="checkbox" checked={atmosphere} onChange={(e) => setAtmosphere(e.target.checked)} />
              {tp.layers.atmosphere}
            </label>
          </div>
        </section>

        <section className="planetarium-panel" aria-labelledby="pl-sky">
          <h2 id="pl-sky" className="panel-title">
            {tp.sky.title}
          </h2>
          <label className="field">
            <span className="field-label">
              {tp.sky.limit}: {formatNumber(magLimit, 1)}
            </span>
            <input type="range" min={1} max={6.5} step={0.1} value={magLimit} onChange={(e) => setMagLimit(Number(e.target.value))} />
          </label>
          <div className="chips">
            {tp.sky.presets.map(([m, label]) => (
              <button key={m} type="button" className={`chip${Math.abs(magLimit - m) < 0.05 ? ' is-active' : ''}`} onClick={() => setMagLimit(m)}>
                {label} ({formatNumber(m, 1)})
              </button>
            ))}
          </div>
          <p className="section-note">
            {tp.sky.effective(formatNumber(effLimit, 1))}. {tp.sky.note}
          </p>
        </section>
      </div>

      <TonightPanel
        inst={inst}
        night={night}
        place={place}
        scene={scene}
        onPick={(id) => {
          const key: SelectionKey = { kind: 'body', id };
          setSelection({ key, side: 'a' });
          centerOn(key);
        }}
      />

      <section className="planetarium-methods" aria-labelledby="pl-methods">
        <h2 id="pl-methods" className="section-title">
          {tp.legend.title}
        </h2>
        <p className="section-note">{tp.legend.sizes}</p>
        <ul className="method-list">
          {tp.methods.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="section-note">
          <a href="#/dados">{tp.validation}</a>
        </p>
      </section>
    </div>
  );
}

