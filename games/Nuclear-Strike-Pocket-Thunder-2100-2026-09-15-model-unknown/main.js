/* POCKET THUNDER 2100 — the game.
   Original game; all geometry, animation, maps and audio are generated here.
   Rendering: three.js r186 through the shared kit (render.js). Input: kit
   actions (keyboard + mouse, gamepad, touch). Two operations: Breakwater (the
   original mission, now with patrol boats) and Nightwatch (hold the forward
   base through eight waves until dawn). */

import { boot } from 'kit/boot.js';
import { createView, TAU, PI, hypot, clamp, lerp, boxGeo, sphereGeo } from './render.js';
import { rand, rnd, color, C, group, box, sphere, ring, BASE, islands, BRIDGES, landHeight, buildWorld, crateVisual, makeHelicopter, enemyModel, human } from './world.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 60;

/* ================================================================ storage and preferences */

const memoryStore = {};
const storage = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem('pt2100_' + k) || memoryStore[k] || 'null');
    } catch {
      try {
        return memoryStore[k] ? JSON.parse(memoryStore[k]) : null;
      } catch {
        return null;
      }
    }
  },
  set(k, v) {
    memoryStore[k] = JSON.stringify(v);
    try {
      localStorage.setItem('pt2100_' + k, memoryStore[k]);
      return true;
    } catch {
      return false;
    }
  },
  del(k) {
    delete memoryStore[k];
    try {
      localStorage.removeItem('pt2100_' + k);
    } catch {
      /* private mode */
    }
  },
};

const TUNING = {
  standard: { clock: 720, taken: 1, cool: 1, cannon: 10, base: 1 },
  assist: { clock: 960, taken: 0.6, cool: 1.2, cannon: 12, base: 0.6 },
  veteran: { clock: 600, taken: 1.3, cool: 0.85, cannon: 10, base: 1.25 },
};
const prefs = storage.get('prefs') || {};
let difficulty = TUNING[prefs.difficulty] ? prefs.difficulty : 'standard';
let motion = typeof prefs.motion === 'boolean' ? prefs.motion : !matchMedia('(prefers-reduced-motion: reduce)').matches;
let soundEnabled = prefs.sound !== false;
const tune = () => TUNING[difficulty] || TUNING.standard;
function savePrefs() {
  storage.set('prefs', { difficulty, motion, sound: soundEnabled });
}

/* ================================================================ boot */

const kit = await boot({
  title: 'Pocket Thunder · 2100',
  canvas: $('world'),
  gear: 'none', // the title and pause menus carry a Settings button (F9 works too)
  accent: '#ffdc70',
  background: '#122c32',
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    fire: { keys: ['Space', 'KeyJ'], mouse: [0], gamepad: ['RT', 'A'], touch: 'Fire' },
    missile: { keys: ['KeyR', 'KeyK'], mouse: [2], gamepad: ['X', 'RB'], touch: 'Missile' },
    emp: { keys: ['KeyQ', 'KeyE'], gamepad: ['Y'], touch: 'EMP' },
    boost: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LT', 'B', 'LB'], touch: 'Boost' },
    map: { keys: ['KeyM'], gamepad: ['Back'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    ok: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});
const input = kit.input;
const sound = new Sound(soundEnabled);

// The touch buttons carry the original cockpit glyphs above their names.
function touchLabel(glyph, text) {
  const s = document.createElement('span');
  s.className = 'tlabel';
  const g = document.createElement('b');
  g.textContent = glyph;
  s.append(g, text);
  return s;
}
if (kit.touch) {
  kit.touch.setLabel('fire', touchLabel('⌖', 'FIRE'));
  kit.touch.setLabel('missile', touchLabel('↟', 'MISSILE'));
  kit.touch.setLabel('emp', touchLabel('ϟ', 'EMP'));
  kit.touch.setLabel('boost', touchLabel('»', 'BOOST'));
}

kit.loading.progress(0.66, 'Building Sable Atoll…');
const view = createView(kit);
buildWorld(view);

/* ================================================================ dynamic scene */

const dynamicRoots = [];
const heli = makeHelicopter();
dynamicRoots.push(heli.root);
heli.root.x = BASE.x;
heli.root.z = BASE.z;
heli.root.y = 11;
const downwash = ring(null, BASE.x, 2.3, BASE.z, 5.8, C.sand, 0.1);
dynamicRoots.push(downwash);
const winch = box(null, BASE.x, 5, BASE.z, 0.045, 9, 0.045, C.cream);
winch.cast = false;
winch.visible = false;
dynamicRoots.push(winch);

// Enemies and rescue crews are rebuilt from this fixed layout on every new sortie.
// Patrol boats (b1–b3) sail the lagoons on the ROUTES loops.
const enemyDefs = [
  ['r1', 'relay', -30, 14],
  ['r2', 'relay', 8, -26],
  ['r3', 'relay', 61, -48],
  ['t1', 'turret', -22, 8],
  ['s1', 'sam', -39, 2],
  ['t2', 'turret', -55, -1],
  ['t3', 'turret', -41, -13],
  ['t4', 'turret', 3, -18],
  ['a1', 'tank', 23, -14],
  ['t5', 'turret', 24, -3],
  ['s2', 'sam', 28, -30],
  ['a2', 'tank', 51, -27],
  ['s3', 'sam', 64, -37],
  ['t6', 'turret', 69, -57],
  ['t7', 'turret', 8, -62],
  ['s4', 'sam', 29, -73],
  ['boss', 'boss', 16, -74],
  ['b1', 'boat', 0, 34, 0],
  ['b2', 'boat', -30, -30, 1],
  ['b3', 'boat', 50, -80, 2],
];
const ROUTES = [
  [[0, 34], [30, 30], [50, 12], [58, 24], [34, 44], [6, 46]], // north lagoon
  [[-30, -30], [-18, -44], [-24, -60], [-40, -52], [-44, -36]], // south-west channel
  [[50, -80], [70, -84], [84, -74], [80, -88], [60, -92]], // south-east reach
];
const campsDefs = [
  { id: 'crew1', x: -51, z: -7 },
  { id: 'crew2', x: 26, z: 4 },
];
const supplyDefs = [
  ['fuel', -38, 28],
  ['ammo', -60, -11],
  ['repair', -22, 24],
  ['fuel', -1, 8],
  ['ammo', 14, -37],
  ['repair', 35, -20],
  ['fuel', 48, -58],
  ['ammo', 21, -61],
];
const STATS = {
  relay: { hp: 210, score: 350, cool: 2.15, range: 35 },
  boss: { hp: 1100, score: 2000, cool: 1.9, range: 46 },
  tank: { hp: 145, score: 150, cool: 3, range: 35 },
  sam: { hp: 100, score: 150, cool: 4.3, range: 43 },
  drone: { hp: 48, score: 90, cool: 2.15, range: 35 },
  turret: { hp: 80, score: 150, cool: 2.15, range: 35 },
  boat: { hp: 130, score: 220, cool: 2.6, range: 38 },
  mboat: { hp: 170, score: 260, cool: 4.6, range: 44 },
};
const LABELS = { drone: 'DRONE', boat: 'GUNBOAT', mboat: 'MISSILE BOAT', tank: 'TANK', sam: 'SAM SITE', turret: 'TURRET', relay: 'SHIELD RELAY', boss: 'ATLAS' };

let enemies = [];
let camps = [];
let supplies = [];
let actorRoots = [];
let boss = null;
let mode = 'mission'; // 'mission' (Breakwater) | 'night' (Nightwatch)

function makeEnemy(def, hpScale = 1) {
  const [id, type, x, z, route = -1] = def;
  const root = group(null, x, 2.18, z);
  const head = group(root);
  const max = Math.round((STATS[type] || STATS.turret).hp * hpScale);
  const e = {
    id,
    type,
    x,
    z,
    homeX: x,
    homeZ: z,
    y: 3.5,
    max,
    hp: max,
    root,
    head,
    dead: false,
    cool: rnd(1.4, 3.5),
    stun: 0,
    flash: 0,
    phase: rand() * TAU,
    patrol: 0,
    route,
    leg: 0,
    goal: null,
    arrived: false,
    wake: 0,
    radius: 1.75,
    shield: null,
    shieldRing: null,
    parts: null,
  };
  const m = enemyModel(type, root, head);
  e.y = m.y;
  e.radius = m.radius;
  e.shield = m.shield;
  e.shieldRing = m.shieldRing;
  root.ry = rand() * TAU;
  // Hit flash: every visible part brightens for a moment.
  e.parts = [];
  const gather = (n) => {
    if (n.geo && n !== e.shield && n !== e.shieldRing) e.parts.push({ n, em: n.emission });
    for (const c of n.children) gather(c);
  };
  gather(root);
  actorRoots.push(root);
  dynamicRoots.push(root);
  return e;
}
function makeCamp(def) {
  const root = group(null, def.x, 2.18, def.z);
  ring(root, 0, 0.035, 0, 4, C.cyan, 0.82, 0.12);
  for (let a = 0; a < 4; a++) {
    const r = (a * PI) / 2;
    box(root, Math.cos(r) * 4, 0.13, Math.sin(r) * 4, 0.35, 0.22, 0.35, C.cyan).emission = 0.7;
  }
  const people = [human(root, -1, 0, 0), human(root, 1, 0.4, 1)];
  box(root, 0, 0.18, -2, 1.2, 0.35, 0.9, C.cream);
  box(root, 0, 0.38, -2, 0.7, 0.06, 0.18, C.red);
  box(root, 0, 0.38, -2, 0.18, 0.06, 0.6, C.red);
  dynamicRoots.push(root);
  actorRoots.push(root);
  return { ...def, root, people, rescued: 0, progress: 0 };
}
function makeSupply(def, i) {
  const [type, x, z] = def;
  const root = group(null, x, 2.23, z);
  const col = type === 'fuel' ? '#739d69' : type === 'ammo' ? C.yellow : C.cream;
  crateVisual(root, 0, 0, 0, col);
  ring(root, 0, 0.04, 0, 2.35, col, 0.6);
  if (type === 'repair') {
    box(root, 0, 1.25, 0, 1, 0.07, 0.24, C.red);
    box(root, 0, 1.25, 0, 0.24, 0.07, 0.8, C.red);
  }
  const s = { id: 'supply' + i, type, x, z, root, taken: false, progress: 0 };
  dynamicRoots.push(root);
  actorRoots.push(root);
  return s;
}
function buildActors(kind = 'mission') {
  for (const root of actorRoots) {
    const i = dynamicRoots.indexOf(root);
    if (i >= 0) dynamicRoots.splice(i, 1);
  }
  actorRoots = [];
  if (kind === 'mission') {
    enemies = enemyDefs.map((d) => makeEnemy(d));
    camps = campsDefs.map(makeCamp);
    boss = enemies.find((e) => e.type === 'boss');
  } else {
    enemies = [];
    camps = [];
    boss = null;
  }
  supplies = supplyDefs.map(makeSupply);
}

/* ================================================================ audio */

function sfx(type, x = p.x, z = p.z) {
  sound.sfx(type, clamp((x - p.x - (z - p.z)) * 0.013, -0.8, 0.8));
}
function syncSound() {
  document.querySelectorAll('.soundBtn').forEach((b) => {
    b.textContent = soundEnabled ? 'SND' : 'MUTE';
    b.setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
  });
  $('pauseSound').textContent = soundEnabled ? 'ON' : 'OFF';
  sound.setEnabled(soundEnabled);
  savePrefs();
}
function toggleSound() {
  sound.init();
  soundEnabled = !soundEnabled;
  syncSound();
}
// Browsers only start audio after a gesture: the first tap or key does it.
const unlockAudio = () => sound.init();
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

/* ================================================================ particles and projectiles */

// Pooled particles and projectiles keep mobile memory use stable.
const particlePool = [];
const particles = [];
const particleRecs = [];
const projectilePool = [];
const projectiles = [];
const projectileRecs = [];
const ringPool = [];
const effects = [];
const wrecks = [];
for (let i = 0, n = kit.detail(240, 120); i < n; i++) {
  const s = sphere(null, 0, 0, 0, 1, C.yellow);
  s.visible = false;
  s.cast = false;
  particlePool.push(s);
  dynamicRoots.push(s);
}
for (let i = 0; i < 110; i++) {
  const b = box(null, 0, 0, 0, 0.12, 0.12, 1, C.yellow);
  b.emission = 1.4;
  b.cast = false;
  b.visible = false;
  projectilePool.push(b);
  dynamicRoots.push(b);
}
for (let i = 0; i < 16; i++) {
  const r = ring(null, 0, 0, 0, 1, C.orange, 0.8, 1);
  r.visible = false;
  ringPool.push(r);
  dynamicRoots.push(r);
}
function particle(x, y, z, col, size, life, vx = 0, vy = 0, vz = 0, smoke = false) {
  const n = particlePool.pop();
  if (!n) return;
  n.visible = true;
  n.geo = smoke ? sphereGeo : boxGeo;
  n.col = color(col);
  n.emission = smoke ? 0 : 1;
  n.alpha = smoke ? 0.42 : 1;
  n.x = x;
  n.y = y;
  n.z = z;
  n.sx = n.sy = n.sz = size;
  n.rx = rand() * PI;
  n.ry = rand() * PI;
  // Records are pooled too, so a firefight allocates nothing per shot or spark.
  const a = particleRecs.pop() || {};
  a.n = n;
  a.x = x;
  a.y = y;
  a.z = z;
  a.vx = vx;
  a.vy = vy;
  a.vz = vz;
  a.life = life;
  a.max = life;
  a.size = size;
  a.smoke = smoke;
  particles.push(a);
}
/** Remove item i from an unordered list by moving the last one into its place. */
function dropAt(list, i) {
  const last = list.pop();
  if (i < list.length) list[i] = last;
}
function shock(x, y, z, radius, col = C.yellow, life = 0.6) {
  const n = ringPool.pop();
  if (!n) return;
  n.x = x;
  n.y = y;
  n.z = z;
  n.col = color(col);
  n.visible = true;
  n.alpha = 0.85;
  n.sx = n.sz = 0.4;
  effects.push({ n, age: 0, life, radius });
}
function explosion(x, y, z, big = false) {
  const scale = big ? 1.8 : 1;
  for (let i = 0; i < (big ? 26 : 15); i++) {
    const a = rand() * TAU;
    const s = rnd(2, 9) * scale;
    particle(x, y, z, i % 3 === 0 ? C.cream : i % 2 ? C.yellow : C.orange, rnd(0.2, 0.6) * scale, rnd(0.45, 1.2), Math.cos(a) * s, rnd(3, 11) * scale, Math.sin(a) * s);
  }
  for (let i = 0; i < (big ? 15 : 7); i++)
    particle(x + rnd(-1, 1), y, z + rnd(-1, 1), i % 2 ? '#7c8376' : '#495e58', rnd(0.6, 1.2) * scale, rnd(2, 4), rnd(-1.8, 1.8), rnd(2, 4), rnd(-1.8, 1.8), true);
  shock(x, 2.32, z, big ? 12 : 7, C.yellow, 0.7);
  const near = clamp(1 - hypot(p.x - x, p.z - z) / 70, 0.1, 1);
  if (motion) cameraShake = Math.min(1.25, cameraShake + (big ? 0.85 : 0.34) * near);
  if (state === 'playing' && near > 0.35) input.rumble((big ? 0.7 : 0.35) * near, big ? 260 : 120);
  sfx('boom', x, z);
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const a = particles[i];
    a.life -= dt;
    if (a.life <= 0) {
      a.n.visible = false;
      particlePool.push(a.n);
      particleRecs.push(a);
      dropAt(particles, i);
      continue;
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.z += a.vz * dt;
    if (!a.smoke) {
      a.vy -= 15 * dt;
      if (a.y < 0.3) {
        a.y = 0.3;
        a.vy *= -0.3;
      }
    }
    const f = a.life / a.max;
    a.n.x = a.x;
    a.n.y = a.y;
    a.n.z = a.z;
    const s = a.smoke ? a.size * (1 + (1 - f) * 3) : a.size * (0.35 + f * 0.65);
    a.n.sx = a.n.sy = a.n.sz = s;
    a.n.alpha = a.smoke ? 0.44 * Math.min(1, f * 2) : Math.min(1, f * 4);
    a.n.ry += dt * (a.smoke ? 0.25 : 3);
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.age += dt;
    if (e.age >= e.life) {
      e.n.visible = false;
      ringPool.push(e.n);
      dropAt(effects, i);
      continue;
    }
    const f = e.age / e.life;
    e.n.sx = e.n.sz = e.radius * (0.1 + f * 0.9);
    e.n.alpha = (1 - f) * 0.85;
  }
}
function clearFX() {
  for (const a of particles) {
    a.n.visible = false;
    particlePool.push(a.n);
    particleRecs.push(a);
  }
  particles.length = 0;
  for (const a of projectiles) {
    a.n.visible = false;
    a.target = null;
    projectilePool.push(a.n);
    projectileRecs.push(a);
  }
  projectiles.length = 0;
  for (const a of effects) {
    a.n.visible = false;
    ringPool.push(a.n);
  }
  effects.length = 0;
  for (const w of wrecks) {
    const i = dynamicRoots.indexOf(w);
    if (i >= 0) dynamicRoots.splice(i, 1);
  }
  wrecks.length = 0;
}
const BASE_TARGET = { x: BASE.x, y: 3, z: BASE.z };
function newProjectile(x, y, z, tx, ty, tz, speed, damage, enemy = false, guided = false, target = null, atBase = false) {
  const n = projectilePool.pop();
  if (!n) return;
  const dx = tx - x, dy = ty - y, dz = tz - z;
  const k = speed / (hypot(dx, dy, dz) || 1);
  n.visible = true;
  n.col = color(enemy ? C.orange : guided ? C.cream : C.yellow);
  n.sx = n.sy = guided ? 0.21 : 0.1;
  n.sz = guided ? 1.05 : 0.85;
  n.emission = enemy ? 1.4 : 2.2;
  n.alpha = 1;
  n.x = x;
  n.y = y;
  n.z = z;
  const b = projectileRecs.pop() || {};
  b.n = n;
  b.x = x;
  b.y = y;
  b.z = z;
  b.vx = dx * k;
  b.vy = dy * k;
  b.vz = dz * k;
  b.speed = speed;
  b.damage = damage;
  b.enemy = enemy;
  b.guided = guided;
  b.target = target;
  b.atBase = atBase;
  b.life = guided ? 4.2 : atBase ? 2.4 : 1.5;
  b.trail = 0;
  b.age = 0;
  projectiles.push(b);
}
function segmentDistance(x, y, z, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const d = dx * dx + dy * dy + dz * dz;
  const t = d ? clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / d, 0, 1) : 0;
  return hypot(x - (ax + dx * t), y - (ay + dy * t), z - (az + dz * t));
}
function removeProjectile(i) {
  const b = projectiles[i];
  b.n.visible = false;
  b.target = null;
  projectilePool.push(b.n);
  projectileRecs.push(b);
  dropAt(projectiles, i);
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const b = projectiles[i];
    b.life -= dt;
    b.age += dt;
    if (b.life <= 0) {
      removeProjectile(i);
      continue;
    }
    if (b.guided) {
      const t = b.enemy ? (b.atBase ? BASE_TARGET : p) : b.target && !b.target.dead ? b.target : null;
      if (t && (!b.enemy || b.age < 1.35)) {
        const gx = t.x - b.x, gy = t.y - b.y, gz = t.z - b.z;
        const k = b.speed / (hypot(gx, gy, gz) || 1);
        const f = 1 - Math.exp(-dt * (b.enemy ? 1.6 : 7));
        b.vx = lerp(b.vx, gx * k, f);
        b.vy = lerp(b.vy, gy * k, f);
        b.vz = lerp(b.vz, gz * k, f);
      }
      b.trail += dt;
      if (b.trail > 0.065) {
        b.trail = 0;
        particle(b.x, b.y, b.z, b.enemy ? '#c2af85' : '#bac8af', 0.24, 0.65, 0, 0.4, 0, true);
      }
    }
    const ox = b.x, oy = b.y, oz = b.z;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.n.x = b.x;
    b.n.y = b.y;
    b.n.z = b.z;
    b.n.ry = Math.atan2(b.vx, b.vz);
    b.n.rx = -Math.atan2(b.vy, hypot(b.vx, b.vz));
    if (b.enemy) {
      if (segmentDistance(p.x, p.y - 0.15, p.z, ox, oy, oz, b.x, b.y, b.z) < 1.45) {
        damagePlayer(b.damage);
        for (let j = 0; j < 4; j++) particle(b.x, b.y, b.z, C.yellow, 0.2, 0.4, rnd(-3, 3), rnd(0, 4), rnd(-3, 3));
        removeProjectile(i);
        continue;
      }
      if (b.atBase && (segmentDistance(BASE.x, 2.8, BASE.z, ox, oy, oz, b.x, b.y, b.z) < 6.5 || (b.y < 3.2 && hypot(b.x - BASE.x, b.z - BASE.z) < 7.5))) {
        damageBase(b.damage, b.x, b.z);
        removeProjectile(i);
        continue;
      }
    } else {
      let hit = null;
      for (const e of enemies) {
        if (!e.dead && segmentDistance(e.x, e.y, e.z, ox, oy, oz, b.x, b.y, b.z) < e.radius) {
          hit = e;
          break;
        }
      }
      if (hit) {
        if (b.guided) {
          explosion(b.x, b.y, b.z, false);
          for (const e of enemies) if (!e.dead && hypot(e.x - b.x, e.z - b.z) < 7.5) damageEnemy(e, e === hit ? b.damage : b.damage * 0.35);
        } else {
          damageEnemy(hit, b.damage);
          for (let j = 0; j < 2; j++) particle(b.x, b.y, b.z, C.yellow, 0.14, 0.23, rnd(-2, 2), rnd(0, 2), rnd(-2, 2));
        }
        removeProjectile(i);
        continue;
      }
    }
    if (b.y < 0.15) {
      if (b.guided) explosion(b.x, 0.3, b.z);
      else if (!onWater(b.x, b.z)) particle(b.x, 0.4, b.z, '#8a927f', 0.18, 0.4, 0, 1, 0, true);
      removeProjectile(i);
    }
  }
}
const onWater = (x, z) => landHeight(x, z) < 1;

