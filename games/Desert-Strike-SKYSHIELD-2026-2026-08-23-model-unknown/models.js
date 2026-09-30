/**
 * models.js — SKYSHIELD's low-poly craft and markers, rebuilt from the
 * original scene graph with shared geometries and one material per colour
 * (the React build created a fresh material for every mesh).
 */

import * as THREE from 'three/webgpu';

const PI = Math.PI;

/* ------------------------------------------------ shared geometry */

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  dodeca: new THREE.DodecahedronGeometry(1, 0),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  sphere: new THREE.SphereGeometry(1, 10, 7),
  plane: new THREE.PlaneGeometry(1, 1),
  ring: new THREE.RingGeometry(0.72, 1, 32),
  octa0: new THREE.OctahedronGeometry(1, 0),
  octa1: new THREE.OctahedronGeometry(1, 1),
  tailBoom: new THREE.CylinderGeometry(1, 0.65, 1, 6),
  bigTail: new THREE.CylinderGeometry(1, 0.55, 1, 6),
  wheel: new THREE.CylinderGeometry(0.52, 0.52, 0.35, 10),
  jammerDome: new THREE.SphereGeometry(0.55, 8, 6),
  bossTorus: new THREE.TorusGeometry(4.4, 0.18, 8, 40),
  cone2: new THREE.ConeGeometry(1, 2, 4),
  diamondA: new THREE.RingGeometry(1.45, 1.55, 4),
  diamondB: new THREE.RingGeometry(1.82, 1.88, 4),
  bossDiamondA: new THREE.RingGeometry(4.8, 5, 4),
  bossDiamondB: new THREE.RingGeometry(5.3, 5.36, 4),
  padDisc: new THREE.CircleGeometry(5, 32),
  padRing: new THREE.RingGeometry(4.2, 4.6, 32),
};

/* ------------------------------------------------ shared materials */

const cache = new Map();
const keyOf = (kind, color, o) => `${kind}|${color}|${Object.entries(o).sort().map(([k, v]) => `${k}=${v}`).join(',')}`;

/** A MeshStandardMaterial shared by everything with the same colour and options. */
export function std(color, o = {}) {
  const key = keyOf('s', color, o);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, ...o });
    cache.set(key, m);
  }
  return m;
}

/** A shared MeshBasicMaterial (unlit). */
export function basic(color, o = {}) {
  const key = keyOf('b', color, o);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, ...o });
    cache.set(key, m);
  }
  return m;
}

/** Every shared material created so far (for pre-compiling). */
export const allMaterials = () => [...cache.values()];

export function mesh(geo, mat, { p, r, s, cast = false, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s !== undefined) {
    if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]);
    else m.scale.setScalar(s);
  }
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ------------------------------------------------ VQ-88 Nightjar (flight) */

export function buildNightjar(accent) {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  group.add(
    mesh(GEO.octa1, std('#3d6364', { metalness: 0.32, roughness: 0.5, flatShading: true }), { s: [0.72, 0.46, 1.35], cast: true }),
    mesh(GEO.tailBoom, std('#294448', { flatShading: true }), { p: [0, 0.1, 0.98], r: [PI / 2, 0, 0], s: [0.08, 0.08, 1.65] }),
    mesh(GEO.box, std('#294448'), { p: [0, 0.12, 2.05], s: [0.7, 0.06, 0.32] }),
    mesh(GEO.octa0, std('#14282d', { metalness: 0.65 }), { p: [0, 0.02, -0.9], s: [0.58, 0.32, 0.45] }),
    mesh(GEO.cyl6, std('#192a2d'), { p: [0.68, -0.2, 0.05], s: [0.12, 0.12, 0.85] }),
    mesh(GEO.cyl6, std('#192a2d'), { p: [-0.68, -0.2, 0.05], s: [0.12, 0.12, 0.85] })
  );
  const bladeMat = basic('#b7cbc6', { transparent: true, opacity: 0.58 });
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 0.76, 0.25);
  mainRotor.add(mesh(GEO.box, bladeMat, { s: [3.25, 0.025, 0.1] }), mesh(GEO.box, bladeMat, { s: [0.1, 0.025, 3.25] }));
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.03, 0.22, 2.35);
  const tailMat = basic('#a9c0bc');
  tailRotor.add(mesh(GEO.box, tailMat, { s: [0.55, 0.025, 0.07] }), mesh(GEO.box, tailMat, { s: [0.07, 0.025, 0.55] }));
  const light = new THREE.PointLight(accent, 4, 6);
  light.position.set(0, -0.1, -1);
  group.add(mainRotor, tailRotor, light);
  return {
    group,
    light,
    spin(dt, reduced) {
      mainRotor.rotation.y += dt * (reduced ? 6 : 16);
      tailRotor.rotation.z += dt * (reduced ? 7 : 19);
    },
  };
}

