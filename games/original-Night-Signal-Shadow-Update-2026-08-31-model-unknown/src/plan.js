import { GENERATOR_VERSION, FLOOR_HEIGHT, GROUND_Y, LOT_SPACING } from './config.js';
import { distance } from './math.js';
import { Random, hashSeed } from './random.js';

export function createCity(seedInput, size = 5) {
  const seed = seedInput.trim().slice(0, 80) || 'NIGHT-001';
  if (![3, 5, 7].includes(size)) throw new Error('City size must be 3, 5, or 7.');
  const rng = new Random(`${seed}:city:v${GENERATOR_VERSION}`);
  const spacing = LOT_SPACING;
  const mid = (size - 1) / 2;
  const nodes = [];
  const portals = [];
  const buildings = [];
  const node = (id, position, extra = {}) => {
    nodes.push({ id, position, kind: 'street', ...extra });
    return id;
  };
  const edge = (a, b, position, kind = 'open', door) => {
    portals.push({ id: `p:${a}:${b}`, a, b, position, kind, walk: kind !== 'window', ...(door ? { door } : {}) });
  };
  const corner = (x, z) => `road:${x}:${z}`;
  const roadPos = (x, z) => [(x - mid - 0.5) * spacing, GROUND_Y, (z - mid - 0.5) * spacing];
  for (let z = 0; z <= size; z++) for (let x = 0; x <= size; x++) node(corner(x, z), roadPos(x, z));
  for (let z = 0; z <= size; z++)
    for (let x = 0; x < size; x++) {
      const p = roadPos(x, z);
      p[0] += spacing / 2;
      const id = node(`road-mid:${x}:${z}`, p);
      edge(corner(x, z), id, p);
      edge(id, corner(x + 1, z), p);
    }
  for (let z = 0; z < size; z++) for (let x = 0; x <= size; x++) edge(corner(x, z), corner(x, z + 1), roadPos(x, z));
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      // Keep the centre square clear. Other empty lots vary with the seed.
      if ((x === mid && z === mid) || (rng.chance(0.09) && !(x === 0 && z === 0))) continue;
      const id = `b:${x}:${z}`;
      const r = new Random(`${seed}:${id}:v${GENERATOR_VERSION}`);
      const cx = (x - mid) * spacing;
      const cz = (z - mid) * spacing;
      const w = r.pick([17, 18, 19]);
      const d = r.pick([19, 20, 21]);
      const floors = r.int(2, 4);
      const kind = r.pick(['apartment', 'office', 'workshop']);
      const b = {
        id, lotX: x, lotZ: z, center: [cx, GROUND_Y, cz], width: w, depth: d, floors, kind, tint: r.int(0, 3),
        rooms: [], doors: [], stairX: cx + w / 2 - 1.7, stairStart: cz - d / 2 + 2, stairEnd: cz + d / 2 - 2,
      };
      const frontId = `road-mid:${x}:${z}`;
      const backId = `road-mid:${x}:${z + 1}`;
      for (let f = 0; f < floors; f++) {
        const fy = GROUND_Y + f * FLOOR_HEIGHT;
        const rowZ = [-d / 2 + 1, -(d / 2 - 3) / 2, 0, (d / 2 - 3) / 2, d / 2 - 1];
        const hall = [];
        rowZ.forEach((zz, i) => hall.push(node(`${id}:f${f}:h${i}`, [cx, fy, cz + zz], { building: id, floor: f, kind: 'hall' })));
        for (let i = 0; i < hall.length - 1; i++) edge(hall[i], hall[i + 1], [cx, fy, cz + rowZ[i]]);
        if (f === 0) {
          const doorId = `${id}:entry`;
          b.doors.push({ id: doorId, position: [cx, fy, cz - d / 2], yaw: 0, width: 2, nodeA: frontId, nodeB: hall[0] });
          edge(frontId, hall[0], [cx, fy, cz - d / 2], 'door', doorId);
        }
        for (const side of [-1, 1])
          for (const half of [-1, 1]) {
            const minX = side === -1 ? cx - w / 2 + 0.35 : cx + 1.65;
            const maxX = side === -1 ? cx - 1.65 : cx + w / 2 - 3.4;
            const z0 = half === -1 ? cz - d / 2 + 3 : cz + 0.1;
            const z1 = half === -1 ? cz - 0.1 : cz + d / 2 - 3;
            const roomId = `${id}:f${f}:r${side}:${half}`;
            const center = [(minX + maxX) / 2, fy, (z0 + z1) / 2];
            const roomNode = node(`${roomId}:node`, center, { building: id, floor: f, room: roomId, kind: 'room' });
            const hallNode = hall[half === -1 ? 1 : 3];
            const doorId = `${roomId}:door`;
            const doorPos = [cx + side * 1.65, fy, center[2]];
            b.rooms.push({ id: roomId, floor: f, side, half, center, size: [maxX - minX, FLOOR_HEIGHT, z1 - z0], node: roomNode, door: doorId, kind });
            b.doors.push({ id: doorId, position: doorPos, yaw: 90, width: 1.65, nodeA: hallNode, nodeB: roomNode });
            edge(hallNode, roomNode, doorPos, 'door', doorId);
            edge(roomNode, half === -1 ? frontId : backId, [side === -1 ? cx - w / 2 : cx + w / 2, fy + 1.5, center[2]], 'window');
          }
        if (f < floors - 1) {
          const a = node(`${id}:f${f}:stair-a`, [b.stairX, fy, b.stairStart - 0.35], { building: id, floor: f, kind: 'stair' });
          const e = node(`${id}:f${f}:stair-b`, [b.stairX, fy + FLOOR_HEIGHT, b.stairEnd + 0.35], { building: id, floor: f + 1, kind: 'stair' });
          edge(hall[0], a, [b.stairX, fy, b.stairStart - 0.35]);
          edge(a, e, [b.stairX, fy + FLOOR_HEIGHT / 2, cz], 'stair');
          edge(e, `${id}:f${f + 1}:h4`, [b.stairX, fy + FLOOR_HEIGHT, b.stairEnd + 0.35]);
        }
      }
      buildings.push(b);
    }
  const selected = rng.shuffle(buildings).slice(0, 3);
  const fuses = selected.map((b, i) => {
    const upper = b.rooms.filter((room) => room.floor > 0);
    const room = rng.pick(upper);
    const [x, y, z] = room.center;
    return { id: `fuse:${i}`, building: b.id, room: room.id, node: room.node, position: [x + room.side * 0.8, y + 0.95, z + room.half * 1.1] };
  });
  const spawn = [0, GROUND_Y, -(size / 2) * spacing];
  const exitNode = `road-mid:${Math.floor(size / 2)}:${size}`;
  const exit = [0, GROUND_Y, (size / 2) * spacing];
  const fingerprint = hashSeed(JSON.stringify({ version: GENERATOR_VERSION, seed, size, buildings, fuses })).toString(16).padStart(8, '0');
  return { version: GENERATOR_VERSION, seed, size, spacing, extent: (size / 2) * spacing + 8, buildings, nodes, portals, fuses, spawn, exit, exitNode, fingerprint };
}

