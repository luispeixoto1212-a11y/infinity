import { useCallback, useEffect, useState } from 'react';
import { loadExoplanets, type ExoplanetCatalog } from './exoplanetData';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; catalog: ExoplanetCatalog };

export function useExoplanets(): { state: CatalogState; retry: () => void } {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadExoplanets()
      .then((catalog) => alive && setState({ status: 'ready', catalog }))
      .catch((err: unknown) => alive && setState({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { state, retry };
}
