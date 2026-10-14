import { Suspense, lazy, useEffect, useMemo } from 'react';
import { I18nContext, getMessages } from '../i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { TopBar } from './TopBar';
import { useRoute, type Route } from './router';
import { SearchDialog } from '../features/search/SearchDialog';
import { ShortcutsDialog } from '../components/ShortcutsDialog';
import { SolarSystemPage } from '../features/solar-system/SolarSystemPage';
import { FavoritesPage } from '../features/favorites/FavoritesPage';
import { DataPage } from '../features/about/DataPage';
import { NotFoundPage } from '../features/NotFoundPage';
import { openSearch, isTypingTarget, uiStore } from '../state/ui';

// As secções com 3D (Three.js) são carregadas só quando necessárias.
const ExplorerPage = lazy(() => import('../features/explorer/ExplorerPage'));
const BodyPage = lazy(() => import('../features/body/BodyPage'));
const ExoplanetsPage = lazy(() => import('../features/exoplanets/ExoplanetsPage'));
const ExoplanetPage = lazy(() => import('../features/exoplanets/ExoplanetPage'));
const DeepSkyPage = lazy(() => import('../features/deepsky/DeepSkyPage'));
const DeepSkyObjectPage = lazy(() => import('../features/deepsky/DeepSkyObjectPage'));
const BlackHolesPage = lazy(() => import('../features/deepsky/BlackHolesPage'));
const StarsPage = lazy(() => import('../features/stars/StarsPage'));
const StarPage = lazy(() => import('../features/stars/StarPage'));
const PlanetariumPage = lazy(() => import('../features/planetarium/PlanetariumPage'));
const MissionsPage = lazy(() => import('../features/missions/MissionsPage'));
const MissionPage = lazy(() => import('../features/missions/MissionPage'));

function PageFallback() {
  return (
    <div className="page-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>A carregar…</span>
    </div>
  );
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'explore':
      return <ExplorerPage focus={route.focus} />;
    case 'solar-system':
      return <SolarSystemPage />;
    case 'body':
      return <BodyPage slug={route.slug} />;
    case 'favorites':
      return <FavoritesPage />;
    case 'data':
      return <DataPage />;
    case 'exoplanets':
      return <ExoplanetsPage />;
    case 'exoplanet':
      return <ExoplanetPage slug={route.slug} />;
    case 'deep-sky':
      return <DeepSkyPage />;
    case 'deep-sky-object':
      return <DeepSkyObjectPage id={route.id} />;
    case 'stars':
      return <StarsPage />;
    case 'star':
      return <StarPage slug={route.slug} />;
    case 'black-holes':
      return <BlackHolesPage />;
    case 'planetarium':
      return <PlanetariumPage target={route.target} />;
    case 'missions':
      return <MissionsPage />;
    case 'mission':
      return <MissionPage id={route.id} />;
    default:
      return <NotFoundPage />;
  }
}

const TITLES: Partial<Record<Route['name'], string>> = {
  'solar-system': 'Sistema Solar',
  favorites: 'Favoritos',
  data: 'Dados e métodos',
  exoplanets: 'Exoplanetas',
  'deep-sky': 'Espaço profundo',
  stars: 'Estrelas',
  'black-holes': 'Buracos negros',
  planetarium: 'Planetário',
  missions: 'Missões espaciais',
  'not-found': 'Página não encontrada',
};

export function App() {
  const route = useRoute();
  const i18n = useMemo(() => ({ locale: 'pt-PT' as const, t: getMessages('pt-PT') }), []);
  const routeKey = JSON.stringify(route);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (uiStore.get().searchOpen) return;
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        openSearch();
      } else if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const t = TITLES[route.name];
    if (t) document.title = `${t} — Universe Infinity`;
    else if (route.name === 'explore') document.title = 'Universe Infinity — Explorar o Sistema Solar';
    if (route.name !== 'explore') window.scrollTo({ top: 0 });
  }, [routeKey, route.name]);

  const immersive = route.name === 'explore';

  return (
    <I18nContext.Provider value={i18n}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          // O hash é usado pelo router: em vez de navegar, move o foco para o conteúdo.
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {i18n.t.nav.skipToContent}
      </a>
      <div className={immersive ? 'app app--immersive' : 'app'}>
        <TopBar route={route} />
        <main id="main" className="app-main" tabIndex={-1}>
          <ErrorBoundary resetKey={routeKey}>
            <Suspense fallback={<PageFallback />}>{renderRoute(route)}</Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <SearchDialog />
      <ShortcutsDialog />
    </I18nContext.Provider>
  );
}
