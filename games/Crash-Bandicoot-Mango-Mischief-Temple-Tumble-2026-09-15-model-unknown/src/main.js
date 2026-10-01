/**
 * Mango Mischief — Temple Tumble, on the shared 3D stack.
 *
 * The game logic, levels, camera and art are the original's. Rendering moved
 * from a hand-written WebGL renderer to three.js (WebGPU with WebGL2 fallback)
 * through kit/boot.js: the same flat-shaded vertex-coloured geometry, the same
 * hemisphere + sun lighting (Lambert with lights at π, colour management off,
 * as the old shader lit in display space), the same radial fog, plus a soft sun
 * shadow. Input runs through kit.input actions (keyboard/mouse, gamepad, touch).
 */

import * as THREE from 'three/webgpu';
import { vec3, floor, fract, sin, dot, positionWorld, positionView, smoothstep, fog, uniform } from 'three/tsl';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { G, rgb, TAU, clamp, lerp, rand, range, setSeed, BOX, DISC } from './geo.js';
import { LEVELS } from './levels.js';
import { buildWorld, makeFruit, makeShard, makeHero, makeCrab, makeHopper, makeBoss, makeCharm, makeGate, makeLog } from './world.js';

// The old renderer lit and fogged colours as they are, in display space.
THREE.ColorManagement.enabled = false;

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------ saved progress */

const SAVE_KEY = 'mango-mischief-save-v1';
const PREFS_KEY = 'mango-mischief-prefs';

function loadJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
function storeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: progress lasts for this visit */
  }
}

function blankRecord() {
  return { best: null, shards: 0, gem: false, relic: 0, clears: 0 };
}

function loadSave() {
  const out = { unlocked: 1, levels: {} };
  const raw = loadJSON(SAVE_KEY);
  if (raw && typeof raw === 'object') {
    out.unlocked = clamp(raw.unlocked | 0, 1, LEVELS.length);
    if (raw.levels && typeof raw.levels === 'object') {
      for (const lv of LEVELS) {
        const r = raw.levels[lv.id];
        if (!r || typeof r !== 'object') continue;
        out.levels[lv.id] = {
          best: Number.isFinite(r.best) && r.best > 0 ? r.best : null,
          shards: clamp(r.shards | 0, 0, 3),
          gem: !!r.gem,
          relic: clamp(r.relic | 0, 0, 3),
          clears: Math.max(0, r.clears | 0),
        };
      }
    }
  }
  // The first version kept only a best time for the temple: that run counts as a clear.
  let legacy = NaN;
  try {
    legacy = Number(localStorage.getItem('mango-mischief-best'));
  } catch {
    /* no storage */
  }
  if (Number.isFinite(legacy) && legacy > 0) {
    const r = out.levels.temple || (out.levels.temple = blankRecord());
    if (r.best == null || legacy < r.best) r.best = legacy;
    r.clears = Math.max(1, r.clears);
    out.unlocked = Math.max(out.unlocked, Math.min(2, LEVELS.length));
  }
  return out;
}
const save = loadSave();
const writeSave = () => storeJSON(SAVE_KEY, save);
const prefs = Object.assign({ sound: true, retro: false }, loadJSON(PREFS_KEY) || {});
const writePrefs = () => storeJSON(PREFS_KEY, prefs);

// ?level=2 opens that trail directly (handy for testing), without changing saved progress.
const urlLevel = (() => {
  const n = parseInt(new URLSearchParams(location.search).get('level'), 10);
  return Number.isFinite(n) && n >= 1 && n <= LEVELS.length ? n - 1 : -1;
})();

/* --------------------------------------------------------------------- boot */

const kit = await boot({
  title: 'Mango Mischief — Temple Tumble',
  gear: 'none', // the game's own top bar and pause menu open the settings
  accent: '#ffc04d',
  background: '#163d31',
  touch: { top: 'right', topOffset: 64 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    jump: { keys: ['Space', 'KeyK'], gamepad: ['A'], touch: 'Jump' },
    spin: { keys: ['KeyJ', 'KeyX'], mouse: [0], gamepad: ['X', 'B', 'RT'], touch: 'Spin' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    mute: { keys: ['KeyM'] },
    retro: { keys: ['KeyV'] },
    full: { keys: ['KeyF'] },
  },
});
const { input } = kit;
const renderer = kit.renderer;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
kit.canvas.setAttribute('aria-label', 'Mango Mischief 3D platform game');

/* -------------------------------------------------------- scene, camera, light */

const scene = new THREE.Scene();
const fogColor = uniform(new THREE.Color(0.48, 0.69, 0.57));
const fogNear = uniform(32);
const fogFar = uniform(89);
// The original fog: smoothstep(32, 89, distance to the eye), into the sky colour.
scene.fogNode = fog(fogColor, smoothstep(fogNear, fogFar, positionView.length()));
scene.background = new THREE.Color(0.48, 0.69, 0.57);

const camera = new THREE.PerspectiveCamera(52, 1, 0.15, 150);
kit.onResize((w, h) => {
  const aspect = w / Math.max(1, h);
  // 52° tall as before; narrow portrait screens open up so the trail still fits across.
  const fitWide = (2 * Math.atan(Math.tan((21 * Math.PI) / 180) / aspect) * 180) / Math.PI;
  camera.aspect = aspect;
  camera.fov = clamp(fitWide, 52, 78);
  camera.updateProjectionMatrix();
});

// light = hemi·(0.86 + 0.10·n.y) + sun·max(0, n·L): a hemisphere light from 0.76 to 0.96 of the
// base colour, and a directional sun; both at π because three's Lambert divides by π.
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, Math.PI);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
sun.castShadow = true;
kit.shadow(sun, 2048);
const SH = 22;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 110 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 2;
sun.shadow.intensity = 0.6;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(-0.55, 0.9, 0.38).normalize();

const post = createPost(kit, scene, camera);

/* ------------------------------------------------------------------ materials */

const DS = THREE.DoubleSide; // the old renderer never culled faces
const mats = {
  lit: new THREE.MeshLambertNodeMaterial({ vertexColors: true, side: DS }),
  grain: new THREE.MeshLambertNodeMaterial({ vertexColors: true, side: DS }),
  glow: new THREE.MeshBasicNodeMaterial({ vertexColors: true, side: DS }),
  particle: new THREE.MeshLambertNodeMaterial({ side: DS }),
  blob: new THREE.MeshBasicNodeMaterial({ color: 0x173b2a, transparent: true, opacity: 0.19, depthWrite: false, side: DS }),
  heroShadow: new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, opacity: 0.26, depthWrite: false, side: DS }),
  spinRing: new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false, side: DS }),
  portalDisc: new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, side: DS }),
  portalRing: new THREE.MeshLambertNodeMaterial({ vertexColors: true, side: DS }),
  eyes: new THREE.MeshBasicNodeMaterial({ vertexColors: true, side: DS }),
};
mats.particle.name = 'particles';
// The trail's fine grain: a hash of the 5 cm world cell, ±0.0175 added after lighting.
{
  const cell = floor(positionWorld.mul(20));
  const h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
  mats.grain.emissiveNode = vec3(h.sub(0.5).mul(0.035));
}
// The portal ring was half lit: mix(light, 1, 0.5).
mats.portalRing.color.setScalar(0.5);
mats.portalRing.emissive.setRGB(...rgb(0xf0ce7c).map((v) => v * 0.5));

const WAVE_POOL = 4;
const waveMats = Array.from({ length: WAVE_POOL }, () => new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: DS }));

/* --------------------------------------------------------------- crate art */

function crateTexture(type) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const base = type === 'boom' ? '#b9402c' : type === 'check' ? '#dea33e' : type === 'charm' ? '#368873' : type === 'nitro' ? '#3c8f3a' : '#ad6c30';
  x.fillStyle = type === 'nitro' ? '#24391f' : '#513c2c';
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = base;
  x.fillRect(6, 6, 116, 116);
  for (let i = 0; i < 5; i++) {
    x.fillStyle = i % 2 ? '#00000015' : '#ffffff0d';
    x.fillRect(8, 8 + i * 23, 112, 22);
    x.fillStyle = '#3b261b66';
    x.fillRect(8, 7 + i * 23, 112, 2);
    for (let j = 0; j < 5; j++) {
      x.fillStyle = '#ffffff16';
      x.fillRect(12 + j * 21 + (i % 2) * 8, 13 + i * 23, 12, 2);
    }
  }
  x.lineWidth = 13;
  x.strokeStyle = type === 'boom' ? '#ed9660' : type === 'charm' ? '#98bb7a' : type === 'nitro' ? '#b6e37a' : '#dfb269';
  x.strokeRect(10, 10, 108, 108);
  if (type === 'wood' || type === 'stack') {
    x.beginPath();
    x.moveTo(14, 14);
    x.lineTo(114, 114);
    x.moveTo(114, 14);
    x.lineTo(14, 114);
    x.stroke();
    x.lineWidth = 2;
    x.strokeStyle = '#95652e';
    x.strokeRect(7, 7, 114, 114);
  }
  for (const a of [12, 116])
    for (const b of [12, 116]) {
      x.fillStyle = '#4c4a35';
      x.fillRect(a - 2, b - 2, 4, 4);
    }
  const label = type === 'boom' ? 'TNT' : type === 'nitro' ? 'NITRO' : type === 'check' ? 'C' : type === 'charm' ? '✦' : type === 'bounce' ? '↑' : type === 'question' ? '?' : '';
  if (label) {
    x.font = (type === 'boom' ? '900 34px' : type === 'nitro' ? '900 25px' : '900 78px') + ' Arial';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    x.strokeStyle = type === 'nitro' ? '#1d3318' : '#473b2a';
    x.lineWidth = 7;
    x.strokeText(label, 64, 68);
    x.fillStyle = type === 'nitro' ? '#e6ffb8' : '#fff0bd';
    x.fillText(label, 64, 66);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; // crisp pixels up close, as before
  tex.minFilter = THREE.LinearMipmapLinearFilter; // and no shimmer far away
  tex.generateMipmaps = true;
  return tex;
}
const crateMats = {};
const crateMat = (type) => crateMats[type] || (crateMats[type] = new THREE.MeshLambertNodeMaterial({ map: crateTexture(type), side: DS }));

/* ------------------------------------------------------------- geometry */

