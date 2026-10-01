export const API_VERSION = 1;
export const MAX_SAVE_BYTES = 65_536;
const idPattern = /^[a-z][a-z0-9-]{0,63}$/;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new Error(`${label} must be a plain object.`);
    return value;
}
export function identifier(value, label) {
    if (typeof value !== 'string' || !idPattern.test(value) || forbidden.has(value))
        throw new Error(`${label} is not a valid ID.`);
    return value;
}
/** Reject silent JSON data loss, deep graphs, cycles, and unsafe property names. */
export function jsonObject(value, label = 'Data') {
    record(value, label);
    const seen = new Set();
    let count = 0;
    const walk = (v, depth) => {
        if (++count > 8192 || depth > 12)
            throw new Error(`${label} is too complex.`);
        if (v === null || typeof v === 'boolean')
            return;
        if (typeof v === 'number' && Number.isFinite(v))
            return;
        if (typeof v === 'string' && v.length <= 32768)
            return;
        if (!v || typeof v !== 'object' || seen.has(v))
            throw new Error(`${label} must contain finite JSON data without cycles.`);
        seen.add(v);
        if (Object.getOwnPropertySymbols(v).length)
            throw new Error(`${label} has symbol keys.`);
        const descriptors = Object.getOwnPropertyDescriptors(v);
        for (const [key, descriptor] of Object.entries(descriptors)) {
            if (Array.isArray(v) && key === 'length')
                continue;
            if (!('value' in descriptor) || !descriptor.enumerable)
                throw new Error(`${label} has non-JSON properties.`);
            if (Array.isArray(v) && !/^(0|[1-9][0-9]*)$/.test(key))
                throw new Error(`${label} has array properties.`);
        }
        if (Array.isArray(v)) {
            for (let i = 0; i < v.length; i++)
                walk(v[i], depth + 1);
        }
        else {
            for (const [key, item] of Object.entries(record(v, label))) {
                if (forbidden.has(key) || key.length > 128)
                    throw new Error(`${label} has an unsafe key.`);
                walk(item, depth + 1);
            }
        }
        seen.delete(v);
    };
    walk(value, 0);
    const text = JSON.stringify(value);
    if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES)
        throw new Error(`${label} exceeds the 64 KiB limit.`);
    return JSON.parse(text);
}
function text(v, label) {
    if (typeof v !== 'string' || !v.trim() || v.length > 160)
        throw new Error(`${label} must be 1–160 characters.`);
    return v;
}
export function validateCampaign(raw) {
    const c = record(raw, 'Campaign');
    if (c.api !== API_VERSION)
        throw new Error('Unsupported campaign API. Expected version 1.');
    const id = identifier(c.id, 'Campaign ID'), start = identifier(c.start, 'Start ID');
    if (!Array.isArray(c.episodes) || !c.episodes.length || c.episodes.length > 256)
        throw new Error('Campaign needs 1–256 episodes.');
    const ids = new Set(), entries = new Set();
    const episodes = c.episodes.map((rawEpisode) => {
        const e = record(rawEpisode, 'Episode');
        const episodeId = identifier(e.id, 'Episode ID'), entry = text(e.entry, 'Entry');
        // Local episode modules only. Resolution also checks the deployment root at runtime.
        if (!/^(?:\.\/)?[a-zA-Z0-9_-][a-zA-Z0-9_./-]*\.js$/.test(entry) || entry.split('/').some(s => s === '..' || s === ''))
            throw new Error(`Invalid episode module: ${entry}`);
        const canonicalEntry = entry.replace(/^\.\//, '');
        if (canonicalEntry.split('/').some(s => s === '.'))
            throw new Error('Entry has an ambiguous dot segment.');
        if (ids.has(episodeId) || entries.has(canonicalEntry))
            throw new Error('Duplicate episode ID or entry.');
        ids.add(episodeId);
        entries.add(canonicalEntry);
        if (!Number.isSafeInteger(e.stateVersion) || Number(e.stateVersion) < 1)
            throw new Error('Invalid episode state version.');
        const exits = {};
        for (const [key, value] of Object.entries(record(e.exits, 'Exits')))
            exits[identifier(key, 'Exit')] = identifier(value, 'Exit target');
        return { id: episodeId, title: text(e.title, 'Episode title'), entry: canonicalEntry, stateVersion: Number(e.stateVersion), exits };
    });
    if (!ids.has(start))
        throw new Error('Campaign start does not exist.');
    for (const e of episodes)
        for (const target of Object.values(e.exits))
            if (!ids.has(target))
                throw new Error(`Unknown exit target: ${target}`);
    return { api: 1, id, title: text(c.title, 'Campaign title'), start, episodes };
}
export function initialSave(c, active = c.start) {
    if (!c.episodes.some(e => e.id === active))
        throw new Error('Unknown active episode.');
    return { api: 1, campaign: c.id, revision: 0, active, shared: {}, episodes: {}, lastExit: null };
}
export function validateSave(raw, campaign) {
    // Validate the entire graph before normalization. No unknown value can hide a cycle.
    const s = jsonObject(raw, 'Save');
    if (s.api !== 1 || s.campaign !== campaign.id)
        throw new Error('This save uses another campaign or API version.');
    if (!Number.isSafeInteger(s.revision) || Number(s.revision) < 0 || Number(s.revision) >= Number.MAX_SAFE_INTEGER - 1)
        throw new Error('Invalid save revision.');
    const active = identifier(s.active, 'Active episode');
    if (!campaign.episodes.some(e => e.id === active))
        throw new Error('Saved episode is not installed.');
    const episodes = {};
    for (const [id, value] of Object.entries(record(s.episodes, 'Episode saves'))) {
        const route = campaign.episodes.find(e => e.id === id), entry = record(value, 'Episode save');
        if (!route)
            throw new Error(`Saved episode is not installed: ${id}`);
        if (entry.version !== route.stateVersion)
            throw new Error(`Save migration required for ${id}. Expected version ${route.stateVersion}.`);
        episodes[id] = { version: route.stateVersion, data: jsonObject(entry.data) };
    }
    let lastExit = null;
    if (s.lastExit !== null && s.lastExit !== undefined) {
        const exit = record(s.lastExit, 'Last exit');
        const from = identifier(exit.from, 'Exit source'), to = identifier(exit.to, 'Exit target'), name = identifier(exit.exit, 'Exit name');
        // A run exported before an episode was added may name an exit the campaign no longer
        // has. The exit is history, not state: drop it instead of refusing the whole run.
        if (campaign.episodes.find(e => e.id === from)?.exits[name] === to)
            lastExit = { from, to, exit: name };
    }
    return { api: 1, campaign: campaign.id, revision: Number(s.revision), active, shared: jsonObject(s.shared), episodes, lastExit };
}
export function parseSave(text, campaign) {
    if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES)
        throw new Error('Save exceeds 64 KiB.');
    return validateSave(JSON.parse(text), campaign);
}
export function storageKey(c) { return `strata.campaign.v1.${c.id}`; }
/** The module that runs an episode, resolved inside the game's own folder. */
export function episodeURL(c, id, base) {
    const episode = c.episodes.find(e => e.id === id);
    if (!episode)
        throw new Error(`Unknown episode: ${id}`);
    const root = new URL('./', base), url = new URL(episode.entry, root);
    if (!['http:', 'https:'].includes(root.protocol) || url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
        throw new Error('Episodes must use HTTP(S) on the same origin and inside the deployment directory.');
    return url.href;
}
