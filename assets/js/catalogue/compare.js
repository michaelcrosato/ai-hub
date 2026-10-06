/**
 * catalogue/compare.js — two to four records side by side: one column each,
 * every fact on its own row, so the eye runs straight across.
 *
 * A cell that differs from the first record is marked. Sizes and builds get
 * bars from zero, scaled to the largest compared; dates get a mark on the
 * catalogue's own timeline, from its first addition to its last, because a
 * date is a position, not an amount.
 */

import { h, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { buildsOf, dayText, sizeText, valuesOf } from './query.js';
import { keycaps } from './keycaps.js';
import { playersText } from './ledger.js';

const listed = (value) => valuesOf(value).join(', ');

/** Each row: a label, what it compares, and how it is drawn. */
const ROWS = [
  { label: 'Type', value: (g) => g.type || 'Game' },
  { label: 'Genre', value: (g) => listed(g.genre) },
  { label: 'Origin', value: (g) => (g.lineage.original ? 'Original' : 'Inspired') },
  { label: 'Source', value: (g) => g.source || '' },
  { label: 'Series', value: (g) => (g.lineage.original ? '' : g.lineage.series) },
  { label: 'Model', value: (g) => listed(g.model) },
  { label: 'Players', value: playersText },
  { label: 'Size', value: (g) => g.bytes, draw: 'amount', say: sizeText },
  { label: 'Builds', value: buildsOf, draw: 'amount', say: String },
  { label: 'Added', value: (g) => g.addedAt, draw: 'when' },
  { label: 'Tags', value: (g) => valuesOf(g.tags).slice().sort().join(', '), draw: 'tags' },
  { label: 'Controls', value: (g) => listed(g.controls), draw: 'keys' },
  // Prose always differs, so marking it would mark nothing.
  { label: 'Description', value: (g) => g.description, draw: 'prose', same: true },
  { label: 'Slug', value: (g) => g.slug, draw: 'code', same: true },
  { label: 'Path', value: (g) => g.builds[0]?.path || g.path, draw: 'code', same: true },
];

function cell(row, game, { max, from, to }) {
  const value = row.value(game);
  if (value === '' || value == null) return h('span', { class: 'nil' }, '—');
  switch (row.draw) {
    case 'amount':
      return h(
        'span',
        { class: 'amount' },
        h('span', { class: 'amount__bar', style: { '--v': max ? value / max : 0 }, 'aria-hidden': 'true' }),
        h('span', { class: 'num' }, row.say(value))
      );
    case 'when':
      return h(
        'span',
        { class: 'when' },
        h('span', {
          class: 'when__line',
          style: { '--at': to > from ? (value - from) / (to - from) : 0 },
          'aria-hidden': 'true',
        }),
        h('span', { class: 'num' }, dayText(value))
      );
    case 'tags':
      return h(
        'span',
        { class: 'tags' },
        valuesOf(game.tags).map((tag) => h('span', { class: 'tag is-static' }, tag))
      );
    case 'keys':
      return h(
        'span',
        { class: 'controls' },
        keycaps(game.controls).map((run) => (run.key ? h('kbd', {}, run.key) : run.text))
      );
    case 'prose':
      return h('span', { class: 'prose' }, value);
    case 'code':
      return h('code', {}, value);
    default:
      return String(value);
  }
}

export function createCompare(root, { onPlay, onRemove, onClose, onSelect }) {
  return {
    show(games, { from, to }) {
      const maxes = new Map(
        ROWS.filter((row) => row.draw === 'amount').map((row) => [row, Math.max(...games.map(row.value))])
      );
      const close = h(
        'button',
        { type: 'button', class: 'tool compare__close', onclick: onClose },
        icon(ICONS.back),
        'Back to the records',
        h('kbd', {}, 'Esc')
      );
      const head = h(
        'tr',
        {},
        h('th', { scope: 'col', class: 'cmp__corner' }, h('span', { class: 'visually-hidden' }, 'Fact')),
        games.map((game) =>
          h(
            'th',
            { scope: 'col', class: 'cmp__game', style: paletteVars(cabinetPalette(game)) },
            h('div', { class: 'cmp__band', 'aria-hidden': 'true' }),
            h('img', { class: 'cmp__cover', src: game.cover, alt: '', decoding: 'async', width: 640, height: 480 }),
            h('button', { type: 'button', class: 'cmp__name', onclick: () => onSelect(game.slug) }, game.name),
            h('span', { class: 'cmp__tagline' }, game.tagline || ' '),
            h(
              'span',
              { class: 'cmp__actions' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'btn btn--play btn--small',
                  onclick: () => onPlay(game.slug),
                  'aria-label': `Play ${game.name}`,
                },
                icon(ICONS.play, { fill: 'currentColor', stroke: 'none' }),
                h('span', { class: 'btn__text' }, 'Play')
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'btn btn--quiet btn--small',
                  onclick: () => onRemove(game.slug),
                  'aria-label': `Remove ${game.name} from the comparison`,
                },
                icon(ICONS.close),
                h('span', { class: 'btn__text' }, 'Remove')
              )
            )
          )
        )
      );
      const rows = ROWS.map((row) => {
        const first = row.value(games[0]);
        return h(
          'tr',
          {},
          h('th', { scope: 'row', class: 'cmp__label' }, row.label),
          games.map((game, i) => {
            const differs = i > 0 && !row.same && String(row.value(game) ?? '') !== String(first ?? '');
            return h(
              'td',
              { class: differs ? 'is-different' : null },
              differs && h('span', { class: 'visually-hidden' }, 'Differs: '),
              cell(row, game, { max: maxes.get(row), from, to })
            );
          })
        );
      });
      root.replaceChildren(
        h(
          'header',
          { class: 'compare__head' },
          h(
            'h2',
            { class: 'compare__title' },
            'Compare',
            h('span', { class: 'compare__count' }, `${games.length} records`)
          ),
          h(
            'p',
            { class: 'compare__note' },
            h('i', { class: 'diff-key', 'aria-hidden': 'true' }),
            'Differs from the first record'
          ),
          close
        ),
        h(
          'div',
          { class: 'compare__scroll' },
          h('table', { class: 'cmp', style: { '--cols': games.length } }, h('thead', {}, head), h('tbody', {}, rows))
        )
      );
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
      root.replaceChildren();
    },
    isOpen: () => !root.hidden,
    focus: () => root.querySelector('.compare__close')?.focus(),
  };
}
