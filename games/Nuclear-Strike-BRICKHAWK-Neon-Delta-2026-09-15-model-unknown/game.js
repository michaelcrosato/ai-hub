/* BRICKHAWK: Neon Delta — flight, weapons, missions, HUD and menus.
 * Rendering is in render.js (three.js r186 through the shared kit); this file keeps the
 * original game: its world builders, enemies, rescue winch, carrier service, radio and map.
 */
import { boot } from 'kit/boot.js';
import { BrickRenderer, Math3 } from './render.js';

const $ = (id) => document.getElementById(id),
  clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp = (a, b, t) => a + (b - a) * t,
  TAU = Math.PI * 2,
  SQ = Math.SQRT1_2;
const HOME = { x: -67, z: 78, y: 3.55 };
const C = {
  cream: 0xf1ebc9,
  white: 0xe8ece0,
  navy: 0x213b43,
  dark: 0x152b35,
  orange: 0xf09a4a,
  red: 0xd66c56,
  mint: 0x82efd0,
  lime: 0xd7eb83,
  sand: 0xd6bc83,
  metal: 0x779599,
  grey: 0x556969,
  glass: 0x27515e,
};
let seed = 81738;
function rnd() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const rand = (a, b) => a + Math.random() * (b - a);
/** @type {BrickRenderer} */
let R;
let kit = null;
let input = null;

/* ------------------------------------------------------------------ settings and difficulty */

const DIFFICULTY = {
  relaxed: { label: 'RELAXED', damage: 0.58, fuel: 0.63, fire: 1.15, timer: 1, convoy: 3.8 },
  standard: { label: 'STANDARD', damage: 1, fuel: 1, fire: 1, timer: 1, convoy: 4.4 },
  veteran: { label: 'VETERAN', damage: 1.3, fuel: 1.15, fire: 0.8, timer: 0.84, convoy: 5 },
};
const DIFF_ORDER = ['relaxed', 'standard', 'veteran'];
const options = { sound: true, difficulty: 'standard', shake: true, op: 0 };
try {
  const saved = JSON.parse(localStorage.getItem('brickhawk.settings') || '{}');
  for (const k of Object.keys(options)) if (k in saved) options[k] = saved[k];
} catch {
  /* private mode */
}
if (!DIFFICULTY[options.difficulty]) options.difficulty = 'standard';
options.op = options.op === 1 ? 1 : 0;
options.sound = options.sound !== false;
options.shake = options.shake !== false;

/* ------------------------------------------------------------------ operations */

const OPS = [
  {
    code: '01',
    name: 'NEON DELTA',
    title: 'Operation Neon Delta',
    card: 'Small bricks. Big trouble.',
    intro: 'One helicopter. A very bad plan.<br>Break the radar net. Bring your people home.<br>Stop the launch.',
    tasks: ['Take down two radar stations.', 'Rescue three field engineers.', 'Stop the MONARCH launcher.'],
    mapTasks: [
      'Destroy both radar stations.',
      'Rescue three engineers. Take them to the carrier.',
      'Stop the MONARCH launcher before it fires.',
      'Return to the carrier.',
    ],
    threat: 'NOT IDEAL',
    crew: 3,
    crewWord: 'ENGINEER',
    timer: 180,
    timerLabel: 'LAUNCH IN',
    sites: [{ x: -44, z: -44, bx: -44, bz: -45 }],
    lockCenter: { x: -44, z: -45 },
  },
  {
    code: '02',
    name: 'IRON TIDE',
    title: 'Operation Iron Tide',
    card: 'The convoy never sleeps.',
    intro: 'One helicopter. A longer week.<br>Stop the convoy. Bring the pilots home.<br>Break the big gun.',
    tasks: ['Stop the armored convoy.', 'Rescue four downed pilots.', 'Break the BASTION gun.'],
    mapTasks: [
      'Destroy the convoy before two trucks reach the ridge road.',
      'Rescue four pilots. The cabin holds three.',
      'Destroy three shield pylons, then BASTION.',
      'Return to the carrier.',
    ],
    threat: 'CONSIDERABLE',
    crew: 4,
    crewWord: 'PILOT',
    timer: 210,
    timerLabel: 'SALVO IN',
    sites: [
      { x: -76.5, z: -23, bx: -76.5, bz: -23 },
      { x: -9, z: -72, bx: -9, bz: -72 },
    ],
    lockCenter: null,
  },
];
const op = () => OPS[G.op] || OPS[0];
const diff = () => DIFFICULTY[G.difficulty] || DIFFICULTY.standard;

/** Operation 02's convoy follows the roads from below the old launch pad, over the bridge, to the ridge road above the carrier. */
const ROUTE = [
  [48, -50],
  [47, -24],
  [47, 14],
  [26, 14],
  [-8, 14],
  [-47, 14],
  [-47, 27],
  [-47, 57],
];
const ROUTE_LEN = [0];
for (let i = 1; i < ROUTE.length; i++) ROUTE_LEN.push(ROUTE_LEN[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]));
const ROUTE_TOTAL = ROUTE_LEN[ROUTE_LEN.length - 1];
const CONVOY_ESCAPE_LIMIT = 2;

/* ------------------------------------------------------------------ state */

const G = {
  state: 'menu',
  op: options.op,
  t: 0,
  elapsed: 0,
  phase: 0,
  radars: 0,
  delivered: 0,
  timeLeft: 180,
  timerMax: 180,
  selected: 0,
  score: 0,
  kills: 0,
  damageTaken: 0,
  shotsFired: 0,
  hits: 0,
  services: 0,
  convoyKilled: 0,
  convoyEscaped: 0,
  pylons: 0,
  difficulty: 'standard',
  enemies: [],
  people: [],
  pickups: [],
  props: [],
  wrecks: [],
  shots: [],
  particles: [],
  effects: [],
  target: null,
  context: null,
  radioTime: 0,
  toastTime: 0,
  shake: 0,
  damage: 0,
  saveTime: 0,
  lowFuel: false,
  lowArmor: false,
  flareTime: 0,
  winchProgress: 0,
  winchId: null,
  camX: HOME.x,
  camZ: HOME.z,
  camY: 0,
  homeProgress: 0,
  endDelay: 0,
  invuln: 0,
  holdLock: false,
  heliLost: false,
  serviceVisit: false,
  resultWin: false,
  resultReason: '',
  failKind: '',
};
const player = {
  x: HOME.x,
  y: 11.4,
  z: HOME.z,
  vx: 0,
  vz: 0,
  yaw: 0.35,
  hp: 100,
  fuel: 100,
  ammo: [480, 18, 6],
  cool: [0, 0, 0],
  cargo: 0,
  roll: 0,
  pitch: 0,
};
const MAX_AMMO = [480, 18, 6];
let helpFrom = 'menu',
  hudClock = 0,
  warnClock = 0,
  menuTime = 0,
  fatal = false,
  maxParticles = 230;

/* ------------------------------------------------------------------ sound (synthesized, lazily started) */

const AudioSys = {
  ctx: null,
  master: null,
  engine: null,
  noise: null,
  beat: 0,
  step: 0,
  init() {
    try {
      if (!this.ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return;
        this.ctx = new A();
        this.master = this.ctx.createGain();
        this.master.gain.value = options.sound ? 0.5 : 0;
        this.master.connect(this.ctx.destination);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        let d = this.noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        let n = this.ctx.createBufferSource();
        n.buffer = this.noise;
        n.loop = true;
        let f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 430;
        this.engine = this.ctx.createGain();
        this.engine.gain.value = 0;
        n.connect(f);
        f.connect(this.engine);
        this.engine.connect(this.master);
        let l = this.ctx.createOscillator(),
          lg = this.ctx.createGain();
        l.type = 'sine';
        l.frequency.value = 22;
        lg.gain.value = 0.018;
        l.connect(lg);
        this.lfoGain = lg;
        lg.connect(this.engine.gain);
        l.start();
        n.start();
        this.rotorFilter = f;
      }
      if (!this.held) this.ctx.resume().catch(() => {});
    } catch {
      /* no audio on this device */
    }
  },
  held: false,
  /** Silence everything while the game is hidden or the kit's settings panel is open. */
  hold(on) {
    this.held = !!on;
    if (!this.ctx) return;
    (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => {});
  },
  tone(freq, dur = 0.15, type = 'sine', vol = 0.12, end = null) {
    if (!this.ctx || !options.sound) return;
    const c = this.ctx,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(10, end), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.007);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  burst(dur, freq, vol, pan = 0) {
    if (!this.ctx || !options.sound) return;
    let c = this.ctx,
      t = c.currentTime,
      n = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    n.buffer = this.noise;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.15), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f);
    f.connect(g);
    if (c.createStereoPanner) {
      let p = c.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      p.connect(this.master);
    } else g.connect(this.master);
    n.start(t, Math.random() * 0.2);
    n.stop(t + dur + 0.02);
  },
  sfx(name, x = player.x, z = player.z) {
    const pan = (x - player.x - (z - player.z)) / 48;
    if (name === 'gun') {
      this.burst(0.08, 2300, 0.12, pan);
      this.tone(80, 0.06, 'triangle', 0.07, 28);
    }
    if (name === 'rocket') {
      this.burst(0.38, 1900, 0.21, pan);
      this.tone(170, 0.25, 'sawtooth', 0.06, 50);
    }
    if (name === 'boom') {
      this.burst(0.85, 1400, 0.34, pan);
      this.tone(80, 0.5, 'sine', 0.3, 23);
    }
    if (name === 'smallboom') {
      this.burst(0.23, 1700, 0.16, pan);
      this.tone(110, 0.15, 'triangle', 0.08, 32);
    }
    if (name === 'hit') {
      this.burst(0.14, 900, 0.15, pan);
      this.tone(90, 0.12, 'triangle', 0.09, 30);
    }
    if (name === 'beep') this.tone(690, 0.1, 'sine', 0.09, 860);
    if (name === 'rescue') {
      this.tone(440, 0.2, 'sine', 0.12);
      setTimeout(() => this.tone(660, 0.3, 'sine', 0.09), 130);
    }
    if (name === 'empty') this.tone(125, 0.07, 'square', 0.035);
    if (name === 'warn') {
      this.tone(880, 0.07, 'square', 0.028);
      setTimeout(() => this.tone(660, 0.09, 'square', 0.028), 110);
    }
    if (name === 'flare') {
      this.burst(0.4, 5500, 0.12);
      this.tone(500, 0.15, 'sine', 0.04, 900);
    }
  },
  tick(dt) {
    if (!this.ctx) return;
    let active = G.state === 'play';
    this.master.gain.setTargetAtTime(options.sound ? (active ? 0.52 : 0.19) : 0, this.ctx.currentTime, 0.12);
    this.engine.gain.setTargetAtTime(active ? 0.055 : 0, this.ctx.currentTime, 0.2);
    if (this.lfoGain) this.lfoGain.gain.setTargetAtTime(active ? 0.018 : 0, this.ctx.currentTime, 0.15);
    if (this.rotorFilter) this.rotorFilter.frequency.setTargetAtTime(400 + Math.hypot(player.vx, player.vz) * 12, this.ctx.currentTime, 0.2);
    if (!active || !options.sound) return;
    this.beat -= dt;
    if (this.beat <= 0) {
      this.beat = 0.29;
      const notes = [55, 55, 65.406, 55, 82.407, 55, 73.416, 65.406];
      this.tone(notes[(this.step >> 2) % 8], 0.22, 'triangle', 0.047);
      if (this.step % 4 === 2) this.burst(0.065, 2900, 0.014);
      if (this.step % 8 === 0) this.tone(110, 0.4, 'sine', 0.025);
      this.step++;
    }
  },
};

/* ------------------------------------------------------------------ the island */

