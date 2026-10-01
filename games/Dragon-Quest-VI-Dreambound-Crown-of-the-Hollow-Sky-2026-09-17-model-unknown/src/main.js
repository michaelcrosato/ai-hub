/**
 * Dreambound: Crown of the Hollow Sky — a pocket-sized quest RPG.
 *
 * Runs on the wall's shared 3D stack: three.js r186 (WebGPURenderer with the
 * WebGL2 fallback) started by kit/boot.js, input through kit.input actions
 * (keyboard, mouse, gamepad, touch), bloom through kit/post.js, sized sparks
 * through kit/points.js and static props baked with kit/instancing.js.
 */
import * as THREE from 'three/webgpu';
import { uniform, positionLocal, normalize, sin, mix, smoothstep, pow, max, length, vec2, vec3, vec4, float, uv, atan } from 'three/tsl';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';
import { bakeInstances } from 'kit/instancing.js';

/* ------------------------------------------------------------------ data */

const clamp = THREE.MathUtils.clamp;
const SAVE_KEY = 'dreambound-crown-save-v1';
const PREFS_KEY = 'dreambound-crown-prefs-v1';

const QUESTS = [
  'Speak to Elder Rowan in the village square.',
  'Find Puck the crown-maker on Moonstep Pass.',
  'Investigate the sky-rift near Puck.',
  'Find a way back from the Echo Below.',
  'Return to Puck on Moonstep Pass.',
  'Deliver the Starbell Crown to Elder Rowan.',
  'Defend the Starbell Festival.',
  'The festival is safe. Explore or begin again.',
  'Return to the humming sky-rift on Moonstep Pass.',
  'Find the Horned King’s throne in the Echo Below.',
  'The Hollow Sky is truly quiet. Explore or begin again.',
];
const LAST_STAGE = QUESTS.length - 1;

const HEROES = [
  { name: 'Kite', role: 'Wayfarer', max: 74, maxMp: 18, atk: 18, skill: 'Skycut', cost: 4, skillText: 'Heavy single hit', look: { coat: '#3869b2', hair: '#443027', accent: '#f0c552' } },
  { name: 'Mara', role: 'Luminary', max: 56, maxMp: 30, atk: 12, skill: 'Lumen', cost: 6, skillText: 'Heal the whole party', look: { coat: '#9d5ca3', hair: '#c28755', accent: '#77dce3', hat: true } },
  { name: 'Bram', role: 'Warden', max: 88, maxMp: 14, atk: 16, skill: 'Rally', cost: 4, skillText: 'Reduce the next enemy attack', look: { coat: '#557a54', hair: '#30261f', accent: '#e08955' } },
];
const ENEMIES = {
  moss: { name: 'Mossback Grumbler', hp: 86, atk: 12 },
  boss: { name: 'Riftjaw, Hollow-Sky Hound', hp: 215, atk: 18 },
  king: { name: 'The Horned King, Hollow Sovereign', hp: 340, atk: 20 },
};
const BATTLE_INTRO = {
  moss: 'A Mossback Grumbler lumbers onto the bridge!',
  boss: 'Riftjaw, Hollow-Sky Hound, tears out of the shadow!',
  king: 'The Horned King rises from his hollow throne!',
};
const BATTLE_WIN = {
  moss: 'The Mossback tumbles away. The mountain path is clear.',
  boss: 'Riftjaw cracks into violet sparks. The Starbell rings!',
  king: 'The Horned King shatters into falling stars. The hollow throne stands empty.',
};
const DIFFICULTY = {
  normal: { label: 'Normal', dmg: 1, hp: 1 },
  gentle: { label: 'Gentle', dmg: 0.65, hp: 0.8 },
};
const CHARM_HP = 12;
const LANTERN_SPOTS = [[-4.1, 11], [4.1, 19], [-4.1, 38.5], [4.1, 45], [4.1, 52.5]];
const HOUSES = [[-8, -5, '#e0bd7a', '#a65249', 0.12], [8, -5, '#d8c68b', '#6d6aa6', -0.12], [-10, 7, '#d9b789', '#8c5a46', 0.04], [10, 8, '#e2c985', '#6b7e96', -0.06]];
const THRONE_SPOT = { x: -8.5, z: 64 };
const WELL_RETURN = { x: 5.5, z: 58 };

const HELP = {
  keyboard: 'Move WASD / arrows · Talk and confirm E, Space, Enter · Dash Shift · Turn the camera by dragging the mouse · Zoom wheel · Menu Esc / P / M',
  gamepad: 'Move left stick / D-pad · Talk and confirm A · Hold B to dash · Turn the camera with the right stick · Zoom LB / RB · Menu Start · Undo a battle command B',
  touch: 'Move with the left thumb · ACTION talks · hold DASH · drag to turn the camera, pinch to zoom · ☰ opens the menu',
};
const BATTLE_HINT = {
  keyboard: '1–4 or arrows + Enter choose · Backspace undo · Esc menu',
  gamepad: 'D-pad + A choose · B undo · Start menu',
  touch: 'Tap a command · ☰ menu',
};
const CONTINUE_HINT = { keyboard: 'E / SPACE TO CONTINUE', gamepad: 'A TO CONTINUE', touch: 'TAP TO CONTINUE' };
const GLYPH = { keyboard: 'E', gamepad: 'A', touch: '' };

/* ------------------------------------------------------------------ storage */

const store = {
  load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  clear(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage blocked */
    }
  },
};
const prefs = { music: true, sfx: true, difficulty: 'normal', bestTime: 0, bestTrue: 0, ...(store.load(PREFS_KEY) || {}) };
if (!DIFFICULTY[prefs.difficulty]) prefs.difficulty = 'normal';
const savePrefs = () => store.save(PREFS_KEY, prefs);
const hasSave = () => !!store.load(SAVE_KEY);

/** Seeded random for the world layout, so Starweave looks the same every visit. */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(0x5ea7b311);

function fmtTime(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ DOM */

const gameRoot = document.querySelector('#game');
gameRoot.innerHTML = `
  <div id="ui">
    <div id="topbar" class="hidden">
      <div id="quest" class="panel-chip"><small>STARWEAVE JOURNAL</small><div id="questText"></div><div id="sideText" class="hidden"></div></div>
      <button id="menuBtn" type="button" aria-label="Menu">☰</button>
    </div>
    <div id="prompt"><span id="promptKey">E</span><span id="promptText">ACTION</span></div>
    <div id="toast" role="status"></div>
    <div id="dialog" class="hidden"><div id="dialogName"></div><div id="dialogText"></div><div id="dialogHint">TAP / E TO CONTINUE</div></div>
    <div id="battleHud" class="hidden">
      <div id="enemyPlate" class="panel-chip"><div id="enemyName"></div><div class="bar"><i id="enemyHp"></i></div></div>
      <button id="battleMenuBtn" type="button" aria-label="Menu">☰</button>
      <div id="partyCards"></div>
      <div id="dmgLayer"></div>
      <div id="battlePanel" class="panel-chip"><div id="battleMessage"></div><div id="commands"></div><div id="battleHint"></div></div>
    </div>
    <div id="pause" class="overlay hidden"><div class="title-card">
      <div class="eyebrow">TRAVEL NOTES</div><h2>Starweave Party</h2><div id="pauseQuest" class="title-copy"></div>
      <div id="pauseSide" class="side-list"></div>
      <div id="pauseParty" class="stats-grid"></div>
      <div class="menu-buttons">
        <button id="resumeBtn" type="button" class="primary">Resume</button>
        <button id="settingsBtn" type="button" class="secondary">Settings</button>
        <button id="musicBtn" type="button" class="secondary">Music: On</button>
        <button id="sfxBtn" type="button" class="secondary">Sound: On</button>
        <button id="diffBtn" type="button" class="secondary">Difficulty: Normal</button>
        <button id="resetBtn" type="button" class="secondary">Restart Slice</button>
      </div>
      <div id="pauseHelp" class="tiny"></div>
    </div></div>
    <div id="title" class="overlay"><div class="title-card">
      <div class="eyebrow">A POCKET-SIZED QUEST RPG</div><h1>Dreambound</h1><div class="subtitle">Crown of the Hollow Sky</div>
      <p class="title-copy">A mountain festival. A crack between two worlds. Three friends who were only supposed to fetch a crown.</p>
      <div class="menu-buttons">
        <button id="continueBtn" type="button" class="primary hidden">Continue</button>
        <button id="newBtn" type="button" class="primary">Start New Journey</button>
        <button id="titleSettingsBtn" type="button" class="secondary">Settings</button>
      </div>
      <div id="titleRecord" class="tiny hidden"></div>
      <div id="titleHelp" class="tiny">Original low-poly browser RPG · turn-based party combat · touch + keyboard + gamepad</div>
    </div></div>
    <div id="ending" class="overlay hidden"><div class="title-card">
      <div id="endEyebrow" class="eyebrow">VERTICAL SLICE COMPLETE</div><h1 id="endTitle">Starbell!</h1><div id="endSub" class="subtitle">The Hollow Sky is quiet—for now.</div>
      <p id="endCopy" class="title-copy">You crossed the Echo Below, recovered the crown, and defended Starweave. Free-roam is now open.</p>
      <div id="endStats" class="stats-grid"></div>
      <div id="endRecord" class="tiny"></div>
      <div class="menu-buttons">
        <button id="freeBtn" type="button" class="primary">Keep Exploring</button>
        <button id="againBtn" type="button" class="secondary">Play Again</button>
      </div>
    </div></div>
    <div id="fade"></div>
  </div>`;

const ui = {};
for (const id of [
  'topbar', 'questText', 'sideText', 'menuBtn', 'prompt', 'promptKey', 'promptText', 'toast', 'dialog', 'dialogName', 'dialogText', 'dialogHint',
  'battleHud', 'enemyName', 'enemyHp', 'battleMenuBtn', 'partyCards', 'dmgLayer', 'battleMessage', 'commands', 'battleHint',
  'pause', 'pauseQuest', 'pauseSide', 'pauseParty', 'pauseHelp', 'resumeBtn', 'settingsBtn', 'musicBtn', 'sfxBtn', 'diffBtn', 'resetBtn',
  'title', 'continueBtn', 'newBtn', 'titleSettingsBtn', 'titleRecord', 'titleHelp',
  'ending', 'endEyebrow', 'endTitle', 'endSub', 'endCopy', 'endStats', 'endRecord', 'freeBtn', 'againBtn', 'fade',
]) ui[id] = document.getElementById(id);

/* ------------------------------------------------------------------ boot */

const kit = await boot({
  title: 'Dreambound: Crown of the Hollow Sky',
  accent: '#f4cb5e',
  background: '#17162a',
  gear: 'none', // the game's own menu has a Settings button (kit.menu.open); F9 works too
  holdLoading: true,
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    act: { keys: ['KeyE', 'Space', 'Enter', 'NumpadEnter'], gamepad: ['A', 'X'], touch: 'Action' },
    dash: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['B', 'LT'], touch: 'Dash' },
    back: { keys: ['Backspace', 'KeyK'], gamepad: ['B'] },
    pause: { keys: ['Escape', 'KeyP', 'KeyM'], gamepad: ['Start'] },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    cmd1: { keys: ['Digit1', 'Numpad1'] },
    cmd2: { keys: ['Digit2', 'Numpad2'] },
    cmd3: { keys: ['Digit3', 'Numpad3'] },
    cmd4: { keys: ['Digit4', 'Numpad4'] },
  },
});
const input = kit.input;
kit.loading.progress(0.7, 'Building Starweave…');
kit.renderer.toneMapping = THREE.ACESFilmicToneMapping;
kit.renderer.toneMappingExposure = 1.08;
kit.renderer.shadowMap.enabled = true;
kit.renderer.shadowMap.type = THREE.PCFShadowMap;

/* ------------------------------------------------------------------ audio */

const MUSIC = {
  field: [262, 330, 392, 523, 392, 330, 294, 392],
  echo: [220, 277, 330, 415, 330, 277, 247, 311],
  battle: [196, 196, 247, 294, 196, 330, 294, 247],
  king: [147, 175, 220, 262, 233, 175, 196, 147],
};

