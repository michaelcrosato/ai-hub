import { validateCampaign } from './contract.js';
import { EpisodeSession, MemoryStorage } from './session.js';
import { Scope } from './scope.js';
export async function loadCampaign(url, signal) {
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Serve this directory with HTTP. Do not open it with file://.');
    const response = await fetch(url, { signal, cache: 'no-cache' });
    if (!response.ok)
        throw new Error(`Campaign load failed (${response.status}).`);
    const text = await response.text();
    if (text.length > 131072)
        throw new Error('Campaign manifest is too large.');
    return validateCampaign(JSON.parse(text));
}
export function tabStorage() {
    try {
        const key = `strata.storage-test.${crypto.randomUUID()}`;
        sessionStorage.setItem(key, '1');
        sessionStorage.removeItem(key);
        return { storage: sessionStorage, persistent: true };
    }
    catch {
        return { storage: new MemoryStorage(), persistent: false };
    }
}
export async function connectEpisode(id, manifestURL, notice = console.warn) {
    const scope = new Scope();
    try {
        const campaign = await loadCampaign(manifestURL, scope.abort.signal);
        const port = tabStorage();
        if (!port.persistent)
            notice('Session storage is blocked. This page can run, but progress cannot pass to another page.');
        const session = new EpisodeSession(campaign, id, { ...port, baseURL: manifestURL.href, navigate: url => location.assign(url) });
        scope.listen(window, 'pagehide', () => scope.dispose());
        // A restored page has old runtime objects. Re-enter from the saved session instead.
        window.addEventListener('pageshow', event => { if (event.persisted)
            location.reload(); });
        return { session, scope };
    }
    catch (error) {
        scope.dispose();
        throw error;
    }
}
export function downloadText(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
