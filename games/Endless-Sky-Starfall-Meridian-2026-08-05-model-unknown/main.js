// Starfall Meridian — an original open-space RPG on the shared 3D kit.
// Flight, trade, the Meridian Run story, the job board and the Morrow Signal chain.

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import {
  SAVE_KEY,
  SYSTEMS,
  COMMODITIES,
  UPGRADES,
  ENEMY_TYPES,
  DANGER,
  DIFFICULTIES,
  RANKS,
  JOB_CARGO,
  NEWS,
  STORY_REWARD,
  systemById,
  hops,
  freshState,
  loadState,
  rng,
} from './data.js';
import { $, setText, setStyle, setClass, setHidden, setHTML, esc, fmt, keysFor, controlsHelp, createToast, createNav } from './ui.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const kit = await boot({
  title: 'Starfall Meridian',
  canvas: $('view'),
  gear: 'none', // the pause menu and title have a Settings button (and F9 still works)
  accent: '#82eff9',
  background: '#02050a',
  touch: { top: 'right', topOffset: 66 },
  input: {
    // Twin-stick flight on a pad or the touch stick: the ship turns toward the stick and thrusts.
    fly: { type: 'vector', gamepad: 'leftStick+dpad', touch: 'stick' },
    // The original keyboard piloting: W/S thrust, A/D turn (x and y independent).
    pilot: { type: 'vector', keys: 'wasd+arrows', gamepad: [], clamp: false },
    aim: { type: 'vector', gamepad: 'rightStick' },
    strafe: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] } },
    fire: { keys: ['KeyK'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Fire' },
    boost: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['A'], touch: 'Boost' },
    brake: { keys: ['Space'], gamepad: ['B', 'LT'], touch: 'Brake' },
    dock: { keys: ['KeyF'], gamepad: ['Y'], touch: 'Dock' },
    jump: { keys: ['KeyJ'], gamepad: ['LB'], touch: 'Jump' },
    zoomCycle: { gamepad: ['RS'] },
    map: { keys: ['KeyM'], gamepad: ['Back'], touch: { label: 'Map', slot: 'top' } },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    // Menus: arrows/WASD or the pad move focus, Enter/A confirm, Backspace/B go back.
    nav: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    tabPrev: { keys: ['KeyQ'], gamepad: ['LB'] },
    tabNext: { keys: ['KeyE'], gamepad: ['RB'] },
  },
});
const { input } = kit;

const W = createWorld(kit);
const ship = W.player;
const STATION = W.station.position;
const audio = createAudio();
const toastBox = createToast($('toast'), $('toast-text'));
const toast = (msg) => toastBox.show(msg);
const nav = createNav(input);

/* ================================================================ state */

let S = freshState();
let started = false;
let mode = 'title';
let pauseReturn = 'flight';
let mapReturn = 'flight';
let tab = 'port';
let confirmT = 0;

const readSave = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
let hasSave = !!readSave();

function save() {
  if (!started) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    hasSave = true;
  } catch {
    /* private mode or full storage: keep playing */
  }
}

const has = (id) => S.upgrades.includes(id);
const shieldMax = () => (has('shield') ? 125 : 100);
const hullMax = () => (has('hull') ? 130 : 100);
const diff = () => DIFFICULTIES[S.difficulty] ?? DIFFICULTIES[1];
const jumpSpeedCap = () => (has('capacitor') ? 30 : 18);
const jumpNeed = () => (has('capacitor') ? 1.0 : 1.65);
const comName = (id) => COMMODITIES.find((c) => c.id === id)?.name ?? id;

function cargoUsed() {
  let n = 0;
  for (const c of COMMODITIES) n += S.cargo[c.id];
  for (const j of S.jobs) if (j.type === 'courier') n += j.tons;
  return n;
}
const freeSpace = () => Math.max(0, S.cargoCap - cargoUsed());

/* ---- live market: big orders move the local price, which drifts back while you fly */
const factor = (sys, com) => S.market?.[sys]?.[com] ?? 1;
function bumpFactor(sys, com, mul) {
  if (!S.market[sys]) S.market[sys] = {};
  S.market[sys][com] = clamp(factor(sys, com) * mul, 0.7, 1.35);
}
function price(sysId, com) {
  let p = systemById(sysId).prices[com] * factor(sysId, com);
  if (S.news && S.news.system === sysId && S.news.com === com) p *= S.news.mult;
  return Math.max(1, Math.round(p));
}
const sellPrice = (sysId, com) => Math.round(price(sysId, com) * (S.allegiance === 'compact' ? 1.08 : 1));
const upgradePrice = (u) => Math.round((u.price * (S.allegiance === 'accord' ? 0.85 : 1)) / 10) * 10;

function rollNews() {
  if (Math.random() < 0.45) {
    const c = COMMODITIES[Math.floor(Math.random() * COMMODITIES.length)];
    const short = Math.random() < 0.5;
    S.news = { system: S.system, com: c.id, mult: short ? 1.3 : 0.75, text: short ? NEWS[c.id].short : NEWS[c.id].glut };
  } else {
    S.news = null;
  }
}

function rank() {
  const score =
    S.kills + S.jobsDone * 3 + (S.missionDelivered ? 10 : 0) + (S.bountyClaimed ? 10 : 0) + (S.morrow >= 2 ? 15 : 0) + (S.allegiance ? 20 : 0);
  let name = RANKS[0][1];
  for (const [min, label] of RANKS) if (score >= min) name = label;
  return name;
}

