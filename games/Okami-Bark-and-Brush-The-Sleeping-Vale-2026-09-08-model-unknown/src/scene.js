/* Bark & Brush — three.js building blocks for the painted look.

   The original drew everything with Canvas2D: three-tone ellipsoids with an ink
   hull, thick outlined lines, flat polygons and painter-sorted billboards. Here
   the same shapes are real meshes:
     - InkBuilder merges static ellipsoids, tubes and triangles into three meshes
       (banded shading, flat colour, back-face ink shell) per model part.
     - DynTube is a tube whose points change every frame (legs, tail, strike arc).
     - Decal is a ground circle or ring that hugs the terrain.
     - BillboardBatch draws hundreds of painted sprites in one depth-sorted,
       instanced draw call from a texture atlas. */

import * as THREE from 'three/webgpu';
import { vec3, vec4, color, mix, select, dot, normalWorld, vertexColor, texture, uv, instancedBufferAttribute, positionWorld, uniform } from 'three/tsl';

export const LIGHT_DIR = new THREE.Vector3(-0.45, 1, 0.3).normalize();
const LIGHT = vec3(LIGHT_DIR.x, LIGHT_DIR.y, LIGHT_DIR.z);

export function canvasTexture(canvas, { repeat = false, mips = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = THREE.RepeatWrapping;
  if (!mips) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  t.anisotropy = 4;
  return t;
}

/** The three-tone face shading of the original: lit, half and shadow bands from one fixed light. */
export function bandShade(base) {
  const l = dot(normalWorld, LIGHT);
  return select(l.greaterThan(0.25), base, select(l.greaterThan(-0.3), mix(base, color(0x52664f), 0.14), mix(base, color(0x354a3a), 0.29)));
}

/**
 * Materials for one InkBuilder model. `flash` is an optional float uniform node (0..1)
 * that warms the banded parts for hit feedback.
 */
export function inkMaterials({ flash = null, transparent = false } = {}) {
  let base = vertexColor().rgb;
  if (flash) base = mix(base, color(0xffdbc2), flash.mul(0.55));
  const band = new THREE.MeshBasicNodeMaterial({ transparent });
  band.colorNode = bandShade(base);
  const flat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent });
  flat.colorNode = vertexColor().rgb;
  const shell = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent });
  shell.colorNode = vertexColor().rgb;
  return { band, flat, shell };
}

/* ------------------------------------------------------------------ geometry helpers */

const SPH_V = [];
const SPH_F = [];
for (let j = 0; j <= 5; j++) {
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    const b = (j * Math.PI) / 5;
    SPH_V.push([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)]);
  }
}
for (let j = 0; j < 5; j++) for (let i = 0; i < 10; i++) SPH_F.push([j * 10 + i, j * 10 + ((i + 1) % 10), (j + 1) * 10 + ((i + 1) % 10), (j + 1) * 10 + i]);

const _c = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();

/**
 * Tube rings by parallel transport. pts: flat [x,y,z,...] (n points), radii: number or array.
 * Writes n*radial ring positions into out (Float32Array or array) starting at offset (floats).
 */
function writeRings(pts, n, radii, radial, out, offset, extra = 0) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(n - 1, i + 1);
    let tx = pts[i1 * 3] - pts[i0 * 3];
    let ty = pts[i1 * 3 + 1] - pts[i0 * 3 + 1];
    let tz = pts[i1 * 3 + 2] - pts[i0 * 3 + 2];
    let tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    if (i === 0) {
      // A reference not parallel to the tangent.
      const rx = Math.abs(ty) < 0.95 ? 0 : 1;
      const ry = Math.abs(ty) < 0.95 ? 1 : 0;
      // n = normalize(ref × t)
      nx = ry * tz;
      ny = -rx * tz;
      nz = rx * ty - ry * tx;
    } else {
      const d = nx * tx + ny * ty + nz * tz;
      nx -= tx * d;
      ny -= ty * d;
      nz -= tz * d;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    // b = t × n
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;
    const r = (typeof radii === 'number' ? radii : radii[i]) + extra;
    for (let k = 0; k < radial; k++) {
      const th = (k / radial) * Math.PI * 2;
      const cs = Math.cos(th) * r;
      const sn = Math.sin(th) * r;
      const o = offset + (i * radial + k) * 3;
      out[o] = pts[i * 3] + nx * cs + bx * sn;
      out[o + 1] = pts[i * 3 + 1] + ny * cs + by * sn;
      out[o + 2] = pts[i * 3 + 2] + nz * cs + bz * sn;
    }
  }
}

