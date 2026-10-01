// Pocket Parade. Where every little thing sits when a roll begins. The sunny-side room is
// the original layout, seeded so it is the same on every run; the encore ("The Big Tidy")
// keeps that room and adds furniture-sized toys in hand-picked spots.
import { compose, Q, PI, TAU, setSeed, rnd, between } from './geometry.js';
import { P } from './models.js';
import { clearSpot, obstacles, inTable } from './room.js';

let items = [];

/** One thing on the floor (base 0), on the table or on the ruler (base = surface height). */
export function spawn(id, x, z, base = 0, opts = {}) {
  const p = P[id];
  // The yaw and phase draws stay in this order even when opts overrides them: the seeded
  // layout depends on the exact sequence of random numbers.
  const it = { p, x, z, base, y: base + p.height / 2 + 0.025, yaw: between(-PI, PI), collected: false, need: p.need, volume: p.volume, cooldown: 0, phase: rnd() * TAU, ...opts };
  it.matrix = compose([it.x, it.y, it.z], Q.euler(0, it.yaw, 0));
  items.push(it);
  return it;
}

function placeRandom(id, n, zone) {
  const p = P[id];
  for (let i = 0; i < n; i++) {
    let x = 0, z = 0, ok = false;
    for (let k = 0; k < 100; k++) {
      if (zone) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * zone.r; x = zone.x + Math.cos(a) * r; z = zone.z + Math.sin(a) * r; }
      else { x = between(-16, 16); z = between(-13.6, 14.1); }
      if (!clearSpot(x, z, p.radius)) continue;
      // Keep the first stretch around the candy trail free of things that block a small ball.
      if (p.need > 16 && x > -8.5 - p.radius * 0.5 && x < -5.5 + p.radius * 0.5 && z > -1.5 && z < 9.5) continue;
      const blocked = items.some((it) => !it.base && Math.hypot(x - it.x, z - it.z) < (p.radius + it.p.radius) * 0.82);
      if (!blocked) { ok = true; break; }
    }
    if (ok) spawn(id, x, z);
  }
}

/** The encore's furniture-sized toys: hand-placed clear of the trail, the ramp and the furniture. */
export const ENCORE_PIECES = [
  ['house', 13.4, 6.2, -0.5], ['beanbag', -13.2, 10.4, 0.6], ['horse', -1.6, 6.4, 0.3],
  ['basket', 14.2, -6.8, 0.2], ['stool', -9.4, -2.6, 0], ['stool', 3.6, 12.6, 0.4],
  ['uke', 1.8, -11.6, 0.35], ['globe', -15.4, -5.6, 0], ['lamp', 15.2, 12.4, 0], ['lamp', -15.5, -9.6, 0],
];

