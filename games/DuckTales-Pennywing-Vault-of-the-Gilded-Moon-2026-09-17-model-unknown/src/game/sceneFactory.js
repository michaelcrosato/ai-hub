// The low-poly world, built from three.js primitives at runtime (no textures or
// models). Persistent pieces (lights, materials, Pennywing, both guardians,
// pools for rocks, sparks and particles) are made once; each vault's geometry
// is rebuilt by buildLevel(). Static geometry is merged per material, repeated
// pickups are instanced, and identical shapes share one BufferGeometry, so a
// vault draws in a few dozen calls and compiles a handful of shaders.

import * as THREE from 'three/webgpu';
import { positionWorld, sin, time, uniform } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createInstanced } from 'kit/instancing.js';
import { createPoints } from 'kit/points.js';
import { ventState } from './core.js';

const TAU = Math.PI * 2;
const PLATFORM_DEPTH = 3.8;

// ---------------------------------------------------------------- shared geometry
const geoCache = new Map();
const cached = (key, make) => {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
};
const box = (w, h, d) => cached(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, seg, open = false) => cached(`cyl:${rt}:${rb}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const cone = (r, h, seg) => cached(`cone:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const torus = (r, t, rs, ts) => cached(`torus:${r}:${t}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));
const sphere = (r, ws, hs) => cached(`sphere:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const octa = (r) => cached(`octa:${r}`, () => new THREE.OctahedronGeometry(r, 0));
const dodeca = (r) => cached(`dodeca:${r}`, () => new THREE.DodecahedronGeometry(r, 0));

// ---------------------------------------------------------------- merging
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** A transform from {x, y, z, rx, ry, rz, sx, sy, sz} (reuses one matrix). */
function placement(o) {
  _p.set(o.x || 0, o.y || 0, o.z || 0);
  _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0));
  _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  return _m.compose(_p, _q, _s);
}

/** Collects transformed copies of shapes and merges them into one mesh per material. */
class Batch {
  constructor() {
    this.parts = new Map();
  }

  add(geometry, material, o = {}) {
    const cast = o.cast ?? true;
    const receive = o.receive ?? true;
    const key = `${material.id}|${cast ? 1 : 0}|${receive ? 1 : 0}`;
    let part = this.parts.get(key);
    if (!part) this.parts.set(key, (part = { material, cast, receive, geos: [] }));
    const g = geometry.clone();
    g.applyMatrix4(o.matrix || placement(o));
    part.geos.push(g);
    return this;
  }

