// The Couch's logic is plain ES modules with no DOM: the rails on its home
// screen, today's spotlight, the controller and keyboard mappings, where an
// arrow press lands, and how a game's controls become keycaps. Pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalize } from '../assets/js/manifest.js';
import { buildRails, spotlightOf, genreTitle, weave, dayKey, CAP } from '../assets/js/couch/rails.js';
import { readInput, padStep, chordStep, mergeInputs, REPEAT, CHORD_MS } from '../assets/js/couch/pad.js';
import { keyAction, createRepeatGate, typed } from '../assets/js/couch/input.js';
import { nearest } from '../assets/js/couch/nav.js';
import { parseControls, keysSummary, proseParts } from '../assets/js/couch/howto.js';
import { ago, heroChips, pageFacts, eyebrow } from '../assets/js/couch/facts.js';
import { scan } from './scan.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-06T12:00:00');
const game = (slug, patch = {}) => normalize({ slug, name: slug, added: '2026-09-01', tags: [], ...patch });
const slugs = (list) => list.map((g) => g.slug);
const quiet = { isFave: () => false, lastPlayed: () => 0 };
const keys = (parts) => parts.map((p) => (p.key ? `[${p.key}]` : p.text)).join(' ');

/* --- rails ---------------------------------------------------------------- */

const added = (i) => new Date(Date.parse('2026-09-01') + i * DAY).toISOString();

/** A small library shaped like the real one: genres of different sizes, a
 *  series or two, a model, multiplayer games, and the other shelf. */
function library() {
  const games = [];
  const add = (slug, patch) => games.push(game(slug, { added: added(games.length), ...patch }));
  for (let i = 0; i < 45; i++) add(`rpg-${i}`, { genre: 'RPG', ...(i < 6 && { source: 'Dragon Quest IV', series: 'Dragon Quest' }) });
  for (let i = 0; i < 9; i++) add(`shooter-${i}`, { genre: 'Shooter', ...(i < 4 && { source: 'Star Fox' }) });
  for (let i = 0; i < 6; i++) add(`racing-${i}`, { genre: 'Racing', ...(i < 3 && { model: 'GPT-6' }), ...(i < 2 && { players: '1–2' }) });
  for (let i = 0; i < 4; i++) add(`life-${i}`, { genre: 'Life Sim' });
  for (let i = 0; i < 2; i++) add(`fight-${i}`, { genre: 'Fighting', source: 'Street Fighter II' });
  for (let i = 0; i < 5; i++) add(`demo-${i}`, { genre: 'Tech Demo', type: 'Tech demo' });
  add('tool-0', { type: 'Tool' });
  return games;
}

test('one uncertain import gets a review rail and stays out of the tools rail', () => {
  const candidate = game('candidate', { type: 'Game', unsure: true });
  const rails = buildRails([...library(), candidate], quiet, { now: NOW });
  assert.deepEqual(slugs(rails.find(row => row.key === 'unsure').games), ['candidate']);
  assert.ok(!rails.find(row => row.key === 'tools').games.includes(candidate));
  assert.ok(!rails.find(row => row.key === 'originals').games.includes(candidate));
});

test('the home screen opens with what is yours and what is new, and ends with the other shelf', () => {
  const games = library();
  const stats = {
    isFave: (slug) => slug === 'racing-1' || slug === 'demo-0',
    lastPlayed: (slug) => ({ 'rpg-3': 300, 'shooter-1': 900, 'demo-2': 600 })[slug] || 0,
  };
  const rails = buildRails(games, stats, { now: NOW });
  const titles = rails.map((r) => r.title);
  assert.deepEqual(titles.slice(0, 3), ['Jump back in', 'Your favourites', 'Fresh on the wall']);
  assert.deepEqual(titles.slice(-3), ['Originals', 'Play together', 'Tech demos & tools']);

  const [recent, faves, fresh] = rails;
  assert.deepEqual(slugs(recent.games), ['shooter-1', 'demo-2', 'rpg-3'], 'most recently played first');
  assert.deepEqual(slugs(faves.games), ['demo-0', 'racing-1']);
  assert.equal(fresh.games.length, CAP.fresh);
  assert.equal(fresh.games[0].slug, 'tool-0', 'newest first, whatever the shelf');
});

test('nothing played and nothing starred leaves those rows out', () => {
  const rails = buildRails(library(), quiet, { now: NOW });
  assert.equal(rails[0].key, 'fresh');
  assert.ok(!rails.some((r) => r.key === 'recent' || r.key === 'faves'));
});

