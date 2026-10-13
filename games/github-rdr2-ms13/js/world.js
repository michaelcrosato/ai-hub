// RED HARROW — biome map generation + deterministic landmarks (engine-assisted).
export const TILE = 16;
export const MAP_W = 48;
export const MAP_H = 30;

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const BIOMES = {
  snow: { floor: 'snow', wallTop: '#9aa3b8', wallSide: '#565e74', water: 0.02, trees: 0.03, sky: ['#7f95b8', '#cfd9e8'] },
  grass: { floor: 'grass', wallTop: '#6a7a4a', wallSide: '#3f4a2a', water: 0.04, trees: 0.05, sky: ['#5c94fc', '#cfe8ff'] },
  bayou: { floor: 'bayou', wallTop: '#4a6a3a', wallSide: '#2a4022', water: 0.12, trees: 0.07, sky: ['#6a8a5a', '#d8e8c8'] },
  city: { floor: 'street', wallTop: '#8a7a68', wallSide: '#4a4038', water: 0.0, trees: 0.0, sky: ['#3a4a6a', '#9ab0d0'] },
  desert: { floor: 'dirt', wallTop: '#a88a5a', wallSide: '#5f4a2e', water: 0.01, trees: 0.01, sky: ['#e8a85a', '#f8e0b0'] },
  jungle: { floor: 'jungle', wallTop: '#3f7a3a', wallSide: '#1f4020', water: 0.06, trees: 0.1, sky: ['#4a9a6a', '#d0f0c0'] },
  forest: { floor: 'grass', wallTop: '#5a6a3a', wallSide: '#2f3a1e', water: 0.03, trees: 0.09, sky: ['#5c8af0', '#c0e0ff'] },
};

const ANCHORS = { CAMP: [0.5, 0.5], RANCH: [0.5, 0.5], FROSTHOLD: [0.5, 0.5], OXBOW: [0.5, 0.5] };

export function landmarkPos(place, seed = 0) {
  if (ANCHORS[place]) {
    const [fx, fy] = ANCHORS[place];
    return { x: Math.floor(fx * MAP_W * TILE), y: Math.floor(fy * MAP_H * TILE) };
  }
  const h = hashStr(place + ':' + seed);
  const gx = 2 + (h % (MAP_W - 4));
  const gy = 2 + ((h >> 8) % (MAP_H - 4));
  return { x: gx * TILE + 8, y: gy * TILE + 8 };
}

export function floorFor(E, biome) {
  const B = BIOMES[biome] || BIOMES.grass;
  return (x, y, tag) => {
    if (tag === 'water') return E.tex.water(x, y);
    switch (B.floor) {
      case 'snow': return E.tex.checker(x, y, { a: '#dfe8f2', b: '#d2dce9', size: 8 });
      case 'grass': return E.tex.grass(x, y, {});
      case 'bayou': return E.tex.grass(x, y, { base: '#4a7a3a', dark: '#2f5525', light: '#6a9a50' });
      case 'street': return E.tex.checker(x, y, { a: '#8a8078', b: '#7e7472', size: 8 });
      case 'dirt': return E.tex.dirt(x, y, {});
      case 'jungle': return E.tex.grass(x, y, { base: '#2f7a35', dark: '#1d5523', light: '#4a9a48' });
      default: return E.tex.grass(x, y, {});
    }
  };
}

// Builds rows + TileMap. rng = E.rng(seed).
export function buildMap(E, biome, seed) {
  const B = BIOMES[biome] || BIOMES.grass;
  const rng = E.rng(seed);
  const rows = [];
  for (let y = 0; y < MAP_H; y++) {
    let row = '';
    for (let x = 0; x < MAP_W; x++) {
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) { row += '#'; continue; }
      const r = rng();
      if (r < B.water) { row += '~'; continue; }
      if (r < B.water + B.trees) { row += '#'; continue; }
      row += '.';
    }
    rows.push(row);
  }
  // Clear the camp plaza + a few landmark clearings so objectives are reachable.
  const clear = (cx, cy, rad) => {
    for (let y = cy - rad; y <= cy + rad; y++) {
      if (y < 1 || y >= MAP_H - 1) continue;
      const arr = rows[y].split('');
      for (let x = cx - rad; x <= cx + rad; x++) {
        if (x < 1 || x >= MAP_W - 1) continue;
        arr[x] = '.';
      }
      rows[y] = arr.join('');
    }
  };
  clear(Math.floor(MAP_W / 2), Math.floor(MAP_H / 2), 3);
  for (const p of ['TRACKS', 'BANK', 'SALOON', 'JAIL', 'STATION', 'CHAPEL', 'DOCKS', 'MANOR', 'FORT', 'BRIDGE', 'RIVER', 'WOODS', 'HILL', 'MINE', 'CAVES']) {
    const lp = landmarkPos(p, seed);
    clear(Math.floor(lp.x / TILE), Math.floor(lp.y / TILE), 2);
  }
  const map = new E.TileMap({
    rows,
    legend: { '#': 1, '~': { floor: 'water', block: true } },
    types: { 1: { h: 26, top: B.wallTop, side: B.wallSide, cut: true } },
    floorTex: floorFor(E, biome),
  });
  return { map, flow: new E.FlowField(map), sky: B.sky };
}

export function walkableNear(map, x, y, spread = 48) {
  for (let i = 0; i < 24; i++) {
    const px = x + (Math.random() - 0.5) * 2 * spread;
    const py = y + (Math.random() - 0.5) * 2 * spread;
    const [cx, cy] = [Math.floor(px / TILE), Math.floor(py / TILE)];
    if (map.walkable(cx, cy)) return { x: px, y: py };
  }
  return { x, y };
}
