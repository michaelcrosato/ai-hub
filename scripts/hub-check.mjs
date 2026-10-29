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
 * A side-by-side game (hub:session-mode parallel) is played at 1 and 2
 * players, and once with a player leaving: nothing is shared, so more copies
 * prove nothing more. Its checks expect no game traffic, progress, and
 * Math.random seeded the same on every copy.
 *
 * --retrofit is for an existing game upgraded to side by side (README, "Side
 * by side"): it need not probe, it is played once, at 2 players with one of
 * them leaving, and on its own it must simply still work, so that check opens
 * the page, presses Enter and Space, and wants no errors and a drawn screen.
 * With --original <path>, errors the original page already had are forgiven.
 * --draws-only does only that last part, for any page: the retrofit runs it
 * on a game before spending a model on it, since a page this browser cannot
 * run cannot be checked here. A WebGPU-only game without WebGPU is caught even
 * when its title screen shows: it asked for an adapter, got none, and drew
 * nothing with WebGL. --browser-args passes flags to Chromium; on a machine
 * without a GPU, SwiftShader gives such games a software adapter:
 *   --browser-args "--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --use-angle=swiftshader"
 *
 * Every game's pasted client is also read from disk and must be exactly a
 * released one (scripts/lib/hub-client.mjs).
 *
 * --record writes the outcome into data/overrides.json, which is how the hub
 * keeps a failing game out of sessions: a game that fails gets "session": "0"
 * (it overrides the game's own hub:session meta, so Random Mode never deals
 * it) and a sessionNote naming what failed; a game that passes loses both.
 *
 * Usage:  node scripts/hub-check.mjs [game paths…] [--players 2,3,4] [--base URL] [--json] [--no-solo]
 *                                    [--retrofit [--original <path>]] [--draws-only] [--record] [--browser-args "<flags>"]
 *         (games default to the three examples in lib/hub/examples/)
 */

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { staticHandler } from './lib/serve.mjs';
import { findClients } from './lib/hub-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES = ['/lib/hub/examples/arena.html', '/lib/hub/examples/race.html', '/lib/hub/examples/parallel.html'];
const PAGE_MS = 300_000;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return fallback;
  const [value] = args.splice(at, 2).slice(1);
  return value;
};
const asked = option('players', null);
let base = option('base', null);
const original = option('original', null);
const asJson = args.includes('--json');
const solo = !args.includes('--no-solo');
const retrofit = args.includes('--retrofit');
const drawsOnly = args.includes('--draws-only');
const record = args.includes('--record');
/** Extra flags for the browser, e.g. the ones that give it WebGPU where the machine can (lib/kit/README.md). */
const browserArgs = (option('browser-args', '') || '').split(/\s+/).filter(Boolean);
const asPath = (g) => (g.startsWith('/') || /^https?:/.test(g) ? g : `/${g}`);
const games = args.filter((a) => !a.startsWith('--')).map(asPath);
if (!games.length) games.push(...EXAMPLES);

/** The player counts to try: as asked, or by the game's mode. Side by side shares nothing, so 1 and 2 say it all. */
function countsFor(mode) {
  const list = asked ?? (mode === 'parallel' ? '1,2' : '2,3,4');
  return list.split(',').map(Number).filter((n) => n >= 1 && n <= 4);
}

