import { DATA_SCHEMA_VERSION } from "./types";

// Key/value storage that survives blocked or missing localStorage (private mode,
// SSR, sandboxed iframes) by falling back to memory for the session.

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
  };
}

function localStorageIfUsable(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__exun_probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createBrowserStore(): KeyValueStore {
  const memory = createMemoryStore();
  const local = localStorageIfUsable();
  if (!local) return memory;
  return {
    get(key) {
      try {
        return local.getItem(key);
      } catch {
        return memory.get(key);
      }
    },
    set(key, value) {
      try {
        local.setItem(key, value);
      } catch {
        // Quota exceeded or storage revoked mid-session.
        memory.set(key, value);
      }
    },
    remove(key) {
      try {
        local.removeItem(key);
      } catch {
        memory.remove(key);
      }
    },
  };
}

const PREFIX = `exun:v${DATA_SCHEMA_VERSION}:`;

export function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  const raw = store.get(PREFIX + key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(store: KeyValueStore, key: string, value: T): void {
  store.set(PREFIX + key, JSON.stringify(value));
}

export function removeKey(store: KeyValueStore, key: string): void {
  store.remove(PREFIX + key);
}
