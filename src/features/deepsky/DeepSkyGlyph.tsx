import type { DeepSkySubtype } from './deepSkyData';

/** Cor de referência por tipo de objeto (ícones e marcas no mapa do céu). */
export const SUBTYPE_COLOR: Record<DeepSkySubtype, string> = {
  spiral: '#9dbbff',
  'barred-spiral': '#9dbbff',
  elliptical: '#c9b8ff',
  lenticular: '#b9c6ff',
  irregular: '#9dbbff',
  galaxy: '#9dbbff',
  globular: '#ffd28a',
  open: '#ffe7b3',
  emission: '#f4a6c6',
  reflection: '#8fb8ff',
  planetary: '#7fd6c2',
  snr: '#ffb27a',
  'star-cloud': '#e6e2d3',
  'double-star': '#e9edf8',
  asterism: '#e9edf8',
};

/** Pontos pseudoaleatórios estáveis (para enxames). */
function dots(n: number, spread: number, seed: number, concentration: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < n; i += 1) {
    const a = rnd() * Math.PI * 2;
    const r = spread * Math.pow(rnd(), concentration);
    out.push([24 + Math.cos(a) * r, 24 + Math.sin(a) * r, 0.6 + rnd() * 1.1]);
  }
  return out;
}

/** Ícone ilustrativo do tipo de objeto (não é uma imagem do objeto). */
export function DeepSkyGlyph({ subtype, size = 48 }: { subtype: DeepSkySubtype; size?: number }) {
  const c = SUBTYPE_COLOR[subtype];
  const common = { width: size, height: size, viewBox: '0 0 48 48', 'aria-hidden': true as const, className: 'dso-glyph' };
  switch (subtype) {
    case 'spiral':
    case 'barred-spiral':
    case 'irregular':
    case 'galaxy':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id={`g-core-${subtype}`}>
              <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform="rotate(-25 24 24)" fill="none" stroke={c} strokeLinecap="round" strokeWidth="2.2" opacity="0.85">
            {subtype === 'barred-spiral' ? <path d="M15 24h18" strokeWidth="3" /> : null}
            <path d={subtype === 'barred-spiral' ? 'M33 24c0-9-9-14-17-10' : 'M24 24c6-1 9-8 3-12-7-4-16 2-15 10'} />
            <path d={subtype === 'barred-spiral' ? 'M15 24c0 9 9 14 17 10' : 'M24 24c-6 1-9 8-3 12 7 4 16-2 15-10'} />
          </g>
          <circle cx="24" cy="24" r="7" fill={`url(#g-core-${subtype})`} />
        </svg>
      );
    case 'elliptical':
    case 'lenticular':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id={`g-ell-${subtype}`}>
              <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="0.35" stopColor={c} stopOpacity="0.7" />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="24" cy="24" rx="19" ry={subtype === 'lenticular' ? 6 : 13} fill={`url(#g-ell-${subtype})`} transform="rotate(-20 24 24)" />
          {subtype === 'lenticular' ? <path d="M7 27.5 41 18" stroke="#070b19" strokeWidth="1.4" opacity="0.8" /> : null}
        </svg>
      );
    case 'globular':
    case 'open':
    case 'star-cloud':
      return (
        <svg {...common}>
          {(subtype === 'globular' ? dots(70, 18, 7, 1.9) : subtype === 'open' ? dots(16, 18, 11, 0.8) : dots(60, 21, 5, 0.6)).map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={subtype === 'globular' ? r * 0.8 : r} fill={c} opacity={subtype === 'star-cloud' ? 0.55 : 0.9} />
          ))}
        </svg>
      );
    case 'planetary':
      return (
        <svg {...common}>
          <ellipse cx="24" cy="24" rx="14" ry="12" fill="none" stroke={c} strokeWidth="5" opacity="0.75" />
          <ellipse cx="24" cy="24" rx="9" ry="7.5" fill={c} opacity="0.18" />
          <circle cx="24" cy="24" r="1.8" fill="#fff" />
        </svg>
      );
    case 'snr':
      return (
        <svg {...common} fill="none" stroke={c} strokeLinecap="round" strokeWidth="1.6" opacity="0.9">
          <path d="M10 22c3-9 13-13 21-9 8 4 9 15 3 21-6 6-17 6-22-1" />
          <path d="M15 21c3-5 10-7 15-3M17 31c4 3 11 3 15-2M13 26l5 2M31 15l2 6M26 33l3 3" opacity="0.7" />
          <circle cx="24" cy="24" r="1.6" fill="#fff" stroke="none" />
        </svg>
      );
    case 'emission':
    case 'reflection':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id={`g-neb-${subtype}`}>
              <stop offset="0" stopColor={c} stopOpacity="0.85" />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="20" cy="22" r="14" fill={`url(#g-neb-${subtype})`} />
          <circle cx="30" cy="27" r="11" fill={`url(#g-neb-${subtype})`} opacity="0.8" />
          <circle cx="25" cy="17" r="8" fill={`url(#g-neb-${subtype})`} opacity="0.7" />
          <circle cx="23" cy="24" r="1.6" fill="#fff" />
          <circle cx="30" cy="20" r="1.1" fill="#fff" />
        </svg>
      );
    case 'double-star':
      return (
        <svg {...common}>
          <circle cx="19" cy="25" r="3.4" fill={c} />
          <circle cx="29" cy="21" r="2.6" fill={c} opacity="0.8" />
        </svg>
      );
    case 'asterism':
      return (
        <svg {...common}>
          {[
            [16, 16],
            [24, 26],
            [33, 18],
            [24, 36],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.2" fill={c} />
          ))}
        </svg>
      );
  }
}
