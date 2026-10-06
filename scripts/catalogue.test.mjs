// The Catalogue's query language, and the counting, ordering and exporting
// behind its facets, charts and table, are plain functions with no DOM, so
// they are pinned down here: by hand on small libraries where every answer is
// known, and by property on a library shaped like the real one, built from
// the committed catalogue in data/overrides.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { normalize, sizeOf } from '../assets/js/manifest.js';
import {
  DAY,
  EXAMPLES,
  brush,
  formatTerm,
  isFiltering,
  matches,
  parse,
  select,
  setField,
  sizeText,
  sizeToken,
  startsWord,
  toggleTerm,
  withoutTerm,
} from '../assets/js/catalogue/query.js';
import {
  FACETS,
  SIZE_BRACKETS,
  sizeEdges,
  summarise,
  tallyDays,
  tallyFacets,
  tallySizes,
} from '../assets/js/catalogue/tally.js';
import {
  COLUMNS,
  groupRecords,
  nextSort,
  readGroup,
  readSort,
  sortRecords,
  weekOf,
  writeSort,
} from '../assets/js/catalogue/order.js';
import { csvCell, markdownCell, toCSV, toMarkdown } from '../assets/js/catalogue/export.js';
import { keycaps } from '../assets/js/catalogue/keycaps.js';
import { accept, suggest, vocabularyOf } from '../assets/js/catalogue/suggest.js';

const KB = 1024;
const MB = KB * KB;
const NOW = Date.parse('2026-10-06T09:00:00Z');

const game = (slug, patch = {}) =>
  normalize({ slug, name: slug, added: '2026-09-01T12:00:00Z', bytes: 100 * KB, type: 'Game', tags: [], ...patch });

const slugs = (list) => list.map((g) => g.slug);
const pick = (library, text, ctx = { now: NOW }) => slugs(select(library, parse(text), ctx));

/** A small, fully known library. */
const lib = [
  game('racer', {
    name: 'Rally Days',
    genre: 'Racing',
    tags: ['3d', 'Vehicles'],
    bytes: 3 * MB,
    added: '2026-09-15T12:00:00Z',
    model: 'GPT-6 Astra Pro',
    source: 'Out Run',
    players: '1–2',
  }),
  game('flyer', {
    name: 'Starline 84',
    genre: 'Flight',
    tags: ['3d', 'space'],
    bytes: 400 * KB,
    added: '2026-09-20T12:00:00Z',
    model: 'GPT-6',
    source: 'Star Fox 64',
    series: 'Star Fox',
  }),
  game('sim', {
    name: 'Porchlight Post',
    genre: 'Life Sim',
    tags: ['cozy', 'pixel art'],
    bytes: 120 * KB,
    added: '2026-08-04T12:00:00Z',
  }),
  game('slug-a', {
    name: 'Brass Hopper',
    genre: 'Shooter',
    tags: ['2d', 'pixel art'],
    bytes: 4 * MB,
    added: '2026-10-03T12:00:00Z',
    source: 'Metal Slug 3',
    series: 'Metal Slug',
    players: '1–4',
  }),
  game('slug-b', {
    name: 'Metal Snail',
    genre: 'Shooter',
    tags: ['2d'],
    bytes: 1 * MB,
    added: '2026-09-21T12:00:00Z',
    source: 'Metal Slug 3',
    series: 'Metal Slug',
  }),
  game('demo', {
    name: 'Shader Garden',
    genre: 'Tech Demo',
    type: 'Tech demo',
    tags: ['webgpu'],
    bytes: 900,
    added: '2026-09-07T12:00:00Z',
  }),
  game('tool', {
    name: 'Level Forge',
    genre: 'Tech Demo',
    type: 'Tool',
    tags: [],
    bytes: 50 * KB,
    added: '2026-09-07T12:00:00Z',
  }),
  game('einhander', {
    name: 'Glass Lance',
    genre: 'Shooter',
    tags: ['3d'],
    bytes: 2 * MB + 5,
    added: '2026-09-30T12:00:00Z',
    source: 'Einhänder',
    model: 'Claude Opus 5.5',
    builds: [{}, {}],
    buildCount: 2,
  }),
];

/* --- the query language --------------------------------------------------- */

test('a field matches any word in its value from the start, ignoring case and accents', () => {
  assert.deepEqual(pick(lib, 'genre:racing'), ['racer']);
  assert.deepEqual(pick(lib, 'Genre:RAC'), ['racer']);
  assert.deepEqual(pick(lib, 'genre:"life sim"'), ['sim']);
  assert.deepEqual(pick(lib, 'genre:sim'), ['sim'], 'a later word of the value counts');
  assert.deepEqual(pick(lib, 'genre:im'), [], 'but not the middle of a word');
  assert.deepEqual(pick(lib, 'source:einhander'), ['einhander']);
  assert.deepEqual(pick(lib, 'source:"metal slug"'), ['slug-a', 'slug-b']);
  assert.deepEqual(pick(lib, 'series:star'), ['flyer']);
  assert.deepEqual(pick(lib, 'tag:pixel'), ['sim', 'slug-a']);
  assert.deepEqual(pick(lib, 'tags:vehicles'), ['racer'], 'tags: is tag:');
});

