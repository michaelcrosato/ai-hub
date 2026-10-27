/**
 * account/auth.js — who is signed in on this device.
 *
 * Google sign-in uses the PKCE flow: Google sends the browser back to /auth/
 * with a one-time code (in the query, clear of the hash routes every view
 * uses), /auth/ trades it for a session and returns to the page you left.
 * Session guests are anonymous accounts: they can sit in a session and keep a
 * name, and the database refuses them votes and play history.
 */

import { client, hasSession, attempt, withTimeout } from './cloud.js';
import { RETURN_KEY } from './config.js';

const listeners = new Set();
let current; // undefined: not asked yet; null: signed out; else the user
let watching = false;

const describe = (user) =>
  user ? { id: user.id, guest: user.is_anonymous === true, email: user.email || null } : null;

function announce(user) {
  current = describe(user);
  for (const fn of listeners) fn(current);
}

async function watch() {
  if (watching) return;
  watching = true;
  try {
    const sb = await client();
    sb.auth.onAuthStateChange((_event, session) => {
      const next = describe(session?.user);
      if (JSON.stringify(next) !== JSON.stringify(current)) announce(session?.user);
    });
  } catch {
    watching = false;
  }
}

/** The signed-in user ({ id, guest, email }), or null. Never loads anything for a signed-out device. */
export async function currentUser() {
  if (current !== undefined) return current;
  if (!hasSession()) return (current = null);
  try {
    const sb = await client();
    const { data } = await withTimeout(sb.auth.getSession(), 10_000, 'session');
    current = describe(data.session?.user);
    watch();
  } catch {
    current = null;
  }
  return current;
}

/** fn(user) whenever someone signs in or out on this page. */
export function onUser(fn) {
  listeners.add(fn);
  if (hasSession()) watch();
  return () => listeners.delete(fn);
}

/** Only a page on this site may be returned to after signing in. */
export function safeReturn(target, origin = globalThis.location?.origin) {
  try {
    const url = new URL(target, origin);
    return url.origin === origin && !url.pathname.startsWith('/auth') ? url.pathname + url.search + url.hash : '/';
  } catch {
    return '/';
  }
}

/** Off to Google; back on this page afterwards. */
export async function signInWithGoogle(returnTo = location.href) {
  sessionStorage.setItem(RETURN_KEY, safeReturn(returnTo));
  const sb = await client();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/` },
  });
  if (error) throw error;
}

/** A guest account for joining a session without Google. */
export async function signInAsGuest() {
  const user = await currentUser();
  if (user) return user;
  const sb = await client();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  watch();
  announce(data.user);
  return current;
}

export async function signOut() {
  try {
    const sb = await client();
    await withTimeout(sb.auth.signOut(), 10_000, 'sign-out');
  } catch {
    /* the session is dropped locally below either way */
  }
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('ai-hub:auth')) localStorage.removeItem(key);
  } catch {
    /* storage blocked: nothing was stored */
  }
  announce(null);
}

/** This user's session nickname, or null. */
export async function savedNickname() {
  const user = await currentUser();
  if (!user) return null;
  const rows = await attempt((sb) => sb.from('profiles').select('nickname').eq('user_id', user.id).limit(1), []);
  return rows[0]?.nickname ?? null;
}

export async function saveNickname(nickname) {
  const user = await currentUser();
  if (!user) return false;
  const saved = await attempt((sb) => sb.from('profiles').upsert({ user_id: user.id, nickname }).select('nickname'), null);
  return Boolean(saved);
}

/**
 * Delete the account and everything stored with it. The database asks for a
 * sign-in in the last ten minutes; when that is missing, sign in again and
 * come back to finish (true when done, 'reauth' when sent to Google).
 */
export async function deleteAccount() {
  const sb = await client();
  const { error } = await sb.rpc('delete_my_account');
  if (error) {
    if (/sign in again/.test(error.message)) {
      sessionStorage.setItem('ai-hub:delete-after-signin', '1');
      await signInWithGoogle(location.href);
      return 'reauth';
    }
    throw error;
  }
  await signOut();
  return true;
}