class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.nextNote = 0;
    this.step = 0;
    this.mode = 'field';
    this.held = false;
    this.ducked = false;
  }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.23;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.applyPrefs();
      }
      if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume().catch(() => {});
    } catch {
      /* no audio on this device */
    }
  }
  applyPrefs() {
    if (!this.ctx) return;
    this.musicBus.gain.value = prefs.music ? (this.ducked ? 0.35 : 1) : 0;
    this.sfxBus.gain.value = prefs.sfx ? 1 : 0;
  }
  /** Quieter music while the game's own menu is open. */
  duck(on) {
    this.ducked = on;
    this.applyPrefs();
  }
  /** The kit paused the loop (settings panel, hidden tab): hold the sound with it. */
  hold(on) {
    this.held = on;
    if (!this.ctx) return;
    (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => {});
  }
  tone(freq, dur = 0.12, type = 'triangle', vol = 0.15, when = 0, bus = this.sfxBus) {
    if (!this.ctx || !bus) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  sfx(name) {
    if (!this.ctx || !prefs.sfx) return;
    const T = (f, d, ty, v, w) => this.tone(f, d, ty, v, w);
    if (name === 'talk') { T(640, 0.06, 'square', 0.06); T(790, 0.05, 'square', 0.035, 0.05); }
    if (name === 'pickup') [523, 659, 784].forEach((n, i) => T(n, 0.16, 'triangle', 0.1, i * 0.07));
    if (name === 'hit') { T(95, 0.11, 'sawtooth', 0.14); T(160, 0.07, 'square', 0.06, 0.02); }
    if (name === 'heal') [440, 554, 659, 880].forEach((n, i) => T(n, 0.22, 'sine', 0.09, i * 0.06));
    if (name === 'portal') [180, 240, 360, 520].forEach((n, i) => T(n, 0.42, 'sine', 0.07, i * 0.08));
    if (name === 'win') [392, 523, 659, 784, 1046].forEach((n, i) => T(n, 0.34, 'triangle', 0.11, i * 0.1));
    if (name === 'guard') { T(220, 0.18, 'square', 0.07); T(330, 0.16, 'triangle', 0.05, 0.05); }
    if (name === 'tick') T(880, 0.04, 'square', 0.025);
    if (name === 'select') { T(660, 0.06, 'triangle', 0.06); T(990, 0.05, 'triangle', 0.04, 0.04); }
    if (name === 'undo') { T(520, 0.05, 'triangle', 0.05); T(390, 0.06, 'triangle', 0.04, 0.04); }
    if (name === 'lantern') [392, 587, 784, 1175].forEach((n, i) => T(n, 0.32, 'sine', 0.08, i * 0.08));
    if (name === 'encounter') [220, 330, 262, 392].forEach((n, i) => T(n, 0.12, 'square', 0.07, i * 0.06));
    if (name === 'ko') { T(140, 0.3, 'sawtooth', 0.1); T(90, 0.4, 'sine', 0.08, 0.1); }
    if (name === 'charge') [110, 147, 196, 262].forEach((n, i) => T(n, 0.4, 'sine', 0.08, i * 0.12));
    if (name === 'thorns') { T(330, 0.1, 'sawtooth', 0.08); T(247, 0.14, 'sawtooth', 0.07, 0.06); }
  }
  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.nextNote = 0;
    this.step = 0;
  }
  update() {
    if (!this.ctx || this.ctx.state !== 'running' || !prefs.music) return;
    const now = this.ctx.currentTime;
    if (now < this.nextNote) return;
    const fast = this.mode === 'battle' || this.mode === 'king';
    const seq = MUSIC[this.mode] || MUSIC.field;
    const base = seq[this.step % seq.length];
    this.tone(base, fast ? 0.14 : 0.35, this.mode === 'echo' ? 'sine' : 'triangle', fast ? 0.055 : 0.032, 0, this.musicBus);
    if (this.step % 2 === 0) this.tone(base / 2, 0.32, 'sine', 0.018, 0.02, this.musicBus);
    this.step++;
    this.nextNote = now + (fast ? (this.mode === 'king' ? 0.21 : 0.23) : 0.42);
  }
}
const audio = new AudioKit();
// Browsers start audio only from a gesture: try on every press until it runs. A touch counts
// as a gesture on pointerup/touchend, not on pointerdown, so listen for those too.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) addEventListener(type, () => audio.unlock(), true);
kit.onPause((paused) => audio.hold(paused));

/* ------------------------------------------------------------------ helpers */

const gTime = uniform(0); // game clock for every animated material
const matCache = new Map();
const geoCache = new Map();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03, flatShading: true, ...opts });
}
/** One material per colour (and options) for the static world. */
function sharedMat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = mat(color, opts)));
  return m;
}
/** One geometry per shape and size, shared by every mesh that uses it. */
function geo(kind, ...args) {
  const key = kind + args.join(',');
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = new THREE[kind](...args)));
  return g;
}
const asMat = (c) => (typeof c === 'string' ? sharedMat(c) : c);
function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function box(w, h, d, c) {
  return shadow(new THREE.Mesh(geo('BoxGeometry', w, h, d), asMat(c)));
}
function cyl(rt, rb, h, seg, c) {
  return shadow(new THREE.Mesh(geo('CylinderGeometry', rt, rb, h, seg), asMat(c)));
}
/** Static repeated props: one InstancedMesh, baked into a single plain mesh. */
function batch(geometry, material, items, { shadows = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  items.forEach((it, i) => {
    _q.setFromEuler(_e.set(it.rx || 0, it.ry || 0, it.rz || 0));
    _p.set(it.x, it.y, it.z);
    _s.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1);
    mesh.setMatrixAt(i, _m4.compose(_p, _q, _s));
    if (it.color) mesh.setColorAt(i, _c.set(it.color));
  });
  mesh.castShadow = mesh.receiveShadow = shadows;
  return bakeInstances(mesh);
}
/** Keep a camera's aspect in step, and widen a portrait view so the scene still fits. */
function fitView(cam, baseFov, minHFov, onFit) {
  kit.onResize((w, h) => {
    const aspect = w / Math.max(1, h);
    cam.aspect = aspect;
    const need = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(minHFov) / 2) / aspect));
    cam.fov = Math.min(80, Math.max(baseFov, need));
    cam.updateProjectionMatrix();
    onFit?.(cam);
  });
  return cam;
}
function turnToward(a, b, k) {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * k;
}

/* ------------------------------------------------------------------ game-time timers */
// Battle beats, fades and flashes run on the game clock, so the settings panel
// and the pause menu freeze them instead of letting them finish unseen.

const timers = [];
const dueTimers = [];
function wait(ms) {
  return new Promise((resolve) => timers.push({ t: ms / 1000, fn: resolve }));
}
function later(ms, fn) {
  timers.push({ t: ms / 1000, fn });
}
function animate(ms, step) {
  return new Promise((resolve) => timers.push({ t: ms / 1000, dur: ms / 1000, step, fn: resolve }));
}
function runTimers(dt) {
  if (!timers.length) return;
  dueTimers.length = 0;
  for (let i = timers.length - 1; i >= 0; i--) {
    const tm = timers[i];
    tm.t -= dt;
    if (tm.step) tm.step(Math.min(1, 1 - Math.max(0, tm.t) / tm.dur));
    if (tm.t <= 0) {
      timers.splice(i, 1);
      dueTimers.push(tm.fn);
    }
  }
  for (let i = dueTimers.length - 1; i >= 0; i--) dueTimers[i]();
}

/* ------------------------------------------------------------------ materials in TSL */

function createSky(top = '#6e8fe8', bottom = '#f6dba3', accent = '#c7f1ff') {
  const uTop = uniform(new THREE.Color(top));
  const uBottom = uniform(new THREE.Color(bottom));
  const uAccent = uniform(new THREE.Color(accent));
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  const dir = normalize(positionLocal);
  const h = dir.y.mul(0.5).add(0.5);
  const band = sin(positionLocal.x.mul(0.035).add(gTime.mul(0.08))).mul(0.02);
  const base = mix(uBottom, uTop, smoothstep(0.08, 0.88, h.add(band)));
  const glow = pow(max(float(1).sub(length(dir.xz.sub(vec2(0.32, -0.22)))), 0.0001), 7);
  material.colorNode = base.add(uAccent.mul(glow).mul(0.12));
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 12), material);
  mesh.renderOrder = -1;
  return { mesh, top: uTop, bottom: uBottom };
}

function createWater(w = 18, d = 5) {
  const colorA = uniform(new THREE.Color('#347dc2'));
  const colorB = uniform(new THREE.Color('#82e5d4'));
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  material.positionNode = positionLocal.add(vec3(0, 0, sin(positionLocal.x.add(gTime).mul(2)).mul(0.07)));
  const wave = sin(uv().x.mul(18).add(uv().y.mul(10)).add(gTime.mul(1.8))).mul(0.5).add(0.5);
  material.colorNode = vec4(mix(colorA, colorB, wave.mul(0.35).add(0.18)), 0.78);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 32, 4), material);
  mesh.rotation.x = -Math.PI / 2;
  return { mesh, colorA, colorB };
}

let riftMats = null;
function riftMaterials() {
  if (riftMats) return riftMats;
  const a = uniform(new THREE.Color('#7ae7ff'));
  const b = uniform(new THREE.Color('#a762ff'));
  const ring = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const q = sin(uv().x.mul(45).add(gTime.mul(5))).mul(0.5).add(0.5);
  ring.colorNode = vec4(mix(a, b, q), q.mul(0.28).add(0.68));
  const disk = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const p = uv().sub(0.5);
  const r = length(p);
  const n = sin(r.mul(22).sub(gTime.mul(5)).add(atan(p.y, p.x).mul(4)));
  disk.colorNode = vec4(0.34, 0.76, 1.0, float(1).sub(smoothstep(0.15, 0.5, r)).mul(n.mul(0.22).add(0.32)));
  riftMats = { ring, disk };
  return riftMats;
}

