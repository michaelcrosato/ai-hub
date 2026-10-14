/** Optional rendered regression: run with a dev server, or pass the deployed URL.
 * Requires Playwright (same optional tool as shots.mjs).
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector('.cab', { timeout: 120000 });
  await page.keyboard.press('Control+F2');
  assert.equal(await page.locator('.dev__panel').count(), 0);
  await page.keyboard.press('Shift+F2');
  await page.getByLabel('PIN', { exact: true }).fill('2222');
  await page.getByText('Not that one. Try again.').waitFor();
  assert.equal(await page.locator('.audio-review').count(), 0);
  await page.getByLabel('PIN', { exact: true }).fill('1111');
  const review = page.locator('.audio-review');
  await review.waitFor();
  const manifest = await page.evaluate(async () => (await (await fetch('/data/games.json')).json()).games);
  const n = format => manifest.filter(g => g.audioReview.formats.includes(format)).length;
  const rows = review.locator('.audio-review__results > details');
  assert.equal(await rows.count(), manifest.length);
  await page.getByLabel('Audio format', { exact: true }).selectOption('mp3');
  assert.equal(await rows.count(), n('mp3'));
  await page.getByLabel('Audio format', { exact: true }).selectOption('wav');
  assert.equal(await rows.count(), n('wav'));
  await page.getByLabel('Audio format', { exact: true }).selectOption('either');
  assert.equal(await rows.count(), manifest.filter(g => g.audioReview.formats.length).length);
  await page.getByLabel('Explicit placeholder music', { exact: true }).check();
  assert.equal(await rows.count(), manifest.filter(g => g.audioReview.formats.length && g.audioReview.evidence.length).length);
  await page.getByLabel('Search audio review', { exact: true }).fill('crown');
  assert.equal(await rows.count(), 1);
  await rows.locator(':scope > summary').click();
  assert.match(await rows.textContent(), /Final Fantasy Tactics PS1 placeholders/);
  await rows.locator('blockquote').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/audio-review-desktop.png' });
  await page.getByRole('button', { name: 'Reset audio filters', exact: true }).click();
  assert.equal(await rows.count(), manifest.length);
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await page.locator('.sign__name').click({ clickCount: 5, delay: 80 });
  await page.getByLabel('PIN', { exact: true }).waitFor();
  await page.getByLabel('PIN', { exact: true }).fill('1234');
  await page.getByLabel('Search audio review', { exact: true }).fill('crown');
  await page.getByLabel('Explicit placeholder music', { exact: true }).check();
  await rows.locator(':scope > summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await rows.locator('blockquote').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/audio-review-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ url:base, games:manifest.length, mp3:n('mp3'), wav:n('wav'), either:manifest.filter(g=>g.audioReview.formats.length).length, placeholder:manifest.filter(g=>g.audioReview.evidence.length).length, checks:'PIN rejection/unlock/lock, shortcut, filters, search, evidence, reset, desktop/mobile render', errors }));
} finally { await browser.close(); }
