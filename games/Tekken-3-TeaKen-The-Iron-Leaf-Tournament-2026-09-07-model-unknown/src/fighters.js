// TeaKen fighters: the roster, the move table, the procedural poses, and the
// faceted bodies built from those poses every frame.

import { TAU, hex, tint, lerp, smooth, clamp } from './geo.js';

export const MAX_HP = 170;

export const roster = [
  { id: 0, name: 'REN', style: 'IRON PALM', art: 'KARATE', title: 'THE FIRST LEAF', tag: 'BALANCED · PUNISH & LAUNCH', desc: 'A quiet fighter with a heavy right hand. Fast punches. Clean launches. No wasted motion.', power: 4, speed: 4, reach: 3, skin: hex('#c9986c'), pants: hex('#9d3930'), dark: hex('#262d2c'), accent: hex('#dcaf64'), hair: hex('#20292a'), height: 1.03, bulk: 1, damage: 1, speedMod: 1, finisher: 'Iron leaf chain' },
  { id: 1, name: 'AYA', style: 'SILK TEMPEST', art: 'KICKBOXING', title: 'THE STORM IN SILK', tag: 'FAST · KICK STRINGS & EVASION', desc: 'Light feet. Relentless kicks. Move around the guard, then strike before it can close.', power: 3, speed: 5, reach: 4, skin: hex('#d9ad86'), pants: hex('#253c42'), dark: hex('#243238'), accent: hex('#6ab5a5'), hair: hex('#212c31'), height: 0.99, bulk: 0.82, damage: 0.91, speedMod: 0.9, finisher: 'Silk cyclone' },
  { id: 2, name: 'ROOK', style: 'STONE GUARD', art: 'BRAWLING', title: 'THE LAST MOUNTAIN', tag: 'POWER · COUNTERS & THROWS', desc: 'Built like a temple wall. Give him one opening and he will make you feel every stone.', power: 5, speed: 2, reach: 4, skin: hex('#b39c81'), pants: hex('#4e594b'), dark: hex('#293332'), accent: hex('#c6a36c'), hair: hex('#b2afa0'), height: 1.09, bulk: 1.23, damage: 1.17, speedMod: 1.12, finisher: 'Stone breaker' },
  { id: 3, name: 'SHO', style: 'JADE CRANE', art: 'CRANE KUNG FU', title: 'THE IRON LEAF MASTER', tag: 'REACH · LONG PALMS & PATIENCE', desc: 'The keeper of the tournament. Forty years of tea and discipline. He waits on the terrace, and he never moves first.', power: 4, speed: 3, reach: 5, skin: hex('#c09574'), pants: hex('#2f4a3c'), dark: hex('#1c2420'), accent: hex('#86b08f'), hair: hex('#e6e2d4'), height: 1.0, bulk: 0.92, damage: 1.05, speedMod: 0.96, finisher: 'Crane returns to the leaf', boss: true },
];

export const moves = {
  lp: { name: 'Lead jab', button: 'lp', pose: 'lp', level: 'HIGH', start: 10, active: 3, recovery: 15, dmg: 8, range: 1.42, stun: 16, push: 0.11, step: 0.13 },
  rp: { name: 'Cross', button: 'rp', pose: 'rp', level: 'HIGH', start: 12, active: 3, recovery: 18, dmg: 13, range: 1.56, stun: 19, push: 0.17, step: 0.21 },
  lk: { name: 'Side kick', button: 'lk', pose: 'lk', level: 'MID', start: 15, active: 4, recovery: 21, dmg: 17, range: 1.88, stun: 20, push: 0.27, step: 0.1 },
  rk: { name: 'High roundhouse', button: 'rk', pose: 'rk', level: 'HIGH', start: 19, active: 4, recovery: 23, dmg: 23, range: 1.95, stun: 24, push: 0.35, step: 0.14, track: true },
  lowjab: { name: 'Body jab', button: 'lp', pose: 'lowjab', level: 'MID', start: 11, active: 3, recovery: 16, dmg: 7, range: 1.33, stun: 14, push: 0.07, step: 0.1 },
  lowkick: { name: 'Shin kick', button: 'lk', pose: 'lowkick', level: 'LOW', start: 14, active: 3, recovery: 19, dmg: 12, range: 1.72, stun: 19, push: 0.13, step: 0.07 },
  sweep: { name: 'Falling leaf', button: 'rk', pose: 'sweep', level: 'LOW', start: 23, active: 5, recovery: 27, dmg: 21, range: 1.9, stun: 24, push: 0.29, step: 0.1, knock: true, track: true },
  launch: { name: 'Rising iron', button: 'rp', pose: 'launch', level: 'MID', start: 16, active: 4, recovery: 25, dmg: 19, range: 1.58, stun: 25, push: 0.13, step: 0.25, launch: true },
  thrust: { name: 'Temple breaker', button: 'rp', pose: 'rp', level: 'MID', start: 18, active: 4, recovery: 23, dmg: 20, range: 1.7, stun: 23, push: 0.43, step: 0.34 },
  axe: { name: 'Axe kick', button: 'rk', pose: 'axe', level: 'MID', start: 24, active: 5, recovery: 25, dmg: 25, range: 1.88, stun: 23, push: 0.32, step: 0.17, knock: true },
  throw: { name: 'Iron bind', button: 'throw', pose: 'throw', level: 'THROW', start: 12, active: 2, recovery: 31, dmg: 29, range: 1.24, stun: 30, push: 0.65, step: 0.1, knock: true },
  jumpkick: { name: 'Hopping heel', button: 'rk', pose: 'lk', level: 'MID', start: 15, active: 5, recovery: 23, dmg: 21, range: 1.9, stun: 20, push: 0.38, step: 0.28 },
};

