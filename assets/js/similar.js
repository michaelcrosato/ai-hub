/**
 * similar.js — "other attempts" and "more like this", worked out from what
 * the games already carry. No DOM, so node --test can pin it down.
 *
 * Attempts are the same game tried again: the same title within the same
 * series (see lineageOf in manifest.js). Likeness is everything short of that:
 * the same series, the same genre, shared tags, the same model, the same
 * shelf. Attempts are never counted as "like" a game; they are the game.
 */

import { fold, sameKey } from './manifest.js';

const sameAttempt = (a, b) =>
  sameKey(a.lineage.title) === sameKey(b.lineage.title) && sameKey(a.lineage.series) === sameKey(b.lineage.series);

/** Every other attempt at the same game, newest first. */
export const attemptsAt = (game, games) =>
  games
    .filter((other) => other.slug !== game.slug && sameAttempt(game, other))
    .sort((a, b) => b.addedAt - a.addedAt || a.name.localeCompare(b.name));

const tagsOf = (game) => new Set((game.tags || []).map((tag) => fold(tag).trim()).filter(Boolean));

/** How alike two games are; 0 means not at all. Only the order matters. */
export function likeness(a, b) {
  if (a.slug === b.slug || sameAttempt(a, b)) return 0;
  let score = 0;
  if (!a.lineage.original && sameKey(a.lineage.series) === sameKey(b.lineage.series)) score += 3;
  if (a.genre && a.genre === b.genre) score += 2;
  const ta = tagsOf(a);
  const tb = tagsOf(b);
  if (ta.size && tb.size) {
    let shared = 0;
    for (const tag of ta) if (tb.has(tag)) shared += 1;
    score += (4 * shared) / (ta.size + tb.size - shared);
  }
  if (a.model && a.model === b.model) score += 0.5;
  if ((a.type || 'Game') === (b.type || 'Game')) score += 0.5;
  return score;
}

/** The games most like `game`, best first: never itself, never an attempt at it. */
export function similarGames(game, games, { limit = 12 } = {}) {
  return games
    .map((other) => [other, likeness(game, other)])
    .filter(([, score]) => score > 1)
    .sort(([a, x], [b, y]) => y - x || b.addedAt - a.addedAt || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(([other]) => other);
}
