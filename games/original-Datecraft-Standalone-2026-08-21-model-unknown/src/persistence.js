// Converted from the original AMD bundle; the code below is unchanged apart from the module wrapper.
import * as data_js_3 from './data.js';
import * as initial_state_js_1 from './initial-state.js';
import * as utils_js_3 from './utils.js';
const exports = {};
exports.migrateState = migrateState;
exports.hasSave = hasSave;
exports.loadGame = loadGame;
exports.saveGame = saveGame;
exports.clearSave = clearSave;
exports.exportSave = exportSave;
exports.importSave = importSave;
exports.SAVE_KEY = 'datecraft.save.v4';
exports.LEGACY_SAVE_KEYS = ['datecraft.save.v3', 'datecraft.save.v2'];
exports.SETTINGS_KEY = 'datecraft.settings.v1';
function mergeDefaults(defaults, incoming) {
    if (Array.isArray(defaults))
        return Array.isArray(incoming) ? incoming : (0, utils_js_3.deepClone)(defaults);
    if (defaults && typeof defaults === 'object') {
        const result = {};
        const source = incoming && typeof incoming === 'object' ? incoming : {};
        for (const key of Object.keys(defaults))
            result[key] = mergeDefaults(defaults[key], source[key]);
        for (const key of Object.keys(source))
            if (!(key in result))
                result[key] = source[key];
        return result;
    }
    return incoming === undefined || incoming === null ? defaults : incoming;
}
function migrateState(raw) {
    var _a, _b, _c;
    if (!raw || typeof raw !== 'object')
        throw new Error('Save data is not an object.');
    const profile = raw.profile || {};
    const defaults = (0, initial_state_js_1.createInitialState)({
        name: profile.name || 'Alex', pronouns: profile.pronouns || 'they/them',
        background: profile.background || 'fresh_start', presentation: profile.presentation || 'classic',
        region: profile.region || 'brightwater', adultConfirmed: profile.adultConfirmed !== false,
        tutorial: raw.meta?.tutorial !== false, difficulty: raw.meta?.difficulty || 'balanced',
        seed: `migration-${raw.meta?.createdAt || 'legacy'}`,
    });
    const merged = mergeDefaults(defaults, raw);
    if ((raw.schemaVersion || 1) < 2) {
        merged.profile.needs.mood = raw.profile?.needs?.stress != null ? 100 - raw.profile.needs.stress : merged.profile.needs.mood;
        delete merged.profile.needs.stress;
    }
    if ((raw.schemaVersion || 1) < 3) {
        merged.pending = merged.pending || { event: null, weeklyReport: null };
        merged.pending.encounter = null;
        merged.settings.contentTone = merged.settings.contentTone || 'balanced';
    }
    if ((raw.schemaVersion || 1) < 4) {
        merged.career || (merged.career = { ending: null, completedDay: null, score: null, endingSeen: false });
        (_a = merged.metrics).disclosures || (_a.disclosures = 0);
        (_b = merged.metrics).partnerTime || (_b.partnerTime = 0);
        if (merged.relationships.partner) {
            (_c = merged.relationships.partner).discoveryRisk ?? (_c.discoveryRisk = merged.relationships.partner.knowledge === 'unaware' ? 28 : merged.relationships.partner.knowledge === 'partial' ? 16 : 0);
        }
    }
    merged.schemaVersion = data_js_3.SCHEMA_VERSION;
    merged.version = data_js_3.GAME_VERSION;
    merged.meta.updatedAt = new Date().toISOString();
    return merged;
}
function hasSave(storage = globalThis.localStorage) {
    try {
        return Boolean(storage?.getItem(exports.SAVE_KEY) || exports.LEGACY_SAVE_KEYS.some((key) => storage?.getItem(key)));
    }
    catch {
        return false;
    }
}
function loadGame(storage = globalThis.localStorage) {
    try {
        const serialized = storage?.getItem(exports.SAVE_KEY) || exports.LEGACY_SAVE_KEYS.map((key) => storage?.getItem(key)).find(Boolean);
        if (!serialized)
            return null;
        return migrateState(JSON.parse(serialized));
    }
    catch (error) {
        console.warn('Unable to load Datecraft save:', error);
        return null;
    }
}
function saveGame(state, storage = globalThis.localStorage) {
    try {
        storage?.setItem(exports.SAVE_KEY, JSON.stringify(state));
        return true;
    }
    catch (error) {
        console.warn('Unable to save Datecraft:', error);
        return false;
    }
}
function clearSave(storage = globalThis.localStorage) {
    try {
        storage?.removeItem(exports.SAVE_KEY);
        for (const key of exports.LEGACY_SAVE_KEYS)
            storage?.removeItem(key);
        return true;
    }
    catch {
        return false;
    }
}
function exportSave(state) {
    const payload = JSON.stringify({ format: 'datecraft-save', exportedAt: new Date().toISOString(), state }, null, 2);
    return new Blob([payload], { type: 'application/json' });
}
async function importSave(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const state = parsed?.format === 'datecraft-save' ? parsed.state : parsed;
    return migrateState(state);
}
export { migrateState, hasSave, loadGame, saveGame, clearSave, exportSave, importSave };
export const { SAVE_KEY, LEGACY_SAVE_KEYS, SETTINGS_KEY } = exports;