function createRift() {
  const g = new THREE.Group();
  const { ring: ringMat, disk: diskMat } = riftMaterials();
  const ring = new THREE.Mesh(geo('TorusGeometry', 2.1, 0.23, 8, 32), ringMat);
  ring.position.y = 2.1;
  const disk = new THREE.Mesh(geo('CircleGeometry', 1.82, 28), diskMat);
  disk.position.y = 2.1;
  g.add(ring, disk);
  const positions = new Float32Array(42 * 3);
  for (let i = 0; i < 42; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.8 + rand() * 1.4;
    positions.set([Math.cos(a) * r, 0.35 + rand() * 3.6, Math.sin(a) * r * 0.35], i * 3);
  }
  const motes = createPoints({ positions, size: 0.09, sizeAttenuation: true, material: { color: '#a8f2ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false } });
  g.add(motes.object);
  return { group: g, pts: motes.object };
}

/** Sized, fading sparks from one pool (WebGPU draws plain Points at 1 px). */
class SparkPool {
  constructor(parent, capacity) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    for (let i = 0; i < capacity; i++) this.positions[i * 3 + 1] = -999;
    this.colors = new Float32Array(capacity * 3);
    this.origin = new Float32Array(capacity * 3);
    this.offset = new Float32Array(capacity * 3);
    this.tint = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.cursor = 0;
    this.live = 0;
    this.points = createPoints({
      positions: this.positions,
      colors: this.colors,
      size: 0.12,
      sizeAttenuation: true,
      material: { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending },
    });
    parent.add(this.points.object);
  }
  burst(at, color, count = 12) {
    _c.set(color);
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const j = i * 3;
      this.origin[j] = at.x;
      this.origin[j + 1] = at.y;
      this.origin[j + 2] = at.z;
      this.offset[j] = (Math.random() - 0.5) * 1.4;
      this.offset[j + 1] = 0.5 + Math.random() * 1.6;
      this.offset[j + 2] = (Math.random() - 0.5) * 1.4;
      this.tint[j] = _c.r;
      this.tint[j + 1] = _c.g;
      this.tint[j + 2] = _c.b;
      this.life[i] = 1;
    }
    this.live = this.capacity;
  }
  update(dt) {
    if (this.live <= 0) return;
    let live = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      const j = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[j + 1] = -999;
        this.colors[j] = this.colors[j + 1] = this.colors[j + 2] = 0;
        continue;
      }
      live++;
      const a = this.life[i];
      const t = 1 - a;
      const spread = 1 + t * 0.7;
      this.positions[j] = this.origin[j] + this.offset[j] * spread;
      this.positions[j + 1] = this.origin[j + 1] + this.offset[j + 1] + t * 0.55;
      this.positions[j + 2] = this.origin[j + 2] + this.offset[j + 2] * spread;
      this.colors[j] = this.tint[j] * a;
      this.colors[j + 1] = this.tint[j + 1] * a;
      this.colors[j + 2] = this.tint[j + 2] * a;
    }
    this.live = live;
    this.points.positions.needsUpdate = true;
    this.points.colors.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ models */

function makeCharacter({ coat = '#4a78c2', hair = '#5a3b2c', skin = '#f1bd8c', accent = '#f1d05d', hat = false } = {}, matOpts = {}) {
  // Each character owns its few materials, so a hit flash or a ghostly fade touches only it.
  const local = new Map();
  const m = (c) => {
    let x = local.get(c);
    if (!x) local.set(c, (x = mat(c, matOpts)));
    return x;
  };
  const g = new THREE.Group();
  const body = box(0.68, 0.8, 0.46, m(coat)); body.position.y = 0.95; g.add(body);
  const belt = box(0.73, 0.12, 0.49, m('#47372e')); belt.position.y = 0.72; g.add(belt);
  const head = shadow(new THREE.Mesh(geo('IcosahedronGeometry', 0.38, 1), m(skin))); head.position.y = 1.62; g.add(head);
  const hairMesh = shadow(new THREE.Mesh(geo('ConeGeometry', 0.39, 0.28, 7), m(hair))); hairMesh.position.y = 1.91; hairMesh.rotation.y = 0.3; g.add(hairMesh);
  const armL = box(0.18, 0.66, 0.2, m(coat)), armR = armL.clone(); armL.position.set(-0.44, 0.98, 0); armR.position.set(0.44, 0.98, 0); g.add(armL, armR);
  const legL = box(0.24, 0.62, 0.26, m('#37405e')), legR = legL.clone(); legL.position.set(-0.2, 0.28, 0); legR.position.set(0.2, 0.28, 0); g.add(legL, legR);
  const bootL = box(0.27, 0.18, 0.4, m('#302723')), bootR = bootL.clone(); bootL.position.set(-0.2, -0.06, 0.06); bootR.position.set(0.2, -0.06, 0.06); g.add(bootL, bootR);
  const scarf = box(0.82, 0.12, 0.5, m(accent)); scarf.position.y = 1.29; g.add(scarf);
  if (hat) {
    const brim = cyl(0.49, 0.49, 0.08, 8, m(accent)); brim.position.y = 1.92;
    const cap = cyl(0.25, 0.38, 0.36, 8, m(accent)); cap.position.y = 2.1;
    g.add(brim, cap);
  }
  g.userData.bob = rand() * 6;
  g.userData.materials = [...local.values()];
  return g;
}

function makeNPC(colors) {
  // Transparent from the start: the Echo Below fades them by opacity alone, no shader rebuild.
  const g = makeCharacter(colors, { transparent: true });
  g.scale.setScalar(0.92);
  return g;
}

function makeMonster(type = 'moss') {
  const local = new Map();
  const m = (c, o) => {
    const key = c + (o ? JSON.stringify(o) : '');
    let x = local.get(key);
    if (!x) local.set(key, (x = mat(c, o)));
    return x;
  };
  const g = new THREE.Group();
  if (type === 'boss') {
    const body = shadow(new THREE.Mesh(geo('DodecahedronGeometry', 1.38, 0), m('#6750a4', { emissive: '#2b1649', emissiveIntensity: 0.35 }))); body.scale.y = 1.18; body.position.y = 1.45; g.add(body);
    const jaw = box(1.72, 0.5, 0.86, m('#3b2b5d')); jaw.position.set(0, 0.78, 0.26); g.add(jaw);
    for (const sx of [-0.55, 0.55]) {
      const eye = shadow(new THREE.Mesh(geo('OctahedronGeometry', 0.18, 0), m('#ffdf72', { emissive: '#ffb020', emissiveIntensity: 2 }))); eye.position.set(sx, 1.65, 1.05); g.add(eye);
    }
    for (let i = 0; i < 5; i++) {
      const horn = cyl(0, 0.13, 0.7, 5, m('#d6c9e8')); horn.rotation.z = (i - 2) * 0.18; horn.position.set((i - 2) * 0.48, 2.55 - Math.abs(i - 2) * 0.08, -0.05); g.add(horn);
    }
    const footL = cyl(0.38, 0.48, 0.55, 6, m('#3d315d')), footR = footL.clone(); footL.position.set(-0.72, 0.23, 0); footR.position.set(0.72, 0.23, 0); g.add(footL, footR);
    g.userData.top = 3.1;
  } else if (type === 'king') {
    // The horned king from Kite's dreams: robe, cape, a crown of horns and a moonstone staff.
    const robe = cyl(0.8, 1.3, 2.2, 7, m('#2d2245')); robe.position.y = 1.1; g.add(robe);
    const cape = shadow(new THREE.Mesh(geo('ConeGeometry', 1.45, 2.9, 6), m('#4b2a5e'))); cape.position.set(0, 1.5, -0.42); cape.scale.z = 0.45; g.add(cape);
    const chest = shadow(new THREE.Mesh(geo('DodecahedronGeometry', 0.82, 0), m('#4b3a74', { emissive: '#1d0f38', emissiveIntensity: 0.4 }))); chest.position.y = 2.45; chest.scale.set(1.15, 0.9, 0.8); g.add(chest);
    const mantle = box(2.1, 0.34, 0.95, m('#3b2b5d')); mantle.position.y = 2.95; g.add(mantle);
    for (const sx of [-1.08, 1.08]) {
      const arm = box(0.34, 1.35, 0.38, m('#3b2b5d')); arm.position.set(sx, 2.2, 0.1); g.add(arm);
    }
    const head = shadow(new THREE.Mesh(geo('IcosahedronGeometry', 0.5, 0), m('#2a2140'))); head.position.y = 3.45; g.add(head);
    for (const sx of [-0.2, 0.2]) {
      const eye = shadow(new THREE.Mesh(geo('OctahedronGeometry', 0.1, 0), m('#bff6ff', { emissive: '#7ae7ff', emissiveIntensity: 2.2 }))); eye.position.set(sx, 3.5, 0.43); g.add(eye);
    }
    const band = cyl(0.5, 0.55, 0.2, 8, m('#d9b34a', { emissive: '#6b4a10', emissiveIntensity: 0.3 })); band.position.y = 3.86; g.add(band);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const horn = cyl(0, 0.1, 0.7, 5, m('#d6c9e8'));
      horn.position.set(Math.cos(a) * 0.46, 4.25, Math.sin(a) * 0.46);
      horn.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      g.add(horn);
    }
    for (const sx of [-1, 1]) {
      const big = cyl(0, 0.17, 1.2, 5, m('#d6c9e8')); big.position.set(sx * 0.72, 3.85, -0.05); big.rotation.z = -sx * 0.95; g.add(big);
    }
    const staff = cyl(0.06, 0.06, 3.6, 6, m('#694b34')); staff.position.set(1.42, 1.8, 0.4); g.add(staff);
    const orb = shadow(new THREE.Mesh(geo('IcosahedronGeometry', 0.26, 1), m('#c9a8ff', { emissive: '#7a3dff', emissiveIntensity: 1.8 }))); orb.position.set(1.42, 3.72, 0.4); g.add(orb);
    g.scale.setScalar(0.92);
    g.userData.top = 4.5;
  } else {
    const body = shadow(new THREE.Mesh(geo('IcosahedronGeometry', 0.85, 1), m('#5ca86c'))); body.scale.set(1.15, 0.82, 1); body.position.y = 0.82; g.add(body);
    const snout = box(0.75, 0.36, 0.5, m('#75bf7c')); snout.position.set(0, 0.78, 0.67); g.add(snout);
    for (const sx of [-0.28, 0.28]) {
      const eye = shadow(new THREE.Mesh(geo('OctahedronGeometry', 0.11, 0), m('#fff0b0', { emissive: '#ffd45d', emissiveIntensity: 1.2 }))); eye.position.set(sx, 1.14, 0.72); g.add(eye);
    }
    const leaf = new THREE.Mesh(geo('ConeGeometry', 0.34, 0.7, 5), m('#3a7e50')); leaf.position.set(0.25, 1.65, 0); leaf.rotation.z = -0.4; g.add(leaf);
    g.userData.top = 2.0;
  }
  g.userData.materials = [...local.values()];
  return g;
}

function makeHouse(x, z, bodyColor = '#d9bd7c', roofColor = '#a45b4f', rot = 0, windowMat) {
  const g = new THREE.Group();
  const base = box(4.4, 2.65, 3.8, bodyColor); base.position.y = 1.32; g.add(base);
  const roof = shadow(new THREE.Mesh(geo('ConeGeometry', 3.25, 2.0, 4), sharedMat(roofColor))); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.8; roof.position.y = 3.25; g.add(roof);
  const door = box(0.85, 1.55, 0.12, '#6b4936'); door.position.set(0, 0.78, 1.96); g.add(door);
  for (const sx of [-1.2, 1.2]) {
    const w = box(0.72, 0.65, 0.1, windowMat); w.position.set(sx, 1.65, 1.98); g.add(w);
  }
  const chimney = box(0.5, 1.35, 0.5, '#73544b'); chimney.position.set(1.3, 3.65, -0.55); g.add(chimney);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

function makeWell(x, z) {
  const g = new THREE.Group();
  const stones = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    stones.push({ x: Math.cos(a) * 1.05, y: 0.32 + (i % 2) * 0.05, z: Math.sin(a) * 1.05, ry: -a });
  }
  g.add(batch(geo('BoxGeometry', 0.58, 0.62, 0.48), sharedMat('#8b8a91'), stones));
  const inner = new THREE.Mesh(geo('CylinderGeometry', 0.84, 0.84, 0.12, 24), sharedMat('#1a3354', { emissive: '#244d75', emissiveIntensity: 0.5 })); inner.position.y = 0.39; g.add(inner);
  const postL = box(0.18, 2.2, 0.18, '#694b34'), postR = postL.clone(); postL.position.set(-1.0, 1.2, 0); postR.position.set(1.0, 1.2, 0); g.add(postL, postR);
  const beam = box(2.35, 0.2, 0.2, '#694b34'); beam.position.y = 2.22; g.add(beam);
  g.position.set(x, 0, z);
  return g;
}

/* ------------------------------------------------------------------ the journey's state (colliders and prompts read it) */

const freshState = () => ({
  stage: 0, echo: false, herbs: 3, complete: false, fieldWin: false,
  chestOpen: false, lanterns: [false, false, false, false, false], charm: false, kingDown: false,
  px: 0, pz: -1, time: 0, wins: 0,
});
let state = freshState();

/* ------------------------------------------------------------------ the field: Starweave and Moonstep Pass */

const scene = new THREE.Scene();
const camera = fitView(new THREE.PerspectiveCamera(48, 1, 0.1, 260), 48, 40);
const theme = []; // materials that change colour in the Echo Below
const boxes = []; // axis-aligned colliders {x, z, w, d}
const circles = []; // round colliders {x, z, r, on?}
const interactables = [];
const npcs = [];

const fieldSky = createSky();
scene.add(fieldSky.mesh);
scene.fog = new THREE.FogExp2('#b8c8ce', 0.013);
scene.add(new THREE.HemisphereLight('#bfe4ff', '#706150', 1.55));
const sun = new THREE.DirectionalLight('#fff0c8', 3.1);
const SUN_OFFSET = new THREE.Vector3(-18, 28, -10);
sun.position.copy(SUN_OFFSET);
sun.castShadow = true;
kit.shadow(sun, 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 30, bottom: -30, near: 1, far: 90 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight('#75a7ff', 0.7);
rim.position.set(16, 12, 30);
scene.add(rim);

const groundMat = mat('#7abf69');
theme.push({ m: groundMat, real: '#7abf69', echo: '#6876a2' });
const ground = shadow(new THREE.Mesh(new THREE.PlaneGeometry(54, 100, 1, 1), groundMat));
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.08, 25);
scene.add(ground);
const villageMat = mat('#8fcf78');
theme.push({ m: villageMat, real: '#8fcf78', echo: '#7583ac' });
const village = shadow(new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 0.85, 12), villageMat));
village.position.set(0, -0.48, 0);
scene.add(village);
const passMat = mat('#a98e6d');
theme.push({ m: passMat, real: '#a98e6d', echo: '#77708f' });
const path = shadow(new THREE.Mesh(new THREE.PlaneGeometry(6.5, 64), passMat));
path.rotation.x = -Math.PI / 2;
path.position.set(0, 0.005, 29);
scene.add(path);

const water = createWater(24, 5.5);
water.mesh.position.set(0, 0.03, 29.5);
scene.add(water.mesh);
const planks = [];
for (let x = -9; x <= 9; x += 1.55) planks.push({ x, y: 0.18, z: 29.5 });
scene.add(batch(geo('BoxGeometry', 1.35, 0.24, 5.3), sharedMat('#8b603f'), planks));
// Bridge rails along both banks, open where the path crosses (they used to block it).
const railParts = [];
for (const z of [27.2, 31.8]) {
  for (const sx of [-1, 1]) {
    railParts.push({ kind: 'rail', x: sx * 6.525, y: 0.72, z, sx: 6.25 });
    for (const px of [3.5, 6.5, 9.5]) railParts.push({ kind: 'post', x: sx * px, y: 0.45, z });
    boxes.push({ x: sx * 6.53, z, w: 6.4, d: 0.5 });
  }
}
scene.add(batch(geo('BoxGeometry', 1, 0.18, 0.16), sharedMat('#68462f'), railParts.filter((r) => r.kind === 'rail')));
scene.add(batch(geo('BoxGeometry', 0.16, 1.15, 0.16), sharedMat('#68462f'), railParts.filter((r) => r.kind === 'post')));
// The river beyond the bridge deck is water, not floor.
for (const sx of [-1, 1]) boxes.push({ x: sx * 11, z: 29.5, w: 2.6, d: 5.5 });

const insideHouse = (x, z, pad) => HOUSES.some((h) => Math.abs(x - h[0]) < 2.6 + pad && Math.abs(z - h[1]) < 2.35 + pad);
const inRiver = (x, z, pad) => z > 26.75 - pad && z < 32.25 + pad && Math.abs(x) < 12.2 + pad;

// Trees: one baked trunk mesh and one baked canopy mesh for the whole valley.
const trunks = [];
const canopies = [];
for (let i = 0, tries = 0; trunks.length < 23 && tries < 600; tries++) {
  const x = (i % 2 ? 1 : -1) * (10 + rand() * 11);
  const z = -9 + rand() * 75;
  const s = 0.75 + rand() * 0.55;
  if (insideHouse(x, z, 1.4) || inRiver(x, z, 1.2) || (z > 15 && Math.abs(x) > 13.4)) continue;
  if (Math.hypot(x - 9.3, z - 63) < 3.4 || Math.hypot(x - THRONE_SPOT.x, z - THRONE_SPOT.z) < 3.6) continue;
  i++;
  trunks.push({ x, y: 1.1 * s, z, s });
  for (const [px, py, pz, ls] of [[0, 2.65, 0, 1], [0.6, 2.45, 0.1, 0.7], [-0.55, 2.35, 0.15, 0.76], [0.1, 2.5, -0.45, 0.68]]) {
    canopies.push({ x: x + px * s, y: py * s, z: z + pz * s, s: s * ls });
  }
  circles.push({ x, z, r: 0.38 * s + 0.25 });
}
scene.add(batch(geo('CylinderGeometry', 0.24, 0.34, 2.2, 6), sharedMat('#74533c'), trunks));
scene.add(batch(geo('IcosahedronGeometry', 0.95, 1), sharedMat('#4f9c62'), canopies));

const rocks = [];
for (let i = 0; i < 22; i++) {
  const r = 0.35 + rand() * 0.5;
  rocks.push({ x: (rand() - 0.5) * 42, y: 0.18, z: 12 + rand() * 58, sx: r, sy: r * 0.55, sz: r, ry: rand() * 6, color: i % 3 === 0 ? '#8e8276' : '#756d68' });
}
scene.add(batch(geo('DodecahedronGeometry', 1, 0), mat('#ffffff'), rocks));

