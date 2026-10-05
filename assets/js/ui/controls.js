/**
 * ui/controls.js — the search box in the sign's corner, and the toolbar under
 * the shelves.
 *
 * The toolbar keeps one thing per job, in the order people reach for them:
 * Source (All, Original, Inspired), Filters, then Sort and View on the right.
 * Whatever is filtering the wall shows underneath as chips you can knock off
 * one at a time, so the state of the wall is never hidden inside a menu.
 *
 * Filters open a panel: under the toolbar on a wide screen, a sheet from the
 * bottom on a phone. Nothing is declared there either: the filters come from
 * whatever fields the games carry, grouped by manifest.js, and they apply as
 * you tap, so there is no Apply button to forget. Options that would empty
 * the wall are greyed out; nothing shows a count.
 *
 * The search box and the toolbar are built once and kept, because rebuilding
 * them on every keystroke would steal focus. Only their contents re-render.
 */

import { h, append, clear, icon, ICONS } from '../dom.js';
import { SORTS } from '../filter.js';
import { GROUPS, MULTI } from '../manifest.js';
import { plural } from '../format.js';
import { store } from '../store.js';

/**
 * @param root        the sticky toolbar, with the active filters and the panel under it
 * @param searchRoot  where the search box goes: the sign's top corner
 */
