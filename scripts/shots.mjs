#!/usr/bin/env node
/**
 * shots.mjs — candidate screenshot strips for games that have none.
 *
 * A strip is covers/<slug>/0.jpg, 1.jpg and 2.jpg: 640×480 JPEG at quality 58
 * (STRIP_ENCODE in scan.mjs), frame 0 the title. This opens each game without
 * one in a 960×720 window, takes the title once it settles, presses Enter and
 * takes frame 1, then plays a few generic keys (arrows, WASD, Space) and takes
 * frame 2. Games differ, so these are candidates: look at them before
 * committing, and replace a loading, blank or error frame with a better one
 * (README, *Before publishing an import*). A strip is written whole or not at
 * all, so a crash never leaves half of one.
 *
 * Playwright is deliberately NOT a dependency of this project — installing it
 * pulls a browser down. Add it only if you want this:
 *
 *   pnpm add -D playwright && pnpm exec playwright install chromium
 *   pnpm shots
 *
 * Games are loaded over a local HTTP server rather than file://, because a
 * multi-file project using ES modules or fetch() will not start from disk.
 * A game that needs WebGPU draws nothing without a GPU; shoot it in a
 * browser that has one.
 *
 * Usage:  node scripts/shots.mjs [--all] [--only <slug>] [--wait 2500] [--jobs 4]
 *   --all    re-shoot games that already have a strip
 *   --only   just one game, by slug
 *   --wait   ms to let the game settle before each frame (default 2500)
 *   --jobs   games shot at once (default 4)
 */

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { scan, pool, ROOT, STRIP_ENCODE } from './scan.mjs';
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
// The window games are played in, drawn at the strip's size: 960×720 at 2/3 is 640×480.
const VIEWPORT = { width: 960, height: 720 };
const SCALE = STRIP_ENCODE.width / VIEWPORT.width;

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
const targets = manifest.games.filter((game) => (ONLY ? game.slug === ONLY : ALL || !game.frames));
if (!targets.length) {
  console.error(ONLY ? `  No game with slug "${ONLY}".` : '  Every game already has a strip (--all shoots them again).');
  process.exit(ONLY ? 1 : 0);
}

const server = createServer(staticHandler(ROOT));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
const frame = (page) => page.screenshot({ type: 'jpeg', quality: STRIP_ENCODE.quality });

async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

let shot = 0;
let failed = 0;

await pool(targets, JOBS, async (game) => {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message.split('\n')[0]));
  try {
    await page.goto(origin + game.builds[0].path, { waitUntil: 'load', timeout: 60_000 });
    // networkidle is best-effort: a game running an animation loop never idles.
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(SETTLE);
    const frames = [await frame(page)];
    await page.keyboard.press('Enter');
    await page.waitForTimeout(SETTLE);
    frames.push(await frame(page));
    for (const key of ['ArrowUp', 'KeyW', 'ArrowRight', 'KeyD']) await hold(page, key, 400);
    await page.keyboard.press('Space');
    await page.waitForTimeout(SETTLE);
    frames.push(await frame(page));

    const dir = path.join(COVERS, game.slug);
    const fresh = `${dir}.new`;
    await rm(fresh, { recursive: true, force: true });
    await mkdir(fresh, { recursive: true });
    await Promise.all(frames.map((data, i) => writeFile(path.join(fresh, `${i}.jpg`), data)));
    await rm(dir, { recursive: true, force: true });
    await rename(fresh, dir);
    const note = errors.length ? `  (page error: ${errors[0].slice(0, 60)})` : '';
    console.log(`  shot  ${game.name.slice(0, 26).padEnd(26)} covers/${game.slug}/${note}`);
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
  `\n  ${shot} strip${shot === 1 ? '' : 's'} written` +
    (failed ? `, ${failed} failed` : '') +
    '. Look at them before committing: they are picked up on the next scan.\n'
);
