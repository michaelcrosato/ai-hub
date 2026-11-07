/**
 * catalogue/query.js — the Catalogue's query language, as pure functions.
 *
 * The query text is the one source of truth: the address carries it, the
 * chips are read off it, and every facet bar and chart brush writes into it.
 * So parsing must survive anything a person types (it never throws), and any
 * edit made on their behalf must leave the rest of their text as they wrote it.
 *
 *   orbit "metal slug"          bare words and phrases, searched like the Wall
 *   genre:racing                a field: any word in it starting with that
 *   genre:"life sim"            quotes hold a phrase together
 *   model:="gpt-6"              exactly that value, not GPT-6 Astra Pro too
 *   -tag:3d                     a minus leaves matches out
 *   size:<500kb size:1mb..4mb   sizes; a range runs up to, not including, its end
 *   added:>2026-09-20           days are UTC days; months and years work too
 *   added:<7d                   or an age: within the last seven days
 *   builds:>1 players:2         counts; their ranges include both ends
 *   is:fav is:played is:new     what this device knows, and this week's arrivals
 *   has:model origin:original   presence, and the Original or Inspired split
 *
 * One field twice widens (genre:racing genre:flight is either); different
 * fields narrow. A field nobody knows is ordinary text, colon and all, so a
 * title with a colon in it still finds itself.
 */

import { fold, sameKey, playersOf, SINGLE } from '../manifest.js';
import { t, ago, date, lang } from '../lang.js';

export const DAY = 86_400_000;
const KB = 1024;
const MB = KB * KB;
const GB = MB * KB;

/* --- the fields --------------------------------------------------------- */

/** The strings a field carries: one, several (a game may name two models) or none. */
export const valuesOf = (value) =>
  (Array.isArray(value) ? value : [value]).filter((v) => typeof v === 'string' && v.trim());

/**
 * Every field the language knows, by the name typed before the colon. Text
 * fields read the strings a game carries; the rest say how they are parsed.
 * Series is the franchise as the Wall stacks it: the source itself when the
 * catalogue names no series, and nothing for an original.
 */
export const FIELDS = {
  genre: { label: t('catalogue.query.field_genre'), kind: 'text', read: (g) => g.genre },
  type: { label: t('catalogue.query.field_type'), kind: 'text', read: (g) => g.type || 'Game' },
  origin: { label: t('catalogue.query.field_origin'), kind: 'origin' },
  source: { label: t('catalogue.query.field_source'), kind: 'text', read: (g) => g.source },
  series: { label: t('catalogue.query.field_series'), kind: 'text', read: (g) => (g.lineage.original ? null : g.lineage.series) },
  model: { label: t('catalogue.query.field_model'), kind: 'text', read: (g) => g.model },
  tag: { label: t('catalogue.query.field_tag'), kind: 'text', read: (g) => g.tags },
  players: { label: t('catalogue.query.field_players'), kind: 'players' },
  size: { label: t('catalogue.query.field_size'), kind: 'size' },
  added: { label: t('catalogue.query.field_added'), kind: 'date', read: (g) => g.addedAt },
  updated: { label: t('catalogue.query.field_updated'), kind: 'date', read: (g) => g.updatedAt },
  builds: { label: t('catalogue.query.field_builds'), kind: 'count', read: (g) => buildsOf(g) },
  is: { label: t('catalogue.query.field_is'), kind: 'flag' },
  has: { label: t('catalogue.query.field_has'), kind: 'has' },
};

/** Spellings people reach for that mean a known field. */
const ALIASES = { tags: 'tag', player: 'players', build: 'builds', genres: 'genre', models: 'model' };

export const buildsOf = (game) => game.buildCount || game.builds?.length || 1;

/** What `is:` knows, each with the words that reach it. A prefix of any will do. */
const FLAGS = {
  fav: ['fav', 'fave', 'faves', 'favourite', 'favourites', 'favorite', 'favorites', 'starred'],
  played: ['played'],
  new: ['new'],
};

