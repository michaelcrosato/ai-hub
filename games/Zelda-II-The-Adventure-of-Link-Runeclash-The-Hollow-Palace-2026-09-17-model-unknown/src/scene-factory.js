import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, time, sin, positionWorld, color as tslColor } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PALETTE = {
  sky: 0x120f27,
  fog: 0x1b1734,
  stone: 0x4d4566,
  stoneDark: 0x2e2946,
  stoneLight: 0x746c8c,
  trim: 0xb58b58,
  gold: 0xf0c45e,
  ember: 0xff7048,
  cyan: 0x63e2dd,
  hero: 0x208e87,
  heroDark: 0x145b5b,
  scarf: 0xf0a24f,
  skin: 0xd69b73,
  steel: 0xb8c4d1,
  shield: 0x2b7181,
  bone: 0xd9d4c2,
  enemy: 0x8d435f,
  enemyDark: 0x382b45,
  boss: 0x553341,
  grass: 0x263f45,
  black: 0x14121c,
  white: 0xf8f0d8,
  robe: 0x4b3466,
  golem: 0x3d3446
};

// ------------------------------------------------------------------ materials
// One material per look, shared by every mesh and kept across palace rebuilds, so the
// renderer compiles each pipeline once. Materials changed at runtime pass { unique: true }.
const materialCache = new Map();

function standard(color, extra = {}) {
  const key = extra.unique ? null : `s|${color}|${JSON.stringify(extra)}`;
  if (key && materialCache.has(key)) return materialCache.get(key);
  const params = {
    color,
    roughness: extra.roughness ?? 0.78,
    metalness: extra.metalness ?? 0.04,
    flatShading: extra.flatShading ?? true,
    transparent: Boolean(extra.transparent),
    opacity: extra.opacity ?? 1,
    depthWrite: extra.depthWrite ?? true
  };
  if (extra.emissive != null) {
    params.emissive = extra.emissive;
    params.emissiveIntensity = extra.emissiveIntensity ?? 1;
  }
  const m = new THREE.MeshStandardNodeMaterial(params);
  m.name = extra.name ?? 'standard';
  if (key) materialCache.set(key, m);
  return m;
}

function basic(color, extra = {}) {
  const key = `b|${color}|${JSON.stringify(extra)}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const m = new THREE.MeshBasicNodeMaterial({
    color,
    transparent: Boolean(extra.transparent),
    opacity: extra.opacity ?? 1,
    depthWrite: extra.depthWrite ?? true
  });
  m.name = extra.name ?? 'basic';
  materialCache.set(key, m);
  return m;
}

/** Molten rock: a slow travelling glow in TSL, the same on WebGPU and WebGL2. */
function lavaMaterial() {
  const key = 'lava';
  if (materialCache.has(key)) return materialCache.get(key);
  const m = new THREE.MeshStandardNodeMaterial({ color: 0x5a160c, roughness: 0.6, metalness: 0, flatShading: true });
  const drift = sin(positionWorld.x.mul(1.7).add(time.mul(2.2))).mul(0.5).add(0.5);
  const swell = sin(positionWorld.z.mul(2.3).sub(time.mul(1.6))).mul(0.5).add(0.5);
  m.emissiveNode = tslColor(0xff4a1c).mul(drift.mul(0.45).add(swell.mul(0.25)).add(0.55));
  m.name = 'lava';
  materialCache.set(key, m);
  return m;
}

// ------------------------------------------------------------------ mesh helpers
function setShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function meshBox(parent, mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const mesh = setShadow(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function meshCylinder(parent, mat, rTop, rBottom, h, segments, x = 0, y = 0, z = 0) {
  const mesh = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** A geometry ready to merge: non-indexed, position/normal/uv only, moved by `matrix`. */
function prepared(geometry, matrix) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  g.morphAttributes = {};
  g.clearGroups();
  g.applyMatrix4(matrix);
  return g;
}

function mergeBucket(bucket) {
  if (bucket.geos.length === 1) return bucket.geos[0];
  const merged = mergeGeometries(bucket.geos, false);
  if (merged) for (const g of bucket.geos) g.dispose();
  return merged;
}

/**
 * Bake every mesh under `group` (which never moves) into one mesh per material and shadow
 * setting, added to `parent`. A palace is a few hundred boxes; this draws it in about a dozen calls.
 */
function bakeStatic(group, parent) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const sources = new Set();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const key = `${o.material.id}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] }));
    b.geos.push(prepared(o.geometry, o.matrixWorld));
    sources.add(o.geometry);
  });
  for (const g of sources) g.dispose();
  for (const b of buckets.values()) {
    const geo = mergeBucket(b);
    if (geo) {
      const mesh = setShadow(new THREE.Mesh(geo, b.material), b.cast, b.receive);
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    } else {
      // Attribute mismatch (should not happen with three's primitives): keep the pieces.
      for (const g of b.geos) parent.add(setShadow(new THREE.Mesh(g, b.material), b.cast, b.receive));
    }
  }
}

/**
 * Merge a rig's directly attached meshes that share a material (recursively per pivot),
 * so a character costs a handful of draw calls. Meshes marked userData.keep stay separate.
 */
