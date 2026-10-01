import { DEFAULT_SETTINGS } from './game.js';
import { TEAMS, playerById } from './rosters.js';
import { timeLabel, other, portraitView } from './math.js';
import { VENUES, venueOf } from './art.js';
import { prompt } from './controls.js';

export const BOLT = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 3 8 28h14l-3 17 22-28H27z" fill="currentColor"/></svg>';
const ICE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 2 19 19-8 23H13L5 21z" fill="none" stroke="currentColor" stroke-width="4"/><path d="m24 8 7 14-7 18-7-18z" fill="currentColor"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="4"/></svg>';
const SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9zm13-2c4 3 4 7 0 10m3-13c6 5 6 11 0 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const CUP = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 6h20v10a10 10 0 0 1-20 0zM14 9H7a7 7 0 0 0 7 9m20-9h7a7 7 0 0 1-7 9M24 26v8m-7 8h14l-2-8H19z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/></svg>';
const key = (text) => `<kbd>${text}</kbd>`;
const safe = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const MODES = ['exhibition', 'playoffs', 'practice', 'cup'];
const CAMERAS = ['broadcast', 'wide', 'follow'];
export const CAMERA_NAMES = { broadcast: 'Broadcast', wide: 'Wide arena', follow: 'Close follow' };

export function loadSettings() {
    try {
        const x = JSON.parse(localStorage.getItem('slapshot.settings.v1') ?? '{}');
        return { ...DEFAULT_SETTINGS, team: x.team === 1 ? 1 : 0, periodSeconds: [60, 120, 180, 1200].includes(x.periodSeconds ?? 0) ? x.periodSeconds : 120,
            difficulty: x.difficulty === 1 || x.difficulty === 3 ? x.difficulty : 2, mode: MODES.includes(x.mode) ? x.mode : 'exhibition', players: x.players === 2 ? 2 : 1,
            rules: x.rules ?? true, sound: x.sound ?? true, music: x.music ?? true, shake: x.shake ?? true, camera: CAMERAS.includes(x.camera) ? x.camera : 'broadcast',
            venue: VENUES[x.venue] ? x.venue : 'brickyard' };
    }
    catch {
        return { ...DEFAULT_SETTINGS };
    }
}
export function saveSettings(s) {
    try {
        localStorage.setItem('slapshot.settings.v1', JSON.stringify(s));
    }
    catch { /* Storage may be disabled in private/file contexts. */ }
}