test('type reads Game for anything uncatalogued, and origin splits original from inspired', () => {
  assert.deepEqual(pick(lib, 'type:demo'), ['demo']);
  assert.deepEqual(pick(lib, 'type:tool'), ['tool']);
  assert.equal(pick(lib, 'type:game').length, 6);
  assert.deepEqual(pick([game('bare', { type: undefined })], 'type:game'), ['bare']);
  assert.deepEqual(pick(lib, 'origin:original'), ['sim', 'demo', 'tool']);
  assert.deepEqual(pick(lib, 'origin:insp'), ['racer', 'flyer', 'slug-a', 'slug-b', 'einhander']);
});

test('a prefix finds every model it starts; = asks for exactly one', () => {
  assert.deepEqual(pick(lib, 'model:gpt'), ['racer', 'flyer']);
  assert.deepEqual(pick(lib, 'model:gpt-6'), ['racer', 'flyer']);
  assert.deepEqual(pick(lib, 'model:="gpt-6"'), ['flyer']);
  assert.deepEqual(pick(lib, 'model:=GPT-6'), ['flyer']);
  assert.deepEqual(pick(lib, 'model:astra'), ['racer']);
});

test('one field twice widens, two fields narrow, a minus leaves out', () => {
  assert.deepEqual(pick(lib, 'genre:racing genre:flight'), ['racer', 'flyer']);
  assert.deepEqual(pick(lib, 'genre:shooter tag:3d'), ['einhander']);
  assert.deepEqual(pick(lib, 'genre:shooter -tag:3d'), ['slug-a', 'slug-b']);
  assert.deepEqual(pick(lib, '-genre:shooter -genre:tech'), ['racer', 'flyer', 'sim']);
  assert.deepEqual(pick(lib, 'genre:shooter -source:metal'), ['einhander']);
});

test('bare words must all be found; quotes keep a phrase; a minus excludes a word', () => {
  assert.deepEqual(pick(lib, 'metal'), ['slug-a', 'slug-b']);
  assert.deepEqual(pick(lib, 'brass hopper'), ['slug-a']);
  assert.deepEqual(pick(lib, '"hopper brass"'), []);
  assert.deepEqual(pick(lib, '"brass hopper"'), ['slug-a']);
  assert.deepEqual(pick(lib, 'metal -snail'), ['slug-a']);
  assert.deepEqual(pick(lib, 'EINHÄNDER'), ['einhander']);
});

test('a field nobody knows is plain text, colon and all', () => {
  const titled = [game('t2', { name: 'Terminator 2: Judgment Day' }), game('other')];
  const parsed = parse('terminator 2: foo:bar');
  assert.deepEqual(
    parsed.terms.map((t) => t.field),
    [null, null, null]
  );
  assert.deepEqual(
    parsed.terms.map((t) => t.value),
    ['terminator', '2:', 'foo:bar']
  );
  assert.deepEqual(pick(titled, 'terminator 2:'), ['t2']);
});

test('players seats a head count; multi and single read like the Wall', () => {
  assert.deepEqual(pick(lib, 'players:2'), ['racer', 'slug-a']);
  assert.deepEqual(pick(lib, 'players:4'), ['slug-a']);
  assert.deepEqual(pick(lib, 'players:multi'), ['racer', 'slug-a']);
  assert.equal(pick(lib, 'players:single').length, 6, 'every game saying nothing seats one; tools seat nobody');
  assert.deepEqual(pick(lib, 'players:>=3'), ['slug-a']);
  assert.deepEqual(pick(lib, 'players:3..4'), ['slug-a']);
  assert.ok(parse('players:lots').terms[0].problem);
});

test('sizes compare in bytes; a range stops short of its end; a bare size is the stretch it names', () => {
  assert.deepEqual(pick(lib, 'size:<500kb'), ['flyer', 'sim', 'demo', 'tool']);
  assert.deepEqual(pick(lib, 'size:>2mb'), ['racer', 'slug-a', 'einhander']);
  assert.deepEqual(pick(lib, 'size:>=4mb'), ['slug-a']);
  assert.deepEqual(pick(lib, 'size:1mb..4mb'), ['racer', 'slug-b', 'einhander'], '1 MB is in, 4 MB is not');
  assert.deepEqual(pick(lib, 'size:4mb..1mb'), pick(lib, 'size:1mb..4mb'), 'a range written backwards still reads');
  assert.deepEqual(pick(lib, 'size:..1kb'), ['demo']);
  assert.deepEqual(pick(lib, 'size:3mb..'), ['racer', 'slug-a']);
  assert.deepEqual(pick(lib, 'size:2mb'), ['einhander'], '2 MB up to 3 MB');
  assert.deepEqual(pick(lib, 'size:0.35m..0.5m'), ['flyer']);
  assert.deepEqual(pick(lib, 'size:<=900'), ['demo']);
  assert.deepEqual(pick(lib, 'size:<900'), []);
  assert.deepEqual(pick([game('unsized', { bytes: 0 })], 'size:<1mb'), [], 'an unknown size is not a small one');
  for (const bad of ['size:big', 'size:<', 'size:1mb..2mb..3mb', 'size:<1mb..2mb', 'size:2xb']) {
    assert.ok(parse(bad).terms[0].problem, bad);
  }
});

