/*
 * world.js — the Hollow Sea: terrain, ruins, landmarks, the dragon and every
 * creature, built from the engine's ellipsoids, rods and blocks exactly as the
 * original chapter built them, plus the Courier's Wind course and the Glass Wyrm.
 */
import * as THREE from 'three/webgpu';
import {
  TAU, V, rand, random, reseed, mix, material, materialFor, Geo, mesh, node, dyn, ellipsoid, block, rod, ringGeo, bake, mergeStatic, G_ROCK, G_SPH,
} from './engine.js';

export const MAT = {
  sand: material('b3a079', 1),
  rock: material('8b8270'),
  rockDark: material('646a60'),
  bone: material('c9c3a1'),
  boneDark: material('969982'),
  ivory: material('e4dcc0'),
  bronze: material('746147'),
  rust: material('8f5442'),
  teal: material('507e79'),
  dark: material('344546'),
  glow: material('74d7c4', 3),
  amber: material('e3ab64', 3),
};
/** A destroyed core or node. */
export const MAT_DEAD = material('3b4c47');
const GLASS = material('8fe6cf', 3);

export function groundHeight(x, z) {
  return 7 * Math.sin(x * 0.007) + 10 * Math.sin(z * 0.008) + 5 * Math.sin(x * 0.021 + z * 0.012) + 3 * Math.cos(z * 0.03 - x * 0.013) + 1.6 * Math.sin(x * 0.038 + z * 0.043);
}

export const POIS = [
  { id: 0, type: 'seal', name: 'The First Voice', short: 'I', x: -95, z: -95, description: 'A signal inside the ribs of a dead machine.' },
  { id: 1, type: 'seal', name: 'The Broken Choir', short: 'II', x: 170, z: -405, description: 'An old relay guarded by an armored sentinel.' },
  { id: 2, type: 'seal', name: 'The Last Breath', short: 'III', x: -175, z: -745, description: 'The last seal, beneath a ruined arch.' },
  { id: 3, type: 'gate', name: 'The Hollow Gate', short: 'IV', x: 0, z: -1080, description: 'Three voices can wake the gate.' },
  { id: 4, type: 'camp', name: 'Wayfarer’s Rest', short: '△', x: -285, z: -430, description: 'A shelter. Rest here to recover health and spirit.' },
  { id: 5, type: 'memory', name: 'A Dry Tide', short: '◇', x: -295, z: -150, description: 'An optional memory, left in the sand.' },
  { id: 6, type: 'memory', name: 'Names in Stone', short: '◇', x: 325, z: -665, description: 'An optional memory, carved into a fallen relay.' },
  { id: 7, type: 'trial', name: 'The Courier’s Wind', short: '≈', x: -335, z: -345, description: 'An old courier post. Its wind rings still answer a fast dragon.' },
  { id: 8, type: 'lair', name: 'The Sunken Keel', short: '✦', x: 400, z: -190, description: 'A buried carcass. Something made of glass still feeds on it.' },
];
for (const p of POIS) p.y = groundHeight(p.x, p.z);

/* ------------------------------------------------------------ the dragon */

