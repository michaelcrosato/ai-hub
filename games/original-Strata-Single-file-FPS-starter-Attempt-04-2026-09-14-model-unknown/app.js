/**
 * Strata FPS starter — the page shell.
 *
 * Boots the shared kit (three.js r186 with WebGPU and a WebGL2 fallback,
 * Rapier 0.20, input, touch controls, quality tiers), mounts one episode at a
 * time, and runs the menus: title, pause, results and the starter guide. Game
 * rules live in strata/episode/; this file only wires the page around them.
 */
import { boot } from 'kit/boot.js';
import { mount, EPISODES, episodeOrder, formatTime } from './strata/episode/main.js';
import { peekSave } from './strata/episode/session.js';
import { Sound } from './strata/fps/sound.js';
import { actionDefs, sanitizeBindings, defaultBindings, rebindable, isBindableCode, keyName, controlRows } from './strata/engine/Input.js';
import { DIFFICULTY } from './strata/episode/local-ai.js';

const $ = id => document.getElementById(id);
const config = JSON.parse($('strata-config').textContent);
const saveId = config.saveId ?? 'strata-fps-handoff';
const PREFS_KEY = `strata.fps.preferences.v1.${saveId}`;
const BEST_KEY = `strata.fps.best.v1.${saveId}`;

const store = {
    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key) ?? 'null');
        }
        catch {
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        }
        catch {
            return false;
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        }
        catch { /* storage blocked */ }
    },
};

// ---------------------------------------------------------------- preferences (this game's own; the kit keeps graphics and look settings)
const defaultPrefs = () => ({ fov: config.player?.fov ?? 78, headBob: config.player?.headBob ?? .2, volume: .15, difficulty: 'normal', bindings: structuredClone(defaultBindings) });
function loadPrefs() {
    const p = defaultPrefs(), raw = store.get(PREFS_KEY);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        if (typeof raw.fov === 'number' && raw.fov >= 60 && raw.fov <= 110)
            p.fov = raw.fov;
        if (typeof raw.headBob === 'number' && raw.headBob >= 0 && raw.headBob <= 1)
            p.headBob = raw.headBob;
        if (typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= .4)
            p.volume = raw.volume;
        if (DIFFICULTY[raw.difficulty])
            p.difficulty = raw.difficulty;
        p.bindings = sanitizeBindings(raw.bindings);
    }
    return p;
}
const prefs = loadPrefs();
const savePrefs = () => {
    if (!store.set(PREFS_KEY, prefs))
        notice('Settings apply now, but browser storage is blocked.');
};

// ---------------------------------------------------------------- best times per episode and difficulty
function bests() {
    const raw = store.get(BEST_KEY);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}
/** The fastest clear of an episode at any difficulty: { time, difficulty } or null. */
function bestFor(id) {
    const entry = bests()[id];
    let best = null;
    if (entry && typeof entry === 'object')
        for (const [difficulty, time] of Object.entries(entry))
            if (DIFFICULTY[difficulty] && Number.isFinite(time) && time > 0 && (!best || time < best.time))
                best = { time, difficulty };
    return best;
}
function recordBest(summary) {
    const all = bests();
    const entry = all[summary.episode] && typeof all[summary.episode] === 'object' ? all[summary.episode] : (all[summary.episode] = {});
    const previous = Number.isFinite(entry[summary.difficulty]) ? entry[summary.difficulty] : null;
    const isBest = previous === null || summary.time < previous;
    if (isBest) {
        entry[summary.difficulty] = Math.round(summary.time * 100) / 100;
        store.set(BEST_KEY, all);
    }
    return { isBest, previous };
}
const unlocked = id => id === 'fps' || peekSave(config)?.shared?.['yard-cleared'] === true || bestFor('fps') !== null;

// ---------------------------------------------------------------- boot the shared stack
const kit = await boot({
    title: 'Strata FPS starter',
    physics: true,
    mount: $('viewport'),
    gear: 'none',
    touch: { top: 'right', topOffset: 10 },
    accent: '#dbbf7a',
    background: '#101c1b',
    input: actionDefs(prefs.bindings),
});
const input = kit.input;
const sound = new Sound();
sound.setVolume(prefs.volume);

let active = null;
let episode = 'fps';
let mode = 'loading';
let guideReturn = 'title';
let pausedAt = 0;
let loadToken = 0;
let lastResult = null;
let noticeTimer = 0;
let hadLock = false;
let guideModule = null;

