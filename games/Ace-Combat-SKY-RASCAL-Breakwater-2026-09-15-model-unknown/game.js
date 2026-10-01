/* SKY RASCAL: BREAKWATER
   Original game, models and sound by OpenAI. Ported to the shared 3D stack: three.js r186
   (WebGPU with a WebGL2 fallback) through kit/boot.js. The original flat-lit shading, view-dependent
   haze, animated water, sky, retro dither and PS1-style vertex snapping are TSL node materials, so
   both backends draw the same picture. All distances are in world meters. */
import * as THREE from 'three/webgpu';
import * as T from 'three/tsl';
import { boot } from 'kit/boot.js';
import { vertexSnap } from 'kit/retro.js';

// The first release wrote raw colour values straight to the screen: no colour management, linear output.
THREE.ColorManagement.enabled = false;

// ---------------------------------------------------------------- math helpers (world arrays [x, y, z])
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const damp = (a, b, s, dt) => mix(a, b, 1 - Math.exp(-s * dt));
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerpV = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const approachAngle = (a, b, s, dt) => a + clamp(angleDiff(b, a), -s * dt, s * dt);
const forward = (yaw, pitch = 0) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
const rgb = (h) => (typeof h === 'number' ? [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255] : h);
const colorMul = (c, s) => rgb(c).map((v) => clamp(v * s, 0, 1));
const hash = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let a = x - ix, b = z - iz;
  a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b);
  return mix(mix(hash(ix, iz), hash(ix + 1, iz), a), mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), a), b);
}
let seed = 17;
function rand() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
function choice(a) { return a[Math.floor(rand() * a.length)]; }
const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');

/** The game's model matrix (column-major, three.js layout): basis r, u, -f scaled, then the position. */
function setModel(o, pos, yaw = 0, pitch = 0, roll = 0, scale = 1) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fx = sy * cp, fy = sp, fz = -cy * cp;
  const u0x = -sy * fy, u0y = sy * fx - cy * fz, u0z = cy * fy;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const rx = cy * cr - u0x * sr, ry = -u0y * sr, rz = sy * cr - u0z * sr;
  const ux = cy * sr + u0x * cr, uy = u0y * cr, uz = sy * sr + u0z * cr;
  o[0] = rx * scale; o[1] = ry * scale; o[2] = rz * scale; o[3] = 0;
  o[4] = ux * scale; o[5] = uy * scale; o[6] = uz * scale; o[7] = 0;
  o[8] = -fx * scale; o[9] = -fy * scale; o[10] = -fz * scale; o[11] = 0;
  o[12] = pos[0]; o[13] = pos[1]; o[14] = pos[2]; o[15] = 1;
  return o;
}
const matrix = (pos, yaw, pitch, roll, scale) => setModel(new Float32Array(16), pos, yaw, pitch, roll, scale);
function transform(p, m) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
function segmentDistance(a, b, p) { const ab = sub(b, a), t = clamp(dot(sub(p, a), ab) / (dot(ab, ab) || 1), 0, 1); return dist(add(a, mul(ab, t)), p); }

// ---------------------------------------------------------------- missions
const HALYARD = [-700, 150, 4050]; // the friendly carrier moored south of the coast
const MISSIONS = [
  {
    id: 'breakwater', code: '01', op: 'OPERATION BREAKWATER', name: 'PORT MERIDIAN', limit: 360, minutes: 'six', palette: 'day', seed: 23,
    bestKey: 'sky-rascal-best', tag: 'COASTAL RAID → AIR SUPERIORITY',
    route: ['Destroy the coastal radar sites.', 'Stop the bomber flight.', 'Face the enemy ace.'],
    ranks: { S: 10800, A: 8500, B: 6500, hull: 65 },
    phases: [
      { title: 'CLEAR THE COAST', unit: 'RADAR', kind: 'radar', count: 3, lines: [['control', 'Radar site confirmed down. Two remain.'], ['control', 'One radar site remains. Keep the pressure on.']] },
      { title: 'STOP THE BOMBERS', unit: 'BOMBERS', kind: 'bomber', count: 3, lines: [['wing', 'One bomber down. Two more to go.'], ['wing', 'That is two. Do not let the last one through.']] },
      { title: 'TAKE DOWN RED KITE', unit: 'ACE', kind: 'ace', count: 1, lines: [] },
    ],
    chatter: [
      [['wing', 'Red boxes mark the main targets. The radar will keep you on course.'], ['wing', 'Use the brake for a tighter turn. I will keep an eye on the port.']],
      [['control', 'The bombers are closing on the port. Make them your priority.']],
      [['ace', 'You can turn. Let us see if you can keep up.'], ['ace', 'There is still room for one of us in this sky.']],
    ],
    opening() {
      banner('OPERATION BREAKWATER', 'PORT MERIDIAN / WEAPONS FREE', 4);
      say('control', 'Rascal 1, weapons free. Destroy the three radar sites.', 5, true);
      say('wing', 'I have your wing. Keep the target near the center. Wait for LOCK, then fire.', 6);
    },
    setup() {
      groundEnemy('radar', -1650, -720); groundEnemy('radar', -160, -2460); groundEnemy('radar', 1900, -4380);
      groundEnemy('sam', -1300, -400); groundEnemy('sam', -400, -2700); groundEnemy('sam', 2080, -3960);
      newEnemy('fighter', [-3100, 1030, -2900], { yaw: 0.5, speed: 165, primary: false });
      newEnemy('fighter', [1000, 1170, -5500], { yaw: Math.PI, speed: 180, primary: false });
    },
    advance(from) {
      if (from === 1) {
        const spawnZ = Math.min(-11500, player.p[2] - 7000);
        for (let i = 0; i < 3; i++) {
          const p = [-1400 + i * 760, 1350 + i * 150, Math.max(-14400, spawnZ - i * 540)];
          const dest = [3400, 950, -2950], delta = sub(dest, p);
          newEnemy('bomber', p, { yaw: Math.atan2(delta[0], -delta[2]), speed: 83 + i * 3, destination: dest, fire: 99 });
        }
        banner('MISSION UPDATE', 'INTERCEPT THE BOMBERS / PROTECT THE PORT', 4.3);
        say('control', 'Three bombers inbound from the north. Stop them before they reach the port.', 6, true);
        say('wing', 'Those are heavy targets. Put two missiles into each one.', 5);
        targetId = null; selectTarget(); sfx('warning');
      } else {
        const f = forward(player.yaw, 0), right = [Math.cos(player.yaw), 0, Math.sin(player.yaw)];
        const p = add(player.p, add(mul(f, 2300), mul(right, 1800)));
        p[1] = Math.max(850, player.p[1] + 150);
        const ace = newEnemy('ace', p, { yaw: player.yaw - Math.PI / 2, speed: 245, fire: 2, callsign: 'RED KITE', voice: 'ace', pronoun: 'him' });
        aceList = [ace];
        banner('ENEMY ACE', 'RED KITE / INBOUND', 4);
        say('control', 'New contact, closing fast. Callsign Red Kite. Stay sharp.', 5.2, true);
        say('ace', 'You made quite a mess of my coast. Let us settle this in the air.', 5.5);
        focusTarget(ace); sfx('warning');
      }
    },
    win: { reason: 'Port Meridian is safe. Not bad for a small jet.', banner: ['MISSION COMPLETE', 'PORT MERIDIAN / AIRSPACE SECURED'], radio: 'All threats cleared. Port Meridian is safe. Come home, Rascal 1.' },
  },
  {
    id: 'undertow', code: '02', op: 'OPERATION UNDERTOW', name: 'HARBOR MOUTH', limit: 420, minutes: 'seven', palette: 'dusk', seed: 41,
    bestKey: 'sky-rascal-best-undertow', tag: 'NAVAL STRIKE → CARRIER DEFENSE / DUSK', protect: HALYARD,
    route: ['Sink the three blockade frigates.', 'Shield the carrier Halyard.', 'Break the Red Kite pair.'],
    ranks: { S: 14500, A: 11500, B: 9000, hull: 60 },
    phases: [
      { title: 'BREAK THE BLOCKADE', unit: 'FRIGATES', kind: 'frigate', count: 3, lines: [['control', 'Frigate going under. Two remain.'], ['control', 'One frigate left. Finish the blockade.']] },
      { title: 'SHIELD THE HALYARD', unit: 'STRIKERS', kind: 'striker', count: 4, lines: [['wing', 'One striker down. Three left.'], ['wing', 'Two down. Keep after them.'], ['control', 'One striker left. It is all on you, Rascal 1.']] },
      { title: 'BREAK THE KITE PAIR', unit: 'ACES', kind: 'ace', count: 2, lines: [] },
    ],
    chatter: [
      [['wing', 'Frigates turn slowly. Come in from the stern and stay out of their arcs.'], ['wing', 'Watch the water line. Their missiles come up fast.']],
      [['control', 'Strikers are still inbound. The Halyard has no cover but you.']],
      [['ace', 'You took my coast. The water is ours.'], ['ace2', 'Kite, he is on my six. Shake him loose.'], ['ace2', 'Two of us, one of you. Do the math.']],
    ],
    opening() {
      banner('OPERATION UNDERTOW', 'HARBOR MOUTH / WEAPONS FREE', 4);
      say('control', 'Rascal 1, the sun is going down and so is their blockade. Sink the three frigates at the harbor mouth.', 6, true);
      say('wing', 'Frigates shoot back. Stay above the water and keep moving.', 5);
    },
    setup() {
      newFrigate(-3200, -3000, 450, 1, 0);
      newFrigate(700, -1300, 380, -1, 2.1);
      newFrigate(-1200, -6200, 420, 1, 4.2);
      newEnemy('fighter', [-3600, 1100, -4200], { yaw: 0.9, speed: 170, primary: false });
      newEnemy('fighter', [600, 1250, -3600], { yaw: Math.PI * 0.8, speed: 175, primary: false });
    },
    advance(from) {
      if (from === 1) {
        const lanes = [[-10500, 2200], [-10800, 3300], [-12600, 2700], [-12900, 3900]];
        lanes.forEach(([x, z], i) => {
          const p = [x, 430 + i * 25, z], delta = sub(HALYARD, p);
          // Primary: they are the objective, so the HUD tags them and auto-targeting prefers them.
          newEnemy('striker', p, { yaw: Math.atan2(delta[0], -delta[2]), speed: 140 + i * 3, destination: HALYARD, fire: 99, warned: false, primary: true });
        });
        banner('MISSION UPDATE', 'STRIKERS INBOUND / SHIELD THE HALYARD', 4.3);
        say('control', 'Four strike jets coming in low from the west. They are going for the carrier Halyard.', 6, true);
        say('wing', 'They will not turn to fight. Run them down before they reach the ship.', 5);
        targetId = null; selectTarget(); sfx('warning');
      } else {
        const f = forward(player.yaw, 0), right = [Math.cos(player.yaw), 0, Math.sin(player.yaw)];
        const p1 = add(player.p, add(mul(f, 2300), mul(right, 1800)));
        const p2 = add(player.p, add(mul(f, 2600), mul(right, -1900)));
        p1[1] = Math.max(850, player.p[1] + 150);
        p2[1] = Math.max(900, player.p[1] + 260);
        const kite = newEnemy('ace', p1, { yaw: player.yaw - Math.PI / 2, speed: 245, fire: 2, callsign: 'RED KITE', voice: 'ace', pronoun: 'him' });
        const wren = newEnemy('ace', p2, { yaw: player.yaw + Math.PI / 2, speed: 255, fire: 5, hp: 650, maxhp: 650, fireEvery: 9, callsign: 'ASH WREN', voice: 'ace2', pronoun: 'her', model: 'ace2' });
        aceList = [kite, wren];
        banner('TWO ACES', 'RED KITE + ASH WREN / INBOUND', 4.2);
        say('control', 'Two contacts, high and fast. Red Kite brought a wingman.', 5, true);
        say('ace', 'Ash Wren flies with me tonight. You will not get lucky twice.', 5.5);
        say('ace2', 'Stay close, Kite. This one bites.', 4.5);
        focusTarget(kite); sfx('warning');
      }
    },
    onAceDown(e) {
      if (e.callsign === 'RED KITE') say('ace2', 'Kite! ...You will pay for that, Rascal.', 4.5, true);
      else say('ace', 'Wren is out. Fine. Just you and me again.', 4.5, true);
    },
    win: { reason: 'The blockade is broken and the Halyard is safe. Not bad for a small jet at sundown.', banner: ['MISSION COMPLETE', 'HARBOR MOUTH / BLOCKADE BROKEN'], radio: 'The blockade is broken and the Halyard is safe. Good hunting, Rascal 1.' },
  },
];

// ---------------------------------------------------------------- saved settings and records
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
let muted = false, musicOn = true, volume = 0.55, retro = true, mouseMode = false, expert = false, invertPitch = false, selectedMission = 0;
try {
  const s = JSON.parse(store.get('sky-rascal-settings', '{}')) || {};
  muted = !!(s.muted ?? false); musicOn = !!(s.musicOn ?? true); retro = !!(s.retro ?? true);
  volume = clamp(Number.isFinite(+s.volume) ? +s.volume : 0.55, 0, 1);
  expert = !!s.expert; mouseMode = !!s.mouseMode; invertPitch = !!s.invertPitch;
  selectedMission = clamp(s.mission | 0, 0, MISSIONS.length - 1);
} catch { /* first flight */ }
function saveSettings() { store.set('sky-rascal-settings', JSON.stringify({ muted, musicOn, retro, volume, expert, mouseMode, invertPitch, mission: selectedMission })); }
const bests = {};
for (const m of MISSIONS) bests[m.id] = +store.get(m.bestKey, 0) || 0;
let ranks = {};
try { ranks = JSON.parse(store.get('sky-rascal-ranks', '{}')) || {}; } catch { ranks = {}; }

// ---------------------------------------------------------------- boot
let W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 2), time = 0;
const retroLines = () => Math.max(1, Math.min(540, Math.round(H * 0.8)));

const kit = await boot({
  title: 'SKY RASCAL — Breakwater',
  canvas: $('view'),
  gear: 'none', // the menu and the pause screen carry SETTINGS buttons; F9 also opens the panel
  accent: '#d7f6a4',
  background: '#0a171c',
  pixelHeight: retro ? retroLines() : 0,
  renderer: retro ? { antialias: false } : undefined,
  touch: { top: 'left', topOffset: 96 },
  input: {
    fly: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick', clamp: false },
    missile: { keys: ['Space'], mouse: [2], gamepad: ['A'], touch: 'Missile' },
    gun: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Gun' },
    boost: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['RB'], touch: 'Boost' },
    brake: { keys: ['KeyX', 'KeyK'], gamepad: ['LT'], touch: 'Brake' },
    flare: { keys: ['KeyF'], gamepad: ['B'], touch: 'Flares' },
    target: { keys: ['Tab', 'KeyT'], gamepad: ['Y'], touch: { label: 'Target', slot: 'top' } },
    view: { keys: ['KeyC'], gamepad: ['RS', 'Back'], touch: { label: 'View', slot: 'top' } },
    roll: { gamepad: ['LB'], touch: { label: 'Roll', slot: 'top' } },
    rollLeft: { keys: ['KeyQ'] },
    rollRight: { keys: ['KeyE'] },
    mouseFlight: { keys: ['KeyM'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    // The game's own menus.
    nav: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});
const { input, renderer } = kit;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
kit.touch?.suspend(true, 'game');
const tick = () => new Promise((r) => setTimeout(r, 0));
kit.loading.progress(0.62, 'Checking flight systems…');
await tick();

// ---------------------------------------------------------------- scene, camera and the shading nodes
const scene = new THREE.Scene();
const camera = kit.fitCamera(new THREE.PerspectiveCamera(58, W / H, 1, 40000));
const cam = { p: [-2340, 860, 3000], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0], fov: 58 * DEG, tan: Math.tan(29 * DEG), aspect: W / H, ready: false };

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]).normalize();
const col3 = (a) => new THREE.Color(a[0], a[1], a[2]);
const U = {
  time: T.uniform(0),
  retro: T.uniform(retro ? 1 : 0),
  ambient: T.uniform(0.59), diffuse: T.uniform(0.61),
  lightDir: T.uniform(v3([-0.55, 0.82, 0.18])),
  tint: T.uniform(col3([1, 1, 1])),
  fogNear: T.uniform(2600), fogFar: T.uniform(18500),
  hazeA: T.uniform(col3([0.48, 0.59, 0.62])), hazeB: T.uniform(col3([0.78, 0.64, 0.5])), hazeSun: T.uniform(v3([-0.48, 0.1, -0.88])),
  water: T.uniform(col3([0.075, 0.245, 0.291])), waterGrain: T.uniform(col3([0.026, 0.037, 0.035])), glint: T.uniform(col3([0.64, 0.39, 0.18])), sparkle: T.uniform(col3([0.14, 0.25, 0.24])),
  horizon: T.uniform(col3([0.76, 0.65, 0.54])), zenith: T.uniform(col3([0.1, 0.27, 0.39])), sunGlow: T.uniform(col3([0.24, 0.08, -0.02])),
  sunDisc: T.uniform(col3([1, 0.83, 0.5])), cloud: T.uniform(col3([0.81, 0.7, 0.6])), below: T.uniform(col3([0.5, 0.6, 0.61])), skySun: T.uniform(v3([-0.48, 0.11, -0.88])),
};
const PALETTES = {
  day: {
    horizon: [0.76, 0.65, 0.54], zenith: [0.1, 0.27, 0.39], sunGlow: [0.24, 0.08, -0.02], sunDisc: [1, 0.83, 0.5], cloud: [0.81, 0.7, 0.6], below: [0.5, 0.6, 0.61], skySun: [-0.48, 0.11, -0.88],
    hazeA: [0.48, 0.59, 0.62], hazeB: [0.78, 0.64, 0.5], hazeSun: [-0.48, 0.1, -0.88], ambient: 0.59, diffuse: 0.61, tint: [1, 1, 1],
    water: [0.075, 0.245, 0.291], waterGrain: [0.026, 0.037, 0.035], glint: [0.64, 0.39, 0.18], sparkle: [0.14, 0.25, 0.24], fogNear: 2600, fogFar: 18500,
  },
  dusk: {
    horizon: [0.86, 0.5, 0.38], zenith: [0.06, 0.11, 0.24], sunGlow: [0.42, 0.13, 0.02], sunDisc: [1, 0.68, 0.36], cloud: [0.7, 0.42, 0.38], below: [0.3, 0.33, 0.4], skySun: [-0.48, 0.045, -0.88],
    hazeA: [0.33, 0.35, 0.44], hazeB: [0.86, 0.5, 0.36], hazeSun: [-0.48, 0.04, -0.88], ambient: 0.5, diffuse: 0.5, tint: [1, 0.86, 0.78],
    water: [0.05, 0.15, 0.21], waterGrain: [0.024, 0.03, 0.034], glint: [0.92, 0.42, 0.16], sparkle: [0.2, 0.22, 0.26], fogNear: 2200, fogFar: 16500,
  },
};
let paletteName = '';
function applyPalette(name) {
  const p = PALETTES[name] || PALETTES.day;
  if (paletteName === name) return;
  paletteName = name;
  for (const k of ['horizon', 'zenith', 'sunGlow', 'sunDisc', 'cloud', 'below', 'hazeA', 'hazeB', 'tint', 'water', 'waterGrain', 'glint', 'sparkle']) U[k].value.setRGB(p[k][0], p[k][1], p[k][2]);
  U.skySun.value.set(...p.skySun).normalize();
  U.hazeSun.value.set(...p.hazeSun).normalize();
  U.ambient.value = p.ambient; U.diffuse.value = p.diffuse;
  U.fogNear.value = p.fogNear; U.fogFar.value = p.fogFar;
}