test('dates are UTC days: after means after the whole day, ranges include both ends', () => {
  assert.deepEqual(pick(lib, 'added:>2026-09-20'), ['slug-a', 'slug-b', 'einhander']);
  assert.deepEqual(pick(lib, 'added:>=2026-09-20'), ['flyer', 'slug-a', 'slug-b', 'einhander']);
  assert.deepEqual(pick(lib, 'added:<2026-09-07'), ['sim']);
  assert.deepEqual(pick(lib, 'added:<=2026-09-07'), ['sim', 'demo', 'tool']);
  assert.deepEqual(pick(lib, 'added:2026-09-07'), ['demo', 'tool']);
  assert.deepEqual(pick(lib, 'added:2026-09-01..2026-09-15'), ['racer', 'demo', 'tool']);
  assert.deepEqual(pick(lib, 'added:2026-08'), ['sim']);
  assert.equal(pick(lib, 'added:2026').length, lib.length);
  assert.deepEqual(pick(lib, 'added:2026-10..'), ['slug-a']);
  assert.deepEqual(pick(lib, 'added:..2026-08-31'), ['sim']);
  for (const bad of ['added:2026-02-30', 'added:2026-13', 'added:yesterday', 'added:1..2..3']) {
    assert.ok(parse(bad).terms[0].problem, bad);
  }
});

test('an age counts back from now: <7d is this week, >7d is before it', () => {
  assert.deepEqual(pick(lib, 'added:<7d'), ['slug-a', 'einhander']);
  assert.deepEqual(pick(lib, 'added:7d'), ['slug-a', 'einhander']);
  assert.deepEqual(pick(lib, 'added:<1w'), ['slug-a', 'einhander']);
  assert.deepEqual(pick(lib, 'added:>30d'), ['sim']);
  assert.deepEqual(pick(lib, 'added:7d..20d'), ['flyer', 'slug-b']);
  assert.deepEqual(pick(lib, 'is:new'), ['slug-a', 'einhander']);
  assert.deepEqual(pick(lib, 'is:new', { now: NOW + 30 * DAY }), [], 'the clock moves the answer');
});

test('builds count, with ranges that include both ends', () => {
  assert.deepEqual(pick(lib, 'builds:>1'), ['einhander']);
  assert.deepEqual(pick(lib, 'builds:2'), ['einhander']);
  assert.equal(pick(lib, 'builds:1').length, lib.length - 1);
  assert.equal(pick(lib, 'builds:1..2').length, lib.length);
});

test('is: and has: ask what this device and each record know', () => {
  const ctx = { now: NOW, isFave: (slug) => slug === 'sim', isPlayed: (slug) => slug === 'racer' || slug === 'sim' };
  assert.deepEqual(pick(lib, 'is:fav', ctx), ['sim']);
  assert.deepEqual(pick(lib, 'is:favourite', ctx), ['sim']);
  assert.deepEqual(pick(lib, 'is:played -is:fav', ctx), ['racer']);
  assert.deepEqual(pick(lib, 'is:fav'), [], 'without a device, nothing is a favourite');
  assert.deepEqual(pick(lib, 'has:model'), ['racer', 'flyer', 'einhander']);
  assert.equal(pick(lib, '-has:model').length, lib.length - 3);
  assert.deepEqual(pick(lib, 'has:series'), ['flyer', 'slug-a', 'slug-b']);
  assert.ok(parse('is:shiny').terms[0].problem);
  assert.ok(parse('has:wings').terms[0].problem);
});

test('a term that cannot mean anything filters nothing, and an unfinished one is not a term yet', () => {
  assert.equal(pick(lib, 'size:big').length, lib.length);
  assert.equal(pick(lib, 'genre:').length, lib.length);
  assert.equal(pick(lib, 'genre:shooter size:huge').length, 3);
  const [unfinished] = parse('genre:').terms;
  assert.equal(unfinished.incomplete, true);
  assert.equal(isFiltering(parse('genre: -')), false);
  assert.equal(isFiltering(parse('genre:x')), true);
});

test('except leaves one field out, which is how a facet counts its neighbours', () => {
  const parsed = parse('genre:shooter tag:3d');
  assert.equal(select(lib, parsed, { now: NOW }).length, 1);
  assert.deepEqual(slugs(select(lib, parsed, { now: NOW }, { except: 'genre' })), ['racer', 'flyer', 'einhander']);
  assert.equal(matches(lib[3], parsed, { now: NOW }, { except: 'tag' }), true);
});

