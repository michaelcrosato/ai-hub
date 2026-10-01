/**
 * Standalone adapter. It does not fetch a manifest or load another game page.
 * The existing page contract validates the save and the named exits.
 * A virtual HTTP base is used only for route validation. It is never fetched.
 * For real page changes, use connectEpisode in ../kit/browser.js instead.
 *
 * The campaign has two playable episodes in this page: Loading Bay ('fps')
 * exits to Pump House ('pump'), which exits to the result.
 */
import { EpisodeSession, MemoryStorage } from '../kit/session.js';
import { validateCampaign, parseSave, storageKey, identifier } from '../kit/contract.js';
import { Scope } from '../kit/scope.js';

const memory = new MemoryStorage();

export function starterCampaign(config = {}) {
    const campaignID = identifier(config.saveId ?? 'strata-fps-handoff', 'Save ID');
    return validateCampaign({
        api: 1, id: campaignID, title: config.title ?? 'FPS starter', start: 'fps',
        episodes: [
            { id: 'fps', title: 'Loading Bay', entry: 'fps.html', stateVersion: 1, exits: { finish: 'pump' } },
            { id: 'pump', title: 'Pump House', entry: 'pump.html', stateVersion: 1, exits: { finish: 'result' } },
            { id: 'result', title: 'Sample result', entry: 'result.html', stateVersion: 1, exits: {} },
        ],
    });
}

/** Browser storage that outlives the tab (so Continue works next visit), else memory for this page. */
function pageStorage(campaign) {
    try {
        const probe = `${storageKey(campaign)}.probe`;
        const storage = window.localStorage;
        storage.setItem(probe, '1');
        storage.removeItem(probe);
        return { storage, persistence: 'browser' };
    }
    catch {
        return { storage: memory, persistence: 'memory' };
    }
}

/** Read the stored save without claiming it (for the title screen). Null when there is none or it is invalid. */
export function peekSave(config = {}) {
    try {
        const campaign = starterCampaign(config);
        const { storage } = pageStorage(campaign);
        const raw = storage.getItem(storageKey(campaign));
        return raw === null ? null : parseSave(raw, campaign);
    }
    catch {
        return null;
    }
}

export function createStarterSession(config, onComplete, notice = () => { }, storageOverride, episode = 'fps') {
    const campaign = starterCampaign(config);
    let storage = storageOverride;
    let persistence = storageOverride ? 'supplied' : 'browser';
    if (!storage) {
        ({ storage, persistence } = pageStorage(campaign));
        if (persistence === 'memory')
            notice('Browser storage is blocked. Export your save before you close this page.');
    }
    let session;
    const open = () => new EpisodeSession(campaign, episode, {
        storage,
        // In-page completion can use memory. It must not navigate to another document.
        persistent: true,
        baseURL: 'https://standalone.strata.invalid/',
        navigate: () => onComplete(session.snapshot),
    });
    try {
        session = open();
    }
    catch (error) {
        // A stored save this version cannot read must not lock the player out: clear it once and start clean.
        if (storageOverride)
            throw error;
        storage.removeItem(storageKey(campaign));
        notice(`The stored checkpoint could not be read and was cleared (${String(error.message ?? error)}).`);
        session = open();
    }
    const scope = new Scope();
    return {
        session, scope, persistence,
        /** Validate and store an imported save. Returns it; the caller disposes and remounts. */
        importSave(text) {
            const checked = parseSave(text, campaign);
            storage.setItem(storageKey(campaign), JSON.stringify(checked));
            // The caller must dispose and remount. The old session has stale ownership.
            return checked;
        },
        reset() { storage.removeItem(storageKey(campaign)); },
    };
}

export function downloadText(name, text, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
