/**
 * bathroom.js — room 03, the bathroom: bath time, brushing teeth and washing hands.
 *
 * Built like the other rooms: the back wall runs along z = -3.5 and the side
 * wall along x = -5, so the same orbiting camera frames it. The bath sits in
 * the back-left corner, the toilet in the middle and the washstand with its
 * mirror on the right. Named parts are what the lessons animate: the toilet
 * lid flips, the duck and boat float, the toothbrush brushes, the sponge and
 * toothpaste squeeze, the bath fills and the washstand doors open.
 */

import * as THREE from 'three/webgpu';
import { createShapes } from './shapes.js';

export const BATHROOM_PALETTE = {
  cream: '#f7eee0',
  wall: '#e7ede6',
  tile: '#f4f7f1',
  grout: '#d5ded7',
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
  water: '#b9dfe4',
  glass: '#cfe2e6',
  plum: '#a18fa9',
  green: '#a5b979',
};

export function buildBathroom(words) {
  const pal = BATHROOM_PALETTE;
  const shapes = createShapes({ roughness: 0.62, boxSegments: 5, sphereSegments: [28, 20], torusSegments: [12, 48] });
  const { root, models, mat, addMesh, box, cyl, sphere, torus, rod, tube, lathe, group, model } = shapes;

  /** A wavy hanging cloth like the kitchen towel, `w` × `h`, double-sided. */
  function cloth(g, w, h, color, x, y, z) {
    const geo = new THREE.PlaneGeometry(w, h, 22, 22);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++)
      pos.setZ(v, Math.sin(pos.getX(v) * 24) * 0.03 + Math.pow(pos.getY(v) + h / 2, 2) * 0.05);
    geo.computeVertexNormals();
    const clothMat = mat(color).clone();
    clothMat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, clothMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------- surfaces

  model('bath-floor', 0, 0, 0, 0, (g) => {
    box(g, 10.2, 0.26, 7.4, '#d9e0d6', 0, -0.16, 0, 0.12);
    // Big square tiles in two soft shades.
    for (let ix = 0; ix < 12; ix++)
      for (let iz = 0; iz < 9; iz++) {
        const x = -4.4 + ix * 0.8;
        const z = -3.2 + iz * 0.8;
        box(g, 0.77, 0.035, 0.77, (ix + iz) % 2 ? '#eef1ea' : '#e5ebe3', x, -0.015, z, 0.01);
      }
  });

  model('bath-wall', 0, 0, 0, 0, (g) => {
    box(g, 10.25, 5.25, 0.18, pal.wall, 0, 2.48, -3.62, 0.045);
    box(g, 0.18, 5.25, 7.25, '#dde6df', -5.06, 2.48, -0.03, 0.045);
    box(g, 10.1, 0.16, 0.1, pal.white, 0, 0.07, -3.5, 0.018);
    box(g, 0.1, 0.16, 7.15, pal.white, -4.94, 0.07, 0, 0.018);
    // Tiles up to shoulder height on both walls, with a white cap rail.
    for (let row = 0; row < 6; row++) {
      const y = 0.35 + row * 0.34;
      for (let col = 0; col < 19; col++) {
        const x = -4.5 + col * 0.5;
        box(g, 0.47, 0.31, 0.03, (row + col) % 2 ? pal.tile : '#e9f0ea', x, y, -3.515, 0.012);
      }
      for (let col = 0; col < 10; col++) {
        const z = -3.05 + col * 0.5; // stops short of the door
        box(g, 0.03, 0.31, 0.47, (row + col) % 2 ? pal.tile : '#e9f0ea', -4.955, y, z, 0.012);
      }
    }
    box(g, 10.1, 0.06, 0.07, pal.white, 0, 2.235, -3.49, 0.02);
    box(g, 0.07, 0.06, 5.0, pal.white, -4.93, 2.235, -0.95, 0.02);
  });

  model('bath-window', -4.93, 3.6, -2.15, Math.PI / 2, (g) => {
    box(g, 1.7, 1.4, 0.12, pal.white, 0, 0, 0, 0.03);
    box(g, 1.46, 1.16, 0.02, '#d5e7ea', 0, 0, 0.06, 0);
    // Frosted glass: a few soft, blurry spots.
    for (let i = 0; i < 6; i++) {
      const spot = sphere(g, 0.09, '#e7f2f3', -0.5 + (i % 3) * 0.5, 0.25 - Math.floor(i / 3) * 0.5, 0.072, 1, 1, 0.1);
      spot.castShadow = false;
    }
    box(g, 0.06, 1.2, 0.05, pal.white, 0, 0, 0.085, 0.01);
    box(g, 1.5, 0.06, 0.05, pal.white, 0, 0, 0.085, 0.01);
    box(g, 1.9, 0.1, 0.26, pal.white, 0, -0.74, 0.1, 0.03);
  });

  model('bath-door', -4.94, 0.07, 2.45, Math.PI / 2, (g) => {
    box(g, 1.68, 3.65, 0.09, pal.white, 0, 1.83, 0, 0.045);
    box(g, 1.42, 3.39, 0.1, '#b9c9c3', 0, 1.8, 0.045, 0.025);
    box(g, 1.15, 1.38, 0.028, '#abbeb6', 0, 2.55, 0.106, 0.03);
    box(g, 1.15, 1.15, 0.028, '#abbeb6', 0, 0.99, 0.106, 0.03);
    sphere(g, 0.066, pal.brass, 0.52, 1.7, 0.16);
  });

  model('bath-mat', -3.1, 0.022, -0.95, 0, (g) => {
    box(g, 2.6, 0.04, 1.3, pal.sageLight, 0, 0, 0, 0.02);
    for (const z of [-0.45, -0.3, 0.3, 0.45]) box(g, 2.45, 0.006, 0.05, pal.cream, 0, 0.022, z, 0.004);
    for (let i = 0; i < 16; i++)
      for (const x of [-1.38, 1.38]) box(g, 0.16, 0.012, 0.045, pal.sageLight, x, 0, -0.56 + i * 0.075, 0.005);
  });

  // ---------------------------------------------------------------- the bath corner

  model('bath', -3.2, 0.03, -2.55, 0, (g) => {
    // A built-in tub: a solid base and four walls, so the water inside can rise and fall.
    box(g, 3.3, 0.9, 1.85, pal.white, 0, 0.45, 0, 0.14);
    box(g, 3.3, 0.5, 0.2, pal.white, 0, 1.05, 0.825, 0.08);
    box(g, 3.3, 0.5, 0.36, pal.white, 0, 1.05, -0.745, 0.08);
    box(g, 0.2, 0.5, 1.85, pal.white, -1.55, 1.05, 0, 0.08);
    box(g, 0.2, 0.5, 1.85, pal.white, 1.55, 1.05, 0, 0.08);
    box(g, 3.1, 0.14, 0.03, pal.sageLight, 0, 0.42, 0.93, 0.015);
    box(g, 3.1, 0.05, 0.03, pal.sage, 0, 0.6, 0.93, 0.01);
    const water = group(g);
    water.name = 'bath-water';
    const surface = box(water, 2.92, 0.05, 1.3, pal.water, 0, 1.1, 0.08, 0.02);
    surface.castShadow = false;
    const bubbles = [
      [-1.05, 0.35, 0.13],
      [-0.85, 0.5, 0.1],
      [-0.7, 0.32, 0.08],
      [0.95, -0.2, 0.12],
      [1.12, -0.05, 0.09],
      [0.2, 0.55, 0.07],
    ];
    for (const [x, z, r] of bubbles) sphere(water, r, pal.white, x, 1.13, z, 1, 0.55, 1);
  });

  model('bath-tap', -3.2, 1.3, -3.35, 0, (g) => {
    box(g, 0.95, 0.26, 0.05, pal.white, 0, 0.55, -0.12, 0.03);
    tube(
      g,
      [
        [0, 0.55, -0.1],
        [0, 0.6, 0.1],
        [0, 0.52, 0.26],
        [0, 0.38, 0.3],
      ],
      0.05,
      pal.brass,
    );
    cyl(g, 0.045, 0.045, 0.06, pal.brass, 0, 0.36, 0.3, 0.5);
    for (const [x, color, name] of [
      [-0.33, pal.coral, 'tap-hot'],
      [0.33, pal.blue, 'tap-cold'],
    ]) {
      rod(g, [x, 0.55, -0.1], [x, 0.55, 0.0], 0.035, pal.brass, 0.5);
      const knob = cyl(g, 0.1, 0.1, 0.1, color, x, 0.55, 0.05);
      knob.rotation.x = Math.PI / 2;
      knob.name = name;
    }
  });

  model('shampoo', -4.4, 1.33, -3.3, 0.15, (g) => {
    box(g, 0.34, 0.62, 0.22, pal.plum, 0, 0.31, 0, 0.1);
    box(g, 0.24, 0.26, 0.012, pal.white, 0, 0.3, 0.112, 0.02);
    box(g, 0.18, 0.04, 0.014, pal.blue, 0, 0.36, 0.115, 0.01);
    const lid = group(g);
    lid.name = 'shampoo-lid';
    cyl(lid, 0.09, 0.11, 0.12, pal.cream, 0, 0.68, 0);
  });

  model('sponge', -2.05, 1.33, -3.29, 0.15, (g) => {
    const body = group(g);
    body.name = 'squeeze-body';
    box(body, 0.46, 0.2, 0.3, pal.yellow, 0, 0.1, 0, 0.06);
    const holes = [
      [-0.14, 0.2, -0.06],
      [0.02, 0.2, 0.07],
      [0.15, 0.2, -0.04],
      [-0.05, 0.2, -0.1],
      [-0.12, 0.1, 0.15],
      [0.1, 0.12, 0.15],
    ];
    for (const [x, y, z] of holes) {
      const flat = y > 0.15;
      sphere(body, 0.03, '#c9a24a', x, y, z, 1, flat ? 0.3 : 1, flat ? 1 : 0.3);
    }
  });

  /** A toy that floats: everything sits in 'float-body' so the lesson can bob it. */
  model('duck', -2.55, 1.1, -2.35, -0.5, (g) => {
    const float = group(g);
    float.name = 'float-body';
    const body = group(float);
    body.name = 'squeeze-body';
    sphere(body, 0.3, pal.yellow, 0, 0.18, 0, 1.25, 0.8, 1);
    sphere(body, 0.12, pal.yellow, -0.36, 0.3, 0, 1, 0.8, 0.7);
    sphere(body, 0.19, pal.yellow, 0.22, 0.52, 0);
    sphere(body, 0.09, '#e39a55', 0.42, 0.49, 0, 1.2, 0.55, 1).name = 'duck-beak';
    for (const z of [-0.11, 0.11]) sphere(body, 0.03, pal.dark, 0.33, 0.59, z);
    for (const z of [-0.25, 0.25]) sphere(body, 0.13, '#e2b458', -0.02, 0.26, z, 1.3, 0.6, 0.35);
  });

  model('boat', -3.95, 1.1, -2.25, 0.35, (g) => {
    const float = group(g);
    float.name = 'float-body';
    box(float, 0.75, 0.2, 0.34, pal.coral, 0, 0.08, 0, 0.08);
    box(float, 0.62, 0.04, 0.26, pal.cream, 0, 0.2, 0, 0.02);
    rod(float, [0, 0.2, 0], [0, 0.78, 0], 0.018, pal.woodDark);
    const sail = new THREE.Shape();
    sail.moveTo(0.03, 0.27);
    sail.lineTo(0.03, 0.74);
    sail.lineTo(0.32, 0.3);
    sail.closePath();
    const sailMat = mat('#f4ead6').clone();
    sailMat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(sail), sailMat);
    mesh.name = 'boat-sail';
    mesh.castShadow = true;
    float.add(mesh);
    box(float, 0.12, 0.07, 0.01, pal.red, 0.07, 0.8, 0, 0.005);
  });

  // ---------------------------------------------------------------- the toilet and potty

  model('toilet', -0.35, 0.03, -2.75, 0, (g) => {
    lathe(
      g,
      [
        [0, 0],
        [0.42, 0],
        [0.4, 0.08],
        [0.3, 0.35],
        [0.34, 0.72],
        [0, 0.72],
      ],
      pal.white,
    );
    const bowl = cyl(g, 0.5, 0.36, 0.34, pal.white, 0, 0.82, 0.12);
    bowl.scale.z = 1.25;
    const water = cyl(g, 0.34, 0.34, 0.01, pal.water, 0, 0.995, 0.12);
    water.scale.z = 1.25;
    water.castShadow = false;
    const seat = torus(g, 0.4, 0.07, '#f3efe4', 0, 1.0, 0.12);
    seat.rotation.x = -Math.PI / 2;
    seat.scale.y = 1.25;
    // The lid hinges at the back of the seat; lessons flip it up.
    const lid = group(g, 0, 1.1, -0.4);
    lid.name = 'toilet-lid';
    const cover = cyl(lid, 0.46, 0.46, 0.05, '#f3efe4', 0, 0, 0.52);
    cover.scale.z = 1.2;
    box(g, 0.95, 0.85, 0.34, pal.white, 0, 1.45, -0.58, 0.1);
    box(g, 1.0, 0.08, 0.38, '#f3efe4', 0, 1.9, -0.58, 0.03);
    cyl(g, 0.08, 0.08, 0.05, pal.brass, 0, 1.955, -0.58, 0.5).name = 'flush-button';
  });

  model('potty', 0.3, 0.03, -0.35, -0.35, (g) => {
    lathe(
      g,
      [
        [0, 0],
        [0.42, 0],
        [0.44, 0.06],
        [0.36, 0.34],
        [0.3, 0.36],
        [0, 0.36],
      ],
      pal.green,
    );
    const rim = torus(g, 0.33, 0.07, pal.white, 0, 0.38, 0);
    rim.rotation.x = -Math.PI / 2;
    box(g, 0.6, 0.34, 0.1, pal.green, 0, 0.52, -0.34, 0.05);
    box(g, 0.16, 0.14, 0.08, pal.green, 0, 0.44, 0.34, 0.04);
    for (const x of [-0.36, 0.36]) sphere(g, 0.07, '#8fa468', x, 0.42, -0.05, 1, 0.6, 1.6);
  });

  // ---------------------------------------------------------------- the washstand

  model('bath-sink', 2.5, 0.03, -2.78, 0, (g) => {
    // A cupboard with a shelf inside (towels and a spare roll) and two doors that open.
    for (const x of [-1.35, 1.35]) box(g, 0.1, 1.55, 1.3, pal.sage, x, 0.8, 0, 0.03);
    box(g, 2.8, 1.55, 0.1, pal.sageDark, 0, 0.8, -0.6, 0.03);
    box(g, 2.7, 0.1, 1.25, pal.sage, 0, 0.08, 0, 0.03);
    box(g, 2.6, 0.06, 1.1, pal.sageLight, 0, 0.8, -0.05, 0.02);
    for (let i = 0; i < 3; i++) box(g, 0.72, 0.1, 0.55, i % 2 ? pal.coral : pal.blue, -0.6, 0.88 + i * 0.1, -0.1, 0.04);
    cyl(g, 0.16, 0.16, 0.24, pal.white, 0.6, 0.25, -0.05);
    for (const side of [-1, 1]) {
      const door = group(g, side * 1.3, 0, 0.66);
      door.name = side < 0 ? 'cabinet-left' : 'cabinet-right';
      box(door, 1.26, 1.36, 0.07, pal.sageLight, -side * 0.63, 0.8, 0, 0.04);
      box(door, 1.0, 1.1, 0.02, pal.sage, -side * 0.63, 0.8, 0.04, 0.03);
      sphere(door, 0.05, pal.brass, -side * 1.12, 0.95, 0.07);
    }
    box(g, 2.95, 0.12, 1.42, pal.white, 0, 1.64, 0.03, 0.04);
    // A round basin sitting on the counter, with its tap behind it.
    lathe(
      g,
      [
        [0, 1.7],
        [0.3, 1.7],
        [0.46, 1.78],
        [0.52, 1.98],
        [0.48, 2.0],
        [0.42, 1.84],
        [0.26, 1.78],
        [0, 1.78],
      ],
      pal.white,
    ).position.z = 0.05;
    cyl(g, 0.06, 0.06, 0.012, '#718f91', 0, 1.786, 0.05);
    tube(
      g,
      [
        [0, 1.7, -0.5],
        [0, 2.15, -0.5],
        [0, 2.24, -0.36],
        [0, 2.12, -0.22],
      ],
      0.035,
      pal.brass,
    );
    cyl(g, 0.05, 0.05, 0.1, pal.brass, 0.22, 1.75, -0.5, 0.5);
  });

  model('mirror', 2.5, 3.2, -3.49, 0, (g) => {
    box(g, 1.9, 1.5, 0.08, pal.wood, 0, 0, 0, 0.12);
    box(g, 1.68, 1.28, 0.02, pal.glass, 0, 0, 0.045, 0.06);
    for (const [x, len] of [
      [-0.45, 0.9],
      [-0.2, 0.55],
    ]) {
      const shine = box(g, 0.08, len, 0.006, '#eef7f8', x, 0.05, 0.058, 0.003);
      shine.rotation.z = -0.55;
      shine.castShadow = false;
    }
  });

  model('tooth-cup', 1.55, 1.73, -3.18, 0, (g) => {
    lathe(
      g,
      [
        [0, 0],
        [0.16, 0],
        [0.18, 0.04],
        [0.19, 0.42],
        [0.165, 0.44],
        [0.15, 0.06],
        [0, 0.05],
      ],
      pal.blue,
    );
    // A second toothbrush lives in the cup.
    rod(g, [0.05, 0.08, 0.02], [-0.12, 0.86, -0.03], 0.028, pal.green);
    box(g, 0.07, 0.18, 0.05, pal.green, -0.14, 0.98, -0.03, 0.02).rotation.z = 0.21;
  });

  model('toothbrush', 1.55, 1.73, -3.18, 0, (g) => {
    const brush = group(g);
    brush.name = 'brush-body';
    brush.rotation.z = -0.2;
    rod(brush, [0, 0.05, 0], [0, 0.78, 0], 0.03, pal.coral);
    rod(brush, [0, 0.78, 0], [0, 0.92, 0], 0.02, pal.coral);
    box(brush, 0.07, 0.2, 0.05, pal.coral, 0, 1.0, 0.01, 0.02);
    box(brush, 0.07, 0.16, 0.07, pal.white, 0, 1.0, 0.055, 0.015);
  });

  model('toothpaste', 3.4, 1.73, -2.42, 0.4, (g) => {
    const body = cyl(g, 0.09, 0.12, 0.62, pal.white, 0, 0.075, 0);
    body.rotation.z = Math.PI / 2;
    body.scale.x = 0.65;
    box(g, 0.05, 0.1, 0.24, pal.white, 0.33, 0.075, 0, 0.02);
    box(g, 0.25, 0.012, 0.15, pal.coral, 0.05, 0.15, 0, 0.004);
    const cap = cyl(g, 0.06, 0.06, 0.1, pal.blue, -0.36, 0.075, 0);
    cap.rotation.z = Math.PI / 2;
    cap.name = 'paste-cap';
    // A bead of paste that only appears when a lesson squeezes the tube.
    const bead = sphere(g, 0.06, '#e8f3f3', -0.47, 0.08, 0, 1, 0.8, 1);
    bead.name = 'squeeze-bead';
    bead.scale.setScalar(0.001);
  });

  model('comb', 1.75, 1.73, -2.35, 0.25, (g) => {
    box(g, 0.62, 0.035, 0.1, pal.blue, 0, 0.02, -0.06, 0.015);
    for (let i = 0; i < 14; i++)
      box(g, 0.02, 0.025, 0.14, pal.blue, -0.28 + i * 0.043, 0.018, 0.05, 0.004).name = 'comb-teeth';
  });

  model('bath-soap', 3.55, 1.73, -3.15, 0, (g) => {
    cyl(g, 0.28, 0.22, 0.06, pal.blue, 0, 0.03, 0).scale.z = 0.7;
    box(g, 0.34, 0.12, 0.22, '#c4bbd1', 0, 0.12, 0, 0.05);
    for (const [x, z, r] of [
      [0.08, 0.03, 0.035],
      [-0.05, -0.04, 0.028],
      [0.0, 0.07, 0.022],
    ])
      sphere(g, r, pal.white, x, 0.2, z);
  });

  model('step-stool', 2.55, 0.03, -1.45, 0, (g) => {
    box(g, 1.1, 0.12, 0.45, pal.woodLight, 0, 0.42, 0.2, 0.04);
    box(g, 1.1, 0.12, 0.45, pal.woodLight, 0, 0.82, -0.22, 0.04);
    for (const x of [-0.52, 0.52]) {
      box(g, 0.08, 0.48, 0.9, pal.wood, x, 0.24, 0, 0.03);
      box(g, 0.08, 0.4, 0.45, pal.wood, x, 0.68, -0.22, 0.03);
    }
    for (const [y, z] of [
      [0.484, 0.12],
      [0.484, 0.28],
      [0.884, -0.3],
      [0.884, -0.14],
    ])
      box(g, 0.9, 0.008, 0.05, pal.sageDark, 0, y, z, 0.003);
  });

  model('laundry', 4.1, 0.02, 1.2, 0, (g) => {
    cyl(g, 0.62, 0.5, 1.1, '#c6a16e', 0, 0.55, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10;
      rod(
        g,
        [Math.cos(a) * 0.51, 0.08, Math.sin(a) * 0.51],
        [Math.cos(a) * 0.63, 1.08, Math.sin(a) * 0.63],
        0.022,
        '#9f7c52',
      );
    }
    for (const x of [-0.64, 0.64]) torus(g, 0.1, 0.025, '#9f7c52', x, 0.9, 0); // side handles
    // Clothes peeking out under the lid.
    sphere(g, 0.26, pal.coral, -0.15, 1.12, 0.05, 1, 0.5, 1);
    sphere(g, 0.22, pal.blue, 0.2, 1.14, -0.1, 1, 0.45, 1);
    sphere(g, 0.14, pal.yellow, 0.05, 1.18, 0.25, 1.2, 0.4, 0.6);
    const lid = group(g);
    lid.name = 'laundry-lid';
    const cover = cyl(lid, 0.66, 0.66, 0.07, '#b08b5a', 0.08, 1.24, 0);
    cover.rotation.z = 0.14;
    sphere(lid, 0.07, pal.woodDark, 0.08, 1.3, 0, 1, 0.6, 1);
  });

  model('bath-towel', -4.88, 2.3, 0.35, Math.PI / 2, (g) => {
    rod(g, [-0.62, 0, 0], [0.62, 0, 0], 0.03, pal.brass, 0.45);
    for (const x of [-0.66, 0.66]) cyl(g, 0.035, 0.035, 0.14, pal.brass, x, 0, -0.06, 0.45).rotation.x = Math.PI / 2;
    cloth(g, 0.95, 1.3, pal.blue, 0, -0.66, 0.05);
    // Two white stripes that follow the folds of the towel.
    for (const y of [-1.12, -1.18]) {
      const stripe = new THREE.PlaneGeometry(0.94, 0.028, 22, 1);
      const sp = stripe.attributes.position;
      for (let v = 0; v < sp.count; v++) sp.setZ(v, Math.sin(sp.getX(v) * 24) * 0.03 + 0.006);
      const mesh = new THREE.Mesh(stripe, mat(pal.white));
      mesh.position.set(0, y, 0.05);
      g.add(mesh);
    }
  });

  root.updateMatrixWorld(true);
  for (const word of words) if (!models.has(word.id)) throw new Error(`Missing bathroom model: ${word.id}`);
  return { ...shapes, pal };
}