export function makeDragon() {
  const root = node();
  const body = dyn(node());
  root.add(body);
  const hide = material('538a86');
  const skin = material('9f5b43');
  const wingMat = material('c29d66', 2);
  const white = material('ddd5ae');
  const darker = material('657c76');
  ellipsoid(body, 0, 0.15, 0.5, 1.42, 1.4, 3.8, hide);
  ellipsoid(body, 0, 1, -1.1, 1.34, 0.95, 2.3, white);
  for (let i = 0; i < 5; i++) {
    const z = -2.5 + i * 1.45;
    ellipsoid(body, 0, 1.2 - Math.abs(z) * 0.08, z, 1.26 - i * 0.09, 0.5, 0.85, i % 2 ? darker : white);
  }
  rod(body, [0, 0.5, -1.7], [0, 1.0, -4.1], 0.95, 0.6, skin);
  ellipsoid(body, 0, 1.1, -4.4, 0.8, 0.78, 1.45, white);
  ellipsoid(body, 0, 0.65, -5.45, 0.51, 0.28, 1.02, hide);
  rod(body, [0, 1.5, -4.5], [0, 3.5, -6.1], 0.65, 0.025, white, 5);
  rod(body, [0, 1.4, -4.8], [0, 1.6, -7.5], 0.4, 0.025, white, 5);
  for (const side of [-1, 1]) {
    ellipsoid(body, side * 0.7, 1.28, -4.74, 0.22, 0.18, 0.3, MAT.glow);
    rod(body, [side * 0.5, 1.8, -3.8], [side * 1.4, 2.8, -2.1], 0.34, 0.02, white, 5);
    rod(body, [side * 0.9, -0.4, -1.3], [side * 1.4, -2.05, -0.3], 0.32, 0.2, skin);
    rod(body, [side * 1.4, -2.05, -0.3], [side * 1.2, -2.5, -1.5], 0.2, 0.12, white);
    rod(body, [side * 0.9, -0.6, 2.1], [side * 1.6, -1.7, 3.2], 0.45, 0.3, skin);
    rod(body, [side * 1.6, -1.7, 3.2], [side * 1.0, -3.0, 3.4], 0.28, 0.12, white);
    for (let i = 0; i < 3; i++) rod(body, [side * 1.0, -3, 3.4], [side * (0.85 + i * 0.2), -3.3, 2.65 - i * 0.13], 0.11, 0.012, MAT.dark, 4);
  }
  const tail = [];
  let base = body;
  for (let i = 0; i < 7; i++) {
    const n = dyn(node());
    n.position.set(0, i === 0 ? 0.2 : 0, i === 0 ? 3.3 : 1.4);
    base.add(n);
    rod(n, [0, 0, 0], [0, -0.13, 1.7], 0.71 * (1 - i / 8), 0.63 * (1 - (i + 1) / 8), i % 2 ? hide : white);
    if (i < 5) rod(n, [0, 0.3, 0.3], [0, 1.1, 0.7], 0.25, 0.01, white, 4);
    tail.push(n);
    base = n;
  }
  const wings = [];
  for (const side of [-1, 1]) {
    const w = dyn(node());
    w.position.set(side * 0.8, 1, -1.1);
    body.add(w);
    const pts = [[0, 0, 0], [side * 4.5, 0.7, -1.8], [side * 11.6, 0.3, -0.1], [side * 9.2, -0.35, 2.9], [side * 6.4, -0.6, 5.3], [side * 3.3, -0.4, 3.5], [0, 0, 2.5]];
    const g = new Geo();
    const hub = [side * 4.1, 0.2, 0.3];
    for (let i = 0; i < pts.length; i++) {
      const t = 0.85 + rand() * 0.2;
      g.tri(hub, pts[i], pts[(i + 1) % pts.length], [t, t, t]);
    }
    w.add(mesh(g, wingMat));
    for (const i of [0, 2, 3, 4, 5, 6]) rod(w, pts[1], pts[i], i === 2 ? 0.22 : 0.11, 0.025, white, 5);
    rod(w, pts[0], pts[1], 0.44, 0.28, hide);
    rod(w, pts[1], pts[2], 0.26, 0.025, white);
    rod(w, pts[2], [side * 13.2, 0.8, -1.6], 0.15, 0.008, white, 4);
    wings.push(w);
  }
  // Bastion's armor plates: one node, shown only in that form.
  const armor = dyn(node());
  body.add(armor);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) ellipsoid(armor, side * (1.45 + i * 0.04), 0.55, 1.5 - i * 1.3, 0.48, 0.82, 0.75, darker);
  const rider = dyn(node());
  rider.position.set(0, 2.15, 0.25);
  body.add(rider);
  ellipsoid(rider, 0, 0.52, 0, 0.43, 0.77, 0.36, MAT.rust);
  ellipsoid(rider, 0, 1.48, -0.12, 0.34, 0.42, 0.33, white);
  block(rider, 0, 1.43, -0.43, 0.49, 0.1, 0.08, MAT.dark);
  ellipsoid(rider, 0, 1.72, 0.1, 0.37, 0.25, 0.38, MAT.boneDark);
  for (const s of [-1, 1]) {
    rod(rider, [s * 0.25, 0.05, 0.06], [s * 0.85, -0.57, 0.12], 0.19, 0.15, MAT.rust);
    rod(rider, [s * 0.85, -0.57, 0.12], [s * 0.68, -1.14, -0.36], 0.16, 0.11, MAT.dark);
    rod(rider, [s * 0.38, 0.7, -0.08], [s * 0.56, 0.3, -0.77], 0.16, 0.1, MAT.rust);
  }
  rod(rider, [0.56, 0.33, -0.78], [0.52, 0.38, -2.08], 0.11, 0.07, MAT.dark);
  rod(rider, [0.55, 0.39, -1.38], [0.55, 0.59, -1.62], 0.08, 0.07, MAT.bronze, 4);
  const scarf = dyn(node());
  scarf.position.set(0, 1.3, 0.22);
  const sg = new Geo();
  sg.quad([-0.18, 0, 0], [0.18, 0, 0], [0.28, -0.3, 2.5], [-0.2, -0.3, 2.7]);
  scarf.add(mesh(sg, MAT.rust));
  rider.add(scarf);
  bake(root);
  armor.visible = false;

  return {
    root, body, wings, tail, rider, scarf, armor, hide, skin, white, wingMat,
    animate(t, speed = 20, bank = 0, form = 0, dt = 1 / 60) {
      const flap = Math.sin(t * (speed > 50 ? 4.9 : 3.2));
      for (let i = 0; i < 2; i++) {
        const w = wings[i];
        const sign = i === 0 ? -1 : 1;
        w.rotation.z = sign * (0.07 + flap * 0.33);
        w.rotation.x = Math.cos(t * 3.2) * 0.06;
        w.scale.x = form === 2 ? 1.12 : form === 3 ? 0.88 : 1;
        w.scale.z = form === 1 ? 1.12 : 1;
      }
      // Frame-rate independent version of the old 12%-per-frame bank easing.
      body.rotation.z = mix(body.rotation.z, bank, 1 - Math.pow(0.88, dt * 60));
      body.rotation.x = Math.sin(t * 3.2) * 0.022;
      body.position.y = Math.sin(t * 3.2) * 0.2;
      for (let i = 0; i < tail.length; i++) {
        tail[i].rotation.y = Math.sin(t * 2.2 - i * 0.65) * (0.08 + i * 0.011);
        tail[i].rotation.x = Math.sin(t * 2 - i * 0.5) * 0.04;
      }
      scarf.rotation.y = Math.sin(t * 7) * 0.18;
      scarf.rotation.x = Math.sin(t * 5) * 0.12;
      armor.visible = form === 3;
    },
  };
}