export function buildingAt(city, position) {
  for (const b of city.buildings)
    if (Math.abs(position[0] - b.center[0]) < b.width / 2 && Math.abs(position[2] - b.center[2]) < b.depth / 2 && position[1] < GROUND_Y + b.floors * FLOOR_HEIGHT) return b;
  return undefined;
}

// Node pools by place, built once per city: locateNode runs for every sound.
const indexes = new WeakMap();
function nodeIndex(city) {
  let index = indexes.get(city);
  if (index) return index;
  index = { street: [], floors: new Map(), rooms: new Map() };
  for (const n of city.nodes) {
    if (n.kind === 'street') index.street.push(n);
    else if (n.kind === 'room') index.rooms.set(n.room, n);
    if (n.building && n.kind !== 'room') {
      const key = `${n.building}|${n.floor}`;
      if (!index.floors.has(key)) index.floors.set(key, []);
      index.floors.get(key).push(n);
    }
  }
  indexes.set(city, index);
  return index;
}

export function locateNode(city, position) {
  const index = nodeIndex(city);
  const b = buildingAt(city, position);
  let pool;
  if (b) {
    const floor = Math.max(0, Math.min(b.floors - 1, Math.floor((position[1] - GROUND_Y + 0.2) / FLOOR_HEIGHT)));
    const room = b.rooms.find((r) => r.floor === floor && Math.abs(position[0] - r.center[0]) < r.size[0] / 2 && Math.abs(position[2] - r.center[2]) < r.size[2] / 2);
    const roomNode = room && index.rooms.get(room.id);
    if (roomNode) return roomNode;
    pool = index.floors.get(`${b.id}|${floor}`);
  } else pool = index.street;
  if (!pool || !pool.length) pool = city.nodes;
  let best = pool[0];
  let bestD = distance(best.position, position);
  for (let i = 1; i < pool.length; i++) {
    const d = distance(pool[i].position, position);
    if (d <= bestD) {
      best = pool[i];
      bestD = d;
    }
  }
  return best;
}