// Retro look: a 2×2 ordered dither down to a few dozen levels (the original's exact formula).
function retroColor(col, levels) {
  const bias = T.mod(T.screenCoordinate.x, 2).mul(2).add(T.mod(T.screenCoordinate.y, 2)).mul(0.24);
  return T.mix(col, col.mul(levels).add(bias).floor().div(levels), U.retro);
}
// Distance haze that warms toward the sun, then the dither: every world surface ends here.
function shadeFinish(col) {
  const toFrag = T.positionWorld.sub(T.cameraPosition);
  const fog = T.smoothstep(U.fogNear, U.fogFar, toFrag.length());
  const haze = T.mix(U.hazeA, U.hazeB, toFrag.normalize().dot(U.hazeSun).max(0).pow(3));
  return T.vec4(retroColor(T.mix(col, haze, fog), 42), 1);
}
const snapGrid = T.uniform(new THREE.Vector2(480, 270));
function worldMaterial(name, colorNode) {
  // The original renderer never culled faces and flipped normals on back faces: DoubleSide does both.
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
  m.name = name;
  m.colorNode = colorNode;
  vertexSnap(m, { grid: snapGrid });
  return m;
}
// Lit: vertex colour × (0.59 ambient + 0.61 sun), as the original world shader.
const litMat = worldMaterial('lit', (() => {
  const light = U.ambient.add(T.normalWorld.dot(U.lightDir).max(0).mul(U.diffuse));
  return shadeFinish(T.attribute('color', 'vec3').mul(light).mul(U.tint));
})());
// Unlit: flames, trails, tracers, wakes.
const unlitMat = worldMaterial('unlit', shadeFinish(T.attribute('color', 'vec3')));
// Water: grain, slow swell, sun glint and sparkles in world space.
const waterMat = worldMaterial('water', (() => {
  const rnd = (p) => T.sin(p.dot(T.vec2(127.1, 311.7))).mul(43758.5453).fract();
  const p = T.positionWorld.xz;
  const grain = rnd(p.div(T.vec2(22, 7)).floor());
  const waves = T.sin(p.y.mul(0.046).add(U.time.mul(0.65))).mul(T.sin(p.x.mul(0.013).add(U.time.mul(0.1))));
  const d = T.positionWorld.sub(T.cameraPosition).length();
  const reflection = T.vec2(-0.48, -0.88).normalize().dot(p.sub(T.cameraPosition.xz).normalize()).max(0).pow(75);
  const gleam = T.step(0.92, grain).mul(T.sin(p.y.mul(0.07).add(U.time.mul(1.1))).max(0));
  const base = U.water.add(U.waterGrain.mul(grain)).add(waves.mul(0.011));
  const glint = U.glint.mul(reflection).mul(gleam.mul(0.58).add(0.09)).mul(T.smoothstep(200, 7000, d));
  const sparkle = U.sparkle.mul(T.step(0.997, grain)).mul(T.sin(U.time.add(p.x)).mul(0.6).add(0.4));
  return shadeFinish(base.add(glint).add(sparkle));
})());
// Sky: horizon-to-zenith gradient, sun glow and disc, drifting cloud bands (scene background).
scene.backgroundNode = T.Fn(() => {
  const ray = T.positionWorldDirection;
  const height = T.clamp(ray.y, 0, 1);
  const col = T.mix(U.horizon, U.zenith, height.pow(0.46)).toVar();
  const angle = ray.dot(U.skySun);
  col.addAssign(U.sunGlow.mul(angle.max(0).pow(22)));
  col.assign(T.mix(col, U.sunDisc, T.smoothstep(0.99924, 0.99932, angle)));
  const uv = ray.xz.div(ray.y.max(0.03));
  const c = T.sin(uv.x.mul(0.6).add(uv.y.mul(0.35)).add(U.time.mul(0.004))).add(T.sin(uv.y.mul(0.8).sub(uv.x.mul(0.13))).mul(0.55)).add(T.sin(uv.x.mul(1.8)).mul(0.22));
  const band = T.smoothstep(1.15, 1.55, c).mul(T.smoothstep(0.015, 0.09, ray.y)).mul(T.smoothstep(0.19, 0.41, ray.y).oneMinus());
  col.assign(T.mix(col, U.cloud, band.mul(0.43)));
  col.assign(T.mix(col, U.below, T.clamp(ray.y.negate().mul(6), 0, 1)));
  return T.vec4(retroColor(col, 50), 1);
})();

// ---------------------------------------------------------------- the original mesh builder
class Builder {
  constructor() { this.a = []; }
  vertex(p, n, c) { this.a.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2]); }
  tri(a, b, c, col, n = null) { n = n || norm(cross(sub(b, a), sub(c, a))); col = rgb(col); this.vertex(a, n, col); this.vertex(b, n, col); this.vertex(c, n, col); return this; }
  quad(a, b, c, d, col, n = null) { this.tri(a, b, c, col, n); this.tri(a, c, d, col, n); return this; }
  box(x, y, z, w, h, d, col) {
    const a = [x - w / 2, y - h / 2, z - d / 2], b = [x + w / 2, y + h / 2, z + d / 2];
    this.quad([a[0], a[1], a[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], a[1], a[2]], col, [0, 0, -1]);
    this.quad([a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]], col, [0, 0, 1]);
    this.quad([a[0], b[1], a[2]], [a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], b[1], a[2]], col, [0, 1, 0]);
    this.quad([a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]], col, [0, -1, 0]);
    this.quad([a[0], a[1], a[2]], [a[0], a[1], b[2]], [a[0], b[1], b[2]], [a[0], b[1], a[2]], col, [-1, 0, 0]);
    this.quad([b[0], a[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [b[0], a[1], b[2]], col, [1, 0, 0]);
    return this;
  }
  tube(a, b, r1, r2, col, sides = 6) {
    const v = norm(sub(b, a)), u = norm(cross(v, Math.abs(v[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), w = cross(v, u);
    for (let i = 0; i < sides; i++) {
      const t = (i / sides) * TAU, t2 = ((i + 1) / sides) * TAU;
      const d1 = add(mul(u, Math.cos(t)), mul(w, Math.sin(t))), d2 = add(mul(u, Math.cos(t2)), mul(w, Math.sin(t2)));
      const p1 = add(a, mul(d1, r1)), p2 = add(a, mul(d2, r1)), p3 = add(b, mul(d2, r2)), p4 = add(b, mul(d1, r2));
      this.quad(p1, p2, p3, p4, col); this.tri(a, p2, p1, col, mul(v, -1)); this.tri(b, p4, p3, col, v);
    }
    return this;
  }
  octa(p, s, col) {
    const a = add(p, [s, 0, 0]), b = add(p, [0, 0, s]), c = add(p, [-s, 0, 0]), d = add(p, [0, 0, -s]), top = add(p, [0, s, 0]), bot = add(p, [0, -s, 0]);
    this.tri(top, b, a, col).tri(top, c, b, col).tri(top, d, c, col).tri(top, a, d, col).tri(bot, a, b, col).tri(bot, b, c, col).tri(bot, c, d, col).tri(bot, d, a, col);
    return this;
  }
  /** Interleaved [position, normal, colour] → a three.js geometry. */
  geometry() {
    const a = this.a, n = a.length / 9;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0, j = 0, k = 0; i < n; i++, j += 9, k += 3) {
      pos[k] = a[j]; pos[k + 1] = a[j + 1]; pos[k + 2] = a[j + 2];
      nor[k] = a[j + 3]; nor[k + 1] = a[j + 4]; nor[k + 2] = a[j + 5];
      col[k] = a[j + 6]; col[k + 1] = a[j + 7]; col[k + 2] = a[j + 8];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    this.a = [];
    return g;
  }
}
function staticMesh(builder, material = litMat) {
  const m = new THREE.Mesh(builder.geometry(), material);
  m.matrixAutoUpdate = false;
  m.updateMatrix();
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------- terrain and the coast
// A long urban coast, three radar islands, and a mountainous western chain.
const islands = [[-1750, -650, 1050, 142], [-250, -2500, 900, 116], [950, -4250, 640, 67], [-5900, -5800, 2700, 1200], [-8200, -8000, 2100, 830], [-4400, -8400, 1700, 540], [-5400, 1800, 1650, 480], [-1000, -10200, 2100, 370], [-6000, 5400, 1250, 390], [1300, 3700, 850, 160]];
function terrainHeight(x, z) {
  let h = -30;
  const coast = 1800 + 370 * Math.sin(z * 0.00065) + 220 * Math.sin(z * 0.0017);
  if (x > coast && z < 4200 && z > -15700) {
    const d = x - coast;
    const ramp = clamp(d / 220, 0, 1);
    h = mix(-12, 32, ramp);
    const hill = clamp((x - 5700) / 2400, 0, 1);
    h += hill * (280 + 1100 * noise(x * 0.0004, z * 0.0004)) * clamp(d / 700, 0, 1);
    h -= Math.max(0, z - 2800) * 0.035;
  }
  for (const [ix, iz, r, peak] of islands) {
    const rr = Math.hypot(x - ix, (z - iz) * 1.14) / r;
    if (rr < 1.09) { const n = noise(x * 0.0016, z * 0.0016); const hh = (1 - rr) * peak * (0.75 + n * 0.55) - 15; h = Math.max(h, hh); }
  }
  return h;
}
const groundY = (x, z) => Math.max(0, terrainHeight(x, z));
const collisionBoxes = [];
function solidBox(b, x, y, z, w, h, d, c, collide = true) { b.box(x, y + h / 2, z, w, h, d, c); if (collide) collisionBoxes.push({ x, y, z, w: w * 0.47, d: d * 0.47, top: y + h }); }
function terrainBuilder() {
  const b = new Builder(), step = 155;
  for (let x = -13330; x < 13950; x += step) for (let z = -15965; z < 9610; z += step) {
    const ps = [[x, terrainHeight(x, z), z], [x + step, terrainHeight(x + step, z), z], [x + step, terrainHeight(x + step, z + step), z + step], [x, terrainHeight(x, z + step), z + step]];
    if (Math.max(ps[0][1], ps[1][1], ps[2][1], ps[3][1]) < -5) continue;
    for (const ids of [[0, 3, 1], [1, 3, 2]]) {
      const t = ids.map((i) => ps[i]), av = (t[0][1] + t[1][1] + t[2][1]) / 3;
      let c = av < 9 ? 0x9b9980 : av < 65 ? 0x68786a : av < 230 ? 0x596956 : av < 550 ? 0x54665d : 0x778481;
      c = colorMul(c, 0.88 + hash(x + ids[0], z) * 0.22);
      b.tri(t[0], t[1], t[2], c);
    }
  }
  return b;
}
function crane(b, x, y, z) {
  const col = 0xb67e52;
  for (const zz of [-29, 29]) for (const xx of [-25, 25]) b.box(x + xx, y + 42, z + zz, 7, 84, 7, col);
  b.box(x, y + 84, z, 68, 11, 73, col); b.box(x - 24, y + 112, z, 12, 52, 10, col); b.box(x - 83, y + 121, z, 200, 9, 9, col);
  b.tube([x - 24, y + 138, z], [x - 179, y + 121, z], 1.3, 1.3, 0xc0ab85, 4); b.tube([x - 154, y + 121, z], [x - 154, y + 43, z], 1, 1, 0x343e40, 3); b.box(x - 150, y + 42, z, 22, 5, 8, 0x636f68);
}
function bakeInto(b, temp, p, yaw) {
  const m = matrix(p, yaw);
  for (let i = 0; i < temp.a.length; i += 9) {
    const pos = transform([temp.a[i], temp.a[i + 1], temp.a[i + 2]], m), n = [temp.a[i + 3], temp.a[i + 4], temp.a[i + 5]];
    const nn = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]];
    b.vertex(pos, nn, [temp.a[i + 6], temp.a[i + 7], temp.a[i + 8]]);
  }
}
function buildShip(b, p, yaw, carrier) {
  const temp = new Builder(), l = carrier ? 245 : 175, w = carrier ? 63 : 38, co = carrier ? 0x666f71 : 0x604f47;
  temp.box(0, 10, 0, w, 20, l * 0.82, co);
  temp.tri([-w / 2, 20, -l * 0.41], [w / 2, 20, -l * 0.41], [0, 20, -l * 0.6], 0x9a9c8c, [0, 1, 0]);
  temp.tri([-w / 2, 0, -l * 0.41], [-w / 2, 20, -l * 0.41], [0, 20, -l * 0.6], co);
  temp.tri([w / 2, 20, -l * 0.41], [w / 2, 0, -l * 0.41], [0, 20, -l * 0.6], co);
  temp.box(0, 21, 0, w + 6, 3, l * 0.84, 0x727c76);
  if (carrier) {
    temp.box(w * 0.34, 34, 25, 18, 25, 65, 0x8a968f); temp.box(w * 0.34, 53, 32, 20, 18, 25, 0x9caaa0); temp.tube([w * 0.34, 61, 25], [w * 0.34, 91, 25], 1.4, 0.8, 0xc3c9b4, 4); temp.box(-5, 23.3, 0, 2, 0.5, 170, 0xe2d6b7);
    for (let z = -65; z < 80; z += 25) { temp.box(-23, 23.4, z, 5, 0.5, 2, 0xdbd4bc); temp.box(17, 23.4, z, 5, 0.5, 2, 0xdbd4bc); }
  } else {
    temp.box(0, 35, l * 0.26, w * 0.75, 27, 30, 0xb5b0a0); temp.box(0, 55, l * 0.26, w * 0.7, 12, 26, 0x6e8687);
    for (let i = 0; i < 5; i++) temp.box(0, 28, -50 + i * 22, w * 0.7, 11, 17, choice([0x9d6b43, 0x4d7774, 0xa6a190]));
  }
  bakeInto(b, temp, p, yaw);
}
function buildWorld() {
  const b = new Builder(), d = new Builder(), br = new Builder();
  // Urban blocks, asphalt roads, low concrete warehouses, and stepped office towers.
  for (let x = 2430; x <= 6070; x += 260) for (let z = -8360; z <= -3160; z += 260) {
    if (terrainHeight(x, z) < 22) continue;
    const y = groundY(x, z) + 1;
    d.box(x, y, z, 256, 1, 256, 0x424f4e);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      if (rand() < 0.18) continue;
      const px = x + (i - 0.5) * 116, pz = z + (j - 0.5) * 118, py = groundY(px, pz);
      const core = Math.max(0, 1 - Math.hypot((px - 4100) * 0.85, pz + 6100) / 2200);
      const h = 30 + rand() * 95 + core * core * rand() * 380;
      const w = 49 + rand() * 45, dep = 50 + rand() * 42, c = choice([0x8d9592, 0x7e9093, 0x939b95, 0x75888e, 0xa6a89a, 0x6d828a]);
      solidBox(b, px, py, pz, w, h, dep, c);
      if (h > 190) { solidBox(b, px, py + h, pz, w * 0.68, 16 + rand() * 38, dep * 0.65, colorMul(c, 0.86)); if (rand() > 0.35) d.tube([px, py + h + 20, pz], [px, py + h + 75, pz], 1.4, 0.8, 0xb4bdb1, 4); }
      else if (rand() > 0.55) b.box(px + 8, py + h + 5, pz - 5, 17, 9, 19, 0x526565);
      for (let level = 15; level < h - 7; level += 18) {
        const cy = py + level, wc = level % 3 < 1 ? 0xb2b5a1 : 0x405d69;
        d.quad([px - w * 0.41, cy - 1.3, pz - dep / 2 - 0.35], [px - w * 0.41, cy + 1.3, pz - dep / 2 - 0.35], [px + w * 0.41, cy + 1.3, pz - dep / 2 - 0.35], [px + w * 0.41, cy - 1.3, pz - dep / 2 - 0.35], wc, [0, 0, -1]);
        d.quad([px - w / 2 - 0.35, cy - 1.3, pz - dep * 0.4], [px - w / 2 - 0.35, cy - 1.3, pz + dep * 0.4], [px - w / 2 - 0.35, cy + 1.3, pz + dep * 0.4], [px - w / 2 - 0.35, cy + 1.3, pz - dep * 0.4], wc, [-1, 0, 0]);
        if (h > 150) d.quad([px - w * 0.4, cy - 1.3, pz + dep / 2 + 0.35], [px + w * 0.4, cy - 1.3, pz + dep / 2 + 0.35], [px + w * 0.4, cy + 1.3, pz + dep / 2 + 0.35], [px - w * 0.4, cy + 1.3, pz + dep / 2 + 0.35], 0x49626d, [0, 0, 1]);
      }
    }
    if (hash(x, z) > 0.65) for (let n = -1; n < 2; n++) d.box(x + n * 75, y + 1.1, z + 129, 30, 0.6, 1.6, 0xb4b49a);
  }
  // Shore apron and three cargo piers.
  for (let z = -7600; z < -3500; z += 600) {
    const x = 1930 + 370 * Math.sin(z * 0.00065) + 220 * Math.sin(z * 0.0017), y = 19;
    solidBox(b, x, y - 18, z, 290, 20, 420, 0x777e72); solidBox(b, x - 195, 0, z, 350, 18, 130, 0x7d8478);
    for (let i = 0; i < 7; i++) {
      const cx = x - 100 + rand() * 200, cz = z - 150 + rand() * 300, co = choice([0x8b5042, 0x406b73, 0xa08252, 0x667674]);
      b.box(cx, y + 12, cz, 31, 22, 62, co);
      if (rand() > 0.5) b.box(cx, y + 32, cz, 31, 18, 62, colorMul(co, 1.15));
    }
    crane(d, x - 180, y, z + 38);
  }
  // Airfield at the northern edge of the city.
  const ay = 35;
  d.box(4450, ay, -9660, 1250, 5, 850, 0x5d7069); d.box(4450, ay + 3, -9660, 170, 2, 830, 0x414e50);
  for (let z = -10010; z < -9270; z += 90) d.box(4450, ay + 4.2, z, 7, 1, 40, 0xd1cbb1);
  for (let x = 4650; x < 5010; x += 100) solidBox(b, x, ay + 3, -9500, 75, 46, 140, 0x949b8d);
  solidBox(b, 4200, ay, -9480, 44, 90, 40, 0x6f8282); b.box(4200, ay + 95, -9480, 66, 18, 55, 0x345361);
  // Cable bridge. The navigable gap is real, with a one-time low-flight bonus.
  const z = -5070, start = -650, end = 2260, deck = 115;
  solidBox(br, (start + end) / 2, deck - 10, z, end - start, 12, 73, 0x727c74); d.box((start + end) / 2, deck + 2.5, z, end - start, 1, 55, 0x424d4e);
  for (let x = start + 30; x < end; x += 95) d.box(x, deck + 3.4, z, 44, 0.7, 2, 0xd8cdb0);
  for (const p of [120, 1510]) {
    for (const side of [-1, 1]) { solidBox(br, p, 0, z + side * 34, 26, 360, 20, 0xaaada0); solidBox(br, p - 54, deck - 2, z + side * 35, 14, 18, 14, 0x6a776d); }
    br.box(p, 307, z, 28, 19, 82, 0x9b9f91); br.box(p, 181, z, 28, 14, 82, 0x9b9f91);
  }
  for (const side of [-1, 1]) for (const [a, endx] of [[start, 120], [120, 1510], [1510, end]]) {
    const mid = (a + endx) / 2, span = endx - a;
    let last;
    for (let x = a; x <= endx + 1; x += span / 30) {
      const t = (x - a) / span;
      const y = a === 120 ? 175 + 175 * Math.pow((x - mid) / (span / 2), 2) : a === start ? mix(deck + 7, 350, t) : mix(350, deck + 7, t);
      const p = [x, y, z + side * 37];
      if (last) d.tube(last, p, 2.2, 2.2, 0xc4bdaa, 4);
      last = p;
      if (Math.round(t * 30) % 3 === 0) d.tube([x, deck + 8, z + side * 37], p, 1.15, 1.15, 0xc4bdaa, 3);
    }
  }
  for (const side of [-1, 1]) d.box((start + end) / 2, deck + 9, z + side * 35, end - start, 4, 2, 0xc4baa3);
  // Ships give the coast a readable sense of scale. The carrier is the Halyard.
  buildShip(b, [-700, 0, 4050], 0.17, true); buildShip(b, [750, 0, -6400], 0.4, false); buildShip(b, [150, 0, -6900], -0.2, false);
  // Simple land roads and radar foundations.
  for (const [x, zz] of [[-1650, -720], [-160, -2460], [1900, -4380]]) {
    const y = groundY(x, zz);
    d.box(x, y + 2, zz, 145, 4, 125, 0x838574);
    for (let i = 0; i < 3; i++) { const px = x + 110 + i * 45, pz = zz + 35; solidBox(b, px, groundY(px, pz), pz, 37, 20, 58, 0x798573); }
    d.tube([x - 70, y, zz + 50], [x - 70, y + 65, zz + 50], 1.5, 0.8, 0xc6bba1, 4);
  }
  staticMesh(b); staticMesh(d); staticMesh(br);
  const w = new Builder();
  w.quad([-38000, -0.7, -38000], [-38000, -0.7, 38000], [38000, -0.7, 38000], [38000, -0.7, -38000], 0x235765, [0, 1, 0]);
  staticMesh(w, waterMat);
}

// ---------------------------------------------------------------- aircraft, ground units and ships
// Low-poly aircraft. The Kestrel has a swept wing, twin fins, and twin engines.
function buildJet(body = 0xb6bdb9, accent = 0xcd5b3e, enemy = false) {
  const b = new Builder(), dark = enemy ? 0x273b43 : 0x3c515e;
  const sections = [[-23, 0.15, 0.18], [-17, 1.2, 1.05], [-8, 2.7, 1.8], [3, 4.0, 2.0], [12, 3.4, 1.5], [15, 2.6, 1.25]];
  const rings = sections.map(([z, w, h]) => [[0, h, z], [w * 0.77, h * 0.7, z], [w, 0, z], [w * 0.7, -h, z], [0, -h * 1.05, z], [-w * 0.7, -h, z], [-w, 0, z], [-w * 0.77, h * 0.7, z]]);
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < 8; k++) { const c = k > 1 && k < 6 ? colorMul(body, 0.72) : body; b.quad(rings[j][k], rings[j + 1][k], rings[j + 1][(k + 1) % 8], rings[j][(k + 1) % 8], c); }
  for (const side of [-1, 1]) {
    const p = (x, y, z) => [x * side, y, z];
    b.quad(p(3, 0.4, -7), p(24, 0.1, 7.8), p(22, 0.1, 11.3), p(4, 0.4, 7), body, [0, 1, 0]); b.quad(p(3, -0.15, -7), p(4, -0.15, 7), p(22, -0.3, 11.3), p(24, -0.3, 7.8), colorMul(body, 0.7), [0, -1, 0]);
    b.quad(p(3, 0.4, -7), p(3, -0.15, -7), p(24, -0.3, 7.8), p(24, 0.1, 7.8), colorMul(body, 0.87));
    b.quad(p(14, 0.2, 1.1), p(16, 0.2, 2.6), p(16, 0.2, 9.8), p(14, 0.2, 9.3), accent, [0, 1, 0]);
    b.quad(p(4, 1.1, 8), p(11.2, 0.6, 14.8), p(10.4, 0.6, 17.2), p(3.8, 1, 14.2), body, [0, 1, 0]);
    b.quad(p(4, 1.7, 3.5), p(6.7, 10.5, 9.7), p(6.2, 10.5, 12.8), p(4, 1.7, 14.7), body);
    b.quad(p(6.27, 8.5, 8.3), p(6.75, 10.55, 9.75), p(6.25, 10.55, 12.8), p(5.78, 8.5, 13.25), accent);
    b.tri(p(4.8, 4.3, 8.3), p(5.55, 6.7, 10.1), p(4.94, 4.3, 12.5), dark);
    b.tube(p(2.9, -0.55, 3.5), p(2.9, -0.55, 15.3), 1.8, 1.55, 0x5e6c70, 8); b.tube(p(2.9, -0.55, 14), p(2.9, -0.55, 16.2), 1.65, 1.5, 0x293b42, 8);
    b.box(side * 3, -1.1, -2.5, 2.1, 2.2, 5.5, dark);
    b.tube(p(9, -1.6, 1), p(9, -1.6, 8.5), 0.43, 0.43, 0xc7c7b5, 5); b.tube(p(9, -1.6, -1), p(9, -1.6, 1), 0.04, 0.43, 0xc7c7b5, 5);
    b.tri(p(8.1, -1.6, 6.3), p(9, -1.6, 5), p(9, -1.6, 8), 0xc7c7b5); b.tri(p(9.9, -1.6, 6.3), p(9, -1.6, 8), p(9, -1.6, 5), 0xc7c7b5);
    b.quad(p(4, 1.8, -2), p(7, 0.6, -0.1), p(9, 0.4, 2), p(4, 0.5, 2), colorMul(body, 1.09), [0, 1, 0]);
  }
  // Canopy: dark glass, pale frame, and a warm highlight.
  const a = [0, 2, -13], left = [-1.65, 2.1, -8], right = [1.65, 2.1, -8], top = [0, 4.15, -7.1], back = [0, 2.7, -2.4];
  b.tri(a, left, top, 0x29454f).tri(a, top, right, 0x36515a).tri(left, back, top, 0x203741).tri(top, back, right, 0x18303d);
  b.tube(a, top, 0.1, 0.1, 0xb5bab0, 3).tube(top, back, 0.12, 0.12, 0xa6ada7, 3);
  b.tri([0.1, 4.13, -7.4], [1.42, 2.5, -7.9], [0.4, 3.4, -10], 0x729697);
  b.tube([0, 0.3, -24.8], [0, 0.3, -20.5], 0.035, 0.15, 0x7d8b8b, 4);
  return b.geometry();
}
function buildBomber() {
  const b = new Builder(), c = 0x6d7c80;
  const rings = [[-31, 1, 1], [-23, 3, 2.7], [-8, 4.5, 3.6], [19, 4, 3.0], [29, 1.4, 1.8]].map(([z, w, h]) => [[-w, 0, z], [0, h, z], [w, 0, z], [0, -h, z]]);
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < 4; k++) b.quad(rings[j][k], rings[j + 1][k], rings[j + 1][(k + 1) % 4], rings[j][(k + 1) % 4], c);
  for (const s of [-1, 1]) {
    b.quad([s * 3, 0, -12], [s * 39, -1, 15], [s * 38, -1, 20], [s * 4, 0, 9], c, [0, 1, 0]); b.quad([s * 3, 2, 16], [s * 15, 1, 27], [s * 14, 1, 30], [s * 2, 2, 25], c, [0, 1, 0]);
    for (const x of [12, 19]) b.tube([s * x, -2, 3], [s * x, -2, 17], 1.6, 1.3, 0x45545e, 6);
    b.quad([s * 2, 2, 15], [s * 4, 13, 24], [s * 4, 13, 29], [s * 2, 2, 29], c);
  }
  b.quad([-2.5, 2, -23], [0, 3.6, -18], [2.5, 2, -23], [0, 2.7, -26], 0x293f4b);
  return b.geometry();
}
function buildRadar() {
  const base = new Builder(), dish = new Builder();
  base.box(0, 5, 0, 36, 10, 27, 0x657467); base.tube([0, 5, 0], [0, 33, 0], 4, 2.5, 0x959d87, 6); base.tube([-16, 4, 0], [0, 28, 0], 1.4, 1.4, 0xa0a38c, 4); base.tube([16, 4, 0], [0, 28, 0], 1.4, 1.4, 0xa0a38c, 4);
  for (const s of [-1, 1]) base.box(s * 15, 1, 0, 6, 5, 32, 0x263b37);
  dish.quad([-26, 24, -2], [-26, 42, 1], [26, 42, 1], [26, 24, -2], 0xabb3a0, [0, 0.17, -1]);
  for (let i = -24; i <= 24; i += 8) dish.tube([i, 24, -2.5], [i, 42, 0.5], 0.45, 0.45, 0x526d66, 3);
  dish.tube([-26, 32, -1.4], [26, 32, -1.4], 0.5, 0.5, 0x526d66, 3); dish.tube([0, 28, 2], [0, 32, -17], 1.1, 0.7, 0xd1c9a8, 4);
  return { base: base.geometry(), dish: dish.geometry() };
}
function buildSAM() {
  const b = new Builder();
  b.box(0, 5, 0, 21, 9, 35, 0x5b6b59);
  for (const x of [-10, 10]) for (const z of [-12, 0, 12]) b.tube([x - 2, 3, z], [x + 2, 3, z], 3.6, 3.6, 0x263c38, 6);
  b.box(0, 13, -10, 20, 9, 13, 0x83917e); b.box(0, 14, -17, 15, 4, 1, 0x29444c);
  for (const x of [-6, 0, 6]) { b.tube([x, 10, 11], [x, 27, -10], 2, 2, 0x859078, 5); b.tube([x, 27, -10], [x, 30, -14], 2, 0.1, 0xc1c1a4, 5); }
  return b.geometry();
}
// Blockade frigate (Operation Undertow): grey hull, red boot line, bridge, mast, gun and missile box. Bow is −Z.
function buildFrigate() {
  const b = new Builder(), hull = 0x5d6a6e, deck = 0x7b857f, dark = 0x2f3d42, l = 150, w = 20;
  b.box(0, 7, 8, w, 14, l * 0.78, hull);
  b.box(0, 1.2, 8, w + 0.4, 2.4, l * 0.79, 0x6e3b33);
  b.tri([-w / 2, 14, -50.5], [w / 2, 14, -50.5], [0, 14, -75], deck, [0, 1, 0]);
  b.tri([-w / 2, 0, -50.5], [-w / 2, 14, -50.5], [0, 14, -75], hull);
  b.tri([w / 2, 14, -50.5], [w / 2, 0, -50.5], [0, 14, -75], hull);
  b.tri([-w / 2, 0, -50.5], [0, 14, -75], [0, 0, -66], hull);
  b.tri([w / 2, 0, -50.5], [0, 0, -66], [0, 14, -75], hull);
  b.box(0, 14.6, 8, w + 2, 1.4, l * 0.8, deck);
  b.box(0, 23, 12, w * 0.72, 16, 36, 0x8c9893); b.box(0, 34.5, 6, w * 0.6, 7, 16, 0x9aa69f); b.box(0, 34.6, -2.2, w * 0.56, 2.4, 0.6, 0x23353b);
  b.tube([0, 38, 8], [0, 62, 8], 1.2, 0.6, 0xb8bdb0, 4); b.box(0, 54, 8, 11, 1.4, 1.4, 0xb8bdb0); b.octa([0, 64, 8], 3.2, 0xd2d0c0);
  b.box(0, 30, 38, 7, 12, 9, 0x7d8984); b.box(0, 36.5, 38, 7.6, 1.2, 9.6, dark);
  b.box(0, 17.8, -30, 8.5, 5.2, 9.5, 0x6d7a78); b.tube([0, 18.6, -34], [0, 19.2, -49], 0.8, 0.55, 0x3a4648, 4);
  b.box(0, 18.4, 52, 12, 6.2, 15, 0x6f7c6a);
  for (const x of [-3.6, 0, 3.6]) b.box(x, 21.7, 52, 2.6, 0.6, 13, dark);
  for (const s of [-1, 1]) b.box(s * 7.2, 17, 28, 2.4, 3.2, 6, 0xb9a77f);
  return b.geometry();
}
const geo = {
  jet: buildJet(), enemy: buildJet(0x839397, 0x8c5b51, true), ace: buildJet(0xa64e42, 0xd8c2a4, true), ace2: buildJet(0x5f7088, 0xe0c27a, true),
  striker: buildJet(0x8b8f78, 0xc9a040, true), bomber: buildBomber(), sam: buildSAM(), frigate: buildFrigate(),
};
{ const r = buildRadar(); geo.radarBase = r.base; geo.radarDish = r.dish; }
geo.missile = (() => {
  const b = new Builder();
  b.tube([0, 0, -4], [0, 0, 3], 0.45, 0.45, 0xe5dfc3, 6); b.tube([0, 0, -6], [0, 0, -4], 0.01, 0.45, 0xc7cfc3, 6);
  b.quad([-1.7, 0, 2], [0, 0, 0.3], [1.7, 0, 2], [0, 0, 3.2], 0xc6d1c0, [0, 1, 0]); b.quad([0, -1.7, 2], [0, 0, 0.3], [0, 1.7, 2], [0, 0, 3.2], 0xc6d1c0, [1, 0, 0]);
  return b.geometry();
})();
geo.flame = (() => {
  const b = new Builder();
  b.tube([0, 0, 0], [0, 0, 9.5], 1.52, 0.06, 0xf78437, 7); b.tube([0, 0, 0.15], [0, 0, 10.8], 1.0, 0.05, 0xffd47a, 7); b.tube([0, 0, 0.25], [0, 0, 11.9], 0.6, 0.02, 0xfff1b4, 7);
  return b.geometry();
})();