function compactRig(group) {
  const buckets = new Map();
  for (const child of [...group.children]) {
    if (child.isMesh && !child.userData.keep) {
      child.updateMatrix();
      const key = `${child.material.id}|${child.castShadow ? 1 : 0}|${child.receiveShadow ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: child.material, cast: child.castShadow, receive: child.receiveShadow, geos: [], meshes: [] }));
      b.geos.push(prepared(child.geometry, child.matrix));
      b.meshes.push(child);
    } else if (!child.isMesh) {
      compactRig(child);
    }
  }
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) {
      for (const g of b.geos) g.dispose();
      continue;
    }
    const geo = mergeBucket(b);
    if (!geo) {
      for (const g of b.geos) g.dispose();
      continue;
    }
    for (const m of b.meshes) {
      group.remove(m);
      m.geometry.dispose();
    }
    group.add(setShadow(new THREE.Mesh(geo, b.material), b.cast, b.receive));
  }
  return group;
}

// ------------------------------------------------------------------ characters and props
function createPlayer() {
  const root = new THREE.Group();
  root.name = 'Runeclash Hero';

  const boot = standard(PALETTE.enemyDark, { roughness: 0.9 });
  const cloth = standard(PALETTE.hero, { roughness: 0.92 });
  const clothDark = standard(PALETTE.heroDark, { roughness: 0.95 });
  const skin = standard(PALETTE.skin, { roughness: 0.9 });
  const scarf = standard(PALETTE.scarf, { roughness: 0.8, emissive: 0x3d1800, emissiveIntensity: 0.2 });
  const steel = standard(PALETTE.steel, { roughness: 0.36, metalness: 0.72 });
  const shieldMat = standard(PALETTE.shield, { roughness: 0.45, metalness: 0.42 });
  const gold = standard(PALETTE.gold, { roughness: 0.35, metalness: 0.55 });

  meshBox(root, boot, 0.22, 0.5, 0.30, -0.18, -0.60, 0);
  meshBox(root, boot, 0.22, 0.5, 0.30, 0.18, -0.60, 0);
  meshBox(root, clothDark, 0.54, 0.24, 0.35, 0, -0.32, 0);
  meshBox(root, cloth, 0.62, 0.68, 0.36, 0, 0.04, 0);
  meshBox(root, scarf, 0.66, 0.12, 0.40, 0, 0.38, 0.01);

  const head = setShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), skin));
  head.position.set(0, 0.67, 0);
  root.add(head);
  meshBox(root, clothDark, 0.46, 0.15, 0.34, 0, 0.91, -0.02);
  const hood = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.62, 5), cloth));
  hood.rotation.z = -0.35;
  hood.position.set(-0.08, 1.08, -0.03);
  root.add(hood);

  // front arm and sword
  meshBox(root, cloth, 0.18, 0.48, 0.22, 0.38, 0.05, 0.05);
  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.46, 0.17, 0.14);
  root.add(swordPivot);
  meshBox(swordPivot, gold, 0.34, 0.09, 0.10, 0, 0, 0);
  meshBox(swordPivot, steel, 0.13, 0.86, 0.08, 0, 0.47, 0);
  const tip = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), steel));
  tip.position.y = 0.99;
  tip.rotation.z = Math.PI;
  swordPivot.add(tip);
  // The Ember Edge: a glowing core along the blade once the forge cache is opened.
  const edge = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.1), standard(PALETTE.ember, { roughness: 0.48, metalness: 0.08, emissive: PALETTE.ember, emissiveIntensity: 2.0 })), false, false);
  edge.position.set(0, 0.5, 0.01);
  edge.visible = false;
  edge.userData.keep = true;
  swordPivot.add(edge);

  // Shield and its boss turn together (the boss used to stay put while the shield rotated).
  const shieldPivot = new THREE.Group();
  shieldPivot.position.set(-0.42, 0.08, 0.25);
  root.add(shieldPivot);
  const shield = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 8), shieldMat));
  shield.rotation.x = Math.PI / 2;
  shieldPivot.add(shield);
  const shieldBoss = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.15, 8), gold));
  shieldBoss.rotation.x = Math.PI / 2;
  shieldBoss.position.z = 0.07;
  shieldPivot.add(shieldBoss);

  compactRig(root);
  return { root, swordPivot, shieldPivot, edge };
}

function createBlob() {
  const root = new THREE.Group();
  const bodyMat = standard(0x4a9e86, { roughness: 0.88, emissive: 0x06251f, emissiveIntensity: 0.16 });
  const eyeMat = basic(PALETTE.gold);
  const body = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.50, 0), bodyMat));
  body.scale.y = 0.7;
  root.add(body);
  meshBox(root, eyeMat, 0.09, 0.10, 0.08, 0.19, 0.08, 0.40).castShadow = false;
  meshBox(root, eyeMat, 0.09, 0.10, 0.08, -0.02, 0.08, 0.43).castShadow = false;
  compactRig(root);
  return { root, yOffset: -0.05 };
}

function createBone() {
  const root = new THREE.Group();
  const bone = standard(PALETTE.bone, { roughness: 0.92 });
  const wrap = standard(PALETTE.enemy, { roughness: 0.85 });
  const iron = standard(0x8a8e9c, { roughness: 0.48, metalness: 0.55 });
  const socket = basic(0x2c1835);
  meshBox(root, bone, 0.38, 0.42, 0.28, 0, 0.34, 0);
  meshBox(root, wrap, 0.48, 0.18, 0.31, 0, 0.18, 0);
  meshBox(root, bone, 0.18, 0.56, 0.18, -0.16, -0.32, 0);
  meshBox(root, bone, 0.18, 0.56, 0.18, 0.16, -0.32, 0);
  meshBox(root, bone, 0.46, 0.42, 0.35, 0, 0.78, 0);
  meshBox(root, socket, 0.08, 0.08, 0.03, 0.11, 0.82, 0.19).castShadow = false;
  meshBox(root, socket, 0.08, 0.08, 0.03, -0.11, 0.82, 0.19).castShadow = false;
  const bladePivot = new THREE.Group();
  bladePivot.position.set(0.33, 0.18, 0.03);
  root.add(bladePivot);
  meshBox(bladePivot, iron, 0.10, 0.72, 0.07, 0, 0.31, 0);
  compactRig(root);
  // Feet at the bottom of the hitbox (the model used to float a quarter unit up).
  return { root, swordPivot: bladePivot, yOffset: -0.25 };
}

function createSentinel(boss = false) {
  const root = new THREE.Group();
  const armor = standard(boss ? PALETTE.boss : 0x46516d, { roughness: 0.40, metalness: 0.58 });
  const dark = standard(PALETTE.enemyDark, { roughness: 0.75, metalness: 0.20 });
  const trim = standard(boss ? PALETTE.ember : PALETTE.trim, { roughness: 0.35, metalness: 0.58, emissive: boss ? 0x4a0d05 : 0x1b0d02, emissiveIntensity: boss ? 0.45 : 0.12 });
  const visor = basic(boss ? 0xff7b4e : 0x79e9e2);
  const blade = standard(PALETTE.steel, { roughness: 0.30, metalness: 0.8 });
  const scale = boss ? 1.25 : 1;
  root.scale.setScalar(scale);

  meshBox(root, dark, 0.24, 0.60, 0.32, -0.19, -0.43, 0);
  meshBox(root, dark, 0.24, 0.60, 0.32, 0.19, -0.43, 0);
  meshBox(root, armor, 0.72, 0.76, 0.43, 0, 0.14, 0);
  meshBox(root, trim, 0.74, 0.12, 0.46, 0, 0.18, 0.02);
  meshCylinder(root, armor, 0.34, 0.40, 0.50, 6, 0, 0.78, 0);
  meshBox(root, visor, 0.48, 0.07, 0.04, 0, 0.80, 0.37).castShadow = false;

  const shieldPivot = new THREE.Group();
  shieldPivot.position.set(-0.48, 0.17, 0.14);
  root.add(shieldPivot);
  const shield = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.14, 6), armor));
  shield.rotation.x = Math.PI / 2;
  shield.scale.y = 1.15;
  shieldPivot.add(shield);
  const bossMesh = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.17, 6), trim));
  bossMesh.rotation.x = Math.PI / 2;
  bossMesh.position.z = 0.08;
  shieldPivot.add(bossMesh);

  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.48, 0.25, 0.08);
  root.add(swordPivot);
  meshBox(swordPivot, trim, 0.32, 0.10, 0.10, 0, 0, 0);
  meshBox(swordPivot, blade, 0.13, boss ? 1.05 : 0.82, 0.08, 0, boss ? 0.54 : 0.43, 0);

  if (boss) {
    // Three uneven crown fins give the Warden a unique silhouette.
    for (let i = -1; i <= 1; i++) {
      const fin = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.48 + (i === 0 ? 0.15 : 0), 4), trim));
      fin.position.set(i * 0.22, 1.23 + (i === 0 ? 0.06 : 0), 0);
      fin.rotation.z = i * -0.16;
      root.add(fin);
    }
  }
  compactRig(root);
  return { root, shieldPivot, swordPivot, yOffset: boss ? -0.41 : -0.245 };
}

function createWisp(glow) {
  const root = new THREE.Group();
  const shell = standard(0x5b2a4a, { roughness: 0.6, metalness: 0.1, emissive: 0x2a0806, emissiveIntensity: 0.6 });
  const eye = basic(PALETTE.gold);
  const core = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), glow), false, false);
  core.userData.keep = true;
  root.add(core);
  const hood = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 5), shell));
  hood.position.y = 0.2;
  root.add(hood);
  const tail = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), shell));
  tail.rotation.z = Math.PI;
  tail.position.set(-0.08, -0.32, 0);
  root.add(tail);
  meshBox(root, eye, 0.07, 0.07, 0.05, 0.14, 0.12, 0.24).castShadow = false;
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.08, -0.05);
    const wing = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.62, 3), shell));
    wing.rotation.z = side * -1.25;
    wing.position.x = side * 0.28;
    pivot.add(wing);
    root.add(pivot);
    wings.push({ pivot, side });
  }
  compactRig(root);
  return { root, core, wings, yOffset: 0 };
}

function createCaster(glow) {
  const root = new THREE.Group();
  const robe = standard(PALETTE.robe, { roughness: 0.9 });
  const dark = standard(PALETTE.enemyDark, { roughness: 0.75, metalness: 0.2 });
  const bone = standard(PALETTE.bone, { roughness: 0.92 });
  const eye = basic(0xff7b4e);
  const body = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 6), robe));
  body.position.y = -0.2;
  root.add(body);
  meshBox(root, dark, 0.5, 0.12, 0.42, 0, 0.12, 0);
  const head = setShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), bone));
  head.position.y = 0.55;
  root.add(head);
  const hood = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.5, 5), dark));
  hood.position.set(-0.03, 0.72, -0.02);
  root.add(hood);
  meshBox(root, eye, 0.06, 0.05, 0.04, 0.1, 0.56, 0.2).castShadow = false;
  meshBox(root, robe, 0.16, 0.42, 0.18, 0.3, 0.08, 0.06);
  const orb = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glow), false, false);
  orb.position.set(0.42, 0.3, 0.12);
  orb.userData.keep = true;
  root.add(orb);
  compactRig(root);
  return { root, orb, yOffset: 0 };
}

function createGolem(glow) {
  const root = new THREE.Group();
  const rock = standard(PALETTE.golem, { roughness: 0.95 });
  const dark = standard(PALETTE.stoneDark, { roughness: 0.96 });
  const crust = standard(PALETTE.ember, { roughness: 0.35, metalness: 0.58, emissive: 0x4a0d05, emissiveIntensity: 0.45 });
  const visor = basic(0xff7b4e);
  meshBox(root, dark, 0.46, 0.9, 0.52, -0.34, -1.0, 0);
  meshBox(root, dark, 0.46, 0.9, 0.52, 0.34, -1.0, 0);
  meshBox(root, rock, 1.3, 1.2, 0.82, 0, 0.0, 0);
  meshBox(root, crust, 1.34, 0.14, 0.86, 0, -0.42, 0.01);
  meshBox(root, rock, 0.62, 0.48, 0.58, 0.04, 0.86, 0);
  meshBox(root, visor, 0.42, 0.08, 0.04, 0.08, 0.9, 0.3).castShadow = false;
  meshBox(root, crust, 0.52, 0.36, 0.66, -0.78, 0.52, 0);
  meshBox(root, crust, 0.52, 0.36, 0.66, 0.78, 0.52, 0);
  const core = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), glow), false, false);
  core.position.set(0.05, 0.12, 0.44);
  core.userData.keep = true;
  root.add(core);
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.82, 0.5, 0);
    meshBox(pivot, rock, 0.4, 1.1, 0.46, 0, -0.55, 0);
    meshBox(pivot, dark, 0.5, 0.36, 0.52, 0, -1.12, 0);
    root.add(pivot);
    arms.push({ pivot, side });
  }
  compactRig(root);
  return { root, core, arms, yOffset: 0 };
}

function createChest(color) {
  const root = new THREE.Group();
  const wood = standard(color, { roughness: 0.78 });
  const metal = standard(PALETTE.gold, { roughness: 0.38, metalness: 0.58, emissive: 0x281700, emissiveIntensity: 0.16 });
  meshBox(root, wood, 0.92, 0.48, 0.70, 0, 0, 0);
  meshBox(root, metal, 0.16, 0.52, 0.74, 0, 0.02, 0.02);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.24, -0.30);
  root.add(lidPivot);
  meshBox(lidPivot, wood, 0.96, 0.22, 0.70, 0, 0.10, 0.30);
  meshBox(lidPivot, metal, 0.16, 0.24, 0.74, 0, 0.10, 0.30);
  compactRig(root);
  return { root, lidPivot };
}

function createSign(x, y) {
  const root = new THREE.Group();
  const stone = standard(PALETTE.stoneLight, { roughness: 0.96 });
  meshBox(root, stone, 0.16, 0.72, 0.18, 0, -0.18, 0);
  const plate = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), stone));
  plate.scale.set(1.2, 0.82, 0.35);
  plate.position.y = 0.28;
  root.add(plate);
  root.position.set(x, y, 0.65);
  return root;
}

// ------------------------------------------------------------------ burst particles
/** Every hit spark and dust puff in one instanced batch (one draw call, no per-hit materials). */
function createBursts(kit, parent) {
  const cap = kit.detail(240, 80);
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.name = 'burst';
  const mesh = kit.instanced(new THREE.BoxGeometry(0.08, 0.08, 0.08), material, cap);
  const alloc = mesh.instanceMatrix.count;
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(alloc), 1);
  fade.setUsage(THREE.DynamicDrawUsage);
  material.opacityNode = instancedBufferAttribute(fade);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const tmpColor = new THREE.Color(1, 1, 1);
  mesh.setColorAt(0, tmpColor);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);

  const parts = [];
  for (let i = 0; i < cap; i++) parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1 });
  let active = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);

  // One particle far below the view on the first frames, so the batch's shaders compile
  // while the title screen shows instead of on the first hit.
  const warm = parts[active++];
  Object.assign(warm, { x: 0, y: -60, z: 0, vx: 0, vy: 0, vz: 0, life: 0.6, maxLife: 0.6 });

  function spawn(event) {
    const count = Math.min(event.count ?? 8, 28);
    tmpColor.set(event.color ?? '#ffffff');
    for (let i = 0; i < count; i++) {
      // A full pool recycles the oldest-placed slot rather than dropping the burst.
      const slot = active < cap ? active++ : (i % cap);
      const p = parts[slot];
      const a = (i / Math.max(1, count)) * Math.PI * 2 + (event.x * 0.13);
      const speed = 1.8 + (i % 4) * 0.45;
      p.x = event.x;
      p.y = event.y;
      p.z = 0.35 + (i % 3) * 0.08;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed + 2.0;
      p.vz = ((i % 5) - 2) * 0.35;
      p.rx = 0;
      p.ry = 0;
      p.life = 0.52 + (i % 3) * 0.08;
      p.maxLife = 0.7;
      p.r = tmpColor.r;
      p.g = tmpColor.g;
      p.b = tmpColor.b;
    }
  }

  function update(dt) {
    for (let i = 0; i < active;) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        parts[i] = parts[active - 1];
        parts[active - 1] = p;
        active--;
        continue;
      }
      p.vy -= 8.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += dt * 7;
      p.ry += dt * 5;
      e.set(p.rx, p.ry, 0);
      q.setFromEuler(e);
      pos.set(p.x, p.y, p.z);
      m4.compose(pos, q, scl);
      mesh.setMatrixAt(i, m4);
      tmpColor.setRGB(p.r, p.g, p.b);
      mesh.setColorAt(i, tmpColor);
      fade.array[i] = Math.max(0, Math.min(0.95, p.life / p.maxLife));
      i++;
    }
    mesh.count = active;
    mesh.visible = active > 0;
    if (active > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      fade.needsUpdate = true;
    }
  }

  return { spawn, update, material, mesh };
}

// ------------------------------------------------------------------ the palace
export function createSceneVisuals({ scene, world, kit }) {
  const level = world.level;
  const root = new THREE.Group();
  root.name = 'Palace Visuals';
  scene.add(root);
  const statics = new THREE.Group(); // baked into a few merged meshes at the end

  const stone = standard(PALETTE.stone, { roughness: 0.92 });
  const stoneDark = standard(PALETTE.stoneDark, { roughness: 0.96 });
  const stoneLight = standard(PALETTE.stoneLight, { roughness: 0.90 });
  const trim = standard(PALETTE.trim, { roughness: 0.62, metalness: 0.22 });
  const ember = standard(PALETTE.ember, { roughness: 0.48, metalness: 0.08, emissive: PALETTE.ember, emissiveIntensity: 2.0 });
  const cyanGlow = standard(PALETTE.cyan, { roughness: 0.42, emissive: PALETTE.cyan, emissiveIntensity: 1.8 });
  const towerMat = standard(0x211d3b, { roughness: 1 });
  const roofMat = standard(0x31264b, { roughness: 1 });

  // Back wall and distant toy-like tower silhouettes.
  const bd = level.backdrop;
  meshBox(statics, stoneDark, bd.wallW, 15, 0.65, bd.wallX, 5.4, -3.7);
  for (const x of bd.towers) {
    const tower = new THREE.Group();
    tower.position.set(x, 4.5 + (x % 3) * 0.45, -5.1);
    meshBox(tower, towerMat, 5.8, 9.5, 2.1, 0, 0, 0);
    const roof = setShadow(new THREE.Mesh(new THREE.ConeGeometry(3.6, 3.2, 5), roofMat), false, true);
    roof.position.y = 6.2;
    tower.add(roof);
    statics.add(tower);
  }

  // Platforms and stairs, with trim strips that keep edges readable on a phone.
  for (const s of level.solids) {
    const material = s.kind === 'catch' ? stoneDark : s.kind === 'boss' ? stoneLight : stone;
    meshBox(statics, material, s.w, s.h, 4.3, s.x, s.y, 0);
  }
  for (const s of level.solids) {
    if (s.kind === 'catch') continue;
    meshBox(statics, trim, Math.max(0.5, s.w - 0.05), 0.10, 4.45, s.x, s.top - 0.05, 0).castShadow = false;
  }

  // Columns and low-poly arches.
  for (const x of level.columns) {
    meshBox(statics, stoneLight, 0.62, 7.5, 0.8, x, 4.0, -2.95);
    meshBox(statics, trim, 0.86, 0.22, 0.92, x, 7.6, -2.92);
    meshBox(statics, trim, 0.86, 0.22, 0.92, x, 0.35, -2.92);
  }

  // Railings are clearly visible but deliberately non-colliding to keep mobile traversal clean.
  for (const r of level.railings) {
    const z = 1.72;
    const left = r.x - r.w / 2;
    const right = r.x + r.w / 2;
    const count = Math.max(2, Math.floor(r.w / 1.3));
    for (let i = 0; i <= count; i++) {
      const px = left + (r.w * i / count);
      meshBox(statics, trim, 0.10, 0.72, 0.10, px, r.top + 0.36, z);
    }
    meshBox(statics, trim, r.w + 0.15, 0.11, 0.12, (left + right) / 2, r.top + 0.74, z);
  }

  const flameGeo = new THREE.OctahedronGeometry(0.26, 0);
  const torchFlames = [];
  for (const t of level.torches) {
    meshBox(statics, trim, 0.14, 0.46, 0.16, t.x, 2.1 + t.y, -2.45);
    const flame = setShadow(new THREE.Mesh(flameGeo, ember), false, false);
    flame.position.set(t.x, 2.48 + t.y, -2.42);
    root.add(flame);
    torchFlames.push({ mesh: flame, phase: t.x * 0.17 });
  }

  // Lava: glowing basins in the pits; the hazard boxes themselves sit a little lower.
  const lava = lavaMaterial();
  for (const hz of level.hazards) {
    const top = hz.y + hz.h / 2;
    meshBox(statics, lava, hz.w + 0.3, 0.9, 4.25, hz.x, top - 0.45, 0).castShadow = false;
  }

  for (const s of level.signs) statics.add(createSign(s.x, s.y));

  // Door.
  const door = new THREE.Group();
  door.position.set(level.door.x, level.door.y, 0);
  meshBox(door, stoneLight, 1.10, 5.0, 3.9, 0, 0, 0);
  for (const yy of [-1.5, -0.5, 0.5, 1.5]) meshBox(door, trim, 1.22, 0.12, 4.05, 0, yy, 0.02);
  const doorMark = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), level.door.style === 'ember' ? ember : cyanGlow), false, false);
  doorMark.position.set(0, 0.25, 2.05);
  doorMark.userData.keep = true;
  door.add(doorMark);
  compactRig(door);
  root.add(door);

  // Boss barrier is a set of glowing vertical bars. Unshadowed like the torch flames, so it
  // reuses their compiled pipeline when it first appears mid-run.
  const barrier = new THREE.Group();
  barrier.position.set(level.bossBarrier.x, 3.3, 0);
  for (let i = -2; i <= 2; i++) {
    const bar = setShadow(meshBox(barrier, ember, 0.12, 5.0, 0.18, 0, i * 0.46, 0.2), false, false);
    bar.rotation.z = i * 0.035;
  }
  compactRig(barrier);
  root.add(barrier);

  // Chests and their floating glyphs.
  const chests = [];
  const addChest = (spot, color, glyphGeo, glyphMat, glyphLift, flag) => {
    if (!spot) return;
    const c = createChest(color);
    c.root.position.set(spot.x, spot.y, 0.35);
    root.add(c.root);
    const glyph = setShadow(new THREE.Mesh(glyphGeo, glyphMat), false, false);
    glyph.position.set(spot.x, spot.y + glyphLift, 0.40);
    root.add(glyph);
    chests.push({ ...c, glyph, spot, lift: glyphLift, flag, open: 0, spin: 2.2 + chests.length * 0.5, phase: chests.length });
  };
  addChest(level.keyChest, 0x665075, new THREE.TorusGeometry(0.22, 0.06, 5, 10), cyanGlow, 0.85, 'keyCollected');
  addChest(level.gearChest, 0x6a3e35, new THREE.OctahedronGeometry(0.25, 0), ember, 0.92, 'gearCollected');
  addChest(level.vesselChest, 0x7a2f3b, new THREE.OctahedronGeometry(0.25, 0), standard(0xff6b77, { roughness: 0.4, emissive: 0xff3b55, emissiveIntensity: 1.6 }), 0.92, 'vesselCollected');

  // Braziers (the Undercroft's gate seals).
  const braziers = [];
  const coalMat = standard(PALETTE.black, { roughness: 1 });
  for (const b of level.braziers) {
    meshCylinder(statics, trim, 0.12, 0.2, 0.62, 6, b.x, b.top + 0.31, 0.75);
    meshCylinder(statics, stoneLight, 0.38, 0.2, 0.28, 6, b.x, b.top + 0.74, 0.75);
    const coal = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), coalMat), true, true);
    coal.position.set(b.x, b.top + 0.9, 0.75);
    root.add(coal);
    const flame = setShadow(new THREE.Mesh(flameGeo, ember), false, false);
    flame.position.set(b.x, b.top + 1.12, 0.75);
    flame.scale.setScalar(1.4);
    flame.visible = false;
    root.add(flame);
    braziers.push({ id: b.id, coal, flame, phase: b.x * 0.31 });
  }

  // Completion altar.
  meshBox(statics, stoneLight, 1.6, 0.6, 1.4, level.altar.x, level.altar.y - 0.22, 0);
  meshBox(statics, trim, 1.2, 0.12, 1.5, level.altar.x, level.altar.y + 0.10, 0);
  const altarCrystalMat = standard(PALETTE.cyan, { roughness: 0.28, metalness: 0.08, emissive: PALETTE.cyan, emissiveIntensity: 0.25, unique: true });
  const altarCrystal = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), altarCrystalMat));
  altarCrystal.position.set(level.altar.x, level.altar.y + 0.75, 0);
  root.add(altarCrystal);

  bakeStatic(statics, root);

  const playerVisual = createPlayer();
  root.add(playerVisual.root);

  const enemies = new Map();
  for (const e of world.enemies) {
    let v;
    if (e.type === 'blob') v = createBlob();
    else if (e.type === 'bone') v = createBone();
    else if (e.type === 'sentinel') v = createSentinel(false);
    else if (e.type === 'boss') v = createSentinel(true);
    else if (e.type === 'wisp') v = createWisp(ember);
    else if (e.type === 'caster') v = createCaster(ember);
    else v = createGolem(ember);
    v.root.name = e.id;
    root.add(v.root);
    enemies.set(e.id, v);
  }

  // Projectiles and pickups come from small pools (shared geometry and material per kind).
  const shapes = {
    spark: { geo: new THREE.OctahedronGeometry(0.20, 0), mat: basic(PALETTE.cyan), scale: [1, 1, 1] },
    ash: { geo: new THREE.OctahedronGeometry(0.24, 0), mat: basic(PALETTE.ember), scale: [1, 1, 1] },
    wave: { geo: new THREE.OctahedronGeometry(0.3, 0), mat: ember, scale: [0.9, 1.15, 1.7] },
    heal: { geo: new THREE.OctahedronGeometry(0.20, 0), mat: basic(0xff6b77), scale: [1, 1, 1] },
    mana: { geo: null, mat: basic(0x7a8cff), scale: [1, 1, 1] }
  };
  shapes.mana.geo = shapes.heal.geo;
  const free = { spark: [], ash: [], wave: [], heal: [], mana: [] };
  const takeMesh = (kind) => {
    const shape = shapes[kind] || shapes.ash;
    const list = free[kind] || free.ash;
    let mesh = list.pop();
    if (!mesh) {
      mesh = setShadow(new THREE.Mesh(shape.geo, shape.mat), false, false);
      mesh.scale.set(shape.scale[0], shape.scale[1], shape.scale[2]);
      mesh.userData.kind = kind;
      mesh.frustumCulled = false; // tiny, and the warm-up copies must draw while out of view
      root.add(mesh);
    }
    mesh.visible = true;
    return mesh;
  };
  const releaseMesh = (mesh) => {
    mesh.visible = false;
    (free[mesh.userData.kind] || free.ash).push(mesh);
  };
  // One of each kind drawn far below the view on the first frames: their pipelines compile
  // during the title screen rather than on the first spark.
  const warmups = Object.keys(shapes).map((kind) => {
    const m = takeMesh(kind);
    m.position.set(0, -60, 0);
    return m;
  });
  let warmFrames = 3;

  const projectileVisuals = new Map();
  const pickupVisuals = new Map();
  const bursts = createBursts(kit, root);

  let frameStamp = 0;
  let doorOpen = world.doorUnlocked ? 1 : 0;
  for (const c of chests) c.open = world[c.flag] ? 1 : 0;

  function sync(worldState, dt, vt) {
    frameStamp++;
    if (warmFrames > 0 && --warmFrames === 0) for (const m of warmups) releaseMesh(m);

    const t = worldState.time;
    const p = worldState.player;
    playerVisual.root.position.set(p.x, p.y, 0.3);
    playerVisual.root.scale.x = p.facing;
    playerVisual.root.visible = !(p.invuln > 0 && Math.floor(t * 22) % 2 === 0);
    playerVisual.shieldPivot.rotation.z += ((p.guarding ? -0.55 : 0) - playerVisual.shieldPivot.rotation.z) * Math.min(1, dt * 16);
    if (p.attackTimer > 0) {
      const progress = 1 - p.attackTimer / 0.34;
      playerVisual.swordPivot.rotation.z = -1.2 + Math.sin(Math.min(1, progress) * Math.PI) * 2.15;
    } else {
      playerVisual.swordPivot.rotation.z += (-0.55 - playerVisual.swordPivot.rotation.z) * Math.min(1, dt * 16);
    }
    playerVisual.edge.visible = p.swordTier > 1;
    const runBob = p.grounded ? Math.sin(t * 16) * Math.min(0.055, Math.abs(p.vx) * 0.012) : 0;
    playerVisual.root.position.y += runBob;

    for (const e of worldState.enemies) {
      const v = enemies.get(e.id);
      if (!v) continue;
      v.root.visible = e.alive && !(e.invuln > 0 && Math.floor(t * 26) % 2 === 0);
      if (!e.alive) continue;
      v.root.position.set(e.x, e.y + v.yOffset, 0.25);
      v.root.scale.x = Math.abs(v.root.scale.x) * e.facing;
      const bob = e.type === 'blob' ? Math.sin(t * 9 + e.phase) * 0.08 : e.type === 'wisp' ? Math.sin(vt * 5 + e.phase) * 0.06 : Math.sin(t * 5 + e.phase) * 0.025;
      v.root.position.y += bob;
      if (v.shieldPivot) v.shieldPivot.rotation.z += ((e.guarding ? -0.45 : 0.10) - v.shieldPivot.rotation.z) * Math.min(1, dt * 12);
      if (v.swordPivot) {
        const span = e.type === 'boss' ? 0.76 : e.type === 'bone' ? 0.52 : 0.68;
        const swing = e.attackTimer > 0 ? Math.sin((1 - e.attackTimer / span) * Math.PI) * 1.7 : 0;
        v.swordPivot.rotation.z = -0.4 + swing;
      }
      if (v.wings) {
        const rate = e.mode === 'dive' ? 26 : e.mode === 'windup' ? 34 : 13;
        for (const w of v.wings) w.pivot.rotation.z = w.side * Math.sin(vt * rate + e.phase) * 0.55;
        const s = e.mode === 'windup' ? 1.4 + Math.sin(vt * 40) * 0.2 : 1;
        v.core.scale.setScalar(s);
        v.root.rotation.z = e.mode === 'dive' ? -0.5 * e.facing : 0; // nose down along the dive
      }
      if (v.orb) {
        const charge = e.attackTimer > 0 ? 1 + (1 - e.attackTimer / 0.62) * 1.2 : 1 + Math.sin(vt * 3 + e.phase) * 0.12;
        v.orb.scale.setScalar(charge);
        v.orb.rotation.y += dt * 3;
      }
      if (v.arms) {
        // Mirrored poses swing each arm outward by `spread`; `swing` turns both the same way
        // (local +x is forward because the rig is flipped with its facing).
        let spread = 0.15;
        let swing = null;
        if (e.leaping) spread = 2.3;
        else if (e.attackTimer > 0) {
          if (e.bossMove === 1) spread = e.attackTimer > 0.3 ? 2.7 : -0.2; // raise overhead, then slam
          else if (e.bossMove === 2) swing = -0.8; // crouch with arms back
          else swing = 1.35; // spray: both arms forward
        }
        const snap = e.bossMove === 1 && e.attackTimer > 0 && e.attackTimer <= 0.3 ? 24 : 9;
        for (const a of v.arms) {
          const goal = swing ?? a.side * spread;
          a.pivot.rotation.z += (goal - a.pivot.rotation.z) * Math.min(1, dt * snap);
        }
        const enraged = e.hp < e.maxHp * 0.5;
        v.core.scale.setScalar(1 + Math.sin(vt * (enraged ? 11 : 6)) * (enraged ? 0.3 : 0.18));
      }
    }

    for (const pr of worldState.projectiles) {
      let v = projectileVisuals.get(pr.id);
      if (!v) {
        v = { mesh: takeMesh(pr.type), stamp: 0 };
        projectileVisuals.set(pr.id, v);
      }
      v.stamp = frameStamp;
      v.mesh.visible = pr.alive;
      v.mesh.position.set(pr.x, pr.y, 0.45);
      if (pr.type === 'wave') {
        v.mesh.rotation.x += dt * 3;
        v.mesh.scale.y = 1.15 + Math.sin(vt * 30) * 0.2;
      } else {
        v.mesh.rotation.x += dt * 8;
        v.mesh.rotation.y += dt * 11;
      }
    }
    for (const [id, v] of projectileVisuals) {
      if (v.stamp !== frameStamp) {
        releaseMesh(v.mesh);
        projectileVisuals.delete(id);
      }
    }

    for (const item of worldState.pickups) {
      if (!item.alive) continue;
      let v = pickupVisuals.get(item.id);
      if (!v) {
        v = { mesh: takeMesh(item.type === 'heal' ? 'heal' : 'mana'), stamp: 0 };
        pickupVisuals.set(item.id, v);
      }
      v.stamp = frameStamp;
      v.mesh.position.set(item.x, item.y, 0.5);
      v.mesh.rotation.y += dt * 3.2;
    }
    for (const [id, v] of pickupVisuals) {
      if (v.stamp !== frameStamp) {
        releaseMesh(v.mesh);
        pickupVisuals.delete(id);
      }
    }

    doorOpen += ((worldState.doorUnlocked ? 1 : 0) - doorOpen) * Math.min(1, dt * 5.2);
    door.position.y = level.door.y + doorOpen * 6.5;
    doorMark.rotation.z += dt * 1.4;

    barrier.visible = worldState.bossFight && !worldState.bossDefeated;
    barrier.rotation.y = Math.sin(vt * 3) * 0.03;

    for (const c of chests) {
      const taken = Boolean(worldState[c.flag]);
      c.open += ((taken ? 1 : 0) - c.open) * Math.min(1, dt * 8);
      c.lidPivot.rotation.x = -c.open * 1.10;
      c.glyph.visible = !taken;
      c.glyph.rotation.y += dt * c.spin;
      c.glyph.position.y = c.spot.y + c.lift + Math.sin(vt * 3 + c.phase) * 0.08;
    }

    for (const b of braziers) {
      const lit = worldState.braziersLit.has(b.id);
      b.flame.visible = lit;
      b.coal.visible = !lit;
      if (lit) {
        const pulse = 1.4 + Math.sin(vt * 9 + b.phase) * 0.18;
        b.flame.scale.set(pulse, pulse * (1.1 + Math.sin(vt * 12 + b.phase) * 0.15), pulse);
        b.flame.rotation.y += dt * 1.3;
      }
    }

    altarCrystal.rotation.y += dt * (worldState.bossDefeated ? 2.8 : 0.6);
    altarCrystal.position.y = level.altar.y + 0.75 + Math.sin(vt * (worldState.bossDefeated ? 4 : 1.5)) * 0.08;
    const glowNow = worldState.bossDefeated ? 2.6 : 0.18;
    if (altarCrystalMat.emissiveIntensity !== glowNow) altarCrystalMat.emissiveIntensity = glowNow;

    for (const f of torchFlames) {
      const pulse = 1 + Math.sin(vt * 8 + f.phase) * 0.13;
      f.mesh.scale.set(pulse, 1.08 + Math.sin(vt * 11 + f.phase) * 0.15, pulse);
      f.mesh.rotation.y += dt * 0.9;
    }

    bursts.update(dt);
  }

  function dispose() {
    const geos = new Set();
    root.traverse((obj) => {
      if (obj.geometry) geos.add(obj.geometry);
    });
    for (const g of geos) g.dispose();
    bursts.mesh.dispose();
    altarCrystalMat.dispose();
    bursts.material.dispose();
    scene.remove(root);
  }

  return { root, sync, spawnBurst: bursts.spawn, dispose, palette: PALETTE };
}
