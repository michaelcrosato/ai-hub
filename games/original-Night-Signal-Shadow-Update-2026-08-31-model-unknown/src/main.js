/**
 * Night Signal — Shadow Update, on the shared 3D stack.
 *
 * The city, route, sound, enemy and session rules are the original modules,
 * unpacked from the old single-file bundle. Rendering is three.js through
 * kit.renderer (render.js); every input goes through kit.input actions, so
 * the game plays with keyboard and mouse, a gamepad or touch.
 *
 * Additions in this update: three nights to choose from (one with a blind,
 * sound-hunting third listener), six signal logs to find in every city,
 * a results screen with best times, restart, gamepad-driven menus, a short
 * "caught" beat before the results, and rumble on the moments that matter.
 */

import { boot } from 'kit/boot.js';
import { FLOOR_HEIGHT as H, GROUND_Y as G, actionDefs, validateSettings } from './config.js';
import { add, clamp, distance, dot, flatDistance as flat, normalize, scale, sub } from './math.js';
import { Random } from './random.js';
import { buildingAt, createCity, locateNode, placeLogs, validateCity } from './plan.js';
import { createBuildingGeometry, roomSurface } from './geometry.js';
import { Navigation } from './navigation.js';
import { NoiseLog, propagateSound } from './acoustics.js';
import { Sound } from './sound.js';
import { Session, parseSave } from './session.js';
import { EnemyBrain } from './brain.js';
import { UI } from './ui.js';
import { PALETTE, flashlightState, instance, overlapCircle, pushFromBox, rayBox, signBoxes } from './world.js';
import { WorldView } from './render.js';