/** Meshes drawn in immediate mode (like the original draw calls): one pool per model, reused every frame. */
class Pool {
  constructor(geometry, material = litMat) { this.geometry = geometry; this.material = material; this.items = []; this.used = 0; }
  begin() { this.used = 0; }
  next() {
    let m = this.items[this.used];
    if (!m) {
      m = new THREE.Mesh(this.geometry, this.material);
      m.matrixAutoUpdate = false;
      m.visible = false;
      scene.add(m);
      this.items.push(m);
    }
    m.visible = true;
    this.used++;
    return m;
  }
  end() { for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false; }
}
const pool = {};
for (const k of ['jet', 'enemy', 'ace', 'ace2', 'striker', 'bomber', 'sam', 'frigate', 'radarBase', 'radarDish', 'missile']) pool[k] = new Pool(geo[k]);
pool.flame = new Pool(geo.flame, unlitMat);
const POOLS = Object.values(pool);
function drawModel(p, pos, yaw = 0, pitch = 0, roll = 0, scale = 1) {
  const m = p.next();
  setModel(m.matrix.elements, pos, yaw, pitch, roll, scale);
  m.matrixWorldNeedsUpdate = true;
  return m;
}
const _jetM = new THREE.Matrix4(), _locM = new THREE.Matrix4();
function drawExhaust(jetMesh, amount = 1) {
  _jetM.copy(jetMesh.matrix);
  for (let side = -1; side <= 1; side += 2) {
    const s = 0.91 + Math.sin(time * 39 + side) * 0.05, zs = amount * (0.95 + Math.sin(time * 47 + side) * 0.11);
    _locM.makeScale(s, s, zs);
    _locM.elements[12] = side * 2.9; _locM.elements[13] = -0.55; _locM.elements[14] = 16.25;
    const f = pool.flame.next();
    f.matrix.multiplyMatrices(_jetM, _locM);
    f.matrixWorldNeedsUpdate = true;
  }
}

// Particles: one instanced octahedron batch (fire, smoke, debris, flares, missile glow), colour per instance.
const PART_CAP = 720;
const octaGeo = new Builder().octa([0, 0, 0], 1, [1, 1, 1]).geometry();
const particleMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
particleMat.name = 'particles';
const partMesh = kit.instanced(octaGeo, particleMat, PART_CAP);
partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const partColor = new THREE.InstancedBufferAttribute(new Float32Array(partMesh.instanceMatrix.count * 3), 3);
partColor.setUsage(THREE.DynamicDrawUsage);
particleMat.colorNode = shadeFinish(T.instancedBufferAttribute(partColor));
vertexSnap(particleMat, { grid: snapGrid });
partMesh.frustumCulled = false;
partMesh.count = 0;
scene.add(partMesh);
let pc = 0;
function octa(x, y, z, s, r, g, b) {
  if (pc >= PART_CAP) return;
  const m = partMesh.instanceMatrix.array, o = pc * 16, c = partColor.array, k = pc * 3;
  m[o] = s; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
  m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
  m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = s; m[o + 11] = 0;
  m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
  c[k] = r; c[k + 1] = g; c[k + 2] = b;
  pc++;
}

