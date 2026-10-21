import { createStore, useStore } from '../core/store';
import { isStringArray, readJson, writeJson } from '../core/storage';

/** Favoritos e histórico: guardados localmente, sem conta. Apenas identificadores de objetos. */

const FAV_KEY = 'favorites';
const HISTORY_KEY = 'history';
export const HISTORY_LIMIT = 12;

export const favoritesStore = createStore<string[]>(readJson(FAV_KEY, [], isStringArray), (v) => writeJson(FAV_KEY, v));
export const historyStore = createStore<string[]>(readJson(HISTORY_KEY, [], isStringArray), (v) =>
  writeJson(HISTORY_KEY, v),
);

export function toggleFavorite(id: string): boolean {
  let added = false;
  favoritesStore.set((prev) => {
    if (prev.includes(id)) return prev.filter((x) => x !== id);
    added = true;
    return [...prev, id];
  });
  return added;
}

export function isFavorite(id: string): boolean {
  return favoritesStore.get().includes(id);
}

export function pushHistory(id: string): void {
  historyStore.set((prev) => {
    if (prev[0] === id) return prev;
    return [id, ...prev.filter((x) => x !== id)].slice(0, HISTORY_LIMIT);
  });
}

export function clearHistory(): void {
  historyStore.set([]);
}

export const useFavorites = () => useStore(favoritesStore);
export const useHistory = () => useStore(historyStore);

// ---------- Preferências ----------

export type QualityPreference = 'auto' | 'high' | 'low';

export interface Preferences {
  showOrbits: boolean;
  showLabels: boolean;
  /** Camada de asteroides e cometas na vista 3D. */
  showSmallBodies: boolean;
  quality: QualityPreference;
  hintDismissed: boolean;
}

const PREF_KEY = 'preferences';
const DEFAULT_PREFS: Preferences = { showOrbits: true, showLabels: true, showSmallBodies: false, quality: 'auto', hintDismissed: false };

function isPrefs(v: unknown): v is Partial<Preferences> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitize(p: Partial<Preferences>): Preferences {
  return {
    showOrbits: typeof p.showOrbits === 'boolean' ? p.showOrbits : DEFAULT_PREFS.showOrbits,
    showLabels: typeof p.showLabels === 'boolean' ? p.showLabels : DEFAULT_PREFS.showLabels,
    showSmallBodies: typeof p.showSmallBodies === 'boolean' ? p.showSmallBodies : DEFAULT_PREFS.showSmallBodies,
    quality: p.quality === 'high' || p.quality === 'low' || p.quality === 'auto' ? p.quality : DEFAULT_PREFS.quality,
    hintDismissed: typeof p.hintDismissed === 'boolean' ? p.hintDismissed : DEFAULT_PREFS.hintDismissed,
  };
}

export const preferencesStore = createStore<Preferences>(
  sanitize(readJson<Partial<Preferences>>(PREF_KEY, {}, isPrefs)),
  (v) => writeJson(PREF_KEY, v),
);

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  preferencesStore.set((p) => ({ ...p, [key]: value }));
}

export const usePreferences = () => useStore(preferencesStore);

// ---------- Visita guiada ----------

const TOUR_KEY = 'tour';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Verdadeiro depois de a visita guiada ter sido feita ou recusada (a oferta da primeira visita deixa de aparecer). */
export const tourSeenStore = createStore<boolean>(readJson(TOUR_KEY, false, isBool), (v) => writeJson(TOUR_KEY, v));

export function markTourSeen(): void {
  if (!tourSeenStore.get()) tourSeenStore.set(true);
}

export const useTourSeen = () => useStore(tourSeenStore);
