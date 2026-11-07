/**
 * account/button.js — the account control every view carries next to its
 * switch: "Sign in" (with Google), or the player's menu: play time, play with
 * friends, privacy, sign out, delete my data.
 */

import { h, clear } from '../dom.js';
import { t, duration as formatDuration } from '../lang.js';
import { store } from '../store.js';
import { currentUser, onUser, signInWithGoogle, signOut, deleteAccount, savedNickname } from './auth.js';
import { hasSession } from './cloud.js';
import { syncPlays } from './sync.js';
import { toast } from './toast.js';
import { friendsButton } from '../ui/friends.js';

/** "3h 5m", "12m", "under a minute". */
export function duration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  if (s < 60) return t('account.duration.under_minute');
  return formatDuration({ hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60) });
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
      h('p', { class: 'account__who' }, name || t('account.menu.signed_in'), user.email && h('span', {}, user.email)),
      h('p', { class: 'account__stat' }, t('account.menu.played', { count: totals.games, time: duration(totals.seconds) })),
      h('a', { class: 'account__item', role: 'menuitem', href: '/friends' }, t('account.menu.friends')),
      h('a', { class: 'account__item', role: 'menuitem', href: '/privacy/' }, t('account.menu.privacy')),
      h('button', { type: 'button', class: 'account__item', role: 'menuitem', onclick: () => signOut().then(close) }, t('account.menu.sign_out')),
      h('button', { type: 'button', class: 'account__item account__danger', role: 'menuitem', onclick: () => confirmDelete() }, t('account.menu.delete'))
    );
    root.append(menu);
    addEventListener('pointerdown', outside, true);
    menu.querySelector('a, button')?.focus();
    trigger.setAttribute('aria-expanded', 'true');
  }

  async function confirmDelete() {
    close();
    if (!confirmDialog(t('account.delete.confirm'))) return;
    try {
      const done = await deleteAccount();
      if (done === true) toast(t('account.delete.done'));
    } catch (error) {
      toast(t('account.delete.failed', { reason: error.message }));
    }
  }

  async function render(user) {
    clear(root);
    // Everywhere but where friends already are: the Friends view and the session itself.
    if (!/^\/(friends|session)\/?$/.test(location.pathname)) root.append(friendsButton({ className: 'account__friends' }));
    if (!user) {
      root.append(
        h('button', { type: 'button', class: 'account__signin', onclick: () => signInWithGoogle().catch(() => toast(t('account.signin.unavailable'))) }, t('account.signin'))
      );
      return;
    }
    if (user.pending) return;
    if (user.guest) {
      root.append(h('span', { class: 'account__guest', title: t('account.guest.title') }, t('account.guest')));
      return;
    }
    const trigger = h('button', { type: 'button', class: 'account__me', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: t('account.me.title') }, '●', h('span', {}, t('account.me.label')));
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
