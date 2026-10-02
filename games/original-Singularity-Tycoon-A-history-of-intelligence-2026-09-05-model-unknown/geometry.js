import * as THREE from "three/webgpu";

/**
 * Merges many small flat-shaded parts (boxes, cylinders, icosahedra) into one
 * BufferGeometry with vertex colours, so a whole room, machine or lesson scene
 * draws with one shared material and one draw call instead of hundreds.
 */
const templates = new Map();
function template(key, make) {
  let t = templates.get(key);
  if (!t) {
    let g = make();
    if (g.index) {
      const flat = g.toNonIndexed();
      g.dispose();
      g = flat;
    }
    t = {
      pos: g.getAttribute("position").array.slice(),
      nor: g.getAttribute("normal").array.slice(),
      count: g.getAttribute("position").count,
    };
    g.dispose();
    templates.set(key, t);
  }
  return t;
}

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

export class PartsBuilder {
  constructor() {
    this.parts = [];
    this.count = 0;
  }
  get empty() {
    return this.count === 0;
  }
  add(tpl, matrix, color) {
    _c.set(color);
    this.parts.push({ tpl, e: matrix.elements.slice(), r: _c.r, g: _c.g, b: _c.b });
    this.count += tpl.count;
    return this;
  }
  #place(tpl, x, y, z, sx, sy, sz, rx, ry, rz, color) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    return this.add(tpl, _m, color);
  }
  /** A w × h × d box centred on (x, y, z), optionally turned. */
  box(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) {
    const tpl = template("box", () => new THREE.BoxGeometry(1, 1, 1));
    return this.#place(tpl, x, y, z, w, h, d, rx, ry, rz, color);
  }
  cyl(r1, r2, h, x, y, z, color, segments = 8, rx = 0, ry = 0, rz = 0) {
    const tpl = template(`cyl:${r1}:${r2}:${h}:${segments}`, () => new THREE.CylinderGeometry(r1, r2, h, segments));
    return this.#place(tpl, x, y, z, 1, 1, 1, rx, ry, rz, color);
  }
  ico(r, detail, x, y, z, color, sx = 1, sy = 1, sz = 1) {
    const tpl = template(`ico:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
    return this.#place(tpl, x, y, z, sx, sy, sz, 0, 0, 0, color);
  }
  /** Any geometry (converted once and cached under `key`). */
  shape(key, make, x, y, z, color, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return this.#place(template(key, make), x, y, z, sx, sy, sz, rx, ry, rz, color);
  }
  build() {
    const pos = new Float32Array(this.count * 3);
    const nor = new Float32Array(this.count * 3);
    const col = new Float32Array(this.count * 3);
    let o = 0;
    for (const p of this.parts) {
      _m.fromArray(p.e);
      _n.getNormalMatrix(_m);
      const { pos: tp, nor: tn, count } = p.tpl;
      for (let i = 0; i < count; i++, o++) {
        _v.fromArray(tp, i * 3).applyMatrix4(_m).toArray(pos, o * 3);
        _v.fromArray(tn, i * 3).applyMatrix3(_n).normalize().toArray(nor, o * 3);
        col[o * 3] = p.r;
        col[o * 3 + 1] = p.g;
        col[o * 3 + 2] = p.b;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** A canvas texture with centred text that shrinks to fit, for chalkboards, signs and tags. */
export function textTexture(text, { width = 512, height = 128, bg = "#536b58", fg = "#e9e5cb", font = "Georgia", weight = 500, size = 40 } = {}) {
  const cvs = document.createElement("canvas");
  cvs.width = width;
  cvs.height = height;
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  let px = size;
  ctx.font = `${weight} ${px}px ${font}`;
  while (px > 14 && ctx.measureText(text).width > width * 0.92) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${font}`;
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(cvs);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