function notice(text) {
    $('notice').textContent = text;
    $('status').textContent = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 4500);
}
let shellTimer = 0;
function shellNotice(text) {
    $('shell-notice').textContent = text;
    clearTimeout(shellTimer);
    shellTimer = setTimeout(() => { $('shell-notice').textContent = ''; }, 5500);
}

// ---------------------------------------------------------------- modes and menus
const menuOpen = () => mode === 'title' || mode === 'paused' || mode === 'loading';
function setMode(next) {
    mode = next;
    $('menu').hidden = !menuOpen();
    $('completion').hidden = next !== 'results';
    $('guide-app').hidden = next !== 'guide';
    document.body.dataset.view = next === 'guide' ? 'guide' : 'game';
    kit.touch?.suspend(next !== 'playing', 'game');
    input.settle();
    sound.suspend(next === 'guide' || kit.paused);
    if (menuOpen())
        refreshMenu();
    if (next === 'playing') {
        const focused = document.activeElement;
        if (focused && focused !== document.body && focused.closest?.('.overlay'))
            focused.blur();
        try {
            kit.canvas.focus({ preventScroll: true });
        }
        catch { /* not focusable here */ }
    }
    else if (next !== 'guide' && input.source !== 'touch')
        focusDefault();
}
function refreshMenu() {
    const info = EPISODES[episode], paused = mode === 'paused';
    $('game-title').textContent = active?.title ?? info.title;
    $('menu-eyebrow').textContent = paused ? `Paused / ${info.number} ${info.title}` : 'Strata / FPS starter';
    $('menu-lead').textContent = info.lead + (info.next ? ` Then take episode ${EPISODES[info.next].number}, ${EPISODES[info.next].title}.` : '');
    const play = $('play');
    play.disabled = !active || mode === 'loading';
    play.textContent = mode === 'loading' ? 'Loading…' : !active ? 'Cannot start' : paused ? 'Resume' : active.started ? `Continue ${info.title.toLowerCase()}` : info.verb;
    $('save').disabled = !active;
    $('restart-level').hidden = !active || !(paused || active.started);
    $('return-start').hidden = !paused;
    for (const id of episodeOrder) {
        const button = $(`episode-${id}`), open = unlocked(id), best = bestFor(id);
        button.disabled = !open || mode === 'loading';
        button.classList.toggle('is-current', id === episode);
        button.setAttribute('aria-pressed', String(id === episode));
        $(`episode-${id}-note`).textContent = !open ? 'Clear Loading Bay to unlock'
            : best ? `Best ${formatTime(best.time)} · ${DIFFICULTY[best.difficulty].label}`
                : id === 'fps' ? 'Three sentries and a getaway car' : 'Cells, a shutter and four sentries';
    }
    renderControls();
}
function renderControls() {
    const list = document.createElement('dl');
    for (const [action, binding] of controlRows(input.source, prefs.bindings)) {
        const dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = action;
        dd.textContent = binding;
        list.append(dt, dd);
    }
    $('controls-help').replaceChildren(list);
}
input.onSourceChange(() => {
    if (menuOpen())
        renderControls();
});