export function fighter(id, char, x) {
  return {
    id, char: roster[char], x, z: 0, y: 0, vy: 0, vx: 0, vz: 0, dir: id === 0 ? [1, 0] : [-1, 0], hp: MAX_HP, delay: MAX_HP,
    state: 'idle', attack: null, buffer: null, stun: 0, ground: 0, invuln: 0, sidestep: 0, sideSign: 0, dash: 0, dashDir: 0, walk: 0,
    crouch: false, guard: false, guardLow: false, blockTime: 0, aiClock: 0, aiMove: 0, aiGuard: 0, aiCrouch: false, aiAttack: null,
    combo: 0, comboDamage: 0, comboTime: 0, comboCounter: false, taken: 0, juggle: 0, hitAge: 0, history: [], lastMove: '',
    lastDamage: 0, totalDamage: 0, pose: null, throwBreak: 0, lastTap: { left: -1, right: -1 }, attackSerial: 0, chainStart: false,
  };
}

/* ------------------------------------------------------------ poses */

function basePose(t, f) {
  const b = Math.sin(t * 5.5 + f.id) * 0.017, w = f.walk, step = Math.sin(t * 12) * 0.17 * w;
  return { hip: [0, 1.02 + b, 0], chest: [0.02, 1.49 + b, 0], head: [0.13, 1.89 + b, 0], ls: [-0.12, 1.55 + b, 0.24], le: [0.05, 1.27 + b, 0.4], lh: [0.47, 1.56 + b, 0.3], rs: [0.16, 1.56 + b, -0.23], re: [0.33, 1.28 + b, -0.27], rh: [0.6, 1.67 + b, -0.17], lk: [-0.28 + step, 0.53, 0.25], lf: [-0.48 + step, 0.09, 0.31], rk: [0.26 - step, 0.55, -0.2], rf: [0.46 - step, 0.09, -0.24] };
}
function clonePose(p) {
  const n = {};
  for (const k in p) n[k] = p[k].slice();
  return n;
}
function blendPose(a, b, t) {
  const p = {};
  for (const k in a) p[k] = [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t), lerp(a[k][2], b[k][2], t)];
  return p;
}
function crouchPose(p, amount = 1) {
  for (const k of ['hip', 'chest', 'head', 'ls', 'le', 'lh', 'rs', 're', 'rh']) p[k][1] -= 0.39 * amount;
  p.lk[0] -= 0.12 * amount;
  p.rk[0] += 0.12 * amount;
  p.lk[1] -= 0.07 * amount;
  p.rk[1] -= 0.09 * amount;
  return p;
}
function attackPose(base, type, wind = false) {
  const p = clonePose(base);
  if (wind) {
    if (type === 'sweep' || type === 'launch') crouchPose(p, 0.85);
    else {
      p.chest[0] -= 0.12;
      p.head[0] -= 0.11;
    }
    if (type === 'lp' || type === 'lowjab') p.lh = [-0.13, 1.5, 0.4];
    else if (type === 'rp' || type === 'launch' || type === 'throw') p.rh = [-0.12, 1.45, -0.34];
    else {
      p.rk = [0.35, 0.87, -0.18];
      p.rf = [0.02, 0.58, -0.18];
      p.lh = [0.38, 1.77, 0.3];
    }
    return p;
  }
  if (type === 'lp' || type === 'lowjab') {
    p.chest[0] = 0.13; p.head[0] = 0.22; p.ls = [0.07, 1.58, 0.21]; p.le = [0.57, 1.65, 0.2]; p.lh = [1.12, 1.69, 0.07];
    if (type === 'lowjab') crouchPose(p, 0.76);
  }
  if (type === 'rp') {
    p.chest[0] = 0.17; p.head[0] = 0.27; p.rs = [0.24, 1.57, -0.12]; p.re = [0.72, 1.62, -0.05]; p.rh = [1.21, 1.63, 0.06]; p.lh = [0.43, 1.74, 0.28]; p.rf[0] += 0.17;
  }
  if (type === 'lk' || type === 'lowkick') {
    p.hip[0] = -0.03; p.chest[0] = -0.17; p.head[0] = -0.24; p.rk = [0.85, 1.05, -0.13]; p.rf = [1.57, 1.09, -0.14]; p.lf = [-0.37, 0.08, 0.3]; p.lh = [0.3, 1.63, 0.4]; p.rh = [0.39, 1.7, -0.12];
    if (type === 'lowkick') {
      p.rk = [0.77, 0.49, -0.09]; p.rf = [1.48, 0.27, -0.1]; p.chest[0] = -0.08; p.head[0] = -0.1;
    }
  }
  if (type === 'rk' || type === 'axe') {
    p.hip[0] = -0.09; p.chest[0] = -0.31; p.head[0] = -0.36; p.lk = [0.68, 1.39, 0.1]; p.lf = [1.45, type === 'axe' ? 1.43 : 1.92, -0.04]; p.rf = [0.13, 0.08, -0.19]; p.rk = [0.13, 0.55, -0.2]; p.lh = [-0.22, 1.65, 0.48]; p.le = [-0.46, 1.42, 0.4]; p.rh = [0.18, 1.87, -0.04];
  }
  if (type === 'sweep') {
    crouchPose(p, 0.96);
    p.lk = [0.75, 0.39, 0.21]; p.lf = [1.51, 0.15, 0.13]; p.rf = [-0.15, 0.08, -0.25]; p.rk = [0.12, 0.34, -0.19]; p.chest[0] = -0.2; p.head[0] = -0.12; p.lh = [-0.31, 1.26, 0.59]; p.le = [-0.43, 1.06, 0.43]; p.rh = [0.4, 1.24, -0.31];
  }
  if (type === 'launch') {
    p.hip[0] = 0.12; p.chest[0] = 0.2; p.head[0] = 0.17; p.rs = [0.22, 1.6, -0.18]; p.re = [0.7, 1.71, -0.15]; p.rh = [0.77, 2.27, 0.03]; p.lh = [0.15, 1.4, 0.35]; p.rf[0] += 0.22;
  }
  if (type === 'throw') {
    p.chest[0] = 0.22; p.head[0] = 0.24; p.le = [0.63, 1.41, 0.34]; p.lh = [1.0, 1.58, 0.22]; p.re = [0.66, 1.4, -0.2]; p.rh = [1.02, 1.48, -0.22]; p.rf[0] += 0.14;
  }
  return p;
}

