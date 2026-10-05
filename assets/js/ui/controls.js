/**
 * ui/controls.js — the search box in the sign's corner, and the toolbar under
 * the shelves: five boxes across, each a dropdown.
 *
 *   Genre · Players · Filters · Sort · View
 *
 * Genre and Players are the filters people reach for first, so they get boxes
 * of their own. Every other filter (Model, Tags, File size, and whatever field
 * the games carry next) sits in the Filters menu, which opens downwards and
 * flies each filter's values out to the right; on a phone they open in place
 * instead. Filters apply as you tap, and a menu stays open so you can pick
 * several. Whatever is filtering the wall shows under the toolbar as chips
 * with a ×. Options that would empty the wall are greyed out; nothing shows a
 * count. The filters themselves are never declared: they come from whatever
 * fields the games carry (manifest.js).
 *
 * The search box, the boxes and their menus are built once and kept, so an
 * open menu stays open while its contents re-render under it.
 */

import { h, append, clear, icon, ICONS } from '../dom.js';
import { SORTS, GROUPINGS } from '../filter.js';
import { MULTI } from '../manifest.js';
import { store } from '../store.js';

/** How big a cabinet is: one to a row, wide, with room for its blurb; or
 *  three to a row. On a phone both are one to a row. */
export const SIZES = [
  { key: 'wide', label: 'One per row' },
  { key: 'three', label: 'Three per row' },
];
export const currentSize = () => (SIZES.some((s) => s.key === store.ui().size) ? store.ui().size : SIZES[0].key);

/** Filters with a box of their own; the rest go under Filters. */
const OWN_BOX = ['genre', 'players'];

/** How a filter's values read on its box: "Any", "Racing", "Racing +2". */
const summary = (values) => (!values.length ? 'Any' : values.length === 1 ? values[0] : `${values[0]} +${values.length - 1}`);

/**
 * @param root        the sticky toolbar, with the active filters under it
 * @param searchRoot  where the search box goes: the sign's top corner
 */
