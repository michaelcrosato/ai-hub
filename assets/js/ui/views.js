/**
 * ui/views.js — six ways into the same library, and the switch between
 * them that every one of them carries.
 *
 *   Wall       the arcade: cabinets on a wall, picked by shelf and filter
 *   Couch      the big screen: a hero and rails, driven by arrows or a gamepad
 *   Catalogue  the reading room: every game a row, narrowed by query and chart
 *
 * A game that is open travels with you: the switch links to the same game in
 * the other view, and a search carries over as the other view's search, as
 * far as it is plain words (the Catalogue's field filters stay behind).
 */

import { h, icon } from '../dom.js';

export const VIEWS = [
  { key: 'wall', label: 'Wall', href: '/', hint: 'Cabinets on a wall', glyph: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { key: 'couch', label: 'Couch', href: '/couch', hint: 'Big screen, for a controller or the arrow keys', glyph: 'M3 5h18v11H3zM8 20h8M12 16v4' },
  {
    key: 'catalogue',
    label: 'Catalogue',
    href: '/catalogue',
    hint: 'Every game as a row, to sort, chart and compare',
    glyph: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  },
  { key: 'atlas', label: 'Atlas', href: '/atlas', hint: 'Explore the library by genre district', glyph: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15' },
  { key: 'timeline', label: 'Timeline', href: '/timeline', hint: 'Travel through the library by date added', glyph: 'M6 3v18M3 6h6M3 12h6M3 18h6M12 6h8M12 12h5M12 18h8' },
  { key: 'deck', label: 'Deck', href: '/deck', hint: 'Discover one shuffled game at a time', glyph: 'M7 6h13v15H7zM4 18H2V2h13v2M11 11l5 3-5 3z' },
];

/**
 * The plain words of a search. Field filters (genre:rpg, -tag:3d,
 * size:<1mb) are the Catalogue's own language; any other view would look for
 * them as text and find nothing.
 */
export const plainWords = (q) =>
  String(q ?? '')
    .replace(/(^|\s)-?[\w-]+:(?:"[^"]*"?|\S*)/g, ' ')
    .replace(/"/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !word.startsWith('-'))
    .join(' ');

/**
 * What of the current address another view understands: the open game
 * (#/g/slug, or the game being played) and the search.
 */
export function carriedHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '');
  const cut = raw.indexOf('?');
  const path = cut === -1 ? raw : raw.slice(0, cut);
  const query = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));
  const [head, slug] = path.split('/').filter(Boolean);
  const game = (head === 'g' || head === 'play') && slug ? `/g/${slug}` : '/';
  const q = plainWords(query.get('q'));
  const tail = q ? `?${new URLSearchParams({ q })}` : '';
  return game === '/' && !tail ? '' : `#${game}${tail}`;
}

/** The switch. `current` is the key of the view it sits in. */
export function viewSwitch(current, { className = '' } = {}) {
  const links = VIEWS.map((view) =>
    h(
      'a',
      {
        class: 'views__link',
        href: view.href,
        title: view.hint,
        'aria-label': view.label,
        'aria-current': view.key === current ? 'page' : null,
        dataset: { view: view.key },
      },
      icon(view.glyph, { class: 'views__glyph', width: 15, height: 15 }),
      h('span', { class: 'views__label' }, view.label)
    )
  );
  const nav = h('nav', { class: `views ${className}`.trim(), 'aria-label': 'Ways to browse the hub' }, links);

  const update = () => {
    const tail = carriedHash();
    for (const [i, view] of VIEWS.entries()) {
      if (view.key !== current) links[i].href = view.href + tail;
    }
  };
  addEventListener('hashchange', update);
  // The routers rewrite the address with replaceState, which fires nothing.
  nav.addEventListener('pointerenter', update);
  nav.addEventListener('focusin', update);
  update();
  return nav;
}
