/**
 * catalogue/figures.js — the two figures above the ledger: additions per day,
 * and a log-binned histogram of file size.
 *
 * Both are columns in three layers (the library, what this figure's own
 * filter leaves out, and the selection), and both write the query: click a
 * column for just that day or bin, drag across columns for a range,
 * Shift-click to add one more, double-click to let the range go. From the
 * keyboard: arrows move, Shift-arrows stretch a range, Enter picks, Delete
 * lets go. Every value is also in each figure's table view.
 *
 * Drawn as SVG at the figure's real width, because a stretched viewBox would
 * stretch the type, and redrawn when that width changes.
 */

import { h } from '../dom.js';
import { date, lang, list, number, t, tx } from '../lang.js';
import { DAY, dayText, sizeText } from './query.js';

const TOP = 8;
const PLOT_H = 96;
const AXIS_H = 22;
const GUTTER = 30;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** A round top for the y-axis and two or three ticks under it. */
function scale(max) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find((s) => max / s <= 3) || steps.at(-1);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let tick = 0; tick <= top; tick += step) ticks.push(tick);
  return { top, ticks };
}

/** A column with a rounded data end and a square foot on the baseline. */
function column(x, w, top, base, cls) {
  const height = base - top;
  if (height <= 0) return null;
  const r = Math.min(2, w / 2, height);
  return h('path', {
    class: cls,
    d: `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`,
  });
}

const svgText = (x, y, text, cls, anchor = 'middle') => {
  const node = h('text', { x, y, class: cls, 'text-anchor': anchor });
  node.textContent = text;
  return node;
};

