#!/usr/bin/env node
/**
 * scan.mjs — the one thing that makes this hub dynamic.
 *
 * Walks games/, reads only the <head> of each game, and writes
 * data/games.json. This runs as the Vercel build command, so adding game #401
 * is `git add` and nothing else. It never writes to a game file.
 *
 * What counts as a game, a build or a collection is decided in lib/layout.mjs.
 *
 * Usage:  node scripts/scan.mjs [--quiet] [--list]
 */

import { readdir, stat, readFile, writeFile, open } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseHead, splitTitle, slugify, compareVersions, weightClass, rootAbsoluteRefs } from './lib/parse.mjs';
import { classify, assignSlugs, prettify, INDEX_FILE } from './lib/layout.mjs';

const run = promisify(execFile);

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAMES_DIR = path.join(ROOT, 'games');
const COVERS_DIR = path.join(ROOT, 'covers');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(DATA_DIR, 'games.json');
export const ADDED_FILE = path.join(DATA_DIR, 'added.json');
const OVERRIDES_FILE = path.join(DATA_DIR, 'overrides.json');

/** Most heads end in the first few KB; a game that inlines a big stylesheet
 *  before </head> gets a second, longer read. */
const HEAD_FIRST_READ = 64 * 1024;
const HEAD_MAX_READ = 512 * 1024;
/** A favicon is an emblem, not a picture. Anything bigger bloats the manifest
 *  every visitor downloads, so the generated art stands in for it instead. */
const MAX_INLINE_ICON = 32 * 1024;
const GAME_EXT = new Set(['.html', '.htm']);
const IMAGE_EXT = new Set(['.png', '.webp', '.avif', '.jpg', '.jpeg', '.gif', '.svg', '.ico']);
const COVER_EXT = ['.png', '.webp', '.avif', '.jpg', '.jpeg', '.gif', '.svg'];
/**
 * One encode for every strip. JPEG at the pilot's clearer 640×480 setting:
 * baseline JPEG is the compatible choice, and every cabinet uses it.
 */
export const STRIP_ENCODE = { width: 640, height: 480, format: 'JPEG', quality: 58 };
const MB = 1024 * 1024;
/** GitHub warns at 50 MB and rejects a push containing a file over 100 MB. */
const WARN_BYTES = 50 * MB;
const REFUSE_BYTES = 100 * MB;
const MANIFEST_VERSION = 2;

export const urlPath = (prefix, rel) => prefix + rel.split(/[\\/]/).map(encodeURIComponent).join('/');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const skipName = (name) => name.startsWith('.') || name.startsWith('_');

/**
 * Collect game entry points. A folder holding an index.html is a project: its
 * index is the entry and nothing inside it is looked at again, so a project's
 * own extra pages never turn into tiles. `_`- and `.`-prefixed names are
 * skipped, which is how you park something without deleting it.
 */
async function walk(dir, base = dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const rel = (name) => path.relative(base, path.join(dir, name)).split(path.sep).join('/');

  if (dir !== base) {
    const index = entries.find((e) => e.isFile() && INDEX_FILE.test(e.name));
    if (index) {
      const pages = entries.filter(
        (e) => e.isFile() && e !== index && GAME_EXT.has(path.extname(e.name).toLowerCase())
      ).length;
      return [{ abs: path.join(dir, index.name), rel: rel(index.name), project: true, pages }];
    }
  }

  const found = [];
  for (const entry of entries) {
    if (skipName(entry.name)) continue;
    if (entry.isDirectory()) {
      found.push(...(await walk(path.join(dir, entry.name), base)));
    } else if (entry.isFile() && GAME_EXT.has(path.extname(entry.name).toLowerCase())) {
      found.push({ abs: path.join(dir, entry.name), rel: rel(entry.name), project: false, pages: 0 });
    }
  }
  return found;
}

async function readLeadingBytes(handle, bytes) {
  const buffer = Buffer.allocUnsafe(bytes);
  const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
  return buffer.subarray(0, bytesRead).toString('utf8');
}

const headEnded = (text) => /<\/head\s*>|<body[\s>]/i.test(text);

/**
 * Parsed heads, remembered for the life of the process. The dev server scans
 * on every refresh, and 400 files re-read from scratch each time is the
 * difference between an instant reload and a sluggish one.
 */
const headCache = new Map();

