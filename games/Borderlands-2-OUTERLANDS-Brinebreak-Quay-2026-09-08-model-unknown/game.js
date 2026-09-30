// OUTERLANDS — Brinebreak Quay. Game rules, HUD, menus and input, on the shared 3D kit.
// The rules, balance numbers, dialogue and level come from the original single-file game.
// world.js builds the level, art.js the meshes, gfx.js the three.js scene, audio.js the sound.
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { $, clamp, lerp, TAU, DEG, rand, rnd, C, color, clone } from './util.js';
import { buildWorld, makeSkyGrid, BOUNTY_BOARD } from './world.js';
import { createGraphics } from './gfx.js';
import { createAudio } from './audio.js';

// The original wrote its colours straight to the screen, with no sRGB conversion.
THREE.ColorManagement.enabled = false;

// ------------------------------------------------------------------ settings (game side)
// Graphics, look speed, invert and touch layout live in the kit's settings panel.
const DIFF_NAMES = { easy: 'CASUAL', normal: 'STANDARD', hard: 'HARD' };
const DIFF_RANK = { easy: 0, normal: 1, hard: 2 };
const settings = { fov: 90, volume: 0.65, music: 0.3, difficulty: 'normal', shake: true };
try {
  const saved = JSON.parse(localStorage.getItem('outerlands-settings'));
  if (saved && typeof saved === 'object') {
    if (Number.isFinite(+saved.fov) && saved.fov !== null) settings.fov = clamp(+saved.fov, 70, 110);
    if (Number.isFinite(+saved.volume) && saved.volume !== null) settings.volume = clamp(+saved.volume, 0, 1);
    if (Number.isFinite(+saved.music) && saved.music !== null) settings.music = clamp(+saved.music, 0, 1);
    if (Object.hasOwn(DIFF_NAMES, saved.difficulty)) settings.difficulty = saved.difficulty;
    if (typeof saved.shake === 'boolean') settings.shake = saved.shake;
  }
} catch {
  /* storage unavailable */
}
function saveSettings() {
  try {
    localStorage.setItem('outerlands-settings', JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

// ------------------------------------------------------------------ boot
const kit = await boot({
  title: 'OUTERLANDS — Brinebreak Quay',
  canvas: $('world'),
  gear: 'none', // the title, pause menu and field manual each have GRAPHICS & CONTROLS
  accent: '#f8c544',
  background: '#152d33',
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT'], touch: 'Fire' },
    jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
    aim: { keys: ['KeyK'], mouse: [2], gamepad: ['LT'] },
    aimToggle: { touch: 'Aim' },
    reload: { keys: ['KeyR'], touch: 'Reload' },
    crouch: { keys: ['ControlLeft', 'ControlRight', 'KeyC'], gamepad: ['B'], touch: 'Crouch' },
    use: { keys: ['KeyE'], touch: 'Use' },
    padX: { gamepad: ['X'] }, // use when something is in reach, reload otherwise
    sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
    arc: { keys: ['KeyQ'], gamepad: ['LB'], touch: { label: 'Arc', slot: 'top' } },
    grenade: { keys: ['KeyG'], gamepad: ['RB'], touch: { label: 'Nade', slot: 'top' } },
    melee: { keys: ['KeyV'], gamepad: ['RS'], touch: { label: 'Melee', slot: 'top' } },
    swap: { gamepad: ['Y'], touch: { label: 'Swap', slot: 'top' } },
    weapon1: { keys: ['Digit1'], gamepad: ['Up'] },
    weapon2: { keys: ['Digit2'], gamepad: ['Right'] },
    weapon3: { keys: ['Digit3'], gamepad: ['Left'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    help: { keys: ['KeyH'], gamepad: ['Back'] },
    mute: { keys: ['KeyM'] },
    // Menus
    nav: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { gamepad: ['B'] },
  },
});
const input = kit.input;
kit.touch?.setShown('use', false);

// ------------------------------------------------------------------ world + graphics
kit.loading.progress(0.7, 'Charting the wastes…');
const skyGrid = makeSkyGrid(); // must come first: the seeded layout depends on the order
const world = buildWorld();
const { colliders, barrels, relays, supplySpots } = world;
const gfx = createGraphics(kit, world, skyGrid);
const camera = gfx.camera;
const snow = Array.from({ length: 95 }, () => ({ x: rnd(-35, 35), y: rnd(0, 22), z: rnd(-35, 35), v: rnd(0.3, 0.8) }));
let snowCount = Math.min(snow.length, kit.detail(95));
kit.onQuality(() => (snowCount = Math.min(snow.length, kit.detail(95))));

const fxCanvas = $('fx');
const ctx = fxCanvas.getContext('2d');
const mc = $('minimap').getContext('2d');
let W = 1;
let H = 1;
let fxScale = 1;
kit.onResize((w, h) => {
  W = w;
  H = h;
  fxScale = Math.min(2, devicePixelRatio || 1);
  fxCanvas.width = Math.round(w * fxScale);
  fxCanvas.height = Math.round(h * fxScale);
});

// ------------------------------------------------------------------ state
let mode = 'menu'; // menu | playing | paused | won | dead
let t = 0;
let elapsed = 0;
let visualTime = 0;
let player = {};
let weapons = [];
let weaponIndex = 0;
let fireCooldown = 0;
let reloadTime = 0;
let reloadTotal = 1;
let recoil = 0;
let muzzle = 0;
let hitMarker = 0;
let hitCrit = false;
let shakeAmount = 0;
let arcTime = 0;
let toastTime = 0;
let radioTime = 0;
let radioSilence = 0;
let checkpoint = null;
let checkpointNote = 0;
let boss = null;
let bossIntro = 0;
let vaultOpen = false;
let stage = 'relays';
let interactable = null;
let enemyID = 0;
let navTime = 0;
let footTime = 0;
let hurtFlash = 0;
let switchTime = 0;
let aimBlend = 0;
let slideTimer = 0;
let cameraHeight = 1.7;
let emptyClick = 0;
let levelFlash = 0;
let currentFov = 90;
let meleeCooldown = 0;
let meleeAnim = 0;
let menuReturn = 'menu';
let runDifficulty = settings.difficulty;
let aimLatch = false;
let sprintLatch = false;
let wheelAcc = 0;
let pausedAt = 0;
let wasLocked = false;
let hudDirty = true;
const slideDir = [0, 0];
const banner = { t: 0, max: 3.6, title: '', sub: '' };
let stats = { kills: 0, shots: 0, hits: 0, criticals: 0, cash: 0, xp: 0, level: 5, downs: 0 };
let bounty = { state: 'none', id: 0 }; // none | active | done
let flags = { tipUsed: false, lobberSeen: false, wallSlam: false, knucklesSeen: false };
const intent = { mx: 0, my: 0, fire: false, aim: false, crouch: false, sprint: false };
const radioQueue = [];
const enemies = [];
const loot = [];
const particles = [];
const particleFree = [];
const tracers = [];
const projectiles = [];
const hazards = [];
const floaters = [];
const damageMap = new Map();
const muzzleScreen = { x: 0, y: 0, ok: false };

const audio = createAudio(settings, toast);
kit.onPause((p) => audio.setPaused(p));

const diff = () => (settings.difficulty === 'easy' ? 0.65 : settings.difficulty === 'hard' ? 1.3 : 1);
const hpScale = () => (settings.difficulty === 'easy' ? 0.83 : settings.difficulty === 'hard' ? 1.17 : 1);
const xpNeed = () => 300 + (stats.level - 5) * 150;
function relaysOn() {
  let n = 0;
  for (const r of relays) if (r.on) n++;
  return n;
}
const timeString = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const colorCache = new Map();
const hexColor = (h) => {
  let c = colorCache.get(h);
  if (!c) colorCache.set(h, (c = color(h)));
  return c;
};

// ------------------------------------------------------------------ prompts per device
const GLYPHS = {
  keyboard: { use: 'E', reload: 'R', arc: 'Q', grenade: 'G', pause: 'ESC', help: 'H', slots: ['1', '2', '3'] },
  gamepad: { use: 'X', reload: 'X', arc: 'LB', grenade: 'RB', pause: 'START', help: 'BACK', slots: ['↑', '→', '←'] },
  touch: { use: 'USE', reload: 'RELOAD', arc: 'ARC', grenade: 'NADE', pause: 'II', help: 'II', slots: ['', '', ''] },
};
const glyph = (name) => (GLYPHS[input.source] || GLYPHS.keyboard)[name];

// ------------------------------------------------------------------ weapons
const BASE_WEAPONS = [
  { slot: 0, type: 'rifle', name: 'DEBT COLLECTOR', brand: 'IRONCLAD', rarity: 'UNCOMMON', color: '#a7d985', damage: 19, pellets: 1, rate: 0.108, mag: 28, reserveMax: 280, reload: 1.55, spread: 0.014, crit: 2.15, element: 'kinetic', flavor: 'Your balance is due.' },
  { slot: 1, type: 'shotgun', name: 'RUST SERMON', brand: 'BRUTE FORCE', rarity: 'RARE', color: '#70d9ef', damage: 13, pellets: 8, rate: 0.72, mag: 7, reserveMax: 56, reload: 2.1, spread: 0.072, crit: 1.8, element: 'kinetic', flavor: 'Let the coast hear you.' },
  { slot: 2, type: 'pistol', name: 'BLUE RECEIPT', brand: 'STATIC WORKS', rarity: 'RARE', color: '#70d9ef', damage: 35, pellets: 1, rate: 0.255, mag: 12, reserveMax: 96, reload: 1.3, spread: 0.011, crit: 2.5, element: 'shock', flavor: 'Proof of purchase. And pain.' },
];

function makeLootGun(slot, tier = 1) {
  const w = clone(BASE_WEAPONS[slot]);
  const names = [['COMPOUND INTEREST', 'THE TAXMAN'], ['FINAL NOTICE', 'CROWD CONTROL'], ['STATIC CLERK', 'BAD CONNECTION']];
  w.name = names[slot][tier > 1 ? 1 : 0];
  w.rarity = tier > 1 ? 'EPIC' : 'RARE';
  w.color = tier > 1 ? '#d297ef' : '#70d9ef';
  w.damage = Math.round(w.damage * (tier > 1 ? 1.48 : 1.22));
  w.mag += slot === 0 ? 6 : slot === 1 ? 1 : 3;
  w.rate *= 0.95;
  w.ammo = w.mag;
  w.reserve = w.reserveMax;
  w.flavor = tier > 1 ? 'There is no complaints department.' : 'A small upgrade. A large problem.';
  if (slot === 0 && tier > 1) w.element = 'fire';
  return w;
}

function legendary() {
  const w = clone(BASE_WEAPONS[0]);
  Object.assign(w, { name: 'SEVERANCE PACKAGE', brand: 'IRONCLAD', rarity: 'LEGENDARY', color: '#f6a543', damage: 39, mag: 40, rate: 0.085, element: 'fire', spread: 0.009, flavor: 'Thank you for your years of service.', ammo: 40, reserve: 400, reserveMax: 400 });
  return w;
}

/** The bounty reward: Knuckles Brine's own shotgun. */
function knuckleSandwich() {
  const w = clone(BASE_WEAPONS[1]);
  Object.assign(w, { name: 'KNUCKLE SANDWICH', brand: 'BRUTE FORCE', rarity: 'LEGENDARY', color: '#f6a543', damage: 19, pellets: 9, rate: 0.6, mag: 8, reserveMax: 72, spread: 0.064, crit: 1.9, element: 'fire', flavor: 'He wanted it back. He asked nicely. Once.', ammo: 8, reserve: 72 });
  return w;
}

// ------------------------------------------------------------------ enemies
const ENEMY = {
  raider: { hp: 85, scale: 1, radius: 0.43, label: 'FROST RAIDER', xp: 50 },
  gunner: { hp: 105, scale: 1, radius: 0.43, label: 'DECK GUNNER', xp: 50 },
  lobber: { hp: 95, scale: 1, radius: 0.43, label: 'SLUSH LOBBER', xp: 60 },
  badass: { hp: 1100, scale: 1.28, radius: 0.6, label: 'KNUCKLES BRINE', xp: 300 },
  boss: { hp: 2300, scale: 1.72, radius: 0.83, label: 'FOREMAN RIME', xp: 650 },
};

const START_ENEMIES = [
  ['gunner', 6, 27], ['raider', -12, 22], ['gunner', -17, 6], ['raider', 7, 2], ['gunner', 17, -6],
  ['gunner', 19, -23], ['raider', -13, -24], ['gunner', -15, -43], ['gunner', 11, -48], ['raider', -4, -38],
  // New: two Slush Lobbers hang back behind the lines.
  ['lobber', -24, 8], ['lobber', 14, -33],
];

function spawnEnemy(kind, x, z, alert = false) {
  const def = ENEMY[kind];
  const max = def.hp * hpScale();
  const e = {
    id: ++enemyID, kind, x, z, y: 0, scale: def.scale, hp: max, maxHp: max, angle: Math.PI, homeX: x, homeZ: z,
    aggro: alert, cooldown: rnd(0.7, 2), burst: 0, shotCD: 0, walk: 0, hit: 0, dead: false, death: 0, stun: 0,
    windup: 0, phase: 1, special: 4.5, summon: 12, strafe: rand() > 0.5 ? 1 : -1, burn: 0, burnTick: 0, muzzle: 0,
    lobWind: 0, chargeWind: 0, charging: 0, chargeCD: 2.5, cdx: 0, cdz: 0,
  };
  enemies.push(e);
  return e;
}

function addLoot(type, x, z, gun = null) {
  loot.push({ type, x, z, y: 0, phase: rnd(0, TAU), gun, taken: false, time: 0 });
}

// ------------------------------------------------------------------ collision (allocation free)
function canOccupy(x, z, y = 0, r = 0.42) {
  if (x < -42 + r || x > 42 - r || z < -62 + r || z > 49 - r) return false;
  for (const c of colliders) {
    if (y >= c.y + c.h - 0.06) continue;
    const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0);
    const dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}

function moveActor(a, dx, dz, r = 0.42) {
  const ox = a.x;
  const oz = a.z;
  const y = a.y || 0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.28));
  dx /= steps;
  dz /= steps;
  for (let i = 0; i < steps; i++) {
    if (canOccupy(a.x + dx, a.z, y, r)) a.x += dx;
    if (canOccupy(a.x, a.z + dz, y, r)) a.z += dz;
  }
  return Math.hypot(a.x - ox, a.z - oz);
}

function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, limit = 120) {
  let lo = 0;
  let hi = limit;
  let a;
  let b;
  let s;
  if (Math.abs(dx) < 1e-7) {
    if (ox < x0 || ox > x1) return Infinity;
  } else {
    a = (x0 - ox) / dx;
    b = (x1 - ox) / dx;
    if (a > b) (s = a), (a = b), (b = s);
    if (a > lo) lo = a;
    if (b < hi) hi = b;
    if (lo > hi) return Infinity;
  }
  if (Math.abs(dy) < 1e-7) {
    if (oy < y0 || oy > y1) return Infinity;
  } else {
    a = (y0 - oy) / dy;
    b = (y1 - oy) / dy;
    if (a > b) (s = a), (a = b), (b = s);
    if (a > lo) lo = a;
    if (b < hi) hi = b;
    if (lo > hi) return Infinity;
  }
  if (Math.abs(dz) < 1e-7) {
    if (oz < z0 || oz > z1) return Infinity;
  } else {
    a = (z0 - oz) / dz;
    b = (z1 - oz) / dz;
    if (a > b) (s = a), (a = b), (b = s);
    if (a > lo) lo = a;
    if (b < hi) hi = b;
    if (lo > hi) return Infinity;
  }
  return lo > 0.001 ? lo : hi > 0.001 ? hi : Infinity;
}

function raySphere(ox, oy, oz, dx, dy, dz, px, py, pz, r) {
  const lx = px - ox;
  const ly = py - oy;
  const lz = pz - oz;
  const a = lx * dx + ly * dy + lz * dz;
  const dd = lx * lx + ly * ly + lz * lz - a * a;
  if (dd > r * r) return Infinity;
  const h = Math.sqrt(r * r - dd);
  return a - h > 0.01 ? a - h : a + h > 0.01 ? a + h : Infinity;
}

/** Distance along a unit ray to the first cover box or the ground. Bullets and sight use it. */
function wallHit(ox, oy, oz, dx, dy, dz, max = 120) {
  let best = max;
  for (const c of colliders) {
    const q = rayBox(ox, oy, oz, dx, dy, dz, c.x - c.w / 2, c.y, c.z - c.d / 2, c.x + c.w / 2, c.y + c.h, c.z + c.d / 2, best);
    if (q < best) best = q;
  }
  if (dy < 0) {
    const g = -oy / dy;
    if (g > 0 && g < best) best = g;
  }
  return best;
}

function clearLine(ax, ay, az, bx, by, bz) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-6) return true;
  return wallHit(ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 0.1;
}