function flightTime() {
  const m = Math.floor(S.flightMinutes);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`;
}

function localTime() {
  const m = (22 * 60 + 17 + Math.floor(S.flightMinutes * 6)) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* ================================================================ simulation state */

const enemies = [];
const fBolts = [];
const hBolts = [];
const debris = [];
const cans = [];
const boltFree = [];
const debrisFree = [];

const vel = new THREE.Vector3();
let yaw = 0;
let prevYaw = 0;
let bank = 0;
let time = 0;
let shieldFlash = 0;
let invuln = 0;
let fireCd = 0;
let fireSide = 1;
let jumpCharge = 0;
let charging = false;
let jumping = false;
let jumpTimer = 0;
let spawnTimer = 5.5;
let shake = 0;
let zoom = 1;
let stationSpin = 0;
let alarmT = 0;
let autosaveT = 15;
let hudT = 0;
let perfT = 0;
let marketT = 1;
let fullToastT = 0;
let aimMode = 'mouse';
let lastPX = -1;
let lastPY = -1;
let crownSpawned = false;
let crown = null;
let nearest = null;
let nearestDist = 0;
let dockAvail = false;
let speed = 0;

const v1 = new THREE.Vector3();
const camBase = new THREE.Vector3(0, 62, 54);
const camLook = new THREE.Vector3();
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPt = new THREE.Vector3();
const tp = new THREE.Vector3();
const tan = new THREE.Vector3();
const des = new THREE.Vector3();
const DEBRIS_COLORS = [new THREE.Color(0x63edff), new THREE.Color(0xff6e54), new THREE.Color(0xffd18a)];

/* ================================================================ combat helpers */

function spawnBolt(list, x, y, z, dir, vx, vz, ttl, damage) {
  const b = boltFree.pop() || {};
  b.x = x;
  b.y = y;
  b.z = z;
  b.yaw = dir;
  b.vx = vx;
  b.vz = vz;
  b.ttl = ttl;
  b.damage = damage;
  list.push(b);
}

function removeAt(list, i, free) {
  const item = list[i];
  list[i] = list[list.length - 1];
  list.pop();
  free?.push(item);
}

/** The original hit/explosion burst: tumbling shards in the ship palette, plus the thump. */
function burst(x, y, z, n, enemyTint, sound = true) {
  const count = kit.detail(n, 4);
  for (let k = 0; k < count; k++) {
    const d = debrisFree.pop() || {};
    const dx = Math.random() - 0.5;
    const dy = (Math.random() - 0.5) * 0.35;
    const dz = Math.random() - 0.5;
    const len = Math.hypot(dx, dy, dz) || 1;
    const sp = 12 + Math.random() * 28;
    d.x = x;
    d.y = y;
    d.z = z;
    d.vx = (dx / len) * sp;
    d.vy = (dy / len) * sp;
    d.vz = (dz / len) * sp;
    d.rx = Math.random() * TAU;
    d.ry = Math.random() * TAU;
    d.ttl = 0.55 + Math.random() * 0.75;
    d.color = DEBRIS_COLORS[(k + (enemyTint ? 1 : 0)) % 3];
    debris.push(d);
  }
  while (debris.length > 400) removeAt(debris, 0, debrisFree);
  if (sound) audio.blip(enemyTint ? 88 : 55, 0.42, 0.09, 'square');
}

function spawnEnemy(type, x, z, escort = false) {
  const def = ENEMY_TYPES[type];
  const group = W.spawnShip(type);
  group.position.set(x, 0, z);
  const hp = (S.system === 'cinderwake' ? def.hpCinder : def.hp) * diff().hp;
  const e = {
    type,
    def,
    group,
    glows: group.userData.glows,
    vel: new THREE.Vector3(),
    hp,
    maxHp: hp,
    cooldown: 0.7 + Math.random() * 1.5,
    orbit: Math.random() > 0.5 ? 1 : -1,
    burst: 0,
    burstT: 0,
    punch: 0,
    yaw: 0,
    baseScale: group.scale.x,
    escort,
    stage: 0,
  };
  enemies.push(e);
  return e;
}

function spawnRaider(dist) {
  const lancerChance = DANGER[systemById(S.system).danger].lancer;
  const a = Math.random() * TAU;
  spawnEnemy(
    Math.random() < lancerChance ? 'lancer' : 'corsair',
    ship.position.x + Math.cos(a) * dist,
    ship.position.z + Math.sin(a) * dist
  );
}

function enemyCap() {
  const sys = systemById(S.system);
  let cap = DANGER[sys.danger].cap + diff().capDelta;
  if (S.allegiance === 'accord' && (sys.danger === 'LOW' || sys.danger === 'GUARDED')) cap -= 1;
  return Math.max(1, cap);
}

function maybeSpawnCrown() {
  if (crownSpawned || crown || S.system !== 'morrow' || S.morrow !== 1) return;
  crownSpawned = true;
  const a = Math.random() * TAU;
  crown = spawnEnemy('crown', STATION.x + Math.cos(a) * 240, STATION.z + Math.sin(a) * 240);
  toast('Distress static ahead · the Ember Crown is in the Drift');
}

function clearCombat() {
  for (const e of enemies) W.removeShip(e.group);
  enemies.length = 0;
  while (fBolts.length) boltFree.push(fBolts.pop());
  while (hBolts.length) boltFree.push(hBolts.pop());
  while (debris.length) debrisFree.push(debris.pop());
  cans.length = 0;
  crown = null;
  nearest = null;
}

function setupSystem(arrival) {
  clearCombat();
  const sys = systemById(S.system);
  W.setSystem(sys, SYSTEMS.indexOf(sys));
  ship.position.set(0, 0, arrival ? 72 : 24);
  yaw = 0;
  prevYaw = 0;
  bank = 0;
  ship.rotation.set(0, 0, 0);
  vel.set(0, 0, arrival ? -14 : 0);
  jumpCharge = 0;
  charging = false;
  jumping = false;
  invuln = 0;
  shieldFlash = 0;
  const n = Math.max(1, DANGER[sys.danger].initial + diff().capDelta);
  for (let i = 0; i < n; i++) spawnRaider(175 + i * 34);
  crownSpawned = false;
  maybeSpawnCrown();
  spawnTimer = 5.5;
}

function firePlayer() {
  if (fireCd > 0 || S.energy < 6 || S.heat > 92) return;
  const weap = has('weapons');
  fireCd = weap ? 0.118 : 0.17;
  S.energy -= 4.3;
  S.heat += weap ? 5.2 : 4.1;
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  // "Twin pulse": alternate between the two wing roots.
  fireSide = -fireSide;
  const off = fireSide * 1.1;
  const p = ship.position;
  spawnBolt(fBolts, p.x + sy * 6.1 + cy * off, p.y, p.z - cy * 6.1 + sy * off, yaw, vel.x + sy * 118, vel.z - cy * 118, 2.15, weap ? 1.45 : 1);
  audio.blip(520, 0.055, 0.024, 'sawtooth');
}

function enemyShot(e, offset) {
  const d = e.def;
  const a = e.yaw + offset;
  const sy = Math.sin(a);
  const cy = Math.cos(a);
  const nose = e.type === 'crown' ? 10 : 4.5;
  const g = e.group.position;
  const dmg = (d.damage[0] + Math.random() * d.damage[1]) * diff().damage;
  spawnBolt(hBolts, g.x + sy * nose, g.y, g.z - cy * nose, a, e.vel.x + sy * d.boltSpeed, e.vel.z - cy * d.boltSpeed, 2.7, dmg);
  audio.blip(e.type === 'crown' ? 120 : 185, 0.08, 0.018, 'sawtooth');
}

function enemyFire(e) {
  const d = e.def;
  if (d.burstGap) {
    enemyShot(e, 0);
    e.burst = d.shots - 1;
    e.burstT = d.burstGap;
  } else if (d.shots > 1) {
    const mid = (d.shots - 1) / 2;
    for (let k = 0; k < d.shots; k++) enemyShot(e, ((k - mid) / mid) * d.spread);
  } else {
    enemyShot(e, 0);
  }
}

function dropCanister(pos) {
  const com = COMMODITIES[Math.floor(Math.random() * COMMODITIES.length)].id;
  cans.push({
    x: pos.x,
    z: pos.z,
    vx: (Math.random() - 0.5) * 6,
    vz: (Math.random() - 0.5) * 6,
    rot: Math.random() * TAU,
    ttl: 30,
    com,
    qty: Math.random() < 0.4 ? 2 : 1,
  });
  if (cans.length > 20) cans.shift();
}

function killEnemy(e) {
  const i = enemies.indexOf(e);
  if (i < 0) return;
  enemies.splice(i, 1);
  const g = e.group.position;
  burst(g.x, g.y, g.z, 16, true);
  W.removeShip(e.group);
  if (nearest === e) nearest = null;
  S.kills += 1;
  if (e.type === 'crown') {
    crown = null;
    burst(g.x + 4, g.y, g.z - 3, 24, true, false);
    burst(g.x - 4, g.y, g.z + 3, 24, true, false);
    shake = 1;
    input.rumble(1, 420);
    if (S.morrow === 1) S.morrow = 2;
    toast('Ember Crown destroyed · report the kill at Coldwater Anchorage');
    save();
  } else {
    const pay = Math.round(e.def.bounty * (S.allegiance === 'compact' ? 1.5 : 1));
    S.credits += pay;
    toast(`${e.type === 'lancer' ? 'Lancer' : 'Corsair'} broken · salvage bounty +${fmt(pay)} cr`);
    input.rumble(0.45, 140);
    if (Math.random() < 0.45) dropCanister(g);
  }
  for (const j of S.jobs) {
    if (j.type === 'bounty' && j.target === S.system && j.progress < j.count) {
      j.progress += 1;
      if (j.progress >= j.count) toast(`Job done · ${jobTitle(j)} · paid at any port`);
    }
  }
}

function damageEnemy(e, dmg, x, y, z) {
  e.hp -= dmg;
  e.punch = 0.12;
  burst(x, y, z, e.type === 'crown' ? 8 : 16, true);
  if (e.hp <= 0) {
    killEnemy(e);
    return;
  }
  if (e.type === 'crown') {
    const frac = e.hp / e.maxHp;
    while (e.stage < 3 && frac <= 0.75 - e.stage * 0.25) {
      e.stage += 1;
      const a = Math.random() * TAU;
      spawnEnemy('lancer', e.group.position.x + Math.cos(a) * 18, e.group.position.z + Math.sin(a) * 18, true);
      toast('The Ember Crown calls her lancers');
    }
  }
}

function hitPlayer(amount) {
  let dmg = amount;
  shieldFlash = 0.34;
  if (S.shield > 0) {
    const a = Math.min(S.shield, dmg);
    S.shield -= a;
    dmg -= a;
  }
  if (dmg > 0) S.hull -= dmg;
  audio.blip(110, 0.18, 0.055, 'square');
  shake = Math.min(1, shake + (dmg > 0 ? 0.55 : 0.3));
  input.rumble(dmg > 0 ? 0.65 : 0.3, dmg > 0 ? 180 : 90);
  if (S.hull <= 0) tow();
}

function tow() {
  const p = ship.position;
  burst(p.x, p.y, p.z, 30, false);
  S.hull = hullMax();
  S.shield = shieldMax();
  S.credits = Math.max(0, S.credits - 1200);
  ship.position.set(0, 0, -95);
  vel.set(0, 0, 0);
  // Clear incoming fire and give the pilot a moment: no more spawn-kills after a tow.
  while (hBolts.length) boltFree.push(hBolts.pop());
  invuln = 3;
  shake = 1;
  input.rumble(1, 500);
  toast('Emergency tow engaged · recovery fee 1,200 cr');
  save();
}

function assistAim(dt) {
  const p = ship.position;
  let best = null;
  let bestDiff = 0.32;
  for (const e of enemies) {
    const dx = e.group.position.x - p.x;
    const dz = e.group.position.z - p.z;
    if (dx * dx + dz * dz > 150 * 150) continue;
    const d = wrap(Math.atan2(dx, -dz) - yaw);
    if (Math.abs(d) < Math.abs(bestDiff)) {
      bestDiff = d;
      best = e;
    }
  }
  if (best) yaw += clamp(bestDiff, -2.2 * dt, 2.2 * dt);
}

/* ================================================================ flight */

function startJump() {
  jumping = true;
  jumpTimer = 0.72;
  jumpCharge = 0;
  charging = false;
  $('jumpfx').classList.add('active');
  audio.blip(72, 0.85, 0.075, 'sawtooth');
  input.rumble(0.5, 450);
}

function arrive() {
  jumping = false;
  S.system = S.route;
  S.visits += 1;
  rollNews();
  setupSystem(true);
  $('jumpfx').classList.remove('active');
  save();
  toast(`Translation complete · ${systemById(S.system).name}`);
  if (S.news) toast(`Local news · ${S.news.text}`);
}

function updateFlight(dt) {
  const p = ship.position;
  const thr = has('thrusters');
  const pil = input.vector('pilot');
  const fly = input.vector('fly');
  const aim = input.vector('aim');
  const strafeIn = input.value('strafe');
  const flyLen = Math.hypot(fly.x, fly.y);
  const aimLen = Math.hypot(aim.x, aim.y);

  // Mouse aim follows the pointer once it moves; A/D steering takes over until it moves again.
  const ptr = input.pointer;
  if (ptr.type === 'mouse' && ptr.over && (ptr.x !== lastPX || ptr.y !== lastPY)) {
    lastPX = ptr.x;
    lastPY = ptr.y;
    aimMode = 'mouse';
  }

  const turnRate = thr ? 3.2 : 2.65;
  const seekRate = thr ? 7.2 : 5.8;
  let desired = null;
  if (Math.abs(pil.x) > 0.01) {
    yaw += pil.x * dt * turnRate;
    aimMode = 'keys';
  } else if (aimLen > 0.35) {
    desired = Math.atan2(aim.x, aim.y);
  } else if (flyLen > 0.2) {
    desired = Math.atan2(fly.x, fly.y);
  } else if (aimMode === 'mouse' && input.source === 'keyboard') {
    ndc.set(ptr.nx, ptr.ny);
    ray.setFromCamera(ndc, W.camera);
    if (ray.ray.intersectPlane(plane, hitPt)) {
      const fx = hitPt.x - p.x;
      const fz = hitPt.z - p.z;
      if (fx * fx + fz * fz > 25) desired = Math.atan2(fx, -fz);
    }
  }
  if (desired !== null) yaw += wrap(desired - yaw) * Math.min(1, dt * seekRate);
  if (input.source !== 'keyboard' && aimLen < 0.35 && input.down('fire')) assistAim(dt);
  yaw = wrap(yaw);

  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  // forward = (sy, -cy), right = (cy, sy)
  let fwd = pil.y > 0 ? pil.y : pil.y * 0.62;
  let lat = strafeIn;
  if (flyLen > 0.2) {
    const wx = fly.x;
    const wz = -fly.y;
    const f = wx * sy - wz * cy;
    const r = wx * cy + wz * sy;
    fwd += f > 0 ? f : f * 0.62;
    lat += r;
  }
  fwd = clamp(fwd, -0.62, 1);
  lat = clamp(lat, -1, 1);
  const boosting = input.down('boost') && S.energy > 4;
  const mul = boosting ? 1.62 : 1;
  const accel = thr ? 45 : 37;
  vel.x += (sy * fwd * accel * mul + cy * lat * accel * 0.62) * dt;
  vel.z += (-cy * fwd * accel * mul + sy * lat * accel * 0.62) * dt;
  vel.multiplyScalar(Math.pow(input.down('brake') ? 0.86 : 0.992, dt * 60));
  const vmax = (thr ? 61 : 52) * mul;
  speed = vel.length();
  // Past the cap (afterburn released) the ship sheds speed quickly instead of snapping.
  if (speed > vmax) vel.setLength(Math.max(vmax, speed - 60 * dt));
  p.addScaledVector(vel, dt);
  speed = vel.length();
  p.y = Math.sin(time * 3.5) * Math.min(0.45, speed * 0.008);

  // Bank into turns and strafes. The model faces -z, so its yaw is the negative heading
  // (the original rotated models the mirror way round from their flight direction).
  const yawRate = wrap(yaw - prevYaw) / Math.max(dt, 1e-4);
  prevYaw = yaw;
  const turnSig = clamp(yawRate / turnRate, -1, 1);
  bank += (-turnSig * 0.32 - lat * 0.18 - bank) * Math.min(1, dt * 6);
  ship.rotation.set(0, -yaw, bank);
  for (const g of W.playerGlows) g.scale.y = 0.65 + Math.max(0, fwd) * mul * (0.5 + Math.random() * 0.32);
  audio.engine(Math.max(0, fwd) * 0.8 + Math.min(1, speed / 60) * 0.3, boosting && fwd > 0);

  fireCd -= dt;
  if (input.down('fire') && S.heat < 96) firePlayer();
  if (boosting && fwd > 0) S.energy -= 14 * dt;
  S.energy = clamp(S.energy + (S.heat > 75 ? 7 : 13) * dt, 0, 100);
  S.heat = Math.max(0, S.heat - 17 * dt);
  S.shield = Math.min(shieldMax(), S.shield + (has('shield') ? 4.4 : 2.5) * dt);
  S.flightMinutes += dt / 60;

  /* ---- enemies */
  nearest = null;
  nearestDist = Infinity;
  let raiders = 0;
  const df = diff();
  for (const e of enemies) {
    const d = e.def;
    const g = e.group;
    tp.subVectors(p, g.position);
    tp.y = 0;
    const dist = tp.length() || 0.001;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = e;
    }
    if (e.type !== 'crown' && !e.escort) raiders++;
    const yawTo = Math.atan2(tp.x, -tp.z);
    e.yaw = yawTo;
    g.rotation.y = -yawTo;
    tan.set(-tp.z, 0, tp.x).multiplyScalar(e.orbit / dist);
    tp.multiplyScalar(1 / dist);
    const radial = dist > d.far ? d.approach : dist < d.near ? -d.retreat : d.drift;
    des.copy(tp).multiplyScalar(radial).addScaledVector(tan, dist < 150 ? d.orbit : 3);
    e.vel.lerp(des, Math.min(1, dt * d.agility));
    if (e.vel.length() > d.cap) e.vel.setLength(d.cap);
    g.position.addScaledVector(e.vel, dt);
    g.position.y = Math.sin(time * 2.2 + e.orbit) * 0.6;
    if (e.punch > 0) {
      e.punch -= dt;
      g.scale.setScalar(e.baseScale * (1 + Math.max(0, e.punch) * 0.9));
    } else if (g.scale.x !== e.baseScale) {
      g.scale.setScalar(e.baseScale);
    }
    for (const gl of e.glows) gl.scale.y = 0.7 + Math.random() * 0.35;
    e.cooldown -= dt;
    if (e.burst > 0) {
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burst -= 1;
        e.burstT = d.burstGap;
        enemyShot(e, 0);
      }
    }
    if (dist < d.range && e.cooldown <= 0) {
      enemyFire(e);
      e.cooldown = (d.cooldown[0] + Math.random() * d.cooldown[1]) * df.cooldown;
    }
  }

  /* ---- bolts */
  for (let i = fBolts.length - 1; i >= 0; i--) {
    const b = fBolts[i];
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.ttl -= dt;
    let hit = false;
    for (const e of enemies) {
      const dx = b.x - e.group.position.x;
      const dz = b.z - e.group.position.z;
      if (dx * dx + dz * dz < e.def.hitR2) {
        damageEnemy(e, b.damage, b.x, b.y, b.z);
        hit = true;
        break;
      }
    }
    if (hit || b.ttl <= 0) removeAt(fBolts, i, boltFree);
  }
  for (let i = hBolts.length - 1; i >= 0; i--) {
    const b = hBolts[i];
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.ttl -= dt;
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    let hit = false;
    if (dx * dx + dz * dz < 18) {
      hit = true;
      if (invuln > 0) {
        shieldFlash = Math.max(shieldFlash, 0.2);
      } else {
        hitPlayer(b.damage);
        if (!hBolts.length) break; // a tow cleared the list
      }
    }
    if ((hit || b.ttl <= 0) && i < hBolts.length) removeAt(hBolts, i, boltFree);
  }

  /* ---- debris */
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;
    d.rx += dt * 5;
    d.ry += dt * 7;
    d.ttl -= dt;
    if (d.ttl <= 0) removeAt(debris, i, debrisFree);
  }

  /* ---- salvage canisters: fly through them to scoop cargo */
  fullToastT -= dt;
  for (let i = cans.length - 1; i >= 0; i--) {
    const c = cans[i];
    const damp = Math.pow(0.985, dt * 60);
    c.vx *= damp;
    c.vz *= damp;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    c.rot += dt * 1.4;
    c.ttl -= dt;
    const dx = c.x - p.x;
    const dz = c.z - p.z;
    if (dx * dx + dz * dz < 30) {
      const take = Math.min(freeSpace(), c.qty);
      if (take > 0) {
        S.cargo[c.com] += take;
        S.salvage += take;
        c.qty -= take;
        toast(`Salvage recovered · ${take} T ${comName(c.com).toLowerCase()}`);
        audio.rise(420, 880, 0.25, 0.03);
      } else if (fullToastT <= 0) {
        fullToastT = 3;
        toast('Cargo hold is full · salvage left drifting');
      }
    }
    if (c.qty <= 0 || c.ttl <= 0) removeAt(cans, i);
  }

  /* ---- shields, alarms, spawns */
  if (invuln > 0) invuln -= dt;
  if (shieldFlash > 0) shieldFlash -= dt;
  const flash = Math.max(0, shieldFlash) * 0.72 + (invuln > 0 ? 0.16 + 0.12 * Math.sin(time * 14) : 0);
  W.bubble.material.opacity = flash;
  W.bubble.scale.setScalar(1 + Math.max(0, shieldFlash) * 0.65);
  W.bubble.visible = flash > 0.002;
  if (S.hull < 30) {
    alarmT -= dt;
    if (alarmT <= 0) {
      alarmT = 1.1;
      audio.blip(880, 0.12, 0.028, 'square');
    }
  }
  spawnTimer -= dt;
  if (raiders < enemyCap() && spawnTimer <= 0) {
    spawnRaider(210 + Math.random() * 90);
    spawnTimer = 5.5;
  }

  dockAvail = p.distanceTo(STATION) < 34 && speed < 13;

  /* ---- translation (hold to charge, below the speed cap) */
  const canJump = S.route !== S.system;
  const cap = jumpSpeedCap();
  if (input.pressed('jump') && !jumping) {
    if (!canJump) toast('No course plotted · open the map to choose a system');
    else if (speed >= cap) toast(`Brake below ${cap * 10} m/s to translate`);
  }
  if (!jumping && canJump && input.down('jump') && speed < cap) {
    if (!charging) {
      charging = true;
      audio.rise(70, 420, jumpNeed(), 0.03, 'sawtooth');
    }
    jumpCharge += dt;
  } else {
    charging = false;
    jumpCharge = Math.max(0, jumpCharge - dt * 1.8);
  }
  if (!jumping && jumpCharge >= jumpNeed()) startJump();
  if (jumping) {
    jumpTimer -= dt;
    if (jumpTimer <= 0) {
      arrive();
      return;
    }
  }

  /* ---- market prices drift back toward normal while you fly */
  marketT -= dt;
  if (marketT <= 0) {
    marketT = 1;
    const k = 1 - Math.exp(-1 / 240);
    for (const sid of Object.keys(S.market)) {
      const m = S.market[sid];
      for (const cid of Object.keys(m)) m[cid] += (1 - m[cid]) * k;
    }
  }

  /* ---- camera: smooth chase with a little lead, plus hit shake */
  const z = zoom;
  v1.set(p.x + vel.x * 0.18, 55 * z, p.z + 50 * z + vel.z * 0.18);
  camBase.lerp(v1, 1 - Math.pow(0.002, dt));
  W.camera.position.copy(camBase);
  camLook.set(p.x + vel.x * 0.18, 0, p.z - 18 + vel.z * 0.18);
  W.camera.lookAt(camLook);
  applyShake(dt);
}

function applyShake(dt) {
  if (shake <= 0.002) return;
  W.camera.position.x += (Math.random() - 0.5) * shake * 1.6;
  W.camera.position.y += (Math.random() - 0.5) * shake * 1.1;
  W.camera.position.z += (Math.random() - 0.5) * shake * 1.6;
  shake *= Math.exp(-dt * 5);
}

function updateTitle(dt) {
  ship.rotation.set(0, Math.sin(time * 0.25) * 0.35, 0);
  ship.position.set(Math.sin(time * 0.17) * 14, Math.sin(time * 0.4) * 1.5, 24);
  camBase.x += (Math.sin(time * 0.12) * 24 - camBase.x) * dt * 0.8;
  camBase.y += (48 - camBase.y) * dt;
  camBase.z += (66 - camBase.z) * dt;
  W.camera.position.copy(camBase);
  camLook.set(0, 0, -28);
  W.camera.lookAt(camLook);
  if (confirmT > 0) {
    confirmT -= dt;
    if (confirmT <= 0) setNewLabel(false);
  }
}

function updateHeld(dt) {
  const p = ship.position;
  v1.set(p.x, 54 * zoom, p.z + 49 * zoom);
  camBase.lerp(v1, Math.min(1, dt * 3));
  W.camera.position.copy(camBase);
  camLook.set(p.x, 0, p.z - 12);
  W.camera.lookAt(camLook);
  applyShake(dt);
}

/* ================================================================ drawing pools and markers */

function drawPools() {
  const { friendly, hostile, debris: dp, canisters } = W.pools;
  friendly.begin();
  for (const b of fBolts) friendly.push(b.x, b.y, b.z, 0, -b.yaw, 0, 0.8, 0.8, 4.8);
  friendly.end();
  hostile.begin();
  for (const b of hBolts) hostile.push(b.x, b.y, b.z, 0, -b.yaw, 0, 0.8, 0.8, 3.6);
  hostile.end();
  dp.begin();
  for (const d of debris) dp.push(d.x, d.y, d.z, d.rx, d.ry, 0, 1, 1, 1, Math.max(0, d.ttl * 1.5), d.color);
  dp.end();
  canisters.begin();
  for (const c of cans) {
    if (c.ttl < 5 && Math.floor(c.ttl * 6) % 2) continue; // blink before it drifts off
    canisters.push(c.x, 0.4, c.z, 0.5, c.rot, 0.25, 1, 1, 1);
  }
  canisters.end();
}

const markerRoot = $('markers');
function makeMarker(cls) {
  const el = document.createElement('div');
  el.className = `marker ${cls}`;
  el.innerHTML = '<i></i><b></b>';
  el.hidden = true;
  markerRoot.append(el);
  return { el, arrow: el.firstChild, label: el.lastChild, x: -1e4, y: -1e4, a: 99 };
}
const dockMarker = makeMarker('dock');
const hostileMarkers = Array.from({ length: 6 }, () => makeMarker('hostile'));

function hideMarkers() {
  setHidden(dockMarker.el, true);
  for (const m of hostileMarkers) setHidden(m.el, true);
}

function placeMarker(m, pos, text) {
  v1.copy(pos).project(W.camera);
  let x = v1.x;
  let y = v1.y;
  const behind = v1.z > 1;
  if (behind) {
    x = -x;
    y = -y;
  }
  if (!behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.9) {
    setHidden(m.el, true);
    return;
  }
  const w = kit.size.width;
  const h = kit.size.height;
  const cx = w / 2;
  const cy = h / 2;
  let dx = x * cx;
  let dy = -y * cy;
  if (!dx && !dy) dy = 1;
  const xmin = 22;
  const xmax = w - 22;
  const ymin = Math.min(cy - 10, 86);
  const ymax = Math.max(cy + 10, h - 120);
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (xmax - cx) / dx);
  else if (dx < 0) t = Math.min(t, (xmin - cx) / dx);
  if (dy > 0) t = Math.min(t, (ymax - cy) / dy);
  else if (dy < 0) t = Math.min(t, (ymin - cy) / dy);
  if (!Number.isFinite(t)) t = 1;
  const px = cx + dx * t;
  const py = cy + dy * t;
  const ang = Math.atan2(dy, dx);
  if (Math.abs(px - m.x) > 0.5 || Math.abs(py - m.y) > 0.5) {
    m.x = px;
    m.y = py;
    m.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  }
  if (Math.abs(ang - m.a) > 0.01) {
    m.a = ang;
    m.arrow.style.transform = `rotate(${ang.toFixed(3)}rad)`;
  }
  setText(m.label, text);
  setHidden(m.el, false);
}

function updateMarkers() {
  placeMarker(dockMarker, STATION, 'DOCK');
  let mi = 0;
  if (crown) {
    setClass(hostileMarkers[0].el, 'crown', true);
    placeMarker(hostileMarkers[0], crown.group.position, 'CROWN');
    mi = 1;
  }
  for (const e of enemies) {
    if (mi >= hostileMarkers.length) break;
    if (e === crown) continue;
    const m = hostileMarkers[mi++];
    setClass(m.el, 'crown', false);
    placeMarker(m, e.group.position, '');
  }
  for (; mi < hostileMarkers.length; mi++) setHidden(hostileMarkers[mi].el, true);
}

/* ================================================================ story */

function thread() {
  const k = keysFor(input.source);
  if (!S.missionDelivered) {
    let text;
    if (S.system === 'cinderwake') text = 'Dock at Ember Relay · deliver medicine';
    else if (S.route !== 'cinderwake') text = `Plot a course to Cinderwake · ${k.map} map`;
    else text = `Hold ${k.jump} to jump to Cinderwake`;
    return { num: '01', title: 'The Meridian Run', text, progress: S.system === 'cinderwake' ? 66 : 32, reward: '6,500 CR', risk: 'HIGH' };
  }
  if (!S.bountyClaimed) {
    return {
      num: '01',
      title: 'Break the Ember Screen',
      text: S.kills < 3 ? `Break the corsair screen · ${S.kills}/3` : 'Dock at any port · claim the bounty',
      progress: Math.min(100, (Math.min(3, S.kills) / 3) * 100),
      reward: '4,800 CR',
      risk: 'HIGH',
    };
  }
  if (S.morrow === 0) {
    return { num: '02', title: 'The Morrow Signal', text: 'Dock at any port · Mara Vex has new work', progress: 6, reward: '12,000 CR', risk: 'EXTREME' };
  }
  if (S.morrow === 1) {
    let text;
    let progress = 25;
    if (S.system === 'morrow') {
      if (crown) {
        const pct = Math.max(0, Math.round((crown.hp / crown.maxHp) * 100));
        text = `Destroy the Ember Crown · hull ${pct}%`;
        progress = 50 + (1 - pct / 100) * 40;
      } else {
        text = 'Hunt the Ember Crown in Morrow Drift';
        progress = 50;
      }
    } else if (S.route === 'morrow') text = `Hold ${k.jump} to jump to Morrow Drift`;
    else text = `Plot a course to Morrow Drift · ${k.map} map`;
    return { num: '02', title: 'The Morrow Signal', text, progress, reward: '12,000 CR', risk: 'EXTREME' };
  }
  if (S.morrow === 2) {
    return {
      num: '02',
      title: 'The Morrow Signal',
      text: S.system === 'morrow' ? 'Dock at Coldwater Anchorage · file the report' : 'Return to Morrow Drift · report at Coldwater',
      progress: 92,
      reward: '12,000 CR',
      risk: 'LOW',
    };
  }
  if (!S.allegiance) {
    return { num: '03', title: 'Who Owns Tomorrow', text: 'Dock at any port · choose who owns tomorrow', progress: 50, reward: 'CHARTER', risk: 'POLITICAL' };
  }
  return {
    num: '04',
    title: 'The Open Reach',
    text: 'Free captain · trade, hunt, and chart the Reach',
    progress: 100,
    reward: S.allegiance === 'accord' ? 'ACCORD' : 'COMPACT',
    risk: systemById(S.system).danger,
  };
}

function storyCard() {
  const sys = S.system;
  if (!S.missionDelivered) {
    return {
      badge: 'MV',
      eyebrow: 'MARA VEX // FREEPORT DISPATCH',
      quote: '“The corridor stays open because captains like you fly when the big carriers won’t.”',
      text: 'Cinderwake is short on field medicine. The Ember Corsairs know it, too. Make the delivery, keep your transponder clean, and no one will ask how much salvage you bring home.',
      buttons: sys === 'cinderwake' && S.cargo.medicine >= 4 ? [{ act: 'deliver', label: 'Transfer mission cargo · +6,500 CR' }] : [],
    };
  }
  if (!S.bountyClaimed) {
    return {
      badge: 'MV',
      eyebrow: 'MARA VEX // EMBER RELAY LINE',
      quote: '“Ember Relay breathes again. The Corsairs will want payment for the insult.”',
      text: 'Three interceptors are screening the Cinderwake lanes. Break them and the Relay’s security office pays out at any port in the Reach.',
      buttons: S.kills >= 3 ? [{ act: 'claimBounty', label: 'Claim corsair bounty · +4,800 CR' }] : [],
    };
  }
  if (S.morrow === 0) {
    return {
      badge: 'MV',
      eyebrow: 'MARA VEX // PRIORITY SIGNAL',
      quote: '“That was the screen. Now meet the fist behind it.”',
      text: 'Coldwater Anchorage caught a distress chorus out of Morrow Drift. The Corsairs run a flagship out there, the Ember Crown, and it has been eating convoys whole. Bring her down and the Free Captains pay twelve thousand.',
      buttons: [{ act: 'acceptMorrow', label: 'Accept · The Morrow Signal' }],
    };
  }
  if (S.morrow === 1) {
    return {
      badge: 'MV',
      eyebrow: 'MARA VEX // MORROW DRIFT',
      quote: '“Morrow Drift runs dark. Follow the static and you’ll find her.”',
      text: 'The Ember Crown fires a five-bolt fan and calls lancers when she bleeds. Keep moving, keep your shields fed, and never duel her head-on.',
      buttons: sys !== 'morrow' && S.route !== 'morrow' ? [{ act: 'plot', arg: 'morrow', label: 'Plot course · Morrow Drift' }] : [],
    };
  }
  if (S.morrow === 2) {
    return {
      badge: 'CW',
      eyebrow: 'COLDWATER ANCHORAGE // HARBOURMASTER',
      quote: '“We heard her go down from three systems away. Come tell it properly.”',
      text:
        sys === 'morrow'
          ? 'File the kill report and the Compact’s bounty clears on the spot.'
          : 'Coldwater Anchorage in Morrow Drift holds your twelve thousand. Fly there and file the report.',
      buttons:
        sys === 'morrow'
          ? [{ act: 'reportCrown', label: 'File the kill report · +12,000 CR' }]
          : S.route !== 'morrow'
            ? [{ act: 'plot', arg: 'morrow', label: 'Plot course · Morrow Drift' }]
            : [],
    };
  }
  if (!S.allegiance) {
    return {
      badge: 'MV',
      eyebrow: 'MARA VEX // THE LAST QUESTION',
      quote: '“The corridor is open. Everyone wants to own it, so you choose who does.”',
      text: 'The Accord Transit Authority offers a charter: patrols in the quiet lanes and cheaper refits at every outfitter. The Free Captains’ Compact offers a share: a dividend on every sale and bigger bounties on every raider. Either way, the Reach remembers.',
      buttons: [
        { act: 'choose', arg: 'accord', label: 'Sign the Accord charter' },
        { act: 'choose', arg: 'compact', label: 'Stand with the Compact' },
      ],
    };
  }
  const accord = S.allegiance === 'accord';
  return {
    badge: accord ? 'AT' : 'FC',
    eyebrow: accord ? 'ACCORD TRANSIT AUTHORITY // CHARTER' : 'FREE CAPTAINS’ COMPACT // SHAREHOLDER',
    quote: accord
      ? '“The Accord flag flies over Meridian Gate. The lanes are quieter, and some of that quiet is yours.”'
      : '“No flag but the captains’. The Reach stays wild, and it stays free.”',
    text: 'Job boards refresh every time you arrive in a system. Trade the gaps, take contracts, and chart the Reach your way.',
    buttons: [{ act: 'ending', label: 'Review the epilogue' }],
  };
}

/* ================================================================ job board */

function jobTitle(j) {
  return j.type === 'courier' ? `Sealed freight · ${systemById(j.dest).station}` : `Corsair sweep · ${systemById(j.target).name}`;
}

function jobText(j) {
  if (j.type === 'courier') {
    const d = systemById(j.dest);
    return `${j.tons} T of sealed ${j.cargo} for the ${d.faction}. Deliver to ${d.station} in ${d.name}.`;
  }
  return `Destroy ${j.count} Ember raiders in ${systemById(j.target).name}, then claim the pay at any port.`;
}

function refreshBoard() {
  if (S.board && S.board.system === S.system && S.board.visit === S.visits) return;
  const idx = SYSTEMS.findIndex((s) => s.id === S.system);
  const r = rng((idx + 1) * 7919 + S.visits * 104729 + 17);
  const offers = [];
  for (let i = 0; i < 3; i++) {
    const id = `${S.system}-${S.visits}-${i}`;
    if (r() < 0.55) {
      const others = SYSTEMS.filter((s) => s.id !== S.system);
      const dest = others[Math.floor(r() * others.length)];
      const tons = 2 + Math.floor(r() * 5);
      const h = hops(S.system, dest.id);
      const reward = Math.round(((900 + tons * 260) * (0.6 + h * 0.5) * DANGER[dest.danger].pay) / 10) * 10;
      offers.push({ id, type: 'courier', dest: dest.id, tons, reward, cargo: JOB_CARGO[Math.floor(r() * JOB_CARGO.length)] });
    } else {
      const target = SYSTEMS[Math.floor(r() * SYSTEMS.length)];
      const count = 2 + Math.floor(r() * 3);
      const reward = Math.round((count * 650 * DANGER[target.danger].pay * (target.id === S.system ? 1 : 1.2)) / 10) * 10;
      offers.push({ id, type: 'bounty', target: target.id, count, progress: 0, reward });
    }
  }
  S.board = { system: S.system, visit: S.visits, offers };
}

function settleJobs() {
  let paid = 0;
  let done = 0;
  S.jobs = S.jobs.filter((j) => {
    const ok = j.type === 'courier' ? j.dest === S.system : j.progress >= j.count;
    if (ok) {
      paid += j.reward;
      done += 1;
    }
    return !ok;
  });
  if (done) {
    S.credits += paid;
    S.jobsDone += done;
    toast(`${done} job${done > 1 ? 's' : ''} complete · ${fmt(paid)} cr transferred`);
    audio.blip(740, 0.42, 0.055, 'sine');
  }
}

const boardOffers = () => (S.board && S.board.system === S.system && Array.isArray(S.board.offers) ? S.board.offers : []);

function acceptJob(id) {
  const offers = boardOffers();
  const o = offers.find((x) => x.id === id);
  if (!o) return;
  if (S.jobs.length >= 3) {
    toast('Job slots full · finish or abandon one');
    return;
  }
  if (o.type === 'courier' && freeSpace() < o.tons) {
    toast('Not enough free cargo space');
    return;
  }
  offers.splice(offers.indexOf(o), 1);
  S.jobs.push({ ...o, progress: 0 });
  audio.blip(560, 0.2, 0.04, 'sine');
  toast(`Job accepted · ${jobTitle(o)}`);
  save();
  renderStation();
  updateHud();
}

function abandonJob(id) {
  const i = S.jobs.findIndex((j) => j.id === id);
  if (i < 0) return;
  const [j] = S.jobs.splice(i, 1);
  toast(`Job abandoned · ${jobTitle(j)}`);
  save();
  renderStation();
  updateHud();
}

/* ================================================================ actions */

function tryDock() {
  if (mode !== 'flight' || jumping) return;
  const d = ship.position.distanceTo(STATION);
  if (d > 34 || speed > 13) {
    toast(d > 34 ? 'Move within the docking corridor' : 'Reduce velocity below 130 m/s');
    return;
  }
  vel.set(0, 0, 0);
  S.shield = shieldMax();
  S.hull = hullMax();
  jumpCharge = 0;
  charging = false;
  tab = 'port';
  refreshBoard();
  settleJobs();
  audio.blip(260, 0.34, 0.045, 'sine');
  toast(`Docking clamps secure · ${systemById(S.system).station}`);
  save();
  setMode('station');
}

function launch() {
  ship.position.copy(STATION).add(v1.set(0, 0, 44));
  yaw = 0;
  prevYaw = 0;
  bank = 0;
  vel.set(0, 0, 9);
  maybeSpawnCrown();
  setMode('flight');
  toast('Clamps clear · safe flight');
}

function trade(id, dir, n) {
  const sys = S.system;
  let done = 0;
  let total = 0;
  let reason = null;
  for (let k = 0; k < n; k++) {
    if (dir === 'buy') {
      const p = price(sys, id);
      if (cargoUsed() >= S.cargoCap) {
        reason = 'Cargo hold is full';
        break;
      }
      if (S.credits < p) {
        reason = 'Insufficient credits';
        break;
      }
      S.credits -= p;
      S.cargo[id] += 1;
      bumpFactor(sys, id, 1.006);
      total += p;
    } else {
      const p = sellPrice(sys, id);
      if (S.cargo[id] <= 0) {
        reason = 'No units in cargo';
        break;
      }
      if (id === 'medicine' && !S.missionDelivered && S.cargo.medicine <= 4) {
        reason = 'Four crates are sealed mission cargo';
        break;
      }
      S.credits += p;
      S.cargo[id] -= 1;
      bumpFactor(sys, id, 0.994);
      total += p;
    }
    done += 1;
  }
  if (done) {
    audio.blip(dir === 'buy' ? 420 : 310, 0.08, 0.025, 'sine');
    if (n > 1) toast(`${dir === 'buy' ? 'Bought' : 'Sold'} ${done} T ${comName(id).toLowerCase()} · ${fmt(total)} cr`);
    save();
  } else if (reason) {
    toast(reason);
  }
  renderStation();
  updateHud();
}

function buyUpgrade(id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || has(id)) return;
  const cost = upgradePrice(u);
  if (S.credits < cost) {
    toast('Insufficient credits');
    return;
  }
  S.credits -= cost;
  S.upgrades.push(id);
  if (id === 'cargo') S.cargoCap += 12;
  if (id === 'shield') S.shield = 125;
  if (id === 'hull') S.hull = hullMax();
  save();
  audio.blip(620, 0.28, 0.045, 'sine');
  toast(`${u.name} installed`);
  renderStation();
  updateHud();
}

function deliver() {
  if (S.system !== 'cinderwake' || S.missionDelivered || S.cargo.medicine < 4) return;
  S.cargo.medicine -= 4;
  S.missionDelivered = true;
  S.credits += STORY_REWARD.run;
  save();
  audio.blip(740, 0.42, 0.055, 'sine');
  toast('Meridian Run complete · 6,500 cr transferred');
  renderStation();
  updateHud();
}

function claimBounty() {
  if (S.kills < 3 || S.bountyClaimed) return;
  S.bountyClaimed = true;
  S.credits += STORY_REWARD.screen;
  save();
  audio.blip(810, 0.42, 0.055, 'sine');
  toast('Corsair bounty cleared · 4,800 cr transferred');
  renderStation();
  updateHud();
}

function acceptMorrow() {
  if (!S.bountyClaimed || S.morrow !== 0) return;
  S.morrow = 1;
  if (S.system !== 'morrow') S.route = 'morrow';
  save();
  audio.rise(300, 600, 0.35, 0.04);
  toast(S.system === 'morrow' ? 'The Morrow Signal accepted · hunt the Crown' : 'The Morrow Signal accepted · course plotted to Morrow Drift');
  renderStation();
  updateHud();
}

function reportCrown() {
  if (S.morrow !== 2 || S.system !== 'morrow') return;
  S.morrow = 3;
  S.credits += STORY_REWARD.morrow;
  save();
  audio.blip(810, 0.5, 0.06, 'sine');
  toast('Kill report filed · 12,000 cr transferred');
  renderStation();
  updateHud();
}

function chooseAllegiance(side) {
  if (S.morrow !== 3 || S.allegiance || (side !== 'accord' && side !== 'compact')) return;
  S.allegiance = side;
  save();
  audio.rise(260, 780, 0.6, 0.045);
  input.rumble(0.4, 200);
  setMode('ending');
}

function plotRoute(id) {
  if (id === S.system) {
    toast('You are already in this system');
    return;
  }
  S.route = id;
  save();
  toast(`Course plotted · ${systemById(id).name}`);
  if (mode === 'map') renderMap();
  if (mode === 'station') renderStation();
  updateHud();
}

function toggleSound() {
  S.sound = !S.sound;
  audio.setEnabled(S.sound);
  if (S.sound) audio.unlock();
  save();
  renderPause();
}

function cycleDifficulty() {
  S.difficulty = (S.difficulty + 1) % DIFFICULTIES.length;
  save();
  renderPause();
  toast(`Difficulty · ${diff().name}`);
}

function setNewLabel(confirming) {
  setText($('btn-new-label'), confirming ? 'Overwrite saved captain?' : 'Begin the Meridian Run');
  setText($('btn-new-sub'), confirming ? 'Press again' : 'New captain');
  setClass($('btn-new'), 'confirming', confirming);
}

function newGame() {
  if (hasSave && confirmT <= 0) {
    confirmT = 4;
    setNewLabel(true);
    return;
  }
  confirmT = 0;
  setNewLabel(false);
  begin(true);
}

function begin(fresh) {
  audio.unlock();
  const raw = fresh ? null : readSave();
  S = raw ? loadState(raw) : freshState();
  started = true;
  audio.setEnabled(S.sound);
  S.shield = Math.min(S.shield, shieldMax());
  S.hull = clamp(S.hull, 1, hullMax());
  zoom = 1;
  shake = 0;
  setupSystem(false);
  setMode('flight');
  save();
  toast('Meridian control released · fly free, captain');
}

function returnToTitle() {
  setMode('title');
  save();
}

function openPause(from) {
  pauseReturn = from;
  setMode('pause');
}

function openMap(from) {
  mapReturn = from === 'pause' ? pauseReturn : from;
  setMode('map');
}

function switchTab(dir) {
  const tabs = ['port', 'market', 'outfitter', 'contracts'];
  tab = tabs[(tabs.indexOf(tab) + dir + tabs.length) % tabs.length];
  renderStation();
  if (input.source === 'gamepad') nav.focusEl($('s-tabs').querySelector(`[data-arg="${tab}"]`));
}

const ACTIONS = {
  newGame,
  continue: () => begin(false),
  settings: () => kit.menu.open(),
  pause: () => {
    if (mode === 'flight' || mode === 'station') openPause(mode);
  },
  map: () => {
    if (mode === 'flight' || mode === 'station' || mode === 'pause') openMap(mode);
  },
  closeMap: () => setMode(mapReturn),
  resume: () => setMode(pauseReturn),
  launch,
  dock: tryDock,
  tab: (arg) => {
    tab = arg;
    renderStation();
  },
  buy: (id) => trade(id, 'buy', 1),
  buyMax: (id) => trade(id, 'buy', 999),
  sell: (id) => trade(id, 'sell', 1),
  sellAll: (id) => trade(id, 'sell', 999),
  upgrade: buyUpgrade,
  deliver,
  claimBounty,
  acceptMorrow,
  reportCrown,
  choose: chooseAllegiance,
  ending: () => setMode('ending'),
  closeEnding: () => setMode('station'),
  accept: acceptJob,
  abandon: abandonJob,
  plot: plotRoute,
  sound: toggleSound,
  difficulty: cycleDifficulty,
  title: returnToTitle,
};

$('shell').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = ACTIONS[b.dataset.act];
  if (fn) fn(b.dataset.arg);
});

/* ================================================================ screens */

const screens = { title: $('title'), station: $('station'), map: $('map'), pause: $('pause'), ending: $('ending') };

function setMode(next) {
  // Leaving flight mid-translation (pause, tab switch, title) finishes the jump first,
  // so the white tunnel never hangs over a menu.
  if (jumping && next !== 'flight') arrive();
  mode = next;
  for (const [k, el] of Object.entries(screens)) setHidden(el, k !== next);
  setHidden($('hud'), next === 'title');
  setHidden($('reticle'), next !== 'flight');
  setHidden($('prompts'), next !== 'flight');
  kit.touch?.suspend(next !== 'flight', 'game');
  input.settle();
  nav.reset();
  if (next !== 'flight') {
    hideMarkers();
    audio.engine(0);
  }
  audio.pause(kit.paused || next === 'pause' || document.hidden);
  if (next === 'title') renderTitle();
  if (next === 'station') renderStation();
  if (next === 'map') renderMap();
  if (next === 'pause') renderPause();
  if (next === 'ending') renderEnding();
  updateHud();
  const root = screens[next];
  const active = document.activeElement;
  if (root && input.source === 'gamepad') nav.focusDefault(root);
  else if (active && active !== document.body && !(root && root.contains(active))) active.blur?.();
}

function renderTitle() {
  setHidden($('btn-continue'), !hasSave);
  if (hasSave) {
    $('btn-continue').setAttribute('data-default', '');
    $('btn-new').removeAttribute('data-default');
  } else {
    $('btn-new').setAttribute('data-default', '');
    $('btn-continue').removeAttribute('data-default');
  }
  confirmT = 0;
  setNewLabel(false);
  const s = input.source;
  setText(
    $('title-hint'),
    s === 'gamepad'
      ? 'LS fly · RS aim · RT fire · A afterburn · Y dock'
      : s === 'touch'
        ? 'Stick to fly · FIRE to shoot · DOCK near ports'
        : 'WASD pilot · mouse aim · click to fire · F dock · J jump'
  );
}

function storyButtons(list) {
  return list
    .map(
      (b) =>
        `<button type="button" class="button-primary compact" data-act="${b.act}"${b.arg ? ` data-arg="${b.arg}"` : ''} data-key="${b.act}:${b.arg || ''}">${esc(b.label)}</button>`
    )
    .join('');
}

function portHTML(sys) {
  const c = storyCard();
  const buttons = storyButtons(c.buttons);
  return `<div class="port-layout">
<article class="narrative-card">
<div class="portrait-badge">${esc(c.badge)}</div>
<span class="eyebrow">${esc(c.eyebrow)}</span>
<h3>${esc(c.quote)}</h3>
<p>${esc(c.text)}</p>
${buttons ? `<div class="story-actions">${buttons}</div>` : ''}
</article>
<div class="station-summary">
<div><span>Security</span><b class="${sys.danger === 'HIGH' ? 'danger' : ''}">${sys.danger}</b></div>
<div><span>Hull service</span><b>COMPLETE</b></div>
<div><span>Cargo</span><b>${cargoUsed()}/${S.cargoCap} T</b></div>
<div><span>Local time</span><b>${localTime()}</b></div>
<div><span>Captain rank</span><b>${esc(rank())}</b></div>
</div>
</div>`;
}

function marketHTML(sys) {
  const news = S.news && S.news.system === S.system ? S.news : null;
  const head = news
    ? `<div class="market-news"><b>LOCAL NEWS</b><span>${esc(news.text)} · ${esc(comName(news.com))} ${news.mult > 1 ? '▲' : '▼'} ${Math.round(Math.abs(news.mult - 1) * 100)}%</span></div>`
    : '<div class="market-news calm"><b>MARKETS STEADY</b><span>Big orders move the local price; it drifts back while you fly.</span></div>';
  const compact = S.allegiance === 'compact';
  const rows = COMMODITIES.map((c) => {
    const p = price(S.system, c.id);
    const ratio = p / sys.prices[c.id];
    const trend = ratio > 1.04 ? '<i class="trend up">▲</i>' : ratio < 0.96 ? '<i class="trend down">▼</i>' : '';
    return `<div class="market-row">
<div><b>${esc(c.name)}</b><small>${esc(c.note)}</small></div>
<span>${S.cargo[c.id]} T</span>
<strong>${fmt(p)} CR${trend}</strong>
<div class="order-buttons">
<button type="button" data-act="sell" data-arg="${c.id}" data-key="sell:${c.id}">Sell${compact ? ` ${fmt(sellPrice(S.system, c.id))}` : ''}</button>
<button type="button" class="minor" data-act="sellAll" data-arg="${c.id}" data-key="sellAll:${c.id}">All</button>
<button type="button" data-act="buy" data-arg="${c.id}" data-key="buy:${c.id}">Buy</button>
<button type="button" class="minor" data-act="buyMax" data-arg="${c.id}" data-key="buyMax:${c.id}">Max</button>
</div>
</div>`;
  }).join('');
  return `${head}<div class="market-table">
<div class="table-head"><span>Commodity</span><span>Hold</span><span>Local price</span><span>Order</span></div>
${rows}
</div>
<p class="market-foot">Hold ${cargoUsed()}/${S.cargoCap} T · ${fmt(S.credits)} CR liquid${compact ? ' · Compact dividend: +8% on every sale' : ''}</p>`;
}

function outfitterHTML() {
  const cards = UPGRADES.map((u) => {
    const owned = has(u.id);
    const glyph = u.id === 'capacitor' ? 'TC' : u.id.slice(0, 2).toUpperCase();
    return `<article class="${owned ? 'owned' : ''}">
<span class="module-glyph">${glyph}</span>
<small>${owned ? 'INSTALLED' : 'ORIOLE-7 COMPATIBLE'}</small>
<h3>${esc(u.name)}</h3>
<p>${esc(u.description)}</p>
<button type="button" data-act="upgrade" data-arg="${u.id}" data-key="upgrade:${u.id}"${owned ? ' disabled' : ''}>${owned ? 'Installed' : `${fmt(upgradePrice(u))} CR`}</button>
</article>`;
  }).join('');
  return `<div class="upgrade-grid">${cards}</div>${S.allegiance === 'accord' ? '<p class="market-foot">Accord charter: 15% off every refit.</p>' : ''}`;
}

function storyContract({ cls, kind, status, title, text, reward, buttons }) {
  const btns = (buttons || [])
    .map((b) => `<button type="button" data-act="${b.act}"${b.arg ? ` data-arg="${b.arg}"` : ''} data-key="c:${b.act}:${b.arg || ''}">${esc(b.label)}</button>`)
    .join('');
  return `<article class="${cls}">
<div><span>${kind}</span><b>${status}</b></div>
<h3>${esc(title)}</h3>
<p>${esc(text)}</p>
<strong>${reward}</strong>
${btns ? `<div class="job-actions">${btns}</div>` : ''}
</article>`;
}

function jobCard(j, active) {
  let status;
  if (active) status = j.type === 'courier' ? `${j.tons} T IN HOLD` : `${Math.min(j.progress, j.count)}/${j.count}`;
  else if (j.type === 'courier') {
    const h = hops(S.system, j.dest);
    status = `${j.tons} T · ${h} LANE${h > 1 ? 'S' : ''}`;
  } else status = `${systemById(j.target).danger} RISK`;
  const btn = active
    ? `<button type="button" class="ghost" data-act="abandon" data-arg="${j.id}" data-key="abandon:${j.id}">Abandon</button>`
    : `<button type="button" data-act="accept" data-arg="${j.id}" data-key="accept:${j.id}">Accept</button>`;
  return `<article class="${active ? 'active' : ''}">
<div><span>${j.type === 'courier' ? 'COURIER' : 'BOUNTY'}</span><b>${status}</b></div>
<h3>${esc(jobTitle(j))}</h3>
<p>${esc(jobText(j))}</p>
<strong>${fmt(j.reward)} CR</strong>
<div class="job-actions">${btn}</div>
</article>`;
}

function contractsHTML(sys) {
  const story = [
    storyContract({
      cls: S.missionDelivered ? 'complete' : '',
      kind: 'PRIORITY COURIER',
      status: S.missionDelivered ? 'COMPLETE' : 'ACTIVE',
      title: 'The Meridian Run',
      text: 'Deliver four sealed medical crates to Ember Relay in Cinderwake.',
      reward: '6,500 CR',
      buttons: !S.missionDelivered && S.system === 'cinderwake' && S.cargo.medicine >= 4 ? [{ act: 'deliver', label: 'Complete delivery' }] : [],
    }),
    storyContract({
      cls: S.bountyClaimed ? 'complete' : '',
      kind: 'SECURITY BOUNTY',
      status: S.bountyClaimed ? 'PAID' : `${Math.min(S.kills, 3)}/3`,
      title: 'Break the Ember Screen',
      text: 'Neutralize three Corsair interceptors anywhere in the Cinderwake volume.',
      reward: '4,800 CR',
      buttons: S.kills >= 3 && !S.bountyClaimed ? [{ act: 'claimBounty', label: 'Claim bounty' }] : [],
    }),
  ];
  if (S.bountyClaimed) {
    story.push(
      storyContract({
        cls: S.morrow >= 3 ? 'complete' : S.morrow >= 1 ? 'active' : '',
        kind: 'FLAGSHIP HUNT',
        status: ['OFFERED', 'ACTIVE', 'REPORT', 'COMPLETE'][S.morrow],
        title: 'The Morrow Signal',
        text: 'Hunt the Corsair flagship Ember Crown in Morrow Drift, then report the kill at Coldwater Anchorage.',
        reward: '12,000 CR',
        buttons:
          S.morrow === 0
            ? [{ act: 'acceptMorrow', label: 'Accept contract' }]
            : S.morrow === 2 && S.system === 'morrow'
              ? [{ act: 'reportCrown', label: 'File kill report' }]
              : [],
      })
    );
  }
  if (S.morrow >= 3) {
    story.push(
      storyContract({
        cls: S.allegiance ? 'complete' : 'active',
        kind: 'CORRIDOR CHARTER',
        status: S.allegiance ? S.allegiance.toUpperCase() : 'OPEN',
        title: 'Who Owns Tomorrow',
        text: S.allegiance
          ? S.allegiance === 'accord'
            ? 'Signed with the Accord Transit Authority: 15% off refits and quieter guarded lanes.'
            : 'Standing with the Free Captains’ Compact: +8% on every sale and 50% bigger raider bounties.'
          : 'Sign with the Accord Transit Authority or stand with the Free Captains’ Compact. The choice shapes every market and outfitter in the Reach.',
        reward: 'CHARTER',
        buttons: S.allegiance
          ? [{ act: 'ending', label: 'Review the epilogue' }]
          : [
              { act: 'choose', arg: 'accord', label: 'Sign the Accord charter' },
              { act: 'choose', arg: 'compact', label: 'Stand with the Compact' },
            ],
      })
    );
  }
  const jobs = S.jobs.map((j) => jobCard(j, true)).join('');
  const offers = boardOffers()
    .map((o) => jobCard(o, false))
    .join('');
  return `<div class="contract-list">${story.join('')}</div>
<div class="board-title">Active jobs <span>${S.jobs.length}/3</span></div>
${jobs ? `<div class="contract-list jobs">${jobs}</div>` : '<div class="board-empty">No active jobs. Take work from the board below; pay lands when you dock.</div>'}
<div class="board-title">Job board · ${esc(sys.station)} <span>Fresh work on every arrival</span></div>
${offers ? `<div class="contract-list jobs">${offers}</div>` : '<div class="board-empty">Board cleared. Jump to another system for fresh work.</div>'}`;
}

function renderStation() {
  if (mode !== 'station') return;
  const sys = systemById(S.system);
  setText($('s-eyebrow'), `DOCKED // ${sys.name}`);
  setText($('s-name'), sys.station);
  setText($('s-faction'), sys.faction);
  setText($('k-launch'), keysFor(input.source).dock);
  for (const b of $('s-tabs').children) setClass(b, 'active', b.dataset.arg === tab);
  const html =
    tab === 'market' ? marketHTML(sys) : tab === 'outfitter' ? outfitterHTML() : tab === 'contracts' ? contractsHTML(sys) : portHTML(sys);
  const content = $('s-content');
  const active = document.activeElement;
  const key = active && content.contains(active) ? active.dataset.key : null;
  const marked = !!active?.classList?.contains('nav-focus');
  setHTML(content, html);
  // Re-rendering replaces the buttons: put focus back where the player was.
  if (key && !content.contains(active)) {
    const el = content.querySelector(`[data-key="${key}"]:not([disabled])`);
    if (el) nav.focusEl(el, marked);
    else if (marked) nav.focusDefault(screens.station);
  }
}

