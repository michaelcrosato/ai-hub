/* Company Hours — the little waterfront town, drawn with three.js r186 on the shared kit.
 *
 * The town is still a declarative list of primitive shapes (boxes, cylinders, icosahedra…)
 * in the original flat-shaded pastel style. Instead of one InstancedMesh per shape and colour
 * (each its own shader program in r186), every static shape is stamped into one merged,
 * vertex-coloured mesh, the things that glow at dusk into a second one, and the shop signs
 * into a third with one texture atlas. People are a merged body plus four limbs, all sharing
 * the town material, so the whole scene compiles a handful of pipelines.
 */

import * as THREE from 'three/webgpu';
import { createPost } from 'kit/post.js';
import { MOUSE_LOOK, TOUCH_LOOK } from 'kit/input.js';
import { VENUES, REGIONS, PEOPLE, Navigation, townObstacles, roofVertices } from './sim.js';

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _o = new THREE.Object3D();
const _ndc = new THREE.Vector2();

const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** Ease an angle toward a target along the shorter way round. */
const turnToward = (from, to, k) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
};

/** Unit primitives, non-indexed so they can be stamped into merged geometry. */
function makeTemplates() {
  const flat = (g) => (g.index ? g.toNonIndexed() : g);
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.BufferAttribute(roofVertices(), 3));
  // The sail was a double-sided triangle: both windings, so one front-side material draws it.
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.5, 0, 0, 0.5, 0, 1, -0.4, 0, 0, -0.5, 0, 1, -0.4, 0, 0, 0.5, 0], 3));
  return {
    box: flat(new THREE.BoxGeometry(1, 1, 1)),
    cylinder: flat(new THREE.CylinderGeometry(1, 1, 1, 12)),
    cone: flat(new THREE.ConeGeometry(1, 1, 12)),
    ico: flat(new THREE.IcosahedronGeometry(1, 0)),
    sphere: flat(new THREE.SphereGeometry(1, 10, 8)),
    torus: flat(new THREE.TorusGeometry(1, 0.12, 5, 12)),
    roof,
    sail,
  };
}