  /** Adds the merged meshes to `parent` and returns them. */
  build(parent) {
    const meshes = [];
    for (const part of this.parts.values()) {
      const indexed = part.geos.every((g) => g.index);
      const list = indexed ? part.geos : part.geos.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      for (const g of new Set([...part.geos, ...list])) if (g !== merged) g.dispose();
      const mesh = new THREE.Mesh(merged, part.material);
      mesh.castShadow = part.cast;
      mesh.receiveShadow = part.receive;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}

/** A small model: parts merged per material into one group. */
function model(parts) {
  const group = new THREE.Group();
  const b = new Batch();
  for (const part of parts) b.add(part.g, part.m, part);
  b.build(group);
  return group;
}

function disposeTree(obj, keep) {
  obj.traverse((o) => {
    if (o.geometry && !keep.has(o.geometry)) o.geometry.dispose();
  });
}

// ---------------------------------------------------------------- labels
/** All of a vault's sign labels in one canvas texture, one row each. */
function makeLabelAtlas(texts) {
  const W = 512;
  const ROW = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = ROW * Math.max(1, texts.length);
  const ctx = c.getContext('2d');
  texts.forEach((text, i) => {
    const y = i * ROW;
    ctx.fillStyle = '#0b1a26';
    ctx.fillRect(0, y, W, ROW);
    ctx.strokeStyle = '#d9a742';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, y + 6, W - 12, ROW - 12);
    ctx.fillStyle = '#fff0bd';
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y + ROW / 2 + 2, W - 36);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A sign face plane showing row `i` of an `n`-row atlas. */
function labelPlane(i, n) {
  const g = new THREE.PlaneGeometry(1.95, 0.52);
  const uv = g.attributes.uv;
  const v0 = 1 - (i + 1) / n;
  const v1 = 1 - i / n;
  for (let k = 0; k < uv.count; k++) uv.setY(k, v0 + uv.getY(k) * (v1 - v0));
  return g;
}

// ---------------------------------------------------------------- the world
export function createGameScene(kit, scene) {
  const root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color(0x07131e);
  scene.fog = new THREE.FogExp2(0x0b1b27, 0.016);

  const standard = (hex, o = {}) => new THREE.MeshStandardMaterial({
    color: hex,
    roughness: o.roughness ?? 0.72,
    metalness: o.metalness ?? 0.04,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 0,
  });

  const waterGlow = uniform(new THREE.Color(0x2a9fb0));
  const water = new THREE.MeshStandardNodeMaterial({ color: 0x155f72, transparent: true, opacity: 0.62, roughness: 0.22, metalness: 0.08 });
  // Slow caustic bands drifting along the water (one shader for every pool).
  const ripple = sin(positionWorld.x.mul(1.9).add(positionWorld.z.mul(1.3)).add(time.mul(1.7))).mul(0.5).add(0.5);
  water.emissiveNode = waterGlow.mul(ripple.pow(3).mul(0.35));

  const mat = {
    stone: standard(0x35576a, { roughness: 0.92 }),
    stoneDark: standard(0x203b4c, { roughness: 0.96 }),
    stoneLight: standard(0x557a83, { roughness: 0.88 }),
    brass: standard(0xd49b35, { roughness: 0.38, metalness: 0.78 }),
    gold: standard(0xffcf49, { roughness: 0.26, metalness: 0.72, emissive: 0x5a2d00, emissiveIntensity: 0.32 }),
    cyan: standard(0x57e2d6, { roughness: 0.32, metalness: 0.12, emissive: 0x0b5c62, emissiveIntensity: 0.34 }),
    red: standard(0xc94e45, { roughness: 0.67 }),
    orange: standard(0xf09a3e, { roughness: 0.62 }),
    navy: standard(0x193143, { roughness: 0.78 }),
    cream: standard(0xfff0bd, { roughness: 0.75 }),
    black: standard(0x061018, { roughness: 0.88 }),
    white: standard(0xffffff, { roughness: 0.82 }),
    gem: standard(0x69f0e6, { roughness: 0.12, metalness: 0.1, emissive: 0x176d74, emissiveIntensity: 0.8 }),
    flame: standard(0xffb23d, { roughness: 0.3, emissive: 0xff6a00, emissiveIntensity: 3.2 }),
    water,
    steam: new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide }),
    label: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    fx: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  // Lighting: a warm key with shadows that follows the camera, a cool rim, a hemisphere fill.
  const hemi = new THREE.HemisphereLight(0x9dd9ea, 0x10212c, 1.25);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe5b3, 3.1);
  key.position.set(12, 20, 10);
  key.castShadow = true;
  kit.shadow(key, 2048);
  Object.assign(key.shadow.camera, { left: -18, right: 18, top: 14, bottom: -10, near: 1, far: 60 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.00015;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x55d9ff, 1.15);
  rim.position.set(-10, 8, -7);
  scene.add(rim);

  // ---------------------------------------------------------------- Pennywing
  const player = makePlayer(mat);
  root.add(player.group);

  // ---------------------------------------------------------------- guardians
  const bosses = { brassback: makeBrassback(mat), warden: makeWarden(mat) };
  for (const b of Object.values(bosses)) {
    b.group.visible = false;
    root.add(b.group);
  }

  // ---------------------------------------------------------------- pools
  const rockPool = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(dodeca(0.42), mat.stoneLight);
    m.castShadow = true;
    m.visible = false;
    root.add(m);
    rockPool.push(m);
  }
  const sparkPool = [];
  for (let i = 0; i < 4; i++) {
    const g = model([
      { g: sphere(0.2, 10, 8), m: mat.flame, cast: false },
      { g: cone(0.15, 0.55, 6), m: mat.flame, y: 0.25, cast: false },
      { g: cone(0.1, 0.4, 5), m: mat.flame, x: 0.12, y: 0.12, rz: -0.6, cast: false },
      { g: cone(0.1, 0.4, 5), m: mat.flame, x: -0.12, y: 0.12, rz: 0.6, cast: false },
    ]);
    g.visible = false;
    root.add(g);
    sparkPool.push(g);
  }

  // Particle bursts: one instanced batch with per-particle colour.
  const FX_MAX = 192;
  const fxMesh = createInstanced(octa(0.08), mat.fx, FX_MAX);
  fxMesh.frustumCulled = false;
  fxMesh.castShadow = false;
  const _c = new THREE.Color();
  // Every slot starts collapsed: a slot no burst has used yet would otherwise draw an
  // identity-matrix octahedron at the world origin whenever the batch is visible.
  const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < fxMesh.instanceMatrix.count; i++) {
    fxMesh.setMatrixAt(i, _zero);
    fxMesh.setColorAt(i, _c.set(0xffffff));
  }
  fxMesh.count = 0;
  fxMesh.visible = false;
  root.add(fxMesh);
  const particles = Array.from({ length: FX_MAX }, () => ({ live: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grav: 0, spin: 0 }));
  let fxCursor = 0;
  let fxLive = 0;

