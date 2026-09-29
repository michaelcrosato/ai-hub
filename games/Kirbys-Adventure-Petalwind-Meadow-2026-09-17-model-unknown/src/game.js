import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BALANCE, levelForXP, damageForLevel } from './balance.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, target, delta) => v < target ? Math.min(target, v + delta) : Math.max(target, v - delta);
const damp = (v, target, lambda, dt) => v + (target - v) * (1 - Math.exp(-lambda * dt));
const rand = (a, b) => a + Math.random() * (b - a);

// Button names for prompts on signs, per input device.
const PROMPTS = {
  keyboard: { jump: 'SPACE', inhale: 'J', ability: 'K' },
  gamepad: { jump: 'A', inhale: 'X', ability: 'B' },
  touch: { jump: 'JUMP', inhale: 'INHALE', ability: 'ABILITY' },
};

export function createGame({ kit, scene, camera }) {
  const $ = (s) => document.querySelector(s);
  const intro = $('#intro');
  const hud = $('#hud');
  const toast = $('#toast');
  const sign = $('#sign');
  const signCopy = $('#sign-copy');
  const complete = $('#complete');
  const help = $('#help');
  const soundBtn = $('#sound-btn');
  const pauseSoundBtn = $('#pause-sound');
  const helpBtn = $('#help-btn');
  const hpRow = $('#hp-row');
  const levelLabel = $('#level-label');
  const xpFill = $('#xp-fill');
  const gearLabel = $('#gear-label');
  const abilityLabel = $('#ability-label');
  const bellProgress = $('#bell-progress');
  const objectiveCopy = $('#objective-copy');
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  scene.background = new THREE.Color(0x8fd6ff);
  scene.fog = new THREE.Fog(0x9edfff, 34, 105);
  camera.position.set(3, 5, 14);

  const world = new THREE.Group();
  const terrain = new THREE.Group();
  const decor = new THREE.Group();
  const actors = new THREE.Group();
  const fxGroup = new THREE.Group();
  scene.add(world, terrain, decor, actors, fxGroup);

  const hemi = new THREE.HemisphereLight(0xdff6ff, 0xa3bb72, 2.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0cf, 4.2);
  const SUN_OFFSET = new THREE.Vector3(20, 28, 18);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  kit.shadow(sun, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x8be0ff, 1.35);
  rim.position.set(-12, 9, -14);
  scene.add(rim);

  const stdCache = new Map();
  function std(color, roughness = 0.9, metalness = 0) {
    const key = `${color}|${roughness}|${metalness}`;
    let m = stdCache.get(key);
    if (!m) stdCache.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })));
    return m;
  }
  function emissive(color, e, intensity) {
    return new THREE.MeshStandardMaterial({ color, emissive: e, emissiveIntensity: intensity, roughness: 0.55, metalness: 0.02, flatShading: true });
  }
  const mats = {
    grass: std(0x7bd46b, 0.88, 0.02),
    grassDark: std(0x59b75e, 0.92, 0.01),
    soil: std(0xb88165, 0.92, 0.0),
    stone: std(0xb9c7cf, 0.88, 0.02),
    wood: std(0xa46c4e, 0.95, 0.0),
    rail: std(0xf4d99a, 0.86, 0.0),
    leafA: std(0x74c86b, 0.95, 0.0),
    leafB: std(0x54b782, 0.95, 0.0),
    pink: std(0xff8aa3, 0.78, 0.02),
    foot: std(0xe94f72, 0.78, 0.02),
    eye: std(0x243453, 0.55, 0.0),
    cream: std(0xffefc9, 0.9, 0.0),
    dark: std(0x3a4b66, 0.8, 0.0),
    spark: emissive(0xffcf45, 0xffad18, 2.7),
    cyan: emissive(0x69e4dc, 0x28bcae, 1.9),
    bell: emissive(0xffd65c, 0xff9f22, 2.25),
    purple: std(0xa782d8, 0.82, 0.01),
    thorn: std(0x63723d, 0.92, 0.0),
    cloud: std(0xf7fcff, 1, 0),
    water: std(0x68cfe9, 0.4, 0.05),
    bud: std(0x8ea3d9, 0.82, 0),
    breeze: std(0x86dfad, 0.82, 0),
  };
  const flowerMats = [0xffee77, 0xff8cad, 0x8ce0ff, 0xd1a1ff].map((c) => std(c, 0.75, 0));

  // Geometry is shared: one instance per shape and size.
  const geoCache = new Map();
  function geo(key, make) {
    let g = geoCache.get(key);
    if (!g) geoCache.set(key, (g = make()));
    return g;
  }
  const box = (w, h, d) => geo(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (a, b, h, s) => geo(`cyl${a},${b},${h},${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
  const dodeca = (r, d) => geo(`dod${r},${d}`, () => new THREE.DodecahedronGeometry(r, d));
  const octa = (r) => geo(`oct${r}`, () => new THREE.OctahedronGeometry(r, 0));
  const cone = (r, h, s) => geo(`cone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
  const torus = (r, t, rs, ts, arc) => geo(`tor${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
  const sphere = (r, w, h) => geo(`sph${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));

  function mesh(geometry, material, cast = true, receive = true) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }

  const platforms = [];
  const dynamicColliders = [];
  function addPlatform(x, y, w, h, material = mats.soil, topMaterial = mats.grass, options = {}) {
    const group = new THREE.Group();
    const body = mesh(box(w, h, 4.8), material, false, true);
    group.add(body);
    if (topMaterial) {
      const top = mesh(box(w + 0.06, 0.28, 5.0), topMaterial, false, true);
      top.position.y = h / 2 + 0.14;
      group.add(top);
    }
    group.position.set(x, y, options.z || 0);
    terrain.add(group);
    const collider = { x, y, w, h, oneWay: !!options.oneWay, disabled: false, tag: options.tag || '' };
    platforms.push(collider);
    return { group, collider };
  }

  // Core route: meadow, broken causeway, two traversal routes, arena, moon gate.
  addPlatform(9, -1.6, 34, 3.2);
  addPlatform(30.5, -1.1, 7, 2.2);
  addPlatform(35, -0.4, 2.2, 0.8, mats.stone, mats.grassDark);
  // Upper hover route.
  addPlatform(40.2, 1.5, 4.6, 0.9, mats.stone, mats.grass, { oneWay: true });
  addPlatform(47.4, 3.5, 5.4, 0.9, mats.stone, mats.grass, { oneWay: true });
  addPlatform(54.7, 4.5, 5.2, 0.9, mats.stone, mats.grass, { oneWay: true });
  addPlatform(61, 2.0, 5.5, 0.9, mats.stone, mats.grass, { oneWay: true });
  // Lower shortcut route.
  addPlatform(40.4, -3.1, 5.8, 0.9, mats.stone, null);
  addPlatform(48.2, -4.3, 6.2, 0.9, mats.stone, null);
  addPlatform(56.0, -3.5, 6.0, 0.9, mats.stone, null);
  addPlatform(61.6, -1.8, 4.4, 0.9, mats.stone, null);
  addPlatform(68.5, -1.5, 10, 3.0);
  addPlatform(84, -1.5, 18, 3.0, mats.soil, mats.grassDark);
  addPlatform(106.2, -1.5, 26.5, 3.0);

  // Friendly stairs at the opening route.
  addPlatform(17.7, 0.1, 2.0, 0.7, mats.stone, mats.grass, { oneWay: true });
  addPlatform(19.7, 0.55, 2.0, 0.7, mats.stone, mats.grass, { oneWay: true });
  addPlatform(21.7, 1.0, 2.0, 0.7, mats.stone, mats.grass, { oneWay: true });

  // Water under the broken causeway.
  const water = mesh(box(31, 0.22, 6.8), mats.water, false, false);
  water.position.set(49.2, -6.1, 0);
  world.add(water);

  // Arena gate collider and gate model.
  const arenaGate = makeGate(74.2, 1.7, false);
  dynamicColliders.push(arenaGate.collider);
  const moonGate = makeGate(114.3, 1.7, true);
  const colliders = platforms.concat(dynamicColliders);

  function makeGate(x, y, ornate) {
    const g = new THREE.Group();
    const pillarGeo = box(0.75, 5.8, 1.25);
    const left = mesh(pillarGeo, ornate ? mats.cream : mats.stone);
    const right = mesh(pillarGeo, ornate ? mats.cream : mats.stone);
    left.position.x = -2.25; right.position.x = 2.25;
    const bar = mesh(box(4.6, 3.7, 0.55), ornate ? mats.bell : mats.rail);
    bar.position.y = 0.1;
    g.add(left, right, bar);
    if (ornate) {
      const moon = mesh(torus(0.72, 0.15, 6, 18, Math.PI * 1.6), mats.bell);
      moon.rotation.z = 0.8;
      moon.position.y = 3.15;
      g.add(moon);
    }
    g.position.set(x, y, 0);
    world.add(g);
    return { group: g, collider: { x, y: 1.3, w: 0.85, h: 6.2, oneWay: false, disabled: ornate, tag: ornate ? 'goal' : 'arenaGate' }, targetY: y };
  }

  // Rails make edges readable on mobile without becoming collision traps.
  addRail(37.6, 2.2, 1.8);
  addRail(63.6, 1.0, 2.2);
  addRail(75.3, 0.55, 2.2);
  addRail(92.6, 0.55, 2.4);
  function addRail(x, y, width) {
    const g = new THREE.Group();
    for (const ox of [-width / 2, width / 2]) {
      const p = mesh(cyl(0.09, 0.11, 1.6, 6), mats.rail, false, true);
      p.position.set(ox, 0.8, 0);
      g.add(p);
    }
    const bar = mesh(box(width + 0.2, 0.12, 0.16), mats.rail, false, true);
    bar.position.y = 1.25;
    g.add(bar);
    g.position.set(x, y, 1.75);
    decor.add(g);
  }

  // Background diorama.
  for (let i = 0; i < 24; i++) addTree(rand(-4, 122), rand(-0.2, 1.5), rand(-7.5, -3.9), rand(0.65, 1.25), i % 2);
  for (let i = 0; i < 13; i++) addHill(-5 + i * 11 + rand(-3, 3), rand(0.4, 2.2), -12 - rand(0, 8), rand(3.5, 7));
  for (let i = 0; i < 12; i++) addCloud(rand(-10, 130), rand(9, 18), -20 - rand(0, 14), rand(0.7, 1.5));
  for (let i = 0; i < 52; i++) addFlower(rand(-4, 119), rand(-0.02, 0.25), rand(-2.3, 2.3), i % 4);

  function addTree(x, y, z, s, variant) {
    const g = new THREE.Group();
    const trunk = mesh(cyl(0.22, 0.35, 2.8, 7), mats.wood, false, true);
    trunk.scale.setScalar(s);
    trunk.position.y = 1.35 * s;
    const crown = mesh(dodeca(1.2, 0), variant ? mats.leafA : mats.leafB, false, true);
    crown.scale.set(1.15 * s, 0.95 * s, s);
    crown.position.y = 3.0 * s;
    g.add(trunk, crown);
    g.position.set(x, y, z);
    decor.add(g);
  }
  function addHill(x, y, z, s) {
    const h = mesh(cone(1, 0.72, 8), mats.grassDark, false, true);
    h.scale.set(s, s, s * 0.7);
    h.rotation.y = Math.PI / 8;
    h.position.set(x, y, z);
    decor.add(h);
  }
  function addCloud(x, y, z, s) {
    const g = new THREE.Group();
    for (const [ox, oy, sc] of [[0, 0, 1], [1.2, .1, .8], [-1, .05, .7], [.35, .55, .72]]) {
      const p = mesh(dodeca(1.15, 0), mats.cloud, false, false);
      const r = s * sc;
      p.scale.set(r, r * 0.65, r);
      p.position.set(ox * s, oy * s, 0);
      g.add(p);
    }
    g.position.set(x, y, z);
    decor.add(g);
  }
  function addFlower(x, y, z, variant) {
    const stem = mesh(cyl(0.025, 0.035, 0.38, 5), mats.leafB, false, true);
    stem.position.set(x, y + 0.18, z);
    const head = mesh(octa(0.12), flowerMats[variant], false, true);
    head.position.set(x, y + 0.42, z);
    decor.add(stem, head);
  }

  const signs = [
    { x: 3.2, text: '{jump} twice: jump, then hold again in air to hover.' },
    { x: 25.5, text: 'Hold {inhale} to inhale a small foe. Bright foes lend you an ability.' },
    { x: 34.0, text: 'Two ways across. High path rewards precision; low path is safer but longer.' },
    { x: 69.0, text: 'Two Dewbells open the arena. {ability} uses your borrowed ability.' },
    { x: 95.0, text: 'The last Dewbell wakes the Moon Gate. Follow the gold petals.' }
  ];
  for (const s of signs) makeSign(s.x);
  function makeSign(x) {
    const g = new THREE.Group();
    const post = mesh(box(0.16, 1.15, 0.16), mats.wood, false, true);
    const board = mesh(box(1.35, 0.72, 0.16), mats.rail, false, true);
    board.position.y = 0.72;
    g.add(post, board);
    g.position.set(x, 0.55, 2.05);
    decor.add(g);
  }

  // The level's static scenery never moves: bake it into one mesh per material.
  mergeStatic(terrain);
  mergeStatic(decor);
  function mergeStatic(group) {
    group.updateMatrixWorld(true);
    const buckets = new Map();
    group.traverse((o) => {
      if (!o.isMesh) return;
      const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, parts: [] }));
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.clearGroups();
      b.parts.push(g.applyMatrix4(o.matrixWorld));
    });
    group.clear();
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.parts, false);
      for (const p of b.parts) p.dispose();
      const m = mesh(merged, b.material, b.cast, b.receive);
      m.matrixAutoUpdate = false;
      group.add(m);
    }
  }

  // Player.
  const playerModel = makePlayer();
  actors.add(playerModel.group);
  const player = {
    x: -4, y: 1.1, vx: 0, vy: 0, w: 1.1, h: 1.45,
    dir: 1, grounded: false, hoverFuel: BALANCE.hoverSeconds, hoverLock: true,
    hp: BALANCE.baseHP, maxHP: BALANCE.baseHP, xp: 0, level: 1, ability: 'NONE',
    abilityCooldown: 0, hurtCooldown: 0, coyote: 0, jumpBuffer: 0,
    gear: [], bells: new Set(), time: 0,
    enemiesSwallowed: 0, damageTaken: 0, pickups: 0, completed: false,
    lastSafe: { x: -4, y: 1.1 }
  };
  function makePlayer() {
    const g = new THREE.Group();
    const body = mesh(dodeca(0.72, 1), mats.pink);
    body.scale.set(1.0, 0.95, 0.95);
    const leftFoot = mesh(dodeca(0.34, 0), mats.foot);
    const rightFoot = mesh(dodeca(0.34, 0), mats.foot);
    leftFoot.scale.set(1.35, 0.7, 1.0); rightFoot.scale.copy(leftFoot.scale);
    leftFoot.position.set(-0.43, -0.62, 0.08); rightFoot.position.set(0.43, -0.62, 0.08);
    const eyeL = mesh(box(0.1, 0.27, 0.06), mats.eye, false, false);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.20, 0.17, 0.665); eyeR.position.set(0.20, 0.17, 0.665);
    const mouth = mesh(cyl(0.07, 0.07, 0.055, 10), mats.dark, false, false);
    mouth.rotation.x = Math.PI / 2; mouth.position.set(0, -0.12, 0.69);
    g.add(body, leftFoot, rightFoot, eyeL, eyeR, mouth);
    return { group: g, body, feet: [leftFoot, rightFoot], mouth };
  }

  // Collectibles and gear.
  const pickups = [];
  spawnBell('main', 28.2, 1.25, 'Meadow Dewbell');
  spawnBell('branch', 54.7, 6.05, 'Sky Dewbell', 'upper');
  spawnBell('branch', 48.2, -2.92, 'Grotto Dewbell', 'lower');
  spawnGear('SPRING_SOLES', 31.1, 0.75, 'Spring Soles');
  spawnGear('GLOW_PIN', 58.0, 5.6, 'Glow Pin', 'upper');
  spawnGear('BERRY_BROOCH', 57.0, -2.8, 'Berry Brooch', 'lower');
  for (const [x, y] of [[7, 1.0], [11, 1.4], [18, 2.4], [23, 2.0], [42, 3.0], [47, 5.1], [51, -2.9], [61, 3.5], [65, 1.0], [71, 1.2], [97, 1.0], [102, 1.4], [108, 1.2]]) spawnPetal(x, y);

  function spawnBell(id, x, y, label, route = '') {
    const g = new THREE.Group();
    const bell = mesh(cone(0.46, 0.68, 8), mats.bell);
    bell.rotation.z = Math.PI;
    const rimMesh = mesh(torus(0.36, 0.08, 6, 12), mats.bell);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = -0.31;
    const clapper = mesh(sphere(0.09, 6, 5), mats.dark);
    clapper.position.y = -0.42;
    g.add(bell, rimMesh, clapper);
    g.position.set(x, y, 0);
    actors.add(g);
    pickups.push({ type: 'bell', id, label, route, group: g, x, y, active: true, phase: Math.random() * 6.28 });
  }
  function spawnGear(id, x, y, label, route = '') {
    const g = new THREE.Group();
    const core = mesh(octa(0.36), mats.cyan);
    const ring = mesh(torus(0.48, 0.07, 5, 12), mats.cream);
    ring.rotation.x = Math.PI / 2;
    g.add(core, ring);
    g.position.set(x, y, 0);
    actors.add(g);
    pickups.push({ type: 'gear', id, label, route, group: g, x, y, active: true, phase: Math.random() * 6.28 });
  }
  function spawnPetal(x, y) {
    const p = mesh(octa(0.18), mats.spark);
    p.scale.y = 1.5;
    p.position.set(x, y, 0);
    actors.add(p);
    pickups.push({ type: 'petal', id: `petal-${pickups.length}`, label: 'Sun Petal', group: p, x, y, active: true, phase: Math.random() * 6.28 });
  }

  // Enemies.
  const enemies = [];
  spawnEnemy({ x: 12.5, y: 1.0, kind: 'bud', ability: 'NONE', min: 10, max: 15 });
  spawnEnemy({ x: 24.0, y: 1.3, kind: 'glimmer', ability: 'BOLT', min: 22.5, max: 26.5 });
  spawnEnemy({ x: 43.0, y: 2.8, kind: 'breeze', ability: 'LEAF', min: 40.3, max: 44.4 });
  spawnEnemy({ x: 52.0, y: -3.1, kind: 'breeze', ability: 'LEAF', min: 49.3, max: 55.0 });
  spawnEnemy({ x: 66.5, y: 0.7, kind: 'bud', ability: 'NONE', min: 64, max: 70 });
  spawnEnemy({ x: 70.6, y: 0.8, kind: 'glimmer', ability: 'BOLT', min: 69.2, max: 72.0 });
  let boss = null;

  function spawnEnemy(def) {
    const g = new THREE.Group();
    const mat = def.kind === 'glimmer' ? mats.spark : def.kind === 'breeze' ? mats.breeze : mats.bud;
    const body = mesh(dodeca(0.55, 0), mat);
    body.scale.y = 0.88;
    const foot1 = mesh(box(0.34, 0.18, 0.42), mats.dark);
    const foot2 = foot1.clone();
    foot1.position.set(-0.3, -0.48, 0.05); foot2.position.set(0.3, -0.48, 0.05);
    const eye1 = mesh(box(0.08, 0.17, 0.05), mats.eye, false, false);
    const eye2 = eye1.clone(); eye1.position.set(-.16, .08, .52); eye2.position.set(.16, .08, .52);
    g.add(body, foot1, foot2, eye1, eye2);
    if (def.kind === 'breeze') {
      const leaf = mesh(cone(0.16, 0.55, 5), mats.leafB);
      leaf.rotation.z = -0.6; leaf.position.set(.45, .42, 0); g.add(leaf);
    }
    g.position.set(def.x, def.y, 0);
    actors.add(g);
    enemies.push({ ...def, group: g, body, x: def.x, y: def.y, vx: def.kind === 'glimmer' ? -1.1 : 1.0, vy: 0, hp: 1, alive: true, sucked: false, hitCd: 0, phase: Math.random() * 6.28 });
  }

  function spawnBoss() {
    if (boss) return;
    const g = new THREE.Group();
    const body = mesh(dodeca(1.05, 1), mats.purple);
    body.scale.set(1.15, 1.0, 1.05);
    const crown = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const thorn = mesh(cone(0.17, 0.7, 6), mats.thorn);
      thorn.position.set((i - 3) * 0.25, 0.95 - Math.abs(i - 3) * 0.05, 0);
      thorn.rotation.z = (i - 3) * 0.12;
      crown.add(thorn);
    }
    const eye1 = mesh(box(.11, .28, .08), mats.eye, false, false);
    const eye2 = eye1.clone(); eye1.position.set(-.3, .15, .96); eye2.position.set(.3, .15, .96);
    g.add(body, crown, eye1, eye2);
    g.position.set(84, 1.05, 0);
    actors.add(g);
    boss = { group: g, body, x: 84, y: 1.05, vx: 1.7, vy: 0, hp: BALANCE.bossHP, maxHP: BALANCE.bossHP, alive: true, active: false, attackTimer: 1.4, hurtCd: 0, phase: 0 };
    toastMsg('BRAMBLE BELL · 7 HP', 1600);
  }

  // Projectiles are removed when they land; particles come from a pool.
  const projectiles = [];
  function spawnProjectile({ x, y, vx, vy = 0, owner = 'player', kind = 'leaf', damage = 1 }) {
    const mat = owner === 'player' ? (kind === 'bolt' ? mats.spark : mats.cyan) : mats.thorn;
    const p = mesh(kind === 'leaf' ? octa(.22) : sphere(.18, 6, 5), mat);
    p.position.set(x, y, 0);
    actors.add(p);
    projectiles.push({ mesh: p, x, y, vx, vy, owner, kind, damage, life: owner === 'player' ? 2.1 : 4.0, hit: false });
  }
  const PARTICLE_SIZE = 0.08;
  const particleGeo = octa(PARTICLE_SIZE);
  const particles = [];
  const particlePool = [];
  function spawnParticle(material, x, y, z, size, vx, vy, life, spin) {
    let m = particlePool.pop();
    if (m) { m.material = material; m.visible = true; m.rotation.set(0, 0, 0); }
    else { m = mesh(particleGeo, material, false, false); fxGroup.add(m); }
    m.scale.setScalar(size / PARTICLE_SIZE);
    m.position.set(x, y, z);
    particles.push({ mesh: m, vx, vy, life, spin });
  }
  function burst(x, y, colorMat, count = 7, scale = 1) {
    for (let i = 0; i < count; i++) spawnParticle(colorMat, x, y, rand(-.3, .3), .08 * scale, rand(-3, 3), rand(1.5, 5), rand(.35, .75), rand(-8, 8));
  }

  // Gameplay input, filled from the kit's actions every frame.
  const input = { jump: false, inhale: false, ability: false, jumpPressed: false, abilityPressed: false, axis: 0 };
  let cameraZoom = coarse ? 13.2 : 12.5;

  // Sound: minimal original synthesized chiptune/SFX; no external audio assets.
  const sound = makeSound();
  function makeSound() {
    let ctx = null, enabled = true, step = 0, timer = null, halted = false;
    const notes = [262, 330, 392, 523, 392, 330, 294, 349, 440, 523, 587, 523, 440, 349, 330, 392];
    function unlock() {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!ctx) ctx = new AudioCtor();
      if (ctx.state === 'suspended' && !halted && enabled) ctx.resume().catch(() => {});
    }
    function ensure() {
      if (!enabled) return;
      unlock();
      if (!timer) timer = setInterval(() => { if (!enabled || halted || paused || !started || player.completed) return; tone(notes[step++ % notes.length], .12, .035, 'triangle'); }, 210);
    }
    function halt(on) {
      halted = on;
      if (!ctx) return;
      if (on) ctx.suspend().catch(() => {});
      else if (enabled) ctx.resume().catch(() => {});
    }
    function tone(freq, dur = .08, vol = .05, type = 'square') {
      if (!enabled || !ctx || halted) return;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur); o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
    }
    return { get enabled() { return enabled; }, set enabled(v) { enabled = v; }, ensure, unlock, halt, jump: () => tone(440, .09, .04), pickup: () => { tone(660, .07, .05); setTimeout(() => tone(880, .08, .04), 55); }, hit: () => tone(110, .12, .06, 'sawtooth'), bell: () => { tone(523, .18, .06, 'sine'); setTimeout(() => tone(784, .22, .055, 'sine'), 110); }, ability: () => tone(720, .07, .045, 'square'), boss: () => tone(90, .22, .07, 'sawtooth') };
  }
  // Browsers only start audio after a gesture; any first key, click or tap unlocks it.
  const firstGesture = () => { sound.unlock(); removeEventListener('pointerdown', firstGesture, true); removeEventListener('keydown', firstGesture, true); };
  addEventListener('pointerdown', firstGesture, true);
  addEventListener('keydown', firstGesture, true);
  const syncAudio = () => sound.halt(document.hidden || kit.paused);

  // Menus: the intro, pause and completion panels, driven by mouse, touch, keyboard and gamepad.
  const panels = { intro, pause: help, complete };
  let menu = null, focusIdx = 0, navHeld = false, inputGuard = 0;
  let started = false, paused = true, accumulator = 0;

  function showMenu(name) {
    for (const [key, el] of Object.entries(panels)) el.classList.toggle('hidden', key !== name);
    menu = name;
    // A direction still held from gameplay must be released before it moves the focus.
    navHeld = true;
    setFocus(0);
    syncTouch();
  }
  function menuButtons() { return menu ? [...panels[menu].querySelectorAll('button')] : []; }
  function setFocus(i) {
    const buttons = menuButtons();
    if (!buttons.length) return;
    focusIdx = (i + buttons.length) % buttons.length;
    const ring = kit.input.source !== 'touch';
    buttons.forEach((b, j) => b.classList.toggle('is-focus', ring && j === focusIdx));
  }
  function navigateMenu() {
    const mv = kit.input.vector('move');
    const dir = mv.y > 0.5 || mv.x < -0.5 ? -1 : mv.y < -0.5 || mv.x > 0.5 ? 1 : 0;
    if (dir && !navHeld) setFocus(focusIdx + dir);
    navHeld = dir !== 0;
    if (kit.input.pressed('jump')) menuButtons()[focusIdx]?.click();
    else if (menu === 'pause' && (kit.input.pressed('pause') || kit.input.pressed('ability'))) closePause();
  }
  // Touch controls hide under a panel so they never cover its buttons.
  function syncTouch() { kit.touch?.suspend(!!menu); }
  function syncTouchClass() { document.body.classList.toggle('touch-on', !!kit.touch?.visible); }
  kit.input.onSourceChange(() => { syncTouchClass(); if (menu) setFocus(focusIdx); });
  kit.settings.subscribe(syncTouchClass);
  syncTouchClass();

  kit.onPause((isPaused) => {
    syncAudio();
    if (!isPaused) { syncTouch(); inputGuard = 2; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && started && !menu && !player.completed) openPause();
    syncAudio();
  });

  function openPause() {
    if (!started || player.completed || menu) return;
    paused = true;
    showMenu('pause');
  }
  function closePause() {
    if (menu !== 'pause') return;
    paused = false;
    showMenu(null);
  }
  function toggleSound() {
    sound.enabled = !sound.enabled;
    soundBtn.textContent = sound.enabled ? 'SOUND' : 'MUTED';
    pauseSoundBtn.textContent = sound.enabled ? 'SOUND: ON' : 'SOUND: OFF';
    if (sound.enabled) sound.ensure();
  }
  // Mouse clicks must not leave focus on a button: in Chromium and WebKit the next key press
  // makes that button :focus-visible, so the kit leaves Space to it and it clicks again.
  const click = (el, fn) => el.addEventListener('click', (e) => { el.blur(); fn(e); });
  click($('#start-btn'), startRun);
  click($('#restart-btn'), () => location.reload());
  click(helpBtn, openPause);
  click($('#close-help'), closePause);
  click($('#pause-settings'), () => kit.menu.open());
  click(soundBtn, toggleSound);
  click(pauseSoundBtn, toggleSound);

  $('#backend-label').textContent = `${kit.backend === 'webgpu' ? 'WebGPU' : 'WebGL2'} · Three r${THREE.REVISION} · bloom`;

  function startRun() {
    if (started) return;
    started = true; paused = false;
    hud.classList.remove('hidden'); soundBtn.classList.remove('hidden'); helpBtn.classList.remove('hidden');
    showMenu(null);
    sound.ensure();
    updateHUD();
  }

  // Gameplay.
  function update(dt) {
    if (!started || paused || player.completed) return;
    player.time += dt;
    player.hurtCooldown = Math.max(0, player.hurtCooldown - dt);
    player.abilityCooldown = Math.max(0, player.abilityCooldown - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    if (player.grounded) player.coyote = .11; else player.coyote = Math.max(0, player.coyote - dt);
    if (input.jumpPressed) player.jumpBuffer = .14;

    const moveAxis = clamp(input.axis, -1, 1);
    const accel = player.grounded ? 52 : 31;
    const maxSpeed = BALANCE.moveSpeed * (player.gear.includes('SPRING_SOLES') ? 1.03 : 1);
    player.vx = approach(player.vx, moveAxis * maxSpeed, accel * dt);
    if (Math.abs(moveAxis) < .05) player.vx = approach(player.vx, 0, (player.grounded ? 35 : 8) * dt);
    if (Math.abs(moveAxis) > .1) player.dir = Math.sign(moveAxis);

    const jumpSpeed = BALANCE.jumpSpeed * (player.gear.includes('SPRING_SOLES') ? 1.08 : 1);
    if (player.jumpBuffer > 0 && player.coyote > 0) {
      player.vy = jumpSpeed; player.grounded = false; player.coyote = 0; player.jumpBuffer = 0; player.hoverLock = true; sound.jump(); burst(player.x, player.y - .65, mats.cloud, 4, .7);
    }
    // Hover requires a release after jumping, then another hold. This prevents accidental float.
    if (!input.jump && player.vy < jumpSpeed * .65) player.hoverLock = false;
    const hovering = input.jump && !player.grounded && !player.hoverLock && player.hoverFuel > 0;
    if (hovering) { player.vy = approach(player.vy, 2.8, 27 * dt); player.hoverFuel = Math.max(0, player.hoverFuel - dt); }
    else player.vy -= BALANCE.gravity * dt;
    if (player.grounded) player.hoverFuel = Math.min(BALANCE.hoverSeconds, player.hoverFuel + dt * 2.7);
    if (!input.jump && player.vy > 4.4) player.vy -= 16 * dt;

    if (input.abilityPressed) useAbility();
    updatePlayerCollision(dt);
    updateInhale(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateGates(dt);
    updateSigns();
    updatePlayerVisual(dt, hovering);
    updateCamera(dt);

    if (player.y < -8.5) respawnPlayer();
    input.jumpPressed = false; input.abilityPressed = false;
  }

  function updatePlayerCollision(dt) {
    const oldX = player.x, oldY = player.y;
    player.x += player.vx * dt;
    collideHorizontal(oldX);
    player.y += player.vy * dt;
    player.grounded = false;
    collideVertical(oldY);
    player.x = clamp(player.x, -7, 118.2);
    if (player.grounded && player.x < 73.5) { player.lastSafe.x = player.x; player.lastSafe.y = player.y; }
  }
  function overlapAABB(px, py, pw, ph, c) { return Math.abs(px - c.x) < (pw + c.w) / 2 && Math.abs(py - c.y) < (ph + c.h) / 2; }
  function collideHorizontal(oldX) {
    for (const c of colliders) {
      if (c.disabled || c.oneWay) continue;
      if (overlapAABB(player.x, player.y, player.w, player.h, c)) {
        if (oldX + player.w / 2 <= c.x - c.w / 2 + .04) player.x = c.x - c.w / 2 - player.w / 2;
        else if (oldX - player.w / 2 >= c.x + c.w / 2 - .04) player.x = c.x + c.w / 2 + player.w / 2;
        player.vx = 0;
      }
    }
  }
  function collideVertical(oldY) {
    for (const c of colliders) {
      if (c.disabled) continue;
      const xOverlap = Math.abs(player.x - c.x) < (player.w + c.w) / 2 - .08;
      if (!xOverlap) continue;
      const top = c.y + c.h / 2, bottom = c.y - c.h / 2;
      const oldBottom = oldY - player.h / 2, newBottom = player.y - player.h / 2;
      const oldTop = oldY + player.h / 2, newTop = player.y + player.h / 2;
      if (player.vy <= 0 && oldBottom >= top - .18 && newBottom <= top + .03) {
        player.y = top + player.h / 2; player.vy = 0; player.grounded = true; continue;
      }
      if (!c.oneWay && player.vy > 0 && oldTop <= bottom + .08 && newTop >= bottom - .02) { player.y = bottom - player.h / 2; player.vy = 0; }
    }
  }

  function updateInhale(dt) {
    playerModel.mouth.scale.setScalar(input.inhale ? 1.85 : 1);
    if (!input.inhale) return;
    if (Math.random() < dt * 18) {
      const sx = player.x + player.dir * rand(2.0, 5.2), sy = player.y + rand(-.6, .7);
      spawnParticle(mats.cyan, sx, sy, rand(-.2, .2), .055, (player.x - sx) * 3.2, (player.y - sy) * 3.2, .35, 4);
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (Math.sign(dx || player.dir) !== player.dir || Math.abs(dx) > 6.3 || Math.abs(dy) > 2.7) continue;
      e.sucked = true;
      e.x += (player.x + player.dir * .55 - e.x) * dt * 3.2;
      e.y += (player.y - e.y) * dt * 2.8;
      if (Math.hypot(dx, dy) < 1.35) { swallow(e); }
    }
  }
  function swallow(e) {
    e.alive = false; e.group.visible = false; player.enemiesSwallowed++;
    addXP(BALANCE.enemyXP);
    if (e.ability !== 'NONE') { player.ability = e.ability; toastMsg(`${e.ability === 'BOLT' ? 'BOLT POP' : 'LEAF LOOP'} BORROWED`, 1200); }
    else toastMsg('TASTY! +18 XP', 900);
    burst(player.x + player.dir * .6, player.y, mats.spark, 9); sound.pickup(); kit.input.rumble(0.25, 80); updateHUD();
  }

  function useAbility() {
    if (player.abilityCooldown > 0) return;
    const cd = BALANCE.abilityCooldown * (player.gear.includes('GLOW_PIN') ? .86 : 1);
    player.abilityCooldown = cd;
    const damage = damageForLevel(player.level);
    if (player.ability === 'BOLT') {
      sound.ability(); burst(player.x, player.y, mats.spark, 14, 1.15);
      for (const e of enemies) if (e.alive && Math.hypot(e.x - player.x, e.y - player.y) < 3.2) damageEnemy(e, damage);
      if (boss?.alive && Math.hypot(boss.x - player.x, boss.y - player.y) < 3.6) damageBoss(damage);
    } else if (player.ability === 'LEAF') {
      sound.ability(); spawnProjectile({ x: player.x + player.dir * .8, y: player.y + .1, vx: player.dir * 11.5, owner: 'player', kind: 'leaf', damage });
    } else {
      // Small unpowered puff keeps the boss beatable even if a player bypasses every ability foe.
      sound.ability(); spawnProjectile({ x: player.x + player.dir * .75, y: player.y + .05, vx: player.dir * 8.5, owner: 'player', kind: 'puff', damage: .55 * damage });
    }
  }
  function damageEnemy(e, amount) {
    if (!e.alive || e.hitCd > 0) return; e.hp -= amount; e.hitCd = .2; burst(e.x, e.y, mats.cyan, 6);
    if (e.hp <= 0) { e.alive = false; e.group.visible = false; addXP(BALANCE.enemyXP); sound.pickup(); }
  }
  function damageBoss(amount) {
    if (!boss || !boss.alive || boss.hurtCd > 0) return; boss.hp -= amount; boss.hurtCd = .18; boss.body.scale.set(1.3, .8, 1.25); burst(boss.x, boss.y, mats.spark, 10); sound.hit(); kit.input.rumble(0.35, 90);
    if (boss.hp <= 0) defeatBoss();
  }
  function defeatBoss() {
    boss.alive = false; boss.group.visible = false; addXP(BALANCE.bossXP); burst(boss.x, boss.y, mats.bell, 26, 1.5); sound.bell(); kit.input.rumble(0.7, 260); toastMsg('BRAMBLE BELL QUIETED · DEWBELL AWAKENED', 1700); spawnBell('boss', 84, 1.5, 'Bramble Dewbell'); updateHUD();
  }

  let clock = 0;
  function updateEnemies(dt) {
    for (const e of enemies) {
      if (!e.alive) continue; e.hitCd = Math.max(0, e.hitCd - dt);
      if (!e.sucked) { e.x += e.vx * dt; if (e.x < e.min || e.x > e.max) e.vx *= -1; e.y += Math.sin(clock * 2 + e.phase) * dt * .12; }
      e.group.position.set(e.x, e.y, 0); e.group.rotation.y = 0; e.group.rotation.z = damp(e.group.rotation.z, -e.vx * .025, 10, dt);
      if (player.hurtCooldown <= 0 && Math.hypot(e.x - player.x, e.y - player.y) < 1.0) hurtPlayer(1, e.x);
    }
  }

  function updateBoss(dt) {
    if (!boss) return; boss.hurtCd = Math.max(0, boss.hurtCd - dt); boss.body.scale.x = damp(boss.body.scale.x, 1.15, 8, dt); boss.body.scale.y = damp(boss.body.scale.y, 1.0, 8, dt); boss.body.scale.z = damp(boss.body.scale.z, 1.05, 8, dt);
    if (!boss.active && player.x > 77) { boss.active = true; sound.boss(); }
    if (!boss.active || !boss.alive) return;
    boss.phase += dt;
    boss.x += boss.vx * dt;
    if (boss.x < 78.5 || boss.x > 89.3) boss.vx *= -1;
    boss.y = 1.05 + Math.abs(Math.sin(boss.phase * 2.0)) * .45;
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.attackTimer = boss.hp < 3.5 ? 0.8 : 1.25;
      const dir = Math.sign(player.x - boss.x) || -1;
      spawnProjectile({ x: boss.x + dir * 1.05, y: boss.y + .25, vx: dir * (boss.hp < 3.5 ? 7.2 : 5.7), vy: rand(.8, 2.5), owner: 'enemy', kind: 'thorn', damage: 1 });
    }
    boss.group.position.set(boss.x, boss.y, 0);
    if (player.hurtCooldown <= 0 && Math.hypot(boss.x - player.x, boss.y - player.y) < 1.55) hurtPlayer(BALANCE.bossContactDamage, boss.x);
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt; p.vy -= p.owner === 'enemy' ? 5 * dt : 0; p.x += p.vx * dt; p.y += p.vy * dt; p.mesh.position.set(p.x, p.y, 0); p.mesh.rotation.z += dt * 7;
      if (p.owner === 'player') {
        for (const e of enemies) { if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < .75) { damageEnemy(e, p.damage); p.hit = true; break; } }
        if (!p.hit && boss?.alive && Math.hypot(boss.x - p.x, boss.y - p.y) < 1.25) { damageBoss(p.damage); p.hit = true; }
      } else if (player.hurtCooldown <= 0 && Math.hypot(player.x - p.x, player.y - p.y) < .7) { hurtPlayer(p.damage, p.x); p.hit = true; }
      if (p.hit || p.life <= 0 || p.y < -8) {
        actors.remove(p.mesh);
        projectiles[i] = projectiles[projectiles.length - 1];
        projectiles.pop();
      }
    }
  }

  function updatePickups(dt) {
    for (const p of pickups) {
      if (!p.active) continue;
      p.group.rotation.y += dt * 1.5; p.group.position.y = p.y + Math.sin(clock * 2 + p.phase) * .14;
      if (Math.hypot(player.x - p.x, player.y - p.y) < 1.15) { collectPickup(p); }
    }
  }
  function collectPickup(p) {
    if (!p.active) return;
    if (p.type === 'bell') {
      if (player.bells.has(p.id)) { p.active = false; p.group.visible = false; return; }
      player.bells.add(p.id); addXP(BALANCE.bellXP); toastMsg(`${p.label.toUpperCase()} · ${player.bells.size}/3`, 1300); sound.bell(); kit.input.rumble(0.3, 120); burst(p.x, p.y, mats.bell, 18, 1.25);
      // Hide alternate branch copy once either traversal route is chosen.
      if (p.id === 'branch') for (const q of pickups) if (q.type === 'bell' && q.id === 'branch') { q.active = false; q.group.visible = false; }
    } else if (p.type === 'gear') {
      if (player.gear.includes(p.id)) { p.active = false; p.group.visible = false; return; }
      player.gear.push(p.id); player.pickups++;
      if (p.id === 'BERRY_BROOCH') { player.maxHP++; player.hp = Math.min(player.maxHP, player.hp + 1); }
      toastMsg(`${p.label.toUpperCase()} EQUIPPED`, 1200); sound.pickup(); burst(p.x, p.y, mats.cyan, 12);
    } else {
      player.pickups++; addXP(4); sound.pickup(); burst(p.x, p.y, mats.spark, 5, .6);
    }
    p.active = false; p.group.visible = false; updateHUD();
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.vy -= 8 * dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.rotation.z += p.spin * dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        particlePool.push(p.mesh);
        particles[i] = particles[particles.length - 1];
        particles.pop();
      }
    }
  }

  function updateGates(dt) {
    const gateOpen = player.bells.has('main') && player.bells.has('branch');
    arenaGate.collider.disabled = gateOpen;
    arenaGate.targetY = gateOpen ? 7.5 : 1.7;
    arenaGate.group.position.y = damp(arenaGate.group.position.y, arenaGate.targetY, 5, dt);
    if (gateOpen && !boss) spawnBoss();
    if (player.bells.has('boss')) {
      moonGate.group.rotation.y = Math.sin(clock) * .03;
      if (player.x > 111.2) finishRun();
    }
  }

  function hurtPlayer(amount, sourceX) {
    if (player.hurtCooldown > 0 || player.completed) return; player.hp -= amount; player.damageTaken += amount; player.hurtCooldown = 1.15; player.vx = Math.sign(player.x - sourceX || 1) * 6.5; player.vy = 7.5; sound.hit(); kit.input.rumble(0.6, 160); burst(player.x, player.y, mats.foot, 10); updateHUD();
    if (player.hp <= 0) respawnPlayer();
  }
  function respawnPlayer() {
    player.hp = player.maxHP; player.x = player.lastSafe.x; player.y = Math.max(player.lastSafe.y, 1.2); player.vx = 0; player.vy = 0; player.hurtCooldown = 1.1; toastMsg('PETALWIND PUT YOU BACK ON THE PATH', 1300); updateHUD();
  }
  function addXP(amount) {
    const before = player.level; player.xp += amount; player.level = levelForXP(player.xp);
    if (player.level > before) { player.maxHP++; player.hp = Math.min(player.maxHP, player.hp + 2); toastMsg(`LEVEL ${player.level} · HEART +1 · POWER UP`, 1400); sound.bell(); }
    updateHUD();
  }

  function updatePlayerVisual(dt, hovering) {
    playerModel.group.position.set(player.x, player.y, 0);
    playerModel.group.rotation.y = 0;
    playerModel.group.rotation.z = damp(playerModel.group.rotation.z, -player.vx * .012, 12, dt);
    playerModel.body.scale.y = damp(playerModel.body.scale.y, hovering ? 1.12 : 1, 8, dt);
    playerModel.body.scale.x = damp(playerModel.body.scale.x, hovering ? 1.08 : 1, 8, dt);
    const run = Math.min(1, Math.abs(player.vx) / 7);
    playerModel.feet[0].rotation.z = Math.sin(clock * 15) * .45 * run;
    playerModel.feet[1].rotation.z = -playerModel.feet[0].rotation.z;
  }

  let camX = 2, camY = 3.5;
  function updateCamera(dt) {
    // Narrow (portrait) screens pull the camera back so the path ahead stays in view.
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const dist = cameraZoom * clamp(5.5 / halfWidth / 12.5, 1, 2.1);
    // The camera stops at the level's left end, but never with the hero off the left edge (the start, on a portrait phone).
    const minX = Math.min(2, player.x - 1.8 + dist * halfWidth);
    const lookAhead = player.dir * 1.4 + player.vx * .12;
    camX = damp(camX, clamp(player.x + lookAhead, minX, 111), 4.2, dt);
    camY = damp(camY, clamp(player.y + 2.5, 2.5, 7.5), 3.5, dt);
    camera.position.set(camX, camY, dist);
    camera.lookAt(camX + 0.7, camY - .65, 0);
    // The sun's shadow box follows the camera so the whole level keeps its shadows.
    sun.target.position.set(camX, 0, 0);
    sun.position.copy(SUN_OFFSET).add(sun.target.position);
  }

  let signShown = '';
  function updateSigns() {
    let nearest = null, best = 2.8;
    for (const s of signs) { const d = Math.abs(player.x - s.x); if (d < best) { best = d; nearest = s; } }
    const text = nearest && started && !player.completed ? nearest.text.replace(/\{(\w+)\}/g, (_, k) => (PROMPTS[kit.input.source] || PROMPTS.keyboard)[k]) : '';
    if (text === signShown) return;
    signShown = text;
    if (text) { signCopy.textContent = text; sign.classList.remove('hidden'); } else sign.classList.add('hidden');
  }

  function updateHUD() {
    hpRow.textContent = '';
    for (let i = 0; i < player.maxHP; i++) { const h = document.createElement('i'); h.className = 'heart' + (i >= player.hp ? ' empty' : ''); hpRow.append(h); }
    levelLabel.textContent = `LV ${player.level}`;
    const floor = player.level === 1 ? 0 : player.level === 2 ? BALANCE.level2XP : BALANCE.level3XP;
    const ceil = player.level === 1 ? BALANCE.level2XP : player.level === 2 ? BALANCE.level3XP : BALANCE.level3XP + 100;
    xpFill.style.width = `${clamp((player.xp - floor) / (ceil - floor) * 100, 0, 100)}%`;
    gearLabel.textContent = 'Gear: ' + (player.gear.length ? player.gear.map(g => g === 'SPRING_SOLES' ? 'Spring Soles' : g === 'GLOW_PIN' ? 'Glow Pin' : 'Berry Brooch').join(' · ') : 'none');
    abilityLabel.textContent = player.ability === 'NONE' ? 'PUFF' : player.ability === 'BOLT' ? 'BOLT POP' : 'LEAF LOOP';
    const order = ['main', 'branch', 'boss']; bellProgress.textContent = order.map(id => player.bells.has(id) ? '◆' : '◇').join('  ');
    objectiveCopy.textContent = !player.bells.has('main') ? 'Find the Meadow Dewbell.' : !player.bells.has('branch') ? 'Cross high or low for a second Dewbell.' : !player.bells.has('boss') ? 'Arena open: quiet the Bramble Bell.' : 'Moon Gate awake: head right and ring it.';
  }

  let toastTimer = 0;
  function toastMsg(text, ms = 1000) { toast.textContent = text; toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), ms); }
  function finishRun() {
    if (player.completed) return; player.completed = true; paused = true; sound.bell(); hud.classList.add('hidden'); sign.classList.add('hidden'); signShown = ''; soundBtn.classList.add('hidden'); helpBtn.classList.add('hidden');
    $('#complete-copy').textContent = `The path is ringing again. You finished at level ${player.level} with ${player.ability === 'NONE' ? 'no borrowed trick' : player.ability === 'BOLT' ? 'Bolt Pop' : 'Leaf Loop'} equipped.`;
    $('#stats').innerHTML = `<div><b>${player.time.toFixed(1)}s</b><span>TIME</span></div><div><b>${player.enemiesSwallowed}</b><span>SWALLOWED</span></div><div><b>${player.damageTaken}</b><span>DAMAGE</span></div>`;
    showMenu('complete');
  }

  // Automated checks read and nudge the run through this hook.
  window.__PETALWIND_TEST__ = {
    getSnapshot: () => ({ x: player.x, y: player.y, hp: player.hp, maxHP: player.maxHP, xp: player.xp, level: player.level, ability: player.ability, bells: [...player.bells], gear: [...player.gear], bossHP: boss?.hp ?? null, bossX: boss?.x ?? null, completed: player.completed, menu, particles: particles.length, projectiles: projectiles.length }),
    start: () => startRun(),
    teleport: (x, y) => { player.x = x; player.y = y; player.vx = 0; player.vy = 0; },
  };

  // The intro appears once the world is built.
  showMenu('intro');
  updateHUD();

  // One mesh per material, drawn once in front of the camera so its pipelines compile before play.
  const prewarm = new THREE.Group();
  for (const m of [...stdCache.values(), mats.spark, mats.cyan, mats.bell]) {
    const w = mesh(octa(0.001), m, true, true);
    w.frustumCulled = false;
    prewarm.add(w);
  }
  prewarm.position.set(3, 5, 10);

  function frame(dt, t) {
    const inp = kit.input;
    const playing = started && !paused && !player.completed;
    if (inputGuard > 0) inputGuard--;
    else if (menu) navigateMenu();
    else if (playing && inp.pressed('pause')) openPause();

    if (playing && !menu) {
      input.axis = inp.vector('move').x;
      input.jump = inp.down('jump');
      input.inhale = inp.down('inhale');
      input.ability = inp.down('ability');
      if (inp.pressed('jump')) input.jumpPressed = true;
      if (inp.pressed('ability')) input.abilityPressed = true;
      const z = inp.zoom();
      if (z) cameraZoom = clamp(inp.source === 'touch' ? cameraZoom * Math.exp(-z / 4) : cameraZoom - z * 0.7, 9.5, 17.5);
      const padZoom = (inp.down('zoomOut') ? 1 : 0) - (inp.down('zoomIn') ? 1 : 0);
      if (padZoom) cameraZoom = clamp(cameraZoom + padZoom * 6 * dt, 9.5, 17.5);
    } else {
      input.axis = 0; input.jump = input.inhale = input.ability = false;
      input.jumpPressed = input.abilityPressed = false;
    }

    const raw = Math.min(.05, dt);
    accumulator += raw;
    while (accumulator >= 1 / 60) { clock += 1 / 60; update(1 / 60); accumulator -= 1 / 60; }
    // Slow ambient motion.
    water.position.y = -6.1 + Math.sin(t * 1.7) * .04;
  }

  return { frame, prewarm };
}