// Flow field toward the player on a 2 m grid, rebuilt a few times a second.
const nav = { w: 43, h: 57, x: -42, z: -62, blocked: new Uint8Array(43 * 57), field: new Int16Array(43 * 57), queue: new Int16Array(43 * 57) };
for (let iz = 0; iz < nav.h; iz++) for (let ix = 0; ix < nav.w; ix++) nav.blocked[iz * nav.w + ix] = canOccupy(nav.x + ix * 2, nav.z + iz * 2, 0, 0.55) ? 0 : 1;
const NEIGHBOURS = [1, 0, -1, 0, 0, 1, 0, -1];

function rebuildNav() {
  const px = clamp(Math.round((player.x - nav.x) / 2), 0, nav.w - 1);
  const pz = clamp(Math.round((player.z - nav.z) / 2), 0, nav.h - 1);
  const start = pz * nav.w + px;
  nav.field.fill(32767);
  const q = nav.queue;
  let front = 0;
  let back = 1;
  q[0] = start;
  nav.field[start] = 0;
  while (front < back) {
    const n = q[front++];
    const x = n % nav.w;
    const z = (n / nav.w) | 0;
    const d = nav.field[n] + 1;
    for (let k = 0; k < 8; k += 2) {
      const xx = x + NEIGHBOURS[k];
      const zz = z + NEIGHBOURS[k + 1];
      if (xx < 0 || xx >= nav.w || zz < 0 || zz >= nav.h) continue;
      const id = zz * nav.w + xx;
      if (!nav.blocked[id] && nav.field[id] > d) {
        nav.field[id] = d;
        q[back++] = id;
      }
    }
  }
}

const chaseOut = { x: 0, z: 0 };
function chaseDir(e) {
  let dx = player.x - e.x;
  let dz = player.z - e.z;
  let l = Math.hypot(dx, dz) || 1;
  if (clearLine(e.x, 0.55, e.z, player.x, 0.55, player.z)) {
    chaseOut.x = dx / l;
    chaseOut.z = dz / l;
    return chaseOut;
  }
  const ix = clamp(Math.round((e.x - nav.x) / 2), 0, nav.w - 1);
  const iz = clamp(Math.round((e.z - nav.z) / 2), 0, nav.h - 1);
  let best = 32767;
  let found = false;
  let tx = 0;
  let tz = 0;
  for (let z = -1; z <= 1; z++)
    for (let x = -1; x <= 1; x++) {
      const xx = ix + x;
      const zz = iz + z;
      if (xx < 0 || xx >= nav.w || zz < 0 || zz >= nav.h || (x === 0 && z === 0)) continue;
      const id = zz * nav.w + xx;
      if (nav.field[id] < best && !nav.blocked[id]) {
        if (x && z && (nav.blocked[iz * nav.w + xx] || nav.blocked[zz * nav.w + ix])) continue;
        best = nav.field[id];
        found = true;
        tx = nav.x + xx * 2;
        tz = nav.z + zz * 2;
      }
    }
  if (found) {
    dx = tx - e.x;
    dz = tz - e.z;
    l = Math.hypot(dx, dz) || 1;
  }
  chaseOut.x = dx / l;
  chaseOut.z = dz / l;
  return chaseOut;
}

function safeSpawn(x, z) {
  if (canOccupy(x, z, 0, 0.7)) return [x, z];
  for (let r = 2; r < 14; r += 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      const xx = clamp(x + Math.cos(a) * r, -40, 40);
      const zz = clamp(z + Math.sin(a) * r, -60, 47);
      if (canOccupy(xx, zz, 0, 0.7)) return [xx, zz];
    }
  return [0, 35];
}

// ------------------------------------------------------------------ messages
function toast(text, duration = 2.6) {
  const el = $('toast');
  el.textContent = text;
  toastTime = duration;
  el.style.opacity = '1';
}
function radio(text, speaker = 'MARA / RADIO', duration = 5.5) {
  radioQueue.push({ text, speaker, duration });
}
function clearMessages() {
  radioQueue.length = 0;
  radioTime = 0;
  toastTime = 0;
  radioSilence = 0;
  $('radio').style.opacity = '0';
  $('toast').style.opacity = '0';
}

// ------------------------------------------------------------------ run lifecycle
function resetRun() {
  enemies.length = 0;
  loot.length = 0;
  while (particles.length) particleFree.push(particles.pop());
  projectiles.length = 0;
  tracers.length = 0;
  hazards.length = 0;
  floaters.length = 0;
  clearMessages();
  t = 0;
  elapsed = 0;
  enemyID = 0;
  stats = { kills: 0, shots: 0, hits: 0, criticals: 0, cash: 0, xp: 0, level: 5, downs: 0 };
  player = { x: 0, z: 42, y: 0, yaw: 0, pitch: 0.025, vx: 0, vz: 0, vy: 0, health: 140, maxHealth: 140, shield: 100, maxShield: 100, lastDamage: -10, ability: 0, grenades: 3, down: false, downTime: 0, invuln: 3, ground: true, moving: false, sprinting: false };
  cameraHeight = 1.7;
  meleeCooldown = 0;
  meleeAnim = 0;
  weapons = BASE_WEAPONS.map((w) => ({ ...w, ammo: w.mag, reserve: w.reserveMax }));
  weaponIndex = 0;
  fireCooldown = 0;
  reloadTime = 0;
  recoil = 0;
  muzzle = 0;
  aimBlend = 0;
  slideTimer = 0;
  arcTime = 0;
  levelFlash = 0;
  hurtFlash = 0;
  switchTime = 0;
  shakeAmount = 0;
  hitMarker = 0;
  boss = null;
  bossIntro = 0;
  banner.t = 0;
  vaultOpen = false;
  stage = 'relays';
  interactable = null;
  checkpoint = null;
  bounty = { state: 'none', id: 0 };
  flags = { tipUsed: false, lobberSeen: false, wallSlam: false, knucklesSeen: false };
  aimLatch = false;
  sprintLatch = false;
  runDifficulty = settings.difficulty;
  for (const r of relays) r.on = false;
  for (const b of barrels) {
    b.dead = false;
    b.hp = 35;
  }
  for (const s of supplySpots) {
    s.open = false;
    s.next = 0;
  }
}

function newGame() {
  audio.init();
  resetRun();
  for (const [kind, x, z] of START_ENEMIES) spawnEnemy(kind, x, z);
  addLoot('health', -5, 35);
  addLoot('ammo', -5.7, 35);
  addLoot('gun', -11, 33, makeLootGun(0, 1));
  navTime = 0;
  saveCheckpoint(0, 42);
  checkpointNote = 0;
  enterPlay();
  toast('BRINEBREAK QUAY', 3.5);
  radio('Welcome to Brinebreak. Three relays power the vault. Turn them on. Try not to become part of the scenery.', undefined, 7);
  radio('Your shield comes back. You do not. Well… a kill while down can help with that.', undefined, 6);
  radio('And somebody pinned a bounty on the board by the landing. Money is money, Drifter.', undefined, 5);
}

function hideScreens() {
  for (const id of ['menu', 'pause', 'end', 'manual']) $(id).classList.add('hidden');
}

function syncTouch() {
  kit.touch?.suspend(mode !== 'playing', 'game');
}

function enterPlay() {
  hideScreens();
  document.activeElement?.blur?.();
  setNav(null);
  $('hud').classList.remove('hidden');
  mode = 'playing';
  input.settle();
  requestLock();
  syncTouch();
  updateHUD();
}

function requestLock() {
  if (input.source !== 'keyboard' || document.pointerLockElement === kit.canvas) return;
  input.lockPointer();
}

function pauseGame() {
  if (mode !== 'playing') return;
  mode = 'paused';
  pausedAt = performance.now();
  $('pause').classList.remove('hidden');
  $('pauseNote').textContent = `${timeString(elapsed)} ON THE CLOCK · ${stats.kills} KILLS · ${DIFF_NAMES[settings.difficulty]}`;
  input.unlockPointer();
  audio.play('ui');
  persist();
  syncTouch();
  focusPanelSoon();
}

function resumeGame() {
  audio.init();
  enterPlay();
  audio.play('ui');
}

function toMenu() {
  const hadRun = mode === 'paused' || mode === 'dead';
  if (hadRun) persist();
  mode = 'menu';
  input.unlockPointer();
  hideScreens();
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  hudStyle('hurt', 'opacity', '0');
  clearMessages();
  audio.play('ui');
  refreshTitle();
  syncTouch();
  focusPanelSoon();
}

function openManual() {
  menuReturn = mode;
  if (mode === 'playing') pauseGame();
  showTab(input.source === 'gamepad' ? 'pad' : input.source === 'touch' ? 'touch' : 'keys');
  $('manual').classList.remove('hidden');
  audio.init();
  audio.play('ui');
  focusPanelSoon();
}

function closeManual() {
  saveSettings();
  $('manual').classList.add('hidden');
  document.activeElement?.blur?.();
  setNav(null);
  audio.play('ui');
  if (menuReturn === 'playing' || mode === 'paused') {
    mode = 'paused';
    $('pause').classList.remove('hidden');
  }
  focusPanelSoon();
}

// ------------------------------------------------------------------ checkpoints, save, records
const SAVE_KEY = 'outerlands-save-v1';
const BEST_KEY = 'outerlands-best-v2';

function saveCheckpoint(x, z) {
  const p = safeSpawn(x, z);
  checkpoint = {
    x: p[0],
    z: p[1],
    yaw: player.yaw,
    relays: relays.map((r) => r.on),
    barrels: barrels.map((b) => b.dead),
    enemies: clone(enemies),
    weapons: clone(weapons),
    stats: clone(stats),
    stage,
    vaultOpen,
    loot: clone(loot),
    supply: supplySpots.map((s) => ({ open: s.open, wait: s.open ? Math.max(0, s.next - t) : 0 })),
    bossId: boss ? boss.id : null,
    bounty: clone(bounty),
    flags: clone(flags),
  };
  checkpointNote = 3;
  persist();
}

/** Keep the last checkpoint on this device so CONTINUE works after a reload. */
function persist() {
  if (!checkpoint) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, elapsed, difficulty: runDifficulty, checkpoint }));
  } catch {
    /* storage unavailable or full */
  }
}

function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.v === 1 && s.checkpoint && Array.isArray(s.checkpoint.enemies) && Array.isArray(s.checkpoint.weapons) && s.checkpoint.weapons.length === 3) return s;
  } catch {
    /* ignore */
  }
  return null;
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

function loadBest() {
  let b = {};
  try {
    b = JSON.parse(localStorage.getItem(BEST_KEY)) || {};
  } catch {
    b = {};
  }
  if (!b.normal) {
    // The original kept one record, which was always at whatever difficulty was set.
    try {
      const old = JSON.parse(localStorage.getItem('outerlands-best'));
      if (old && Number.isFinite(old.time)) b.normal = old;
    } catch {
      /* ignore */
    }
  }
  return b;
}

function restoreCheckpoint() {
  if (!checkpoint) {
    newGame();
    return;
  }
  const c = checkpoint;
  enemies.length = 0;
  enemies.push(...clone(c.enemies));
  loot.length = 0;
  loot.push(...clone(c.loot));
  relays.forEach((r, i) => (r.on = !!c.relays[i]));
  barrels.forEach((b, i) => {
    b.dead = !!c.barrels[i];
    b.hp = 35;
  });
  supplySpots.forEach((s, i) => {
    const d = (c.supply && c.supply[i]) || {};
    s.open = !!d.open;
    s.next = t + (d.wait || 0);
  });
  weapons = clone(c.weapons);
  for (const w of weapons) {
    w.ammo = w.mag;
    w.reserve = Math.max(w.reserve, (w.reserveMax * 0.6) | 0);
  }
  if (weaponIndex > 2) weaponIndex = 0;
  stats = clone(c.stats);
  player.maxHealth = 140 + (stats.level - 5) * 15;
  player.maxShield = 100 + (stats.level - 5) * 10;
  stage = c.stage;
  vaultOpen = c.vaultOpen;
  boss = enemies.find((e) => e.id === c.bossId) || null;
  bounty = clone(c.bounty || { state: 'none', id: 0 });
  flags = { ...flags, ...(c.flags || {}) };
  for (const e of enemies) enemyID = Math.max(enemyID, e.id);
  Object.assign(player, { x: c.x, z: c.z, y: 0, yaw: c.yaw, pitch: 0, vx: 0, vz: 0, vy: 0, health: player.maxHealth, shield: player.maxShield, down: false, downTime: 0, invuln: 3.5, ability: 0, grenades: 3, ground: true, lastDamage: t - 10 });
  reloadTime = 0;
  fireCooldown = 0;
  slideTimer = 0;
  switchTime = 0;
  muzzle = 0;
  interactable = null;
  projectiles.length = 0;
  hazards.length = 0;
  while (particles.length) particleFree.push(particles.pop());
  floaters.length = 0;
  tracers.length = 0;
  hurtFlash = 0;
  bossIntro = boss && !boss.dead ? 2.5 : 0;
  banner.t = 0;
  if (bossIntro) showBanner('FOREMAN RIME', 'HE WOULD LIKE TO SPEAK TO YOUR MANAGER.', 2.5);
  clearMessages();
  navTime = 0;
  checkpointNote = 0;
  resumeGame();
  toast('BACK IN BUSINESS', 2.5);
}

function continueGame() {
  const s = readSave();
  if (!s) {
    refreshTitle();
    return;
  }
  audio.init();
  resetRun();
  try {
    checkpoint = s.checkpoint;
    runDifficulty = Object.hasOwn(DIFF_NAMES, s.difficulty) ? s.difficulty : settings.difficulty;
    elapsed = Number.isFinite(s.elapsed) ? s.elapsed : 0;
    restoreCheckpoint();
  } catch (err) {
    console.warn('Outerlands: the saved run could not be restored', err);
    clearSave();
    newGame();
  }
}

