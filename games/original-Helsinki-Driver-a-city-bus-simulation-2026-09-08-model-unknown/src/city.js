import * as THREE from 'three/webgpu';
import { bakeInstances } from 'kit/instancing.js';
import { GeometryBatch, box, cylinder, beamGeometry, polygonGeometry, makeLabel, mergeParts, mergeChildren } from './mesh.js';
import { right, forward, add, scale, distance, hash, rng } from './math.js';
import { signalPhase } from './traffic.js';
import { setLegacy } from './materials.js';

function strip(batch, a, b, half, y, uvScale = 3) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz); if (length < 0.01) return;
  const r = [(-dz / length) * half, (dx / length) * half];
  const p = [[a[0] - r[0], y, a[1] - r[1]], [b[0] - r[0], y, b[1] - r[1]], [b[0] + r[0], y, b[1] + r[1]], [a[0] + r[0], y, a[1] + r[1]]];
  batch.quad(p, p.map((v) => [v[0] / uvScale, v[2] / uvScale]), true);
}
function sign(parent, text, w, h, x, y, z, yaw = 0, options = {}) {
  const tex = makeLabel(text, 1024, Array.isArray(text) ? 384 : 220, options);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = yaw; parent.add(m); return m;
}

// Static scenery is merged per grid cell and material. Big cells keep the draw calls down (36 building and 41
// parked-car chunks became about a dozen of each on T1); a cell is drawn while any part of it is in range.
const BUILDING_CHUNK = 360, PARKED_CHUNK = 320;
const cellKey = (p, size) => `${Math.floor(p[0] / size)},${Math.floor(p[1] / size)}`;
const cellArea = (p, size) => ({ center: [(Math.floor(p[0] / size) + 0.5) * size, (Math.floor(p[1] / size) + 0.5) * size], radius: size * 0.72 });

// ---- people: deliberately unrigged, very low-poly silhouettes; no faces or textured humans.
// One merged geometry per body part colour and per kind, shared by every person.
const personParts = new Map();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
function partsFor(kind) {
  const key = kind === 'pram' || kind === 'wheelchair' ? kind : 'ordinary';
  if (personParts.has(key)) return personParts.get(key);
  const ky = key === 'wheelchair' ? 0.7 : 1;
  const coat = [[new THREE.CylinderGeometry(0.19, 0.22, 0.55, 5), at(0, 1.05 * ky, 0)]];
  const skin = [[new THREE.IcosahedronGeometry(0.145, 0), at(0, 1.52 * ky, 0, 0, 0, 0, 1, 1.16, 1)]];
  const pants = [];
  for (const side of [-1, 1]) {
    pants.push([new THREE.CylinderGeometry(0.065, 0.055, 0.72, 4), at(side * 0.105, 0.43 * ky, 0)]);
    coat.push([new THREE.CylinderGeometry(0.065, 0.055, 0.52, 4), at(side * 0.255, 1.01 * ky, 0.015, 0, 0, side * 0.1)]);
  }
  if (key === 'pram') {
    coat.push([new THREE.BoxGeometry(0.55, 0.35, 0.78), at(0.45, 0.58, -0.48)]);
    for (const z of [-0.73, -0.18]) for (const x of [0.16, 0.72]) pants.push([new THREE.CylinderGeometry(0.12, 0.12, 0.055, 6), at(x, 0.18, z, 0, 0, Math.PI / 2)]);
    pants.push([beamGeometry([0.17, 0.9, -0.1], [0.72, 0.9, -0.1], 0.026, 5), null]);
  }
  if (key === 'wheelchair') {
    for (const x of [-0.34, 0.34]) pants.push([new THREE.TorusGeometry(0.29, 0.035, 4, 10), at(x, 0.32, 0, 0, Math.PI / 2, 0)]);
    pants.push([new THREE.BoxGeometry(0.57, 0.09, 0.52), at(0, 0.52, 0)]);
  }
  const parts = { coat: mergeParts(coat), skin: mergeParts(skin), pants: mergeParts(pants) };
  personParts.set(key, parts); return parts;
}
export function makePerson(mats, id = 'person', coat = 0, kind = 'ordinary') {
  const parent = new THREE.Group(); parent.name = id; const r = rng(hash(id)), parts = partsFor(kind);
  for (const [geo, mat] of [[parts.coat, mats.coats[coat % mats.coats.length]], [parts.skin, mats.skins[Math.floor(r() * mats.skins.length)]], [parts.pants, mats.pants]]) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m);
  }
  return parent;
}

