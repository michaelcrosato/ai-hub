#!/usr/bin/env node
/**
 * hub-check.mjs — does a game keep the AI Hub Session Protocol?
 *
 * Runs lib/hub/harness.html?auto=1 against each game with 2, 3 and 4 players
 * on a poor network (150 ± 50 ms, 5% loss): hello, ready without a prompt
 * under the hub's splash, the keyboard and an emulated standard gamepad (a
 * PS5 DualSense in the browser's standard mapping) reaching the player, the
 * settings menu opening over a world that keeps moving, traffic, a player
 * leaving, time-up and a valid result. Then once more with the host leaving.
 * Then the game on its own, outside a session: the controller alone, and then
 * the keyboard alone, get from its title to play and open and close its menu.
 * Before any game script runs, every frame in session mode gets alert,
 * confirm, prompt, window.open and socket constructors wrapped, so calling
 * them is caught. Needs Playwright, which is not a dependency (see shots.mjs).
 *
 * Usage:  node scripts/hub-check.mjs [game paths…] [--players 2,3,4] [--base URL] [--json] [--no-solo]
 *         (games default to the two examples in lib/hub/examples/)
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { staticHandler } from './lib/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES = ['/lib/hub/examples/arena.html', '/lib/hub/examples/race.html'];
const PAGE_MS = 300_000;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return fallback;
  const [value] = args.splice(at, 2).slice(1);
  return value;
};
const counts = option('players', '2,3,4').split(',').map(Number).filter((n) => n >= 1 && n <= 4);
let base = option('base', null);
const asJson = args.includes('--json');
const solo = !args.includes('--no-solo');
const games = args.filter((a) => !a.startsWith('--')).map((g) => (g.startsWith('/') || /^https?:/.test(g) ? g : `/${g}`));
if (!games.length) games.push(...EXAMPLES);

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('hub-check needs Playwright: pnpm add -D playwright && pnpm exec playwright install chromium');
  process.exit(2);
}

/**
 * Runs in every frame before its own scripts. Every page gets an emulated
 * standard gamepad, connected on its first press like a real one, driven
 * through window.__pad. Only session-mode pages are watched for dialogs and sockets.
 */
function watch() {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0, vibrationActuator: null };
  let plugged = false;
  window.__pad = {
    set({ buttons: down = {}, axes = {} } = {}) {
      for (const [i, v] of Object.entries(down)) {
        const value = Number(v) || 0;
        Object.assign(buttons[i], { pressed: value > 0.5, touched: value > 0, value });
      }
      for (const [i, v] of Object.entries(axes)) pad.axes[i] = v;
      pad.timestamp = performance.now();
      if (!plugged) {
        plugged = true;
        const event = new Event('gamepadconnected');
        event.gamepad = pad;
        dispatchEvent(event);
      }
    },
    reset() {
      for (const b of buttons) Object.assign(b, { pressed: false, touched: false, value: 0 });
      pad.axes.fill(0);
      pad.timestamp = performance.now();
    },
  };
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [plugged ? pad : null, null, null, null] });

  if (!/[?&]aihub=/.test(location.search)) return;
  const seen = (window.__hubViolations = []);
  for (const name of ['alert', 'confirm', 'prompt', 'open']) {
    window[name] = () => {
      seen.push(`${name}() called`);
      return name === 'confirm' ? false : null;
    };
  }
  for (const name of ['WebSocket', 'RTCPeerConnection', 'EventSource']) {
    const Original = window[name];
    if (!Original) continue;
    window[name] = function (...a) {
      seen.push(`${name} opened in a session (${String(a[0]).slice(0, 80)})`);
      return new Original(...a);
    };
  }
  addEventListener('error', (e) => seen.push(`error: ${e.message}`));
  addEventListener('unhandledrejection', (e) => seen.push(`unhandled rejection: ${e.reason?.message || e.reason}`));
}