const mapNodes = {};
function buildMap() {
  const sector = $('m-sector');
  const legend = sector.querySelector('.map-legend');
  for (const s of SYSTEMS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'star-node';
    b.dataset.act = 'plot';
    b.dataset.arg = s.id;
    b.dataset.key = `plot:${s.id}`;
    b.style.left = `${s.mapX}%`;
    b.style.top = `${s.mapY}%`;
    b.innerHTML = `<i style="background:#${s.tint.toString(16).padStart(6, '0')}"></i><span><b>${esc(s.name)}</b><small>${esc(s.faction)}</small><em class="node-tags"></em></span>`;
    sector.insertBefore(b, legend);
    mapNodes[s.id] = { el: b, tags: b.querySelector('.node-tags') };
  }
}

function renderMap() {
  for (const s of SYSTEMS) {
    const n = mapNodes[s.id];
    setClass(n.el, 'current', s.id === S.system);
    setClass(n.el, 'routed', s.id === S.route);
    setClass(n.el, 'risk', s.danger === 'HIGH' || s.danger === 'UNKNOWN');
    const tags = [];
    if (s.id === 'morrow' && S.morrow === 1) tags.push('CROWN');
    if (s.id === 'morrow' && S.morrow === 2) tags.push('REPORT');
    let jobs = 0;
    for (const j of S.jobs) if ((j.type === 'courier' ? j.dest : j.target) === s.id) jobs++;
    if (jobs) tags.push(`${jobs} JOB${jobs > 1 ? 'S' : ''}`);
    if (!S.missionDelivered && s.id === 'cinderwake') tags.push('MERIDIAN RUN');
    setText(n.tags, tags.join(' · '));
  }
  const routed = S.route !== S.system;
  const route = systemById(S.route);
  setText($('m-target'), routed ? route.name : 'Select another system');
  let best = -Infinity;
  for (const c of COMMODITIES) best = Math.max(best, sellPrice(S.route, c.id) - price(S.system, c.id));
  setText($('m-profit'), routed ? `+${fmt(best)} CR/T` : '—');
  const back = mapReturn === 'station' ? 'Return to station' : 'Return to flight';
  setText($('m-back'), back);
  setText($('m-fly'), mapReturn === 'station' ? 'Return to station' : 'Fly plotted course');
  setText($('k-mapclose'), keysFor(input.source).map);
}

