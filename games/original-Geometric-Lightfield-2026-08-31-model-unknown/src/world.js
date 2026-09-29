// The exterior yard around the house: ground, stone blocks, pillars, domes, rocks,
// ramps and the small props the player can pick up. Everything repeated is one
// InstancedMesh; the static part is frozen (no per-frame matrix updates).
import * as THREE from 'three/webgpu';

const scratch = new THREE.Object3D();
const tmpColor = new THREE.Color();

/** A box collider (walls, blocks). height = Infinity makes a full-height wall. */
export function pushBoxCollider(list, x, z, sizeX, sizeZ, height = Number.POSITIVE_INFINITY, baseY = 0) {
  list.push({ kind: 'box', minX: x - sizeX / 2, maxX: x + sizeX / 2, minY: baseY, maxY: baseY + height, minZ: z - sizeZ / 2, maxZ: z + sizeZ / 2 });
}

export function setInstance(mesh, index, position, scale, rotationY = 0) {
  scratch.position.set(position[0], position[1], position[2]);
  scratch.scale.set(scale[0], scale[1], scale[2]);
  scratch.rotation.set(0, rotationY, 0);
  scratch.updateMatrix();
  mesh.setMatrixAt(index, scratch.matrix);
}

export function finishInstanced(mesh, castShadow = true) {
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
}

/** Freeze a static subtree: no matrix recomputation every frame. */
export function freeze(root) {
  root.traverse((o) => {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
    o.static = true;
  });
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    o.matrixWorldAutoUpdate = false;
  });
}

/** A wedge (ramp) with a flat bottom, rising towards +z. */
function rampGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, -1, 1, 1, 1, 1, 1], 3));
  g.setIndex([0, 5, 1, 0, 4, 5, 0, 2, 3, 0, 1, 2, 3, 5, 4, 3, 2, 5, 0, 3, 4, 1, 5, 2]);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  return flat;
}