function finish(won) {
  mode = won ? 'won' : 'dead';
  input.unlockPointer();
  $('end').classList.remove('hidden');
  $('hud').classList.add('hidden');
  hudStyle('hurt', 'opacity', '0');
  $('endEyebrow').textContent = won ? 'CONTRACT CLOSED / YOU ARE STILL ALIVE' : 'CONTRACT FAILED / PLEASE TRY NOT TO DO THAT AGAIN';
  $('endTitle').textContent = won ? 'DEBT. COLLECTED.' : 'COLD. DEAD. BROKE.';
  $('endText').textContent = won
    ? 'The vault is open. Rime is out of business. You are off the coast with a gun you did not pay for.'
    : 'The coast won this round. Your last checkpoint is ready. Your clear time continues after a retry.';
  $('statTime').textContent = timeString(elapsed);
  $('statKills').textContent = String(stats.kills);
  $('statAccuracy').textContent = Math.round((stats.hits / Math.max(1, stats.shots)) * 100) + '%';
  $('statCrits').textContent = String(stats.criticals);
  $('statCash').textContent = '$' + stats.cash;
  $('statBounty').textContent = bounty.state === 'done' ? 'CLAIMED' : bounty.state === 'active' ? 'AT LARGE' : '—';
  $('replayBtn').textContent = won ? 'RUN IT AGAIN' : 'RETRY CHECKPOINT';
  $('endFoot').textContent = won
    ? 'Original game and audio. Thanks for surviving Brinebreak Quay.'
    : `Tip: move between cover. Aim at heads. Use ${glyph('arc')} to damage nearby enemies and restore shield.`;
  audio.play(won ? 'win' : 'down');
  input.rumble(won ? 0.4 : 0.9, won ? 300 : 500);
  if (won) {
    const d = runDifficulty;
    try {
      const best = loadBest();
      const old = best[d];
      if (!old || elapsed < old.time) {
        best[d] = { time: elapsed, kills: stats.kills };
        localStorage.setItem(BEST_KEY, JSON.stringify(best));
        $('endFoot').textContent = `NEW BEST CLEAR ON ${DIFF_NAMES[d]} · Saved on this device.`;
      } else {
        $('endFoot').textContent = `Best clear on ${DIFF_NAMES[d]}: ${timeString(old.time)}. Thanks for surviving Brinebreak Quay.`;
      }
    } catch {
      $('endFoot').textContent = 'The clear is complete. Browser storage is not available.';
    }
    checkpoint = null;
    clearSave();
  } else {
    persist();
  }
  syncTouch();
  focusPanelSoon();
}

function refreshTitle() {
  const best = loadBest();
  const rec = best[settings.difficulty];
  $('bestRecord').textContent = rec ? `BEST CLEAR · ${DIFF_NAMES[settings.difficulty]} · ${timeString(rec.time)}  /  ${rec.kills} KILLS` : '';
  const s = readSave();
  const cont = $('continueBtn');
  cont.classList.toggle('hidden', !s);
  $('startBtn').className = s ? 'secondary' : 'primary';
  if (s) {
    const c = s.checkpoint;
    const where = c.stage === 'relays' ? `RELAYS ${(c.relays || []).filter(Boolean).length} / 3` : c.stage === 'boss' ? 'FOREMAN RIME' : c.stage === 'vault' ? 'THE VAULT' : 'EXTRACTION';
    cont.textContent = `CONTINUE · ${where} · ${timeString(s.elapsed || 0)}`;
  }
}

// ------------------------------------------------------------------ combat
function switchWeapon(index) {
  if (index === weaponIndex || !weapons[index]) return;
  weaponIndex = index;
  reloadTime = 0;
  fireCooldown = 0.2;
  switchTime = 0.24;
  audio.play('cock', 0.7);
}

function reload() {
  const w = weapons[weaponIndex];
  if (reloadTime > 0 || w.ammo === w.mag || w.reserve <= 0) return;
  reloadTime = w.reload;
  reloadTotal = w.reload;
  aimLatch = false;
  audio.play('reload');
}

const MAX_PARTICLES = 200;
function burstParticles(x, y, z, col, n = 12, power = 3) {
  const count = kit.detail(n);
  for (let i = 0; i < count; i++) {
    const p = particles.length >= MAX_PARTICLES ? particles.shift() : particleFree.pop() || {};
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = rnd(-1, 1) * power;
    p.vy = rnd(0.2, 1.3) * power;
    p.vz = rnd(-1, 1) * power;
    p.life = rnd(0.2, 0.75);
    p.size = rnd(0.025, 0.1);
    p.col = col;
    particles.push(p);
  }
}

function floater(text, x, y, z, col = '#fff2bc', crit = false) {
  floaters.push({ text, x, y, z, life: crit ? 1.05 : 0.8, max: crit ? 1.05 : 0.8, ox: rnd(-17, 17), col, crit });
}

function addTracer(ax, ay, az, bx, by, bz, col) {
  tracers.push({ ax, ay, az, bx, by, bz, life: 0.055, max: 0.055, col, ring: false, arc: false });
}
function addRing(x, y, z, target, life, col) {
  tracers.push({ ring: true, arc: false, x, y, z, r: 0, target, life, max: life, col });
}

function fire() {
  const w = weapons[weaponIndex];
  if (reloadTime > 0 || fireCooldown > 0 || switchTime > 0) return;
  if (w.ammo <= 0) {
    if (emptyClick <= 0) {
      audio.play('empty');
      emptyClick = 0.4;
    }
    if (w.reserve > 0) reload();
    return;
  }
  w.ammo--;
  stats.shots++;
  fireCooldown = w.rate;
  muzzle = 0.06;
  recoil = Math.min(recoil + (w.type === 'shotgun' ? 0.11 : 0.042), 0.18);
  if (settings.shake) shakeAmount = Math.max(shakeAmount, w.type === 'shotgun' ? 0.08 : 0.026);
  audio.play(w.type);
  if (input.source === 'gamepad') input.rumble(w.type === 'shotgun' ? 0.55 : 0.14, w.type === 'shotgun' ? 110 : 45);
  const cp = Math.cos(player.pitch);
  const sy = Math.sin(player.yaw);
  const cy = Math.cos(player.yaw);
  const fx = sy * cp;
  const fy = Math.sin(player.pitch);
  const fz = -cy * cp;
  // right = (cos yaw, 0, sin yaw); up = right × forward
  const rx = cy;
  const rz = sy;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const ox = player.x;
  const oy = player.y + cameraHeight;
  const oz = player.z;
  const side = aimBlend > 0.6 ? 0.02 : 0.3;
  const mx = ox + fx * 0.65 + rx * side - ux * 0.22;
  const my = oy + fy * 0.65 - uy * 0.22;
  const mz = oz + fz * 0.65 + rz * side - uz * 0.22;
  const tracerCol = w.element === 'shock' ? C.blue : w.element === 'fire' ? C.orange : C.yellow;
  damageMap.clear();
  let didHit = false;
  for (let i = 0; i < w.pellets; i++) {
    const spread = w.spread * (intent.aim ? 0.28 : 1) * (player.sprinting ? 1.7 : 1);
    const angle = rnd(0, TAU);
    const rad = Math.sqrt(rand()) * spread;
    let dx = fx + rx * Math.cos(angle) * rad + ux * Math.sin(angle) * rad;
    let dy = fy + uy * Math.sin(angle) * rad;
    let dz = fz + rz * Math.cos(angle) * rad + uz * Math.sin(angle) * rad;
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    dx /= dl;
    dy /= dl;
    dz /= dl;
    let distance = wallHit(ox, oy, oz, dx, dy, dz, 100);
    let target = null;
    let crit = false;
    let barrel = null;
    for (const e of enemies) {
      if (e.dead || (e.kind === 'boss' && bossIntro > 0)) continue;
      const s = e.scale;
      const head = raySphere(ox, oy, oz, dx, dy, dz, e.x, 2.02 * s, e.z, 0.37 * s);
      const body = rayBox(ox, oy, oz, dx, dy, dz, e.x - 0.52 * s, 0.15, e.z - 0.4 * s, e.x + 0.52 * s, 1.78 * s, e.z + 0.42 * s, distance);
      if (head < distance && head <= body + 0.1) {
        distance = head;
        target = e;
        crit = true;
        barrel = null;
      } else if (body < distance) {
        distance = body;
        target = e;
        crit = false;
        barrel = null;
      }
    }
    for (const b of barrels) {
      if (b.dead) continue;
      const h = rayBox(ox, oy, oz, dx, dy, dz, b.x - 0.53, 0, b.z - 0.53, b.x + 0.53, 1.4, b.z + 0.53, distance);
      if (h < distance) {
        distance = h;
        barrel = b;
        target = null;
        crit = false;
      }
    }
    const ex = ox + dx * distance;
    const ey = oy + dy * distance;
    const ez = oz + dz * distance;
    addTracer(mx, my, mz, ex, ey, ez, tracerCol);
    if (target) {
      const falloff = w.type === 'shotgun' ? clamp(1 - distance / 50, 0.25, 1) : 1;
      const amount = w.damage * falloff * (crit ? w.crit : 1) * (1 + (stats.level - 5) * 0.07);
      let prev = damageMap.get(target);
      if (!prev) damageMap.set(target, (prev = { amount: 0, crit: false, x: ex, y: ey, z: ez }));
      prev.amount += amount;
      prev.crit = prev.crit || crit;
      didHit = true;
    } else if (barrel) {
      barrel.hp -= w.damage;
      burstParticles(ex, ey, ez, C.orange, 4, 1.5);
      if (barrel.hp <= 0) explodeBarrel(barrel);
    } else if (distance < 99) {
      burstParticles(ex, ey, ez, C.paper, 3, 1.5);
    }
  }
  for (const [e, h] of damageMap) hitEnemy(e, h.amount, h.crit, w.element, h.x, h.y, h.z);
  if (didHit) stats.hits++;
  for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.z - player.z) < 35) e.aggro = true;
}

function hitEnemy(e, amount, critical = false, element = 'kinetic', px = null, py = 0, pz = 0) {
  if (e.dead) return;
  if (e.kind === 'boss' && bossIntro > 0) return;
  if (e.kind === 'boss' && e.phase === 1 && !critical) amount *= 0.82;
  e.hp -= amount;
  e.hit = 0.13;
  e.aggro = true;
  hitMarker = 0.12;
  hitCrit = critical;
  if (px === null) {
    px = e.x;
    py = 1.7 * e.scale;
    pz = e.z;
  }
  floater(String(Math.round(amount)), px, py + 0.22, pz, critical ? '#ffd051' : element === 'shock' ? '#80eafb' : element === 'fire' ? '#ffa45d' : '#f4edd7', critical);
  burstParticles(px, py, pz, element === 'shock' ? C.blue : critical ? C.yellow : C.orange, critical ? 8 : 4, 2.5);
  audio.play(critical ? 'crit' : 'hit', 0.6);
  if (critical) stats.criticals++;
  if (element === 'shock' && rand() < 0.4) e.stun = Math.max(e.stun, 0.42);
  if (element === 'fire') e.burn = 2.5;
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  e.death = 0;
  e.charging = e.chargeWind = e.lobWind = e.windup = 0;
  stats.kills++;
  stats.xp += ENEMY[e.kind].xp;
  stats.cash += e.kind === 'boss' ? 600 : e.kind === 'badass' ? 150 : Math.floor(rnd(12, 32));
  audio.play('kill');
  if (e.kind === 'boss' || e.kind === 'badass') input.rumble(0.9, 380);
  burstParticles(e.x, e.scale, e.z, e.kind === 'boss' || e.kind === 'badass' ? C.orange : C.paper, 20, 5);
  addLoot('ammo', e.x + 0.45, e.z);
  if (rand() < 0.65 || player.health < 70) addLoot('health', e.x - 0.45, e.z);
  if (rand() < 0.65) addLoot('cash', e.x, e.z + 0.4);
  if (e.kind !== 'boss' && e.kind !== 'badass' && stats.kills % 5 === 0) {
    const w = makeLootGun(((stats.kills / 5) | 0) % 3, stats.kills >= 10 ? 2 : 1);
    addLoot('gun', e.x + 0.8, e.z, w);
    audio.play('loot', 0.65);
  }
  if (player.down) {
    player.down = false;
    player.health = player.maxHealth * 0.5;
    player.shield = player.maxShield * 0.4;
    player.invuln = 2;
    player.lastDamage = t;
    toast('NOT DEAD YET', 3);
    audio.play('level');
    input.rumble(0.6, 200);
    radio('That is one way to walk it off.', undefined, 3);
  }
  // A big kill (the boss) can be worth more than one level.
  while (stats.xp >= xpNeed()) {
    stats.xp -= xpNeed();
    stats.level++;
    player.maxHealth += 15;
    player.maxShield += 10;
    player.health = player.maxHealth;
    player.shield = player.maxShield;
    player.ability = 0;
    levelFlash = 1;
    toast('LEVEL ' + stats.level + ' · HEALTH & SHIELD RESTORED', 3);
    audio.play('level');
  }
  if (e.kind === 'boss') {
    stage = 'vault';
    toast('FOREMAN RIME · TERMINATED', 4);
    radio('His retirement plan just kicked in. The vault is open. Grab the payout and find the exit.', undefined, 7);
    // The crew clocks out. Knuckles Brine does not work for Rime, so he stays.
    for (const other of enemies)
      if (!other.dead && other.kind !== 'badass') {
        other.dead = true;
        other.death = 0;
        burstParticles(other.x, 1, other.z, C.blue, 9, 3);
      }
    hazards.length = 0;
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].enemy) projectiles.splice(i, 1);
    addLoot('legend', e.x, e.z - 1, legendary());
    audio.play('loot');
    saveCheckpoint(5, -48);
  }
  if (e.kind === 'badass' && bounty.state === 'active' && e.id === bounty.id) {
    bounty.state = 'done';
    stats.cash += 400;
    addLoot('legend', e.x, e.z + 1, knuckleSandwich());
    toast('BOUNTY CLAIMED · $400', 3.5);
    audio.play('bounty');
    radio('Bounty confirmed. $400, wired to an account you will empty in one afternoon. Nice shotgun, by the way.', undefined, 6.5);
    saveCheckpoint(player.x, player.z);
  }
}

function hitPlayer(amount) {
  if (mode !== 'playing' || player.invuln > 0 || player.down) return;
  amount *= diff();
  player.lastDamage = t;
  player.invuln = 0.12;
  const shieldBefore = player.shield;
  const absorbed = Math.min(player.shield, amount);
  player.shield -= absorbed;
  player.health -= amount - absorbed;
  hurtFlash = Math.min(1, hurtFlash + 0.38);
  if (settings.shake) shakeAmount = Math.max(shakeAmount, 0.075);
  input.rumble(clamp(amount / 40, 0.25, 0.8), 140);
  audio.play(shieldBefore > 0 && player.shield <= 0 ? 'shield' : 'hurt', 0.8);
  if (shieldBefore > 0 && player.shield <= 0) toast('SHIELD DOWN · FIND COVER', 1.6);
  if (player.health <= 0) {
    player.health = 0;
    player.down = true;
    player.downTime = 12;
    player.invuln = 1;
    stats.downs++;
    aimLatch = false;
    slideTimer = 0;
    audio.play('down');
    radio('You are not done. Take one of them with you. It may get you back up.', undefined, 5);
    // Always leave someone to take down: a second wind needs a target.
    let near = false;
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.z - player.z) < 25) near = true;
    if (!near) {
      const p = safeSpawn(player.x + 7, player.z - 6);
      spawnEnemy('raider', p[0], p[1], true);
    }
  }
}