const windowMat = sharedMat('#8be0e2', { emissive: '#62a9b4', emissiveIntensity: 0.35 });
for (const h of HOUSES) {
  scene.add(makeHouse(h[0], h[1], h[2], h[3], h[4], windowMat));
  boxes.push({ x: h[0], z: h[1], w: 5.2, d: 4.7 });
}
const shrine = new THREE.Group();
const plinth = cyl(1.65, 2.0, 0.55, 8, '#b7aa8a'); plinth.position.y = 0.27; shrine.add(plinth);
const bell = cyl(0.58, 0.82, 0.85, 8, '#d9b34a'); bell.position.y = 1.15; shrine.add(bell);
const shrineStar = shadow(new THREE.Mesh(geo('OctahedronGeometry', 0.4, 0), sharedMat('#ffe07e', { emissive: '#ffcb4e', emissiveIntensity: 0.8 }))); shrineStar.position.y = 1.95; shrine.add(shrineStar);
shrine.position.set(0, 0, 2);
scene.add(shrine);
circles.push({ x: 0, z: 2, r: 2.1 });
for (const x of [-5, 5]) {
  const pole = box(0.16, 4, 0.16, '#6a4b35'); pole.position.set(x, 2, -0.5);
  const flag = box(1.4, 1.1, 0.08, '#d75b68'); flag.position.set(x, 3.2, -0.45);
  scene.add(pole, flag);
  circles.push({ x, z: -0.5, r: 0.35 });
}
// Festival bunting strung between the banner poles.
const BUNTING = ['#f4cb5e', '#d75b68', '#77dce3', '#83c86f'];
const pennants = [];
const cords = [];
for (let i = 0; i <= 12; i++) {
  const t = i / 12;
  const x = -5 + t * 10;
  const y = 3.85 - Math.sin(t * Math.PI) * 0.6;
  if (i > 0 && i < 12) pennants.push({ x, y: y - 0.2, z: -0.5, rx: Math.PI, sz: 0.25, color: BUNTING[i % 4] });
  if (i < 12) {
    const x2 = -5 + ((i + 1) / 12) * 10;
    const y2 = 3.85 - Math.sin(((i + 1) / 12) * Math.PI) * 0.6;
    cords.push({ x: (x + x2) / 2, y: (y + y2) / 2, z: -0.5, sx: Math.hypot(x2 - x, y2 - y), rz: Math.atan2(y2 - y, x2 - x) });
  }
}
scene.add(batch(geo('ConeGeometry', 0.2, 0.38, 3), mat('#ffffff'), pennants));
scene.add(batch(geo('BoxGeometry', 1, 0.03, 0.03), sharedMat('#f8f1dc'), cords, { shadows: false }));

const cliffMat = mat('#6f625c');
theme.push({ m: cliffMat, real: '#6f625c', echo: '#56526a' });
const cliffs = [];
for (const x of [-18, 18]) {
  for (let z = 18; z < 72; z += 5) {
    const cx = x + (rand() - 0.5) * 2;
    cliffs.push({ x: cx, y: 1.5, z, sx: 1.15, sy: 1.5, sz: 1 });
    circles.push({ x: cx, z, r: 3.2 });
  }
}
scene.add(batch(geo('DodecahedronGeometry', 3.1, 0), cliffMat, cliffs));

// Wildflowers (scaled with the quality tier); the Echo Below has none.
const FLOWERS = ['#f29bc1', '#ffd86b', '#fff3e0', '#b9a3ff', '#ff9f80'];
const flowerItems = [];
const flowerTarget = kit.detail(150, 40);
for (let tries = 0; flowerItems.length < flowerTarget && tries < 4000; tries++) {
  const x = (rand() - 0.5) * 38;
  const z = -10 + rand() * 78;
  if ((Math.abs(x) < 3.7 && z > -4) || (z > 16 && Math.abs(x) > 13.2) || inRiver(x, z, 0.6) || insideHouse(x, z, 0.4) || Math.hypot(x, z - 2) < 2.6) continue;
  flowerItems.push({ x, y: 0.14, z, rx: Math.PI, ry: rand() * 6, s: 0.7 + rand() * 0.6, color: FLOWERS[flowerItems.length % FLOWERS.length] });
}
const flowers = batch(geo('ConeGeometry', 0.1, 0.22, 5), mat('#ffffff'), flowerItems, { shadows: false });
scene.add(flowers);

// Characters.
const player = makeCharacter(HEROES[0].look);
player.position.set(0, 0, -1);
scene.add(player);
const followers = [makeCharacter(HEROES[1].look), makeCharacter(HEROES[2].look)];
followers[1].scale.setScalar(1.08);
followers[0].position.set(-1, 0, 0);
followers[1].position.set(1, 0, 0);
scene.add(...followers);
const trail = [player.position.clone(), player.position.clone(), player.position.clone()];

function addNPC(name, obj, x, z, fn) {
  obj.position.set(x, 0, z);
  scene.add(obj);
  const item = { name, verb: 'Talk', obj, pos: obj.position, radius: 2.15, fn };
  npcs.push(item);
  interactables.push(item);
  circles.push({ x, z, r: 0.55, on: () => !state.echo });
}
addNPC('Elder Rowan', makeNPC({ coat: '#7d664e', hair: '#d7d2c6', accent: '#dfb75a', hat: true }), 3.4, -0.8, () => talkElder());
addNPC('Puck', makeNPC({ coat: '#b16a49', hair: '#49352c', accent: '#8ed5b0' }), -3.3, 53.3, () => talkPuck());
addNPC('Linn', makeNPC({ coat: '#4f8f8d', hair: '#4b2f29', accent: '#f2d273' }), -6.2, 3.7, () => talkLinn());
addNPC('Toma', makeNPC({ coat: '#865f9e', hair: '#5f4937', accent: '#8ad2ec' }), 7.1, 4.4, () => talkToma());

scene.add(makeWell(9.3, 63));
circles.push({ x: 9.3, z: 63, r: 1.5 });
interactables.push({ name: 'Mirror Well', verb: 'Look', pos: new THREE.Vector3(9.3, 0, 63), radius: 2.3, fn: () => useWell() });

const rift = createRift();
rift.group.position.set(0, 0, 58);
scene.add(rift.group);
interactables.push({ name: 'Sky-rift', verb: 'Touch', pos: new THREE.Vector3(0, 0, 58), radius: 2.9, when: () => rift.group.visible, fn: () => useRift() });

const chest = new THREE.Group();
const chestBase = box(1.1, 0.65, 0.78, '#805231'); chestBase.position.y = 0.35;
const chestLid = box(1.12, 0.26, 0.8, '#a56a36'); chestLid.position.y = 0.78;
chest.add(chestBase, chestLid);
chest.position.set(-8, 0, 36);
scene.add(chest);
circles.push({ x: -8, z: 36, r: 0.75 });
interactables.push({ name: 'Supply Chest', verb: 'Open', pos: chest.position, radius: 1.8, fn: () => openChest() });

// Lantern stones along Moonstep Pass (Elder Rowan's "keep to the lantern stones").
const lanterns = LANTERN_SPOTS.map(([x, z], i) => {
  // Unlit = black emissive at intensity 1, so lighting it changes values only (an intensity of 0
  // would put a different flag into the shader cache key and rebuild the material mid-game).
  const crystalMat = mat('#6d7a92', { emissive: '#000000', emissiveIntensity: 1 });
  const crystal = shadow(new THREE.Mesh(geo('OctahedronGeometry', 0.22, 0), crystalMat));
  crystal.position.set(x, 1.45, z);
  scene.add(crystal);
  circles.push({ x, z, r: 0.5 });
  interactables.push({ name: 'Lantern Stone', verb: 'Light', pos: new THREE.Vector3(x, 0, z), radius: 1.9, only: 'real', when: () => !state.lanterns[i], fn: () => lightLantern(i) });
  return { crystal, mat: crystalMat, x, z };
});
scene.add(batch(geo('BoxGeometry', 0.46, 1.05, 0.46), sharedMat('#8b8a91'), LANTERN_SPOTS.map(([x, z]) => ({ x, y: 0.52, z }))));
scene.add(batch(geo('CylinderGeometry', 0.36, 0.28, 0.2, 6), sharedMat('#6f6a74'), LANTERN_SPOTS.map(([x, z]) => ({ x, y: 1.12, z }))));

// The hollow throne: only in the Echo Below, only after the festival.
const throne = new THREE.Group();
const dais = cyl(1.8, 2.1, 0.4, 8, '#3b3552'); dais.position.y = 0.2; throne.add(dais);
const seat = box(1.6, 0.55, 1.2, '#4b3a74'); seat.position.y = 0.68; throne.add(seat);
const back = box(1.6, 2.6, 0.35, '#3b2b5d'); back.position.set(0, 1.7, -0.48); throne.add(back);
for (let i = 0; i < 5; i++) {
  const spike = cyl(0, 0.14, 0.9, 5, '#5b4a7a'); spike.position.set((i - 2) * 0.36, 3.2 - Math.abs(i - 2) * 0.15, -0.48); spike.rotation.z = (i - 2) * 0.2; throne.add(spike);
}
const throneGem = shadow(new THREE.Mesh(geo('OctahedronGeometry', 0.26, 0), sharedMat('#c9a8ff', { emissive: '#a762ff', emissiveIntensity: 1.6 })));
throneGem.position.set(0, 2.55, -0.25);
throne.add(throneGem);
throne.position.set(THRONE_SPOT.x, 0, THRONE_SPOT.z);
throne.rotation.y = Math.PI / 2;
throne.visible = false;
scene.add(throne);
circles.push({ x: THRONE_SPOT.x, z: THRONE_SPOT.z, r: 1.9, on: () => throne.visible });
interactables.push({ name: 'Hollow Throne', verb: 'Approach', pos: new THREE.Vector3(THRONE_SPOT.x, 0, THRONE_SPOT.z), radius: 3.2, only: 'echo', when: () => state.stage === 9 && !state.kingDown, fn: () => approachThrone() });

const fieldSparks = new SparkPool(scene, 96);

/* ------------------------------------------------------------------ the battle arena (built once, reused) */

const PARTY_SPOTS = [[-3.2, 0, 1.8], [-3.8, 0, -0.1], [-2.8, 0, -2.0]];
const arena = (() => {
  const s = new THREE.Scene();
  s.fog = new THREE.Fog('#454367', 13, 38);
  const sky = createSky('#252846', '#a3739a');
  s.add(sky.mesh);
  s.add(new THREE.HemisphereLight('#b7d3ff', '#5b4257', 1.6));
  const key = new THREE.DirectionalLight('#fff1c7', 3);
  key.position.set(-6, 11, 7);
  key.castShadow = true;
  kit.shadow(key, 2048);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.radius = 2;
  s.add(key);
  const pointRim = new THREE.PointLight('#826cff', 18, 24, 2);
  pointRim.position.set(4, 5, -3);
  s.add(pointRim);
  const floor = shadow(new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9, 0.85, 12), mat('#575777')));
  floor.position.y = -0.48;
  s.add(floor);
  const arenaRocks = [];
  for (let i = 0; i < 14; i++) {
    const r = 0.25 + rand() * 0.55;
    arenaRocks.push({ x: (rand() - 0.5) * 15, y: 0.12, z: (rand() - 0.5) * 7, s: r, ry: rand() * 6, color: i % 2 ? '#72708d' : '#5b596f' });
  }
  s.add(batch(geo('DodecahedronGeometry', 1, 0), mat('#ffffff'), arenaRocks));
  const partyMeshes = HEROES.map((h, i) => {
    const m = makeCharacter(h.look);
    m.scale.setScalar(i === 2 ? 1.06 : 0.95);
    s.add(m);
    return m;
  });
  const monsters = { moss: makeMonster('moss'), boss: makeMonster('boss'), king: makeMonster('king') };
  for (const m of Object.values(monsters)) {
    m.visible = false;
    s.add(m);
  }
  const portal = createRift();
  portal.group.scale.setScalar(0.72);
  portal.group.position.set(5.4, -0.2, -3.2);
  portal.group.rotation.y = Math.PI / 2;
  s.add(portal.group);
  const sparks = new SparkPool(s, 160);
  const view = { dist: 1, baseY: 5.7, targetY: 1.3, shake: 0 };
  const cam = fitView(new THREE.PerspectiveCamera(44, 1, 0.1, 120), 44, 50, (c) => {
    // Still too narrow at the widest field of view (tall phones): step back instead.
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(c.fov) / 2) * c.aspect);
    view.dist = clamp(Math.tan(THREE.MathUtils.degToRad(25)) / Math.tan(hfov / 2), 1, 1.6);
  });
  cam.position.set(0, 5.7, 11.5);
  cam.lookAt(0.2, 1.3, 0);
  return { scene: s, camera: cam, sky, partyMeshes, monsters, portal, sparks, view };
})();

