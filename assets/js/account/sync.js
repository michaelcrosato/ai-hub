/**
 * account/sync.js — a signed-in player's history from every device, merged
 * into this page's store, so "played", "Jump back in" and "Unplayed only" see
 * games played elsewhere.
 */

import { store } from '../store.js';
import { hasSession, attempt } from './cloud.js';
import { currentUser, onUser } from './auth.js';

async function pull() {
  const user = await currentUser();
  if (!user || user.guest) return store.setCloudPlays({});
  const rows = await attempt((sb) => sb.rpc('my_play_totals'), null);
  if (!rows) return;
  const totals = {};
  for (const r of rows) totals[r.slug] = { plays: Number(r.plays), seconds: Number(r.seconds), lastPlayed: Date.parse(r.last_played) || 0 };
  store.setCloudPlays(totals);
}

let started = false;
export function syncPlays() {
  if (started) return;
  started = true;
  if (hasSession()) pull();
  onUser(() => pull());
}
