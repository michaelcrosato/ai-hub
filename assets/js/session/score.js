/**
 * session/score.js — points for a round and the session's table.
 *
 * A player scores one point for every player they beat. Whoever left or sat
 * the round out is placed last by the round (lib/hub/round.js), so they count
 * as beaten and every round of N players is worth the same. Tied players share
 * a place. First place is a win; in co-op only when the team won.
 */

/** Each player's place (1 is best) from standings, best first, ties grouped. */
export function placesOf(standings) {
  const places = new Map();
  let place = 1;
  for (const group of standings) {
    for (const id of group) places.set(id, place);
    place += group.length;
  }
  return places;
}

/** Map of id → { place, points, win } for a played round. */
export function scoreRound({ standings, mode, won }) {
  const places = placesOf(standings);
  const out = new Map();
  for (const [id, place] of places) {
    let beaten = 0;
    for (const other of places.values()) if (other > place) beaten++;
    out.set(id, { place, points: beaten, win: place === 1 && (mode !== 'co-op' || won === true) });
  }
  return out;
}

/**
 * The session's table after one more round. `entries` are
 * { key, name, slot, place, points, win } for each player in the round.
 */
export function addRound(totals, entries) {
  const next = { ...totals };
  for (const e of entries) {
    const row = next[e.key] || { key: e.key, name: e.name, slot: e.slot, points: 0, wins: 0, rounds: 0, placeSum: 0 };
    next[e.key] = {
      ...row,
      name: e.name,
      slot: e.slot,
      points: row.points + e.points,
      wins: row.wins + (e.win ? 1 : 0),
      rounds: row.rounds + 1,
      placeSum: row.placeSum + e.place,
    };
  }
  return next;
}

/** The table in order: points, then wins, then the better average place. */
export function leaderboard(totals) {
  const avg = (row) => (row.rounds ? row.placeSum / row.rounds : Infinity);
  return Object.values(totals).sort(
    (a, b) => b.points - a.points || b.wins - a.wins || avg(a) - avg(b) || a.name.localeCompare(b.name)
  );
}