// Trails, tracers and wakes: one preallocated triangle buffer rewritten every frame (no per-frame arrays).
const RIB_VERTS = 30000;
const ribPos = new THREE.BufferAttribute(new Float32Array(RIB_VERTS * 3), 3).setUsage(THREE.DynamicDrawUsage);
const ribCol = new THREE.BufferAttribute(new Float32Array(RIB_VERTS * 3), 3).setUsage(THREE.DynamicDrawUsage);
const ribGeo = new THREE.BufferGeometry();
ribGeo.setAttribute('position', ribPos);
ribGeo.setAttribute('color', ribCol);
ribGeo.setDrawRange(0, 0);
const ribMesh = new THREE.Mesh(ribGeo, unlitMat);
ribMesh.frustumCulled = false;
scene.add(ribMesh);
let rv = 0;
function vert(x, y, z, r, g, b) { const P = ribPos.array, C = ribCol.array, i = rv * 3; P[i] = x; P[i + 1] = y; P[i + 2] = z; C[i] = r; C[i + 1] = g; C[i + 2] = b; rv++; }
/** One camera-facing ribbon segment from a to c (the original trailRibbon quad). */
function segment(a, c, w, r, g, b) {
  if (rv + 6 > RIB_VERTS) return;
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  if (vx * vx + vy * vy + vz * vz < 0.0001) return;
  const f = cam.f, cp = cam.p;
  if ((a[0] - cp[0]) * f[0] + (a[1] - cp[1]) * f[1] + (a[2] - cp[2]) * f[2] < 12) return;
  if ((c[0] - cp[0]) * f[0] + (c[1] - cp[1]) * f[1] + (c[2] - cp[2]) * f[2] < 12) return;
  let sx = vy * f[2] - vz * f[1], sy = vz * f[0] - vx * f[2], sz = vx * f[1] - vy * f[0];
  const sl = Math.hypot(sx, sy, sz);
  if (sl > 0) { sx *= w / sl; sy *= w / sl; sz *= w / sl; } else { sx = sy = sz = 0; }
  vert(a[0] - sx, a[1] - sy, a[2] - sz, r, g, b); vert(a[0] + sx, a[1] + sy, a[2] + sz, r, g, b); vert(c[0] + sx, c[1] + sy, c[2] + sz, r, g, b);
  vert(a[0] - sx, a[1] - sy, a[2] - sz, r, g, b); vert(c[0] + sx, c[1] + sy, c[2] + sz, r, g, b); vert(c[0] - sx, c[1] - sy, c[2] - sz, r, g, b);
}
function ribbon(points, width, r, g, b) {
  const n = points.length;
  for (let i = 1; i < n; i++) {
    const a = points[i - 1].p || points[i - 1], c = points[i].p || points[i], t = i / n, k = mix(0.63, 1, t);
    segment(a, c, width * (0.4 + t * 0.6), r * k, g * k, b * k);
  }
}
/** A short tube (the cannon tracer) straight into the triangle buffer. */
function tracerTube(p, dir, length, r1, r2, r, g, b) {
  if (rv + 36 > RIB_VERTS) return;
  const ax = p[0], ay = p[1], az = p[2], bx = p[0] - dir[0] * length, by = p[1] - dir[1] * length, bz = p[2] - dir[2] * length;
  // v = direction a→b; u ⟂ v; w = v × u
  const vx = -dir[0], vy = -dir[1], vz = -dir[2];
  const ref = Math.abs(vy) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ux = vy * ref[2] - vz * ref[1], uy = vz * ref[0] - vx * ref[2], uz = vx * ref[1] - vy * ref[0];
  const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  const wx = vy * uz - vz * uy, wy = vz * ux - vx * uz, wz = vx * uy - vy * ux;
  for (let i = 0; i < 3; i++) {
    const t1 = (i / 3) * TAU, t2 = ((i + 1) / 3) * TAU, c1 = Math.cos(t1), s1 = Math.sin(t1), c2 = Math.cos(t2), s2 = Math.sin(t2);
    const d1x = ux * c1 + wx * s1, d1y = uy * c1 + wy * s1, d1z = uz * c1 + wz * s1, d2x = ux * c2 + wx * s2, d2y = uy * c2 + wy * s2, d2z = uz * c2 + wz * s2;
    const p1 = [ax + d1x * r1, ay + d1y * r1, az + d1z * r1], p2 = [ax + d2x * r1, ay + d2y * r1, az + d2z * r1], p3 = [bx + d2x * r2, by + d2y * r2, bz + d2z * r2], p4 = [bx + d1x * r2, by + d1y * r2, bz + d1z * r2];
    vert(...p1, r, g, b); vert(...p2, r, g, b); vert(...p3, r, g, b);
    vert(...p1, r, g, b); vert(...p3, r, g, b); vert(...p4, r, g, b);
    vert(ax, ay, az, r, g, b); vert(...p2, r, g, b); vert(...p1, r, g, b);
    vert(bx, by, bz, r, g, b); vert(...p4, r, g, b); vert(...p3, r, g, b);
  }
}
/** A flat foam strip on the water behind a ship. */
function wake(e) {
  if (rv + 12 > RIB_VERTS) return;
  const f = forward(e.yaw, 0), rx = Math.cos(e.yaw), rz = Math.sin(e.yaw), y = 1.6;
  const sx = e.p[0] - f[0] * 62, sz = e.p[2] - f[2] * 62;
  const mx = sx - f[0] * 110, mz = sz - f[2] * 110, ex = sx - f[0] * 260, ez = sz - f[2] * 260;
  const w1 = 9, w2 = 22, w3 = 40, c1 = [0.62, 0.74, 0.74], c2 = [0.36, 0.5, 0.53], c3 = [0.2, 0.36, 0.42];
  const quad = (ax, az, aw, ac, bx, bz, bw, bc) => {
    vert(ax - rx * aw, y, az - rz * aw, ...ac); vert(ax + rx * aw, y, az + rz * aw, ...ac); vert(bx + rx * bw, y, bz + rz * bw, ...bc);
    vert(ax - rx * aw, y, az - rz * aw, ...ac); vert(bx + rx * bw, y, bz + rz * bw, ...bc); vert(bx - rx * bw, y, bz - rz * bw, ...bc);
  };
  quad(sx, sz, w1, c1, mx, mz, w2, c2);
  quad(mx, mz, w2, c2, ex, ez, w3, c3);
}
function flushDynamic() {
  partMesh.count = pc;
  partMesh.visible = pc > 0;
  if (pc) {
    const im = partMesh.instanceMatrix;
    im.clearUpdateRanges(); im.addUpdateRange(0, pc * 16); im.needsUpdate = true;
    partColor.clearUpdateRanges(); partColor.addUpdateRange(0, pc * 3); partColor.needsUpdate = true;
  }
  ribGeo.setDrawRange(0, rv);
  ribMesh.visible = rv > 0;
  if (rv) {
    ribPos.clearUpdateRanges(); ribPos.addUpdateRange(0, rv * 3); ribPos.needsUpdate = true;
    ribCol.clearUpdateRanges(); ribCol.addUpdateRange(0, rv * 3); ribCol.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- build the world
kit.loading.progress(0.7, 'Raising the coast…');
await tick();
seed = 17; // the city layout comes from this seed, exactly as in the first release
const terrainB = terrainBuilder();
staticMesh(terrainB);
kit.loading.progress(0.8, 'Building Port Meridian…');
await tick();
buildWorld();
let mapCanvas;
function makeMap() {
  mapCanvas = document.createElement('canvas'); mapCanvas.width = 512; mapCanvas.height = 512;
  const c = mapCanvas.getContext('2d');
  c.fillStyle = '#102925'; c.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 2) for (let y = 0; y < 512; y += 2) {
    const h = terrainHeight((x / 512 - 0.5) * 28000, (y / 512 - 0.5) * 28000);
    if (h > 0) { c.fillStyle = h > 350 ? '#3f6143' : h > 90 ? '#31543c' : '#284b35'; c.fillRect(x, y, 2, 2); }
  }
  c.strokeStyle = '#608557'; c.lineWidth = 0.7; c.beginPath(); c.moveTo((-0.0232 + 0.5) * 512, (-5070 / 28000 + 0.5) * 512); c.lineTo((2260 / 28000 + 0.5) * 512, (-5070 / 28000 + 0.5) * 512); c.stroke();
}
makeMap();
kit.loading.progress(0.9, 'Fuelling the Kestrel…');
await tick();

// ---------------------------------------------------------------- audio (synthesized; the music is an original minor-key flight loop)
const audio = { ctx: null, master: null, music: null, engine: null, engineGain: null, wind: null, windGain: null, noiseBuffer: null, nextNote: 0, step: 0 };
function initAudio() {
  if (audio.ctx) { if (!kit.paused && !document.hidden) audio.ctx.resume().catch(() => {}); setAudioLevel(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const a = (audio.ctx = new AC());
    audio.master = a.createGain(); audio.master.gain.value = muted ? 0 : volume; audio.master.connect(a.destination);
    audio.music = a.createGain(); audio.music.gain.value = musicOn ? 0.33 : 0; audio.music.connect(audio.master);
    const nb = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), data = nb.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    audio.noiseBuffer = nb;
    audio.engine = a.createOscillator(); audio.engine.type = 'sawtooth'; audio.engine.frequency.value = 48;
    const filter = a.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 140;
    audio.engineGain = a.createGain(); audio.engineGain.gain.value = 0.005;
    audio.engine.connect(filter); filter.connect(audio.engineGain); audio.engineGain.connect(audio.master); audio.engine.start();
    audio.wind = a.createBufferSource(); audio.wind.buffer = nb; audio.wind.loop = true;
    const wf = a.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 460;
    audio.windGain = a.createGain(); audio.windGain.gain.value = 0.006;
    audio.wind.connect(wf); wf.connect(audio.windGain); audio.windGain.connect(audio.master); audio.wind.start();
    audio.nextNote = a.currentTime + 0.2;
    setAudioLevel();
  } catch (e) { console.warn('Audio is not available.', e); }
}
function setAudioLevel() {
  if (!audio.ctx) return;
  audio.master.gain.setTargetAtTime(muted ? 0 : volume, audio.ctx.currentTime, 0.06);
  audio.music.gain.setTargetAtTime(musicOn ? 0.33 : 0, audio.ctx.currentTime, 0.08);
}
function tone(freq, duration = 0.1, vol = 0.12, type = 'sine', when = 0, endFreq = null, bus = null) {
  if (!audio.ctx) return;
  const a = audio.ctx, t = when || a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(15, endFreq), t + duration);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g); g.connect(bus || audio.master); o.start(t); o.stop(t + duration + 0.03);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}
function hiss(duration, vol, freq = 800, when = 0, bus = null) {
  if (!audio.ctx) return;
  const a = audio.ctx, t = when || a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = audio.noiseBuffer; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  s.connect(f); f.connect(g); g.connect(bus || audio.master); s.start(t); s.stop(t + duration);
  s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
}
function sfx(name) {
  if (!audio.ctx || muted || audio.ctx.state !== 'running') return;
  const now = audio.ctx.currentTime;
  switch (name) {
    case 'ui': tone(720, 0.045, 0.08, 'sine'); break;
    case 'lock': tone(1200, 0.09, 0.09, 'sine'); tone(1700, 0.14, 0.075, 'sine', now + 0.11); break;
    case 'missile': hiss(0.7, 0.22, 1500); tone(180, 0.4, 0.07, 'sawtooth', 0, 600); break;
    case 'gun': hiss(0.055, 0.17, 1600); tone(95, 0.06, 0.06, 'triangle', 0, 40); break;
    case 'blast': hiss(1.0, 0.35, 550); tone(76, 0.65, 0.22, 'triangle', 0, 19); break;
    case 'hit': hiss(0.15, 0.24, 650); tone(130, 0.15, 0.15, 'square', 0, 40); break;
    case 'radio': hiss(0.12, 0.04, 2400); tone(1050, 0.045, 0.08, 'sine'); tone(820, 0.04, 0.06, 'sine', now + 0.07); break;
    case 'flare': hiss(0.6, 0.23, 2200); tone(1200, 0.2, 0.08, 'sine', 0, 310); break;
    case 'warning': tone(930, 0.12, 0.1, 'square'); break;
    case 'empty': tone(190, 0.13, 0.08, 'square'); break;
    case 'clear': [440, 554, 659, 880].forEach((f, i) => tone(f, 0.5, 0.14, 'triangle', now + i * 0.14)); break;
  }
}
function musicTick() {
  if (!audio.ctx || audio.ctx.state !== 'running') return;
  const a = audio.ctx, active = state === 'playing';
  audio.engine.frequency.setTargetAtTime(active ? 40 + player.speed * 0.09 : 38, a.currentTime, 0.12);
  audio.engineGain.gain.setTargetAtTime(active ? (boosting ? 0.036 : 0.02) : 0.005, a.currentTime, 0.15);
  audio.windGain.gain.setTargetAtTime(active ? 0.021 + player.speed * 0.0001 : 0.006, a.currentTime, 0.2);
  if (!active || !musicOn || muted) { audio.nextNote = a.currentTime + 0.1; return; }
  // After a stall (hidden tab, the settings panel) pick the beat up again instead of firing every missed note at once.
  if (audio.nextNote < a.currentTime - 0.05) audio.nextNote = a.currentTime + 0.05;
  const stepDur = 60 / 128 / 4, freq = (n) => 440 * Math.pow(2, (n - 69) / 12);
  while (audio.nextNote < a.currentTime + 0.12) {
    const step = audio.step % 64, t = audio.nextNote, chord = Math.floor(step / 16), bass = [38, 34, 41, 36][chord];
    if (step % 4 === 0) { tone(105, 0.15, 0.37, 'sine', t, 35, audio.music); tone(freq(bass), 0.25, 0.18, 'sawtooth', t, null, audio.music); }
    if (step % 8 === 4) hiss(0.16, 0.15, 2500, t, audio.music);
    if (step % 2 === 0) hiss(0.026, 0.056, 7200, t, audio.music);
    const notes = [0, 7, 12, 15, 7, 12, 19, 15], note = bass + 24 + notes[step % 8];
    if (step % 2 === 0 || phase === 3) tone(freq(note), 0.16, 0.055, 'triangle', t, null, audio.music);
    if (step % 16 === 0) for (const n of [0, 7, 15]) tone(freq(bass + 12 + n), 1.3, 0.028, 'sine', t, null, audio.music);
    audio.step++;
    audio.nextNote += stepDur;
  }
}
// Browsers start audio only after a gesture: the first click, tap or key unlocks it, wherever it lands.
const unlockAudio = () => initAudio();
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
kit.onPause((p) => {
  // Closing the settings panel with A (or a click) must not also fire the weapon it is bound to.
  if (!p) weaponGate = true;
  if (!audio.ctx) return;
  if (p) audio.ctx.suspend().catch(() => {});
  else if (!document.hidden) audio.ctx.resume().catch(() => {});
});

// ---------------------------------------------------------------- mission state and combat simulation
let mission = MISSIONS[selectedMission];
const newPlayer = () => ({ p: [-2350, 760, 2900], yaw: 0.16, pitch: -0.025, roll: 0, speed: 235, hp: 100, ammo: 36, flares: 8, flareCD: 0, heat: 0, overheat: false, rails: [0, 0], rollCD: 0, dodge: 0, dodgeDir: 1 });
let player = newPlayer();
let entities = [], missiles = [], particles = [], tracers = [], jetTrails = [[], []], aceList = [], targetId = null, lock = 0, wasLocked = false;
let phase = 1, progress = 0, score = 0, elapsed = 0, remaining = 360, kills = 0, damageTaken = 0, shots = 0, hits = 0, boosting = false, braking = false;
let gunTimer = 0, missileTimer = 0, hitFlash = 0, shake = 0, radioTimer = 0, radioQueue = [], bannerTimer = 0, killTimer = 0, warningTimer = 0, chatTimer = 35, autoTargetTimer = 0;
let boundTimer = 10, endTimer = 0, finishSuccess = false, finishReason = '', bridgeBonus = false, phaseDelay = 0, nextEntityId = 1;
let enemyAlert = false, groundAlert = false, selectedDistance = 0, deathHide = false, menuTime = 0;
let state = 'menu', manualFrom = 'menu', viewMode = 0, weaponGate = true, lastRollDir = 1;
const mouse = { x: 0, y: 0, active: false, lx: NaN, ly: NaN };
const radioNames = { control: 'ORACLE / AIR CONTROL', wing: 'GANNET 2 / WINGMAN', ace: 'RED KITE / HOSTILE', ace2: 'ASH WREN / HOSTILE', pilot: 'RASCAL 1 / PILOT' };
const typeNames = { radar: 'RADAR', sam: 'SAM', fighter: 'FIGHTER', bomber: 'BOMBER', ace: 'ACE', frigate: 'FRIGATE', striker: 'STRIKER' };
const label = (e) => (e.type === 'ace' ? e.callsign || 'RED KITE' : typeNames[e.type] || e.type.toUpperCase());
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function say(who, text, duration = 5, priority = false) {
  const msg = { who: radioNames[who] || who, text, duration };
  if (priority) { radioQueue = []; radioTimer = 0; }
  if (radioTimer <= 0) showRadio(msg); else radioQueue.push(msg);
}
function showRadio(msg) { $('radioName').textContent = msg.who; $('radioText').textContent = msg.text; $('radio').classList.add('show'); radioTimer = msg.duration; sfx('radio'); }
function banner(title, subtitle, duration = 3.6) { $('bannerTitle').textContent = title; $('bannerSub').textContent = subtitle; $('banner').classList.add('show'); bannerTimer = duration; }
function note(title, subtitle = '', duration = 1.5) {
  const k = $('killNote'), b = document.createElement('strong');
  b.textContent = title;
  k.replaceChildren(b, document.createTextNode(subtitle));
  k.style.opacity = 1;
  killTimer = duration;
}
function newEnemy(type, p, opts = {}) {
  const hp = type === 'bomber' ? 180 : type === 'ace' ? 850 : 100;
  const e = { id: nextEntityId++, type, p: [...p], yaw: 0, pitch: 0, roll: 0, speed: 0, decoys: 2, decoyCD: 0, enraged: false, hp, maxhp: hp, primary: type === 'radar' || type === 'bomber' || type === 'ace', alive: true, fire: 8 + rand() * 10, ai: rand() * TAU, trail: [], radius: type === 'radar' ? 48 : type === 'bomber' ? 38 : 25, ...opts };
  entities.push(e);
  return e;
}
function groundEnemy(type, x, z) { const h = type === 'radar' ? 23 : 13; return newEnemy(type, [x, groundY(x, z) + h, z], { groundOffset: h, hp: type === 'radar' ? 100 : 105, maxhp: type === 'radar' ? 100 : 105, yaw: rand() * TAU }); }
function newFrigate(cx, cz, R, dir, a0) {
  // 200 hp: two missile hits (105 each), as the objective hint says.
  const e = newEnemy('frigate', [cx, 14, cz], { hp: 200, maxhp: 200, radius: 55, primary: true, speed: 16, cx, cz, R, dir, ang: a0, groundOffset: 14, fire: 9 + rand() * 8 });
  frigateMove(e, 0);
  return e;
}
function frigateMove(e, dt) {
  e.ang += (dt * e.speed * e.dir) / e.R;
  e.p[0] = e.cx + Math.sin(e.ang) * e.R;
  e.p[2] = e.cz + Math.cos(e.ang) * e.R;
  e.yaw = Math.atan2(Math.cos(e.ang) * e.dir, Math.sin(e.ang) * e.dir);
}
function focusTarget(e) { targetId = e.id; lock = 0; wasLocked = false; }
const phaseInfo = () => mission.phases[phase - 1];
function updateObjective() {
  const ph = phaseInfo(), count = ph.count;
  $('phaseLabel').textContent = mission.op + ' / 0' + phase;
  $('objectiveTitle').textContent = ph.title;
  $('objectiveCount').textContent = ph.unit + ' ' + progress + ' / ' + count;
  const pips = $('objectivePips');
  while (pips.children.length < count) pips.append(document.createElement('i'));
  while (pips.children.length > count) pips.lastChild.remove();
  [...pips.children].forEach((el, i) => el.classList.toggle('done', i < progress));
  $('nextHint').textContent = hintText(ph.kind);
  $('aceHUD').hidden = phase !== 3;
  if (phase === 3) {
    aceList.forEach((e, i) => { $('aceName' + i).textContent = e.callsign + ' / ENEMY ACE'; });
    $('aceRow1').hidden = aceList.length < 2;
  }
  layoutTouch();
}
function hintText(kind) {
  const k = PROMPTS[promptSource()];
  if (kind === 'radar') return 'Keep a target in view. Wait for LOCK. Press ' + k.missile + ' to fire a missile.';
  if (kind === 'bomber') return 'Do not let the bombers reach the port. Each bomber needs two missile hits.';
  if (kind === 'frigate') return 'Frigates fire missiles. Each one needs two hits. Press ' + k.flare + ' for flares when a missile is near.';
  if (kind === 'striker') return 'Strikers race for the carrier Halyard (blue on the radar). Boost with ' + k.boost + ' to catch them.';
  return 'Stay on the ace. Use ' + k.brake + ' for a tight turn. Release flares when a missile is near.';
}

