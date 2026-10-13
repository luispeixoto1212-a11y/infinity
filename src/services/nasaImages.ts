/**
 * Cliente da NASA Image and Video Library (https://images-api.nasa.gov), sem chave de API.
 * Os títulos, datas e créditos apresentados vêm da própria resposta da API — nada é inventado.
 */

export interface NasaImage {
  nasaId: string;
  title: string;
  description?: string;
  center?: string;
  credit?: string;
  dateCreated?: string;
  thumbUrl: string;
  detailsUrl: string;
}

const API = 'https://images-api.nasa.gov/search';
const TIMEOUT_MS = 12_000;
const memoryCache = new Map<string, NasaImage[]>();

interface RawItem {
  data?: Array<Record<string, unknown>>;
  links?: Array<Record<string, unknown>>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Converte e valida um item da API; devolve null se faltar informação essencial. */
export function parseNasaItem(item: unknown): NasaImage | null {
  if (typeof item !== 'object' || item === null) return null;
  const raw = item as RawItem;
  const data = raw.data?.[0];
  const link = raw.links?.find((l) => str(l.href) && (l.rel === 'preview' || l.render === 'image')) ?? raw.links?.[0];
  if (!data || !link) return null;
  const nasaId = str(data.nasa_id);
  const title = str(data.title);
  const thumb = str(link.href);
  if (!nasaId || !title || !thumb || data.media_type !== 'image') return null;
  if (!/^https:\/\//.test(thumb)) return null;
  const photographer = str(data.photographer);
  const secondary = str(data.secondary_creator);
  const center = str(data.center);
  return {
    nasaId,
    title,
    description: str(data.description),
    center,
    credit: photographer ?? secondary ?? (center ? `NASA/${center}` : 'NASA'),
    dateCreated: str(data.date_created),
    thumbUrl: thumb,
    detailsUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
  };
}

export function parseNasaResponse(json: unknown): NasaImage[] {
  if (typeof json !== 'object' || json === null) throw new Error('Resposta inválida');
  const items = (json as { collection?: { items?: unknown } }).collection?.items;
  if (!Array.isArray(items)) throw new Error('Resposta sem a lista de resultados');
  return items.map(parseNasaItem).filter((x): x is NasaImage => x !== null);
}

/** Mantém apenas imagens cujo título refere o objeto, sem duplicados. */
export function filterRelevant(images: NasaImage[], mustInclude: string[], max: number): NasaImage[] {
  const terms = mustInclude.map((t) => new RegExp(`(^|[^a-z])${t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`));
  const seen = new Set<string>();
  const out: NasaImage[] = [];
  for (const img of images) {
    const title = img.title.toLowerCase();
    if (!terms.some((t) => t.test(title))) continue;
    const key = title.replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(img);
    if (out.length >= max) break;
  }
  return out;
}

export async function searchNasaImages(
  query: string,
  mustInclude: string[],
  options: { signal?: AbortSignal; max?: number; fetchImpl?: typeof fetch } = {},
): Promise<NasaImage[]> {
  const max = options.max ?? 8;
  const key = `${query}|${mustInclude.join(',')}|${max}`;
  const cached = memoryCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);
  try {
    const url = `${API}?q=${encodeURIComponent(query)}&media_type=image&page_size=60`;
    const res = await (options.fetchImpl ?? fetch)(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`A API respondeu com o estado ${res.status}`);
    const images = filterRelevant(parseNasaResponse(await res.json()), mustInclude, max);
    memoryCache.set(key, images);
    return images;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}
