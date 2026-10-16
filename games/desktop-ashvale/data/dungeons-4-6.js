// Dungeons 4 to 6 (data): The Snake (ladder and Gleeok), The Lizard (whistle and Digdogger), The Dragon (bow and Ghoma).
(function (A) {
  const at = A.at;
  Object.assign(A.DUNGEONS, {
    4: {
      id: 4, name: 'Serpent Labyrinth', cols: 3, rows: 1,
      links: [[0, 0, 'h', 'D'], [1, 0, 'h', 'W']],               // a key door, then water that only the ladder crosses
      exits: [[0, 3], [0, 4]], start: [2, 4],
      pickups: [{ key: 'key1', kind: 'key', t: at(0, 0, 4, 2) }, { key: 'ladder', kind: 'item', item: 'ladder', t: at(0, 0, 8, 2) },
                { key: 'bombs1', kind: 'bombs', amount: 5, t: at(1, 0, 3, 5) }],
      enemies: [{ id: 'k0', kind: 'keese', t: at(0, 0, 7, 5) }, { id: 'z0', kind: 'zol', t: at(1, 0, 5, 3) },
                { id: 'g0', kind: 'gibdo', t: at(1, 0, 8, 5) }],
      boss: { id: 'gleeok', kind: 'gleeok', t: at(2, 0, 5, 4) }, needs: ['ladder'],
      bossHint: 'SEVER THE HEADS, THEN GLEEOK'
    },
    5: {
      id: 5, name: 'Lizard Warren', cols: 2, rows: 2,
      links: [[0, 0, 'h', 'Q'], [0, 0, 'v', 'D'], [1, 0, 'v', 'H'], [0, 1, 'h', '.']],
      exits: [[0, 3], [0, 4]], start: [2, 4],
      pickups: [{ key: 'whistle', kind: 'item', item: 'whistle', t: at(1, 0, 5, 3) },
                { key: 'key1', kind: 'key', t: at(1, 0, 9, 5) }],
      enemies: [{ id: 'k0', kind: 'keese', t: at(0, 0, 4, 2) }, { id: 'k1', kind: 'keese', t: at(0, 0, 8, 2) },
                { id: 'k2', kind: 'keese', t: at(0, 0, 6, 5) }, { id: 'z0', kind: 'zol', t: at(1, 0, 7, 5) },
                { id: 'g0', kind: 'gibdo', t: at(0, 1, 5, 4) }],
      extra: [{ id: 's0', kind: 'statue', t: at(1, 1, 2, 2) }, { id: 's1', kind: 'statue', t: at(1, 1, 9, 2) },
              { id: 's2', kind: 'statue', t: at(1, 1, 2, 6) }, { id: 's3', kind: 'statue', t: at(1, 1, 9, 6) }],
      boss: { id: 'digdogger', kind: 'digdogger', t: at(1, 1, 5, 4) }, needs: ['whistle'],
      bossHint: 'PLAY THE WHISTLE TO SHRINK IT, THEN STRIKE'
    },
    6: {
      id: 6, name: 'Dragon Hollow', cols: 3, rows: 2,
      links: [[0, 0, 'h', 'Q'], [1, 0, 'h', 'D'], [2, 0, 'v', 'M'], [1, 0, 'v', '.']],
      exits: [[0, 3], [0, 4]], start: [2, 4],
      pickups: [{ key: 'bow', kind: 'item', item: 'bow', t: at(1, 0, 4, 2) }, { key: 'arrows1', kind: 'arrows', amount: 20, t: at(1, 0, 9, 2) },
                { key: 'key1', kind: 'key', t: at(1, 0, 9, 5) }, { key: 'magicKey', kind: 'item', item: 'magicKey', t: at(2, 0, 4, 3) },
                { key: 'rod', kind: 'item', item: 'rod', t: at(1, 1, 5, 4) }],
      enemies: [{ id: 'k0', kind: 'keese', t: at(0, 0, 4, 2) }, { id: 'k1', kind: 'keese', t: at(0, 0, 8, 5) },
                { id: 'g0', kind: 'gibdo', t: at(1, 0, 4, 4) }, { id: 'g1', kind: 'gibdo', t: at(1, 0, 8, 4) },
                { id: 'w0', kind: 'wizzrobe', t: at(2, 0, 6, 3) }, { id: 'z0', kind: 'zol', t: at(1, 1, 7, 5) }],
      boss: { id: 'ghoma', kind: 'ghoma', t: at(2, 1, 5, 4) }, needs: ['bow'],
      bossHint: 'SHOOT THE EYE WHEN IT OPENS'
    }
  });
})(ASH);