/** Geo (CPU vertex data) → BufferGeometry, cached on the Geo. */
function bufferOf(geo, withUV = false) {
  if (geo.bg) return geo.bg;
  const n = geo.count, d = geo.data;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const uv = withUV ? new Float32Array(n * 2) : null;
  for (let i = 0, o = 0; i < n; i++, o += 11) {
    const i3 = i * 3;
    pos[i3] = d[o];
    pos[i3 + 1] = d[o + 1];
    pos[i3 + 2] = d[o + 2];
    nor[i3] = d[o + 3];
    nor[i3 + 1] = d[o + 4];
    nor[i3 + 2] = d[o + 5];
    col[i3] = d[o + 6];
    col[i3 + 1] = d[o + 7];
    col[i3 + 2] = d[o + 8];
    if (uv) {
      uv[i * 2] = d[o + 9];
      uv[i * 2 + 1] = d[o + 10];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  geo.bg = g;
  return g;
}

function mesh(geometry, material, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// Shared shapes, built once for both trails.
const CRATE_BG = bufferOf(G.box(), true);
const BOX_BG = bufferOf(BOX);
const DISC_BG = bufferOf(DISC);
const FRUIT_BG = bufferOf(makeFruit());
const SHARD_BG = bufferOf(makeShard());
const LOG_BG = bufferOf(makeLog());
const ROCK_BG = bufferOf(G.ball(10, 7, 0x7e8c6c));
const GATE_BG = bufferOf(makeGate());
const HOPPER_BG = bufferOf(makeHopper());
const CHARM_BG = bufferOf(makeCharm());
const WAVE_BG = bufferOf(G.ring(0.87, 1, 64, 0xffbd63));
const CRAB = (() => {
  const c = makeCrab();
  return { body: bufferOf(c.body), claws: c.claws.map((k) => ({ bg: bufferOf(k.geo), pivot: k.pivot })) };
})();

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const dummy = new THREE.Object3D();

/* ---------------------------------------------------------- persistent actors */

// The rascal: one mesh per moving part, parented like the original nodes.
const heroParts = makeHero();
const hero = { root: new THREE.Group() };
hero.body = mesh(bufferOf(heroParts.body), mats.lit);
hero.root.add(hero.body);
for (const k of ['armL', 'armR', 'legL', 'legR', 'tail']) {
  const m = mesh(bufferOf(heroParts[k]), mats.lit);
  m.position.fromArray(heroParts.pivots[k]);
  hero.body.add(m);
  hero[k] = m;
}
scene.add(hero.root);

const heroShadow = mesh(bufferOf(G.disc(24, 0x183d2b)), mats.heroShadow, { cast: false });
heroShadow.renderOrder = -1;
scene.add(heroShadow);
const spinRing = mesh(bufferOf(G.ring(0.72, 1, 28, 0xffd88a)), mats.spinRing, { cast: false });
scene.add(spinRing);
const charm = new THREE.Group();
charm.add(mesh(CHARM_BG, mats.lit));
scene.add(charm);

// Debris: one instanced batch, fixed slots, shrinking out as they fade.
const MAXP = 220;
const particleMesh = kit.instanced(BOX_BG, mats.particle, MAXP);
particleMesh.frustumCulled = false;
const parts = [];
for (let i = 0; i < MAXP; i++) {
  parts.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, rot: 0, sx: 1, sy: 1, sz: 1 });
  particleMesh.setMatrixAt(i, ZERO);
}
particleMesh.setColorAt(0, new THREE.Color(1, 1, 1));
particleMesh.count = 1;
scene.add(particleMesh);

// Soft round contact shadows under crates, critters, hazards and the guardian.
const BLOB_CAP = 128;
const blobMesh = kit.instanced(DISC_BG, mats.blob, BLOB_CAP);
blobMesh.frustumCulled = false;
blobMesh.castShadow = false;
blobMesh.renderOrder = -1;
blobMesh.setMatrixAt(0, ZERO);
blobMesh.count = 1;
scene.add(blobMesh);

// Mangoes: one instanced batch, rewritten each frame with the ones in view.
const FRUIT_CAP = 128;
const fruitMesh = kit.instanced(FRUIT_BG, mats.lit, FRUIT_CAP);
fruitMesh.frustumCulled = false;
fruitMesh.castShadow = true;
fruitMesh.setMatrixAt(0, ZERO);
fruitMesh.count = 1;
scene.add(fruitMesh);

// The guardian's shock waves.
const waves = [];
for (let i = 0; i < WAVE_POOL; i++) {
  const m = mesh(WAVE_BG, waveMats[i], { cast: false });
  m.visible = false;
  m.renderOrder = -1;
  scene.add(m);
  waves.push({ mesh: m, mat: waveMats[i], active: false, r: 0, oldR: 0, life: 0 });
}

/* -------------------------------------------------------------- the level */

let levelIndex = -1;
let L = LEVELS[0];
let inPit = () => undefined;
let levelGroup = null;
let levelTrash = [];
let crateTotal = 0;
const chunks = [], roofs = [], platforms = [], crates = [], fruits = [], shards = [], enemies = [], hazards = [];
const boss = { x: 0, s: 204, hp: 3, active: false, defeated: false, phase: 'sleep', timer: 0, hitFlash: 0, pendingWave: 0 };
let bossRoot = null, bossCore = null, bossEyes = null, bossArms = [], gate = null, portal = null, portalRing = null, endGem = null;

const ox = (s) => (L.rel ? L.center(s) : 0);

const objectApi = {
  crate(x, s, type = 'wood', base = 0) {
    const shared = type !== 'boom';
    const mat = shared ? crateMat(type) : crateMat('boom').clone(); // TNT flashes on its own
    if (!shared) levelTrash.push(mat);
    const m = mesh(CRATE_BG, mat, { receive: true });
    m.scale.setScalar(1.15);
    const X = x + ox(s);
    m.position.set(X, base + 0.575, -s);
    levelGroup.add(m);
    crates.push({ mesh: m, mat, x: X, s, base, type, broken: false, fuse: 0, tick: 0, initialBase: base, counts: type !== 'nitro', phase: rand() * TAU });
  },
  fruit(x, s, y = 1.05) {
    fruits.push({ x: x + ox(s), s, y, dead: false, phase: rand() * TAU });
  },
  fruits(x, a, b, step = 1.7, y = 1.05) {
    for (let s = a; s <= b; s += step) objectApi.fruit(x, s, y);
  },
  enemy(x, s, speed = 1.5, kind = 'crab') {
    const root = new THREE.Group();
    const claws = [];
    if (kind === 'hopper') root.add(mesh(HOPPER_BG, mats.lit));
    else {
      root.add(mesh(CRAB.body, mats.lit));
      for (const c of CRAB.claws) {
        const m = mesh(c.bg, mats.lit);
        m.position.fromArray(c.pivot);
        root.add(m);
        claws.push(m);
      }
    }
    const X = x + ox(s);
    root.position.set(X, 0, -s);
    levelGroup.add(root);
    enemies.push({ root, claws, kind, x: X, s, y: 0, baseX: X, baseS: s, speed, dead: false, fly: 0, phase: rand() * TAU, squash: 0, air: false, dir: 1 });
  },
  shard(x, s, y) {
    const m = mesh(SHARD_BG, mats.lit);
    const X = x + ox(s);
    m.position.set(X, y, -s);
    levelGroup.add(m);
    shards.push({ mesh: m, x: X, s, y, dead: false });
  },
  log(s) {
    const m = mesh(LOG_BG, mats.lit);
    levelGroup.add(m);
    hazards.push({ mesh: m, type: 'log', s, x: ox(s), x0: ox(s) });
  },
  rock(s) {
    const m = mesh(ROCK_BG, mats.lit);
    m.scale.setScalar(1.05);
    levelGroup.add(m);
    hazards.push({ mesh: m, type: 'rock', s, x: ox(s), x0: ox(s) });
  },
};

function unloadLevel() {
  if (levelGroup) scene.remove(levelGroup);
  for (const t of levelTrash) t.dispose();
  levelTrash = [];
  for (const list of [chunks, roofs, platforms, crates, fruits, shards, enemies, hazards]) list.length = 0;
  levelGroup = null;
  bossRoot = bossCore = bossEyes = gate = portal = portalRing = endGem = null;
  bossArms = [];
}

function applyLook(look) {
  const [hr, hg, hb] = look.hemi;
  hemi.color.setRGB(hr * 0.96, hg * 0.96, hb * 0.96);
  hemi.groundColor.setRGB(hr * 0.76, hg * 0.76, hb * 0.76);
  sun.color.setRGB(...look.sun);
  sunDir.set(...look.sunDir).normalize();
  fogColor.value.setRGB(...look.fog);
  scene.background.setRGB(...look.fog);
}

function loadLevel(i) {
  unloadLevel();
  levelIndex = i;
  L = LEVELS[i];
  levelGroup = new THREE.Group();
  scene.add(levelGroup);

  const W = buildWorld(L);
  inPit = W.inPit;
  for (const c of W.chunks) {
    const geom = bufferOf(c.geo);
    c.geo.data = null; // the GPU copy is all we need now
    levelTrash.push(geom);
    const m = mesh(geom, c.grain ? mats.grain : mats.lit, { receive: true });
    levelGroup.add(m);
    chunks.push({ mesh: m, start: c.start, always: !!c.always });
  }
  for (const r of W.roofs) {
    const geom = bufferOf(r.geo);
    const mat = new THREE.MeshLambertNodeMaterial({ vertexColors: true, side: DS, transparent: true });
    levelTrash.push(geom, mat);
    const m = mesh(geom, mat, { receive: true });
    levelGroup.add(m);
    roofs.push({ mesh: m, mat, s: r.s });
  }
  for (const pl of W.platforms) {
    const geom = bufferOf(pl.geo);
    levelTrash.push(geom);
    pl.mesh = mesh(geom, mats.lit, { receive: true });
    pl.mesh.position.set(pl.x, 0, -pl.s);
    levelGroup.add(pl.mesh);
    platforms.push(pl);
  }
  if (W.glow) {
    const geom = bufferOf(W.glow);
    levelTrash.push(geom);
    levelGroup.add(mesh(geom, mats.glow, { cast: false }));
  }
  applyLook(L.look);

  setSeed(L.seed + 7);
  L.objects(objectApi);
  crateTotal = crates.filter((c) => c.counts).length;

  // The guardian, its gate and the portal home.
  const S = L.boss.s;
  const bm = makeBoss(L.boss.palette);
  const coreGeom = bufferOf(bm.core), eyeGeom = bufferOf(bm.eyes);
  levelTrash.push(coreGeom, eyeGeom);
  bossRoot = new THREE.Group();
  bossCore = new THREE.Group();
  bossRoot.add(bossCore);
  bossCore.add(mesh(coreGeom, mats.lit));
  bossEyes = mesh(eyeGeom, mats.eyes, { cast: false });
  bossCore.add(bossEyes);
  for (const a of bm.arms) {
    const g = bufferOf(a.geo);
    levelTrash.push(g);
    const m = mesh(g, mats.lit);
    m.position.fromArray(a.pivot);
    bossCore.add(m);
    bossArms.push(m);
  }
  boss.x = 0;
  boss.s = S;
  bossRoot.position.set(boss.x, 0, -S);
  levelGroup.add(bossRoot);
  gate = mesh(GATE_BG, mats.lit, { receive: true });
  gate.position.set(0, 0, -(S + 10));
  levelGroup.add(gate);
  portal = new THREE.Group();
  portal.position.set(0, 2, -(S + 15));
  const disc = mesh(bufferOf(G.disc(48, 0x51d2af)), mats.portalDisc, { cast: false });
  levelTrash.push(disc.geometry);
  disc.rotation.set(Math.PI / 2, 0, 0);
  disc.scale.set(1.5, 1, 1.5);
  portalRing = mesh(bufferOf(G.ring(0.88, 1, 48, 0xf0ce7c)), mats.portalRing, { cast: false });
  levelTrash.push(portalRing.geometry);
  portalRing.scale.set(1.8, 1, 1.8);
  endGem = mesh(SHARD_BG, mats.lit, { cast: false });
  endGem.position.set(0, 0, 0.2);
  endGem.scale.setScalar(1.25);
  portal.add(disc, portalRing, endGem);
  portal.visible = false;
  levelGroup.add(portal);

  // HUD labels for this trail.
  setText($('level-name'), L.name);
  setText($('boss-name'), L.boss.name);
  const pips = $('boss-health');
  pips.textContent = '';
  for (let k = 0; k < L.boss.hp; k++) pips.append(document.createElement('i'));
  hudEls.pips = [...pips.children];
  hudEls.crateTotal.textContent = ' / ' + crateTotal;
  boss.defeated = false;
  resetBoss();
}

/** Height of the walkable surface at (x, s), or null over a gap. */
function groundAt(x, s) {
  const q = inPit(s), c = L.center(s);
  if (Math.abs(x - c) > L.halfWidth(s) + 0.2 || s < -5 || s > L.length + 5) return null;
  if (!q) return 0;
  if (q.bridge && Math.abs(x - (c + (q.bridgeX ?? 2))) < 1.05) return 0.1;
  if (q.island && s > q.island[0] && s < q.island[1] && Math.abs(x - c) < 1.5) return 0.1;
  if (q.moving) for (const pl of platforms) if (pl.pit === q && Math.abs(s - pl.s) < 1.35 && Math.abs(x - pl.x) < 1.35) return pl.y;
  return null;
}

/* ----------------------------------------------------------------------- audio */

const audio = {
  ctx: null,
  master: null,
  enabled: prefs.sound !== false,
  next: 0,
  beat: 0,
  noiseBuffers: new Map(),
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.28 : 0;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended' && !kit.paused) this.ctx.resume().catch(() => {});
    this.next = this.ctx.currentTime + 0.05;
  },
  pauseAll(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  },
  tone(f, d = 0.15, type = 'sine', volume = 0.2, delay = 0, end = 0) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.007);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + d + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  },
  noise(d = 0.18, v = 0.2, f = 1100) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const key = Math.round(d * 100);
    let b = this.noiseBuffers.get(key);
    if (!b) {
      b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * d)), c.sampleRate);
      const a = b.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 2);
      this.noiseBuffers.set(key, b);
    }
    const s = c.createBufferSource(), g = c.createGain(), filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = f;
    filter.Q.value = 0.7;
    s.buffer = b;
    g.gain.value = v;
    s.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    s.start();
    s.onended = () => {
      s.disconnect();
      g.disconnect();
      filter.disconnect();
    };
  },
  play(name) {
    if (!this.enabled) return;
    if (name === 'jump') {
      this.tone(285, 0.13, 'sine', 0.5, 0, 690);
      this.tone(170, 0.08, 'triangle', 0.13);
    } else if (name === 'spin') {
      this.noise(0.28, 0.7, 700);
      this.tone(280, 0.2, 'triangle', 0.12, 0, 90);
    } else if (name === 'crate') {
      this.noise(0.15, 0.9, 1700);
      this.tone(160, 0.12, 'triangle', 0.4, 0, 70);
    } else if (name === 'fruit') {
      this.tone(880 + (fruitCombo % 5) * 110, 0.1, 'sine', 0.28);
      this.tone(1320, 0.09, 'sine', 0.1, 0.04);
    } else if (name === 'land') {
      this.noise(0.08, 0.25, 400);
      this.tone(90, 0.07, 'sine', 0.3);
    } else if (name === 'hit') {
      this.noise(0.2, 0.65, 800);
      this.tone(220, 0.28, 'sawtooth', 0.22, 0, 75);
    } else if (name === 'boom') {
      this.noise(0.55, 1.3, 250);
      this.tone(90, 0.5, 'triangle', 0.6, 0, 30);
    } else if (name === 'check') {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.26, i * 0.09));
    } else if (name === 'shard') {
      [784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.45, 'sine', 0.26, i * 0.08));
    } else if (name === 'tick') {
      this.tone(640, 0.05, 'square', 0.1);
    } else if (name === 'slam') {
      this.tone(72, 0.6, 'sine', 0.9, 0, 30);
      this.noise(0.45, 0.75, 350);
    } else if (name === 'win') {
      [523, 659, 784, 1047, 988, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.22, i * 0.13));
    } else if (name === 'death') {
      [330, 294, 220, 110].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.3, i * 0.13));
    } else if (name === 'menu') {
      this.tone(660, 0.05, 'triangle', 0.08);
    }
  },
  music() {
    if (!this.ctx || !this.enabled || state !== 'playing') return;
    const c = this.ctx;
    const step = 0.142;
    if (this.next < c.currentTime - 0.5) this.next = c.currentTime;
    const melody = L.melody;
    while (this.next < c.currentTime + 0.1) {
      const b = this.beat++, d = this.next - c.currentTime;
      const note = melody[b % 32];
      if (note) {
        this.tone(note, 0.15, 'sine', 0.14, d);
        this.tone(note * 2, 0.055, 'sine', 0.03, d);
      }
      if (b % 4 === 0) this.tone(b % 8 === 0 ? 82 : 110, 0.2, 'sine', 0.28, d, 42);
      if (b % 4 === 2) this.tone(180, 0.07, 'triangle', 0.12, d, 65);
      if (b % 2) this.tone(2200, 0.019, 'triangle', 0.035, d);
      this.next += step;
    }
  },
  toggle() {
    this.init();
    this.enabled = !this.enabled;
    prefs.sound = this.enabled;
    writePrefs();
    this.syncButton();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.enabled ? 0.28 : 0, this.ctx.currentTime, 0.025);
  },
  syncButton() {
    const b = $('audio-button');
    b.setAttribute('aria-pressed', String(!this.enabled));
    b.style.opacity = this.enabled ? '1' : '.55';
  },
};
audio.syncButton();
// Browsers start sound only after a click, tap or key: unlock on the first one.
const unlockAudio = () => audio.init();
addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
addEventListener('keydown', unlockAudio, { once: true, capture: true });
kit.onPause((paused) => audio.pauseAll(paused));

