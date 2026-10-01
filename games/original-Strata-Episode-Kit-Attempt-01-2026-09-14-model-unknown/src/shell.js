/**
 * Strata / Episode Kit — the page. It boots the wall's 3D kit once (renderer, quality tiers,
 * input, touch controls, settings) and runs the episode collection. Episodes stay separate
 * modules with their own rules: the shell imports one when the player enters it, hands it
 * the run contract (an EpisodeSession), and disposes it when the player leaves. Only JSON
 * crosses from one episode to the next, as before; the boundary moved from the page to
 * the module so the whole story runs in one page on the wall.
 */
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { loadCampaign, runStorage, downloadText } from './campaign/store.js';
import { EpisodeSession } from './campaign/session.js';
import { episodeURL, initialSave, parseSave, storageKey } from './campaign/contract.js';
import { applyScheme, menuScheme } from './schemes.js';
import { MenuNav } from './menunav.js';
import { Sound } from './sound.js';
import { loadPrefs } from './prefs.js';
import { createBackdrop } from './backdrop.js';

const $ = id => document.getElementById(id);
const ROOT = new URL('../', import.meta.url);
const DESCRIPTIONS = {
    yard: 'Clear three sentries, then board the car. FPS controls, rigid-body props, and local AI.',
    drive: 'An arcade car on a short coast road. Different controls and a local collision model. No FPS runtime.',
    breakwater: 'Signal cells, a lift, a beacon and lamp sentries: the FPS kit\'s own signal blocks, used together.',
    debrief: 'Read the result passed between episodes. No scene of its own, no Rapier, no rules.',
};

const kit = await boot({
    title: 'Strata',
    gear: 'none', // every menu has a Settings button (and F9 works everywhere)
    holdLoading: true,
    accent: '#dbbf7a',
    background: '#101c1b',
    input: menuScheme(),
    touch: { top: 'right', topOffset: 10 },
});
kit.renderer.toneMapping = THREE.ACESFilmicToneMapping;
kit.renderer.shadowMap.enabled = true;
kit.renderer.shadowMap.type = THREE.PCFShadowMap;

// One sun for every scene on the page: one shadow map, sized for the quality tier.
const sun = new THREE.DirectionalLight(0xfff0d5, 3.1);
sun.castShadow = true;
sun.shadow.bias = -.0002;
sun.shadow.normalBias = .04;
sun.shadow.radius = 2;
kit.shadow(sun, 2048);

const prefs = loadPrefs();
const sound = new Sound();
sound.volume = prefs.volume;
const unlockAudio = () => sound.unlock();
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
kit.onPause(paused => sound.hold(paused));

const nav = new MenuNav(kit.input);
const backdrop = createBackdrop(kit, sun);
const status = $('portal-status');

let noticeTimer = 0;
function notice(text) {
    const el = $('notice');
    el.textContent = text;
    el.classList.add('is-shown');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el.classList.remove('is-shown'), 3800);
}

let campaign = null, storage = null, persistent = false, key = '';
let active = null, mode = 'portal', loadingToken = 0;

function readSave() {
    const raw = storage?.getItem(key);
    return raw == null ? null : parseSave(raw, campaign);
}
function titleOf(id) {
    const e = campaign.episodes.find(x => x.id === id);
    return e ? (e.title.split(' / ')[1] ?? e.title) : id;
}

function refresh() {
    if (!campaign)
        return;
    let save = null;
    try {
        save = readSave();
        status.textContent = save ? `Saved run / ${titleOf(save.active)} / revision ${save.revision}` : 'No saved run in this browser.';
    }
    catch (error) {
        status.textContent = `Save not loaded: ${String(error.message ?? error)}\nExport it before starting a new run.`;
    }
    const resume = $('portal-resume');
    resume.disabled = !save;
    resume.textContent = save ? `Continue run: ${titleOf(save.active)}` : 'Continue run';
    $('portal-export').disabled = storage.getItem(key) === null;
    if (!persistent)
        status.textContent = 'Browser storage is blocked here, so this run lasts until the page closes. Export it to keep it.';
    return save;
}

function portalNav() {
    const focus = !$('portal-resume').disabled ? $('portal-resume') : $('portal-new');
    nav.set($('portal'), { focus, onBack: null });
}

function toPortal() {
    loadingToken++;
    if (active) {
        try {
            active.save?.();
        }
        catch { /* the episode reports its own save errors */ }
        disposeActive();
    }
    mode = 'portal';
    if (location.hash)
        history.replaceState(null, '', location.pathname + location.search);
    $('episode-loading').hidden = true;
    $('portal').hidden = false;
    applyScheme(kit, menuScheme());
    kit.touch?.suspend(true, 'portal');
    let lit = false;
    try {
        lit = readSave()?.shared?.['beacon-lit'] === true;
    }
    catch { /* shown by refresh */ }
    void backdrop.use('breakwater', { lit }).catch(error => console.error(error));
    refresh();
    portalNav();
}

function disposeActive() {
    const ep = active;
    active = null;
    try {
        ep?.dispose();
    }
    catch (error) {
        console.error(error);
    }
}

