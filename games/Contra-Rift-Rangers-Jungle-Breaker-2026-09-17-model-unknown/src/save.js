// Progress kept in this browser: unlocked operations, best results per
// operation and difficulty, the last choices on the title screen, and the
// checkpoint to continue from. Storage can be missing (private windows,
// blocked site data), so every read and write is guarded.

const KEY = 'riftRangers.save.v1';

const DEFAULTS = Object.freeze({ v: 1, unlocked: 0, mission: 0, difficulty: 'ranger', sound: true, run: null });

export function loadSave() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    data = null;
  }
  const s = { ...DEFAULTS, best: {}, ...(data && typeof data === 'object' ? data : {}) };
  if (!s.best || typeof s.best !== 'object') s.best = {};
  s.unlocked = Math.max(0, Number(s.unlocked) | 0);
  s.mission = Math.max(0, Number(s.mission) | 0);
  s.sound = s.sound !== false;
  return s;
}

export function writeSave(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lasts for this visit only */
  }
}