function rawLand(x, z) {
  const a = ((x + 22) / 93) ** 2 + ((z + 8) / 83) ** 2,
    b = ((x - 50) / 49) ** 2 + ((z + 44) / 49) ** 2;
  const edge = 1 + 0.032 * Math.sin(z * 0.13) + 0.025 * Math.sin(x * 0.15);
  const river = 9 + 9 * Math.sin(z * 0.04);
  return Math.min(a, b) < edge && Math.abs(x - river) > 8.0;
}
function tileLand(x, z) {
  x = Math.round(x / 5) * 5;
  z = Math.round(z / 5) * 5;
  return rawLand(x, z);
}
function landClass(x, z) {
  if (!rawLand(x, z)) return 0;
  for (const [a, b] of [
    [5, 0],
    [-5, 0],
    [0, 5],
    [0, -5],
  ])
    if (!rawLand(x + a, z + b)) return 1;
  return 2;
}
function groundAt(x, z) {
  if (Math.abs(x - HOME.x) < 11 && Math.abs(z - (HOME.z - 5)) < 18) return HOME.y;
  if (Math.abs(z - 14) < 4 && x > -7 && x < 28) return 2.6;
  return tileLand(x, z) ? 1.65 : 0;
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/* ------------------------------------------------------------------ brick helpers (scratch matrices, no per-call allocation) */

const ROOT = new Float32Array(16),
  NEST = new Float32Array(16),
  LOCAL = new Float32Array(16);
function put(name, x, y, z, sx, sy, sz, color, ry, rx, rz, emission, alpha, flag) {
  R.put(name, x, y, z, sx, sy, sz, color, ry, rx, rz, emission, alpha, flag);
}
function root(x, y, z, yaw = 0, rx = 0, rz = 0, s = 1) {
  R.parent = Math3.trs(x, y, z, s, s, s, rx, yaw, rz, ROOT);
}
/** A child transform under the current root (dish, turret, launcher). Returns the root to restore. */
function nest(x, y, z, rx, ry, rz) {
  const parent = R.parent;
  R.parent = Math3.mul(parent, Math3.trs(x, y, z, 1, 1, 1, rx, ry, rz, LOCAL), NEST);
  return parent;
}

function stud(x, y, z, color = C.cream, s = 0.58) {
  put('cyl', x, y, z, s, 0.23, s, color);
}
function beam(x1, y1, z1, x2, y2, z2, width, color, emission = 0) {
  const dx = x2 - x1,
    dy = y2 - y1,
    dz = z2 - z1,
    len = Math.hypot(dx, dy, dz);
  put(
    'box',
    (x1 + x2) / 2,
    (y1 + y2) / 2,
    (z1 + z2) / 2,
    width,
    len,
    width,
    color,
    Math.atan2(dx, dz),
    Math.acos(clamp(dy / (len || 1), -1, 1)),
    0,
    emission,
  );
}
function road(points, width = 5.4) {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    put('box', (a[0] + b[0]) / 2, 1.73, (a[1] + b[1]) / 2, width, 0.1, len + 1, 0xb2a784, Math.atan2(dx, dz));
    for (let t = 4; t < len; t += 8) {
      const f = t / len;
      put('box', a[0] + dx * f, 1.79, a[1] + dz * f, 0.14, 0.035, 2.1, 0xe8dbaa, Math.atan2(dx, dz));
    }
  }
}
function palm(x, z, s, yaw) {
  const y = 1.65;
  root(x, y, z, yaw, 0, 0, s);
  put('hex', 0, 2.5, 0, 0.56, 5, 0.56, 0x9e8055, 0, 0, -0.08);
  for (let k = 1; k < 5; k++) put('hex', k * 0.04, k, 0, 0.68, 0.14, 0.68, 0xbaa074);
  put('ico', 0.2, 5.05, 0, 1.25, 0.9, 1.25, 0x7e8f46);
  for (let k = 0; k < 6; k++) {
    let a = (k * TAU) / 6;
    put('wedge', Math.sin(a) * 1.3, 5.03, Math.cos(a) * 1.3, 1.12, 0.4, 3.3, k % 2 ? 0x718d4b : 0x98ad59, a, 0, 0.06);
    put('wedge', Math.sin(a) * 2.7, 4.55, Math.cos(a) * 2.7, 0.76, 0.25, 2.1, k % 2 ? 0x879e51 : 0xaabc69, a, -0.26);
  }
  R.parent = null;
}
function bush(x, z, s) {
  put('bevel', x, 1.8 + s * 0.43, z, s, s * 0.85, s, 0x778e57, rnd() * 3);
  put('bevel', x + s * 0.35, 1.8 + s * 0.65, z - 0.1, s * 0.7, s * 0.65, s * 0.8, 0x9daf63, rnd());
}
function hut(x, z, yaw = 0) {
  root(x, 1.65, z, yaw);
  for (let a of [-2.3, 2.3]) for (let b of [-2, 2]) put('box', a, 1, b, 0.25, 2, 0.25, 0x887451);
  put('bevel', 0, 2.5, 0, 5.5, 3.2, 4.8, 0xe0cfa0);
  put('box', 0, 1.25, 0, 6, 0.3, 5.6, 0x887c5d);
  put('box', 0, 2.2, -2.43, 1.25, 2.4, 0.08, C.navy);
  for (let a of [-1.7, 1.7]) put('box', a, 2.8, -2.46, 0.8, 0.7, 0.1, 0x365e61);
  put('wedge', 0, 4.45, -1.5, 6.4, 1.4, 3.1, 0xc88669);
  put('wedge', 0, 4.45, 1.5, 6.4, 1.4, 3.1, 0xc88669, Math.PI);
  for (let a of [-1.8, 0, 1.8]) put('box', a, 4.8, -1.1, 1.4, 0.08, 2.0, 0x416c79, 0, -0.22);
  put('box', 2.4, 5.5, 0.8, 0.1, 3, 0.1, C.metal);
  put('box', 2.4, 6.65, 0.8, 1.5, 0.1, 0.12, C.metal);
  R.parent = null;
}
function lab(x, z, yaw = 0) {
  root(x, 1.65, z, yaw);
  put('bevel', 0, 2.4, 0, 8, 4.8, 6, C.white);
  put('bevel', 0, 0.55, 0, 8.6, 1.1, 6.6, C.navy);
  put('box', 0, 4.95, 0, 8.5, 0.4, 6.4, 0x9dad9c);
  for (let k = -3; k <= 3; k++) put('box', k, 5.2, 0, 0.12, 0.14, 5.8, 0xc6d4be);
  put('box', 0, 2.7, -3.07, 6.2, 1.1, 0.12, 0x2e5962);
  put('box', 0, 2.45, -3.14, 6.2, 0.08, 0.15, C.mint, 0, 0, 0, 0.9);
  put('box', 3.6, 2, 0, 0.1, 2.7, 1.9, C.navy);
  put('bevel', -1.8, 5.55, 1.1, 2.3, 1.1, 2.2, C.navy);
  for (let a of [-2.3, -1.4]) put('cyl', a, 6.14, 1.1, 0.55, 0.17, 0.55, C.metal);
  stud(3, 5.3, 2, C.orange);
  R.parent = null;
}
function carrier() {
  root(HOME.x, 0, HOME.z - 4);
  put('bevel', 0, 0.8, -2, 24, 5.5, 40, C.navy);
  put('bevel', 0, 2.8, -2, 23.4, 1.1, 39.5, 0x82938a);
  put('bevel', 0, 3.3, -2, 22.4, 0.42, 38.3, 0x334a4d);
  put('bevel', 0, -0.8, 13, 19, 3, 12, 0x294049);
  for (let x of [-9.5, 9.5]) {
    put('box', x, 3.56, -1, 0.16, 0.04, 34, C.cream);
    for (let z = -17; z <= 14; z += 5) put('box', x, 3.58, z, 0.6, 0.08, 1.0, C.orange);
  }
  put('ring', 0, 3.56, 4, 7.2, 1, 7.2, C.cream);
  for (let x of [-2, 2]) put('box', x, 3.58, 4, 0.65, 0.06, 5.4, C.cream);
  put('box', 0, 3.6, 4, 4, 0.06, 0.65, C.cream);
  put('box', 2, 3.56, -9, 9, 0.03, 0.16, C.orange);
  put('box', 2, 3.56, -16, 9, 0.03, 0.16, C.orange);
  for (let x = -1; x < 7; x += 1.5) put('box', x, 3.58, -17, 0.8, 0.03, 0.9, C.cream);
  put('bevel', -6, 5.3, -14, 6, 3.5, 8, C.cream);
  put('bevel', -6, 7.5, -13.5, 6.6, 1.9, 6.5, 0xbac4ad);
  put('box', -6, 7.65, -10.22, 5.7, 0.85, 0.1, C.glass);
  put('box', -2.65, 7.65, -13.2, 0.1, 0.85, 5.3, C.glass);
  put('box', -6, 8.65, -14, 7, 0.3, 7, C.navy);
  put('cyl', -6, 10, -15, 0.4, 3, 0.4, C.metal);
  put('box', -6, 11.4, -15, 4, 0.4, 0.65, C.cream);
  put('box', -7.8, 11.5, -15, 0.12, 1.2, 0.12, C.metal);
  for (let i = 0; i < 3; i++) {
    put('bevel', 7, 4.05, -11 + i * 3, 2, 1.1, 2, 0xdfa058);
    stud(7, 4.65, -11 + i * 3, C.sand, 0.7);
  }
  put('cyl', 8.8, 4.0, 10, 1, 0.7, 1, C.orange);
  put('cyl', -8.8, 4.0, 10, 1, 0.7, 1, C.orange);
  R.parent = null;
}
function worldBuild() {
  R.mode = 'static';
  R.parent = null;
  seed = 81738;
  // The ocean is its own animated mesh in render.js.
  let grass = [0x9ea568, 0xa4ab70, 0xa9ae74, 0x99a366, 0xa0a86b],
    sand = [0xd5bf8e, 0xddc996, 0xd9c593];
  for (let z = -110; z <= 95; z += 5)
    for (let x = -120; x <= 115; x += 5) {
      let kind = landClass(x, z);
      if (!kind) continue;
      let c = kind === 1 ? sand[Math.floor(rnd() * sand.length)] : grass[Math.floor(rnd() * grass.length)];
      put('bevel', x, -0.18, z, 5.06, 2.85, 5.06, kind === 1 ? 0xc5ab7e : 0xb7a080);
      put('bevel', x, 1.34, z, 5.05, 0.63, 5.05, c);
      if (kind === 2 && rnd() < 0.22) {
        for (let a of [-1, 1]) for (let b of [-1, 1]) put('cyl', x + a * 1.18, 1.7, z + b * 1.18, 0.58, 0.12, 0.58, c);
      }
      if (kind === 1 && rnd() < 0.27) put('bevel', x + rand(-1, 1), 1.8, z + rand(-1, 1), 0.7, 0.4, 0.6, 0xe3cea0, rnd() * 3);
    }
  // The island map also drives the shallow-water shader.
  const size = 192,
    water = new Uint8Array(size * size);
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const wx = (x / size) * 270 - 135,
        wz = (z / size) * 270 - 135;
      let near = 0;
      if (tileLand(wx, wz)) near = 1;
      else
        for (let rad of [3, 6, 10, 15]) {
          let found = false;
          for (let k = 0; k < 8; k++) {
            let a = (k * TAU) / 8;
            if (tileLand(wx + Math.cos(a) * rad, wz + Math.sin(a) * rad)) {
              near = 1 - rad / 20;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      water[z * size + x] = Math.floor(near * 255);
    }
  R.landTexture(size, water);
  road([
    [-47, 57],
    [-47, 27],
    [-51, 3],
    [-44, -18],
    [-44, -43],
  ]);
  road(
    [
      [-47, 14],
      [-8, 14],
    ],
    5.5,
  );
  road(
    [
      [26, 14],
      [47, 14],
      [47, -24],
      [49, -67],
    ],
    5.5,
  );
  put('bevel', 9, 2.2, 14, 36, 0.8, 7.6, 0x8f9b85);
  for (let z of [10.4, 17.6]) {
    put('box', 9, 3.1, z, 35, 0.22, 0.25, C.cream);
    for (let x = -6; x <= 25; x += 5) put('box', x, 2.65, z, 0.27, 1.1, 0.3, 0xd6ba77);
  }
  for (let x of [-3, 10, 23]) put('bevel', x, 0.8, 14, 2.4, 3.2, 5, C.navy);
  put('box', 9, 2.64, 14, 35, 0.03, 0.16, C.cream);
  carrier();
  hut(-71, 22, 0.2);
  hut(-75, 6, -0.1);
  hut(-66, -8, 0.5);
  hut(-86, -4, 1.2);
  hut(-59, 49, -0.2);
  lab(62, -16, 0.1);
  lab(30, -8, -0.2);
  lab(68, -41, 0);
  // The rescue compound: an old stepped temple with a new field lab.
  root(-44, 1.65, -46);
  put('bevel', 0, 0.35, 0, 19, 0.7, 19, 0xb7ae85);
  put('bevel', 0, 0.8, -3, 15, 0.3, 10, 0xd9c99d);
  for (let x of [-6, 6]) {
    put('bevel', x, 2, -3, 2.8, 3.2, 8, 0xc6b285);
    put('bevel', x, 3.9, -3, 3.5, 0.6, 9, 0xe2d1a1);
    for (let z of [-6, -3, 0]) stud(x, 4.28, z, 0xd6c498, 0.9);
  }
  put('bevel', 0, 2, -7, 14, 3.2, 2, 0xcbb888);
  put('bevel', 0, 4.15, -7, 15, 0.55, 2.8, 0xdfcda0);
  put('box', 0, 1.05, 2, 6, 0.1, 6, 0x657868);
  for (let x of [-8.5, 8.5])
    for (let z of [-8, 0, 8]) {
      put('box', x, 1.4, z, 0.18, 2.8, 0.18, C.navy);
      put('box', x, 0.9, z, 0.18, 0.1, 4, C.metal);
      put('box', x, 2, z, 0.18, 0.1, 4, C.metal);
    }
  for (let z of [7, 5, 3]) put('box', 0, 0.78, z, 3.5, 0.06, 0.3, C.orange);
  put('bevel', 7, 1.6, 5, 2.5, 3.2, 2.5, C.navy);
  put('box', 7, 3.4, 5, 1.6, 0.35, 1.6, C.mint, 0, 0, 0, 0.5);
  R.parent = null;
  // Industrial detail and a low-poly mountain border.
  for (let [x, z] of [
    [58, 31],
    [60, -52],
    [23, -56],
  ]) {
    put('cyl', x, 4, z, 4, 5, 4, 0xa9b5a1);
    put('cyl', x, 6.7, z, 4.3, 0.5, 4.3, C.cream);
    put('cyl', x, 3.2, z, 4.03, 0.5, 4.03, C.orange);
    put('box', x + 2.2, 3.8, z, 0.15, 5, 0.15, C.navy);
  }
  for (let k = 0; k < 7; k++) {
    let x = -85 + k * 7,
      z = -44 - k * 4;
    if (!tileLand(x, z)) continue;
    let h = 4 + rnd() * 9;
    put('bevel', x, 1.3 + h * 0.38, z, 11, h * 0.76, 12, 0x8b9271, rnd() * 0.4);
    put('bevel', x, 1.5 + h * 0.65, z, 8, h * 0.52, 9, 0xa4aa7b, 0.15);
    put('bevel', x, 1.6 + h * 0.94, z, 6, 0.7, 6, 0xb3b985, rnd() * 0.5);
  }
  for (let i = 0; i < 150; i++) {
    const x = rnd() * 220 - 110,
      z = rnd() * 190 - 100;
    if (landClass(Math.round(x / 5) * 5, Math.round(z / 5) * 5) !== 2) continue;
    const protectedSites = [
      [-47, 27, 13],
      [42, -25, 14],
      [-44, -46, 17],
      [48, -65, 16],
      [-67, 65, 25],
      [-72, 17, 12],
      [-74, -3, 17],
      [62, -16, 13],
      [30, -8, 13],
      [68, -41, 12],
    ];
    if (protectedSites.some(([a, b, d]) => Math.hypot(x - a, z - b) < d)) continue;
    if ((Math.abs(x + 46) < 8 && z < 59 && z > -48) || Math.abs(z - 14) < 7 || (Math.abs(x - 47) < 8 && z < 18)) continue;
    if (rnd() < 0.65) palm(x, z, 0.7 + rnd() * 0.5, rnd() * TAU);
    else bush(x, z, 2 + rnd() * 2.4);
  }
  for (let i = 0; i < 100; i++) {
    const x = rnd() * 206 - 106,
      z = rnd() * 176 - 93;
    if (!tileLand(x, z)) continue;
    if (Math.hypot(x + 44, z + 46) < 13) continue;
    for (let k = 0; k < 3; k++)
      put('cone', x + k * 0.26, 1.9 + rnd() * 0.1, z + (k % 2) * 0.23, 0.34, 0.65, 0.34, 0x7b8d50, rnd() * TAU, 0, (rnd() - 0.5) * 0.3);
  }
  for (let k = 0; k < 6; k++) {
    const x = -95 + k * 32,
      z = 91 + Math.sin(k) * 8;
    put('cyl', x, 0.15, z, 1.7, 0.9, 1.7, C.orange);
    put('cyl', x, 0.7, z, 0.32, 1.1, 0.32, C.navy);
    put('cyl', x, 1.35, z, 0.45, 0.25, 0.45, C.cream, 0, 0, 0, 1);
  }
  R.mode = 'dynamic';
}

/* ------------------------------------------------------------------ enemies and mission setup */

const ENEMY_SIZE = {
  boss: [5.0, 3.4],
  radar: [3.4, 4.4],
  boat: [3.1, 1.8],
  truck: [2.6, 1.9],
  pylon: [2.6, 5.4],
  bastion: [5.2, 4.0],
};
function newEnemy(id, type, x, z, hp) {
  const [radius, height] = ENEMY_SIZE[type] || [2.5, 1.8];
  return {
    id,
    type,
    x,
    z,
    ox: x,
    oz: z,
    y: groundAt(x, z),
    hp,
    maxHp: hp,
    alive: true,
    yaw: 0,
    turret: 0,
    cd: 1.2 + (id % 4) * 0.4,
    charge: 0,
    flash: 0,
    stun: 0,
    move: 0,
    radius,
    height,
  };
}
/** Put a convoy truck at its distance `d` along the road route. */
function placeOnRoute(e) {
  const d = clamp(e.d, 0, ROUTE_TOTAL);
  let i = 1;
  while (i < ROUTE.length - 1 && ROUTE_LEN[i] < d) i++;
  const a = ROUTE[i - 1],
    b = ROUTE[i],
    seg = ROUTE_LEN[i] - ROUTE_LEN[i - 1] || 1,
    f = (d - ROUTE_LEN[i - 1]) / seg;
  e.x = a[0] + (b[0] - a[0]) * f;
  e.z = a[1] + (b[1] - a[1]) * f;
  e.y = groundAt(e.x, e.z);
  e.routeYaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
}
function newTruck(id, d) {
  const e = newEnemy(id, 'truck', ROUTE[0][0], ROUTE[0][1], 150);
  e.d = d;
  e.escaped = false;
  placeOnRoute(e);
  e.yaw = e.routeYaw;
  return e;
}

function setupMission(opIndex = G.op) {
  G.op = opIndex === 1 ? 1 : 0;
  const o = op();
  Object.assign(player, {
    x: HOME.x,
    y: 11.4,
    z: HOME.z,
    vx: 0,
    vz: 0,
    yaw: 0.35,
    hp: 100,
    fuel: 100,
    ammo: [...MAX_AMMO],
    cool: [0, 0, 0],
    cargo: 0,
    roll: 0,
    pitch: 0,
  });
  Object.assign(G, {
    elapsed: 0,
    phase: 0,
    radars: 0,
    delivered: 0,
    timeLeft: o.timer,
    timerMax: o.timer,
    selected: 0,
    score: 0,
    kills: 0,
    damageTaken: 0,
    shotsFired: 0,
    hits: 0,
    services: 0,
    convoyKilled: 0,
    convoyEscaped: 0,
    pylons: 0,
    difficulty: options.difficulty,
    shots: [],
    particles: [],
    effects: [],
    target: null,
    context: null,
    radioTime: 0,
    toastTime: 0,
    shake: 0,
    damage: 0,
    saveTime: 0,
    lowFuel: false,
    lowArmor: false,
    flareTime: 0,
    winchProgress: 0,
    winchId: null,
    camX: HOME.x,
    camZ: HOME.z,
    camY: 0,
    homeProgress: 0,
    endDelay: 0,
    invuln: 0,
    holdLock: false,
    heliLost: false,
    serviceVisit: false,
  });
  if (G.op === 0) {
    G.enemies = [
      newEnemy(0, 'radar', -47, 27, 175),
      newEnemy(1, 'radar', 42, -25, 175),
      newEnemy(2, 'turret', -60, 34, 90),
      newEnemy(3, 'tank', -27, 36, 125),
      newEnemy(4, 'turret', -35, 2, 90),
      newEnemy(5, 'sam', 37, 3, 105),
      newEnemy(6, 'turret', -59, -34, 90),
      newEnemy(7, 'tank', -27, -50, 125),
      newEnemy(8, 'boat', 15, 39, 100),
      newEnemy(9, 'sam', 31, -46, 105),
      newEnemy(10, 'tank', 60, -59, 125),
      newEnemy(11, 'boss', 48, -65, 680),
    ];
    G.people = [
      { id: 0, x: -46, z: -43, state: 'ground', lift: 0, site: 0, kind: 'engineer' },
      { id: 1, x: -42, z: -46, state: 'ground', lift: 0, site: 0, kind: 'engineer' },
      { id: 2, x: -47, z: -48, state: 'ground', lift: 0, site: 0, kind: 'engineer' },
    ];
    G.pickups = [
      { id: 0, type: 'fuel', x: -31, z: 53, used: false },
      { id: 1, type: 'ammo', x: -59, z: 12, used: false },
      { id: 2, type: 'repair', x: -57, z: -23, used: false },
      { id: 3, type: 'fuel', x: 34, z: 29, used: false },
      { id: 4, type: 'ammo', x: 59, z: -36, used: false },
      { id: 5, type: 'repair', x: 29, z: -65, used: false },
    ];
    G.props = [
      [-36, 22],
      [-37, 27],
      [56, -18],
      [58, -20],
      [37, -34],
      [-57, -54],
    ].map(([x, z], i) => ({ id: i, x, z, hp: 35, alive: true }));
    G.wrecks = [];
  } else {
    // Operation 02: the convoy rolls first; pylons and BASTION wait on the east lobe.
    G.enemies = [
      newTruck(0, 39),
      newTruck(1, 26),
      newTruck(2, 13),
      newTruck(3, 0),
      newEnemy(4, 'flak', 40, 0, 95),
      newEnemy(5, 'sam', -28, 4, 105),
      newEnemy(6, 'tank', -25, 30, 125),
      newEnemy(7, 'turret', -70, -18, 90),
      newEnemy(8, 'flak', -84, -28, 95),
      newEnemy(9, 'boat', 15, -5, 100),
      newEnemy(10, 'turret', -4, -64, 90),
      newEnemy(11, 'tank', -18, -78, 125),
      newEnemy(12, 'pylon', 30, -30, 160),
      newEnemy(13, 'pylon', 75, -25, 160),
      newEnemy(14, 'pylon', 35, -80, 160),
      newEnemy(15, 'sam', 38, -38, 105),
      newEnemy(16, 'flak', 80, -32, 95),
      newEnemy(17, 'turret', 40, -86, 90),
      newEnemy(18, 'bastion', 48, -65, 900),
    ];
    G.people = [
      { id: 0, x: -76, z: -21, state: 'ground', lift: 0, site: 0, kind: 'pilot' },
      { id: 1, x: -77, z: -25, state: 'ground', lift: 0, site: 0, kind: 'pilot' },
      { id: 2, x: -8, z: -70, state: 'ground', lift: 0, site: 1, kind: 'pilot' },
      { id: 3, x: -10, z: -74, state: 'ground', lift: 0, site: 1, kind: 'pilot' },
    ];
    G.pickups = [
      { id: 0, type: 'fuel', x: -20, z: 50, used: false },
      { id: 1, type: 'ammo', x: -30, z: -20, used: false },
      { id: 2, type: 'repair', x: 20, z: -20, used: false },
      { id: 3, type: 'fuel', x: 60, z: 0, used: false },
      { id: 4, type: 'ammo', x: -58, z: -40, used: false },
      { id: 5, type: 'repair', x: 70, z: -70, used: false },
    ];
    G.props = [
      [43, -8],
      [44, -4],
      [-40, 19],
      [-38, 22],
      [-64, -22],
      [-6, -77],
    ].map(([x, z], i) => ({ id: i, x, z, hp: 35, alive: true }));
    G.wrecks = [
      { x: -80, z: -19, yaw: 0.7 },
      { x: -12.5, z: -67.5, yaw: -1.1 },
    ];
  }
  $('eventToast').classList.remove('show');
  $('radio').classList.remove('show');
  clearLabels();
}

/* ------------------------------------------------------------------ drawing the helicopter, enemies, crew and effects */

function heliDraw(t) {
  if (G.heliLost) return; // blown apart: only the explosion and debris remain
  const p = player;
  root(p.x, p.y, p.z, p.yaw, p.pitch, p.roll);
  put('bevel', 0, 0, 0.1, 3.45, 2.0, 5.6, C.orange);
  put('bevel', 0, -0.73, -0.05, 3.08, 0.9, 5.05, C.navy);
  put('bevel', 0, 0.7, 0.9, 3.4, 1.35, 3.4, C.cream);
  put('wedge', 0, 0.75, -1.8, 3.08, 1.6, 3.1, C.glass);
  put('wedge', 0, 0.92, -1.89, 2.72, 1.38, 2.75, 0x346b77);
  put('box', 0, 1.3, -1.15, 0.13, 0.13, 2.3, C.cream, 0, -0.34);
  put('box', 0, 0.38, -3.35, 2.12, 0.12, 0.14, C.cream);
  for (let s of [-1, 1]) {
    put('box', s * 1.62, 0.85, -1.35, 0.11, 0.95, 2.1, C.navy);
    put('box', s * 1.68, 0.25, 0.2, 0.09, 0.23, 2.1, C.cream);
    put('box', s * 1.7, 0.63, -0.05, 0.08, 0.1, 0.55, C.mint, 0, 0, 0, 1.7);
    put('bevel', s * 2.05, 0.76, 1.8, 1.15, 1.2, 3.0, C.navy);
    put('cyl', s * 2.05, 0.8, 3.24, 0.82, 0.42, 0.82, C.metal, 0, Math.PI / 2);
    put('cyl', s * 2.05, 0.8, 3.48, 0.52, 0.12, 0.52, C.mint, 0, Math.PI / 2, 0, 2.2);
    put('bevel', s * 2.86, -0.16, 0.2, 3.14, 0.36, 1.75, C.cream, 0, 0, s * -0.025);
    put('box', s * 3.1, 0.04, 0.2, 1.0, 0.06, 1.4, C.orange);
    put('cyl', s * 3.4, -0.6, 0.1, 1.16, 2.7, 1.16, C.navy, 0, Math.PI / 2);
    for (let ox of [-0.23, 0.23]) for (let oy of [-0.23, 0.23]) put('cyl', s * 3.4 + ox, -0.6 + oy, -1.3, 0.31, 0.12, 0.31, C.orange, 0, Math.PI / 2);
    put('box', s * 1.4, -1.5, -1.2, 0.17, 1.1, 0.2, C.navy);
    put('box', s * 1.4, -1.5, 1.6, 0.17, 1.1, 0.2, C.navy);
    put('bevel', s * 1.6, -2, 0, 0.29, 0.3, 5.5, C.metal);
    put('cyl', s * 4.3, 0.05, 0.25, 0.33, 0.16, 0.33, s < 0 ? C.red : C.mint, 0, 0, 0, 1.9);
    stud(s * 0.87, 1.47, 0.55, C.cream, 0.56);
    stud(s * 0.87, 1.47, 1.7, C.cream, 0.56);
  }
  put('bevel', 0, 0.4, 5, 1.02, 0.92, 5.2, C.orange);
  put('bevel', 0, 0.48, 7.1, 0.67, 0.66, 2.2, C.cream);
  put('box', 0, 1.55, 7.1, 0.22, 2.6, 1.65, C.orange, 0, -0.2);
  put('box', 0, 2.54, 7.35, 0.26, 0.18, 1.2, C.navy);
  put('bevel', 0, 0.6, 6.2, 3.45, 0.22, 1.0, C.navy);
  put('box', 0, 0.5, 5.25, 1.04, 0.13, 0.46, C.navy);
  put('box', 0, 0.5, 5.85, 0.97, 0.13, 0.46, C.navy);
  put('cyl', 0, 1.93, 0.2, 0.36, 1.16, 0.36, C.metal);
  put('bevel', 0, 2.51, 0.2, 1.3, 0.25, 1.3, C.navy);
  const rot = t * 24;
  for (let a of [rot, rot + Math.PI / 2]) {
    put('bevel', 0, 2.69, 0.2, 15.5, 0.11, 0.42, C.navy, a);
    for (let s of [-1, 1]) put('box', Math.cos(a) * s * 7.3, 2.72, 0.2 - Math.sin(a) * s * 7.3, 1.05, 0.08, 0.44, C.cream, a);
  }
  put('ring', 0, 2.71, 0.2, 7.1, 1, 7.1, 0xc9d7bc, 0, 0, 0, 0, 0.055, 2);
  put('cyl', 0.46, 1.29, 7.2, 0.23, 0.6, 0.23, C.metal, 0, 0, Math.PI / 2);
  put('box', 0.79, 1.29, 7.2, 0.1, 2.2, 0.18, C.navy, rot * 1.7, 0, rot * 2);
  put('box', 0.79, 1.29, 7.2, 0.1, 0.18, 2.2, C.cream, rot * 1.7, 0, rot * 2);
  put('bevel', 0, -0.98, -2.5, 0.85, 0.6, 0.95, C.navy);
  put('cyl', 0, -1.04, -3.48, 0.32, 1.7, 0.32, C.metal, 0, Math.PI / 2);
  if (player.cool[G.selected] > (G.selected === 0 ? 0.055 : 0.3)) put('ico', 0, -1.02, -4.38, 0.9, 0.85, 1.6, 0xffd494, 0, 0, 0, 4);
  R.parent = null;
}
function enemyDraw(e, t) {
  if (e.escaped) return; // a convoy truck that got away
  if (!e.alive) {
    const big = e.type === 'boss' || e.type === 'bastion';
    root(e.x, e.y, e.z, e.yaw);
    put('bevel', 0, 0.42, 0, big ? 6.8 : 4, 0.8, big ? 10 : 4, 0x4e5450);
    put('bevel', 0.5, 0.9, 0.3, 2.5, 1.0, 2.4, 0x393f3d, 0.4, 0, 0.17);
    put('box', -0.8, 1.3, -0.4, 0.6, 0.6, 2.5, 0x756957, -0.6, 0.3, 0.2);
    R.parent = null;
    return;
  }
  const color = e.flash > 0 ? 0xffe2b8 : C.red;
  root(e.x, e.y, e.z, e.yaw);
  if (e.type === 'radar') {
    put('bevel', 0, 0.55, 0, 6, 1.1, 6, C.navy);
    put('bevel', 0, 1.5, 0, 4.4, 1.0, 4.4, color);
    for (const x of [-1.45, 1.45]) for (const z of [-1.45, 1.45]) stud(x, 2.1, z, C.red, 0.72);
    put('bevel', 0, 3.1, 0, 1.25, 3.1, 1.25, C.cream);
    for (let k = 0; k < 3; k++) put('box', 0, 2.6 + k * 0.75, 0, 1.35, 0.12, 1.35, C.metal);
    const parent = nest(0, 5.2, 0, 0, (Math.floor(t * 9) / 9) * 0.8, 0);
    put('bevel', 0, 0, 0, 6.4, 3.6, 0.85, C.navy, 0, 0, -0.1);
    for (const x of [-2.15, -0.7, 0.7, 2.15]) for (const y of [-0.85, 0.45]) put('bevel', x, y, -0.5, 1.18, 0.95, 0.12, 0x84b7b5);
    put('box', 0, -0.2, -1.3, 0.18, 0.18, 2.4, C.cream);
    put('ico', 0, -0.2, -2.6, 0.38, 0.38, 0.38, C.orange, 0, 0, 0, 1.5);
    R.parent = parent;
    put('cyl', 2, 2.35, 2, 0.38, 0.38, 0.38, C.red, 0, 0, 0, 2);
  } else if (e.type === 'turret' || e.type === 'sam') {
    put('bevel', 0, 0.45, 0, 4.1, 0.9, 4.1, C.navy);
    put('bevel', 0, 1.05, 0, 3.0, 0.5, 3.0, color);
    for (const x of [-1.1, 1.1]) for (const z of [-1.1, 1.1]) stud(x, 1.45, z, C.metal, 0.4);
    const parent = nest(0, 1.95, 0, 0, e.turret - e.yaw, 0);
    put('bevel', 0, 0, 0, 2.4, 1.3, 2.1, color);
    if (e.type === 'sam') {
      for (const x of [-1.25, 1.25]) {
        put('bevel', x, 0.3, 0, 1.0, 1.1, 3.1, C.navy, 0, -0.25);
        put('box', x, 0.6, -1.56, 0.7, 0.8, 0.1, C.orange, 0, -0.25);
      }
      put('box', 0, 1.05, 0.1, 1.6, 0.7, 0.25, C.cream);
    } else {
      for (const x of [-0.52, 0.52]) {
        put('cyl', x, 0.05, -1.8, 0.35, 2.8, 0.35, C.metal, 0, Math.PI / 2);
        put('cyl', x, 0.05, -3.2, 0.43, 0.3, 0.43, C.navy, 0, Math.PI / 2);
      }
    }
    put('box', 0, 0.5, -1.1, 0.5, 0.2, 0.1, C.red, 0, 0, 0, 3);
    R.parent = parent;
  } else if (e.type === 'flak') {
    // Quad-barrel flak gun: fires short three-shot bursts.
    put('bevel', 0, 0.45, 0, 4.4, 0.9, 4.4, C.navy);
    put('bevel', 0, 1.05, 0, 3.2, 0.5, 3.2, color);
    for (const x of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) stud(x, 1.45, z, C.metal, 0.4);
    const parent = nest(0, 2.0, 0, 0, e.turret - e.yaw, 0);
    put('bevel', 0, 0, 0.2, 2.7, 1.2, 2.4, color);
    put('box', 0, 0.75, 0.2, 2.2, 0.2, 1.8, C.cream);
    for (const x of [-0.78, -0.26, 0.26, 0.78]) put('cyl', x, 0.75, -1.45, 0.24, 2.7, 0.24, C.metal, 0, Math.PI / 2 + 0.45);
    put('box', 0, 0.35, -1.0, 1.9, 0.2, 0.1, C.red, 0, 0, 0, 3);
    R.parent = parent;
  } else if (e.type === 'truck') {
    // Armored convoy truck: cab in front, cargo box behind, six wheels.
    for (const s of [-1, 1]) for (const z of [-2.1, 0.3, 2.2]) put('cyl', s * 1.55, 0.72, z, 1.1, 0.45, 1.1, 0x33413f, 0, 0, Math.PI / 2);
    put('bevel', 0, 1.2, 0, 3.0, 0.7, 6.8, C.dark);
    put('bevel', 0, 2.15, -2.25, 2.8, 1.5, 2.1, color);
    put('box', 0, 2.45, -3.32, 2.3, 0.6, 0.08, C.glass);
    put('bevel', 0, 2.55, 1.2, 3.0, 2.2, 4.2, C.navy);
    put('box', 0, 3.7, 1.2, 3.1, 0.18, 4.3, color);
    for (const x of [-0.8, 0.8]) stud(x, 3.88, 1.2, C.cream, 0.5);
    put('box', 0, 1.9, -3.36, 1.6, 0.2, 0.1, C.orange, 0, 0, 0, 1.6);
  } else if (e.type === 'pylon') {
    // Shield pylon: feeds BASTION's dome through a glowing mint link.
    put('bevel', 0, 0.5, 0, 4.2, 1.0, 4.2, C.navy);
    put('bevel', 0, 1.3, 0, 3.0, 0.6, 3.0, color);
    for (const x of [-1.1, 1.1]) for (const z of [-1.1, 1.1]) stud(x, 1.7, z, C.metal, 0.4);
    put('cyl', 0, 3.7, 0, 1.0, 4.4, 1.0, C.metal);
    for (let k = 0; k < 3; k++) put('cyl', 0, 2.5 + k * 1.3, 0, 1.9, 0.22, 1.9, k === 1 ? C.mint : C.cream, 0, 0, 0, k === 1 ? 1.4 : 0);
    put('ico', 0, 6.3 + Math.sin(t * 3 + e.id) * 0.15, 0, 1.3, 1.3, 1.3, C.mint, t, 0, 0, 2.2);
  } else if (e.type === 'bastion') {
    // BASTION: a stepped brick fortress with a long twin gun on a turntable.
    put('bevel', 0, 0.7, 0, 12, 1.4, 12, C.navy);
    put('bevel', 0, 1.9, 0, 10, 1.2, 10, color);
    for (const x of [-4.6, 4.6])
      for (const z of [-4.6, 4.6]) {
        put('bevel', x, 3.0, z, 2.2, 2.6, 2.2, C.navy);
        stud(x, 4.4, z, C.red, 0.9);
      }
    put('bevel', 0, 3.1, 0, 6.5, 1.4, 6.5, C.dark);
    const parent = nest(0, 4.2, 0, 0, e.turret - e.yaw, 0);
    put('bevel', 0, 0.4, 0.6, 4.8, 1.8, 5.2, color);
    put('box', 0, 1.4, 0.6, 4.9, 0.2, 5.3, C.cream);
    for (const x of [-0.9, 0.9]) {
      put('cyl', x, 0.6, -4.2, 0.7, 6.2, 0.7, C.metal, 0, Math.PI / 2);
      put('cyl', x, 0.6, -7.4, 0.9, 0.5, 0.9, C.navy, 0, Math.PI / 2);
    }
    put('box', 0, 0.9, -1.95, 2.8, 0.5, 0.12, C.mint, 0, 0, 0, e.charge > 0 ? 2.6 : 1.2);
    R.parent = parent;
    if (isShielded(e)) put('ico', 0, 3.6, 0, 16, 11, 16, 0x66d6dc, 0, 0, 0, 0.8, 0.1, 2);
  } else if (e.type === 'tank' || e.type === 'boss') {
    const boss = e.type === 'boss';
    const len = boss ? 10.5 : 5.7,
      w = boss ? 4.6 : 3.1;
    for (const s of [-1, 1]) {
      put('bevel', s * (w * 0.5 + 0.2), 0.8, 0, boss ? 1.3 : 0.9, 1.6, len, C.dark);
      for (let k = 0; k < (boss ? 6 : 4); k++) {
        const z = -len * 0.39 + (k * len * 0.78) / (boss ? 5 : 3);
        put('cyl', s * (w * 0.5 + 0.85), 0.8, z, boss ? 1.0 : 0.8, 0.17, boss ? 1.0 : 0.8, 0x7e8c7b, 0, 0, Math.PI / 2);
      }
      put('bevel', s * w * 0.5, 1.85, 0, boss ? 1.5 : 1.0, 0.35, len * 0.92, color);
    }
    put('bevel', 0, 1.5, 0, w, 1.25, len * 0.9, color);
    if (!boss) {
      const par = nest(0, 2.5, 0, 0, e.turret - e.yaw, 0);
      put('bevel', 0, 0, 0, 2.3, 1.05, 2.6, C.navy);
      put('bevel', 0, 0.4, 0.3, 1.6, 0.6, 1.7, color);
      put('cyl', 0, 0.1, -2.6, 0.42, 4, 0.42, C.metal, 0, Math.PI / 2);
      put('box', 0, 0.5, -0.85, 0.55, 0.2, 0.1, C.red, 0, 0, 0, 2);
      R.parent = par;
    } else {
      put('bevel', 0, 2.5, -3.7, w, 2.2, 2.8, C.navy);
      put('box', 0, 2.9, -5.17, w * 0.8, 0.7, 0.12, 0x47757e);
      put('box', 0, 3.45, -5.24, w * 0.75, 0.12, 0.14, C.mint, 0, 0, 0, 1.5);
      put('bevel', 0, 2.7, 0.9, 2.4, 1.2, 6.8, C.cream);
      // The missile rises toward launch as the clock runs down.
      const tilt = G.phase >= 2 && G.phase < 3 ? -0.25 - Math.max(0, 1 - G.timeLeft / (G.timerMax || 180)) * 0.8 : -0.08;
      const par = nest(0, 3.0, 2.3, tilt, 0, 0);
      put('cyl', 0, 0.2, -0.5, 1.5, 7.4, 1.5, C.orange, 0, Math.PI / 2);
      put('cone', 0, 0.2, -4.75, 1.52, 1.3, 1.52, C.cream, 0, Math.PI / 2);
      for (const z of [-2.5, -0.9, 0.7, 2.3])
        put('cyl', 0, 0.2, z, 1.65, 0.3, 1.65, z === 0.7 ? C.mint : C.navy, 0, Math.PI / 2, 0, z === 0.7 ? 2 : 0);
      put('box', 0, 0.2, 2.3, 2.9, 0.15, 1.5, C.navy);
      put('box', 0, 0.2, 2.3, 0.15, 2.9, 1.5, C.navy);
      R.parent = par;
      if (isShielded(e)) put('ico', 0, 2.3, 0, 9.2, 9.5, 14, 0x66d6dc, 0, 0, 0, 0.8, 0.1, 2);
    }
  } else if (e.type === 'boat') {
    put('bevel', 0, 0.6, 0, 3.6, 1.4, 7.3, C.navy);
    put('bevel', 0, 1.1, 0, 3.2, 0.6, 6.8, color);
    put('bevel', 0, 1.95, 1.1, 2.3, 1.3, 2.7, C.cream);
    put('box', 0, 2.1, -0.3, 1.9, 0.6, 0.1, C.glass);
    put('box', 0, 3, 1, 0.12, 2.0, 0.12, C.metal);
    put('bevel', 0, 1.8, -1.8, 1.4, 0.8, 1.4, C.navy);
    put('cyl', 0, 2, -3.0, 0.25, 2, 0.25, C.metal, 0, Math.PI / 2);
  } else if (e.type === 'drone') {
    put('bevel', 0, 0, 0, 2.3, 1.0, 2.3, color);
    put('box', 0, 0.2, -1.2, 1.4, 0.25, 0.1, C.mint, 0, 0, 0, 2);
    for (const x of [-1.8, 1.8])
      for (const z of [-1.8, 1.8]) {
        put('box', x * 0.65, 0, z * 0.65, 1.8, 0.14, 0.3, C.navy, x * z > 0 ? -0.8 : 0.8);
        put('cyl', x, 0.1, z, 0.6, 0.3, 0.6, C.navy);
        put('box', x, 0.33, z, 2, 0.06, 0.16, C.cream, t * 28);
      }
  }
  R.parent = null;
  if (e.charge > 0) {
    put('ring', e.x, e.y + 0.04, e.z, e.radius + 1.2, 1, e.radius + 1.2, C.red, 0, 0, 0, 1, 0.35 + 0.3 * Math.sin(t * 15), 2);
  }
}
function personDraw(p, t) {
  if (p.state === 'saved' || p.state === 'aboard') return;
  // Engineers wear orange overalls; Operation 02's pilots wear grey flight suits and white helmets.
  const pilot = p.kind === 'pilot';
  const y = 2.55 + p.lift;
  const bounce = Math.floor(t * 8) / 8;
  root(p.x, y, p.z, 0.2, 0, 0, 0.92);
  put('bevel', 0, 0.65, 0, 0.88, 1.08, 0.58, pilot ? 0x6f8a86 : C.orange);
  put('box', 0, 0.65, -0.32, 0.61, 0.52, 0.06, pilot ? C.navy : C.cream);
  put('box', 0, 0.62, -0.37, 0.12, 0.64, 0.08, pilot ? C.orange : C.navy);
  put('bevel', 0, 1.65, 0, 0.71, 0.72, 0.71, 0xe3c290);
  put('bevel', 0, 2.04, 0, 0.91, 0.28, 0.85, pilot ? C.white : C.cream);
  put('box', 0, 2.12, 0, 0.33, 0.12, 0.9, pilot ? C.mint : C.orange);
  put('box', 0, 1.67, -0.38, 0.51, 0.19, 0.06, C.navy);
  for (const s of [-1, 1]) {
    put('bevel', s * 0.28, -0.17, -0.03, 0.37, 0.31, 0.65, C.navy, 0, 0, s * 0.05);
    put('bevel', s * 0.75, 0.78 + (s < 0 ? Math.sin(bounce * 4) * 0.28 : 0.48), 0, 0.29, 0.31, 0.3, 0xe3c290);
  }
  R.parent = null;
}
function pickupDraw(c, t) {
  if (c.used) return;
  const colors = { fuel: C.orange, ammo: C.mint, repair: C.cream },
    co = colors[c.type];
  root(c.x, 1.7, c.z);
  put('bevel', 0, 1, 0, 2.65, 2, 2.65, C.navy);
  put('box', 0, 1, 0, 2.75, 0.55, 2.75, co);
  put('bevel', 0, 2.08, 0, 2.85, 0.26, 2.85, co);
  for (let x of [-0.67, 0.67]) for (let z of [-0.67, 0.67]) stud(x, 2.29, z, co, 0.47);
  if (c.type === 'repair') {
    put('box', 0, 1, -1.4, 0.3, 1.15, 0.07, C.mint, 0, 0, 0, 0.5);
    put('box', 0, 1, -1.41, 1.1, 0.3, 0.07, C.mint, 0, 0, 0, 0.5);
  }
  R.parent = null;
  put('ring', c.x, 1.72, c.z, 3.1, 1, 3.1, co, 0, 0, 0, 0.3, 0.5, 2);
  put('ico', c.x, 5 + Math.sin(t * 2 + c.id) * 0.35, c.z, 0.7, 0.7, 0.7, co, t, 0, 0, 1);
}
function worldDynamic(t) {
  R.parent = null;
  for (const e of G.enemies) enemyDraw(e, t);
  for (const p of G.people) personDraw(p, t);
  for (const c of G.pickups) pickupDraw(c, t);
  for (const b of G.props) {
    root(b.x, 1.65, b.z, 0.2);
    if (b.alive) {
      put('bevel', 0, 1, 0, 2, 2, 2, C.orange);
      put('box', 0, 1.7, 0, 2.08, 0.3, 2.08, C.navy);
      put('box', 0, 0.4, 0, 2.08, 0.3, 2.08, C.navy);
      stud(0, 2.12, 0, C.cream, 0.7);
    } else {
      put('bevel', 0, 0.25, 0, 2, 0.5, 2, 0x4f5548);
      put('box', 0.5, 0.6, 0, 0.5, 0.6, 1.8, 0x6c6951, 0.4, 0, 0.3);
    }
    R.parent = null;
  }
  for (const w of G.wrecks) wreckDraw(w);
  // Operation 02: glowing links from each standing pylon to BASTION's shield.
  if (G.op === 1) {
    const b = nearestEnemy('bastion');
    if (b && isShielded(b))
      for (const e of G.enemies) if (e.type === 'pylon' && e.alive) beam(e.x, e.y + 6.3, e.z, b.x, b.y + 5.5, b.z, 0.16, C.mint, 1.3);
  }
  // Friendly lights, rescue beacons, and rotor downwash.
  const open = rescueOpen();
  for (let s of [-1, 1]) put('cyl', HOME.x + s * 8.7, 3.86, HOME.z + 7, 0.55, 0.24, 0.55, C.mint, 0, 0, 0, 2.2);
  if (G.state === 'play' && dist(player, HOME) < 18)
    put('ring', HOME.x, 3.6, HOME.z, 8.0 + Math.sin(t * 2) * 0.2, 1, 8.0 + Math.sin(t * 2) * 0.2, C.mint, 0, 0, 0, 0.9, 0.7, 2);
  const sites = op().sites;
  for (let i = 0; i < sites.length; i++) {
    let waiting = false;
    for (const p of G.people)
      if (p.state === 'ground' && (p.site || 0) === i) {
        waiting = true;
        break;
      }
    if (!waiting) continue;
    const s = sites[i],
      co = open ? C.mint : C.red;
    put('ring', s.x, 2.55, s.z, 5.0, 1, 5.0, co, 0, 0, 0, 1, 0.7, 2);
    put('ring', s.x, 2.57, s.z, 6.1, 1, 6.1, co, 0, 0, 0, 0.5, 0.25, 2);
    put('ico', s.bx, 7.2 + Math.sin(t * 2 + i) * 0.3, s.bz, 0.9, 1.1, 0.9, co, t * 0.5, 0, 0, 2);
  }
  const wc = G.context;
  if (G.winchProgress > 0 && wc && wc.ref && (wc.kind === 'person' || wc.kind === 'supply') && !G.heliLost) {
    const c = G.context.ref;
    beam(player.x, player.y - 1.8, player.z, c.x, (c.y || 2.5) + (c.lift || 0), c.z, 0.07, C.cream, 0.2);
    put('ring', c.x, 2.59, c.z, 1.7, 1, 1.7, C.mint, 0, 0, 0, 1, 0.8, 2);
  }
  let gy = groundAt(player.x, player.z) + 0.045;
  const overWater = gy < 0.2;
  for (let k = 0; k < (G.heliLost ? 0 : 3); k++) {
    const f = (t * 1.1 + k / 3) % 1,
      r = 2 + f * 5;
    put('ring', player.x, gy, player.z, r, 1, r, overWater ? 0xb7e7cf : 0xdbce9c, 0, 0, 0, 0, (1 - f) * 0.11, 2);
  }
  // Ocean ripples below the patrol boat.
  const boat = G.enemies.find((e) => e.type === 'boat');
  if (boat && boat.alive) {
    for (let k = 0; k < 3; k++) {
      let r = 3 + ((t * 0.7 + k / 3) % 1) * 3;
      put('ring', boat.x, 0.015, boat.z, r, 1, r * 1.5, 0xa6dcc6, 0, 0, 0, 0, 0.09, 2);
    }
  }
  for (const s of G.shots) {
    let color = s.team === 0 ? (s.kind === 0 ? 0xffe6a4 : C.orange) : C.red;
    const dx = s.vx,
      dy = s.vy,
      dz = s.vz,
      yaw = Math.atan2(dx, dz),
      pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    if (s.kind === 0) {
      put('box', s.x, s.y, s.z, 0.11, 0.11, 1.9, color, yaw, pitch, 0, 3);
    } else {
      put('bevel', s.x, s.y, s.z, 0.4, 0.4, 1.2, s.team ? C.red : C.cream, yaw, pitch);
      put('ico', s.x - dx * 0.014, s.y - dy * 0.014, s.z - dz * 0.014, 0.5, 0.5, 0.6, 0xffbd66, 0, 0, 0, 4);
    }
  }
  for (const p of G.particles) {
    let f = p.life / p.max,
      scale = p.size * Math.min(1, f * 3);
    if (p.type === 'smoke') scale = p.size * (1 + (1 - f) * 2) * Math.min(1, f * 3);
    put(
      p.type === 'smoke' ? 'ico' : p.type === 'spark' ? 'box' : 'bevel',
      p.x,
      p.y,
      p.z,
      scale,
      p.type === 'spark' ? scale * 0.7 : scale,
      scale,
      p.color,
      p.rot || 0,
      (p.rot || 0) * 0.7,
      0,
      p.type === 'spark' ? 2 : 0,
    );
  }
  for (const e of G.effects) {
    let f = 1 - e.life / e.max;
    if (e.type === 'blast') {
      put(
        'ico',
        e.x,
        e.y,
        e.z,
        e.size * (0.4 + f * 1.8),
        e.size * (0.4 + f * 1.8),
        e.size * (0.4 + f * 1.8),
        f < 0.4 ? 0xffdeb1 : 0xef9b4c,
        0,
        0,
        0,
        2.5 * (1 - f),
        Math.max(0.01, 1 - f),
        2,
      );
      put(
        'ring',
        e.x,
        Math.max(0.15, groundAt(e.x, e.z) + 0.07),
        e.z,
        e.size * (1 + f * 3),
        1,
        e.size * (1 + f * 3),
        C.orange,
        0,
        0,
        0,
        1,
        (1 - f) * 0.5,
        2,
      );
    } else if (e.type === 'flare') {
      put('ring', player.x, player.y, player.z, 4 + f * 15, 1, 4 + f * 15, C.mint, 0, 0, 0, 2, (1 - f) * 0.42, 2);
    }
  }
  heliDraw(t);
}

/** A friendly helicopter down in the hills (Operation 02 crash sites). */
function wreckDraw(w) {
  root(w.x, 1.65, w.z, w.yaw, 0, 0.35);
  put('bevel', 0, 1.2, 0, 3.2, 1.9, 5.2, C.orange);
  put('bevel', 0, 0.5, 0, 2.9, 0.8, 4.8, C.navy);
  put('wedge', 0, 1.3, -2.3, 2.9, 1.4, 2.4, C.glass);
  put('bevel', 0, 1.1, 4.2, 0.9, 0.8, 4.2, C.orange);
  put('box', 0, 2.2, 6.1, 0.2, 2.2, 1.4, C.orange, 0, -0.2);
  put('cyl', 0, 2.3, 0.2, 0.36, 0.9, 0.36, C.metal);
  put('box', 1.8, 2.6, -0.5, 7.5, 0.1, 0.4, C.navy, 0.5, 0, 0.15);
  put('box', -1.5, 0.3, 2.5, 6, 0.1, 0.4, C.navy, -0.7);
  stud(0.8, 2.2, 1.2, C.cream, 0.5);
  R.parent = null;
  put('ring', w.x, 1.72, w.z, 6, 1, 6, 0x4f5548, 0, 0, 0, 0, 0.3, 2);
}

/* ------------------------------------------------------------------ radio, toasts, particles, explosions */

function radio(text, name = 'PATCH / FIELD CONTROL', seconds = 6) {
  hud.radioText.textContent = text;
  hud.radioName.textContent = name;
  G.radioTime = seconds;
  hud.radio.classList.add('show');
  AudioSys.sfx('beep');
}
function toast(text, seconds = 3) {
  hud.eventToast.textContent = text;
  G.toastTime = seconds;
  hud.eventToast.classList.add('show');
}
const particlePool = [];
function particle(x, y, z, type = 'debris', color = C.orange, size = 0.4, v = 1) {
  if (G.particles.length >= maxParticles) return;
  const life = type === 'smoke' ? rand(1.2, 2.5) : rand(0.6, 1.9);
  const p = particlePool.pop() || {};
  p.x = x;
  p.y = y;
  p.z = z;
  p.type = type;
  p.color = color;
  p.size = size;
  p.vx = rand(-7, 7) * v;
  p.vy = rand(3, 11) * v;
  p.vz = rand(-7, 7) * v;
  p.life = life;
  p.max = life;
  p.rot = rand(0, TAU);
  G.particles.push(p);
}
function explosion(x, y, z, size = 3, quiet = false) {
  G.effects.push({ type: 'blast', x, y, z, size, life: 0.4, max: 0.4 });
  const count = Math.ceil(size * 4);
  for (let i = 0; i < count; i++)
    particle(
      x,
      y,
      z,
      i % 3 === 0 ? 'spark' : 'debris',
      i % 3 === 0 ? 0xffd28a : i % 2 ? C.orange : C.navy,
      rand(0.2, 0.65) * Math.sqrt(size / 2),
      size * 0.4,
    );
  for (let i = 0; i < Math.ceil(size); i++)
    particle(x + rand(-1, 1), y + rand(0, 2), z + rand(-1, 1), 'smoke', i % 2 ? 0x7b7c6b : 0x5b655c, (rand(1.5, 3) * size) / 3, 0.22);
  const d = Math.hypot(player.x - x, player.z - z);
  const kick = Math.max(0, 1 - d / 70) * size * 0.42;
  G.shake = Math.max(G.shake, kick);
  if (kick > 0.35 && G.state === 'play') input.rumble(Math.min(1, kick * 0.45), 80 + size * 25);
  if (!quiet) AudioSys.sfx(size > 2 ? 'boom' : 'smallboom', x, z);
}

/* ------------------------------------------------------------------ damage */

const KILL_SCORE = { boss: 1400, bastion: 1600, radar: 450, pylon: 300, truck: 250 };
/** MONARCH is shielded until the engineers are home; BASTION until the pilots are home and all pylons are down. */
function isShielded(e) {
  if (e.type === 'boss') return G.phase < 2;
  if (e.type === 'bastion') return G.phase < 2 || G.pylons < 3;
  return false;
}
function damageEnemy(e, amount) {
  if (!e.alive) return;
  if (isShielded(e)) {
    if (G.toastTime <= 0)
      toast(
        e.type === 'boss'
          ? 'SHIELD ACTIVE · RESCUE THE ENGINEERS'
          : G.phase < 2
            ? 'SHIELD ACTIVE · BRING THE PILOTS HOME'
            : 'SHIELD ACTIVE · DESTROY THE PYLONS',
      );
    e.flash = 0.08;
    return;
  }
  e.hp -= amount;
  e.flash = 0.1;
  G.hits++;
  if (e.hp > 0) {
    if (Math.random() < 0.4) particle(e.x, e.y + e.height, e.z, 'spark', 0xffd39a, 0.24, 0.5);
    return;
  }
  e.hp = 0;
  e.alive = false;
  G.kills++;
  G.score += KILL_SCORE[e.type] ?? 150;
  const big = e.type === 'boss' || e.type === 'bastion';
  explosion(e.x, e.y + 2, e.z, big ? 6 : e.type === 'radar' || e.type === 'pylon' ? 4 : 3);
  if (big) {
    G.phase = 3;
    if (e.type === 'boss') {
      radio('Launcher down. That was the expensive one. Return to the carrier.', 'PATCH / FIELD CONTROL', 7);
      toast('MONARCH DESTROYED · RETURN TO BASE', 5);
    } else {
      radio('BASTION is scrap. The carrier can breathe again. Come home, Kestrel.', 'PATCH / FIELD CONTROL', 7);
      toast('BASTION DESTROYED · RETURN TO BASE', 5);
    }
    input.rumble(0.9, 380);
    saveGame();
  } else if (e.type === 'radar') {
    G.radars = G.enemies.filter((x) => x.type === 'radar' && !x.alive).length;
    if (G.radars === 1) {
      radio('One radar down. The other uplink is across the river. Use the map to plan your route.');
      toast('UPLINK DESTROYED · 1 / 2');
    } else {
      G.phase = 1;
      radio('The radar net is down. Three engineers are at the old temple. Hover above each one and hold the winch.', 'PATCH / FIELD CONTROL', 9);
      toast('RADAR NET OFFLINE · RESCUE CREW', 5);
      saveGame();
    }
  } else if (e.type === 'truck') {
    G.convoyKilled++;
    toast(`TRUCK DESTROYED · ${G.convoyKilled} / 4`, 2);
    checkConvoy();
  } else if (e.type === 'pylon') {
    G.pylons = G.enemies.filter((x) => x.type === 'pylon' && !x.alive).length;
    if (G.pylons < 3) {
      toast(`PYLON DOWN · ${G.pylons} / 3`, 3);
      if (G.phase === 2 && G.pylons === 1) radio('One pylon down. The shield is flickering. Two to go.');
    } else {
      toast(G.phase >= 2 ? 'SHIELD DOWN · BASTION EXPOSED' : 'ALL PYLONS DOWN', 4);
      radio(
        G.phase >= 2
          ? "That was the last pylon. BASTION's shield is down. Heavy weapons, now."
          : 'All three pylons down early. BASTION stays buttoned up until the pilots are home.',
        'PATCH / FIELD CONTROL',
        7,
      );
      saveGame();
    }
  }
}
function damagePlayer(amount) {
  if (G.state !== 'play' || G.invuln > 0) return;
  amount *= diff().damage;
  player.hp = Math.max(0, player.hp - amount);
  G.damageTaken += amount;
  G.damage = 1;
  G.shake = Math.max(G.shake, 0.65);
  G.invuln = 0.13;
  AudioSys.sfx('hit');
  input.rumble(0.55, 140);
  if (player.hp <= 30 && !G.lowArmor) {
    G.lowArmor = true;
    radio('Armor is low. Return to the carrier, or winch a repair crate.', 'KESTREL / FLIGHT SYSTEM', 5);
  }
  if (player.hp <= 0) failMission('Your helicopter was lost. Use cover, move between attacks, and release flares when shots get close.', 'lost');
}
function enemyCenter(e) {
  return { x: e.x, y: e.y + e.height, z: e.z };
}

/* ------------------------------------------------------------------ aiming and weapons */

/** Holding a mouse button on the world aims at the pointer (either button). */
function mouseAiming() {
  return input.pointer.down && input.pointer.type === 'mouse';
}
function chooseTarget() {
  let best = null,
    score = Infinity;
  const W = kit.size.width,
    H = kit.size.height,
    aim = mouseAiming();
  for (const e of G.enemies) {
    if (!e.alive || isShielded(e)) continue;
    const d = dist(player, e);
    if (d > 43) continue;
    const pt = R.project(e.x, e.y + e.height, e.z);
    if (pt.x < 7 || pt.x > W - 7 || pt.y < 5 || pt.y > H - 12) continue;
    let s = d;
    if (aim) {
      const md = Math.hypot(pt.x - input.pointer.x, pt.y - input.pointer.y);
      if (md > 100) continue;
      s = d * 0.2 + md * 0.18;
    }
    if (s < score) {
      score = s;
      best = e;
    }
  }
  return best;
}
function aimPoint() {
  if (G.target && G.target.alive) return enemyCenter(G.target);
  if (mouseAiming()) {
    const p = R.ground(input.pointer.x, input.pointer.y, 1.6);
    const dx = p.x - player.x,
      dz = p.z - player.z,
      d = Math.hypot(dx, dz);
    if (d > 55) {
      p.x = player.x + (dx / d) * 55;
      p.z = player.z + (dz / d) * 55;
    }
    return { x: p.x, y: 1.7, z: p.z };
  }
  return { x: player.x - Math.sin(player.yaw) * 45, y: 1.4, z: player.z - Math.cos(player.yaw) * 45 };
}
function fireWeapon(kind) {
  if (G.state !== 'play' || player.cool[kind] > 0) return;
  if (player.ammo[kind] < 1) {
    player.cool[kind] = 0.28;
    AudioSys.sfx('empty');
    if (G.toastTime <= 0) toast('EMPTY · WINCH AMMO OR RETURN TO BASE');
    return;
  }
  player.ammo[kind] -= 1;
  player.cool[kind] = [0.105, 0.55, 1.1][kind];
  G.shotsFired++;
  const point = aimPoint(),
    x = player.x - Math.sin(player.yaw) * 3.3,
    y = player.y - 0.7,
    z = player.z - Math.cos(player.yaw) * 3.3,
    dx = point.x - x,
    dy = point.y - y,
    dz = point.z - z,
    d = Math.hypot(dx, dy, dz) || 1,
    sp = [99, 47, 39][kind];
  G.shots.push({
    team: 0,
    kind,
    x,
    y,
    z,
    vx: (dx / d) * sp,
    vy: (dy / d) * sp,
    vz: (dz / d) * sp,
    speed: sp,
    ttl: kind ? 2.9 : 0.73,
    damage: [8, 76, 155][kind],
    blast: [0, 5.1, 6.3][kind],
    homing: kind === 2 && G.target ? G.target.id : null,
    trail: 0,
  });
  AudioSys.sfx(kind ? 'rocket' : 'gun');
  if (kind) {
    G.shake = Math.max(G.shake, 0.22);
    input.rumble(0.3, 70);
  }
}
function enemyFire(e) {
  const type = e.type,
    boss = type === 'boss',
    sam = type === 'sam',
    drone = type === 'drone',
    flak = type === 'flak',
    bastion = type === 'bastion';
  const n = boss || flak ? 3 : bastion ? 4 : 1,
    spread = flak ? 1.6 : 3,
    lead = sam ? 0.2 : 0.35,
    sp = sam ? 23 : boss ? 25 : bastion ? 22 : drone ? 26 : flak ? 34 : 30;
  const x = e.x,
    y = e.y + e.height,
    z = e.z;
  for (let i = 0; i < n; i++) {
    const off = i - (n - 1) / 2,
      dx = player.x + player.vx * lead + rand(-1.2, 1.2) + off * spread - x,
      dy = player.y - y,
      dz = player.z + player.vz * lead + rand(-1.2, 1.2) + ((off * spread) / 3) * 2 - z,
      d = Math.hypot(dx, dy, dz) || 1;
    G.shots.push({
      team: 1,
      kind: sam || boss || bastion ? 1 : 0,
      x,
      y,
      z,
      vx: (dx / d) * sp,
      vy: (dy / d) * sp,
      vz: (dz / d) * sp,
      speed: sp,
      ttl: 3.2,
      damage: sam ? 14 : boss ? 10 : bastion ? 11 : flak ? 5 : 7,
      blast: 0,
      homing: null,
      trail: 0,
    });
  }
  if (dist(e, player) < 40) AudioSys.burst(0.07, 900, 0.07, (e.x - player.x - (e.z - player.z)) / 50);
}
function shotHit(s, x, y, z) {
  if (s.team === 0 && s.blast) {
    for (const e of G.enemies)
      if (e.alive) {
        const d = Math.hypot(e.x - x, (e.y + e.height - y) * 0.55, e.z - z);
        if (d < s.blast + e.radius * 0.45) {
          damageEnemy(e, s.damage * Math.max(0.35, 1 - d / (s.blast * 1.7)));
          if (e.type === 'truck') e.stun = 0.8; // a rocket blast slows a truck down for a moment
        }
      }
    for (const b of G.props)
      if (b.alive && Math.hypot(b.x - x, b.z - z) < s.blast + 1) {
        b.alive = false;
        G.score += 30;
        explosion(b.x, 2.5, b.z, 2.2, true);
      }
    explosion(x, y, z, s.kind === 2 ? 3.0 : 2.1);
  } else if (s.team === 0) {
    for (let i = 0; i < 3; i++) particle(x, y, z, 'spark', 0xffd696, 0.16, 0.35);
  }
}
function distanceSegment(px, py, pz, ax, ay, az, bx, by, bz) {
  const dx = bx - ax,
    dy = by - ay,
    dz = bz - az,
    len = dx * dx + dy * dy + dz * dz,
    t = clamp(((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / (len || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t, pz - az - dz * t);
}
function updateShots(dt) {
  const shots = G.shots;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.ttl -= dt;
    if (s.homing !== null && s.homing !== undefined && s.team === 0) {
      let tgt = null;
      for (const e of G.enemies)
        if (e.id === s.homing && e.alive) {
          tgt = e;
          break;
        }
      if (tgt) {
        const dx = tgt.x - s.x,
          dy = tgt.y + tgt.height - s.y,
          dz = tgt.z - s.z,
          d = Math.hypot(dx, dy, dz) || 1,
          k = Math.min(1, dt * 7);
        s.vx = lerp(s.vx, (dx / d) * s.speed, k);
        s.vy = lerp(s.vy, (dy / d) * s.speed, k);
        s.vz = lerp(s.vz, (dz / d) * s.speed, k);
        const v = Math.hypot(s.vx, s.vy, s.vz) || 1;
        s.vx *= s.speed / v;
        s.vy *= s.speed / v;
        s.vz *= s.speed / v;
      }
    }
    const ox = s.x,
      oy = s.y,
      oz = s.z;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    let hit = false;
    if (s.team === 0) {
      for (const e of G.enemies) {
        if (!e.alive) continue;
        if (distanceSegment(e.x, e.y + e.height, e.z, ox, oy, oz, s.x, s.y, s.z) < e.radius) {
          if (!s.blast) damageEnemy(e, s.damage);
          shotHit(s, s.x, s.y, s.z);
          hit = true;
          break;
        }
      }
      if (!hit)
        for (const b of G.props) {
          if (!b.alive) continue;
          if (distanceSegment(b.x, 2.8, b.z, ox, oy, oz, s.x, s.y, s.z) < 1.55) {
            b.hp -= s.damage;
            if (b.hp <= 0) {
              b.alive = false;
              G.score += 30;
              explosion(b.x, 2.7, b.z, 2.0);
            }
            shotHit(s, s.x, s.y, s.z);
            hit = true;
            break;
          }
        }
    } else if (!G.heliLost && distanceSegment(player.x, player.y, player.z, ox, oy, oz, s.x, s.y, s.z) < 2.0) {
      damagePlayer(s.damage);
      for (let k = 0; k < 4; k++) particle(s.x, s.y, s.z, 'spark', C.orange, 0.2, 0.5);
      hit = true;
    }
    if (!hit && s.y <= groundAt(s.x, s.z) + 0.13) {
      if (s.team === 0 && s.kind) shotHit(s, s.x, s.y, s.z);
      else particle(s.x, Math.max(0.3, s.y), s.z, 'spark', s.y < 0.5 ? C.mint : C.sand, 0.25, 0.3);
      hit = true;
    }
    if (s.kind && !hit) {
      s.trail += dt;
      if (s.trail > 0.055) {
        s.trail = 0;
        particle(s.x, s.y, s.z, 'smoke', s.team ? 0x958777 : 0xc5c0a0, 0.42, 0.035);
      }
    }
    if (hit || s.ttl <= 0) {
      shots[i] = shots[shots.length - 1];
      shots.pop();
    }
  }
}
function deployFlares() {
  if (G.state !== 'play' || G.flareTime > 0) return;
  G.flareTime = 8;
  G.effects.push({ type: 'flare', life: 0.65, max: 0.65 });
  G.shots = G.shots.filter((s) => s.team === 0 || Math.hypot(s.x - player.x, s.z - player.z) > 28);
  for (let i = 0; i < 16; i++) particle(player.x, player.y, player.z, 'spark', i % 2 ? C.mint : 0xffe1a0, 0.32, 1.4);
  AudioSys.sfx('flare');
  input.rumble(0.2, 60);
  toast('FLARES RELEASED', 1.5);
}

/* ------------------------------------------------------------------ enemies */

function truckEscaped(e) {
  e.alive = false;
  e.escaped = true;
  e.hp = 0;
  G.convoyEscaped++;
  AudioSys.sfx('empty');
  input.rumble(0.4, 160);
  if (G.convoyEscaped < CONVOY_ESCAPE_LIMIT) {
    toast(`TRUCK ESCAPED · ${G.convoyEscaped} / ${CONVOY_ESCAPE_LIMIT}`, 3);
    radio('A truck made the ridge road. One more and the carrier has to run.', 'PATCH / FIELD CONTROL', 6);
  }
  checkConvoy();
}
/** Operation 02, task 1: resolved once every truck is destroyed or gone. */
function checkConvoy() {
  if (G.op !== 1 || G.phase !== 0 || G.state !== 'play') return;
  if (G.convoyEscaped >= CONVOY_ESCAPE_LIMIT) {
    failMission(
      'Two trucks reached the ridge road with the mobile battery, and the carrier had to pull back. Catch the convoy early, before it crosses the bridge.',
      'convoy',
    );
    return;
  }
  if (G.enemies.some((x) => x.type === 'truck' && x.alive)) return;
  G.phase = 1;
  radio(
    (G.convoyEscaped ? 'One truck slipped through, but the battery is broken up. ' : 'Convoy stopped. ') +
      'Bad news: two of our helicopters went down in the hills. Four pilots are waiting at the crash sites. The cabin holds three, so plan two trips.',
    'PATCH / FIELD CONTROL',
    11,
  );
  toast('CONVOY STOPPED · RESCUE THE PILOTS', 5);
  saveGame();
}
function updateEnemies(dt) {
  const W = kit.size.width,
    H = kit.size.height,
    df = diff();
  for (const e of G.enemies) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt);
    e.stun = Math.max(0, e.stun - dt);
    const oldX = e.x,
      oldZ = e.z;
    if (e.type === 'tank') {
      const a = G.elapsed * 0.13 + e.id;
      const nx = e.ox + Math.sin(a) * 5.0,
        nz = e.oz + Math.cos(a) * 3.3;
      if (tileLand(nx, nz)) {
        e.x = nx;
        e.z = nz;
      }
      if (Math.hypot(e.x - oldX, e.z - oldZ) > 0.003) e.yaw = lerpAngle(e.yaw, Math.atan2(-(e.x - oldX), -(e.z - oldZ)), dt * 3);
    } else if (e.type === 'boat') {
      e.z = e.oz + Math.sin(G.elapsed * 0.1) * 9;
      e.x = 9 + 9 * Math.sin(e.z * 0.04);
      e.yaw = (G.elapsed * 0.1) % TAU > Math.PI / 2 && (G.elapsed * 0.1) % TAU < Math.PI * 1.5 ? 0 : Math.PI;
      e.y = 0.1;
    } else if (e.type === 'boss' && G.phase === 2) {
      e.z = e.oz + Math.sin(G.elapsed * 0.08) * 7;
      e.yaw = 0;
    } else if (e.type === 'drone') {
      e.x = e.ox + Math.sin(G.elapsed * 0.7 + e.id) * 9;
      e.z = e.oz + Math.cos(G.elapsed * 0.7 + e.id) * 7;
      e.y = 8.0 + Math.sin(G.elapsed * 2 + e.id) * 0.3;
      e.yaw = -G.elapsed * 0.7;
    } else if (e.type === 'truck') {
      e.d += df.convoy * (e.stun > 0 ? 0.35 : 1) * dt;
      placeOnRoute(e);
      e.yaw = lerpAngle(e.yaw, e.routeYaw, dt * 4);
      if (e.d >= ROUTE_TOTAL) {
        truckEscaped(e);
        if (G.state !== 'play') return;
        continue;
      }
    }
    if (e.type === 'radar' || e.type === 'pylon' || e.type === 'truck' || ((e.type === 'boss' || e.type === 'bastion') && G.phase !== 2)) continue;
    const d = dist(e, player),
      range = e.type === 'sam' || e.type === 'boss' ? 43 : e.type === 'bastion' ? 46 : e.type === 'flak' ? 36 : 34,
      point = R.project(e.x, e.y + e.height, e.z),
      visible = point.x > 8 && point.x < W - 8 && point.y > 5 && point.y < H - 16;
    e.turret = lerpAngle(e.turret, Math.atan2(e.x - player.x, e.z - player.z), dt * 4);
    if (d < range && d > 3 && visible && e.stun <= 0) {
      e.cd -= dt;
      if (e.cd <= 0) {
        e.charge += dt;
        if (e.charge > 0.7) {
          enemyFire(e);
          e.charge = 0;
          e.cd =
            (e.type === 'boss' ? 1.45 : e.type === 'bastion' ? 1.9 : e.type === 'sam' ? 2.5 : e.type === 'flak' ? 1.6 : 2.0 + (e.id % 3) * 0.25) *
            df.fire;
        }
      }
    } else {
      e.charge = 0;
      e.cd = Math.max(0.35, e.cd);
    }
  }
}
function lerpAngle(a, b, k) {
  return a + wrapAngle(b - a) * Math.min(1, k);
}

/* ------------------------------------------------------------------ winch, carrier service, rescue */

function rescueOpen() {
  return G.op === 0 ? G.radars >= 2 : G.phase >= 1;
}
function findContext() {
  if (dist(player, HOME) < 9.0) return { kind: 'base', id: 'base', ref: HOME };
  const open = rescueOpen();
  if (open) {
    let near = null,
      d = 5.8;
    for (const p of G.people)
      if (p.state === 'ground') {
        const pd = dist(p, player);
        if (pd < d) {
          d = pd;
          near = p;
        }
      }
    if (near) return player.cargo < 3 ? { kind: 'person', id: 'p' + near.id, ref: near } : { kind: 'full', id: 'full', ref: null };
  }
  let near = null,
    d = 5.2;
  for (const c of G.pickups)
    if (!c.used) {
      const cd = dist(c, player);
      if (cd < d) {
        d = cd;
        near = c;
      }
    }
  if (near) return { kind: 'supply', id: 's' + near.id, ref: near };
  if (!open) {
    const lock = op().lockCenter;
    if (lock && dist(player, lock) < 12) return { kind: 'blocked', id: 'blocked', ref: null };
    if (!lock) for (const s of op().sites) if (dist(player, s) < 12) return { kind: 'blocked', id: 'blocked', ref: null };
  }
  return null;
}
const RELOAD = [145, 5, 2];
function updateContext(dt) {
  G.context = findContext();
  const c = G.context,
    held = !G.holdLock && input.down('winch');
  const speed = Math.hypot(player.vx, player.vz);
  if (!c || c.id !== G.winchId) {
    G.winchProgress = 0;
    for (const p of G.people) if (p.state === 'ground') p.lift = 0;
    G.winchId = c ? c.id : null;
  }
  if (c && c.kind === 'base' && speed < 5.5) {
    G.homeProgress += dt;
    if (G.homeProgress > 0.7) {
      const needs = player.hp < 99 || player.fuel < 99 || player.ammo.some((n, i) => n < MAX_AMMO[i] - 1);
      if (needs && !G.serviceVisit) {
        G.serviceVisit = true;
        G.services++;
        AudioSys.sfx('beep');
        toast('CARRIER SERVICE · REPAIR / FUEL / AMMO', 3);
      }
      player.hp = Math.min(100, player.hp + dt * 24);
      player.fuel = Math.min(100, player.fuel + dt * 24);
      for (let i = 0; i < 3; i++) player.ammo[i] = Math.min(MAX_AMMO[i], player.ammo[i] + dt * RELOAD[i]);
      G.winchProgress = Math.min(1, Math.min(player.hp, player.fuel) / 100);
      if (player.hp > 60) G.lowArmor = false;
      if (player.fuel > 40) G.lowFuel = false;
      if (player.cargo > 0) deliverCrew();
      if (G.phase === 3 && G.homeProgress > 1.8) {
        completeMission();
        return;
      }
    }
  } else {
    G.homeProgress = 0;
    G.serviceVisit = false;
  }
  if (c && (c.kind === 'person' || c.kind === 'supply') && held && speed < 6) {
    const duration = c.kind === 'person' ? 1.85 : 1.35;
    G.winchProgress = Math.min(1, G.winchProgress + dt / duration);
    if (c.kind === 'person') c.ref.lift = G.winchProgress * (player.y - 4.8);
    if (G.winchProgress >= 1) {
      if (c.kind === 'person') {
        c.ref.state = 'aboard';
        c.ref.lift = 0;
        player.cargo++;
        G.score += 100;
        AudioSys.sfx('rescue');
        input.rumble(0.25, 90);
        toast(`${op().crewWord} ABOARD · ${G.delivered + player.cargo} / ${op().crew}`, 2);
        if (G.people.every((p) => p.state !== 'ground'))
          radio(
            G.op === 0
              ? 'All engineers aboard. Return to the carrier to unload them and get the shield codes.'
              : 'All pilots aboard. Take them home.',
            'PATCH / FIELD CONTROL',
            7,
          );
        else if (player.cargo >= 3)
          radio('Cabin full. Drop these three at the carrier, then come back for the last one.', 'PATCH / FIELD CONTROL', 7);
      } else {
        const s = c.ref;
        s.used = true;
        if (s.type === 'fuel') {
          player.fuel = Math.min(100, player.fuel + 65);
          G.lowFuel = false;
        }
        if (s.type === 'repair') {
          player.hp = Math.min(100, player.hp + 60);
          G.lowArmor = false;
        }
        if (s.type === 'ammo') {
          player.ammo[0] = Math.min(480, player.ammo[0] + 270);
          player.ammo[1] = Math.min(18, player.ammo[1] + 10);
          player.ammo[2] = Math.min(6, player.ammo[2] + 4);
        }
        G.score += 50;
        AudioSys.sfx('rescue');
        input.rumble(0.2, 70);
        toast(s.type.toUpperCase() + ' COLLECTED', 2);
      }
      G.winchProgress = 0;
      G.winchId = null;
      saveGame();
    }
  } else if (c && (c.kind === 'person' || c.kind === 'supply')) {
    G.winchProgress = Math.max(0, G.winchProgress - dt * 2);
    if (c.kind === 'person') c.ref.lift = G.winchProgress * (player.y - 4.8);
  }
}
function deliverCrew() {
  for (const p of G.people) if (p.state === 'aboard') p.state = 'saved';
  G.delivered += player.cargo;
  G.score += player.cargo * 500;
  player.cargo = 0;
  AudioSys.sfx('rescue');
  input.rumble(0.3, 120);
  toast(`${op().crewWord}S DELIVERED · ${G.delivered} / ${op().crew}`, 4);
  saveGame();
  if (G.delivered >= op().crew && G.phase === 1) startFinalPhase();
  else radio('Crew aboard the carrier. Go back for the others.');
}
const MINUTES = { 2: 'two minutes', 2.5: 'two and a half minutes', 3: 'three minutes', 3.5: 'three and a half minutes', 4: 'four minutes' };
function startFinalPhase() {
  G.phase = 2;
  G.timeLeft = G.timerMax = Math.round(op().timer * diff().timer);
  const half = Math.round(G.timeLeft / 30) / 2,
    time = MINUTES[half] || `${half} minutes`;
  if (G.op === 0) {
    G.enemies.push(newEnemy(12, 'drone', 37, -69, 65), newEnemy(13, 'drone', 63, -66, 65));
    radio(`The engineers sent the shield codes. MONARCH is exposed. You have ${time} to stop the launch.`, 'PATCH / FIELD CONTROL', 9);
    toast('LAUNCHER EXPOSED · ' + formatTime(G.timeLeft), 5);
  } else {
    G.enemies.push(newEnemy(40, 'drone', 40, -72, 65), newEnemy(41, 'drone', 58, -74, 65));
    radio(
      G.pylons >= 3
        ? `The pilots saw BASTION loading a salvo for the carrier. Its shield is already down. You have ${time}.`
        : `The pilots saw BASTION loading a salvo for the carrier. Three pylons power its shield: break them, then the gun. You have ${time}.`,
      'PATCH / FIELD CONTROL',
      10,
    );
    toast('BASTION LOADING · ' + formatTime(G.timeLeft), 5);
  }
  saveGame();
}
function updateParticles(dt) {
  const list = G.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list[i] = list[list.length - 1];
      list.pop();
      particlePool.push(p);
      continue;
    }
    if (p.type === 'smoke') {
      p.vy += dt * 0.35;
      p.vx += dt * 0.35;
    } else p.vy -= dt * 17;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.rot += dt * (p.type === 'smoke' ? 0.2 : 2);
    const floor = groundAt(p.x, p.z) + p.size * 0.3;
    if (p.y < floor) {
      p.y = floor;
      p.vy *= -0.22;
      p.vx *= 0.8;
      p.vz *= 0.8;
    }
  }
  for (let i = G.effects.length - 1; i >= 0; i--) {
    G.effects[i].life -= dt;
    if (G.effects[i].life <= 0) G.effects.splice(i, 1);
  }
}

