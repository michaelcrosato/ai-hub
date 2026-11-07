/**
 * The hub's languages, for scripts: the English lines (assets/lang/en.js),
 * the translations (assets/lang/<code>.json) and the lines the code uses.
 * See lib/hub/languages.md and assets/js/lang.js.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ID = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
export const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** en.js's contents. */
export async function englishLines(root) {
  return (await import(pathToFileURL(join(root, 'assets/lang/en.js')).href)).default;
}

const walk = (dir, ext) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'vendor' ? [] : walk(path, ext);
    return path.endsWith(ext) ? [path] : [];
  });

/** The hub's pages: index.html and each view's folder. */
export function hubPages(root) {
  const pages = ['index.html'];
  for (const name of readdirSync(root)) {
    if (existsSync(join(root, name, 'index.html')) && !['games', 'lib', 'node_modules', 'covers'].includes(name)) pages.push(`${name}/index.html`);
  }
  return pages.map((p) => join(root, p));
}

/**
 * The line ids the code uses: t('id'), tx('id') and has('id') in assets/js,
 * data-line="id" and data-line-<attribute>="id" in the pages. `dynamic` lists
 * calls whose id isn't written out, which a check can't follow.
 */
export function usedLines(root) {
  const used = new Map();
  const dynamic = [];
  const add = (id, where) => (used.has(id) ? used.get(id).push(where) : used.set(id, [where]));
  for (const file of walk(join(root, 'assets/js'), '.js')) {
    if (file.endsWith(join('assets', 'js', 'lang.js'))) continue;   // where t() is made, not used
    const src = readFileSync(file, 'utf8');
    const rel = relative(root, file);
    src.split('\n').forEach((text, i) => {
      for (const m of text.matchAll(/(?:(?<=\.\.\.)|(?<![.\w$]))(?:t|tx|has)\(\s*(['"`])([^'"`]*?)\1/g)) {
        if (m[1] === '`' && m[2].includes('${')) dynamic.push(`${rel}:${i + 1}`);
        else add(m[2], `${rel}:${i + 1}`);
      }
      if (/(?:(?<=\.\.\.)|(?<![.\w$]))(?:t|tx|has)\(\s*(?![\s'"`)])/.test(text)) dynamic.push(`${rel}:${i + 1}`);
    });
  }
  for (const file of hubPages(root)) {
    const rel = relative(root, file);
    readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
      for (const m of text.matchAll(/\bdata-line(?:-[a-z-]+)?="([^"]*)"/g)) add(m[1], `${rel}:${i + 1}`);
    });
  }
  return { used, dynamic };
}

/** The {tags} in a line, in order. */
export const tagsOf = (text) => String(text).match(/\{[^{}]*\}/g) || [];

/** Problems with en.js itself: ids, line shapes, notes and max for lines that exist. */
export function sourceProblems(source) {
  const problems = [];
  const lines = source.lines || {};
  for (const [id, line] of Object.entries(lines)) {
    if (!ID.test(id)) problems.push(`${id}: not a valid id`);
    if (typeof line === 'string') {
      if (!line.trim()) problems.push(`${id}: empty`);
    } else if (line && typeof line === 'object') {
      const forms = Object.keys(line);
      if (forms.some((f) => !PLURAL_FORMS.includes(f))) problems.push(`${id}: plural forms must be ${PLURAL_FORMS.join(', ')}`);
      if (!line.one || !line.other) problems.push(`${id}: English plural forms need one and other`);
      if (Object.values(line).some((s) => typeof s !== 'string')) problems.push(`${id}: a plural form isn't text`);
    } else {
      problems.push(`${id}: a line is text or plural forms`);
    }
    for (const text of typeof line === 'object' && line ? Object.values(line) : [line]) {
      const open = String(text).split('{').length - 1;
      const close = String(text).split('}').length - 1;
      if (open !== close) problems.push(`${id}: unbalanced { }`);
      if (/<[a-z/!]/i.test(String(text))) problems.push(`${id}: a line is plain text, without HTML`);
    }
  }
  for (const key of ['notes', 'max']) {
    for (const id of Object.keys(source[key] || {})) if (!(id in lines)) problems.push(`${key}.${id}: no such line`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Checking a translation (lib/hub/languages.md, "Checks"): structure, tags and
// plural forms block it; gaps, length, writing system and names are flagged.

/** The plural forms a language uses, as Intl.PluralRules names them. */
export const pluralForms = (code) => new Intl.PluralRules(code).resolvedOptions().pluralCategories;

/** Forms that only ever mean one number (English "one" is 1, Arabic "two" is 2), so they may leave out {count}. */
export function singleNumberForms(code) {
  const rules = new Intl.PluralRules(code);
  const numbers = {};
  for (let n = 0; n <= 1000; n++) (numbers[rules.select(n)] ??= new Set()).add(n);
  return new Set(Object.entries(numbers).filter(([, set]) => set.size === 1).map(([form]) => form));
}

const SCRIPTS = { Latn: 'Latin', Cyrl: 'Cyrillic', Arab: 'Arabic', Deva: 'Devanagari', Beng: 'Bengali', Hans: 'Han', Hant: 'Han', Jpan: 'Han|Hiragana|Katakana', Kore: 'Hangul', Ethi: 'Ethiopic', Grek: 'Greek', Hebr: 'Hebrew', Thai: 'Thai' };
/** A test for the letters of a language's writing system, or null when unknown. */
export function scriptTest(code) {
  let script = null;
  try { script = new Intl.Locale(code).maximize().script; } catch {}
  const names = SCRIPTS[script];
  return names ? new RegExp(names.split('|').map((n) => `\\p{Script=${n}}`).join('|'), 'u') : null;
}

/** A line's width for max: whole letters, a Chinese, Japanese or Korean character counting two; tags count nothing. */
export function width(line) {
  const text = String(line).replace(/\{[^{}]*\}/g, '');
  const letters = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  return letters.reduce((n, g) => n + (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/u.test(g) ? 2 : 1), 0);
}

const sorted = (tags) => [...tags].sort().join(' ');
const pairedInOrder = (text) => {
  const open = [];
  for (const tag of tagsOf(text)) {
    const close = tag.match(/^\{\/(\w+)\}$/);
    if (close) { if (open.pop() !== close[1]) return false; }
    else { const m = tag.match(/^\{(\w+)=/); if (m) open.push(m[1]); }
  }
  return true;
};

/**
 * One translation's lines checked against the original. `blocking` problems
 * keep a line out (the original shows instead); `flags` are worth a look.
 */
export function checkTranslation(source, code, lines) {
  const blocking = [];
  const flags = [];
  const bad = new Set();
  const block = (id, text) => { bad.add(id); blocking.push(text); };
  if (!lines || typeof lines !== 'object' || Array.isArray(lines)) return { blocking: ['lines: not an object of lines'], flags, bad };
  const forms = pluralForms(code);
  const single = singleNumberForms(code);
  const letters = scriptTest(code);
  const names = source.names || [];
  for (const [id, value] of Object.entries(lines)) {
    const original = own(source.lines, id);
    if (original === undefined || id.startsWith('dev.')) { block(id, `${id}: not a line in the original`); continue; }
    const pairs = [];   // [form, translated text, original text]
    if (typeof original === 'string') {
      if (typeof value !== 'string' || !value.trim()) { block(id, `${id}: should be text`); continue; }
      pairs.push(['', value, original]);
    } else {
      if (!value || typeof value !== 'object' || Array.isArray(value)) { block(id, `${id}: should be plural forms`); continue; }
      const need = new Set(forms);
      if (original.zero) need.add('zero');
      const missing = [...need].filter((f) => !(f in value));
      if (missing.length) block(id, `${id}: needs the forms ${missing.join(', ')}`);
      const extra = Object.keys(value).filter((f) => !need.has(f) && f !== 'zero');
      if (extra.length) flags.push(`${id}: forms ${code} doesn't use: ${extra.join(', ')}`);
      for (const [form, text] of Object.entries(value)) {
        if (typeof text !== 'string' || !text.trim()) { block(id, `${id}.${form}: empty or not text`); continue; }
        pairs.push([form, text, own(original, form) ?? original.other]);
      }
    }
    for (const [form, text, from] of pairs) {
      const where = form ? `${id}.${form}` : id;
      let want = tagsOf(from);
      if (form) {
        // {count} picks the form: a form keeps it, unless the form only ever means one number.
        const optional = form === 'zero' || single.has(form);
        want = want.filter((t) => t !== '{count}');
        if (tagsOf(original.other).includes('{count}') && (!optional || tagsOf(text).includes('{count}'))) want.push('{count}');
      }
      if (sorted(tagsOf(text)) !== sorted(want)) block(id, `${where}: tags ${tagsOf(text).join(' ') || 'none'}, should be ${want.join(' ') || 'none'}`);
      else if (!pairedInOrder(text)) block(id, `${where}: paired tags out of order`);
      const max = own(source.max || {}, id);
      if (max && width(text) > max) flags.push(`${where}: ${width(text)} wide, max ${max}`);
      const a = width(from), b = width(text);
      if (a >= 12 && (b > a * 3 || b < a / 4)) flags.push(`${where}: ${b} wide against the original's ${a}`);
      const bare = names.reduce((s, n) => s.split(n).join(' '), text.replace(/\{[^{}]*\}/g, ' '));
      if (letters && /\p{L}/u.test(bare) && !letters.test(bare)) flags.push(`${where}: no ${code} letters`);
      for (const name of names) if (from.includes(name) && !text.includes(name)) flags.push(`${where}: ${name} is not as written`);
    }
  }
  for (const id of Object.keys(source.lines)) {
    if (!id.startsWith('dev.') && !(id in lines)) flags.push(`${id}: missing (the original shows)`);
  }
  return { blocking, flags, bad };
}

function own(o, k) {
  return o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
}