test('parsing never throws, and every term is exactly the text it came from', () => {
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const alphabet = [
    'genre',
    'size',
    'added',
    'is',
    'model',
    ':',
    '"',
    '-',
    '=',
    '<',
    '>',
    '..',
    ' ',
    'a',
    '2mb',
    '7d',
    '2026-09-01',
    'ü',
    '\t',
    'x:y',
    '/',
    '\\',
  ];
  for (let i = 0; i < 3000; i++) {
    const text = Array.from(
      { length: 1 + Math.floor(random() * 9) },
      () => alphabet[Math.floor(random() * alphabet.length)]
    ).join('');
    const parsed = parse(text);
    let last = 0;
    for (const term of parsed.terms) {
      assert.ok(term.start >= last && term.end > term.start && term.end <= text.length, text);
      assert.equal(term.raw, text.slice(term.start, term.end));
      last = term.end;
    }
    assert.doesNotThrow(() => select(lib, parsed, { now: NOW }), text);
  }
  for (const odd of [null, undefined, 42, '"', '-', '--', ':::', 'genre:"', '-genre:"open'])
    assert.doesNotThrow(() => parse(odd));
});

test('equivalent spellings select the same thing, and say so with the same key', () => {
  const key = (text) => parse(text).terms[0].key;
  assert.equal(key('genre:RPG'), key('genre:"rpg"'));
  assert.equal(key('Genre:rpg'), key('genre:rpg'));
  assert.equal(key('added:2026-09'), key('added:2026-09-01..2026-09-30'));
  assert.equal(key('size:<1mb'), key('size:..1024kb'));
  assert.equal(key('players:multi'), key('players:>=2'));
  assert.notEqual(key('model:gpt-6'), key('model:="gpt-6"'));
});

test('every term says what it does, for its chip', () => {
  const says = (text) => parse(text).terms.map((t) => t.says);
  assert.deepEqual(says('size:<500kb size:>2mb size:1mb..4mb size:2mb size:>=4mb'), [
    'under 500 KB',
    'over 2 MB',
    '1 MB to 4 MB',
    '2 MB to 3 MB',
    '4 MB or more',
  ]);
  assert.deepEqual(
    says('added:>2026-09-20 added:2026-09-01..2026-09-15 added:<7d added:>30d added:2026-08-30..2026-09-02'),
    ['after 20 Sept 2026', '1–15 Sept 2026', 'in the last 7 days', 'more than 30 days ago', '30 Aug – 2 Sept 2026']
  );
  assert.deepEqual(says('builds:>1 builds:2 builds:1..3 players:2 players:multi is:fav "metal slug"'), [
    'more than 1',
    'exactly 2',
    '1 to 3',
    'seats 2',
    'multiplayer',
    'a favourite',
    '“metal slug”',
  ]);
  assert.match(parse('size:big').terms[0].problem, /size/);
});

test('editing the text on someone’s behalf leaves the rest as they wrote it', () => {
  const text = 'orbit  genre:rpg   size:<1mb';
  const parsed = parse(text);
  assert.equal(withoutTerm(text, parsed.terms[1]), 'orbit size:<1mb');
  assert.equal(withoutTerm(text, parsed.terms[0]), 'genre:rpg   size:<1mb');
  assert.equal(withoutTerm(text, parsed.terms[2]), 'orbit  genre:rpg');

  assert.equal(toggleTerm('orbit', 'genre:rpg'), 'orbit genre:rpg');
  assert.equal(toggleTerm('orbit genre:RPG', 'genre:rpg'), 'orbit');
  assert.equal(toggleTerm('orbit genre:rpg size:<1mb', '-genre:rpg'), 'orbit -genre:rpg size:<1mb');
  assert.equal(toggleTerm('', 'genre:"life sim"'), 'genre:"life sim"');

  assert.equal(
    setField('a added:2026-09-01 b added:<7d c', 'added', 'added:2026-09-01..2026-09-03'),
    'a added:2026-09-01..2026-09-03 b c'
  );
  assert.equal(setField('a added:<7d b', 'added', ''), 'a b');
  assert.equal(setField('a', 'added', 'added:<7d'), 'a added:<7d');

  assert.equal(formatTerm('genre', 'life sim'), 'genre:"life sim"');
  assert.equal(formatTerm('model', 'gpt-6', { exact: true, negate: true }), '-model:=gpt-6');
});

test('a chart brush replaces its field’s range, and the same pick twice lets it go', () => {
  assert.equal(brush('orbit', 'added', 'added:2026-09-07'), 'orbit added:2026-09-07');
  assert.equal(brush('orbit added:2026-09-07', 'added', 'added:2026-09-07'), 'orbit');
  assert.equal(
    brush('orbit added:2026-09-07', 'added', 'added:2026-09-01..2026-09-09'),
    'orbit added:2026-09-01..2026-09-09'
  );
  assert.equal(brush('added:<7d size:<1mb added:2026-09', 'added', 'added:2026-09-07'), 'added:2026-09-07 size:<1mb');
  assert.equal(
    brush('-added:2026-09-07', 'added', 'added:2026-09-07'),
    'added:2026-09-07',
    'a negated range is replaced, not toggled'
  );
  assert.equal(brush('size:100kb..200kb', 'size', 'size:100kb..200kb'), '');
});

