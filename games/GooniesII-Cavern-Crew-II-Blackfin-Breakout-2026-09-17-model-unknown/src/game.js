import * as THREE from 'three/webgpu';
import {
  GAME_TITLE,
  LEVEL,
  BALANCE,
  DIFFICULTY,
  DIFFICULTY_ORDER,
  WALL_H,
  floorHeightAt,
  rampHeight,
  circleHitsAabb,
  isWetAt
} from './level.js';
import { SoundBoard } from './audio.js';
import { createMaterials, StaticBatch, m4, makeSignAtlas, createKid, createEnemy, buildCage } from './models.js';

/** Input actions, following the wall's standard bindings. Passed to boot() by main.js. */
export const INPUT = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  fire: { keys: ['Space', 'KeyF', 'KeyJ'], mouse: [0], gamepad: ['A', 'RT'], touch: 'SHOT' },
  use: { keys: ['KeyE', 'Enter'], gamepad: ['X', 'Y'], touch: 'USE' },
  dash: { keys: ['ShiftLeft', 'ShiftRight', 'KeyK'], gamepad: ['B', 'LT'], touch: 'DASH' },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
  turn: { type: 'axis', keys: { pos: ['KeyR'], neg: ['KeyQ'] } },
  mute: { keys: ['KeyM'] }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const TAU = Math.PI * 2;
