import { exoSlug } from '../exoplanets/exoplanetData';
import { FEATURED_EXOPLANETS } from '../exoplanets/featured';
import type { SearchEntry } from './searchIndex';

const METHOD_LABEL: Record<string, string> = {
  transit: 'trânsito',
  rv: 'velocidade radial',
  microlensing: 'microlente',
  imaging: 'imagem direta',
  timing: 'variações de tempo',
  other: 'outro método',
};

type Row = [name: string, host: string, year: number | null, method: string, alt: string | null];

export function exoplanetEntries(rows: readonly Row[]): SearchEntry[] {
  const featured = new Map(FEATURED_EXOPLANETS.map((f) => [f.name, f]));
  return rows.map(([name, host, year, method, alt]) => {
    const f = featured.get(name);
    return {
      id: `exo:${exoSlug(name)}`,
      title: f?.displayName ?? name,
      subtitle: `Exoplaneta de ${host}${year ? `, descoberto em ${year}` : ''} (${METHOD_LABEL[method] ?? method})`,
      category: 'exoplanet' as const,
      terms: [name, host, ...(f?.displayName ? [f.displayName] : []), ...(alt ? alt.split('|') : [])],
      route: { name: 'exoplanet' as const, slug: exoSlug(name) },
      icon: 'orbit' as const,
    };
  });
}

let promise: Promise<SearchEntry[]> | null = null;

/** Índice leve dos exoplanetas para a pesquisa global, pedido só quando a pesquisa é aberta. */
export function loadExoplanetSearchEntries(fetchImpl: typeof fetch = fetch): Promise<SearchEntry[]> {
  if (!promise) {
    promise = fetchImpl('data/exoplanet-index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ rows: Row[] }>;
      })
      .then((data) => exoplanetEntries(data.rows))
      .catch((err: unknown) => {
        promise = null;
        throw err;
      });
  }
  return promise;
}
