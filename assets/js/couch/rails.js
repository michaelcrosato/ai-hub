/**
 * couch/rails.js — the Couch's home screen as rows of games, the way a
 * console lays out a library: what you played and starred, what is new, the
 * games to play with friends, then the library by genre with its series and
 * models woven between, then the originals, couch co-op on this screen, and
 * the other shelf last.
 *
 * No DOM, so node --test can pin the order down. `stats` is the same small
 * read-only view of this device the wall's sorts use:
 * { isFave(slug), lastPlayed(slug) }.
 */

import { sameKey, playersOf, termName, MULTI } from '../manifest.js';
import { shelfOf, SHELVES } from '../filter.js';
import { fnv1a } from '../color.js';
import { playsOnline } from '../friends/together.js';
import { t, upper, compare } from '../lang.js';

/** The most tiles a rail holds. Past this a row stops being browsable. */
export const CAP = { recent: 20, fresh: 24, library: 40 };

/** The fewest games that make a row worth a line of the screen. A personal
 *  row is worth it with one game: that one is yours. */
const FEWEST = { personal: 1, library: 3, series: 3, model: 3, together: 2 };

/** One series or model rail after every this many genre rails, so the screen
 *  never reads as one long list of genres. */
const CADENCE = 2;

/** Genres as a row title: a natural plural, in sentence case. */
const GENRE_TITLES = new Map(
  Object.entries({
    rpg: t('couch.rails.genre_rpg'),
    shooter: t('couch.rails.genre_shooter'),
    action: t('couch.rails.genre_action'),
    adventure: t('couch.rails.genre_adventure'),
    flight: t('couch.rails.genre_flight'),
    sports: t('couch.rails.genre_sports'),
    'life sim': t('couch.rails.genre_life_sim'),
    platformer: t('couch.rails.genre_platformer'),
    racing: t('couch.rails.genre_racing'),
    simulation: t('couch.rails.genre_simulation'),
    strategy: t('couch.rails.genre_strategy'),
    'kids & learning': t('couch.rails.genre_kids'),
    horror: t('couch.rails.genre_horror'),
    puzzle: t('couch.rails.genre_puzzle'),
    fighting: t('couch.rails.genre_fighting'),
    'tech demo': t('couch.rails.genre_tech_demo'),
  })
);

export function genreTitle(genre) {
  const known = GENRE_TITLES.get(sameKey(genre));
  if (known) return known;
  const text = String(genre).trim();
  const named = termName('genre', text);
  if (named !== text) return t('couch.rails.genre_other', { genre: named });
  return t('couch.rails.genre_other', { genre: `${upper(text.charAt(0))}${text.slice(1).toLowerCase()}` });
}

const byName = (a, b) => compare(a.name, b.name);
const newest = (a, b) => b.addedAt - a.addedAt || byName(a, b);

const GAMES = SHELVES[0].key;

