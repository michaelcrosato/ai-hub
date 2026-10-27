/**
 * account/cloud.js — the one Supabase client, loaded on first use.
 *
 * Nothing on the wall waits for it: a page that is signed out never loads the
 * library, and when Supabase is unreachable (paused, offline, blocked) every
 * call fails quietly and the hub goes on as a device-only arcade.
 */

import { SUPABASE_URL, SUPABASE_KEY, LIBRARY, AUTH_KEY } from './config.js';

const LOAD_MS = 8_000;
let loading = null;

/** Signed in on this device, as far as can be told without loading anything. */
export function hasSession() {
  try {
    return Boolean(globalThis.localStorage?.getItem(AUTH_KEY));
  } catch {
    return false;
  }
}

/** A promise that gives up after `ms`. */
export function withTimeout(promise, ms, what = 'request') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(script);
  });
}

/** The client, or a rejected promise when the library cannot be had. */
export function client() {
  if (!loading) {
    loading = withTimeout(window.supabase ? Promise.resolve() : loadScript(LIBRARY), LOAD_MS, 'accounts')
      .then(() =>
        window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            flowType: 'pkce',
            storageKey: AUTH_KEY,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        })
      )
      .catch((error) => {
        loading = null;
        throw error;
      });
  }
  return loading;
}

/**
 * Run `fn(client)` and hand back its data, or `fallback` when anything fails:
 * no library, no network, an error from the database.
 */
export async function attempt(fn, fallback = null, ms = 10_000) {
  try {
    const sb = await client();
    const { data, error } = await withTimeout(Promise.resolve(fn(sb)), ms);
    if (error) throw error;
    return data ?? fallback;
  } catch (error) {
    console.warn('[account]', error?.message || error);
    return fallback;
  }
}