export function getPose(f, t) {
  let p = basePose(t, f);
  if (f.crouch && !f.attack && f.state !== 'air') crouchPose(p);
  if (f.attack) {
    const a = f.attack, m = a.move, n = a.frame, w = attackPose(basePose(t, f), m.pose, true), s = attackPose(basePose(t, f), m.pose, false), split = m.start * 0.46;
    if (n < split) p = blendPose(p, w, smooth(clamp(n / split, 0, 1)));
    else if (n < m.start + 1) p = blendPose(w, s, smooth(clamp((n - split) / (m.start + 1 - split), 0, 1)));
    else if (n < m.start + m.active + 2) p = s;
    else p = blendPose(s, p, smooth(clamp((n - m.start - m.active - 2) / (m.recovery - 2), 0, 1)));
  } else if (f.stun > 0) {
    const s = Math.min(1, f.stun / 8);
    p.head[0] -= 0.3 * s; p.chest[0] -= 0.17 * s; p.lh = [0.08, 1.72, 0.46]; p.rh = [0.21, 1.54, -0.45];
  } else if (f.state === 'block') {
    p.lh = [0.35, 1.88, 0.15]; p.le = [0.03, 1.53, 0.25]; p.rh = [0.43, 1.83, -0.07]; p.re = [0.17, 1.45, -0.26];
  }
  if (f.sidestep > 0) {
    const s = Math.sin((f.sidestep / 18) * Math.PI);
    p.hip[2] += s * 0.1; p.chest[2] += s * 0.19; p.head[2] += s * 0.2;
  }
  if (f.state === 'victory') {
    p.lh = [-0.24, 2.63, 0.22]; p.le = [-0.32, 2.09, 0.29]; p.ls = [-0.14, 1.61, 0.24]; p.rh = [0.3, 1.16, -0.32]; p.re = [0.38, 1.32, -0.32]; p.head[1] += 0.05; p.chest[1] += 0.03;
    if (f.char.id === 1) {
      p.lh = [0.68, 1.6, -0.04]; p.le = [0.16, 1.42, 0.38]; p.rh = [0.2, 1.56, 0.27]; p.re = [0.44, 1.38, -0.3];
    } else if (f.char.id === 3) {
      // The master's salute: fist into open palm, a slow bow.
      p.lh = [0.42, 1.52, 0.02]; p.le = [0.12, 1.33, 0.3]; p.rh = [0.4, 1.5, -0.04]; p.re = [0.14, 1.31, -0.3]; p.head[0] += 0.08; p.head[1] -= 0.06; p.chest[0] += 0.05;
    }
  }
  let tilt = 0;
  if (f.state === 'air') tilt = clamp(0.35 + f.y * 0.34, 0.35, 1.15);
  if (f.state === 'down' || f.state === 'ko') tilt = 1.5;
  if (tilt) {
    const c = Math.cos(tilt), s = Math.sin(tilt), lift = f.state === 'air' ? 1.05 : 0.25;
    for (const k in p) {
      const [x, y, z] = p[k];
      p[k] = [x * c - (y - 1.03) * s, Math.max(0.07, x * s + (y - 1.03) * c + lift), z];
    }
  }
  return p;
}

