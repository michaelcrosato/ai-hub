// The world: the original low-poly geometry builder (now emitting three.js BufferGeometry),
// one texture atlas for every facade and sign, the hand-tuned shading as TSL materials,
// the ship, enemy and boss models, and the scrolling city and harbor backdrops.
//
// Shading matches the hand-written WebGL renderer: two fixed lights evaluated per vertex,
// a per-vertex emissive weight in the colour alpha, depth fog that spares emissive faces,
// no face culling, and raw (unmanaged) colours.

import * as THREE from 'three/webgpu';
import { attribute, uniform, texture, vec3, vec4, float, mix, smoothstep, saturate, dot, floor, sin, fract, step, positionLocal, positionView, positionWorld, modelWorldMatrix, modelPosition, normalLocal, varying } from 'three/tsl';
import { TAU, rand, rr, choice, rgb, shade } from './util.js';

// ---------------------------------------------------------------- small vector helpers
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const d = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / d, a[1] / d, a[2] / d];
};

// ---------------------------------------------------------------- the texture atlas
const PAD = 8;
let ATLAS = null; // { texture, rects: Map, white: [u, v] }

function facadeCanvas(index) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const t = c.getContext('2d');
  t.fillStyle = ['#152632', '#1e323d', '#283c44'][index % 3];
  t.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 2) {
    t.fillStyle = rand() < 0.5 ? 'rgba(4,13,19,.045)' : 'rgba(151,181,181,.024)';
    t.fillRect(0, y, 256, 1);
  }
  for (let x = 3; x < 244; x += 22) {
    t.fillStyle = 'rgba(4,15,21,.23)';
    t.fillRect(x, 0, 2, 512);
    for (let y = 12; y < 510; y += 18) {
      t.fillStyle = '#0f242e';
      t.fillRect(x + 4, y, 10, 8);
      if (rand() > 0.42) {
        t.fillStyle = choice(['#486d74', '#4e747b', '#667e7c', '#7c8772', '#957e62', '#426578']);
        t.globalAlpha = rr(0.55, 0.95);
        t.fillRect(x + 5, y + 1, 7, 5);
        if (rand() > 0.85) {
          t.fillStyle = '#8aafad';
          t.fillRect(x + 5, y + 1, 7, 1);
        }
        t.globalAlpha = 1;
      }
    }
  }
  for (let y = 93; y < 512; y += 100) {
    t.fillStyle = '#102630';
    t.fillRect(0, y, 256, 8);
    t.fillStyle = '#4b6268';
    t.fillRect(0, y, 256, 1);
    t.fillStyle = '#243b45';
    t.fillRect(0, y + 8, 256, 2);
  }
  const duct = index % 2 ? 225 : 25;
  t.fillStyle = '#1c303a';
  t.fillRect(duct, 0, 15, 512);
  t.fillStyle = '#42575d';
  t.fillRect(duct, 0, 2, 512);
  for (let y = 35; y < 512; y += 61) {
    t.fillStyle = '#2b414a';
    t.fillRect(duct - 5, y, 23, 17);
    for (let j = 2; j < 14; j += 3) {
      t.fillStyle = '#122932';
      t.fillRect(duct - 2, y + j, 17, 1);
    }
  }
  if (index % 3 === 0) {
    t.fillStyle = '#428c8b';
    t.fillRect(252, 0, 2, 512);
    t.fillStyle = '#78d6c6';
    for (let y = 10; y < 500; y += 40) t.fillRect(252, y, 2, 17);
  }
  return c;
}

function signCanvas(words, fg, bg, vertical = false, subtitle = 'LOW CITY  /  AFTER DARK') {
  const c = document.createElement('canvas');
  c.width = vertical ? 128 : 512;
  c.height = vertical ? 512 : 192;
  const t = c.getContext('2d');
  t.fillStyle = bg;
  t.fillRect(0, 0, c.width, c.height);
  t.globalAlpha = 0.18;
  t.strokeStyle = fg;
  for (let y = 0; y < c.height; y += 8) {
    t.beginPath();
    t.moveTo(0, y);
    t.lineTo(c.width, y);
    t.stroke();
  }
  t.globalAlpha = 1;
  t.strokeStyle = fg;
  t.lineWidth = 4;
  t.strokeRect(7, 7, c.width - 14, c.height - 14);
  t.fillStyle = fg;
  t.textAlign = 'center';
  t.textBaseline = 'middle';
  if (vertical) {
    t.font = 'bold 78px Arial';
    words.split('').forEach((w, i) => t.fillText(w, c.width / 2, 70 + i * 95));
  } else {
    t.font = 'italic 900 75px Arial';
    t.fillText(words, c.width / 2, 86, c.width - 36);
    t.font = '17px monospace';
    t.fillText(subtitle, c.width / 2, 149);
  }
  return c;
}

/** Corrugated container side: grey ridges that the vertex colour tints. */
function ridgeCanvas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const t = c.getContext('2d');
  t.fillStyle = '#d4d4d4';
  t.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 8) {
    t.fillStyle = '#9c9c9c';
    t.fillRect(x, 0, 3, 128);
    t.fillStyle = '#f2f2f2';
    t.fillRect(x + 3, 0, 1, 128);
  }
  t.fillStyle = '#6f6f6f';
  t.fillRect(0, 0, 256, 7);
  t.fillRect(0, 121, 256, 7);
  t.fillRect(0, 0, 6, 128);
  t.fillRect(250, 0, 6, 128);
  t.fillStyle = '#ffffff';
  t.fillRect(22, 30, 64, 22);
  t.fillStyle = '#7c7c7c';
  t.font = 'bold 15px monospace';
  t.fillText('NCO 0915', 25, 46);
  return c;
}

function moonCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const t = c.getContext('2d');
  const gr = t.createRadialGradient(128, 128, 10, 128, 128, 125);
  gr.addColorStop(0, '#bed4d28f');
  gr.addColorStop(0.19, '#a2bbbbaa');
  gr.addColorStop(0.22, '#6e929477');
  gr.addColorStop(0.34, '#4b72772f');
  gr.addColorStop(1, '#19374900');
  t.fillStyle = gr;
  t.fillRect(0, 0, 256, 256);
  return c;
}

/**
 * Build the atlas. Facades come first so the shared random stream is consumed in the
 * same order as before (the skyline stays identical). Each image gets an 8 px border
 * copied from its own edge, so mipmaps never bleed one sign into the next.
 */