test('a game naming two models is found by either, counted once in the strip, grouped by the first', () => {
  const pair = game('pair', { model: ['GPT-6', 'Claude Opus 5.5'] });
  const library = [pair, lib[1]];
  assert.deepEqual(pick(library, 'model:claude'), ['pair']);
  assert.deepEqual(pick(library, 'model:="gpt-6"'), ['pair', 'flyer']);
  assert.equal(summarise(library).modelRecords, 2);
  assert.deepEqual(
    summarise(library).models.map((m) => [m.name, m.count]),
    [
      ['GPT-6', 2],
      ['Claude Opus 5.5', 1],
    ]
  );
  assert.deepEqual(
    groupRecords(library, 'model').map((g) => g.label),
    ['GPT-6']
  );
  assert.match(toCSV([pair]).split('\r\n')[1], /,"GPT-6, Claude Opus 5\.5",/);
});

test('every example in the help is a working query', () => {
  for (const { items } of EXAMPLES) {
    for (const [text] of items) {
      const parsed = parse(text);
      assert.ok(parsed.terms.length > 0, text);
      for (const term of parsed.terms) assert.ok(!term.problem && !term.incomplete, text);
    }
  }
});

test('word starts are found in folded text, never mid-word', () => {
  assert.equal(startsWord('tech demo', 'demo'), true);
  assert.equal(startsWord('gpt-6 astra pro', 'astra'), true);
  assert.equal(startsWord('gpt-6 astra pro', 'stra'), false);
  assert.equal(startsWord('punch-out!!', 'out'), true);
});

test('sizes are written and said the way people write them', () => {
  assert.equal(sizeToken(100 * KB), '100kb');
  assert.equal(sizeToken(500), '500b');
  assert.equal(sizeToken(2 * MB), '2mb');
  assert.equal(sizeText(1536), '1.5 KB');
  assert.equal(sizeText(100 * KB), '100 KB');
  assert.equal(sizeText(27246026), '26 MB');
});

/* --- a library shaped like the real one ------------------------------------ */

const catalogue = Object.entries(JSON.parse(readFileSync(new URL('../data/overrides.json', import.meta.url), 'utf8')))
  .filter(([slug, entry]) => !slug.startsWith('_') && !entry.hidden && !entry.restricted)
  .map(([slug, entry], i) =>
    normalize({
      slug,
      name: entry.name || slug,
      ...entry,
      // Sizes spread over five decades, dates over the two months the library was built in.
      bytes: Math.round(900 * 10 ** (((i * 0.6180339887) % 1) * 4.5)),
      added: new Date(Date.UTC(2026, 7, 4) + ((i * 37) % 61) * DAY + 12 * 3600 * 1000).toISOString(),
    })
  );

test('the real catalogue reads: hundreds of records, every facet populated', () => {
  assert.ok(catalogue.length > 300);
  const facets = tallyFacets(catalogue, parse(''), { now: NOW });
  for (const facet of facets) assert.ok(facet.options.length >= 2, facet.field);
  assert.ok(facets.find((f) => f.field === 'tag').options.length <= 24);
  const players = facets.find((f) => f.field === 'players').options.map((o) => o.value);
  assert.deepEqual(players.slice(0, 3), ['Single player', 'Multiplayer', '2 players']);
});

test('the term a facet bar writes selects exactly the records it counted', () => {
  for (const base of ['', 'tag:3d', 'origin:inspired -genre:rpg', 'size:<1mb']) {
    const parsed = parse(base);
    for (const facet of tallyFacets(catalogue, parsed, { now: NOW })) {
      for (const option of facet.options) {
        const text = facet.filtered
          ? toggleTerm(setField(base, facet.field, ''), option.term)
          : toggleTerm(base, option.term);
        const found = select(catalogue, parse(text), { now: NOW }).length;
        assert.equal(found, option.other, `${base} + ${option.term}`);
      }
    }
  }
});

test('a facet counts its own values against everything but itself, in three layers', () => {
  const parsed = parse('genre:shooter tag:3d');
  const facets = tallyFacets(lib, parsed, { now: NOW });
  const genre = facets.find((f) => f.field === 'genre');
  const shooter = genre.options.find((o) => o.value === 'Shooter');
  const racing = genre.options.find((o) => o.value === 'Racing');
  assert.deepEqual([shooter.total, shooter.other, shooter.selected, shooter.pressed], [3, 1, 1, true]);
  assert.deepEqual([racing.total, racing.other, racing.selected, racing.pressed], [1, 1, 0, false]);
  const tags = facets.find((f) => f.field === 'tag');
  assert.deepEqual(
    tags.options.filter((o) => o.other).map((o) => [o.value, o.other]),
    [
      ['3d', 1],
      ['2d', 2],
      ['pixel art', 1],
    ]
  );
  const negated = tallyFacets(lib, parse('-genre:shooter'), { now: NOW }).find((f) => f.field === 'genre');
  assert.equal(negated.options.find((o) => o.value === 'Shooter').excluded, true);
});

