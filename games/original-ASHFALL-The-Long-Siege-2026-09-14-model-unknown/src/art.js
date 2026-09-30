/* ASHFALL — hand-built low-poly art. All geometry is generated locally, flat shaded,
   one colour per face, with an emissive weight per vertex for the glowing parts.
   view.js turns these vertex streams into three.js meshes. */

import { rng, height, pointSeg, dist, gates, classes, HALF } from './sim.js';

const colorCache = new Map();
/** '#rrggbb' → [r, g, b] in 0..1 (raw values: the game draws with linear output, like the original). */
export function color(hex) {
  if (Array.isArray(hex)) return hex;
  let c = colorCache.get(hex);
  if (!c) {
    const h = hex.replace('#', '');
    c = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
    colorCache.set(hex, c);
  }
  return c;
}

/** A growing triangle soup: position, face normal, colour and emissive weight per vertex. */
export class Geometry {
  constructor(capacity = 1024) {
    this.n = 0;
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.nor = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.em = new Float32Array(capacity);
  }
  grow(k) {
    if (this.n + k <= this.cap) return;
    let c = this.cap;
    while (c < this.n + k) c *= 2;
    const re = (a, s) => {
      const b = new Float32Array(c * s);
      b.set(a);
      return b;
    };
    this.pos = re(this.pos, 3);
    this.nor = re(this.nor, 3);
    this.col = re(this.col, 3);
    this.em = re(this.em, 1);
    this.cap = c;
  }
  tri(a, b, c, col, em = 0) {
    this.grow(3);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const k = color(col);
    for (const p of [a, b, c]) {
      const i = this.n++;
      this.pos[i * 3] = p[0];
      this.pos[i * 3 + 1] = p[1];
      this.pos[i * 3 + 2] = p[2];
      this.nor[i * 3] = nx;
      this.nor[i * 3 + 1] = ny;
      this.nor[i * 3 + 2] = nz;
      this.col[i * 3] = k[0];
      this.col[i * 3 + 1] = k[1];
      this.col[i * 3 + 2] = k[2];
      this.em[i] = em;
    }
    return this;
  }
  quad(a, b, c, d, col, em = 0) {
    this.tri(a, b, c, col, em);
    this.tri(a, c, d, col, em);
    return this;
  }
  box(x, y, z, w, h, d, c, rot = 0, em = 0) {
    c = color(c);
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const p = (a, b, k) => [x + a * cs + k * sn, y + b, z - a * sn + k * cs];
    const a = -w / 2, b = w / 2, l = -d / 2, r = d / 2, t = h / 2, q = -t;
    this.quad(p(a, q, r), p(b, q, r), p(b, t, r), p(a, t, r), c, em);
    this.quad(p(b, q, l), p(a, q, l), p(a, t, l), p(b, t, l), c, em);
    this.quad(p(b, q, r), p(b, q, l), p(b, t, l), p(b, t, r), c, em);
    this.quad(p(a, q, l), p(a, q, r), p(a, t, r), p(a, t, l), c, em);
    this.quad(p(a, t, r), p(b, t, r), p(b, t, l), p(a, t, l), c, em);
    this.quad(p(a, q, l), p(b, q, l), p(b, q, r), p(a, q, r), c, em);
    return this;
  }
  cone(x, y, z, rb, rt, h, n, c, rot = 0, em = 0) {
    c = color(c);
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2, b = rot + ((i + 1) / n) * Math.PI * 2;
      const p = [x + Math.cos(a) * rb, y, z + Math.sin(a) * rb], q = [x + Math.cos(b) * rb, y, z + Math.sin(b) * rb];
      const r = [x + Math.cos(b) * rt, y + h, z + Math.sin(b) * rt], s = [x + Math.cos(a) * rt, y + h, z + Math.sin(a) * rt];
      this.quad(q, p, s, r, c, em);
      this.tri([x, y + h, z], r, s, c, em);
      this.tri([x, y, z], p, q, c, em);
    }
    return this;
  }
  oct(x, y, z, rx, ry, rz, c, rot = 0, em = 0) {
    c = color(c);
    const top = [x, y + ry, z], bot = [x, y - ry, z], p = [];
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      p.push([x + Math.cos(a) * rx, y, z + Math.sin(a) * rz]);
    }
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      this.tri(p[i], top, p[k], c, em);
      this.tri(p[k], bot, p[i], c, em);
    }
    return this;
  }
  /** A flat ribbon on the ground from a to b (faces up). */
  segment(a, b, width, c, em = 0) {
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const l = Math.hypot(dx, dz) || 1, sx = (-dz / l) * (width / 2), sz = (dx / l) * (width / 2);
    // cross(d, up) = (-dz, 0, dx) · the original's side vector; winding keeps the face up.
    this.quad([a[0] - sx, a[1], a[2] - sz], [a[0] + sx, a[1], a[2] + sz], [b[0] + sx, b[1], b[2] + sz], [b[0] - sx, b[1], b[2] - sz], color(c), em);
    return this;
  }
  /** A closed n-sided tube between two points (mortar barrels). */
  tube(a, b, r, n, c, em = 0) {
    c = color(c);
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz) || 1;
    dx /= L;
    dy /= L;
    dz /= L;
    // u = d × ref (ref = up, or x for a vertical tube), v = d × u, so (u, v, d) is
    // right-handed and the side faces point outward.
    const rx = Math.abs(dy) < 0.9 ? 0 : 1, ry = Math.abs(dy) < 0.9 ? 1 : 0;
    let ux = -dz * ry, uy = dz * rx, uz = dx * ry - dy * rx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    const ring = (o, i) => {
      const t = (i / n) * Math.PI * 2, cs = Math.cos(t) * r, sn = Math.sin(t) * r;
      return [o[0] + ux * cs + vx * sn, o[1] + uy * cs + vy * sn, o[2] + uz * cs + vz * sn];
    };
    for (let i = 0; i < n; i++) {
      const a0 = ring(a, i), a1 = ring(a, i + 1), b0 = ring(b, i), b1 = ring(b, i + 1);
      this.quad(a0, a1, b1, b0, c, em);
      this.tri(b, b0, b1, c, em);
      this.tri(a, a1, a0, c, em);
    }
    return this;
  }
}