async function inspect(abs, project) {
  const stats = await stat(abs);
  const stamp = `${stats.size}:${stats.mtimeMs}`;
  const cached = headCache.get(abs);
  if (cached?.stamp === stamp) return { ...cached.value, stats };

  const handle = await open(abs, 'r');
  let text;
  try {
    text = await readLeadingBytes(handle, HEAD_FIRST_READ);
    if (!headEnded(text) && stats.size > HEAD_FIRST_READ) text = await readLeadingBytes(handle, HEAD_MAX_READ);
  } finally {
    await handle.close();
  }

  const value = { info: parseHead(text), rootRefs: [] };
  if (project) {
    // Only projects load files of their own; a single-file game has nothing to lose.
    const whole = stats.size <= 2 * MB ? await readFile(abs, 'utf8') : text;
    value.rootRefs = rootAbsoluteRefs(whole);
  }
  headCache.set(abs, { stamp, value });
  return { ...value, stats };
}

/** Run `fn` over `items` with at most `limit` in flight. Order is preserved. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * First-commit dates per file, used only for a game data/added.json has never
 * seen. File mtimes are worthless after a clone — every file is stamped with
 * the checkout time — and Vercel's clone is shallow, which makes every file
 * look as if it arrived in the latest commit. So the date recorded the first
 * time a game was scanned (or imported) always wins.
 */
async function gitAddedDates() {
  const dates = new Map();
  try {
    const { stdout } = await run(
      'git',
      ['log', '--diff-filter=A', '--reverse', '--name-only', '--format=%x00%aI', '--', 'games'],
      { cwd: ROOT, maxBuffer: 64 * MB, timeout: 20_000 }
    );
    for (const chunk of stdout.split('\0')) {
      const lines = chunk.split('\n').filter(Boolean);
      if (lines.length < 2) continue;
      const iso = lines[0].trim();
      for (const file of lines.slice(1)) {
        const rel = file.replace(/^games\//, '').trim();
        if (rel && !dates.has(rel)) dates.set(rel, iso);
      }
    }
  } catch {
    // No git, no commits yet. Not an error.
  }
  return dates;
}

/** Cabinet text for the shared strip encode: resolution, format, and quality. */
export function encodeLabel({ width, height, format, quality }) {
  return `${width}×${height} ${format} quality ${quality}`;
}

/**
 * A complete strip is covers/<slug>/0.jpg, 1.jpg and 2.jpg. Frame 0 is the
 * title. A folder missing any of the three is ignored, so a crashed capture
 * cannot publish a half-written cabinet. Any other file in the folder is not
 * a frame.
 */
export async function loadFrameStrips(dir = COVERS_DIR) {
  const strips = new Map();
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return strips;
  }
  const label = encodeLabel(STRIP_ENCODE);
  for (const entry of entries) {
    if (!entry.isDirectory() || skipName(entry.name)) continue;
    const slug = entry.name;
    const folder = path.join(dir, slug);
    const frames = [];
    let complete = true;
    for (const index of [0, 1, 2]) {
      const name = `${index}.jpg`;
      try {
        if (!(await stat(path.join(folder, name))).isFile()) {
          complete = false;
          break;
        }
      } catch {
        complete = false;
        break;
      }
      frames.push(urlPath(`/covers/${slug}/`, name));
    }
    if (!complete) continue;
    strips.set(slug, { frames, frameLabel: label, cover: frames[0] });
  }
  return strips;
}

async function coverIndex() {
  const map = new Map();
  let entries;
  try {
    entries = await readdir(COVERS_DIR, { withFileTypes: true });
  } catch {
    return map;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!COVER_EXT.includes(ext)) continue;
    const key = slugify(path.basename(entry.name, ext));
    // Earlier extensions in COVER_EXT win, so a hand-made .png beats a generated .jpg.
    const rank = COVER_EXT.indexOf(ext);
    const existing = map.get(key);
    if (!existing || rank < existing.rank) map.set(key, { file: entry.name, rank });
  }
  return map;
}

/**
 * A relative icon or og:image from a game's head, resolved against the game's
 * own folder — but only if the file is really there and stays inside games/.
 */
async function localAsset(rel, href, extensions) {
  if (!href || /^[a-z][a-z0-9+.-]*:|^\/|^#/i.test(href)) return null;
  const clean = href.split(/[?#]/)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    return null;
  }
  if (!extensions.has(path.extname(decoded).toLowerCase())) return null;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), decoded));
  if (target.startsWith('../') || target === '..') return null;
  try {
    if ((await stat(path.join(GAMES_DIR, target))).isFile()) return urlPath('/games/', target);
  } catch {
    /* not there */
  }
  return null;
}

