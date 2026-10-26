#!/usr/bin/env node
/**
 * session-browser.mjs — a whole session in one browser, end to end.
 *
 * Four tabs join /session on the local transport and play three rounds of the
 * reference games: one player never readies in round 1, the host closes its
 * tab in the middle of round 2 (void: the round dies with its host, and the
 * next seat takes over), and round 3 is played by the three who are left.
 * Needs Playwright, which is not a dependency (see shots.mjs).
 *
 * Usage:  node scripts/session-browser.mjs [site URL]
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { staticHandler } from './lib/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');

let base = process.argv[2]?.replace(/\/$/, '');
let server = null;
if (!base) {
  server = createServer(staticHandler(ROOT));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: 'reduce' });
// Only the two reference games: the library itself has none in sessions yet.
await context.route('**/data/games.json', (route) => route.fulfill({ json: { games: [] } }));
const errors = [];
const pages = {};
const url = (seat) => `${base}/session/?transport=local&as=${seat}&examples=1&limit=12&ready=8&results=3#e2e`;
const session = (page) => page.evaluate(() => window.__session);
const log = (text) => console.log(`${(performance.now() / 1000).toFixed(1).padStart(6)}s  ${text}`);

async function waitFor(page, test, arg, timeout = 30_000) {
  await page.waitForFunction(test, arg, { timeout, polling: 200 });
}

/** Click into the game (the ready gesture), once its frame has loaded the game. */
async function ready(page) {
  const frame = page.frameLocator('.player__frame');
  await frame.locator('canvas').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_200);
  await frame.locator('canvas').click({ position: { x: 200, y: 200 } });
}

async function play(list, ms) {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const page of list) await page.keyboard.press(keys[Math.floor(Math.random() * keys.length)]).catch(() => {});
    await new Promise((r) => setTimeout(r, 150));
  }
}

const phaseIs = (p) => window.__session?.state?.phase === p;

try {
  for (const seat of [1, 2, 3, 4]) {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`seat ${seat}: ${e.message}`));
    await page.goto(url(seat));
    pages[seat] = page;
  }
  for (const seat of [1, 2, 3, 4]) {
    await waitFor(pages[seat], (n) => window.__session?.seat === n - 1 && document.body.dataset.phase === 'lobby', seat);
  }
  await waitFor(pages[4], () => document.querySelectorAll('.seat:not(.is-empty)').length === 4);
  assert.equal((await session(pages[1])).state.host, 'seat1');
  log('four seats taken; seat 1 hosts');

  // Round 1: seat 4 never readies and sits out.
  await pages[1].click('#start');
  for (const seat of [1, 2, 3, 4]) await waitFor(pages[seat], () => document.querySelector('.player__frame'));
  await Promise.all([1, 2, 3].map((seat) => ready(pages[seat])));
  await waitFor(pages[1], () => ['countdown', 'playing'].includes(window.__session?.status?.phase), null, 20_000);
  log(`round 1 started without seat 4: ${(await session(pages[1])).state.current.name}`);
  await play([pages[1], pages[2], pages[3]], 5_000);
  await waitFor(pages[2], phaseIs, 'results', 40_000);
  let state = (await session(pages[2])).state;
  const r1 = state.history[0];
  assert.equal(r1.status, 'played', `round 1 was ${r1.status} (${r1.reason})`);
  assert.equal(r1.rows.find((row) => row.key === 'seat4').out, 'not-ready');
  assert.equal(r1.rows.find((row) => row.key === 'seat4').points, 0);
  log(`round 1 played: ${r1.rows.map((row) => `${row.name} +${row.points}`).join(', ')}`);

  // Round 2: everyone readies; the host closes its tab mid-round.
  await waitFor(pages[2], phaseIs, 'round', 15_000);
  await Promise.all([1, 2, 3, 4].map((seat) => ready(pages[seat])));
  await waitFor(pages[1], () => ['countdown', 'playing'].includes(window.__session?.status?.phase), null, 20_000);
  await play([pages[2], pages[3], pages[4]], 2_000);
  log(`round 2 under way (${(await session(pages[2])).state.current.name}); the host leaves`);
  await pages[1].close();
  delete pages[1];
  await waitFor(pages[2], () => (window.__session?.state?.history.length ?? 0) >= 2, null, 20_000);
  state = (await session(pages[2])).state;
  assert.equal(state.host, 'seat2', 'the next seat took over');
  assert.equal(state.history[1].status, 'void');
  assert.equal(state.history[1].reason, 'host-left');
  log('round 2 void (host-left); seat 2 hosts now');

  // Round 3: the three who are left.
  await waitFor(pages[2], phaseIs, 'round', 15_000);
  state = (await session(pages[2])).state;
  assert.deepEqual(state.current.players.map((p) => p.key), ['seat2', 'seat3', 'seat4']);
  await Promise.all([2, 3, 4].map((seat) => ready(pages[seat])));
  await play([pages[2], pages[3], pages[4]], 5_000);
  await waitFor(pages[3], () => (window.__session?.state?.history.length ?? 0) >= 3, null, 40_000);
  state = (await session(pages[3])).state;
  assert.equal(state.history[2].status, 'played', `round 3 was ${state.history[2].status} (${state.history[2].reason})`);
  log(`round 3 played: ${state.history[2].rows.map((row) => `${row.name} +${row.points}`).join(', ')}`);

  const totals = Object.values(state.totals);
  const points = totals.reduce((sum, row) => sum + row.points, 0);
  // Round 1: 4 players → 3+2+1+0 = 6 at most; round 3: 3 players → 3 at most. Ties lower it.
  assert.ok(points > 0 && points <= 9, `points add up (${points})`);
  await pages[2].locator('#results').getByRole('button', { name: 'End the session' }).click();
  for (const seat of [2, 3, 4]) await waitFor(pages[seat], () => document.body.dataset.phase === 'ended');
  assert.equal(await pages[4].locator('.table tbody tr').count(), 4);
  log('session ended; final table shown in every tab');
  assert.deepEqual(errors, []);
  console.log('session-browser: PASS');
} catch (error) {
  console.error('session-browser: FAIL');
  console.error(error);
  if (errors.length) console.error(errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server?.close();
}
