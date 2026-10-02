import { demoLevel } from './demo.js';
import { quarryLevel } from './quarry.js';
import { validateLevel } from './schema.js';

/**
 * The built-in sandboxes and the player's working copy of each. Edits to one level never
 * overwrite another: every level keeps its own document, and an imported level gets a
 * slot of its own. Best play-test times live next to them.
 */
const PREFIX = 'strata.fpw.v1.';
/** The single-file build kept one working level here. It is carried over once, as the yard. */
const LEGACY = 'strata.level.v1';
export const IMPORT_SLOT = 'import';
export const BUILTIN = [
    { id: 'yard', number: '01', build: demoLevel },
    { id: 'quarry', number: '02', build: quarryLevel },
];

const read = key => { try { return localStorage.getItem(PREFIX + key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(PREFIX + key, value); return true; } catch { return false; } };
const remove = key => { try { localStorage.removeItem(PREFIX + key); } catch { /* storage unavailable */ } };

export class Library {
    prefabIds;
    schemas;
    #pristine = new Map();
    constructor(prefabIds, schemas) {
        this.prefabIds = prefabIds;
        this.schemas = schemas;
        if (read('slot') === null) {
            try {
                const legacy = localStorage.getItem(LEGACY);
                if (legacy && read('doc.yard') === null) {
                    validateLevel(JSON.parse(legacy), prefabIds, schemas);
                    write('doc.yard', legacy);
                }
            }
            catch (error) {
                console.warn('The saved level from the previous version was not carried over:', error);
            }
            write('slot', 'yard');
        }
    }
    has(id) { return BUILTIN.some(b => b.id === id) || (id === IMPORT_SLOT && read(`doc.${IMPORT_SLOT}`) !== null); }
    get current() { const id = read('slot'); return id && this.has(id) ? id : BUILTIN[0].id; }
    set current(id) { write('slot', id); }
    /** A fresh copy of a built-in level, or null. */
    builtin(id) {
        const b = BUILTIN.find(item => item.id === id);
        return b ? validateLevel(b.build(), this.prefabIds, this.schemas) : null;
    }
    /** The working copy of a slot if it is valid, else the built-in original. */
    load(id) {
        const saved = read(`doc.${id}`);
        if (saved) {
            try {
                return validateLevel(JSON.parse(saved), this.prefabIds, this.schemas);
            }
            catch (error) {
                console.warn(`Saved level "${id}" was not loaded:`, error);
            }
        }
        const level = this.builtin(id);
        if (!level)
            throw new Error(`Unknown level: ${id}`);
        return level;
    }
    save(id, doc) { return write(`doc.${id}`, JSON.stringify(doc)); }
    /** Throw away the working copy and return the original. */
    reset(id) {
        remove(`doc.${id}`);
        return this.builtin(id);
    }
    /** True when the working copy differs from the shipped level. */
    edited(id) {
        const saved = read(`doc.${id}`);
        if (!saved)
            return false;
        let pristine = this.#pristine.get(id);
        if (pristine === undefined) {
            const level = this.builtin(id);
            pristine = level ? JSON.stringify(level) : '';
            this.#pristine.set(id, pristine);
        }
        return saved !== pristine;
    }
    /** The built-in level after this one, or null. */
    next(id) {
        const i = BUILTIN.findIndex(b => b.id === id);
        return i >= 0 && i < BUILTIN.length - 1 ? BUILTIN[i + 1].id : null;
    }
    number(id) { return BUILTIN.find(b => b.id === id)?.number ?? '··'; }
    /** Everything the level menu lists. */
    entries() {
        const list = BUILTIN.map(b => {
            const doc = this.load(b.id);
            return { id: b.id, number: b.number, name: doc.name, description: doc.description, best: this.best(this.bestKey(b.id, doc.name)), edited: this.edited(b.id), builtin: true };
        });
        if (this.has(IMPORT_SLOT)) {
            const doc = this.load(IMPORT_SLOT);
            list.push({ id: IMPORT_SLOT, number: '··', name: doc.name, description: doc.description || 'An imported level.', best: this.best(this.bestKey(IMPORT_SLOT, doc.name)), edited: false, builtin: false });
        }
        return list;
    }
    bestKey(id, name) { return id === IMPORT_SLOT ? `${IMPORT_SLOT}:${name}` : id; }
    #bests() {
        try {
            const raw = JSON.parse(read('best') ?? '{}');
            return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        }
        catch {
            return {};
        }
    }
    best(key) {
        const v = this.#bests()[key];
        return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
    }
    /** Keep the faster time. Returns { best, isNew }. */
    recordBest(key, seconds) {
        const all = this.#bests(), old = this.best(key);
        if (old !== null && old <= seconds)
            return { best: old, isNew: false };
        all[key] = Math.round(seconds * 100) / 100;
        write('best', JSON.stringify(all));
        return { best: all[key], isNew: true };
    }
}