function explosion(x, y, z, r, damage, enemyOwned = false, shock = false) {
  burstParticles(x, y, z, shock ? C.blue : C.orange, 38, 8);
  addRing(x, 0.08, z, r, 0.45, shock ? C.blue : C.orange);
  const pd = Math.hypot(x - player.x, z - player.z);
  audio.play('explode', clamp(1 - pd / 65, 0.15, 1));
  if (pd < 16) {
    if (settings.shake) shakeAmount = 0.2;
    input.rumble(0.9 * (1 - pd / 16), 220);
  }
  if (enemyOwned) {
    if (pd < r && clearLine(x, 0.7, z, player.x, player.y + 1, player.z)) hitPlayer(damage * (1 - (pd / r) * 0.55));
  } else {
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(x - e.x, z - e.z);
      if (d < r && clearLine(x, 0.65, z, e.x, e.scale, e.z)) hitEnemy(e, damage * (1 - (d / r) * 0.55), false, shock ? 'shock' : 'fire');
    }
    for (const b of barrels)
      if (!b.dead && Math.hypot(x - b.x, z - b.z) < r) {
        b.hp = 0;
        explodeBarrel(b);
      }
  }
}

function explodeBarrel(b) {
  if (b.dead) return;
  b.dead = true;
  explosion(b.x, 0.7, b.z, 6.5, 155, false, false);
}

function throwGrenade() {
  if (player.grenades <= 0 || player.down) return;
  player.grenades--;
  const cp = Math.cos(player.pitch);
  const dx = Math.sin(player.yaw) * cp;
  const dy = Math.sin(player.pitch);
  const dz = -Math.cos(player.yaw) * cp;
  projectiles.push({ kind: 'grenade', x: player.x + dx * 0.5, y: player.y + cameraHeight - 0.15, z: player.z + dz * 0.5, vx: dx * 17, vy: dy * 17 + 4, vz: dz * 17, life: 1.65, enemy: false });
  audio.play('cock');
}

function arcBurst() {
  if (player.ability > 0 || player.down) return;
  player.ability = 18;
  arcTime = 0.6;
  player.shield = Math.min(player.maxShield, player.shield + 55);
  player.invuln = 0.5;
  audio.play('arc');
  input.rumble(0.6, 260);
  if (settings.shake) shakeAmount = 0.1;
  addRing(player.x, 0.15, player.z, 12, 0.65, C.blue);
  for (const e of enemies) {
    if (e.dead || Math.hypot(e.x - player.x, e.z - player.z) > 12) continue;
    const ax = player.x;
    const ay = player.y + 1.4;
    const az = player.z;
    const bx = e.x;
    const by = e.scale * 1.4;
    const bz = e.z;
    if (!clearLine(ax, ay, az, bx, by, bz)) continue;
    e.stun = 2;
    e.charging = e.chargeWind = e.lobWind = 0;
    hitEnemy(e, 135, false, 'shock');
    for (let k = 0; k < 3; k++) tracers.push({ ring: false, arc: true, ax, ay, az, bx, by, bz, life: 0.32, max: 0.32, col: C.blue });
  }
  toast('ARC BURST · SHIELD BOOST', 1.4);
}

function melee() {
  if (mode !== 'playing' || meleeCooldown > 0) return;
  meleeCooldown = 0.75;
  meleeAnim = 0.27;
  reloadTime = 0;
  audio.play('melee');
  let target = null;
  let best = 3;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dz = e.z - player.z;
    const d = Math.hypot(dx, dz);
    const dot = (dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw)) / (d || 1);
    if (d < best && dot > 0.4 && clearLine(player.x, 1.3, player.z, e.x, 1.3, e.z)) {
      target = e;
      best = d;
    }
  }
  if (target) {
    hitEnemy(target, 62, false, 'kinetic');
    target.stun = Math.max(target.stun, 0.5);
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    const d = Math.hypot(dx, dz) || 1;
    moveActor(target, (dx / d) * 0.8, (dz / d) * 0.8, ENEMY[target.kind].radius);
    if (settings.shake) shakeAmount = 0.07;
    input.rumble(0.45, 110);
  }
}

function lobShot(e) {
  const T = 1.15;
  const g = 14;
  // Aim where the player is heading, but never far from where they stand.
  const tx = clamp(player.x + clamp(player.vx * 0.8, -4, 4), -41, 41);
  const tz = clamp(player.z + clamp(player.vz * 0.8, -4, 4), -61, 48);
  const sx = e.x + Math.sin(e.angle) * 0.5;
  const sy = 2.2;
  const sz = e.z + Math.cos(e.angle) * 0.5;
  projectiles.push({ kind: 'lob', x: sx, y: sy, z: sz, vx: (tx - sx) / T, vy: (0.2 - sy + 0.5 * g * T * T) / T, vz: (tz - sz) / T, life: 3, age: 0, enemy: true, tx, tz });
  e.muzzle = 0.1;
  audio.play('lob', clamp(1 - Math.hypot(e.x - player.x, e.z - player.z) / 45, 0.1, 0.8));
}

function enemyFire(e) {
  let sx = e.x;
  let sy = 1.4 * e.scale;
  let sz = e.z;
  const tx = player.x + player.vx * 0.1;
  const ty = player.y + cameraHeight * 0.7;
  const tz = player.z + player.vz * 0.1;
  let dx = tx - sx;
  let dy = ty - sy;
  let dz = tz - sz;
  let l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= l;
  dy /= l;
  dz /= l;
  sx += dx * 0.8 * e.scale;
  sy += dy * 0.8 * e.scale;
  sz += dz * 0.8 * e.scale;
  const spread = e.kind === 'boss' ? 0.025 : 0.035;
  dx += rnd(-spread, spread);
  dy += rnd(-spread, spread);
  dz += rnd(-spread, spread);
  l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const speed = e.kind === 'boss' ? 26 : 22;
  projectiles.push({ kind: 'bolt', x: sx, y: sy, z: sz, vx: (dx / l) * speed, vy: (dy / l) * speed, vz: (dz / l) * speed, life: 3.5, enemy: true, damage: e.kind === 'boss' ? 14 : 10 });
  e.muzzle = 0.08;
  audio.play('enemy', clamp(1 - Math.hypot(e.x - player.x, e.z - player.z) / 45, 0.06, 0.65));
}

function showBanner(title, sub, time = 3.6) {
  banner.title = title;
  banner.sub = sub;
  banner.t = time;
  banner.max = 3.6;
}

function acceptBounty() {
  bounty.state = 'active';
  const p = safeSpawn(35, -30);
  const k = spawnEnemy('badass', p[0], p[1]);
  k.angle = -Math.PI / 2;
  bounty.id = k.id;
  for (const [dx, dz] of [[-3, 3], [3, -3]]) {
    const q = safeSpawn(p[0] + dx, p[1] + dz);
    spawnEnemy('raider', q[0], q[1]);
  }
  audio.play('bounty');
  toast('BOUNTY ACCEPTED · KNUCKLES BRINE', 3);
  radio('Knuckles Brine. Punched a harbor seal so hard it filed a grievance. He is holed up in the east yard, past the crane. $400 says he stops.', undefined, 7);
  radio('Whoever is reading my poster: I can hear you reading it.', 'KNUCKLES BRINE / OPEN CHANNEL', 5);
}

// ------------------------------------------------------------------ interaction
function use() {
  if (!interactable || player.down) return;
  const obj = interactable.obj;
  audio.play('ui');
  if (interactable.kind === 'relay') {
    if (obj.on) return;
    obj.on = true;
    audio.play('relay');
    input.rumble(0.35, 160);
    burstParticles(obj.x, 2.4, obj.z, C.blue, 30, 5);
    player.grenades = Math.min(3, player.grenades + 1);
    addLoot('health', obj.x - 1.6, obj.z + 1.9);
    addLoot('ammo', obj.x + 1.6, obj.z + 1.9);
    const count = relaysOn();
    toast('RELAY ONLINE · ' + count + ' / 3', 3);
    const waves = [
      [[0, 14], [-18, 0], [-11, 5]],
      [[9, -21], [16, -31], [13, -3]],
      [[-12, -49], [8, -43], [-16, -24]],
    ];
    for (const [i, p] of waves[obj.i].entries()) {
      const point = safeSpawn(p[0], p[1]);
      spawnEnemy(i === 1 ? 'gunner' : 'raider', point[0], point[1], true);
    }
    // New: the later waves bring a Slush Lobber.
    if (obj.i === 1) {
      const q = safeSpawn(24, -30);
      spawnEnemy('lobber', q[0], q[1], true);
    } else if (obj.i === 2) {
      const q = safeSpawn(-26, -28);
      spawnEnemy('lobber', q[0], q[1], true);
    }
    if (count === 1) radio('That woke the crew. They do not like unpaid visitors. Or paid ones. Keep moving.', undefined, 6);
    if (count === 2) radio('Two down. One to go. The foreman is filing a complaint. In person.', undefined, 5.5);
    if (count === 3) {
      stage = 'boss';
      boss = spawnEnemy('boss', 8, -45, true);
      bossIntro = 3.6;
      boss.summon = 11;
      showBanner('FOREMAN RIME', 'HE WOULD LIKE TO SPEAK TO YOUR MANAGER.');
      toast('ALL RELAYS ONLINE', 2.5);
      radio('You turned on MY power? Now I have to do actual work. This is coming out of your pay.', 'FOREMAN RIME / OPEN CHANNEL', 7);
      audio.play('down', 0.65);
      saveCheckpoint(0, -33);
    } else saveCheckpoint(obj.x, obj.z + 3.5);
  } else if (interactable.kind === 'supply') {
    if (obj.open && t < obj.next) return;
    obj.open = true;
    obj.next = t + 35;
    player.health = Math.min(player.maxHealth, player.health + 90);
    player.shield = player.maxShield;
    player.grenades = 3;
    for (const w of weapons) w.reserve = Math.min(w.reserveMax, w.reserve + Math.round(w.reserveMax * 0.6));
    audio.play('pickup');
    toast('SUPPLIES TAKEN · HEALTH / AMMO / GRENADES', 2.4);
    burstParticles(obj.x, 1.2, obj.z, C.blue, 12, 2);
  } else if (interactable.kind === 'gun') {
    obj.taken = true;
    const w = clone(obj.gun);
    const old = weapons[w.slot];
    w.ammo = w.mag;
    w.reserve = Math.max(old.reserve, (w.reserveMax * 0.65) | 0);
    weapons[w.slot] = w;
    weaponIndex = w.slot;
    reloadTime = 0;
    fireCooldown = 0.25;
    switchTime = 0.3;
    audio.play('loot');
    input.rumble(0.3, 120);
    toast(w.rarity + ' · ' + w.name, 3);
    if (w.name === 'SEVERANCE PACKAGE') radio('That is a very expensive gun. Good thing it now belongs to a very cheap person.', undefined, 6);
  } else if (interactable.kind === 'vault') {
    vaultOpen = true;
    stage = 'extract';
    stats.cash += 800;
    player.health = player.maxHealth;
    player.shield = player.maxShield;
    for (const w of weapons) w.reserve = w.reserveMax;
    addLoot('legend', 4, -51.5, legendary());
    audio.play('loot');
    input.rumble(0.5, 220);
    burstParticles(4, 1.8, -54, C.yellow, 50, 6);
    toast('VAULT OPEN · $800 + LEGENDARY LOOT', 3.5);
    radio('Payout secured. The exit is behind the vault. Leave before someone invents more paperwork.', undefined, 6);
    saveCheckpoint(3, -50);
  } else if (interactable.kind === 'bounty') {
    if (bounty.state === 'none') acceptBounty();
  } else if (interactable.kind === 'exit') {
    interactable = null;
    finish(true);
    return;
  }
  interactable = null;
}

let foundKind = '';
let iBest = 4;
let iKind = '';
let iObj = null;
const interactHit = { kind: '', obj: null, label: '' };
function consider(kind, obj, x, z, range) {
  const dx = x - player.x;
  const dz = z - player.z;
  const d = Math.hypot(dx, dz);
  const f = (dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw)) / (d || 1);
  if (d < range && d < iBest && f > -0.45) {
    iBest = d;
    iKind = kind;
    iObj = obj;
  }
}
function interactLabel(kind, obj) {
  if (kind === 'relay') return 'RESTORE ' + obj.label;
  if (kind === 'supply') return 'TAKE SUPPLIES';
  if (kind === 'gun') return 'TAKE ' + obj.gun.name;
  if (kind === 'bounty') return 'READ THE BOUNTY · KNUCKLES BRINE';
  if (kind === 'vault') return 'OPEN THE VAULT';
  return 'LEAVE BRINEBREAK';
}
function findInteraction() {
  iBest = 4;
  iKind = '';
  iObj = null;
  for (const r of relays) if (!r.on) consider('relay', r, r.x, r.z, 3.5);
  for (const s of supplySpots) if (!s.open || t >= s.next) consider('supply', s, s.x, s.z, 3.2);
  for (const l of loot) if (!l.taken && l.gun) consider('gun', l, l.x, l.z, 3);
  if (bounty.state === 'none' && stage !== 'extract') consider('bounty', null, BOUNTY_BOARD.x, BOUNTY_BOARD.z + 0.6, 3.4);
  if (stage === 'vault') consider('vault', null, 4, -54, 3.6);
  if (stage === 'extract') consider('exit', null, 3, -59, 3.3);
  if (!iKind) interactable = null;
  else {
    if (interactHit.kind !== iKind || interactHit.obj !== iObj || !interactHit.label) {
      interactHit.kind = iKind;
      interactHit.obj = iObj;
      interactHit.label = interactLabel(iKind, iObj);
    }
    interactable = interactHit;
  }
  if (iKind !== foundKind) {
    foundKind = iKind;
    // Touch: the Use button takes Crouch's place while something is in reach.
    kit.touch?.setShown('use', !!iKind);
    kit.touch?.setShown('crouch', !iKind);
  }
}

