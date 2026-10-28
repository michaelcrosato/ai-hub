#!/usr/bin/env node
/**
 * session-browser.mjs — a whole session in one browser, end to end.
 *
 * Four tabs join /session on the local transport and play the reference
 * games through the hub's splash:
 *   round 1: seat 4's game never loads, so it sits the round out; three seats
 *            ask for more time, which holds the countdown, two take it back,
 *            and the countdown runs out by itself;
 *   round 2: everyone presses Ready (a click, Enter, the controller's Cross),
 *            which starts it at once; then the host closes its tab (void: the
 *            round dies with its host, and the next seat takes over);
 *   round 3: the three who are left; Create + Options hands one tab's corner
 *            bar to the controller and Circle gives it back;
 *   round 4: the host's 🎲 skips it; in round 5 a guest's ✕ (held, then
 *            confirmed) leaves the session and the host's ✕ ends Random Mode,
 *            back to the lobby with the rounds kept, and the session ends.
 *
 * Then the same page across two separate browser contexts over the real
 * WebRTC mesh: this script stands in for Supabase Realtime (presence, control
 * and signalling) through ?transport=relay, so the game traffic and the clock
 * requests really travel peer to peer.
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

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  // Plain host candidates, so two contexts on one machine find each other.
  args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns'],
});
const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: 'reduce' });
// Only the two reference games.
await context.route('**/data/games.json', (route) => route.fulfill({ json: { games: [] } }));
// A standard gamepad each page can press (window.__pad), connected on its first press.
await context.addInitScript(() => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
  let plugged = false;
  window.__pad = {
    set(down) {
      plugged = true;
      for (const [i, v] of Object.entries(down)) Object.assign(buttons[i], { pressed: !!v, touched: !!v, value: v ? 1 : 0 });
      pad.timestamp = performance.now();
    },
  };
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [plugged ? pad : null, null, null, null] });
});
const errors = [];
const pages = {};
const SPLASH_S = 12;
const url = (seat) => `${base}/session?transport=local&as=${seat}&examples=1&limit=12&splash=${SPLASH_S}&grace=6&results=3#e2e`;
const session = (page) => page.evaluate(() => window.__session);
const log = (text) => console.log(`${(performance.now() / 1000).toFixed(1).padStart(6)}s  ${text}`);

async function waitFor(page, test, arg, timeout = 30_000) {
  await page.waitForFunction(test, arg, { timeout, polling: 200 });
}

/** The splash is up for a round on this tab. */
const onSplash = (page, round) =>
  waitFor(page, (r) => window.__session?.state?.current?.round === r && document.querySelector('.splash__ready') && !document.querySelector('#results').hidden, round, 30_000);

/** Press the splash's Ready: a click, the keyboard or the controller, and see it taken. */
async function ready(page, how = 'click') {
  if (how === 'click') await page.click('.splash__ready');
  else if (how === 'enter') {
    await page.focus('.splash__ready');
    await page.keyboard.press('Enter');
  } else await padPress(page, 0);
  await waitFor(page, () => document.querySelector('.splash__ready')?.textContent.startsWith('Ready ✓') || document.querySelector('#results').hidden, null, 3_000);
}

/** A press long enough to be seen by a page drawing slowly: four tabs of games share this machine. */
async function padPress(page, ...buttons) {
  await page.evaluate((b) => window.__pad.set(Object.fromEntries(b.map((i) => [i, 1]))), buttons);
  await page.waitForTimeout(600);
  await page.evaluate((b) => window.__pad.set(Object.fromEntries(b.map((i) => [i, 0]))), buttons);
  await page.waitForTimeout(80);
}

