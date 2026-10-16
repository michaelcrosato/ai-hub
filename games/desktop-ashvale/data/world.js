// ASHVALE world infrastructure: the land (nine screens, one cave each), dungeon loading, gate parsing, and a solver that
// proves each dungeon can be finished with what the player has by then. Used by the game and by the tests.
(function (A) {
  const CELL = 16, RW = 12, RH = 8;
  const wcx = t => t * CELL + 8;                   // a tile index -> the world position of its centre
  A.wcx = wcx;
  A.START = [16, 12];                              // the hero's first tile: screen (1,1), tile (4,4)
  A.SLIMES = [[0, 0, 3, 2], [0, 0, 8, 5], [2, 1, 4, 5], [2, 1, 9, 6], [1, 2, 6, 2], [1, 2, 3, 6]];   // [screen x, screen y, tile x, tile y]
  A.HEART_FIELD = [0, 1, 6, 3];

  // the tile for a land spot given as [screen x, screen y, tile x, tile y]
  const gc = ([sx, sy, tx, ty]) => [sx * RW + tx, sy * RH + ty];
  A.landCell = gc;

  // one cave per screen, at local (9, 2); the cell below it (9, 3) is its doorstep
  A.caveTile = id => { const [sx, sy] = A.caveScreen(id); return [sx * RW + 9, sy * RH + 2]; };
  A.caveDoorstep = id => { const [sx, sy] = A.caveScreen(id); return [sx * RW + 9, sy * RH + 3]; };

  // the land's rows; trees are scattered off the paths, never on the start, a cave, a doorstep or a monster's spot
  A.landRows = function () {
    const W = 3 * RW, H = 3 * RH, rows = [];
    const keep = new Set([A.START, ...Object.keys(A.DUNGEONS).flatMap(id => [A.caveTile(+id), A.caveDoorstep(+id)]),
      gc(A.HEART_FIELD), ...A.SLIMES.map(gc)].map(p => p.join(',')));
    const caves = new Set(Object.keys(A.DUNGEONS).map(id => A.caveTile(+id).join(',')));
    for (let gy = 0; gy < H; gy++) {
      let row = '';
      for (let gx = 0; gx < W; gx++) {
        const sx = Math.floor(gx / RW), sy = Math.floor(gy / RH), x = gx % RW, y = gy % RH;
        const edge = x === 0 || x === RW - 1 || y === 0 || y === RH - 1;
        let ch = '.';
        if (edge) {
          const open = (y === 0 && sy > 0 && (x === 5 || x === 6)) || (y === RH - 1 && sy < 2 && (x === 5 || x === 6)) ||
                       (x === 0 && sx > 0 && (y === 3 || y === 4)) || (x === RW - 1 && sx < 2 && (y === 3 || y === 4));
          ch = open ? '.' : '#';
        } else if (caves.has([gx, gy].join(','))) ch = 'C';
        else if (keep.has([gx, gy].join(','))) ch = '.';
        else if (!((x >= 5 && x <= 6) || (y >= 3 && y <= 4)) && ((gx * 7 + gy * 13) % 17 === 0)) ch = 'T';
        row += ch;
      }
      rows.push(row);
    }
    return rows;
  };

  // the cave a dungeon's entrance is on, and where the hero stands when they walk back out
  A.caveOf = rows => { const m = {}; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'C') m[x + ',' + y] = true; })); return m; };

  // parse a dungeon's rows: its gates (adjacent cells with one letter are one gate), spikes and exits
  A.parse = function (rows) {
    const H = rows.length, W = rows[0].length, seen = new Set(), gates = [], spikes = [];
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '#' : rows[y][x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if (c === 'S') spikes.push([x, y]);
      if (!A.GATES[c] || seen.has(x + ',' + y)) continue;
      const cells = [], stack = [[x, y]]; seen.add(x + ',' + y);
      while (stack.length) {
        const [cx0, cy0] = stack.pop(); cells.push([cx0, cy0]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx0 + dx, ny = cy0 + dy;
          if (at(nx, ny) === c && !seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); stack.push([nx, ny]); }
        }
      }
      const g = A.GATES[c];
      gates.push({ id: c + gates.length, letter: c, cells, need: g.need, active: !!g.active, name: g.name });
    }
    return { gates, spikes };
  };

  // a dungeon as the engine's TileMap wants it, with its pickups and monsters in world units
  A.loadDungeon = function (id) {
    const d = A.DUNGEONS[id];
    const rows = A.build(d);
    const parsed = A.parse(rows);
    const w = t => [wcx(t[0]), wcx(t[1])];
    return {
      id, name: d.name, rows, gates: parsed.gates, spikes: parsed.spikes, needs: d.needs || [], bossHint: d.bossHint,
      start: w(A.at(...d.start.length === 2 ? [0, 0, ...d.start] : d.start)),
      pickups: d.pickups.map(p => ({ key: p.key, kind: p.kind, item: p.item, amount: p.amount, t: p.t, x: wcx(p.t[0]), y: wcx(p.t[1]) })),
      enemies: [...(d.enemies || []), ...(d.extra || [])].map(e => ({ id: e.id, kind: e.kind, dir: e.dir, heads: e.heads, x: wcx(e.t[0]), y: wcx(e.t[1]), t: e.t })),
      boss: d.boss ? { id: d.boss.id, kind: d.boss.kind, heads: d.boss.heads, x: wcx(d.boss.t[0]), y: wcx(d.boss.t[1]), t: d.boss.t } : null
    };
  };

  // every item a dungeon hands out (its item pickups)
  A.itemsOf = id => A.DUNGEONS[id].pickups.filter(p => p.kind === 'item').map(p => p.item);

  // solve(id, carried): can the boss be reached, and is everything it needs owned, given what was carried from earlier
  // dungeons? Walks the rooms breadth-first, collecting pickups and opening any gate the player can open, until nothing new opens.
  // Keys and bombs are counted; 'clear' doors are assumed passable (the guards can be beaten); active gates are assumed used.
  A.solve = function (id, carried) {
    const d = A.DUNGEONS[id], rows = A.build(d), { gates } = A.parse(rows);
    const H = rows.length, W = rows[0].length;
    const owned = new Set(carried || []);
    const pickups = new Map(d.pickups.map(p => [p.t.join(','), p]));
    const collected = new Set(), opened = new Set();
    let keys = 0, bombs = 0, arrows = 0;
    const has = item => owned.has(item) || (item === 'bomb' && bombs > 0);
    const cellGate = new Map();
    for (const g of gates) for (const [x, y] of g.cells) cellGate.set(x + ',' + y, g);
    const start = A.at(...(d.start.length === 2 ? [0, 0, ...d.start] : d.start));
    const bossT = d.boss ? d.boss.t.join(',') : null;
    let bossReached = false;
    for (let pass = 0; pass < 100; pass++) {
      const seen = new Set([start.join(',')]), queue = [start];
      let changed = false;
      while (queue.length) {
        const [x, y] = queue.shift(), k = x + ',' + y;
        if (k === bossT) bossReached = true;
        if (pickups.has(k) && !collected.has(k)) {
          collected.add(k); const p = pickups.get(k);
          if (p.kind === 'key') keys++;
          else if (p.kind === 'bombs') bombs += p.amount;
          else if (p.kind === 'arrows') arrows += p.amount;
          else if (p.kind === 'item') owned.add(p.item);
          changed = true;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, nk = nx + ',' + ny;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(nk)) continue;
          const c = rows[ny][nx];
          if (c === '#' || c === 'X') continue;
          const g = cellGate.get(nk);
          if (g && !opened.has(g.id)) {                       // a closed gate: open it if we can, then walk through
            const magic = owned.has('magicKey');
            const can = g.need === 'key' ? (keys > 0 || magic) : g.need === 'bomb' ? bombs > 0 :
              g.need === 'clear' ? true : has(g.need);
            if (!can) continue;
            opened.add(g.id); changed = true;
            if (g.need === 'key' && !magic) keys--;
            // the whole gate is open now: its cells are part of the room beyond
          }
          seen.add(nk); queue.push([nx, ny]);
        }
      }
      if (!changed) break;
    }
    const missing = (d.needs || []).filter(n => !has(n));
    return { ok: bossReached && missing.length === 0, bossReached, missing, keys, bombs, arrows };
  };
})(ASH);