/* ------------------------------------------------------------ creatures */

export function makeSkimmer(variant = 0) {
  const root = node();
  const m = variant ? MAT.boneDark : MAT.rust;
  ellipsoid(root, 0, 0, 0, 2.6, 1.9, 4.5, m);
  ellipsoid(root, 0, 1.1, -0.7, 2.3, 1.4, 3.6, MAT.bone);
  ellipsoid(root, 0, -0.25, 4.1, 1.6, 0.8, 1.2, MAT.dark);
  ellipsoid(root, 0, 0.1, 5.02, 0.68, 0.38, 0.25, MAT.amber);
  rod(root, [0, 1, 2.5], [0, 4.5, 4.6], 1, 0.02, MAT.bone, 5);
  const fins = [];
  for (const s of [-1, 1]) {
    const f = dyn(node());
    root.add(f);
    const g = new Geo();
    g.tri([s * 1.5, 1, -2], [s * 7.3, 0, -4], [s * 4.8, -0.8, 2.2]);
    f.add(mesh(g, variant ? MAT.teal : MAT.bronze));
    rod(f, [s * 1.2, 1, -2], [s * 7.5, 0, -4.3], 0.5, 0.025, MAT.bone);
    rod(f, [s * 2, -0.5, 1.2], [s * 5, -2.3, 3.2], 0.5, 0.26, m);
    rod(f, [s * 5, -2.3, 3.2], [s * 4.7, -2.7, 5.6], 0.28, 0.02, MAT.bone);
    fins.push(f);
  }
  rod(root, [0, 0.1, -2], [0, 0.4, -8], 1, 0.02, MAT.bone);
  bake(root);
  return {
    root, fins,
    animate(t) {
      root.rotation.z = Math.sin(t * 2.7) * 0.09;
      for (let i = 0; i < 2; i++) fins[i].rotation.z = Math.sin(t * 4.2) * 0.12 * (i ? 1 : -1);
    },
  };
}

