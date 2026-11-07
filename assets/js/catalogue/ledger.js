/**
 * catalogue/ledger.js — the table: one row per record, sortable, groupable,
 * with a keyboard cursor and marks for compare.
 *
 * Rows are built once per game and kept. A new query reconciles the kept rows
 * in place: rows that leave are removed, rows that arrive are inserted where
 * they belong, and the rest are not touched, so narrowing a query moves
 * nothing at all. Whatever can change on a row (the cursor, a mark, a
 * favourite, the scale of its size bar) is set on the element it concerns.
 *
 * Nothing per row is an inherited custom property. A value every descendant
 * inherits makes each row's styles unique, and the browser then styles
 * thousands of elements one by one instead of sharing them, which made a
 * keystroke cost ten times what it should.
 *
 * Only the cursor row is in the tab order (a roving tabindex): Tab reaches the
 * ledger once, and the arrow keys walk it.
 */

import { h, icon, ICONS } from '../dom.js';
import { cabinetPalette } from '../color.js';
import { playersOf } from '../manifest.js';
import { buildsOf, dayText, dayToken, sizeText, valuesOf } from './query.js';
import { lang, number, t, tx } from '../lang.js';

/** The columns, left to right. `sort` names the key a header click sorts by. */
const HEADS = [
  { key: 'mark', label: t('catalogue.ledger.head_mark') },
  { key: 'swatch', label: t('catalogue.ledger.head_colour') },
  { key: 'thumb', label: t('catalogue.ledger.head_picture') },
  { key: 'name', label: t('catalogue.ledger.head_name'), sort: 'name' },
  { key: 'genre', label: t('catalogue.ledger.head_genre'), sort: 'genre' },
  { key: 'lineage', label: t('catalogue.ledger.head_lineage'), sort: 'lineage' },
  { key: 'model', label: t('catalogue.ledger.head_model'), sort: 'model' },
  { key: 'players', label: t('catalogue.ledger.head_players'), sort: 'players', num: true },
  { key: 'size', label: t('catalogue.ledger.head_size'), sort: 'size', num: true },
  { key: 'added', label: t('catalogue.ledger.head_added'), sort: 'added', num: true },
  { key: 'builds', label: t('catalogue.ledger.head_builds'), sort: 'builds', num: true },
  { key: 'fav', label: t('catalogue.ledger.head_favourite') },
  { key: 'play', label: t('catalogue.ledger.head_play') },
];

/** Who a game is for, as the ledger prints it: "1–4", "1", or a dash for a tool. */
export function playersText(game) {
  if (game.players) return String(game.players);
  return playersOf(game).length ? '1' : '—';
}

/** "after Metal Slug 3", with the series in grey when it says something more. */
function lineageCell(game) {
  if (game.lineage.original) return h('span', { class: 'lineage is-original' }, t('catalogue.ledger.original'));
  const { title, series } = game.lineage;
  return h(
    'span',
    { class: 'lineage' },
    tx('catalogue.ledger.after', { title: h('cite', {}, title) }),
    series && series !== title && h('span', { class: 'lineage__series' }, ` ${series}`)
  );
}

const DASH = () => h('span', { class: 'nil' }, '—');

