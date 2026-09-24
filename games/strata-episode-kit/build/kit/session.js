import { episodeURL, initialSave, jsonObject, parseSave, storageKey, validateCampaign, validateSave } from './contract.js';
/** A tab-local transaction boundary. Only JSON crosses a page boundary. */
export class EpisodeSession {
    id;
    ports;
    campaign;
    key;
    route;
    current;
    leaving = false;
    constructor(raw, id, ports) {
        this.id = id;
        this.ports = ports;
        this.campaign = validateCampaign(raw);
        const route = this.campaign.episodes.find(e => e.id === id);
        if (!route)
            throw new Error(`Episode is not in this campaign: ${id}`);
        this.route = route;
        this.key = storageKey(this.campaign);
        episodeURL(this.campaign, id, ports.baseURL);
        const stored = ports.storage.getItem(this.key);
        this.current = stored === null ? initialSave(this.campaign, id) : parseSave(stored, this.campaign);
        // Direct links and reloads are supported. Entering a page is not completing an exit.
        this.current.active = id;
        this.current.revision++;
        this.persist(this.current);
    }
    get snapshot() { return structuredClone(this.current); }
    get shared() { return structuredClone(this.current.shared); }
    get local() { return structuredClone(this.current.episodes[this.id]?.data ?? {}); }
    get transitioning() { return this.leaving; }
    get canTransition() { return this.ports.persistent !== false; }
    persist(next) {
        const checked = validateSave(next, this.campaign);
        this.ports.storage.setItem(this.key, JSON.stringify(checked));
        this.current = checked;
    }
    checkOwner() {
        if (this.leaving)
            throw new Error('This page is already leaving.');
        const stored = this.ports.storage.getItem(this.key);
        if (stored === null || parseSave(stored, this.campaign).revision !== this.current.revision)
            throw new Error('This page has an old session. Reload it before saving.');
    }
    checkpoint(local, shared = this.current.shared) {
        this.checkOwner();
        const next = this.snapshot;
        next.episodes[this.id] = { version: this.route.stateVersion, data: jsonObject(local) };
        next.shared = jsonObject(shared);
        next.revision++;
        this.persist(next);
    }
    /** Return false for repeated completion. Save first; navigate only after it succeeds. */
    complete(exit, result = {}) {
        if (this.leaving)
            return false;
        this.checkOwner();
        if (!this.canTransition)
            throw new Error('Session storage is unavailable. Export your save before leaving this page.');
        const target = Object.hasOwn(this.route.exits, exit) ? this.route.exits[exit] : undefined;
        if (!target)
            throw new Error(`Unknown exit: ${exit}`);
        const url = episodeURL(this.campaign, target, this.ports.baseURL);
        const before = this.snapshot, next = this.snapshot;
        next.episodes[this.id] = { version: this.route.stateVersion, data: jsonObject(result.local ?? this.local) };
        next.shared = jsonObject(result.shared ?? this.current.shared);
        next.active = target;
        next.lastExit = { from: this.id, to: target, exit };
        next.revision++;
        this.persist(next);
        this.leaving = true;
        try {
            this.ports.navigate(url);
        }
        catch (error) {
            this.leaving = false;
            try {
                this.persist(before);
            }
            catch (rollback) {
                throw new AggregateError([error, rollback], 'Navigation failed. The saved transition could not be rolled back.');
            }
            throw error;
        }
        return true;
    }
    export() { return JSON.stringify(this.current); }
}
export class MemoryStorage {
    data = new Map();
    getItem(key) { return this.data.get(key) ?? null; }
    setItem(key, value) { this.data.set(key, value); }
    removeItem(key) { this.data.delete(key); }
}