// ---- cars: one merged geometry per material, shared by every parked and moving car.
let carParts = null;
function carGeometry(mats) {
  if (carParts) return carParts;
  const g = new THREE.Group(), body = mats.carBodies[0];
  box(g, body, 1.78, 0.55, 4.25, 0, 0.69, 0, true); box(g, body, 1.54, 0.65, 2.22, 0, 1.13, 0.1, true);
  box(g, mats.black, 1.46, 0.46, 2.19, 0, 1.2, 0.08, true);
  for (const x of [-0.915, 0.915]) {
    for (const z of [-1.31, 1.32]) { const tire = cylinder(g, mats.rubber, 0.32, 0.32, 0.2, x, 0.35, z, 12); tire.rotation.z = Math.PI / 2; const hub = cylinder(g, mats.metal, 0.185, 0.185, 0.212, x, 0.35, z, 10); hub.rotation.z = Math.PI / 2; }
    box(g, body, 0.055, 0.5, 0.13, x * 0.82, 1.24, 0.08);
  }
  box(g, body, 1.44, 0.06, 1.8, 0, 1.48, 0.07, true);
  for (const x of [-0.58, 0.58]) { box(g, mats.lights, 0.35, 0.11, 0.055, x, 0.75, -2.15); box(g, mats.redLights, 0.34, 0.12, 0.055, x, 0.74, 2.15); }
  g.updateMatrixWorld(true);
  const byMat = new Map();
  for (const mesh of g.children) { const key = mesh.material === body ? 'body' : mesh.material; if (!byMat.has(key)) byMat.set(key, []); byMat.get(key).push([mesh.geometry, mesh.matrix.clone()]); }
  carParts = [...byMat].map(([key, parts]) => ({ key, geometry: mergeParts(parts) }));
  return carParts;
}
export function makeCar(mats, color = 0) {
  const group = new THREE.Group();
  for (const { key, geometry } of carGeometry(mats)) { const m = new THREE.Mesh(geometry, key === 'body' ? mats.carBodies[color % mats.carBodies.length] : key); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  return group;
}

export class CityGraphics {
  constructor(scene, world, mats) {
    this.world = world; this.mats = mats; this.root = new THREE.Group(); this.root.name = 'Helsinki corridor'; scene.add(this.root);
    this.chunks = []; this.signalMeshes = []; this.people = new Map(); this.carMeshes = new Map(); this.range = 1050;
    this.shared = new Set(Object.values(mats).flat());
    this.buildGround(); this.buildRoads(); this.buildBuildings(); this.buildProps(); this.buildStops(); this.buildSignals(); this.buildStopSigns();
  }
  buildGround() {
    const { root, world, mats } = this, b = world.totalBounds;
    const ground = box(root, mats.ground, b[2] - b[0] + 2000, 0.16, b[3] - b[1] + 2000, (b[0] + b[2]) / 2, -0.1, (b[1] + b[3]) / 2); ground.castShadow = false;
    // Every park lawn (and every basin of water) in one mesh.
    const grass = new GeometryBatch(mats.grass, root), water = new GeometryBatch(mats.water, root);
    for (const park of world.data.parks || []) { const g = polygonGeometry(park.polygon); g.translate(0, 0.013, 0); grass.addGeometry(g); g.dispose(); }
    for (const w of world.data.water || []) { const g = polygonGeometry(w.polygon || w); g.translate(0, 0.018, 0); water.addGeometry(g); g.dispose(); }
    grass.finish(false); water.finish(false);
  }
  buildRoads() {
    const { root, mats, world } = this;
    const roadBatch = new GeometryBatch(mats.road, root), sideBatch = new GeometryBatch(mats.pavement, root), paint = new GeometryBatch(mats.paint, root), rail = new GeometryBatch(mats.metal, root), curb = new GeometryBatch(mats.kerb, root);
    const poles = new GeometryBatch(mats.metal, root);
    for (const road of world.roads) {
      const p = road.points;
      for (let i = 1; i < p.length; i++) strip(roadBatch, p[i - 1], p[i], road.width / 2, 0.021, 3);
      // Rounded joins eliminate cracks on segmented imported centre-lines.
      const disk = new THREE.CircleGeometry(road.width / 2, 12); disk.rotateX(-Math.PI / 2);
      for (const point of p) { disk.translate(point[0], 0.02, point[1]); roadBatch.addGeometry(disk); disk.translate(-point[0], -0.02, -point[1]); }
      disk.dispose();
      for (let s = 0; s < road.path.length - 1; s += 4) {
        const a = road.path.sample(s), b = road.path.sample(Math.min(s + 4, road.path.length)), r = right(a.yaw);
        for (const side of [-1, 1]) {
          const mid = add(a.point, scale(r, side * (road.width / 2 + 1.1)));
          const intersects = world.roadHash.query(mid, 12).some((o) => o !== road && o.path.project(mid).distance < o.width / 2 + 1.3); if (intersects) continue;
          const c = add(a.point, scale(r, side * (road.width / 2 + 1.25))), d = add(b.point, scale(right(b.yaw), side * (road.width / 2 + 1.25))); strip(sideBatch, c, d, 1.24, 0.14, 2);
          const c0 = add(a.point, scale(r, side * (road.width / 2 + 0.07))), d0 = add(b.point, scale(right(b.yaw), side * (road.width / 2 + 0.07))); strip(curb, c0, d0, 0.1, 0.155, 1);
          curb.quad([[c0[0], 0.02, c0[1]], [d0[0], 0.02, d0[1]], [d0[0], 0.155, d0[1]], [c0[0], 0.155, c0[1]]], null, side > 0);
        }
      }
      if (road.kind !== 'pedestrian') for (let s = 6; s < road.path.length - 7; s += 8) {
        const q = road.path.sample(s), p1 = road.path.sample(s + 3);
        const junction = world.roadHash.query(q.point, 15).some((o) => o !== road && o.path.project(q.point).distance < o.width / 2 + 3); if (junction) continue;
        strip(paint, q.point, p1.point, 0.055, 0.027);
      }
      if (road.rail) for (let s = 0; s < road.path.length; s += 8) { const a = road.path.sample(s), b = road.path.sample(Math.min(s + 8, road.path.length)); for (const offset of [-2.05, -1.05, 1.05, 2.05]) strip(rail, add(a.point, scale(right(a.yaw), offset)), add(b.point, scale(right(b.yaw), offset)), 0.035, 0.032); }
      const q = road.path.sample(Math.min(45, road.path.length / 2)), rp = add(q.point, scale(right(q.yaw), road.width / 2 + 2));
      const pole = new THREE.CylinderGeometry(0.035, 0.035, 3.2, 6); pole.translate(rp[0], 1.6, rp[1]); poles.addGeometry(pole); pole.dispose();
      sign(root, [road.name || 'Nimetön katu', road.nameSv || ''], Math.min(3.3, Math.max(1.7, (road.name?.length || 10) * 0.105)), 0.55, rp[0], 2.85, rp[1], -q.yaw, { size: 98, background: '#e7e9e4' });
    }
    for (const c of world.crossings) { const q = world.at(c.s), r = right(c.yaw ?? q.yaw), f = forward(c.yaw ?? q.yaw); for (let across = -c.width / 2; across < c.width / 2; across += 1.15) { const center = add(c.point || q.point, scale(r, across)); strip(paint, add(center, scale(f, -1.6)), add(center, scale(f, 1.6)), 0.28, 0.036); } }
    for (const s of [...world.signals, ...world.stopSigns]) { const q = world.at(s.s), r = right(q.yaw); strip(paint, add(q.point, scale(r, -1.5)), add(q.point, scale(r, 1.5)), 0.17, 0.04); }
    for (const stop of world.stops) { const f = forward(stop.yaw), r = right(stop.yaw); for (const side of [-1, 1]) strip(paint, add(add(stop.dock, scale(f, -6)), scale(r, side * 1.49)), add(add(stop.dock, scale(f, 7)), scale(r, side * 1.49)), 0.06, 0.032); }
    roadBatch.finish(false); sideBatch.finish(false); paint.finish(false); rail.finish(false); curb.finish(false); poles.finish();
  }
  buildBuildings() {
    const { world, root, mats } = this; const chunks = new Map();
    for (const b of world.buildings) {
      const center = b.footprint.reduce((s, p) => [s[0] + p[0] / b.footprint.length, s[1] + p[1] / b.footprint.length], [0, 0]), key = cellKey(center, BUILDING_CHUNK);
      if (!chunks.has(key)) { const g = new THREE.Group(); root.add(g); chunks.set(key, { group: g, ...cellArea(center, BUILDING_CHUNK), batches: mats.facades.map((m) => new GeometryBatch(m, g)), roof: new GeometryBatch(mats.roof, g), trim: new GeometryBatch(mats.kerb, g) }); }
      const ch = chunks.get(key), palette = (b.style ?? hash(String(b.id))) % 6, batch = ch.batches[palette], h = Number(b.height) || 17;
      for (const ring of [b.footprint, ...(b.holes || [])]) {
        let area = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length]; area += a[0] * c[1] - c[0] * a[1]; }
        const hole = ring !== b.footprint;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], c = ring[(i + 1) % ring.length], len = distance(a, c); if (len < 0.05) continue;
          batch.quad([[a[0], 0.12, a[1]], [c[0], 0.12, c[1]], [c[0], h, c[1]], [a[0], h, a[1]]], [[0, 0], [len / 12.8, 0], [len / 12.8, h / 9.9], [0, h / 9.9]], (area > 0) !== hole);
          // Relief sill and cornice strips catch actual light and cast shadows.
          for (const y of [0.55, h - 0.12]) { const dx = ((c[1] - a[1]) / len) * 0.12, dz = (-(c[0] - a[0]) / len) * 0.12; ch.trim.quad([[a[0] + dx, y, a[1] + dz], [c[0] + dx, y, c[1] + dz], [c[0] + dx, y + 0.15, c[1] + dz], [a[0] + dx, y + 0.15, a[1] + dz]], null, area > 0); }
        }
      }
      const roofGeo = polygonGeometry(b.footprint, b.holes || []); roofGeo.translate(0, h, 0);
      const pos = roofGeo.getAttribute('position'), uv = roofGeo.getAttribute('uv'); for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3);
      ch.roof.addGeometry(roofGeo); roofGeo.dispose();
      // Vents are inferred scenery, not cadastral attributes.
      const cg = new THREE.BoxGeometry(0.7, 0.85, 0.7); cg.translate(center[0], h + 0.4, center[1]); ch.roof.addGeometry(cg); cg.dispose();
    }
    for (const c of chunks.values()) { c.batches.forEach((b) => b.finish()); c.roof.finish(); c.trim.finish(); this.chunks.push(c); }
  }
  buildProps() {
    const { root, world, mats } = this; const trees = world.props.trees;
    if (trees.length) {
      // Static batches: built as InstancedMesh, then baked into plain meshes (no per-InstancedMesh shaders in r186).
      const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mats.leaves, trees.length * 3), trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.24, 1, 7), mats.bark, trees.length);
      let n = 0; const d = new THREE.Object3D();
      trees.forEach((tree, i) => {
        d.position.set(tree.point[0], tree.height * 0.31, tree.point[1]); d.scale.set(1, tree.height * 0.62, 1); d.rotation.set(0, 0, 0); d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
        for (let k = 0; k < 3; k++) { d.position.set(tree.point[0], tree.height * 0.7, tree.point[1]); d.scale.set(tree.height * 0.78, tree.height * 0.73, 1); d.rotation.set(0, (k * Math.PI) / 3, 0); d.updateMatrix(); leaves.setMatrixAt(n++, d.matrix); }
      });
      leaves.castShadow = true; leaves.receiveShadow = true; trunks.castShadow = true;
      root.add(bakeInstances(leaves, { dispose: true }), bakeInstances(trunks, { dispose: true }));
    }
    const lampBatch = new GeometryBatch(mats.metal, root), headBatch = new GeometryBatch(mats.lampHead, root);
    for (const l of world.props.lamps) {
      const p = l.point, r = right(l.yaw), top = [p[0], 7.5, p[1]], end = [p[0] - r[0] * l.side * 2, 7.5, p[1] - r[1] * l.side * 2];
      const pole = new THREE.CylinderGeometry(0.045, 0.095, 7.5, 6); pole.translate(p[0], 3.75, p[1]); lampBatch.addGeometry(pole); pole.dispose();
      const arm = new THREE.BoxGeometry(2, 0.07, 0.07); arm.rotateY(-l.yaw); arm.translate((top[0] + end[0]) / 2, 7.5, (top[2] + end[2]) / 2); lampBatch.addGeometry(arm); arm.dispose();
      const light = new THREE.BoxGeometry(0.72, 0.17, 0.28); light.rotateY(-l.yaw); light.translate(end[0], end[1], end[2]); headBatch.addGeometry(light); light.dispose();
    }
    lampBatch.finish(); headBatch.finish();
    const parkedChunks = new Map(), parts = carGeometry(mats), matrix = new THREE.Matrix4();
    for (const car of world.props.cars) {
      const key = cellKey(car.point, PARKED_CHUNK);
      if (!parkedChunks.has(key)) { const group = new THREE.Group(); root.add(group); parkedChunks.set(key, { group, ...cellArea(car.point, PARKED_CHUNK), batches: new Map() }); }
      const chunk = parkedChunks.get(key);
      matrix.compose(_p.set(car.point[0], 0.14, car.point[1]), _q.setFromEuler(_e.set(0, -car.yaw, 0)), _s.set(1, 1, 1));
      for (const { key: k, geometry } of parts) {
        const material = k === 'body' ? mats.carBodies[car.color % mats.carBodies.length] : k;
        if (!chunk.batches.has(material)) chunk.batches.set(material, new GeometryBatch(material, chunk.group));
        chunk.batches.get(material).addGeometry(geometry, matrix);
      }
    }
    for (const chunk of parkedChunks.values()) { chunk.batches.forEach((b) => b.finish()); this.chunks.push(chunk); }
  }
  buildStops() {
    const { world, root, mats } = this;
    for (const s of world.stops) {
      const g = new THREE.Group(); g.position.set(s.point[0], 0.14, s.point[1]); g.rotation.y = -s.yaw; root.add(g);
      cylinder(g, mats.metal, 0.045, 0.045, 3.65, 0, 1.82, 0, 8); sign(g, [s.id, s.name], 1.17, 0.72, 0, 3.15, 0.06, Math.PI, { background: '#e9edeb', color: '#123f61', size: 75 });
      sign(g, world.data.route.number, 0.44, 0.4, 0, 2.62, 0.07, Math.PI, { background: '#0078b7', color: '#ffffff', size: 172 });
      // Shelter behind the kerb, centred behind the pole.
      box(g, mats.green, 1.75, 0.15, 4.3, 1.45, 2.62, -0.7, true);
      for (const z of [-2.65, 1.25]) { box(g, mats.green, 0.065, 2.6, 0.065, 0.68, 1.3, z); box(g, mats.green, 0.065, 2.6, 0.065, 2.2, 1.3, z); box(g, mats.glass, 1.52, 2.25, 0.035, 1.45, 1.38, z); }
      box(g, mats.glass, 0.035, 2.26, 3.84, 2.2, 1.39, -0.7); box(g, mats.wood, 0.48, 0.12, 2.4, 1.9, 0.55, -0.7); for (const z of [-1.55, 0.2]) box(g, mats.green, 0.2, 0.48, 0.14, 1.9, 0.3, z);
      sign(g, ['REITTI / ROUTE', `${world.data.route.number}   ${s.name}`, 'Timetable in route display'], 0.8, 1.1, 2.15, 1.6, -1.6, -Math.PI / 2, { size: 55 });
      mergeChildren(g);
    }
  }
  buildSignals() {
    const { world, root, mats } = this;
    const lens = new THREE.CircleGeometry(0.1, 16), hoodGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.13, 10, 1, true, 0, Math.PI);
    for (const s of world.signals) {
      const q = world.at(s.s), r = right(q.yaw), p = add(q.point, scale(r, s.poleOffset ?? 2.55));
      const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = -q.yaw; root.add(g);
      cylinder(g, mats.metal, 0.055, 0.075, 3.6, 0, 1.8, 0, 8); box(g, mats.black, 0.31, 0.94, 0.22, 0, 3.08, 0, true); const lamps = [];
      for (let i = 0; i < 3; i++) {
        const mat = new THREE.MeshBasicMaterial({ toneMapped: false }), disc = new THREE.Mesh(lens, mat); setLegacy(mat.color, 0x181d1a); disc.position.set(0, 3.37 - i * 0.29, 0.119); g.add(disc); lamps.push(mat);
        const hood = new THREE.Mesh(hoodGeo, mats.black); hood.rotation.x = Math.PI / 2; hood.position.set(0, 3.4 - i * 0.29, 0.17); g.add(hood);
      }
      mergeChildren(g, new Set(g.children.filter((m) => lamps.includes(m.material))));
      this.signalMeshes.push({ s, lamps, phase: '' });
    }
  }
  buildStopSigns() {
    const { world, root, mats } = this; if (!world.stopSigns.length) return;
    const face = makeLabel('STOP', 256, 256, { background: '#c0261d', color: '#ffffff', size: 86, weight: 800 });
    const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.5 }), octagon = new THREE.CircleGeometry(0.42, 8, Math.PI / 8);
    for (const s of world.stopSigns) {
      const q = world.at(s.s), p = add(q.point, scale(right(q.yaw), s.poleOffset ?? 3.2));
      const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = -q.yaw; root.add(g);
      cylinder(g, mats.metal, 0.04, 0.04, 2.6, 0, 1.3, 0, 8);
      const front = new THREE.Mesh(octagon, faceMat); front.position.set(0, 2.45, 0.05); g.add(front);
      const back = new THREE.Mesh(octagon, mats.metal); back.position.set(0, 2.45, 0.035); back.rotation.y = Math.PI; g.add(back);
    }
  }
  /** Lamps, people at stops, walkers and traffic: once per rendered frame. */
  update(sim) {
    const { world, mats } = this, bus = [sim.bus.x, sim.bus.z], range = this.range;
    for (const c of this.chunks) c.group.visible = distance(c.center, bus) < range + c.radius;
    for (const sm of this.signalMeshes) {
      const phase = signalPhase(sim.time, sm.s.offset); if (phase === sm.phase) continue; sm.phase = phase; const lamps = sm.lamps;
      setLegacy(lamps[0].color, phase === 'red' || phase === 'red-amber' ? 0xff372b : 0x23130f); setLegacy(lamps[1].color, phase === 'amber' || phase === 'red-amber' ? 0xffc334 : 0x242016); setLegacy(lamps[2].color, phase === 'green' ? 0x42e69b : 0x0e2920);
    }
    for (const mesh of this.people.values()) mesh.visible = false;
    for (let i = Math.max(0, sim.stopIndex - 1); i < Math.min(world.stops.length, sim.stopIndex + 3); i++) {
      const stop = world.stops[i], waiting = sim.manifests[i]; if (!waiting || distance(stop.point, bus) > 180) continue;
      const f = forward(stop.yaw), r = right(stop.yaw);
      waiting.forEach((p, j) => {
        const id = `waiting-${p.id}`; let mesh = this.people.get(id);
        if (!mesh) { mesh = makePerson(mats, id, p.coat, p.kind); this.root.add(mesh); this.people.set(id, mesh); }
        const a = 0.45 + (j % 2) * 0.6, b = -1.3 - Math.floor(j / 2) * 0.85;
        mesh.position.set(stop.point[0] + r[0] * a + f[0] * b, 0.15, stop.point[1] + r[1] * a + f[1] * b); mesh.rotation.y = -stop.yaw + Math.PI / 2; mesh.visible = true;
      });
    }
    for (const p of sim.traffic.walkers) {
      if (!p.active && !p.waiting) continue;
      const id = `walker-${p.id}`; let mesh = this.people.get(id);
      if (!mesh) { mesh = makePerson(mats, id, hash(id) % 6); this.root.add(mesh); this.people.set(id, mesh); }
      mesh.visible = true; mesh.position.set(p.point[0], 0.08, p.point[1]); mesh.rotation.y = -(p.crossing.yaw || 0) + Math.PI / 2;
    }
    for (const car of sim.traffic.cars) {
      let mesh = this.carMeshes.get(car.id);
      if (!mesh) { mesh = makeCar(mats, car.color); this.root.add(mesh); this.carMeshes.set(car.id, mesh); }
      mesh.visible = !car.retired && distance(car.point, bus) < 450; mesh.position.set(car.point[0], 0.035, car.point[1]); mesh.rotation.y = -car.yaw;
    }
  }
  /** A new shift: people and traffic come from the new simulation. */
  resetActors() {
    for (const m of this.people.values()) this.root.remove(m); this.people.clear();
    for (const m of this.carMeshes.values()) this.root.remove(m); this.carMeshes.clear();
  }
  dispose() {
    this.resetActors(); this.root.removeFromParent();
    // Shared person/car geometry stays cached; everything else built here goes.
    const keep = new Set(); for (const p of personParts.values()) for (const g of Object.values(p)) keep.add(g); for (const p of carParts || []) keep.add(p.geometry);
    this.root.traverse((o) => { if (o.geometry && !keep.has(o.geometry)) o.geometry.dispose(); if (o.material && !this.shared.has(o.material)) { o.material.map?.dispose(); o.material.dispose(); } });
  }
}
