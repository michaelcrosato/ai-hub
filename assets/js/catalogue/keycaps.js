/**
 * catalogue/keycaps.js — a game's controls line with its keys picked out, so
 * the spec sheet can set them as keycaps: "WASD or arrows to move, Space to
 * jump" becomes [WASD] or [arrows] to move, [Space] to jump.
 *
 * Careful rather than clever: only what is plainly a key becomes one. The
 * catalogue's controls are prose, so "shift gears", "enter vehicles", "empty
 * space" and "end turn" are verbs and nouns, never keys; a key name has to be
 * capitalised to count. "arrows" is the one exception, because the catalogue
 * never uses it any other way. Directions only count capitalised or paired
 * ("up/down"), and the E in "E-Tank" is part of a word.
 */

const NAMED = new Set([
  'Space', 'Spacebar', 'Shift', 'Enter', 'Return', 'Esc', 'Escape', 'Tab', 'Ctrl', 'Control', 'Alt',
  'Option', 'Cmd', 'Backspace', 'Delete', 'Del', 'Home', 'End', 'PageUp', 'PageDown', 'Insert',
  'Arrows', 'arrows',
]);
const DIRECTION = /^(?:up|down|left|right)$/i;
const CLUSTERS = new Set(['WASD', 'IJKL', 'ESDF', 'ZQSD', 'HJKL']);

/** A word, a single digit or a lone + or −, not glued to a neighbouring word. */
const PART = /(?<![\p{L}\p{N}'’-])([A-Za-z0-9]+|[+−])(?![\p{L}\p{N}'’-])/gu;

function isKey(part, paired) {
  return (
    /^[A-Z0-9+−]$/.test(part) ||
    /^F(?:[1-9]|1[0-2])$/.test(part) ||
    CLUSTERS.has(part) ||
    NAMED.has(part) ||
    (DIRECTION.test(part) && (/^[A-Z]/.test(part) || paired))
  );
}

/**
 * The controls as runs of plain text and keys, in order, losing nothing:
 * joining every run's text gives the original line back.
 */
export function keycaps(controls) {
  const text = Array.isArray(controls) ? controls.join('; ') : String(controls ?? '');
  const runs = [];
  let last = 0;
  for (const match of text.matchAll(PART)) {
    const part = match[1];
    const at = match.index;
    const [before, after] = [text[at - 1], text[at + part.length]];
    const paired = before === '/' || after === '/' || before === '+' || after === '+';
    if (!isKey(part, paired)) continue;
    if (at > last) runs.push({ text: text.slice(last, at) });
    runs.push({ key: part });
    last = at + part.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}