const storage = {
  read(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  write(k, v) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
};
const SAVE = 'night-signal:html:save:1';
const SETTINGS = 'night-signal:html:settings:1';
const RECORDS = 'night-signal:html:records:1';

function readSettings() {
  try {
    return validateSettings(JSON.parse(storage.read(SETTINGS)));
  } catch {
    return validateSettings(null);
  }
}

/** Escapes, the fastest escape, and the best time per night and city size. */
function readRecords() {
  const out = { escapes: 0, fastest: 0, best: {} };
  try {
    const r = JSON.parse(storage.read(RECORDS));
    if (r && typeof r === 'object') {
      if (Number.isFinite(r.escapes)) out.escapes = clamp(Math.floor(r.escapes), 0, 1e6);
      if (Number.isFinite(r.fastest) && r.fastest > 0) out.fastest = r.fastest;
      if (r.best && typeof r.best === 'object')
        for (const [k, v] of Object.entries(r.best)) if (/^(calm|standard|hunted):[357]$/.test(k) && Number.isFinite(v) && v > 0) out.best[k] = v;
    }
  } catch {
    /* No records yet. */
  }
  return out;
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class Game {
  constructor(kit, settings) {
    this.kit = kit;
    this.input = kit.input;
    this.settings = settings;
    this.bindingKey = JSON.stringify(settings.bindings);
    this.records = readRecords();
    this.view = new WorldView(kit, settings);
    this.ui = new UI(
      settings,
      {
        newGame: (seed, size, difficulty) => this.start(seed, size, null, difficulty),
        continueGame: () => {
          const save = parseSave(storage.read(SAVE));
          if (save) this.start(save.seed, save.size, save, save.difficulty);
          else this.ui.main(false, this.records);
        },
        resume: () => this.resume(),
        saveMenu: () => this.menu(),
        restart: () => this.restart(),
        settings: (s) => this.applySettings(s),
        kitMenu: () => this.kit.menu.open(),
      },
      { backend: kit.backendLabel, isKitMenuOpen: () => kit.menu.isOpen }
    );
    this.sound = new Sound(settings, (text) => this.ui.caption(text));
    this.noise = new NoiseLog();
    this.dom = {
      mask: document.getElementById('locker-mask'),
      alert: document.getElementById('edge-alert'),
      pause: document.getElementById('small-pause'),
    };
    this.domState = { mask: null, alert: -1 };
    this.running = false;
    this.hasRun = false;
    this.busy = false;
    this.dying = null;
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsSince = 0;
    this.navKey = 0;
    this.navTimer = 0;
    this.sprintLatch = false;
    this.lockDenied = false;
    this.lockFails = 0;
    this.lockFailedAt = -1e9;
    this.lockToast = false;
    this.wasLocked = false;
    // Reused every frame so movement and the camera allocate nothing.
    this.scratch = { near: [], near2: [], next: [0, 0, 0] };
    this.cam = { eye: null, forward: null, pitch: 0, yaw: 0, light: false, flashOrigin: null, body: { position: null, height: 1.67, yaw: 0 } };
    this.installEvents();
    this.buildWorld('NIGHT-SIGNAL', 3, null, 'standard');
    this.setMenuMode(true);
    this.ui.setSource(this.input.source);
    this.ui.main(!!parseSave(storage.read(SAVE)), this.records);
  }

  installEvents() {
    const canvas = this.kit.canvas;
    this.input.onSourceChange((src) => this.ui.setSource(src));
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) this.lockFails = 0;
      // Escape releases the mouse before the page sees the key: treat that as pause.
      if (this.wasLocked && !locked && this.running) this.pause();
      this.wasLocked = locked;
    });
    // A browser refuses a lock right after Escape, or always inside some frames: retry on a
    // click a moment later, and fall back to drag-to-look after two refusals in a row.
    document.addEventListener('pointerlockerror', () => {
      this.lockFails += 1;
      this.lockFailedAt = performance.now();
      if (this.lockFails >= 2) this.lockDenied = true;
      if (this.running && !this.lockToast) {
        this.lockToast = true;
        this.ui.toast('Mouse lock did not start. Click the view to try again, or hold the mouse button and drag to look. Arrow keys also turn the view.', 7);
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.running || e.pointerType !== 'mouse' || this.lockDenied || document.pointerLockElement === canvas) return;
      if (performance.now() - this.lockFailedAt > 1200) this.input.lockPointer();
    });
    addEventListener('blur', () => {
      if (this.running) this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.running) this.pause();
    });
    addEventListener('pagehide', () => this.save());
    // The kit's own settings panel pauses the loop; pause the city (and its sound) with it.
    this.kit.onPause((paused) => {
      if (!paused) return;
      if (this.running) this.pause();
      else this.sound.pause();
    });
    // Audio starts on the first gesture of any kind, so a gamepad start still has sound.
    const unlock = () => {
      removeEventListener('pointerdown', unlock, true);
      removeEventListener('keydown', unlock, true);
      this.sound
        .unlock()
        .then(() => {
          if (!this.running) this.sound.pause();
        })
        .catch(() => {});
    };
    addEventListener('pointerdown', unlock, true);
    addEventListener('keydown', unlock, true);
    this.dom.pause?.addEventListener('click', () => this.pause());
  }

  /** Menus: the kit leaves keys to the page (Tab, Space, typing) and hides the touch controls. */
  setMenuMode(on) {
    this.input.enabled = !on;
    this.kit.touch?.suspend(on, 'game');
    if (on) {
      // Keys held when a menu opens must not walk the menu (or the player, later).
      this.input.keys.clear();
      this.input.mouseButtons.clear();
    } else this.input.settle();
    this.navKey = 0;
  }

  /** How a control is named for the current device, with the right verb. */
  label(action) {
    return this.ui.labelFor(action);
  }
  get verb() {
    return this.input.source === 'touch' ? 'Tap' : 'Press';
  }

  async start(seed, size, save = null, difficulty = this.settings.difficulty) {
    if (this.busy) return;
    this.busy = true;
    this.suspend();
    this.ui.loading('Create streets, open rooms, stairs, sound paths, and exit routes.');
    await nextFrame();
    await nextFrame();
    try {
      this.buildWorld(seed, size, save, difficulty);
      this.hasRun = true;
      const saved = this.save();
      const look = this.input.source === 'touch' ? 'Drag to look.' : 'Drag to look if mouse lock is blocked.';
      this.ui.pause(`City ready. Select Enter the city. ${look}${saved ? '' : ' This preview blocks local saves. Keep this page open to keep the run.'}`, this.runInfo());
    } catch (e) {
      console.error('[Night Signal]', e);
      this.hasRun = false;
      this.ui.error(String(e?.message || e));
    } finally {
      this.busy = false;
    }
  }

  restart() {
    if (!this.city || this.busy) return;
    this.start(this.city.seed, this.city.size, null, this.session?.difficulty || this.settings.difficulty);
  }

  resume() {
    if (!this.hasRun || this.busy || ['won', 'lost'].includes(this.session.phase)) return;
    this.running = true;
    this.ui.play();
    this.ui.setSource(this.input.source);
    this.setMenuMode(false);
    document.body.classList.add('playing');
    this.kit.canvas.focus({ preventScroll: true });
    this.sound.unlock().catch(() => this.ui.toast('Sound is blocked. The sound captions still work.', 5));
    // Pointer lock needs a real click; a gamepad press is not one.
    if (this.input.source !== 'touch' && navigator.userActivation?.isActive !== false) {
      this.lockDenied = false;
      this.input.lockPointer();
    }
    if (this.session.time < 2)
      this.ui.toast(`Find three fuses. ${this.verb} ${this.label('journal')} for the map and floor clues. ${this.verb} ${this.label('interact')} to open doors.`, 8);
  }

  suspend() {
    this.running = false;
    this.wasLocked = false;
    this.setMenuMode(true);
    document.body.classList.remove('playing');
    this.input.unlockPointer();
    this.sound.stopAll();
    this.sound.pause();
  }

  pause(reason = 'The city is paused.') {
    // No pause during the short caught beat: it would let a lost run be continued.
    if (!this.hasRun || this.busy || this.dying || ['won', 'lost'].includes(this.session.phase)) return;
    this.suspend();
    this.save();
    this.ui.pause(reason, this.runInfo());
  }

  menu() {
    this.suspend();
    if (this.dying) storage.write(SAVE, null);
    else if (this.hasRun && !['won', 'lost'].includes(this.session.phase)) this.save();
    this.hasRun = false;
    this.dying = null;
    this.setMask(false);
    this.setAlert(0);
    this.ui.main(!!parseSave(storage.read(SAVE)), this.records);
  }

  openJournal() {
    this.suspend();
    const s = this.session;
    const p = this.player;
    this.ui.journal({
      city: this.city,
      player: p.hidden ? p.hidden.return : p.p,
      yaw: p.yaw,
      explored: s.explored,
      collected: s.collected,
      logs: s.logs,
      logPlaces: this.logs,
      logTotal: this.logs.length,
      difficulty: s.difficulty,
      alarm: s.alarmTime,
    });
  }

  runInfo() {
    const s = this.session;
    return { difficulty: s.difficulty, seed: this.city.seed, fuses: s.collected.size, logs: s.logs.length, logTotal: this.logs.length };
  }

  applySettings(s) {
    this.settings = s;
    storage.write(SETTINGS, JSON.stringify(s));
    this.view.apply(s);
    this.sound.apply(s);
    this.ui.apply(s);
    const key = JSON.stringify(s.bindings);
    if (key !== this.bindingKey) {
      this.bindingKey = key;
      this.input.define(actionDefs(s.bindings));
      this.kit.touch?.rebuild();
      this.sprintLatch = false;
    }
  }

  setMask(on) {
    if (this.domState.mask === on) return;
    this.domState.mask = on;
    if (this.dom.mask) this.dom.mask.style.display = on ? 'block' : 'none';
  }

  setAlert(v) {
    const q = Math.round(v * 50) / 50;
    if (this.domState.alert === q) return;
    this.domState.alert = q;
    if (this.dom.alert) this.dom.alert.style.opacity = String(q);
  }

  // ---- the city

  buildWorld(seed, size, save, difficulty) {
    this.city = createCity(seed, size);
    const errors = validateCity(this.city);
    if (errors.length) throw new Error(errors[0]);
    this.nav = new Navigation(this.city);
    this.rng = new Random(`${seed}:browser`);
    this.session = new Session(save ? save.difficulty : difficulty);
    if (save) this.session.restore(save);
    this.rules = this.session.rules;
    this.logs = placeLogs(this.city);
    const logIds = new Set(this.logs.map((l) => l.id));
    this.session.logs = this.session.logs.filter((id) => logIds.has(id));
    this.player = {
      p: save ? [...save.player] : [...this.city.spawn],
      yaw: save ? (save.yaw * Math.PI) / 180 : Math.PI,
      pitch: save ? (save.pitch * Math.PI) / 180 : 0,
      height: 1.67,
      crouch: false,
      light: true,
      hidden: null,
      vy: 0,
      step: 0,
      noise: 0,
      crankTime: 0,
      breathTime: 0,
      crank: false,
      breath: false,
      eye: null,
      forward: [0, 0, 1],
      right: [1, 0, 0],
    };
    this.scene = [];
    this.solidGroups = [];
    this.floorBoxes = [];
    this.doors = [];
    this.objects = [];
    this.lights = [];
    this.falling = [];
    this.noise.clear();
    this.grace = this.rules.grace;
    this.alarmTick = 0;
    this.senseTimer = 0;
    this.hudTimer = 0;
    this.saveTimer = 0;
    this.dying = null;
    this.sprintLatch = false;
    this.batteryWarned = false;
    this.lastPhase = this.session.phase;
    this.kit.touch?.setLabel('sprint', 'Run');
    this.setMask(false);
    this.setAlert(0);

    const street = [];
    const streetSolid = [];
    const put = (p, s, m = 'concrete', solid = true, a = [0, 0, 0]) => {
      const b = instance(p, s, m, a);
      street.push(b);
      if (solid) streetSolid.push(b);
      return b;
    };
    const ext = this.city.extent;
    // Keep the road below ground-floor slabs to prevent depth stripes.
    put([0, G - 0.27, 0], [ext * 2 + 25, 0.5, ext * 2 + 25], 'road', false);
    const mid = (size - 1) / 2;
    for (let n = 0; n <= size; n++) {
      const z = (n - mid - 0.5) * 34;
      for (let x = -ext + 2; x < ext; x += 6) put([x, G + 0.013, z], [2, 0.015, 0.1], 'paint', false);
      const xx = (n - mid - 0.5) * 34;
      for (let z1 = -ext + 2; z1 < ext; z1 += 6) put([xx, G + 0.014, z1], [0.1, 0.015, 2], 'paint', false);
    }
    for (const b of this.city.buildings) {
      const geo = createBuildingGeometry(this.city, b);
      const items = [];
      const solids = [];
      for (const q of geo.boxes) {
        if (q.id.includes('ramp-collision')) continue;
        const box = instance(q.position, q.size, q.material, q.angles);
        box.id = q.id;
        box.glass = q.glass;
        if (!q.glass) items.push(box);
        if (q.solid) {
          solids.push(box);
          if (q.id.includes(':slab:') || q.id.includes(':stair-landing:')) this.floorBoxes.push(box);
        }
      }
      const label = String.fromCharCode(65 + b.lotX) + (b.lotZ + 1);
      items.push(...signBoxes(label, [b.center[0], G + 2.99, b.center[2] - b.depth / 2 - 0.19], 0.058, 'cool'));
      // Low curb strips, with an open route at each entrance.
      for (const side of [-1, 1]) put([b.center[0] + side * (b.width / 4 + 0.65), G - 0.035, b.center[2] - b.depth / 2 - 0.75], [b.width / 2 - 1.3, 0.13, 0.85], 'trim', false);
      for (const spec of geo.objects) {
        const o = { ...spec, position: [...spec.position], size: [...spec.size], active: false, timer: 0, velocity: [0, 0, 0], angle: 0, spin: 0, cooldown: 0 };
        if (save?.props?.[o.id]) o.position = [...save.props[o.id].position];
        this.objects.push(o);
        const p = o.position;
        const s = o.size;
        if (o.kind === 'cover') {
          const q = instance(p, s, 'wood');
          q.objectId = o.id;
          items.push(q);
          solids.push(q);
          for (const dy of [-0.36, 0.36]) items.push(instance([p[0], p[1] + dy, p[2] - 0.335], [s[0] - 0.12, 0.04, 0.03], 'metal'));
        } else if (o.kind === 'table') {
          items.push(instance([p[0], p[1] + s[1] / 2 - 0.055, p[2]], [s[0], 0.11, s[2]], 'wood'));
          solids.push(instance(p, s, 'wood'));
          for (const x of [-1, 1])
            for (const z of [-1, 1]) items.push(instance([p[0] + x * (s[0] / 2 - 0.09), p[1] - 0.035, p[2] + z * (s[2] / 2 - 0.09)], [0.075, s[1] - 0.12, 0.075], 'metal'));
        } else if (o.kind === 'locker') {
          const q = instance([p[0], p[1] + s[1] / 2, p[2]], s, 'locker');
          q.objectId = o.id;
          items.push(q);
          solids.push(q);
          const side = o.yaw === 180 ? 1 : -1;
          items.push(instance([p[0], p[1] + 1.05, p[2] + side * 0.51], [0.016, 1.96, 0.025], 'black'));
          for (let i = 0; i < 5; i++) items.push(instance([p[0], p[1] + 1.65 - i * 0.105, p[2] + side * 0.514], [0.72, 0.035, 0.02], 'black'));
          items.push(instance([p[0] - 0.32, p[1] + 1.08, p[2] + side * 0.54], [0.045, 0.22, 0.055], 'trim'));
        } else if (o.kind === 'radio') {
          items.push(instance(p, s, 'black'));
          for (let i = 0; i < 3; i++) items.push(instance([p[0] - 0.1 + i * 0.07, p[1], p[2] - 0.1], [0.025, 0.14, 0.012], 'metal'));
          items.push(instance([p[0] + 0.12, p[1] + 0.015, p[2] - 0.105], [0.07, 0.05, 0.016], 'cool'));
        }
      }
      this.lights.push(...geo.lights);
      const doors = [];
      for (const d of b.doors) {
        const swing = d.id.endsWith(':entry') ? -1 : d.position[0] < b.center[0] ? 1 : -1;
        const open = !!save?.doors?.[d.id];
        const door = { ...d, swing, open, angle: open ? (swing * Math.PI) / 2 : 0 };
        doors.push(door);
        this.doors.push(door);
        this.nav.doorOpen.set(d.id, door.open);
      }
      // Each building's doors live with its walls, so collision and sight tests skip far buildings whole.
      this.solidGroups.push({ center: b.center, radius: Math.max(b.width, b.depth) / 2 + 2, boxes: solids, doors });
      this.scene.push({ items, center: b.center, radius: 25 });
    }
    // Street lamps and small pieces of cover. All light is generated at run time.
    for (let z = 0; z <= size; z++)
      for (let x = 0; x <= size; x++) {
        if ((x + z) % 2) continue;
        const px = (x - mid - 0.5) * 34 + 3.4;
        const pz = (z - mid - 0.5) * 34 + 3.4;
        if (Math.abs(px) > ext - 2 || Math.abs(pz) > ext - 2) continue;
        put([px, G + 2.65, pz], [0.12, 5.3, 0.12], 'metal');
        put([px - 0.55, G + 5.25, pz], [1.15, 0.1, 0.12], 'metal', false);
        put([px - 1, G + 5.19, pz], [0.62, 0.06, 0.33], 'emissive', false);
        this.lights.push({ id: `street:${x}:${z}`, position: [px - 1, G + 5.12, pz], warm: (x + z) % 4 === 0, range: 17, intensity: 2 });
        if (x > 0 && z > 0 && x < size && z < size) {
          put([px + 0.8, G + 0.6, pz], [1.4, 1.2, 1.15], 'metal');
          put([px + 0.8, G + 1.22, pz], [1.48, 0.07, 1.2], 'trim');
        }
      }
    // A sealed boundary prevents an early exit around the gate.
    const fence = (p, s) => put(p, s, 'metal');
    fence([-ext, G + 2.1, 0], [0.3, 4.2, ext * 2]);
    fence([ext, G + 2.1, 0], [0.3, 4.2, ext * 2]);
    fence([0, G + 2.1, -ext], [ext * 2, 4.2, 0.3]);
    const ez = this.city.exit[2];
    fence([-(ext + 3) / 2, G + 1.85, ez], [ext - 3, 3.7, 0.24]);
    fence([(ext + 3) / 2, G + 1.85, ez], [ext - 3, 3.7, 0.24]);
    for (const x of [-3.2, 3.2]) fence([x, G + 2.4, ez], [0.3, 4.8, 0.35]);
    put([0, G + 4.72, ez], [6.7, 0.25, 0.42], 'metal');
    street.push(...signBoxes('EXIT', [0, G + 4.1, ez - 0.26], 0.095, 'cool'));
    this.gate = { p: [0, G + 1.65, ez], s: [6, 3.3, 0.24], a: [0, 0, 0], c: PALETTE.metal, lift: save?.phase === 'escape' ? 4 : 0, box: null, boxLift: NaN };
    this.gatePanel = { position: [2.12, G + 1.12, ez - 1.05], id: 'exit-panel', kind: 'gate' };
    put(this.gatePanel.position, [0.62, 1.12, 0.3], 'metal');
    put([2.12, G + 1.9, ez - 1.05], [0.65, 0.08, 0.36], 'emissive', false);
    this.lights.push({ id: 'gate-lamp', position: [0, G + 4.5, ez - 1], warm: false, range: 15 });
    // Monument in the open square. It gives a clear landmark and street cover.
    put([0, G + 0.28, 0], [4.8, 0.56, 4.8], 'trim');
    put([0, G + 2.6, 0], [0.7, 4.6, 0.7], 'metal');
    put([0, G + 5.12, 0], [1.5, 0.18, 1.5], 'cool', false);
    for (const side of [-1, 1]) {
      put([side * 6, G + 0.43, 0], [0.6, 0.12, 3.1], 'wood');
      put([side * 6.25, G + 0.8, 0], [0.12, 0.68, 3.1], 'wood');
    }
    this.solidGroups.push({ center: [0, 0, 0], radius: Infinity, boxes: streetSolid, doors: null });
    this.scene.unshift({ items: street, center: [0, 0, 0], radius: 0 });
    this.makeEnemies();
    this.player.eye = add(this.player.p, [0, this.player.height, 0]);
    this.updateForward();
    this.view.setWorld(this);
  }

  doorBox(d) {
    if (d.box && d.boxAngle === d.angle) return d.box;
    const base = (d.yaw * Math.PI) / 180;
    const theta = base + d.angle;
    const w = d.width;
    const hx = d.position[0] - (Math.cos(base) * w) / 2;
    const hz = d.position[2] + (Math.sin(base) * w) / 2;
    d.box = instance([hx + (Math.cos(theta) * w) / 2, d.position[1] + 1.28, hz - (Math.sin(theta) * w) / 2], [w, 2.56, 0.1], d.id.endsWith(':entry') ? 'metal' : 'wood', [0, (theta * 180) / Math.PI, 0]);
    d.boxAngle = d.angle;
    return d.box;
  }

  gateBox() {
    const g = this.gate;
    if (!g.box || g.boxLift !== g.lift) {
      g.box = instance([g.p[0], g.p[1] + g.lift, g.p[2]], g.s, 'metal');
      g.boxLift = g.lift;
    }
    return g.box;
  }

  /** Solid boxes (and doors, and the gate) near p, written into `out`. */
  getNearBoxes(p, pad = 2, out = []) {
    out.length = 0;
    for (const group of this.solidGroups) {
      const dx = Math.abs(group.center[0] - p[0]);
      const dz = Math.abs(group.center[2] - p[2]);
      if (group.doors && dx < group.radius + 3.3 && dz < group.radius + 3.3) for (const d of group.doors) if (flat(d.position, p) < 3.3) out.push(this.doorBox(d));
      if (dx >= group.radius + pad || dz >= group.radius + pad) continue;
      for (const b of group.boxes) if (Math.abs(b.p[0] - p[0]) < b.s[0] / 2 + pad && Math.abs(b.p[2] - p[2]) < b.s[2] / 2 + pad) out.push(b);
    }
    if (this.gate.lift < 3.3 && flat(this.gate.p, p) < 5) out.push(this.gateBox());
    return out;
  }

  groundAt(p, maxY = p[1] + 0.28) {
    let y = G;
    for (const b of this.floorBoxes)
      if (Math.abs(p[0] - b.p[0]) <= b.s[0] / 2 && Math.abs(p[2] - b.p[2]) <= b.s[2] / 2) {
        const top = b.p[1] + b.s[1] / 2;
        if (top <= maxY + 0.001) y = Math.max(y, top);
      }
    const b = buildingAt(this.city, p);
    if (b && Math.abs(p[0] - b.stairX) < 1.4 && p[2] >= b.stairStart - 0.08 && p[2] <= b.stairEnd + 0.08) {
      const t = clamp((p[2] - b.stairStart) / (b.stairEnd - b.stairStart), 0, 1);
      for (let f = 0; f < b.floors - 1; f++) {
        const h = G + f * H + t * H;
        if (h <= maxY + 0.002) y = Math.max(y, h);
      }
    }
    return y;
  }

  moveBody(body, dx, dz, dt, height = 1.7, r = 0.28) {
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.16));
    const near = this.scratch.near;
    const next = this.scratch.next;
    for (let i = 0; i < count; i++) {
      const p = body.p;
      next[0] = p[0] + dx / count;
      next[1] = p[1];
      next[2] = p[2] + dz / count;
      const support = this.groundAt(next, p[1] + 0.3);
      if (support > next[1] && support - next[1] <= 0.3) next[1] = support;
      this.getNearBoxes(next, r + 0.45, near);
      for (let pass = 0; pass < 2; pass++) for (const box of near) pushFromBox(next, r, height, box);
      p[0] = next[0];
      p[2] = next[2];
      if (next[1] > p[1]) p[1] = next[1];
    }
    const floor = this.groundAt(body.p, body.p[1] + 0.3);
    if (body.p[1] - floor < 0.34) {
      body.p[1] = floor;
      body.vy = 0;
    } else {
      body.vy = (body.vy || 0) - 14 * dt;
      body.p[1] += body.vy * dt;
      if (body.p[1] < floor) {
        body.p[1] = floor;
        body.vy = 0;
      }
    }
    if (body.p[1] < G) body.p[1] = G;
  }

  /** Line of sight. Glass never blocks it; doors do. */
  sight(a, b, ignore = null) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.02) return true;
    const norm = [dx / len, dy / len, dz / len];
    const reach = len - 0.05;
    const loX = Math.min(a[0], b[0]);
    const hiX = Math.max(a[0], b[0]);
    const loY = Math.min(a[1], b[1]);
    const hiY = Math.max(a[1], b[1]);
    const loZ = Math.min(a[2], b[2]);
    const hiZ = Math.max(a[2], b[2]);
    for (const group of this.solidGroups) {
      if (group.radius !== Infinity) {
        const m = group.radius + 1;
        if (hiX < group.center[0] - m || loX > group.center[0] + m || hiZ < group.center[2] - m || loZ > group.center[2] + m) continue;
      }
      for (const box of group.boxes) {
        if (box.glass || box.objectId === ignore) continue;
        if (hiY < box.p[1] - box.s[1] / 2 || loY > box.p[1] + box.s[1] / 2) continue;
        if (rayBox(a, norm, box, reach) < reach) return false;
      }
      if (group.doors)
        for (const d of group.doors) {
          if (d.id === ignore || flat(d.position, a) > len + 2) continue;
          if (rayBox(a, norm, this.doorBox(d), reach) < reach) return false;
        }
    }
    return true;
  }

  updateForward() {
    const p = this.player;
    const c = Math.cos(p.pitch);
    p.forward = [Math.sin(p.yaw) * c, Math.sin(p.pitch), -Math.cos(p.yaw) * c];
    p.right = [Math.cos(p.yaw), 0, Math.sin(p.yaw)];
  }

  // ---- the player

  playerUpdate(dt) {
    const input = this.input;
    const p = this.player;
    const s = this.session;
    const look = input.look('look');
    const turn = input.vector('turn');
    const t = dt * 1.65;
    p.yaw = wrapAngle(p.yaw + look.x + turn.x * t);
    p.pitch = clamp(p.pitch - look.y + turn.y * t, -1.34, 1.34);
    if (input.pressed('crouch') && !p.hidden) {
      if (p.crouch) {
        const blocks = this.getNearBoxes(p.p, 0.6, this.scratch.near2);
        if (!blocks.some((b) => overlapCircle(p.p, 0.25, 1.67, b))) p.crouch = false;
        else this.ui.toast('There is no room to stand here.', 2);
      } else p.crouch = true;
    }
    p.height += ((p.crouch ? 1.02 : 1.67) - p.height) * Math.min(1, dt * 12);
    if (input.pressed('flashlight')) {
      if (!p.light && s.battery <= 0) this.ui.toast(`The battery is empty. Hold ${this.label('crank')} to charge it.`, 4);
      else {
        p.light = !p.light;
        this.emit(p.p, 27, 'impact', 'player', 'metal');
      }
    }
    this.updateForward();
    p.crank = input.down('crank') && !p.hidden;
    s.battery = clamp(s.battery + (p.crank ? 15 : p.light ? -this.rules.drain : 0) * dt, 0, 100);
    if (s.battery === 0 && p.light) {
      p.light = false;
      if (!this.batteryWarned) {
        this.batteryWarned = true;
        this.ui.toast(`The battery is empty. Hold ${this.label('crank')} to charge the light. The crank makes noise.`, 6);
      }
    }
    p.breath = (p.crouch || !!p.hidden) && input.down('breath') && s.stamina > 4;
    // Keyboard runs while the key is held; a gamepad stick click or the touch pill toggles a run.
    if (input.pressed('sprint') && input.source !== 'keyboard') this.setSprintLatch(!this.sprintLatch);
    if (this.sprintLatch && (p.crouch || p.hidden || s.stamina <= 5)) this.setSprintLatch(false);
    let move = 0;
    let sprinting = false;
    if (!p.hidden) {
      const mv = input.vector('move');
      const mag = Math.hypot(mv.x, mv.y);
      if (mag > 0.05) {
        sprinting = (input.down('sprint') || this.sprintLatch) && !p.crouch && !p.crank && s.stamina > 5;
        const speed = (p.crank ? 1.15 : p.crouch ? 1.38 : sprinting ? 5.3 : 3.05) * Math.min(1, mag);
        const f = mv.y / mag;
        const r = mv.x / mag;
        const k = speed * dt;
        const before0 = p.p[0];
        const before2 = p.p[2];
        this.moveBody(p, (Math.sin(p.yaw) * f + p.right[0] * r) * k, (-Math.cos(p.yaw) * f + p.right[2] * r) * k, dt, p.height, 0.27);
        move = Math.hypot(p.p[0] - before0, p.p[2] - before2);
        p.step += move;
        if (p.step > (sprinting ? 1.7 : p.crouch ? 1.8 : 1.45)) {
          p.step = 0;
          const node = locateNode(this.city, p.p);
          const b = buildingAt(this.city, p.p);
          const room = b?.rooms.find((x) => x.id === node.room);
          const surface = roomSurface(room);
          const level = (p.crouch ? 28 : sprinting ? 66 : 47) + (surface === 'metal' ? 6 : surface === 'carpet' ? -10 : 0);
          this.emit(p.p, level, 'step', 'player', surface);
        }
      } else this.moveBody(p, 0, 0, dt, p.height, 0.27);
    }
    s.stamina = clamp(s.stamina + (p.breath ? -13 : sprinting ? -17 : 12) * dt, 0, 100);
    if (p.crank) {
      p.crankTime -= dt;
      if (p.crankTime <= 0) {
        p.crankTime = 0.36;
        this.emit(p.p, 65, 'crank', 'player');
      }
    }
    if (!p.breath && (p.hidden || s.stamina < 22)) {
      p.breathTime -= dt;
      if (p.breathTime <= 0) {
        p.breathTime = 2;
        this.emit(p.p, s.stamina < 22 ? 55 : 30, 'breath', 'player');
      }
    }
    p.noise = Math.max(0, p.noise - dt * 0.42);
    const bob = this.settings.headBob && move > 0 ? Math.sin(s.time * (sprinting ? 14 : 9)) * 0.02 : 0;
    if (p.hidden) {
      p.eye = [...p.hidden.eye];
      p.p = [...p.hidden.p];
    } else p.eye = add(p.p, [0, p.height + bob, 0]);
    for (const o of this.objects)
      if (o.kind === 'prop' && o.cooldown <= 0 && move > 0 && flat(o.position, p.p) < 0.5 && Math.abs(o.position[1] - p.p[1]) < 0.85) {
        o.velocity = [p.forward[0] * (sprinting ? 4 : 1.8), 2, p.forward[2] * (sprinting ? 4 : 1.8)];
        o.spin = 8;
        o.cooldown = 0.65;
        this.emit(o.position, sprinting ? 82 : 65, 'impact', 'prop', 'metal');
        input.rumble(0.25, 90);
      }
    if (input.pressed('throw') && !p.hidden) {
      if (s.decoys > 0) {
        s.decoys--;
        s.stats.thrown++;
        this.falling.push({ p: add(p.eye, scale(p.forward, 0.5)), v: add(scale(p.forward, 10), [0, 2.7, 0]), life: 7, bounced: 0, angle: 0 });
        this.ui.toast(`${s.decoys} ${s.decoys === 1 ? 'bottle' : 'bottles'} left.`, 2);
        input.rumble(0.15, 60);
      } else this.ui.toast('No bottles left.', 2);
    }
    const b = buildingAt(this.city, p.p);
    if (b) s.explored.add(b.id);
    if (input.pressed('interact')) this.interact();
    if (input.pressed('hints')) this.applySettings(validateSettings({ ...this.settings, hints: !this.settings.hints }));
    this.setMask(!!p.hidden);
  }

  setSprintLatch(on) {
    if (this.sprintLatch === on) return;
    this.sprintLatch = on;
    this.kit.touch?.setLabel('sprint', on ? 'Running' : 'Run');
  }

  emit(position, level, kind, source = 'world', surface) {
    const node = locateNode(this.city, position);
    const event = this.noise.emit({ time: this.session.time, position, node: node.id, level, kind, source, surface });
    if (source === 'player') this.player.noise = Math.max(this.player.noise, clamp((level - 22) / 64, 0, 1));
    const heard = propagateSound(this.nav, event, locateNode(this.city, this.player.p).id, this.player.eye || this.player.p);
    if (heard) this.sound.play(heard);
    return event;
  }

  toggleDoor(d, enemy = false) {
    d.open = enemy ? true : !d.open;
    d.slow = !enemy && this.player.crouch;
    this.nav.doorOpen.set(d.id, d.open);
    this.emit(d.position, enemy ? 62 : d.slow ? 35 : 65, 'door', enemy ? (typeof enemy === 'string' ? enemy : 'listener:door') : 'player');
  }

  targets() {
    const p = this.player;
    const s = this.session;
    const candidates = [];
    for (const d of this.doors) {
      const pos = add(d.position, [0, 1.1, 0]);
      if (distance(pos, p.eye) < 3) candidates.push({ kind: 'door', ref: d, position: pos, text: d.open ? 'Close door' : 'Open door' });
    }
    for (const o of this.objects)
      if (o.kind === 'locker' || o.kind === 'radio') {
        const pos = add(o.position, [0, o.kind === 'locker' ? 1.05 : 0, o.kind === 'locker' ? (o.yaw === 180 ? 0.54 : -0.54) : -0.105]);
        if (distance(pos, p.eye) < 2.65) candidates.push({ kind: o.kind, ref: o, position: pos, text: o.kind === 'locker' ? 'Hide in locker' : o.active ? 'Turn radio off' : 'Turn radio on' });
      }
    for (const f of this.city.fuses) if (!s.collected.has(f.id) && distance(f.position, p.eye) < 2.7) candidates.push({ kind: 'fuse', ref: f, position: f.position, text: 'Take fuse' });
    for (const l of this.logs) if (!s.logs.includes(l.id) && distance(l.position, p.eye) < 2.6) candidates.push({ kind: 'log', ref: l, position: l.position, text: 'Play signal log' });
    if (distance(this.gatePanel.position, p.eye) < 3)
      candidates.push({
        kind: 'gate',
        ref: this.gatePanel,
        position: add(this.gatePanel.position, [0, 0, -0.18]),
        text: s.collected.size < 3 ? 'Exit needs three fuses' : s.phase === 'scavenge' ? 'Start exit power' : s.phase === 'powering' ? 'Gate power is starting' : 'Gate is open',
      });
    for (const c of candidates) {
      const delta = sub(c.position, p.eye);
      const dist = Math.hypot(delta[0], delta[1], delta[2]);
      c.score = dot(scale(delta, 1 / Math.max(0.01, dist)), p.forward) - dist * 0.025;
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.filter((c) => c.score > 0.6 && this.sight(p.eye, c.position, c.ref.id));
  }

  interact() {
    const p = this.player;
    const s = this.session;
    if (p.hidden) {
      p.p = [...p.hidden.return];
      p.eye = add(p.p, [0, p.height, 0]);
      p.hidden = null;
      this.ui.toast('You left the locker.', 2);
      return;
    }
    const target = this.targets()[0];
    if (!target) return;
    const { kind, ref } = target;
    if (kind === 'door') this.toggleDoor(ref);
    else if (kind === 'fuse') {
      if (!this.sight(p.eye, add(ref.position, [0, 0.08, 0]))) return;
      if (s.collect(ref.id)) {
        this.emit(ref.position, 38, 'pickup', 'player');
        this.ui.toast(s.collected.size === 3 ? 'All fuses found. Go to the north gate.' : `Fuse collected. ${s.collected.size} of 3. Check the map for the next building.`, 6);
        this.input.rumble(0.3, 120);
        this.save();
      }
    } else if (kind === 'log') {
      if (s.logs.includes(ref.id)) return;
      s.logs.push(ref.id);
      this.ui.showLog(s.logs.length - 1, this.logs.length);
      // The tape plays out loud: a small sound a listener nearby can hear.
      this.emit(ref.position, 44, 'radio', 'player');
      this.input.rumble(0.12, 60);
      this.save();
    } else if (kind === 'radio') {
      if (!this.sight(p.eye, ref.position)) return;
      ref.active = !ref.active;
      ref.timer = 0;
      this.ui.toast(ref.active ? 'Radio on. Move away before the sound draws attention.' : 'Radio off.', 4);
    } else if (kind === 'locker') {
      // Store the real entry point. An enemy must see this entry to remember it.
      const back = [...p.p];
      for (const e of this.enemies) if (this.enemyCanSee(e)) e.brain.witnessLocker = ref.id;
      const side = ref.yaw === 180 ? 1 : -1;
      const eye = [ref.position[0], ref.position[1] + 1.55, ref.position[2] + side * 0.57];
      p.hidden = { id: ref.id, return: back, eye, p: [...p.p], position: ref.position };
      p.yaw = side === 1 ? Math.PI : 0;
      p.pitch = 0;
      this.setSprintLatch(false);
      this.ui.toast(`You are hidden. Hold ${this.label('breath')} to hold your breath. ${this.verb} ${this.label('interact')} to leave.`, 5);
      this.input.rumble(0.2, 80);
    } else if (kind === 'gate') {
      if (s.collected.size < 3) this.ui.toast(`The gate panel needs three fuses. You have ${s.collected.size}.`, 4);
      else if (s.startPower()) {
        this.emit(this.city.exit, 100, 'alarm', 'exit');
        this.ui.toast(`Power is starting. Stay alive for ${Math.round(s.alarmTime)} seconds.`, 5);
        this.input.rumble(0.5, 300);
        this.save();
      }
    }
  }

  objectUpdate(dt) {
    const near = this.scratch.near2;
    for (const d of this.doors) {
      const target = d.open ? (d.swing * Math.PI) / 2 : 0;
      if (d.angle === target) continue;
      const old = d.angle;
      d.angle += (target - d.angle) * Math.min(1, dt * (d.slow ? 1.4 : 4.8));
      if (Math.abs(d.angle - target) < 0.002) d.angle = target;
      // A closing door never shuts on the player: it swings back open.
      if (!d.open && Math.abs(d.angle - old) > 0.0001 && overlapCircle(this.player.p, 0.31, this.player.height, this.doorBox(d))) {
        d.open = true;
        this.nav.doorOpen.set(d.id, true);
      }
    }
    for (const o of this.objects) {
      o.cooldown = Math.max(0, o.cooldown - dt);
      if (o.kind === 'radio' && o.active) {
        o.timer -= dt;
        if (o.timer <= 0) {
          o.timer = 1.3;
          this.emit(o.position, 74, 'radio', o.id);
        }
      }
      if (o.kind !== 'prop') continue;
      const v = o.velocity;
      if (Math.hypot(v[0], v[1], v[2]) < 0.04) {
        o.spin *= 0.93;
        continue;
      }
      v[1] -= 12 * dt;
      const next = add(o.position, scale(v, dt));
      const feet = [next[0], next[1] - 0.14, next[2]];
      for (const b of this.getNearBoxes(feet, 0.3, near)) pushFromBox(feet, 0.14, 0.28, b);
      next[0] = feet[0];
      next[2] = feet[2];
      const floor = this.groundAt(next, next[1] + 0.2) + 0.14;
      if (next[1] < floor) {
        next[1] = floor;
        if (Math.abs(v[1]) > 1 && o.cooldown <= 0) {
          this.emit(next, Math.min(80, 50 + Math.abs(v[1]) * 4), 'impact', o.id, 'metal');
          o.cooldown = 0.5;
        }
        v[1] = Math.abs(v[1]) > 1 ? -v[1] * 0.24 : 0;
        v[0] *= Math.max(0, 1 - dt * 4);
        v[2] *= Math.max(0, 1 - dt * 4);
      }
      o.position = next;
      o.angle += o.spin * dt;
      o.spin *= Math.max(0, 1 - dt);
    }
    for (const b of this.falling) {
      b.life -= dt;
      b.v[1] -= 14 * dt;
      const old = b.p;
      b.p = add(b.p, scale(b.v, dt));
      const floor = this.groundAt(b.p, b.p[1] + 0.25) + 0.13;
      let hit = b.p[1] < floor;
      if (hit) b.p[1] = floor;
      const probe = [b.p[0], b.p[1] - 0.12, b.p[2]];
      for (const box of this.getNearBoxes(b.p, 0.35, near))
        if (overlapCircle(probe, 0.12, 0.24, box)) {
          b.p = old;
          b.v[0] *= -0.22;
          b.v[2] *= -0.22;
          hit = true;
          break;
        }
      if (hit && b.bounced < 3) {
        this.emit(b.p, 90 - b.bounced * 12, 'glass', 'bottle', 'glass');
        b.bounced++;
        b.v[1] = Math.abs(b.v[1]) * 0.27;
        b.v[0] *= 0.5;
        b.v[2] *= 0.5;
        if (b.bounced >= 3) b.life = Math.min(b.life, 1.3);
      }
      b.angle += dt * 420;
    }
    if (this.falling.some((b) => b.life <= 0)) this.falling = this.falling.filter((b) => b.life > 0);
    const target = this.session.phase === 'escape' || this.session.phase === 'won' ? 4.3 : 0;
    this.gate.lift += (target - this.gate.lift) * Math.min(1, dt * 1.2);
  }

  // ---- the listeners

  makeEnemies() {
    this.enemies = [];
    const wake = this.rules.wake;
    const street = this.city.nodes.filter((n) => n.kind === 'street' && distance(n.position, this.player.p) > 30);
    const pool = street.length ? street : this.city.nodes.filter((n) => n.kind === 'street');
    const collected = this.session.collected.size;
    for (let i = 0; i < wake.length; i++) {
      const point =
        i === 0
          ? pool.reduce((a, n) => (Math.abs(n.position[0] + 17) + Math.abs(n.position[2] - 5) < Math.abs(a.position[0] + 17) + Math.abs(a.position[2] - 5) ? n : a))
          : pool[Math.floor(pool.length * (i === 1 ? 0.8 : 0.45))];
      this.enemies.push({
        id: `listener:${i}`,
        // The third listener on a hunted night is blind: it hunts by sound alone, and faster.
        kind: i === 2 ? 'blind' : 'seer',
        wake: wake[i],
        p: [...point.position],
        node: point.id,
        brain: new EnemyBrain(),
        path: [],
        pathTarget: '',
        yaw: Math.PI,
        pulse: 3 + i,
        lastNoise: 0,
        vy: 0,
        stuck: 0,
        active: collected >= wake[i],
      });
    }
  }

  enemyCanSee(e) {
    const p = this.player;
    if (e.kind === 'blind' || p.hidden || !e.active || this.grace > 0) return false;
    const eye = add(e.p, [0, 1.6, 0]);
    const diff = sub(p.eye, eye);
    const dist = Math.hypot(diff[0], diff[1], diff[2]);
    const max = p.light && !p.crank ? 25 : p.crouch ? 9 : 17;
    if (dist > max || Math.abs(diff[1]) > 5) return false;
    const facing = [Math.sin(e.yaw), 0, -Math.cos(e.yaw)];
    if (dist > 2.6 && dot(normalize(diff), facing) < 0.2 && e.brain.state !== 'chase') return false;
    return this.sight(eye, p.eye);
  }

  senseEnemies(dt) {
    const p = this.player;
    const collected = this.session.collected.size;
    for (const e of this.enemies) {
      const wasActive = e.active;
      e.active = collected >= e.wake;
      if (!e.active) continue;
      if (!wasActive) this.ui.toast(e.kind === 'blind' ? 'Something that cannot see is listening now.' : 'Another listener is moving in the city.', 5);
      let sound;
      const threshold = e.kind === 'blind' ? this.rules.hearing - 4 : this.rules.hearing;
      for (const n of this.noise.events) {
        if (n.id <= e.lastNoise || n.source.startsWith('listener') || n.kind === 'enemy') continue;
        const h = propagateSound(this.nav, n, e.node, e.p);
        if (h && h.level > threshold && (!sound || h.level > sound.strength)) sound = { position: [...n.position], node: n.node, strength: h.level };
      }
      e.lastNoise = this.noise.events.at(-1)?.id || e.lastNoise;
      const sees = this.enemyCanSee(e);
      const sight = sees ? { position: [...p.p], node: locateNode(this.city, p.p).id } : undefined;
      const reached = e.brain.target ? distance(e.p, e.brain.target.position) < 1.1 : false;
      const before = e.brain.state;
      e.brain.update(dt, { sight, sound, reached });
      if (e.brain.state === 'chase' && before !== 'chase') {
        this.session.stats.spotted++;
        this.input.rumble(0.45, 220);
      }
      if (e.brain.witnessLocker && p.hidden?.id === e.brain.witnessLocker) e.brain.setTarget({ position: [...p.hidden.return], node: locateNode(this.city, p.hidden.return).id });
      if (!e.brain.target) {
        let pool;
        if (e.brain.state === 'search') {
          const memory = e.brain.memory?.node || e.node;
          pool = [memory, ...this.nav.neighbours(memory)];
        } else {
          pool = this.city.nodes.filter((n) => n.kind === 'street' && flat(n.position, e.p) > 10 && flat(n.position, e.p) < 70).map((n) => n.id);
          if (!pool.length) pool = this.nav.neighbours(e.node);
        }
        const node = this.nav.nodes.get(pool[Math.floor(this.rng.next() * pool.length)] || e.node);
        e.brain.setTarget({ position: [...node.position], node: node.id });
      }
      const target = e.brain.target;
      if (target && target.node !== e.pathTarget) {
        const route = this.nav.route(e.node, target.node);
        e.path = route ? route.nodes.slice(e.node === route.nodes[0] ? 1 : 0) : [];
        e.pathTarget = target.node;
      }
      if (!e.path.length && target && distance(e.p, target.position) < 1.1 && e.brain.state === 'roam') {
        e.brain.target = null;
        e.pathTarget = '';
      }
    }
  }

  enemyUpdate(dt) {
    let tension = 0;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const state = e.brain.state;
      const blind = e.kind === 'blind';
      e.pulse -= dt;
      if (e.pulse <= 0) {
        e.pulse = state === 'chase' ? 1.1 : blind ? (state === 'investigate' ? 1.6 : 2.8) : 3.6;
        this.emit(add(e.p, [0, 1.2, 0]), state === 'chase' ? 79 : blind ? 60 : 66, 'enemy', e.id, blind ? 'blind' : undefined);
      }
      const target = e.path.length ? this.nav.nodes.get(e.path[0])?.position : e.brain.target?.position;
      let speed = (state === 'chase' ? 3.05 : state === 'investigate' ? 2.0 : state === 'search' ? 1.15 : 0.96) * this.rules.speed;
      if (blind) speed *= state === 'investigate' ? 1.35 : 1.1;
      if (target) {
        const delta = sub(target, e.p);
        const len = Math.hypot(delta[0], delta[2]);
        if (len < 0.16 && Math.abs(delta[1]) < 0.3) {
          if (e.path.length) e.node = e.path.shift();
          else if (state === 'roam') {
            e.brain.target = null;
            e.pathTarget = '';
          }
        } else {
          for (const d of this.doors) if (!d.open && Math.abs(d.position[1] - e.p[1]) < 1 && flat(d.position, e.p) < 1.6) this.toggleDoor(d, e.id);
          const amount = Math.min(len, speed * dt);
          if (len > 0.01) {
            e.yaw = Math.atan2(delta[0], -delta[2]);
            const bx = e.p[0];
            const bz = e.p[2];
            this.moveBody(e, (delta[0] / len) * amount, (delta[2] / len) * amount, dt, 1.9, 0.29);
            if (Math.hypot(e.p[0] - bx, e.p[2] - bz) < amount * 0.2) e.stuck += dt;
            else e.stuck = 0;
            if (e.stuck > 0.9) {
              const side = e.id.endsWith('0') ? 1 : -1;
              this.moveBody(e, (-delta[2] / len) * 0.5 * dt * side, (delta[0] / len) * 0.5 * dt * side, dt, 1.9, 0.29);
            }
          }
        }
      }
      const dist = distance(e.p, this.player.p);
      if (state === 'chase') tension = Math.max(tension, clamp(1 - dist / 30, 0, 0.7));
      else if (blind && state === 'investigate') tension = Math.max(tension, clamp(1 - dist / 18, 0, 0.45));
      if (this.grace <= 0) {
        const hidden = this.player.hidden;
        if (!hidden && dist < 1.12 && this.sight(add(e.p, [0, 1.1, 0]), this.player.eye)) return this.caught(e);
        if (hidden && ((e.brain.witnessLocker === hidden.id && dist < 2.0) || (!this.player.breath && this.session.stamina < 15 && dist < 1.3))) return this.caught(e);
      }
    }
    this.setAlert(tension);
    return undefined;
  }

  /** A short beat before the results: the view turns to what found you. */
  caught(e) {
    if (this.dying) return;
    this.dying = { t: 1.1, enemy: e };
    this.setSprintLatch(false);
    this.setAlert(1);
    this.input.rumble(1, 650);
  }

  updateDying(dt) {
    const d = this.dying;
    const p = this.player;
    d.t -= dt;
    const head = [d.enemy.p[0], d.enemy.p[1] + 2.05, d.enemy.p[2]];
    const delta = sub(head, p.eye);
    const yaw = Math.atan2(delta[0], -delta[2]);
    const pitch = Math.atan2(delta[1], Math.hypot(delta[0], delta[2]));
    const k = Math.min(1, dt * 7);
    p.yaw = wrapAngle(p.yaw + wrapAngle(yaw - p.yaw) * k);
    p.pitch = clamp(p.pitch + (pitch - p.pitch) * k, -1.34, 1.34);
    this.updateForward();
    if (d.t <= 0) {
      this.dying = null;
      this.finish(false);
    }
  }

  finish(won) {
    const s = this.session;
    s.phase = won ? 'won' : 'lost';
    this.suspend();
    storage.write(SAVE, null);
    this.setMask(false);
    let best = 0;
    let newBest = false;
    if (won) {
      const key = `${s.difficulty}:${this.city.size}`;
      const r = this.records;
      r.escapes += 1;
      if (!r.fastest || s.time < r.fastest) r.fastest = s.time;
      const prev = r.best[key] || 0;
      if (!prev || s.time < prev) {
        r.best[key] = s.time;
        newBest = true;
      }
      best = r.best[key];
      storage.write(RECORDS, JSON.stringify(r));
      this.input.rumble(0.3, 200);
    }
    this.ui.end({ won, seed: this.city.seed, time: s.time, difficulty: s.difficulty, size: this.city.size, fuses: s.collected.size, logs: s.logs.length, logTotal: this.logs.length, spotted: s.stats.spotted, thrown: s.stats.thrown, best, newBest });
    this.setAlert(won ? 0 : 0.75);
  }

  // ---- the frame

  updateHUD() {
    const p = this.player;
    const s = this.session;
    const b = buildingAt(this.city, p.p);
    const target = p.hidden ? null : this.targets()[0];
    let location = b ? `BLOCK ${String.fromCharCode(65 + b.lotX)}${b.lotZ + 1} / ${b.kind.toUpperCase()} / FLOOR ${Math.floor((p.p[1] - G + 0.2) / H) + 1}` : 'STREET / NORTH EXIT';
    if (this.lockDenied && this.input.source === 'keyboard') location += ' / DRAG TO LOOK';
    const key = this.label('interact');
    this.ui.update({
      phase: s.phase,
      fuses: s.collected.size,
      alarm: s.alarmLeft,
      battery: s.battery,
      stamina: s.stamina,
      noise: p.noise,
      decoys: s.decoys,
      location,
      prompt: p.hidden ? `${key} / Leave locker` : target ? `${key} / ${target.text}` : '',
      hidden: !!p.hidden,
      breath: p.breath,
      crank: p.crank,
      fps: this.fps,
      lights: this.view.lightCount || 0,
    });
  }

  update(dt) {
    const input = this.input;
    if (this.dying) {
      this.session.update(dt);
      this.updateDying(dt);
      return;
    }
    if (input.pressed('pause')) {
      this.pause();
      return;
    }
    if (input.pressed('journal')) {
      this.openJournal();
      return;
    }
    this.grace = Math.max(0, this.grace - dt);
    this.session.update(dt);
    this.playerUpdate(dt);
    this.objectUpdate(dt);
    this.sound.listener(this.player.eye, this.player.forward);
    this.senseTimer -= dt;
    if (this.senseTimer <= 0) {
      this.senseTimer = 0.18;
      this.senseEnemies(0.18);
    }
    this.enemyUpdate(dt);
    if (!this.running || this.dying) return;
    const s = this.session;
    this.noise.prune(s.time);
    if (s.phase === 'powering') {
      this.alarmTick -= dt;
      if (this.alarmTick <= 0) {
        this.alarmTick = 1.6;
        this.emit(this.city.exit, 102, 'alarm', 'exit');
      }
    }
    if (s.phase !== this.lastPhase) {
      if (s.phase === 'escape') {
        this.ui.toast('The gate is open. Go north, through it.', 5);
        this.input.rumble(0.4, 250);
        this.save();
      }
      this.lastPhase = s.phase;
    }
    if (s.phase === 'escape' && this.gate.lift > 3.2 && this.player.p[2] > this.city.exit[2] + 1.9 && Math.abs(this.player.p[0]) < 3.1) {
      this.finish(true);
      return;
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.updateHUD();
    }
    this.saveTimer += dt;
    if (this.saveTimer > 25) {
      this.saveTimer = 0;
      this.save();
    }
  }

  /** The game's own menus with a gamepad: stick or D-pad moves, A selects, B or Start goes back. */
  menuInput(dt) {
    const input = this.input;
    if (input.pressed('menuOk')) this.ui.activate();
    else if (input.pressed('menuBack') || input.pressed('pause')) this.ui.cancel();
    else if (input.pressed('journal') && this.ui.screen === 'journal') this.resume();
    if (this.running || input.source !== 'gamepad') {
      this.navKey = 0;
      return;
    }
    const mv = input.vector('move');
    let dir = 0;
    let side = 0;
    if (Math.abs(mv.y) > 0.5 && Math.abs(mv.y) >= Math.abs(mv.x)) dir = mv.y > 0 ? -1 : 1;
    else if (Math.abs(mv.x) > 0.5) side = mv.x > 0 ? 1 : -1;
    const key = dir || side * 10;
    if (key !== this.navKey) {
      this.navKey = key;
      this.navTimer = 0.38;
      if (key) this.ui.navigate(dir, side);
    } else if (key) {
      this.navTimer -= dt;
      if (this.navTimer <= 0) {
        this.navTimer = 0.12;
        this.ui.navigate(dir, side);
      }
    }
  }

  save() {
    if (!this.hasRun || !this.city || !this.session || this.dying || ['won', 'lost'].includes(this.session.phase)) return false;
    const s = this.session;
    const p = this.player;
    return storage.write(
      SAVE,
      JSON.stringify({
        version: 1,
        generator: 1,
        seed: this.city.seed,
        size: this.city.size,
        difficulty: s.difficulty,
        time: s.time,
        phase: s.phase,
        alarmLeft: s.alarmLeft,
        collected: [...s.collected],
        battery: s.battery,
        stamina: s.stamina,
        decoys: s.decoys,
        player: p.hidden ? p.hidden.return : p.p,
        yaw: (p.yaw * 180) / Math.PI,
        pitch: (p.pitch * 180) / Math.PI,
        doors: Object.fromEntries(this.doors.map((d) => [d.id, d.open])),
        props: Object.fromEntries(this.objects.filter((o) => o.kind === 'prop').map((o) => [o.id, { position: o.position, rotation: [0, 0, 0, 1] }])),
        explored: [...s.explored],
        logs: [...s.logs],
        stats: { ...s.stats },
      })
    );
  }

  renderCamera() {
    const p = this.player;
    const cam = this.cam;
    cam.eye = p.eye;
    cam.forward = p.forward;
    cam.pitch = p.pitch;
    cam.yaw = p.yaw;
    cam.light = p.light && !p.crank && this.session.battery > 0;
    cam.flashOrigin = null;
    cam.body.position = p.hidden ? p.hidden.position : p.p;
    cam.body.height = p.hidden ? 1.5 : p.height;
    cam.body.yaw = p.yaw;
    if (cam.light) {
      // Keep the hand-held light on this side of a wall the player stands against.
      const flash = flashlightState(cam, this.settings);
      const delta = sub(flash.origin, p.eye);
      const length = Math.hypot(delta[0], delta[1], delta[2]);
      const direction = scale(delta, 1 / length);
      let allowed = length;
      for (const box of this.getNearBoxes(p.eye, 0.65, this.scratch.near2)) {
        const hit = rayBox(p.eye, direction, box, length);
        if (hit < allowed) allowed = Math.max(0.005, hit - 0.025);
      }
      cam.flashOrigin = add(p.eye, scale(direction, allowed));
    }
    return cam;
  }

  titleCamera(t) {
    const k = t * 0.06;
    const eye = [Math.sin(k) * 6 - 15, 3.4, -18 + Math.cos(k) * 4];
    const forward = normalize(sub([1, 2, 2], eye));
    return { eye, forward, yaw: Math.atan2(forward[0], -forward[2]), pitch: Math.asin(forward[1]), light: false, flashOrigin: null, body: null };
  }

  frame(rawDt, t) {
    const dt = Math.min(0.05, rawDt);
    this.fpsFrames++;
    if (t - this.fpsSince > 0.75) {
      this.fps = Math.round(this.fpsFrames / (t - this.fpsSince));
      this.fpsFrames = 0;
      this.fpsSince = t;
    }
    if (this.running) {
      try {
        this.update(dt);
      } catch (err) {
        console.error('[Night Signal]', err);
        this.suspend();
        this.ui.error(String(err?.message || err));
      }
    } else this.menuInput(dt);
    const camera = this.hasRun ? this.renderCamera() : this.titleCamera(t);
    this.view.render(camera, this, this.session.time);
  }

  diagnostics() {
    return {
      ...this.view.diagnostics(),
      backend: this.kit.backend,
      screen: this.ui.screen,
      running: this.running,
      seed: this.city.seed,
      difficulty: this.session.difficulty,
      buildings: this.city.buildings.length,
      floors: this.city.buildings.reduce((n, b) => n + b.floors, 0),
      doors: this.doors.length,
      player: [...this.player.p],
      phase: this.session.phase,
      collected: [...this.session.collected],
      logs: [...this.session.logs],
      time: this.session.time,
      alarmLeft: this.session.alarmLeft,
      activeEnemies: this.enemies.filter((e) => e.active).length,
      enemies: this.enemies.map((e) => ({ kind: e.kind, position: [...e.p], state: e.brain.state, active: e.active })),
      saveAvailable: !!parseSave(storage.read(SAVE)),
    };
  }
}

const settings = readSettings();
const kit = await boot({
  title: 'Night Signal',
  // The game's own Settings screen opens the kit panel (and F9 still does).
  gear: 'none',
  accent: '#c9e0b7',
  background: '#071217',
  input: actionDefs(settings.bindings),
});
const game = new Game(kit, settings);
window.nightSignal = { diagnostics: () => game.diagnostics() };
if (location.hash === '#test') window.__nightSignalTest = game;
kit.start((dt, t) => game.frame(dt, t));
