import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type WheelEvent } from 'react';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { useAsync } from '../../components/useAsync';
import { useElementSize } from '../../components/useElementSize';
import { formatNumber } from '../../core/format';
import { constellationName } from '../../data/constellations';
import { useI18n } from '../../i18n';
import { colorFromBv } from '../stars/starData';
import { SUBTYPE_COLOR } from './DeepSkyGlyph';
import { formatLightYears, type SkyObject } from './deepSkyData';
import { loadMilkyWay, loadSkyMap, milkyWayLevel, type MilkyWayGrid } from './skyMapData';
import { SKY_HEIGHT, SKY_WIDTH, eclipticPoints, outlinePath, polylinePaths, project, unproject } from './skyProjection';

interface View {
  cx: number;
  cy: number;
  k: number;
}

const MIN_K = 1;
const MAX_K = 14;
const HOME: View = { cx: 0, cy: 0, k: 1 };

function clampView(v: View): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
  const halfW = SKY_WIDTH / 2;
  const halfH = SKY_HEIGHT / 2;
  return { k, cx: Math.max(-halfW, Math.min(halfW, v.cx)), cy: Math.max(-halfH, Math.min(halfH, v.cy)) };
}

/** Desenha a Via Láctea e o fundo do céu (dentro da elipse) para a vista atual, a meia resolução. */
function paintSky(canvas: HTMLCanvasElement, grid: MilkyWayGrid | null, view: View, w: number, h: number) {
  const scale = 0.5;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(cw, ch);
  const vw = SKY_WIDTH / view.k;
  const vh = vw * (h / w);
  const x0 = view.cx - vw / 2;
  const y0 = view.cy - vh / 2;
  const d = img.data;
  for (let j = 0; j < ch; j += 1) {
    const y = y0 + ((j + 0.5) / ch) * vh;
    for (let i = 0; i < cw; i += 1) {
      const x = x0 + ((i + 0.5) / cw) * vw;
      const p = unproject(x, y);
      if (!p) continue;
      const level = grid ? milkyWayLevel(grid, p.ra, p.dec) : 0;
      const o = (j * cw + i) * 4;
      // Fundo azul-noite com a faixa da Via Láctea mais clara (ilustrativa, por níveis de brilho)
      d[o] = 9 + level * 13;
      d[o + 1] = 14 + level * 15;
      d[o + 2] = 32 + level * 20;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Tipos que só aparecem na legenda quando há objetos desse tipo no mapa. */
const EXTRA_LEGEND = new Set<string>(['snr', 'dark', 'pulsar']);

export interface SkyMapProps {
  objects: readonly SkyObject[];
  /** Objeto em destaque (ficha). */
  highlightId?: string;
  /** Vista inicial centrada num ponto do céu. */
  focus?: { ra: number; dec: number; zoom: number };
  /** Ids dos objetos com etiqueta mesmo na vista geral. */
  labelled?: readonly string[];
  compact?: boolean;
  /** Descrição acessível do mapa (por omissão, a do mapa dos objetos Messier). */
  ariaLabel?: string;
}

export function SkyMap({ objects, highlightId, focus, labelled = [], compact = false, ariaLabel }: SkyMapProps) {
  const { t } = useI18n();
  const { state } = useAsync(loadSkyMap);
  const [grid, setGrid] = useState<MilkyWayGrid | null>(null);
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>();
  // Em ecrãs estreitos o mapa fica mais alto e começa aproximado (desloca-se na horizontal)
  const narrow = width > 0 && width < 600;
  const height = Math.round(width * (narrow ? 0.75 : 0.5));
  const initial = useMemo<View>(() => {
    if (!focus) return narrow ? { ...HOME, k: 1.5 } : HOME;
    const p = project(focus.ra, focus.dec);
    return clampView({ cx: p.x, cy: p.y, k: focus.zoom });
  }, [focus, narrow]);
  const [view, setView] = useState<View>(initial);
  const [hover, setHover] = useState<{ o: SkyObject; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => setView(initial), [initial]);

  useEffect(() => {
    let alive = true;
    loadMilkyWay()
      .then((g) => alive && setGrid(g))
      .catch(() => {
        /* Sem a imagem da Via Láctea, o mapa continua a funcionar. */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || width === 0) return;
    const id = requestAnimationFrame(() => paintSky(c, grid, view, width, height));
    return () => cancelAnimationFrame(id);
  }, [grid, view, width, height]);

  const paths = useMemo(() => {
    if (state.status !== 'ready') return null;
    const { map } = state.value;
    const constellations = Object.values(map.lines).flatMap((segs) => segs.flatMap((seg) => polylinePaths(seg))).join(' ');
    const grat: string[] = [];
    for (let ra = 0; ra < 360; ra += 30) {
      const pts: Array<[number, number]> = [];
      for (let dec = -88; dec <= 88; dec += 4) pts.push([ra + 1e-6, dec]);
      grat.push(...polylinePaths(pts));
    }
    for (const dec of [-60, -30, 30, 60]) {
      const pts: Array<[number, number]> = [];
      for (let ra = 0; ra <= 360; ra += 3) pts.push([ra, dec]);
      grat.push(...polylinePaths(pts));
    }
    const eq: Array<[number, number]> = [];
    for (let ra = 0; ra <= 360; ra += 3) eq.push([ra, 0]);
    return {
      constellations,
      graticule: grat.join(' '),
      equator: polylinePaths(eq).join(' '),
      ecliptic: polylinePaths(eclipticPoints()).join(' '),
      outline: outlinePath(),
    };
  }, [state]);

  const vw = SKY_WIDTH / view.k;
  const vh = width > 0 ? vw * (height / width) : SKY_HEIGHT;
  const upp = width > 0 ? vw / width : 0.01; // unidades da projeção por píxel
  const viewBox = `${view.cx - vw / 2} ${view.cy - vh / 2} ${vw} ${vh}`;

  const zoomAt = useCallback(
    (factor: number, px?: number, py?: number) => {
      setView((v) => {
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
        if (px === undefined || py === undefined || width === 0) return clampView({ ...v, k });
        const curW = SKY_WIDTH / v.k;
        const curH = curW * (height / width);
        const wx = v.cx - curW / 2 + (px / width) * curW;
        const wy = v.cy - curH / 2 + (py / height) * curH;
        const newW = SKY_WIDTH / k;
        const newH = newW * (height / width);
        return clampView({ k, cx: wx - (px / width - 0.5) * newW, cy: wy - (py / height - 0.5) * newH });
      });
    },
    [width, height],
  );

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && compact) return; // na ficha, a roda do rato continua a deslocar a página
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || width === 0) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
    d.moved = true;
    const u = SKY_WIDTH / d.view.k / width;
    setView(clampView({ ...d.view, cx: d.view.cx - dx * u, cy: d.view.cy - dy * u }));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      justDragged.current = true;
      window.setTimeout(() => {
        justDragged.current = false;
      }, 0);
    }
  };
  const onClickCapture = (e: MouseEvent) => {
    // Um arrasto não deve abrir a ficha do objeto onde termina
    if (justDragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = (SKY_WIDTH / view.k) * 0.1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomAt(1.4);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomAt(1 / 1.4);
    } else if (e.key === '0') {
      e.preventDefault();
      setView(initial);
    } else if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key]!;
      setView((v) => clampView({ ...v, cx: v.cx + dx, cy: v.cy + dy }));
    }
  };

  const showLabels = view.k >= (narrow ? 2.6 : 1.9) || compact;
  const markerR = (compact ? 5 : narrow ? 3.2 : 4.2) * upp;
  const fontPx = 11;
  const stars = state.status === 'ready' ? state.value.stars : [];
  const labelSet = new Set(labelled);
  // Os objetos mais brilhantes são desenhados por cima dos mais ténues (M42 sobre M43, por exemplo)
  // e o objeto em destaque por último, por cima de todos
  const byBrightness = [...objects].sort((a, b) => (b.mag ?? 99) - (a.mag ?? 99));
  const orderedObjects = highlightId ? [...byBrightness.filter((o) => o.id !== highlightId), ...byBrightness.filter((o) => o.id === highlightId)] : byBrightness;
  const hiObject = highlightId ? objects.find((o) => o.id === highlightId) : undefined;
  const hiPoint = hiObject ? project(hiObject.ra, hiObject.dec) : null;

  return (
    <div className={compact ? 'skymap skymap--compact' : 'skymap'}>
      <div
        ref={wrapRef}
        className="skymap-stage"
        style={{ height: height || undefined }}
        tabIndex={0}
        role="group"
        aria-label={ariaLabel ?? t.space.skyMap.aria}
        aria-describedby="skymap-help"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHover(null)}
      >
        <canvas ref={canvasRef} className="skymap-canvas" aria-hidden="true" />
        {paths && width > 0 ? (
          <svg className="skymap-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden={false}>
            <defs>
              <clipPath id="skymap-clip">
                <path d={paths.outline} />
              </clipPath>
            </defs>
            <g clipPath="url(#skymap-clip)">
              <path d={paths.graticule} className="skymap-grat" vectorEffect="non-scaling-stroke" />
              <path d={paths.equator} className="skymap-equator" vectorEffect="non-scaling-stroke" />
              <path d={paths.ecliptic} className="skymap-ecliptic" vectorEffect="non-scaling-stroke" />
              <path d={paths.constellations} className="skymap-lines" vectorEffect="non-scaling-stroke" />
              {stars.map((s, i) => {
                const p = project(s.ra, s.dec);
                return <circle key={i} cx={p.x} cy={p.y} r={Math.max(0.6, 3.2 - s.mag * 0.55) * upp} fill={colorFromBv(s.bv)} opacity={0.9} />;
              })}
              {state.status === 'ready'
                ? state.value.map.labels
                    .filter(([, , , rank]) => rank <= (view.k >= (narrow ? 4 : 3) ? 3 : view.k >= (narrow ? 2.4 : 1.6) ? 2 : 1))
                    .map(([abbr, ra, dec]) => {
                      const p = project(ra, dec);
                      return (
                        <text key={abbr} x={p.x} y={p.y} className="skymap-con-label" fontSize={10 * upp} textAnchor="middle">
                          {constellationName(abbr)}
                        </text>
                      );
                    })
                : null}
              {orderedObjects.map((o) => {
                const p = project(o.ra, o.dec);
                const isHi = o.id === highlightId;
                // Junto ao objeto em destaque, as etiquetas dos vizinhos ficariam por cima da dele
                const nearHi = hiPoint !== null && !isHi && Math.hypot(p.x - hiPoint.x, p.y - hiPoint.y) < 22 * upp;
                const color = SUBTYPE_COLOR[o.subtype];
                return (
                  <a
                    key={o.id}
                    href={href({ name: 'deep-sky-object', id: o.id })}
                    aria-label={`${o.label}${o.namePt && o.namePt !== o.label ? `, ${o.namePt}` : ''}: ${t.space.subtypes[o.subtype]}`}
                    className={isHi ? 'skymap-obj is-highlight' : 'skymap-obj'}
                    onPointerEnter={(e) => {
                      const rect = (e.currentTarget.closest('.skymap-stage') ?? e.currentTarget).getBoundingClientRect();
                      setHover({ o, x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(null)}
                  >
                    {isHi ? <circle cx={p.x} cy={p.y} r={markerR * 3} className="skymap-hi-ring" vectorEffect="non-scaling-stroke" /> : null}
                    <circle cx={p.x} cy={p.y} r={markerR * 2.6} fill="transparent" />
                    <circle cx={p.x} cy={p.y} r={markerR} fill={color} className="skymap-dot" vectorEffect="non-scaling-stroke" />
                    {(showLabels || (labelSet.has(o.id) && !narrow) || isHi) && !nearHi ? (
                      <text x={p.x + markerR * 1.6} y={p.y + markerR * 0.9} fontSize={fontPx * upp} strokeWidth={2.5 * upp} className="skymap-obj-label">
                        {o.label}
                      </text>
                    ) : null}
                  </a>
                );
              })}
            </g>
            <path d={paths.outline} className="skymap-outline" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
        {hover ? (
          <div className="skymap-tip" style={{ left: hover.x, top: hover.y }} role="tooltip">
            <strong>
              {hover.o.label}
              {hover.o.namePt && hover.o.namePt !== hover.o.label ? ` · ${hover.o.namePt}` : ''}
            </strong>
            <span>
              {t.space.subtypes[hover.o.subtype]} · {constellationName(hover.o.constellation)}
            </span>
            <span>
              {hover.o.mag !== undefined ? `${t.space.facts.mag} ${formatNumber(hover.o.mag, 1)}` : ''}
              {hover.o.distanceLy ? ` · ${formatLightYears(hover.o.distanceLy)}` : ''}
            </span>
          </div>
        ) : null}
        {state.status === 'error' ? <p className="skymap-error">{t.space.loadError}</p> : null}
      </div>
      <div className="skymap-bar">
        <div className="skymap-controls">
          <button type="button" className="icon-btn icon-btn--small" onClick={() => zoomAt(1.4)} aria-label={t.space.skyMap.zoomIn} disabled={view.k >= MAX_K}>
            +
          </button>
          <button type="button" className="icon-btn icon-btn--small" onClick={() => zoomAt(1 / 1.4)} aria-label={t.space.skyMap.zoomOut} disabled={view.k <= MIN_K}>
            −
          </button>
          <button type="button" className="icon-btn icon-btn--small" onClick={() => setView(initial)} aria-label={t.space.skyMap.reset}>
            <Icon name="recenter" size={16} />
          </button>
        </div>
        <ul className="skymap-legend" aria-label={t.space.skyMap.legend}>
          {(
            [
              ['spiral', t.space.filters.galaxy],
              ['globular', t.space.skyMap.globular],
              ['open', t.space.skyMap.open],
              ['emission', t.space.filters.nebula],
              ['planetary', t.space.skyMap.planetary],
              ['snr', t.space.skyMap.snr],
              ['dark', t.space.skyMap.dark],
              ['pulsar', t.space.skyMap.pulsar],
            ] as const
          )
            .filter(([k]) => !EXTRA_LEGEND.has(k) || objects.some((o) => o.subtype === k))
            .map(([k, label]) => (
            <li key={k}>
              <span className="skymap-swatch" style={{ background: SUBTYPE_COLOR[k] }} aria-hidden="true" />
              {label}
            </li>
          ))}
          <li>
            <span className="skymap-swatch skymap-swatch--ecliptic" aria-hidden="true" />
            {t.space.skyMap.ecliptic}
          </li>
        </ul>
      </div>
      <p id="skymap-help" className="section-note">
        {compact ? t.space.skyMap.helpCompact : t.space.skyMap.help}
      </p>
    </div>
  );
}