const wrapAngle = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const SAVE_KEY = 'cavern-crew-2:save';
const BEST_KEY = 'cavern-crew-2:best';
const DIFF_KEY = 'cavern-crew-2:difficulty';
const diffKey = (k) => (DIFFICULTY[k] ? k : 'normal');
const store = {
  get(k) {
    try {
      const s = localStorage.getItem(k);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage full or blocked: the run just isn't saved */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

// Camera defaults. The original yaw looked back along the route (east was "down" the screen);
// the camera now starts behind the player, looking east into the caves.
const DEFAULT_YAW = -Math.PI * 0.35;
const DEFAULT_PITCH = Math.atan(0.72);
const PITCH_MIN = 0.34;
const PITCH_MAX = 1.12;
const RADIUS_PER_DIST = Math.hypot(1, 0.72);
const SHADOW_HALF = 28;

const PROMPT_KEYS = { keyboard: 'E', gamepad: 'X', touch: 'USE' };
const SHOT_KEYS = { keyboard: 'Space / click', gamepad: 'A', touch: 'SHOT' };

export async function startGame(kit) {
  const { renderer, input } = kit;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label', `${GAME_TITLE} game view`);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071117);
  scene.fog = new THREE.FogExp2(0x071117, 0.022);
  const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 800;
  const camera = kit.fitCamera(new THREE.PerspectiveCamera(57, 1, 0.1, 120));
  const sound = new SoundBoard();
  const materials = createMaterials();

  kit.loading.progress(0.65, 'Carving the caves…');

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0x7091a6, 0x25180f, 1.55));
  const key = new THREE.DirectionalLight(0xffd8a3, 2.7);
  key.castShadow = true;
  kit.shadow(key, 2048);
  Object.assign(key.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 80 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  // The key light keeps its original direction but its shadow box follows the player (snapped to
  // shadow texels so edges don't shimmer), so the whole cave gets sharp shadows, not just the middle.
  const LIGHT_OFFSET = new THREE.Vector3(-12, 24, 14);
  const lf = LIGHT_OFFSET.clone().negate().normalize();
  const lr = new THREE.Vector3().crossVectors(lf, new THREE.Vector3(0, 1, 0)).normalize();
  const lu = new THREE.Vector3().crossVectors(lr, lf).normalize();
  function followShadow(center) {
    const texel = (2 * SHADOW_HALF) / Math.max(256, key.shadow.mapSize.x);
    const a = Math.round(center.dot(lr) / texel) * texel;
    const b = Math.round(center.dot(lu) / texel) * texel;
    const c = center.dot(lf);
    key.target.position.set(0, 0, 0).addScaledVector(lr, a).addScaledVector(lu, b).addScaledVector(lf, c);
    key.position.copy(key.target.position).add(LIGHT_OFFSET);
  }

  const batch = new StaticBatch();
  const torchPositions = [
    [-4, 5, 2.0], [19, -4, 2.0], [31, 6, 2.1], [20, 25, 1.2],
    [32, 31, 1.2], [18, -34, 5.0], [35, -34, 5.0], [48, 1.8, 2.0], [65, -6, 2.0], [72, 5, 2.0],
    [55, 37, 1.2]
  ];
  const torches = [];
  const flameGeo = new THREE.OctahedronGeometry(0.16, 0);
  torchPositions.forEach(([x, z, y], i) => {
    const light = new THREE.PointLight(i % 3 === 0 ? 0xffb04f : 0xff7848, 30, 10, 2);
    light.position.set(x, y, z);
    scene.add(light);
    torches.push({ light, base: 30, seed: hash01(`torch-${i}`) * 10 });
    batch.add(flameGeo, materials.flame, m4(x, y, z, 0, 0, 0, 1, 1.5, 1), { cast: false, receive: false });
  });

  const world = new THREE.Group();
  scene.add(world);

  // ---------------------------------------------------------------- static level geometry
  let pumpWater = null;
  const pumpFloor = LEVEL.floors.find((f) => f.drains);
  for (const f of LEVEL.floors) {
    if (f.ramp) {
      // Solid steps whose tops follow the walkable ramp (the old steps were built back to front).
      const steps = 10;
      const r = f.ramp;
      const base = Math.min(r.y0, r.y1);
      const stepD = f.d / steps + 0.04;
      for (let i = 0; i < steps; i++) {
        const z = f.z - f.d / 2 + (f.d / steps) * (i + 0.5);
        const top = rampHeight(r, f.x, z);
        const h = top - base + 0.36;
        batch.add(new THREE.BoxGeometry(f.w, h, stepD), materials.floorAlt, m4(f.x, top - h / 2, z), { cast: false });
      }
      continue;
    }
    const material = f.water ? materials.wetFloor : hash01(f.id) > 0.45 ? materials.floorAlt : materials.floor;
    batch.add(new THREE.BoxGeometry(f.w, 0.45, f.d), material, m4(f.x, f.y - 0.23, f.z), { cast: false });
    if (f.water) {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(f.w - 0.6, f.d - 0.6, 24, 18), materials.water);
      water.rotation.x = -Math.PI / 2;
      water.position.set(f.x, f.y + 0.34, f.z);
      water.userData.baseY = water.position.y;
      world.add(water);
      if (f.drains) pumpWater = water;
    }
  }

  // Walls with chunky rock caps (the gate and the cracked wall are built separately below).
  for (const w of LEVEL.walls) {
    if (w.dynamic) continue;
    const h = w.h || WALL_H;
    batch.add(new THREE.BoxGeometry(w.w, h, w.d), hash01(w.id) > 0.5 ? materials.wall : materials.wallAlt, m4(w.x, w.y + h / 2, w.z));
    if (!w.low) {
      const rockCount = Math.max(1, Math.floor(Math.max(w.w, w.d) / 3.2));
      for (let i = 0; i < rockCount; i++) {
        const r = hash01(`${w.id}-rock-${i}`);
        const alongX = w.w > w.d;
        const px = alongX ? w.x - w.w / 2 + ((i + 0.5) * w.w) / rockCount : w.x + (r - 0.5) * 0.4;
        const pz = alongX ? w.z + (r - 0.5) * 0.4 : w.z - w.d / 2 + ((i + 0.5) * w.d) / rockCount;
        batch.add(new THREE.DodecahedronGeometry(0.55 + r * 0.45, 0), materials.wallAlt, m4(px, w.y + h + 0.15 + r * 0.3, pz, r * 2, r * 4, r * 3));
      }
    }
  }

  // Rock spikes along the walls.
  const rockGeo = new THREE.ConeGeometry(0.42, 1.5, 5);
  for (const w of LEVEL.walls) {
    if (w.low || w.dynamic) continue;
    const n = Math.min(4, Math.max(1, Math.floor(Math.max(w.w, w.d) / 5)));
    for (let i = 0; i < n; i++) {
      const r = hash01(`spike-${w.id}-${i}`);
      const x = w.w > w.d ? w.x - w.w / 2 + ((i + 0.5) * w.w) / n : w.x + (r - 0.5) * 1.2;
      const z = w.w > w.d ? w.z + (r - 0.5) * 1.2 : w.z - w.d / 2 + ((i + 0.5) * w.d) / n;
      batch.add(rockGeo, materials.wallAlt, m4(x, w.y + 0.65, z, 0, r * TAU, 0, 0.6 + r * 0.9, 0.6 + r * 1.5, 0.6 + r * 0.9));
    }
  }

  const railBase = new THREE.BoxGeometry(1, 0.16, 1);
  const postGeo = new THREE.BoxGeometry(0.16, 1, 0.16);
  for (const r of LEVEL.rails) {
    batch.add(railBase, materials.rail, m4(r.x, r.y + 0.28, r.z, 0, 0, 0, r.w, 1, r.d));
    const alongX = r.w > r.d;
    const len = alongX ? r.w : r.d;
    const posts = Math.ceil(len / 2.5);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts - 0.5;
      batch.add(postGeo, materials.rail, m4(alongX ? r.x + t * r.w : r.x, r.y + r.h / 2, alongX ? r.z : r.z + t * r.d, 0, 0, 0, 1, r.h, 1));
    }
    batch.add(railBase, materials.rail, m4(r.x, r.y + r.h, r.z, 0, 0, 0, alongX ? r.w : 0.18, 1, alongX ? 0.18 : r.d));
  }

  // Rope-bridge planks.
  const plankGeo = new THREE.BoxGeometry(0.88, 0.16, 4.15);
  for (let i = 0; i < 15; i++) {
    batch.add(plankGeo, i % 2 ? materials.wood : materials.darkWood, m4(44.4 + i * 1.02, 0.18 + Math.sin(i * 1.7) * 0.06, 0, 0, 0, Math.sin(i * 2.1) * 0.018));
  }

  // Props.
  const breakables = new Map();
  const crateBox = new THREE.BoxGeometry(1.15, 1.05, 1.15);
  const crateBand = new THREE.BoxGeometry(1.19, 0.12, 1.19);
  function addPart(geo, material, x, y, z, parent, cast = true) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  for (const p of LEVEL.props) {
    if (p.type === 'crate') {
      const g = new THREE.Group();
      addPart(crateBox, materials.wood, 0, 0.53, 0, g);
      addPart(crateBand, materials.darkWood, 0, 0.27, 0, g);
      addPart(crateBand, materials.darkWood, 0, 0.78, 0, g);
      g.position.set(p.x, p.y, p.z);
      g.userData.prop = p;
      breakables.set(p.id, g);
      world.add(g);
    } else if (p.type === 'barrel') {
      batch.add(new THREE.CylinderGeometry(0.46, 0.5, 1.0, 8), materials.rust, m4(p.x, p.y + 0.5, p.z, 0, hash01(p.id) * 3, 0));
    } else if (p.type === 'wreck') {
      const G = m4(p.x, p.y, p.z);
      batch.add(new THREE.BoxGeometry(4.4, 0.65, 1.5), materials.darkWood, G.clone().multiply(m4(0, 0.15, 0, 0, -0.45, 0)));
      batch.add(new THREE.CylinderGeometry(0.08, 0.12, 3.1, 6), materials.wood, G.clone().multiply(m4(0.7, 1.4, 0, 0, 0, 0.35)));
    } else if (p.type === 'island') {
      batch.add(new THREE.CylinderGeometry(2.4, 2.7, 0.42, 7), materials.floorAlt, m4(p.x, p.y + 0.14, p.z, 0, 0.22, 0, 1, 1, 0.82));
    } else if (p.type === 'treasure') {
      const G = m4(p.x, p.y, p.z, 0, 0.3, 0);
      batch.add(new THREE.BoxGeometry(2.2, 0.75, 1.25), materials.darkWood, G.clone().multiply(m4(0, 0.38, 0)));
      batch.add(new THREE.BoxGeometry(2.25, 0.18, 1.3), materials.gold, G.clone().multiply(m4(0, 0.84, 0)));
    } else if (p.type === 'pump') {
      // The old smugglers' pump: a rusty block with a flywheel and a tall pipe.
      const G = m4(p.x, p.y, p.z);
      batch.add(new THREE.BoxGeometry(3.0, 1.3, 1.2), materials.rust, G.clone().multiply(m4(0, 0.65, 0)));
      batch.add(new THREE.CylinderGeometry(0.62, 0.62, 0.2, 12), materials.metal, G.clone().multiply(m4(-1.65, 0.9, 0, 0, 0, Math.PI / 2)));
      batch.add(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 8), materials.metal, G.clone().multiply(m4(0.9, 2.5, -0.2)));
      batch.add(new THREE.BoxGeometry(0.9, 0.24, 0.9), materials.darkWood, G.clone().multiply(m4(-0.4, 1.42, 0)));
    } else if (p.type === 'pipes') {
      // Pipes running along the pump room's north and south walls.
      const pipe = new THREE.CylinderGeometry(0.16, 0.16, 1, 8);
      batch.add(pipe, materials.metal, m4(p.x - 3.5, p.y + 2.3, p.z - 6.3, 0, 0, Math.PI / 2, 1, 7, 1));
      batch.add(pipe, materials.rust, m4(p.x + 1.5, p.y + 1.8, p.z + 6.3, 0, 0, Math.PI / 2, 1, 12, 1));
      batch.add(pipe, materials.metal, m4(p.x + 7.3, p.y + 1.6, p.z, Math.PI / 2, 0, 0, 1, 11, 1));
    }
  }

  // Signs: one atlas texture, text on both faces so it never reads mirrored.
  const signAtlas = makeSignAtlas(LEVEL.signs.map((s) => s.text));
  const signPost = new THREE.BoxGeometry(0.12, 1.6, 0.12);
  LEVEL.signs.forEach((s, i) => {
    const plane = signAtlas.planeFor(i, 2.9, 0.72);
    batch.add(plane, signAtlas.material, m4(s.x, s.y + 1.62, s.z + 0.07), { cast: false, receive: false });
    batch.add(plane, signAtlas.material, m4(s.x, s.y + 1.62, s.z - 0.07, 0, Math.PI, 0), { cast: false, receive: false });
    batch.add(signPost, materials.wood, m4(s.x, s.y + 0.8, s.z));
  });

  // ---------------------------------------------------------------- interactables
  const interactableObjects = new Map();
  let rescueNpc = null;
  let rescueCage = [];
  let dexNpc = null;
  let dexCage = [];
  let dexLock = null;
  const valves = new Map();
  const sealGeo = { ring: new THREE.TorusGeometry(0.43, 0.14, 6, 12), core: new THREE.OctahedronGeometry(0.26, 0) };
  const valveGeo = {
    pipe: new THREE.CylinderGeometry(0.11, 0.11, 0.8, 8),
    wheel: new THREE.TorusGeometry(0.34, 0.06, 6, 14),
    spoke: new THREE.BoxGeometry(0.62, 0.06, 0.06),
    bulb: new THREE.OctahedronGeometry(0.12, 0)
  };
  for (const it of LEVEL.interactables) {
    const g = new THREE.Group();
    if (it.type === 'locker') {
      addPart(new THREE.BoxGeometry(1.25, 2.0, 0.75), materials.orange, 0, 1, 0, g);
      addPart(new THREE.BoxGeometry(0.16, 0.65, 0.82), materials.metal, 0.48, 1.05, 0, g);
    } else if (it.type === 'seal') {
      const ring = addPart(sealGeo.ring, materials.gold, 0, 1.0, 0, g);
      ring.rotation.x = Math.PI / 2;
      addPart(sealGeo.core, it.seal === 'Tide' ? materials.cyan : it.seal === 'Echo' ? materials.red : materials.gold, 0, 1.0, 0, g);
      g.userData.spin = true;
    } else if (it.type === 'workbench') {
      addPart(new THREE.BoxGeometry(2.6, 0.3, 1.2), materials.wood, 0, 0.9, 0, g);
      addPart(new THREE.BoxGeometry(0.18, 0.9, 0.18), materials.metal, -1.0, 0.45, -0.38, g);
      addPart(new THREE.BoxGeometry(0.18, 0.9, 0.18), materials.metal, 1.0, 0.45, -0.38, g);
      addPart(new THREE.BoxGeometry(0.8, 0.12, 0.4), materials.orange, 0.4, 1.13, 0, g);
    } else if (it.type === 'gate') {
      addPart(new THREE.BoxGeometry(0.65, 1.25, 0.65), materials.rust, 0, 0.62, 0, g);
      addPart(new THREE.OctahedronGeometry(0.22, 0), materials.gold, 0, 1.35, 0, g);
    } else if (it.type === 'rescue') {
      rescueCage = buildCage(materials, g);
      rescueNpc = createKid(materials, { shirt: 0xb34c68, cap: 0xd6b85d, backpack: 0x4c5d45, scale: 0.9 });
      g.add(rescueNpc);
    } else if (it.type === 'crew') {
      dexCage = buildCage(materials, g);
      dexLock = addPart(new THREE.BoxGeometry(0.34, 0.4, 0.16), materials.gold, 0, 1.2, -1.45, g);
      dexCage.push(dexLock);
      dexNpc = createKid(materials, { shirt: 0x5d8f4a, cap: 0x2f4f7a, backpack: 0x6b4a2b, scale: 0.92 });
      dexNpc.rotation.y = Math.PI;
      g.add(dexNpc);
    } else if (it.type === 'valve') {
      const pipe = addPart(valveGeo.pipe, materials.metal, 0, 1.0, -0.4, g);
      pipe.rotation.x = Math.PI / 2;
      const wheel = new THREE.Group();
      wheel.position.set(0, 1.0, 0.02);
      g.add(wheel);
      addPart(valveGeo.wheel, materials.rust, 0, 0, 0, wheel);
      addPart(valveGeo.spoke, materials.rust, 0, 0, 0, wheel);
      addPart(valveGeo.spoke, materials.rust, 0, 0, 0, wheel).rotation.z = Math.PI / 2;
      const bulb = addPart(valveGeo.bulb, materials.alarm, 0, 1.62, -0.3, g, false);
      g.rotation.y = it.facing || 0;
      valves.set(it.id, { it, wheel, bulb, spin: 0 });
    }
    g.position.set(it.x, it.y, it.z);
    g.userData.interactable = it;
    interactableObjects.set(it.id, g);
    world.add(g);
  }

  // Gate bars, separate from the console.
  const gateWall = LEVEL.walls.find((w) => w.id === LEVEL.gateId);
  const gateVisual = new THREE.Group();
  for (let i = -2; i <= 2; i++) addPart(new THREE.BoxGeometry(0.22, 3.0, 0.22), materials.metal, 0, 1.5, i * 1.0, gateVisual);
  addPart(new THREE.BoxGeometry(0.3, 0.25, 5.0), materials.rust, 0, 2.8, 0, gateVisual);
  gateVisual.position.set(gateWall.x, gateWall.y, gateWall.z);
  world.add(gateVisual);

  // The cracked wall: lighter rock with crack seams, breaks after a few sling hits.
  const crackedWall = LEVEL.walls.find((w) => w.id === LEVEL.crackedId);
  const crackGroup = new THREE.Group();
  {
    const w = crackedWall;
    addPart(new THREE.BoxGeometry(w.w, w.h, w.d), materials.crackRock, 0, w.h / 2, 0, crackGroup);
    const seam = new THREE.BoxGeometry(0.06, 0.9, 0.12);
    const seams = [[-0.95, 1.1, 0.5], [-0.4, 1.7, -0.6], [0.3, 1.2, 0.4], [0.9, 2.0, -0.3], [1.5, 0.9, 0.7], [-1.6, 2.3, 0.2]];
    for (const [z, y, rot] of seams) {
      for (const side of [-1, 1]) {
        const s = addPart(seam, materials.black, side * (w.w / 2 + 0.01), y, z, crackGroup, false);
        s.rotation.x = rot;
      }
    }
    for (let i = 0; i < 3; i++) {
      addPart(new THREE.DodecahedronGeometry(0.5 + i * 0.12, 0), materials.wallAlt, 0, w.h + 0.2, -1.6 + i * 1.6, crackGroup).rotation.set(i, i * 2, i * 3);
    }
    crackGroup.position.set(w.x, w.y, w.z);
    world.add(crackGroup);
  }

  // Pickups.
  const pickupObjects = new Map();
  const pickupGeo = {
    gem: new THREE.OctahedronGeometry(0.32, 0),
    heal: new THREE.BoxGeometry(0.45, 0.25, 0.45),
    crossV: new THREE.BoxGeometry(0.12, 0.46, 0.12),
    crossH: new THREE.BoxGeometry(0.36, 0.12, 0.12)
  };
  for (const p of LEVEL.pickups) {
    const g = new THREE.Group();
    let material = materials.cyan;
    if (p.type === 'heal') material = materials.red;
    if (p.type === 'scrap') material = materials.metal;
    if (p.type === 'gear') material = p.gear === 'boots' ? materials.orange : materials.gold;
    addPart(p.type === 'heal' ? pickupGeo.heal : pickupGeo.gem, material, 0, 0.45, 0, g);
    if (p.type === 'heal') {
      addPart(pickupGeo.crossV, materials.white, 0, 0.45, 0.23, g);
      addPart(pickupGeo.crossH, materials.white, 0, 0.45, 0.23, g);
    }
    g.position.set(p.x, p.y, p.z);
    g.userData.pickup = p;
    g.userData.baseY = p.y;
    g.userData.phase = hash01(p.id) * 6;
    pickupObjects.set(p.id, g);
    world.add(g);
  }

  // Hazards.
  const hazardObjects = new Map();
  const spikeBed = (() => {
    const cone = new THREE.ConeGeometry(0.16, 0.65, 4);
    const tmp = new StaticBatch();
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) tmp.add(cone, materials.metal, m4(ix * 0.42, 0.25, iz * 0.32));
    const [mesh] = tmp.build(new THREE.Group());
    return mesh.geometry;
  })();
  const steamGeo = new THREE.CylinderGeometry(0.32, 0.62, 2.4, 10, 1, true);
  steamGeo.translate(0, 1.2, 0);
  const ventGeo = new THREE.CylinderGeometry(0.62, 0.7, 0.14, 10);
  const ventGrate = new THREE.BoxGeometry(1.1, 0.04, 0.12);
  for (const h of LEVEL.hazards) {
    const g = new THREE.Group();
    if (h.type === 'spikes') {
      addPart(spikeBed, materials.metal, 0, 0, 0, g);
      g.position.set(h.x, h.y - 0.48, h.z);
    } else if (h.type === 'pendulum') {
      addPart(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), materials.metal, 0, 2.5, 0, g);
      addPart(new THREE.DodecahedronGeometry(h.radius, 1), materials.rust, 0, 0.75, 0, g);
      g.position.set(h.x, h.y, h.z);
    } else if (h.type === 'steam') {
      addPart(ventGeo, materials.black, 0, 0.07, 0, g, false);
      for (let i = -1; i <= 1; i++) addPart(ventGrate, materials.metal, 0, 0.15, i * 0.26, g, false);
      const column = new THREE.Mesh(steamGeo, materials.steam);
      column.scale.set(1, 0.05, 1);
      column.renderOrder = 2;
      g.add(column);
      g.userData.column = column;
      g.userData.wasOn = false;
      g.position.set(h.x, h.y, h.z);
    }
    g.userData.hazard = h;
    hazardObjects.set(h.id, g);
    world.add(g);
  }

  // ---------------------------------------------------------------- player
  const player = createKid(materials, { shirt: 0x3e7898, cap: 0xd36b38, backpack: 0x8a5e31, scale: 1.0 });
  scene.add(player);
  const playerParts = player.userData.parts;
  const lamp = new THREE.SpotLight(0xffdf9d, 48, 13, Math.PI / 5, 0.55, 1.6);
  lamp.position.set(0, 1.55, 0);
  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0, 1.0, 4);
  player.add(lamp, lampTarget);
  lamp.target = lampTarget;

  // ---------------------------------------------------------------- enemies
  const enemies = [];
  for (const e of LEVEL.enemies) {
    const g = createEnemy(materials, e);
    g.position.set(e.x, e.y, e.z);
    world.add(g);
    enemies.push({
      ...e,
      group: g,
      hpNow: e.hp,
      alive: true,
      attackCd: 0,
      stun: 0,
      punch: 0,
      spitCd: 1.2 + hash01(e.id) * 1.2,
      windup: 0,
      homeX: e.x,
      homeZ: e.z,
      phase: hash01(e.id) * TAU,
      speed: e.type === 'bat' ? 2.8 : e.type === 'brute' ? 1.45 : e.type === 'crab' ? 1.85 : e.type === 'spitter' ? 1.25 : 2.15
    });
  }

  // ---------------------------------------------------------------- pools (no allocation mid-game)
  const stoneGeo = new THREE.IcosahedronGeometry(0.13, 1);
  const stones = [];
  for (let i = 0; i < 24; i++) {
    const mesh = new THREE.Mesh(stoneGeo, materials.gold);
    mesh.visible = false;
    world.add(mesh);
    stones.push({ mesh, dx: 0, dz: 0, life: 0, damage: 0, active: false });
  }
  const globGeo = new THREE.IcosahedronGeometry(0.2, 0);
  const globs = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(globGeo, materials.slime);
    mesh.visible = false;
    world.add(mesh);
    globs.push({ mesh, dx: 0, dz: 0, life: 0, active: false });
  }
  const chipGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const chips = [];
  for (let i = 0; i < 40; i++) {
    const mesh = new THREE.Mesh(chipGeo, materials.wood);
    mesh.visible = false;
    world.add(mesh);
    chips.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  let chipCursor = 0;
  function burst(x, y, z, count, material, power = 1) {
    for (let i = 0; i < count; i++) {
      const c = chips[chipCursor];
      chipCursor = (chipCursor + 1) % chips.length;
      c.mesh.material = material;
      c.mesh.position.set(x, y, z);
      c.mesh.visible = true;
      c.vx = (Math.random() - 0.5) * 4 * power;
      c.vy = (2 + Math.random() * 2) * power;
      c.vz = (Math.random() - 0.5) * 4 * power;
      c.life = 0.8;
    }
  }

  batch.build(world);

  // ---------------------------------------------------------------- state
  const freshState = (difficulty = 'normal') => ({
    mode: 'title', // title | play | pause | bench | complete
    difficulty: diffKey(difficulty),
    elapsed: 0,
    level: 1,
    xp: 0,
    hp: BALANCE.player.maxHp,
    scrap: 0,
    seals: new Set(),
    gear: { sling: false, boots: false, lamp: false, jacket: false, pouch: false },
    upgrades: { sling: 0 },
    kills: 0,
    crates: 0,
    deaths: 0,
    gateOpen: false,
    crackedOpen: false,
    crackedHp: crackedWall.hp || 3,
    valves: new Set(),
    dexFreed: false,
    checkpoint: { x: LEVEL.spawn.x, z: LEVEL.spawn.z },
    shotCooldown: 0,
    invuln: 0,
    dashCooldown: 0,
    dashTimer: 0,
    dashDir: { x: 0, z: 1 }
  });
  // The difficulty picked on the title screen (a saved run keeps its own).
  let chosenDifficulty = diffKey(store.get(DIFF_KEY));
  let state = freshState(chosenDifficulty);
  const diff = () => DIFFICULTY[state.difficulty];

  // Runtime values the functions below share. Declared up front: some of those functions
  // (syncControlsHelp, resetRun) run during startup, before the code that uses them per frame.
  let lastNearest;
  let mapDirty = true;
  let mapClock = 0;
  let pendingComplete = 0;
  let activeMenu = null;
  let focusIdx = 0;
  let navDir = 0;
  let navRepeat = 0;
  // A menu that just opened ignores confirm/back for a moment, so a button mashed in play
  // (A shoots on a gamepad) can't skip the results screen.
  let menuGrace = 0;
  let pendingFocus = null;
  let cameraYaw = DEFAULT_YAW;
  let cameraPitch = DEFAULT_PITCH;
  let cameraDistance = isMobile ? 10.4 : 11.8;
  let shake = 0;
  let crackShake = 0;
  let hurtFlash = 0;
  let throwAnim = 0;
  let walkPhase = 0;
  // Holding fire repeats shots; after a menu closes (A confirms on a gamepad) it waits for a fresh press.
  let fireArmed = true;
  const camTarget = new THREE.Vector3(player.position.x, player.position.y + 1, player.position.z);
  const camDesired = new THREE.Vector3();
  const camDir = new THREE.Vector3();

  let activeBoxes = [];
  function rebuildBoxes() {
    activeBoxes = LEVEL.walls.filter((w) => !(w.dynamic === 'gate' && state.gateOpen) && !(w.dynamic === 'cracked' && state.crackedOpen));
    for (const r of LEVEL.rails) activeBoxes.push(r);
  }
  rebuildBoxes();

  // ---------------------------------------------------------------- UI
  const $ = (id) => document.getElementById(id);
  const ui = {
    title: $('title-screen'),
    start: $('start-button'),
    cont: $('continue-button'),
    difficulty: $('difficulty-button'),
    difficultyNote: $('difficulty-note'),
    titleSettings: $('title-settings'),
    best: $('title-best'),
    help: $('control-help'),
    hudLeft: document.querySelector('.hud-left'),
    hearts: $('hearts'),
    xpFill: $('xp-fill'),
    level: $('level-number'),
    scrap: $('scrap-count'),
    seals: $('seal-count'),
    objective: $('objective-text'),
    side: $('side-text'),
    prompt: $('prompt'),
    toast: $('toast'),
    backend: $('backend-badge'),
    mute: $('mute-button'),
    pauseButton: $('pause-button'),
    upgrade: $('upgrade-panel'),
    upgradeScrap: $('upgrade-scrap'),
    upgradeClose: $('upgrade-close'),
    pause: $('pause-screen'),
    pauseSummary: $('pause-summary'),
    resume: $('resume-button'),
    pauseSettings: $('pause-settings'),
    pauseSound: $('pause-sound'),
    pauseQuit: $('pause-quit'),
    complete: $('complete-screen'),
    completeStats: $('complete-stats'),
    completeNote: $('complete-note'),
    replay: $('replay-button'),
    toTitle: $('title-return'),
    minimap: $('minimap')
  };
  ui.backend.textContent = kit.backendLabel;

  const hudCache = new Map();
  const setText = (el, text) => {
    if (hudCache.get(el) === text) return;
    hudCache.set(el, text);
    el.textContent = text;
  };

  let toastTimer = 0;
  function toast(text, seconds = 2.1) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    toastTimer = seconds;
  }

  const maxHp = () => BALANCE.player.maxHp + (state.level - 1) * BALANCE.levelHpBonus + (state.gear.jacket ? 2 : 0) + diff().hpBonus;
  const damageAmount = () => BALANCE.player.baseDamage + (state.level - 1) * BALANCE.levelDamageBonus + state.upgrades.sling * BALANCE.slingUpgradeDamage;

  function objectiveText() {
    if (state.mode === 'complete') return 'Mara is safe. Mission complete.';
    if (!state.gear.sling) return 'Find the orange locker and take the sling-kit.';
    if (state.seals.size < 3) return `Find the three Blackfin seals. ${state.seals.size}/3 recovered.`;
    if (!state.gateOpen) return 'Return to the east gate and unlock it.';
    return 'Cross the rope bridge, clear the vault, and free Mara.';
  }
  function sideText() {
    if (!state.crackedOpen || state.dexFreed) return '';
    if (state.valves.size < 3) return `Side quest: turn the pump valves (${state.valves.size}/3) to free Dex.`;
    return 'Side quest: the cage lock is clear. Free Dex!';
  }

  function updateHud() {
    const mh = maxHp();
    const full = clamp(Math.round(state.hp), 0, mh);
    setText(ui.hearts, `${'◆'.repeat(full)}${'◇'.repeat(Math.max(0, mh - full))}`);
    setText(ui.level, String(state.level));
    setText(ui.scrap, String(state.scrap));
    setText(ui.seals, `${state.seals.size}/3`);
    setText(ui.objective, objectiveText());
    const side = sideText();
    setText(ui.side, side);
    ui.side.hidden = !side;
    const prev = BALANCE.xpThresholds[state.level - 1] ?? 0;
    const next = BALANCE.xpThresholds[state.level] ?? prev + 100;
    ui.xpFill.style.width = `${clamp((state.xp - prev) / Math.max(1, next - prev), 0, 1) * 100}%`;
    document.body.classList.toggle('has-sling', state.gear.sling);
  }

  function grantXp(amount) {
    state.xp += amount;
    while (state.level < BALANCE.maxLevel && state.xp >= BALANCE.xpThresholds[state.level]) {
      state.level += 1;
      state.hp = Math.min(maxHp(), state.hp + 1);
      toast(`LEVEL ${state.level} — tougher and stronger`);
      sound.level();
      input.rumble(0.3, 120);
    }
    updateHud();
  }

  // ---------------------------------------------------------------- save / best
  function saveProgress() {
    // Only a run in progress is saved; the title screen must never overwrite a saved run.
    if (state.mode !== 'play' && state.mode !== 'pause' && state.mode !== 'bench') return;
    store.set(SAVE_KEY, {
      v: 2,
      difficulty: state.difficulty,
      xp: state.xp,
      level: state.level,
      hp: state.hp,
      scrap: state.scrap,
      seals: [...state.seals],
      gear: { ...state.gear },
      upgrades: { ...state.upgrades },
      kills: state.kills,
      crates: state.crates,
      deaths: state.deaths,
      gateOpen: state.gateOpen,
      crackedOpen: state.crackedOpen,
      valves: [...state.valves],
      dexFreed: state.dexFreed,
      checkpoint: { ...state.checkpoint },
      elapsed: state.elapsed,
      broken: [...breakables].filter(([, g]) => !g.visible).map(([id]) => id),
      taken: [...pickupObjects].filter(([, g]) => !g.visible).map(([id]) => id),
      dead: enemies.filter((e) => !e.alive).map((e) => e.id)
    });
  }
  const loadSave = () => {
    const s = store.get(SAVE_KEY);
    return s && s.v === 2 ? s : null;
  };
  const loadBests = () => {
    const b = store.get(BEST_KEY);
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  };
  const bestFor = (difficulty) => {
    const b = loadBests()[difficulty];
    return b && Number.isFinite(b.time) && b.time > 0 ? b : null;
  };

  // ---------------------------------------------------------------- collision & movement
  function isBlockedAt(x, z, radius, currentY) {
    const f = floorHeightAt(x, z);
    if (!f) return true;
    if (Math.abs(f.y - currentY) > 0.75 && f.floor.kind !== 'ramp') return true;
    for (const b of activeBoxes) {
      if (Math.abs((b.y || 0) - f.y) > 1.6 && !b.low) continue;
      if (circleHitsAabb(x, z, radius, b)) return true;
    }
    return false;
  }

  function moveXZ(obj, dx, dz, radius) {
    const currentFloor = floorHeightAt(obj.position.x, obj.position.z);
    const cy = currentFloor?.y ?? obj.position.y;
    const nx = obj.position.x + dx;
    if (!isBlockedAt(nx, obj.position.z, radius, cy)) obj.position.x = nx;
    const nz = obj.position.z + dz;
    if (!isBlockedAt(obj.position.x, nz, radius, cy)) obj.position.z = nz;
    const floor = floorHeightAt(obj.position.x, obj.position.z);
    if (floor) obj.position.y = floor.y;
  }

  /** First wall the segment from `o` along unit `d` hits within maxDist (camera collision). */
  function rayBoxes(o, d, maxDist) {
    let best = maxDist;
    for (const b of activeBoxes) {
      if (b.dynamic === 'gate') continue;
      let tmin = -Infinity;
      let tmax = Infinity;
      const y0 = b.y || 0;
      const lo = [b.x - b.w / 2, y0, b.z - b.d / 2];
      const hi = [b.x + b.w / 2, y0 + (b.h ?? WALL_H), b.z + b.d / 2];
      let miss = false;
      for (let axis = 0; axis < 3; axis++) {
        const oa = axis === 0 ? o.x : axis === 1 ? o.y : o.z;
        const da = axis === 0 ? d.x : axis === 1 ? d.y : d.z;
        if (Math.abs(da) < 1e-8) {
          if (oa < lo[axis] || oa > hi[axis]) {
            miss = true;
            break;
          }
          continue;
        }
        let t1 = (lo[axis] - oa) / da;
        let t2 = (hi[axis] - oa) / da;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
      }
      // Skip misses, boxes behind, and boxes the target itself stands in.
      if (miss || tmax < tmin || tmin < 0) continue;
      if (tmin < best) best = tmin;
    }
    return best;
  }

  // ---------------------------------------------------------------- combat
  function damagePlayer(amount, sourceX, sourceZ) {
    if (state.invuln > 0 || state.mode !== 'play') return;
    state.hp -= amount;
    state.invuln = BALANCE.player.invulnSeconds;
    sound.hurt();
    input.rumble(0.6, 170);
    shake = Math.max(shake, 0.32);
    hurtFlash = 0.14;
    const dx = player.position.x - sourceX;
    const dz = player.position.z - sourceZ;
    const len = Math.hypot(dx, dz) || 1;
    moveXZ(player, (dx / len) * 0.65, (dz / len) * 0.65, BALANCE.player.radius);
    if (state.hp <= 0) respawn();
    updateHud();
  }

  function respawn() {
    state.deaths += 1;
    state.hp = maxHp();
    const loss = Math.min(state.scrap, diff().scrapLoss);
    state.scrap -= loss;
    state.dashTimer = 0;
    player.position.set(state.checkpoint.x, floorHeightAt(state.checkpoint.x, state.checkpoint.z)?.y ?? 0, state.checkpoint.z);
    snapCamera();
    state.invuln = 2.0;
    // Enemies that were chasing go home, so nothing camps the checkpoint.
    for (const e of enemies) {
      if (!e.alive) continue;
      e.group.position.set(e.homeX, e.y, e.homeZ);
      e.stun = 1.0;
      e.windup = 0;
    }
    for (const g of globs) {
      g.active = false;
      g.mesh.visible = false;
    }
    toast(loss ? `Back at the last safe spot. Lost ${loss} scrap.` : 'Back at the last safe spot.', 2.7);
    sound.fail();
    input.rumble(0.8, 260);
    saveProgress();
  }

  function destroyCrate(id) {
    const g = breakables.get(id);
    if (!g || !g.visible) return;
    g.visible = false;
    const p = g.userData.prop;
    state.scrap += p.scrap || 1;
    state.crates += 1;
    sound.pickup();
    input.rumble(0.25, 70);
    toast(`Crate cracked: +${p.scrap || 1} scrap`);
    burst(g.position.x, g.position.y + 0.6, g.position.z, 6, materials.wood);
    updateHud();
  }

  function killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    e.group.visible = false;
    state.kills += 1;
    burst(e.group.position.x, e.group.position.y + 0.6, e.group.position.z, 5, e.type === 'spitter' ? materials.moss : materials.black);
    grantXp(e.xp);
    if (hash01(`${e.id}-scrap`) > 0.38) {
      const bonus = e.type === 'brute' ? 4 : 1;
      state.scrap += bonus;
      toast(`${e.type === 'brute' ? 'Vault brute down' : 'Enemy down'}: +${e.xp} XP, +${bonus} scrap`);
    } else {
      toast(`Enemy down: +${e.xp} XP`);
    }
    sound.pickup();
    updateHud();
  }

  function hitCrackedWall(x, z) {
    if (state.crackedOpen) return;
    state.crackedHp -= 1;
    crackShake = 0.3;
    sound.knock();
    input.rumble(0.3, 90);
    burst(x, crackedWall.y + 1.1, z, 4, materials.crackRock, 0.8);
    if (state.crackedHp <= 0) breakCrackedWall(false);
    else toast(state.crackedHp >= (crackedWall.hp || 3) - 1 ? 'That rock sounds hollow…' : 'The cracks are spreading!', 1.6);
  }

  function breakCrackedWall(silent) {
    state.crackedOpen = true;
    crackGroup.visible = false;
    rebuildBoxes();
    mapDirty = true;
    if (silent) return;
    burst(crackedWall.x, crackedWall.y + 1.2, crackedWall.z - 1.2, 8, materials.crackRock, 1.3);
    burst(crackedWall.x, crackedWall.y + 1.6, crackedWall.z + 1.2, 8, materials.wallAlt, 1.3);
    sound.crumble();
    input.rumble(0.9, 320);
    shake = Math.max(shake, 0.45);
    toast('A hidden passage! Something is clanking down there…', 3);
    grantXp(BALANCE.crackedWallXp);
    saveProgress();
  }

  function spawnStone(dx, dz, damage) {
    let s = stones.find((x) => !x.active);
    if (!s) s = stones.reduce((a, b) => (a.life < b.life ? a : b));
    s.active = true;
    s.dx = dx;
    s.dz = dz;
    s.life = 1.2;
    s.damage = damage;
    s.mesh.position.set(player.position.x + dx * 0.7, player.position.y + 1.12, player.position.z + dz * 0.7);
    s.mesh.visible = true;
  }

  function tryShoot(fresh) {
    if (!state.gear.sling) {
      if (fresh) toast('The sling-kit is in the orange locker.');
      return;
    }
    if (state.shotCooldown > 0) return;
    state.shotCooldown = BALANCE.player.shotCooldown;
    const fx = Math.sin(player.rotation.y);
    const fz = Math.cos(player.rotation.y);
    let best = null;
    let bestScore = Infinity;
    const maxAngle = (BALANCE.player.autoAimAngleDeg * Math.PI) / 180;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.abs(e.group.position.y - player.position.y) > 2.6) continue;
      const dx = e.group.position.x - player.position.x;
      const dz = e.group.position.z - player.position.z;
      const d = Math.hypot(dx, dz);
      if (d > BALANCE.player.autoAimRange) continue;
      const a = Math.acos(clamp((fx * dx + fz * dz) / Math.max(0.01, d), -1, 1));
      if (a < maxAngle && d + a * 3 < bestScore) {
        best = e;
        bestScore = d + a * 3;
      }
    }
    let dx = fx;
    let dz = fz;
    if (best) {
      dx = best.group.position.x - player.position.x;
      dz = best.group.position.z - player.position.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
    }
    player.rotation.y = Math.atan2(dx, dz);
    const dmg = damageAmount();
    spawnStone(dx, dz, dmg);
    if (state.gear.pouch) {
      const sp = BALANCE.pouchSpread;
      for (const s of [-sp, sp]) {
        const c = Math.cos(s);
        const n = Math.sin(s);
        spawnStone(dx * c + dz * n, -dx * n + dz * c, dmg * BALANCE.pouchSideDamage);
      }
    }
    throwAnim = 0.2;
    sound.shot();
    input.rumble(0.12, 40);
  }

  function dash() {
    if (state.dashCooldown > 0) return;
    const mv = input.vector('move');
    let dx = mv.x * Math.cos(cameraYaw) - mv.y * Math.sin(cameraYaw);
    let dz = -mv.x * Math.sin(cameraYaw) - mv.y * Math.cos(cameraYaw);
    const len = Math.hypot(dx, dz);
    if (len < 0.15) {
      dx = Math.sin(player.rotation.y);
      dz = Math.cos(player.rotation.y);
    } else {
      dx /= len;
      dz /= len;
    }
    state.dashDir.x = dx;
    state.dashDir.z = dz;
    state.dashTimer = BALANCE.player.dashSeconds;
    state.dashCooldown = BALANCE.player.dashCooldown;
    state.invuln = Math.max(state.invuln, BALANCE.player.dashSeconds + 0.08);
    sound.dash();
    input.rumble(0.2, 60);
  }

  function fireGlob(e, dx, dz) {
    let g = globs.find((x) => !x.active);
    if (!g) g = globs.reduce((a, b) => (a.life < b.life ? a : b));
    g.active = true;
    g.dx = dx;
    g.dz = dz;
    g.life = BALANCE.spitter.globLife;
    g.mesh.position.set(e.group.position.x + dx * 0.7, e.group.position.y + 0.85, e.group.position.z + dz * 0.7);
    g.mesh.visible = true;
    if (dist(player.position.x, player.position.z, e.group.position.x, e.group.position.z) < 14) sound.spit();
  }

  // ---------------------------------------------------------------- interaction
  function nearestInteractable() {
    let best = null;
    let bestD = 2.25;
    for (const it of LEVEL.interactables) {
      const g = interactableObjects.get(it.id);
      if (!g || !g.visible) continue;
      if (it.type === 'seal' && state.seals.has(it.seal)) continue;
      if (it.type === 'locker' && state.gear.sling) continue;
      if (it.type === 'gate' && state.gateOpen) continue;
      if (it.type === 'valve' && state.valves.has(it.id)) continue;
      if (it.type === 'crew' && state.dexFreed) continue;
      if (Math.abs(it.y - player.position.y) > 2) continue;
      const d = dist(player.position.x, player.position.z, it.x, it.z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  function useAction() {
    const it = nearestInteractable();
    if (!it) {
      toast('Nothing to use here.', 1.0);
      return;
    }
    if (it.type === 'locker') {
      state.gear.sling = true;
      interactableObjects.get(it.id).visible = false;
      toast(`Sling-kit equipped. Shoot with ${SHOT_KEYS[input.source] || 'Space'}.`, 2.8);
      sound.pickup();
      saveProgress();
    } else if (it.type === 'seal') {
      state.seals.add(it.seal);
      interactableObjects.get(it.id).visible = false;
      state.checkpoint = { x: player.position.x, z: player.position.z };
      grantXp(BALANCE.sealXp);
      toast(`${it.seal} Seal recovered — ${state.seals.size}/3`);
      sound.pickup();
      input.rumble(0.35, 120);
      saveProgress();
    } else if (it.type === 'workbench') {
      openBench();
    } else if (it.type === 'gate') {
      if (state.seals.size < 3) {
        toast(`The gate needs all three seals. ${state.seals.size}/3 found.`);
        sound.fail();
      } else {
        state.gateOpen = true;
        rebuildBoxes();
        state.checkpoint = { x: 39.5, z: 0 };
        toast('Smuggler Gate unlocked. Bridge route open.');
        sound.level();
        input.rumble(0.5, 220);
        saveProgress();
      }
    } else if (it.type === 'valve') {
      turnValve(it.id, false);
    } else if (it.type === 'crew') {
      freeDex(false);
    } else if (it.type === 'rescue') {
      const threats = enemies.filter((e) => e.alive && dist(e.group.position.x, e.group.position.z, 68, 0) < 12);
      if (threats.length) {
        toast('Clear the vault before opening the cage.');
        sound.fail();
      } else {
        completeMission();
      }
    }
    updateHud();
  }

  function turnValve(id, silent) {
    const v = valves.get(id);
    if (!v || state.valves.has(id)) return;
    state.valves.add(id);
    v.bulb.material = materials.cyan;
    if (silent) {
      v.wheel.rotation.z = Math.PI * 3;
    } else {
      v.spin = 1.1;
      sound.valve();
      input.rumble(0.3, 200);
    }
    const drained = state.valves.size >= LEVEL.valveIds.length;
    if (drained && pumpFloor) pumpFloor.water = false;
    if (silent) return;
    if (drained) {
      toast("The pump room drains. Dex's cage lock is clear!", 3);
      grantXp(BALANCE.drainXp);
    } else {
      toast(`Valve ${state.valves.size}/3 turned — a steam vent sputters out.`, 2.4);
    }
    saveProgress();
  }

  function freeDex(silent) {
    if (state.dexFreed) return;
    if (!silent && state.valves.size < LEVEL.valveIds.length) {
      toast(`The cage lock is still underwater. Turn all three valves (${state.valves.size}/3).`, 2.6);
      sound.fail();
      return;
    }
    state.dexFreed = true;
    state.gear.pouch = true;
    for (const piece of dexCage) piece.visible = false;
    dexNpc.position.set(0, 0, -2.0);
    if (silent) return;
    const it = LEVEL.interactables.find((x) => x.id === LEVEL.crewId);
    state.checkpoint = { x: player.position.x, z: player.position.z };
    if (!floorHeightAt(state.checkpoint.x, state.checkpoint.z)) state.checkpoint = { x: it.x - 2, z: it.z - 2.5 };
    sound.win();
    input.rumble(0.5, 260);
    toast('Dex is free! He hands over his Triple-Stone Pouch: every shot now throws three stones.', 4);
    grantXp(BALANCE.dexXp);
    saveProgress();
  }

  function pickupItem(p, g) {
    if (!g.visible) return;
    if (p.type === 'gear') {
      state.gear[p.gear] = true;
      if (p.gear === 'boots') toast('Grip Sneakers equipped: shallow water slows you less.');
      if (p.gear === 'lamp') toast('Quartz Headlamp equipped: brighter beam and wider pickup reach.');
    } else if (p.type === 'heal') {
      if (state.hp >= maxHp()) return;
      state.hp = Math.min(maxHp(), state.hp + p.amount);
      toast(`Snack: +${p.amount} health`);
    } else if (p.type === 'scrap') {
      state.scrap += p.amount;
      toast(`+${p.amount} scrap`);
    }
    g.visible = false;
    sound.pickup();
    updateHud();
    if (p.type === 'gear') saveProgress();
  }

  function completeMission() {
    state.mode = 'complete';
    rescueNpc.position.z = 2.0;
    rescueNpc.rotation.y = 0;
    for (const piece of rescueCage) piece.visible = false;
    sound.win();
    input.rumble(0.6, 400);
    kit.touch?.setShown('use', false);
    ui.prompt.classList.remove('show');
    updateHud();

    // Records per difficulty: the fastest escape and the most crew ever brought home.
    const crew = 1 + (state.dexFreed ? 1 : 0);
    const prevBest = bestFor(state.difficulty);
    const isBest = !prevBest || state.elapsed < prevBest.time;
    const all = loadBests();
    all[state.difficulty] = {
      time: isBest ? state.elapsed : prevBest.time,
      crew: Math.max(crew, prevBest?.crew || 0)
    };
    store.set(BEST_KEY, all);
    store.del(SAVE_KEY);

    const stat = (b, s) => {
      const d = document.createElement('div');
      const bb = document.createElement('b');
      bb.textContent = b;
      const sp = document.createElement('span');
      sp.textContent = s;
      d.append(bb, sp);
      return d;
    };
    ui.completeStats.replaceChildren(
      stat(fmtTime(state.elapsed), isBest ? 'new best' : 'time'),
      stat(String(state.level), 'level'),
      stat(String(state.kills), 'enemies'),
      stat(`${crew}/2`, 'crew'),
      stat(String(state.upgrades.sling + (state.gear.jacket ? 1 : 0)), 'upgrades'),
      stat(String(state.deaths), 'knockouts')
    );
    const record = prevBest && !isBest ? ` Best ${diff().label} escape: ${fmtTime(prevBest.time)}.` : '';
    ui.completeNote.textContent = `${diff().label} run.${record} ${state.dexFreed
      ? 'Dex and Mara both made it out. The whole crew is home.'
      : 'Somewhere in the grotto, someone is still knocking on the rock…'}`;
    pendingComplete = 0.9;
  }

  // ---------------------------------------------------------------- bench
  function refreshUpgradePanel() {
    ui.upgradeScrap.textContent = state.scrap;
    const slingBtn = ui.upgrade.querySelector('[data-upgrade="sling"]');
    const jacketBtn = ui.upgrade.querySelector('[data-upgrade="jacket"]');
    const slingCost = BALANCE.upgradeCosts.sling[state.upgrades.sling] ?? null;
    slingBtn.textContent = slingCost === null ? 'Sling Power — MAX' : `Buy Sling Power +1 — ${slingCost} scrap`;
    slingBtn.disabled = slingCost === null || state.scrap < slingCost;
    jacketBtn.textContent = state.gear.jacket ? 'Padded Jacket — OWNED' : `Buy Padded Jacket — ${BALANCE.upgradeCosts.jacket} scrap`;
    jacketBtn.disabled = state.gear.jacket || state.scrap < BALANCE.upgradeCosts.jacket;
  }
  function openBench() {
    state.mode = 'bench';
    refreshUpgradePanel();
    showMenu(ui.upgrade);
  }
  function closeBench() {
    if (state.mode !== 'bench') return;
    hideMenu();
    state.mode = 'play';
  }
  ui.upgrade.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-upgrade]');
    if (!btn || btn.disabled) return;
    const kind = btn.dataset.upgrade;
    if (kind === 'sling') {
      const cost = BALANCE.upgradeCosts.sling[state.upgrades.sling];
      if (cost == null || state.scrap < cost) return;
      state.scrap -= cost;
      state.upgrades.sling += 1;
      toast(`Sling upgraded to +${state.upgrades.sling}.`);
      sound.level();
    }
    if (kind === 'jacket') {
      const cost = BALANCE.upgradeCosts.jacket;
      if (state.gear.jacket || state.scrap < cost) return;
      state.scrap -= cost;
      state.gear.jacket = true;
      state.hp += 2;
      toast('Padded Jacket equipped: +2 max health.');
      sound.level();
    }
    input.rumble(0.3, 100);
    refreshUpgradePanel();
    updateHud();
    saveProgress();
    // Keep the gamepad cursor on a button that still works.
    const list = menuButtons();
    if (!list.includes(document.activeElement)) focusMenu(Math.min(focusIdx, list.length - 1));
  });
  ui.upgradeClose.addEventListener('click', closeBench);

  // ---------------------------------------------------------------- menus (mouse, touch, keyboard, gamepad)
  function menuButtons() {
    if (!activeMenu) return [];
    return [...activeMenu.querySelectorAll('button')].filter((b) => !b.disabled && !b.hidden && b.offsetParent !== null);
  }
  function focusMenu(i) {
    const list = menuButtons();
    if (!list.length) return;
    focusIdx = ((i % list.length) + list.length) % list.length;
    list[focusIdx].focus({ preventScroll: true });
    // Short landscape phones scroll the menu card: keep the gamepad cursor on screen.
    list[focusIdx].scrollIntoView({ block: 'nearest' });
  }
  function showMenu(el, initial = 0, grace = 0.25) {
    if (activeMenu && activeMenu !== el) activeMenu.classList.remove('show');
    activeMenu = el;
    el.classList.add('show');
    kit.touch?.suspend(true, 'game');
    ui.prompt.classList.remove('show');
    navDir = 0;
    // The cursor lands after the grace period: a focused button would take a mashed Space/Enter
    // as a click straight away.
    menuGrace = grace;
    pendingFocus = initial;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (grace <= 0) {
      focusMenu(initial);
      pendingFocus = null;
    }
  }
  function hideMenu() {
    if (!activeMenu) return;
    activeMenu.classList.remove('show');
    activeMenu = null;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    kit.touch?.suspend(false, 'game');
    input.settle();
    fireArmed = false;
  }
  for (const el of [ui.title, ui.upgrade, ui.pause, ui.complete]) {
    el.addEventListener('focusin', (e) => {
      if (el !== activeMenu) return;
      const i = menuButtons().indexOf(e.target);
      if (i >= 0) focusIdx = i;
    });
  }
  function menuBack() {
    if (activeMenu === ui.pause) resumePlay();
    else if (activeMenu === ui.upgrade) closeBench();
  }
  function updateMenu(dt) {
    if (menuGrace > 0) {
      menuGrace -= dt;
      if (menuGrace <= 0 && pendingFocus !== null) {
        focusMenu(pendingFocus);
        pendingFocus = null;
      }
      return;
    }
    const v = input.vector('move');
    const dir = v.y > 0.55 || v.x < -0.55 ? -1 : v.y < -0.55 || v.x > 0.55 ? 1 : 0;
    if (dir !== 0 && (dir !== navDir || navRepeat <= 0)) {
      focusMenu(focusIdx + dir);
      navRepeat = dir !== navDir ? 0.36 : 0.14;
    }
    navDir = dir;
    navRepeat -= dt;
    if (input.pressed('fire') || input.pressed('use')) menuButtons()[focusIdx]?.click();
    else if (input.pressed('pause') || input.pressed('dash')) menuBack();
  }

  // ---------------------------------------------------------------- run flow
  function resetRun(difficulty = chosenDifficulty) {
    state = freshState(difficulty);
    state.hp = maxHp();
    if (pumpFloor) pumpFloor.water = true;
    player.position.set(LEVEL.spawn.x, LEVEL.spawn.y, LEVEL.spawn.z);
    player.rotation.y = Math.PI / 2;
    player.visible = true;
    shake = 0;
    crackShake = 0;
    hurtFlash = 0;
    document.body.classList.remove('hurt');
    crackGroup.position.z = crackedWall.z;
    for (const e of enemies) {
      e.alive = true;
      e.hpNow = e.hp * diff().enemyHp;
      e.attackCd = 0;
      e.stun = 0;
      e.punch = 0;
      e.windup = 0;
      e.spitCd = 1.2 + hash01(e.id) * 1.2;
      e.group.visible = true;
      e.group.scale.setScalar(1);
      e.group.position.set(e.homeX, e.y, e.homeZ);
    }
    for (const g of breakables.values()) g.visible = true;
    for (const g of pickupObjects.values()) {
      g.visible = true;
      g.position.y = g.userData.baseY;
    }
    for (const g of interactableObjects.values()) g.visible = true;
    for (const piece of rescueCage) piece.visible = true;
    rescueNpc.position.set(0, 0, 0);
    rescueNpc.rotation.y = 0;
    for (const piece of dexCage) piece.visible = true;
    dexNpc.position.set(0, 0, 0);
    for (const v of valves.values()) {
      v.spin = 0;
      v.wheel.rotation.z = 0;
      v.bulb.material = materials.alarm;
    }
    crackGroup.visible = true;
    gateVisual.position.y = gateWall.y;
    if (pumpWater) {
      pumpWater.visible = true;
      pumpWater.position.y = pumpWater.userData.baseY;
    }
    for (const s of stones) {
      s.active = false;
      s.mesh.visible = false;
    }
    for (const g of globs) {
      g.active = false;
      g.mesh.visible = false;
    }
    for (const c of chips) {
      c.life = 0;
      c.mesh.visible = false;
    }
    rebuildBoxes();
    cameraYaw = DEFAULT_YAW;
    cameraPitch = DEFAULT_PITCH;
    cameraDistance = isMobile ? 10.4 : 11.8;
    snapCamera();
    pendingComplete = 0;
    mapDirty = true;
    lastNearest = undefined;
    updateHud();
  }

  function applySave(s) {
    const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
    const arr = (v) => (Array.isArray(v) ? v : []);
    state.xp = Math.max(0, num(s.xp));
    state.level = clamp(Math.round(num(s.level, 1)), 1, BALANCE.maxLevel);
    state.scrap = Math.max(0, Math.round(num(s.scrap)));
    const sealNames = new Set(LEVEL.interactables.filter((i) => i.type === 'seal').map((i) => i.seal));
    state.seals = new Set(arr(s.seals).filter((n) => sealNames.has(n)));
    for (const k of Object.keys(state.gear)) state.gear[k] = !!s.gear?.[k];
    state.upgrades.sling = clamp(Math.round(num(s.upgrades?.sling)), 0, BALANCE.maxSlingUpgrade);
    state.kills = Math.max(0, Math.round(num(s.kills)));
    state.crates = Math.max(0, Math.round(num(s.crates)));
    state.deaths = Math.max(0, Math.round(num(s.deaths)));
    state.elapsed = Math.max(0, num(s.elapsed));
    state.gateOpen = !!s.gateOpen && state.seals.size >= 3;
    const cp = s.checkpoint;
    if (cp && Number.isFinite(cp.x) && Number.isFinite(cp.z) && floorHeightAt(cp.x, cp.z)) state.checkpoint = { x: cp.x, z: cp.z };
    for (const id of arr(s.broken)) if (breakables.has(id)) breakables.get(id).visible = false;
    for (const id of arr(s.taken)) if (pickupObjects.has(id)) pickupObjects.get(id).visible = false;
    const dead = new Set(arr(s.dead));
    for (const e of enemies) {
      if (!dead.has(e.id)) continue;
      e.alive = false;
      e.group.visible = false;
    }
    if (state.gear.sling) interactableObjects.get('sling-locker').visible = false;
    for (const it of LEVEL.interactables) if (it.type === 'seal' && state.seals.has(it.seal)) interactableObjects.get(it.id).visible = false;
    if (s.crackedOpen) breakCrackedWall(true);
    for (const id of arr(s.valves)) turnValve(id, true);
    if (s.dexFreed && state.valves.size >= LEVEL.valveIds.length) freeDex(true);
    if (pumpWater && state.valves.size >= LEVEL.valveIds.length) pumpWater.visible = false;
    state.hp = clamp(Math.round(num(s.hp, maxHp())), 1, maxHp());
    if (state.gateOpen) gateVisual.position.y = 4.2;
    player.position.set(state.checkpoint.x, floorHeightAt(state.checkpoint.x, state.checkpoint.z)?.y ?? 0, state.checkpoint.z);
    rebuildBoxes();
    snapCamera();
    updateHud();
  }

  function beginPlay(message) {
    sound.unlock();
    hideMenu();
    state.mode = 'play';
    lastNearest = undefined;
    toast(message, 3);
  }

  function syncTitle() {
    const save = loadSave();
    ui.cont.hidden = !save;
    if (save) {
      const label = DIFFICULTY[diffKey(save.difficulty)].label;
      ui.cont.textContent = `Continue — ${save.seals?.length || 0}/3 seals · ${fmtTime(save.elapsed || 0)} · ${label}`;
    }
    ui.start.textContent = save ? 'Start a new run' : 'Start — drop in';
    const d = DIFFICULTY[chosenDifficulty];
    ui.difficulty.textContent = `Difficulty: ${d.label}`;
    ui.difficultyNote.textContent = d.note;
    const best = bestFor(chosenDifficulty);
    ui.best.hidden = !best;
    if (best) ui.best.textContent = `Best ${d.label} escape ${fmtTime(best.time)} · crew rescued ${best.crew || 1}/2`;
  }

  function showTitle() {
    state.mode = 'title';
    syncTitle();
    kit.touch?.setShown('use', false);
    showMenu(ui.title, 0);
  }

  function openPause() {
    if (state.mode !== 'play') return;
    state.mode = 'pause';
    ui.pauseSummary.textContent = `${fmtTime(state.elapsed)} in the caves · seals ${state.seals.size}/3 · level ${state.level} · ${diff().label}${state.crackedOpen ? ` · crew ${state.dexFreed ? 2 : 1}/2 found` : ''}`;
    syncSoundLabels();
    showMenu(ui.pause);
    saveProgress();
  }
  function resumePlay() {
    if (state.mode !== 'pause') return;
    hideMenu();
    state.mode = 'play';
  }

  function syncSoundLabels() {
    ui.mute.textContent = sound.enabled ? 'SOUND ON' : 'SOUND OFF';
    ui.pauseSound.textContent = sound.enabled ? 'Turn sound off' : 'Turn sound on';
  }
  function toggleSound() {
    sound.unlock();
    sound.setEnabled(!sound.enabled);
    syncSoundLabels();
  }
  syncSoundLabels();

  ui.start.addEventListener('click', () => {
    store.del(SAVE_KEY);
    resetRun(chosenDifficulty);
    beginPlay('Mission: recover 3 seals and rescue Mara.');
  });
  ui.cont.addEventListener('click', () => {
    const save = loadSave();
    resetRun(save ? save.difficulty : chosenDifficulty);
    if (save) applySave(save);
    beginPlay(save ? 'Welcome back. Picking up at the last safe spot.' : 'Mission: recover 3 seals and rescue Mara.');
  });
  ui.difficulty.addEventListener('click', () => {
    const i = DIFFICULTY_ORDER.indexOf(chosenDifficulty);
    chosenDifficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
    store.set(DIFF_KEY, chosenDifficulty);
    sound.unlock();
    sound.click();
    syncTitle();
  });
  ui.titleSettings.addEventListener('click', () => kit.menu.open());
  ui.pauseSettings.addEventListener('click', () => kit.menu.open());
  ui.resume.addEventListener('click', resumePlay);
  ui.pauseSound.addEventListener('click', toggleSound);
  ui.pauseQuit.addEventListener('click', () => {
    saveProgress();
    showTitle();
  });
  ui.mute.addEventListener('click', toggleSound);
  ui.pauseButton.addEventListener('click', openPause);
  ui.replay.addEventListener('click', () => {
    store.del(SAVE_KEY);
    resetRun(state.difficulty);
    beginPlay('Back in the boathouse. Go again!');
  });
  ui.toTitle.addEventListener('click', () => {
    resetRun();
    showTitle();
  });

  // Controls help follows the device in use.
  function syncControlsHelp() {
    for (const row of ui.help.querySelectorAll('[data-source]')) row.classList.toggle('is-current', row.dataset.source === input.source);
    lastNearest = undefined;
  }
  input.onSourceChange(syncControlsHelp);
  syncControlsHelp();

  // Pause sound with the kit's settings panel; put the gamepad cursor back afterwards.
  kit.onPause((paused) => {
    sound.hold(paused || document.hidden);
    if (!paused && activeMenu) focusMenu(focusIdx);
  });
  document.addEventListener('visibilitychange', () => {
    sound.hold(document.hidden || kit.paused);
    if (document.hidden) {
      if (state.mode === 'play') openPause();
      else saveProgress();
    }
  });
  addEventListener('pagehide', saveProgress);
  // Browsers only start audio from a real gesture. A menu confirmed with a gamepad is not one,
  // so any key, click or tap unlocks the sound board too (cheap once it is running).
  const unlockAudio = () => sound.unlock();
  addEventListener('pointerup', unlockAudio, true);
  addEventListener('keydown', unlockAudio, true);

  // Touch pills sit just under the HUD's left panel.
  kit.onResize(() => {
    const r = ui.hudLeft.getBoundingClientRect();
    kit.touch?.placeTop('left', Math.round(r.bottom + 8));
  });

  // ---------------------------------------------------------------- minimap
  const mapCtx = ui.minimap.getContext('2d');
  const mapBase = document.createElement('canvas');
  mapBase.width = ui.minimap.width;
  mapBase.height = ui.minimap.height;
  const mb = LEVEL.bounds;
  const mapPad = 8;
  const msx = (mapBase.width - mapPad * 2) / (mb.maxX - mb.minX);
  const msz = (mapBase.height - mapPad * 2) / (mb.maxZ - mb.minZ);
  const tx = (x) => mapPad + (x - mb.minX) * msx;
  const tz = (z) => mapPad + (z - mb.minZ) * msz;
  function drawMapBase() {
    const ctx = mapBase.getContext('2d');
    ctx.clearRect(0, 0, mapBase.width, mapBase.height);
    ctx.fillStyle = 'rgba(4,9,12,.76)';
    ctx.fillRect(0, 0, mapBase.width, mapBase.height);
    for (const f of LEVEL.floors) {
      if (f.secret && !state.crackedOpen) continue;
      ctx.fillStyle = f.water ? '#3f6066' : '#5c5143';
      ctx.fillRect(tx(f.x - f.w / 2), tz(f.z - f.d / 2), f.w * msx, f.d * msz);
    }
    mapDirty = false;
  }
  function drawMinimap() {
    if (mapDirty) drawMapBase();
    const ctx = mapCtx;
    ctx.clearRect(0, 0, ui.minimap.width, ui.minimap.height);
    ctx.drawImage(mapBase, 0, 0);
    for (const it of LEVEL.interactables) {
      if (it.type === 'seal' && !state.seals.has(it.seal)) {
        ctx.fillStyle = '#f1bc43';
        ctx.beginPath();
        ctx.arc(tx(it.x), tz(it.z), 3.6, 0, TAU);
        ctx.fill();
      }
      if (it.type === 'crew' && state.crackedOpen && !state.dexFreed) {
        ctx.fillStyle = '#7fd36a';
        ctx.beginPath();
        ctx.arc(tx(it.x), tz(it.z), 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.fillStyle = state.gateOpen ? '#65b675' : '#c6584e';
    ctx.fillRect(tx(gateWall.x) - 2, tz(gateWall.z) - 5, 4, 10);
    ctx.fillStyle = '#65c7d1';
    ctx.beginPath();
    ctx.arc(tx(72.1), tz(0), 3, 0, TAU);
    ctx.fill();
    // Player arrow: the tip points along the player's facing (it used to point backwards).
    ctx.save();
    ctx.translate(tx(player.position.x), tz(player.position.z));
    ctx.rotate(-player.rotation.y);
    ctx.fillStyle = '#f1e2bd';
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(4, -5);
    ctx.lineTo(-4, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- camera
  /** Cut the camera to the player (respawn, continue) instead of sweeping across the cave. */
  function snapCamera() {
    camTarget.set(player.position.x, player.position.y + 1, player.position.z);
    const radius = cameraDistance * RADIUS_PER_DIST;
    const horizontal = radius * Math.cos(cameraPitch);
    camera.position.set(
      camTarget.x + Math.sin(cameraYaw) * horizontal,
      camTarget.y + radius * Math.sin(cameraPitch),
      camTarget.z + Math.cos(cameraYaw) * horizontal
    );
    camera.lookAt(camTarget);
  }

  function updateCamera(dt, interactive) {
    if (interactive) {
      const lk = input.look('look');
      let lx = lk.x;
      let ly = lk.y;
      const src = input.source;
      // Left mouse shoots; right- or middle-drag turns the camera (as in the original).
      const mb = input.mouseButtons;
      if (src === 'keyboard' && mb?.has?.(0) && !mb.has(1) && !mb.has(2)) {
        lx = 0;
        ly = 0;
      }
      // Drags grab the world (original feel); sticks turn the view.
      const sign = src === 'gamepad' ? -1 : 1;
      const k = src === 'keyboard' ? 2.4 : src === 'touch' ? 1.1 : 1;
      cameraYaw += sign * lx * k;
      cameraPitch = clamp(cameraPitch - sign * ly * k * 0.6, PITCH_MIN, PITCH_MAX);
      cameraYaw -= input.value('turn') * 2.2 * dt;
      const zoomKeys = (input.down('zoomOut') ? 1 : 0) - (input.down('zoomIn') ? 1 : 0);
      cameraDistance = clamp(cameraDistance - input.zoom() * 0.85 + zoomKeys * 7 * dt, 7.2, 16);
    } else if (state.mode === 'title') {
      cameraYaw += dt * 0.05;
    }
    camTarget.x = damp(camTarget.x, player.position.x, 7.5, dt);
    camTarget.y = damp(camTarget.y, player.position.y + 1.0, 7.5, dt);
    camTarget.z = damp(camTarget.z, player.position.z, 7.5, dt);

    const radius = cameraDistance * RADIUS_PER_DIST;
    const horizontal = radius * Math.cos(cameraPitch);
    camDesired.set(
      camTarget.x + Math.sin(cameraYaw) * horizontal,
      camTarget.y + radius * Math.sin(cameraPitch),
      camTarget.z + Math.cos(cameraYaw) * horizontal
    );
    camDir.subVectors(camDesired, camTarget);
    const maxDist = camDir.length();
    camDir.multiplyScalar(1 / maxDist);
    const hit = rayBoxes(camTarget, camDir, maxDist);
    if (hit < maxDist - 0.4) camDesired.copy(camTarget).addScaledVector(camDir, Math.max(3.8, hit - 0.45));
    camera.position.lerp(camDesired, 1 - Math.exp(-9 * dt));
    if (shake > 0) {
      const s = shake * shake * 0.6;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
      shake = Math.max(0, shake - dt * 1.6);
    }
    camera.lookAt(camTarget);
  }

  // ---------------------------------------------------------------- per-frame updates
  function updatePlayer(dt) {
    state.shotCooldown = Math.max(0, state.shotCooldown - dt);
    state.invuln = Math.max(0, state.invuln - dt);
    state.dashCooldown = Math.max(0, state.dashCooldown - dt);

    let mx = 0;
    let mz = 0;
    let magnitude = 0;
    if (state.dashTimer > 0) {
      state.dashTimer -= dt;
      mx = state.dashDir.x;
      mz = state.dashDir.z;
      magnitude = 1;
      moveXZ(player, mx * BALANCE.player.dashSpeed * dt, mz * BALANCE.player.dashSpeed * dt, BALANCE.player.radius);
    } else {
      const mv = input.vector('move');
      magnitude = Math.min(1, Math.hypot(mv.x, mv.y));
      const s = Math.sin(cameraYaw);
      const c = Math.cos(cameraYaw);
      mx = mv.x * c - mv.y * s;
      mz = -mv.x * s - mv.y * c;
      const len = Math.hypot(mx, mz);
      if (len > 0.001) {
        mx /= len;
        mz /= len;
      }
      let speed = BALANCE.player.baseSpeed;
      if (isWetAt(player.position.x, player.position.z)) speed *= state.gear.boots ? BALANCE.player.bootsWaterSlow : BALANCE.player.waterSlow;
      if (magnitude > 0.001) moveXZ(player, mx * speed * dt * magnitude, mz * speed * dt * magnitude, BALANCE.player.radius);
    }

    if (magnitude > 0.08) {
      const diff = wrapAngle(Math.atan2(mx, mz) - player.rotation.y);
      player.rotation.y = wrapAngle(player.rotation.y + diff * (1 - Math.exp(-14 * dt)));
    }
    walkPhase += dt * 12;
    const swing = magnitude * Math.sin(walkPhase) * 0.65;
    playerParts.legL.rotation.x = swing;
    playerParts.legR.rotation.x = -swing;
    playerParts.armL.rotation.x = -swing * 0.7;
    throwAnim = Math.max(0, throwAnim - dt);
    playerParts.armR.rotation.x = throwAnim > 0 ? -2.2 * (throwAnim / 0.2) : swing * 0.7;
    playerParts.body.position.y = 1.15 + Math.abs(Math.sin(walkPhase)) * magnitude * 0.035;
    // Invulnerability blink after a hit (not during a dash).
    player.visible = !(state.invuln > 0.05 && state.dashTimer <= 0 && Math.floor(state.invuln * 14) % 2 === 1);
    lamp.intensity = state.gear.lamp ? 120 : 48;
    lamp.distance = state.gear.lamp ? 23 : 13;
  }

  function updateProjectiles(dt) {
    const speed = BALANCE.player.projectileSpeed;
    for (const p of stones) {
      if (!p.active) continue;
      p.life -= dt;
      const pos = p.mesh.position;
      pos.x += p.dx * speed * dt;
      pos.z += p.dz * speed * dt;
      let hit = !floorHeightAt(pos.x, pos.z);
      if (!hit) {
        for (const w of activeBoxes) {
          if (circleHitsAabb(pos.x, pos.z, 0.12, w)) {
            if (w.dynamic === 'cracked') hitCrackedWall(pos.x, pos.z);
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const [id, g] of breakables) {
          if (g.visible && dist(pos.x, pos.z, g.position.x, g.position.z) < 0.75 && Math.abs(g.position.y - player.position.y) < 2.6) {
            destroyCrate(id);
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const e of enemies) {
          if (!e.alive) continue;
          if (Math.abs(e.group.position.y + 0.6 - pos.y) > 2.2) continue;
          const er = e.type === 'brute' ? 0.85 : e.type === 'bat' ? 0.55 : 0.65;
          if (dist(pos.x, pos.z, e.group.position.x, e.group.position.z) < er) {
            e.hpNow -= p.damage;
            e.stun = 0.18;
            e.punch = 0.16;
            moveXZ(e.group, p.dx * 0.22, p.dz * 0.22, 0.4);
            sound.hit();
            input.rumble(0.15, 50);
            if (e.hpNow <= 0) killEnemy(e);
            hit = true;
            break;
          }
        }
      }
      if (hit || p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  function updateGlobs(dt) {
    const speed = BALANCE.spitter.globSpeed;
    for (const g of globs) {
      if (!g.active) continue;
      g.life -= dt;
      const pos = g.mesh.position;
      pos.x += g.dx * speed * dt;
      pos.z += g.dz * speed * dt;
      g.mesh.rotation.x += dt * 6;
      g.mesh.rotation.y += dt * 4;
      let done = g.life <= 0 || !floorHeightAt(pos.x, pos.z);
      if (!done) {
        for (const w of activeBoxes) {
          if (circleHitsAabb(pos.x, pos.z, 0.15, w)) {
            done = true;
            break;
          }
        }
      }
      if (!done && state.invuln <= 0 && Math.abs(player.position.y + 1 - pos.y) < 1.6 && dist(pos.x, pos.z, player.position.x, player.position.z) < 0.72) {
        damagePlayer(1, pos.x - g.dx, pos.z - g.dz);
        done = true;
      }
      if (done) {
        g.active = false;
        g.mesh.visible = false;
        if (dist(pos.x, pos.z, player.position.x, player.position.z) < 10) sound.splat();
      }
    }
  }

  function updateEnemies(dt) {
    const sp = BALANCE.spitter;
    const dif = diff();
    for (const e of enemies) {
      if (!e.alive) continue;
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.punch = Math.max(0, e.punch - dt);
      const dx = player.position.x - e.group.position.x;
      const dz = player.position.z - e.group.position.z;
      const d = Math.hypot(dx, dz);
      const sameLevel = Math.abs(player.position.y - e.group.position.y) < 1.8 || e.type === 'bat';
      const aggro = e.type === 'brute' ? 11 : e.type === 'spitter' ? sp.range : 8.5;
      const engaged = sameLevel && d < aggro && e.stun <= 0;
      if (engaged) {
        if (e.type === 'spitter') {
          const nx = dx / Math.max(0.01, d);
          const nz = dz / Math.max(0.01, d);
          e.group.rotation.y = Math.atan2(dx, dz);
          if (e.windup <= 0) {
            const v = e.speed * dif.enemySpeed * dt;
            if (d < sp.keepAway) moveXZ(e.group, -nx * v, -nz * v, 0.5);
            else if (d > sp.closeIn) moveXZ(e.group, nx * v, nz * v, 0.5);
          }
          if (e.windup > 0) {
            e.windup -= dt;
            if (e.windup <= 0) fireGlob(e, nx, nz);
          } else {
            e.spitCd -= dt;
            if (e.spitCd <= 0) {
              e.windup = sp.windup;
              e.spitCd = sp.cooldown * dif.enemyCd;
            }
          }
          if (d < 0.95 && e.attackCd <= 0) {
            damagePlayer(e.damage, e.group.position.x, e.group.position.z);
            e.attackCd = 1.0 * dif.enemyCd;
          }
        } else if (d > (e.type === 'brute' ? 1.2 : 0.9)) {
          const v = e.speed * dif.enemySpeed * dt;
          moveXZ(e.group, (dx / Math.max(0.01, d)) * v, (dz / Math.max(0.01, d)) * v, e.type === 'brute' ? 0.75 : 0.47);
        } else if (e.attackCd <= 0) {
          damagePlayer(e.damage, e.group.position.x, e.group.position.z);
          e.attackCd = (e.type === 'brute' ? 1.35 : 1.0) * dif.enemyCd;
        }
      } else if (e.type === 'spitter') {
        e.windup = 0;
      }

      const parts = e.group.userData.parts;
      if (e.type === 'bat') {
        const ground = floorHeightAt(e.group.position.x, e.group.position.z)?.y ?? e.y;
        e.group.position.y = ground + 1.3 + Math.sin(state.elapsed * 4 + e.phase) * 0.28;
        e.group.rotation.y += dt * 1.7;
        const flap = Math.sin(state.elapsed * 16 + e.phase) * 0.65;
        parts.left.rotation.z = 0.35 + flap;
        parts.right.rotation.z = -0.35 - flap;
      } else if (e.type === 'spitter') {
        // Telegraph: the head swells before every spit.
        const swell = e.windup > 0 ? 1 - e.windup / sp.windup : 0;
        parts.head.scale.set(1 + swell * 0.25, 1 + swell * 0.45, 1 + swell * 0.25);
        parts.body.scale.y = 1 + Math.sin(state.elapsed * 3 + e.phase) * 0.05;
      } else {
        if (parts?.legL) {
          const swing = Math.sin(state.elapsed * 8 + e.phase) * 0.35 * (d < 8 ? 1 : 0.25);
          parts.legL.rotation.x = swing;
          parts.legR.rotation.x = -swing;
        }
        if (d < 8 && sameLevel) e.group.rotation.y = Math.atan2(dx, dz);
      }
      e.group.scale.setScalar(1 + e.punch * 1.4);
    }
  }

  function updatePickupsAndPrompt(dt, playing) {
    const reach = state.gear.lamp ? 1.15 : 0.9;
    for (const g of pickupObjects.values()) {
      if (!g.visible) continue;
      const p = g.userData.pickup;
      g.rotation.y += dt * 1.8;
      g.position.y = g.userData.baseY + Math.sin(state.elapsed * 2.8 + g.userData.phase) * 0.12;
      if (playing && Math.abs(p.y - player.position.y) < 2 && dist(player.position.x, player.position.z, p.x, p.z) < reach) pickupItem(p, g);
    }
    for (const [id, g] of interactableObjects) {
      if (!g.visible || !g.userData.spin) continue;
      g.rotation.y += dt * 1.3;
      g.position.y = (g.userData.interactable.y || 0) + Math.sin(state.elapsed * 2 + hash01(id) * 4) * 0.08;
    }
    const nearest = playing ? nearestInteractable() : null;
    if (nearest !== lastNearest) {
      lastNearest = nearest;
      kit.touch?.setShown('use', !!nearest);
      if (nearest) {
        setText(ui.prompt, `${nearest.label}  •  ${PROMPT_KEYS[input.source] || 'E'}`);
        ui.prompt.classList.add('show');
      } else {
        ui.prompt.classList.remove('show');
      }
    }
  }

  function updateHazards(dt, playing) {
    const st = BALANCE.steam;
    for (const h of LEVEL.hazards) {
      const g = hazardObjects.get(h.id);
      if (!g) continue;
      if (h.type === 'pendulum') {
        const s = Math.sin(state.elapsed * h.speed);
        g.position.x = h.x + s * h.amplitude;
        g.rotation.z = s * 0.24;
        if (playing && Math.abs(player.position.y - h.y) < 2.5 && dist(player.position.x, player.position.z, g.position.x, g.position.z) < h.radius + BALANCE.player.radius) {
          damagePlayer(h.damage, g.position.x, g.position.z);
        }
      } else if (h.type === 'spikes') {
        const wave = (Math.sin(state.elapsed * 2.15 + h.phase) + 1) * 0.5;
        const active = wave > 0.58;
        const warn = !active && wave > 0.46;
        const target = h.y + (active ? 0 : warn ? -0.36 : -0.48);
        g.position.y = damp(g.position.y, target, active ? 30 : 12, dt);
        if (warn) g.position.x = h.x + Math.sin(state.elapsed * 60) * 0.02;
        else g.position.x = h.x;
        if (playing && active && circleHitsAabb(player.position.x, player.position.z, BALANCE.player.radius * 0.7, h)) damagePlayer(h.damage, h.x, h.z);
      } else if (h.type === 'steam') {
        const column = g.userData.column;
        if (state.valves.has(h.valve)) {
          column.scale.y = damp(column.scale.y, 0.001, 6, dt);
          column.visible = column.scale.y > 0.01;
          continue;
        }
        column.visible = true;
        const cycle = (state.elapsed + h.phase) % st.period;
        const on = cycle >= st.onAt;
        const warn = !on && cycle >= st.warnAt;
        const target = on ? 1 : warn ? 0.22 : 0.04;
        column.scale.y = damp(column.scale.y, target, on ? 18 : 8, dt);
        const wobble = 1 + Math.sin(state.elapsed * 20 + h.phase * 7) * 0.08;
        column.scale.x = column.scale.z = (on ? 1 : 0.7) * wobble;
        if (on && !g.userData.wasOn && dist(player.position.x, player.position.z, h.x, h.z) < 12) sound.steam();
        g.userData.wasOn = on;
        if (playing && on && dist(player.position.x, player.position.z, h.x, h.z) < h.radius + BALANCE.player.radius * 0.6) damagePlayer(h.damage, h.x, h.z);
      }
    }
  }

  function updateAmbient(dt, t) {
    gateVisual.position.y = damp(gateVisual.position.y, state.gateOpen ? 4.2 : gateWall.y, 5.5, dt);
    for (const c of chips) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vy -= 8 * dt;
      c.mesh.position.x += c.vx * dt;
      c.mesh.position.y += c.vy * dt;
      c.mesh.position.z += c.vz * dt;
      c.mesh.rotation.x += dt * 7;
      c.mesh.rotation.z += dt * 5;
      if (c.life <= 0) c.mesh.visible = false;
    }
    for (const tch of torches) {
      tch.light.intensity = tch.base * (0.86 + 0.09 * Math.sin(t * 9.1 + tch.seed) + 0.05 * Math.sin(t * 23.7 + tch.seed * 3));
    }
    for (const v of valves.values()) {
      if (v.spin <= 0) continue;
      v.spin = Math.max(0, v.spin - dt);
      v.wheel.rotation.z += dt * 8.5;
    }
    if (pumpWater && pumpWater.visible) {
      const n = state.valves.size;
      const base = pumpWater.userData.baseY;
      const target = n >= LEVEL.valveIds.length ? base - 0.9 : base - n * 0.1;
      pumpWater.position.y = damp(pumpWater.position.y, target, 1.6, dt);
      if (n >= LEVEL.valveIds.length && pumpWater.position.y < base - 0.8) pumpWater.visible = false;
    }
    if (crackShake > 0) {
      crackShake = Math.max(0, crackShake - dt);
      crackGroup.position.z = crackedWall.z + Math.sin(crackShake * 90) * crackShake * 0.15;
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) ui.toast.classList.remove('show');
    }
    if (hurtFlash > 0) {
      hurtFlash -= dt;
      document.body.classList.toggle('hurt', hurtFlash > 0);
    }
  }

  // ---------------------------------------------------------------- go
  // QA hook (read-only state plus the three verbs).
  window.__CAVERN_CREW__ = {
    getState: () => ({
      mode: state.mode,
      started: state.mode !== 'title',
      complete: state.mode === 'complete',
      level: state.level,
      xp: state.xp,
      hp: state.hp,
      scrap: state.scrap,
      seals: [...state.seals],
      gear: { ...state.gear },
      gateOpen: state.gateOpen,
      crackedOpen: state.crackedOpen,
      valves: [...state.valves],
      dexFreed: state.dexFreed,
      backend: kit.backend,
      position: { x: player.position.x, y: player.position.y, z: player.position.z }
    }),
    shoot: () => state.mode === 'play' && tryShoot(true),
    use: () => state.mode === 'play' && useAction(),
    dash: () => state.mode === 'play' && dash()
  };

  resetRun();
  updateCamera(1, false);
  followShadow(player.position);
  kit.loading.progress(0.85, 'Lighting torches…');
  try {
    await renderer.compileAsync(scene, camera);
  } catch (err) {
    console.warn('Shader warm-up skipped:', err);
  }
  showTitle();

  kit.start((dt, t) => {
    if (input.pressed('mute')) toggleSound();
    const playing = state.mode === 'play' && !activeMenu;
    if (activeMenu) {
      updateMenu(dt);
    } else if (playing) {
      if (input.pressed('pause')) {
        openPause();
      } else {
        state.elapsed += dt;
        sound.update(dt);
        if (input.pressed('dash')) dash();
        if (!input.down('fire')) fireArmed = true;
        else if (fireArmed || input.pressed('fire')) {
          fireArmed = true;
          tryShoot(input.pressed('fire'));
        }
        if (input.pressed('use')) useAction();
        updatePlayer(dt);
        updateProjectiles(dt);
        updateGlobs(dt);
        updateEnemies(dt);
        updateHazards(dt, true);
      }
    }
    if (state.mode === 'complete' && pendingComplete > 0) {
      pendingComplete -= dt;
      if (pendingComplete <= 0) showMenu(ui.complete, 0, 0.8);
    }
    if (state.mode !== 'play' && state.mode !== 'pause' && state.mode !== 'bench') {
      // Title and results: the caves keep living behind the menu.
      updateHazards(dt, false);
      state.elapsed += state.mode === 'title' ? dt : 0;
    }
    updatePickupsAndPrompt(dt, state.mode === 'play' && !activeMenu);
    updateAmbient(dt, t);
    updateCamera(dt, state.mode === 'play' && !activeMenu);
    followShadow(player.position);
    mapClock -= dt;
    if (mapClock <= 0) {
      mapClock = 0.12;
      drawMinimap();
    }
    renderer.render(scene, camera);
  });
}
