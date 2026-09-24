/**
 * Pure decisions for `pnpm ingest`: which files in a folder or zip are worth
 * bringing in, and where a playable page lives inside a source package. No
 * I/O — callers pass a file list and a way to read a text file — so every rule
 * is covered by `scripts/intake.test.mjs`.
 */

import { INDEX_FILE } from './layout.mjs';

/**
 * Never imported: VCS and editor state, OS litter, dependency trees, and the
 * files that most often hold secrets. A packaged project can carry a `.env`
 * with a live API key, and games/ is served to the public.
 */
export const JUNK =
  /(^|\/)(__MACOSX|node_modules|bower_components|\.git|\.svn|\.hg|\.idea|\.vscode|\.cache|\.parcel-cache|\.next|\.DS_Store|Thumbs\.db|desktop\.ini|\.env(\.[^/]*)?|\.npmrc|[^/]*\.(pem|key|p12|pfx|keystore)|id_(rsa|ed25519)[^/]*)(\/|$)/i;

export const isJunk = (p) => JUNK.test(p);

/** The subset of junk that is worth a warning when it sits in a kept source
 *  package: a real .env or key, not a harmless `.env.example`. */
const SECRET =
  /(^|\/)(\.env(\.(?!example$|sample$|template$|dist$)[^/]*)?|\.npmrc|[^/]*\.(pem|key|p12|pfx|keystore)|id_(rsa|ed25519)[^/.]*)$/i;

export const isSecret = (p) => SECRET.test(p);

export const HTML = /\.html?$/i;

/** Files a browser page might load. Anything else next to a single page (a
 *  README, a zip) does not make it a multi-file project. */
const WEB_ASSET =
  /\.(m?js|css|wasm|json|png|jpe?g|gif|webp|avif|svg|ico|bmp|mp3|ogg|oga|wav|m4a|aac|flac|mp4|webm|glb|gltf|bin|obj|mtl|fbx|ttf|otf|woff2?|data|pck|atlas|fnt|xml|csv|tmx|tsx|ldtk)$/i;

/** Folders bundlers write finished output to. `public/` is deliberately not
 *  here: in Vite and Create React App it holds inputs, not a playable page. */
const BUILT_DIR = /^(dist|build|out|www|public_html)$/i;

/**
 * An index.html that is really a bundler's *input*: it points at TypeScript or
 * JSX, or at /src/main, or carries CRA's %PUBLIC_URL% placeholder, or loads
 * from node_modules, which a package never ships. Served as-is it renders a
 * blank page. (`./src/main.js` with an importmap is a finished game, and is
 * deliberately not caught here.)
 */