/* ---------------------------------------------------------------- HUD and UI */

const hudEls = {
  hud: $('hud'),
  fruit: $('fruit-count'),
  crate: $('crate-count'),
  crateTotal: $('crate-total'),
  lives: $('lives-count'),
  hearts: [...document.querySelectorAll('.heart')],
  shards: [...document.querySelectorAll('.shard-count span')],
  charm: $('charm-icon'),
  progress: $('progress-fill'),
  time: $('time-display'),
  areaNum: $('area-number'),
  areaName: $('area-name'),
  bossHud: $('boss-hud'),
  bossPrompt: $('boss-prompt'),
  pips: [],
  toast: $('toast'),
  toastTitle: $('toast').querySelector('strong'),
  toastSub: $('toast').querySelector('small'),
  hint: $('hint'),
  flash: $('flash'),
  fade: $('fade'),
  controls: $('controls'),
};

/** Write text only when it changed (no layout work every frame). */
function setText(el, v) {
  v = String(v);
  if (el._v !== v) {
    el._v = v;
    el.textContent = v;
  }
}
function setStyle(el, prop, v) {
  const k = '_s_' + prop;
  if (el[k] !== v) {
    el[k] = v;
    el.style[prop] = v;
  }
}

const PROMPTS = {
  keyboard: { JUMP: '<b>SPACE</b>', SPIN: '<b>J</b> or <b>X</b>', MOVE: '<b>W A S D</b> or <b>arrow keys</b>' },
  gamepad: { JUMP: '<b>A</b>', SPIN: '<b>X</b>', MOVE: 'the <b>left stick</b>' },
  touch: { JUMP: '<b>JUMP</b>', SPIN: '<b>SPIN</b>', MOVE: 'the <b>stick</b>' },
};
const source = () => (input.source === 'gamepad' ? 'gamepad' : input.source === 'touch' || kit.touch?.visible ? 'touch' : 'keyboard');
const fillPrompts = (text) => text.replace(/\{(JUMP|SPIN|MOVE)\}/g, (_, k) => PROMPTS[source()][k]);

function toast(title, sub = '', duration = 3) {
  hudEls.toastTitle.textContent = title;
  hudEls.toastSub.textContent = sub;
  hudEls.toast.classList.add('show');
  toastTime = duration;
}
function hint(text, duration = 5) {
  hudEls.hint.innerHTML = fillPrompts(text);
  hudEls.hint.classList.add('show');
  hintTime = duration;
}
function startHint() {
  const src = source();
  if (src === 'touch') return 'Use the <b>stick</b> on the left to move. <b>JUMP</b> and <b>SPIN</b> are on the right.';
  if (src === 'gamepad') return 'Use the <b>left stick</b> to move. <b>A</b> jumps, <b>X</b> spins. Your adventure is just ahead.';
  return 'Use <b>W A S D</b> or <b>arrow keys</b> to move. Your adventure is just ahead.';
}

const _proj = new THREE.Vector3();
function number(text, x, y, s) {
  _proj.set(x, y, -s).applyMatrix4(camera.matrixWorldInverse);
  if (_proj.z > -0.2) return; // behind the camera
  _proj.applyMatrix4(camera.projectionMatrix);
  const e = document.createElement('div');
  e.className = 'floating-number';
  e.textContent = text;
  e.style.left = ((_proj.x + 1) / 2) * kit.size.width + 'px';
  e.style.top = ((1 - _proj.y) / 2) * kit.size.height + 'px';
  document.body.append(e);
  setTimeout(() => e.remove(), 850);
}

function updateControlsBar() {
  const src = source();
  let html = '';
  if (src === 'gamepad') {
    html = '<span class="control"><kbd>L</kbd> MOVE</span><span class="control"><kbd>A</kbd> JUMP</span><span class="control"><kbd>X</kbd> SPIN</span><span class="control wide"><kbd>START</kbd> PAUSE</span>';
  } else if (src === 'keyboard') {
    html = '<span class="control"><span class="move-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> MOVE</span><span class="control wide"><kbd>SPACE</kbd> JUMP</span><span class="control"><kbd>J</kbd> SPIN</span><span class="control"><kbd>ESC</kbd> PAUSE</span>';
  }
  if (hudEls.controls._v !== html) {
    hudEls.controls._v = html;
    hudEls.controls.innerHTML = html;
  }
}

function buildGuide() {
  const src = source();
  const rows =
    src === 'gamepad'
      ? [
          ['L STICK', 'Move', 'The D-pad works too. Explore at your own speed.'],
          ['A', 'Jump', 'Hold for a higher jump. Land on crates or crabs.'],
          ['X', 'Spin', 'Break crates. Knock away crabs. Hold to repeat. B and RT spin too.'],
          ['START', 'Take a break', 'Pause the game. Settings are in the pause menu.'],
        ]
      : src === 'touch'
        ? [
            ['STICK', 'Move', 'Put your thumb anywhere on the left side.'],
            ['JUMP', 'Jump', 'Hold for a higher jump. Land on crates or crabs.'],
            ['SPIN', 'Spin', 'Break crates. Knock away crabs. Hold to repeat.'],
            ['II', 'Take a break', 'Pause the game. Sound and pixels are up in the corner.'],
          ]
        : [
            ['W A S D', 'Move', 'Arrow keys also work. Explore at your own speed.'],
            ['SPACE', 'Jump', 'Hold for a higher jump. Land on crates or crabs.'],
            ['J X', 'Spin', 'Break crates. Knock away crabs. Hold to repeat.'],
            ['ESC', 'Take a break', 'Pause the game. M changes the sound, V the pixels.'],
          ];
  const box = $('guide-rows');
  box.textContent = '';
  for (const [key, title, text] of rows) {
    const row = document.createElement('div');
    row.className = 'guide-row';
    const k = document.createElement('div');
    for (const part of key.split(' ')) {
      const kb = document.createElement('kbd');
      kb.textContent = part;
      k.append(kb, ' ');
    }
    const d = document.createElement('div');
    const st = document.createElement('strong');
    st.textContent = title;
    const sp = document.createElement('span');
    sp.textContent = text;
    d.append(st, sp);
    row.append(k, d);
    box.append(row);
  }
}

