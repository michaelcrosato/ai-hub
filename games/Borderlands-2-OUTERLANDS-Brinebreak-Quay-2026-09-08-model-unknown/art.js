// OUTERLANDS: procedural art for everything that moves or gets picked up.
// Built with the original Builder (flat-shaded, ink edges); gfx.js makes three.js meshes.
import { Builder, C, color } from './util.js';

/**
 * Enemy body and leg. Kinds: raider (melee), gunner, boss (Foreman Rime),
 * lobber (Slush Lobber, new) and badass (Knuckles Brine, the bounty target, new).
 */
export function enemyArt(kind) {
  const boss = kind === 'boss';
  const badass = kind === 'badass';
  const lobber = kind === 'lobber';
  const melee = kind === 'raider' || badass;
  const b = new Builder();
  const coat = boss ? C.orange : badass ? color('#c99a3b') : lobber ? color('#6f9aa6') : melee ? C.rust : color('#8ca397');
  const eyes = boss || badass ? C.red : C.yellow;
  b.box(0, 1.25, 0, 0.75, 0.88, 0.48, coat);
  b.box(0, 1.65, 0, 0.97, 0.18, 0.6, C.dark);
  b.box(0, 0.83, 0, 0.8, 0.14, 0.53, C.dark);
  b.box(0, 1.24, 0.28, 0.5, 0.52, 0.12, C.steel);
  b.box(-0.25, 1.23, 0.36, 0.16, 0.34, 0.1, C.yellow);
  b.box(0.27, 1.05, 0.33, 0.17, 0.22, 0.13, C.dark);
  b.ico(0, 2.01, 0, 0.35, C.paper, 1, 1.14, 0.9, true);
  b.box(0, 1.98, 0.29, 0.57, 0.2, 0.08, C.dark);
  b.box(-0.14, 1.99, 0.35, 0.16, 0.085, 0.04, eyes);
  b.box(0.14, 1.99, 0.35, 0.16, 0.085, 0.04, eyes);
  b.box(0, 1.8, 0.3, 0.27, 0.17, 0.1, C.dark);
  b.box(0, 2.3, -0.02, 0.58, 0.15, 0.48, coat);
  b.box(-0.54, 1.47, 0, 0.35, 0.46, 0.39, coat, 0, 0.16);
  b.box(0.54, 1.47, 0, 0.35, 0.46, 0.39, coat, 0, -0.16);
  b.box(-0.55, 1.22, 0.27, 0.23, 0.24, 0.55, C.dark);
  b.box(0.55, 1.22, 0.3, 0.23, 0.24, 0.55, C.dark);
  b.box(-0.54, 1.2, 0.55, 0.22, 0.21, 0.18, C.paper);
  b.box(0.55, 1.2, 0.59, 0.22, 0.21, 0.18, C.paper);
  if (melee) {
    b.beam([0.57, 1.1, 0.5], [0.57, 1.65, 1.08], 0.07, C.dark);
    b.box(0.57, 1.75, 1.02, 0.48, 0.4, 0.07, C.steel, 0, 0, -0.3);
  } else if (lobber) {
    // A slush mortar on the right arm, fed by a coolant tank on the back.
    b.box(0.48, 1.3, 0.75, 0.36, 0.34, 0.7, C.dark);
    b.beam([0.48, 1.36, 1.0], [0.48, 1.42, 1.38], 0.15, C.steel, 8);
    b.box(0.48, 1.27, 0.6, 0.36, 0.24, 0.25, coat);
    b.box(0.48, 1.55, 0.8, 0.15, 0.09, 0.16, C.blue);
    b.cylinder(0, 1.45, -0.43, 0.24, 0.24, 0.8, C.blue, 8);
    b.cylinder(0, 1.9, -0.43, 0.12, 0.12, 0.12, C.dark, 6);
    b.beam([0, 1.72, -0.43], [0.45, 1.42, 0.45], 0.035, C.dark, 4);
  } else {
    b.box(0.48, 1.28, 0.85, 0.34, 0.3, 0.85, C.dark);
    b.box(0.48, 1.35, 1.3, 0.16, 0.15, 0.35, C.steel);
    b.box(0.48, 1.27, 0.63, 0.36, 0.24, 0.25, coat);
    b.box(0.48, 1.47, 0.85, 0.15, 0.09, 0.16, C.yellow);
  }
  if (boss) {
    b.box(-0.65, 1.76, -0.02, 0.7, 0.37, 0.74, C.rust, 0, 0.1);
    b.box(0.65, 1.76, -0.02, 0.7, 0.37, 0.74, C.rust, 0, -0.1);
    b.cylinder(0, 1.55, -0.43, 0.29, 0.29, 0.9, C.blue, 8);
    b.beam([-0.63, 1.95, 0], [-0.68, 2.5, 0], 0.07, C.dark);
    b.box(0.48, 1.25, 1.16, 0.52, 0.48, 0.7, C.orange);
    for (const x of [0.33, 0.63]) b.beam([x, 1.31, 1.2], [x, 1.31, 1.65], 0.085, C.dark);
  }
  if (badass) {
    // Spiked pauldrons, a red crest and a second, much larger cleaver blade.
    b.box(-0.68, 1.8, 0, 0.62, 0.3, 0.66, C.dark, 0, 0.12);
    b.box(0.68, 1.8, 0, 0.62, 0.3, 0.66, C.dark, 0, -0.12);
    for (const sx of [-0.68, 0.68]) {
      b.beam([sx, 1.92, 0.12], [sx * 1.3, 2.38, 0.12], 0.06, C.paper, 4);
      b.beam([sx, 1.92, -0.16], [sx * 1.3, 2.3, -0.16], 0.05, C.paper, 4);
    }
    b.box(0, 2.5, -0.02, 0.1, 0.26, 0.52, C.red);
    b.box(0.57, 1.98, 1.12, 0.66, 0.56, 0.08, C.steel, 0, 0, -0.3);
    b.box(0.57, 2.2, 1.14, 0.6, 0.06, 0.09, C.red, 0, 0, -0.3);
  }
  const leg = new Builder()
    .box(0, 0.43, 0, 0.29, 0.78, 0.35, C.dark)
    .box(0, 0.38, 0.19, 0.33, 0.34, 0.16, coat)
    .box(0, 0.11, 0.13, 0.36, 0.21, 0.61, C.dark);
  return { body: b, leg };
}

