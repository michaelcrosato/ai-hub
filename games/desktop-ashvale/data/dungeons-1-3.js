// The first three dungeons (data). Positions are tiles; use ASH.at(room x, room y, local x, local y) to place things by room.
(function (A) {
  A.DUNGEONS = A.DUNGEONS || {};
  Object.assign(A.DUNGEONS, {
    1: {
      id: 1, name: 'Hollow Keep', cols: 2, rows: 1, links: [[0, 0, 'h', 'D']],
      exits: [[0, 3], [0, 4]], pillars: [[4, 5], [7, 2], [15, 2], [20, 5]], start: [2, 4],
      enemies: [{ id: 'd0', kind: 'slime', t: [5, 5] }],
      pickups: [{ key: 'key1', kind: 'key', t: [4, 2] }],
      boss: { id: 'warden', kind: 'warden', t: [18, 4] }, needs: [],
      bossHint: 'SLAY THE WARDEN'
    },
    2: {
      id: 2, name: 'Sunken Moonhall', cols: 3, rows: 1, links: [[0, 0, 'h', 'D'], [1, 0, 'h', 'K']],
      exits: [[0, 3], [0, 4]], pillars: [[4, 2], [7, 5], [16, 2], [19, 5], [28, 2], [31, 5]], start: [2, 4],
      enemies: [{ id: 'd0', kind: 'slime', t: [9, 2] }, { id: 'd1', kind: 'slime', t: [14, 4] }],
      pickups: [{ key: 'key1', kind: 'key', t: [6, 2] }, { key: 'bombs1', kind: 'bombs', amount: 5, t: [14, 6] },
                { key: 'bombs2', kind: 'bombs', amount: 5, t: [21, 1] }],
      boss: { id: 'dodongo', kind: 'dodongo', t: [30, 4] }, needs: ['bomb'],
      bossHint: 'DODONGO HATES SMOKE: BOMB IT, THEN STRIKE'
    },
    3: {
      id: 3, name: 'Thornwatch Stair', cols: 3, rows: 1, links: [[0, 0, 'h', 'D'], [1, 0, 'h', 'G']],
      exits: [[0, 3], [0, 4]], pillars: [[4, 2], [7, 5], [20, 2], [28, 5]], start: [2, 4],
      spikes: [[14, 1], [15, 1], [14, 2], [15, 2]],
      enemies: [{ id: 'd0', kind: 'slime', t: [3, 5] }, { id: 'dk0', kind: 'darknut', t: [9, 3], dir: 1 },
                { id: 'dk1', kind: 'darknut', t: [17, 5], dir: -1 }],
      pickups: [{ key: 'key1', kind: 'key', t: [6, 2] }, { key: 'raft', kind: 'item', item: 'raft', t: [18, 1] },
                { key: 'bombs1', kind: 'bombs', amount: 5, t: [21, 6] }],
      boss: { id: 'manhandla', kind: 'manhandla', t: [30, 4] }, needs: [],
      extra: [
        { id: 'm0', kind: 'mouth', t: [26, 2] }, { id: 'm1', kind: 'mouth', t: [33, 2] },
        { id: 'm2', kind: 'mouth', t: [26, 5] }, { id: 'm3', kind: 'mouth', t: [33, 5] }
      ],
      bossHint: 'SMASH THE MOUTHS, THEN MANHANDLA'
    }
  });
})(ASH);