function startMission(index = selectedMission) {
  selectedMission = index;
  mission = MISSIONS[index];
  saveSettings();
  applyPalette(mission.palette);
  initAudio();
  setState('playing');
  document.body.classList.add('playing');
  for (const id of ['menu', 'manual', 'pause', 'result']) $(id).hidden = true;
  $('gameUI').hidden = false;
  seed = mission.seed;
  player = newPlayer();
  entities = []; missiles = []; particles = []; tracers = []; jetTrails = [[], []]; aceList = [];
  targetId = null; lock = 0; wasLocked = false; phase = 1; progress = 0; score = 0; elapsed = 0; remaining = mission.limit;
  kills = 0; damageTaken = 0; shots = 0; hits = 0; gunTimer = 0; missileTimer = 0; hitFlash = 0; shake = 0;
  radioTimer = 0; radioQueue = []; bannerTimer = 0; killTimer = 0; warningTimer = 0; chatTimer = 38; autoTargetTimer = 0;
  boundTimer = 10; bridgeBonus = false; phaseDelay = 0; nextEntityId = 1; deathHide = false; viewMode = 0; cam.ready = false;
  boosting = braking = false; enemyAlert = groundAlert = false; finishSuccess = false;
  mouse.active = false; mouse.x = mouse.y = 0;
  $('radio').classList.remove('show'); $('banner').classList.remove('show'); $('killNote').style.opacity = 0;
  weaponGate = true;
  input.settle();
  mission.setup();
  updateObjective();
  selectTarget();
  mission.opening();
  sfx('ui');
  updateUI(true);
  updatePrompts();
}
function getTarget() { return entities.find((e) => e.id === targetId && e.alive) || null; }
function selectTarget(cycle = false) {
  const f = forward(player.yaw, player.pitch);
  const candidates = entities.filter((e) => e.alive);
  if (!candidates.length) { targetId = null; lock = 0; return; }
  const value = (e) => { const d = sub(e.p, player.p), l = len(d); return dot(norm(d), f) * 2300 - l * 0.16 + (e.primary ? 750 : 0) + (e.type === 'ace' ? 300 : 0); };
  candidates.sort((a, b) => value(b) - value(a));
  let next = candidates[0];
  if (cycle) {
    const sorted = candidates.sort((a, b) => a.id - b.id);
    const i = sorted.findIndex((e) => e.id === targetId);
    next = sorted[(i + 1) % sorted.length];
    autoTargetTimer = 3.4;
    sfx('ui');
  }
  if (next.id !== targetId) { targetId = next.id; lock = 0; wasLocked = false; }
}
function spawnMissile(source, isEnemy = false) {
  const target = isEnemy ? player : getTarget();
  if (!target) return false;
  if (!isEnemy) {
    if (player.ammo <= 0) { if (missileTimer <= 0) { sfx('empty'); note('NO MISSILES', 'USE THE CANNON', 1); } missileTimer = 0.35; return false; }
    if (lock < 0.98) { if (missileTimer <= 0) { sfx('empty'); note('NO LOCK', 'KEEP THE TARGET IN VIEW', 0.7); } missileTimer = 0.35; return false; }
    const rail = player.rails[0] <= 0 ? 0 : player.rails[1] <= 0 ? 1 : -1;
    if (rail < 0) return false;
    player.rails[rail] = 2.6; player.ammo--; shots++;
    const model = matrix(player.p, player.yaw, player.pitch, player.roll), p = transform([rail === 0 ? -9 : 9, -2, 1], model);
    missiles.push({ p, dir: forward(player.yaw, player.pitch), speed: 720 + player.speed * 0.35, target, enemy: false, life: 8, trail: [], decoy: false });
    sfx('missile'); input.rumble(0.35, 90);
    missileTimer = 0.28;
    return true;
  }
  const dir = norm(sub(player.p, source.p));
  missiles.push({ p: add(source.p, [0, 8, 0]), dir, speed: source.type === 'ace' ? 355 : 320, target: player, enemy: true, life: 17, trail: [], decoy: false, damage: source.type === 'ace' ? 24 : 18 });
  return true;
}
function releaseFlares() {
  if (state !== 'playing') return;
  if (player.flares <= 0 || player.flareCD > 0) { sfx('empty'); note(player.flares <= 0 ? 'NO FLARES' : 'FLARES RELOADING', '', 0.7); return; }
  player.flares--; player.flareCD = 5.5; sfx('flare'); input.rumble(0.25, 80);
  let decoyed = 0;
  const f = forward(player.yaw, player.pitch), r = [Math.cos(player.yaw), 0, Math.sin(player.yaw)];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    particles.push({ p: add(player.p, mul(r, side * 4)), v: add(mul(f, -45 - rand() * 30), add(mul(r, side * (50 + rand() * 100)), [0, -25 - rand() * 40, 0])), age: 0, life: 2 + rand(), size: 2.5 + rand() * 2, kind: 'flare', trail: [] });
  }
  for (const m of missiles) if (m.enemy && !m.decoy && dist(m.p, player.p) < 4500) { m.decoy = true; m.decoyP = add(player.p, mul(f, -140)); m.life = Math.min(m.life, 3.0); decoyed++; }
  note('FLARES RELEASED', decoyed ? 'MISSILE DECOYED' : 'COUNTERMEASURES ACTIVE', 1.2);
}
function rollDodge(dir) { if (state !== 'playing' || player.rollCD > 0) return; player.dodge = 0.86; player.dodgeDir = dir; player.rollCD = 3; sfx('ui'); input.rumble(0.2, 120); }
function explode(p, size = 45) {
  sfx('blast');
  const near = clamp(1 - dist(p, player.p) / 2500, 0, 0.65);
  if (near > 0.08) input.rumble(near, 180);
  shake = Math.max(shake, near);
  for (let i = 0; i < 23; i++) particles.push({ p: add(p, [(rand() - 0.5) * size * 0.3, (rand() - 0.5) * size * 0.3, (rand() - 0.5) * size * 0.3]), v: [(rand() - 0.5) * size * 2, (rand() - 0.2) * size * 1.5, (rand() - 0.5) * size * 2], age: 0, life: 0.35 + rand() * 0.8, size: size * (0.07 + rand() * 0.12), kind: 'fire' });
  for (let i = 0; i < 12; i++) particles.push({ p: add(p, [(rand() - 0.5) * size * 0.7, rand() * size * 0.3, (rand() - 0.5) * size * 0.7]), v: [(rand() - 0.5) * 18, 12 + rand() * 18, (rand() - 0.5) * 18], age: 0, life: 2.8 + rand() * 2, size: size * (0.15 + rand() * 0.22), kind: 'smoke' });
  for (let i = 0; i < 10; i++) particles.push({ p: [...p], v: [(rand() - 0.5) * size * 4, rand() * size * 2, (rand() - 0.5) * size * 4], age: 0, life: 1 + rand(), size: 1 + rand() * 2.5, kind: 'debris' });
}
function damageEnemy(e, amount) {
  if (!e || !e.alive || state !== 'playing') return;
  e.hp -= amount;
  if (e.hp > 0) { if (amount > 20) { note('HIT', e.type === 'ace' ? e.callsign + ' DAMAGED' : 'TARGET DAMAGED', 0.8); sfx('hit'); input.rumble(0.15, 60); } return; }
  e.alive = false; kills++;
  const points = { radar: 600, sam: 350, fighter: 800, bomber: 1200, ace: e.callsign === 'ASH WREN' ? 2400 : 3000, frigate: 900, striker: 700 }[e.type] || 500;
  score += points;
  explode(e.p, e.type === 'ace' ? 85 : e.type === 'bomber' || e.type === 'frigate' ? 80 : e.type === 'radar' ? 66 : 45);
  note('DESTROYED', '+' + points + ' / ' + label(e), 1.6);
  if (targetId === e.id) { targetId = null; lock = 0; wasLocked = false; selectTarget(); }
  const ph = phaseInfo();
  if (e.type !== ph.kind || phaseDelay > 0) return;
  progress++;
  updateObjective();
  if (progress >= ph.count) {
    if (phase < 3) phaseDelay = 2.4;
    else finishMission(true, mission.win.reason);
    return;
  }
  if (e.type === 'ace') { mission.onAceDown?.(e); const next = entities.find((o) => o.alive && o.type === 'ace'); if (next) focusTarget(next); return; }
  const line = ph.lines[progress - 1];
  if (line) say(line[0], line[1], 4);
}
function advancePhase() {
  phaseDelay = 0;
  mission.advance(phase);
  phase++;
  progress = 0;
  updateObjective();
}
function damagePlayer(amount) {
  if (state !== 'playing') return;
  amount *= expert ? 1.35 : 1;
  player.hp = Math.max(0, player.hp - amount);
  damageTaken += amount; hitFlash = 0.5; shake = 0.8;
  sfx('hit'); input.rumble(0.85, 260);
  if (player.hp <= 0) { explode(player.p, 65); deathHide = true; input.rumble(1, 600); finishMission(false, 'The Kestrel was lost. Watch for missile alerts and release flares.'); }
  else if (player.hp < 35) say('control', 'Your airframe is critical. Break away and use your flares.', 4, true);
}
function fireGun(dt) {
  if (player.overheat) return;
  player.heat = Math.min(100, player.heat + 24 * dt);
  if (player.heat >= 100) { player.overheat = true; note('GUN OVERHEAT', 'LET THE CANNON COOL', 1.1); }
  if (gunTimer > 0) return;
  gunTimer = 0.078;
  sfx('gun'); input.rumble(0.12, 40);
  const f = forward(player.yaw, player.pitch), model = matrix(player.p, player.yaw, player.pitch, player.roll), start = transform([1.6, -0.5, -14], model);
  const d = norm(add(f, [(rand() - 0.5) * 0.004, (rand() - 0.5) * 0.004, (rand() - 0.5) * 0.004]));
  tracers.push({ p: start, dir: d, life: 0.85, enemy: false });
  let hit = null, closest = 1800;
  for (const e of entities) {
    if (!e.alive) continue;
    const delta = sub(e.p, player.p), distance = len(delta);
    if (distance < closest && dot(norm(delta), f) > Math.cos(0.022 + Math.atan2(e.radius * 0.75, distance))) { hit = e; closest = distance; }
  }
  if (hit) {
    damageEnemy(hit, 6);
    if (rand() > 0.6) particles.push({ p: [...hit.p], v: [(rand() - 0.5) * 12, 15, (rand() - 0.5) * 12], age: 0, life: 0.16, size: 4, kind: 'fire' });
  }
}
function finishMission(success, reason) {
  if (state !== 'playing') return;
  finishSuccess = success; finishReason = reason;
  setState('ending');
  endTimer = success ? 3.7 : 2.6;
  missiles = missiles.filter((m) => !m.enemy);
  if (success) { banner(...mission.win.banner, 4); say('control', mission.win.radio, 6, true); sfx('clear'); }
  else { banner('MISSION FAILED', 'RETURN TO BASE / REGROUP', 3); say('control', reason, 5, true); }
  $('warning').hidden = true;
}
function showResults() {
  setState('result');
  $('gameUI').hidden = true; $('result').hidden = false;
  document.body.classList.remove('playing');
  const bonus = finishSuccess ? Math.floor(remaining * 12) : 0, hullBonus = finishSuccess ? Math.floor(player.hp * 15) : 0, total = score + bonus + hullBonus;
  const R = mission.ranks;
  const rank = !finishSuccess ? '—' : total >= R.S && player.hp >= R.hull ? 'S' : total >= R.A ? 'A' : total >= R.B ? 'B' : 'C';
  $('resultLabel').textContent = mission.op + ' / DEBRIEF';
  $('rankValue').textContent = rank;
  $('rankValue').style.color = finishSuccess ? 'var(--lime)' : 'var(--orange)';
  $('resultTitle').textContent = finishSuccess ? 'SKY SECURED.' : 'NOT THIS TIME.';
  $('resultSubtitle').textContent = finishSuccess ? 'MISSION COMPLETE / RANK ' + rank : 'MISSION FAILED';
  $('resultMessage').textContent = finishReason;
  $('resultKills').textContent = score.toLocaleString();
  $('resultTime').textContent = formatTime(elapsed);
  $('resultBonus').textContent = bonus.toLocaleString();
  $('resultHull').textContent = Math.ceil(player.hp) + '% / +' + hullBonus;
  $('resultCount').textContent = String(kills);
  $('resultAccuracy').textContent = hits + ' / ' + shots;
  $('resultScore').textContent = pad6(total);
  const best = bests[mission.id] || 0, record = finishSuccess && total > best;
  if (record) { bests[mission.id] = total; store.set(mission.bestKey, String(total)); }
  if (finishSuccess && rankValue(rank) > rankValue(ranks[mission.id])) { ranks[mission.id] = rank; store.set('sky-rascal-ranks', JSON.stringify(ranks)); }
  $('resultNote').textContent = record ? 'NEW PERSONAL BEST' : finishSuccess ? (bridgeBonus ? 'BRIDGE RUN BONUS EARNED / +750' : 'PERSONAL BEST / ' + pad6(bests[mission.id])) : 'TIP / BRAKE TO TURN TIGHTER. FLARES BREAK MISSILE LOCK.';
  const next = MISSIONS[MISSIONS.indexOf(mission) + 1];
  $('nextBtn').hidden = !(finishSuccess && next);
  if (next) $('nextBtn').textContent = 'NEXT: ' + next.op.replace('OPERATION ', '');
  updateMissionCard();
  focusEl($('retryBtn'));
}
const rankValue = (r) => ({ S: 4, A: 3, B: 2, C: 1 })[r] || 0;
function formatTime(s) { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

// ---------------------------------------------------------------- flight and AI
function updatePlayer(dt) {
  const fly = input.vector('fly');
  let turn = fly.x, climb = invertPitch ? -fly.y : fly.y;
  if (mouseMode && mouse.active) { turn += clamp(mouse.x / (W * 0.28), -1, 1); climb += clamp(-mouse.y / (H * 0.28), -1, 1); }
  turn = clamp(turn, -1, 1); climb = clamp(climb, -1, 1);
  boosting = input.down('boost'); braking = input.down('brake');
  const desiredSpeed = braking ? 135 : boosting ? 415 : 235;
  player.speed = damp(player.speed, desiredSpeed, 1.3, dt);
  const turnRate = 0.76 * clamp(255 / player.speed, 0.65, 1.36);
  player.yaw += turn * turnRate * dt;
  player.yaw = Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw));
  if (Math.abs(climb) > 0.06) player.pitch = clamp(player.pitch + climb * 0.67 * dt, -0.93, 0.99);
  else player.pitch = damp(player.pitch, 0, 0.62, dt);
  const ground = groundY(player.p[0], player.p[2]);
  groundAlert = player.p[1] - ground < 115;
  if (groundAlert && climb >= 0 && !expert) player.pitch = damp(player.pitch, 0.18, 2.6, dt);
  if (player.p[1] > 4200) player.pitch = damp(player.pitch, -0.2, 2.8, dt);
  player.roll = damp(player.roll, turn * 1.08, 4.8, dt);
  if (player.dodge > 0) {
    player.dodge -= dt;
    const r = [Math.cos(player.yaw), 0, Math.sin(player.yaw)];
    player.p = add(player.p, mul(r, Math.sin(((0.86 - player.dodge) / 0.86) * Math.PI) * player.dodgeDir * 100 * dt));
  }
  player.p = add(player.p, mul(forward(player.yaw, player.pitch), player.speed * dt));
  for (let i = 0; i < 2; i++) player.rails[i] = Math.max(0, player.rails[i] - dt);
  player.flareCD = Math.max(0, player.flareCD - dt); player.rollCD = Math.max(0, player.rollCD - dt);
  gunTimer -= dt; missileTimer -= dt; autoTargetTimer -= dt;
  if (player.p[1] < groundY(player.p[0], player.p[2]) + 7) { player.hp = 0; deathHide = true; explode(player.p, 80); input.rumble(1, 600); finishMission(false, 'The Kestrel hit the surface. Climb when you see PULL UP.'); return; }
  if (player.p[1] < 550) for (const b of collisionBoxes) {
    if (player.p[1] > b.y && player.p[1] < b.top + 3 && Math.abs(player.p[0] - b.x) < b.w + 3 && Math.abs(player.p[2] - b.z) < b.d + 3) { player.hp = 0; deathHide = true; explode(player.p, 75); input.rumble(1, 600); finishMission(false, 'The Kestrel struck a structure. Leave more room on your next pass.'); return; }
  }
  if (!bridgeBonus && player.p[0] > -500 && player.p[0] < 2150 && Math.abs(player.p[2] + 5070) < 35 && player.p[1] > 14 && player.p[1] < 97) {
    bridgeBonus = true; score += 750; note('THREAD THE NEEDLE', 'BRIDGE RUN / +750', 3); say('wing', 'Under the bridge? That is one way to keep a low profile.', 4); input.rumble(0.4, 200);
  }
  if (Math.abs(player.p[0]) > 14000 || Math.abs(player.p[2]) > 15400) { boundTimer -= dt; if (boundTimer <= 0) { finishMission(false, 'You left the combat area. Use the radar to keep the coast in view.'); return; } }
  else boundTimer = Math.min(10, boundTimer + dt * 2);
  let target = getTarget();
  if (!target) { selectTarget(); target = getTarget(); }
  else if (autoTargetTimer <= 0 && dot(norm(sub(target.p, player.p)), forward(player.yaw, player.pitch)) < -0.15) { selectTarget(); target = getTarget(); }
  if (target) {
    const d = sub(target.p, player.p);
    selectedDistance = len(d);
    const inCone = dot(norm(d), forward(player.yaw, player.pitch)) > Math.cos(0.32);
    if (selectedDistance < 3800 && inCone) lock = Math.min(1, lock + dt / 0.7); else lock = Math.max(0, lock - dt * 2.1);
    if (lock >= 1 && !wasLocked) { sfx('lock'); input.rumble(0.18, 50); wasLocked = true; }
    if (lock < 0.4) wasLocked = false;
  } else { selectedDistance = 0; lock = 0; wasLocked = false; }
  // Weapons wait until the button that started or resumed the flight is let go.
  const wantMissile = input.down('missile'), wantGun = input.down('gun');
  if (weaponGate && !wantMissile && !wantGun) weaponGate = false;
  if (!weaponGate && wantMissile && missileTimer <= 0) spawnMissile(player);
  if (!weaponGate && wantGun && !player.overheat) fireGun(dt); else player.heat = Math.max(0, player.heat - dt * 28);
  if (player.overheat && player.heat < 30) player.overheat = false;
}
function aceDefense(e) {
  const name = titleCase(e.callsign || 'RED KITE');
  if (!e.enraged && e.hp < e.maxhp * 0.5) {
    e.enraged = true; e.speed = e.callsign === 'ASH WREN' ? 290 : 285; e.fire = 0.2;
    banner('ACE BURST', (e.callsign || 'RED KITE') + ' / HIGH-SPEED ATTACK', 2.6);
    say('control', name + ' is speeding up. Brake into the turn and stay with ' + (e.pronoun || 'him') + '.', 4, true);
  }
  if (e.decoys <= 0 || e.decoyCD > 0) return;
  let incoming = false;
  for (const m of missiles) if (!m.enemy && !m.decoy && m.target === e && dist(m.p, e.p) < 650) { incoming = true; break; }
  if (!incoming) return;
  e.decoys--; e.decoyCD = 7;
  const f = forward(e.yaw, e.pitch), r = [Math.cos(e.yaw), 0, Math.sin(e.yaw)];
  for (const m of missiles) if (!m.enemy && !m.decoy && m.target === e && dist(m.p, e.p) < 1200) { m.target = null; m.decoy = true; m.decoyP = add(e.p, add(mul(f, -340), mul(r, 170))); m.dir = norm(add(m.dir, mul(r, 0.65))); m.life = Math.min(m.life, 2.2); }
  for (let i = 0; i < 10; i++) particles.push({ p: [...e.p], v: add(mul(f, -80), add(mul(r, (i % 2 ? -1 : 1) * (70 + rand() * 100)), [0, -20 - rand() * 50, 0])), age: 0, life: 2 + rand(), size: 3, kind: 'flare', trail: [] });
  sfx('flare'); note('ENEMY FLARES', 'MISSILE LOCK BROKEN', 1.5);
  if (e.decoys === 1) say('wing', name + ' has decoys. Keep your shots apart, or close in with the cannon.', 4.5, true);
}
/** live = false during the ending fly-out: everything keeps flying, nobody fires or scores. */
function updateEnemies(dt, live = true) {
  for (const e of entities) {
    if (!e.alive) continue;
    const toPlayer = sub(player.p, e.p), distance = len(toPlayer);
    e.fire -= dt; e.ai += dt; e.decoyCD = Math.max(0, e.decoyCD - dt);
    if (live && e.type === 'ace') aceDefense(e);
    if (e.type === 'fighter' || e.type === 'ace') {
      const ace = e.type === 'ace';
      let desired = add(player.p, mul(forward(player.yaw, 0), distance > 1700 ? 60 : 160));
      if (distance < 950 || Math.sin(e.ai * 0.33) > 0.7) { const offset = ace ? 1400 : 1550; desired = add(player.p, [Math.sin(e.ai * 0.3 + e.id) * offset, 160 + Math.sin(e.ai * 0.3) * 130, Math.cos(e.ai * 0.3 + e.id) * offset]); }
      desired[1] = clamp(desired[1] + Math.sin(e.ai * 0.47 + e.id) * 160, groundY(e.p[0], e.p[2]) + 250, 3200);
      const delta = sub(desired, e.p), dyaw = Math.atan2(delta[0], -delta[2]), dpitch = Math.atan2(delta[1], Math.hypot(delta[0], delta[2]));
      e.yaw = approachAngle(e.yaw, dyaw, ace ? (e.enraged ? 1.15 : 0.95) : 0.55, dt);
      e.pitch = damp(e.pitch, clamp(dpitch, -0.37, 0.38), 1.1, dt);
      e.roll = damp(e.roll, clamp(angleDiff(dyaw, e.yaw) * 1.7, -1.12, 1.12), 3, dt);
      e.p = add(e.p, mul(forward(e.yaw, e.pitch), e.speed * dt));
      if (live && elapsed > 14 && distance > 500 && distance < 3800 && e.fire <= 0 && dot(norm(toPlayer), forward(e.yaw, e.pitch)) > 0.5) {
        spawnMissile(e, true);
        e.fire = ace ? (e.fireEvery || 7.5) * (expert ? 0.733 : 1) : 17 + rand() * 7;
      }
    } else if (e.type === 'bomber') {
      const delta = sub(e.destination, e.p);
      e.yaw = approachAngle(e.yaw, Math.atan2(delta[0], -delta[2]), 0.22, dt);
      e.pitch = damp(e.pitch, Math.atan2(delta[1], Math.hypot(delta[0], delta[2])), 0.6, dt);
      e.roll = damp(e.roll, 0, 1, dt);
      e.p = add(e.p, mul(forward(e.yaw, e.pitch), e.speed * dt));
      if (live && Math.hypot(delta[0], delta[2]) < 430) { finishMission(false, 'A bomber reached Port Meridian. Attack the bombers before other targets.'); return; }
    } else if (e.type === 'striker') {
      const delta = sub(e.destination, e.p), dyaw = Math.atan2(delta[0], -delta[2]);
      e.yaw = approachAngle(e.yaw, dyaw, 0.35, dt);
      const floor = groundY(e.p[0], e.p[2]);
      let dp = Math.atan2(delta[1], Math.hypot(delta[0], delta[2]));
      if (e.p[1] < floor + 120) dp = 0.2;
      e.pitch = damp(e.pitch, clamp(dp, -0.3, 0.3), 0.8, dt);
      e.roll = damp(e.roll, clamp(angleDiff(dyaw, e.yaw) * 1.7, -0.9, 0.9), 2.5, dt);
      e.p = add(e.p, mul(forward(e.yaw, e.pitch), e.speed * dt));
      // Their low route crosses the western islands: never let one fly through a hillside.
      e.p[1] = Math.max(e.p[1], floor + 45);
      const flat = Math.hypot(delta[0], delta[2]);
      if (live && !e.warned && flat < 3200) { e.warned = true; say('control', 'Striker inside three kilometers of the Halyard. Take it down now!', 3.6, true); sfx('warning'); }
      if (live && flat < 430) { finishMission(false, 'A striker reached the Halyard. Chase the strikers down before anything else.'); return; }
    } else if (e.type === 'frigate') {
      frigateMove(e, dt);
      if (live && elapsed > 11 && distance < 4300 && e.fire <= 0) { spawnMissile(e, true); e.fire = (expert ? 12 : 16) + rand() * 6; }
    } else if (live && e.type === 'sam' && elapsed > 11 && distance < 4300 && e.fire <= 0) {
      spawnMissile(e, true);
      e.fire = (expert ? 13 : 18) + rand() * 6;
    }
  }
}
function updateMissiles(dt, live = true) {
  enemyAlert = false;
  const list = missiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m) continue;
    m.life -= dt;
    const old = [m.p[0], m.p[1], m.p[2]];
    let targetPoint = null;
    if (m.decoy) targetPoint = m.decoyP;
    else if (m.enemy) targetPoint = player.p;
    else if (m.target?.alive) { const e = m.target; targetPoint = add(e.p, mul(forward(e.yaw, e.pitch), e.speed * Math.min(0.9, dist(m.p, e.p) / m.speed) * 0.6)); }
    if (targetPoint) { const desired = norm(sub(targetPoint, m.p)), turn = m.enemy ? (player.dodge > 0 ? 0.48 : 1.1) : 5.4; m.dir = norm(lerpV(m.dir, desired, 1 - Math.exp(-turn * dt))); }
    m.p = add(m.p, mul(m.dir, m.speed * dt));
    m.trail.push([m.p[0], m.p[1], m.p[2]]);
    if (m.trail.length > 31) m.trail.shift();
    let remove = m.life <= 0;
    if (live && m.enemy && !m.decoy) {
      if (dist(m.p, player.p) < 3800) enemyAlert = true;
      if (segmentDistance(old, m.p, player.p) < 16) { damagePlayer(m.damage); explode(m.p, 16); remove = true; }
    } else if (live && !m.enemy && m.target?.alive) {
      if (segmentDistance(old, m.p, m.target.p) < m.target.radius + 15) { hits++; damageEnemy(m.target, 105); remove = true; }
    }
    if (m.p[1] < groundY(m.p[0], m.p[2]) - 3) { if (!remove) explode(m.p, 14); remove = true; }
    // A finished mission swaps the missile list (enemy missiles go): drop this missile from the
    // new list too if it just hit, so the one that scored the final kill does not fly on.
    if (missiles !== list) {
      if (remove) { const j = missiles.indexOf(m); if (j >= 0) missiles.splice(j, 1); }
      return;
    }
    if (remove) list.splice(i, 1);
  }
  if (live && enemyAlert) { warningTimer -= dt; if (warningTimer <= 0) { sfx('warning'); warningTimer = 0.85; } }
  else warningTimer = 0;
}
const playerMatrixInto = (o) => setModel(o, player.p, player.yaw, player.pitch, player.roll + (player.dodge > 0 ? TAU * (1 - player.dodge / 0.86) * player.dodgeDir : 0));
const _pm = new Float32Array(16);
function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt;
    if (p.kind === 'debris') p.v[1] -= 55 * dt;
    if (p.kind === 'flare') { p.v[1] -= 12 * dt; p.trail.push([p.p[0], p.p[1], p.p[2]]); if (p.trail.length > 15) p.trail.shift(); }
    if (p.age >= p.life) particles.splice(i, 1);
  }
  if (particles.length > 550) particles.splice(0, particles.length - 550);
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i], s = (t.enemy ? 900 : 2300) * dt;
    t.p[0] += t.dir[0] * s; t.p[1] += t.dir[1] * s; t.p[2] += t.dir[2] * s;
    t.life -= dt;
    if (t.life <= 0) tracers.splice(i, 1);
  }
  if ((state === 'playing' || state === 'ending') && !deathHide) {
    const m = playerMatrixInto(_pm);
    for (let side = 0; side < 2; side++) {
      const tr = jetTrails[side];
      if (boosting || Math.abs(player.roll) > 0.28 || player.dodge > 0) tr.push({ p: transform([side === 0 ? -22 : 22, 0.1, 10], m), age: 0 });
      for (const pt of tr) pt.age += dt;
      while (tr.length && tr[0].age > (boosting ? 1.4 : 0.8)) tr.shift();
    }
  }
  hitFlash = Math.max(0, hitFlash - dt * 1.5); shake = Math.max(0, shake - dt * 1.8);
  setStyle($('flash'), 'opacity', (hitFlash * 0.24).toFixed(3));
  if (radioTimer > 0) { radioTimer -= dt; if (radioTimer <= 0) { if (radioQueue.length) showRadio(radioQueue.shift()); else $('radio').classList.remove('show'); } }
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('banner').classList.remove('show'); }
  if (killTimer > 0) { killTimer -= dt; if (killTimer <= 0) $('killNote').style.opacity = 0; }
}
function stepGame(dt) {
  if (state === 'playing') {
    elapsed += dt;
    remaining = Math.max(0, mission.limit - elapsed);
    if (remaining <= 0) { finishMission(false, 'Time expired. Clear the main targets before the ' + mission.minutes + '-minute limit.'); return; }
    updatePlayer(dt); if (state !== 'playing') return;
    updateEnemies(dt); if (state !== 'playing') return;
    updateMissiles(dt); if (state !== 'playing') return;
    if (phaseDelay > 0) { phaseDelay -= dt; if (phaseDelay <= 0) advancePhase(); }
    chatTimer -= dt;
    if (chatTimer <= 0) {
      chatTimer = 30 + rand() * 18;
      const lines = mission.chatter[phase - 1].filter(([who]) => who !== 'ace2' || aceList.some((e) => e.alive && e.callsign === 'ASH WREN')).filter(([who]) => who !== 'ace' || phase < 3 || aceList.some((e) => e.alive && e.callsign === 'RED KITE'));
      if (lines.length) { const [who, text] = choice(lines); say(who, text, who === 'control' ? 4.5 : 5); }
    }
    updateEffects(dt);
    updateUI();
  } else if (state === 'ending') {
    endTimer -= dt;
    player.p = add(player.p, mul(forward(player.yaw, player.pitch), player.speed * dt * 0.6));
    // The sky keeps moving behind the banner: enemies fly on and missiles finish their flight.
    updateEnemies(dt, false);
    updateMissiles(dt, false);
    updateEffects(dt);
    if (endTimer <= 0) showResults();
  }
}