export function buildAtlas() {
  const items = [];
  const add = (key, canvas) => items.push({ key, canvas });
  for (let i = 0; i < 9; i++) add('facade' + i, facadeCanvas(i));
  add('NO SIGNAL', signCanvas('NO SIGNAL', '#e87769', '#261e2a'));
  add('LOW CITY', signCanvas('LOW CITY', '#8be9db', '#10353f'));
  add('NIGHT CO.', signCanvas('NIGHT CO.', '#e8b890', '#32322f'));
  add('09', signCanvas('09', '#bbc6e7', '#202e4a'));
  add('OPEN', signCanvas('OPEN', '#e98172', '#341c25', true));
  add('HUSH', signCanvas('HUSH', '#77cdc3', '#132d35', true));
  add('CHECKPOINT 09', signCanvas('CHECKPOINT 09', '#dfb496', '#253439'));
  add('serial09', signCanvas('09', '#c9ccb8', '#465760'));
  add('CHANNEL 04', signCanvas('CHANNEL 04', '#e9c27f', '#2a2f2c', false, 'HARBOR LINE  /  NIGHT SHIFT'));
  add('DREDGE 4', signCanvas('DREDGE 4', '#ffd08f', '#3a3027', false, 'HARBOR LINE  /  NIGHT SHIFT'));
  add('BERTH', signCanvas('BERTH', '#7fd6e0', '#12303a', true));
  add('TIDE', signCanvas('TIDE', '#ef9d82', '#331f22', true));
  add('ridge', ridgeCanvas());
  const white = document.createElement('canvas');
  white.width = white.height = 32;
  const wt = white.getContext('2d');
  wt.fillStyle = '#ffffff';
  wt.fillRect(0, 0, 32, 32);
  add('white', white);

  // Shelf packing, tallest first (stable for equal heights).
  const W = 2048;
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => b.canvas.height - a.canvas.height || a.i - b.i);
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const it of order) {
    const w = it.canvas.width + PAD * 2;
    const h = it.canvas.height + PAD * 2;
    if (x + w > W) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    it.x = x;
    it.y = y;
    x += w;
    rowH = Math.max(rowH, h);
  }
  const H = Math.ceil((y + rowH) / 256) * 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const rects = new Map();
  for (const it of order) {
    const s = it.canvas;
    const w = s.width;
    const h = s.height;
    const X = it.x + PAD;
    const Y = it.y + PAD;
    ctx.drawImage(s, X, Y);
    // Edge extrusion: left, right, top, bottom, then the four corners.
    ctx.drawImage(s, 0, 0, 1, h, X - PAD, Y, PAD, h);
    ctx.drawImage(s, w - 1, 0, 1, h, X + w, Y, PAD, h);
    ctx.drawImage(s, 0, 0, w, 1, X, Y - PAD, w, PAD);
    ctx.drawImage(s, 0, h - 1, w, 1, X, Y + h, w, PAD);
    ctx.drawImage(s, 0, 0, 1, 1, X - PAD, Y - PAD, PAD, PAD);
    ctx.drawImage(s, w - 1, 0, 1, 1, X + w, Y - PAD, PAD, PAD);
    ctx.drawImage(s, 0, h - 1, 1, 1, X - PAD, Y + h, PAD, PAD);
    ctx.drawImage(s, w - 1, h - 1, 1, 1, X + w, Y + h, PAD, PAD);
    // three.js textures flip Y on upload: v = 1 is the top row of the canvas.
    rects.set(it.key, { u0: X / W, u1: (X + w) / W, v0: 1 - Y / H, v1: 1 - (Y + h) / H });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  const wr = rects.get('white');
  ATLAS = { texture: tex, rects, white: [(wr.u0 + wr.u1) / 2, (wr.v0 + wr.v1) / 2] };

  const moon = new THREE.CanvasTexture(moonCanvas());
  moon.colorSpace = THREE.NoColorSpace;
  return { atlas: ATLAS, moon };
}

export const rect = (key) => ATLAS.rects.get(key);

// ---------------------------------------------------------------- geometry builder
/**
 * The original builder, unchanged in shape: triangles with a face normal, a colour with
 * its emissive weight, and uvs. `origin` offsets everything emitted after it (to merge
 * many props into one mesh), `texRect` maps uvs into the atlas, and wrap-enabled builders
 * also record each prop's scroll pivot so the GPU can wrap it like the old per-node code.
 */