function restoreFlash(group) {
  group.traverse((o) => {
    const b = o.material?.userData?.base;
    if (b) {
      o.material.emissive.copy(b.e);
      o.material.emissiveIntensity = b.i;
    }
  });
}
function flash(group, color, ms = 150) {
  group.traverse((o) => {
    const m = o.material;
    if (!m?.emissive) return;
    if (!m.userData.base) m.userData.base = { e: m.emissive.clone(), i: m.emissiveIntensity };
    m.emissive.set(color);
    m.emissiveIntensity = 1.5;
  });
  later(ms, () => restoreFlash(group));
}
function prepareArena(kind) {
  for (const [k, m] of Object.entries(arena.monsters)) {
    m.visible = k === kind;
    m.position.set(2.6, 0, -0.2);
    m.rotation.set(0, -Math.PI / 2, 0);
    restoreFlash(m);
  }
  arena.partyMeshes.forEach((m, i) => {
    m.position.set(...PARTY_SPOTS[i]);
    m.rotation.set(0, Math.PI / 2, 0);
    restoreFlash(m);
  });
  arena.portal.group.visible = kind !== 'moss';
  arena.sky.top.value.set(kind === 'king' ? '#1a1430' : '#252846');
  arena.sky.bottom.value.set(kind === 'king' ? '#6b3f7a' : '#a3739a');
  arena.scene.fog.color.set(kind === 'king' ? '#2e2648' : '#454367');
  arena.view.baseY = kind === 'king' ? 6.3 : 5.7;
  arena.view.targetY = kind === 'king' ? 1.9 : 1.3;
  arena.view.shake = 0;
  ui.dmgLayer.textContent = '';
  return arena.monsters[kind];
}
function updateArenaCamera(dt) {
  const v = arena.view;
  v.shake *= Math.exp(-7 * dt);
  const j = v.shake > 0.002 ? v.shake : 0;
  const ty = v.targetY;
  arena.camera.position.set(0.2 + (0 - 0.2) * v.dist + (Math.random() - 0.5) * j, ty + (v.baseY - ty) * v.dist + (Math.random() - 0.5) * j, 11.5 * v.dist);
  arena.camera.lookAt(0.2, ty, 0);
}
function popNumber(at, text, kind = '') {
  _w.copy(at).project(arena.camera);
  if (_w.z > 1) return;
  const el = document.createElement('div');
  el.className = `dmg ${kind}`;
  el.textContent = text;
  el.style.left = `${(_w.x * 0.5 + 0.5) * 100}%`;
  el.style.top = `${(-_w.y * 0.5 + 0.5) * 100}%`;
  ui.dmgLayer.append(el);
  const done = () => el.remove();
  el.addEventListener('animationend', done);
  setTimeout(done, 1600);
}
async function lunge(mesh, amount) {
  const x = mesh.position.x;
  await animate(150, (k) => (mesh.position.x = x + amount * Math.sin((k * Math.PI) / 2)));
  await animate(120, (k) => (mesh.position.x = x + amount * (1 - k)));
  mesh.position.x = x;
}

/* ------------------------------------------------------------------ post (bloom) */

const post = createPost(kit, scene, camera, { bloom: { strength: 0.28, radius: 0.55, threshold: 0.78 } });
function showScene(which) {
  post.scenePass.scene = which === 'battle' ? arena.scene : scene;
  post.scenePass.camera = which === 'battle' ? arena.camera : camera;
}

/* ------------------------------------------------------------------ state */

let mode = 'title'; // title | field | dialog | pause | battle | ending | fade
let started = false;
let battle = null;
let battlePending = false;
let pauseReturn = 'field';
let currentInteract = null;
let camYaw = 0;
let camZoom = 1;
let walkPhase = 0;
let saveClock = 0;
let promptKey = '';
const YAW0 = Math.atan2(9, -11.5);
const CAM_R = Math.hypot(9, 11.5);
const CAM_H = 11;
const camDesired = new THREE.Vector3();
const followTarget = new THREE.Vector3();

const litCount = () => state.lanterns.filter(Boolean).length;

/* ------------------------------------------------------------------ menus (keyboard, gamepad, touch) */

const nav = {
  root: null,
  items: [],
  index: 0,
  cols: 1,
  dir: '',
  hold: 0,
  open(root, cols = 1, index = 0) {
    this.clearMark();
    this.root = root;
    this.cols = cols;
    this.items = [...root.querySelectorAll('button')].filter((b) => !b.closest('.hidden'));
    let i = clamp(index, 0, Math.max(0, this.items.length - 1));
    if (this.items[i]?.disabled) i = Math.max(0, this.items.findIndex((b) => !b.disabled));
    this.dir = '';
    this.set(i, false);
  },
  close() {
    this.clearMark();
    this.root = null;
    this.items = [];
    const a = document.activeElement;
    if (a && a !== document.body && a.closest?.('#ui')) a.blur();
  },
  clearMark() {
    for (const b of this.items) b.classList.remove('is-focus');
  },
  set(i, sound = true) {
    this.clearMark();
    this.index = i;
    const b = this.items[i];
    b?.classList.add('is-focus');
    if (sound) {
      audio.sfx('tick');
      b?.scrollIntoView?.({ block: 'nearest' });
    }
  },
  move(dir) {
    const n = this.items.length;
    if (!n) return;
    const step = dir === 'up' ? -this.cols : dir === 'down' ? this.cols : dir === 'left' ? -1 : 1;
    let i = this.index;
    for (let tries = 0; tries < n; tries++) {
      i += step;
      if (this.cols === 1) i = (i + n) % n;
      else if (i < 0 || i >= n) return;
      if (!this.items[i].disabled) return this.set(i);
    }
  },
  activate() {
    const b = this.items[this.index];
    if (!b || b.disabled) return;
    audio.unlock();
    audio.sfx('select');
    b.click();
  },
  update(dt) {
    if (!this.root) return false;
    const v = input.vector('move');
    let dir = '';
    if (Math.abs(v.y) > 0.55 && Math.abs(v.y) >= Math.abs(v.x)) dir = v.y > 0 ? 'up' : 'down';
    else if (Math.abs(v.x) > 0.55) dir = v.x > 0 ? 'right' : 'left';
    if (dir && dir !== this.dir) {
      this.hold = 0.38;
      this.move(dir);
    } else if (dir) {
      this.hold -= dt;
      if (this.hold <= 0) {
        this.hold = 0.14;
        this.move(dir);
      }
    }
    this.dir = dir;
    if (input.pressed('act')) {
      this.activate();
      return true;
    }
    return false;
  },
};
// Tab focus and mouse hover keep the highlighted button in step.
document.addEventListener('focusin', (e) => {
  const i = nav.items.indexOf(e.target);
  if (i >= 0) nav.set(i, false);
});
ui.title.parentElement.addEventListener('pointerover', (e) => {
  const b = e.target.closest?.('button');
  const i = b ? nav.items.indexOf(b) : -1;
  if (i >= 0 && i !== nav.index && e.pointerType === 'mouse') nav.set(i, false);
});
function menuCols(root) {
  const grid = root.querySelector('.menu-buttons');
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1 : 1;
}

/* ------------------------------------------------------------------ HUD helpers */

function setMode(m) {
  mode = m;
  kit.touch?.suspend(m !== 'field', 'game');
  const showTop = started && !battle && !battlePending && (m === 'field' || m === 'dialog' || m === 'pause' || m === 'fade');
  ui.topbar.classList.toggle('hidden', !showTop);
  if (m !== 'field') {
    ui.prompt.classList.remove('show');
    promptKey = '';
  }
}

let toastTimer = 0;
function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1900);
}

function updateQuest() {
  ui.questText.textContent = QUESTS[state.stage] || QUESTS[0];
  const lit = litCount();
  const showSide = state.stage >= 1 && lit < 5;
  ui.sideText.classList.toggle('hidden', !showSide);
  if (showSide) ui.sideText.textContent = `Side: lantern stones on the pass ${lit}/5`;
}

function refreshPrompts() {
  const src = input.source;
  document.documentElement.dataset.input = src;
  ui.dialogHint.textContent = CONTINUE_HINT[src] || CONTINUE_HINT.keyboard;
  ui.battleHint.textContent = BATTLE_HINT[src] || BATTLE_HINT.keyboard;
  ui.pauseHelp.textContent = HELP[src] || HELP.keyboard;
  ui.titleHelp.textContent = `Original low-poly browser RPG · turn-based party combat · ${HELP[src] || HELP.keyboard}`;
  promptKey = '';
}
input.onSourceChange(refreshPrompts);
refreshPrompts();

function updatePrompt() {
  const it = currentInteract;
  const key = it ? `${it.verb}|${it.name}|${input.source}` : '';
  if (key === promptKey) return;
  promptKey = key;
  ui.prompt.classList.toggle('show', !!it);
  if (it) {
    const glyph = GLYPH[input.source] || '';
    ui.promptKey.textContent = glyph;
    ui.promptKey.classList.toggle('hidden', !glyph);
    ui.promptKey.classList.toggle('pad', input.source === 'gamepad');
    ui.promptText.textContent = `${it.verb} · ${it.name}`;
  }
  kit.touch?.setLabel('act', it ? it.verb : 'Action');
}

/* ------------------------------------------------------------------ saving */

function save() {
  state.px = Math.round(player.position.x * 100) / 100;
  state.pz = Math.round(player.position.z * 100) / 100;
  store.save(SAVE_KEY, state);
  ui.continueBtn.classList.remove('hidden');
}
function loadState(raw) {
  const s = freshState();
  if (!raw || typeof raw !== 'object') return s;
  Object.assign(s, raw);
  s.stage = clamp(Math.floor(+s.stage) || 0, 0, LAST_STAGE);
  s.herbs = Math.max(0, Math.floor(+s.herbs) || 0);
  s.lanterns = Array.from({ length: 5 }, (_, i) => !!raw.lanterns?.[i]);
  s.echo = !!s.echo;
  s.time = Math.max(0, +s.time || 0);
  s.wins = Math.max(0, Math.floor(+s.wins) || 0);
  // Saves from before positions were stored fall back to a spot picked from the stage.
  if (!Number.isFinite(+raw.px) || !Number.isFinite(+raw.pz) || raw.px === null || raw.pz === null) s.px = s.pz = NaN;
  return s;
}
addEventListener('pagehide', () => {
  if (started) save();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (started) save();
  if (mode === 'field' || mode === 'battle') openPause();
});

/* ------------------------------------------------------------------ world state */

function setChestVisual(open) {
  chestLid.rotation.x = open ? -0.65 : 0;
  chestLid.position.z = open ? -0.18 : 0;
}
function setLanternVisual(i, lit) {
  const l = lanterns[i];
  l.mat.color.set(lit ? '#ffe07e' : '#6d7a92');
  l.mat.emissive.set(lit ? '#ffcb4e' : '#000000');
  l.mat.emissiveIntensity = lit ? 1.5 : 1;
}
function updateWorldFlags() {
  throne.visible = state.echo && state.stage >= 9 && !state.kingDown;
  rift.group.visible = state.stage < 10;
  flowers.visible = !state.echo;
  setChestVisual(state.chestOpen);
  state.lanterns.forEach((on, i) => setLanternVisual(i, on));
}
function setWorldMode(echo, instant = false) {
  state.echo = echo;
  scene.fog.color.set(echo ? '#4b5679' : '#b8c8ce');
  scene.fog.density = echo ? 0.019 : 0.013;
  for (const t of theme) t.m.color.set(echo ? t.echo : t.real);
  fieldSky.top.value.set(echo ? '#32395f' : '#6e8fe8');
  fieldSky.bottom.value.set(echo ? '#8c7ba2' : '#f6dba3');
  water.colorA.value.set(echo ? '#443d72' : '#347dc2');
  water.colorB.value.set(echo ? '#9e77c7' : '#82e5d4');
  for (const n of npcs) for (const m of n.obj.userData.materials) m.opacity = echo ? 0.24 : 1;
  updateWorldFlags();
  audio.setMode(echo ? 'echo' : 'field');
  if (!instant) save();
}
/** Put the party somewhere (new game, continue, a portal) without the followers sliding across the map. */
function placeParty(x, z) {
  player.position.set(x, 0, z);
  for (const t of trail) t.copy(player.position);
  followers.forEach((f, i) => f.position.set(x + (i ? -0.55 : 0.55), 0, z + 0.65 + i * 0.2));
  updateCamera(0, true);
}
function setStage(n) {
  state.stage = n;
  updateQuest();
  updateWorldFlags();
  save();
}

/* ------------------------------------------------------------------ dialogue */

const dialog = { queue: [], cb: null, full: '', shown: 0, drawn: 0 };
function converse(lines, cb = null) {
  dialog.queue = lines.map(([name, text]) => ({ name, text }));
  dialog.cb = cb;
  showLine();
}
function say(name, text, cb = null) {
  converse([[name, text]], cb);
}
function showLine() {
  const d = dialog.queue[0];
  if (!d) return endDialog();
  setMode('dialog');
  ui.dialogName.textContent = d.name;
  dialog.full = d.text;
  dialog.shown = 0;
  dialog.drawn = 0;
  ui.dialogText.textContent = '';
  ui.dialog.classList.remove('hidden');
  audio.sfx('talk');
}
function advanceDialog() {
  if (mode !== 'dialog') return;
  if (dialog.drawn < dialog.full.length) {
    dialog.shown = dialog.drawn = dialog.full.length;
    ui.dialogText.textContent = dialog.full;
    return;
  }
  dialog.queue.shift();
  if (dialog.queue.length) showLine();
  else endDialog();
}
function endDialog() {
  ui.dialog.classList.add('hidden');
  setMode('field');
  input.settle();
  const cb = dialog.cb;
  dialog.cb = null;
  cb?.();
}
function updateDialog(dt) {
  if (dialog.drawn >= dialog.full.length) return;
  dialog.shown = Math.min(dialog.full.length, dialog.shown + dt * 75);
  const n = Math.floor(dialog.shown);
  if (n !== dialog.drawn) {
    dialog.drawn = n;
    ui.dialogText.textContent = dialog.full.slice(0, n);
  }
}
ui.dialog.addEventListener('click', () => advanceDialog());

/* ------------------------------------------------------------------ story */

