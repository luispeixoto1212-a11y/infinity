import { useId, useMemo, useState } from 'react';
import { PLANCK18, summarizeRedshift } from '../../core/astro/cosmology';
import { formatNumber } from '../../core/format';
import { useI18n } from '../../i18n';
import { formatYears } from './timeScale';

/** Objetos com desvio para o vermelho medido, para exemplos rápidos. */
export const REDSHIFT_PRESETS: Array<{ id: string; label: string; z: number; note: string }> = [
  { id: 'coma', label: 'Enxame de Coma', z: 0.0231, note: 'Enxame de galáxias próximo' },
  { id: '3c273', label: 'Quasar 3C 273', z: 0.158, note: 'O primeiro quasar identificado (1963)' },
  { id: 'gn-z11', label: 'GN-z11', z: 10.6, note: 'Galáxia confirmada pelo James Webb' },
  { id: 'jades', label: 'JADES-GS-z14-0', z: 14.32, note: 'Galáxia confirmada em 2024' },
  { id: 'mom', label: 'MoM-z14', z: 14.44, note: 'Galáxia mais distante confirmada (2025)' },
  { id: 'cmb', label: 'Radiação cósmica de fundo', z: 1089.8, note: 'A luz mais antiga que se pode ver' },
];

const Z_MAX = 1100;
const toSlider = (z: number) => Math.log(1 + z) / Math.log(1 + Z_MAX);
const fromSlider = (s: number) => Math.exp(s * Math.log(1 + Z_MAX)) - 1;

const gly = (v: number) => (v >= 1 ? `${formatNumber(v, v >= 10 ? 1 : 2)} mil milhões de anos-luz` : `${formatNumber(v * 1000, 0)} milhões de anos-luz`);

/** Calculadora: para um desvio para o vermelho, idade, tempo de viagem da luz e distâncias. */
export function CosmologyCalculator() {
  const { t } = useI18n();
  const tc = t.timeline.calc;
  const id = useId();
  const [z, setZ] = useState(14.32);
  const [text, setText] = useState('14,32');
  const r = useMemo(() => summarizeRedshift(z, PLANCK18), [z]);
  const maxBar = Math.max(r.distanceNowGly, r.lookbackGyr, r.distanceThenGly);

  const setFromText = (v: string) => {
    setText(v);
    const n = Number(v.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0 && n <= Z_MAX) setZ(n);
  };
  const setValue = (v: number) => {
    setZ(v);
    setText(formatNumber(v, v < 1 ? 4 : 2));
  };

  const bars: Array<[string, number, string, string]> = [
    [tc.barThen, r.distanceThenGly, gly(r.distanceThenGly), 'then'],
    [tc.barLight, r.lookbackGyr, gly(r.lookbackGyr), 'light'],
    [tc.barNow, r.distanceNowGly, gly(r.distanceNowGly), 'now'],
  ];

  return (
    <div className="cosmo-calc">
      <div className="cosmo-inputs">
        <label className="field" htmlFor={`${id}-z`}>
          <span className="field-label">{tc.redshift}</span>
          <input id={`${id}-z`} inputMode="decimal" value={text} onChange={(e) => setFromText(e.target.value)} aria-describedby={`${id}-help`} />
        </label>
        <label className="field cosmo-slider">
          <span className="visually-hidden">{tc.slider}</span>
          <input type="range" min={0} max={1} step={0.001} value={toSlider(z)} onChange={(e) => setValue(fromSlider(Number(e.target.value)))} aria-valuetext={`z = ${formatNumber(z, 2)}`} />
        </label>
        <p id={`${id}-help`} className="section-note">
          {tc.help}
        </p>
        <div className="chips">
          {REDSHIFT_PRESETS.map((p) => (
            <button key={p.id} type="button" className={`chip${Math.abs(z - p.z) < 1e-6 ? ' is-active' : ''}`} onClick={() => setValue(p.z)} title={p.note}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <dl className="cosmo-results" aria-live="polite">
        <div>
          <dt>{tc.age}</dt>
          <dd>{formatYears(r.ageAtEmissionGyr * 1e9)}</dd>
        </div>
        <div>
          <dt>{tc.lookback}</dt>
          <dd>{formatYears(r.lookbackGyr * 1e9)}</dd>
        </div>
        <div>
          <dt>{tc.now}</dt>
          <dd>{gly(r.distanceNowGly)}</dd>
        </div>
        <div>
          <dt>{tc.then}</dt>
          <dd>{gly(r.distanceThenGly)}</dd>
        </div>
        <div>
          <dt>{tc.size}</dt>
          <dd>{tc.sizeValue(formatNumber(1 + z, 1 + z < 10 ? 3 : 0))}</dd>
        </div>
        <div>
          <dt>{tc.luminosity}</dt>
          <dd>{gly(r.luminosityDistanceGly)}</dd>
        </div>
      </dl>
      <div className="cosmo-bars" role="img" aria-label={tc.barsAria(gly(r.distanceThenGly), gly(r.lookbackGyr), gly(r.distanceNowGly))}>
        {bars.map(([label, v, txt, cls]) => (
          <div key={cls} className="cosmo-bar-row">
            <span className="cosmo-bar-label">{label}</span>
            <span className="cosmo-bar-track">
              <span className={`cosmo-bar cosmo-bar--${cls}`} style={{ width: `${Math.max(0.5, (v / maxBar) * 100)}%` }} />
            </span>
            <span className="cosmo-bar-value">{txt}</span>
          </div>
        ))}
      </div>
      <p className="section-note">{tc.note}</p>
    </div>
  );
}
