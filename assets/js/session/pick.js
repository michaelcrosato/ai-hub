/**
 * session/pick.js — Random Mode: which game the session plays next.
 *
 * Every game that declares a supported session protocol, seats the players
 * present, and sits on the Games shelf is in the pool. The pool is dealt in an
 * order fixed by the session's seed (the Deck's shuffle), and no game comes
 * round twice until every game in the pool has had its turn: then a new cycle
 * deals the pool again in a new order.
 */

import { sessionOf } from '../manifest.js';
import { isVisible, shelfOf } from '../filter.js';
import { shuffleDeck } from '../explore/deck.js';

/** The games a session of `n` players can play. */
export function eligible(games, n) {
  return games.filter((game) => {
    const session = sessionOf(game);
    return (
      session?.supported &&
      session.seats[0] <= n &&
      n <= session.seats[1] &&
      isVisible(game, false) &&
      shelfOf(game) === 'games'
    );
  });
}

/**
 * The games a session deals from. The reference examples join the library when
 * the host asks for them (?examples=1), and also while no library game supports
 * sessions, so that "Play with friends" always has something to play.
 */
export function sessionPool(library, examples, wanted = false) {
  const any = library.some((game) => sessionOf(game)?.supported);
  return wanted || !any ? [...library, ...examples] : library;
}

/**
 * The next game, and the cycle and played list that follow it.
 * Null when nothing fits `n` players.
 */
export function pickNext(games, { seed, n, cycle = 0, played = [] }) {
  const pool = eligible(games, n);
  if (!pool.length) return null;
  const done = new Set(played);
  let next = shuffleDeck(pool, `${seed}:${cycle}`).find((game) => !done.has(game.slug));
  if (!next) {
    cycle += 1;
    played = [];
    next = shuffleDeck(pool, `${seed}:${cycle}`)[0];
  }
  return { game: next, cycle, played: [...played, next.slug] };
}
