import { copy, key, clamp, distance } from './model.js';
const themedTerrain = {
  town: 'C',
  monastery: 'C',
  cathedral: 'C',
  library: 'K',
  machine: 'C',
  grass: 'H',
  forest: 'H',
  highland: 'L',
  windmill: 'H',
  snow: 'B',
  desert: 'S',
  swamp: 'Q',
  falls: 'H',
  ruin: 'C',
  gate: 'C',
  gallows: 'P',
  rooftop: 'G',
  mine: 'L',
  crypt: 'C',
  sluice: 'C',
  void: 'C',
  airship: 'D',
  volcano: 'L',
};
export function buildMap(db, def) {
  const source = db.map.get(def.map);
  let map;
  if (source && source.tiles.length) {
    map = copy(source);
    map.originalGrid = true;
    map.staging = 'Source height/terrain grid; deployment and decorative masonry adapted.';
  } else {
    const width = ['falls', 'sluice', 'airship'].includes(def.theme) ? 14 : 12,
      height = 12;
    map = {
      id: def.id,
      width,
      height,
      tiles: [],
      spawns: [],
      enemySpawns: [],
      treasures: [],
      exits: [],
      originalGrid: false,
      staging: 'Authored battlefield reconstruction; no exact PSX tile layout is claimed.',
    };
    const salt = [...def.id].reduce((n, c) => n + c.charCodeAt(0), 0);
    for (let z = 0; z < height; z++)
      for (let x = 0; x < width; x++) {
        let h = 0,
          t = themedTerrain[def.theme] || 'P',
          blocked = false;
        if (['grass', 'forest', 'highland', 'windmill', 'desert', 'swamp'].includes(def.theme)) {
          h = Math.max(0, Math.floor((Math.sin(x * 0.55 + salt) * 1.6 + Math.cos(z * 0.5) * 1.3 + 2) / 1.8));
          if (x === 5 || x === 6) t = 'P';
        }
        if (['town', 'machine', 'rooftop', 'gallows'].includes(def.theme)) {
          if ((x < 3 || x > width - 4) && z > 2 && z < 8) {
            h = 3 + (salt % 2);
            t = 'G';
          }
          if ((x === 3 || x === width - 4) && z === 6) {
            h = 2;
            t = 'D';
          }
          if ((x === 3 || x === width - 4) && z === 7) {
            h = 1;
            t = 'D';
          }
        }
        if (['monastery', 'cathedral', 'library', 'crypt'].includes(def.theme)) {
          if (z < 3) {
            h = 2;
            t = 'C';
          }
          if (z === 3) {
            h = 1;
            t = 'C';
          }
          if (def.theme === 'library' && [3, 8].includes(x) && z > 3 && z < 8) {
            h = 3;
            t = 'K';
          }
        }
        if (def.theme === 'gate') {
          if (z === 4) {
            h = x < 4 || x > 7 ? 5 : 0;
            t = 'C';
          }
          if (z === 5 && (x === 3 || x === 8)) h = 2;
          if (z === 6 && (x === 3 || x === 8)) h = 1;
        }
        if (def.theme === 'snow') {
          h = z < 4 ? 3 : z < 6 ? 1 : 0;
          if (x > 3 && x < 8 && z < 5) h = 2;
          t = 'B';
        }
        if (def.theme === 'ruin') {
          h = z < 4 ? 2 : 0;
          if ((x === 2 || x === 9) && z === 2) {
            h = 5;
            t = 'C';
          }
        }
        if (def.theme === 'falls' || def.theme === 'sluice') {
          h = x < 4 ? 2 : x > 9 ? 3 : 0;
          if (x >= 4 && x <= 9) t = 'W';
          if (z === 5 || z === 6) {
            h = 3;
            t = 'K';
          }
          if ((x === 3 || x === 10) && z >= 5 && z <= 8) h = 2;
          if (def.theme === 'sluice' && z < 4) {
            h = 4;
            t = 'C';
          }
          if (z === 4 && (x === 2 || x === 11)) h = 3;
        }
        if (def.theme === 'swamp' && (x + z) % 4 !== 0) t = 'Q';
        if (def.theme === 'mine') {
          h = Math.floor(((x + z + salt) % 7) / 3);
          if (x === 5 || x === 6) h = 0;
        }
        if (def.theme === 'void') {
          h = x < 3 || x > 8 ? 2 : 0;
          if (z < 3) h = 2;
        }
        if (def.theme === 'airship') {
          h = z < 4 ? 2 : z < 7 ? 1 : 0;
          if (x < 2 || x > width - 3) {
            h = 3;
            t = 'K';
          }
        }
        if (def.theme === 'volcano') {
          h = clamp(5 - Math.floor((Math.abs(x - 6) + Math.abs(z - 5)) / 2), 0, 5);
          if ((x + z) % 7 === 0 && z > 2) t = 'A';
        }
        map.tiles.push({ x, z, h, t, blocked });
      }
  }
  map.theme = def.theme;
  map.name = def.name;
  map.tiles = map.tiles.filter((t) => Number.isFinite(t.h)).map((t) => ({ ...t, blocked: !!t.blocked }));
  map.width = Math.max(...map.tiles.map((t) => t.x)) + 1;
  map.height = Math.max(...map.tiles.map((t) => t.z)) + 1;
  // Source deployment shapes do not establish absolute board origins.
  map.spawns = map.tiles
    .filter((t) => !t.blocked && !['A', 'Q', 'W'].includes(t.t))
    .sort((a, b) => (b.z - a.z) * 4 + Math.abs(a.x - map.width / 2) - Math.abs(b.x - map.width / 2))
    .slice(0, 15)
    .map((t) => [t.x, t.z]);
  map.exitDiscovered = false;
  map.opened = [];
  map.switches = [];
  if (def.gate) {
    map.gateClosed = true;
    map.switches = [{ x: Math.floor(map.width / 2) - 2, z: 3, on: false }];
    for (const t of map.tiles) if (t.z === 4 && t.x >= 4 && t.x <= 7) t.gate = true;
  }
  if (def.objective === 'switches')
    map.switches = [
      { x: 2, z: 2, on: false },
      { x: map.width - 3, z: 2, on: false },
    ];
  if (def.dungeon !== undefined) {
    const candidates = map.exits?.length
      ? map.exits
      : map.tiles
          .filter((t) => !t.blocked && t.z < map.height / 2)
          .filter((_, i) => i % 13 === 0)
          .slice(0, 4)
          .map((t) => [t.x, t.z]);
    map.exit = candidates[(def.dungeon * 3) % Math.max(1, candidates.length)] || [map.width - 2, 1];
    if (!map.treasures.length)
      map.treasures = [
        { x: 1, z: 1, common: 'Phoenix Down', rare: 'Elixir' },
        { x: map.width - 2, z: 2, common: 'Phoenix Down', rare: 'Ragnarok' },
      ];
  }
  if (def.pillarTreasure) {
    for (const p of [
      { x: 2, z: 2 },
      { x: 9, z: 2 },
    ]) {
      const t = map.tiles.find((t) => t.x === p.x && t.z === p.z);
      if (t) t.h = 7;
    }
    map.treasures.push(
      { x: 2, z: 2, common: 'Javelin', rare: 'Javelin (rare)' },
      { x: 9, z: 2, common: 'Escutcheon', rare: 'Escutcheon (rare)' },
    );
  }
  if (def.hiddenReward) {
    const t = map.tiles.filter((t) => !t.blocked).sort((a, b) => b.h - a.h)[0];
    map.treasures.push({ x: t.x, z: t.z, common: def.hiddenReward, rare: def.hiddenReward });
  }
  return map;
}
export function tileAt(map, x, z) {
  return map.tiles.find((t) => t.x === x && t.z === z);
}
export function unitAt(b, x, z, includeDead = true) {
  return b.units.find((u) => !u.removed && !u.airborne && u.x === x && u.z === z && (includeDead || u.hp > 0));
}
export function reachable(db, b, u) {
  const tiles = new Map(b.grid.tiles.map((t) => [key(t.x, t.z), t]));
  const start = tiles.get(key(u.x, u.z));
  if (!start) return new Map();
  const movement = u.movement || '',
    teleport = movement.includes('Teleport'),
    fly =
      movement === 'Fly' ||
      (u.status.Float && u.job === 'Lucavi') ||
      /Hyudra|Hydra|Tiamat|Black Chocobo|Plague|Ahriman|Flotiball|Juravis|Cocatoris|Steel Hawk/.test(u.job),
    ignore = fly || teleport || movement === 'Ignore Height';
  const move = Math.floor(u.move),
    found = new Map([[key(u.x, u.z), { ...start, cost: 0, path: [] }]]);
  if (u.status["Don't Move"] || u.status.Stop || u.status.Sleep || u.status.Petrify || u.moved) return found;
  if (fly || teleport) {
    for (const t of tiles.values())
      if (!t.blocked && !unitAt(b, t.x, t.z) && distance(u, t) <= move + (teleport ? 3 : 0))
        found.set(key(t.x, t.z), {
          ...t,
          cost: distance(u, t),
          path: [{ x: t.x, z: t.z }],
          chance: teleport ? clamp(100 - (distance(u, t) - move) * 10, 0, 100) : 100,
        });
    return found;
  }
  const queue = [found.get(key(u.x, u.z))];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift();
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = key(cur.x + dx, cur.z + dz),
        t = tiles.get(k);
      if (!t || t.blocked || (t.gate && b.grid.gateClosed)) continue;
      const occupying = unitAt(b, t.x, t.z);
      if (occupying && occupying.id !== u.id && (occupying.team !== u.team || occupying.hp <= 0)) continue;
      let jump = u.jump;
      if (b.units.some((v) => v.team === u.team && v.hp > 0 && ['Worker 8', 'Reis'].includes(v.name) && distance(v, t) <= 1))
        jump += 3;
      if (!ignore && Math.abs(t.h - cur.h) > jump) continue;
      if (t.t === 'A' && !['Move on Lava', 'Float', 'Fly'].includes(movement) && !u.status.Float) continue;
      const cost =
        cur.cost +
        ((t.t === 'W' || t.t === 'Q') &&
        !['Walk on Water', 'Move in Water', 'Any Ground', 'Float'].includes(movement) &&
        !u.status.Float
          ? 2
          : 1);
      if (cost > move || (found.has(k) && found.get(k).cost <= cost)) continue;
      const next = { ...t, cost, path: [...cur.path, { x: t.x, z: t.z }] };
      found.set(k, next);
      queue.push(next);
    }
  }
  for (const [k, t] of found) if (unitAt(b, t.x, t.z) && k !== key(u.x, u.z)) found.delete(k);
  return found;
}
