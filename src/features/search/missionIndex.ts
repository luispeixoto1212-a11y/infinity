import type { SearchEntry } from './searchIndex';

/** Missões espaciais e conceitos científicos para a pesquisa global (carregados quando a pesquisa abre). */
export async function loadMissionSearchEntries(): Promise<SearchEntry[]> {
  const [{ MISSIONS }, { TOPICS }] = await Promise.all([import('../missions/missionsData'), import('../extreme/topics')]);
  const concepts: SearchEntry[] = TOPICS.map((tp) => ({
    id: `concept:${tp.id}`,
    title: tp.title,
    subtitle: `Fenómenos extremos · ${tp.summary}`,
    category: 'concept' as const,
    terms: [tp.title, ...tp.terms],
    route: { name: 'extreme' as const, topic: tp.id },
    icon: 'info' as const,
  }));
  return [...concepts, ...MISSIONS.map((m) => ({
    id: `mission:${m.id}`,
    title: m.name,
    subtitle: `${m.agencies.join(', ')} · ${m.destination}`,
    category: 'mission' as const,
    terms: [m.name, ...m.aliases, ...m.agencies],
    route: { name: 'mission' as const, id: m.id },
    icon: 'orbit' as const,
  }))];
}
