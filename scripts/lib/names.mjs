/**
 * names.mjs — no two entries on the wall show the same name.
 *
 * Runs of one game, remakes that took the same title, a classic's name used
 * twice: when names collide, the oldest entry (the first added to the hub)
 * keeps the plain name and the later ones are numbered in the order they were
 * added, "Ashbound (2)", "Ashbound (3)". The plain name rides along as
 * `plainName`, so attempts at the same game still stack and a search for
 * "Ashbound" still finds all three. Nothing is typed in by hand: a duplicate
 * imported tomorrow is numbered by the next scan.
 */

/** Case, accents and spacing never make two names different. */
export const nameKey = (name) =>
  String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const time = (iso) => Date.parse(iso) || 0;
const byArrival = (a, b) => time(a.added) - time(b.added) || time(a.sourceDate) - time(b.sourceDate) || a.slug.localeCompare(b.slug);

/** Number colliding names in place. Returns the games, for chaining. */
export function numberNames(games) {
  const groups = new Map();
  for (const game of games) {
    const key = nameKey(game.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(game);
  }
  // A numbered name must not land on a name some other entry already has.
  const taken = new Set(groups.keys());
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(byArrival);
    let n = 1;
    for (const game of group.slice(1)) {
      let name;
      do name = `${game.name.trim()} (${++n})`;
      while (taken.has(nameKey(name)));
      taken.add(nameKey(name));
      game.plainName = game.name;
      game.name = name;
    }
  }
  return games;
}