export class Geo {
  constructor({ wrap = false } = {}) {
    this.P = [];
    this.N = [];
    this.Cc = [];
    this.U = [];
    this.Wr = wrap ? [] : null;
    this.o = [0, 0, 0];
    this.tex = null;
    this.wrapV = [0, 0, 0];
  }
  origin(x, y, z) {
    this.o = [x, y, z];
    return this;
  }
  wrap(pivot, lo, period) {
    this.wrapV = [pivot, lo, period];
    return this;
  }
  texRect(r) {
    this.tex = r || null;
    return this;
  }
  tri(a, b, c, col = '#ffffff', em = 0, uv) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    const co = rgb(col);
    const ps = [a, b, c];
    const r = this.tex;
    const wv = ATLAS ? ATLAS.white : [0, 0];
    for (let i = 0; i < 3; i++) {
      const p = ps[i];
      this.P.push(p[0] + this.o[0], p[1] + this.o[1], p[2] + this.o[2]);
      this.N.push(n[0], n[1], n[2]);
      this.Cc.push(co[0], co[1], co[2], em);
      if (r) {
        const u = uv ? uv[i][0] : 0;
        const v = uv ? uv[i][1] : 0;
        this.U.push(r.u0 + u * (r.u1 - r.u0), r.v0 + v * (r.v1 - r.v0));
      } else this.U.push(wv[0], wv[1]);
      if (this.Wr) this.Wr.push(this.wrapV[0], this.wrapV[1], this.wrapV[2]);
    }
    return this;
  }
  quad(a, b, c, d, col, em = 0) {
    this.tri(a, b, c, col, em, [[0, 1], [1, 1], [1, 0]]);
    this.tri(a, c, d, col, em, [[0, 1], [1, 0], [0, 0]]);
    return this;
  }
  box(x, y, z, w, h, d, col, em = 0) {
    const a = x - w / 2, b = x + w / 2, c = y - h / 2, e = y + h / 2, f = z - d / 2, g = z + d / 2;
    this.quad([a, c, g], [b, c, g], [b, e, g], [a, e, g], col, em);
    this.quad([b, c, f], [a, c, f], [a, e, f], [b, e, f], shade(col, 0.75), em);
    this.quad([a, e, g], [b, e, g], [b, e, f], [a, e, f], shade(col, 1.13), em);
    this.quad([a, c, f], [b, c, f], [b, c, g], [a, c, g], shade(col, 0.62), em);
    this.quad([a, c, f], [a, c, g], [a, e, g], [a, e, f], shade(col, 0.82), em);
    this.quad([b, c, g], [b, c, f], [b, e, f], [b, e, g], shade(col, 0.95), em);
    return this;
  }
  extrude(points, d, col, z = 0) {
    const n = points.length;
    const front = points.map((p) => [p[0], p[1], z + d / 2]);
    const back = points.map((p) => [p[0], p[1], z - d / 2]);
    for (let i = 1; i < n - 1; i++) {
      this.tri(front[0], front[i], front[i + 1], col);
      this.tri(back[0], back[i + 1], back[i], shade(col, 0.7));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.quad(back[i], back[j], front[j], front[i], shade(col, 0.88));
    }
    return this;
  }
  cylinder(x, y, z, len, r, col, segments = 8, r2 = r, axis = 'x', em = 0) {
    const pos = (along, ang, rad) => (axis === 'x' ? [x + along, y + Math.cos(ang) * rad, z + Math.sin(ang) * rad] : [x + Math.cos(ang) * rad, y + along, z + Math.sin(ang) * rad]);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU, b = ((i + 1) / segments) * TAU;
      const p = pos(-len / 2, a, r), q = pos(-len / 2, b, r), s = pos(len / 2, b, r2), t = pos(len / 2, a, r2);
      this.quad(p, q, s, t, col, em);
      this.tri(pos(-len / 2, 0, 0), q, p, shade(col, 0.65), em);
      this.tri(pos(len / 2, 0, 0), t, s, shade(col, 1.1), em);
    }
    return this;
  }
  hull(rings, col, segments = 6) {
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      for (let j = 0; j < segments; j++) {
        const t = (j / segments) * TAU, u = ((j + 1) / segments) * TAU;
        this.quad(
          [a[0], Math.sin(t) * a[1] + (a[3] || 0), Math.cos(t) * a[2]],
          [b[0], Math.sin(t) * b[1] + (b[3] || 0), Math.cos(t) * b[2]],
          [b[0], Math.sin(u) * b[1] + (b[3] || 0), Math.cos(u) * b[2]],
          [a[0], Math.sin(u) * a[1] + (a[3] || 0), Math.cos(u) * a[2]],
          col
        );
      }
    }
    return this;
  }
  /** A flat textured panel (the old signNode), centred at (x, y, z) facing +z. */
  sign(x, y, z, w, h, key, em = 0.8) {
    const prev = this.tex;
    this.tex = rect(key);
    this.quad([x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z], '#ffffff', em);
    this.tex = prev;
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.Cc, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    if (this.Wr) g.setAttribute('aWrap', new THREE.Float32BufferAttribute(this.Wr, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------- materials
/** Fog and animation uniforms shared by every world material. */
export const U = {
  fog: uniform(new THREE.Color(0.035, 0.066, 0.097)),
  fogNear: uniform(28),
  fogFar: uniform(105),
  time: uniform(0),
  water: uniform(0),
};

const L1 = norm([-0.35, 0.85, 1]);
const L2 = norm([0.6, 0.3, -1]);

/** Per-vertex light: ambient .36 + key .64 + rim .20, pushed towards 1.22 by the emissive weight. */
function litColor(col) {
  const n = modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz.normalize();
  const light = float(0.36)
    .add(dot(n, vec3(L1[0], L1[1], L1[2])).max(0).mul(0.64))
    .add(dot(n, vec3(L2[0], L2[1], L2[2])).max(0).mul(0.2));
  return varying(col.xyz.mul(mix(light, float(1.22), saturate(col.w))), 'vLit');
}

/** Scroll wrap on the GPU: each prop jumps back by one period once its pivot leaves [lo, lo + period). */
function wrapPosition() {
  const w = attribute('aWrap', 'vec3');
  const pivot = w.x.add(modelPosition.x);
  const rel = pivot.sub(w.y);
  const wrapped = rel.sub(w.z.mul(floor(rel.div(w.z)))).add(w.y);
  return positionLocal.add(vec3(wrapped.sub(pivot), 0, 0));
}

function worldMaterial({ map, wrap = false, tint = null, transparent = false, name = 'world' }) {
  const m = new THREE.MeshBasicNodeMaterial({ side: transparent ? THREE.FrontSide : THREE.DoubleSide, transparent, depthWrite: !transparent });
  m.fog = false;
  m.name = name;
  if (wrap) m.positionNode = wrapPosition();
  const col = attribute('color', 'vec4');
  const tex = texture(map);
  let c = litColor(col).mul(tex.rgb);
  if (tint) c = c.mul(vec3(tint[0], tint[1], tint[2]));
  const fogF = smoothstep(U.fogNear, U.fogFar, positionView.z.negate()).mul(float(1).sub(saturate(col.w).mul(0.3)));
  m.colorNode = vec4(mix(c, U.fog, fogF), tex.a);
  if (transparent) m.alphaTest = 0.05;
  return m;
}

/** Harbor water: dark swell with glints and the reflected columns of dock and city lights. */
function waterMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  m.fog = false;
  m.name = 'water';
  const x = positionWorld.x.add(U.water);
  const z = positionWorld.z;
  const r1 = sin(x.mul(0.8).add(z.mul(2.6)).add(U.time.mul(1.6)));
  const r2 = sin(x.mul(0.31).sub(z.mul(1.3)).sub(U.time.mul(0.7)));
  const ripple = r1.mul(r2);
  const glint = smoothstep(0.55, 0.97, ripple);
  const column = sin(x.mul(0.21)).mul(0.5).add(0.5).pow(14);
  const hue = mix(vec3(0.42, 0.86, 0.78), vec3(0.98, 0.74, 0.46), step(0.5, fract(x.mul(0.0215))));
  const col = vec3(0.026, 0.06, 0.078).add(hue.mul(glint.mul(0.16).add(column.mul(glint.add(0.25)).mul(0.42))));
  const fogF = smoothstep(U.fogNear, U.fogFar, positionView.z.negate());
  m.colorNode = vec4(mix(col, U.fog, fogF), 1);
  return m;
}

export const MAT = {};
export function makeMaterials(atlasTex, moonTex) {
  MAT.wrap = worldMaterial({ map: atlasTex, wrap: true, name: 'city' });
  MAT.plain = worldMaterial({ map: atlasTex, name: 'actor' });
  MAT.flash = worldMaterial({ map: atlasTex, tint: [2.1, 1.6, 1.25], name: 'flash' });
  MAT.moon = worldMaterial({ map: moonTex, transparent: true, name: 'moon' });
  MAT.water = waterMaterial();
  return MAT;
}

export const mesh = (geo, mat = MAT.plain) => {
  const m = new THREE.Mesh(geo, mat);
  m.matrixAutoUpdate = true;
  return m;
};

// ---------------------------------------------------------------- models
const geoCache = new Map();
const cached = (key, build) => {
  let g = geoCache.get(key);
  if (!g) {
    g = build();
    geoCache.set(key, g);
  }
  return g;
};

export function gunGeo(type) {
  return cached('gun' + type, () => {
    const g = new Geo();
    if (type === 'RIVET') {
      g.box(-0.25, 0, 0, 1.3, 0.48, 0.48, '#889593');
      g.box(-0.37, 0, 0.28, 0.58, 0.34, 0.12, '#e3bd7e');
      g.cylinder(0.65, 0, 0, 1.05, 0.22, '#3c515b', 8);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        g.cylinder(0.88, Math.sin(a) * 0.18, Math.cos(a) * 0.18, 1.03, 0.066, '#adbcb9', 6);
      }
      g.cylinder(1.25, 0, 0, 0.12, 0.28, '#5d7379', 8);
      g.box(-0.78, 0, 0, 0.3, 0.56, 0.52, '#425863');
    } else if (type === 'RAIL') {
      g.box(-0.3, 0, 0, 1.2, 0.48, 0.52, '#b0bbbc');
      g.box(0.65, 0, 0, 1.65, 0.25, 0.34, '#364e63');
      g.box(0.65, 0.17, 0, 1.6, 0.1, 0.38, '#8baebd');
      g.box(0.6, 0, 0.21, 1.5, 0.07, 0.04, '#75e9f2', 1);
      g.box(0.6, -0.17, 0, 1.6, 0.1, 0.38, '#5f7d95');
      g.box(-0.4, 0, 0.3, 0.25, 0.32, 0.04, '#7bd4e7', 1);
    } else if (type === 'SCATTER') {
      g.box(-0.25, 0, 0, 1.15, 0.56, 0.6, '#94a08a');
      for (let i = 0; i < 3; i++) g.cylinder(0.55, -0.17 + i * 0.17, 0, 0.7, 0.085, '#33463f', 6);
      g.box(0.95, 0, 0, 0.18, 0.64, 0.52, '#5f7360');
      g.box(-0.3, 0.12, 0.31, 0.62, 0.1, 0.04, '#c9f27a', 1);
      g.box(-0.3, -0.12, 0.31, 0.62, 0.1, 0.04, '#c9f27a', 1);
      g.box(-0.75, 0, 0, 0.28, 0.6, 0.62, '#46594f');
    } else {
      g.box(-0.05, 0, 0, 1.9, 0.65, 0.65, '#7a8999');
      for (let i = 0; i < 3; i++) {
        g.cylinder(0.82, -0.2 + i * 0.2, 0.3, 0.16, 0.075, '#262f46', 6);
        g.box(-0.3, -0.2 + i * 0.2, 0.36, 0.7, 0.06, 0.03, '#b6b4ef', 1);
      }
      g.box(-0.4, 0.38, 0, 0.75, 0.15, 0.58, '#adacb7');
      g.box(-0.4, -0.38, 0, 0.75, 0.15, 0.58, '#475967');
    }
    return g.geometry();
  });
}

export function repairGeo() {
  return cached('repair', () =>
    new Geo().box(0, 0, 0, 0.6, 0.6, 0.6, '#83e5c2', 0.5).box(0, 0, 0.32, 0.4, 0.12, 0.04, '#effff2', 1).box(0, 0, 0.33, 0.12, 0.4, 0.04, '#effff2', 1).geometry()
  );
}

export function shipModel() {
  const ship = new THREE.Group();
  ship.name = 'magpie';
  const g = new Geo();
  g.hull([[-1.75, 0.25, 0.32], [-1.25, 0.52, 0.5], [0.15, 0.43, 0.54], [1.35, 0.27, 0.33], [2.4, 0.055, 0.1]], '#93a6af', 6);
  g.extrude([[-1.4, 0.28], [-0.55, 1.13], [0.1, 1.02], [0.74, 0.4]], 0.18, '#c6d1d0', -0.17);
  g.extrude([[-0.4, 0.46], [0.05, 0.85], [0.8, 0.7], [1.1, 0.32]], 0.41, '#243e4a', 0.2);
  g.extrude([[-0.2, 0.49], [0.16, 0.76], [0.74, 0.62], [0.87, 0.42]], 0.026, '#7ce8d7', 0.435);
  g.extrude([[-1.5, -0.3], [-1.9, -0.97], [-0.7, -0.7], [0.4, -0.25]], 0.25, '#597689', -0.65);
  g.extrude([[-1.58, -0.25], [-1.7, -0.68], [0.5, -0.48], [1.3, -0.06]], 0.22, '#bdd0d1', 0.65);
  g.box(-0.52, -0.18, 0.86, 0.7, 0.15, 0.19, '#d4a86b');
  g.box(-0.18, 0.16, 0.535, 0.34, 0.1, 0.015, '#233f4c');
  g.box(0.4, 0.12, 0.52, 0.18, 0.08, 0.03, '#e5c589');
  g.cylinder(-1.55, -0.1, -0.48, 0.95, 0.31, '#405667', 8);
  g.cylinder(-1.9, -0.1, -0.48, 0.1, 0.23, '#91eaff', 8, undefined, 'x', 1);
  g.cylinder(-1.54, -0.18, 0.51, 0.75, 0.24, '#637b8b', 8);
  g.cylinder(-1.92, -0.18, 0.51, 0.1, 0.18, '#9cffff', 8, undefined, 'x', 1);
  g.box(-0.72, 0.3, 0.52, 0.4, 0.14, 0.08, '#4b6372');
  g.box(-0.73, 0.31, 0.57, 0.27, 0.055, 0.025, '#c9d5ca');
  g.box(0.35, 0.15, 0.545, 0.7, 0.018, 0.024, '#243d4e');
  g.box(1.25, 0.17, 0.29, 0.6, 0.07, 0.08, '#5d7180');
  for (let i = 0; i < 4; i++) {
    g.box(-1.17 + i * 0.17, -0.06, 0.57, 0.075, 0.24, 0.025, '#2c4352');
    g.box(-0.55 + i * 0.28, -0.29, 0.78, 0.075, 0.07, 0.025, '#ebd7ac');
  }
  g.quad([-0.2, 0.49, 0.452], [0.87, 0.42, 0.452], [0.74, 0.62, 0.452], [0.16, 0.76, 0.452], '#7ce8d7', 0.25);
  g.box(0.8, -0.2, 0.32, 1.45, 0.09, 0.1, '#354c5d');
  g.cylinder(1.82, -0.16, 0.3, 0.7, 0.065, '#d1e1df', 6);
  ship.add(mesh(g.geometry()));
  const arm = new THREE.Group();
  arm.position.set(-0.38, -0.34, 0.25);
  ship.add(arm);
  const ag = new Geo();
  ag.cylinder(0, 0, 0, 0.38, 0.21, '#d0b079', 8);
  ag.extrude([[-0.12, 0], [0.14, -0.04], [0.32, -0.65], [0.12, -0.82], [-0.06, -0.63]], 0.16, '#778e9b');
  ag.cylinder(0.2, -0.7, 0, 0.26, 0.17, '#baa274', 8);
  ag.extrude([[0.11, -0.66], [0.29, -0.62], [0.85, -1.03], [0.76, -1.17], [0.42, -1.01]], 0.16, '#526d7c');
  ag.box(0.75, -1.08, 0, 0.28, 0.2, 0.32, '#c4c9bf');
  arm.add(mesh(ag.geometry()));
  const gun = mesh(gunGeo('RIVET'));
  gun.position.set(0.82, -1.28, 0.06);
  arm.add(gun);
  ship.userData.arm = arm;
  ship.userData.gun = gun;
  return ship;
}

export function enemyGeo(type) {
  return cached('enemy' + type, () => {
    const g = new Geo();
    if (type === 'dart' || type === 'interceptor') {
      g.hull([[-1.4, 0.02, 0.05], [-0.25, 0.35, 0.4], [0.65, 0.32, 0.46], [1.0, 0.2, 0.22]], type === 'dart' ? '#747685' : '#496d7c', 5);
      g.extrude([[-0.65, 0.15], [0.28, 0.8], [0.9, 0.64], [0.4, 0.12]], 0.18, '#454d64', -0.32);
      g.extrude([[-0.6, -0.1], [0.3, -0.7], [0.85, -0.55], [0.4, -0.05]], 0.16, '#687a85', 0.33);
      g.box(-0.59, 0.13, 0.28, 0.52, 0.1, 0.05, '#ff8b6a', 1);
      g.cylinder(0.88, 0, 0, 0.21, 0.19, '#fea276', 8, undefined, 'x', 1);
      g.cylinder(-0.9, -0.22, 0.25, 0.6, 0.065, '#b0b9b5', 6);
    } else if (type === 'carrier') {
      g.hull([[-1.9, 0.2, 0.4], [-1.2, 0.55, 0.85], [0.8, 0.55, 0.82], [1.55, 0.32, 0.42]], '#77868c', 6);
      g.box(-0.5, 0.25, 0.8, 0.7, 0.19, 0.12, '#e9a980', 1);
      g.box(0.15, 0, 0.85, 0.14, 0.45, 0.1, '#384f5b');
      g.box(0.63, 0, 0.85, 0.14, 0.45, 0.1, '#384f5b');
      g.box(0.35, 0.65, 0, 1.5, 0.2, 0.9, '#444f69');
      g.cylinder(1.55, 0, 0.42, 0.4, 0.29, '#53506a', 8);
      g.cylinder(1.8, 0, 0.42, 0.1, 0.21, '#de8792', 8, undefined, 'x', 1);
      g.box(-0.1, -0.85, 0.3, 0.25, 0.65, 0.25, '#b6a082');
    } else if (type === 'turret') {
      g.box(0, -0.5, 0, 1.6, 0.65, 1.4, '#344955');
      g.box(0, -0.16, 0, 1.25, 0.3, 1.2, '#798384');
      g.cylinder(0, 0.15, 0, 0.7, 0.48, '#a69a83', 8, undefined, 'y');
      g.box(-0.5, 0.38, 0.2, 1.2, 0.23, 0.27, '#607584');
      g.cylinder(-1.15, 0.38, 0.2, 0.4, 0.17, '#c3c1af', 8);
      g.box(-0.2, 0.35, 0.55, 0.25, 0.15, 0.06, '#ef986c', 1);
      g.box(0, -0.57, 0.77, 0.8, 0.12, 0.08, '#d0aa72');
    } else if (type === 'sentry') {
      g.cylinder(0, 0, 0, 0.65, 0.56, '#737e87', 8, undefined, 'x');
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU, px = Math.cos(a) * 0.8, py = Math.sin(a) * 0.8;
        g.box(px, py, 0, 0.3, 0.4, 0.65, '#4e6178');
        g.box(px, py, 0.36, 0.15, 0.19, 0.06, '#fba382', 1);
      }
      g.box(-0.36, 0, 0.26, 0.4, 0.26, 0.3, '#f37c5c', 1);
    } else if (type === 'lancer') {
      // A needle that telegraphs its lane, then charges down it.
      g.extrude([[-1.7, 0], [-0.3, 0.26], [1.1, 0.3], [1.35, 0], [1.1, -0.3], [-0.3, -0.26]], 0.5, '#5b6f7f');
      g.extrude([[0.1, 0.25], [0.85, 0.95], [1.2, 0.85], [0.85, 0.25]], 0.12, '#3f4f63', 0.12);
      g.extrude([[0.1, -0.25], [0.85, -0.95], [1.2, -0.85], [0.85, -0.25]], 0.12, '#56687a', 0.12);
      g.box(-1.35, 0, 0.27, 0.55, 0.1, 0.05, '#ff8b6a', 1);
      g.box(0.2, 0.1, 0.27, 0.5, 0.08, 0.04, '#d6be85');
      g.cylinder(1.38, 0, 0, 0.24, 0.2, '#fea276', 8, undefined, 'x', 1);
    } else if (type === 'minelayer') {
      g.hull([[-1.6, 0.25, 0.4], [-0.9, 0.72, 0.9], [0.9, 0.72, 0.9], [1.55, 0.35, 0.45]], '#6c7670', 6);
      g.box(0.05, -0.82, 0, 1.3, 0.36, 0.95, '#3c4a52');
      g.box(-0.15, -0.6, 0.5, 1.0, 0.12, 0.05, '#ffc07d', 0.8);
      g.box(0.4, 0.7, 0, 1.2, 0.18, 0.7, '#46535c');
      g.box(-0.7, 0.2, 0.86, 0.4, 0.16, 0.06, '#ef986c', 1);
      g.cylinder(1.55, 0, 0, 0.36, 0.27, '#4e5a5e', 8);
      g.cylinder(1.78, 0, 0, 0.1, 0.2, '#fea276', 8, undefined, 'x', 1);
    } else if (type === 'mine') {
      g.cylinder(0, 0, 0, 0.62, 0.36, '#4c5a63', 8, undefined, 'x');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        g.box(Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0, 0.14, 0.14, 0.4, '#8c9a96');
      }
      g.box(0, 0, 0.33, 0.24, 0.24, 0.06, '#ff7359', 1);
    }
    return g.geometry();
  });
}