/** Arrivals count as new for this long. */
const NEW_FOR = 7 * DAY;

/** What `has:` can ask about: fields a game may or may not carry. */
const HAS = ['model', 'source', 'series', 'tagline', 'players', 'controls', 'tags', 'description', 'session'];

/** The words on a `has:` chip: the field a game may carry. */
const HAS_SAYS = {
  model: t('catalogue.query.has_model'),
  source: t('catalogue.query.has_source'),
  series: t('catalogue.query.has_series'),
  tagline: t('catalogue.query.has_tagline'),
  players: t('catalogue.query.has_players'),
  controls: t('catalogue.query.has_controls'),
  tags: t('catalogue.query.has_tags'),
  description: t('catalogue.query.has_description'),
  session: t('catalogue.query.has_session'),
};

/** Folded copies of every text field, worked out once per game. */
const foldedFacts = new WeakMap();
function factsOf(game) {
  let facts = foldedFacts.get(game);
  if (!facts) {
    facts = {};
    for (const [key, field] of Object.entries(FIELDS)) {
      if (field.kind === 'text') facts[key] = valuesOf(field.read(game)).map(sameKey);
    }
    foldedFacts.set(game, facts);
  }
  return facts;
}

/** True when `needle` starts a word of `hay`: "demo" in "tech demo", "gpt" in "gpt-6". */
export function startsWord(hay, needle) {
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
    if (at === 0 || !/[\p{L}\p{N}]/u.test(hay[at - 1])) return true;
  }
  return false;
}

/** The head counts a game seats, read the way the Wall reads `players`. */
function seatsOf(game) {
  return playersOf(game)
    .map((value) => (value === SINGLE ? 1 : Number.parseInt(value, 10)))
    .filter(Number.isFinite);
}

/* --- reading values ------------------------------------------------------ */

/** How precisely a number was written: "2" steps by 1, "1.5" by 0.1, "500" by 100. */
function precision(digits) {
  const dot = digits.indexOf('.');
  if (dot !== -1) return 10 ** -(digits.length - dot - 1);
  const zeros = /0*$/.exec(digits)[0].length;
  return zeros === digits.length ? 1 : 10 ** zeros;
}

const UNITS = { '': 1, b: 1, k: KB, kb: KB, kib: KB, m: MB, mb: MB, mib: MB, g: GB, gb: GB, gib: GB };

/** "500kb" → 512000 bytes, stepping by the precision it was written to. */
function readBytes(text) {
  const m = /^(\d+(?:\.\d*)?|\.\d+)([a-z]*)$/i.exec(text);
  const unit = m && UNITS[m[2].toLowerCase()];
  if (!unit) return null;
  return { at: Number(m[1]) * unit, step: precision(m[1].replace(/\.$/, '')) * unit };
}

function readCount(text) {
  return /^\d+$/.test(text) ? { at: Number(text), step: 1 } : null;
}

/**
 * Comparisons and ranges over a quantity, as a half-open interval [lo, hi).
 * A bare value is the stretch it was written to (`size:2mb` is 2 MB up to
 * 3 MB). Counts include both ends of a range; sizes, being continuous, run
 * up to their end: `size:1mb..4mb` stops short of 4 MB.
 */
