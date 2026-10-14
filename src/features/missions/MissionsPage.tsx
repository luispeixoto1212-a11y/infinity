import { useMemo, useState } from 'react';
import { href } from '../../app/router';
import { normalize } from '../search/searchIndex';
import { useI18n } from '../../i18n';
import { MissionTimeline, CATEGORY_COLORS } from './MissionTimeline';
import { type MissionCategory, type MissionStatus, MISSIONS, MISSIONS_CHECKED, decimalYear, formatMissionDate } from './missionsData';

const CATEGORY_ORDER: MissionCategory[] = ['earth', 'crewed', 'moon', 'planetary', 'small-bodies', 'telescope', 'sun'];
const STATUS_ORDER: MissionStatus[] = ['active', 'cruise', 'planned', 'completed', 'unconfirmed'];

export const checkedDateText = () => new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${MISSIONS_CHECKED}T12:00:00Z`));

export function StatusBadge({ status }: { status: MissionStatus }) {
  const { t } = useI18n();
  return <span className={`mission-status mission-status--${status}`}>{t.missions.statuses[status]}</span>;
}

export default function MissionsPage() {
  const { t } = useI18n();
  const tm = t.missions;
  const [category, setCategory] = useState<MissionCategory | 'all'>('all');
  const [status, setStatus] = useState<MissionStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query);
    return MISSIONS.filter((m) => (category === 'all' || m.category === category) && (status === 'all' || m.status === status))
      .filter((m) => !q || normalize([m.name, ...m.aliases, ...m.agencies, m.destination].join(' ')).includes(q))
      .sort((a, b) => decimalYear(b.launch) - decimalYear(a.launch));
  }, [category, status, query]);

  return (
    <div className="page missions-page">
      <header className="page-head">
        <h1 className="page-title">{tm.title}</h1>
        <p className="page-lede">{tm.lede}</p>
        <p className="section-note">{tm.checked(checkedDateText())}</p>
      </header>

      <section aria-labelledby="mt-title" className="missions-section">
        <h2 id="mt-title">{tm.timelineTitle}</h2>
        <ul className="mission-legend">
          {CATEGORY_ORDER.map((c) => (
            <li key={c}>
              <span className="mission-swatch" style={{ background: CATEGORY_COLORS[c] }} aria-hidden="true" />
              {tm.categories[c]}
            </li>
          ))}
        </ul>
        <MissionTimeline missions={MISSIONS} />
        <p className="section-note">{tm.timelineNote}</p>
      </section>

      <section aria-label={tm.filters.category} className="missions-section">
        <div className="mission-filters">
          <div className="chips" role="group" aria-label={tm.filters.category}>
            {(['all', ...CATEGORY_ORDER] as const).map((c) => (
              <button key={c} type="button" className={`chip${category === c ? ' is-active' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c === 'all' ? tm.filters.all : tm.categories[c]}
              </button>
            ))}
          </div>
          <div className="chips" role="group" aria-label={tm.filters.status}>
            {(['all', ...STATUS_ORDER] as const).map((s) => (
              <button key={s} type="button" className={`chip${status === s ? ' is-active' : ''}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {s === 'all' ? tm.filters.all : tm.statuses[s]}
              </button>
            ))}
          </div>
          <label className="field mission-search">
            <span className="visually-hidden">{tm.filters.search}</span>
            <input type="search" placeholder={tm.filters.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <span className="catalog-count" aria-live="polite">
            {tm.count(filtered.length)}
          </span>
        </div>
        {filtered.length === 0 ? <p className="section-note">{tm.empty}</p> : null}
        <ul className="mission-grid">
          {filtered.map((m) => (
            <li key={m.id}>
              <a className="mission-card" href={href({ name: 'mission', id: m.id })} style={{ ['--mission-color' as string]: CATEGORY_COLORS[m.category] }}>
                <span className="mission-card-top">
                  <span className="mission-kicker">
                    {tm.categories[m.category]} · {m.agencies.join(', ')}
                  </span>
                  <StatusBadge status={m.status} />
                </span>
                <span className="mission-card-name">{m.name}</span>
                <span className="mission-card-dest">{m.destination}</span>
                <span className="mission-card-date">
                  {decimalYear(m.launch) > decimalYear(MISSIONS_CHECKED) ? tm.launchPlanned : tm.launched}: {formatMissionDate(m.launch)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