let server = null;
if (!base) {
  server = createServer(staticHandler(ROOT));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const runs = [];
try {
  for (const game of games) {
    const plan = counts.map((n) => ({ n, scenario: 'standard' }));
    plan.push({ n: Math.max(2, Math.min(3, Math.max(...counts))), scenario: 'host-leave' });
    for (const { n, scenario } of plan) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      await context.addInitScript(watch);
      const page = await context.newPage();
      const pageErrors = [];
      const warnings = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => m.text().startsWith('[AIHub]') && warnings.push(m.text()));
      const url = `${base}/lib/hub/harness.html?${new URLSearchParams({ game, players: n, latency: 150, jitter: 50, loss: 5, auto: 1, scenario, play: 8000 })}`;
      await page.goto(url);
      // The harness times every step itself; this only catches a page that stopped answering.
      // Four copies of a 3D game on software WebGL can take minutes.
      const finished = await page.waitForSelector('body[data-complete="true"]', { timeout: PAGE_MS }).then(() => true, () => false);
      const report = (await page.evaluate(() => window.__hubCheck).catch(() => null)) || { pass: false, checks: [] };
      if (!finished) {
        report.pass = false;
        report.checks.push({ name: `the harness finished within ${PAGE_MS / 1000} s`, pass: false, detail: `stopped after: ${report.checks.at(-1)?.name ?? 'nothing'}` });
      }
      const extra = [
        { name: 'no client warnings (oversized or too many sends, misuse)', pass: !warnings.length, detail: [...new Set(warnings)].slice(0, 4).join('; ') },
        { name: 'harness page has no errors', pass: !pageErrors.length, detail: pageErrors.join('; ') },
      ];
      report.checks.push(...extra);
      report.pass = report.pass && extra.every((c) => c.pass);
      runs.push({ game, players: n, scenario, pass: report.pass, checks: report.checks });
      if (!asJson) {
        console.log(`${report.pass ? 'PASS' : 'FAIL'}  ${game}  ${n} players  ${scenario}`);
        for (const c of report.checks) if (!c.pass) console.log(`        ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
      }
      await context.close();
    }
    if (solo) {
      const report = await alone(game);
      runs.push({ game, players: 1, scenario: 'alone', pass: report.pass, checks: report.checks });
      if (!asJson) {
        console.log(`${report.pass ? 'PASS' : 'FAIL'}  ${game}  on its own (controller, then keyboard)`);
        for (const c of report.checks) if (!c.pass) console.log(`        ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
      }
    }
  }
} finally {
  await browser.close();
  server?.close();
}

/**
 * The game outside a session, as someone at the wall plays it: first with
 * only the controller, Cross until it plays (its menus' defaults), then
 * Options to open its menu and Options or Circle to close it; then, on a
 * fresh page, the same with only the keyboard: Enter or Space, then Esc.
 */
async function alone(game) {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail });
  const url = /^https?:/.test(game) ? game : `${base}${game}`;
  for (const device of ['controller', 'keyboard']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(watch);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    const probe = () => page.evaluate(() => window.AIHub?.inspect?.() ?? null).catch(() => null);
    const wait = async (test, ms) => {
      const end = Date.now() + ms;
      for (;;) {
        const p = await probe();
        if (test(p)) return p;
        if (Date.now() > end) return p;
        await page.waitForTimeout(150);
      }
    };
    const press = async (what) => {
      if (device === 'controller') {
        await page.evaluate((b) => window.__pad.set({ buttons: { [b]: 1 } }), what);
        await page.waitForTimeout(160);
        await page.evaluate(() => window.__pad.reset());
      } else {
        await page.keyboard.press(what);
      }
      await page.waitForTimeout(450);
    };
    const first = await wait((p) => p && !p.error, 20_000);
    if (!first || first.error) {
      check(`on its own: the game probes its state (${device})`, false, JSON.stringify(first));
      await context.close();
      continue;
    }
    const start = device === 'controller' ? [0] : ['Enter', 'Space'];
    let state = first;
    for (let i = 0; i < 14 && state?.scene !== 'play'; i++) {
      await press(start[i % start.length]);
      state = await probe();
    }
    check(`on its own: the ${device} alone gets from the title to play`, state?.scene === 'play', `scene ${first.scene} → ${state?.scene}`);
    if (state?.scene === 'play') {
      const open = device === 'controller' ? 9 : 'Escape';
      await press(open);
      const opened = await wait((p) => p?.menu === true, 1500);
      check(`on its own: ${device === 'controller' ? 'Options' : 'Esc'} opens the menu`, opened?.menu === true, JSON.stringify(opened));
      await press(open);
      let closed = await wait((p) => p?.menu === false, 1000);
      if (closed?.menu && device === 'controller') {
        await press(1);
        closed = await wait((p) => p?.menu === false, 1000);
      }
      check(`on its own: ${device === 'controller' ? 'Options or Circle' : 'Esc'} closes it`, closed?.menu === false, JSON.stringify(closed));
    }
    check(`on its own: no errors (${device})`, !errors.length, errors.slice(0, 3).join('; '));
    await context.close();
  }
  return { pass: checks.every((c) => c.pass), checks };
}

const pass = runs.every((r) => r.pass);
await mkdir(path.join(ROOT, '.cache'), { recursive: true });
await writeFile(path.join(ROOT, '.cache', 'hub-check.json'), JSON.stringify({ schemaVersion: 1, base, pass, runs }, null, 2));
if (asJson) console.log(JSON.stringify({ pass, runs }, null, 2));
else console.log(`\n${pass ? 'All checks passed' : 'Some checks failed'} — report in .cache/hub-check.json`);
process.exit(pass ? 0 : 1);