function readInterval(value, read, { inclusive }) {
  const m = /^(<=|>=|<|>|=)?(.*)$/.exec(value.replace(/\s+/g, ''));
  const op = m[1] || '';
  const body = m[2];
  const cut = body.indexOf('..');
  if (cut !== -1) {
    const [left, right] = [body.slice(0, cut), body.slice(cut + 2)];
    if (op || right.includes('..') || (!left && !right)) return null;
    const a = left ? read(left) : { at: 0, step: 0 };
    const b = right ? read(right) : { at: Infinity, step: 0 };
    if (!a || !b) return null;
    const [low, high] = a.at <= b.at ? [a, b] : [b, a];
    return {
      op: 'range',
      lo: low.at,
      hi: inclusive && Number.isFinite(high.at) ? high.at + high.step : high.at,
      open: [!left, !right],
    };
  }
  const q = read(body);
  if (!q) return null;
  switch (op) {
    case '<':
      return { op, lo: 0, hi: q.at };
    case '<=':
      return { op, lo: 0, hi: Math.floor(q.at) + 1 };
    case '>':
      return { op, lo: Math.floor(q.at) + 1, hi: Infinity };
    case '>=':
      return { op, lo: Math.ceil(q.at), hi: Infinity };
    case '=':
      return { op, lo: q.at, hi: Math.floor(q.at) + 1 };
    default:
      return { op, lo: q.at, hi: q.at + q.step };
  }
}

/* --- dates ---------------------------------------------------------------- */

const AGE_UNITS = { h: 3_600_000, d: DAY, w: 7 * DAY };
const AGE_WORDS = { h: 'hour', d: 'day', w: 'week' };

/**
 * One end of a date: a calendar day, month or year (UTC, the days the
 * catalogue counts in), or an age back from now.
 */
function readDate(text) {
  const age = /^(\d+(?:\.\d+)?)([hdw])$/i.exec(text);
  if (age) {
    const unit = age[2].toLowerCase();
    return { age: Number(age[1]) * AGE_UNITS[unit], n: Number(age[1]), unit };
  }
  const m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), m[2] && Number(m[2]), m[3] && Number(m[3])];
  if (mo !== undefined && (mo < 1 || mo > 12)) return null;
  const start = Date.UTC(y, (mo || 1) - 1, d || 1);
  if (d !== undefined && new Date(start).getUTCDate() !== d) return null;
  const end = d ? start + DAY : mo ? Date.UTC(y, mo, 1) : Date.UTC(y + 1, 0, 1);
  return { start, end, grain: d ? 'day' : mo ? 'month' : 'year' };
}

/** Where a date end sits on the clock at `now`: ages are instants, days are stretches. */
const span = (end, now) => (end.age !== undefined ? [now - end.age, now - end.age] : [end.start, end.end]);

/**
 * A date term as a function of now, because `added:<7d` moves with the clock.
 * An age compares backwards: `<7d` is younger than a week, so later than its
 * instant.
 */
function readDateInterval(value) {
  const m = /^(<=|>=|<|>|=)?(.*)$/.exec(value.replace(/\s+/g, ''));
  const op = m[1] || '';
  const body = m[2];
  const cut = body.indexOf('..');
  if (cut !== -1) {
    const [left, right] = [body.slice(0, cut), body.slice(cut + 2)];
    if (op || right.includes('..') || (!left && !right)) return null;
    const a = left ? readDate(left) : null;
    const b = right ? readDate(right) : null;
    if ((left && !a) || (right && !b)) return null;
    return {
      op: 'range',
      a,
      b,
      bounds(now) {
        const ends = [a, b].filter(Boolean).map((end) => span(end, now));
        const lo = Math.min(...ends.map(([s]) => s));
        const hi = Math.max(...ends.map(([, e]) => e));
        return [a && b ? lo : a ? lo : -Infinity, a && b ? hi : b ? hi : Infinity];
      },
    };
  }
  const end = readDate(body);
  if (!end) return null;
  if (end.age !== undefined) {
    const older = op === '>' || op === '>=';
    return { op, a: end, bounds: (now) => (older ? [-Infinity, now - end.age] : [now - end.age, Infinity]) };
  }
  const table = {
    '<': [-Infinity, end.start],
    '<=': [-Infinity, end.end],
    '>': [end.end, Infinity],
    '>=': [end.start, Infinity],
  };
  const fixed = table[op] || [end.start, end.end];
  return { op, a: end, bounds: () => fixed };
}

/* --- words for the chips --------------------------------------------------- */

