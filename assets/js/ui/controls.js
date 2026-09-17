/**
 * ui/controls.js — the strip under the sign.
 *
 * The search box and sort select are built once and kept, because rebuilding
 * them on every keystroke would steal focus. Only the facet rails re-render,
 * and those rails are not declared anywhere: they come from whatever fields
 * the games actually carry. Add none and you get search, sort and favourites.
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { SORTS } from '../filter.js';
import { store } from '../store.js';

export function createControls(root, { onChange }) {
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

  const rails = h('div', { class: 'rail rail--facets' });

  root.append(
    h('div', { class: 'hunt' }, input, clearButton),
    rails,
    h('div', { class: 'controls__spacer' }),
    faves,
    sorter
  );

  let lastSortKeys = '';

  return {
    focusSearch: () => input.focus(),

    render(state, { facets, counts }) {
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
      faves.append(
        icon(ICONS.star, { fill: state.favesOnly ? 'currentColor' : 'none', width: 13, height: 13 }),
        ' Favourites',
        h('span', { class: 'chip__count' }, faveCount)
      );

      clear(rails);
      for (const facet of facets) {
        const active = state.facets[facet.key] || [];
        const counted = counts.get(facet.key) || new Map();
        rails.append(
          h(
            'div',
            { class: 'rail' },
            h('span', { class: 'rail__label' }, facet.label),
            ...facet.options.map((option) => {
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
            })
          )
        );
      }
    },
  };
}
