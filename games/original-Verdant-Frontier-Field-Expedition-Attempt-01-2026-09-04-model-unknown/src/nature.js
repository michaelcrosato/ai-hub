import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD, CAIRNS } from './config.js';

const moveGeo = (g, x, y, z) => { g.translate(x, y, z); return g; };
const shapeGeo = (g, sx, sy, sz, x, y, z) => { g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
function merged(parts) {
  // Icosahedra are non-indexed; cylinders and cones are indexed. Normalise the
  // inputs before merging so flower and mushroom geometry is always valid.
  const flat = parts.map(g => g.index ? g.toNonIndexed() : g), result = mergeGeometries(flat, false);
  for (const g of new Set([...parts, ...flat])) g.dispose();
  if (!result) throw new Error('Plant geometry could not be built.'); return result;
}

// Small plants only draw near the player; they also skip casting shadows (too small to read).
const NEAR_ONLY = new Set(['grass', 'flower', 'mushroom', 'reed', 'edelweiss']);
const NO_SHADOW = new Set(['grass', 'flower', 'mushroom', 'lily', 'edelweiss']);
const WIND = ['pine', 'crown', 'grass', 'flower', 'reed', 'edelweiss', 'sage'];
const CELL = 256;

export class NatureSystem {
  constructor(scene, terrain, rendering) {
    this.scene = scene; this.terrain = terrain; this.kernel = terrain.kernel; this.rendering = rendering; this.cells = new Map(); this.queue = []; this.lastKey = ''; this.range = 0; this.elapsed = 0; this.visibilityTimer = 0;
    this.geometries = {
      trunk: moveGeo(new THREE.CylinderGeometry(0.15, 0.38, 10, 5), 0, 5, 0),
      pine: merged([moveGeo(new THREE.ConeGeometry(3.6, 7.5, 6), 0, 7.5, 0), moveGeo(new THREE.ConeGeometry(2.9, 6.4, 6), 0, 10.2, 0), moveGeo(new THREE.ConeGeometry(2.1, 5.5, 6), 0, 12.4, 0)]),
      crown: moveGeo(new THREE.IcosahedronGeometry(4.4, 0), 0, 10, 0),
      rock: new THREE.IcosahedronGeometry(1, 0),
      shrub: moveGeo(new THREE.IcosahedronGeometry(1.2, 0), 0, 0.8, 0),
      grass: merged([moveGeo(new THREE.ConeGeometry(0.2, 0.8, 3), 0, 0.4, 0), moveGeo(new THREE.ConeGeometry(0.16, 0.55, 3), 0.18, 0.28, 0.13)]),
      flower: merged([moveGeo(new THREE.CylinderGeometry(0.027, 0.04, 0.65, 4), 0, 0.325, 0), moveGeo(new THREE.IcosahedronGeometry(0.19, 0), 0, 0.68, 0)]),
      reed: merged([moveGeo(new THREE.CylinderGeometry(0.028, 0.035, 2.6, 4), 0, 1.3, 0), moveGeo(new THREE.CylinderGeometry(0.10, 0.10, 0.45, 5), 0, 2.45, 0)]),
      lily: moveGeo(new THREE.CylinderGeometry(0.75, 0.75, 0.03, 7), 0, 0, 0),
      mushroom: merged([moveGeo(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 5), 0, 0.2, 0), moveGeo(new THREE.ConeGeometry(0.31, 0.25, 7), 0, 0.5, 0)]),
      // New flora for the canyon and the high country, built the same low-poly way.
      cactus: merged([moveGeo(new THREE.CylinderGeometry(0.46, 0.52, 1.05, 8), 0, 0.52, 0), shapeGeo(new THREE.IcosahedronGeometry(0.47, 0), 1, 0.5, 1, 0, 1.05, 0), moveGeo(new THREE.CylinderGeometry(0.13, 0.15, 0.5, 5), 0.52, 0.72, 0), shapeGeo(new THREE.IcosahedronGeometry(0.1, 0), 1, 0.7, 1, 0, 1.3, 0)]),
      sage: merged([shapeGeo(new THREE.IcosahedronGeometry(0.85, 0), 1, 0.62, 1, 0, 0.45, 0), shapeGeo(new THREE.IcosahedronGeometry(0.6, 0), 1, 0.7, 1, 0.55, 0.38, 0.25), shapeGeo(new THREE.IcosahedronGeometry(0.5, 0), 1, 0.7, 1, -0.45, 0.32, -0.3)]),
      edelweiss: merged([moveGeo(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 4), 0, 0.15, 0), shapeGeo(new THREE.IcosahedronGeometry(0.13, 0), 1.6, 0.4, 1.6, 0, 0.32, 0), shapeGeo(new THREE.IcosahedronGeometry(0.05, 0), 1, 1, 1, 0, 0.36, 0)])
    };
    const m = o => rendering.createMaterial(o);
    this.materials = { trunk: m({ color: 0x705242 }), pine: m({ color: 0xffffff, vertexColors: false }), crown: m({ color: 0xffffff }), rock: m({ color: 0x939082 }), shrub: m({ color: 0x728f43 }), grass: m({ color: 0x849746, side: THREE.DoubleSide }), flower: m({ color: 0xe7c26a }), reed: m({ color: 0x8c9955 }), lily: m({ color: 0x477548 }), mushroom: m({ color: 0xcda574 }),
      cactus: m({ color: 0x5f7f45 }), sage: m({ color: 0x8e9a72 }), edelweiss: m({ color: 0xe9e6d4 }) };
    for (const key of WIND) rendering.windify(this.materials[key]);
    this.dummy = new THREE.Object3D(); this.fixtures = []; this.makeStation(); this.makeCairns();
  }
  makeStation() {
    this.station = new THREE.Group(); this.station.position.set(WORLD.spawn.x + 8, 78, WORLD.spawn.z - 7);
    const metal = this.rendering.createMaterial({ color: 0x4a5d58, metalness: 0.5, roughness: 0.55 }), wood = this.rendering.createMaterial({ color: 0x947c55 }), orange = this.rendering.createMaterial({ color: 0xda7b34 });
    this.stationMaterials = { metal, wood, orange };
    const add = (g, mat, x, y, z, rx = 0) => { const mesh = new THREE.Mesh(g, mat); mesh.position.set(x, y, z); mesh.rotation.x = rx; mesh.castShadow = mesh.receiveShadow = true; this.station.add(mesh); return mesh; };
    add(new THREE.BoxGeometry(3.4, 0.14, 1.5), wood, 0, 1.15, 0);
    for (const x of [-1.4, 1.4]) for (const z of [-0.5, 0.5]) add(new THREE.BoxGeometry(0.11, 1.2, 0.11), metal, x, 0.6, z);
    add(new THREE.BoxGeometry(0.7, 0.35, 0.5), orange, -0.7, 1.4, 0);
    add(new THREE.BoxGeometry(0.8, 0.03, 0.6), this.rendering.createMaterial({ color: 0xe3dfc1 }), 0.6, 1.24, 0, 0.06);
    add(new THREE.CylinderGeometry(0.055, 0.08, 3.5, 6), metal, 0, 1.75, -0.8);
    this.glow = this.rendering.createMaterial({ color: 0xffd27b, emissive: 0xffba48, emissiveIntensity: 2 });
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.34, 6), this.glow, 0, 3.5, -0.8); add(new THREE.ConeGeometry(0.26, 0.15, 6), metal, 0, 3.76, -0.8);
    this.scene.add(this.station);
  }
  /**
   * A stone cairn with a survey pole and an amber pennant at each landmark.
   * One merged mesh per material across all six cairns keeps them to a handful of draw calls.
   */
  makeCairns() {
    const k = this.kernel, stones = [], poles = [], flags = [], matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const place = (list, geometry, x, y, z, sx, sy, sz, ry = 0, rz = 0) => { e.set(0, ry, rz); q.setFromEuler(e); matrix.compose(p.set(x, y, z), q, s.set(sx, sy, sz)); const g = geometry.clone().applyMatrix4(matrix); list.push(g.index ? g.toNonIndexed() : g); if (g.index) g.dispose(); };
    const rock = new THREE.IcosahedronGeometry(1, 0), pole = new THREE.CylinderGeometry(0.07, 0.09, 1, 6), flag = new THREE.BoxGeometry(1, 1, 1), cap = new THREE.OctahedronGeometry(0.3);
    this.cairnSites = [];
    for (const c of CAIRNS) {
      const y = Math.max(k.ground(c.x, c.z), WORLD.water + 0.2), h = k.hash(c.x | 0, c.z | 0, 17);
      const layers = [[1.25, 0.55, 0.45], [0.95, 0.5, 1.2], [0.7, 0.45, 1.85], [0.45, 0.35, 2.4]];
      layers.forEach(([r, sy, dy], i) => place(stones, rock, c.x + Math.sin(i * 2.1 + h * 6) * 0.08, y + dy - 0.2, c.z + Math.cos(i * 1.7) * 0.08, r, sy, r * 0.95, i * 0.9 + h * 3));
      place(poles, pole, c.x, y + 4.4, c.z, 1, 4.2, 1);
      const turn = h * Math.PI * 2; // the pennant hangs off the pole, pointing a different way at each cairn
      place(flags, flag, c.x + Math.cos(turn) * 0.62, y + 5.9, c.z - Math.sin(turn) * 0.62, 1.1, 0.7, 0.04, turn, 0);
      place(flags, cap, c.x, y + 6.65, c.z, 1, 1, 1);
      this.cairnSites.push({ ...c, y });
      this.fixtures.push({ x: c.x, z: c.z, y, r: 1.25, top: y + 6.5 });
    }
    for (const g of [rock, pole, flag, cap]) g.dispose();
    const glowFlag = this.rendering.createMaterial({ color: 0xf6bc70, emissive: 0xffa63a, emissiveIntensity: 0.9, side: THREE.DoubleSide });
    this.cairns = new THREE.Group(); this.cairns.name = 'Landmark cairns';
    for (const [list, mat] of [[stones, this.materials.rock], [poles, this.stationMaterials.metal], [flags, glowFlag]]) {
      const geometry = mergeGeometries(list, false); for (const g of list) g.dispose(); if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = mesh.receiveShadow = true; this.cairns.add(mesh);
    }
    this.scene.add(this.cairns);
  }
  nearCairn(x, z, radius) { for (const c of CAIRNS) if (Math.abs(x - c.x) < radius && Math.abs(z - c.z) < radius) return true; return false; }
  plan(position, range) {
    const cx = Math.floor(position.x / CELL), cz = Math.floor(position.z / CELL), key = `${cx},${cz},${range}`; if (key === this.lastKey) return; this.lastKey = key; this.range = range;
    const r = Math.ceil(range / CELL), wanted = new Set(), jobs = [];
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      const distance = Math.hypot((x + 0.5) * CELL - position.x, (z + 0.5) * CELL - position.z); if (distance > range + 160) continue;
      const id = `${x},${z}`; wanted.add(id); if (!this.cells.has(id)) jobs.push({ x, z, id, distance });
    }
    for (const [id, cell] of this.cells) if (!wanted.has(id)) { this.scene.remove(cell.group); for (const mesh of cell.group.children) mesh.dispose?.(); this.cells.delete(id); }
    this.queue = jobs.sort((a, b) => a.distance - b.distance);
  }
  makeCell(job) {
    const { x: cx, z: cz, id } = job, k = this.kernel, group = new THREE.Group(); group.name = `Nature ${id}`;
    const buckets = {}; for (const key of Object.keys(this.geometries)) buckets[key] = [];
    const entities = [], colliders = [], x0 = cx * CELL, z0 = cz * CELL;
    const add = (type, x, y, z, sx = 1, sy = sx, sz = sx, angle = 0, color = null) => buckets[type].push({ x, y, z, sx, sy, sz, angle, color });
    for (let i = 0; i < 160; i++) {
      const x = x0 + k.hash(cx, cz, i * 11) * CELL, z = z0 + k.hash(cx, cz, i * 11 + 3) * CELL, h = k.ground(x, z), b = k.biome(x, z, h), r = k.hash(cx, cz, i * 11 + 4);
      if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < 26 || this.nearCairn(x, z, 7)) continue;
      if (h > WORLD.water + 1 && b !== 3 && b !== 4) {
        const density = b === 1 ? 0.90 : b === 5 ? 0.28 : b === 2 ? 0.10 : 0.09;
        if (r < density) {
          const scale = 0.65 + k.hash(cx, cz, i * 11 + 5) * 0.75, angle = k.hash(cx, cz, i * 11 + 6) * Math.PI * 2, deciduous = b === 5 || (b === 0 && r < 0.045), type = deciduous ? 'crown' : 'pine';
          const tint = new THREE.Color(deciduous ? 0x668047 : 0x366447); tint.offsetHSL((k.hash(cx, cz, i + 831) - 0.5) * 0.05, 0, (r - 0.5) * 0.13);
          add('trunk', x, h, z, scale, deciduous ? scale * 0.8 : scale, scale, angle); add(type, x, h, z, scale, scale, scale, angle, tint);
          colliders.push({ x, z, y: h, r: 0.38 * scale, top: h + 10 * scale }); entities.push({ id: `tree:${id}:${i}`, name: deciduous ? (b === 5 ? 'Swamp willow' : 'Silver birch') : 'Highland pine', category: 'flora', x, z, height: h + 6 * scale, radius: 4 * scale, biome: b, description: deciduous ? 'Broadleaf tree. Record the habitat and location.' : 'Evergreen conifer. Record the habitat and location.' });
        }
      }
      // Redstone Canyon had bare rock only; it now grows barrel cactus and desert sage.
      if (b === 4 && h > WORLD.water + 1 && r < 0.3) {
        const angle = k.hash(cx, cz, i * 11 + 6) * Math.PI * 2, s = 0.7 + k.hash(cx, cz, i * 11 + 5) * 0.7;
        if (r < 0.1) {
          add('cactus', x, h, z, s, s, s, angle); colliders.push({ x, z, y: h, r: 0.5 * s, top: h + 1.3 * s });
          entities.push({ id: `desert:${id}:${i}`, name: 'Barrel cactus', category: 'flora', x, z, height: h + 0.9 * s, radius: 1.1, biome: b, description: 'Water-storing succulent. Record the habitat and location.' });
        } else {
          add('sage', x, h, z, s, s, s, angle);
          entities.push({ id: `desert:${id}:${i}`, name: 'Desert sage', category: 'flora', x, z, height: h + 0.6 * s, radius: 1.3, biome: b, description: 'Aromatic dryland shrub. Record the habitat and location.' });
        }
      }
      if (h > WORLD.water + 0.4 && r > 0.92) {
        const scale = 0.6 + k.hash(cx, cz, i * 31) * 2.9; add('rock', x, h + scale * 0.3, z, scale, scale * 0.7, scale * 0.85, r * 15);
        colliders.push({ x, z, y: h, r: scale * 0.8, top: h + scale }); entities.push({ id: `rock:${id}:${i}`, name: b === 4 ? 'Sandstone outcrop' : 'Granite outcrop', category: 'terrain', x, z, height: h + scale, radius: scale * 1.3, biome: b, description: 'Exposed bedrock. Record position, height, and region.' });
      }
      if (h > WORLD.water + 1 && b !== 3 && b !== 4 && r > 0.7 && r < 0.82) add('shrub', x, h, z, 0.5 + r, 0.5 + r, 0.5 + r, r * 9);
      // Underwater ground reports the Lake biome, so marsh shallows are found from the swamp field
      // (the old wetland test could never pass, and no lily pad ever grew).
      if (b === 6 && h > WORLD.water - 4 && r < 0.3 && k.features(x, z).swamp > 0.3) add('lily', x, WORLD.water + 0.08, z, 0.6 + r, 1, 0.6 + r);
    }
    for (let i = 0; i < 260; i++) {
      const x = x0 + k.hash(cx, cz, i * 9 + 1700) * CELL, z = z0 + k.hash(cx, cz, i * 9 + 1701) * CELL, h = k.ground(x, z), b = k.biome(x, z, h), r = k.hash(cx, cz, i * 9 + 1702);
      if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < 10 || this.nearCairn(x, z, 3)) continue;
      let type = null, name = null;
      const marsh = b === 5 || (b === 6 && h > WORLD.water - 1 && k.features(x, z).swamp > 0.3);
      if (marsh && h > WORLD.water - 1 && h < WORLD.water + 4) { type = 'reed'; name = 'Marsh reed'; }
      else if (h > WORLD.water + 1 && b === 1 && r < 0.11) { type = 'mushroom'; name = 'Woodland mushroom'; }
      else if (h > WORLD.water + 1 && b === 0 && r < 0.22) { type = 'flower'; name = 'Meadow wildflower'; }
      else if ((b === 2 || b === 3) && h < 1050 && r < 0.05) { type = 'edelweiss'; name = 'Edelweiss'; }
      else if (h > WORLD.water + 1 && [0, 1, 5].includes(b)) type = 'grass';
      if (type) { const s = 0.65 + r * 0.7; add(type, x, h, z, s, s, s, r * 15); if (name) entities.push({ id: `plant:${id}:${i}`, name, category: 'flora', x, z, height: h + (type === 'reed' ? 1.6 : type === 'edelweiss' ? 0.3 : 0.6), radius: type === 'reed' ? 1 : 0.65, biome: b, description: type === 'edelweiss' ? 'Woolly alpine flower. Record the habitat and location.' : 'Plant specimen. Record the habitat and location.' }); }
    }
    for (const [type, items] of Object.entries(buckets)) {
      if (!items.length) continue; const mesh = new THREE.InstancedMesh(this.geometries[type], this.materials[type], items.length);
      for (let i = 0; i < items.length; i++) {
        const v = items[i]; this.dummy.position.set(v.x, v.y, v.z); this.dummy.scale.set(v.sx, v.sy, v.sz); this.dummy.rotation.set(0, v.angle, 0); this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix); if (v.color) mesh.setColorAt(i, v.color);
      }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = !NO_SHADOW.has(type); mesh.receiveShadow = true; mesh.computeBoundingSphere();
      mesh.userData.vegetation = true; mesh.userData.type = type; mesh.userData.nearOnly = NEAR_ONLY.has(type); group.add(mesh);
    }
    this.cells.set(id, { group, entities, colliders, center: new THREE.Vector2(x0 + CELL / 2, z0 + CELL / 2) }); this.scene.add(group);
  }
  /** Push a circle out of trunks, rocks, cacti and cairns. Returns a reused {x, z}. */
  resolveCollision(x, z, y, radius) {
    const out = this.resolved || (this.resolved = { x: 0, z: 0 }); out.x = x; out.z = z;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const cell = this.cells.get(`${cx + dx},${cz + dz}`); if (!cell) continue;
      for (const c of cell.colliders) this.pushOut(out, c, y, radius);
    }
    for (const c of this.fixtures) if (Math.abs(out.x - c.x) < 4 && Math.abs(out.z - c.z) < 4) this.pushOut(out, c, y, radius);
    // The field desk is a solid station fixture.
    const tx = WORLD.spawn.x + 8, tz = WORLD.spawn.z - 7;
    if (y < 79.5 && y > 76 && Math.abs(out.x - tx) < 1.8 + radius && Math.abs(out.z - tz) < 0.85 + radius) { const dx = (1.8 + radius) - Math.abs(out.x - tx), dz = (0.85 + radius) - Math.abs(out.z - tz); if (dx < dz) out.x += Math.sign(out.x - tx || 1) * dx; else out.z += Math.sign(out.z - tz || 1) * dz; }
    return out;
  }
  pushOut(out, c, y, radius) {
    if (y > c.top || y + 1.5 < c.y) return;
    const d = Math.hypot(out.x - c.x, out.z - c.z), min = radius + c.r;
    if (d < min) { const nx = d > 0.0001 ? (out.x - c.x) / d : 1, nz = d > 0.0001 ? (out.z - c.z) / d : 0; out.x = c.x + nx * min; out.z = c.z + nz * min; }
  }
  /** Survey entities within `radius` of a point. Only the cells that can overlap the circle are visited. */
  nearby(position, radius = 160, out = []) {
    out.length = 0; const r2 = radius * radius;
    const x0 = Math.floor((position.x - radius) / CELL), x1 = Math.floor((position.x + radius) / CELL), z0 = Math.floor((position.z - radius) / CELL), z1 = Math.floor((position.z + radius) / CELL);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const cell = this.cells.get(`${cx},${cz}`); if (!cell) continue;
      for (const e of cell.entities) { const dx = e.x - position.x, dz = e.z - position.z; if (dx * dx + dz * dz < r2) out.push(e); }
    }
    return out;
  }
  update(dt, position, range) {
    this.elapsed += dt; this.plan(position, range); if (this.queue.length) this.makeCell(this.queue.shift());
    this.visibilityTimer -= dt; if (this.visibilityTimer > 0) return; this.visibilityTimer = 0.2;
    for (const cell of this.cells.values()) {
      const near = Math.hypot(cell.center.x - position.x, cell.center.y - position.z) < 480;
      for (const mesh of cell.group.children) if (mesh.userData.nearOnly) mesh.visible = near;
    }
  }
  dispose() { for (const cell of this.cells.values()) { this.scene.remove(cell.group); for (const mesh of cell.group.children) mesh.dispose?.(); } for (const g of Object.values(this.geometries)) g.dispose(); this.station.traverse(o => o.geometry?.dispose()); this.scene.remove(this.station); this.cairns.traverse(o => o.geometry?.dispose()); this.scene.remove(this.cairns); }
}