// ---------------------------------------------------------------- episodes
async function load(id, { fresh = false, autoplay = false } = {}) {
    const token = ++loadToken;
    try {
        active?.dispose();
    }
    catch (error) {
        console.error(error);
    }
    active = null;
    episode = EPISODES[id] ? id : 'fps';
    if (mode === 'guide')
        guideReturn = 'loading';
    else
        setMode('loading');
    $('status').textContent = `Loading ${EPISODES[episode].title}…`;
    try {
        const created = await mount(kit, config, { episode, fresh, sound, prefs, bindings: prefs.bindings, notice, mode: onRunning, complete: onComplete });
        if (token !== loadToken) {
            created.dispose();
            return;
        }
        active = created;
        $('status').textContent = `Ready. Checkpoint storage: ${created.persistence === 'browser' ? 'this browser' : created.persistence}.`;
        if (mode === 'guide')
            guideReturn = 'title';
        else
            setMode('title');
        if (autoplay && mode === 'title')
            play();
    }
    catch (error) {
        console.error(error);
        if (token !== loadToken)
            return;
        $('status').textContent = `The FPS sample could not start. ${String(error)}\nReload the page to try again. The guide and source still work.`;
        if (mode !== 'guide')
            setMode('title');
    }
}
function onRunning(running) {
    if (running)
        setMode('playing');
    else if (mode === 'playing') {
        pausedAt = performance.now();
        setMode('paused');
    }
}
function onComplete(result, summary) {
    lastResult = { result, summary };
    const best = recordBest(summary);
    const last = !summary.next;
    $('result-title').textContent = last ? 'Sample complete.' : `${summary.title} cleared.`;
    $('result-lead').textContent = last
        ? 'The exit saved the result below. A real campaign can send these facts to another HTML episode. This single-page sample ends here.'
        : `The named exit saved the result below and opened episode ${EPISODES[summary.next].number}, ${EPISODES[summary.next].title}.`;
    const rows = [
        ['Time', formatTime(summary.time), best.isBest],
        ['Best', best.isBest ? 'New best' : formatTime(best.previous), best.isBest],
        ['Accuracy', summary.shots ? `${Math.round(summary.accuracy * 100)}%` : '—'],
        ['Sentries', String(summary.sentries)],
        ['Taken down', String(summary.deaths)],
        ['Difficulty', DIFFICULTY[summary.difficulty]?.label ?? 'Standard'],
    ];
    const stats = $('result-stats');
    stats.replaceChildren(...rows.map(([name, value, highlight]) => {
        const box = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = name;
        dd.textContent = value;
        box.className = highlight ? 'new-best' : '';
        box.append(dt, dd);
        return box;
    }));
    $('result-next').textContent = summary.next ? `Continue to ${EPISODES[summary.next].title.toLowerCase()}` : 'Play loading bay again';
    $('result-replay').textContent = `Replay ${summary.title.toLowerCase()}`;
    $('completion-data').textContent = JSON.stringify(result, null, 2);
    setMode('results');
}
function play() {
    if (!active || active.completed)
        return;
    void sound.resume().catch(() => notice('Sound is not available.'));
    active.play();
}
function pauseGame() {
    if (mode === 'playing')
        active?.pause();
}
function saveRun() {
    if (active && !active.completed && active.started)
        try {
            active.save();
        }
        catch { /* an old session cannot save; the switch still goes ahead */ }
}

// ---------------------------------------------------------------- buttons
$('play').addEventListener('click', play);
$('restart-level').addEventListener('click', () => void load(episode, { fresh: true, autoplay: true }));
$('return-start').addEventListener('click', () => {
    active?.returnToStart();
    play();
});
$('save').addEventListener('click', () => {
    try {
        const where = active.save();
        notice(`Checkpoint saved (${where === 'browser' ? 'this browser' : where}).`);
    }
    catch (error) {
        notice(String(error));
    }
});
const exportSave = () => {
    try {
        active?.exportSave();
    }
    catch (error) {
        notice(String(error));
    }
};
$('export-save').addEventListener('click', exportSave);
$('completion-export').addEventListener('click', exportSave);
$('open-settings').addEventListener('click', () => kit.menu.open());
$('open-guide').addEventListener('click', () => void openGuide());
for (const id of episodeOrder)
    $(`episode-${id}`).addEventListener('click', () => {
        if (id === episode && active && !active.completed)
            return;
        saveRun();
        void load(id);
    });
$('result-next').addEventListener('click', () => {
    const summary = lastResult?.summary;
    if (summary?.next)
        void load(summary.next, { autoplay: true });
    else
        void load('fps', { fresh: true, autoplay: true });
});
$('result-replay').addEventListener('click', () => void load(lastResult?.summary.episode ?? episode, { fresh: true, autoplay: true }));
// Reset asks twice in the page itself (no blocking browser dialog, and it works with a gamepad).
function armReset(button) {
    if (button.dataset.armed !== '1') {
        button.dataset.armed = '1';
        button.textContent = 'Confirm: delete checkpoint';
        setTimeout(() => {
            if (button.dataset.armed === '1') {
                button.dataset.armed = '';
                button.textContent = 'Reset sample';
            }
        }, 4000);
        return;
    }
    button.dataset.armed = '';
    button.textContent = 'Reset sample';
    try {
        if (active)
            active.reset();
        else
            store.remove(`strata.campaign.v1.${saveId}`);
    }
    catch (error) {
        notice(String(error));
    }
    void load('fps', { fresh: true }).then(() => notice('The sample checkpoint was deleted. Best times are kept.'));
}
$('restart').addEventListener('click', event => armReset(event.currentTarget));
$('completion-restart').addEventListener('click', event => armReset(event.currentTarget));
$('import-save').addEventListener('change', async event => {
    const field = event.target, file = field.files?.[0];
    if (!file)
        return;
    try {
        if (file.size > 65536)
            throw new Error('Save exceeds 64 KiB.');
        if (!active)
            throw new Error('The sample is still loading.');
        const checked = active.importSave(await file.text());
        await load(EPISODES[checked.active] ? checked.active : 'fps');
        notice('Checkpoint imported. Play starts at the safe spawn.');
    }
    catch (error) {
        notice(`Import failed: ${String(error)}`);
    }
    finally {
        field.value = '';
    }
});

