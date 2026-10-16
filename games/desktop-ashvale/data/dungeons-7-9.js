// Dungeons 7 to 9 (data): The Demon (candle and Aquamentus), The Lion (magic key and Gleeok), Death Mountain (red ring,
// silver arrows and Ganon). Dungeon 9 needs the bow from dungeon 6.
(function (A) {
  const at = A.at;
  Object.assign(A.DUNGEONS, {
    7: {
      id: 7, name: 'Ember Keep', cols: 3, rows: 1,
      links: [[0, 0, 'h', 'B'], [1, 0, 'h', 'K']],               // a bush that only the candle burns, then a bomb wall
      exits: [[0, 3], [0, 4]], start: [2, 4],
      pickups: [{ key: 'candle', kind: 'item', item: 'candle', t: at(0, 0, 6, 4) },
                { key: 'compass', kind: 'item', item: 'compass', t: at(1, 0, 6, 2) },
                { key: 'bombs1', kind: 'bombs', amount: 5, t: at(1, 0, 8, 5) }],
      enemies: [{ id: 'z0', kind: 'zol', t: at(0, 0, 8, 5) }, { id: 'g0', kind: 'gibdo', t: at(1, 0, 4, 4) }],
      boss: { id: 'aquamentus', kind: 'aquamentus', t: at(2, 0, 5, 4) }, needs: [],
      bossHint: 'DODGE THE FIRE AND STRIKE THE HEAD'
    },
    8: {
      id: 8, name: 'Lion Maze', cols: 3, rows: 2,
      links: [[0, 0, 'v', '.'], [0, 0, 'h', 'K'], [1, 0, 'h', 'D'], [1, 0, 'v', '.'], [2, 0, 'v', 'M']],
      exits: [[0, 3], [0, 4]], start: [2, 4],
      pickups: [{ key: 'bombs1', kind: 'bombs', amount: 5, t: at(0, 0, 5, 5) },
                { key: 'magicKey', kind: 'item', item: 'magicKey', t: at(1, 0, 6, 3) },
                { key: 'key1', kind: 'key', t: at(2, 0, 6, 3) },
                { key: 'compass', kind: 'item', item: 'compass', t: at(1, 1, 6, 4) },
                { key: 'book', kind: 'item', item: 'book', t: at(0, 1, 6, 4) }],
      enemies: [{ id: 'b0', kind: 'bluedarknut', t: at(0, 1, 4, 3) }, { id: 'b1', kind: 'bluedarknut', t: at(0, 1, 8, 5) },
                { id: 'w0', kind: 'wizzrobe', t: at(2, 0, 8, 3) }, { id: 'z0', kind: 'zol', t: at(1, 1, 8, 3) }],
      boss: { id: 'gleeok', kind: 'gleeok', t: at(2, 1, 5, 4), heads: 4 }, needs: [],
      bossHint: 'FOUR HEADS: SEVER THEM ONE BY ONE'
    },
    9: {
      id: 9, name: 'Death Mountain', cols: 3, rows: 2,
      links: [[0, 0, 'h', 'K'], [1, 0, 'h', 'D'], [2, 0, 'v', 'Q'], [0, 0, 'v', '.'], [0, 1, 'h', '.']],
      exits: [[0, 3], [0, 4]], start: [2, 4],
      pickups: [{ key: 'bombs1', kind: 'bombs', amount: 8, t: at(0, 0, 5, 4) },
                { key: 'ring', kind: 'item', item: 'ring', t: at(1, 0, 6, 3) },
                { key: 'key1', kind: 'key', t: at(0, 1, 5, 4) },
                { key: 'silver', kind: 'item', item: 'silverArrow', t: at(1, 1, 6, 4) }],
      enemies: [{ id: 'k0', kind: 'keese', t: at(0, 0, 8, 2) }, { id: 'z0', kind: 'zol', t: at(0, 1, 4, 2) },
                { id: 'z1', kind: 'zol', t: at(0, 1, 8, 5) }, { id: 'b0', kind: 'bluedarknut', t: at(1, 0, 8, 4) },
                { id: 'w0', kind: 'wizzrobe', t: at(2, 0, 6, 3) }, { id: 'w1', kind: 'wizzrobe', t: at(2, 0, 8, 5) }],
      boss: { id: 'ganon', kind: 'ganon', t: at(2, 1, 5, 4) }, needs: ['bow', 'silverArrow'],
      bossHint: 'FOUR SWORD HITS, THEN A SILVER ARROW'
    }
  });
})(ASH);
