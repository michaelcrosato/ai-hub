/**
 * instancing.js — bake static InstancedMeshes into plain meshes.
 *
 * In r186 every InstancedMesh compiles its own shader programs (its uuid is
 * part of the shader cache key, and its matrix buffer is named after a node
 * id). A scene built from dozens of instanced batches (one per colour, per
 * chunk, per prop kind) therefore stalls on shader compiles every time it is
 * built. Batches that never move afterwards don't need instancing: bake them
 * into one geometry, and plain meshes that share a material type share one
 * shader. Keep InstancedMesh for the few batches you animate per frame.
 *
 *   const batch = new THREE.InstancedMesh(geometry, material, n);
 *   // ...setMatrixAt / setColorAt as before...
 *   group.add(bakeInstances(batch));
 */

import * as THREE from 'three/webgpu';

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * One Mesh holding every instance of `mesh` (up to `mesh.count`), with instance
 * colours as vertex colours. Copies transform, shadows, render order and name,
 * and shares the material. With instance colours it turns on the material's
 * vertexColors, so don't share that material with meshes lacking a colour
 * attribute. Pass `{ dispose: true }` when the source geometry isn't shared.
 */
export function bakeInstances(mesh, { dispose = false } = {}) {
  const src = mesh.geometry;
  const count = mesh.count;
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const uv = src.attributes.uv;
  const col = src.attributes.color;
  const verts = pos.count;
  const colors = mesh.instanceColor;
  const out = new THREE.BufferGeometry();

  const P = new Float32Array(count * verts * 3);
  const N = nor ? new Float32Array(count * verts * 3) : null;
  const U = uv ? new Float32Array(count * verts * 2) : null;
  const C = colors || col ? new Float32Array(count * verts * 3) : null;
  for (let i = 0; i < count; i++) {
    mesh.getMatrixAt(i, _m);
    _n.getNormalMatrix(_m);
    if (colors) _c.fromArray(colors.array, i * 3);
    const o = i * verts;
    for (let v = 0; v < verts; v++) {
      _v.fromBufferAttribute(pos, v).applyMatrix4(_m);
      _v.toArray(P, (o + v) * 3);
      if (N) {
        _v.fromBufferAttribute(nor, v).applyMatrix3(_n).normalize();
        _v.toArray(N, (o + v) * 3);
      }
      if (U) {
        U[(o + v) * 2] = uv.getX(v);
        U[(o + v) * 2 + 1] = uv.getY(v);
      }
      if (C) {
        const r = col ? col.getX(v) : 1;
        const g = col ? col.getY(v) : 1;
        const b = col ? col.getZ(v) : 1;
        C[(o + v) * 3] = r * (colors ? _c.r : 1);
        C[(o + v) * 3 + 1] = g * (colors ? _c.g : 1);
        C[(o + v) * 3 + 2] = b * (colors ? _c.b : 1);
      }
    }
  }
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  if (N) out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  if (U) out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));

  if (src.index) {
    const idx = src.index.array;
    const total = count * verts;
    const I = new (total > 65535 ? Uint32Array : Uint16Array)(count * idx.length);
    for (let i = 0; i < count; i++) {
      const base = i * verts;
      const o = i * idx.length;
      for (let j = 0; j < idx.length; j++) I[o + j] = base + idx[j];
    }
    out.setIndex(new THREE.BufferAttribute(I, 1));
  }
  out.computeBoundingSphere();

  const material = mesh.material;
  if (C) {
    for (const m of Array.isArray(material) ? material : [material]) {
      if (!m.vertexColors) {
        m.vertexColors = true;
        m.needsUpdate = true;
      }
    }
  }
  const baked = new THREE.Mesh(out, material);
  baked.name = mesh.name;
  baked.position.copy(mesh.position);
  baked.quaternion.copy(mesh.quaternion);
  baked.scale.copy(mesh.scale);
  baked.castShadow = mesh.castShadow;
  baked.receiveShadow = mesh.receiveShadow;
  baked.renderOrder = mesh.renderOrder;
  baked.frustumCulled = mesh.frustumCulled;
  baked.visible = mesh.visible;
  baked.userData = mesh.userData;
  if (dispose) src.dispose();
  mesh.dispose();
  return baked;
}