export function makeSentinel(boss = false) {
  const root = node();
  const shell = boss ? material('b1b09a') : material('8d927f');
  const coreHex = boss ? 'd8a75d' : '71caba';
  const core = material(coreHex, 3);
  const scale = boss ? 1.6 : 1;
  root.scale.setScalar(scale);
  ellipsoid(root, 0, 0.4, 0, 3.3, 2.7, 7.2, MAT.dark);
  ellipsoid(root, 0, 2.05, -0.6, 3.8, 1.4, 6.4, shell);
  for (let i = 0; i < 6; i++) {
    const z = -5 + i * 2;
    ellipsoid(root, 0, 2.9, z, 3.05 - Math.abs(z) * 0.14, 0.75, 0.85, i % 2 ? shell : MAT.boneDark);
  }
  const fins = [];
  const nodes = [];
  for (const s of [-1, 1]) {
    const arm = dyn(node());
    root.add(arm);
    rod(arm, [s * 2.5, 1, -3], [s * 8.5, 1.4, -2], 1.9, 1.25, shell, 7);
    rod(arm, [s * 8.5, 1.4, -2], [s * 14, -1, 4], 1.35, 0.6, shell, 7);
    rod(arm, [s * 14, -1, 4], [s * 11, -2.2, 9.5], 0.65, 0.025, MAT.ivory);
    const g = new Geo();
    g.tri([s * 3, 0, -5], [s * 13, 0, 0], [s * 7, -1, 4], [0.65, 0.67, 0.57]);
    g.tri([s * 3, 0, -5], [s * 7, -1, 4], [s * 2, 0, 5], [0.76, 0.77, 0.65]);
    arm.add(mesh(g, MAT.teal));
    for (let i = 0; i < 4; i++) rod(arm, [s * (4 + i * 2), 0.6, -3 + i * 0.8], [s * (5.5 + i * 2), 2.8, -6 + i * 0.6], 0.44, 0.015, MAT.bone);
    // Each target node has its own material, so it can die (and change colour) alone.
    nodes.push(dyn(ellipsoid(arm, s * 8.1, 1.85, -0.8, 1.15, 0.85, 1.5, material(coreHex, 3))));
    fins.push(arm);
  }
  ellipsoid(root, 0, 0.2, 6.1, 2.4, 1.7, 2.7, MAT.bone);
  rod(root, [0, 1.6, 6.4], [0, 5.1, 9.2], 1.05, 0.02, MAT.ivory, 5);
  for (const s of [-1, 1]) {
    rod(root, [s * 1.6, 0.7, 7], [s * 3.5, 1.6, 10], 0.7, 0.02, shell);
    ellipsoid(root, s * 1.3, 0.7, 8.05, 0.4, 0.32, 0.35, core);
  }
  nodes.splice(1, 0, dyn(ellipsoid(root, 0, -0.4, 7.8, 1.25, 1.0, 0.68, material(coreHex, 3))));
  const tail = [];
  let base = root;
  for (let i = 0; i < 5; i++) {
    const n = dyn(node());
    n.position.set(0, 0, i === 0 ? -5.8 : -2.7);
    base.add(n);
    rod(n, [0, 0, 0], [0, 0.2, -3.1], 1.4 - i * 0.23, 1.15 - i * 0.22, i % 2 ? MAT.dark : shell);
    rod(n, [0, 0.4, -1], [0, 3.2 - i * 0.25, -2], 0.65 - i * 0.09, 0.015, MAT.bone, 5);
    tail.push(n);
    base = n;
  }
  if (boss) {
    const halo = mesh(ringGeo(4.5, 0.35, 36), material('9cae8b', 3, 0.7, true));
    halo.position.set(0, 3, -2);
    halo.rotation.x = Math.PI / 2;
    root.add(halo);
  }
  bake(root);
  return {
    root, fins, nodes, core, shell,
    animate(t, phase = 1) {
      root.rotation.z = Math.sin(t * 1.7) * 0.05;
      for (let i = 0; i < 2; i++) fins[i].rotation.z = (i ? 1 : -1) * Math.sin(t * (phase === 2 ? 3.1 : 1.8)) * 0.085;
      for (let i = 0; i < tail.length; i++) tail[i].rotation.y = Math.sin(t * 1.3 - i * 0.6) * 0.13;
      // Phase II turns every living core ember-orange (the old build only recoloured two tail lights).
      const h = phase === 2 ? 'f09d62' : coreHex;
      core.set(h);
      for (const n of nodes) if (!n.userData.dead) n.userData.mat.set(h);
    },
  };
}

/**
 * The Glass Wyrm: a burrowing serpent of chitin and living glass. Three targets:
 * the crystal crown on its head, the glass sac on its back, and the stinger.
 */