// ------------------------------------------------------------------ simulation
function updatePlayer(dt) {
  meleeCooldown = Math.max(0, meleeCooldown - dt);
  meleeAnim = Math.max(0, meleeAnim - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.ability = Math.max(0, player.ability - dt);
  if (player.down) {
    player.downTime -= dt;
    if (player.downTime <= 0) {
      finish(false);
      return;
    }
  } else if (t - player.lastDamage > 3.7) player.shield = Math.min(player.maxShield, player.shield + 24 * dt);

  const crouch = intent.crouch;
  const forward = intent.my;
  const side = intent.mx;
  player.sprinting = !!(intent.sprint && forward > 0.3 && !intent.aim && !intent.fire && !crouch && !player.down && reloadTime <= 0);
  if (player.sprinting) aimLatch = false;
  const speed = player.down ? 2.7 : crouch ? 3.5 : intent.aim ? 4.3 : player.sprinting ? 11.8 : 7.2;
  let tx = (Math.sin(player.yaw) * forward + Math.cos(player.yaw) * side) * speed;
  let tz = (-Math.cos(player.yaw) * forward + Math.sin(player.yaw) * side) * speed;
  if (slideTimer > 0) {
    slideTimer -= dt;
    const s = lerp(7, 15, clamp(slideTimer / 0.85, 0, 1));
    tx = slideDir[0] * s;
    tz = slideDir[1] * s;
  }
  player.vx = lerp(player.vx, tx, Math.min(1, dt * 12));
  player.vz = lerp(player.vz, tz, Math.min(1, dt * 12));
  const moved = moveActor(player, player.vx * dt, player.vz * dt);
  player.moving = moved > dt * 0.5;

  const oldY = player.y;
  player.vy -= 20 * dt;
  player.y += player.vy * dt;
  player.ground = false;
  let floor = 0;
  for (const c of colliders) if (Math.abs(player.x - c.x) < c.w / 2 + 0.02 && Math.abs(player.z - c.z) < c.d / 2 + 0.02 && oldY >= c.h - 0.08) floor = Math.max(floor, c.h);
  if (player.y <= floor) {
    if (player.vy < -4.5) {
      audio.play('land');
      if (settings.shake) shakeAmount = Math.max(shakeAmount, 0.05);
    }
    player.y = floor;
    player.vy = 0;
    player.ground = true;
  }
  cameraHeight = lerp(cameraHeight, player.down ? 0.68 : slideTimer > 0 || crouch ? 1.08 : 1.74, Math.min(1, dt * 12));
  aimBlend = lerp(aimBlend, intent.aim && reloadTime <= 0 && !player.down && !player.sprinting ? 1 : 0, Math.min(1, dt * 13));
  if (player.moving && player.ground) {
    footTime -= dt;
    if (footTime <= 0) {
      audio.play('foot', crouch ? 0.5 : 1);
      footTime = player.sprinting ? 0.29 : 0.43;
    }
  }

  if (intent.fire) fire();
  if (reloadTime > 0) {
    const old = reloadTime;
    reloadTime = Math.max(0, reloadTime - dt);
    if (old > reloadTotal * 0.32 && reloadTime <= reloadTotal * 0.32) audio.play('cock', 0.65);
    if (reloadTime === 0) {
      const w = weapons[weaponIndex];
      const n = Math.min(w.mag - w.ammo, w.reserve);
      w.ammo += n;
      w.reserve -= n;
      audio.play('cock', 0.7);
    }
  }
  fireCooldown = Math.max(0, fireCooldown - dt);
  switchTime = Math.max(0, switchTime - dt);
  emptyClick = Math.max(0, emptyClick - dt);
  recoil *= Math.exp(-dt * 15);
  muzzle = Math.max(0, muzzle - dt);
  hitMarker = Math.max(0, hitMarker - dt);
  shakeAmount *= Math.exp(-dt * 15);
  hurtFlash = Math.max(0, hurtFlash - dt * 1.35);
  arcTime = Math.max(0, arcTime - dt);
  levelFlash = Math.max(0, levelFlash - dt);
  banner.t = Math.max(0, banner.t - dt);
  checkpointNote = Math.max(0, checkpointNote - dt);
  if (player.z < 20 && t < 40 && !flags.tipUsed) {
    flags.tipUsed = true;
    radio(`Red barrels explode. Aim at heads. And use your arc burst (${glyph('arc')}) when the crew gets too friendly.`, undefined, 6);
  }
}

function updateEnemies(dt) {
  navTime -= dt;
  if (navTime <= 0) {
    rebuildNav();
    navTime = 0.65;
  }
  bossIntro = Math.max(0, bossIntro - dt);
  for (const e of enemies) {
    if (e.dead) {
      e.death += dt;
      continue;
    }
    e.hit = Math.max(0, e.hit - dt);
    e.muzzle = Math.max(0, e.muzzle - dt);
    e.stun = Math.max(0, e.stun - dt);
    const dx = player.x - e.x;
    const dz = player.z - e.z;
    const distance = Math.hypot(dx, dz);
    if (!e.aggro && distance < 27 && clearLine(e.x, 1.5, e.z, player.x, 1.3, player.z)) e.aggro = true;
    if (!e.aggro) {
      e.angle += Math.sin(t * 0.4 + e.id) * dt * 0.1;
      continue;
    }
    if (e.kind === 'lobber' && !flags.lobberSeen && distance < 30) {
      flags.lobberSeen = true;
      radio('Slush Lobbers. They cannot aim, so they throw ice at the whole area. Cover will not save you. Leave the blue rings.', undefined, 6.5);
    }
    if (e.kind === 'badass' && !flags.knucklesSeen && distance < 30) {
      flags.knucklesSeen = true;
      showBanner('KNUCKLES BRINE', 'WANTED FOR ASSAULT, BATTERY AND ONE VERY CONFUSED SEAL.', 3.2);
      radio('You want my poster money? Come and collect it. Face first.', 'KNUCKLES BRINE / OPEN CHANNEL', 5);
    }
    if (e.burn > 0) {
      e.burn -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        hitEnemy(e, 7, false, 'burn');
        if (e.dead) continue;
      }
    }
    if (e.stun > 0 || (e.kind === 'boss' && bossIntro > 0)) {
      e.charging = 0;
      e.chargeWind = 0;
      e.lobWind = 0;
      continue;
    }
    e.angle = Math.atan2(dx, dz);
    e.cooldown -= dt;
    e.shotCD -= dt;
    const los = clearLine(e.x, 1.5 * e.scale, e.z, player.x, player.y + cameraHeight * 0.7, player.z);
    let vx = 0;
    let vz = 0;
    if (e.kind === 'raider') {
      if (distance > 1.8) {
        const cd = chaseDir(e);
        vx = cd.x * 4.7;
        vz = cd.z * 4.7;
      }
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0 && distance < 3.0 && los) {
          hitPlayer(27);
          e.cooldown = 1.3;
        }
      } else if (distance < 2.6 && e.cooldown <= 0) {
        e.windup = 0.47;
        e.cooldown = 1.5;
      }
    } else if (e.kind === 'badass') {
      // Knuckles Brine: a brute who winds up and charges across the yard.
      e.chargeCD -= dt;
      if (e.charging > 0) {
        e.charging -= dt;
        const sp = 15;
        e.angle = Math.atan2(e.cdx, e.cdz);
        const moved = moveActor(e, e.cdx * sp * dt, e.cdz * sp * dt, ENEMY.badass.radius);
        e.walk += moved * 3;
        if (Math.hypot(player.x - e.x, player.z - e.z) < 1.5 + 0.6 * e.scale && player.y < 1.4) {
          e.charging = 0;
          e.cooldown = 1.2;
          hitPlayer(38);
          moveActor(player, e.cdx * 1.6, e.cdz * 1.6);
          if (settings.shake) shakeAmount = Math.max(shakeAmount, 0.12);
        } else if (moved < sp * dt * 0.3) {
          // Straight into a wall: dazed for a moment.
          e.charging = 0;
          e.stun = 1.6;
          burstParticles(e.x, 1.6, e.z, C.paper, 16, 4);
          audio.play('land', clamp(1 - distance / 40, 0.2, 1));
          if (!flags.wallSlam) {
            flags.wallSlam = true;
            radio('He hit the wall. Hard. Shoot him while he counts the stars.', undefined, 4.5);
          }
        }
        continue;
      }
      if (e.chargeWind > 0) {
        e.chargeWind -= dt;
        if (e.chargeWind <= 0) {
          const l = distance || 1;
          e.cdx = dx / l;
          e.cdz = dz / l;
          e.charging = 0.95;
        }
        continue;
      }
      if (e.windup <= 0 && distance > 5 && distance < 20 && los && e.chargeCD <= 0) {
        e.chargeWind = 0.8;
        e.chargeCD = rnd(5.5, 7.5);
        audio.play('charge', clamp(1 - distance / 40, 0.3, 1));
        continue;
      }
      if (distance > 2.2) {
        const cd = chaseDir(e);
        vx = cd.x * 4.2;
        vz = cd.z * 4.2;
      }
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0 && distance < 3.4 && los) {
          hitPlayer(34);
          e.cooldown = 1.2;
          input.rumble(0.6, 160);
        }
      } else if (distance < 3 && e.cooldown <= 0) {
        e.windup = 0.5;
        e.cooldown = 1.4;
      }
    } else if (e.kind === 'lobber') {
      // Slush Lobber: hangs back and mortars blue blast rings over cover.
      const speed = 2.8;
      if (distance > 24 || (!los && distance > 16)) {
        const cd = chaseDir(e);
        vx = cd.x * speed;
        vz = cd.z * speed;
      } else if (distance < 11) {
        vx = (-dx / (distance || 1)) * 2.4;
        vz = (-dz / (distance || 1)) * 2.4;
      } else {
        const s = Math.sin(t * 0.7 + e.id) * e.strafe * 1.4;
        vx = (-dz / (distance || 1)) * s;
        vz = (dx / (distance || 1)) * s;
      }
      if (e.lobWind > 0) {
        e.lobWind -= dt;
        vx *= 0.2;
        vz *= 0.2;
        if (e.lobWind <= 0) lobShot(e);
      } else if (e.cooldown <= 0 && distance < 30 && (los || distance < 22)) {
        e.lobWind = 0.6;
        e.cooldown = rnd(4.2, 5.6);
      }
    } else {
      const speed = e.kind === 'boss' ? (e.phase === 2 ? 3.2 : 2.4) : 3.2;
      if (distance > (e.kind === 'boss' ? 13 : 18) || !los) {
        const cd = chaseDir(e);
        vx = cd.x * speed;
        vz = cd.z * speed;
      } else if (distance < 7 && e.kind !== 'boss') {
        vx = (-dx / (distance || 1)) * 2.3;
        vz = (-dz / (distance || 1)) * 2.3;
      } else if (e.kind !== 'boss') {
        const s = Math.sin(t * 0.8 + e.id) * e.strafe * 1.8;
        vx = (-dz / (distance || 1)) * s;
        vz = (dx / (distance || 1)) * s;
      }
      if (e.burst > 0 && e.shotCD <= 0) {
        if (los) enemyFire(e);
        e.burst--;
        e.shotCD = e.kind === 'boss' ? 0.15 : 0.2;
        if (e.burst === 0) e.cooldown = e.kind === 'boss' ? (e.phase === 2 ? 1.2 : 2) : 2.1 + rnd(0, 0.8);
      }
      if (e.cooldown <= 0 && e.burst === 0 && los && distance < 40) {
        e.burst = e.kind === 'boss' ? (e.phase === 2 ? 7 : 5) : 3;
        e.shotCD = 0.4;
        e.cooldown = 3.5;
      }
      if (e.kind === 'boss') {
        if (e.phase === 1 && e.hp < e.maxHp * 0.52) {
          e.phase = 2;
          e.stun = 0.8;
          toast('RIME IS ON OVERTIME · ARMOR BROKEN', 3.3);
          radio('Overtime? OVERTIME?! Nobody approved this!', 'FOREMAN RIME / OPEN CHANNEL', 5);
          burstParticles(e.x, 2.4, e.z, C.orange, 40, 7);
          input.rumble(0.7, 300);
          for (let i = 0; i < 3; i++) {
            const p = safeSpawn(e.x + (i - 1) * 5, e.z + 8);
            spawnEnemy(i === 1 ? 'gunner' : 'raider', p[0], p[1], true);
          }
        }
        e.special -= dt;
        e.summon -= dt;
        if (e.special <= 0) {
          e.special = e.phase === 2 ? 4.5 : 6.8;
          hazards.push({ x: player.x, z: player.z, life: 1.65, max: 1.65, r: 4.2, dmg: 55 });
          if (e.phase === 2) {
            hazards.push({ x: player.x + 4, z: player.z - 2, life: 1.65, max: 1.65, r: 4.2, dmg: 55 });
            hazards.push({ x: player.x - 3, z: player.z + 3, life: 1.65, max: 1.65, r: 4.2, dmg: 55 });
          }
          audio.play('shield', 0.45);
        }
        if (e.summon <= 0) {
          e.summon = 12;
          let crew = 0;
          for (const a of enemies) if (!a.dead && a.kind !== 'boss' && a.kind !== 'badass') crew++;
          if (crew < 4) {
            const p = safeSpawn(e.x - 5, e.z + 7);
            spawnEnemy('raider', p[0], p[1], true);
          }
        }
      }
    }
    if (e.windup > 0 || e.chargeWind > 0) {
      vx *= 0.25;
      vz *= 0.25;
    }
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const sx = e.x - o.x;
      const sz = e.z - o.z;
      const l = Math.hypot(sx, sz);
      const r = 0.65 * (e.scale + o.scale);
      if (l > 0 && l < r) {
        vx += (sx / l) * (r - l) * 4;
        vz += (sz / l) * (r - l) * 4;
      }
    }
    const radius = ENEMY[e.kind].radius;
    const moved = moveActor(e, vx * dt, vz * dt, radius);
    if (moved < dt * 0.05 && Math.abs(vx) + Math.abs(vz) > 1) moveActor(e, -vz * dt * 0.65, vx * dt * 0.65, radius);
    e.walk += moved * 4.3;
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!p) continue; // an explosion that killed the boss cleared enemy shots mid-loop
    p.life -= dt;
    if (p.kind === 'grenade') {
      const nx = p.x + p.vx * dt;
      const nz = p.z + p.vz * dt;
      if (!canOccupy(nx, nz, p.y, 0.16)) {
        p.vx *= -0.45;
        p.vz *= -0.45;
        p.life = Math.min(p.life, 0.7);
      } else {
        p.x = nx;
        p.z = nz;
      }
      p.vy -= 14 * dt;
      p.y += p.vy * dt;
      if (p.y < 0.2) {
        p.y = 0.2;
        p.vy = Math.abs(p.vy) * 0.5;
        p.vx *= 0.75;
        p.vz *= 0.75;
      }
      if (p.life <= 0) {
        projectiles.splice(i, 1);
        explosion(p.x, p.y, p.z, 7.2, 195);
      }
    } else if (p.kind === 'lob') {
      p.age += dt;
      p.vy -= 14 * dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const nz = p.z + p.vz * dt;
      const landed = ny <= 0.2;
      if (landed || !canOccupy(nx, nz, ny, 0.15) || p.life <= 0) {
        const hx = landed ? nx : p.x;
        const hz = landed ? nz : p.z;
        hazards.push({ x: hx, z: hz, life: 0.85, max: 0.85, r: 3.2, dmg: 30 });
        burstParticles(hx, 0.3, hz, C.blue, 8, 2);
        projectiles.splice(i, 1);
        continue;
      }
      p.x = nx;
      p.y = ny;
      p.z = nz;
    } else {
      const ox = p.x;
      const oy = p.y;
      const oz = p.z;
      const ddx = p.vx * dt;
      const ddy = p.vy * dt;
      const ddz = p.vz * dt;
      const len = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 1e-6;
      const dx = ddx / len;
      const dy = ddy / len;
      const dz = ddz / len;
      const wall = wallHit(ox, oy, oz, dx, dy, dz, len);
      const hit = rayBox(ox, oy, oz, dx, dy, dz, player.x - 0.38, player.y + 0.05, player.z - 0.38, player.x + 0.38, player.y + cameraHeight + 0.1, player.z + 0.38, len);
      if (hit <= len && hit <= wall + 0.02) {
        projectiles.splice(i, 1);
        hitPlayer(p.damage);
        continue;
      }
      p.x += ddx;
      p.y += ddy;
      p.z += ddz;
      if (wall < len || p.life <= 0) {
        if (wall < len) burstParticles(p.x, p.y, p.z, C.orange, 3, 1);
        projectiles.splice(i, 1);
      }
    }
  }
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.life -= dt;
    if (h.life <= 0) {
      hazards.splice(i, 1);
      explosion(h.x, 0.35, h.z, h.r, h.dmg ?? 55, true, true);
    }
  }
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 13 * dt;
    if (p.y < 0.025) {
      p.y = 0.025;
      p.vy *= -0.25;
      p.vx *= 0.8;
      p.vz *= 0.8;
    }
    if (p.life <= 0) {
      particles[i] = particles[particles.length - 1];
      particles.pop();
      particleFree.push(p);
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const p = tracers[i];
    p.life -= dt;
    if (p.ring) p.r = p.target * (1 - p.life / p.max);
    if (p.life <= 0) tracers.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.y += dt * 0.55;
    if (f.life <= 0) floaters.splice(i, 1);
  }
  for (const l of loot) {
    if (l.taken) continue;
    l.time += dt;
    const distance = Math.hypot(l.x - player.x, l.z - player.z);
    if (distance < 1.65 && player.y < 1.8 && !l.gun) {
      let collected = false;
      if (l.type === 'ammo') {
        for (const w of weapons) {
          if (w.reserve < w.reserveMax) collected = true;
          w.reserve = Math.min(w.reserveMax, w.reserve + w.mag * 2);
        }
        if (player.grenades < 3 && rand() < 0.35) {
          player.grenades++;
          collected = true;
        }
      } else if (l.type === 'health') {
        if (player.health < player.maxHealth && !player.down) {
          player.health = Math.min(player.maxHealth, player.health + 45);
          collected = true;
        }
      } else {
        stats.cash += Math.round(rnd(8, 24));
        collected = true;
      }
      if (collected) {
        l.taken = true;
        audio.play('pickup', 0.45);
      }
    }
  }
  // Taken loot is never drawn again: drop it so long runs do not pile it up.
  for (let i = loot.length - 1; i >= 0; i--) if (loot[i].taken) loot.splice(i, 1);
  if (toastTime > 0) {
    toastTime -= dt;
    if (toastTime <= 0) $('toast').style.opacity = '0';
  }
  if (radioTime > 0) {
    radioTime -= dt;
    if (radioTime <= 0) {
      $('radio').style.opacity = '0';
      radioSilence = 0.8;
    }
  } else {
    radioSilence -= dt;
    if (radioQueue.length && radioSilence <= 0) {
      const r = radioQueue.shift();
      $('radioText').textContent = r.text;
      $('radioName').textContent = r.speaker;
      $('radio').style.opacity = '1';
      radioTime = r.duration;
      audio.play('radio');
    }
  }
}