test('Jump back in holds the twenty most recent plays', () => {
  const games = library();
  const stats = { isFave: () => false, lastPlayed: (slug) => (slug.startsWith('rpg-') ? 1000 + Number(slug.slice(4)) : 0) };
  const [recent] = buildRails(games, stats, { now: NOW });
  assert.equal(recent.games.length, CAP.recent);
  assert.equal(recent.games[0].slug, 'rpg-44');
});

test('genre rows hold games only, newest first, biggest genre first, capped, under natural plurals', () => {
  const rails = buildRails(library(), quiet, { now: NOW });
  const genres = rails.filter((r) => r.key.startsWith('genre:'));
  assert.deepEqual(genres.map((r) => r.title), ['RPGs', 'Shooters', 'Racing games', 'Life sims']);
  const rpgs = genres[0];
  assert.equal(rpgs.games.length, CAP.library);
  assert.equal(rpgs.games[0].slug, 'rpg-44');
  // Two fighting games are too few for a row; the tech demos' genre is the other shelf's.
  assert.ok(!rails.some((r) => r.key === 'genre:fighting' || r.key === 'genre:tech demo'));
  assert.ok(rails.find((r) => r.key === 'tools').games.every((g) => g.type !== 'Game'));
});

test('genre titles read as plurals, and an unknown genre still reads', () => {
  assert.equal(genreTitle('RPG'), 'RPGs');
  assert.equal(genreTitle('Kids & Learning'), 'Kids & learning');
  assert.equal(genreTitle('Life Sim'), 'Life sims');
  assert.equal(genreTitle('Flight'), 'Flight games');
  assert.equal(genreTitle('Rhythm'), 'Rhythm games');
});

test('series of three or more and models of three or more get rows woven between the genres', () => {
  const rails = buildRails(library(), quiet, { now: NOW });
  const keys = rails.map((r) => r.key);
  assert.ok(keys.includes('series:dragon quest'));
  assert.ok(keys.includes('series:star fox'));
  assert.ok(!keys.includes('series:street fighter ii'), 'two games are not a series row');
  const model = rails.find((r) => r.key === 'model:gpt-6');
  assert.equal(model.title, 'Built by GPT-6');
  // Genre, genre, then a series or model: never a run of genres longer than the cadence.
  const kinds = rails.map((r) => r.key.split(':')[0]);
  const firstOther = kinds.findIndex((k) => k === 'series' || k === 'model');
  assert.deepEqual(kinds.slice(firstOther - 2, firstOther + 1).slice(0, 2), ['genre', 'genre']);
  const series = rails.filter((r) => r.key.startsWith('series:')).map((r) => r.title);
  assert.ok(series[0].startsWith('Inspired by '));
  assert.ok(series[1].startsWith('After '), 'the two phrasings take turns');
});

test('weave puts one other row after every two genres and the rest at the end', () => {
  const out = weave(['g1', 'g2', 'g3', 'g4', 'g5'], ['s1', 's2', 's3', 's4']);
  assert.deepEqual(out, ['g1', 'g2', 's1', 'g3', 'g4', 's2', 'g5', 's3', 's4']);
  assert.deepEqual(weave(['g1'], []), ['g1']);
});

test('Originals and Play together come from the Games shelf', () => {
  const rails = buildRails(library(), quiet, { now: NOW });
  const originals = rails.find((r) => r.key === 'originals');
  assert.ok(originals.games.every((g) => g.lineage.original && (g.type || 'Game') === 'Game'));
  assert.deepEqual(slugs(rails.find((r) => r.key === 'together').games), ['racing-1', 'racing-0']);
});

test('the same day and library give the same rows; the seed only settles ties', () => {
  const games = library();
  const a = buildRails(games, quiet, { now: NOW });
  const b = buildRails(games, quiet, { now: NOW + 3600_000 });
  assert.deepEqual(a.map((r) => [r.key, slugs(r.games)]), b.map((r) => [r.key, slugs(r.games)]));
  const sizes = (rails) => rails.filter((r) => /^(series|model):/.test(r.key)).map((r) => r.games.length);
  const other = buildRails(games, quiet, { now: NOW, seed: 'another day' });
  assert.deepEqual(sizes(other), sizes(a), 'bigger rows still come first');
});

