/**
 * couch/howto.js — a game's one-line `controls` as rows of keycaps.
 *
 *   "WASD or arrows to move, hold J or Space to charge, Q/R to switch swords"
 *
 *   [WASD] or [←↑↓→]      Move
 *   hold [J] or [Space]   Charge
 *   [Q] / [R]             Switch swords
 *
 * The catalogue writes controls by hand, two ways ("WASD to move, E to talk"
 * and "WASD move; E talk"), with lists inside lists ("A, S, D, F to kick,
 * chop, turn and pose"). Each clause is read from the front: the keys it
 * opens with, then what they do. Anything not recognised as a key is left as
 * plain words, so a sentence the reader cannot parse still reads as written.
 * No DOM: node --test drives it with the catalogue's own strings.
 *
 * A row is { keys, action }. `keys` is a list of parts: { key } for a key to
 * draw as a keycap, { key, pointer: true } for a mouse, touch or pad input,
 * and { text } for the words between them ("or", "/", "hold").
 */

const ARROWS = '←↑↓→';
const DIRECTIONS = { up: '↑', down: '↓', left: '←', right: '→' };

/** Keys named by a word, matched without regard to case. */
const NAMED = new Map(
  Object.entries({
    wasd: 'WASD',
    arrows: ARROWS,
    space: 'Space',
    spacebar: 'Space',
    shift: 'Shift',
    enter: 'Enter',
    return: 'Enter',
    esc: 'Esc',
    escape: 'Esc',
    tab: 'Tab',
    ctrl: 'Ctrl',
    alt: 'Alt',
    backspace: 'Backspace',
  })
);

/** Inputs that are not keys: drawn as rounder chips. */
const POINTER = new Map(
  Object.entries({
    mouse: 'Mouse',
    click: 'Click',
    drag: 'Drag',
    scroll: 'Scroll',
    wheel: 'Wheel',
    pointer: 'Pointer',
    tap: 'Tap',
    swipe: 'Swipe',
    touch: 'Touch',
    joystick: 'Joystick',
    gamepad: 'Gamepad',
    gamepads: 'Gamepad',
  })
);

/** Two- and three-word inputs, tried before single words. */
const PHRASES = [
  [/^(left|right) shift$/i, (m) => ({ key: `${cap(m[1])} Shift` })],
  [/^right mouse$/i, () => ({ key: 'Right mouse', pointer: true })],
  [/^mouse wheel$/i, () => ({ key: 'Wheel', pointer: true })],
  [/^right click$/i, () => ({ key: 'Right-click', pointer: true })],
  [/^left click$/i, () => ({ key: 'Click', pointer: true })],
  [/^arrow keys$/i, () => ({ key: ARROWS })],
  [/^number keys$/i, () => ({ key: '1–9' })],
  [/^movement pad$/i, () => ({ key: 'Movement pad', pointer: true })],
  [/^point and click$/i, () => ({ key: 'Point and click', pointer: true })],
];

/** Words that join keys, kept as written between them. */
const JOINS = new Set(['or', 'and', '/', '+', ',']);
/** Words that may sit in front of a key and add nothing ("the arrows", "keys 1–3"). */
const FILLER = new Set(['the', 'keys']);

const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** Words, numbers (with an en dash range) and the symbols that can be keys or joins. */
const TOKEN = /[A-Za-z0-9–'!.-]+|[/+−,]/g;

/** One input at `tokens[i]`, as parts and how many tokens it used, or null. */
function readKey(tokens, i, first) {
  const word = tokens[i]?.text;
  if (!word) return null;

  for (const length of [3, 2]) {
    const words = tokens.slice(i, i + length);
    if (words.length < length) continue;
    const text = words.map((t) => t.text).join(' ');
    for (const [pattern, make] of PHRASES) {
      const m = pattern.exec(text);
      if (m) return { parts: [make(m)], used: length };
    }
  }

  const lower = word.toLowerCase();
  if (lower in DIRECTIONS) {
    // "up/down arrows", "Right arrow": the arrow word only says which keys these are.
    const tail = tokens[i + 1]?.text.toLowerCase();
    return { parts: [{ key: DIRECTIONS[lower] }], used: tail === 'arrow' || tail === 'arrows' ? 2 : 1 };
  }
  if (NAMED.has(lower)) return { parts: [{ key: NAMED.get(lower) }], used: 1 };
  if (POINTER.has(lower)) return { parts: [{ key: POINTER.get(lower), pointer: true }], used: 1 };

  // Shift-click, Ctrl-drag, right-click, right-drag.
  const held = /^(shift|ctrl|alt|right)-(click|drag)$/i.exec(word);
  if (held) {
    if (held[1].toLowerCase() === 'right') return { parts: [{ key: `Right-${held[2].toLowerCase()}`, pointer: true }], used: 1 };
    return { parts: [{ key: NAMED.get(held[1].toLowerCase()) }, { text: '+' }, { key: cap(held[2]), pointer: true }], used: 1 };
  }

  if (/^[A-Z]$/.test(word) || /^F\d{1,2}$/.test(word)) return { parts: [{ key: word }], used: 1 };
  if (/^\d+(?:[–-]\d+)?$/.test(word)) return { parts: [{ key: word.replace('-', '–') }], used: 1 };
  // Where a key is expected, + and − are keys ("scroll or +/− to zoom"). A
  // slash is only a key when it opens a clause ("/ search"); anywhere else it
  // joins two keys.
  if (word === '+' || word === '−' || (first && word === '/')) return { parts: [{ key: word }], used: 1 };
  return null;
}

/** The input a clause opens with, and where the words after it begin. */
function leadingKeys(fragment) {
  const tokens = [...fragment.matchAll(TOKEN)].map((m) => ({ text: m[0], at: m.index }));
  const parts = [];
  let i = 0;
  let wanted = true;

  while (i < tokens.length) {
    const word = tokens[i].text;
    const lower = word.toLowerCase();
    if (wanted) {
      if ((lower === 'hold' || FILLER.has(lower)) && readKey(tokens, i + 1, false)) {
        if (lower === 'hold') parts.push({ text: 'hold' });
        i += 1;
        continue;
      }
      const found = readKey(tokens, i, parts.length === 0);
      if (!found) break;
      parts.push(...found.parts);
      i += found.used;
      wanted = false;
      continue;
    }
    // A join counts only when a key follows it ("E or Space"), not a verb ("Click and type").
    let next = i + 1;
    while (tokens[next] && (tokens[next].text.toLowerCase() === 'hold' || FILLER.has(tokens[next].text.toLowerCase()))) next += 1;
    if (!JOINS.has(lower) || !readKey(tokens, next, false)) break;
    parts.push({ text: word });
    i += 1;
    wanted = true;
  }

  if (!parts.length || wanted) return { keys: [], rest: fragment.trim() };
  return { keys: parts, rest: i < tokens.length ? fragment.slice(tokens[i].at).trim() : '' };
}

/** Split on any of `marks`, but never inside brackets: "(slide, fire, jets)" stays whole. */
function splitOutside(text, marks) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (!depth && marks.includes(c)) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((part) => part.trim()).filter(Boolean);
}

