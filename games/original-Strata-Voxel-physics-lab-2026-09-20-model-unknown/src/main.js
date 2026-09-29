import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { MOUSE_LOOK } from 'kit/input.js';
import { VoxelWorld } from './voxel/world.js';
import { raycastVoxels } from './voxel/raycast.js';
import { carveSphere, removeFragment } from './voxel/edit.js';
import { MAT, PALETTE } from './voxel/palette.js';
import { VOXEL_SIZE, PROFILES, LIMITS, requestedProfile, profileForTier } from './engine/config.js';
import { FixedStepClock } from './engine/clock.js';
import { WorkerClient } from './engine/worker-client.js';
import { ChunkRenderer } from './engine/chunks.js';
import { PhysicsEngine } from './engine/physics.js';
import { Viewport } from './engine/renderer.js';
import { voxelMaterial } from './engine/materials.js';
import { OrbitCamera } from './engine/camera.js';
import { LabAudio } from './engine/audio.js';
import { DustBursts } from './engine/dust.js';
import { LampHunt, formatTime } from './engine/challenge.js';
import { prepareFragment } from './workers/jobs.js';
import { randomSeed } from './scene/garden.js';
import { AREAS, initialArea, createAreaAsync } from './scene/areas.js';
import { loadSettings, saveSettings, normaliseSetting, profileDefaults } from './engine/settings.js';
import { mountGraphicsPanel } from './ui/graphics-panel.js';
import { PadNav } from './ui/pad-nav.js';