function talkElder() {
  if (state.echo) return say('Elder Rowan', '...');
  if (state.stage === 0) {
    converse([
      ['Elder Rowan', 'Kite, Mara, Bram—the Starbell Crown is late. Puck took it down Moonstep Pass to polish the moonstone.'],
      ['Bram', 'A simple delivery. Those are famous last words.'],
      ['Elder Rowan', 'Bring Puck and the crown home before sunset. The festival cannot begin without them.'],
    ], () => setStage(1));
  } else if (state.stage === 5) {
    converse([
      ['Elder Rowan', 'You found it! And you look as if you fell through the sky to do it.'],
      ['Mara', 'That is uncomfortably accurate.'],
      ['Elder Rowan', 'No time. Place the crown on the bell—wait... why is the shadow moving?'],
    ], () => {
      setStage(6);
      setMode('fade');
      later(300, () => startBattle('boss'));
    });
  } else if (state.stage >= 10) say('Elder Rowan', 'Two crowns saved in one festival. I will need a bigger feast.');
  else if (state.stage >= 8) say('Elder Rowan', 'The rift still hums, you say? Then the festival is not over until the dream is. Go carefully.');
  else if (state.stage >= 7) say('Elder Rowan', 'The bell has never sounded brighter. Starweave owes you three a feast.');
  else say('Elder Rowan', 'Puck is still down the pass. Follow the timber bridge and keep to the lantern stones.');
}

function talkPuck() {
  if (state.echo) return say('Puck', '...');
  if (state.stage === 1) {
    converse([
      ['Puck', 'Don’t come closer! The cliff just opened its eye. I dropped the crown when the ground shook.'],
      ['Kite', 'That blue ring?'],
      ['Puck', 'That was not here this morning. If the crown fell through it, we are in trouble.'],
    ], () => setStage(2));
  } else if (state.stage === 4) {
    converse([
      ['Puck', 'You vanished. Then you walked out of thin air. I am choosing not to understand that.'],
      ['Mara', 'The crown?'],
      ['Puck', 'Caught on a root after all. Here—take it before reality changes its mind.'],
    ], () => {
      audio.sfx('pickup');
      toast('Starbell Crown obtained.');
      setStage(5);
    });
  } else if (state.stage >= 10) say('Puck', 'The rift closed with a little pop. I am almost disappointed.');
  else if (state.stage >= 8) say('Puck', 'The rift? Still there. Still rude. I put a fence around it. It ate the fence.');
  else say('Puck', state.stage >= 5 ? 'I am going to spend the festival somewhere with a roof.' : 'The crown fell near that rift. Please be careful.');
}

function talkLinn() {
  if (state.echo) return say('Linn', '...A cold breeze just walked through me.');
  if (state.stage >= 10) return say('Linn', 'I slept without dreaming for the first time in weeks. It was wonderful.');
  if (state.stage >= 8) return say('Linn', 'The bell rang all night, and I dreamed of a man with a crown of horns. Was that only me?');
  say('Linn', 'The festival bell only rings when the Starbell Crown is home.');
}

function talkToma() {
  if (state.echo) return say('Toma', 'Did that banner move by itself?');
  if (litCount() >= 5) return say('Toma', 'The pass is glowing tonight! Someone lit every lantern stone—was that you three?');
  if (state.stage >= 1) {
    return converse([
      ['Toma', 'Puck went down the pass before sunrise. He was muttering about a crack in the sky.'],
      ['Toma', 'If you pass the old lantern stones, give them a spark. Light all five and the pass will thank you.'],
    ]);
  }
  say('Toma', 'Puck went down the pass before sunrise. He was muttering about a crack in the sky.');
}

function useRift() {
  if (state.echo) return say('???', 'The tear hums, but the path back is sealed from this side.');
  if (state.stage < 2) return toast('A cold wind pours from the strange ring.');
  if (state.stage === 2) {
    return converse([
      ['Mara', 'I can see another road inside it. Same mountain... wrong sky.'],
      ['Bram', 'So naturally, we are going in.'],
    ], async () => {
      await transitionWorld(true, 0, 55);
      setStage(3);
      say('???', 'You step into the Echo Below. The village lights are here, but no one can see you.');
    });
  }
  if (state.stage === 8 || state.stage === 9) {
    const first = state.stage === 8;
    const lines = first
      ? [['Mara', 'The ring is darker than before. The other road is still there.'], ['Bram', 'Same as last time: we go in, we come back. Ideally all of us.']]
      : [['Kite', 'Back down. He is still waiting on that throne.']];
    return converse(lines, async () => {
      await transitionWorld(true, 0, 55);
      if (first) {
        setStage(9);
        say('???', 'The Echo Below has grown darker. To the west, something sits on a throne of roots.');
      }
    });
  }
  toast('The rift hums quietly. Nothing pulls at you now.');
}

function useWell() {
  if (!state.echo) return say('Mirror Well', 'Clear water reflects a sky that is not above you.');
  if (state.stage === 3) {
    return converse([
      ['Mara', 'The reflection is showing our sky.'],
      ['Kite', 'Then let’s make it a door.'],
    ], async () => {
      await transitionWorld(false, WELL_RETURN.x, WELL_RETURN.z);
      setStage(4);
      toast('Returned to the waking world.');
    });
  }
  if (state.stage === 9) {
    return converse([['Mara', 'The well still shows our sky. We can catch our breath at home and come back through the rift.']], async () => {
      await transitionWorld(false, WELL_RETURN.x, WELL_RETURN.z);
      toast('Returned to the waking world.');
    });
  }
  say('Mirror Well', 'The water is still. It shows only your own tired faces.');
}

function openChest() {
  if (state.chestOpen) return toast('The chest is empty.');
  state.chestOpen = true;
  setChestVisual(true);
  state.herbs += 2;
  audio.sfx('pickup');
  fieldSparks.burst(_v.set(chest.position.x, 0.6, chest.position.z), '#ffe192', 14);
  toast('Found 2 Brightleaf Herbs.');
  save();
}

function lightLantern(i) {
  if (state.lanterns[i]) return;
  state.lanterns[i] = true;
  setLanternVisual(i, true);
  audio.sfx('lantern');
  input.rumble(0.25, 60);
  fieldSparks.burst(_v.set(lanterns[i].x, 1.0, lanterns[i].z), '#ffd26f', 18);
  const lit = litCount();
  updateQuest();
  if (lit < 5) {
    toast(`Lantern stone lit (${lit}/5).`);
    save();
    return;
  }
  state.charm = true;
  state.herbs += 2;
  save();
  converse([
    ['Bram', 'That is all five. Listen—the whole pass is humming like a hearth.'],
    ['Mara', 'Old lantern magic. It is settling into our packs... and into us.'],
    ['???', `Received the Lantern Charm (+${CHARM_HP} max HP for every hero in battle) and 2 Brightleaf Herbs.`],
  ]);
}

/**
 * After the festival, Mara hears the rift (stage 7 → 8). Polled from the field loop once the
 * party has stood in the field for a moment, so a menu or a dialog in between cannot skip it.
 */
let hookClock = 0;
function postGameHook() {
  if (state.stage !== 7 || state.kingDown || mode !== 'field') return;
  converse([
    ['Mara', 'Kite... the rift on Moonstep Pass is still humming. I can hear it from here.'],
    ['Kite', 'The horned king. He was in my dream again—sitting on a throne in that other sky.'],
    ['Bram', 'Then we finish this properly. One more trip below.'],
  ], () => setStage(8));
}

function approachThrone() {
  converse([
    ['The Horned King', 'So the crown-fetchers return. Every dream in Starweave drains down to this throne—and you woke them all with one silly bell.'],
    ['Kite', 'You are the one I keep dreaming about.'],
    ['The Horned King', 'I am what the Hollow Sky dreams of being: a king with a crown. Give me the Starbell, or sleep here forever.'],
    ['Bram', 'Neither. Mara, light the way.'],
  ], () => startBattle('king'));
}

async function transitionWorld(echo, x, z) {
  setMode('fade');
  ui.fade.classList.add('on');
  await wait(470);
  setWorldMode(echo);
  placeParty(x, z);
  save();
  audio.sfx('portal');
  await wait(180);
  ui.fade.classList.remove('on');
  setMode('field');
}

/* ------------------------------------------------------------------ battle */