export function buildWorld(scene, mats) {
  const root = new THREE.Group();
  root.name = 'static-world';
  const dynamicRoot = new THREE.Group();
  dynamicRoot.name = 'dynamic-props';
  const colliders = [];
  const contactPoints = [];
  const movableObjects = [];

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(72, 72), mats.ground);
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.castShadow = false;
  root.add(ground);

  const blocks = [
    { p: [-1, 0.75, 5], s: [2.2, 1.5, 2.2], c: '#baa37f', r: 0.08 },
    { p: [2.5, 1.25, 9], s: [2.5, 2.5, 2.5], c: '#c4ae88', r: -0.1 },
    { p: [8, 0.55, -4], s: [3.4, 1.1, 2], c: '#a78e6d', r: 0.16 },
    { p: [12, 1.1, 1], s: [2.1, 2.2, 2.1], c: '#bca581' },
    { p: [17, 0.7, 12], s: [2.8, 1.4, 2.2], c: '#ccb48b', r: -0.16 },
    { p: [-9, 0.65, 8], s: [2.7, 1.3, 2.7], c: '#a78e6b', r: 0.12 },
    { p: [-17, 1.15, 12], s: [2.2, 2.3, 2.2], c: '#c3ab86', r: -0.1 },
    { p: [-20, 0.4, 5], s: [3.8, 0.8, 1.8], c: '#957e61', r: 0.22 },
    { p: [21, 0.85, -8], s: [1.7, 1.7, 3.1], c: '#c8b18c', r: 0.08 },
    { p: [4, 0.35, -14], s: [3.3, 0.7, 2.4], c: '#91795c', r: -0.12 },
  ];
  const blockMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats.instancedStone, blocks.length);
  blockMesh.name = 'stone-blocks';
  blocks.forEach(({ p, s, c, r = 0 }, i) => {
    setInstance(blockMesh, i, p, s, r);
    blockMesh.setColorAt(i, tmpColor.set(c));
    const sx = Math.abs(Math.cos(r)) * s[0] + Math.abs(Math.sin(r)) * s[2];
    const sz = Math.abs(Math.sin(r)) * s[0] + Math.abs(Math.cos(r)) * s[2];
    pushBoxCollider(colliders, p[0], p[2], sx, sz, s[1]);
    contactPoints.push({ x: p[0], z: p[2], sizeX: s[0] * 0.9, sizeZ: s[2] * 0.9 });
  });
  finishInstanced(blockMesh);
  root.add(blockMesh);

  const pillars = [
    [14, 1.8, -7, 1],
    [17, 2.6, -3, 1.15],
    [14, 2.1, 2, 0.9],
    [18, 1.55, 5, 0.78],
    [11, 2.8, 8, 1.25],
  ];
  const pillarMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.75, 1, 10), mats.stoneLight, pillars.length);
  pillarMesh.name = 'stone-pillars';
  pillars.forEach(([x, halfHeight, z, s], i) => {
    setInstance(pillarMesh, i, [x, halfHeight, z], [s, halfHeight * 2, s]);
    pushBoxCollider(colliders, x, z, s * 1.25, s * 1.25, halfHeight * 2);
    contactPoints.push({ x, z, sizeX: s * 1.5, sizeZ: s * 1.5 });
  });
  finishInstanced(pillarMesh);
  root.add(pillarMesh);

  const domes = [
    [6, 1.15, -10, 1.15],
    [17, 1.45, 8, 1.45],
    [-5, 0.82, 14, 0.82],
  ];
  const domeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), mats.terracotta, domes.length);
  domeMesh.name = 'terracotta-domes';
  domes.forEach(([x, y, z, s], i) => {
    setInstance(domeMesh, i, [x, y, z], [s, s, s]);
    pushBoxCollider(colliders, x, z, s * 1.25, s * 1.25, s * 2);
    contactPoints.push({ x, z, sizeX: s * 1.45, sizeZ: s * 1.45 });
  });
  finishInstanced(domeMesh);
  root.add(domeMesh);

  const rocks = [
    { p: [-23, 0.75, 17], s: [1.4, 0.8, 1.1], c: '#6d7165', r: 0.4 },
    { p: [-14, 0.6, 20], s: [1, 0.7, 1.35], c: '#777568', r: -0.7 },
    { p: [-4, 0.65, 22], s: [1.3, 0.7, 0.9], c: '#656a5e', r: 0.1 },
    { p: [8, 0.8, 23], s: [1.45, 0.9, 1.1], c: '#7e7869', r: -0.25 },
    { p: [24, 0.55, 18], s: [0.95, 0.65, 1.2], c: '#60675c', r: 0.8 },
    { p: [25, 0.7, 2], s: [1.2, 0.78, 1.5], c: '#737266', r: -0.5 },
    { p: [22, 0.55, -19], s: [1.15, 0.62, 0.9], c: '#686c60', r: 0.2 },
    { p: [9, 0.75, -23], s: [1.5, 0.82, 1.2], c: '#7b7567', r: 0.6 },
    { p: [-4, 0.6, -24], s: [1.1, 0.68, 1.4], c: '#61675c', r: -0.1 },
    { p: [-23, 0.75, -18], s: [1.35, 0.8, 1.15], c: '#777366', r: 0.3 },
  ];
  const rockMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mats.instancedRock, rocks.length);
  rockMesh.name = 'boundary-rocks';
  rocks.forEach(({ p, s, c, r }, i) => {
    setInstance(rockMesh, i, p, s, r);
    rockMesh.setColorAt(i, tmpColor.set(c));
    pushBoxCollider(colliders, p[0], p[2], s[0] * 1.35, s[2] * 1.35, s[1] * 2);
    contactPoints.push({ x: p[0], z: p[2], sizeX: s[0] * 1.7, sizeZ: s[2] * 1.7 });
  });
  finishInstanced(rockMesh);
  root.add(rockMesh);

  const ramps = [
    { x: 5.5, z: 4, width: 4, length: 6, height: 2.2 },
    { x: 8.5, z: 14, width: 3.5, length: 5, height: 1.6 },
    { x: -4.5, z: -4, width: 4.2, length: 4.5, height: 1.4 },
  ];
  const rampMesh = new THREE.InstancedMesh(rampGeometry(), mats.moss, ramps.length);
  rampMesh.name = 'world-ramps';
  ramps.forEach(({ x, z, width, length, height }, i) => {
    setInstance(rampMesh, i, [x, 0, z], [width / 2, height, length / 2]);
    colliders.push({ kind: 'ramp', minX: x - width / 2, maxX: x + width / 2, minZ: z - length / 2, maxZ: z + length / 2, height });
    contactPoints.push({ x, z: z + length * 0.35, sizeX: width * 0.8, sizeZ: length * 0.3 });
  });
  finishInstanced(rampMesh);
  root.add(rampMesh);

  const props = [
    { id: 'sofa-cushion', label: 'Sofa cushion', mesh: new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.28, 0.86), mats.terracotta), position: [-17.1, 1.18, -9.25], dropY: 0.14 },
    { id: 'kitchen-can', label: 'Kitchen can', mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.68, 8), mats.stoneLight), position: [-9, 1.28, -8.85], dropY: 0.34 },
    { id: 'hall-ball', label: 'Rubber ball', mesh: new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 7), mats.moss), position: [-13, 0.4, -10.8], dropY: 0.4 },
    { id: 'study-paperweight', label: 'Faceted paperweight', mesh: new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mats.stone), position: [-10.3, 0.42, -14.2], dropY: 0.42 },
  ];
  for (const prop of props) {
    prop.mesh.name = prop.id;
    prop.mesh.position.set(prop.position[0], prop.position[1], prop.position[2]);
    prop.mesh.castShadow = true;
    prop.mesh.receiveShadow = true;
    dynamicRoot.add(prop.mesh);
    movableObjects.push({ id: prop.id, label: prop.label, root: prop.mesh, dropY: prop.dropY, pickupDistance: 5.8 });
  }

  freeze(root);
  scene.add(root, dynamicRoot);
  return { root, dynamicRoot, colliders, contactPoints, movableObjects, houseCenter: { x: -13, y: 0, z: -12 } };
}