  // Dust motes drifting in front of the back wall (sized points, the same on both backends).
  const dustCount = kit.detail(140, 40);
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -6 + ((i * 17.17) % 124);
    dustPos[i * 3 + 1] = -4 + ((i * 9.31) % 13);
    dustPos[i * 3 + 2] = -2.8 + ((i * 5.77) % 4) * 0.75;
  }
  const dust = createPoints({ positions: dustPos, size: 0.065, sizeAttenuation: true, material: { color: 0xc8edf0, transparent: true, opacity: 0.32, depthWrite: false } });
  root.add(dust.object);

  // ---------------------------------------------------------------- per-vault state
  let level = null;
  let levelGroup = null;
  let labelTex = null;
  const keepGeo = new Set(geoCache.values());
  const L = {
    platforms: new Map(), // dynamic platforms only (moving, breakable): id -> { mesh, p }
    gates: {},
    coins: null,
    gems: null,
    relics: new Map(),
    crown: null,
    shrineCore: null,
    flames: [],
    rings: [],
    vents: [],
    enemies: new Map(),
    boss: null,
  };

  function applyTheme(theme) {
    scene.background.setHex(theme.background);
    scene.fog.color.setHex(theme.fog);
    scene.fog.density = theme.fogDensity;
    mat.stone.color.setHex(theme.stone);
    mat.stoneDark.color.setHex(theme.stoneDark);
    mat.stoneLight.color.setHex(theme.stoneLight);
    mat.water.color.setHex(theme.water);
    waterGlow.value.setHex(theme.waterGlow);
    hemi.color.setHex(theme.hemiSky);
    hemi.groundColor.setHex(theme.hemiGround);
  }

  function clearLevel() {
    if (!levelGroup) return;
    root.remove(levelGroup);
    for (const g of geoCache.values()) keepGeo.add(g);
    disposeTree(levelGroup, keepGeo);
    L.coins?.dispose();
    L.gems?.dispose();
    levelGroup = null;
    L.platforms.clear();
    L.gates = {};
    L.coins = L.gems = L.crown = L.shrineCore = null;
    L.relics.clear();
    L.flames.length = 0;
    L.rings.length = 0;
    L.vents.length = 0;
    L.enemies.clear();
  }

  function buildLevel(lv) {
    clearLevel();
    level = lv;
    applyTheme(lv.theme);
    const g = new THREE.Group();
    levelGroup = g;
    root.add(g);
    const stat = new Batch();
    const len = lv.length;

    // Cavern shell: back wall, ceiling, and the toy-brick block courses. They run well
    // past both ends so a 21:9 window zoomed out still sees wall, not the void.
    stat.add(box(len + 46, 18, 1.2), mat.stoneDark, { x: len / 2, y: 3.0, z: -4.3, cast: false });
    stat.add(box(len + 46, 1.0, 8), mat.black, { x: len / 2, y: 10.3, z: -1.0, cast: false });
    const blockGeo = box(2.85, 1.0, 0.44);
    const rows = lv.theme.wallRows || [0, 6];
    for (let row = rows[0]; row <= rows[1]; row++) {
      const odd = ((row % 2) + 2) % 2;
      for (let x = -22; x < len + 22; x += 3.2) {
        const sz = 0.8 + (((((x + row) % 3) + 3) % 3) * 0.06);
        stat.add(blockGeo, odd ? mat.stone : mat.stoneLight, { x: x + odd * 1.55, y: -0.5 + row * 1.55, z: -3.55, sz, cast: false });
      }
    }

    // Platforms: static ones merge; moving and breakable ones stay their own meshes.
    const studGeo = cyl(0.22, 0.22, 0.16, 10);
    for (const p of lv.platforms) {
      const material = p.breakable ? mat.brass : p.moving ? mat.cyan : mat.stone;
      if (p.moving || p.breakable) {
        const mesh = new THREE.Mesh(box(p.w, p.h, PLATFORM_DEPTH), material);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.position.set(p.x, p.y, 0);
        g.add(mesh);
        L.platforms.set(p.id, { mesh, p });
        continue;
      }
      stat.add(box(p.w, p.h, PLATFORM_DEPTH), material, { x: p.x, y: p.y });
      if (p.w > 3.1) {
        const count = Math.min(6, Math.max(2, Math.floor(p.w / 2.4)));
        for (let i = 0; i < count; i++) {
          stat.add(studGeo, material, { x: p.x - p.w * 0.38 + p.w * 0.76 * (count === 1 ? 0.5 : i / (count - 1)), y: p.y + p.h / 2 + 0.08, z: 1.34 });
        }
      }
    }

    // Rails.
    for (const r of lv.railings) {
      stat.add(box(r.w, 0.12, 0.12), mat.brass, { x: r.x, y: r.y + 0.8, z: 1.35 });
      for (const sx of [-r.w / 2, 0, r.w / 2]) stat.add(box(0.11, 1.65, 0.11), mat.brass, { x: r.x + sx, y: r.y, z: 1.35 });
    }

    // Signs: brass post, navy board, and a face from the vault's label atlas.
    labelTex?.dispose();
    labelTex = makeLabelAtlas(lv.signs.map((s) => s.text));
    mat.label.map = labelTex;
    mat.label.needsUpdate = true;
    lv.signs.forEach((s, i) => {
      stat.add(box(0.12, 1.15, 0.12), mat.brass, { x: s.x, y: s.y + 0.35, z: 1.45 });
      stat.add(box(2.15, 0.72, 0.14), mat.navy, { x: s.x, y: s.y + 1.0, z: 1.45 });
      const face = labelPlane(i, lv.signs.length);
      stat.add(face, mat.label, { x: s.x, y: s.y + 1.0, z: 1.45 + 0.081, cast: false, receive: false });
      face.dispose();
    });

    // Hazards: water pools, spike strips and steam vents.
    for (const h of lv.hazards) {
      if (h.type === 'water') {
        stat.add(box(h.w, h.h, 3.6), mat.water, { x: h.x, y: h.y, cast: false });
      } else if (h.type === 'spikes') {
        const count = Math.max(2, Math.floor(h.w / 0.32));
        for (let i = 0; i < count; i++) stat.add(cone(0.18, 0.65, 5), mat.brass, { x: h.x - h.w / 2 + ((i + 0.5) * h.w) / count, y: h.y + 0.22, z: 0.3 });
      } else if (h.type === 'vent') {
        stat.add(box(1.0, 0.12, 1.3), mat.brass, { x: h.x, y: h.base + 0.04, z: 0.3 });
        stat.add(box(0.16, 0.14, 1.3), mat.black, { x: h.x - 0.22, y: h.base + 0.08, z: 0.3, cast: false });
        stat.add(box(0.16, 0.14, 1.3), mat.black, { x: h.x + 0.22, y: h.base + 0.08, z: 0.3, cast: false });
        const column = new THREE.Mesh(cyl(0.3, 0.42, 1, 10, true), mat.steam);
        column.position.set(h.x, h.base, 0.3);
        column.visible = false;
        g.add(column);
        L.vents.push({ h, column });
      }
    }

    // Pillars, arches and torches give each vault its temple silhouette.
    for (const x of lv.scenery.pillars) {
      stat.add(cyl(0.52, 0.66, 7.4, 8), mat.stone, { x, y: 3.55, z: -2.6, sz: 0.75, cast: false });
      stat.add(box(1.65, 0.35, 1.15), mat.stoneLight, { x, y: 3.55 + 3.55, z: -2.6, cast: false });
      stat.add(box(1.48, 0.28, 1.05), mat.stoneLight, { x, y: 3.55 - 3.5, z: -2.6, cast: false });
    }
    lv.scenery.torches.forEach((x, i) => {
      const ty = 3.0 + (i % 2) * 0.6;
      stat.add(box(0.13, 0.85, 0.13), mat.brass, { x, y: ty, z: -1.9, rz: -0.25 });
      const flame = new THREE.Mesh(cone(0.24, 0.8, 7), mat.flame);
      flame.position.set(x, ty + 0.8, -1.9);
      flame.userData.phase = i * 0.7;
      g.add(flame);
      L.flames.push(flame);
    });
    for (const r of lv.scenery.rings || []) {
      const ring = new THREE.Group();
      ring.position.set(r.x, r.y, -3.0);
      ring.rotation.x = r.tilt;
      const spin = model([
        { g: torus(r.r, 0.09, 8, 48), m: mat.brass, cast: false },
        { g: torus(r.r * 0.62, 0.05, 6, 40), m: mat.brass, rx: Math.PI / 2, cast: false },
        { g: sphere(0.32, 12, 8), m: mat.gold, x: r.r, cast: false },
        { g: sphere(0.22, 10, 8), m: mat.gem, x: -r.r * 0.71, y: r.r * 0.71, cast: false },
        { g: sphere(0.18, 10, 8), m: mat.cream, x: -r.r * 0.5, y: -r.r * 0.87, cast: false },
      ]);
      spin.userData.speed = r.speed;
      ring.add(spin);
      g.add(ring);
      L.rings.push(spin);
    }

    // The Springsmith's shrine.
    const sh = lv.shrine;
    stat.add(cyl(0.95, 1.12, 0.45, 10), mat.brass, { x: sh.x, y: sh.y - 0.05 - 0.2, z: 0.7 });
    stat.add(torus(0.72, 0.09, 8, 24), mat.gold, { x: sh.x, y: sh.y - 0.05 + 0.64, z: 0.7, rx: Math.PI / 2 });
    const core = new THREE.Mesh(octa(0.48), mat.gem);
    core.castShadow = core.receiveShadow = true;
    core.position.set(sh.x, sh.y - 0.05 + 0.64, 0.7);
    g.add(core);
    L.shrineCore = core;

    // Gates: portcullis bars from the floor to the ceiling.
    const gate = (spec) => {
      const parts = [];
      for (let i = -2; i <= 2; i++) parts.push({ g: box(0.12, spec.h, 0.18), m: mat.brass, x: i * 0.15 });
      for (const y of [-spec.h / 2 + 1.25, -spec.h / 2 + 3.1]) parts.push({ g: box(0.82, 0.1, 0.22), m: mat.brass, y });
      parts.push({ g: box(0.9, 0.25, 0.28), m: mat.gold, y: -spec.h / 2 + 3.9 });
      const m = model(parts);
      m.position.set(spec.x, spec.y, 0.2);
      g.add(m);
      return m;
    };
    L.gates = { key: gate(lv.keyGate), arena: gate(lv.arenaLeftGate), vault: gate(lv.vaultGate) };

    // Pickups: coins and gems are one instanced batch each.
    const coinGeo = cached('coin', () => {
      const ring = torus(0.3, 0.095, 8, 20).clone();
      const face = cyl(0.17, 0.17, 0.08, 14).clone();
      face.rotateX(Math.PI / 2);
      const merged = mergeGeometries([ring, face], false);
      ring.dispose();
      face.dispose();
      return merged;
    });
    keepGeo.add(coinGeo);
    L.coins = createInstanced(coinGeo, mat.gold, lv.coins.length);
    L.gems = createInstanced(octa(0.42), mat.gem, lv.gems.length);
    for (const m of [L.coins, L.gems]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      g.add(m);
    }
    for (const r of lv.relics) {
      const parts = [{ g: torus(0.55, 0.12, 8, 20), m: mat.brass }];
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        parts.push({ g: box(0.18, 0.18, 0.22), m: mat.brass, x: Math.cos(a) * 0.7, y: Math.sin(a) * 0.7, rz: a });
      }
      if (r.id === 'star-key') parts.push({ g: octa(0.26), m: mat.gem, sy: 1.6 });
      const m = model(parts);
      m.position.set(r.x, r.y, 0.65);
      g.add(m);
      L.relics.set(r.id, m);
    }
    const cr = lv.crown;
    const star = cr.id === 'orrery-star';
    L.crown = model([
      star
        ? { g: octa(0.55), m: mat.gold, sy: 1.25, sz: 0.55 }
        : { g: sphere(0.48, 12, 8), m: mat.gold, sx: 1.0, sy: 1.18, sz: 0.45 },
      { g: torus(0.72, 0.07, 8, 28), m: mat.gem },
      { g: cyl(0.62, 0.48, 0.28, 8), m: mat.brass, y: -0.6 },
    ]);
    L.crown.position.set(cr.x, cr.y, 0.5);
    L.crown.visible = false;
    g.add(L.crown);

    // Enemies.
    for (const e of lv.enemies) {
      const m = e.kind === 'bat' ? makeBat(mat) : makeBeetle(mat);
      m.group.visible = true;
      g.add(m.group);
      L.enemies.set(e.id, m);
    }

    L.boss = bosses[lv.boss.model] || bosses.brassback;
    for (const b of Object.values(bosses)) b.group.visible = false;

    stat.build(g);
    for (const geo of geoCache.values()) keepGeo.add(geo);
  }

  // ---------------------------------------------------------------- particles
  const fxKinds = {
    coin: { n: 7, color: 0xffd85a, speed: 2.6, life: 0.45, size: 1, grav: 4 },
    gem: { n: 12, color: 0x7ff7ec, speed: 3.2, life: 0.6, size: 1.2, grav: 3 },
    relic: { n: 26, color: 0xffe08a, speed: 4.2, life: 0.9, size: 1.4, grav: 1 },
    crown: { n: 34, color: 0xfff1a8, speed: 4.6, life: 1.1, size: 1.5, grav: 0.5 },
    enemy: { n: 14, color: 0xe7b04a, speed: 3.6, life: 0.55, size: 1.2, grav: 9 },
    break: { n: 18, color: 0xd49b35, speed: 4.0, life: 0.7, size: 1.5, grav: 14 },
    bossHit: { n: 16, color: 0xffb23d, speed: 4.4, life: 0.5, size: 1.4, grav: 6 },
    bossDown: { n: 40, color: 0xffcf49, speed: 5.5, life: 1.2, size: 1.8, grav: 5 },
    slam: { n: 16, color: 0xb6cfd2, speed: 3.4, life: 0.55, size: 1.3, grav: 7, flat: true },
    land: { n: 6, color: 0x9fb8bd, speed: 1.6, life: 0.35, size: 1, grav: 3, flat: true },
    rock: { n: 10, color: 0x8fb0b3, speed: 3.0, life: 0.5, size: 1.4, grav: 12 },
    hurt: { n: 8, color: 0xff776e, speed: 2.8, life: 0.4, size: 1, grav: 4 },
  };

  function burst(kind, x, y, z = 0.7) {
    const k = fxKinds[kind];
    if (!k) return;
    // Fewer particles on the lower quality tiers.
    const n = Math.max(2, Math.round(k.n * Math.min(1, kit.tier.detail)));
    for (let i = 0; i < n; i++) {
      const idx = fxCursor;
      const pt = particles[idx];
      fxCursor = (fxCursor + 1) % FX_MAX;
      const a = k.flat ? (i % 2 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.7 : Math.random() * TAU;
      const sp = k.speed * (0.45 + Math.random() * 0.75);
      pt.live = true;
      pt.x = x;
      pt.y = y;
      pt.z = z + (Math.random() - 0.5) * 0.6;
      pt.vx = Math.cos(a) * sp;
      pt.vy = k.flat ? Math.abs(Math.sin(a)) * sp + 0.8 : Math.sin(a) * sp + 1.2;
      pt.vz = (Math.random() - 0.5) * 1.5;
      pt.life = pt.max = k.life * (0.7 + Math.random() * 0.5);
      pt.size = k.size * (0.7 + Math.random() * 0.6);
      pt.grav = k.grav;
      pt.spin = Math.random() * TAU;
      fxMesh.setColorAt(idx, _c.setHex(k.color));
    }
    fxMesh.instanceColor.needsUpdate = true;
    fxLive = Math.max(fxLive, 1);
  }

  const _o = new THREE.Object3D();
  function updateParticles(dt) {
    if (!fxLive) return;
    let live = 0;
    for (let i = 0; i < FX_MAX; i++) {
      const pt = particles[i];
      if (!pt.live) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.live = false;
        _o.scale.setScalar(0);
      } else {
        pt.vy -= pt.grav * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
        pt.spin += dt * 9;
        _o.position.set(pt.x, pt.y, pt.z);
        _o.rotation.set(pt.spin, pt.spin * 0.7, 0);
        _o.scale.setScalar(pt.size * Math.min(1, (pt.life / pt.max) * 1.6));
        live++;
      }
      _o.updateMatrix();
      fxMesh.setMatrixAt(i, _o.matrix);
    }
    fxMesh.count = FX_MAX;
    fxMesh.visible = live > 0;
    fxMesh.instanceMatrix.needsUpdate = true;
    fxLive = live;
  }

  // ---------------------------------------------------------------- per frame
  const _om = new THREE.Object3D();
  let landSquash = 0;

  function update(s, t, dt, simTime) {
    const lv = level;
    if (!lv) return;

    for (const [id, { mesh, p }] of L.platforms) {
      if (p.breakable) mesh.visible = !s.broken.has(id);
      if (p.moving) {
        const rt = s.movingRuntime.get(id);
        if (rt) mesh.position.set(rt.x, rt.y, 0);
      }
    }

    L.gates.key.visible = !s.hasGear;
    L.gates.arena.visible = s.boss.active && s.boss.alive;
    L.gates.vault.visible = s.boss.alive;

    // Pennywing.
    const ps = s.player;
    const P = player;
    P.group.position.set(ps.x, ps.y - 0.03, 0.36);
    P.facing.scale.x = ps.facing || 1;
    const speed = Math.min(1, Math.abs(ps.vx) / 6);
    const bob = ps.grounded ? Math.sin(t * 13) * 0.055 * speed : 0;
    P.body.position.y = -0.08 + bob;
    P.head.position.y = 0.51 + bob * 0.7;
    P.footL.rotation.z = Math.sin(t * 12) * 0.35 * speed;
    P.footR.rotation.z = -Math.sin(t * 12) * 0.35 * speed;
    P.staff.visible = ps.pogo;
    P.staff.position.y = ps.pogo ? -0.82 - Math.sin(t * 19) * 0.05 : -0.45;
    P.group.rotation.z = THREE.MathUtils.lerp(P.group.rotation.z, THREE.MathUtils.clamp(-ps.vx * 0.028, -0.12, 0.12), 1 - Math.exp(-7 * dt));
    landSquash = Math.max(0, landSquash - dt * 5);
    const stretch = ps.grounded ? 0 : THREE.MathUtils.clamp(ps.vy * 0.008, -0.06, 0.08);
    P.group.scale.set(1 + landSquash * 0.12, 1 - landSquash * 0.16 + stretch, 1);
    P.group.visible = ps.invuln <= 0 || Math.floor(t * 16) % 2 === 0;

    // Enemies.
    for (const e of s.enemies) {
      const m = L.enemies.get(e.id);
      if (!m) continue;
      m.group.visible = e.alive;
      if (!e.alive) continue;
      m.group.position.set(e.x, e.y - 0.08, 0.3);
      m.group.scale.x = e.dir || 1;
      if (m.wings) {
        const f = Math.sin(t * 18 + e.x) * 0.65;
        m.wings[0].rotation.z = f;
        m.wings[1].rotation.z = -f;
        m.group.rotation.z = Math.sin(t * 3 + e.x) * 0.08;
      } else {
        m.group.rotation.z = Math.sin(t * 8 + e.x) * 0.035;
      }
    }

    // Guardian.
    const bs = s.boss;
    const B = L.boss;
    B.group.position.set(bs.x, bs.y - 0.08, 0.35);
    B.facing.scale.x = bs.facing || 1;
    const charging = bs.mode === 'charge';
    B.group.rotation.z = bs.airborne ? -bs.facing * 0.12 : Math.sin(t * (charging ? 18 : 6)) * (charging ? 0.07 : 0.02);
    B.tell.visible = bs.alive && bs.mode === 'tell';
    if (B.tell.visible) B.tell.scale.setScalar(1 + Math.sin(t * 24) * 0.06);
    if (B.orbit) B.orbit.rotation.y += dt * (charging ? 7 : bs.airborne ? 5 : 1.4);
    B.group.visible = bs.alive && (bs.active || s.phase === 'guardian');
    if (bs.invuln > 0 && Math.floor(t * 18) % 2) B.group.visible = false;

    // Pickups.
    let n = 0;
    for (const c of lv.coins) {
      if (s.collected.has(c.id)) continue;
      const ph = c.x * 0.21;
      _om.position.set(c.x, c.y + Math.sin(t * 2.4 + ph) * 0.12, 0.65);
      _om.rotation.set(0, t * 1.8 + ph, Math.sin(t * 1.4 + ph) * 0.12);
      _om.updateMatrix();
      L.coins.setMatrixAt(n++, _om.matrix);
    }
    L.coins.count = n;
    L.coins.visible = n > 0;
    L.coins.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const c of lv.gems) {
      if (s.collected.has(c.id)) continue;
      const ph = c.x * 0.31;
      _om.position.set(c.x, c.y + Math.sin(t * 2.4 + ph) * 0.12, 0.65);
      _om.rotation.set(0, t * 1.8 + ph, Math.sin(t * 1.4 + ph) * 0.12);
      _om.updateMatrix();
      L.gems.setMatrixAt(n++, _om.matrix);
    }
    L.gems.count = n;
    L.gems.visible = n > 0;
    L.gems.instanceMatrix.needsUpdate = true;
    for (const r of lv.relics) {
      const m = L.relics.get(r.id);
      m.visible = !s.collected.has(r.id);
      if (!m.visible) continue;
      m.rotation.y = t * 1.8 + 1.2;
      m.rotation.z = Math.sin(t * 1.4 + 1.2) * 0.12;
      m.position.y = r.y + Math.sin(t * 2.4 + 1.2) * 0.12;
    }
    L.crown.visible = !bs.alive && !s.hasCrown;
    if (L.crown.visible) {
      L.crown.rotation.y = t * 1.1;
      L.crown.position.y = lv.crown.y + Math.sin(t * 2.0) * 0.12;
    }

    // Ambience.
    L.shrineCore.rotation.y = t * 1.6;
    L.shrineCore.position.y = lv.shrine.y - 0.05 + 0.64 + Math.sin(t * 2.2) * 0.07;
    for (const f of L.flames) {
      f.scale.y = 0.88 + Math.sin(t * 8 + f.userData.phase) * 0.14;
      f.rotation.z = Math.sin(t * 5 + f.userData.phase) * 0.12;
    }
    for (const r of L.rings) r.rotation.z = t * r.userData.speed;
    for (const v of L.vents) {
      const st = ventState(v.h, simTime);
      v.column.visible = st > 0;
      if (st === 2) {
        // The scalding column: a little taller than the hurt zone, like a plume.
        const sy = (v.h.h + 0.2) * (0.96 + Math.sin(t * 23) * 0.04);
        v.column.scale.set(1 + Math.sin(t * 31) * 0.06, sy, 1 + Math.cos(t * 27) * 0.06);
        v.column.position.y = v.h.base + sy / 2;
      } else if (st === 1) {
        const puff = 0.25 + Math.abs(Math.sin(t * 17)) * 0.2;
        v.column.scale.set(0.7, puff, 0.7);
        v.column.position.y = v.h.base + puff / 2;
      }
    }
    dust.object.rotation.y = Math.sin(t * 0.05) * 0.01;

    // Falling masonry and the Warden's sparks (pools; nothing is created per frame).
    for (let i = 0; i < rockPool.length; i++) {
      const m = rockPool[i];
      const r = s.rocks[i];
      m.visible = !!r;
      if (!r) continue;
      m.position.set(r.x, r.y, 0.35);
      m.rotation.set(r.rot * 0.7, r.rot, r.rot * 0.45);
    }
    for (let i = 0; i < sparkPool.length; i++) {
      const m = sparkPool[i];
      const sp = s.sparks[i];
      m.visible = !!sp;
      if (!sp) continue;
      m.position.set(sp.x, sp.y - 0.05, 0.35);
      m.rotation.y = t * 9;
      m.scale.setScalar(0.85 + Math.sin(t * 30 + i) * 0.15);
    }

    updateParticles(dt);
  }

  return {
    root,
    mat,
    key,
    buildLevel,
    burst,
    /** Compile the particle shader behind the title: a tiny burst hidden behind the back wall. */
    prewarm() {
      burst('coin', 2, 1, -9);
    },
    squash() {
      landSquash = 1;
    },
    update,
  };
}

