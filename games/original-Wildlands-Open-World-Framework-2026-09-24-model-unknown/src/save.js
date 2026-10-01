// save.js — the saved position (autosave, export and import), survey progress per
// world seed, and preferences. Everything is validated; anything odd is ignored.
import { CONFIG, VERSION, VIEWS, SURVEY_SITES, BIOMES } from './config.js';

const SITE_IDS = new Set(SURVEY_SITES.map((s) => s.id));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Survey progress for one seed, cleaned up (unknown posts and landscapes dropped). */
export function validateSurvey(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const found = Array.isArray(raw.found) ? [...new Set(raw.found.filter((id) => typeof id === 'string' && SITE_IDS.has(id)))] : [];
  const biomes = Array.isArray(raw.biomes) ? [...new Set(raw.biomes.filter((b) => Number.isInteger(b) && b >= 0 && b < BIOMES.length))] : [];
  return {
    found, biomes,
    time: finite(raw.time) && raw.time >= 0 ? raw.time : 0,
    completedAt: finite(raw.completedAt) && raw.completedAt >= 0 ? raw.completedAt : null,
    best: finite(raw.best) && raw.best > 0 ? raw.best : null,
  };
}

export class SaveSystem {
  constructor(events) { this.events = events; this.available = true; }
  validate(raw) {
    if (!raw || raw.schema !== 1 || typeof raw.seed !== 'string' || !raw.seed.trim() || raw.seed.length > 64) throw new Error('This is not a valid Wildlands save file.');
    const p = raw.player; if (!p || !['x', 'y', 'z', 'yaw', 'pitch'].every((k) => finite(p[k]))) throw new Error('The save has invalid player coordinates.');
    if (Math.abs(p.x) > 1e9 || Math.abs(p.z) > 1e9 || Math.abs(p.y) > 1e6) throw new Error('The saved position is outside the supported coordinate range.');
    if (!finite(raw.hours) || raw.hours < 0 || raw.hours >= 24) throw new Error('The save has an invalid time.');
    return {
      ...raw,
      quality: VIEWS[raw.quality] ? raw.quality : null,
      survey: validateSurvey(raw.survey),
      player: { ...p, travelled: finite(p.travelled) && p.travelled >= 0 ? p.travelled : 0, mode: p.mode === 'fly' ? 'fly' : 'walk', pitch: Math.max(-1.52, Math.min(1.52, p.pitch)) },
    };
  }
  pack(app) {
    return {
      schema: 1, version: VERSION, savedAt: new Date().toISOString(), seed: app.generator.seedText,
      player: app.player.snapshot(), hours: app.environment.hours, cycle: app.environment.cycle,
      quality: app.viewChosen ? app.viewName : undefined, survey: app.survey.toJSON(),
    };
  }
  read() {
    try { const s = localStorage.getItem(CONFIG.saveKey); return s ? this.validate(JSON.parse(s)) : null; }
    catch (error) { console.warn('Local save could not be read.', error.message); return null; }
  }
  write(app, silent = false) {
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(this.pack(app)));
      this.writeSurvey(app.generator.seedText, app.survey.toJSON());
      if (!silent) this.events.emit('notice', 'Position saved in this browser.');
      return true;
    } catch {
      this.available = false;
      if (!silent) this.events.emit('notice', 'Browser storage is blocked. Use Export save instead.');
      return false;
    }
  }
  export(app) {
    const blob = new Blob([JSON.stringify(this.pack(app), null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'wildlands-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.events.emit('notice', 'Save file exported.');
  }
  async import(file) {
    if (!file || file.size > 100000) throw new Error('Choose a Wildlands save file smaller than 100 KB.');
    let raw;
    try { raw = JSON.parse(await file.text()); } catch { throw new Error('This is not a valid Wildlands save file.'); }
    return this.validate(raw);
  }
  #surveyMap() {
    try { const m = JSON.parse(localStorage.getItem(CONFIG.surveyKey)); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; } catch { return {}; }
  }
  readSurvey(seed) { return validateSurvey(this.#surveyMap()[seed]); }
  writeSurvey(seed, data) {
    try {
      const map = this.#surveyMap();
      delete map[seed]; map[seed] = data;
      const keys = Object.keys(map);
      for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete map[k];
      localStorage.setItem(CONFIG.surveyKey, JSON.stringify(map));
    } catch { /* storage blocked: progress lives until the tab closes */ }
  }
  readPrefs() {
    try { const p = JSON.parse(localStorage.getItem(CONFIG.prefsKey)); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
  }
  writePrefs(prefs) {
    try { localStorage.setItem(CONFIG.prefsKey, JSON.stringify(prefs)); } catch { /* storage blocked */ }
  }
}