async function enter(id) {
    if (!campaign)
        return;
    const token = ++loadingToken;
    sound.unlock();
    disposeActive();
    closeConfirm();
    mode = 'loading';
    $('portal').hidden = true;
    kit.touch?.suspend(false, 'portal');
    nav.set(null);
    $('episode-loading-text').textContent = `Loading ${titleOf(id)}…`;
    $('episode-loading').hidden = false;
    try {
        const session = new EpisodeSession(campaign, id, {
            storage, persistent, baseURL: ROOT.href,
            // Called from inside an episode's own handler: switch once that handler has returned.
            navigate: target => { setTimeout(() => void enter(target), 0); },
        });
        const module = await import(episodeURL(campaign, id, ROOT.href));
        if (token !== loadingToken)
            return;
        $('episode-loading').hidden = true;
        const episode = await module.create({ kit, sun, sound, nav, session, prefs, backdrop, campaign, notice, toPortal, newRun });
        if (token !== loadingToken || !episode) {
            episode?.dispose();
            if (mode === 'portal')
                portalNav();
            return;
        }
        active = episode;
        mode = 'episode';
        history.replaceState(null, '', `#${id}`);
    }
    catch (error) {
        console.error(error);
        if (token === loadingToken) {
            toPortal();
            status.textContent = `Episode start failed: ${String(error.message ?? error)}`;
        }
    }
    finally {
        if (token === loadingToken)
            $('episode-loading').hidden = true;
    }
}

// ---- New run, with an in-page confirmation (works with a gamepad, unlike confirm()).
let confirmBefore = null, confirmYes = null;
function closeConfirm() {
    if ($('confirm').hidden)
        return;
    $('confirm').hidden = true;
    if (confirmBefore)
        nav.set(confirmBefore.root, { onBack: confirmBefore.onBack, focus: confirmBefore.focus });
    confirmBefore = null;
}
function askConfirm(title, text, yesLabel, onYes) {
    confirmBefore = { root: nav.root, onBack: nav.onBack, focus: document.activeElement };
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('confirm-yes').textContent = yesLabel;
    $('confirm').hidden = false;
    confirmYes = onYes;
    nav.set($('confirm'), { focus: $('confirm-no'), onBack: closeConfirm });
}
function startNewRun() {
    try {
        storage.setItem(key, JSON.stringify(initialSave(campaign)));
    }
    catch (error) {
        status.textContent = String(error.message ?? error);
        return;
    }
    void enter(campaign.start);
}
function newRun() {
    if (!campaign)
        return;
    if (storage.getItem(key) !== null)
        askConfirm('Replace the saved run?', 'Export it first to keep a copy. Best times are kept either way.', 'Replace run', startNewRun);
    else
        startNewRun();
}

// ---- Wire the collection.
$('confirm-yes').addEventListener('click', () => {
    const fn = confirmYes;
    confirmYes = null;
    closeConfirm();
    fn?.();
});
$('confirm-no').addEventListener('click', closeConfirm);
$('portal-new').addEventListener('click', newRun);
$('portal-resume').addEventListener('click', () => {
    try {
        const save = readSave();
        if (save)
            void enter(save.active);
    }
    catch (error) {
        status.textContent = String(error.message ?? error);
    }
});
$('portal-settings').addEventListener('click', () => kit.menu.open());
$('portal-export').addEventListener('click', () => downloadText('strata-run.json', storage.getItem(key) ?? '{}'));
$('portal-import').addEventListener('click', () => $('portal-file').click());
$('portal-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file)
        return;
    try {
        if (file.size > 65536)
            throw new Error('Save exceeds 64 KiB.');
        const save = parseSave(await file.text(), campaign);
        const apply = () => {
            storage.setItem(key, JSON.stringify(save));
            refresh();
            notice('Run imported.');
        };
        if (storage.getItem(key) !== null)
            askConfirm('Replace the saved run with this file?', 'The run in this browser is overwritten.', 'Replace run', apply);
        else
            apply();
    }
    catch (error) {
        status.textContent = `Import failed: ${String(error.message ?? error)}`;
    }
    finally {
        $('portal-file').value = '';
    }
});

kit.start((dt) => {
    if (mode === 'episode' && active)
        active.frame(dt);
    else if (mode === 'portal')
        backdrop.frame(dt);
    nav.update();
});

// Links to an episode (#yard, #drive, #breakwater, #debrief) open it directly once the
// campaign is read. Read the hash now: showing the collection clears it.
const direct = location.hash.slice(1);
applyScheme(kit, menuScheme());
kit.touch?.suspend(true, 'portal');
portalNav();
try {
    kit.loading.progress(.7, 'Reading the campaign…');
    campaign = await loadCampaign(new URL('campaign.json', ROOT));
    ({ storage, persistent } = runStorage());
    key = storageKey(campaign);
    const cards = $('portal-episodes');
    for (const [index, episode] of campaign.episodes.entries()) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'card';
        const number = document.createElement('span');
        number.className = 'index';
        number.textContent = `0${index + 1}`;
        const title = document.createElement('h2');
        title.textContent = episode.title.split(' / ')[1] ?? episode.title;
        const p = document.createElement('p');
        p.textContent = DESCRIPTIONS[episode.id] ?? 'An independent episode.';
        const label = document.createElement('span');
        label.className = 'eyebrow';
        label.textContent = 'Open this episode →';
        card.append(number, title, p, label);
        card.addEventListener('click', () => void enter(episode.id));
        cards.append(card);
    }
    $('portal-new').disabled = false;
    kit.loading.progress(.85, 'Building the harbor…');
    toPortal();
    await backdrop.use('breakwater', { lit: (() => { try { return readSave()?.shared?.['beacon-lit'] === true; } catch { return false; } })() });
}
catch (error) {
    console.error(error);
    status.textContent = `Start failed: ${String(error.message ?? error)}`;
}
finally {
    kit.loading.done();
}
if (campaign?.episodes.some(e => e.id === direct))
    void enter(direct);