// ---------------------------------------------------------------- camera and scene rendering
const inMenu = () => state === 'menu' || (state === 'manual' && manualFrom === 'menu');
function setCamera(pos, look, up = [0, 1, 0]) {
  cam.p = pos; cam.f = norm(sub(look, pos)); cam.r = norm(cross(cam.f, up)); cam.u = cross(cam.r, cam.f);
  cam.aspect = W / H; cam.tan = Math.tan(cam.fov * 0.5);
}
const _basis = new THREE.Matrix4();
function applyCamera() {
  const { p, r, u, f } = cam;
  camera.position.set(p[0], p[1], p[2]);
  _basis.set(r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, 0, 0, 0, 1);
  camera.quaternion.setFromRotationMatrix(_basis);
  const fov = cam.fov / DEG;
  if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
function project(p) { const d = sub(p, cam.p), z = dot(d, cam.f); return { x: W * 0.5 + (dot(d, cam.r) / (z * cam.tan)) * H * 0.5, y: H * 0.5 - (dot(d, cam.u) / (z * cam.tan)) * H * 0.5, z }; }
function updateCamera(dt) {
  if (inMenu()) {
    const p = [-2190 + Math.sin(menuTime * 0.11) * 75, 790 + Math.sin(menuTime * 0.2) * 9, 1650];
    const yaw = 0.12 + Math.sin(menuTime * 0.12) * 0.06;
    cam.fov = 53 * DEG;
    const m = matrix(p, yaw, 0, 0), pos = transform([-64, 40, 103], m), look = transform([-33, -35, -70], m);
    setCamera(pos, look);
    return { p, yaw, pitch: -0.02, roll: -0.14 + Math.sin(menuTime * 0.27) * 0.09 };
  }
  if (state === 'paused' || state === 'manual') return null;
  const f = forward(player.yaw, player.pitch), bankUp = transform([0, 1, 0], matrix([0, 0, 0], player.yaw, player.pitch, player.roll)), up = norm(lerpV([0, 1, 0], bankUp, viewMode === 2 ? 0.8 : 0.23));
  let desired, look;
  cam.fov = damp(cam.fov, (viewMode ? 64 : boosting ? 65 : 58) * DEG, 3, dt);
  if (viewMode === 0) {
    desired = add(sub(player.p, mul(f, 86)), [0, 27, 0]);
    look = add(player.p, mul(f, 200));
    if (!cam.ready) { cam.p = desired; cam.ready = true; }
    desired = lerpV(cam.p, desired, 1 - Math.exp(-dt * 7.5));
  } else {
    desired = add(player.p, add(mul(f, 5), [0, 2.9, 0]));
    look = add(desired, mul(f, 1000));
    cam.ready = true;
  }
  if (shake > 0) desired = add(desired, [(Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 1.6, 0]);
  setCamera(desired, look, up);
  return null;
}
function allyPosition() { const f = forward(player.yaw, 0), r = [Math.cos(player.yaw), 0, Math.sin(player.yaw)]; return add(player.p, add(mul(r, -190), add(mul(f, 65), [0, 32 + Math.sin(elapsed) * 5, 0]))); }
const _gp = [0, 0, 0], _glow = [0, 0, 0];
function renderDynamic() {
  for (const fx of particles) {
    const life = fx.age / fx.life;
    let r, g, b, s;
    if (fx.kind === 'fire') {
      if (life < 0.25) { r = 1; g = 0.92; b = 0.62; } else if (life < 0.6) { r = 1; g = 0.49; b = 0.14; } else { r = 0.65; g = 0.22; b = 0.1; }
      s = fx.size * (0.8 + Math.sin(life * Math.PI) * 1.8) * (1 - life * 0.7);
    } else if (fx.kind === 'smoke') {
      const t = life * 0.78; r = mix(0.13, 0.49, t); g = mix(0.18, 0.55, t); b = mix(0.2, 0.53, t);
      s = fx.size * (0.5 + life * 2.2);
    } else if (fx.kind === 'flare') {
      r = 1; g = 0.86; b = 0.52; s = fx.size * (1 - life * 0.65);
      ribbon(fx.trail, 1.2, 0.9, 0.82, 0.63);
    } else { r = 0.35; g = 0.3; b = 0.24; s = fx.size; }
    octa(fx.p[0], fx.p[1], fx.p[2], s, r, g, b);
  }
  for (const m of missiles) {
    const yaw = Math.atan2(m.dir[0], -m.dir[2]), pitch = Math.asin(clamp(m.dir[1], -1, 1));
    drawModel(pool.missile, m.p, yaw, pitch, 0, m.enemy ? 1.3 : 1);
    if (m.enemy) octa(m.p[0] - m.dir[0] * 4, m.p[1] - m.dir[1] * 4, m.p[2] - m.dir[2] * 4, 2.8, 1, 0.522, 0.376);
    else octa(m.p[0] - m.dir[0] * 4, m.p[1] - m.dir[1] * 4, m.p[2] - m.dir[2] * 4, 2.1, 1, 0.859, 0.475);
    if (m.enemy) ribbon(m.trail, 2.5, 0.87, 0.74, 0.59); else ribbon(m.trail, 2.1, 0.89, 0.87, 0.77);
  }
  for (const tr of tracers) { if (tr.enemy) tracerTube(tr.p, tr.dir, 70, 0.34, 0.6, 1, 0.573, 0.357); else tracerTube(tr.p, tr.dir, 70, 0.34, 0.6, 1, 0.914, 0.651); }
  if (!deathHide) for (const tr of jetTrails) ribbon(tr, boosting ? 0.7 : 0.34, 0.74, 0.83, 0.8);
  for (const e of entities) {
    if (!e.alive || e.speed <= 0) continue;
    const d = dist(e.p, player.p);
    if (e.type === 'frigate') { if (d < 9000) wake(e); continue; }
    if (d >= 8500) continue;
    const f = forward(e.yaw, e.pitch), rx = Math.cos(e.yaw), rz = Math.sin(e.yaw), big = e.type === 'bomber', off = big ? 15 : 10, back = big ? 280 : 110, w = (big ? 1.1 : 0.6) * 0.7;
    for (let s = -1; s <= 1; s += 2) {
      _gp[0] = e.p[0] + rx * s * off; _gp[1] = e.p[1]; _gp[2] = e.p[2] + rz * s * off;
      _glow[0] = _gp[0] - f[0] * back; _glow[1] = _gp[1] - f[1] * back; _glow[2] = _gp[2] - f[2] * back;
      segment(_glow, _gp, w, 0.69 * 0.815, 0.76 * 0.815, 0.74 * 0.815);
    }
  }
}
const _ground = [0, 0, 0];
function renderWorld(dt) {
  const displayJet = updateCamera(dt);
  applyCamera();
  U.time.value = time;
  for (const p of POOLS) p.begin();
  pc = 0; rv = 0;
  if (inMenu()) {
    const m = drawModel(pool.jet, displayJet.p, displayJet.yaw, displayJet.pitch, displayJet.roll);
    drawExhaust(m, 0.64);
  } else {
    for (const e of entities) {
      if (!e.alive) continue;
      if (e.type === 'radar' || e.type === 'sam' || e.type === 'frigate') {
        _ground[0] = e.p[0]; _ground[1] = e.p[1] - e.groundOffset; _ground[2] = e.p[2];
        if (e.type === 'radar') { drawModel(pool.radarBase, _ground, e.yaw); drawModel(pool.radarDish, _ground, e.yaw + time * 0.57); }
        else drawModel(e.type === 'sam' ? pool.sam : pool.frigate, _ground, e.yaw);
      } else {
        const scale = e.type === 'bomber' ? 1.2 : e.type === 'ace' ? 1 : 0.8;
        const p = e.type === 'bomber' ? pool.bomber : e.type === 'ace' ? (e.model === 'ace2' ? pool.ace2 : pool.ace) : e.type === 'striker' ? pool.striker : pool.enemy;
        const m = drawModel(p, e.p, e.yaw, e.pitch, e.roll, scale);
        if (e.type !== 'bomber') drawExhaust(m, 0.53);
      }
    }
    if (!deathHide) {
      if (viewMode === 0) {
        const m = pool.jet.next();
        playerMatrixInto(m.matrix.elements);
        m.matrixWorldNeedsUpdate = true;
        drawExhaust(m, boosting ? 1.35 : braking ? 0.42 : 0.73);
      }
      const m = drawModel(pool.jet, allyPosition(), player.yaw + 0.025, player.pitch, player.roll * 0.7, 0.74);
      drawExhaust(m, 0.55);
    }
    renderDynamic();
  }
  for (const p of POOLS) p.end();
  flushDynamic();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- HUD (crisp vector overlay over the 3D view)
const hc = $('hud'), ctx = hc.getContext('2d');
const green = '#b6ffac', paleGreen = '#d3f2b5', orange = '#ffb080';
let touchUI = false, insetBottom = 0, insetTop = 0;
const docStyle = document.documentElement.style;
function readTouchInsets() {
  touchUI = document.documentElement.classList.contains('kit-touch-on');
  insetBottom = parseFloat(docStyle.getPropertyValue('--kit-touch-bottom')) || 0;
  insetTop = parseFloat(docStyle.getPropertyValue('--kit-touch-top')) || 0;
}
const portrait = () => W < 700 && H > W;
function text(s, x, y, size = 12, color = green, align = 'left') { ctx.fillStyle = color; ctx.font = size + 'px "Courier New", monospace'; ctx.textAlign = align; ctx.fillText(s, x, y); }
function line(x1, y1, x2, y2, c = green, w = 1) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function cornerBox(x, y, w, h, c = green, l = 8) {
  ctx.strokeStyle = c; ctx.lineWidth = 1.25; ctx.beginPath();
  ctx.moveTo(x + l, y); ctx.lineTo(x, y); ctx.lineTo(x, y + l);
  ctx.moveTo(x + w - l, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + l);
  ctx.moveTo(x + w - l, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - l);
  ctx.moveTo(x + l, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - l);
  ctx.stroke();
}
function drawCompass() {
  const compact = W < 700 && H > 600, cy = compact ? Math.max(115, touchUI ? insetTop + 24 : 0) : 36, cx = W / 2, heading = (player.yaw / DEG + 360) % 360, wide = Math.min(310, W * 0.28);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - wide / 2, cy - 20, wide, 48); ctx.clip();
  for (let a = Math.floor((heading - 45) / 5) * 5; a <= heading + 45; a += 5) {
    const x = cx + ((a - heading) * wide) / 80, deg = (a + 720) % 360;
    line(x, cy + 5, x, cy + (a % 10 === 0 ? 15 : 10), '#b6ffac9e');
    if (a % 10 === 0) text(deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(Math.round(deg / 10)).padStart(2, '0'), x, cy - 2, 10, green, 'center');
  }
  ctx.restore();
  ctx.fillStyle = green; ctx.beginPath(); ctx.moveTo(cx, cy + 18); ctx.lineTo(cx - 4, cy + 25); ctx.lineTo(cx + 4, cy + 25); ctx.fill();
  text(String(Math.round(heading) % 360).padStart(3, '0'), cx, cy - 20, 12, paleGreen, 'center');
}
function drawFlightTape(side) {
  const y = H * 0.47, x = side === 0 ? W * 0.235 : W * 0.765, base = side === 0 ? player.speed * 3.6 : player.p[1], step = side === 0 ? 100 : 200, unit = side === 0 ? 2.4 : 4.8, boxW = 76, left = side === 0;
  ctx.save();
  text(left ? 'SPEED' : 'ALT', x, y - 84, 12, green, 'center');
  const tickX = x + (left ? -46 : 46);
  line(tickX, y - 68, tickX, y + 64, '#b6ffac85');
  for (let v = Math.floor((base - 150) / step) * step; v < base + 200; v += step) {
    const ty = y + (base - v) / unit;
    if (Math.abs(ty - y) > 67 || v < 0) continue;
    line(tickX, ty, tickX + (left ? 6 : -6), ty, '#b6ffac9c');
    text(String(v), tickX + (left ? -5 : 5), ty + 3, 9, '#b6ffacaa', left ? 'right' : 'left');
  }
  ctx.fillStyle = '#123c292c'; ctx.fillRect(x - boxW / 2, y - 15, boxW, 29); cornerBox(x - boxW / 2, y - 15, boxW, 29, green, 6);
  text(String(Math.max(0, Math.round(base))).padStart(side ? 4 : 3, '0'), x, y + 7, 22, green, 'center');
  if (left) { text('KM/H', x, y + 33, 9, '#c4dfad99', 'center'); if (boosting) text('AFTERBURNER', x, y + 53, 10, orange, 'center'); else if (braking) text('AIR BRAKE', x, y + 53, 10, orange, 'center'); }
  else { text('M', x, y + 33, 9, '#c4dfad99', 'center'); text('AGL ' + String(Math.round(player.p[1] - groundY(player.p[0], player.p[2]))).padStart(4, '0'), x, y + 53, 9, '#c4dfad99', 'center'); }
  ctx.restore();
}
function drawReticle() {
  const f = forward(player.yaw, player.pitch), p = project(add(player.p, mul(f, 3500))), cx = clamp(p.x, W * 0.35, W * 0.65), cy = clamp(p.y, H * 0.28, H * 0.66);
  ctx.save(); ctx.globalAlpha = 0.7;
  line(cx - 21, cy, cx - 8, cy); line(cx + 8, cy, cx + 21, cy); line(cx, cy - 21, cx, cy - 8); line(cx, cy + 8, cx, cy + 15);
  ctx.beginPath(); ctx.strokeStyle = green; ctx.arc(cx, cy, 3, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.37; ctx.setLineDash([2, 8]); ctx.beginPath(); ctx.arc(cx, cy, H * 0.105, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.translate(W * 0.5, H * 0.46); ctx.rotate(-player.roll * 0.25); ctx.globalAlpha = 0.23;
  const shift = (player.pitch / DEG) * 4;
  for (let a = -20; a <= 20; a += 10) {
    const y = a * 4 + shift;
    if (Math.abs(y) > 115) continue;
    const width = a === 0 ? 100 : 70;
    line(-width, y, -30, y, green); line(30, y, width, y, green); line(-width, y, -width, y + (a < 0 ? -5 : 5), green); line(width, y, width, y + (a < 0 ? -5 : 5), green);
    if (a !== 0) text(String(Math.abs(a)), width + 7, y + 3, 10, green);
  }
  ctx.restore();
  if (mouseMode && mouse.active) {
    ctx.save(); ctx.globalAlpha = 0.45;
    const x = W / 2 + mouse.x, y = H / 2 + mouse.y;
    ctx.setLineDash([3, 6]); line(cx, cy, x, y, paleGreen); ctx.setLineDash([]);
    ctx.beginPath(); ctx.strokeStyle = paleGreen; ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}
function drawTarget(e, selected) {
  const p = project(e.p), distance = dist(e.p, player.p);
  if (p.z < 2 || p.x < 22 || p.x > W - 22 || p.y < 75 || p.y > H - 55) { if (selected) drawTargetArrow(e); return; }
  if (!selected && distance > (e.primary ? 12000 : 4600)) return;
  const sz = selected ? clamp(38 + 13000 / distance, 40, 73) : 20;
  const co = selected ? (lock >= 0.99 ? green : '#d7f6a4bb') : e.primary ? '#ffad81ce' : '#b2e8a18c';
  const x = p.x - sz / 2, y = p.y - sz / 2;
  cornerBox(x, y, sz, sz, co, selected ? 10 : 5);
  if (e.primary) text('TGT', x - 6, y - 6, 9, orange, 'right');
  if (selected) {
    text(label(e), p.x, y - 10, 11, co, 'center');
    text(Math.round(distance).toLocaleString() + ' M', p.x, y + sz + 16, 11, co, 'center');
    if (lock > 0.03) {
      ctx.strokeStyle = co; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.arc(p.x, p.y, sz * 0.7, -Math.PI / 2, -Math.PI / 2 + lock * TAU); ctx.stroke();
      if (lock >= 0.99) { text('LOCK', p.x, y - 26, 12, green, 'center'); ctx.beginPath(); ctx.arc(p.x, p.y, sz * 0.54, 0, TAU); ctx.stroke(); }
    } else if (distance > 3800) text('OUT OF RANGE', p.x, y + sz + 29, 9, '#c9e2b2ab', 'center');
    if (e.hp < e.maxhp) { line(x, y + sz + 23, x + sz, y + sz + 23, '#f4b78a4d', 2); line(x, y + sz + 23, x + (sz * Math.max(0, e.hp)) / e.maxhp, y + sz + 23, orange, 2); }
  } else if (e.primary) text(label(e), p.x, y + sz + 13, 9, '#f0c398bd', 'center');
}
function drawTargetArrow(e) {
  const d = sub(e.p, cam.p);
  let x = dot(d, cam.r), y = -dot(d, cam.u);
  const z = dot(d, cam.f);
  if (z < 0) y = Math.abs(y) + 1200;
  const n = Math.hypot(x, y) || 1; x /= n; y /= n;
  const limitX = W / 2 - 66, limitY = H * 0.35;
  const factor = Math.min(limitX / Math.max(0.001, Math.abs(x)), limitY / Math.max(0.001, Math.abs(y)));
  const px = W / 2 + x * factor, py = clamp(H * 0.46 + y * factor, 135, H - 122 - (touchUI ? insetBottom * 0.5 : 0));
  ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(y, x)); ctx.strokeStyle = orange; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-12, -7); ctx.lineTo(0, 0); ctx.lineTo(-12, 7); ctx.stroke(); ctx.restore();
  const align = px > W * 0.7 ? 'right' : px < W * 0.3 ? 'left' : 'center', tx = clamp(px, 60, W - 60);
  text(label(e) + ' ' + (dist(e.p, player.p) / 1000).toFixed(1) + ' KM', tx, py + 25, 10, orange, align);
  if (z < 0) text('BEHIND', tx, py + 38, 9, '#f4c59d99', align);
}
function touchRadarY(size) {
  const sc = kit.settings.get().touchScale || 1, stickReserve = 136 * sc + 12;
  const top = Math.max(insetTop + 8, H < 520 ? 120 : 128);
  const want = portrait() ? H - insetBottom - 86 - size : H - stickReserve - size - 14;
  return Math.max(top, want);
}
function drawRadar() {
  const size = touchUI ? (H < 520 ? 91 : 112) : clamp(H * 0.226, 138, 188), x = touchUI ? 20 : 30, y = touchUI ? touchRadarY(size) : H - size - 47;
  const cx = x + size * 0.5, cy = y + size * 0.62, scale = size / 7800;
  ctx.fillStyle = '#06291cd1'; ctx.fillRect(x, y, size, size);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, size - 2, size - 2); ctx.clip();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-player.yaw); ctx.scale(scale, scale); ctx.globalAlpha = 0.93; ctx.drawImage(mapCanvas, -14000 - player.p[0], -14000 - player.p[2], 28000, 28000); ctx.restore();
  for (let i = 1; i < 4; i++) { line(x + (size * i) / 4, y, x + (size * i) / 4, y + size, '#b7ff9624'); line(x, y + (size * i) / 4, x + size, y + (size * i) / 4, '#b7ff9624'); }
  ctx.strokeStyle = '#b7ff9634';
  for (let r = 1; r <= 2; r++) { ctx.beginPath(); ctx.arc(cx, cy, size * 0.32 * r, 0, TAU); ctx.stroke(); }
  line(cx, cy, cx - size * 0.45, y, '#b7ff965a'); line(cx, cy, cx + size * 0.45, y, '#b7ff965a');
  const sa = time * 0.7;
  line(cx, cy, cx + Math.cos(sa) * size, cy + Math.sin(sa) * size, '#d7f6a418');
  const cyaw = Math.cos(player.yaw), syaw = Math.sin(player.yaw);
  const rpx = (p) => cx + (cyaw * (p[0] - player.p[0]) + syaw * (p[2] - player.p[2])) * scale;
  const rpy = (p) => cy + (-syaw * (p[0] - player.p[0]) + cyaw * (p[2] - player.p[2])) * scale;
  if (mission.protect) {
    const hx = rpx(mission.protect), hy = rpy(mission.protect);
    ctx.fillStyle = '#81d9de'; ctx.beginPath(); ctx.moveTo(hx, hy - 5); ctx.lineTo(hx + 5, hy); ctx.lineTo(hx, hy + 5); ctx.lineTo(hx - 5, hy); ctx.closePath(); ctx.fill();
  }
  for (const e of entities) {
    if (!e.alive) continue;
    const rx = rpx(e.p), ry = rpy(e.p), s = e.type === 'ace' ? 6 : e.type === 'frigate' ? 5 : 4;
    ctx.fillStyle = e.primary ? '#ffae86' : '#d0f0a5'; ctx.fillRect(rx - s / 2, ry - s / 2, s, s);
    if (e.id === targetId) cornerBox(rx - 6, ry - 6, 12, 12, green, 3);
  }
  for (const m of missiles) if (m.enemy && !m.decoy) { ctx.fillStyle = '#fff0b6'; ctx.fillRect(rpx(m.p) - 1.2, rpy(m.p) - 1.2, 2.5, 2.5); }
  const ally = allyPosition();
  ctx.fillStyle = '#81d9de'; ctx.fillRect(rpx(ally) - 2, rpy(ally) - 2, 4, 4);
  ctx.fillStyle = green; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 5); ctx.lineTo(cx, cy + 2); ctx.lineTo(cx + 4, cy + 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  cornerBox(x, y, size, size, green, 11);
  text('RDR / 8 KM', x, y - 9, touchUI ? 9 : 10, green);
  if (!touchUI) text((mission.id === 'undertow' ? 'HARBOR' : 'MERIDIAN') + ' / TRACK ' + String(entities.filter((e) => e.alive).length).padStart(2, '0'), x, y + size + 16, 9, '#c0e6a9a6');
}
// Touch: ammo and flares live on the buttons; this strip keeps rails, cannon heat and the airframe.
function drawTouchWeapons() {
  const width = 148, x = W - width - 20, co = player.hp < 30 ? orange : green;
  const y = portrait() ? Math.max(insetTop + 8, H - insetBottom - 86 - 46) : clamp(H - insetBottom - 46, 98, Math.max(98, H - 60));
  ctx.fillStyle = '#08221a73'; ctx.fillRect(x - 5, y - 4, width + 10, 48);
  for (let i = 0; i < 2; i++) text((i ? 'R ' : 'L ') + (player.rails[i] <= 0 ? 'READY' : player.rails[i].toFixed(1) + ' S'), x + (i * width) / 2, y + 8, 9, player.rails[i] > 0 ? orange : green);
  text(player.overheat ? 'HOT' : 'GUN', x, y + 21, 9, player.overheat ? orange : green);
  ctx.fillStyle = '#c1e59b29'; ctx.fillRect(x + 32, y + 16, width - 32, 4);
  ctx.fillStyle = player.overheat ? orange : green; ctx.fillRect(x + 32, y + 16, ((width - 32) * player.heat) / 100, 4);
  text('HULL', x, y + 33, 9, co); text(Math.ceil(player.hp) + '%', x + width, y + 33, 10, co, 'right');
  ctx.fillStyle = '#c1e59b29'; ctx.fillRect(x, y + 37, width, 4); ctx.fillStyle = co; ctx.fillRect(x, y + 37, (width * player.hp) / 100, 4);
}
function drawWeapons() {
  if (touchUI) { drawTouchWeapons(); return; }
  const compact = H < 550 || W < 700, width = compact ? 167 : 190, x = W - width - 34, y = H - (compact ? 159 : 187), co = player.hp < 30 ? orange : green, ammoSize = compact ? 24 : 29;
  text('RF–07 / KESTREL', x, y, 9, '#c4dfadb8'); line(x, y + 9, x + width, y + 9, '#a9d69260');
  text('MSL', x, y + 37, 12, green); text(String(player.ammo).padStart(2, '0'), x + width, y + 40, ammoSize, green, 'right');
  for (let i = 0; i < 2; i++) {
    const rx = x + i * (width / 2 + 3), rw = width / 2 - 4;
    ctx.strokeStyle = player.rails[i] > 0 ? '#ffb08070' : '#b6ffac80'; ctx.strokeRect(rx, y + 49, rw, 18);
    text((i ? 'R ' : 'L ') + (player.rails[i] <= 0 ? 'READY' : player.rails[i].toFixed(1) + ' S'), rx + rw / 2, y + 61, 9, player.rails[i] > 0 ? orange : green, 'center');
  }
  text(player.overheat ? 'GUN / HOT' : 'GUN / 20MM', x, y + 84, 9, player.overheat ? orange : green); text('∞', x + width, y + 85, 14, green, 'right');
  ctx.fillStyle = '#c1e59b29'; ctx.fillRect(x, y + 91, width, 3); ctx.fillStyle = player.overheat ? '#ffad79' : '#c9ee9a'; ctx.fillRect(x, y + 91, (width * player.heat) / 100, 3);
  text('FLARES ' + String(player.flares).padStart(2, '0'), x, y + 111, 10, green); text(player.flareCD > 0 ? player.flareCD.toFixed(1) + ' S' : 'READY', x + width, y + 111, 9, player.flareCD > 0 ? orange : green, 'right');
  text('AIRFRAME', x, y + 133, 9, co); text(Math.ceil(player.hp) + '%', x + width, y + 133, 10, co, 'right');
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i < Math.ceil((player.hp / 100) * 12) ? co : '#d2edbb25'; ctx.fillRect(x + (i * width) / 12, y + 140, width / 12 - 3, 5); }
}
function drawCockpit() {
  ctx.save(); ctx.strokeStyle = '#102830'; ctx.lineWidth = W < 800 ? 20 : 34; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-30, H * 0.93); ctx.lineTo(W * 0.16, H * 0.18); ctx.lineTo(W * 0.35, -40); ctx.moveTo(W + 30, H * 0.93); ctx.lineTo(W * 0.84, H * 0.18); ctx.lineTo(W * 0.65, -40); ctx.stroke();
  ctx.strokeStyle = '#5d79766b'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#0d202bdc'; ctx.beginPath(); ctx.moveTo(0, H * 0.8); ctx.lineTo(W * 0.24, H * 0.86); ctx.lineTo(W * 0.37, H * 0.95); ctx.lineTo(W * 0.63, H * 0.95); ctx.lineTo(W * 0.76, H * 0.86); ctx.lineTo(W, H * 0.8); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.restore();
}
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const show = state === 'playing' || state === 'paused' || state === 'ending' || (state === 'manual' && manualFrom === 'paused');
  if (!show) return;
  if (viewMode === 2) drawCockpit();
  ctx.lineWidth = 1; ctx.lineCap = 'square';
  drawCompass(); drawReticle();
  if (touchUI && H < 520) { text('SPD ' + Math.round(player.speed * 3.6), W * 0.4, 78, 11, green, 'center'); text('ALT ' + Math.round(player.p[1]), W * 0.6, 78, 11, green, 'center'); }
  else if (W > 700 || H < 550) { drawFlightTape(0); drawFlightTape(1); }
  else { text('SPD ' + Math.round(player.speed * 3.6), 26, H * 0.4, 12); text('ALT ' + Math.round(player.p[1]), W - 26, H * 0.4, 12, green, 'right'); }
  for (const e of entities) if (e.alive && e.id !== targetId) drawTarget(e, false);
  const target = getTarget();
  if (target) drawTarget(target, true);
  for (const m of missiles) if (m.enemy && !m.decoy) {
    const p = project(m.p);
    if (p.z > 1 && p.x > 15 && p.x < W - 15 && p.y > 90 && p.y < H - 40) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.strokeStyle = '#ffb27c'; ctx.strokeRect(-4, -4, 8, 8); ctx.restore(); text('MSL', p.x, p.y - 10, 8, '#ffd09a', 'center'); }
  }
  const a = project(allyPosition());
  if (a.z > 0 && a.x > 30 && a.x < W - 30 && a.y > 140 && a.y < H - 200) { cornerBox(a.x - 7, a.y - 7, 14, 14, '#a0ece499', 3); text('GANNET 2', a.x, a.y - 15, 8, '#a0ece4ad', 'center'); }
  if (mission.protect && phase === 2) {
    const h = project(mission.protect);
    if (h.z > 0 && h.x > 30 && h.x < W - 30 && h.y > 90 && h.y < H - 60) { cornerBox(h.x - 9, h.y - 9, 18, 18, '#81d9deb0', 4); text('HALYARD', h.x, h.y - 16, 9, '#a0ece4c0', 'center'); }
  }
  drawRadar(); drawWeapons();
  if (boosting) {
    ctx.save(); ctx.globalAlpha = 0.22;
    const cx = W / 2, cy = H * 0.47;
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * TAU + Math.sin(i) * 0.3, r = H * 0.4 + ((time * 110 + i * 73) % (H * 0.25)), s = 25 + player.speed * 0.06;
      line(cx + Math.cos(ang) * r * 1.8, cy + Math.sin(ang) * r, cx + Math.cos(ang) * (r + s) * 1.8, cy + Math.sin(ang) * (r + s), '#e7efde');
    }
    ctx.restore();
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