function update(dt) {
  t += dt;
  elapsed += dt;
  updatePlayer(dt);
  if (mode !== 'playing') return;
  updateEnemies(dt);
  updateProjectiles(dt);
  updateEffects(dt);
}

function inCombat() {
  for (const e of enemies) if (!e.dead && e.aggro && Math.hypot(e.x - player.x, e.z - player.z) < 32) return true;
  return false;
}

// ------------------------------------------------------------------ input
/** Gamepad and touch aim: the view slows a little while the reticle is on an enemy. */
function reticleOnEnemy() {
  const cp = Math.cos(player.pitch);
  const fx = Math.sin(player.yaw) * cp;
  const fy = Math.sin(player.pitch);
  const fz = -Math.cos(player.yaw) * cp;
  const ox = player.x;
  const oy = player.y + cameraHeight;
  const oz = player.z;
  for (const e of enemies) {
    if (e.dead || !e.aggro) continue;
    const dx = e.x - ox;
    const dy = 1.3 * e.scale - oy;
    const dz = e.z - oz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > 45 || d < 0.5) continue;
    const along = (dx * fx + dy * fy + dz * fz) / d;
    if (along > 0 && Math.sqrt(Math.max(0, 1 - along * along)) * d < 0.9 * e.scale) return true;
  }
  return false;
}

function playInput() {
  const lk = input.look('look');
  let k = aimBlend > 0.5 ? 0.72 : 1;
  if (input.source !== 'keyboard' && reticleOnEnemy()) k *= 0.6;
  player.yaw += lk.x * k;
  player.pitch = clamp(player.pitch - lk.y * k, -1.35, 1.35);

  const mv = input.vector('move');
  intent.mx = mv.x;
  intent.my = mv.y;
  intent.fire = input.down('fire');
  if (input.pressed('aimToggle')) aimLatch = !aimLatch;
  intent.aim = input.down('aim') || aimLatch;
  intent.crouch = input.down('crouch');
  const mag = Math.hypot(mv.x, mv.y);
  if (input.pressed('sprint') && input.source === 'gamepad') sprintLatch = true;
  if (mag < 0.3 || mv.y < 0.2 || intent.aim || intent.crouch) sprintLatch = false;
  intent.sprint = input.down('sprint') || sprintLatch || (input.source === 'touch' && mag > 0.93 && mv.y > 0.6);

  if (input.pressed('jump') && player.ground && !player.down) {
    player.vy = 7.8;
    player.ground = false;
    slideTimer = 0;
    audio.play('jump');
  }
  if (input.pressed('crouch') && player.sprinting && player.ground && !player.down) {
    const len = Math.hypot(player.vx, player.vz) || 1;
    slideDir[0] = player.vx / len;
    slideDir[1] = player.vz / len;
    slideTimer = 0.85;
    audio.play('land', 0.5);
  }
  if (input.pressed('melee')) melee();
  if (input.pressed('reload')) reload();
  if (input.pressed('arc')) arcBurst();
  if (input.pressed('grenade')) throwGrenade();
  if (input.pressed('use')) use();
  if (input.pressed('padX')) {
    if (interactable) use();
    else reload();
  }
  if (input.pressed('weapon1')) switchWeapon(0);
  if (input.pressed('weapon2')) switchWeapon(1);
  if (input.pressed('weapon3')) switchWeapon(2);
  if (input.pressed('swap')) switchWeapon((weaponIndex + 1) % 3);
  if (input.source !== 'touch') {
    wheelAcc = wheelAcc * 0.9 + input.wheel;
    if (wheelAcc <= -0.5) {
      switchWeapon((weaponIndex + 1) % 3);
      wheelAcc = 0;
    } else if (wheelAcc >= 0.5) {
      switchWeapon((weaponIndex + 2) % 3);
      wheelAcc = 0;
    }
  }
}

// Menus: keyboard arrows, gamepad stick / D-pad, A to confirm, B or Start to go back.
let navEl = null;
let navKey = 0;
let navHold = 0;
let focusWanted = false;

function setNav(el) {
  if (navEl) navEl.classList.remove('nav-focus');
  navEl = el;
  if (el) {
    el.classList.add('nav-focus');
    el.focus({ preventScroll: false });
  }
}
function activePanel() {
  if (!$('manual').classList.contains('hidden')) return $('manual');
  if (!$('end').classList.contains('hidden')) return $('end');
  if (!$('pause').classList.contains('hidden')) return $('pause');
  if (mode === 'menu' && !$('menu').classList.contains('hidden')) return $('menu');
  return null;
}
function navItems(panel) {
  return [...panel.querySelectorAll('button, input, select')].filter((el) => !el.disabled && el.getClientRects().length > 0);
}
/** A controller user lands on the panel's first button; mouse and touch users see no focus ring. */
function focusPanelSoon() {
  focusWanted = true;
}
function adjust(el, dir) {
  if (el.tagName === 'INPUT' && el.type === 'range') {
    const step = +el.step || 1;
    el.value = String(clamp(+el.value + dir * step, +el.min, +el.max));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    audio.play('ui', 0.4);
  } else if (el.tagName === 'SELECT') {
    el.selectedIndex = clamp(el.selectedIndex + dir, 0, el.options.length - 1);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    audio.play('ui', 0.4);
  } else if (el.dataset.tab) {
    const tabs = [...el.parentElement.querySelectorAll('button')];
    const next = tabs[clamp(tabs.indexOf(el) + dir, 0, tabs.length - 1)];
    next.click();
    setNav(next);
  }
}
function activate(el) {
  if (el.tagName === 'INPUT' && el.type === 'checkbox') {
    el.checked = !el.checked;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    audio.play('ui', 0.4);
  } else if (el.tagName === 'SELECT') {
    el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    audio.play('ui', 0.4);
  } else if (el.tagName === 'BUTTON') el.click();
}
function panelBack(panel) {
  if (panel.id === 'manual') closeManual();
  else if (panel.id === 'pause') resumeGame();
}

function menuInput(dt) {
  const panel = activePanel();
  if (!panel) {
    if (navEl) setNav(null);
    return;
  }
  if (navEl && (!panel.contains(navEl) || navEl.getClientRects().length === 0)) setNav(null);
  if (focusWanted) {
    focusWanted = false;
    if (input.source === 'gamepad') {
      const items = navItems(panel);
      const first = panel.querySelector('.primary:not(.hidden)') || items[0];
      if (first) setNav(first);
    }
  }
  const v = input.vector('nav');
  const dir = Math.abs(v.y) > 0.5 ? (v.y > 0 ? -1 : 1) : 0;
  const side = dir ? 0 : Math.abs(v.x) > 0.5 ? Math.sign(v.x) : 0;
  const key = dir || side * 10;
  let step = 0;
  let adj = 0;
  if (key !== navKey) {
    navKey = key;
    navHold = 0.38;
    step = dir;
    adj = side;
  } else if (key) {
    navHold -= dt;
    if (navHold <= 0) {
      navHold = 0.12;
      step = dir;
      adj = side;
    }
  }
  if (step) {
    const items = navItems(panel);
    if (items.length) {
      const i = navEl ? items.indexOf(navEl) : -1;
      setNav(items[i < 0 ? 0 : (i + step + items.length) % items.length]);
      audio.play('ui', 0.35);
    }
  }
  if (adj && navEl) adjust(navEl, adj);
  if (input.pressed('confirm')) {
    if (navEl) activate(navEl);
    else panel.querySelector('.primary:not(.hidden)')?.click();
    return;
  }
  if ((input.pressed('back') || input.pressed('pause')) && performance.now() - pausedAt > 250) panelBack(panel);
}

function globalInput(dt) {
  if (input.pressed('mute')) {
    audio.init();
    audio.toggle();
  }
  const manualOpen = !$('manual').classList.contains('hidden');
  if (input.pressed('help') && (mode === 'playing' || mode === 'paused' || mode === 'menu')) {
    if (manualOpen) closeManual();
    else openManual();
    return;
  }
  if (mode === 'playing') {
    if (input.pressed('pause')) pauseGame();
    return;
  }
  menuInput(dt);
}

// ------------------------------------------------------------------ DOM wiring
for (const key of ['fov', 'volume', 'music', 'difficulty', 'shake']) {
  const el = $(key);
  if (el.type === 'checkbox') el.checked = !!settings[key];
  else el.value = settings[key];
  const onChange = () => {
    settings[key] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    // A run that dropped to an easier setting records its time there.
    if (key === 'difficulty' && (mode === 'playing' || mode === 'paused') && DIFF_RANK[settings.difficulty] < DIFF_RANK[runDifficulty]) runDifficulty = settings.difficulty;
    if (key === 'difficulty' && mode === 'menu') refreshTitle();
    saveSettings();
  };
  el.addEventListener('input', onChange);
  el.addEventListener('change', onChange);
}

function showTab(name) {
  for (const b of document.querySelectorAll('.control-tabs button')) b.classList.toggle('on', b.dataset.tab === name);
  for (const g of document.querySelectorAll('.manual-grid')) g.classList.toggle('hidden', g.dataset.grid !== name);
}
for (const b of document.querySelectorAll('.control-tabs button')) b.addEventListener('click', () => showTab(b.dataset.tab));

const openKitMenu = () => {
  audio.init();
  kit.menu.open();
};
$('continueBtn').addEventListener('click', continueGame);
$('startBtn').addEventListener('click', newGame);
$('manualBtn').addEventListener('click', openManual);
$('kitMenuBtn').addEventListener('click', openKitMenu);
$('pauseManual').addEventListener('click', openManual);
$('pauseKit').addEventListener('click', openKitMenu);
$('manualKit').addEventListener('click', openKitMenu);
$('closeManual').addEventListener('click', closeManual);
$('resumeBtn').addEventListener('click', resumeGame);
$('retryBtn').addEventListener('click', () => {
  audio.init();
  restoreCheckpoint();
});
$('exitBtn').addEventListener('click', toMenu);
$('endMenuBtn').addEventListener('click', toMenu);
$('replayBtn').addEventListener('click', () => {
  audio.init();
  if (mode === 'dead') restoreCheckpoint();
  else newGame();
});

// Browsers only start audio after a gesture: take the first one, whatever it is.
addEventListener('pointerdown', () => audio.init(), true);
addEventListener('keydown', () => audio.init(), true);
kit.canvas.addEventListener('pointerdown', (e) => {
  if (mode === 'playing' && e.pointerType === 'mouse' && document.pointerLockElement !== kit.canvas) input.lockPointer();
});
// The kit leaves keys alone while a slider or list has focus; Escape still closes the manual.
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || !e.target || !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (!$('manual').classList.contains('hidden')) {
    e.preventDefault();
    closeManual();
  }
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === kit.canvas;
  if (!locked && wasLocked && mode === 'playing') pauseGame();
  wasLocked = locked;
});
document.addEventListener('pointerlockerror', () => {
  // The kit retries without raw input first, so only complain if the lock never arrives.
  setTimeout(() => {
    if (mode === 'playing' && input.source === 'keyboard' && !document.pointerLockElement) toast('CLICK TO CAPTURE THE MOUSE · OR HOLD LEFT CLICK TO LOOK', 4);
  }, 700);
});
addEventListener('blur', () => {
  if (mode === 'playing') pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (mode === 'playing') pauseGame();
  else if (mode === 'paused') persist();
});
addEventListener('pagehide', () => {
  if (mode === 'playing' || mode === 'paused') persist();
});
input.onSourceChange(() => {
  hudDirty = true;
  if (input.source === 'gamepad' && activePanel() && !navEl) focusPanelSoon();
});

window.Outerlands = Object.freeze({
  version: '2.0.0',
  state: () => ({ mode, mission: stage, relays: relaysOn(), kills: stats.kills, level: stats.level, time: Math.floor(elapsed), weapon: weapons[weaponIndex]?.name, bounty: bounty.state, backend: kit.backend, offline: true }),
});

// ------------------------------------------------------------------ HUD (DOM writes only on change)
const hudSlots = {};
function slot(id) {
  return hudSlots[id] || (hudSlots[id] = { el: $(id), text: null, html: null, shown: null, style: {}, cls: {} });
}
function hudText(id, v) {
  const s = slot(id);
  if (s.text !== v) {
    s.text = v;
    s.el.textContent = v;
  }
}
function hudHTML(id, v) {
  const s = slot(id);
  if (s.html !== v) {
    s.html = v;
    s.el.innerHTML = v;
  }
}
function hudStyle(id, prop, v) {
  const s = slot(id);
  if (s.style[prop] !== v) {
    s.style[prop] = v;
    s.el.style[prop] = v;
  }
}
function hudShow(id, on) {
  const s = slot(id);
  if (s.shown !== on) {
    s.shown = on;
    s.el.classList.toggle('hidden', !on);
  }
}
function hudClass(id, cls, on) {
  const s = slot(id);
  if (s.cls[cls] !== on) {
    s.cls[cls] = on;
    s.el.classList.toggle(cls, on);
  }
}
const pct = (x) => (clamp(x, 0, 1) * 100).toFixed(1) + '%';
const slotEls = [...$('weaponSlots').children];
const SLOT_NAMES = ['RIFLE', 'SHOTGUN', 'PISTOL'];
let slotSig = '';
let lootSig = null;
let lootSigSlot = null;
let touchArc = '';
let touchNade = '';