test("today's spotlight is a game, the same all day, and moves on with the date", () => {
  const games = library();
  const today = spotlightOf(games, NOW);
  assert.equal(today.type || 'Game', 'Game');
  assert.equal(spotlightOf(games, NOW + 6 * 3600_000).slug, today.slug);
  assert.equal(spotlightOf([...games].reverse(), NOW).slug, today.slug, 'the manifest order does not matter');
  const week = new Set(Array.from({ length: 7 }, (_, i) => spotlightOf(games, NOW + i * DAY).slug));
  assert.ok(week.size > 1);
  assert.equal(dayKey(Date.parse('2026-01-09T08:00:00')), '2026-01-09');
  assert.equal(spotlightOf([], NOW), null);
});

test('the real catalogue makes a full home screen, every row within its cap', async () => {
  const manifest = await scan({ quiet: true });
  const games = manifest.games.map(normalize).filter((g) => g.restricted !== true);
  const rails = buildRails(games, quiet, { now: NOW });
  assert.ok(rails.length > 10);
  assert.equal(rails[0].key, 'fresh');
  assert.equal(rails.at(-1).key, 'tools');
  const hidden = new Set(manifest.games.filter((g) => g.restricted === true).map((g) => g.slug));
  for (const row of rails) {
    assert.ok(row.games.length >= 2 && row.games.length <= CAP.library, row.key);
    assert.equal(new Set(slugs(row.games)).size, row.games.length, `${row.key} repeats a game`);
    assert.ok(row.games.every((g) => !hidden.has(g.slug)), `${row.key} shows a hidden game`);
  }
  for (const row of rails.filter((r) => r.key.startsWith('genre:'))) {
    assert.ok(!/ games games$/.test(row.title), row.title);
  }
});

/* --- the controller ------------------------------------------------------- */

const pad = ({ buttons = [], axes = [0, 0] } = {}) => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })),
  axes,
});

test('the standard mapping reads as named inputs, the D-pad and the stick both steering', () => {
  const input = readInput(pad({ buttons: [0, 4, 13] }));
  assert.equal(input.a, true);
  assert.equal(input.lb, true);
  assert.equal(input.down, true);
  assert.equal(input.b, false);
  const stick = readInput(pad({ axes: [-0.8, 0.1] }));
  assert.equal(stick.left, true);
  assert.equal(stick.up || stick.down || stick.right, false);
});

test('the stick has a dead zone, lets go a little later than it engages, and moves on one axis', () => {
  assert.equal(readInput(pad({ axes: [0.4, 0] })).right, false, 'inside the dead zone');
  const leaning = readInput(pad({ axes: [0.6, 0] }));
  assert.equal(leaning.right, true);
  assert.equal(readInput(pad({ axes: [0.4, 0] }), leaning).right, true, 'still held above the release line');
  assert.equal(readInput(pad({ axes: [0.3, 0] }), leaning).right, false);
  const diagonal = readInput(pad({ axes: [0.7, 0.9] }));
  assert.deepEqual([diagonal.down, diagonal.right], [true, false], 'the stronger axis wins');
});

test('a button acts once when it goes down, and not again while held', () => {
  let held = {};
  const press = (buttons, t) => {
    const step = padStep(held, readInput(pad({ buttons })), t);
    held = step.held;
    return step.actions;
  };
  assert.deepEqual(press([0], 0), ['press']);
  assert.deepEqual(press([0], 500), []);
  assert.deepEqual(press([0], 2000), []);
  assert.deepEqual(press([], 2016), []);
  assert.deepEqual(press([1, 2, 3], 2032), ['back', 'fave', 'info']);
  assert.deepEqual(press([4, 5, 8, 9], 3000), ['prevRail', 'nextRail', 'search', 'surprise']);
});

test('a held direction repeats after 380 ms, then every 110 ms', () => {
  let held = {};
  const fires = [];
  for (let t = 0; t <= 1000; t += 16) {
    const step = padStep(held, readInput(pad({ buttons: [15] })), t);
    held = step.held;
    if (step.actions.length) fires.push([t, ...step.actions]);
  }
  assert.deepEqual(fires[0], [0, 'right']);
  assert.ok(fires[1][0] >= REPEAT.delay && fires[1][0] < REPEAT.delay + 16);
  for (let i = 2; i < fires.length; i++) {
    const gap = fires[i][0] - fires[i - 1][0];
    assert.ok(gap >= REPEAT.interval && gap < REPEAT.interval + 16, `gap ${gap}`);
  }
  assert.ok(fires.length >= 7);
});

test('two pads drive the couch together', () => {
  const merged = mergeInputs([readInput(pad({ buttons: [0] })), readInput(pad({ axes: [0, -1] }))]);
  assert.equal(merged.a, true);
  assert.equal(merged.up, true);
});

