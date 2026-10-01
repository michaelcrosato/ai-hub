/**
 * Mossbell: Shrine of the Ember Warden — an original low-poly action-adventure.
 *
 * Runs on the shared 3D kit: three.js r186 WebGPURenderer (WebGL2 fallback),
 * kit input actions (keyboard and mouse, gamepad, touch), kit post (bloom).
 * Everything is procedural geometry; there are no texture, model or audio files.
 */

import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';
import { bakeInstances } from 'kit/instancing.js';
import { SoundBank } from './audio.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
const wrapAngle = (a) => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
};
const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const fmtTime = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const PREFS_KEY = 'mossbell.prefs.v1';
const SAVE_KEY = 'mossbell.save.v1';
const BEST_KEY = 'mossbell.best.v1';
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode or full storage: progress just isn't kept */
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

const DIFFICULTY = {
  story: { label: 'Story', note: 'Gentler hits and more healing mint. Explore at your own pace.', hurt: 0.6, speed: 0.92, heal: 0.4, bossSpecial: 6.4, shot: 0.9, ring: 8 },
  normal: { label: 'Normal', note: 'The shrine as it was built: guard the heavy strikes, answer between them.', hurt: 1, speed: 1, heal: 0.22, bossSpecial: 5.4, shot: 1, ring: 8 },
  hard: { label: 'Hard', note: 'Heavier blows, quicker foes and a fiercer Ember Warden.', hurt: 1.45, speed: 1.12, heal: 0.12, bossSpecial: 4.3, shot: 1.15, ring: 12 },
};

const PHASE_TITLES = {
  bells: 'Awaken the meadow chimes',
  gate: 'Enter the Mossbound Gate',
  chest: 'Claim the relic-forged blade',
  wardens: 'Break the two ruin wardens',
  bossApproach: 'Enter the Ember Warden hall',
  boss: 'Defeat the Ember Warden',
  relic: 'Claim the Ember Bell',
  done: 'Shrine restored',
};

const ENEMY_STATS = {
  mossling: { hp: 24, speed: 2.15, damage: 8, xp: 14, aggro: 7.5, range: 1.0, radius: 0.45 },
  sentry: { hp: 38, speed: 1.35, damage: 10, xp: 30, aggro: 9, range: 1.35, radius: 0.6 },
  thornback: { hp: 44, speed: 1.25, damage: 12, xp: 26, aggro: 7.5, range: 1.2, radius: 0.62 },
  boss: { hp: 150, speed: 1.65, damage: 14, xp: 120, aggro: 14, range: 2.0, radius: 1.1 },
};

// Where each group of enemies may roam (they also collide with walls, trees and doors).
const ZONES = {
  meadow: { minX: -26, maxX: 26, minZ: -17, maxZ: 23 },
  shrine: { minX: -7.1, maxX: 7.1, minZ: -61, maxZ: -24.2 },
  boss: { minX: -6.5, maxX: 6.5, minZ: -60, maxZ: -46 },
  vault: { minX: -19.9, maxX: -9.5, minZ: -38.3, maxZ: -27.7 },
};

const SIDE_DEFAULT = Object.freeze({ keyChest: false, key: false, vaultUnlocked: false, vaultCleared: false, bellsSolved: false, vaultChest: false, charm: false });
const FX_CAP = 260;
const SHOT_CAP = 72;

const CONTROLS = {
  keyboard: ['WASD / arrows · move', 'Space / J / click · blade', 'Shift / K / right-click · guard (hold)', 'Q · dash', 'E · use, read, open', 'Wheel or − / + · zoom', 'Esc / P · pause', 'M · mute'],
  gamepad: ['Left stick / D-pad · move', 'A / X / RT · blade', 'LT / LB · guard (hold)', 'B / RB · dash', 'Y · use, read, open', 'Right stick · zoom', 'Start · pause'],
  touch: ['Left thumb · move', 'BLADE · attack', 'GUARD · hold to block', 'DASH · quick dodge', 'USE · appears near things', 'Pinch · zoom', 'II · pause'],
};
const USE_KEY = { keyboard: 'E', gamepad: 'Y', touch: '' };
const HINTS = {
  keyboard: 'WASD moves · Space attacks · Shift guards · E uses · Q dashes · Esc pauses',
  gamepad: 'Left stick moves · A attacks · LT guards · Y uses · B dashes · Start pauses',
  touch: 'Move with the left thumb. BLADE attacks; hold GUARD to block; DASH dodges.',
};