/* ------------------------------------------------ title-screen gunship */

export function buildShowcaseHeli(color = '#5c6159') {
  const root = new THREE.Group();
  root.rotation.set(0.04, -0.55, -0.08);
  root.add(
    mesh(GEO.octa1, std(color, { roughness: 0.66, metalness: 0.32, flatShading: true }), { s: [1.3, 0.68, 2.4], cast: true }),
    mesh(GEO.octa0, std('#172b2e', { metalness: 0.55, roughness: 0.25, flatShading: true }), { p: [0, 0.15, -1.55], s: [0.92, 0.46, 0.75] }),
    mesh(GEO.bigTail, std('#263e42', { flatShading: true }), { p: [0, 0.1, 2.5], r: [PI / 2, 0, 0], s: [0.16, 0.16, 3] }),
    mesh(GEO.box, std('#263e42'), { p: [0, 0.18, 4.35], s: [1.3, 0.08, 0.58] }),
    mesh(GEO.cyl6, std('#1a292b', { metalness: 0.7 }), { p: [0.65, -0.42, -0.15], r: [0, 0, -0.12], s: [0.2, 0.2, 1.7] }),
    mesh(GEO.cyl6, std('#1a292b', { metalness: 0.7 }), { p: [-0.65, -0.42, -0.15], r: [0, 0, 0.12], s: [0.2, 0.2, 1.7] })
  );
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.05, 0.4);
  const blade = std('#7c9290', { transparent: true, opacity: 0.72 });
  rotor.add(mesh(GEO.box, blade, { s: [5.5, 0.035, 0.22] }), mesh(GEO.box, blade, { s: [0.22, 0.035, 5.5] }), mesh(GEO.cyl8, std('#ffbd59'), { s: [0.25, 0.18, 0.25] }));
  const tail = new THREE.Group();
  tail.position.set(0.06, 0.28, 4.52);
  const tb = basic('#a8b9b5');
  tail.add(mesh(GEO.box, tb, { s: [1.1, 0.05, 0.12] }), mesh(GEO.box, tb, { s: [0.12, 0.05, 1.1] }));
  const light = new THREE.PointLight('#ffbd59', 3.2, 5);
  light.position.set(0, -0.2, -1.9);
  root.add(rotor, tail, light);
  return {
    group: root,
    update(dt, t, moving) {
      if (moving) {
        rotor.rotation.y += dt * 11;
        tail.rotation.z += dt * 14;
        root.rotation.z = Math.sin(t * 0.55) * 0.025 - 0.09;
      }
    },
  };
}

/* ------------------------------------------------ hostiles */

export function enemyColor(kind, threatColor, palette) {
  return kind === 'boss' || kind === 'sam' || kind === 'drone' ? threatColor : palette[kind];
}