export function makeWyrm() {
  const root = node();
  const chitin = material('4f5d58');
  const chitinDark = material('38423e');
  const glassHex = '8fe6cf';
  const glass = material(glassHex, 3);
  const nodes = [];
  const head = dyn(node());
  head.position.set(0, 1.4, 14);
  root.add(head);
  ellipsoid(head, 0, 0, 0, 2.6, 2.0, 3.6, chitin);
  ellipsoid(head, 0, -1.1, 1.8, 2.0, 0.9, 2.6, MAT.boneDark);
  ellipsoid(head, 0, 0.5, 3.1, 1.3, 0.9, 1.2, chitinDark);
  for (const s of [-1, 1]) {
    ellipsoid(head, s * 1.35, 0.7, 2.5, 0.42, 0.32, 0.4, MAT.amber);
    rod(head, [s * 1.4, -0.9, 2.8], [s * 2.5, -1.6, 5.4], 0.45, 0.08, MAT.ivory, 5);
    rod(head, [s * 2.5, -1.6, 5.4], [s * 1.3, -1.9, 6.6], 0.18, 0.02, MAT.ivory, 4);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.42;
    rod(head, [Math.sin(a) * 1.4, 1.5, -0.4], [Math.sin(a) * 3.2, 4.8 - Math.abs(i - 2) * 0.7, -2.8], 0.5, 0.03, glass, 5);
  }
  nodes.push(dyn(ellipsoid(head, 0, 2.2, -0.7, 1.15, 0.95, 1.2, material(glassHex, 3))));
  const segs = [];
  let base = root;
  for (let i = 0; i < 8; i++) {
    const n = dyn(node());
    n.position.set(0, i === 0 ? 0.9 : 0, i === 0 ? 10.5 : -3.9);
    base.add(n);
    const r = 2.7 - i * 0.2;
    ellipsoid(n, 0, 0, -1.9, r, r * 0.8, 2.6, i % 2 ? chitin : chitinDark);
    ellipsoid(n, 0, -r * 0.55, -1.9, r * 0.8, 0.45, 2.2, MAT.bone);
    rod(n, [0, r * 0.55, -1.6], [0, r * 0.55 + 2.8 - i * 0.22, -3.2], 0.7 - i * 0.05, 0.02, glass, 5);
    for (const s of [-1, 1]) rod(n, [s * r * 0.8, 0, -1.2], [s * (r + 1.6), -1.2, -2.2], 0.32, 0.03, MAT.ivory, 4);
    segs.push(n);
    base = n;
  }
  nodes.push(dyn(ellipsoid(segs[2], 0, 2.9, -1.9, 1.9, 1.5, 2.3, material(glassHex, 3))));
  const tip = segs[segs.length - 1];
  rod(tip, [0, 0, -3], [0, 3.4, -7], 1.0, 0.35, chitin, 6);
  rod(tip, [0, 3.4, -7], [0, 5.8, -6.2], 0.35, 0.02, MAT.ivory, 5);
  nodes.push(dyn(ellipsoid(tip, 0, 3.6, -7.3, 0.95, 0.95, 1.3, material(glassHex, 3))));
  bake(root);
  return {
    root, nodes, segs, head, glass,
    animate(t, phase = 1) {
      root.rotation.z = Math.sin(t * 1.3) * 0.04;
      head.rotation.y = Math.sin(t * 1.1) * 0.12;
      head.rotation.x = Math.sin(t * 1.7) * 0.05;
      for (let i = 0; i < segs.length; i++) {
        segs[i].rotation.y = (i === 0 ? 0 : i % 2 ? 0.22 : -0.22) + Math.sin(t * 1.4 - i * 0.7) * 0.16;
        segs[i].rotation.x = Math.sin(t * 1.1 - i * 0.5) * 0.05;
      }
      // The glass runs amber while the wyrm calls down its glass rain.
      const h = phase === 2 ? 'e6b27a' : glassHex;
      glass.set(h);
      for (const n of nodes) if (!n.userData.dead) n.userData.mat.set(h);
    },
  };
}

/* ------------------------------------------------------------ ruins */

function addArch(parent, x, z, radius, height, depth = 6, broken = false) {
  const y = groundHeight(x, z);
  const segments = 18;
  for (let i = 0; i < segments; i++) {
    if (broken && i > 8 && i < 12) continue;
    const a = (i / segments) * Math.PI;
    const b = ((i + 1) / segments) * Math.PI;
    const pa = [x + Math.cos(a) * radius, y + Math.sin(a) * height, z];
    const pb = [x + Math.cos(b) * radius, y + Math.sin(b) * height, z + Math.sin(i) * 0.7];
    rod(parent, pa, pb, depth * (1 + 0.14 * Math.sin(i)), depth * (1 + 0.12 * Math.cos(i)), i % 4 ? MAT.boneDark : MAT.bone, 5);
  }
}

function addTower(parent, x, z, h, angle = 0) {
  const y = groundHeight(x, z);
  const g = node();
  g.position.set(x, y, z);
  g.rotation.z = angle;
  parent.add(g);
  block(g, 0, h * 0.48, 0, h * 0.17, h, h * 0.23, MAT.rockDark);
  block(g, 0, h * 0.54, h * 0.12, h * 0.13, h * 0.8, 1.2, MAT.boneDark);
  for (let k = 0; k < 5; k++) {
    block(g, 0, h * (0.15 + k * 0.16), 0, h * 0.23, 1.8, h * 0.28, MAT.bronze);
    for (const s of [-1, 1]) block(g, s * h * 0.066, h * (0.23 + k * 0.11), h * 0.125, 1.15, 3.4, 1.2, MAT.teal);
  }
  rod(g, [-h * 0.1, h * 0.85, 0], [0, h * 1.15, 0], h * 0.12, 0.1, MAT.bone, 5);
}

/** The courier post beside Wayfarer's Rest: plinth, mast, banner and two chimes. */
function addCourierPost(parent, x, z) {
  const y = groundHeight(x, z);
  block(parent, x, y + 2.5, z, 9, 5, 9, MAT.rockDark);
  block(parent, x, y + 5.6, z, 6, 1.4, 6, MAT.boneDark);
  rod(parent, [x, y + 5, z], [x, y + 31, z], 1.1, 0.55, MAT.bone, 6);
  rod(parent, [x - 8, y + 26, z], [x + 8, y + 26, z], 0.45, 0.45, MAT.bronze, 5);
  const flag = new Geo();
  flag.quad([x + 0.6, y + 29.5, z], [x + 12, y + 28, z + 1.5], [x + 11, y + 22, z + 2.2], [x + 0.6, y + 23, z]);
  parent.add(mesh(flag, MAT.teal));
  for (const s of [-1, 1]) {
    rod(parent, [x + s * 8, y + 26, z], [x + s * 8, y + 20.2, z], 0.12, 0.12, MAT.dark, 4);
    ellipsoid(parent, x + s * 8, y + 19.4, z, 0.9, 0.9, 0.9, MAT.amber);
  }
  // A ring of courier stones pointing the way north.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const sx = x + Math.cos(a) * 15;
    const sz = z + Math.sin(a) * 15;
    block(parent, sx, groundHeight(sx, sz) + 1.8, sz, 2.4, 3.6 + (i % 2) * 2, 2.4, i % 2 ? MAT.bone : MAT.rockDark);
  }
}