export function needsBuild(html) {
  const text = String(html || '');
  return (
    /<script\b[^>]*\bsrc\s*=\s*["'][^"']+\.(tsx?|jsx|mts|vue|svelte)["']/i.test(text) ||
    /<script\b[^>]*\bsrc\s*=\s*["']\/?src\/main\./i.test(text) ||
    /["'](\.{0,2}\/)*node_modules\//.test(text) ||
    /%PUBLIC_URL%/.test(text)
  );
}

/**
 * A zip that is a folder of games rather than one package: it holds other
 * zips, or it is what Google Drive hands you for "Download" on a folder
 * (`files-20260924T024324Z-1-001.zip`). Those are unpacked and walked exactly
 * like a folder.
 */
export const isContainer = (zipName, paths) =>
  /-\d{8}T\d{6}Z-\d+-\d{3}\.zip$/i.test(zipName) || paths.some((p) => /\.zip$/i.test(p));

/**
 * Local scripts a page loads that the package does not contain. A page like
 * that is waiting for a build step to write them (`./main.mjs` into dist/),
 * however plain the HTML itself looks.
 */
export function missingScripts(html, dir, present) {
  const missing = [];
  for (const m of String(html || '').matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"'?#]+)/gi)) {
    const src = m[1].trim();
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) continue; // a CDN is not the package's job
    // `/assets/x.js` in a built page means "from where this page is served",
    // which is its own folder once unpacked (ingest rewrites it to relative).
    const candidates = src.startsWith('/') ? [[dir, src.slice(1)], [src.slice(1)]] : [[dir, src]];
    const found = candidates.some((bits) => {
      const resolved = [];
      for (const part of bits.filter(Boolean).join('/').split('/')) {
        if (part === '..') resolved.pop();
        else if (part && part !== '.') resolved.push(part);
      }
      return present.has(resolved.join('/'));
    });
    if (!found) missing.push(src);
  }
  return missing;
}

const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const baseOf = (p) => p.slice(p.lastIndexOf('/') + 1);
const depth = (d) => (d ? d.split('/').length : 0);
const inside = (child, parent) => parent === '' || child === parent || child.startsWith(parent + '/');
const byDepth = (a, b) => depth(a) - depth(b) || a.localeCompare(b);

/**
 * Work out what a package holds.
 *
 * @param {string[]} files   relative posix paths, junk already removed
 * @param {(path: string) => string} readText
 * @returns {{ kind: 'projects', roots: string[] }
 *         | { kind: 'page', root: string, entry: string }
 *         | { kind: 'loose', files: string[] }
 *         | { kind: 'needs-build', root: string }
 *         | { kind: 'empty' }}
 *
 *   projects     each root holds a playable index.html; copy the whole folder
 *   page         one page plus the files it loads, no index.html; the entry
 *                is renamed to index.html so the hub treats it as a project
 *   loose        self-contained single-file games
 *   needs-build  source code with no finished build inside
 */
export function chooseWebRoot(files, readText) {
  const indexOf = new Map();
  for (const p of files) {
    if (INDEX_FILE.test(baseOf(p)) && !indexOf.has(dirOf(p))) indexOf.set(dirOf(p), p);
  }
  const indexDirs = [...indexOf.keys()];

  const present = new Set(files);
  let roots = indexDirs.filter((d) => {
    const html = readText(indexOf.get(d));
    return !needsBuild(html) && missingScripts(html, d, present).length === 0;
  });

  // When a package's own front page is waiting for a build, a page nested
  // under it (an example, a test harness) does not stand in for the game.
  // Only a finished build folder does.
  const unplayable = indexDirs.filter((d) => !roots.includes(d));
  roots = roots.filter((d) => BUILT_DIR.test(baseOf(d)) || !unplayable.some((u) => u !== d && inside(d, u)));

  // A finished build beats the source folder around it.
  const built = roots.filter((d) => BUILT_DIR.test(baseOf(d)));
  if (built.length) roots = roots.filter((d) => built.includes(d) || !built.some((b) => inside(b, d)));

  // A playable folder nested inside another playable folder is part of it.
  roots.sort(byDepth);
  const minimal = [];
  for (const d of roots) if (!minimal.some((m) => inside(d, m))) minimal.push(d);
  if (minimal.length) return { kind: 'projects', roots: minimal };

  const packages = files.filter((p) => baseOf(p) === 'package.json').map(dirOf).sort(byDepth);
  if (packages.length || indexDirs.length) {
    return { kind: 'needs-build', root: packages[0] ?? indexDirs.sort(byDepth)[0] };
  }

  const pages = files.filter((p) => HTML.test(p));
  if (!pages.length) return { kind: 'empty' };

  const hasAssets = (d) => files.some((p) => !HTML.test(p) && inside(p, d) && WEB_ASSET.test(p));
  if (pages.length === 1 && hasAssets(dirOf(pages[0]))) {
    return { kind: 'page', root: dirOf(pages[0]), entry: pages[0] };
  }
  return { kind: 'loose', files: pages };
}

/**
 * A folder name for an unpacked package. GitHub's "Download ZIP" appends the
 * branch (`orbit-main`) and people append "source"; neither belongs in a name.
 */
export function packageName(stem) {
  const cleaned = String(stem)
    .replace(/[-_ .]+(main|master|src|source|sources|code|project|web|html5?|build|dist|release)$/i, '')
    .replace(/^[._]+/, '')
    .trim();
  return cleaned || String(stem).replace(/^[._]+/, '') || 'package';
}

/**
 * Filenames that say nothing about the game: what a browser saves a page as
 * (`index.html`, `index(3).html`, `index(20260910-200340).html`) or what a
 * model calls its output. A game arriving under one of these is named after
 * its <title> instead, because the filename becomes its permanent slug — the
 * key its favourites, cover and overrides hang off.
 */
export const UNINFORMATIVE_NAME = /^(index|game|untitled|new|download|output|page)([\s_-]*(\(\s*[\d-]+\s*\)|\d+))?$/i;
