import { validateCampaign } from './contract.js';
import { MemoryStorage } from './session.js';

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

/**
 * Where a run lives. It used to be the tab (sessionStorage), so closing the tab lost the
 * story; it now survives in this browser (localStorage), with an in-memory fallback when
 * storage is blocked (private modes, embedded frames).
 */
export function runStorage() {
    try {
        const key = `strata.storage-test.${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(key, '1');
        localStorage.removeItem(key);
        return { storage: localStorage, persistent: true };
    }
    catch {
        return { storage: new MemoryStorage(), persistent: false };
    }
}

export function downloadText(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
