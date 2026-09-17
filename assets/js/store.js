/**
 * store.js — everything the hub remembers about you, on this device only.
 *
 * Favourites, play counts, the sort you last used, and which games you told the
 * hub to open standalone. One key, one JSON blob, written lazily. Every access
 * is wrapped: storage throws in private windows and returns nothing on a fresh
 * device, and neither is an error worth showing anyone.
 */

const KEY = 'ai-hub:v1';

const EMPTY = {
  faves: {},
  plays: {},
  lastPlayed: {},
  standalone: {},
  ui: { sort: 'name' },
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(EMPTY), ...parsed, ui: { ...EMPTY.ui, ...(parsed.ui || {}) } };
  } catch {
    return structuredClone(EMPTY);
  }
}

let state = read();
let pending = 0;
const listeners = new Set();

function commit() {
  for (const fn of listeners) fn(state);
  clearTimeout(pending);
  pending = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota, private mode, blocked site data — the session still works */
    }
  }, 180);
}

export const store = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  isFave: (slug) => Boolean(state.faves[slug]),

  toggleFave(slug) {
    if (state.faves[slug]) delete state.faves[slug];
    else state.faves[slug] = Date.now();
    commit();
    return Boolean(state.faves[slug]);
  },

  faveCount: () => Object.keys(state.faves).length,

  plays: (slug) => state.plays[slug] || 0,

  lastPlayed: (slug) => state.lastPlayed[slug] || 0,

  playedCount: () => Object.keys(state.lastPlayed).length,

  recordPlay(slug) {
    state.plays[slug] = (state.plays[slug] || 0) + 1;
    state.lastPlayed[slug] = Date.now();
    commit();
  },

  prefersStandalone: (slug) => Boolean(state.standalone[slug]),

  setStandalone(slug, on) {
    if (on) state.standalone[slug] = true;
    else delete state.standalone[slug];
    commit();
  },

  ui: () => ({ ...state.ui }),

  setUi(patch) {
    state.ui = { ...state.ui, ...patch };
    commit();
  },
};