function bossModel(biome, color) {
  const g = new THREE.Group();
  if (biome === 'steppe') {
    g.add(mesh(GEO.box, std('#57322b', { metalness: 0.65 }), { s: [2.1, 1.1, 5.4], cast: true }), mesh(GEO.box, std(color), { p: [0, 1.2, -1.4], s: [1.6, 0.8, 1.7] }));
    for (const n of [-2.7, -0.9, 0.9, 2.7]) for (const i of [-1.8, 1.8]) g.add(mesh(GEO.wheel, std('#171a19'), { p: [i, -0.9, n], r: [0, 0, PI / 2] }));
  } else if (biome === 'megacity') {
    g.add(mesh(GEO.box, std('#352d4a', { metalness: 0.55 }), { s: [3.6, 1, 3.6], cast: true }));
    [-1.5, 0, 1.5].forEach((n, i) => g.add(mesh(GEO.box, std(i === 1 ? color : '#483c62'), { p: [n, 1.2 + i * 0.6, 0], s: [0.75, 1.4 + i * 0.5, 0.75] })));
    g.add(mesh(GEO.cyl6, basic('#d7b3ff'), { p: [0, 4.3, 0], s: [0.12, 1.8, 0.12] }));
  } else if (biome === 'desert') {
    g.add(mesh(GEO.octa1, std('#61352f', { metalness: 0.7, flatShading: true }), { s: [3.8, 0.48, 3.8] }), mesh(GEO.bossTorus, basic(color), { r: [PI / 2, 0, 0] }));
    for (const n of [0, PI / 2, PI, PI * 1.5]) g.add(mesh(GEO.octa0, std(color), { p: [Math.cos(n) * 3.1, 0, Math.sin(n) * 3.1], s: 0.55 }));
  } else if (biome === 'arctic') {
    g.add(
      mesh(GEO.cone2, std('#3a4d52', { metalness: 0.7, flatShading: true }), { s: [2.8, 1.2, 5.5], r: [0, 0, PI] }),
      mesh(GEO.box, std(color), { p: [0, 1.2, 0], s: [1.7, 0.65, 2.2] })
    );
    for (const n of [-1.2, 1.2]) g.add(mesh(GEO.cyl6, std('#c4e4e7'), { p: [n, 2.2, 0], s: [0.3, 1.2, 0.3] }));
  } else {
    g.add(mesh(GEO.box, std('#3b4240', { metalness: 0.68 }), { s: [4.4, 0.75, 2.7], cast: true }), mesh(GEO.box, std(color), { p: [0, 1.1, 0], s: [2.4, 0.55, 1.7] }));
    for (const n of [-2.1, 0, 2.1]) g.add(mesh(GEO.cyl6, std('#252928'), { p: [n, 1.9, 0], s: [0.28, 1.1, 0.28] }));
  }
  return g;
}

/** The craft for one hostile; `body` is what flinches when hit. */
export function buildEnemyModel(kind, biome, color) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  if (kind === 'drone') {
    body.add(
      mesh(GEO.octa0, std(color, { flatShading: true }), { s: [0.65, 0.18, 0.65], cast: true }),
      mesh(GEO.box, basic('#d7b9ad'), { s: [1.15, 0.04, 0.12] }),
      mesh(GEO.box, basic('#d7b9ad'), { s: [0.12, 0.04, 1.15] })
    );
  } else if (kind === 'boss') {
    body.add(bossModel(biome, color));
  } else {
    body.add(
      mesh(GEO.box, std(color, { metalness: 0.4, roughness: 0.58 }), { p: [0, 0.3, 0], s: [kind === 'tank' ? 1.25 : 0.9, 0.45, kind === 'gunboat' ? 1.7 : 1.15], cast: true }),
      mesh(GEO.box, std('#342b29'), { p: [0, 0.78, -0.1], s: [0.55, 0.25, 0.58] })
    );
    if (kind === 'sam') body.add(mesh(GEO.cyl6, std('#e9d6ac'), { p: [0, 1.2, 0.1], r: [0.6, 0, 0], s: [0.14, 0.14, 1.1] }));
    if (kind === 'jammer') body.add(mesh(GEO.jammerDome, std('#c36fd3', { wireframe: true }), { p: [0, 1.35, 0] }));
    if (kind === 'gunboat') body.add(mesh(GEO.box, basic('#d9efe8', { transparent: true, opacity: 0.35 }), { p: [0, 0.02, 1.1], s: [0.7, 0.02, 0.9] }));
    // Ground units ride 0.8 above the terrain in the simulation; the original drew them
    // floating there. Their hulls now sit on the ground (the logic height is unchanged).
    body.position.y = -0.75;
  }
  return { group, body };
}

