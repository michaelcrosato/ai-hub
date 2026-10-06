#!/usr/bin/env node
/**
 * fill.mjs — which games use the whole screen, and which sit in a box?
 *
 * Opens each game at three landscape windows — 16:9 (1600×900), 21:9
 * (2100×900) and 4:3 (1200×900) — and grades it with scripts/lib/fill.mjs:
 *
 *   fills   the canvas (or svg, video, image) covers the window
 *   panels  no single surface does, but the layout reaches every edge
 *   boxed   the game sits in a smaller frame — fix it
 *
 * and flags "bars" when the screenshot has flat strips on two opposite edges,
 * which is a canvas that fills the window but letterboxes the picture in it.
 * Uncaught page errors are listed too, so a layout fix that breaks a game shows.
 *
 * Like shots.mjs, it needs Playwright, which ai-hub does not install:
 *
 *   pnpm add -D playwright && pnpm exec playwright install chromium
 *
 * Usage:  node scripts/fill.mjs [match …] [--play] [--shots <dir>] [--json] [--jobs 4]
 *   match    only games whose slug or path contains this text
 *   --play   press Enter and click before measuring, to get past a title screen
 *   --shots  write <dir>/<slug>-wide.jpg, -ultra.jpg and -square.jpg to look at
 *   --json   machine-readable report
 *
 * Exit code 1 when any game is boxed.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { scan, pool, ROOT } from './scan.mjs';
import { staticHandler } from './lib/serve.mjs';
import { measurePage, grade, gradeView, hasBars } from './lib/fill.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at !== -1 && argv[at + 1] ? argv[at + 1] : fallback;
};
const valued = new Set(['--shots', '--jobs']);
const KNOWN = new Set([...valued, '--play', '--json', '--help']);
const unknown = argv.filter((a) => a.startsWith('--') && !KNOWN.has(a));
if (argv.includes('--help') || unknown.length) {
  // A typo'd flag would otherwise leave no match text and check every game.
  if (unknown.length) console.error(`  Unknown option: ${unknown.join(' ')}`);
  console.error('  Usage: node scripts/fill.mjs [match …] [--play] [--shots <dir>] [--json] [--jobs 4]');
  process.exit(unknown.length ? 2 : 0);
}
const MATCH = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1])).map((a) => a.toLowerCase());
const PLAY = argv.includes('--play');
const JSON_OUT = argv.includes('--json');
const SHOTS = flag('shots', null);
const JOBS = Math.max(1, Number(flag('jobs', 4)) || 4);
const SETTLE = 3000;

// Landscape screens from a 4:3 tablet to a 21:9 monitor. Portrait phones are
// left out: a side-scroller cannot sensibly fill a tall screen.
const VIEWS = { wide: { width: 1600, height: 900 }, ultra: { width: 2100, height: 900 }, square: { width: 1200, height: 900 } };

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('\n  fill.mjs needs Playwright:  pnpm add -D playwright && pnpm exec playwright install chromium\n');
  process.exit(1);
}

const manifest = await scan({ quiet: true });
const games = manifest.games.filter(
  (g) => !MATCH.length || MATCH.some((m) => g.slug.includes(m) || g.builds[0].path.toLowerCase().includes(m))
);
if (!games.length) {
  console.error('  No games match.');
  process.exit(1);
}
if (SHOTS) await mkdir(path.resolve(SHOTS), { recursive: true });

const server = createServer(staticHandler(ROOT));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
// A game can take the whole browser down with it; when that happens the next
// page relaunches it, so one crash costs one game rather than the run.
let session = null;
let opening = null;
async function open() {
  const browser = await chromium.launch();
  const contexts = {};
  for (const [k, viewport] of Object.entries(VIEWS)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    // Only the local server answers. A request that cannot complete (a web
    // font, a CDN script) fails at once rather than holding up the load event
    // and the page's fonts.
    await context.route('**', (route) =>
      route.request().url().startsWith(origin) || route.request().url().startsWith('data:') ? route.continue() : route.abort()
    );
    // Headless WebGPU is unreliable; hiding it sends three.js down its WebGL 2
    // path, so 3D games actually draw and the bars check has pixels to read.
    await context.addInitScript(() => {
      try {
        delete Object.getPrototypeOf(navigator).gpu;
      } catch {
        /* nothing to hide */
      }
    });
    contexts[k] = context;
  }
  const helper = await (await browser.newContext()).newPage();
  return { browser, contexts, helper };
}
const ready = async () => {
  if (session?.browser.isConnected()) return session;
  opening ??= open()
    .then((s) => (session = s))
    .finally(() => (opening = null));
  return opening;
};

