/**
 * couch/facts.js — what the Couch says about one game, as data: the eyebrow
 * over its name, the chips under its blurb, and the facts grid on its page.
 * The hero and the page draw these; node --test reads them directly.
 */

import { playersOf, MULTI, sessionOf } from '../manifest.js';
import { t, bytes, date, ago as relative, list } from '../lang.js';
import { parseControls, keysSummary } from './howto.js';

const DAY = 24 * 60 * 60 * 1000;
const DATE = { day: 'numeric', month: 'short', year: 'numeric' };

/** A date as the hub writes it ("1 Sep 2026"); nothing for an address that is no date. */
export const dateText = (iso) => (Number.isFinite(Date.parse(iso)) ? date(iso, DATE) : '');

/** Midnight of the local day `ms` falls on, so "yesterday" means the calendar day. */
const startOfDay = (ms) => {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

/** "today", "yesterday", "3 days ago", "last week", "2 months ago"… */
export function ago(ms, now = Date.now()) {
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / DAY);
  if (days <= 0) return relative(0, 'day');
  if (days < 7) return relative(-days, 'day');
  if (days < 30) return relative(-Math.floor(days / 7), 'week');
  if (days < 365) return relative(-Math.floor(days / 30), 'month');
  return relative(-Math.floor(days / 365), 'year');
}

/** Every model credited, as one line: "GPT-6 & Claude Opus 5.5". */
const modelsOf = (game) => (game.rails?.model || []).join(' & ');

/** "Original", or "Inspired by Dragon Quest IX". */
export const originOf = (game) => (game.lineage.original ? t('couch.facts.original') : t('couch.facts.inspired', { title: game.lineage.title }));

/** "Single player", "1–4 players"; nothing for a tool, which is not played. */
export function playersText(game) {
  const seats = playersOf(game);
  if (!seats.length) return '';
  return seats.includes(MULTI) ? t('couch.facts.players', { players: String(game.players) }) : t('couch.facts.single');
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
    game.builds.length > 1 && { text: t('couch.facts.builds_chip', { count: game.builds.length }) },
    game.addedAt > 0 && { text: t('couch.facts.added_chip', { when: ago(game.addedAt, now) }) },
    keys.length > 0 && { keys, label: t('couch.facts.controls', { keys: list(keys.map((part) => part.key)) }) },
  ].filter(Boolean);
}

/**
 * The page's facts grid, in a fixed order, leaving out what the game does not
 * say: a row is { label, value } with an optional `note` under the value.
 */
export function pageFacts(game, now = Date.now()) {
  const { lineage } = game;
  const series = !lineage.original && lineage.series !== lineage.title ? t('couch.facts.series', { series: lineage.series }) : '';
  const updated = game.updatedAt && dateText(game.updated) !== dateText(game.added);
  return [
    game.genre && { label: t('couch.facts.label_genre'), value: game.genre },
    { label: t('couch.facts.label_origin'), value: originOf(game), note: series },
    modelsOf(game) && { label: t('couch.facts.label_model'), value: modelsOf(game) },
    playersText(game) && { label: t('couch.facts.label_players'), value: playersText(game) },
    sessionOf(game) && { label: t('couch.facts.label_session'), value: sessionOf(game).label },
    game.bytes > 0 && { label: t('couch.facts.label_size'), value: bytes(game.bytes) },
    game.addedAt > 0 && { label: t('couch.facts.label_added'), value: dateText(game.added), note: ago(game.addedAt, now) },
    updated && { label: t('couch.facts.label_updated'), value: dateText(game.updated), note: ago(game.updatedAt, now) },
    game.builds.length > 1 && { label: t('couch.facts.label_builds'), value: String(game.builds.length) },
    { label: t('couch.facts.label_type'), value: game.type || t('couch.facts.type_game') },
  ].filter(Boolean);
}