function columnChart(config) {
  let items = [];
  let covered = [];
  let hover = null;
  let focus = null;
  let anchor = null;
  let drag = null;

  const svg = h('svg', { class: 'figure__svg', 'aria-hidden': 'true', focusable: 'false' });
  const tip = h('div', { class: 'figure__tip', hidden: true });
  const plot = h(
    'div',
    {
      class: 'figure__plot',
      tabindex: '0',
      role: 'group',
      'aria-roledescription': 'chart',
      'aria-label': t('catalogue.figures.plot_label', { title: config.title }),
    },
    svg,
    tip
  );
  const note = h('span', { class: 'figure__note' });
  const range = h('span', { class: 'figure__range' });
  const toggle = h('button', { type: 'button', class: 'figure__toggle', 'aria-pressed': 'false' }, t('catalogue.figures.table'));
  const data = h('div', {
    class: 'figure__data',
    hidden: true,
    tabindex: '0',
    role: 'region',
    'aria-label': t('catalogue.figures.table_label', { title: config.title }),
  });
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const figure = h(
    'figure',
    { class: `figure figure--${config.key}` },
    h(
      'figcaption',
      { class: 'figure__cap' },
      h('span', { class: 'figure__no' }, config.number),
      h('span', { class: 'figure__title' }, config.title),
      note,
      range,
      toggle
    ),
    plot,
    data,
    live
  );

  toggle.addEventListener('click', () => {
    const table = data.hidden;
    data.hidden = !table;
    plot.hidden = table;
    toggle.setAttribute('aria-pressed', String(table));
    toggle.textContent = table ? t('catalogue.figures.chart') : t('catalogue.figures.table');
    if (table) data.replaceChildren(config.table(items));
  });

  /** The plot's width, as the resize observer last saw it: reading it during a
   *  render would force a layout in the middle of everyone else's updates. */
  let plotWidth = 0;
  const geometry = () => {
    const width = plotWidth;
    const slot = (width - GUTTER) / Math.max(1, items.length);
    return { width, slot, bar: Math.max(1, Math.min(24, slot - (slot > 6 ? 2 : 1))) };
  };

  const indexAt = (event) => {
    const { slot } = geometry();
    const x = event.clientX - plot.getBoundingClientRect().left - GUTTER;
    return items.length ? clamp(Math.floor(x / slot), 0, items.length - 1) : null;
  };

  function draw() {
    const { width, slot, bar } = geometry();
    if (!width || !items.length) return;
    const height = TOP + PLOT_H + AXIS_H;
    const base = TOP + PLOT_H;
    const { top, ticks } = scale(Math.max(1, ...items.map((item) => item.total)));
    const y = (v) => base - (v / top) * PLOT_H;
    // A count of one is never thinner than a hairline.
    const yOf = (v) => (v > 0 ? Math.min(y(v), base - 1.5) : base);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const nodes = [];
    for (const tick of ticks) {
      nodes.push(h('line', { x1: GUTTER, x2: width, y1: y(tick), y2: y(tick), class: tick ? 'grid' : 'baseline' }));
      nodes.push(svgText(GUTTER - 7, y(tick) + 3.5, number(tick), 'tick tick--y', 'end'));
    }
    const band = (from, to, cls) =>
      nodes.push(
        h('rect', {
          x: GUTTER + from * slot,
          y: TOP - 4,
          width: (to - from + 1) * slot,
          height: PLOT_H + 4,
          class: cls,
        })
      );
    if (drag?.moved) band(Math.min(drag.from, drag.to), Math.max(drag.from, drag.to), 'brush');
    else if (anchor != null && focus != null) band(Math.min(anchor, focus), Math.max(anchor, focus), 'brush');
    const spot = focus ?? hover;
    if (spot != null) band(spot, spot, 'spot');

    items.forEach((item, i) => {
      const x = GUTTER + i * slot + (slot - bar) / 2;
      nodes.push(column(x, bar, yOf(item.total), base, 'col col--total'));
      nodes.push(column(x, bar, yOf(item.other), base, 'col col--other'));
      nodes.push(column(x, bar, yOf(item.selected), base, 'col col--selected'));
    });

    // The extent of this figure's own filter, as a dimension line under the axis.
    let start = null;
    covered.forEach((on, i) => {
      if (on && start === null) start = i;
      if ((!on || i === covered.length - 1) && start !== null) {
        const end = on ? i : i - 1;
        nodes.push(
          h('rect', {
            x: GUTTER + start * slot,
            y: base + 3,
            width: (end - start + 1) * slot,
            height: 2.5,
            class: 'extent',
          })
        );
        start = null;
      }
    });

    for (const { at, label } of config.ticks(items, slot)) {
      const x = GUTTER + at * slot;
      nodes.push(h('line', { x1: x, x2: x, y1: base, y2: base + 4, class: 'tick-mark' }));
      nodes.push(svgText(clamp(x, GUTTER + 14, width - 16), base + 16, label, 'tick tick--x'));
    }
    svg.replaceChildren(...nodes.filter(Boolean));
  }

  /** The tooltip sits beside its column, never over it, on whichever side has room. */
  function showTip(i) {
    if (i == null || !items[i]) {
      tip.hidden = true;
      return;
    }
    tip.replaceChildren(...config.tip(items[i]).filter(Boolean));
    tip.hidden = false;
    const { width, slot } = geometry();
    const left = GUTTER + i * slot;
    const right = left + slot;
    const room = width - right - 10;
    const x = room >= tip.offsetWidth ? right + 10 : left - tip.offsetWidth - 10;
    tip.style.left = `${clamp(x, 0, Math.max(0, width - tip.offsetWidth))}px`;
  }

  function announce(i) {
    live.textContent = i == null ? '' : config.say(items[i]);
  }

  plot.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !items.length) return;
    const i = indexAt(event);
    drag = { from: i, to: i, x: event.clientX, moved: false, shift: event.shiftKey };
    plot.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  plot.addEventListener('pointermove', (event) => {
    const i = indexAt(event);
    if (drag) {
      if (Math.abs(event.clientX - drag.x) > 3) drag.moved = true;
      drag.to = i;
    }
    if (hover !== i || drag) {
      hover = i;
      draw();
      showTip(i);
    }
  });
  plot.addEventListener('pointerup', () => {
    if (!drag) return;
    const { from, to, moved, shift } = drag;
    drag = null;
    if (moved && from !== to) config.onPick(Math.min(from, to), Math.max(from, to), { extend: false });
    else config.onPick(from, from, { extend: shift });
  });
  plot.addEventListener('pointercancel', () => {
    drag = null;
    draw();
  });
  plot.addEventListener('pointerleave', () => {
    if (drag) return;
    hover = null;
    showTip(null);
    draw();
  });
  plot.addEventListener('dblclick', () => config.onClear());

  plot.addEventListener('keydown', (event) => {
    if (!items.length || event.altKey || event.ctrlKey || event.metaKey) return;
    const last = items.length - 1;
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -7, PageDown: 7 }[event.key];
    if (step !== undefined || event.key === 'Home' || event.key === 'End') {
      const from = focus ?? (step > 0 ? -1 : items.length);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : clamp(from + step, 0, last);
      if (event.shiftKey) anchor ??= focus ?? next;
      else anchor = null;
      focus = next;
      draw();
      showTip(focus);
      announce(focus);
    } else if ((event.key === 'Enter' || event.key === ' ') && focus != null) {
      const [a, b] = anchor != null ? [Math.min(anchor, focus), Math.max(anchor, focus)] : [focus, focus];
      anchor = null;
      config.onPick(a, b, { extend: false });
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      config.onClear();
    } else if (event.key === 'Escape' && anchor != null) {
      anchor = null;
      draw();
    } else {
      return;
    }
    // Handled here, so the ledger's own keys leave it alone.
    event.preventDefault();
    event.stopPropagation();
  });
  plot.addEventListener('blur', () => {
    focus = null;
    anchor = null;
    showTip(null);
    draw();
  });

  new ResizeObserver(([entry]) => {
    plotWidth = entry.contentRect.width;
    draw();
  }).observe(plot);

  return {
    figure,
    render(next) {
      items = next.items;
      covered = next.covered;
      note.textContent = next.note;
      range.replaceChildren(
        ...(next.filter
          ? [
              h('span', { class: 'figure__range-text' }, next.filter),
              h(
                'button',
                {
                  type: 'button',
                  class: 'figure__range-clear',
                  'aria-label': t('catalogue.figures.clear_label', { title: config.title.toLocaleLowerCase(lang) }),
                  onclick: config.onClear,
                },
                '×'
              ),
            ]
          : [])
      );
      if (!data.hidden) data.replaceChildren(config.table(items));
      draw();
      if (focus != null || hover != null) showTip(focus ?? hover);
    },
  };
}

