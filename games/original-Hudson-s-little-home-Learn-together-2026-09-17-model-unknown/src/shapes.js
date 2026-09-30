/**
 * shapes.js — the soft, rounded primitives every room is built from.
 *
 * Each room gets its own set (its own material and geometry caches), because
 * the rooms were tuned separately: the kitchen uses slightly glossier
 * materials and finer rounding than the family room. The helpers keep the
 * original argument order so the room files read like a list of props.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * @param {object} o
 * @param {number} o.roughness          default roughness for every material
 * @param {number} o.boxSegments        rounding segments of the rounded boxes
 * @param {[number, number]} o.sphereSegments
 * @param {[number, number]} o.torusSegments
 */
export function createShapes({
  roughness = 0.62,
  boxSegments = 5,
  sphereSegments = [28, 20],
  torusSegments = [12, 48],
} = {}) {
  const materials = new Map();
  const geometries = new Map();
  const models = new Map();
  const root = new THREE.Group();

  /** One shared material per colour, metalness and roughness. */
  function mat(color, metalness = 0, rough = roughness) {
    const key = `${color}:${metalness}:${rough}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness: rough }));
    return materials.get(key);
  }

  function cached(key, make) {
    if (!geometries.has(key)) geometries.set(key, make());
    return geometries.get(key);
  }

  function addMesh(parent, geometry, color, x = 0, y = 0, z = 0, metalness = 0) {
    const mesh = new THREE.Mesh(geometry, mat(color, metalness));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** A box whose edges are rounded by `radius` (the look of every cupboard, cushion and tile). */
  function roundedBox(w, h, d, radius = 0.05) {
    radius = Math.min(radius, w / 2, h / 2, d / 2);
    return cached(`box:${w}:${h}:${d}:${radius}`, () => {
      if (radius <= 0.002) return new THREE.BoxGeometry(w, h, d);
      const seg = boxSegments;
      const geo = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      const p = new THREE.Vector3();
      const n = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i);
        const sx = Math.sign(p.x);
        const sy = Math.sign(p.y);
        const sz = Math.sign(p.z);
        n.set(p.x - (sx * 0.5) / seg, p.y - (sy * 0.5) / seg, p.z - (sz * 0.5) / seg).normalize();
        pos.setXYZ(
          i,
          sx * (w / 2 - radius) + n.x * radius,
          sy * (h / 2 - radius) + n.y * radius,
          sz * (d / 2 - radius) + n.z * radius,
        );
        nor.setXYZ(i, n.x, n.y, n.z);
      }
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      return geo;
    });
  }

  const box = (parent, w, h, d, color, x = 0, y = 0, z = 0, radius = 0.045) =>
    addMesh(parent, roundedBox(w, h, d, radius), color, x, y, z);

  function cyl(parent, radiusTop, radiusBottom, height, color, x = 0, y = 0, z = 0, metalness = 0) {
    const geo = cached(
      `cyl:${radiusTop}:${radiusBottom}:${height}`,
      () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32),
    );
    return addMesh(parent, geo, color, x, y, z, metalness);
  }

  function sphere(parent, radius, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const geo = cached(
      `sphere:${radius}`,
      () => new THREE.SphereGeometry(radius, sphereSegments[0], sphereSegments[1]),
    );
    const mesh = addMesh(parent, geo, color, x, y, z);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  }

  function torus(parent, radius, tube, color, x = 0, y = 0, z = 0, arc = Math.PI * 2) {
    const geo = cached(
      `torus:${radius}:${tube}:${arc}`,
      () => new THREE.TorusGeometry(radius, tube, torusSegments[0], torusSegments[1], arc),
    );
    return addMesh(parent, geo, color, x, y, z);
  }

  const UP = new THREE.Vector3(0, 1, 0);
  /** A round bar from point a to point b. */
  function rod(parent, a, b, radius, color, metalness = 0) {
    const from = new THREE.Vector3(...a);
    const to = new THREE.Vector3(...b);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const mesh = cyl(parent, radius, radius, from.distanceTo(to), color, mid.x, mid.y, mid.z, metalness);
    mesh.quaternion.setFromUnitVectors(UP, to.sub(from).normalize());
    return mesh;
  }

  function tube(parent, points, radius, color) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return addMesh(parent, new THREE.TubeGeometry(curve, 36, radius, 10, false), color);
  }

  function lathe(parent, points, color) {
    return addMesh(
      parent,
      new THREE.LatheGeometry(
        points.map((p) => new THREE.Vector2(...p)),
        40,
      ),
      color,
    );
  }

  function group(parent, x = 0, y = 0, z = 0, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  }

  /** A tappable thing: a named group that carries its word id. */
  function model(id, x, y, z, rotY, build) {
    const g = group(root, x, y, z, rotY || 0);
    g.name = id;
    g.userData.wordId = id;
    build(g);
    models.set(id, g);
    return g;
  }

  return {
    root,
    room: root,
    models,
    materials,
    geometries,
    mat,
    addMesh,
    roundedBox,
    box,
    cyl,
    sphere,
    torus,
    rod,
    tube,
    lathe,
    group,
    model,
  };
}

/**
 * Merge the plain meshes of every group that share a material into one mesh,
 * so a room of a thousand little parts draws in a few hundred calls. Named
 * meshes (parts a lesson animates or recolours), meshes with children, and
 * nested groups keep their structure; only their loose siblings are merged.
 */
export function mergeStatic(root) {
  const groups = [];
  root.traverse((o) => {
    if (!o.isMesh) groups.push(o);
  });
  for (const g of groups) {
    const buckets = new Map();
    for (const child of g.children) {
      if (!child.isMesh || child.name || child.children.length || Array.isArray(child.material)) continue;
      const key = `${child.material.uuid}|${child.castShadow}|${child.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(child);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const parts = list.map((m) => {
        m.updateMatrix();
        const geo = m.geometry.clone();
        for (const name of Object.keys(geo.attributes))
          if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
        geo.clearGroups();
        return geo.applyMatrix4(m.matrix);
      });
      let merged = null;
      try {
        merged = mergeGeometries(parts, false);
      } catch {
        merged = null;
      }
      parts.forEach((p) => p.dispose());
      if (!merged) continue;
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, list[0].material);
      mesh.castShadow = list[0].castShadow;
      mesh.receiveShadow = list[0].receiveShadow;
      for (const m of list) g.remove(m);
      g.add(mesh);
    }
  }
  root.updateMatrixWorld(true);
  return root;
}