const $ = selector => document.querySelector(selector);
const format = n => new Intl.NumberFormat('en', { notation: n > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
const TOOLS = ['orbit', 'break', 'add', 'push', 'launch'];
const LAB_KEY = 'strata:lab:v1';
const RADII = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

/** Every input goes through kit.input actions: keyboard and mouse, gamepad, touch. */
const ACTIONS = {
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' }, // orbit the view
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick' }, // pan across the ground; menu navigation
  turn: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] } }, // keyboard orbit
  panDrag: { mouse: [1, 2], keys: ['ShiftLeft', 'ShiftRight'] }, // held: a drag pans instead of orbiting
  tapMouse: { mouse: [0] },
  use: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A', 'RT'] }, // apply the tool at the reticle; confirm in menus
  drop: { keys: ['Space'], gamepad: ['X'] },
  panel: { keys: ['KeyI'], gamepad: ['Y'] },
  back: { gamepad: ['B'] },
  zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
  navUp: { gamepad: ['Up'] }, navDown: { gamepad: ['Down'] }, navLeft: { gamepad: ['Left'] }, navRight: { gamepad: ['Right'] },
  radiusUp: { keys: ['BracketRight'] }, radiusDown: { keys: ['BracketLeft'] },
  tool1: { keys: ['Digit1', 'Numpad1'] }, tool2: { keys: ['Digit2', 'Numpad2'] }, tool3: { keys: ['Digit3', 'Numpad3'] },
  tool4: { keys: ['Digit4', 'Numpad4'] }, tool5: { keys: ['Digit5', 'Numpad5'] },
  freeze: { keys: ['KeyF'], gamepad: ['Back'] },
  reset: { keys: ['KeyR'] },
  home: { keys: ['KeyH', 'Home'], gamepad: ['RS'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
};

const TOOL_HELP = {
  keyboard: { orbit: 'Drag to orbit · right-drag or Shift-drag to pan · scroll to zoom · click a surface to look there.',
    break: 'Click stone to break it · [ and ] change the radius · drag to orbit.', add: 'Click a fixed surface to add limestone.',
    push: 'Click a loose piece to push it.', launch: 'Click to launch a copper slug at that point.' },
  touch: { orbit: 'Drag to orbit · pinch to zoom · tap a surface to look there.', break: 'Tap stone to break it · drag to orbit.',
    add: 'Tap a fixed surface to add limestone.', push: 'Tap a loose piece to push it.', launch: 'Tap to launch a copper slug at that point.' },
  gamepad: { orbit: 'Ⓐ look at the reticle · left stick pans · right stick orbits · LB / RB zoom.',
    break: 'Ⓐ break at the reticle · D-pad ▲▼ radius · ◀▶ tools.', add: 'Ⓐ add limestone at the reticle · D-pad ◀▶ tools.',
    push: 'Ⓐ push the piece at the reticle · D-pad ◀▶ tools.', launch: 'Ⓐ launch a slug at the reticle · Ⓧ drop a block.' },
};
const HELP = {
  keyboard: ['Keyboard & mouse', [['Orbit', 'Drag · Q / E'], ['Pan', 'Right-drag or Shift-drag · WASD / arrows'], ['Zoom', 'Scroll · + / −'],
    ['Use the tool', 'Click (Enter uses the screen centre)'], ['Tools', '1 – 5'], ['Break radius', '[ / ]'], ['Drop a copper block', 'Space'],
    ['Freeze physics', 'F'], ['Reset area', 'R'], ['Reset camera', 'H'], ['Lab panel', 'I'], ['Menu', 'Esc / P'], ['Display & controls', 'F9']]],
  gamepad: ['Controller', [['Orbit', 'Right stick'], ['Pan', 'Left stick'], ['Zoom', 'LB / RB'], ['Use the tool at the reticle', 'A or RT'],
    ['Tools', 'D-pad ◀ ▶'], ['Break radius', 'D-pad ▲ ▼'], ['Drop a copper block', 'X'], ['Lab panel', 'Y (B leaves it)'],
    ['Freeze physics', 'View / Back'], ['Reset camera', 'Right-stick click'], ['Menu', 'Start']]],
  touch: ['Touch', [['Orbit', 'Drag one finger'], ['Zoom', 'Pinch'], ['Use the tool', 'Tap'], ['Look somewhere', 'Tap it with Orbit selected'],
    ['Tools and drop', 'The dock at the bottom'], ['Lab panel', 'The sliders button, top right'], ['Menu', 'The pause button, top right']]],
};

const _ndc = new THREE.Vector2(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _matrix = new THREE.Matrix4(), _one = new THREE.Vector3(1, 1, 1), _box = new THREE.Box3(), _box2 = new THREE.Box3(), _box3 = new THREE.Box3();

function loadLab(storage) {
  try { return JSON.parse(storage?.getItem(LAB_KEY) || 'null') || {}; } catch { return {}; }
}

class StrataEngine {
  constructor(kit) {
    this.kit = kit;
    try { this.storage = localStorage; } catch { this.storage = null; }
    this.preferences = loadSettings(this.storage);
    const lab = loadLab(this.storage);
    const urlArea = new URLSearchParams(location.search).get('area');
    this.area = Object.hasOwn(AREAS, urlArea) ? urlArea : Object.hasOwn(AREAS, lab.area) ? lab.area : initialArea();
    this.profile = requestedProfile() || this.preferences.profile || profileForTier(kit.tier.name);
    this.layout = null; this.worker = new WorkerClient(); this.world = new VoxelWorld();
    this.clock = new FixedStepClock(); this.busy = true; this.paused = false; this.stopped = false; this.areaLoading = false;
    this.tool = TOOLS.includes(lab.tool) ? lab.tool : 'orbit';
    this.radius = RADII.includes(lab.radius) ? lab.radius : 0.625;
    this.autoDamage = lab.autoDamage !== false;
    this.maxBodies = Number.isFinite(lab.maxBodies) ? Math.min(1024, Math.max(16, Math.round(lab.maxBodies / 16) * 16)) : LIMITS.maxBodies;
    this.debrisSeconds = Number.isFinite(lab.debrisSeconds) ? Math.min(180, Math.max(0, Math.round(lab.debrisSeconds / 5) * 5)) : LIMITS.debrisSeconds;
    this.lastHit = null; this.random = randomSeed(321);
    this.frameTimes = new Float32Array(240); this.frameIndex = 0; this.frameFilled = 0;
    this.frameCount = 0; this.fps = 0; this.physicsMs = 0; this.editMs = 0; this.lastStats = 0; this.lastHover = 0; this.lastLaunch = 0;
    this.abort = new AbortController(); this.changedShadows = true;
    this.mode = 'play'; this.press = null; this.pendingArea = null; this.texts = new Map(); this.saveTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.audio = new LabAudio(this.storage);
    this.hunt = new LampHunt(this.storage);
    this.nav = new PadNav(kit.input);
  }
  async init() {
    const kit = this.kit;
    kit.loading.progress(0.62, 'Prepare lighting…');
    this.view = Viewport.create(kit, this.profile, this.preferences.graphics[this.profile]);
    this.material = voxelMaterial(this.view.materialUniforms);
    this.physics = new PhysicsEngine(kit.RAPIER, this.view.scene, this.material, this.maxBodies);
    this.physics.debrisSeconds = this.debrisSeconds;
    this.orbit = new OrbitCamera(this.view.camera);
    this.dust = new DustBursts(this.view.scene, kit.detail(160, 48));
    this.cursor = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicNodeMaterial({ color: 0xdb9b53, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false }));
    this.cursor.visible = false; this.view.scene.add(this.cursor);
    this.bind();
    await this.loadArea(this.area, (fraction, text) => kit.loading.progress(0.64 + fraction * 0.32, text));
    kit.loading.progress(0.97, 'Compile materials…');
    try { await kit.renderer.compileAsync(this.view.scene, this.view.camera); } catch (error) { console.warn('Pipeline pre-compile skipped:', error); }
    this.busy = false;
    $('#backend').textContent = this.view.backend;
    $('#quality').value = this.profile;
    $('#worker-status').textContent = this.worker.worker ? 'Worker' : 'Main-thread fallback';
    this.setTool(this.tool, true); this.setStatus('Ready', 'ready'); this.updateStats(); this.updateSource();
    this.lastStats = performance.now();
    kit.onPause(paused => this.audio.setPaused(paused));
    kit.input.onSourceChange(() => this.updateSource());
    kit.onQuality(tier => {
      if (!requestedProfile() && !this.preferences.profileChosen && profileForTier(tier.name) !== this.profile) this.setProfile(profileForTier(tier.name), false);
      this.graphicsPanel?.sync(); this.changedShadows = true;
    });
    kit.start(dt => this.frame(dt));
    // A small explicit debug API makes automated browser checks possible.
    window.strata = { engine: this, stats: () => this.report(), impact: point => this.breakAt(point, this.radius),
      drop: () => this.drop(), launch: () => this.useAt(0, 0, 'launch'), reset: () => this.reset(), pause: value => this.setPaused(value),
      setArea: id => this.switchArea(id), setProfile: name => this.setProfile(name), setTool: tool => this.setTool(tool),
      setGraphics: patch => this.setGraphics(patch), overview: () => this.goTo(-1), menu: open => (open === false ? this.closeMenu() : this.openMenu()) };
  }

  // ---------------------------------------------------------------- HUD helpers
  setText(selector, text) {
    if (this.texts.get(selector) === text) return;
    this.texts.set(selector, text);
    const el = $(selector); if (el) el.textContent = text;
  }
  loading(text, percent) { $('#loading-text').textContent = text; $('#load-bar').style.width = `${percent}%`; }
  setStatus(text, state = 'ready') { this.setText('#status-text', text); $('#status-dot').dataset.state = state; }
  readyStatus() { this.setStatus(this.paused ? 'Physics frozen' : 'Ready', this.paused ? 'paused' : 'ready'); }
  setTool(tool, quiet = false) {
    if (!TOOLS.includes(tool)) return;
    const changed = tool !== this.tool;
    this.tool = tool; this.cursor.visible = false;
    document.querySelectorAll('[data-tool]').forEach(button => {
      const active = button.dataset.tool === tool; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
    });
    this.updateHelpLine();
    if (changed && !quiet) { this.audio.click(); this.saveLab(); }
  }
  get source() { return this.kit.input.source === 'gamepad' ? 'gamepad' : this.kit.input.source === 'touch' ? 'touch' : 'keyboard'; }
  updateHelpLine() { this.setText('#interaction-help', TOOL_HELP[this.source][this.tool]); }
  updateSource() {
    const source = this.source;
    document.documentElement.dataset.input = source;
    $('#reticle').hidden = source !== 'gamepad';
    this.updateHelpLine();
    if (this.mode === 'menu') this.renderHelp();
  }
  renderHelp() {
    const [device, rows] = HELP[this.source];
    $('#help-device').textContent = device;
    const list = $('#help-list'); list.replaceChildren();
    for (const [what, how] of rows) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = what; dd.textContent = how; list.append(dt, dd);
    }
  }
  setRadius(radius, announce = false) {
    this.radius = radius; $('#radius').value = radius; $('#radius-value').textContent = `${radius.toFixed(3)} m`;
    if (this.cursor.visible) this.cursor.scale.setScalar(radius);
    if (announce) { this.setStatus(`Break radius ${radius.toFixed(3)} m`, 'ready'); this.audio.click(); }
    this.saveLab();
  }
  saveLab() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        this.storage?.setItem(LAB_KEY, JSON.stringify({ area: this.area, tool: this.tool, radius: this.radius, autoDamage: this.autoDamage,
          maxBodies: this.physics?.maxBodies ?? this.maxBodies, debrisSeconds: this.physics?.debrisSeconds ?? this.debrisSeconds }));
      } catch { /* private mode: this session only */ }
    }, 300);
  }
  setPaused(value) {
    this.paused = !!value; this.clock.accumulator = 0;
    $('#pause').textContent = this.paused ? 'Resume' : 'Freeze'; $('#pause').setAttribute('aria-pressed', String(this.paused));
    this.readyStatus();
  }

  // ---------------------------------------------------------------- panels and menus
  get smallScreen() { return matchMedia('(max-width: 800px)').matches; }
  inspectorShown() { const el = $('#inspector'); return this.smallScreen ? el.classList.contains('open') : !el.classList.contains('collapsed'); }
  showInspector(show) {
    const el = $('#inspector');
    if (this.smallScreen) el.classList.toggle('open', show); else el.classList.toggle('collapsed', !show);
    $('#settings').setAttribute('aria-expanded', String(show));
  }
  toggleInspector() { this.showInspector(!this.inspectorShown()); this.audio.click(); }
  openPanel() {
    if (this.mode === 'panel') return;
    this.panelWasShown = this.inspectorShown(); this.showInspector(true);
    this.mode = 'panel'; this.cursor.visible = false;
    this.nav.open($('#inspector'), () => this.closePanel());
    this.setStatus('Lab panel · B to leave', 'ready');
  }
  closePanel() {
    if (this.mode !== 'panel') return;
    this.nav.close(); this.mode = 'play';
    if (!this.panelWasShown) this.showInspector(false);
    this.kit.input.settle(); this.readyStatus();
  }
  openMenu() {
    if (this.stopped || this.mode === 'menu' || this.mode === 'results') return;
    if (this.mode === 'panel') this.closePanel();
    this.mode = 'menu'; this.cursor.visible = false; this.press = null;
    this.kit.input.unlockPointer();
    this.renderHelp(); this.syncSoundButton();
    document.querySelectorAll('[data-menu-area]').forEach(button => {
      const active = button.dataset.menuArea === this.area; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
    });
    $('#menu').hidden = false;
    this.nav.open($('#menu .menu-card'), () => this.closeMenu(), $('[data-menu=resume]'));
    this.audio.click();
  }
  closeMenu() {
    if (this.mode !== 'menu') return;
    $('#menu').hidden = true; this.nav.close(); this.mode = 'play';
    this.kit.input.settle(); this.audio.click();
  }
  syncSoundButton() {
    const button = $('[data-menu=sound]');
    button.textContent = `Sound: ${this.audio.muted ? 'Off' : 'On'}`; button.setAttribute('aria-pressed', String(!this.audio.muted));
  }
  showResults() {
    if (this.mode === 'menu') { $('#menu').hidden = true; this.nav.close(); }
    if (this.mode === 'panel') this.closePanel();
    this.mode = 'results'; this.cursor.visible = false; this.press = null;
    this.kit.input.unlockPointer();
    const hunt = this.hunt;
    $('#results-area').textContent = AREAS[this.area].name.toUpperCase();
    $('#results-time').textContent = formatTime(hunt.seconds);
    $('#results-actions').textContent = String(hunt.actions);
    $('#results-best').textContent = hunt.bestText();
    $('#results-note').textContent = hunt.newBest ? 'A new best for this area.' : `Best stays at ${hunt.bestText()}.`;
    $('#results').hidden = false;
    this.nav.open($('#results .menu-card'), () => this.closeResults(), $('[data-results=continue]'));
    this.audio.chime(); this.kit.input.rumble(0.5, 220);
  }
  closeResults() {
    if (this.mode !== 'results') return;
    $('#results').hidden = true; this.nav.close(); this.mode = 'play'; this.kit.input.settle();
  }
  updateHunt() {
    const hunt = this.hunt;
    $('#hunt').hidden = !hunt.total;
    if (!hunt.total) return;
    this.setText('#hunt-lit', `${hunt.lit} of ${hunt.total} lamp${hunt.total === 1 ? '' : 's'} lit`);
    this.setText('#hunt-run', hunt.done ? `Done in ${hunt.actions} · ${formatTime(hunt.seconds)}`
      : hunt.started ? `${hunt.actions} use${hunt.actions === 1 ? '' : 's'} · ${formatTime(hunt.seconds)}` : 'Lamp hunt');
    this.setText('#hunt-best', `Best ${hunt.bestText()}`);
  }

  bind() {
    const opts = { signal: this.abort.signal };
    document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => this.setTool(button.dataset.tool), opts));
    $('#drop').addEventListener('click', () => this.drop(), opts);
    $('#reset').addEventListener('click', () => this.reset(), opts);
    $('#pause').addEventListener('click', () => this.setPaused(!this.paused), opts);
    $('#home').addEventListener('click', () => this.goTo(0), opts);
    $('#overview').addEventListener('click', () => this.goTo(-1), opts);
    $('#landmark').addEventListener('change', e => this.goTo(Number(e.target.value)), opts);
    document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => this.switchArea(button.dataset.area), opts));
    $('#settings').addEventListener('click', () => this.toggleInspector(), opts);
    $('#menu-button').addEventListener('click', () => this.openMenu(), opts);
    $('#display-settings').addEventListener('click', () => this.kit.menu.open(), opts);
    $('#quality').addEventListener('change', e => this.setProfile(e.target.value), opts);
    this.graphicsPanel = mountGraphicsPanel($('#graphics-controls'), () => this.view.graphics,
      (key, value) => this.setGraphics({ [key]: value }), this.abort.signal, () => ({ autoShadow: this.view.autoShadowSize }));
    $('#reset-graphics').addEventListener('click', () => {
      this.preferences.graphics[this.profile] = profileDefaults(this.profile);
      this.view.setProfile(this.profile, this.preferences.graphics[this.profile]); this.saveGraphics(); this.graphicsPanel.sync();
      this.changedShadows = true;
    }, opts);
    // Restore the saved lab options into the physics controls.
    $('#damage').checked = this.autoDamage;
    $('#max-bodies').value = this.maxBodies; $('#max-bodies-value').textContent = String(this.maxBodies);
    $('#debris-life').value = this.debrisSeconds;
    $('#debris-life-value').textContent = this.debrisSeconds ? `${this.debrisSeconds} s` : 'No expiry';
    $('#radius').value = this.radius; $('#radius-value').textContent = `${this.radius.toFixed(3)} m`;
    $('#radius').addEventListener('input', e => this.setRadius(Number(e.target.value)), opts);
    $('#max-bodies').addEventListener('input', e => {
      this.physics.maxBodies = Number(e.target.value); $('#max-bodies-value').textContent = e.target.value;
      while (this.physics.bodies.length > this.physics.maxBodies) { this.physics.remove(this.physics.bodies[0]); this.physics.culled++; }
      this.updateStats(); this.saveLab();
    }, opts);
    $('#debris-life').addEventListener('input', e => {
      this.physics.debrisSeconds = Number(e.target.value);
      $('#debris-life-value').textContent = this.physics.debrisSeconds ? `${this.physics.debrisSeconds} s` : 'No expiry';
      this.saveLab();
    }, opts);
    $('#damage').addEventListener('change', e => { this.autoDamage = e.target.checked; this.physics.impactEvents.length = 0; this.saveLab(); }, opts);
    $('#report').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(this.report(), null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'strata-device-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, opts);
    // A slider, switch or list changed with a mouse or finger lets go of focus afterwards, so the
    // shortcut keys (which ignore focused form fields) work again at once. Keyboard use keeps focus.
    let pointerEdit = false;
    $('#inspector').addEventListener('pointerdown', () => { pointerEdit = true; }, opts);
    $('#inspector').addEventListener('keydown', () => { pointerEdit = false; }, opts);
    $('#inspector').addEventListener('change', e => {
      const t = e.target;
      if (pointerEdit && this.mode !== 'panel' && (t.type === 'range' || t.type === 'checkbox' || t.tagName === 'SELECT')) t.blur();
    }, opts);
    // Menus.
    $('#menu').addEventListener('click', e => {
      if (e.target === e.currentTarget) { this.closeMenu(); return; }
      const action = e.target.closest('[data-menu]')?.dataset.menu;
      if (action === 'resume') this.closeMenu();
      else if (action === 'panel') {
        const pad = this.source === 'gamepad'; this.closeMenu();
        if (pad) this.openPanel(); else this.showInspector(true);
      } else if (action === 'settings') this.kit.menu.open();
      else if (action === 'sound') { this.audio.setMuted(!this.audio.muted); this.syncSoundButton(); }
      else if (action === 'reset') { this.closeMenu(); this.reset(); }
      const area = e.target.closest('[data-menu-area]')?.dataset.menuArea;
      if (area) { this.closeMenu(); this.switchArea(area); }
    }, opts);
    $('#results').addEventListener('click', e => {
      const action = e.target.closest('[data-results]')?.dataset.results;
      if (action === 'continue') this.closeResults();
      else if (action === 'reset') { this.closeResults(); this.reset(); }
    }, opts);
    document.addEventListener('click', e => { if (e.target.closest?.('button')) this.audio.click(); }, opts);
  }
  saveGraphics() {
    this.preferences.profile = this.profile;
    this.preferences.graphics[this.profile] = { ...this.view.graphics };
    $('#save-status').textContent = saveSettings(this.storage, this.preferences) ? 'Settings saved on this browser.' : 'Settings apply to this session only.';
  }
  /** chosen: the player picked it (sticks across loads); false when the Quality tier picked it. */
  setProfile(name, chosen = true) {
    if (!Object.hasOwn(PROFILES, name)) throw new RangeError(`Unknown profile: ${name}`);
    this.preferences.graphics[this.profile] = { ...this.view.graphics };
    if (chosen) this.preferences.profileChosen = true;
    this.profile = name; this.view.setProfile(name, this.preferences.graphics[name]);
    $('#quality').value = name; this.graphicsPanel?.sync(); this.changedShadows = true; this.saveGraphics(); this.updateStats();
  }
  setGraphics(patch) {
    const next = { ...this.view.graphics };
    for (const [key, value] of Object.entries(patch)) next[key] = normaliseSetting(key, value);
    this.view.applyGraphics(next); this.graphicsPanel?.sync(); this.changedShadows = true; this.saveGraphics(); this.updateStats();
    return { ...this.view.graphics };
  }
  configureArea() {
    const area = AREAS[this.area], layout = this.layout;
    this.orbit.maxDistance = Math.max(75, layout.size * 4);
    this.orbit.setBounds(layout.size / 2 + 4);
    const select = $('#landmark'); select.replaceChildren();
    layout.landmarks.forEach((landmark, index) => {
      const option = document.createElement('option'); option.value = index; option.textContent = landmark.name; select.append(option);
    });
    document.querySelectorAll('[data-area]').forEach(button => {
      const active = button.dataset.area === this.area; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
    });
    $('#scene-number').textContent = area.number; $('#scene-label').textContent = area.label;
    $('#scene-title').textContent = layout.title; $('#scene-description').textContent = layout.description;
    $('#area-size').textContent = `${layout.size} × ${layout.size} m`;
    $('#area-detail').textContent = layout.detail ||
      `${layout.sites.length} garden${layout.sites.length === 1 ? '' : 's'} · ${layout.links.length} path link${layout.links.length === 1 ? '' : 's'} · ${layout.lightCells.length} lamps`;
  }
  goTo(index) {
    if (!this.layout) return;
    const overview = index < 0;
    const focus = overview ? [0, 1.65, 0] : this.layout.landmarks[index]?.focus;
    if (!focus) return;
    this.orbit.flyTo(focus, this.view.homeView(overview));
    this.lastHit = null; this.cursor.visible = false;
    if (index >= 0) $('#landmark').value = index;
  }

  // ---------------------------------------------------------------- world edits
  rayAt(nx, ny) {
    _ndc.set(nx, ny); this.view.camera.updateMatrixWorld(); this.raycaster.setFromCamera(_ndc, this.view.camera);
    return this.raycaster;
  }
  voxelHit(ray) {
    return raycastVoxels(this.world, ray.ray.origin.toArray(), ray.ray.direction.toArray(), this.view.graphics.drawDistance, this.layout?.editBounds);
  }
  hover(nx, ny) {
    if (this.busy) return;
    const hit = this.voxelHit(this.rayAt(nx, ny)); this.lastHit = hit;
    this.cursor.visible = this.tool === 'break' && !!hit;
    if (hit) {
      this.cursor.position.fromArray(hit.point); this.cursor.scale.setScalar(this.radius);
      this.setText('#material-name', PALETTE[hit.material].name);
    }
  }
  /** Apply the current tool (or a given one) along the ray through a screen point. */
  useAt(nx, ny, tool = this.tool) {
    // Looking somewhere never touches the world, so it works during an edit too.
    if (this.stopped || (this.busy && tool !== 'orbit')) return;
    const ray = this.rayAt(nx, ny), hit = this.voxelHit(ray); this.lastHit = hit;
    this.view.scene.updateMatrixWorld();
    const dynamic = ray.intersectObjects(this.physics.bodies.map(entry => entry.mesh), false)[0];
    const nearBody = dynamic && (!hit || dynamic.distance < hit.distance);
    if (tool === 'orbit') {
      const point = nearBody ? dynamic.point.toArray() : hit?.point;
      if (point) this.orbit.flyTo([point[0], Math.max(0.4, point[1]), point[2]]);
      else this.audio.deny();
    } else if (tool === 'push') {
      if (nearBody) {
        this.physics.impulse(dynamic.object.userData.physics, ray.ray.direction.toArray(), 5, dynamic.point.toArray());
        this.hunt.action(); this.audio.whoosh(0.5); this.kit.input.rumble(0.2, 50);
      } else { this.setStatus('Tap a loose piece to push it.', 'paused'); this.audio.deny(); }
    } else if (tool === 'break') {
      if (nearBody) { this.hunt.action(); this.shatterBody(dynamic.object.userData.physics, dynamic.point.toArray()); }
      else if (hit) { this.hunt.action(); this.breakAt(hit.point, this.radius); }
      else this.audio.deny();
    } else if (tool === 'add') {
      if (hit && !nearBody) this.addAt(hit); else this.audio.deny();
    } else if (tool === 'launch') {
      this.launch(ray, nearBody ? dynamic.distance : hit ? hit.distance : 30);
    }
  }
  async transaction(label, action) {
    if (this.stopped) return false;
    if (this.busy) return false;
    this.busy = true; this.cursor.visible = false; this.setStatus(label, 'busy');
    const start = performance.now();
    try {
      await action(); this.changedShadows = true; this.physics.impactEvents.length = 0;
      const lost = this.view.updateEmitters(this.world);
      this.readyStatus();
      if (lost) this.lampsOut(lost);
      else this.updateHunt();
    } catch (error) { this.fail(error); }
    finally {
      this.editMs = performance.now() - start; this.busy = false; this.clock.accumulator = 0; this.updateStats();
      if (this.pendingArea && !this.stopped) {
        const id = this.pendingArea; this.pendingArea = null;
        setTimeout(() => this.switchArea(id, true), 0);
      }
    }
    return true;
  }
  lampsOut(lost) {
    const lit = this.view.litCount;
    this.audio.lampOut();
    this.setStatus(lit ? `Lamp out · ${lit} still lit` : 'Every lamp is out', 'ready');
    if (this.hunt.update(lit)) { this.updateHunt(); this.showResults(); }
    else this.updateHunt();
  }
  /** Where a sound sits: pan from the screen position, level from the distance. */
  spatial(point) {
    const camera = this.view.camera;
    _v.fromArray(point); const distance = camera.position.distanceTo(_v);
    _v.project(camera);
    return { pan: Math.max(-0.85, Math.min(0.85, _v.x * 0.8)), gain: Math.max(0.12, Math.min(1, 1.5 / (1 + distance / 16))) };
  }
  feedback(point, material, size, { auto = false } = {}) {
    const where = this.spatial(point);
    this.audio.crack(size, material, where);
    this.dust.emit(point, material, size);
    this.view.burst(point, auto ? 0.7 : 1);
    this.orbit.shake(size * 0.25 * where.gain);
    if (!auto) this.kit.input.rumble(0.3 + size * 0.3, 90);
    else if (where.gain > 0.4) this.kit.input.rumble(0.25 * where.gain, 60);
  }
  breakAt(point, radius, { auto = false } = {}) {
    return this.transaction('Rebuild the damaged area…', async () => {
      const removed = carveSphere(this.world, point, radius);
      if (!removed.count) return;
      const counts = new Uint32Array(PALETTE.length); let material = MAT.LIMESTONE, most = 0;
      for (const value of removed.data) if (value && ++counts[value] > most) { most = counts[value]; material = value; }
      this.feedback(point, material, Math.min(1, removed.count / 900 + radius * 0.6), { auto });
      const chips = await this.worker.run('shatter', removed);
      const falling = await this.worker.run('support-sparse', this.world.snapshotSparse());
      for (const fragment of falling) removeFragment(this.world, fragment);
      await this.chunks.rebuild();
      _v2.fromArray(point);
      for (const fragment of [...falling, ...chips]) {
        const centre = fragment.origin.map((v, d) => (v + fragment.dims[d] / 2) * VOXEL_SIZE);
        const delta = _v.fromArray(centre).sub(_v2);
        const distance = delta.length(); delta.normalize().multiplyScalar(Math.max(0.2, 3.5 * (1 - distance / (radius * 3)))); delta.y += 1;
        this.physics.addFragment(fragment, delta.toArray());
      }
      if (falling.length) this.audio.impact(Math.min(1, falling.length / 6), material, this.spatial(point));
      this.physics.radialImpulse(point, radius * 4, 1.5);
    });
  }
  shatterBody(entry, point) {
    return this.transaction('Split the loose piece…', async () => {
      if (!this.physics.bodies.includes(entry)) return;
      const velocity = new THREE.Vector3().copy(entry.body.linvel()), angular = new THREE.Vector3().copy(entry.body.angvel());
      const position = entry.current.clone(), rotation = entry.currentQ.clone(), centre = entry.centre.clone();
      this.feedback(point, entry.material || MAT.LIMESTONE, 0.5);
      const pieces = await this.worker.run('shatter', { data: entry.voxelData.slice(), dims: entry.dims, origin: [0, 0, 0] });
      this.physics.remove(entry);
      for (const part of pieces) {
        const offset = new THREE.Vector3(...part.origin.map((v, d) => (v + part.dims[d] / 2) * VOXEL_SIZE)).sub(centre).applyQuaternion(rotation);
        const worldCentre = position.clone().add(offset);
        const v = velocity.clone().add(angular.clone().cross(offset));
        part.origin = worldCentre.toArray().map((value, d) => value / VOXEL_SIZE - part.dims[d] / 2);
        const child = this.physics.addFragment(part, v.toArray(), rotation);
        child?.body.setAngvel(angular, true);
      }
      this.physics.radialImpulse(point, 2.5, 2.4);
    });
  }
  addAt(hit) {
    // Place a 3-cell cube completely outside the hit face. No embedded centre voxel.
    const normal = hit.normal.some(Boolean) ? hit.normal : [0, 1, 0];
    const start = hit.cell.map((v, d) => v + (normal[d] > 0 ? 1 : normal[d] < 0 ? -3 : -1));
    if (start.some((value, d) => value < this.layout.editBounds.min[d] || value + 3 > this.layout.editBounds.max[d])) {
      this.setStatus('That spot is outside the editable area.', 'paused'); this.audio.deny(); return;
    }
    // Reject placement inside a loose body. Check both simulation and displayed poses.
    _box.min.set(...start).multiplyScalar(VOXEL_SIZE); _box.max.set(start[0] + 3, start[1] + 3, start[2] + 3).multiplyScalar(VOXEL_SIZE);
    for (const entry of this.physics.bodies) {
      _matrix.compose(entry.current, entry.currentQ, _one);
      _box2.copy(entry.mesh.geometry.boundingBox).applyMatrix4(_matrix).expandByScalar(0.015);
      _box3.setFromObject(entry.mesh).expandByScalar(0.015);
      if (_box.intersectsBox(_box2) || _box.intersectsBox(_box3)) { this.setStatus('A loose piece is in the way.', 'paused'); this.audio.deny(); return; }
    }
    this.hunt.action();
    return this.transaction('Add a voxel block…', async () => {
      for (let z = 0; z < 3; z++) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
        const p = [start[0] + x, start[1] + y, start[2] + z];
        if (!this.world.get(...p)) this.world.set(...p, MAT.LIMESTONE);
      }
      this.audio.place(); this.kit.input.rumble(0.15, 40);
      await this.chunks.rebuild();
    });
  }
  drop() {
    if (this.busy || this.stopped) return;
    this.hunt.action();
    return this.transaction('Create a physical voxel block…', async () => {
      const point = this.lastHit?.point || this.orbit.goal.toArray(), dims = [4, 4, 4], data = new Uint8Array(64).fill(MAT.COPPER);
      const fragment = await this.worker.run('fragment', { dims, data, count: 64,
        origin: [Math.round(point[0] / VOXEL_SIZE) - 2, Math.round(Math.max(5.5, point[1] + 4) / VOXEL_SIZE), Math.round(point[2] / VOXEL_SIZE) - 2] });
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.17, this.random() * 0.5, 0.12));
      this.physics.addFragment(fragment, [0.15, -1, 0], q);
      this.audio.whoosh(0.7);
    });
  }
  /** Fire a copper slug along the ray, lofted so it arrives at the aimed distance. */
  launch(ray, distance) {
    const now = performance.now();
    if (now - this.lastLaunch < 280) return;
    this.lastLaunch = now;
    const dims = [5, 5, 5], data = new Uint8Array(125); let count = 0;
    for (let z = 0; z < 5; z++) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      if ((x - 2) ** 2 + (y - 2) ** 2 + (z - 2) ** 2 <= 5.5) { data[x + 5 * (y + 5 * z)] = MAT.COPPER; count++; }
    }
    const direction = _v.copy(ray.ray.direction).normalize();
    const start = _v2.copy(this.view.camera.position).addScaledVector(direction, 1.4);
    const fragment = prepareFragment({ dims, data, count, origin: start.toArray().map((value, d) => value / VOXEL_SIZE - dims[d] / 2) });
    const range = Math.max(2, distance - 1.4), speed = Math.min(60, Math.max(22, range * 1.5)), flight = range / speed;
    const velocity = [direction.x * speed, direction.y * speed + 9.81 * flight / 2, direction.z * speed];
    const entry = this.physics.addFragment(fragment, velocity, null, { damageRadius: 0.75, life: 14, projectile: true });
    if (!entry) return;
    entry.body.setAngvel({ x: (this.random() - 0.5) * 8, y: (this.random() - 0.5) * 8, z: (this.random() - 0.5) * 8 }, true);
    this.hunt.action(); this.updateHunt(); this.changedShadows = true;
    this.audio.whoosh(1.2); this.kit.input.rumble(0.4, 70); this.orbit.shake(0.05);
    if (this.paused) this.setStatus('Physics is frozen · F to resume', 'paused');
  }
  reset() { return this.switchArea(this.area, true); }
  switchArea(id, force = false) {
    if (!Object.hasOwn(AREAS, id)) throw new RangeError(`Unknown area: ${id}`);
    if (!force && id === this.area) return Promise.resolve(false);
    if (this.busy) {
      // Run it as soon as the current edit finishes, instead of silently ignoring the click.
      this.pendingArea = id; this.setStatus('Finish the current edit, then switch…', 'busy');
      return Promise.resolve(false);
    }
    return this.transaction('Build the selected area…', async () => {
      $('#loading').classList.remove('is-hidden'); this.areaLoading = true;
      document.querySelectorAll('[data-area]').forEach(button => { button.disabled = true; });
      try {
        await this.loadArea(id, (fraction, text) => this.loading(text, 2 + fraction * 94));
      } finally {
        this.areaLoading = false; $('#loading').classList.add('is-hidden');
        document.querySelectorAll('[data-area]').forEach(button => { button.disabled = false; });
      }
    });
  }
  async loadArea(id, progress) {
    this.physics.clearDynamic(); this.chunks?.dispose(); this.world = new VoxelWorld(); this.lastHit = null; this.dust.clear();
    this.cursor.visible = false;
    progress(0, 'Build terrain and structures…');
    this.layout = await createAreaAsync(this.world, id, fraction => progress(fraction * 0.4, 'Build terrain and structures…'));
    this.view.decorate(this.layout); this.physics.setFloorExtent(Math.max(100, this.layout.size * 1.5));
    this.chunks = new ChunkRenderer(this.world, this.view.scene, this.material, this.physics, this.worker);
    await this.chunks.rebuild(fraction => progress(0.4 + fraction * 0.6, 'Build surfaces and collision shapes…'));
    this.area = id; this.configureArea();
    this.orbit.flyTo(this.layout.focus, this.view.homeView(false)); this.orbit.snap();
    this.view.updateFocus(this.orbit.target, true);
    this.clock.reset(); this.physics.culled = 0; this.physics.time = 0;
    this.frameCount = 0; this.fps = 0; this.lastStats = performance.now();
    this.hunt.reset(id, this.view.emitters.length); this.updateHunt();
    this.saveLab();
  }

  // ---------------------------------------------------------------- per frame
  handleInput(dt) {
    const input = this.kit.input, now = performance.now();
    if (input.pressed('pause')) {
      if (this.mode === 'play') this.openMenu();
      else if (this.mode === 'menu') this.closeMenu();
      else if (this.mode === 'panel') this.closePanel();
      else if (this.mode === 'results') this.closeResults();
      return;
    }
    if (this.mode === 'panel') {
      if (input.pressed('panel')) { this.closePanel(); return; }
      // Picking the mouse or a finger back up leaves the panel and uses that press in the scene.
      if (input.pointer.justDown) this.closePanel();
    }
    if (this.mode !== 'play') { this.nav.update(now); return; }

    // Camera: drag or right stick orbits, a right/middle/Shift drag pans, wheel or pinch zooms.
    const look = input.look('look');
    if (look.x || look.y) {
      if (input.down('panDrag')) {
        const invert = this.kit.settings.get().invertY ? -1 : 1;
        this.orbit.panScreen(look.x / MOUSE_LOOK, look.y * invert / MOUSE_LOOK, this.kit.size.height);
      } else this.orbit.orbit(-look.x * 1.4, -look.y * 1.4);
    }
    const turn = input.value('turn');
    if (turn) this.orbit.orbit(-turn * 1.8 * dt, 0);
    const zoom = input.zoom() + (input.value('zoomIn') - input.value('zoomOut')) * 5 * dt;
    if (zoom) this.orbit.zoom(Math.exp(-zoom * 0.18));
    const move = input.vector('move');
    if (move.x || move.y) {
      const speed = Math.max(4, this.orbit.radius * 0.9);
      this.orbit.panGround(move.x * speed * dt, move.y * speed * dt);
    }

    // Tools.
    for (let i = 0; i < TOOLS.length; i++) if (input.pressed(`tool${i + 1}`)) this.setTool(TOOLS[i]);
    if (input.pressed('navLeft') || input.pressed('navRight')) {
      const index = TOOLS.indexOf(this.tool) + (input.pressed('navRight') ? 1 : -1);
      this.setTool(TOOLS[(index + TOOLS.length) % TOOLS.length]);
    }
    const radiusStep = (input.pressed('radiusUp') || input.pressed('navUp') ? 1 : 0) - (input.pressed('radiusDown') || input.pressed('navDown') ? 1 : 0);
    if (radiusStep) {
      const index = Math.max(0, Math.min(RADII.length - 1, RADII.indexOf(this.radius) + radiusStep));
      if (RADII[index] !== this.radius) this.setRadius(RADII[index], true);
    }
    if (input.pressed('drop')) this.drop();
    if (input.pressed('freeze')) this.setPaused(!this.paused);
    if (input.pressed('reset')) this.reset();
    if (input.pressed('home')) this.goTo(0);
    if (input.pressed('panel')) { if (input.source === 'gamepad') this.openPanel(); else this.toggleInspector(); }
    if (input.pressed('use')) this.useAt(0, 0);

    // Taps and clicks: a short press that barely moved uses the tool there.
    const p = input.pointer;
    if (p.justDown) this.press = { x: p.x, y: p.y, t: now, moved: false, ok: p.type !== 'mouse' || input.down('tapMouse') };
    if (this.press) {
      if (Math.abs(p.x - this.press.x) + Math.abs(p.y - this.press.y) > 9 || input.zoom()) this.press.moved = true;
      if (p.justUp) {
        if (this.press.ok && !this.press.moved && now - this.press.t < 450) this.useAt(p.nx, p.ny);
        this.press = null;
      }
    }
    // Hover preview: under the mouse, or at the reticle with a controller.
    if (now - this.lastHover > 40) {
      if (input.source === 'gamepad') { this.lastHover = now; this.hover(0, 0); }
      else if (p.type === 'mouse' && p.over && !p.down) { this.lastHover = now; this.hover(p.nx, p.ny); }
    }
  }
  frame(dt) {
    if (this.stopped || this.areaLoading) { this.clock.accumulator = 0; return; }
    this.handleInput(dt);
    const menu = this.mode === 'menu' || this.mode === 'results';
    const frozen = this.busy || this.paused || menu;
    const start = performance.now();
    const state = this.clock.advance(dt, fixed => this.physics.step(fixed), frozen);
    this.physicsMs = performance.now() - start; this.physics.sync(state.alpha);
    if (!menu) this.hunt.tick(dt);
    this.orbit.update(dt); this.view.updateFocus(this.orbit.target);
    this.dust.update(dt);
    // Knocks and thuds from loose pieces.
    for (const event of this.physics.soundEvents) {
      const where = this.spatial(event.position);
      this.audio.impact(event.strength, event.material, where);
      if (event.strength > 0.5 && where.gain > 0.5) this.kit.input.rumble(0.12 * event.strength, 40);
    }
    this.physics.soundEvents.length = 0;
    const moving = this.changedShadows || (!frozen && this.physics.awake > 0);
    this.view.render(dt, moving); this.changedShadows = false;
    this.frameCount++; this.frameTimes[this.frameIndex] = dt * 1000; this.frameIndex = (this.frameIndex + 1) % this.frameTimes.length;
    this.frameFilled = Math.min(this.frameTimes.length, this.frameFilled + 1);
    const now = performance.now();
    if (now - this.lastStats >= 750) {
      this.fps = this.frameCount * 1000 / (now - this.lastStats); this.frameCount = 0; this.lastStats = now; this.updateStats();
      if (this.hunt.started && !this.hunt.done) this.updateHunt();
    }
    if (!this.busy && !this.paused && !menu) {
      const event = this.physics.impactEvents.shift(); this.physics.impactEvents.length = 0;
      if (event && this.autoDamage) {
        const hit = raycastVoxels(this.world, event.origin, event.velocity, event.reach, this.layout.editBounds);
        if (hit) this.breakAt(hit.point, event.radius, { auto: true });
      }
    }
  }
  updateStats() {
    if (!this.physics || !this.view || !this.chunks) return;
    const canvas = this.view.renderer.domElement;
    this.setText('#fps', this.fps ? String(Math.round(this.fps)) : '—');
    this.setText('#voxel-count', format(this.world.count));
    this.setText('#triangle-count', format(this.chunks.triangles));
    this.setText('#body-count', `${this.physics.bodies.length} / ${this.physics.maxBodies}`);
    this.setText('#awake-count', `${this.physics.awake} awake`);
    this.setText('#physics-ms', `${this.physicsMs.toFixed(1)} ms`);
    this.setText('#scale-value', `${this.kit.tier.name} · ${this.view.renderer.getPixelRatio().toFixed(2)}×`);
    this.setText('#resolution', `${canvas.width} × ${canvas.height}`);
    this.setText('#collider-count', format(this.physics.staticCount));
  }
  report() {
    const sorted = [...this.frameTimes.subarray(0, this.frameFilled)].sort((a, b) => a - b);
    const canvas = this.view?.renderer.domElement;
    return { engine: 'Strata 0.3.0', date: new Date().toISOString(), userAgent: navigator.userAgent, secureContext: isSecureContext,
      backend: this.view?.backend, quality: this.kit.tier.name, profile: this.profile, area: this.area, areaMetres: this.layout?.size,
      graphics: { ...this.view?.graphics }, fps: this.fps,
      p95FrameMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null,
      physicsCpuMsLastFrame: this.physicsMs, lastEditWallMs: this.editMs, droppedSimulationSeconds: this.clock.droppedSeconds,
      voxelMetres: VOXEL_SIZE, fixedStepHz: 60, staticVoxels: this.world.count,
      staticTriangles: this.chunks?.triangles, chunks: this.chunks?.meshes.size, staticColliders: this.physics?.staticCount,
      dynamicBodies: this.physics?.bodies.length, awakeBodies: this.physics?.awake, budgetCulledBodies: this.physics?.culled,
      debrisLifetimeSeconds: this.physics?.debrisSeconds, maxBodies: this.physics?.maxBodies,
      actualShadowSize: this.view?.actualShadowSize, pixelRatio: this.view?.renderer.getPixelRatio(), worker: !!this.worker.worker,
      drawingBuffer: canvas ? [canvas.width, canvas.height] : null,
      lampHunt: { lit: this.hunt.lit, total: this.hunt.total, actions: this.hunt.actions, seconds: this.hunt.seconds, best: this.hunt.bestFor() },
      note: 'Frame time is browser wall time. It is not a GPU timestamp or a temperature reading.' };
  }
  fail(error) {
    console.error(error); this.stopped = true; this.kit.stop();
    $('#loading').classList.add('is-hidden'); $('#error').hidden = false;
    $('#error-detail').textContent = error instanceof Error ? error.message : String(error);
    this.setStatus('Stopped. Reload to recover.', 'error');
    this.kit.loading.done();
  }
  dispose() {
    this.stopped = true; this.kit.stop(); this.abort.abort(); clearTimeout(this.saveTimer);
    this.chunks?.dispose(); this.physics?.dispose(); this.worker.dispose(); this.material?.dispose(); this.view?.dispose();
    delete window.strata;
  }
}

export async function start() {
  const kit = await boot({
    title: 'Strata',
    physics: true,
    mount: $('#viewport'),
    gear: 'none', // the lab's own menu and panel open the shared settings (and F9 does)
    accent: '#b88448',
    background: '#2a3932',
    input: ACTIONS,
  });
  const engine = new StrataEngine(kit);
  try { await engine.init(); } catch (error) { engine.fail(error); }
}