const short = (ms) => date(ms, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekday = (ms) => date(ms, { weekday: 'short', timeZone: 'UTC' });

/** True for the sizes the axis labels: 1, 10, 100 or 1000 of whatever unit sizeText writes. */
function isRoundSize(n) {
  const unit = n < 1024 ? 1 : n < 1024 ** 2 ? 1024 : n < 1024 ** 3 ? 1024 ** 2 : 1024 ** 3;
  return [1, 10, 100, 1000].includes(Number((n / unit).toPrecision(3)));
}

const sizeRange = (bin) => t('catalogue.figures.size_range', { from: sizeText(bin.lo), to: sizeText(bin.hi) });

function tipLines(item, title) {
  const names =
    item.picked.length && item.picked.length <= 4
      ? item.picked
      : !item.selected && item.games.length <= 4
        ? item.games
        : [];
  return [
    h('p', { class: 'figure__tip-title' }, title),
    h(
      'p',
      { class: 'figure__tip-row' },
      h('i', { class: 'key key--selected' }),
      tx('catalogue.figures.tip_selected', { count: h('b', {}, number(item.selected)) })
    ),
    item.other !== item.selected &&
      h(
        'p',
        { class: 'figure__tip-row' },
        h('i', { class: 'key key--other' }),
        tx('catalogue.figures.tip_left_out', { count: h('b', {}, number(item.other - item.selected)) })
      ),
    h(
      'p',
      { class: 'figure__tip-row' },
      h('i', { class: 'key key--total' }),
      tx('catalogue.figures.tip_library', { count: h('b', {}, number(item.total)) })
    ),
    names.length > 0 &&
      h(
        'ul',
        { class: 'figure__tip-names' },
        names.map((game) => h('li', {}, game.name))
      ),
  ];
}

function dataTable(head, rows) {
  return h(
    'table',
    { class: 'figure__table' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        head.map((label, i) => h('th', { scope: 'col', class: i ? 'num' : '' }, label))
      )
    ),
    h(
      'tbody',
      {},
      rows.map((cells) =>
        h(
          'tr',
          {},
          cells.map((cell, i) => (i ? h('td', { class: 'num' }, cell) : h('th', { scope: 'row' }, cell)))
        )
      )
    )
  );
}

/**
 * The band of figures. `onPick(field, from, to, { extend })` is given the
 * items picked (indexes into what was rendered); `onClear(field)` lets the
 * field's range go.
 */
