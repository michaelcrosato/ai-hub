/* GUNHAND — the three.js side.
   The play field is 1440 × 810 game units seen by an orthographic camera (game y runs
   down, world Y = −y). Crafts are real meshes built from the faceted models, lit in a
   node material with the original's light direction, ambient and clamp. The painted
   city sits on textured planes far behind; 2D effects (shots, glows, sparks, rings,
   labels) are triangle batches in their own depth layers, so the painter order of the
   original holds. Everything renders through kit/post.js, which adds the hit and EMP
   flashes. */

import * as THREE from 'three/webgpu';
import { attribute, uniform, vec3, vec4, float, dot, clamp, mix, normalView, texture, uv, screenUV, length } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { buildTheme, buildRoadTiles, buildAtlas } from './scenery.js';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ colours */

const colorCache = new Map();
/** '#rgb', '#rrggbb' or '#rrggbbaa' → [r, g, b, a] in 0…1 (raw sRGB values, like Canvas2D). */
export function col(str) {
  let c = colorCache.get(str);
  if (c) return c;
  let h = String(str).replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
  c = new Float32Array([
    parseInt(h.substr(0, 2), 16) / 255,
    parseInt(h.substr(2, 2), 16) / 255,
    parseInt(h.substr(4, 2), 16) / 255,
    h.length >= 8 ? parseInt(h.substr(6, 2), 16) / 255 : 1,
  ]);
  colorCache.set(str, c);
  return c;
}

const tintCache = new Map();
function tint(str) {
  if (!str) return null;
  let t = tintCache.get(str);
  if (!t) {
    const c = col(str);
    t = new THREE.Color(c[0], c[1], c[2]);
    tintCache.set(str, t);
  }
  return t;
}

/* ------------------------------------------------------------------ geometry */

function orient(a, b, c, n) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  return cx * n[0] + cy * n[1] + cz * n[2] < 0 ? [a, c, b] : [a, b, c];
}

/** Polygon → triangles wound like the face normal (concave outlines included). */
function triangulate(f) {
  const v = f.v, n = f.n;
  if (v.length < 3) return [];
  if (v.length === 3) return [orient(v[0], v[1], v[2], n)];
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  let i = 0, j = 1;
  if (ax >= ay && ax >= az) {
    i = 1;
    j = 2;
  } else if (ay >= az) {
    i = 0;
    j = 2;
  }
  const contour = v.map((p) => new THREE.Vector2(p[i], p[j]));
  let idx = [];
  try {
    idx = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    idx = [];
  }
  if (!idx.length) for (let k = 1; k < v.length - 1; k++) idx.push([0, k, k + 1]);
  return idx.map((t) => orient(v[t[0]], v[t[1]], v[t[2]], n));
}

