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
  genre: { label: 'Genre', kind: 'text', read: (g) => g.genre },
  type: { label: 'Type', kind: 'text', read: (g) => g.type || 'Game' },
  origin: { label: 'Origin', kind: 'origin' },
  source: { label: 'Source', kind: 'text', read: (g) => g.source },
  series: { label: 'Series', kind: 'text', read: (g) => (g.lineage.original ? null : g.lineage.series) },
  model: { label: 'Model', kind: 'text', read: (g) => g.model },
  tag: { label: 'Tag', kind: 'text', read: (g) => g.tags },
  players: { label: 'Players', kind: 'players' },
  size: { label: 'Size', kind: 'size' },
  added: { label: 'Added', kind: 'date', read: (g) => g.addedAt },
  updated: { label: 'Updated', kind: 'date', read: (g) => g.updatedAt },
  builds: { label: 'Builds', kind: 'count', read: (g) => buildsOf(g) },
  is: { label: 'Is', kind: 'flag' },
  has: { label: 'Has', kind: 'has' },
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
  const [value, unit] = n < KB ? [n, 'B'] : n < MB ? [n / KB, 'KB'] : n < GB ? [n / MB, 'MB'] : [n / GB, 'GB'];
  return `${Number(value.toPrecision(3))} ${unit}`;
}