export function createControls(root, { searchRoot = root, onChange, onDensity, onStack }) {
  let panelOpen = false;
  let last = null;

  const input = h('input', {
    type: 'search',
    placeholder: 'Search the wall…',
    'aria-label': 'Search games by name, blurb or tag',
    autocomplete: 'off',
    spellcheck: 'false',
    oninput: () => {
      clearButton.hidden = !input.value;
      onChange({ q: input.value });
    },
  });

  const clearButton = h(
    'button',
    {
      class: 'hunt__clear',
      type: 'button',
      'aria-label': 'Clear the search',
      hidden: true,
      onclick: () => {
        input.value = '';
        clearButton.hidden = true;
        onChange({ q: '' });
        input.focus();
      },
    },
    icon(ICONS.close)
  );

  const source = h('div', { class: 'segment', role: 'group', 'aria-label': 'Source' });
  const filtersButton = h('button', {
    class: 'tool',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'filter-panel',
    onclick: () => setPanel(!panelOpen),
  });
  const sortMenu = menu('menu-sort', 'Sort');
  const viewMenu = menu('menu-view', 'View');
  const sortButton = h('button', { class: 'tool', type: 'button', popovertarget: 'menu-sort' });
  const viewButton = h(
    'button',
    { class: 'tool', type: 'button', popovertarget: 'menu-view' },
    icon(ICONS.roomy, { width: 15, height: 15 }),
    h('span', { class: 'tool__text' }, 'View'),
    icon(ICONS.caret, { width: 12, height: 12, class: 'tool__caret' })
  );
  sortMenu.addEventListener('beforetoggle', (e) => e.newState === 'open' && place(sortMenu, sortButton));
  viewMenu.addEventListener('beforetoggle', (e) => e.newState === 'open' && place(viewMenu, viewButton));

  const actives = h('div', { class: 'actives', 'aria-label': 'Active filters' });
  const panelBody = h('div', { class: 'panel__body' });
  const showButton = h('button', { class: 'panel__show', type: 'button', onclick: () => setPanel(false) });
  const panel = h(
    'section',
    { class: 'panel', id: 'filter-panel', 'aria-label': 'Filters', hidden: true },
    h(
      'header',
      { class: 'panel__head' },
      h('h2', { class: 'panel__title' }, 'Filters'),
      h(
        'button',
        { class: 'panel__close', type: 'button', 'aria-label': 'Close filters', onclick: () => setPanel(false) },
        icon(ICONS.close)
      )
    ),
    panelBody,
    h(
      'footer',
      { class: 'panel__foot' },
      h('button', { class: 'panel__reset', type: 'button', onclick: () => clearAll() }, 'Clear all'),
      showButton
    )
  );
  const backdrop = h('div', { class: 'panel__backdrop', hidden: true, onclick: () => setPanel(false) });

  searchRoot.append(
    h('div', { class: 'hunt' }, icon(ICONS.search, { class: 'hunt__icon' }), input, clearButton)
  );
  root.append(
    h(
      'div',
      { class: 'toolbar' },
      source,
      filtersButton,
      h('div', { class: 'toolbar__spacer' }),
      sortButton,
      sortMenu,
      viewButton,
      viewMenu
    ),
    actives,
    panel,
    backdrop
  );

  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panelOpen) setPanel(false);
  });

  function setPanel(open) {
    panelOpen = open;
    if (last) render(...last);
    if (open) panel.querySelector('button')?.focus({ preventScroll: true });
  }

  /** Every filter off, and favourites; the search and Source stay. */
  function clearAll() {
    const patch = { fav: '' };
    for (const facet of last?.[1].facets || []) patch[facet.key] = '';
    onChange(patch);
  }

  /* --- menus: Sort and View --------------------------------------------- */

  function menu(id, label) {
    const el = h('div', { id, class: 'drop', popover: 'auto', 'aria-label': label });
    const shut = (event) => {
      if (event?.target !== el && el.matches(':popover-open')) el.hidePopover();
    };
    // In the top layer, so nothing clips it; any scroll closes it.
    el.addEventListener('toggle', (event) => {
      if (event.newState === 'open') addEventListener('scroll', shut, { capture: true, passive: true });
      else removeEventListener('scroll', shut, { capture: true });
    });
    return el;
  }

  /** Under its button, or over it when the page has no room below. */
  function place(el, button) {
    const box = button.getBoundingClientRect();
    const below = innerHeight - box.bottom;
    const up = below < 220 && box.top > below;
    const room = (up ? box.top : below) - 14;
    const leftSide = box.left < innerWidth / 2;
    Object.assign(el.style, {
      top: up ? 'auto' : `${box.bottom + 6}px`,
      bottom: up ? `${innerHeight - box.top + 6}px` : 'auto',
      left: leftSide ? `${box.left}px` : 'auto',
      right: leftSide ? 'auto' : `${document.documentElement.clientWidth - box.right}px`,
      maxHeight: `${Math.max(room, 120)}px`,
    });
  }

  const menuItem = (text, on, onclick, hint) =>
    h(
      'button',
      {
        class: 'drop__item',
        type: 'button',
        'aria-pressed': String(on),
        onclick: (event) => {
          event.currentTarget.closest('[popover]')?.hidePopover();
          onclick();
        },
      },
      h('span', {}, text),
      hint && h('span', { class: 'drop__hint' }, hint)
    );

  let lastSortKeys = '';
  function renderSort(state) {
    // "Most played" is meaningless before anything has been played.
    const available = SORTS.filter(
      (sort) => !['played', 'recent'].includes(sort.key) || store.playedCount() > 0
    );
    const current = available.find((s) => s.key === state.sort) || available[0];
    clear(sortButton).append(
      icon(ICONS.sort, { width: 15, height: 15 }),
      h('span', { class: 'tool__text' }, 'Sort: ', h('b', {}, current.label)),
      icon(ICONS.caret, { width: 12, height: 12, class: 'tool__caret' })
    );
    sortButton.setAttribute('aria-label', `Sort: ${current.label}`);
    const keys = `${available.map((s) => s.key).join()}|${current.key}`;
    if (keys === lastSortKeys) return;
    lastSortKeys = keys;
    clear(sortMenu).append(
      ...available.map((sort) => menuItem(sort.label, sort === current, () => onChange({ sort: sort.key })))
    );
  }

  function renderView() {
    const { stack, density } = store.ui();
    clear(viewMenu).append(
      h('p', { class: 'drop__head' }, 'Layout'),
      menuItem('Comfortable', density !== 'compact', () => onDensity('roomy'), 'Bigger cabinets'),
      menuItem('Compact', density === 'compact', () => onDensity('compact'), 'More per row'),
      h('p', { class: 'drop__head' }, 'Grouping'),
      menuItem('Group attempts at the same game', stack, () => onStack(!stack), 'Stacks by series')
    );
  }

  /* --- Source: All, Original, Inspired ------------------------------------ */

  function renderSource(state, sources) {
    clear(source);
    source.hidden = !sources || (!state.origin && sources.origins.length < 2);
    if (source.hidden) return;
    const options = [{ value: '', label: 'All', count: 1 }, ...sources.origins];
    for (const option of options) {
      const on = state.origin === option.value;
      source.append(
        h(
          'button',
          {
            class: 'segment__item',
            type: 'button',
            'aria-pressed': String(on),
            disabled: !on && option.count === 0,
            onclick: () => !on && onChange({ origin: option.value, series: '', source: '' }),
          },
          option.label
        )
      );
    }
  }

  /* --- the panel ---------------------------------------------------------- */

  /**
   * One filter's options as chips. Several in one filter widen the wall (Racing
   * or Flight); different filters narrow it. An option with others under it
   * (Multiplayer, then how many) opens them on a row beneath once it is on,
   * and those pick one at a time.
   */
  function facetField(facet, state, counted) {
    const active = state.facets[facet.key] || [];
    const set = (next) => onChange({ [facet.key]: next.join(',') });
    const count = (option) => counted.get(option.value) ?? 0;
    const chip = (option, on, onclick) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(on),
          disabled: !on && count(option) === 0,
          onclick,
        },
        option.value
      );

    const rows = [];
    const top = facet.options.filter((option) => !option.under);
    rows.push(
      h(
        'div',
        { class: 'field__chips' },
        top.map((option) => {
          const inner = facet.options.filter((o) => o.under === option.value);
          const group = [option.value, ...inner.map((o) => o.value)];
          const on = active.some((v) => group.includes(v));
          return chip(option, on, () =>
            set(on ? active.filter((v) => !group.includes(v)) : [...active, option.value])
          );
        })
      )
    );
    for (const option of top) {
      const inner = facet.options.filter((o) => o.under === option.value);
      const group = [option.value, ...inner.map((o) => o.value)];
      if (!inner.length || !active.some((v) => group.includes(v))) continue;
      const others = active.filter((v) => !group.includes(v));
      rows.push(
        h(
          'div',
          { class: 'field__chips field__chips--under' },
          h('span', { class: 'field__under' }, option.value === MULTI ? 'How many' : option.value),
          inner.map((o) => {
            const on = active.includes(o.value);
            return chip(o, on, () => set([...others, on ? option.value : o.value]));
          })
        )
      );
    }
    return h('div', { class: 'field' }, h('h4', { class: 'field__label' }, facet.label), rows);
  }

  function renderPanel(state, facets, counts) {
    const groups = GROUPS.map((group) => ({
      ...group,
      facets: facets.filter((facet) => facet.group === group.key),
    }));
    const faveCount = store.faveCount();
    if (faveCount) {
      groups[0].lead = h(
        'div',
        { class: 'field' },
        h('h4', { class: 'field__label' }, 'Yours'),
        h(
          'div',
          { class: 'field__chips' },
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              'aria-pressed': String(state.favesOnly),
              onclick: () => onChange({ fav: state.favesOnly ? '' : '1' }),
            },
            icon(ICONS.star, { fill: state.favesOnly ? 'currentColor' : 'none', width: 13, height: 13 }),
            ' Favourites only'
          )
        )
      );
    }
    clear(panelBody).append(
      ...groups
        .filter((group) => group.facets.length || group.lead)
        .map((group) =>
          h(
            'div',
            { class: 'panel__group' },
            h('h3', { class: 'panel__group-title' }, group.label),
            group.lead,
            group.facets.map((facet) => facetField(facet, state, counts.get(facet.key) || new Map()))
          )
        )
    );
  }

  /* --- what is filtering the wall ---------------------------------------- */

  function renderActives(state, facets) {
    const chips = [];
    const pill = (text, patch) =>
      h(
        'button',
        { class: 'pill', type: 'button', 'aria-label': `Remove ${text}`, onclick: () => onChange(patch) },
        text,
        icon(ICONS.close, { width: 12, height: 12 })
      );
    if (state.favesOnly) chips.push(pill('Favourites', { fav: '' }));
    for (const facet of facets) {
      const active = state.facets[facet.key] || [];
      for (const value of active) {
        const next = active.filter((v) => v !== value);
        // Knocking off a head count leaves Multiplayer on, the step above it.
        const above = facet.options.find((o) => o.value === value)?.under;
        chips.push(pill(value, { [facet.key]: (above ? [...next, above] : next).join(',') }));
      }
    }
    clear(actives);
    actives.hidden = !chips.length;
    if (chips.length) {
      actives.append(...chips, h('button', { class: 'actives__clear', type: 'button', onclick: clearAll }, 'Clear all'));
    }
    return chips.length;
  }

  function render(state, { facets, counts, sources, shown = 0 }) {
    last = [state, { facets, counts, sources, shown }];
    if (input.value !== state.query) {
      input.value = state.query;
      clearButton.hidden = !state.query;
    }

    renderSource(state, sources);
    renderSort(state);
    renderView();
    const active = renderActives(state, facets);

    const hasFilters = facets.length > 0 || store.faveCount() > 0;
    filtersButton.hidden = !hasFilters;
    if (!hasFilters) panelOpen = false;
    filtersButton.setAttribute('aria-expanded', String(panelOpen));
    append(clear(filtersButton), [
      icon(ICONS.filter, { width: 15, height: 15 }),
      h('span', { class: 'tool__text' }, 'Filters'),
      active > 0 && h('span', { class: 'tool__badge', 'aria-label': `${active} on` }, String(active)),
      icon(ICONS.caret, { width: 12, height: 12, class: `tool__caret${panelOpen ? ' is-flipped' : ''}` }),
    ]);

    panel.hidden = !panelOpen;
    backdrop.hidden = !panelOpen;
    document.body.classList.toggle('has-sheet', panelOpen);
    if (panelOpen) renderPanel(state, facets, counts);
    showButton.textContent = shown ? `Show ${plural(shown, 'game')}` : 'Nothing matches';
  }

  return {
    focusSearch: () => input.focus(),
    render,
  };
}