// ---------------------------------------------------------------- models
function makePlayer(mat) {
  const group = new THREE.Group();
  const facing = new THREE.Group();
  group.add(facing);
  const mesh = (g, m, parent, o = {}) => {
    const x = new THREE.Mesh(g, m);
    x.castShadow = o.cast ?? true;
    x.receiveShadow = true;
    parent.add(x);
    return x;
  };
  const body = new THREE.Group();
  facing.add(body);
  body.position.y = -0.08;
  const torso = mesh(box(0.66, 0.72, 0.55), mat.cyan, body);
  torso.rotation.z = -0.02;
  const belly = mesh(box(0.54, 0.45, 0.05), mat.cream, body);
  belly.position.set(0.02, 0, 0.3);
  const head = model([
    { g: sphere(0.4, 10, 7), m: mat.cyan, sz: 0.82 },
    { g: cone(0.23, 0.48, 4), m: mat.orange, x: 0.39, y: -0.05, z: 0.03, rz: -Math.PI / 2 },
    { g: sphere(0.105, 8, 6), m: mat.white, x: 0.22, y: 0.12, z: 0.31 },
    { g: sphere(0.052, 7, 5), m: mat.black, x: 0.245, y: 0.115, z: 0.39 },
    { g: cyl(0.42, 0.42, 0.08, 12), m: mat.red, y: 0.34 },
    { g: cached('cap', () => new THREE.SphereGeometry(0.3, 10, 6, 0, TAU, 0, Math.PI / 2)), m: mat.red, y: 0.34 },
  ]);
  head.position.y = 0.51;
  facing.add(head);
  const footL = mesh(box(0.34, 0.15, 0.48), mat.orange, facing);
  footL.position.set(-0.18, -0.55, 0.04);
  const footR = mesh(box(0.34, 0.15, 0.48), mat.orange, facing);
  footR.position.set(0.18, -0.55, 0.04);
  const staff = model([
    { g: cyl(0.055, 0.055, 1.25, 8), m: mat.brass, y: -0.3 },
    { g: torus(0.15, 0.035, 6, 16), m: mat.gold, y: -0.86, rx: Math.PI / 2 },
    { g: cyl(0.16, 0.22, 0.16, 8), m: mat.red, y: -0.98 },
  ]);
  staff.position.set(0.34, -0.82, 0.06);
  staff.visible = false;
  facing.add(staff);
  return { group, facing, body, head, footL, footR, staff };
}