/* ------------------------------------------------------------------ operation styles */

/**
 * Colours and light per operation. The Citadel keeps every original value; Emberfall
 * is the same art at dusk on ash fields, with glowing fissures and drifting embers.
 */
export const STYLES = {
  citadel: {
    ground: '#94937d', coolZ: -145, cool: 0.96, road: '#a9a08b', roadMark: '#c4b18b', edge: '#5a6865',
    fortFloor: '#626d68', fortRoad: '#7b8276', fortLine: '#aaa58a',
    rockWest: '#6d7773', rockSouth: '#837361', rock: '#636e67', rockCap: '#909184',
    trunk: '#575b4c', leavesNorth: '#425f57', leavesWest: '#53685c', leaves: '#68745e', deadTree: '#696357',
    ruin: '#828575', ruinCap: '#989b86', pebble: '#939584', grassA: '#717b64', grassB: '#818568',
    wreck: { x: -305, z: 300 }, industry: [[290, 188], [-312, 13], [121, -334]],
    tank: '#797767', tankCap: '#a19a7b', fissures: 0,
    light: {
      clear: [0.32, 0.4, 0.42], sky: [0.61, 0.67, 0.68], groundLight: [0.27, 0.29, 0.29], sun: [0.68, 0.59, 0.43],
      fog: [0.42, 0.49, 0.49], fogNear: 240, fogFar: 940, fogAmount: 0.55,
    },
    embers: 0,
  },
  emberfall: {
    ground: '#7a746b', coolZ: -145, cool: 0.97, road: '#908676', roadMark: '#b99a72', edge: '#4a5051',
    fortFloor: '#575d5b', fortRoad: '#6d6f68', fortLine: '#a08e70',
    rockWest: '#5b605e', rockSouth: '#6e5c4d', rock: '#555c5a', rockCap: '#7c7a70',
    trunk: '#4b4540', leavesNorth: '#4a5245', leavesWest: '#5a5241', leaves: '#5f5a45', deadTree: '#5c534a',
    ruin: '#78766b', ruinCap: '#8d897b', pebble: '#7f7b72', grassA: '#6b6b55', grassB: '#78705a',
    wreck: { x: 300, z: 338 }, industry: [[-160, -392], [334, 108], [-410, 130]],
    tank: '#6f6a5c', tankCap: '#9a8566', fissures: 16,
    light: {
      clear: [0.19, 0.18, 0.21], sky: [0.47, 0.45, 0.53], groundLight: [0.25, 0.2, 0.2], sun: [0.84, 0.54, 0.34],
      fog: [0.31, 0.26, 0.27], fogNear: 200, fogFar: 900, fogAmount: 0.6,
    },
    embers: 150,
  },
};

