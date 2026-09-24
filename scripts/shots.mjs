#!/usr/bin/env node
/**
 * shots.mjs — optional cover screenshots.
 *
 * Every game already gets procedural art, so this is never required. Run it
 * when you would rather see the real thing: it opens each game, waits for the
 * title screen to settle, and writes covers/<slug>.jpg, which the scanner then
 * prefers over the generated art.
 *
 * Playwright is deliberately NOT a dependency of this project — installing it
 * pulls a browser down. Add it only if you want this:
 *
 *   pnpm add -D playwright && pnpm exec playwright install chromium
 *   pnpm shots
 *
 * Games are loaded over a local HTTP server rather than file://, because a
 * multi-file project using ES modules or fetch() will not start from disk.
 *
 * Usage:  node scripts/shots.mjs [--all] [--only <slug>] [--wait 2500] [--jobs 4]
 *   --all    re-shoot games that already have a cover
 *   --only   just one game, by slug
 *   --wait   ms to let the game settle before the shutter (default 2500)
 *   --jobs   games shot at once (default 4)
 */

import { readFile, access, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { scan, pool, ROOT } from './scan.mjs';
import { staticHandler } from './lib/serve.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at !== -1 && argv[at + 1] ? argv[at + 1] : fallback;
};
const ALL = argv.includes('--all');
const ONLY = flag('only', null);
const SETTLE = Number(flag('wait', 2500));
const JOBS = Math.max(1, Number(flag('jobs', 4)) || 4);

const COVERS = path.join(ROOT, 'covers');
const VIEWPORT = { width: 960, height: 720 };

const exists = (file) => access(file).then(() => true, () => false);

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    console.error(
      '\n  Screenshots need Playwright, which ai-hub does not install by default.\n' +
        '  The wall works fine without it — every game already has generated art.\n\n' +
        '    pnpm add -D playwright && pnpm exec playwright install chromium\n'
    );
    process.exit(1);
  }
}

const { chromium } = await loadPlaywright();

const manifest = await scan({ quiet: true });
const targets = manifest.games.filter((game) => !ONLY || game.slug === ONLY);

if (!targets.length) {
  console.error(ONLY ? `  No game with slug "${ONLY}".` : '  No games in games/ yet.');
  process.exit(1);
}

await mkdir(COVERS, { recursive: true });

const server = createServer(staticHandler(ROOT));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });

let shot = 0;
let skipped = 0;
let failed = 0;

await pool(targets, JOBS, async (game) => {
  const out = path.join(COVERS, `${game.slug}.jpg`);
  if (!ALL && (game.cover || (await exists(out)))) {
    skipped++;
    return;
  }

  const page = await context.newPage();
  try {
    await page.goto(origin + game.builds[0].path, { waitUntil: 'load', timeout: 60_000 });
    // networkidle is best-effort: a game running an animation loop never idles.
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(SETTLE);
    await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
    const size = (await readFile(out)).byteLength;
    console.log(`  shot  ${game.name.slice(0, 26).padEnd(26)} ${Math.round(size / 1024)} KB`);
    shot++;
  } catch (error) {
    console.warn(`  skip  ${game.name.slice(0, 26).padEnd(26)} ${error.message.split('\n')[0]}`);
    failed++;
  } finally {
    await page.close();
  }
});

await browser.close();
server.close();

console.log(
  `\n  ${shot} shot, ${skipped} already had a cover` +
    (failed ? `, ${failed} failed` : '') +
    '.' +
    (skipped && !ALL ? '  Use --all to redo them.' : '') +
    '\n  Covers are picked up on the next scan.\n'
);