/** A billboard health bar (drawn over the scene, like the original). */
export function buildHealthBar(width, color) {
  const group = new THREE.Group();
  const bg = mesh(GEO.plane, basic('#241414', { depthTest: false, depthWrite: false, transparent: true }), { s: [width, 0.07, 1] });
  const fill = mesh(GEO.plane, basic(color, { depthTest: false, depthWrite: false, transparent: true }), { p: [0, 0, 0.01], s: [width, 0.07, 1] });
  bg.renderOrder = 20;
  fill.renderOrder = 21;
  group.add(bg, fill);
  return {
    group,
    set(frac) {
      const f = Math.max(0, Math.min(1, frac));
      fill.scale.x = Math.max(0.0001, width * f);
      fill.position.x = (-(1 - f) * width) / 2;
    },
  };
}

/** The amber diamond that rides on the tracked target. */
export function buildTrackMarker(color) {
  const group = new THREE.Group();
  const a = basic(color, { transparent: true, opacity: 0.78, depthTest: false, depthWrite: false });
  const b = basic(color, { transparent: true, opacity: 0.38, depthTest: false, depthWrite: false });
  const small = new THREE.Group();
  small.add(mesh(GEO.diamondA, a), mesh(GEO.diamondB, b, { r: [0, 0, PI / 4] }));
  const big = new THREE.Group();
  big.add(mesh(GEO.bossDiamondA, a), mesh(GEO.bossDiamondB, b, { r: [0, 0, PI / 4] }));
  for (const m of [...small.children, ...big.children]) m.renderOrder = 19;
  group.add(small, big);
  group.visible = false;
  return {
    group,
    setBoss(isBoss) {
      small.visible = !isBoss;
      big.visible = isBoss;
    },
  };
}

/* ------------------------------------------------ objective ring */

export function buildObjectiveMarker(kind, color) {
  const radius = kind === 'escort' ? 17 : kind === 'survive' ? 20 : kind === 'eliminate' || kind === 'boss' ? 3.8 : 8;
  const root = new THREE.Group();
  const float = new THREE.Group();
  root.add(float);
  const torus = new THREE.TorusGeometry(radius, 0.16, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 });
  float.add(mesh(torus, ringMat, { r: [PI / 2, 0, 0] }));
  const gem = mesh(GEO.octa0, basic(color), { p: [0, 2.8, 0], r: [0, PI / 4, 0], s: 0.55 });
  float.add(gem);
  if (kind === 'escort') {
    [-4, 0, 4].forEach((z, i) => float.add(mesh(GEO.box, std('#8baea4'), { p: [i % 2 ? 1.5 : -1.5, 0.55, z], s: [0.8, 0.55, 1.3], cast: true })));
  }
  const offset = Math.random() * 1e4;
  return {
    group: root,
    update(t, reduced, active) {
      if (reduced) return;
      // drei <Float speed 1.4 floatIntensity 0.25>, plus a slow spin and a pulse while the link is live.
      float.position.y = (Math.sin(((offset + t) / 4) * 1.4) / 10) * 0.25;
      gem.rotation.y += 0.02;
      ringMat.opacity = active ? 0.6 + Math.sin(t * 6) * 0.25 : 0.72;
    },
    dispose() {
      torus.dispose();
      ringMat.dispose();
    },
  };
}

/* ------------------------------------------------ forward arming & refuelling point */

export function buildFarp() {
  const g = new THREE.Group();
  const teal = basic('#69d8cd');
  g.add(
    mesh(GEO.padDisc, std('#17373a', { emissive: '#174f4e', emissiveIntensity: 0.3 }), { r: [-PI / 2, 0, 0], receive: true }),
    mesh(GEO.padRing, teal, { p: [0, 0.02, 0], r: [-PI / 2, 0, 0] }),
    mesh(GEO.box, teal, { p: [-1.5, 0.06, 0], s: [0.35, 0.05, 2] }),
    mesh(GEO.box, teal, { p: [1.5, 0.06, 0], s: [0.35, 0.05, 2] }),
    mesh(GEO.box, teal, { p: [0, 0.06, 0], s: [1.5, 0.05, 0.32] })
  );
  return g;
}
