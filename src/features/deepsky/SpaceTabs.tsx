import { href, type Route } from '../../app/router';
import { useI18n } from '../../i18n';

/** Navegação entre as secções do espaço profundo. */
export function SpaceTabs({ current }: { current: 'deep-sky' | 'stars' | 'star-map' | 'black-holes' | 'extreme' }) {
  const { t } = useI18n();
  const items: Array<{ key: typeof current; route: Route; label: string }> = [
    { key: 'deep-sky', route: { name: 'deep-sky' }, label: t.space.tabs.deepSky },
    { key: 'stars', route: { name: 'stars' }, label: t.space.tabs.stars },
    { key: 'star-map', route: { name: 'star-map' }, label: t.space.tabs.starMap },
    { key: 'black-holes', route: { name: 'black-holes' }, label: t.space.tabs.blackHoles },
    { key: 'extreme', route: { name: 'extreme' }, label: t.space.tabs.extreme },
  ];
  return (
    <nav className="space-tabs" aria-label={t.space.tabsLabel}>
      {items.map((it) => (
        <a key={it.key} href={href(it.route)} aria-current={it.key === current ? 'page' : undefined} className={it.key === current ? 'is-active' : undefined}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