/** Flat faces → one non-indexed geometry: position, face normal, colour, glow flag. */
function modelGeometry(faces) {
  const lists = faces.map(triangulate);
  let count = 0;
  for (const l of lists) count += l.length * 3;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const rgb = new Float32Array(count * 3);
  const em = new Float32Array(count);
  let k = 0;
  faces.forEach((f, fi) => {
    for (const tri of lists[fi]) {
      for (const p of tri) {
        pos[k * 3] = p[0];
        pos[k * 3 + 1] = p[1];
        pos[k * 3 + 2] = p[2];
        nor[k * 3] = f.n[0];
        nor[k * 3 + 1] = f.n[1];
        nor[k * 3 + 2] = f.n[2];
        rgb[k * 3] = f.c[0] / 255;
        rgb[k * 3 + 1] = f.c[1] / 255;
        rgb[k * 3 + 2] = f.c[2] / 255;
        em[k] = f.em ? 1 : 0;
        k++;
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('mcol', new THREE.BufferAttribute(rgb, 3));
  g.setAttribute('emis', new THREE.BufferAttribute(em, 1));
  g.computeBoundingSphere();
  return g;
}

/* ------------------------------------------------------------------ effect batches */

/**
 * A triangle list rebuilt every frame, in game coordinates (y down), tinted per vertex
 * over the white atlas. Canvas-like helpers: lines are quads, circles and glows are
 * textured sprites, labels are glyph quads.
 */
class Batch {
  constructor(cap, material, z, order, atlas) {
    this.cap = cap;
    this.atlas = atlas;
    this.pos = new Float32Array(cap * 3);
    this.uvs = new Float32Array(cap * 2);
    this.rgba = new Float32Array(cap * 4);
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aUv = new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.rgba, 4).setUsage(THREE.DynamicDrawUsage);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.aPos);
    g.setAttribute('uv', this.aUv);
    g.setAttribute('rgba', this.aCol);
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.position.z = z;
    this.mesh.renderOrder = order;
    this.mesh.visible = false;
    this.n = 0;
    /** Like ctx.globalAlpha: multiplies everything drawn until reset. */
    this.alpha = 1;
    this.wu = atlas.white[0];
    this.wv = atlas.white[1];
  }

  begin() {
    this.n = 0;
    this.alpha = 1;
  }

  end() {
    const n = this.n;
    this.geo.setDrawRange(0, n);
    this.mesh.visible = n > 0;
    if (!n) return;
    this.aPos.clearUpdateRanges();
    this.aPos.addUpdateRange(0, n * 3);
    this.aPos.needsUpdate = true;
    this.aUv.clearUpdateRanges();
    this.aUv.addUpdateRange(0, n * 2);
    this.aUv.needsUpdate = true;
    this.aCol.clearUpdateRanges();
    this.aCol.addUpdateRange(0, n * 4);
    this.aCol.needsUpdate = true;
  }

  v(x, y, u, w, r, g, b, a) {
    const n = this.n;
    const p = n * 3, q = n * 2, s = n * 4;
    this.pos[p] = x;
    this.pos[p + 1] = -y;
    this.pos[p + 2] = 0;
    this.uvs[q] = u;
    this.uvs[q + 1] = w;
    this.rgba[s] = r;
    this.rgba[s + 1] = g;
    this.rgba[s + 2] = b;
    this.rgba[s + 3] = a;
    this.n = n + 1;
  }

  tri(x1, y1, x2, y2, x3, y3, c, a = 1) {
    const A = c[3] * a * this.alpha;
    if (A <= 0.001 || this.n + 3 > this.cap) return;
    const u = this.wu, w = this.wv;
    this.v(x1, y1, u, w, c[0], c[1], c[2], A);
    this.v(x2, y2, u, w, c[0], c[1], c[2], A);
    this.v(x3, y3, u, w, c[0], c[1], c[2], A);
  }

  /** A triangle with its own colour and alpha at each corner (gradients). */
  triC(x1, y1, c1, a1, x2, y2, c2, a2, x3, y3, c3, a3) {
    if (this.n + 3 > this.cap) return;
    const u = this.wu, w = this.wv, k = this.alpha;
    this.v(x1, y1, u, w, c1[0], c1[1], c1[2], c1[3] * a1 * k);
    this.v(x2, y2, u, w, c2[0], c2[1], c2[2], c2[3] * a2 * k);
    this.v(x3, y3, u, w, c3[0], c3[1], c3[2], c3[3] * a3 * k);
  }

  quad(x1, y1, x2, y2, x3, y3, x4, y4, c, a = 1) {
    this.tri(x1, y1, x2, y2, x3, y3, c, a);
    this.tri(x1, y1, x3, y3, x4, y4, c, a);
  }

  rect(x, y, w, h, c, a = 1) {
    this.quad(x, y, x + w, y, x + w, y + h, x, y + h, c, a);
  }

  line(x1, y1, x2, y2, c, width = 1, a = 1) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const nx = (-dy / len) * width * 0.5, ny = (dx / len) * width * 0.5;
    this.quad(x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny, c, a);
  }

  /** Convex polygon from a flat [x0, y0, x1, y1, …] list. */
  poly(pts, c, a = 1) {
    for (let i = 2; i + 3 < pts.length; i += 2) this.tri(pts[0], pts[1], pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c, a);
  }

  sprite(x0, y0, x1, y1, r, c, a = 1) {
    const A = c[3] * a * this.alpha;
    if (A <= 0.001 || this.n + 6 > this.cap) return;
    const s = this.atlas.size;
    const u0 = r[0] / s, v0 = r[1] / s, u1 = r[2] / s, v1 = r[3] / s;
    this.v(x0, y0, u0, v0, c[0], c[1], c[2], A);
    this.v(x1, y0, u1, v0, c[0], c[1], c[2], A);
    this.v(x1, y1, u1, v1, c[0], c[1], c[2], A);
    this.v(x0, y0, u0, v0, c[0], c[1], c[2], A);
    this.v(x1, y1, u1, v1, c[0], c[1], c[2], A);
    this.v(x0, y1, u0, v1, c[0], c[1], c[2], A);
  }

  circle(x, y, r, c, a = 1) {
    if (r > 0) this.sprite(x - r, y - r, x + r, y + r, this.atlas.disc, c, a);
  }

  /** The original's radial-gradient glow: full colour at the centre, clear at r. */
  glow(x, y, r, c, a = 1) {
    if (r > 0) this.sprite(x - r, y - r, x + r, y + r, this.atlas.glow, c, a);
  }

  /** Stroked arc (angles like Canvas2D: clockwise on screen). */
  arc(x, y, r, a0, a1, c, width = 1, a = 1) {
    const ro = r + width / 2, ri = Math.max(0, r - width / 2);
    const span = a1 - a0;
    const N = Math.max(8, Math.min(120, Math.ceil((Math.abs(span) * r) / 6)));
    let ca = Math.cos(a0), sa = Math.sin(a0);
    for (let i = 1; i <= N; i++) {
      const t = a0 + (span * i) / N;
      const cb = Math.cos(t), sb = Math.sin(t);
      this.quad(x + ca * ro, y + sa * ro, x + cb * ro, y + sb * ro, x + cb * ri, y + sb * ri, x + ca * ri, y + sa * ri, c, a);
      ca = cb;
      sa = sb;
    }
  }

  ring(x, y, r, c, width = 1, a = 1) {
    this.arc(x, y, r, 0, TAU, c, width, a);
  }

  /** Stroked ellipse, optionally dashed (dash and gap in game units along the rim). */
  ellipse(x, y, rx, ry, rot, c, width = 1, a = 1, dash = 0, gap = 0) {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const N = 64;
    let px = x + cr * rx, py = y + sr * rx, run = 0;
    for (let i = 1; i <= N; i++) {
      const t = (TAU * i) / N, ex = Math.cos(t) * rx, ey = Math.sin(t) * ry;
      const qx = x + cr * ex - sr * ey, qy = y + sr * ex + cr * ey;
      const seg = Math.hypot(qx - px, qy - py);
      if (!dash || run % (dash + gap) < dash) this.line(px, py, qx, qy, c, width, a);
      run += seg;
      px = qx;
      py = qy;
    }
  }

  /** Monospace label; y is the baseline, like ctx.fillText. */
  text(str, x, y, size, c, align = 'left', a = 1) {
    const at = this.atlas;
    const k = size / at.font, adv = at.adv * k;
    let px = align === 'center' ? x - (str.length * adv) / 2 : align === 'right' ? x - str.length * adv : x;
    const top = y - at.base * k, bottom = top + at.ch * k;
    for (const ch of str) {
      if (ch !== ' ') {
        const g = at.glyphs.get(ch) || at.glyphs.get('?');
        if (g) this.sprite(px - at.pad * k, top, px - at.pad * k + at.cw * k, bottom, g.uv, c, a);
      }
      px += adv;
    }
  }
}

/* ------------------------------------------------------------------ the scene */

/** Painter-order depth layers for effects: [z, renderOrder]. */
const LAYERS = {
  enemyBack: [-650, 100],
  bossDecal: [-860, 102],
  enemyFront: [-300, 104],
  pickBack: [-60, 106],
  pickFront: [60, 108],
  shots: [150, 110],
  title: [300, 111],
  playerBack: [400, 112],
  playerFront: [620, 114],
  fx: [900, 116],
};
const CAPS = {
  enemyBack: [600, 3000],
  bossDecal: [300, 60],
  enemyFront: [6000, 3000],
  pickBack: [3000, 600],
  pickFront: [3000, 300],
  shots: [600, 24000],
  title: [3000, 300],
  playerBack: [60, 600],
  playerFront: [1500, 600],
  fx: [24000, 24000],
};

/** Depth of each family of meshes (the orthographic camera only uses z for ordering). */
export const Z = { enemy: -500, boss: -900, pickup: 0, player: 500 };
/** Render order for see-through (blinking or faded) meshes, between their effect layers. */
export const ORDER = { pickup: 107, player: 113 };

export function createGfx(kit, { W, H, models }) {
  const renderer = kit.renderer;
  // Canvas colours are raw sRGB values: keep them as they are, like the original canvas did.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b161e);
  const camera = new THREE.OrthographicCamera(0, W, 0, -H, 10, 8000);
  camera.position.set(0, 0, 4000);

  // Keep the whole 1440 × 810 field in view and centred; a window of another shape sees more city.
  const view = { x0: 0, y0: 0, w: W, h: H, cssW: 1, cssH: 1 };
  kit.onResize((w, h) => {
    view.cssW = w;
    view.cssH = h;
    const a = w / h, base = W / H;
    if (a >= base) {
      view.w = H * a;
      view.h = H;
      view.x0 = -(view.w - W) / 2;
      view.y0 = 0;
    } else {
      view.w = W;
      view.h = W / a;
      view.x0 = 0;
      view.y0 = -(view.h - H) / 2;
    }
    camera.left = view.x0;
    camera.right = view.x0 + view.w;
    camera.top = -view.y0;
    camera.bottom = -(view.y0 + view.h);
    camera.updateProjectionMatrix();
  });

  /* ---- textures */
  const makeTex = (canvas, { repeat = false, mips = true } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    t.flipY = false; // uv (0,0) is the top-left of every painted canvas
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = mips;
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  };

  const atlas = buildAtlas();
  for (const [, g] of atlas.glyphs) g.uv = [g.x, g.y, g.x + atlas.cw, g.y + atlas.ch];
  const atlasTex = makeTex(atlas.canvas);
  const tiles = buildRoadTiles();
  const roadTex = makeTex(tiles.road, { repeat: true });
  const postTex = makeTex(tiles.posts, { repeat: true });

  /* ---- background planes, far to near */
  const planeGeo = new THREE.BufferGeometry();
  planeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, -1, 0, 0, -1, 0]), 3));
  planeGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  planeGeo.setIndex([0, 3, 2, 0, 2, 1]);
  planeGeo.computeBoundingSphere();

  let bgOrder = 0;
  let bgZ = -3400;
  const _pm = new THREE.Matrix4();
  const plane = (tex, opacity = 1) => {
    const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const off = uniform(new THREE.Vector2(0, 0));
    const rep = uniform(new THREE.Vector2(1, 1));
    const op = uniform(opacity);
    const node = texture(tex, uv().mul(rep).add(off));
    material.colorNode = vec4(node.xyz, node.w.mul(op));
    const mesh = new THREE.Mesh(planeGeo, material);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = bgOrder++;
    const z = (bgZ += 12);
    scene.add(mesh);
    return {
      mesh,
      node,
      off,
      rep,
      op,
      place(x0, y0, w, h) {
        _pm.makeScale(w, h, 1);
        _pm.setPosition(x0, -y0, z);
        mesh.matrix.copy(_pm);
        mesh.matrixWorldNeedsUpdate = true;
      },
    };
  };
  const bgBatch = (capN, capA) => {
    const z = (bgZ += 12);
    const n = new Batch(capN, null, z, bgOrder++, atlas);
    const a = capA ? new Batch(capA, null, z, bgOrder++, atlas) : null;
    return { n, a };
  };

  let theme = buildTheme(1);
  const themeTex = () => ({
    sky: makeTex(theme.sky, { mips: false }),
    moon: makeTex(theme.moon),
    cities: theme.cities.map((c) => makeTex(c, { repeat: true })),
    fog: makeTex(theme.fog, { mips: false }),
    veil: makeTex(theme.veil, { mips: false }),
    vignette: makeTex(theme.vignette, { mips: false }),
    gantry: makeTex(theme.gantry, { repeat: true }),
  });
  let tt = themeTex();

  const bg = {};
  bg.sky = plane(tt.sky);
  bg.moon = plane(tt.moon);
  bg.city0 = plane(tt.cities[0], 0.65);
  bg.fog = plane(tt.fog);
  bg.city1 = plane(tt.cities[1], 0.82);
  bg.traffic = bgBatch(120, 120);
  bg.city2 = plane(tt.cities[2], 0.96);
  bg.veil = plane(tt.veil);
  bg.lights = bgBatch(12, 0);
  bg.road = plane(roadTex);
  bg.posts = plane(postTex);
  bg.gantry = plane(tt.gantry, 0);
  bg.rain = bgBatch(1200, 0);
  bg.vignette = plane(tt.vignette);

  /* ---- the crafts: one shared node material, per-object flash, alpha and tint */
  const WHITE = new THREE.Color(1, 1, 1);
  const flashU = uniform(0).onObjectUpdate(({ object }) => object.userData.flash || 0);
  const alphaU = uniform(1).onObjectUpdate(({ object }) => object.userData.alpha ?? 1);
  const tintU = uniform(new THREE.Color(1, 1, 1)).onObjectUpdate(({ object }) => object.userData.tint || WHITE);
  // The original's light: ambient .58, wrap .55 toward (−.35, .6, .72) in view space, clamped to .31…1.17.
  const lit = clamp(dot(normalView, vec3(-0.35, 0.6, 0.72)).mul(0.55).add(0.58), 0.31, 1.17);
  const shade = mix(lit, float(1.2), attribute('emis', 'float'));
  const base = attribute('mcol', 'vec3').mul(tintU).mul(shade);
  const modelColor = vec4(mix(base, vec3(245 / 255), flashU), alphaU);
  const solidMat = new THREE.MeshBasicNodeMaterial();
  solidMat.colorNode = modelColor;
  solidMat.name = 'craft';
  const ghostMat = new THREE.MeshBasicNodeMaterial({ transparent: true });
  ghostMat.colorNode = modelColor;
  ghostMat.name = 'craft-ghost';

  const geos = {};
  for (const [k, faces] of Object.entries(models)) geos[k] = modelGeometry(faces);

  const pools = [];
  const poolOf = {};
  const take = (kind) => {
    let p = poolOf[kind];
    if (!p) {
      p = poolOf[kind] = { list: [], used: 0, geo: geos[kind] };
      if (!p.geo) throw new Error(`no model "${kind}"`);
      pools.push(p);
    }
    let mesh = p.list[p.used];
    if (!mesh) {
      mesh = new THREE.Mesh(p.geo, solidMat);
      mesh.name = kind;
      mesh.matrixAutoUpdate = false;
      mesh.userData = { flash: 0, alpha: 1, tint: null };
      scene.add(mesh);
      p.list.push(mesh);
    }
    p.used++;
    mesh.visible = true;
    return mesh;
  };
  const style = (mesh, flash, alpha, t, order) => {
    const u = mesh.userData;
    u.flash = flash > 0 ? Math.min(1, flash) : 0;
    u.alpha = alpha;
    u.tint = t;
    mesh.material = alpha < 0.999 ? ghostMat : solidMat;
    mesh.renderOrder = order;
  };

  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scl = new THREE.Vector3();
  const _eul = new THREE.Euler(0, 0, 0, 'ZXY');
  const _loc = new THREE.Matrix4();
  const _zAxis = new THREE.Vector3(0, 0, 1);
  const _pt = new THREE.Vector3();
  const frameM = new THREE.Matrix4();
  const ptOut = { x: 0, y: 0, z: 0 };

  /** A model at game position (x, y), scale s, rotated like the original (Rz·Rx·Ry). */
  const model = (kind, x, y, s, rx, ry, rz, flash = 0, alpha = 1, z = 0, order = 0, tintStr = null) => {
    const mesh = take(kind);
    _eul.set(rx, ry, rz, 'ZXY');
    _quat.setFromEuler(_eul);
    _pos.set(x, -y, z);
    _scl.set(s, s, s);
    mesh.matrix.compose(_pos, _quat, _scl);
    mesh.matrixWorldNeedsUpdate = true;
    style(mesh, flash, alpha, tint(tintStr), order);
    return mesh;
  };

  /** Set the parent frame for limb parts and point lookups (same arguments as model()). */
  const frame = (x, y, s, rx, ry, rz, z = 0) => {
    _eul.set(rx, ry, rz, 'ZXY');
    _quat.setFromEuler(_eul);
    _pos.set(x, -y, z);
    _scl.set(s, s, s);
    frameM.compose(_pos, _quat, _scl);
  };
  /** A model-space point of the current frame → game coordinates (x, y) and world depth z. */
  const pt = (lx, ly, lz) => {
    _pt.set(lx, ly, lz).applyMatrix4(frameM);
    ptOut.x = _pt.x;
    ptOut.y = -_pt.y;
    ptOut.z = _pt.z;
    return ptOut;
  };
  const part = (kind, inFrame, x, y, z, angle, sx, sy, sz, color, flash, alpha, order) => {
    const mesh = take(kind);
    _quat.setFromAxisAngle(_zAxis, angle);
    _pos.set(x, y, z);
    _scl.set(sx, sy, sz);
    _loc.compose(_pos, _quat, _scl);
    if (inFrame) mesh.matrix.multiplyMatrices(frameM, _loc);
    else mesh.matrix.copy(_loc);
    mesh.matrixWorldNeedsUpdate = true;
    style(mesh, flash, alpha, tint(color), order);
  };
  /** Limb parts in the current frame's model space (+y up), like the original's rod/joint/box. */
  const rod = (ax, ay, az, bx, by, bz, w, d, color, flash = 0, alpha = 1, order = 0) => {
    const dx = bx - ax, dy = by - ay;
    part('ubox', true, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(dy, dx), Math.hypot(dx, dy) || 1, w, d, color, flash, alpha, order);
  };
  const joint = (x, y, z, r, color, flash = 0, alpha = 1, order = 0) => part('ujoint', true, x, y, z, 0, r, r, 1, color, flash, alpha, order);
  const box = (x, y, z, w, h, d, color, flash = 0, alpha = 1, order = 0) => part('ubox', true, x, y, z, 0, w, h, d, color, flash, alpha, order);
  /** The same parts placed directly in game coordinates (y down) at depth z. */
  const rodW = (ax, ay, bx, by, z, w, d, color, flash = 0, alpha = 1, order = 0) => {
    const dx = bx - ax, dy = ay - by;
    part('ubox', false, (ax + bx) / 2, -(ay + by) / 2, z, Math.atan2(dy, dx), Math.hypot(dx, dy) || 1, w, d, color, flash, alpha, order);
  };
  const jointW = (x, y, z, r, color, flash = 0, alpha = 1, order = 0) => part('ujoint', false, x, -y, z, 0, r, r, 1, color, flash, alpha, order);
  const footW = (x, z, color, flash = 0) => part('foot', false, x, 0, z, 0, 1, 1, 1, color, flash, 1, 0);

  /* ---- effect layers */
  const batchMat = (additive) => {
    const m = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    // Quads come in any winding; one pass keeps their painter order (no back-then-front split).
    m.forceSinglePass = true;
    const c = attribute('rgba', 'vec4');
    m.colorNode = vec4(c.xyz, c.w.mul(texture(atlasTex, uv()).w));
    m.name = additive ? 'fx-add' : 'fx';
    return m;
  };
  const matN = batchMat(false);
  const matA = batchMat(true);
  const batches = [];
  const adopt = (b, mat) => {
    b.mesh.material = mat;
    scene.add(b.mesh);
    batches.push(b);
    return b;
  };
  adopt(bg.traffic.n, matN);
  adopt(bg.traffic.a, matA);
  adopt(bg.lights.n, matN);
  adopt(bg.rain.n, matN);
  const L = {};
  for (const [name, [z, order]] of Object.entries(LAYERS)) {
    const [capN, capA] = CAPS[name];
    L[name] = { n: adopt(new Batch(capN, matN, z, order, atlas), matN), a: adopt(new Batch(capA, matA, z, order + 0.5, atlas), matA) };
  }

  /* ---- post: anti-aliasing for the tier, plus the hit vignette and the EMP whiteout */
  const damageU = uniform(0);
  const whiteU = uniform(0);
  const fieldU = uniform(new THREE.Vector2(W, H));
  const post = createPost(kit, scene, camera, {
    output: (color) => {
      const p = screenUV.sub(0.5).mul(fieldU);
      const k = clamp(length(p).sub(180).div(600), 0, 1).mul(damageU).mul(0.64);
      const hit = mix(color.xyz, vec3(205 / 255, 62 / 255, 33 / 255), k);
      return vec4(mix(hit, vec3(201 / 255, 249 / 255, 225 / 255), whiteU.mul(0.56)), color.w);
    },
  });

  /* ---- per frame */
  const C = {
    traffic: null,
    trafficA: null,
    trafficB: null,
    search0: null,
    search1: null,
    rain: null,
  };
  const applyThemeColors = () => {
    const th = theme.theme;
    C.traffic = col(th.traffic[0]);
    C.trafficA = col(th.traffic[1]);
    C.trafficB = col(th.traffic[2]);
    C.search0 = col(th.search[0]);
    C.search1 = col(th.search[1]);
    C.rain = col(th.rain);
  };
  applyThemeColors();

  const begin = () => {
    for (const p of pools) p.used = 0;
    for (const b of batches) b.begin();
  };
  const end = () => {
    for (const p of pools) for (let i = p.used; i < p.list.length; i++) p.list[i].visible = false;
    for (const b of batches) b.end();
  };

  /** The painted city: parallax layers, traffic, searchlights, highway, gantry, rain. */
  const background = (scroll, t, gantryFade) => {
    const pad = 60;
    const x0 = view.x0 - pad, w = view.w + pad * 2;
    bg.sky.place(x0, view.y0 - pad, w, view.h + pad * 2);
    let mx = 1035 - scroll * 0.018;
    mx = (((mx + 100) % 1650) + 1650) % 1650 - 100;
    bg.moon.place(mx - 210, -40, 420, 420);
    const speeds = [0.13, 0.44, 0.92];
    const layers = [bg.city0, bg.city1, bg.city2];
    for (let l = 0; l < 3; l++) {
      const off = (scroll * speeds[l]) % 2600;
      const p = layers[l];
      p.place(x0, 0, w, H);
      p.rep.value.set(w / 2600, 1);
      p.off.value.set((off + x0) / 2600, 0);
    }
    bg.fog.place(x0, 0, w, H);
    bg.veil.place(x0, 0, w, H);
    bg.vignette.place(view.x0, view.y0, view.w, view.h);

    // Far traffic lanes.
    const tn = bg.traffic.n, ta = bg.traffic.a;
    for (let i = 0; i < 10; i++) {
      const x = ((((i * 203 + t * (i % 2 ? 37 : -26)) % (W + 100)) + W + 100) % (W + 100)) - 50;
      const y = 590 + (i % 3) * 13;
      tn.line(x, y, x + 19, y, C.traffic, 1);
      ta.glow(x + 20, y, 5, i % 2 ? C.trafficA : C.trafficB, 0.45);
    }
    // Searchlights add depth without hiding the play field.
    const ln = bg.lights.n;
    for (let i = 0; i < 2; i++) {
      const x = ((((920 + i * 890 - scroll * 0.24) % 2100) + 2100) % 2100) - 100;
      const dx = Math.sin(t * 0.17 + i * 2) * 200;
      ln.triC(x, 684, C.search0, 1, x + dx - 50, 80, C.search1, 1, x + dx + 90, 80, C.search1, 1);
    }
    // Highway and rail posts scroll together.
    const road = (scroll * 1.56) % 160;
    bg.road.place(x0, 688, w, 122);
    bg.road.rep.value.set(w / 160, 1);
    bg.road.off.value.set((road + x0) / 160, 0);
    const posts = (scroll * 1.56) % 111;
    bg.posts.place(x0, 675, w, 40);
    bg.posts.rep.value.set(w / 111, 1);
    bg.posts.off.value.set((posts + x0) / 111, 0);
    // The checkpoint gantry closes in after the first sector.
    bg.gantry.mesh.visible = gantryFade > 0.001;
    if (gantryFade > 0.001) {
      bg.gantry.op.value = gantryFade;
      bg.gantry.place(x0, -20, w, 140);
      bg.gantry.rep.value.set(w / 1850, 1);
      bg.gantry.off.value.set(((scroll * 1.15) % 1850 - 1270 + x0) / 1850, 0);
    }
    // Thin rain, never in the collision plane.
    const rn = bg.rain.n, th = theme.theme;
    const span = view.w + 70, rx0 = view.x0;
    for (let i = 0; i < th.rainCount; i++) {
      let x = (i * 163.4 - t * 94 * th.rainSpeed) % span;
      if (x < 0) x += span;
      const y = (i * 89.3 + t * (154 + (i % 5) * 18) * th.rainSpeed) % H;
      rn.line(rx0 + x, y, rx0 + x - 8, y + 17, C.rain, 1);
    }
  };

  const setTheme = (id) => {
    if (theme.id === id) return;
    const old = tt;
    theme = buildTheme(id);
    tt = themeTex();
    bg.sky.node.value = tt.sky;
    bg.moon.node.value = tt.moon;
    bg.city0.node.value = tt.cities[0];
    bg.city1.node.value = tt.cities[1];
    bg.city2.node.value = tt.cities[2];
    bg.fog.node.value = tt.fog;
    bg.veil.node.value = tt.veil;
    bg.vignette.node.value = tt.vignette;
    bg.gantry.node.value = tt.gantry;
    applyThemeColors();
    // Free the previous night's textures once the new ones are in use.
    setTimeout(() => {
      old.sky.dispose();
      old.moon.dispose();
      old.cities.forEach((c) => c.dispose());
      old.fog.dispose();
      old.veil.dispose();
      old.vignette.dispose();
      old.gantry.dispose();
    }, 500);
  };

  /** Draw one of everything that can appear later, so its pipeline is built while loading. */
  const warm = () => {
    model('scout', 700, 400, 1, 0.24, 0.16, 0, 0, 0.5, Z.enemy, ORDER.player);
    model('scout', 700, 400, 1, 0.24, 0.16, 0, 0.5, 1, Z.enemy);
    for (const k of Object.keys(L)) {
      L[k].n.rect(-200, -200, 10, 10, col('#ffffff01'));
      L[k].a.glow(-200, -200, 10, col('#ffffff01'));
    }
    bg.gantry.mesh.visible = true;
    bg.gantry.op.value = 0;
  };

  return {
    scene,
    camera,
    view,
    L,
    begin,
    end,
    warm,
    model,
    frame,
    pt,
    rod,
    joint,
    box,
    rodW,
    jointW,
    footW,
    background,
    setTheme,
    get themeId() {
      return theme.id;
    },
    /** Camera shake in game units. */
    shake(dx, dy) {
      camera.position.x = -dx;
      camera.position.y = dy;
    },
    /** Hit vignette and EMP whiteout, 0…1. */
    effects(damage, white) {
      damageU.value = damage;
      whiteU.value = white;
    },
    /** Canvas CSS pixels → game coordinates. */
    toGame(px, py, out) {
      out.x = view.x0 + (px / Math.max(1, view.cssW)) * view.w;
      out.y = view.y0 + (py / Math.max(1, view.cssH)) * view.h;
      return out;
    },
    render() {
      post.render();
    },
  };
}
