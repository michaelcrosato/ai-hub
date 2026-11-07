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
    const src = readFileSync(file, 'utf8');
    const rel = relative(root, file);
    src.split('\n').forEach((text, i) => {
      for (const m of text.matchAll(/(?<![.\w$])(?:t|tx|has)\(\s*(['"`])([^'"`]*?)\1/g)) {
        if (m[1] === '`' && m[2].includes('${')) dynamic.push(`${rel}:${i + 1}`);
        else add(m[2], `${rel}:${i + 1}`);
      }
      if (/(?<![.\w$])(?:t|tx|has)\(\s*(?![\s'"`)])/.test(text)) dynamic.push(`${rel}:${i + 1}`);
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
      if (!tagsOf(line.other).includes('{count}')) problems.push(`${id}: plural forms are picked by {count}, and "other" doesn't have it`);
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
