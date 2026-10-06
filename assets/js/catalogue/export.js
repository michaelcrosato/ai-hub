/**
 * catalogue/export.js — the selection as a spreadsheet, or as a table to
 * paste into a message. Pure: records in, text out; the page only saves it.
 *
 * The CSV carries the table's columns plus the slug and path, with the
 * lineage split into its parts so a spreadsheet can sort them. Size is raw
 * bytes and dates are ISO days, because a spreadsheet does arithmetic.
 */

import { buildsOf, dayText, dayToken, sizeText, valuesOf } from './query.js';

const lineageText = (g) => {
  if (g.lineage.original) return 'Original';
  const series = g.lineage.series && g.lineage.series !== g.lineage.title ? ` (${g.lineage.series})` : '';
  return `after ${g.lineage.title}${series}`;
};

/** Several values in one cell, the way the spec sheet lists them. */
const listed = (value) => valuesOf(value).join(', ');

const CSV_COLUMNS = [
  ['Name', (g) => g.name],
  ['Tagline', (g) => g.tagline],
  ['Genre', (g) => listed(g.genre)],
  ['Origin', (g) => (g.lineage.original ? 'Original' : 'Inspired')],
  ['Source', (g) => g.source],
  ['Series', (g) => (g.lineage.original ? '' : g.lineage.series)],
  ['Model', (g) => listed(g.model)],
  ['Players', (g) => g.players],
  ['Size (bytes)', (g) => g.bytes],
  ['Added', (g) => (g.addedAt ? dayToken(g.addedAt) : '')],
  ['Builds', (g) => buildsOf(g)],
  ['Favourite', (g, ctx) => (ctx.isFave(g.slug) ? 'yes' : '')],
  ['Slug', (g) => g.slug],
  ['Path', (g) => g.path],
];

/**
 * One CSV cell. Quoted when it holds a comma, quote or line break; and text
 * that a spreadsheet would run as a formula (=, +, - or @ first) is defused
 * with a leading apostrophe, the usual guard.
 */
export function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(?:\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCSV(games, { isFave = () => false } = {}) {
  const ctx = { isFave };
  const lines = [CSV_COLUMNS.map(([label]) => csvCell(label)).join(',')];
  for (const game of games) lines.push(CSV_COLUMNS.map(([, read]) => csvCell(read(game, ctx))).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** A Markdown cell: pipes escaped and lines joined, so a value can never break the table. */
export const markdownCell = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .trim();

/**
 * The selection as a Markdown table, the way it reads on screen. Given
 * `link`, each name links to its record.
 */
export function toMarkdown(games, { link } = {}) {
  const head = ['Name', 'Genre', 'Lineage', 'Model', 'Players', 'Size', 'Added'];
  const rule = ['---', '---', '---', '---', '---', '---:', '---'];
  const label = (g) => markdownCell(g.name).replace(/[[\]]/g, '\\$&');
  const rows = games.map((g) => [
    link ? `[${label(g)}](${link(g)})` : markdownCell(g.name),
    markdownCell(listed(g.genre)),
    markdownCell(lineageText(g)),
    markdownCell(listed(g.model)),
    markdownCell(g.players),
    g.bytes ? sizeText(g.bytes) : '',
    g.addedAt ? dayText(g.addedAt) : '',
  ]);
  return [head, rule, ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n') + '\n';
}