class Battle {
  constructor(kind) {
    const def = ENEMIES[kind];
    const diff = DIFFICULTY[prefs.difficulty];
    const bonus = state.charm ? CHARM_HP : 0;
    this.kind = kind;
    this.enemy = { name: def.name, max: Math.round(def.hp * diff.hp), atk: def.atk };
    this.enemy.hp = this.enemy.max;
    this.party = HEROES.map((h) => ({ name: h.name, role: h.role, max: h.max + bonus, hp: h.max + bonus, mp: h.maxMp, maxMp: h.maxMp, atk: h.atk, skill: h.skill, cost: h.cost, skillText: h.skillText, guarding: false }));
    this.round = 1;
    this.busy = true;
    this.pick = 0;
    this.actions = [];
    this.teamGuard = false;
    this.charging = false;
    this.disposed = false;
    this.enemyMesh = prepareArena(kind);
    ui.commands.textContent = '';
    ui.battleHud.classList.remove('hidden');
    this.renderHud();
  }
  async begin() {
    this.message(BATTLE_INTRO[this.kind]);
    await wait(800);
    if (this.disposed) return;
    this.busy = false;
    this.ask();
  }
  renderHud() {
    ui.enemyName.textContent = this.enemy.name;
    ui.enemyHp.style.width = `${Math.max(0, (this.enemy.hp / this.enemy.max) * 100)}%`;
    ui.partyCards.innerHTML = this.party
      .map((p, i) => `<div class="party-card ${i === this.pick && !this.busy ? 'current' : ''} ${p.hp <= 0 ? 'ko' : ''}"><b>${p.name}</b><div>${p.hp <= 0 ? 'KO' : `HP ${p.hp}/${p.max}`} · MP ${p.mp}/${p.maxMp}</div><div class="hpbar"><i style="width:${Math.max(0, (p.hp / p.max) * 100)}%"></i></div></div>`)
      .join('');
  }
  message(t) {
    ui.battleMessage.textContent = t;
  }
  enemyTop() {
    return _v.copy(this.enemyMesh.position).setY(this.enemyMesh.userData.top || 2);
  }
  heroTop(i) {
    return _v.copy(arena.partyMeshes[i].position).setY(2.3);
  }
  herbsLeft() {
    return state.herbs - this.actions.filter((a) => a.type === 'item').length;
  }
  ask() {
    if (this.busy || this.disposed) return;
    while (this.pick < this.party.length && this.party[this.pick].hp <= 0) this.pick++;
    if (this.pick >= this.party.length) {
      this.resolveRound();
      return;
    }
    const p = this.party[this.pick];
    this.message(`${p.name} — choose a command.`);
    this.renderHud();
    const herbs = this.herbsLeft();
    const cmds = [
      ['Attack', 'Steady weapon strike', 'attack', false],
      [p.skill, `${p.skillText} · ${p.cost} MP`, 'skill', p.mp < p.cost],
      ['Guard', 'Halve damage to this hero', 'guard', false],
      [`Herb ×${Math.max(0, herbs)}`, 'Restore 32 HP', 'item', herbs <= 0],
    ];
    ui.commands.innerHTML = cmds
      .map((c, i) => `<button type="button" class="command" data-cmd="${c[2]}" ${c[3] ? 'disabled' : ''}><kbd>${i + 1}</kbd>${c[0]}<span>${c[1]}</span></button>`)
      .join('');
    ui.commands.querySelectorAll('button').forEach((b) => (b.onclick = () => this.choose(b.dataset.cmd)));
    nav.open(ui.commands, 2, 0);
  }
  choose(type) {
    if (this.busy || this.disposed) return;
    this.actions.push({ actor: this.pick, type });
    this.pick++;
    audio.unlock();
    if (type === 'guard') audio.sfx('guard');
    this.ask();
  }
  undo() {
    if (this.busy || this.disposed || !this.actions.length) return;
    const a = this.actions.pop();
    this.pick = a.actor;
    audio.sfx('undo');
    this.ask();
  }
  command(n) {
    if (this.busy || this.disposed) return;
    const b = ui.commands.querySelectorAll('button')[n];
    if (b && !b.disabled) {
      audio.sfx('select');
      b.click();
    }
  }
  async resolveRound() {
    this.busy = true;
    nav.close();
    ui.commands.textContent = '';
    this.teamGuard = false;
    this.renderHud();
    for (const a of this.actions) {
      if (this.party[a.actor].hp <= 0) continue;
      await this.playerAction(a);
      if (this.disposed) return;
      if (this.enemy.hp <= 0) {
        await this.victory();
        return;
      }
    }
    await this.enemyAction();
    if (this.disposed) return;
    if (this.party.every((p) => p.hp <= 0)) {
      this.defeat();
      return;
    }
    this.actions = [];
    this.pick = 0;
    this.round++;
    this.busy = false;
    this.renderHud();
    this.ask();
  }
  hurtEnemy(dmg, color, big = false) {
    this.enemy.hp -= dmg;
    audio.sfx('hit');
    flash(this.enemyMesh, color);
    popNumber(this.enemyTop(), String(dmg), big ? 'big' : '');
    input.rumble(big ? 0.35 : 0.2, big ? 110 : 60);
    arena.view.shake += big ? 0.14 : 0.05;
    this.renderHud();
  }
  heal(i, amount) {
    const p = this.party[i];
    const gained = Math.min(p.max, p.hp + amount) - p.hp;
    p.hp += gained;
    popNumber(this.heroTop(i), `+${gained}`, 'heal');
  }
  async playerAction(a) {
    const p = this.party[a.actor];
    const mesh = arena.partyMeshes[a.actor];
    if (a.type === 'attack') {
      const dmg = Math.floor(p.atk * 0.72 + Math.random() * 7);
      this.message(`${p.name} attacks!  ${dmg} damage.`);
      await lunge(mesh, 0.65);
      this.hurtEnemy(dmg, '#ffd37a');
    } else if (a.type === 'skill' && p.name === 'Kite') {
      p.mp -= p.cost;
      const dmg = 30 + Math.floor(Math.random() * 9);
      this.message(`Kite uses Skycut!  ${dmg} damage.`);
      await lunge(mesh, 1.0);
      this.hurtEnemy(dmg, '#8ce8ff', true);
      arena.sparks.burst(this.enemyMesh.position, '#8ce8ff', 14);
    } else if (a.type === 'skill' && p.name === 'Mara') {
      p.mp -= p.cost;
      this.message('Mara casts Lumen. Warm light mends the party.');
      audio.sfx('heal');
      arena.sparks.burst(mesh.position, '#a7ffcf', 18);
      this.party.forEach((q, i) => q.hp > 0 && this.heal(i, 24));
      this.renderHud();
      await wait(520);
    } else if (a.type === 'skill' && p.name === 'Bram') {
      p.mp -= p.cost;
      this.teamGuard = true;
      this.message('Bram uses Rally. The party braces together.');
      audio.sfx('guard');
      arena.sparks.burst(mesh.position, '#ffe192', 16);
      await wait(470);
    } else if (a.type === 'guard') {
      p.guarding = true;
      this.message(`${p.name} guards.`);
      popNumber(this.heroTop(a.actor), 'Guard', 'info');
      await wait(320);
    } else if (a.type === 'item') {
      if (state.herbs <= 0) {
        this.message(`${p.name} reaches for a Brightleaf Herb, but the pouch is empty.`);
        await wait(420);
      } else {
        state.herbs -= 1;
        this.heal(a.actor, 32);
        save();
        this.message(`${p.name} uses a Brightleaf Herb. +32 HP.`);
        audio.sfx('heal');
        arena.sparks.burst(mesh.position, '#9bff8e', 10);
        await wait(420);
      }
    }
    this.renderHud();
    await wait(240);
  }
  /** Enemy damage: the enemy's attack stat and the difficulty scale it, then Rally and Guard cut it. */
  calc(i, base, k) {
    let dmg = Math.max(1, Math.round(base * k));
    if (this.teamGuard) dmg = Math.ceil(dmg * 0.55);
    if (this.party[i].guarding) dmg = Math.ceil(dmg * 0.5);
    return dmg;
  }
  hit(i, dmg) {
    const p = this.party[i];
    if (p.hp <= 0) return;
    p.hp = Math.max(0, p.hp - dmg);
    popNumber(this.heroTop(i), String(dmg), 'hurt');
    flash(arena.partyMeshes[i], '#ff8e95');
    input.rumble(0.45, 120);
    if (p.hp <= 0) {
      const m = arena.partyMeshes[i];
      m.rotation.z = 1.35;
      m.position.y = 0.25;
      audio.sfx('ko');
    }
  }
  async enemyAction() {
    if (this.enemy.hp <= 0) return;
    const living = [];
    this.party.forEach((p, i) => p.hp > 0 && living.push(i));
    const k = (this.enemy.atk / 18) * DIFFICULTY[prefs.difficulty].dmg;
    const em = this.enemyMesh;
    if (this.kind === 'king') {
      await this.kingTurn(living, k);
    } else if (this.round % 3 === 0 || this.enemy.hp < this.enemy.max * 0.35) {
      this.message(this.kind === 'boss' ? `${this.enemy.name} exhales Gloam Breath!` : `${this.enemy.name} bursts a cloud of dizzy spores!`);
      em.rotation.z = 0.12;
      arena.sparks.burst(_w.set(0.7, 1.4, 0), '#b082ff', 26);
      audio.sfx('hit');
      await wait(500);
      if (this.disposed) return;
      for (const i of living) this.hit(i, this.calc(i, 8 + Math.floor(Math.random() * 6), k));
      arena.view.shake += 0.14;
      input.rumble(0.6, 200);
      em.rotation.z = 0;
      await wait(420);
    } else {
      const i = living[Math.floor(Math.random() * living.length)];
      const p = this.party[i];
      const dmg = this.calc(i, 13 + Math.floor(Math.random() * 7), k);
      this.message(`${this.enemy.name} mauls ${p.name}.  ${dmg} damage.`);
      await lunge(em, -0.6);
      this.hit(i, dmg);
      audio.sfx('hit');
    }
    for (const p of this.party) p.guarding = false;
    this.renderHud();
    await wait(520);
  }
  async kingTurn(living, k) {
    const em = this.enemyMesh;
    if (this.charging) {
      this.charging = false;
      this.message('The Horned King brings down the Hollow Collapse!');
      em.rotation.x = -0.15;
      arena.sparks.burst(_w.set(-3.2, 2.6, 0), '#a762ff', 40);
      audio.sfx('hit');
      await wait(520);
      if (this.disposed) return;
      for (const i of living) this.hit(i, this.calc(i, 24 + Math.floor(Math.random() * 7), k));
      em.rotation.x = 0;
      arena.view.shake += 0.32;
      input.rumble(1, 320);
      await wait(480);
    } else if (this.round % 4 === 0) {
      this.charging = true;
      this.message('The Horned King raises his crown. The hollow sky gathers overhead… Guard!');
      audio.sfx('charge');
      arena.sparks.burst(_w.copy(em.position).setY(3.6), '#c9a8ff', 30);
      flash(em, '#a762ff', 600);
      await wait(900);
    } else if (this.round % 3 === 0 || this.enemy.hp < this.enemy.max * 0.3) {
      this.message('The Horned King casts Crown of Thorns! Thorns drink the party’s magic.');
      audio.sfx('thorns');
      arena.sparks.burst(_w.set(-3.2, 1.0, 0), '#d6c9e8', 30);
      await wait(480);
      if (this.disposed) return;
      for (const i of living) {
        this.hit(i, this.calc(i, 9 + Math.floor(Math.random() * 6), k));
        this.party[i].mp = Math.max(0, this.party[i].mp - 2);
      }
      arena.view.shake += 0.12;
      input.rumble(0.6, 200);
      await wait(420);
    } else {
      const i = living[Math.floor(Math.random() * living.length)];
      const p = this.party[i];
      const dmg = this.calc(i, 15 + Math.floor(Math.random() * 7), k);
      this.message(`The Horned King swings his gavel at ${p.name}.  ${dmg} damage.`);
      await lunge(em, -0.8);
      this.hit(i, dmg);
      audio.sfx('hit');
    }
  }
  async victory() {
    this.busy = true;
    nav.close();
    this.message(BATTLE_WIN[this.kind]);
    arena.sparks.burst(this.enemyMesh.position, '#ffd26f', 40);
    this.enemyMesh.visible = false;
    audio.sfx('win');
    input.rumble(0.5, 200);
    await wait(1250);
    if (this.disposed) return;
    this.disposed = true;
    battleEnded(this.kind, true);
  }
  defeat() {
    this.busy = true;
    nav.close();
    this.message('The party falls, but the festival bell pulls the moment backward.');
    // The festival fight has nowhere to fall back to; the other two let the party regroup
    // instead of wiping the whole journey (the old Restart erased the save after one lost fight).
    const second = {
      moss: ['retreat', 'RETREAT', 'Fall back up the pass and regroup'],
      king: ['retreat', 'RETREAT', 'Return to the Echo Below to regroup'],
      boss: ['restart', 'RESTART', 'Return to the beginning (erases the save)'],
    }[this.kind];
    ui.commands.innerHTML = `<button type="button" class="command" data-cmd="retry">RETRY<span>Restore the party and try again</span></button><button type="button" class="command" data-cmd="${second[0]}">${second[1]}<span>${second[2]}</span></button>`;
    ui.commands.querySelector('[data-cmd="retry"]').onclick = () => this.retry();
    const other = ui.commands.querySelector(`[data-cmd="${second[0]}"]`);
    other.onclick = () => {
      if (second[0] === 'retreat') {
        this.disposed = true;
        battleEnded(this.kind, false);
      } else if (!other.dataset.armed) {
        other.dataset.armed = '1';
        other.firstChild.textContent = 'RESTART? PRESS AGAIN';
      } else startNew();
    };
    nav.open(ui.commands, 2, 0);
  }
  retry() {
    for (const p of this.party) {
      p.hp = p.max;
      p.mp = p.maxMp;
      p.guarding = false;
    }
    this.enemy.hp = this.enemy.max;
    this.enemyMesh = prepareArena(this.kind);
    this.actions = [];
    this.pick = 0;
    this.round = 1;
    this.charging = false;
    this.busy = false;
    this.renderHud();
    this.ask();
  }
  update(dt) {
    const t = gTime.value;
    arena.portal.group.rotation.z += dt * 0.18;
    this.enemyMesh.rotation.y = -Math.PI / 2 + Math.sin(t * 2) * 0.05;
    for (let i = 0; i < arena.partyMeshes.length; i++) {
      if (this.party[i].hp > 0) arena.partyMeshes[i].position.y = Math.sin(t * 2 + i * 1.7) * 0.025;
    }
    updateArenaCamera(dt);
  }
}

async function startBattle(kind) {
  if (battle || battlePending) return;
  battlePending = true;
  setMode('fade');
  audio.sfx('encounter');
  input.rumble(0.35, 120);
  ui.fade.classList.add('quick', 'on');
  await wait(240);
  battlePending = false;
  battle = new Battle(kind);
  showScene('battle');
  audio.setMode(kind === 'king' ? 'king' : 'battle');
  setMode('battle');
  ui.fade.classList.remove('on');
  later(300, () => ui.fade.classList.remove('quick'));
  battle.begin();
}

function closeBattle() {
  if (battle) battle.disposed = true;
  battle = null;
  battlePending = false;
  nav.close();
  ui.battleHud.classList.add('hidden');
  ui.commands.textContent = '';
  ui.dmgLayer.textContent = '';
  showScene('field');
}

function battleEnded(kind, win) {
  closeBattle();
  audio.setMode(state.echo ? 'echo' : 'field');
  setMode('field');
  input.settle();
  if (!win) {
    if (kind === 'moss') {
      // Back up the pass, clear of the bridge, so the Grumbler doesn't jump them again at once.
      placeParty(0, 20.5);
      player.rotation.y = Math.PI;
      save();
      toast('The party falls back up the pass to regroup.');
    } else toast('You slip back into the Echo Below to regroup.');
    return;
  }
  state.wins += 1;
  if (kind === 'moss') {
    state.fieldWin = true;
    state.herbs += 1;
    save();
    toast('Victory! Found 1 Brightleaf Herb.');
  } else if (kind === 'boss') {
    state.complete = true;
    setStage(7);
    audio.sfx('win');
    setMode('fade');
    later(700, () => showEnding('slice'));
  } else if (kind === 'king') {
    state.kingDown = true;
    setStage(10);
    say('???', 'The throne crumbles into falling stars. The Mirror Well flares, and the waking world pulls you home.', async () => {
      await transitionWorld(false, WELL_RETURN.x, WELL_RETURN.z);
      showEnding('true');
    });
  }
}

/* ------------------------------------------------------------------ title, pause, ending */

function openTitle() {
  const saved = hasSave();
  ui.continueBtn.classList.toggle('hidden', !saved);
  ui.newBtn.className = saved ? 'secondary' : 'primary';
  ui.newBtn.textContent = 'Start New Journey';
  delete ui.newBtn.dataset.armed;
  const rec = [];
  if (prefs.bestTime) rec.push(`Best festival: ${fmtTime(prefs.bestTime)}`);
  if (prefs.bestTrue) rec.push(`Best true ending: ${fmtTime(prefs.bestTrue)}`);
  ui.titleRecord.textContent = rec.join(' · ');
  ui.titleRecord.classList.toggle('hidden', !rec.length);
  ui.title.classList.remove('hidden');
  setMode('title');
  nav.open(ui.title, menuCols(ui.title));
}

function startCommon() {
  audio.unlock();
  audio.duck(false);
  hookClock = 0;
  ui.title.classList.add('hidden');
  ui.ending.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.dialog.classList.add('hidden');
  ui.fade.classList.remove('on', 'quick');
  started = true;
  camYaw = 0;
  camZoom = 1;
  nav.close();
  setMode('field');
  audio.setMode(state.echo ? 'echo' : 'field');
  updateQuest();
  input.settle();
}

function startNew() {
  store.clear(SAVE_KEY);
  timers.length = 0; // cancels any battle beat or fade still waiting
  closeBattle();
  camYaw = 0;
  camZoom = 1;
  state = freshState();
  setWorldMode(false, true);
  placeParty(0, -1);
  player.rotation.y = 0;
  startCommon();
  say('Mara', 'You were shouting about a horned king again. Come on—Elder Rowan is waiting in the square.');
}

function continueGame() {
  timers.length = 0;
  closeBattle();
  camYaw = 0;
  camZoom = 1;
  state = loadState(store.load(SAVE_KEY));
  setWorldMode(state.echo, true);
  let x = state.px;
  let z = state.pz;
  if (!Number.isFinite(x) || !Number.isFinite(z) || blocked(x, z)) {
    x = 0;
    z = state.echo ? 55 : state.stage === 0 ? -1 : Math.min(48, state.stage * 8);
  }
  if (blocked(x, z)) {
    x = 0;
    z = -1;
  }
  placeParty(x, z);
  startCommon();
  if (state.stage === 6) {
    setMode('fade');
    later(350, () => startBattle('boss'));
  }
}