function updateHUD() {
  if (!weapons.length) return;
  const w = weapons[weaponIndex];
  hudStyle('healthBar', 'width', pct(player.health / player.maxHealth));
  hudStyle('shieldBar', 'width', pct(player.shield / player.maxShield));
  hudText('healthNum', String(Math.ceil(player.health)));
  hudText('shieldNum', String(Math.ceil(player.shield)));
  hudText('level', String(stats.level).padStart(2, '0'));
  hudStyle('xpBar', 'width', pct(stats.xp / xpNeed()));
  hudText('cash', String(stats.cash).padStart(4, '0'));
  hudText('killCount', String(stats.kills));
  hudText('ammo', String(w.ammo).padStart(2, '0'));
  hudStyle('ammo', 'color', w.ammo < Math.ceil(w.mag * 0.22) ? '#f6b16c' : '#f5f0d8');
  hudText('reserve', String(w.reserve));
  hudText('gunName', w.name);
  hudText('gunRarity', w.brand + ' / ' + w.rarity + (w.element !== 'kinetic' ? ' / ' + w.element.toUpperCase() : ''));
  hudStyle('gunRarity', 'color', w.color);
  const sig = weaponIndex + input.source;
  if (sig !== slotSig) {
    slotSig = sig;
    const keys = glyph('slots');
    slotEls.forEach((el, i) => {
      el.classList.toggle('selected', i === weaponIndex);
      el.textContent = keys[i] ? `${keys[i]} / ${SLOT_NAMES[i]}` : SLOT_NAMES[i];
    });
  }
  hudText('abilityText', player.ability > 0 ? Math.ceil(player.ability) + ' SEC' : `[${glyph('arc')}] READY`);
  hudText('grenadeText', `[${glyph('grenade')}] ${player.grenades} / 3`);
  if (kit.touch && input.source === 'touch') {
    // The ability row is hidden on touch, so the pills carry the cooldown and grenade count.
    const arcLabel = player.ability > 0 ? 'Arc ' + Math.ceil(player.ability) : 'Arc';
    if (arcLabel !== touchArc) kit.touch.setLabel('arc', (touchArc = arcLabel));
    const nadeLabel = 'Nade ' + player.grenades;
    if (nadeLabel !== touchNade) kit.touch.setLabel('grenade', (touchNade = nadeLabel));
  }
  const count = relaysOn();
  hudText('missionTask', stage === 'relays' ? 'Restore the power · ' + count + ' / 3' : stage === 'boss' ? 'Stop Foreman Rime' : stage === 'vault' ? 'Open the vault' : 'Reach the exit');
  const useWord = input.source === 'touch' ? 'Tap USE' : `Press ${glyph('use')}`;
  hudHTML(
    'missionHint',
    stage === 'relays'
      ? `Follow the gold markers.<br>${useWord} at each relay.`
      : stage === 'boss'
        ? 'Aim at his head. Keep moving.<br>Leave blue rings before impact.'
        : stage === 'vault'
          ? 'The crew is off the clock.<br>Take the payout at the gold marker.'
          : `Take the legendary weapon.<br>${useWord} at the exit beacon.`
  );
  const side = bounty.state === 'active' ? 'WANTED · Knuckles Brine · east yard' : bounty.state === 'done' ? 'Bounty claimed · $400' : stage !== 'extract' ? 'Optional · Read the bounty board by the landing' : '';
  hudShow('sideTask', !!side);
  if (side) hudText('sideTask', side);

  // Boss bar: Foreman Rime, or Knuckles Brine while he is on you.
  let bar = null;
  let title = '';
  let sub = '';
  if (boss && !boss.dead && stage === 'boss') {
    bar = boss;
    title = 'FOREMAN RIME';
    sub = boss.phase === 2 ? 'OVERTIME / ARMOR BROKEN' : 'HEAD OF INVOLUNTARY LABOR';
  } else if (bounty.state === 'active') {
    for (const e of enemies)
      if (e.id === bounty.id && !e.dead && e.aggro && Math.hypot(e.x - player.x, e.z - player.z) < 45) {
        bar = e;
        title = 'KNUCKLES BRINE';
        sub = e.charging > 0 || e.chargeWind > 0 ? 'CHARGING · GET OUT OF THE WAY' : 'WANTED · $400 · ALIVE OR LESS';
      }
  }
  hudShow('bossHud', !!bar);
  if (bar) {
    hudText('bossTitle', title);
    hudText('bossPhase', sub);
    hudStyle('bossFill', 'width', pct(bar.hp / bar.maxHp));
  }
  hudShow('downHud', player.down);
  if (player.down) hudStyle('downFill', 'width', pct(player.downTime / 12));
  const reloading = reloadTime > 0;
  const empty = w.ammo === 0;
  hudShow('reloadHint', reloading || empty);
  if (reloading || empty) hudText('reloadHint', reloading ? 'RELOADING · ' + reloadTime.toFixed(1) + 's' : w.reserve > 0 ? `[${glyph('reload')}] RELOAD` : 'NO AMMO · SWITCH WEAPON / FIND SUPPLIES');
  hudClass('reticle', 'ads', aimBlend > 0.5);
  hudStyle('reticle', 'opacity', reloading ? '0.2' : player.sprinting ? '0.45' : '0.9');
  const deg = (((player.yaw / DEG) % 360) + 360) % 360;
  const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
  hudText('compass', '·  ' + compass + '  ·  ' + String(Math.round(deg) % 360).padStart(3, '0') + '°');

  const found = interactable;
  hudShow('interact', !!found);
  if (found) hudHTML('interact', `<kbd>${glyph('use')}</kbd>${found.label}`);
  const gun = found && found.kind === 'gun' ? found.obj.gun : null;
  hudShow('lootCard', !!gun);
  if (gun && (gun !== lootSig || lootSigSlot !== weapons[gun.slot])) {
    lootSig = gun;
    lootSigSlot = weapons[gun.slot];
    const old = weapons[gun.slot];
    const change = Math.round((gun.damage / old.damage - 1) * 100);
    const card = slot('lootCard').el;
    card.style.borderColor = gun.color;
    $('lootBrand').textContent = gun.brand + ' / ' + gun.rarity;
    $('lootBrand').style.color = gun.color;
    $('lootName').textContent = gun.name;
    $('lootName').style.color = gun.color;
    $('lootStats').innerHTML =
      'DAMAGE &nbsp; ' + gun.damage + (gun.pellets > 1 ? ' × ' + gun.pellets : '') +
      ' &nbsp; <span style="color:' + (change >= 0 ? '#a7d985' : '#ee6250') + '">' + (change >= 0 ? '+' : '') + change + '%</span><br>' +
      'FIRE RATE &nbsp; ' + (1 / gun.rate).toFixed(1) + ' / SEC<br>MAGAZINE &nbsp; ' + gun.mag + '<br>ELEMENT &nbsp; ' + gun.element.toUpperCase() +
      '<br><span class="muted">REPLACES SLOT ' + (gun.slot + 1) + ' · ' + old.name + '</span>';
    $('lootFlavor').textContent = '“' + gun.flavor + '”';
  }
  hudText('saving', checkpointNote > 0 ? 'CHECKPOINT SET · SAVED ON THIS DEVICE' : `${glyph('pause')} / PAUSE` + (input.source === 'touch' ? '' : `  ·  ${glyph('help')} / HELP`));
  hudStyle('hurt', 'opacity', clamp(hurtFlash * 0.8 + (player.down ? 0.38 : player.health < 35 ? 0.12 : 0), 0, 1).toFixed(2));
  hudDirty = false;
}

// ------------------------------------------------------------------ scene sync (three.js side)
const poolList = [...Object.values(gfx.enemyPools), gfx.stunPool, ...Object.values(gfx.lootPools), gfx.boltPool, gfx.lobPool, gfx.grenadePool];
const gunKeys = Object.keys(gfx.guns);
const tmpV = new THREE.Vector3();
const camDir = new THREE.Vector3();

function setFov(f) {
  if (Math.abs(camera.fov - f) > 0.01) {
    camera.fov = f;
    camera.updateProjectionMatrix();
  }
}

function syncCamera(dt) {
  if (mode === 'menu') {
    camera.position.set(5 + Math.sin(visualTime * 0.065) * 1.8, 4.6, 43);
    camera.lookAt(-2, 5.2, -24);
    currentFov = 74;
    setFov(74);
  } else {
    const bob = player.moving && player.ground ? Math.sin(t * (player.sprinting ? 17 : 12)) * (aimBlend > 0.5 ? 0.011 : 0.036) : 0;
    const shake = settings.shake ? shakeAmount : 0;
    camera.position.set(player.x + Math.sin(visualTime * 72) * shake, player.y + cameraHeight + bob + Math.sin(visualTime * 86) * shake * 0.5, player.z);
    const pitch = player.pitch + recoil * 0.12 + (settings.shake ? Math.cos(visualTime * 83) * shake * 0.06 : 0);
    const yaw = player.yaw + (settings.shake ? Math.sin(visualTime * 79) * shake * 0.055 : 0);
    camera.rotation.set(pitch, -yaw, 0); // order YXZ: yaw turns right, pitch looks up
    if (mode === 'playing') currentFov = lerp(currentFov, settings.fov - aimBlend * 29 + (player.sprinting ? 7 : 0), 1 - Math.exp(-dt * 15));
    setFov(currentFov);
  }
  camera.updateMatrixWorld();
  camera.getWorldDirection(camDir);
  gfx.skyTime.value = visualTime; // clouds drift, as in the original sky shader
  gfx.placeSun(camera.position.x + camDir.x * 18, camera.position.z + camDir.z * 18);
}

function syncScene() {
  for (let i = 0; i < barrels.length; i++) gfx.barrels[i].visible = !barrels[i].dead;
  for (let i = 0; i < relays.length; i++) {
    gfx.relayGlow[i].visible = relays[i].on;
    gfx.relaySpark[i].visible = !relays[i].on;
  }
  for (let i = 0; i < supplySpots.length; i++) gfx.supplyOrbs[i].visible = !supplySpots[i].open || t >= supplySpots[i].next;

  for (const p of poolList) p.begin();
  if (mode !== 'menu') {
    const ex = camera.position.x;
    const ez = camera.position.z;
    for (const e of enemies) {
      if (e.dead && e.death > 5) continue;
      if (Math.hypot(e.x - ex, e.z - ez) > 80 * kit.tier.drawDistance) continue;
      const it = gfx.enemyPools[e.kind].next();
      const deadAngle = e.dead ? Math.min(1, e.death * 4) * Math.PI * 0.47 : 0;
      const deathY = e.dead ? -Math.max(0, e.death - 2) * 0.14 : 0;
      it.group.position.set(e.x, deathY, e.z);
      it.group.rotation.set(deadAngle, e.angle, 0);
      it.group.scale.setScalar(e.scale);
      it.body.position.y = e.dead ? 0 : Math.sin(e.walk * 2) * 0.026;
      if (it.bodyMesh) it.bodyMesh.material = e.hit > 0 ? gfx.mat.toonFlash : gfx.mat.toon;
      const stride = e.dead ? 0 : Math.sin(e.walk) * 0.19;
      it.legL.position.set(-0.23, 0, stride);
      it.legL.rotation.x = stride * 0.9;
      it.legR.position.set(0.23, 0, -stride);
      it.legR.rotation.x = -stride * 0.9;
      it.muzzle.visible = e.muzzle > 0 && !e.dead;
      if (e.stun > 0 && !e.dead) {
        const s = gfx.stunPool.next();
        s.group.position.set(e.x, e.scale * 2.65, e.z);
        s.group.rotation.y = t * 5;
      }
    }
    for (const l of loot) {
      if (l.taken || Math.hypot(l.x - ex, l.z - ez) > 65) continue;
      const it = gfx.lootPools[l.type].next();
      it.group.position.set(l.x, 0.12 + Math.sin(t * 2 + l.phase) * 0.08, l.z);
      it.group.rotation.y = l.gun ? t * 0.55 + l.phase : l.phase;
    }
    for (const p of projectiles) {
      if (p.kind === 'grenade') {
        const it = gfx.grenadePool.next();
        it.group.position.set(p.x, p.y, p.z);
        it.group.rotation.set(t * 5, t * 5, 0);
      } else if (p.kind === 'lob') {
        gfx.lobPool.next().group.position.set(p.x, p.y, p.z);
      } else {
        gfx.boltPool.next().group.position.set(p.x, p.y, p.z);
      }
    }
  }
  for (const p of poolList) p.end();

  let n = 0;
  for (const p of particles) {
    if (n >= gfx.particles.max) break;
    gfx.particles.set(n++, p.x, p.y, p.z, p.size * clamp(p.life / 0.15, 0, 1), p.col);
  }
  gfx.particles.end(n);

  syncLines();
  syncWeapon();
}

const SNOW_COL = color('#d6e2d4');
const BEAM_OFFSETS = [-0.05, 0, 0.05];

function syncLines() {
  const L = gfx.lines;
  L.begin();
  for (const tr of tracers) {
    if (tr.ring) {
      L.ring(tr.x, tr.y, tr.z, tr.r, tr.col, 48);
      L.ring(tr.x, tr.y + 0.15, tr.z, tr.r * 0.95, tr.col, 48);
    } else if (tr.arc) {
      let px = tr.ax;
      let py = tr.ay;
      let pz = tr.az;
      for (let k = 1; k <= 6; k++) {
        const f = k / 6;
        let x = tr.ax + (tr.bx - tr.ax) * f;
        let y = tr.ay + (tr.by - tr.ay) * f;
        const z = tr.az + (tr.bz - tr.az) * f;
        if (k < 6) {
          x += Math.sin(t * 90 + k) * 0.32;
          y += Math.cos(t * 120 + k) * 0.28;
        }
        L.seg(px, py, pz, x, y, z, tr.col);
        px = x;
        py = y;
        pz = z;
      }
    } else {
      L.seg(tr.ax, tr.ay, tr.az, tr.bx, tr.by, tr.bz, tr.col);
      L.seg(tr.ax + 0.018, tr.ay + 0.018, tr.az, tr.bx + 0.018, tr.by + 0.018, tr.bz, tr.col);
    }
  }
  for (const h of hazards) {
    const pulse = 0.8 + Math.sin(t * 18) * 0.15;
    L.ring(h.x, 0.04, h.z, h.r * pulse, C.blue, 48);
    L.ring(h.x, 0.05, h.z, h.r * (1 - h.life / h.max), C.blue, 48);
    L.seg(h.x - 0.7, 0.06, h.z, h.x + 0.7, 0.06, h.z, C.blue);
    L.seg(h.x, 0.06, h.z - 0.7, h.x, 0.06, h.z + 0.7, C.blue);
    const hy = 6 * (h.life / h.max);
    L.seg(h.x, hy, h.z, h.x, hy + 1, h.z, C.blue);
  }
  if (mode !== 'menu') {
    // Where a Slush Lobber's shot will land, drawn while it is in the air.
    for (const p of projectiles) if (p.kind === 'lob') L.ring(p.tx, 0.05, p.tz, 3.2 * Math.min(1, p.age / 1.15), C.blue, 32);
    for (const l of loot) {
      if (l.taken || !l.gun || Math.hypot(l.x - camera.position.x, l.z - camera.position.z) > 65) continue;
      const col = hexColor(l.gun.color);
      for (const off of BEAM_OFFSETS) L.seg(l.x + off, 0.25, l.z, l.x + off, 3.5, l.z, col);
      L.ring(l.x, 0.03, l.z, 0.5, col, 16);
    }
    if (stage === 'extract') {
      L.ring(3, 0.05, -59, 2.6, C.blue, 48);
      L.ring(3, 0.05, -59, 2.9, C.blue, 48);
      L.seg(3, 0.1, -59, 3, 18, -59, C.blue);
    }
    if (stage === 'vault') for (const x of [2.8, 5.2]) L.seg(x, 1, -54, x, 8, -54, C.yellow);
  }
  const ex = camera.position.x;
  const ez = camera.position.z;
  const snowCol = SNOW_COL;
  for (let i = 0; i < snowCount; i++) {
    const s = snow[i];
    const x = ex + ((s.x + visualTime * s.v * 0.5 + 35) % 70) - 35;
    const y = (((s.y - visualTime * s.v) % 22) + 22) % 22;
    const z = ez + s.z;
    L.seg(x, y, z, x + 0.06, y + 0.14, z, snowCol);
  }
  L.end();
}