/* ------------------------------------------------------------------ the world */

/**
 * The static battlefield for one operation, split into the original five batches
 * (terrain, stone, detail, metal, glow) plus the reactor, which is its own group so
 * it can collapse when the mission is won.
 */
export function buildWorld(map, op, S) {
  const random = rng(op.id === 'citadel' ? 8841 : 8842);
  const terrain = new Geometry(1 << 16), stone = new Geometry(1 << 15), detail = new Geometry(1 << 16), metal = new Geometry(1 << 15), glow = new Geometry(1 << 12);
  const coreMetal = new Geometry(2048), coreGlow = new Geometry(512);
  const ground = (x, z) => height(x, z);
  const C = color;

  // Faceted terrain uses one colour per triangle and no texture images.
  const step = 10, edge = 500;
  const jitter = (a, b) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return (n - Math.floor(n) - 0.5) * 6;
  };
  const vertex = (x, z) => {
    if (Math.max(Math.abs(x), Math.abs(z)) > 140) {
      const xx = x + jitter(x, z), zz = z + jitter(z, x);
      return [xx, ground(xx, zz), zz];
    }
    return [x, ground(x, z), z];
  };
  const base = C(S.ground);
  for (let z = -edge; z < edge; z += step) {
    for (let x = -edge; x < edge; x += step) {
      const p = vertex(x, z), q = vertex(x + step, z), r = vertex(x + step, z + step), s = vertex(x, z + step);
      const patch = Math.sin(x * 0.012 + Math.cos(z * 0.008)) * Math.cos(z * 0.018) * 0.025 + Math.sin(x * 0.039 + z * 0.02) * 0.008 + (random() - 0.5) * 0.014;
      const cool = z < S.coolZ ? S.cool : 1;
      const c = [base[0] * cool + patch, base[1] + patch, base[2] + patch];
      terrain.tri(p, s, q, c);
      terrain.tri(q, s, r, c.map((v) => v * (0.986 + random() * 0.028)));
    }
  }
  // Raised edges keep the world finite and make its full scale clear.
  for (let i = 0; i < 88; i++) {
    const a = (i / 88) * Math.PI * 2, r = 515 + random() * 22, x = Math.cos(a) * r, z = Math.sin(a) * r;
    stone.cone(x, -28, z, 28 + random() * 15, 16, 45 + random() * 35, 5, S.edge, a);
  }
  for (const [a, b] of map.roads) {
    const len = dist(a, b), steps = Math.ceil(len / 9), dx = (b.x - a.x) / len, dz = (b.z - a.z) / len, px = -dz, pz = dx, w = 10.5;
    for (let j = 0; j < steps; j++) {
      const t = j / steps, u = (j + 1) / steps;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, xx = a.x + (b.x - a.x) * u, zz = a.z + (b.z - a.z) * u;
      const p = (x, z) => [x, ground(x, z) + 0.21, z];
      terrain.quad(p(x - px * w, z - pz * w), p(x + px * w, z + pz * w), p(xx + px * w, zz + pz * w), p(xx - px * w, zz - pz * w), C(S.road));
      if (j % 3 === 0 && Math.max(Math.abs(x), Math.abs(z)) > 120) {
        detail.box(x + px * 8, ground(x + px * 8, z + pz * 8) + 0.4, z + pz * 8, 0.7, 0.12, 3, S.roadMark, Math.atan2(dx, dz));
        detail.box(x - px * 8, ground(x - px * 8, z - pz * 8) + 0.4, z - pz * 8, 0.7, 0.12, 3, S.roadMark, Math.atan2(dx, dz));
      }
    }
  }
  // Fort floor and the four assault roads.
  stone.box(0, 1.95, 0, 247, 0.7, 247, S.fortFloor);
  for (const a of [0, Math.PI / 2]) {
    detail.box(0, 2.45, 0, 30, 0.2, 230, S.fortRoad, a);
    detail.box(0, 2.58, 0, 1, 0.05, 230, S.fortLine, a);
  }
  for (const o of map.props) {
    const y = ground(o.x, o.z), { x, z } = o;
    if (o.kind === 'rock') {
      const col = x < -120 ? S.rockWest : z > 150 ? S.rockSouth : S.rock;
      stone.cone(x, y - 2, z, o.r, o.r * 0.48, o.h, 5, col, o.rot);
      stone.cone(x + o.r * 0.6, y - 1, z + o.r * 0.45, o.r * 0.5, o.r * 0.25, o.h * 0.44, 5, S.rockCap, o.rot + 0.5);
    }
    if (o.kind === 'tree') {
      const h = o.h;
      detail.cone(x, y, z, 0.8, 0.45, h * 0.64, 4, S.trunk, o.rot);
      const col = z < -100 ? S.leavesNorth : x < -100 ? S.leavesWest : S.leaves;
      detail.cone(x, y + h * 0.27, z, o.r * 0.9, 0, h * 0.67, 5, col, o.rot);
      detail.cone(x, y + h * 0.54, z, o.r * 0.72, 0, h * 0.58, 5, col, o.rot + 0.5);
    }
    if (o.kind === 'deadTree') {
      detail.box(x, y + o.h * 0.38, z, 0.9, o.h * 0.76, 1, S.deadTree, o.rot);
      detail.box(x + 1.4, y + o.h * 0.57, z, 3.8, 0.65, 0.7, S.deadTree, o.rot + 0.3);
    }
    if (o.kind === 'wall') {
      metal.box(x, y + o.h / 2, z, o.w, o.h, o.d, '#35474b');
      metal.box(x, y + o.h * 0.7, z, o.w + 2, 4, o.d + 2, '#4c5c5b');
      metal.box(x, y + o.h + 0.8, z, o.w + 2, 1.6, o.d + 2, '#a3997a');
      const along = o.w > o.d;
      for (let t = -35; t <= 35; t += 17) {
        const xx = x + (along ? t : 0), zz = z + (along ? 0 : t);
        metal.box(xx, y + 10, zz, along ? 4 : 17, 20, along ? 17 : 4, '#56615b');
        metal.box(xx, y + o.h + 3, zz, along ? 9 : 12, 5, along ? 12 : 9, '#4a5654');
      }
      glow.box(x, y + o.h - 4, z, o.w + 0.12, 1, o.d + 0.12, '#e28450', 0, 0.85);
    }
    if (o.kind === 'tower') {
      metal.cone(x, y, z, 20, 15, 9, 4, '#465655', Math.PI / 4);
      metal.box(x, y + 20, z, 25, 32, 25, '#35464c');
      metal.box(x, y + 32, z, 29, 6, 29, '#7e8070');
      metal.box(x, y + 37, z, 21, 4, 21, '#3c5054');
      metal.cone(x, y + 39, z, 7, 5, 9, 8, '#526361');
      glow.cone(x, y + 48, z, 4, 0, 8, 4, '#f49254', Math.PI / 4, 1);
      glow.box(x, y + 21, z, 25.2, 2, 25.2, '#d87743', 0, 0.7);
    }
    if (o.kind === 'barrack') {
      metal.box(x, y + 6, z, o.w, 12, o.d, '#485956');
      metal.box(x, y + 13, z, o.w + 2, 3, o.d + 2, '#797e6c');
      for (let k = -1; k <= 1; k++) {
        metal.box(x + k * 7, y + 15, z, 4, 2, 22, '#313e42');
        glow.box(x + k * 7, y + 7, z + o.d / 2 + 0.1, 2, 3, 0.2, '#deaa65', 0, 0.5);
      }
    }
    if (o.kind === 'ruin') {
      stone.box(x, y + o.h / 2, z, o.w, o.h, o.d, S.ruin);
      stone.box(x + o.w * 0.2, y + o.h, z, o.w * 0.35, 2, o.d + 1, S.ruinCap);
    }
    if (o.kind === 'wreck') {
      metal.box(x, y + 2, z, o.w, o.h, o.d, '#726555', 0.3);
      metal.box(x + 2, y + 4, z - 1, o.w * 0.6, 3, o.d * 0.7, '#514f46', 0.25);
    }
  }
  // Open gates. Overhead lintels do not block units below them.
  for (const g of gates) {
    const north = Math.abs(g.z) > 0, x = north ? 0 : Math.sign(g.x) * 112, z = north ? Math.sign(g.z) * 112 : 0, rot = north ? 0 : Math.PI / 2;
    metal.box(x, 31, z, 45, 7, 16, '#394c4f', rot);
    glow.box(x, 27.3, z, 36, 0.65, 16.1, '#f0ad66', rot, 0.9);
    for (let k = -1; k <= 1; k += 2) {
      const xx = x + (north ? k * 24 : 0), zz = z + (north ? 0 : k * 24);
      metal.box(xx, 18, zz, 8, 32, 16, '#52615c', rot);
    }
  }
  // Core: an 80-metre reactor inside the fortress. The plinth stays; the rest can fall.
  metal.cone(0, 2.5, 0, 31, 31, 4, 12, '#3d5154');
  coreMetal.cone(0, 6.5, 0, 24, 19, 19, 8, '#56635d', Math.PI / 8);
  coreMetal.cone(0, 25.5, 0, 17, 13, 28, 8, '#283b44', Math.PI / 8);
  coreGlow.cone(0, 30, 0, 17.2, 17.2, 3, 8, '#e9854b', Math.PI / 8, 0.9);
  coreMetal.cone(0, 54, 0, 20, 11, 7, 8, '#8a8d75', Math.PI / 8);
  coreMetal.cone(0, 61, 0, 11, 5, 10, 8, '#31484e', Math.PI / 8);
  coreGlow.oct(0, 74, 0, 7, 12, 7, '#ff9c58', Math.PI / 4, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.sin(a) * 22, z = Math.cos(a) * 22;
    coreMetal.box(x, 23, z, 6, 39, 9, '#3a4e52', a);
    coreGlow.box(Math.sin(a) * 25.9, 29, Math.cos(a) * 25.9, 2, 25, 0.4, '#cf673d', a, 0.8);
  }
  // Outer relay stations and landing pods.
  for (let i = 0; i < 3; i++) {
    const r = op.relays[i], y = ground(r.x, r.z), x = r.x, z = r.z;
    stone.cone(x, y + 0.15, z, 28, 28, 0.5, 24, '#757d70');
    metal.box(x, y + 1.5, z, 18, 3, 18, '#344f53');
    metal.cone(x, y + 3, z, 6, 5, 11, 6, '#829488');
    metal.box(x, y + 19, z, 3, 23, 3, '#374e54');
    metal.box(x, y + 27, z, 18, 2.5, 2, '#667f77');
    metal.box(x, y + 26, z, 2, 7, 15, '#72867c');
    glow.oct(x, y + 33, z, 3, 5, 3, '#ffc278', 0, 0.9);
    for (const off of [-1, 1]) {
      metal.box(x + off * 16, y + 3, z + 9, 5, 6, 8, '#68776d');
      glow.box(x + off * 16, y + 6.2, z + 9, 3, 0.3, 6, '#edb969', 0, 0.6);
    }
    const s = op.starts[i], yy = ground(s.x, s.z);
    metal.cone(s.x - 14, yy, s.z + 14, 7, 4, 10, 6, '#344b51');
    metal.cone(s.x - 14, yy + 10, s.z + 14, 4, 1, 6, 6, '#8f9d8d');
    glow.cone(s.x - 14, yy + 2, s.z + 14, 7.1, 7.1, 0.5, 6, classes[i].color, 0, 1);
  }
  // A broken transport and small industrial groups make the outer ground useful to read.
  const wx = S.wreck.x, wz = S.wreck.z, wy = ground(wx, wz);
  metal.box(wx, wy + 6, wz, 18, 12, 52, '#596a65', -0.4);
  metal.box(wx - 11, wy + 3, wz + 5, 37, 4, 15, '#7f8977', -0.4);
  metal.cone(wx - 8, wy + 6, wz - 23, 9, 2, 13, 5, '#738174', 0.3);
  for (let i = 0; i < 4; i++) metal.box(wx - 15 + i * 8, wy + 9, wz + 21, 3, 8, 4, '#3f5050', -0.4);
  for (const [x, z] of S.industry) {
    const y = ground(x, z);
    for (let i = 0; i < 3; i++) {
      metal.cone(x + i * 12, y, z, 5, 5, 11, 8, S.tank);
      metal.cone(x + i * 12, y + 11, z, 5, 4, 1.5, 8, S.tankCap);
    }
    metal.box(x + 8, y + 2, z + 15, 37, 4, 7, '#56665c');
  }
  // Scattered grass and stones are merged into one static mesh.
  for (let i = 0; i < 1350; i++) {
    const x = (random() * 2 - 1) * 474, z = (random() * 2 - 1) * 474;
    if (Math.max(Math.abs(x), Math.abs(z)) < 138 || map.roads.some((r) => pointSeg(x, z, r[0], r[1]) < 12)) continue;
    const y = ground(x, z), s = 0.4 + random() * 1.5;
    if (i % 3 === 0) stone.oct(x, y + s * 0.25, z, s, s * 0.6, s * 0.8, S.pebble);
    else {
      detail.tri([x - s, y, z], [x, y + s * 2, z], [x + s, y, z], C(S.grassA));
      detail.tri([x, y, z - s], [x, y + s * 1.6, z], [x, y, z + s], C(S.grassB));
    }
  }
  // Emberfall: glowing fissures in the ash, each a short wandering crack with a dark rim.
  if (S.fissures) {
    const fr = rng(4471);
    const keep = [...op.relays, ...op.starts];
    let made = 0;
    for (let tries = 0; tries < 200 && made < S.fissures; tries++) {
      let x = (fr() * 2 - 1) * 440, z = (fr() * 2 - 1) * 440, a = fr() * Math.PI * 2;
      if (Math.max(Math.abs(x), Math.abs(z)) < 170 || map.roads.some((r) => pointSeg(x, z, r[0], r[1]) < 22) || keep.some((p) => Math.hypot(p.x - x, p.z - z) < 55) || map.hits(x, z, 6)) continue;
      const segs = 5 + Math.floor(fr() * 5);
      for (let k = 0; k < segs; k++) {
        const len = 7 + fr() * 8;
        a += (fr() - 0.5) * 1.1;
        const nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len;
        if (Math.abs(nx) > HALF - 20 || Math.abs(nz) > HALF - 20 || map.roads.some((r) => pointSeg(nx, nz, r[0], r[1]) < 16)) break;
        const w = 1.1 + fr() * 0.9;
        terrain.segment([x, ground(x, z) + 0.28, z], [nx, ground(nx, nz) + 0.28, nz], w * 3.2, '#3a3230');
        glow.segment([x, ground(x, z) + 0.38, z], [nx, ground(nx, nz) + 0.38, nz], w, k % 2 ? '#ff7a3a' : '#ff9a4c', 0.95);
        x = nx;
        z = nz;
      }
      made++;
    }
  }
  return { batches: { terrain, stone, detail, metal, glow }, core: { metal: coreMetal, glow: coreGlow } };
}

