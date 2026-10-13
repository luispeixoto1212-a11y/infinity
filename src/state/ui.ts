import { createStore, useStore } from '../core/store';

export interface UiState {
  searchOpen: boolean;
  shortcutsOpen: boolean;
}

export const uiStore = createStore<UiState>({ searchOpen: false, shortcutsOpen: false });

export const openSearch = () => uiStore.set((s) => ({ ...s, searchOpen: true }));
export const closeSearch = () => uiStore.set((s) => ({ ...s, searchOpen: false }));
export const openShortcuts = () => uiStore.set((s) => ({ ...s, shortcutsOpen: true }));
export const closeShortcuts = () => uiStore.set((s) => ({ ...s, shortcutsOpen: false }));

export const useUi = () => useStore(uiStore);

/** Verdadeiro quando o foco está num campo de texto (para não intercetar atalhos). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