input.onSourceChange(() => {
  updateControlsBar();
  if (!$('help').classList.contains('hidden')) buildGuide();
});
updateControlsBar();

// Keep the touch pause pill just under the top buttons, and the hearts under the pill.
const topButtons = document.querySelector('.top-buttons');
kit.onResize(() => {
  const r = topButtons.getBoundingClientRect();
  kit.touch?.placeTop('right', Math.round(r.bottom + 6));
});

/* ---------------------------------------------------------------------- state */

let state = 'menu', previousState = 'menu', time = 0, elapsed = 0;
let fruitCount = 0, crateCount = 0, shardCount = 0, fruitCombo = 0, deaths = 0;
let shake = 0, flash = 0, toastTime = 0, hintTime = 0, deathTimer = 0, deathStart = 0, winTimer = 0, uiTimer = 0, runDust = 0;
let camS = 4, camX = 0;
let busy = false;
const p = { x: 0, s: 4, y: 0, vy: 0, vx: 0, vs: 0, hp: 3, lives: 3, charm: 0, spin: 0, spinCD: 0, inv: 0, grounded: true, coyote: 0.12, jumpBuffer: 0, yaw: 0, squash: 0, walk: 0 };
const checkpoint = { x: 0, s: 4 };
const hintSeen = new Set();
const ctl = { x: 0, z: 0, jumpHeld: false, spin: false };

/** Touch controls only while playing; the game's own menus take taps directly. */
function syncTouch() {
  kit.touch?.suspend(state !== 'playing', 'game');
}

/* ----------------------------------------------------------- particles, blobs */

const _col = new THREE.Color();
let partCursor = 0, partColorsDirty = false;
function burst(x, y, s, n = 12, color = 0xffbf55, force = 4) {
  const co = rgb(color);
  _col.setRGB(co[0], co[1], co[2]);
  for (let i = 0; i < n; i++) {
    let slot = -1;
    for (let k = 0; k < MAXP; k++) {
      const j = (partCursor + k) % MAXP;
      if (parts[j].life <= 0) {
        slot = j;
        break;
      }
    }
    if (slot < 0) return;
    partCursor = (slot + 1) % MAXP;
    const a = parts[slot], size = range(0.045, 0.13);
    a.sx = size;
    a.sy = range(0.06, 0.2);
    a.sz = size;
    a.x = x;
    a.y = y;
    a.z = -s;
    a.vx = range(-force, force);
    a.vy = range(1, force + 2);
    a.vz = range(-force, force);
    a.life = range(0.3, 0.85);
    a.rot = range(-8, 8);
    a.rx = a.rz = 0;
    particleMesh.setColorAt(slot, _col);
    partColorsDirty = true;
  }
}
function clearParticles() {
  for (let i = 0; i < MAXP; i++) {
    parts[i].life = 0;
    particleMesh.setMatrixAt(i, ZERO);
  }
  particleMesh.count = 1;
  particleMesh.instanceMatrix.needsUpdate = true;
}
function updateParticles(dt) {
  let top = 0;
  for (let i = 0; i < MAXP; i++) {
    const a = parts[i];
    if (a.life <= 0) continue;
    a.life -= dt;
    if (a.life <= 0) {
      particleMesh.setMatrixAt(i, ZERO);
      continue;
    }
    a.vy -= 12 * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.z += a.vz * dt;
    a.rx += a.rot * dt;
    a.rz += a.rot * dt * 0.7;
    const f = Math.min(1, a.life * 3);
    dummy.position.set(a.x, a.y, a.z);
    dummy.rotation.set(a.rx, 0, a.rz);
    dummy.scale.set(a.sx * f, a.sy * f, a.sz * f);
    dummy.updateMatrix();
    particleMesh.setMatrixAt(i, dummy.matrix);
    top = i + 1;
  }
  particleMesh.count = Math.max(1, top);
  particleMesh.instanceMatrix.needsUpdate = true;
  if (partColorsDirty && particleMesh.instanceColor) {
    particleMesh.instanceColor.needsUpdate = true;
    partColorsDirty = false;
  }
}

let blobCount = 0;
function blob(x, s, size) {
  if (blobCount >= BLOB_CAP) return;
  dummy.position.set(x, 0.032, -s);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(size, 1, size * 0.6);
  dummy.updateMatrix();
  blobMesh.setMatrixAt(blobCount++, dummy.matrix);
}

function spawnWave() {
  const w = waves.find((v) => !v.active);
  if (!w) return;
  w.active = true;
  w.r = 0.4;
  w.oldR = 0;
  w.life = 2.3;
  w.mesh.visible = true;
  w.mesh.position.set(boss.x, 0.1, -boss.s);
  w.mesh.scale.set(w.r, 1, w.r);
  w.mat.opacity = 0.8;
}
function clearWaves() {
  for (const w of waves) {
    w.active = false;
    w.mesh.visible = false;
  }
}

/* ------------------------------------------------------------------ the rules */

function giveFruit(n, x = p.x, s = p.s, show = false) {
  const old = fruitCount;
  fruitCount += n;
  fruitCombo++;
  audio.play('fruit');
  if (show) number('+' + n, x, 1.8, s);
  if (Math.floor(fruitCount / 100) > Math.floor(old / 100)) {
    p.lives++;
    p.hp = 3;
    toast('SWEET!', '100 MANGOES · ONE EXTRA LIFE');
    audio.play('check');
  }
}

function breakCrate(c, method = 'spin') {
  if (c.broken) return;
  if (c.type === 'nitro') {
    explode(c);
    return;
  }
  if (c.type === 'boom') {
    if (method === 'jump') {
      if (c.fuse <= 0) {
        c.fuse = 3.01;
        c.tick = 4;
        audio.play('tick');
      }
    } else explode(c);
    return;
  }
  c.broken = true;
  c.mesh.visible = false;
  crateCount++;
  burst(c.x, c.base + 0.7, c.s, 14, c.type === 'charm' ? 0x6ed6a1 : 0xd9a455, 3.7);
  audio.play('crate');
  input.rumble(0.25, 60);
  shake = Math.max(shake, 0.1);
  const n = c.type === 'question' ? 8 : c.type === 'bounce' ? 5 : 3;
  giveFruit(n, c.x, c.s, true);
  if (c.type === 'check') {
    checkpoint.s = c.s + 1.65;
    checkpoint.x = c.x;
    p.hp = 3;
    toast('CHECKPOINT!', 'A LITTLE PROGRESS. A LOT OF MANGOES.');
    audio.play('check');
  }
  if (c.type === 'charm') {
    p.charm = 1;
    toast('LEAF CHARM', 'ONE FREE HIT. USE IT WELL.', 2.5);
    audio.play('shard');
  }
}

function explode(c) {
  if (c.broken) return;
  c.broken = true;
  c.fuse = 0;
  c.mesh.visible = false;
  if (c.counts) crateCount++;
  const green = c.type === 'nitro';
  burst(c.x, c.base + 0.6, c.s, 26, green ? 0x9cf06a : 0xffb243, 7);
  burst(c.x, c.base + 0.5, c.s, 12, green ? 0x3fbf4a : 0xe57736, 6);
  audio.play('boom');
  shake = 0.5;
  const near = Math.hypot(p.x - c.x, p.s - c.s);
  if (near < 12) input.rumble(near < 4 ? 0.85 : 0.4, 260);
  if (near < 2.25 && Math.abs(p.y - c.base) < 3) hurt(2, c.x, c.s);
  for (const other of crates) {
    if (other === c || other.broken || Math.hypot(other.x - c.x, other.s - c.s) >= 1.9 || Math.abs(other.base - c.base) >= 1.6) continue;
    if (other.type === 'boom' || other.type === 'nitro') {
      if (!other.fuse) other.fuse = 0.12;
    } else breakCrate(other, 'blast');
  }
  for (const e of enemies) if (!e.dead && Math.hypot(e.x - c.x, e.s - c.s) < 2.5) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  e.fly = 0.9;
  audio.play('crate');
  burst(e.x, e.y + 0.55, e.s, 12, e.kind === 'hopper' ? 0x8fd06a : 0xf4c07b, 3.5);
  giveFruit(2, e.x, e.s, true);
  shake = Math.max(shake, 0.08);
  input.rumble(0.3, 70);
}

function hurt(amount, fromX = p.x, fromS = p.s + 1) {
  if (p.inv > 0 || state !== 'playing') return;
  p.inv = 1.65;
  flash = 0.7;
  shake = 0.3;
  audio.play('hit');
  input.rumble(0.7, 220);
  const d = Math.hypot(p.x - fromX, p.s - fromS) || 1;
  p.vx = ((p.x - fromX) / d) * 7;
  p.vs = ((p.s - fromS) / d) * 7;
  p.vy = Math.max(p.vy, 5);
  p.grounded = false;
  if (p.charm) {
    p.charm = 0;
    burst(p.x, p.y + 1.5, p.s, 15, 0x84e5ad, 5);
    toast('CHARM SAVED YOU', 'THE NEXT HIT IS ON YOU.', 2);
    return;
  }
  p.hp = Math.max(0, p.hp - amount);
  if (p.hp === 0) die('hit');
}

function die(reason) {
  if (state !== 'playing') return;
  state = 'dying';
  deaths++;
  p.lives--;
  p.hp = 0;
  p.spin = 0;
  p.jumpBuffer = 0;
  deathTimer = 1.15;
  deathStart = time;
  audio.play('death');
  input.rumble(0.9, 380);
  hudEls.hint.classList.remove('show');
  setText(hudEls.bossPrompt, '');
  if (reason === 'fall') toast('MIND THE GAP', 'YOUR CHECKPOINT IS WAITING.', 1.3);
  else toast('A LITTLE TOO WILD', 'LET’S TRY THAT AGAIN.', 1.3);
  syncTouch();
}

function resetBoss() {
  boss.hp = L.boss.hp;
  boss.active = false;
  boss.phase = 'sleep';
  boss.timer = 0;
  boss.hitFlash = 0;
  boss.pendingWave = 0;
  if (bossCore) {
    bossCore.position.set(0, 0, 0);
    bossCore.rotation.set(0, 0, 0);
    for (const a of bossArms) a.rotation.set(0, 0, 0);
    if (!boss.defeated) bossRoot.visible = true;
  }
  clearWaves();
}

function respawn() {
  Object.assign(p, { x: checkpoint.x, s: checkpoint.s, y: 0, vy: 0, vx: 0, vs: 0, hp: 3, spin: 0, spinCD: 0, inv: 2.5, grounded: true, coyote: 0.12, jumpBuffer: 0, yaw: 0, squash: 0 });
  if (boss.active && !boss.defeated) resetBoss();
  state = 'playing';
  hudEls.fade.classList.remove('on');
  $('gameover').classList.add('hidden');
  hudEls.toast.classList.remove('show');
  toastTime = 0;
  input.settle();
  camS = p.s;
  camX = p.x;
  audio.init();
  syncTouch();
  updateHUD();
}

