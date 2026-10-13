import { sun } from './bodies/sun';
import { earth, mars, mercury, moon, venus } from './bodies/inner';
import { jupiter, neptune, saturn, uranus } from './bodies/outer';
import { ceres, pluto } from './bodies/dwarfs';
import { SOURCES } from './sources';
import type { BodyId, CelestialBody, Fact, LocalizedText } from './types';

/** Ordem de apresentação: do Sol para fora; a Lua a seguir à Terra. */
export const BODIES: readonly CelestialBody[] = [
  sun,
  mercury,
  venus,
  earth,
  moon,
  mars,
  ceres,
  jupiter,
  saturn,
  uranus,
  neptune,
  pluto,
];

const byId = new Map<BodyId, CelestialBody>(BODIES.map((b) => [b.id, b]));
const bySlug = new Map<string, CelestialBody>(BODIES.map((b) => [b.slug, b]));

export function getBody(id: BodyId): CelestialBody {
  const b = byId.get(id);
  if (!b) throw new Error(`Corpo desconhecido: ${id}`);
  return b;
}

export function findBodyBySlug(slug: string): CelestialBody | undefined {
  return bySlug.get(slug);
}

export function findBodyById(id: string): CelestialBody | undefined {
  return byId.get(id as BodyId);
}

export function isBodyId(id: string): id is BodyId {
  return byId.has(id as BodyId);
}

/** Texto na língua pedida, com alternativa em pt-PT. */
export function tr(text: LocalizedText, locale: keyof LocalizedText = 'pt-PT'): string {
  return text[locale] ?? text['pt-PT'];
}

export function getFact(body: CelestialBody, key: Fact['key']): Fact | undefined {
  return body.facts.find((f) => f.key === key);
}

export function numericFact(body: CelestialBody, key: Fact['key']): number | undefined {
  const f = getFact(body, key);
  return typeof f?.value === 'number' ? f.value : undefined;
}

export interface CatalogIssue {
  bodyId: string;
  problem: string;
}

/**
 * Valida a coerência do catálogo: fontes existentes, unidades e valores plausíveis.
 * Corre nos testes automáticos e também em desenvolvimento.
 */
export function validateCatalog(bodies: readonly CelestialBody[] = BODIES): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const b of bodies) {
    if (ids.has(b.id)) issues.push({ bodyId: b.id, problem: 'id duplicado' });
    if (slugs.has(b.slug)) issues.push({ bodyId: b.id, problem: 'slug duplicado' });
    ids.add(b.id);
    slugs.add(b.slug);
    if (!/^[a-z0-9-]+$/.test(b.slug)) issues.push({ bodyId: b.id, problem: `slug inválido: ${b.slug}` });
    if (!b.name['pt-PT']) issues.push({ bodyId: b.id, problem: 'falta nome em pt-PT' });
    if (!(b.meanRadiusKm > 0)) issues.push({ bodyId: b.id, problem: 'raio médio inválido' });
    if (b.description.length === 0) issues.push({ bodyId: b.id, problem: 'sem descrição' });
    if (b.sources.length === 0) issues.push({ bodyId: b.id, problem: 'sem fontes' });
    for (const s of b.sources) if (!SOURCES[s]) issues.push({ bodyId: b.id, problem: `fonte inexistente: ${s}` });
    const keys = new Set<string>();
    for (const f of b.facts) {
      if (keys.has(f.key)) issues.push({ bodyId: b.id, problem: `facto repetido: ${f.key}` });
      keys.add(f.key);
      if (!SOURCES[f.sourceId]) issues.push({ bodyId: b.id, problem: `fonte inexistente no facto ${f.key}` });
      if (typeof f.value === 'number' && !Number.isFinite(f.value))
        issues.push({ bodyId: b.id, problem: `valor não finito em ${f.key}` });
      if (Array.isArray(f.value) && !(f.value[0] <= f.value[1]))
        issues.push({ bodyId: b.id, problem: `intervalo invertido em ${f.key}` });
    }
    const required: Fact['key'][] = b.type === 'star' ? ['mass', 'diameter'] : ['mass', 'diameter', 'orbitalPeriod'];
    for (const k of required) if (!keys.has(k)) issues.push({ bodyId: b.id, problem: `falta o facto obrigatório ${k}` });
    if (b.atmosphere) {
      const pct = b.atmosphere.components.filter((c) => c.unit === '%').reduce((s, c) => s + c.value, 0);
      if (pct > 100.5) issues.push({ bodyId: b.id, problem: `composição atmosférica acima de 100% (${pct})` });
      if (!SOURCES[b.atmosphere.sourceId]) issues.push({ bodyId: b.id, problem: 'fonte da atmosfera inexistente' });
    }
    if (b.moons) {
      if (b.moons.count < b.moons.notable.length)
        issues.push({ bodyId: b.id, problem: 'mais luas destacadas do que a contagem' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.moons.asOf)) issues.push({ bodyId: b.id, problem: 'data de referência das luas inválida' });
    }
    if (b.parent && !byId.has(b.parent) && bodies === BODIES)
      issues.push({ bodyId: b.id, problem: `corpo-pai inexistente: ${b.parent}` });
  }
  return issues;
}