test('a value that starts another is written exact, so picking it picks only it', () => {
  const model = tallyFacets(lib, parse(''), { now: NOW }).find((f) => f.field === 'model');
  const terms = Object.fromEntries(model.options.map((o) => [o.value, o.term]));
  assert.equal(terms['GPT-6'], 'model:=gpt-6');
  assert.equal(terms['GPT-6 Astra Pro'], 'model:"gpt-6 astra pro"');
  assert.deepEqual(pick(lib, terms['GPT-6']), ['flyer']);
});

test('size brackets are the Wall’s brackets, to the byte', () => {
  assert.deepEqual(
    SIZE_BRACKETS.map((b) => b.label),
    ['Under 250 KB', '250 KB–1 MB', '1–4 MB', 'Over 4 MB']
  );
  const sizes = [1, 999, 250 * KB - 1, 250 * KB, MB - 1, MB, 4 * MB - 1, 4 * MB, 90 * MB];
  const facet = FACETS.find((f) => f.field === 'size');
  for (const bytes of sizes) assert.deepEqual(facet.values(game('s', { bytes })), [sizeOf(bytes)], String(bytes));
});

test('the days run unbroken from the first addition to the last', () => {
  const { days, from, to } = tallyDays(lib, parse(''), { now: NOW });
  assert.equal(from, Date.UTC(2026, 7, 4));
  assert.equal(to, Date.UTC(2026, 9, 4));
  assert.equal(days.length, 61);
  assert.equal(
    days.reduce((n, d) => n + d.total, 0),
    lib.length
  );
  assert.ok(days.every((d, i) => d.start === from + i * DAY));
  assert.deepEqual(slugs(days.find((d) => d.start === Date.UTC(2026, 8, 7)).games), ['demo', 'tool']);
});

test('a brushed range leaves the other days showing what is outside it', () => {
  const { days } = tallyDays(lib, parse('added:2026-09-15..2026-09-21 genre:shooter'), { now: NOW });
  const at = (iso) => days.find((d) => d.start === Date.parse(iso));
  assert.deepEqual([at('2026-09-21').other, at('2026-09-21').selected], [1, 1]);
  assert.deepEqual([at('2026-10-03').other, at('2026-10-03').selected], [1, 0]);
  assert.deepEqual([at('2026-09-15').other, at('2026-09-15').selected], [0, 0]);
  for (const day of days) assert.ok(day.selected <= day.other && day.other <= day.total);
});

test('size bins climb a 1–2–5 ladder and each bin’s term selects exactly its records', () => {
  assert.deepEqual(sizeEdges(994, 27 * MB), [
    500,
    KB,
    2 * KB,
    5 * KB,
    10 * KB,
    20 * KB,
    50 * KB,
    100 * KB,
    200 * KB,
    500 * KB,
    MB,
    2 * MB,
    5 * MB,
    10 * MB,
    20 * MB,
    50 * MB,
  ]);
  for (const library of [lib, catalogue]) {
    const { bins } = tallySizes(library, parse(''), { now: NOW });
    assert.equal(
      bins.reduce((n, b) => n + b.total, 0),
      library.filter((g) => g.bytes > 0).length
    );
    for (const bin of bins) assert.equal(select(library, parse(bin.term), { now: NOW }).length, bin.total, bin.term);
  }
});

test('the summary strip adds up the selection', () => {
  const s = summarise(lib);
  assert.equal(s.count, 8);
  assert.equal(
    s.bytes,
    lib.reduce((n, g) => n + g.bytes, 0)
  );
  assert.equal(s.originals, 3);
  assert.equal(s.inspired, 5);
  assert.deepEqual(
    s.models.map((m) => m.name),
    ['Claude Opus 5.5', 'GPT-6', 'GPT-6 Astra Pro']
  );
  assert.equal(s.modelRecords, 3);
  assert.equal(s.newest.slug, 'slug-a');
  assert.equal(s.several, 1);
  assert.equal(summarise([lib[0], lib[1]]).median, (3 * MB + 400 * KB) / 2);
  assert.equal(summarise([lib[0], lib[1], lib[2]]).median, 400 * KB);
  assert.equal(summarise([]).newest, null);
});

/* --- sorting and grouping -------------------------------------------------- */

test('a sort is a column and a direction, written in the address', () => {
  assert.deepEqual(readSort('-added'), { key: 'added', dir: -1 });
  assert.deepEqual(readSort('size'), { key: 'size', dir: 1 });
  assert.deepEqual(readSort('nonsense'), { key: 'name', dir: 1 });
  assert.deepEqual(readSort(null), { key: 'name', dir: 1 });
  assert.equal(writeSort({ key: 'name', dir: 1 }), '');
  assert.equal(writeSort({ key: 'added', dir: -1 }), '-added');
  assert.deepEqual(nextSort({ key: 'size', dir: 1 }, 'size'), { key: 'size', dir: -1 });
  assert.deepEqual(nextSort({ key: 'size', dir: -1 }, 'added'), { key: 'added', dir: 1 });
  for (const column of COLUMNS)
    assert.deepEqual(readSort(writeSort({ key: column.key, dir: -1 })), { key: column.key, dir: -1 });
});

