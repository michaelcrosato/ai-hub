/**
 * couch/facts.js — what the Couch says about one game, as data: the eyebrow
 * over its name, the chips under its blurb, and the facts grid on its page.
 * The hero and the page draw these; node --test reads them directly.
 */

import { playersOf, MULTI } from '../manifest.js';
import { bytes, date, plural } from '../format.js';
import { parseControls, keysSummary } from './howto.js';

const DAY = 24 * 60 * 60 * 1000;
const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Midnight of the local day `ms` falls on, so "yesterday" means the calendar day. */
const startOfDay = (ms) => {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

/** "today", "yesterday", "3 days ago", "last week", "2 months ago"… */
export function ago(ms, now = Date.now()) {
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / DAY);
  if (days <= 0) return RELATIVE.format(0, 'day');
  if (days < 7) return RELATIVE.format(-days, 'day');
  if (days < 30) return RELATIVE.format(-Math.floor(days / 7), 'week');
  if (days < 365) return RELATIVE.format(-Math.floor(days / 30), 'month');
  return RELATIVE.format(-Math.floor(days / 365), 'year');
}

/** Every model credited, as one line: "GPT-6 & Claude Opus 5.5". */
const modelsOf = (game) => (game.rails?.model || []).join(' & ');

/** "Original", or "Inspired by Dragon Quest IX". */
export const originOf = (game) => (game.lineage.original ? 'Original' : `Inspired by ${game.lineage.title}`);

/** "Single player", "1–4 players"; nothing for a tool, which is not played. */
export function playersText(game) {
  const seats = playersOf(game);
  if (!seats.length) return '';
  return seats.includes(MULTI) ? `${game.players} players` : 'Single player';
}

/** The line over the name: genre · origin · model, each when known. */
export const eyebrow = (game) => [game.genre, originOf(game), modelsOf(game)].filter(Boolean);

/**
 * The chips under the hero's blurb: who it is for, its size, its builds when
 * there are several, when it arrived, and the keys it is played with. A chip
 * is { text } or { keys } (keycap parts, see howto.js).
 */
export function heroChips(game, now = Date.now()) {
  const keys = keysSummary(parseControls(game.controls));
  return [
    playersText(game) && { text: playersText(game) },
    game.bytes > 0 && { text: bytes(game.bytes) },
    game.builds.length > 1 && { text: plural(game.builds.length, 'build') },
    game.addedAt > 0 && { text: `Added ${ago(game.addedAt, now)}` },
    keys.length > 0 && { keys, label: `Controls: ${keys.map((part) => part.key).join(', ')}` },
  ].filter(Boolean);
}

/**
 * The page's facts grid, in a fixed order, leaving out what the game does not
 * say: a row is { label, value } with an optional `note` under the value.
 */
export function pageFacts(game, now = Date.now()) {
  const { lineage } = game;
  const series = !lineage.original && lineage.series !== lineage.title ? `${lineage.series} series` : '';
  const updated = game.updatedAt && date(game.updated) !== date(game.added);
  return [
    game.genre && { label: 'Genre', value: game.genre },
    { label: 'Origin', value: originOf(game), note: series },
    modelsOf(game) && { label: 'Model', value: modelsOf(game) },
    playersText(game) && { label: 'Players', value: playersText(game) },
    game.bytes > 0 && { label: 'Size', value: bytes(game.bytes) },
    game.addedAt > 0 && { label: 'Added', value: date(game.added), note: ago(game.addedAt, now) },
    updated && { label: 'Updated', value: date(game.updated), note: ago(game.updatedAt, now) },
    game.builds.length > 1 && { label: 'Builds', value: String(game.builds.length) },
    { label: 'Type', value: game.type || 'Game' },
  ].filter(Boolean);
}
