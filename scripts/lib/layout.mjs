/**
 * Pure helpers for deciding what a path under games/ *is*: which game it
 * belongs to, which build of that game it is, and which collection it sits in.
 * No I/O, so `scripts/layout.test.mjs` can pin every rule down.
 *
 * The rules, in the order they are tried:
 *
 *   games/snake.html                  a game
 *   games/snake-v2.html               build v2 of "snake"
 *   games/void-explorer/v0.5.html     build v0.5 of "void-explorer" (the folder names the game)
 *   games/orbit/index.html            a multi-file project: the folder is the game
 *   games/orbit-v2/index.html         build v2 of the project "orbit"
 *   games/orbit/v2/index.html         the same, one level deeper
 *   games/claude/snake.html           a game in the collection "Claude"
 *   games/claude/orbit/index.html     a project in the collection "Claude"
 *
 * A folder only ever *names a game* when its files are bare versions or it
 * holds an index.html. Any other folder is a collection, so dropping a folder
 * of 80 unrelated games into games/ gives 80 tiles, never one tile with 80
 * "builds". Hiding games by accident is the failure this layout exists to
 * prevent.
 */

import { slugify, parseVersion } from './parse.mjs';

export const INDEX_FILE = /^index\.html?$/i;

export const prettify = (s) =>
  String(s ?? '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());

const keyOf = (dirs, name) => [...dirs, name].map((part) => slugify(part) || part.toLowerCase()).join('/');

const labelFor = (version, fallback) => (version ? `v${version}` : fallback);

/**
 * @param {string} rel      posix path relative to games/
 * @param {object} [opts]
 * @param {boolean} [opts.project]  rel is the index.html of a project folder
 * @returns {{ key: string, family: string, version: string|null, label: string, collection: string|null }}
 *   key         groups builds of one game; case- and punctuation-insensitive
 *   family      the human name to fall back on when the game has no <title>
 *   collection  the top-level folder, when that folder is not the game itself
 */
export function classify(rel, { project = false } = {}) {
  const dirs = String(rel).split('/').filter(Boolean);
  const file = dirs.pop() || '';
  const stem = file.replace(/\.[^.]+$/, '');

  // The segments that identify the game, and the folders that merely hold it.
  let owner;
  let family;
  let version;

  if (project && dirs.length) {
    const folder = dirs[dirs.length - 1];
    const parsed = parseVersion(folder);
    if (parsed.version && !parsed.base && dirs.length > 1) {
      // games/orbit/v2/index.html
      owner = dirs.slice(0, -2);
      family = dirs[dirs.length - 2];
    } else {
      // games/orbit/index.html, games/orbit-v2/index.html
      owner = dirs.slice(0, -1);
      family = parsed.base || folder;
    }
    version = parsed.version;
  } else {
    const parsed = parseVersion(stem);
    if (parsed.version && !parsed.base && dirs.length) {
      // games/void-explorer/v0.5.html
      owner = dirs.slice(0, -1);
      family = dirs[dirs.length - 1];
    } else {
      owner = dirs;
      family = parsed.base || stem;
    }
    version = parsed.version;
  }

  // games/snake/snake-v2.html: the folder and the file agree on the name, so
  // the folder is this game's home rather than a collection of one.
  if (owner.length && slugify(owner[owner.length - 1]) === slugify(family)) owner = owner.slice(0, -1);

  return {
    key: keyOf(owner, family),
    family,
    version: version || null,
    label: labelFor(version, 'build'),
    collection: owner.length ? owner[0] : null,
  };
}

/**
 * Give every game a slug that is unique, URL-safe and as short as possible.
 * Shallow games are served first so a root-level game keeps its plain slug when
 * a same-named game turns up inside a collection later; a clash falls back to
 * the path-qualified slug (`claude-snake`), and only then to a counter.
 *
 * @param {Array<{ key: string, family: string }>} groups
 * @returns {Map<string, string>} key → slug
 */
export function assignSlugs(groups) {
  const order = [...groups].sort((a, b) => {
    const depth = a.key.split('/').length - b.key.split('/').length;
    return depth || a.key.localeCompare(b.key);
  });
  const taken = new Set();
  const slugs = new Map();
  for (const { key, family } of order) {
    const candidates = [slugify(family), slugify(key.replace(/\//g, '-'))].filter(Boolean);
    let slug = candidates.find((s) => !taken.has(s));
    if (!slug) {
      const base = candidates[candidates.length - 1] || 'game';
      let n = 2;
      while (taken.has(`${base}-${n}`)) n++;
      slug = `${base}-${n}`;
    }
    taken.add(slug);
    slugs.set(key, slug);
  }
  return slugs;
}