// DOM HUD: write only what changed.
const domCache = new WeakMap();
function setText(el, v) { const c = domCache.get(el) || {}; if (c.text !== v) { el.textContent = v; c.text = v; domCache.set(el, c); } }
function setStyle(el, prop, v) { const c = domCache.get(el) || {}; const k = 's:' + prop; if (c[k] !== v) { el.style[prop] = v; c[k] = v; domCache.set(el, c); } }
const touchLabels = { missile: '', flare: '', gun: '' };
function updateUI(force = false) {
  setText($('scoreValue'), pad6(score));
  setText($('timeValue'), formatTime(remaining));
  setStyle($('timeValue'), 'color', remaining < 45 ? '#ffab7a' : '');
  let warning = '', terrain = false;
  if (boundTimer < 9.8) warning = 'RETURN TO AREA ' + Math.ceil(boundTimer);
  else if (groundAlert) { warning = 'PULL UP'; terrain = true; }
  else if (enemyAlert) warning = 'MISSILE ALERT';
  const w = $('warning');
  if (w.hidden !== !warning) w.hidden = !warning;
  if (warning) { setText(w, warning); if (w.classList.contains('terrain') !== terrain) w.classList.toggle('terrain', terrain); }
  aceList.forEach((e, i) => setStyle($('aceHealth' + i), 'width', ((Math.max(0, e.alive ? e.hp : 0) / e.maxhp) * 100).toFixed(1) + '%'));
  setText($('assistFlag'), (expert ? 'VETERAN FLIGHT' : 'ASSISTED FLIGHT') + ' / ' + ['CHASE VIEW', 'HUD VIEW', 'COCKPIT VIEW'][viewMode] + (mouseMode ? ' / MOUSE' : '') + (invertPitch ? ' / INVERTED' : ''));
  if (kit.touch && (touchUI || force)) {
    const m = 'MSL ' + player.ammo, f = 'FLR ' + player.flares, g = player.overheat ? 'HOT' : 'GUN';
    if (m !== touchLabels.missile) { kit.touch.setLabel('missile', m); touchLabels.missile = m; }
    if (f !== touchLabels.flare) { kit.touch.setLabel('flare', f); touchLabels.flare = f; }
    if (g !== touchLabels.gun) { kit.touch.setLabel('gun', g); touchLabels.gun = g; }
  }
}