test('View and Menu held together for a second leave a game, once per hold', () => {
  const both = readInput(pad({ buttons: [8, 9] }));
  const one = readInput(pad({ buttons: [8] }));
  let state = null;
  let step = chordStep(state, both, 0);
  assert.equal(step.fired, false);
  step = chordStep(step.state, both, CHORD_MS / 2);
  assert.ok(Math.abs(step.progress - 0.5) < 1e-9);
  step = chordStep(step.state, both, CHORD_MS);
  assert.equal(step.fired, true);
  step = chordStep(step.state, both, CHORD_MS + 500);
  assert.equal(step.fired, false, 'still held: it does not fire twice');
  step = chordStep(step.state, one, CHORD_MS + 600);
  assert.deepEqual([step.state, step.progress], [null, 0], 'letting go of either resets it');
  state = chordStep(null, both, 5000).state;
  assert.equal(chordStep(state, both, 5900).fired, false);
});

/* --- the keyboard --------------------------------------------------------- */

test('keys map to the same actions as the controller', () => {
  const k = (key, extra = {}) => keyAction({ key, ...extra });
  assert.equal(k('ArrowLeft'), 'left');
  assert.equal(k('ArrowDown'), 'down');
  assert.equal(k('Enter'), 'press');
  assert.equal(k('i'), 'info');
  assert.equal(k('I', { shiftKey: true }), 'info');
  assert.equal(k('f'), 'fave');
  assert.equal(k('/'), 'search');
  assert.equal(k('s'), 'search');
  assert.equal(k('r'), 'surprise');
  assert.equal(k('Escape'), 'back');
  assert.equal(k('Backspace'), 'back');
  assert.equal(k('Home'), 'first');
  assert.equal(k('End'), 'last');
  assert.equal(k('PageDown'), 'pageDown');
  assert.equal(k('q'), null);
  assert.equal(k('Tab'), null, 'Tab keeps moving focus the usual way');
});

test('anything held with Ctrl, Cmd or Alt is left to the browser', () => {
  assert.equal(keyAction({ key: 'r', metaKey: true }), null);
  assert.equal(keyAction({ key: 'f', ctrlKey: true }), null);
  assert.equal(keyAction({ key: 'ArrowLeft', altKey: true }), null);
});

test('a held key moves once per controller interval, a fresh press always', () => {
  const gate = createRepeatGate(110);
  assert.equal(gate({ repeat: false }, 0), true);
  assert.equal(gate({ repeat: true }, 30), false);
  assert.equal(gate({ repeat: true }, 60), false);
  assert.equal(gate({ repeat: true }, 115), true);
  assert.equal(gate({ repeat: true }, 150), false);
  assert.equal(gate({ repeat: false }, 151), true);
});

test('only plain printable keys type into a search', () => {
  assert.equal(typed({ key: 'a' }), true);
  assert.equal(typed({ key: '7' }), true);
  assert.equal(typed({ key: 'ArrowLeft' }), false);
  assert.equal(typed({ key: 'v', ctrlKey: true }), false);
});

/* --- where an arrow press lands -------------------------------------------- */

const box = (left, top, width = 100, height = 60) => ({ left, top, right: left + width, bottom: top + height });
const at = (list) => list.map(([id, rect]) => ({ id, rect }));

test('sideways stays in the row, and the end of a row is an end', () => {
  const rail = at([0, 1, 2, 3].map((i) => [`a${i}`, box(i * 120, 400)]));
  const below = at([0, 1, 2].map((i) => [`b${i}`, box(i * 120, 500)]));
  const all = [...rail, ...below];
  assert.equal(nearest(rail[1].rect, all, 'right').id, 'a2');
  assert.equal(nearest(rail[1].rect, all, 'left').id, 'a0');
  assert.equal(nearest(rail[3].rect, all, 'right'), null);
  assert.equal(nearest(rail[0].rect, all, 'left'), null, 'never diagonally into the next row');
});

test('up and down take the nearest row, then what is closest to straight ahead', () => {
  const buttons = at([['play', box(40, 200, 120, 40)], ['info', box(180, 200, 120, 40)], ['fave', box(320, 200, 120, 40)]]);
  const rail = at([0, 1, 2, 3, 4, 5].map((i) => [`a${i}`, box(i * 120, 400)]));
  const next = at([0, 1, 2, 3, 4, 5].map((i) => [`b${i}`, box(30 + i * 120, 520)]));
  const all = [...buttons, ...rail, ...next];
  assert.equal(nearest(rail[4].rect, all, 'down').id, 'b4');
  assert.equal(nearest(rail[0].rect, all, 'up').id, 'play');
  assert.equal(nearest(rail[2].rect, all, 'up').id, 'info');
  assert.equal(nearest(buttons[0].rect, all, 'down').id, 'a0', 'past the buttons, the first rail, not the second');
  assert.equal(nearest(buttons[0].rect, all, 'up'), null);
});

