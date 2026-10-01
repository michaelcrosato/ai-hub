import { FLOOR_HEIGHT, GROUND_Y } from './config.js';
import { degrees } from './math.js';
import { Random } from './random.js';

/** The boxes, props and lamps of one building. Every surface is an axis-aligned (or ramp-tilted) box. */
export function createBuildingGeometry(city, b) {
  const boxes = [];
  const objects = [];
  const lights = [];
  const [cx, , cz] = b.center;
  const w = b.width;
  const d = b.depth;
  let serial = 0;
  const box = (name, position, size, material, shell = false, solid = true, angles = [0, 0, 0], glass = false) => {
    if (size.some((s) => s <= 0.001)) return;
    boxes.push({ id: `${b.id}:${name}:${serial++}`, position, size, material, shell, solid, angles, glass });
  };
  const wallMat = `wall${b.tint}`;
  // Openings are cut from solid wall geometry. A dark texture is never an entry.
  function wall(name, axis, fixed, start, end, y, openings, shell, material) {
    const slab = (a, c, lo, hi, m = material, isGlass = false) => {
      const pos = axis === 'x' ? [(a + c) / 2, y + (lo + hi) / 2, fixed] : [fixed, y + (lo + hi) / 2, (a + c) / 2];
      const size = axis === 'x' ? [c - a, hi - lo, 0.28] : [0.28, hi - lo, c - a];
      box(name, pos, size, m, shell, true, [0, 0, 0], isGlass);
    };
    let cursor = start;
    for (const o of [...openings].sort((a, c) => a.at - c.at)) {
      const a = Math.max(start, o.at - o.width / 2);
      const c = Math.min(end, o.at + o.width / 2);
      slab(cursor, a, 0, FLOOR_HEIGHT - 0.18);
      slab(a, c, 0, o.bottom);
      slab(a, c, o.top, FLOOR_HEIGHT - 0.18);
      if (o.glass) {
        slab(a, c, o.bottom, o.top, 'glass', true);
        const p = axis === 'x' ? [o.at, y + o.bottom - 0.035, fixed] : [fixed, y + o.bottom - 0.035, o.at];
        box('sill', p, axis === 'x' ? [o.width + 0.18, 0.1, 0.43] : [0.43, 0.1, o.width + 0.18], 'trim', shell);
        const p2 = axis === 'x' ? [o.at, y + (o.bottom + o.top) / 2, fixed] : [fixed, y + (o.bottom + o.top) / 2, o.at];
        box('window-bar', p2, axis === 'x' ? [0.045, o.top - o.bottom, 0.31] : [0.31, o.top - o.bottom, 0.045], 'trim', shell, false);
      }
      cursor = c;
    }
    slab(cursor, end, 0, FLOOR_HEIGHT - 0.18);
  }
  for (let f = 0; f < b.floors; f++) {
    const y = GROUND_Y + f * FLOOR_HEIGHT;
    const front = cz - d / 2;
    const rear = cz + d / 2;
    const frontOpen = [
      { at: cx - w / 2 + 2.6, width: 1.8, bottom: 1.1, top: 2.6, glass: true },
      { at: cx, width: 2, bottom: f === 0 ? 0 : 1.1, top: 2.6, glass: f !== 0 },
      { at: cx + w / 2 - 2.2, width: 1.6, bottom: 1.1, top: 2.6, glass: true },
    ];
    wall('front', 'x', front, cx - w / 2, cx + w / 2, y, frontOpen, true, wallMat);
    wall('rear', 'x', rear, cx - w / 2, cx + w / 2, y, [
      { at: cx - w / 2 + 2.6, width: 1.8, bottom: 1.1, top: 2.6, glass: true },
      { at: cx, width: 1.8, bottom: 1.1, top: 2.6, glass: true },
      { at: b.stairX, width: 1.7, bottom: 1.1, top: 2.6, glass: true },
    ], true, wallMat);
    for (const side of [-1, 1])
      wall('side', 'z', cx + (side * w) / 2, front, rear, y, [-1, 1].map((h) => ({ at: cz + (h * (d / 2 - 3)) / 2, width: 2.2, bottom: 1.1, top: 2.6, glass: true })), true, wallMat);
    // A slab hole reserves the whole stair run. The next floor cannot block the stair.
    const right = cx + w / 2 - 3.25;
    box('slab', [(cx - w / 2 + right) / 2, y - 0.1, cz], [right - (cx - w / 2), 0.2, d], 'floor', false);
    for (const sign of [-1, 1]) box('stair-landing', [cx + w / 2 - 1.625, y - 0.1, cz + sign * (d / 2 - 1)], [3.25, 0.2, 2], 'floor', false);
    box('band', [cx, y + FLOOR_HEIGHT - 0.12, front - 0.02], [w + 0.16, 0.22, 0.38], 'trim', true);
    box('band', [cx, y + FLOOR_HEIGHT - 0.12, rear + 0.02], [w + 0.16, 0.22, 0.38], 'trim', true);
    for (const side of [-1, 1]) {
      const rooms = b.rooms.filter((r) => r.floor === f && r.side === side);
      wall('hall-wall', 'z', cx + side * 1.65, front + 3, rear - 3, y, rooms.map((r) => ({ at: r.center[2], width: 1.65, bottom: 0, top: 2.6 })), false, 'concrete');
      const min = side === -1 ? cx - w / 2 : cx + 1.65;
      const max = side === -1 ? cx - 1.65 : cx + w / 2 - 3.3;
      for (const zz of [front + 3, cz, rear - 3]) box('partition', [(min + max) / 2, y + (FLOOR_HEIGHT - 0.18) / 2, zz], [max - min, FLOOR_HEIGHT - 0.18, 0.18], 'concrete');
    }
    box('stair-wall', [cx + w / 2 - 3.3, y + (FLOOR_HEIGHT - 0.18) / 2, cz], [0.18, FLOOR_HEIGHT - 0.18, d - 6], 'concrete');
    // Railings keep the top floor stair opening legible.
    if (f === b.floors - 1) box('stair-rail', [cx + w / 2 - 3.1, y + 0.6, cz], [0.09, 1.2, d - 6], 'metal');
    if (f < b.floors - 1) {
      const run = b.stairEnd - b.stairStart;
      const angle = -degrees(Math.atan2(FLOOR_HEIGHT, run));
      box('ramp-collision', [b.stairX, y + FLOOR_HEIGHT / 2 - 0.11, cz], [2.7, 0.22, Math.hypot(run, FLOOR_HEIGHT)], 'concrete', false, true, [angle, 0, 0]);
      const steps = 22;
      for (let i = 0; i < steps; i++) {
        const top = (FLOOR_HEIGHT * (i + 1)) / steps;
        box('step', [b.stairX, y + top - 0.055, b.stairStart + ((i + 0.5) * run) / steps], [2.7, 0.11, run / steps + 0.012], 'trim', false, false);
      }
    }
    lights.push({ id: `${b.id}:light:${f}`, position: [cx, y + FLOOR_HEIGHT - 0.45, cz], warm: f % 2 === 0, intensity: 1.8, range: 11 });
    box('hall-lamp', [cx, y + FLOOR_HEIGHT - 0.28, cz], [0.25, 0.06, 1.8], 'emissive', false, false);
    for (const room of b.rooms.filter((r) => r.floor === f)) {
      const r = new Random(`${city.seed}:${room.id}:props`);
      const [x, , z] = room.center;
      // Keep the room centre and the door approach free for navigation.
      objects.push({ id: `${room.id}:cover`, kind: 'cover', position: [x - room.side * 0.1, y + 0.85, z - room.half * 1.6], size: [Math.min(2, room.size[0] - 0.7), 1.7, 0.65], yaw: 0, room: room.id, node: room.node });
      objects.push({ id: `${room.id}:table`, kind: 'table', position: [x + room.side * 0.8, y + 0.4, z + room.half * 1.1], size: [1.4, 0.8, 0.9], yaw: 0, room: room.id, node: room.node });
      const lockerX = x - room.side * (room.size[0] / 2 - 0.72);
      const lockerZ = z + room.half * (room.size[2] / 2 - 0.78);
      objects.push({ id: `${room.id}:locker`, kind: 'locker', position: [lockerX, y, lockerZ], size: [1.15, 2.15, 1], yaw: room.half === 1 ? 0 : 180, room: room.id, node: room.node });
      objects.push({ id: `${room.id}:prop`, kind: 'prop', position: [x + room.side * 0.25, y + 0.34, z - room.half * 0.7], size: [0.26, 0.65, 0.26], yaw: r.range(-25, 25), room: room.id, node: room.node });
      if (r.chance(0.28)) objects.push({ id: `${room.id}:radio`, kind: 'radio', position: [x + room.side * 0.35, y + 0.92, z + room.half * 1.1], size: [0.38, 0.24, 0.18], yaw: 0, room: room.id, node: room.node });
      if (r.chance(0.6)) {
        lights.push({ id: `${room.id}:light`, position: [x, y + FLOOR_HEIGHT - 0.48, z], room: room.id, warm: room.kind !== 'office', intensity: r.range(1.3, 2.1), range: 7 });
        box('room-lamp', [x, y + FLOOR_HEIGHT - 0.25, z], [0.5, 0.07, 0.5], 'emissive', false, false);
      }
      if (room.kind === 'apartment') box('rug', [x, y + 0.014, z], [Math.max(1, room.size[0] - 1), 0.018, room.size[2] - 1], 'carpet', false, false);
    }
  }
  box('roof', [cx, GROUND_Y + b.floors * FLOOR_HEIGHT - 0.05, cz], [w + 0.24, 0.2, d + 0.24], 'trim', true);
  box('roof-plant', [cx - w * 0.2, GROUND_Y + b.floors * FLOOR_HEIGHT + 0.65, cz + 2], [3, 1.2, 2.2], 'metal', true);
  return { boxes, objects, lights };
}

export function roomSurface(room) {
  return room?.kind === 'apartment' ? 'carpet' : room?.kind === 'workshop' ? 'metal' : room ? 'tile' : 'asphalt';
}