function startGame() {
  for (const c of crates) {
    c.broken = false;
    c.mesh.visible = true;
    c.base = c.initialBase;
    c.fuse = 0;
    c.tick = 0;
    c.mesh.rotation.set(0, 0, 0);
    if (c.type === 'boom') c.mat.color.setRGB(1, 1, 1);
  }
  for (const f of fruits) f.dead = false;
  for (const f of shards) {
    f.dead = false;
    f.mesh.visible = true;
  }
  for (const e of enemies) {
    e.dead = false;
    e.fly = 0;
    e.x = e.baseX;
    e.s = e.baseS;
    e.y = 0;
    e.root.visible = true;
    e.root.position.set(e.baseX, 0, -e.baseS);
    e.root.rotation.set(0, 0, 0);
    e.root.scale.set(1, 1, 1);
  }
  fruitCount = crateCount = shardCount = deaths = elapsed = 0;
  fruitCombo = 0;
  audio.beat = 0;
  clearParticles();
  clearWaves();
  hintSeen.clear();
  Object.assign(checkpoint, L.start);
  Object.assign(p, { lives: 3, charm: 0 });
  boss.defeated = false;
  resetBoss();
  for (const id of ['menu', 'pause', 'help', 'victory', 'gameover', 'levels']) $(id).classList.add('hidden');
  hudEls.hud.classList.remove('hidden');
  $('pause-button').classList.remove('hidden');
  hudEls.bossHud.classList.add('hidden');
  setText(hudEls.bossPrompt, '');
  document.body.classList.add('playing');
  gate.position.y = 0;
  portal.visible = false;
  respawn();
  p.inv = 0;
  hint(startHint(), 6);
  toast(L.name, `SUNSTONE ISLAND · TRAIL ${L.num}`, 2.2);
  kit.canvas.focus({ preventScroll: true });
  audio.init();
  audio.play('check');
}

/** Start a trail, building it first when another one is loaded. */
async function startLevel(i) {
  if (busy) return;
  if (i !== levelIndex) {
    busy = true;
    state = 'loading';
    syncTouch();
    for (const id of ['menu', 'levels', 'victory', 'gameover', 'pause', 'help']) $(id).classList.add('hidden');
    hudEls.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, 260));
    try {
      loadLevel(i);
    } finally {
      busy = false;
    }
  }
  startGame();
}

function pauseGame() {
  if (state === 'playing') {
    previousState = state;
    state = 'paused';
    $('pause').classList.remove('hidden');
    navFocus($('resume-button'));
    input.settle();
    syncTouch();
  } else if (state === 'paused') resumeGame();
}

function resumeGame() {
  if (state !== 'paused' && state !== 'help') return;
  state = 'playing';
  $('pause').classList.add('hidden');
  $('help').classList.add('hidden');
  kit.canvas.focus({ preventScroll: true });
  audio.init();
  input.settle();
  syncTouch();
}

function menu() {
  state = 'menu';
  previousState = 'menu';
  input.settle();
  document.body.classList.remove('playing');
  for (const id of ['pause', 'help', 'victory', 'gameover', 'hud', 'pause-button', 'levels']) $(id).classList.add('hidden');
  $('menu').classList.remove('hidden');
  hudEls.toast.classList.remove('show');
  hudEls.fade.classList.remove('on');
  p.x = 1.9;
  p.s = 5;
  p.y = 0;
  p.vx = p.vs = p.vy = 0;
  hero.root.visible = true;
  camS = 4;
  camX = 0;
  updateMenuProgress();
  navFocus($('start-button'));
  syncTouch();
}

function help() {
  previousState = state;
  if (state === 'playing') state = 'help';
  buildGuide();
  $('help').classList.remove('hidden');
  navFocus($('help-done'));
  input.settle();
  syncTouch();
}

function closeHelp() {
  $('help').classList.add('hidden');
  if (previousState === 'playing') {
    state = 'playing';
    audio.init();
  } else if (previousState === 'paused') {
    state = 'paused';
    navFocus($('resume-button'));
  } else {
    state = 'menu';
    navFocus($('start-button'));
  }
  input.settle();
  syncTouch();
}

function finish() {
  if (state !== 'playing') return;
  state = 'winning';
  winTimer = 1.5;
  audio.play('win');
  input.rumble(0.5, 300);
  burst(p.x, 3, p.s, 100, 0xffce76, 8);
  burst(p.x, 3, p.s, 50, 0x78dab2, 8);
  toast(L.finishToast[0], L.finishToast[1], 3);
  hudEls.hint.classList.remove('show');
  syncTouch();
}

const RELICS = ['', 'BRONZE', 'SILVER', 'GOLD'];
function relicFor(t, lv) {
  return t <= lv.relic[0] ? 3 : t <= lv.relic[1] ? 2 : t <= lv.relic[2] ? 1 : 0;
}

function formatTime(t, decimal = true) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + (decimal ? '.' + Math.floor((t % 1) * 10) : '');
}

function showResults() {
  state = 'won';
  syncTouch();
  hudEls.toast.classList.remove('show');
  const rec = save.levels[L.id] || (save.levels[L.id] = blankRecord());
  const prevBest = rec.best;
  const relic = relicFor(elapsed, L);
  const allCrates = crateCount >= crateTotal;
  rec.clears += 1;
  rec.shards = Math.max(rec.shards, shardCount);
  rec.gem = rec.gem || allCrates;
  rec.relic = Math.max(rec.relic, relic);
  const newBest = prevBest == null || elapsed < prevBest;
  if (newBest) rec.best = elapsed;
  const next = levelIndex + 1 < LEVELS.length ? levelIndex + 1 : -1;
  const unlockedNew = next >= 0 && save.unlocked < next + 1;
  if (unlockedNew) save.unlocked = next + 1;
  writeSave();

  $('victory-tag').textContent = `SUNSTONE ISLAND / TRAIL ${L.num} COMPLETE`;
  $('victory-title').innerHTML = L.resultTitle;
  $('result-desc').innerHTML = L.resultText;
  $('result-time').textContent = formatTime(elapsed, false);
  $('result-crates').textContent = crateCount + '/' + crateTotal;
  $('result-fruit').textContent = fruitCount;
  const lines = [
    '✦ ' + shardCount + ' / 3 sun shards found' + (shardCount === 3 ? ' — SUNSTONE COLLECTOR' : ''),
    allCrates ? '◆ Every crate broken — ISLAND CLEANUP' : '◆ ' + (crateTotal - crateCount) + ' crates left for your next trip',
    deaths === 0 ? '★ No falls or lost lives — CLEAN RUN' : '↻ ' + deaths + ' ' + (deaths === 1 ? 'retry' : 'retries') + ' — PERSISTENCE PAYS',
    relic
      ? `◈ <span class="relic-${RELICS[relic].toLowerCase()}">${RELICS[relic]} RELIC</span>` + (relic < 3 ? ` — ${formatTime(L.relic[3 - relic - 1], false)} for ${RELICS[relic + 1].toLowerCase()}` : ' — FASTEST RASCAL')
      : `◈ No relic yet — finish in ${formatTime(L.relic[2], false)} for bronze`,
  ];
  if (unlockedNew) lines.push(`➜ New trail open: ${LEVELS[next].name}`);
  $('result-medals').innerHTML = lines.join('<br>');
  $('best-time').textContent = (newBest ? 'NEW BEST · ' : 'YOUR BEST · ') + formatTime(rec.best, false);

  const nextBtn = $('next-button'), again = $('again-button');
  if (next >= 0) {
    nextBtn.innerHTML = `CONTINUE TO ${LEVELS[next].name} <b>→</b>`;
    nextBtn.classList.remove('hidden');
    again.className = 'secondary';
    again.textContent = 'PLAY THIS TRAIL AGAIN';
  } else {
    nextBtn.classList.add('hidden');
    again.className = 'primary';
    again.textContent = 'ONE MORE ADVENTURE →';
  }
  $('victory').classList.remove('hidden');
  navFocus(next >= 0 ? nextBtn : again);
}

/* ------------------------------------------------------------- title and trails */

function recordLine(lv) {
  const r = save.levels[lv.id];
  if (!r || !r.clears) return lv.blurb;
  const bits = [r.best != null ? `Best ${formatTime(r.best, false)}` : 'Finished', `${r.shards}/3 shards`];
  if (r.relic) bits.push(`${RELICS[r.relic].toLowerCase()} relic`);
  if (r.gem) bits.push('every crate');
  return bits.join(' · ');
}

function updateMenuProgress() {
  const cleared = LEVELS.filter((lv) => save.levels[lv.id]?.clears).length;
  $('menu-progress').textContent = cleared ? `${cleared} / ${LEVELS.length} TRAILS TUMBLED` : '';
}

function openLevels() {
  const list = $('level-list');
  list.textContent = '';
  const cards = [];
  LEVELS.forEach((lv, i) => {
    const locked = i + 1 > save.unlocked && i !== urlLevel;
    const b = document.createElement('button');
    b.className = 'level-card';
    b.disabled = locked;
    // The label starts with its verb ("PLAY …"); the trail number sits first visually (CSS order).
    const body = document.createElement('span');
    const st = document.createElement('strong');
    st.textContent = (locked ? 'LOCKED · ' : 'PLAY ') + lv.name;
    const sm = document.createElement('small');
    sm.textContent = locked ? `Finish ${LEVELS[i - 1].title} to open this trail.` : recordLine(lv);
    body.append(st, sm);
    const num = document.createElement('span');
    num.className = 'lc-num';
    num.textContent = lv.num;
    b.append(body, num);
    b.addEventListener('click', () => startLevel(i));
    list.append(b);
    cards.push(b);
  });
  // Focus the first open trail not yet finished, else the one played last.
  const fresh = LEVELS.findIndex((lv, i) => !cards[i].disabled && !save.levels[lv.id]?.clears);
  const pick = fresh >= 0 ? fresh : clamp(levelIndex, 0, LEVELS.length - 1);
  $('levels').classList.remove('hidden');
  navFocus(cards[pick].disabled ? cards[0] : cards[pick]);
  input.settle();
}

function closeLevels() {
  $('levels').classList.add('hidden');
  navFocus($('start-button'));
  input.settle();
}

function onStart() {
  if (urlLevel >= 0) startLevel(urlLevel);
  else if (save.unlocked > 1) openLevels();
  else startLevel(0);
}

/* ------------------------------------------------------ menus by pad and keys */

let navEl = null;
function navFocus(el) {
  if (!el) return;
  if (navEl && navEl !== el) navEl.classList.remove('is-nav');
  navEl = el;
  el.focus({ preventScroll: true });
}
addEventListener('pointerdown', () => navEl?.classList.remove('is-nav'), true);

