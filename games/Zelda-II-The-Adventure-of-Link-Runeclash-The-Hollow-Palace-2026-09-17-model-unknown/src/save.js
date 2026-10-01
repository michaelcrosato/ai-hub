// Local saves: the run in progress, cleared palaces with best times, and preferences.
// Storage can be missing or full (private windows, blocked site data): every call is guarded
// and the game plays the same without it.

const KEYS = {
  run: 'runeclash.run.v1',
  progress: 'runeclash.progress.v1',
  prefs: 'runeclash.prefs.v1'
};

export function load(name, fallback) {
  try {
    const raw = localStorage.getItem(KEYS[name]);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function store(name, value) {
  try {
    if (value == null) localStorage.removeItem(KEYS[name]);
    else localStorage.setItem(KEYS[name], JSON.stringify(value));
  } catch {
    /* storage unavailable: progress lasts for this session only */
  }
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