export class UI {
    modal = null;
    /** Screens to return to with Back (B, Esc, the × button): pause → settings → … */
    stack = [];
    wasPaused = false;
    lastFocus = null;
    rosterTeam = 0;
    lastPhase = '';
    lastPenalty = '';
    lastHint = '';
    source = 'keyboard';
    record = { wins: 0, losses: 0, goals: 0, games: 0, cups: 0 };
    constructor(root, game, settings, actions, { kit, cup }) {
        this.root = root;
        this.game = game;
        this.settings = settings;
        this.actions = actions;
        this.kit = kit;
        this.cup = cup;
        this.source = kit.input.source;
        try {
            Object.assign(this.record, JSON.parse(localStorage.getItem('slapshot.record.v1') ?? '{}'));
        }
        catch { /* storage may be unavailable */ }
        root.insertAdjacentHTML('beforeend', `
      <div class="paper-grain" aria-hidden="true"></div>
      <header class="topbar">
        <button class="brand" data-action="brand" aria-label="Slapshot home"><span class="brand-mark">${BOLT}</span><span>SLAPSHOT<small>BRICK LEAGUE</small></span></button>
        <nav class="home-nav" aria-label="Main navigation"><button class="nav-link active" data-action="home">PLAY</button><button class="nav-link" data-action="rosters">ROSTERS <span>40</span></button><button class="nav-link" data-action="help">HOW TO PLAY</button></nav>
        <div class="top-tools"><button class="engine-badge" data-action="engine"><i></i><span id="engine-text">${safe(kit.backendLabel.toUpperCase())}</span></button><button class="icon-button" data-action="sound" aria-label="Toggle sound" title="Toggle sound">${SOUND}</button><button class="icon-button home-setting" data-action="settings" aria-label="Settings" title="Settings">⚙</button><button class="icon-button game-pause" data-action="pause" aria-label="Pause game">${PAUSE}</button></div>
      </header>
      <main id="home" class="home-screen">
        <section class="hero">
          <div class="eyebrow"><span></span> NO ICE. NO MERCY.</div>
          <h1>SLAP<br><span>SHOT</span><b>✦</b></h1>
          <div class="arcade-sticker">ARCADE HOCKEY. AMPED UP.</div>
          <p>Big hits. Ridiculous shots.<br>A whole new block of hockey.</p>
          <button class="text-button hero-help" data-action="help">LEARN THE MOVES <span>↗</span></button>
        </section>
        <button class="venue-label" data-action="venue" aria-label="Switch venue" title="Switch venue"><span class="venue-pin">◈</span><div><span id="venue-name">THE BRICKYARD</span><small id="venue-tag">HOME OF THE HEAVY HITS</small></div><span class="venue-number" id="venue-number">01</span><span class="venue-switch" aria-hidden="true">⇄</span></button>
        <div class="arena-sticker"><b>100%</b><span>ALL GAS.<br>NO BRAKES.</span></div>
        <section class="match-dock" aria-label="Match setup">
          <div class="matchup"><div class="dock-eyebrow">CHOOSE YOUR SIDE <span id="dock-tag">5 ON 5</span></div><div class="team-picks">
            ${this.teamCard(0)}<div class="versus">VS<span>✦</span></div>${this.teamCard(1)}
          </div></div>
          <div class="match-options"><label for="mode">GAME MODE</label><select id="mode"><option value="exhibition">Quick match</option><option value="playoffs">Playoff overtime</option><option value="practice">Free skate</option><option value="cup">Brick Cup · best of 5</option></select><div class="match-meta" id="match-meta">3 × 2 MIN <span>•</span> PRO CPU</div><button class="subtle-button" data-action="settings">MATCH SETTINGS ↗</button></div>
          <button id="play-button" class="play-button" data-action="play"><span id="play-label">PLAY NOW</span>${ARROW}<small id="play-hint">PRESS ENTER TO DROP THE PUCK</small></button>
        </section>
        <footer class="home-footer"><span><b>2 TEAMS.</b> 40 PLAYERS. 2 RINKS.</span><span class="record-text" id="record-text">YOUR RINK. YOUR RULES.</span><span>KEYBOARD <i>+</i> GAMEPAD <i>+</i> TOUCH</span></footer>
      </main>
      <section id="hud" class="hud" aria-label="Match heads-up display" hidden>
        <div class="scorebug"><div class="score-team inferno"><span>EMBER CITY<b>INF</b></span><strong id="score-0">0</strong></div><div class="score-clock"><span id="period-label">1ST PERIOD</span><strong id="clock">20:00</strong><small id="strength">5 ON 5</small></div><div class="score-team frostbite"><strong id="score-1">0</strong><span>NORTH COAST<b>FRO</b></span></div></div>
        <div class="match-status" id="match-status"></div>
        <div class="penalty-list" id="penalties"></div>
        <div class="attack-direction" id="attack-direction">ATTACK →</div>
        <div id="toast" class="toast"><b></b><span></span></div>
        <div class="player-card"><div id="player-number" class="player-number">9</div><div class="player-info"><small id="player-position">YOU · CENTER</small><b id="player-name">JAX ROCKET</b><div class="stamina"><i id="stamina-fill"></i></div><small id="line-label">LINE 1 · TURBO READY</small></div><div class="shot-charge" id="shot-charge"><i></i><small>SHOT</small></div></div>
        <div id="p2-status" class="p2-status" hidden></div><div class="keyboard-strip" id="control-strip"></div>
        <div class="heat-card"><div class="heat-title">${BOLT}<b>HEAT METER</b><span id="heat-percent">35%</span></div><div class="heat-track"><i id="heat-fill"></i></div><div class="heat-hint" id="heat-hint">BUILD IT UP. LET IT RIP. <kbd>F</kbd></div></div>
      </section>
      <div id="phase-overlay" class="phase-overlay" hidden></div>
      <div id="modal-shell" class="modal-shell" hidden><section id="modal" class="modal" role="dialog" aria-modal="true" tabindex="-1"></section></div>
      <div id="announcer" class="sr-only" role="status" aria-live="polite"></div>`);
        const $ = (s) => root.querySelector(s);
        this.el = {
            home: $('#home'), hud: $('#hud'), overlay: $('#phase-overlay'), shell: $('#modal-shell'), modal: $('#modal'), toast: $('#toast'),
            toastTitle: $('#toast b'), toastText: $('#toast span'), status: $('#match-status'), penalties: $('#penalties'), p2: $('#p2-status'),
            stamina: $('#stamina-fill'), charge: $('#shot-charge'), chargeFill: $('#shot-charge i'), number: $('#player-number'), heatFill: $('#heat-fill'),
            heatCard: $('.heat-card'), heatHint: $('#heat-hint'), strip: $('#control-strip'), mode: $('#mode'), meta: $('#match-meta'), sound: $('[data-action="sound"]'),
            recordText: $('#record-text'), playLabel: $('#play-label'), playHint: $('#play-hint'), dockTag: $('#dock-tag'), venueName: $('#venue-name'),
            venueTag: $('#venue-tag'), venueNumber: $('#venue-number'), announcer: $('#announcer'), topbar: $('.topbar')
        };
        this.cache = new Map();
        root.addEventListener('click', e => {
            const target = e.target.closest('[data-action]');
            if (!target)
                return;
            this.action(target.dataset.action, target);
        });
        root.addEventListener('change', e => this.change(e.target));
        this.el.shell.addEventListener('click', e => {
            if (e.target === e.currentTarget)
                this.close();
        });
        this.el.modal.addEventListener('keydown', e => {
            if (e.key !== 'Tab')
                return;
            const focusable = [...this.el.modal.querySelectorAll('button, select, input, a, summary')].filter(el => !el.hasAttribute('disabled'));
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                last?.focus();
                e.preventDefault();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                first?.focus();
                e.preventDefault();
            }
        });
        this.el.mode.value = settings.mode;
        this.renderStrip();
        this.updateSettings();
    }
    teamCard(team) { const t = TEAMS[team]; return `<button class="team-pick team-${team}${this.settings.team === team ? ' selected' : ''}" data-action="team" data-team="${team}" aria-pressed="${this.settings.team === team}"><div class="team-crest">${team === 0 ? BOLT : ICE}</div><div><small>${t.city}</small><strong>${t.name}</strong><span>${t.motto}</span></div><i class="team-check">✓</i></button>`; }
    /** The venue the home screen shows and the next match uses (the Brick Cup picks its own). */
    get nextVenue() { return this.settings.mode === 'cup' ? this.cup.venue : this.settings.venue; }
    p(action) { return prompt(this.source, action); }
    setSource(source) {
        if (source === this.source)
            return;
        this.source = source;
        this.root.dataset.source = source;
        this.renderStrip();
        this.updateSettings();
        this.lastPhase = '';
        this.lastHint = '';
        if (this.modal === 'help')
            this.renderModal();
    }
    renderStrip() {
        this.root.dataset.source = this.source;
        const rows = this.source === 'gamepad'
            ? [['L-STICK', 'SKATE'], ['X', 'SHOOT'], ['A', 'PASS'], ['B', 'CHECK'], ['RT', 'TURBO'], ['START', 'MENU']]
            : [['W A S D', 'SKATE'], ['SPACE', 'SHOOT'], ['X', 'PASS'], ['C', 'CHECK'], ['SHIFT', 'TURBO']];
        this.el.strip.innerHTML = rows.map(([k, label]) => `${key(k)}<span>${label}</span>`).join('') + '<button data-action="help" aria-label="All controls">?</button>';
    }
    action(action, target) {
        switch (action) {
            case 'play':
                this.close();
                this.actions.play();
                break;
            case 'team':
                this.settings.team = Number(target?.dataset.team);
                this.updateSettings();
                this.actions.settings();
                break;
            case 'venue':
                this.actions.venue();
                break;
            case 'pause':
                if (this.game.phase !== 'attract' && this.game.phase !== 'final')
                    this.modal ? this.close() : this.open('pause');
                break;
            case 'help':
            case 'settings':
            case 'rosters':
            case 'engine':
            case 'stats':
            case 'rules':
                this.open(action);
                break;
            case 'sound':
                this.actions.sound();
                this.updateSettings();
                break;
            case 'graphics':
                this.kit.menu.open();
                break;
            case 'close':
                this.back();
                break;
            case 'resume':
                this.close();
                break;
            case 'home':
                if (this.game.phase === 'attract')
                    this.close();
                else
                    this.open('pause');
                break;
            case 'brand':
                if (this.game.phase !== 'attract' && this.game.phase !== 'final')
                    this.open('pause');
                break;
            case 'quit':
                this.open('quit');
                break;
            case 'quit-confirm':
                this.close();
                this.actions.quit();
                break;
            case 'rematch':
                this.close();
                this.actions.play();
                break;
            case 'roster-team':
                this.rosterTeam = Number(target?.dataset.team);
                this.renderModal();
                break;
            case 'goalie-swap':
                this.game.substituteGoalie(this.settings.team);
                this.renderModal();
                break;
            case 'pull-goalie':
                this.game.toggleGoalie(this.settings.team);
                this.renderModal();
                break;
            case 'line':
                this.game.changeLine(this.settings.team);
                this.renderModal();
                break;
            case 'timeout':
                this.game.timeout(this.settings.team);
                this.renderModal();
                break;
            case 'fullscreen':
                this.actions.fullscreen();
                break;
            case 'skip':
                this.actions.skip();
                break;
            case 'export':
                this.exportStats();
                break;
            case 'back-pause':
                this.open('pause');
                break;
        }
    }
    change(target) {
        if (target.id === 'mode' || target.id === 'setting-mode')
            this.settings.mode = target.value;
        if (target.id === 'period-seconds')
            this.settings.periodSeconds = Number(target.value);
        if (target.id === 'difficulty')
            this.settings.difficulty = Number(target.value);
        if (target.id === 'players')
            this.settings.players = Number(target.value);
        if (target.id === 'camera')
            this.settings.camera = target.value;
        if (target.id === 'setting-venue' && VENUES[target.value])
            this.settings.venue = target.value;
        for (const flag of ['rules', 'sound', 'music', 'shake'])
            if (target.id === 'setting-' + flag)
                this.settings[flag] = target.checked;
        this.updateSettings();
        this.actions.settings();
        if (this.modal === 'settings' && (target.id === 'setting-mode' || target.id === 'setting-venue'))
            this.refreshSettingsLocks();
    }
    /** The venue select is locked while the Brick Cup is chosen (it sets home ice). */
    refreshSettingsLocks() {
        const venue = this.el.modal.querySelector('#setting-venue'), note = this.el.modal.querySelector('#venue-note');
        const inMatch = this.game.phase !== 'attract' && this.game.phase !== 'final';
        if (venue) {
            venue.disabled = inMatch || this.settings.mode === 'cup';
            venue.value = this.nextVenue;
        }
        if (note)
            note.textContent = this.settings.mode === 'cup' ? `Brick Cup home ice: game ${this.cup.gameNumber} at ${venueOf(this.cup.venue).title}.` : '';
    }
    setText(el, value) {
        if (this.cache.get(el) !== value) {
            this.cache.set(el, value);
            el.textContent = value;
        }
    }
    updateSettings() {
        const s = this.settings, cup = this.cup;
        for (const team of [0, 1]) {
            const el = this.root.querySelector(`.team-${team}`);
            el.classList.toggle('selected', team === s.team);
            el.setAttribute('aria-pressed', String(team === s.team));
        }
        const difficulty = ['ROOKIE', 'PRO', 'ALL-STAR'][s.difficulty - 1];
        const opponents = s.players === 2 ? 'LOCAL VERSUS' : difficulty + ' CPU';
        this.el.meta.innerHTML = s.mode === 'practice' ? `FREE SKATE <span>•</span> NO CLOCK` : `${s.mode === 'cup' ? 'BEST OF 5 <span>•</span> ' : ''}3 × ${s.periodSeconds / 60} MIN <span>•</span> ${opponents}`;
        this.el.sound.classList.toggle('muted', !s.sound && !s.music);
        const cups = this.record.cups ? ` · ${this.record.cups} CUP${this.record.cups > 1 ? 'S' : ''}` : '';
        this.setText(this.el.recordText, this.record.games ? `YOUR RECORD  ${this.record.wins} W — ${this.record.losses} L${cups}` : 'YOUR RINK. YOUR RULES.');
        this.el.mode.value = s.mode;
        if (s.mode === 'cup') {
            this.setText(this.el.dockTag, cup.over || !cup.started ? 'BRICK CUP · NEW SERIES' : `BRICK CUP · GAME ${cup.gameNumber} · ${cup.line(TEAMS)}`);
            this.setText(this.el.playLabel, cup.started ? `PLAY GAME ${cup.gameNumber}` : 'START THE CUP');
        }
        else {
            this.setText(this.el.dockTag, s.mode === 'practice' ? 'NO CLOCK' : '5 ON 5');
            this.setText(this.el.playLabel, 'PLAY NOW');
        }
        this.setText(this.el.playHint, this.source === 'touch' ? 'TAP TO DROP THE PUCK' : `PRESS ${this.p('start')} TO DROP THE PUCK`);
        const venue = venueOf(this.nextVenue);
        this.setText(this.el.venueName, venue.name);
        this.setText(this.el.venueTag, s.mode === 'cup' ? `BRICK CUP HOME ICE · GAME ${cup.gameNumber}` : venue.tagline);
        this.setText(this.el.venueNumber, venue.number);
        saveSettings(s);
    }
    open(modal, push = true) {
        if (!this.modal) {
            this.wasPaused = this.game.paused;
            this.lastFocus = document.activeElement;
            this.stack = [];
        }
        else if (push && this.modal !== modal)
            this.stack.push(this.modal);
        if (modal === 'pause')
            this.stack = [];
        this.modal = modal;
        this.game.paused = this.game.phase !== 'attract';
        this.el.shell.hidden = false;
        this.renderModal();
        this.el.modal.scrollTop = 0;
        this.el.modal.focus({ preventScroll: true });
        this.actions.modal?.(true);
    }
    /** Back one screen (to the pause menu or help it came from), or close. */
    back() {
        if (this.modal && this.stack.length)
            this.open(this.stack.pop(), false);
        else
            this.close();
    }
    close() {
        if (!this.modal)
            return;
        this.modal = null;
        this.stack = [];
        this.el.shell.hidden = true;
        this.game.paused = this.wasPaused;
        if (this.lastFocus && this.lastFocus !== document.body && this.lastFocus.isConnected && !this.lastFocus.closest('[hidden]'))
            this.lastFocus.focus({ preventScroll: true });
        else
            document.activeElement?.blur?.();
        this.actions.modal?.(false);
    }
    renderModal() {
        const modal = this.el.modal, g = this.game, s = this.settings;
        const close = '<button class="modal-close" data-action="close" aria-label="Close dialog">×</button>';
        const head = (eyebrow, title, subtitle = '') => `${close}<div class="modal-eyebrow">${eyebrow}</div><h2>${title}</h2>${subtitle ? `<p class="modal-intro">${subtitle}</p>` : ''}`;
        const select = (id, label, values, value, disabled = false) => `<label class="setting-field" for="${id}"><span>${label}</span><select id="${id}" ${disabled ? 'disabled' : ''}>${values.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
        const toggle = (id, label, note, checked, disabled = false) => `<label class="toggle-row"><span><b>${label}</b><small>${note}</small></span><input type="checkbox" id="setting-${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}/><i></i></label>`;
        const inMatch = g.phase !== 'attract' && g.phase !== 'final';
        const parent = this.stack[this.stack.length - 1], backLabel = parent === 'pause' ? 'BACK TO PAUSE' : parent ? 'BACK' : null;
        modal.className = `modal modal-${this.modal}`;
        switch (this.modal) {
            case 'pause':
                modal.innerHTML = `${head('TAKE A BREATHER', 'ON ICE.', 'The clock is stopped. The next big play is yours.')}<div class="pause-score"><span class="coral">INF</span><b>${g.score[0]} — ${g.score[1]}</b><span class="cyan">FRO</span></div><button class="primary-button" data-action="resume">BACK TO THE ACTION ${ARROW}</button><div class="button-grid"><button data-action="rosters">ROSTERS & LINES</button><button data-action="stats">MATCH STATS</button><button data-action="settings">SETTINGS</button><button data-action="help">CONTROLS</button></div><button class="text-button danger" data-action="quit">END MATCH & RETURN HOME</button>`;
                break;
            case 'quit':
                modal.innerHTML = `${head('LEAVING SO SOON?', 'HANG ’EM UP?', g.settings.mode === 'cup' ? 'This game will not count. Your Brick Cup series is saved and picks up at this game.' : 'This unfinished match will not be saved to your record.')}<button class="primary-button" data-action="quit-confirm">RETURN TO THE RINK MENU</button><button class="secondary-button" data-action="resume">KEEP PLAYING</button>`;
                break;
            case 'settings': {
                const venueLocked = inMatch || s.mode === 'cup';
                modal.innerHTML = `${head('TUNE YOUR GAME', 'YOUR RINK. YOUR RULES.', inMatch ? 'Match format is locked until your next game. Presentation settings apply now.' : 'A little more chaos. A little less mercy. Make it yours.')}<div class="settings-grid">
        ${select('setting-mode', 'MATCH FORMAT', [['exhibition', 'Exhibition · OT + shootout'], ['playoffs', 'Playoffs · endless sudden death'], ['practice', 'Free skate · no clock'], ['cup', 'Brick Cup · best of five series']], s.mode, inMatch)}
        ${select('period-seconds', 'REAL-TIME PERIOD LENGTH', [['60', '1 minute · lightning round'], ['120', '2 minutes · arcade classic'], ['180', '3 minutes · extended'], ['1200', '20 minutes · regulation clock']], String(s.periodSeconds), inMatch)}
        ${select('difficulty', 'CPU DIFFICULTY', [['1', 'Rookie'], ['2', 'Pro'], ['3', 'All-star']], String(s.difficulty), inMatch)}
        ${select('players', 'PLAYERS', [['1', '1 player vs CPU'], ['2', '2 players · couch versus']], String(s.players), inMatch)}
        ${select('setting-venue', 'VENUE', Object.values(VENUES).map(v => [v.id, `${v.number} · ${v.title}`]), inMatch ? g.settings.venue : this.nextVenue, venueLocked)}
        ${select('camera', 'CAMERA', CAMERAS.map(c => [c, CAMERA_NAMES[c]]), s.camera)}
        </div><p class="fine-print venue-note" id="venue-note">${s.mode === 'cup' ? `Brick Cup home ice: game ${this.cup.gameNumber} at ${venueOf(this.cup.venue).title}.` : ''}</p><div class="toggle-list">${toggle('rules', 'NHL-style gameplay rules', 'Offside, icing, penalties, power plays and faceoffs. Turn off for no-whistle arcade play.', s.rules, inMatch)}${toggle('sound', 'Arena sound', 'Synthesized hits, whistles, goal horns, crowd and shot effects.', s.sound)}${toggle('music', 'Arcade soundtrack', 'An original, locally synthesized 132 BPM soundtrack.', s.music)}${toggle('shake', 'Impact effects', 'Screen shake on heavy hits and goals.', s.shake)}</div><div class="modal-bottom"><button class="secondary-button" data-action="graphics">GRAPHICS & DISPLAY ↗</button><button class="secondary-button" data-action="fullscreen">FULLSCREEN ↗</button><button class="primary-button" data-action="close">${backLabel ?? 'LOOKS GOOD'} ${ARROW}</button></div><p class="fine-print">Match clocks display 20:00 per period; shorter selections accelerate the game clock and penalty timers together. Graphics quality, resolution, touch controls and vibration live under Graphics & display (F9).</p>`;
                break;
            }
            case 'help': {
                const rows = [['Skate', 'W A S D / ARROWS', 'Left stick / D-pad', 'Stick (left side)'], ['Shoot · hold to charge / faceoff', 'SPACE', 'X', 'SHOOT'], ['Pass / poke check', 'X', 'A', 'PASS'], ['Body check', 'C', 'B', 'HIT'], ['Deke / evade', 'Z', 'Y', 'DEKE'], ['Turbo (hold)', 'SHIFT', 'RT', 'TURBO'], ['Switch skater', 'TAB', 'LT', 'SWAP'], ['Heatseeker shot', 'F', 'RB', 'HEAT'], ['Change lines', 'L', 'LB', 'LINES'], ['Pull / return goalie', 'G', 'R3 (stick click)', 'Pause · Rosters'], ['Camera view', 'V', 'View / Back', 'Settings'], ['Pause', 'ESC / P', 'Start', 'II (top right)'], ['Menus', 'TAB · ENTER · ESC', 'D-pad · A · B', 'Tap']];
                const col = { keyboard: 2, gamepad: 3, touch: 4 }[this.source] ?? 2;
                modal.innerHTML = `${head('THE PLAYBOOK', 'SMALL BLOCKS. BIG MOVES.', 'Skate with momentum. Pass into space. Hold your shot, pick a corner, and let it rip.')}<div class="control-table" data-col="${col}"><div><b>THE MOVE</b><b>KEYBOARD</b><b>GAMEPAD</b><b>TOUCH</b></div>${rows.map(r => `<div><span>${r[0]}</span>${key(r[1])}<span>${r[2]}</span><span>${r[3]}</span></div>`).join('')}</div><div class="tips-grid"><article><b>01 / OWN THE DRAW</b><p>Tap ${this.p('shoot')} when the countdown reaches “DROP!” The closer your timing, the better your faceoff.</p></article><article><b>02 / TURN UP THE HEAT</b><p>Shots, passes, saves and clean hits fill the meter. At 100%, press ${this.p('heat')} for a flaming Heatseeker.</p></article><article><b>03 / KEEP IT CLEAN-ISH</b><p>Hit the puck carrier, not a bystander. Hits from behind at the boards and reckless turbo charges draw penalties.</p></article></div><details><summary>Player 2 controls, couch versus & the Brick Cup</summary><p>Player 2 uses arrow keys, Enter to shoot, / to pass, . to check, , to deke, right Shift for turbo, \\ to switch, ; for Heatseeker, ] for lines, and [ for the goalie, or a second gamepad with the same layout. Player 1 controls the selected team; player 2 controls the opponent. In a one-player match both keyboard layouts drive your skater.</p><p>The Brick Cup is a best-of-five series against the other club. Games 1, 2 and 5 are at the Brickyard, games 3 and 4 outdoors at Frostbite Pond. The series is saved between visits: pick Brick Cup and press Play to continue.</p></details><div class="modal-bottom"><button class="secondary-button" data-action="rules">RULES & MATCH FLOW</button><button class="primary-button" data-action="close">${backLabel ?? 'GOT IT'} ${ARROW}</button></div>`;
                break;
            }
            case 'rules':
                modal.innerHTML = `${head('KNOW THE WHISTLE', 'CHAOS HAS RULES.', 'The game implements a broad arcade adaptation, not every clause of the official NHL rulebook.')}<div class="rules-copy">
        <h3>The match</h3><p>Three periods, five skaters and one goalie per side. Ends switch each period. Exhibition and Brick Cup ties go to five game-clock minutes of 3-on-3 sudden-death overtime, then a three-round shootout with paired sudden-death rounds. Playoff ties use repeat 20-minute 5-on-5 overtime periods. Free skate has no running match clock.</p>
        <h3>Blue lines & long clears</h3><p>Teammates cannot enter the attacking zone before the puck. A delayed offside clears when everybody tags up. Untouched clears from behind center may be called icing using a defender-versus-attacker race estimate. Short-handed clears are exempt. The icing team cannot change lines before the next faceoff.</p>
        <h3>Penalty box</h3><p>Interference, tripping, goalie interference, charging, boarding and shooting directly out from the defensive zone can trigger penalties. Clear breakaways denied from behind receive a penalty shot. A delayed call waits for the offending side to touch the puck. Minor penalties end on a power-play goal; majors do not. No team drops below three skaters. Penalties carry across periods.</p>
        <h3>Bench management</h3><p>Each team dresses 12 forwards, six defensemen and two goalies. Cycle four forward lines and three defense pairs. Tired skaters are slower and recover on the bench. Pull the goalie for an extra attacker. One timeout per team at a stoppage restores energy; no timeout for the icing team. Change goalies from the paused roster screen.</p>
        <h3>The Brick Cup</h3><p>First to three wins lifts the cup. Home ice runs 2-2-1: the Brickyard hosts games 1, 2 and 5, Frostbite Pond hosts games 3 and 4. Unfinished games do not count, and the series is saved between visits.</p>
        <h3>Arcade boundaries</h3><p>Checks, dekes and shots use deliberate arcade abstractions. Hybrid-icing races, bench substitutions and goalie positioning are simplified. Hand passes, kicked-in goals, high-stick puck contacts, broken sticks, fighting, injuries, coach challenges, officiating discretion and administrative/equipment rulebook clauses are not simulated. Shootout goal totals do not alter individual regulation statistics.</p></div><button class="primary-button" data-action="close">${backLabel ?? 'BACK TO HOCKEY'} ${ARROW}</button>`;
                break;
            case 'rosters': {
                const t = TEAMS[this.rosterTeam];
                modal.innerHTML = `${head('MEET YOUR HEAVY HITTERS', 'THE LINEUP.', 'Two complete 20-player game rosters. All original characters.')}<div class="roster-tabs">${TEAMS.map(team => `<button class="${this.rosterTeam === team.id ? 'active' : ''} team-text-${team.id}" data-action="roster-team" data-team="${team.id}">${team.id === 0 ? BOLT : ICE}${team.name}</button>`).join('')}</div><div class="roster-summary"><b>${t.city}</b><span>12 FORWARDS / 6 DEFENSE / 2 GOALIES</span></div><div class="roster-scroll"><table class="roster-table"><thead><tr><th># / PLAYER</th><th>POS</th><th>SPD</th><th>SHOT</th><th>HIT</th><th>SKILL</th><th>STATUS</th></tr></thead><tbody>${t.roster.map(p => { const skater = g.players[p.id], status = g.box.unavailable(p.id) ? 'BOX' : skater.active && g.phase !== 'attract' ? 'ON ICE' : 'BENCH'; return `<tr><td><b class="jersey-num">${p.number}</b><span><b>${p.name}</b><small>${p.style}</small></span></td><td>${p.position}</td><td>${p.speed}</td><td>${p.shot}</td><td>${p.check}</td><td>${p.skill}</td><td><span class="roster-status ${status === 'ON ICE' ? 'on-ice' : ''}">${status}</span></td></tr>`; }).join('')}</tbody></table></div>${inMatch ? `<div class="bench-actions"><button class="secondary-button" data-action="line">CYCLE LINE · ${g.line[s.team] + 1}</button><button class="secondary-button" data-action="goalie-swap">SWAP GOALIE</button><button class="secondary-button" data-action="pull-goalie" ${['live', 'faceoff', 'stoppage'].includes(g.phase) ? '' : 'disabled'}>${g.goaliePulled[s.team] ? 'GOALIE BACK IN' : 'PULL GOALIE'}</button><button class="secondary-button" data-action="timeout" ${g.timeoutUsed[s.team] || !['faceoff', 'stoppage', 'intermission'].includes(g.phase) || g.icingLock === s.team ? 'disabled' : ''}>${g.timeoutUsed[s.team] ? 'TIMEOUT USED' : 'TAKE TIMEOUT'}</button></div>` : ''}${backLabel ? `<button class="primary-button roster-back" data-action="close">${backLabel} ${ARROW}</button>` : ''}<p class="fine-print">Original teams and fictional players. Not an NHL-licensed product.</p>`;
                break;
            }
            case 'stats':
                modal.innerHTML = `${head('BY THE NUMBERS', 'THE BOX SCORE.')}<div class="pause-score"><span class="coral">INF</span><b>${g.score[0]} — ${g.score[1]}</b><span class="cyan">FRO</span></div>${this.statsTable()}<h3 class="section-title">PLAY-BY-PLAY</h3><div class="game-log">${g.log.length ? g.log.map(e => `<div><time>P${e.period} · ${timeLabel(e.clock)}</time><span><b>${safe(e.text)}</b><small>${safe(e.detail)}</small></span></div>`).join('') : '<p>The story starts at puck drop.</p>'}</div><div class="modal-bottom"><button class="secondary-button" data-action="export">EXPORT MATCH JSON ↓</button><button class="primary-button" data-action="close">${backLabel ?? 'BACK'} ${ARROW}</button></div>`;
                break;
            case 'engine': {
                const kit = this.kit, tier = kit.tier.name;
                modal.innerHTML = `${head('UNDER THE HELMET', 'BUILT DIFFERENT.', 'Original procedural art. Real match logic. No external art or audio assets.')}<div class="engine-live"><i></i><b>${safe(kit.backendLabel)}</b><span>Rapier puck physics</span></div><p class="engine-note">Rendering with three.js r186 on ${safe(kit.backendLabel)} at ${safe(tier)} quality. Browsers without WebGPU run the same scene on WebGL 2. Change quality, resolution, touch controls and vibration under Graphics & display (F9).</p><div class="version-grid"><div>THREE.JS<strong>r186</strong></div><div>RAPIER<strong>0.20.0</strong></div><div>BACKEND<strong>${safe(kit.backendLabel)}</strong></div><div>QUALITY<strong>${safe(tier.toUpperCase())}</strong></div></div><p class="modal-intro">Every brick is generated in code: the skaters, both arenas, the rink markings, the scoreboard and the 132 BPM soundtrack. The arena is one merged mesh and everything that moves is one instanced batch, so the whole match draws in a handful of calls.</p><div class="modal-bottom"><button class="secondary-button" data-action="graphics">GRAPHICS & DISPLAY ↗</button><button class="primary-button" data-action="close">BACK TO THE RINK ${ARROW}</button></div>`;
                break;
            }
            default: modal.innerHTML = head('SLAPSHOT', 'BRICK LEAGUE.');
        }
    }
    statsTable() {
        const g = this.game, total = g.stats[0].possession + g.stats[1].possession;
        const rows = [['Shots on goal', g.stats[0].shots, g.stats[1].shots], ['Saves', g.stats[0].saves, g.stats[1].saves], ['Hits', g.stats[0].hits, g.stats[1].hits], ['Faceoffs won', g.stats[0].faceoffs, g.stats[1].faceoffs], ['Passes attempted', g.stats[0].passes, g.stats[1].passes], ['Penalty minutes', g.stats[0].penaltyMinutes, g.stats[1].penaltyMinutes], ['Possession', (total ? Math.round(g.stats[0].possession / total * 100) : 50) + '%', (total ? Math.round(g.stats[1].possession / total * 100) : 50) + '%']];
        return `<div class="stat-comparison">${rows.map(r => `<div><b>${r[1]}</b><span>${r[0]}</span><b>${r[2]}</b></div>`).join('')}</div>`;
    }
    exportStats() {
        const g = this.game;
        const json = JSON.stringify({ game: 'Slapshot: Brick League', version: '1.1.0', createdAt: new Date().toISOString(), settings: g.settings, score: g.score, phase: g.phase, period: g.period, clock: g.clock, teamStats: g.stats, shootout: g.shootout, players: g.players.map(p => ({ name: p.data.name, team: TEAMS[p.team].name, number: p.data.number, goals: p.goals, assists: p.assists, shots: p.shots })), playByPlay: g.log }, null, 2);
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })), a = document.createElement('a');
        a.href = url;
        a.download = 'slapshot-match.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    /** Count a finished match in the saved record (one-player, clocked modes only). */
    recordResult(cupClinched = false) {
        const s = this.game.settings;
        if (s.mode === 'practice' || s.players === 2)
            return;
        this.record.games++;
        this.record.goals += this.game.score[s.team];
        if (this.game.winningTeam === s.team)
            this.record.wins++;
        else
            this.record.losses++;
        if (cupClinched && this.game.winningTeam === s.team)
            this.record.cups = (this.record.cups || 0) + 1;
        try {
            localStorage.setItem('slapshot.record.v1', JSON.stringify(this.record));
        }
        catch { /* storage may be unavailable */ }
        this.updateSettings();
    }
    announce(text) { this.el.announcer.textContent = text; }
    update() {
        const g = this.game, home = g.phase === 'attract', team = this.settings.team, el = this.el;
        this.root.classList.toggle('in-match', !home);
        this.root.classList.toggle('on-home', home);
        this.root.classList.toggle('replay-mode', g.phase === 'replay');
        el.home.hidden = !home;
        el.hud.hidden = home;
        const set = (id, value) => this.setText(this.root.querySelector(id), value);
        set('#score-0', String(g.score[0]));
        set('#score-1', String(g.score[1]));
        set('#clock', g.settings.mode === 'practice' && !home ? '∞' : timeLabel(g.clock));
        set('#period-label', g.phase.startsWith('duel') || g.phase === 'shootout-intro' ? (g.duelIsShootout ? 'SHOOTOUT' : 'PENALTY SHOT') : g.overtime ? `OT${g.period > 4 ? ' ' + (g.period - 3) : ''} · SUDDEN DEATH` : ['1ST PERIOD', '2ND PERIOD', '3RD PERIOD'][g.period - 1]);
        const counts = g.counts;
        set('#strength', `${counts[0]} ON ${counts[1]}${g.goaliePulled.some(Boolean) ? ' · EMPTY NET' : ''}`);
        let statusText = g.delayed ? `DELAYED PENALTY • ${TEAMS[g.delayed.team].abbr}` : g.rules.offside.some(Boolean) ? `DELAYED OFFSIDE • ${TEAMS[g.rules.offside[0] ? 0 : 1].abbr} TAG UP` : counts[0] !== counts[1] ? `${TEAMS[counts[0] > counts[1] ? 0 : 1].abbr} POWER PLAY` : !g.settings.rules ? 'NO-WHISTLE ARCADE' : `${venueOf(g.settings.venue).name} • NHL-STYLE RULES`;
        if (g.settings.mode === 'cup' && !g.delayed && counts[0] === counts[1] && !g.rules.offside.some(Boolean))
            statusText = `BRICK CUP • GAME ${this.cup.gameNumber} • ${this.cup.line(TEAMS)}`;
        if (g.phase === 'duel')
            statusText = `${TEAMS[g.duelTeam].abbr} ATTEMPT • ${Math.ceil(g.phaseTimer)}s • NO REBOUNDS`;
        this.setText(el.status, statusText);
        el.status.classList.toggle('special', !!g.delayed || counts[0] !== counts[1] || g.rules.offside.some(Boolean));
        const portrait = portraitView(this.kit.size.width, this.kit.size.height);
        set('#attack-direction', `${g.settings.players === 2 ? 'P1 · ' : ''}${g.dir(team) > 0 ? (portrait ? 'ATTACK ↓' : 'ATTACK →') : (portrait ? '↑ ATTACK' : '← ATTACK')}`);
        el.p2.hidden = g.settings.players !== 2;
        if (!el.p2.hidden) {
            const p2 = g.players[g.selected[other(team)]];
            this.setText(el.p2, `P2 · #${p2.data.number} ${p2.data.name.toUpperCase()} · ${Math.floor(g.heat[other(team)])}% HEAT · ${Math.floor(p2.energy)}% ENERGY`);
        }
        const selected = g.players[g.selected[team]];
        if (selected) {
            set('#player-number', String(selected.data.number));
            set('#player-name', selected.data.name.toUpperCase());
            set('#player-position', `YOU · ${selected.data.position} · ${TEAMS[team].abbr}`);
            set('#line-label', `LINE ${g.line[team] + 1} · ${selected.energy < 15 ? `TIRED · ${this.source === 'touch' ? 'TAP LINES' : 'PRESS ' + this.p('line')} TO CHANGE` : selected.turbo ? 'TURBO!' : 'TURBO READY'}`);
            this.style(el.stamina, 'width', `${Math.round(selected.energy)}%`);
            this.style(el.chargeFill, 'height', `${Math.round(selected.charge * 100)}%`);
            el.charge.classList.toggle('charging', selected.charge > .01);
            this.style(el.number, 'background', TEAMS[team].color);
        }
        set('#heat-percent', `${Math.floor(g.heat[team])}%`);
        this.style(el.heatFill, 'width', `${Math.floor(g.heat[team])}%`);
        const ready = g.heat[team] >= 100;
        el.heatCard.classList.toggle('heat-ready', ready);
        const hint = `${ready ? 'HEATSEEKER READY!' : 'BUILD IT UP. LET IT RIP.'} ${key(this.p('heat'))}`;
        if (hint !== this.lastHint) {
            this.lastHint = hint;
            el.heatHint.innerHTML = hint;
        }
        const penaltyHTML = g.box.penalties.map(p => `<div class="penalty-chip team-text-${p.team}"><b>${TEAMS[p.team].abbr} #${playerById(p.player).number}</b><span>${p.kind === 'game-misconduct' ? 'EJECTED' : p.active ? timeLabel(p.remaining + (p.segments - 1) * 120) : 'QUEUED'}</span><small>${safe(p.reason)}</small></div>`).join('');
        if (penaltyHTML !== this.lastPenalty) {
            el.penalties.innerHTML = penaltyHTML;
            this.lastPenalty = penaltyHTML;
        }
        el.toast.hidden = home || g.bannerTime <= 0 || !['live', 'duel'].includes(g.phase);
        if (!el.toast.hidden) {
            this.setText(el.toastTitle, g.banner);
            this.setText(el.toastText, g.detail);
        }
        this.renderPhase();
    }
    style(el, prop, value) {
        const k = prop + '@';
        if (el[k] !== value) {
            el[k] = value;
            el.style[prop] = value;
        }
    }
    renderPhase() {
        const g = this.game, overlay = this.el.overlay;
        const phaseKey = `${g.phase}:${g.phase === 'faceoff' ? Math.max(0, Math.ceil(g.phaseTimer - .3)) : ''}:${g.phase === 'intermission' ? Math.ceil(g.phaseTimer) : ''}:${g.phase === 'duel-result' ? g.duelResult : ''}:${this.source}`;
        if (phaseKey === this.lastPhase)
            return;
        this.lastPhase = phaseKey;
        overlay.hidden = ['attract', 'live', 'duel'].includes(g.phase);
        overlay.className = `phase-overlay phase-${g.phase}`;
        let text = '';
        if (g.phase === 'faceoff') {
            const count = g.phaseTimer <= .3 ? 'DROP!' : String(Math.max(1, Math.ceil(g.phaseTimer - .3)));
            text = `<div class="faceoff-banner"><small>${safe(g.banner)}</small><b>${count}</b><span>${key(this.p('shoot'))} TIME YOUR DRAW</span></div>`;
        }
        else if (g.phase === 'stoppage')
            text = `<div class="whistle-banner"><span>THE WHISTLE</span><b>${safe(g.banner)}</b><small>${safe(g.detail)}</small></div>`;
        else if (g.phase === 'goal')
            text = `<div class="goal-banner"><span>LIGHT. THE. LAMP.</span><b>GOOOAL!</b><small>${safe(g.detail)}</small></div>`;
        else if (g.phase === 'replay')
            text = `<div class="replay-label"><i></i> INSTANT REPLAY <span>LAST PLAY</span></div><button class="skip-button" data-action="skip">SKIP REPLAY ${this.source === 'touch' ? '' : key(this.p('skip'))}</button>`;
        else if (g.phase === 'intermission')
            text = `<div class="intermission-card"><small>${g.overtime ? 'KEEP IT GOING' : 'END OF PERIOD ' + g.period}</small><h2>${safe(g.banner)}</h2><div class="pause-score"><span class="coral">INF</span><b>${g.score[0]} — ${g.score[1]}</b><span class="cyan">FRO</span></div><p>${safe(g.detail)}</p><button class="primary-button" data-action="skip">START NEXT PERIOD ${ARROW}</button><small>AUTO RESUMES IN ${Math.ceil(g.phaseTimer)}</small></div>`;
        else if (g.phase === 'shootout-intro' || g.phase === 'duel-result')
            text = `<div class="whistle-banner"><span>${g.duelIsShootout ? 'ALL EYES ON YOU' : 'ONE ON ONE'}</span><b>${safe(g.banner)}</b><small>${safe(g.detail)}</small><div class="shootout-dots">${TEAMS.map(team => `<span>${team.abbr} ${g.shootout[team.id].map(v => v ? '●' : '○').join(' ')}</span>`).join('')}</div>${g.phase === 'shootout-intro' ? `<button class="skip-button" data-action="skip">BEGIN ${this.source === 'touch' ? '→' : key(this.p('skip'))}</button>` : ''}</div>`;
        else if (g.phase === 'final')
            text = this.finalCard();
        overlay.innerHTML = text;
    }
    finalCard() {
        const g = this.game, winner = g.winningTeam ?? 0, cupMode = g.settings.mode === 'cup', cup = this.cup;
        const mvp = [...g.players].filter(p => p.team === winner && !p.goalie).sort((a, b) => (b.goals * 3 + b.assists + b.shots * .01) - (a.goals * 3 + a.assists + a.shots * .01))[0];
        const clinched = cupMode && cup.over;
        let cupLine = '';
        if (cupMode)
            cupLine = clinched
                ? `<div class="cup-line champion">${CUP}<span><b>BRICK CUP CHAMPIONS</b>${safe(cup.line(TEAMS))}</span></div>`
                : `<div class="cup-line">${CUP}<span><b>BRICK CUP · ${safe(cup.line(TEAMS))}</b>NEXT: GAME ${cup.gameNumber} AT ${venueOf(cup.venue).name}</span></div>`;
        const primary = cupMode ? (clinched ? 'START A NEW CUP' : `PLAY GAME ${cup.gameNumber}`) : 'RUN IT BACK';
        return `<div class="final-card${clinched ? ' cup-final' : ''}"><small>THE FINAL HORN</small><div class="final-crest team-text-${winner}">${clinched ? CUP : winner === 0 ? BOLT : ICE}</div><h2>${TEAMS[winner].name}<br><span>${clinched ? 'LIFTS THE CUP.' : 'TAKES THE W.'}</span></h2><div class="final-score"><b class="coral">${g.score[0]}</b><span>FINAL${g.shootout[0].length ? ' / SO' : g.overtime ? ' / OT' : ''}</span><b class="cyan">${g.score[1]}</b></div>${cupLine}<p>FIRST STAR <strong>#${mvp.data.number} ${mvp.data.name.toUpperCase()}</strong><span>${mvp.goals} G · ${mvp.assists} A</span></p><button class="primary-button" data-action="rematch">${primary} ${ARROW}</button><div class="button-grid"><button data-action="stats">BOX SCORE</button><button data-action="quit-confirm">BACK TO THE RINK</button></div></div>`;
    }
}