export function validateCity(city) {
  const errors = [];
  const ids = new Set();
  for (const n of city.nodes) {
    if (ids.has(n.id)) errors.push(`Duplicate node: ${n.id}`);
    ids.add(n.id);
  }
  const adjacency = new Map();
  for (const p of city.portals) {
    if (!ids.has(p.a) || !ids.has(p.b)) errors.push(`Missing portal endpoint: ${p.id}`);
    if (p.walk) {
      if (!adjacency.has(p.a)) adjacency.set(p.a, []);
      if (!adjacency.has(p.b)) adjacency.set(p.b, []);
      adjacency.get(p.a).push(p.b);
      adjacency.get(p.b).push(p.a);
    }
  }
  const seen = new Set();
  const queue = [city.exitNode];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    if (seen.has(n)) continue;
    seen.add(n);
    for (const x of adjacency.get(n) ?? []) if (!seen.has(x)) queue.push(x);
  }
  for (const n of city.nodes) if (!seen.has(n.id)) errors.push(`No exit route: ${n.id}`);
  if (city.fuses.length !== 3 || new Set(city.fuses.map((f) => f.building)).size !== 3) errors.push('Fuses need three separate buildings.');
  for (const b of city.buildings) {
    if (b.floors < 2) errors.push(`Missing upper floor: ${b.id}`);
    if (!b.doors.some((d) => d.id === `${b.id}:entry`)) errors.push(`Missing entry: ${b.id}`);
  }
  return errors;
}

/**
 * Signal logs: small tape recorders left on room tables, one per building,
 * never in a fuse room. Placement depends only on the seed, so a saved run
 * finds them where they were.
 */
export function placeLogs(city, count = 6) {
  const rng = new Random(`${city.seed}:logs:v1`);
  const fuseRooms = new Set(city.fuses.map((f) => f.room));
  const used = new Set();
  const out = [];
  const order = rng.shuffle(city.buildings);
  // One per building first; a small city with few buildings gets a second room in some.
  for (let pass = 0; pass < 3 && out.length < count; pass++)
    for (const b of order) {
      if (out.length >= count) break;
      const rooms = b.rooms.filter((r) => !fuseRooms.has(r.id) && !used.has(r.id));
      if (!rooms.length) continue;
      const room = rng.pick(rooms);
      used.add(room.id);
      const [x, y, z] = room.center;
      // The table stands at (side * 0.8, half * 1.1) from the room centre, its top 0.8 up.
      out.push({ id: `log:${out.length}`, building: b.id, room: room.id, node: room.node, floor: room.floor, position: [x + room.side * 1.25, y + 0.87, z + room.half * 0.85] });
    }
  return out;
}
