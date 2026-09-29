/**
 * profile.js — what KEYFORGE remembers on this device: personal bests and
 * recent runs per mode, lifetime accuracy per letter (the keyboard heatmap
 * and the adaptive drill's starting focus), Forge Trial progress and the
 * last drill picked. Stored as one JSON value; private windows can refuse
 * storage, so every access is guarded and the game works without it.
 */

const KEY = 'keyforge.profile.v2';
/** The original build kept one number here; it seeds the overall best. */
const LEGACY_BEST = 'keyforge-best-wpm';
const HISTORY = 12;

export const store = {
  get(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* nothing to keep it in */
    }
  },
};

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const num = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);

export function loadProfile() {
  let raw = null;
  try {
    raw = JSON.parse(store.get(KEY, 'null'));
  } catch {
    raw = null;
  }
  const p = obj(raw);
  const modes = {};
  for (const [k, m] of Object.entries(obj(p.modes))) {
    const mm = obj(m);
    modes[k] = {
      wpm: num(mm.wpm),
      acc: num(mm.acc),
      time: num(mm.time),
      runs: (Array.isArray(mm.runs) ? mm.runs : []).filter((r) => r && typeof r === 'object').slice(-HISTORY).map((r) => ({ wpm: num(r.wpm), acc: num(r.acc), time: num(r.time) })),
    };
  }
  const keys = {};
  for (const [ch, v] of Object.entries(obj(p.keys))) {
    if (/^[a-z]$/.test(ch) && Array.isArray(v)) keys[ch] = [num(v[0]), num(v[1])];
  }
  const trials = {};
  for (const [id, t] of Object.entries(obj(p.trials))) trials[id] = { wpm: num(obj(t).wpm), acc: num(obj(t).acc) };
  return {
    best: Math.max(num(p.best), num(store.get(LEGACY_BEST, 0))),
    modes,
    keys,
    trials,
    prefs: obj(p.prefs),
  };
}

export function saveProfile(profile) {
  store.set(KEY, JSON.stringify(profile));
  if (profile.best) store.set(LEGACY_BEST, String(profile.best));
}

export const modeKey = (lesson, length) => `${lesson}|${length}`;

export function modeRecord(profile, key) {
  return profile.modes[key] || null;
}

/**
 * Add a finished run. `run` = { wpm, acc, time (sprints, seconds) }.
 * Returns which records it set.
 */
export function recordRun(profile, key, run) {
  const m = (profile.modes[key] ||= { wpm: 0, acc: 0, time: 0, runs: [] });
  const bestWpm = run.wpm > 0 && (run.wpm > m.wpm || (run.wpm === m.wpm && run.acc > m.acc));
  const firstWpm = m.wpm === 0;
  if (bestWpm) {
    m.wpm = run.wpm;
    m.acc = run.acc;
  }
  const bestTime = run.time > 0 && (!m.time || run.time < m.time);
  if (bestTime) m.time = run.time;
  m.runs.push({ wpm: run.wpm, acc: run.acc, time: run.time || 0 });
  if (m.runs.length > HISTORY) m.runs.splice(0, m.runs.length - HISTORY);
  const overall = run.wpm > profile.best;
  if (overall) profile.best = run.wpm;
  return { bestWpm: bestWpm && !firstWpm, bestTime: bestTime && m.runs.length > 1, overall, first: m.runs.length === 1 };
}

/** Fold one session's letter results into the lifetime profile. hits/misses: Map(letter → count). */
export function recordKeys(profile, hits, misses) {
  const letters = new Set([...hits.keys(), ...misses.keys()]);
  for (const ch of letters) {
    if (!/^[a-z]$/.test(ch)) continue;
    const k = (profile.keys[ch] ||= [0, 0]);
    k[0] += hits.get(ch) || 0;
    k[1] += misses.get(ch) || 0;
    // Old habits fade: halve both once a letter has plenty of history.
    if (k[0] + k[1] > 4000) {
      k[0] = Math.round(k[0] / 2);
      k[1] = Math.round(k[1] / 2);
    }
  }
}

/** Error rate 0..1 for a letter, or null when there is too little data to judge. */
export function errorRate(profile, ch) {
  const k = profile.keys[ch];
  if (!k || k[0] + k[1] < 12) return null;
  return k[1] / (k[0] + k[1]);
}

/** The letters that go wrong most often over all sessions (at least 4% misses). */
export function lifetimeWeakLetters(profile, count = 4) {
  return Object.keys(profile.keys)
    .map((ch) => [ch, errorRate(profile, ch)])
    .filter(([, r]) => r !== null && r >= 0.04)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([ch]) => ch);
}
