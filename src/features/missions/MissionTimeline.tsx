import { href } from '../../app/router';
import { useI18n } from '../../i18n';
import { type Mission, type MissionCategory, MISSIONS_CHECKED, decimalYear } from './missionsData';

export const CATEGORY_COLORS: Record<MissionCategory, string> = {
  earth: '#5fc2e8',
  crewed: '#ffc874',
  moon: '#d9d6cf',
  planetary: '#7aa2ff',
  'small-bodies': '#7fd6c2',
  telescope: '#c3a6ff',
  sun: '#ff9d6b',
};

const START = 1955;
const END = 2037;
const ROW = 19;
const LABEL_W = 210;
const PAD_TOP = 26;
const PAD_BOTTOM = 22;

/** Linha do tempo das missões (SVG): barra do lançamento ao fim, tracejado para o que está planeado. */
export function MissionTimeline({ missions }: { missions: readonly Mission[] }) {
  const { t } = useI18n();
  const tm = t.missions;
  const width = 1000;
  const plotW = width - LABEL_W - 16;
  const x = (year: number) => LABEL_W + ((year - START) / (END - START)) * plotW;
  const today = decimalYear(MISSIONS_CHECKED);
  const rows = [...missions].sort((a, b) => decimalYear(a.launch) - decimalYear(b.launch));
  const height = PAD_TOP + rows.length * ROW + PAD_BOTTOM;
  const ticks: number[] = [];
  for (let y = 1960; y <= 2035; y += 5) ticks.push(y);

  return (
    <div className="mission-timeline-scroll">
      <svg className="mission-timeline" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={tm.timelineAria}>
        {ticks.map((y) => (
          <g key={y}>
            <line x1={x(y)} x2={x(y)} y1={PAD_TOP - 6} y2={height - 6} className="mt-grid" />
            <text x={x(y)} y={14} className="mt-tick" textAnchor="middle">
              {y}
            </text>
          </g>
        ))}
        <line x1={x(today)} x2={x(today)} y1={PAD_TOP - 6} y2={height - 16} className="mt-today" />
        <text x={x(today)} y={height - 4} className="mt-today-label" textAnchor="middle">
          {tm.today}
        </text>
        {rows.map((m, i) => {
          const y = PAD_TOP + i * ROW + ROW / 2;
          const launch = decimalYear(m.launch);
          const future = launch > today;
          const solidEnd = m.end ? decimalYear(m.end) : future ? launch : today;
          const dashedEnd = m.plannedUntil ? decimalYear(m.plannedUntil) : solidEnd;
          const color = CATEGORY_COLORS[m.category];
          return (
            <a key={m.id} href={href({ name: 'mission', id: m.id })} className="mt-row">
              <title>{`${m.name}: ${tm.statuses[m.status]}`}</title>
              <rect x={0} y={y - ROW / 2} width={width} height={ROW} className="mt-hit" />
              <text x={LABEL_W - 10} y={y + 4} textAnchor="end" className="mt-label">
                {m.name.replace('Telescópio Espacial ', '')}
              </text>
              {!future ? (
                <line x1={x(launch)} x2={Math.max(x(solidEnd), x(launch) + 3)} y1={y} y2={y} stroke={color} strokeWidth={7} strokeLinecap="round" />
              ) : null}
              {dashedEnd > solidEnd ? (
                <line x1={x(solidEnd)} x2={x(dashedEnd)} y1={y} y2={y} stroke={color} strokeWidth={3} strokeDasharray="3 4" opacity={0.85} />
              ) : null}
              {future ? <circle cx={x(launch)} cy={y} r={4.5} fill="none" stroke={color} strokeWidth={2} /> : null}
            </a>
          );
        })}
      </svg>
    </div>
  );
}
