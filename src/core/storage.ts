/**
 * Acesso seguro ao localStorage: o armazenamento pode estar indisponível (modo privado,
 * definições do navegador) ou conter dados corrompidos. Nunca lança exceções.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'universe-infinity:';

function defaultStore(): KeyValueStore | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = `${PREFIX}__probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

let store: KeyValueStore | null | undefined;

/** Permite injetar um armazenamento (usado nos testes). */
export function setStorageBackend(backend: KeyValueStore | null): void {
  store = backend;
}

function backend(): KeyValueStore | null {
  if (store === undefined) store = defaultStore();
  return store;
}

export function readJson<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try {
    const raw = backend()?.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    const b = backend();
    if (!b) return false;
    b.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    backend()?.removeItem(PREFIX + key);
  } catch {
    /* ignorado */
  }
}

export const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