/* ------------------------------------------------------------------ one flight step */

function updateGame(dt) {
  G.elapsed += dt;
  G.saveTime += dt;
  G.invuln = Math.max(0, G.invuln - dt);
  G.flareTime = Math.max(0, G.flareTime - dt);
  G.damage = Math.max(0, G.damage - dt * 2.4);
  G.shake = Math.max(0, G.shake - dt * 2.5);
  for (let i = 0; i < 3; i++) player.cool[i] = Math.max(0, player.cool[i] - dt);
  // Buttons still held when a menu closed stay ignored until they are released.
  if (G.holdLock && !(input.down('fire') || input.down('rocket') || input.down('missile') || input.down('winch'))) G.holdLock = false;
  const live = !G.holdLock;
  const mv = input.vector('move');
  let sx = mv.x,
    sy = -mv.y;
  const cx = findContext();
  if (live && input.down('winch') && cx && cx.kind !== 'blocked' && cx.kind !== 'full') {
    sx = 0;
    sy = 0;
  }
  const speed = 23.5,
    wx = (sx + sy) * SQ * speed,
    wz = (-sx + sy) * SQ * speed,
    acc = 1 - Math.exp(-dt * 5.7);
  player.vx = lerp(player.vx, wx, acc);
  player.vz = lerp(player.vz, wz, acc);
  player.x += player.vx * dt;
  player.z += player.vz * dt;
  const nx = clamp(player.x, -115, 111),
    nz = clamp(player.z, -106, 98);
  if (nx !== player.x || nz !== player.z) {
    player.x = nx;
    player.z = nz;
    if (G.toastTime <= 0) toast('EDGE OF OPERATION · TURN BACK', 2);
  }
  const targetHeight = groundAt(player.x, player.z) + 7.9;
  player.y = lerp(player.y, targetHeight + Math.sin(G.t * 2.5) * 0.13, 1 - Math.exp(-dt * 3.5));
  G.target = chooseTarget();
  const fireHeld = live && input.down('fire'),
    rocketHeld = live && input.down('rocket'),
    missileHeld = live && input.down('missile');
  let desired = player.yaw;
  if (fireHeld || rocketHeld || missileHeld) {
    const aim = aimPoint();
    desired = Math.atan2(player.x - aim.x, player.z - aim.z);
  } else if (Math.hypot(player.vx, player.vz) > 1) desired = Math.atan2(-player.vx, -player.vz);
  player.yaw = lerpAngle(player.yaw, desired, dt * 8);
  const forwardV = -Math.sin(player.yaw) * player.vx - Math.cos(player.yaw) * player.vz,
    sideV = Math.cos(player.yaw) * player.vx - Math.sin(player.yaw) * player.vz;
  player.pitch = lerp(player.pitch, -forwardV * 0.007, dt * 4);
  player.roll = lerp(player.roll, -sideV * 0.008, dt * 4);
  if (fireHeld) fireWeapon(G.selected);
  if (rocketHeld) fireWeapon(1);
  if (missileHeld) fireWeapon(2);
  const service = cx && cx.kind === 'base' && Math.hypot(player.vx, player.vz) < 5.5;
  if (!service) player.fuel = Math.max(0, player.fuel - dt * (0.285 + Math.hypot(player.vx, player.vz) * 0.006) * diff().fuel);
  if (player.fuel < 22 && !G.lowFuel) {
    G.lowFuel = true;
    radio('Fuel is low. Winch an orange fuel crate, or return to the carrier.', 'KESTREL / FLIGHT SYSTEM', 6);
  }
  if (player.fuel <= 0) {
    failMission('The helicopter ran out of fuel. Winch orange fuel crates, or hover over the carrier to refuel.', 'lost');
    return;
  }
  // A soft cockpit chirp while armor or fuel is critical.
  if (player.hp < 25 || player.fuel < 15) {
    warnClock -= dt;
    if (warnClock <= 0) {
      warnClock = 2.2;
      AudioSys.sfx('warn');
    }
  } else warnClock = 0;
  updateEnemies(dt);
  if (G.state !== 'play') return;
  updateShots(dt);
  if (G.state !== 'play') return;
  updateContext(dt);
  if (G.state !== 'play') return;
  updateParticles(dt);
  for (const w of G.wrecks) if (Math.random() < dt * 1.6) particle(w.x + rand(-1, 1), 3, w.z + rand(-1, 1), 'smoke', 0x5b655c, 1.1, 0.05);
  if (G.phase === 2) {
    G.timeLeft = Math.max(0, G.timeLeft - dt);
    if (G.timeLeft <= 0) {
      if (G.op === 0)
        failMission(
          'MONARCH launched. Deliver the engineers first, then use heavy weapons to stop the launcher before the clock reaches zero.',
          'launch',
        );
      else
        failMission(
          'BASTION fired its salvo at the carrier. Break the three shield pylons fast, then use rockets and missiles on the gun before the clock reaches zero.',
          'salvo',
        );
      return;
    }
  }
  if (player.hp < 30 && Math.random() < dt * 8) particle(player.x, player.y + 0.7, player.z, 'smoke', 0x59685f, 0.9, 0.03);
  if (G.saveTime > 5) {
    G.saveTime = 0;
    saveGame();
  }
  if (G.radioTime > 0) {
    G.radioTime -= dt;
    if (G.radioTime <= 0) hud.radio.classList.remove('show');
  }
  if (G.toastTime > 0) {
    G.toastTime -= dt;
    if (G.toastTime <= 0) hud.eventToast.classList.remove('show');
  }
}