// ---------------------------------------------------------------------------
// Wildlife. Each animal's rigid parts are baked into one vertex-coloured mesh
// (cached per species); only legs, wings and tails stay separate for animation.
// That cut a deer from 17 draw calls to 5.

const SPECIES_NAME = { deer: 'Red deer', fox: 'Red fox', rabbit: 'Meadow hare', heron: 'Grey heron', fish: 'Lake trout', bird: 'Raven', goat: 'Mountain goat', boar: 'Wild boar', lizard: 'Collared lizard', owl: 'Tawny owl' };
const FLYERS = new Set(['bird', 'owl']);
const SHY = new Set(['deer', 'fox', 'rabbit', 'goat', 'boar', 'lizard', 'heron']);

export class WildlifeSystem {
  constructor(scene, terrain, rendering) {
    this.scene = scene; this.terrain = terrain; this.rendering = rendering; this.animals = []; this.lastCell = ''; this.elapsed = 0; this.fleeScale = 1; this.nightVisible = false;
    this.box = new THREE.BoxGeometry(1, 1, 1); this.sphere = new THREE.IcosahedronGeometry(1, 0); this.cone = new THREE.ConeGeometry(1, 1, 5);
    const c = hex => new THREE.Color(hex);
    this.colors = { deer: c(0xa58057), fox: c(0xb75d2e), rabbit: c(0xa69a86), heron: c(0xb0c0c1), fish: c(0x809e96), bird: c(0x313f42), dark: c(0x33302b), white: c(0xe0d5b6), goat: c(0xd9d3c3), horn: c(0x5a5046), boar: c(0x5b4636), tusk: c(0xeee6cf), lizard: c(0x6f9a8a), lizardHead: c(0xd9a441), owl: c(0x8a6a4a), owlFace: c(0xcdb898), eye: c(0xf2c14e) };
    this.bodyMaterial = rendering.createMaterial({ color: 0xffffff, vertexColors: true });
    this.partMaterials = new Map(); this.bodies = new Map();
  }
  partMaterial(key) {
    if (!this.partMaterials.has(key)) this.partMaterials.set(key, this.rendering.createMaterial({ color: this.colors[key] }));
    return this.partMaterials.get(key);
  }
  /** Describe a species as parts: static parts get baked, `anim` parts stay live meshes. */
  blueprint(type) {
    const parts = [], P = (geo, sx, sy, sz, x, y, z, color = type, rot = null, anim = null) => parts.push({ geo, s: [sx, sy, sz], p: [x, y, z], color, rot, anim });
    const { box, sphere, cone } = this;
    if (type === 'bird' || type === 'heron') {
      const size = type === 'heron' ? 1 : 0.5; P(sphere, 0.25 * size, 0.28 * size, 0.65 * size, 0, 0.9 * size, 0);
      P(box, 0.1 * size, 0.6 * size, 0.13 * size, 0, 1.3 * size, -0.38 * size); P(sphere, 0.18 * size, 0.17 * size, 0.2 * size, 0, 1.64 * size, -0.4 * size);
      P(cone, 0.08 * size, 0.4 * size, 0.08 * size, 0, 1.61 * size, -0.68 * size, 'fox', [-Math.PI / 2, 0, 0]);
      for (const side of [-1, 1]) { P(box, 0.035 * size, 0.8 * size, 0.035 * size, side * 0.14 * size, 0.4 * size, 0.06 * size, 'dark', null, 'leg'); P(box, 0.8 * size, 0.05 * size, 0.36 * size, side * 0.5 * size, 1.0 * size, 0.04 * size, type, null, 'wing'); }
    } else if (type === 'owl') {
      P(sphere, 0.3, 0.38, 0.32, 0, 0.9, 0); P(sphere, 0.26, 0.24, 0.24, 0, 1.36, -0.04);
      P(sphere, 0.17, 0.15, 0.06, 0, 1.36, -0.25, 'owlFace'); for (const side of [-1, 1]) { P(sphere, 0.05, 0.05, 0.03, side * 0.08, 1.4, -0.3, 'eye'); P(cone, 0.06, 0.16, 0.05, side * 0.14, 1.62, -0.02, 'owl', [0, 0, side * -0.3]); }
      P(cone, 0.04, 0.1, 0.04, 0, 1.3, -0.32, 'dark', [-Math.PI / 2, 0, 0]);
      for (const side of [-1, 1]) P(box, 0.75, 0.05, 0.34, side * 0.5, 1.0, 0.02, 'owl', null, 'wing');
    } else if (type === 'fish') {
      P(sphere, 0.16, 0.24, 0.65, 0, 0, 0); P(cone, 0.31, 0.4, 0.1, 0, 0, 0.66, 'fish', [Math.PI / 2, 0, 0], 'tail');
    } else if (type === 'lizard') {
      P(sphere, 0.16, 0.1, 0.42, 0, 0.14, 0); P(sphere, 0.12, 0.09, 0.15, 0, 0.17, -0.44, 'lizardHead');
      P(cone, 0.08, 0.7, 0.06, 0, 0.12, 0.72, 'lizard', [Math.PI / 2, 0, 0]);
      for (const x of [-0.17, 0.17]) for (const z of [-0.22, 0.22]) P(box, 0.16, 0.05, 0.05, x, 0.08, z, 'lizard', null, 'leg');
    } else if (type === 'boar') {
      P(sphere, 0.5, 0.52, 0.85, 0, 0.8, 0); P(sphere, 0.36, 0.34, 0.42, 0, 0.82, -0.78); P(box, 0.24, 0.2, 0.28, 0, 0.72, -1.16, 'dark');
      for (const side of [-1, 1]) { P(cone, 0.04, 0.2, 0.04, side * 0.15, 0.7, -1.18, 'tusk', [-0.5, 0, side * 0.4]); P(cone, 0.1, 0.22, 0.06, side * 0.2, 1.16, -0.7, 'boar', [0, 0, side * -0.3]); }
      P(box, 0.1, 0.12, 0.7, 0, 1.3, -0.1, 'dark');
      for (const x of [-0.26, 0.26]) for (const z of [-0.45, 0.45]) P(box, 0.13, 0.55, 0.14, x, 0.3, z, 'dark', null, 'leg');
    } else {
      const deer = type === 'deer', rabbit = type === 'rabbit', goat = type === 'goat', s = deer ? 1 : goat ? 0.85 : rabbit ? 0.35 : 0.65;
      P(sphere, 0.42 * s, 0.48 * s, 0.86 * s, 0, 1.0 * s, 0); P(box, 0.22 * s, 0.63 * s, 0.32 * s, 0, 1.38 * s, -0.59 * s);
      P(sphere, 0.25 * s, 0.28 * s, 0.4 * s, 0, 1.75 * s, -0.74 * s); P(box, 0.19 * s, 0.16 * s, 0.3 * s, 0, 1.67 * s, -1.05 * s, goat ? type : 'dark');
      for (const side of [-1, 1]) P(cone, 0.13 * s, (rabbit ? 0.8 : 0.36) * s, 0.08 * s, side * 0.22 * s, (rabbit ? 2.2 : 2.05) * s, -0.67 * s, type, [0, 0, side * -0.22]);
      for (const x of [-0.26, 0.26]) for (const z of [-0.51, 0.51]) P(box, 0.11 * s, 0.82 * s, 0.12 * s, x * s, 0.43 * s, z * s, type, null, 'leg');
      P(cone, (type === 'fox' ? 0.25 : 0.1) * s, (type === 'fox' ? 1.1 : 0.3) * s, 0.2 * s, 0, 1.1 * s, 1.0 * s, type === 'fox' ? 'white' : type, [Math.PI / 2, 0, 0]);
      if (deer) for (const side of [-1, 1]) { P(box, 0.045, 0.6, 0.055, side * 0.19, 2.14, -0.64, 'dark', [0, 0, side * -0.35]); P(box, 0.25, 0.045, 0.05, side * 0.3, 2.28, -0.64, 'dark', [0, 0, side * 0.35]); }
      if (goat) { for (const side of [-1, 1]) P(cone, 0.06, 0.42, 0.06, side * 0.1, 1.98, -0.62, 'horn', [0.7, 0, side * -0.25]); P(cone, 0.07, 0.22, 0.05, 0, 1.42, -0.98, 'white', [Math.PI, 0, 0]); }
    }
    return parts;
  }
  /** The baked, vertex-coloured body for a species (built once). */
  body(type, parts) {
    if (this.bodies.has(type)) return this.bodies.get(type);
    const list = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const part of parts) {
      if (part.anim) continue;
      e.set(...(part.rot || [0, 0, 0])); q.setFromEuler(e); m.compose(p.set(...part.p), q, s.set(...part.s));
      let g = part.geo.clone().applyMatrix4(m); if (g.index) { const f = g.toNonIndexed(); g.dispose(); g = f; }
      const color = this.colors[part.color] || this.colors.dark, n = g.attributes.position.count, data = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { data[i * 3] = color.r; data[i * 3 + 1] = color.g; data[i * 3 + 2] = color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(data, 3)); list.push(g);
    }
    const geometry = mergeGeometries(list, false); for (const g of list) g.dispose();
    this.bodies.set(type, geometry); return geometry;
  }
  model(type) {
    const root = new THREE.Group(), legs = [], wings = [], parts = this.blueprint(type);
    const bodyMesh = new THREE.Mesh(this.body(type, parts), this.bodyMaterial); bodyMesh.castShadow = bodyMesh.receiveShadow = true; root.add(bodyMesh);
    for (const part of parts) {
      if (!part.anim) continue;
      const mesh = new THREE.Mesh(part.geo, this.partMaterial(part.color)); mesh.scale.set(...part.s); mesh.position.set(...part.p); if (part.rot) mesh.rotation.set(...part.rot);
      mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); (part.anim === 'leg' ? legs : wings).push(mesh);
    }
    return { root, legs, wings };
  }
  pickType(h, b, r) {
    if (h < WORLD.water - 1) return 'fish';
    if (b === 5) return 'heron';
    if (b === 3) return r < 0.4 ? 'goat' : 'bird';
    if (b === 2 && r < 0.45) return 'goat';
    if (b === 4 && r < 0.5) return 'lizard';
    if (b === 1) return r < 0.45 ? 'deer' : r < 0.6 ? 'fox' : r < 0.72 ? 'rabbit' : r < 0.86 ? 'boar' : 'owl';
    return r < 0.55 ? 'deer' : r < 0.77 ? 'fox' : 'rabbit';
  }
  populate(position) {
    const cx = Math.floor(position.x / 160), cz = Math.floor(position.z / 160), key = `${cx},${cz}`; if (key === this.lastCell) return; this.lastCell = key;
    for (let i = this.animals.length - 1; i >= 0; i--) if (Math.hypot(this.animals[i].x - position.x, this.animals[i].z - position.z) > 680) { this.scene.remove(this.animals[i].model.root); this.animals.splice(i, 1); }
    const k = this.terrain.kernel, existing = new Set(this.animals.map(a => a.id));
    for (let z = cz - 3; z <= cz + 3; z++) for (let x = cx - 3; x <= cx + 3; x++) {
      const id = `animal:${x},${z}`; if (existing.has(id)) continue; const px = (x + k.hash(x, z, 293)) * 160, pz = (z + k.hash(x, z, 298)) * 160, h = k.ground(px, pz), b = k.biome(px, pz, h), r = k.hash(x, z, 381);
      const type = this.pickType(h, b, r);
      const model = this.model(type), angle = k.hash(x, z, 832) * Math.PI * 2;
      const height = type === 'fish' ? WORLD.water - 0.9 : type === 'bird' ? h + 35 : type === 'owl' ? h + 12 : h;
      const a = { id, type, model, x: px, z: pz, homeX: px, homeZ: pz, height, radius: type === 'deer' || type === 'boar' ? 1.5 : type === 'lizard' ? 0.5 : 0.8, angle, targetAngle: angle, timer: r * 9, state: 'Grazing', phase: r * 20, category: 'fauna', name: SPECIES_NAME[type], biome: b, nocturnal: type === 'owl', active: type !== 'owl' || this.nightVisible, description: type === 'owl' ? 'Nocturnal hunter. Only seen after dark.' : 'Wildlife observation. Keep your distance to avoid disturbance.' };
      model.root.position.set(a.x, a.height, a.z); model.root.rotation.y = angle; model.root.visible = a.active; this.animals.push(a); this.scene.add(model.root);
    }
  }
  update(dt, player, paused = false, night = false) {
    this.elapsed += dt; this.populate(player.position);
    if (night !== this.nightVisible) { this.nightVisible = night; for (const a of this.animals) if (a.nocturnal) { a.active = night; a.model.root.visible = night; } }
    if (paused) return;
    for (const a of this.animals) {
      if (!a.active) continue;
      const distance = Math.hypot(a.x - player.position.x, a.z - player.position.z); a.timer -= dt;
      const scared = SHY.has(a.type) && distance < (player.speed > 8 ? 35 : 15) * this.fleeScale;
      if (scared) { a.targetAngle = Math.atan2(a.x - player.position.x, a.z - player.position.z) + Math.PI; a.state = 'Fleeing'; a.timer = 2; }
      else if (a.timer <= 0) { a.phase += 1; a.timer = 3 + this.terrain.kernel.hash(a.homeX | 0, a.homeZ | 0, a.phase | 0) * 6; a.targetAngle += Math.sin(a.phase * 11.8) * 1.8; a.state = Math.sin(a.phase * 5.3) > 0 ? 'Walking' : 'Grazing'; if (Math.hypot(a.x - a.homeX, a.z - a.homeZ) > 100) a.targetAngle = Math.atan2(a.homeX - a.x, a.homeZ - a.z) + Math.PI; }
      const delta = Math.atan2(Math.sin(a.targetAngle - a.angle), Math.cos(a.targetAngle - a.angle)); a.angle += delta * Math.min(1, dt * 3);
      const flyer = FLYERS.has(a.type);
      const speed = a.type === 'bird' ? 8 : a.type === 'owl' ? 5 : a.type === 'fish' ? 1.4 : scared ? (a.type === 'lizard' ? 5 : 7) : a.state === 'Walking' ? (a.type === 'lizard' ? 0.7 : 1.1) : 0;
      const nx = a.x - Math.sin(a.angle) * speed * dt, nz = a.z - Math.cos(a.angle) * speed * dt, ground = this.terrain.height(nx, nz);
      if (flyer || (a.type === 'fish' ? ground < WORLD.water - 1 : ground > WORLD.water - 0.4 && Math.abs(ground - a.height) < 3)) {
        a.x = nx; a.z = nz;
        a.height = a.type === 'fish' ? WORLD.water - 1.0 + Math.sin(this.elapsed + a.phase) * 0.2 : a.type === 'bird' ? ground + 38 + Math.sin(this.elapsed * 0.35 + a.phase) * 8 : a.type === 'owl' ? Math.max(ground, WORLD.water) + 13 + Math.sin(this.elapsed * 0.5 + a.phase) * 3 : ground;
      } else { a.targetAngle += Math.PI * 0.7; a.timer = 0.8; }
      a.model.root.position.set(a.x, a.height + ((a.type === 'rabbit' || a.type === 'lizard') && speed > 0 ? Math.abs(Math.sin(this.elapsed * 12 + a.phase)) * (a.type === 'lizard' ? 0.03 : 0.15) : 0), a.z); a.model.root.rotation.y = a.angle;
      for (let i = 0; i < a.model.legs.length; i++) {
        const swing = Math.sin(this.elapsed * (scared ? 14 : 5) + i * Math.PI / 2 + a.phase) * Math.min(speed, 5) * 0.11;
        if (a.type === 'lizard') a.model.legs[i].rotation.y = swing * 2; else a.model.legs[i].rotation.x = swing;
      }
      for (let i = 0; i < a.model.wings.length; i++) { const w = a.model.wings[i]; if (a.type === 'fish') w.rotation.y = Math.sin(this.elapsed * 5) * 0.2; else w.rotation.z = (i === 0 ? -1 : 1) * (flyer ? Math.sin(this.elapsed * (a.type === 'owl' ? 4 : 7) + a.phase) * 0.55 : 0.25); }
    }
  }
  /** Active animals within `radius` (owls only count at night). Fills and returns `out`. */
  nearby(position, radius = 160, out = []) {
    out.length = 0;
    for (const a of this.animals) if (a.active && Math.hypot(a.x - position.x, a.z - position.z) < radius) out.push(a);
    return out;
  }
  dispose() { for (const a of this.animals) this.scene.remove(a.model.root); for (const g of [this.box, this.sphere, this.cone, ...this.bodies.values()]) g.dispose(); }
}