/** First-person weapon model: rifle, shotgun or pistol, in the given body colour. */
export function weaponArt(type, col) {
  const b = new Builder();
  if (type === 'rifle') {
    b.box(0, 0, 0, 0.19, 0.22, 0.63, col);
    b.box(0, 0.09, -0.14, 0.14, 0.08, 0.68, C.dark);
    b.box(0, -0.13, 0.25, 0.12, 0.28, 0.18, C.dark, 0, 0, 0.17);
    b.box(0, -0.17, -0.05, 0.14, 0.34, 0.2, C.steel, 0, 0, -0.13);
    b.box(0, 0.02, -0.51, 0.13, 0.12, 0.32, C.dark);
    b.box(0, 0.02, -0.76, 0.085, 0.085, 0.27, C.steel);
    b.box(0, 0.02, -0.92, 0.14, 0.15, 0.1, C.dark);
    b.box(0, -0.01, 0.4, 0.21, 0.2, 0.4, C.dark);
    b.box(0, 0.19, 0.02, 0.11, 0.13, 0.16, C.dark);
    b.box(0, 0.18, -0.46, 0.09, 0.12, 0.07, C.dark);
    b.box(0, 0.2, -0.47, 0.045, 0.045, 0.03, C.yellow);
    b.box(0.102, 0.02, 0.02, 0.015, 0.08, 0.35, C.yellow);
    for (let z = -0.29; z < 0.15; z += 0.1) b.box(0.108, -0.03, z, 0.02, 0.05, 0.035, C.ink);
  } else if (type === 'shotgun') {
    b.box(0, 0, 0, 0.27, 0.23, 0.53, col);
    for (const x of [-0.075, 0.075]) b.beam([x, 0.035, -0.1], [x, 0.035, -1.02], 0.075, C.dark, 8);
    b.box(0, -0.085, -0.49, 0.26, 0.17, 0.35, C.rust);
    for (let z = -0.62; z < -0.32; z += 0.07) b.box(0, -0.085, z, 0.28, 0.15, 0.025, C.dark);
    b.box(0, -0.13, 0.21, 0.12, 0.28, 0.17, C.dark, 0, 0, 0.24);
    b.box(0, 0.03, 0.36, 0.21, 0.2, 0.45, C.rust);
    b.box(0, 0.16, -0.95, 0.08, 0.08, 0.06, C.yellow);
    b.box(0.146, 0.025, 0, 0.02, 0.1, 0.3, C.yellow);
  } else {
    b.box(0, 0.045, -0.15, 0.18, 0.18, 0.54, col);
    b.box(0, 0.16, -0.15, 0.16, 0.045, 0.5, C.dark);
    b.box(0, -0.16, 0.04, 0.13, 0.35, 0.18, C.dark, 0, 0, 0.2);
    b.box(0, 0.04, -0.48, 0.14, 0.12, 0.15, C.dark);
    b.box(0, 0.19, -0.34, 0.045, 0.05, 0.045, C.yellow);
    b.box(0.101, 0.04, -0.12, 0.02, 0.04, 0.21, C.paper);
  }
  return b;
}

