#!/usr/bin/env node
/**
 * scan.mjs — the one thing that makes this hub dynamic.
 *
 * Walks games/, reads only the <head> of each file, and writes data/games.json.
 * This runs as the Vercel build command, so adding game #101 is `git add` and
 * nothing else. It never writes to a game file.
 *
 * Usage:  node scripts/scan.mjs [--quiet]
 */

import { readdir, stat, readFile, writeFile, open } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseHead,
  splitTitle,
  slugify,
  parseVersion,
  compareVersions,
  weightClass,
} from './lib/parse.mjs';

const run = promisify(execFile);

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = path.join(ROOT, 'games');
const COVERS_DIR = path.join(ROOT, 'covers');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(DATA_DIR, 'games.json');
const ADDED_FILE = path.join(DATA_DIR, 'added.json');
const OVERRIDES_FILE = path.join(DATA_DIR, 'overrides.json');

const HEAD_BYTES = 256 * 1024;
const GAME_EXT = new Set(['.html', '.htm']);
const COVER_EXT = ['.png', '.webp', '.avif', '.jpg', '.jpeg', '.gif', '.svg'];
const MANIFEST_VERSION = 1;

const urlPath = (prefix, rel) =>
  prefix + rel.split(/[\\/]/).map(encodeURIComponent).join('/');

const prettify = (s) =>
  s
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Recursively collect game files. `_`- and `.`-prefixed directories are skipped. */
async function walk(dir, base = dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walk(abs, base)));
    } else if (GAME_EXT.has(path.extname(entry.name).toLowerCase())) {
      found.push({ abs, rel: path.relative(base, abs).split(path.sep).join('/') });
    }
  }
  return found;
}

/** Read only the leading bytes — one of these files is 10 MB and the head is in the first 2 KB. */
async function readLeadingBytes(file, bytes) {
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}

/**
 * First-commit dates per file. File mtimes are worthless here: `git clone` on
 * Vercel stamps every file with the checkout time. Vercel's clone is shallow,
 * so this quietly yields nothing there and we fall back to data/added.json.
 */