export function createLedger(root, { onSort, onPlay, onFave, onMark, onOpen }) {
  const rows = new Map();
  const heads = new Map();
  let cursor = null;
  let order = [];
  let entry = null;

  const caption = h('caption', { class: 'visually-hidden' });
  const headRow = h(
    'tr',
    {},
    HEADS.map((col) => {
      const inner = col.sort
        ? h(
            'button',
            { type: 'button', class: 'ledger__sort', onclick: () => onSort(col.sort) },
            h('span', {}, col.label),
            h('span', { class: 'ledger__arrow', 'aria-hidden': 'true' })
          )
        : h('span', { class: 'visually-hidden' }, col.label);
      const th = h('th', { scope: 'col', class: `c-${col.key}${col.num ? ' num' : ''}` }, inner);
      heads.set(col.key, th);
      return th;
    })
  );
  const body = h('tbody', {});
  const table = h('table', { class: 'ledger' }, caption, h('thead', {}, headRow), body);
  const empty = h('div', { class: 'ledger__empty', hidden: true });
  root.replaceChildren(table, empty);

  /**
   * A group heading spans the columns actually showing. Columns give way to
   * container queries as the desk narrows, and a span wider than the columns
   * present would make phantom ones, so it is counted rather than fixed.
   */
  let span = HEADS.length;
  let grouped = false;
  function fitGroups() {
    if (!grouped) return;
    const showing = [...heads.values()].filter((th) => getComputedStyle(th).display !== 'none').length || HEADS.length;
    if (showing === span) return;
    span = showing;
    for (const th of body.querySelectorAll('.ledger__group > th')) th.colSpan = span;
  }
  new ResizeObserver(fitGroups).observe(root);

  /** The size bars are scaled to the largest file listed; each remembers the scale it was drawn at. */
  const drawnAt = new Map();
  function scaleBar(game, row, max) {
    if (drawnAt.get(game.slug) === max) return;
    drawnAt.set(game.slug, max);
    row.querySelector('.size__fill').style.width = `${((game.bytes || 0) / max) * 100}%`;
  }

  function build(game) {
    const palette = cabinetPalette(game);
    const name = h('a', { class: 'ledger__name', href: `#/g/${game.slug}`, tabindex: '-1' }, game.name);
    return h(
      'tr',
      { class: 'ledger__row', dataset: { slug: game.slug } },
      h(
        'td',
        { class: 'c-mark' },
        h('input', {
          type: 'checkbox',
          class: 'ledger__mark',
          tabindex: '-1',
          'aria-label': t('catalogue.ledger.mark_label', { name: game.name }),
        })
      ),
      h('td', { class: 'c-swatch' }, h('span', { class: 'swatch', style: { background: palette.light } })),
      h(
        'td',
        { class: 'c-thumb' },
        h('img', {
          class: 'ledger__thumb',
          src: game.cover,
          alt: '',
          loading: 'lazy',
          decoding: 'async',
          width: 56,
          height: 42,
        })
      ),
      h(
        'th',
        { class: 'c-name', scope: 'row' },
        name,
        game.tagline && h('span', { class: 'ledger__tagline' }, game.tagline),
        h('span', { class: 'ledger__blurb' }, game.description)
      ),
      h('td', { class: 'c-genre' }, valuesOf(game.genre).join(', ') || DASH()),
      h('td', { class: 'c-lineage' }, lineageCell(game)),
      h('td', { class: 'c-model' }, valuesOf(game.model).join(', ') || DASH()),
      h('td', { class: 'c-players num' }, playersText(game)),
      h(
        'td',
        { class: 'c-size num' },
        h(
          'span',
          { class: 'size' },
          h('span', { class: 'size__bar', 'aria-hidden': 'true' }, h('span', { class: 'size__fill' })),
          h('span', { class: 'size__n' }, sizeText(game.bytes))
        )
      ),
      h(
        'td',
        { class: 'c-added num' },
        game.addedAt ? h('time', { datetime: dayToken(game.addedAt) }, dayText(game.addedAt)) : DASH()
      ),
      h('td', { class: 'c-builds num' }, number(buildsOf(game))),
      h(
        'td',
        { class: 'c-fav' },
        h(
          'button',
          {
            type: 'button',
            class: 'ledger__fav',
            tabindex: '-1',
            'aria-pressed': 'false',
            'aria-label': t('catalogue.ledger.fave_label', { name: game.name }),
          },
          icon(ICONS.star)
        )
      ),
      h(
        'td',
        { class: 'c-play' },
        h(
          'button',
          { type: 'button', class: 'ledger__play', tabindex: '-1', 'aria-label': t('catalogue.ledger.play_label', { name: game.name }) },
          icon(ICONS.play, { fill: 'currentColor', stroke: 'none' })
        )
      )
    );
  }

  const rowOf = (game) => {
    let row = rows.get(game.slug);
    if (!row) {
      row = build(game);
      rows.set(game.slug, row);
    }
    return row;
  };

  const groupRow = (group) =>
    h(
      'tr',
      { class: `ledger__group${group.rest ? ' is-rest' : ''}` },
      h(
        'th',
        { colspan: span },
        h('span', { class: 'ledger__group-label' }, group.label),
        h(
          'span',
          { class: 'ledger__group-meta' },
          t('catalogue.ledger.group_meta', { count: group.games.length, size: sizeText(group.bytes) })
        )
      )
    );

  /** Only the cursor row (or the first, before there is one) can be tabbed to. */
  function setEntry(row) {
    if (entry === row) return;
    if (entry) for (const el of entry.querySelectorAll('a, button, input')) el.tabIndex = -1;
    entry = row;
    if (entry) for (const el of entry.querySelectorAll('a, button, input')) el.tabIndex = 0;
  }

  body.addEventListener('click', (event) => {
    const row = event.target.closest('.ledger__row');
    if (!row) return;
    const slug = row.dataset.slug;
    if (event.target.closest('.ledger__fav')) return onFave(slug);
    if (event.target.closest('.ledger__play')) return onPlay(slug);
    // Not cancelled: a cancelled click puts the box back after this handler,
    // undoing whatever onMark decided. setMarks makes it agree either way.
    if (event.target.closest('.ledger__mark')) return onMark(slug);
    const link = event.target.closest('.ledger__name');
    // A modified click on the name opens the record in a new tab, as links do.
    if (link && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1)) return;
    event.preventDefault();
    onOpen(slug);
  });
  body.addEventListener('dblclick', (event) => {
    const row = event.target.closest('.ledger__row');
    if (row && !event.target.closest('button, input')) onPlay(row.dataset.slug);
  });

  return {
    /**
     * Lay out the records: `groups` (from order.js) or a flat list. `max` is
     * the largest size in view, which every size bar is scaled against.
     */
    render(list, groups, { sort, max, empty: emptyNote }) {
      const sortedBy = (HEADS.find((col) => col.sort === sort.key)?.label ?? sort.key).toLocaleLowerCase(lang);
      const values = { count: list.length, column: sortedBy };
      caption.textContent =
        sort.dir < 0 ? t('catalogue.ledger.caption_descending', values) : t('catalogue.ledger.caption', values);
      for (const col of HEADS) {
        if (!col.sort) continue;
        const th = heads.get(col.key);
        const on = sort.key === col.sort;
        th.setAttribute('aria-sort', on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none');
        th.classList.toggle('is-sorted', on);
        th.querySelector('.ledger__arrow').textContent = on ? (sort.dir > 0 ? '↑' : '↓') : '';
      }
      const nodes = [];
      const scale = Math.max(1, max);
      order = [];
      grouped = Boolean(groups);
      for (const group of groups || [{ games: list }]) {
        if (groups) nodes.push(groupRow(group));
        for (const game of group.games) {
          const row = rowOf(game);
          scaleBar(game, row, scale);
          nodes.push(row);
          order.push(game.slug);
        }
      }
      // Leavers out first, so the rows that stay are already in order and
      // the walk below finds them in place; only arrivals are inserted.
      const wanted = new Set(nodes);
      for (const child of [...body.children]) if (!wanted.has(child)) child.remove();
      let at = body.firstChild;
      for (const node of nodes) {
        if (node === at) at = at.nextSibling;
        else body.insertBefore(node, at);
      }
      span = -1;
      fitGroups();
      table.hidden = !list.length;
      empty.hidden = Boolean(list.length);
      empty.replaceChildren(...(list.length ? [] : [emptyNote()]));
      const current = cursor && rows.get(cursor);
      setEntry(current?.isConnected ? current : rows.get(order[0]) || null);
    },

    /** The slugs in the order they are listed, groups and all. */
    order: () => order,

    setCursor(slug, { scroll = false, focus = false, centre = false } = {}) {
      const before = cursor && rows.get(cursor);
      if (before) {
        before.classList.remove('is-cursor');
        before.removeAttribute('aria-current');
      }
      cursor = slug;
      const row = slug && rows.get(slug);
      if (!row?.isConnected) {
        setEntry(rows.get(order[0]) || null);
        return;
      }
      row.classList.add('is-cursor');
      row.setAttribute('aria-current', 'true');
      setEntry(row);
      if (scroll) row.scrollIntoView({ block: centre ? 'center' : 'nearest' });
      if (focus) row.querySelector('.ledger__name').focus({ preventScroll: !scroll });
    },

    /** The row element for a record, when it is listed. */
    row: (slug) => (rows.get(slug)?.isConnected ? rows.get(slug) : null),

    focusEntry: () => entry?.querySelector('.ledger__name')?.focus(),

    setMarks(marks) {
      for (const [slug, row] of rows) {
        const on = marks.has(slug);
        row.classList.toggle('is-marked', on);
        row.querySelector('.ledger__mark').checked = on;
      }
    },

    setFaves(isFave) {
      for (const [slug, row] of rows)
        row.querySelector('.ledger__fav').setAttribute('aria-pressed', String(isFave(slug)));
    },

    contains: (node) => node instanceof Node && table.contains(node),
  };
}