/** Triangle index list for a capped tube of n rings × radial, cap centres at n*radial and n*radial+1. */
function tubeIndex(n, radial) {
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const k1 = (k + 1) % radial;
      const a = i * radial + k;
      const b = i * radial + k1;
      const c = (i + 1) * radial + k1;
      const d = (i + 1) * radial + k;
      idx.push(a, b, d, b, c, d);
    }
  }
  const s = n * radial;
  const e = s + 1;
  for (let k = 0; k < radial; k++) {
    const k1 = (k + 1) % radial;
    idx.push(s, k1, k);
    idx.push(e, (n - 1) * radial + k, (n - 1) * radial + k1);
  }
  return idx;
}

/* ------------------------------------------------------------------ InkBuilder */

export class InkBuilder {
  constructor() {
    this.band = { pos: [], nrm: [], col: [] };
    this.flat = { pos: [], col: [] };
    this.shell = { pos: [], col: [] };
  }

  #tri(target, ax, ay, az, bx, by, bz, cx, cy, cz, col, nrm) {
    target.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    target.col.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
    if (nrm && target.nrm) target.nrm.push(nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z);
  }

  #ellipsoidInto(target, cx, cy, cz, rx, ry, rz, col, withNormals) {
    const c = new THREE.Color(col);
    for (const f of SPH_F) {
      const P = f.map((i) => [cx + SPH_V[i][0] * rx, cy + SPH_V[i][1] * ry, cz + SPH_V[i][2] * rz]);
      _n.set(0, 0, 0);
      for (const i of f) {
        _n.x += SPH_V[i][0];
        _n.y += SPH_V[i][1];
        _n.z += SPH_V[i][2];
      }
      _n.normalize();
      for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
        const p0 = P[i0];
        let p1 = P[i1];
        let p2 = P[i2];
        _a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
        _b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
        _a.cross(_b);
        if (_a.lengthSq() < 1e-12) continue;
        if (_a.dot(_n) < 0) [p1, p2] = [p2, p1];
        this.#tri(target, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], c, withNormals ? _n : null);
      }
    }
  }

  /** A low-poly ellipsoid (the original's 10×5 sphere), banded, with an ink hull of thickness t. */
  ellipsoid(cx, cy, cz, rx, ry, rz, col, outline = '#283b34', t = 0.022) {
    this.#ellipsoidInto(this.band, cx, cy, cz, rx, ry, rz, col, true);
    if (outline) {
      const tt = Math.min(t, Math.min(rx, ry, rz) * 0.45);
      this.#ellipsoidInto(this.shell, cx, cy, cz, rx + tt, ry + tt, rz + tt, outline, false);
    }
    return this;
  }

  #tubeInto(target, pts, radii, col, radial, extra) {
    const n = pts.length / 3;
    const ring = new Float32Array(n * radial * 3);
    writeRings(pts, n, radii, radial, ring, 0, extra);
    const idx = tubeIndex(n, radial);
    const c = new THREE.Color(col);
    const V = (i) => {
      if (i < n * radial) return [ring[i * 3], ring[i * 3 + 1], ring[i * 3 + 2]];
      const p = i === n * radial ? 0 : n - 1;
      return [pts[p * 3], pts[p * 3 + 1], pts[p * 3 + 2]];
    };
    for (let i = 0; i < idx.length; i += 3) {
      const a = V(idx[i]);
      const b = V(idx[i + 1]);
      const d = V(idx[i + 2]);
      this.#tri(target, a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2], c, null);
    }
  }

  /** A thick line (the original's qline) as a capped tube; radius may be an array per point. */
  tube(points, r, col, outline = null, t = 0.018, radial = 6) {
    const pts = points.flat();
    this.#tubeInto(this.flat, pts, r, col, radial, 0);
    if (outline) this.#tubeInto(this.shell, pts, r, outline, radial, t);
    return this;
  }

  /** A flat polygon (triangle fan) with optional thin ink edges. */
  poly(points, col, edge = null, w = 0.011, offset = null) {
    const c = new THREE.Color(col);
    const P = offset ? points.map((p) => [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]]) : points;
    for (let i = 1; i < P.length - 1; i++) this.#tri(this.flat, P[0][0], P[0][1], P[0][2], P[i][0], P[i][1], P[i][2], P[i + 1][0], P[i + 1][1], P[i + 1][2], c, null);
    if (edge) {
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        const b = P[(i + 1) % P.length];
        this.#tubeInto(this.flat, [a[0], a[1], a[2], b[0], b[1], b[2]], w, edge, 4, 0);
      }
    }
    return this;
  }

  get empty() {
    return !this.band.pos.length && !this.flat.pos.length && !this.shell.pos.length;
  }

  /** Build a Group of up to three meshes that share the given materials. */
  build(mats) {
    const g = new THREE.Group();
    const add = (data, mat, normals) => {
      if (!data.pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      if (normals) geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.nrm, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      g.add(m);
    };
    add(this.shell, mats.shell, false);
    add(this.band, mats.band, true);
    add(this.flat, mats.flat, false);
    return g;
  }
}

