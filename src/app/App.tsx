import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { I18nContext, getMessages } from '../i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { TopBar } from './TopBar';
import { useRoute, type Route } from './router';
import { NotFoundPage } from '../features/NotFoundPage';
import { TourOffer } from '../features/onboarding/TourOffer';
import { openSearch, isTypingTarget, uiStore, useUi } from '../state/ui';

// As secções com 3D (Three.js) são carregadas só quando necessárias.
const ExplorerPage = lazy(() => import('../features/explorer/ExplorerPage'));
// Cada secção é um pedaço de código separado, carregado só quando é aberto.
const SolarSystemPage = lazy(() => import('../features/solar-system/SolarSystemPage').then((m) => ({ default: m.SolarSystemPage })));
const FavoritesPage = lazy(() => import('../features/favorites/FavoritesPage').then((m) => ({ default: m.FavoritesPage })));
const DataPage = lazy(() => import('../features/about/DataPage').then((m) => ({ default: m.DataPage })));
const loadSearchDialog = () => import('../features/search/SearchDialog');
const SearchDialog = lazy(() => loadSearchDialog().then((m) => ({ default: m.SearchDialog })));
const ShortcutsDialog = lazy(() => import('../components/ShortcutsDialog').then((m) => ({ default: m.ShortcutsDialog })));
const Tour = lazy(() => import('../features/onboarding/Tour').then((m) => ({ default: m.Tour })));
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
const TimelinePage = lazy(() => import('../features/timeline/TimelinePage'));
const ExtremePage = lazy(() => import('../features/extreme/ExtremePage'));
const MissionPage = lazy(() => import('../features/missions/MissionPage'));
const SmallBodiesPage = lazy(() => import('../features/small-bodies/SmallBodiesPage'));
const SmallBodyPage = lazy(() => import('../features/small-bodies/SmallBodyPage'));

/**
 * Diálogos globais (pesquisa, atalhos e visita guiada): o código só é pedido na primeira abertura e o da pesquisa é
 * pré-carregado quando o navegador fica livre, para Ctrl K continuar instantâneo.
 */
function GlobalDialogs() {
  const { searchOpen, shortcutsOpen, tourOpen } = useUi();
  const [searchUsed, setSearchUsed] = useState(false);
  const [shortcutsUsed, setShortcutsUsed] = useState(false);
  const [tourUsed, setTourUsed] = useState(false);
  if (searchOpen && !searchUsed) setSearchUsed(true);
  if (shortcutsOpen && !shortcutsUsed) setShortcutsUsed(true);
  if (tourOpen && !tourUsed) setTourUsed(true);
  useEffect(() => {
    const idle = (cb: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2500));
    idle(() => {
      void loadSearchDialog().catch(() => undefined);
    });
  }, []);
  return (
    <Suspense fallback={null}>
      {searchUsed ? <SearchDialog /> : null}
      {shortcutsUsed ? <ShortcutsDialog /> : null}
      {tourUsed ? <Tour /> : null}
    </Suspense>
  );
}

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
    case 'timeline':
      return <TimelinePage />;
    case 'extreme':
      return <ExtremePage topic={route.topic} />;
    case 'mission':
      return <MissionPage id={route.id} />;
    case 'small-bodies':
      return <SmallBodiesPage />;
    case 'small-body':
      return <SmallBodyPage slug={route.slug} />;
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
  timeline: 'Linha temporal do Universo',
  extreme: 'Fenómenos extremos',
  'small-bodies': 'Asteroides e cometas',
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
      <TourOffer route={route} />
      <GlobalDialogs />
    </I18nContext.Provider>
  );
}
