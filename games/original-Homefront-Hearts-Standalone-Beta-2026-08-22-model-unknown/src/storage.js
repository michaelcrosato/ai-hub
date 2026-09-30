/**
 * storage.js — the auto-save (same key and format as the original build, so
 * old saves carry over), the records kept across marriages, and the sound
 * preference. Every access tolerates blocked or full storage.
 */

import { SAVE_KEY, LEGACIES, PACES } from './data.js';
import { normalizeSave } from './sim.js';

const RECORDS_KEY = 'homefront-hearts-records-v1';
const SOUND_KEY = 'homefront-hearts-sound-v1';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  const text = read(SAVE_KEY);
  if (!text) return null;
  try {
    return normalizeSave(JSON.parse(text));
  } catch {
    return null;
  }
}

export function writeSave(state) {
  if (!state?.started) return;
  // The notice is momentary; everything else is the game.
  const { notice, lastProject, ...rest } = state;
  write(SAVE_KEY, JSON.stringify(rest));
}

export function clearSave() {
  write(SAVE_KEY, null);
}

export function loadRecords() {
  let raw = null;
  try {
    raw = JSON.parse(read(RECORDS_KEY) || 'null');
  } catch {
    raw = null;
  }
  const best = {};
  for (const p of PACES) {
    const v = Number(raw?.best?.[p.id]);
    if (Number.isFinite(v) && v > 0) best[p.id] = Math.round(v);
  }
  const known = new Set(LEGACIES.map((l) => l.id));
  const legacies = Array.isArray(raw?.legacies) ? [...new Set(raw.legacies.filter((id) => known.has(id)))] : [];
  const completed = Math.max(0, Math.floor(Number(raw?.completed) || 0));
  return { best, legacies, completed };
}

/**
 * Remember a finished marriage. Returns what the final screen shows:
 * whether this beat the best score for the pace, and the collection size.
 */
export function recordCompletion({ score, pace, legacy }) {
  const r = loadRecords();
  const previousBest = r.best[pace] ?? null;
  const isBest = previousBest == null || score > previousBest;
  if (isBest) r.best[pace] = score;
  if (legacy && !r.legacies.includes(legacy)) r.legacies.push(legacy);
  r.completed += 1;
  write(RECORDS_KEY, JSON.stringify(r));
  return { at: Date.now(), score, pace, legacy, isBest, previousBest, legaciesFound: r.legacies.length, completed: r.completed };
}

export function soundPreference() {
  return read(SOUND_KEY) !== 'off';
}

export function setSoundPreference(on) {
  write(SOUND_KEY, on ? 'on' : 'off');
}