/* ================================================================ game state */

let state = 'title';
let time = 0;
let clock = 720;
let elapsed = 0;
let score = 0;
let kills = 0;
let damageTaken = 0;
let navOverride = null;
let curNav = null;
let target = null;
let won = false;
let unlocked = false;
let bossDrones = false;
let radioTimer = 0;
let toastTimer = 0;
let bannerTimer = 0;
let baseTimer = 0;
let leftBase = false;
let lowFuelWarn = false;
let lowHealthWarn = false;
let dryMessage = 0;
let hoverState = null;
let uiAccum = 0;
let fxAccum = 0;
let lastClockWarn = -1;
let cameraShake = 0;
let confirmAction = null;
let blockFire = false;
const FRESH = { x: BASE.x, z: BASE.z, y: 11, vx: 0, vz: 0, yaw: -0.65, hp: 100, fuel: 100, ammo: 800, rockets: 18, cargo: 0, delivered: 0, heat: 0, overheat: false, emp: 0, gunCD: 0, rocketCD: 0, hurt: 0 };
const p = { ...FRESH };
const ctl = { sx: 0, sy: 0, fire: false, boost: false };
const mouse = { x: 0, y: 0, active: false, age: 99, lastX: -1, lastY: -1 };

// Nightwatch: eight waves from dusk to dawn.
const NIGHT_WAVES = 8;
const SEA_LANES = [
  { from: [-60, 102], to: [-58, 72] },
  { from: [-110, 46], to: [-86, 45] },
  { from: [-22, 100], to: [-30, 62] },
  { from: [20, 74], to: [-14, 48] },
  { from: [-110, 12], to: [-85, 18] },
];
const night = { wave: 0, phase: 'calm', between: 0, queue: [], spawnT: 0, baseHp: 100, atmo: 0, hitMsg: 0, warn50: false, warn25: false, serial: 0 };

function relayCount() {
  let n = 0;
  for (const e of enemies) if (e.type === 'relay' && e.dead) n++;
  return n;
}
function rescuedCount() {
  let n = 0;
  for (const c of camps) n += c.rescued;
  return n;
}
function hostilesLeft() {
  let n = night.queue.length;
  for (const e of enemies) if (!e.dead) n++;
  return n;
}
function announce(text, duration = 7) {
  $('radioText').textContent = text;
  radioTimer = duration;
  setStyle('radio', 'opacity', '1');
}
function toast(text, duration = 2.5) {
  $('toast').textContent = text;
  toastTimer = duration;
  $('toast').classList.add('show');
}
function banner(top, title, sub, duration = 3.6) {
  $('bannerTop').textContent = top;
  $('bannerTitle').textContent = title;
  $('bannerSub').textContent = sub;
  bannerTimer = duration;
  setHidden('missionBanner', false);
  setStyle('missionBanner', 'opacity', '1');
}

/* ================================================================ weapons */

