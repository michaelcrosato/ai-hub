/**
 * ui/friends.js — the way into playing with friends that every view carries:
 * the four seats as an emblem, the "Play with friends" button beside the
 * account control, and a game's own "Play with friends" link.
 *
 * The four seat colours are the session's (lib/hub/round.js): red, blue,
 * green and yellow, the players' colours in every session. They are the one
 * colour the hub's chrome uses besides the games' own, and only for this.
 */

import { h } from '../dom.js';
import { SLOT_COLORS } from '../../../lib/hub/round.js';
import { FRIENDS_PATH, friendsHref, playsOnline, togetherOf } from '../friends/together.js';

/** Four seats round a table, one in each player's colour. */
export function emblem({ size = 18, className = 'friends-emblem' } = {}) {
  const at = [
    [7, 7],
    [17, 7],
    [7, 17],
    [17, 17],
  ];
  return h(
    'svg',
    { class: className, viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' },
    at.map(([cx, cy], i) => h('circle', { cx, cy, r: 4.2, fill: SLOT_COLORS[i] }))
  );
}

/** The button beside every view's account control. */
export function friendsButton({ className = '' } = {}) {
  return h(
    'a',
    { class: `friends-cta ${className}`.trim(), href: FRIENDS_PATH, title: 'Host or join a session: up to four players, each on their own device' },
    emblem({ size: 16 }),
    h('span', { class: 'friends-cta__label' }, 'Play with friends')
  );
}

/**
 * A game's "Play with friends": to its page in the Friends view, which says
 * how it plays in a session and hosts one that opens with it. Null for a game
 * that plays in no session (couch co-op is the game's own Play).
 */
export function friendsLink(game, { className = '', label = 'Play with friends' } = {}) {
  if (!game || !playsOnline(game)) return null;
  const t = togetherOf(game);
  return h(
    'a',
    { class: `friends-link ${className}`.trim(), href: friendsHref(game), title: `${t.way.label}: ${t.way.blurb}` },
    emblem({ size: 15 }),
    h('span', { class: 'friends-link__label' }, label)
  );
}
