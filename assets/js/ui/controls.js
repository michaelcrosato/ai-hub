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
 * than a control wall. Tags fold away entirely until asked for.
 *
 * The Source rail leads, and it works in steps: Original or Inspired; for
 * inspired, a series (Dragon Quest); then, if you like, the one game in it
 * (Dragon Quest III). The stacks on the wall are the same steps, so pressing
 * a stack and pressing its chip here land in the same place.
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { SORTS } from '../filter.js';
import { sameKey, MULTI } from '../manifest.js';
import { store } from '../store.js';

/** Options a rail shows before folding the rest away. Chosen ones always show. */
const RAIL_LIMIT = 8;
/** Rails folded away entirely until opened: dozens of tags narrow little
 *  until you go looking for one. */
const FOLDED = new Set(['tags']);

/** How an option that opens a menu names itself as the menu's first item. */
const ANY = { [MULTI]: 'Any number' };

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

  /**
   * The chips for one rail's options, folded past its limit unless opened.
   * An option with others under it (Multiplayer, then how many) is a chip
   * that drops a menu of them instead.
   */
  function chips(key, label, options, { isOn, onPick, under = () => [], onSet }) {
    const open = expanded.has(key);
    const limit = FOLDED.has(key) ? 0 : RAIL_LIMIT;
    const kept = open ? options : options.filter((option, i) => i < limit || isOn(option.value));
    const folded = options.length - kept.length;
    const noun = label.toLowerCase();
    return [
      ...kept.map((option) => {
        const inner = under(option);
        if (inner.length) return dropChip(key, option, inner, { isOn, onSet });
        const on = isOn(option.value);
        return h(
          'button',
          {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(on),
            disabled: !on && option.count === 0,
            onclick: () => onPick(option.value, on),
          },
          option.label ?? option.value
        );
      }),
      folded > 0 &&
        h(
          'button',
          { class: 'chip chip--fold', type: 'button', 'aria-expanded': 'false', onclick: () => refold(key, true) },
          limit === 0 && !kept.length ? `Show ${noun}` : `+${folded} more`
        ),
      open &&
        options.length > limit &&
        h(
          'button',
          { class: 'chip chip--fold', type: 'button', 'aria-expanded': 'true', onclick: () => refold(key, false) },
          limit === 0 ? `Hide ${noun}` : 'Fewer'
        ),
    ];
  }

  /**
   * A chip that drops a menu: the option itself first, as "Any number", then
   * each closer look at it. One of them at a time, and picking the lit one
   * again lets go. The menu sits in the top layer, so a rail that scrolls
   * sideways on a phone cannot clip it, and any scroll closes it.
   */
  function dropChip(key, option, inner, { isOn, onSet }) {
    const items = [{ ...option, label: ANY[option.value] ?? option.value }, ...inner];
    const picked = items.find((item) => isOn(item.value));
    const id = `drop-${key}-${sameKey(option.value).replace(/\W+/g, '-')}`;

    const shut = (event) => {
      if (event?.target === menu) return;
      if (menu.matches(':popover-open')) menu.hidePopover();
    };
    const menu = h(
      'div',
      {
        id,
        class: 'drop',
        popover: 'auto',
        'aria-label': option.value,
        ontoggle: (event) => {
          if (event.newState === 'open') addEventListener('scroll', shut, { capture: true, passive: true });
          else removeEventListener('scroll', shut, { capture: true });
        },
        onbeforetoggle: (event) => {
          if (event.newState === 'open') place(menu, chip);
        },
      },
      items.map((item) => {
        const on = item === picked;
        return h(
          'button',
          {
            class: 'drop__item',
            type: 'button',
            'aria-pressed': String(on),
            disabled: !on && item.count === 0,
            onclick: () => {
              shut();
              onSet(items.map((i) => i.value), on ? null : item.value);
            },
          },
          item.label ?? item.value
        );
      })
    );
    const chip = h(
      'button',
      {
        class: `chip chip--drop${picked ? ' is-on' : ''}`,
        type: 'button',
        popovertarget: id,
        disabled: !picked && items.every((item) => item.count === 0),
      },
      picked && picked !== items[0] ? picked.value : option.value,
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

  /**
   * Original or inspired first. Once one is picked it stays, lit, and pressing
   * it again goes back to both; inspired then offers its series, and a series,
   * or the originals, the games that more than one attempt went at.
   */
  function sourceRail(state, sources) {
    if (!sources || (!state.origin && sources.origins.length < 2)) return null;
    const same = (a, b) => sameKey(a) === sameKey(b);
    const step = () => h('span', { class: 'rail__step', 'aria-hidden': 'true' }, '›');
    const lit = (text, title, onclick) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', title, onclick }, text);
    const parts = [h('span', { class: 'rail__label' }, 'Source')];

    if (!state.origin) {
      parts.push(
        ...chips('source:origin', 'Source', sources.origins, {
          isOn: () => false,
          onPick: (value) => onChange({ origin: value, series: '', source: '' }),
        })
      );
    } else {
      const origin = sources.origins.find((option) => option.value === state.origin);
      parts.push(
        lit(origin ? origin.label : state.origin, 'Back to every source', () =>
          onChange({ origin: '', series: '', source: '' })
        )
      );
    }

    if (state.origin === 'inspired' && !state.series && sources.series.length) {
      parts.push(
        step(),
        ...chips('source:series', 'Series', sources.series, {
          isOn: () => false,
          onPick: (value) => onChange({ series: value, source: '' }),
        })
      );
    } else if (state.series) {
      const picked = sources.series.find((option) => same(option.value, state.series));
      parts.push(
        step(),
        lit(picked ? picked.value : state.series, 'Back to every series', () => onChange({ series: '', source: '' }))
      );
    }

    if (sources.titles.length) {
      parts.push(
        step(),
        ...chips('source:titles', 'Games', sources.titles, {
          isOn: (value) => same(value, state.source),
          onPick: (value, on) => onChange({ source: on ? '' : value }),
        })
      );
    }
    return h('div', { class: 'rail rail--source' }, ...parts);
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
      h('span', { class: 'chip__text' }, ' Favourites')
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
      // Counts only grey out what would empty the wall; the chips never show them.
      const options = facet.options.map((option) => ({ ...option, count: counted.get(option.value) ?? 0 }));
      const set = (next) => onChange({ [facet.key]: next.join(',') });
      rails.append(
        h(
          'div',
          { class: 'rail' },
          h('span', { class: 'rail__label' }, facet.label),
          ...chips(
            facet.key,
            facet.label,
            options.filter((option) => !option.under),
            {
              isOn: (value) => active.includes(value),
              onPick: (value, on) => set(on ? active.filter((v) => v !== value) : [...active, value]),
              under: (option) => options.filter((inner) => inner.under === option.value),
              onSet: (group, value) => set([...active.filter((v) => !group.includes(v)), ...(value ? [value] : [])]),
            }
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