/** The Sunken Keel: a leviathan's ribcage half under the sand, with glass growing through it. */
function addKeel(parent, x, z) {
  const y = groundHeight(x, z);
  for (let i = 0; i < 11; i++) {
    const sx = x - 55 + i * 11;
    const sy = y + 16 + Math.sin(i * 0.45) * 4 - Math.abs(i - 5) * 1.6;
    ellipsoid(parent, sx, sy, z, 4.2, 3.2 - Math.abs(i - 5) * 0.12, 3.6, i % 2 ? MAT.bone : MAT.boneDark, G_ROCK);
    if (i === 0 || i === 10) continue;
    const len = 34 - Math.abs(i - 5) * 3.2;
    for (const s of [-1, 1]) {
      const mid = [sx + 3, sy + len * 0.35, z + s * len * 0.55];
      const ex = sx + 6;
      const ez = z + s * len * 0.95;
      rod(parent, [sx, sy, z + s * 2], mid, 1.9, 1.2, MAT.bone, 5);
      rod(parent, mid, [ex, groundHeight(ex, ez) - 2, ez], 1.2, 0.35, MAT.boneDark, 5);
    }
  }
  ellipsoid(parent, x + 68, y + 11, z, 11, 8, 9, MAT.bone, G_ROCK);
  ellipsoid(parent, x + 80, y + 5, z, 9, 4, 7, MAT.boneDark, G_ROCK);
  for (const s of [-1, 1]) rod(parent, [x + 74, y + 4, z + s * 5], [x + 92, y - 1, z + s * 7], 1.8, 0.4, MAT.ivory, 5);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 18 + ((i * 7) % 26);
    const gx = x + Math.cos(a) * r;
    const gz = z + Math.sin(a) * r;
    const gy = groundHeight(gx, gz);
    rod(parent, [gx, gy - 2, gz], [gx + Math.sin(a * 3) * 3, gy + 9 + (i % 3) * 5, gz + Math.cos(a * 2) * 3], 1.6 + (i % 2) * 0.8, 0.05, GLASS, 5);
  }
}

/* ------------------------------------------------------------ the world */