/** "1.5 KB", "100 KB", "2 MB": sizes as the chips and axes say them. */
export function sizeText(n) {
  if (!Number.isFinite(n)) return '∞';
  const three = (value) => Number(value.toPrecision(3));
  if (n < KB) return t('catalogue.query.size_b', { value: three(n) });
  if (n < MB) return t('catalogue.query.size_kb', { value: three(n / KB) });
  if (n < GB) return t('catalogue.query.size_mb', { value: three(n / MB) });
  return t('catalogue.query.size_gb', { value: three(n / GB) });
}

/** The shortest way to write a size in a query: 102400 → "100kb". */
export function sizeToken(n) {
  const [value, unit] = n < KB ? [n, 'b'] : n < MB ? [n / KB, 'kb'] : n < GB ? [n / MB, 'mb'] : [n / GB, 'gb'];
  return `${Number(value.toFixed(2))}${unit}`;
}

const DAY_STYLE = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
const MONTH = { month: 'short', year: 'numeric', timeZone: 'UTC' };

/** "15 Sep 2026", in UTC like every day the Catalogue counts. */
export const dayText = (ms) => date(ms, DAY_STYLE);

/** "2026-09-15": a day as the query writes it. */
export const dayToken = (ms) => new Date(ms).toISOString().slice(0, 10);

/** An age as the chips say it: "3 days ago", "1 hour ago". */
const ageText = (end) => ago(-end.n, AGE_WORDS[end.unit], { numeric: 'always' });

function dateEndText(end) {
  if (end.age !== undefined) return ageText(end);
  if (end.grain === 'year') return date(end.start, { year: 'numeric', timeZone: 'UTC' });
  return end.grain === 'month' ? date(end.start, MONTH) : dayText(end.start);
}

/** "1–15 Sep 2026" rather than the same month and year twice, as the language writes it. */
const dayRangeText = (a, b) => new Intl.DateTimeFormat(lang, DAY_STYLE).formatRange(a.start, b.start);

function dateSays(range) {
  const { op, a, b } = range;
  if (op === 'range') {
    if (a && b && a.grain === 'day' && b.grain === 'day')
      return dayRangeText(a.start <= b.start ? a : b, a.start <= b.start ? b : a);
    if (a && b && a.age !== undefined && b.age !== undefined) {
      const [near, far] = a.age <= b.age ? [a, b] : [b, a];
      if (near.unit !== far.unit) return t('catalogue.query.date_range', { from: dateEndText(near), to: dateEndText(far) });
      const values = { count: far.n, near: near.n, far: far.n };
      if (far.unit === 'h') return t('catalogue.query.age_range_hours', values);
      if (far.unit === 'd') return t('catalogue.query.age_range_days', values);
      return t('catalogue.query.age_range_weeks', values);
    }
    if (a && b) return t('catalogue.query.date_range', { from: dateEndText(a), to: dateEndText(b) });
    return a
      ? t('catalogue.query.date_from', { when: dateEndText(a) })
      : t('catalogue.query.date_upto', { when: dateEndText(b) });
  }
  if (a.age !== undefined) {
    if (op === '>' || op === '>=') return t('catalogue.query.date_older', { age: dateEndText(a) });
    if (a.unit === 'h') return t('catalogue.query.date_last_hours', { count: a.n });
    if (a.unit === 'd') return t('catalogue.query.date_last_days', { count: a.n });
    return t('catalogue.query.date_last_weeks', { count: a.n });
  }
  const when = dateEndText(a);
  if (op === '<') return t('catalogue.query.date_before', { when });
  if (op === '<=') return t('catalogue.query.date_on_or_before', { when });
  if (op === '>') return t('catalogue.query.date_after', { when });
  if (op === '>=') return t('catalogue.query.date_on_or_after', { when });
  return a.grain === 'day' ? t('catalogue.query.date_on', { when }) : t('catalogue.query.date_in', { when });
}