/* ------------------------------------------------------------ bodies */

const C_SCAR = hex('#986d51');
const C_YELLOW = hex('#d7b568');
const C_GOLD = hex('#dbbb6b');
const C_PAD = hex('#7c4637');
const C_LIP = '#744c3d';
const C_GREY = hex('#8c958a');
const C_PIN = hex('#d6b166');
const C_KNUCKLE = hex('#aa4735');
const C_WRAP = hex('#cee0b9');
const C_BOOT = hex('#252d29');
const C_SASH = hex('#c9a65e');
const C_JADE = hex('#5fa07a');

const off = (q, x, y, z) => [q[0] + x, q[1] + y, q[2] + z];
const along = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Build one fighter into g (a Geo) from its pose at time t. */
export function drawFighter(g, f, t, poseOverride = null) {
  const p = poseOverride || getPose(f, t), C = f.char, id = C.id, bulk = C.bulk, h = C.height, d0 = f.dir[0], d1 = f.dir[1];
  f.pose = p;
  const rx = f.x, ry = f.y, rz = f.z;
  const bodyMap = (q, o) => {
    const x = q[0], y = q[1], z = q[2];
    o[0] = rx + (x * d0 - z * d1) * h;
    o[1] = ry + y * h;
    o[2] = rz + (x * d1 + z * d0) * h;
    return o;
  };
  g.map = bodyMap;
  const skin = C.skin, pants = C.pants, dark = C.dark, accent = C.accent, hair = C.hair;
  const chest = p.chest, hip = p.hip, head = p.head;
  const top = id === 1 ? accent : id === 3 ? pants : skin;
  // The torso is built from tapered, faceted volumes rather than a box.
  g.bone(off(hip, 0, 0.03, 0), off(chest, 0, -0.04, 0), 0.18 * bulk, 0.29 * bulk, top, 8);
  g.sphere(off(chest, -0.025, -0.015, 0), [0.23 * bulk, 0.225, 0.32 * bulk], top, 4, 8);
  g.bone(off(hip, 0, -0.08, 0), off(hip, 0, 0.12, 0), 0.245 * bulk, 0.185 * bulk, pants, 8);
  if (id === 0) {
    // Chest scar and short black shoulder wrap.
    g.bone(off(chest, -0.17, 0.18, 0.16), off(chest, -0.19, -0.22, 0.18), 0.037, 0.05, dark, 5);
    g.bone(off(chest, 0.172, 0.1, 0.16), off(chest, 0.172, -0.1, 0.23), 0.009, 0.008, C_SCAR, 4);
  } else if (id === 1) {
    g.bone(off(hip, 0, 0.12, 0), off(hip, 0, 0.2, 0), 0.198 * bulk, 0.2 * bulk, C_YELLOW, 8);
    g.quad(off(hip, -0.15, -0.09, 0.22), off(hip, 0.17, -0.09, 0.21), off(hip, 0.1, -0.43, 0.28), off(hip, -0.23, -0.41, 0.29), accent);
    g.quad(off(chest, 0.2, 0.18, 0.09), off(chest, 0.26, -0.18, 0.07), off(chest, 0.25, -0.18, 0.1), off(chest, 0.19, 0.18, 0.12), C_GOLD);
  } else if (id === 2) {
    for (const side of [-1, 1]) {
      g.bone(off(hip, -0.11, 0.13, side * 0.13), off(chest, -0.13, 0.15, side * 0.23), 0.1, 0.165, dark, 6);
      g.sphere(off(chest, -0.04, 0.12, side * 0.27), [0.2, 0.13, 0.17], C_PAD, 3, 6);
    }
    g.box(off(hip, 0.16, 0.08, 0), [0.13, 0.16, 0.24], accent);
  } else {
    // The master's robe: crossed jade lapels, a gold sash and a long front panel.
    g.quad(off(chest, 0.235, 0.2, 0.17), off(chest, 0.26, 0.12, 0.2), off(chest, 0.25, -0.24, -0.06), off(chest, 0.24, -0.18, -0.12), accent);
    g.quad(off(chest, 0.25, 0.2, -0.17), off(chest, 0.272, 0.12, -0.2), off(chest, 0.262, -0.1, 0.02), off(chest, 0.252, -0.04, 0.08), accent);
    g.bone(off(hip, 0, 0.1, 0), off(hip, 0, 0.21, 0), 0.215 * bulk, 0.215 * bulk, C_SASH, 8);
    g.quad(off(hip, 0.2, 0.02, -0.14), off(hip, 0.2, 0.02, 0.14), off(hip, 0.27, -0.52, 0.13), off(hip, 0.27, -0.52, -0.15), pants);
    g.quad(off(hip, -0.2, 0.02, -0.15), off(hip, -0.2, 0.02, 0.15), off(hip, -0.25, -0.48, 0.16), off(hip, -0.25, -0.48, -0.16), dark);
  }
  // Neck and angular head, facing along the fighting axis.
  g.bone(off(chest, 0.07, 0.13, 0), off(head, -0.01, -0.11, 0), 0.095, 0.092, skin, 6);
  const H = [0, 0, 0];
  g.map = (q, o) => {
    H[0] = head[0] + (q[0] - head[0]) * 0.82;
    H[1] = head[1] + (q[1] - head[1]) * 0.76;
    H[2] = head[2] + (q[2] - head[2]) * 0.86;
    return bodyMap(H, o);
  };
  g.sphere(head, [0.19, 0.238, 0.167], skin, 5, 8);
  g.sphere(off(head, 0.077, -0.095, 0), [0.157, 0.115, 0.132], skin, 3, 6);
  g.bone(off(head, 0.167, -0.035, 0), off(head, 0.235, -0.036, 0), 0.055, 0.014, tint(skin, 1.03), 4);
  for (const side of [-1, 1]) {
    g.sphere(off(head, -0.012, -0.017, side * 0.16), [0.055, 0.09, 0.043], tint(skin, 0.88), 3, 5);
    g.box(off(head, 0.145, 0.022, side * 0.098), [0.034, 0.017, 0.05], '#ddd6b8', 0.15);
    g.box(off(head, 0.172, 0.019, side * 0.095), [0.014, 0.019, 0.027], dark);
    g.bone(off(head, 0.175, 0.065, side * 0.047), off(head, 0.111, 0.064, side * 0.145), 0.011, 0.008, hair, 4);
  }
  g.bone(off(head, 0.191, -0.12, -0.05), off(head, 0.191, -0.12, 0.05), 0.009, 0.009, C_LIP, 4);
  // Each fighter has a distinct silhouette, hair, and clothing.
  if (id === 0) {
    g.sphere(off(head, -0.035, 0.148, 0), [0.196, 0.134, 0.172], hair, 3, 7);
    for (let i = 0; i < 7; i++) {
      const z = (i - 3) * 0.052;
      g.bone(off(head, -0.04, 0.2, z), off(head, -0.12 - (i % 2) * 0.05, 0.3 + Math.sin(i) * 0.03, z), 0.072, 0.005, hair, 4);
    }
    g.bone(off(head, 0.095, 0.18, 0.05), off(head, 0.11, 0.29, 0.052), 0.045, 0.001, C_GREY, 4);
  } else if (id === 1) {
    g.sphere(off(head, -0.055, 0.132, 0), [0.173, 0.153, 0.184], hair, 3, 8);
    const a = off(head, -0.16, 0.11, -0.02), b = off(head, -0.38, 0.03 + Math.sin(t * 4) * 0.045, -0.08), c = off(head, -0.48, -0.36, -0.11), d = off(head, -0.37, -0.63 + Math.sin(t * 3) * 0.06, -0.12);
    g.bone(a, b, 0.08, 0.067, hair, 6);
    g.bone(b, c, 0.065, 0.052, hair, 6);
    g.bone(c, d, 0.05, 0.012, hair, 6);
    g.bone(off(head, -0.15, 0.11, -0.02), off(head, -0.21, 0.08, -0.04), 0.085, 0.08, accent, 6);
    g.bone(off(head, 0.02, 0.17, 0.158), off(head, 0.02, 0.24, 0.156), 0.022, 0.01, C_PIN, 4);
  } else if (id === 2) {
    g.sphere(off(head, -0.012, 0.188, 0), [0.187, 0.082, 0.17], hair, 2, 7);
    g.sphere(off(head, 0.042, -0.149, 0), [0.15, 0.063, 0.13], tint(hair, 0.55), 3, 6);
  } else {
    // White hair swept into a topknot with a jade pin, long brows, and a flowing beard.
    g.sphere(off(head, -0.03, 0.15, 0), [0.19, 0.11, 0.17], hair, 3, 7);
    g.sphere(off(head, -0.09, 0.3, 0), [0.075, 0.07, 0.075], hair, 3, 6);
    g.bone(off(head, -0.09, 0.3, -0.13), off(head, -0.09, 0.32, 0.13), 0.012, 0.012, C_JADE, 4);
    for (const side of [-1, 1]) g.bone(off(head, 0.18, 0.07, side * 0.05), off(head, 0.15, 0.03, side * 0.19), 0.018, 0.006, hair, 4);
    const sway = Math.sin(t * 2.6) * 0.03;
    const b0 = off(head, 0.16, -0.16, 0), b1 = off(head, 0.15 + sway * 0.5, -0.32, 0), b2 = off(head, 0.11 + sway, -0.52, 0);
    g.bone(b0, b1, 0.075, 0.06, hair, 6);
    g.bone(b1, b2, 0.06, 0.012, hair, 6);
    for (const side of [-1, 1]) g.bone(off(head, 0.19, -0.1, side * 0.04), off(head, 0.17, -0.25, side * 0.11), 0.016, 0.004, hair, 4);
  }
  g.map = bodyMap;
  // Muscles and articulated hands.
  for (const prefix of ['l', 'r']) {
    const s = p[prefix + 's'], e = p[prefix + 'e'], hand = p[prefix + 'h'];
    const wrist = along(e, hand, 0.8);
    if (id === 3) {
      // Wide robe sleeves; bare, open hands.
      g.sphere(s, [0.17 * bulk, 0.16, 0.16 * bulk], pants, 3, 6);
      g.bone(s, e, 0.13 * bulk, 0.11 * bulk, pants, 7);
      g.sphere(e, [0.11 * bulk, 0.1, 0.11 * bulk], pants, 3, 6);
      g.bone(e, wrist, 0.115 * bulk, 0.155 * bulk, pants, 7);
      g.bone(along(e, hand, 0.74), wrist, 0.15 * bulk, 0.158 * bulk, accent, 7);
      g.bone(wrist, hand, 0.06, 0.075, skin, 6);
      g.sphere(hand, [0.11, 0.085, 0.07], skin, 3, 6);
      g.sphere(off(hand, 0.07, 0.02, 0), [0.07, 0.03, 0.06], tint(skin, 0.94), 2, 5);
      continue;
    }
    g.sphere(s, [0.166 * bulk, 0.16, 0.153 * bulk], id === 2 ? dark : skin, 3, 6);
    g.bone(s, e, 0.125 * bulk, 0.088 * bulk, skin, 7);
    g.sphere(e, [0.09 * bulk, 0.09, 0.09 * bulk], skin, 3, 6);
    g.bone(e, wrist, 0.116 * bulk, 0.067 * bulk, skin, 7);
    g.bone(wrist, hand, 0.085 * bulk, 0.1 * bulk, id === 1 ? accent : dark, 6);
    g.sphere(hand, [0.134 * bulk, 0.1 * bulk, 0.1 * bulk], id === 1 ? accent : dark, 3, 6);
    g.sphere(off(hand, 0.065, 0.023, 0), [0.075, 0.059, 0.081], id === 0 ? C_KNUCKLE : accent, 3, 5);
    for (let j = 0; j < 2; j++) {
      const a = along(wrist, hand, 0.2 + j * 0.32);
      g.sphere(a, [0.081 * bulk, 0.077 * bulk, 0.077 * bulk], id === 1 ? C_WRAP : accent, 2, 6);
    }
  }
  // Wide stance, separate knees, ankles, and feet.
  for (const [prefix, side] of [['l', 1], ['r', -1]]) {
    const start = off(hip, -side * 0.09, -0.035, side * 0.17 * bulk), k = p[prefix + 'k'], foot = p[prefix + 'f'];
    const wide = id === 3 ? 1.22 : 1;
    g.bone(start, k, 0.167 * bulk * wide, 0.13 * bulk * wide, pants, 7);
    g.sphere(k, [0.135 * bulk * wide, 0.15, 0.134 * bulk * wide], id === 0 ? dark : pants, 3, 6);
    const ankle = off(foot, -0.02, 0.12, 0);
    g.bone(k, ankle, 0.137 * bulk * wide, 0.077 * bulk * (id === 3 ? 1.6 : 1), pants, 7);
    if (id === 0) {
      const mid = along(k, ankle, 0.4);
      g.bone(off(mid, 0.09, 0, side * 0.055), off(ankle, 0.035, 0.1, side * 0.06), 0.027, 0.011, accent, 4);
    }
    g.bone(ankle, foot, 0.088 * bulk, 0.09 * bulk, id === 1 ? accent : dark, 7);
    g.sphere(off(foot, 0.092, -0.001, 0), [0.216, 0.096, 0.117 * bulk], id === 0 ? skin : dark, 3, 7);
    if (id === 2) g.box(off(foot, 0.11, -0.057, 0), [0.31, 0.06, 0.23], C_BOOT);
  }
  // Belt, hanging ends and cloth give the idle pose secondary motion.
  g.bone(off(hip, 0, 0.045, 0), off(hip, 0, 0.116, 0), 0.245 * bulk, 0.222 * bulk, id === 0 ? dark : id === 3 ? C_SASH : accent, 8);
  const knot = off(hip, 0.2, 0.075, 0.12);
  g.sphere(knot, [0.07, 0.055, 0.07], id === 0 ? accent : dark, 3, 5);
  const end = off(knot, -0.05, -0.38, 0.09 + Math.sin(t * 4) * 0.055);
  g.bone(knot, end, 0.035, 0.023, id === 0 ? accent : dark, 4);
  g.map = null;
}

/** A soft oval contact shadow under a fighter (into a transparent Geo). */
const SHADOW = [0.08, 0.12, 0.11, 0.33];
const _p = [0, 0, 0], _q = [0, 0, 0], _r = [0, 0, 0];
export function drawShadow(g, f) {
  const r = f.char.bulk, alpha = clamp(0.33 - f.y * 0.055, 0.12, 0.33);
  SHADOW[3] = alpha;
  _p[0] = f.x; _p[1] = 0.014; _p[2] = f.z;
  for (let i = 0; i < 24; i++) {
    const a = (TAU * i) / 24, b = (TAU * (i + 1)) / 24;
    _q[0] = _p[0] + Math.cos(a) * 0.64 * r; _q[1] = 0.014; _q[2] = _p[2] + Math.sin(a) * 0.34 * r;
    _r[0] = _p[0] + Math.cos(b) * 0.64 * r; _r[1] = 0.014; _r[2] = _p[2] + Math.sin(b) * 0.34 * r;
    g.tri(_p, _q, _r, SHADOW, 1);
  }
}
