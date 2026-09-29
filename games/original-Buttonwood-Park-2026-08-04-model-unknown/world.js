// Buttonwood Park: the model park on its table. Builds the scene once and
// returns the handful of things the game animates.

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPoints } from 'kit/points.js';
import { TAU, UP, JUNCTIONS, TrackCurve, OffsetCurve, trackPoint, trackFrame, clamp, seeded } from './track.js';

/** A small painted texture for the table (wood) or the lawn (grass). */
function paintedTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = kind === 'grass' ? '#708260' : '#6f5038';
  g.fillRect(0, 0, 128, 128);
  const rand = seeded(kind === 'grass' ? 71 : 113);
  if (kind === 'grass') {
    for (let i = 0; i < 900; i += 1) {
      g.fillStyle = rand() > 0.5 ? 'rgba(233,220,166,.08)' : 'rgba(28,58,39,.08)';
      g.fillRect(rand() * 128, rand() * 128, 1 + rand() * 2, 1 + rand() * 2);
    }
  } else {
    for (let i = 0; i < 22; i += 1) {
      g.strokeStyle = `rgba(45,28,18,${0.08 + rand() * 0.12})`;
      g.lineWidth = 0.5 + rand();
      g.beginPath();
      g.moveTo(0, rand() * 128);
      g.bezierCurveTo(35, rand() * 128, 90, rand() * 128, 128, rand() * 128);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(kind === 'grass' ? 12 : 8, kind === 'grass' ? 10 : 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const KEEP_ATTRIBUTES = ['position', 'normal', 'uv'];

/**
 * Merge the plain meshes under `root` that share a material into one mesh per
 * material, in root's own space. The park is built from dozens of painted
 * blocks; merged, a whole cottage row or carriage costs a few draw calls.
 * Lines, points and instanced meshes are left alone, and so is any material
 * whose pieces cannot be merged.
 */
function bake(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMaterial = new Map();
  root.traverse((o) => {
    if (o === root || !o.isMesh || o.isInstancedMesh) return;
    let entry = byMaterial.get(o.material);
    if (!entry) byMaterial.set(o.material, (entry = { meshes: [], cast: false, receive: false }));
    entry.meshes.push(o);
    entry.cast ||= o.castShadow;
    entry.receive ||= o.receiveShadow;
  });
  const local = new THREE.Matrix4();
  for (const [material, entry] of byMaterial) {
    if (entry.meshes.length < 2) continue;
    const geos = entry.meshes.map((m) => {
      const g = m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!KEEP_ATTRIBUTES.includes(name)) g.deleteAttribute(name);
      return g.applyMatrix4(local.multiplyMatrices(toRoot, m.matrixWorld));
    });
    // Polyhedra are unindexed; everything else is indexed. Mixed sets merge unindexed.
    const mixed = geos.some((g) => !g.index);
    const merged = mergeGeometries(mixed ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos, false);
    if (!merged) continue;
    for (const m of entry.meshes) m.removeFromParent();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = entry.cast;
    mesh.receiveShadow = entry.receive;
    root.add(mesh);
  }
  return root;
}

/** One mesh from many geometries sharing a material (falls back to one mesh each). */
function mergedMesh(geos, material, cast, receive) {
  const merged = mergeGeometries(geos, false);
  if (merged) {
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }
  const group = new THREE.Group();
  for (const g of geos) {
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    group.add(mesh);
  }
  return group;
}

// The park by afternoon light and by lantern light. setHour() blends between them.
const DAY = {
  sky: new THREE.Color(0xf3e5c5),
  ground: new THREE.Color(0x344b3d),
  hemi: 2.25,
  sun: new THREE.Color(0xffd59a),
  sunIntensity: 4.2,
  lamp: 35,
  background: new THREE.Color(0xc7d8cf),
  // The haze is mixed over the tone-mapped picture, so it is given in display colour.
  fog: new THREE.Vector3(0xc7 / 255, 0xd8 / 255, 0xcf / 255),
  windows: 0.85,
  bulbs: 1.4,
  lanterns: 0.12,
};
const EVENING = {
  sky: new THREE.Color(0x8f97d0),
  ground: new THREE.Color(0x262a36),
  hemi: 1.15,
  sun: new THREE.Color(0xff9a66),
  sunIntensity: 1.25,
  lamp: 95,
  background: new THREE.Color(0x5c6086),
  fog: new THREE.Vector3(0x5c / 255, 0x60 / 255, 0x86 / 255),
  windows: 3.4,
  bulbs: 3.6,
  lanterns: 4.2,
};

/** Where the lantern posts stand, as progress around the main loop (clear of the switches and the station). */
const LANTERN_STOPS = [0.05, 0.09, 0.13, 0.33, 0.37, 0.41, 0.6, 0.64, 0.68, 0.86, 0.9, 0.94];
const FIREFLY_MAX = 180;

export function buildWorld(scene) {
  scene.background = DAY.background.clone();
  // The haze (exp² fog, density 0.0085) is drawn in game.js after tone mapping.

  // Plain painted materials are shared: one per colour and finish.
  const plain = new Map();
  const paint = (color, roughness = 0.82, metalness = 0) => {
    const key = `${color}/${roughness}/${metalness}`;
    if (!plain.has(key)) plain.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return plain.get(key);
  };
  const boxes = new Map();
  const boxGeo = (x, y, z) => {
    const key = `${x}/${y}/${z}`;
    if (!boxes.has(key)) boxes.set(key, new THREE.BoxGeometry(x, y, z));
    return boxes.get(key);
  };
  /** A painted block, like the model-maker's balsa pieces. */
  const block = (size, color, pos, roughness = 0.82) => {
    const mesh = new THREE.Mesh(boxGeo(...size), paint(color, roughness));
    mesh.position.set(...pos);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };

  // ---- light
  const hemi = new THREE.HemisphereLight(DAY.sky, DAY.ground, DAY.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunIntensity);
  sun.position.set(-42, 64, -34);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -72, right: 72, top: 66, bottom: -66, near: 10, far: 150 });
  sun.shadow.bias = -4e-4;
  scene.add(sun);
  const lamp = new THREE.PointLight(0xffa85c, DAY.lamp, 75, 2);
  lamp.position.set(26, 13, -28);
  scene.add(lamp);

  // ---- the table and the lawn
  const wood = paintedTexture('wood');
  const table = new THREE.Mesh(new THREE.BoxGeometry(140, 3, 112, 3, 1, 3), new THREE.MeshStandardMaterial({ map: wood, color: 0xa87851, roughness: 0.88 }));
  table.position.y = -2.05;
  table.receiveShadow = true;
  scene.add(table);

  const lawnGeo = new THREE.PlaneGeometry(134, 106, 62, 48);
  lawnGeo.rotateX(-Math.PI / 2);
  const lp = lawnGeo.attributes.position;
  const tint = new Float32Array(lp.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < lp.count; i += 1) {
    const x = lp.getX(i);
    const z = lp.getZ(i);
    const edge = Math.max(Math.abs(x) / 67, Math.abs(z) / 53);
    lp.setY(i, 0.08 * Math.sin(x * 0.25) * Math.cos(z * 0.22) + Math.max(0, edge - 0.7) * 1.25);
    const v = 0.05 * Math.sin(x * 0.37 + z * 0.19);
    c.setHSL(0.25 + v * 0.12, 0.25, 0.46 + v);
    tint[i * 3] = c.r;
    tint[i * 3 + 1] = c.g;
    tint[i * 3 + 2] = c.b;
  }
  lawnGeo.setAttribute('color', new THREE.BufferAttribute(tint, 3));
  lawnGeo.computeVertexNormals();
  const grass = paintedTexture('grass');
  const lawn = new THREE.Mesh(lawnGeo, new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 0.98 }));
  lawn.receiveShadow = true;
  scene.add(lawn);

  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(9.5, 48),
    new THREE.MeshPhysicalMaterial({ color: 0x5a8f94, roughness: 0.24, metalness: 0.05, transparent: true, opacity: 0.88, clearcoat: 0.35 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(15, 0.18, 6);
  scene.add(pond);
  const pondRim = new THREE.Mesh(new THREE.RingGeometry(9.4, 10.1, 48), paint(0x8e8267, 0.96));
  pondRim.rotation.x = -Math.PI / 2;
  pondRim.position.copy(pond.position).add(new THREE.Vector3(0, -0.03, 0));
  scene.add(pondRim);

  // ---- the coaster: the main loop plus the far side of each switch
  const track = new THREE.Group();
  scene.add(track);
  const railMat = paint(0x635b50, 0.27, 0.7);
  const tieMat = paint(0x765440, 0.92);
  const postMat = paint(0xa7896a, 0.88);

  const mainCurve = new TrackCurve([0, 0, 0]);
  const branchCurves = JUNCTIONS.map((j, index) => {
    const start = j.center - j.width / 2;
    const end = j.center + j.width / 2;
    return [0, 1].map((choice) => {
      const choices = [0, 0, 0];
      choices[index] = choice;
      const pts = Array.from({ length: 52 }, (_, k) => trackPoint(start + (end - start) * (k / 51), choices));
      return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.45);
    });
  });
  // The left branch is the main loop itself; the right one gets its own rails.
  const lays = [
    { curve: mainCurve, segments: 520, closed: true, ties: 240, posts: 62 },
    ...branchCurves.map((pair) => ({ curve: pair[1], segments: 96, closed: false, ties: 44, posts: 13 })),
  ];

  // Rails, stringers and handrails merge into one mesh each; ties and trestle posts are two instanced meshes.
  const railGeos = [];
  const stringerGeos = [];
  const handrailGeos = [];
  const tieTotal = lays.reduce((n, l) => n + l.ties, 0);
  const postTotal = lays.reduce((n, l) => n + l.posts * 2, 0);
  const tieMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.13, 0.28), tieMat, tieTotal);
  tieMesh.castShadow = tieMesh.receiveShadow = true;
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1, 0.2), postMat, postTotal);
  postMesh.castShadow = postMesh.receiveShadow = true;

  const m4 = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const noTurn = new THREE.Quaternion();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const foot = new THREE.Vector3();
  const size = new THREE.Vector3();
  const top = new THREE.Vector3();
  let tieAt = 0;
  let postAt = 0;
  for (const { curve, segments, closed, ties, posts } of lays) {
    for (const lateral of [-0.61, 0.61]) {
      railGeos.push(new THREE.TubeGeometry(new OffsetCurve(curve, lateral), segments, 0.095, 6, closed));
      stringerGeos.push(new THREE.TubeGeometry(new OffsetCurve(curve, lateral, -0.24), segments, 0.13, 5, closed));
    }
    for (const lateral of [-0.98, 0.98]) {
      handrailGeos.push(new THREE.TubeGeometry(new OffsetCurve(curve, lateral, 0.3), segments, 0.055, 5, closed));
    }
    for (let i = 0; i < ties; i += 1) {
      const t = closed ? i / ties : i / Math.max(1, ties - 1);
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(clamp(t, 0.001, 0.999)).normalize();
      side.crossVectors(UP, tan).normalize();
      up.crossVectors(tan, side).normalize();
      basis.makeBasis(side, up, tan);
      q.setFromRotationMatrix(basis);
      m4.compose(p.addScaledVector(up, -0.13), q, one);
      tieMesh.setMatrixAt(tieAt++, m4);
    }
    for (let i = 0; i < posts; i += 1) {
      const t = closed ? i / posts : i / Math.max(1, posts - 1);
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(clamp(t, 0.001, 0.999)).normalize();
      side.crossVectors(UP, tan).normalize();
      for (const lateral of [-0.58, 0.58]) {
        top.copy(p).addScaledVector(side, lateral);
        top.y -= 0.25;
        const h = Math.max(0.4, top.y);
        m4.compose(foot.set(top.x, h / 2, top.z), noTurn, size.set(1, h, 1));
        postMesh.setMatrixAt(postAt++, m4);
      }
    }
  }
  tieMesh.computeBoundingSphere();
  postMesh.computeBoundingSphere();
  track.add(
    mergedMesh(railGeos, railMat, true, true),
    mergedMesh(stringerGeos, tieMat, true, false),
    mergedMesh(handrailGeos, postMat, true, false),
    tieMesh,
    postMesh
  );

  // Switch glows (shown while a switch is coming up) and the signal posts beside each switch.
  const glows = [];
  const signals = [];
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.15, 8);
  const lampGeo = new THREE.SphereGeometry(0.16, 10, 8);
  JUNCTIONS.forEach((j, index) => {
    glows.push(
      branchCurves[index].map((curve) => {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xf2bd46,
          emissive: 0xf2bd46,
          emissiveIntensity: 2.4,
          transparent: true,
          opacity: 0,
          roughness: 0.4,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.045, 5, false), mat);
        mesh.renderOrder = 3;
        mesh.visible = false;
        track.add(mesh);
        return { mat, mesh };
      })
    );
    const at = trackFrame(j.center - j.width / 2 - 0.01, [0, 0, 0]);
    const post = new THREE.Group();
    post.position.copy(at.position).addScaledVector(at.right, 2.25);
    post.add(new THREE.Mesh(poleGeo, paint(0x4b4a3d, 0.7)));
    signals.push(
      [-0.25, 0.25].map((x) => {
        const mat = new THREE.MeshStandardMaterial({ color: 0x554a3c, emissive: 0x2b241e, emissiveIntensity: 0.3, roughness: 0.4 });
        const bulb = new THREE.Mesh(lampGeo, mat);
        bulb.position.set(x, 0.9, 0);
        post.add(bulb);
        return mat;
      })
    );
    scene.add(post);
  });

  // ---- the station
  const station = new THREE.Group();
  station.position.set(0, 0, -38.5);
  station.add(block([15, 0.55, 4.7], 0x8c6850, [0, 1.65, 0]));
  station.add(block([15.5, 0.32, 5.2], 0xc7a978, [0, 1.98, 0]));
  station.add(block([13.8, 0.35, 5.8], 0x315b47, [0, 5.05, 0]));
  for (let i = -3; i <= 3; i += 1) {
    station.add(block([0.22, 3.1, 0.22], 0xecd7ad, [i * 2.15, 3.45, -2.15]));
    station.add(block([0.22, 3.1, 0.22], 0xecd7ad, [i * 2.15, 3.45, 2.15]));
  }
  station.add(block([6.4, 1.25, 0.2], 0xf1d9a6, [0, 5.7, -2.1]));
  const bulbGeo = new THREE.SphereGeometry(0.1, 8, 6);
  const bulbMats = [
    new THREE.MeshStandardMaterial({ color: 0xb64a3d, emissive: 0x6f211d, emissiveIntensity: DAY.bulbs }),
    new THREE.MeshStandardMaterial({ color: 0xd5a749, emissive: 0x7b5815, emissiveIntensity: DAY.bulbs }),
  ];
  [-2.55, -1.7, -0.85, 0, 0.85, 1.7, 2.55].forEach((x, i) => {
    const bulb = new THREE.Mesh(bulbGeo, bulbMats[i % 2]);
    bulb.position.set(x, 5.7, -2.23);
    station.add(bulb);
  });
  scene.add(bake(station));

  // ---- the old buttonwood tree
  const bark = paint(0x594231, 1);
  const leaves = [paint(0x466448, 0.95), paint(0x62785a, 0.95), paint(0x7e875a, 0.95)];
  const bigTree = new THREE.Group();
  bigTree.position.set(-2, 0, 3);
  const bole = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.05, 8, 9), bark);
  bole.position.y = 4;
  bole.castShadow = true;
  bigTree.add(bole);
  [
    [-2, 8, 0, 2.8],
    [1.6, 8.8, 0.4, 3.2],
    [0, 10.5, -1, 3.6],
    [-0.2, 9, 2, 3],
    [2.5, 10.2, 1, 2.5],
    [-2.5, 10.4, 1.2, 2.6],
  ].forEach(([x, y, z, r], i) => {
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), leaves[i % leaves.length]);
    crown.position.set(x, y, z);
    crown.scale.y = 0.82;
    crown.castShadow = true;
    bigTree.add(crown);
  });
  scene.add(bake(bigTree));

  // ---- water tower
  const tower = new THREE.Group();
  tower.position.set(-18, 0, 9);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 3.5, 16), paint(0x4f8277, 0.62, 0.15));
  tank.position.y = 8.7;
  tank.castShadow = true;
  tower.add(tank);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 1.4, 16), paint(0xb64a3d, 0.8));
  cap.position.y = 11.15;
  cap.castShadow = true;
  tower.add(cap);
  for (const x of [-1.7, 1.7]) for (const z of [-1.7, 1.7]) tower.add(block([0.22, 7, 0.22], 0x6e5a45, [x, 4, z]));
  scene.add(bake(tower));

  // ---- ferris wheel
  const wheel = new THREE.Group();
  wheel.position.set(18, 8.2, 13);
  wheel.rotation.y = -0.15;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.18, 8, 48), paint(0xeee0bc, 0.65));
  rim.castShadow = true;
  wheel.add(rim);
  const spokePoints = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * TAU;
    spokePoints.push(new THREE.Vector3(), new THREE.Vector3(Math.cos(a) * 6.1, Math.sin(a) * 6.1, 0));
    wheel.add(block([0.75, 0.55, 0.65], i % 2 ? 0xd5a749 : 0xb64a3d, [Math.cos(a) * 6.2, Math.sin(a) * 6.2, 0]));
  }
  wheel.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokePoints), new THREE.LineBasicMaterial({ color: 0xc3aa7c })));
  scene.add(bake(wheel));
  const wheelStand = new THREE.Group();
  wheelStand.add(block([0.3, 8, 0.3], 0x80654d, [15.5, 4, 13]), block([0.3, 8, 0.3], 0x80654d, [20.5, 4, 13]));
  scene.add(bake(wheelStand));

  // ---- carousel
  const carousel = new THREE.Group();
  carousel.position.set(-18, 0.25, -9);
  carousel.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.5, 24), paint(0xead8ac, 0.8)));
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.3, 24), paint(0xb64a3d, 0.77));
  canopy.position.y = 4.3;
  carousel.add(canopy);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU;
    carousel.add(block([0.08, 3.5, 0.08], 0xe7cf9b, [Math.cos(a) * 2.8, 2.1, Math.sin(a) * 2.8]));
    const horse = block([0.75, 0.45, 0.28], i % 2 ? 0x496d80 : 0xd5a749, [Math.cos(a) * 2.8, 1.55, Math.sin(a) * 2.8]);
    horse.rotation.y = -a;
    carousel.add(horse);
  }
  scene.add(bake(carousel));

  // ---- the little trees, instanced; each sways a touch on its own
  const rand = seeded(1949);
  const treePlan = [];
  for (let i = 0; i < 64; i += 1) {
    const a = rand() * TAU;
    const r = i < 38 ? 13 + rand() * 12 : 49 + rand() * 11;
    const x = Math.cos(a) * r * (i < 38 ? 1 : 1.05);
    const z = Math.sin(a) * r * (i < 38 ? 0.76 : 0.72);
    if (Math.hypot(x - 15, z - 6) < 11 || Math.hypot(x, z + 38) < 12) continue;
    const crownScale = new THREE.Vector3(0.78 + rand() * 0.55, 0.95 + rand() * 0.7, 0.78 + rand() * 0.55);
    const crownTurn = rand() * Math.PI;
    const scale = 0.75 + rand() * 0.65;
    treePlan.push({ x, z, leaf: i % leaves.length, crownScale, crownTurn, scale });
  }
  const trunkLocal = new THREE.Matrix4().makeTranslation(0, 1.35, 0);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 2.7, 6), bark, treePlan.length);
  trunks.castShadow = true;
  const crownGeo = new THREE.DodecahedronGeometry(1.25, 0);
  const crowns = leaves.map((mat, k) => {
    const mesh = new THREE.InstancedMesh(crownGeo, mat, Math.max(1, treePlan.filter((t) => t.leaf === k).length));
    mesh.castShadow = true;
    return mesh;
  });
  const crownSlot = [0, 0, 0];
  for (const t of treePlan) {
    t.crownLocal = new THREE.Matrix4().compose(new THREE.Vector3(0, 3.35, 0), new THREE.Quaternion().setFromAxisAngle(UP, t.crownTurn), t.crownScale);
    t.slot = crownSlot[t.leaf]++;
    t.position = new THREE.Vector3(t.x, 0, t.z);
    t.size = new THREE.Vector3().setScalar(t.scale);
  }
  const sway = new THREE.Euler();
  const swayQ = new THREE.Quaternion();
  const treeM = new THREE.Matrix4();
  const partM = new THREE.Matrix4();
  const swayTrees = (seconds) => {
    for (let i = 0; i < treePlan.length; i += 1) {
      const t = treePlan[i];
      sway.set(Math.cos(seconds * 0.55 + i * 0.31) * 0.004, 0, Math.sin(seconds * 0.7 + i * 0.57) * 0.006);
      swayQ.setFromEuler(sway);
      treeM.compose(t.position, swayQ, t.size);
      trunks.setMatrixAt(i, partM.multiplyMatrices(treeM, trunkLocal));
      crowns[t.leaf].setMatrixAt(t.slot, partM.multiplyMatrices(treeM, t.crownLocal));
    }
    trunks.instanceMatrix.needsUpdate = true;
    for (const c2 of crowns) c2.instanceMatrix.needsUpdate = true;
  };
  swayTrees(0);
  trunks.computeBoundingSphere();
  for (const c2 of crowns) c2.computeBoundingSphere();
  scene.add(trunks, ...crowns);

  // ---- cottages around the edge
  const walls = [0xe7c994, 0xb9c7a6, 0xd9a078, 0xa8c2be];
  const roofGeo = new THREE.ConeGeometry(4.7, 2.6, 4);
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xf5d681, roughness: 0.82, emissive: 0x8a5d20, emissiveIntensity: DAY.windows });
  const windowGeo = boxGeo(0.85, 0.85, 0.1);
  const village = new THREE.Group();
  [
    [-48, 0, -30, 0.1],
    [-54, 0, -17, -0.12],
    [49, 0, -26, 0.16],
    [52, 0, -10, -0.08],
    [-45, 0, 29, 0.1],
  ].forEach(([x, y, z, turn], i) => {
    const house = new THREE.Group();
    house.position.set(x, y, z);
    house.rotation.y = turn;
    house.add(block([6, 4, 5], walls[i % walls.length], [0, 2, 0]));
    const roof = new THREE.Mesh(roofGeo, paint(i % 2 ? 0x496d80 : 0xa74d3d, 0.88));
    roof.position.y = 5.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    house.add(block([1.15, 2.2, 0.12], 0x5f4a38, [0, 1.25, 2.56]));
    for (const wx of [-1.75, 1.75]) {
      const pane = new THREE.Mesh(windowGeo, windowMat);
      pane.position.set(wx, 2.25, 2.57);
      pane.castShadow = pane.receiveShadow = true;
      house.add(pane);
    }
    village.add(house);
  });
  scene.add(bake(village));

  // ---- flower beds
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 6, 4), paint(0xe3a06b, 0.8), 180);
  const fp = new THREE.Vector3();
  const fs = new THREE.Vector3();
  for (let i = 0; i < 180; i += 1) {
    const a = rand() * TAU;
    const r = 7 + rand() * 19;
    fp.set(Math.cos(a) * r, 0.22 + rand() * 0.12, Math.sin(a) * r * 0.72);
    fs.x = 0.7 + rand();
    fs.y = 0.7 + rand();
    fs.z = 0.7 + rand();
    flowers.setMatrixAt(i, m4.compose(fp, noTurn, fs));
  }
  flowers.computeBoundingSphere();
  scene.add(flowers);

  // ---- lantern posts along the inside of the loop: dark by day, lit in the evening
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xf3d596, emissive: 0xffb45c, emissiveIntensity: DAY.lanterns, roughness: 0.45 });
  const lanternPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 2.4, 6), paint(0x3d3a33, 0.7), LANTERN_STOPS.length);
  const lanternHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 10, 8), lanternMat, LANTERN_STOPS.length);
  lanternPoles.castShadow = true;
  const stop = trackFrame(0, [0, 0, 0]);
  LANTERN_STOPS.forEach((p, i) => {
    trackFrame(p, [0, 0, 0], 0, stop);
    side.crossVectors(UP, stop.tangent).normalize();
    // Toward the middle of the park, clear of the rails and the outer trees.
    const inward = stop.position.x * side.x + stop.position.z * side.z > 0 ? -2.5 : 2.5;
    const x = stop.position.x + side.x * inward;
    const z = stop.position.z + side.z * inward;
    lanternPoles.setMatrixAt(i, m4.compose(foot.set(x, 1.2, z), noTurn, one));
    lanternHeads.setMatrixAt(i, m4.compose(foot.set(x, 2.56, z), noTurn, one));
  });
  lanternPoles.computeBoundingSphere();
  lanternHeads.computeBoundingSphere();
  scene.add(lanternPoles, lanternHeads);

  // ---- the train: an engine and three cars, two riders each
  const train = new THREE.Group();
  scene.add(train);
  const cars = [];
  const bodyColors = [0xb64a3d, 0x315b47, 0xd5a749, 0x496d80];
  const bodyGeo = new THREE.BoxGeometry(1.45, 0.72, 2.25, 2, 1, 3);
  const headGeo = new THREE.SphereGeometry(0.18, 10, 8);
  const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10);
  const wheelMat = paint(0x272b28, 0.45);
  const riderMats = [paint(0xe2ae7c, 0.85), paint(0xb97a5b, 0.85)];
  for (let i = 0; i < 4; i += 1) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, paint(bodyColors[i], 0.58));
    body.castShadow = body.receiveShadow = true;
    car.add(body);
    car.add(block([1.28, 0.2, 0.38], 0xf1d9a6, [0, 0.45, 0.28]));
    car.add(block([0.09, 0.7, 1.75], 0xead9b6, [-0.66, 0.52, 0]), block([0.09, 0.7, 1.75], 0xead9b6, [0.66, 0.52, 0]));
    if (i === 0) {
      const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.72, 12), paint(0xa34035, 0.58));
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 0.05, 1.25);
      nose.castShadow = true;
      car.add(nose);
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.82, 10), paint(0x373a35, 0.55));
      stack.position.set(0, 0.75, 0.75);
      car.add(stack);
    }
    for (let k = 0; k < 2; k += 1) {
      const head = new THREE.Mesh(headGeo, riderMats[k]);
      head.position.set(k ? 0.3 : -0.3, 0.76, -0.18);
      car.add(head);
    }
    for (const x of [-0.74, 0.74])
      for (const z of [-0.72, 0.72]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, -0.42, z);
        car.add(w);
      }
    train.add(bake(car));
    cars.push(car);
  }

  // ---- drifting pollen: sized points (WebGPU draws plain Points at one pixel)
  const count = 240;
  const motes = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    motes[i * 3] = (rand() - 0.5) * 118;
    motes[i * 3 + 1] = 1.5 + rand() * 20;
    motes[i * 3 + 2] = (rand() - 0.5) * 88;
  }
  const pollen = createPoints({
    positions: motes,
    size: 0.12,
    sizeAttenuation: true,
    material: { color: 0xffe3a4, transparent: true, opacity: 0.58, depthWrite: false },
  });
  scene.add(pollen.object);

  // ---- fireflies for the lantern evening: half gather in Firefly Hollow, the rest wander the lawn
  const fireBase = new Float32Array(FIREFLY_MAX * 3);
  const firePhase = new Float32Array(FIREFLY_MAX);
  const hollow = new THREE.Vector3();
  for (let i = 0; i < FIREFLY_MAX; i += 1) {
    let x;
    let z;
    if (i % 2 === 0) {
      trackPoint(0.72 + rand() * 0.1, [0, 0, 1], hollow);
      x = hollow.x + (rand() - 0.5) * 16;
      z = hollow.z + (rand() - 0.5) * 12;
    } else {
      x = (rand() - 0.5) * 120;
      z = (rand() - 0.5) * 92;
    }
    fireBase[i * 3] = x;
    fireBase[i * 3 + 1] = 0.5 + rand() * 3.8;
    fireBase[i * 3 + 2] = z;
    firePhase[i] = rand() * TAU;
  }
  const fireflies = createPoints({
    positions: new Float32Array(fireBase),
    colors: new Float32Array(FIREFLY_MAX * 3).fill(1),
    size: 0.2,
    sizeAttenuation: true,
    material: { color: 0xffe07a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending },
  });
  fireflies.object.renderOrder = 4;
  fireflies.object.visible = false;
  scene.add(fireflies.object);
  const firePos = fireflies.positions.array;
  const fireGlow = fireflies.colors.array;
  /** Drift and blink; only while they are out. */
  const animateFireflies = (s) => {
    if (!fireflies.object.visible) return;
    const n = fireflies.object.count;
    for (let i = 0; i < n; i += 1) {
      const ph = firePhase[i];
      const o = i * 3;
      firePos[o] = fireBase[o] + Math.sin(s * 0.43 + ph) * 1.1;
      firePos[o + 1] = fireBase[o + 1] + Math.sin(s * 0.9 + ph * 2) * 0.4;
      firePos[o + 2] = fireBase[o + 2] + Math.cos(s * 0.37 + ph) * 1.1;
      const blink = Math.max(0, Math.sin(s * 2.2 + ph * 3));
      const b = 0.25 + 0.75 * blink * blink;
      fireGlow[o] = fireGlow[o + 1] = fireGlow[o + 2] = b;
    }
    fireflies.positions.needsUpdate = true;
    fireflies.colors.needsUpdate = true;
  };

  // ---- afternoon ↔ lantern evening
  const lerp = THREE.MathUtils.lerp;
  const fogColor = DAY.fog.clone();
  /** k = 0 is the summer afternoon, 1 the lantern evening; anything between is the dusk on the way. */
  const setHour = (k) => {
    hemi.color.lerpColors(DAY.sky, EVENING.sky, k);
    hemi.groundColor.lerpColors(DAY.ground, EVENING.ground, k);
    hemi.intensity = lerp(DAY.hemi, EVENING.hemi, k);
    sun.color.lerpColors(DAY.sun, EVENING.sun, k);
    sun.intensity = lerp(DAY.sunIntensity, EVENING.sunIntensity, k);
    lamp.intensity = lerp(DAY.lamp, EVENING.lamp, k);
    scene.background.lerpColors(DAY.background, EVENING.background, k);
    fogColor.lerpVectors(DAY.fog, EVENING.fog, k);
    windowMat.emissiveIntensity = lerp(DAY.windows, EVENING.windows, k);
    for (const m of bulbMats) m.emissiveIntensity = lerp(DAY.bulbs, EVENING.bulbs, k);
    lanternMat.emissiveIntensity = lerp(DAY.lanterns, EVENING.lanterns, k);
    fireflies.object.visible = k > 0.02;
    fireflies.material.opacity = 0.9 * k;
  };

  return {
    sun,
    cars,
    glows,
    signals,
    wheel,
    carousel,
    pond,
    pollen: pollen.object,
    fireflies: fireflies.object,
    fogColor,
    swayTrees,
    animateFireflies,
    setHour,
    setFireflyCount: (n) => fireflies.setCount(Math.min(FIREFLY_MAX, n)),
  };
}
