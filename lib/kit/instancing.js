/**
 * instancing.js — InstancedMeshes that don't each compile their own shaders.
 *
 * In r186 an InstancedMesh small enough for a uniform buffer (1024 instances
 * at the usual 64 KB limit) reads its matrices from a uniform array named
 * after a node id, and its uuid is part of the shader cache key. Every such
 * InstancedMesh therefore compiles its own shader programs (one per render
 * pass), so a scene with dozens of instanced batches (one per colour, chunk
 * or prop kind) stalls on compiles while it loads and whenever one first
 * appears. Two ways out:
 *
 *   // Batches that move: allocate past the uniform limit (kit.instanced does
 *   // this). The matrices become vertex attributes, the generated code is
 *   // identical, and every batch shares one program. About 64 KB per batch.
 *   const crowd = kit.instanced(geometry, material, 200);
 *   // (or createInstanced(geometry, material, 200) from this module)
 *
 *   // Batches that never move once built: bake into a plain mesh.
 *   group.add(bakeInstances(batch));
 */

import * as THREE from 'three/webgpu';

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();

// The renderer's uniform-buffer limit in bytes; kit/boot.js reports it once the renderer exists.
let uniformLimit = 65536;

/** Called by kit/boot.js with the game's renderer. */
export function useRenderer(renderer) {
  uniformLimit = renderer?.backend?.capabilities?.getUniformBufferLimit?.() ?? uniformLimit;
}

/**
 * An InstancedMesh with room for at least `capacity` instances that shares its
 * shaders with every other one made here: the allocation goes past the
 * renderer's uniform-buffer limit, and `count` starts at `capacity` (lower it
 * to draw fewer). Matrix and colour arrays are sized to the allocation.
 * Same as kit.instanced, for modules that don't hold the kit.
 */
export function createInstanced(geometry, material, capacity) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(capacity, Math.floor(uniformLimit / 64) + 1));
  mesh.count = capacity;
  return mesh;
}

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
