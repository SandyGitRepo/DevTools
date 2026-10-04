import { useSyncExternalStore } from 'react';

/**
 * User preferences (FR-C6, UI-6, UI-11). Stored in localStorage as tool IDs and flags only —
 * never any user content (SEC-5). Every storage access is guarded: private windows or
 * blocked storage fall back to in-memory defaults.
 */
export interface Prefs {
  theme: 'dark' | 'light';
  reduceMotion: boolean;
  navCollapsed: boolean;
  favourites: string[];
  recent: string[];
}

const KEY = 'devtoolkit.prefs.v1';
const defaults: Prefs = { theme: 'dark', reduceMotion: false, navCollapsed: false, favourites: [], recent: [] };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[a-z0-9-]{1,40}$/.test(x)) : []);
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      reduceMotion: parsed.reduceMotion === true,
      navCollapsed: parsed.navCollapsed === true,
      favourites: ids(parsed.favourites),
      recent: ids(parsed.recent).slice(0, 8),
    };
  } catch {
    return defaults;
  }
}

let state: Prefs = load();
const listeners = new Set<() => void>();

function set(patch: Partial<Prefs>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep in memory only */
  }
  listeners.forEach((l) => l());
}

export const prefs = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  toggleTheme: () => set({ theme: state.theme === 'dark' ? 'light' : 'dark' }),
  toggleReduceMotion: () => set({ reduceMotion: !state.reduceMotion }),
  toggleNav: () => set({ navCollapsed: !state.navCollapsed }),
  toggleFavourite(id: string) {
    const has = state.favourites.includes(id);
    set({ favourites: has ? state.favourites.filter((f) => f !== id) : [...state.favourites, id] });
  },
  pushRecent(id: string) {
    set({ recent: [id, ...state.recent.filter((r) => r !== id)].slice(0, 8) });
  },
};

export function usePrefs(): Prefs {
  return useSyncExternalStore(prefs.subscribe, prefs.get, prefs.get);
}
