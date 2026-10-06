/**
 * catalogue/facets.js — the facet panel: every facet a little horizontal bar
 * chart, and every bar a button that writes its term into the query.
 *
 * Each bar has three layers (see tally.js): the whole library as a ghost,
 * what the other filters leave in grey, and the selection in the one accent
 * colour. The options never reorder as the selection changes, so the panel
 * is built once and every later render only moves widths and numbers.
 */

import { h } from '../dom.js';

/** Past this many values a facet folds, with a "Show all" to open it. */
const FOLD = 8;

export function createFacets(root, { onToggle, onClearField, onClearAll }) {
  let built = null;

  const clearAll = h(
    'button',
    { type: 'button', class: 'facets__clear', onclick: onClearAll, hidden: true },
    'Clear all'
  );
  const list = h('div', { class: 'facets__list' });
  root.append(
    h(
      'header',
      { class: 'facets__head' },
      h('h2', { class: 'label' }, 'Facets'),
      clearAll,
      h(
        'ul',
        { class: 'legend', 'aria-label': 'How to read the bars' },
        h('li', {}, h('i', { class: 'key key--selected', 'aria-hidden': 'true' }), 'Selected'),
        h('li', {}, h('i', { class: 'key key--other', 'aria-hidden': 'true' }), 'Left out by this facet'),
        h('li', {}, h('i', { class: 'key key--total', 'aria-hidden': 'true' }), 'Library')
      )
    ),
    list
  );

  function build(tallies) {
    built = new Map();
    for (const facet of tallies) {
      const options = new Map();
      const clear = h(
        'button',
        {
          type: 'button',
          class: 'facet__clear',
          hidden: true,
          onclick: () => onClearField(facet.field),
          'aria-label': `Clear ${facet.label}`,
        },
        'Clear'
      );
      const items = facet.options.map((option) => {
        const n = h('span', { class: 'bar__n' });
        const of = h('span', { class: 'bar__of' });
        const button = h(
          'button',
          {
            type: 'button',
            class: 'bar',
            'aria-pressed': 'false',
            title: `${option.value}. Click to filter by it, Shift-click to leave it out.`,
            onclick: (event) => onToggle(event.shiftKey ? `-${option.term}` : option.term),
          },
          h('span', { class: 'bar__label' }, option.value),
          h(
            'span',
            { class: 'bar__track', 'aria-hidden': 'true' },
            h('span', { class: 'bar__total' }),
            h('span', { class: 'bar__other' }),
            h('span', { class: 'bar__selected' })
          ),
          h('span', { class: 'bar__count' }, n, of)
        );
        const item = h('li', { class: 'facet__option' }, button);
        options.set(option.value, { item, button, n, of });
        return item;
      });
      const more =
        facet.options.length > FOLD &&
        h(
          'button',
          { type: 'button', class: 'facet__more', 'aria-expanded': 'false' },
          `Show all ${facet.options.length}`
        );
      const section = h(
        'section',
        { class: 'facet', dataset: { field: facet.field }, 'aria-label': facet.label },
        h('h3', { class: 'facet__title' }, h('span', { class: 'label' }, facet.label), clear),
        h('ul', { class: 'facet__options' }, items),
        more
      );
      if (more) {
        more.addEventListener('click', () => {
          const open = section.classList.toggle('is-open');
          more.setAttribute('aria-expanded', String(open));
          more.textContent = open ? 'Show fewer' : `Show all ${facet.options.length}`;
        });
      }
      list.append(section);
      built.set(facet.field, { section, clear, options });
    }
  }

  return {
    render(tallies, { filtering }) {
      if (!built) build(tallies);
      clearAll.hidden = !filtering;
      for (const facet of tallies) {
        const parts = built.get(facet.field);
        if (!parts) continue;
        parts.clear.hidden = !facet.filtered;
        parts.section.classList.toggle('is-filtered', facet.filtered);
        for (const option of facet.options) {
          const view = parts.options.get(option.value);
          if (!view) continue;
          const { item, button, n, of } = view;
          button.style.setProperty('--total', option.total / facet.max);
          button.style.setProperty('--other', option.other / facet.max);
          button.style.setProperty('--selected', option.selected / facet.max);
          button.setAttribute('aria-pressed', String(option.pressed));
          button.classList.toggle('is-excluded', option.excluded);
          button.classList.toggle('is-empty', option.other === 0);
          button.setAttribute(
            'aria-label',
            `${option.value}: ${option.other} of ${option.total}${option.excluded ? ', left out' : ''}`
          );
          // A pressed or left-out value stays in view even when its facet is folded.
          item.classList.toggle('is-on', option.pressed || option.excluded);
          n.textContent = String(option.other);
          of.textContent = option.other === option.total ? '' : `/${option.total}`;
        }
      }
    },
  };
}
