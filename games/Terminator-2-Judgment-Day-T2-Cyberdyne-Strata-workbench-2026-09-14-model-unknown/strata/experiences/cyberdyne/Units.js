/* Extra units built with the existing Strata mesh API. */
import { person, policeCar, helicopter, part, box } from './Models.js';
export function makeOfficer(scene, type = 'patrol') {
  const model = person(scene, false),
    g = model.root;
  if (type === 'patrol') return model;
  for (const m of g.children) if (['#1c304b', '#233c59', '#23374a'].includes(m.color)) m.color = type === 'marksman' ? '#344840' : '#14232b';
  box(scene, g, [0, 1.35, -0.25], [0.65, 0.55, 0.12], '#405362');
  box(scene, g, [0, 2.02, -0.25], [0.41, 0.14, 0.05], '#4f7987');
  for (const x of [-0.17, 0.03, 0.23]) box(scene, g, [x, 1.21, -0.34], [0.13, 0.22, 0.1], '#19292e');
  if (type === 'shield') {
    model.shield = box(scene, g, [-0.18, 1.07, -0.92], [1.08, 1.48, 0.12], '#4a6170');
    box(scene, g, [-0.18, 1.58, -1.0], [0.62, 0.2, 0.04], '#96b5bf');
    box(scene, g, [-0.18, 0.8, -1.0], [0.72, 0.12, 0.04], '#d0dae0');
  } else if (type === 'marksman') {
    box(scene, g, [0.2, 1.25, -0.94], [0.09, 0.1, 1.42], '#10191b');
    part(scene, g, 'cylinder', [0.2, 1.38, -0.7], [0.045, 0.37, 0.045], '#789293', [90, 0, 0]);
    box(scene, g, [0, 1.67, 0.15], [0.83, 0.65, 0.22], '#37473c');
  }
  return model;
}
/** A police motorcycle with its rider. The rider hides when the officer dismounts. The front is -Z. */
function motorcycle(scene, glow) {
  const g = scene.group(),
    panels = [],
    glass = [],
    lamps = [];
  const b = (p, z, c, r = [0, 0, 0], ex = {}) => box(scene, g, p, z, c, r, ex);
  const body = b([0, 0.72, 0], [0.5, 0.42, 1.5], '#d6d9d8');
  panels.push(body);
  panels.push(b([0, 0.96, -0.56], [0.58, 0.36, 0.5], '#1b2a36', [-18, 0, 0]));
  glass.push(b([0, 1.25, -0.74], [0.46, 0.3, 0.04], '#7095a7', [-25, 0, 0]));
  b([0, 0.93, 0.36], [0.4, 0.12, 0.72], '#101a23');
  panels.push(b([0, 0.62, 0.74], [0.66, 0.38, 0.5], '#e7e6dd'));
  b([0.34, 0.66, 0.74], [0.02, 0.2, 0.46], '#1f3d52');
  b([-0.34, 0.66, 0.74], [0.02, 0.2, 0.46], '#1f3d52');
  for (const z of [-0.8, 0.8]) {
    part(scene, g, 'cylinder', [0, 0.36, z], [0.36, 0.14, 0.36], '#0b1620', [0, 0, 90]);
    part(scene, g, 'cylinder', [0, 0.36, z], [0.17, 0.16, 0.17], '#7b9299', [0, 0, 90]);
  }
  b([0, 0.62, -0.66], [0.06, 0.55, 0.06], '#7b8e96', [18, 0, 0]);
  b([0, 1.1, -0.47], [0.82, 0.05, 0.05], '#101a23');
  lamps.push(b([0, 0.96, -0.83], [0.2, 0.15, 0.04], '#f3e8c2', [0, 0, 0], { unlit: true }));
  b([0, 0.82, 1.0], [0.22, 0.1, 0.04], '#af3e42', [0, 0, 0], { unlit: true });
  b([0, 1.1, 0.9], [0.05, 0.22, 0.05], '#1b2630');
  const red = b([-0.17, 1.24, 0.9], [0.15, 0.12, 0.1], '#f33f51', [0, 0, 0], { unlit: true });
  const blue = b([0.17, 1.24, 0.9], [0.15, 0.12, 0.1], '#379af9', [0, 0, 0], { unlit: true });
  const reflection = part(scene, g, 'plane', [0, 0.015, 0], [3.6, 5, 1], '#337ebc', [-90, 0, 0], {
    texture: glow,
    alpha: 0.22,
    unlit: true,
    castShadow: false,
  });
  const rider = [
    b([0, 1.33, 0.2], [0.46, 0.56, 0.3], '#1c304b'),
    b([0, 1.72, 0.12], [0.27, 0.27, 0.29], '#e7e6dd'),
    b([0, 1.71, -0.03], [0.21, 0.1, 0.04], '#101a23'),
    b([-0.23, 1.22, -0.2], [0.12, 0.12, 0.5], '#1c304b', [-15, 0, 0]),
    b([0.23, 1.22, -0.2], [0.12, 0.12, 0.5], '#1c304b', [-15, 0, 0]),
    b([-0.21, 0.86, 0.06], [0.14, 0.14, 0.55], '#1c304b', [20, 0, 0]),
    b([0.21, 0.86, 0.06], [0.14, 0.14, 0.55], '#1c304b', [20, 0, 0]),
  ];
  return { root: g, body, panels, glass, lamps, red, blue, reflection, rider };
}
export function makeVehicle(scene, type, texture, glow) {
  if (type === 'cruiser') return policeCar(scene, texture, glow);
  if (type === 'motorcycle') return motorcycle(scene, glow);
  if (type === 'helicopter') {
    const m = helicopter(scene, glow),
      g = m.root;
    m.body = g.children[0];
    m.panels = [m.body];
    m.glass = [];
    m.lamps = [m.lamp];
    m.red = box(scene, g, [-1.2, 0.5, 0.3], [0.15, 0.15, 0.2], '#ef3c4e', [0, 0, 0], { unlit: true });
    m.blue = box(scene, g, [1.2, 0.5, 0.3], [0.15, 0.15, 0.2], '#62b3ff', [0, 0, 0], { unlit: true });
    m.reflection = m.lamp;
    m.module = box(scene, g, [0, 0.8, 0.65], [0.95, 0.5, 1.0], '#86999c');
    return m;
  }
  const g = scene.group(),
    panels = [],
    glass = [],
    lamps = [];
  const isSUV = type === 'suv',
    isArmor = type === 'armored';
  const width = isArmor ? 2.9 : isSUV ? 2.38 : 2.7;
  const length = isArmor ? 6.25 : isSUV ? 5.1 : 5.9;
  const top = isArmor ? 3.0 : isSUV ? 2.3 : 2.85;
  const paint = isSUV ? '#ced6d8' : isArmor ? '#374f53' : '#233947';
  const b = (p, z, c = paint, r = [0, 0, 0], ex = {}) => box(scene, g, p, z, c, r, ex);
  const body = b([0, 0.85, 0], [width, 0.8, length]);
  panels.push(body);
  panels.push(b([0, top * 0.68, 0.68], [width * 0.93, top * 0.56, length * 0.64]));
  const hood = b([0, isArmor ? 1.5 : 1.23, -length * 0.34], [width * 0.92, 0.36, length * 0.29], isSUV ? '#253641' : '#465f67');
  panels.push(hood);
  panels.push(b([0, top, -0.0], [width * 0.96, 0.15, length * 0.7]));
  glass.push(b([0, top * 0.8, -length * 0.22], [width * 0.81, top * 0.23, 0.05], '#618b9d', [12, 0, 0]));
  for (const side of [-1, 1]) {
    for (const z of [-0.43, 0.77]) glass.push(b([side * width * 0.475, top * 0.81, z], [0.035, top * 0.24, 0.92], '#476f81'));
    b([side * width * 0.504, 1.18, 0.6], [0.04, 0.35, 1.9], isSUV ? '#1f3d52' : '#506c79');
    part(scene, g, 'plane', [side * width * 0.511, 1.2, 0.6], [1.75, 0.3, 1], '#ffffff', [0, side * 90, 0], {
      texture,
      unlit: true,
      castShadow: false,
    });
    for (const z of [-length * 0.31, length * 0.32]) {
      part(scene, g, 'cylinder', [side * width * 0.47, 0.57, z], [0.58, 0.28, 0.58], '#0b1620', [0, 0, 90]);
      part(scene, g, 'cylinder', [side * width * 0.53, 0.57, z], [0.3, 0.035, 0.3], '#7b9299', [0, 0, 90]);
    }
    lamps.push(b([side * width * 0.34, 1.0, -length * 0.505], [0.38, 0.22, 0.05], '#f3e8c2', [0, 0, 0], { unlit: true }));
    b([side * width * 0.4, 1.0, length * 0.505], [0.25, 0.23, 0.05], '#af3e42');
  }
  b([0, 0.67, -length * 0.53], [width * 1.05, 0.25, 0.3], '#81959a');
  if (isArmor) {
    for (const x of [-width * 0.49, width * 0.49]) b([x, 1.35, 0], [0.16, 1.2, length * 0.72], '#60747b', [0, 0, x > 0 ? -7 : 7]);
    b([0, 1.2, -length * 0.58], [width * 0.88, 0.8, 0.23], '#24363a');
    for (const x of [-0.7, 0, 0.7]) b([x, 1.2, -length * 0.6], [0.07, 0.82, 0.08], '#8ea2a3');
  }
  b([0, top + 0.13, 0.0], [1.65, 0.1, 0.38], '#111e2c');
  const red = b([-0.52, top + 0.25, 0], [0.54, 0.2, 0.33], '#f33f51', [0, 0, 0], { unlit: true });
  const blue = b([0.52, top + 0.25, 0], [0.54, 0.2, 0.33], '#379af9', [0, 0, 0], { unlit: true });
  const reflection = part(scene, g, 'plane', [0, 0.015, 0], [7, 10, 1], '#337ebc', [-90, 0, 0], {
    texture: glow,
    alpha: 0.27,
    unlit: true,
    castShadow: false,
  });
  return { root: g, body, panels, glass, lamps, red, blue, reflection };
}