function selectTarget(range = 34) {
  let best = null;
  let bestScore = Infinity;
  if (mouse.active && mouse.age < 5) {
    let near = 65;
    for (const e of enemies) {
      if (e.dead || (e.type === 'boss' && !unlocked) || hypot(e.x - p.x, e.z - p.z) > range) continue;
      const q = view.project(e.x, e.y, e.z);
      const d = hypot(q.x - mouse.x, q.y - mouse.y);
      if (d < near) {
        near = d;
        best = e;
      }
    }
    if (best) return best;
  }
  for (const e of enemies) {
    if (e.dead || (e.type === 'boss' && !unlocked)) continue;
    const d = hypot(e.x - p.x, e.z - p.z);
    if (d > range) continue;
    const s = d + (e.type === 'relay' ? 1.5 : 0);
    if (s < bestScore) {
      bestScore = s;
      best = e;
    }
  }
  return best;
}
function fireCannon() {
  if (state !== 'playing' || p.gunCD > 0) return;
  if (p.ammo < 1) {
    if (dryMessage <= 0) {
      toast('CANNON EMPTY / FIND AMMO OR RETURN TO BASE');
      dryMessage = 4;
      sfx('warn');
    }
    return;
  }
  if (p.overheat) return;
  p.gunCD = 0.095;
  p.ammo--;
  p.heat += 0.029;
  if (p.heat >= 1) {
    p.heat = 1;
    p.overheat = true;
    toast('CANNON HOT / COOLING', 1.8);
    sfx('warn');
  }
  const t = target;
  const tx = t ? t.x : p.x + Math.sin(p.yaw) * 30;
  const ty = t ? t.y : p.y;
  const tz = t ? t.z : p.z + Math.cos(p.yaw) * 30;
  const x = p.x + Math.sin(p.yaw) * 2;
  const y = p.y - 0.65;
  const z = p.z + Math.cos(p.yaw) * 2;
  newProjectile(x, y, z, tx + rnd(-0.16, 0.16), ty, tz + rnd(-0.16, 0.16), 95, tune().cannon);
  particle(x, y, z, C.cream, 0.24, 0.065);
  sfx('gun');
}
function fireMissile() {
  if (state !== 'playing' || p.rocketCD > 0) return;
  if (p.rockets < 1) {
    if (dryMessage <= 0) {
      toast('NO MISSILES / RETURN TO BASE');
      dryMessage = 3;
      sfx('warn');
    }
    return;
  }
  const t = selectTarget(43);
  if (!t) {
    toast('NO TARGET IN MISSILE RANGE', 1.4);
    return;
  }
  p.rockets--;
  p.rocketCD = 0.55;
  const side = Math.floor(p.rockets) % 2 === 0 ? 1 : -1;
  const x = p.x + Math.cos(p.yaw) * 2 * side;
  const z = p.z - Math.sin(p.yaw) * 2 * side;
  newProjectile(x, p.y - 0.4, z, t.x, t.y, t.z, 44, 100, false, true, t);
  sfx('rocket');
  input.rumble(0.2, 60);
  if (motion) cameraShake += 0.09;
}
function useEMP() {
  if (state !== 'playing') return;
  if (p.emp > 0) {
    toast('EMP RECHARGING / ' + Math.ceil(p.emp) + ' S', 1.4);
    return;
  }
  p.emp = 18;
  shock(p.x, 3, p.z, 31, C.cyan, 1);
  shock(p.x, p.y, p.z, 29, C.cyan, 0.85);
  for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].enemy && hypot(projectiles[i].x - p.x, projectiles[i].z - p.z) < 34) removeProjectile(i);
  for (const e of enemies)
    if (!e.dead && hypot(e.x - p.x, e.z - p.z) < 30) {
      e.stun = 5.5;
      if (e.type !== 'boss' && e.type !== 'relay') damageEnemy(e, 22);
    }
  sfx('emp');
  input.rumble(0.5, 220);
  toast('EMP ACTIVE / HOSTILE SYSTEMS DISABLED', 2);
  if (motion) cameraShake += 0.2;
}
function damagePlayer(amount) {
  if (state !== 'playing' || p.hurt > 0) return;
  amount *= tune().taken;
  p.hp = Math.max(0, p.hp - amount);
  damageTaken += amount;
  p.hurt = 0.16;
  if (motion) cameraShake += 0.25;
  input.rumble(Math.min(1, 0.3 + amount / 40), 130);
  sfx('hit');
  if (p.hp < 26 && !lowHealthWarn) {
    lowHealthWarn = true;
    announce('Armor is critical. Return to the H pad or collect a white repair crate.');
    sfx('warn');
  }
  if (p.hp <= 0) endMission(false, p.fuel <= 0 ? 'The fuel tank is empty. The aircraft is lost.' : 'The aircraft is lost. Return to base more often for repairs.');
}
function addWreck(e) {
  if (e.type === 'drone') return;
  const w = group(null, e.x, landHeight(e.x, e.z) + 0.15, e.z);
  w.ry = e.root.ry;
  const boat = e.type === 'boat' || e.type === 'mboat';
  box(w, 0, boat ? 0.1 : 0.38, 0, e.type === 'boss' ? 7 : e.radius * (boat ? 1 : 1.7), boat ? 0.3 : 0.75, e.type === 'boss' ? 10 : e.radius * (boat ? 2.6 : 1.8), '#46524a');
  for (let i = 0; i < 5; i++)
    box(w, rnd(-e.radius, e.radius), rnd(0.3, 0.7), rnd(-e.radius, e.radius), rnd(0.3, 0.9), rnd(0.25, 0.7), rnd(0.5, 1.3), i % 2 ? C.steel : C.dark, rand() * TAU);
  wrecks.push(w);
  dynamicRoots.push(w);
}
function damageEnemy(e, amount) {
  if (e.dead) return;
  if (e.type === 'boss' && !unlocked) {
    if (dryMessage <= 0) {
      toast('SHIELD ACTIVE / RELAYS AND CREW CODES REQUIRED');
      dryMessage = 4;
    }
    return;
  }
  e.hp = Math.max(0, e.hp - amount);
  e.flash = 0.12;
  if (e.hp <= 0) {
    e.dead = true;
    e.root.visible = false;
    kills++;
    score += (STATS[e.type] || STATS.turret).score;
    explosion(e.x, e.y, e.z, e.type === 'boss');
    addWreck(e);
    if (e.type === 'relay') {
      toast('SHIELD RELAY DOWN / ' + relayCount() + ' OF 3');
      announce(relayCount() === 3 ? 'All relays are down. Rescue the engineers to obtain the shield access codes.' : 'Relay destroyed. Keep moving. The missile sites can track a hover.');
    }
    if (e.type === 'boss') {
      for (let k = 0; k < 3; k++) explosion(e.x + rnd(-4, 4), 3, e.z + rnd(-4, 4), true);
      announce('ATLAS is destroyed. Bring the crew back to the H pad. We are going home.', 10);
      toast('LAUNCH ABORTED / RETURN TO BASE', 4);
      navOverride = null;
    }
    if ((e.type === 'boat' || e.type === 'mboat') && mode === 'mission') toast('PATROL BOAT SUNK', 1.6);
  }
  checkUnlock();
}
function checkUnlock() {
  if (mode !== 'mission' || !boss) return;
  if (!unlocked && relayCount() === 3 && rescuedCount() === 4) {
    unlocked = true;
    boss.shield.visible = false;
    boss.shieldRing.visible = false;
    announce('The crew has disabled the shield. ATLAS is exposed. Destroy the launch vehicle.', 10);
    toast('ATLAS SHIELD OFFLINE', 3.5);
    shock(boss.x, 3, boss.z, 17, C.cyan, 1.2);
    sfx('rescue');
    navOverride = null;
  }
}
function enemyFire(e, atBase = false) {
  const guided = e.type === 'sam' || e.type === 'mboat';
  let tx, ty, tz;
  if (atBase) {
    tx = BASE.x + rnd(-2.5, 2.5);
    ty = 3;
    tz = BASE.z + rnd(-2.5, 2.5);
  } else {
    const d = hypot(p.x - e.x, p.z - e.z);
    const lead = (d / (guided ? 18 : 25)) * 0.27;
    tx = p.x + p.vx * lead;
    ty = p.y;
    tz = p.z + p.vz * lead;
  }
  const y = e.type === 'boss' ? 7 : e.y + 0.6;
  const damage = e.type === 'boss' ? 10 : guided ? 14 : e.type === 'tank' ? 9 : e.type === 'boat' ? 8 : 7;
  const count = e.type === 'boss' ? 3 : e.type === 'tank' || e.type === 'boat' ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) * 0.5) * (e.type === 'boss' ? 3 : 1.2);
    newProjectile(e.x, y, e.z, tx + spread, ty, tz - spread, guided ? 19 : 27, damage, true, guided, null, atBase);
  }
  e.cool = (STATS[e.type] || STATS.turret).cool * tune().cool;
  particle(e.x, y, e.z, C.orange, 0.4, 0.12);
}
function moveBoat(e, dt) {
  let gx, gz, speed;
  if (e.goal) {
    // Nightwatch: sail in to a firing position offshore, then idle around it.
    const dg = hypot(e.goal.x - e.x, e.goal.z - e.z);
    if (dg > 4 && !e.arrived) {
      gx = e.goal.x;
      gz = e.goal.z;
      speed = 6;
    } else {
      e.arrived = true;
      e.patrol += dt * 0.3;
      gx = e.goal.x + Math.cos(e.patrol + e.phase) * 4;
      gz = e.goal.z + Math.sin(e.patrol + e.phase) * 4;
      speed = 2.2;
    }
  } else if (e.route >= 0) {
    const r = ROUTES[e.route];
    let w = r[e.leg];
    if (hypot(w[0] - e.x, w[1] - e.z) < 3) {
      e.leg = (e.leg + 1) % r.length;
      w = r[e.leg];
    }
    gx = w[0];
    gz = w[1];
    speed = 4.2;
  } else return;
  const dx = gx - e.x;
  const dz = gz - e.z;
  const d = hypot(dx, dz);
  if (d > 0.05) {
    const want = Math.atan2(dx, dz);
    const diff = ((((want - e.root.ry + PI) % TAU) + TAU) % TAU) - PI;
    e.root.ry += diff * Math.min(1, dt * 1.6);
    const stepLen = Math.min(d, speed * dt);
    e.x += Math.sin(e.root.ry) * stepLen;
    e.z += Math.cos(e.root.ry) * stepLen;
  }
  e.root.x = e.x;
  e.root.z = e.z;
  e.wake -= dt;
  if (e.wake <= 0 && hypot(e.x - cam.x, e.z - cam.z) < 70) {
    e.wake = 0.17;
    particle(e.x - Math.sin(e.root.ry) * 4.2, 0.35, e.z - Math.cos(e.root.ry) * 4.2, '#dfeee0', 0.3, 1.1, 0, 0.15, 0, true);
  }
}
function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    const d = hypot(e.x - p.x, e.z - p.z);
    const dBase = hypot(e.x - BASE.x, e.z - BASE.z);
    if (e.flash > 0) {
      e.flash = Math.max(0, e.flash - dt);
      const glow = (e.flash / 0.12) * 0.9;
      for (const part of e.parts) part.n.emission = part.em + glow;
    }
    e.stun = Math.max(0, e.stun - dt);
    if (e.type === 'relay') {
      e.head.ry += dt * 0.65;
      continue;
    }
    if (e.type === 'boss') {
      e.shield.visible = !unlocked;
      e.shieldRing.visible = !unlocked;
      e.shield.ry = time * 0.15;
      e.shield.alpha = 0.09 + Math.sin(time * 2) * 0.025;
    }
    if (e.type === 'boat' || e.type === 'mboat') {
      e.root.y = -0.05 + Math.sin(time * 1.7 + e.phase) * 0.12;
      e.root.rz = Math.sin(time * 1.3 + e.phase) * 0.04;
    }
    if (e.stun > 0) {
      if (rand() < dt * 6 && d < 50) particle(e.x, e.y + 1, e.z, C.cyan, 0.14, 0.25, rnd(-3, 3), 2, rnd(-3, 3));
      continue;
    }
    if (e.type === 'tank') {
      e.patrol += dt * 0.26;
      e.x = e.homeX + Math.sin(e.patrol + e.phase) * 2.5;
      e.z = e.homeZ + Math.cos(e.patrol + e.phase) * 2;
      e.root.x = e.x;
      e.root.z = e.z;
    }
    if (e.type === 'boat' || e.type === 'mboat') moveBoat(e, dt);
    if (e.type === 'drone') {
      e.phase += dt;
      let tx = p.x, tz = p.z, td = d, speed = 5;
      if (mode === 'night' && d > 26) {
        // Nightwatch drones go for the base unless the helicopter is close.
        tx = BASE.x;
        tz = BASE.z;
        td = dBase;
        speed = dBase > 16 ? 7 : 0;
      }
      if (td < 60 || mode === 'night') {
        e.x += (((tx - e.x) / Math.max(1, td)) * speed + Math.cos(e.phase) * 3) * dt;
        e.z += (((tz - e.z) / Math.max(1, td)) * speed + Math.sin(e.phase) * 3) * dt;
      }
      e.root.x = e.x;
      e.root.z = e.z;
      e.root.y = 11 + Math.sin(time * 2 + e.phase);
      e.y = e.root.y;
    }
    const range = (STATS[e.type] || STATS.turret).range;
    // Nightwatch boats idle around a point offshore and shell the base from there, so their
    // reach at the (large) base is longer than at the helicopter.
    const baseReach = e.goal ? range + 9 : range;
    const aimBase = mode === 'night' && d > 30 && dBase < baseReach + 4;
    const dist = aimBase ? dBase : d;
    const reach = aimBase ? baseReach : range;
    if (dist < (aimBase ? 60 : 50)) {
      e.head.ry = Math.atan2((aimBase ? BASE.x : p.x) - e.x, (aimBase ? BASE.z : p.z) - e.z) - e.root.ry;
      e.cool -= dt;
      if (e.cool <= 0 && dist < reach && (e.type !== 'boss' || unlocked)) enemyFire(e, aimBase);
    }
    if (e.type === 'boss' && unlocked && e.hp < e.max * 0.55 && !bossDrones) {
      bossDrones = true;
      for (let i = 0; i < 2; i++) enemies.push(makeEnemy(['drone' + i, 'drone', e.x + (i ? 9 : -9), e.z + 7]));
      announce('ATLAS has launched two defense drones. Use EMP to interrupt their attack.');
      toast('DEFENSE DRONES INBOUND', 2.5);
    }
  }
}

/* ================================================================ Nightwatch */