function makeBeetle(mat) {
  const parts = [
    { g: sphere(0.38, 8, 6), m: mat.brass, sx: 1.2, sy: 0.75, sz: 0.9 },
    { g: box(0.28, 0.28, 0.42), m: mat.navy, x: 0.38 },
    { g: sphere(0.055, 7, 5), m: mat.flame, x: 0.52, y: 0.05, z: 0.18, cast: false },
  ];
  for (const sy of [-1, 1]) for (const sx of [-0.18, 0.18]) parts.push({ g: box(0.3, 0.08, 0.08), m: mat.black, x: sx, y: -0.28, z: sy * 0.22, rz: sy * 0.28 });
  return { group: model(parts), wings: null };
}

function makeBat(mat) {
  const parts = [
    { g: cyl(0.3, 0.3, 0.16, 12), m: mat.brass, rx: Math.PI / 2 },
    { g: cyl(0.12, 0.12, 0.2, 8), m: mat.gold, rx: Math.PI / 2 },
    { g: box(0.22, 0.2, 0.26), m: mat.navy, x: 0.3, y: 0.02 },
    { g: sphere(0.06, 7, 5), m: mat.flame, x: 0.42, y: 0.06, z: 0.12, cast: false },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8 + 0.2;
    parts.push({ g: box(0.1, 0.12, 0.16), m: mat.brass, x: Math.cos(a) * 0.34, y: Math.sin(a) * 0.34, rz: a });
  }
  const group = model(parts);
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.14, side * 0.1);
    const w = new THREE.Mesh(box(0.62, 0.05, 0.34), mat.navy);
    w.position.set(-0.05, 0.22, 0);
    w.castShadow = true;
    pivot.add(w);
    group.add(pivot);
    wings.push(pivot);
  }
  return { group, wings };
}

