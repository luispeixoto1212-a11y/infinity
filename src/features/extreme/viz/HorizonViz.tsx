import { useId, useState } from 'react';
import { formatNumber, formatScientific } from '../../../core/format';
import { useI18n } from '../../../i18n';
import { VizFrame } from './VizFrame';

const G = 6.6743e-11;
const C = 299_792_458;
const M_SUN = 1.98841e30;
const AU = 1.495978707e11;

/** Massas (em massas solares) de exemplo, com fonte nas fichas de buracos negros e no Sistema Solar. */
const PRESETS: Array<[string, number]> = [
  ['Terra', 3.003e-6],
  ['Sol', 1],
  ['Cygnus X-1', 21.2],
  ['Gaia BH3', 33],
  ['Sagitário A*', 4.3e6],
  ['M87*', 6.5e9],
];

export function schwarzschildRadiusM(massSun: number): number {
  return (2 * G * massSun * M_SUN) / (C * C);
}

/** Diferença de aceleração de maré (m/s²) entre a cabeça e os pés de um corpo de comprimento L, à distância r. */
export function tidalAcceleration(massSun: number, r: number, L = 2): number {
  return (2 * G * massSun * M_SUN * L) / r ** 3;
}

/** Distância a que a maré sobre um corpo de 2 m atinge 10 g (cerca de 100 m/s²). */
export function spaghettiRadius(massSun: number, L = 2, limit = 98.0665): number {
  return Math.cbrt((2 * G * massSun * M_SUN * L) / limit);
}

function formatLength(m: number): string {
  if (m < 1) return `${formatNumber(m * 1000, 1)} mm`;
  if (m < 1000) return `${formatNumber(m, 1)} m`;
  if (m < 0.01 * AU) return `${formatNumber(m / 1000, m < 1e5 ? 1 : 0)} km`;
  return `${formatNumber(m / AU, 2)} UA`;
}

/** Horizonte, esfera de fotões, última órbita estável, dilatação do tempo e marés (calculados). */
export function HorizonViz() {
  const { t } = useI18n();
  const tx = t.extreme.horizon;
  const id = useId();
  const [logM, setLogM] = useState(Math.log10(4.3e6));
  const [rRatio, setRRatio] = useState(1.5);
  const M = 10 ** logM;
  const rs = schwarzschildRadiusM(M);
  const dilation = Math.sqrt(1 - 1 / rRatio);
  const tidalAtHorizon = tidalAcceleration(M, rs);
  const spaghetti = spaghettiRadius(M);
  const outside = spaghetti > rs;

  // Desenho: o horizonte com raio fixo no ecrã; as restantes distâncias à mesma escala
  const size = 260;
  const c = size / 2;
  const unit = 20; // píxeis por raio de Schwarzschild
  const obsR = Math.min(rRatio * unit, c - 8);

  return (
    <VizFrame title={tx.title} kind="calculated" note={tx.note}>
      <div className="viz-horizon">
        <svg viewBox={`0 0 ${size} ${size}`} className="viz-horizon-svg" role="img" aria-label={tx.aria(formatLength(rs))}>
          <circle cx={c} cy={c} r={3 * unit} className="vh-isco" />
          <circle cx={c} cy={c} r={1.5 * unit} className="vh-photon" />
          <circle cx={c} cy={c} r={unit} className="vh-horizon" />
          <line x1={c} y1={c} x2={c + obsR} y2={c} className="vh-ray" />
          <circle cx={c + obsR} cy={c} r={4.5} className="vh-observer" />
          <text x={c} y={c - 3 * unit - 6} textAnchor="middle" className="vh-label">
            {tx.isco}
          </text>
          <text x={c} y={c - 1.5 * unit - 5} textAnchor="middle" className="vh-label">
            {tx.photon}
          </text>
          <text x={c + obsR} y={c + 16} textAnchor="middle" className="vh-label vh-label--obs">
            {formatNumber(rRatio, 2)} rₛ
          </text>
        </svg>
        <div className="viz-controls">
          <label className="field" htmlFor={`${id}-m`}>
            <span className="field-label">
              {tx.mass}: {M >= 1e5 ? formatScientific(M, 3) : formatNumber(M, M < 0.01 ? 7 : 1)} {tx.solarMasses}
            </span>
            <input id={`${id}-m`} type="range" min={-6} max={10.5} step={0.01} value={logM} onChange={(e) => setLogM(Number(e.target.value))} />
          </label>
          <div className="chips">
            {PRESETS.map(([name, m]) => (
              <button key={name} type="button" className={`chip${Math.abs(logM - Math.log10(m)) < 0.005 ? ' is-active' : ''}`} onClick={() => setLogM(Math.log10(m))}>
                {name}
              </button>
            ))}
          </div>
          <dl className="viz-results">
            <div>
              <dt>{tx.rs}</dt>
              <dd>{formatLength(rs)}</dd>
            </div>
            <div>
              <dt>{tx.shadow}</dt>
              <dd>{formatLength(2 * Math.sqrt(27) * (rs / 2))}</dd>
            </div>
            <div>
              <dt>{tx.tidalHorizon}</dt>
              <dd>{tidalAtHorizon >= 1e4 ? `${formatScientific(tidalAtHorizon / 9.80665, 2)} g` : `${formatNumber(tidalAtHorizon / 9.80665, tidalAtHorizon < 1 ? 5 : 1)} g`}</dd>
            </div>
            <div>
              <dt>{tx.spaghetti}</dt>
              <dd>
                {formatLength(spaghetti)} ({outside ? tx.outside : tx.inside})
              </dd>
            </div>
          </dl>
          <label className="field" htmlFor={`${id}-r`}>
            <span className="field-label">{tx.distance(formatNumber(rRatio, 2))}</span>
            <input id={`${id}-r`} type="range" min={1.01} max={10} step={0.01} value={rRatio} onChange={(e) => setRRatio(Number(e.target.value))} />
          </label>
          <p className="viz-big">{tx.dilation(formatNumber(1 / dilation, 1 / dilation < 10 ? 3 : 1))}</p>
        </div>
      </div>
    </VizFrame>
  );
}