/**
 * A screenshot straight from DevTools. page.screenshot() waits for fonts and
 * a settled frame, and a busy WebGL game under load can starve that for good.
 */
async function capture(page, format) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const shot = cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 60 : undefined });
    const late = new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot timed out after 60s')), 60_000).unref());
    const { data } = await Promise.race([shot, late]);
    return Buffer.from(data, 'base64');
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/** Mean and spread of the outer strips and the middle of a screenshot. */
const strips = (helper, png, axis) =>
  helper.evaluate(
    async ({ b64, axis }) => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const W = img.width;
      const H = img.height;
      const d = g.getImageData(0, 0, W, H).data;
      const stat = (x0, y0, x1, y1) => {
        let n = 0;
        const s = [0, 0, 0];
        const s2 = [0, 0, 0];
        for (let y = y0; y < y1; y += 3)
          for (let x = x0; x < x1; x += 3) {
            const i = (y * W + x) * 4;
            for (let k = 0; k < 3; k++) {
              s[k] += d[i + k];
              s2[k] += d[i + k] ** 2;
            }
            n++;
          }
        const mean = s.map((v) => v / n);
        return { mean, sd: Math.sqrt(s2.reduce((acc, v, k) => acc + v / n - mean[k] ** 2, 0) / 3) };
      };
      const f = 0.04;
      const [a, b] =
        axis === 'x'
          ? [stat(0, 0, Math.floor(W * f), H), stat(Math.floor(W * (1 - f)), 0, W, H)]
          : [stat(0, 0, W, Math.floor(H * f)), stat(0, Math.floor(H * (1 - f)), W, H)];
      return { a, b, mid: stat(Math.floor(W * 0.3), Math.floor(H * 0.3), Math.floor(W * 0.7), Math.floor(H * 0.7)) };
    },
    { b64: png.toString('base64'), axis }
  );

const rows = [];
await pool(games, JOBS, async (game) => {
  const row = { slug: game.slug, path: game.builds[0].path, views: {} };
  for (const k of Object.keys(VIEWS)) {
    const errors = [];
    let page = null;
    try {
      const { contexts, helper } = await ready();
      page = await contexts[k].newPage();
      page.on('pageerror', (error) => errors.push(error.message.split('\n')[0]));
      // Some heavy games take minutes to fire 'load' headless; the layout is
      // set long before that, so the full load is only waited on briefly.
      await page.goto(origin + row.path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(SETTLE);
      if (PLAY) {
        await page.keyboard.press('Enter');
        await page.mouse.click(VIEWS[k].width / 2, VIEWS[k].height / 2);
        await page.keyboard.press('Space');
        await page.waitForTimeout(1500);
      }
      const m = await page.evaluate(measurePage);
      const png = await capture(page, 'png');
      m.bars = hasBars(await strips(helper, png, 'x')) || hasBars(await strips(helper, png, 'y'));
      if (SHOTS) await writeFile(path.join(SHOTS, `${game.slug}-${k}.jpg`), await capture(page, 'jpeg'));
      m.errors = errors;
      row.views[k] = m;
    } catch (error) {
      row.views[k] = { error: error.message.split('\n')[0] };
    } finally {
      await page?.close().catch(() => {});
    }
  }
  row.verdict = grade(row.views);
  row.bars = Object.values(row.views).some((m) => m.bars);
  row.errors = [...new Set(Object.values(row.views).flatMap((m) => m.errors ?? []))];
  rows.push(row);
});
await session?.browser.close().catch(() => {});
server.close();

rows.sort((a, b) => a.slug.localeCompare(b.slug));
if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 1));
} else {
  const pct = (box) => (box ? `${Math.round(box.x * 100)}×${Math.round(box.y * 100)}` : '—');
  for (const r of rows) {
    if (r.verdict === 'fills' && !r.bars && !r.errors.length && MATCH.length === 0) continue;
    const views = Object.entries(r.views)
      .map(([k, m]) => (m.error ? `${k} error (${m.error})` : `${k} ${gradeView(m)} surface ${pct(m.surface)} paint ${pct(m.paint)}`))
      .join('  |  ');
    console.log(`  ${r.verdict.padEnd(6)}${r.bars ? ' bars' : '     '}  ${r.slug}\n          ${views}`);
    for (const e of r.errors) console.log(`          page error: ${e}`);
  }
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  console.log(
    `\n  ${rows.length} games: ${count('fills')} fill, ${count('panels')} panels, ${count('boxed')} boxed` +
      (count('error') ? `, ${count('error')} errors` : '') +
      `; ${rows.filter((r) => r.bars).length} with possible letterbox bars.\n`
  );
}
process.exit(rows.some((r) => r.verdict === 'boxed') ? 1 : 0);
