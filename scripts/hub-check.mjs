#!/usr/bin/env node
/**
 * hub-check.mjs — does a game keep the AI Hub Session Protocol?
 *
 * Runs lib/hub/harness.html?auto=1 against each game with 2, 3 and 4 players
 * on a poor network (150 ± 50 ms, 5% loss): hello, ready, traffic, a player
 * leaving, time-up and a valid result. Then once more with the host leaving.
 * Before any game script runs, every frame in session mode gets alert,
 * confirm, prompt, window.open and socket constructors wrapped, so calling
 * them is caught. Needs Playwright, which is not a dependency (see shots.mjs).
 *
 * Usage:  node scripts/hub-check.mjs [game paths…] [--players 2,3,4] [--base URL] [--json]
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
const games = args.filter((a) => !a.startsWith('--')).map((g) => (g.startsWith('/') || /^https?:/.test(g) ? g : `/${g}`));
if (!games.length) games.push(...EXAMPLES);

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('hub-check needs Playwright: pnpm add -D playwright && pnpm exec playwright install chromium');
  process.exit(2);
}

/** Runs in every frame before its own scripts: only session-mode pages are watched. */
function watch() {
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
      const url = `${base}/lib/hub/harness.html?${new URLSearchParams({ game, players: n, latency: 150, jitter: 50, loss: 5, auto: 1, scenario, play: 6000 })}`;
      await page.goto(url);
      await page.waitForSelector('body[data-complete="true"]', { timeout: 120_000 });
      const report = await page.evaluate(() => window.__hubCheck);
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
  }
} finally {
  await browser.close();
  server?.close();
}

const pass = runs.every((r) => r.pass);
await mkdir(path.join(ROOT, '.cache'), { recursive: true });
await writeFile(path.join(ROOT, '.cache', 'hub-check.json'), JSON.stringify({ schemaVersion: 1, base, pass, runs }, null, 2));
if (asJson) console.log(JSON.stringify({ pass, runs }, null, 2));
else console.log(`\n${pass ? 'All checks passed' : 'Some checks failed'} — report in .cache/hub-check.json`);
process.exit(pass ? 0 : 1);