ui.newBtn.onclick = () => {
  if (hasSave() && !ui.newBtn.dataset.armed) {
    ui.newBtn.dataset.armed = '1';
    ui.newBtn.textContent = 'Start Over — Replaces Your Save';
    toast('Press again to start over. Your saved journey will be replaced.');
    return;
  }
  startNew();
};
ui.continueBtn.onclick = () => continueGame();
ui.titleSettingsBtn.onclick = () => kit.menu.open();
ui.settingsBtn.onclick = () => kit.menu.open();

function refreshPause() {
  ui.pauseQuest.textContent = QUESTS[state.stage] || QUESTS[0];
  const lit = litCount();
  const side = [`<div class="${lit >= 5 ? 'done' : ''}">Lantern stones on the pass: ${lit}/5${state.charm ? ' · Lantern Charm' : ''}</div>`];
  if (state.stage >= 7) side.push(`<div class="${state.kingDown ? 'done' : ''}">The Horned King: ${state.kingDown ? 'defeated' : 'waiting below'}</div>`);
  side.push(`<div>Brightleaf Herbs: ${state.herbs} · Journey ${fmtTime(state.time)}</div>`);
  ui.pauseSide.innerHTML = side.join('');
  const bonus = state.charm ? CHARM_HP : 0;
  ui.pauseParty.innerHTML = HEROES.map((h) => `<div class="statbox"><b>${h.name}</b><span>${h.role}</span><span>HP ${h.max + bonus} · MP ${h.maxMp}</span></div>`).join('');
  ui.musicBtn.textContent = `Music: ${prefs.music ? 'On' : 'Off'}`;
  ui.sfxBtn.textContent = `Sound: ${prefs.sfx ? 'On' : 'Off'}`;
  ui.diffBtn.textContent = `Difficulty: ${DIFFICULTY[prefs.difficulty].label}`;
}

function openPause() {
  if (!started || !(mode === 'field' || mode === 'battle' || mode === 'dialog')) return;
  pauseReturn = mode;
  if (mode === 'field') save();
  ui.resetBtn.textContent = 'Restart Slice';
  delete ui.resetBtn.dataset.armed;
  refreshPause();
  ui.pause.classList.remove('hidden');
  setMode('pause');
  audio.duck(true);
  nav.open(ui.pause, menuCols(ui.pause));
}

function closePause() {
  ui.pause.classList.add('hidden');
  nav.close();
  audio.duck(false);
  if (pauseReturn === 'battle' && battle) setMode('battle');
  else if (pauseReturn === 'dialog' && !ui.dialog.classList.contains('hidden')) setMode('dialog');
  else setMode('field');
  input.settle();
  if (mode === 'battle' && ui.commands.querySelector('button')) nav.open(ui.commands, 2, 0);
}

ui.menuBtn.onclick = () => openPause();
ui.battleMenuBtn.onclick = () => openPause();
ui.resumeBtn.onclick = () => closePause();
ui.musicBtn.onclick = () => {
  prefs.music = !prefs.music;
  savePrefs();
  audio.applyPrefs();
  refreshPause();
};
ui.sfxBtn.onclick = () => {
  prefs.sfx = !prefs.sfx;
  savePrefs();
  audio.applyPrefs();
  refreshPause();
};
ui.diffBtn.onclick = () => {
  prefs.difficulty = prefs.difficulty === 'normal' ? 'gentle' : 'normal';
  savePrefs();
  refreshPause();
};
ui.resetBtn.onclick = () => {
  if (!ui.resetBtn.dataset.armed) {
    ui.resetBtn.dataset.armed = '1';
    ui.resetBtn.textContent = 'Restart? Press Again';
    return;
  }
  startNew();
};

function showEnding(kind) {
  const trueEnd = kind === 'true';
  let record = '';
  if (trueEnd) {
    if (!prefs.bestTrue || state.time < prefs.bestTrue) {
      record = prefs.bestTrue ? 'New best time for the true ending!' : '';
      prefs.bestTrue = state.time;
    }
    if (!record && prefs.bestTrue) record = `Best true ending: ${fmtTime(prefs.bestTrue)}`;
  } else {
    if (!prefs.bestTime || state.time < prefs.bestTime) {
      record = prefs.bestTime ? 'New best time for the festival!' : '';
      prefs.bestTime = state.time;
    }
    if (!record && prefs.bestTime) record = `Best festival: ${fmtTime(prefs.bestTime)}`;
  }
  savePrefs();
  ui.endEyebrow.textContent = trueEnd ? 'TRUE ENDING' : 'VERTICAL SLICE COMPLETE';
  ui.endTitle.textContent = trueEnd ? 'Dreambound' : 'Starbell!';
  ui.endSub.textContent = trueEnd ? 'The Hollow Sky is quiet—for good.' : 'The Hollow Sky is quiet—for now.';
  ui.endCopy.textContent = trueEnd
    ? 'The Horned King was only ever a dream that wanted a crown. Kite sleeps without shouting, the rift closes, and the Starbell rings until dawn.'
    : 'You crossed the Echo Below, recovered the crown, and defended Starweave. Free-roam is now open—though the rift on the pass is still humming.';
  ui.endStats.innerHTML = [
    ['Journey', fmtTime(state.time)],
    ['Battles won', state.wins],
    ['Lanterns lit', `${litCount()}/5`],
    ['Herbs left', state.herbs],
  ].map(([k, v]) => `<div class="statbox"><b>${v}</b><span>${k}</span></div>`).join('');
  ui.endRecord.textContent = record;
  ui.ending.classList.remove('hidden');
  setMode('ending');
  nav.open(ui.ending, menuCols(ui.ending));
}

ui.freeBtn.onclick = () => {
  ui.ending.classList.add('hidden');
  nav.close();
  hookClock = 0;
  setMode('field');
  input.settle();
};
ui.againBtn.onclick = () => startNew();

/* ------------------------------------------------------------------ the field loop */

function blocked(x, z) {
  if (x < -20 || x > 20 || z < -11 || z > 70) return true;
  for (const c of boxes) if (Math.abs(x - c.x) < c.w / 2 && Math.abs(z - c.z) < c.d / 2) return true;
  for (const c of circles) {
    if (c.on && !c.on()) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return true;
  }
  return false;
}

function nearestInteract() {
  let best = null;
  let bd = Infinity;
  for (const it of interactables) {
    if (it.only === 'echo' && !state.echo) continue;
    if (it.only === 'real' && state.echo) continue;
    if (it.when && !it.when()) continue;
    const d = Math.hypot(player.position.x - it.pos.x, player.position.z - it.pos.z);
    if (d < it.radius && d < bd) {
      best = it;
      bd = d;
    }
  }
  return best;
}

function movePlayer(dt) {
  const v = input.vector('move');
  if (Math.hypot(v.x, v.y) < 0.03) {
    player.position.y = Math.max(0, player.position.y - dt * 0.4);
    return;
  }
  // Camera-relative: up on the stick or W walks away from the camera.
  const yaw = YAW0 + camYaw;
  const dirX = -Math.sin(yaw) * v.y + Math.cos(yaw) * v.x;
  const dirZ = -Math.cos(yaw) * v.y - Math.sin(yaw) * v.x;
  const dashing = input.down('dash');
  const speed = dashing ? 7.0 : 4.6;
  const p = player.position;
  const stuck = blocked(p.x, p.z); // never trap a player who starts inside a collider
  const nx = p.x + dirX * speed * dt;
  const nz = p.z + dirZ * speed * dt;
  if (stuck || !blocked(nx, p.z)) p.x = clamp(nx, -20, 20);
  if (stuck || !blocked(p.x, nz)) p.z = clamp(nz, -11, 70);
  walkPhase += dt * (dashing ? 13.5 : 10);
  p.y = Math.abs(Math.sin(walkPhase)) * 0.05;
  player.rotation.y = turnToward(player.rotation.y, Math.atan2(dirX, dirZ), 1 - Math.exp(-16 * dt));
}

function updateFollowers(dt) {
  const k0 = 1 - Math.pow(1 - 0.14, dt * 60);
  const k1 = 1 - Math.pow(1 - 0.11, dt * 60);
  const k2 = 1 - Math.pow(1 - 0.09, dt * 60);
  trail[0].lerp(player.position, k0);
  trail[1].lerp(trail[0], k1);
  trail[2].lerp(trail[1], k2);
  for (let i = 0; i < 2; i++) {
    const target = trail[i + 1];
    const f = followers[i];
    followTarget.set(target.x + (i ? -0.55 : 0.55), 0, target.z + 0.65 + i * 0.2);
    f.position.lerp(followTarget, Math.min(1, dt * 6));
    f.rotation.y = player.rotation.y;
    f.position.y = Math.abs(Math.sin(walkPhase - i)) * 0.04;
  }
}

function updateCamera(dt, snap = false) {
  const yaw = YAW0 + camYaw;
  const p = player.position;
  camDesired.set(p.x + Math.sin(yaw) * CAM_R * camZoom, p.y + CAM_H * camZoom, p.z + Math.cos(yaw) * CAM_R * camZoom);
  if (snap) camera.position.copy(camDesired);
  else camera.position.lerp(camDesired, 1 - Math.pow(0.001, dt));
  camera.lookAt(p.x + Math.sin(camYaw) * 2.2, p.y + 0.9, p.z + Math.cos(camYaw) * 2.2);
  // The sun's shadow box follows the party (snapped, so the shadow edges don't crawl).
  sun.target.position.set(Math.round(p.x * 2) / 2, 0, Math.round(p.z * 2) / 2);
  sun.position.copy(sun.target.position).add(SUN_OFFSET);
}

function updateField(dt, playing) {
  const t = gTime.value;
  rift.group.rotation.y += dt * 0.08;
  rift.pts.rotation.z += dt * 0.06;
  for (const n of npcs) n.obj.position.y = Math.sin(t * 1.5 + n.obj.userData.bob) * 0.03;
  for (let i = 0; i < lanterns.length; i++) {
    if (!state.lanterns[i]) continue;
    lanterns[i].crystal.rotation.y += dt * 1.4;
    lanterns[i].crystal.position.y = 1.45 + Math.sin(t * 2 + i) * 0.05;
  }
  if (throne.visible) throneGem.rotation.y += dt;
  if (mode === 'title') camYaw += dt * 0.06;

  if (playing) {
    const lk = input.look('look');
    camYaw -= lk.x;
    const z = input.zoom();
    if (z) camZoom = clamp(camZoom * Math.exp(-z * 0.12), 0.7, 1.4);
    if (input.down('zoomIn')) camZoom = clamp(camZoom * Math.exp(-dt * 1.2), 0.7, 1.4);
    if (input.down('zoomOut')) camZoom = clamp(camZoom * Math.exp(dt * 1.2), 0.7, 1.4);
    movePlayer(dt);
    updateFollowers(dt);
    currentInteract = nearestInteract();
    updatePrompt();
    if (input.pressed('act') && currentInteract) {
      audio.unlock();
      currentInteract.fn();
    } else if (state.stage >= 1 && !state.echo && !state.fieldWin && player.position.z > 23 && player.position.z < 34) {
      startBattle('moss');
    }
    saveClock += dt;
    if (saveClock > 8 && mode === 'field') {
      saveClock = 0;
      save();
    }
    if (state.stage === 7 && !state.kingDown && mode === 'field') {
      hookClock += dt;
      if (hookClock > 0.6) {
        hookClock = 0;
        postGameHook();
      }
    } else hookClock = 0;
  }
  updateCamera(dt);
}

function handleInput(dt) {
  switch (mode) {
    case 'title':
    case 'ending':
      nav.update(dt);
      break;
    case 'pause':
      if (input.pressed('pause') || input.pressed('back')) closePause();
      else nav.update(dt);
      break;
    case 'dialog':
      if (input.pressed('pause')) {
        openPause();
        break;
      }
      updateDialog(dt);
      if (input.pressed('act') || input.pointer.justDown) advanceDialog();
      break;
    case 'field':
      if (input.pressed('pause')) openPause();
      break;
    case 'battle':
      if (input.pressed('pause')) {
        openPause();
        break;
      }
      if (input.pressed('back')) {
        battle?.undo();
        break;
      }
      for (let i = 0; i < 4; i++) {
        if (input.pressed(`cmd${i + 1}`)) {
          battle?.command(i);
          return;
        }
      }
      nav.update(dt);
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ start */

updateQuest();
setWorldMode(false, true);
placeParty(0, -1);
openTitle();

/** Build every pipeline once under the loading card: both scenes, all three foes, the throne. */
function warmUp() {
  for (const m of Object.values(arena.monsters)) m.visible = true;
  showScene('battle');
  updateArenaCamera(0);
  post.render();
  for (const m of Object.values(arena.monsters)) m.visible = false;
  showScene('field');
  throne.visible = true;
  post.render();
  updateWorldFlags();
}

let warmed = false;
kit.start((rawDt) => {
  if (!warmed) {
    warmed = true;
    try {
      warmUp();
    } finally {
      kit.loading.done();
    }
    return;
  }
  const dt = Math.min(rawDt, 0.05);
  gTime.value += dt;
  audio.update();
  if (mode !== 'pause') runTimers(dt);
  if (started && (mode === 'field' || mode === 'dialog' || mode === 'battle' || mode === 'fade')) state.time += dt;
  const startMode = mode;
  handleInput(dt);
  if (battle && mode !== 'pause') battle.update(dt);
  else if (!battle) updateField(dt, startMode === 'field' && mode === 'field');
  if (mode !== 'pause') {
    fieldSparks.update(dt);
    arena.sparks.update(dt);
  }
  post.render();
});