test('empty values sink whichever way a column runs, and ties fall back to the name', () => {
  const up = slugs(sortRecords(lib, { key: 'model', dir: 1 }));
  const down = slugs(sortRecords(lib, { key: 'model', dir: -1 }));
  assert.deepEqual(up.slice(0, 3), ['einhander', 'flyer', 'racer']);
  assert.deepEqual(down.slice(0, 3), ['racer', 'flyer', 'einhander']);
  assert.deepEqual(up.slice(3), down.slice(3), 'the rest keep name order either way');
  assert.deepEqual(up.slice(3), ['slug-a', 'tool', 'slug-b', 'sim', 'demo']);
  assert.deepEqual(slugs(sortRecords(lib, { key: 'size', dir: -1 })).slice(0, 2), ['slug-a', 'racer']);
  assert.deepEqual(
    slugs(sortRecords(lib, { key: 'added', dir: 1 })).slice(0, 3),
    ['sim', 'tool', 'demo'],
    'same day: by name'
  );
  assert.deepEqual(
    slugs(sortRecords(lib, { key: 'lineage', dir: 1 })).slice(-3),
    ['tool', 'sim', 'demo'],
    'originals sink'
  );
});

test('groups list biggest first with the catch-all last, and follow a sort on their own column', () => {
  const genre = groupRecords(sortRecords(lib, { key: 'name', dir: 1 }), 'genre');
  assert.deepEqual(
    genre.map((g) => [g.label, g.games.length]),
    [
      ['Shooter', 3],
      ['Tech Demo', 2],
      ['Flight', 1],
      ['Life Sim', 1],
      ['Racing', 1],
    ]
  );
  assert.equal(genre[0].bytes, 4 * MB + MB + 2 * MB + 5);
  const byGenre = groupRecords(sortRecords(lib, { key: 'genre', dir: -1 }), 'genre', {
    sort: { key: 'genre', dir: -1 },
  });
  assert.deepEqual(
    byGenre.map((g) => g.label),
    ['Tech Demo', 'Shooter', 'Racing', 'Life Sim', 'Flight']
  );
  const models = groupRecords(lib, 'model');
  assert.equal(models.at(-1).label, 'No model named');
  assert.equal(models.at(-1).rest, true);
  assert.equal(groupRecords(lib, ''), null);
  assert.equal(readGroup('week'), 'week');
  assert.equal(readGroup('colour'), '');
});

test('lineage groups by series, with one-off sources sharing a bucket and originals apart', () => {
  const groups = groupRecords(lib, 'lineage');
  assert.deepEqual(
    groups.map((g) => [g.label, g.games.length]),
    [
      ['Original', 3],
      ['Metal Slug', 2],
      ['Other sources', 3],
    ]
  );
  const bySort = groupRecords(sortRecords(lib, { key: 'lineage', dir: 1 }), 'lineage', {
    sort: { key: 'lineage', dir: 1 },
  });
  assert.deepEqual(
    bySort.map((g) => g.label),
    ['Metal Slug', 'Other sources', 'Original']
  );
});

test('weeks start on Monday, newest first unless the sort runs oldest first', () => {
  assert.equal(weekOf(Date.parse('2026-09-15T12:00:00Z')), Date.UTC(2026, 8, 14));
  assert.equal(weekOf(Date.parse('2026-09-14T00:00:00Z')), Date.UTC(2026, 8, 14));
  assert.equal(weekOf(Date.parse('2026-09-20T23:59:00Z')), Date.UTC(2026, 8, 14));
  const weeks = groupRecords(lib, 'week');
  assert.equal(weeks[0].label, 'Week of 28 Sept 2026');
  assert.equal(weeks.at(-1).label, 'Week of 3 Aug 2026');
  const oldest = groupRecords(lib, 'week', { sort: { key: 'added', dir: 1 } });
  assert.equal(oldest[0].label, 'Week of 3 Aug 2026');
});

/* --- export -------------------------------------------------------------- */

test('CSV quotes what needs quoting and defuses formulas', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a, b'), '"a, b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell('-12'), '-12');
  assert.equal(csvCell(null), '');
  const csv = toCSV([lib[0], lib[2]], { isFave: (slug) => slug === 'sim' });
  const lines = csv.split('\r\n');
  assert.equal(
    lines[0],
    'Name,Tagline,Genre,Origin,Source,Series,Model,Players,Size (bytes),Added,Builds,Favourite,Slug,Path'
  );
  assert.equal(
    lines[1],
    `Rally Days,,Racing,Inspired,Out Run,Out Run,GPT-6 Astra Pro,1–2,${3 * MB},2026-09-15,1,,racer,`
  );
  assert.match(lines[2], /^Porchlight Post,,Life Sim,Original,,,,,122880,2026-08-04,1,yes,sim,$/);
  assert.equal(lines.at(-1), '');
});

