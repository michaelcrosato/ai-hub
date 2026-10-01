// build.js — Little Lot's block builder.
//
// Every wall, prop and person in the game is made of flat-coloured boxes,
// planes and cylinders. These helpers collect those faces (in the original
// game's own coordinates and winding), and toGeometry() turns a face list into
// three.js geometry: flat normals and an RGBA colour per vertex. The colour is
// the game's sRGB palette value; the material (game.js) lights it with the
// original fixed light and converts it for output, so the look stays the same.

import * as THREE from 'three/webgpu';

export const C = {
  cream: '#efe6cd', white: '#fff6dc', wall: '#eddcbc', trim: '#ffefd3', teal: '#5b948b', darkTeal: '#35756f',
  coral: '#ce825e', mustard: '#e6ae58', oak: '#c79765', oakLight: '#d6ae7e', navy: '#557980', grass: '#a7bd80',
  leaf: '#6c985c', pink: '#d5a39c', soil: '#998166',
};
export const ROOM_Y = 0.23;
export const randSeed = (n) => {
  const a = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return a - Math.floor(a);
};

/* ------------------------------------------------------------ face collector */

let cur = null;

/** Start collecting faces. Pass a list to keep adding to it (merged static world). */
export function begin(x = 0, z = 0, y = 0, a = 0, list = []) {
  cur = { list, x, y, z, c: Math.cos(a), s: Math.sin(a) };
  return list;
}
export function finish() {
  const list = cur.list;
  cur = null;
  return list;
}
function tr(p) {
  return [cur.x + p[0] * cur.c - p[2] * cur.s, cur.y + p[1], cur.z + p[0] * cur.s + p[2] * cur.c];
}
export function face(points, col, alpha = 1) {
  cur.list.push({ v: points.map(tr), col, alpha });
}

const BOX_FACES = [[3, 2, 6, 7], [1, 0, 4, 5], [2, 1, 5, 6], [0, 3, 7, 4], [7, 6, 5, 4]];
export function box(x, y, z, w, h, d, col) {
  const v = [
    [x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2], [x + w / 2, y, z + d / 2], [x - w / 2, y, z + d / 2],
    [x - w / 2, y + h, z - d / 2], [x + w / 2, y + h, z - d / 2], [x + w / 2, y + h, z + d / 2], [x - w / 2, y + h, z + d / 2],
  ];
  for (const f of BOX_FACES) face(f.map((i) => v[i]), col);
}
export function plane(x, y, z, w, d, col, alpha = 1) {
  face([[x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], [x + w / 2, y, z - d / 2], [x - w / 2, y, z - d / 2]], col, alpha);
}
export function cylinder(x, y, z, r, h, col, sides = 10, r2 = r) {
  const bot = [];
  const top = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    bot.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
    top.push([x + Math.cos(a) * r2, y + h, z + Math.sin(a) * r2]);
  }
  for (let i = 0; i < sides; i++) face([bot[(i + 1) % sides], bot[i], top[i], top[(i + 1) % sides]], col);
  face(top.slice().reverse(), col);
}
export function stud(x, y, z, r = 0.1, col = C.cream) {
  cylinder(x, y, z, r, 0.055, col, 10);
}
/**
 * A soft oval contact shadow. The original painted these with the object and a
 * default height that floated them 24 cm up; with a real depth buffer they sit
 * just above the floor and rugs instead (y is relative to the object's base).
 */
export function shadow(x, z, w, d, alpha = 0.1, y = 0.035) {
  const p = [];
  for (let i = 0; i < 18; i++) {
    const a = (-i / 18) * Math.PI * 2;
    p.push([x + (Math.cos(a) * w) / 2, y, z + (Math.sin(a) * d) / 2]);
  }
  face(p, '#29432c', alpha);
}
export function leafCluster(x, y, z, size, col) {
  box(x, y, z, size, size * 0.64, size * 0.9, col);
  box(x - size * 0.18, y + size * 0.55, z - size * 0.05, size * 0.6, size * 0.28, size * 0.55, col);
}
export function pottedPlant(x, y, z, size = 1, pot = C.coral) {
  cylinder(x, y, z, 0.22 * size, 0.33 * size, pot, 8, 0.3 * size);
  cylinder(x, y + 0.33 * size, z, 0.25 * size, 0.025 * size, C.soil, 8);
  box(x, y + 0.35 * size, z, 0.065 * size, 0.65 * size, 0.065 * size, '#688351');
  leafCluster(x - 0.14 * size, y + 0.59 * size, z, 0.46 * size, '#6a9a65');
  leafCluster(x + 0.17 * size, y + 0.88 * size, z + 0.04 * size, 0.43 * size, '#8eb06d');
  leafCluster(x - 0.02 * size, y + 1.1 * size, z, 0.4 * size, '#96b77a');
}
export function flower(x, y, z, col, sz = 0.12) {
  box(x, y, z, 0.035, 0.24, 0.035, '#63844b');
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    box(x + Math.cos(a) * sz * 0.7, y + 0.22, z + Math.sin(a) * sz * 0.7, sz, 0.075, sz, col);
  }
  stud(x, y + 0.29, z, sz * 0.36, '#e8c16d');
}

/* ------------------------------------------------------------ geometry */