export function createControls(root, { searchRoot = root, onChange, onGroup, onSize }) {
  let last = null;
  /** Which submenu is out, per menu, so a re-render keeps it out. */
  const openSub = new Map();

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

  const boxes = Object.fromEntries(
    ['genre', 'players', 'filters', 'sort', 'view'].map((key) => [key, dropBox(key)])
  );
  const actives = h('div', { class: 'actives', 'aria-label': 'Active filters' });

  searchRoot.append(
    h('div', { class: 'hunt' }, icon(ICONS.search, { class: 'hunt__icon' }), input, clearButton)
  );
  root.append(h('div', { class: 'toolbar' }, Object.values(boxes).map((box) => box.wrap)), actives);

  /* --- a box and its menu ------------------------------------------------- */

  function dropBox(key) {
    const id = `menu-${key}`;
    const button = h('button', { class: 'box', type: 'button', popovertarget: id });
    const menu = h('div', { id, class: 'drop drop--cascade', popover: 'auto' });
    // Fixed in the top layer, so nothing clips it; it follows its box while
    // the page scrolls, because picking a filter can scroll the wall.
    const follow = () => place(menu, button);
    menu.addEventListener('beforetoggle', (event) => {
      if (event.newState === 'open') follow();
    });
    menu.addEventListener('toggle', (event) => {
      if (event.newState === 'open') {
        // Again now it has a width, so it can keep clear of the right edge.
        follow();
        addEventListener('scroll', follow, { passive: true });
      }
      else {
        removeEventListener('scroll', follow);
        openSub.delete(key);
      }
    });
    return { key, button, menu, follow, wrap: h('div', { class: 'toolbar__item' }, button, menu) };
  }

  function setBox(box, label, value, on) {
    box.button.classList.toggle('is-on', on);
    box.button.setAttribute('aria-label', `${label}: ${value}`);
    append(clear(box.button), [
      h('span', { class: 'box__text' }, h('span', { class: 'box__label' }, label), h('span', { class: 'box__value' }, value)),
      icon(ICONS.caret, { width: 14, height: 14, class: 'box__caret' }),
    ]);
  }

  /** Under its box, or over it when the page has no room below. */
  function place(menu, button) {
    const box = button.getBoundingClientRect();
    const below = innerHeight - box.bottom;
    const up = below < 220 && box.top > below;
    Object.assign(menu.style, {
      top: up ? 'auto' : `${box.bottom + 6}px`,
      bottom: up ? `${innerHeight - box.top + 6}px` : 'auto',
      left: `${Math.max(8, Math.min(box.left, document.documentElement.clientWidth - menu.offsetWidth - 8))}px`,
      minWidth: `${box.width}px`,
      maxHeight: `${Math.max((up ? box.top : below) - 14, 160)}px`,
    });
  }

  /** One row of a menu. `close` shuts the menu after (single choices do). */
  const item = (text, { on = false, disabled = false, onclick, close = false, check = 'box' } = {}) =>
    h(
      'button',
      {
        class: `drop__item drop__item--${check}`,
        type: 'button',
        'aria-pressed': String(on),
        disabled: !on && disabled,
        onclick: (event) => {
          if (close) event.currentTarget.closest('[popover]')?.hidePopover();
          onclick();
        },
      },
      h('span', { class: 'drop__mark', 'aria-hidden': 'true' }),
      h('span', { class: 'drop__text' }, text)
    );

  /**
   * A row that opens a submenu: out to the right of the menu on a wide screen
   * (to the left when the right edge is too close), in place on a phone.
   */
  function submenu(menuKey, subKey, text, hint, rows, on = null) {
    const open = openSub.get(menuKey) === subKey;
    const sub = h('div', { class: 'drop__sub', role: 'group', 'aria-label': text }, rows);
    const group = h(
      'div',
      { class: `drop__group${open ? ' is-open' : ''}` },
      h(
        'button',
        {
          class: 'drop__item drop__item--parent',
          type: 'button',
          'aria-expanded': String(open),
          'aria-pressed': on === null ? null : String(on),
          onclick: () => {
            if (open) openSub.delete(menuKey);
            else openSub.set(menuKey, subKey);
            if (last) render(...last);
          },
          onmouseenter: () => {
            if (!matchMedia('(hover: hover) and (min-width: 48rem)').matches || open) return;
            openSub.set(menuKey, subKey);
            if (last) render(...last);
          },
        },
        // Beside rows that tick, a row with a submenu ticks too, so it lines up.
        on !== null && h('span', { class: 'drop__mark', 'aria-hidden': 'true' }),
        h('span', { class: 'drop__text' }, text),
        hint && h('span', { class: 'drop__hint' }, hint),
        icon(ICONS.caret, { width: 12, height: 12, class: 'drop__chev' })
      ),
      sub
    );
    if (open) {
      requestAnimationFrame(() => {
        const box = sub.getBoundingClientRect();
        sub.classList.toggle('drop__sub--left', box.right > document.documentElement.clientWidth - 8);
      });
    }
    return group;
  }

  /* --- the filters -------------------------------------------------------- */

  /**
   * A filter's values as rows. Several in one filter widen the wall (Racing or
   * Flight); different filters narrow it. A value with others under it
   * (Multiplayer, then how many) opens them as a submenu, and those pick one
   * at a time.
   */
  function facetRows(menuKey, facet, state, counted) {
    const active = state.facets[facet.key] || [];
    const set = (next) => onChange({ [facet.key]: next.join(',') });
    const zero = (option) => (counted.get(option.value) ?? 0) === 0;
    const rows = [item(`Any ${facet.label.toLowerCase()}`, { on: !active.length, onclick: () => set([]), check: 'radio' })];
    for (const option of facet.options.filter((o) => !o.under)) {
      const inner = facet.options.filter((o) => o.under === option.value);
      const group = [option.value, ...inner.map((o) => o.value)];
      const on = active.some((v) => group.includes(v));
      const others = active.filter((v) => !group.includes(v));
      if (!inner.length) {
        rows.push(
          item(option.value, {
            on,
            disabled: zero(option),
            onclick: () => set(on ? others : [...active, option.value]),
          })
        );
        continue;
      }
      const picked = inner.find((o) => active.includes(o.value));
      rows.push(
        submenu(menuKey, `${facet.key}:${option.value}`, option.value, on ? picked?.value ?? 'Any number' : null, [
          item(option.value === MULTI ? 'Any number' : `Any ${option.value.toLowerCase()}`, {
            on: active.includes(option.value),
            disabled: zero(option),
            check: 'radio',
            onclick: () => set(active.includes(option.value) ? others : [...others, option.value]),
          }),
          inner.map((o) =>
            item(o.value, {
              on: active.includes(o.value),
              disabled: zero(o),
              check: 'radio',
              onclick: () => set(active.includes(o.value) ? others : [...others, o.value]),
            })
          ),
        ], on)
      );
    }
    return rows;
  }

  function renderFacetBox(box, facet, state, counts) {
    box.wrap.hidden = !facet;
    if (!facet) return;
    const active = state.facets[facet.key] || [];
    setBox(box, facet.label, summary(active), active.length > 0);
    clear(box.menu).append(...facetRows(box.key, facet, state, counts.get(facet.key) || new Map()));
  }

  function renderFilters(state, facets, counts) {
    const box = boxes.filters;
    const rest = facets.filter((facet) => !OWN_BOX.includes(facet.key));
    const faves = store.faveCount() > 0;
    box.wrap.hidden = !rest.length && !faves;
    const on = rest.filter((facet) => (state.facets[facet.key] || []).length).map((facet) => facet.label);
    if (state.favesOnly) on.unshift('Favourites');
    setBox(box, 'Filters', summary(on), on.length > 0);
    clear(box.menu).append(
      ...(faves
        ? [
            item('Favourites only', {
              on: state.favesOnly,
              onclick: () => onChange({ fav: state.favesOnly ? '' : '1' }),
            }),
          ]
        : []),
      ...rest.map((facet) => {
        const active = state.facets[facet.key] || [];
        return submenu(
          'filters',
          facet.key,
          facet.label,
          active.length ? summary(active) : null,
          facetRows('filters', facet, state, counts.get(facet.key) || new Map())
        );
      })
    );
  }

  /* --- Sort and View ------------------------------------------------------ */

  function renderSort(state) {
    // "Most played" is meaningless before anything has been played.
    const available = SORTS.filter(
      (sort) => !['played', 'recent'].includes(sort.key) || store.playedCount() > 0
    );
    const current = available.find((s) => s.key === state.sort) || available[0];
    setBox(boxes.sort, 'Sort', current.label, false);
    clear(boxes.sort.menu).append(
      ...available.map((sort) =>
        item(sort.label, { on: sort === current, check: 'radio', close: true, onclick: () => onChange({ sort: sort.key }) })
      )
    );
  }

  function renderView() {
    const current = GROUPINGS.find((g) => g.key === store.ui().group) || GROUPINGS[0];
    setBox(boxes.view, 'View', current.key === 'none' ? 'No stacks' : `Stack by ${current.label.toLowerCase()}`, false);
    clear(boxes.view.menu).append(
      h('p', { class: 'drop__head' }, 'Size'),
      ...SIZES.map((size) =>
        item(size.label, { on: size.key === currentSize(), check: 'radio', close: true, onclick: () => onSize(size.key) })
      ),
      h('p', { class: 'drop__head' }, 'Stack by'),
      ...GROUPINGS.map((g) =>
        item(g.label, { on: g === current, check: 'radio', close: true, onclick: () => onGroup(g.key) })
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
    if (!chips.length) return;
    const patch = { fav: '' };
    for (const facet of facets) patch[facet.key] = '';
    actives.append(
      ...chips,
      h('button', { class: 'actives__clear', type: 'button', onclick: () => onChange(patch) }, 'Clear all')
    );
  }

  function render(state, { facets, counts }) {
    last = [state, { facets, counts }];
    if (input.value !== state.query) {
      input.value = state.query;
      clearButton.hidden = !state.query;
    }
    const byKey = (key) => facets.find((facet) => facet.key === key);
    renderFacetBox(boxes.genre, byKey('genre'), state, counts);
    renderFacetBox(boxes.players, byKey('players'), state, counts);
    renderFilters(state, facets, counts);
    renderSort(state);
    renderView();
    renderActives(state, facets);
    // A submenu opening or closing changes a menu's size: keep it in place.
    for (const box of Object.values(boxes)) if (box.menu.matches(':popover-open')) box.follow();
  }

  return {
    focusSearch: () => input.focus(),
    render,
  };
}