// ---------------------------------------------------------------- settings form and key rebinding
function syncForm() {
    $('fov').value = String(prefs.fov);
    $('bob').value = String(prefs.headBob);
    $('volume').value = String(prefs.volume);
    $('difficulty').value = prefs.difficulty;
    renderRebinds();
}
for (const id of ['fov', 'bob', 'volume'])
    $(id).addEventListener('input', () => {
        prefs.fov = Number($('fov').value);
        prefs.headBob = Number($('bob').value);
        prefs.volume = Number($('volume').value);
        sound.setVolume(prefs.volume);
        active?.applyPrefs(prefs);
        savePrefs();
    });
$('difficulty').addEventListener('change', () => {
    prefs.difficulty = DIFFICULTY[$('difficulty').value] ? $('difficulty').value : 'normal';
    savePrefs();
    notice(`Difficulty: ${DIFFICULTY[prefs.difficulty].label}. A run's best time counts at the lowest difficulty it used.`);
});
let cancelRebind = null;
function renderRebinds() {
    cancelRebind?.();
    const box = $('rebinds');
    box.replaceChildren();
    for (const action of rebindable) {
        const button = document.createElement('button');
        button.type = 'button';
        const refresh = () => { button.textContent = `${action}: ${prefs.bindings[action].map(keyName).join(' / ')}`; };
        refresh();
        button.addEventListener('click', () => {
            cancelRebind?.();
            button.textContent = 'Press a key / Esc cancels';
            const listener = event => {
                // Capture phase on window: the kit never sees the key that is being bound.
                event.preventDefault();
                event.stopImmediatePropagation();
                if (event.code !== 'Escape') {
                    if (isBindableCode(event.code)) {
                        prefs.bindings[action] = [event.code];
                        input.define(actionDefs(prefs.bindings));
                        savePrefs();
                        renderControls();
                    }
                    else
                        notice(`${event.code} cannot be bound. Use a letter, digit, arrow, Space, Shift, Ctrl or Alt.`);
                }
                cancelRebind?.();
            };
            cancelRebind = () => {
                window.removeEventListener('keydown', listener, true);
                refresh();
                cancelRebind = null;
            };
            window.addEventListener('keydown', listener, true);
        });
        box.append(button);
    }
}
$('restore-settings').addEventListener('click', () => {
    store.remove(PREFS_KEY);
    Object.assign(prefs, defaultPrefs());
    input.define(actionDefs(prefs.bindings));
    sound.setVolume(prefs.volume);
    active?.applyPrefs(prefs);
    syncForm();
    renderControls();
    notice('Default settings restored.');
});

// ---------------------------------------------------------------- the starter guide (an overlay; its tools load on first open)
async function openGuide() {
    if (mode === 'guide')
        return;
    if (mode === 'playing')
        pauseGame();
    guideReturn = mode;
    setMode('guide');
    if (input.source !== 'touch')
        $('launch-top').focus({ preventScroll: true });
    try {
        guideModule ??= await import('./guide.js');
        guideModule.initGuide({ notice: shellNotice });
    }
    catch (error) {
        shellNotice(`The guide tools could not load: ${String(error)}`);
    }
}
function closeGuide() {
    if (mode !== 'guide')
        return;
    setMode(guideReturn === 'loading' ? (active ? 'title' : 'loading') : guideReturn);
}
for (const id of ['launch-top', 'launch-main', 'launch-bottom'])
    $(id).addEventListener('click', closeGuide);

// ---------------------------------------------------------------- pointer capture, pause and audio unlock
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === kit.canvas)
        hadLock = true;
    else {
        // Esc (or anything else) that releases the mouse pauses the game.
        if (hadLock && mode === 'playing')
            pauseGame();
        hadLock = false;
    }
});
document.addEventListener('pointerlockerror', () => {
    if (mode === 'playing')
        notice('Mouse capture was refused. Click the view to try again, or play with a gamepad.');
});
kit.canvas.addEventListener('pointerdown', event => {
    if (mode === 'playing' && event.pointerType === 'mouse' && !document.pointerLockElement)
        input.lockPointer();
});
kit.onPause(paused => {
    if (paused)
        pauseGame();
    sound.suspend(paused || mode === 'guide');
});
const unlockAudio = () => void sound.resume().catch(() => { });
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

