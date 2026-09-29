import * as THREE from 'three/webgpu';
import { BIOMES, PALETTE, LANDMARKS, CAIRNS, PRESETS, WORLD, VERSION, SPECIES, FLORA_TOTAL, FAUNA_TOTAL } from './config.js';
import { COMMISSIONS, evaluate } from './commissions.js';
import { prompt } from './controls.js';

const $ = id => document.getElementById(id);
const distance = m => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
const clock = t => `${String(Math.floor(t) % 24).padStart(2, '0')}:${String(Math.floor(t % 1 * 60)).padStart(2, '0')}`;
const coords = (x, z) => `${Math.abs(Math.round(x))} ${x < 0 ? 'W' : 'E'} / ${Math.abs(Math.round(z))} ${z < 0 ? 'N' : 'S'}`;
const duration = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
/** Write text only when it changed (no DOM churn every frame). */
const text = (el, value) => { if (el._v !== value) { el._v = value; el.textContent = value; } };
const isField = el => !!el && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));
const FOCUSABLE = 'button:not([disabled]), input:not([type=hidden]):not([hidden]), select, summary';
const _v = new THREE.Vector3();

const GUIDE = {
  move: [['Move', 'move'], ['Look', 'look'], ['Sprint', 'sprint'], ['Jump / swim up', 'jump'], ['Crouch / dive', 'crouch'], ['Slide', 'slide'], ['Focus view', 'aim']],
  survey: [['Survey pulse', 'pulse'], ['Record target (hold)', 'record'], ['Place beacon', 'beacon'], ['Flashlight', 'light'], ['World map', 'map'], ['Field journal', 'journal'], ['Pause', 'pause']]
};