function renderPause() {
  if (mode !== 'pause') return;
  setText($('p-resume'), pauseReturn === 'station' ? 'Return to station' : 'Return to flight');
  setText($('k-resume'), keysFor(input.source).pause);
  setText($('p-sound'), S.sound ? 'Sound · on' : 'Sound · off');
  setText($('p-diff'), `Difficulty · ${diff().name}`);
  setHTML(
    $('p-career'),
    `Rank <b>${esc(rank())}</b> · ${fmt(S.kills)} raiders broken · ${fmt(S.jobsDone)} jobs · ${fmt(S.salvage)} T salvage · ${esc(flightTime())} flown`
  );
  setHTML(
    $('p-controls'),
    controlsHelp(input.source)
      .map(([k, l]) => `<span><kbd>${esc(k)}</kbd> ${esc(l)}</span>`)
      .join('')
  );
}

function renderEnding() {
  const accord = S.allegiance === 'accord';
  setText($('e-title'), accord ? 'Tomorrow flies the Accord flag' : 'Tomorrow belongs to the captains');
  setText(
    $('e-text'),
    accord
      ? 'The Ember Crown is ash, the corridor is chartered, and Meridian Gate’s patrols answer to a captain who flew when the carriers would not. Refits cost less under the charter, and the quiet lanes stay quieter.'
      : 'The Ember Crown is ash and the Reach stays free. Coldwater raised your name on the Compact’s roll, and every market pays a captain’s dividend. The raiders will come back. So will you.'
  );
  const stats = [
    ['Credits', `${fmt(S.credits)} CR`],
    ['Raiders broken', fmt(S.kills)],
    ['Flight time', flightTime()],
    ['Jobs completed', fmt(S.jobsDone)],
    ['Salvage', `${fmt(S.salvage)} T`],
    ['Rank', rank()],
  ];
  setHTML($('e-stats'), stats.map(([k, v]) => `<div><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join(''));
}

/* ================================================================ HUD */

const H = {
  system: $('h-system'),
  route: $('h-route'),
  credits: $('h-credits'),
  kMap: $('k-map'),
  oNum: $('o-num'),
  oTitle: $('o-title'),
  oText: $('o-text'),
  oBar: $('o-bar'),
  oReward: $('o-reward'),
  oRisk: $('o-risk'),
  oJobs: $('o-jobs'),
  target: $('target'),
  tCount: $('t-count'),
  tName: $('t-name'),
  tRange: $('t-range'),
  tBar: $('t-bar'),
  rShield: $('r-shield'),
  rShieldV: $('r-shield-v'),
  rHull: $('r-hull'),
  rHullV: $('r-hull-v'),
  energy: $('m-energy'),
  energyBar: $('m-energy-bar'),
  heat: $('m-heat'),
  heatBar: $('m-heat-bar'),
  heatRow: $('m-heat-row'),
  speed: $('m-speed'),
  speedBar: $('m-speed-bar'),
  kFire: $('k-fire'),
  kBoost: $('k-boost'),
  kJump: $('k-jump'),
  jumpV: $('w-jump-v'),
  wBoost: $('w-boost'),
  wJump: $('w-jump'),
  prompts: $('prompts'),
  perf: $('perf'),
};
let shownDock = null;
let shownJump = null;

function updateHud() {
  if (mode === 'title') return;
  const sys = systemById(S.system);
  const k = keysFor(input.source);
  setText(H.system, sys.name);
  setText(H.route, S.route === S.system ? 'No route' : systemById(S.route).name);
  setText(H.credits, fmt(S.credits));
  setText(H.kMap, k.map);

  const th = thread();
  setText(H.oNum, th.num);
  setText(H.oTitle, th.title);
  setText(H.oText, th.text);
  setStyle(H.oBar, 'width', `${Math.round(th.progress)}%`);
  setText(H.oReward, th.reward);
  setText(H.oRisk, th.risk);
  setHTML(
    H.oJobs,
    S.jobs
      .map((j) => {
        const right = j.type === 'courier' ? `${j.tons} T` : `${Math.min(j.progress, j.count)}/${j.count}`;
        return `<div><span>${esc(jobTitle(j))}</span><b>${right}</b></div>`;
      })
      .join('')
  );

  const tgt = crown || nearest;
  if (tgt) {
    const d = tgt.group.position.distanceTo(ship.position);
    setText(H.tName, tgt.def.name);
    setText(H.tRange, `${fmt(d * 10)} m · ${tgt === crown ? 'flagship' : 'hostile'}`);
    const pct = tgt === crown ? (crown.hp / crown.maxHp) * 100 : clamp(((230 - d) / 230) * 100, 8, 100);
    setStyle(H.tBar, 'width', `${Math.round(pct)}%`);
  } else {
    setText(H.tName, 'No hostile lock');
    setText(H.tRange, 'Local volume secure');
    setStyle(H.tBar, 'width', '4%');
  }
  setText(H.tCount, String(enemies.length).padStart(2, '0'));
  setClass(H.target, 'boss', !!crown);

  setStyle(H.rShield, '--value', `${Math.round(Math.min(100, (S.shield / shieldMax()) * 100))}%`);
  setText(H.rShieldV, fmt(S.shield));
  setStyle(H.rHull, '--value', `${Math.round(Math.min(100, (S.hull / hullMax()) * 100))}%`);
  setText(H.rHullV, fmt(S.hull));
  setClass(H.rHull, 'low', S.hull < 30);
  setText(H.energy, fmt(S.energy));
  setStyle(H.energyBar, 'width', `${Math.round(S.energy)}%`);
  setText(H.heat, fmt(Math.min(100, S.heat)));
  setStyle(H.heatBar, 'width', `${Math.round(Math.min(100, S.heat))}%`);
  setClass(H.heatRow, 'is-hot', S.heat > 75);
  setText(H.speed, fmt(speed * 10));
  setStyle(H.speedBar, 'width', `${Math.round(Math.min(100, speed * 1.7))}%`);

  setText(H.kFire, k.fire);
  setText(H.kBoost, k.boost);
  setText(H.kJump, k.jump);
  const canJump = S.route !== S.system;
  setText(H.jumpV, canJump ? `${Math.round(clamp(jumpCharge / jumpNeed(), 0, 1) * 100)}%` : 'NO ROUTE');
  setClass(H.wJump, 'active', jumpCharge > 0);
  setClass(H.wBoost, 'active', mode === 'flight' && input.down('boost'));

  if (mode === 'flight') {
    const cap = jumpSpeedCap();
    let html;
    if (dockAvail) html = `<button type="button" data-act="dock"><kbd>${k.dock}</kbd> Dock at ${esc(sys.station)}</button>`;
    else if (canJump && speed >= cap) html = `<span><kbd>${k.brake}</kbd> Brake below ${cap * 10} m/s to translate</span>`;
    else if (input.source === 'gamepad') html = '<span><kbd>LS</kbd> Fly · <kbd>RS</kbd> Aim · <kbd>RT</kbd> Fire · <kbd>A</kbd> Afterburn</span>';
    else if (input.source === 'touch') html = '<span><kbd>STICK</kbd> Fly · <kbd>FIRE</kbd> Fire · <kbd>BOOST</kbd> Afterburn</span>';
    else html = '<span><kbd>WASD</kbd> Pilot · <kbd>Q/E</kbd> Strafe · <kbd>LMB</kbd> Fire</span>';
    setHTML(H.prompts, html);
  }

  const showDock = mode === 'flight' && dockAvail;
  if (showDock !== shownDock) {
    shownDock = showDock;
    kit.touch?.setShown('dock', showDock);
  }
  if (canJump !== shownJump) {
    shownJump = canJump;
    kit.touch?.setShown('jump', canJump);
  }
}

/* ================================================================ input per mode */

function handleInput(dt) {
  switch (mode) {
    case 'title':
      nav.update(dt, screens.title);
      break;
    case 'flight': {
      if (input.pressed('pause')) openPause('flight');
      else if (input.pressed('map')) openMap('flight');
      else if (input.pressed('dock')) tryDock();
      if (input.pressed('zoomCycle')) zoom = zoom < 0.95 ? 1 : zoom < 1.2 ? 1.3 : 0.8;
      const zin = input.zoom();
      if (zin) zoom = clamp(zoom * Math.exp(-zin * 0.08), 0.7, 1.5);
      break;
    }
    case 'station':
      if (input.pressed('pause')) openPause('station');
      else if (input.pressed('map')) openMap('station');
      else if (input.pressed('dock')) launch();
      else if (input.pressed('tabPrev')) switchTab(-1);
      else if (input.pressed('tabNext')) switchTab(1);
      else nav.update(dt, screens.station);
      break;
    case 'map':
      if (input.pressed('map') || input.pressed('back') || input.pressed('pause')) setMode(mapReturn);
      else nav.update(dt, screens.map);
      break;
    case 'pause':
      if (input.pressed('pause') || input.pressed('back')) setMode(pauseReturn);
      else nav.update(dt, screens.pause);
      break;
    case 'ending':
      if (input.pressed('pause') || input.pressed('back')) setMode('station');
      else nav.update(dt, screens.ending);
      break;
  }
}

/* ================================================================ boot */

// Audio may only start from a real gesture.
addEventListener('pointerdown', () => audio.unlock(), true);
addEventListener('keydown', () => audio.unlock(), true);
kit.onPause((p) => audio.pause(p || mode === 'pause' || document.hidden));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'flight') openPause('flight');
  audio.pause(document.hidden || kit.paused || mode === 'pause');
  if (document.hidden && started && mode !== 'title') save();
});
addEventListener('pagehide', () => {
  if (started && mode !== 'title') save();
});
input.onSourceChange(() => {
  if (mode === 'title') renderTitle();
  else if (mode === 'pause') renderPause();
  else if (mode === 'station') setText($('k-launch'), keysFor(input.source).dock);
  else if (mode === 'map') setText($('k-mapclose'), keysFor(input.source).map);
  updateHud();
});

W.setSystem(SYSTEMS[0], 0);
kit.touch?.setShown('dock', false);
kit.touch?.setShown('jump', false);
buildMap();
setMode('title');
await W.warm();

kit.start((dt) => {
  time += dt;
  handleInput(dt);
  if (mode === 'flight') updateFlight(dt);
  else if (mode === 'title') updateTitle(dt);
  else updateHeld(dt);

  stationSpin += dt * 0.08;
  W.station.rotation.y = stationSpin;
  W.stars.object.rotation.y += dt * 0.0025;
  toastBox.update(dt);
  drawPools();
  if (mode === 'flight') updateMarkers();

  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.1;
    updateHud();
  }
  perfT -= dt;
  if (perfT <= 0) {
    perfT = 0.75;
    setText(H.perf, `${kit.backendLabel} · ${window.__kit?.fps ?? 0} FPS`);
  }
  autosaveT -= dt;
  if (autosaveT <= 0) {
    autosaveT = 15;
    if (mode !== 'title') save();
  }
  W.render();
});