/* ------------------------------------------------------------------ units */

export function heroModel(id) {
  const g = new Geometry(1024), c = '#c4d0c9', dark = '#34474e', black = '#192b35', edge = '#eceddb';
  const wide = id === 0 ? 1.15 : id === 1 ? 0.82 : 1;
  g.box(-1.15, 1.15, 0, 1.55, 2.3, 1.8, dark);
  g.box(1.15, 1.15, 0, 1.55, 2.3, 1.8, dark);
  g.box(-1.15, 0.4, 0.5, 1.8, 0.8, 2.7, black);
  g.box(1.15, 0.4, 0.5, 1.8, 0.8, 2.7, black);
  g.box(0, 3, 0, 3.5, 1.2, 2.4, black);
  g.box(0, 4.8, 0, 4.1 * wide, 3.1, 2.8, c);
  g.box(0, 5.8, 1.45, 2.3, 0.6, 0.25, edge);
  g.box(0, 4.4, 1.5, 2.1, 1.4, 0.4, dark);
  for (const side of [-1, 1]) {
    g.box(side * 2.5 * wide, 5.5, 0, 2, 2.1, 2.7, c);
    g.box(side * 2.6 * wide, 3.9, 0.7, 1.1, 2.2, 1.3, dark);
    g.box(side * 2.6 * wide, 3.2, 1.25, 1.3, 1, 1.4, black);
  }
  g.box(0, 7, 0, 2.15, 1.9, 2.3, dark);
  g.box(0, 7.2, 1.22, 1.75, 0.45, 0.18, '#efffff', 0, 1);
  g.box(0, 8, 0, 2.4, 0.35, 2.5, c);
  g.box(0, 5, -1.9, 3, 3.4, 1.6, dark);
  if (id === 0) {
    g.box(2.7, 3.8, 2.8, 1.5, 1.5, 5.6, black);
    g.box(2.7, 4.6, 2.6, 1.6, 0.5, 2.5, c);
    g.box(-3.2, 3.3, 1.8, 1.4, 3.2, 2, c);
  }
  if (id === 1) {
    g.box(2, 4.1, 4, 1, 0.9, 8.5, black);
    g.box(2, 5, 2.6, 0.6, 0.7, 1.9, c);
    g.box(0, 4.8, -2.2, 2.3, 5, 0.3, '#5d7266');
  }
  if (id === 2) {
    g.box(2.4, 4, 2.7, 1.5, 1.5, 5, black);
    g.oct(2.4, 4, 5.4, 0.7, 0.7, 1, '#dbffdb', 0, 1);
    g.box(-1.5, 8.4, -1.6, 0.3, 3.3, 0.3, dark);
    g.oct(-1.5, 10.2, -1.6, 0.45, 0.45, 0.45, edge, 0, 1);
  }
  return g;
}

