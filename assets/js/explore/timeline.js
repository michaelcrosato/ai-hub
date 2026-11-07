/** A chronological daybook of the dates games first arrived in the hub. */

import { h, ICONS, icon } from '../dom.js';
import { gameImage, gameMeta } from './common.js';
import { t, tx, number, date, compare as collate } from '../lang.js';

const BATCH_SIZE = 24;
const MONTH = { month: 'long', year: 'numeric', timeZone: 'UTC' };
const DAY = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
const WEEKDAY = { weekday: 'short', timeZone: 'UTC' };
const dateFromKey = (key) => new Date(`${key.length === 7 ? `${key}-01` : key}T12:00:00Z`);
const monthLabel = (key) => date(dateFromKey(key), MONTH);
const dayLabel = (key) => date(dateFromKey(key), DAY);

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
          collate(String(a.name || a.slug), String(b.name || b.slug)) || a.slug.localeCompare(b.slug)
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
        'aria-label': t('explore.timeline.details_for', { name: game.name }),
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
          game.tagline || game.description || t('explore.timeline.card_fallback'),
        ),
        h(
          'span',
          { class: 'timeline-card__details' },
          t('explore.timeline.read_more'),
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
        'aria-label': favorite
          ? t('explore.timeline.remove_favourite', { name: game.name })
          : t('explore.timeline.add_favourite', { name: game.name }),
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
            'aria-label': t('explore.timeline.play_name', { name: game.name }),
            dataset: { timelineFocus: `play:${game.slug}` },
            onclick: (event) => actions.play(game, event.currentTarget),
          },
          icon(ICONS.play),
          t('explore.timeline.play'),
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
        active
          ? t('explore.timeline.remove_favourite', { name: title })
          : t('explore.timeline.add_favourite', { name: title }),
      );
    }
  }

  function renderStream() {
    const page = timelinePage(state.groups, limit);
    const shown = page.reduce((sum, group) => sum + group.games.length, 0);
    stream.replaceChildren(
      ...page.map((group) => {
        const undated = group.key === 'undated';
        const when = undated ? null : dateFromKey(group.key);
        return h(
          'section',
          {
            class: 'timeline-day',
            'aria-label': undated ? t('explore.timeline.undated_arrivals') : dayLabel(group.key),
          },
          h(
            'div',
            { class: 'timeline-day__date' },
            h(
              'span',
              { class: 'timeline-day__weekday' },
              undated ? t('explore.timeline.unknown') : date(when, WEEKDAY),
            ),
            h(
              'span',
              { class: 'timeline-day__number', 'aria-hidden': 'true' },
              undated ? '—' : group.key.slice(8),
            ),
            h(
              'span',
              { class: 'timeline-day__month' },
              undated ? t('explore.timeline.arrival_date') : monthLabel(group.key.slice(0, 7)),
            ),
          ),
          h(
            'div',
            { class: 'timeline-day__body' },
            h(
              'div',
              { class: 'timeline-day__heading' },
              h('h3', {}, undated ? t('explore.timeline.still_story') : dayLabel(group.key)),
              h('span', {}, t('explore.timeline.day_arrivals', { count: group.total })),
            ),
            undated &&
              h('p', { class: 'timeline-day__note' }, t('explore.timeline.undated_note')),
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
          h('p', { class: 'timeline-eyebrow' }, t('explore.timeline.empty_eyebrow')),
          h('h3', {}, t('explore.timeline.empty_heading')),
          h(
            'p',
            {},
            state.selection
              ? t('explore.timeline.empty_dated')
              : t('explore.timeline.empty_all'),
          ),
          state.selection &&
            h(
              'button',
              {
                type: 'button',
                class: 'timeline-reset',
                onclick: () => actions.setQuery({ month: null }),
              },
              t('explore.timeline.see_all'),
            ),
        ),
      );
    footer.replaceChildren(
      h('p', {}, t('explore.timeline.shown', { shown, total: state.total })),
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
          t('explore.timeline.more'),
          h('span', { 'aria-hidden': 'true' }, ' ↓'),
        ),
      );
    live.textContent = t('explore.timeline.shown_live', { shown, total: state.total });
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
        h('span', { class: 'timeline-index__count' }, number(count)),
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
        t('explore.timeline.every_day'),
      ),
      dateOptions.map(({ key, count }) =>
        h('option', { value: key }, t('explore.timeline.day_option', { day: dayLabel(key), count })),
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
        ? t('explore.timeline.undated_arrivals')
        : state.selection.length === 10
          ? dayLabel(state.selection)
          : state.selection
            ? monthLabel(state.selection)
            : t('explore.timeline.complete_story');
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
            h('p', { class: 'timeline-eyebrow' }, t('explore.timeline.eyebrow')),
            h('h1', {}, tx('explore.timeline.heading', { arrivals: h('em', {}, t('explore.timeline.heading_arrivals')) })),
            h(
              'p',
              { class: 'timeline-intro__description' },
              t('explore.timeline.description'),
            ),
          ),
          h(
            'div',
            { class: 'timeline-intro__stat' },
            h('strong', {}, number(current.games.length)),
            h('span', {}, t('explore.timeline.stat_label', { count: current.games.length })),
          ),
        ),
        h(
          'div',
          { class: 'timeline-layout' },
          h(
            'aside',
            {
              class: 'timeline-index',
              'aria-label': t('explore.timeline.index_label'),
            },
            h('h3', { class: 'timeline-eyebrow' }, t('explore.timeline.archive')),
            h(
              'div',
              { class: 'timeline-index__items' },
              navButton('', t('explore.timeline.all_dates'), current.games.length, !state.selection),
              state.months.map(({ key, count }) =>
                navButton(key, monthLabel(key), count, selectedMonth === key),
              ),
              (state.undated > 0 || state.selection === 'undated') &&
                navButton('undated', t('explore.timeline.undated'), state.undated, state.selection === 'undated'),
            ),
            h(
              'p',
              { class: 'timeline-index__note' },
              t('explore.timeline.index_note'),
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
                h('p', { class: 'timeline-eyebrow' }, t('explore.timeline.now_reading')),
                h('h2', {}, activeLabel),
              ),
              h(
                'div',
                {
                  class: 'timeline-order',
                  role: 'group',
                  'aria-label': t('explore.timeline.order'),
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
                    value === 'newest' ? t('explore.timeline.newest_first') : t('explore.timeline.oldest_first'),
                  ),
                ),
              ),
            ),
            h(
              'div',
              { class: 'timeline-date-filter' },
              h('label', { for: 'timeline-day-select' }, t('explore.timeline.jump')),
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
                  t('explore.timeline.clear_date'),
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
