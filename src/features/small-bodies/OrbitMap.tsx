import { useMemo } from 'react';
import type { MajorPlanetKey } from '../../core/astro/elements';
import { formatNumber } from '../../core/format';
import { planetPositionAu, samplePlanetOrbitAu } from '../../core/astro/kepler';
import { type EpochElements, sampleSmallBodyOrbit, smallBodyPositionAu } from '../../core/astro/smallBody';
import type { Vec3 } from '../../core/astro/vector';
import { useI18n } from '../../i18n';

export interface OrbitMapBody {
  id: string;
  name: string;
  color: string;
  epochs: EpochElements[];
}

const PLANETS: { key: MajorPlanetKey; name: string; label: boolean }[] = [
  { key: 'mercury', name: 'Mercúrio', label: false },
  { key: 'venus', name: 'Vénus', label: false },
  { key: 'emb', name: 'Terra', label: true },
  { key: 'mars', name: 'Marte', label: false },
  { key: 'jupiter', name: 'Júpiter', label: true },
  { key: 'saturn', name: 'Saturno', label: true },
  { key: 'uranus', name: 'Úrano', label: true },
  { key: 'neptune', name: 'Neptuno', label: true },
];

const SIZE = 520;
const R = SIZE / 2 - 14;

/**
 * Vista de cima do plano da eclíptica (x para o ponto vernal, y a 90° de longitude), com as distâncias comprimidas
 * pela raiz quadrada (como na vista 3D) até `maxAu`. As órbitas que saem desse raio são cortadas.
 */
export function OrbitMap({ bodies, jd, maxAu, labelBodies, ariaLabel }: { bodies: OrbitMapBody[]; jd: number; maxAu: number; labelBodies: boolean; ariaLabel: string }) {
  const { t } = useI18n();
  const ts = t.smallBodies;
  const project = useMemo(() => {
    const k = R / Math.sqrt(maxAu);
    return (v: Vec3): [number, number] => {
      const r = Math.hypot(v.x, v.y);
      if (r === 0) return [0, 0];
      const s = (k * Math.sqrt(r)) / r;
      return [v.x * s, -v.y * s];
    };
  }, [maxAu]);

  const path = (pts: Vec3[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${project(p).map((c) => c.toFixed(1)).join(' ')}`).join('');

  const planets = PLANETS.map((p) => {
    const orbit = samplePlanetOrbitAu(p.key, jd, 128);
    const a = Math.max(...orbit.map((v) => Math.hypot(v.x, v.y)));
    return { ...p, a, d: path(orbit), pos: project(planetPositionAu(p.key, jd)) };
  }).filter((p) => p.a < maxAu * 1.3);

  const smalls = bodies.map((b) => ({
    ...b,
    d: path(sampleSmallBodyOrbit(b.epochs, jd, 260, maxAu * 3)),
    pos: project(smallBodyPositionAu(b.epochs, jd)),
  }));

  const ticks = [1, 5, 10, 30, 50, 100, 200, 500, 1000].filter((r) => r <= maxAu);

  return (
    <figure className="orbit-map">
      <svg viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`} role="img" aria-label={ariaLabel}>
        <defs>
          <clipPath id={`orbit-clip-${Math.round(maxAu)}`}>
            <circle r={R} />
          </clipPath>
        </defs>
        <circle r={R} className="om-bg" />
        {ticks.map((r) => {
          const rr = (R * Math.sqrt(r)) / Math.sqrt(maxAu);
          return (
            <g key={r}>
              <circle r={rr} className="om-ring" />
              <text x={rr * Math.SQRT1_2 + 3} y={-rr * Math.SQRT1_2 - 3} className="om-tick">
                {formatNumber(r, 0)} UA
              </text>
            </g>
          );
        })}
        <g clipPath={`url(#orbit-clip-${Math.round(maxAu)})`}>
          {planets.map((p) => (
            <path key={p.key} d={p.d} className="om-planet-orbit" />
          ))}
          {smalls.map((b) => (
            <path key={b.id} d={b.d} className="om-orbit" stroke={b.color} />
          ))}
        </g>
        <circle r={5} className="om-sun" />
        {planets.map((p) => (
          <g key={p.key} transform={`translate(${p.pos[0].toFixed(1)} ${p.pos[1].toFixed(1)})`}>
            <circle r={p.key === 'emb' ? 3.5 : 2.6} className={p.key === 'emb' ? 'om-earth' : 'om-planet'} />
            {p.label ? (
              <text x={5} y={-5} className="om-planet-label">
                {p.name}
              </text>
            ) : null}
          </g>
        ))}
        {smalls.map((b) =>
          Math.hypot(b.pos[0], b.pos[1]) <= R + 1 ? (
            <g key={b.id} transform={`translate(${b.pos[0].toFixed(1)} ${b.pos[1].toFixed(1)})`}>
              <circle r={labelBodies ? 5 : 3.6} fill={b.color} className="om-body" />
              {labelBodies ? (
                <text x={8} y={4} className="om-body-label">
                  {b.name} ({ts.today})
                </text>
              ) : null}
            </g>
          ) : null,
        )}
      </svg>
      <figcaption className="section-note">{ts.orbitMapNote(formatNumber(maxAu, 0))}</figcaption>
    </figure>
  );
}