/** Fill the room for a roll. mode: 'mission' | 'free' | 'encore' | 'title'. Returns the item list. */
export function buildItems(mode = 'mission') {
  items = [];
  setSeed(47112);
  // Follow this gentle candy trail for the first size increase.
  for (let i = 0; i < 14; i++) { const z = 7.4 - i * 0.54, x = -7 + Math.sin(i * 0.52) * 0.43; spawn(i % 3 === 0 ? 'coin' : i % 3 === 1 ? 'candy' : 'button', x, z, 0, { yaw: i * 0.6 }); }
  for (let i = 0; i < 8; i++) spawn(i % 2 ? 'cookie' : 'die', -6.3 + i * 0.6, -0.4 + Math.sin(i * 0.6) * 0.45, 0, { yaw: i * 0.27 });
  placeRandom('coin', 16, { x: -7, z: 5, r: 5.2 }); placeRandom('candy', 20, { x: -7, z: 5, r: 6.2 }); placeRandom('button', 14, { x: -7, z: 5, r: 6.1 });
  placeRandom('pencil', 12); placeRandom('eraser', 10); placeRandom('die', 15); placeRandom('cookie', 14); placeRandom('berry', 13); placeRandom('spool', 10); placeRandom('sushi', 10);
  placeRandom('orange', 14); for (let j = 0; j < 3; j++) placeRandom('block' + j, 7);
  placeRandom('mug', 7); placeRandom('can', 7); placeRandom('duck', 8); placeRandom('car', 6); placeRandom('book', 9); placeRandom('ball', 7); placeRandom('carton', 7);
  placeRandom('robot', 4); placeRandom('slipper', 6); placeRandom('clock', 3); placeRandom('teapot', 3); placeRandom('teddy', 4); placeRandom('plant', 5); placeRandom('pillow', 4); placeRandom('biscuits', 4);
  // A little tea party on the table, reached by the ruler.
  spawn('plate', 5.5, -7.9, 4.075, { yaw: 0.2 }); spawn('sushi', 5.3, -7.9, 4.25, { yaw: 0.1 }); spawn('sushi', 5.7, -7.55, 4.25, { yaw: 0.1 });
  spawn('mug', 8.5, -8.2, 4.08, { yaw: -0.4 }); spawn('teapot', 8.6, -5.1, 4.08, { yaw: -0.35 }); spawn('cookie', 6.45, -5.3, 4.08); spawn('cookie', 5.7, -5.8, 4.08);
  spawn('can', 10.4, -9.4, 4.08); spawn('book', 3.9, -9.1, 4.08, { yaw: -0.3 }); spawn('berry', 3.4, -6.9, 4.08); spawn('orange', 10.4, -6.6, 4.08);
  spawn('duck', 3.6, -4.6, 4.08); spawn('candy', 7, -4.7, 4.08); spawn('candy', 7, -5.3, 4.08);
  for (let i = 0; i < 8; i++) { const z = 4.1 - i * 0.85; spawn(i % 2 ? 'coin' : 'candy', 7 + Math.sin(i) * 0.22, z, (4.7 - z) / 8.2 * 4 + 0.08, { yaw: i * 0.4 }); }
  spawn('wish', -13.8, 3.1, 0, { wish: 0, need: 12, volume: 0.14, yaw: 0.2 });
  spawn('wish', 7.4, -9.25, 4.09, { wish: 1, need: 24, volume: 0.42, yaw: 0 });
  spawn('wish', -12.15, -9.15, 0, { wish: 2, need: 36, volume: 1.1, yaw: -0.3 });
  spawn('cat', -11.2, -8.0, 0, { hazard: true, need: 55, home: [-11.2, -7.8], yaw: PI * 0.35 });
  const mouse = items.find((it) => it.p.id === 'car' && it.z > 0);
  if (mouse) { mouse.moving = true; mouse.home = [mouse.x, mouse.z]; }

  if (mode === 'encore') {
    const placed = [];
    for (const [id, x, z, yaw] of ENCORE_PIECES) placed.push(spawn(id, x, z, 0, { yaw, big: true }));
    // Nothing small sits inside a piece of furniture.
    items = items.filter((it) => it.big || it.base || it.wish !== undefined || it.hazard || it.moving
      || !placed.some((f) => Math.hypot(it.x - f.x, it.z - f.z) < f.p.radius * 0.95 + it.p.radius * 0.55));
  }
  return items;
}

/**
 * A spot for something knocked off the ball: inside the walls, not inside the bookshelf,
 * cabinet or table legs, and not under the table when the ball has grown too tall to reach it.
 */
export function landingOK(x, z, rad, onTable, ballR) {
  if (x < -16.3 || x > 16.3 || z < -14.3 || z > 14.3) return false;
  for (const o of obstacles) {
    if (o.lo > 0.25) continue;
    if (Math.abs(x - o.x) < o.w / 2 + rad * 0.8 && Math.abs(z - o.z) < o.d / 2 + rad * 0.8) return false;
  }
  if (!onTable && inTable(x, z) && ballR * 2 > 3.3) return false;
  return true;
}