/** The game's session mode, read from its head. */
async function modeOf(game) {
  try {
    const html = await (await fetch(/^https?:/.test(game) ? game : `${base}${game}`)).text();
    return html.match(/<meta\s+name=["']hub:session-mode["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

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

  // What the page asked of the graphics stack: a WebGPU adapter it never got, and
  // no WebGL drawing instead, means this browser cannot run it (a title screen may still show).
  const gfx = (window.__gfx = { askedForWebGPU: false, gotAdapter: false, webgl: false });
  if (navigator.gpu?.requestAdapter) {
    const ask = navigator.gpu.requestAdapter.bind(navigator.gpu);
    Object.defineProperty(navigator.gpu, 'requestAdapter', {
      configurable: true,
      value: async (...a) => {
        gfx.askedForWebGPU = true;
        const adapter = await ask(...a);
        if (adapter) gfx.gotAdapter = true;
        return adapter;
      },
    });
  }
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const context = getContext.call(this, type, ...rest);
    if (context && /^(webgl2?|experimental-webgl)$/.test(type)) gfx.webgl = true;
    return context;
  };

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

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', ...browserArgs] });
const runs = [];
try {
  for (const game of games) {
    if (drawsOnly) {
      const report = await stillWorks(game, null, { bare: true });
      runs.push({ game, players: 1, scenario: 'draws', pass: report.pass, checks: report.checks });
      if (!asJson) console.log(`${report.pass ? 'PASS' : 'FAIL'}  ${game}  draws on its own`);
      continue;
    }
    const client = await clientCheck(game);
    if (client) {
      runs.push({ game, players: 0, scenario: 'static', pass: client.pass, checks: [client] });
      if (!asJson && !client.pass) console.log(`FAIL  ${game}  ✗ ${client.name} — ${client.detail}`);
    }
    const counts = countsFor(await modeOf(game));
    // A retrofit is played once, at 2 players with one leaving: nothing is shared, so that says it all.
    const plan = retrofit && !asked ? [] : counts.map((n) => ({ n, scenario: 'standard' }));
    plan.push({ n: retrofit && !asked ? 2 : Math.max(2, Math.min(3, Math.max(...counts))), scenario: 'host-leave' });
    for (const { n, scenario } of plan) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      await context.addInitScript(watch);
      const page = await context.newPage();
      const pageErrors = [];
      const warnings = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => m.text().startsWith('[AIHub]') && warnings.push(m.text()));
      const query = { game, players: n, latency: 150, jitter: 50, loss: 5, auto: 1, scenario, play: 8000, ...(retrofit ? { retrofit: 1 } : {}) };
      const url = `${base}/lib/hub/harness.html?${new URLSearchParams(query)}`;
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
      const report = retrofit ? await stillWorks(game, original && asPath(original)) : await alone(game);
      runs.push({ game, players: 1, scenario: 'alone', pass: report.pass, checks: report.checks });
      if (!asJson) {
        console.log(`${report.pass ? 'PASS' : 'FAIL'}  ${game}  on its own (${retrofit ? 'as before the retrofit' : 'controller, then keyboard'})`);
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

/**
 * A retrofitted game on its own: open it as someone at the wall would, press
 * Enter and Space a few times, and see that it still runs: no errors (none
 * beyond what the original page already had), the client inactive and
 * Math.random left alone, and something drawn on the screen.
 */
/** The pasted client, read from disk: one copy, exactly a released one. Null for a game served from elsewhere. */
async function clientCheck(game) {
  if (/^https?:/.test(game)) return null;
  const file = path.join(ROOT, decodeURI(game).replace(/^\//, ''));
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return null;
  }
  // A project folder may ship the client as its own file next to its page.
  if (path.basename(file) === 'index.html' && !text.includes('aihub-session')) {
    for (const name of await readdir(path.dirname(file)).catch(() => [])) {
      if (/\.m?js$/.test(name)) text += '\n' + (await readFile(path.join(path.dirname(file), name), 'utf8').catch(() => ''));
    }
  }
  const copies = findClients(text);
  const name = 'the session client is pasted unmodified';
  if (copies.length !== 1) return { name, pass: false, detail: `${copies.length} copies of the client` };
  return { name, pass: copies[0].pristine, detail: copies[0].pristine ? copies[0].version : `${copies[0].version ?? 'unknown'} edited: paste lib/hub/session.js again` };
}

async function stillWorks(game, before, { bare = false } = {}) {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail });
  const visit = async (page) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(watch);
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (e) => errors.push(e.message));
    await tab.goto(/^https?:/.test(page) ? page : `${base}${page}`);
    await tab.waitForTimeout(2500);
    for (const key of ['Enter', 'Space', 'Enter', 'Space']) {
      await tab.keyboard.press(key).catch(() => {});
      await tab.waitForTimeout(500);
    }
    await tab.waitForTimeout(2000);
    const hub = await tab.evaluate(() => (window.AIHub ? { active: window.AIHub.active, seeded: window.AIHub.seeded } : null)).catch(() => null);
    const gfx = await tab.evaluate(() => window.__gfx ?? null).catch(() => null);
    // A WebGL or WebGPU canvas often reads back blank from a script, so look at the screen instead:
    // a blank one compresses to almost nothing, so a PNG past a blank page's size means something is drawn.
    const bytes = (await tab.screenshot({ type: 'png' }).catch(() => Buffer.alloc(0))).length;
    await context.close();
    return { errors, hub, bytes, gfx };
  };
  const blank = await (async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const tab = await context.newPage();
    await tab.setContent('<body style="margin:0;background:#000"></body>');
    const bytes = (await tab.screenshot({ type: 'png' })).length;
    await context.close();
    return bytes;
  })();
  const after = await visit(game);
  // A line of text on a plain screen already adds about 2 KB; a uniform screen of any colour adds nothing.
  after.drawn = after.bytes > blank + 1200;
  const known = before ? new Set((await visit(before)).errors) : new Set();
  const fresh = after.errors.filter((e) => !known.has(e));
  if (!bare) {
    check('on its own: the session client is there and inactive', after.hub && after.hub.active === false, JSON.stringify(after.hub));
    check('on its own: Math.random is left alone', after.hub && after.hub.seeded === false, JSON.stringify(after.hub));
  }
  const noWebGPU = after.gfx?.askedForWebGPU && !after.gfx.gotAdapter && !after.gfx.webgl;
  check('on its own: this browser can run it', !noWebGPU, noWebGPU ? 'it asked for WebGPU, this browser has no adapter, and nothing drew with WebGL instead' : '');
  check('on its own: it draws its screen', after.drawn, `${after.bytes} bytes of screenshot, a blank screen is ${blank}`);
  // Drawing is all a bare page is asked: its own errors are the original's business.
  if (!bare) check(`on its own: no errors${before ? ' the original did not have' : ''}`, !fresh.length, fresh.slice(0, 3).join('; '));
  return { pass: checks.every((c) => c.pass), checks };
}

/**
 * Keep the verdict with the game: a failure takes it out of sessions until it
 * passes again (see the header). Games are found by path in data/games.json.
 */
async function recordChecks() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(ROOT, 'data/games.json'), 'utf8'));
  } catch {
    console.log('--record needs data/games.json: run pnpm scan first');
    return;
  }
  const slugOf = new Map();
  for (const g of manifest.games) for (const p of [g.path, ...(g.builds || []).map((b) => b.path)]) if (p) slugOf.set(decodeURI(p), g.slug);
  const file = path.join(ROOT, 'data/overrides.json');
  const overrides = JSON.parse(await readFile(file, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  for (const game of games) {
    const slug = slugOf.get(decodeURI(game));
    if (!slug) {
      console.log(`--record: ${game} is not in the catalogue, nothing recorded`);
      continue;
    }
    const mine = runs.filter((r) => r.game === game);
    const failed = [...new Set(mine.flatMap((r) => r.checks.filter((c) => !c.pass).map((c) => c.name)))];
    const entry = { ...(overrides[slug] || {}) };
    if (!failed.length) {
      if (entry.session === '0') delete entry.session;
      delete entry.sessionNote;
    } else {
      entry.session = '0';
      entry.sessionNote = `hub-check failed on ${today}: ${failed.slice(0, 3).join('; ')}`.slice(0, 240);
    }
    if (Object.keys(entry).length) overrides[slug] = entry;
    else delete overrides[slug];
    console.log(`--record: ${slug} ${failed.length ? 'kept out of sessions' : 'may be dealt'}`);
  }
  await writeFile(file, `${JSON.stringify(overrides, null, 2)}\n`);
}

const pass = runs.every((r) => r.pass);
if (record) await recordChecks();
await mkdir(path.join(ROOT, '.cache'), { recursive: true });
await writeFile(path.join(ROOT, '.cache', 'hub-check.json'), JSON.stringify({ schemaVersion: 1, base, pass, runs }, null, 2));
if (asJson) console.log(JSON.stringify({ pass, runs }, null, 2));
else console.log(`\n${pass ? 'All checks passed' : 'Some checks failed'} — report in .cache/hub-check.json`);
process.exit(pass ? 0 : 1);
