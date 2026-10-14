import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import { openSearch } from '../state/ui';
import { href, type Route } from './router';

interface NavItem {
  route: Route;
  label: string;
  match: Route['name'][];
}

export function TopBar({ route }: { route: Route }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [route]);

  const items: NavItem[] = [
    { route: { name: 'explore' }, label: t.nav.explore, match: ['explore'] },
    { route: { name: 'solar-system' }, label: t.nav.solarSystem, match: ['solar-system', 'body'] },
    { route: { name: 'deep-sky' }, label: t.nav.deepSpace, match: ['deep-sky', 'deep-sky-object', 'stars', 'star', 'black-holes'] },
    { route: { name: 'exoplanets' }, label: t.nav.exoplanets, match: ['exoplanets', 'exoplanet'] },
    { route: { name: 'favorites' }, label: t.nav.favorites, match: ['favorites'] },
    { route: { name: 'data' }, label: t.nav.data, match: ['data'] },
  ];

  return (
    <header className="topbar">
      <a className="brand" href={href({ name: 'explore' })} aria-label={`${t.appName}, ${t.nav.explore}`}>
        <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <ellipse cx="16" cy="16" rx="13" ry="5.2" transform="rotate(-24 16 16)" />
          <circle cx="16" cy="16" r="4.2" />
          <circle cx="27.2" cy="11" r="1.4" />
        </svg>
        <span className="brand-name">
          Universe <em>Infinity</em>
        </span>
      </a>

      <nav className={menuOpen ? 'nav is-open' : 'nav'} aria-label="Principal">
        <ul>
          {items.map((it) => {
            const active = it.match.includes(route.name);
            return (
              <li key={it.label}>
                <a href={href(it.route)} aria-current={active ? 'page' : undefined} className={active ? 'is-active' : undefined}>
                  {it.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="topbar-actions">
        <button type="button" className="search-trigger" onClick={openSearch} aria-label={t.search.open}>
          <Icon name="search" size={18} />
          <span className="search-trigger-text">{t.search.open}</span>
          <kbd>{t.search.shortcutHint}</kbd>
        </button>
        <button
          type="button"
          className="icon-btn nav-toggle"
          aria-expanded={menuOpen}
          aria-label={t.nav.menu}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
      </div>
    </header>
  );
}
