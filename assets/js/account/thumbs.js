/**
 * account/thumbs.js — a thumbs up or down on a game, for players signed in
 * with Google. Each player sees only their own vote; the totals are for the
 * hub's owner to read in the database.
 */

import { h } from '../dom.js';
import { attempt, hasSession } from './cloud.js';
import { currentUser, signInWithGoogle } from './auth.js';
import { toast } from './toast.js';

let votes = null; // slug -> 1 | -1, loaded once per page

async function myVotes() {
  if (!votes) {
    const rows = await attempt((sb) => sb.from('feedback').select('slug, vote'), []);
    votes = new Map(rows.map((r) => [r.slug, r.vote]));
  }
  return votes;
}

async function canVote() {
  const user = await currentUser();
  return Boolean(user && !user.guest);
}

/** Set (1 or -1) or take back (0) this player's vote. True when the database has it. */
export async function setVote(slug, vote) {
  const user = await currentUser();
  if (!user || user.guest) return false;
  const ok =
    vote === 0
      ? await attempt((sb) => sb.from('feedback').delete().eq('user_id', user.id).eq('slug', slug), false)
      : await attempt(
          (sb) => sb.from('feedback').upsert({ user_id: user.id, slug, vote, updated_at: new Date().toISOString() }).select('slug'),
          false
        );
  if (ok === false) return false;
  (await myVotes())[vote ? 'set' : 'delete'](slug, vote);
  return true;
}

/** The two buttons for one game. Signed out, a press asks to sign in with Google. */
export function thumbs(slug, { className = '' } = {}) {
  const up = h('button', { type: 'button', class: 'thumbs__up', 'aria-label': 'I like this game', title: 'I like this game', 'aria-pressed': 'false' }, '👍');
  const down = h('button', { type: 'button', class: 'thumbs__down', 'aria-label': 'Not for me', title: 'Not for me', 'aria-pressed': 'false' }, '👎');
  const el = h('div', { class: `thumbs ${className}`.trim(), role: 'group', 'aria-label': 'Rate this game' }, up, down);

  const show = (vote) => {
    up.setAttribute('aria-pressed', String(vote === 1));
    down.setAttribute('aria-pressed', String(vote === -1));
  };
  if (hasSession()) {
    canVote().then(async (ok) => ok && show((await myVotes()).get(slug) || 0));
  }

  const press = async (vote) => {
    if (!(await canVote())) {
      toast(h('span', {}, 'Sign in with Google to rate games. ', h('button', { type: 'button', class: 'account-link', onclick: () => signInWithGoogle() }, 'Sign in')));
      return;
    }
    const before = (await myVotes()).get(slug) || 0;
    const next = before === vote ? 0 : vote;
    show(next);
    if (!(await setVote(slug, next))) {
      show(before);
      toast('Your vote could not be saved just now.');
    }
  };
  up.addEventListener('click', () => press(1));
  down.addEventListener('click', () => press(-1));
  return el;
}

/** After a solo game: a quick vote, for a signed-in player who hasn't voted on it. */
export async function askAfterPlay(game, seconds) {
  if (seconds < 30 || !hasSession() || !(await canVote())) return;
  if ((await myVotes()).has(game.slug)) return;
  toast(h('span', { class: 'account-ask' }, `How was ${game.name}?`, thumbs(game.slug)), 9_000);
}
