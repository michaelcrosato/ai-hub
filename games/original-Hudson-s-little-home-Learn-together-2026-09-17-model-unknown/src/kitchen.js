/**
 * kitchen.js — room 01, the kitchen: 38 things to tap, from the fridge to the fork.
 *
 * Every tappable thing is a model() with its word id. Decorations that belong to a
 * word (the cooker hood, the lower cupboards, the second chair) live in `extras`
 * and carry the same word id, so tapping them opens that word too.
 */

import * as THREE from 'three/webgpu';
import { createShapes } from './shapes.js';

export const KITCHEN_PALETTE = {
  cream: '#f7eee0',
  wall: '#ecebdb',
  tile: '#f7f5e9',
  grout: '#d9dece',
  sage: '#97b5a0',
  sageLight: '#b7c9ae',
  sageDark: '#678574',
  wood: '#d9ae78',
  woodLight: '#ebc997',
  woodDark: '#ad8253',
  brass: '#b49354',
  white: '#fff9ed',
  ink: '#354940',
  blue: '#8dacb9',
  blueDark: '#658696',
  coral: '#d48a72',
  red: '#d96855',
  yellow: '#edc367',
  steel: '#acbec0',
  dark: '#4d605b',
};

export function buildKitchen(words) {
  const pal = KITCHEN_PALETTE;
  const shapes = createShapes({ roughness: 0.62, boxSegments: 5, sphereSegments: [28, 20], torusSegments: [12, 48] });
  const { root, models, mat, addMesh, box, cyl, sphere, torus, rod, tube, lathe, group, model } = shapes;
  const extras = group(root);

  /** A bar handle: two posts and a grip, `width` wide, centred on (x, y, z). */
  function brassHandle(g, x, y, z, width = 0.5) {
    rod(g, [x - width / 2, y, z - 0.045], [x - width / 2, y, z + 0.07], 0.027, pal.brass, 0.45);
    rod(g, [x + width / 2, y, z - 0.045], [x + width / 2, y, z + 0.07], 0.027, pal.brass, 0.45);
    rod(g, [x - width / 2, y, z + 0.07], [x + width / 2, y, z + 0.07], 0.027, pal.brass, 0.45);
  }
  /** A two-door sage cupboard front. */
  function cabinetFront(g, w, h, d) {
    box(g, w, h, d, pal.sage, 0, h / 2, 0, 0.06);
    for (const x of [-w / 4, w / 4]) {
      box(g, w / 2 - 0.055, h - 0.14, 0.055, pal.sageLight, x, h / 2, d / 2 + 0.025, 0.025);
      box(g, w / 2 - 0.2, h - 0.34, 0.018, pal.sage, x, h / 2, d / 2 + 0.058, 0.025);
      sphere(g, 0.047, pal.brass, x + (x < 0 ? 0.13 : -0.13), h * 0.6, d / 2 + 0.12);
    }
  }
  function leaf(g, x, y, z, size = 0.25, rx = 0, rz = 0) {
    const mesh = sphere(g, size, pal.sageDark, x, y, z, 0.43, 1, 0.12);
    mesh.rotation.set(rx, 0, rz);
    return mesh;
  }
  function plant(g) {
    cyl(g, 0.23, 0.18, 0.36, pal.coral, 0, 0.18, 0);
    cyl(g, 0.21, 0.21, 0.025, pal.woodDark, 0, 0.35, 0);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const y = 0.55 + (i % 3) * 0.15;
      const x = Math.sin(a) * 0.17;
      const z = Math.cos(a) * 0.16;
      rod(g, [0, 0.33, 0], [x, y, z], 0.015, pal.sageDark);
      leaf(g, x * 1.7, y, z * 1.7, 0.22, Math.cos(a) * 0.5, Math.sin(a) * 0.7);
    }
  }

  model('floor', 0, 0, 0, 0, (g) => {
    box(g, 10.2, 0.26, 7.4, pal.wood, 0, -0.16, 0, 0.12);
    for (let i = 0; i < 15; i++) {
      const x = -4.8 + i * 0.68;
      box(g, 0.665, 0.035, 7.1, i % 3 === 0 ? '#e7c99f' : i % 3 === 1 ? '#e1bd8e' : '#e9cca2', x, -0.015, 0, 0.006);
      for (let k = 0; k < 2; k++) box(g, 0.002, 0.003, 6.8, '#c7a473', x + 0.19 + k * 0.09, 0.006, 0, 0);
      const seam = ((i % 3) - 1) * 1.65;
      box(g, 0.64, 0.004, 0.012, '#caab80', x, 0.007, seam, 0);
    }
  });
  model('wall', 0, 0, 0, 0, (g) => {
    box(g, 10.25, 5.25, 0.18, pal.wall, 0, 2.48, -3.62, 0.045);
    box(g, 0.18, 5.25, 7.25, '#e2e5d4', -5.06, 2.48, -0.03, 0.045);
    box(g, 10.1, 0.16, 0.1, pal.white, 0, 0.07, -3.5, 0.018);
    box(g, 0.1, 0.16, 7.15, pal.white, -4.94, 0.07, 0, 0.018);
    box(g, 7.45, 1.25, 0.03, pal.grout, 1.16, 2.23, -3.505, 0);
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 15; col++) {
        const x = -2.5 + col * 0.5 + (row % 2) * 0.25;
        if (x <= 4.84) box(g, 0.48, 0.285, 0.034, row % 2 ? '#f3f2e7' : pal.tile, x, 1.78 + row * 0.31, -3.476, 0.014);
      }
  });
  model('door', -4.94, 0.07, 0.35, Math.PI / 2, (g) => {
    box(g, 1.68, 3.65, 0.09, pal.white, 0, 1.83, 0, 0.045);
    box(g, 1.42, 3.39, 0.1, '#bcc5aa', 0, 1.8, 0.045, 0.025);
    box(g, 1.15, 1.38, 0.028, '#aebba0', 0, 2.55, 0.106, 0.03);
    box(g, 1.15, 1.15, 0.028, '#aebba0', 0, 0.99, 0.106, 0.03);
    sphere(g, 0.066, pal.brass, 0.52, 1.7, 0.16);
  });
  model('fridge', -3.85, 0.02, -2.64, 0, (g) => {
    box(g, 1.65, 3.65, 0.15, pal.sageDark, 0, 1.86, -0.735, 0.07);
    for (let d of [-0.755, 0.755]) box(g, 0.14, 3.65, 1.6, pal.sageLight, d, 1.86, 0, 0.065);
    box(g, 1.62, 0.15, 1.6, pal.sageLight, 0, 3.61, 0, 0.07);
    box(g, 1.62, 0.15, 1.6, pal.sageLight, 0, 0.12, 0, 0.07);
    box(g, 1.38, 3.38, 0.04, '#dce5d7', 0, 1.91, -0.636, 0.016);
    for (let d of [0.55, 1.25, 2.03, 2.65, 3.12]) box(g, 1.37, 0.035, 1.25, pal.white, 0, d, 0, 0.01);
    for (let d of [-0.36, -0.06, 0.26]) {
      cyl(g, 0.085, 0.085, 0.24, pal.cream, d, 0.69, -0.16);
      cyl(g, 0.087, 0.087, 0.027, pal.coral, d, 0.826, -0.16);
    }
    box(g, 0.21, 0.38, 0.21, pal.blue, 0.38, 1.46, -0.22, 0.025);
    box(g, 0.21, 0.07, 0.21, pal.white, 0.38, 1.69, -0.22, 0.02);
    for (let d of [-0.37, -0.07]) sphere(g, 0.115, pal.red, d, 1.39, -0.2);
    const a = group(g, -0.8, 0.1, 0.85);
    a.name = 'fridge-door';
    box(a, 1.57, 2.2, 0.19, pal.sageLight, 0.79, 1.14, 0, 0.13);
    box(a, 0.048, 0.55, 0.075, pal.brass, 1.38, 1.6, 0.15, 0.022);
    const n = group(g, -0.8, 2.36, 0.85);
    n.name = 'freezer-door';
    box(n, 1.57, 1.23, 0.19, pal.sageLight, 0.79, 0.615, 0, 0.13);
    box(n, 0.048, 0.39, 0.075, pal.brass, 1.38, 0.34, 0.15, 0.022);
    sphere(a, 0.085, pal.coral, 0.44, 1.69, 0.14, 1, 1, 0.27);
    box(a, 0.16, 0.16, 0.035, pal.yellow, 0.73, 1.76, 0.15, 0.045);
    const i = box(a, 0.145, 0.145, 0.035, pal.blue, 0.55, 1.45, 0.15, 0.028);
    i.rotation.z = 0.24;
    box(a, 0.3, 0.37, 0.008, pal.white, 0.54, 0.93, 0.13, 0.015);
    box(a, 0.19, 0.035, 0.009, pal.sage, 0.54, 1.015, 0.141, 0.004);
    box(a, 0.15, 0.035, 0.009, pal.coral, 0.54, 0.94, 0.141, 0.004);
    for (let d of [-0.58, 0.58]) cyl(g, 0.07, 0.07, 0.1, pal.dark, d, 0.05, 0.45);
  });
  model('oven', -1.82, 0.03, -2.64, 0, (g) => {
    box(g, 1.72, 1.6, 1.54, pal.cream, 0, 0.83, 0, 0.1);
    box(g, 1.46, 1.14, 0.075, pal.dark, 0, 0.78, 0.785, 0.085);
    box(g, 1.22, 0.8, 0.038, '#61716a', 0, 0.71, 0.832, 0.06);
    box(g, 1.01, 0.035, 0.028, '#88978d', 0, 0.91, 0.856, 0.007);
    box(g, 1.01, 0.035, 0.028, '#88978d', 0, 0.56, 0.856, 0.007);
    brassHandle(g, 0, 1.23, 0.855, 1.15);
    box(g, 1.44, 0.17, 0.04, pal.cream, 0, 0.15, 0.802, 0.025);
    brassHandle(g, 0, 0.15, 0.83, 0.4);
  });
  model('stove', -1.82, 1.62, -2.64, 0, (g) => {
    box(g, 1.82, 0.2, 1.63, pal.cream, 0, 0.09, 0, 0.08);
    box(g, 1.62, 0.07, 1.3, pal.dark, 0, 0.22, -0.02, 0.065);
    for (let a of [-0.44, 0.44])
      for (let n of [-0.34, 0.34]) {
        const i = torus(g, 0.25, 0.033, '#293a35', a, 0.268, n);
        i.rotation.x = -Math.PI / 2;
        cyl(g, 0.115, 0.115, 0.018, '#6e7d73', a, 0.268, n);
        box(g, 0.64, 0.045, 0.04, '#34443e', a, 0.296, n, 0.01);
        box(g, 0.04, 0.045, 0.64, '#34443e', a, 0.296, n, 0.01);
      }
    for (let a = 0; a < 4; a++) {
      const n = cyl(g, 0.065, 0.065, 0.055, pal.brass, -0.55 + a * 0.36, 0.08, 0.847, 0.3);
      n.rotation.x = Math.PI / 2;
    }
  });
  const hood = group(extras, -1.82, 3.55, -3);
  box(hood, 0.64, 1.23, 0.43, pal.cream, 0, 0.78, -0.14, 0.03);
  const hoodShape = new THREE.CylinderGeometry(0.47, 0.94, 0.51, 4, 1);
  hoodShape.rotateY(Math.PI / 4);
  const hoodBase = addMesh(hood, hoodShape, pal.cream, 0, 0.15, 0);
  hoodBase.scale.z = 0.69;
  box(hood, 1.43, 0.12, 0.94, pal.white, 0, -0.115, 0, 0.04);
  hood.userData.wordId = 'stove';
  model('cabinet', 3.77, 3.04, -3.2, 0, (g) => cabinetFront(g, 1.85, 1.65, 0.62));
  const sinkCabinet = group(extras, 0.23, 0.03, -2.67);
  cabinetFront(sinkCabinet, 2.22, 1.69, 1.5);
  sinkCabinet.userData.wordId = 'cabinet';
  const rightCabinet = group(extras, 3.82, 0.03, -2.67);
  cabinetFront(rightCabinet, 1.76, 1.69, 1.5);
  rightCabinet.userData.wordId = 'cabinet';
  model('drawer', 3.82, 1.38, -1.866, 0, (g) => {
    box(g, 1.62, 0.27, 0.075, pal.sageLight, 0, 0, 0, 0.025);
    brassHandle(g, 0, 0, 0.06, 0.48);
  });
  const counter = group(extras);
  counter.userData.wordId = 'cabinet';
  box(counter, 3.6, 0.17, 1.73, pal.white, 3.02, 1.8, -2.64, 0.05);
  box(counter, 0.51, 0.17, 1.73, pal.white, -0.69, 1.8, -2.64, 0.035);
  box(counter, 1.57, 0.17, 0.3, pal.white, 0.35, 1.8, -3.35, 0.025);
  box(counter, 1.57, 0.17, 0.32, pal.white, 0.35, 1.8, -1.94, 0.025);
  model('sink', 0.28, 1.54, -2.62, 0, (g) => {
    box(g, 1.29, 0.12, 0.92, pal.steel, 0, 0.04, 0, 0.09);
    box(g, 1.34, 0.24, 0.1, pal.white, 0, 0.23, -0.51, 0.04);
    box(g, 1.34, 0.24, 0.1, pal.white, 0, 0.23, 0.51, 0.04);
    box(g, 0.1, 0.24, 0.96, pal.white, -0.62, 0.23, 0, 0.04);
    box(g, 0.1, 0.24, 0.96, pal.white, 0.62, 0.23, 0, 0.04);
    cyl(g, 0.08, 0.08, 0.014, '#718f91', 0, 0.112, 0);
    cyl(g, 0.043, 0.043, 0.017, '#4b6b70', 0, 0.12, 0);
  });
  model('tap', 0.32, 1.84, -3.2, 0, (g) => {
    cyl(g, 0.105, 0.12, 0.08, pal.brass, 0, 0.04, 0, 0.5);
    tube(
      g,
      [
        [0, 0.04, 0],
        [0, 0.52, 0],
        [0, 0.65, 0.16],
        [0, 0.61, 0.37],
        [0, 0.46, 0.39],
      ],
      0.045,
      pal.brass,
    );
    rod(g, [0.12, 0.12, 0], [0.25, 0.25, 0], 0.033, pal.brass);
    cyl(g, 0.035, 0.035, 0.08, pal.brass, 0, 0.44, 0.39, 0.5);
  });
  model('soap', 1.17, 1.9, -3.09, 0, (g) => {
    box(g, 0.23, 0.36, 0.2, '#c4bbd1', 0, 0.18, 0, 0.075);
    cyl(g, 0.055, 0.055, 0.09, pal.white, 0, 0.4, 0);
    box(g, 0.19, 0.046, 0.07, pal.white, 0.055, 0.47, 0, 0.015).name = 'soap-pump';
    box(g, 0.14, 0.12, 0.004, pal.white, 0, 0.22, 0.105, 0.014);
  });
  model('towel', 0.21, 1.47, -1.74, 0, (g) => {
    rod(g, [-0.42, 0, 0], [0.42, 0, 0], 0.025, pal.brass);
    // A soft, wavy cloth: a plane rippled along x and bellied out at the bottom.
    const cloth = new THREE.PlaneGeometry(0.56, 0.72, 22, 22);
    const pos = cloth.attributes.position;
    for (let v = 0; v < pos.count; v++)
      pos.setZ(v, Math.sin(pos.getX(v) * 36) * 0.025 + Math.pow(pos.getY(v) + 0.36, 2) * 0.08);
    cloth.computeVertexNormals();
    const clothMat = mat(pal.coral).clone();
    clothMat.side = THREE.DoubleSide;
    const towel = new THREE.Mesh(cloth, clothMat);
    towel.position.set(0, -0.31, 0.042);
    towel.castShadow = true;
    g.add(towel);
    for (const y of [-0.53, -0.58]) {
      const stripe = new THREE.PlaneGeometry(0.555, 0.022, 22, 1);
      const sp = stripe.attributes.position;
      for (let v = 0; v < sp.count; v++) sp.setZ(v, Math.sin(sp.getX(v) * 36) * 0.025 + 0.05);
      const mesh = new THREE.Mesh(stripe, mat(pal.white));
      mesh.position.set(0, y, 0.046);
      g.add(mesh);
    }
  });
  model('dishwasher', 2.18, 0.04, -2.65, 0, (g) => {
    box(g, 1.41, 1.65, 1.48, pal.steel, 0, 0.84, 0, 0.07);
    box(g, 1.33, 1.44, 0.08, '#c6d2c8', 0, 0.77, 0.752, 0.035);
    box(g, 1.31, 0.18, 0.08, pal.sageDark, 0, 1.55, 0.76, 0.025);
    brassHandle(g, 0, 1.32, 0.83, 0.7);
    for (let a = 0; a < 3; a++)
      sphere(g, 0.025, a === 0 ? pal.yellow : pal.white, 0.4 - a * 0.11, 1.55, 0.808, 1, 1, 0.3);
  });
  model('window', 0.52, 3.72, -3.44, 0, (g) => {
    box(g, 2.57, 1.9, 0.16, pal.white, 0, 0, 0, 0.025);
    box(g, 2.32, 1.64, 0.025, '#acd2d4', 0, 0, 0.091, 0);
    const a = sphere(g, 0.19, '#f1d87e', 0.65, 0.48, 0.105, 1, 1, 0.1);
    a.castShadow = false;
    const n = new THREE.Shape();
    n.moveTo(-1.15, -0.8);
    n.lineTo(-1.15, -0.42);
    n.quadraticCurveTo(-0.65, 0.04, 0.28, -0.8);
    n.closePath();
    const i = addMesh(g, new THREE.ShapeGeometry(n), '#95b99a', 0, 0, 0.125);
    i.castShadow = false;
    const d = new THREE.Shape();
    d.moveTo(-0.6, -0.8);
    d.quadraticCurveTo(0.5, 0.01, 1.15, -0.5);
    d.lineTo(1.15, -0.8);
    d.closePath();
    const w = addMesh(g, new THREE.ShapeGeometry(d), '#abc697', 0, 0, 0.132);
    w.castShadow = false;
    box(g, 0.075, 1.72, 0.09, pal.white, 0, 0, 0.165, 0.012);
    box(g, 2.38, 0.075, 0.09, pal.white, 0, 0, 0.165, 0.012);
    box(g, 2.76, 0.13, 0.44, pal.white, 0, -0.99, 0.13, 0.035);
    for (let v of [-1.48, 1.48]) {
      const S = box(g, 0.26, 1.76, 0.12, '#e3cba7', v, -0.02, 0.17, 0.06);
      for (let P = 0; P < 3; P++) box(g, 0.022, 1.7, 0.018, '#c7b798', v - 0.08 + P * 0.08, -0.02, 0.241, 0.005);
    }
    rod(g, [-1.7, 1.07, 0.08], [1.7, 1.07, 0.08], 0.025, pal.woodDark);
  });
  model('plant', 1.35, 2.81, -3.22, 0, plant);
  model('clock', -3.75, 4.53, -3.47, 0, (g) => {
    const a = cyl(g, 0.4, 0.4, 0.1, pal.wood);
    a.rotation.x = Math.PI / 2;
    const n = cyl(g, 0.35, 0.35, 0.018, pal.white, 0, 0, 0.061);
    n.rotation.x = Math.PI / 2;
    for (let d = 0; d < 12; d++) {
      const w = (d * Math.PI) / 6,
        v = box(g, 0.021, 0.048, 0.006, pal.woodDark, Math.sin(w) * 0.291, Math.cos(w) * 0.291, 0.078, 0.004);
      v.rotation.z = -w;
    }
    rod(g, [0, 0, 0.086], [0.13, 0.16, 0.086], 0.018, pal.dark).name = 'clock-short';
    const i = group(g);
    i.name = 'clock-long-pivot';
    rod(i, [0, 0, 0.09], [-0.17, 0.09, 0.09], 0.012, pal.dark).name = 'clock-long';
    sphere(g, 0.03, pal.brass, 0, 0, 0.098, 1, 1, 0.4);
  });
  model('microwave', 3.79, 1.9, -2.86, 0, (g) => {
    box(g, 1.4, 0.74, 0.82, pal.cream, 0, 0.37, 0, 0.065);
    box(g, 0.94, 0.55, 0.025, pal.dark, -0.15, 0.38, 0.428, 0.04);
    box(g, 0.78, 0.41, 0.018, '#62776f', -0.16, 0.37, 0.447, 0.028);
    box(g, 0.037, 0.37, 0.055, pal.brass, 0.355, 0.38, 0.462, 0.014);
    box(g, 0.18, 0.075, 0.013, pal.sageDark, 0.565, 0.55, 0.43, 0.01);
    const a = cyl(g, 0.057, 0.057, 0.04, pal.brass, 0.565, 0.24, 0.45);
    a.rotation.x = Math.PI / 2;
    for (let n = 0; n < 3; n++) box(g, 0.065, 0.014, 0.014, pal.woodDark, 0.565, 0.42 - n * 0.054, 0.44, 0.005);
  });
  model('toaster', 2.19, 1.91, -2.78, 0, (g) => {
    box(g, 0.64, 0.46, 0.48, pal.coral, 0, 0.25, 0, 0.105);
    box(g, 0.56, 0.035, 0.4, pal.steel, 0, 0.479, 0, 0.045);
    for (let a of [-0.095, 0.095]) {
      box(g, 0.4, 0.018, 0.065, pal.dark, 0, 0.502, a, 0.024);
      box(g, 0.29, 0.12, 0.038, pal.woodLight, 0, 0.536, a, 0.035);
    }
    box(g, 0.045, 0.16, 0.065, pal.dark, 0.332, 0.24, 0, 0.017);
    box(g, 0.08, 0.034, 0.1, pal.brass, 0.363, 0.3, 0, 0.01);
    for (let a of [-0.23, 0.23]) sphere(g, 0.035, pal.dark, a, 0.025, 0.14, 1, 0.55, 1);
  });
  model('pot', -2.25, 1.95, -2.97, 0, (g) => {
    lathe(
      g,
      [
        [0, 0.025],
        [0.29, 0.025],
        [0.34, 0.09],
        [0.34, 0.39],
        [0.3, 0.41],
        [0.28, 0.38],
        [0.28, 0.09],
        [0, 0.09],
      ],
      pal.sage,
    );
    const a = group(g);
    a.name = 'pot-lid';
    cyl(a, 0.35, 0.35, 0.045, pal.sageLight, 0, 0.42, 0);
    sphere(a, 0.068, pal.wood, 0, 0.49, 0, 1, 0.65, 1);
    for (let n of [-0.39, 0.39]) {
      const i = torus(g, 0.095, 0.031, pal.wood, n, 0.27, 0);
      i.rotation.y = Math.PI / 2;
    }
  });
  model('pan', -1.39, 1.95, -2.28, 0.42, (g) => {
    lathe(
      g,
      [
        [0, 0],
        [0.31, 0],
        [0.36, 0.04],
        [0.38, 0.15],
        [0.35, 0.17],
        [0.31, 0.045],
        [0, 0.045],
      ],
      pal.dark,
    );
    rod(g, [0.3, 0.09, 0], [0.91, 0.16, 0], 0.043, pal.woodDark);
    box(g, 0.43, 0.085, 0.12, pal.wood, 0.77, 0.14, 0, 0.038).name = 'pan-handle';
  });
  model('kettle', 1.45, 1.91, -2.35, -0.25, (g) => {
    lathe(
      g,
      [
        [0, 0],
        [0.2, 0],
        [0.3, 0.07],
        [0.32, 0.23],
        [0.25, 0.39],
        [0.18, 0.47],
        [0, 0.47],
      ],
      pal.yellow,
    );
    cyl(g, 0.18, 0.18, 0.025, pal.cream, 0, 0.47, 0);
    sphere(g, 0.052, pal.woodDark, 0, 0.52, 0, 1, 0.65, 1);
    tube(
      g,
      [
        [0.24, 0.17, 0],
        [0.39, 0.25, 0],
        [0.47, 0.43, 0],
      ],
      0.055,
      pal.yellow,
    );
    torus(g, 0.28, 0.04, pal.woodDark, 0, 0.45, 0, Math.PI); // the arched handle
  });
  model('bin', -4.11, 0.03, -0.62, 0, (g) => {
    cyl(g, 0.39, 0.31, 0.79, '#92a99c', 0, 0.42, 0);
    const a = group(g);
    a.name = 'bin-lid';
    cyl(a, 0.41, 0.41, 0.075, pal.sageDark, 0, 0.85, 0);
    box(a, 0.19, 0.065, 0.07, pal.wood, 0, 0.918, 0, 0.024);
    box(g, 0.17, 0.055, 0.18, pal.dark, 0, 0.1, 0.35, 0.017);
  });
  model('rug', 0.65, 0.022, 1.35, 0, (g) => {
    box(g, 5.3, 0.025, 3.19, '#dca991', 0, 0, 0, 0.012);
    for (let a of [-1.35, -1.2, 1.2, 1.35]) box(g, 5.1, 0.006, 0.045, '#f6dfbd', 0, 0.016, a, 0.005);
    for (let a = 0; a < 34; a++)
      for (let n of [-1.66, 1.66]) box(g, 0.045, 0.012, 0.18, '#edcfac', -2.52 + a * 0.153, 0, n, 0.005);
  });
  model('table', 0.4, 0.03, 1.07, 0, (g) => {
    box(g, 3.28, 0.18, 2.04, pal.woodLight, 0, 1.51, 0, 0.115);
    box(g, 2.82, 0.22, 1.64, pal.wood, 0, 1.32, 0, 0.045);
    for (let a of [-1.33, 1.33])
      for (let n of [-0.72, 0.72]) rod(g, [a * 1.08, 0.045, n * 1.14], [a, 1.42, n], 0.095, pal.wood);
    for (let a of [-0.72, 0, 0.72]) box(g, 0.01, 0.003, 1.83, '#caa477', a, 1.603, 0, 0.001);
  });
  function chair(g) {
    box(g, 0.98, 0.16, 0.97, pal.woodLight, 0, 0.83, 0, 0.12).name = 'chair-seat';
    for (let a of [-0.37, 0.37])
      for (let n of [-0.34, 0.34])
        rod(g, [a * 1.16, 0.05, n * 1.14], [a, 0.81, n], 0.063, pal.wood).name = 'chair-legs';
    for (let a of [-0.39, 0.39]) rod(g, [a, 0.75, -0.33], [a, 1.92, -0.43], 0.06, pal.wood);
    box(g, 0.93, 0.27, 0.14, pal.woodLight, 0, 1.91, -0.41, 0.075).name = 'chair-back';
    for (let a of [-0.21, 0, 0.21]) rod(g, [a, 0.95, -0.355], [a, 1.81, -0.411], 0.03, pal.wood);
    for (let a of [-0.41, 0.41]) rod(g, [a, 0.32, -0.38], [a, 0.32, 0.38], 0.035, pal.woodDark);
  }
  model('chair', 2.82, 0.04, 1.27, -Math.PI / 2 + 0.12, chair);
  const secondChair = group(extras, -1.98, 0.04, 1.4, Math.PI / 2 - 0.1);
  chair(secondChair);
  secondChair.userData.wordId = 'chair';
  model('light', 0.38, 4.41, 0.69, 0, (g) => {
    cyl(g, 0.013, 0.013, 0.71, pal.woodDark, 0, 0.96, 0);
    lathe(
      g,
      [
        [0.03, 0.65],
        [0.08, 0.65],
        [0.17, 0.58],
        [0.33, 0.43],
        [0.52, 0.25],
        [0.55, 0.13],
        [0.51, 0.1],
        [0.47, 0.13],
        [0.3, 0.39],
        [0.06, 0.6],
      ].reverse(),
      pal.yellow,
    );
    sphere(g, 0.12, pal.white, 0, 0.19, 0, 1, 0.8, 1);
    cyl(g, 0.065, 0.065, 0.075, pal.brass, 0, 0.68, 0);
  });
  model('plate', 0.47, 1.655, 1.42, 0, (g) => {
    lathe(
      g,
      [
        [0, 0],
        [0.3, 0],
        [0.45, 0.03],
        [0.49, 0.065],
        [0.47, 0.095],
        [0.37, 0.085],
        [0.29, 0.038],
        [0, 0.038],
      ],
      pal.white,
    );
    const a = torus(g, 0.42, 0.01, pal.blue, 0, 0.079, 0);
    a.rotation.x = -Math.PI / 2;
  });
  model('bowl', 1.52, 1.655, 0.46, 0, (g) => {
    lathe(
      g,
      [
        [0, 0],
        [0.16, 0],
        [0.23, 0.05],
        [0.32, 0.23],
        [0.35, 0.32],
        [0.32, 0.34],
        [0.29, 0.28],
        [0.21, 0.09],
        [0, 0.07],
      ],
      pal.blue,
    );
    const a = torus(g, 0.333, 0.014, pal.white, 0, 0.326, 0);
    a.rotation.x = -Math.PI / 2;
  });
  model('cup', 1.5, 1.655, 1.5, 0.12, (g) => {
    lathe(
      g,
      [
        [0, 0],
        [0.17, 0],
        [0.19, 0.045],
        [0.205, 0.4],
        [0.178, 0.42],
        [0.16, 0.07],
        [0, 0.055],
      ],
      pal.blue,
    );
    const a = torus(g, 0.126, 0.032, pal.blue, 0.24, 0.23, 0);
    a.scale.y = 1.14;
    const n = torus(g, 0.192, 0.011, pal.white, 0, 0.409, 0);
    n.rotation.x = -Math.PI / 2;
  });
  model('spoon', 1.01, 1.67, 1.54, -0.18, (g) => {
    sphere(g, 0.092, pal.steel, 0, 0.018, -0.23, 0.68, 0.18, 1);
    box(g, 0.044, 0.025, 0.39, pal.steel, 0, 0.026, 0.03, 0.022).name = 'spoon-handle';
    sphere(g, 0.034, pal.steel, 0, 0.026, 0.22, 1, 0.36, 1.4);
  });
  model('fork', -0.13, 1.675, 1.47, 0.1, (g) => {
    box(g, 0.033, 0.025, 0.38, pal.steel, 0, 0.02, 0.06, 0.014).name = 'fork-handle';
    box(g, 0.12, 0.025, 0.11, pal.steel, 0, 0.02, -0.16, 0.014);
    for (let a = 0; a < 4; a++) box(g, 0.017, 0.022, 0.12, pal.steel, -0.048 + a * 0.032, 0.02, -0.257, 0.007);
  });
  model('cutting-board', -0.52, 1.66, 0.48, -0.16, (g) => {
    box(g, 0.92, 0.046, 0.58, pal.wood, 0, 0.023, 0, 0.022);
    box(g, 0.24, 0.046, 0.2, pal.wood, -0.51, 0.023, 0, 0.02);
    for (let a = 0; a < 4; a++) box(g, 0.013, 0.003, 0.52, pal.woodDark, -0.3 + a * 0.21, 0.048, 0, 0.001);
  });
  model('bread', -0.55, 1.71, 0.46, -0.16, (g) => {
    box(g, 0.63, 0.31, 0.4, '#c79254', 0, 0.16, 0, 0.14);
    for (let a = 0; a < 3; a++) {
      const n = box(g, 0.024, 0.013, 0.27, '#efd3a5', -0.19 + a * 0.19, 0.314, 0, 0.006);
      n.rotation.y = -0.2;
    }
    box(g, 0.014, 0.22, 0.3, '#f1d7aa', 0.316, 0.14, 0, 0.006);
  });
  model('apple', 0.56, 1.66, 0.39, 0, (g) => {
    sphere(g, 0.2, pal.red, 0, 0.19, 0, 1, 1, 1);
    sphere(g, 0.15, pal.red, -0.06, 0.245, 0, 1, 0.7, 1);
    sphere(g, 0.15, pal.red, 0.06, 0.245, 0, 1, 0.7, 1);
    rod(g, [0, 0.35, 0], [0.018, 0.45, 0.015], 0.016, pal.woodDark);
    leaf(g, 0.088, 0.423, 0, 0.077, 0, -1.1).scale.set(0.6, 1, 0.14);
  });
  model('orange', 0.99, 1.66, 0.29, 0, (g) => {
    sphere(g, 0.185, '#e5a151', 0, 0.183, 0, 1, 0.96, 1);
    sphere(g, 0.031, pal.sageDark, 0, 0.36, 0, 1, 0.26, 1);
  });
  model('banana', 0, 1.67, 0.07, 0.44, (g) => {
    tube(
      g,
      [
        [-0.31, 0.18, 0],
        [-0.21, 0.085, 0],
        [0, 0.052, 0],
        [0.2, 0.11, 0],
        [0.31, 0.24, 0],
      ],
      0.071,
      pal.yellow,
    );
    rod(g, [0.3, 0.22, 0], [0.34, 0.29, 0], 0.034, pal.woodDark);
    sphere(g, 0.03, pal.woodDark, -0.31, 0.18, 0);
  });
  model('milk', -0.79, 1.66, 1.46, 0.12, (g) => {
    box(g, 0.3, 0.43, 0.3, pal.white, 0, 0.215, 0, 0.018);
    box(g, 0.302, 0.16, 0.302, pal.blue, 0, 0.1, 0, 0.012);
    const a = new THREE.CylinderGeometry(0.212, 0.212, 0.3, 3, 1);
    a.rotateY(Math.PI / 6);
    a.rotateZ(Math.PI / 2);
    addMesh(g, a, pal.white, 0, 0.452, 0);
    box(g, 0.29, 0.06, 0.03, pal.blue, 0, 0.593, 0, 0.005);
    box(g, 0.13, 0.08, 0.009, pal.blue, 0, 0.325, 0.154, 0.01);
  });
  model('jar', -4.54, 2.88, -0.78, Math.PI / 2, (g) => {
    cyl(g, 0.17, 0.17, 0.38, '#d8ccae', 0, 0.19, 0);
    cyl(g, 0.185, 0.185, 0.065, pal.wood, 0, 0.413, 0).name = 'jar-lid';
    box(g, 0.19, 0.16, 0.015, pal.white, 0, 0.23, 0.166, 0.021);
    box(g, 0.09, 0.019, 0.016, pal.sage, 0, 0.24, 0.18, 0.004);
  });
  const shelf = group(extras, -4.75, 2.79, -0.77, Math.PI / 2);
  shelf.userData.wordId = 'cabinet';
  box(shelf, 1.25, 0.12, 0.61, pal.woodLight, 0, 0, 0, 0.035);
  for (const x of [-0.42, 0.42]) box(shelf, 0.06, 0.34, 0.38, pal.wood, x, -0.16, -0.12, 0.012);
  root.updateMatrixWorld(true);
  for (const word of words) if (!models.has(word.id)) throw new Error(`Missing model: ${word.id}`);
  return { ...shapes, pal };
}
