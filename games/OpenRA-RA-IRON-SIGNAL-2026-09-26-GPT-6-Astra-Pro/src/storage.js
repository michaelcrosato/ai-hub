import { MISSIONS, SPEEDS } from './catalog.js';

const PREFIX = 'iron-signal.v1.';
const LAST = MISSIONS.length - 1;

/** Game-side settings. Graphics quality now lives in the shared kit settings panel. */
export const DEFAULT_SETTINGS = Object.freeze({ volume: 0.65, music: 0.38, muted: false, effects: true, orders: true, edgePan: false, tips: true, diagnostics: true, speed: 1 });

export function sanitizeSettings(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  const out = { ...DEFAULT_SETTINGS };
  for (const key of ['volume', 'music']) if (Number.isFinite(value[key])) out[key] = Math.min(1, Math.max(0, value[key]));
  for (const key of ['muted', 'effects', 'orders', 'edgePan', 'tips', 'diagnostics']) if (typeof value[key] === 'boolean') out[key] = value[key];
  if (Object.hasOwn(SPEEDS, String(value.speed))) out.speed = Number(value.speed);
  return out;
}

/** The key a best result is stored under: one per battlefield, difficulty and command. */
export const recordKey = (mode, mission, difficulty, faction) => `${mode === 'skirmish' ? 's' : ''}${mission}-${difficulty}-${faction}`;

/** Storage failures (private browsing, quotas, corrupt JSON) never abort a game. */
export class Storage {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.lastError = '';
  }
  read(key, fallback = null) {
    try {
      const value = this.storage?.getItem(PREFIX + key);
      return value === null || value === undefined ? fallback : JSON.parse(value);
    } catch {
      this.lastError = 'The saved data could not be read.';
      return fallback;
    }
  }
  write(key, value) {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(PREFIX + key, JSON.stringify(value));
      this.lastError = '';
      return true;
    } catch {
      this.lastError = 'Local saving is unavailable or the storage quota is full.';
      return false;
    }
  }
  remove(key) {
    try {
      this.storage?.removeItem(PREFIX + key);
      return true;
    } catch {
      return false;
    }
  }
  settings() {
    return sanitizeSettings(this.read('settings', {}));
  }
  progress() {
    const p = this.read('progress', {});
    return {
      unlocked: Math.max(0, Math.min(LAST, Number.isInteger(p?.unlocked) ? p.unlocked : 0)),
      completed: Array.isArray(p?.completed) ? p.completed.filter((n) => Number.isInteger(n) && n >= 0 && n <= LAST) : [],
      records: typeof p?.records === 'object' && p.records ? p.records : {},
    };
  }
  /** The fastest recorded win on a battlefield (any difficulty or command), or null. */
  best(mission, mode = 'campaign') {
    const prefix = `${mode === 'skirmish' ? 's' : ''}${mission}-`;
    let best = null;
    for (const [key, r] of Object.entries(this.progress().records)) {
      if (key.startsWith(prefix) && Number.isFinite(r?.time) && (!best || r.time < best.time)) best = r;
    }
    return best;
  }
  /**
   * Store a won operation. Returns { progress, previous, isBest }: previous is the old record
   * for the same battlefield, difficulty and command (or null).
   */
  record(sim, score) {
    const p = this.progress();
    if (sim.status !== 'won') return { progress: p, previous: null, isBest: false };
    if (sim.mode === 'campaign') {
      p.unlocked = Math.min(LAST, Math.max(p.unlocked, sim.missionIndex + 1));
      if (!p.completed.includes(sim.missionIndex)) p.completed.push(sim.missionIndex);
    }
    const key = recordKey(sim.mode, sim.missionIndex, sim.difficulty, sim.faction);
    const previous = p.records[key] || null;
    const isBest = !previous || previous.time > sim.time;
    if (isBest) p.records[key] = { time: sim.time, score, ...sim.stats };
    else if (score > (previous.score || 0)) p.records[key] = { ...previous, score };
    this.write('progress', p);
    return { progress: p, previous, isBest };
  }
  save(sim, camera) {
    return this.write('save', { savedAt: new Date().toISOString(), game: sim.serialize(), camera });
  }
}
