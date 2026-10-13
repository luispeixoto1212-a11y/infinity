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
  quality: QualityPreference;
  hintDismissed: boolean;
}

const PREF_KEY = 'preferences';
const DEFAULT_PREFS: Preferences = { showOrbits: true, showLabels: true, quality: 'auto', hintDismissed: false };

function isPrefs(v: unknown): v is Partial<Preferences> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitize(p: Partial<Preferences>): Preferences {
  return {
    showOrbits: typeof p.showOrbits === 'boolean' ? p.showOrbits : DEFAULT_PREFS.showOrbits,
    showLabels: typeof p.showLabels === 'boolean' ? p.showLabels : DEFAULT_PREFS.showLabels,
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