const colorCache = new Map();
function rgb(hex) {
  let c = colorCache.get(hex);
  if (c) return c;
  let a = hex.replace('#', '');
  if (a.length === 3) a = a.split('').map((x) => x + x).join('');
  const v = parseInt(a.slice(0, 6), 16);
  c = [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  colorCache.set(hex, c);
  return c;
}

/**
 * A BufferGeometry for the faces of one kind: 'solid' (alpha 1) or 'soft'
 * (see-through shadows, grout lines). Flat normals, sRGB colour + alpha per
 * vertex. Returns null when there is nothing of that kind.
 */
export function toGeometry(list, kind = 'solid') {
  const pos = [];
  const nor = [];
  const col = [];
  for (const f of list) {
    if (kind === 'solid' ? f.alpha < 1 : f.alpha >= 1) continue;
    const v = f.v;
    const a = v[0];
    const b = v[1];
    const c = v[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue; // a cone tip or a zero-sized face: nothing to draw
    nx /= len;
    ny /= len;
    nz /= len;
    const [r, g, bl] = rgb(f.col);
    for (let i = 1; i < v.length - 1; i++) {
      for (const p of [v[0], v[i], v[i + 1]]) {
        pos.push(p[0], p[1], p[2]);
        nor.push(nx, ny, nz);
        col.push(r, g, bl, f.alpha);
      }
    }
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.computeBoundingSphere();
  return geo;
}

/* ------------------------------------------------------------ the lot */

function wallBack(x, w, base, h, col = C.wall, z = -4.64) {
  box(x, base, z, w, h, 0.18, col);
  if (base < 0.3) box(x, base, z + 0.102, w, 0.12, 0.045, C.white);
}
function backWindow(x, w) {
  wallBack(x, w, 0.23, 0.68);
  wallBack(x, w, 2.03, 0.44);
  box(x, 0.91, -4.61, w, 1.12, 0.05, '#a4c7b7');
  box(x, 0.9, -4.51, w + 0.12, 0.075, 0.17, C.trim);
  box(x, 2.0, -4.51, w + 0.12, 0.08, 0.17, C.trim);
  box(x - w / 2, 0.92, -4.51, 0.075, 1.13, 0.14, C.trim);
  box(x + w / 2, 0.92, -4.51, 0.075, 1.13, 0.14, C.trim);
  box(x, 0.93, -4.51, 0.06, 1.07, 0.15, C.trim);
  box(x, 1.46, -4.5, w, 0.055, 0.16, C.trim);
  box(x, 0.865, -4.4, w + 0.25, 0.1, 0.33, C.cream);
  box(x + 0.12, 1.54, -4.47, w * 0.38, 0.36, 0.015, '#b9d8c3');
}

/** The ground, lane, house shell, floors and rugs, in world coordinates. */
function buildBase(floor) {
  shadow(0.5, 1.4, 27, 20, 0.075, -0.72);
  box(0, -0.65, 1, 20, 0.55, 18, '#b2be93');
  box(0, -0.11, 1, 20, 0.12, 18, '#a6ba83');
  for (let x = -9.5; x < 10; x++) {
    for (let z = -7.5; z < 10; z++) {
      // Tiles fully under the house foundation are never seen.
      if (Math.abs(x) < 5.2 && Math.abs(z) < 4.2) continue;
      const r = randSeed(x * 20 + z * 13);
      plane(x, 0.019, z, 0.994, 0.994, r > 0.7 ? '#afc48d' : r > 0.2 ? '#adc188' : '#a8bd82');
      if (r > 0.88) {
        box(x + 0.23, 0.024, z - 0.17, 0.055, 0.055, 0.075, '#93ac70');
        box(x + 0.1, 0.024, z + 0.08, 0.04, 0.07, 0.04, '#92a86e');
      }
    }
  }
  // A pale lane and a path lead to the front door.
  box(0, -0.09, 10.15, 24, 0.12, 1.1, '#d4cbbb');
  box(0, -0.12, 12.0, 27, 0.1, 2.65, '#a7b3a6');
  box(0, -0.07, 10.84, 25, 0.14, 0.17, '#e9dfcc');
  for (let x = -12; x <= 12; x += 2) plane(x, 0.006, 12.25, 1, 0.08, '#e4e5cf');
  for (let x = -11.6; x < 12; x += 0.8) plane(x, 0.033, 10.1, 0.785, 0.88, '#d9d2c0');
  for (let z = 5.35; z < 9.8; z += 0.87) for (let x = -0.42; x < 0.6; x += 0.85) box(x, 0.025, z, 0.78, 0.06, 0.79, '#ded7bc');
  for (let x = -1.5; x < 2.1; x += 0.65) box(x, 0.01, 4.94, 0.6, 0.17, 0.62, '#d7c6a9');
  // Foundation, warm plank floors, and blue tile.
  box(0, 0.015, 0, 11.4, 0.18, 9.4, '#c5ac89');
  box(0, 0.15, 0, 11.05, 0.075, 9.08, C.oakLight);
  const floorTones = floor === 1 ? ['#bbcdaf', '#c5d3b6', '#becfb0'] : floor === 2 ? ['#c5a4a0', '#cfb1a8', '#c7a7a2'] : ['#d4ad7c', '#d9b587', '#cfaa7c'];
  for (let ix = 0; ix < 22; ix++) {
    const x = -5.25 + ix * 0.5;
    for (let iz = 0; iz < 9; iz++) {
      const z = -4 + iz;
      let col = x < 2.5 && z < -0.5 && x > -1.8 ? '#d8c5a3' : floorTones[Math.floor(randSeed(ix * 12 + iz) * 3)];
      if (x > 2.5 && z < -0.5) col = (ix + iz) % 2 ? '#98b7b1' : '#d7d8bf';
      plane(x, 0.228, z, 0.49, 0.99, col);
      if (z > -0.5 || x < -1.8) plane(x + 0.08, 0.23, z + 0.26, 0.3, 0.012, '#c5a376', 0.24);
    }
  }
  // Room rugs sit flat on the floor.
  plane(-3.65, 0.24, 2.15, 3.4, 3.55, '#c99a84');
  plane(-3.65, 0.245, 2.15, 3.11, 3.26, '#ddbea5');
  for (let a = -4.95; a < -2.1; a += 0.25) {
    plane(a, 0.248, 0.66, 0.12, 0.16, '#af7e67');
    plane(a, 0.248, 3.64, 0.12, 0.16, '#af7e67');
  }
  plane(-3.93, 0.24, -2.35, 2.8, 3.7, '#a7babc');
  plane(-3.93, 0.243, -2.35, 2.55, 3.48, '#b4c4c0');
  plane(1.03, 0.24, 0.75, 2.65, 2.52, '#c7c095');
  plane(1.03, 0.244, 0.75, 2.41, 2.28, '#d4cdab');
  // A small patch of soil for the garden.
  box(-7.55, 0.025, -2.5, 2.0, 0.13, 3.05, '#bdab82');
  box(-7.55, 0.16, -2.5, 1.78, 0.05, 2.85, '#8f8064');
  // House walls, with real window openings.
  const openings = [[-4, 2], [-0.02, 1.9], [4.15, 1.35]];
  let left = -5.6;
  for (const [x, w] of openings) {
    const a = x - w / 2;
    if (a > left) wallBack((a + left) / 2, a - left, 0.23, 2.24);
    backWindow(x, w);
    left = x + w / 2;
  }
  if (left < 5.6) wallBack((left + 5.6) / 2, 5.6 - left, 0.23, 2.24);
  box(-5.64, 0.23, -1.2, 0.19, 2.24, 6.85, C.wall);
  box(-5.64, 0.23, 3.24, 0.19, 0.78, 2.1, C.wall);
  box(-5.54, 0.23, 0, 0.04, 0.12, 9.1, C.trim);
  box(-5.64, 2.45, -1.2, 0.24, 0.075, 6.87, C.white);
  // Front walls are cut away so the entire home stays visible.
  box(-3.38, 0.23, 4.59, 4.6, 0.28, 0.2, C.wall);
  box(3.39, 0.23, 4.59, 4.58, 0.28, 0.2, C.wall);
  box(-3.38, 0.5, 4.59, 4.63, 0.06, 0.24, C.white);
  box(3.39, 0.5, 4.59, 4.61, 0.06, 0.24, C.white);
  box(5.63, 0.23, 0, 0.18, 0.28, 9.17, C.wall);
  box(5.63, 0.5, 0, 0.23, 0.06, 9.2, C.white);
  box(-1.8, 0.23, -2.85, 0.16, 1.12, 3.55, C.wall);
  box(-1.8, 1.35, -2.85, 0.2, 0.06, 3.55, C.white);
  box(-4.45, 0.23, -0.55, 2.23, 0.78, 0.16, C.wall);
  box(-4.45, 1.01, -0.55, 2.28, 0.055, 0.2, C.white);
  box(2.65, 0.23, -2.88, 0.16, 0.95, 3.5, '#c3d4c0');
  box(2.65, 1.18, -2.88, 0.2, 0.06, 3.53, C.white);
  box(4.88, 0.23, -0.55, 1.4, 0.57, 0.16, '#c3d4c0');
  box(4.88, 0.8, -0.55, 1.45, 0.06, 0.22, C.white);
  // Door mat, building brick pins, and a tiny welcome planter.
  plane(0.1, 0.24, 4.27, 1.5, 0.55, '#7f9270');
  plane(0.1, 0.242, 4.27, 1.23, 0.32, '#a6b78b');
  for (let x = -5.3; x <= 5.3; x += 0.55) {
    if (Math.abs(x) < 1.2) continue;
    stud(x, 0.56, 4.59, 0.065, '#ffedce');
  }
  // Fence and flowering beds.
  for (let x = -9.1; x < 9.5; x += 1.25) {
    box(x, 0.01, -6.65, 0.15, 0.98, 0.16, C.cream);
    box(x, 0.99, -6.65, 0.19, 0.07, 0.2, C.white);
  }
  box(0, 0.37, -6.65, 18.3, 0.12, 0.1, C.white);
  box(0, 0.77, -6.65, 18.3, 0.12, 0.1, C.white);
  for (let z = -6; z < 8.1; z += 1.3) {
    box(-9.25, 0, z, 0.16, 0.77, 0.16, C.cream);
    box(-9.25, 0.77, z, 0.19, 0.07, 0.2, C.white);
  }
  box(-9.25, 0.29, 0.8, 0.1, 0.11, 14.1, C.white);
  box(-9.25, 0.64, 0.8, 0.1, 0.11, 14.1, C.white);
}

function tree(size) {
  shadow(0.3, 0.22, 2.8 * size, 2.4 * size, 0.12, 0.012);
  box(0, 0, 0, 0.3 * size, 1.5 * size, 0.32 * size, '#977b55');
  box(0.22, 0.9, -0.1, 0.16 * size, 0.7 * size, 0.16 * size, '#a38860');
  leafCluster(0, 1.35 * size, 0, 1.6 * size, '#82a76b');
  leafCluster(-0.53 * size, 1.05 * size, 0.16 * size, 1.08 * size, '#739961');
  leafCluster(0.51 * size, 1.2 * size, -0.16 * size, 1.0 * size, '#94b779');
  box(0, 2.42 * size, 0, 0.6 * size, 0.21 * size, 0.65 * size, '#a3bd7c');
}

/** Decorations that never move: [x, z, y, angle, build]. */
function decorations() {
  const list = [];
  const add = (x, z, fn, a = 0, y = ROOM_Y) => list.push([x, z, y, a, fn]);
  // Outdoor trees, shrubs, and garden detail.
  add(-7.75, -5.25, () => tree(1.05), 0, 0.01);
  add(7.7, -5.3, () => tree(1.45), 0, 0.01);
  add(7.8, 6.8, () => tree(1.2), 0, 0.01);
  for (let i = 0; i < 7; i++) {
    add(7.2, -4.7 + i * 0.89, () => {
      leafCluster(0, 0.05, 0, 0.9, '#90aa70');
      stud(-0.16, 0.69, 0.1, 0.12, '#a4bc7a');
    }, 0, 0.01);
  }
  for (let i = 0; i < 15; i++) {
    const x = 6.6 + randSeed(i) * 1.5;
    const z = 2 + randSeed(i + 80) * 1.8;
    add(x, z, () => flower(0, 0, 0, i % 2 ? '#f3d88e' : '#dca998', 0.12), 0, 0.02);
  }
  add(-1.5, 5.1, () => pottedPlant(0, 0, 0, 0.74, '#c28c68'), 0, 0.12);
  add(-7.9, 5.6, () => box(0, 0, 0, 0.7, 0.22, 0.5, '#bcb9a1'), 0.3, 0);
  // Wall art, clock, and books are all built from simple blocks.
  add(-5.5, 0.85, () => {
    box(0, 0.87, 0, 0.085, 1.04, 1.1, '#ac875c');
    box(0.054, 0.94, 0, 0.022, 0.9, 0.96, '#f4e9cf');
    box(0.07, 1.06, 0.15, 0.024, 0.39, 0.4, '#b9c7a1');
    box(0.076, 1.43, -0.19, 0.026, 0.25, 0.33, '#d79864');
    box(0.08, 1.04, -0.18, 0.028, 0.18, 0.19, '#698e84');
  });
  add(-2.45, -4.45, () => {
    box(0, 1.07, 0, 0.5, 0.67, 0.07, '#aa8259');
    box(0, 1.12, 0.046, 0.42, 0.57, 0.025, '#f2e3c3');
    box(-0.05, 1.26, 0.065, 0.25, 0.18, 0.012, '#82996e');
  });
  add(0.45, -4.37, () => {
    box(0, 1.7, 0, 2.2, 0.09, 0.35, C.oak);
    for (let i = 0; i < 4; i++) box(-0.78 + i * 0.12, 1.79, 0, 0.09, 0.28 + randSeed(i) * 0.15, 0.2, ['#b7bca1', '#c59768', '#668e84', '#d7c58c'][i]);
    pottedPlant(0.6, 1.79, 0, 0.37, C.cream);
  });
  // Simple table lamps make the room feel lived in.
  add(-2.65, -3.28, () => {
    shadow(0, 0.05, 0.75, 0.65, 0.12);
    box(0, 0, 0, 0.62, 0.56, 0.57, '#b99167');
    box(0, 0.57, 0, 0.67, 0.075, 0.62, C.oakLight);
    box(0, 0.58, 0.304, 0.15, 0.07, 0.035, '#c7bb99');
    cylinder(0, 0.65, 0, 0.15, 0.045, C.cream);
    box(0, 0.68, 0, 0.055, 0.37, 0.055, '#b19465');
    cylinder(0, 1.03, 0, 0.27, 0.34, '#f4dcb1', 10, 0.17);
  });
  add(-3.8, 2.47, () => {
    shadow(0, 0, 1.85, 1.05, 0.12);
    for (const x of [-0.64, 0.64]) for (const z of [-0.28, 0.28]) box(x, 0.02, z, 0.11, 0.38, 0.11, '#a77a55');
    box(0, 0.4, 0, 1.65, 0.13, 0.94, C.oakLight);
    box(-0.28, 0.54, -0.06, 0.44, 0.06, 0.43, '#718f86');
    box(-0.22, 0.6, -0.08, 0.42, 0.04, 0.4, '#f0dfb7');
    cylinder(0.39, 0.53, 0.05, 0.12, 0.14, '#f1e2c0', 10);
    cylinder(0.39, 0.675, 0.05, 0.095, 0.006, '#7e6950', 10);
  });
  add(4.94, 3.31, () => {
    box(0, 0.0, 0, 0.48, 0.95, 0.78, C.cream);
    box(0, 0.96, 0, 0.57, 0.09, 0.88, C.white);
    for (let i = 0; i < 4; i++) box(0, 0.4, -0.25 + i * 0.15, 0.38, 0.35, 0.09, ['#ca9a70', '#90a892', '#779589', '#d0bb92'][i]);
  });
  return list;
}

/** Everything that never moves, merged into one face list in world coordinates. */
export function buildStatic(floor) {
  const list = begin(0, 0, 0, 0, []);
  buildBase(floor);
  for (const [x, z, y, a, fn] of decorations()) {
    begin(x, z, y, a, list);
    fn();
  }
  return finish();
}

/** The gathering table (picked like furniture), local to its spot at (.6, ROOM_Y, .75). */
export function diningFaces() {
  begin();
  shadow(0, 0, 2.2, 2, 0.1);
  for (const x of [-0.54, 0.54]) for (const z of [-0.46, 0.46]) box(x, 0.01, z, 0.105, 0.78, 0.105, '#b69467');
  box(0, 0.8, 0, 1.7, 0.12, 1.47, '#dab37c');
  for (const z of [-1.02, 1.02]) {
    for (const x of [-0.24, 0.24]) for (const dz of [-0.22, 0.22]) box(x, 0, z + dz, 0.09, 0.45, 0.09, '#a18559');
    box(0, 0.45, z, 0.68, 0.1, 0.64, '#cab67f');
    box(0, 0.49, z + (z < 0 ? -0.27 : 0.27), 0.68, 0.6, 0.085, '#cabb8b');
  }
  pottedPlant(0, 0.92, 0, 0.29, '#f1dfbd');
  return finish();
}

/**
 * The kitchen garden beside the house, local to (-7.55, 0.2, -2.5).
 * stage 0: fresh sprouts · 1: leafy and growing · 2: ripe (the original look).
 */
export function gardenFaces(stage, wet) {
  begin();
  if (wet) plane(0, 0.012, 0, 1.7, 2.78, '#7a6c55');
  for (let z = -1; z < 1.4; z += 0.7) {
    for (let x = -0.52; x < 0.6; x += 0.52) {
      if (stage === 0) {
        box(x, 0, z, 0.04, 0.16, 0.04, '#6f9a55');
        box(x - 0.05, 0.13, z, 0.09, 0.03, 0.05, '#86b064');
        box(x + 0.05, 0.11, z, 0.09, 0.03, 0.05, '#86b064');
      } else {
        box(x, 0, z, 0.06, 0.4, 0.06, '#65834b');
        leafCluster(x, 0.12, z, stage === 2 ? 0.35 : 0.3, '#70955b');
        if (stage === 2) cylinder(x + 0.08, 0.32, z, 0.1, 0.13, '#d99157', 7);
      }
    }
  }
  if (stage === 2) for (const [x, z] of [[-0.3, -0.62], [0.27, 0.1], [-0.25, 0.78]]) stud(x, 0.44, z, 0.06, '#cf6f55');
  return finish();
}

/* ------------------------------------------------------------ furniture */

/** One piece of furniture in its own local space (y = 0 is the floor it stands on). */
export function furnitureFaces(type) {
  begin();
  switch (type) {
    case 'fridge':
      shadow(0, 0.05, 1.3, 1.2, 0.12);
      box(0, 0, 0, 1.0, 1.75, 0.91, '#d9e2cc'); box(0, 1.77, 0, 1.03, 0.07, 0.94, C.white);
      box(0, 0.065, 0.475, 0.93, 1.1, 0.075, '#e5e9d8'); box(0, 1.2, 0.475, 0.93, 0.49, 0.075, '#e7ecda');
      box(0.33, 0.64, 0.54, 0.05, 0.36, 0.065, '#93a397'); box(0.33, 1.33, 0.54, 0.05, 0.2, 0.06, '#93a397');
      box(-0.17, 1.41, 0.52, 0.2, 0.17, 0.023, '#d4a16b'); box(-0.18, 1.63, 0.52, 0.11, 0.04, 0.027, '#719a79');
      break;
    case 'stove':
      shadow(0, 0.03, 1.3, 1.2, 0.1);
      box(0, 0, 0, 1.12, 0.88, 1.0, '#598f86'); box(0, 0.88, 0, 1.18, 0.085, 1.05, '#e2dec3');
      box(0, 0.19, 0.51, 0.82, 0.49, 0.045, '#496b64'); box(0, 0.25, 0.537, 0.68, 0.35, 0.018, '#637776');
      box(0, 0.7, 0.54, 0.73, 0.046, 0.075, '#c6d2bb');
      for (const x of [-0.32, 0.32]) for (const z of [-0.27, 0.27]) {
        cylinder(x, 0.97, z, 0.185, 0.02, '#5a6861', 12);
        cylinder(x, 0.995, z, 0.102, 0.014, '#919589', 10);
      }
      for (const x of [-0.37, -0.12, 0.12, 0.37]) cylinder(x, 0.81, 0.535, 0.033, 0.045, C.white, 8);
      cylinder(0.31, 1.014, -0.27, 0.16, 0.2, '#b79b75', 10); box(0.51, 1.13, -0.27, 0.24, 0.035, 0.06, '#777965');
      break;
    case 'sink':
      box(0, 0, 0, 0.95, 0.84, 1.0, C.teal); box(0, 0.84, 0, 1.01, 0.08, 1.05, C.cream);
      box(0, 0.922, 0, 0.7, 0.015, 0.61, '#7e9c90'); box(0, 0.939, 0, 0.53, 0.014, 0.44, '#adc7b7');
      box(0.27, 0.9, -0.28, 0.045, 0.38, 0.045, '#a3b5a7'); box(0.16, 1.23, -0.28, 0.25, 0.045, 0.045, '#b3c5b5');
      box(0.05, 1.19, -0.28, 0.04, 0.085, 0.04, '#b9cabe'); box(0, 0.65, 0.511, 0.26, 0.04, 0.04, '#cbdbbe');
      break;
    case 'toilet':
      shadow(0, 0.07, 0.85, 1.08, 0.13);
      box(0, 0, -0.1, 0.38, 0.24, 0.43, '#dddcc7'); box(0, 0.22, 0.13, 0.62, 0.19, 0.72, '#eee9d5');
      cylinder(0, 0.405, 0.2, 0.29, 0.045, '#f7f1df', 12); cylinder(0, 0.453, 0.2, 0.192, 0.01, '#a7c2bc', 12);
      box(0, 0.03, -0.34, 0.67, 0.91, 0.25, '#eee9d5'); box(0, 0.94, -0.34, 0.71, 0.06, 0.29, '#faf3df');
      box(0.24, 0.78, -0.192, 0.09, 0.035, 0.035, '#a3ad9c');
      break;
    case 'shower':
      shadow(0, 0, 1.3, 1.3, 0.11);
      box(0, 0, 0, 1.07, 0.12, 1.13, '#eee8d4'); box(0, 0.12, 0, 0.85, 0.015, 0.88, '#c4d1c0');
      box(0, 0.14, -0.51, 1.05, 1.75, 0.08, '#a1c4b7'); box(-0.49, 0.14, 0, 0.055, 1.75, 1.02, '#afd2c0');
      box(0.49, 0.14, -0.47, 0.055, 1.75, 0.055, '#d0d9c1'); box(0, 1.86, -0.49, 1.09, 0.05, 0.08, '#e4e8cc');
      box(-0.5, 1.86, 0, 0.055, 0.05, 1.07, '#e4e8cc'); box(0.31, 1.16, -0.455, 0.045, 0.5, 0.055, '#d4dfca');
      box(0.31, 1.64, -0.28, 0.05, 0.05, 0.37, '#cfd8c2'); cylinder(0.31, 1.58, -0.12, 0.135, 0.04, '#dbe0c9', 10);
      box(-0.36, 0.49, -0.31, 0.17, 0.31, 0.18, '#d4ba82'); box(-0.36, 0.82, -0.31, 0.09, 0.03, 0.09, '#e7ddc0');
      break;
    case 'bed':
      shadow(0, 0.1, 2, 2.9, 0.13);
      for (const x of [-0.7, 0.7]) for (const z of [-1.01, 1.01]) box(x, 0, z, 0.14, 0.31, 0.14, '#a17c55');
      box(0, 0.18, 0, 1.75, 0.25, 2.57, '#ae8b66'); box(0, 0.32, -1.21, 1.88, 0.79, 0.15, '#b5946d');
      box(0, 0.48, 0, 1.65, 0.22, 2.45, '#efe7cb'); box(0, 0.705, 0.25, 1.66, 0.16, 1.94, '#719595');
      box(0, 0.87, 0.06, 1.69, 0.1, 1.43, '#7d9d9e'); box(0, 0.874, 1.04, 1.69, 0.07, 0.26, '#9cb8ae');
      for (const x of [-0.42, 0.42]) box(x, 0.706, -0.94, 0.71, 0.17, 0.5, '#f6ebd2');
      for (const x of [-0.67, -0.24, 0.2, 0.63]) stud(x, 1.105, -1.21, 0.078, '#c5a176');
      break;
    case 'sofa':
      shadow(0, 0.05, 2.9, 1.6, 0.13);
      for (const x of [-1.02, 1.02]) for (const z of [-0.34, 0.34]) box(x, 0, z, 0.1, 0.24, 0.1, '#9c784d');
      box(0, 0.16, 0, 2.65, 0.28, 1.13, '#cb914d'); box(0, 0.4, -0.49, 2.64, 0.65, 0.24, '#d6a14f');
      for (const x of [-0.79, 0, 0.79]) {
        box(x, 0.44, 0.02, 0.75, 0.19, 0.74, '#e2b161');
        box(x, 0.62, -0.375, 0.74, 0.42, 0.16, '#e0ac57');
        stud(x, 0.99, -0.4, 0.13, '#e7b762');
      }
      for (const x of [-1.22, 1.22]) box(x, 0.42, 0.04, 0.26, 0.38, 1.16, '#d7a154');
      box(-0.82, 0.64, -0.16, 0.43, 0.39, 0.21, '#f1d6a2'); box(0.87, 0.62, -0.17, 0.43, 0.38, 0.22, '#89a996');
      break;
    case 'tv':
      shadow(0, 0, 1.9, 0.8, 0.1);
      box(0, 0, 0, 1.68, 0.48, 0.51, '#b59164'); box(0, 0.07, 0.26, 0.64, 0.26, 0.035, '#6b9389');
      box(0.55, 0.07, 0.26, 0.36, 0.26, 0.035, '#d5b481'); box(0, 0.48, 0, 1.75, 0.065, 0.59, '#d8b485');
      box(0, 0.55, 0, 0.58, 0.04, 0.36, '#4e665e'); box(0, 0.59, 0, 0.09, 0.17, 0.09, '#4e665e');
      box(0, 0.73, 0, 1.5, 0.88, 0.11, '#435e5b'); box(0, 0.8, -0.063, 1.35, 0.73, 0.025, '#83a79f');
      box(-0.18, 0.8, -0.08, 0.63, 0.4, 0.016, '#adc5a8'); box(0.33, 1.16, -0.08, 0.35, 0.26, 0.016, '#decea1');
      box(0, 1.25, -0.085, 1.31, 0.08, 0.018, '#bacdad');
      break;
    case 'computer':
      shadow(0, 0, 1.85, 1.25, 0.1);
      for (const x of [-0.69, 0.69]) for (const z of [-0.35, 0.35]) box(x, 0, z, 0.095, 0.8, 0.095, '#a38860');
      box(0, 0.8, 0, 1.67, 0.11, 0.98, '#d0b084'); box(0, 0.91, -0.15, 0.55, 0.045, 0.31, '#89988b');
      box(0, 0.94, -0.23, 0.08, 0.14, 0.09, '#9baa9c'); box(0, 1.06, -0.23, 0.83, 0.57, 0.06, '#d4dccb');
      box(0, 1.1, -0.19, 0.73, 0.46, 0.016, '#739d99');
      for (let i = 0; i < 3; i++) box(-0.16, 1.39 - i * 0.085, -0.18, 0.29 + randSeed(i) * 0.15, 0.025, 0.01, '#c1d5bd');
      box(0, 0.915, 0.24, 0.6, 0.04, 0.23, '#d4d9c4');
      for (let i = 0; i < 5; i++) box(-0.23 + i * 0.112, 0.96, 0.24, 0.07, 0.013, 0.15, '#adbcae');
      cylinder(0.56, 0.91, -0.1, 0.1, 0.14, '#d89e75', 10);
      for (const x of [-0.23, 0.23]) box(x, 0, 0.83, 0.075, 0.43, 0.075, '#aa8b63');
      box(0, 0.43, 0.84, 0.66, 0.1, 0.6, '#6e9a8d'); box(0, 0.53, 1.09, 0.65, 0.52, 0.085, '#81aa97');
      break;
    case 'mailbox':
      shadow(0.1, 0.1, 0.8, 0.7, 0.12, 0.035);
      box(0, 0, 0, 0.15, 0.92, 0.14, '#c6b798'); box(0, 0.89, 0, 0.61, 0.4, 0.51, '#b87661');
      box(0, 1.28, 0, 0.64, 0.06, 0.54, '#d59875'); box(0, 1.0, 0.264, 0.45, 0.2, 0.025, '#d99d7e');
      box(0.34, 1.06, 0, 0.04, 0.38, 0.04, '#92735b'); box(0.4, 1.3, 0, 0.16, 0.13, 0.04, '#ecce93');
      break;
    case 'plant':
      shadow(0, 0, 0.88, 0.75, 0.12);
      pottedPlant(0, 0, 0, 1.05, '#d2aa82');
      break;
    case 'easel':
      shadow(0, 0.05, 1.3, 1.0, 0.1);
      for (const x of [-0.39, 0.39]) box(x, 0, 0, 0.07, 1.52, 0.07, '#b68c58');
      box(0, 0, -0.39, 0.075, 1.22, 0.075, '#ab865a'); box(0, 0.78, 0, 1.05, 0.08, 0.21, '#c39c66');
      box(0, 0.82, -0.025, 0.87, 0.79, 0.05, '#f1e5c6'); box(-0.12, 0.89, 0.007, 0.54, 0.28, 0.025, '#97b6a0');
      box(0.2, 1.36, 0.01, 0.26, 0.17, 0.025, '#deb36d'); box(0.16, 0.92, 0.024, 0.32, 0.18, 0.026, '#6c9988');
      break;
    case 'bookshelf':
      shadow(0, 0.05, 1.45, 0.73, 0.12);
      box(0, 0, -0.18, 1.15, 1.55, 0.1, '#c19c72');
      for (const x of [-0.56, 0.56]) box(x, 0, 0, 0.1, 1.64, 0.49, C.oak);
      for (const y of [0, 0.5, 1, 1.58]) box(0, y, 0, 1.2, 0.07, 0.49, '#d1b285');
      for (const y of [0.07, 0.57, 1.07]) {
        for (let i = 0; i < 7; i++) box(-0.44 + i * 0.143, y, 0.07, 0.112, 0.27 + randSeed(i + y) * 0.16, 0.28, ['#80968a', '#d6b686', '#a78d73', '#9eb19b', '#d2a082'][i % 5]);
      }
      break;
    case 'arcade':
      shadow(0, 0, 1.2, 1, 0.12);
      box(0, 0, 0, 0.85, 0.75, 0.73, '#769b8d'); box(0, 0.75, -0.14, 0.85, 1.0, 0.42, '#658b82');
      box(0, 1.69, -0.11, 0.89, 0.15, 0.62, '#e0b467'); box(0, 1.06, 0.094, 0.66, 0.52, 0.025, '#416b64');
      box(-0.1, 1.25, 0.115, 0.14, 0.14, 0.015, '#d0cd83'); box(0.14, 1.33, 0.117, 0.13, 0.13, 0.017, '#d89573');
      box(0, 0.89, 0.2, 0.9, 0.09, 0.47, '#d4b57b'); stud(0.22, 0.98, 0.3, 0.067, '#c28262');
      stud(0.03, 0.98, 0.3, 0.067, '#8d9f6e'); box(-0.23, 0.98, 0.25, 0.035, 0.13, 0.035, '#62837c');
      cylinder(-0.23, 1.1, 0.25, 0.067, 0.07, '#cd8d61', 8);
      break;
    case 'rug':
      plane(0, 0.02, 0, 1.8, 1.3, '#ddc286'); plane(0, 0.023, 0, 1.6, 1.1, '#d09873'); plane(0, 0.026, 0, 1.36, 0.88, '#e4bf8b');
      break;
    case 'gnome':
      shadow(0, 0, 0.6, 0.52, 0.1);
      box(0, 0, 0.07, 0.45, 0.14, 0.35, '#755f48'); box(0, 0.12, 0, 0.44, 0.4, 0.35, '#6e9790');
      box(0, 0.5, 0, 0.38, 0.28, 0.32, '#dfb38a'); box(0, 0.42, 0.18, 0.25, 0.23, 0.08, '#f0e4c4');
      cylinder(0, 0.79, 0, 0.27, 0.57, '#c08264', 5, 0);
      box(-0.095, 0.65, 0.17, 0.04, 0.05, 0.025, '#584f43'); box(0.095, 0.65, 0.17, 0.04, 0.05, 0.025, '#584f43');
      break;
    case 'cat':
      shadow(0, 0, 0.8, 0.65, 0.1, 0.035);
      box(0, 0.15, 0, 0.6, 0.28, 0.36, '#cc9661');
      for (const x of [-0.2, 0.2]) for (const z of [-0.1, 0.1]) box(x, 0.025, z, 0.12, 0.14, 0.13, '#e2b584');
      box(0.22, 0.31, 0.12, 0.33, 0.32, 0.3, '#dfa975'); box(0.12, 0.63, 0.11, 0.1, 0.11, 0.13, '#cd9369');
      box(0.33, 0.63, 0.11, 0.1, 0.11, 0.13, '#cd9369'); box(0.12, 0.5, 0.278, 0.04, 0.055, 0.024, '#597568');
      box(0.31, 0.5, 0.278, 0.04, 0.055, 0.024, '#597568'); box(0.23, 0.43, 0.289, 0.045, 0.034, 0.015, '#ac7864');
      box(-0.42, 0.31, -0.015, 0.36, 0.09, 0.1, '#b98553');
      break;
    case 'radio':
      box(0, 0, 0, 0.6, 0.65, 0.53, '#bb9670'); box(0, 0.66, 0, 0.68, 0.07, 0.6, C.oakLight);
      box(0, 0.75, 0, 0.59, 0.38, 0.32, '#758d7b');
      for (const x of [-0.2, 0.2]) box(x, 0.79, 0.17, 0.15, 0.21, 0.024, '#526e61');
      box(0, 0.87, 0.18, 0.15, 0.1, 0.024, '#d0cd9c'); box(0.16, 1.12, -0.06, 0.021, 0.3, 0.021, '#a5a88f');
      break;
    // New finds for the shop, built the same way.
    case 'lantern':
      shadow(0, 0, 0.7, 0.6, 0.1);
      box(0, 0, 0, 0.34, 0.08, 0.34, '#7d7a68'); box(0, 0.08, 0, 0.08, 1.25, 0.08, '#5f6b5e');
      box(0, 1.33, 0, 0.3, 0.05, 0.3, '#5f6b5e'); box(0, 1.38, 0, 0.22, 0.3, 0.22, '#f6e3a6');
      for (const x of [-0.11, 0.11]) for (const z of [-0.11, 0.11]) box(x, 1.38, z, 0.03, 0.3, 0.03, '#5f6b5e');
      box(0, 1.68, 0, 0.32, 0.06, 0.32, '#5f6b5e'); cylinder(0, 1.74, 0, 0.15, 0.12, '#5f6b5e', 6, 0.03);
      break;
    case 'catbed':
      shadow(0, 0, 0.95, 0.8, 0.1);
      cylinder(0, 0, 0, 0.42, 0.12, '#b9876f', 12, 0.4);
      cylinder(0, 0.12, 0, 0.34, 0.06, '#efe0c4', 12, 0.3);
      box(-0.24, 0.12, -0.12, 0.16, 0.13, 0.42, '#c99a84');
      stud(0.1, 0.18, 0.05, 0.07, '#d58e6f');
      break;
  }
  return finish();
}

/* ------------------------------------------------------------ people */

export const OUTFITS = [
  { name: 'Golden hour', shirt: '#e2ae58', pants: '#5d8581' },
  { name: 'Berry nice', shirt: '#bc7d83', pants: '#707b86' },
  { name: 'Ocean club', shirt: '#81aaa1', pants: '#bb946a' },
];

/**
 * A person in parts, so the parts can move: legs swing, arms gesture, the upper
 * body crouches, and sitting and sleeping swap in their own poses. Local space:
 * feet at y = 0, facing +z. Arms and legs are built at their resting spot.
 */
export function personParts(style, outfit = OUTFITS[0]) {
  const isPlayer = style === 'mara';
  const out = isPlayer ? outfit : style === 'june' ? { shirt: '#ede0bd', pants: '#789b88' } : { shirt: '#ba8790', pants: '#829086' };
  const skin = isPlayer ? '#d9ab80' : style === 'june' ? '#bd8c67' : '#d8b594';
  const hair = isPlayer ? '#665045' : style === 'june' ? '#7b5540' : '#817965';
  const P = {};

  begin();
  shadow(0.08, 0.03, 0.85, 0.7, 0.18, 0.035);
  P.shadow = finish();

  begin();
  box(0, 0.7, -0.89, 0.45, 0.3, 0.46, skin); box(0, 0.89, -1.05, 0.47, 0.16, 0.17, hair);
  box(-0.23, 0.73, -0.9, 0.08, 0.24, 0.44, hair); box(0.23, 0.73, -0.9, 0.08, 0.24, 0.44, hair);
  box(-0.095, 1.009, -0.81, 0.077, 0.012, 0.019, '#624e40'); box(0.095, 1.009, -0.81, 0.077, 0.012, 0.019, '#624e40');
  box(0, 1.01, -0.68, 0.07, 0.012, 0.018, '#9c7258'); box(0.47, 0.87, -0.34, 0.17, 0.12, 0.17, skin);
  P.sleep = finish();

  begin();
  for (const x of [-0.135, 0.135]) {
    box(x, 0.08, 0.31, 0.205, 0.3, 0.21, out.pants);
    box(x, 0.28, 0.15, 0.22, 0.2, 0.53, out.pants);
    box(x, 0.02, 0.39, 0.245, 0.12, 0.36, '#f1e4c7');
  }
  P.sitLegs = finish();

  for (const side of [-1, 1]) {
    begin();
    box(side * 0.135, 0.12, 0, 0.205, 0.4, 0.23, out.pants);
    box(side * 0.135, 0.03, 0.045, 0.24, 0.13, 0.32, '#f1e6cb');
    box(side * 0.135, 0.028, 0.045, 0.25, 0.035, 0.33, '#c8c0a4');
    P[side < 0 ? 'legL' : 'legR'] = finish();
    begin();
    box(side * 0.35, 0.78, 0, 0.19, 0.24, 0.22, out.shirt);
    P[side < 0 ? 'armUL' : 'armUR'] = finish();
    begin();
    box(side * 0.35, 0.51, 0.02, 0.165, 0.29, 0.18, skin);
    box(side * 0.35, 0.455, 0.045, 0.17, 0.105, 0.19, skin);
    P[side < 0 ? 'armLL' : 'armLR'] = finish();
  }

  begin();
  box(0, 0.49, 0, 0.52, 0.53, 0.335, out.shirt);
  box(0, 1.02, 0, 0.16, 0.12, 0.16, skin);
  if (isPlayer) {
    box(0, 0.48, 0.18, 0.51, 0.18, 0.035, out.pants);
    box(0, 0.67, 0.181, 0.31, 0.24, 0.04, out.pants);
    for (const x of [-0.16, 0.16]) {
      box(x, 0.84, 0.181, 0.069, 0.18, 0.035, out.pants);
      box(x, 0.89, 0.205, 0.035, 0.045, 0.01, '#eaca89');
    }
  } else {
    box(0, 0.52, 0.18, 0.48, 0.11, 0.03, '#ddd8b7');
    box(0, 0.84, 0.18, 0.022, 0.2, 0.012, '#b9af8e');
  }
  box(0, 1.12, 0, 0.45, 0.44, 0.42, skin);
  box(0, 1.54, -0.015, 0.5, 0.13, 0.46, hair);
  box(0, 1.22, -0.2, 0.48, 0.4, 0.12, hair);
  box(-0.226, 1.2, -0.025, 0.1, 0.36, 0.39, hair);
  box(0.226, 1.25, -0.055, 0.1, 0.31, 0.34, hair);
  box(-0.09, 1.45, 0.22, 0.26, 0.12, 0.055, hair);
  box(0.14, 1.48, 0.21, 0.15, 0.1, 0.045, hair);
  stud(0, 1.67, -0.01, 0.11, hair);
  for (const x of [-0.09, 0.09]) {
    box(x, 1.34, 0.222, 0.038, 0.047, 0.018, '#534b3f');
    box(x, 1.416, 0.225, 0.068, 0.016, 0.013, '#6d5340');
  }
  box(0, 1.276, 0.233, 0.052, 0.045, 0.04, skin);
  box(0, 1.236, 0.224, 0.071, 0.019, 0.017, '#996e58');
  box(-0.18, 1.285, 0.222, 0.06, 0.045, 0.011, '#dda98a');
  box(0.18, 1.285, 0.222, 0.06, 0.045, 0.011, '#dda98a');
  if (style === 'june') {
    box(0.18, 1.35, -0.29, 0.3, 0.28, 0.29, hair);
    for (const x of [-0.26, 0.26]) stud(x, 1.23, 0.02, 0.04, '#e2c384');
  }
  P.upper = finish();

  begin();
  box(0, 0.88, 0.44, 0.49, 0.045, 0.32, '#a87a59');
  box(0, 0.923, 0.44, 0.44, 0.018, 0.29, '#f4e6c7');
  P.book = finish();
  begin();
  box(0.42, 0.59, 0.18, 0.25, 0.28, 0.25, '#86ada0');
  box(0.52, 0.71, 0.37, 0.09, 0.07, 0.25, '#8bb4a5');
  P.can = finish();
  begin();
  cylinder(0.05, 0.92, 0.43, 0.27, 0.028, '#efe4c7', 12);
  box(0.05, 0.95, 0.43, 0.27, 0.07, 0.19, '#d1ac62');
  P.plate = finish();
  return P;
}

/** The green gem that floats over the resident, local space. */
export function gemFaces() {
  begin();
  const r = 0.135;
  const v = [[0, 0.32, 0], [r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r], [0, -0.28, 0]];
  const cols = ['#b3d87a', '#90bf67', '#6ba852', '#a3cc75'];
  for (let i = 0; i < 4; i++) {
    const j = 1 + ((i + 1) % 4);
    face([v[0], v[j], v[i + 1]], cols[i]);
    face([v[5], v[i + 1], v[j]], i % 2 ? '#659c53' : '#80b364');
  }
  return finish();
}

/** Dishes and leftovers on the gathering table, local to the table. */
export function plateFaces(i) {
  begin();
  cylinder(-0.36, 0.93 + i * 0.035, 0.35, 0.19, 0.027, '#f3e6c8', 14);
  if (i === 0) box(-0.36, 0.958, 0.35, 0.15, 0.015, 0.09, '#ba995e');
  return finish();
}
export function leftoversFaces() {
  begin();
  box(0.43, 0.932, -0.2, 0.47, 0.1, 0.41, '#d2dac0');
  box(0.43, 1.035, -0.2, 0.49, 0.035, 0.43, '#b6c8a4');
  return finish();
}
export function balloonFaces(q) {
  begin();
  box(0, 0, 0, 0.035, 1.8, 0.035, '#c8bda0');
  cylinder(0, 1.8, 0, 0.31, 0.5, q ? '#bdc78a' : '#d5a190', 9, 0.22);
  stud(0, 2.3, 0, 0.12, q ? '#cbd394' : '#ddb09b');
  return finish();
}
/** A basket of fresh veggies, shown on the counter while there is produce. */
export function basketFaces() {
  begin();
  cylinder(0, 0, 0, 0.2, 0.14, '#b48a5e', 10, 0.24);
  stud(-0.07, 0.14, -0.03, 0.08, '#d99157');
  stud(0.08, 0.14, 0.02, 0.07, '#cf6f55');
  box(0.0, 0.15, 0.08, 0.12, 0.06, 0.06, '#7da35e');
  return finish();
}