/** The local calendar day, as YYYY-MM-DD: what today's spotlight is keyed on. */
export function dayKey(now = Date.now()) {
  const day = new Date(now);
  const two = (n) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`;
}

/**
 * Today's spotlight: one game from the Games shelf, picked by hashing the
 * date. Everyone sees the same pick all day, and a different one tomorrow.
 * Sorted by slug first, so the pick does not depend on the manifest's order.
 */
export function spotlightOf(games, now = Date.now()) {
  const pool = games.filter((game) => shelfOf(game) === GAMES).sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const from = pool.length ? pool : games;
  return from.length ? from[fnv1a(dayKey(now)) % from.length] : null;
}

/** Games sharing a value, spelled the way the first game spells it. */
function groupBy(games, valuesOf) {
  const groups = new Map();
  for (const game of games) {
    for (const value of valuesOf(game)) {
      const key = sameKey(value);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { key, label: String(value).trim(), games: [] });
      groups.get(key).games.push(game);
    }
  }
  return [...groups.values()];
}

const rail = (key, title, games, cap = CAP.library) => ({ key, title, games: games.slice().sort(newest).slice(0, cap) });

/**
 * Genres carry the screen. The series and model rails are woven in, one after
 * every CADENCE genres, and whatever is left follows the last genre.
 */
export function weave(genres, others, cadence = CADENCE) {
  const out = [];
  let next = 0;
  genres.forEach((genre, i) => {
    out.push(genre);
    if ((i + 1) % cadence === 0 && next < others.length) out.push(others[next++]);
  });
  return out.concat(others.slice(next));
}

/**
 * The rows, in order: Jump back in, Your favourites, Fresh on the wall, Play
 * with friends (the games that play in a session, each on their own device),
 * the genres (biggest first) with series and models between them, Originals,
 * Couch co-op (several players on this screen), and Tech demos & tools. A row
 * that comes out shorter than it needs to be is left out. `seed` (today, by default) settles the order of series
 * and model rails of the same size, so the lineup turns over day by day but
 * never between two visits on the same day.
 */
export function buildRails(games, stats, { now = Date.now(), seed = dayKey(now) } = {}) {
  const shelf = games.filter((game) => shelfOf(game) === GAMES);
  const tools = games.filter((game) => shelfOf(game) === 'tools');
  const unsure = games.filter((game) => shelfOf(game) === 'unsure');

  const recent = games
    .filter((game) => stats.lastPlayed(game.slug) > 0)
    .sort((a, b) => stats.lastPlayed(b.slug) - stats.lastPlayed(a.slug) || byName(a, b))
    .slice(0, CAP.recent);
  const faves = games.filter((game) => stats.isFave(game.slug)).sort(byName);

  const genres = groupBy(shelf, (game) => (game.genre ? [game.genre] : []))
    .filter((group) => group.games.length >= FEWEST.library)
    .sort((a, b) => b.games.length - a.games.length || a.label.localeCompare(b.label))
    .map((group) => rail(`genre:${group.key}`, genreTitle(group.label), group.games));

  const series = groupBy(
    games.filter((game) => !game.lineage.original),
    (game) => [game.lineage.series]
  )
    .filter((group) => group.games.length >= FEWEST.series)
    .map((group) => ({ ...group, kind: 'series' }));
  const models = groupBy(games, (game) => game.rails.model || [])
    .filter((group) => group.games.length >= FEWEST.model)
    .map((group) => ({ ...group, kind: 'model' }));

  // Bigger first; between equals, the day's seed decides.
  const turn = (group) => fnv1a(`${seed}|${group.kind}|${group.key}`);
  let told = 0;
  const others = [...series, ...models]
    .sort((a, b) => b.games.length - a.games.length || turn(a) - turn(b) || a.label.localeCompare(b.label))
    .map((group) => {
      if (group.kind === 'model') return rail(`model:${group.key}`, t('couch.rails.model', { model: group.label }), group.games);
      // "Inspired by" and "After" take turns, so a run of series reads less like a list.
      const title = told++ % 2 ? t('couch.rails.series_after', { series: group.label }) : t('couch.rails.series_inspired', { series: group.label });
      return rail(`series:${group.key}`, title, group.games);
    });

  const friends = shelf.filter((game) => playsOnline(game, { showAll: true }));
  const together = shelf.filter((game) => playersOf(game).includes(MULTI));
  const worth = (fewest, row) => (row.games.length >= fewest ? row : null);

  return [
    worth(FEWEST.personal, { key: 'recent', title: t('couch.rails.recent'), games: recent }),
    worth(FEWEST.personal, { key: 'faves', title: t('couch.rails.faves'), games: faves }),
    worth(FEWEST.library, rail('fresh', t('couch.rails.fresh'), games, CAP.fresh)),
    worth(FEWEST.together, rail('friends', t('couch.rails.friends'), friends)),
    ...weave(genres, others),
    worth(FEWEST.library, rail('originals', t('couch.rails.originals'), shelf.filter((game) => game.lineage.original))),
    worth(FEWEST.together, rail('together', t('couch.rails.together'), together)),
    worth(1, rail('unsure', t('couch.rails.unsure'), unsure)),
    worth(FEWEST.library, rail('tools', t('couch.rails.tools'), tools)),
  ].filter(Boolean);
}