function activePanel() {
  if (!$('help').classList.contains('hidden')) return $('help');
  if (!$('levels').classList.contains('hidden')) return $('levels');
  if (state === 'paused') return $('pause');
  if (state === 'over') return $('gameover');
  if (state === 'won') return $('victory');
  if (state === 'menu') return $('menu');
  return null;
}
function navButtons(panel) {
  const list = [...panel.querySelectorAll('button')];
  if (panel.id === 'menu') list.push(...topButtons.querySelectorAll('button'));
  return list.filter((b) => !b.disabled && b.getClientRects().length > 0);
}
let navDir = 0, navHold = 0, navPanel = null;
function moveFocus(panel, dir) {
  const list = navButtons(panel);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const next = list[i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length];
  navFocus(next);
  next.classList.add('is-nav');
  audio.play('menu');
}
function activate(panel) {
  const list = navButtons(panel);
  const el = list.includes(document.activeElement) ? document.activeElement : list.find((b) => b.classList.contains('primary')) || list[0];
  el?.click();
}
function goBack(panel) {
  if (panel.id === 'help') closeHelp();
  else if (panel.id === 'levels') closeLevels();
  else if (panel.id === 'pause') resumeGame();
}
/** Drive the game's own menus with the stick, D-pad, arrows, A/Enter and B/Esc. */
function menuNav(dt) {
  const panel = activePanel();
  if (panel !== navPanel) {
    // A stick still held from play must not jump the focus as a menu opens.
    navPanel = panel;
    navDir = 2;
  }
  if (!panel || busy) return;
  const mv = input.vector('move');
  const dir = mv.y > 0.5 ? -1 : mv.y < -0.5 ? 1 : mv.x > 0.5 ? 1 : mv.x < -0.5 ? -1 : 0;
  if (navDir === 2) {
    if (!dir) navDir = 0; // wait for the stick to come back to centre
  } else if (dir !== navDir) {
    navDir = dir;
    navHold = 0.38;
    if (dir) moveFocus(panel, dir);
  } else if (dir) {
    navHold -= dt;
    if (navHold <= 0) {
      navHold = 0.14;
      moveFocus(panel, dir);
    }
  }
  if (input.pressed('confirm') || input.pressed('jump')) {
    activate(panel);
    input.settle();
  } else if (input.pressed('back') || input.pressed('pause')) {
    goBack(panel);
    input.settle();
  }
}

/* ------------------------------------------------------------- player update */

function updatePlayer(dt) {
  let dx = ctl.x, dz = ctl.z;
  const mag = Math.hypot(dx, dz);
  if (mag > 1) {
    dx /= mag;
    dz /= mag;
  }
  p.inv = Math.max(0, p.inv - dt);
  p.spinCD = Math.max(0, p.spinCD - dt);
  p.spin = Math.max(0, p.spin - dt);
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.coyote = Math.max(0, p.coyote - dt);
  if (p.grounded) p.coyote = 0.12;
  if (ctl.spin && p.spinCD <= 0) {
    p.spin = 0.37;
    p.spinCD = 0.51;
    audio.play('spin');
    burst(p.x, p.y + 0.3, p.s, 3, 0xe6bf71, 1.5);
  }
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = 10.5;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.squash = -0.12;
    audio.play('jump');
    burst(p.x, p.y + 0.08, p.s, 6, 0xd9b373, 1.6);
  }
  const speed = 7.8, gain = 1 - Math.exp(-(p.grounded ? 17 : 11) * dt);
  p.vx = lerp(p.vx, dx * speed, gain);
  p.vs = lerp(p.vs, dz * speed, gain);
  const prevY = p.y;
  // Ride a moving stone: it carries the rascal sideways (and, on sliding stones, along the trail).
  if (p.grounded && p.y > 0.1) {
    for (const pl of platforms) {
      if (Math.abs(p.s - pl.prevS) < 1.35 && Math.abs(p.x - pl.prevX) < 1.4) {
        p.x += pl.x - pl.prevX;
        p.s += pl.s - pl.prevS;
        break;
      }
    }
  }
  p.x += p.vx * dt;
  p.s += p.vs * dt;
  p.s = clamp(p.s, -2, boss.defeated ? L.length : L.boss.s + 8.7);
  const c0 = L.center(p.s), hw = L.halfWidth(p.s);
  p.x = clamp(p.x, c0 - hw + 0.26, c0 + hw - 0.26);
  if (boss.active && !boss.defeated) p.s = Math.max(L.boss.s - 16, p.s);
  const gravity = p.vy > 0 && !ctl.jumpHeld ? 39 : 25;
  p.vy -= gravity * dt;
  p.y += p.vy * dt;
  p.grounded = false;

  // Crates are solid, but break on a spin or a clean landing.
  for (const c of crates) {
    if (c.broken || Math.abs(c.s - p.s) > 2.4) continue;
    const xx = p.x - c.x, ss = p.s - c.s, top = c.base + 1.15;
    if (p.spin > 0 && Math.hypot(xx, ss) < 1.45 && p.y < top + 0.05 && p.y + 1.9 > c.base + 0.15) {
      breakCrate(c, 'spin');
      continue;
    }
    if (Math.abs(xx) < 0.84 && Math.abs(ss) < 0.84 && p.y < top && p.y + 1.85 > c.base + 0.05) {
      if (prevY >= top - 0.09 && p.vy <= 0) {
        p.y = top;
        p.vy = c.type === 'bounce' ? 13.2 : 8.2;
        p.coyote = 0;
        breakCrate(c, 'jump');
        audio.play('jump');
        p.squash = 0.13;
      } else if (c.type === 'nitro') {
        breakCrate(c, 'touch');
      } else {
        const penX = 0.84 - Math.abs(xx), penS = 0.84 - Math.abs(ss);
        if (penX < penS) {
          p.x = c.x + (xx >= 0 ? 0.845 : -0.845);
          p.vx = 0;
        } else {
          p.s = c.s + (ss >= 0 ? 0.845 : -0.845);
          p.vs = 0;
        }
      }
    }
  }
  const ground = groundAt(p.x, p.s);
  if (ground !== null && p.y <= ground && prevY >= ground - 0.2 && p.vy <= 0) {
    const impact = -p.vy;
    p.y = ground;
    p.vy = 0;
    p.grounded = true;
    p.coyote = 0.12;
    if (impact > 3) {
      p.squash = 0.17;
      audio.play('land');
      burst(p.x, ground + 0.04, p.s, 6, 0xd5af77, 1.7);
      if (impact > 9) input.rumble(0.15, 40);
    }
  }
  if (p.y < -7) {
    die('fall');
    return;
  }
  const speedNow = Math.hypot(p.vx, p.vs);
  if (speedNow > 0.45 && mag > 0.1) {
    const target = -Math.atan2(p.vx, p.vs), diff = Math.atan2(Math.sin(target - p.yaw), Math.cos(target - p.yaw));
    p.yaw += diff * (1 - Math.exp(-16 * dt));
  }
  p.walk += speedNow * dt * 1.65;
  p.squash = lerp(p.squash, 0, dt * 10);
  if (p.grounded && speedNow > 2) {
    runDust -= dt;
    if (runDust <= 0) {
      burst(p.x, p.y + 0.055, p.s, 1, 0xd6ba81, 0.7);
      runDust = 0.075;
    }
  }
  for (const f of fruits)
    if (!f.dead && Math.abs(f.s - p.s) < 1.2 && Math.hypot(f.x - p.x, f.s - p.s, f.y - (p.y + 1.05)) < 1.03) {
      f.dead = true;
      giveFruit(1);
      burst(f.x, f.y, f.s, 4, 0xffd061, 1.5);
    }
  for (const f of shards)
    if (!f.dead && Math.abs(f.s - p.s) < 1.2 && Math.hypot(f.x - p.x, f.s - p.s, f.y - (p.y + 1.35)) < 0.95) {
      f.dead = true;
      f.mesh.visible = false;
      shardCount++;
      audio.play('shard');
      input.rumble(0.3, 90);
      burst(f.x, f.y, f.s, 25, 0x79e8c5, 4);
      toast('SUN SHARD!', 'ANCIENT TREASURE · ' + shardCount + ' OF 3', 2.5);
    }
  for (const e of enemies) {
    if (e.dead || Math.abs(e.s - p.s) > 2) continue;
    const d = Math.hypot(e.x - p.x, e.s - p.s);
    if (p.spin > 0 && d < 1.6 && p.y < e.y + 1.4 && p.y + 1.9 > e.y) {
      killEnemy(e);
      continue;
    }
    if (d < 0.92 && p.y < e.y + 0.9 && p.y + 1.7 > e.y + 0.15) {
      if (p.vy < 0 && prevY > e.y + 0.73) {
        killEnemy(e);
        p.y = e.y + 0.92;
        p.vy = 8.5;
        audio.play('jump');
      } else hurt(1, e.x, e.s);
    }
  }
  for (const h of hazards) {
    if (Math.abs(h.s - p.s) > 2) continue;
    if (h.type === 'rock') {
      if (Math.hypot(h.x - p.x, h.s - p.s) < 1.28 && p.y < 1.78) hurt(1, h.x, h.s);
    } else if (Math.abs(p.x - h.x) < 1.55 && Math.abs(p.s - h.s) < 0.77 && p.y < 1.05) hurt(1, h.x, h.s);
  }
  const B = L.boss;
  if (p.s > B.s - 14 && !boss.active && !boss.defeated) {
    boss.active = true;
    boss.phase = 'windup';
    boss.timer = B.windup;
    checkpoint.x = 0;
    checkpoint.s = B.s - 16;
    p.hp = 3;
    toast(B.intro[0], B.intro[1], 2.2);
    audio.play('slam');
    input.rumble(0.4, 200);
  }
  if (boss.active && !boss.defeated) {
    const dist = Math.hypot(p.x - boss.x, p.s - boss.s);
    if (boss.phase === 'stun' && p.spin > 0 && dist < 2.25 && p.y < 3.5) {
      boss.hp--;
      boss.hitFlash = 0.3;
      boss.phase = 'recoil';
      boss.timer = 1.15;
      shake = 0.4;
      audio.play('boom');
      input.rumble(0.8, 260);
      burst(boss.x, 2, boss.s, 35, 0xc8ce8d, 6);
      if (boss.hp <= 0) {
        boss.defeated = true;
        boss.phase = 'defeated';
        boss.timer = 2;
        boss.pendingWave = 0;
        clearWaves();
        toast(B.defeat[0], B.defeat[1], 4);
        audio.play('win');
        setText(hudEls.bossPrompt, 'FOLLOW THE GLOW →');
      }
    } else if (dist < 1.5 && p.y < 3.2 && boss.phase !== 'stun') hurt(1, boss.x, boss.s);
  }
  if (boss.defeated && p.s > B.s + 13 && Math.abs(p.x) < 3.0) finish();
  const hints = L.hints;
  for (let i = 0; i < hints.length; i++) {
    const h = hints[i];
    if (p.s > h[1] && !hintSeen.has(h[0])) {
      hintSeen.add(h[0]);
      hint(h[2], h[3]);
    }
  }
}

/* -------------------------------------------------------------- world update */

function updateHopper(e) {
  // Rest 0.75 s, then a 0.85 s leap to the other side of its lane.
  const T = time * e.speed * 0.62 + e.phase;
  const n = Math.floor(T / 1.6), cyc = T - n * 1.6;
  const from = ((n % 2) + 2) % 2 === 0 ? -1 : 1;
  if (cyc < 0.75) {
    if (e.air) e.squash = 0.35; // just landed
    e.air = false;
    e.y = 0;
    e.x = e.baseX + from * 1.6;
  } else {
    const u = (cyc - 0.75) / 0.85;
    e.air = true;
    e.y = 6 * u * (1 - u); // 1.5 m at the top
    e.x = e.baseX + lerp(from, -from, u) * 1.6;
  }
  e.dir = from;
  e.s = e.baseS;
}