test('a bar far to the right still reaches the buttons below it', () => {
  const bar = at([['search', box(1700, 20, 44, 44)]]);
  const buttons = at([['play', box(40, 500, 120, 40)]]);
  const rail = at([['a0', box(1680, 700)]]);
  assert.equal(nearest(bar[0].rect, [...bar, ...buttons, ...rail], 'down').id, 'play');
});

test('strict both ways keeps down inside its own grid when two sit side by side', () => {
  const keys = at([['k1', box(0, 0, 50, 50)], ['k2', box(0, 60, 50, 50)]]);
  const results = at([['r1', box(300, 100, 200, 120)]]);
  assert.equal(nearest(keys[1].rect, [...keys, ...results], 'down', { strict: true }), null);
  assert.equal(nearest(keys[0].rect, [...keys, ...results], 'down', { strict: true }).id, 'k2');
  assert.equal(nearest(keys[1].rect, [...keys, ...results], 'right').id, 'r1');
});

/* --- how to play ----------------------------------------------------------- */

test('controls read as rows of keys and what they do', () => {
  const rows = parseControls('WASD or arrows to move, hold J or Space to charge, Q/R to switch swords, Tab for pack');
  assert.deepEqual(
    rows.map((r) => [keys(r.keys), r.action]),
    [
      ['[WASD] or [←↑↓→]', 'Move'],
      ['hold [J] or [Space]', 'Charge'],
      ['[Q] / [R]', 'Switch swords'],
      ['[Tab]', 'Pack'],
    ]
  );
});

test('the short form without "to" reads the same way', () => {
  const rows = parseControls('WASD/arrows move; mouse look; right-click/R guard; Ctrl+Z undo; F5 save; touch controls');
  assert.deepEqual(
    rows.map((r) => [keys(r.keys), r.action]),
    [
      ['[WASD] / [←↑↓→]', 'Move'],
      ['[Mouse]', 'Look'],
      ['[Right-click] / [R]', 'Guard'],
      ['[Ctrl] + [Z]', 'Undo'],
      ['[F5]', 'Save'],
      ['[Touch]', 'Also supported'],
    ]
  );
  assert.equal(rows[1].keys[0].pointer, true, 'the mouse is drawn as a pointer, not a key');
});

test('lists inside a clause stay together', () => {
  const kick = parseControls('A, S, D, F to kick, chop');
  assert.deepEqual([keys(kick[0].keys), kick[0].action], ['[A] , [S] , [D] , [F]', 'Kick, chop']);
  const items = parseControls('1–4 for move, attack, skills and items');
  assert.deepEqual([keys(items[0].keys), items[0].action], ['[1–4]', 'Move, attack, skills and items']);
  const brake = parseControls('W or Up for gas, S, Down or Space to brake');
  assert.deepEqual(
    brake.map((r) => [keys(r.keys), r.action]),
    [
      ['[W] or [↑]', 'Gas'],
      ['[S] , [↓] or [Space]', 'Brake'],
    ]
  );
  const swing = parseControls('Space to start the swing, set power, then stop on the white line; up/down arrows to change club');
  assert.equal(swing[0].action, 'Start the swing, set power, then stop on the white line');
  assert.equal(keys(swing[1].keys), '[↑] / [↓]');
});

test('words that are not keys are left as written', () => {
  const rows = parseControls('Click and type to edit designs; battles use on-screen commands; Space for vehicle action (slide, fire, jets)');
  assert.deepEqual(
    rows.map((r) => [keys(r.keys), r.action]),
    [
      ['[Click]', 'and type to edit designs'],
      ['', 'Battles use on-screen commands'],
      ['[Space]', 'Vehicle action (slide, fire, jets)'],
    ]
  );
  assert.deepEqual(parseControls(''), []);
  assert.deepEqual(parseControls(['Space to jump']).map((r) => r.action), ['Jump'], 'a list of lines is read as one');
});

test('symbols are keys where a key is expected', () => {
  const rows = parseControls('Drag to pan, scroll or +/− to zoom; / search');
  assert.equal(keys(rows[1].keys), '[Scroll] or [+] / [−]');
  assert.deepEqual([keys(rows[2].keys), rows[2].action], ['[/]', 'Search']);
});

