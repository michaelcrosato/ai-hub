/**
 * account/button.js — the account control every view carries next to its
 * switch: "Sign in" (with Google), or the player's menu: play time, play with
 * friends, privacy, sign out, delete my data.
 */

import { h, clear } from '../dom.js';
import { store } from '../store.js';
import { currentUser, onUser, signInWithGoogle, signOut, deleteAccount, savedNickname } from './auth.js';
import { hasSession } from './cloud.js';
import { syncPlays } from './sync.js';
import { toast } from './toast.js';

/** "3 h 5 min", "12 min", "under a minute". */
export function duration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  if (s < 60) return 'under a minute';
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  return hours ? `${hours} h${minutes ? ` ${minutes} min` : ''}` : `${minutes} min`;
}

export function accountButton({ className = '' } = {}) {
  const root = h('div', { class: `account ${className}`.trim() });
  let menu = null;

  const close = () => {
    menu?.remove();
    menu = null;
    removeEventListener('pointerdown', outside, true);
  };
  const outside = (event) => {
    if (!root.contains(event.target)) close();
  };

  async function open(user, trigger) {
    if (menu) return close();
    const name = await savedNickname();
    const totals = { games: store.playedCount(), seconds: store.totalPlaySeconds() };
    menu = h(
      'div',
      { class: 'account__menu', role: 'menu' },
      h('p', { class: 'account__who' }, name || 'Signed in', user.email && h('span', {}, user.email)),
      h('p', { class: 'account__stat' }, `Played ${totals.games} game${totals.games === 1 ? '' : 's'} · ${duration(totals.seconds)} in all`),
      h('a', { class: 'account__item', role: 'menuitem', href: '/session' }, 'Play with friends'),
      h('a', { class: 'account__item', role: 'menuitem', href: '/privacy/' }, 'Privacy'),
      h('button', { type: 'button', class: 'account__item', role: 'menuitem', onclick: () => signOut().then(close) }, 'Sign out'),
      h('button', { type: 'button', class: 'account__item account__danger', role: 'menuitem', onclick: () => confirmDelete() }, 'Delete my data')
    );
    root.append(menu);
    addEventListener('pointerdown', outside, true);
    menu.querySelector('a, button')?.focus();
    trigger.setAttribute('aria-expanded', 'true');
  }

  async function confirmDelete() {
    close();
    if (!confirmDialog('Delete your account, your votes and your play history? This cannot be undone.')) return;
    try {
      const done = await deleteAccount();
      if (done === true) toast('Your account and everything stored with it are deleted.');
    } catch (error) {
      toast(`Could not delete the account: ${error.message}`);
    }
  }

  async function render(user) {
    clear(root);
    if (location.pathname !== '/session') root.append(h('a', { class: 'account__friends', href: '/session' }, 'Play with friends'));
    if (!user) {
      root.append(
        h('button', { type: 'button', class: 'account__signin', onclick: () => signInWithGoogle().catch(() => toast('Sign-in is unavailable right now.')) }, 'Sign in')
      );
      return;
    }
    if (user.pending) return;
    if (user.guest) {
      root.append(h('span', { class: 'account__guest', title: 'A guest in a session' }, 'Guest'));
      return;
    }
    const trigger = h('button', { type: 'button', class: 'account__me', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Your account' }, '●', h('span', {}, 'Account'));
    trigger.addEventListener('click', () => open(user, trigger));
    root.append(trigger);
    savedNickname().then((name) => name && (trigger.lastChild.textContent = name));
  }

  render(hasSession() ? { pending: true } : null);
  currentUser().then((user) => {
    render(user);
    if (user && !user.guest && sessionStorage.getItem('ai-hub:delete-after-signin')) {
      sessionStorage.removeItem('ai-hub:delete-after-signin');
      confirmDelete();
    }
  });
  onUser(render);
  syncPlays();
  return root;
}

const confirmDialog = (text) => globalThis.confirm(text);
