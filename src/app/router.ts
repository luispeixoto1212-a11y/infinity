import { useSyncExternalStore } from 'react';

/**
 * Router baseado no hash (#/rota). Funciona em qualquer alojamento estático
 * (GitHub Pages, ficheiros locais) sem configurar o servidor.
 */

export type Route =
  | { name: 'explore'; focus?: string }
  | { name: 'solar-system' }
  | { name: 'body'; slug: string }
  | { name: 'favorites' }
  | { name: 'data' }
  | { name: 'not-found'; path: string };

export function parseHash(hash: string): Route {
  const path = decodeURIComponent(hash.replace(/^#/, '')).replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'explore' };
  const [head, arg, ...rest] = parts;
  if (rest.length > 0) return { name: 'not-found', path };
  switch (head) {
    case 'explorar':
      return arg ? { name: 'explore', focus: arg } : { name: 'explore' };
    case 'sistema-solar':
      return arg ? { name: 'not-found', path } : { name: 'solar-system' };
    case 'objeto':
      return arg ? { name: 'body', slug: arg } : { name: 'not-found', path };
    case 'favoritos':
      return arg ? { name: 'not-found', path } : { name: 'favorites' };
    case 'dados':
      return arg ? { name: 'not-found', path } : { name: 'data' };
    default:
      return { name: 'not-found', path };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'explore':
      return route.focus ? `#/explorar/${route.focus}` : '#/';
    case 'solar-system':
      return '#/sistema-solar';
    case 'body':
      return `#/objeto/${route.slug}`;
    case 'favorites':
      return '#/favoritos';
    case 'data':
      return '#/dados';
    case 'not-found':
      return `#${route.path}`;
  }
}

export function href(route: Route): string {
  return routeToHash(route);
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const hash = routeToHash(route);
  if (options.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (location.hash !== hash) {
    location.hash = hash;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const getHash = () => location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return parseHash(hash);
}
