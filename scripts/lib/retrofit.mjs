/**
 * retrofit.mjs — the part of a side-by-side retrofit that needs no model.
 *
 * It puts the session client and the side-by-side metas into an existing game
 * page, before any of the game's own scripts, and leaves everything else
 * byte for byte as it was. A model then wires the game to them (README,
 * "Side by side"); checkRetrofit() says what is still missing.
 */

import { findClients } from './hub-client.mjs';

export const SIDE_BY_SIDE = Object.freeze({ mode: 'parallel', players: '1-4', minutes: 4 });

const SCRIPT = /<script\b/i;
const CHARSET = /<meta\b[^>]*\bcharset\b[^>]*>/i;
const HEAD = /<head\b[^>]*>/i;
const HTML = /<html\b[^>]*>/i;
const DOCTYPE = /<!doctype[^>]*>/i;

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Where the block goes: after <meta charset> when no script comes before it, else just before the first script. */
function insertionPoint(html) {
  const script = html.search(SCRIPT);
  const charset = html.match(CHARSET);
  if (charset && (script === -1 || charset.index < script)) return charset.index + charset[0].length;
  if (script !== -1) return script;
  for (const tag of [HEAD, HTML, DOCTYPE]) {
    const m = html.match(tag);
    if (m) return m.index + m[0].length;
  }
  return 0;
}

/** The metas and the client, as they go into the page. */
export function sessionBlock({ client, minutes = SIDE_BY_SIDE.minutes, goal = '', howto = '', eol = '\n' }) {
  const metas = [
    ['hub:session', '1'],
    ['hub:session-players', SIDE_BY_SIDE.players],
    ['hub:session-mode', SIDE_BY_SIDE.mode],
    ['hub:session-minutes', String(minutes)],
    ['hub:session-goal', goal],
    ['hub:session-howto', howto],
  ].map(([name, content]) => `<meta name="${name}" content="${escapeAttr(content)}">`);
  return [...metas, '<script>', client.trimEnd().replace(/\r?\n/g, eol), '</script>'].join(eol);
}

/**
 * Add the session client and the side-by-side metas to a game page. Returns
 * the new text, or the reason it was left alone.
 */
export function prepareSideBySide(html, { client, minutes } = {}) {
  if (/<meta\b[^>]*name\s*=\s*["']?hub:session["'\s>]/i.test(html)) return { skipped: 'it already declares hub:session' };
  if (findClients(html).length) return { skipped: 'it already carries a session client' };
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const at = insertionPoint(html);
  const block = sessionBlock({ client, minutes, eol });
  return { text: `${html.slice(0, at)}${eol}${block}${eol}${html.slice(at)}`, at };
}

/** What a retrofitted page still lacks, read from its text alone. Empty when the static part is done. */
export function checkRetrofit(html) {
  const problems = [];
  const meta = (name) => {
    const m = html.match(new RegExp(`<meta\\b[^>]*name\\s*=\\s*["']${name}["'][^>]*>`, 'i'));
    return m ? (m[0].match(/content\s*=\s*"([^"]*)"/i)?.[1] ?? m[0].match(/content\s*=\s*'([^']*)'/i)?.[1] ?? null) : null;
  };
  if (meta('hub:session') !== '1') problems.push('hub:session is not 1');
  if (meta('hub:session-mode') !== SIDE_BY_SIDE.mode) problems.push(`hub:session-mode is not ${SIDE_BY_SIDE.mode}`);
  const goal = (meta('hub:session-goal') ?? '').trim();
  const howto = (meta('hub:session-howto') ?? '').trim();
  if (!goal) problems.push('hub:session-goal is empty');
  else if (goal.length > 60) problems.push(`hub:session-goal is ${goal.length} characters (at most 60)`);
  if (!howto) problems.push('hub:session-howto is empty');
  else if (howto.length > 80) problems.push(`hub:session-howto is ${howto.length} characters (at most 80)`);
  const clients = findClients(html);
  if (clients.length !== 1) problems.push(`${clients.length} session clients (one, please)`);
  else {
    if (!clients[0].pristine) problems.push('the session client was edited');
    const first = html.search(SCRIPT);
    const own = html.lastIndexOf('<script', clients[0].start);
    if (first !== -1 && own !== first) problems.push('a script runs before the session client');
  }
  for (const call of ['AIHub.connect', 'AIHub.ready', 'AIHub.result']) if (!html.includes(call)) problems.push(`no call to ${call}`);
  return problems;
}

/**
 * How many lines a try changed: lines added or removed, counted as a multiset
 * so moved lines don't count twice; a changed line counts once. Line endings
 * aside.
 */
export function changedLines(before, after) {
  const counts = new Map();
  for (const line of before.split(/\r?\n/)) counts.set(line, (counts.get(line) || 0) + 1);
  let added = 0;
  for (const line of after.split(/\r?\n/)) {
    const n = counts.get(line) || 0;
    if (n) counts.set(line, n - 1);
    else added++;
  }
  let removed = 0;
  for (const n of counts.values()) removed += n;
  return Math.max(added, removed);
}
