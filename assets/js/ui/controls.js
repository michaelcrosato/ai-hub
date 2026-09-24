/**
 * ui/controls.js — the strip under the sign.
 *
 * The search box and sort select are built once and kept, because rebuilding
 * them on every keystroke would steal focus. Only the facet rails re-render,
 * and those rails are not declared anywhere: they come from whatever fields
 * the games actually carry. Add none and you get search, sort and favourites.
 *
 * A rail shows its most common options and folds the rest behind a "+N more"
 * chip, so a library with forty collections still has a control strip rather
 * than a control wall.
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { SORTS } from '../filter.js';
import { store } from '../store.js';

/** Options a rail shows before folding the rest away. Chosen ones always show. */
const RAIL_LIMIT = 8;

/**
 * @param root       the sticky strip: search, surprise, favourites, sort, density
 * @param railsRoot  where the filter rails go — on the page, not in the sticky
 *                   strip, because a library with five rails would otherwise
 *                   pin a quarter of the screen
 */
export function createControls(root, { railsRoot = root, onChange, onSurprise, onDensity }) {
  const expanded = new Set();
  let last = null;
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

  const surprise = h(
    'button',
    {
      class: 'chip',
      type: 'button',
      title: 'Play a random game from the ones showing',
      'aria-label': 'Surprise me: play a random game from the ones showing',
      onclick: () => onSurprise(),
    },
    icon(ICONS.dice, { width: 13, height: 13 }),
    h('span', { class: 'chip__text' }, ' Surprise me')
  );

  // Remembered per device, like the sort: a preference, not a link.
  const density = h('button', {
    class: 'chip chip--icon',
    type: 'button',
    onclick: () => onDensity(store.ui().density === 'compact' ? 'roomy' : 'compact'),
  });

  const rails = h('div', { class: 'rail rail--facets' });

  root.append(
    h('div', { class: 'hunt' }, input, clearButton),
    h('div', { class: 'controls__spacer' }),
    surprise,
    faves,
    sorter,
    density
  );
  railsRoot.append(rails);

  const refold = (key, open) => {
    if (open) expanded.add(key);
    else expanded.delete(key);
    if (last) render(...last);
  };

  let lastSortKeys = '';

  function render(state, { facets, counts, shown = 0 }) {
    last = [state, { facets, counts, shown }];
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
      h('span', { class: 'chip__text' }, ' Favourites'),
      h('span', { class: 'chip__count' }, faveCount)
    );

    surprise.hidden = shown < 2;

    const compact = store.ui().density === 'compact';
    const label = compact ? 'Show bigger cabinets' : 'Show more cabinets per row';
    density.setAttribute('aria-label', label);
    density.title = label;
    clear(density);
    density.append(icon(compact ? ICONS.roomy : ICONS.dense, { width: 14, height: 14 }));

    clear(rails);
    for (const facet of facets) {
      const active = state.facets[facet.key] || [];
      const counted = counts.get(facet.key) || new Map();
      const open = expanded.has(facet.key);
      const options = open
        ? facet.options
        : facet.options.filter((option, i) => i < RAIL_LIMIT || active.includes(option.value));
      const folded = facet.options.length - options.length;
      rails.append(
        h(
          'div',
          { class: 'rail' },
          h('span', { class: 'rail__label' }, facet.label),
          ...options.map((option) => {
            const on = active.includes(option.value);
            const n = counted.get(option.value) ?? 0;
            return h(
              'button',
              {
                class: 'chip',
                type: 'button',
                'aria-pressed': String(on),
                disabled: !on && n === 0,
                onclick: () => {
                  const next = on
                    ? active.filter((v) => v !== option.value)
                    : [...active, option.value];
                  onChange({ [facet.key]: next.join(',') });
                },
              },
              option.value,
              h('span', { class: 'chip__count' }, n)
            );
          }),
          folded > 0 &&
            h(
              'button',
              {
                class: 'chip chip--fold',
                type: 'button',
                'aria-expanded': 'false',
                onclick: () => refold(facet.key, true),
              },
              `+${folded} more`
            ),
          open &&
            facet.options.length > RAIL_LIMIT &&
            h(
              'button',
              {
                class: 'chip chip--fold',
                type: 'button',
                'aria-expanded': 'true',
                onclick: () => refold(facet.key, false),
              },
              'Fewer'
            )
        )
      );
    }
  }

  return {
    focusSearch: () => input.focus(),
    render,
  };
}
