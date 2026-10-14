import type { SearchEntry } from './searchIndex';

/** Asteroides e cometas, missões espaciais e conceitos científicos para a pesquisa global (carregados quando a pesquisa abre). */
export async function loadMissionSearchEntries(): Promise<SearchEntry[]> {
  const [{ MISSIONS }, { TOPICS }, { SMALL_BODIES }] = await Promise.all([
    import('../missions/missionsData'),
    import('../extreme/topics'),
    import('../../data/smallBodies'),
  ]);
  const KIND: Record<string, string> = { asteroid: 'Asteroide', tno: 'Objeto transneptuniano', comet: 'Cometa', interstellar: 'Objeto interestelar' };
  const smallBodies: SearchEntry[] = SMALL_BODIES.map((b) => ({
    id: `small-body:${b.slug}`,
    title: b.name,
    subtitle: `${b.dwarf ? 'Planeta anão' : KIND[b.kind]} · ${b.tagline}`,
    category: 'small-body' as const,
    terms: [b.name, b.designation, ...b.aliases],
    route: { name: 'small-body' as const, slug: b.slug },
    accent: b.accent,
    icon: 'comet' as const,
  }));
  const concepts: SearchEntry[] = TOPICS.map((tp) => ({
    id: `concept:${tp.id}`,
    title: tp.title,
    subtitle: `Fenómenos extremos · ${tp.summary}`,
    category: 'concept' as const,
    terms: [tp.title, ...tp.terms],
    route: { name: 'extreme' as const, topic: tp.id },
    icon: 'info' as const,
  }));
  return [...smallBodies, ...concepts, ...MISSIONS.map((m) => ({
    id: `mission:${m.id}`,
    title: m.name,
    subtitle: `${m.agencies.join(', ')} · ${m.destination}`,
    category: 'mission' as const,
    terms: [m.name, ...m.aliases, ...m.agencies],
    route: { name: 'mission' as const, id: m.id },
    icon: 'orbit' as const,
  }))];
}