/** The shortest way to write a size in a query: 102400 → "100kb". */
export function sizeToken(n) {
  const [value, unit] = n < KB ? [n, 'b'] : n < MB ? [n / KB, 'kb'] : n < GB ? [n / MB, 'mb'] : [n / GB, 'gb'];
  return `${Number(value.toFixed(2))}${unit}`;
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH_FORMAT = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "15 Sep 2026", in UTC like every day the Catalogue counts. */
export const dayText = (ms) => DAY_FORMAT.format(ms);

/** "2026-09-15": a day as the query writes it. */
export const dayToken = (ms) => new Date(ms).toISOString().slice(0, 10);

function dateEndText(end) {
  if (end.age !== undefined) return `${end.n} ${AGE_WORDS[end.unit]}${end.n === 1 ? '' : 's'} ago`;
  if (end.grain === 'year') return String(new Date(end.start).getUTCFullYear());
  return end.grain === 'month' ? MONTH_FORMAT.format(end.start) : dayText(end.start);
}

/** "1–15 Sep 2026" rather than the same month and year twice. */
function dayRangeText(a, b) {
  const [x, y] = [new Date(a.start), new Date(b.start)];
  const sameYear = x.getUTCFullYear() === y.getUTCFullYear();
  if (sameYear && x.getUTCMonth() === y.getUTCMonth()) return `${x.getUTCDate()}–${dayText(b.start)}`;
  if (sameYear) return `${dayText(a.start).replace(/ \d{4}$/, '')} – ${dayText(b.start)}`;
  return `${dayText(a.start)} – ${dayText(b.start)}`;
}

function dateSays(range) {
  const { op, a, b } = range;
  if (op === 'range') {
    if (a && b && a.grain === 'day' && b.grain === 'day')
      return dayRangeText(a.start <= b.start ? a : b, a.start <= b.start ? b : a);
    if (a && b && a.age !== undefined && b.age !== undefined) {
      const [near, far] = a.age <= b.age ? [a, b] : [b, a];
      return near.unit === far.unit
        ? `${near.n} to ${dateEndText(far)}`
        : `${dateEndText(near)} to ${dateEndText(far)}`;
    }
    if (a && b) return `${dateEndText(a)} to ${dateEndText(b)}`;
    return a ? `from ${dateEndText(a)}` : `up to ${dateEndText(b)}`;
  }
  if (a.age !== undefined) {
    const span = a.n === 1 ? AGE_WORDS[a.unit] : `${a.n} ${AGE_WORDS[a.unit]}s`;
    return op === '>' || op === '>=' ? `more than ${dateEndText(a)}` : `in the last ${span}`;
  }
  const when = dateEndText(a);
  return (
    { '<': `before ${when}`, '<=': `on or before ${when}`, '>': `after ${when}`, '>=': `on or after ${when}` }[op] ||
    (a.grain === 'day' ? `on ${when}` : `in ${when}`)
  );
}

function sizeSays({ op, lo, hi, open }) {
  if (op === '<') return `under ${sizeText(hi)}`;
  if (op === '<=') return `${sizeText(hi - 1)} or less`;
  if (op === '>') return `over ${sizeText(lo - 1)}`;
  if (op === '>=') return `${sizeText(lo)} or more`;
  if (op === '=') return `exactly ${lo} bytes`;
  if (open?.[0]) return `under ${sizeText(hi)}`;
  if (open?.[1]) return `${sizeText(lo)} or more`;
  return `${sizeText(lo)} to ${sizeText(hi)}`;
}

/** Said the way it was typed: `>1` is "more than 1", not the equal "2 or more". */
function countSays({ op, lo, hi }) {
  if (op === '>') return `more than ${lo - 1}`;
  if (op === '<') return `fewer than ${hi}`;
  if (hi === Infinity) return `${lo} or more`;
  if (lo <= 0) return `${hi - 1} or fewer`;
  if (hi - lo === 1) return `exactly ${lo}`;
  return `${lo} to ${hi - 1}`;
}

function playersSays({ lo, hi }) {
  if (lo === 1 && hi === 2) return 'single player';
  if (lo === 2 && hi === Infinity) return 'multiplayer';
  if (hi - lo === 1) return `seats ${lo}`;
  if (hi === Infinity) return `seats ${lo} or more`;
  if (lo <= 1) return `seats up to ${hi - 1}`;
  return `seats ${lo} to ${hi - 1}`;
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
      says: exact ? `exactly ${value}` : value,
    };
  },

  origin(value) {
    const v = sameKey(value);
    const hit = ['original', 'inspired'].find((o) => o.startsWith(v));
    if (!hit) return { problem: 'is original or inspired' };
    return {
      key: `origin:${hit}`,
      test: (game) => (game.lineage.original ? 'original' : 'inspired') === hit,
      says: hit,
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
    if (!range) return { problem: 'is a head count like 2, or multi' };
    const { lo, hi } = range;
    return {
      key: `players:${lo}..${hi}`,
      test: (game) => seatsOf(game).some((n) => n >= lo && n < hi),
      says: playersSays(range),
    };
  },

  size(value) {
    const range = readInterval(value, readBytes, { inclusive: false });
    if (!range) return { problem: 'is a size like <500kb or 1mb..4mb' };
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
    if (!range) return { problem: 'is a count like 2, >1 or 1..3' };
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
    if (!range) return { problem: 'is a date like 2026-09-20, a range a..b, or an age like <7d' };
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
    if (!hit) return { problem: 'is fav, played or new' };
    const tests = {
      fav: (game, ctx) => ctx.isFave(game.slug),
      played: (game, ctx) => ctx.isPlayed(game.slug),
      new: (game, ctx) => game.addedAt > 0 && game.addedAt >= ctx.now - NEW_FOR,
    };
    const says = { fav: 'a favourite', played: 'played here', new: 'new this week' };
    return { key: `is:${hit}`, flag: hit, test: tests[hit], says: says[hit] };
  },

  has(value) {
    const v = sameKey(value);
    const hit = HAS.find((name) => name.startsWith(v));
    if (!hit) return { problem: `is one of ${HAS.join(', ')}` };
    return { key: `has:${hit}`, test: (game) => valuesOf(game[hit]).length > 0, says: hit };
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
      says: token.quoted ? `“${value}”` : value,
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
    title: 'Fields',
    items: [
      ['genre:racing', 'A genre, or the start of one'],
      ['genre:"life sim"', 'Quotes keep words together'],
      ['model:gpt', 'Built by any GPT model'],
      ['source:"metal slug"', 'Attempts at a classic'],
      ['series:"final fantasy"', 'Anything in a series'],
      ['tag:pixel', 'A tag'],
      ['type:demo', 'Tech demos (or game, tool)'],
      ['origin:original', 'Its own idea (or inspired)'],
      ['players:2', 'Seats two; players:multi for any'],
    ],
  },
  {
    title: 'Sizes, dates and counts',
    items: [
      ['size:<500kb', 'Under 500 KB'],
      ['size:1mb..4mb', 'From 1 MB up to 4 MB'],
      ['added:>2026-09-20', 'Added after 20 September'],
      ['added:2026-09-01..2026-09-15', 'Both days included'],
      ['added:<7d', 'In the last seven days'],
      ['builds:>1', 'More than one build'],
    ],
  },
  {
    title: 'Flags',
    items: [
      ['is:fav', 'Your favourites'],
      ['is:played', 'Played on this device'],
      ['is:new', 'Added this week'],
      ['has:model', 'Names the model that made it'],
      ['has:session', 'Plays in an AI Hub session'],
    ],
  },
  {
    title: 'Combining',
    items: [
      ['-genre:shooter', 'A minus leaves matches out'],
      ['genre:racing genre:flight', 'One field twice: either'],
      ['genre:rpg tag:3d', 'Two fields: both'],
      ['orbit', 'Bare words search everything'],
    ],
  },
];