function sizeSays({ op, lo, hi, open }) {
  if (op === '<') return t('catalogue.query.size_under', { size: sizeText(hi) });
  if (op === '<=') return t('catalogue.query.size_at_most', { size: sizeText(hi - 1) });
  if (op === '>') return t('catalogue.query.size_over', { size: sizeText(lo - 1) });
  if (op === '>=') return t('catalogue.query.size_at_least', { size: sizeText(lo) });
  if (op === '=') return t('catalogue.query.size_exactly', { count: lo });
  if (open?.[0]) return t('catalogue.query.size_under', { size: sizeText(hi) });
  if (open?.[1]) return t('catalogue.query.size_at_least', { size: sizeText(lo) });
  return t('catalogue.query.size_between', { from: sizeText(lo), to: sizeText(hi) });
}

/** Said the way it was typed: `>1` is "more than 1", not the equal "2 or more". */
function countSays({ op, lo, hi }) {
  if (op === '>') return t('catalogue.query.count_more', { number: lo - 1 });
  if (op === '<') return t('catalogue.query.count_fewer', { number: hi });
  if (hi === Infinity) return t('catalogue.query.count_at_least', { number: lo });
  if (lo <= 0) return t('catalogue.query.count_at_most', { number: hi - 1 });
  if (hi - lo === 1) return t('catalogue.query.count_exactly', { number: lo });
  return t('catalogue.query.count_between', { from: lo, to: hi - 1 });
}

function playersSays({ lo, hi }) {
  if (lo === 1 && hi === 2) return t('catalogue.query.players_single');
  if (lo === 2 && hi === Infinity) return t('catalogue.query.players_multi');
  if (hi - lo === 1) return t('catalogue.query.seats_exactly', { number: lo });
  if (hi === Infinity) return t('catalogue.query.seats_at_least', { number: lo });
  if (lo <= 1) return t('catalogue.query.seats_at_most', { number: hi - 1 });
  return t('catalogue.query.seats_between', { from: lo, to: hi - 1 });
}

/* --- building a term ------------------------------------------------------ */

/**
 * Each kind turns a value into what a term needs: a `key` saying what it
 * selects (so a facet can tell its own term from any other), a `test`, and
 * `says`, the words on its chip. Or `problem`, when the value cannot mean
 * anything for that field: the chip says why and the term filters nothing.
 */
