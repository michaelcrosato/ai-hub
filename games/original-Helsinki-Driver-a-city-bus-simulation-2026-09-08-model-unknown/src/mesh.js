/** Small geometry helpers; avoids another runtime package. */
import * as THREE from 'three/webgpu';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function roundedBox(w, h, d, r = 0.07) {
  r = Math.min(r, w / 3, h / 3, d / 3); const x = -w / 2, y = -h / 2, s = new THREE.Shape();
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: r * 0.48, bevelThickness: r, curveSegments: 3 });
  g.translate(0, 0, -(d - 2 * r) / 2); return g;
}
export function box(parent, material, w, h, d, x = 0, y = 0, z = 0, rounded = false) {
  const m = new THREE.Mesh(rounded ? roundedBox(w, h, d) : new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function cylinder(parent, material, r1, r2, h, x, y, z, segments = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, segments), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
/** A cylinder geometry from a to b (both [x, y, z]). */
export function beamGeometry(a, b, r = 0.025, segments = 8) {
  _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); _c.subVectors(_b, _a);
  const g = new THREE.CylinderGeometry(r, r, _c.length(), segments);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, _c.normalize());
  g.applyQuaternion(q); g.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2); return g;
}
export function beam(parent, material, a, b, r = 0.025, segments = 8) {
  const m = new THREE.Mesh(beamGeometry(a, b, r, segments), material); m.castShadow = true; parent.add(m); return m;
}
export function setTextureColor(texture, isColor = true) { texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace; return texture; }
export function canvasTexture(canvas, repeat = true, color = true) {
  const tex = new THREE.CanvasTexture(canvas); setTextureColor(tex, color);
  if (repeat) { tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; }
  tex.anisotropy = 8; return tex;
}
export function drawLabel(canvas, text, options = {}) {
  const ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
  ctx.fillStyle = options.background || '#eceade'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = options.color || '#172124'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${options.weight || 600} ${options.size || height * 0.42}px Arial, sans-serif`;
  const lines = Array.isArray(text) ? text : [text]; lines.forEach((t, i) => ctx.fillText(t, width / 2, (height * (i + 0.5)) / lines.length, width * 0.94));
}
export function makeLabel(text, width = 1024, height = 256, options = {}) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; drawLabel(c, text, options);
  return canvasTexture(c, false);
}

/** Collects quads and geometries into one mesh per material (one draw call). */
export class GeometryBatch {
  constructor(material, parent) { this.material = material; this.parent = parent; this.positions = []; this.normals = []; this.uvs = []; this.indices = []; }
  quad(points, uvs = null, reverse = false) {
    const start = this.positions.length / 3;
    _a.set(points[0][0], points[0][1], points[0][2]); _b.set(points[1][0], points[1][1], points[1][2]); _c.set(points[2][0], points[2][1], points[2][2]);
    _n.subVectors(_b, _a).cross(_c.sub(_a)).normalize(); if (reverse) _n.negate();
    for (let i = 0; i < 4; i++) {
      const p = points[i]; this.positions.push(p[0], p[1], p[2]); this.normals.push(_n.x, _n.y, _n.z);
      const uv = uvs?.[i] || QUAD_UV[i]; this.uvs.push(uv[0], uv[1]);
    }
    const ix = reverse ? QUAD_REV : QUAD_IDX; for (const i of ix) this.indices.push(i + start);
  }
  addGeometry(geometry, matrix) {
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv'), idx = geometry.getIndex(), start = this.positions.length / 3;
    const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
    for (let i = 0; i < p.count; i++) {
      _a.fromBufferAttribute(p, i); if (matrix) _a.applyMatrix4(matrix); this.positions.push(_a.x, _a.y, _a.z);
      if (n) { _n.fromBufferAttribute(n, i); if (nm) _n.applyMatrix3(nm).normalize(); this.normals.push(_n.x, _n.y, _n.z); } else this.normals.push(0, 1, 0);
      this.uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    if (idx) for (let i = 0; i < idx.count; i++) this.indices.push(idx.getX(i) + start); else for (let i = 0; i < p.count; i++) this.indices.push(i + start);
  }
  get empty() { return !this.positions.length; }
  geometry() {
    if (!this.positions.length) return null;
    const g = new THREE.BufferGeometry(); const count = this.positions.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices), 1)); g.computeBoundingSphere();
    this.positions = []; this.normals = []; this.uvs = []; this.indices = []; return g;
  }
  finish(castShadow = true) {
    const g = this.geometry(); if (!g) return null;
    const m = new THREE.Mesh(g, this.material); m.castShadow = castShadow; m.receiveShadow = true; this.parent.add(m); return m;
  }
}
const QUAD_UV = [[0, 0], [1, 0], [1, 1], [0, 1]], QUAD_IDX = [0, 1, 2, 0, 2, 3], QUAD_REV = [0, 2, 1, 0, 3, 2];

/**
 * Merge the static Mesh children of `parent` into one mesh per material (draw calls, not looks: transforms are
 * baked in). Groups and the meshes in `keep` stay as they are, so animated parts keep moving.
 */
export function mergeChildren(parent, keep = null) {
  const batches = new Map();
  for (const child of [...parent.children]) {
    if (!child.isMesh || child.isInstancedMesh || keep?.has(child)) continue;
    child.updateMatrix();
    let batch = batches.get(child.material);
    if (!batch) { batch = new GeometryBatch(child.material, parent); batch.cast = false; batches.set(child.material, batch); }
    batch.addGeometry(child.geometry, child.matrix); batch.cast ||= child.castShadow;
    child.geometry.dispose(); parent.remove(child);
  }
  for (const b of batches.values()) b.finish(b.cast);
}

/** Merge [geometry, matrix?] parts into one BufferGeometry (parts are disposed). */
export function mergeParts(parts) {
  const batch = new GeometryBatch(null, null);
  for (const [g, m] of parts) { batch.addGeometry(g, m || null); g.dispose(); }
  return batch.geometry();
}

export function polygonGeometry(points, holes = []) {
  const shape = new THREE.Shape(); points.forEach((p, i) => (i ? shape.lineTo(p[0], -p[1]) : shape.moveTo(p[0], -p[1]))); shape.closePath();
  for (const ring of holes) { const path = new THREE.Path(); ring.forEach((p, i) => (i ? path.lineTo(p[0], -p[1]) : path.moveTo(p[0], -p[1]))); path.closePath(); shape.holes.push(path); }
  const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); return g;
}
