/** Optional browser regression: node scripts/explore-browser.mjs [site URL].
 * Uses Playwright like shots.mjs, without adding a runtime dependency.
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = '.cache/selection-checks';
await mkdir(output, { recursive: true });
const views = ['atlas', 'timeline', 'deck'];
const records = [
  { slug: 'alpha', name: 'Alpha Racer', genre: 'Racing', added: '2026-10-01T12:00:00Z' },
  { slug: 'beta', name: 'Beta Racer', genre: 'Racing', added: '2026-09-02T12:00:00Z' },
  { slug: 'gamma', name: 'Gamma Puzzle', genre: 'Puzzle', added: '2026-09-01T12:00:00Z' },
  { slug: 'delta', name: 'Delta Arcade', genre: 'Arcade' },
  { slug: 'tool', name: 'Tool Lab', genre: 'Tech Demo', type: 'Tool' },
  { slug: 'review', name: 'Review Entry', unsure: true },
  { slug: 'restricted', name: 'Restricted Secret', restricted: true },
].map((game) => ({
  type: 'Game',
  description: `Explore ${game.name}.`,
  bytes: 1234,
  path: `/__selection-test/${game.slug}`,
  builds: [
    { id: 'current', version: '2', path: `/__selection-test/${game.slug}`, bytes: 1234 },
    { id: 'old', version: '1', path: `/__selection-test/${game.slug}-old`, bytes: 1000 },
  ],
  ...game,
}));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
const report = [];
const count = async (page, n) => {
  await page.waitForFunction(
    (n) => document.querySelector('#explore-count')?.textContent.startsWith(`${n} `),
    n,
  );
};
const noOverflow = async (page) =>
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

try {
  for (const view of views) {
    const context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`${view}: ${error.message}`));
    await page.route('**/data/games.json', (route) => route.fulfill({ json: { games: records } }));
    await page.route('**/__selection-test/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Fixture game</title><style>body{padding:120px}</style><button onclick="this.textContent=\'Played\'">Start game</button><script>addEventListener("keydown",e=>document.body.dataset.key=e.key)</script>',
      }),
    );
    await page.goto(`${base}/${view}`);
    await count(page, 4);
    assert.equal(await page.locator('.views__link').count(), 6);
    await noOverflow(page);
    const content = page.locator('#explore-content');
    await page.getByLabel('Search the library').fill('Alpha');
    await count(page, 1);
    await content
      .getByRole('button', { name: /favourite/i })
      .first()
      .click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ai-hub:v1'))?.faves.alpha);
    await content
      .getByRole('button', { name: /details/i })
      .first()
      .click();
    await page.getByRole('dialog').waitFor();
    assert.match(page.url(), /#\/g\/alpha\?q=Alpha/);
    // Modal focus is contained, including backwards tabbing from Close.
    await page.getByRole('button', { name: 'Close details', exact: true }).last().focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(
      await page.locator('.detail__panel').evaluate((node) => node.contains(document.activeElement)),
      true,
    );
    // An older build runs through the same player, and the game owns its keys.
    await page.locator('.build').last().click();
    const frame = page.frameLocator('.player__frame');
    await frame.getByRole('button', { name: 'Start game' }).click();
    await page.keyboard.press('/');
    assert.equal(await frame.locator('body').getAttribute('data-key'), '/');
    assert.match(await page.locator('.player__frame').getAttribute('src'), /alpha-old$/);
    await page.getByRole('button', { name: `Back to the ${view}` }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('.player__frame').count(), 0);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByLabel('Search the library').inputValue(), 'Alpha');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ai-hub:v1'))?.plays.alpha === 1);
    // The same favourite is visible after switching to either of the other views.
    const destination = views[(views.indexOf(view) + 1) % views.length];
    await page.locator(`.views__link[data-view="${destination}"]`).click();
    await count(page, 1);
    await page.getByRole('button', { name: 'Favourites only', exact: true }).click();
    await count(page, 1);
    await page.goto(`${base}/${view}`);
    await count(page, 4);
    await page.getByLabel('Shelf', { exact: true }).selectOption('tools');
    await count(page, 1);
    assert.match(await content.innerText(), /Tool Lab/);
    await page.getByLabel('Shelf', { exact: true }).selectOption('unsure');
    await count(page, 1);
    assert.match(await content.innerText(), /Review Entry/);
    await page.getByLabel('Shelf', { exact: true }).selectOption('all');
    await count(page, 6);
    await page.getByLabel('Search the library').fill('Restricted Secret');
    await count(page, 0);
    assert.equal(await content.getByRole('button', { name: /^Play/ }).filter({ visible: true }).count(), 0);
    await page.getByRole('button', { name: 'Reset selection', exact: true }).click();
    await count(page, 4);
    await page.goto(`${base}/${view}#/g/restricted`);
    await page.getByText('That entry is unavailable. Browse the library below.').waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    if (view === 'atlas') {
      await content
        .getByRole('button', { name: /Racing/ })
        .first()
        .click();
      assert.match(page.url(), /district=genre%3Aracing/);
      assert.equal(await page.locator('.atlas-stop').count(), 2);
    } else if (view === 'timeline') {
      await page.goto(`${base}/timeline#/?month=2026-09`);
      await page.waitForSelector('.timeline-card');
      assert.equal(await page.locator('.timeline-card').count(), 2);
      await content.getByRole('button', { name: /Oldest/ }).click();
      assert.match(await page.locator('.timeline-card').first().innerText(), /Gamma Puzzle/);
    } else {
      const seen = new Set();
      for (let i = 0; i < 4; i++) {
        const name = await page.locator('.deck-title').textContent();
        assert.equal(seen.has(name), false);
        seen.add(name);
        await content.getByRole('button', { name: 'Next card', exact: true }).click();
      }
      await page.getByText('You’ve seen them all.').waitFor();
      assert.equal(
        await page.locator('.deck-card').evaluate((node) => document.activeElement === node),
        true,
      );
      await content.getByRole('button', { name: 'Previous', exact: true }).click();
      await page.locator('.deck-title').waitFor();
      await content.getByRole('button', { name: 'Shuffle & redeal', exact: true }).click();
      assert.match(page.url(), /seed=/);
      await page.getByLabel('Only unplayed', { exact: true }).check();
      assert.match(await page.locator('.deck-count').innerText(), /\/ 3$/);
      await page.getByLabel('Search the library').fill('Beta');
      await count(page, 1);
      await content.getByRole('button', { name: 'Play this', exact: true }).click();
      await page.frameLocator('.player__frame').getByRole('button', { name: 'Start game' }).waitFor();
      await page.getByRole('button', { name: 'Back to the deck' }).click();
      await page.getByText('All caught up.').waitFor();
      assert.equal(await content.evaluate((node) => document.activeElement === node), true);
    }
    report.push({
      view,
      fixtures:
        'search, shelves, favourites across views, details, builds, player keys/return, hidden entries, distinct navigation',
    });
    console.log(`${view}: interaction checks passed`);
    await context.close();
  }

  // The actual built catalogue, images, styles and modules, without fixture routes.
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(`library: ${error.message}`));
  for (const view of views) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/${view}`);
    await page.waitForSelector(
      view === 'deck' ? '.deck-title' : `.${view === 'atlas' ? 'atlas-stop' : 'timeline-card'}`,
      { timeout: 120000 },
    );
    await noOverflow(page);
    await page.screenshot({ path: `${output}/${view}-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await page.screenshot({ path: `${output}/${view}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 320, height: 740 });
    await noOverflow(page);
    report.push({
      view,
      liveCatalogue: await page.locator('#explore-count').innerText(),
      widths: [1440, 390, 320],
    });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ base, report, errors, screenshots: output }, null, 2));
} finally {
  await browser.close();
}