export class UISystem {
  constructor(game) {
    this.game = game; this.kit = game.kit; this.panel = null; this.returnTo = null; this.filter = 'all'; this.uiTimer = 0; this.bannerTimer = null; this.navKey = ''; this.navRepeat = 0; this.navFocus = null; this.recordShown = null; this.wasLocked = false; this.pendingResults = false;
    this.canvas = game.kit.canvas; this.canvas.inert = true;
    this.kit.touch?.suspend(true, 'game'); // no on-screen controls on the title screen
    this.panels = ['pause', 'map', 'journal', 'settings', 'guide', 'dev', 'results']; this.markerNodes = [];
    for (let i = 0; i < 14; i++) { const e = document.createElement('div'); e.className = 'survey-marker hidden'; e.innerHTML = '<span>◇</span><small></small>'; $('survey-markers').append(e); this.markerNodes.push(e); }
    this.el = {};
    for (const id of ['clock', 'weather-label', 'region-name', 'map-region', 'coordinates', 'altitude', 'record-count', 'region-count', 'movement-state', 'speed', 'motion-meter', 'bearing-text', 'compass-clock', 'target-card', 'target-type', 'target-name', 'target-detail', 'scan-label', 'scan-fill', 'pulse-ready', 'map-loading', 'dev-stats', 'waypoint-marker', 'waypoint-distance', 'load-progress', 'load-label', 'enter-world', 'enter-label']) this.el[id] = $(id);
    this.setupCompass(); this.setupMap(); this.setupEvents(); this.syncSettings(); this.updateJournal(); this.updatePrompts(game.input.source);
    if (game.hasSave) { $('new-expedition-start').classList.remove('hidden'); $('new-sep').classList.remove('hidden'); }
    const bus = game.bus;
    bus.on('notice', m => this.toast(m));
    bus.on('pause', () => { if (game.started && !this.panel) this.open('pause'); });
    bus.on('region', name => this.showRegion(name));
    bus.on('record', ({ record, newSpecies }) => {
      this.toast(newSpecies ? `New species recorded: ${record.name}.` : `${record.name} recorded.`);
      game.audio.tone(950, 0.18, 0.35); if (newSpecies) game.audio.tone(1270, 0.22, 0.25, 'sine', 0.13);
      game.input.rumble(newSpecies ? 0.45 : 0.25, 90);
    });
    bus.on('pulse', () => game.audio.tone(500, 0.35, 0.22));
    bus.on('surveychange', () => { this.updateJournal(); game.save(false); });
    bus.on('commission', c => this.toast(`Commission complete: ${c.title}. ${c.reward}`, 6500));
    bus.on('expeditioncomplete', () => { if (game.started) setTimeout(() => { if (game.running) this.open('results'); else this.pendingResults = true; }, 1600); else this.pendingResults = true; });
    bus.on('preset', () => this.syncSettings());
    game.input.onSourceChange(src => this.updatePrompts(src));
    this.kit.onResize(() => { this.compassWidth = $('compass').clientWidth || 370; });
  }
  on(id, handler) { $(id).addEventListener('click', handler); }
  setupEvents() {
    const g = this.game;
    this.on('enter-world', () => this.enter()); this.on('resume', () => this.close());
    for (const [id, panel] of [['start-settings', 'settings'], ['start-guide', 'guide'], ['open-map', 'map'], ['journal-button', 'journal'], ['pause-button', 'pause']]) this.on(id, () => this.open(panel));
    for (const [id, panel] of [['pause-settings', 'settings'], ['pause-guide', 'guide'], ['pause-map', 'map'], ['pause-journal', 'journal'], ['pause-dev', 'dev'], ['pause-report', 'results']]) this.on(id, () => this.open(panel, 'pause'));
    for (const e of document.querySelectorAll('[data-close]')) e.addEventListener('click', () => this.back());
    this.on('pulse-button', () => { if (g.running) g.survey.pulse(g.player); }); this.on('beacon-button', () => { if (g.running) g.survey.addBeacon(g.player.position.x, g.player.position.z); });
    this.on('save-button', () => g.save(true));
    this.on('rest-button', () => this.rest());
    this.on('return-station', () => { g.player.fly = false; $('dev-fly').checked = false; g.player.teleport(WORLD.spawn.x, WORLD.spawn.z); g.terrain.plan(g.player.position, g.rendering.preset.distance, true); this.close(); this.toast('Returned to the field station.'); });
    this.on('center-map', () => g.map.centerPlayer()); this.on('zoom-in', () => g.map.zoom(1 / 1.3)); this.on('zoom-out', () => g.map.zoom(1.3)); this.on('clear-waypoint', () => { g.survey.waypoint = null; this.toast('Waypoint cleared.'); });
    this.on('kit-settings', () => this.kit.menu.open());
    $('fov').addEventListener('input', e => { g.settings.fov = Number(e.target.value); $('fov-value').textContent = `${g.settings.fov}°`; });
    for (const [id, key] of [['head-bob', 'headBob'], ['sound', 'sound']]) $(id).addEventListener('change', e => { g.settings[key] = e.target.checked; });
    this.on('export-save', () => g.storage.download(g.serialize(), 'verdant-expedition.json')); this.on('import-save', () => $('save-file').click());
    $('save-file').addEventListener('change', async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 2000000) throw new Error('The save file is too large.'); const data = g.storage.validate(JSON.parse(await file.text())); if (!g.storage.write(data, true)) throw new Error('Device storage is not available.'); g.resetting = true; location.reload(); } catch (error) { this.toast(`Could not import save. ${error.message}`); } finally { e.target.value = ''; } });
    this.confirmButton('new-expedition', 'Start a new expedition', 'Press again to erase this expedition', () => g.reset());
    this.confirmButton('new-expedition-start', 'New expedition', 'Press again to erase your saved expedition', () => g.reset());
    this.confirmButton('results-new', 'Start a new expedition', 'Press again to erase this expedition', () => g.reset());
    this.on('results-continue', () => this.back());
    for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => { this.filter = button.dataset.filter; for (const b of document.querySelectorAll('[data-filter]')) b.classList.toggle('active', b === button); this.updateJournal(); });
    this.on('export-survey', () => { const header = ['name', 'category', 'east_m', 'north_m', 'height_m', 'region', 'slope_deg', 'game_time', 'recorded_at'], rows = g.survey.records.map(r => [r.name, r.category, r.x, -r.z, r.height, BIOMES[r.biome] || '', r.slope || 0, Number.isFinite(r.hour) ? clock(r.hour) : '', r.time || '']); const escape = v => '"' + String(v).replaceAll('"', '""') + '"'; g.storage.download([header, ...rows].map(row => row.map(escape).join(',')).join('\r\n'), 'verdant-survey.csv', 'text/csv;charset=utf-8'); });
    $('dev-fly').addEventListener('change', e => { g.player.fly = e.target.checked; g.player.velocity.set(0, 0, 0); });
    $('dev-wire').addEventListener('change', e => { g.terrain.material.wireframe = e.target.checked; });
    $('dev-fauna').addEventListener('change', e => { g.dev.freezeWildlife = e.target.checked; });
    $('dev-fog').addEventListener('change', e => { g.settings.fog = e.target.checked; g.rendering.updateLighting(true); });
    $('dev-time').addEventListener('input', e => { g.settings.time = Number(e.target.value); $('dev-time-value').textContent = clock(g.settings.time); g.rendering.envBucket = -1; g.rendering.lastEnvironmentUpdate = -100; });
    $('dev-day').addEventListener('input', e => { g.settings.daySpeed = Number(e.target.value); $('dev-day-value').textContent = g.settings.daySpeed.toFixed(2); });
    $('dev-speed').addEventListener('input', e => { g.player.devSpeed = Number(e.target.value); $('dev-speed-value').textContent = `${g.player.devSpeed} m/s`; });
    this.on('dev-teleport', () => { const place = LANDMARKS.find(l => l.id === $('dev-location').value); if (!place) return; g.player.teleport(place.x + 4, place.z + 4); g.terrain.plan(g.player.position, g.rendering.preset.distance, true); g.map.centerPlayer(); this.toast(`Moved to ${place.name}.`); });
    this.on('dev-report', () => g.storage.download(g.diagnostics(), 'verdant-diagnostics.json'));
    this.on('disable-dev', () => { g.dev.enabled = false; g.player.fly = false; g.player.velocity.set(0, 0, 0); g.terrain.material.wireframe = false; g.dev.freezeWildlife = false; $('dev-fly').checked = $('dev-wire').checked = $('dev-fauna').checked = false; this.close(); });
    this.on('reload', () => { g.save(false); location.reload(); });
    this.on('recover-balanced', () => { window.__kitSettings?.set({ quality: 'low' }); g.save(false); location.reload(); });
    // Escape inside a slider or menu is left alone by the kit (it never steals keys from form fields); close the panel here.
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.panel && isField(e.target)) { e.preventDefault(); e.target.blur(); this.back(); } });
    // Mouse look: a click on the world captures the pointer (drag-to-look works without it).
    this.canvas.addEventListener('click', () => { if (g.running) this.lockPointer(); });
    // Losing pointer lock (the browser's own Escape) pauses, like the original.
    document.addEventListener('pointerlockchange', () => { const locked = document.pointerLockElement === this.canvas; if (!locked && this.wasLocked && g.running) this.open('pause'); this.wasLocked = locked; });
  }
  /** A destructive button that needs a second press within four seconds. */
  confirmButton(id, label, confirmLabel, action) {
    const b = $(id); if (!b) return; let armedUntil = 0;
    b.addEventListener('click', () => {
      if (performance.now() < armedUntil) { action(); return; }
      armedUntil = performance.now() + 4000; b.textContent = confirmLabel; b.classList.add('armed');
      setTimeout(() => { if (performance.now() >= armedUntil) { b.textContent = label; b.classList.remove('armed'); } }, 4100);
    });
  }
  setupCompass() {
    this.ticks = []; const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let degree = 0; degree < 360; degree += 15) { const node = document.createElement('div'); node.className = 'compass-tick' + (degree % 45 === 0 ? ' major' : ''); if (degree % 45 === 0) { const label = document.createElement('span'); label.textContent = cardinals[degree / 45]; node.append(label); } $('compass-ticks').append(node); this.ticks.push({ degree, node, left: '' }); }
    this.compassWidth = $('compass').clientWidth || 370;
  }
  setupMap() {
    for (const mark of LANDMARKS) {
      const b = document.createElement('button'); b.className = 'landmark-button'; b.dataset.landmark = mark.id; const label = document.createElement('strong'); label.style.fontWeight = '400'; label.textContent = mark.name; const type = document.createElement('span'); type.textContent = '↗'; b.append(label, type);
      b.addEventListener('click', () => { this.game.map.center = { x: mark.x, z: mark.z }; this.game.map.span = 4500; this.game.survey.setWaypoint(mark.x, mark.z, mark.name); }); $('landmark-list').append(b);
      const option = document.createElement('option'); option.value = mark.id; option.textContent = mark.name; $('dev-location').append(option);
    }
    BIOMES.forEach((name, i) => { const e = document.createElement('div'); e.className = 'legend-item'; const swatch = document.createElement('i'); swatch.style.background = PALETTE[i]; e.append(swatch, document.createTextNode(name)); $('biome-legend').append(e); });
  }
  updatePrompts(source) {
    for (const el of document.querySelectorAll('[data-prompt]')) text(el, prompt(el.dataset.prompt, source));
    text($('input-label'), source === 'gamepad' ? 'GAMEPAD' : source === 'touch' ? 'TOUCH' : 'KEYBOARD + MOUSE');
    for (const [id, list] of [['guide-move', GUIDE.move], ['guide-survey', GUIDE.survey]]) {
      const dl = $(id); dl.replaceChildren();
      for (const [label, action] of list) { const dt = document.createElement('dt'); dt.textContent = label; const dd = document.createElement('dd'); const k = document.createElement('kbd'); k.textContent = prompt(action, source); dd.append(k); dl.append(dt, dd); }
    }
    this.game.map.showCenter = source === 'gamepad';
  }
  enter() {
    const g = this.game; if (!g.terrain.ready || this.panel) return; g.started = true; g.running = true; g.audio.start(); $('start-screen').classList.add('hidden'); $('hud').classList.remove('hidden'); g.player.applyCamera(0.2); this.canvas.inert = false; $('hud').inert = false; this.capture();
    this.compassWidth = $('compass').clientWidth || 370;
    this.toast(`Use ${prompt('pulse', g.input.source)} to find specimens. Hold ${prompt('record', g.input.source)} to record a target.`);
    if (!g.survey.completed.size) this.toast('Field commissions are listed in your journal. Each one unlocks new equipment.');
    if (this.pendingResults) { this.pendingResults = false; setTimeout(() => { if (g.running) this.open('results'); }, 1800); }
  }
  /** Hand control back to the world after a menu. */
  capture() {
    const g = this.game; g.input.settle(); g.player.clearIntent(); this.kit.touch?.suspend(false, 'game');
    this.lockPointer();
    this.canvas.focus({ preventScroll: true });
  }
  /**
   * Mouse-look capture. Only asked for inside a user gesture (a click or a key other than
   * Escape), and every refusal is caught: browsers refuse a new lock for about a second
   * after the player pressed Escape to leave one.
   */
  lockPointer() {
    const c = this.canvas;
    if (this.game.input.source !== 'keyboard' || document.pointerLockElement === c || !c.requestPointerLock) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    const quiet = () => {};
    try { const p = c.requestPointerLock({ unadjustedMovement: true }); p?.catch?.(() => { try { c.requestPointerLock()?.catch?.(quiet); } catch { /* not allowed here */ } }); } catch { /* not allowed here */ }
  }
  open(name, from = null) {
    const g = this.game; if (!this.panel) this.returnFocus = document.activeElement; this.returnTo = from;
    g.running = false; g.input.unlockPointer(); g.audio.pause(); g.player.clearIntent(); this.panel = name;
    $('hud').inert = true; this.canvas.inert = true; $('start-screen').inert = true;
    for (const p of this.panels) $(p + '-panel').classList.toggle('hidden', p !== name);
    document.body.classList.add('in-menu'); document.body.classList.toggle('map-open', name === 'map'); g.map.open = name === 'map';
    if (name === 'map') { g.map.centerPlayer(); g.map.span = Math.min(10000, g.map.span); this.updateLandmarkList(); }
    if (name === 'pause') this.updateRest();
    if (name === 'journal') this.updateJournal(); if (name === 'settings') this.syncSettings(); if (name === 'results') this.updateResults();
    if (name === 'dev') { g.dev.enabled = true; $('dev-time').value = g.settings.time; $('dev-time-value').textContent = clock(g.settings.time); $('dev-day').value = g.settings.daySpeed; $('dev-day-value').textContent = g.settings.daySpeed.toFixed(2); $('dev-fog').checked = g.settings.fog; }
    if (g.started) g.save(false);
    this.kit.touch?.suspend(true, 'game'); g.input.settle();
    requestAnimationFrame(() => { if (this.panel === name) { const first = this.focusables($(name + '-panel'))[0]; if (first) this.focusItem(first, g.input.source === 'gamepad'); } });
  }
  close() {
    const g = this.game; this.panel = null; this.returnTo = null; for (const p of this.panels) $(p + '-panel').classList.add('hidden'); document.body.classList.remove('in-menu', 'map-open'); g.map.open = false; this.clearNavFocus();
    $('start-screen').inert = false; $('hud').inert = false; this.canvas.inert = !g.started;
    if (g.started) { g.running = true; g.audio.start(); this.capture(); } else { g.input.settle(); this.returnFocus?.focus({ preventScroll: true }); }
    g.save(false);
    if (g.started && this.pendingResults) { this.pendingResults = false; setTimeout(() => { if (g.running) this.open('results'); else this.pendingResults = true; }, 900); }
  }
  /** Where the player can rest: the field station or any cairn already reached. */
  restSite() {
    const p = this.game.player.position, s = this.game.survey;
    if (Math.hypot(p.x - WORLD.spawn.x, p.z - WORLD.spawn.z) < 40) return 'the field station';
    for (const c of CAIRNS) if (s.landmarks.has(c.id) && Math.hypot(p.x - c.x, p.z - c.z) < 40) return c.name;
    return null;
  }
  updateRest() {
    const b = $('rest-button'), t = this.game.settings.time, day = t >= 5 && t < 19.5, site = this.game.started ? this.restSite() : null;
    b.disabled = !site; b.textContent = site ? (day ? `Rest at ${site} until nightfall` : `Rest at ${site} until morning`) : 'Rest (at the field station or a reached cairn)';
  }
  /** Skip to 20:30 or 06:00. Night brings the owls and the night-watch commission. */
  rest() {
    const g = this.game, site = this.restSite(); if (!site) return;
    const t = g.settings.time, day = t >= 5 && t < 19.5; g.settings.time = day ? 20.5 : 6;
    g.rendering.envBucket = -1; g.rendering.lastEnvironmentUpdate = -100; g.rendering.updateLighting(true);
    this.close(); setTimeout(() => g.audio.fanfare(), 200); this.toast(day ? 'You rest until nightfall. Owls hunt in the pine forest after dark.' : 'You rest until morning.');
  }
  /** Back out of a panel: to the pause menu it was opened from, or to the game. */
  back() { if (this.returnTo && this.returnTo !== this.panel) this.open(this.returnTo); else this.close(); }

  // ----- menus with a gamepad or the keyboard ------------------------------------------------
  focusables(root) { return [...root.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null && !el.closest('.hidden') && el.id !== 'save-file'); }
  focusItem(el, mark = true) {
    this.clearNavFocus(); el.focus({ preventScroll: true }); el.scrollIntoView?.({ block: 'nearest' });
    if (mark) { el.classList.add('nav-focus'); this.navFocus = el; }
  }
  clearNavFocus() { this.navFocus?.classList.remove('nav-focus'); this.navFocus = null; }
  navStep(root, x, y) {
    const items = this.focusables(root); if (!items.length) return;
    let index = items.indexOf(document.activeElement);
    const current = items[index];
    if (x && current) {
      if (current.type === 'range') { const step = Number(current.step) || 1; current.value = String(Math.min(Number(current.max), Math.max(Number(current.min), Number(current.value) + x * step * (Number(current.max) - Number(current.min) > 20 ? 1 : 2)))); current.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (current.tagName === 'SELECT') { current.selectedIndex = (current.selectedIndex + x + current.options.length) % current.options.length; current.dispatchEvent(new Event('change', { bubbles: true })); return; }
    }
    const delta = y ? -y : x;
    index = index < 0 ? 0 : (index + delta + items.length) % items.length;
    this.focusItem(items[index]);
  }
  activate(root) {
    const el = document.activeElement;
    if (!el || el === document.body || !root.contains(el)) { const first = this.focusables(root)[0]; if (first) this.focusItem(first); return; }
    if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); return; }
    if (el.type === 'range') return;
    el.click();
  }
  /** Tab walks a panel's controls (the kit keeps the Tab key for the journal action). Shift goes back. */
  tabFocus(root) {
    const items = this.focusables(root); if (!items.length) return;
    const i = items.indexOf(document.activeElement), d = this.game.input.down('sprint') ? -1 : 1;
    this.focusItem(items[i < 0 ? 0 : (i + d + items.length) % items.length]);
  }
  navigate(dt) {
    const g = this.game, input = g.input, root = this.panel ? $(this.panel + '-panel') : $('start-screen');
    if (this.panel) {
      if (input.pressed('pause') || (input.pressed('crouch') && input.source === 'gamepad')) { this.back(); return; }
      if (input.pressed('map') && this.panel === 'map') { this.close(); return; }
      if (input.pressed('dev') && this.panel === 'dev') { this.close(); return; }
      if (input.pressed('journal')) { if (this.panel === 'journal') this.back(); else this.tabFocus(root); return; }
      if (this.panel === 'map') {
        const mv = input.vector('move'); if (mv.x || mv.y) g.map.pan(mv.x, -mv.y, dt);
        if (input.down('pulse')) g.map.zoom(1 - Math.min(0.5, dt * 1.6)); if (input.down('aim')) g.map.zoom(1 + Math.min(0.5, dt * 1.6));
        if (input.source === 'gamepad') { if (input.pressed('jump')) g.map.waypointAtCenter(); if (input.pressed('record')) g.map.centerPlayer(); if (input.pressed('beacon')) { g.survey.waypoint = null; this.toast('Waypoint cleared.'); } }
        return;
      }
    } else if (g.started) return;
    else if (input.pressed('journal')) { this.tabFocus(root); return; }
    const mv = input.vector('move');
    const y = Math.abs(mv.y) > 0.55 ? Math.sign(mv.y) : 0, x = !y && Math.abs(mv.x) > 0.55 ? Math.sign(mv.x) : 0, key = y ? `y${y}` : x ? `x${x}` : '';
    if (key !== this.navKey) { this.navKey = key; this.navRepeat = 0.38; if (key) this.navStep(root, x, y); }
    else if (key) { this.navRepeat -= dt; if (this.navRepeat <= 0) { this.navRepeat = 0.11; this.navStep(root, x, y); } }
    if (input.pressed('jump') && input.source !== 'touch') this.activate(root);
  }
  /** In-world actions that open panels or use tools. */
  worldActions() {
    const g = this.game, input = g.input;
    if (input.pressed('pause')) { this.open('pause'); return; }
    if (input.pressed('map')) { this.open('map'); return; }
    if (input.pressed('journal')) { this.open('journal'); return; }
    if (input.pressed('dev')) { this.open('dev'); return; }
    if (input.pressed('pulse')) g.survey.pulse(g.player);
    if (input.pressed('beacon')) g.survey.addBeacon(g.player.position.x, g.player.position.z);
    if (input.pressed('light')) { g.rendering.setFlashlight(!g.rendering.flashEnabled); g.audio.tone(g.rendering.flashEnabled ? 880 : 520, 0.05, 0.12); this.toast(`Flashlight ${g.rendering.flashEnabled ? 'on' : 'off'}.`); }
    if (input.pressed('fly') && g.dev.enabled) { g.player.fly = !g.player.fly; g.player.velocity.set(0, 0, 0); $('dev-fly').checked = g.player.fly; this.toast(`Flight ${g.player.fly ? 'on' : 'off'}.`); }
  }

  syncSettings() {
    const s = this.game.settings, tier = this.kit.tier, p = PRESETS[tier.name] || PRESETS.high;
    $('fov').value = s.fov; $('fov-value').textContent = `${s.fov}°`; $('head-bob').checked = s.headBob; $('sound').checked = s.sound;
    $('quality-summary').textContent = `${p.label} tier (${this.kit.backendLabel}) · ${p.distance / 1000} km draw distance · ${p.cascades} shadow cascades · ${this.kit.shadowSize(2048)} px shadows · ${this.game.rendering.aoWanted(tier) ? 'GTAO + bloom' : 'bloom'}`;
    $('save-status').textContent = this.game.storage.available ? 'Saves and survey records stay on this device.' : 'Device storage is not available. Export your save to keep it.';
  }
  updateLandmarkList() { for (const b of document.querySelectorAll('[data-landmark]')) b.querySelector('span').textContent = this.game.survey.landmarks.has(b.dataset.landmark) ? '✓' : '↗'; }
  updateJournal() {
    const survey = this.game.survey, c = survey.counts, objectives = [['Regions', c.regions, 7], ['Plant species', c.flora, FLORA_TOTAL], ['Animal species', c.fauna, FAUNA_TOTAL], ['Landmarks', survey.landmarks.size, CAIRNS.length]]; $('survey-objectives').replaceChildren();
    for (const [name, value, goal] of objectives) { const node = document.createElement('div'); node.className = 'objective'; node.innerHTML = '<span></span><strong></strong><div class="objective-track"><i></i></div>'; node.children[0].textContent = name; node.children[1].append(document.createTextNode(String(value))); const small = document.createElement('small'); small.textContent = ` / ${goal}`; node.children[1].append(small); node.querySelector('i').style.width = `${Math.min(100, value / goal * 100)}%`; $('survey-objectives').append(node); }
    // Commissions and their rewards.
    const results = evaluate(survey); $('commission-count').textContent = `${results.filter(r => r.done).length} / ${COMMISSIONS.length} complete · Highest point ${Math.round(survey.maxAltitude)} m`;
    $('commission-list').replaceChildren(...results.map(r => this.commissionRow(r)));
    // Species catalogue: found species by name, the rest as a habitat hint.
    const found = new Set(survey.records.map(r => r.name)); let foundCount = 0;
    const cards = SPECIES.map(sp => { const has = found.has(sp.name); if (has) foundCount++; const card = document.createElement('div'); card.className = 'species' + (has ? ' found' : ''); const name = document.createElement('strong'); name.textContent = has ? sp.name : `Unknown ${sp.category === 'flora' ? 'plant' : 'animal'}`; const where = document.createElement('small'); where.textContent = sp.habitat; card.append(name, where); return card; });
    $('species-list').replaceChildren(...cards); $('species-count').textContent = `${foundCount} / ${SPECIES.length}`;
    const list = $('journal-records'); list.replaceChildren(); const records = survey.records.filter(r => this.filter === 'all' || r.category === this.filter).slice().reverse();
    if (!records.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = '<strong>No observations yet.</strong><p></p>'; empty.querySelector('p').textContent = `Use ${prompt('pulse', this.game.input.source)} to find specimens. Look at a target and hold ${prompt('record', this.game.input.source)} to record it.`; list.append(empty); }
    for (const r of records.slice(0, 300)) { const row = document.createElement('div'); row.className = 'record-row'; row.innerHTML = '<div><strong></strong><small></small></div><div><span></span><small></small></div><div><span></span><small></small></div>'; row.children[0].children[0].textContent = r.name; row.children[0].children[1].textContent = r.category.toUpperCase() + (Number.isFinite(r.hour) ? ` · ${clock(r.hour)}` : ''); row.children[1].children[0].textContent = BIOMES[r.biome] || 'Unknown'; row.children[1].children[1].textContent = `${r.height} m ASL`; row.children[2].children[0].textContent = coords(r.x, r.z); row.children[2].children[1].textContent = r.category === 'terrain' ? `${r.slope || 0}° slope` : 'Observation logged'; list.append(row); }
    $('beacon-count').textContent = `${survey.beacons.length} / ${survey.beaconLimit} placed`; $('beacon-list').replaceChildren();
    for (let i = 0; i < survey.beacons.length; i++) { const b = survey.beacons[i], row = document.createElement('div'); row.className = 'beacon-row'; const label = document.createElement('strong'); label.textContent = `Beacon ${i + 1}`; const position = document.createElement('span'); position.textContent = coords(b.x, b.z); const go = document.createElement('button'); go.textContent = 'Set waypoint'; go.addEventListener('click', () => survey.setWaypoint(b.x, b.z, `Beacon ${i + 1}`)); const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.addEventListener('click', () => survey.removeBeacon(b.id)); row.append(label, position, go, remove); $('beacon-list').append(row); }
  }
  commissionRow({ commission: c, value, done }) {
    const row = document.createElement('div'); row.className = 'commission' + (done ? ' done' : '');
    const head = document.createElement('div'); const title = document.createElement('strong'); title.textContent = (done ? '✓ ' : '') + c.title; const what = document.createElement('small'); what.textContent = c.text; head.append(title, what);
    const bar = document.createElement('div'); bar.className = 'commission-progress'; const count = document.createElement('span'); const shown = Math.min(value, c.goal); count.textContent = c.unit ? `${Math.round(shown).toLocaleString()} / ${c.goal.toLocaleString()} ${c.unit}` : `${shown} / ${c.goal}`; const track = document.createElement('div'); track.className = 'objective-track'; const fill = document.createElement('i'); fill.style.width = `${Math.min(100, value / c.goal * 100)}%`; track.append(fill); bar.append(count, track);
    const reward = document.createElement('small'); reward.className = 'reward'; reward.textContent = (done ? 'Unlocked · ' : 'Reward · ') + c.reward;
    row.append(head, bar, reward); return row;
  }
  updateResults() {
    const g = this.game, s = g.survey, c = s.counts, results = evaluate(s), done = results.filter(r => r.done).length;
    $('results-title').textContent = s.finished ? 'Frontier charted.' : 'Expedition report.';
    $('results-lede').textContent = s.finished ? 'Every field commission is complete. The frontier is yours to keep exploring, or you can start a fresh expedition from the station.' : `${done} of ${COMMISSIONS.length} field commissions complete. Keep surveying to finish the expedition.`;
    const stats = [['Observations', c.total], ['Plant species', `${c.flora} / ${FLORA_TOTAL}`], ['Animal species', `${c.fauna} / ${FAUNA_TOTAL}`], ['Regions', `${c.regions} / 7`], ['Landmarks', `${s.landmarks.size} / ${CAIRNS.length}`], ['Highest point', `${Math.round(s.maxAltitude)} m`], ['Distance walked', distance(g.player.distance)], ['Time in the field', duration(g.playTime)]];
    $('results-stats').replaceChildren(...stats.map(([label, value]) => { const d = document.createElement('div'); d.className = 'objective'; const l = document.createElement('span'); l.textContent = label; const v = document.createElement('strong'); v.textContent = String(value); d.append(l, v); return d; }));
    $('results-commissions').replaceChildren(...results.map(r => this.commissionRow(r)));
    $('results-continue').firstChild.textContent = g.started ? 'Keep exploring ' : 'Back ';
  }
  toast(message, ms = 3800) { const e = document.createElement('div'); e.className = 'toast'; e.textContent = message; $('notifications').append(e); while ($('notifications').children.length > 3) $('notifications').firstElementChild.remove(); setTimeout(() => e.classList.add('out'), ms); setTimeout(() => e.remove(), ms + 350); }
  showRegion(name) { if (!this.game.started) return; clearTimeout(this.bannerTimer); $('region-banner').classList.remove('hidden'); $('region-banner').querySelector('strong').textContent = name; this.bannerTimer = setTimeout(() => $('region-banner').classList.add('hidden'), 4300); }
  project(x, y, z) { _v.set(x, y, z).project(this.game.rendering.camera); return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight, visible: _v.z > -1 && _v.z < 1 && Math.abs(_v.x) < 0.95 && Math.abs(_v.y) < 0.9 }; }
  updateMarkers() {
    const g = this.game, pulsing = g.survey.pulseTime > 0;
    for (let i = 0; i < this.markerNodes.length; i++) {
      const node = this.markerNodes[i], e = pulsing ? g.survey.revealed[i] : null;
      if (!e) { if (!node._hidden) { node._hidden = true; node.classList.add('hidden'); } continue; }
      const p = this.project(e.x, e.height + 2, e.z); node._hidden = !p.visible; node.classList.toggle('hidden', !p.visible);
      if (p.visible) { node.style.left = `${p.x}px`; node.style.top = `${p.y}px`; text(node.lastChild, distance(Math.hypot(e.x - g.player.position.x, e.z - g.player.position.z))); }
    }
    const wp = g.survey.waypoint;
    if (wp) { const p = this.project(wp.x, Math.max(g.terrain.height(wp.x, wp.z), WORLD.water) + 8, wp.z); this.el['waypoint-marker'].classList.toggle('hidden', !p.visible); if (p.visible) { this.el['waypoint-marker'].style.left = `${p.x}px`; this.el['waypoint-marker'].style.top = `${p.y}px`; text(this.el['waypoint-distance'], distance(Math.hypot(wp.x - g.player.position.x, wp.z - g.player.position.z))); } }
    else this.el['waypoint-marker'].classList.add('hidden');
  }
  update(dt) {
    const g = this.game, el = this.el;
    if (g.running) this.worldActions(); else this.navigate(dt);
    if (!g.started) {
      const progress = Math.max(0.08, g.terrain.progress); el['load-progress'].style.width = `${Math.round(progress * 100)}%`;
      if (g.terrain.ready) {
        if (el['enter-world'].disabled) {
          el['enter-world'].disabled = false;
          // Ready: put focus on the start button so Space, Enter or A begins right away.
          if (!this.panel && (!document.activeElement || document.activeElement === document.body)) this.focusItem(el['enter-world'], g.input.source === 'gamepad');
        }
        text(el['enter-label'], g.hasSave ? 'Continue expedition' : 'Enter expedition'); text(el['load-label'], g.terrain.progress > 0.99 ? 'World ready' : 'World ready · Distant terrain is loading'); }
      else text(el['load-label'], `Building terrain · ${g.terrain.chunks.size} sectors ready`);
    }
    if (g.started) this.updateMarkers();
    // Touch: the Record button only shows while a target can be recorded.
    const recordable = g.running && !!g.survey.target && !g.survey.recordIds.has(g.survey.target.id);
    if (recordable !== this.recordShown) { this.recordShown = recordable; this.kit.touch?.setShown('record', recordable); }
    this.uiTimer += dt; if (this.uiTimer < 0.1) return; this.uiTimer = 0;
    const p = g.player.position, b = g.terrain.kernel.biome(p.x, p.z, g.terrain.height(p.x, p.z)), heading = (-g.player.yaw * 180 / Math.PI % 360 + 360) % 360, cards = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const time = clock(g.settings.time); text(el.clock, time); text(el['compass-clock'], ` · ${time}`); text(el['weather-label'], BIOMES[b].toUpperCase()); text(el['region-name'], BIOMES[b]); text(el['map-region'], BIOMES[b].toUpperCase()); text(el.coordinates, coords(p.x, p.z)); text(el.altitude, `${Math.round(p.y)} m ASL`); text(el['record-count'], String(g.survey.records.length)); text(el['region-count'], `${g.survey.visited.size} / 7`); text(el['movement-state'], g.player.status.toUpperCase()); text(el.speed, `${g.player.speed.toFixed(1)} m/s`); el['motion-meter'].style.width = `${Math.min(100, g.player.speed / 15 * 100).toFixed(0)}%`;
    text(el['bearing-text'], `${String(Math.round(heading) % 360).padStart(3, '0')}° ${cards[Math.round(heading / 45) % 8]}`);
    const width = this.compassWidth; for (const t of this.ticks) { const delta = ((t.degree - heading + 540) % 360) - 180, left = `${(width / 2 + delta * 2.7).toFixed(1)}px`; if (t.left !== left) { t.left = left; t.node.style.left = left; } }
    const target = g.survey.target; el['target-card'].classList.toggle('hidden', !target || !g.running);
    if (target) { const recorded = g.survey.recordIds.has(target.id); text(el['target-type'], target.category.toUpperCase()); text(el['target-name'], target.name); text(el['target-detail'], `${distance(target.distance)} · ${Math.round(target.height)} m ASL`); text(el['scan-label'], recorded ? 'Recorded' : g.survey.progress > 0 ? 'Recording…' : 'Hold to record'); el['scan-fill'].style.width = `${Math.round(g.survey.progress * 100)}%`; }
    el['pulse-ready'].style.transform = `scaleX(${(1 - g.survey.pulseCooldown / g.survey.pulseRecharge).toFixed(3)})`; el['map-loading'].classList.toggle('hidden', g.map.atlasReady);
    el['dev-stats'].classList.toggle('hidden', !g.dev.enabled);
    if (g.dev.enabled) { const info = g.kit.renderer.info; text(el['dev-stats'], `VERDANT ${VERSION} / DEVELOPER\n${g.fps.toFixed(0)} FPS  ·  ${(1000 / Math.max(1, g.fps)).toFixed(1)} ms/frame  ·  ${g.kit.backendLabel}\nDraw calls: ${info.render.calls}  ·  Triangles: ${Math.round(info.render.triangles / 1000)}k\nTerrain: ${g.terrain.chunks.size}  ·  Queue: ${g.terrain.queue.length}\nNature cells: ${g.nature.cells.size}  ·  Wildlife: ${g.wildlife.animals.length}\nGeometry: ${info.memory.geometries}  ·  Textures: ${info.memory.textures}\nXYZ: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\n${g.player.fly ? 'FLIGHT' : 'GROUND'}  ·  Seed ${WORLD.seed}  ·  ${g.rendering.preset.distance / 1000} km view  ·  ${this.kit.tier.name}`); }
  }
}