/* ------------------------------------------------------------------ DynTube */

/** A capped tube (and optional ink shell) whose points are rewritten every frame. */
export class DynTube {
  constructor(n, { radial = 6, color: col = '#ffffff', colors = null, outline = null, outlineT = 0.018, transparent = false, opacity = 1 } = {}) {
    this.n = n;
    this.radial = radial;
    this.outlineT = outlineT;
    const vcount = n * radial + 2;
    const index = tubeIndex(n, radial);
    const make = (hex, back) => {
      const pos = new Float32Array(vcount * 3);
      const geo = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(pos, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', attr);
      geo.setIndex(index);
      let mat;
      if (colors && !back) {
        const ca = new Float32Array(vcount * 3);
        for (let i = 0; i < n; i++) {
          _c.set(colors[i]);
          for (let k = 0; k < radial; k++) ca.set([_c.r, _c.g, _c.b], (i * radial + k) * 3);
        }
        _c.set(colors[0]);
        ca.set([_c.r, _c.g, _c.b], n * radial * 3);
        _c.set(colors[n - 1]);
        ca.set([_c.r, _c.g, _c.b], (n * radial + 1) * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
        mat = new THREE.MeshBasicNodeMaterial({ transparent, opacity, depthWrite: !transparent });
        mat.colorNode = vertexColor().rgb;
      } else {
        mat = new THREE.MeshBasicNodeMaterial({ color: hex, side: back ? THREE.BackSide : THREE.FrontSide, transparent, opacity, depthWrite: !transparent });
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      return { mesh, pos, attr };
    };
    this.fill = make(col, false);
    this.mesh = this.fill.mesh;
    this.shell = outline ? make(outline, true) : null;
    this.group = new THREE.Group();
    if (this.shell) this.group.add(this.shell.mesh);
    this.group.add(this.mesh);
  }

  #write(target, pts, radii, extra) {
    const { n, radial } = this;
    writeRings(pts, n, radii, radial, target.pos, 0, extra);
    const s = n * radial * 3;
    target.pos[s] = pts[0];
    target.pos[s + 1] = pts[1];
    target.pos[s + 2] = pts[2];
    target.pos[s + 3] = pts[(n - 1) * 3];
    target.pos[s + 4] = pts[(n - 1) * 3 + 1];
    target.pos[s + 5] = pts[(n - 1) * 3 + 2];
    target.attr.needsUpdate = true;
  }

  /** pts: flat Float32Array/array of n points; radii: number or per-point array. */
  set(pts, radii) {
    this.#write(this.fill, pts, radii, 0);
    if (this.shell) this.#write(this.shell, pts, radii, this.outlineT);
  }

  set visible(v) {
    this.group.visible = v;
  }

  get material() {
    return this.mesh.material;
  }
}

/* ------------------------------------------------------------------ Decal */

const RIVER_MASK = positionWorld.z.greaterThan(-2.72).or(positionWorld.z.lessThan(-9.28));

/** A circle or ring painted on the ground, conformed to the terrain height function. */
export class Decal {
  constructor({ ring = false, segs = 48, rings = 1, color: col = '#ffffff', opacity = 1, renderOrder = 3, river = true } = {}) {
    this.ring = ring;
    this.segs = segs;
    this.rings = ring ? 1 : Math.max(1, rings);
    const count = ring ? segs * 2 : 1 + this.rings * segs;
    this.pos = new Float32Array(count * 3);
    const idx = [];
    if (ring) {
      for (let k = 0; k < segs; k++) {
        const k1 = (k + 1) % segs;
        const a = k * 2;
        const b = k * 2 + 1;
        const c = k1 * 2;
        const d = k1 * 2 + 1;
        idx.push(a, c, b, b, c, d);
      }
    } else {
      for (let k = 0; k < segs; k++) idx.push(0, 1 + ((k + 1) % segs), 1 + k);
      for (let r = 0; r < this.rings - 1; r++) {
        for (let k = 0; k < segs; k++) {
          const k1 = (k + 1) % segs;
          const a = 1 + r * segs + k;
          const b = 1 + r * segs + k1;
          const c = 1 + (r + 1) * segs + k1;
          const d = 1 + (r + 1) * segs + k;
          idx.push(a, b, d, b, c, d);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicNodeMaterial({
      color: col,
      opacity,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    if (river) mat.maskNode = RIVER_MASK;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
    this.last = [NaN, NaN, NaN, NaN, NaN];
  }

  get material() {
    return this.mesh.material;
  }

  hide() {
    this.mesh.visible = false;
  }

  /**
   * Place at (cx, cz), radius r (ring: line width `width`), y = heightFn(x,z) + lift.
   * `stamp` changes when the ground under the decal changes (the bridge appearing).
   */
  set(cx, cz, r, heightFn, width = 0.1, lift = 0.03, opacity = -1, stamp = 0) {
    this.mesh.visible = r > 0.001;
    if (opacity >= 0) this.mesh.material.opacity = opacity;
    if (!this.mesh.visible) return;
    const L = this.last;
    if (Math.abs(L[0] - cx) < 0.0005 && Math.abs(L[1] - cz) < 0.0005 && Math.abs(L[2] - r) < 0.0005 && L[3] === width && L[4] === stamp) return;
    L[0] = cx;
    L[1] = cz;
    L[2] = r;
    L[3] = width;
    L[4] = stamp;
    const P = this.pos;
    const S = this.segs;
    if (this.ring) {
      const ri = Math.max(0, r - width / 2);
      const ro = r + width / 2;
      for (let k = 0; k < S; k++) {
        const a = (k / S) * Math.PI * 2;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        let x = cx + cs * ri;
        let z = cz + sn * ri;
        const o = k * 6;
        P[o] = x;
        P[o + 1] = heightFn(x, z) + lift;
        P[o + 2] = z;
        x = cx + cs * ro;
        z = cz + sn * ro;
        P[o + 3] = x;
        P[o + 4] = heightFn(x, z) + lift;
        P[o + 5] = z;
      }
    } else {
      P[0] = cx;
      P[1] = heightFn(cx, cz) + lift;
      P[2] = cz;
      for (let rr = 0; rr < this.rings; rr++) {
        const rad = (r * (rr + 1)) / this.rings;
        for (let k = 0; k < S; k++) {
          const a = (k / S) * Math.PI * 2;
          const x = cx + Math.cos(a) * rad;
          const z = cz + Math.sin(a) * rad;
          const o = (1 + rr * S + k) * 3;
          P[o] = x;
          P[o + 1] = heightFn(x, z) + lift;
          P[o + 2] = z;
        }
      }
    }
    this.attr.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ BillboardBatch */

const _fwd = new THREE.Vector3();

/**
 * Instanced camera-facing sprites from one atlas, sorted back to front each frame.
 * Per instance: centre (anchor), rotation (sway), size, alpha, atlas rect, optional tint.
 */
export class BillboardBatch {
  constructor(tex, capacity, { alphaTest = 0.12, renderOrder = 10, depthWrite = true, fog = true, tint = false, anchor = 0, blending = THREE.NormalBlending, sort = true } = {}) {
    this.cap = capacity;
    this.tint = tint;
    this.sort = sort;
    const mk = () => new Float32Array(capacity * 4);
    this.A = mk();
    this.B = mk();
    this.C = mk();
    this.sA = mk();
    this.sB = mk();
    this.sC = mk();
    if (tint) {
      this.D = mk();
      this.sD = mk();
    }
    this.depth = new Float32Array(capacity);
    this.order = new Uint32Array(capacity);
    const attr = (arr) => {
      const a = new THREE.InstancedBufferAttribute(arr, 4);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.attrA = attr(this.A);
    this.attrB = attr(this.B);
    this.attrC = attr(this.C);
    if (tint) this.attrD = attr(this.D);

    const mat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite, alphaTest, fog, blending });
    const A = instancedBufferAttribute(this.attrA);
    const B = instancedBufferAttribute(this.attrB);
    const C = instancedBufferAttribute(this.attrC);
    mat.positionNode = A.xyz;
    mat.rotationNode = A.w;
    mat.scaleNode = B.xy;
    const t = texture(tex, C.xy.add(uv().mul(C.zw)));
    if (tint) {
      const D = instancedBufferAttribute(this.attrD);
      mat.colorNode = vec4(t.rgb.mul(D.rgb), t.a);
    } else {
      mat.colorNode = t;
    }
    mat.opacityNode = B.z;
    this.material = mat;
    this.object = new THREE.Sprite(mat);
    this.object.center.set(0.5, anchor);
    this.object.count = 2;
    this.object.frustumCulled = false;
    this.object.renderOrder = renderOrder;
    this.n = 0;
  }

  begin() {
    this.n = 0;
  }

  /** Queue one sprite: anchor (x,y,z), size w×h, rotation, alpha, atlas rect [u,v,w,h], tint rgb. */
  add(x, y, z, w, h, rot, alpha, rect, r = 1, g = 1, b = 1) {
    if (this.n >= this.cap || alpha <= 0.004) return;
    const o = this.n * 4;
    const { sA, sB, sC } = this;
    sA[o] = x;
    sA[o + 1] = y;
    sA[o + 2] = z;
    sA[o + 3] = rot;
    sB[o] = w;
    sB[o + 1] = h;
    sB[o + 2] = alpha;
    sB[o + 3] = 0;
    sC[o] = rect[0];
    sC[o + 1] = rect[1];
    sC[o + 2] = rect[2];
    sC[o + 3] = rect[3];
    if (this.tint) {
      this.sD[o] = r;
      this.sD[o + 1] = g;
      this.sD[o + 2] = b;
      this.sD[o + 3] = 1;
    }
    this.n++;
  }

  /** Sort by view depth (far first) and upload. */
  commit(camera) {
    const n = this.n;
    const { order, depth } = this;
    camera.getWorldDirection(_fwd);
    const px = camera.position.x;
    const py = camera.position.y;
    const pz = camera.position.z;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const d = (this.sA[o] - px) * _fwd.x + (this.sA[o + 1] - py) * _fwd.y + (this.sA[o + 2] - pz) * _fwd.z;
      if (d < 0.25) continue;
      depth[i] = d;
      order[m++] = i;
    }
    if (this.sort && m > 1) order.subarray(0, m).sort((a, b) => depth[b] - depth[a]);
    const { A, B, C, D, sA, sB, sC, sD } = this;
    for (let j = 0; j < m; j++) {
      const s = order[j] * 4;
      const o = j * 4;
      A[o] = sA[s];
      A[o + 1] = sA[s + 1];
      A[o + 2] = sA[s + 2];
      A[o + 3] = sA[s + 3];
      B[o] = sB[s];
      B[o + 1] = sB[s + 1];
      B[o + 2] = sB[s + 2];
      B[o + 3] = 0;
      C[o] = sC[s];
      C[o + 1] = sC[s + 1];
      C[o + 2] = sC[s + 2];
      C[o + 3] = sC[s + 3];
      if (D) {
        D[o] = sD[s];
        D[o + 1] = sD[s + 1];
        D[o + 2] = sD[s + 2];
        D[o + 3] = 1;
      }
    }
    // Keep at least two instances so the draw never changes its pipeline key; spares are invisible.
    for (let j = m; j < 2; j++) {
      const o = j * 4;
      B[o] = 0;
      B[o + 1] = 0;
      B[o + 2] = 0;
    }
    this.object.count = Math.max(2, m);
    this.attrA.needsUpdate = true;
    this.attrB.needsUpdate = true;
    this.attrC.needsUpdate = true;
    if (D) this.attrD.needsUpdate = true;
  }
}

/** A float uniform node helper (re-exported so game code needs one import). */
export { uniform };
