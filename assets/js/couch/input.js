/**
 * couch/input.js — the keyboard, read as the same actions a controller sends,
 * so the rest of the couch never asks which one you are holding.
 *
 * No DOM: an event here is anything with `key`, the modifier flags and
 * `repeat`, so node --test can drive it with plain objects.
 */

import { REPEAT } from './pad.js';

const KEYS = new Map([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['Enter', 'press'],
  [' ', 'press'],
  ['Escape', 'back'],
  ['Backspace', 'back'],
  ['Home', 'first'],
  ['End', 'last'],
  ['PageUp', 'pageUp'],
  ['PageDown', 'pageDown'],
  ['/', 'search'],
  ['i', 'info'],
  ['f', 'fave'],
  ['s', 'search'],
  ['r', 'surprise'],
]);

/**
 * The action a key asks for, or null. Anything held with Ctrl, Cmd or Alt
 * belongs to the browser: Cmd+R still reloads and Ctrl+F still finds.
 */
export function keyAction(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key?.length === 1 ? event.key.toLowerCase() : event.key;
  return KEYS.get(key) ?? null;
}

/** Actions that move focus, and so may repeat while a key is held. */
export const MOVES = new Set(['up', 'down', 'left', 'right', 'pageUp', 'pageDown']);

/**
 * A held key repeats at whatever rate the system sets, often thirty a second,
 * which would race through a rail faster than anyone can read it. The gate
 * lets a held move through once per `interval`, the controller's own repeat
 * rate. A fresh press always goes through.
 */
export function createRepeatGate(interval = REPEAT.interval) {
  let last = -Infinity;
  return (event, now) => {
    if (event.repeat && now - last < interval) return false;
    last = now;
    return true;
  };
}

/** A key that types into a search: one printable character, no modifiers. */
export const typed = (event) =>
  !event.ctrlKey && !event.metaKey && !event.altKey && typeof event.key === 'string' && event.key.length === 1;