export function miniModel() {
  const n = mesh(cached('mini', miniGeo));
  n.userData.parts = [];
  n.userData.flash = [n];
  for (const y of [-1.65, 1.65]) {
    const p = mesh(gunGeo('RIVET'));
    p.position.set(-1.75, y, 0.8);
    p.rotation.y = Math.PI;
    p.scale.setScalar(1.15);
    n.add(p);
    n.userData.parts.push(p);
  }
  return n;
}

function miniGeo() {
  const g = new Geo();
  g.hull([[-3.4, 0.4, 0.4], [-2.2, 1.3, 1.15], [1.8, 1.45, 1.2], [3.2, 0.7, 0.7]], '#64787f', 8);
  g.box(-1.8, 0.2, 1.14, 1.1, 0.47, 0.16, '#ff9969', 1);
  g.box(0.4, 1.35, 0, 2.8, 0.24, 1.8, '#374756');
  g.box(1.3, 0.2, 1.23, 0.17, 1.15, 0.12, '#aab2a7');
  g.box(1.7, 0.2, 1.23, 0.17, 1.15, 0.12, '#aab2a7');
  g.box(0.3, -1.7, 0, 3, 0.55, 1.45, '#435768');
  g.box(-1, -1.45, 0.6, 0.3, 1, 0.35, '#a59a7b');
  g.box(1.6, -1.45, 0.6, 0.3, 1, 0.35, '#a59a7b');
  g.cylinder(3.15, 0, 0, 1.0, 0.66, '#3d5462', 8);
  g.cylinder(3.7, 0, 0, 0.16, 0.5, '#85d7fa', 8, undefined, 'x', 1);
  return g.geometry();
}

