/* Company Hours — the interface: setup, HUD, side panels, dialogs, dates, and the frame loop
   that ties kit.input (keyboard and mouse, gamepad, touch) to the town and the simulation. */

import {
    VERSION, REGIONS, VENUES, INTERESTS, MODELS, SKILLS, ACTIONS, UPGRADES, MILESTONES, DATE_TOPICS,
    clamp, money, clock, level, liabilities, available, person, newGame, advance, screen, negotiate, book,
    decline, cancel, beginDate, dateChoice, doAction, sleep, market, setModel, buyUpgrade, transfer, repay,
    renewPermit, relocate, recruit, disclosure, milestoneValue, safety, expectedPrice, fillLeads, pay,
    serialize, deserialize, storyFor, venueFit,
} from './sim.js';
import { Soundscape } from './audio.js';
import { createPadNav } from './padnav.js';

const ZERO = Object.freeze({ x: 0, y: 0 });

export const ICONS = {
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8',
    calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 10h18M7 14h3m4 0h3m-10 4h3',
    coffee: 'M3 7h13v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5ZM16 8h2a3 3 0 0 1 0 6h-2M6 3v1m5-1v1M2 23h17',
    leaf: 'M20 3C8 1 2 8 5 15s16 7 15-12ZM5 20l11-12',
    people: 'M15 21v-3a5 5 0 0 0-5-5H7a5 5 0 0 0-5 5v3M19 21v-3a5 5 0 0 0-3-4.6M12 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3-3a3 3 0 0 1 0 6',
    coin: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12',
    spark: 'm12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z',
    shield: 'm12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5l8-3Zm-4 9 3 3 5-5',
    book: 'M3 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H3V3Zm18 0h-6a3 3 0 0 0-3 3v15a4 4 0 0 1 4-2h5V3Z',
    art: 'M3 3h18v18H3V3Zm0 13 6-6 5 5 3-3 4 4M16 7h.01',
    music: 'M9 17V5l12-3v13M9 7l12-3M9 17c0 2-2 4-4 4s-3-1-3-2 2-3 4-3 3 0 3 1Zm12-2c0 2-2 4-4 4s-3-1-3-2 2-3 4-3 3 0 3 1Z',
    compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-4-3 5-5 3 3-5 5-3Z',
    chat: 'M21 11a9 9 0 0 1-9 9H5l-4 3 2-7a9 9 0 1 1 18-5ZM7 10h10m-10 4h6',
    dining: 'M5 2v7m3-7v7M2 2v7a3 3 0 0 0 6 0M5 12v10M19 22V2c-5 2-5 11 0 11',
    lock: 'M5 10h14v11H5V10Zm3 0V6a4 4 0 0 1 8 0v4m-4 5v2',
    sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4',
    moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z',
    check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6', arrow: 'M4 12h16m-6-6 6 6-6 6',
    chevron: 'm9 5 7 7-7 7', back: 'm15 5-7 7 7 7', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
    settings: 'm9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    pause: 'M8 5v14M16 5v14', play: 'm7 4 14 8-14 8V4Z', fast: 'm3 5 9 7-9 7V5Zm9 0 9 7-9 7V5Z',
    bag: 'M3 7h18v14H3V7Zm5 0V4h8v3M3 12h18m-11-2v4h2v-4',
    checkcircle: 'M21 11v1a9 9 0 1 1-5.3-8.2M8 11l3 3L22 3',
    award: 'm12 2 3 2 4 1 1 4-1 4-3 2-4 1-4-1-3-2-1-4 1-4 4-1 3-2ZM7 15l-2 7 7-4 7 4-2-7',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    rotate: 'M3 10a9 9 0 1 1 2 8M3 3v7h7', drop: 'M12 2S4 11 4 16a8 8 0 0 0 16 0c0-5-8-14-8-14Z',
    bolt: 'm13 2-9 12h7l-1 8 10-13h-8l1-7Z',
    camera: 'M3 7h4l2-3h6l2 3h4v14H3V7Zm13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4', upload: 'M12 17V5m-5 5 5-5 5 5M4 17v4h16v-4',
    sound: 'M11 4 6 8H2v8h4l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 8a3 3 0 0 1 6 0c0 3-3 2-3 5m0 4h.01',
    flag: 'M5 22V3c5-4 9 4 15 0v10c-6 4-10-4-15 0', star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1L12 2Z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    map: 'm2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3V5Zm6-3v17m8-14v17',
    cloud: 'M7 19a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5 5 0 0 1 0 11H7Z',
    flower: 'M12 9C3-1-1 10 9 12 0 17 10 26 12 15c2 11 13 2 3-3 11-2 5-13-3-3Zm2 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
    wave: 'M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M12 3v5m-2.5-2.5L12 3l2.5 2.5',
    pad: 'M7 6h10a5 5 0 0 1 5 5v4a3 3 0 0 1-5.4 1.8L15 15H9l-1.6 1.8A3 3 0 0 1 2 15v-4a5 5 0 0 1 5-5Zm-1 5h4M8 9v4m7-1h.01M18 10h.01',
    keys: 'M3 6h18v12H3V6Zm3 3h.01M10 9h.01M14 9h.01M18 9h.01M8 15h8'
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ICONS.spark}"/></svg>`;
const escapeHTML = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function portrait(p, bg = '#eee5d8') {
    const skin = /^#[a-f0-9]{6}$/i.test(p.skin) ? p.skin : '#bd8966', shirt = /^#[a-f0-9]{6}$/i.test(p.shirt) ? p.shirt : '#789780', hair = /^#[a-f0-9]{6}$/i.test(p.hair) ? p.hair : '#59473b';
    return `<svg class="portrait" viewBox="0 0 72 80" role="img" aria-label="Portrait of ${escapeHTML(p.name)}"><rect width="72" height="80" rx="24" fill="${bg}"/><path d="M6 80V67q4-17 30-17t30 17v13" fill="${shirt}"/><path d="M29 47h14v15q-7 6-14 0" fill="${skin}"/><ellipse cx="36" cy="33" rx="19" ry="23" fill="${skin}"/><path d="M17 33q-6-28 19-27 23-2 21 25l-6-12q-17 10-31 5l-3 9Z" fill="${hair}"/><circle cx="29" cy="34" r="1.4" fill="#34443a"/><circle cx="43" cy="34" r="1.4" fill="#34443a"/><path d="M32 43q4 3 8 0" fill="none" stroke="#a66b59" stroke-width="1.4" stroke-linecap="round"/><path d="m20 57 10 9 6-5 6 5 10-9" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="2"/></svg>`;
}
const esc = escapeHTML;
const UI_TABS = [['clients', 'people', 'Enquiries'], ['calendar', 'calendar', 'Diary'], ['business', 'bag', 'Business'], ['life', 'heart', 'My life'], ['regions', 'compass', 'Districts'], ['journal', 'book', 'Journal']];
const uiButton = (label, act, attrs = '', kind = '') => `<button class="btn ${kind}" data-act="${act}" ${attrs}>${label}</button>`;
const uiEmpty = (i, title, body) => `<div class="empty">${icon(i)}<h3>${title}</h3><p>${body}</p></div>`;
const uiTabs = (section, items, active) => `<div class="tabs" role="tablist" aria-label="${esc(section)} sections">${items.map(([id, label]) => `<button role="tab" aria-selected="${id === active}" class="${id === active ? 'active' : ''}" data-act="tab" data-section="${section}" data-tab="${id}">${label}</button>`).join('')}</div>`;
const uiMetric = (label, value) => `<div class="mini-stat"><span>${label}</span><strong>${value}</strong></div>`;
/** A client who loves the venue they asked for says so at the start of the date. */
const VENUE_FIT = {
    cafe: 'They clearly love Petal Café and already know what to order.',
    gallery: 'They light up the moment you step into the gallery.',
    bistro: 'They have wanted a table at Juniper for weeks.',
    park: 'The gardens put them at ease straight away.',
    pier: 'They take a long breath of sea air and smile.',
};
const GOALS = { independent: ['Sustainable independence', 'Build 65 reputation, complete 12 dates, and set aside $3,000. A steady business, on your own terms.'], exit: ['A new chapter', 'Save $8,000 and maintain at least 60 connection with Jules. Your work funds a life beyond it.'], studio: ['A small, thoughtful studio', 'Build a team of 3 peers and save $2,000. Growth does not have to mean losing the human part.'] };
export class Interface {
    constructor(root, state) {
        this.root = root;
        this.s = state;
        this.world = null;
        this.started = false;
        this.panel = null;
        this.tabs = { clients: 'enquiries', calendar: 'today', business: 'overview', life: 'wellbeing', journal: 'journal' };
        this.modal = null;
        this.manualPause = false;
        this.speed = 1;
        this.sound = new Soundscape();
        this.saved = false;
        this.saveUnavailable = false;
        this.autoSaveCounter = 0;
        this.lastHUD = 0;
        this.lastFocus = null;
        this.confirmFn = null;
        this.backedSave = null;
        this.formChoices = { skin: '#bd8966', shirt: '#739780' };
        this.lastNotice = '';
        this.documentHidden = false;
        this.kit = null;
        this.padnav = null;
        this.hud = new Map();
        this.hintSource = '';
        this.lastPauseHint = 0;
        this.controlsDevice = null;
        try {
            const raw = localStorage.getItem('good-company-save');
            if (raw) {
                this.backedSave = deserialize(raw);
                this.saved = true;
            }
        }
        catch (err) {
            if (err.name === 'SecurityError') {
                this.saveUnavailable = true;
                this.lastNotice = 'Browser storage is unavailable here. Export a backup from Settings.';
            }
            else
                try {
                    const raw = localStorage.getItem('good-company-backup');
                    if (raw) {
                        this.backedSave = deserialize(raw);
                        this.saved = true;
                        this.lastNotice = 'Your previous autosave was recovered from the backup.';
                    }
                    else
                        this.lastNotice = 'The existing save could not be read. Import a backup or start a new career.';
                }
                catch {
                    this.lastNotice = 'The existing save could not be read. Import a backup or start a new career.';
                }
        }
        this.mount();
        this.bind();
    }
    mount() {
        this.root.innerHTML = `<canvas id="world" aria-label="Isometric town. Click or tap to walk; WASD or the left stick to move, Q and E or the bumpers to rotate, wheel or pinch to zoom."></canvas><div id="world-vignette"></div><div id="world-labels">${Object.entries(VENUES).map(([id, v]) => `<button class="venue-label" data-world-venue="${id}" data-act="venue" data-id="${id}" title="${v.name}">${icon(v.icon)}${v.short}</button>`).join('')}</div><div id="hud" class="hud" hidden></div><div id="panel-root"></div><div id="overlay-root"></div><div id="setup-root"></div><div id="toast-root" role="status" aria-live="polite" aria-atomic="false"></div><div id="error-banner" role="alert"></div><input type="file" id="file-input" accept="application/json,.json" aria-label="Import a Company Hours save">`;
    }
    attach(world, kit) {
        this.world = world;
        this.kit = kit;
        this.padnav = createPadNav({ input: kit.input, onMove: () => this.sound.tick() });
        world.onArrival = d => this.arrive(d);
        world.onError = msg => {
            this.toast(msg, true);
            this.sound.cue(false);
        };
        kit.input.onSourceChange(() => this.renderHint());
        kit.onPause(paused => this.sound.hold(paused || this.documentHidden));
        this.renderSetup();
    }
    brand() {
        return `<div class="brand"><span class="brand-mark">${icon('flower')}</span><div><div class="brand-name">company hours</div><div class="brand-caption">a life of your own</div></div></div>`;
    }
    renderSetup() {
        this.started = false;
        document.getElementById('world-labels').inert = true;
        document.getElementById('hud').hidden = true;
        this.panel = null;
        this.modal = null;
        this.renderPanel();
        document.getElementById('overlay-root').innerHTML = '';
        document.getElementById('setup-root').innerHTML = `<section class="setup" role="dialog" aria-modal="true" aria-label="Create your career"><div class="setup-content">${this.brand()}<h1>Make a living.<br><em>Make a life.</em></h1><p class="intro">Good conversation. A little independence.<br>Build a companionship business, find your balance, and write your own next chapter.</p>${this.saved ? `<div class="setup-return"><div><strong>${esc(this.backedSave.player.name)}’s story</strong><small>Day ${this.backedSave.day} · ${REGIONS[this.backedSave.region].name}</small></div>${uiButton('Continue ' + icon('arrow'), 'continue', '', 'compact')}</div>` : ''}<form class="setup-form" data-form="start"><div class="row"><div class="field"><label for="new-name">Your name</label><input id="new-name" name="name" value="Rowan" maxlength="28" required autocomplete="off"></div><div class="field"><label for="new-age">Age · adults 21+</label><input id="new-age" name="age" type="number" min="21" max="80" value="28" required></div></div><div class="row"><div class="field"><label for="new-pronouns">Pronouns</label><select id="new-pronouns" name="pronouns"><option>they/them</option><option>she/her</option><option>he/him</option></select></div><div class="field"><label for="new-style">Personal style</label><select id="new-style" name="style"><option value="relaxed">Relaxed</option><option value="polished">Polished</option><option value="creative">Creative</option></select></div></div><div class="row"><div class="field"><label>Skin tone</label><div class="swatches" role="group" aria-label="Skin tone">${['#ebc3a3', '#d6a17c', '#bd8966', '#966749', '#68472f'].map((c, i) => `<button type="button" class="swatch ${c === this.formChoices.skin ? 'selected' : ''}" data-act="swatch" data-field="skin" data-color="${c}" style="background:${c}" aria-label="Skin tone ${i + 1}" aria-pressed="${c === this.formChoices.skin}"></button>`).join('')}</div></div><div class="field"><label>Signature colour</label><div class="swatches" role="group" aria-label="Clothing colour">${['#739780', '#d29780', '#9e94b5', '#c9ab6c', '#7297aa'].map((c, i) => `<button type="button" class="swatch ${c === this.formChoices.shirt ? 'selected' : ''}" data-act="swatch" data-field="shirt" data-color="${c}" style="background:${c}" aria-label="Clothing colour ${i + 1}" aria-pressed="${c === this.formChoices.shirt}"></button>`).join('')}</div></div></div><div class="field"><label for="new-region">Where will your story begin?</label><select id="new-region" name="region">${Object.entries(REGIONS).map(([id, r]) => `<option value="${id}">${r.name} · ${r.tagline}</option>`).join('')}</select></div><div class="row"><div class="field"><label for="new-difficulty">Your pace</label><select id="new-difficulty" name="difficulty"><option value="balanced">Balanced · $950</option><option value="relaxed">Unhurried · $1,400</option><option value="ambitious">Ambitious · $950</option></select></div><div class="field"><label for="new-goal">Your long-term goal</label><select id="new-goal" name="goal"><option value="independent">Sustainable independence</option><option value="exit">Fund a new chapter</option><option value="studio">Build a peer studio</option></select></div></div><div class="form-error" id="start-error"></div><button class="btn lime wide" type="submit">Start a new chapter ${icon('arrow')}</button></form><p class="setup-footer">A non-explicit adult life sim. All characters are 21+. All districts and regulations are fictional. Progress saves on this device; export a backup in Settings.</p></div><div class="setup-caption"><span class="caps">WELCOME TO</span><h2>Sunhaven</h2><p>Salt air. Slow mornings. Fresh starts.</p></div></section>`;
    }
    start(state) {
        document.getElementById('world-labels').inert = false;
        this.s = state;
        this.started = true;
        this.panel = null;
        this.modal = null;
        this.manualPause = false;
        document.getElementById('setup-root').innerHTML = '';
        document.getElementById('hud').hidden = false;
        this.world.setState(state, true);
        this.world.revealPlayer();
        this.applySettings();
        this.renderHUDShell();
        this.renderHUD();
        this.renderPanel();
        this.renderOverlay();
        this.save();
        this.padnav?.clear();
        this.kit?.input.settle();
        if (this.lastNotice) {
            this.toast(this.lastNotice);
            this.lastNotice = '';
        }
        else if (state.day === 1 && state.stats.dates === 0 && state.stats.screens === 0)
            this.toast(this.kit?.input.source === 'gamepad' ? 'Welcome. Walk with the left stick, use the D-pad for menus, and start with Enquiries.' : this.kit?.input.source === 'touch' ? 'Welcome. Tap the ground to walk, tap a building to visit, and start with Enquiries.' : 'Welcome. Click the ground to walk, click a building to visit, and start with Enquiries.');
        this.checkCelebration();
        if (state.settings.audio)
            this.sound.enable(true, state.settings.volume).catch(() => { });
    }
    renderHUDShell() {
        document.getElementById('hud').innerHTML = `<header class="topbar">${this.brand()}<div class="time-pill"><span class="day" id="hud-day"></span><strong id="hud-time"></strong><div class="speed-controls" aria-label="Simulation speed"><button data-act="pause" id="pause-btn" title="Pause or resume (Space)" aria-label="Pause or resume">${icon('pause')}</button><button data-act="speed" data-speed="1" aria-label="Normal speed" title="Normal speed" class="active">${icon('play')}</button><button data-act="speed" data-speed="3" aria-label="Fast speed" title="Fast speed">${icon('fast')}</button></div></div><div class="top-money"><button class="metric" data-act="nav" data-panel="business" style="background:none;padding:0;text-align:left" title="Open your business accounts">${icon('coin')}<span><small>AVAILABLE</small><strong id="hud-money"></strong></span></button><div class="metric">${icon('star')}<span><small>REPUTATION</small><strong id="hud-rep"></strong></span></div><div class="metric">${icon('people')}<span><small>FOLLOWERS</small><strong id="hud-followers"></strong></span></div><button class="icon-btn" data-act="nav" data-panel="settings" title="Settings and save backups (Esc for the menu)" aria-label="Settings">${icon('settings')}</button></div></header><button class="district-chip" data-act="nav" data-panel="regions" style="background:none;padding:0">${icon('compass')}<strong id="hud-region"></strong><span> / waterfront district</span></button><div class="weather-chip">${icon('sun')}<span id="hud-weather">A good day for a fresh start</span></div><section class="player-card" aria-label="Your character and wellbeing"><div class="player-info">${portrait(this.s.player)}<div><h3>${esc(this.s.player.name)}</h3><small id="hud-model"></small></div></div><div class="needs-grid">${[['energy', 'bolt', 'Energy'], ['stress', 'leaf', 'Calm'], ['hygiene', 'drop', 'Freshness'], ['fullness', 'dining', 'Fullness']].map(([id, i, label]) => `<div class="need-wrap"><div class="need">${icon(i)}<span>${label}</span><strong id="need-${id}-text"></strong></div><div class="progress" aria-label="${label}" role="meter" aria-valuemin="0" aria-valuemax="100" id="meter-${id}"><span id="need-${id}"></span></div></div>`).join('')}</div><div class="mood">${icon('leaf')}<span id="hud-mood"></span></div></section><aside class="agenda" id="agenda"></aside><nav class="navdock" aria-label="Main game navigation">${UI_TABS.map(([id, i, label]) => `<button data-act="nav" data-panel="${id}" id="nav-${id}" aria-label="${label}">${icon(i)}<span>${label}</span>${id === 'clients' ? '<span class="nav-count" id="inquiry-count"></span>' : ''}</button>`).join('')}</nav><div class="view-controls" aria-label="Camera controls"><button class="icon-btn optional" data-act="rotate" data-dir="-1" aria-label="Rotate camera left" title="Rotate (Q)">${icon('rotate')}</button><button class="icon-btn" data-act="zoom" data-dir="1" aria-label="Zoom in">${icon('plus')}</button><button class="icon-btn" data-act="zoom" data-dir="-1" aria-label="Zoom out">${icon('minus')}</button><button class="icon-btn optional" data-act="center" aria-label="Reset camera" title="Reset view (F)">${icon('target')}</button></div><div class="control-hint" id="control-hint"></div><button class="walking-toast" id="walking" data-act="walking-toast" hidden>${icon('compass')}<span></span></button><div class="pause-ribbon" id="paused-ribbon" hidden>Time paused · take your time</div>`;
        this.hud.clear();
        this.hintSource = '';
        this.renderHint();
    }
    renderHUD() {
        if (!this.started)
            return;
        // Write the DOM only where something changed: the HUD refreshes several times a second.
        const s = this.s, hud = this.hud;
        const set = (id, text) => {
            if (hud.get(id) === text)
                return;
            const el = document.getElementById(id);
            if (!el)
                return;
            hud.set(id, text);
            el.textContent = text;
        };
        const prop = (key, value, fn) => {
            if (hud.get(key) === value)
                return;
            hud.set(key, value);
            fn();
        };
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        set('hud-day', `${days[(s.day - 1) % 7].slice(0, 3)} · Day ${String(s.day).padStart(2, '0')}`);
        set('hud-time', clock(s.time));
        set('hud-money', money(available(s)));
        set('hud-rep', Math.round(s.rep) + ' / 100');
        set('hud-followers', s.followers.toLocaleString());
        set('hud-region', REGIONS[s.region].name);
        set('hud-model', MODELS[s.model].name);
        set('inquiry-count', String(s.leads.length));
        set('hud-mood', s.needs.energy < 25 ? 'Rest would feel good right now.' : s.needs.stress > 65 ? 'A little room to breathe, please.' : s.needs.fullness < 25 ? 'Time for something nourishing.' : 'Feeling grounded. Looking ahead.');
        set('hud-weather', s.time > 1080 ? 'A soft evening on the waterfront' : s.today.event === 'festival' ? 'Festival day · +15% booking income' : 'A little sunshine goes a long way');
        for (const key of ['energy', 'stress', 'hygiene', 'fullness']) {
            const val = Math.round(key === 'stress' ? 100 - s.needs[key] : s.needs[key]);
            set(`need-${key}-text`, val + '%');
            prop(`need-${key}`, val, () => {
                document.getElementById(`need-${key}`).style.width = val + '%';
                const meter = document.getElementById(`meter-${key}`);
                meter.setAttribute('aria-valuenow', val);
                meter.classList.toggle('warm', val < 30);
            });
        }
        prop('pause', this.manualPause, () => document.getElementById('pause-btn').classList.toggle('active', this.manualPause));
        prop('speed', `${this.manualPause}|${this.speed}`, () => {
            for (const el of document.querySelectorAll('[data-act="speed"]'))
                el.classList.toggle('active', !this.manualPause && Number(el.dataset.speed) === this.speed);
        });
        const playing = this.isPlaying();
        prop('ribbon', playing, () => {
            document.getElementById('paused-ribbon').hidden = playing;
        });
        // On the way somewhere, or standing at a door: say so, and how to go in.
        let walkText = '';
        if (this.world?.destination)
            walkText = 'On your way to ' + VENUES[this.world.destination.venue].short;
        else if (playing) {
            const near = this.world?.nearbyVenue();
            if (near)
                walkText = `${VENUES[near].short} · ${this.visitPrompt()} to go in`;
        }
        prop('walking', walkText, () => {
            const walking = document.getElementById('walking');
            walking.hidden = !walkText;
            walking.querySelector('span').textContent = walkText;
        });
        const booked = s.bookings.filter(b => b.status === 'booked' && b.day === s.day).map(b => b.venue);
        prop('booked', booked.join(','), () => {
            for (const el of document.querySelectorAll('[data-world-venue]'))
                el.classList.toggle('booking', booked.includes(el.dataset.worldVenue));
        });
        prop('panel', this.panel, () => {
            for (const [id] of UI_TABS)
                document.getElementById('nav-' + id)?.classList.toggle('active', this.panel === id);
        });
        this.renderAgenda();
        this.renderHint();
    }
    /** The control hint in the corner follows the device in use. */
    renderHint() {
        const el = document.getElementById('control-hint');
        const src = this.kit?.input.source || 'keyboard';
        if (!el || this.hintSource === src)
            return;
        this.hintSource = src;
        el.innerHTML = src === 'gamepad' ? 'Left stick to walk · <kbd>X</kbd> go in · <kbd>D-pad</kbd> menus<br><kbd>LB</kbd><kbd>RB</kbd> rotate · Right stick zoom · <kbd>Start</kbd> menu'
            : src === 'touch' ? 'Tap to walk or visit · Drag to pan<br>Pinch to zoom · Tap a label to visit'
                : 'Click to walk · <kbd>WASD</kbd> to move · <kbd>Enter</kbd> go in<br><kbd>Q</kbd><kbd>E</kbd> rotate · Drag to pan · <kbd>Esc</kbd> menu';
        if (this.hud.has('walking'))
            this.hud.delete('walking');
    }
    visitPrompt() {
        const src = this.kit?.input.source;
        return src === 'gamepad' ? 'X' : src === 'touch' ? 'tap here' : 'Enter';
    }
    renderAgenda() {
        const s = this.s, b = s.bookings.filter(b => b.status === 'booked' && b.day === s.day).sort((a, b) => a.time - b.time);
        const agenda = document.getElementById('agenda');
        agenda.hidden = !!this.panel;
        const markup = `<div class="agenda-card"><div class="caps">YOUR NEXT CHAPTER</div><h2>A little possibility.</h2><p>${s.leads.length} people would like to get to know you.<br>Find the right company for your day.</p>${uiButton('Explore enquiries ' + icon('arrow'), 'nav', 'data-panel="clients"', 'lime wide')}</div><div class="agenda-card mobile-next"><div class="agenda-title"><h3>Today, at your pace</h3><button class="text-btn" data-act="nav" data-panel="calendar">View diary</button></div>${b.length ? b.slice(0, 3).map(x => `<div class="agenda-line"><span class="time">${clock(x.time)}</span><div><strong>${esc(person(x.person).name.split(' ')[0])}</strong><small>${VENUES[x.venue].short} · ${x.duration} min</small></div><button class="icon-btn" style="margin-left:auto;width:28px;height:30px;min-height:30px" data-act="navigate-date" data-id="${x.id}" title="Walk to this date" aria-label="Walk to date with ${esc(person(x.person).name)}">${icon('arrow')}</button></div>`).join('') : `<div class="agenda-line no-booking"><span class="time">09–21</span><div><strong>A little breathing room</strong><small>Book a date, explore the town,<br>or make a moment for yourself.</small></div></div>`}</div><div class="agenda-card onboarding-card"><div class="agenda-title"><h3>${s.stats.dates ? 'Small steps, good things' : 'Settling into ' + REGIONS[s.region].name}</h3>${icon('leaf', 'small')}</div>${[[s.stats.screens > 0, 'Get to know a client', 'Screen an enquiry before booking.'], [s.bookings.length > 0, 'Put a date in the diary', 'Choose a rate and a time that work.'], [s.stats.dates > 0, 'Make a good connection', 'Walk to the venue and be yourself.']].map(([done, title, desc], i) => `<div class="goal-row ${done ? 'done' : ''}"><span class="step-dot">${done ? icon('check', 'small') : i + 1}</span><div>${title}<small>${desc}</small></div></div>`).join('')}<button class="text-btn" style="padding-left:0" data-act="help">How to play</button></div>`;
        // Keep keyboard focus and assistive-technology context when the agenda is unchanged.
        if (this.agendaNode !== agenda || this.agendaMarkup !== markup) {
            this.agendaNode = agenda;
            this.agendaMarkup = markup;
            agenda.innerHTML = markup;
        }
    }
    isPlaying() {
        return this.started && !this.panel && !this.modal && !this.s.activeDate && !this.s.report && !this.s.event && !this.manualPause && !this.documentHidden;
    }
    openPanel(id) {
        if (this.s.activeDate || this.s.report || this.s.event) {
            this.toast('Finish this moment before opening another menu.');
            return;
        }
        this.panel = this.panel === id ? null : id;
        this.modal = null;
        this.renderPanel();
        this.renderOverlay();
        this.renderHUD();
    }
    renderPanel() {
        const root = document.getElementById('panel-root');
        if (!this.panel || !this.started) {
            root.innerHTML = '';
            return;
        }
        const names = { clients: ['YOUR LITTLE BLACK BOOK', 'People & possibilities'], calendar: ['MAKE ROOM FOR WHAT MATTERS', 'Your diary'], business: ['A BUSINESS OF YOUR OWN', 'The business side'], life: ['THE PERSON BEHIND THE WORK', 'A little time for you'], regions: ['FIND YOUR KIND OF PLACE', 'A change of scenery'], journal: ['A STORY IN THE MAKING', 'Your journal'], settings: ['MAKE YOURSELF COMFORTABLE', 'Settings & saves'] };
        const name = names[this.panel];
        if (!name) {
            root.innerHTML = '';
            return;
        }
        let body = '';
        if (this.panel === 'clients')
            body = this.clientsPanel();
        if (this.panel === 'calendar')
            body = this.calendarPanel();
        if (this.panel === 'business')
            body = this.businessPanel();
        if (this.panel === 'life')
            body = this.lifePanel();
        if (this.panel === 'regions')
            body = this.regionsPanel();
        if (this.panel === 'journal')
            body = this.journalPanel();
        if (this.panel === 'settings')
            body = this.settingsPanel();
        root.innerHTML = `<section class="side-panel" aria-label="${name[1]}"><header class="panel-header"><div><div class="eyebrow">${name[0]}</div><h2>${name[1]}</h2></div><button class="icon-btn" data-act="close-panel" aria-label="Close menu">${icon('close')}</button></header><div class="panel-body">${body}</div></section>`;
    }
    clientsPanel() {
        const s = this.s, t = this.tabs.clients;
        return uiTabs('clients', [['enquiries', `Enquiries (${s.leads.length})`], ['regulars', 'Client book']], t) + (t === 'enquiries' ? `<p class="subtitle">Not every enquiry needs to become a booking. Choose your company, set your terms, and leave room to breathe.</p>${s.leads.length ? s.leads.map(c => this.leadCard(c)).join('') : uiEmpty('people', 'Room for someone new', 'Fresh enquiries arrive each morning. A campaign can bring more people to your profile today.')}` : `<p class="subtitle">Remember the small things. Notes stay on this device and can be included in your exported save.</p>${Object.keys(s.clients).length ? Object.entries(s.clients).map(([id, c]) => `<div class="card client-card"><div class="client-head">${portrait(person(id))}<div><h3>${esc(person(id).name)}</h3><p>${c.dates} completed date${c.dates === 1 ? '' : 's'} · ${money(c.earned)} total</p></div></div><div class="chip-list"><span class="badge ${c.blocked ? 'risk' : ''}">${c.blocked ? 'Blocked' : c.dates > 1 ? 'Regular' : 'Known client'}</span><span class="badge neutral">${INTERESTS[person(id).interest].name}</span></div><p class="client-bio" style="margin-top:13px">${esc(c.notes || 'No notes yet. A favourite topic is a good place to start.')}</p>${uiButton('Notes & boundaries', 'crm', `data-id="${id}"`, 'outline wide')}</div>`).join('') : uiEmpty('book', 'A book of good connections', 'Accepted clients appear here. Build trust through thoughtful, consistent meetings.')}`);
    }
    leadCard(c) {
        const p = person(c.person), s = this.s;
        return `<article class="card client-card"><div class="client-head">${portrait(p)}<div><span class="badge ${c.returning ? '' : 'neutral'}">${c.returning ? 'Returning client' : 'New enquiry'}</span><h3>${esc(p.name)}</h3><p>${p.age} · ${p.pronouns} · ${c.tone}</p></div></div><p class="client-bio">${p.bio}</p><div class="chip-list"><span class="pill">${icon(INTERESTS[p.interest].icon, 'small')}${INTERESTS[p.interest].name}</span><span class="pill">${icon(VENUES[c.venue].icon, 'small')}${VENUES[c.venue].short}</span>${venueFit(c) ? `<span class="pill fit" title="They especially enjoy this kind of place; the date starts a little warmer.">${icon('heart', 'small')}Loves this place</span>` : ''}</div><div class="offer-row"><div class="price">${money(c.offer)} <small>/ ${c.duration} min</small></div><span class="badge ${c.screened ? c.risk > 78 ? 'risk' : '' : 'neutral'}">${c.screened ? c.risk > 78 ? 'Concerns remain' : 'Screened' : 'Not screened'}</span></div><div class="signal">${icon('chat', 'small')} ${esc(c.signal)}</div>${MODELS[c.originModel || s.model].cut > 0 ? `<p class="tiny muted" style="margin-top:10px">Referred by ${MODELS[c.originModel || s.model].name} · ${Math.round(MODELS[c.originModel || s.model].cut * 100)}% support share follows this enquiry.</p>` : ''}${c.screened ? `<div class="screen-facts"><div>${icon(c.reference ? 'check' : 'help', 'small')}${c.reference ? 'Consistent reference supplied' : 'No established reference'}</div><div>${icon(c.depositAgreed ? 'check' : 'help', 'small')}${c.depositAgreed ? 'Agrees to a 25% reservation deposit' : 'No deposit agreed; no-show risk remains'}</div><div>${icon('shield', 'small')}Preparation score: ${Math.round(safety(s, c))} / 100 · not a guarantee</div></div>` : ''}<div class="row" style="margin-top:15px">${!c.screened ? uiButton(icon('shield') + ' Screen', 'screen', `data-id="${c.id}"`, 'outline') : uiButton('Negotiate', 'negotiate', `data-id="${c.id}" ${c.negotiated ? 'disabled' : ''}`, 'outline')}${uiButton('Make a plan ' + icon('arrow'), 'booking', `data-id="${c.id}"`)}</div><div class="flex between" style="margin-top:5px"><span class="tiny muted">${!c.screened ? `Screening ${money(s.model === 'collective' ? 5 : 10)} · ${s.upgrades.includes('studio') ? 10 : 20} min` : c.negotiated ? 'Final negotiated rate' : 'Screening reduces, not removes, risk'}</span><button class="text-btn" data-act="decline" data-id="${c.id}">Pass</button></div></article>`;
    }
    calendarPanel() {
        const s = this.s, day = this.tabs.calendar === 'tomorrow' ? s.day + 1 : this.tabs.calendar === 'later' ? s.day + 2 : s.day;
        const bookings = s.bookings.filter(b => b.day === day).sort((a, b) => a.time - b.time);
        return uiTabs('calendar', [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['later', 'In two days']], this.tabs.calendar) + `<div class="flex between"><h3>Day ${day}</h3><span class="badge neutral">Public dates · 09:00–21:00</span></div><p class="subtitle">Keep 25 minutes free on either side of a date. Walk to the venue, then start within 20 minutes before or 40 minutes after the booking.</p>${bookings.length ? bookings.map(b => `<div class="card booking-item"><div class="flex between"><span class="caps">${clock(b.time)} – ${clock(b.time + b.duration)}</span><span class="badge ${b.status === 'booked' ? '' : b.status === 'completed' ? '' : 'neutral'}">${esc(b.status.replaceAll('-', ' '))}</span></div><h3>${esc(person(b.person).name)}</h3><div class="venue">${icon(VENUES[b.venue].icon, 'small')} ${VENUES[b.venue].name} · ${money(b.offer)}</div><div class="tiny muted">${b.screened ? 'Screened' : 'Not screened'} · ${money(b.deposit)} deposit ${b.status === 'booked' ? 'reserved' : 'settled'}</div>${b.status === 'booked' ? `<div class="row" style="margin-top:13px">${uiButton(icon('compass') + ' Walk there', 'navigate-date', `data-id="${b.id}" ${day !== s.day ? 'disabled' : ''}`)}${uiButton('Cancel', 'cancel-booking', `data-id="${b.id}"`, 'outline')}</div>` : ''}</div>`).join('') : uiEmpty('calendar', 'An open page', `No bookings on day ${day}. This space can be whatever you need it to be.`)}${uiButton(icon('plus') + ' Find a date', 'nav', 'data-panel="clients"', 'outline wide')}<div class="callout" style="margin-top:18px">Time pauses while menus are open. Close the diary to walk around, or select a destination to get moving.</div>`;
    }
    businessPanel() {
        const s = this.s, t = this.tabs.business;
        let out = uiTabs('business', [['overview', 'Overview'], ['marketing', 'Marketing'], ['support', 'Support'], ['accounts', 'Accounts']], t);
        if (t === 'overview')
            return out + `<div class="stat-grid">${uiMetric('Available to spend', money(available(s)))}${uiMetric('Reserved deposits', money(liabilities(s)))}${uiMetric('Career reputation', Math.round(s.rep) + ' / 100')}${uiMetric('Dates completed', s.stats.dates)}</div><div class="subhead"><h3>Your rate, your terms</h3>${icon('coin', 'small')}</div><form data-form="rate"><label for="base-rate">Default booking rate</label><div class="row"><input id="base-rate" name="rate" type="number" min="60" max="1500" step="5" value="${s.rate}" required><button class="btn" type="submit">Set rate</button></div><p class="subtitle" style="margin-bottom:12px">Current local reference: about ${money(expectedPrice(s))}. Individual budgets differ. Already-accepted bookings retain their agreed price.</p></form><div class="callout">${s.rep < 65 ? 'A thoughtful date builds reputation; reputation raises future client budgets. Charging more only works when someone agrees to pay it.' : 'Your reputation now supports a premium position. Protect your time rather than filling every available hour.'}</div><div class="subhead"><h3>Your district’s paperwork</h3>${icon('book', 'small')}</div><p class="subtitle" style="margin-bottom:12px">${REGIONS[s.region].rule}</p>${REGIONS[s.region].permit ? `<div class="flex between"><span class="badge ${s.permitUntil < s.day ? 'risk' : ''}">${s.permitUntil < s.day ? 'Permit overdue' : 'Valid through day ' + s.permitUntil}</span>${uiButton('Renew · ' + money(REGIONS[s.region].permit), 'permit', '', 'outline')}</div>` : '<span class="badge">No permit required</span>'}<div class="subhead"><h3>Your peer studio</h3>${icon('people', 'small')}</div><p class="subtitle">At 65 reputation and 12 completed dates, offer management to adult peers. They choose to join, retain their own booking income, and pay a coordination fee. Studio overhead: $25 per peer per day.</p><div class="card"><div class="flex between"><strong>${s.team.length} / 3 peers</strong><span class="badge neutral">${Math.round(s.rep)}/65 rep · ${s.stats.dates}/12 dates</span></div>${s.team.map(m => `<div class="ledger-row"><span>${esc(m.name)}, ${m.age}</span><small style="margin-left:auto">${m.dates} studio days</small></div>`).join('')}<div class="spacer"></div>${uiButton('Invite a peer · $650', 'recruit', `${s.rep < 65 || s.stats.dates < 12 || s.team.length >= 3 ? 'disabled' : ''}`, 'outline wide')}</div>`;
        if (t === 'marketing')
            return out + `<div class="row">${uiMetric('Profile audience', s.followers.toLocaleString())}${uiMetric('Public exposure', Math.round(s.exposure) + ' / 100')}</div><p class="subtitle" style="margin-top:17px">Build a reputation that feels like you. One campaign per day; new enquiries scale with reach. More public promotion also increases exposure.</p>${[['quiet', 'Word of mouth', 'A considered recommendation from the right person. Low exposure.', '$35', 45, 'people'], ['social', 'A little social presence', 'Reach a larger audience, with more visibility.', '$80', 115, 'camera'], ['premium', 'The curated directory', 'A polished listing for people who know what they want.', '$150', 205, 'spark']].map(([id, name, desc, cost, reach, i]) => `<div class="card plan-card"><div class="flex between"><h3>${name}</h3>${icon(i)}</div><p>${desc} Base reach: +${reach}, improved by branding skill.</p>${uiButton((s.today.campaign ? 'Campaign running' : `Start campaign · ${s.upgrades.includes('studio') ? money(Number(cost.slice(1)) * .8) : cost}`), 'market', `data-id="${id}" ${s.today.campaign ? 'disabled' : ''}`, 'outline wide')}</div>`).join('')}<div class="field"><label for="privacy-mode">How public is your professional profile?</label><select id="privacy-mode" data-setting="privacy"><option value="private" ${s.privacy === 'private' ? 'selected' : ''}>Private · less reach, less exposure</option><option value="balanced" ${s.privacy === 'balanced' ? 'selected' : ''}>Balanced · professional and selective</option><option value="public" ${s.privacy === 'public' ? 'selected' : ''}>Public · greater exposure after dates</option></select></div><div class="callout">Your appearance and identity never determine safety or client reliability. Screening looks at behaviour and the booking details.</div>`;
        if (t === 'support')
            return out + `<p class="subtitle">Choose the trade-offs that work for you. Operating agreements cannot change while bookings are outstanding, so clients’ contracts stay consistent. A referred enquiry keeps its original support share if you later switch models.</p>${Object.entries(MODELS).map(([id, m]) => `<div class="card plan-card ${id === s.model ? 'current' : ''}"><div class="flex between"><h3>${m.name}</h3><span class="cut">${Math.round(m.cut * 100)}% <small class="tiny muted">share</small></span></div><p>${m.desc}</p><div class="flex between"><span class="badge neutral">+${m.safety} preparation · +${m.leads} leads</span>${uiButton(id === s.model ? 'Your model' : 'Choose', 'model', `data-id="${id}" ${id === s.model ? 'disabled' : ''}`, 'compact outline')}</div></div>`).join('')}<div class="subhead"><h3>A little practical support</h3></div><div class="toggle-row"><label for="security-toggle">Safety coordinator<small>$35 on hiring, then daily. +22 preparation.<br>Check-ins and practical support, not a guarantee.</small></label><input type="checkbox" id="security-toggle" data-support="security" ${s.security ? 'checked' : ''}></div><div class="toggle-row"><label for="manager-toggle">Booking manager<small>$30 on hiring, then daily. +1 enquiry capacity and negotiation support.</small></label><input type="checkbox" id="manager-toggle" data-support="manager" ${s.manager ? 'checked' : ''}></div><p class="subtitle" style="margin-top:15px">These are adult colleagues in a voluntary professional relationship. You can stop either service whenever you choose.</p>`;
        return out + `<div class="stat-grid">${uiMetric('Cash on hand', money(s.wallet))}${uiMetric('Deposits reserved', money(liabilities(s)))}${uiMetric('Savings', money(s.savings))}${uiMetric('Outstanding bills', money(s.debt))}</div><div class="subhead"><h3>Put a little freedom aside</h3></div><form data-form="savings"><label for="saving-amount">Transfer amount</label><div class="row"><input id="saving-amount" name="amount" type="number" min="1" max="1000000" value="100" required><select name="direction" aria-label="Transfer direction"><option value="save">Into savings</option><option value="withdraw">Back to cash</option></select></div><button class="btn outline wide" style="margin-top:10px">Transfer funds</button></form>${s.debt ? `<div class="callout warm" style="margin-top:15px">Outstanding bills are interest-free. Your savings and refundable deposits are never seized. ${uiButton('Repay up to $100', 'repay', '', 'compact outline')}</div>` : ''}<div class="subhead"><h3>Keep an eye on the overheads</h3></div><div class="card"><div class="flex between tiny"><span>Weekly rent · due day ${s.day + (7 - (s.day - 1) % 7)}</span><b>${money(REGIONS[s.region].rent)}</b></div><div class="flex between tiny divider"><span>Daily staff costs</span><b>${money((s.security ? 35 : 0) + (s.manager ? 30 : 0) + s.team.length * 25)}</b></div><div class="flex between tiny divider"><span>Lifetime income / expenses</span><b>${money(s.stats.earned)} / ${money(s.stats.spent)}</b></div></div><div class="subhead"><h3>The paper trail</h3><span class="tiny muted">Latest 30 entries</span></div>${s.ledger.length ? s.ledger.slice(0, 30).map(l => `<div class="ledger-row"><span class="ledger-label">${esc(l.label)}<small>Day ${l.day} · ${clock(l.time)}</small></span><strong class="${l.amount > 0 ? 'positive' : ''}">${l.amount > 0 ? '+' : '−'}${money(Math.abs(l.amount))}</strong></div>`).join('') : uiEmpty('coin', 'A clean ledger', 'Your first transaction will appear here.')}`;
    }
    actionCard(id) {
        const a = ACTIONS[id], s = this.s;
        return `<div class="upgrade"><span class="emblem">${icon(a.icon)}</span><div style="flex:1"><h3>${a.label}</h3><p>${a.desc}</p><div class="flex between"><span class="tiny muted">${a.cost ? money(a.cost) : a.income ? 'Earn ' + money(a.income) : 'Free'} · ${a.time} min${a.after ? ' · from ' + clock(a.after) : ''}</span>${uiButton('Go ' + icon('arrow', 'small'), 'activity', `data-id="${id}" ${id === 'gig' && s.today.gig || id === 'photos' && s.day - s.lastPhotos < 7 || a.after && s.time < a.after ? 'disabled' : ''}`, 'compact outline')}</div></div></div>`;
    }
    lifePanel() {
        const s = this.s, t = this.tabs.life;
        let out = uiTabs('life', [['wellbeing', 'Wellbeing'], ['skills', 'Skills'], ['home', 'Home'], ['goals', 'Goals']], t);
        if (t === 'wellbeing')
            return out + `<p class="subtitle">You are a person, not a booking slot. Work goes better when the rest of your life has room in it.</p><div class="row">${uiMetric('Health', Math.round(s.needs.health) + '%')}${uiMetric('Social connection', Math.round(s.needs.social) + '%')}</div><p class="tiny muted" style="margin-top:12px">Preventative wellbeing check-in: ${s.careUntil < s.day ? 'due' : 'current through day ' + s.careUntil}. Low health increases fatigue and makes dates harder.</p><div class="subhead"><h3>People who know you</h3>${icon('people', 'small')}</div><div class="card"><div class="client-head">${portrait({ name: 'Jules', skin: '#d5a67f', shirt: '#c6a376', hair: '#574239' })}<div><h3>Jules</h3><p>Your friend · ${Math.round(s.relationship.bond)} / 100 connection</p></div></div><p class="tiny muted" style="margin-bottom:12px">“You do not have to be on all the time. There is always a seat for you.”</p><div class="progress"><span style="width:${s.relationship.bond}%"></span></div><div class="spacer"></div>${uiButton('Make time for a coffee', 'activity', 'data-id="friend"', 'outline wide')}<div style="height:8px"></div>${uiButton(s.time < ACTIONS.sail.after ? 'An evening sail · from ' + clock(ACTIONS.sail.after) : 'An evening sail on the harbour', 'activity', `data-id="sail" ${s.time < ACTIONS.sail.after ? 'disabled' : ''}`, 'outline wide')}<div class="field" style="margin-top:15px;margin-bottom:0"><label for="disclosure-mode">What do you share about work?</label><select id="disclosure-mode" data-setting="disclosure"><option value="open" ${s.relationship.disclosure === 'open' ? 'selected' : ''}>An open, supportive conversation</option><option value="private" ${s.relationship.disclosure === 'private' ? 'selected' : ''}>Keep my work life private</option></select><small>Privacy is a valid choice. Maintaining a separate story takes more emotional energy over time.</small></div></div><div class="subhead"><h3>Little acts of care</h3></div>${['meal', 'nap', 'shower', 'walk', 'tide', 'tea', 'care', 'peer'].map(id => this.actionCard(id)).join('')}<div class="subhead"><h3>A reliable alternative</h3></div>${this.actionCard('gig')}`;
        if (t === 'skills')
            return out + `<p class="subtitle">Competence grows through practice, not appearance. Workshops and real conversations build skills across your career.</p>${Object.entries(SKILLS).map(([id, label]) => `<div class="skill-line"><div class="flex between"><strong>${label}</strong><span class="badge neutral">Level ${level(s, id)} / 10</span></div><div class="progress"><span style="width:${level(s, id) >= 10 ? 100 : s.skills[id] % 65 / 65 * 100}%"></span></div><small>${level(s, id) >= 10 ? 'Mastered' : 65 - s.skills[id] % 65 + ' experience to next level'}</small></div>${this.actionCard('train_' + id)}`).join('')}`;
        if (t === 'home')
            return out + `<div class="goal-hero">${icon('home', 'large')}<h3>A place to come back to.</h3><p>A few considered improvements can change the shape of your days.</p></div>${Object.entries(UPGRADES).map(([id, u]) => `<div class="upgrade"><span class="emblem">${icon(u.icon)}</span><div style="flex:1"><h3>${u.name}</h3><p>${u.desc}</p>${uiButton(s.upgrades.includes(id) ? 'Feels like home' : `Make it yours · ${money(u.cost)}`, 'upgrade', `data-id="${id}" ${s.upgrades.includes(id) ? 'disabled' : ''}`, 'outline compact')}</div></div>`).join('')}<div class="spacer"></div>${uiButton(icon('moon') + ' Head home & end the day', 'sleep-travel', '', 'wide')}`;
        return out + `<div class="goal-hero">${icon(s.finished ? 'award' : 'flag', 'large')}<div class="caps" style="margin-top:12px">${s.finished ? 'YOUR GOAL IS COMPLETE' : 'YOUR LONG-TERM GOAL'}</div><h3>${GOALS[s.goal][0]}</h3><p>${GOALS[s.goal][1]}</p><div class="chapter-line">${s.finished ? 'You did it. This chapter belongs to you. Continue playing, or export your save and begin again.' : `${money(s.savings)} saved · ${s.stats.dates} dates · ${Math.round(s.rep)} reputation · ${s.team.length} peers · ${Math.round(s.relationship.bond)} connection`}</div></div><div class="subhead"><h3>Small milestones, real progress</h3></div>${MILESTONES.map(m => {
            const done = s.achievements.includes(m.id), val = milestoneValue(s, m);
            return `<div class="quest ${done ? 'complete' : ''}"><div class="flex between"><h3>${m.name}</h3>${icon(done ? 'checkcircle' : 'award', 'small')}</div><p>${m.text}</p><div class="progress"><span style="width:${Math.min(100, val / m.goal * 100)}%"></span></div><div class="flex between tiny muted" style="margin-top:8px"><span>${done ? 'Achieved' : Math.floor(val) + ' / ' + m.goal}</span><span>${money(m.reward)} bonus</span></div></div>`;
        }).join('')}`;
    }
    regionsPanel() {
        const s = this.s;
        return `<p class="subtitle">Choose a neighbourhood that fits your ambitions. Moving resets enquiries and reduces your audience by 20%; existing client notes and skills travel with you.</p>${Object.entries(REGIONS).map(([id, r]) => `<article class="card region-card"><div class="region-banner" style="background:${r.color}88">${icon(id === 'sunhaven' ? 'sun' : id === 'bellmere' ? 'art' : 'leaf')}</div><div class="region-content"><div class="flex between"><h3>${r.name}</h3>${id === s.region ? '<span class="badge">You are here</span>' : ''}</div><p>${r.description}</p><div class="region-metrics"><span><b>${r.rate.toFixed(2)}×</b>Client budgets</span><span><b>${money(r.rent)}</b>Weekly rent</span><span><b>${money(r.permit)}</b>Weekly permit</span></div><p class="tiny" style="margin-bottom:15px">${r.rule}</p>${uiButton(id === s.region ? 'Your current neighbourhood' : `Move here · ${money(r.move + r.permit)}`, 'relocate', `data-id="${id}" ${id === s.region ? 'disabled' : ''}`, 'outline wide')}</div></article>`).join('')}<div class="callout">District rules are fictional game systems, not descriptions of real jurisdictions or legal guidance. The town layout is shared; local economics and building colours change.</div>`;
    }
    journalPanel() {
        const s = this.s;
        return uiTabs('journal', [['journal', 'Your story'], ['guide', 'Field notes']], this.tabs.journal) + (this.tabs.journal === 'journal' ? `${s.journal.map(l => `<article class="journal-entry"><small>DAY ${l.day} · ${clock(l.time)}</small><h3>${esc(l.title)}</h3><p>${esc(l.text)}</p></article>`).join('')}` : this.guideContent());
    }
    guideContent() {
        return `<div class="goal-hero">${icon('book', 'large')}<h3>A life of your own.</h3><p>The aim is not to accept every enquiry. Find the pace, people, and business model that let you build the life you chose.</p></div>${[
            ['01', 'Find the right company', 'Open Enquiries. Read a profile, screen their booking details, and negotiate a rate. Screening costs money and time; declining never harms your reputation.'],
            ['02', 'Make a little room', 'Book a time today or up to two days ahead. A 25-minute buffer prevents overlapping dates. Client deposits are reserved until completion, cancellation, or an agreed no-show.'],
            ['03', 'Go out into the world', 'Click or tap the ground, or use WASD or the left stick, to move. Buildings and venue labels open location cards; standing at a door, Enter or X goes in. Drag to pan, wheel or pinch to zoom, Q/E or the bumpers to rotate, and F to reset the view. Choose Walk there from the diary for an automatic route.'],
            ['04', 'Be present', 'At the venue, begin within the arrival window. Three conversation choices shape the connection. Read the client’s interests, listen, and keep your boundaries. You can end a date safely without a reputation penalty.'],
            ['05', 'Remember the person', 'Eat, refresh, rest, learn, and make time for Jules. The park and peer meet-ups are free. A community café shift earns $85 once each day, providing another route through a difficult week.'],
            ['06', 'Look after the business', 'Set a default rate, market once per day, select a voluntary support arrangement, and track deposits separately from money you can spend. Weekly rent is due starting on day 8.'],
            ['07', 'Let a day end', 'Go home and choose End the day. Finish or cancel today’s bookings first. New enquiries, operating costs, and a town event arrive the next morning. At 22:00 the clock stops until you go home.'],
            ['08', 'Keep your story', 'Autosave runs after decisions and periodically during play. Export a JSON backup in Settings. Local storage belongs to the browser; clearing site data removes it. There is no cloud account or tracking.'],
            ['09', 'Down by the water', 'Lantern Pier reaches out from the boardwalk: tea at the Tidewater kiosk, the tide coming in, and an evening sail with Jules from 17:00. Clients who love travel or the outdoors may ask to meet there. Every venue suits some interests, and a client who loves the place starts a little warmer.'],
            ['10', 'Familiar faces', 'Returning clients bring a story from their own lives. Remembering what they told you last time is the warmest answer, and notes in your client book make it warmer still.']
        ].map(([n, t, b]) => `<article class="journal-entry"><small>FIELD NOTE ${n}</small><h3>${t}</h3><p>${b}</p></article>`).join('')}<div class="callout">Content boundary: adult companionship, dates, and professional management. No explicit sexual acts, coerced intimacy, or real-world law-enforcement evasion. Safety scores are game abstractions, not advice.</div>`;
    }
    settingsPanel() {
        const s = this.s, m = this.world.getMetrics();
        return `<div class="subhead"><h3>Make it feel right</h3></div><div class="field"><label>Graphics and controls</label>${uiButton(icon('settings') + ' Graphics & controls', 'graphics', '', 'outline wide')}<small>Quality, resolution, frame rate, vibration and the touch layout are shared by every game on this device (F9).</small></div><div class="field"><label for="text-setting">Text size</label><select id="text-setting" data-setting="textScale"><option value="1" ${s.settings.textScale === 1 ? 'selected' : ''}>Standard</option><option value="1.15" ${s.settings.textScale === 1.15 ? 'selected' : ''}>Larger · 115%</option><option value="1.3" ${s.settings.textScale === 1.3 ? 'selected' : ''}>Largest · 130%</option></select></div>${[['reduceMotion', 'Reduce motion', 'Remove decorative movement and interface transitions.'], ['highContrast', 'Stronger contrast', 'Darker secondary text and clearer borders.'], ['showLabels', 'Venue labels', 'Keep destinations visible around town.'], ['audio', 'A little sound', 'Original, quiet musical tones and interface feedback.']].map(([key, label, desc]) => `<div class="toggle-row"><label for="setting-${key}">${label}<small>${desc}</small></label><input type="checkbox" id="setting-${key}" data-setting="${key}" ${s.settings[key] ? 'checked' : ''}></div>`).join('')}<div class="field" style="margin-top:17px"><label for="volume-setting">Audio volume</label><input id="volume-setting" type="range" min="0" max="1" step=".05" data-setting="volume" value="${s.settings.volume}"></div><div class="subhead"><h3>Your story, safely kept</h3><span class="badge ${this.saveUnavailable ? 'risk' : ''}">${this.saveUnavailable ? 'Export recommended' : 'Local autosave'}</span></div><p class="subtitle">Saves contain your client notes, finances, and personal story. Nothing is uploaded. Keep an exported backup before clearing browser data.</p><div class="row">${uiButton(icon('download') + ' Export save', 'export', '', 'outline')}${uiButton(icon('upload') + ' Import save', 'import', '', 'outline')}</div><div class="row" style="margin-top:10px">${uiButton('Save now', 'save', '', 'secondary')}${uiButton('Restore backup', 'restore', '', 'outline')}</div><div class="subhead"><h3>Controls</h3>${icon(this.kit?.input.source === 'gamepad' ? 'pad' : 'keys', 'small')}</div>${this.controlsTable()}<div class="subhead"><h3>Under the hood</h3></div><div class="card"><div class="tiny muted" style="line-height:1.9">Build ${VERSION}<br>${esc(m.renderer)}<br>${m.drawCalls ?? '—'} draw calls · ${(m.triangles ?? 0).toLocaleString()} triangles<br>Pixel ratio ${m.pixelRatio.toFixed(2)} · ${m.fps} fps<br>No cloud account, advertising, or analytics.</div></div><p class="subtitle" style="margin-top:14px">Original procedural artwork and synthesized audio. Drawn with three.js r186 (MIT) on WebGPU, or WebGL2 where WebGPU is unavailable.</p><div class="row">${uiButton(icon('help') + ' How to play', 'help', '', 'outline')}${uiButton('Title screen', 'title', '', 'outline')}</div><div class="row" style="margin-top:10px">${uiButton('New career', 'new-career', '', 'danger')}</div>`;
    }
    openModal(type, data = {}) {
        this.lastFocus = document.activeElement;
        this.modal = { type, ...data };
        this.renderOverlay();
        this.renderHUD();
    }
    closeModal() {
        this.modal = null;
        this.renderOverlay();
        this.renderHUD();
        if (this.lastFocus?.isConnected)
            this.lastFocus.focus();
    }
    focusModal() {
        requestAnimationFrame(() => {
            const dialog = document.querySelector('#overlay-root [role="dialog"]');
            if (!dialog)
                return;
            if (this.kit?.input.source === 'gamepad') {
                this.padnav.focusDefault(dialog, '.choice, .btn:not(.outline):not(.secondary):not(.danger)');
                return;
            }
            const first = dialog.querySelector('input:not([type=hidden]),select,button:not(.modal-close)');
            (first || dialog).focus({ preventScroll: true });
        });
    }
    renderOverlay() {
        const root = document.getElementById('overlay-root');
        if (!this.started) {
            root.innerHTML = '';
            return;
        }
        if (this.s.activeDate) {
            root.innerHTML = this.dateOverlay();
            this.focusModal();
            return;
        }
        if (this.s.report) {
            root.innerHTML = this.reportOverlay();
            this.focusModal();
            return;
        }
        if (this.s.event) {
            const e = this.s.event;
            root.innerHTML = this.modalWrap(`<div class="report-emblem">${icon(e.icon, 'large')}</div><span class="caps muted">DAY ${this.s.day} · AROUND TOWN</span><h2>${e.title}</h2><p>${e.text}</p>${this.recapHTML(e.recap)}${uiButton('Begin a fresh day ' + icon('arrow'), 'event-dismiss', '', 'wide')}`, 'A new morning', false);
            this.focusModal();
            return;
        }
        if (!this.modal) {
            root.innerHTML = '';
            return;
        }
        const m = this.modal, s = this.s;
        let body = '', title = '';
        if (m.type === 'venue') {
            const v = VENUES[m.id], near = this.near(m.id);
            title = v.name;
            const bookings = s.bookings.filter(b => b.venue === m.id && b.status === 'booked' && b.day === s.day).sort((a, b) => a.time - b.time);
            body = `<span class="emblem">${icon(v.icon, 'large')}</span><h2>${v.name}</h2><p>${v.subtitle}</p>${!near ? uiButton(icon('compass') + ' Walk here', 'go', `data-id="${m.id}"`, 'wide') : '<span class="badge">You are here</span>'}${bookings.map(b => `<div class="card" style="margin-top:17px"><div class="client-head">${portrait(person(b.person))}<div><h3>${esc(person(b.person).name)}</h3><p style="margin:5px 0">${clock(b.time)} · ${money(b.offer)}</p></div></div>${near ? (s.time < b.time - 20 ? uiButton('Wait until ' + clock(b.time), 'wait-date', `data-id="${b.id}"`, 'wide') : uiButton('Begin your date ' + icon('heart'), 'begin-date', `data-id="${b.id}"`, 'wide')) : uiButton('Walk to your date', 'navigate-date', `data-id="${b.id}"`, 'outline wide')}</div>`).join('')}<div class="subhead"><h3>A little time here</h3></div>${Object.entries(ACTIONS).filter(([, a]) => a.venue === m.id).map(([id]) => this.actionCard(id)).join('')}${m.id === 'home' ? `<div class="spacer"></div>${uiButton(icon('moon') + ' End the day', 'sleep-travel', '', 'wide')}` : ''}${v.kind === 'date' && !bookings.length ? `<div class="spacer"></div>${uiButton('Find someone to meet here', 'open-enquiries', '', 'outline wide')}` : ''}`;
        }
        if (m.type === 'booking') {
            const c = s.leads.find(l => l.id === m.id);
            if (!c) {
                this.modal = null;
                return this.renderOverlay();
            }
            title = 'Make a plan';
            const firstSlot = Math.ceil((s.time + 40) / 30) * 30, todayOK = firstSlot + c.duration <= 1260;
            const defaultDay = todayOK ? s.day : s.day + 1;
            body = `<div class="client-head">${portrait(person(c.person))}<div><span class="caps muted">MAKE A LITTLE ROOM</span><h2 style="font-size:1.5rem">${esc(person(c.person).name)}</h2></div></div><p>${VENUES[c.venue].name} · ${c.duration} minutes · ${money(c.offer)} agreed booking rate.</p>${!c.screened ? '<div class="callout warm">This enquiry is not screened. You may still book, but preparation is your choice—not a guarantee of safety.</div><div class="spacer"></div>' : ''}<form data-form="book" data-id="${c.id}"><div class="row"><div class="field"><label for="booking-day">Which day?</label><select name="day" id="booking-day" data-booking-day="${c.id}">${[0, 1, 2].map(d => `<option value="${s.day + d}" ${s.day + d === defaultDay ? 'selected' : ''}>${['Today', 'Tomorrow', 'In two days'][d]} · Day ${s.day + d}</option>`).join('')}</select></div><div class="field"><label for="booking-time">What time?</label><select name="time" id="booking-time">${this.slotOptions(c, defaultDay, todayOK ? firstSlot : 600)}</select></div></div><div class="card" style="margin-bottom:16px"><div class="flex between tiny"><span>Reservation deposit</span><strong>${money(c.depositAgreed ? Math.round(c.offer * .25) : 0)}</strong></div><div class="flex between tiny divider"><span>Venue expense on arrival</span><strong>${money(VENUES[c.venue].cost)}</strong></div><div class="flex between tiny divider"><span>Support share on completion</span><strong>${Math.round(Math.max(MODELS[s.model].cut, MODELS[c.originModel || s.model].cut) * 100)}% of base rate</strong></div><p class="tiny muted" style="margin-bottom:0">Deposits are held until the date concludes. You can cancel and refund without a reputation penalty.</p></div><div class="form-error" id="modal-error" role="alert"></div><button class="btn wide" type="submit">Put it in the diary ${icon('calendar')}</button></form><div class="row" style="margin-top:9px">${uiButton(c.negotiated ? 'Rate finalized' : 'Discuss the rate', 'negotiate', `data-id="${c.id}" ${c.negotiated ? 'disabled' : ''}`, 'outline')}${!c.screened ? uiButton('Screen first', 'screen', `data-id="${c.id}"`, 'outline') : ''}</div>`;
        }
        if (m.type === 'negotiate') {
            const c = s.leads.find(l => l.id === m.id);
            if (!c) {
                this.modal = null;
                return this.renderOverlay();
            }
            title = 'Discuss the rate';
            body = `<div class="client-head">${portrait(person(c.person))}<div><span class="caps muted">CLEAR EXPECTATIONS</span><h2 style="font-size:1.5rem">A fair arrangement.</h2></div></div><p>Make one considered proposal. The client may agree or make a final counteroffer. Passing is always an option.</p><div class="callout">${c.screened ? `Screening suggests a comfort zone around ${money(Math.max(60, c.budget - 30))}–${money(c.budget + 15)}.` : 'Screening may give you a clearer picture of this client’s expectations.'} Your negotiation skill is level ${level(s, 'negotiation')}.</div><form data-form="negotiate" data-id="${c.id}" style="margin-top:20px"><div class="field"><label for="quote-amount">Your proposed booking rate · ${c.duration} minutes</label><input id="quote-amount" name="amount" type="number" min="60" max="1500" step="1" value="${c.offer}" required></div><div class="form-error" id="modal-error" role="alert"></div><button class="btn wide" type="submit">Make the proposal ${icon('chat')}</button></form>`;
        }
        if (m.type === 'crm') {
            const p = person(m.id), c = s.clients[m.id];
            if (!c)
                return;
            title = 'Client notes';
            body = `<div class="client-head">${portrait(p)}<div><h2 style="font-size:1.5rem">${esc(p.name)}</h2><span class="badge ${c.blocked ? 'risk' : ''}">${c.blocked ? 'Blocked' : 'Known client'}</span></div></div><p>${INTERESTS[p.interest].name} · ${c.dates} dates · ${Math.round(c.trust)} / 100 trust</p><form data-form="notes" data-id="${p.id}"><div class="field"><label for="client-notes">Preferences, boundaries, things to remember</label><textarea id="client-notes" name="notes" maxlength="800" rows="5">${esc(c.notes)}</textarea><small>Up to 800 characters. Stored locally, as plain text.</small></div><button class="btn wide">Save notes ${icon('check')}</button></form><div class="spacer"></div>${uiButton(c.blocked ? 'Allow future enquiries' : 'Block future enquiries', 'block', `data-id="${p.id}"`, 'danger wide')}<p class="tiny">Blocking also cancels pending bookings with this client and returns their deposits. You can reverse it here later.</p>`;
        }
        if (m.type === 'confirm') {
            title = m.title;
            body = `${icon(m.icon || 'help', 'large')}<h2>${esc(m.title)}</h2><p>${esc(m.text)}</p><div class="row">${uiButton('Not now', 'close-modal', '', 'outline')}${uiButton(esc(m.yes || 'Confirm'), 'confirm-yes', '', '')}</div>`;
        }
        if (m.type === 'help') {
            title = 'How to play';
            body = `<h2>At your own pace.</h2>${this.guideContent()}<div class="subhead"><h3>Controls</h3></div>${this.controlsTable()}<div class="spacer"></div>${uiButton('Back to my day', 'close-modal', '', 'wide')}`;
        }
        if (m.type === 'pause') {
            title = 'Paused';
            body = this.pauseBody();
        }
        if (m.type === 'results') {
            title = 'A life of your own';
            body = this.resultsBody();
        }
        root.innerHTML = this.modalWrap(body, title);
        this.focusModal();
    }
    modalWrap(body, title, close = true) {
        return `<div class="scrim"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">${close ? `<button class="icon-btn modal-close" data-act="close-modal" aria-label="Close dialog">${icon('close')}</button>` : ''}${body}</section></div>`;
    }
    slotOptions(c, day, preferred) {
        let html = '';
        for (let t = 540; t + c.duration <= 1260; t += 30) {
            const disabled = Number(day) === this.s.day && t < this.s.time + 25;
            html += `<option value="${t}" ${t === preferred ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${clock(t)}</option>`;
        }
        return html;
    }
    dateOverlay() {
        const s = this.s, d = s.activeDate, b = s.bookings.find(x => x.id === d.booking), p = person(b.person);
        const story = d.step === 1 ? storyFor(s, b) : null;
        const phase = ['A warm beginning', story ? 'Pick up where you left off' : 'Find your common ground', d.boundary ? 'Keep your own terms' : 'A thoughtful ending'][d.step];
        let title = '', desc = '', choices = [];
        const keys = this.kit?.input.source === 'keyboard';
        if (d.step === 0) {
            title = '“It is good to finally meet you.”';
            desc = `${p.name.split(' ')[0]} arrives feeling ${b.tone}. There is no perfect opening line; a little attention goes a long way.${venueFit(b) ? ' ' + VENUE_FIT[b.venue] : ''}`;
            choices = [['listen', 'Ask how their day has really been', 'chat', 'Listen first'], ['plan', 'Agree on a comfortable plan together', 'shield', 'Clear expectations'], ['pitch', 'Lead with your most impressive stories', 'spark', 'Take the spotlight']];
        }
        if (d.step === 1 && story) {
            // A returning client picks up where you left off.
            const notes = !!s.clients[b.person]?.notes?.trim();
            title = story.title;
            desc = story.desc.replaceAll('{name}', p.name.split(' ')[0]) + (notes ? ' You glance at your notes before you answer.' : '');
            const other = DATE_TOPICS[(DATE_TOPICS.findIndex(t => t.interest === p.interest) + 2) % DATE_TOPICS.length];
            choices = [['recall', story.recall, 'book', notes ? 'From your notes' : 'Remember'], ['curious', 'Ask what has changed since you last met', 'chat', 'Stay curious'], [other.interest, other.label, INTERESTS[other.interest].icon, 'A new subject']];
            if (s.day % 2 === 0)
                choices = [choices[1], choices[0], choices[2]];
        }
        else if (d.step === 1) {
            title = 'A conversation is a little shared space.';
            desc = INTERESTS[p.interest].line;
            const match = DATE_TOPICS.find(t => t.interest === p.interest), other = DATE_TOPICS[(DATE_TOPICS.indexOf(match) + 2) % DATE_TOPICS.length];
            choices = [[match.interest, match.label, INTERESTS[match.interest].icon, 'Their interest'], [other.interest, other.label, INTERESTS[other.interest].icon, 'A new subject'], ['curious', 'Ask what they would love to talk about', 'chat', 'Stay curious']];
            if (s.day % 2 === 0)
                choices = [choices[1], choices[0], choices[2]];
        }
        if (d.step === 2) {
            if (d.boundary) {
                title = 'They suggest a change you did not agree to.';
                desc = 'The client asks to leave the public venue. You are not obliged to change the plan. Your comfort and consent still come first.';
                choices = [['boundary', 'Keep the meeting here, on the agreed terms', 'shield', 'Hold your boundary'], ['checkin', 'Pause and check in with your support contact', 'people', 'Take a moment'], ['exit', 'End the meeting and leave safely', 'arrow', 'No reputation penalty']];
            }
            else {
                title = 'A good ending makes space for the next hello.';
                desc = 'The agreed time is almost up. A small, sincere gesture matters more than a grand performance.';
                choices = [['thoughtful', 'Remember a detail they shared and thank them', 'heart', 'Thoughtful closure'], ['extend', 'Mention meeting again, without extending today', 'calendar', 'Respect the schedule'], ['phone', 'Check your phone while saying goodbye', 'eye', 'Distracted']];
            }
        }
        return `<div class="date-scrim"><section class="date-panel" role="dialog" aria-modal="true" aria-label="Your date with ${esc(p.name)}" tabindex="-1"><header class="date-banner">${portrait(p)}<div class="date-title"><span class="date-phase">${phase} · ${d.step + 1} / 3</span><h3>${esc(p.name)}</h3><small>${VENUES[b.venue].name} · ${money(b.offer)} agreed</small></div><div class="date-connection">CONNECTION<div class="progress"><span style="width:${clamp(d.quality)}%"></span></div></div></header><div class="date-body">${d.lastReply ? `<p class="date-reply">${esc(d.lastReply)}</p>` : ''}<h2>${title}</h2><p>${desc}</p>${choices.map(([id, label, i, hint], n) => `<button class="choice" data-act="date-choice" data-id="${id}">${keys ? `<kbd class="choice-key">${n + 1}</kbd>` : ''}${icon(i)}<span>${label}</span><span class="choice-detail">${hint}</span></button>`).join('')}</div><footer class="date-footer"><span>${icon('lock', 'small')} Time pauses while you choose.</span><button class="text-btn" data-act="safe-exit">End the date safely</button></footer></section></div>`;
    }
    reportOverlay() {
        const r = this.s.report, success = r.type === 'success';
        return this.modalWrap(`<div class="report"><div class="report-emblem">${icon(success ? 'flower' : r.type === 'safe' ? 'shield' : 'calendar', 'large')}</div><span class="caps muted">${success ? 'A LITTLE CONNECTION, WELL MADE' : r.type === 'safe' ? 'YOUR BOUNDARIES MATTER' : 'ROOM FOR SOMETHING ELSE'}</span><h2>${esc(r.title)}</h2>${success ? `<div class="stars">${[0, 1, 2, 3, 4].map(i => `<span style="opacity:${r.rating >= i + 1 ? 1 : .25}">${icon('star')}</span>`).join('')}</div><span class="tiny muted">${r.rating.toFixed(1)} / 5 · ${Math.round(r.quality)}% connection</span>` : ''}<p>${esc(r.text)}</p><div class="earnings">${money(r.net)}</div><span class="tiny muted">${success ? 'Net income · after support and venue expenses' : r.type === 'no-show' ? 'Reservation deposit retained' : 'Deposit returned · venue cost only · reputation unchanged'}</span>${success ? `<div class="report-totals"><div><span>Booking & event bonus</span><strong>${money(r.gross - r.tip)}</strong></div><div><span>A thoughtful tip</span><strong>+${money(r.tip)}</strong></div><div><span>Support share</span><strong>−${money(r.cut)}</strong></div><div><span>Venue expense</span><strong>−${money(r.venueCost)}</strong></div><div class="total"><span>Your net income</span><strong>${money(r.net)}</strong></div></div>` : '<div class="spacer"></div>'}${uiButton('Back to your day ' + icon('arrow'), 'report-dismiss', '', 'wide')}</div>`, 'Date summary', false);
    }
    confirm(title, text, fn, yes = 'Confirm', i = 'help') {
        this.confirmFn = fn;
        this.openModal('confirm', { title, text, yes, icon: i });
    }
    near(id) {
        return Math.hypot(this.s.position[0] - VENUES[id].door[0], this.s.position[1] - VENUES[id].door[1]) <= 3;
    }
    openVenue(id) {
        if (!this.started || this.s.activeDate || this.s.report)
            return;
        this.openModal('venue', { id });
    }
    navigate(id, action = null) {
        if (this.s.activeDate) {
            this.toast('End your current date before going somewhere else.');
            return;
        }
        this.panel = null;
        this.modal = null;
        this.manualPause = false;
        this.renderPanel();
        this.renderOverlay();
        this.world.goTo(id, action);
        this.renderHUD();
    }
    arrive(d) {
        if (d.action?.startsWith('date:')) {
            this.openVenue(d.venue);
            return;
        }
        if (d.action === 'sleep') {
            this.confirm('A little rest. A fresh start.', `End day ${this.s.day}? Today’s bookings must be finished or cancelled. Tomorrow brings fresh enquiries, your daily operating costs, and time to recover.`, () => {
                if (this.run(() => sleep(this.s))) {
                    this.sound.chime();
                    this.kit?.input.rumble(.2, 90);
                }
            }, 'End the day', 'moon');
            return;
        }
        if (d.action) {
            this.run(() => doAction(this.s, d.action));
            return;
        }
        this.openVenue(d.venue);
    }
    run(fn, { modalClose = false, refresh = true } = {}) {
        try {
            const before = this.s.achievements.length;
            const result = fn();
            if (!result?.ok) {
                this.toast(result?.message || 'That action is unavailable.', true);
                if (document.getElementById('modal-error'))
                    document.getElementById('modal-error').textContent = result?.message || '';
                this.sound.cue(false);
                this.kit?.input.rumble(.2, 60);
                return false;
            }
            this.sound.cue(true);
            this.toast(result.message);
            // Celebrate milestones the moment they land.
            for (const id of this.s.achievements.slice(before)) {
                const m = MILESTONES.find(x => x.id === id);
                if (m) {
                    this.toast(`Milestone · ${m.name} · +${money(m.reward)}`);
                    this.sound.chime();
                    this.kit?.input.rumble(.35, 160);
                }
            }
            if (modalClose)
                this.modal = null;
            this.save();
            if (refresh)
                this.refresh();
            return true;
        }
        catch (err) {
            console.error(err);
            this.error('An action could not be completed. Export a save before reloading.');
            return false;
        }
    }
    refresh() {
        const scroll = document.querySelector('.panel-body')?.scrollTop || 0;
        this.renderHUD();
        this.renderPanel();
        const body = document.querySelector('.panel-body');
        if (body)
            body.scrollTop = scroll;
        this.renderOverlay();
        this.checkCelebration();
    }
    applySettings() {
        document.documentElement.style.setProperty('--body-scale', this.s.settings.textScale);
        document.documentElement.classList.toggle('reduced', this.s.settings.reduceMotion);
        document.documentElement.classList.toggle('high-contrast', this.s.settings.highContrast);
        document.documentElement.classList.toggle('large-text', this.s.settings.textScale > 1);
        if (this.world)
            this.world.labelsDirty = true;
        this.sound.setVolume(this.s.settings.volume);
    }
    save() {
        if (!this.started)
            return;
        try {
            const raw = serialize(this.s), old = localStorage.getItem('good-company-save');
            if (old) {
                try {
                    deserialize(old);
                    localStorage.setItem('good-company-backup', old);
                }
                catch { }
            }
            localStorage.setItem('good-company-save', raw);
            this.saveUnavailable = false;
            this.saved = true;
            this.backedSave = structuredClone(this.s);
        }
        catch {
            if (!this.saveUnavailable)
                this.toast('Browser storage is unavailable or full. Export your save from Settings.', true);
            this.saveUnavailable = true;
        }
    }
    toast(text, error = false) {
        if (!text)
            return;
        const root = document.getElementById('toast-root'), div = document.createElement('div');
        div.className = 'toast' + (error ? ' error' : '');
        div.innerHTML = icon(error ? 'help' : 'checkcircle') + `<span>${esc(text)}</span>`;
        root.appendChild(div);
        while (root.children.length > 2)
            root.firstElementChild.remove();
        setTimeout(() => div.remove(), error ? 6500 : 4400);
    }
    error(msg) {
        const el = document.getElementById('error-banner');
        el.innerHTML = `<span>${esc(msg)}</span> <button class="btn compact outline" data-act="dismiss-error">Dismiss</button>`;
        el.style.display = 'block';
        this.manualPause = true;
        this.renderHUD();
    }
    exportSave() {
        this.save();
        const data = serialize(this.s), blob = new Blob([data], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url;
        a.download = `company-hours-day-${this.s.day}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.toast('Save exported. Keep this file somewhere safe.');
    }
    async importSave(file) {
        if (!file)
            return;
        try {
            if (file.size > 2000000)
                throw new Error('Save files must be smaller than 2 MB.');
            const incoming = deserialize(await file.text());
            this.confirm('Continue a different story?', `Load ${incoming.player.name}’s career on day ${incoming.day}? Your current career will be replaced on this device. Export it first to keep both.`, () => this.start(incoming), 'Load this save', 'upload');
        }
        catch (err) {
            this.toast('Import rejected: ' + err.message, true);
        }
        document.getElementById('file-input').value = '';
    }
    bind() {
        this.root.addEventListener('click', e => {
            const b = e.target.closest('[data-act]');
            if (!b || b.disabled)
                return;
            this.handle(b.dataset.act, b.dataset, b);
        });
        this.root.addEventListener('submit', e => {
            const f = e.target.closest('[data-form]');
            if (!f)
                return;
            e.preventDefault();
            this.submit(f);
        });
        this.root.addEventListener('change', e => this.change(e.target));
        this.root.addEventListener('input', e => {
            if (e.target.dataset.setting === 'volume') {
                this.s.settings.volume = Number(e.target.value);
                this.sound.setVolume(this.s.settings.volume);
            }
        });
        // Keep keyboard focus inside an open dialog (Tab and Shift+Tab wrap round). Everything
        // else the keyboard does goes through kit.input actions (see handleInput).
        document.addEventListener('keydown', e => {
            if (e.code === 'Tab') {
                const dialog = document.querySelector('#overlay-root [role="dialog"],#setup-root [role="dialog"]');
                if (dialog) {
                    const els = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(el => !el.hidden);
                    if (els.length) {
                        const first = els[0], last = els.at(-1);
                        if (e.shiftKey && document.activeElement === first) {
                            e.preventDefault();
                            last.focus();
                        }
                        else if (!e.shiftKey && document.activeElement === last) {
                            e.preventDefault();
                            first.focus();
                        }
                    }
                }
            }
        });
        // Browsers may leave audio suspended until a gesture.
        for (const type of ['pointerdown', 'keydown'])
            addEventListener(type, () => this.sound.unlock(), { capture: true, passive: true });
        document.addEventListener('visibilitychange', () => {
            this.documentHidden = document.hidden;
            if (document.hidden)
                this.save();
            this.sound.hold(document.hidden || !!this.kit?.paused);
        });
        window.addEventListener('pagehide', () => this.save());
    }
    handle(act, d, el) {
        const s = this.s;
        if (act === 'swatch') {
            this.formChoices[d.field] = d.color;
            for (const b of el.parentElement.children) {
                b.classList.toggle('selected', b === el);
                b.setAttribute('aria-pressed', String(b === el));
            }
            return;
        }
        if (act === 'continue') {
            if (this.backedSave)
                this.start(structuredClone(this.backedSave));
            return;
        }
        if (act === 'dismiss-error') {
            document.getElementById('error-banner').style.display = 'none';
            return;
        }
        if (act === 'controls-device') {
            // Swap only the controls list, so the dialog or panel keeps its scroll and focus.
            this.controlsDevice = d.dev;
            for (const block of document.querySelectorAll('.controls-block'))
                block.outerHTML = this.controlsTable();
            const again = document.querySelector(`.controls-block [data-dev="${d.dev}"]`);
            if (again && el === document.activeElement)
                again.focus({ preventScroll: true });
            return;
        }
        if (!this.started)
            return;
        if (act === 'resume') {
            this.closeModal();
            return;
        }
        if (act === 'graphics') {
            this.kit.menu.open();
            return;
        }
        if (act === 'title') {
            this.save();
            this.renderSetup();
            return;
        }
        if (act === 'settings-panel') {
            this.modal = null;
            this.panel = 'settings';
            this.refresh();
            return;
        }
        if (act === 'results-new') {
            this.modal = null;
            this.renderSetup();
            return;
        }
        if (act === 'walking-toast') {
            if (!this.world.destination) {
                const id = this.world.nearbyVenue();
                if (id)
                    this.openVenue(id);
            }
            return;
        }
        if (act === 'nav') {
            this.openPanel(d.panel);
            this.sound.tick();
            return;
        }
        if (act === 'tab') {
            this.tabs[d.section] = d.tab;
            this.renderPanel();
            return;
        }
        if (act === 'close-panel') {
            this.panel = null;
            this.renderPanel();
            this.renderHUD();
            return;
        }
        if (act === 'close-modal') {
            this.closeModal();
            return;
        }
        if (act === 'pause') {
            this.manualPause = !this.manualPause;
            this.renderHUD();
            return;
        }
        if (act === 'speed') {
            this.speed = Number(d.speed);
            this.manualPause = false;
            this.renderHUD();
            return;
        }
        if (act === 'zoom') {
            this.world.setZoom(this.world.zoom * (Number(d.dir) > 0 ? 1.16 : .86));
            return;
        }
        if (act === 'rotate') {
            this.world.rotate(Number(d.dir) * Math.PI / 4);
            return;
        }
        if (act === 'center') {
            this.world.center();
            return;
        }
        if (act === 'venue') {
            this.openVenue(d.id);
            return;
        }
        if (act === 'go') {
            this.navigate(d.id);
            return;
        }
        if (act === 'activity') {
            const a = ACTIONS[d.id];
            if (a)
                this.navigate(a.venue, d.id);
            return;
        }
        if (act === 'sleep-travel') {
            this.navigate('home', 'sleep');
            return;
        }
        if (act === 'navigate-date') {
            const b = s.bookings.find(b => b.id === d.id && b.status === 'booked');
            if (b?.day === s.day)
                this.navigate(b.venue, 'date:' + b.id);
            else
                this.toast('That booking is not today.', true);
            return;
        }
        if (act === 'wait-date') {
            const b = s.bookings.find(b => b.id === d.id && b.status === 'booked');
            if (b && b.day === s.day && this.near(b.venue)) {
                const wait = () => {
                    advance(s, Math.max(0, b.time - s.time));
                    this.modal = { type: 'venue', id: b.venue };
                    this.save();
                    this.refresh();
                };
                // Waiting here would silently miss an earlier booking somewhere else: ask first.
                const skipped = s.bookings.filter(x => x.id !== b.id && x.status === 'booked' && x.day === s.day && x.time + 40 < b.time);
                if (skipped.length)
                    this.confirm('Wait here anyway?', `Waiting until ${clock(b.time)} means missing ${skipped.length === 1 ? `your ${clock(skipped[0].time)} booking with ${person(skipped[0].person).name}` : skipped.length + ' earlier bookings'}. A missed booking refunds the deposit and costs 3 reputation.`, wait, 'Wait anyway', 'clock');
                else
                    wait();
            }
            return;
        }
        if (act === 'begin-date') {
            this.run(() => beginDate(s, d.id), { modalClose: true });
            return;
        }
        if (act === 'date-choice') {
            if (this.run(() => dateChoice(s, d.id)) && s.report?.type === 'success') {
                this.kit.input.rumble(s.report.quality >= 85 ? .45 : .25, s.report.quality >= 85 ? 220 : 120);
                if (s.report.quality >= 85)
                    this.sound.chime();
            }
            return;
        }
        if (act === 'safe-exit') {
            this.run(() => dateChoice(s, 'exit'));
            return;
        }
        if (act === 'report-dismiss') {
            s.report = null;
            this.modal = null;
            this.save();
            this.refresh();
            return;
        }
        if (act === 'event-dismiss') {
            s.event = null;
            this.kit.input.settle();
            this.refresh();
            return;
        }
        if (act === 'screen') {
            if (this.run(() => screen(s, d.id)) && this.modal?.type === 'booking')
                this.renderOverlay();
            return;
        }
        if (act === 'decline') {
            this.run(() => decline(s, d.id));
            return;
        }
        if (act === 'negotiate') {
            const c = s.leads.find(l => l.id === d.id);
            if (c && !c.negotiated)
                this.openModal('negotiate', { id: d.id });
            return;
        }
        if (act === 'booking') {
            this.openModal('booking', { id: d.id });
            return;
        }
        if (act === 'cancel-booking') {
            this.confirm('Cancel this booking?', 'The reservation deposit will be returned. Your reputation will not be penalized.', () => this.run(() => cancel(s, d.id)), 'Cancel & refund', 'calendar');
            return;
        }
        if (act === 'open-enquiries') {
            this.modal = null;
            this.panel = 'clients';
            this.tabs.clients = 'enquiries';
            this.refresh();
            return;
        }
        if (act === 'crm') {
            this.openModal('crm', { id: d.id });
            return;
        }
        if (act === 'block') {
            const c = s.clients[d.id];
            if (!c)
                return;
            if (c.blocked) {
                c.blocked = false;
                this.save();
                this.refresh();
                return;
            }
            this.confirm('Set a clear boundary?', 'This client will no longer send enquiries. Pending bookings will be cancelled and deposits refunded.', () => {
                for (const b of s.bookings.filter(b => b.person === d.id && b.status === 'booked'))
                    cancel(s, b.id);
                c.blocked = true;
                s.leads = s.leads.filter(l => l.person !== d.id);
                this.save();
                this.refresh();
            }, 'Block client', 'shield');
            return;
        }
        if (act === 'market') {
            this.run(() => market(s, d.id));
            return;
        }
        if (act === 'model') {
            this.run(() => setModel(s, d.id));
            return;
        }
        if (act === 'upgrade') {
            this.run(() => buyUpgrade(s, d.id));
            return;
        }
        if (act === 'permit') {
            this.run(() => renewPermit(s));
            return;
        }
        if (act === 'repay') {
            this.run(() => repay(s, Math.min(100, available(s))));
            return;
        }
        if (act === 'recruit') {
            this.run(() => recruit(s));
            return;
        }
        if (act === 'relocate') {
            const r = REGIONS[d.id];
            if (r)
                this.confirm('Start again in ' + r.name + '?', `Moving costs ${money(r.move + r.permit)}, including the initial permit where required. Pending bookings must be finished or cancelled. Current enquiries will reset and your audience will fall by 20%.`, () => {
                    if (this.run(() => relocate(s, d.id))) {
                        this.world.setState(s, true);
                        this.world.center();
                        this.world.revealPlayer();
                    }
                }, 'Make the move', 'compass');
            return;
        }
        if (act === 'confirm-yes') {
            const fn = this.confirmFn;
            this.confirmFn = null;
            this.modal = null;
            this.renderOverlay();
            fn?.();
            return;
        }
        if (act === 'help') {
            this.openModal('help');
            return;
        }
        if (act === 'save') {
            this.save();
            this.toast(this.saveUnavailable ? 'Export a backup to keep your progress.' : 'Your story is saved on this device.', this.saveUnavailable);
            this.renderPanel();
            return;
        }
        if (act === 'export') {
            this.exportSave();
            return;
        }
        if (act === 'import') {
            document.getElementById('file-input').click();
            return;
        }
        if (act === 'restore') {
            try {
                const raw = localStorage.getItem('good-company-backup');
                if (!raw)
                    throw new Error('No local backup is available.');
                const backup = deserialize(raw);
                this.confirm('Restore the previous save?', `Return to ${backup.player.name}’s previous autosave on day ${backup.day}? Your current state will be replaced.`, () => this.start(backup), 'Restore backup', 'book');
            }
            catch (err) {
                this.toast(err.message, true);
            }
            return;
        }
        if (act === 'new-career') {
            this.confirm('A different next chapter?', 'Your current career will stay saved until you start the new one. Export a backup first to keep both stories.', () => this.renderSetup(), 'Create a new career', 'flower');
            return;
        }
    }
    submit(form) {
        const f = new FormData(form), kind = form.dataset.form, s = this.s;
        if (kind === 'start') {
            const opts = { name: f.get('name'), age: Number(f.get('age')), pronouns: f.get('pronouns'), style: f.get('style'), region: f.get('region'), difficulty: f.get('difficulty'), goal: f.get('goal'), ...this.formChoices };
            if (opts.age < 21 || opts.age > 80)
                return;
            this.start(newGame(opts));
            return;
        }
        if (kind === 'book') {
            const result = book(s, form.dataset.id, Number(f.get('day')), Number(f.get('time')));
            if (!result.ok) {
                document.getElementById('modal-error').textContent = result.message;
                this.sound.cue(false);
                return;
            }
            this.modal = null;
            this.panel = 'calendar';
            this.tabs.calendar = Number(f.get('day')) === s.day ? 'today' : Number(f.get('day')) === s.day + 1 ? 'tomorrow' : 'later';
            this.toast(result.message);
            this.save();
            this.refresh();
            return;
        }
        if (kind === 'negotiate') {
            if (this.run(() => negotiate(s, form.dataset.id, Number(f.get('amount'))))) {
                this.openModal('booking', { id: form.dataset.id });
            }
            return;
        }
        if (kind === 'rate') {
            const rate = Math.round(Number(f.get('rate')));
            if (!Number.isFinite(rate) || rate < 60 || rate > 1500) {
                this.toast('Set a rate between $60 and $1,500.', true);
                return;
            }
            s.rate = rate;
            for (const l of s.leads)
                if (!l.negotiated)
                    l.offer = rate;
            this.toast('New enquiries now use your updated rate.');
            this.save();
            this.refresh();
            return;
        }
        if (kind === 'savings') {
            const amount = Number(f.get('amount')) * (f.get('direction') === 'withdraw' ? -1 : 1);
            this.run(() => transfer(s, amount));
            return;
        }
        if (kind === 'notes') {
            const c = s.clients[form.dataset.id];
            if (c) {
                c.notes = String(f.get('notes')).slice(0, 800);
                this.modal = null;
                this.toast('Client notes saved on this device.');
                this.save();
                this.refresh();
            }
            return;
        }
    }
    change(el) {
        if (el.id === 'file-input') {
            this.importSave(el.files[0]);
            return;
        }
        if (el.dataset.bookingDay) {
            const c = this.s.leads.find(l => l.id === el.dataset.bookingDay);
            if (c) {
                const val = Number(el.value) === this.s.day ? Math.ceil((this.s.time + 40) / 30) * 30 : 600;
                document.getElementById('booking-time').innerHTML = this.slotOptions(c, Number(el.value), val);
            }
            return;
        }
        if (el.dataset.support) {
            const key = el.dataset.support;
            if (!['security', 'manager'].includes(key))
                return;
            const enabled = el.checked, cost = key === 'security' ? 35 : 30;
            if (enabled && !pay(this.s, cost, key === 'security' ? 'Hire safety coordinator' : 'Hire booking manager')) {
                this.toast('Not enough available cash to hire support.', true);
                el.checked = false;
                return;
            }
            this.s[key] = enabled;
            fillLeads(this.s);
            this.save();
            this.refresh();
            return;
        }
        const k = el.dataset.setting;
        if (!k)
            return;
        const v = el.type === 'checkbox' ? el.checked : el.value;
        if (k === 'privacy') {
            if (['private', 'balanced', 'public'].includes(v))
                this.s.privacy = v;
        }
        else if (k === 'disclosure') {
            // A refused change (same day, no time) must not leave the select showing it.
            if (!this.run(() => disclosure(this.s, v)))
                this.renderPanel();
            return;
        }
        else if (['textScale', 'volume', 'reduceMotion', 'highContrast', 'showLabels', 'audio'].includes(k)) {
            this.s.settings[k] = ['volume', 'textScale'].includes(k) ? Number(v) : v;
            if (k === 'audio')
                this.sound.enable(v, this.s.settings.volume).catch(() => this.toast('Audio could not be started in this browser.', true));
            this.applySettings();
        }
        this.save();
        this.renderHUD();
    }
    /* ------------------------------------------------------------ frame and input */

    /** Which layer of the interface has the player's attention. */
    layer() {
        if (!this.started)
            return 'setup';
        if (this.s.activeDate || this.s.report || this.s.event || this.modal)
            return 'overlay';
        return this.panel ? 'panel' : 'world';
    }
    /** Where the D-pad moves focus in a layer, and what it lands on first. */
    navRoot(layer) {
        if (layer === 'setup')
            return { el: document.getElementById('setup-root'), prefer: '[data-act="continue"], button[type="submit"]' };
        if (layer === 'overlay') {
            const el = document.querySelector('#overlay-root [role="dialog"]');
            return el ? { el, prefer: '.choice, .btn:not(.outline):not(.secondary):not(.danger)' } : null;
        }
        if (layer === 'panel')
            return { el: this.root, prefer: '#panel-root .tabs .active, #panel-root .btn' };
        return { el: this.root, prefer: '.navdock button' };
    }
    /** Called by the kit loop every frame (dt in seconds, already capped). */
    frame(dt) {
        if (!this.world)
            return;
        const input = this.kit.input;
        this.handleInput(dt);
        const playing = this.isPlaying();
        if (playing)
            advance(this.s, dt * 2 * this.speed);
        const layer = this.layer();
        this.world.animate(dt, {
            playing,
            speed: this.speed,
            move: playing ? input.vector('move') : ZERO,
            cam: layer === 'world' ? input.vector('stick') : ZERO,
        });
        this.sound.update(playing);
        this.autoSaveCounter += dt;
        this.lastHUD += dt;
        if (this.lastHUD > .65) {
            this.lastHUD = 0;
            this.renderHUD();
        }
        if (this.autoSaveCounter > 25) {
            this.autoSaveCounter = 0;
            this.save();
        }
        if (this.started && this.s.time >= 1320 && this.nightNotified !== this.s.day) {
            this.nightNotified = this.s.day;
            this.toast('It is 22:00. Head home, close out today’s bookings, and get some rest.');
        }
    }
    handleInput(dt) {
        const input = this.kit.input;
        const layer = this.layer();
        // The 3D view: a tap walks or visits, a drag pans, wheel and pinch zoom.
        const tap = this.world.pointerFrame(input);
        if (tap)
            this.onTap(tap);
        // The D-pad (and the arrow keys in menus) moves focus through the interface; A presses.
        let dir = input.vector('nav');
        if (layer === 'world' && input.source !== 'gamepad')
            dir = ZERO; // the arrow keys walk in town
        else if (layer !== 'world' && input.source === 'gamepad') {
            const mv = input.vector('move');
            if (Math.abs(mv.x) + Math.abs(mv.y) > Math.abs(dir.x) + Math.abs(dir.y))
                dir = mv;
        }
        const confirm = input.pressed('confirm');
        const padConfirm = confirm && (layer !== 'world' || !!this.padnav.focused);
        const root = this.navRoot(layer);
        if (root?.el)
            this.padnav.update({ root: root.el, prefer: root.prefer, dir, confirm: padConfirm });
        if ((confirm && !padConfirm) || input.pressed('interact'))
            this.interact();
        if (input.pressed('back'))
            this.back(input.source);
        if (input.pressed('pause'))
            this.togglePause();
        if (!this.started)
            return;
        if (input.pressed('clock') && !this.modal && !this.s.activeDate && !this.s.report && !this.s.event) {
            this.manualPause = !this.manualPause;
            this.sound.tick();
            this.renderHUD();
        }
        if (input.pressed('speed') && layer !== 'overlay') {
            this.speed = this.speed === 1 ? 3 : 1;
            this.manualPause = false;
            this.toast(this.speed === 3 ? 'Fast time' : 'Normal time');
            this.renderHUD();
        }
        if (layer === 'world' || layer === 'panel') {
            const pad = input.source === 'gamepad';
            if (layer === 'panel' && pad && (input.pressed('rotL') || input.pressed('rotR')))
                this.cycleTab(input.pressed('rotR') ? 1 : -1);
            else {
                if (input.pressed('rotL'))
                    this.world.rotate(-Math.PI / 4);
                if (input.pressed('rotR'))
                    this.world.rotate(Math.PI / 4);
            }
            if (input.pressed('zoomIn'))
                this.world.setZoom(this.world.zoom * 1.16);
            if (input.pressed('zoomOut'))
                this.world.setZoom(this.world.zoom * .86);
            if (input.pressed('recenter'))
                this.world.center();
            if (input.pressed('tabPrev'))
                this.cyclePanel(-1);
            if (input.pressed('tabNext'))
                this.cyclePanel(1);
            if (input.pressed('home'))
                this.handle('sleep-travel', {});
        }
        for (let n = 1; n <= 6; n++)
            if (input.pressed('quick' + n))
                this.quick(n);
        // The right stick scrolls whatever panel or dialog is open.
        if (layer === 'panel' || layer === 'overlay') {
            const st = input.vector('stick');
            if (Math.abs(st.y) > .1) {
                const sc = layer === 'panel' ? document.querySelector('#panel-root .panel-body') : document.querySelector('#overlay-root .modal, #overlay-root .date-panel');
                if (sc)
                    sc.scrollTop -= st.y * 900 * dt;
            }
        }
    }
    /** A tap or click on the 3D view (not a drag). */
    onTap({ x, y }) {
        if (!this.started)
            return;
        const layer = this.layer();
        if (layer === 'overlay')
            return;
        if (layer === 'panel') {
            // Tapping the town closes the open panel and gives the view back.
            this.panel = null;
            this.renderPanel();
            this.renderHUD();
            return;
        }
        const hit = this.world.pick(x, y);
        if (!hit)
            return;
        if (hit.venue) {
            this.openVenue(hit.venue);
            return;
        }
        if (!this.isPlaying()) {
            const now = performance.now();
            if (now - this.lastPauseHint > 2500) {
                this.lastPauseHint = now;
                this.toast('Time is paused. Press play (or Space) to walk around.');
            }
            return;
        }
        if (this.world.walkTo(hit.ground))
            this.renderHUD();
    }
    /** Enter / X: go into the place whose door you are standing at. */
    interact() {
        if (this.layer() !== 'world')
            return;
        const id = this.world.nearbyVenue();
        if (id)
            this.openVenue(id);
        else
            this.toast('Walk up to a door to go in, or pick a place by its label.');
    }
    back(source) {
        if (!this.started || this.s.activeDate || this.s.report || this.s.event)
            return;
        if (this.modal) {
            this.closeModal();
            return;
        }
        if (this.panel) {
            this.panel = null;
            this.renderPanel();
            this.renderHUD();
            return;
        }
        if (this.padnav.focused) {
            this.padnav.clear();
            return;
        }
        if (this.world.stop()) {
            this.renderHUD();
            return;
        }
        if (source !== 'gamepad')
            this.openPause();
    }
    togglePause() {
        if (!this.started)
            return;
        if (this.modal?.type === 'pause') {
            this.closeModal();
            return;
        }
        if (this.s.activeDate || this.s.report || this.s.event) {
            this.toast('Finish this moment first. Time is already paused.');
            return;
        }
        this.openPause();
    }
    openPause() {
        this.panel = null;
        this.renderPanel();
        this.openModal('pause');
        this.sound.tick();
    }
    /** Number keys: date answers during a date, otherwise the six panels. */
    quick(n) {
        if (!this.started)
            return;
        if (this.s.activeDate) {
            document.querySelectorAll('#overlay-root .choice')[n - 1]?.click();
            return;
        }
        if (this.layer() === 'overlay')
            return;
        const tab = UI_TABS[n - 1];
        if (tab) {
            this.openPanel(tab[0]);
            this.sound.tick();
        }
    }
    cyclePanel(dir) {
        const ids = UI_TABS.map(t => t[0]);
        const i = ids.indexOf(this.panel);
        const next = ids[i < 0 ? (dir > 0 ? 0 : ids.length - 1) : (i + dir + ids.length) % ids.length];
        this.panel = null;
        this.openPanel(next);
        this.sound.tick();
    }
    cycleTab(dir) {
        const tabs = [...document.querySelectorAll('#panel-root [role="tab"]')];
        if (!tabs.length)
            return;
        const i = Math.max(0, tabs.findIndex(t => t.classList.contains('active')));
        tabs[(i + dir + tabs.length) % tabs.length].click();
        this.sound.tick();
    }
    /** When the long-term goal completes, show the results once (then the story continues). */
    checkCelebration() {
        const s = this.s;
        if (!this.started || !s.finished || s.celebrated || s.activeDate || s.report || s.event || this.modal)
            return;
        s.celebrated = true;
        this.save();
        this.panel = null;
        this.renderPanel();
        this.openModal('results');
        this.sound.chime(true);
        this.kit?.input.rumble(.5, 260);
    }
    recapHTML(r) {
        if (!r)
            return '';
        const row = (label, value) => `<div><span>${label}</span><strong>${value}</strong></div>`;
        return `<div class="report-totals recap">${row(`Day ${r.day} income`, '+' + money(r.earned))}${row(`Day ${r.day} spending`, '−' + money(r.spent))}${r.bills ? row(r.rentDay ? 'Rent and bills this morning' : 'Bills this morning', '−' + money(r.bills)) : ''}${r.team ? row('Studio coordination fees', '+' + money(r.team)) : ''}<div class="total"><span>Available to spend</span><strong>${money(available(this.s))}</strong></div></div>`;
    }
    pauseBody() {
        const s = this.s;
        return `<div class="report"><div class="report-emblem">${icon('pause', 'large')}</div><span class="caps muted">DAY ${s.day} · ${clock(s.time)} · ${esc(REGIONS[s.region].name.toUpperCase())}</span><h2>Take a breath.</h2><p>Time is paused. Your story is right where you left it.</p><div class="stack">${uiButton('Resume ' + icon('play'), 'resume', '', 'wide')}${uiButton(icon('help') + ' How to play & controls', 'help', '', 'outline wide')}${uiButton(icon('book') + ' Settings & saves', 'settings-panel', '', 'outline wide')}${uiButton(icon('settings') + ' Graphics & controls', 'graphics', '', 'outline wide')}<div class="row">${uiButton('Save now', 'save', '', 'secondary')}${uiButton('Title screen', 'title', '', 'outline')}</div></div></div>`;
    }
    resultsBody() {
        const s = this.s;
        const ratings = s.stats.ratings;
        const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        const regular = Object.entries(s.clients).sort((a, b) => b[1].dates - a[1].dates)[0];
        return `<div class="report"><div class="report-emblem">${icon('award', 'large')}</div><span class="caps muted">YOUR GOAL IS COMPLETE · DAY ${s.day}</span><h2>${GOALS[s.goal][0]}</h2><p>${GOALS[s.goal][1]} You did it, at your own pace.</p><div class="stat-grid">${uiMetric('Days', s.day)}${uiMetric('Dates completed', s.stats.dates)}${uiMetric('Average rating', avg ? avg.toFixed(1) + ' / 5' : '—')}${uiMetric('Savings', money(s.savings))}${uiMetric('Reputation', Math.round(s.rep) + ' / 100')}${uiMetric('Time with Jules', s.relationship.visits + (s.relationship.visits === 1 ? ' visit' : ' visits'))}${uiMetric('Lifetime income', money(s.stats.earned))}${uiMetric('Milestones', s.achievements.length + ' / ' + MILESTONES.length)}</div>${regular && regular[1].dates > 1 ? `<p class="tiny">Your most familiar face: ${esc(person(regular[0]).name)}, ${regular[1].dates} dates.</p>` : ''}<div class="stack" style="margin-top:18px">${uiButton('Continue your story ' + icon('arrow'), 'close-modal', '', 'wide')}<div class="row">${uiButton(icon('download') + ' Export save', 'export', '', 'outline')}${uiButton('New career', 'results-new', '', 'outline')}</div></div></div>`;
    }
    /** Controls for one device at a time: the one in use, or the one picked here. */
    controlsTable() {
        const src = this.controlsDevice || this.kit?.input.source || 'keyboard';
        const col = src === 'gamepad' ? 2 : src === 'touch' ? 3 : 1;
        const rows = [
            ['Walk', 'Click the ground · WASD or arrows', 'Left stick', 'Tap the ground'],
            ['Visit a place', 'Click a building or label · Enter at a door', 'X at a door · D-pad to a label, then A', 'Tap a building or label'],
            ['Pan and zoom', 'Drag · mouse wheel · + and −', 'Right stick (up/down zoom, left/right turn)', 'Drag · pinch'],
            ['Rotate · reset view', 'Q and E · F', 'LB and RB · press the right stick', 'Camera buttons'],
            ['Menus', '1–6 open panels · Tab · arrows', 'D-pad moves · A selects · B goes back · LT/RT switch panels · LB/RB tabs', 'The bar along the bottom'],
            ['Pause time · speed', 'Space · T', 'Y', 'Clock buttons at the top'],
            ['Pause menu', 'Esc or P', 'Start', 'Settings button'],
            ['Head home', 'H', 'View', 'My life → Home'],
            ['Date answers', '1 · 2 · 3', 'D-pad, then A', 'Tap an answer'],
        ];
        const devices = [['keyboard', 'Keyboard & mouse'], ['gamepad', 'Controller'], ['touch', 'Touch']];
        return `<div class="controls-block"><div class="tabs controls-tabs">${devices.map(([id, label]) => `<button class="${id === src ? 'active' : ''}" data-act="controls-device" data-dev="${id}" aria-pressed="${id === src}">${label}</button>`).join('')}</div><div class="controls-list">${rows.map(r => `<div class="ledger-row"><span class="ledger-label"><strong>${r[0]}</strong></span><span class="tiny controls-keys">${r[col]}</span></div>`).join('')}</div></div>`;
    }
}
