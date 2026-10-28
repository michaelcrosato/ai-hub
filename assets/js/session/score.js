/**
 * session/score.js — points for a round and the session's table.
 *
 * A player scores one point for every player they beat. Whoever left or sat
 * the round out is placed last by the round (lib/hub/round.js), so they count
 * as beaten and every round of N players is worth the same. Tied players share
 * a place. First place is a win; in co-op only when the team won.
 *
 * A session ends by its format, and the Party format adds the hub's own
 * awards as bonus points at the end (lib/hub/README.md §15).
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
 * { key, name, slot, place, points, win, awards? } for each player in the round.
 */
export function addRound(totals, entries) {
  const next = { ...totals };
  for (const e of entries) {
    const row = next[e.key] || { key: e.key, name: e.name, slot: e.slot, points: 0, wins: 0, rounds: 0, placeSum: 0, awards: 0 };
    next[e.key] = {
      ...row,
      name: e.name,
      slot: e.slot,
      points: row.points + e.points,
      wins: row.wins + (e.win ? 1 : 0),
      rounds: row.rounds + 1,
      placeSum: row.placeSum + e.place,
      awards: (row.awards || 0) + (e.awards?.length || 0),
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

/* --- the session's format and its end ------------------------------------- */

/** How a session can be won. The host picks one in the lobby. */
export const FORMATS = Object.freeze({
  party: { label: 'Party', rounds: 8, bonus: 3, blurb: '8 rounds, then three bonus awards worth 3 points each' },
  sprint: { label: 'Sprint', rounds: 5, bonus: 0, blurb: '5 rounds, most points wins' },
  first12: { label: 'First to 12', target: 12, bonus: 0, blurb: 'The first to 12 points wins' },
  endless: { label: 'Endless', bonus: 0, blurb: 'Play until the host ends it' },
});
export const DEFAULT_FORMAT = 'party';
export const formatOf = (key) => FORMATS[key] || FORMATS[DEFAULT_FORMAT];

const counted = (history) => history.filter((e) => e.status === 'played').length;

/** True once the session's format says it is over. */
export function formatOver(key, history, totals) {
  const format = formatOf(key);
  if (format.rounds) return counted(history) >= format.rounds;
  if (format.target) return Object.values(totals).some((row) => row.points >= format.target);
  return false;
}

/** Where the session stands against its format, in a few words. */
export function formatProgress(key, history, totals) {
  const format = formatOf(key);
  if (format.rounds) {
    const left = format.rounds - counted(history);
    return left <= 1 ? 'Final round' : `Round ${counted(history) + 1} of ${format.rounds}`;
  }
  const lead = leaderboard(totals)[0];
  if (format.target) return lead ? `First to ${format.target}: ${lead.name} has ${lead.points}` : `First to ${format.target} points`;
  return lead ? `${lead.name} leads with ${lead.points}` : 'Endless';
}

/** Each player's longest run of wins, over the rounds they played. */
function streaks(history) {
  const run = new Map();
  const best = new Map();
  for (const entry of history) {
    if (entry.status !== 'played') continue;
    for (const row of entry.rows) {
      const now = row.win ? (run.get(row.key) || 0) + 1 : 0;
      run.set(row.key, now);
      best.set(row.key, Math.max(best.get(row.key) || 0, now));
    }
  }
  return best;
}

/**
 * The hub's own awards when a session ends: Showstopper (most game awards),
 * Hot streak (most wins in a row, two or more) and Steady hand (best average
 * place). Ties share an award; an award nobody earned, or that every player
 * shares, is not given. Each is { title, detail, keys }.
 */
export function sessionAwards(history, totals) {
  const rows = Object.values(totals).filter((row) => row.rounds > 0);
  const top = (measure, better, enough) => {
    const values = rows.map((row) => [row.key, measure(row)]).filter(([, v]) => enough(v));
    if (!values.length) return null;
    const best = values.reduce((a, [, v]) => (better(v, a) ? v : a), values[0][1]);
    const keys = values.filter(([, v]) => v === best).map(([k]) => k);
    return rows.length > 1 && keys.length === rows.length ? null : { value: best, keys };
  };
  const run = streaks(history);
  const out = [];
  const shows = top((row) => row.awards || 0, (a, b) => a > b, (v) => v > 0);
  if (shows) out.push({ title: 'Showstopper', detail: `${shows.value} game award${shows.value === 1 ? '' : 's'}`, keys: shows.keys });
  const hot = top((row) => run.get(row.key) || 0, (a, b) => a > b, (v) => v >= 2);
  if (hot) out.push({ title: 'Hot streak', detail: `${hot.value} wins in a row`, keys: hot.keys });
  const steady = top((row) => Math.round((row.placeSum / row.rounds) * 100) / 100, (a, b) => a < b, () => true);
  if (steady) out.push({ title: 'Steady hand', detail: `average place ${steady.value.toFixed(1)}`, keys: steady.keys });
  return out;
}

/**
 * The final table: the session awards' bonus points added (Party), ordered as
 * the table is, with shared places for players level on points, wins and
 * average place.
 */
export function finalTable(totals, awards, bonus = 0) {
  const extra = new Map();
  for (const award of awards) for (const key of award.keys) extra.set(key, (extra.get(key) || 0) + bonus);
  const rows = leaderboard(
    Object.fromEntries(Object.values(totals).map((row) => [row.key, { ...row, bonus: extra.get(row.key) || 0, points: row.points + (extra.get(row.key) || 0) }]))
  );
  const avg = (row) => (row.rounds ? row.placeSum / row.rounds : Infinity);
  return rows.map((row, i) => {
    let place = i + 1;
    for (let j = i - 1; j >= 0 && rows[j].points === row.points && rows[j].wins === row.wins && avg(rows[j]) === avg(row); j--) place = j + 1;
    return { ...row, place };
  });
}