export function walkerModel() {
  const n = new THREE.Group();
  const body = mesh(cached('walker', walkerGeo));
  n.add(body);
  n.userData.parts = [];
  n.userData.flash = [body];
  for (let i = 0; i < 2; i++) {
    const p = mesh(gunGeo(i ? 'SWARM' : 'RAIL'));
    p.position.set(-1.7, i ? -2.0 : 3.0, 1.1);
    p.rotation.y = Math.PI;
    p.scale.setScalar(1.65);
    n.add(p);
    n.userData.parts.push(p);
  }
  n.userData.legs = [];
  for (let i = 0; i < 2; i++) {
    const leg = new THREE.Group();
    leg.position.set(i ? 1.1 : -0.8, -1.6, i ? -0.55 : 0.75);
    const lm = mesh(cached('walkerLeg', walkerLegGeo));
    leg.add(lm);
    n.add(leg);
    n.userData.legs.push(leg);
    n.userData.flash.push(lm);
  }
  return n;
}

function walkerGeo() {
  const g = new Geo();
  g.extrude([[-1.7, -2.25], [-2.55, -0.7], [-2.4, 1.7], [-1.4, 3.1], [1.65, 2.7], [2.6, 1], [1.9, -1.9]], 2.0, '#8b8a7c');
  g.extrude([[-2.55, 0.6], [-3.25, 1.2], [-2.8, 2.4], [-1.35, 2.75], [-0.85, 1.95], [-1.5, 0.6]], 1.0, '#435970', 1.1);
  g.box(-2.6, 1.52, 1.62, 1.1, 0.28, 0.08, '#ff9c69', 1);
  g.box(-0.85, -0.1, 1.07, 1.0, 1.2, 0.3, '#2d434d');
  g.cylinder(-0.86, -0.1, 1.35, 0.6, 0.46, '#eb9b67', 8, undefined, 'x', 1);
  g.box(1.4, 0.1, 1.14, 0.45, 3.25, 0.25, '#3b505c');
  g.box(0.5, 2.9, 0, 2.6, 0.38, 1.9, '#3c4d5e');
  g.box(1.7, 3.5, -0.3, 0.1, 1.25, 0.1, '#8c9a96');
  g.box(1.7, 4.1, -0.3, 0.2, 0.15, 0.2, '#ff7965', 1);
  for (let y = -1.1; y < 2; y += 0.55) g.box(0.7, y, 1.3, 0.7, 0.12, 0.09, '#495c5f');
  g.box(-1.1, -1.3, 1.28, 0.65, 0.19, 0.06, '#ddbd7c');
  g.extrude([[-1.6, 2.4], [-0.6, 2.8], [0.3, 2.1], [0.1, 0.7], [-0.3, 0.5], [-0.7, 1.7]], 0.28, '#adb19e', 1.08);
  g.extrude([[0.15, -0.8], [1.1, -0.65], [1.5, -1.5], [0.8, -2.05], [-0.2, -1.8]], 0.3, '#697f87', 1.08);
  for (let i = 0; i < 4; i++) {
    g.box(0.25 + i * 0.27, 2.48, 1.15, 0.11, 0.18, 0.12, i % 2 ? '#263e4d' : '#e2be82');
    g.box(1.56, -1.08 + i * 0.7, 1.32, 0.11, 0.11, 0.08, '#d0c9ac');
  }
  g.box(-0.64, 0.4, 1.34, 0.11, 0.14, 0.06, '#e7c282');
  g.box(-0.64, -0.64, 1.34, 0.11, 0.14, 0.06, '#e7c282');
  g.sign(0.39, 1.24, 1.33, 0.92, 0.52, 'serial09');
  return g.geometry();
}