/** One BufferGeometry (position, normal, colour) holding every shape in the list. */
function mergeShapes(templates, shapes) {
  let count = 0;
  for (const o of shapes) count += templates[o.type].attributes.position.count;
  const P = new Float32Array(count * 3);
  const C = new Float32Array(count * 3);
  let n = 0;
  for (const o of shapes) {
    const src = templates[o.type].attributes.position;
    _p.set(o.x, o.y, o.z);
    _q.setFromAxisAngle(UP, o.ry || 0);
    _s.set(o.sx, o.sy, o.sz);
    _m.compose(_p, _q, _s);
    _c.set(o.color); // sRGB hex → linear working colour, as a material colour would be
    for (let i = 0; i < src.count; i++, n++) {
      _v.fromBufferAttribute(src, i).applyMatrix4(_m);
      P[n * 3] = _v.x;
      P[n * 3 + 1] = _v.y;
      P[n * 3 + 2] = _v.z;
      C[n * 3] = _c.r;
      C[n * 3 + 1] = _c.g;
      C[n * 3 + 2] = _c.b;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.computeVertexNormals(); // non-indexed: one flat normal per triangle
  g.computeBoundingSphere();
  return g;
}

/** Click and tap targets for buildings (the pier kiosk opens the pier). */
const PICKS = [
  ...Object.entries(VENUES)
    .filter(([, v]) => v.w)
    .map(([id, v]) => ({ id, x: v.x, z: v.z, w: v.w, d: v.d })),
  { id: 'pier', x: 38.8, z: -6.3, w: 3, d: 2 },
];

export class Town {
  /**
   * @param {object} o
   * @param {object} o.kit      from boot()
   * @param {object} o.state    the game state (position, settings, bookings…)
   * @param {HTMLElement} o.labels  the container of the venue label buttons
   */
  constructor({ kit, state, labels }) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.canvas = kit.canvas;
    this.labels = labels;
    this.labelEls = labels ? [...labels.querySelectorAll('[data-world-venue]')] : [];
    this.state = state;
    this.shapes = [];
    this.glowShapes = [];
    this.signs = [];
    this.angle = Math.PI / 4;
    this.viewAngle = this.angle;
    this.zoom = 1;
    this.viewZoom = 1;
    this.pan = [0, 0];
    this.route = [];
    this.routeConsumed = 0;
    this.routeShown = 0;
    this.destination = null;
    this.time = 0;
    this.width = 1;
    this.height = 1;
    this.baseScale = 1;
    this.facing = 0;
    this.viewFacing = 0;
    this.press = null;
    this.labelsDirty = true;
    this.labelsOn = null;
    this.nav = new Navigation(townObstacles());
    this.playerPos = [...state.position];
    this.templates = makeTemplates();
    this.armGeometries = new Map();
    this.buildTown();
    this.initThree();
    kit.onResize(() => this.resize());
  }

  /* ------------------------------------------------------------------ shapes */

  add(type, x, y, z, sx, sy, sz, color, ry = 0) {
    this.shapes.push({ type, x, y, z, sx, sy, sz, color, ry });
  }
  /** A shape that lights up at dusk (lamp globes, lanterns, shop windows). */
  glow(type, x, y, z, sx, sy, sz, color, ry = 0) {
    this.glowShapes.push({ type, x, y, z, sx, sy, sz, color, ry });
  }
  box(x, y, z, sx, sy, sz, color, ry = 0) {
    this.add('box', x, y, z, sx, sy, sz, color, ry);
  }
  tree(x, z, scale = 1, flower = false) {
    this.add('cylinder', x, 0.7 * scale, z, 0.22 * scale, 1.4 * scale, 0.22 * scale, '#9f805e');
    this.add('ico', x, 2.25 * scale, z, 1.25 * scale, 1.4 * scale, 1.25 * scale, flower ? '#e3b4ad' : '#88ac78');
    this.add('ico', x - 0.55 * scale, 1.85 * scale, z + 0.18 * scale, 0.75 * scale, 1 * scale, 0.8 * scale, flower ? '#efc4b7' : '#a6c68a');
    this.add('cylinder', x, 0.06, z, 0.95 * scale, 0.1, 0.95 * scale, '#ccd1a0');
  }
  pot(x, z, color = '#e6af8f') {
    this.add('cylinder', x, 0.28, z, 0.31, 0.55, 0.31, color);
    this.add('ico', x, 0.72, z, 0.45, 0.55, 0.45, '#749d73');
    this.add('ico', x + 0.12, 0.92, z, 0.17, 0.16, 0.17, '#efd385');
  }
  bench(x, z, ry = 0) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const B = (lx, y, lz, sx, sy, sz, col) => this.box(x + lx * c + lz * s, y, z - lx * s + lz * c, sx, sy, sz, col, ry);
    B(0, 0.54, 0, 1.85, 0.17, 0.6, '#cba273');
    B(0, 0.98, -0.3, 1.85, 0.5, 0.12, '#d5ae7e');
    B(-0.65, 0.25, 0, 0.12, 0.5, 0.5, '#6c8376');
    B(0.65, 0.25, 0, 0.12, 0.5, 0.5, '#6c8376');
  }
  lamp(x, z) {
    this.add('cylinder', x, 1.7, z, 0.065, 3.4, 0.065, '#66837b');
    this.glow('sphere', x, 3.45, z, 0.26, 0.33, 0.26, '#f5eac9');
    this.add('cone', x, 3.76, z, 0.42, 0.28, 0.42, '#68847d');
    this.add('cylinder', x, 0.15, z, 0.21, 0.28, 0.21, '#68847d');
  }
  lantern(x, z, h = 1.9) {
    this.add('cylinder', x, h / 2, z, 0.05, h, 0.05, '#5f7d75');
    this.glow('sphere', x, h + 0.13, z, 0.15, 0.2, 0.15, '#f7e3b0');
    this.add('cone', x, h + 0.36, z, 0.21, 0.16, 0.21, '#5f7d75');
  }
  table(x, z) {
    this.add('cylinder', x, 0.65, z, 0.055, 1.3, 0.055, '#68847d');
    this.add('cylinder', x, 1.22, z, 0.86, 0.12, 0.86, '#f5e4b7');
    this.add('cylinder', x, 1.35, z, 0.1, 0.18, 0.1, '#ede7dd');
    for (const dx of [-1.15, 1.15]) {
      this.box(x + dx, 0.53, z, 0.52, 0.12, 0.52, '#789a88');
      this.box(x + dx, 0.26, z, 0.12, 0.5, 0.15, '#638573');
      this.box(x + dx, 0.88, z - 0.22, 0.5, 0.5, 0.12, '#789a88');
    }
  }

  buildTown() {
    this.shapes = [];
    this.glowShapes = [];
    this.signs = [];
    const region = REGIONS[this.state.region];
    this.box(0, -1.1, 0, 55, 1.65, 55, '#decaa4');
    this.box(0, -0.24, 0, 55, 0.22, 55, '#b7cba0');
    this.box(0, -0.05, 4.8, 55, 0.16, 4.4, '#d2d4c3');
    this.box(0, 0.055, 4.8, 55, 0.04, 2.65, '#e8dfc8');
    this.box(0, -0.03, 0, 6, 0.16, 54, '#d7d5bf');
    this.box(0, 0.065, 0, 3.7, 0.04, 54, '#eee3c9');
    this.box(0, 0.09, -9.1, 48, 0.06, 3.2, '#eae0c9');
    this.box(0, 0.09, 19.2, 48, 0.06, 3.1, '#eae0c9');
    this.add('cylinder', 0, 0.08, 0, 6.9, 0.13, 6.9, '#e6d9ba');
    this.add('cylinder', 0, 0.155, 0, 5.9, 0.025, 5.9, '#efe3c8');
    // A two-tier fountain anchors the pedestrian plaza.
    this.add('cylinder', 0, 0.33, 0, 2.1, 0.48, 2.1, '#bfccbe');
    this.add('cylinder', 0, 0.6, 0, 1.82, 0.08, 1.82, '#83c5bf');
    this.add('cylinder', 0, 1.02, 0, 0.35, 1, 0.35, '#ede2c4');
    this.add('cylinder', 0, 1.55, 0, 1.05, 0.15, 1.05, '#d7dec8');
    this.add('cylinder', 0, 1.65, 0, 0.89, 0.06, 0.89, '#9dd9d1');
    this.add('sphere', 0, 1.95, 0, 0.22, 0.22, 0.22, '#ede5cd');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.box(Math.sin(a) * 4.25, 0.18, Math.cos(a) * 4.25, 0.2, 0.05, 0.42, '#c7cbb1', a);
    }
    for (const [id, v] of Object.entries(VENUES)) {
      if (!v.w) continue;
      const x = v.x;
      const z = v.z;
      const w = v.w;
      const d = v.d;
      const col = id === 'home' ? region.color : v.color;
      this.box(x, 0.12, z + 0.4, w + 1.1, 0.25, d + 1.5, '#eae0c8');
      this.box(x, 1.55, z, w, 2.9, d, col);
      this.box(x, 0.48, z, w + 0.12, 0.34, d + 0.12, '#f0e4ce');
      this.box(x, 3.04, z, w + 0.42, 0.22, d + 0.4, '#eee4cc');
      this.add('roof', x, 3.78, z, w + 0.9, 1.6, d + 0.85, id === 'home' ? '#b8836a' : id === 'studio' ? '#6e9282' : id === 'gallery' ? '#999bb1' : '#b69474');
      if (id === 'gallery') {
        this.box(x, 3.56, z + 1, 3, 0.7, 1.9, '#c0c5c0');
        this.box(x, 3.97, z + 1, 3.2, 0.14, 2.1, '#ecede1');
      }
      // Front windows, a real doorway, awning stripes, and trim.
      for (const dx of [-w * 0.31, w * 0.31]) {
        this.box(x + dx, 1.65, z + d / 2 + 0.035, 1.72, 1.54, 0.08, '#f6ecd7');
        this.glow('box', x + dx, 1.65, z + d / 2 + 0.1, 1.43, 1.28, 0.03, '#789d9e');
        this.box(x + dx, 1.65, z + d / 2 + 0.135, 0.06, 1.3, 0.035, '#f4e4c9');
        this.box(x + dx, 1.65, z + d / 2 + 0.14, 1.5, 0.06, 0.04, '#f4e4c9');
        this.box(x + dx, 0.94, z + d / 2 + 0.32, 1.94, 0.18, 0.43, '#e3c6a3');
        for (let j = -1; j <= 1; j++) this.add('ico', x + dx + j * 0.47, 1.16, z + d / 2 + 0.34, 0.3, 0.3, 0.28, j === 0 ? '#e6ae88' : '#87a97a');
      }
      this.box(x, 1.23, z + d / 2 + 0.055, 1.35, 2.25, 0.08, '#f4e7cf');
      this.box(x, 1.2, z + d / 2 + 0.12, 1.08, 2.09, 0.08, id === 'home' ? '#789383' : '#698d91');
      this.add('sphere', x + 0.33, 1.16, z + d / 2 + 0.2, 0.06, 0.06, 0.06, '#e6cc8d');
      for (const dx of [-w / 2 - 0.035, w / 2 + 0.035])
        for (const dz of [-1.65, 1.4]) {
          this.box(x + dx, 1.7, z + dz, 0.06, 1.45, 1.36, '#efe3ce');
          this.glow('box', x + dx + Math.sign(dx) * 0.035, 1.7, z + dz, 0.03, 1.17, 1.09, '#8db0ad');
          this.box(x + dx + Math.sign(dx) * 0.06, 1.7, z + dz, 0.035, 1.18, 0.06, '#efe3ce');
        }
      if (['cafe', 'bistro', 'studio'].includes(id)) {
        for (let a = 0; a < 12; a++) this.box(x - w / 2 + 0.33 + (a * w) / 12, 2.77, z + d / 2 + 0.48, w / 12, 0.12, 1.13, a % 2 ? '#f5e4c9' : id === 'studio' ? '#7ca08c' : '#d69480');
        this.box(x, 2.57, z + d / 2 + 1, w, 0.32, 0.08, id === 'studio' ? '#83a390' : '#db9b84');
      }
      this.box(x, 2.75, z + d / 2 + 0.075, 2.8, 0.48, 0.14, '#f5ebd7');
      this.signs.push({ text: v.short.toUpperCase(), x, y: 2.76, z: z + d / 2 + 0.17, ry: 0, w: 2.65, h: 0.43 });
      this.pot(x - w / 2 - 0.15, z + d / 2 + 0.35);
      this.pot(x + w / 2 + 0.15, z + d / 2 + 0.35);
      this.box(x, 4, z - 1.5, 0.7, 1.65, 0.75, '#c3a68a');
      this.box(x, 4.85, z - 1.5, 0.9, 0.15, 0.9, '#e1cab0');
    }
    // Garden beds and outdoor seating are deliberately readable from an elevated view.
    for (const x of [-5.3, 5.3]) {
      this.box(x, 0.14, 12.5, 2, 0.2, 7, '#87ad7e');
      for (let j = 0; j < 7; j++) {
        this.add('ico', x - 0.35, 0.36, 9.7 + j * 0.85, 0.31, 0.34, 0.31, '#e7bd8f');
        this.add('ico', x + 0.35, 0.32, 9.9 + j * 0.85, 0.25, 0.3, 0.25, '#eddfac');
      }
    }
    this.bench(-2.8, 12.8, Math.PI / 2);
    this.bench(2.8, 12.8, -Math.PI / 2);
    this.add('cylinder', 0, 0.19, 13, 1.2, 0.22, 1.2, '#d4c8ab');
    this.add('cylinder', 0, 0.35, 13, 0.88, 0.2, 0.88, '#88ad77');
    this.tree(0, 13, 1.02, true);
    for (const [x, z] of [[-21, 7], [-11, 7], [-23, 18], [-23, -10], [-24, -24], [-8, -23], [7, -24], [24, -24], [24, -10], [24, 8], [24, 23], [7, 23], [-6, 23], [-24, 24], [7, -2]])
      this.tree(x, z, 0.9 + Math.abs(x % 3) * 0.1, (x + z) % 3 === 0);
    for (const [x, z, a] of [[-6.5, -3, Math.PI / 2], [6.5, 1, -Math.PI / 2], [-6.5, 18, Math.PI / 2], [-2, -8, 0], [7, 18, 0]]) this.bench(x, z, a);
    for (const [x, z] of [[-8, 3], [8, 3], [-22, 3], [22, 3], [-8, -10], [8, -10], [-8, 18], [8, 18]]) this.lamp(x, z);
    this.table(-20, 2);
    this.table(-12, 2);
    this.table(12, 2);
    this.table(20, 2);
    // Waterfront boardwalk, railings (with a gap where the pier begins), ripples and a sailboat.
    this.box(27.9, -0.03, 0, 2.2, 0.3, 54, '#c4af87');
    for (let z = -25; z < 27; z += 1.1) this.box(27.9, 0.14, z, 2.2, 0.04, 0.06, '#a79575');
    const gap = [-5.75, -2.25];
    for (let z = -25; z < 27; z += 3) {
      if (z < gap[0] || z > gap[1]) this.box(28.8, 0.57, z, 0.1, 1, 0.1, '#76998f');
      const a = z - 0.1;
      const b = z + 2.9;
      const pieces = b <= gap[0] || a >= gap[1] ? [[a, b]] : [[a, gap[0]], [gap[1], b]].filter(([p, q]) => q - p > 0.05);
      for (const [p, q] of pieces) this.box(28.8, 0.98, (p + q) / 2, 0.07, 0.07, q - p, '#76998f');
    }
    for (let i = 0; i < 22; i++) {
      const rx = 31 + (i % 4) * 2.8;
      const rz = -25 + Math.floor(i / 4) * 9;
      if (rz > -8.5 && rz < 0.5 && rx < 42.5) continue; // under the pier platform
      this.box(rx, -0.17, rz, 0.7 + (i % 3), 0.035, 0.08, '#c4e5df');
    }
    this.add('cone', 33, 0.05, 10, 1.3, 0.5, 3, '#f2dec0', 0);
    this.add('cylinder', 33, 2, 10, 0.045, 4, 0.045, '#ad9275');
    this.add('sail', 33.08, 2.1, 10, 2.1, 2.8, 0.1, '#fff1d5');
    // Cafe chalkboard and bicycle are small, human-scale environmental details.
    this.box(-18, 0.65, 2.2, 0.75, 1.2, 0.12, '#5d7b68', -0.2);
    this.box(-18, 0.66, 2.12, 0.6, 0.95, 0.03, '#345e52', -0.2);
    for (const x of [-21.8, -20.5]) this.add('torus', x, 0.52, 14.9, 0.4, 0.4, 0.08, '#516e69');
    this.box(-21.15, 0.76, 14.9, 1, 0.08, 0.08, '#d7a365');
    this.box(-21.15, 1.05, 14.9, 0.1, 0.6, 0.08, '#d7a365', 0.5);
    this.buildPier();
  }

  /** Lantern Pier: a plank pier off the boardwalk, an end platform and the Tidewater kiosk. */
  buildPier() {
    const deck = '#c4af87';
    const plank = '#a79575';
    const rail = '#76998f';
    const pile = '#8d7b5c';
    // The arch over the entrance, with the name on both faces.
    for (const z of [-5.75, -2.25]) this.add('cylinder', 28.8, 1.45, z, 0.09, 2.9, 0.09, '#68847d');
    this.box(28.8, 2.86, -4, 0.16, 0.16, 3.8, '#68847d');
    this.box(28.8, 2.5, -4, 0.1, 0.42, 2.5, '#f5ebd7');
    this.signs.push({ text: 'LANTERN PIER', x: 28.86, y: 2.5, z: -4, ry: Math.PI / 2, w: 2.3, h: 0.36 });
    this.signs.push({ text: 'LANTERN PIER', x: 28.74, y: 2.5, z: -4, ry: -Math.PI / 2, w: 2.3, h: 0.36 });
    // The deck from the boardwalk to the platform, then the platform.
    this.box(32.5, -0.03, -4, 7.2, 0.3, 3.2, deck);
    for (let x = 29.4; x < 36; x += 1.1) this.box(x, 0.14, -4, 0.06, 0.04, 3.2, plank);
    this.box(38.8, -0.03, -4, 5.6, 0.3, 7.2, deck);
    for (let x = 36.5; x < 41.5; x += 1.1) this.box(x, 0.14, -4, 0.06, 0.04, 7.2, plank);
    for (let x = 29.6; x < 36; x += 2.2) for (const z of [-5.55, -2.45]) this.add('cylinder', x, -0.45, z, 0.13, 0.75, 0.13, pile);
    for (const [x, z] of [[36.2, -7.55], [38.8, -7.55], [41.5, -7.55], [41.5, -4], [41.5, -0.45], [38.8, -0.45], [36.2, -0.45]]) this.add('cylinder', x, -0.45, z, 0.15, 0.75, 0.15, pile);
    // Railings along the pier and round the platform, open where the two meet.
    for (const z of [-5.45, -2.55]) {
      for (let x = 29.6; x <= 35.7; x += 1.5) this.box(x, 0.55, z, 0.1, 0.9, 0.1, rail);
      this.box(32.75, 0.98, z, 6.5, 0.07, 0.07, rail);
    }
    for (let z = -7.4; z <= -0.5; z += 1.72) this.box(41.45, 0.55, z, 0.1, 0.9, 0.1, rail);
    this.box(41.45, 0.98, -4, 0.07, 0.07, 6.9, rail);
    for (const z of [-7.45, -0.55]) {
      for (let x = 36.1; x <= 41.4; x += 1.75) this.box(x, 0.55, z, 0.1, 0.9, 0.1, rail);
      this.box(38.75, 0.98, z, 5.4, 0.07, 0.07, rail);
    }
    for (const [z0, z1] of [[-7.45, -5.55], [-2.45, -0.55]]) {
      this.box(36.05, 0.98, (z0 + z1) / 2, 0.07, 0.07, z1 - z0, rail);
      for (const z of [z0, z1]) this.box(36.05, 0.55, z, 0.1, 0.9, 0.1, rail);
    }
    // Lanterns along the way; they glow as the evening comes in.
    for (const [x, z] of [[29.25, -5.75], [29.25, -2.25], [32.75, -5.45], [32.75, -2.55], [36.3, -0.75], [41.25, -0.75], [41.25, -7.25]]) this.lantern(x, z);
    // The Tidewater kiosk: a small tea hut facing the platform.
    const kx = 38.8;
    const kz = -6.3;
    const kw = 3;
    const kd = 2;
    const front = kz + kd / 2;
    this.box(kx, 0.28, kz, kw + 0.3, 0.28, kd + 0.3, '#eae0c8');
    this.box(kx, 1.35, kz, kw, 2.1, kd, VENUES.pier.color);
    this.box(kx, 0.52, kz, kw + 0.1, 0.3, kd + 0.1, '#f0e4ce');
    this.box(kx, 2.48, kz, kw + 0.3, 0.16, kd + 0.3, '#eee4cc');
    this.add('roof', kx, 2.98, kz, kw + 0.6, 0.95, kd + 0.55, '#6f97a3');
    this.add('cylinder', kx - 0.9, 3.3, kz - 0.35, 0.09, 0.8, 0.09, '#68847d');
    this.box(kx, 1.45, front + 0.03, 1.9, 0.9, 0.06, '#f6ecd7');
    this.glow('box', kx, 1.45, front + 0.07, 1.65, 0.72, 0.03, '#e9d6a6');
    this.box(kx, 1.0, front + 0.22, 2.1, 0.1, 0.42, '#cba273');
    this.add('cylinder', kx - 0.5, 1.12, front + 0.25, 0.07, 0.14, 0.07, '#ede7dd');
    this.add('cylinder', kx + 0.45, 1.12, front + 0.2, 0.07, 0.14, 0.07, '#e6ae88');
    for (let a = 0; a < 8; a++) this.box(kx - kw / 2 + 0.19 + (a * kw) / 8, 1.98, front + 0.44, kw / 8, 0.1, 0.9, a % 2 ? '#f5e4c9' : '#6f97a3');
    this.box(kx, 2.22, front + 0.05, 2.2, 0.3, 0.08, '#f5ebd7');
    this.signs.push({ text: 'TIDEWATER TEA', x: kx, y: 2.22, z: front + 0.1, ry: 0, w: 2.0, h: 0.26 });
    this.box(kx + kw / 2 + 0.03, 1.5, kz, 0.06, 0.8, 1, '#efe3ce');
    this.glow('box', kx + kw / 2 + 0.06, 1.5, kz, 0.03, 0.62, 0.8, '#8db0ad');
    this.pot(kx - kw / 2 - 0.35, front + 0.2, '#9fc3c9');
    // A café table, a bench facing the sea, a coin telescope and a moored rowboat.
    this.table(39.2, -1.4);
    this.bench(40.75, -3.6, Math.PI / 2);
    this.add('cylinder', 41.0, 0.62, -5.0, 0.06, 1.1, 0.06, '#68847d');
    this.box(41.0, 1.24, -5.0, 0.17, 0.17, 0.55, '#d7a365', 0.5);
    this.pot(36.9, -1.0);
    this.add('cone', 34.4, -0.08, -0.9, 0.55, 0.32, 1.6, '#d9b98f');
    this.box(34.4, 0.0, -0.9, 0.7, 0.05, 0.18, '#a07c58');
    this.box(34.4, 0.0, -0.4, 0.6, 0.05, 0.16, '#a07c58');
  }

  /* ------------------------------------------------------------------ three.js */

  initThree() {
    const T = THREE;
    const r = this.renderer;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFShadowMap;
    this.scene = new T.Scene();
    this.skyDay = new T.Color('#b3d6d0');
    this.skyDusk = new T.Color('#bdc4d5');
    this.scene.background = this.skyDay.clone();
    this.scene.fog = new T.Fog('#b3d6d0', 95, 160);
    this.camera = new T.OrthographicCamera(-40, 40, 30, -30, 0.1, 220);
    this.camera.position.set(50, 55, 50);
    this.camera.lookAt(0, 0, 0);
    this.hemi = new T.HemisphereLight('#fff8e7', '#91a68b', 2.6);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight('#fff0ce', 3.2);
    this.sun.position.set(-20, 45, 20);
    this.sun.castShadow = true;
    this.kit.shadow(this.sun, 2048);
    Object.assign(this.sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 130 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.001;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3; // PCF softness in place of the old PCFSoftShadowMap
    this.scene.add(this.sun);
    // One material for the whole town and every person: flat-shaded, colours per vertex.
    this.material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    this.glowMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, emissive: new T.Color('#ffcf7a'), emissiveIntensity: 0 });
    this.staticGroup = new T.Group();
    this.scene.add(this.staticGroup);
    this.makeMeshes();
    const seaGeo = new T.PlaneGeometry(220, 220);
    _c.set('#a8d1cb');
    const seaCol = new Float32Array(seaGeo.attributes.position.count * 3);
    for (let i = 0; i < seaCol.length; i += 3) seaCol.set([_c.r, _c.g, _c.b], i);
    seaGeo.setAttribute('color', new T.BufferAttribute(seaCol, 3));
    const sea = new T.Mesh(seaGeo, this.material);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.28;
    sea.receiveShadow = true;
    this.scene.add(sea);
    this.avatar = this.makeAvatar(this.state.player);
    this.scene.add(this.avatar);
    // Passers-by walk up and down the streets. (The two that walked through the shops on the
    // east side now use the open street at x = 9.)
    this.npcs = [];
    for (let i = 0; i < 8; i++) {
      const p = PEOPLE[i + 2];
      const mesh = this.makeAvatar({ ...p, hair: i % 2 ? '#685342' : '#3e3934' });
      mesh.scale.setScalar(0.92);
      this.scene.add(mesh);
      const axis = i % 2;
      this.npcs.push({ mesh, phase: i * 1.83, axis, offset: i < 4 ? -9 : axis ? 9 : 19, speed: 0.28 + i * 0.02, heading: 0 });
    }
    this.routeGroup = new T.Group();
    this.scene.add(this.routeGroup);
    // Route dots: one long-lived instanced batch, refilled when the route changes.
    this.routeMax = 200;
    this.routeMesh = this.kit.instanced(new T.CylinderGeometry(0.12, 0.12, 0.035, 7), new T.MeshBasicMaterial({ color: '#5e8b73' }), this.routeMax);
    this.routeMesh.count = 0;
    this.routeMesh.visible = false;
    this.routeMesh.frustumCulled = false;
    this.routeGroup.add(this.routeMesh);
    const ringGeo = new T.RingGeometry(0.54, 0.67, 28);
    this.selection = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: '#f6e8b2', side: T.DoubleSide, transparent: true, opacity: 0.85 }));
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.y = 0.18;
    this.scene.add(this.selection);
    // A soft ring where the current walk ends.
    this.goalRing = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: '#5e8b73', side: T.DoubleSide, transparent: true, opacity: 0.7 }));
    this.goalRing.rotation.x = -Math.PI / 2;
    this.goalRing.position.y = 0.2;
    this.goalRing.visible = false;
    this.scene.add(this.goalRing);
    this.raycaster = new T.Raycaster();
    this.ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
    this.hit = new T.Vector3();
    this.tempVec = new T.Vector3();
    this.projected = [0, 0];
    this.clientAvatar = null;
    this.post = createPost(this.kit, this.scene, this.camera);
  }

  /** (Re)build the merged town, glow and sign meshes from the shape lists. */
  makeMeshes() {
    const T = THREE;
    for (const c of [...this.staticGroup.children]) {
      this.staticGroup.remove(c);
      c.geometry.dispose();
    }
    this.townMesh = new T.Mesh(mergeShapes(this.templates, this.shapes), this.material);
    this.townMesh.castShadow = true;
    this.townMesh.receiveShadow = true;
    this.staticGroup.add(this.townMesh);
    const glow = new T.Mesh(mergeShapes(this.templates, this.glowShapes), this.glowMaterial);
    glow.castShadow = true;
    glow.receiveShadow = true;
    this.staticGroup.add(glow);
    this.staticGroup.add(this.makeSigns());
    for (const c of this.staticGroup.children) {
      c.matrixAutoUpdate = false;
      c.updateMatrix();
    }
  }

  /** Every shop sign in one mesh, drawn from one canvas atlas. */
  makeSigns() {
    const T = THREE;
    const rowH = 64;
    const W = 512;
    if (!this.signCanvas) {
      this.signCanvas = document.createElement('canvas');
      this.signCanvas.width = W;
      this.signCanvas.height = rowH * 16;
      this.signTexture = new T.CanvasTexture(this.signCanvas);
      this.signTexture.colorSpace = T.SRGBColorSpace;
      this.signTexture.anisotropy = 4;
      this.signMaterial = new T.MeshBasicMaterial({ map: this.signTexture });
    }
    const ctx = this.signCanvas.getContext('2d');
    ctx.fillStyle = '#f5ebd7';
    ctx.fillRect(0, 0, W, this.signCanvas.height);
    ctx.fillStyle = '#415d50';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rows = this.signs.slice(0, 16);
    const P = [];
    const U = [];
    const I = [];
    rows.forEach((sign, i) => {
      ctx.font = '600 27px sans-serif';
      const room = (W - 24) * Math.min(1, (sign.w / sign.h) * rowH / W);
      const width = ctx.measureText(sign.text).width;
      if (width > room) ctx.font = `600 ${Math.floor((27 * room) / width)}px sans-serif`;
      ctx.fillText(sign.text, W / 2, i * rowH + rowH / 2 + 2);
      // The plane's texture window keeps the text's aspect: crop the row to the sign's shape.
      const aspect = sign.w / sign.h;
      const uw = Math.min(1, (aspect * rowH) / W);
      const u0 = 0.5 - uw / 2;
      const u1 = 0.5 + uw / 2;
      const v0 = 1 - (i + 1) / 16;
      const v1 = 1 - i / 16;
      const c = Math.cos(sign.ry);
      const s = Math.sin(sign.ry);
      const base = P.length / 3;
      for (const [lx, ly, u, v] of [[-sign.w / 2, -sign.h / 2, u0, v0], [sign.w / 2, -sign.h / 2, u1, v0], [sign.w / 2, sign.h / 2, u1, v1], [-sign.w / 2, sign.h / 2, u0, v1]]) {
        P.push(sign.x + lx * c, sign.y + ly, sign.z - lx * s);
        U.push(u, v);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    this.signTexture.needsUpdate = true;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return new T.Mesh(g, this.signMaterial);
  }

  /** A person: one merged body plus swinging arms and legs, all on the town material. */
  makeAvatar(p) {
    const T = THREE;
    const g = new T.Group();
    const parts = [];
    const part = (type, x, y, z, sx, sy, sz, color) => parts.push({ type, x, y, z, sx, sy, sz, color, ry: 0 });
    part('cylinder', 0, 1.02, 0, 0.26, 0.61, 0.2, p.shirt);
    part('sphere', 0, 1.54, 0, 0.245, 0.28, 0.23, p.skin);
    part('sphere', 0, 1.72, -0.025, 0.258, 0.18, 0.245, p.hair || '#554238');
    part('box', 0, 0.72, 0, 0.43, 0.13, 0.29, '#4d645d');
    if (p.style === 'polished') {
      part('box', 0, 1.09, 0.195, 0.12, 0.42, 0.045, '#f3e9d6');
      part('box', 0, 1.06, 0.226, 0.04, 0.3, 0.018, '#465e56');
    }
    if (p.style === 'creative') {
      part('box', 0, 1.27, 0.13, 0.46, 0.09, 0.22, '#e4bc78');
      part('box', 0.15, 1.06, 0.205, 0.11, 0.38, 0.055, '#e4bc78');
    }
    part('sphere', -0.085, 1.58, 0.216, 0.025, 0.032, 0.012, '#3b4038');
    part('sphere', 0.085, 1.58, 0.216, 0.025, 0.032, 0.012, '#3b4038');
    const body = new T.Mesh(mergeShapes(this.templates, parts), this.material);
    body.castShadow = true;
    g.add(body);
    const limb = (geo, x, y) => {
      const m = new T.Mesh(geo, this.material);
      m.position.set(x, y, 0);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const arm = this.limbGeometry(p.shirt, 0.078, 0.54, 0.08);
    const leg = this.limbGeometry('#526960', 0.089, 0.64, 0.1);
    g.userData.body = body;
    g.userData.arms = [limb(arm, -0.33, 1.03), limb(arm, 0.33, 1.03)];
    g.userData.legs = [limb(leg, -0.13, 0.39), limb(leg, 0.13, 0.39)];
    return g;
  }
  limbGeometry(color, sx, sy, sz) {
    const key = `${color}|${sx}|${sy}|${sz}`;
    if (!this.armGeometries.has(key)) this.armGeometries.set(key, mergeShapes(this.templates, [{ type: 'cylinder', x: 0, y: 0, z: 0, sx, sy, sz, color, ry: 0 }]));
    return this.armGeometries.get(key);
  }
  dropAvatar(g) {
    if (!g) return;
    this.scene.remove(g);
    g.userData.body?.geometry.dispose(); // limbs share cached geometry
  }

  /** Pre-build the pipelines (town, glow, signs, people, markers) before the first frame. */
  async compile() {
    const count = this.routeMesh.count;
    this.routeMesh.count = Math.max(1, count);
    this.routeMesh.visible = true;
    this.goalRing.visible = true;
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } finally {
      this.routeMesh.count = count;
      this.routeMesh.visible = count > 0;
      this.goalRing.visible = this.route.length > 0;
    }
  }

  /* ------------------------------------------------------------------ state */

  setState(s, rebuild = false) {
    this.state = s;
    this.playerPos = [...s.position];
    this.route = [];
    this.destination = null;
    this.press = null;
    this.updateRoute();
    if (this.clientAvatar) {
      this.dropAvatar(this.clientAvatar);
      this.clientAvatar = null;
    }
    if (rebuild) {
      this.buildTown();
      this.makeMeshes();
      this.dropAvatar(this.avatar);
      this.avatar = this.makeAvatar(s.player);
      this.scene.add(this.avatar);
    }
    this.labelsDirty = true;
  }

  /* ------------------------------------------------------------------ camera */

  resize() {
    this.width = Math.max(1, this.kit.size.width);
    this.height = Math.max(1, this.kit.size.height);
    this.baseScale = Math.min(this.width / 77, this.height / 54);
    if (this.width < 720) this.baseScale = Math.min(this.width / 53, this.height / 62);
    this.baseScale *= this.width > 1100 ? 1.06 : 1;
    this.clampPan();
    this.updateCamera();
  }
  /** Pan limits grow with the zoom so every corner of the town (and the pier) can be reached. */
  clampPan() {
    const scale = this.baseScale * this.zoom;
    const mx = Math.max(this.width * 0.4, scale * 30);
    const my = Math.max(this.height * 0.4, scale * 22);
    this.pan[0] = Math.max(-mx, Math.min(mx, this.pan[0]));
    this.pan[1] = Math.max(-my, Math.min(my, this.pan[1]));
  }
  updateCamera() {
    if (!this.camera) return;
    const scale = this.baseScale * this.viewZoom;
    const h = this.height / scale;
    const w = this.width / scale;
    Object.assign(this.camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 });
    this.camera.updateProjectionMatrix();
    const vertical = 52 / Math.hypot(52, 62);
    const ox = this.width * (this.width > 1100 ? 0.48 : 0.5);
    const oy = this.height * (this.width < 720 ? 0.51 : 0.5);
    const horizontal = (this.width / 2 - ox - this.pan[0]) / scale;
    const depth = (this.height / 2 - oy - this.pan[1]) / (scale * vertical);
    const co = Math.cos(this.viewAngle);
    const si = Math.sin(this.viewAngle);
    const tx = horizontal * co + depth * si;
    const tz = -horizontal * si + depth * co;
    this.camera.position.set(tx + si * 62, 52, tz + co * 62);
    this.camera.lookAt(tx, 0, tz);
    this.camera.updateMatrixWorld();
    this.labelsDirty = true;
  }
  /** World point → canvas pixels. Returns a shared array: read it before the next call. */
  project(x, y, z) {
    const v = this.tempVec.set(x, y, z).project(this.camera);
    this.projected[0] = ((v.x + 1) * this.width) / 2;
    this.projected[1] = ((-v.y + 1) * this.height) / 2;
    return this.projected;
  }
  /** Screen point → the first thing under it: a venue building, or a point on the ground. */
  pick(sx, sy) {
    _ndc.set((sx / this.width) * 2 - 1, 1 - (sy / this.height) * 2);
    this.raycaster.setFromCamera(_ndc, this.camera);
    // Roofs and walls first, so a tap on a roof opens that building, not the street behind it.
    const hits = this.raycaster.intersectObject(this.townMesh, false);
    if (hits.length) {
      const p = hits[0].point;
      if (p.y > 0.3) {
        const venue = PICKS.find((v) => Math.abs(p.x - v.x) < v.w / 2 + 0.75 && Math.abs(p.z - v.z) < v.d / 2 + 0.9);
        if (venue) return { venue: venue.id };
      }
    }
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.hit);
    if (!hit) return null;
    const venue = PICKS.find((v) => Math.abs(hit.x - v.x) < v.w / 2 && Math.abs(hit.z - v.z) < v.d / 2);
    return venue ? { venue: venue.id } : { ground: [hit.x, hit.z] };
  }
  setZoom(z) {
    const [px, py] = this.pan;
    this.zoom = Math.max(0.65, Math.min(2.4, z));
    this.clampPan();
    if (px !== this.pan[0] || py !== this.pan[1]) this.updateCamera();
  }
  rotate(d) {
    this.angle += d;
  }
  center() {
    this.pan = [0, 0];
    this.zoom = 1;
    this.updateCamera(); // the pan snaps back; the zoom eases
  }
  panBy(dx, dy) {
    this.pan[0] += dx;
    this.pan[1] += dy;
    this.clampPan();
    this.updateCamera();
  }

  /* ------------------------------------------------------------------ walking */

  goTo(id, action = null) {
    const v = VENUES[id];
    if (!v) return false;
    const near = Math.hypot(this.playerPos[0] - v.door[0], this.playerPos[1] - v.door[1]) < 3;
    const route = near ? [] : this.nav.path(this.playerPos, v.door);
    this.route = route;
    this.routeConsumed = 0;
    this.destination = { venue: id, action };
    if (!route.length && !near) {
      this.destination = null;
      this.onError?.('No walkable route was found. Try another destination or move onto a path.');
      return false;
    }
    if (!route.length) {
      const d = this.destination;
      this.destination = null;
      this.onArrival?.(d);
    }
    this.updateRoute();
    return true;
  }
  walkTo(pt) {
    this.route = this.nav.path(this.playerPos, pt);
    this.routeConsumed = 0;
    this.destination = null;
    this.updateRoute();
    return this.route.length > 0;
  }
  stop() {
    if (!this.route.length && !this.destination) return false;
    this.route = [];
    this.destination = null;
    this.updateRoute();
    return true;
  }
  /** Show the route as dots on every other cell (counted from the start, so they hold still). */
  updateRoute() {
    if (!this.routeMesh) return;
    this.routeShown = this.route.length;
    let n = 0;
    for (let i = this.routeConsumed % 2; i < this.route.length && n < this.routeMax; i += 2, n++) {
      _o.position.set(this.route[i][0], 0.24, this.route[i][1]);
      _o.rotation.set(0, 0, 0);
      _o.scale.set(1, 1, 1);
      _o.updateMatrix();
      this.routeMesh.setMatrixAt(n, _o.matrix);
    }
    this.routeMesh.count = n;
    this.routeMesh.visible = n > 0;
    this.routeMesh.instanceMatrix.needsUpdate = true;
    const end = this.route.at(-1);
    this.goalRing.visible = !!end;
    if (end) this.goalRing.position.set(end[0], 0.2, end[1]);
  }
  /** The venue whose door the player is standing at, if any. */
  nearbyVenue() {
    let best = null;
    let bestD = 3;
    for (const [id, v] of Object.entries(VENUES)) {
      const d = Math.hypot(this.playerPos[0] - v.door[0], this.playerPos[1] - v.door[1]);
      if (d <= bestD) {
        best = id;
        bestD = d;
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ per frame */

  /**
   * Mouse and touch over the 3D view, through kit.input: a tap walks or opens a building,
   * a drag pans, wheel and pinch zoom. Returns a tap as { x, y } in canvas pixels, or null.
   */
  pointerFrame(input) {
    const p = input.pointer;
    let tap = null;
    if (p.justDown) this.press = { dist: 0, moved: false };
    const zoom = (input.wheel || 0) * 0.1 + (input.pinch || 0) * 0.25;
    if (zoom) {
      this.setZoom(this.zoom * Math.exp(zoom));
      if (input.pinch && this.press) this.press.moved = true;
    }
    const drag = input.look('drag');
    if (this.press && (drag.x || drag.y)) {
      // The look action reports radians; turn them back into pixels for a 1:1 pan.
      const s = this.kit.settings.get();
      const sens = s.lookSensitivity || 1;
      const k = (p.type === 'touch' ? TOUCH_LOOK : MOUSE_LOOK) * sens;
      const dx = drag.x / k;
      const dy = (drag.y / k) * (s.invertY ? -1 : 1);
      this.press.dist += Math.hypot(dx, dy);
      if (this.press.dist > 8) this.press.moved = true;
      if (this.press.moved) this.panBy(dx, dy);
    }
    if (p.justUp && this.press) {
      if (!this.press.moved) tap = { x: p.x, y: p.y };
      this.press = null;
    }
    return tap;
  }

  /**
   * @param {number} dt seconds
   * @param {object} o
   * @param {boolean} o.playing  the clock runs (no menu, date or pause)
   * @param {number} o.speed     1 or 3
   * @param {{x:number,y:number}} o.move   stick / keys, y forward
   * @param {{x:number,y:number}} o.cam    right stick: x turns, y zooms
   * @returns {boolean} whether the player moved
   */
  animate(dt, { playing, speed, move, cam }) {
    this.time += dt;
    const s = this.state;
    const reduce = s.settings.reduceMotion;
    let moving = false;
    if (cam && (cam.x || cam.y)) {
      this.angle -= cam.x * 1.8 * dt;
      if (cam.y) this.setZoom(this.zoom * Math.exp(cam.y * 1.3 * dt));
    }
    if (playing && !s.activeDate) {
      const mag = Math.min(1, Math.hypot(move.x, move.y));
      const dist = dt * 3.9 * Math.min(speed, 2);
      if (mag > 0.05) {
        if (this.route.length || this.destination) this.stop();
        const dx = move.x / mag;
        const dz = -move.y / mag;
        const a = this.angle;
        const x = dx * Math.cos(a) + dz * Math.sin(a);
        const z = -dx * Math.sin(a) + dz * Math.cos(a);
        const step = dist * mag;
        const px = this.playerPos[0];
        const pz = this.playerPos[1];
        // Slide along walls instead of stopping dead against them.
        const pos = this.playerPos;
        if (this.nav.walkable(px + x * step, pz + z * step)) {
          pos[0] = px + x * step;
          pos[1] = pz + z * step;
        } else if (Math.abs(x) > 0.2 && this.nav.walkable(px + Math.sign(x) * step, pz)) pos[0] = px + Math.sign(x) * step;
        else if (Math.abs(z) > 0.2 && this.nav.walkable(px, pz + Math.sign(z) * step)) pos[1] = pz + Math.sign(z) * step;
        if (pos[0] !== px || pos[1] !== pz) {
          moving = true;
          this.facing = Math.atan2(x, z);
        }
      } else if (this.route.length) {
        let remain = dist;
        while (remain > 0 && this.route.length) {
          const t = this.route[0];
          const x = t[0] - this.playerPos[0];
          const z = t[1] - this.playerPos[1];
          const l = Math.hypot(x, z);
          if (l <= remain) {
            this.playerPos[0] = t[0];
            this.playerPos[1] = t[1];
            remain -= l;
            this.route.shift();
            this.routeConsumed++;
          } else {
            this.playerPos[0] += (x / l) * remain;
            this.playerPos[1] += (z / l) * remain;
            remain = 0;
          }
          moving = true;
          if (l > 1e-4) this.facing = Math.atan2(x, z);
        }
        if (this.route.length !== this.routeShown) this.updateRoute();
        if (!this.route.length) {
          this.updateRoute();
          if (this.destination) {
            const d = this.destination;
            this.destination = null;
            s.position[0] = this.playerPos[0];
            s.position[1] = this.playerPos[1];
            this.onArrival?.(d);
          }
        }
      }
      s.position[0] = this.playerPos[0];
      s.position[1] = this.playerPos[1];
    }
    // Ease the camera toward its turn and zoom targets (instant with reduced motion).
    const k = reduce ? 1 : 1 - Math.exp(-dt * 9);
    if (Math.abs(this.viewAngle - this.angle) > 1e-4 || Math.abs(this.viewZoom - this.zoom) > 1e-4) {
      this.viewAngle += (this.angle - this.viewAngle) * k;
      this.viewZoom += (this.zoom - this.viewZoom) * k;
      if (Math.abs(this.viewAngle - this.angle) < 1e-4) this.viewAngle = this.angle;
      if (Math.abs(this.viewZoom - this.zoom) < 1e-4) this.viewZoom = this.zoom;
      this.updateCamera();
    }
    if (moving && !this.press) this.follow(dt, reduce);
    this.drawThree(dt, moving, reduce);
    if (this.labelsDirty || this.labelsOn !== s.settings.showLabels) this.updateLabels();
    return moving;
  }

  /** Bring the player into the comfortable middle of the view (a career starts or loads). */
  revealPlayer() {
    this.follow(1, true);
  }
  /** Keep a walking player in view: nudge the pan when they near the edges of the screen. */
  follow(dt, reduce) {
    const [x, y] = this.project(this.playerPos[0], 1, this.playerPos[1]);
    const left = this.width * 0.14;
    const right = this.width * 0.86;
    const top = this.height * 0.24;
    const bottom = this.height * 0.72;
    let ex = 0;
    let ey = 0;
    if (x < left) ex = x - left;
    else if (x > right) ex = x - right;
    if (y < top) ey = y - top;
    else if (y > bottom) ey = y - bottom;
    if (!ex && !ey) return;
    const k = reduce ? 1 : Math.min(1, dt * 5);
    this.panBy(-ex * k, -ey * k);
  }

  drawThree(dt, moving, reduce) {
    const s = this.state;
    this.avatar.position.set(this.playerPos[0], 0.16, this.playerPos[1]);
    this.viewFacing = reduce ? this.facing : turnToward(this.viewFacing, this.facing, 1 - Math.exp(-dt * 14));
    this.avatar.rotation.y = this.viewFacing;
    const walk = moving && !reduce ? Math.sin(this.time * 12) * 0.45 : 0;
    const u = this.avatar.userData;
    u.legs[0].rotation.x = walk;
    u.legs[1].rotation.x = -walk;
    u.arms[0].rotation.x = -walk;
    u.arms[1].rotation.x = walk;
    this.selection.position.set(this.playerPos[0], 0.18, this.playerPos[1]);
    if (this.goalRing.visible) this.goalRing.scale.setScalar(reduce ? 1 : 1 + Math.sin(this.time * 4) * 0.12);
    for (const npc of this.npcs) {
      const t = reduce ? npc.phase : this.time * npc.speed + npc.phase;
      const x = Math.sin(t) * 21;
      const z = npc.offset;
      const nx = npc.axis ? z : x;
      const nz = npc.axis ? x : z;
      if (this.nav.walkable(nx, nz)) {
        npc.mesh.position.set(nx, 0.18, nz);
        const target = npc.axis ? (Math.cos(t) > 0 ? 0 : Math.PI) : Math.cos(t) > 0 ? Math.PI / 2 : -Math.PI / 2;
        npc.heading = reduce ? target : turnToward(npc.heading, target, 1 - Math.exp(-dt * 6));
        npc.mesh.rotation.y = npc.heading;
        npc.mesh.visible = true;
      } else npc.mesh.visible = false;
      const w = reduce ? 0 : Math.sin(this.time * 6 + npc.phase) * 0.35;
      npc.mesh.userData.legs[0].rotation.x = w;
      npc.mesh.userData.legs[1].rotation.x = -w;
    }
    if (s.activeDate) {
      const b = s.bookings.find((x) => x.id === s.activeDate.booking);
      const p = b && PEOPLE.find((x) => x.id === b.person);
      if (p && !this.clientAvatar) {
        this.clientAvatar = this.makeAvatar(p);
        this.scene.add(this.clientAvatar);
      }
      if (this.clientAvatar) {
        this.clientAvatar.position.set(this.playerPos[0] + 1.2, 0.16, this.playerPos[1]);
        this.clientAvatar.rotation.y = -Math.PI / 2;
        this.avatar.rotation.y = Math.PI / 2;
        this.viewFacing = this.facing = Math.PI / 2;
      }
    } else if (this.clientAvatar) {
      this.dropAvatar(this.clientAvatar);
      this.clientAvatar = null;
    }
    const dusk = clamp01((s.time - 1050) / 240);
    this.sun.intensity = 3.2 - dusk * 1.5;
    this.scene.background.copy(this.skyDay).lerp(this.skyDusk, dusk);
    // Lamps, lanterns and shop windows light up as the evening comes in.
    this.glowMaterial.emissiveIntensity = clamp01((s.time - 1020) / 200) * 0.9;
    this.post.render();
  }

  /** Venue labels follow the camera; they only move when the view changes. */
  updateLabels() {
    this.labelsDirty = false;
    this.labelsOn = this.state.settings.showLabels;
    for (const el of this.labelEls) {
      const v = VENUES[el.dataset.worldVenue];
      if (!v) continue;
      const p = this.project(v.x, v.w ? 4.95 : 2.9, v.z);
      el.style.transform = `translate(${p[0]}px,${p[1]}px) translate(-50%,-100%)`;
      el.hidden = !this.labelsOn || p[0] < 25 || p[0] > this.width - 25 || p[1] < 95 || p[1] > this.height - 120;
    }
  }

  getMetrics() {
    const info = this.renderer.info;
    return {
      renderer: `three.js r${THREE.REVISION} · ${this.kit.backendLabel} · ${this.kit.tier.name} quality`,
      drawCalls: info?.render?.calls ?? null,
      triangles: info?.render?.triangles ?? null,
      pixelRatio: this.renderer.getPixelRatio(),
      fps: window.__kit?.fps || 0,
      routeLength: this.route.length,
    };
  }
}
