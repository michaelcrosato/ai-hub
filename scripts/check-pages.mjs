#!/usr/bin/env node
/**
 * check-pages.mjs — does every game page's own JavaScript parse?
 *
 * A page whose inline script cannot parse never starts, and nothing else
 * notices: the scan reads heads, and a browser shows a blank screen. Most
 * such pages break in how they were assembled, not in their game code: a
 * library pasted inline whose comments show "</script>" (which ends the
 * script there), an apostrophe inside single-quoted text, a missing brace.
 * This takes every inline JavaScript block of a page the way a browser does
 * and parses it without running it: the whole wall in under a minute.
 *
 *   node scripts/check-pages.mjs                  every game on the wall
 *   node scripts/check-pages.mjs games/Foo.html   just these pages
 *
 * Exit code 1 when any script cannot parse. Run it before publishing an
 * import; the browser checks (README, *Checks*) cover what parsing cannot.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS_TYPES = /^(|module|text\/javascript|application\/javascript|text\/ecmascript|application\/ecmascript)$/i;
// An HTML tokenizer ends a script at the first "</script" followed by whitespace, "/" or ">".
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script[\s/>]/gi;

/**
 * The inline JavaScript of a page, as a browser splits it.
 * @returns {{ n: number, module: boolean, code: string, line: number }[]}
 *   n: the script's place among all <script> elements; line: where it starts
 */
export function inlineScripts(html) {
  const out = [];
  let n = 0;
  for (const m of String(html).matchAll(SCRIPT)) {
    n++;
    const [, attrs, code] = m;
    if (/\bsrc\s*=/i.test(attrs) || !code.trim()) continue;
    const type = (/\btype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1] ?? '').trim();
    if (!JS_TYPES.test(type)) continue;
    out.push({ n, module: /^module$/i.test(type), code, line: html.slice(0, m.index).split('\n').length });
  }
  return out;
}

/** Null when the code parses, else the parser's message. Modules need --experimental-vm-modules. */
export function parseError({ code, module }) {
  try {
    if (module) new vm.SourceTextModule(code);
    else new vm.Script(code);
    return null;
  } catch (error) {
    if (error instanceof SyntaxError) return error.message;
    throw error;
  }
}

/** Where node --check places the error: line in the script, and that line. */
function locate({ code, module }) {
  const dir = path.join(ROOT, '.cache/check-pages');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, module ? 'script.mjs' : 'script.cjs');
  writeFileSync(file, code);
  const { stderr } = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  const lines = stderr.split('\n');
  const at = Number(/:(\d+)$/.exec(lines[0])?.[1]);
  return at ? { at, text: lines[1].trim().slice(0, 160) } : null;
}

function pagesOnTheWall() {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'data/games.json'), 'utf8'));
  return manifest.games.flatMap((game) => game.builds.map((build) => `games/${build.file}`));
}

function main(args) {
  const pages = args.length ? args : pagesOnTheWall();
  let scripts = 0;
  let broken = 0;
  for (const page of pages) {
    const html = readFileSync(path.resolve(ROOT, page), 'utf8');
    for (const script of inlineScripts(html)) {
      scripts++;
      const message = parseError(script);
      if (!message) continue;
      broken++;
      const where = locate(script);
      console.log(`${page}  script ${script.n} (${script.module ? 'module' : 'classic'}, from line ${script.line}): ${message}`);
      if (where) console.log(`    line ${where.at} of the script: ${where.text}`);
    }
  }
  console.log(`\n  ${pages.length} page${pages.length === 1 ? '' : 's'}, ${scripts} inline scripts, ${broken ? `${broken} that cannot parse` : 'all parse'}\n`);
  return broken ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!vm.SourceTextModule) {
    // Parsing a module needs node's flag; run again with it.
    const again = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit' });
    process.exit(again.status ?? 1);
  }
  process.exit(main(process.argv.slice(2)));
}