function damageBase(amount, x, z) {
  if (state !== 'playing' || mode !== 'night') return;
  night.baseHp = Math.max(0, night.baseHp - amount * 0.35 * tune().base);
  sfx('basehit', x, z);
  shock(x, 2.45, z, 4.5, C.orange, 0.45);
  for (let j = 0; j < 5; j++) particle(x, 3, z, j % 2 ? C.yellow : C.orange, 0.2, 0.5, rnd(-4, 4), rnd(2, 6), rnd(-4, 4));
  particle(x, 3, z, '#5f6a62', 0.7, 1.8, rnd(-0.6, 0.6), 1.6, rnd(-0.6, 0.6), true);
  if (night.hitMsg <= 0) {
    toast('FORWARD BASE UNDER FIRE', 1.6);
    night.hitMsg = 6;
  }
  if (night.baseHp < 50 && !night.warn50) {
    night.warn50 = true;
    announce('Base integrity below fifty percent. Take out the gunboats before they settle in.', 7);
    sfx('warn');
  }
  if (night.baseHp < 25 && !night.warn25) {
    night.warn25 = true;
    announce('The base is falling apart, Thunder One. Everything on the shooters now.', 7);
    sfx('warn');
  }
  if (night.baseHp <= 0) endMission(false, 'The forward base has fallen. Intercept gunboats before they reach firing range, and use EMP on drone swarms.');
}
function startWave(n) {
  night.wave = n;
  night.phase = 'wave';
  const drones = 2 + n;
  const boats = n >= 2 ? 1 + Math.floor((n - 2) / 2) : 0;
  const mboats = n >= 4 ? Math.floor((n - 2) / 2) : 0;
  const q = [];
  let lane = n;
  for (let i = 0; i < boats + mboats; i++) q.push({ type: i < boats ? 'boat' : 'mboat', lane: lane++ % SEA_LANES.length });
  // Interleave drones between the boats so the pressure comes from two directions.
  for (let i = 0; i < drones; i++) q.splice(Math.min(q.length, 1 + i * 2), 0, { type: 'drone' });
  night.queue = q;
  night.spawnT = 0.4;
  sfx('siren');
  const parts = [drones + ' DRONES'];
  if (boats) parts.push(boats + (boats > 1 ? ' GUNBOATS' : ' GUNBOAT'));
  if (mboats) parts.push(mboats + (mboats > 1 ? ' MISSILE BOATS' : ' MISSILE BOAT'));
  toast('WAVE ' + n + ' / ' + parts.join(' · '), 3);
  if (n === 1) announce('Contacts on radar. Drones first. Keep them off the pad.', 6);
  else if (n === 2) announce('Gunboat inbound from the sea. It will stop offshore and shell the base. Sink it before it settles in.', 8);
  else if (n === 4) announce('Missile boats on radar. Their rockets track you, and they can reach the base from further out.', 8);
  else if (n === NIGHT_WAVES) announce('Last wave before dawn. Everything they have left. Hold on, Thunder One.', 8);
  else announce('Wave ' + n + ' inbound. Rearm on the pad between waves.', 6);
}
function spawnNight(item) {
  const hpScale = 1 + 0.06 * (night.wave - 1);
  const id = 'n' + night.wave + '-' + night.serial++;
  let e;
  if (item.type === 'drone') {
    const a = rand() * TAU;
    const x = BASE.x + 25 + Math.cos(a) * 70;
    const z = BASE.z - 15 + Math.sin(a) * 70;
    e = makeEnemy([id, 'drone', x, z], hpScale);
    e.root.x = x;
    e.root.z = z;
  } else {
    const lane = SEA_LANES[item.lane];
    e = makeEnemy([id, item.type, lane.from[0], lane.from[1]], hpScale);
    e.goal = { x: lane.to[0] + rnd(-2.5, 2.5), z: lane.to[1] + rnd(-2.5, 2.5) };
    e.root.ry = Math.atan2(e.goal.x - e.x, e.goal.z - e.z);
  }
  e.cool = rnd(1.5, 3);
  enemies.push(e);
}
function updateNight(dt) {
  night.hitMsg = Math.max(0, night.hitMsg - dt);
  if (night.phase === 'calm') {
    night.between -= dt;
    if (night.between <= 0) startWave(night.wave + 1);
    return;
  }
  if (night.queue.length) {
    night.spawnT -= dt;
    if (night.spawnT <= 0) {
      const item = night.queue.shift();
      spawnNight(item);
      night.spawnT = item.type === 'drone' ? 1.3 : 2.2;
    }
    return;
  }
  for (const e of enemies) if (!e.dead) return;
  // Wave cleared.
  const bonus = 250 * night.wave;
  score += bonus;
  night.baseHp = Math.min(100, night.baseHp + 12);
  if (night.baseHp >= 50) night.warn50 = false;
  if (night.baseHp >= 25) night.warn25 = false;
  sfx('wave');
  input.rumble(0.25, 90);
  if (night.wave >= NIGHT_WAVES) {
    endMission(true);
    return;
  }
  for (const s of supplies) {
    s.taken = false;
    s.progress = 0;
    s.root.visible = true;
  }
  night.phase = 'calm';
  night.between = 14;
  toast('WAVE ' + night.wave + ' HELD / +' + bonus + ' · SUPPLIES DROPPED', 3);
  announce('Wave ' + night.wave + ' turned back. Base crews patched the walls and dropped fresh supply crates. Rearm on the pad.', 8);
}

// Lighting keyframes: the Breakwater day, then dusk → night → dawn for Nightwatch.
const DAY = { sky: [0.72, 0.86, 0.84], ground: [0.21, 0.25, 0.21], sun: [1.4, 1.27, 1.06], fog: [0.13, 0.25, 0.26] };
const ATMO = [
  { at: 0, sky: [0.62, 0.58, 0.66], ground: [0.2, 0.16, 0.16], sun: [1.45, 0.86, 0.56], fog: [0.16, 0.16, 0.22] },
  { at: 0.3, sky: [0.34, 0.42, 0.58], ground: [0.09, 0.11, 0.14], sun: [0.52, 0.6, 0.85], fog: [0.05, 0.09, 0.13] },
  { at: 0.8, sky: [0.32, 0.4, 0.56], ground: [0.08, 0.1, 0.13], sun: [0.48, 0.56, 0.82], fog: [0.045, 0.085, 0.125] },
  { at: 1, sky: [0.7, 0.72, 0.8], ground: [0.22, 0.19, 0.18], sun: [1.5, 1.08, 0.8], fog: [0.2, 0.21, 0.27] },
];
const atmoOut = { sky: [0, 0, 0], ground: [0, 0, 0], sun: [0, 0, 0], fog: [0, 0, 0] };
let atmoShown = -1;
function applyAtmosphere(k) {
  if (k < 0) {
    view.setAtmosphere(DAY.sky, DAY.ground, DAY.sun, DAY.fog);
    return;
  }
  let i = 0;
  while (i < ATMO.length - 2 && k > ATMO[i + 1].at) i++;
  const a = ATMO[i], b = ATMO[i + 1];
  const t = clamp((k - a.at) / (b.at - a.at), 0, 1);
  for (const key of ['sky', 'ground', 'sun', 'fog']) for (let c = 0; c < 3; c++) atmoOut[key][c] = lerp(a[key][c], b[key][c], t);
  view.setAtmosphere(atmoOut.sky, atmoOut.ground, atmoOut.sun, atmoOut.fog);
}
function updateAtmosphere(dt) {
  let want = -1;
  if (mode === 'night' && state !== 'title') {
    const progress = night.phase === 'wave' ? night.wave - 0.5 : night.wave;
    want = state === 'won' ? 1 : clamp(progress / NIGHT_WAVES, 0, 0.97);
    night.atmo += (want - night.atmo) * Math.min(1, dt * 0.35);
    want = night.atmo;
  }
  if (Math.abs(want - atmoShown) > 0.002) {
    atmoShown = want;
    applyAtmosphere(want);
  }
}

/* ================================================================ screens */

