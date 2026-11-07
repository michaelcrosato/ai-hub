/**
 * ui/views.js — seven ways into the same library, and the switch between
 * them that every one of them carries.
 *
 *   Wall       the arcade: cabinets on a wall, picked by shelf and filter
 *   Friends    game night: host or join a session, and the games that play together
 *   Couch      the big screen: a hero and rails, driven by arrows or a gamepad
 *   Catalogue  the reading room: every game a row, narrowed by query and chart
 *   Atlas, Timeline and Deck: by genre district, by date added, one card at a time
 *
 * A game that is open travels with you: the switch links to the same game in
 * the other view, and a search carries over as the other view's search, as
 * far as it is plain words (the Catalogue's field filters stay behind).
 */

import { h, icon } from '../dom.js';
import { t } from '../lang.js';

export const VIEWS = [
  { key: 'wall', label: t('views.wall'), href: '/', hint: t('views.wall_hint'), glyph: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  {
    key: 'friends',
    label: t('views.friends'),
    href: '/friends',
    hint: t('views.friends_hint'),
    glyph: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4a6.5 6.5 0 0 1 3.5 5.6',
  },
  { key: 'couch', label: t('views.couch'), href: '/couch', hint: t('views.couch_hint'), glyph: 'M3 5h18v11H3zM8 20h8M12 16v4' },
  {
    key: 'catalogue',
    label: t('views.catalogue'),
    href: '/catalogue',
    hint: t('views.catalogue_hint'),
    glyph: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  },
  { key: 'atlas', label: t('views.atlas'), href: '/atlas', hint: t('views.atlas_hint'), glyph: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15' },
  { key: 'timeline', label: t('views.timeline'), href: '/timeline', hint: t('views.timeline_hint'), glyph: 'M6 3v18M3 6h6M3 12h6M3 18h6M12 6h8M12 12h5M12 18h8' },
  { key: 'deck', label: t('views.deck'), href: '/deck', hint: t('views.deck_hint'), glyph: 'M7 6h13v15H7zM4 18H2V2h13v2M11 11l5 3-5 3z' },
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
  const nav = h('nav', { class: `views ${className}`.trim(), 'aria-label': t('views.nav') }, links);

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
