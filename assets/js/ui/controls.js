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
 *
 * The Source rail leads, and it works in two steps: pick a series (Dragon
 * Quest), then, if you like, the one game in it (Dragon Quest III). The stacks
 * on the wall are the same two steps, so pressing a stack and pressing its
 * chip here land in the same place.
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { SORTS } from '../filter.js';
import { sameKey } from '../manifest.js';
import { store } from '../store.js';

/** Options a rail shows before folding the rest away. Chosen ones always show. */
const RAIL_LIMIT = 8;

/**
 * @param root       the sticky strip: search, surprise, favourites, sort, density
 * @param railsRoot  where the filter rails go — on the page, not in the sticky
 *                   strip, because a library with five rails would otherwise
 *                   pin a quarter of the screen
 */
export function createControls(root, { railsRoot = root, onChange, onSurprise, onDensity, onStack }) {
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

  // Also a preference: some days you want every attempt laid out at once.
  const stacking = h('button', {
    class: 'chip',
    type: 'button',
    title: 'Stack games that share a source',
    onclick: () => onStack(!store.ui().stack),
  });

  const rails = h('div', { class: 'rail rail--facets' });

  root.append(
    h('div', { class: 'hunt' }, input, clearButton),
    h('div', { class: 'controls__spacer' }),
    surprise,
    faves,
    stacking,
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

  /** The chips for one rail's options, folded past RAIL_LIMIT unless opened. */
  function chips(key, options, { isOn, count, onPick }) {
    const open = expanded.has(key);
    const kept = open ? options : options.filter((option, i) => i < RAIL_LIMIT || isOn(option.value));
    const folded = options.length - kept.length;
    return [
      ...kept.map((option) => {
        const on = isOn(option.value);
        const n = count(option);
        return h(
          'button',
          {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(on),
            disabled: !on && n === 0,
            onclick: () => onPick(option.value, on),
          },
          option.value,
          h('span', { class: 'chip__count' }, n)
        );
      }),
      folded > 0 &&
        h(
          'button',
          { class: 'chip chip--fold', type: 'button', 'aria-expanded': 'false', onclick: () => refold(key, true) },
          `+${folded} more`
        ),
      open &&
        options.length > RAIL_LIMIT &&
        h(
          'button',
          { class: 'chip chip--fold', type: 'button', 'aria-expanded': 'true', onclick: () => refold(key, false) },
          'Fewer'
        ),
    ];
  }

  /**
   * Series first. Once one is picked it is the only series chip left, lit, and
   * pressing it again goes back to every series; the games inside it follow.
   * A series that holds one game skips that second step: there is no choice.
   */
  function sourceRail(state, sources) {
    if (!sources || (!state.series && sources.series.length < 2)) return null;
    const same = (a, b) => sameKey(a) === sameKey(b);
    if (!state.series) {
      return h(
        'div',
        { class: 'rail rail--source' },
        h('span', { class: 'rail__label' }, 'Source'),
        ...chips('source:series', sources.series, {
          isOn: () => false,
          count: (option) => option.count,
          onPick: (value) => onChange({ series: value, source: '' }),
        })
      );
    }
    const picked = sources.series.find((option) => same(option.value, state.series));
    return h(
      'div',
      { class: 'rail rail--source' },
      h('span', { class: 'rail__label' }, 'Source'),
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': 'true',
          title: 'Back to every series',
          onclick: () => onChange({ series: '', source: '' }),
        },
        picked ? picked.value : state.series,
        h('span', { class: 'chip__count' }, picked ? picked.count : 0)
      ),
      sources.titles.length > 1 && [
        h('span', { class: 'rail__step', 'aria-hidden': 'true' }, '›'),
        ...chips('source:titles', sources.titles, {
          isOn: (value) => same(value, state.source),
          count: (option) => option.count,
          onPick: (value, on) => onChange({ source: on ? '' : value }),
        }),
      ]
    );
  }

  function render(state, { facets, counts, sources, shown = 0 }) {
    last = [state, { facets, counts, sources, shown }];
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
    for (const facet of facets) {
      const active = state.facets[facet.key] || [];
      const counted = counts.get(facet.key) || new Map();
      rails.append(
        h(
          'div',
          { class: 'rail' },
          h('span', { class: 'rail__label' }, facet.label),
          ...chips(facet.key, facet.options, {
            isOn: (value) => active.includes(value),
            count: (option) => counted.get(option.value) ?? 0,
            onPick: (value, on) => {
              const next = on ? active.filter((v) => v !== value) : [...active, value];
              onChange({ [facet.key]: next.join(',') });
            },
          })
        )
      );
    }
  }

  return {
    focusSearch: () => input.focus(),
    render,
  };
}
