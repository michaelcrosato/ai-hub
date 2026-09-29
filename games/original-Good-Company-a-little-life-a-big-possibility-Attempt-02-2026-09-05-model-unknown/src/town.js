/* The procedural low-poly town, drawn with three.js r186 (WebGPU, WebGL2 fallback) on the kit.
   The town is still described as simple shapes (boxes, cylinders, roofs, icospheres) exactly as
   before; static shapes are baked into a few merged, vertex-coloured meshes, and the moving
   parts (people, cars, markers) are small groups updated each frame. */

import * as THREE from 'three/webgpu';
import { uniform, vertexColor } from 'three/tsl';
import { VENUES, clamp } from './sim.js';

// The town was lit in Babylon's gamma space: colours go in and come out unconverted.
THREE.ColorManagement.enabled = false;

const TAU = Math.PI * 2;
const C = { grass: '#bdce9e', grass2: '#c9d8ad', grass3: '#a9c18a', stone: '#eee8d5', road: '#a2b7b2', curb: '#f2edda', white: '#fff9e8', wood: '#a77b54', dark: '#566d5a', water: '#8cc6c5', window: '#9ebcb7', roof: '#dba17d', pink: '#d7acb2', lavender: '#bbb3cb', leaf: '#8cab75', leaf2: '#a3bd84' };
const VENUE_IDS = Object.keys(VENUES);
const LANTERNS = ['#f6d27a', '#f3a88c', '#fff3c4', '#b9d9c9'];

/** Vertices and faces (outward, counter-clockwise) for the few primitive shapes the town uses. */
function geometry(type, opts = {}) {
  const w = opts.w || 1;
  const h = opts.h || 1;
  const d = opts.d || 1;
  if (type === 'box') {
    return {
      v: [[-w / 2, -h / 2, -d / 2], [w / 2, -h / 2, -d / 2], [w / 2, h / 2, -d / 2], [-w / 2, h / 2, -d / 2], [-w / 2, -h / 2, d / 2], [w / 2, -h / 2, d / 2], [w / 2, h / 2, d / 2], [-w / 2, h / 2, d / 2]],
      f: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]],
    };
  }
  if (type === 'roof') {
    return {
      v: [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w / 2, h, 0], [w / 2, h, 0]],
      f: [[4, 5, 1, 0], [2, 5, 4, 3], [3, 4, 0], [5, 2, 1], [1, 2, 3, 0]],
    };
  }
  if (type === 'ico') {
    const t = (1 + Math.sqrt(5)) / 2;
    const r = opts.r || 1;
    const vs = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => {
      const l = Math.hypot(...v);
      return v.map((n, i) => (n / l) * r * (opts.stretch ? opts.stretch[i] : 1));
    });
    return { v: vs, f: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]] };
  }
  const n = opts.n || 8;
  const rt = opts.rt ?? opts.r ?? 1;
  const rb = opts.rb ?? opts.r ?? 1;
  const v = [];
  const f = [];
  for (let i = 0; i < n; i++) v.push([Math.cos((i / n) * TAU) * rb, -h / 2, Math.sin((i / n) * TAU) * rb]);
  for (let i = 0; i < n; i++) v.push([Math.cos((i / n) * TAU) * rt, h / 2, Math.sin((i / n) * TAU) * rt]);
  for (let i = 0; i < n; i++) f.push([i, i + n, ((i + 1) % n) + n, (i + 1) % n]);
  f.push(Array.from({ length: n }, (_, i) => i));
  f.push(Array.from({ length: n }, (_, i) => 2 * n - 1 - i));
  return { v, f };
}

function faceNormal(vs) {
  for (let i = 1; i < vs.length - 1; i++) {
    const a = vs[0];
    const b = vs[i];
    const c = vs[i + 1];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n);
    if (l > 1e-8) return [n[0] / l, n[1] / l, n[2] / l];
  }
  return [0, 1, 0];
}

/** A shape's vertex in its parent space (local = without the group transform). */
function bake(v, s, withGroup) {
  const cos = Math.cos(s.rotation || 0);
  const sin = Math.sin(s.rotation || 0);
  let x = v[0] * cos + v[2] * sin + (s.x || 0);
  let y = v[1] + (s.y || 0);
  let z = -v[0] * sin + v[2] * cos + (s.z || 0);
  if (withGroup && s.group) {
    const g = s.group;
    const c = Math.cos(g.rotation || 0);
    const ss = Math.sin(g.rotation || 0);
    const scale = g.scale || 1;
    const nx = x * c + z * ss;
    const nz = -x * ss + z * c;
    x = nx * scale + g.x;
    y = y * scale + (g.y || 0);
    z = nz * scale + g.z;
  }
  return [x, y, z];
}

const rgbCache = new Map();
function rgb(hex) {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    rgbCache.set(hex, c);
  }
  return c;
}

/** Collects triangles (flat normals, per-vertex colour, per-triangle venue) into one geometry. */
class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.venue = [];
  }
  add(s, place) {
    const col = rgb(s.color);
    const venue = s.venue ? VENUE_IDS.indexOf(s.venue) + 1 : 0;
    const verts = s.geo.v.map(place);
    for (const f of s.geo.f) {
      const n = faceNormal(f.map((i) => verts[i]));
      for (let i = 1; i < f.length - 1; i++) {
        for (const k of [f[0], f[i], f[i + 1]]) {
          const p = verts[k];
          this.pos.push(p[0], p[1], p[2]);
          this.nrm.push(n[0], n[1], n[2]);
          this.col.push(col[0], col[1], col[2]);
        }
        this.venue.push(venue);
      }
    }
  }
  get empty() {
    return this.pos.length === 0;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.userData.venues = Uint8Array.from(this.venue);
    g.computeBoundingSphere();
    return g;
  }
}

const shortestAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Town {
  constructor(kit, game, callbacks = {}) {
    this.kit = kit;
    this.game = game;
    this.callbacks = callbacks;
    this.yaw = -Math.PI / 4;
    this.yawTarget = this.yaw;
    this.elevation = 0.68;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.time = 0;
    this.isWalking = false;
    this.path = [];
    this.intent = null;
    this.width = 1;
    this.height = 1;
    this.scale = 1;
    this.labelsDirty = true;
    this.companionFor = null;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#e9efe2');
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

    // Babylon's hemispheric sky light and a soft sun (legacy light units × π).
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xd4d0b0, 0.73 * Math.PI);
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 0.42 * Math.PI));
    sun.position.set(-0.45, 1, -0.5).multiplyScalar(50);
    sun.castShadow = true;
    kit.shadow(sun, 2048);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    sun.shadow.intensity = 0.78; // Babylon's shadow darkness 0.22
    scene.add(this.hemi, sun, sun.target);

    // Shared materials: the town is vertex-coloured, so a handful covers everything.
    this.glowLevel = uniform(0.35);
    const glow = new THREE.MeshLambertNodeMaterial({ vertexColors: true });
    glow.emissiveNode = vertexColor().rgb.mul(this.glowLevel);
    this.mat = {
      solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
      glow,
      dest: new THREE.MeshLambertMaterial({ color: '#9db77c', transparent: true, opacity: 0.65, depthWrite: false }),
      dot: new THREE.MeshLambertMaterial({ color: '#fdfbe9' }),
      markerTop: new THREE.MeshLambertMaterial({ color: '#91b558', emissive: '#91b558', emissiveIntensity: 0.35 }),
      markerBottom: new THREE.MeshLambertMaterial({ color: '#739a4a', emissive: '#739a4a', emissiveIntensity: 0.35 }),
    };

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.dotMatrix = new THREE.Matrix4();

    this.root = new THREE.Group();
    scene.add(this.root);
    this.build();
    kit.onResize((w, h) => this.resize(w, h));
  }

  /* ------------------------------------------------------------ shape description */

  shape(type, x, y, z, color, opts = {}, group = null, extra = {}) {
    const s = { type, x, y, z, color, geo: geometry(type, opts), group, ...extra };
    this.shapes.push(s);
    if (group) group.shapes.push(s);
    return s;
  }
  box(x, y, z, w, h, d, color, group = null, extra = {}) {
    return this.shape('box', x, y, z, color, { w, h, d }, group, extra);
  }
  cyl(x, y, z, r, h, color, group = null, extra = {}) {
    return this.shape('cylinder', x, y, z, color, { r, h, n: 8 }, group, extra);
  }
  ico(x, y, z, r, color, group = null, stretch = null, extra = {}) {
    return this.shape('ico', x, y, z, color, { r, stretch }, group, extra);
  }
  group(x, z, y = 0, rotation = 0, scale = 1) {
    const g = { x, z, y, rotation, scale, shapes: [], hidden: false, dynamic: false };
    this.groups.push(g);
    return g;
  }

  build() {
    this.shapes = [];
    this.obstacles = [];
    this.groups = [];
    this.npcs = [];
    this.musicians = [];
    this.path = [];
    this.intent = null;
    this.companionFor = null;
    const region = this.game.s.region;
    const grass = region === 'coast' ? '#cdd6a5' : region === 'arts' ? '#c1cda6' : C.grass;
    this.box(0, -0.95, 0, 41, 1.35, 33, '#d0c9aa');
    this.box(0, -0.38, 0, 41, 0.5, 33, '#e9e1c7');
    this.box(0, -0.09, 0, 40.8, 0.14, 32.8, grass);
    this.box(-2.15, 0.005, -1.1, 35.4, 0.06, 4.9, C.curb);
    this.box(-2.15, 0.045, -1.1, 35.4, 0.045, 3.05, C.road);
    this.box(5, 0.01, 0, 4.25, 0.055, 31, C.curb);
    this.box(5, 0.05, 0, 2.85, 0.05, 31, C.road);
    // Soft road markings and a pair of crosswalks.
    for (let x = -18; x < 15; x += 3) {
      if (Math.abs(x - 5) < 3) continue;
      this.box(x, 0.076, -1.08, 1.25, 0.009, 0.07, '#e2e8d9');
    }
    for (let z = -13; z < 14; z += 3) {
      if (Math.abs(z + 1) < 3) continue;
      this.box(5, 0.079, z, 0.06, 0.01, 1.05, '#e2e8d9');
    }
    for (let i = 0; i < 6; i++) {
      this.box(2.2 + i * 0.35, 0.085, -1.1, 0.2, 0.015, 2.7, '#f3f0df');
      this.box(5, 0.085, 1.0 + i * 0.35, 2.5, 0.015, 0.18, '#f3f0df');
    }
    // The canal and a little pedestrian bridge.
    this.box(18.1, -0.012, 0, 4.3, 0.055, 32.6, region === 'coast' ? '#82bebf' : C.water);
    this.box(15.8, 0.14, 0, 0.35, 0.31, 32.7, C.stone);
    this.box(20.25, 0.02, 0, 0.45, 0.13, 32.7, '#dce2c4');
    for (let i = 0; i < 20; i++) {
      const z = -14 + i * 1.48;
      const x = 16.5 + (i % 3) * 0.9;
      if (Math.abs(z - 7) < 3.2) continue; // the Lantern Barge is moored here
      this.box(x, 0.03, z, 0.42 + (i % 3) * 0.16, 0.012, 0.035, '#b7dfd4');
    }
    this.box(18.1, 0.19, -1, 4.8, 0.26, 2.9, C.wood);
    for (let x = 16; x < 20.5; x += 0.35) this.box(x, 0.338, -1, 0.045, 0.012, 2.7, '#d3af7c');
    for (const z of [-2.35, 0.35]) {
      this.box(18.15, 1.01, z, 4.8, 0.09, 0.09, C.white);
      for (let x = 16; x < 20.6; x += 0.8) this.box(x, 0.64, z, 0.08, 0.82, 0.08, C.white);
    }
    // Blocks, garden paths, and individual buildings.
    for (const [x, z, w, d] of [[-13, -10, 10, 9], [-3, -10, 7.5, 8.8], [10.7, -10, 8.7, 9], [-13, 8, 10, 11], [-3, 8, 7.8, 11], [10.6, 8, 8.8, 11]]) {
      this.box(x, 0.032, z, w, 0.05, d, (x + z) % 3 === 0 ? C.grass2 : grass);
      this.box(x, 0.065, z, w - 0.5, 0.045, d - 0.5, (x + z) % 3 === 0 ? grass : C.grass2);
      const start = z < 0 ? -5.6 : 3.65;
      this.box(x, 0.09, (z + start) / 2, 1.65, 0.035, Math.abs(z - start) + 0.6, C.stone);
    }
    this.buildHouse(-13, -10, 5.9, 4.9, 3.2, '#f1d5b1', region === 'arts' ? '#c2a4b5' : C.roof, 'home');
    this.buildHouse(-3, -10, 5.1, 4.65, 2.75, '#e5e9cf', '#a4b995', 'wellness', true);
    this.buildHouse(10.7, -10, 5.35, 4.7, 3.0, '#efd9c4', '#b8b2c4', 'studio', true);
    this.buildHouse(-13, 8, 6.15, 4.9, 3.05, '#f2e3c3', '#d1a679', 'cafe');
    this.buildHouse(-3, 8, 5.7, 4.9, 3.1, '#e8d6c7', '#c2aaa0', 'gallery', true);
    this.buildHouse(10.6, 8, 6.35, 5.2, 4.0, region === 'coast' ? '#f3d8b0' : '#eddbad', '#bcb389', 'lounge');
    // Cafe striped awning facing the street and terrace to its west.
    for (let i = 0; i < 12; i++) this.box(-15.6 + i * 0.47, 2.45, 5.15, 0.46, 0.16, 1.35, i % 2 ? C.white : '#90a886', null, { venue: 'cafe' });
    for (const x of [-15.65, -10.3]) this.cyl(x, 1.2, 4.6, 0.045, 2.4, C.white, null, { venue: 'cafe' });
    this.box(-17.35, 0.12, 7.3, 2.6, 0.12, 6.8, '#ebe1c9');
    for (const z of [5.3, 8.5]) this.table(-17.4, z, 1.06, '#e4bb70', true);
    this.table(-12.1, 4.15, 0.65, '#e9c684', false);
    for (const x of [-5, -1]) this.cyl(x, 0.55, 4.95, 0.36, 0.9, '#cab99a', null, { venue: 'gallery' });
    // Public square and fountain.
    this.box(10.5, 0.06, 1.6, 7.7, 0.1, 4.7, '#e3ddc5');
    this.box(10.5, 0.13, 1.6, 7.1, 0.04, 4.15, C.stone);
    this.cyl(10.8, 0.28, 2.0, 1.55, 0.35, '#d0ccb3');
    this.cyl(10.8, 0.48, 2.0, 1.39, 0.15, '#f5edd7');
    this.cyl(10.8, 0.57, 2.0, 1.23, 0.04, '#8fc8c3');
    this.cyl(10.8, 0.92, 2.0, 0.24, 0.74, '#eee6ce');
    this.cyl(10.8, 1.2, 2.0, 0.72, 0.16, '#f4e9cd');
    this.cyl(10.8, 1.29, 2.0, 0.58, 0.03, '#9bcac0');
    this.ico(10.8, 1.48, 2.0, 0.19, '#d5e6d5');
    this.obstacles.push({ x: 10.8, z: 2, w: 2.6, d: 2.6 });
    this.bench(8, 2.9, 0);
    this.bench(13.8, 2.9, 0);
    this.bench(13.9, -4.2, Math.PI / 2);
    // Wooden fences and clipped hedges make the blocks feel lived-in.
    this.fence(-17.4, -13.5, 8.7);
    this.fence(-6.2, -13.5, 6.0);
    this.fence(7.1, -13.5, 7.1);
    for (const [x, z, w] of [[-13, 11.8, 7.6], [-3, 11.8, 6.7], [10.8, 12.2, 7.2]]) for (let i = 0; i < w; i += 0.7) this.ico(x - w / 2 + i, 0.6, z, 0.63, '#91aa73', null, [1, 1, 1]);
    for (const [x, z, r, col] of [[-18, -10, 1.6, C.leaf], [-18, -3.9, 1.5, C.leaf2], [-18, 12.3, 1.7, C.pink], [-8.6, 12.8, 1.65, C.leaf], [-7.8, -8.5, 1.15, C.pink], [1.1, -10, 1.25, C.leaf2], [1.7, 11.5, 1.5, C.leaf], [14.2, -11.8, 1.5, C.pink], [14.35, 11.8, 1.7, C.leaf], [14, -5, 1.3, C.leaf], [1, 4.3, 1.25, C.lavender], [-7.9, 4.3, 1.15, C.leaf2], [-18.4, 1.8, 1.35, C.leaf2]]) this.tree(x, z, r, col);
    for (const [x, z] of [[-17, -4], [-7, -4], [1, -4], [8, -4], [-17, 2], [-7, 2], [2, 2], [14, 5]]) this.lamp(x, z);
    for (const [x, z] of [[-15.2, -6.6], [-11, -6.6], [-5.8, -7.5], [-0.4, -7.5], [8.4, -7.6], [13, -7.5], [-15.5, 11], [-10.5, 11], [8.2, 11.3]]) this.flowers(x, z);
    // Art outside the gallery, a studio easel, and tiny sidewalk signs.
    this.box(-3, 3.55, 8, 1.0, 0.08, 1.0, '#d4bd99', null, { venue: 'gallery' });
    this.ico(-3, 4.04, 8, 0.62, '#a2b2a5', null, null, { venue: 'gallery' });
    this.box(7.5, 0.75, -7.45, 0.9, 1.3, 0.1, C.wood);
    this.box(7.5, 1, -7.53, 0.73, 0.76, 0.035, '#f8e3ce');
    this.ico(7.5, 1, -7.56, 0.18, C.pink);
    this.sign(-10.05, 4.28, '#8ea180');
    this.sign(7.2, 4.4, '#d4b782');
    this.buildBarge();

    const a = this.game.s.avatar;
    this.player = this.character(a.x, a.z, a.outfit, a.skin, a.hair, 1.05);
    this.playerMarker = this.shape('cylinder', 0, 2.1, 0, '#91b558', { rt: 0, rb: 0.21, h: 0.36, n: 4 }, this.player, { marker: 'markerTop' });
    this.shape('cylinder', 0, 1.83, 0, '#739a4a', { rt: 0.21, rb: 0, h: 0.18, n: 4 }, this.player, { marker: 'markerBottom' });
    const npcDefs = [[-16, -3.45, '#afbac4', '#b78460', '#463b32'], [0, 1.65, '#c8a887', '#e1b38d', '#5a3a2d'], [-8, 2.2, '#afa8ba', '#825436', '#302728'], [7.7, -5, '#9db8a2', '#d9b491', '#766045'], [1, -3.5, '#d1b480', '#b77e56', '#332b25']];
    npcDefs.forEach((n, i) => {
      const g = this.character(...n, 0.86 + (i % 2) * 0.1);
      this.npcs.push({ g, x: g.x, z: g.z, phase: i * 1.2, axis: i % 2 ? 'z' : 'x', span: i % 2 ? 2 : 3.5 });
    });
    this.dateCompanion = this.character(10, 4, '#a7b6c0', '#d6a478', '#3d3931', 1);
    this.dateCompanion.hidden = true;
    this.car = this.buildCar(-9, -1.76, '#eedbb0');
    this.car2 = this.buildCar(11, -0.3, '#c5acb6');
    this.car2.rotation = Math.PI;
    this.destination = { x: 0, z: 0, hidden: true };
    this.routeCount = 0;
    this.makeMeshes();
  }

  buildHouse(x, z, w, d, h, color, roof, venue, flat = false) {
    this.obstacles.push({ x, z, w: w + 0.7, d: d + 0.7 });
    const e = { venue };
    this.box(x, 0.13, z, w + 0.35, 0.25, d + 0.35, '#dad4bd', null, e);
    this.box(x, h / 2 + 0.24, z, w, h, d, color, null, e);
    this.box(x, h + 0.28, z, w + 0.25, 0.2, d + 0.25, C.white, null, e);
    if (flat) {
      this.box(x, h + 0.43, z, w + 0.42, 0.15, d + 0.38, roof, null, e);
      this.box(x, h + 0.62, z, w - 0.45, 0.15, d - 0.55, roof, null, e);
      this.box(x - w / 2 + 0.15, h + 0.55, z, 0.2, 0.48, d, roof, null, e);
    } else {
      this.shape('roof', x, h + 0.38, z, roof, { w: w + 0.55, h: 1.25, d: d + 0.6 }, null, e);
      for (let i = 0; i < 5; i++) this.box(x - w / 2 + 0.45 + (i * (w - 0.9)) / 4, h + 0.8, z + 0.65, 0.055, 0.04, d / 2 - 0.7, '#e8b291', null, e);
    }
    // Front and rear glazing, plus west-facing side windows.
    for (const zz of [z - d / 2 - 0.04, z + d / 2 + 0.04]) {
      const out = zz > z ? 1 : -1;
      for (const xx of [x - w * 0.28, x + w * 0.28]) {
        this.box(xx, h * 0.52, zz, 1.1, 1.22, 0.1, C.white, null, e);
        this.box(xx, h * 0.52, zz + out * 0.07, 0.91, 1.02, 0.035, C.window, null, e);
        this.box(xx, h * 0.52, zz + out * 0.1, 0.05, 1.07, 0.03, C.white, null, e);
        this.box(xx, h * 0.52, zz + out * 0.1, 0.96, 0.045, 0.03, C.white, null, e);
      }
      this.box(x, 0.96, zz, 0.8, 1.43, 0.12, venue === 'home' ? '#8fa790' : '#adbcaa', null, e);
      this.box(x, 0.13, zz + out * 0.4, 1.3, 0.22, 0.75, '#e8dfca', null, e);
    }
    for (const zz of [z - d * 0.25, z + d * 0.25]) {
      this.box(x - w / 2 - 0.07, h * 0.55, zz, 0.1, 1.23, 1.07, C.white, null, e);
      this.box(x - w / 2 - 0.13, h * 0.55, zz, 0.02, 1.02, 0.89, C.window, null, e);
      this.box(x - w / 2 - 0.15, h * 0.55, zz, 0.02, 0.05, 0.89, C.white, null, e);
    }
    if (venue === 'lounge') {
      for (const xx of [x - w * 0.27, x + w * 0.27]) this.box(xx, 3.2, z - d / 2 - 0.08, 1.05, 0.8, 0.07, C.window, null, e);
      this.box(x, 2.5, z - d / 2 - 0.12, w, 0.1, 0.25, C.white, null, e);
    }
    if (venue === 'home') {
      this.box(x + 1.4, h + 0.6, z - 0.55, 0.6, 1.5, 0.67, '#e4cba4', null, e);
      this.box(x + 1.4, h + 1.38, z - 0.55, 0.75, 0.15, 0.8, C.white, null, e);
    }
    if (venue === 'wellness') {
      this.box(x, h * 0.8, z + d / 2 + 0.1, 0.75, 0.16, 0.1, C.white, null, e);
      this.box(x, h * 0.8, z + d / 2 + 0.13, 0.16, 0.75, 0.1, C.white, null, e);
    }
  }

  /** The Lantern Barge: a moored canal boat with a little music deck and strings of lanterns. */
  buildBarge() {
    const e = { venue: 'barge' };
    const x = 18.1;
    const z = 7;
    const hull = '#6f8f88';
    this.box(x, 0.15, z, 2.3, 0.42, 4.8, hull, null, e);
    this.box(x, 0.17, z - 2.65, 1.5, 0.38, 0.5, hull, null, e);
    this.box(x, 0.17, z + 2.65, 1.7, 0.38, 0.5, hull, null, e);
    this.box(x, 0.33, z, 2.38, 0.06, 4.88, '#f2edda', null, e);
    this.box(x, 0.39, z, 2.14, 0.05, 4.64, '#caa57a', null, e);
    for (let zz = z - 2.1; zz < z + 2.2; zz += 0.42) this.box(x, 0.418, zz, 2.1, 0.008, 0.03, '#b8915f', null, e);
    // Cabin with windows on both sides and a coral roof.
    this.box(x, 0.93, z + 1.0, 1.7, 1.0, 2.4, '#f4e6cc', null, e);
    this.box(x, 1.49, z + 1.0, 1.98, 0.1, 2.7, '#c97454', null, e);
    for (const zz of [z + 0.25, z + 1.0, z + 1.75]) {
      for (const side of [-1, 1]) {
        this.box(x + side * 0.86, 1.0, zz, 0.06, 0.5, 0.56, C.white, null, e);
        this.box(x + side * 0.89, 1.0, zz, 0.03, 0.4, 0.46, C.window, null, e);
      }
    }
    this.box(x, 0.82, z - 0.22, 0.55, 0.78, 0.05, '#9fb3a0', null, e);
    // The music deck: a little amp and a stool.
    this.box(x + 0.5, 0.56, z - 2.1, 0.35, 0.28, 0.3, C.dark, null, e);
    this.cyl(x - 0.6, 0.6, z - 2.05, 0.14, 0.36, C.wood, null, e);
    // Lantern strings: bow post → roof mast → stern post.
    this.cyl(x, 1.2, z - 2.45, 0.04, 1.6, C.dark, null, e);
    this.cyl(x, 1.95, z + 1.0, 0.04, 0.8, C.dark, null, e);
    this.cyl(x, 1.2, z + 2.55, 0.04, 1.6, C.dark, null, e);
    const strand = (from, to, count, offset) => {
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const sag = Math.sin(t * Math.PI) * 0.22;
        this.ico(x, from[1] + (to[1] - from[1]) * t - sag, from[2] + (to[2] - from[2]) * t, 0.075, LANTERNS[(i + offset) % LANTERNS.length], null, null, { ...e, emissive: true });
      }
    };
    strand([x, 2.0, z - 2.45], [x, 2.33, z + 1.0], 8, 0);
    strand([x, 2.33, z + 1.0], [x, 2.0, z + 2.55], 5, 2);
    // Gangplank from the quay, with rope rails, and two mooring posts.
    this.box(16.35, 0.32, z, 1.3, 0.06, 0.66, C.wood, null, e);
    for (const dz of [-0.33, 0.33]) {
      this.box(16.35, 0.58, z + dz, 1.3, 0.035, 0.035, '#d3af7c', null, e);
      for (const px of [15.75, 16.95]) this.box(px, 0.46, z + dz, 0.05, 0.3, 0.05, C.white, null, e);
    }
    for (const dz of [-2.1, 2.1]) {
      this.cyl(15.8, 0.42, z + dz, 0.09, 0.26, C.dark);
      this.box(16.35, 0.4, z + dz, 1.1, 0.03, 0.03, '#d3af7c');
    }
    this.sign(15.1, 9.6, '#c97454');
    // Two musicians who arrive for the evening sets.
    const cellist = this.character(18.55, z - 1.65, '#9d8fb0', '#e7c3a0', '#6b4a33', 0.82);
    this.ico(0.05, 0.62, 0.32, 0.2, '#8a5634', cellist, [1, 1.5, 0.5]);
    this.box(0.05, 1.08, 0.32, 0.05, 0.45, 0.05, '#3d3931', cellist);
    const guitarist = this.character(17.6, z - 1.5, '#c9b27f', '#b9835c', '#3a2e27', 0.82);
    this.ico(0.1, 0.8, 0.24, 0.17, '#b0764a', guitarist, [1, 1.25, 0.45]);
    this.box(0.1, 1.15, 0.26, 0.05, 0.42, 0.05, '#6a4d36', guitarist);
    for (const [g, phase] of [[cellist, 0], [guitarist, 1.7]]) {
      g.rotation = -Math.PI / 2 + 0.35;
      g.baseY = 0.415;
      g.y = g.baseY;
      this.musicians.push({ g, phase, base: g.rotation });
    }
  }

  tree(x, z, r, color) {
    this.cyl(x, 1.2, z, 0.12, 2.4, '#9c815e');
    this.ico(x, 2.1 + r * 0.28, z, r, color, null, [1, 0.99, 1]);
    this.ico(x - 0.28, 2.6 + r * 0.18, z - 0.1, r * 0.7, color === C.pink ? '#e2bbc2' : color === C.lavender ? '#cbc1d9' : '#acc289');
  }
  flowers(x, z) {
    this.cyl(x, 0.25, z, 0.4, 0.43, '#d2b38b');
    for (let i = 0; i < 4; i++) this.ico(x + Math.cos(i * 2) * 0.19, 0.61 + (i % 2) * 0.13, z + Math.sin(i * 2) * 0.19, 0.22, i % 2 ? '#ecc7b9' : '#a4b885');
  }
  table(x, z, r, color, umbrella) {
    this.cyl(x, 0.54, z, 0.06, 0.9, C.wood);
    this.cyl(x, 1.0, z, r * 0.66, 0.09, '#e3c896');
    this.cyl(x + 0.15, 1.1, z, 0.08, 0.15, C.white);
    for (const side of [-1, 1]) {
      this.box(x + side * r, 0.53, z, 0.55, 0.08, 0.55, C.white);
      this.box(x + side * (r + 0.21), 0.82, z, 0.075, 0.57, 0.55, C.white);
      for (const dz of [-0.2, 0.2]) this.box(x + side * r, 0.26, z + dz, 0.07, 0.5, 0.07, C.wood);
    }
    if (umbrella) {
      this.cyl(x, 1.48, z, 0.055, 2.7, C.wood);
      this.shape('cylinder', x, 2.65, z, color, { rt: 0, rb: r * 1.35, h: 0.56, n: 8 });
      this.cyl(x, 2.35, z, r * 1.35, 0.06, color);
    }
  }
  bench(x, z, rotation) {
    const g = this.group(x, z, 0, rotation);
    this.box(0, 0.6, 0, 1.6, 0.12, 0.6, C.wood, g);
    this.box(0, 0.95, 0.25, 1.6, 0.55, 0.1, '#b69264', g);
    for (const xx of [-0.58, 0.58]) {
      this.box(xx, 0.29, 0, 0.12, 0.55, 0.42, C.dark, g);
      this.box(xx, 0.72, 0.28, 0.08, 1.0, 0.08, C.dark, g);
    }
  }
  lamp(x, z) {
    this.cyl(x, 1.4, z, 0.045, 2.8, '#687b65');
    this.box(x, 2.81, z, 0.41, 0.1, 0.41, C.dark);
    this.box(x, 2.62, z, 0.29, 0.3, 0.29, '#fbefd0', null, { emissive: true });
    this.box(x, 2.42, z, 0.4, 0.08, 0.4, C.dark);
  }
  fence(x, z, length) {
    for (let dx = 0; dx < length; dx += 0.65) this.box(x + dx, 0.57, z, 0.12, 1.1, 0.12, C.white);
    this.box(x + length / 2 - 0.1, 0.83, z, length, 0.1, 0.1, C.white);
    this.box(x + length / 2 - 0.1, 0.31, z, length, 0.1, 0.1, C.white);
  }
  sign(x, z, color) {
    this.box(x, 0.56, z, 0.69, 1.02, 0.12, C.wood);
    this.box(x, 0.63, z - 0.08, 0.53, 0.67, 0.04, color);
    for (let i = 0; i < 3; i++) this.box(x, 0.8 - i * 0.13, z - 0.107, 0.34 - i * 0.04, 0.035, 0.01, C.white);
  }
  character(x, z, outfit, skin, hair, scale = 1) {
    const g = this.group(x, z, 0, 0, scale);
    g.dynamic = true;
    g.limbs = [];
    g.limbs.push(this.box(-0.14, 0.32, 0, 0.18, 0.57, 0.21, '#596356', g, { limb: true }), this.box(0.14, 0.32, 0, 0.18, 0.57, 0.21, '#596356', g, { limb: true }));
    this.box(-0.14, 0.085, 0.05, 0.21, 0.13, 0.3, '#f0ead9', g);
    this.box(0.14, 0.085, 0.05, 0.21, 0.13, 0.3, '#f0ead9', g);
    this.shape('cylinder', 0, 0.83, 0, outfit, { rt: 0.21, rb: 0.3, h: 0.64, n: 6 }, g, { role: 'outfit' });
    this.box(-0.31, 0.85, 0, 0.12, 0.5, 0.14, outfit, g, { role: 'outfit' });
    this.box(0.31, 0.85, 0, 0.12, 0.5, 0.14, outfit, g, { role: 'outfit' });
    this.ico(-0.31, 0.58, 0, 0.09, skin, g, null, { role: 'skin' });
    this.ico(0.31, 0.58, 0, 0.09, skin, g, null, { role: 'skin' });
    this.cyl(0, 1.19, 0, 0.095, 0.15, skin, g, { role: 'skin' });
    this.ico(0, 1.41, 0, 0.26, skin, g, [0.93, 1.05, 0.92], { role: 'skin' });
    this.ico(0, 1.56, -0.07, 0.24, hair, g, [1.04, 0.72, 1], { role: 'hair' });
    this.box(-0.078, 1.42, 0.224, 0.032, 0.037, 0.024, '#4f463a', g);
    this.box(0.078, 1.42, 0.224, 0.032, 0.037, 0.024, '#4f463a', g);
    return g;
  }
  buildCar(x, z, color) {
    const g = this.group(x, z);
    g.dynamic = true;
    this.box(0, 0.45, 0, 2, 0.48, 0.97, color, g);
    this.box(-0.1, 0.88, 0, 1.04, 0.5, 0.89, color, g);
    this.box(0.48, 0.93, 0, 0.03, 0.34, 0.79, C.window, g);
    this.box(-0.66, 0.92, 0, 0.04, 0.35, 0.79, C.window, g);
    this.box(-0.1, 0.92, -0.46, 0.9, 0.33, 0.02, C.window, g);
    this.box(-0.1, 0.92, 0.46, 0.9, 0.33, 0.02, C.window, g);
    for (const xx of [-0.63, 0.63]) {
      for (const zz of [-0.53, 0.53]) {
        this.ico(xx, 0.27, zz, 0.23, '#56615b', g, [1, 1, 0.6]);
        this.ico(xx, 0.27, zz * 1.04, 0.1, '#d4d9c9', g, [1, 1, 0.3]);
      }
    }
    this.box(1.01, 0.44, -0.3, 0.04, 0.15, 0.2, '#fff0cc', g);
    this.box(1.01, 0.44, 0.3, 0.04, 0.15, 0.2, '#fff0cc', g);
    return g;
  }

  /* ------------------------------------------------------------ three.js meshes */

  track(geo) {
    this.geometries.push(geo);
    return geo;
  }

  /** A shape's own geometry around its origin (for the few parts that move on their own). */
  partGeometry(s) {
    const b = new MeshBuilder();
    b.add(s, (v) => v);
    return this.track(b.build());
  }

  makeMeshes() {
    this.geometries = [];
    const cast = new MeshBuilder();
    const rest = new MeshBuilder();
    const glow = new MeshBuilder();
    for (const s of this.shapes) {
      if (s.group?.dynamic) continue;
      const target = s.emissive ? glow : s.y > 0.45 ? cast : rest;
      target.add(s, (v) => bake(v, s, true));
    }
    const add = (builder, material, castShadow) => {
      if (builder.empty) return null;
      const mesh = new THREE.Mesh(this.track(builder.build()), material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
      return mesh;
    };
    this.pickables = [add(cast, this.mat.solid, true), add(rest, this.mat.solid, false), add(glow, this.mat.glow, false)].filter(Boolean);

    // Moving groups: one merged body plus the parts that animate by themselves.
    const legGeo = new Map();
    this.dynamic = [];
    for (const g of this.groups) {
      if (!g.dynamic) continue;
      const obj = new THREE.Group();
      g.obj = obj;
      g.limbMeshes = [];
      g.markers = [];
      for (const s of g.shapes) {
        if (s.limb) {
          const key = `${s.color}|${s.geo.v.length}`;
          if (!legGeo.has(key)) legGeo.set(key, this.partGeometry({ ...s, x: 0, y: 0, z: 0 }));
          const mesh = new THREE.Mesh(legGeo.get(key), this.mat.solid);
          mesh.position.set(s.x, s.y, s.z);
          mesh.receiveShadow = true;
          obj.add(mesh);
          g.limbMeshes.push({ mesh, shape: s });
        } else if (s.marker) {
          const mesh = new THREE.Mesh(this.partGeometry({ ...s, x: 0, y: 0, z: 0, rotation: 0 }), this.mat[s.marker]);
          mesh.position.set(s.x, s.y, s.z);
          obj.add(mesh);
          g.markers.push(mesh);
        }
      }
      g.body = new THREE.Mesh(this.bodyGeometry(g), this.mat.solid);
      g.body.castShadow = true;
      g.body.receiveShadow = true;
      obj.add(g.body);
      this.root.add(obj);
      this.dynamic.push(g);
    }

    const destShape = { type: 'cylinder', color: '#9db77c', geo: geometry('cylinder', { r: 0.35, h: 0.02, n: 16 }) };
    this.destMesh = new THREE.Mesh(this.partGeometry(destShape), this.mat.dest);
    this.destMesh.visible = false;
    this.destMesh.receiveShadow = true;
    this.root.add(this.destMesh);
    const dotShape = { type: 'cylinder', color: '#fdfbe9', geo: geometry('cylinder', { r: 0.085, h: 0.015, n: 6 }) };
    this.dots = new THREE.InstancedMesh(this.partGeometry(dotShape), this.mat.dot, 36);
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.dots.receiveShadow = true;
    this.root.add(this.dots);
    this.sync();
  }

  bodyGeometry(g) {
    const b = new MeshBuilder();
    for (const s of g.shapes) if (!s.limb && !s.marker) b.add(s, (v) => bake(v, s, false));
    return this.track(b.build());
  }

  /** Repaint a person (the player after customising, or tonight's client). */
  setCharacterColors(g, { outfit, skin, hair }) {
    for (const s of g.shapes) {
      if (s.role === 'outfit' && outfit) s.color = outfit;
      if (s.role === 'skin' && skin) s.color = skin;
      if (s.role === 'hair' && hair) s.color = hair;
    }
    const old = g.body.geometry;
    g.body.geometry = this.bodyGeometry(g);
    this.geometries = this.geometries.filter((x) => x !== old);
    old.dispose();
  }

  dispose() {
    for (const g of this.geometries || []) g.dispose();
    this.geometries = [];
    this.dots?.dispose();
    this.root.clear();
  }

  rebuild() {
    this.dispose();
    this.build();
    this.labelsDirty = true;
  }

  /** Compile every pipeline up front (hidden parts included) so nothing hitches later. */
  async compile() {
    const hidden = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const count = this.dots.count;
    this.dots.count = 1;
    try {
      await this.kit.renderer.compileAsync(this.scene, this.camera);
    } finally {
      for (const o of hidden) o.visible = false;
      this.dots.count = count;
    }
  }

  /* ------------------------------------------------------------ camera */

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.updateCamera();
  }

  updateCamera() {
    const w = this.width;
    const h = this.height;
    this.scale = Math.min(w / 54, h / (w < 500 ? 27 : 38)) * this.zoom;
    const cy = h * (w < 500 ? 0.59 : 0.55);
    const offset = (cy - h / 2) / this.scale;
    const cam = this.camera;
    cam.left = -w / (2 * this.scale);
    cam.right = w / (2 * this.scale);
    cam.top = h / (2 * this.scale) + offset;
    cam.bottom = -h / (2 * this.scale) + offset;
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const e = Math.sin(this.elevation);
    const ce = Math.cos(this.elevation);
    cam.position.set(s * ce * 70, e * 70, c * ce * 70);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.labelsDirty = true;
  }

  /** World point → CSS pixels inside the world panel. */
  project(v) {
    this.tmp.set(v[0], v[1], v[2]).project(this.camera);
    return [((this.tmp.x + 1) / 2) * this.width, ((1 - this.tmp.y) / 2) * this.height];
  }

  rotate(dir) {
    this.yawTarget += (dir * Math.PI) / 2;
    if (this.game.s.settings.reducedMotion) this.yaw = this.yawTarget;
    this.updateCamera();
  }
  adjustZoom(dir) {
    this.zoomBy(dir);
  }
  /** Zoom in steps of the old buttons (0.12); fractions come from the wheel, pinch and stick. */
  zoomBy(amount) {
    this.zoomTarget = clamp(this.zoomTarget + amount * 0.12, 0.65, 1.7);
    if (this.game.s.settings.reducedMotion) {
      this.zoom = this.zoomTarget;
      this.updateCamera();
    }
  }
  resetCamera() {
    this.yawTarget = this.yaw + shortestAngle(-Math.PI / 4 - this.yaw);
    this.zoomTarget = 1;
    if (this.game.s.settings.reducedMotion) {
      this.yaw = this.yawTarget;
      this.zoom = 1;
    }
    this.updateCamera();
  }

  /* ------------------------------------------------------------ picking */

  pick(px, py) {
    this.ndc.set((px / this.width) * 2 - 1, -((py / this.height) * 2 - 1));
    this.raycaster.setFromCamera(this.ndc, this.camera);
    let venue = null;
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (hits.length) {
      const idx = hits[0].object.geometry.userData.venues?.[hits[0].faceIndex] || 0;
      venue = idx ? VENUE_IDS[idx - 1] : null;
    }
    const ground = this.raycaster.ray.intersectPlane(this.groundPlane, this.tmp2);
    return { venue, x: ground ? ground.x : null, z: ground ? ground.z : null };
  }
  /** A click or tap on the town: visit a building, or wander to that spot. */
  click(px, py) {
    const hit = this.pick(px, py);
    if (hit.venue) this.callbacks.venue?.(hit.venue);
    else if (hit.x !== null) this.moveTo(hit.x, hit.z);
  }

  /* ------------------------------------------------------------ walking */

  walkable(x, z) {
    if (x < -19 || x > 20 || z < -14.7 || z > 14.7) return false;
    if (x > 15.55 && !(z > -2.1 && z < 0.12)) return false;
    return !this.obstacles.some((o) => Math.abs(x - o.x) < o.w / 2 + 0.18 && Math.abs(z - o.z) < o.d / 2 + 0.18);
  }
  nearest(x, z) {
    let best = null;
    let dist = Infinity;
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        const xx = Math.round(x) + dx;
        const zz = Math.round(z) + dz;
        if (!this.walkable(xx, zz)) continue;
        const d = (xx - x) ** 2 + (zz - z) ** 2;
        if (d < dist) {
          dist = d;
          best = { x: xx, z: zz };
        }
      }
    }
    return best;
  }
  findPath(x, z) {
    const start = this.nearest(this.player.x, this.player.z);
    const end = this.nearest(x, z);
    if (!start || !end) return null;
    const key = (n) => n.x + ',' + n.z;
    const open = [{ ...start, g: 0, f: 0 }];
    const visited = new Map();
    const done = new Set();
    visited.set(key(start), open[0]);
    let final = null;
    for (let iter = 0; open.length && iter < 2500; iter++) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      const ck = key(current);
      if (done.has(ck)) continue;
      done.add(ck);
      if (current.x === end.x && current.z === end.z) {
        final = current;
        break;
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = current.x + dx;
        const nz = current.z + dz;
        if (!this.walkable(nx, nz) || (dx && dz && (!this.walkable(current.x + dx, current.z) || !this.walkable(current.x, current.z + dz)))) continue;
        const n = { x: nx, z: nz };
        const k = key(n);
        const g = current.g + (dx && dz ? 1.414 : 1);
        if (done.has(k) || (visited.has(k) && visited.get(k).g <= g)) continue;
        const next = { ...n, g, f: g + Math.hypot(nx - end.x, nz - end.z), parent: current };
        visited.set(k, next);
        open.push(next);
      }
    }
    if (!final) return null;
    const path = [];
    while (final) {
      path.unshift({ x: final.x, z: final.z });
      final = final.parent;
    }
    if (path.length > 1 && Math.hypot(path[0].x - this.player.x, path[0].z - this.player.z) < 0.2) path.shift();
    if (this.walkable(x, z) && Math.hypot(end.x - x, end.z - z) < 1.5) path.push({ x, z });
    return path;
  }
  moveTo(x, z, intent = null) {
    if (this.game.s.activeDate) return false;
    const path = this.findPath(x, z);
    if (!path) {
      this.callbacks.notice?.('Try a path or a public venue.');
      return false;
    }
    this.path = path;
    this.intent = intent;
    const last = path[path.length - 1] || { x, z };
    this.destination.x = last.x;
    this.destination.z = last.z;
    this.destination.hidden = false;
    this.updateRoute();
    this.callbacks.moving?.(intent);
    return true;
  }
  visit(id, intent = { venue: id }) {
    const v = VENUES[id];
    if (!v) return false;
    return this.moveTo(v.x, v.z, intent);
  }
  updateRoute() {
    const count = Math.min(36, this.path.length);
    for (let i = 0; i < count; i++) {
      const p = this.path[Math.floor((i * this.path.length) / count)];
      this.dotMatrix.makeTranslation(p.x, 0.09, p.z);
      this.dots.setMatrixAt(i, this.dotMatrix);
    }
    this.routeCount = count;
    this.dots.instanceMatrix.needsUpdate = true;
  }
  /** Stop following a route (manual walking, Esc, or a teleport). */
  cancelWalk() {
    this.path = [];
    this.intent = null;
    this.destination.hidden = true;
    this.routeCount = 0;
  }
  get walkingSomewhere() {
    return this.path.length > 0;
  }
  interact() {
    let closest = null;
    let dist = 3.1;
    for (const [id, v] of Object.entries(VENUES)) {
      const d = Math.hypot(v.x - this.player.x, v.z - this.player.z);
      if (d < dist) {
        closest = id;
        dist = d;
      }
    }
    if (closest) this.callbacks.arrive?.({ venue: closest });
    else this.callbacks.notice?.('Walk closer to a venue, then interact.');
    return closest;
  }
  /** The venue you are standing at, if any (for button prompts). */
  nearbyVenue() {
    for (const [id, v] of Object.entries(VENUES)) if (Math.hypot(v.x - this.player.x, v.z - this.player.z) < 3.1) return id;
    return null;
  }
  teleport(x, z) {
    this.cancelWalk();
    this.player.x = x;
    this.player.z = z;
    this.game.s.avatar.x = x;
    this.game.s.avatar.z = z;
  }

  /** Stand tonight's client across from the player: toward the venue, or beside on free ground. */
  placeCompanion() {
    const d = this.game.s.activeDate;
    const b = this.game.s.bookings.find((x) => x.id === d.bookingId);
    const v = VENUES[b.venue];
    const p = this.player;
    let dx = v.x - p.x;
    let dz = v.z - p.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.3) {
      dx = 1;
      dz = 0;
    } else {
      dx /= l;
      dz /= l;
    }
    const tries = [[dx, dz], [-dz, dx], [dz, -dx], [-dx, -dz]];
    let pick = tries[0];
    for (const t of tries) {
      if (this.walkable(p.x + t[0] * 0.85, p.z + t[1] * 0.85)) {
        pick = t;
        break;
      }
    }
    const c = this.dateCompanion;
    c.x = p.x + pick[0] * 0.85;
    c.z = p.z + pick[1] * 0.85;
    c.rotation = Math.atan2(-pick[0], -pick[1]);
    this.faceTarget = Math.atan2(pick[0], pick[1]);
    return b.person;
  }

  /* ------------------------------------------------------------ per frame */

  update(dt, { move, blocked, client }) {
    this.time += dt;
    const s = this.game.s;
    const motion = !s.settings.reducedMotion;
    const p = this.player;
    let dx = 0;
    let dz = 0;
    if (!blocked && !s.activeDate) {
      const mag = Math.min(1, Math.hypot(move.x, move.y));
      if (mag > 0.05) {
        dx = -Math.sin(this.yaw) * move.y + Math.cos(this.yaw) * move.x;
        dz = -Math.cos(this.yaw) * move.y - Math.sin(this.yaw) * move.x;
        const l = Math.hypot(dx, dz) || 1;
        dx = (dx / l) * dt * 4 * mag;
        dz = (dz / l) * dt * 4 * mag;
        if (this.path.length || this.intent) this.cancelWalk();
      } else if (this.path.length) {
        const next = this.path[0];
        const x = next.x - p.x;
        const z = next.z - p.z;
        const dist = Math.hypot(x, z);
        if (dist < 0.16) {
          this.path.shift();
          this.updateRoute();
          if (!this.path.length) {
            const intent = this.intent;
            this.intent = null;
            this.destination.hidden = true;
            this.routeCount = 0;
            if (intent) setTimeout(() => this.callbacks.arrive?.(intent), 0);
          }
        } else {
          const step = Math.min(dist, dt * 4);
          dx = (x / dist) * step;
          dz = (z / dist) * step;
        }
      }
    }
    this.isWalking = !!(dx || dz);
    if (this.isWalking) {
      if (this.walkable(p.x + dx, p.z + dz)) {
        p.x += dx;
        p.z += dz;
      } else if (this.walkable(p.x + dx, p.z)) p.x += dx;
      else if (this.walkable(p.x, p.z + dz)) p.z += dz;
      this.faceTarget = Math.atan2(dx, dz);
    }
    // Turn to face where you walk instead of snapping.
    if (this.faceTarget !== undefined) {
      const turn = shortestAngle(this.faceTarget - p.rotation);
      p.rotation += motion ? turn * (1 - Math.exp(-dt * 16)) : turn;
    }
    s.avatar.x = p.x;
    s.avatar.z = p.z;
    p.y = this.isWalking && motion ? Math.abs(Math.sin(this.time * 12)) * 0.045 : 0;
    for (let i = 0; i < p.limbs.length; i++) p.limbs[i].y = 0.32 + (this.isWalking && motion ? Math.sin(this.time * 12 + i * Math.PI) * 0.09 : 0);
    const spin = motion ? this.time * 0.9 : 0;
    for (const m of p.markers) m.rotation.y = spin;
    if (motion) {
      for (const n of this.npcs) {
        n.g[n.axis] = n[n.axis] + Math.sin(this.time * 0.2 + n.phase) * n.span;
        n.g.rotation = n.axis === 'x' ? (Math.cos(this.time * 0.2 + n.phase) > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.cos(this.time * 0.2 + n.phase) > 0 ? 0 : Math.PI;
        n.g.y = Math.abs(Math.sin(this.time * 8 + n.phase)) * 0.025;
      }
      this.car.x = ((this.time * 1.3 + 4) % 35) - 19;
      this.car2.x = 15 - ((this.time * 1.05 + 20) % 34);
    }
    // Evening: the sun softens, lamps and lanterns glow, the barge band plays from 17:00.
    const late = clamp((s.minute - 1080) / 240, 0, 1);
    this.sun.intensity = (0.42 - late * 0.2) * Math.PI;
    this.glowLevel.value = 0.35 + late * 0.55;
    const evening = s.minute >= 1020;
    for (const m of this.musicians) {
      m.g.hidden = !evening;
      m.g.rotation = m.base + (motion ? Math.sin(this.time * 2.2 + m.phase) * 0.12 : 0);
      m.g.y = m.g.baseY + (motion ? Math.abs(Math.sin(this.time * 4.4 + m.phase)) * 0.02 : 0);
    }
    // Tonight's client joins you at the venue.
    const active = s.activeDate;
    this.dateCompanion.hidden = !active;
    if (active && this.companionFor !== active.bookingId) {
      this.companionFor = active.bookingId;
      const personId = this.placeCompanion();
      if (client) this.setCharacterColors(this.dateCompanion, client(personId));
    } else if (!active) this.companionFor = null;

    // Smooth camera turns and zoom.
    const k = motion ? 1 - Math.exp(-dt * 9) : 1;
    let moved = false;
    if (this.yaw !== this.yawTarget) {
      this.yaw += (this.yawTarget - this.yaw) * k;
      if (Math.abs(this.yawTarget - this.yaw) < 1e-3) this.yaw = this.yawTarget;
      moved = true;
    }
    if (this.zoom !== this.zoomTarget) {
      this.zoom += (this.zoomTarget - this.zoom) * k;
      if (Math.abs(this.zoomTarget - this.zoom) < 1e-3) this.zoom = this.zoomTarget;
      moved = true;
    }
    if (moved) this.updateCamera();
    this.sync();
  }

  /** Copy the moving parts into their three.js objects. */
  sync() {
    for (const g of this.dynamic) {
      const o = g.obj;
      o.visible = !g.hidden;
      o.position.set(g.x, g.y || 0, g.z);
      o.rotation.y = g.rotation || 0;
      o.scale.setScalar(g.scale || 1);
      for (const l of g.limbMeshes) l.mesh.position.y = l.shape.y;
    }
    this.destMesh.visible = !this.destination.hidden;
    this.destMesh.position.set(this.destination.x, 0.08, this.destination.z);
    this.dots.count = this.routeCount;
  }

  render() {
    this.kit.renderer.render(this.scene, this.camera);
  }
}
