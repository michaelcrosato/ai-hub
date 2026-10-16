/** A chronological daybook of the dates games first arrived in the hub. */

import { h, ICONS, icon } from '../dom.js';
import { gameImage, gameMeta } from './common.js';

const BATCH_SIZE = 24;
const monthFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const weekdayFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  timeZone: 'UTC',
});
const number = new Intl.NumberFormat('en');
const dateFromKey = (key) => new Date(`${key.length === 7 ? `${key}-01` : key}T12:00:00Z`);
const monthLabel = (key) => monthFormatter.format(dateFromKey(key));
const dayLabel = (key) => dayFormatter.format(dateFromKey(key));

/** Reject rollover dates instead of silently filing February 30 under March. */
export function addedDay(game) {
  const value = game.added;
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value);
  if (!match) return null;
  const calendarDate = new Date(`${match[1]}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== match[1])
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/** `month` accepts a month, a specific day, or the explicit undated bucket. */
export function timelineSelection(value = '') {
  if (value === 'undated') return value;
  if (/^\d{4}-\d{2}$/.test(value) && addedDay({ added: `${value}-01` })) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && addedDay({ added: value })) return value;
  return '';
}

/** Pure chronology: input order and caller-owned arrays are never changed. */
export function buildTimeline(games, { month = '', order = 'newest' } = {}) {
  const selection = timelineSelection(month);
  const ascending = order === 'oldest';
  const months = new Map();
  const days = new Map();
  const groups = new Map();
  let undated = 0;
  for (const game of games) {
    const day = addedDay(game);
    if (day) {
      const key = day.slice(0, 7);
      months.set(key, (months.get(key) || 0) + 1);
      days.set(day, (days.get(day) || 0) + 1);
    } else undated++;
    if (selection && (selection === 'undated' ? day !== null : !day?.startsWith(selection))) continue;
    const key = day || 'undated';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(game);
  }
  const compare = (a, b) => {
    if (a === b) return 0;
    if (a === 'undated') return 1;
    if (b === 'undated') return -1;
    return ascending ? a.localeCompare(b) : b.localeCompare(a);
  };
  const sortedGroups = [...groups]
    .sort(([a], [b]) => compare(a, b))
    .map(([key, entries]) => ({
      key,
      games: [...entries].sort((a, b) => {
        if (key !== 'undated') {
          const time = Date.parse(a.added) - Date.parse(b.added);
          if (time) return ascending ? time : -time;
        }
        return (
          String(a.name || a.slug).localeCompare(String(b.name || b.slug)) || a.slug.localeCompare(b.slug)
        );
      }),
    }));
  return {
    selection,
    months: [...months].sort(([a], [b]) => b.localeCompare(a)).map(([key, count]) => ({ key, count })),
    days: [...days].sort(([a], [b]) => b.localeCompare(a)).map(([key, count]) => ({ key, count })),
    undated,
    groups: sortedGroups,
    total: sortedGroups.reduce((sum, group) => sum + group.games.length, 0),
  };
}

/** Slice across day boundaries, including days with more than one batch. */
export function timelinePage(groups, limit = BATCH_SIZE) {
  let remaining = Math.max(0, Math.floor(Number(limit) || 0));
  const page = [];
  for (const group of groups) {
    if (!remaining) break;
    const games = group.games.slice(0, remaining);
    if (games.length) page.push({ ...group, games, total: group.games.length });
    remaining -= games.length;
  }
  return page;
}

export function createView(root, actions) {
  let current = null;
  let state = null;
  let limit = BATCH_SIZE;
  let signature = '';
  let stream;
  let footer;
  let live;

  function card(game) {
    const favorite = actions.isFave(game.slug);
    const info = h(
      'button',
      {
        type: 'button',
        class: 'timeline-card__open',
        'aria-label': `Details for ${game.name}`,
        dataset: { timelineFocus: `info:${game.slug}` },
        onclick: (event) => actions.info(game, event.currentTarget),
      },
      gameImage(game, { className: 'timeline-card__image' }),
      h(
        'span',
        { class: 'timeline-card__copy' },
        h('span', { class: 'timeline-card__meta' }, gameMeta(game)),
        h('span', { class: 'timeline-card__title' }, game.name),
        h(
          'span',
          { class: 'timeline-card__description' },
          game.tagline || game.description || 'Open the details and discover something new.',
        ),
        h(
          'span',
          { class: 'timeline-card__details' },
          'Read more',
          h('span', { 'aria-hidden': 'true' }, ' ↗'),
        ),
      ),
    );
    const fave = h(
      'button',
      {
        type: 'button',
        class: 'timeline-card__fave',
        'aria-pressed': String(favorite),
        'aria-label': `${favorite ? 'Remove' : 'Add'} ${game.name} ${favorite ? 'from' : 'to'} favourites`,
        dataset: {
          timelineFocus: `fave:${game.slug}`,
          timelineFave: game.slug,
        },
        onclick: () => {
          actions.fave(game);
          syncSelection();
        },
      },
      icon(ICONS.star),
    );
    return h(
      'article',
      {
        class: 'timeline-card',
        dataset: { timelineSlug: game.slug },
      },
      info,
      h(
        'div',
        { class: 'timeline-card__actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'timeline-card__play',
            'aria-label': `Play ${game.name}`,
            dataset: { timelineFocus: `play:${game.slug}` },
            onclick: (event) => actions.play(game, event.currentTarget),
          },
          icon(ICONS.play),
          'Play',
        ),
        fave,
      ),
    );
  }

  function syncSelection() {
    for (const article of root.querySelectorAll('[data-timeline-slug]')) {
      const selected = article.dataset.timelineSlug === current?.selected;
      article.classList.toggle('is-selected', selected);
      const trigger = article.querySelector('.timeline-card__open');
      if (selected) trigger.setAttribute('aria-current', 'true');
      else trigger.removeAttribute('aria-current');
      const fave = article.querySelector('[data-timeline-fave]');
      const active = actions.isFave(article.dataset.timelineSlug);
      fave.setAttribute('aria-pressed', String(active));
      const title = article.querySelector('.timeline-card__title').textContent;
      fave.setAttribute(
        'aria-label',
        `${active ? 'Remove' : 'Add'} ${title} ${active ? 'from' : 'to'} favourites`,
      );
    }
  }

  function renderStream() {
    const page = timelinePage(state.groups, limit);
    const shown = page.reduce((sum, group) => sum + group.games.length, 0);
    stream.replaceChildren(
      ...page.map((group) => {
        const undated = group.key === 'undated';
        const date = undated ? null : dateFromKey(group.key);
        return h(
          'section',
          {
            class: 'timeline-day',
            'aria-label': undated ? 'Undated arrivals' : dayLabel(group.key),
          },
          h(
            'div',
            { class: 'timeline-day__date' },
            h(
              'span',
              { class: 'timeline-day__weekday' },
              undated ? 'Unknown' : weekdayFormatter.format(date),
            ),
            h(
              'span',
              { class: 'timeline-day__number', 'aria-hidden': 'true' },
              undated ? '—' : group.key.slice(8),
            ),
            h(
              'span',
              { class: 'timeline-day__month' },
              undated ? 'Arrival date' : monthLabel(group.key.slice(0, 7)),
            ),
          ),
          h(
            'div',
            { class: 'timeline-day__body' },
            h(
              'div',
              { class: 'timeline-day__heading' },
              h('h3', {}, undated ? 'Still part of the story' : dayLabel(group.key)),
              h('span', {}, `${number.format(group.total)} ${group.total === 1 ? 'arrival' : 'arrivals'}`),
            ),
            undated &&
              h('p', { class: 'timeline-day__note' }, 'These entries do not have a recorded arrival date.'),
            h('div', { class: 'timeline-day__cards' }, group.games.map(card)),
          ),
        );
      }),
    );
    if (!state.total)
      stream.append(
        h(
          'div',
          { class: 'timeline-empty' },
          h('p', { class: 'timeline-eyebrow' }, 'A quiet chapter'),
          h('h3', {}, 'No arrivals here yet.'),
          h(
            'p',
            {},
            state.selection
              ? 'Choose another date, or see all dates with your current filters.'
              : 'Try another search or change the filters to find an arrival.',
          ),
          state.selection &&
            h(
              'button',
              {
                type: 'button',
                class: 'timeline-reset',
                onclick: () => actions.setQuery({ month: null }),
              },
              'See all dates',
            ),
        ),
      );
    footer.replaceChildren(
      h('p', {}, `${number.format(shown)} of ${number.format(state.total)} entries shown`),
    );
    if (shown < state.total)
      footer.append(
        h(
          'button',
          {
            type: 'button',
            class: 'timeline-more',
            dataset: { timelineFocus: 'more' },
            onclick: () => {
              limit += BATCH_SIZE;
              renderStream();
              const next = stream.querySelectorAll('.timeline-card__open')[shown];
              next?.focus({ preventScroll: true });
              next?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            },
          },
          `Continue the story`,
          h('span', { 'aria-hidden': 'true' }, ' ↓'),
        ),
      );
    live.textContent = `${number.format(shown)} of ${number.format(state.total)} entries shown.`;
    syncSelection();
  }

  function render() {
    const focused = root.contains(document.activeElement)
      ? document.activeElement.dataset.timelineFocus
      : null;
    const selectedMonth = state.selection.slice(0, 7);
    const max = Math.max(1, ...state.months.map((month) => month.count));
    const order = current.query.get('order') === 'oldest' ? 'oldest' : 'newest';
    const navButton = (key, label, count, active) =>
      h(
        'button',
        {
          type: 'button',
          class: 'timeline-index__item',
          'aria-pressed': String(active),
          dataset: { timelineFocus: `month:${key}` },
          onclick: () => actions.setQuery({ month: key || null }),
        },
        h('span', { class: 'timeline-index__label' }, label),
        h('span', { class: 'timeline-index__count' }, number.format(count)),
        key &&
          key !== 'undated' &&
          h('span', {
            class: 'timeline-index__bar',
            'aria-hidden': 'true',
            style: {
              '--timeline-fill': `${Math.max(3, (count / max) * 100)}%`,
            },
          }),
      );

    const dateOptions = state.days.filter(({ key }) => !state.selection || key.startsWith(selectedMonth));
    const daySelect = h(
      'select',
      {
        class: 'timeline-day-select',
        id: 'timeline-day-select',
        dataset: { timelineFocus: 'day' },
        disabled: state.selection === 'undated' || !dateOptions.length,
        onchange: (event) => actions.setQuery({ month: event.currentTarget.value || null }),
      },
      h(
        'option',
        {
          value: state.selection.length === 10 ? selectedMonth : state.selection,
        },
        'Every day',
      ),
      dateOptions.map(({ key, count }) =>
        h('option', { value: key }, `${dayLabel(key)} (${number.format(count)})`),
      ),
    );
    daySelect.value = state.selection.length === 10 ? state.selection : state.selection || '';
    if (daySelect.selectedIndex < 0) daySelect.selectedIndex = 0;
    stream = h('div', { class: 'timeline-stream' });
    footer = h('div', { class: 'timeline-footer' });
    live = h('p', {
      class: 'timeline-sr-only',
      role: 'status',
      'aria-live': 'polite',
    });
    const activeLabel =
      state.selection === 'undated'
        ? 'Undated arrivals'
        : state.selection.length === 10
          ? dayLabel(state.selection)
          : state.selection
            ? monthLabel(state.selection)
            : 'The complete story';
    root.replaceChildren(
      h(
        'div',
        { class: 'timeline' },
        h(
          'header',
          { class: 'timeline-intro' },
          h(
            'div',
            {},
            h('p', { class: 'timeline-eyebrow' }, 'The arrival journal'),
            h('h1', {}, 'Follow the ', h('em', {}, 'arrivals.')),
            h(
              'p',
              { class: 'timeline-intro__description' },
              'A living record of the hub. Revisit a day, discover a new favourite, and see how the collection grew.',
            ),
          ),
          h(
            'div',
            { class: 'timeline-intro__stat' },
            h('strong', {}, number.format(current.games.length)),
            h('span', {}, 'entries in this selection'),
          ),
        ),
        h(
          'div',
          { class: 'timeline-layout' },
          h(
            'aside',
            {
              class: 'timeline-index',
              'aria-label': 'Choose an arrival month',
            },
            h('h3', { class: 'timeline-eyebrow' }, 'Browse the archive'),
            h(
              'div',
              { class: 'timeline-index__items' },
              navButton('', 'All dates', current.games.length, !state.selection),
              state.months.map(({ key, count }) =>
                navButton(key, monthLabel(key), count, selectedMonth === key),
              ),
              (state.undated > 0 || state.selection === 'undated') &&
                navButton('undated', 'Undated', state.undated, state.selection === 'undated'),
            ),
            h(
              'p',
              { class: 'timeline-index__note' },
              'Dates mark the first arrival in the hub. Times are grouped by UTC date.',
            ),
          ),
          h(
            'div',
            { class: 'timeline-main' },
            h(
              'div',
              { class: 'timeline-toolbar' },
              h(
                'div',
                { class: 'timeline-toolbar__chapter' },
                h('p', { class: 'timeline-eyebrow' }, 'Now reading'),
                h('h2', {}, activeLabel),
              ),
              h(
                'div',
                {
                  class: 'timeline-order',
                  role: 'group',
                  'aria-label': 'Timeline order',
                },
                ['newest', 'oldest'].map((value) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      'aria-pressed': String(order === value),
                      dataset: { timelineFocus: `order:${value}` },
                      onclick: () => actions.setQuery({ order: value }),
                    },
                    `${value === 'newest' ? 'Newest' : 'Oldest'} first`,
                  ),
                ),
              ),
            ),
            h(
              'div',
              { class: 'timeline-date-filter' },
              h('label', { for: 'timeline-day-select' }, 'Jump to a day'),
              daySelect,
              state.selection &&
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'timeline-clear',
                    dataset: { timelineFocus: 'clear' },
                    onclick: () => actions.setQuery({ month: null }),
                  },
                  'Clear date ×',
                ),
            ),
            stream,
            footer,
            live,
          ),
        ),
      ),
    );
    renderStream();
    if (focused)
      [...root.querySelectorAll('[data-timeline-focus]')]
        .find((element) => element.dataset.timelineFocus === focused)
        ?.focus({ preventScroll: true });
  }

  return {
    getPool: () => state?.groups.flatMap((group) => group.games) || [],
    setSelected(slug) {
      if (current) current.selected = slug;
      syncSelection();
    },
    update(next) {
      current = next;
      const nextSignature = JSON.stringify([
        next.games.map((game) => game.slug),
        next.query.get('month'),
        next.query.get('order'),
      ]);
      if (signature === nextSignature) {
        syncSelection();
        return;
      }
      signature = nextSignature;
      limit = BATCH_SIZE;
      state = buildTimeline(next.games, {
        month: next.query.get('month') || '',
        order: next.query.get('order') || 'newest',
      });
      render();
    },
  };
}
