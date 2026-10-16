// ASHVALE data infrastructure: a dungeon is a graph of rooms. Each room is a 12 x 8 tile screen with a 10 x 6 floor; links
// between rooms are corridors that are open ('.') or hold a gate (a letter, see GATES). The builder turns a spec into an
// ASCII map that the engine's TileMap reads. Enemies, pickups and bosses are placed in tile coordinates with at().
var ASH = globalThis.ASH || {};
(function (A) {
  const RW = 12, RH = 8;                       // one screen, in tiles

  // A gate letter in a map is a door that needs something to open it. Adjacent cells with the same letter are one gate.
  // need: the item or resource that opens it. active: opened by using the item near it, not by walking up with it.
  A.GATES = {
    D: { need: 'key', name: 'LOCKED DOOR' },
    K: { need: 'bomb', name: 'CRACKED WALL' },
    G: { need: 'raft', name: 'RAFT GATE' },
    W: { need: 'ladder', name: 'WATER' },
    B: { need: 'candle', active: true, name: 'BUSH' },
    H: { need: 'whistle', active: true, name: 'CARVED WALL' },
    M: { need: 'magicKey', name: 'MAGIC DOOR' },
    Q: { need: 'clear', name: 'GUARDED DOOR' }
  };
  // what each gate looks like: a wall type for the engine's TileMap (types are set in game.js)
  A.GATE_TYPE = { D: 4, K: 5, G: 6, W: 7, B: 8, H: 9, M: 10, Q: 11 };
  A.LEGEND = Object.assign({ '#': 1, T: 2, C: { floor: 'cave' }, S: { floor: 'spikes' }, X: { floor: 'exit' } }, A.GATE_TYPE);

  // a tile in room (rx, ry), at local (lx, ly) with lx 1..10 and ly 1..6
  A.at = (rx, ry, lx, ly) => [rx * RW + lx, ry * RH + ly];

  // spec: { cols, rows, skip: [[rx,ry]], links: [[rx,ry,'h'|'v', letter|'.']], exits: [[x,y]], spikes: [[x,y]],
  //         pillars: [[x,y]], put: [[x,y,letter]] }
  // 'h' links (rx,ry) to (rx+1,ry) through x = rx*12+11..12, y = ry*8+3..4.
  // 'v' links (rx,ry) to (rx,ry+1) through x = rx*12+5..6, y = ry*8+7..8.
  A.build = function (spec) {
    const W = spec.cols * RW, H = spec.rows * RH;
    const skip = new Set((spec.skip || []).map(p => p.join(',')));
    const exists = (rx, ry) => rx >= 0 && ry >= 0 && rx < spec.cols && ry < spec.rows && !skip.has(rx + ',' + ry);
    const g = Array.from({ length: H }, () => Array(W).fill('#'));
    for (let ry = 0; ry < spec.rows; ry++) for (let rx = 0; rx < spec.cols; rx++) {
      if (!exists(rx, ry)) continue;
      for (let y = ry * RH + 1; y <= ry * RH + 6; y++) for (let x = rx * RW + 1; x <= rx * RW + 10; x++) g[y][x] = '.';
    }
    for (const [rx, ry, dir, letter = '.'] of spec.links || []) {
      if (!exists(rx, ry)) throw new Error('link from a missing room: ' + rx + ',' + ry);
      const other = dir === 'h' ? exists(rx + 1, ry) : exists(rx, ry + 1);
      if (!other) throw new Error('link to a missing room: ' + rx + ',' + ry + dir);
      const cells = dir === 'h'
        ? [[rx * RW + 11, ry * RH + 3], [rx * RW + 12, ry * RH + 3], [rx * RW + 11, ry * RH + 4], [rx * RW + 12, ry * RH + 4]]
        : [[rx * RW + 5, ry * RH + 7], [rx * RW + 6, ry * RH + 7], [rx * RW + 5, ry * RH + 8], [rx * RW + 6, ry * RH + 8]];
      for (const [x, y] of cells) g[y][x] = letter;
    }
    for (const [x, y] of spec.exits || []) g[y][x] = 'X';
    for (const [x, y] of spec.spikes || []) g[y][x] = 'S';
    for (const [x, y] of spec.pillars || []) g[y][x] = '#';
    for (const [x, y, ch] of spec.put || []) g[y][x] = ch;
    return g.map(r => r.join(''));
  };

  // the screen a dungeon's cave sits on in the land: dungeon 1 is the top-left screen, read left to right, top to bottom
  A.caveScreen = id => [(id - 1) % 3, Math.floor((id - 1) / 3)];
})(ASH);