export function createFigures(root, { onPick, onClear }) {
  let days = [];
  let bins = [];

  const daysChart = columnChart({
    key: 'days',
    number: t('catalogue.figures.days_number'),
    title: t('catalogue.figures.days_title'),
    onPick: (a, b, opts) => onPick('added', days[a], days[b], opts),
    onClear: () => onClear('added'),
    ticks(items, slot) {
      const mondays = items.map((day, i) => [day, i]).filter(([day]) => new Date(day.start).getUTCDay() === 1);
      const every = slot * 7 < 46 ? 2 : 1;
      return mondays.filter((_, i) => i % every === 0).map(([day, i]) => ({ at: i, label: short(day.start) }));
    },
    tip: (day) => tipLines(day, t('catalogue.figures.tip_day', { weekday: weekday(day.start), date: dayText(day.start) })),
    say: (day) =>
      t('catalogue.figures.say_day', { date: dayText(day.start), selected: day.selected, total: day.total }),
    table: (items) =>
      dataTable(
        [t('catalogue.figures.col_day'), t('catalogue.figures.col_added'), t('catalogue.figures.col_selected')],
        items.filter((day) => day.total).map((day) => [dayText(day.start), number(day.total), number(day.selected)])
      ),
  });

  const sizesChart = columnChart({
    key: 'sizes',
    number: t('catalogue.figures.sizes_number'),
    title: t('catalogue.figures.sizes_title'),
    onPick: (a, b, opts) => onPick('size', bins[a], bins[b], opts),
    onClear: () => onClear('size'),
    ticks: (items) =>
      items
        .map((bin, i) => [bin, i])
        .filter(([bin]) => isRoundSize(bin.lo))
        .map(([bin, i]) => ({ at: i, label: sizeText(bin.lo) })),
    tip: (bin) => tipLines({ ...bin, games: [], picked: [] }, sizeRange(bin)),
    say: (bin) =>
      t('catalogue.figures.say_size', { range: sizeRange(bin), selected: bin.selected, total: bin.total }),
    table: (items) =>
      dataTable(
        [t('catalogue.figures.col_size'), t('catalogue.figures.col_records'), t('catalogue.figures.col_selected')],
        items.map((bin) => [sizeRange(bin), number(bin.total), number(bin.selected)])
      ),
  });

  root.append(
    h(
      'header',
      { class: 'figures__head' },
      h('h2', { class: 'label' }, t('catalogue.figures.heading')),
      h(
        'ul',
        { class: 'legend', 'aria-label': t('catalogue.figures.legend_label') },
        h('li', {}, h('i', { class: 'key key--selected', 'aria-hidden': 'true' }), t('catalogue.figures.legend_selected')),
        h('li', {}, h('i', { class: 'key key--other', 'aria-hidden': 'true' }), t('catalogue.figures.legend_left_out')),
        h('li', {}, h('i', { class: 'key key--total', 'aria-hidden': 'true' }), t('catalogue.figures.legend_library'))
      )
    ),
    h('div', { class: 'figures__row' }, daysChart.figure, sizesChart.figure)
  );

  return {
    /**
     * `days` and `bins` come from tally.js; `added` and `size` are the
     * positive terms on each figure's own field, which mark its extent.
     */
    render({ days: nextDays, from, to, bins: nextBins, added, size, now }) {
      days = nextDays;
      bins = nextBins;
      const inside = (terms, lo, hi) =>
        terms.some((term) => {
          const [a, b] = term.bounds ? term.bounds(now) : [term.range.lo, term.range.hi];
          return a < hi && b > lo;
        });
      daysChart.render({
        items: days,
        covered: days.map((day) => added.length > 0 && inside(added, day.start, day.start + DAY)),
        note: days.length ? t('catalogue.figures.note_days', { from: dayText(from), to: dayText(to - DAY) }) : '',
        filter: list(added.map((term) => term.says), 'disjunction'),
      });
      sizesChart.render({
        items: bins,
        covered: bins.map((bin) => size.length > 0 && inside(size, bin.lo, bin.hi)),
        note: t('catalogue.figures.note_sizes'),
        filter: list(size.map((term) => term.says), 'disjunction'),
      });
    },
  };
}