test('the summary keeps paired keys together and drops alternatives', () => {
  const summary = (text) => keysSummary(parseControls(text)).map((p) => p.key);
  assert.deepEqual(summary('WASD or arrows to move, Space to jump, Shift to dash, E to use'), ['WASD', 'Space', 'Shift']);
  assert.deepEqual(summary('W/S to accelerate and brake, A/D to steer, Space for handbrake'), ['W/S', 'A/D', 'Space']);
  assert.deepEqual(summary('Arrows or WASD to drive, Ctrl+Z to undo'), ['←↑↓→', 'Ctrl+Z']);
  assert.deepEqual(summary('Click to choose dialogue, actions and targets'), ['Click']);
  assert.deepEqual(summary(undefined), []);
});

test('keys named inside a sentence are split out', () => {
  assert.deepEqual(proseParts('the sidewalk or WASD to move'), [{ text: 'the sidewalk or ' }, { key: 'WASD' }, { text: ' to move' }]);
  assert.deepEqual(proseParts('nothing here'), [{ text: 'nothing here' }]);
});

test('every catalogued control line parses into at least one row', async () => {
  const manifest = await scan({ quiet: true });
  for (const g of manifest.games.filter((g) => g.controls)) {
    const rows = parseControls(g.controls);
    assert.ok(rows.length > 0, g.slug);
    assert.ok(rows.some((r) => r.keys.length), `${g.slug}: no keys found in "${g.controls}"`);
  }
});

/* --- facts ------------------------------------------------------------------ */

test('dates read relative to today, by calendar day', () => {
  const now = Date.parse('2026-10-06T09:00:00');
  assert.equal(ago(Date.parse('2026-10-06T01:00:00'), now), 'today');
  assert.equal(ago(Date.parse('2026-10-05T23:30:00'), now), 'yesterday');
  assert.equal(ago(Date.parse('2026-10-03T12:00:00'), now), '3 days ago');
  assert.equal(ago(Date.parse('2026-09-22T12:00:00'), now), '2 weeks ago');
  assert.equal(ago(Date.parse('2026-07-01T12:00:00'), now), '3 months ago');
  assert.equal(ago(Date.parse('2024-09-01T12:00:00'), now), '2 years ago');
});

test('the hero names genre, origin and model, and chips who, how big, when and which keys', () => {
  const g = game('sky', {
    genre: 'Flight',
    source: 'Ace Combat 3',
    series: 'Ace Combat',
    model: ['GPT-6', 'Claude Opus 5.5'],
    players: '1–2',
    bytes: 3 * 1024 * 1024,
    added: '2026-10-03T12:00:00',
    controls: 'WASD to fly, Space to fire',
  });
  assert.deepEqual(eyebrow(g), ['Flight', 'Inspired by Ace Combat 3', 'GPT-6 & Claude Opus 5.5']);
  const chips = heroChips(g, NOW);
  assert.deepEqual(chips.filter((c) => c.text).map((c) => c.text), ['1–2 players', '3.0 MB', 'Added 3 days ago']);
  assert.deepEqual(chips.at(-1).keys.map((p) => p.key), ['WASD', 'Space']);
  assert.deepEqual(eyebrow(game('lone', { genre: 'Puzzle' })), ['Puzzle', 'Original']);
  assert.deepEqual(heroChips(game('lone', { type: 'Tool' }), NOW).map((c) => c.text), ['Added last month']);
});

test('the facts grid keeps its order and leaves out what a game does not say', () => {
  const g = game('dq', { genre: 'RPG', source: 'Dragon Quest IV', series: 'Dragon Quest', bytes: 2048, added: '2026-09-01', updated: '2026-09-20' });
  const facts = pageFacts(g, NOW);
  assert.deepEqual(facts.map((f) => f.label), ['Genre', 'Origin', 'Players', 'Size', 'Added', 'Updated', 'Type']);
  assert.deepEqual(facts[1], { label: 'Origin', value: 'Inspired by Dragon Quest IV', note: 'Dragon Quest series' });
  const original = pageFacts(game('o', { genre: 'Puzzle', builds: [{ id: 'a' }, { id: 'b' }] }), NOW);
  assert.deepEqual(original.find((f) => f.label === 'Origin'), { label: 'Origin', value: 'Original', note: '' });
  assert.equal(original.find((f) => f.label === 'Builds').value, '2');
});
