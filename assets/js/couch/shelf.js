/**
 * couch/shelf.js — rows of tiles, the way a TV lays out a library.
 *
 * The focused row sits in a fixed band and the list glides up or down to
 * keep it there. Inside a row the focused tile holds the left edge and the
 * row glides under it. Both are ordinary scroll containers, so a wheel, a
 * trackpad or a thumb scrolls them as well.
 *
 * A row is built empty and only filled with tiles as it nears the screen:
 * forty-odd rows of up to forty games would otherwise be over a thousand
 * tiles before the first paint. Rows are keyed, so rebuilding after a new
 * favourite only touches the rows that changed.
 */

import { h } from '../dom.js';
import { tile, glide } from './ui.js';

export function createShelf(root, { href }) {
  let rows = [];

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) fill(byEl.get(entry.target));
    },
    { root, rootMargin: '60% 0px' }
  );
  const byEl = new WeakMap();
  const signature = (rail) => rail.games.map((game) => game.slug).join(' ');

  function makeRow(rail) {
    const id = `rail-${rail.key.replace(/[^a-z0-9]+/gi, '-')}`;
    const title = h('span', { class: 'rail__title' }, rail.title);
    const pos = h('span', { class: 'rail__pos', 'aria-hidden': 'true' });
    const track = h('div', { class: 'rail__track' });
    const el = h('section', { class: 'rail', 'aria-labelledby': id, dataset: { key: rail.key } }, h('h2', { class: 'rail__head', id }, title, pos), track);
    const row = { key: rail.key, games: rail.games, sig: signature(rail), el, title, pos, track, filled: false };
    byEl.set(el, row);
    observer.observe(el);
    return row;
  }

  /** Build a row's tiles, once. */
  function fill(row) {
    if (!row || row.filled) return;
    row.filled = true;
    row.track.append(...row.games.map((game) => tile(game, { href: href(game) })));
    row.track.firstElementChild.tabIndex = 0;
  }

  /**
   * Show these rails. A row whose games are unchanged keeps its tiles and
   * where it was scrolled to; only rows out of place are moved, since moving
   * the row that holds focus would drop it.
   */
  function render(rails) {
    const old = new Map(rows.map((row) => [row.key, row]));
    rows = rails.map((rail) => {
      const was = old.get(rail.key);
      old.delete(rail.key);
      if (was && was.sig === signature(rail)) {
        was.title.textContent = rail.title;
        return was;
      }
      if (was) {
        observer.unobserve(was.el);
        was.el.remove();
      }
      return makeRow(rail);
    });
    for (const gone of old.values()) {
      observer.unobserve(gone.el);
      gone.el.remove();
    }
    let cursor = root.firstElementChild;
    for (const row of rows) {
      if (row.el === cursor) cursor = cursor.nextElementSibling;
      else root.insertBefore(row.el, cursor);
    }
  }

  const rowOf = (el) => rows.find((row) => row.el.contains(el)) || null;
  const tilesOf = (row) => (fill(row), [...row.track.children]);

  /** Glide the list so this row sits in the band. */
  function band(row, { instant = false } = {}) {
    const top = row.el.offsetTop - parseFloat(getComputedStyle(root).paddingTop);
    glide(root, { top }, instant ? 0 : undefined);
  }

  /** Glide a row so this tile holds the left edge, or as near as the row's ends allow. */
  function anchor(row, el, { instant = false } = {}) {
    const left = el.offsetLeft - parseFloat(getComputedStyle(row.track).paddingLeft);
    glide(row.track, { left }, instant ? 0 : undefined);
  }

  /** Where focus is in a row: the one tile Tab reaches, and "12 of 40" by the title. */
  function mark(row, el) {
    const tiles = tilesOf(row);
    for (const t of tiles) t.tabIndex = t === el ? 0 : -1;
    row.pos.textContent = `${tiles.indexOf(el) + 1} of ${tiles.length}`;
  }

  /** A tile for this game: in the first row `prefer` likes that holds it, else the first row that does. */
  function find(slug, prefer = () => true) {
    const holds = (row) => row.games.some((game) => game.slug === slug);
    const row = rows.find((r) => prefer(r) && holds(r)) || rows.find(holds);
    return row ? tilesOf(row).find((t) => t.dataset.slug === slug) : null;
  }

  return { render, rows: () => rows, rowOf, tilesOf, band, anchor, mark, find };
}