const KINDS = {
  text(value, { field, exact }) {
    const needle = sameKey(value);
    return {
      key: `${field}:${exact ? '=' : ''}${needle}`,
      test: (game) => factsOf(game)[field].some((hay) => (exact ? hay === needle : startsWord(hay, needle))),
      says: exact ? t('catalogue.query.text_exactly', { value }) : value,
    };
  },

  origin(value) {
    const v = sameKey(value);
    const hit = ['original', 'inspired'].find((o) => o.startsWith(v));
    if (!hit) return { problem: t('catalogue.query.problem_origin') };
    return {
      key: `origin:${hit}`,
      test: (game) => (game.lineage.original ? 'original' : 'inspired') === hit,
      says: hit === 'original' ? t('catalogue.query.origin_original') : t('catalogue.query.origin_inspired'),
    };
  },

  players(value) {
    const v = sameKey(value);
    const words = [
      [['single', 'solo', 'one'], { lo: 1, hi: 2 }],
      [['multi', 'multiplayer', 'together', 'co-op', 'coop', 'versus'], { lo: 2, hi: Infinity }],
    ];
    const named = words.find(([list]) => list.some((w) => w.startsWith(v)))?.[1];
    const range = named || readInterval(value, readCount, { inclusive: true });
    if (!range) return { problem: t('catalogue.query.problem_players') };
    const { lo, hi } = range;
    return {
      key: `players:${lo}..${hi}`,
      test: (game) => seatsOf(game).some((n) => n >= lo && n < hi),
      says: playersSays(range),
    };
  },

  size(value) {
    const range = readInterval(value, readBytes, { inclusive: false });
    if (!range) return { problem: t('catalogue.query.problem_size') };
    const { lo, hi } = range;
    return {
      key: `size:${lo}..${hi}`,
      range,
      test: (game) => game.bytes > 0 && game.bytes >= lo && game.bytes < hi,
      says: sizeSays(range),
    };
  },

  count(value, { field, spec }) {
    const range = readInterval(value, readCount, { inclusive: true });
    if (!range) return { problem: t('catalogue.query.problem_count') };
    const { lo, hi } = range;
    return {
      key: `${field}:${lo}..${hi}`,
      test: (game) => {
        const n = spec.read(game);
        return n >= lo && n < hi;
      },
      says: countSays(range),
    };
  },

  date(value, { field, spec }) {
    const range = readDateInterval(value);
    if (!range) return { problem: t('catalogue.query.problem_date') };
    const fixed = range.a?.age === undefined && range.b?.age === undefined;
    return {
      key: fixed ? `${field}:${range.bounds(0).join('..')}` : `${field}:${value.replace(/\s+/g, '').toLowerCase()}`,
      bounds: range.bounds,
      test: (game, ctx) => {
        const at = spec.read(game);
        if (!at) return false;
        const [lo, hi] = range.bounds(ctx.now);
        return at >= lo && at < hi;
      },
      says: dateSays(range),
    };
  },

  flag(value) {
    const v = sameKey(value);
    const hit = Object.keys(FLAGS).find((flag) => FLAGS[flag].some((word) => word.startsWith(v)));
    if (!hit) return { problem: t('catalogue.query.problem_flag') };
    const tests = {
      fav: (game, ctx) => ctx.isFave(game.slug),
      played: (game, ctx) => ctx.isPlayed(game.slug),
      new: (game, ctx) => game.addedAt > 0 && game.addedAt >= ctx.now - NEW_FOR,
    };
    const says = {
      fav: t('catalogue.query.flag_fav'),
      played: t('catalogue.query.flag_played'),
      new: t('catalogue.query.flag_new'),
    };
    return { key: `is:${hit}`, flag: hit, test: tests[hit], says: says[hit] };
  },

  has(value) {
    const v = sameKey(value);
    const hit = HAS.find((name) => name.startsWith(v));
    if (!hit) return { problem: t('catalogue.query.problem_has', { keywords: HAS.join(', ') }) };
    return { key: `has:${hit}`, test: (game) => valuesOf(game[hit]).length > 0, says: HAS_SAYS[hit] };
  },
};

/* --- reading the text ------------------------------------------------------- */

const SPACE = /\s/;
const FIELD_NAME = /([A-Za-z]+):/y;

/** Split the text into raw tokens, remembering exactly where each one sits. */
function* tokens(text) {
  const n = text.length;
  let i = 0;
  while (i < n) {
    while (i < n && SPACE.test(text[i])) i++;
    if (i >= n) return;
    const start = i;
    let negate = false;
    if (text[i] === '-' && i + 1 < n && !SPACE.test(text[i + 1])) {
      negate = true;
      i++;
    }
    FIELD_NAME.lastIndex = i;
    const named = FIELD_NAME.exec(text);
    let name = null;
    let exact = false;
    if (named) {
      name = named[1];
      i = FIELD_NAME.lastIndex;
      if (text[i] === '=') {
        exact = true;
        i++;
      }
    }
    let value;
    let quoted = false;
    if (text[i] === '"') {
      quoted = true;
      const close = text.indexOf('"', i + 1);
      value = text.slice(i + 1, close === -1 ? n : close);
      i = close === -1 ? n : close + 1;
    } else {
      const from = i;
      while (i < n && !SPACE.test(text[i])) i++;
      value = text.slice(from, i);
    }
    yield { start, end: i, negate, name, exact, quoted, value };
  }
}