const OVERLAYS = ['titleScreen', 'titleShade', 'hud', 'pauseOverlay', 'manualOverlay', 'mapOverlay', 'endOverlay', 'confirmOverlay'];
function clearScreens() {
  for (const id of OVERLAYS) $(id).hidden = true;
  clearNavFocus();
}
function settleInput() {
  input.settle();
  blockFire = true;
}
function refreshTitle() {
  const cp = storage.get('checkpoint');
  $('resumeButton').hidden = !(cp && cp.version === 1);
  $('titleContent').classList.toggle('hasSave', !$('resumeButton').hidden);
  $('standardMode').classList.toggle('selected', difficulty === 'standard');
  $('assistMode').classList.toggle('selected', difficulty === 'assist');
  $('veteranMode').classList.toggle('selected', difficulty === 'veteran');
  const best = storage.get('best');
  $('bestMission').textContent = best && best.score ? best.score.toLocaleString() + ' · ' + best.rank : '—';
  const bn = storage.get('bestNight');
  $('bestNight').textContent = bn && bn.score ? (bn.dawn ? 'DAWN' : 'WAVE ' + bn.waves) + ' · ' + bn.score.toLocaleString() : '—';
}
function showTitle() {
  settleInput();
  clearScreens();
  state = 'title';
  // The title always shows the atoll as it is before a sortie.
  mode = 'mission';
  buildActors('mission');
  clearFX();
  unlocked = bossDrones = false;
  $('titleScreen').hidden = false;
  $('titleShade').hidden = false;
  refreshTitle();
  setStyle('damage', 'opacity', '0');
  heli.root.visible = true;
  Object.assign(p, FRESH);
  cam.x = p.x - 14;
  cam.z = p.z + 13;
  cam.y = 2;
  winch.visible = false;
  updateAudio();
}
function resetRun() {
  clearFX();
  Object.assign(p, FRESH);
  elapsed = score = kills = damageTaken = 0;
  unlocked = bossDrones = won = false;
  navOverride = target = null;
  baseTimer = 0;
  leftBase = false;
  lowFuelWarn = lowHealthWarn = false;
  lastClockWarn = -1;
}
function newMission(skipConfirm = false) {
  if (!skipConfirm && storage.get('checkpoint')) {
    openConfirm('This will replace the current checkpoint.', 'RESTART MISSION', () => newMission(true));
    return;
  }
  storage.del('checkpoint');
  mode = 'mission';
  buildActors('mission');
  resetRun();
  clock = tune().clock;
  startFlight();
  saveCheckpoint(true);
  announce('Thunder One, clear the relays and rescue four engineers. Follow the yellow marker. Hover over the H pad to resupply.', 10);
  banner('SABLE ATOLL / 05:42 LOCAL', 'OPERATION BREAKWATER', 'MAKE EVERY SHOT COUNT.');
}
function newNight() {
  mode = 'night';
  buildActors('night');
  resetRun();
  clock = 0;
  Object.assign(night, { wave: 0, phase: 'calm', between: 9, queue: [], spawnT: 0, baseHp: 100, atmo: 0, hitMsg: 0, warn50: false, warn25: false, serial: 0 });
  atmoShown = -1;
  startFlight();
  announce('Thunder One, the atoll is ours for now. Hold the forward base until dawn. Drones and gunboats are coming.', 9);
  banner('SABLE ATOLL / 19:40 LOCAL', 'OPERATION NIGHTWATCH', 'HOLD THE BASE UNTIL DAWN.');
}
function startFlight() {
  sound.init();
  clearScreens();
  state = 'playing';
  settleInput();
  $('hud').hidden = false;
  heli.root.visible = true;
  winch.visible = false;
  hoverState = null;
  cam.x = p.x;
  cam.z = p.z;
  cam.y = 2;
  setStyle('damage', 'opacity', '0');
  $('bannerTitle').textContent = '';
  setHidden('missionBanner', true);
  bannerTimer = 0;
  uiAccum = 1;
  lastObjectives = '';
  $('hudMission').textContent = mode === 'night' ? '02 / OPERATION NIGHTWATCH' : '01 / OPERATION BREAKWATER';
  $('objectiveTitle').textContent = mode === 'night' ? 'NIGHTWATCH / HOLD THE BASE' : 'MISSION OBJECTIVES';
  $('cargoLabel').textContent = mode === 'night' ? 'HOSTILES DOWN' : 'CREW ON BOARD';
  $('bossHud').classList.toggle('base', mode === 'night');
  kit.canvas.focus({ preventScroll: true });
  if (input.source === 'touch' && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    const pr = document.documentElement.requestFullscreen();
    if (pr && pr.catch) pr.catch(() => {});
  }
  if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
}
function saveCheckpoint(quiet = false) {
  if (mode !== 'mission') return;
  const data = {
    version: 1,
    difficulty,
    clock,
    elapsed,
    score,
    kills,
    damageTaken,
    p: { ...p, vx: 0, vz: 0, hurt: 0, heat: 0, overheat: false },
    enemies: enemies.filter((e) => e.type !== 'drone').map((e) => ({ id: e.id, hp: e.hp })),
    camps: camps.map((c) => c.rescued),
    supplies: supplies.map((s) => s.taken),
    unlocked,
    bossDrones: false,
  };
  const ok = storage.set('checkpoint', data);
  if (ok && !quiet) toast('BASE CHECKPOINT SAVED', 2);
  if (!ok && !quiet) toast('CHECKPOINT SAVED FOR THIS SESSION ONLY', 3);
}
function loadCheckpoint() {
  const cp = storage.get('checkpoint');
  if (!cp || cp.version !== 1) {
    newMission(true);
    return;
  }
  mode = 'mission';
  buildActors('mission');
  resetRun();
  if (TUNING[cp.difficulty]) difficulty = cp.difficulty;
  Object.assign(p, cp.p, { x: BASE.x, z: BASE.z, y: 11, vx: 0, vz: 0, hurt: 0, heat: 0, overheat: false });
  clock = cp.clock;
  elapsed = cp.elapsed || 0;
  score = cp.score || 0;
  kills = cp.kills || 0;
  damageTaken = cp.damageTaken || 0;
  for (const saved of cp.enemies || []) {
    const e = enemies.find((x) => x.id === saved.id);
    if (e) {
      e.hp = saved.hp;
      e.dead = e.hp <= 0;
      e.root.visible = !e.dead;
      if (e.dead) addWreck(e);
    }
  }
  camps.forEach((c, i) => {
    c.rescued = (cp.camps && cp.camps[i]) || 0;
    c.people.forEach((h, j) => (h.root.visible = j >= c.rescued));
  });
  supplies.forEach((s, i) => {
    s.taken = !!(cp.supplies && cp.supplies[i]);
    s.root.visible = !s.taken;
  });
  unlocked = !!cp.unlocked;
  boss.shield.visible = !unlocked;
  boss.shieldRing.visible = !unlocked;
  startFlight();
  announce('Base checkpoint restored. Your aircraft is ready. Continue the mission.', 6);
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  $('pauseOverlay').hidden = false;
  $('pauseText').textContent = mode === 'night' ? 'Nightwatch is on hold. The next wave waits for you.' : 'The mission clock has stopped.';
  $('pauseNote').hidden = mode === 'night';
  $('restartMission').textContent = mode === 'night' ? 'RESTART NIGHTWATCH' : 'RESTART MISSION';
  updateAudio();
}
function resumeGame() {
  if (state !== 'paused' && state !== 'map') return;
  $('pauseOverlay').hidden = true;
  $('mapOverlay').hidden = true;
  clearNavFocus();
  state = 'playing';
  settleInput();
  kit.canvas.focus({ preventScroll: true });
  sound.init();
}
function openMap() {
  if (state === 'map') {
    resumeGame();
    return;
  }
  if (state !== 'playing') return;
  state = 'map';
  $('mapOverlay').hidden = false;
  const nightMode = mode === 'night';
  $('mapEyebrow').textContent = nightMode ? 'NIGHTWATCH / PAUSED' : 'TACTICAL OVERVIEW / CLOCK PAUSED';
  $('mapBrief').textContent = nightMode
    ? 'Hold the forward base until dawn. Gunboats stop offshore to shell it; drones swarm the pad. Crates restock after every wave.'
    : "Disable the island's shield network. Rescue the engineers for the access codes. Then stop ATLAS before it launches.";
  curNav = getNav();
  drawMap(bigCtx, $('bigmap'), true);
  updateObjectives();
  updateAudio();
}
function openManual() {
  if (state === 'playing') pauseGame();
  fillManual();
  $('manualOverlay').hidden = false;
  clearNavFocus();
}
function closeManual() {
  $('manualOverlay').hidden = true;
  clearNavFocus();
}
function openConfirm(text, yesLabel, action) {
  $('confirmText').textContent = text;
  $('confirmYes').innerHTML = yesLabel + ' <span class="arr">→</span>';
  confirmAction = action;
  $('confirmOverlay').hidden = false;
  clearNavFocus();
}
function closeConfirm() {
  $('confirmOverlay').hidden = true;
  confirmAction = null;
  clearNavFocus();
}
function stat(label, value) {
  return `<div class="stat"><small>${label}</small><b>${value}</b></div>`;
}
function endMission(success, reason = '') {
  if (state !== 'playing') return;
  won = success;
  state = success ? 'won' : 'lost';
  $('hoverInfo').hidden = true;
  winch.visible = false;
  clearScreens();
  $('hud').hidden = false;
  $('endOverlay').hidden = false;
  let rank = 'C';
  if (mode === 'night') {
    const held = success ? NIGHT_WAVES : night.phase === 'calm' ? night.wave : Math.max(0, night.wave - 1);
    if (success) {
      score += Math.round(night.baseHp * 20 + p.hp * 10);
      rank = night.baseHp >= 75 && damageTaken < 150 ? 'S' : night.baseHp >= 50 ? 'A' : night.baseHp >= 25 ? 'B' : 'C';
      $('endEyebrow').textContent = 'NIGHTWATCH COMPLETE / DAWN';
      $('endTitle').textContent = 'The base held.';
      $('endText').textContent = 'Eight waves turned back in the dark. The relief convoy is on the horizon, and the pad lights are still on.';
      sfx('rescue');
    } else {
      $('endEyebrow').textContent = 'NIGHTWATCH FAILED';
      $('endTitle').textContent = p.hp <= 0 ? 'Aircraft lost.' : 'Base overrun.';
      $('endText').textContent = reason;
    }
    $('endStats').innerHTML = stat('WAVES HELD', held + ' / ' + NIGHT_WAVES) + stat(success ? 'BASE' : 'HOSTILES DOWN', success ? Math.ceil(night.baseHp) + '%' : kills) + stat('SCORE', score.toLocaleString());
    let best = storage.get('bestNight') || { score: 0, waves: 0 };
    if (score > (best.score || 0)) {
      best = { score, waves: held, dawn: success, rank: success ? rank : '—', difficulty };
      storage.set('bestNight', best);
    }
    $('endRetry').innerHTML = (success ? 'FLY AGAIN' : 'TRY AGAIN') + ' <span class="arr">↗</span>';
    $('bestScore').textContent = 'BEST NIGHTWATCH / ' + (best.score || 0).toLocaleString() + ' · ' + (best.dawn ? 'DAWN' : 'WAVE ' + best.waves) + ' · ' + String(best.difficulty || difficulty).toUpperCase();
  } else if (success) {
    score += Math.round(clock * 8 + p.hp * 10);
    rank = damageTaken < 70 && elapsed < 300 ? 'S' : damageTaken < 160 ? 'A' : damageTaken < 300 ? 'B' : 'C';
    storage.del('checkpoint');
    let best = storage.get('best') || { score: 0 };
    if (score > best.score) {
      best = { score, rank, difficulty, time: elapsed };
      storage.set('best', best);
    }
    $('endEyebrow').textContent = 'MISSION COMPLETE / LAUNCH ABORTED';
    $('endTitle').textContent = 'Island clear.';
    $('endText').textContent = 'ATLAS is destroyed. All four engineers are home. A small helicopter made a big difference.';
    $('endStats').innerHTML = stat('FLIGHT TIME', formatTime(elapsed)) + stat('CREW SAVED', '4 / 4') + stat('SCORE', score.toLocaleString());
    $('endRetry').innerHTML = 'FLY AGAIN <span class="arr">↗</span>';
    $('bestScore').textContent = 'BEST SCORE / ' + best.score.toLocaleString() + ' · RANK ' + best.rank + ' · ' + String(best.difficulty).toUpperCase();
    sfx('rescue');
  } else {
    $('endEyebrow').textContent = 'MISSION FAILED';
    $('endTitle').textContent = p.hp <= 0 ? 'Aircraft lost.' : 'Launch window missed.';
    $('endText').textContent = reason;
    $('endStats').innerHTML = stat('FLIGHT TIME', formatTime(elapsed)) + stat('RELAYS DOWN', relayCount() + ' / 3') + stat('CREW RESCUED', rescuedCount() + ' / 4');
    $('endRetry').innerHTML = 'RETRY CHECKPOINT <span class="arr">↗</span>';
    $('bestScore').textContent = 'Retry from the last base checkpoint. The launch clock also resets to that checkpoint.';
  }
  if (!success && p.hp <= 0) {
    explosion(p.x, p.y, p.z, true);
    heli.root.visible = false;
    input.rumble(1, 400);
  }
  $('rankBadge').textContent = success ? rank : '×';
  updateAudio();
}
function formatTime(s) {
  s = Math.max(0, Math.ceil(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/* ================================================================ hover actions: base, rescue, supplies */

function updateHover(dt) {
  hoverState = null;
  winch.visible = false;
  const speed = hypot(p.vx, p.vz);
  const baseDistance = hypot(p.x - BASE.x, p.z - BASE.z);
  if (baseDistance > 11) leftBase = true;
  if (baseDistance < 6.6) {
    if (speed < 2.8) {
      baseTimer += dt;
      p.hp = Math.min(100, p.hp + 22 * dt);
      p.fuel = Math.min(100, p.fuel + 28 * dt);
      p.ammo = Math.min(800, p.ammo + 210 * dt);
      p.rockets = Math.min(18, p.rockets + 5 * dt);
      p.heat = Math.max(0, p.heat - dt * 0.6);
      if (p.hp > 50) lowHealthWarn = false;
      if (p.fuel > 50) lowFuelWarn = false;
      hoverState = { text: 'FIELD SERVICE / REPAIR · REFUEL · REARM', progress: Math.min(1, baseTimer / 4) };
      if (baseTimer > 1.4 && p.cargo > 0) {
        const c = p.cargo;
        p.delivered += c;
        p.cargo = 0;
        toast(c + (c > 1 ? ' ENGINEERS' : ' ENGINEER') + ' SAFE AT BASE', 2.5);
        sfx('rescue');
      }
      if (mode === 'mission' && boss.dead && p.delivered === 4 && baseTimer > 2.4) {
        endMission(true);
        return;
      }
      if (mode === 'mission' && baseTimer > 4 && leftBase) {
        leftBase = false;
        saveCheckpoint();
        announce('Aircraft serviced. Checkpoint saved. You are cleared to return to the mission.', 5);
      }
    } else {
      baseTimer = 0;
      hoverState = { text: 'HOLD POSITION FOR FIELD SERVICE', progress: 0 };
    }
    return;
  }
  baseTimer = 0;
  for (const c of camps) {
    if (c.rescued >= 2) continue;
    const d = hypot(p.x - c.x, p.z - c.z);
    if (d < 6) {
      const guarded = enemies.some((e) => !e.dead && e.type !== 'relay' && e.type !== 'boss' && hypot(e.x - c.x, e.z - c.z) < 17);
      if (guarded) {
        hoverState = { text: 'RESCUE ZONE / CLEAR NEARBY HOSTILES', progress: 0 };
        c.progress = 0;
      } else if (speed > 2.8) {
        hoverState = { text: 'RELEASE FLIGHT CONTROL TO LOWER WINCH', progress: 0 };
        c.progress = 0;
      } else {
        c.progress += dt;
        hoverState = { text: 'WINCH ACTIVE / ENGINEER ' + (rescuedCount() + 1) + ' OF 4', progress: c.progress / 2.65 };
        winch.visible = true;
        const bottom = 2.3 + Math.max(0, c.progress - 1.1) * 5;
        winch.x = p.x;
        winch.z = p.z;
        winch.y = (p.y - 1 + bottom) / 2;
        winch.sy = Math.max(0.1, p.y - 1 - bottom);
        c.people[c.rescued].root.y = Math.max(0, c.progress - 1.1) * 5;
        if (c.progress >= 2.65) {
          c.people[c.rescued].root.visible = false;
          c.people[c.rescued].root.y = 0;
          c.rescued++;
          c.progress = 0;
          p.cargo++;
          score += 300;
          sfx('rescue');
          input.rumble(0.25, 80);
          toast('ENGINEER ON BOARD / ' + rescuedCount() + ' OF 4', 2);
          if (rescuedCount() === 4) announce('All four engineers are on board. Their access codes will disable the shield once all relays are down.', 8);
          checkUnlock();
        }
      }
      if (c.progress === 0 && c.rescued < 2) c.people[c.rescued].root.y = 0;
      return;
    }
    c.progress = 0;
    if (c.rescued < 2) c.people[c.rescued].root.y = 0;
  }
  for (const s of supplies) {
    if (s.taken) continue;
    const d = hypot(p.x - s.x, p.z - s.z);
    if (d < 4.5) {
      const needed = s.type === 'fuel' ? p.fuel < 97 : s.type === 'ammo' ? p.ammo < 750 || p.rockets < 17 : p.hp < 98;
      if (!needed) {
        hoverState = { text: s.type.toUpperCase() + ' SUPPLY / ALREADY FULL', progress: 1 };
        return;
      }
      if (speed < 2.8) {
        s.progress += dt;
        hoverState = { text: 'COLLECTING ' + s.type.toUpperCase() + ' / HOLD POSITION', progress: s.progress / 1.25 };
        if (s.progress > 1.25) {
          s.taken = true;
          s.root.visible = false;
          score += 50;
          if (s.type === 'fuel') p.fuel = Math.min(100, p.fuel + 65);
          if (s.type === 'ammo') {
            p.ammo = Math.min(800, p.ammo + 400);
            p.rockets = Math.min(18, p.rockets + 7);
          }
          if (s.type === 'repair') p.hp = Math.min(100, p.hp + 65);
          sfx('rescue');
          toast(s.type.toUpperCase() + ' SUPPLY COLLECTED', 2);
          shock(s.x, 2.4, s.z, 5, C.cyan, 0.5);
        }
      } else {
        s.progress = 0;
        hoverState = { text: 'HOVER TO COLLECT ' + s.type.toUpperCase(), progress: 0 };
      }
      return;
    }
    s.progress = 0;
  }
}

/* ================================================================ simulation step */

function updateGame(dt) {
  if (state !== 'playing') return;
  elapsed += dt;
  if (mode === 'mission') {
    clock -= dt;
    if (clock <= 0 && !boss.dead) {
      clock = 0;
      endMission(false, 'ATLAS has launched. Move faster, use missiles on hard targets, and boost between objectives.');
      return;
    }
    if (boss.dead) clock = Math.max(0, clock);
  } else {
    updateNight(dt);
    if (state !== 'playing') return;
  }
  p.hurt = Math.max(0, p.hurt - dt);
  p.gunCD = Math.max(0, p.gunCD - dt);
  p.rocketCD = Math.max(0, p.rocketCD - dt);
  p.emp = Math.max(0, p.emp - dt);
  dryMessage = Math.max(0, dryMessage - dt);
  // Screen-relative isometric flight: right is south-east, up is north-west.
  const sx = ctl.sx;
  const sy = ctl.sy;
  const len = hypot(sx, sy);
  const boost = ctl.boost && len > 0.15 && p.fuel > 0;
  let topSpeed = boost ? 23 : 14;
  if (p.fuel <= 0) topSpeed *= 0.3;
  const tx = (sx + sy) * Math.SQRT1_2 * topSpeed;
  const tz = (sy - sx) * Math.SQRT1_2 * topSpeed;
  const damp = 1 - Math.exp(-dt * (len > 0.1 ? 4.2 : 7));
  p.vx = lerp(p.vx, tx, damp);
  p.vz = lerp(p.vz, tz, damp);
  p.x = clamp(p.x + p.vx * dt, -88, 88);
  p.z = clamp(p.z + p.vz * dt, -94, 81);
  const sp = hypot(p.vx, p.vz);
  let desiredY = landHeight(p.x, p.z) + 9;
  for (const e of enemies)
    if (!e.dead && ((e.type === 'relay' && hypot(p.x - e.x, p.z - e.z) < 5) || (e.type === 'boss' && hypot(p.x - e.x, p.z - e.z) < 9))) desiredY = Math.max(desiredY, e.type === 'boss' ? 16 : 14);
  p.y = lerp(p.y, desiredY + Math.sin(time * 2.7) * 0.15, 1 - Math.exp(-dt * 3));
  p.fuel = Math.max(0, p.fuel - dt * (0.14 + sp * 0.01 + (boost ? 0.16 : 0)));
  if (p.fuel <= 0) {
    p.hp = Math.max(0, p.hp - dt * 15);
    if (dryMessage <= 0) {
      toast('FUEL EMPTY / ENGINE FAILURE', 2);
      dryMessage = 3;
    }
    if (p.hp <= 0) {
      endMission(false, 'The fuel tank is empty. Collect green fuel crates or return to the H pad.');
      return;
    }
  } else if (p.fuel < 25 && !lowFuelWarn) {
    lowFuelWarn = true;
    announce('Fuel is below 25 percent. Collect a green supply crate or return to base.');
    sfx('warn');
  }
  target = selectTarget();
  const firing = ctl.fire;
  let angle = p.yaw;
  if (firing && target) angle = Math.atan2(target.x - p.x, target.z - p.z);
  else if (sp > 1.2) angle = Math.atan2(p.vx, p.vz);
  const diff = ((((angle - p.yaw + PI) % TAU) + TAU) % TAU) - PI;
  p.yaw += diff * (1 - Math.exp(-dt * 9));
  if (firing) fireCannon();
  p.heat = Math.max(0, p.heat - dt * (firing && !p.overheat ? 0.035 : 0.3));
  if (p.overheat && p.heat < 0.32) {
    p.overheat = false;
    toast('CANNON READY', 1);
  }
  updateEnemies(dt);
  updateProjectiles(dt);
  if (state !== 'playing') return;
  updateHover(dt);
  if (state !== 'playing') return;
  if (navOverride && navOverride.custom && hypot(p.x - navOverride.x, p.z - navOverride.z) < 3.6) {
    navOverride = null;
    toast('FLIGHT MARKER REACHED', 1.5);
  }
  fxAccum += dt;
  if (fxAccum > 0.12) {
    fxAccum = 0;
    for (const c of camps) if (c.rescued < 2 && hypot(c.x - p.x, c.z - p.z) < 58) particle(c.x, 2.5, c.z - 2, '#87d8c1', 0.28, 1.7, rnd(-0.4, 0.4), 1.4, rnd(-0.4, 0.4), true);
    if (boost) particle(p.x - Math.sin(p.yaw) * 2, p.y, p.z - Math.cos(p.yaw) * 2, '#d7dac0', 0.2, 0.65, -p.vx * 0.12, 0.3, -p.vz * 0.12, true);
    if (p.hp < 30) particle(p.x, p.y, p.z, '#586159', 0.4, 1.8, 0, 1, 0, true);
  }
  if (mode === 'mission' && clock < 60 && !boss.dead && Math.floor(clock) % 10 === 0 && Math.floor(clock) !== lastClockWarn) {
    lastClockWarn = Math.floor(clock);
    sfx('warn');
  }
}

function animateActors(dt) {
  heli.root.x = p.x;
  heli.root.y = p.y;
  heli.root.z = p.z;
  heli.root.ry = p.yaw;
  const vx = p.vx, vz = p.vz;
  heli.body.rx = lerp(heli.body.rx, (vx * Math.sin(p.yaw) + vz * Math.cos(p.yaw)) * 0.008, Math.min(1, dt * 6));
  heli.body.rz = lerp(heli.body.rz, -(vx * Math.cos(p.yaw) - vz * Math.sin(p.yaw)) * 0.01, Math.min(1, dt * 6));
  heli.rotor.ry = time * 33;
  heli.tailRotor.ry = time * 43;
  const ground = landHeight(p.x, p.z);
  downwash.x = p.x;
  downwash.z = p.z;
  downwash.y = ground + 0.065;
  downwash.sx = downwash.sz = 5.8 + Math.sin(time * 7) * 0.25;
  downwash.alpha = ground < 1 ? 0.12 : 0.06;
  downwash.ry = time * 0.7;
  downwash.col = color(ground < 1 ? C.cyan : C.sand);
  const t = Math.floor(time * 10) / 10;
  for (const c of camps) {
    for (const h of c.people) {
      if (!h.root.visible) continue;
      h.hands[1].y = 1.1 + Math.sin(t * 5 + h.index * 2) * 0.24;
      h.hands[1].x = 0.5 + Math.cos(t * 5) * 0.07;
      h.feet[0].z = 0.05 + Math.sin(t * 3) * 0.08;
      h.feet[1].z = 0.05 - Math.sin(t * 3) * 0.08;
      h.root.ry = Math.atan2(p.x - c.x, p.z - c.z);
    }
  }
  for (const s of supplies) if (!s.taken) s.root.y = 2.3 + Math.sin(time * 2 + s.x) * 0.055;
}

/* ================================================================ camera */

const cam = { x: -60, y: 2, z: 49, eye: [0, 0, 0], at: [0, 0, 0], halfH: 30, halfW: 50 };
function updateCamera(dt, instant = false) {
  const title = state === 'title';
  const wantX = title ? p.x - 16 : p.x + p.vx * 0.23;
  const wantZ = title ? p.z + 13 : p.z + p.vz * 0.23;
  const f = instant ? 1 : 1 - Math.exp(-dt * (title ? 2 : 5));
  cam.x = lerp(cam.x, wantX, f);
  cam.z = lerp(cam.z, wantZ, f);
  cam.y = lerp(cam.y, title ? 3 : 3.1, f);
  const width = kit.size.width;
  const height = kit.size.height;
  const aspect = width / height;
  cam.halfH = title ? (aspect < 1 ? 40 : 29) : aspect < 1 ? 45 : height < 540 ? 25 : 28;
  cam.halfW = cam.halfH * aspect;
  // With touch controls the view shifts so the helicopter sits above the thumbs.
  const shift = touchUI() && !title ? 2.5 : 0;
  const at = cam.at;
  at[0] = cam.x + shift;
  at[1] = cam.y;
  at[2] = cam.z + shift;
  if (motion && cameraShake > 0.01) {
    at[0] += (Math.random() - 0.5) * cameraShake;
    at[1] += (Math.random() - 0.5) * cameraShake * 0.5;
    at[2] += (Math.random() - 0.5) * cameraShake;
  }
  cameraShake = Math.max(0, cameraShake - dt * 2.4);
  cam.eye[0] = at[0] + 64;
  cam.eye[1] = at[1] + 79;
  cam.eye[2] = at[2] + 64;
  view.setView(cam.eye, at, cam.halfW, cam.halfH, cam.x, cam.z);
}
const touchUI = () => !!(kit.touch && kit.touch.visible);

/* ================================================================ navigation and objectives */

function nearest(list) {
  return list.reduce((a, b) => (!a || hypot(b.x - p.x, b.z - p.z) < hypot(a.x - p.x, a.z - p.z) ? b : a), null);
}
function navFor(kind) {
  if (mode === 'night') {
    if (kind === 2 || kind === 1) {
      let best = null, bd = Infinity;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = hypot(e.x - BASE.x, e.z - BASE.z) + (e.type === 'drone' ? 12 : 0);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best) return { x: best.x, z: best.z, y: best.y + 1, label: LABELS[best.type] || 'HOSTILE', num: '!', ref: best };
      if (kind === 2) return null;
    }
    if (kind === 4) {
      const s = nearest(supplies.filter((x) => !x.taken));
      return s ? { x: s.x, z: s.z, y: 4, label: s.type.toUpperCase() + ' CRATE', num: '+', ref: s } : null;
    }
    return { x: BASE.x, z: BASE.z, y: 5, label: 'FORWARD BASE', num: 'H' };
  }
  if (kind === 1) {
    const e = nearest(enemies.filter((x) => x.type === 'relay' && !x.dead));
    return e ? { x: e.x, z: e.z, y: 13, label: 'SHIELD RELAY', num: '1', ref: e } : null;
  }
  if (kind === 2) {
    const c = nearest(camps.filter((x) => x.rescued < 2));
    return c ? { x: c.x, z: c.z, y: 7, label: 'RESCUE CREW', num: '2', ref: c } : null;
  }
  if (kind === 3) return !boss.dead ? { x: boss.x, z: boss.z, y: 15, label: unlocked ? 'ATLAS' : 'ATLAS / SHIELDED', num: '3', ref: boss } : null;
  return { x: BASE.x, z: BASE.z, y: 5, label: 'RETURN TO BASE', num: 'H' };
}
function getNav() {
  if (navOverride) {
    const r = navOverride.ref;
    if (r && (r.dead || r.rescued === 2 || r.taken)) navOverride = null;
    else return navOverride;
  }
  if (mode === 'night') return navFor(1);
  if (boss.dead) return navFor(4);
  const candidates = [];
  if (relayCount() < 3) candidates.push(navFor(1));
  if (rescuedCount() < 4) candidates.push(navFor(2));
  if (candidates.length) return nearest(candidates.filter(Boolean));
  return navFor(3);
}
function setObjective(n) {
  const v = navFor(n);
  if (v) {
    navOverride = v;
    toast('FLIGHT MARKER / ' + v.label, 1.5);
  } else toast(mode === 'night' ? 'NO CONTACTS' : 'OBJECTIVE COMPLETE', 1.4);
  curNav = getNav();
}
let lastObjectives = '';
function updateObjectives() {
  let key, rows, line;
  if (mode === 'night') {
    const left = hostilesLeft();
    const crates = supplies.reduce((a, s) => a + (s.taken ? 0 : 1), 0);
    const hp = Math.ceil(night.baseHp);
    const waveText = night.phase === 'calm' ? (night.wave ? night.wave + ' HELD' : 'STANDBY') : night.wave + ' / ' + NIGHT_WAVES;
    key = ['n', hp, left, night.wave, night.phase, crates].join();
    rows = [
      ['Hold the forward base', hp + '%', false, 3],
      ['Destroy the wave', night.phase === 'calm' ? 'CLEAR' : left + ' LEFT', night.phase === 'calm' && night.wave > 0, 2],
      ['Hold until dawn', waveText, false, 3],
      ['Supply crates', crates + ' LEFT', crates === 0, 4],
    ];
    line = 'WAVE ' + Math.max(1, night.wave) + '/' + NIGHT_WAVES + '  ·  HOSTILES ' + left + '  ·  BASE ' + hp + '%';
  } else {
    const r = relayCount(), c = rescuedCount(), b = boss.dead;
    key = ['m', r, c, b, p.delivered, unlocked].join();
    rows = [
      ['Cut the shield network', r + ' / 3', r === 3, 1],
      ['Rescue the engineers', c + ' / 4', c === 4, 2],
      ['Destroy ATLAS', b ? 'CLEAR' : unlocked ? 'EXPOSED' : 'LOCKED', b, 3],
      ['Return crew to base', p.delivered + ' / 4', p.delivered === 4 && b, 4],
    ];
    line = b ? '04 / ATLAS DESTROYED. RETURN TO THE H PAD.' : unlocked ? '03 / SHIELD DOWN. DESTROY THE LAUNCH VEHICLE.' : 'RELAYS ' + r + '/3  ·  CREW ' + c + '/4  ·  SHIELD ACTIVE';
  }
  if (key !== lastObjectives) {
    lastObjectives = key;
    const html = rows
      .map(
        (o, i) =>
          `<button class="objrow ${o[2] ? 'done' : ''}" data-objective="${o[3]}"><span class="objnum">${o[2] ? '✓' : String(i + 1).padStart(2, '0')}</span><span>${o[0]}</span><span class="count">${o[1]}</span></button>`
      )
      .join('');
    $('taskRows').innerHTML = html;
    $('mapTasks').innerHTML = html;
  }
  setText('activeObjective', line);
}

/* ================================================================ HUD */

// Cached DOM writes: only touch an element when its value changes.
const els = {};
const E = (id) => els[id] || (els[id] = $(id));
function setText(id, v) {
  const el = E(id);
  const s = String(v);
  if (el._t !== s) {
    el._t = s;
    el.textContent = s;
  }
}
function setStyle(id, prop, v) {
  const el = E(id);
  const k = '_s' + prop;
  if (el[k] !== v) {
    el[k] = v;
    el.style[prop] = v;
  }
}
function setHidden(id, h) {
  const el = E(id);
  if (el.hidden !== h) el.hidden = h;
}
let lastEmpLabel = '';
function updateHUD(dt) {
  radioTimer = Math.max(0, radioTimer - dt);
  toastTimer = Math.max(0, toastTimer - dt);
  if (!toastTimer) E('toast').classList.remove('show');
  setStyle('radio', 'opacity', radioTimer > 0 ? '1' : '0');
  if (bannerTimer > 0) {
    bannerTimer -= dt;
    setStyle('missionBanner', 'opacity', String(bannerTimer < 1 ? Math.max(0, bannerTimer).toFixed(2) : 1));
    if (bannerTimer <= 0) setHidden('missionBanner', true);
  }
  setText('armorText', Math.ceil(p.hp));
  setText('fuelText', Math.ceil(p.fuel));
  setStyle('armorBar', 'width', Math.round(p.hp) + '%');
  setStyle('armorBar', 'background', p.hp < 26 ? 'var(--red)' : 'var(--cyan)');
  setStyle('fuelBar', 'width', Math.round(p.fuel) + '%');
  setStyle('fuelBar', 'background', p.fuel < 25 ? 'var(--red)' : 'var(--yellow)');
  setText('ammoText', Math.floor(p.ammo).toString().padStart(3, '0'));
  setText('rocketText', Math.floor(p.rockets).toString().padStart(2, '0'));
  const empLabel = p.emp > 0 ? Math.ceil(p.emp) + 's' : 'RDY';
  setText('empText', empLabel);
  if (empLabel !== lastEmpLabel) {
    lastEmpLabel = empLabel;
    kit.touch?.setLabel('emp', touchLabel('ϟ', p.emp > 0 ? Math.ceil(p.emp) + 's' : 'EMP'));
  }
  setStyle('heatBar', 'width', Math.round(p.heat * 100) + '%');
  setStyle('heatBar', 'background', p.overheat ? 'var(--red)' : 'var(--yellow)');
  if (mode === 'night') {
    setText('cargoText', kills);
    const calm = night.phase === 'calm';
    if (calm && night.wave >= NIGHT_WAVES) {
      setText('clockLabel', 'DAWN');
      setText('timer', 'SAFE');
    } else if (calm) {
      setText('clockLabel', 'WAVE ' + (night.wave + 1) + ' IN');
      setText('timer', formatTime(night.between));
    } else {
      setText('clockLabel', 'WAVE ' + night.wave + ' / ' + NIGHT_WAVES + ' · HOSTILES');
      setText('timer', String(hostilesLeft()).padStart(2, '0'));
    }
    setStyle('timer', 'color', calm ? 'var(--cyan)' : 'var(--paper)');
    setHidden('bossHud', false);
    const hp = Math.ceil(night.baseHp);
    setText('bossLabel', 'FORWARD BASE / INTEGRITY ' + hp + '%');
    setStyle('bossHp', 'width', hp + '%');
    E('bossHud').classList.toggle('low', hp < 35);
  } else {
    setText('cargoText', p.cargo + ' / 4');
    setText('clockLabel', 'LAUNCH IN');
    setText('timer', boss.dead ? 'SAFE' : formatTime(clock));
    setStyle('timer', 'color', boss.dead ? 'var(--cyan)' : clock < 90 ? 'var(--red)' : 'var(--paper)');
    setHidden('bossHud', boss.dead || hypot(boss.x - p.x, boss.z - p.z) > 49);
    setStyle('bossHp', 'width', Math.round((boss.hp / boss.max) * 100) + '%');
    setText('bossLabel', unlocked ? 'ATLAS / LAUNCH VEHICLE' : 'ATLAS / SHIELD ACTIVE');
  }
  let heading = ((Math.atan2(p.vx, -p.vz) * 180) / PI + 360) % 360;
  if (hypot(p.vx, p.vz) < 1) heading = (((PI - p.yaw) * 180) / PI + 360) % 360;
  setText('heading', 'N · ' + Math.round(heading).toString().padStart(3, '0') + '° · E');
  setText('miniCoords', 'X ' + Math.round(p.x * 10) + ' / Z ' + Math.round(p.z * 10));
  curNav = getNav();
  if (curNav) {
    setText('navNumber', curNav.num || '+');
    const nx = curNav.ref ? curNav.ref.x : curNav.x;
    const nz = curNav.ref ? curNav.ref.z : curNav.z;
    setText('navLabel', curNav.label + ' / ' + Math.round(hypot(nx - p.x, nz - p.z) * 10) + ' M');
  }
  setHidden('hoverInfo', !hoverState);
  if (hoverState) {
    setText('hoverText', hoverState.text);
    setStyle('hoverProgress', 'width', Math.round(clamp(hoverState.progress * 100, 0, 100)) + '%');
  }
  const dmg = state === 'playing' ? Math.max(p.hurt * 2, p.hp < 26 ? 0.12 + Math.sin(time * 5) * 0.06 : 0) : 0;
  setStyle('damage', 'opacity', dmg.toFixed(2));
  updateObjectives();
  drawMap(miniCtx, E('minimap'), false);
}
/** Marker and reticle follow the world every frame (cheap transforms, no layout). */
function updateMarkers() {
  const width = kit.size.width;
  const height = kit.size.height;
  const nav = curNav;
  if (nav) {
    setHidden('navMark', false);
    const nx = nav.ref ? nav.ref.x : nav.x;
    const nz = nav.ref ? nav.ref.z : nav.z;
    const q = view.project(nx, nav.y || 3, nz);
    const touch = touchUI();
    const small = width < 620;
    const minY = small ? 170 : 90;
    const maxY = height - (touch ? 180 : 120);
    const minX = 30;
    const maxX = width - 30;
    const off = q.x < minX || q.x > maxX || q.y < minY || q.y > maxY;
    let x = clamp(q.x, minX, maxX);
    let y = clamp(q.y, minY, Math.max(minY + 20, maxY));
    if (x > width - (small ? 125 : 180) && y < (small ? 310 : 280)) y = Math.min(small ? 340 : 298, maxY);
    if (!touch && x < 243 && y < 350) x = 258;
    setStyle('navMark', 'transform', 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) translate(-50%,-50%)');
    setStyle('navArrow', 'display', off ? 'block' : 'none');
    if (off) setStyle('navArrow', 'transform', 'rotate(' + Math.round((Math.atan2(q.y - height / 2, q.x - width / 2) * 180) / PI + 90) + 'deg)');
  } else setHidden('navMark', true);
  if (target && !target.dead) {
    const q = view.project(target.x, target.y, target.z);
    const hidden = q.x < 0 || q.x > width || q.y < 0 || q.y > height;
    setHidden('targetReticle', hidden);
    if (!hidden) setStyle('targetReticle', 'transform', 'translate(' + Math.round(q.x - 21) + 'px,' + Math.round(q.y - 21) + 'px)');
    setStyle('targetHp', 'width', Math.round((target.hp / target.max) * 100) + '%');
  } else setHidden('targetReticle', true);
}

const miniCtx = $('minimap').getContext('2d');
const bigCtx = $('bigmap').getContext('2d');
function drawMap(ctx, c, big) {
  const s = c.width;
  const scale = s / 200;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#102e36';
  ctx.fillRect(0, 0, s, s);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(100, 100);
  ctx.lineWidth = big ? 0.3 : 0.5;
  ctx.strokeStyle = 'rgba(152,195,177,.10)';
  ctx.beginPath();
  for (let i = -100; i <= 100; i += 20) {
    ctx.moveTo(i, -100);
    ctx.lineTo(i, 100);
    ctx.moveTo(-100, i);
    ctx.lineTo(100, i);
  }
  ctx.stroke();
  for (const island of islands) {
    ctx.beginPath();
    island.poly.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
    ctx.closePath();
    ctx.fillStyle = '#41635a';
    ctx.fill();
    ctx.strokeStyle = '#9cab83';
    ctx.lineWidth = big ? 0.55 : 1.1;
    ctx.stroke();
  }
  ctx.strokeStyle = '#607871';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const [a, b] of BRIDGES) {
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  for (const su of supplies) {
    if (su.taken) continue;
    ctx.fillStyle = su.type === 'fuel' ? '#86b17a' : su.type === 'ammo' ? '#edc361' : '#eee6ce';
    const k = big ? 1.7 : 1.9;
    ctx.fillRect(su.x - k / 2, su.z - k / 2, k, k);
  }
  for (const e of enemies) {
    if (e.dead) continue;
    ctx.save();
    ctx.translate(e.x, e.z);
    if (e.type === 'relay') {
      ctx.strokeStyle = '#f7d36a';
      ctx.lineWidth = big ? 0.7 : 1.5;
      ctx.rotate(PI / 4);
      ctx.strokeRect(-2, -2, 4, 4);
    } else if (e.type === 'boss') {
      ctx.fillStyle = unlocked ? '#f58264' : '#92c9c4';
      ctx.fillRect(-2.7, -3.6, 5.4, 7.2);
      ctx.strokeStyle = '#db765c';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(-4, -5, 8, 10);
    } else if (e.type === 'boat' || e.type === 'mboat') {
      ctx.rotate(-e.root.ry);
      ctx.fillStyle = e.stun > 0 ? '#91e4d3' : '#e57e66';
      ctx.beginPath();
      ctx.moveTo(0, 3.6);
      ctx.lineTo(1.5, 1.4);
      ctx.lineTo(1.5, -3);
      ctx.lineTo(-1.5, -3);
      ctx.lineTo(-1.5, 1.4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = e.stun > 0 ? '#91e4d3' : '#e57e66';
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(1.9, 1.5);
      ctx.lineTo(-1.9, 1.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  for (const ca of camps) {
    if (ca.rescued === 2) continue;
    ctx.fillStyle = '#7ce9d5';
    ctx.fillRect(ca.x - 0.6, ca.z - 2.8, 1.2, 5.6);
    ctx.fillRect(ca.x - 2.8, ca.z - 0.6, 5.6, 1.2);
    if (big) {
      ctx.font = '2.7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(2 - ca.rescued + ' CREW', ca.x + 4, ca.z + 1);
    }
  }
  ctx.strokeStyle = mode === 'night' && night.baseHp < 35 ? '#ff7d63' : '#e9ecd5';
  ctx.lineWidth = 0.65;
  ctx.strokeRect(BASE.x - 4, BASE.z - 4, 8, 8);
  ctx.fillStyle = '#e9ecd5';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('H', BASE.x, BASE.z + 2);
  if (big) {
    ctx.font = '2.7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BASE / REARM', BASE.x + 6, BASE.z + 1);
    if (boss && mode === 'mission') {
      ctx.fillStyle = '#dbe8d5';
      ctx.font = '3px monospace';
      ctx.fillText('ATLAS', boss.x + 7, boss.z);
    }
    ctx.fillStyle = '#7eaaa1';
    ctx.font = '3px monospace';
    ctx.fillText(mode === 'night' ? '02 / NIGHTWATCH' : '01 / BREAKWATER', -84, 77);
    ctx.fillText('PACIFIC THEATER · 2100', -84, 83);
    ctx.strokeStyle = '#7eaaa1';
    ctx.beginPath();
    ctx.moveTo(-84, 90);
    ctx.lineTo(-64, 90);
    ctx.stroke();
    ctx.font = '2.4px monospace';
    ctx.fillText('200 M', -84, 95);
  }
  const nav = curNav;
  if (nav) {
    const nx = nav.ref ? nav.ref.x : nav.x;
    const nz = nav.ref ? nav.ref.z : nav.z;
    ctx.strokeStyle = '#ffe38a';
    ctx.lineWidth = big ? 0.6 : 1;
    ctx.setLineDash([1.3, 1.2]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.z);
    ctx.lineTo(nx, nz);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(nx, nz, 5 + Math.sin(time * 3) * 0.7, 0, TAU);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(p.x, p.z);
  ctx.rotate(PI - p.yaw);
  ctx.fillStyle = '#ffe397';
  ctx.strokeStyle = '#183639';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -4.2);
  ctx.lineTo(2.9, 3.1);
  ctx.lineTo(0, 1.6);
  ctx.lineTo(-2.9, 3.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#c2d8c6';
  ctx.font = big ? 'bold 3.2px monospace' : 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -90);
  ctx.restore();
}

/* ================================================================ prompts per input device */

const PROMPTS = {
  keyboard: { move: 'WASD / ARROWS', fire: 'SPACE / CLICK', fireShort: 'SPACE', missile: 'R / RIGHT CLICK', missileShort: 'R', emp: 'Q', boost: 'SHIFT', map: 'M', pause: 'ESC', title: 'WASD TO FLY &nbsp; / &nbsp; SPACE TO FIRE' },
  gamepad: { move: 'LEFT STICK', fire: 'RT / A', fireShort: 'RT', missile: 'X / RB', missileShort: 'X', emp: 'Y', boost: 'LT / B', map: 'VIEW', pause: 'MENU', title: 'LEFT STICK TO FLY &nbsp; / &nbsp; RT TO FIRE &nbsp; / &nbsp; A TO SELECT' },
  touch: { move: 'LEFT-SIDE STICK', fire: 'FIRE', fireShort: '', missile: 'MISSILE', missileShort: '', emp: 'EMP', boost: 'BOOST', map: 'MAP', pause: 'Ⅱ', title: '' },
};
const prompts = () => PROMPTS[input.source] || PROMPTS.keyboard;
function applySource(src) {
  const P = PROMPTS[src] || PROMPTS.keyboard;
  $('fireKey').textContent = P.fireShort;
  $('missileKey').textContent = P.missileShort;
  $('empKey').textContent = src === 'touch' ? '' : P.emp;
  $('mapKey').textContent = src === 'touch' ? '' : '[' + P.map + ']';
  $('desktopHint').innerHTML = `${P.move} · FLY &nbsp; ${P.fire} · FIRE &nbsp; ${P.missileShort || P.missile} · MISSILE &nbsp; ${P.emp} · EMP &nbsp; ${P.boost} · BOOST &nbsp; ${P.map} · MAP`;
  const touch = src === 'touch';
  document.querySelector('.touchIntro').hidden = !touch;
  const intro = document.querySelector('.desktopIntro');
  intro.hidden = touch;
  intro.innerHTML = P.title;
  if (src === 'gamepad') mouse.active = false;
  if (src === 'gamepad') sound.init();
  if (!$('manualOverlay').hidden) fillManual();
}
function fillManual() {
  const P = prompts();
  const k = (s) => `<span class="key">${s}</span>`;
  const mouseNote = input.source === 'keyboard' ? ' Point at a target with the mouse to select it.' : '';
  $('helpGrid').innerHTML =
    `<div><h3>01 / Flight</h3><p>${k(P.move)} to fly. Release the controls to hover. Hold ${k(P.boost)} for speed.</p></div>` +
    `<div><h3>02 / Weapons</h3><p>Hold ${k(P.fire)}. The cannon tracks a nearby target.${mouseNote} Let the gun cool if it overheats.</p></div>` +
    `<div><h3>03 / Missiles &amp; EMP</h3><p>${k(P.missile)} launches a guided strike. ${k(P.emp)} stops nearby enemies and incoming fire. EMP needs 18 seconds to recharge.</p></div>` +
    `<div><h3>04 / Rescue &amp; resupply</h3><p>Clear enemies near a cyan rescue beacon, then hover over it to lower the winch. Hover over supply crates to collect them. Return to the H pad for fuel, repairs and ammunition.</p></div>`;
  $('helpMap').innerHTML = `${k(P.map)} opens the map and stops the clock. Select a point on the map to set a flight marker. ${k(P.pause)} pauses the game.`;
}
input.onSourceChange(applySource);
applySource(input.source);

/* ================================================================ menus: gamepad and keyboard navigation */

const MENU_ORDER = ['confirmOverlay', 'manualOverlay', 'endOverlay', 'mapOverlay', 'pauseOverlay', 'titleScreen'];
const MENU_DEFAULT = { confirmOverlay: 'confirmYes', manualOverlay: 'manualReady', endOverlay: 'endRetry', mapOverlay: 'mapResume', pauseOverlay: 'resumeFlight', titleScreen: 'deploy' };
let navFocus = null;
let navDir = 0;
let navRepeat = 0;
function activeMenu() {
  for (const id of MENU_ORDER) if (!E(id).hidden) return E(id);
  return null;
}
function clearNavFocus() {
  if (navFocus) navFocus.classList.remove('navFocus');
  navFocus = null;
}
function focusButton(b) {
  clearNavFocus();
  if (!b) return;
  navFocus = b;
  b.classList.add('navFocus');
  b.focus({ preventScroll: true });
  // Only scroll inside a (scrollable) overlay, never the page behind the game.
  if (b.closest('.overlay')) b.scrollIntoView({ block: 'nearest' });
}
function menuInput(dt) {
  const menu = activeMenu();
  if (!menu) {
    navDir = 0;
    return;
  }
  const mv = input.vector('move');
  let dir = 0;
  if (mv.y > 0.55 || mv.x < -0.55) dir = -1;
  else if (mv.y < -0.55 || mv.x > 0.55) dir = 1;
  navRepeat -= dt;
  if (dir && (dir !== navDir || navRepeat <= 0)) {
    const list = [...menu.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
    if (list.length) {
      const i = list.indexOf(navFocus && menu.contains(navFocus) ? navFocus : document.activeElement);
      const next = i < 0 ? list.indexOf($(MENU_DEFAULT[menu.id])) : (i + dir + list.length) % list.length;
      focusButton(list[Math.max(0, next)]);
    }
    navRepeat = dir === navDir ? 0.14 : 0.36;
  }
  navDir = dir;
  if (input.pressed('ok')) {
    const b = navFocus && menu.contains(navFocus) && navFocus.offsetParent !== null ? navFocus : $(MENU_DEFAULT[menu.id]);
    if (b && !b.hidden) b.click();
  }
  if (input.pressed('back')) goBack();
}
function goBack() {
  if (!$('confirmOverlay').hidden) closeConfirm();
  else if (!$('manualOverlay').hidden) closeManual();
  else if (state === 'map' || state === 'paused') resumeGame();
}
function onPauseAction() {
  if (!$('manualOverlay').hidden) {
    closeManual();
    return;
  }
  if (!$('confirmOverlay').hidden) {
    closeConfirm();
    return;
  }
  if (state === 'playing') pauseGame();
  else if (state === 'paused' || state === 'map') resumeGame();
}

/* ================================================================ DOM wiring */

$('deploy').onclick = () => newMission();
$('resumeButton').onclick = loadCheckpoint;
$('nightButton').onclick = () => newNight();
const setDifficulty = (d) => {
  difficulty = d;
  refreshTitle();
  savePrefs();
};
$('standardMode').onclick = () => setDifficulty('standard');
$('assistMode').onclick = () => setDifficulty('assist');
$('veteranMode').onclick = () => setDifficulty('veteran');
$('openManual').onclick = openManual;
$('pauseManual').onclick = openManual;
$('closeManual').onclick = closeManual;
$('manualReady').onclick = closeManual;
$('pauseButton').onclick = pauseGame;
$('resumeFlight').onclick = resumeGame;
$('mapButton').onclick = openMap;
$('miniWrap').onclick = openMap;
$('closeMap').onclick = resumeGame;
$('mapResume').onclick = resumeGame;
for (const id of ['taskRows', 'mapTasks'])
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('[data-objective]');
    if (b) {
      setObjective(Number(b.dataset.objective));
      if (state === 'map') drawMap(bigCtx, $('bigmap'), true);
    }
  });
$('bigmap').addEventListener('pointerdown', (e) => {
  const r = $('bigmap').getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 200 - 100;
  const z = ((e.clientY - r.top) / r.height) * 200 - 100;
  navOverride = { x: clamp(x, -88, 88), z: clamp(z, -94, 81), y: 3, label: 'FLIGHT MARKER', num: '+', custom: true };
  curNav = getNav();
  drawMap(bigCtx, $('bigmap'), true);
  sfx('click');
});
$('clearWaypoint').onclick = () => {
  navOverride = null;
  curNav = getNav();
  drawMap(bigCtx, $('bigmap'), true);
};
document.querySelectorAll('.soundBtn').forEach((b) => (b.onclick = toggleSound));
document.querySelectorAll('.settingsBtn').forEach((b) => (b.onclick = () => kit.menu.open()));
$('pauseSettings').onclick = () => kit.menu.open();
$('pauseSound').onclick = toggleSound;
$('motionToggle').onclick = () => {
  motion = !motion;
  $('motionToggle').textContent = motion ? 'ON' : 'OFF';
  savePrefs();
};
$('restartMission').onclick = () => {
  if (mode === 'night') openConfirm('Restart Nightwatch from the first wave?', 'RESTART NIGHTWATCH', () => newNight());
  else openConfirm('This will replace the current checkpoint.', 'RESTART MISSION', () => newMission(true));
};
$('confirmYes').onclick = () => {
  const action = confirmAction;
  closeConfirm();
  if (action) action();
};
$('confirmNo').onclick = closeConfirm;
$('returnTitle').onclick = showTitle;
$('endHome').onclick = showTitle;
$('endRetry').onclick = () => {
  if (mode === 'night') newNight();
  else if (won) newMission(true);
  else loadCheckpoint();
};
addEventListener('blur', () => {
  if (state === 'playing') pauseGame();
});
// The rotor drone is a running oscillator: silence it in a background tab and while the
// kit's settings panel is open.
const syncAudioHold = () => sound.hold(document.hidden || kit.paused);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
  syncAudioHold();
});
kit.onPause((paused) => {
  syncAudioHold();
  // The settings panel opened mid-flight: come back to the pause menu, not straight into fire.
  if (paused && state === 'playing') pauseGame();
});

function updateAudio() {
  sound.update(state === 'playing', hypot(p.vx, p.vz), mode === 'night' ? 'night' : 'mission');
}

/* ================================================================ diagnostics */

// Read-only diagnostics are available for browser testing. Test-only actions require ?test=1.
window.pocketThunder = {
  getState: () => ({
    state,
    mode,
    difficulty,
    player: { ...p },
    clock,
    elapsed,
    score,
    kills,
    relays: relayCount(),
    rescued: rescuedCount(),
    unlocked,
    night: { wave: night.wave, phase: night.phase, baseHp: night.baseHp, queued: night.queue.length },
    drawCalls: view.calls,
    particles: particles.length,
    projectiles: projectiles.length,
    checkpoint: !!storage.get('checkpoint'),
    enemies: enemies.map((e) => ({ id: e.id, type: e.type, x: e.x, z: e.z, hp: e.hp, dead: e.dead })),
    camps: camps.map((c) => ({ id: c.id, x: c.x, z: c.z, rescued: c.rescued, progress: c.progress })),
    supplies: supplies.map((s) => ({ type: s.type, x: s.x, z: s.z, taken: s.taken })),
    render: { width: kit.size.width, height: kit.size.height, backend: kit.backend, tier: kit.tier.name },
  }),
};
if (new URLSearchParams(location.search).has('test'))
  window.pocketThunder.test = {
    warp: (x, z) => {
      p.x = x;
      p.z = z;
      p.vx = p.vz = 0;
      updateCamera(1, true);
    },
    damage: (id, n = 9999) => {
      const e = enemies.find((x) => x.id === id);
      if (e) damageEnemy(e, n);
    },
    setPlayer: (o) => Object.assign(p, o),
    night: () => newNight(),
    wave: (n) => {
      if (mode === 'night') {
        for (const e of enemies) if (!e.dead) damageEnemy(e, 99999);
        night.queue.length = 0;
        night.wave = Math.max(0, n - 1);
        night.phase = 'calm';
        night.between = 0.1;
      }
    },
    step: (seconds) => {
      for (let i = 0; i < seconds * 60 && state === 'playing'; i++) {
        time += STEP;
        updateGame(STEP);
        updateParticles(STEP);
        animateActors(STEP);
      }
      updateCamera(1, true);
      updateHUD(0.1);
    },
    end: () => endMission(false, 'Test'),
    project: (x, y, z) => ({ ...view.project(x, y, z) }),
  };

/* ================================================================ frame loop */

let accumulator = 0;
let draws = 0;
let touchHidden = null;
function pollPointer(dt) {
  const ptr = input.pointer;
  mouse.age += dt;
  if (ptr.type === 'mouse' && ptr.over && (ptr.x !== mouse.lastX || ptr.y !== mouse.lastY)) {
    mouse.lastX = mouse.x = ptr.x;
    mouse.lastY = mouse.y = ptr.y;
    mouse.active = true;
    mouse.age = 0;
  }
}
function readControls() {
  const mv = input.vector('move');
  ctl.sx = mv.x;
  ctl.sy = -mv.y;
  const f = input.down('fire');
  if (!f) blockFire = false;
  ctl.fire = f && !blockFire;
  ctl.boost = input.down('boost');
  if (input.pressed('missile')) fireMissile();
  if (input.pressed('emp')) useEMP();
}
function syncTouch() {
  const hide = state !== 'playing';
  if (hide !== touchHidden) {
    touchHidden = hide;
    kit.touch?.suspend(hide, 'game');
  }
}

function frame(rawDt) {
  const dt = Math.min(rawDt, 0.05);
  time += dt;
  pollPointer(dt);
  if (input.pressed('pause')) onPauseAction();
  if (input.pressed('map') && (state === 'playing' || state === 'map')) openMap();
  menuInput(dt);
  if (state === 'playing') {
    readControls();
    accumulator = Math.min(accumulator + dt, 0.12);
    while (accumulator >= STEP) {
      updateGame(STEP);
      accumulator -= STEP;
    }
  } else accumulator = 0;
  if (state === 'title') {
    p.y = 11 + Math.sin(time * 1.7) * 0.22;
    p.yaw = -0.62 + Math.sin(time * 0.18) * 0.12;
    for (const e of enemies) if (e.type === 'relay' && !e.dead) e.head.ry += dt * 0.5;
  }
  if (state === 'title' || state === 'playing' || state === 'won' || state === 'lost') {
    updateParticles(dt);
    animateActors(dt);
  }
  updateAtmosphere(dt);
  updateCamera(dt);
  view.update(dynamicRoots, time);
  if (state === 'playing') {
    uiAccum += dt;
    if (uiAccum > 0.075) {
      updateHUD(uiAccum);
      uiAccum = 0;
    }
    updateMarkers();
  } else if (state === 'map' && draws % 8 === 0) drawMap(bigCtx, $('bigmap'), true);
  view.draw();
  if (draws % 8 === 0) updateAudio();
  draws++;
  syncTouch();
}

syncSound();
$('motionToggle').textContent = motion ? 'ON' : 'OFF';
showTitle();
updateCamera(1, true);
kit.loading.progress(0.9, 'Warming up the engines…');
view.update(dynamicRoots, 0);
await view.compile();
kit.start(frame);
