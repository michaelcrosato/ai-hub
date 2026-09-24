import { downloadText, loadCampaign, tabStorage } from './kit/browser.js';
import { episodeURL, initialSave, parseSave, storageKey } from './kit/contract.js';
const el = (id) => document.getElementById(id);
const status = el('status');
try {
    const url = new URL('./campaign.json', location.href), campaign = await loadCampaign(url), { storage, persistent } = tabStorage(), key = storageKey(campaign);
    const read = () => { const raw = storage.getItem(key); return raw === null ? null : parseSave(raw, campaign); };
    let valid = false;
    const refresh = () => {
        try {
            const save = read();
            valid = !!save;
            status.textContent = save ? `Saved run / ${campaign.episodes.find(e => e.id === save.active).title} / revision ${save.revision}` : 'No saved run in this tab.';
        }
        catch (error) {
            status.textContent = `Save not loaded: ${String(error)}\nExport it before starting a new run.`;
            valid = false;
        }
        el('resume').disabled = !valid || !persistent;
        el('export').disabled = storage.getItem(key) === null;
    };
    for (const [index, episode] of campaign.episodes.entries()) {
        const a = document.createElement('a');
        a.className = 'card';
        a.href = episodeURL(campaign, episode.id, url.href);
        const number = document.createElement('span');
        number.className = 'index';
        number.textContent = `0${index + 1}`;
        const title = document.createElement('h2');
        title.textContent = episode.title.split(' / ')[1] ?? episode.title;
        const p = document.createElement('p');
        p.textContent = ['Clear three sentries, then board the car. FPS controls, rigid-body props, and local AI.', 'An arcade car on a short coast road. Different controls and a local collision model. No FPS runtime.', 'Read the result passed between pages. No Three.js, no Rapier, and no canvas.'][index] ?? 'An independent episode.';
        const label = document.createElement('span');
        label.className = 'eyebrow';
        label.textContent = 'Open this episode →';
        a.append(number, title, p, label);
        el('episodes').append(a);
    }
    el('new').disabled = false;
    el('new').onclick = () => {
        if (storage.getItem(key) !== null && !confirm('Replace the saved run in this tab? Export it first to keep a copy.'))
            return;
        try {
            storage.setItem(key, JSON.stringify(initialSave(campaign)));
            location.assign(episodeURL(campaign, campaign.start, url.href));
        }
        catch (error) {
            status.textContent = String(error);
        }
    };
    el('resume').onclick = () => { try {
        const save = read();
        if (save)
            location.assign(episodeURL(campaign, save.active, url.href));
    }
    catch (error) {
        status.textContent = String(error);
    } };
    el('export').onclick = () => downloadText('strata-run.json', storage.getItem(key) ?? '{}');
    el('import').disabled = !persistent;
    el('import').onclick = () => el('file').click();
    el('file').onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        try {
            if (file.size > 65536)
                throw new Error('Save exceeds 64 KiB.');
            const save = parseSave(await file.text(), campaign);
            if (storage.getItem(key) !== null && !confirm('Replace the saved run with this file?'))
                return;
            storage.setItem(key, JSON.stringify(save));
            refresh();
        }
        catch (error) {
            status.textContent = `Import failed: ${String(error)}`;
        }
        finally {
            el('file').value = '';
        }
    };
    refresh();
    if (!persistent)
        status.textContent = 'Session storage is blocked. Episode links work, but cross-page progress and run import are unavailable.';
}
catch (error) {
    status.textContent = `Start failed: ${String(error)}`;
}