function walkerLegGeo() {
  const lg = new Geo();
  lg.cylinder(0, 0, 0, 0.7, 0.55, '#304c5a', 8);
  lg.extrude([[-0.3, 0.1], [0.38, -0.1], [1.25, -2.35], [0.65, -2.65], [0.15, -1.8]], 0.58, '#a0a08b');
  lg.cylinder(0.94, -2.5, 0, 0.75, 0.42, '#425665', 8);
  lg.extrude([[0.7, -2.5], [1.12, -2.75], [-0.15, -5.1], [-0.8, -5.0]], 0.48, '#657c8a');
  lg.extrude([[-0.75, -4.95], [-0.1, -5.06], [0.1, -5.5], [-2.0, -5.5], [-2.2, -5.23]], 0.9, '#4a5e6c');
  lg.box(0.66, -1.12, 0.32, 0.27, 0.75, 0.07, '#d6be85');
  return lg.geometry();
}

/** BREAKWATER, the harbor route's boss: a dredge barge with a crane hook that swings. */
export function dredgeModel() {
  const n = new THREE.Group();
  const body = mesh(cached('dredge', dredgeGeo));
  n.add(body);
  // The hook hangs from the boom tip and swings in front of the barge.
  const pivot = new THREE.Group();
  pivot.position.set(-4.6, 3.2, 0);
  pivot.add(mesh(cached('dredgeHook', hookGeo)));
  n.add(pivot);
  n.userData.hook = pivot;
  n.userData.parts = [];
  n.userData.flash = [body];
  const guns = [['SCATTER', -3.1, -0.55, 1.05, 1.4], ['SWARM', -1.9, 1.55, 0.95, 1.25]];
  for (const [type, x, y, z, s] of guns) {
    const p = mesh(gunGeo(type));
    p.position.set(x, y, z);
    p.rotation.y = Math.PI;
    p.scale.setScalar(s);
    n.add(p);
    n.userData.parts.push(p);
  }
  return n;
}

function dredgeGeo() {
  const g = new Geo();
  g.hull([[-3.8, 0.5, 0.7], [-3.0, 1.25, 1.35], [2.6, 1.35, 1.45], [3.7, 0.8, 0.85]], '#566a70', 8);
  g.box(0.4, -1.3, 0, 6.4, 0.6, 2.2, '#3b4a52');
  g.box(-2.2, -0.15, 1.38, 1.6, 0.32, 0.08, '#ff9969', 1);
  g.box(1.6, -0.15, 1.44, 1.2, 0.22, 0.06, '#e9a980', 0.8);
  for (let i = 0; i < 5; i++) g.box(-1.2 + i * 0.55, -0.85, 1.25, 0.32, 0.12, 0.06, i % 2 ? '#26383f' : '#d6be85');
  g.box(1.4, 1.55, 0, 2.4, 1.3, 1.7, '#3e5160');
  g.box(1.0, 1.7, 0.88, 1.4, 0.26, 0.06, '#ffc07d', 1);
  g.box(2.3, 2.5, 0, 0.5, 0.7, 0.5, '#2d3b44');
  g.box(2.3, 2.9, 0, 0.62, 0.12, 0.62, '#ff7965', 1);
  g.box(-0.5, 2.8, 0, 0.55, 3.0, 0.55, '#9a8452');
  g.box(-0.5, 4.3, 0, 0.9, 0.4, 0.9, '#7d6c44');
  g.extrude([[-0.5, 4.45], [-0.5, 4.05], [-4.7, 3.1], [-4.7, 3.45]], 0.4, '#a8935c');
  g.box(-2.6, 3.85, 0.22, 3.2, 0.06, 0.04, '#ffc07d', 0.6);
  g.cylinder(3.8, -0.2, 0.6, 0.5, 0.34, '#3d5462', 8);
  g.cylinder(4.1, -0.2, 0.6, 0.12, 0.26, '#85d7fa', 8, undefined, 'x', 1);
  g.cylinder(3.8, -0.2, -0.6, 0.5, 0.34, '#3d5462', 8);
  g.cylinder(4.1, -0.2, -0.6, 0.12, 0.26, '#85d7fa', 8, undefined, 'x', 1);
  g.sign(0.2, 0.3, 1.46, 1.7, 0.64, 'DREDGE 4');
  return g.geometry();
}

function hookGeo() {
  const hg = new Geo();
  hg.box(0, -1.6, 0, 0.07, 3.2, 0.07, '#8c9a96');
  hg.box(0, -3.15, 0, 0.7, 0.35, 0.5, '#46594f');
  hg.extrude([[-0.4, -3.3], [0.4, -3.3], [0.3, -3.65], [0.55, -4.0], [0, -4.45], [-0.55, -4.0], [-0.25, -3.75]], 0.35, '#c4c9bf');
  hg.box(0, -4.25, 0.2, 0.2, 0.12, 0.06, '#ff7359', 1);
  return hg.geometry();
}

// ---------------------------------------------------------------- backdrops
/**
 * Build both routes' scenery. Returns scroll groups (mesh + rate + wrap) and the pieces
 * that switch with the route or the sector. Generation order matches the original, so
 * the city's random layout is the same skyline as before.
 */
