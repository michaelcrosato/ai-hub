// game.js — Rift Rangers: the world, the ranger, the enemies and the mission rules.
//
// Everything a mission contains is built from src/missions.js into one `level`
// group, so a restart or a new operation throws the group away and builds it
// again. Static scenery is merged per material (a handful of draw calls), and
// bullets, grenades, shells and explosions are instanced pools that allocate
// nothing while playing.

import * as THREE from 'three/webgpu';
import { color, mix, smoothstep, saturate, time, positionWorld, uv, vec3, instancedBufferAttribute, mx_noise_float } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';
import { BALANCE, DIFFICULTY, levelForXp } from './balance.js';
import { MISSIONS } from './missions.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
const distSq = (ax, ay, az, bx, by, bz) => {
  const x = ax - bx, y = ay - by, z = az - bz;
  return x * x + y * y + z * z;
};
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function formatTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STEP = 0.55; // the highest ledge the ranger walks up without jumping
const BODY_R = 0.38; // ranger and grunt collision radius
const LANE_Z = 3.15;
const BULLET_CAP = 96;
const FX_CAP = 48;
const SHELL_CAP = 12;
const GRENADE_CAP = 6;
// Body centre above the feet (where shots hit and aim), hit radius, gun height and firing range.
const HIT_Y = { grunt: 0.85, turret: 0.85, drone: 0, boss: 0, mortar: 0.55, sniper: 0.85, walker: 2.9 };
const RADIUS = { grunt: 0.65, turret: 0.82, drone: 0.7, boss: 1.45, mortar: 0.75, sniper: 0.6, walker: 1.75 };
const FIRE_Y = { grunt: 0.95, turret: 0.86, drone: 0, boss: 0.15, sniper: 1.28 };
const RANGE = { grunt: 14, turret: 14, drone: 14, boss: 20, mortar: 16, sniper: 18, walker: 22 };
const BULLET_TYPES = new Set(['grunt', 'turret', 'drone', 'boss']);
const BOSSES = new Set(['boss', 'walker']);
const SPREAD3 = [-0.13, 0, 0.13];
const OBJECTIVE_DONE = 'Mission complete';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export function createGame({ kit, audio, events = {} }) {
  const renderer = kit.renderer;
  const input = kit.input;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  kit.canvas.setAttribute('aria-label', '3D game view');

  const ui = {
    hud: $('hud'),
    toast: $('toast'),
    damageFlash: $('damageFlash'),
    healthText: $('healthText'),
    healthBar: $('healthBar'),
    armorText: $('armorText'),
    intelText: $('intelText'),
    xpBar: $('xpBar'),
    levelText: $('levelText'),
    powerTag: $('powerTag'),
    scoreText: $('scoreText'),
    grenadeText: $('grenadeText'),
    objective: $('objective'),
    backendBadge: $('backendBadge'),
    bossRow: $('bossRow'),
    bossName: $('bossName'),
    bossBar: $('bossBar'),
    letterboxTop: $('letterboxTop'),
    letterboxBottom: $('letterboxBottom'),
  };
  ui.backendBadge.textContent = kit.backend === 'webgpu' ? 'WEBGPU' : 'WEBGL2';

  // ---------------------------------------------------------------- scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07150f);
  scene.fog = new THREE.FogExp2(0x07150f, 0.027);
  const camera = kit.fitCamera(new THREE.PerspectiveCamera(48, 1, 0.1, 220));
  camera.position.set(8, 6.2, 12);

  const hemi = new THREE.HemisphereLight(0x8bd6a1, 0x142213, 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0c2, 3.4);
  sun.position.set(18, 28, 14);
  sun.castShadow = true;
  kit.shadow(sun, 2048);
  sun.shadow.radius = 3; // PCF with a radius stands in for the old PCFSoftShadowMap
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 16, bottom: -8, near: 1, far: 70 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x4d8d72, 0.65);
  fill.position.set(-12, 9, -10);
  scene.add(fill);

  const post = createPost(kit, scene, camera, { bloom: { strength: 0.55, radius: 0.16, threshold: 0.72 } });

  // ---------------------------------------------------------------- materials
  const mat = (c, roughness = 0.9, metalness = 0) => new THREE.MeshStandardMaterial({ color: c, roughness, metalness, flatShading: true });
  const emissiveMat = (c, emissive, intensity = 1) =>
    new THREE.MeshStandardMaterial({ color: c, emissive, emissiveIntensity: intensity, roughness: 0.45, metalness: 0.08, flatShading: true });
  const transparentMat = (c, opacity, roughness = 0.7) =>
    new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity, roughness, metalness: 0.05, depthWrite: false, flatShading: true });

  const materials = {
    ground: mat(0x2e6a32, 0.98),
    ground2: mat(0x3e7b38, 1),
    mud: mat(0x4c5330, 1),
    stone: mat(0x647061, 1),
    darkStone: mat(0x394039, 1),
    wood: mat(0x6f4d2c, 1),
    metal: mat(0x4f6258, 0.62, 0.35),
    darkMetal: mat(0x202d27, 0.55, 0.48),
    leaf: mat(0x3d8f39, 1),
    leaf2: mat(0x72aa36, 1),
    bark: mat(0x664124, 1),
    player: mat(0xb7e63f, 0.78),
    playerDark: mat(0x253b20, 0.9),
    skin: mat(0xe5ac73, 0.9),
    enemy: mat(0xd9573d, 0.8),
    enemyDark: mat(0x42251f, 0.85),
    sniper: mat(0x5b6d3b, 0.85),
    turret: mat(0x7b8a71, 0.7, 0.22),
    warning: emissiveMat(0xff4e2c, 0x7a1000, 2.0),
    bullet: emissiveMat(0xffe66d, 0xd87a00, 3.2),
    enemyBullet: emissiveMat(0xff553f, 0x7f0800, 3.2),
    xp: emissiveMat(0xbaff38, 0x316800, 1.5),
    spread: emissiveMat(0xff9a2e, 0x8a3000, 2.2),
    intel: emissiveMat(0x7ad8ff, 0x0b4a7a, 1.6),
    shell: emissiveMat(0x2a2420, 0xff5a1f, 1.4),
    water: transparentMat(0x246c66, 0.54, 0.35),
    glass: transparentMat(0x7ae6b4, 0.36, 0.2),
    white: mat(0xdde6d5, 0.85),
    black: mat(0x101612, 0.9),
    laser: new THREE.MeshBasicMaterial({ color: 0xff3b2a, transparent: true, opacity: 0.8, depthWrite: false }),
    marker: new THREE.MeshBasicMaterial({ color: 0xff553f, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    shock: new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  };

  // Rift Falls water: the river drifts toward the camera and the falls pour down (TSL, both backends).
  materials.river = new THREE.MeshStandardNodeMaterial({ transparent: true, opacity: 0.62, roughness: 0.3, metalness: 0.05, depthWrite: false });
  {
    const p = positionWorld;
    const n = mx_noise_float(vec3(p.x.mul(0.7), p.z.mul(1.3).sub(time.mul(1.5)), time.mul(0.15)));
    materials.river.colorNode = mix(color(0x1d5d5f), color(0x8fe3d2), smoothstep(0.2, 0.75, n.mul(0.5).add(0.5)));
  }
  materials.fall = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.9, depthWrite: false });
  {
    const v = uv();
    const streak = mx_noise_float(vec3(v.x.mul(22), v.y.mul(2.5).add(time.mul(2.4)), 0.5)).mul(0.5).add(0.5);
    const foam = smoothstep(0.55, 0.95, streak).add(v.y.oneMinus().pow(6).mul(0.6));
    materials.fall.colorNode = mix(color(0x2f8f86), color(0xe6fff7), saturate(foam));
  }

  // ---------------------------------------------------------------- shared geometry
  const shared = (g) => {
    g.userData.shared = true;
    return g;
  };
  const G = {
    bullet: shared(new THREE.BoxGeometry(0.26, 0.1, 0.1)),
    enemyBullet: shared(new THREE.BoxGeometry(0.22, 0.1, 0.1)),
    grenade: shared(new THREE.IcosahedronGeometry(0.23, 0)),
    flash: shared(new THREE.IcosahedronGeometry(0.45, 1)),
    ring: shared(new THREE.TorusGeometry(0.5, 0.08, 5, 12)),
    shell: shared(new THREE.IcosahedronGeometry(0.26, 0)),
    marker: shared(new THREE.RingGeometry(0.72, 1, 28).rotateX(-Math.PI / 2)),
    shock: shared(new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2)),
    laser: shared(new THREE.BoxGeometry(1, 0.035, 0.035).translate(0.5, 0, 0)),
    muzzle: shared(new THREE.OctahedronGeometry(0.2, 0)),
    gruntBody: shared(new THREE.BoxGeometry(0.7, 0.82, 0.56)),
    head: shared(new THREE.SphereGeometry(0.27, 7, 5)),
    gruntLegs: shared(new THREE.BoxGeometry(0.52, 0.68, 0.42)),
    gun: shared(new THREE.BoxGeometry(0.78, 0.15, 0.16)),
    hood: shared(new THREE.BoxGeometry(0.62, 0.18, 0.6)),
    visor: shared(new THREE.BoxGeometry(0.1, 0.1, 0.42)),
    rifle: shared(new THREE.BoxGeometry(1.3, 0.1, 0.12)),
    turretBase: shared(new THREE.CylinderGeometry(0.62, 0.78, 0.55, 8)),
    turretTop: shared(new THREE.BoxGeometry(0.82, 0.58, 0.8)),
    barrel: shared(new THREE.BoxGeometry(1.1, 0.16, 0.16)),
    droneCore: shared(new THREE.OctahedronGeometry(0.55, 0)),
    droneWing: shared(new THREE.BoxGeometry(1.9, 0.12, 0.42)),
    eye: shared(new THREE.SphereGeometry(0.16, 6, 4)),
    bossShell: shared(new THREE.DodecahedronGeometry(1.18, 0)),
    bossCore: shared(new THREE.IcosahedronGeometry(0.63, 1)),
    bossRing: shared(new THREE.TorusGeometry(1.35, 0.12, 6, 18)),
    mortarBase: shared(new THREE.BoxGeometry(1.0, 0.36, 1.0)),
    sandbag: shared(new THREE.BoxGeometry(0.5, 0.3, 0.36)),
    mortarTube: shared(new THREE.CylinderGeometry(0.15, 0.2, 1.0, 8)),
    walkerHull: shared(new THREE.BoxGeometry(2.4, 1.3, 1.9)),
    walkerPlate: shared(new THREE.BoxGeometry(1.6, 0.25, 2.1)),
    walkerCore: shared(new THREE.IcosahedronGeometry(0.5, 1)),
    walkerGun: shared(new THREE.BoxGeometry(1.5, 0.26, 0.26)),
    walkerThigh: shared(new THREE.BoxGeometry(0.42, 1.4, 0.42)),
    walkerShin: shared(new THREE.BoxGeometry(0.34, 1.2, 0.34)),
    walkerFoot: shared(new THREE.BoxGeometry(1.0, 0.25, 0.8)),
    crate: shared(new THREE.BoxGeometry(0.85, 0.7, 0.85)),
    mark: shared(new THREE.OctahedronGeometry(0.28, 0)),
    spreadMark: shared(new THREE.TorusGeometry(0.22, 0.07, 6, 12)),
    intel: shared(new THREE.BoxGeometry(0.5, 0.12, 0.34)),
    intelRing: shared(new THREE.TorusGeometry(0.36, 0.035, 4, 20)),
    orb: shared(new THREE.OctahedronGeometry(0.25, 0)),
    trunk: shared(new THREE.CylinderGeometry(0.13, 0.2, 1.8, 6)),
    crown: shared(new THREE.ConeGeometry(0.85, 2.4, 6)),
  };

  // ---------------------------------------------------------------- pools
  function instPool(geometry, material, capacity, cast = false) {
    const m = new THREE.InstancedMesh(geometry, material, capacity);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = cast;
    m.receiveShadow = false;
    scene.add(m);
    return m;
  }
  // Explosions fade per instance: the opacity comes from an instanced attribute.
  function fadePool(geometry, params, capacity) {
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    fade.setUsage(THREE.DynamicDrawUsage);
    const material = new THREE.MeshStandardNodeMaterial({ ...params, transparent: true, depthWrite: false, flatShading: true });
    material.opacityNode = instancedBufferAttribute(fade);
    const m = instPool(geometry, material, capacity);
    m.userData.fade = fade;
    return m;
  }
  const pBulletMesh = instPool(G.bullet, materials.bullet, BULLET_CAP);
  const eBulletMesh = instPool(G.enemyBullet, materials.enemyBullet, BULLET_CAP);
  const grenadeMesh = instPool(G.grenade, materials.xp, GRENADE_CAP, true);
  const shellMesh = instPool(G.shell, materials.shell, SHELL_CAP);
  const markerMesh = instPool(G.marker, materials.marker, SHELL_CAP);
  const fxFlash = fadePool(G.flash, { color: 0xff4e2c, emissive: 0x7a1000, emissiveIntensity: 2.0, roughness: 0.45, metalness: 0.08 }, FX_CAP);
  const fxRing = fadePool(G.ring, { color: 0xffe66d, emissive: 0xd87a00, emissiveIntensity: 3.2, roughness: 0.45, metalness: 0.08 }, FX_CAP);
  const pools = [pBulletMesh, eBulletMesh, grenadeMesh, shellMesh, markerMesh, fxFlash, fxRing];
  const shock = new THREE.Mesh(G.shock, materials.shock);
  shock.visible = false;
  scene.add(shock);

  // Scratch objects: nothing below allocates per frame.
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _m = new THREE.Matrix4();
  const _obj = new THREE.Object3D();
  const camGoal = new THREE.Vector3();

  // ---------------------------------------------------------------- state
  let M = MISSIONS[0];
  let D = DIFFICULTY.ranger;
  let missionIndex = 0;
  let level = new THREE.Group();
  scene.add(level);

  const state = {
    complete: false,
    completeTimer: 0,
    elapsed: 0,
    kills: 0,
    shots: 0,
    hits: 0,
    score: 0,
    xp: 0,
    level: 1,
    maxHealth: BALANCE.player.maxHealth,
    health: BALANCE.player.maxHealth,
    armor: 0,
    grenades: BALANCE.player.grenades,
    objectiveStage: 0,
    checkpointX: 2,
    checkpointIndex: -1,
    bossTriggered: false,
    bossDead: false,
    zoom: 1,
    cameraShake: 0,
    toastTimer: 0,
    letterbox: 0,
    flash: 0,
    deaths: 0,
    intel: 0,
    intelTotal: 0,
    spreadTime: 0,
    timeBonus: 0,
  };

  const enemies = [];
  const pickups = [];
  const obstacles = [];
  const beacons = [];
  const playerBullets = [];
  const enemyBullets = [];
  const grenades = [];
  const effects = [];
  const shells = [];
  const blasts = [];
  const bulletFree = [];
  const grenadeFree = [];
  const fxFree = [];
  const shellFree = [];
  const gate = { door: null, barrier: null, openY: 6.2 };
  const shockWave = { active: false, x: 0, z: 0, t: 0, hit: false };
  let bossEnemy = null;
  let mist = null;
  let titleT = 0;
  let chirpT = 3;
  let lastHitSound = 0;

  const player = buildPlayer();

  // ---------------------------------------------------------------- static batching
  // Scenery is collected per material (and per 32 m slice, so culling still helps)
  // and merged into one mesh each when the level is finished.
  const buckets = new Map();
  function solid(geometry, material, x, y, z, { rx = 0, ry = 0, rz = 0, cast = true, receive = true } = {}) {
    _obj.position.set(x, y, z);
    _obj.rotation.set(rx, ry, rz);
    _obj.scale.set(1, 1, 1);
    _obj.updateMatrix();
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    g.clearGroups();
    g.applyMatrix4(_obj.matrix);
    const key = `${material.id}|${cast ? 1 : 0}${receive ? 1 : 0}|${Math.floor(x / 32)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material, cast, receive, geos: [] }));
    b.geos.push(g);
  }
  function box(x, y, z, w, h, d, material, cast = true, receive = true, rot = null) {
    solid(new THREE.BoxGeometry(w, h, d), material, x, y, z, { ...(rot || {}), cast, receive });
  }
  function flushStatic() {
    for (const b of buckets.values()) {
      const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
      if (b.geos.length > 1) for (const g of b.geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, b.material);
      m.castShadow = b.cast;
      m.receiveShadow = b.receive;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      level.add(m);
    }
    buckets.clear();
  }
  function part(geometry, material, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function addObstacle(x1, x2, z1, z2) {
    const o = { x1, x2, z1, z2, active: true };
    obstacles.push(o);
    return o;
  }

  // ---------------------------------------------------------------- world
  function applyEnv() {
    const env = M.env;
    scene.background.setHex(env.sky);
    scene.fog.color.setHex(env.sky);
    scene.fog.density = env.fog;
    hemi.color.setHex(env.hemiSky);
    hemi.groundColor.setHex(env.hemiGround);
    hemi.intensity = env.hemi;
    sun.color.setHex(env.sun);
    sun.intensity = env.sunI;
    fill.color.setHex(env.fill);
    fill.intensity = env.fillI;
  }

  function buildWorld() {
    const m = M;
    // Layered jungle floor.
    for (let x = m.groundFrom; x <= m.groundTo; x += 8) {
      const odd = (x / 8) & 1;
      box(x, -0.45, 0, 8.2, 0.9, 7.7, odd ? materials.ground : materials.ground2, false, true, { ry: odd ? 0.015 : -0.015 });
    }

    // Creeks break up the level without forcing precision jumps.
    for (const c of m.creeks) {
      const water = new THREE.Mesh(new THREE.BoxGeometry(c.x2 - c.x1, 0.09, 7.2), c.flow ? materials.river : materials.water);
      water.position.set((c.x1 + c.x2) / 2, 0.035, 0);
      water.receiveShadow = true;
      level.add(water);
      for (let i = 0; i < c.stones; i++) {
        box(c.stoneX + i * 2.1, 0.16 + (i % 2) * 0.05, ((i % 3) - 1) * 1.35, 1.1, 0.32, 0.9, materials.stone, false, true, { ry: i * 0.63 });
      }
    }

    for (const b of m.bridges) buildBridge(b);
    for (const [x, z] of m.outposts) buildOutpost(x, z);
    for (const p of m.perches) buildPerch(p);
    for (const t of m.towers) buildTower(t);
    if (m.waterfall) buildWaterfall(m.waterfall);
    buildGate(m.gate);
    buildSigns(m.signs);

    // Checkpoint beacons and the extraction pad.
    for (const cp of m.checkpoints) {
      box(cp.x, 1.125, 2.25, 0.12, 2.25, 0.12, materials.metal);
      const orb = new THREE.Mesh(G.orb, materials.xp);
      orb.position.set(cp.x, 2.37, 2.25);
      level.add(orb);
      beacons.push({ x: cp.x, orb, activated: false });
    }
    solid(new THREE.CylinderGeometry(3, 3.2, 0.16, 12), materials.metal, m.pad, 0.05, 0, { cast: false, receive: true });
    for (let a = 0; a < Math.PI * 2 - 0.01; a += Math.PI / 4) {
      solid(new THREE.SphereGeometry(0.12, 6, 4), materials.xp, m.pad + Math.cos(a) * 2.45, 0.22, Math.sin(a) * 2.45, { cast: false, receive: false });
    }

    // Dense, low-poly vegetation through instancing.
    const rand = mulberry32(m.trees.seed);
    const count = m.trees.count;
    const trunks = new THREE.InstancedMesh(G.trunk, materials.bark, count);
    const crowns = new THREE.InstancedMesh(G.crown, materials.leaf, count);
    let placed = 0;
    for (let guard = 0; placed < count && guard < count * 6; guard++) {
      const x = -2 + rand() * (m.groundTo + 2);
      const side = rand() > 0.5 ? 1 : -1;
      const z = side * (4.2 + rand() * 7.5);
      const s = 0.75 + rand() * 1.35;
      const r1 = rand() * Math.PI;
      const r2 = rand();
      // Keep the view onto the falls clear.
      if (m.trees.gap && side < 0 && x > m.trees.gap[0] && x < m.trees.gap[1]) continue;
      _obj.position.set(x, 0.9 * s, z);
      _obj.scale.set(s, s, s);
      _obj.rotation.set(0, r1, 0);
      _obj.updateMatrix();
      trunks.setMatrixAt(placed, _obj.matrix);
      _obj.position.y = 2.55 * s;
      _obj.rotation.y = r1 + r2;
      _obj.updateMatrix();
      crowns.setMatrixAt(placed, _obj.matrix);
      placed++;
    }
    trunks.count = crowns.count = placed;
    trunks.castShadow = crowns.castShadow = false;
    trunks.receiveShadow = crowns.receiveShadow = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    level.add(trunks, crowns);

    // Background polygon hills.
    const hills = Math.ceil((m.groundTo + 12) / 6);
    for (let i = 0; i < hills; i++) {
      solid(new THREE.ConeGeometry(4 + (i % 4), 10 + (i % 3) * 2, 5), i % 2 ? materials.darkStone : materials.leaf, i * 6 - 6, 4.2, -12 - (i % 3) * 2.4, {
        ry: i * 0.31,
        cast: false,
        receive: false,
      });
    }
    flushStatic();
  }

  function buildBridge(b) {
    const material = materials[b.mat] || materials.wood;
    const depth = b.w - 0.1;
    const upN = Math.max(3, Math.round((b.x1 - b.x0) / 0.45));
    const upW = (b.x1 - b.x0) / upN;
    for (let i = 0; i < upN; i++) {
      const h = ((i + 1) * b.top) / upN;
      box(b.x0 + upW * (i + 0.5), h / 2, b.z, upW + 0.04, h, depth, material);
    }
    const deckLen = b.x2 - b.x1;
    const cx = (b.x1 + b.x2) / 2;
    if (b.solid) {
      // A cliff shelf: solid to the ground, with a grassy cap.
      box(cx, b.top / 2, b.z, deckLen + 0.04, b.top, b.w, material);
      box(cx, b.top + 0.06, b.z, deckLen + 0.1, 0.12, b.w + 0.06, materials.ground2, false, true);
    } else {
      box(cx, b.top - 0.22, b.z, deckLen + 0.1, 0.45, b.w, material);
    }
    if (b.rails) {
      for (let x = b.x1 + 0.4; x <= b.x2 - 0.2; x += 2.3) {
        for (const s of [-1, 1]) {
          box(x, b.top + 0.72, b.z + s * 0.9, 0.18, 1.45, 0.18, materials.metal);
          box(x, b.top + 1.34, b.z + s * 0.95, 2.2, 0.16, 0.16, materials.metal, false, true);
          box(x, b.top + 0.72, b.z + s * 0.95, 2.2, 0.12, 0.12, materials.metal, false, true);
        }
      }
    }
    const dnN = Math.max(3, Math.round((b.x3 - b.x2) / 0.45));
    const dnW = (b.x3 - b.x2) / dnN;
    for (let i = 0; i < dnN; i++) {
      const h = (b.top * (dnN - i)) / dnN;
      box(b.x2 + dnW * (i + 0.5), h / 2, b.z, dnW + 0.04, h, depth, material);
    }
  }

  function buildOutpost(x, z) {
    const y = 0.15;
    for (const side of [-1, 1]) {
      box(x, y + 0.55, z + side * 1.28, 4.2, 1.1, 0.92, materials.darkStone);
      box(x, y + 1.35, z + side * 1.28, 3.0, 0.5, 0.78, materials.metal);
    }
    box(x, y + 1.72, z, 4.2, 0.26, 0.36, materials.metal);
    box(x - 1.35, y + 2.0, z - 1.05, 0.18, 1.6, 0.18, materials.warning, false, false);
    box(x + 1.35, y + 2.0, z + 1.05, 0.18, 1.6, 0.18, materials.warning, false, false);
    addObstacle(x - 2.1, x + 2.1, z - 1.78, z - 0.83);
    addObstacle(x - 2.1, x + 2.1, z + 0.83, z + 1.78);
  }

  function buildPerch([x, z, top]) {
    box(x, top / 2, z, 1.8, top, 1.8, materials.stone);
    box(x, top + 0.08, z, 2.0, 0.16, 2.0, materials.metal);
    box(x + 0.85, top + 0.45, z + 0.85, 0.12, 0.6, 0.12, materials.warning, false, false);
    addObstacle(x - 0.9, x + 0.9, z - 0.9, z + 0.9);
  }

  function buildTower([x, z, h]) {
    for (const sx of [-0.7, 0.7]) for (const sz of [-0.7, 0.7]) box(x + sx, h / 2, z + sz, 0.18, h, 0.18, materials.wood, false, false);
    box(x, h * 0.45, z + 0.7, 1.5, 0.1, 0.1, materials.wood, false, false, { rz: 0.75 });
    box(x, h * 0.45, z - 0.7, 1.5, 0.1, 0.1, materials.wood, false, false, { rz: -0.75 });
    box(x, h, z, 2.0, 0.22, 2.0, materials.wood, false, false);
    box(x, h + 0.45, z - 0.95, 2.0, 0.7, 0.1, materials.wood, false, false);
    solid(new THREE.ConeGeometry(1.6, 1.1, 4), materials.darkMetal, x, h + 1.6, z, { ry: Math.PI / 4, cast: false, receive: false });
    box(x + 0.9, h + 0.95, z + 0.9, 0.16, 0.16, 0.16, materials.warning, false, false);
  }

  function buildWaterfall(f) {
    const { x, w, h, z } = f;
    // Cliff face, flanks and lip.
    box(x, h / 2, z - 1.1, w + 2, h, 1.2, materials.darkStone, false, false);
    for (const s of [-1, 1]) {
      box(x + s * (w / 2 + 3.2), (h + 2.5) / 2, z + 0.4, 6.4, h + 2.5, 4.4, materials.darkStone, false, false, { ry: s * 0.06 });
      box(x + s * (w / 2 + 3.2), h + 2.7, z + 0.4, 6.6, 0.4, 4.6, materials.leaf, false, false);
    }
    box(x, h + 0.5, z - 0.2, w + 2, 1.0, 2.6, materials.stone, false, false);
    box(x, h + 1.1, z - 0.2, w + 1.6, 0.3, 2.2, materials.leaf, false, false);
    for (let i = 0; i < 6; i++) box(x - w / 2 + i * (w / 5), 0.25, z + 0.9 + (i % 2) * 0.8, 1.2, 0.5, 0.9, materials.stone, false, true, { ry: i * 0.7 });
    // The fall itself and the plunge pool that feeds the river.
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), materials.fall);
    sheet.position.set(x, h / 2, z - 0.45);
    level.add(sheet);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.08, -3 - z), materials.river);
    pool.position.set(x, 0.02, (z - 4) / 2);
    level.add(pool);
    // Spray drifting up from the plunge pool.
    const n = kit.detail(160, 40);
    const rand = mulberry32(4411);
    const positions = new Float32Array(n * 3);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = x + (rand() - 0.5) * w;
      positions[i * 3 + 1] = rand() * 3.2;
      positions[i * 3 + 2] = z + 0.4 + rand() * 3.2;
      speed[i] = 0.4 + rand() * 0.8;
    }
    const pts = createPoints({
      positions,
      size: 0.32,
      sizeAttenuation: true,
      material: { color: 0xdffcf5, transparent: true, opacity: 0.4, depthWrite: false },
    });
    pts.material.userData.level = true;
    pts.object.geometry.userData.shared = true; // Sprite geometry is shared by three.js itself
    level.add(pts.object);
    mist = { pts, speed, n, x, w, z };
  }

  function buildGate(g) {
    const x = g.x;
    let door;
    if (g.style === 'arch') {
      for (const s of [-1, 1]) box(x + 0.3, 2.6, s * 3.35, 1.3, 5.2, 1.3, materials.stone);
      box(x + 0.3, 5.5, 0, 1.5, 1.0, 8.2, materials.darkStone);
      box(x + 0.3, 6.15, 0, 1.1, 0.3, 7.4, materials.leaf, false, false);
      door = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 5.6), materials.darkMetal);
      door.position.set(x, 2.1, 0);
      gate.openY = 6.4;
    } else {
      box(x + 1.8, 2.15, -3.15, 5.0, 4.3, 1.1, materials.darkStone);
      box(x + 1.8, 2.15, 3.15, 5.0, 4.3, 1.1, materials.darkStone);
      box(x + 2.2, 4.4, 0, 5.8, 1.0, 7.2, materials.darkStone);
      door = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.5, 5.0), materials.darkMetal);
      door.position.set(x, 1.75, 0);
      gate.openY = 6.2;
    }
    door.castShadow = door.receiveShadow = true;
    // Warning strips ride up with the door (they used to stay behind when it opened).
    const face = -(door.geometry.parameters.width / 2 + 0.045);
    for (let y = 0.5; y <= 3.0; y += 0.65) {
      const strip = part(new THREE.BoxGeometry(0.08, 0.1, 4.4), materials.warning, door, face, y - door.position.y, 0);
      strip.rotation.x = 0.06;
    }
    level.add(door);
    gate.door = door;
    gate.barrier = addObstacle(x - 0.45, x + 0.45, -3.05, 3.05);
  }

  // All signs share one canvas atlas, one material and one merged mesh.
  function buildSigns(list) {
    if (!list.length) return;
    let rows = 1;
    while (rows < list.length) rows *= 2;
    const H = rows * 128;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    list.forEach(([text], i) => {
      const y0 = i * 128;
      ctx.fillStyle = '#1b2d18';
      ctx.fillRect(0, y0, 512, 128);
      ctx.strokeStyle = '#baff38';
      ctx.lineWidth = 8;
      ctx.strokeRect(7, y0 + 7, 498, 114);
      ctx.fillStyle = '#efffd9';
      ctx.font = '900 46px Arial';
      ctx.fillText(text, 256, y0 + 66);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const signMat = new THREE.MeshBasicMaterial({ map: tex });
    signMat.userData.level = true;
    list.forEach(([, x, z, rotY], i) => {
      box(x, 1.1 * 0.52, z, 0.12, 1.1, 0.12, materials.wood, true, true, { ry: rotY });
      const plane = new THREE.PlaneGeometry(2.25, 0.58);
      const uvs = plane.attributes.uv;
      for (let k = 0; k < uvs.count; k++) uvs.setY(k, (H - (i + 1) * 128 + uvs.getY(k) * 128) / H);
      solid(plane, signMat, x, 1.52, z, { ry: rotY, cast: false, receive: false });
    });
  }

  // ---------------------------------------------------------------- the ranger
  function buildPlayer() {
    const group = new THREE.Group();
    part(new THREE.BoxGeometry(0.65, 0.36, 0.48), materials.playerDark, group, 0, 0.88, 0);
    part(new THREE.BoxGeometry(0.78, 0.82, 0.54), materials.player, group, 0, 1.42, 0);
    part(new THREE.SphereGeometry(0.29, 8, 6), materials.skin, group, 0, 2.03, 0);
    part(new THREE.BoxGeometry(0.62, 0.1, 0.6), materials.warning, group, 0, 2.04, 0);
    const legGeo = new THREE.BoxGeometry(0.22, 0.74, 0.25);
    const leftLeg = part(legGeo, materials.playerDark, group, -0.2, 0.42, -0.13);
    const rightLeg = part(legGeo, materials.playerDark, group, 0.2, 0.42, 0.13);
    const arm = part(new THREE.BoxGeometry(0.56, 0.18, 0.18), materials.skin, group, 0.44, 1.45, 0.22);
    arm.rotation.z = -0.16;
    part(new THREE.BoxGeometry(0.82, 0.16, 0.18), materials.darkMetal, group, 0.78, 1.55, 0.05);
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    const flash = part(G.muzzle, materials.bullet, group, 1.3, 1.55, 0.05);
    flash.castShadow = flash.receiveShadow = false;
    flash.visible = false;
    group.position.set(2, 0, 0);
    scene.add(group);
    return {
      group, leftLeg, rightLeg, flash, flashT: 0,
      x: 2, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      facing: 1, onGround: true, coyote: 0, jumpBuffer: 0, grenadeBuffer: 0,
      fireCooldown: 0, grenadeCooldown: 0, invuln: 0, runTime: 0,
    };
  }

  function resetPlayer(x) {
    player.x = x;
    player.z = 0;
    player.y = probe(x, 0, 0).h;
    player.vx = player.vy = player.vz = 0;
    player.facing = 1;
    player.onGround = true;
    player.coyote = player.jumpBuffer = player.grenadeBuffer = 0;
    player.fireCooldown = player.grenadeCooldown = player.invuln = 0;
    player.flashT = 0;
    player.flash.visible = false;
    player.group.position.set(player.x, player.y, player.z);
    player.group.rotation.set(0, 0, 0);
    player.group.scale.set(1, 1, 1);
    player.group.visible = true;
  }

  // ---------------------------------------------------------------- enemies & pickups
  function spawnEnemy(type, x, y, z, index) {
    const cfg = BALANCE.enemy[type];
    const group = new THREE.Group();
    const e = {
      type, i: index, group, x, y, z, cfg,
      hp: cfg.hp, maxHp: cfg.hp, radius: RADIUS[type], hitY: HIT_Y[type], bob: 0,
      cooldown: 0.3 + Math.random() * 0.8, dead: false, hurt: 0, phase: Math.random() * 6.28,
      boss: BOSSES.has(type), minX: -Infinity, maxX: Infinity,
    };
    if (type === 'grunt') {
      part(G.gruntBody, materials.enemy, group, 0, 1.18, 0);
      part(G.head, materials.skin, group, 0, 1.79, 0);
      part(G.gruntLegs, materials.enemyDark, group, 0, 0.45, 0);
      part(G.gun, materials.darkMetal, group, -0.62, 1.25, 0);
      // A grunt on a deck or ledge keeps to it.
      if (y > 0.1) {
        const b = M.bridges.find((br) => x >= br.x1 && x <= br.x2);
        if (b) {
          e.minX = b.x1 + 0.3;
          e.maxX = b.x2 - 0.3;
        }
      }
    } else if (type === 'turret') {
      part(G.turretBase, materials.turret, group, 0, 0.28, 0);
      part(G.turretTop, materials.darkMetal, group, 0, 0.78, 0);
      part(G.barrel, materials.turret, group, -0.72, 0.86, 0);
    } else if (type === 'drone') {
      part(G.droneCore, materials.enemy, group);
      part(G.droneWing, materials.darkMetal, group);
      part(G.eye, materials.warning, group, -0.48, -0.05, 0);
    } else if (type === 'boss') {
      part(G.bossShell, materials.darkMetal, group);
      e.core = part(G.bossCore, materials.warning, group, -0.55, 0, 0);
      e.ring = part(G.bossRing, materials.turret, group);
      e.ring.rotation.y = Math.PI / 2;
    } else if (type === 'mortar') {
      part(G.mortarBase, materials.turret, group, 0, 0.18, 0);
      part(G.sandbag, materials.mud, group, 0.45, 0.15, 0.42);
      part(G.sandbag, materials.mud, group, 0.45, 0.15, -0.42);
      e.tube = part(G.mortarTube, materials.darkMetal, group, -0.12, 0.72, 0);
      e.tube.rotation.z = 0.55;
      part(G.eye, materials.warning, group, 0.3, 0.45, 0);
      e.recoil = 0;
    } else if (type === 'sniper') {
      part(G.gruntBody, materials.sniper, group, 0, 1.18, 0);
      part(G.head, materials.skin, group, 0, 1.79, 0);
      part(G.hood, materials.playerDark, group, 0, 1.97, 0);
      part(G.visor, materials.warning, group, -0.27, 1.8, 0);
      part(G.gruntLegs, materials.enemyDark, group, 0, 0.45, 0);
      part(G.rifle, materials.darkMetal, group, -0.75, 1.28, 0);
      e.laser = new THREE.Mesh(G.laser, materials.laser);
      e.laser.visible = false;
      e.laser.frustumCulled = false;
      level.add(e.laser);
      e.aim = 0;
      e.len = 10;
      e.dir = new THREE.Vector3(-1, 0, 0);
    } else if (type === 'walker') {
      const body = new THREE.Group();
      body.position.y = 3.1;
      group.add(body);
      part(G.walkerHull, materials.darkMetal, body);
      part(G.walkerPlate, materials.turret, body, 0.2, 0.75, 0);
      e.core = part(G.walkerCore, materials.warning, body, -1.2, 0.05, 0);
      for (const s of [-1, 1]) {
        part(G.walkerGun, materials.turret, body, -1.1, -0.35, s * 1.1);
        part(G.eye, materials.warning, body, 0.9, 0.5, s * 0.7);
      }
      e.legs = [-1, 1].map((s) => {
        const hip = new THREE.Group();
        hip.position.set(0.1, 2.55, s * 0.75);
        part(G.walkerThigh, materials.metal, hip, 0, -0.6, 0);
        part(G.walkerShin, materials.darkMetal, hip, 0.12, -1.7, 0);
        part(G.walkerFoot, materials.darkStone, hip, 0.1, -2.42, 0);
        group.add(hip);
        return hip;
      });
      e.body = body;
      e.minX = M.bossAt + 3;
      e.maxX = M.gate.x - 3;
      e.stompPhase = 0;
      e.stompT = 0;
      e.stompCd = 2;
      e.lobCd = 2.5;
      e.walk = 0;
      e.stepIx = 0;
      e.vx = 0;
      e.side = 1;
      e.enraged = false;
    }
    if (e.boss) {
      e.hp = e.maxHp = Math.round(cfg.hp * D.bossHp);
      bossEnemy = e;
    }
    group.position.set(x, y, z);
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    level.add(group);
    enemies.push(e);
    return e;
  }

  function addPickup(type, x, y, z, index) {
    const group = new THREE.Group();
    if (type === 'intel') {
      const drive = part(G.intel, materials.intel, group, 0, 0.2, 0);
      drive.rotation.z = 0.25;
      const ring = part(G.intelRing, materials.intel, group, 0, 0.2, 0);
      ring.rotation.x = Math.PI / 2;
    } else {
      const crate = part(G.crate, materials.darkMetal, group);
      crate.rotation.y = Math.PI / 4;
      const markMat = { weapon: materials.xp, armor: materials.glass, health: materials.warning, grenade: materials.bullet, spread: materials.spread }[type] || materials.xp;
      part(type === 'spread' ? G.spreadMark : G.mark, markMat, group, 0, 0.58, 0);
    }
    group.position.set(x, y, z);
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    level.add(group);
    const p = { type, i: index, group, x, y, z, picked: false, phase: Math.random() * 6.28 };
    pickups.push(p);
    return p;
  }

  // ---------------------------------------------------------------- load / reset
  function clearLevel() {
    level.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of list) {
        if (!m.userData.level) continue;
        m.map?.dispose();
        m.dispose();
      }
    });
    scene.remove(level);
    level = new THREE.Group();
    scene.add(level);
    enemies.length = pickups.length = obstacles.length = beacons.length = 0;
    recycleAll();
    effects.length = 0;
    blasts.length = 0;
    grenades.length = 0;
    gate.door = gate.barrier = null;
    bossEnemy = null;
    mist = null;
    for (const p of pools) p.count = 0;
  }

  function recycleAll() {
    for (const b of playerBullets) bulletFree.push(b);
    playerBullets.length = 0;
    clearHostileFire();
  }

  function clearHostileFire() {
    for (const b of enemyBullets) bulletFree.push(b);
    enemyBullets.length = 0;
    for (const s of shells) shellFree.push(s);
    shells.length = 0;
    shockWave.active = false;
    shock.visible = false;
    for (const e of enemies) {
      if (e.type === 'sniper') {
        e.aim = 0;
        e.laser.visible = false;
        e.cooldown = Math.max(e.cooldown, 1.2);
      }
    }
  }

  function load(index, diffId, run = null) {
    clearLevel();
    missionIndex = clamp(index | 0, 0, MISSIONS.length - 1);
    M = MISSIONS[missionIndex];
    D = DIFFICULTY[diffId] || DIFFICULTY.ranger;
    applyEnv();
    buildWorld();

    const cpIndex = run ? clamp(run.cp | 0, 0, M.checkpoints.length - 1) : -1;
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    Object.assign(state, {
      complete: false, completeTimer: 0, elapsed: 0, kills: 0, shots: 0, hits: 0, score: 0, xp: 0, level: 1,
      maxHealth: D.maxHealth, health: D.maxHealth, armor: 0, grenades: BALANCE.player.grenades,
      objectiveStage: 0, checkpointX: M.start, checkpointIndex: -1, bossTriggered: false, bossDead: false,
      cameraShake: 0, toastTimer: 0, letterbox: 0, flash: 0, deaths: 0, intel: 0, spreadTime: 0, timeBonus: 0,
      intelTotal: M.pickups.filter((p) => p[0] === 'intel').length,
    });
    if (run) {
      Object.assign(state, {
        xp: Math.max(0, num(run.xp)),
        score: Math.max(0, num(run.score)),
        grenades: clamp(num(run.grenades), 0, 5),
        armor: clamp(num(run.armor), 0, 3),
        elapsed: Math.max(0, num(run.elapsed)),
        kills: Math.max(0, num(run.kills)),
        shots: Math.max(0, num(run.shots)),
        hits: Math.max(0, num(run.hits)),
        deaths: Math.max(0, num(run.deaths)),
        intel: Math.max(0, num(run.intel)),
        objectiveStage: clamp(num(run.stage), 0, M.objectives.length - 1),
        checkpointIndex: cpIndex,
        checkpointX: M.checkpoints[cpIndex].x,
      });
      state.level = levelForXp(state.xp);
      state.hits = Math.min(state.hits, state.shots);
    }

    const dead = new Set(Array.isArray(run?.dead) ? run.dead : []);
    const picked = new Set(Array.isArray(run?.picked) ? run.picked : []);
    M.enemies.forEach(([type, x, y, z], i) => {
      const e = spawnEnemy(type, x, y, z, i);
      if (dead.has(i) && !e.boss) {
        e.dead = true;
        e.group.visible = false;
      }
    });
    M.pickups.forEach(([type, x, y, z], i) => {
      const p = addPickup(type, x, y, z, i);
      if (picked.has(i)) {
        p.picked = true;
        p.group.visible = false;
      }
    });
    beacons.forEach((b, i) => (b.activated = i <= cpIndex));

    resetPlayer(state.checkpointX);
    titleT = 0;
    camera.position.set(player.x + 3.6, 6.2, 11.2);
    camera.lookAt(player.x + 2, 1.65, 0);
    sun.position.set(player.x + 12, 28, 14);
    sun.target.position.set(player.x, 0, 0);

    for (const k of Object.keys(hudCache)) delete hudCache[k];
    ui.hud.classList.add('hidden');
    ui.toast.classList.add('hidden');
    ui.damageFlash.classList.remove('active');
    setLetterbox(false);
    updateHud();
  }

  // Compile every pipeline up front (including hidden meshes and empty pools) so the
  // first explosion or sniper laser does not stutter.
  async function warm() {
    const hidden = [];
    level.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    for (const o of [shock, player.flash]) {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    }
    for (const p of pools) {
      p.setMatrixAt(0, HIDDEN);
      p.count = 1;
      p.instanceMatrix.needsUpdate = true;
    }
    try {
      await renderer.compileAsync(scene, camera);
    } catch (err) {
      console.warn('Pipeline warm-up skipped:', err);
    }
    for (const o of hidden) o.visible = false;
    for (const p of pools) p.count = 0;
  }

  function begin(continued = false) {
    ui.hud.classList.remove('hidden');
    showToast(continued ? 'REINSERTED // CHECKPOINT' : M.startToast, 2.3);
    if (continued) player.invuln = 1.5;
  }

  function snapshot() {
    return {
      v: 1,
      mission: M.id,
      difficulty: D.id,
      cp: state.checkpointIndex,
      stage: state.objectiveStage,
      xp: state.xp,
      score: state.score,
      grenades: state.grenades,
      armor: state.armor,
      elapsed: Math.round(state.elapsed * 10) / 10,
      kills: state.kills,
      shots: state.shots,
      hits: state.hits,
      deaths: state.deaths,
      intel: state.intel,
      dead: enemies.filter((e) => e.dead).map((e) => e.i),
      picked: pickups.filter((p) => p.picked).map((p) => p.i),
    };
  }

  // ---------------------------------------------------------------- collision
  // Ramps and decks from the mission's bridges. A ramp too high to step onto is a
  // wall (the back of a staircase, the face of a cliff shelf); a deck counts only
  // when the ranger is already up at its height, so the ground route runs under it.
  const probeOut = { h: 0, blocked: false };
  function probe(x, z, y) {
    let h = 0;
    let blocked = false;
    for (const b of M.bridges) {
      if (Math.abs(z - b.z) > b.w / 2 + 0.2) continue;
      if (x >= b.x0 && x < b.x1) {
        const r = ((x - b.x0) / (b.x1 - b.x0)) * b.top;
        if (r <= y + STEP) h = Math.max(h, r);
        else blocked = true;
      } else if (x >= b.x1 && x <= b.x2) {
        if (y >= b.top - STEP) h = Math.max(h, b.top);
        else if (b.solid) blocked = true;
      } else if (x > b.x2 && x <= b.x3) {
        const r = ((b.x3 - x) / (b.x3 - b.x2)) * b.top;
        if (r <= y + STEP) h = Math.max(h, r);
        else blocked = true;
      }
    }
    probeOut.h = h;
    probeOut.blocked = blocked;
    return probeOut;
  }

  const resolved = { x: 0, z: 0 };
  function resolveObstacles(x, z, oldX, oldZ) {
    const r = BODY_R;
    let nx = x, nz = z;
    for (const o of obstacles) {
      if (!o.active) continue;
      if (nx > o.x1 - r && nx < o.x2 + r && nz > o.z1 - r && nz < o.z2 + r) {
        const px = Math.min(Math.abs(nx - (o.x1 - r)), Math.abs(nx - (o.x2 + r)));
        const pz = Math.min(Math.abs(nz - (o.z1 - r)), Math.abs(nz - (o.z2 + r)));
        if (px < pz) nx = oldX;
        else nz = oldZ;
      }
    }
    resolved.x = nx;
    resolved.z = nz;
    return resolved;
  }

  function creekSlow(x) {
    for (const c of M.creeks) if (x > c.slow1 && x < c.slow2) return c.slow;
    return 1;
  }

  const targetable = (e) => !e.dead && (!e.boss || state.bossTriggered);

  // ---------------------------------------------------------------- per-frame update
  function update(dt, t) {
    if (state.complete) {
      tickComplete(dt, t);
      return;
    }
    state.elapsed += dt;
    state.spreadTime = Math.max(0, state.spreadTime - dt);
    handleZoom(dt);
    updatePlayer(dt, t);
    updateEnemies(dt, t);
    updateProjectiles(dt);
    updateGrenades(dt);
    updateShells(dt);
    updateShock(dt);
    updatePickups(dt, t, true);
    updateBlasts(dt);
    updateEffects(dt);
    updateObjectives();
    updateCamera(dt);
    animateWorld(dt, t);
    tickTimers(dt);
    updateHud();
    drawDynamic();
    ambience(dt);
  }

  function tickComplete(dt, t) {
    updateBlasts(dt);
    updateEffects(dt);
    updateCamera(dt);
    updatePickups(dt, t, false);
    animateWorld(dt, t);
    tickTimers(dt);
    drawDynamic();
    if (state.completeTimer > 0) {
      state.completeTimer -= dt;
      if (state.completeTimer <= 0) events.onComplete?.(results());
    }
  }

  // Title backdrop: a slow pan along the mission.
  function idle(dt, t) {
    titleT += dt;
    const span = Math.max(10, M.maxX - 14);
    const x = 6 + (0.5 - 0.5 * Math.cos(titleT * 0.045)) * span;
    camera.position.set(x - 1.5, 7.4, 14.5);
    camera.lookAt(x + 4.5, 1.2, -1.2);
    sun.position.set(x + 12, 28, 14);
    sun.target.position.set(x, 0, 0);
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.type === 'drone') {
        e.bob = Math.sin(t * 2.1 + e.phase) * 0.38;
        e.group.position.y = e.y + e.bob;
      } else if (e.type === 'boss') {
        e.core.rotation.x += dt * 1.6;
      }
    }
    updatePickups(dt, t, false);
    updateEffects(dt);
    animateWorld(dt, t);
    drawDynamic();
    ambience(dt);
  }

  function ambience(dt) {
    chirpT -= dt;
    if (chirpT <= 0) {
      chirpT = 4 + Math.random() * 6;
      audio.chirp();
    }
  }

  function handleZoom(dt) {
    const wheel = input.zoom();
    if (wheel) state.zoom = clamp(state.zoom - wheel * 0.07, 0.78, 1.32);
    const held = input.value('zoomOut') - input.value('zoomIn');
    if (held) state.zoom = clamp(state.zoom + held * dt * 0.8, 0.78, 1.32);
  }

  function updatePlayer(dt, t) {
    const mv = input.vector('move');
    const mx = mv.x;
    const mz = -mv.y; // up on the stick walks away from the camera
    player.invuln = Math.max(0, player.invuln - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.grenadeCooldown = Math.max(0, player.grenadeCooldown - dt);
    // Buffered jump (a press just before landing still jumps) and a little coyote time.
    player.jumpBuffer = input.pressed('jump') ? 0.13 : Math.max(0, player.jumpBuffer - dt);
    player.grenadeBuffer = input.pressed('grenade') ? 0.18 : Math.max(0, player.grenadeBuffer - dt);
    player.coyote = player.onGround ? 0.09 : Math.max(0, player.coyote - dt);

    const speed = BALANCE.player.speed * (player.y < 0.5 ? creekSlow(player.x) : 1);
    player.vx = approach(player.vx, mx * speed, dt * 34);
    player.vz = approach(player.vz, mz * speed * 0.7, dt * 28);
    if (Math.abs(mx) > 0.08) player.facing = Math.sign(mx);

    if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)) {
      player.vy = BALANCE.player.jump;
      player.onGround = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      audio.tone(260, 0.05, 'square', 0.035);
    }
    player.vy -= BALANCE.player.gravity * dt;

    let nx = clamp(player.x + player.vx * dt, 0.4, M.maxX);
    let nz = clamp(player.z + player.vz * dt, -LANE_Z, LANE_Z);
    const r = resolveObstacles(nx, nz, player.x, player.z);
    nx = r.x;
    nz = r.z;
    if (probe(nx, nz, player.y).blocked) {
      if (!probe(player.x, nz, player.y).blocked) nx = player.x;
      else if (!probe(nx, player.z, player.y).blocked) nz = player.z;
      else {
        nx = player.x;
        nz = player.z;
      }
    }
    // The Rift Walker is solid: bumping into it pushes the ranger out and hurts.
    const w = bossEnemy;
    let bumped = false;
    if (w && w.type === 'walker' && !w.dead && state.bossTriggered && Math.abs(nx - w.x) < 1.35 && Math.abs(nz - w.z) < 1.25 && player.y < 2.6) {
      nx = clamp(w.x + (player.x < w.x ? -1.35 : 1.35), 0.4, M.maxX);
      bumped = true;
    }
    player.x = nx;
    player.z = nz;
    player.y += player.vy * dt;

    const floor = probe(player.x, player.z, player.y).h;
    const wasGround = player.onGround;
    if (player.vy <= 0 && (player.y <= floor + 0.04 || (wasGround && player.y - floor < 0.3))) {
      player.y = floor;
      player.vy = 0;
      player.onGround = true;
    } else if (player.y > floor + 0.06) player.onGround = false;
    // After the move, so a respawn from this hit is not overwritten.
    if (bumped) hurtPlayer(1);

    if (input.down('fire') && player.fireCooldown <= 0) firePlayerWeapon();
    if (player.grenadeBuffer > 0 && player.grenadeCooldown <= 0) {
      player.grenadeBuffer = 0;
      if (state.grenades > 0) throwGrenade();
      else audio.tone(140, 0.05, 'square', 0.02); // empty
    }

    player.group.position.set(player.x, player.y, player.z);
    player.group.scale.x = player.facing;
    const moveMag = Math.hypot(player.vx, player.vz);
    player.runTime += dt * moveMag * 1.25;
    const stride = Math.sin(player.runTime * 2.4) * Math.min(0.55, moveMag * 0.09);
    player.leftLeg.rotation.z = stride;
    player.rightLeg.rotation.z = -stride;
    player.group.rotation.z = player.onGround ? -player.vx * 0.008 : clamp(-player.vy * 0.018, -0.18, 0.18);
    player.group.visible = player.invuln <= 0 || Math.floor(t * 18) % 2 === 0;
    player.flashT -= dt;
    player.flash.visible = player.flashT > 0;
  }

  function firePlayerWeapon() {
    const w = BALANCE.weapons[state.level - 1];
    const fan = state.spreadTime > 0;
    const shots = fan ? BALANCE.spread.shots : w.shots;
    const spread = fan ? BALANCE.spread.spread : w.spread;
    const damage = w.damage * (fan ? BALANCE.spread.damageScale : 1);
    player.fireCooldown = 1 / w.rate;
    state.shots += shots;
    const target = selectAimTarget();
    const ox = player.x + player.facing * 1.05, oy = player.y + 1.5, oz = player.z + 0.02;
    if (target) {
      _v.set(target.x - ox, target.y + target.bob + target.hitY - oy, target.z - oz).normalize();
      if (_v.x * player.facing < -0.05) {
        _v.x = player.facing * Math.abs(_v.x);
        _v.normalize();
      }
    } else _v.set(player.facing, 0, 0);
    for (let k = 0; k < shots; k++) {
      const s = (k - (shots - 1) / 2) * spread;
      _v2.copy(_v);
      _v2.y += s;
      _v2.z += s * 0.38;
      _v2.normalize();
      spawnBullet(ox, oy, oz, _v2, true, damage, 19.5);
    }
    player.flashT = 0.05;
    audio.tone(fan ? 600 : 720 + state.level * 90, 0.028, 'square', 0.028);
  }

  function selectAimTarget() {
    let best = null;
    let bestScore = Infinity;
    for (const e of enemies) {
      if (!targetable(e)) continue;
      const dx = e.x - player.x, dz = e.z - player.z, dy = e.y - player.y;
      if (dx * player.facing < -0.8) continue;
      const d = Math.hypot(dx, dz, dy * 0.4);
      if (d > 19) continue;
      const score = d + Math.abs(dz) * 0.7;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  function spawnBullet(x, y, z, dir, friendly, damage, speed, len = 1) {
    const list = friendly ? playerBullets : enemyBullets;
    if (list.length >= BULLET_CAP) return;
    const b = bulletFree.pop() || { q: new THREE.Quaternion() };
    b.x = x;
    b.y = y;
    b.z = z;
    b.vx = dir.x * speed;
    b.vy = dir.y * speed;
    b.vz = dir.z * speed;
    b.age = 0;
    b.damage = damage;
    b.len = len;
    b.q.setFromUnitVectors(X_AXIS, dir);
    list.push(b);
  }

  function dropFrom(list, i, free) {
    free.push(list[i]);
    list[i] = list[list.length - 1];
    list.pop();
  }

  function updateProjectiles(dt) {
    const maxX = M.maxX + 5;
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      let hit = false;
      for (const e of enemies) {
        if (!targetable(e)) continue;
        const rr = e.radius + 0.18;
        if (distSq(b.x, b.y, b.z, e.x, e.y + e.bob + e.hitY, e.z) < rr * rr) {
          damageEnemy(e, b.damage, b.x, b.y, b.z);
          state.hits++;
          hit = true;
          break;
        }
      }
      if (hit || b.age > 1.55 || b.x > maxX || b.x < -3 || Math.abs(b.z) > 8) dropFrom(playerBullets, i, bulletFree);
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (!b) continue; // a respawn below clears hostile fire mid-loop
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (player.invuln <= 0 && distSq(b.x, b.y, b.z, player.x, player.y + 1.05, player.z) < 0.62 * 0.62) {
        dropFrom(enemyBullets, i, bulletFree);
        hurtPlayer(1);
        continue;
      }
      if (b.age > 3.2 || b.x > maxX || b.x < -3 || Math.abs(b.z) > 9) dropFrom(enemyBullets, i, bulletFree);
    }
  }

  function throwGrenade() {
    if (grenades.length >= GRENADE_CAP) return;
    state.grenades--;
    player.grenadeCooldown = BALANCE.grenade.cooldown;
    const g = grenadeFree.pop() || {};
    g.x = player.x + player.facing * 0.7;
    g.y = player.y + 1.35;
    g.z = player.z;
    g.vx = player.facing * 7.5 + player.vx * 0.3;
    g.vy = 6.8;
    g.vz = -input.vector('move').y * 2.2;
    g.age = 0;
    g.fuse = 0.86;
    g.rx = 0;
    g.rz = 0;
    grenades.push(g);
    audio.tone(170, 0.08, 'triangle', 0.03);
  }

  function updateGrenades(dt) {
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.age += dt;
      g.vy -= 18 * dt;
      const nx = g.x + g.vx * dt;
      if (probe(nx, g.z, g.y).blocked) g.vx *= -0.4; // bounce off a cliff face or stair back
      else g.x = nx;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
      const fl = probe(g.x, g.z, g.y).h + 0.16;
      if (g.y < fl) {
        g.y = fl;
        g.vy = Math.abs(g.vy) * 0.35;
        g.vx *= 0.8;
        g.vz *= 0.8;
      }
      g.rx += dt * 6;
      g.rz += dt * 4;
      if (g.age >= g.fuse) {
        explodeGrenade(g);
        dropFrom(grenades, i, grenadeFree);
      }
    }
  }

  function explodeGrenade(g) {
    spawnExplosion(g.x, g.y, g.z, 1.0);
    const R = BALANCE.grenade.radius;
    for (const e of enemies) {
      if (!targetable(e)) continue;
      const d = Math.hypot(e.x - g.x, e.y - g.y, e.z - g.z);
      if (d <= R) damageEnemy(e, BALANCE.grenade.damage * (1 - d / (R * 1.6)));
    }
    state.cameraShake = Math.max(state.cameraShake, 0.42);
    audio.explosion();
    input.rumble(0.45, 140);
  }

  function updateEnemies(dt, t) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.hurt = Math.max(0, e.hurt - dt);
      e.group.scale.y = e.hurt > 0 ? 0.92 : 1;
      e.cooldown -= dt;
      if (e.type === 'drone') {
        e.bob = Math.sin(t * 2.1 + e.phase) * 0.38;
        e.group.position.y = e.y + e.bob;
        e.group.rotation.x = Math.sin(t * 1.4 + e.phase) * 0.08;
      }
      if (e.boss && !state.bossTriggered) continue;
      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const d = Math.hypot(dx, dz, (player.y - e.y) * 0.4);
      if (e.type === 'boss') {
        e.group.rotation.x = Math.sin(t * 0.8) * 0.06;
        e.core.rotation.x += dt * 1.6;
        e.ring.rotation.x += dt * 0.8;
      } else if (e.type === 'grunt' && d < 10 && d > 4.5) {
        const step = Math.sign(dx) * Math.min(1.0 * dt, Math.max(0, Math.abs(dx) - 4.2));
        const r = resolveObstacles(e.x + step, e.z, e.x, e.z);
        e.x = clamp(r.x, e.minX, e.maxX);
        e.group.position.x = e.x;
      } else if (e.type === 'mortar') {
        updateMortar(e, dt, d);
      } else if (e.type === 'sniper') {
        updateSniper(e, dt, d);
      } else if (e.type === 'walker') {
        updateWalker(e, dt, d);
        continue;
      }
      e.group.scale.x = dx >= 0 ? -1 : 1;
      if (BULLET_TYPES.has(e.type) && d < RANGE[e.type] && e.cooldown <= 0) enemyFire(e);
    }
  }

  function enemyFire(e) {
    e.cooldown = e.cfg.cadence * D.cadence * (0.84 + Math.random() * 0.32);
    const oy = e.y + e.bob + FIRE_Y[e.type];
    _v.set(player.x - e.x, player.y + 1.0 - oy, player.z - e.z).normalize();
    const speed = e.cfg.bulletSpeed * D.bulletSpeed;
    if (e.type === 'boss') {
      for (const s of SPREAD3) {
        _v2.copy(_v);
        _v2.y += s;
        _v2.z += s * 0.7;
        _v2.normalize();
        spawnBullet(e.x, oy, e.z, _v2, false, 1, speed);
      }
    } else spawnBullet(e.x, oy, e.z, _v, false, 1, speed);
  }

  // Mortar crews lob a shell at where the ranger is heading; a red ring marks the landing.
  function updateMortar(e, dt, d) {
    e.recoil = Math.max(0, e.recoil - dt);
    e.tube.position.y = 0.72 - e.recoil * 0.4;
    if (d < RANGE.mortar && e.cooldown <= 0) {
      e.cooldown = e.cfg.cadence * D.cadence * (0.9 + Math.random() * 0.2);
      e.recoil = 0.25;
      const face = player.x >= e.x ? 1 : -1;
      lobShell(e.x + face * 0.4, e.y + 1.2, e.z, player.x + player.vx * 0.35, player.z + player.vz * 0.2, e.cfg.flight, e.cfg.blast);
      audio.tone(190, 0.16, 'triangle', 0.035, 95);
    }
  }

  // Snipers paint the ranger with a laser, hold it still for a blink, then fire one fast round.
  function updateSniper(e, dt, d) {
    const face = player.x >= e.x ? 1 : -1;
    const mx = e.x + face * 1.35, my = e.y + FIRE_Y.sniper, mz = e.z;
    if (e.aim > 0) {
      e.aim -= dt;
      if (e.aim > 0.3) {
        _v.set(player.x - mx, player.y + 1.0 - my, player.z - mz);
        e.len = _v.length();
        e.dir.copy(_v.normalize());
      }
      const laser = e.laser;
      laser.visible = e.aim > 0.3 || Math.floor(e.aim * 30) % 2 === 0;
      laser.position.set(mx, my, mz);
      laser.quaternion.setFromUnitVectors(X_AXIS, e.dir);
      laser.scale.set(Math.min(26, e.len + 1.5), 1, 1);
      if (e.aim <= 0) {
        e.aim = 0;
        laser.visible = false;
        spawnBullet(mx, my, mz, e.dir, false, 1, e.cfg.bulletSpeed * D.bulletSpeed, 2.4);
        e.cooldown = e.cfg.cadence * D.cadence * (0.9 + Math.random() * 0.25);
        audio.tone(1400, 0.07, 'sawtooth', 0.03, 420);
      }
    } else if (d < RANGE.sniper && e.cooldown <= 0) {
      e.aim = e.cfg.aim * Math.max(0.75, D.cadence);
      audio.tone(1900, 0.05, 'sine', 0.012);
    }
  }

  // The Rift Walker keeps ahead of the ranger, fires three-way volleys from alternating
  // cannons, lobs shells, and stomps a ground shockwave when the ranger gets close (jump it).
  function updateWalker(e, dt, d) {
    const toward = player.x < e.x ? -1 : 1;
    e.group.scale.x = toward < 0 ? 1 : -1;
    e.stompCd -= dt;
    e.lobCd -= dt;
    let crouch = 0;
    if (e.stompPhase === 0) {
      const want = clamp(player.x + 6.5, e.minX, e.maxX);
      const gap = want - e.x;
      e.vx = Math.abs(gap) > 0.25 ? Math.sign(gap) * (e.enraged ? 2.0 : 1.5) : 0;
      e.x += e.vx * dt;
      e.walk += dt * Math.abs(e.vx) * 2.4;
      if (e.stompCd <= 0 && Math.abs(player.x - e.x) < 3.6 && Math.abs(player.z - e.z) < 3.5) {
        e.stompPhase = 1;
        e.stompT = 0.6;
        audio.tone(140, 0.5, 'sawtooth', 0.03, 60);
      } else if (e.cooldown <= 0 && d < RANGE.walker) {
        walkerVolley(e, toward);
      } else if (e.lobCd <= 0) {
        e.lobCd = 3.8 * D.cadence * (e.enraged ? 0.75 : 1);
        for (const off of [-1.8, 1.4]) lobShell(e.x + toward * 0.6, e.y + 4.2, e.z, player.x + off, player.z, e.cfg.flight, e.cfg.blast);
        audio.tone(170, 0.2, 'triangle', 0.035, 80);
      }
    } else if (e.stompPhase === 1) {
      e.stompT -= dt;
      crouch = (1 - Math.max(0, e.stompT) / 0.6) * 0.45;
      if (e.stompT <= 0) {
        e.stompPhase = 2;
        e.stompT = 0.4;
        startShock(e.x, e.z);
        state.cameraShake = Math.max(state.cameraShake, 0.55);
        input.rumble(0.7, 220);
        audio.explosion(1.2);
        audio.tone(55, 0.35, 'sine', 0.07, 35);
      }
    } else {
      e.stompT -= dt;
      crouch = Math.max(0, e.stompT / 0.4) * 0.45;
      if (e.stompT <= 0) {
        e.stompPhase = 0;
        e.stompCd = 3.2 * D.cadence;
      }
    }
    const s = Math.sin(e.walk);
    e.legs[0].rotation.z = s * 0.32;
    e.legs[1].rotation.z = -s * 0.32;
    e.body.position.y = 3.1 + Math.abs(s) * 0.1 - crouch;
    e.core.rotation.y += dt * 2.5;
    e.group.position.x = e.x;
    const stepIx = Math.floor(e.walk / Math.PI);
    if (e.vx && stepIx !== e.stepIx) {
      e.stepIx = stepIx;
      audio.tone(62, 0.12, 'sine', 0.035);
      state.cameraShake = Math.max(state.cameraShake, 0.06);
    }
    if (!e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true;
      showToast('WALKER OVERDRIVE // STAY MOBILE', 1.8);
    }
  }

  function walkerVolley(e, toward) {
    e.cooldown = e.cfg.cadence * D.cadence * (e.enraged ? 0.75 : 1) * (0.84 + Math.random() * 0.32);
    e.side = -e.side;
    const ox = e.x + toward * 1.9, oy = e.body.position.y - 0.35, oz = e.z + e.side * 1.1;
    _v.set(player.x - ox, player.y + 1.0 - oy, player.z - oz).normalize();
    const speed = e.cfg.bulletSpeed * D.bulletSpeed;
    for (const s of [-0.12, 0, 0.12]) {
      _v2.copy(_v);
      _v2.y += s;
      _v2.z += s * 0.7;
      _v2.normalize();
      spawnBullet(ox, oy, oz, _v2, false, 1, speed);
    }
  }

  function lobShell(sx, sy, sz, tx, tz, dur, blast) {
    if (shells.length >= SHELL_CAP) return;
    tx = clamp(tx, 0.5, M.maxX);
    tz = clamp(tz, -LANE_Z, LANE_Z);
    const s = shellFree.pop() || {};
    s.sx = s.x = sx;
    s.sy = s.y = sy;
    s.sz = s.z = sz;
    s.tx = tx;
    s.tz = tz;
    s.ty = probe(tx, tz, 99).h; // lands on the highest surface there (a deck is cover)
    s.t = 0;
    s.dur = dur;
    s.arc = 3.4 + Math.abs(tx - sx) * 0.1;
    s.blast = blast;
    s.spin = 0;
    shells.push(s);
  }

  function updateShells(dt) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      if (!s) continue; // a respawn below clears hostile fire mid-loop
      s.t += dt / s.dur;
      s.spin += dt * 8;
      const k = Math.min(1, s.t);
      s.x = s.sx + (s.tx - s.sx) * k;
      s.z = s.sz + (s.tz - s.sz) * k;
      s.y = s.sy + (s.ty - s.sy) * k + s.arc * 4 * k * (1 - k);
      if (s.t >= 1) {
        spawnExplosion(s.tx, s.ty + 0.35, s.tz, 0.55 * s.blast);
        audio.explosion(0.6);
        state.cameraShake = Math.max(state.cameraShake, 0.18);
        const hit = Math.hypot(player.x - s.tx, player.z - s.tz) < s.blast && Math.abs(player.y - s.ty) < 1.2;
        dropFrom(shells, i, shellFree);
        if (hit) hurtPlayer(1);
      }
    }
  }

  function startShock(x, z) {
    shockWave.active = true;
    shockWave.x = x;
    shockWave.z = z;
    shockWave.t = 0;
    shockWave.hit = false;
    shock.position.set(x, 0.06, z);
    shock.scale.set(0.5, 1, 0.5);
    shock.visible = true;
  }

  function updateShock(dt) {
    if (!shockWave.active) return;
    shockWave.t += dt;
    const k = shockWave.t / 0.65;
    const r = 0.5 + k * 7.5;
    shock.scale.set(r, 1, r);
    materials.shock.opacity = Math.max(0, 0.9 * (1 - k));
    if (!shockWave.hit && player.onGround && player.y < 0.35 && Math.abs(Math.hypot(player.x - shockWave.x, player.z - shockWave.z) - r) < 0.6) {
      shockWave.hit = true;
      hurtPlayer(1);
    }
    if (k >= 1) {
      shockWave.active = false;
      shock.visible = false;
    }
  }

  function damageEnemy(e, amount, hx, hy, hz) {
    e.hp -= amount;
    e.hurt = 0.08;
    if (hx !== undefined) spawnExplosion(hx, hy, hz, 0.22, 0.14);
    if (state.elapsed - lastHitSound > 0.04) {
      lastHitSound = state.elapsed;
      audio.tone(120, 0.022, 'sawtooth', 0.018);
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    state.kills++;
    state.score += Math.round(e.cfg.score * D.score);
    addXP(e.cfg.xp);
    spawnExplosion(e.x, e.y + e.bob + (e.type === 'walker' ? 2.6 : 0.8), e.z, e.boss ? 2.2 : 0.65);
    e.group.visible = false;
    if (e.laser) e.laser.visible = false;
    audio.explosion(e.boss ? 1.35 : 0.55);
    input.rumble(e.boss ? 1 : 0.25, e.boss ? 450 : 70);
    if (!e.boss) return;
    state.bossDead = true;
    if (gate.barrier) gate.barrier.active = false;
    state.objectiveStage = M.objectives.length;
    showToast(M.bossDownToast, 3.0);
    state.score += 1000;
    state.cameraShake = 0.85;
    letterbox(1.2);
    if (e.type === 'walker') {
      shockWave.active = false;
      shock.visible = false;
      for (let k = 0; k < 6; k++) {
        blasts.push({ t: 0.12 + k * 0.16, x: e.x + (Math.random() - 0.5) * 2.4, y: 1 + Math.random() * 3, z: e.z + (Math.random() - 0.5) * 1.6, s: 0.9 + Math.random() * 0.6 });
      }
    }
  }

  function updateBlasts(dt) {
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.t -= dt;
      if (b.t <= 0) {
        spawnExplosion(b.x, b.y, b.z, b.s);
        audio.explosion(0.8);
        state.cameraShake = Math.max(state.cameraShake, 0.3);
        blasts.splice(i, 1);
      }
    }
  }

  function addXP(amount) {
    const oldLevel = state.level;
    state.xp += amount;
    state.level = Math.max(state.level, levelForXp(state.xp));
    if (state.level > oldLevel) {
      showToast(`WEAPON ${BALANCE.weapons[state.level - 1].name} ONLINE`, 2.4);
      state.health = Math.min(state.maxHealth, state.health + 1);
      audio.tone(520, 0.12, 'square', 0.045);
      setTimeout(() => audio.tone(780, 0.12, 'square', 0.04), 90);
      input.rumble(0.3, 90);
    }
  }

  function hurtPlayer(amount) {
    if (player.invuln > 0 || state.complete) return;
    player.invuln = 1.05;
    if (state.armor > 0) state.armor = Math.max(0, state.armor - amount);
    else state.health -= amount;
    state.cameraShake = Math.max(state.cameraShake, 0.28);
    state.flash = 0.13;
    ui.damageFlash.classList.add('active');
    audio.tone(90, 0.12, 'sawtooth', 0.05);
    input.rumble(0.55, 150);
    if (state.health <= 0) respawnPlayer();
  }

  function respawnPlayer() {
    state.deaths++;
    state.health = state.maxHealth;
    state.armor = Math.max(0, state.armor - 1);
    state.score = Math.max(0, state.score - 250);
    clearHostileFire();
    resetPlayer(state.checkpointX);
    player.invuln = 2.2;
    if (bossEnemy?.type === 'walker' && !bossEnemy.dead) {
      bossEnemy.stompPhase = 0;
      bossEnemy.stompCd = 2;
      bossEnemy.lobCd = Math.max(bossEnemy.lobCd, 2);
    }
    input.rumble(0.9, 280);
    showToast('REINSERTED // CHECKPOINT', 2.2);
  }

  function updatePickups(dt, t, collect) {
    for (const p of pickups) {
      if (p.picked) continue;
      p.group.rotation.y += dt * 0.8;
      p.group.position.y = p.y + Math.sin(t * 2.2 + p.phase) * 0.09;
      if (collect && Math.hypot(player.x - p.x, player.y + 0.6 - p.y, player.z - p.z) < 1.15) collectPickup(p);
    }
  }

  function collectPickup(p) {
    p.picked = true;
    p.group.visible = false;
    switch (p.type) {
      case 'weapon':
        addXP(95);
        showToast('FIELD CACHE // +95 XP', 2.0);
        break;
      case 'armor':
        state.armor = Math.min(3, state.armor + 2);
        showToast('ARMOR +2', 1.8);
        break;
      case 'health':
        state.health = state.maxHealth;
        showToast('VITALS RESTORED', 1.8);
        break;
      case 'grenade':
        state.grenades = Math.min(5, state.grenades + 2);
        showToast('GRENADES +2', 1.8);
        break;
      case 'spread':
        state.spreadTime = BALANCE.spread.duration;
        showToast(`${BALANCE.spread.name} // FIVE-WAY FIRE`, 2.0);
        break;
      case 'intel':
        state.intel++;
        state.score += 300;
        showToast(`INTEL ${state.intel}/${state.intelTotal}`, 1.8);
        break;
    }
    state.score += 150;
    audio.tone(620, 0.08, 'square', 0.035);
    input.rumble(0.2, 60);
  }

  function spawnExplosion(x, y, z, scale = 1, life = 0.44) {
    if (effects.length >= FX_CAP) return;
    const f = fxFree.pop() || {};
    f.x = x;
    f.y = y;
    f.z = z;
    f.scale = scale;
    f.life = life;
    f.age = 0;
    f.rot = Math.random() * 6.28;
    effects.push(f);
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const f = effects[i];
      f.age += dt;
      if (f.age >= f.life) dropFrom(effects, i, fxFree);
    }
  }

  function updateObjectives() {
    const cps = M.checkpoints;
    for (let i = 0; i < cps.length; i++) if (player.x > cps[i].at && cps[i].x > state.checkpointX) activateCheckpoint(i);
    const objs = M.objectives;
    if (!state.bossDead) {
      while (state.objectiveStage + 1 < objs.length && player.x > objs[state.objectiveStage + 1].at) {
        state.objectiveStage++;
        const toast = objs[state.objectiveStage].toast;
        if (toast) showToast(toast, 2.4);
      }
      if (!state.bossTriggered && state.objectiveStage === objs.length - 1 && player.x > M.bossAt) triggerBoss();
    }
    if (state.bossDead && player.x > M.finishAt && !state.complete) finishMission();
  }

  function triggerBoss() {
    state.bossTriggered = true;
    showToast(M.bossToast, 2.6);
    letterbox(0.9);
    state.cameraShake = 0.2;
    input.rumble(0.4, 200);
    if (bossEnemy?.type === 'walker') {
      bossEnemy.stompCd = 1.5;
      bossEnemy.lobCd = 2.0;
    }
  }

  function activateCheckpoint(i) {
    const cp = M.checkpoints[i];
    state.checkpointX = cp.x;
    state.checkpointIndex = i;
    state.health = Math.min(state.maxHealth, state.health + 1);
    if (beacons[i]) beacons[i].activated = true;
    showToast('CHECKPOINT // VITAL +1', 1.8);
    audio.tone(660, 0.1, 'square', 0.03);
    events.onCheckpoint?.(snapshot());
  }

  function finishMission() {
    state.complete = true;
    state.timeBonus = Math.max(0, Math.round(2000 - state.elapsed * 8 * (150 / M.par)));
    state.score += state.timeBonus;
    setLetterbox(true);
    state.letterbox = Infinity;
    audio.tone(440, 0.14, 'square', 0.05);
    setTimeout(() => audio.tone(660, 0.18, 'square', 0.05), 130);
    setTimeout(() => audio.tone(880, 0.25, 'square', 0.05), 280);
    input.rumble(0.5, 200);
    state.completeTimer = 0.9;
  }

  function results() {
    const t = state.elapsed;
    const rank = state.deaths === 0 && t <= M.par ? 'S' : state.deaths <= 1 && t <= M.par * 1.4 ? 'A' : state.deaths <= 3 ? 'B' : 'C';
    return {
      index: missionIndex,
      id: M.id,
      name: M.name,
      title: M.completeTitle,
      difficulty: D.id,
      difficultyLabel: D.label,
      time: t,
      score: state.score,
      bonus: state.timeBonus,
      kills: state.kills,
      total: enemies.length,
      accuracy: state.shots ? Math.round((state.hits / state.shots) * 100) : 0,
      intel: state.intel,
      intelTotal: state.intelTotal,
      deaths: state.deaths,
      weapon: BALANCE.weapons[state.level - 1].name,
      rank,
    };
  }

  function animateWorld(dt, t) {
    for (const b of beacons) {
      b.orb.rotation.y += dt * (b.activated ? 3 : 1.1);
      b.orb.scale.setScalar((b.activated ? 1.25 : 1) + Math.sin(t * 3 + b.x) * 0.08);
    }
    if (gate.door && state.bossDead) gate.door.position.y = Math.min(gate.openY, gate.door.position.y + dt * 3.6);
    if (mist) {
      const a = mist.pts.positions.array;
      for (let i = 0; i < mist.n; i++) {
        const k = i * 3;
        let y = a[k + 1] + dt * mist.speed[i] * 1.2;
        a[k + 2] += dt * 0.4 * mist.speed[i];
        if (y > 3.2 || a[k + 2] > mist.z + 4.2) {
          y = 0.1;
          a[k] = mist.x + (Math.random() - 0.5) * mist.w;
          a[k + 2] = mist.z + 0.4 + Math.random();
        }
        a[k + 1] = y;
      }
      mist.pts.positions.needsUpdate = true;
    }
  }

  function updateCamera(dt) {
    state.cameraShake = Math.max(0, state.cameraShake - dt * 1.7);
    const lookAhead = state.complete ? 1.0 : 3.2;
    const zoom = state.zoom;
    camGoal.set(player.x + lookAhead + 0.4, 6.2 * zoom + Math.min(1.2, player.y * 0.18), 11.2 * zoom + player.z * 0.28);
    camera.position.lerp(camGoal, 1 - Math.exp(-dt * 5.5));
    if (state.cameraShake > 0) {
      const s = state.cameraShake;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(player.x + 2.0, 1.65 + player.y * 0.18, player.z * 0.38);
    sun.position.set(player.x + 12, 28, 14);
    sun.target.position.set(player.x, 0, 0);
  }

  // ---------------------------------------------------------------- drawing the pools
  function drawBullets(mesh, list) {
    const n = Math.min(list.length, BULLET_CAP);
    for (let i = 0; i < n; i++) {
      const b = list[i];
      _p.set(b.x, b.y, b.z);
      _s.set(b.len, 1, 1);
      _m.compose(_p, b.q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = n;
    if (n) mesh.instanceMatrix.needsUpdate = true;
  }

  function drawDynamic() {
    drawBullets(pBulletMesh, playerBullets);
    drawBullets(eBulletMesh, enemyBullets);

    let n = 0;
    for (const g of grenades) {
      _e.set(g.rx, 0, g.rz);
      _q.setFromEuler(_e);
      _p.set(g.x, g.y, g.z);
      _m.compose(_p, _q, ONE);
      grenadeMesh.setMatrixAt(n++, _m);
    }
    grenadeMesh.count = n;
    if (n) grenadeMesh.instanceMatrix.needsUpdate = true;

    n = 0;
    for (const s of shells) {
      _e.set(s.spin, s.spin * 0.7, 0);
      _q.setFromEuler(_e);
      _p.set(s.x, s.y, s.z);
      _m.compose(_p, _q, ONE);
      shellMesh.setMatrixAt(n, _m);
      _q.identity();
      _p.set(s.tx, s.ty + 0.05, s.tz);
      _s.setScalar(s.blast * (0.45 + 0.55 * Math.min(1, s.t)));
      _m.compose(_p, _q, _s);
      markerMesh.setMatrixAt(n, _m);
      n++;
    }
    shellMesh.count = markerMesh.count = n;
    if (n) shellMesh.instanceMatrix.needsUpdate = markerMesh.instanceMatrix.needsUpdate = true;

    n = 0;
    const fa = fxFlash.userData.fade;
    const ra = fxRing.userData.fade;
    for (const f of effects) {
      const k = f.age / f.life;
      _p.set(f.x, f.y, f.z);
      _e.set(0, f.rot + f.age * 7, 0);
      _q.setFromEuler(_e);
      _s.setScalar(f.scale * (0.45 + k * 1.75));
      _m.compose(_p, _q, _s);
      fxFlash.setMatrixAt(n, _m);
      _e.set(Math.PI / 2, 0, f.age * 2);
      _q.setFromEuler(_e);
      _s.setScalar(f.scale * (0.5 + k * 2.3));
      _m.compose(_p, _q, _s);
      fxRing.setMatrixAt(n, _m);
      fa.array[n] = ra.array[n] = Math.max(0, 1 - k);
      n++;
    }
    fxFlash.count = fxRing.count = n;
    if (n) {
      fxFlash.instanceMatrix.needsUpdate = fxRing.instanceMatrix.needsUpdate = true;
      fa.needsUpdate = ra.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- HUD (DOM writes only on change)
  const hudCache = {};
  const setText = (el, key, v) => {
    if (hudCache[key] !== v) {
      hudCache[key] = v;
      el.textContent = v;
    }
  };
  const setBar = (el, key, v) => {
    v = Math.round(v * 500) / 500;
    if (hudCache[key] !== v) {
      hudCache[key] = v;
      el.style.transform = `scaleX(${v})`;
    }
  };
  const setHidden = (el, key, hidden) => {
    if (hudCache[key] !== hidden) {
      hudCache[key] = hidden;
      el.classList.toggle('hidden', hidden);
    }
  };

  function updateHud() {
    setText(ui.healthText, 'hp', `${state.health}/${state.maxHealth}`);
    setBar(ui.healthBar, 'hpBar', clamp(state.health / state.maxHealth, 0, 1));
    setText(ui.armorText, 'armor', String(state.armor));
    setText(ui.intelText, 'intel', `${state.intel}/${state.intelTotal}`);
    setText(ui.grenadeText, 'gren', String(state.grenades));
    setText(ui.scoreText, 'score', String(state.score).padStart(6, '0'));
    setText(ui.levelText, 'lv', `LV ${state.level}`);
    const a = BALANCE.xpThresholds[state.level - 1];
    const b = BALANCE.xpThresholds[Math.min(state.level, BALANCE.xpThresholds.length - 1)] || a + 1;
    setBar(ui.xpBar, 'xp', state.level >= 3 ? 1 : clamp((state.xp - a) / (b - a), 0, 1));
    const objs = M.objectives;
    setText(ui.objective, 'obj', state.complete ? OBJECTIVE_DONE : state.objectiveStage < objs.length ? objs[state.objectiveStage].text : M.extractText);
    const fan = state.spreadTime > 0;
    setHidden(ui.powerTag, 'fanShown', !fan);
    if (fan) setText(ui.powerTag, 'fan', `${BALANCE.spread.name} ${Math.ceil(state.spreadTime)}s`);
    const bossOn = !!bossEnemy && state.bossTriggered && !state.bossDead;
    setHidden(ui.bossRow, 'bossShown', !bossOn);
    if (bossOn) {
      setText(ui.bossName, 'bossName', M.bossName);
      setBar(ui.bossBar, 'bossBar', clamp(bossEnemy.hp / bossEnemy.maxHp, 0, 1));
    }
    if (kit.touch && hudCache.touchGren !== state.grenades) {
      hudCache.touchGren = state.grenades;
      kit.touch.setLabel('grenade', `GREN ${state.grenades}`);
    }
  }

  function showToast(text, seconds = 1.8) {
    ui.toast.textContent = text;
    ui.toast.classList.remove('hidden');
    state.toastTimer = seconds;
  }

  function setLetterbox(on) {
    ui.letterboxTop.classList.toggle('active', on);
    ui.letterboxBottom.classList.toggle('active', on);
  }
  function letterbox(seconds) {
    setLetterbox(true);
    state.letterbox = Math.max(state.letterbox, seconds);
  }

  function tickTimers(dt) {
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) ui.toast.classList.add('hidden');
    }
    if (state.flash > 0) {
      state.flash -= dt;
      if (state.flash <= 0) ui.damageFlash.classList.remove('active');
    }
    if (state.letterbox > 0) {
      state.letterbox -= dt;
      if (state.letterbox <= 0) setLetterbox(false);
    }
  }

  return {
    state,
    load,
    warm,
    begin,
    update,
    idle,
    snapshot,
    render: () => post.render(),
    get missionIndex() {
      return missionIndex;
    },
    get mission() {
      return M;
    },
    get difficulty() {
      return D;
    },
  };
}