// ---------------------------------------------------------------- prompts for keyboard, gamepad and touch
const PROMPTS = {
  keyboard: { missile: 'SPACE', brake: 'X', boost: 'SHIFT', flare: 'F', start: 'ENTER' },
  gamepad: { missile: 'A', brake: 'LT', boost: 'RB', flare: 'B', start: 'A' },
  touch: { missile: 'MSL', brake: 'BRAKE', boost: 'BOOST', flare: 'FLR', start: 'TAP' },
};
const promptSource = () => (input.source === 'gamepad' ? 'gamepad' : input.source === 'touch' ? 'touch' : 'keyboard');
const HELP = {
  keyboard: [['WASD', 'FLY'], ['SHIFT', 'BOOST'], ['X', 'BRAKE'], ['SPACE', 'MISSILE'], ['J', 'GUN'], ['F', 'FLARES'], ['TAB', 'TARGET'], ['Q/E', 'ROLL'], ['C', 'VIEW']],
  gamepad: [['L-STICK', 'FLY'], ['RB', 'BOOST'], ['LT', 'BRAKE'], ['A', 'MISSILE'], ['X/RT', 'GUN'], ['B', 'FLARES'], ['Y', 'TARGET'], ['LB', 'ROLL'], ['RS', 'VIEW']],
};
const MANUAL = {
  keyboard: [['Climb / Dive', ['W', 'S', 'or', '↑', '↓']], ['Bank and turn', ['A', 'D', 'or', '←', '→']], ['Fire missile', ['SPACE', 'or', 'R-CLICK']], ['Fire cannon', ['J', 'or', 'L-CLICK']], ['Afterburner', ['SHIFT']], ['Air brake / Tight turn', ['X']], ['Release flares', ['F']], ['Change target', ['TAB']], ['Barrel roll', ['Q', 'E']], ['Change view', ['C']], ['Mouse flight', ['M']], ['Pause', ['ESC']]],
  gamepad: [['Fly', ['L-STICK', 'or', 'D-PAD']], ['Fire missile', ['A']], ['Fire cannon', ['X', 'or', 'RT']], ['Afterburner', ['RB']], ['Air brake / Tight turn', ['LT']], ['Release flares', ['B']], ['Change target', ['Y']], ['Barrel roll', ['LB']], ['Change view', ['RS', 'or', 'BACK']], ['Pause', ['START']], ['Menus', ['D-PAD', 'A']], ['Back', ['B']]],
  touch: [['Fly', ['LEFT THUMB']], ['Fire missile', ['MSL']], ['Fire cannon', ['GUN']], ['Afterburner', ['BOOST']], ['Air brake / Tight turn', ['BRAKE']], ['Release flares', ['FLR']], ['Change target', ['TARGET']], ['Barrel roll', ['ROLL']], ['Change view', ['VIEW']], ['Pause', ['II']]],
};
let manualDevice = 'keyboard', promptKey = '';
function key(textValue) { const k = document.createElement('span'); k.className = 'key'; k.textContent = textValue; return k; }
function renderManual() {
  const grid = $('manualGrid');
  grid.replaceChildren(...MANUAL[manualDevice].map(([what, keys]) => {
    const row = document.createElement('div'), a = document.createElement('span'), b = document.createElement('span');
    a.textContent = what;
    keys.forEach((k, i) => { if (i) b.append(' '); b.append(k === 'or' ? 'or' : key(k)); });
    row.append(a, b);
    return row;
  }));
  document.querySelectorAll('.manualTab').forEach((t) => t.setAttribute('aria-pressed', t.dataset.device === manualDevice ? 'true' : 'false'));
}
function updatePrompts(force = false) {
  const src = promptSource();
  if (!force && src === promptKey) return;
  promptKey = src;
  const k = PROMPTS[src], hint = $('startHint');
  hint.replaceChildren();
  if (src === 'touch') hint.append('TOUCH FLIGHT CONTROLS READY');
  else hint.append(key(k.start), ' TO TAKE FLIGHT');
  const strip = $('helpStrip');
  strip.replaceChildren(...(HELP[src] || HELP.keyboard).map(([kk, what]) => { const s = document.createElement('span'), b = document.createElement('b'); b.textContent = kk; s.append(b, ' ' + what); return s; }));
  if (state !== 'menu' && phase >= 1 && phase <= 3) $('nextHint').textContent = hintText(phaseInfo().kind);
}
input.onSourceChange(() => {
  updatePrompts();
  // The touch layer shows or hides on the next frame and the HUD moves with it: place the pills again.
  requestAnimationFrame(layoutTouch);
});

// ---------------------------------------------------------------- screens, settings and menus
function setState(s) {
  state = s;
  kit.touch?.suspend(s !== 'playing', 'game');
}
function focusEl(el) { if (el && !el.hidden) el.focus({ preventScroll: true }); }
function openManual(from) {
  manualFrom = from;
  setState('manual');
  $('manual').hidden = false;
  if (from === 'paused') $('pause').hidden = true;
  document.body.classList.remove('playing');
  manualDevice = promptSource();
  renderManual();
  focusEl($('manualDone'));
}
function closeManual() {
  setState(manualFrom);
  if (manualFrom === 'paused') $('pause').hidden = false;
  $('manual').hidden = true;
  focusEl(manualFrom === 'menu' ? $('launchBtn') : $('resumeBtn'));
}
function pauseGame() {
  if (state === 'playing') {
    setState('paused');
    $('pause').hidden = false;
    document.body.classList.remove('playing');
    focusEl($('resumeBtn'));
  } else if (state === 'paused') {
    setState('playing');
    $('pause').hidden = true;
    document.body.classList.add('playing');
    initAudio();
    weaponGate = true;
    input.settle();
    layoutTouch();
  }
}
function returnToBase() {
  setState('menu');
  for (const id of ['pause', 'result', 'manual', 'gameUI']) $(id).hidden = true;
  $('menu').hidden = false;
  document.body.classList.remove('playing');
  entities = []; particles = []; missiles = []; tracers = []; jetTrails = [[], []]; aceList = [];
  cam.ready = false; deathHide = false;
  updateMissionCard();
  focusEl($('launchBtn'));
}
function toggleMouse() {
  mouseMode = !mouseMode;
  mouse.x = mouse.y = 0; mouse.active = false;
  updateSettings();
  if (state === 'playing') note(mouseMode ? 'MOUSE FLIGHT ON' : 'KEYBOARD FLIGHT', 'PRESS M TO CHANGE', 1.5);
}
function cycleView() { viewMode = (viewMode + 1) % 3; cam.ready = false; sfx('ui'); if (state === 'playing') note(['CHASE VIEW', 'HUD VIEW', 'COCKPIT VIEW'][viewMode], '', 0.8); }
function applyRetro() {
  U.retro.value = retro ? 1 : 0;
  kit.setPixelHeight(retro ? retroLines() : 0);
  document.body.classList.toggle('clean', !retro);
  updateSnapGrid();
}
const _buf = new THREE.Vector2();
function updateSnapGrid() {
  if (!retro) { snapGrid.value.set(1e5, 1e5); return; }
  renderer.getDrawingBufferSize(_buf);
  snapGrid.value.set(Math.max(1, _buf.x) / 2, Math.max(1, _buf.y) / 2);
}
function updateSettings() {
  setText($('audioToggle'), muted ? 'OFF' : 'ON');
  setText($('menuAudio'), muted ? 'SOUND OFF' : 'SOUND ON');
  setText($('musicToggle'), musicOn ? 'ON' : 'OFF');
  setText($('retroToggle'), retro ? 'ON' : 'OFF');
  setText($('mouseToggle'), mouseMode ? 'ON' : 'OFF');
  setText($('modeToggle'), expert ? 'VETERAN' : 'ARCADE');
  setText($('pitchToggle'), invertPitch ? 'INVERTED' : 'NORMAL');
  setText($('volValue'), String(Math.round(volume * 100)));
  setAudioLevel();
  saveSettings();
}
function updateBest() {
  const best = bests[MISSIONS[selectedMission].id] || 0;
  setText($('bestMenu'), 'PERSONAL BEST  ' + (best ? pad6(best) : '— — — — —'));
}
function updateMissionCard() {
  const m = MISSIONS[selectedMission];
  document.querySelectorAll('.missionTab').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.mission === selectedMission ? 'true' : 'false'));
  setText($('cardLabel'), 'MISSION ' + m.code + ' / ' + formatTime(m.limit));
  setText($('cardName'), m.name);
  setText($('cardTag'), m.tag);
  $('cardRoute').replaceChildren(...m.route.map((t, i) => { const d = document.createElement('div'), b = document.createElement('b'), s = document.createElement('span'); b.textContent = '0' + (i + 1); s.textContent = t; d.append(b, s); return d; }));
  const best = bests[m.id] || 0;
  setText($('cardBest'), best ? 'CLEARED / RANK ' + (ranks[m.id] || '—') + ' / BEST ' + pad6(best) : 'NOT CLEARED YET');
  updateBest();
  if (state === 'menu' || inMenu()) applyPalette(m.palette);
}
function selectMission(i) {
  selectedMission = clamp(i, 0, MISSIONS.length - 1);
  mission = MISSIONS[selectedMission];
  saveSettings();
  updateMissionCard();
}
function bind(id, fn) { $(id).addEventListener('click', () => { sfx('ui'); fn(); }); }
bind('launchBtn', () => startMission());
bind('manualBtn', () => openManual('menu'));
bind('closeManual', closeManual);
bind('manualDone', () => { const from = manualFrom; closeManual(); if (from === 'menu') startMission(); else pauseGame(); });
bind('pauseBtn', pauseGame);
bind('resumeBtn', pauseGame);
bind('pauseManual', () => openManual('paused'));
bind('restartBtn', () => startMission());
bind('baseBtn', returnToBase);
bind('retryBtn', () => startMission());
bind('nextBtn', () => { const i = MISSIONS.indexOf(mission) + 1; if (MISSIONS[i]) startMission(i); });
bind('resultBase', returnToBase);
const toggleAudio = () => { initAudio(); muted = !muted; updateSettings(); };
bind('menuAudio', toggleAudio);
bind('audioToggle', toggleAudio);
bind('musicToggle', () => { musicOn = !musicOn; updateSettings(); });
bind('retroToggle', () => { retro = !retro; applyRetro(); updateSettings(); });
bind('mouseToggle', toggleMouse);
bind('modeToggle', () => { expert = !expert; updateSettings(); });
bind('pitchToggle', () => { invertPitch = !invertPitch; updateSettings(); });
bind('volDown', () => { volume = clamp(Math.round(volume * 20 - 1) / 20, 0, 1); updateSettings(); });
bind('volUp', () => { volume = clamp(Math.round(volume * 20 + 1) / 20, 0, 1); updateSettings(); });
bind('menuSettings', () => kit.menu.open());
bind('gfxBtn', () => kit.menu.open());
document.querySelectorAll('.missionTab').forEach((b) => b.addEventListener('click', () => { sfx('ui'); selectMission(+b.dataset.mission); }));
document.querySelectorAll('.manualTab').forEach((b) => b.addEventListener('click', () => { sfx('ui'); manualDevice = b.dataset.device; renderManual(); }));
bind('fullBtn', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else throw new Error('Fullscreen is not available');
  } catch {
    $('fullBtn').textContent = 'USE F11';
    setTimeout(() => ($('fullBtn').textContent = '⛶'), 2200);
  }
});

// Menus with a gamepad or the keyboard: stick / D-pad / arrows move between buttons, A or Enter
// presses, B or Esc goes back.
const SCREEN_DEFAULT = { menu: 'launchBtn', paused: 'resumeBtn', manual: 'manualDone', result: 'retryBtn' };
const SCREEN_ROOT = { menu: 'menu', paused: 'pause', manual: 'manual', result: 'result' };
let navDir = '', navRepeat = 0;
function screenButtons(root) { return [...root.querySelectorAll('button')].filter((b) => !b.disabled && !b.hidden && b.offsetParent !== null); }
function moveFocus(root, dir) {
  const items = screenButtons(root);
  if (!items.length) return;
  const cur = document.activeElement;
  if (!items.includes(cur)) { focusEl($(SCREEN_DEFAULT[state]) || items[0]); return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    const along = dir === 'down' ? dy : dir === 'up' ? -dy : dir === 'right' ? dx : -dx;
    const across = dir === 'down' || dir === 'up' ? Math.abs(dx) : Math.abs(dy);
    if (along <= 4) continue;
    const s = along + across * 2.2;
    if (s < bestScore) { bestScore = s; best = el; }
  }
  if (best) { best.focus(); sfx('ui'); }
}
// Tab cycles targets in flight, but in the game's own menus it should move focus as usual. The
// kit would swallow it (it is a mapped key), so keep it away from the kit outside of flight.
addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && state !== 'playing' && !kit.menu.isOpen) e.stopPropagation();
}, true);
function menuBack() {
  if (state === 'manual') closeManual();
  else if (state === 'paused') pauseGame();
}
function menuInput(dt) {
  const rootId = SCREEN_ROOT[state];
  if (!rootId) return;
  const root = $(rootId), v = input.vector('nav');
  let dir = '';
  if (Math.abs(v.x) > 0.55 || Math.abs(v.y) > 0.55) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
  if (dir) {
    navRepeat -= dt;
    if (dir !== navDir || navRepeat <= 0) { moveFocus(root, dir); navRepeat = dir !== navDir ? 0.38 : 0.14; }
  }
  navDir = dir;
  if (input.pressed('confirm')) {
    const el = document.activeElement;
    if (el && el.tagName === 'BUTTON' && root.contains(el)) el.click();
    else $(SCREEN_DEFAULT[state])?.click();
    input.settle();
    return;
  }
  if (input.pressed('back') || input.pressed('pause')) { menuBack(); input.settle(); }
}
function gameInput() {
  if (input.pressed('pause')) { pauseGame(); return; }
  if (input.pressed('flare')) releaseFlares();
  if (input.pressed('target')) selectTarget(true);
  if (input.pressed('view')) cycleView();
  if (input.pressed('mouseFlight')) toggleMouse();
  if (input.pressed('rollLeft')) rollDodge(-1);
  if (input.pressed('rollRight')) rollDodge(1);
  if (input.pressed('roll')) { const x = input.vector('fly').x; rollDodge(x < -0.2 ? -1 : x > 0.2 ? 1 : (lastRollDir = -lastRollDir)); }
  const p = input.pointer;
  if (mouseMode && p.type === 'mouse' && p.over && (p.x !== mouse.lx || p.y !== mouse.ly)) {
    if (!Number.isNaN(mouse.lx)) mouse.active = true;
    mouse.lx = p.x; mouse.ly = p.y;
    mouse.x = p.x - W / 2; mouse.y = p.y - H / 2;
  }
}

// Touch HUD: the top pills sit under the mission panel; everything else reads the kit's insets.
function layoutTouch() {
  if (!kit.touch || $('gameUI').hidden) return;
  const r = document.querySelector('.missionHUD').getBoundingClientRect();
  kit.touch.placeTop('left', Math.round(Math.max(56, r.bottom + 8)));
}
addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state === 'playing') pauseGame(); audio.ctx?.suspend().catch(() => {}); }
  else if (!kit.paused) audio.ctx?.resume().catch(() => {});
});
kit.onResize((w, h) => {
  W = w; H = h; DPR = Math.min(devicePixelRatio || 1, 2);
  hc.width = Math.round(W * DPR); hc.height = Math.round(H * DPR);
  cam.aspect = W / H;
  if (retro) kit.setPixelHeight(retroLines());
  updateSnapGrid();
  layoutTouch();
});
kit.onQuality(() => updateSnapGrid());

// ---------------------------------------------------------------- start
applyRetro();
updateSettings();
updateMissionCard();
updatePrompts(true);
renderManual();
applyPalette(MISSIONS[selectedMission].palette);
// Pre-build the pipelines that appear later (flames, particles, trails, every model) behind the menu.
{
  updateCamera(0); applyCamera();
  for (const p of POOLS) { p.begin(); drawModel(p, cam.p.map((v, i) => v + cam.f[i] * 120)); p.end(); }
  octa(cam.p[0] + cam.f[0] * 120, cam.p[1] + cam.f[1] * 120, cam.p[2] + cam.f[2] * 120, 1, 1, 1, 1);
  segment(add(cam.p, mul(cam.f, 120)), add(cam.p, mul(cam.f, 140)), 1, 1, 1, 1);
  flushDynamic();
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn('Shader warm-up skipped.', e); }
  for (const p of POOLS) { p.begin(); p.end(); }
  pc = 0; rv = 0; flushDynamic();
}
$('menu').hidden = false;
focusEl($('launchBtn'));
kit.start((rawDt) => {
  const dt = Math.min(rawDt, 0.05);
  time += dt;
  if (inMenu()) menuTime += dt;
  readTouchInsets();
  if (state === 'playing') gameInput();
  else if (state !== 'ending') menuInput(dt);
  stepGame(dt);
  musicTick();
  renderWorld(dt);
  drawHUD();
});
window.__skyRascal = { get state() { return state; }, get mission() { return mission.id; }, startMission };
