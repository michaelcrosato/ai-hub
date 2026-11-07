/** format.js — the handful of display conversions the UI needs. */

import { bytes as langBytes, date as langDate } from './lang.js';

/** 512 B, 40 kB, 1.5 MB, in the player's language. */
export const bytes = langBytes;

export function date(iso) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? langDate(ms, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