export function enemyModel(type) {
  const g = new Geometry(1024), dark = '#433d35', red = type === 'gunner' ? '#b8a185' : '#b87957', face = '#ffc091';
  if (type === 'turret') {
    g.cone(0, 0, 0, 5, 3, 3, 6, '#657069');
    g.box(0, 5, 0, 5, 5, 5, '#665e4e');
    g.box(0, 8, 0, 6, 2, 6, '#8d8064');
    g.box(0, 7, 5, 1.5, 1.5, 10, '#343e3c');
    g.box(0, 6.5, 3.2, 3, 1, 1, face, 0, 1);
    return g;
  }
  if (type === 'sapper') {
    // Hunched runner with a glowing charge on its back.
    g.box(-0.8, 1, 0, 1, 2, 1.4, dark);
    g.box(0.8, 1, 0, 1, 2, 1.4, dark);
    g.box(0, 2.9, 0.4, 2.4, 2.2, 2.1, '#8c5a45');
    g.box(0, 3.3, -1.3, 2.2, 2, 1.4, '#3c3530');
    g.box(0, 3.4, -2.1, 1.6, 1.5, 0.3, '#ff6d3a', 0, 0.95);
    g.oct(0, 4.7, -1.3, 0.35, 0.8, 0.35, '#ffb86b', 0, 1);
    g.box(-1.6, 2.7, 1.2, 0.8, 1.9, 1, dark);
    g.box(1.6, 2.7, 1.2, 0.8, 1.9, 1, dark);
    g.box(0, 4.4, 1, 1.5, 1.2, 1.5, '#554b40');
    g.box(0, 4.45, 1.8, 1.2, 0.4, 0.2, face, 0, 0.9);
    return g;
  }
  if (type === 'mortar') {
    // Artillery crew: a trooper body with a base plate and an angled barrel.
    g.box(-0.9, 1, 0, 1.2, 2, 1.7, dark);
    g.box(0.9, 1, 0, 1.2, 2, 1.7, dark);
    g.box(0, 3.1, 0, 3, 2.8, 2.4, '#8f8466');
    g.box(-2, 3.1, 0.7, 1, 2.4, 1.6, dark);
    g.box(2, 3.1, 0.7, 1, 2.4, 1.6, dark);
    g.box(0, 5.1, 0.1, 1.8, 1.5, 1.8, '#554b40');
    g.box(0, 5.25, 1.1, 1.5, 0.5, 0.2, face, 0, 0.8);
    g.box(0, 3.4, -1.8, 2.4, 2.2, 1.2, '#5b5344');
    g.box(2.9, 0.35, 1.7, 2.6, 0.5, 2.6, '#57574a');
    g.tube([2.9, 0.8, 1.2], [2.9, 6.6, 4.2], 0.6, 8, '#343e3c');
    g.tube([2.9, 6.3, 4.05], [2.9, 6.75, 4.3], 0.72, 8, '#2a3230');
    g.box(2.9, 2.2, 3.4, 0.3, 2.6, 0.3, '#433d35', 0.4);
    return g;
  }
  const big = type === 'brute' || type === 'boss';
  g.box(-0.9, 1, 0, 1.2, 2, 1.7, dark);
  g.box(0.9, 1, 0, 1.2, 2, 1.7, dark);
  g.box(0, 3.1, 0, big ? 4.2 : 2.7, 2.8, 2.4, red);
  g.box(-2, 3.1, 0.7, 1, 2.4, 1.6, dark);
  g.box(2, 3.1, 0.7, 1, 2.4, 1.6, dark);
  g.box(0, 5.1, 0.1, 1.8, 1.5, 1.8, '#554b40');
  g.box(0, 5.25, 1.1, 1.5, 0.5, 0.2, face, 0, 0.8);
  if (big) {
    g.box(-2.5, 4.3, 0, 2.2, 2.3, 3, '#706b54');
    g.box(2.5, 4.3, 0, 2.2, 2.3, 3, '#706b54');
    g.cone(0, 5.8, 0, 1.3, 0, 1.8, 4, red);
    g.box(2.6, 1.8, 1.9, 1.9, 2.1, 4.8, '#393d33');
  } else {
    g.box(1.8, 3, 2.2, 0.9, 0.9, type === 'gunner' ? 5 : 3.7, '#303c38');
  }
  return g;
}

/** Sparks and debris: one small glowing octahedron. */
export function particleModel() {
  return new Geometry(32).oct(0, 0, 0, 1, 1, 1, '#ffffff', 0, 0.7);
}