/* ------------------------------------------------------------------ waypoint, HUD, markers, map */

const WP = { x: 0, z: 0, label: '' };
function wpSet(x, z, label) {
  WP.x = x;
  WP.z = z;
  WP.label = label;
  return WP;
}
function wpHome() {
  return wpSet(HOME.x, HOME.z, 'CARRIER');
}
function nearestEnemy(type) {
  let best = null,
    bd = Infinity;
  for (const e of G.enemies)
    if (e.alive && e.type === type) {
      const d = dist(e, player);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
  return best;
}
function nextWaypoint() {
  if (G.phase === 0) {
    if (G.op === 0) {
      const e = nearestEnemy('radar');
      return e ? wpSet(e.x, e.z, 'UPLINK ' + (e.id === 0 ? 'A' : 'B')) : wpHome();
    }
    const e = nearestEnemy('truck');
    return e ? wpSet(e.x, e.z, 'CONVOY') : wpHome();
  }
  if (G.phase === 1) {
    if (player.cargo >= 3 || G.delivered + player.cargo >= op().crew) return wpHome();
    let best = null,
      bd = Infinity;
    for (const p of G.people)
      if (p.state === 'ground') {
        const d = dist(p, player);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    return best ? wpSet(best.x, best.z, 'RESCUE') : wpHome();
  }
  if (G.phase === 2) {
    if (G.op === 0) {
      const e = nearestEnemy('boss');
      return e ? wpSet(e.x, e.z, 'MONARCH') : wpHome();
    }
    if (G.pylons < 3) {
      const p = nearestEnemy('pylon');
      if (p) return wpSet(p.x, p.z, 'PYLON');
    }
    const b = nearestEnemy('bastion');
    return b ? wpSet(b.x, b.z, 'BASTION') : wpHome();
  }
  return wpHome();
}
function formatTime(t) {
  return (
    Math.floor(t / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    Math.floor(t % 60)
      .toString()
      .padStart(2, '0')
  );
}

const hud = {};
function cacheHud() {
  for (const id of [
    'hud',
    'worldLabels',
    'armorVal',
    'fuelVal',
    'armorBar',
    'fuelBar',
    'cargoText',
    'radarCargo',
    'objectiveName',
    'objectiveDetail',
    'objectivePhase',
    'timer',
    'timerLabel',
    'timeLeft',
    'context',
    'contextText',
    'contextFill',
    'radar',
    'largeMap',
    'target',
    'targetName',
    'waypoint',
    'damage',
    'radio',
    'radioText',
    'radioName',
    'eventToast',
    'desktopHint',
  ])
    hud[id] = $(id);
  hud.ammo = [0, 1, 2].map((i) => $('ammo' + i));
  hud.dots = [...document.querySelectorAll('.task-dots i')];
  hud.weapons = [...document.querySelectorAll('.weapon')];
  hud.targetHealth = $('targetHealth').firstElementChild;
  hud.wpArrow = hud.waypoint.querySelector('.arrow');
  hud.wpText = hud.waypoint.querySelector('em');
}
function setText(el, v) {
  if (el._t !== v) {
    el._t = v;
    el.textContent = v;
  }
}
function setStyle(el, prop, v) {
  const c = el._s || (el._s = {});
  if (c[prop] !== v) {
    c[prop] = v;
    el.style[prop] = v;
  }
}
function setShown(el, on) {
  if (el._on !== on) {
    el._on = on;
    el.classList.toggle('hidden', !on);
  }
}
const winchPrompt = () => (input.source === 'touch' ? 'HOLD WINCH' : input.source === 'gamepad' ? 'HOLD X · WINCH' : 'HOLD E · WINCH');
function objectiveText() {
  const p = player,
    waiting = G.people.some((q) => q.state === 'ground');
  if (G.op === 0)
    return [
      ['Silence the radar net.', `Destroy both uplinks. ${G.radars} / 2`],
      [
        'Bring the engineers home.',
        waiting ? `Hold the winch above each engineer. ${G.delivered + p.cargo} / 3` : 'Return to the carrier. Unload the crew.',
      ],
      ['Stop the MONARCH launcher.', 'Use heavy weapons. Avoid the red shots.'],
      ['Return to the carrier.', 'Hover above the carrier to finish.'],
    ][G.phase];
  return [
    ['Stop the convoy.', `Destroy the armored trucks. ${G.convoyKilled} / 4 · ${G.convoyEscaped} / ${CONVOY_ESCAPE_LIMIT} escaped`],
    [
      'Bring the pilots home.',
      !waiting
        ? 'Return to the carrier. Unload the crew.'
        : p.cargo >= 3
          ? 'Cabin full. Unload at the carrier.'
          : `Hold the winch above each pilot. ${G.delivered + p.cargo} / 4`,
    ],
    ['Break the BASTION.', G.pylons < 3 ? `Destroy the shield pylons. ${G.pylons} / 3` : 'Shield down. Heavy weapons on BASTION.'],
    ['Return to the carrier.', 'Hover above the carrier to finish.'],
  ][G.phase];
}
let touchBottom = 0,
  touchClock = 0;
function updateHud() {
  const p = player,
    o = op();
  setText(hud.armorVal, Math.ceil(p.hp).toString().padStart(3, '0'));
  setText(hud.fuelVal, Math.ceil(p.fuel).toString().padStart(3, '0'));
  setStyle(hud.armorBar, 'width', p.hp.toFixed(1) + '%');
  setStyle(hud.fuelBar, 'width', p.fuel.toFixed(1) + '%');
  setStyle(hud.armorBar, 'background', p.hp < 30 ? 'var(--red)' : 'var(--cyan)');
  setStyle(hud.fuelBar, 'background', p.fuel < 22 ? 'var(--red)' : 'var(--lime)');
  hud.armorVal.classList.toggle('low', p.hp < 30);
  hud.fuelVal.classList.toggle('low', p.fuel < 22);
  for (let i = 0; i < 3; i++)
    setText(
      hud.ammo[i],
      Math.floor(p.ammo[i])
        .toString()
        .padStart(i === 0 ? 3 : 2, '0'),
    );
  setText(hud.cargoText, 'CREW ' + p.cargo + ' / 3');
  setText(hud.radarCargo, 'CARGO ' + p.cargo + ' / 3 · MAP');
  const [name, detail] = objectiveText();
  setText(hud.objectiveName, name);
  setText(hud.objectiveDetail, detail);
  setText(hud.objectivePhase, 'TASK 0' + (G.phase + 1) + ' / OPERATION ' + o.name);
  for (let i = 0; i < hud.dots.length; i++) {
    hud.dots[i].classList.toggle('done', i < G.phase);
    hud.dots[i].classList.toggle('active', i === G.phase);
  }
  setShown(hud.timer, G.phase === 2);
  setText(hud.timerLabel, o.timerLabel);
  setText(hud.timeLeft, formatTime(G.timeLeft));
  const ctx = G.context;
  setShown(hud.context, !!ctx && G.state === 'play');
  if (ctx) {
    let text = '';
    if (ctx.kind === 'base') text = p.cargo ? 'HOVER TO UNLOAD CREW' : G.phase === 3 ? 'HOVER TO COMPLETE MISSION' : 'CARRIER · AUTO REPAIR / REFUEL';
    else if (ctx.kind === 'person') text = winchPrompt() + ' · ' + o.crewWord;
    else if (ctx.kind === 'supply') text = winchPrompt() + ' · ' + ctx.ref.type.toUpperCase();
    else if (ctx.kind === 'blocked') text = G.op === 0 ? 'RESCUE LOCKED · DESTROY BOTH RADARS' : 'RESCUE LOCKED · STOP THE CONVOY';
    else if (ctx.kind === 'full') text = 'CABIN FULL · UNLOAD AT THE CARRIER';
    setText(hud.contextText, text);
    setStyle(hud.contextFill, 'width', (G.winchProgress * 100).toFixed(1) + '%');
  }
  updateTouchLabels();
  if ((touchClock += 1) >= 5) {
    touchClock = 0;
    touchBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kit-touch-bottom')) || 0;
  }
  drawMap(hud.radar, false);
  updateMapInfo();
}
function updateMapInfo() {
  const o = op();
  setText($('mapEyebrow'), 'TACTICAL MAP / OPERATION ' + o.code);
  setText($('mapTitle'), o.title);
  for (let i = 0; i < 4; i++) {
    const el = $('mapTask' + i);
    setStyle(el, 'opacity', i > G.phase ? '.5' : '1');
    setText(el.querySelector('b'), i < G.phase ? '✓' : '0' + (i + 1));
    setText(el.querySelector('span'), o.mapTasks[i]);
  }
}

const TARGET_NAMES = {
  turret: 'AUTO GUN',
  sam: 'MISSILE TURRET',
  tank: 'ARMORED ROVER',
  boat: 'PATROL BOAT',
  boss: 'MONARCH',
  drone: 'GUARD DRONE',
  truck: 'CONVOY TRUCK',
  flak: 'FLAK GUN',
  pylon: 'SHIELD PYLON',
  bastion: 'BASTION',
};
const labelPool = [];
let labelCount = 0,
  markersShown = false;
function worldLabel(x, y, text, color) {
  let el = labelPool[labelCount];
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-label';
    hud.worldLabels.append(el);
    labelPool[labelCount] = el;
  }
  labelCount++;
  setText(el, text);
  setStyle(el, 'color', color || '');
  setStyle(el, 'display', '');
  el.style.transform = `translate(${x | 0}px,${y | 0}px) translate(-50%,-50%)`;
}
function clearLabels() {
  for (const el of labelPool) setStyle(el, 'display', 'none');
  labelCount = 0;
}
function hideMarkers() {
  if (!hud.target) return;
  setShown(hud.target, false);
  setShown(hud.waypoint, false);
  clearLabels();
  markersShown = false;
}
function updateMarkers() {
  markersShown = true;
  const W = kit.size.width,
    H = kit.size.height;
  const tgt = G.target && G.target.alive ? G.target : null;
  setShown(hud.target, !!tgt);
  if (tgt) {
    const p = R.project(tgt.x, tgt.y + tgt.height, tgt.z);
    hud.target.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%)`;
    setText(hud.targetName, tgt.type === 'radar' ? 'UPLINK ' + (tgt.id === 0 ? 'A' : 'B') : TARGET_NAMES[tgt.type] || 'HOSTILE');
    setStyle(hud.targetHealth, 'width', ((tgt.hp / tgt.maxHp) * 100).toFixed(1) + '%');
  }
  const w = nextWaypoint(),
    distance = Math.hypot(player.x - w.x, player.z - w.z);
  const p = R.project(w.x, groundAt(w.x, w.z) + 5, w.z);
  setShown(hud.waypoint, !(distance < 14 || (G.target && Math.hypot(G.target.x - w.x, G.target.z - w.z) < 1 && distance < 43)));
  const touch = !!(kit.touch && kit.touch.visible),
    narrow = W < 650;
  const marginX = narrow ? 40 : 60,
    top = touch ? (narrow ? 205 : 115) : 150,
    bottom = touch ? Math.max(185, touchBottom + 16) : 135;
  const x = clamp(p.x, marginX, W - marginX);
  let y = clamp(p.y, top, H - bottom);
  if (H < 500) y = clamp(p.y, 110, H - 135);
  const off = Math.abs(x - p.x) > 1 || Math.abs(y - p.y) > 1;
  hud.waypoint.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
  setText(hud.wpArrow, off ? '➤' : '◇');
  setStyle(hud.wpArrow, 'transform', off ? 'rotate(' + Math.atan2(p.y - H / 2, p.x - W / 2).toFixed(2) + 'rad)' : '');
  setText(hud.wpText, w.label + ' · ' + Math.round(distance * 4) + 'm');
  // Only nearby world labels are shown, to keep the action area clear.
  labelCount = 0;
  for (const c of G.pickups) {
    if (c.used || dist(c, player) > 28) continue;
    const q = R.project(c.x, 5.5, c.z);
    if (q.x < 20 || q.x > W - 20 || q.y < 100 || q.y > H - 90) continue;
    worldLabel(q.x, q.y, c.type.toUpperCase());
  }
  if (rescueOpen())
    for (const c of G.people) {
      if (c.state !== 'ground' || dist(c, player) > 30) continue;
      const q = R.project(c.x, 5.8 + c.lift, c.z);
      worldLabel(q.x, q.y, (c.kind === 'pilot' ? 'PILOT ' : 'CREW ') + (c.id + 1));
    }
  if (dist(player, HOME) < 40) {
    const q = R.project(HOME.x, 4.2, HOME.z + 9);
    worldLabel(q.x, q.y, 'HOME / SERVICE', 'var(--lime)');
  }
  for (let i = labelCount; i < labelPool.length; i++) setStyle(labelPool[i], 'display', 'none');
}

/** The island never changes: land, grid and bridge are drawn once per canvas size. */
const mapCache = new Map();
function mapBase(s) {
  let base = mapCache.get(s);
  if (base) return base;
  base = document.createElement('canvas');
  base.width = base.height = s;
  const c = base.getContext('2d'),
    scale = s / 260;
  c.fillStyle = '#133b3f';
  c.fillRect(0, 0, s, s);
  c.save();
  c.translate(s / 2, s / 2);
  c.scale(scale, scale);
  for (let z = -110; z <= 95; z += 5)
    for (let x = -120; x <= 115; x += 5) {
      const k = landClass(x, z);
      if (!k) continue;
      c.fillStyle = k === 1 ? '#54765b' : '#375e4b';
      c.fillRect(x - 2.5, z - 2.5, 5.2, 5.2);
    }
  c.lineWidth = 1 / scale;
  c.strokeStyle = '#b8d6bc15';
  for (let i = -100; i <= 100; i += 25) {
    c.beginPath();
    c.moveTo(i, -130);
    c.lineTo(i, 130);
    c.moveTo(-130, i);
    c.lineTo(130, i);
    c.stroke();
  }
  c.strokeStyle = '#779580';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-6, 14);
  c.lineTo(26, 14);
  c.stroke();
  c.restore();
  mapCache.set(s, base);
  return base;
}
function diamond(c, x, z, r) {
  c.beginPath();
  c.moveTo(x, z - r);
  c.lineTo(x + r, z);
  c.lineTo(x, z + r);
  c.lineTo(x - r, z);
  c.fill();
}
function drawMap(canvas, large) {
  const c = canvas.getContext('2d'),
    s = canvas.width,
    scale = s / 260;
  c.drawImage(mapBase(s), 0, 0);
  c.save();
  c.translate(s / 2, s / 2);
  c.scale(scale, scale);
  c.lineWidth = 1 / scale;
  if (G.op === 1 && G.phase === 0) {
    // The convoy's road to the ridge.
    c.strokeStyle = '#ffb36b66';
    c.lineWidth = 1.4 / scale;
    c.setLineDash([2 / scale, 3 / scale]);
    c.beginPath();
    c.moveTo(ROUTE[0][0], ROUTE[0][1]);
    for (let i = 1; i < ROUTE.length; i++) c.lineTo(ROUTE[i][0], ROUTE[i][1]);
    c.stroke();
    c.setLineDash([]);
    const end = ROUTE[ROUTE.length - 1];
    c.fillStyle = '#ffb36b';
    c.fillRect(end[0] - 2, end[1] - 2, 4, 4);
  }
  const waypoint = nextWaypoint(),
    wx = waypoint.x,
    wz = waypoint.z;
  c.strokeStyle = '#def27d55';
  c.lineWidth = 1 / scale;
  c.setLineDash([3 / scale, 5 / scale]);
  c.beginPath();
  c.moveTo(player.x, player.z);
  c.lineTo(wx, wz);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#d9ef8c';
  c.fillRect(HOME.x - 6, HOME.z - 9, 12, 18);
  c.font = 'bold ' + (large ? 7 : 9) + 'px monospace';
  c.fillStyle = '#173b3d';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('H', HOME.x, HOME.z);
  for (const q of G.pickups)
    if (!q.used) {
      c.strokeStyle = q.type === 'fuel' ? '#eed18a' : '#8cded0';
      c.lineWidth = 1.5 / scale;
      c.beginPath();
      c.moveTo(q.x - 2.2, q.z);
      c.lineTo(q.x + 2.2, q.z);
      c.moveTo(q.x, q.z - 2.2);
      c.lineTo(q.x, q.z + 2.2);
      c.stroke();
    }
  for (const w of G.wrecks) {
    c.strokeStyle = '#c2d5a188';
    c.lineWidth = 1.2 / scale;
    c.beginPath();
    c.moveTo(w.x - 2, w.z - 2);
    c.lineTo(w.x + 2, w.z + 2);
    c.moveTo(w.x + 2, w.z - 2);
    c.lineTo(w.x - 2, w.z + 2);
    c.stroke();
  }
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const big = e.type === 'boss' || e.type === 'bastion',
      mid = e.type === 'radar' || e.type === 'pylon';
    c.fillStyle = big ? '#f7ad83' : mid ? '#f19178' : e.type === 'truck' ? '#ffb36b' : '#de775f';
    diamond(c, e.x, e.z, big ? 4.5 : mid ? 3.5 : e.type === 'truck' ? 2.8 : 2.2);
    if (large && (big || mid)) {
      c.fillStyle = '#efcbaa';
      c.font = 'bold 5.6px monospace';
      c.fillText(
        e.type === 'boss' ? 'MONARCH' : e.type === 'bastion' ? 'BASTION' : e.type === 'pylon' ? 'PYLON' : 'UPLINK ' + (e.id === 0 ? 'A' : 'B'),
        e.x,
        e.z - 8,
      );
    }
  }
  const open = rescueOpen();
  for (const p of G.people)
    if (p.state === 'ground') {
      c.fillStyle = open ? '#86eacc' : '#c2d5a1';
      c.beginPath();
      c.arc(p.x, p.z, 2.3, 0, TAU);
      c.fill();
    }
  const pulse = 5 + Math.sin(G.t * 3) * 1.2;
  c.strokeStyle = '#e9f29a';
  c.lineWidth = 1.2 / scale;
  c.beginPath();
  c.arc(wx, wz, pulse, 0, TAU);
  c.stroke();
  if (!G.heliLost) {
    c.save();
    c.translate(player.x, player.z);
    c.rotate(-player.yaw);
    c.fillStyle = '#fff4d4';
    c.strokeStyle = '#16363b';
    c.lineWidth = 0.8 / scale;
    c.beginPath();
    c.moveTo(0, -5);
    c.lineTo(3.5, 4);
    c.lineTo(0, 2);
    c.lineTo(-3.5, 4);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }
  if (large) {
    c.fillStyle = '#adceb6';
    c.font = '5px monospace';
    c.fillText('CARRIER', HOME.x, HOME.z + 16);
    if (G.op === 0) c.fillText('TEMPLE / CREW', -45, -58);
    else {
      for (const site of op().sites) c.fillText('CRASH SITE', site.x, site.z + 9);
      if (G.phase === 0) c.fillText('RIDGE ROAD', ROUTE[ROUTE.length - 1][0], ROUTE[ROUTE.length - 1][1] + 7);
    }
    c.fillStyle = '#c3ddbb';
    c.font = 'bold 8px monospace';
    c.fillText('N', 113, -116);
    c.font = '5px monospace';
    c.fillText('↑', 113, -105);
  }
  c.restore();
  c.strokeStyle = '#b8d6bc22';
  c.lineWidth = 1;
  c.strokeRect(0.5, 0.5, s - 1, s - 1);
}

/* ------------------------------------------------------------------ touch labels, prompts, help */

const touchParts = {};
function initTouchLabels() {
  const t = kit.touch;
  if (!t) return;
  const make = (name, glyph, label, withCount) => {
    const frag = document.createElement('span');
    const g = document.createElement('span');
    g.className = 'bh-glyph';
    g.textContent = glyph;
    const l = document.createElement('span');
    l.className = 'bh-label';
    l.textContent = label;
    frag.append(g, l);
    if (withCount) {
      const s = document.createElement('small');
      frag.append(s);
      touchParts[name] = s;
    }
    t.setLabel(name, frag);
  };
  make('fire', '⌖', 'FIRE', true);
  make('rocket', '↟', 'ROCKET', true);
  make('missile', '◇', 'MISSILE', true);
  make('winch', '↧', 'WINCH', false);
  make('flare', '✧', 'FLARES', true);
}
function updateTouchLabels() {
  const t = kit.touch;
  if (!t || !t.visible) return;
  if (touchParts.fire) setText(touchParts.fire, String(Math.floor(player.ammo[G.selected])));
  if (touchParts.rocket) setText(touchParts.rocket, String(Math.floor(player.ammo[1])));
  if (touchParts.missile) setText(touchParts.missile, String(Math.floor(player.ammo[2])));
  if (touchParts.flare) setText(touchParts.flare, G.flareTime > 0 ? Math.ceil(G.flareTime) + 's' : 'READY');
  t.button('flare')?.classList.toggle('bh-cool', G.flareTime > 0);
  const ctx = G.context,
    ready = !!ctx && (ctx.kind === 'person' || ctx.kind === 'supply');
  const wb = t.button('winch');
  if (wb) {
    wb.classList.toggle('bh-ready', ready);
    wb.classList.toggle('bh-idle', !ready);
  }
}
function setTouch(on) {
  kit.touch?.suspend(!on, 'game');
}

const HINTS = {
  keyboard:
    '<span>WASD</span> FLY &nbsp; <span>SPACE / CLICK</span> FIRE &nbsp; <span>R / R-CLICK</span> ROCKET &nbsp; <span>F</span> MISSILE<br><span>E</span> WINCH &nbsp; <span>Q</span> FLARES &nbsp; <span>1–3</span> WEAPON &nbsp; <span>M</span> MAP &nbsp; <span>ESC</span> PAUSE',
  gamepad:
    '<span>L-STICK</span> FLY &nbsp; <span>RT / A</span> FIRE &nbsp; <span>B / LT</span> ROCKET &nbsp; <span>Y</span> MISSILE<br><span>X</span> WINCH &nbsp; <span>LB</span> FLARES &nbsp; <span>RB</span> WEAPON &nbsp; <span>VIEW</span> MAP &nbsp; <span>START</span> PAUSE',
  touch: '',
};
const HELP = {
  keyboard: {
    label: 'KEYBOARD + MOUSE',
    rows: [
      ['01 / MOVE', 'Use WASD or the arrow keys. The camera follows your flight.'],
      [
        '02 / FIRE',
        'Hold Space or J to fire at the nearest target. Hold the left mouse button to aim at the pointer. Use 1, 2 or 3 to select a weapon.',
      ],
      ['03 / HEAVY WEAPONS', 'R, K, Shift or right click fires a rocket. F fires a guided missile that follows the marked target.'],
      ['04 / RESCUE', 'Stop above a green beacon and hold E to winch. Take everyone back to the carrier. The cabin holds three.'],
      ['05 / SUPPLIES', 'Hold E above a supply crate. Hover over the carrier to repair, refuel and reload for free.'],
      ['06 / STAY ALIVE', 'Keep moving between enemy shots. Press Q to release flares: they stop nearby shots and recharge in eight seconds.'],
    ],
    footer:
      'Follow the yellow marker. M opens the map, Esc pauses. Finish each task, then return to the carrier. The game saves your flight on this device when local storage is available.',
  },
  gamepad: {
    label: 'CONTROLLER',
    rows: [
      ['01 / MOVE', 'Left stick or D-pad. The camera follows your flight.'],
      ['02 / FIRE', 'Hold RT or A to fire the selected weapon at the nearest target. RB switches weapons.'],
      ['03 / HEAVY WEAPONS', 'B or LT fires a rocket. Y fires a guided missile that follows the marked target.'],
      ['04 / RESCUE', 'Stop above a green beacon and hold X to winch. Take everyone back to the carrier. The cabin holds three.'],
      ['05 / SUPPLIES', 'Hold X above a supply crate. Hover over the carrier to repair, refuel and reload for free.'],
      ['06 / STAY ALIVE', 'Keep moving between enemy shots. Press LB to release flares: they stop nearby shots and recharge in eight seconds.'],
    ],
    footer:
      'Follow the yellow marker. VIEW opens the map, START pauses, B goes back in menus. Finish each task, then return to the carrier. The game saves your flight on this device when local storage is available.',
  },
  touch: {
    label: 'TOUCH',
    rows: [
      ['01 / MOVE', 'Put a thumb anywhere on the left side and drag. The stick appears under your thumb.'],
      ['02 / FIRE', 'Hold FIRE to shoot at the nearest target. In landscape, tap a weapon in the bar to choose what FIRE shoots.'],
      ['03 / HEAVY WEAPONS', 'ROCKET fires a rocket. MISSILE fires a guided missile that follows the marked target.'],
      ['04 / RESCUE', 'Stop above a green beacon and hold WINCH (it lights up when you are in place). The cabin holds three.'],
      ['05 / SUPPLIES', 'Hold WINCH above a supply crate. Hover over the carrier to repair, refuel and reload for free.'],
      ['06 / STAY ALIVE', 'Keep moving between enemy shots. Tap FLARES to stop nearby shots. They recharge in eight seconds.'],
    ],
    footer:
      'Follow the yellow marker. Tap the radar for the map, the pause button to rest. Finish each task, then return to the carrier. The game saves your flight on this device when local storage is available.',
  },
};
const CONTROL_HINT = {
  keyboard: 'WASD TO FLY · SPACE TO FIRE · CONTROLLER READY',
  gamepad: 'LEFT STICK TO FLY · RT TO FIRE · A TO SELECT',
  touch: 'TOUCH CONTROLS · LANDSCAPE RECOMMENDED',
};
const escapeHtml = (s) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
function renderHelp() {
  const h = HELP[input.source] || HELP.keyboard;
  $('helpSource').textContent = h.label;
  $('helpGrid').innerHTML = h.rows.map(([b, s]) => `<div><b>${escapeHtml(b)}</b><span>${escapeHtml(s)}</span></div>`).join('');
  $('helpFooter').textContent = h.footer;
}
function applySource(src) {
  document.body.dataset.input = src;
  hud.desktopHint.innerHTML = HINTS[src] ?? HINTS.keyboard;
  $('menuControlHint').textContent = CONTROL_HINT[src] || CONTROL_HINT.keyboard;
  if (!$('helpModal').classList.contains('hidden')) renderHelp();
  if (src !== 'gamepad') markNav(null);
}

/* ------------------------------------------------------------------ settings, operations, saves */

function setWeapon(i) {
  G.selected = clamp(i, 0, 2);
  hud.weapons.forEach((b, j) => b.classList.toggle('active', j === G.selected));
}
function hideOverlays() {
  for (const id of ['menu', 'pauseModal', 'mapModal', 'helpModal', 'settingsModal', 'resultModal']) $(id).classList.add('hidden');
}
function settingsSave() {
  try {
    localStorage.setItem('brickhawk.settings', JSON.stringify(options));
  } catch {
    /* private mode */
  }
}
function updateSettings() {
  document.querySelectorAll('.soundButton').forEach((b) => {
    if (b.classList.contains('icon')) {
      b.textContent = options.sound ? '♪' : '♩';
      b.style.opacity = options.sound ? '1' : '.5';
      b.setAttribute('aria-label', options.sound ? 'Mute sound' : 'Enable sound');
    } else b.textContent = options.sound ? 'ON' : 'OFF';
  });
  $('difficultyButton').textContent = DIFFICULTY[options.difficulty].label;
  $('shakeButton').textContent = options.shake ? 'ON' : 'OFF';
  $('touchButton').textContent = String(kit.settings.get().touch || 'auto').toUpperCase();
  $('menuDifficulty').textContent = 'TWO OPERATIONS · ' + DIFFICULTY[options.difficulty].label + ' FLIGHT';
  settingsSave();
}
function selectOp(i) {
  options.op = i === 1 ? 1 : 0;
  const o = OPS[options.op];
  document.querySelectorAll('.op-select [data-op]').forEach((b) => b.classList.toggle('active', Number(b.dataset.op) === options.op));
  $('menuIntro').innerHTML = o.intro;
  $('launch').firstElementChild.textContent = 'START OPERATION ' + o.code;
  $('opEyebrow').textContent = 'OPERATION ' + o.code + ' / 2087';
  $('opTitle').textContent = o.card;
  for (let k = 0; k < 3; k++) $('opTask' + k).textContent = o.tasks[k];
  $('opThreat').textContent = 'THREAT LEVEL / ' + o.threat;
  $('footerOp').textContent = o.code + ' / ' + o.name;
  settingsSave();
  if (G.state === 'menu') {
    // Switching operations on the title screen keeps the camera where it is (no slide back to the deck).
    const { camX, camY, camZ } = G;
    setupMission(options.op);
    Object.assign(G, { camX, camY, camZ });
  }
}

const SAVE_KEY = 'brickhawk.save';
const MISSION_KEYS = [
  'op',
  'elapsed',
  'phase',
  'radars',
  'delivered',
  'timeLeft',
  'timerMax',
  'selected',
  'score',
  'kills',
  'damageTaken',
  'shotsFired',
  'hits',
  'services',
  'difficulty',
  'convoyKilled',
  'convoyEscaped',
  'pylons',
];
function saveGame() {
  if (G.state !== 'play' || player.hp <= 0 || player.fuel <= 0) return;
  const mission = {};
  for (const k of MISSION_KEYS) mission[k] = G[k];
  const data = {
    version: 2,
    player: { ...player, ammo: [...player.ammo], cool: [0, 0, 0] },
    mission,
    enemies: G.enemies.map((e) => ({ ...e, charge: 0, cd: 1.2 })),
    people: G.people.map((p) => ({ ...p, lift: 0 })),
    pickups: G.pickups,
    props: G.props,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: the flight simply is not saved */
  }
}
function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!s || (s.version !== 1 && s.version !== 2) || !s.player || !s.mission || !Array.isArray(s.enemies) || !Array.isArray(s.people)) return null;
    if (s.version === 1) s.mission.op = 0; // saves from the single-mission version
    return s;
  } catch {
    return null;
  }
}
function loadGame() {
  const s = readSave();
  if (!s) return false;
  setupMission(s.mission.op === 1 ? 1 : 0);
  Object.assign(player, s.player);
  player.ammo = Array.isArray(s.player.ammo) ? s.player.ammo.slice(0, 3) : [...MAX_AMMO];
  player.cool = [0, 0, 0];
  for (const k of MISSION_KEYS) if (k in s.mission) G[k] = s.mission[k];
  G.op = s.mission.op === 1 ? 1 : 0;
  if (!DIFFICULTY[G.difficulty]) G.difficulty = 'standard';
  if (!G.timerMax) G.timerMax = op().timer;
  G.enemies = s.enemies;
  G.people = s.people;
  if (Array.isArray(s.pickups)) G.pickups = s.pickups;
  if (Array.isArray(s.props)) G.props = s.props;
  for (const e of G.enemies) {
    if (!e.radius) e.radius = (ENEMY_SIZE[e.type] || [2.5, 1.8])[0];
    if (!e.height) e.height = (ENEMY_SIZE[e.type] || [2.5, 1.8])[1];
  }
  G.camX = player.x;
  G.camZ = player.z;
  G.invuln = 2;
  return true;
}
function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to clear */
  }
}
const BEST_KEY = 'brickhawk.best.v2';
function readBest() {
  let best = {};
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    if (raw && typeof raw === 'object')
      for (const [k, v] of Object.entries(raw))
        if (v && Number.isFinite(v.score)) best[k] = { score: v.score, time: Number.isFinite(v.time) ? v.time : 0 };
    // The single-mission version kept one best score: carry it over to Operation 01.
    const legacy = Number(localStorage.getItem('brickhawk.best')) || 0;
    if (legacy && !best['0-standard']) best['0-standard'] = { score: legacy, time: 0 };
  } catch {
    /* no records */
  }
  return best;
}
function writeBest(best) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* no records */
  }
}
function refreshMenu() {
  const s = readSave();
  const cont = $('continue');
  cont.classList.toggle('hidden', !s);
  if (s) cont.textContent = 'CONTINUE OPERATION ' + OPS[s.mission.op === 1 ? 1 : 0].code + ' →';
  const best = readBest();
  document.querySelectorAll('.op-select [data-best]').forEach((el) => {
    const b = best[el.dataset.best + '-' + options.difficulty];
    el.textContent = b ? 'BEST ' + b.score.toLocaleString() + (b.time ? ' · ' + formatTime(b.time) : '') : '';
  });
}

/* ------------------------------------------------------------------ game flow */

/** Menu buttons lose focus in flight, so Space and Enter reach the game instead of a hidden button. */
function releaseFocus() {
  const el = document.activeElement;
  if (el && el !== document.body && typeof el.blur === 'function') el.blur();
}
function launchGame(resume = false, opIndex = options.op) {
  AudioSys.init();
  const restored = resume && loadGame();
  if (!restored) setupMission(opIndex);
  hideOverlays();
  G.state = 'play';
  G.invuln = 2;
  G.winchProgress = 0;
  G.winchId = null;
  G.holdLock = true;
  hud.hud.classList.remove('hidden');
  hud.worldLabels.classList.remove('hidden');
  releaseFocus();
  setTouch(true);
  setWeapon(G.selected);
  input.settle();
  updateHud();
  if (restored) radio('Flight restored. Check the map, and finish the operation.', 'PATCH / FIELD CONTROL', 5);
  else if (G.op === 0)
    radio(
      'Welcome to the delta, Kestrel. Follow the yellow marker. Hold FIRE for aim assist. Take out both radar stations.',
      'PATCH / FIELD CONTROL',
      9,
    );
  else
    radio(
      'Kestrel, a convoy is rolling off the old launch pad toward the bridge with a mobile battery for our carrier. Stop it before two trucks reach the ridge road.',
      'PATCH / FIELD CONTROL',
      10,
    );
  saveGame();
}
function mainMenu() {
  if (G.state === 'play') saveGame();
  G.state = 'menu';
  hideOverlays();
  $('menu').classList.remove('hidden');
  hud.hud.classList.add('hidden');
  hideMarkers();
  setTouch(false);
  setupMission(options.op);
  refreshMenu();
  input.settle();
  focusDefault($('menu'));
}
function pauseGame() {
  if (G.state !== 'play') return;
  saveGame();
  G.state = 'paused';
  $('pauseModal').classList.remove('hidden');
  hideMarkers();
  setTouch(false);
  focusDefault($('pauseModal'));
}
function resumeGame() {
  if (G.state !== 'paused' && G.state !== 'map' && G.state !== 'help') return;
  hideOverlays();
  G.state = 'play';
  G.holdLock = true;
  releaseFocus();
  input.settle();
  setTouch(true);
  G.invuln = Math.max(G.invuln, 0.5);
}
function openMap() {
  if (G.state === 'map') {
    resumeGame();
    return;
  }
  if (G.state !== 'play') return;
  saveGame();
  G.state = 'map';
  setTouch(false);
  hideMarkers();
  updateHud();
  drawMap(hud.largeMap, true);
  $('mapModal').classList.remove('hidden');
  focusDefault($('mapModal'));
}
function openHelp(from) {
  helpFrom = from || G.state;
  if (G.state === 'play') {
    saveGame();
    G.state = 'help';
    setTouch(false);
    hideMarkers();
  }
  renderHelp();
  $('helpModal').classList.remove('hidden');
  focusDefault($('helpModal'));
}
function closeHelp() {
  $('helpModal').classList.add('hidden');
  if (helpFrom === 'play') resumeGame();
  else if (helpFrom === 'paused') {
    $('pauseModal').classList.remove('hidden');
    focusDefault($('pauseModal'));
  } else if (G.state === 'menu') focusDefault($('menu'));
}
function openSettings() {
  updateSettings();
  $('settingsModal').classList.remove('hidden');
  focusDefault($('settingsModal'));
}
function closeSettings() {
  $('settingsModal').classList.add('hidden');
  refreshMenu();
  if (G.state === 'menu') focusDefault($('menu'));
}
function failMission(reason, kind = 'lost') {
  if (G.state !== 'play') return;
  G.resultReason = reason;
  G.resultWin = false;
  G.failKind = kind;
  G.state = 'ending';
  G.endDelay = 1.15;
  hideMarkers();
  setTouch(false);
  if (kind === 'lost') {
    explosion(player.x, player.y, player.z, 6);
    G.heliLost = true;
  } else if (kind === 'launch' || kind === 'salvo') {
    const e = nearestEnemy(kind === 'launch' ? 'boss' : 'bastion');
    if (e) {
      explosion(e.x, e.y + 5, e.z, 6);
      for (let i = 0; i < 12; i++) particle(e.x + rand(-2, 2), e.y + 6 + i * 0.6, e.z + rand(-2, 2), 'smoke', i % 2 ? 0xc5c0a0 : 0x7b7c6b, 2.2, 0.4);
    }
    G.endDelay = 1.6;
  }
  input.rumble(1, 450);
  clearSave();
}
function completeMission() {
  if (G.state !== 'play') return;
  G.resultWin = true;
  G.score += Math.max(0, Math.floor(2000 + player.hp * 12 + Math.max(0, 420 - G.elapsed) * 4));
  G.state = 'ending';
  G.endDelay = 0.65;
  hideMarkers();
  setTouch(false);
  clearSave();
  AudioSys.sfx('rescue');
  input.rumble(0.5, 300);
}
function showResult() {
  G.state = 'result';
  hideOverlays();
  $('resultModal').classList.remove('hidden');
  hideMarkers();
  setTouch(false);
  const win = G.resultWin,
    o = op();
  const rank = !win
    ? '—'
    : G.op === 0
      ? G.elapsed < 300 && G.damageTaken < 110
        ? 'S'
        : G.elapsed < 460
          ? 'A'
          : 'B'
      : G.elapsed < 380 && G.damageTaken < 120
        ? 'S'
        : G.elapsed < 560
          ? 'A'
          : 'B';
  $('resultRank').textContent = rank;
  $('resultRank').style.color = win ? 'var(--lime)' : 'var(--red)';
  $('resultEyebrow').textContent =
    (win ? 'OPERATION ' + o.code + ' COMPLETE' : 'OPERATION ' + o.code + ' LOST') + ' · ' + DIFFICULTY[G.difficulty].label;
  $('resultTitle').textContent = win ? (G.op === 0 ? 'DELTA. DELIVERED.' : 'TIDE. TURNED.') : 'ROUGH LANDING.';
  $('resultText').textContent = win
    ? G.op === 0
      ? 'Three engineers safe. One launcher in pieces. Not bad for a box of bricks.'
      : 'Convoy stopped. Four pilots home. BASTION in pieces. The Glass Coast owes you lunch.'
    : G.resultReason;
  $('resultScore').textContent = G.score.toLocaleString();
  $('resultTime').textContent = formatTime(G.elapsed);
  $('resultRescue').textContent = G.delivered + ' / ' + o.crew;
  const accuracy = G.shotsFired ? Math.min(100, Math.round((G.hits / G.shotsFired) * 100)) : 0;
  $('resultExtra').textContent =
    `KILLS ${G.kills} · HIT RATE ${accuracy}% · CARRIER STOPS ${G.services}` + (G.op === 1 ? ` · TRUCKS ${G.convoyKilled} / 4` : '');
  const best = readBest(),
    key = G.op + '-' + G.difficulty;
  let rec = best[key] || null;
  if (win) {
    rec = { score: Math.max(rec?.score || 0, G.score), time: rec?.time ? Math.min(rec.time, G.elapsed) : G.elapsed };
    best[key] = rec;
    writeBest(best);
  }
  $('bestScore').textContent =
    (rec ? 'BEST SCORE ' + rec.score.toLocaleString() + (rec.time ? ' · BEST TIME ' + formatTime(rec.time) : '') : 'NO RECORD YET') +
    ' · ' +
    DIFFICULTY[G.difficulty].label +
    ' FLIGHT';
  $('nextOp').classList.toggle('hidden', !(win && G.op === 0));
  if (win) {
    AudioSys.tone(330, 0.45, 'triangle', 0.15);
    setTimeout(() => AudioSys.tone(440, 0.45, 'triangle', 0.12), 150);
    setTimeout(() => AudioSys.tone(660, 0.8, 'sine', 0.14), 300);
  }
  input.settle();
  focusDefault($('resultModal'));
}

/* ------------------------------------------------------------------ menus with keys, controller and touch */

const SCREEN_ORDER = ['error', 'helpModal', 'settingsModal', 'mapModal', 'pauseModal', 'resultModal', 'menu'];
const DEFAULT_BUTTON = {
  error: 'errorReload',
  helpModal: 'helpDone',
  settingsModal: 'settingsDone',
  mapModal: 'mapDone',
  pauseModal: 'resumeButton',
  resultModal: 'playAgain',
  menu: 'launch',
};
function topScreen() {
  for (const id of SCREEN_ORDER) {
    const el = $(id);
    if (el && !el.classList.contains('hidden')) return el;
  }
  return null;
}
function screenButtons(scr) {
  return [...scr.querySelectorAll('button')].filter((b) => !b.disabled && b.getClientRects().length > 0);
}
function defaultButton(scr) {
  if (scr.id === 'resultModal' && !$('nextOp').classList.contains('hidden')) return $('nextOp');
  return $(DEFAULT_BUTTON[scr.id]) || screenButtons(scr)[0] || null;
}
function focusDefault(scr) {
  if (!scr || !input || input.source === 'touch') return;
  const b = defaultButton(scr);
  if (b) b.focus({ preventScroll: true });
}
let navEl = null;
/** A visible focus ring for controller players (the browser only shows :focus-visible after keys). */
function markNav(el) {
  if (navEl) navEl.classList.remove('nav-focus');
  navEl = el && input && input.source === 'gamepad' ? el : null;
  if (navEl) navEl.classList.add('nav-focus');
}
function moveFocus(scr, dir) {
  const list = screenButtons(scr);
  if (!list.length) return;
  const cur = document.activeElement;
  if (!list.includes(cur)) {
    (defaultButton(scr) || list[0]).focus();
    return;
  }
  const r0 = cur.getBoundingClientRect(),
    cx = r0.left + r0.width / 2,
    cy = r0.top + r0.height / 2;
  let best = null,
    bs = Infinity;
  for (const b of list) {
    if (b === cur) continue;
    const r = b.getBoundingClientRect(),
      x = r.left + r.width / 2 - cx,
      y = r.top + r.height / 2 - cy;
    const along = dir === 'down' ? y : dir === 'up' ? -y : dir === 'right' ? x : -x;
    const across = dir === 'down' || dir === 'up' ? Math.abs(x) : Math.abs(y);
    if (along <= 4) continue;
    const s = along + across * 2.2;
    if (s < bs) {
      bs = s;
      best = b;
    }
  }
  if (best) {
    best.focus();
    AudioSys.tone(520, 0.04, 'sine', 0.03);
  }
}
function activate(scr) {
  const el = document.activeElement;
  if (el && el.tagName === 'BUTTON' && scr.contains(el) && el.getClientRects().length) el.click();
  else defaultButton(scr)?.click();
}
function backFrom(scr) {
  if (scr.id === 'helpModal') closeHelp();
  else if (scr.id === 'settingsModal') closeSettings();
  else if (scr.id === 'mapModal' || scr.id === 'pauseModal') resumeGame();
  else if (scr.id === 'resultModal') mainMenu();
}
let navDir = '',
  navTimer = 0;
function menuInput(dt) {
  const scr = topScreen();
  if (!scr) return;
  if (input.pressed('back') || input.pressed('pause')) {
    backFrom(scr);
    return;
  }
  if (scr.id === 'mapModal' && input.pressed('map')) {
    resumeGame();
    return;
  }
  if (input.pressed('confirm')) {
    activate(scr);
    return;
  }
  const v = input.vector('move');
  let dir = '';
  if (Math.abs(v.x) > 0.6 || Math.abs(v.y) > 0.6) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
  if (dir !== navDir) {
    navDir = dir;
    navTimer = 0.38;
    if (dir) moveFocus(scr, dir);
  } else if (dir) {
    navTimer -= dt;
    if (navTimer <= 0) {
      navTimer = 0.16;
      moveFocus(scr, dir);
    }
  }
}
function playKeys() {
  if (input.pressed('pause')) {
    pauseGame();
    return;
  }
  if (input.pressed('map')) {
    openMap();
    return;
  }
  if (input.pressed('weapon1')) setWeapon(0);
  if (input.pressed('weapon2')) setWeapon(1);
  if (input.pressed('weapon3')) setWeapon(2);
  if (input.pressed('nextWeapon')) setWeapon((G.selected + 1) % 3);
  if (input.pressed('flare')) deployFlares();
}

function bindUI() {
  document.querySelectorAll('.soundButton').forEach((b) =>
    b.addEventListener('click', () => {
      options.sound = !options.sound;
      AudioSys.init();
      updateSettings();
    }),
  );
  document.querySelectorAll('.kitMenuButton').forEach((b) => b.addEventListener('click', () => kit.menu.open()));
  $('difficultyButton').onclick = () => {
    options.difficulty = DIFF_ORDER[(DIFF_ORDER.indexOf(options.difficulty) + 1) % DIFF_ORDER.length];
    updateSettings();
    refreshMenu();
  };
  $('shakeButton').onclick = () => {
    options.shake = !options.shake;
    updateSettings();
  };
  $('touchButton').onclick = () => {
    const cur = kit.settings.get().touch;
    kit.settings.set({ touch: { auto: 'on', on: 'off', off: 'auto' }[cur] || 'auto' });
    updateSettings();
  };
  $('launch').onclick = () => launchGame(false, options.op);
  $('continue').onclick = () => launchGame(true);
  $('briefButton').onclick = () => openHelp('menu');
  $('pauseHelp').onclick = () => openHelp('paused');
  $('helpDone').onclick = closeHelp;
  $('closeHelp').onclick = closeHelp;
  $('menuSettings').onclick = openSettings;
  $('closeSettings').onclick = closeSettings;
  $('settingsDone').onclick = closeSettings;
  $('pauseButton').onclick = pauseGame;
  $('resumeButton').onclick = resumeGame;
  $('mapButton').onclick = openMap;
  $('radarButton').onclick = openMap;
  $('closeMap').onclick = resumeGame;
  $('mapDone').onclick = resumeGame;
  $('restartButton').onclick = () => launchGame(false, G.op);
  $('homeButton').onclick = mainMenu;
  $('playAgain').onclick = () => launchGame(false, G.op);
  $('nextOp').onclick = () => {
    selectOp(1);
    launchGame(false, 1);
  };
  $('resultHome').onclick = mainMenu;
  $('errorReload').onclick = () => location.reload();
  document.querySelectorAll('[data-weapon]').forEach((b) => (b.onclick = () => setWeapon(Number(b.dataset.weapon))));
  document.querySelectorAll('.op-select [data-op]').forEach((b) => (b.onclick = () => selectOp(Number(b.dataset.op))));
  addEventListener('contextmenu', (e) => e.preventDefault());
  // Sound starts on the first tap, click or key anywhere (browsers need a gesture).
  addEventListener('pointerdown', () => AudioSys.init(), true);
  addEventListener('keydown', () => AudioSys.init(), true);
  addEventListener('blur', () => {
    if (G.state === 'play') pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'play') pauseGame();
    AudioSys.hold(document.hidden || kit.paused);
  });
  addEventListener('pagehide', () => saveGame());
  document.addEventListener('focusin', (e) => markNav(e.target && e.target.closest ? e.target.closest('button') : null));
  document.addEventListener('focusout', () => markNav(null));
  kit.onResize(() => {
    if (G.state === 'map') drawMap(hud.largeMap, true);
  });
}

function cameraUpdate(dt) {
  const W = kit.size.width,
    H = kit.size.height;
  const isMenu = G.state === 'menu',
    portrait = W < 650 && H > W;
  let cx = player.x,
    cz = player.z,
    cy = 2.2,
    height = portrait ? 100 : 76;
  if (isMenu) {
    if (portrait) {
      cx = HOME.x + 7 * SQ;
      cz = HOME.z - 7 * SQ;
      cy = -9;
      height = 78;
    } else {
      cx = HOME.x - 25 * SQ;
      cz = HOME.z + 25 * SQ;
      cy = 2;
      height = 75;
    }
    cx += Math.sin(menuTime * 0.12) * 2;
    cz += Math.cos(menuTime * 0.12) * 1.5;
  } else {
    cx += player.vx * 0.32;
    cz += player.vz * 0.32;
    if (portrait) {
      cx -= 3 * SQ;
      cz -= 3 * SQ;
    }
  }
  const f = 1 - Math.exp(-dt * (isMenu ? 2 : 4));
  G.camX = lerp(G.camX, cx, f);
  G.camZ = lerp(G.camZ, cz, f);
  G.camY = lerp(G.camY, cy, f);
  R.aim(G.camX, G.camY, G.camZ, height, options.shake ? G.shake : 0);
}

function frame(rawDt) {
  if (fatal) return;
  try {
    const dt = Math.min(0.05, rawDt);
    menuTime += dt;
    const st = G.state;
    if (st === 'play') {
      playKeys();
      if (G.state === 'play') {
        G.t += dt;
        updateGame(dt);
      }
    } else if (st === 'menu') {
      G.t += dt;
      player.y = 11.4 + Math.sin(G.t * 1.5) * 0.18;
      player.yaw = 0.4 + Math.sin(menuTime * 0.2) * 0.1;
      menuInput(dt);
    } else if (st === 'ending') {
      G.t += dt;
      G.endDelay -= dt;
      G.shake = Math.max(0, G.shake - dt * 2);
      G.damage = Math.max(0, G.damage - dt);
      updateParticles(dt);
      if (G.endDelay <= 0) showResult();
    } else menuInput(dt);
    AudioSys.tick(dt);
    cameraUpdate(dt);
    R.begin();
    worldDynamic(G.t);
    R.render(G.t, G.damage);
    if (G.state === 'play') {
      hudClock += dt;
      if (hudClock > 0.1) {
        hudClock = 0;
        updateHud();
      }
      updateMarkers();
    } else if (markersShown) hideMarkers();
    setStyle(hud.damage, 'opacity', G.state === 'play' ? (G.damage * 0.6).toFixed(2) : '0');
  } catch (err) {
    fatal = true;
    $('errorText').textContent = 'The flight system stopped: ' + (err?.message || err) + '. Reload the page to try again.';
    $('error').classList.remove('hidden');
    throw err;
  }
}

/* ------------------------------------------------------------------ start */

const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  fire: { keys: ['Space', 'KeyJ'], mouse: [0], gamepad: ['RT', 'A'], touch: 'FIRE' },
  rocket: { keys: ['KeyR', 'KeyK', 'ShiftLeft', 'ShiftRight'], mouse: [2], gamepad: ['B', 'LT'], touch: 'ROCKET' },
  missile: { keys: ['KeyF'], gamepad: ['Y'], touch: 'MISSILE' },
  winch: { keys: ['KeyE'], gamepad: ['X'], touch: 'WINCH' },
  flare: { keys: ['KeyQ'], gamepad: ['LB'], touch: 'FLARES' },
  nextWeapon: { gamepad: ['RB'] },
  weapon1: { keys: ['Digit1', 'Numpad1'] },
  weapon2: { keys: ['Digit2', 'Numpad2'] },
  weapon3: { keys: ['Digit3', 'Numpad3'] },
  map: { keys: ['KeyM'], gamepad: ['Back'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { gamepad: ['B'] },
};

kit = await boot({
  title: 'BRICKHAWK',
  canvas: $('world'),
  gear: 'none',
  accent: '#ddf47c',
  background: '#10292e',
  input: ACTIONS,
});
input = kit.input;
kit.loading.progress(0.7, 'Building the delta…');
R = new BrickRenderer(kit);
cacheHud();
worldBuild();
maxParticles = kit.detail(230, 90);
kit.onQuality(() => (maxParticles = kit.detail(230, 90)));
setupMission(options.op);
bindUI();
initTouchLabels();
selectOp(options.op);
updateSettings();
refreshMenu();
setTouch(false);
applySource(input.source);
input.onSourceChange(applySource);
kit.onPause((paused) => AudioSys.hold(paused || document.hidden));
$('backendLabel').textContent = kit.backendLabel.toUpperCase() + ' · EST. 2087';
G.camX = HOME.x - 25 * SQ;
G.camZ = HOME.z + 25 * SQ;
G.camY = 2;
R.aim(G.camX, G.camY, G.camZ, 75);
kit.loading.progress(0.85, 'Warming up the rotors…');
R.begin();
worldDynamic(0);
await R.warm();
window.Brickhawk = {
  version: '2.0.0',
  snapshot: () => ({
    state: G.state,
    op: G.op,
    phase: G.phase,
    radars: G.radars,
    convoy: { killed: G.convoyKilled, escaped: G.convoyEscaped },
    pylons: G.pylons,
    cargo: player.cargo,
    delivered: G.delivered,
    armor: player.hp,
    fuel: player.fuel,
    ammo: player.ammo.map(Math.floor),
    time: G.elapsed,
    timeLeft: G.timeLeft,
    enemies: G.enemies.filter((e) => e.alive).length,
    score: G.score,
    difficulty: G.difficulty,
    quality: kit.tier.name,
    backend: kit.backend,
  }),
  performance: () => ({
    drawCalls: R.stats.calls,
    triangles: R.stats.triangles,
    renderSize: [kit.canvas.width, kit.canvas.height],
    fps: window.__kit?.fps,
  }),
};
kit.start(frame);
focusDefault($('menu'));