async function gitAddedDates() {
  const dates = new Map();
  try {
    const { stdout } = await run(
      'git',
      ['log', '--diff-filter=A', '--reverse', '--name-only', '--format=%x00%aI', '--', 'games'],
      { cwd: ROOT, maxBuffer: 32 * 1024 * 1024, timeout: 20_000 }
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
    // No git, no commits yet, or a shallow clone. Not an error.
  }
  return dates;
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

/** Work out which game a file belongs to, and which build of it this is. */
function classify(rel) {
  const dir = path.posix.dirname(rel);
  const stem = path.basename(rel, path.extname(rel));
  const parsed = parseVersion(stem);

  if (dir && dir !== '.') {
    // games/void-explorer/v0.5.html — the folder names the game.
    const family = dir.split('/').pop();
    return {
      family,
      version: parsed.version,
      buildLabel: parsed.version ? `v${parsed.version}` : prettify(stem),
    };
  }
  // games/Void-Explorer-AURORA-v0.4.html — the filename carries both.
  const family = parsed.base || stem;
  return {
    family,
    version: parsed.version,
    buildLabel: parsed.version ? `v${parsed.version}` : 'build',
  };
}

export async function scan({ quiet = false } = {}) {
  const files = await walk(GAMES_DIR);
  const [gitDates, covers, overridesRaw, addedRaw] = await Promise.all([
    gitAddedDates(),
    coverIndex(),
    readJson(OVERRIDES_FILE, {}),
    readJson(ADDED_FILE, {}),
  ]);

  const overrides = { ...overridesRaw };
  delete overrides._readme;
  // Seeded from what is on disk now, so a game you delete stops being recorded
  // instead of accumulating forever.
  const known = new Set(files.map((f) => f.rel));
  const added = Object.fromEntries(Object.entries(addedRaw).filter(([rel]) => known.has(rel)));
  const nowIso = new Date().toISOString();

  const families = new Map();
  const usedSlugs = new Map();

  for (const { abs, rel } of files) {
    let info;
    let stats;
    try {
      [info, stats] = await Promise.all([
        readLeadingBytes(abs, HEAD_BYTES).then(parseHead),
        stat(abs),
      ]);
    } catch (err) {
      console.warn(`  ! skipped games/${rel}: ${err.message}`);
      continue;
    }

    const { family, version, buildLabel } = classify(rel);
    const { name: titleName, tagline } = splitTitle(info.title);

    // Slugs are stable per family and deduped so two families never collide.
    let familySlug = slugify(family) || slugify(rel) || 'game';
    if (!families.has(familySlug)) {
      const claimedBy = usedSlugs.get(familySlug);
      if (claimedBy !== undefined && claimedBy !== family) {
        let n = 2;
        while (families.has(`${familySlug}-${n}`)) n++;
        familySlug = `${familySlug}-${n}`;
      }
      usedSlugs.set(familySlug, family);
    }

    const build = {
      id: slugify(rel.replace(/\.[^.]+$/, '')) || familySlug,
      version,
      label: buildLabel,
      file: rel,
      path: urlPath('/games/', rel),
      bytes: stats.size,
      weight: weightClass(stats.size),
      added: gitDates.get(rel) || added[rel] || stats.mtime.toISOString(),
      title: info.title,
      name: titleName || prettify(family),
      tagline,
      description: info.description,
      themeColor: info.themeColor,
      icon: info.icon,
      lang: info.lang,
      hub: info.hub,
    };
    added[rel] = build.added;

    if (!families.has(familySlug)) families.set(familySlug, { family, builds: [] });
    families.get(familySlug).builds.push(build);
  }

  const games = [];
  for (const [slug, { family, builds }] of families) {
    // Newest first: by version when both have one, else by date added.
    builds.sort((a, b) => {
      const byVersion = compareVersions(b.version, a.version);
      if (byVersion !== 0) return byVersion;
      return b.added.localeCompare(a.added);
    });

    const current = builds[0];
    const override = overrides[slug] || {};
    if (override.hidden === true) continue;

    const dates = builds.map((b) => b.added).sort();
    const game = {
      slug,
      name: current.name || prettify(family),
      tagline: current.tagline,
      description: current.description,
      themeColor: current.themeColor,
      icon: current.icon,
      cover: covers.has(slug) ? urlPath('/covers/', covers.get(slug).file) : null,
      path: current.path,
      version: current.version,
      bytes: current.bytes,
      weight: current.weight,
      added: dates[0],
      updated: dates[dates.length - 1],
      buildCount: builds.length,
      builds,
      // hub:* meta from the game's own head, then data/overrides.json on top.
      ...current.hub,
      ...override,
    };
    delete game.hidden;
    if (Array.isArray(game.tags)) game.tags = game.tags.map(String).filter(Boolean);

    game.search = [game.name, game.tagline, game.description, game.slug, game.model, game.harness]
      .concat(game.tags || [])
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

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
  try {
    await writeFile(ADDED_FILE, JSON.stringify(sortKeys(added), null, 2) + '\n', 'utf8');
  } catch {
    /* read-only checkout — games.json still has usable dates */
  }

  if (!quiet) report(manifest);
  return manifest;
}

const sortKeys = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

function report(manifest) {
  const mb = (n) => (n / (1024 * 1024)).toFixed(1) + ' MB';
  console.log(`\n  ai-hub  ${manifest.gameCount} games / ${manifest.buildCount} builds / ${mb(manifest.totalBytes)}\n`);
  for (const game of manifest.games) {
    const builds = game.buildCount > 1 ? `  (${game.buildCount} builds)` : '';
    const swatch = game.themeColor || '--------';
    console.log(`  ${swatch}  ${game.name.padEnd(24)} ${(game.tagline || '').slice(0, 44)}${builds}`);
  }
  const noColor = manifest.games.filter((g) => !g.themeColor);
  if (noColor.length) {
    console.log(`\n  note: ${noColor.length} without a theme-color; their art falls back to a slug-derived palette.`);
  }
  console.log('');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scan.mjs')) {
  scan({ quiet: process.argv.includes('--quiet') }).catch((err) => {
    console.error('scan failed:', err);
    process.exit(1);
  });
}
