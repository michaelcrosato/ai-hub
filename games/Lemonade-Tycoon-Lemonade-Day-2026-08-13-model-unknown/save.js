/**
 * save.js — the campaign save (with a backup copy), preferences, the
 * tutorial flag and the best-week records, all in localStorage. Every access
 * is guarded: private windows and blocked storage just mean nothing persists.
 */

import { DEFAULT_SETTINGS, clamp, isPlayableSave, fromSave, toSave, MEDAL_RANK } from './sim.js';

const SAVE_KEY = 'lemonade-day-save-v4';
const BACKUP_KEY = 'lemonade-day-save-v4-backup';
const SETTINGS_KEY = 'lemonade-day-settings-v1';
const TUTORIAL_KEY = 'lemonade-day-tutorial-v1';
const RECORDS_KEY = 'lemonade-day-records-v1';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadSettings() {
  let reduced = false;
  try {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* no media queries */
  }
  const base = { ...DEFAULT_SETTINGS, reducedMotion: reduced };
  try {
    const s = JSON.parse(read(SETTINGS_KEY) || 'null');
    if (!s || typeof s !== 'object') return base;
    return {
      sound: typeof s.sound === 'boolean' ? s.sound : base.sound,
      volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? clamp(0, 1, s.volume) : base.volume,
      reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : base.reducedMotion,
      highContrast: typeof s.highContrast === 'boolean' ? s.highContrast : base.highContrast,
      largeText: typeof s.largeText === 'boolean' ? s.largeText : base.largeText,
    };
  } catch {
    return base;
  }
}

export function saveSettings(s) {
  write(SETTINGS_KEY, JSON.stringify(s));
}

/** The last playable campaign (the backup steps in if the main save is damaged). */
export function loadGame() {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const save = JSON.parse(read(key) || 'null');
      if (isPlayableSave(save)) return fromSave(save);
    } catch {
      /* try the next copy */
    }
  }
  return null;
}

export function saveGame(state) {
  const previous = read(SAVE_KEY);
  if (previous) {
    try {
      if (isPlayableSave(JSON.parse(previous))) write(BACKUP_KEY, previous);
    } catch {
      /* a broken previous save is simply replaced */
    }
  }
  return write(SAVE_KEY, JSON.stringify(toSave(state)));
}

export const tutorialDone = () => read(TUTORIAL_KEY) === 'complete';
export const setTutorialDone = () => write(TUTORIAL_KEY, 'complete');

/** { [difficulty]: { value, medal, cups, contracts, reputation, weeks }, seeds: [...] } */
export function loadRecords() {
  try {
    const r = JSON.parse(read(RECORDS_KEY) || 'null');
    if (r && typeof r === 'object') return { ...r, seeds: Array.isArray(r.seeds) ? r.seeds : [] };
  } catch {
    /* start fresh */
  }
  return { seeds: [] };
}

/**
 * Record a finished week once per campaign. Returns the updated records and
 * whether this week beat the best for its difficulty.
 */
export function recordWeek(records, difficulty, seed, week) {
  if (records.seeds.includes(seed)) return { records, isNewBest: false, counted: false };
  const prev = records[difficulty];
  const better = !prev || week.value > prev.value || (week.value === prev.value && MEDAL_RANK[week.medal] > MEDAL_RANK[prev.medal]);
  const next = {
    ...records,
    seeds: [...records.seeds, seed].slice(-30),
    [difficulty]: better ? { ...week, weeks: (prev?.weeks ?? 0) + 1 } : { ...prev, weeks: (prev.weeks ?? 0) + 1 },
  };
  write(RECORDS_KEY, JSON.stringify(next));
  return { records: next, isNewBest: better && !!prev, first: !prev, counted: true };
}