export function buildScenery(scene) {
  const scroll = [];
  const addScroll = (geo, rate, lo, period, group) => {
    const m = mesh(geo, MAT.wrap);
    m.frustumCulled = false;
    m.name = 'scenery';
    group.add(m);
    const s = { mesh: m, rate, lo, period, off: 0 };
    scroll.push(s);
    return s;
  };
  const common = new THREE.Group();
  const city = new THREE.Group();
  const harbor = new THREE.Group();
  scene.add(common, city, harbor);

  // Sky and moon.
  const sky = new Geo().quad([-170, -80, -110], [170, -80, -110], [170, 95, -110], [-170, 95, -110], '#0c1a29', 1);
  common.add(mesh(sky.geometry()));
  const moonG = new Geo();
  moonG.tex = { u0: 0, u1: 1, v0: 1, v1: 0 };
  moonG.quad([-21, -21, 0], [21, -21, 0], [21, 21, 0], [-21, 21, 0], '#ffffff', 0.8);
  const moon = mesh(moonG.geometry(), MAT.moon);
  moon.position.set(25, 28, -105);
  common.add(moon);

  // Three building layers. Layers 0 and 1 belong to both routes; layer 2 is the lower city.
  const wraps = [240, 190, 158];
  const layers = [new Geo({ wrap: true }), new Geo({ wrap: true }), new Geo({ wrap: true })];
  const front = [];
  const createBuilding = (x, z, w, h, d, layer, index) => {
    const g = layers[layer];
    const period = wraps[layer];
    g.origin(x, 0, z).wrap(x, -period / 2, period);
    const baseY = -14;
    const body = layer === 0 ? '#162633' : layer === 1 ? '#213541' : '#30444b';
    g.box(0, baseY + h / 2, 0, w, h, d, body);
    g.box(0, baseY + h + 0.14, 0, w + 0.28, 0.3, d + 0.2, '#33434c');
    g.box(w * 0.18, baseY + h + 0.75, -0.3, w * 0.32, 1.3, d * 0.48, '#233540');
    for (let i = 0; i < 4; i++) g.box(-w / 2 + 0.09, baseY + ((i + 0.5) * h) / 4, d / 2 + 0.05, 0.12, 0.1, d * 0.01, layer === 2 ? '#79c4ce' : '#355863', 0.6);
    if (index % 3 === 0) {
      g.box(w * 0.3, baseY + h + 1.8, 0, 0.08, 2.4, 0.08, '#51636a');
      g.box(w * 0.3, baseY + h + 3, 0, 0.18, 0.12, 0.18, '#ef786d', 1);
    }
    if (layer === 2) {
      g.box(0, baseY + 4.2, d / 2 + 0.12, w + 0.3, 0.25, 0.25, '#485355');
      for (let i = 0; i < 3; i++) g.box(w / 2 - 0.6, baseY + 4 + i * 2, d / 2 + 0.26, 1.8, 0.15, 0.5, '#424f55');
    }
    g.sign(0, baseY + h / 2, d / 2 + 0.025, w - 0.12, h - 0.16, 'facade' + ((index % 3) * 3 + layer));
    if (layer === 2 && index % 2 === 0) {
      // Vertical signs get the vertical artwork (the old code stretched horizontal signs onto some).
      const vertical = index % 4 === 0;
      const key = vertical ? (index % 8 === 4 ? 'OPEN' : 'HUSH') : ['NO SIGNAL', 'LOW CITY', 'NIGHT CO.', '09', 'OPEN', 'HUSH'][index % 6];
      g.sign(vertical ? -w / 2 - 0.7 : 0, baseY + h * 0.62, d / 2 + 0.12, vertical ? 1.9 : w * 0.85, vertical ? 7.6 : 3.2, key);
    }
    if (layer === 2) front.push({ pivot: x, z, period });
  };
  for (let i = 0; i < 22; i++) createBuilding(-115 + i * 11, -57 - rr(0, 8), rr(5, 9), rr(15, 43), rr(4, 8), 0, i);
  for (let i = 0; i < 17; i++) createBuilding(-90 + i * 11.5, -31 - rr(0, 10), rr(5, 9), rr(15, 34), rr(3, 6), 1, i);
  for (let i = 0; i < 10; i++) createBuilding(-73 + i * 16, -14 - rr(0, 4), rr(8, 12), rr(12, 26), rr(3, 5), 2, i);
  addScroll(layers[0].geometry(), 0.42, -120, 240, common);
  addScroll(layers[1].geometry(), 1.0, -95, 190, common);
  const L2 = addScroll(layers[2].geometry(), 1.9, -79, 158, city);

  // Wet viaduct with maintenance bays and warm warning lights.
  const road = new Geo({ wrap: true });
  for (let i = 0; i < 13; i++) {
    const x = -65 + i * 10;
    road.origin(x, 0, 0).wrap(x, -65, 130);
    road.box(0, -10.7, -1, 10, 0.75, 9, '#3d494d');
    road.box(0, -10.23, 2.5, 10, 0.12, 0.25, '#7b8583');
    road.box(0, -10.8, 3.8, 10, 1, 0.22, '#26383f');
    road.box(0, -10.4, 3.95, 9, 0.07, 0.05, '#8caaa4', 0.4);
    for (let j = 0; j < 6; j++) {
      road.box(-4.5 + j * 1.7, -10.8, 3.96, 0.75, 0.14, 0.04, j % 2 ? '#bc9664' : '#1d2d35', j % 2 ? 0.3 : 0);
      road.box(-4 + j * 1.7, -10.18, -1, 0.5, 0.025, 4, '#536467');
    }
    road.box(0, -13.2, 0, 1.5, 4.5, 3, '#273a43');
    road.box(2.7, -9.9, -4.2, 0.1, 1.3, 0.13, '#547482');
    road.box(2.7, -9.25, -4.2, 0.26, 0.15, 0.3, '#efbe82', 1);
  }
  addScroll(road.geometry(), 4.6 / 2.4, -65, 130, city);

  // Overhead wires.
  const decor = new Geo({ wrap: true });
  for (let i = 0; i < 7; i++) {
    const x = -75 + i * 25;
    decor.origin(x, 0, -5).wrap(x, -88, 175);
    decor.box(0, 12.9, -2, 0.35, 2, 0.5, '#233845');
    decor.box(0, 12, -2, 21, 0.35, 0.5, '#2f4653');
    decor.box(0, 11.5, -2, 21, 0.07, 0.09, '#406773');
    for (let k = -9; k < 10; k += 3) decor.box(k, 11.95, -1.7, 1.1, 0.18, 0.11, '#527779', 0.2);
  }
  addScroll(decor.geometry(), 1, -88, 175, city);

  // Flying traffic (drawn as lights by the effects layer).
  const traffic = [];
  for (let i = 0; i < 17; i++) traffic.push({ x: rr(-55, 55), y: rr(-3, 22), z: rr(-45, -18), speed: rr(2, 6), c: rand() < 0.7 ? '#7399a9' : '#d78c74' });

  // Sector 02 of the city: the freight line.
  const fg = new Geo({ wrap: true });
  for (let i = 0; i < 4; i++) {
    const x0 = -70 + i * 40;
    fg.origin(x0, 0, 0).wrap(x0, -90, 160);
    fg.box(0, 1, -7, 0.72, 24, 1.8, '#394c57');
    fg.box(0, 10, -7, 27, 1.0, 1.8, '#41565e');
    fg.box(0, 8.8, -7, 27, 0.15, 0.25, '#738073');
    for (let x = -12; x < 13; x += 3) {
      fg.extrude([[x, 9.5], [x + 0.22, 9.5], [x + 2.2, 7.8], [x + 2, 7.8]], 0.15, '#697975', -6.2);
      fg.box(x, 9.15, -5.9, 0.75, 0.16, 0.07, '#e1ac71', 0.5);
    }
    fg.box(0, -3, -7, 2.4, 1.4, 2.4, '#687a7c');
    fg.box(0, -3, -5.72, 1.7, 0.2, 0.07, '#e7b779', 0.8);
  }
  const freight = addScroll(fg.geometry(), 2.2, -90, 160, city);
  freight.mesh.visible = false;

  // Sector 03 of the city: the checkpoint gate.
  const gateG = new Geo();
  gateG.box(-16, 0, 0, 2, 24, 3, '#43525b').box(15, 0, 0, 2, 24, 3, '#43525b').box(0, 11, 0, 33, 2, 3, '#556168');
  for (let i = -14; i < 15; i += 2) gateG.box(i, 10.2, 1.6, 1.0, 0.17, 0.07, '#e49c72', 0.9);
  gateG.sign(5, 10, 1.56, 10, 2.1, 'CHECKPOINT 09');
  const gate = mesh(gateG.geometry());
  gate.position.set(5, 0, -11);
  gate.visible = false;
  city.add(gate);

  // ---------------- the harbor line (new route)
  const water = mesh(new Geo().quad([-160, -12.2, 3], [160, -12.2, 3], [160, -12.2, -70], [-160, -12.2, -70], '#ffffff').geometry(), MAT.water);
  water.frustumCulled = false;
  harbor.add(water);

  // Quay with containers, bollards and lamps, at the viaduct's height and speed.
  const quay = new Geo({ wrap: true });
  const lamps = [];
  const boxColors = ['#7a4a3c', '#2f5f63', '#2d3f5c', '#8a6a3a', '#5b4b6b', '#476650'];
  for (let i = 0; i < 13; i++) {
    const x = -65 + i * 10;
    quay.origin(x, 0, 0).wrap(x, -65, 130);
    quay.box(0, -10.7, -1, 10, 0.75, 9, '#3a4649');
    quay.box(0, -11.6, 3.5, 10, 1.8, 0.3, '#27363b');
    quay.box(0, -10.27, 3.3, 10, 0.1, 0.2, '#bc9664', 0.3);
    quay.cylinder(-3, -10.05, 2.6, 0.5, 0.22, '#2c3a40', 8, undefined, 'y');
    quay.cylinder(3, -10.05, 2.6, 0.5, 0.22, '#2c3a40', 8, undefined, 'y');
    if (i % 3 !== 1) {
      quay.texRect(rect('ridge'));
      quay.box(i % 2 ? 1.2 : -1.4, -9.1, -2.9, 6, 2.4, 2.4, boxColors[i % boxColors.length]);
      if (i % 4 === 0) quay.box(-0.8, -9.1, -6.6, 6, 2.4, 2.4, boxColors[(i + 3) % boxColors.length]);
      if (i % 4 === 0) quay.box(-0.8, -6.7, -6.6, 6, 2.4, 2.4, boxColors[(i + 1) % boxColors.length]);
      quay.texRect(null);
    }
    if (i % 2 === 0) {
      quay.box(4.2, -9.0, 1.8, 0.12, 2.6, 0.12, '#547482');
      quay.box(4.2, -7.7, 1.8, 0.3, 0.16, 0.34, '#efbe82', 1);
      lamps.push({ pivot: x, dx: 4.2, y: -7.7, z: 1.8, period: 130, lo: -65 });
    }
  }
  const quayScroll = addScroll(quay.geometry(), 4.6 / 2.4, -65, 130, harbor);

  // Gantry cranes against the skyline.
  const cranes = new Geo({ wrap: true });
  for (let i = 0; i < 5; i++) {
    const x = -90 + i * 38;
    cranes.origin(x, 0, -24).wrap(x, -95, 190);
    cranes.box(-4, -1, 0, 0.8, 26, 0.8, '#3c4d5e');
    cranes.box(4, -1, 0, 0.8, 26, 0.8, '#3c4d5e');
    cranes.box(0, 9, 0, 9.6, 0.8, 0.8, '#45586a');
    cranes.box(-5, 12.4, 0, 24, 0.9, 1.1, '#9a8452');
    cranes.box(-5, 11.8, 0.6, 22, 0.08, 0.06, '#ffc07d', 0.5);
    cranes.box(2.4, 13.9, 0, 4, 2.2, 2.4, '#5d6a63');
    cranes.box(2.4, 13.9, 1.22, 2.6, 0.4, 0.05, '#e9c98a', 0.9);
    cranes.box(-12, 7.6, 0, 0.06, 9, 0.06, '#8c9a96');
    cranes.box(-12, 3.0, 0, 3, 0.5, 1.2, '#7d6c44');
    cranes.box(-16.8, 12.4, 0, 0.3, 0.3, 0.3, '#ff7965', 1);
    cranes.box(4, 12.4 + 1.6, 0, 0.3, 0.3, 0.3, '#ff7965', 1);
    cranes.sign(-4, -2, 0.42, 0.7, 2.8, i % 2 ? 'BERTH' : 'TIDE', 0.6);
  }
  addScroll(cranes.geometry(), 1.0, -95, 190, harbor);

  // Freighters moored at the far wall.
  const ships = new Geo({ wrap: true });
  for (let i = 0; i < 3; i++) {
    const x = -100 + i * 80;
    ships.origin(x, 0, -46).wrap(x, -120, 240);
    ships.box(0, -10.4, 0, 30, 4.2, 6, '#1b2a32');
    ships.box(-11, -7.4, 0, 6, 2.0, 5, '#22333d');
    ships.box(-11, -5.8, 0, 4, 1.4, 4, '#2a3d48');
    for (let k = 0; k < 4; k++) ships.box(-12.6 + k * 1.1, -7.3, 2.52, 0.5, 0.3, 0.05, '#e9c98a', 1);
    for (let k = 0; k < 5; k++) ships.box(-5 + k * 3.6, -7.6, 0, 3.2, 1.6, 4.6, boxColors[(i + k) % boxColors.length]);
    ships.box(13, -6.0, 0, 0.3, 6, 0.3, '#33434c');
    ships.box(13, -2.9, 0, 0.3, 0.3, 0.3, '#ff7965', 1);
  }
  addScroll(ships.geometry(), 0.42, -120, 240, harbor);

  // Sector 02 of the harbor: the breakwater wall with its lamps.
  const wallG = new Geo({ wrap: true });
  for (let i = 0; i < 7; i++) {
    const x = -75 + i * 25;
    wallG.origin(x, 0, -9).wrap(x, -88, 175);
    wallG.box(0, -9.6, 0, 25, 3.2, 2.2, '#3d494d');
    wallG.box(0, -8.0, 1.12, 25, 0.12, 0.06, '#bc9664', 0.3);
    for (let k = -10; k < 12; k += 6.5) {
      wallG.box(k, -6.4, 0, 0.14, 3.2, 0.14, '#547482');
      wallG.box(k, -4.8, 0, 0.36, 0.18, 0.36, '#efbe82', 1);
    }
  }
  const wall = addScroll(wallG.geometry(), 1, -88, 175, harbor);
  wall.mesh.visible = false;

  // Sector 03 of the harbor: the channel gate.
  const gate2G = new Geo();
  gate2G.box(-16, 0, 0, 2.4, 24, 3, '#3b4f57').box(15, 0, 0, 2.4, 24, 3, '#3b4f57').box(0, 11, 0, 33, 2, 3, '#4f5e57');
  for (let i = -14; i < 15; i += 2) gate2G.box(i, 10.2, 1.6, 1.0, 0.17, 0.07, '#ffc07d', 0.9);
  gate2G.sign(-5, 10, 1.56, 10, 2.1, 'CHANNEL 04');
  const gate2 = mesh(gate2G.geometry());
  gate2.position.set(5, 0, -11);
  gate2.visible = false;
  harbor.add(gate2);

  return { scroll, common, city, harbor, freight: freight.mesh, gate, wall: wall.mesh, gate2, front, L2, quay: quayScroll, lamps, traffic, water };
}
