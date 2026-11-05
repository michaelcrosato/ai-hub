#!/usr/bin/env node
/**
 * release.mjs — publish the site to Cloudflare.
 *
 * Rebuilds data/games.json, stages exactly what the site serves into
 * .cache/release/site (hard links, so it costs no disk), and deploys that
 * folder with Wrangler. Wrangler uploads only files Cloudflare does not
 * already have, so a release after adding a few games sends a few files.
 *
 * Usage:  pnpm release            stage and deploy
 *         pnpm release --dry-run  stage and report, deploy nothing
 *         pnpm release --local    stage and serve it with Cloudflare's own
 *                                 runtime at http://127.0.0.1:8787
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, mkdirSync, rmSync, linkSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs';
import path from 'node:path';

import { scan, ROOT } from './scan.mjs';
import { HEADERS, VENDOR, partSizes, shelfClosure } from './lib/release.mjs';

const WRANGLER = 'wrangler@4.151.2';
const OUT = path.join(ROOT, '.cache/release/site');
// Cloudflare's per-deploy file limits: Workers Free, Workers Paid.
const LIMITS = [[20_000, 'Workers Free'], [100_000, 'Workers Paid']];
// Top-level entries that are the repo's, not the site's, and so is any
// top-level Markdown file (README.md, CLAUDE.md, a handoff note).
const PRIVATE = new Set(['cloudflare', 'docs', 'node_modules', 'scripts', 'supabase', 'package.json', 'pnpm-workspace.yaml']);
const isPrivate = (name) => PRIVATE.has(name) || /\.md$/i.test(name);
const TEXT = /\.(html?|m?js|css|json)$/i;

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const LOCAL = argv.includes('--local');

function walk(rel, out = []) {
  for (const entry of readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (!rel && isPrivate(child)) continue;
    if (entry.isDirectory()) walk(child, out);
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const kind = (rel) => {
  try {
    return statSync(path.join(ROOT, rel));
  } catch {
    return null;
  }
};
const fs = {
  isFile: (rel) => !!kind(rel)?.isFile(),
  isDir: (rel) => !!kind(rel)?.isDirectory(),
  list: (rel, { depth } = {}) =>
    depth === 1
      ? readdirSync(path.join(ROOT, rel), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `${rel.replace(/\/$/, '')}/${e.name}`)
      : walk(rel),
  read,
};

/** One unit per game (a top-level page or folder in games/), plus the site's own pages and scripts, read one at a time. */
function* units(files) {
  let key = null;
  let texts = null;
  for (const file of files) {
    if (!TEXT.test(file) || file.startsWith(VENDOR) || file.startsWith('covers/')) continue;
    const next = file.startsWith('games/') ? file.split('/').slice(0, 2).join('/') : 'site';
    if (next !== key) {
      if (texts) yield texts;
      key = next;
      texts = [];
    }
    texts.push(read(file));
  }
  if (texts) yield texts;
}

function stage(files) {
  rmSync(OUT, { recursive: true, force: true });
  const split = [];
  for (const file of files) {
    const from = path.join(ROOT, file);
    const to = path.join(OUT, file);
    mkdirSync(path.dirname(to), { recursive: true });
    const sizes = partSizes(statSync(from).size);
    if (!sizes) {
      linkSync(from, to);
      continue;
    }
    const fd = openSync(from, 'r');
    let at = 0;
    sizes.forEach((size, i) => {
      const buf = Buffer.alloc(size);
      readSync(fd, buf, 0, size, at);
      writeFileSync(`${to}.part${i}`, buf);
      at += size;
    });
    closeSync(fd);
    split.push(`${file} (${sizes.length} parts)`);
  }
  writeFileSync(path.join(OUT, '_headers'), HEADERS);
  return split;
}

await scan({ quiet: true });
// Site files first, games after: each unit's files then arrive together.
const all = walk('').sort((a, b) => (a.startsWith('games/') - b.startsWith('games/')) || (a < b ? -1 : a > b ? 1 : 0));
const shelf = all.filter((f) => f.startsWith(VENDOR));
const { files: reached, missing, skipped } = shelfClosure(units(all), fs);
// The shelf's own catalogue is tiny; keep it so a published page can read it.
const published = [...all.filter((f) => !f.startsWith(VENDOR)), ...reached, `${VENDOR}manifest.json`];
const split = stage(published);
const count = published.length + split.reduce((n, s) => n + Number(s.match(/\((\d+) parts/)[1]) - 1, 0) + 1;

console.log(`\n  staged      ${path.relative(ROOT, OUT)}`);
console.log(`  files       ${count.toLocaleString()}  (library shelf: ${reached.size.toLocaleString()} of ${shelf.length.toLocaleString()})`);
for (const s of split) console.log(`  split       ${s}`);
for (const s of skipped) console.log(`  not staged  ${s}  (a whole-folder reference; too broad to publish)`);
for (const m of missing) console.log(`  missing     ${m}  (referenced, not on the shelf: broken before publishing too)`);
const fits = LIMITS.find(([max]) => count <= max);
console.log(fits ? `  fits        ${fits[1]} (${fits[0].toLocaleString()} files)\n` : `  too many files for Cloudflare Workers (100,000)\n`);

if (DRY) process.exit(0);
if (!fits) process.exit(1);
const wrangler = spawnSync('npx', ['--yes', WRANGLER, LOCAL ? 'dev' : 'deploy', '--config', 'cloudflare/wrangler.jsonc'], {
  cwd: ROOT,
  stdio: 'inherit',
});
process.exit(wrangler.status ?? 1);