test('Markdown keeps every value inside its cell', () => {
  assert.equal(markdownCell('a | b'), 'a \\| b');
  assert.equal(markdownCell('two\n lines'), 'two lines');
  const md = toMarkdown([lib[3], game('pipe', { name: 'Pipe | Dream [beta]' })], {
    link: (g) => `https://hub/catalogue#/g/${g.slug}`,
  });
  const lines = md.trim().split('\n');
  assert.equal(lines[0], '| Name | Genre | Lineage | Model | Players | Size | Added |');
  assert.equal(lines[1], '| --- | --- | --- | --- | --- | ---: | --- |');
  assert.equal(
    lines[2],
    '| [Brass Hopper](https://hub/catalogue#/g/slug-a) | Shooter | after Metal Slug 3 (Metal Slug) |  | 1–4 | 4 MB | 3 Oct 2026 |'
  );
  assert.match(lines[3], /^\| \[Pipe \\\| Dream \\\[beta\\\]\]\(/);
  assert.equal(lines.length, 4);
});

/* --- keycaps --------------------------------------------------------------- */

const keysOf = (text) =>
  keycaps(text)
    .filter((run) => run.key)
    .map((run) => run.key);

test('keys are picked out of a controls line, and only keys', () => {
  assert.deepEqual(keysOf('WASD or arrows to move, Space to jump'), ['WASD', 'arrows', 'Space']);
  assert.deepEqual(keysOf('A/D or arrows to move, Q/E to rotate, 1–3 for spells'), [
    'A',
    'D',
    'arrows',
    'Q',
    'E',
    '1',
    '3',
  ]);
  assert.deepEqual(keysOf('Ctrl+Z to undo, Esc/P to pause, F5 to save'), ['Ctrl', 'Z', 'Esc', 'P', 'F5']);
  assert.deepEqual(keysOf('E for an E-Tank, right-click/R to reload'), ['E', 'R']);
  assert.deepEqual(keysOf('Q/E to shift gears, E enter/exit, empty space to drift, end turn'), ['Q', 'E', 'E']);
  assert.deepEqual(keysOf('Left/right to carve, Up to tuck, up/down to climb, turn left'), [
    'Left',
    'right',
    'Up',
    'up',
    'down',
  ]);
  assert.deepEqual(keysOf('scroll or +/− to zoom, Click to fire'), ['+', '−']);
  assert.deepEqual(keysOf(['Space play/pause', 'R reset']), ['Space', 'R']);
  assert.deepEqual(keycaps(''), []);
});

test('every controls line in the catalogue comes back whole', () => {
  for (const g of catalogue) {
    if (!g.controls) continue;
    const runs = keycaps(g.controls);
    const text = Array.isArray(g.controls) ? g.controls.join('; ') : g.controls;
    assert.equal(runs.map((run) => run.text ?? run.key).join(''), text, g.slug);
  }
});

/* --- suggestions ------------------------------------------------------------ */

test('a bare word is offered the fields it starts and the values it names', () => {
  const vocabulary = vocabularyOf(lib);
  const fields = suggest('gen', 3, vocabulary);
  assert.equal(fields.items[0].insert, 'genre:');
  const values = suggest('shoo', 4, vocabulary);
  assert.deepEqual(
    values.items.map((i) => i.insert),
    ['genre:shooter']
  );
  assert.equal(
    suggest('a', 1, vocabulary)?.items.some((i) => i.insert === 'added:'),
    true
  );
  assert.equal(suggest('orbit ', 6, vocabulary), null, 'nothing under the caret');
  assert.equal(suggest('"metal', 6, vocabulary), null, 'a phrase is text');
});

test('after a colon, the field’s own values, most common first, written so they select only themselves', () => {
  const vocabulary = vocabularyOf(lib);
  assert.deepEqual(
    suggest('genre:', 6, vocabulary)
      .items.map((i) => i.insert)
      .slice(0, 2),
    ['genre:shooter', 'genre:"tech demo"']
  );
  assert.deepEqual(
    suggest('x model:gpt', 11, vocabulary).items.map((i) => i.insert),
    ['model:=gpt-6', 'model:"gpt-6 astra pro"']
  );
  assert.deepEqual(
    suggest('-tag:pix', 8, vocabulary).items.map((i) => i.insert),
    ['-tag:"pixel art"']
  );
  assert.deepEqual(
    suggest('is:', 3, vocabulary).items.map((i) => i.insert),
    ['is:fav', 'is:played', 'is:new']
  );
  assert.ok(suggest('added:', 6, vocabulary).items.some((i) => i.insert === 'added:2026-09'));
});

test('taking a suggestion rewrites only its own token', () => {
  const vocabulary = vocabularyOf(lib);
  const at = suggest('orbit gen size:<1mb', 9, vocabulary);
  assert.deepEqual(accept('orbit gen size:<1mb', at, at.items[0]), { text: 'orbit genre: size:<1mb', caret: 12 });
  const value = suggest('orbit genre:sh', 14, vocabulary);
  assert.deepEqual(accept('orbit genre:sh', value, value.items[0]), { text: 'orbit genre:shooter ', caret: 20 });
});
