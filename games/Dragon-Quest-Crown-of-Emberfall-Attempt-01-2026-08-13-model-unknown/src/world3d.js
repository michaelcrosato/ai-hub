// The 3D world: the original's isometric low-poly look rebuilt as a real
// three.js scene. Every box and pyramid of the old Canvas/WebGPU painter keeps
// its size, position and per-face shading; an orthographic camera reproduces
// the old projection exactly (tile width = clamp(width / 10.8, 54, 104) CSS px,
// the hero 54% down the screen), so the picture matches, but now with a real
// depth buffer, merged geometry and one draw call per map.

import * as THREE from 'three/webgpu';
import { attribute, vertexColor, sin, time, abs, max, mix, vec3, uniform } from 'three/tsl';
import { MAPS, TILE_COLORS, ENEMIES } from './data.js';

// ---- colour math (sRGB hex, identical to the original's xt()) ---------------

function rgb(hex) {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lighten (amount > 0) toward white or darken (amount < 0) toward black. */
export function shade(hex, amount) {
  const target = amount >= 0 ? 255 : 0;
  const k = Math.abs(amount);
  return `#${rgb(hex)
    .map((c) => Math.round(c * (1 - k) + target * k))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

// ---- the projection ---------------------------------------------------------
// Old screen mapping per world unit (in tile widths): +X → (0.5, -0.26),
// +Z → (-0.5, -0.26), +Y → (0, 0.4368) with screen y up. Rows R and U are
// orthogonal, so it is an orthographic view along BACK with a vertical scale.
const R = new THREE.Vector3(0.5, 0, -0.5);
const U = new THREE.Vector3(-0.26, 0.4368, -0.26);
const R_SCALE = R.length();
const U_SCALE = U.length();
const UP_DIR = U.clone().normalize();
const BACK = new THREE.Vector3().crossVectors(R.clone().normalize(), UP_DIR).normalize();

const UP = [0, 1, 0];
const PX = [1, 0, 0];
const PZ = [0, 0, 1];
const NX = [-1, 0, 0];
const NZ = [0, 0, -1];
const NO_WAVE = [0, 0];

const color = new THREE.Color();

// The original's baked light, by the direction a face looks in the world.
// Box faces looking away from the camera (-X, -Z) are never seen.
const BOX_SHADE = { px: -0.18, pz: -0.34, nx: -0.18, nz: -0.34, up: 0.13 };
const PYRAMID_SHADE = { nz: 0.16, px: 0, pz: -0.25, nx: -0.1, up: 0 };
const dirKey = (o) => (o[1] > 0.5 ? 'up' : Math.abs(o[0]) > Math.abs(o[2]) ? (o[0] > 0 ? 'px' : 'nx') : o[2] > 0 ? 'pz' : 'nz');

const shadeCache = new Map();
function shadeOf(hex, amount) {
  if (!amount) return hex;
  const key = `${hex}|${amount}`;
  let v = shadeCache.get(key);
  if (!v) shadeCache.set(key, (v = shade(hex, amount)));
  return v;
}

/**
 * Collects flat-coloured triangles (optionally painter-sorted) into one BufferGeometry.
 * `turn` (quarter turns about Y, the same sense as rotation.y) builds a rotated copy
 * whose face shading still follows the world light; `closed` adds the box sides that
 * only show once a shape has turned (actors).
 */
class Geo {
  constructor({ painter = false, turn = 0, closed = false } = {}) {
    this.painter = painter;
    this.turn = ((turn % 4) + 4) % 4;
    this.closed = closed;
    this.faces = [];
  }

  /** A point or direction turned by this.turn quarter turns about Y. */
  rot(p) {
    switch (this.turn) {
      case 1:
        return [p[2], p[1], -p[0]];
      case 2:
        return [-p[0], p[1], -p[2]];
      case 3:
        return [-p[2], p[1], p[0]];
      default:
        return p;
    }
  }

  tri(a, b, c, hex, out, wave = NO_WAVE, depth = 0) {
    if (this.turn) {
      a = this.rot(a);
      b = this.rot(b);
      c = this.rot(c);
      out = this.rot(out);
    }
    if (!this.painter) {
      // Orient so the front face points along `out` (three.js culls back faces).
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * out[0] + ny * out[1] + nz * out[2] < 0) [b, c] = [c, b];
    }
    this.faces.push({ pts: [a, b, c], hex, wave, depth });
  }

  quad(a, b, c, d, hex, out, wave, depth = 0) {
    this.tri(a, b, c, hex, out, wave, depth);
    this.tri(a, c, d, hex, out, wave, depth);
  }

  /** The colour a face of `hex` gets when it looks along `out` (after the turn). */
  lit(hex, out, table) {
    return shadeOf(hex, table[dirKey(this.rot(out))]);
  }

  /** addBox(x, z, width, depth, height, colour, base) with the original face shading. */
  box(x, z, w, d, h, hex, y0 = 0, bias = 0, wave = NO_WAVE) {
    const x1 = x + w, z1 = z + d, y1 = y0 + h;
    const m = (x + z + w + d) * 10 + bias;
    this.quad([x1, y0, z], [x1, y0, z1], [x1, y1, z1], [x1, y1, z], this.lit(hex, PX, BOX_SHADE), PX, wave, m + 0.1);
    this.quad([x, y0, z1], [x1, y0, z1], [x1, y1, z1], [x, y1, z1], this.lit(hex, PZ, BOX_SHADE), PZ, wave, m + 0.2);
    this.quad([x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1], this.lit(hex, UP, BOX_SHADE), UP, wave, m + 0.3);
    if (this.closed) {
      this.quad([x, y0, z], [x, y0, z1], [x, y1, z1], [x, y1, z], this.lit(hex, NX, BOX_SHADE), NX, wave, m);
      this.quad([x, y0, z], [x1, y0, z], [x1, y1, z], [x, y1, z], this.lit(hex, NZ, BOX_SHADE), NZ, wave, m);
    }
  }

  /** addPyramid(x, z, base, height, colour, base elevation). */
  pyramid(x, z, n, h, hex, y0 = 0, bias = 0) {
    const s = [x, y0, z], p = [x + n, y0, z], q = [x + n, y0, z + n], d = [x, y0, z + n], g = [x + n / 2, y0 + h, z + n / 2];
    const w = (x + z + n * 2) * 10 + bias;
    this.tri(s, p, g, this.lit(hex, NZ, PYRAMID_SHADE), NZ, NO_WAVE, w);
    this.tri(p, q, g, this.lit(hex, PX, PYRAMID_SHADE), PX, NO_WAVE, w + 0.1);
    this.tri(q, d, g, this.lit(hex, PZ, PYRAMID_SHADE), PZ, NO_WAVE, w + 0.2);
    this.tri(d, s, g, this.lit(hex, NX, PYRAMID_SHADE), NX, NO_WAVE, w + 0.15);
  }

  build() {
    const faces = this.painter ? this.faces.slice().sort((a, b) => a.depth - b.depth) : this.faces;
    const n = faces.length * 3;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const wav = new Float32Array(n * 2);
    let i = 0;
    let lastHex = '';
    for (const f of faces) {
      if (f.hex !== lastHex) {
        color.set(f.hex); // sRGB hex → linear working colour
        lastHex = f.hex;
      }
      for (const p of f.pts) {
        pos[i * 3] = p[0];
        pos[i * 3 + 1] = p[1];
        pos[i * 3 + 2] = p[2];
        col[i * 3] = color.r;
        col[i * 3 + 1] = color.g;
        col[i * 3 + 2] = color.b;
        wav[i * 2] = f.wave[0];
        wav[i * 2 + 1] = f.wave[1];
        i += 1;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('wave', new THREE.BufferAttribute(wav, 2));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

/** A flat shadow diamond, like addShadow(): n is the size factor. */
function shadowDiamond(g, cx, cz, n, y) {
  g.quad([cx - 0.14 * n, y, cz - 0.14 * n], [cx + 0.25 * n, y, cz - 0.25 * n], [cx + 0.14 * n, y, cz + 0.14 * n], [cx - 0.25 * n, y, cz + 0.25 * n], '#26313a', UP);
}

// ---- props (addProp) --------------------------------------------------------

function addProp(g, sh, prop, base) {
  const l = prop.x + 0.08;
  const n = prop.y + 0.08;
  const c = prop.color ?? (prop.kind === 'rock' ? '#7c8192' : '#5aa85a');
  const k = prop.kind;
  if (k === 'tree' || k === 'pine') {
    shadowDiamond(sh, prop.x + 0.5, prop.y + 0.5, 1.25, base + 0.025);
    g.box(l + 0.32, n + 0.32, 0.22, 0.22, 0.78, '#795137', base);
    g.pyramid(l - 0.08, n - 0.08, 1.05, k === 'pine' ? 1.7 : 1.3, k === 'pine' ? '#3a8c71' : c, base + 0.55);
    if (k === 'tree') g.pyramid(l + 0.08, n + 0.08, 0.78, 1.05, shade(c, 0.08), base + 1.05);
    return;
  }
  if (k === 'house') {
    g.box(l - 0.18, n - 0.18, 1.2, 1.2, 1.05, '#f4dfad', base);
    g.pyramid(l - 0.28, n - 0.28, 1.4, 0.75, c, base + 1.02);
    // The door sits on the front wall (the old painter drew it inside the house and on top).
    g.box(l + 0.42, n + 1.0, 0.3, 0.05, 0.58, '#6d4b45', base);
    return;
  }
  if (k === 'castle') {
    g.box(l - 0.35, n - 0.35, 1.65, 1.65, 1.45, c, base);
    g.box(l - 0.45, n - 0.45, 0.55, 0.55, 2.05, shade(c, -0.08), base);
    g.box(l + 0.85, n + 0.85, 0.55, 0.55, 2.05, shade(c, -0.14), base);
    g.pyramid(l - 0.48, n - 0.48, 0.62, 0.55, '#e95b63', base + 2.03);
    g.pyramid(l + 0.82, n + 0.82, 0.62, 0.55, '#e95b63', base + 2.03);
    return;
  }
  if (k === 'tower') {
    g.box(l, n, 0.85, 0.85, 2.1, c, base);
    g.pyramid(l - 0.08, n - 0.08, 1.02, 0.8, '#697ac8', base + 2.05);
    return;
  }
  if (k === 'shrine' || k === 'gate') {
    g.box(l, n, 0.22, 0.88, 1.25, c, base);
    g.box(l + 0.65, n, 0.22, 0.88, 1.25, c, base);
    g.box(l - 0.02, n, 0.93, 0.22, 0.28, shade(c, 0.1), base + 1.2);
    return;
  }
  if (k === 'crystal') {
    g.pyramid(l + 0.05, n + 0.05, 0.7, 1.65, c, base);
    g.pyramid(l + 0.42, n + 0.26, 0.4, 1.05, shade(c, 0.15), base);
    return;
  }
  if (k === 'column') {
    g.box(l + 0.18, n + 0.18, 0.5, 0.5, 1.4, c, base);
    g.box(l + 0.08, n + 0.08, 0.7, 0.7, 0.18, shade(c, 0.12), base + 1.34);
    return;
  }
  if (k === 'flowers') {
    for (const [ox, oz, fc] of [
      [0.15, 0.2, '#ff6788'],
      [0.48, 0.34, '#ffd85d'],
      [0.3, 0.62, '#f4a1df'],
    ])
      g.pyramid(l + ox, n + oz, 0.16, 0.24, fc, base);
    return;
  }
  if (k === 'well') {
    g.box(l, n, 0.84, 0.84, 0.38, c, base);
    g.box(l + 0.16, n + 0.16, 0.52, 0.52, 0.15, '#315f76', base + 0.37);
    return;
  }
  if (k === 'boat') {
    g.pyramid(l, n, 0.9, 0.55, c, base);
    g.box(l + 0.42, n + 0.42, 0.08, 0.08, 1.5, '#74513c', base + 0.25);
    return;
  }
  if (k === 'torch') {
    g.box(l + 0.34, n + 0.34, 0.18, 0.18, 1, '#5a4450', base);
    g.pyramid(l + 0.2, n + 0.2, 0.46, 0.65, '#ffb33b', base + 0.9);
    return;
  }
  if (k === 'belfry') {
    // New: the bell tower north of the river.
    const x = prop.x + 0.1, z = prop.y + 0.1;
    g.box(x, z, 0.8, 0.8, 1.9, c, base);
    for (const [ox, oz] of [[0, 0], [0.66, 0], [0, 0.66], [0.66, 0.66]]) g.box(x + ox, z + oz, 0.14, 0.14, 0.62, shade(c, 0.1), base + 1.9);
    g.pyramid(x + 0.24, z + 0.24, 0.32, 0.4, '#e0b453', base + 1.94);
    g.pyramid(x - 0.08, z - 0.08, 0.96, 0.72, '#3f3560', base + 2.52);
    g.box(x + 0.28, z + 0.8, 0.24, 0.04, 0.52, '#2b2440', base);
    return;
  }
  if (k === 'bellframe') {
    // New: the empty frame the Still Bell was rung from.
    const x = prop.x, z = prop.y;
    g.box(x + 0.06, z + 0.42, 0.16, 0.16, 1.85, '#4a3a2e', base);
    g.box(x + 0.78, z + 0.42, 0.16, 0.16, 1.85, '#4a3a2e', base);
    g.box(x + 0.02, z + 0.4, 0.96, 0.2, 0.16, '#6b5846', base + 1.8);
    g.box(x + 0.2, z + 0.2, 0.6, 0.6, 0.1, shade(c, -0.15), base + 0.62);
    g.pyramid(x + 0.24, z + 0.24, 0.52, 0.95, c, base + 0.7);
    return;
  }
  g.pyramid(l + 0.05, n + 0.05, 0.72, 0.72, c, base);
}

// ---- actors (addActor) ------------------------------------------------------
// Built around the tile centre, once per facing (south, east, north, west), so
// they can turn to face where they walk while the baked light stays put.

function actorGeometry({ color: body, accent = '#ffd6aa', hero = false }, turn = 0) {
  const g = new Geo({ turn, closed: true });
  g.box(-0.16, -0.16, 0.34, 0.34, 0.34, '#544250', 0.02);
  g.box(-0.27, -0.27, 0.56, 0.56, 0.7, body, 0.32);
  g.box(-0.19, -0.19, 0.4, 0.4, 0.38, accent, 1.02);
  // Two small eyes on the front of the head, so facing reads at a glance.
  g.box(-0.13, 0.21, 0.07, 0.02, 0.08, '#1d2433', 1.17);
  g.box(0.06, 0.21, 0.07, 0.02, 0.08, '#1d2433', 1.17);
  if (hero) {
    g.pyramid(-0.24, -0.24, 0.5, 0.34, '#e94d5f', 1.35);
    // The courier's staff, carried in front so it stays visible.
    g.box(-0.34, 0.3, 0.14, 0.12, 0.75, '#f3c84b', 0.55);
  }
  return g.build();
}

/** Quarter turns for each facing (the actor's front is +Z, south). */
const TURN = { south: 0, east: 1, north: 2, west: 3 };

/** The facing that looks from tile (x, y) toward tile (tx, ty). */
function turnToward(x, y, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? TURN.east : TURN.west;
  return dy < 0 ? TURN.north : TURN.south;
}

// ---- combat enemies (addCombatEnemy) -----------------------------------------
// Drawn exactly like the original: faces sorted by its depth keys and painted
// in that order over the arena floor (no depth test), so every eye, sword and
// glowing core shows where it always did.

function enemyGeometry(e) {
  const g = new Geo({ painter: true });
  const u = e.color;
  const o = e.accent;
  const c = -0.1;
  switch (e.family) {
    case 'slime':
      g.pyramid(-0.45, -0.45, 1.9, 1.35, u, c, 12);
      g.box(0.05, -0.05, 0.22, 0.22, 0.18, '#1d2433', c + 0.58, 14);
      g.box(0.74, 0.64, 0.22, 0.22, 0.18, '#1d2433', c + 0.58, 14);
      break;
    case 'plant':
      g.box(0.12, 0.12, 0.75, 0.75, 1.55, u, c, 12);
      g.pyramid(-0.42, -0.42, 1.85, 1.5, o, c + 1.25, 14);
      g.pyramid(-0.68, 0.4, 0.82, 1.05, u, c + 0.32, 13);
      g.pyramid(0.86, -0.25, 0.82, 1.05, u, c + 0.32, 13);
      break;
    case 'wing':
      g.box(0.05, 0.05, 0.92, 0.92, 1.25, u, c + 0.55, 13);
      g.pyramid(-1.1, -0.18, 1.2, 0.85, o, c + 0.92, 12);
      g.pyramid(0.9, 0.22, 1.2, 0.85, o, c + 0.92, 14);
      g.pyramid(0.18, 0.18, 0.7, 0.75, shade(u, 0.12), c + 1.7, 15);
      break;
    case 'knight':
      g.box(-0.02, -0.02, 1.05, 1.05, 1.55, u, c, 13);
      g.box(0.08, 0.08, 0.85, 0.85, 0.75, o, c + 1.45, 15);
      g.box(-0.28, 0.7, 0.2, 0.2, 2.1, '#d8e0e6', c + 0.15, 14);
      break;
    case 'wisp':
      g.pyramid(-0.35, -0.35, 1.7, 1.65, u, c + 0.55, 13);
      g.pyramid(0.05, 0.05, 0.9, 1.05, o, c + 1.08, 14);
      break;
    case 'regent':
      g.box(-0.22, -0.22, 1.45, 1.45, 2.25, u, c, 13);
      g.box(-0.1, -0.1, 1.2, 1.2, 0.72, '#d6b299', c + 2.14, 15);
      g.pyramid(-0.28, -0.28, 1.55, 1.2, o, c + 2.64, 16);
      g.box(-0.62, 0.8, 0.22, 0.22, 2.8, '#221b32', c + 0.15, 14);
      break;
    case 'bell':
      // New: the Still Bell hanging in its frame.
      g.box(-0.8, 0.35, 0.28, 0.28, 3.0, '#4a3a2e', c, 8);
      g.box(-0.8, 0.35, 2.9, 0.28, 0.26, '#5a4636', c + 2.74, 9);
      g.box(0.35, 0.35, 0.3, 0.3, 0.45, o, c - 0.02, 5);
      g.pyramid(-0.3, -0.3, 1.6, 2.2, u, c + 0.62, 12);
      g.box(-0.45, -0.45, 1.9, 1.9, 0.26, shade(u, -0.12), c + 0.4, 10);
      g.box(0.3, 0.3, 0.4, 0.4, 0.34, shade(u, 0.12), c + 2.72, 30);
      g.box(1.82, 0.35, 0.28, 0.28, 3.0, '#4a3a2e', c, 20);
      g.box(-0.05, 1.0, 1.0, 0.12, 0.28, o, c + 1.25, 40);
      break;
    default:
      // beasts and fungi
      g.box(-0.25, -0.25, 1.5, 1.2, 1.05, u, c + 0.45, 13);
      g.box(0.72, 0.72, 0.78, 0.78, 0.92, o, c + 1.18, 15);
      for (const [x, z] of [
        [-0.08, -0.08],
        [0.82, -0.08],
        [-0.08, 0.72],
        [0.82, 0.72],
      ])
        g.box(x, z, 0.23, 0.23, 0.78, shade(u, -0.18), c, 12);
  }
  return g.build();
}

// ---- the world --------------------------------------------------------------

export function createWorld(kit) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.up.copy(UP_DIR);

  // Materials: unlit vertex colours keep the original flat, baked shading.
  const waveAmp = uniform(1);
  const mapMat = new THREE.MeshBasicNodeMaterial();
  {
    const w = attribute('wave', 'vec2');
    const s = sin(time.mul(2).add(w.x)).mul(w.y).mul(waveAmp);
    const base = vertexColor().rgb;
    mapMat.colorNode = base.mul(abs(s).oneMinus()).add(max(s, 0));
  }
  const solidMat = new THREE.MeshBasicNodeMaterial({ vertexColors: true });
  const shadowMat = new THREE.MeshBasicNodeMaterial({ color: 0x26313a, transparent: true, opacity: 0.24, depthWrite: false });
  const enemyFlash = uniform(0);
  const enemyFade = uniform(1);
  const enemyMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  enemyMat.colorNode = mix(vertexColor().rgb, vec3(1, 1, 1), enemyFlash);
  enemyMat.opacityNode = enemyFade;

  const actorShadowGeo = (() => {
    const g = new Geo();
    shadowDiamond(g, 0, 0, 1, 0.025);
    return g.build();
  })();

  // ---- map layer
  const mapGroup = new THREE.Group();
  scene.add(mapGroup);
  let map = null;
  let mapMesh = null;
  let mapShadows = null;
  let chestMesh = null;
  let chestSig = -1;
  const npcActors = [];
  const bossActors = [];

  const elevationAt = (m, x, y) => {
    const t = m.tiles[y]?.[x];
    return t ? Math.max(0, t.elevation ?? 0) : 0;
  };

  const disposeMesh = (mesh) => {
    if (!mesh) return;
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
  };

  const makeActor = (spec, x, y) => {
    const group = new THREE.Group();
    const geos = [0, 1, 2, 3].map((turn) => actorGeometry(spec, turn));
    const body = new THREE.Mesh(geos[0], solidMat);
    const shadow = new THREE.Mesh(actorShadowGeo, shadowMat);
    shadow.renderOrder = 1;
    group.add(body);
    group.userData = { x, y, body, geos, turn: 0, phase: Math.random() * 6 };
    return { group, shadow };
  };
  /** Face one of the four directions (swaps in the pre-built geometry). */
  const setTurn = (actor, turn) => {
    const u = actor.group.userData;
    if (u.turn === turn) return;
    u.turn = turn;
    u.body.geometry = u.geos[turn];
  };
  const disposeActor = (actor) => {
    for (const geo of actor.group.userData.geos) geo.dispose();
    mapGroup.remove(actor.group, actor.shadow);
  };

  function buildMap(id) {
    map = MAPS[id];
    disposeMesh(mapMesh);
    disposeMesh(mapShadows);
    disposeMesh(chestMesh);
    chestMesh = null;
    chestSig = -1;
    for (const a of npcActors) disposeActor(a);
    for (const a of bossActors) disposeActor(a);
    npcActors.length = 0;
    bossActors.length = 0;

    const g = new Geo();
    const sh = new Geo();
    const { tiles, width, height } = map;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const t = tiles[y][x];
        let c = TILE_COLORS[t.kind] || '#888888';
        if (t.kind === 'grass' && (x * 13 + y * 7) % 5 === 0) c = shade(c, 0.025);
        const e = t.elevation ?? 0;
        const wave = t.kind === 'water' ? [x * 1.7 + y, 0.055] : NO_WAVE;
        g.quad([x, e, y], [x + 1, e, y], [x + 1, e, y + 1], [x, e, y + 1], c, UP, wave);
        // Walls down to whatever is lower on the two sides the camera can see.
        const ex = x + 1 < width ? (tiles[y][x + 1].elevation ?? 0) : e > 0 ? 0 : e;
        if (ex < e) g.quad([x + 1, ex, y], [x + 1, ex, y + 1], [x + 1, e, y + 1], [x + 1, e, y], shade(c, -0.25), PX, wave);
        const ez = y + 1 < height ? (tiles[y + 1][x].elevation ?? 0) : e > 0 ? 0 : e;
        if (ez < e) g.quad([x, ez, y + 1], [x + 1, ez, y + 1], [x + 1, e, y + 1], [x, e, y + 1], shade(c, -0.38), PZ, wave);
      }
    }
    for (const p of map.props) addProp(g, sh, p, elevationAt(map, p.x, p.y));
    mapMesh = new THREE.Mesh(g.build(), mapMat);
    mapGroup.add(mapMesh);
    if (sh.faces.length) {
      mapShadows = new THREE.Mesh(sh.build(), shadowMat);
      mapShadows.renderOrder = 1;
      mapGroup.add(mapShadows);
    } else mapShadows = null;

    for (const n of map.npcs) {
      const a = makeActor({ color: n.color }, n.x, n.y);
      a.group.userData.npc = n;
      npcActors.push(a);
      mapGroup.add(a.group, a.shadow);
    }
    for (const b of map.bosses) {
      const e = ENEMIES[b.enemyId];
      const a = makeActor({ color: e.color, accent: e.accent }, b.x, b.y);
      a.group.userData.boss = b;
      bossActors.push(a);
      mapGroup.add(a.group, a.shadow);
    }
    for (const a of [...npcActors, ...bossActors]) {
      const { x, y } = a.group.userData;
      const e = elevationAt(map, x, y);
      a.group.position.set(x + 0.5, e, y + 0.5);
      a.shadow.position.set(x + 0.5, e, y + 0.5);
    }
  }

  function buildChests(opened) {
    disposeMesh(chestMesh);
    chestMesh = null;
    if (!map.chests.length) return;
    const g = new Geo();
    for (const c of map.chests) {
      const b = elevationAt(map, c.x, c.y);
      if (opened.includes(c.id)) g.box(c.x + 0.2, c.y + 0.2, 0.62, 0.62, 0.24, '#78523e', b);
      else {
        g.box(c.x + 0.17, c.y + 0.17, 0.66, 0.66, 0.48, '#b77435', b);
        g.box(c.x + 0.2, c.y + 0.2, 0.6, 0.6, 0.12, '#f0c251', b + 0.46);
      }
    }
    chestMesh = new THREE.Mesh(g.build(), solidMat);
    mapGroup.add(chestMesh);
  }

  // ---- hero
  const hero = makeActor({ color: '#447bd7', hero: true }, 7, 11);
  scene.add(hero.group, hero.shadow);
  const heroPos = { x: 7, y: 11, e: 0, mapId: null };

  // ---- combat stage
  const combatGroup = new THREE.Group();
  combatGroup.visible = false;
  scene.add(combatGroup);
  let arenaMesh = null;
  let enemyMesh = null;
  const enemyShadow = new THREE.Mesh(
    (() => {
      const g = new Geo();
      shadowDiamond(g, 0.5, 0.5, 2.8, 0.025);
      return g.build();
    })(),
    shadowMat,
  );
  enemyShadow.renderOrder = 1;
  combatGroup.add(enemyShadow);
  let combatKey = '';
  const fx = { flash: 0, shake: 0, dying: 0, camShake: 0, phase2: 0 };

  function buildCombat(enemyId, tint) {
    disposeMesh(arenaMesh);
    disposeMesh(enemyMesh);
    const g = new Geo();
    for (let z = -4; z <= 4; z += 1)
      for (let x = -4; x <= 4; x += 1) {
        const c = (x + z) % 2 === 0 ? shade(tint, 0.07) : tint;
        g.quad([x, 0, z], [x + 1, 0, z], [x + 1, 0, z + 1], [x, 0, z + 1], c, UP);
      }
    arenaMesh = new THREE.Mesh(g.build(), solidMat);
    combatGroup.add(arenaMesh);
    enemyMesh = new THREE.Mesh(enemyGeometry(ENEMIES[enemyId]), enemyMat);
    enemyMesh.renderOrder = 5;
    enemyMesh.frustumCulled = false;
    combatGroup.add(enemyMesh);
    fx.flash = fx.shake = fx.dying = 0;
    fx.phase2 = 0;
  }

  // ---- camera
  const target = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  let camReady = false;
  let zoomNow = 1;

  function fitCamera(zoom) {
    const W = kit.size.width;
    const H = kit.size.height;
    const tileWidth = Math.min(104, Math.max(54, W / 10.8)) * zoom;
    const px = tileWidth * R_SCALE;
    const py = tileWidth * U_SCALE;
    camera.left = -W / 2 / px;
    camera.right = W / 2 / px;
    camera.top = (0.54 * H) / py;
    camera.bottom = -(0.46 * H) / py;
    camera.updateProjectionMatrix();
  }

  const shakeOffset = new THREE.Vector3();

  function placeCamera(dt, reduced) {
    const k = reduced || !camReady ? 1 : 1 - Math.exp(-dt * 10);
    camTarget.lerp(target, k);
    camReady = true;
    shakeOffset.set(0, 0, 0);
    if (fx.camShake > 0 && !reduced) {
      const s = fx.camShake * 0.12;
      shakeOffset.set((Math.random() - 0.5) * s, 0, (Math.random() - 0.5) * s);
    }
    camera.position.copy(camTarget).add(shakeOffset).addScaledVector(BACK, 100);
    camera.lookAt(camTarget.x + shakeOffset.x, camTarget.y, camTarget.z + shakeOffset.z);
  }

  // ---- per-frame
  const world = {
    scene,
    camera,

    /** Snap the hero (and camera) to its tile, e.g. after loading or a warp. */
    snap() {
      heroPos.mapId = null;
      camReady = false;
      chestSig = -1;
    },

    /**
     * view: { mapId, x, y, facing, flags, openedChests, combat: { enemyId, phase } | null,
     *         reducedMotion, zoom, talkTo: npc id | null, title: bool }
     */
    update(dt, t, view) {
      waveAmp.value = view.reducedMotion ? 0 : 1;
      if (!map || map.id !== view.mapId) buildMap(view.mapId);
      // Chests only ever open, so the count says when to rebuild (a load or map change resets it).
      if (view.openedChests.length !== chestSig) {
        chestSig = view.openedChests.length;
        buildChests(view.openedChests);
      }
      const inCombat = !!view.combat;
      // Battles keep the original framing; the road uses the player's zoom.
      const wantZoom = inCombat ? 1 : view.zoom || 1;
      zoomNow = view.reducedMotion || !camReady ? wantZoom : zoomNow + (wantZoom - zoomNow) * (1 - Math.exp(-dt * 12));
      fitCamera(zoomNow);

      mapGroup.visible = !inCombat;
      hero.group.visible = hero.shadow.visible = !inCombat;
      combatGroup.visible = inCombat;
      const reduced = view.reducedMotion;

      if (inCombat) {
        const key = `${view.combat.enemyId}|${map.id}`;
        if (key !== combatKey) {
          combatKey = key;
          buildCombat(view.combat.enemyId, map.tint);
        }
        const bob = reduced ? 0 : Math.sin(t * 3) * 0.08;
        fx.flash = Math.max(0, fx.flash - dt * 5);
        fx.shake = Math.max(0, fx.shake - dt * 4);
        fx.camShake = Math.max(0, fx.camShake - dt * 3);
        if (view.combat.phase === 2) fx.phase2 = Math.min(1, fx.phase2 + dt * 2);
        enemyFlash.value = Math.max(fx.flash, fx.phase2 > 0 && !reduced ? 0.12 + Math.sin(t * 6) * 0.08 : 0);
        const shakeX = reduced ? 0 : Math.sin(t * 60) * 0.08 * fx.shake;
        if (fx.dying > 0) {
          fx.dying = Math.min(1, fx.dying + dt * 2.2);
          enemyFade.value = 1 - fx.dying;
          enemyMesh.position.set(shakeX, bob - fx.dying * 0.6, 0);
        } else {
          enemyFade.value = 1;
          enemyMesh.position.set(shakeX, bob, 0);
        }
        const grow = 1 + fx.phase2 * 0.08;
        enemyMesh.scale.set(grow, grow, grow);
        enemyMesh.position.x += 0.5 * (1 - grow);
        enemyMesh.position.z = 0.5 * (1 - grow);
        target.set(0.5, 0, 0.5);
        if (!camReady || combatGroup.userData.snapped !== key) {
          combatGroup.userData.snapped = key;
          camReady = false;
        }
        placeCamera(dt, reduced);
        return;
      }
      if (combatKey) camReady = false; // back from a battle: cut straight to the courier
      combatKey = '';
      combatGroup.userData.snapped = '';
      fx.camShake = Math.max(0, fx.camShake - dt * 3);

      // Bosses vanish once defeated.
      for (const a of bossActors) {
        const visible = !view.flags.includes(a.group.userData.boss.flag);
        a.group.visible = a.shadow.visible = visible;
      }

      // NPCs turn toward the courier while talking (south otherwise), and breathe a little.
      for (const a of npcActors) {
        const u = a.group.userData;
        setTurn(a, view.talkTo === u.npc.id ? turnToward(u.x, u.y, view.x, view.y) : TURN.south);
        const e = elevationAt(map, u.x, u.y);
        a.group.position.y = e + (reduced ? 0 : Math.max(0, Math.sin(t * 2.2 + u.phase)) * 0.012);
      }

      // Hero: glide from tile to tile with a small hop, like the old 0.2-per-frame lerp.
      const te = elevationAt(map, view.x, view.y);
      if (heroPos.mapId !== view.mapId || Math.abs(heroPos.x - view.x) > 3 || Math.abs(heroPos.y - view.y) > 3) {
        heroPos.x = view.x;
        heroPos.y = view.y;
        heroPos.e = te;
        heroPos.mapId = view.mapId;
        camReady = false;
      } else {
        const k = reduced ? 1 : 1 - Math.exp(-dt * 13.4);
        heroPos.x += (view.x - heroPos.x) * k;
        heroPos.y += (view.y - heroPos.y) * k;
        heroPos.e += (te - heroPos.e) * k;
      }
      setTurn(hero, TURN[view.facing] ?? TURN.north);
      const remaining = Math.min(1, Math.hypot(view.x - heroPos.x, view.y - heroPos.y));
      const hop = reduced ? 0 : Math.sin(remaining * Math.PI) * 0.1;
      const bob = reduced ? 0 : Math.sin(t * 8) * 0.018;
      hero.group.position.set(heroPos.x + 0.5, heroPos.e + bob + hop, heroPos.y + 0.5);
      hero.shadow.position.set(heroPos.x + 0.5, heroPos.e, heroPos.y + 0.5);

      // Camera: the title screen drifts slowly around Hearthglen.
      if (view.title && !reduced) target.set(heroPos.x + 0.5 + Math.sin(t * 0.13) * 1.6, 0, heroPos.y + 0.5 + Math.cos(t * 0.11) * 1.2);
      else target.set(heroPos.x + 0.5, heroPos.e, heroPos.y + 0.5);
      placeCamera(dt, reduced);
    },

    render() {
      kit.renderer.render(scene, camera);
    },

    // ---- feedback
    hitEnemy(strength = 1) {
      fx.flash = 0.85;
      fx.shake = Math.min(1.4, 0.8 * strength);
    },
    hitPlayer(strength = 1) {
      fx.camShake = Math.min(1.5, 0.8 * strength);
    },
    defeatEnemy() {
      fx.dying = 0.001;
      fx.flash = 1;
    },

    /** Screen position (CSS px) of a point above a tile, or null when off screen. */
    project(x, y, height = 0, out = { x: 0, y: 0 }) {
      if (!map) return null;
      const v = tmpV.set(x + 0.5, elevationAt(map, x, y) + height, y + 0.5).project(camera);
      if (v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) return null;
      out.x = (v.x * 0.5 + 0.5) * kit.size.width;
      out.y = (-v.y * 0.5 + 0.5) * kit.size.height;
      return out;
    },
    /** The combat enemy's screen position (for damage numbers). */
    enemyScreen(out = { x: 0, y: 0 }) {
      const v = tmpV.set(0.5, 1.6, 0.5).project(camera);
      out.x = (v.x * 0.5 + 0.5) * kit.size.width;
      out.y = (-v.y * 0.5 + 0.5) * kit.size.height;
      return out;
    },

    /** The tile under a canvas point (normalised device coords), or null. */
    pick(nx, ny) {
      if (!mapMesh || !mapGroup.visible) return null;
      ray.setFromCamera(tmpN.set(nx, ny), camera);
      const targets = [mapMesh];
      for (const a of [...npcActors, ...bossActors]) if (a.group.visible) targets.push(a.group.userData.body);
      if (chestMesh) targets.push(chestMesh);
      const hits = ray.intersectObjects(targets, false);
      if (!hits.length) return null;
      const h = hits[0];
      const actor = [...npcActors, ...bossActors].find((a) => a.group.userData.body === h.object);
      if (actor) return { x: actor.group.userData.x, y: actor.group.userData.y };
      const n = h.face?.normal ?? tmpV.set(0, 1, 0);
      const x = Math.floor(h.point.x - n.x * 0.02);
      const y = Math.floor(h.point.z - n.z * 0.02);
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
      return { x, y };
    },

    /** Build every material's pipeline up front (combat included) so the first battle does not hitch. */
    async warm() {
      buildMap('hearthglen');
      buildChests([]);
      buildCombat('dewdrop', MAPS.hearthglen.tint);
      combatGroup.visible = true;
      fitCamera(1);
      target.set(7.5, 0, 11.5);
      camReady = false;
      placeCamera(0, true);
      try {
        await kit.renderer.compileAsync(scene, camera);
      } catch {
        /* compiling ahead is only an optimisation */
      }
      combatGroup.visible = false;
      combatKey = '';
    },
  };
  const tmpV = new THREE.Vector3();
  const tmpN = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  return world;
}