function updateWorld(dt) {
  for (const pl of platforms) {
    pl.prevX = pl.x;
    pl.prevS = pl.s;
    const w = Math.sin(time * pl.speed + pl.phase);
    pl.x = pl.x0 + w * pl.ax;
    pl.s = pl.s0 + w * pl.as;
  }
  for (const c of crates) {
    if (c.broken) continue;
    if (c.fuse > 0) {
      c.fuse -= dt;
      if (c.type === 'boom') {
        const num = Math.ceil(c.fuse);
        if (num !== c.tick && num > 0) {
          c.tick = num;
          audio.play('tick');
          number(String(num), c.x, c.base + 1.85, c.s);
        }
      }
      if (c.fuse <= 0) {
        explode(c);
        continue;
      }
    }
    if (c.base > 0) {
      let support = 0;
      for (const other of crates)
        if (other !== c && !other.broken && Math.abs(other.x - c.x) < 0.7 && Math.abs(other.s - c.s) < 0.7 && other.base < c.base - 0.2) support = Math.max(support, other.base + 1.15);
      c.base = Math.max(support, c.base - 4 * dt);
    }
  }
  for (const e of enemies) {
    if (e.dead) {
      if (e.fly > 0) {
        e.fly -= dt;
        e.root.position.x += dt * 5;
        e.root.position.y += dt * (e.fly * 10 + 1);
        e.root.position.z -= dt * 5;
        e.root.rotation.z += dt * 12;
        e.root.rotation.x += dt * 8;
      }
      continue;
    }
    if (e.kind === 'hopper') updateHopper(e);
    else {
      e.x = e.baseX + Math.sin(time * e.speed * 0.72 + e.phase) * 1.8;
      e.s = e.baseS + Math.cos(time * 0.9 + e.phase) * 0.35;
    }
    e.squash = Math.max(0, e.squash - dt * 2.5);
  }
  for (const h of hazards) h.x = h.x0 + Math.sin(time * (h.type === 'rock' ? 0.85 : 1.05) + h.s) * 2.35;

  if (boss.active && !boss.defeated) {
    const B = L.boss;
    boss.timer -= dt;
    if (boss.phase === 'windup') {
      const k = lerp(0.3, 2.4, clamp(1 - boss.timer / B.windup, 0, 1));
      bossArms[0].rotation.z = k;
      bossArms[1].rotation.z = -k;
      bossCore.position.y = Math.sin(time * 16) * 0.03;
      setText(hudEls.bossPrompt, boss.timer < 0.55 ? 'JUMP NOW!' : B.waves > 1 ? 'GET READY TO JUMP TWICE' : 'GET READY TO JUMP');
      if (boss.timer <= 0) {
        boss.phase = 'slam';
        boss.timer = 0.35;
        spawnWave();
        if (B.waves > 1) boss.pendingWave = 0.5;
        shake = 0.55;
        audio.play('slam');
        input.rumble(0.5, 180);
        burst(boss.x, 0.2, boss.s, 20, 0xcbbc89, 5);
      }
    } else if (boss.phase === 'slam') {
      bossArms[0].rotation.z = bossArms[1].rotation.z = 0;
      bossCore.position.y = -0.25;
      if (boss.timer <= 0) {
        boss.phase = 'stun';
        boss.timer = B.stun;
        audio.play('tick');
      }
    } else if (boss.phase === 'stun') {
      bossCore.position.y = -0.2 + Math.sin(time * 5) * 0.03;
      bossCore.rotation.z = Math.sin(time * 7) * 0.035;
      setText(hudEls.bossPrompt, boss.pendingWave > 0 ? 'ONE MORE WAVE!' : 'SPIN! THE GUARD IS DOWN');
      if (boss.timer <= 0) {
        boss.phase = 'windup';
        boss.timer = B.windup;
        bossCore.rotation.z = 0;
      }
    } else if (boss.phase === 'recoil') {
      bossCore.rotation.z = Math.sin(time * 28) * boss.timer * 0.12;
      setText(hudEls.bossPrompt, 'NICE HIT!');
      if (boss.timer <= 0) {
        boss.phase = 'windup';
        boss.timer = B.windup;
        bossCore.rotation.z = 0;
      }
    }
    if (boss.pendingWave > 0) {
      boss.pendingWave -= dt;
      if (boss.pendingWave <= 0) {
        boss.pendingWave = 0;
        spawnWave();
        shake = Math.max(shake, 0.4);
        audio.play('slam');
        input.rumble(0.45, 160);
        burst(boss.x, 0.2, boss.s, 14, 0xcbbc89, 5);
      }
    }
    boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  }
  if (boss.defeated) {
    boss.timer = Math.max(0, boss.timer - dt);
    bossCore.position.y = lerp(bossCore.position.y, -4, dt * 2);
    bossCore.rotation.z += dt * 0.3;
    gate.position.y = lerp(gate.position.y, -3.5, dt * 2);
    if (boss.timer === 0) bossRoot.visible = false;
  }
  for (const w of waves) {
    if (!w.active) continue;
    w.oldR = w.r;
    w.r += 9 * dt;
    w.life -= dt;
    const d = Math.hypot(p.x - boss.x, p.s - boss.s);
    if (d > w.oldR - 0.6 && d < w.r + 0.6 && p.y < 0.7 && state === 'playing') hurt(1, boss.x, boss.s);
    if (w.life <= 0) {
      w.active = false;
      w.mesh.visible = false;
    }
  }
}

/* --------------------------------------------------------------- HUD writes */

function updateHUD() {
  setStyle(hudEls.bossPrompt, 'opacity', toastTime > 0 ? '0' : '1');
  setText(hudEls.fruit, fruitCount);
  setText(hudEls.crate, crateCount);
  setText(hudEls.lives, '× ' + Math.max(0, p.lives));
  hudEls.hearts.forEach((el, i) => el.classList.toggle('full', i < p.hp));
  hudEls.shards.forEach((el, i) => el.classList.toggle('filled', i < shardCount));
  hudEls.charm.classList.toggle('active', !!p.charm);
  setStyle(hudEls.progress, 'width', clamp((p.s / (L.boss.s + 15)) * 100, 0, 100).toFixed(1) + '%');
  setText(hudEls.time, formatTime(elapsed));
  const area = L.areas.find((a) => p.s < a[0]) || L.areas[L.areas.length - 1];
  setText(hudEls.areaNum, area[1]);
  setText(hudEls.areaName, area[2]);
  hudEls.bossHud.classList.toggle('hidden', !boss.active || boss.defeated);
  hudEls.pips.forEach((el, i) => el.classList.toggle('empty', i >= boss.hp));
}

/* ----------------------------------------------------------------- visuals */

function menuHeroX() {
  return kit.size.width < 600 ? 1.15 : 1.9;
}

function animateHero() {
  const isMenu = state === 'menu' || state === 'loading';
  const R = hero.root;
  R.visible = state !== 'dying' || p.y > -10;
  R.position.set(p.x, p.y, -p.s);
  const moving = Math.hypot(p.vx, p.vs) > 1 && state === 'playing';
  const jump = !p.grounded && state === 'playing';
  let walk = moving ? Math.sin(p.walk) : Math.sin(time * 2) * 0.04;
  if (isMenu) {
    R.position.set(menuHeroX(), Math.sin(time * 2) * 0.03, -5);
    R.rotation.set(0, Math.PI - 0.28 + Math.sin(time * 0.8) * 0.12, 0);
    walk = Math.sin(time * 1.5) * 0.08;
  } else if (state === 'winning' || state === 'won') {
    R.rotation.set(0, Math.PI + Math.sin(time * 3) * 0.25, 0);
    R.position.y = p.y + Math.abs(Math.sin(time * 6)) * 0.3;
    walk = Math.sin(time * 10) * 0.5;
  } else R.rotation.set(0, p.spin > 0 ? -time * 26 : p.yaw, 0);
  hero.legL.rotation.x = jump ? -0.5 : walk * 0.85;
  hero.legR.rotation.x = jump ? 0.45 : -walk * 0.85;
  hero.armL.rotation.x = jump ? -2.1 : -walk * 0.65;
  hero.armR.rotation.x = jump ? -1.6 : walk * 0.65;
  hero.armL.rotation.z = p.spin > 0 ? -0.95 : -0.1;
  hero.armR.rotation.z = p.spin > 0 ? 0.95 : 0.1;
  hero.tail.rotation.y = Math.sin(time * 5) * 0.2;
  hero.body.position.y = moving && p.grounded ? Math.abs(Math.cos(p.walk)) * 0.05 : 0;
  hero.body.scale.set(1 + p.squash * 0.7, 1 - p.squash, 1 + p.squash * 0.4);
  if (state === 'dying') {
    R.rotation.z = (time - deathStart) * 3;
    hero.armL.rotation.z = -1.5;
    hero.armR.rotation.z = 1.5;
  }
  if (p.inv > 0 && state === 'playing' && Math.floor(p.inv * 12) % 2 === 0) R.visible = false;

  // Contact shadow: on whatever is underneath (trail, bridge, stone), fading with height.
  const hx = isMenu ? R.position.x : p.x, hs = isMenu ? 5 : p.s;
  const g = groundAt(hx, hs);
  const above = Math.max(0, (isMenu ? 0 : p.y) - (g ?? 0));
  heroShadow.position.set(hx, (g ?? 0) + 0.035, -hs);
  heroShadow.scale.set(0.55 + above * 0.1, 1, 0.37 + above * 0.07);
  mats.heroShadow.opacity = g !== null && state !== 'dying' ? 0.25 / (1 + above * 0.15) : 0;
  heroShadow.visible = mats.heroShadow.opacity > 0.001;
  spinRing.visible = p.spin > 0 && state === 'playing';
  if (spinRing.visible) {
    spinRing.position.set(p.x, p.y + 0.8, -p.s);
    spinRing.rotation.set(Math.sin(time * 15) * 0.12, 0, Math.cos(time * 17) * 0.12);
    spinRing.scale.set(1.2 + Math.sin(time * 25) * 0.15, 1, 1.2);
  }
  charm.visible = !!p.charm && !isMenu;
  if (charm.visible) {
    charm.position.set(p.x - 1.0, p.y + 1.9 + Math.sin(time * 4) * 0.13, -p.s + 0.25);
    charm.rotation.set(0, Math.sin(time * 2) * 0.3, Math.sin(time * 3) * 0.1);
  }
}

const _t = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
/** Keep the sun's shadow box on the action, snapped to whole shadow texels so edges don't crawl. */
function placeSun(viewS) {
  _t.set(camX, 0, -(viewS + 8));
  _x.crossVectors(UP, sunDir).normalize();
  _y.crossVectors(sunDir, _x);
  const tex = (2 * SH) / sun.shadow.mapSize.x;
  const tx = Math.round(_t.dot(_x) / tex) * tex, ty = Math.round(_t.dot(_y) / tex) * tex, tz = _t.dot(sunDir);
  _t.copy(_x).multiplyScalar(tx).addScaledVector(_y, ty).addScaledVector(sunDir, tz);
  sun.target.position.copy(_t);
  sun.position.copy(_t).addScaledVector(sunDir, 55);
}