/** Hold a bar button with the mouse until its ring fills. */
async function hold(page, selector) {
  // The bar slides away when idle: wake it, and let it slide back in first.
  await page.mouse.move(40, 30);
  await page.mouse.move(30, 20);
  await page.waitForTimeout(500);
  const box = await page.locator(selector).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
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
const started = () => ['countdown', 'playing'].includes(window.__session?.status?.phase);
const splashOf = (s) => s.state.current?.splash;

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

  // Round 1: seat 4's game never loads; more time holds the countdown; it runs out by itself.
  await pages[4].route('**/lib/hub/examples/*', (route) => route.abort());
  await pages[1].click('#start');
  for (const seat of [1, 2, 3, 4]) await onSplash(pages[seat], 1);
  for (const seat of [1, 2, 3]) await pages[seat].click('.splash__more');
  await waitFor(pages[1], () => window.__session.state.current.splash.paused !== null, null, 5_000);
  await waitFor(pages[4], () => document.querySelector('.splash__count')?.textContent.startsWith('Paused'), null, 5_000);
  assert.match(await pages[4].textContent('.splash__note'), /asking for more time|A player needs more time/);
  assert.doesNotMatch(await pages[4].textContent('#results'), /Red|Blue|Green|Gold/, 'nobody is named');
  log('three of four asked for more time: the countdown holds');
  await pages[1].waitForTimeout(SPLASH_S * 1000 + 1_000);
  assert.equal(splashOf(await session(pages[1])).released, false, 'still held');
  for (const seat of [1, 2]) await pages[seat].click('.splash__more');
  await waitFor(pages[1], () => window.__session.state.current.splash.paused === null, null, 5_000);
  for (const seat of [1, 2, 3]) await ready(pages[seat]);
  log('two took it back: the countdown runs on, and runs out with seat 4 not ready');
  await waitFor(pages[1], () => window.__session.state.current.splash.released, null, 45_000);
  await waitFor(pages[1], started, null, 20_000);
  log(`round 1 started without seat 4: ${(await session(pages[1])).state.current.name}`);
  await pages[4].unroute('**/lib/hub/examples/*');
  await play([pages[1], pages[2], pages[3]], 5_000);
  await waitFor(pages[2], () => (window.__session?.state?.history.length ?? 0) >= 1, null, 40_000);
  let state = (await session(pages[2])).state;
  const r1 = state.history[0];
  assert.equal(r1.status, 'played', `round 1 was ${r1.status} (${r1.reason})`);
  assert.equal(r1.rows.find((row) => row.key === 'seat4').out, 'not-ready');
  assert.equal(r1.rows.find((row) => row.key === 'seat4').points, 0);
  log(`round 1 played: ${r1.rows.map((row) => `${row.name} +${row.points}`).join(', ')}`);

  // Round 2: everyone ready starts it at once; then the host closes its tab.
  for (const seat of [1, 2, 3, 4]) await onSplash(pages[seat], 2);
  await waitFor(pages[1], () => window.__session.state.current.splash.until - Date.now() > 6_000, null, 10_000);
  await ready(pages[1], 'click');
  await ready(pages[2], 'enter');
  await ready(pages[3], 'pad');
  await ready(pages[4], 'click');
  const s2 = await session(pages[1]);
  await waitFor(pages[1], () => window.__session.state.current.splash.released, null, 3_000);
  const left = splashOf(s2).until - Date.now();
  assert.ok(left > 0, 'the last Ready started the round before its countdown ran out');
  log(`round 2: all four ready (click, Enter, Cross, click), started with ${(left / 1000).toFixed(1)} s still on the clock`);
  await waitFor(pages[1], started, null, 20_000);
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

  // Round 3: the three who are left; Create + Options hands seat 3's bar to its controller.
  for (const seat of [2, 3, 4]) await onSplash(pages[seat], 3);
  state = (await session(pages[2])).state;
  assert.deepEqual(state.current.players.map((p) => p.key), ['seat2', 'seat3', 'seat4']);
  await Promise.all([2, 3, 4].map((seat) => ready(pages[seat])));
  await waitFor(pages[2], started, null, 20_000);
  await pages[3].evaluate(() => window.__pad.set({ 8: 1, 9: 1 }));
  await waitFor(pages[3], () => document.querySelector('#player').classList.contains('has-pad'), null, 10_000);
  await pages[3].evaluate(() => window.__pad.set({ 8: 0, 9: 0 }));
  assert.ok(await pages[3].evaluate(() => document.activeElement?.classList.contains('is-pad')), 'the controller is on a bar button');
  await padPress(pages[3], 1);
  await waitFor(pages[3], () => !document.querySelector('#player').classList.contains('has-pad'), null, 10_000);
  log('round 3: Create + Options gave the bar to the controller, Circle gave it back');
  await play([pages[2], pages[3], pages[4]], 5_000);
  await waitFor(pages[3], () => (window.__session?.state?.history.length ?? 0) >= 3, null, 40_000);
  state = (await session(pages[3])).state;
  assert.equal(state.history[2].status, 'played', `round 3 was ${state.history[2].status} (${state.history[2].reason})`);
  log(`round 3 played: ${state.history[2].rows.map((row) => `${row.name} +${row.points}`).join(', ')}`);

  // Round 4: the host's 🎲 skips it. Guests have none.
  for (const seat of [2, 3, 4]) await onSplash(pages[seat], 4);
  await Promise.all([2, 3, 4].map((seat) => ready(pages[seat])));
  await waitFor(pages[2], started, null, 20_000);
  assert.equal(await pages[3].locator('.player__roll').isHidden(), true, 'a guest has no 🎲');
  await pages[2].mouse.move(30, 20);
  await pages[2].click('.player__roll');
  await waitFor(pages[2], () => (window.__session?.state?.history.length ?? 0) >= 4, null, 10_000);
  assert.equal((await session(pages[2])).state.history[3].reason, 'skipped');
  log('round 4 skipped by the host’s 🎲');

  // Round 5: a guest's ✕ leaves; the host's ✕ ends Random Mode, back to the lobby.
  for (const seat of [2, 3, 4]) await onSplash(pages[seat], 5);
  await Promise.all([2, 3, 4].map((seat) => ready(pages[seat])));
  await waitFor(pages[2], started, null, 20_000);
  await hold(pages[4], '.player__close');
  await pages[4].waitForSelector('.player__ask');
  assert.match(await pages[4].textContent('.player__ask'), /Leave the session/);
  await Promise.all([pages[4].waitForURL(`${base}/`), pages[4].click('.player__ask-go')]);
  log('round 5: a guest held ✕ and left the session');
  await waitFor(pages[2], () => !Object.keys(window.__session.links).includes('seat4'), null, 10_000);
  // Rounds here last twelve seconds: if this one ended meanwhile, hold ✕ in the next.
  await waitFor(pages[2], () => ['countdown', 'playing'].includes(window.__session?.status?.phase) && document.querySelector('#results').hidden, null, 60_000);
  await hold(pages[2], '.player__close');
  await pages[2].waitForSelector('.player__ask');
  assert.match(await pages[2].textContent('.player__ask'), /End Random Mode/);
  await pages[2].click('.player__ask-go');
  for (const seat of [2, 3]) await waitFor(pages[seat], () => document.body.dataset.phase === 'lobby' && !document.querySelector('.player__frame'));
  state = (await session(pages[3])).state;
  assert.ok(state.history.length >= 4, 'the rounds so far are kept');
  assert.equal(state.history[0].status, 'played');
  assert.deepEqual([(await session(pages[2])).seat, (await session(pages[3])).seat], [1, 2], 'everyone keeps their seat');
  log(`the host held ✕: back to the lobby with ${state.history.length} rounds on the table`);

  const totals = Object.values(state.totals);
  const points = totals.reduce((sum, row) => sum + row.points, 0);
  // Round 1: 4 players → 3+2+1+0 = 6 at most; round 3: 3 players → 3 at most. Ties lower it.
  assert.ok(points > 0 && points <= 9, `points add up (${points})`);
  await pages[2].getByRole('button', { name: 'End the session' }).click();
  for (const seat of [2, 3]) await waitFor(pages[seat], () => document.body.dataset.phase === 'ended');
  assert.equal(await pages[3].locator('.table tbody tr').count(), 4);
  log('session ended; final table shown in every tab');
  await context.close();
  await meshSession();
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

/**
 * Two players in two browser contexts, joined by a relay this script runs:
 * presence and envelopes pass through Node, game traffic goes over WebRTC.
 */
async function meshSession() {
  const presence = new Map(); // key -> meta
  const members = new Map(); // key -> page
  const push = (page, msg) => page.evaluate((m) => window.__relayIn?.(m), msg).catch(() => {});
  const everyone = (msg, except) => {
    for (const [k, page] of members) if (k !== except) push(page, msg);
  };
  const list = () => [...presence.entries()].map(([key, meta]) => ({ ...meta, key }));
  const contexts = [];
  const pagesBySeat = {};
  for (const seat of [1, 2]) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 650 }, reducedMotion: 'reduce' });
    contexts.push(ctx);
    await ctx.route('**/data/games.json', (route) => route.fulfill({ json: { games: [] } }));
    await ctx.exposeBinding('__relayOut', (_source, msg) => {
      if (msg.op === 'track') {
        presence.set(msg.key, msg.meta);
        everyone({ op: 'presence', list: list() });
      } else if (msg.op === 'send') {
        everyone({ op: 'event', event: msg.event, payload: msg.payload }, msg.key);
      } else if (msg.op === 'leave') {
        presence.delete(msg.key);
        everyone({ op: 'presence', list: list() });
      }
    });
    await ctx.addInitScript(() => {
      window.__sessionRelay = (key) => {
        const handlers = {};
        let presenceFn = () => {};
        let last = [];
        window.__relayIn = (m) => {
          if (m.op === 'presence') presenceFn((last = m.list));
          else if (m.op === 'event') handlers[m.event]?.(m.payload);
        };
        return {
          track: (meta) => window.__relayOut({ op: 'track', key, meta }),
          onPresence: (fn) => {
            presenceFn = fn;
            fn(last);
          },
          send: (event, payload) => window.__relayOut({ op: 'send', key, event, payload }),
          on: (event, fn) => (handlers[event] = fn),
          close: () => window.__relayOut({ op: 'leave', key }),
        };
      };
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`mesh seat ${seat}: ${e.message}`));
    members.set(`seat${seat}`, page);
    await page.goto(`${base}/session?transport=relay&as=${seat}&examples=1&limit=10&splash=6&results=3#mesh`);
    pagesBySeat[seat] = page;
  }
  try {
    for (const seat of [1, 2]) {
      await waitFor(pagesBySeat[seat], (n) => window.__session?.seat === n - 1 && document.body.dataset.phase === 'lobby', seat);
    }
    const other = { 1: 'seat2', 2: 'seat1' };
    for (const seat of [1, 2]) {
      await waitFor(pagesBySeat[seat], (k) => window.__session?.links?.[k] === 'open', other[seat], 20_000);
    }
    log('mesh: two contexts connected peer to peer');
    await pagesBySeat[1].click('#start');
    for (const seat of [1, 2]) await onSplash(pagesBySeat[seat], 1);
    await Promise.all([1, 2].map((seat) => ready(pagesBySeat[seat])));
    await waitFor(pagesBySeat[1], () => ['countdown', 'playing'].includes(window.__session?.status?.phase), null, 20_000);
    log(`mesh: round 1 started (${(await session(pagesBySeat[1])).state.current.name})`);
    await play([pagesBySeat[1], pagesBySeat[2]], 2_000);
    // Read the traffic while the round runs: the next round's frame opens the moment it ends.
    for (const seat of [1, 2]) await waitFor(pagesBySeat[seat], () => window.__session?.traffic?.sent > 0 && window.__session.traffic.received > 0, null, 15_000);
    const during = await Promise.all([session(pagesBySeat[1]), session(pagesBySeat[2])]);
    for (const s of during) assert.ok(s.traffic.sent > 0 && s.traffic.received > 0, `game traffic both ways over the mesh: ${JSON.stringify(s.traffic)}`);
    await waitFor(pagesBySeat[2], () => (window.__session?.state?.history.length ?? 0) >= 1, null, 40_000);
    const [, guest] = await Promise.all([session(pagesBySeat[1]), session(pagesBySeat[2])]);
    assert.equal(guest.state.history[0].status, 'played', `mesh round was ${guest.state.history[0].status} (${guest.state.history[0].reason})`);
    assert.equal(guest.clock.following, 'seat1', "the guest keeps the host's time");
    assert.ok(Number.isFinite(guest.clock.rtt), 'and measured it over the mesh');
    log(`mesh: round played; traffic ${JSON.stringify(during[1].traffic)}, clock offset ${guest.clock.offset.toFixed(1)} ms (rtt ${guest.clock.rtt} ms)`);
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
