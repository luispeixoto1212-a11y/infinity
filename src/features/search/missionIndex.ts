import type { SearchEntry } from './searchIndex';

/** Missões espaciais para a pesquisa global (o módulo de dados só é carregado quando a pesquisa abre). */
export async function loadMissionSearchEntries(): Promise<SearchEntry[]> {
  const { MISSIONS } = await import('../missions/missionsData');
  return MISSIONS.map((m) => ({
    id: `mission:${m.id}`,
    title: m.name,
    subtitle: `${m.agencies.join(', ')} · ${m.destination}`,
    category: 'mission' as const,
    terms: [m.name, ...m.aliases, ...m.agencies],
    route: { name: 'mission' as const, id: m.id },
    icon: 'orbit' as const,
  }));
}