export async function scan({ quiet = false, list = false } = {}) {
  const entries = await walk(GAMES_DIR);
  const [gitDates, covers, strips, overridesRaw, addedRaw] = await Promise.all([
    gitAddedDates(),
    coverIndex(),
    loadFrameStrips(),
    readJson(OVERRIDES_FILE, {}),
    readJson(ADDED_FILE, {}),
  ]);

  const overrides = { ...overridesRaw };
  delete overrides._readme;
  // Seeded from what is on disk now, so a game you delete stops being recorded
  // instead of accumulating forever.
  const known = new Set(entries.map((e) => e.rel));
  const added = Object.fromEntries(Object.entries(addedRaw).filter(([rel]) => known.has(rel)));
  const nowIso = new Date().toISOString();
  const notes = { skipped: [], big: [], rootRefs: [], bigIcons: 0, projectPages: [] };

  const inspected = await pool(entries, 24, async (entry) => {
    try {
      return { ...entry, ...(await inspect(entry.abs, entry.project)) };
    } catch (err) {
      notes.skipped.push(`games/${entry.rel}: ${err.message}`);
      return null;
    }
  });

  const groups = new Map();
  for (const item of inspected) {
    if (!item) continue;
    const { rel, info, stats, project } = item;
    const place = classify(rel, { project });
    const { name: titleName, tagline } = splitTitle(info.title);

    if (stats.size >= WARN_BYTES) notes.big.push({ rel, bytes: stats.size });
    if (item.rootRefs.length) notes.rootRefs.push({ rel, refs: item.rootRefs });
    if (item.pages > 0) notes.projectPages.push({ rel, pages: item.pages });

    let icon = info.icon;
    if (icon && icon.length > MAX_INLINE_ICON) {
      icon = null;
      notes.bigIcons++;
    }
    if (!icon) icon = await localAsset(rel, info.iconHref, IMAGE_EXT);

    const build = {
      id: slugify(rel.replace(/\.[^.]+$/, '')) || place.key,
      version: place.version,
      label: place.label,
      file: rel,
      path: urlPath('/games/', rel),
      bytes: stats.size,
      added: added[rel] || (place.made && `${place.made}T12:00:00.000Z`) || gitDates.get(rel) || stats.mtime.toISOString(),
      // Head details ride along only until the newest build is chosen.
      head: {
        name: titleName,
        tagline,
        description: info.description,
        themeColor: info.themeColor,
        icon,
        image: info.image && (await localAsset(rel, info.image, IMAGE_EXT)),
        hub: info.hub,
      },
    };
    added[rel] = build.added;

    if (!groups.has(place.key)) groups.set(place.key, { ...place, builds: [] });
    groups.get(place.key).builds.push(build);
  }

  const slugs = assignSlugs([...groups.values()]);

  const games = [];
  for (const [key, group] of groups) {
    const slug = slugs.get(key);
    const { builds } = group;
    // Newest first: by version when both have one, else by date added.
    builds.sort((a, b) => compareVersions(b.version, a.version) || b.added.localeCompare(a.added));

    const override = overrides[slug] || {};
    if (override.hidden === true) continue;

    const current = builds[0];
    const head = current.head;
    for (const build of builds) delete build.head;

    const dates = builds.map((b) => b.added).sort();
    const game = {
      slug,
      name: head.name || prettify(group.family),
      tagline: head.tagline,
      description: head.description,
      themeColor: head.themeColor,
      icon: head.icon,
      cover: strips.has(slug)
        ? strips.get(slug).cover
        : covers.has(slug)
          ? urlPath('/covers/', covers.get(slug).file)
          : head.image || null,
      ...(strips.has(slug)
        ? { frames: strips.get(slug).frames, frameLabel: strips.get(slug).frameLabel }
        : {}),
      path: current.path,
      version: current.version,
      bytes: current.bytes,
      weight: weightClass(current.bytes),
      collection: group.collection ? prettify(group.collection) : undefined,
      added: dates[0],
      updated: dates[dates.length - 1],
      buildCount: builds.length,
      builds,
      // hub:* meta from the game's own head, then data/overrides.json on top.
      ...head.hub,
      ...override,
    };
    delete game.hidden;
    for (const [field, value] of Object.entries(game)) {
      if (value === undefined || value === null || value === '') delete game[field];
    }
    if (Array.isArray(game.tags)) game.tags = game.tags.map(String).filter(Boolean);
    games.push(game);
  }

  games.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const manifest = {
    version: MANIFEST_VERSION,
    generatedAt: nowIso,
    gameCount: games.length,
    buildCount: games.reduce((n, g) => n + g.buildCount, 0),
    totalBytes: games.reduce((n, g) => n + g.builds.reduce((m, b) => m + b.bytes, 0), 0),
    games,
  };

  await writeFile(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  // Best effort: keeps real "date added" values working after a fresh clone.
  const addedText = JSON.stringify(sortKeys(added), null, 2) + '\n';
  if (addedText !== JSON.stringify(sortKeys(addedRaw), null, 2) + '\n') {
    try {
      await writeFile(ADDED_FILE, addedText, 'utf8');
    } catch {
      /* read-only checkout — games.json still has usable dates */
    }
  }

  if (!quiet) report(manifest, notes, { list });
  return manifest;
}

const sortKeys = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

export const mb = (n) => (n / MB).toFixed(1) + ' MB';

function report(manifest, notes, { list }) {
  const { games } = manifest;
  const collections = new Set(games.map((g) => g.collection).filter(Boolean));
  const projects = games.filter((g) => /\/index\.html?$/i.test(g.path)).length;
  const extra = [
    collections.size && `${collections.size} collection${collections.size === 1 ? '' : 's'}`,
    projects && `${projects} multi-file project${projects === 1 ? '' : 's'}`,
  ].filter(Boolean);

  console.log(
    `\n  ai-hub  ${manifest.gameCount} games / ${manifest.buildCount} builds / ${mb(manifest.totalBytes)}` +
      (extra.length ? `  (${extra.join(', ')})` : '') +
      '\n'
  );

  // Four games read well as a list; four hundred are a wall of text in a build log.
  if (list || games.length <= 40) {
    for (const game of games) {
      const builds = game.buildCount > 1 ? `  (${game.buildCount} builds)` : '';
      const swatch = game.themeColor || '--------';
      console.log(`  ${swatch}  ${game.name.slice(0, 24).padEnd(24)} ${(game.tagline || '').slice(0, 44)}${builds}`);
    }
    console.log('');
  }

  const warn = (text) => console.log(`  ! ${text}`);
  for (const line of notes.skipped) warn(`skipped ${line}`);
  for (const { rel, bytes } of notes.big) {
    warn(
      `games/${rel} is ${mb(bytes)} — ` +
        (bytes >= REFUSE_BYTES ? 'GitHub will refuse to push a file over 100 MB' : 'GitHub warns above 50 MB')
    );
  }
  for (const { rel, refs } of notes.rootRefs) {
    const shown = refs.slice(0, 2).join(', ') + (refs.length > 2 ? `, +${refs.length - 2} more` : '');
    warn(`games/${rel} loads ${shown} from the site root, which will 404 inside the hub — build it with a relative base, or re-import it with \`pnpm ingest\``);
  }

  const noted = [];
  const multi = notes.projectPages.filter((p) => p.pages >= 3);
  if (multi.length) {
    noted.push(
      `${multi.length} project folder${multi.length === 1 ? ' holds' : 's hold'} extra .html pages, treated as part of the project, not as games: ` +
        multi.slice(0, 3).map((p) => `games/${path.posix.dirname(p.rel)}/`).join(', ') +
        (multi.length > 3 ? ', …' : '') +
        '  (rename its index.html if they are really separate games)'
    );
  }
  if (notes.bigIcons) noted.push(`${notes.bigIcons} inline favicon${notes.bigIcons === 1 ? '' : 's'} over 32 KB left out of the manifest; the generated art stands in`);
  const noColor = games.filter((g) => !g.themeColor).length;
  if (noColor) noted.push(`${noColor} without a theme-color; their art uses a colour derived from the slug`);
  for (const line of noted) console.log(`  · ${line}`);
  if (notes.skipped.length || notes.big.length || notes.rootRefs.length || noted.length) console.log('');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scan.mjs')) {
  scan({ quiet: process.argv.includes('--quiet'), list: process.argv.includes('--list') }).catch((err) => {
    console.error('scan failed:', err);
    process.exit(1);
  });
}