const eye = new THREE.Vector3(), at = new THREE.Vector3();
function renderScene(dt) {
  const isMenu = state === 'menu' || state === 'loading';
  camS = lerp(camS, p.s, 1 - Math.exp(-9 * dt));
  camX = lerp(camX, p.x * 0.24, 1 - Math.exp(-5 * dt));
  if (isMenu) {
    eye.set(-0.2 + Math.sin(time * 0.14) * 0.3, 5.9, 9.9);
    at.set(-1.4, 1.8, -7.5);
  } else {
    const vertical = clamp(p.y, 0, 3) * 0.19;
    eye.set(camX, 6.6 + vertical, -camS + 11.2);
    at.set(camX * 0.6, 1.25 + vertical, -camS - 5.1);
  }
  if (shake > 0 && !isMenu) {
    eye.x += (Math.random() - 0.5) * shake;
    eye.y += (Math.random() - 0.5) * shake * 0.6;
  }
  camera.position.copy(eye);
  camera.lookAt(at);
  camera.updateMatrixWorld();
  const viewS = isMenu ? 5 : camS;
  placeSun(viewS);

  for (const ch of chunks) ch.mesh.visible = ch.always || (ch.start > viewS - 22 && ch.start < viewS + 93);
  for (const roof of roofs) {
    const d = viewS - roof.s;
    const cover = clamp((d + 4) / 3, 0, 1) * clamp((16 - d) / 4, 0, 1);
    roof.mat.opacity = 1 - cover * 0.98;
    roof.mesh.visible = Math.abs(d) < 93;
  }
  for (const pl of platforms) {
    pl.mesh.visible = Math.abs(pl.s - viewS) < 80;
    pl.mesh.position.set(pl.x, 0, -pl.s);
  }

  blobCount = 0;
  for (const c of crates) {
    if (c.broken) continue;
    const vis = c.s > viewS - 13 && c.s < viewS + 78;
    c.mesh.visible = vis;
    if (!vis) continue;
    let y = c.base + 0.575;
    if (c.type === 'nitro') y += Math.pow(Math.max(0, Math.sin(time * 6 + c.phase)), 12) * 0.12; // NITROs rattle
    c.mesh.position.set(c.x, y, -c.s);
    if (c.type === 'boom') {
      if (c.fuse > 0) {
        const wob = Math.sin(time * (20 + (3 - c.fuse) * 10)) * 0.035;
        c.mesh.rotation.set(wob, wob, 0);
        c.mat.color.setRGB(Math.sin(time * 15) > 0 ? 1.25 : 1, 1, 1);
      } else {
        c.mesh.rotation.set(0, 0, 0);
        c.mat.color.setRGB(1, 1, 1);
      }
    }
    blob(c.x, c.s, 0.72);
  }

  let fc = 0;
  for (const f of fruits) {
    if (f.dead || f.s <= viewS - 10 || f.s >= viewS + 68 || fc >= FRUIT_CAP) continue;
    dummy.position.set(f.x, f.y + Math.sin(time * 3 + f.phase) * 0.09, -f.s);
    dummy.rotation.set(0, time * 1.2 + f.phase, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    fruitMesh.setMatrixAt(fc++, dummy.matrix);
  }
  if (!fc) fruitMesh.setMatrixAt(fc++, ZERO);
  fruitMesh.count = fc;
  fruitMesh.instanceMatrix.needsUpdate = true;

  for (const f of shards) {
    f.mesh.visible = !f.dead && Math.abs(f.s - viewS) < 70;
    if (!f.mesh.visible) continue;
    f.mesh.position.y = f.y + Math.sin(time * 2) * 0.12;
    f.mesh.rotation.y = time * 1.4;
  }

  for (const e of enemies) {
    const inView = e.s > viewS - 12 && e.s < viewS + 75;
    e.root.visible = inView && (!e.dead || e.fly > 0);
    if (!e.root.visible || e.dead) continue;
    if (e.kind === 'hopper') {
      e.root.position.set(e.x, e.y, -e.s);
      e.root.rotation.set(e.air ? -0.25 : 0, e.air ? -e.dir * 0.5 : 0, 0);
      const sq = e.squash;
      e.root.scale.set(1 + sq * 0.5, 1 - sq * 0.6 + (e.air ? 0.08 : 0), 1 + sq * 0.5);
      blob(e.x, e.s, 0.7 / (1 + e.y * 0.35));
    } else {
      e.root.position.set(e.x, Math.sin(time * 14) * 0.025, -e.s);
      e.root.rotation.y = Math.cos(time * e.speed * 0.72 + e.phase) > 0 ? -0.5 : 0.5;
      for (let i = 0; i < e.claws.length; i++) e.claws[i].rotation.z = Math.sin(time * 9 + i * 2) * 0.3;
      blob(e.x, e.s, 0.7);
    }
  }
  for (const h of hazards) {
    h.mesh.visible = Math.abs(h.s - viewS) < 75;
    if (!h.mesh.visible) continue;
    if (h.type === 'rock') {
      h.mesh.position.set(h.x, 1.02, -h.s);
      h.mesh.rotation.set(time * 0.4, 0, -(h.x - h.x0));
    } else {
      h.mesh.position.set(h.x, 0.47, -h.s);
      h.mesh.rotation.set(time * 1.4, 0, 0);
    }
    blob(h.x, h.s, 1.2);
  }

  const bossNear = viewS > L.boss.s - 78;
  bossRoot.visible = bossNear && !(boss.defeated && boss.timer === 0);
  gate.visible = bossNear;
  portal.visible = bossNear && boss.defeated;
  if (bossRoot.visible) {
    if (!boss.defeated) blob(boss.x, boss.s, 1.7);
    if (boss.hitFlash > 0) mats.eyes.color.setRGB(1.6, 1.6, 1.6);
    else if (boss.phase === 'stun') mats.eyes.color.setRGB(0.5, 1, 1);
    else mats.eyes.color.setRGB(1, 1, 0.7);
  }
  if (portal.visible) {
    endGem.rotation.y = time;
    portalRing.rotation.set(Math.PI / 2, 0, time * 0.2);
  }
  for (const w of waves) {
    if (!w.active) continue;
    w.mesh.position.set(boss.x, 0.1, -boss.s);
    w.mesh.scale.set(w.r, 1, w.r);
    w.mat.opacity = clamp(w.life, 0, 0.8);
  }
  if (!blobCount) blobMesh.setMatrixAt(blobCount++, ZERO);
  blobMesh.count = blobCount;
  blobMesh.instanceMatrix.needsUpdate = true;

  animateHero();
  post.render();
}

/* ------------------------------------------------------------- toggles */

let retro = !!prefs.retro;
function applyRetro() {
  const { width, height } = kit.size;
  const lines = retro ? clamp(Math.round(height * Math.min(1, 720 / Math.max(1, width))), 180, 405) : 0;
  kit.setPixelHeight(lines);
  $('retro-button').setAttribute('aria-pressed', String(retro));
}
function toggleRetro() {
  retro = !retro;
  prefs.retro = retro;
  writePrefs();
  applyRetro();
}
kit.onResize(() => {
  if (retro) applyRetro();
});
applyRetro();

async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('FULL SCREEN NOT AVAILABLE', 'THE GAME STILL WORKS IN THIS WINDOW.', 2);
  }
}

function openSettings() {
  if (state === 'playing') pauseGame();
  kit.menu.open();
}

/* ------------------------------------------------------------------ the loop */

function frame(rawDt) {
  const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
  const stateBefore = state;
  if (input.pressed('mute')) audio.toggle();
  if (input.pressed('retro')) toggleRetro();
  if (input.pressed('full')) fullscreen();

  if (state === 'playing') {
    if (input.pressed('pause')) pauseGame();
    else {
      const mv = input.vector('move');
      ctl.x = mv.x;
      ctl.z = mv.y;
      ctl.jumpHeld = input.down('jump');
      ctl.spin = input.down('spin');
      if (input.pressed('jump')) p.jumpBuffer = 0.15;
      elapsed += dt;
      const steps = Math.ceil(dt / 0.0125), sub = dt / steps;
      for (let i = 0; i < steps; i++) {
        time += sub;
        updateWorld(sub);
        if (state === 'playing') updatePlayer(sub);
      }
      updateParticles(dt);
      audio.music();
    }
  } else if (state === 'menu' || state === 'loading') {
    time += dt;
    if (levelGroup) updateWorld(dt);
    p.x = 1.9;
    p.s = 5;
    p.y = 0;
    p.inv = 0;
    p.spin = 0;
    updateParticles(dt);
  } else if (state === 'dying') {
    time += dt;
    deathTimer -= dt;
    p.y -= dt * 5;
    updateParticles(dt);
    if (deathTimer < 0.25) hudEls.fade.classList.add('on');
    if (deathTimer <= 0) {
      if (p.lives <= 0) {
        state = 'over';
        $('gameover').classList.remove('hidden');
        hudEls.fade.classList.remove('on');
        hudEls.toast.classList.remove('show');
        navFocus($('continue-button'));
        input.settle();
        syncTouch();
      } else respawn();
    }
  } else if (state === 'winning') {
    time += dt;
    winTimer -= dt;
    updateParticles(dt);
    if (winTimer <= 0) showResults();
  } else if (state === 'won' || state === 'over') {
    time += dt;
    updateParticles(dt);
  }

  // A menu that just opened this frame must not see the press that opened it.
  if (state === stateBefore) menuNav(dt);

  if (state !== 'paused' && state !== 'help') {
    toastTime = Math.max(0, toastTime - dt);
    hintTime = Math.max(0, hintTime - dt);
    if (!toastTime) hudEls.toast.classList.remove('show');
    if (!hintTime) hudEls.hint.classList.remove('show');
    shake = Math.max(0, shake - dt * 1.2);
    flash = Math.max(0, flash - dt * 2);
    setStyle(hudEls.flash, 'opacity', flash.toFixed(2));
  }
  uiTimer -= dt;
  if (uiTimer <= 0) {
    updateHUD();
    uiTimer = 0.08;
  }
  renderScene(dt);
}

/* ------------------------------------------------------------- wiring */

$('start-button').onclick = onStart;
$('help-button').onclick = help;
$('help-close').onclick = closeHelp;
$('help-done').onclick = closeHelp;
$('audio-button').onclick = () => audio.toggle();
$('retro-button').onclick = toggleRetro;
$('full-button').onclick = fullscreen;
$('settings-button').onclick = openSettings;
$('pause-button').onclick = pauseGame;
$('resume-button').onclick = resumeGame;
$('pause-settings').onclick = openSettings;
$('restart-button').onclick = startGame;
$('over-restart').onclick = startGame;
$('over-menu').onclick = menu;
$('again-button').onclick = startGame;
$('next-button').onclick = () => startLevel(levelIndex + 1);
$('pause-help').onclick = help;
$('menu-button').onclick = menu;
$('victory-menu').onclick = menu;
$('levels-back').onclick = closeLevels;
$('continue-button').onclick = () => {
  p.lives = 3;
  respawn();
};
addEventListener('blur', () => {
  if (state === 'playing') pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});

window.__game = {
  get state() {
    return state;
  },
  get level() {
    return L.id;
  },
  get stats() {
    return { fruitCount, crateCount, crateTotal, shardCount, elapsed, deaths, fps: window.__kit?.fps, draws: renderer.info.render.calls };
  },
  player: p,
  crates,
  fruits,
  shards,
  enemies,
  hazards,
  boss,
  platforms,
  checkpoint,
  groundAt,
  save,
  start: startGame,
  startLevel,
  pause: pauseGame,
  respawn,
};

loadLevel(urlLevel >= 0 ? urlLevel : 0);
menu();
kit.start(frame);