// ---------------------------------------------------------------- gamepad and keyboard menu navigation
function menuRoot() { return mode === 'results' ? $('completion') : $('menu'); }
function defaultButton() {
    if (mode === 'results')
        return $('result-next');
    return $('play').disabled ? null : $('play');
}
function focusDefault() {
    const button = defaultButton();
    if (button)
        try {
            button.focus({ preventScroll: true });
        }
        catch {
            button.focus();
        }
}
// The file picker stays a mouse and touch control: a gamepad cannot use the dialog it opens.
const focusables = root => [...root.querySelectorAll('button, select, input:not([type=file]), summary')].filter(el => !el.disabled && el.offsetParent !== null);
function moveFocus(root, dir) {
    const list = focusables(root);
    if (!list.length)
        return;
    let i = list.indexOf(document.activeElement);
    if (i < 0) {
        const fallback = defaultButton();
        i = fallback ? list.indexOf(fallback) : -1;
        if (i >= 0) {
            list[i].focus();
            list[i].scrollIntoView?.({ block: 'nearest' });
            return;
        }
        i = dir > 0 ? -1 : 0;
    }
    const next = list[(i + dir + list.length) % list.length];
    next.focus();
    next.scrollIntoView?.({ block: 'nearest' });
    sound.cue('ui');
}
function navStep(root, axis, dir) {
    const el = document.activeElement, inside = el && root.contains(el) && el !== root;
    if (axis === 'x' && inside) {
        if (el.type === 'range') {
            const min = Number(el.min) || 0, max = Number(el.max) || 1;
            el.value = String(Math.min(max, Math.max(min, Number(el.value) + dir * (max - min) / 20)));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
        if (el.tagName === 'SELECT') {
            const index = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + dir));
            if (index !== el.selectedIndex) {
                el.selectedIndex = index;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
        }
    }
    moveFocus(root, dir);
}
const navState = { key: '', t: 0 };
function readNav(dt, step) {
    const v = input.vector('nav');
    let axis = '', dir = 0;
    if (Math.abs(v.y) > .5) {
        axis = 'y';
        dir = v.y > 0 ? -1 : 1;
    }
    else if (Math.abs(v.x) > .5) {
        axis = 'x';
        dir = v.x > 0 ? 1 : -1;
    }
    const key = axis + dir;
    if (!dir)
        navState.key = '';
    else if (key !== navState.key) {
        navState.key = key;
        navState.t = .38;
        step(axis, dir);
    }
    else {
        navState.t -= dt;
        if (navState.t <= 0) {
            navState.t = .11;
            step(axis, dir);
        }
    }
}
function menuNav(dt) {
    if (mode === 'loading')
        return;
    if (input.pressed('pause')) {
        // Esc that just released the mouse arrives here too: only a later press resumes.
        if (mode === 'paused' && performance.now() - pausedAt > 300)
            play();
        else if (mode === 'title' && input.source === 'gamepad')
            play();
        return;
    }
    if (input.pressed('back')) {
        if (mode === 'paused')
            play();
        return;
    }
    const root = menuRoot();
    readNav(dt, (axis, dir) => navStep(root, axis, dir));
    if (input.pressed('confirm')) {
        const el = document.activeElement;
        if (el && root.contains(el) && el !== root && (el.matches('button, summary') || el.type === 'checkbox'))
            el.click();
        else
            defaultButton()?.click();
    }
}
function guideNav(dt) {
    if (input.pressed('back') || input.pressed('pause')) {
        closeGuide();
        return;
    }
    // Arrow keys and the stick scroll the guide (the kit keeps arrows from scrolling the page).
    const v = input.vector('nav');
    if (Math.abs(v.y) > .2)
        $('guide-app').scrollTop -= v.y * 900 * dt;
    if (input.pressed('confirm') && input.source === 'gamepad') {
        const el = document.activeElement;
        if (el && $('guide-app').contains(el) && el.matches('button, a, summary'))
            el.click();
    }
}

// ---------------------------------------------------------------- start
syncForm();
renderControls();
const saved = peekSave(config);
const resume = saved && EPISODES[saved.active] && saved.episodes?.[saved.active]?.data?.completed !== true ? saved.active : 'fps';
await load(resume);
kit.start(dt => {
    if (mode === 'playing') {
        if (input.pressed('pause'))
            pauseGame();
    }
    else if (mode === 'guide')
        guideNav(dt);
    else
        menuNav(dt);
    // The 3D view keeps drawing behind the menus; the guide covers it, so it rests.
    if (mode !== 'guide')
        active?.frame(dt);
});
