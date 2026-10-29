/**
 * session/pick.js — Random Mode: which game the session plays next.
 *
 * Every game that declares a supported session protocol, seats the players
 * present, and sits on the Games shelf is in the pool. The pool is dealt in an
 * order fixed by the session's seed (the Deck's shuffle), and no game comes
 * round twice until every game in the pool has had its turn: then a new cycle
 * deals the pool again in a new order.
 */

import { sessionOf, sameKey } from '../manifest.js';
import { isVisible, shelfOf } from '../filter.js';
import { shuffleDeck } from '../explore/deck.js';

/**
 * The games a session of `n` players can play. The seats' browsers decide
 * too: a game that cannot play without WebGPU (hub:webgpu "required") only
 * when every seat has it (`webgpu`); and when a seat has nothing but a touch
 * screen (`touchOnly`), the games tagged touch, if any fit.
 */
export function eligible(games, n, { webgpu = false, touchOnly = false } = {}) {
  const fit = games.filter((game) => {
    const session = sessionOf(game);
    return (
      session?.supported &&
      session.seats[0] <= n &&
      n <= session.seats[1] &&
      (webgpu || game.webgpu !== 'required') &&
      isVisible(game, false) &&
      shelfOf(game) === 'games'
    );
  });
  const touch = touchOnly ? fit.filter((game) => Array.isArray(game.tags) && game.tags.includes('touch')) : [];
  return touch.length ? touch : fit;
}

/** One game, however many builds of it the library holds: the same source, or for an original the same name. */
export const lineageKey = (game) => `${sameKey(game.lineage?.series ?? '')}\u0000${sameKey(game.lineage?.title ?? game.slug)}`;

/**
 * The games a session deals from. The reference examples join the library when
 * the host asks for them (?examples=1), and also while no library game supports
 * sessions, so that "Play with friends" always has something to play.
 */
export function sessionPool(library, examples, wanted = false) {
  const any = library.some((game) => sessionOf(game)?.supported);
  return wanted || !any ? [...library, ...examples] : library;
}

/** Side by side (each plays alone) or together (one course or one world): the two decks the deal alternates. */
export const deckOf = (game) => (sessionOf(game)?.mode === 'parallel' ? 'side' : 'together');

/**
 * The next game, and the cycle and played list that follow it. Null when
 * nothing fits `n` players.
 *
 * Side-by-side games far outnumber the ones played together, so a single
 * shuffle would bury the few shared worlds. While both decks have games, the
 * deal alternates between them, starting with a game played together. Within
 * a deck it deals games, not builds: one build of each lineage, picked at
 * random, and no lineage comes round again until the deck is played through,
 * so a source with hundreds of runs is one game among the others.
 */
export function pickNext(games, { seed, n, cycle = 0, played = [], webgpu = false, touchOnly = false }) {
  const pool = eligible(games, n, { webgpu, touchOnly });
  if (!pool.length) return null;
  const decks = new Set(pool.map(deckOf));
  const last = played.length ? pool.find((game) => game.slug === played.at(-1)) : null;
  const want = decks.size > 1 ? (last && deckOf(last) === 'together' ? 'side' : 'together') : [...decks][0];
  const lineages = new Map();
  for (const game of pool.filter((g) => deckOf(g) === want)) {
    const key = lineageKey(game);
    if (!lineages.has(key)) lineages.set(key, []);
    lineages.get(key).push(game);
  }
  const done = new Set(played);
  const order = (c) => shuffleDeck([...lineages].map(([slug, builds]) => ({ slug, builds })), `${seed}:${c}:${want}`);
  let next = order(cycle).find((lineage) => !lineage.builds.some((game) => done.has(game.slug)));
  if (!next) {
    // That deck is played through: it starts again in a new order, and the other deck carries on.
    cycle += 1;
    const again = new Set([...lineages.values()].flat().map((game) => game.slug));
    played = played.filter((slug) => !again.has(slug));
    next = order(cycle)[0];
  }
  const game = shuffleDeck(next.builds, `${seed}:${cycle}:${next.slug}`)[0];
  return { game, cycle, played: [...played, game.slug] };
}