/** "to move" reads "Move"; "for the map" reads "The map"; a tail starting "and …" stays as it is. */
function tidy(action) {
  if (/^controls$/i.test(action)) return 'Also supported';
  const text = action.replace(/^(?:to|for)\s+/i, '');
  if (/^(?:and|or|then)\b/i.test(text)) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Words with no key of their own continue the row before them when they are
 * a short list item ("1–4 for move, attack, skills and items"), a linked step
 * ("…, then stop on the white line"), or start with a symbol rather than a
 * word (the comma key, in "arrows with , . /").
 */
const continues = (fragment) =>
  /^(?:and|or|then)\b/i.test(fragment) || /^[^\p{L}\p{N}(]/u.test(fragment) || fragment.split(/\s+/).length <= 3;

/** A game's `controls` (a string, or a list of them) as rows of keys and what they do. */
export function parseControls(controls) {
  const text = (Array.isArray(controls) ? controls.join('; ') : String(controls ?? '')).trim();
  const rows = [];
  for (const clause of splitOutside(text, ';')) {
    // Bare keys waiting for the words that say what they do.
    let carried = [];
    let last = null;
    for (const fragment of splitOutside(clause, ',')) {
      const { keys, rest } = leadingKeys(fragment.replace(/^or\s+/i, ''));
      if (keys.length && !rest) {
        // "A, S, D, F to kick": a bare key joins the keys of what follows.
        carried = carried.length ? [...carried, { text: ',' }, ...keys] : keys;
        continue;
      }
      if (!keys.length && !carried.length && last && continues(fragment)) {
        last.action = `${last.action}, ${fragment}`;
        continue;
      }
      const all = carried.length && keys.length ? [...carried, { text: ',' }, ...keys] : carried.length ? carried : keys;
      last = { keys: all, action: tidy(keys.length ? rest : fragment) };
      rows.push(last);
      carried = [];
    }
    if (carried.length) rows.push({ keys: carried, action: '' });
  }
  return rows;
}

/**
 * The few keys that say the most about a game, for a chip: [WASD] [Space].
 * Each is the first input of a row, with the keys it pairs with ("W/S",
 * "Ctrl+Z") but not its alternatives ("or arrows").
 */
export function keysSummary(rows, most = 3) {
  const single = (part) => [...part.key].length === 1;
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const start = row.keys.findIndex((part) => part.key);
    if (start === -1) continue;
    const first = row.keys[start];
    let label = first.key;
    for (let i = start + 1; i + 1 < row.keys.length; i += 2) {
      const join = row.keys[i].text;
      const [before, next] = [row.keys[i - 1], row.keys[i + 1]];
      if (!next.key || Boolean(next.pointer) !== Boolean(first.pointer)) break;
      // W/S and Ctrl+Z pair up; "WASD/arrows" are two ways of doing one thing.
      if (join !== '+' && !(join === '/' && single(before) && single(next))) break;
      label += join + next.key;
    }
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(first.pointer ? { key: label, pointer: true } : { key: label });
    if (out.length === most) break;
  }
  return out;
}

/** Keys named inside a sentence ("Click the sidewalk or WASD to move"), split out to draw as keycaps. */
export function proseParts(text) {
  const parts = [];
  const pattern = /\b(WASD|Space|Shift|Enter|Esc|Tab|Ctrl)\b|\b(arrow keys|arrows)\b/g;
  let at = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ key: m[1] ? NAMED.get(m[1].toLowerCase()) : ARROWS });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
