import { constellationName } from '../../data/constellations';
import { displayName, formatLightYears, loadDeepSky, type DeepSkyObject } from '../deepsky/deepSkyData';
import { lightYearsFromPc, loadStars, type Star } from '../stars/starData';
import type { SearchEntry } from './searchIndex';

const SUBTYPE_LABEL: Record<string, string> = {
  spiral: 'Galáxia espiral',
  'barred-spiral': 'Galáxia espiral barrada',
  elliptical: 'Galáxia elíptica',
  lenticular: 'Galáxia lenticular',
  irregular: 'Galáxia irregular',
  galaxy: 'Galáxia',
  globular: 'Enxame globular',
  open: 'Enxame aberto',
  emission: 'Nebulosa de emissão',
  reflection: 'Nebulosa de reflexão',
  planetary: 'Nebulosa planetária',
  snr: 'Remanescente de supernova',
  'star-cloud': 'Nuvem estelar',
  'double-star': 'Estrela dupla',
  asterism: 'Asterismo',
};

/** Entradas de pesquisa dos 110 objetos Messier (M31, "Andromeda", NGC 224, nome português…). */
export function deepSkyEntries(objects: readonly DeepSkyObject[]): SearchEntry[] {
  return objects.map((o) => {
    const ngc = o.catalogId ? [o.catalogId, o.catalogId.replace(' ', '')] : [];
    return {
      id: `dso:${o.id}`,
      title: o.namePt ? `${o.namePt} (M${o.m})` : displayName(o),
      subtitle: `${SUBTYPE_LABEL[o.subtype] ?? 'Objeto'} em ${constellationName(o.constellation)}${o.distanceLy ? `, a ${formatLightYears(o.distanceLy)}` : ''}`,
      category: 'deep-sky' as const,
      terms: [`M${o.m}`, `M ${o.m}`, `Messier ${o.m}`, ...ngc, ...(o.namePt ? [o.namePt] : []), ...(o.nameEn ? [o.nameEn] : [])],
      route: { name: 'deep-sky-object' as const, id: o.id },
      icon: 'layers' as const,
    };
  });
}

/** Entradas de pesquisa das estrelas com nome próprio (as restantes ficam na tabela da secção Estrelas). */
export function starEntries(stars: readonly Star[]): SearchEntry[] {
  return stars
    .filter((s) => s.hasProperName)
    .map((s) => ({
      id: `star:${s.slug}`,
      title: s.name,
      subtitle: `Estrela${s.constellation ? ` em ${constellationName(s.constellation)}` : ''}${
        s.distPc !== undefined ? `, a ${formatLightYears(lightYearsFromPc(s.distPc))}` : ''
      }`,
      category: 'named-star' as const,
      terms: [s.name, ...(s.designation ? [s.designation] : []), ...(s.hip ? [`HIP ${s.hip}`] : [])],
      route: { name: 'star' as const, slug: s.slug },
      icon: 'star' as const,
    }));
}

/** Objetos Messier e estrelas para a pesquisa global, pedidos só quando a pesquisa é aberta. */
export async function loadSpaceSearchEntries(): Promise<SearchEntry[]> {
  const [dso, stars] = await Promise.allSettled([loadDeepSky(), loadStars()]);
  return [...(dso.status === 'fulfilled' ? deepSkyEntries(dso.value) : []), ...(stars.status === 'fulfilled' ? starEntries(stars.value) : [])];
}
