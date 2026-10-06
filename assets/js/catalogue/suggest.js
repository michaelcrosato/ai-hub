/**
 * catalogue/suggest.js — what the query bar offers as you type. Pure: the
 * text, the caret and the library's vocabulary in; a short list out.
 *
 * On a bare word it offers the fields the word starts ("gen" → genre:) and
 * any value it names ("rpg" → genre:rpg), so the syntax teaches itself. After
 * a field's colon it offers that field's values matching what is typed so
 * far, most common first, each with how many records carry it.
 */

import { sameKey } from '../manifest.js';
import { FIELDS, parse, startsWord } from './query.js';
import { FACETS, facetTerm } from './tally.js';

const MAX = 8;

/** Fields whose values are worth listing, read the way the facets read them. */
const LISTED = ['genre', 'type', 'origin', 'model', 'series', 'source', 'tag', 'players'];

/** Values that are shapes rather than words: offered as examples. */
const SHAPES = {
  size: [
    ['<250kb', 'Under 250 KB'],
    ['1mb..4mb', '1 MB up to 4 MB'],
    ['>=4mb', '4 MB or more'],
  ],
  added: [
    ['<7d', 'In the last week'],
    ['<30d', 'In the last 30 days'],
  ],
  updated: [['<7d', 'In the last week']],
  builds: [['>1', 'More than one build']],
  is: [
    ['fav', 'Your favourites'],
    ['played', 'Played on this device'],
    ['new', 'Added this week'],
  ],
  has: [
    ['model', 'Names its model'],
    ['series', 'Names a series'],
    ['players', 'Says who it seats'],
  ],
};

/** Every value each listed field carries, with how many records carry it. */
export function vocabularyOf(library) {
  const out = {};
  for (const field of LISTED) {
    const facet = FACETS.find((f) => f.field === field) || {
      field,
      values: (g) => [FIELDS[field].read(g)].flat().filter((v) => typeof v === 'string' && v.trim()),
    };
    const counts = new Map();
    for (const game of library)
      for (const value of new Set(facet.values(game))) counts.set(value, (counts.get(value) || 0) + 1);
    const values = [...counts.keys()];
    out[field] = [...counts]
      .map(([value, count]) => ({ value, count, term: facetTerm(facet, value, values) }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  const months = new Map();
  for (const game of library) {
    if (!game.addedAt) continue;
    const month = new Date(game.addedAt).toISOString().slice(0, 7);
    months.set(month, (months.get(month) || 0) + 1);
  }
  out.months = [...months].sort(([a], [b]) => (a < b ? 1 : -1));
  return out;
}

const withSign = (negate, term) => (negate ? `-${term}` : term);

/**
 * Suggestions for the token under the caret, or null. Each item says what
 * to `insert` in place of the text from `from` to `to`.
 */
export function suggest(text, caret, vocabulary) {
  const term = parse(text).terms.find((t) => t.start <= caret && caret <= t.end);
  if (!term) return null;
  const colon = term.raw.indexOf(':');
  const typedField = colon > 0 && caret > term.start + colon;

  if (term.field && typedField) {
    const partial = sameKey(term.value);
    let items;
    if (vocabulary[term.field]) {
      items = vocabulary[term.field]
        .filter(({ value }) => !partial || startsWord(sameKey(value), partial))
        .map(({ value, count, term: written }) => ({
          insert: withSign(term.negate, written),
          label: value,
          hint: String(count),
        }));
    } else {
      const shapes = SHAPES[term.field] || [];
      const months = term.kind === 'date' ? vocabulary.months.map(([month, count]) => [month, `${count} added`]) : [];
      items = [...shapes, ...months]
        .filter(([value]) => !partial || value.startsWith(partial))
        .map(([value, hint]) => ({ insert: withSign(term.negate, `${term.field}:${value}`), label: value, hint }));
    }
    items = items.filter((item) => item.insert !== term.raw).slice(0, MAX);
    return items.length ? { from: term.start, to: term.end, items } : null;
  }

  if (term.field || colon !== -1 || term.quoted) return null;
  const word = sameKey(term.value);
  if (!word) return null;
  const fields = Object.keys(FIELDS)
    .filter((field) => field.startsWith(word) && field !== word)
    .map((field) => ({
      insert: withSign(term.negate, `${field}:`),
      label: `${field}:`,
      hint: FIELDS[field].label,
      field: true,
    }));
  const values =
    word.length < 2
      ? []
      : LISTED.flatMap((field) =>
          vocabulary[field]
            .filter(({ value }) => startsWord(sameKey(value), word))
            .map(({ value, count, term: written }) => ({ field, value, count, written }))
        ).sort((a, b) => b.count - a.count);
  const named = values.map(({ field, value, count, written }) => ({
    insert: withSign(term.negate, written),
    label: value,
    hint: `${FIELDS[field].label} · ${count}`,
  }));
  const items = [...fields, ...named].slice(0, MAX);
  return items.length ? { from: term.start, to: term.end, items } : null;
}

/** The text and caret after taking a suggestion; a finished term gets a space after it. */
export function accept(text, { from, to }, item) {
  const tail = text.slice(to);
  const gap = item.field || /^\s/.test(tail) ? '' : ' ';
  const head = text.slice(0, from) + item.insert + gap;
  return { text: head + tail, caret: head.length };
}