function termOf(token, text) {
  const base = { raw: text.slice(token.start, token.end), start: token.start, end: token.end, negate: token.negate };
  const named = token.name?.toLowerCase();
  const field = named && FIELDS[ALIASES[named] || named] ? ALIASES[named] || named : null;

  if (!field) {
    const value = token.name ? `${token.name}:${token.exact ? '=' : ''}${token.value}` : token.value;
    const phrase = sameKey(value);
    if (!phrase || phrase === '-') return { ...base, field: null, value, incomplete: true };
    return {
      ...base,
      field: null,
      value,
      quoted: token.quoted,
      key: `text:${phrase}`,
      test: (game) => (game.search || '').includes(phrase),
      says: token.quoted ? t('catalogue.query.phrase', { value }) : value,
    };
  }

  const spec = FIELDS[field];
  const value = token.value.trim();
  const shape = { ...base, field, kind: spec.kind, value, exact: token.exact, quoted: token.quoted };
  if (!value) return { ...shape, incomplete: true };
  const built = KINDS[spec.kind](value, { field, spec, exact: token.exact });
  return { ...shape, ...built };
}

/** Terms grouped the way they combine: fields AND together, a field's own terms OR. */
function groupTerms(terms) {
  const fields = new Map();
  const text = [];
  for (const term of terms) {
    if (term.incomplete || term.problem) continue;
    if (!term.field) {
      text.push(term);
      continue;
    }
    if (!fields.has(term.field)) fields.set(term.field, { any: [], none: [] });
    fields.get(term.field)[term.negate ? 'none' : 'any'].push(term);
  }
  return { fields, text };
}

/**
 * Read a query. Every term keeps where it sits in the text (`start`, `end`),
 * so a chip's × can take out exactly that term and nothing else.
 */
export function parse(text = '') {
  const source = typeof text === 'string' ? text : String(text ?? '');
  const terms = [];
  for (const token of tokens(source)) {
    try {
      terms.push(termOf(token, source));
    } catch {
      // Belt and braces: nothing typed may break the page. A token that
      // somehow cannot be read is left out of the filter, not thrown.
      terms.push({ raw: source.slice(token.start, token.end), start: token.start, end: token.end, incomplete: true });
    }
  }
  return { text: source, terms, groups: groupTerms(terms) };
}

/** True when the query actually narrows anything. */
export const isFiltering = (parsed) => parsed.groups.text.length > 0 || parsed.groups.fields.size > 0;

const nobody = () => false;

/** The context every test reads: the clock and what this device remembers. */
export const contextOf = (ctx = {}) => ({
  now: ctx.now ?? Date.now(),
  isFave: ctx.isFave || nobody,
  isPlayed: ctx.isPlayed || nobody,
});

/**
 * Does one game pass? `except` leaves one field's terms out: a facet counts
 * against every other filter, so its other values still say what picking
 * them instead would give.
 */
export function matches(game, parsed, ctx = {}, { except = null } = {}) {
  const c = ctx.now !== undefined && ctx.isFave && ctx.isPlayed ? ctx : contextOf(ctx);
  for (const term of parsed.groups.text) if (term.test(game, c) === term.negate) return false;
  for (const [field, { any, none }] of parsed.groups.fields) {
    if (field === except) continue;
    if (any.length && !any.some((term) => term.test(game, c))) return false;
    if (none.some((term) => term.test(game, c))) return false;
  }
  return true;
}

/** Every game that passes, in the order given. */
export function select(games, parsed, ctx = {}, options = {}) {
  const c = contextOf(ctx);
  return games.filter((game) => matches(game, parsed, c, options));
}

/* --- editing the text on someone's behalf -------------------------------- */

