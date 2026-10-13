import { BODIES, tr } from '../../data/catalog';
import type { BodyType, CelestialBody } from '../../data/types';
import type { Route } from '../../app/router';
import type { IconName } from '../../components/Icon';

export interface SearchEntry {
  id: string;
  title: string;
  subtitle: string;
  category: BodyType | 'page' | 'exoplanet';
  /** Termos indexados (nome, nomes alternativos, palavras-chave). */
  terms: string[];
  route: Route;
  /** Objeto que pode ser mostrado no espaço 3D. */
  bodyId?: string;
  accent?: string;
  thumbnail?: string;
  /** Ícone quando não há miniatura de um corpo do Sistema Solar. */
  icon?: IconName;
}

export interface SearchResult {
  entry: SearchEntry;
  score: number;
}

/** Minúsculas e sem acentos: "Júpiter" → "jupiter". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distância de Damerau–Levenshtein (transposições contam como 1). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i]!;
      const prev = d[i - 1]!;
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

function bodyEntry(b: CelestialBody): SearchEntry {
  const name = tr(b.name);
  return {
    id: b.id,
    title: name,
    subtitle: tr(b.tagline),
    category: b.type,
    terms: [name, b.name.en ?? '', b.name.es ?? '', ...b.aliases].filter(Boolean),
    route: { name: 'body', slug: b.slug },
    bodyId: b.id,
    accent: b.render.accent,
    thumbnail: b.render.texture ? `textures/${b.render.texture}-512.jpg` : undefined,
  };
}

const PAGE_ENTRIES: SearchEntry[] = [
  {
    id: 'page:explore',
    title: 'Explorar em 3D',
    subtitle: 'Vista interativa do Sistema Solar na data atual',
    category: 'page',
    terms: ['explorar', 'explore', '3d', 'espaço', 'mapa', 'vista'],
    route: { name: 'explore' },
  },
  {
    id: 'page:solar-system',
    title: 'Sistema Solar',
    subtitle: 'Lista e comparação de todos os objetos',
    category: 'page',
    terms: ['sistema solar', 'solar system', 'planetas', 'planets', 'lista', 'comparar'],
    route: { name: 'solar-system' },
  },
  {
    id: 'page:favorites',
    title: 'Favoritos',
    subtitle: 'Objetos guardados e histórico',
    category: 'page',
    terms: ['favoritos', 'favorites', 'histórico', 'guardados'],
    route: { name: 'favorites' },
  },
  {
    id: 'page:data',
    title: 'Dados e métodos',
    subtitle: 'Fontes, escalas, precisão dos cálculos e créditos',
    category: 'page',
    terms: [
      'dados',
      'métodos',
      'fontes',
      'escala',
      'efemérides',
      'precisão',
      'créditos',
      'licenças',
      'unidade astronómica',
      'sources',
      'credits',
    ],
    route: { name: 'data' },
  },
  {
    id: 'page:exoplanets',
    title: 'Exoplanetas',
    subtitle: 'Catálogo do NASA Exoplanet Archive, gráficos e sistemas',
    category: 'page',
    terms: ['exoplanetas', 'exoplanets', 'planetas extrassolares', 'outras estrelas', 'nasa exoplanet archive'],
    route: { name: 'exoplanets' },
  },
];

export function buildIndex(bodies: readonly CelestialBody[] = BODIES, extra: readonly SearchEntry[] = []): SearchEntry[] {
  return [...bodies.map(bodyEntry), ...PAGE_ENTRIES, ...extra];
}

function scoreTerm(query: string, term: string): number {
  const t = normalize(term);
  if (!t) return 0;
  if (t === query) return 100;
  if (t.startsWith(query)) return 85 - Math.min(10, t.length - query.length);
  const words = t.split(' ');
  if (words.some((w) => w.startsWith(query))) return 70;
  if (t.includes(query)) return 55;
  if (query.length >= 4) {
    const max = query.length >= 7 ? 2 : 1;
    // Um erro no nome completo pesa mais do que num dos termos (ex.: "Saturno IV" de Dione)
    for (const [w, score] of [[t, 45], ...words.map((x) => [x, 35] as const)] as Array<readonly [string, number]>) {
      const candidate = w.slice(0, Math.max(query.length, Math.min(w.length, query.length + 1)));
      if (editDistance(query, w, max) <= max || editDistance(query, candidate, max) <= max) return score;
    }
  }
  return 0;
}

/** Em caso de empate, estrelas e planetas aparecem antes das luas. */
const CATEGORY_ORDER: ReadonlyArray<SearchEntry['category']> = ['star', 'planet', 'dwarf-planet', 'moon', 'page', 'exoplanet'];

export function search(index: readonly SearchEntry[], rawQuery: string, limit = 8): SearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const results: SearchResult[] = [];
  for (const entry of index) {
    let best = 0;
    for (const term of [entry.title, ...entry.terms]) best = Math.max(best, scoreTerm(query, term));
    if (best > 0) results.push({ entry, score: best + (entry.category === 'page' ? -5 : 0) });
  }
  return results
    .sort(
      (a, b) =>
        b.score - a.score ||
        CATEGORY_ORDER.indexOf(a.entry.category) - CATEGORY_ORDER.indexOf(b.entry.category) ||
        a.entry.title.localeCompare(b.entry.title, 'pt-PT'),
    )
    .slice(0, limit);
}