export function buildWorld(moteCount = 36) {
  reseed(63127);
  const root = node();
  const staticRoot = node();
  const terrain = new Geo();
  const nx = 116;
  const nz = 142;
  const x0 = -1400;
  const z0 = -1880;
  const stepX = 2800 / nx;
  const stepZ = 2800 / nz;
  const p = (a, b) => [a, groundHeight(a, b), b];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * stepX;
      const z = z0 + j * stepZ;
      const v = 0.94 + rand() * 0.095;
      terrain.quad(p(x, z), p(x, z + stepZ), p(x + stepX, z + stepZ), p(x + stepX, z), [v, v * 0.997, v * 0.98]);
    }
  }
  root.add(mesh(terrain, MAT.sand));

  for (let i = 0; i < 135; i++) {
    const a = (i / 135) * TAU;
    const rad = random(1060, 1360);
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad - 480;
    const h = random(85, 260);
    const r = ellipsoid(staticRoot, x, groundHeight(x, z) + h * 0.28, z, random(50, 150), h, random(70, 180), i % 2 ? MAT.rock : MAT.rockDark, G_ROCK);
    r.rotation.y = rand() * TAU;
    r.rotation.z = random(-0.3, 0.3);
  }
  for (let i = 0; i < 200; i++) {
    const x = random(-650, 650);
    const z = random(-1320, 280);
    const s = random(2, 14);
    const r = ellipsoid(staticRoot, x, groundHeight(x, z) + s * 0.2, z, s * random(0.7, 1.9), s * random(0.5, 1.7), s * 1.1, i % 4 ? MAT.rock : MAT.boneDark, G_ROCK);
    r.rotation.y = rand() * TAU;
  }
  addArch(staticRoot, -90, -124, 76, 81, 6.8);
  addArch(staticRoot, -93, -150, 63, 68, 4.7, true);
  addArch(staticRoot, -94, -180, 46, 52, 4.0, true);
  for (let i = 0; i < 6; i++) {
    const z = -200 - i * 18;
    rod(staticRoot, [-130, groundHeight(-130, z), z], [-137 - i * 2, groundHeight(-130, z) + 26 + i * 3, z - 9], 3.6, 1.1, MAT.boneDark);
  }
  addTower(staticRoot, 152, -434, 96, 0.07);
  addTower(staticRoot, 204, -450, 62, -0.13);
  addTower(staticRoot, 116, -465, 40, 0.19);
  for (let i = 0; i < 5; i++) {
    const z = -381 - i * 18;
    block(staticRoot, 183, groundHeight(183, z) + 2, z, 35, 4, 9, MAT.rockDark);
  }
  addArch(staticRoot, -176, -786, 72, 91, 7.5, true);
  addTower(staticRoot, -227, -770, 51, -0.28);
  addTower(staticRoot, -114, -799, 38, 0.36);
  for (let i = 0; i < 12; i++) {
    const x = -310 + i * 55;
    const z = -555 + Math.sin(i * 0.9) * 37;
    block(staticRoot, x, groundHeight(x, z) + 1, z, 35, 2.1, 12, MAT.boneDark).rotation.y = 0.3;
    if (i % 2 === 0) addTower(staticRoot, x, z, random(18, 33), random(-0.28, 0.28));
  }

  // The Hollow Gate: the stone ring is static; only its inner glow animates.
  const gatePos = V(0, groundHeight(0, -1115) + 60, -1115);
  const ring = node();
  ring.position.copy(gatePos);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    const b = ((i + 1) / 40) * TAU;
    rod(ring, [Math.sin(a) * 68, Math.cos(a) * 68, 0], [Math.sin(b) * 68, Math.cos(b) * 68, 0], 7.5, 7.3, i % 5 ? MAT.boneDark : MAT.bone, 6);
    if (i % 2 === 0) rod(ring, [Math.sin(a) * 74, Math.cos(a) * 74, 0], [Math.sin(a) * 85, Math.cos(a) * 85, -5], 4, 0.4, MAT.rockDark, 5);
  }
  staticRoot.add(ring);
  const gate = node();
  gate.position.copy(gatePos);
  const gateGlow = mesh(ringGeo(61, 0.7, 88), material('66dfca', 3, 0.17, true));
  gateGlow.rotation.x = Math.PI / 2;
  gate.add(gateGlow);
  root.add(gate);
  addTower(staticRoot, -92, -1115, 114, 0.1);
  addTower(staticRoot, 92, -1115, 114, -0.1);
  for (let i = 0; i < 7; i++) {
    const x = -170 + i * 55;
    addTower(staticRoot, x, -1225 - rand() * 65, random(45, 92), random(-0.3, 0.3));
  }

  const relics = [];
  const beacons = [];
  for (const poi of POIS) {
    const n = node();
    n.position.set(poi.x, poi.y, poi.z);
    if (poi.type === 'seal') {
      block(staticRoot, poi.x, poi.y + 3, poi.z, 16, 6, 16, MAT.rockDark).rotation.y = Math.PI / 4;
      for (const s of [-1, 1]) rod(staticRoot, [poi.x + s * 6, poi.y + 4, poi.z], [poi.x + s * 3, poi.y + 23, poi.z], 2.3, 0.85, MAT.bone);
      const glow = ellipsoid(n, 0, 17, 0, 2.2, 4.6, 2.2, material('73d0bc', 3));
      const r = mesh(ringGeo(5.5, 0.16, 30), material('70cbb6', 3, 0.55, true));
      r.position.set(0, 16, 0);
      r.rotation.x = 0.5;
      n.add(r);
      const r2 = mesh(ringGeo(8, 0.22, 36), material('65c2b1', 3, 0.35, true));
      r2.position.set(0, 0.5, 0);
      n.add(r2);
      relics.push({ poi, root: n, glow, r, r2 });
      root.add(n);
    } else if (poi.type === 'camp') {
      const { x, y, z } = poi;
      const tent = new Geo();
      tent.tri([x - 9, y, z - 6], [x + 9, y, z - 6], [x, y + 11, z - 4]);
      tent.quad([x - 9, y, z - 6], [x, y + 11, z - 4], [x, y + 11, z + 5], [x - 9, y, z + 8]);
      tent.quad([x, y + 11, z - 4], [x + 9, y, z - 6], [x + 9, y, z + 8], [x, y + 11, z + 5]);
      staticRoot.add(mesh(tent, MAT.rust));
      ellipsoid(staticRoot, x, y + 1.5, z + 13, 2, 1.5, 2, MAT.amber);
      rod(staticRoot, [x + 12, y, z], [x + 12, y + 19, z], 0.4, 0.2, MAT.bone);
      const g = new Geo();
      g.quad([x + 12, y + 18, z], [x + 20, y + 17, z], [x + 17, y + 12, z], [x + 12, y + 13, z]);
      staticRoot.add(mesh(g, MAT.rust));
    } else if (poi.type === 'memory') {
      addTower(staticRoot, poi.x, poi.z, 21, 0.4);
      ellipsoid(staticRoot, poi.x, poi.y + 12, poi.z + 1, 1.8, 1.8, 1.8, MAT.amber);
    } else if (poi.type === 'trial') {
      addCourierPost(staticRoot, poi.x, poi.z);
      const glow = ellipsoid(n, 0, 34, 0, 1.4, 1.4, 1.4, material('e3ab64', 3));
      beacons.push({ poi, glow, base: 34 });
      root.add(n);
    } else if (poi.type === 'lair') {
      addKeel(staticRoot, poi.x, poi.z);
      const glow = ellipsoid(n, 0, 26, 0, 1.8, 3.8, 1.8, material('8fe6cf', 3));
      beacons.push({ poi, glow, base: 26 });
      root.add(n);
    }
  }

  root.add(mergeStatic(staticRoot));

  // Drifting dust motes: one instanced mesh. The seeded calls stay as they were, so
  // the dragon built after the world keeps its old wing tints.
  const moteMat = material('d4c3a0', 3, 0.24);
  const moteScale = [];
  for (let i = 0; i < 36; i++) {
    random(-80, 80);
    random(5, 60);
    random(-120, 30);
    moteScale.push(0.08 + random(0.12, 0.36) * 0.22);
  }
  const count = Math.max(8, Math.min(36, moteCount));
  const motes = new THREE.InstancedMesh(G_SPH.buffer(), materialFor(moteMat), count);
  motes.userData.mat = moteMat;
  motes.frustumCulled = false;
  root.add(motes);
  const m4 = new THREE.Matrix4();

  return {
    root, gate, gateGlow, relics, beacons, motes,
    animate(t, pos, done) {
      for (const r of relics) {
        const lit = done && done[r.poi.id];
        r.glow.rotation.y = t * 0.55;
        r.glow.position.y = 17 + Math.sin(t * 1.7 + r.poi.id) * 0.75;
        r.r.rotation.z = t * 0.35;
        r.r.rotation.x = 0.55 + Math.sin(t * 0.6) * 0.25;
        r.glow.userData.mat.set(lit ? 'c8b284' : '73d0bc');
        r.r2.userData.mat.alpha = lit ? 0.1 : 0.4;
      }
      for (const b of beacons) {
        b.glow.rotation.y = t * 0.8;
        b.glow.position.y = b.base + Math.sin(t * 1.3 + b.poi.id) * 0.9;
      }
      gateGlow.userData.mat.alpha = done && done.every(Boolean) ? 0.74 : 0.13;
      for (let i = 0; i < count; i++) {
        const s = moteScale[i];
        m4.makeScale(s, s, s).setPosition(
          pos.x + ((i * 27.13 + t * 3.5) % 160) - 80,
          pos.y - 20 + ((i * 9.2) % 52) + Math.sin(t + i) * 2,
          pos.z - ((i * 41.1 + t * 6) % 150) + 25
        );
        motes.setMatrixAt(i, m4);
      }
      motes.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------------ the Courier's Wind */

/** Ring centres of the wind trial (x, z); each ring floats at flight height and faces the way in. */
export const TRIAL_COURSE = [
  [-335, -410], [-385, -478], [-425, -565], [-372, -642], [-282, -700], [-200, -662],
  [-142, -584], [-190, -505], [-228, -424], [-200, -335], [-258, -262], [-338, -296],
];
/** Medal times in seconds (the course is about 1.1 km; cruising alone takes about 24 s). */
export const TRIAL_MEDALS = { gold: 22, silver: 28 };

export function buildTrial() {
  const group = node();
  group.visible = false;
  const geo = ringGeo(10.5, 1.3, 40);
  const outer = ringGeo(13.2, 0.35, 40);
  geo.data.push(...outer.data);
  // Stand the rings up (XY plane) so rotation.z spins them in their own plane.
  const buf = geo.buffer().rotateX(Math.PI / 2);
  buf.userData.shared = true;
  const start = POIS.find((p) => p.type === 'trial');
  const rings = [];
  let px = start.x;
  let pz = start.z;
  for (const [x, z] of TRIAL_COURSE) {
    const y = groundHeight(x, z) + 34;
    const m = material('9ff3d6', 3, 0.3, true);
    const r = mesh(buf, m);
    r.position.set(x, y, z);
    r.rotation.y = Math.atan2(x - px, z - pz);
    group.add(r);
    rings.push({ x, y, z, mesh: r, mat: m, yaw: r.rotation.y });
    px = x;
    pz = z;
  }
  return {
    group, rings,
    /** Show ring `next` bright, the one after it faint, and hide the passed ones. */
    sync(next, t) {
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        r.mesh.visible = i >= next;
        r.mat.set(i === rings.length - 1 ? 'f0d9a0' : '9ff3d6');
        r.mat.alpha = i === next ? 0.78 + Math.sin(t * 6) * 0.14 : i === next + 1 ? 0.3 : 0.12;
        r.mesh.rotation.z = t * (i % 2 ? 0.6 : -0.6);
      }
    },
  };
}