/** How a field and value are written, quoted when the value has a space in it. */
export function formatTerm(field, value, { negate = false, exact = false } = {}) {
  const text = String(value).replace(/"/g, '');
  const body = /\s/.test(text) || !text ? `"${text}"` : text;
  return `${negate ? '-' : ''}${field}:${exact ? '=' : ''}${body}`;
}

/** The text with one term taken out, and the gap it leaves closed up. */
export function withoutTerm(text, term) {
  const before = text.slice(0, term.start).replace(/\s+$/, '');
  const after = text.slice(term.end).replace(/^\s+/, '');
  return before && after ? `${before} ${after}` : before + after;
}

const append = (text, written) => (text.trim() ? `${text.replace(/\s+$/, '')} ${written}` : written);

/**
 * Add a term, or take it out if the very same one is there already: what
 * clicking a facet bar does. Written negated, it flips a term that is there
 * the other way round.
 */
export function toggleTerm(text, written) {
  const [next] = parse(written).terms;
  if (!next?.key) return text;
  const same = parse(text).terms.find((term) => term.key === next.key);
  if (!same) return append(text, written);
  if (same.negate === next.negate) return withoutTerm(text, same);
  return text.slice(0, same.start) + written + text.slice(same.end);
}

/**
 * Put one term in place of every term on its field (or none, given nothing):
 * what a brush writes. The first one keeps its place in the text.
 */
export function setField(text, field, written) {
  const terms = parse(text).terms.filter((term) => term.field === field);
  if (!terms.length) return written ? append(text, written) : text;
  let out = text;
  for (const term of terms.slice(1).reverse()) out = withoutTerm(out, term);
  const [first] = terms;
  return written ? out.slice(0, first.start) + written + out.slice(first.end) : withoutTerm(out, first);
}

/**
 * What a chart writes when you pick a range on it: that range in place of the
 * field's terms, or nothing, if that range was already the only one there,
 * so picking the same column twice lets it go again.
 */
export function brush(text, field, written) {
  const own = parse(text).terms.filter((term) => term.field === field && !term.incomplete);
  const key = written && parse(written).terms[0]?.key;
  if (own.length === 1 && key && own[0].key === key && !own[0].negate) return setField(text, field, '');
  return setField(text, field, written);
}

/* --- what the help lists -------------------------------------------------- */

/** The syntax, by example. Each one is a working query; clicking one adds it. */
export const EXAMPLES = [
  {
    title: t('catalogue.query.examples_fields'),
    items: [
      ['genre:racing', t('catalogue.query.example_genre')],
      ['genre:"life sim"', t('catalogue.query.example_quotes')],
      ['model:gpt', t('catalogue.query.example_model')],
      ['source:"metal slug"', t('catalogue.query.example_source')],
      ['series:"final fantasy"', t('catalogue.query.example_series')],
      ['tag:pixel', t('catalogue.query.example_tag')],
      ['type:demo', t('catalogue.query.example_type')],
      ['origin:original', t('catalogue.query.example_origin')],
      ['players:2', t('catalogue.query.example_players')],
    ],
  },
  {
    title: t('catalogue.query.examples_sizes'),
    items: [
      ['size:<500kb', t('catalogue.query.example_size_under')],
      ['size:1mb..4mb', t('catalogue.query.example_size_range')],
      ['added:>2026-09-20', t('catalogue.query.example_added_after')],
      ['added:2026-09-01..2026-09-15', t('catalogue.query.example_added_range')],
      ['added:<7d', t('catalogue.query.example_added_week')],
      ['builds:>1', t('catalogue.query.example_builds')],
    ],
  },
  {
    title: t('catalogue.query.examples_flags'),
    items: [
      ['is:fav', t('catalogue.query.example_fav')],
      ['is:played', t('catalogue.query.example_played')],
      ['is:new', t('catalogue.query.example_new')],
      ['has:model', t('catalogue.query.example_has_model')],
      ['has:session', t('catalogue.query.example_has_session')],
    ],
  },
  {
    title: t('catalogue.query.examples_combining'),
    items: [
      ['-genre:shooter', t('catalogue.query.example_minus')],
      ['genre:racing genre:flight', t('catalogue.query.example_either')],
      ['genre:rpg tag:3d', t('catalogue.query.example_both')],
      ['orbit', t('catalogue.query.example_bare')],
    ],
  },
];
