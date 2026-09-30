/**
 * town.js — the low-poly town diorama, drawn with kit.renderer.
 *
 * The static town (ground, roads, districts, trees, buildings) is merged into
 * one mesh per colour; the stand and its props share cached geometries and
 * materials; the customers are instanced. The camera is the original
 * orthographic three-quarter view, now with smoothed orbit and zoom.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = {
  grass: 0x78c85a,
  grassDark: 0x5ba946,
  sand: 0xffdf82,
  water: 0x31b9d4,
  road: 0x667788,
  sidewalk: 0xf3e8ce,
  navy: 0x17324d,
  lemon: 0xffd83d,
  orange: 0xffaa32,
  coral: 0xff6b61,
  teal: 0x24b8a6,
  cream: 0xfff7df,
  white: 0xffffff,
  bark: 0x99603b,
  lawn: 0x9bdc6c,
  paving: 0xcfd5ce,
  foam: 0xb5f2ef,
  leaves: 0x43a955,
  window: 0x7ad2e5,
  fountain: 0x6fe2ee,
  pitcher: 0xffed9b,
  purple: 0x8e74d6,
  blue: 0x3c84d5,
  pink: 0xee7e9b,
  staffHead: 0x6d4635,
  // Old Mill Market
  yard: 0xe9cfa6,
  mill: 0xc8574a,
  millRoof: 0x5b4a6e,
  lime: 0x9ed65a,
};

const SKY = { Rain: 0x7899aa, Cloudy: 0xa9ced5, Hot: 0x72d8f4, Sunny: 0x8bd9f6 };

export const PITCHES = {
  park: new THREE.Vector3(-6.1, 0.38, -2.75),
  plaza: new THREE.Vector3(5, 0.38, -2.55),
  beach: new THREE.Vector3(4.7, 0.4, 4.55),
  market: new THREE.Vector3(-5.3, 0.38, 3.5),
};

const STAFF_COLOR = { mia: C.teal, priya: C.coral, theo: C.blue, june: C.purple };
const WALKER_COLORS = [C.coral, C.teal, C.orange, C.purple, C.blue, C.pink];
const SKIN = [0x8b5f45, 0xa37152, 0xbb835f, 0xd3956c];
const HIT_LAYER = 1;
const HALF_HEIGHT = 9.3;
const BASE_YAW = Math.PI / 4;
const CAM_RADIUS = Math.hypot(17, 17);
const CAM_HEIGHT = 18;

export function createTown(kit) {
  const renderer = kit.renderer;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY.Sunny);
  const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
  camera.position.set(17, 18, 17);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x79a55a, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3c2, 3.4);
  sun.position.set(7, 13, 4);
  scene.add(sun);

  // ---- shared materials and geometries
  const materials = new Map();
  const mat = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }));
    return materials.get(color);
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylCache = new Map();
  const cylGeo = (rt, rb, segs) => {
    const key = `${rt}|${rb}|${segs}`;
    if (!cylCache.has(key)) cylCache.set(key, new THREE.CylinderGeometry(rt, rb, 1, segs));
    return cylCache.get(key);
  };
  const coneCache = new Map();
  const coneGeo = (r, hgt, segs) => {
    const key = `${r}|${hgt}|${segs}`;
    if (!coneCache.has(key)) coneCache.set(key, new THREE.ConeGeometry(r, hgt, segs));
    return coneCache.get(key);
  };

  const box = (parent, w, hgt, d, color, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(boxGeo, mat(color));
    m.scale.set(w, hgt, d);
    m.position.set(x, y + hgt / 2, z);
    parent.add(m);
    return m;
  };
  const cyl = (parent, rt, rb, hgt, color, x = 0, y = 0, z = 0, segs = 8) => {
    const m = new THREE.Mesh(cylGeo(rt, rb, segs), mat(color));
    m.scale.y = hgt;
    m.position.set(x, y + hgt / 2, z);
    parent.add(m);
    return m;
  };
  const cone = (parent, r, hgt, segs, color) => {
    const m = new THREE.Mesh(coneGeo(r, hgt, segs), mat(color));
    parent.add(m);
    return m;
  };

  const world = new THREE.Group();
  world.rotation.y = 0.02;
  scene.add(world);

  // ---- the static town, built as meshes and merged by colour below
  const statics = new THREE.Group();
  world.add(statics);
  box(statics, 20, 0.65, 14, C.grassDark, 0, -0.65, 0);
  box(statics, 20, 0.2, 14, C.grass, 0, -0.05, 0);
  box(statics, 3.4, 0.23, 14.2, C.road, -0.3, 0.05, 0);
  box(statics, 20.2, 0.24, 2.1, C.road, 0, 0.06, 1.4);
  box(statics, 2.1, 0.12, 14.3, C.sidewalk, -2.95, 0.18, 0);
  box(statics, 2.1, 0.12, 14.3, C.sidewalk, 2.35, 0.18, 0);
  box(statics, 5.4, 0.16, 5.2, C.lawn, -6.7, 0.2, -3.3);
  box(statics, 5.5, 0.16, 4.2, C.paving, 6.2, 0.2, -3.7);
  box(statics, 7, 0.18, 3.25, C.sand, 5.7, 0.21, 4.7);
  box(statics, 7.2, 0.2, 1.7, C.water, 5.7, 0.23, 6.6);
  box(statics, 7.2, 0.12, 0.22, C.foam, 5.7, 0.45, 5.92);

  const tree = (x, z, s = 1) => {
    const g = new THREE.Group();
    cyl(g, 0.16 * s, 0.23 * s, 1.15 * s, C.bark, 0, 0, 0, 7);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72 * s, 0), mat(C.leaves));
    crown.position.y = 1.45 * s;
    g.add(crown);
    g.position.set(x, 0.36, z);
    statics.add(g);
  };
  [[-8.2, -4.3], [-5.2, -4.8], [-7.7, -1.7], [-5.1, -2.2], [0.9, -5.6], [0.8, 5.1]].forEach(([x, z], i) => tree(x, z, i === 4 ? 0.8 : 1));

  const building = (x, z, w, hgt, color) => {
    const g = new THREE.Group();
    box(g, w, hgt, 1.8, color);
    for (let row = 0; row < 3; row++) for (let col = -1; col <= 1; col++) box(g, 0.32, 0.28, 0.04, C.window, col * 0.58, 0.8 + row * 0.65, 0.92);
    g.position.set(x, 0.36, z);
    statics.add(g);
  };
  building(7.2, -5.4, 2.4, 3.4, 0xff8b67);
  building(4.8, -5.6, 1.8, 2.4, 0xffc45a);
  cyl(statics, 0.85, 0.95, 0.28, C.teal, 6, 0.35, -2.85, 12);
  cyl(statics, 0.5, 0.5, 0.12, C.fountain, 6, 0.63, -2.85, 12);
  {
    const g = new THREE.Group();
    cyl(g, 0.07, 0.07, 1.7, C.navy, 0, 0, 0, 8);
    cone(g, 1.15, 0.5, 8, C.coral).position.y = 1.7;
    g.position.set(7.6, 0.38, 4.6);
    statics.add(g);
  }

  // Old Mill Market: a paved yard, the old mill and a row of growers' stalls.
  box(statics, 5.6, 0.16, 4.2, C.yard, -6.8, 0.2, 4.7);
  {
    const g = new THREE.Group();
    box(g, 1.7, 1.9, 1.9, C.mill);
    const roof = cone(g, 1.45, 0.95, 4, C.millRoof);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(0.9, 1, 0.98);
    roof.position.y = 1.9 + 0.47;
    box(g, 0.5, 0.8, 0.06, C.navy, 0.35, 0, 0.96); // door
    box(g, 0.36, 0.36, 0.06, C.window, -0.4, 1.05, 0.96); // window
    // The old water wheel on the stream side.
    const wheel = new THREE.Mesh(cylGeo(0.62, 0.62, 12), mat(C.bark));
    wheel.scale.y = 0.16;
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0.95, 0.72, -0.1);
    g.add(wheel);
    const hub = new THREE.Mesh(cylGeo(0.14, 0.14, 8), mat(C.navy));
    hub.scale.y = 0.24;
    hub.rotation.z = Math.PI / 2;
    hub.position.set(1.0, 0.72, -0.1);
    g.add(hub);
    g.position.set(-9.0, 0.36, 3.7);
    statics.add(g);
  }
  [
    [-8.6, C.coral, C.orange],
    [-7.0, C.teal, C.lime],
    [-5.4, C.lemon, C.coral],
  ].forEach(([x, awning, produce]) => {
    const g = new THREE.Group();
    box(g, 1.3, 0.55, 0.5, C.cream);
    for (let i = 0; i < 3; i++) box(g, 0.3, 0.14, 0.3, produce, -0.4 + i * 0.4, 0.55, 0);
    cyl(g, 0.04, 0.04, 1.25, C.navy, -0.6, 0, 0.2, 6);
    cyl(g, 0.04, 0.04, 1.25, C.navy, 0.6, 0, 0.2, 6);
    const top = box(g, 1.45, 0.08, 0.7, awning, 0, 1.2, 0.05);
    top.rotation.x = -0.18;
    g.position.set(x, 0.36, 6.6);
    statics.add(g);
  });

  // Merge every static mesh into one draw per colour.
  scene.updateMatrixWorld(true);
  const byColor = new Map();
  statics.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    g.applyMatrix4(o.matrixWorld.clone().premultiply(new THREE.Matrix4().copy(world.matrixWorld).invert()));
    const key = o.material.color.getHex();
    if (!byColor.has(key)) byColor.set(key, []);
    byColor.get(key).push(g);
  });
  world.remove(statics);
  for (const [color, list] of byColor) {
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    if (merged) world.add(new THREE.Mesh(merged, mat(color)));
  }

  // ---- pitches: a ring each (own material, so hover colours stay local) and a pick target
  const rings = {};
  const hitTargets = [];
  const ringGeo = new THREE.RingGeometry(0.78, 1.05, 24);
  const hitGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.22, 16);
  const hitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const id of Object.keys(PITCHES)) {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: C.teal, flatShading: true, roughness: 0.9 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(PITCHES[id]);
    ring.position.y += 0.05;
    world.add(ring);
    rings[id] = ring;
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.copy(PITCHES[id]);
    hit.position.y += 0.15;
    hit.userData.location = id;
    hit.layers.set(HIT_LAYER);
    world.add(hit);
    hitTargets.push(hit);
  }

  // ---- the stand
  const stand = new THREE.Group();
  box(stand, 2.1, 1.15, 1.15, C.cream);
  box(stand, 2.3, 0.18, 1.35, C.lemon, 0, 1.13, 0);
  box(stand, 2.05, 0.38, 0.08, C.orange, 0, 0.63, 0.59);
  cyl(stand, 0.11, 0.11, 2.15, C.navy, -0.85, 1.2, -0.42, 8);
  cyl(stand, 0.11, 0.11, 2.15, C.navy, 0.85, 1.2, -0.42, 8);
  {
    const roof = cone(stand, 1.65, 0.55, 4, C.coral);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.62;
    roof.position.set(0, 3.18, -0.36);
    const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), mat(C.lemon));
    fruit.scale.x = 1.25;
    fruit.position.set(0, 2.35, 0.62);
    stand.add(fruit);
  }
  cyl(stand, 0.23, 0.2, 0.46, C.pitcher, 0.4, 1.33, 0.25, 10);
  world.add(stand);

  // ---- props that follow the plan (rebuilt only when the plan changes)
  const props = new THREE.Group();
  world.add(props);
  const torusGeo = new THREE.TorusGeometry(0.28, 0.06, 6, 12);
  let propsKey = '';
  const buildProps = (v) => {
    props.clear();
    const G = PITCHES[v.selected];
    const crates = Math.max(1, Math.ceil(v.prepared / 20));
    for (let i = 0; i < crates; i++) box(props, 0.5, 0.42, 0.5, C.orange, G.x - 1.4 - (i % 2) * 0.52, G.y, G.z + Math.floor(i / 2) * 0.52).rotation.y = 0.12 * i;
    if (v.transport === 'bike') {
      const g = new THREE.Group();
      for (const x of [0, 0.9]) {
        const wheel = new THREE.Mesh(torusGeo, mat(C.navy));
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(x, 0.34, 0);
        g.add(wheel);
      }
      box(g, 0.75, 0.08, 0.08, C.coral, 0.45, 0.53, 0);
      g.position.set(G.x + 1.5, G.y, G.z - 0.8);
      props.add(g);
    }
    if (v.transport === 'van') {
      const g = new THREE.Group();
      box(g, 1.75, 0.85, 0.9, C.teal, 0, 0.24, 0);
      box(g, 0.7, 0.55, 0.88, C.cream, 0.55, 1, 0);
      g.position.set(G.x + 1.8, G.y, G.z - 1.2);
      g.rotation.y = -0.22;
      props.add(g);
    }
    if (v.marketing !== 'none') box(props, 0.65, 0.8, 0.1, v.marketing === 'chalk' ? C.navy : C.coral, G.x + 1.35, G.y, G.z + 0.85);
    if (v.staff) {
      const g = new THREE.Group();
      cyl(g, 0.18, 0.23, 0.62, STAFF_COLOR[v.staff] ?? C.teal, 0, 0.28, 0, 7);
      cyl(g, 0.17, 0.17, 0.34, C.staffHead, 0, 0.9, 0, 9);
      g.position.set(G.x + 0.76, G.y, G.z + 0.55);
      props.add(g);
    }
    const up = v.upgrades;
    if (up.includes('sign')) box(props, 0.9, 0.72, 0.12, C.lemon, G.x - 1.35, G.y + 0.55, G.z - 0.4);
    if (up.includes('cooler')) box(props, 0.75, 0.58, 0.62, C.teal, G.x + 1.35, G.y, G.z - 0.15);
    if (up.includes('pitcher')) cyl(props, 0.22, 0.2, 0.48, C.pitcher, G.x - 0.38, G.y + 1.25, G.z + 0.2, 10);
    if (up.includes('umbrella')) {
      cyl(props, 0.05, 0.05, 2.1, C.navy, G.x + 1.05, G.y, G.z + 0.15, 8);
      cone(props, 1.05, 0.4, 8, C.coral).position.set(G.x + 1.05, G.y + 2.05, G.z + 0.15);
    }
    if (up.includes('facelift')) box(props, 1.78, 0.22, 0.09, C.teal, G.x, G.y + 0.72, G.z + 0.64);
    if (up.includes('festival')) {
      for (let i = 0; i < 6; i++) {
        const flag = cone(props, 0.13, 0.28, 3, i % 2 ? C.lemon : C.teal);
        flag.rotation.z = Math.PI;
        flag.position.set(G.x - 0.72 + i * 0.29, G.y + 2.86 - Math.abs(2.5 - i) * 0.05, G.z + 0.55);
      }
    }
    if (up.includes('rail')) {
      box(props, 2.35, 0.12, 0.12, C.teal, G.x, G.y + 1.05, G.z + 0.78);
      cyl(props, 0.05, 0.05, 0.65, C.navy, G.x - 0.92, G.y + 0.48, G.z + 0.78, 7);
      cyl(props, 0.05, 0.05, 0.65, C.navy, G.x + 0.92, G.y + 0.48, G.z + 0.78, 7);
    }
    if (up.includes('tasting')) {
      box(props, 0.9, 0.12, 0.48, C.coral, G.x + 1.25, G.y + 0.82, G.z + 0.72);
      for (let i = 0; i < 3; i++) cyl(props, 0.07, 0.065, 0.18, C.pitcher, G.x + 0.98 + i * 0.26, G.y + 0.9, G.z + 0.72, 8);
    }
  };

  // ---- customers: four instanced parts, coloured per instance
  const walkerCount = Math.max(8, kit.detail(16));
  const partMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 });
  const legMat = mat(C.navy);
  const bodies = new THREE.InstancedMesh(cylGeo(0.18, 0.22, 7), partMat, walkerCount);
  const heads = new THREE.InstancedMesh(cylGeo(0.17, 0.17, 9), partMat, walkerCount);
  const legs = new THREE.InstancedMesh(cylGeo(0.07, 0.07, 6), legMat, walkerCount * 2);
  const cups = new THREE.InstancedMesh(cylGeo(0.075, 0.06, 8), mat(C.lemon), walkerCount);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < walkerCount; i++) {
    bodies.setColorAt(i, tmpColor.setHex(WALKER_COLORS[i % WALKER_COLORS.length]));
    heads.setColorAt(i, tmpColor.setHex(SKIN[i % SKIN.length]));
  }
  for (const m of [bodies, heads, legs, cups]) {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    world.add(m);
  }
  // Local part transforms (relative to the walker's feet), from the original figures.
  const partBody = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.3 + 0.29, 0), new THREE.Quaternion(), new THREE.Vector3(1, 0.58, 1));
  const partHead = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.88 + 0.17, 0), new THREE.Quaternion(), new THREE.Vector3(1, 0.34, 1));
  // The cup sits in the hand on the camera's side of a walker heading along +x.
  const partCup = new THREE.Matrix4().compose(new THREE.Vector3(-0.24, 0.62, 0.05), new THREE.Quaternion(), new THREE.Vector3(1, 0.2, 1));
  const legScale = new THREE.Vector3(1, 0.42, 1);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const mWalker = new THREE.Matrix4();
  const mPart = new THREE.Matrix4();
  const mLeg = new THREE.Matrix4();
  const vPos = new THREE.Vector3();
  const vScale = new THREE.Vector3();
  const qYaw = new THREE.Quaternion();
  const qSwing = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const legPos = new THREE.Vector3();
  const hip = new THREE.Vector3();
  const hideWalkers = () => {
    for (let i = 0; i < walkerCount; i++) {
      bodies.setMatrixAt(i, hidden);
      heads.setMatrixAt(i, hidden);
      cups.setMatrixAt(i, hidden);
      legs.setMatrixAt(i * 2, hidden);
      legs.setMatrixAt(i * 2 + 1, hidden);
    }
    for (const m of [bodies, heads, legs, cups]) m.instanceMatrix.needsUpdate = true;
  };
  hideWalkers();
  let walkersShown = false;

  // A cheap per-walker coin flip that changes every lap.
  const hash = (n) => {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };

  function updateWalkers(v, t) {
    const G = PITCHES[v.selected];
    const bob = !v.reducedMotion;
    for (let i = 0; i < walkerCount; i++) {
      const raw = v.progress * 1.4 + i / walkerCount;
      const lap = Math.floor(raw);
      const p = raw - lap;
      const lane = (i % 3) * 0.52 - 0.52;
      const buyer = v.stockLeft > 0 && hash(i * 131 + lap * 7919) < v.buyRatio;
      let x;
      let dz = 0;
      let waiting = false;
      if (buyer) {
        // Walk up, wait at the counter, leave with a cup.
        if (p < 0.4) x = -4 + (p / 0.4) * 4;
        else if (p < 0.55) {
          x = 0;
          waiting = true;
        } else x = ((p - 0.55) / 0.45) * 4;
        const near = Math.max(0, 1 - Math.abs(x) / 1.6);
        dz = -near * near * (3 - 2 * near) * (1.35 + lane);
      } else {
        x = -4 + p * 8;
      }
      vPos.set(G.x + x + (waiting ? (i % 2 ? 0.3 : -0.3) : 0), G.y, G.z + 2.1 + lane + dz);
      if (bob && !waiting) vPos.y += Math.abs(Math.sin(t * 8 + i)) * 0.06;
      qYaw.setFromAxisAngle(axisY, waiting ? Math.PI : Math.PI / 2);
      const s = 0.82 + (i % 3) * 0.08;
      vScale.set(s, s, s);
      mWalker.compose(vPos, qYaw, vScale);
      bodies.setMatrixAt(i, mPart.multiplyMatrices(mWalker, partBody));
      heads.setMatrixAt(i, mPart.multiplyMatrices(mWalker, partHead));
      if (buyer && p > 0.5) cups.setMatrixAt(i, mPart.multiplyMatrices(mWalker, partCup));
      else cups.setMatrixAt(i, hidden);
      const swing = bob && !waiting ? Math.sin(t * 8 + i) * 0.35 : 0;
      for (let k = 0; k < 2; k++) {
        // Hip pivot at y 0.37; the leg hangs 0.42 below it.
        qSwing.setFromAxisAngle(axisX, k ? swing : -swing);
        hip.set(k ? 0.11 : -0.11, 0.37, 0);
        legPos.set(0, -0.21, 0).applyQuaternion(qSwing).add(hip);
        mLeg.compose(legPos, qSwing, legScale);
        legs.setMatrixAt(i * 2 + k, mPart.multiplyMatrices(mWalker, mLeg));
      }
    }
    for (const m of [bodies, heads, legs, cups]) m.instanceMatrix.needsUpdate = true;
  }

  // ---- coins popping over the counter as cups sell
  const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc93d, emissive: 0x6b4a00, metalness: 0.35, roughness: 0.4 });
  const coins = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.visible = false;
    world.add(m);
    coins.push({ mesh: m, age: 1, spin: 0 });
  }
  let nextCoin = 0;
  const popCoin = () => {
    const c = coins[nextCoin];
    nextCoin = (nextCoin + 1) % coins.length;
    c.age = 0;
    c.spin = Math.random() * Math.PI;
    c.dx = (Math.random() - 0.5) * 0.5;
    c.mesh.visible = true;
  };
  function updateCoins(dt, reducedMotion) {
    for (const c of coins) {
      if (c.age >= 1) continue;
      c.age = Math.min(1, c.age + dt / 0.9);
      const G = stand.position;
      const k = c.age;
      c.mesh.position.set(G.x + c.dx, G.y + 1.5 + k * 1.3, G.z + 0.7);
      c.mesh.rotation.set(Math.PI / 2, 0, reducedMotion ? 0 : c.spin + k * 9);
      c.mesh.scale.setScalar(k > 0.7 ? Math.max(0.01, (1 - k) / 0.3) : Math.min(1, k * 6));
      if (c.age >= 1) c.mesh.visible = false;
    }
  }

  // ---- camera: orbit (yaw) and zoom, both smoothed
  const cam = { yaw: BASE_YAW, yawTarget: BASE_YAW, zoom: 1, zoomTarget: 1, target: new THREE.Vector3(), focus: new THREE.Vector3() };
  const fit = () => {
    const w = Math.max(1, kit.size.width);
    const hgt = Math.max(1, kit.size.height);
    const aspect = w / hgt;
    camera.left = -HALF_HEIGHT * aspect;
    camera.right = HALF_HEIGHT * aspect;
    camera.top = HALF_HEIGHT;
    camera.bottom = -HALF_HEIGHT;
    camera.updateProjectionMatrix();
  };
  kit.onResize(fit);

  // ---- weather and time of day
  const sunColor = new THREE.Color();
  const warm = new THREE.Color(0xffc98a);
  let weather = 'Sunny';
  const setWeather = (label) => {
    weather = label;
    scene.background.setHex(SKY[label] ?? SKY.Sunny);
  };

  // ---- picking
  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(HIT_LAYER);
  const ndc = new THREE.Vector2();
  const hits = [];
  const pick = (nx, ny) => {
    ndc.set(nx, ny);
    raycaster.setFromCamera(ndc, camera);
    hits.length = 0;
    raycaster.intersectObjects(hitTargets, false, hits);
    return hits[0]?.object.userData.location ?? null;
  };

  // ---- label projection
  const labelPos = new THREE.Vector3();
  const project = (id, lift, out) => {
    labelPos.copy(PITCHES[id]);
    labelPos.y += lift;
    labelPos.applyMatrix4(world.matrixWorld).project(camera);
    out.x = ((labelPos.x + 1) / 2) * kit.size.width;
    out.y = ((1 - labelPos.y) / 2) * kit.size.height;
    out.visible = labelPos.z < 1;
    return out;
  };

  let hovered = null;
  let lastSales = -1;

  /**
   * v: { selected, phase, progress, prepared, transport, marketing, staff, upgrades,
   *      reducedMotion, weather, stockLeft, buyRatio, sold }
   */
  function update(dt, t, v, look, zoomDelta) {
    if (v.weather !== weather) setWeather(v.weather);

    const key = v.key;
    if (key !== propsKey) {
      propsKey = key;
      stand.position.copy(PITCHES[v.selected]);
      stand.position.y += 0.01;
      buildProps(v);
    }

    for (const id in rings) {
      const ring = rings[id];
      const selected = id === v.selected;
      ring.scale.setScalar(selected ? (v.reducedMotion ? 1 : 1 + Math.sin(t * 4) * 0.06) : 0.72);
      ring.visible = v.phase === 'plan' || selected;
      ring.material.color.setHex(id === hovered && v.phase === 'plan' ? C.white : selected ? C.lemon : C.teal);
    }
    stand.rotation.y = v.reducedMotion ? 0 : Math.sin(t * 0.8) * 0.018;

    const open = v.phase === 'open';
    if (open) {
      updateWalkers(v, t);
      walkersShown = true;
      if (lastSales >= 0 && v.sold > lastSales) popCoin();
      lastSales = v.sold;
    } else {
      if (walkersShown) hideWalkers();
      walkersShown = false;
      lastSales = -1;
    }
    updateCoins(dt, v.reducedMotion);

    // Sun: a gentle arc through the open day, warming toward closing time.
    const rain = weather === 'Rain';
    const baseIntensity = rain ? 1.8 : weather === 'Cloudy' ? 2.4 : 3.4;
    sunColor.setHex(rain ? 0xdce7ee : 0xfff3c2);
    if (open && !rain) {
      const arc = (v.progress - 0.5) * 1.1;
      sun.position.set(7 * Math.cos(arc) - 4 * Math.sin(arc), 13 - Math.abs(arc) * 3, 4 * Math.cos(arc) + 7 * Math.sin(arc));
      sunColor.lerp(warm, Math.max(0, (v.progress - 0.65) / 0.35) * 0.55);
      sun.intensity = baseIntensity * (1 - Math.max(0, v.progress - 0.8) * 0.5);
    } else {
      sun.position.set(7, 13, 4);
      sun.intensity = baseIntensity;
    }
    sun.color.copy(sunColor);

    // Camera orbit and zoom.
    cam.yawTarget -= look.x;
    if (!v.reducedMotion) cam.yawTarget -= dt * 0.002;
    cam.zoomTarget = Math.min(2.6, Math.max(0.8, cam.zoomTarget * Math.exp(zoomDelta * 0.25)));
    const k = 1 - Math.exp(-10 * dt);
    cam.yaw += (cam.yawTarget - cam.yaw) * k;
    cam.zoom += (cam.zoomTarget - cam.zoom) * k;
    const focusAmount = Math.min(1, Math.max(0, (cam.zoom - 1) / 1.4)) * 0.85;
    cam.focus.copy(stand.position).applyMatrix4(world.matrixWorld).multiplyScalar(focusAmount);
    cam.target.lerp(cam.focus, 1 - Math.exp(-6 * dt));
    camera.position.set(cam.target.x + Math.sin(cam.yaw) * CAM_RADIUS, cam.target.y + CAM_HEIGHT, cam.target.z + Math.cos(cam.yaw) * CAM_RADIUS);
    camera.lookAt(cam.target);
    if (camera.zoom !== cam.zoom) {
      camera.zoom = cam.zoom;
      camera.updateProjectionMatrix();
    }
    // The map labels are projected before this frame renders: bring the view
    // matrix up to date now so they do not trail the camera by a frame.
    camera.updateMatrixWorld();
  }

  return {
    scene,
    camera,
    update,
    render() {
      renderer.render(scene, camera);
    },
    pick,
    project,
    setHovered(id) {
      hovered = id;
    },
    recenter() {
      cam.yawTarget = BASE_YAW + Math.round((cam.yaw - BASE_YAW) / (Math.PI * 2)) * Math.PI * 2;
      cam.zoomTarget = 1;
    },
    zoomBy(steps) {
      cam.zoomTarget = Math.min(2.6, Math.max(0.8, cam.zoomTarget * Math.exp(steps * 0.25)));
    },
    /** Build every prop once and compile all pipelines, so nothing stutters later. */
    async warm(v) {
      buildProps({ ...v, transport: 'van', marketing: 'chalk', staff: 'mia', upgrades: ['sign', 'cooler', 'pitcher', 'umbrella', 'facelift', 'festival', 'rail', 'tasting'] });
      // The bike's torus and every crew colour are not in that set: add one of each.
      const G = PITCHES[v.selected];
      const wheel = new THREE.Mesh(torusGeo, mat(C.navy));
      wheel.position.set(G.x, G.y, G.z);
      props.add(wheel);
      for (const c of Object.values(STAFF_COLOR)) box(props, 0.1, 0.1, 0.1, c, G.x, G.y, G.z);
      for (const c of coins) c.mesh.visible = true;
      updateWalkers({ ...v, progress: 0.3, stockLeft: 10, buyRatio: 0.5 }, 0);
      try {
        await renderer.compileAsync(scene, camera);
      } catch {
        /* compiling ahead is only an optimisation */
      }
      for (const c of coins) c.mesh.visible = false;
      hideWalkers();
      propsKey = '';
    },
  };
}
