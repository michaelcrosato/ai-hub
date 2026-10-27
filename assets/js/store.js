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
  ui: { sort: 'name', group: 'source', size: 'wide' },
  // Behind the PIN. Not security — the games are public files — just a way
  // to keep grown-up and unfinished things off the wall on a shared device.
  dev: { showAll: false, showSlugs: false, alwaysStandalone: false },
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(EMPTY),
      ...parsed,
      ui: { ...EMPTY.ui, ...(parsed.ui || {}) },
      dev: { ...EMPTY.dev, ...(parsed.dev || {}) },
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

let state = read();
/** A signed-in player's plays from every device, held apart from this device's own. */
let cloud = { plays: {}, lastPlayed: {}, seconds: {} };
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

  plays: (slug) => Math.max(state.plays[slug] || 0, cloud.plays[slug] || 0),

  lastPlayed: (slug) => Math.max(state.lastPlayed[slug] || 0, cloud.lastPlayed[slug] || 0),

  playedCount: () => new Set([...Object.keys(state.lastPlayed), ...Object.keys(cloud.lastPlayed)]).size,

  /** Seconds played in view, on every device: only known for a signed-in player. */
  playSeconds: (slug) => cloud.seconds[slug] || 0,

  totalPlaySeconds: () => Object.values(cloud.seconds).reduce((sum, s) => sum + s, 0),

  /**
   * A signed-in player's history from every device ({ slug: { plays,
   * lastPlayed, seconds } }). Held in memory, never written into this
   * device's own record: each count shows the larger of the two.
   */
  setCloudPlays(totals) {
    cloud = { plays: {}, lastPlayed: {}, seconds: {} };
    for (const [slug, t] of Object.entries(totals || {})) {
      cloud.plays[slug] = t.plays || 0;
      cloud.lastPlayed[slug] = t.lastPlayed || 0;
      cloud.seconds[slug] = t.seconds || 0;
    }
    for (const fn of listeners) fn(state);
  },

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

  standaloneCount: () => Object.keys(state.standalone).length,

  dev: () => ({ ...state.dev }),

  setDev(patch) {
    state.dev = { ...state.dev, ...patch };
    commit();
  },

  /** Forget part of what this device remembers: 'history', 'faves' or 'standalone'. */
  forget(what) {
    if (what === 'history') {
      state.plays = {};
      state.lastPlayed = {};
    } else if (what === 'faves') {
      state.faves = {};
    } else if (what === 'standalone') {
      state.standalone = {};
    }
    commit();
  },

  ui: () => ({ ...state.ui }),

  setUi(patch) {
    state.ui = { ...state.ui, ...patch };
    commit();
  },
};