export const armArt = () =>
  new Builder()
    .box(0, 0, 0, 0.22, 0.21, 0.55, C.dark, 0, 0, -0.15)
    .box(0, 0.03, -0.27, 0.23, 0.23, 0.24, C.rust)
    .box(0, 0.025, -0.39, 0.19, 0.18, 0.18, C.paper);

export const LOOT_TYPES = ['ammo', 'health', 'cash', 'gun', 'legend'];

export function lootArt(type) {
  const col = { ammo: C.yellow, health: C.red, cash: C.paper, gun: C.blue, legend: C.orange }[type];
  const b = new Builder();
  if (type === 'health') {
    b.box(0, 0.18, 0, 0.65, 0.36, 0.45, C.paper);
    b.box(0, 0.38, 0, 0.14, 0.05, 0.28, C.red);
    b.box(0, 0.38, 0, 0.33, 0.05, 0.12, C.red);
  } else if (type === 'ammo') {
    b.box(0, 0.15, 0, 0.6, 0.3, 0.37, C.dark);
    for (const x of [-0.2, 0, 0.2]) b.cylinder(x, 0.36, 0, 0.06, 0.035, 0.23, C.yellow, 6, false);
  } else if (type === 'cash') {
    b.box(0, 0.1, 0, 0.45, 0.17, 0.27, C.paper);
    b.box(0, 0.2, 0, 0.11, 0.03, 0.3, C.steel);
  } else {
    b.box(0, 0.22, 0, 0.85, 0.25, 0.24, col);
    b.box(0.57, 0.25, 0, 0.55, 0.09, 0.1, C.dark);
    b.box(-0.22, 0.07, 0, 0.13, 0.22, 0.15, C.dark, 0, -0.3);
  }
  return b;
}

export const barrelArt = () =>
  new Builder()
    .cylinder(0, 0.68, 0, 0.5, 0.5, 1.36, C.red, 10)
    .cylinder(0, 0.2, 0, 0.52, 0.52, 0.1, C.dark, 10)
    .cylinder(0, 1.17, 0, 0.52, 0.52, 0.1, C.dark, 10)
    .box(0, 0.7, 0.48, 0.4, 0.45, 0.06, C.yellow);

export const grenadeArt = () => new Builder().ico(0, 0, 0, 0.16, C.dark, 1, 1.2, 1, true).box(0, 0.19, 0, 0.1, 0.1, 0.1, C.yellow);

export const relayGlowArt = () => new Builder().box(0, 0, 0, 0.8, 0.45, 0.07, C.blue, 0, 0, 0, false);

/** A unit icosahedron in one flat colour: sparks, orbs, enemy bolts. */
export const orbArt = (col) => new Builder().ico(0, 0, 0, 1, col);
