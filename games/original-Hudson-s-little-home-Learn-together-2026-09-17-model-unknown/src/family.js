/**
 * family.js — room 02, the family room: soft things, play things and family words.
 */

import * as THREE from 'three/webgpu';
import { createShapes } from './shapes.js';

export const FAMILY_PALETTE = {
  cream: '#f7eee0',
  wall: '#ebe8dd',
  tile: '#f7f5e9',
  grout: '#d9dece',
  sage: '#96ad91',
  sageLight: '#b9c9ad',
  sageDark: '#667d63',
  wood: '#d6aa76',
  woodLight: '#e8c796',
  woodDark: '#a87d50',
  brass: '#b49354',
  white: '#fff9ed',
  ink: '#354940',
  blue: '#88aaba',
  blueDark: '#658696',
  coral: '#d68b76',
  red: '#d96855',
  yellow: '#edc367',
  steel: '#acbec0',
  dark: '#4d605b',
  sofa: '#9daf92',
  plum: '#a18fa9',
};

export function buildFamilyRoom(words) {
  const pal = FAMILY_PALETTE;
  const shapes = createShapes({ roughness: 0.66, boxSegments: 4, sphereSegments: [26, 18], torusSegments: [10, 42] });
  const { root, models, mat, box, cyl, sphere, torus, rod, group, model } = shapes;
  function plant(g) {
    cyl(g, 0.24, 0.2, 0.36, pal.coral, 0, 0.18, 0);
    cyl(g, 0.22, 0.22, 0.03, pal.woodDark, 0, 0.37, 0);
    for (let i = 0; i < 8; i++) {
      const a = i * 2.25;
      const y = 0.6 + (i % 3) * 0.17;
      const x = Math.sin(a) * 0.19;
      const z = Math.cos(a) * 0.17;
      rod(g, [0, 0.36, 0], [x, y, z], 0.016, pal.sageDark);
      const leaf = sphere(g, 0.22, pal.sageDark, x * 1.65, y, z * 1.65, 0.45, 1, 0.15);
      leaf.rotation.z = Math.sin(a) * 0.7;
    }
  }
  function book(g, cover = pal.coral) {
    box(g, 0.62, 0.1, 0.86, cover, 0, 0.05, 0, 0.035);
    box(g, 0.56, 0.018, 0.8, pal.cream, 0, 0.111, 0, 0.018);
    box(g, 0.055, 0.115, 0.82, pal.woodDark, -0.282, 0.062, 0, 0.018);
  }
  function pillow(g, color = pal.plum) {
    const cushion = box(g, 1.16, 0.3, 0.86, color, 0, 0.18, 0, 0.22);
    for (const x of [-0.48, 0.48])
      for (const z of [-0.33, 0.33]) sphere(cushion, 0.1, color, x, 0.01, z, 0.7, 0.42, 0.7);
    return cushion;
  }
  function blanketStack(g, color = '#b8c7a6') {
    for (let i = 0; i < 5; i++) box(g, 1.35, 0.08, 0.86, color, 0, 0.08 + i * 0.075, 0, 0.06);
    for (let i = 0; i < 7; i++) box(g, 0.025, 0.04, 0.12, pal.cream, -0.56 + i * 0.19, 0.465, 0.42, 0.01);
  }
  model('family-floor', 0, 0, 0, 0, (g) => {
    box(g, 10.4, 0.26, 7.5, pal.wood, 0, -0.16, 0, 0.12);
    for (let a = 0; a < 16; a++) {
      const n = -5 + a * 0.66;
      box(g, 0.64, 0.035, 7.18, a % 2 ? '#e3bd8f' : '#e9caa0', n, -0.015, 0, 0.006);
    }
  });
  model('family-wall', 0, 0, 0, 0, (g) => {
    box(g, 10.35, 5.35, 0.18, pal.wall, 0, 2.52, -3.66, 0.05);
    box(g, 0.18, 5.35, 7.35, '#e2e4d6', -5.1, 2.52, 0, 0.05);
    box(g, 10.1, 0.16, 0.1, pal.white, 0, 0.07, -3.55, 0.018);
    box(g, 0.1, 0.16, 7.12, pal.white, -4.98, 0.07, 0, 0.018);
  });
  model('family-rug', 0.35, 0.01, 0.48, 0, (g) => {
    box(g, 5.45, 0.045, 3.5, '#caa69e', 0, 0.02, 0, 0.16);
    for (let a = 0; a < 8; a++)
      box(g, 4.75, 0.006, 0.035, a % 2 ? pal.cream : '#a88682', 0, 0.046, -1.28 + a * 0.36, 0.01);
  });
  model('sofa', 1.05, 0.03, -2.38, 0, (g) => {
    box(g, 4.15, 0.6, 1.3, pal.sofa, 0, 0.56, 0, 0.22);
    box(g, 4.1, 1.26, 0.43, '#879d7e', 0, 1.35, -0.5, 0.18);
    for (let a of [-1.36, 0, 1.36]) box(g, 1.23, 0.34, 1.04, '#aebda3', a, 0.92, 0.1, 0.17);
    for (let a of [-2.03, 2.03]) box(g, 0.34, 0.88, 1.25, '#879d7e', a, 0.76, 0, 0.16);
    for (let a of [-1.6, 1.6]) cyl(g, 0.085, 0.085, 0.28, pal.woodDark, a, 0.14, -0.35);
  });
  model('pillow', 1.98, 1.1, -2.03, -0.24, (g) => pillow(g, '#b59aae'));
  model('blanket', -0.15, 0.95, -1.85, 0.12, (g) => {
    blanketStack(g, '#b7c6a6');
    g.rotation.z = -0.08;
  });
  model('coffee-table', 0.55, 0.02, 0.45, 0, (g) => {
    box(g, 3.05, 0.22, 1.55, pal.woodLight, 0, 1.05, 0, 0.12);
    for (let a of [-1.25, 1.25]) for (let n of [-0.55, 0.55]) box(g, 0.16, 1, 0.16, pal.wood, a, 0.51, n, 0.05);
    box(g, 2.42, 0.1, 1.02, '#d4b382', 0, 0.46, 0, 0.05);
  });
  model('armchair', 3.9, 0.03, -0.72, -0.75, (g) => {
    box(g, 1.48, 0.54, 1.42, '#c5a694', 0, 0.58, 0, 0.2);
    box(g, 1.45, 1.28, 0.4, '#b69382', 0, 1.37, -0.5, 0.17);
    box(g, 1.08, 0.33, 1.03, '#d2b7a5', 0, 0.91, 0.06, 0.16);
    for (let a of [-0.71, 0.71]) box(g, 0.24, 0.82, 1.3, '#b69382', a, 0.7, 0, 0.14);
  });
  model('side-table', 4.1, 0.02, 1.35, 0, (g) => {
    box(g, 1.08, 0.16, 1.08, pal.woodLight, 0, 0.92, 0, 0.1);
    for (let a of [-0.39, 0.39]) for (let n of [-0.39, 0.39]) box(g, 0.11, 0.89, 0.11, pal.wood, a, 0.46, n, 0.04);
  });
  model('lamp', 4.1, 0.98, 1.35, 0, (g) => {
    cyl(g, 0.34, 0.4, 0.12, pal.brass, 0, 0.06, 0, 0.3);
    rod(g, [0, 0.12, 0], [0, 1.22, 0], 0.055, pal.brass, 0.35);
    // The shade is an open cone; draw both sides so its inside shows from above.
    const shadeMat = mat('#eadcaf').clone();
    shadeMat.side = THREE.DoubleSide;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.78, 0.76, 32, 1, true), shadeMat);
    shade.position.y = 1.38;
    shade.castShadow = true;
    g.add(shade);
    sphere(g, 0.16, pal.yellow, 0, 1.34, 0);
    rod(g, [0.1, 0.1, 0], [0.48, -0.55, 0.22], 0.018, pal.dark);
  });
  model('television', -3.72, 0.05, -1.72, 0.28, (g) => {
    box(g, 2.48, 1.48, 0.18, pal.dark, 0, 1.45, 0, 0.08);
    box(g, 2.22, 1.22, 0.025, '#7895a0', 0, 1.45, 0.105, 0.04);
    box(g, 0.62, 0.12, 0.48, pal.dark, 0, 0.69, -0.02, 0.05);
    box(g, 1.18, 0.09, 0.52, pal.dark, 0, 0.59, -0.01, 0.05);
    for (let a = 0; a < 5; a++)
      box(
        g,
        0.32,
        0.16,
        0.012,
        [pal.cream, pal.sageLight, pal.coral, pal.yellow, pal.blue][a],
        -0.75 + (a % 3) * 0.75,
        1.62 - Math.floor(a / 3) * 0.35,
        0.121,
        0.035,
      );
  });
  model('remote', 0.74, 1.19, 0.6, 0.15, (g) => {
    box(g, 0.32, 0.11, 0.88, pal.dark, 0, 0.07, 0, 0.08);
    for (let a = 0; a < 4; a++)
      for (let n = 0; n < 2; n++)
        cyl(g, 0.035, 0.035, 0.025, a === 0 && n === 0 ? pal.red : '#b7c1b9', -0.07 + n * 0.14, 0.14, -0.26 + a * 0.16);
  });
  model('book', -0.25, 1.17, 0.45, -0.18, (g) => book(g, pal.coral));
  model('bookshelf', -4.55, 0.03, 1.86, Math.PI / 2, (g) => {
    box(g, 2.25, 3.45, 0.42, pal.woodLight, 0, 1.73, 0, 0.08);
    box(g, 2.02, 3.14, 0.3, pal.wall, 0, 1.73, 0.24, 0.04);
    for (let a of [0.38, 1.2, 2.03, 2.86]) box(g, 2.08, 0.1, 0.53, pal.wood, 0, a, 0, 0.03);
    for (let a = 0; a < 3; a++)
      for (let n = 0; n < 5; n++) {
        const i = box(
          g,
          0.22,
          0.54,
          0.4,
          [pal.coral, pal.blue, pal.sageDark, pal.yellow, '#9a87a4'][n % 5],
          -0.78 + n * 0.38,
          0.69 + a * 0.82,
          0.05,
          0.025,
        );
        i.rotation.z = n % 2 ? -0.03 : 0.025;
      }
  });
  model('toy-box', -2.32, 0.03, 2.3, 0, (g) => {
    box(g, 2.05, 0.84, 1.32, '#a9bc99', 0, 0.43, 0, 0.1);
    box(g, 1.78, 0.07, 1.05, pal.cream, 0, 0.8, 0, 0.04);
    box(g, 1.35, 0.07, 0.1, pal.wood, 0, 0.88, 0.64, 0.03);
  });
  model('ball', -1.96, 0.93, 2.22, 0, (g) => {
    sphere(g, 0.38, pal.blue, 0, 0.38, 0);
    const a = torus(g, 0.37, 0.026, pal.cream, 0, 0.38, 0);
    a.rotation.x = Math.PI / 2;
  });
  model('blocks', -2.72, 0.88, 2.16, 0, (g) => {
    const a = [
      [-0.35, 0.18, 0, pal.coral],
      [0.02, 0.18, 0.03, pal.yellow],
      [0.38, 0.18, -0.04, pal.blue],
      [-0.18, 0.53, 0, pal.sageDark],
      [0.2, 0.53, 0.02, '#9d89a7'],
      [0.01, 0.88, 0, pal.coral],
    ];
    for (let [n, i, d, w] of a) box(g, 0.34, 0.34, 0.34, w, n, i, d, 0.045);
  });
  model('teddy', 2.86, 0.04, 2.4, -0.22, (g) => {
    sphere(g, 0.46, '#b88d63', 0, 0.72, 0, 0.85, 1, 0.65);
    sphere(g, 0.34, '#c79b70', 0, 1.33, 0);
    for (let a of [-0.25, 0.25]) sphere(g, 0.15, '#b88d63', a, 1.59, 0);
    for (let a of [-0.47, 0.47]) rod(g, [a * 0.6, 0.92, 0], [a, 0.55, 0.02], 0.15, '#b88d63');
    for (let a of [-0.24, 0.24]) sphere(g, 0.2, '#b88d63', a, 0.18, 0.02, 1, 0.7, 1.2);
    sphere(g, 0.075, pal.dark, -0.12, 1.39, 0.28);
    sphere(g, 0.075, pal.dark, 0.12, 1.39, 0.28);
    sphere(g, 0.09, pal.dark, 0, 1.23, 0.31);
  });
  model('basket', 3.75, 0.02, 2.75, 0, (g) => {
    cyl(g, 0.72, 0.55, 0.82, '#c6a16e', 0, 0.42, 0);
    for (let n = 0; n < 9; n++) {
      const i = (n * Math.PI * 2) / 9;
      rod(
        g,
        [Math.cos(i) * 0.57, 0.1, Math.sin(i) * 0.57],
        [Math.cos(i) * 0.68, 0.83, Math.sin(i) * 0.68],
        0.025,
        '#9f7c52',
      );
    }
    const a = torus(g, 0.62, 0.055, '#9f7c52', 0, 0.85, 0);
    a.rotation.x = Math.PI / 2;
  });
  model('picture', 1.7, 2.7, -3.52, 0, (g) => {
    box(g, 2.08, 1.42, 0.1, pal.wood, 0, 0, 0, 0.06);
    box(g, 1.78, 1.15, 0.025, pal.cream, 0, 0, 0.062, 0.04);
    const a = [
      [-0.5, pal.coral, 0.28],
      [0, pal.blue, 0.31],
      [0.5, pal.sageDark, 0.22],
    ];
    for (let [n, i, d] of a) {
      sphere(g, d, i, n, 0.18, 0.09);
      box(g, d * 1.35, 0.45, 0.08, i, n, -0.32, 0.08, 0.04);
    }
  });
  model('family-plant', 3.2, 0.03, -2.68, 0, (g) => plant(g));
  model('family-window', -1.08, 1.42, -3.55, 0, (g) => {
    box(g, 2.7, 2.55, 0.07, pal.white, 0, 1.25, 0, 0.04);
    box(g, 2.42, 2.27, 0.025, '#9bc3cf', 0, 1.25, 0.05, 0.03);
    box(g, 0.08, 2.27, 0.04, pal.white, 0, 1.25, 0.09, 0.02);
    box(g, 2.42, 0.08, 0.04, pal.white, 0, 1.25, 0.09, 0.02);
    for (let a = 0; a < 4; a++) sphere(g, 0.1, pal.white, -0.8 + a * 0.55, 1.85, 0.1, 1, 0.45, 0.15);
  });
  model('curtain', -1.08, 1.36, -3.39, 0, (g) => {
    for (let a of [-1, 1])
      for (let n = 0; n < 5; n++) {
        const i = a * (1.2 + n * 0.12);
        box(g, 0.2, 2.72, 0.11, '#b8a6bf', i, 1.37, 0, 0.07);
      }
    rod(g, [-1.78, 2.83, 0], [1.78, 2.83, 0], 0.045, pal.brass, 0.35);
  });
  model('family-door', -5, 0.07, -0.1, Math.PI / 2, (g) => {
    box(g, 1.72, 3.66, 0.1, pal.white, 0, 1.83, 0, 0.05);
    box(g, 1.45, 3.38, 0.09, '#b9c3a9', 0, 1.8, 0.05, 0.03);
    sphere(g, 0.066, pal.brass, 0.52, 1.72, 0.16);
  });
  model('outlet', -4.88, 0.74, -1.7, Math.PI / 2, (g) => {
    box(g, 0.46, 0.63, 0.055, pal.cream, 0, 0.31, 0, 0.08);
    for (let a of [0.21, 0.43]) {
      box(g, 0.052, 0.12, 0.018, pal.dark, -0.07, a, 0.04, 0.01);
      box(g, 0.052, 0.12, 0.018, pal.dark, 0.07, a, 0.04, 0.01);
      sphere(g, 0.027, pal.dark, 0, a - 0.1, 0.04);
    }
  });
  model('family-clock', 2.95, 3.7, -3.52, 0, (g) => {
    // The face stands upright against the wall (it used to lie flat, sticking out of it).
    cyl(g, 0.62, 0.62, 0.1, pal.cream, 0, 0, 0).rotation.x = Math.PI / 2;
    torus(g, 0.56, 0.055, pal.wood, 0, 0, 0.07);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      box(g, 0.035, 0.11, 0.025, pal.dark, Math.sin(a) * 0.43, Math.cos(a) * 0.43, 0.13, 0.008).rotation.z = -a;
    }
    // The long hand turns about the clock's centre, so it sits in a pivot group at the centre.
    const pivot = group(g);
    pivot.name = 'clock-long-pivot';
    rod(pivot, [0, 0, 0.15], [0, 0.34, 0.15], 0.025, pal.dark);
    rod(g, [0, 0, 0.16], [0.26, -0.03, 0.16], 0.032, pal.dark);
    sphere(g, 0.045, pal.coral, 0, 0, 0.17);
  });
  root.updateMatrixWorld(true);
  for (const word of words) if (!models.has(word.id)) throw new Error(`Missing family room model: ${word.id}`);
  return { ...shapes, pal };
}
