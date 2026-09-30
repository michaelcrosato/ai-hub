/**
 * Progress on this device (localStorage), replacing the old tab-only session store: the
 * mission checkpoint, per-difficulty records, and display/sound preferences. Every read is
 * validated again by the systems that restore it (vitals, weapon, waves, vehicle parts).
 */
export const KEYS = Object.freeze({
  checkpoint: 't2-cyberdyne-v2.checkpoint',
  records: 't2-cyberdyne-v2.records',
  prefs: 'strata.fps.preferences.v1.t2-cyberdyne-v2',
});
const MAX_BYTES = 65536;

function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
export function readJson(key) {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function writeJson(key, value) {
  try {
    const text = JSON.stringify(value);
    if (text.length > MAX_BYTES) return false;
    storage()?.setItem(key, text);
    return !!storage();
  } catch { return false; }
}
export function remove(key) {
  try { storage()?.removeItem(key); } catch { /* storage blocked */ }
}

const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** A checkpoint object, or null. Accepts this version's saves and the old campaign export. */
export function normalizeCheckpoint(raw) {
  if (!plain(raw)) return null;
  // Version 2 exported the whole Strata campaign save; the mission lives under episodes.fps.data.
  if (raw.api === 1 && plain(raw.episodes) && plain(raw.episodes.fps) && plain(raw.episodes.fps.data)) raw = raw.episodes.fps.data;
  if (!plain(raw) || !plain(raw.survival ?? {})) return null;
  if (raw.vehicles !== undefined && (!Array.isArray(raw.vehicles) || raw.vehicles.length > 16)) return null;
  return raw;
}
export function loadCheckpoint() { return normalizeCheckpoint(readJson(KEYS.checkpoint)); }
export function saveCheckpoint(data) { return writeJson(KEYS.checkpoint, data); }
export function clearCheckpoint() { remove(KEYS.checkpoint); }

/** Parse an imported file. Throws with a readable message. */
export function parseImport(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('Save exceeds 64 KiB.');
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('The file is not a JSON save.'); }
  const checkpoint = normalizeCheckpoint(raw);
  if (!checkpoint) throw new Error('The file is not a Cyberdyne checkpoint.');
  return checkpoint;
}

const count = (v, max) => Number.isSafeInteger(v) && v >= 0 ? Math.min(v, max) : 0;
function cleanRecord(raw) {
  const r = plain(raw) ? raw : {};
  const opening = typeof r.fastestOpening === 'number' && Number.isFinite(r.fastestOpening) && r.fastestOpening > 0 ? r.fastestOpening : null;
  return { bestWave: count(r.bestWave, 1000000), bestVehicles: count(r.bestVehicles, 8000008), bestParts: count(r.bestParts, 100000000), fastestOpening: opening, runs: count(r.runs, 1000000) };
}
export function loadRecords(difficulty) {
  const all = readJson(KEYS.records);
  return cleanRecord(plain(all) ? all[difficulty] : null);
}
/**
 * Merge a run's numbers into the records for its difficulty. Returns the new record and which
 * fields improved. `finished` counts the run (End run), otherwise it is a mid-run update.
 */
export function recordProgress(difficulty, { wavesCleared = 0, vehicles = 0, parts = 0, openingTime = null } = {}, finished = false) {
  const stored = readJson(KEYS.records), all = plain(stored) ? stored : {};
  const before = cleanRecord(all[difficulty]);
  const next = { ...before };
  const improved = [];
  if (wavesCleared > before.bestWave) { next.bestWave = wavesCleared; improved.push('waves'); }
  if (vehicles > before.bestVehicles) { next.bestVehicles = vehicles; improved.push('vehicles'); }
  if (parts > before.bestParts) { next.bestParts = parts; improved.push('parts'); }
  if (openingTime && (!before.fastestOpening || openingTime < before.fastestOpening)) { next.fastestOpening = openingTime; improved.push('opening'); }
  if (finished) next.runs = before.runs + 1;
  all[difficulty] = next;
  writeJson(KEYS.records, all);
  return { record: next, previous: before, improved };
}

export function downloadText(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