function syncWeapon() {
  const show = (mode === 'playing' || mode === 'paused') && weapons.length > 0;
  const w = show ? weapons[weaponIndex] : null;
  const key = !w ? '' : w.rarity === 'LEGENDARY' ? (w.type === 'shotgun' ? 'legendShotgun' : 'legend') : w.type;
  for (const k of gunKeys) gfx.guns[k].visible = k === key;
  gfx.arms[0].visible = !!w;
  gfx.arms[1].visible = !!w && w.type !== 'pistol';
  muzzleScreen.ok = false;
  if (!w) return;
  const bob = player.moving ? Math.sin(t * (player.sprinting ? 17 : 12)) * 0.012 : Math.sin(t * 1.7) * 0.002;
  const reloadBend = reloadTime > 0 ? Math.sin((1 - reloadTime / reloadTotal) * Math.PI) : 0;
  // Keep the gun on screen on narrow (portrait) displays.
  const narrow = clamp(kit.size.width / kit.size.height / 1.2, 0.55, 1);
  const x = lerp(0.33 * narrow, 0, aimBlend) + Math.sin(t * 6) * 0.003 * (1 - aimBlend);
  const y = lerp(-0.32, -0.181, aimBlend) + bob - reloadBend * 0.3 - switchTime * 1.3;
  const melee = Math.sin((meleeAnim / 0.27) * Math.PI);
  const z = -0.92 + recoil * 0.35 - melee * 0.22;
  const rotZ = -melee * 1.15 - reloadBend * 0.75 + (player.sprinting ? -0.33 : 0) + Math.sin(t * 6) * 0.005;
  const rotX = recoil * 0.9 + (player.sprinting ? -0.2 : 0);
  const gun = gfx.guns[key];
  gun.position.set(x, y, z);
  gun.rotation.set(rotX, 0, rotZ);
  gfx.arms[0].position.set(x + 0.12, y - 0.22, z + 0.4);
  gfx.arms[0].rotation.set(-0.12, -0.15, -0.15);
  gfx.arms[1].position.set(x - 0.18, y - 0.15, z - 0.09);
  gfx.arms[1].rotation.set(-0.1, -0.8, -0.2);
  gfx.weaponFlash.value = muzzle > 0 ? 0.12 : 0;
  if (muzzle > 0) {
    gun.updateMatrixWorld();
    tmpV.set(0, 0.03, w.type === 'pistol' ? -0.58 : -1.01).applyMatrix4(gun.matrixWorld).project(gfx.weaponCam);
    muzzleScreen.x = (tmpV.x * 0.5 + 0.5) * W;
    muzzleScreen.y = (0.5 - tmpV.y * 0.5) * H;
    muzzleScreen.ok = true;
  }
}

// ------------------------------------------------------------------ 2D overlay (markers, labels, minimap)
const P = { x: 0, y: 0, w: 0 };
const pv = new THREE.Vector3();
function project(x, y, z) {
  pv.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  const w = -pv.z;
  if (w < 0.08) return null;
  pv.applyMatrix4(camera.projectionMatrix);
  P.x = (pv.x * 0.5 + 0.5) * W;
  P.y = (0.5 - pv.y * 0.5) * H;
  P.w = w;
  return P;
}

function outlinedText(text, x, y, size, col, align = 'center', italic = false) {
  ctx.font = (italic ? 'italic ' : '') + '900 ' + size + 'px Arial';
  ctx.textAlign = align;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#10252c';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
}

function drawMarker(x, z, label, isNear = false, y = 4, tint = '#f8c544') {
  const distance = Math.hypot(x - player.x, z - player.z);
  const p = project(x, y, z);
  const top = Math.min(130, H * 0.2);
  const bottom = Math.min(170, H * 0.26);
  if (p && p.x > 36 && p.x < W - 36 && p.y > top && p.y < H - bottom) {
    const xx = p.x;
    const yy = p.y;
    ctx.save();
    ctx.translate(xx, yy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#112830';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = tint;
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
    if (isNear) outlinedText(label, xx, yy - 21, 11, tint === '#f8c544' ? '#f8d77b' : tint);
    outlinedText(Math.round(distance) + ' m', xx, yy + 29, 11, '#f4f0d5');
  } else if (isNear) {
    const dx = x - player.x;
    const dz = z - player.z;
    const side = dx * Math.cos(player.yaw) + dz * Math.sin(player.yaw);
    const front = dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw);
    let xx = side >= 0 ? W - 32 : 32;
    let yy = H * 0.43;
    if (front > 0 && p) {
      xx = clamp(p.x, 32, W - 32);
      yy = clamp(p.y, top + 20, H - bottom);
    }
    ctx.save();
    ctx.translate(xx, yy);
    ctx.rotate(side >= 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillStyle = tint;
    ctx.strokeStyle = '#0c242b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 7);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    outlinedText(Math.round(distance) + 'm', xx, yy + 25, 10, '#f2d780');
  }
}

function drawObjectiveMarkers() {
  if (stage === 'relays') {
    let near = -1;
    let bestD = Infinity;
    for (let i = 0; i < relays.length; i++) {
      const r = relays[i];
      if (r.on) continue;
      const d = Math.hypot(r.x - player.x, r.z - player.z);
      if (d < bestD) {
        bestD = d;
        near = i;
      }
    }
    for (let i = 0; i < relays.length; i++) if (!relays[i].on) drawMarker(relays[i].x, relays[i].z, relays[i].label, i === near, 4.4);
  } else if (stage === 'boss') {
    if (boss && !boss.dead) drawMarker(boss.x, boss.z, 'FOREMAN RIME', true, 5.8);
  } else if (stage === 'vault') drawMarker(4, -54, 'THE VAULT', true, 3.5);
  else drawMarker(3, -59, 'EXIT', true, 4.5);
  // Side mission markers, in orange, never pointing off screen.
  if (bounty.state === 'none' && stage !== 'extract' && Math.hypot(BOUNTY_BOARD.x - player.x, BOUNTY_BOARD.z - player.z) < 30) drawMarker(BOUNTY_BOARD.x, BOUNTY_BOARD.z, 'BOUNTY', false, 4.2, '#ffb46b');
  if (bounty.state === 'active')
    for (const e of enemies) if (e.id === bounty.id && !e.dead) drawMarker(e.x, e.z, 'KNUCKLES BRINE', false, 4.2 * e.scale, '#ffb46b');
}

function drawFX() {
  ctx.setTransform(fxScale, 0, 0, fxScale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (mode === 'menu' || mode === 'won' || mode === 'dead') return;
  if (arcTime > 0) {
    ctx.fillStyle = 'rgba(97,217,240,' + arcTime * 0.13 + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(145,235,248,' + arcTime + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, (1 - arcTime / 0.6) * W * 0.8, 0, TAU);
    ctx.stroke();
  }
  if (levelFlash > 0) {
    ctx.fillStyle = 'rgba(248,197,68,' + levelFlash * 0.08 + ')';
    ctx.fillRect(0, 0, W, H);
  }
  for (const e of enemies) {
    if (e.dead || e.kind === 'boss') continue;
    const distance = Math.hypot(e.x - player.x, e.z - player.z);
    if (distance > 38 || !clearLine(player.x, player.y + cameraHeight, player.z, e.x, 2 * e.scale, e.z)) continue;
    const p = project(e.x, 2.67 * e.scale, e.z);
    if (!p || p.x < 0 || p.x > W || p.y < 0 || p.y > H) continue;
    const big = e.kind === 'badass';
    const w = clamp((big ? 150 : 110) - distance * 1.5, 50, big ? 140 : 100);
    ctx.fillStyle = '#132830cc';
    ctx.fillRect(p.x - w / 2 - 3, p.y - 10, w + 6, 24);
    ctx.fillStyle = e.stun > 0 ? '#81e3ed' : big ? '#f9a441' : '#eb795f';
    ctx.fillRect(p.x - w / 2, p.y + 5, w * clamp(e.hp / e.maxHp, 0, 1), 4);
    outlinedText(ENEMY[e.kind].label, p.x, p.y, big ? 10 : 9, big ? '#ffd051' : '#e9e7cb');
    if (e.windup > 0 || e.chargeWind > 0 || e.lobWind > 0 || (e.burst > 0 && e.shotCD > 0.1)) outlinedText('!', p.x, p.y - 20, 25, '#f4c44f');
  }
  drawObjectiveMarkers();
  for (const f of floaters) {
    const p = project(f.x, f.y, f.z);
    if (!p) continue;
    ctx.globalAlpha = clamp(f.life / 0.22, 0, 1);
    const x = p.x + f.ox;
    const y = p.y - (1 - f.life / f.max) * 25;
    outlinedText(f.text, x, y, f.crit ? 26 : 20, f.col, 'center', true);
    if (f.crit) outlinedText('CRITICAL!', x, y - 25, 11, '#ffd151', 'center', true);
    ctx.globalAlpha = 1;
  }
  if (hitMarker > 0) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.strokeStyle = hitCrit ? '#ffd34f' : '#fff7dc';
    ctx.lineWidth = hitCrit ? 3 : 2;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (0.25 + i * 0.5);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (muzzle > 0 && muzzleScreen.ok) {
    const w = weapons[weaponIndex];
    ctx.save();
    ctx.translate(muzzleScreen.x, muzzleScreen.y);
    const radius = w.type === 'shotgun' ? 48 : 32;
    ctx.rotate(t * 40);
    ctx.fillStyle = w.element === 'shock' ? '#aaf5ff' : '#ffd371';
    ctx.strokeStyle = '#182a29';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * TAU) / 16;
      const r = i % 2 ? radius * 0.23 : radius * (0.65 + (i % 3) * 0.17);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = '#fff9d9';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (banner.t > 0) {
    const a = clamp(Math.min((banner.max - banner.t) * 3, banner.t * 2), 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W * (1 - a) * 0.15, 0);
    ctx.transform(1, -0.035, -0.08, 1, 0, 0);
    const xx = W * 0.3;
    const yy = H * 0.67;
    ctx.fillStyle = '#0b222a';
    ctx.fillRect(xx - 16, yy - 72, W * 0.75, 143);
    ctx.fillStyle = '#f8c544';
    ctx.fillRect(xx - 10, yy - 81, W * 0.73, 133);
    outlinedText(banner.title, xx + 26, yy - 10, Math.min(68, W * 0.052), '#142b30', 'left', true);
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#142b30';
    ctx.textAlign = 'left';
    ctx.fillText(banner.sub, xx + 31, yy + 23);
    ctx.restore();
  }
  if (player.down) {
    ctx.fillStyle = 'rgba(84,21,18,.10)';
    ctx.fillRect(0, 0, W, H);
  }
  drawMinimap();
}

function drawMinimap() {
  mc.clearRect(0, 0, 272, 272);
  mc.fillStyle = '#132c32';
  mc.fillRect(0, 0, 272, 272);
  const scale = 3.1;
  const cx = 136;
  const cy = 146;
  mc.save();
  mc.translate(cx, cy);
  mc.rotate(-player.yaw);
  mc.translate(-player.x * scale, -player.z * scale);
  mc.strokeStyle = '#8ca99d1e';
  mc.lineWidth = 1;
  mc.beginPath();
  for (let x = -60; x < 60; x += 10) {
    mc.moveTo(x * scale, -70 * scale);
    mc.lineTo(x * scale, 60 * scale);
  }
  for (let z = -70; z < 60; z += 10) {
    mc.moveTo(-60 * scale, z * scale);
    mc.lineTo(60 * scale, z * scale);
  }
  mc.stroke();
  mc.strokeStyle = '#9ab2a555';
  for (const c of colliders) {
    mc.fillStyle = c.h > 3 ? '#70918b' : '#425f5f';
    mc.fillRect((c.x - c.w / 2) * scale, (c.z - c.d / 2) * scale, c.w * scale, c.d * scale);
    mc.strokeRect((c.x - c.w / 2) * scale, (c.z - c.d / 2) * scale, c.w * scale, c.d * scale);
  }
  for (const r of relays) {
    mc.fillStyle = r.on ? '#6ed7cf' : '#f8c544';
    mc.save();
    mc.translate(r.x * scale, r.z * scale);
    mc.rotate(Math.PI / 4);
    mc.fillRect(-5, -5, 10, 10);
    mc.restore();
  }
  if (bounty.state === 'none' && stage !== 'extract') {
    mc.fillStyle = '#ffb46b';
    mc.fillRect(BOUNTY_BOARD.x * scale - 4, BOUNTY_BOARD.z * scale - 4, 8, 8);
  }
  for (const e of enemies) {
    if (e.dead) continue;
    const far = Math.hypot(e.x - player.x, e.z - player.z) >= 40;
    if (far && !(e.kind === 'badass' && bounty.state === 'active')) continue;
    mc.fillStyle = e.kind === 'boss' || e.kind === 'badass' ? '#f9a441' : e.kind === 'lobber' ? '#7fd8ea' : '#eb715a';
    mc.beginPath();
    mc.arc(e.x * scale, e.z * scale, e.kind === 'boss' ? 7 : e.kind === 'badass' ? 6 : 4, 0, TAU);
    mc.fill();
  }
  for (const l of loot)
    if (!l.taken && l.gun) {
      mc.fillStyle = l.gun.color;
      mc.fillRect(l.x * scale - 2, l.z * scale - 2, 4, 4);
    }
  if (stage === 'vault' || stage === 'extract') {
    mc.fillStyle = '#f8c544';
    mc.fillRect((stage === 'vault' ? 4 : 3) * scale - 5, (stage === 'vault' ? -54 : -59) * scale - 5, 10, 10);
  }
  mc.restore();
  mc.fillStyle = '#eef1d7';
  mc.strokeStyle = '#132830';
  mc.lineWidth = 2;
  mc.beginPath();
  mc.moveTo(cx, cy - 10);
  mc.lineTo(cx + 7, cy + 7);
  mc.lineTo(cx, cy + 3);
  mc.lineTo(cx - 7, cy + 7);
  mc.closePath();
  mc.stroke();
  mc.fill();
  mc.fillStyle = '#d0dac5';
  mc.font = 'bold 16px Arial';
  mc.textAlign = 'center';
  mc.fillText('N', 136 + Math.sin(-player.yaw) * 110, 146 - Math.cos(player.yaw) * 110);
  mc.strokeStyle = '#a9bda044';
  mc.beginPath();
  mc.moveTo(136, 13);
  mc.lineTo(136, 24);
  mc.stroke();
  mc.fillStyle = '#b2c2ad';
  mc.font = '10px Arial';
  mc.textAlign = 'right';
  mc.fillText('30m', 254, 255);
}

// ------------------------------------------------------------------ start
refreshTitle();
syncTouch();
kit.loading.progress(0.9, 'Warming up the guns…');
await gfx.prewarm();

const STEP = 1 / 60;
let acc = 0;
kit.start((dt) => {
  visualTime += dt;
  const before = mode;
  globalInput(dt);
  if (mode === 'playing') {
    if (before === 'playing') playInput();
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      update(STEP);
      acc -= STEP;
      steps++;
      if (mode !== 'playing') break;
    }
    if (mode !== 'playing') acc = 0;
    else {
      findInteraction();
      updateHUD();
    }
  } else {
    acc = 0;
    if (hudDirty && mode === 'paused') updateHUD();
  }
  audio.tick(mode === 'playing', mode === 'playing' && inCombat());
  syncCamera(dt);
  syncScene();
  gfx.render(mode === 'playing' || mode === 'paused');
  drawFX();
});