function makeBrassback(mat) {
  const group = new THREE.Group();
  const facing = model([
    { g: dodeca(0.82), m: mat.brass, sx: 1.16, sy: 0.9, sz: 0.86 },
    { g: torus(0.54, 0.12, 8, 16), m: mat.gold, z: 0.58 },
    { g: box(0.62, 0.48, 0.62), m: mat.navy, x: 0.82, y: 0.02, z: 0.02 },
    { g: sphere(0.105, 8, 6), m: mat.flame, x: 1.14, y: 0.1, z: 0.25, cast: false },
    ...[-0.55, 0.1, 0.6].map((x) => ({ g: box(0.5, 0.16, 0.18), m: mat.black, x, y: -0.67, z: 0.3, rz: -0.18 })),
  ]);
  group.add(facing);
  const tell = new THREE.Mesh(torus(1.1, 0.06, 8, 28), mat.flame);
  tell.rotation.x = Math.PI / 2;
  tell.position.y = -0.63;
  tell.visible = false;
  group.add(tell);
  return { group, facing, tell, orbit: null };
}

function makeWarden(mat) {
  const group = new THREE.Group();
  const facing = model([
    { g: sphere(0.85, 14, 10), m: mat.brass, sy: 0.92, sz: 0.9 },
    { g: torus(0.86, 0.08, 8, 32), m: mat.gold, y: 0.08, rx: Math.PI / 2 },
    { g: cyl(0.22, 0.32, 0.3, 10), m: mat.gold, y: 0.86 },
    { g: sphere(0.12, 8, 6), m: mat.gem, y: 1.06 },
    { g: box(0.5, 0.42, 0.55), m: mat.navy, x: 0.92, y: -0.05 },
    { g: sphere(0.11, 8, 6), m: mat.flame, x: 1.18, y: 0.05, z: 0.22, cast: false },
    ...[-0.5, -0.1, 0.3, 0.65].map((x, i) => ({ g: box(0.42, 0.15, 0.18), m: mat.black, x, y: -0.78, z: i % 2 ? 0.32 : -0.32, rz: -0.2 })),
  ]);
  group.add(facing);
  const orbitHolder = new THREE.Group();
  orbitHolder.rotation.z = 0.35;
  const orbit = model([
    { g: torus(1.3, 0.05, 8, 40), m: mat.gold, rx: Math.PI / 2, cast: false },
    { g: sphere(0.17, 10, 8), m: mat.gem, x: 1.3 },
    { g: sphere(0.14, 10, 8), m: mat.flame, x: -0.65, z: 1.13, cast: false },
    { g: sphere(0.12, 10, 8), m: mat.cream, x: -0.65, z: -1.13 },
  ]);
  orbitHolder.add(orbit);
  group.add(orbitHolder);
  const tell = new THREE.Mesh(torus(1.2, 0.06, 8, 28), mat.flame);
  tell.rotation.x = Math.PI / 2;
  tell.position.y = -0.7;
  tell.visible = false;
  group.add(tell);
  return { group, facing, tell, orbit };
}