class Mossbell {
  constructor(kit) {
    this.kit = kit;
    this.input = kit.input;
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x83c697);
    this.scene.fog = new THREE.Fog(0x86bf91, 30, 82);
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(48, 1, 0.1, 140));
    this.cameraTarget = new THREE.Vector3();
    this.cameraShake = 0;
    this.liftY = 1;
    this.liftZ = 1;
    this.sound = new SoundBank();

    const saved = store.get(PREFS_KEY, {}) || {};
    this.prefs = {
      difficulty: DIFFICULTY[saved.difficulty] ? saved.difficulty : 'normal',
      music: saved.music !== false,
      sfx: saved.sfx !== false,
      zoom: Number.isFinite(+saved.zoom) && saved.zoom !== null ? clamp(+saved.zoom, 0.72, 1.34) : 1,
    };
    this.sound.musicOn = this.prefs.music;
    this.sound.sfxOn = this.prefs.sfx;
    this.cameraZoom = this.prefs.zoom;
    this.difficulty = this.prefs.difficulty;

    this.geoCache = new Map();
    this.statics = new Map();
    this.enemies = [];
    this.interactables = [];
    this.colliders = [];
    this.glows = [];
    this.chimes = [];
    this.chests = [];
    this.echoBells = [];
    this.projectiles = [];
    this.shotPool = [];
    this.particles = [];
    this.particlePool = [];

    this.mode = 'boot';
    this.phase = 'bells';
    this.side = { ...SIDE_DEFAULT };
    this.checkpoint = { x: 0, z: 17 };
    this.time = 0;
    this.animT = 0;
    this.elapsed = 0;
    this.kills = 0;
    this.deaths = 0;
    this.hitStop = 0;
    this.flash = 0;
    this.warmFrames = 3;
    this.moveX = 0;
    this.moveZ = 0;
    this.guardHeld = false;
    this.toastTimer = 0;
    this.toastShown = 0;
    this.toastQueue = [];
    this.hintTimer = 0;
    this.uiTimer = 0;
    this.uiCache = {};
    this.vaultSealed = false;
    this.bellStep = 0;
    this.gladeOpen = false;
    this.nearby = null;
    this.navHeld = false;
    this.confirmNewUntil = 0;
    this.sunHalf = 0;

    // Scratch objects, so the frame loop allocates nothing.
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
  }

  /* ------------------------------------------------------------ building */

  build() {
    const r = this.kit.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.08;
    this.makeMaterials();
    this.buildLights();
    this.buildWorld();
    this.buildPlayer();
    this.spawnEnemies();
    this.buildFx();
    this.post = createPost(this.kit, this.scene, this.camera, { bloom: { strength: 0.18, radius: 0.16, threshold: 0.86 } });
    this.kit.onResize(() => this.updateLift());
  }

  makeMaterials() {
    const std = (color, rough = 0.88, metal = 0.02, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true, ...extra });
    const basic = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
    this.m = {
      grass: std(0x628c51, 0.95),
      grass2: std(0x3f7047, 0.98),
      path: std(0xd4bd78, 0.96),
      stone: std(0x6e7869, 0.94),
      stoneDark: std(0x3c4c47, 0.96),
      stoneLight: std(0x9aa28a, 0.93),
      wood: std(0x6f4a2c, 1),
      leaf: std(0x3f7c4e, 0.95),
      leaf2: std(0x5b9858, 0.95),
      gold: std(0xe7b84e, 0.5, 0.55, { emissive: 0x3a2505, emissiveIntensity: 0.35 }),
      ember: std(0xe87848, 0.42, 0.18, { emissive: 0x6d1d0b, emissiveIntensity: 1.5 }),
      teal: std(0x3a8f88, 0.82),
      cloth: std(0xd96d45, 0.94),
      skin: std(0xe4b77c, 0.95),
      dark: std(0x24312d, 0.94),
      enemy: std(0x6aa34a, 0.86),
      steel: std(0x9eaaa7, 0.45, 0.58),
      bronze: std(0xb57a3e, 0.55, 0.55),
      root: std(0x4f3b24, 1),
      crystal: std(0x86d8cc, 0.35, 0.15, { emissive: 0x1f6d64, emissiveIntensity: 0.8 }),
      water: new THREE.MeshPhysicalMaterial({ color: 0x5ab0a8, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.62, flatShading: true }),
      glow: basic(0xffdf72, 0.6),
      glowIdle: basic(0x9fe3d6, 0.3),
      glowLit: basic(0xffc64a, 0.78),
      warn: basic(0xff5a36, 0),
      fx: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    };
  }

  geo(key, make) {
    let g = this.geoCache.get(key);
    if (!g) {
      g = make();
      this.geoCache.set(key, g);
    }
    return g;
  }

  mesh(geo, mat, pos = [0, 0, 0], parent = this.scene, cast = true, receive = true) {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(pos[0], pos[1], pos[2]);
    o.castShadow = cast;
    o.receiveShadow = receive;
    parent.add(o);
    return o;
  }

  box(w, h, d, pos, mat, parent = this.scene, cast = true) {
    return this.mesh(this.geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat, pos, parent, cast, true);
  }

  roundBox(w, h, d, r, pos, mat, parent = this.scene, cast = true) {
    return this.mesh(this.geo(`r${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r)), mat, pos, parent, cast, true);
  }

  cyl(rt, rb, h, seg, pos, mat, parent = this.scene, cast = true) {
    return this.mesh(this.geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat, pos, parent, cast, true);
  }

  /** Queue a piece of static scenery; flushStatics() merges each kind into one mesh. */
  addStatic(kind, mat, x, y, z, sx, sy, sz, ry = 0) {
    const key = `${kind}|${mat.uuid}`;
    let batch = this.statics.get(key);
    if (!batch) {
      batch = { geo: this.staticGeo[kind], mat, list: [] };
      this.statics.set(key, batch);
    }
    this._p.set(x, y, z);
    this._q.setFromAxisAngle(UP, ry);
    this._s.set(sx, sy, sz);
    batch.list.push(new THREE.Matrix4().compose(this._p, this._q, this._s));
  }

  flushStatics() {
    for (const batch of this.statics.values()) {
      const inst = new THREE.InstancedMesh(batch.geo, batch.mat, batch.list.length);
      batch.list.forEach((mx, i) => inst.setMatrixAt(i, mx));
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.scene.add(bakeInstances(inst));
    }
    this.statics.clear();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xcaf0cd, 0x314435, 1.7));
    const sun = new THREE.DirectionalLight(0xffe8b8, 3.1);
    sun.castShadow = true;
    this.kit.shadow(sun, 2048);
    sun.shadow.bias = -0.00025;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    // The sun follows the player (snapped to shadow texels), so the shrine gets shadows too.
    this.sunDir = new THREE.Vector3(-14, 24, 16).normalize();
    this.sunU = new THREE.Vector3().crossVectors(UP, this.sunDir).normalize();
    this.sunV = new THREE.Vector3().crossVectors(this.sunDir, this.sunU);
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  groundY(z) {
    if (z > -20) return 0;
    if (z > -24) return -(Math.abs(z + 20) / 4);
    return -1;
  }

  addCollider(x, z, w, d, active = null) {
    this.colliders.push({ x, z, w, d, active });
  }

  blocked(x, z, r = 0.42) {
    if (x < -27 + r || x > 27 - r || z > 25 - r || z < -63 + r) return true;
    const r2 = r * r;
    for (const c of this.colliders) {
      if (c.active && !c.active()) continue;
      const nx = clamp(x, c.x - c.w / 2, c.x + c.w / 2);
      const nz = clamp(z, c.z - c.d / 2, c.z + c.d / 2);
      if ((x - nx) ** 2 + (z - nz) ** 2 < r2) return true;
    }
    return false;
  }

  buildWorld() {
    const m = this.m;
    this.staticGeo = {
      dodeca: new THREE.DodecahedronGeometry(1, 0),
      trunk: new THREE.CylinderGeometry(0.22, 0.34, 2.3, 6),
      block: new THREE.BoxGeometry(1, 1, 1),
    };

    // Ground: the meadow, the shrine floor and the side vault floor.
    this.box(58, 1, 48, [0, -0.55, 2], m.grass, this.scene, false);
    this.box(16, 1, 42, [0, -1.55, -43], m.stoneDark, this.scene, false);
    this.box(13.2, 1, 14.4, [-14.6, -1.55, -33], m.stoneDark, this.scene, false); // ends where the shrine floor starts

    // Meadow path and fork pads, and a worn trail toward the eastern glade.
    this.box(6, 0.12, 39, [0, 0.02, 2], m.path, this.scene, false);
    this.box(19, 0.1, 4, [0, 0.04, 4], m.path, this.scene, false);
    this.box(14, 0.1, 4, [-5, 0.04, -9], m.path, this.scene, false);
    this.box(3, 0.08, 9, [17, 0.03, -8.5], m.path, this.scene, false);

    // Pond gives the meadow a readable landmark without blocking the main route.
    this.water = this.mesh(new THREE.CylinderGeometry(5.3, 5.7, 0.18, 12), m.water, [-16, -0.02, 11], this.scene, false, false);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const r = 0.6 + (i % 3) * 0.12;
      this.addStatic('dodeca', m.stone, -16 + Math.cos(a) * 5.1, 0.25, 11 + Math.sin(a) * 5.1, r, r, r);
    }

    // Deterministic trees and rocks around traversable space (same seed and order as always).
    let seed = 92173;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const questClear = [[-11.5, 5.2, 2.5], [11.5, 2.2, 2.5], [-7.5, -9.3, 2.6], [2.7, 14.3, 2.1]];
    for (let i = 0; i < 34; i++) {
      let x = rnd() * 52 - 26;
      const z = rnd() * 42 - 15;
      if (Math.abs(x) < 5.2 && z > -18) x += x < 0 ? -7 : 7;
      if (Math.hypot(x + 16, z - 11) < 6.5) continue;
      if (questClear.some(([qx, qz, qr]) => Math.hypot(x - qx, z - qz) < qr)) continue;
      const s = 0.78 + rnd() * 0.55;
      const alt = rnd() > 0.5;
      this.makeTree(x, z, s, alt);
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 52 - 26;
      const z = rnd() * 43 - 16;
      if (Math.abs(x) < 4.5) continue;
      const r = 0.25 + rnd() * 0.55;
      const mat = i % 3 ? m.stone : m.stoneLight;
      const sy = 0.55 + rnd() * 0.5;
      const ry = rnd() * TAU;
      this.addStatic('dodeca', mat, x, 0.25, z, r, r * sy, r, ry);
    }

    // Low-poly grass blades, merged into one mesh.
    const grassCount = this.kit.detail(180, 40);
    const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.55, 3), m.grass2, grassCount);
    for (let i = 0; i < grassCount; i++) {
      let x = rnd() * 54 - 27;
      const z = rnd() * 43 - 16;
      if (Math.abs(x) < 3.8 && z > -18) x += x < 0 ? -5 : 5;
      this._p.set(x, 0.24, z);
      this._q.setFromAxisAngle(UP, rnd() * TAU);
      this._s.set(1, 0.7 + rnd() * 0.7, 1);
      this._m.compose(this._p, this._q, this._s);
      grass.setMatrixAt(i, this._m);
    }
    grass.castShadow = false;
    grass.receiveShadow = false;
    this.scene.add(bakeInstances(grass, { dispose: true }));

    // Gate, stairs and railings.
    for (let i = 0; i < 5; i++) this.box(7.4, 0.28, 1.15, [0, -0.05 - i * 0.21, -20.2 - i * 0.82], m.path, this.scene, false);
    for (const x of [-4.15, 4.15]) {
      for (let i = 0; i < 5; i++) this.cyl(0.12, 0.15, 1.15, 6, [x, 0.55 - i * 0.2, -20.2 - i * 0.82], m.wood);
      this.box(0.18, 0.18, 4.6, [x, 0.72, -21.85], m.wood);
    }
    this.addCollider(-4.15, -21.9, 0.45, 5.3);
    this.addCollider(4.15, -21.9, 0.45, 5.3);
    this.box(2.5, 5, 2.3, [-4.3, 2.45, -19], m.stone);
    this.box(2.5, 5, 2.3, [4.3, 2.45, -19], m.stone);
    this.box(7.1, 1.2, 2.1, [0, 5.0, -19], m.stoneLight);
    this.gateDoor = this.box(6.1, 4.1, 0.65, [0, 2.05, -18.9], m.wood);
    this.gateDoor.userData.closedY = 2.05;
    for (let x = -2.2; x <= 2.2; x += 1.1) this.box(0.12, 3.6, 0.12, [x, 0, 0.38], m.steel, this.gateDoor);
    // A low cliff line makes the gate the only route north; the tower collision prevents corner-cutting.
    for (const x of [-24, -21.4, -18.8, -16.2, -13.6, -11, -8.4, 8.4, 11, 13.6, 16.2, 18.8, 21.4, 24]) {
      const r = 1.35 + (Math.abs(x) % 2) * 0.12;
      this.addStatic('dodeca', m.stone, x, 0.55, -19, r, r * 0.72, r);
    }
    this.addCollider(-16, -19, 20, 2.3);
    this.addCollider(16, -19, 20, 2.3);
    this.addCollider(-4.3, -19, 2.5, 2.3);
    this.addCollider(4.3, -19, 2.5, 2.3);
    this.addCollider(0, -18.8, 6.4, 1, () => !this.gateOpen);

    // Shrine walls (the west wall now has a root-bound door to the vault), inner gate and boss room.
    this.box(1.1, 4, 8.6, [-8.25, 1, -27.3], m.stone);
    this.addCollider(-8.25, -27.3, 1.1, 8.6);
    this.box(1.1, 4, 28.6, [-8.25, 1, -48.7], m.stone);
    this.addCollider(-8.25, -48.7, 1.1, 28.6);
    this.box(1.1, 0.95, 2.8, [-8.25, 2.525, -33], m.stoneLight);
    this.box(1.1, 4, 40, [8.25, 1, -43], m.stone);
    this.addCollider(8.25, -43, 1.1, 40);
    this.box(17, 4, 1.1, [0, 1, -63], m.stone);
    this.addCollider(0, -63, 17, 1.1);
    this.innerDoor = this.box(12.5, 3.6, 0.7, [0, 0.8, -44], m.stoneLight);
    this.innerDoor.userData.closedY = 0.8;
    this.addCollider(0, -44, 12.7, 0.9, () => !this.innerOpen);
    for (const z of [-27, -39, -53]) for (const x of [-6.5, 6.5]) this.makeTorch(x, z, true);

    // The Rootkey Vault: a side chamber west of the first shrine chamber.
    this.box(13.4, 4, 1.1, [-14.5, 1, -39.6], m.stone);
    this.addCollider(-14.5, -39.6, 13.4, 1.1);
    this.box(1.1, 4, 14.4, [-21.2, 1, -33], m.stone);
    this.addCollider(-21.2, -33, 1.1, 14.4);
    this.box(13.4, 1.5, 1.1, [-14.5, -0.3, -26.4], m.stoneLight); // a low parapet, so the camera still sees in
    this.addCollider(-14.5, -26.4, 13.4, 1.1);
    this.makeTorch(-10.4, -38.5, false);
    this.makeTorch(-17.2, -38.5, false);
    const vaultLight = new THREE.PointLight(0xffb066, 8, 12, 2);
    vaultLight.position.set(-14.2, 1.8, -33);
    this.scene.add(vaultLight);
    this.vaultDoor = this.box(0.6, 3.1, 2.8, [-8.25, 0.5, -33], m.root);
    this.vaultDoor.userData.closedY = 0.5;
    for (const dz of [-0.85, 0, 0.85]) this.box(0.72, 2.7, 0.18, [0, 0.05, dz], m.leaf2, this.vaultDoor, false);
    this.mesh(this.geo('keyhole', () => new THREE.OctahedronGeometry(0.22, 0)), m.gold, [0.42, 0.25, 0], this.vaultDoor, false, false);
    this.addCollider(-8.25, -33, 1.1, 2.8, () => !this.side.vaultUnlocked || this.vaultSealed);
    this.interactables.push({ type: 'vaultDoor', x: -7.55, z: -33, prompt: 'UNLOCK' });
    this.makeEchoBell(-18.4, -29.6, 1.35, 392, 3);
    this.makeEchoBell(-18.4, -33, 0.7, 784, 1);
    this.makeEchoBell(-18.4, -36.4, 1.0, 587, 2);
    this.makeSign(-13.8, -37.9, 'Three echoes sleep in this vault. Wake them from the smallest voice to the deepest, and the floor will answer.');
    this.vaultChest = this.makeChest(-14.2, -33, 'vault');

    // Chimes define an exploration triangle but remain close enough for a short mobile loop.
    this.makeChime(-11.5, 5.2, 'West Chime');
    this.makeChime(11.5, 2.2, 'East Chime');
    this.makeChime(-7.5, -9.3, 'Old Chime');
    this.makeSign(2.7, 14.3, 'Three meadow chimes share one song. Ring all three and the northern gate will lift.');
    this.makeSign(-4.7, -25.5, 'The ruin tests rhythm, not grinding. Guard the heavy strikes, then answer between them.');
    this.chest = this.makeChest(0, -30.4, 'main');

    // The eastern glade: a root-sealed cache kept by two thornbacks.
    this.makeSign(14.6, -3.6, 'The eastern glade keeps an old cache. Its shell-backed keepers turn a blade aside: step past the charge, then strike a flank.');
    this.cache = this.makeChest(20.2, -15.6, 'cache');
    this.gladeRoots = new THREE.Group();
    this.gladeRoots.position.set(20.2, 0, -15.6);
    this.scene.add(this.gladeRoots);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      const root = this.cyl(0.1, 0.2, 1.9, 5, [Math.cos(a) * 1.2, 0.7, Math.sin(a) * 0.95], m.root, this.gladeRoots);
      root.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    }
    for (const [x, z, ry] of [[15.6, -16.2, 0.4], [17.6, -17.3, 0.1], [23, -17.3, -0.2], [25.2, -15.4, -0.5], [25.4, -10.6, 0.3]]) {
      this.addStatic('block', m.stoneLight, x, 0.6, z, 0.6, 1.5, 0.5, ry);
      this.addCollider(x, z, 0.65, 0.6);
    }

    this.makeFireflies();
    this.flushStatics();
  }

  makeTree(x, z, s, alt) {
    const leaf = alt ? this.m.leaf2 : this.m.leaf;
    this.addStatic('trunk', this.m.wood, x, 1.1 * s, z, s, s, s);
    this.addStatic('dodeca', leaf, x, 2.55 * s, z, 1.05 * s, 1.05 * s * 1.25, 1.05 * s);
    this.addStatic('dodeca', leaf, x + 0.45 * s, 3.05 * s, z + 0.15 * s, 0.72 * s, 0.72 * s, 0.72 * s);
    if (Math.abs(x) < 20 && z < 18) this.addCollider(x, z, 0.7 * s, 0.7 * s);
  }

  makeTorch(x, z, light) {
    // The post now reaches the floor (it used to float above the shrine floor); flame and light stay put.
    const floor = this.groundY(z) - 0.05;
    const h = 0.725 - floor;
    this.box(0.22, h, 0.22, [x, floor + h / 2, z], this.m.wood);
    const flame = this.mesh(this.geo('flame', () => new THREE.OctahedronGeometry(0.25, 0)), this.m.ember, [x, 0.85, z], this.scene, false, false);
    this.glows.push({ obj: flame, baseY: 0.85, phase: Math.random() * TAU, amp: 0.08 });
    if (light) {
      const l = new THREE.PointLight(0xff7a45, 7.5, 7.5, 2);
      l.position.set(x, 0.9, z);
      this.scene.add(l);
    }
  }

  makeChime(x, z, name) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.cyl(0.85, 1.05, 0.42, 8, [0, 0.18, 0], this.m.stone, g);
    for (const sx of [-0.68, 0.68]) this.box(0.3, 2.6, 0.3, [sx, 1.55, 0], this.m.stoneLight, g);
    this.box(1.7, 0.34, 0.34, [0, 2.78, 0], this.m.stoneLight, g);
    const bell = this.cyl(0.48, 0.7, 0.9, 8, [0, 1.7, 0], this.m.gold, g);
    bell.rotation.z = Math.PI;
    const ring = this.mesh(this.geo('chimeRing', () => new THREE.RingGeometry(1.05, 1.19, 24)), this.m.glow, [0, 0.12, 0], g, false, false);
    ring.rotation.x = -Math.PI / 2;
    this.glows.push({ obj: ring, baseY: 0.12, phase: Math.random() * TAU, amp: 0.08 });
    this.addCollider(x, z, 1.5, 0.5);
    const chime = { type: 'chime', name, x, z, used: false, bell, ring, swing: 0, prompt: 'RING' };
    this.chimes.push(chime);
    this.interactables.push(chime);
  }

  makeEchoBell(x, z, size, freq, order) {
    const g = new THREE.Group();
    g.position.set(x, this.groundY(z), z);
    this.scene.add(g);
    const sx = 0.35 + 0.32 * size;
    this.cyl(0.55, 0.68, 0.36, 8, [0, 0.18, 0], this.m.stone, g);
    for (const s of [-sx, sx]) this.box(0.2, 1.9, 0.2, [s, 1.1, 0], this.m.stoneLight, g);
    this.box(sx * 2 + 0.25, 0.24, 0.26, [0, 2.05, 0], this.m.stoneLight, g);
    const bell = this.cyl(0.3 * size, 0.46 * size, 0.62 * size, 8, [0, 2.0 - 0.31 * size - 0.05, 0], this.m.crystal, g);
    bell.rotation.z = Math.PI;
    const ring = this.mesh(this.geo('echoRing', () => new THREE.RingGeometry(0.8, 0.92, 24)), this.m.glowIdle, [0, 0.1, 0], g, false, false);
    ring.rotation.x = -Math.PI / 2;
    this.glows.push({ obj: ring, baseY: 0.1, phase: order, amp: 0.05 });
    this.addCollider(x, z, sx * 2 + 0.3, 0.8);
    const b = { type: 'echo', x, z, freq, order, bell, ring, lit: false, swing: 0, cooldown: 0, prompt: 'STRIKE' };
    this.echoBells.push(b);
    this.interactables.push(b);
    return b;
  }

  makeSign(x, z, text) {
    const g = new THREE.Group();
    g.position.set(x, this.groundY(z), z);
    this.scene.add(g);
    this.box(0.18, 1.15, 0.18, [0, 0.55, 0], this.m.wood, g);
    this.box(1.2, 0.62, 0.16, [0, 1.16, 0], this.m.wood, g);
    this.addCollider(x, z, 0.5, 0.35);
    this.interactables.push({ type: 'sign', x, z, text, prompt: 'READ' });
  }

  makeChest(x, z, kind) {
    const g = new THREE.Group();
    const baseY = this.groundY(z);
    g.position.set(x, baseY, z);
    this.scene.add(g);
    this.roundBox(1.45, 0.72, 0.9, 0.12, [0, 0.4, 0], this.m.wood, g);
    const lid = new THREE.Group();
    lid.position.set(0, 0.78, 0.36);
    g.add(lid);
    this.roundBox(1.48, 0.38, 0.92, 0.13, [0, 0.06, -0.36], this.m.bronze, lid);
    this.box(0.22, 0.48, 0.12, [0, 0.5, -0.48], this.m.gold, g);
    const ring = this.mesh(this.geo('chestRing', () => new THREE.RingGeometry(0.92, 1.03, 24)), this.m.glow, [0, 0.06, 0], g, false, false);
    ring.rotation.x = -Math.PI / 2;
    this.glows.push({ obj: ring, baseY: 0.06, phase: 1.7, amp: 0.07 });
    const chest = { type: 'chest', kind, x, z, used: false, visual: g, lid, ring, baseY, rise: 1, prompt: 'OPEN' };
    this.addCollider(x, z, 1.5, 0.95, () => chest.rise > 0.5);
    this.chests.push(chest);
    this.interactables.push(chest);
    return chest;
  }

  makeFireflies() {
    const n = this.kit.detail(54, 12);
    const pos = new Float32Array(n * 3);
    this.fireflyBase = [];
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 46 - 23;
      const z = Math.random() * 35 - 12;
      const y = 0.6 + Math.random() * 3.5;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      this.fireflyBase.push({ x, y, z, p: Math.random() * TAU });
    }
    this.fireflies = createPoints({
      positions: pos,
      size: 0.1,
      sizeAttenuation: true,
      material: { color: 0xffe58a, transparent: true, opacity: 0.85, depthWrite: false },
    });
    this.scene.add(this.fireflies.object);
  }

  buildPlayer() {
    const m = this.m;
    const g = new THREE.Group();
    this.scene.add(g);
    this.roundBox(0.78, 1.05, 0.58, 0.13, [0, 0.86, 0], m.teal, g);
    this.roundBox(0.66, 0.66, 0.62, 0.18, [0, 1.68, -0.02], m.skin, g);
    this.box(0.86, 0.18, 0.68, [0, 1.35, 0.05], m.cloth, g);
    this.cyl(0.34, 0.43, 0.48, 5, [0, 2.13, 0.08], m.cloth, g).rotation.z = 0.08;
    for (const sx of [-0.48, 0.48]) this.roundBox(0.2, 0.72, 0.22, 0.06, [sx, 0.86, 0], m.skin, g);
    for (const sx of [-0.24, 0.24]) this.roundBox(0.23, 0.72, 0.26, 0.06, [sx, 0.22, 0.02], m.dark, g);
    this.swordPivot = new THREE.Group();
    this.swordPivot.position.set(0.63, 1.0, -0.06);
    g.add(this.swordPivot);
    this.bladeMesh = this.box(0.13, 0.13, 0.95, [0, 0, -0.52], m.steel, this.swordPivot);
    this.box(0.44, 0.12, 0.14, [0, 0, -0.02], m.gold, this.swordPivot);
    this.box(0.16, 0.16, 0.36, [0, 0, 0.2], m.wood, this.swordPivot);
    this.shield = this.roundBox(0.12, 0.76, 0.62, 0.12, [-0.56, 0.95, 0.08], m.bronze, g);
    this.playerVisual = g;
    this.player = this.freshPlayer();
  }

  freshPlayer() {
    return {
      x: 0, z: 17, hp: 60, maxHp: 60, level: 1, xp: 0, xpNext: 40, weapon: 'Sprigblade', weaponBonus: 0,
      attackCd: 0, attackTimer: 0, attackBuffer: 0, dashBuffer: 0, guarding: false, invuln: 0, dashCd: 0, dashTimer: 0,
      dashHits: new Set(), facing: { x: 0, z: -1 }, knockX: 0, knockZ: 0,
    };
  }

  buildEnemyVisual(type) {
    const m = this.m;
    const g = new THREE.Group();
    if (type === 'mossling') {
      const b = this.mesh(this.geo('mossBody', () => new THREE.IcosahedronGeometry(0.62, 0)), m.enemy, [0, 0.58, 0], g);
      b.scale.y = 0.72;
      this.box(0.13, 0.15, 0.07, [-0.22, 0.69, -0.52], m.dark, g, false);
      this.box(0.13, 0.15, 0.07, [0.22, 0.69, -0.52], m.dark, g, false);
      this.cyl(0.2, 0.34, 0.32, 5, [0, 1.05, 0.03], m.leaf2, g);
    } else if (type === 'sentry') {
      this.roundBox(1.0, 1.25, 0.8, 0.13, [0, 0.72, 0], m.stone, g);
      this.roundBox(0.78, 0.58, 0.72, 0.12, [0, 1.58, 0], m.stoneLight, g);
      this.mesh(this.geo('eye15', () => new THREE.OctahedronGeometry(0.15, 0)), m.ember, [0, 1.58, -0.39], g, false, false);
      for (const sx of [-0.62, 0.62]) this.box(0.27, 0.95, 0.28, [sx, 0.75, 0], m.stoneDark, g);
    } else if (type === 'thornback') {
      this.roundBox(1.3, 0.72, 1.55, 0.24, [0, 0.58, 0.05], m.stoneDark, g);
      this.roundBox(1.02, 0.26, 1.2, 0.1, [0, 0.98, 0.08], m.leaf2, g);
      for (const [z, s] of [[0.5, 0.8], [0.08, 1], [-0.34, 0.85]]) {
        const thorn = this.mesh(this.geo('thorn', () => new THREE.ConeGeometry(0.13, 0.46, 4)), m.wood, [0, 1.22, z], g);
        thorn.scale.setScalar(s);
      }
      this.roundBox(0.72, 0.46, 0.42, 0.12, [0, 0.46, -0.84], m.stone, g);
      for (const sx of [-0.18, 0.18]) this.box(0.12, 0.1, 0.06, [sx, 0.55, -1.06], m.ember, g, false);
      for (const sx of [-0.56, 0.56]) for (const sz of [-0.42, 0.5]) this.box(0.2, 0.32, 0.24, [sx, 0.16, sz], m.dark, g);
    } else {
      this.roundBox(1.8, 2.0, 1.5, 0.18, [0, 1.25, 0], m.stoneDark, g);
      this.roundBox(1.55, 0.92, 1.35, 0.18, [0, 2.63, 0], m.stone, g);
      this.mesh(this.geo('eye24', () => new THREE.OctahedronGeometry(0.24, 0)), m.ember, [0, 2.63, -0.7], g, false, false);
      for (const sx of [-1.18, 1.18]) {
        this.roundBox(0.58, 1.55, 0.62, 0.13, [sx, 1.37, 0], m.stone, g);
        this.roundBox(0.65, 0.55, 0.72, 0.12, [sx, 0.36, 0], m.stoneLight, g);
      }
      this.cyl(0.62, 0.85, 0.5, 8, [0, 0.17, 0], m.ember, g, false);
    }
    return g;
  }

  addEnemy(type, x, z, opts = {}) {
    const base = ENEMY_STATS[type];
    const zone = ZONES[opts.zone || (z < -23 ? 'shrine' : 'meadow')];
    const e = {
      ...base, ...opts, type, id: this.enemies.length, x, z, homeX: x, homeZ: z, zone,
      visual: this.buildEnemyVisual(type), alive: true, dormant: false, knockX: 0, knockZ: 0, hitFlash: 0,
      cooldown: 1, special: 3.5, telegraph: 0, phase: Math.random() * TAU, state: 'roam', t: 0, fx: 0, fz: 1,
      enraged: false, volley: 0, hitPlayer: false,
    };
    e.maxHp = e.hp; // a per-enemy hp override also raises its maximum
    this.scene.add(e.visual);
    this.enemies.push(e);
    return e;
  }

  spawnEnemies() {
    this.addEnemy('mossling', -8.7, 7.2);
    this.addEnemy('mossling', 8.6, 5.0);
    this.addEnemy('mossling', -5.7, -6.8);
    this.addEnemy('mossling', 4.2, -7.6);
    this.addEnemy('mossling', 0, -27.2, { hp: 28, xp: 18 });
    this.addEnemy('sentry', -3.6, -37, { tag: 'warden' });
    this.addEnemy('sentry', 3.6, -37, { tag: 'warden' });
    this.boss = this.addEnemy('boss', 0, -54, { zone: 'boss' });
    // The eastern glade keepers and the vault keepers.
    this.addEnemy('thornback', 16.6, -11.6, { tag: 'glade' });
    this.addEnemy('thornback', 23.2, -12.2, { tag: 'glade' });
    this.addEnemy('thornback', -13.4, -30.6, { tag: 'vault', zone: 'vault' });
    this.addEnemy('mossling', -15.8, -36.4, { tag: 'vault', zone: 'vault', hp: 28, xp: 18 });
    this.addEnemy('mossling', -11.6, -35.4, { tag: 'vault', zone: 'vault', hp: 28, xp: 18 });
  }

  resetEnemy(e, alive) {
    e.alive = alive;
    e.dormant = false;
    e.hp = e.maxHp;
    e.x = e.homeX;
    e.z = e.homeZ;
    e.knockX = e.knockZ = 0;
    e.hitFlash = 0;
    e.cooldown = 1 + Math.random();
    e.special = 3.5;
    e.telegraph = 0;
    e.state = 'roam';
    e.t = 0;
    e.fx = 0;
    e.fz = 1;
    e.enraged = false;
    e.volley = 0;
    e.visual.visible = alive;
    e.visual.position.set(e.x, this.groundY(e.z), e.z);
    e.visual.scale.setScalar(1);
    e.visual.rotation.set(0, e.type === 'boss' || e.type === 'thornback' ? Math.PI : 0, 0);
  }

  buildFx() {
    // Pooled sparks and projectiles: two instanced batches that share one shader (kit.instanced).
    this.fxMesh = this.kit.instanced(new THREE.TetrahedronGeometry(1, 0), this.m.fx, FX_CAP);
    this.shotMesh = this.kit.instanced(new THREE.OctahedronGeometry(1, 0), this.m.fx, SHOT_CAP);
    const white = new THREE.Color(1, 1, 1);
    for (const mesh of [this.fxMesh, this.shotMesh]) {
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.setColorAt(0, white);
      mesh.setMatrixAt(0, ZERO_MATRIX);
      mesh.count = 1; // drawn once while loading, so the first hit does not compile a shader
      this.scene.add(mesh);
    }
    // The Ember Warden's slam telegraph: a ring on the floor that fills in before the blow lands.
    this.warnRing = this.mesh(new THREE.RingGeometry(2.55, 3.0, 40), this.m.warn, [0, -0.93, -54], this.scene, false, false);
    this.warnRing.rotation.x = -Math.PI / 2;
    this.warnRing.frustumCulled = false; // drawn (invisibly) on the first frames so its shader is ready
    // Materials that first appear deep in the shrine: draw them once under the floor while loading.
    this.warmGroup = new THREE.Group();
    const warmGeo = this.geo('chestRing', () => new THREE.RingGeometry(0.92, 1.03, 24));
    for (const mat of [this.m.glowLit, this.m.glowIdle, this.m.crystal, this.m.root]) {
      const w = this.mesh(warmGeo, mat, [0, -12, 17], this.warmGroup, true, true);
      w.frustumCulled = false;
    }
    this.scene.add(this.warmGroup);
  }

  /* ------------------------------------------------------------ UI and menus */

  bindUi() {
    const u = (this.ui = {
      hud: $('#hud'), hearts: $('#hearts'), level: $('#level'), xpText: $('#xp-text'), xpFill: $('#xp-fill'),
      objective: $('#objective'), objectiveSub: $('#objective-sub'), gear: $('#gear'), backend: $('#backend-pill'),
      bossWrap: $('#boss-wrap'), bossFill: $('#boss-fill'), prompt: $('#prompt'), toast: $('#toast'), hint: $('#hint'), flash: $('#flash'),
      splash: $('#splash'), continueBtn: $('#continue-btn'), continueDetail: $('#continue-detail'), startBtn: $('#start-btn'),
      diffBtns: [...document.querySelectorAll('.diff')], diffNote: $('#diff-note'), best: $('#best-line'), controls: $('#controls-note'),
      pause: $('#pause'), pauseObjective: $('#pause-objective'), pauseStats: $('#pause-stats'), pauseSide: $('#pause-side'),
      pauseControls: $('#pause-controls'), musicBtn: $('#music-btn'), sfxBtn: $('#sfx-btn'),
      complete: $('#complete'), completeStats: $('#complete-stats'), completeSide: $('#complete-side'), completeBest: $('#complete-best'),
    });
    u.backend.textContent = `${this.kit.backendLabel} · three.js r${THREE.REVISION}`;
    u.startBtn.addEventListener('click', () => this.startNew(false));
    u.continueBtn.addEventListener('click', () => this.continueGame());
    for (const b of u.diffBtns) b.addEventListener('click', () => this.setDifficulty(b.dataset.diff));
    $('#resume-btn').addEventListener('click', () => this.resume());
    $('#checkpoint-btn').addEventListener('click', () => {
      this.resume();
      this.respawn(false);
    });
    $('#settings-btn').addEventListener('click', () => this.kit.menu.open());
    u.musicBtn.addEventListener('click', () => this.setAudio('music', !this.prefs.music));
    u.sfxBtn.addEventListener('click', () => this.setAudio('sfx', !this.prefs.sfx));
    $('#quit-btn').addEventListener('click', () => this.quitToTitle());
    $('#replay-btn').addEventListener('click', () => this.startNew(true));
    $('#title-btn').addEventListener('click', () => this.showTitle());
    // Browsers only start audio after a gesture: any tap or key will do.
    const unlock = () => this.sound.unlock();
    addEventListener('pointerdown', unlock, true);
    addEventListener('keydown', unlock, true);
    addEventListener('focusout', (e) => e.target?.classList?.remove('pad-focus'));
    this.input.onSourceChange(() => this.refreshSource());
    this.kit.touch?.setShown('use', false);
    this.refreshSource();
    this.refreshAudioButtons();
  }

  activeOverlay() {
    if (this.mode === 'title') return this.ui.splash;
    if (this.mode === 'pause') return this.ui.pause;
    if (this.mode === 'done') return this.ui.complete;
    return null;
  }

  visibleButtons(overlay) {
    return [...overlay.querySelectorAll('button')].filter((b) => b.offsetParent !== null && !b.disabled);
  }

  defaultButton(overlay) {
    const d = overlay.querySelector('button[data-default]');
    if (d && d.offsetParent !== null) return d;
    return this.visibleButtons(overlay)[0] || null;
  }

  padFocus(b) {
    if (!b) return;
    for (const o of document.querySelectorAll('.pad-focus')) o.classList.remove('pad-focus');
    b.classList.add('pad-focus');
    b.focus({ preventScroll: false });
  }

  focusDefault(overlay) {
    if (this.input.source === 'touch') return;
    this.padFocus(this.defaultButton(overlay));
  }

  blurMenus() {
    const a = document.activeElement;
    if (a && a.tagName === 'BUTTON' && a.closest('.overlay')) a.blur();
    for (const o of document.querySelectorAll('.pad-focus')) o.classList.remove('pad-focus');
  }

  menuNav(overlay, mv) {
    if (Math.max(Math.abs(mv.x), Math.abs(mv.y)) < 0.5) {
      this.navHeld = false;
      return;
    }
    if (this.navHeld) return;
    this.navHeld = true;
    const list = this.visibleButtons(overlay);
    if (!list.length) return;
    const dir = Math.abs(mv.y) >= Math.abs(mv.x) ? (mv.y > 0 ? -1 : 1) : mv.x > 0 ? 1 : -1;
    const i = list.indexOf(document.activeElement);
    this.padFocus(i < 0 ? this.defaultButton(overlay) : list[(i + dir + list.length) % list.length]);
  }

  /** Title, pause and results screens: stick / D-pad / arrows move, A or Enter chooses, B or Start backs out. */
  menuFrame() {
    const overlay = this.activeOverlay();
    if (!overlay) return;
    const input = this.input;
    if (this.mode === 'title' && this.confirmNewUntil && performance.now() > this.confirmNewUntil) {
      this.confirmNewUntil = 0;
      this.ui.startBtn.textContent = 'Begin Adventure';
    }
    this.menuNav(overlay, input.vector('move'));
    if (input.pressed('confirm') || input.pressed('attack')) {
      const f = document.activeElement;
      const target = f && f.tagName === 'BUTTON' && overlay.contains(f) && f.offsetParent !== null ? f : this.defaultButton(overlay);
      target?.click();
      return;
    }
    if (this.mode === 'pause' && (input.pressed('pause') || input.pressed('dash'))) this.resume();
  }

  refreshSource() {
    const src = this.input.source;
    const html = (CONTROLS[src] || CONTROLS.keyboard).map((s) => `<span>${s}</span>`).join('');
    this.ui.controls.innerHTML = html;
    this.ui.pauseControls.innerHTML = html;
    this.uiCache.prompt = null;
  }

  refreshAudioButtons() {
    this.ui.musicBtn.textContent = `Music: ${this.prefs.music ? 'On' : 'Off'}`;
    this.ui.sfxBtn.textContent = `Sound: ${this.prefs.sfx ? 'On' : 'Off'}`;
  }

  savePrefs() {
    store.set(PREFS_KEY, this.prefs);
  }

  setAudio(kind, on) {
    this.prefs[kind] = !!on;
    this.sound.musicOn = this.prefs.music;
    this.sound.sfxOn = this.prefs.sfx;
    this.sound.applyLevels();
    this.savePrefs();
    this.refreshAudioButtons();
  }

  toggleMute() {
    const on = !(this.prefs.music || this.prefs.sfx);
    this.prefs.music = this.prefs.sfx = on;
    this.setAudio('music', on);
    this.kit.toast(on ? 'Sound on' : 'Sound muted · M brings it back');
  }

  setDifficulty(name) {
    if (!DIFFICULTY[name]) return;
    this.prefs.difficulty = name;
    this.savePrefs();
    this.refreshTitle();
  }

  refreshTitle() {
    const u = this.ui;
    const s = store.get(SAVE_KEY);
    const ok = !!s && s.v === 1;
    u.continueBtn.classList.toggle('hidden', !ok);
    u.continueBtn.toggleAttribute('data-default', ok);
    u.startBtn.toggleAttribute('data-default', !ok);
    if (ok) u.continueDetail.textContent = `${DIFFICULTY[s.difficulty]?.label || 'Normal'} · ${fmtTime(s.elapsed)} · ${PHASE_TITLES[s.phase] || PHASE_TITLES.bells}`;
    if (!this.confirmNewUntil) u.startBtn.textContent = 'Begin Adventure';
    for (const b of u.diffBtns) b.setAttribute('aria-pressed', String(b.dataset.diff === this.prefs.difficulty));
    u.diffNote.textContent = DIFFICULTY[this.prefs.difficulty].note + (ok ? ' Applies to new adventures.' : '');
    const best = store.get(BEST_KEY, {}) || {};
    const parts = Object.keys(DIFFICULTY)
      .filter((k) => best[k] > 0)
      .map((k) => `${DIFFICULTY[k].label} ${fmtTime(best[k])}`);
    u.best.textContent = parts.length ? `Best clears · ${parts.join(' · ')}` : 'No clears yet. The Ember Bell waits.';
  }

  showTitle() {
    if (this.mode === 'play' || this.mode === 'pause') this.save();
    this.mode = 'title';
    const u = this.ui;
    u.hud.classList.add('hidden');
    u.pause.classList.add('hidden');
    u.complete.classList.add('hidden');
    u.splash.classList.remove('hidden');
    this.clearToasts();
    this.kit.touch?.suspend(true, 'game');
    this.sound.setTrack(null);
    this.confirmNewUntil = 0;
    this.refreshTitle();
    this.focusDefault(u.splash);
  }

  startNew(force) {
    const hasSave = !!store.get(SAVE_KEY);
    if (!force && hasSave && performance.now() > this.confirmNewUntil) {
      // A second press within a few seconds confirms replacing the saved adventure.
      this.confirmNewUntil = performance.now() + 4000;
      this.ui.startBtn.textContent = 'Begin anew? Press again';
      return;
    }
    this.confirmNewUntil = 0;
    this.ui.startBtn.textContent = 'Begin Adventure';
    store.del(SAVE_KEY);
    this.difficulty = this.prefs.difficulty;
    this.applyState(null);
    this.beginPlay(true);
  }

  continueGame() {
    const s = store.get(SAVE_KEY);
    if (!s || s.v !== 1) {
      this.refreshTitle();
      return;
    }
    this.applyState(s);
    this.beginPlay(false);
  }

  beginPlay(fresh) {
    this.mode = 'play';
    const u = this.ui;
    u.splash.classList.add('hidden');
    u.pause.classList.add('hidden');
    u.complete.classList.add('hidden');
    u.hud.classList.remove('hidden');
    this.blurMenus();
    this.kit.touch?.suspend(false, 'game');
    this.sound.unlock();
    this.sound.hold(false);
    this.input.settle();
    if (fresh) {
      this.showToast('Wake the three gold chimes. The mossbound gate will answer.', 3.8, true);
      this.showHint(HINTS[this.input.source] || HINTS.keyboard, 6);
    } else {
      this.showToast(`The shrine stone remembers you. ${this.objectiveText()[0]}.`, 3.4, true);
    }
    this.updateUI(true);
    this.save();
  }

  openPause() {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    this.save();
    this.prefs.zoom = Math.round(this.cameraZoom * 100) / 100;
    this.savePrefs();
    const u = this.ui;
    const [title, sub] = this.objectiveText();
    u.pauseObjective.textContent = title;
    u.pauseStats.textContent = `${sub} · Time ${fmtTime(this.elapsed)} · ${DIFFICULTY[this.difficulty].label} · Level ${this.player.level}`;
    u.pauseSide.textContent = this.sideText();
    this.refreshAudioButtons();
    this.refreshSource();
    u.pause.classList.remove('hidden');
    this.kit.touch?.suspend(true, 'game');
    this.sound.hold(true);
    this.focusDefault(u.pause);
  }

  resume() {
    if (this.mode !== 'pause') return;
    this.mode = 'play';
    this.ui.pause.classList.add('hidden');
    this.blurMenus();
    this.kit.touch?.suspend(false, 'game');
    this.sound.hold(false);
    this.input.settle();
  }

  quitToTitle() {
    this.save();
    this.showTitle();
  }

  autoPause() {
    if (this.mode === 'play') this.openPause();
  }

  onKitPause(paused) {
    if (paused) {
      if (this.mode === 'play') this.openPause();
      this.sound.hold(true);
    } else if (this.mode === 'play') {
      this.sound.hold(false);
    }
  }

  objectiveText() {
    switch (this.phase) {
      case 'bells': return [PHASE_TITLES.bells, `${this.bells} / 3`];
      case 'gate': return [PHASE_TITLES.gate, 'The northern gate is open'];
      case 'chest': return [PHASE_TITLES.chest, 'A chest glows in the first chamber'];
      case 'wardens': return [PHASE_TITLES.wardens, `${this.wardens} / 2`];
      case 'bossApproach': return [PHASE_TITLES.bossApproach, 'The inner seal is open'];
      case 'boss': return [PHASE_TITLES.boss, 'Guard the slam · punish the recovery'];
      case 'relic': return [PHASE_TITLES.relic, 'The guardian is broken'];
      default: return [PHASE_TITLES.done, 'Mission complete'];
    }
  }

  sideText() {
    const s = this.side;
    if (s.vaultChest) return 'Rootkey Vault: complete. Heart Container and Ember Charm found.';
    if (s.bellsSolved) return 'Rootkey Vault: the echoes answered. Claim what rose from the floor.';
    if (s.vaultCleared) return 'Rootkey Vault: wake the echo bells, smallest voice first.';
    if (s.vaultUnlocked) return 'Rootkey Vault: the root door stands open, west of the first shrine chamber.';
    if (s.key) return 'Side path: the Rootkey fits a root-bound door inside the shrine.';
    if (this.gladeOpen) return 'Side path: the eastern glade cache is unsealed.';
    return 'Side path: something is kept in the eastern glade of the meadow.';
  }

  showToast(text, seconds = 2.4, urgent = false) {
    if (urgent) this.toastQueue.length = 0;
    else if (this.toastTimer > 0 && this.toastShown < 1.1) {
      if (this.toastQueue.length < 3) this.toastQueue.push([text, seconds]);
      return;
    }
    this.ui.toast.textContent = text;
    this.ui.toast.classList.remove('hidden');
    this.toastTimer = seconds;
    this.toastShown = 0;
  }

  showHint(text, seconds = 3) {
    this.ui.hint.textContent = text;
    this.ui.hint.classList.remove('hidden');
    this.hintTimer = seconds;
  }

  clearToasts() {
    this.toastQueue.length = 0;
    this.toastTimer = 0;
    this.hintTimer = 0;
    this.ui.toast.classList.add('hidden');
    this.ui.hint.classList.add('hidden');
  }

  tickToasts(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      this.toastShown += dt;
      if (this.toastQueue.length && (this.toastShown >= 1.1 || this.toastTimer <= 0)) {
        const [text, seconds] = this.toastQueue.shift();
        this.toastTimer = 0;
        this.showToast(text, seconds);
      } else if (this.toastTimer <= 0) {
        this.ui.toast.classList.add('hidden');
      }
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.ui.hint.classList.add('hidden');
    }
  }

  updateUI(force = false) {
    const u = this.ui;
    const c = this.uiCache;
    const p = this.player;
    const hp = Math.max(0, Math.ceil(p.hp));
    const hk = `${hp}/${p.maxHp}`;
    if (force || c.hearts !== hk) {
      c.hearts = hk;
      const n = Math.ceil(p.maxHp / 10);
      let html = '';
      for (let i = 0; i < n; i++) html += `<span class="heart${p.hp > i * 10 ? ' on' : ''}">◆</span>`;
      u.hearts.innerHTML = html;
      u.hearts.setAttribute('aria-label', `Health ${hp} of ${p.maxHp}`);
    }
    if (force || c.level !== p.level) {
      c.level = p.level;
      u.level.textContent = p.level;
    }
    const xk = `${Math.floor(p.xp)}/${p.xpNext}`;
    if (force || c.xp !== xk) {
      c.xp = xk;
      u.xpText.textContent = `${Math.floor(p.xp)} / ${p.xpNext} XP`;
      u.xpFill.style.width = `${clamp((p.xp / p.xpNext) * 100, 0, 100)}%`;
    }
    const gk = `${p.weapon}|${this.side.charm}|${this.side.key}`;
    if (force || c.gear !== gk) {
      c.gear = gk;
      u.gear.innerHTML = `${esc(p.weapon)}<br>Barkguard${this.side.charm ? '<br><em>Ember Charm</em>' : ''}${this.side.key ? '<br><em>Rootkey</em>' : ''}`;
    }
    const [title, sub] = this.objectiveText();
    if (force || c.objTitle !== title) {
      c.objTitle = title;
      u.objective.textContent = title;
    }
    if (force || c.objSub !== sub) {
      c.objSub = sub;
      u.objectiveSub.textContent = sub;
    }
    if (this.boss.alive) {
      const w = Math.round(clamp(this.boss.hp / this.boss.maxHp, 0, 1) * 1000) / 10;
      if (force || c.boss !== w) {
        c.boss = w;
        u.bossFill.style.width = `${w}%`;
      }
    }
    const near = this.mode === 'play' ? this.nearby : null;
    const pk = near ? `${this.input.source}|${near.prompt}` : '';
    if (force || c.prompt !== pk) {
      c.prompt = pk;
      if (near) {
        const key = USE_KEY[this.input.source];
        u.prompt.textContent = key ? `${key} · ${near.prompt}` : near.prompt;
        u.prompt.classList.remove('hidden');
      } else {
        u.prompt.classList.add('hidden');
      }
    }
  }

  /* ------------------------------------------------------------ state, save and load */

  snapshot() {
    const p = this.player;
    const dead = [];
    for (const e of this.enemies) {
      if (e.alive) continue;
      if (e.tag === 'vault' && !this.side.vaultCleared) continue; // an unfinished vault fight starts over
      if (e === this.boss && this.phase !== 'relic') continue;
      dead.push(e.id);
    }
    return {
      v: 1,
      difficulty: this.difficulty,
      phase: this.phase === 'boss' ? 'bossApproach' : this.phase,
      chimes: this.chimes.map((c) => c.used),
      chest: this.chest.used,
      dead,
      checkpoint: { x: this.checkpoint.x, z: this.checkpoint.z },
      player: { level: p.level, xp: p.xp, xpNext: p.xpNext, maxHp: p.maxHp, weapon: p.weapon, weaponBonus: p.weaponBonus },
      side: { ...this.side },
      relic: this.relic ? { x: this.relic.x, z: this.relic.z } : null,
      kills: this.kills,
      deaths: this.deaths,
      elapsed: Math.round(this.elapsed * 10) / 10,
    };
  }

  save() {
    if ((this.mode === 'play' || this.mode === 'pause') && !this.finished) store.set(SAVE_KEY, this.snapshot());
  }

  /** Put the whole world in a fresh state (s = null) or the state of a save. */
  applyState(s) {
    if (!s || s.v !== 1) s = null;
    this.difficulty = s && DIFFICULTY[s.difficulty] ? s.difficulty : this.prefs.difficulty;
    this.phase = s && PHASE_TITLES[s.phase] && s.phase !== 'done' ? s.phase : 'bells';
    if (this.phase === 'boss') this.phase = 'bossApproach';
    this.finished = false;
    this.relicClaimed = false;
    this.side = { ...SIDE_DEFAULT };
    for (const k of Object.keys(SIDE_DEFAULT)) this.side[k] = !!s?.side?.[k];

    // Chimes and the gate.
    this.chimes.forEach((c, i) => {
      c.used = Array.isArray(s?.chimes) && s.chimes[i] === true;
      c.ring.material = c.used ? this.m.ember : this.m.glow;
      c.swing = 0;
      c.bell.rotation.z = Math.PI;
    });
    this.bells = this.chimes.filter((c) => c.used).length;
    this.gateOpen = this.bells >= 3;
    if (this.gateOpen && this.phase === 'bells') this.phase = 'gate';
    this.gateDoor.position.y = this.gateOpen ? 6.4 : this.gateDoor.userData.closedY;

    // Chests.
    this.chest.used = !!s?.chest;
    this.chestOpened = this.chest.used;
    this.cache.used = this.side.keyChest;
    this.vaultChest.used = this.side.vaultChest;
    this.vaultChest.rise = this.side.bellsSolved ? 1 : 0;
    for (const c of this.chests) {
      c.lid.rotation.x = c.used ? -1.05 : 0;
      c.ring.visible = !c.used;
    }
    this.vaultChest.visual.visible = this.vaultChest.rise > 0;
    this.vaultChest.visual.position.y = this.vaultChest.baseY - (1 - this.vaultChest.rise) * 1.4;

    // Enemies.
    const dead = new Set(Array.isArray(s?.dead) ? s.dead : []);
    for (const e of this.enemies) {
      let alive = !dead.has(e.id);
      if (e.tag === 'vault') alive = !this.side.vaultCleared;
      if (e === this.boss) alive = this.phase !== 'relic';
      this.resetEnemy(e, alive);
      if (e.tag === 'vault' && alive) {
        e.dormant = true;
        e.visual.visible = false;
      }
    }
    this.wardens = this.enemies.filter((e) => e.tag === 'warden' && !e.alive).length;
    this.innerOpen = this.wardens >= 2;
    this.innerDoor.position.y = this.innerOpen ? 5.7 : this.innerDoor.userData.closedY;
    this.bossActive = false;
    this.ui.bossWrap.classList.add('hidden');
    this.gladeOpen = this.gladeCleared();
    this.gladeRoots.position.y = this.gladeOpen ? -2.3 : 0;
    this.gladeRoots.visible = !this.gladeOpen;

    // The vault.
    this.vaultSealed = false;
    this.bellStep = 0;
    this.vaultDoor.position.y = this.side.vaultUnlocked ? -2.9 : this.vaultDoor.userData.closedY;
    for (const b of this.echoBells) {
      b.lit = this.side.bellsSolved;
      b.ring.material = b.lit ? this.m.glowLit : this.m.glowIdle;
      b.swing = 0;
      b.cooldown = 0;
      b.bell.rotation.z = Math.PI;
    }

    // The relic.
    this.removeRelic();
    if (this.phase === 'relic') this.spawnRelic(Number(s?.relic?.x) || 0, Number(s?.relic?.z) || -54);

    // The player.
    const p = (this.player = this.freshPlayer());
    const sp = s?.player;
    if (sp) {
      p.level = clamp(sp.level | 0, 1, 99) || 1;
      p.xp = Math.max(0, +sp.xp || 0);
      p.xpNext = Math.max(40, +sp.xpNext || 40);
      p.maxHp = clamp(+sp.maxHp || 60, 60, 400);
      p.weapon = typeof sp.weapon === 'string' && sp.weapon ? sp.weapon.slice(0, 40) : 'Sprigblade';
      p.weaponBonus = Math.max(0, +sp.weaponBonus || 0);
    }
    p.hp = p.maxHp;
    const cp = s?.checkpoint;
    this.checkpoint = cp && Number.isFinite(+cp.x) && Number.isFinite(+cp.z) ? { x: +cp.x, z: +cp.z } : { x: 0, z: 17 };
    p.x = this.checkpoint.x;
    p.z = this.checkpoint.z;
    this.bladeMesh.material = p.weaponBonus > 0 ? this.m.bronze : this.m.steel;
    this.playerVisual.visible = true;
    this.playerVisual.position.set(p.x, this.groundY(p.z) + 0.08, p.z);
    this.playerVisual.rotation.set(0, 0, 0);

    this.kills = s?.kills | 0;
    this.deaths = s?.deaths | 0;
    this.elapsed = Math.max(0, +s?.elapsed || 0);
    this.clearProjectiles();
    this.clearParticles();
    this.nearby = null;
    this.kit.touch?.setShown('use', false);
    this.hitStop = 0;
    this.cameraShake = 0;
    this.flash = 0;
    this.ui.flash.style.opacity = '0';
    this.clearToasts();
    this.snapCamera();
    this.uiCache = {};
    this.updateUI(true);
  }

  gladeCleared() {
    return this.enemies.every((e) => e.tag !== 'glade' || !e.alive);
  }

  /* ------------------------------------------------------------ the frame */

  frame(dt) {
    this.time += dt;
    const input = this.input;
    if (input.pressed('mute')) this.toggleMute();
    if (this.mode === 'play') {
      if (input.pressed('pause')) this.openPause();
      else this.playFrame(dt);
    } else {
      this.menuFrame();
    }
    if (this.mode !== 'pause') {
      this.animT += dt;
      this.animateWorld(dt, this.animT);
      this.updateParticles(dt);
      this.renderPools();
    }
    this.updateCamera(dt);
    this.updateSun();
    this.sound.update();
    this.post.render();
    if (this.warmFrames > 0) {
      this.warmFrames -= 1;
      if (this.warmFrames === 0) this.scene.remove(this.warmGroup);
    }
  }

  playFrame(dt) {
    const input = this.input;
    const p = this.player;
    if (input.pressed('attack')) p.attackBuffer = 0.2;
    if (input.pressed('dash')) p.dashBuffer = 0.16;
    const mv = input.vector('move');
    this.moveX = mv.x;
    this.moveZ = -mv.y;
    this.guardHeld = input.down('guard');
    const zoom = input.zoom() * 0.08 + input.value('zoom') * dt * 0.9;
    if (zoom) this.cameraZoom = clamp(this.cameraZoom - zoom, 0.72, 1.34);
    if (input.pressed('use')) this.use();
    if (this.mode !== 'play') return; // claiming the Ember Bell ends the run

    if (this.hitStop > 0) {
      this.hitStop -= dt;
    } else {
      // Small fixed-size steps keep fast dashes and charges from skipping through walls on slow frames.
      const steps = Math.min(4, Math.ceil(dt / 0.034));
      const h = dt / steps;
      for (let i = 0; i < steps && this.mode === 'play'; i++) this.simulate(h);
    }
    this.tickToasts(dt);
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.2);
      const fo = Math.round(this.flash * 20) / 20;
      if (fo !== this.uiCache.flash) {
        this.uiCache.flash = fo;
        this.ui.flash.style.opacity = String(fo);
      }
    }
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.08;
      this.updateUI();
    }
    this.sound.setTrack(this.mode !== 'play' ? null : this.bossActive ? 'boss' : p.z < -20 ? 'shrine' : 'meadow');
  }

  simulate(h) {
    this.elapsed += h;
    this.updatePlayer(h);
    this.updateEnemies(h);
    this.updateProjectiles(h);
    if (this.mode === 'play') this.updateProgress();
  }

  /* ------------------------------------------------------------ player */

  updatePlayer(dt) {
    const p = this.player;
    const v = this.playerVisual;
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.guarding = this.guardHeld && p.dashTimer <= 0;

    const inX = this.moveX;
    const inZ = this.moveZ;
    if (p.dashTimer <= 0) {
      const l = Math.hypot(inX, inZ);
      if (l > 0.05) {
        p.facing.x = inX / l;
        p.facing.z = inZ / l;
      }
    }
    if (p.dashBuffer > 0) {
      p.dashBuffer -= dt;
      if (this.dash()) p.dashBuffer = 0;
    }
    if (p.attackBuffer > 0) {
      p.attackBuffer -= dt;
      if (p.attackCd <= 0) {
        p.attackBuffer = 0;
        this.attack();
      }
    }

    let speed = p.guarding ? 3.05 : 5.05;
    if (p.attackTimer > 0) speed *= 0.68;
    let dx = inX;
    let dz = inZ;
    if (p.dashTimer > 0) {
      speed = 9.2;
      dx = p.facing.x;
      dz = p.facing.z;
    }
    const mx = dx * speed * dt + p.knockX * dt;
    const mz = dz * speed * dt + p.knockZ * dt;
    p.knockX *= Math.exp(-dt * 8);
    p.knockZ *= Math.exp(-dt * 8);
    const nx = p.x + mx;
    const nz = p.z + mz;
    if (!this.blocked(nx, p.z)) p.x = nx;
    if (!this.blocked(p.x, nz)) p.z = nz;
    if (p.dashTimer > 0 && this.side.charm) this.emberDash();

    v.position.set(p.x, this.groundY(p.z) + 0.08, p.z);
    const yaw = Math.atan2(-p.facing.x, -p.facing.z);
    v.rotation.y = wrapAngle(lerpAngle(v.rotation.y, yaw, 1 - Math.exp(-dt * 12)));
    v.position.y += Math.min(1, Math.hypot(inX, inZ)) * Math.sin(this.elapsed * 12) * 0.035;
    v.visible = !(p.invuln > 0.25 && Math.floor(this.elapsed * 18) % 2 === 0);
    if (p.attackTimer > 0) {
      const q = 1 - p.attackTimer / 0.28;
      this.swordPivot.rotation.y = -1.15 + q * 2.3;
      this.swordPivot.rotation.z = -0.25 + Math.sin(q * Math.PI) * 0.45;
    } else {
      this.swordPivot.rotation.y = 0.25;
      this.swordPivot.rotation.z = 0;
    }
    const k = 1 - Math.exp(-dt * 14);
    this.shield.rotation.z = lerp(this.shield.rotation.z, p.guarding ? -0.55 : 0, k);
    this.shield.position.z = lerp(this.shield.position.z, p.guarding ? -0.35 : 0.08, k);

    const near = this.findInteractable();
    if (near !== this.nearby) {
      this.nearby = near;
      this.kit.touch?.setShown('use', !!near);
      if (near) this.kit.touch?.setLabel('use', near.prompt);
    }
  }

  attack() {
    const p = this.player;
    p.attackCd = 0.42;
    p.attackTimer = 0.28;
    this.sound.tone(190, 0.08, 'sawtooth', 0.032, 1.8);
    const dmg = 12 + p.weaponBonus + (p.level - 1) * 1.5;
    for (const e of this.enemies) {
      if (!e.alive || e.dormant || (e === this.boss && !this.bossActive)) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.15 + (e.type === 'boss' ? 0.5 : e.type === 'thornback' ? 0.25 : 0)) continue;
      if ((dx * p.facing.x + dz * p.facing.z) / (d || 1) < -0.18) continue;
      if (e.type === 'thornback' && this.shellBlocks(e)) {
        this.clang(e);
        continue;
      }
      const mult = e.type === 'thornback' && e.state === 'stun' ? 1.5 : 1;
      this.hitEnemy(e, dmg * mult, p.facing.x * 3.4, p.facing.z * 3.4);
    }
    // Echo bells ring when struck: only the nearest one in front, so one swing is one note.
    let bell = null;
    let bd = 2.1;
    for (const b of this.echoBells) {
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < bd && (dx * p.facing.x + dz * p.facing.z) / (d || 1) > -0.18) {
        bd = d;
        bell = b;
      }
    }
    if (bell) this.strikeBell(bell);
  }

  dash() {
    const p = this.player;
    if (p.dashCd > 0 || p.guarding) return false;
    p.dashCd = this.side.charm ? 0.85 : 1.05;
    p.dashTimer = 0.18;
    p.invuln = Math.max(p.invuln, 0.2);
    p.dashHits.clear();
    this.sound.tone(130, 0.07, 'triangle', 0.025, 1.6);
    this.burst(p.x, p.z, this.side.charm ? 0xff9a4d : 0xc8d5a2, 5, 0.55);
    return true;
  }

  /** With the Ember Charm, a dash scorches every foe it passes through (once each). */
  emberDash() {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive || e.dormant || p.dashHits.has(e) || (e === this.boss && !this.bossActive)) continue;
      if (Math.hypot(e.x - p.x, e.z - p.z) < e.radius + 0.7) {
        p.dashHits.add(e);
        this.hitEnemy(e, 8 + p.level * 2, p.facing.x * 2, p.facing.z * 2);
      }
    }
    if (Math.random() < 0.6) this.burst(p.x, p.z, 0xff8a3d, 1, 0.35);
  }

  use() {
    const a = this.findInteractable();
    if (!a) return;
    switch (a.type) {
      case 'sign':
        this.showToast(a.text, 4.4, true);
        this.sound.tone(520, 0.06, 'triangle', 0.025, 1);
        break;
      case 'chime':
        this.ringChime(a);
        break;
      case 'chest':
        this.openChest(a);
        break;
      case 'vaultDoor':
        this.unlockVault();
        break;
      case 'echo':
        this.strikeBell(a);
        break;
      case 'relic':
        a.used = true;
        this.relicClaimed = true;
        this.complete();
        break;
      default:
        break;
    }
  }

  canInteract(a) {
    switch (a.type) {
      case 'chime':
      case 'relic':
        return !a.used;
      case 'chest':
        return !a.used && (a.kind !== 'vault' || (this.side.bellsSolved && a.rise > 0.95));
      case 'vaultDoor':
        return !this.side.vaultUnlocked;
      case 'echo':
        return this.side.vaultCleared && !this.side.bellsSolved;
      default:
        return true;
    }
  }

  findInteractable() {
    const p = this.player;
    let best = null;
    let bd = 2.15;
    for (const a of this.interactables) {
      if (!this.canInteract(a)) continue;
      const d = Math.hypot(p.x - a.x, p.z - a.z);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  ringChime(a) {
    if (a.used) return;
    a.used = true;
    this.bells += 1;
    a.swing = 0.6;
    a.ring.material = this.m.ember;
    this.sound.chord([392, 523, 659]);
    this.burst(a.x, a.z, 0xffdc6a, 10, 1.25);
    this.input.rumble(0.25, 90);
    if (this.bells >= 3) {
      this.gateOpen = true;
      if (this.phase === 'bells') this.phase = 'gate';
      this.showToast('The three notes join. The mossbound gate rises.', 3.7);
      this.sound.chord([330, 440, 554, 659], 0.055, 0.32);
      this.sound.tone(55, 0.9, 'sawtooth', 0.025, 0.8, 0.3);
      this.cameraShake = Math.max(this.cameraShake, 0.15);
    } else {
      const left = 3 - this.bells;
      this.showToast(`${a.name} answers. ${left} chime${left === 1 ? '' : 's'} remain${left === 1 ? 's' : ''}.`, 2.4);
    }
    this.save();
  }

  openChest(a) {
    if (a.used) return;
    const p = this.player;
    if (a.kind === 'main') {
      if (this.phase === 'bells' || this.phase === 'gate') {
        this.showToast('The old lock is cold. The gate must be opened first.', 2.2, true);
        return;
      }
      a.used = true;
      this.chestOpened = true;
      a.ring.visible = false;
      p.weapon = 'Bronzeleaf Edge';
      p.weaponBonus = 5;
      this.bladeMesh.material = this.m.bronze;
      const before = p.level;
      this.gainXP(40);
      if (p.level === before) p.maxHp += 10;
      p.hp = p.maxHp;
      // Opening the chest after the wardens already fell must not send the quest backwards.
      if (this.phase === 'chest') {
        this.phase = 'wardens';
        this.checkpoint = { x: 0, z: -28 };
      }
      this.sound.chord([440, 554, 659, 880]);
      this.burst(a.x, a.z, 0xffa24d, 14, 1.5);
      this.input.rumble(0.3, 120);
      this.showToast('Bronzeleaf Edge acquired · +5 blade power · +1 heart · 40 XP', 4.0, true);
    } else if (a.kind === 'cache') {
      if (!this.gladeOpen) {
        this.showToast('Thorny roots bind the cache. Its shell-backed keepers still prowl the glade.', 2.8, true);
        this.sound.tone(140, 0.12, 'triangle', 0.03, 0.8);
        return;
      }
      a.used = true;
      a.ring.visible = false;
      this.side.keyChest = true;
      this.side.key = true;
      this.gainXP(10);
      this.sound.chord([523, 659, 784, 1046]);
      this.burst(a.x, a.z, 0xffdc6a, 12, 1.3);
      this.input.rumble(0.3, 120);
      this.showToast('Rootkey acquired · a root-bound door waits inside the shrine, west of the first chamber.', 4.2, true);
    } else if (a.kind === 'vault') {
      if (!this.side.bellsSolved || a.rise < 0.95) return;
      a.used = true;
      a.ring.visible = false;
      this.side.vaultChest = true;
      this.side.charm = true;
      p.maxHp += 10;
      p.hp = p.maxHp;
      this.sound.chord([392, 494, 587, 784, 988], 0.07);
      this.burst(a.x, a.z, 0xff9a4d, 18, 1.6);
      this.input.rumble(0.4, 160);
      this.showToast('Heart Container · +1 heart. Ember Charm · your dash now scorches what it passes.', 4.6, true);
    }
    this.save();
  }

  unlockVault() {
    if (this.side.vaultUnlocked) return;
    if (!this.side.key) {
      this.showToast('A root-bound door with a bronze keyhole. The eastern glade of the meadow keeps its Rootkey.', 3.4, true);
      this.sound.tone(140, 0.12, 'triangle', 0.03, 0.8);
      return;
    }
    this.side.key = false;
    this.side.vaultUnlocked = true;
    this.sound.tone(60, 0.9, 'sawtooth', 0.035, 0.7);
    this.sound.chord([294, 370, 440], 0.08, 0.3);
    this.cameraShake = Math.max(this.cameraShake, 0.15);
    this.showToast('The Rootkey turns. The roots draw back from the vault door.', 3.0, true);
    this.save();
  }

  sealVault() {
    this.vaultSealed = true;
    for (const e of this.enemies) {
      if (e.tag !== 'vault' || !e.alive) continue;
      e.dormant = false;
      e.visual.visible = true;
      e.cooldown = 1.2 + Math.random() * 0.6;
      this.burst(e.x, e.z, 0x9ed36a, 8, 0.8);
    }
    this.sound.tone(58, 0.6, 'sawtooth', 0.04, 0.7);
    this.sound.chord([220, 262, 311], 0.07, 0.15);
    this.cameraShake = Math.max(this.cameraShake, 0.2);
    this.showToast('Roots knot the doorway shut! Break the vault keepers.', 3.0, true);
  }

  resetVault() {
    this.vaultSealed = false;
    for (const e of this.enemies) {
      if (e.tag !== 'vault') continue;
      this.resetEnemy(e, true);
      e.dormant = true;
      e.visual.visible = false;
    }
  }

  checkVault() {
    if (!this.vaultSealed || this.enemies.some((e) => e.tag === 'vault' && e.alive)) return;
    this.vaultSealed = false;
    this.side.vaultCleared = true;
    this.sound.chord([294, 392, 494, 587], 0.07, 0.2);
    this.showToast('The roots loosen. Three echo bells stir along the west wall.', 3.4);
  }

  strikeBell(b) {
    if (b.cooldown > 0) return;
    b.cooldown = 0.3;
    b.swing = 0.5;
    this.sound.bell(b.freq);
    if (this.side.bellsSolved) return;
    if (!this.side.vaultCleared) {
      this.showToast('The echo bell hums, but the vault keepers still hold its voice.', 2.2);
      return;
    }
    if (b.lit) return;
    if (b.order === this.bellStep + 1) {
      this.bellStep += 1;
      b.lit = true;
      b.ring.material = this.m.glowLit;
      this.burst(b.x, b.z, 0xffdc6a, 8, 0.9);
      if (this.bellStep >= 3) {
        this.side.bellsSolved = true;
        this.sound.chord([392, 587, 784, 988], 0.09, 0.4);
        this.showToast('The echoes sing as one. Something rises from the vault floor.', 3.4, true);
        this.cameraShake = Math.max(this.cameraShake, 0.2);
        this.save();
      }
    } else {
      this.bellStep = 0;
      for (const o of this.echoBells) {
        o.lit = false;
        o.ring.material = this.m.glowIdle;
      }
      this.sound.tone(110, 0.3, 'sawtooth', 0.03, 0.7, 0.12);
      this.showToast('The echoes scatter. Wake the smallest voice first.', 2.6, true);
    }
  }

  /* ------------------------------------------------------------ combat */

  shellBlocks(e) {
    if (e.state === 'stun') return false;
    const p = this.player;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    return (dx * e.fx + dz * e.fz) / d > 0.35;
  }

  clang(e) {
    const p = this.player;
    this.sound.clang();
    this.burst(e.x + e.fx * 0.9, e.z + e.fz * 0.9, 0xdfe6d8, 6, 0.6);
    p.knockX -= p.facing.x * 3;
    p.knockZ -= p.facing.z * 3;
    this.hitStop = Math.max(this.hitStop, 0.03);
    this.input.rumble(0.2, 60);
  }

  hitEnemy(e, dmg, kx = 0, kz = 0) {
    if (!e.alive) return;
    e.hp -= dmg;
    const heavy = e.type === 'boss' ? 4 : e.type === 'thornback' ? 2 : 1;
    e.knockX += kx / heavy;
    e.knockZ += kz / heavy;
    e.hitFlash = 0.12;
    this.burst(e.x, e.z, e.type === 'boss' ? 0xff7549 : 0xd7e876, 6, 0.7);
    this.sound.tone(e.type === 'boss' ? 95 : 150, 0.055, 'square', 0.02, 0.75);
    this.hitStop = Math.max(this.hitStop, 0.045);
    this.input.rumble(0.18, 50);
    if (e === this.boss && !e.enraged && e.hp > 0 && e.hp < e.maxHp / 2) {
      e.enraged = true;
      this.showToast('The Ember Warden burns hotter!', 2.2, true);
      this.sound.tone(70, 0.6, 'sawtooth', 0.05, 0.7);
      this.cameraShake = Math.max(this.cameraShake, 0.3);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (!e.alive) return;
    const p = this.player;
    e.alive = false;
    e.visual.visible = false;
    this.kills += 1;
    this.gainXP(e.xp);
    const boss = e.type === 'boss';
    this.burst(e.x, e.z, boss ? 0xff6a3d : 0x9ed36a, boss ? 26 : 10, boss ? 2.3 : 1);
    if (e.tag === 'warden') {
      this.wardens += 1;
      this.showToast(`Ruin warden broken · ${this.wardens}/2`, 2.2);
      if (this.wardens >= 2) {
        this.innerOpen = true;
        if (this.phase === 'chest' || this.phase === 'wardens') this.phase = 'bossApproach';
        this.sound.chord([294, 392, 494]);
        this.showToast('The inner seal releases. The Ember Warden waits ahead.', 3.4);
      }
    }
    if (e.tag === 'glade' && !this.gladeOpen && this.gladeCleared()) {
      this.gladeOpen = true;
      this.sound.chord([392, 494, 587], 0.07, 0.2);
      this.showToast('The roots around the eastern cache wither away.', 3.0);
    }
    if (e.tag === 'vault') this.checkVault();
    if (boss) {
      this.bossActive = false;
      this.ui.bossWrap.classList.add('hidden');
      this.phase = 'relic';
      this.spawnRelic(e.x, e.z);
      this.clearProjectiles();
      this.sound.chord([262, 330, 392, 523, 659]);
      this.showToast('The Ember Warden falls. Claim the bell-core.', 4, true);
      this.hitStop = 0.14;
      this.cameraShake = Math.max(this.cameraShake, 0.5);
      this.input.rumble(0.8, 320);
    } else if (Math.random() < DIFFICULTY[this.difficulty].heal && p.hp < p.maxHp - 5) {
      p.hp = Math.min(p.maxHp, p.hp + 10);
      this.showToast('Wild mint restores one heart.', 1.5);
    }
    this.save();
  }

  gainXP(n) {
    const p = this.player;
    p.xp += n;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = 40 + (p.level - 1) * 50;
      p.maxHp += 10;
      p.hp = p.maxHp;
      this.sound.chord([523, 659, 784]);
      this.showToast(`Level ${p.level} · +1 heart · blade power increased`, 2.8);
    }
  }

  /** Returns true when the blow sent the player back to the checkpoint. */
  damagePlayer(amount, sx, sz) {
    const p = this.player;
    if (p.invuln > 0 || this.mode !== 'play') return false;
    const scaled = Math.max(1, Math.round(amount * DIFFICULTY[this.difficulty].hurt));
    const actual = p.guarding ? Math.ceil(scaled * 0.35) : scaled;
    p.hp -= actual;
    p.invuln = p.guarding ? 0.22 : 0.62;
    const dx = p.x - sx;
    const dz = p.z - sz;
    const l = Math.hypot(dx, dz) || 1;
    p.knockX += (dx / l) * (p.guarding ? 2 : 5.5);
    p.knockZ += (dz / l) * (p.guarding ? 2 : 5.5);
    this.cameraShake = Math.max(this.cameraShake, p.guarding ? 0.12 : 0.3);
    this.flash = Math.max(this.flash, p.guarding ? 0.25 : 0.6);
    this.sound.tone(p.guarding ? 115 : 70, 0.11, p.guarding ? 'triangle' : 'sawtooth', 0.04, p.guarding ? 1.5 : 0.7);
    this.input.rumble(p.guarding ? 0.25 : 0.55, p.guarding ? 80 : 160);
    if (p.hp <= 0) {
      this.respawn(true);
      return true;
    }
    return false;
  }

  respawn(counted) {
    const p = this.player;
    if (counted) this.deaths += 1;
    p.hp = p.maxHp;
    p.x = this.checkpoint.x;
    p.z = this.checkpoint.z;
    p.knockX = p.knockZ = 0;
    p.invuln = 2;
    p.dashTimer = 0;
    p.attackTimer = 0;
    p.attackBuffer = 0;
    p.dashBuffer = 0;
    this.clearProjectiles();
    if (this.bossActive) this.resetEnemy(this.boss, true);
    if (this.vaultSealed) this.resetVault();
    this.playerVisual.position.set(p.x, this.groundY(p.z) + 0.08, p.z);
    this.snapCamera();
    this.showToast(counted ? 'The shrine pulls you back. No experience lost.' : 'You return to the last shrine stone.', 3.2, true);
    this.sound.chord([220, 277, 330]);
    this.updateUI(true);
    this.save();
  }

  updateProgress() {
    const p = this.player;
    if (this.phase === 'gate' && p.z < -24.3) {
      this.phase = 'chest';
      this.checkpoint = { x: 0, z: -25.5 };
      this.showToast('Below the gate, a forged blade waits in the first chamber.', 3.2);
      this.save();
    }
    if (this.phase === 'bossApproach' && p.z < -46) {
      this.phase = 'boss';
      this.bossActive = true;
      this.boss.cooldown = 1.2;
      this.ui.bossWrap.classList.remove('hidden');
      this.checkpoint = { x: 0, z: -46.8 };
      this.showToast('EMBER WARDEN', 2.0, true);
      this.sound.tone(73, 0.5, 'sawtooth', 0.06, 0.8);
      this.save();
    }
    if (this.side.vaultUnlocked && !this.side.vaultCleared && !this.vaultSealed && p.x < -9.4 && p.z < -27.1 && p.z > -38.9) this.sealVault();
  }

  /* ------------------------------------------------------------ enemies */

  /** Move with wall collision, inside the enemy's zone. Returns true when something stopped it. */
  moveEnemy(e, vx, vz, dt) {
    const Z = e.zone;
    const r = e.radius;
    const stuck = this.blocked(e.x, e.z, r); // never trap an enemy that starts inside a collider
    let hit = false;
    let nx = e.x + vx * dt;
    if (nx < Z.minX) {
      nx = Z.minX;
      hit = true;
    } else if (nx > Z.maxX) {
      nx = Z.maxX;
      hit = true;
    }
    if (stuck || !this.blocked(nx, e.z, r)) e.x = nx;
    else hit = true;
    let nz = e.z + vz * dt;
    if (nz < Z.minZ) {
      nz = Z.minZ;
      hit = true;
    } else if (nz > Z.maxZ) {
      nz = Z.maxZ;
      hit = true;
    }
    if (stuck || !this.blocked(e.x, nz, r)) e.z = nz;
    else hit = true;
    return hit;
  }

  turnToward(e, tx, tz, dt, rate) {
    const cur = Math.atan2(e.fx, e.fz);
    const diff = wrapAngle(Math.atan2(tx, tz) - cur);
    const a = cur + clamp(diff, -rate * dt, rate * dt);
    e.fx = Math.sin(a);
    e.fz = Math.cos(a);
    return Math.abs(diff) < 0.22;
  }

  updateEnemies(dt) {
    const p = this.player;
    const diff = DIFFICULTY[this.difficulty];
    const settle = 1 - Math.exp(-dt * 30);
    for (const e of this.enemies) {
      if (!e.alive || e.dormant) continue;
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.special = Math.max(0, e.special - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e === this.boss) {
        this.updateBoss(e, dt, diff);
      } else {
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        const d = Math.hypot(dx, dz);
        if (e.type === 'thornback') this.updateThornback(e, dt, diff, dx, dz, d);
        else this.updateWalker(e, dt, diff, dx, dz, d);
      }
      if (!e.alive) continue;
      e.visual.scale.setScalar(lerp(e.visual.scale.x, e.hitFlash > 0 ? 1.09 : 1, settle));
    }
  }

  updateWalker(e, dt, diff, dx, dz, d) {
    const l = d || 1;
    const speed = e.speed * diff.speed;
    let vx = 0;
    let vz = 0;
    if (d < e.aggro) {
      if (e.type === 'sentry' && d > 2.4) {
        if (d > 4.6) {
          vx = (dx / l) * speed;
          vz = (dz / l) * speed;
        }
        if (e.cooldown <= 0) {
          this.fireProjectile(e.x, e.z, dx / l, dz / l, (e.tag === 'warden' ? 7.2 : 6.2) * diff.shot, e.damage, 0xff704a);
          e.cooldown = e.tag === 'warden' ? 1.55 : 2.0;
        }
      } else if (d > e.range) {
        vx = (dx / l) * speed;
        vz = (dz / l) * speed;
      } else if (e.cooldown <= 0) {
        e.cooldown = e.type === 'mossling' ? 1.0 : 1.35;
        if (this.damagePlayer(e.damage, e.x, e.z)) return;
      }
    } else {
      const tx = e.homeX + Math.cos(this.elapsed * 0.55 + e.phase) * 1.1;
      const tz = e.homeZ + Math.sin(this.elapsed * 0.5 + e.phase) * 1.1;
      const dd = Math.hypot(tx - e.x, tz - e.z) || 1;
      vx = ((tx - e.x) / dd) * speed * 0.28;
      vz = ((tz - e.z) / dd) * speed * 0.28;
    }
    vx += e.knockX;
    vz += e.knockZ;
    e.knockX *= Math.exp(-dt * 8);
    e.knockZ *= Math.exp(-dt * 8);
    this.moveEnemy(e, vx, vz, dt);
    e.visual.position.set(e.x, this.groundY(e.z) + Math.sin(this.elapsed * 3 + e.phase) * 0.03, e.z);
    if (d < e.aggro) e.visual.rotation.y = Math.atan2(-dx, -dz);
  }

  /**
   * Thornback: an armoured shell turns blades from the front. It lines up, winds up
   * and charges; a charge into a wall, a tree or a raised guard leaves it stunned and open.
   */
  updateThornback(e, dt, diff, dx, dz, d) {
    const p = this.player;
    e.t = Math.max(0, e.t - dt);
    let vx = 0;
    let vz = 0;
    switch (e.state) {
      case 'roam': {
        const tx = e.homeX + Math.cos(this.elapsed * 0.4 + e.phase) * 1.4;
        const tz = e.homeZ + Math.sin(this.elapsed * 0.35 + e.phase) * 1.4;
        const ddx = tx - e.x;
        const ddz = tz - e.z;
        const dd = Math.hypot(ddx, ddz) || 1;
        if (dd > 0.2) {
          this.turnToward(e, ddx / dd, ddz / dd, dt, 2.5);
          vx = e.fx * e.speed * 0.35;
          vz = e.fz * e.speed * 0.35;
        }
        if (d < e.aggro) e.state = 'turn';
        break;
      }
      case 'turn': {
        const aligned = this.turnToward(e, dx / (d || 1), dz / (d || 1), dt, 3.0 * diff.speed);
        if (d > 3.2) {
          vx = e.fx * e.speed * diff.speed * 0.5;
          vz = e.fz * e.speed * diff.speed * 0.5;
        }
        if (d > e.aggro * 1.5) e.state = 'roam';
        else if (aligned && e.cooldown <= 0 && d < e.aggro) {
          e.state = 'windup';
          e.t = 0.6 / diff.speed;
          this.sound.tone(150, 0.5, 'sawtooth', 0.02, 2.2);
        }
        break;
      }
      case 'windup':
        if (e.t <= 0) {
          e.state = 'charge';
          e.t = 1.15;
          e.hitPlayer = false;
          this.sound.tone(90, 0.25, 'square', 0.022, 0.7);
        }
        break;
      case 'charge': {
        const sp = 8.2 * diff.speed;
        vx = e.fx * sp;
        vz = e.fz * sp;
        if (Math.random() < 0.5) this.burst(e.x - e.fx * 0.7, e.z - e.fz * 0.7, 0xc8b98a, 1, 0.4);
        if (!e.hitPlayer && d < e.radius + 0.55) {
          e.hitPlayer = true;
          // Meeting the charge with a raised guard bounces the thornback off the shield.
          const facingIt = p.guarding && (p.facing.x * -dx + p.facing.z * -dz) / (d || 1) > 0.3;
          if (this.damagePlayer(e.damage, e.x, e.z)) return;
          if (facingIt) {
            this.stunThornback(e, 1.4);
            this.sound.clang();
          }
        }
        if (e.state === 'charge' && e.t <= 0) {
          e.state = 'recover';
          e.t = 0.55;
          e.cooldown = 1.4;
        }
        break;
      }
      case 'stun':
        if (e.t <= 0) {
          e.state = 'recover';
          e.t = 0.35;
          e.cooldown = 0.9;
        }
        break;
      default: // recover
        if (e.t <= 0) e.state = d < e.aggro ? 'turn' : 'roam';
        break;
    }
    vx += e.knockX;
    vz += e.knockZ;
    e.knockX *= Math.exp(-dt * 8);
    e.knockZ *= Math.exp(-dt * 8);
    const hit = this.moveEnemy(e, vx, vz, dt);
    if (e.state === 'charge' && hit) this.stunThornback(e, 1.7);

    let ox = 0;
    let oy = 0;
    let tilt = 0;
    if (e.state === 'windup') ox = Math.sin(this.elapsed * 60) * 0.05;
    else if (e.state === 'stun') {
      tilt = Math.sin(this.elapsed * 14) * 0.14;
      oy = 0.05;
    }
    e.visual.position.set(e.x + ox, this.groundY(e.z) + oy, e.z);
    e.visual.rotation.set(0, Math.atan2(-e.fx, -e.fz), tilt);
  }

  stunThornback(e, seconds) {
    e.state = 'stun';
    e.t = seconds;
    this.cameraShake = Math.max(this.cameraShake, 0.14);
    this.sound.tone(70, 0.2, 'square', 0.035, 0.6);
    this.burst(e.x + e.fx * 0.8, e.z + e.fz * 0.8, 0xb8bca8, 8, 0.9);
  }

  updateBoss(e, dt, diff) {
    if (!this.bossActive) {
      e.visual.position.y = this.groundY(e.z) + Math.sin(this.elapsed * 1.4) * 0.04;
      return;
    }
    const p = this.player;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    const l = d || 1;
    let vx = 0;
    let vz = 0;
    if (e.telegraph > 0) {
      e.telegraph -= dt;
      e.visual.rotation.y += dt * 2.4; // the wind-up spin is the tell (it used to be overwritten)
      if (e.telegraph <= 0) {
        e.telegraph = 0;
        e.cooldown = 1.1;
        this.burst(e.x, e.z, 0xff7a45, 18, 1.9);
        this.cameraShake = Math.max(this.cameraShake, 0.45);
        this.sound.tone(60, 0.3, 'sawtooth', 0.05, 0.5);
        this.input.rumble(0.6, 200);
        if (d < 3.0 && this.damagePlayer(16, e.x, e.z)) return;
      }
    } else if (e.special <= 0) {
      const n = e.enraged ? diff.ring : 8;
      const offset = e.enraged && e.volley++ % 2 ? Math.PI / n : 0;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + offset;
        this.fireProjectile(e.x, e.z, Math.cos(a), Math.sin(a), 5.2 * diff.shot, 10, 0xff6e42);
      }
      e.special = diff.bossSpecial;
      this.sound.tone(82, 0.2, 'sawtooth', 0.05, 0.6);
      this.cameraShake = Math.max(this.cameraShake, 0.18);
    } else if (d > 2.15) {
      vx = (dx / l) * e.speed * diff.speed;
      vz = (dz / l) * e.speed * diff.speed;
    } else if (e.cooldown <= 0) {
      e.telegraph = 0.58;
      e.cooldown = 2.1;
      this.sound.tone(92, 0.42, 'triangle', 0.035, 0.55);
    }
    e.knockX = e.knockZ = 0; // the Warden does not stagger
    this.moveEnemy(e, vx, vz, dt);
    e.visual.position.set(e.x, this.groundY(e.z), e.z);
    if (!(e.telegraph > 0)) e.visual.rotation.y = Math.atan2(-dx, -dz);
  }

  spawnRelic(x, z) {
    this.removeRelic();
    const g = new THREE.Group();
    const baseY = this.groundY(z) + 0.45;
    g.position.set(x, baseY, z);
    this.scene.add(g);
    this.mesh(this.geo('relicRing', () => new THREE.TorusGeometry(0.5, 0.14, 6, 12)), this.m.gold, [0, 0.65, 0], g, false, false).rotation.x = Math.PI / 2;
    this.mesh(this.geo('relicCore', () => new THREE.OctahedronGeometry(0.38, 0)), this.m.ember, [0, 0.65, 0], g, false, false);
    const glow = { obj: g, baseY, phase: 0, amp: 0.16, spin: true };
    this.glows.push(glow);
    this.relic = { type: 'relic', x, z, visual: g, glow, used: false, prompt: 'CLAIM' };
    this.interactables.push(this.relic);
  }

  removeRelic() {
    const r = this.relic;
    if (!r) return;
    this.scene.remove(r.visual);
    const gi = this.glows.indexOf(r.glow);
    if (gi >= 0) this.glows.splice(gi, 1);
    const ii = this.interactables.indexOf(r);
    if (ii >= 0) this.interactables.splice(ii, 1);
    this.relic = null;
  }

  /* ------------------------------------------------------------ projectiles and sparks */

  fireProjectile(x, z, dx, dz, speed, damage, color) {
    if (this.projectiles.length >= SHOT_CAP) return;
    const b = this.shotPool.pop() || { color: new THREE.Color() };
    b.x = x;
    b.z = z;
    b.dx = dx;
    b.dz = dz;
    b.speed = speed;
    b.damage = damage;
    b.life = 4;
    b.rx = 0;
    b.rz = 0;
    b.color.setHex(color);
    this.projectiles.push(b);
  }

  removeShot(i) {
    const list = this.projectiles;
    const b = list[i];
    list[i] = list[list.length - 1];
    list.pop();
    this.shotPool.push(b);
  }

  updateProjectiles(dt) {
    const p = this.player;
    const list = this.projectiles;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.life -= dt;
      b.x += b.dx * b.speed * dt;
      b.z += b.dz * b.speed * dt;
      b.rx += dt * 7;
      b.rz += dt * 5;
      if (Math.hypot(b.x - p.x, b.z - p.z) < 0.62) {
        this.removeShot(i);
        if (this.damagePlayer(b.damage, b.x, b.z)) return; // respawn cleared the list
        continue;
      }
      if (b.life <= 0 || Math.abs(b.x) > 30 || b.z > 28 || b.z < -66) {
        this.removeShot(i);
      } else if (this.blocked(b.x, b.z, 0.12)) {
        // Walls, doors and the chest stop shots now, instead of letting them pass through.
        this.burst(b.x, b.z, 0xffa070, 3, 0.4);
        this.removeShot(i);
      }
    }
  }

  clearProjectiles() {
    for (const b of this.projectiles) this.shotPool.push(b);
    this.projectiles.length = 0;
  }

  burst(x, z, color, count = 8, power = 1) {
    const y = this.groundY(z) + 0.7;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= FX_CAP) return;
      const f = this.particlePool.pop() || { rot: new THREE.Quaternion(), color: new THREE.Color() };
      const a = Math.random() * TAU;
      const s = (0.5 + Math.random()) * power;
      f.x = x;
      f.y = y;
      f.z = z;
      f.vx = Math.cos(a) * s;
      f.vz = Math.sin(a) * s;
      f.vy = 1 + Math.random() * 2 * power;
      f.life = 0.45 + Math.random() * 0.45;
      f.size = 0.07 + Math.random() * 0.08;
      f.rot.setFromAxisAngle(UP, Math.random() * TAU);
      f.color.setHex(color);
      this.particles.push(f);
    }
  }

  updateParticles(dt) {
    const list = this.particles;
    const shrink = Math.pow(0.97, dt * 60);
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      f.life -= dt;
      if (f.life <= 0) {
        list[i] = list[list.length - 1];
        list.pop();
        this.particlePool.push(f);
        continue;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      f.vy -= 4 * dt;
      f.size *= shrink;
    }
  }

  clearParticles() {
    for (const f of this.particles) this.particlePool.push(f);
    this.particles.length = 0;
  }

  renderPools() {
    const fx = this.fxMesh;
    let n = 0;
    for (const f of this.particles) {
      this._p.set(f.x, f.y, f.z);
      this._s.setScalar(f.size);
      this._m.compose(this._p, f.rot, this._s);
      fx.setMatrixAt(n, this._m);
      fx.setColorAt(n, f.color);
      n += 1;
    }
    this.finishPool(fx, n);

    const shots = this.shotMesh;
    n = 0;
    const bob = Math.sin(this.elapsed * 10) * 0.05;
    this._s.set(0.19, 0.19, 0.285);
    for (const b of this.projectiles) {
      this._p.set(b.x, this.groundY(b.z) + 0.72 + bob, b.z);
      this._e.set(b.rx, 0, b.rz);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p, this._q, this._s);
      shots.setMatrixAt(n, this._m);
      shots.setColorAt(n, b.color);
      n += 1;
    }
    this.finishPool(shots, n);
  }

  finishPool(mesh, n) {
    if (n === 0 && this.warmFrames > 0) {
      mesh.setMatrixAt(0, ZERO_MATRIX);
      n = 1;
    }
    mesh.count = n;
    if (n > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /* ------------------------------------------------------------ world animation, camera, sun */

  animateWorld(dt, t) {
    this.water.position.y = -0.02 + Math.sin(t * 1.2) * 0.025;
    this.water.rotation.y += dt * 0.035;
    for (const g of this.glows) {
      g.obj.position.y = g.baseY + Math.sin(t * 2 + g.phase) * g.amp;
      if (g.spin) g.obj.rotation.y += dt * 0.9;
      else g.obj.rotation.z += dt * 0.12;
    }
    const ff = this.fireflies.positions;
    const arr = ff.array;
    for (let i = 0; i < this.fireflyBase.length; i++) {
      const b = this.fireflyBase[i];
      arr[i * 3] = b.x + Math.sin(t * 0.55 + b.p) * 0.25;
      arr[i * 3 + 1] = b.y + Math.sin(t * 1.4 + b.p) * 0.18;
      arr[i * 3 + 2] = b.z + Math.cos(t * 0.5 + b.p) * 0.25;
    }
    ff.needsUpdate = true;

    this.gateDoor.position.y = lerp(this.gateDoor.position.y, this.gateOpen ? 6.4 : this.gateDoor.userData.closedY, 1 - Math.exp(-dt * 2.8));
    this.innerDoor.position.y = lerp(this.innerDoor.position.y, this.innerOpen ? 5.7 : this.innerDoor.userData.closedY, 1 - Math.exp(-dt * 3.2));
    const vaultOpen = this.side.vaultUnlocked && !this.vaultSealed;
    this.vaultDoor.position.y = lerp(this.vaultDoor.position.y, vaultOpen ? -2.9 : this.vaultDoor.userData.closedY, 1 - Math.exp(-dt * (vaultOpen ? 2.6 : 9)));
    if (this.gladeRoots.visible && this.gladeOpen) {
      this.gladeRoots.position.y = lerp(this.gladeRoots.position.y, -2.3, 1 - Math.exp(-dt * 2.2));
      if (this.gladeRoots.position.y < -2.1) this.gladeRoots.visible = false;
    }
    const lidK = 1 - Math.exp(-dt * 9);
    for (const c of this.chests) c.lid.rotation.x = lerp(c.lid.rotation.x, c.used ? -1.05 : 0, lidK);
    const vc = this.vaultChest;
    if (this.side.bellsSolved && vc.rise < 1) {
      vc.rise = Math.min(1, vc.rise + dt * 0.7);
      vc.visual.visible = true;
      vc.visual.position.y = vc.baseY - (1 - vc.rise) * 1.4;
    }
    for (const c of this.chimes) {
      if (c.swing <= 0) continue;
      c.swing = Math.max(0, c.swing - dt);
      c.bell.rotation.z = Math.PI + Math.sin((0.6 - c.swing) * 16) * 0.45 * (c.swing / 0.6);
    }
    for (const b of this.echoBells) {
      if (b.cooldown > 0) b.cooldown -= dt;
      if (b.swing <= 0) continue;
      b.swing = Math.max(0, b.swing - dt);
      b.bell.rotation.z = Math.PI + Math.sin((0.5 - b.swing) * 20) * 0.3 * (b.swing / 0.5);
    }
    const boss = this.boss;
    const warn = boss.alive && boss.telegraph > 0 ? 0.25 + 0.55 * (1 - boss.telegraph / 0.58) : 0;
    this.m.warn.opacity = warn;
    this.warnRing.visible = warn > 0 || this.warmFrames > 0;
    if (warn > 0) this.warnRing.position.set(boss.x, this.groundY(boss.z) + 0.07, boss.z);
  }

  updateLift() {
    const a = this.camera.aspect;
    if (a < 1) {
      // Portrait screens see little sideways: pull the camera back so the fight stays readable.
      this.liftY = this.liftZ = clamp(1.12 + (1 - a) * 0.7, 1.12, 1.5);
    } else {
      this.liftY = this.coarse ? 1.12 : 1;
      this.liftZ = 1;
    }
  }

  computeCameraGoal() {
    const p = this.player;
    const zoom = this.cameraZoom;
    const gy = this.groundY(p.z);
    this._v.set(p.x, 12.2 * zoom * this.liftY + gy, p.z + 11.6 * zoom * this.liftZ);
    this._v2.set(p.x, gy + 0.65, p.z - 1.35);
  }

  snapCamera() {
    this.computeCameraGoal();
    this.camera.position.copy(this._v);
    this.cameraTarget.copy(this._v2);
    this.camera.lookAt(this.cameraTarget);
  }

  updateCamera(dt) {
    this.computeCameraGoal();
    this.camera.position.lerp(this._v, 1 - Math.exp(-dt * 6.5));
    this.cameraTarget.lerp(this._v2, 1 - Math.exp(-dt * 8));
    if (this.cameraShake > 0 && this.mode !== 'pause') {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
    }
    this.camera.lookAt(this.cameraTarget);
  }

  updateSun() {
    const sc = this.sun.shadow.camera;
    const half = clamp(19 * this.cameraZoom * this.liftY, 19, 36);
    if (Math.abs(half - this.sunHalf) > 0.5) {
      this.sunHalf = half;
      sc.left = -half;
      sc.right = half;
      sc.top = half;
      sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
    const p = this.player;
    const fx = p.x;
    const fy = this.groundY(p.z);
    const fz = p.z - 4 * this.cameraZoom * this.liftZ;
    const texel = (2 * this.sunHalf) / Math.max(1, this.sun.shadow.mapSize.x);
    const U = this.sunU;
    const V = this.sunV;
    const D = this.sunDir;
    const a = Math.round((fx * U.x + fy * U.y + fz * U.z) / texel) * texel;
    const b = Math.round((fx * V.x + fy * V.y + fz * V.z) / texel) * texel;
    const c = fx * D.x + fy * D.y + fz * D.z;
    const t = this.sun.target.position;
    t.set(U.x * a + V.x * b + D.x * c, U.y * a + V.y * b + D.y * c, U.z * a + V.z * b + D.z * c);
    this.sun.position.copy(t).addScaledVector(D, 34);
  }

  complete() {
    if (this.finished) return;
    const p = this.player;
    const u = this.ui;
    this.finished = true;
    this.phase = 'done';
    this.mode = 'done';
    this.playerVisual.visible = true;
    this.sound.chord([330, 392, 494, 659, 784]);
    this.sound.setTrack(null);
    this.input.rumble(0.4, 300);
    u.bossWrap.classList.add('hidden');
    u.prompt.classList.add('hidden');
    u.hud.classList.add('hidden');
    this.clearToasts();
    const label = DIFFICULTY[this.difficulty].label;
    const best = store.get(BEST_KEY, {}) || {};
    const prev = best[this.difficulty];
    const record = !(prev > 0) || this.elapsed < prev;
    if (record) {
      best[this.difficulty] = Math.round(this.elapsed * 10) / 10;
      store.set(BEST_KEY, best);
    }
    store.del(SAVE_KEY);
    u.completeStats.textContent = `Time ${fmtTime(this.elapsed)} · ${label} · Level ${p.level} · ${this.kills} enemies broken · ${this.deaths} shrine return${this.deaths === 1 ? '' : 's'}. The Ember Bell is awake.`;
    u.completeSide.textContent = this.side.vaultChest
      ? 'Rootkey Vault cleared: Heart Container and Ember Charm found.'
      : 'The Rootkey Vault still sleeps somewhere off the path.';
    u.completeBest.textContent = record ? `New best on ${label}: ${fmtTime(this.elapsed)}` : `Best on ${label}: ${fmtTime(prev)}`;
    u.complete.classList.remove('hidden');
    this.kit.touch?.suspend(true, 'game');
    this.focusDefault(u.complete);
  }
}

/** Older builds registered a cache-first service worker here; retire it so updates always arrive. */
function retireServiceWorker() {
  try {
    if ('serviceWorker' in navigator) {
      const scope = new URL('./', location.href).href;
      navigator.serviceWorker
        .getRegistrations?.()
        .then((regs) => {
          for (const r of regs) if (r.scope === scope) r.unregister();
        })
        .catch(() => {});
    }
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => keys.filter((k) => k.startsWith('mossbell-shell')).forEach((k) => caches.delete(k)))
        .catch(() => {});
    }
  } catch {
    /* not available here */
  }
}

/* ------------------------------------------------------------ boot */

const kit = await boot({
  title: 'Mossbell: Shrine of the Ember Warden',
  mount: document.getElementById('stage'),
  accent: '#f3c969',
  background: '#10201c',
  touch: { top: 'right', topOffset: 58 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    attack: { keys: ['Space', 'KeyJ'], mouse: [0], gamepad: ['A', 'X', 'RT'], touch: 'Blade' },
    guard: { keys: ['ShiftLeft', 'ShiftRight', 'KeyK'], mouse: [2], gamepad: ['LT', 'LB'], touch: 'Guard' },
    dash: { keys: ['KeyQ'], gamepad: ['B', 'RB'], touch: 'Dash' },
    use: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Use' },
    zoom: { type: 'axis', keys: { pos: ['Equal', 'NumpadAdd'], neg: ['Minus', 'NumpadSubtract'] }, gamepad: 'rightStickY' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    confirm: { keys: ['Enter', 'NumpadEnter'] },
    mute: { keys: ['KeyM'] },
  },
});

const game = new Mossbell(kit);
game.build();
game.bindUi();
game.applyState(null);
game.showTitle();
window.__mossbell = game;

kit.onPause((paused) => game.onKitPause(paused));
addEventListener('blur', () => game.autoPause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.autoPause();
});
addEventListener('pagehide', () => game.save());
kit.start((dt) => game.frame(dt));
retireServiceWorker();
