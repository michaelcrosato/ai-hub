/**
 * ui/controls.js — the search box in the sign's corner, and the sticky strip
 * of filters and view switches under the shelves.
 *
 * The search box and sort select are built once and kept, because rebuilding
 * them on every keystroke would steal focus. Only the filters re-render, and
 * those are not declared anywhere: they come from whatever fields the games
 * actually carry. Add none and you get search, sort and favourites.
 *
 * Each filter is one chip that drops a menu of its values, so a library with
 * forty tags still fits on one line. Players keeps Single player as a chip of
 * its own beside the Multiplayer menu. Source is two toggles, Original and
 * Inspired; the series inside Inspired are the stacks on the wall.
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { SORTS } from '../filter.js';
import { sameKey, MULTI } from '../manifest.js';
import { store } from '../store.js';

/** How an option that opens a menu names itself as the menu's first item. */
const ANY = { [MULTI]: 'Any number' };

/**
 * @param root        the sticky strip: filters, favourites, stacks, sort, density
 * @param searchRoot  where the search box goes: the sign's top corner
 */
export function createControls(root, { searchRoot = root, onChange, onDensity, onStack }) {
  const input = h('input', {
    type: 'search',
    placeholder: 'Search the wall',
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

  const sorter = h('select', {
    class: 'sorter',
    'aria-label': 'Sort the wall',
    onchange: () => onChange({ sort: sorter.value }),
  });

  const faves = h('button', {
    class: 'chip',
    type: 'button',
    'aria-pressed': 'false',
    onclick: () => onChange({ fav: faves.getAttribute('aria-pressed') === 'true' ? '' : '1' }),
  });

  // Remembered per device, like the sort: a preference, not a link.
  const density = h('button', {
    class: 'chip chip--icon',
    type: 'button',
    onclick: () => onDensity(store.ui().density === 'compact' ? 'roomy' : 'compact'),
  });

  // Also a preference: some days you want every attempt laid out at once.
  const stacking = h('button', {
    class: 'chip',
    type: 'button',
    title: 'Stack games that share a source',
    onclick: () => onStack(!store.ui().stack),
  });

  const rails = h('div', { class: 'rail rail--facets' });

  searchRoot.append(h('div', { class: 'hunt' }, input, clearButton));
  root.append(rails, h('div', { class: 'controls__spacer' }), faves, stacking, sorter, density);

  let lastSortKeys = '';

  /**
   * A chip that drops a menu. The chip names the filter until something in
   * it is picked, then names the pick, lit. One pick at a time; picking the
   * lit item again, or the first item when it means "any", lets go. The menu sits in the top layer, so a strip that
   * scrolls sideways on a phone cannot clip it, and any scroll closes it.
   */
  function dropChip(id, name, items, { picked, first, onPick }) {
    const shut = (event) => {
      if (event?.target === menu) return;
      if (menu.matches(':popover-open')) menu.hidePopover();
    };
    const item = (text, on, disabled, value) =>
      h(
        'button',
        {
          class: 'drop__item',
          type: 'button',
          'aria-pressed': String(on),
          disabled: !on && disabled,
          onclick: () => {
            shut();
            onPick(on ? null : value);
          },
        },
        text
      );
    const menu = h(
      'div',
      {
        id,
        class: 'drop',
        popover: 'auto',
        'aria-label': name,
        ontoggle: (event) => {
          if (event.newState === 'open') addEventListener('scroll', shut, { capture: true, passive: true });
          else removeEventListener('scroll', shut, { capture: true });
        },
        onbeforetoggle: (event) => {
          if (event.newState === 'open') place(menu, chip);
        },
      },
      item(first.label, (picked ?? null) === first.value, false, first.value),
      items.map((option) =>
        item(option.label ?? option.value, picked === option.value, option.count === 0, option.value)
      )
    );
    const chip = h(
      'button',
      {
        class: `chip chip--drop${picked ? ' is-on' : ''}`,
        type: 'button',
        popovertarget: id,
        disabled: !picked && items.every((option) => option.count === 0),
      },
      picked && picked !== first.value ? items.find((option) => option.value === picked)?.label ?? picked : name,
      icon(ICONS.caret, { width: 12, height: 12 })
    );
    return [chip, menu];
  }

  /** Under its chip, or over it when the page has no room below. */
  function place(menu, chip) {
    const box = chip.getBoundingClientRect();
    const below = innerHeight - box.bottom;
    const up = below < 220 && box.top > below;
    const room = (up ? box.top : below) - 14;
    Object.assign(menu.style, {
      top: up ? 'auto' : `${box.bottom + 6}px`,
      bottom: up ? `${innerHeight - box.top + 6}px` : 'auto',
      left: box.left < innerWidth / 2 ? `${box.left}px` : 'auto',
      right: box.left < innerWidth / 2 ? 'auto' : `${document.documentElement.clientWidth - box.right}px`,
      maxHeight: `${Math.max(room, 120)}px`,
    });
  }

  /** Original or Inspired: two toggles, and every game is one or the other. */
  function sourceRail(state, sources) {
    if (!sources || (!state.origin && sources.origins.length < 2)) return null;
    return h(
      'div',
      { class: 'rail rail--source' },
      sources.origins.map((option) => {
        const on = state.origin === option.value;
        return h(
          'button',
          {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(on),
            disabled: !on && option.count === 0,
            onclick: () => onChange({ origin: on ? '' : option.value, series: '', source: '' }),
          },
          option.label
        );
      })
    );
  }

  /**
   * One facet: a dropdown of its values. An option with others under it
   * (Multiplayer, then how many) gets a dropdown of its own, and the options
   * beside it (Single player) stay plain toggles.
   */
  function facetRail(facet, state, counted) {
    const active = state.facets[facet.key] || [];
    // Counts only grey out what would empty the wall; the chips never show them.
    const options = facet.options.map((option) => ({ ...option, count: counted.get(option.value) ?? 0 }));
    const set = (next) => onChange({ [facet.key]: next.join(',') });
    const nested = options.filter((option) => options.some((inner) => inner.under === option.value));
    const slug = (text) => sameKey(text).replace(/\W+/g, '-');

    if (!nested.length) {
      return h(
        'div',
        { class: 'rail' },
        dropChip(`drop-${slug(facet.key)}`, facet.label, options, {
          picked: options.find((option) => active.includes(option.value))?.value,
          first: { label: `Any ${facet.label.toLowerCase()}`, value: null },
          onPick: (value) => set(value ? [value] : []),
        })
      );
    }

    return h(
      'div',
      { class: 'rail' },
      options
        .filter((option) => !option.under)
        .map((option) => {
          const inner = options.filter((o) => o.under === option.value);
          if (inner.length) {
            const group = [option.value, ...inner.map((o) => o.value)];
            const others = active.filter((v) => !group.includes(v));
            return dropChip(`drop-${slug(facet.key)}-${slug(option.value)}`, option.value, inner, {
              picked: inner.find((o) => active.includes(o.value))?.value ?? (active.includes(option.value) ? option.value : undefined),
              first: { label: ANY[option.value] ?? `Any ${option.value.toLowerCase()}`, value: option.value },
              onPick: (value) => set(value ? [...others, value] : others),
            });
          }
          const on = active.includes(option.value);
          return h(
            'button',
            {
              class: 'chip',
              type: 'button',
              'aria-pressed': String(on),
              disabled: !on && option.count === 0,
              onclick: () => set(on ? active.filter((v) => v !== option.value) : [...active, option.value]),
            },
            option.value
          );
        })
    );
  }

  function render(state, { facets, counts, sources }) {
    if (input.value !== state.query) {
      input.value = state.query;
      clearButton.hidden = !state.query;
    }

    // "Most played" is meaningless before anything has been played.
    const available = SORTS.filter(
      (sort) => !['played', 'recent'].includes(sort.key) || store.playedCount() > 0
    );
    const keys = available.map((s) => s.key).join();
    if (keys !== lastSortKeys) {
      lastSortKeys = keys;
      clear(sorter);
      for (const sort of available) sorter.append(h('option', { value: sort.key }, sort.label));
    }
    sorter.value = available.some((s) => s.key === state.sort) ? state.sort : available[0].key;

    const faveCount = store.faveCount();
    faves.hidden = faveCount === 0;
    faves.setAttribute('aria-pressed', String(state.favesOnly));
    clear(faves);
    faves.setAttribute('aria-label', `Favourites only (${faveCount})`);
    faves.append(
      icon(ICONS.star, { fill: state.favesOnly ? 'currentColor' : 'none', width: 13, height: 13 }),
      h('span', { class: 'chip__text' }, ' Favourites')
    );

    const stacked = store.ui().stack;
    stacking.setAttribute('aria-pressed', String(stacked));
    stacking.setAttribute(
      'aria-label',
      stacked ? 'Stacks on: press to show every game' : 'Stacks off: press to stack games that share a source'
    );
    clear(stacking);
    stacking.append(icon(ICONS.stack, { width: 13, height: 13 }), h('span', { class: 'chip__text' }, ' Stacks'));

    const compact = store.ui().density === 'compact';
    const label = compact ? 'Show bigger cabinets' : 'Show more cabinets per row';
    density.setAttribute('aria-label', label);
    density.title = label;
    clear(density);
    density.append(icon(compact ? ICONS.roomy : ICONS.dense, { width: 14, height: 14 }));

    clear(rails);
    const source = sourceRail(state, sources);
    if (source) rails.append(source);
    for (const facet of facets) rails.append(facetRail(facet, state, counts.get(facet.key) || new Map()));
  }

  return {
    focusSearch: () => input.focus(),
    render,
  };
}
