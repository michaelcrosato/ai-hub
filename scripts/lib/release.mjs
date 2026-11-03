/**
 * release.mjs — what `pnpm release` puts on Cloudflare, and nothing else.
 *
 * The library shelf (lib/vendor/) keeps every Three.js and Rapier release in
 * full so the importer can map any game to its version, but games load a small
 * slice of it. Publishing the whole shelf would be ~20,000 files nobody asks
 * for, and Cloudflare counts files. So the shelf is published as the files
 * games actually reach: their imports resolved through their import maps,
 * the literal shelf paths they mention, and everything those files import in
 * turn.
 *
 * Cloudflare also refuses any single file over 25 MiB; those are published as
 * numbered parts that cloudflare/worker.js streams back as one file.
 */

import path from 'node:path';

export const VENDOR = 'lib/vendor/';
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const PART_BYTES = 20 * 1024 * 1024;

// Quotes may arrive escaped (\"…\") when a game packs module source into a string.
const Q = String.raw`\\?(["'\x60])`;
const STRING = String.raw`([^"'\x60\n\\]+?)\\?\1`;
const SPECIFIERS = [
  new RegExp(String.raw`\bfrom\s*${Q}${STRING}`, 'g'),
  new RegExp(String.raw`\bimport\s*${Q}${STRING}`, 'g'),
  new RegExp(String.raw`\bimport\s*\(\s*${Q}${STRING}\s*\)`, 'g'),
  new RegExp(String.raw`\bnew\s+URL\s*\(\s*${Q}${STRING}\s*,\s*import\.meta\.url`, 'g'),
  // Package names on their own: the keys of import maps a game builds in code.
  new RegExp(String.raw`${Q}((?:three|@dimforge\/[\w-]+)(?:\/[\w.\/-]*)?)\\?\1`, 'g'),
];
// "key": "…/lib/vendor/…", in an import map or an object a game turns into one.
const MAPPING = new RegExp(
  String.raw`${Q}([^"'\x60\n\\]+)\\?\1\s*:\s*(?:new\s+URL\s*\(\s*)?\\?(["'\x60])([^"'\x60\n\\]*lib\/vendor\/[^"'\x60\n\\]*)\\?\3`,
  'g',
);
// A shelf path, possibly with one ${…} in it: /lib/vendor/three/${version}/build/three.module.js
const SHELF_PATH = /lib\/vendor\/[\w.@+\/-]*(?:\$\{[^}\n]{0,80}\}[\w.@+\/-]*)?/g;

export function moduleSpecifiers(text) {
  const found = new Set();
  for (const pattern of SPECIFIERS) for (const m of text.matchAll(pattern)) found.add(m[2]);
  return [...found];
}

/** Import-map entries that point into the shelf, wherever they are written. */
export function shelfMappings(text) {
  return [...text.matchAll(MAPPING)].map((m) => [m[2], m[4]]);
}

/** A specifier through import-map entries: an exact key, else the longest "prefix/" key. */
export function resolveMapped(specifier, mappings) {
  let best = null;
  for (const [key, value] of mappings) {
    if (key === specifier) return value;
    if (key.endsWith('/') && specifier.startsWith(key) && (!best || key.length > best[0].length)) best = [key, value];
  }
  return best ? best[1] + specifier.slice(best[0].length) : null;
}

/** "…/lib/vendor/x/y" in any form (absolute, relative, full URL) to "lib/vendor/x/y", else null. */
export function shelfPath(reference) {
  const at = reference.indexOf(VENDOR);
  if (at === -1) return null;
  return path.posix.normalize(reference.slice(at).split(/[?#]/)[0]).replace(/\/+$/, '');
}

/** The package a shelf path belongs to: lib/vendor/three/<v>/, rapier/<v>/<pkg>/, extras/<pkg>/<v>/. */
export function shelfPackage(file) {
  const parts = file.split('/');
  const depth = parts[2] === 'three' ? 4 : 5;
  return parts.length >= depth ? `${parts.slice(0, depth).join('/')}/` : null;
}

/** Bare imports inside a Three.js release, the way every import map the importer writes resolves them. */
export function threeBare(root, specifier) {
  const exact = { three: 'build/three.module.js', 'three/webgpu': 'build/three.webgpu.js', 'three/tsl': 'build/three.tsl.js' };
  if (exact[specifier]) return root + exact[specifier];
  for (const [prefix, dir] of [['three/addons/', 'examples/jsm/'], ['three/examples/jsm/', 'examples/jsm/'], ['three/src/', 'src/']]) {
    if (specifier.startsWith(prefix)) return root + dir + specifier.slice(prefix.length);
  }
  return null;
}

/**
 * The shelf files a set of games reaches.
 *
 * @param {Iterable<string[]>} units  one per game (a page, or a folder of
 *   them): the text of its HTML, JS, CSS and JSON files
 * @param {{ isFile: (p: string) => boolean, isDir: (p: string) => boolean,
 *           list: (dir: string, opts?: { depth: 1 }) => string[], read: (p: string) => string }} fs
 *   repo-relative lookups; list() returns the files under a folder, or with
 *   { depth: 1 } the folders directly in it, as repo-relative paths
 * @returns {{ files: Set<string>, missing: Set<string>, skipped: Set<string> }}
 *   missing: shelf files referenced but not on the shelf (broken before
 *   publishing too); skipped: whole-folder references too broad to publish
 *   that no import could be resolved against
 */
export function shelfClosure(units, fs, { maxFolderFiles = 300 } = {}) {
  const files = new Set();
  const missing = new Set();
  const skipped = new Set();
  const queue = [];
  const add = (file) => {
    if (files.has(file)) return;
    if (!fs.isFile(file)) return void missing.add(file);
    files.add(file);
    if (/\.m?js$/.test(file)) queue.push(file);
  };

  for (const texts of units) {
    const mappings = texts.flatMap(shelfMappings);
    const specifiers = new Set(texts.flatMap(moduleSpecifiers));
    const refs = new Set(mappings.map(([, value]) => shelfPath(value)));
    for (const text of texts) {
      for (const [ref] of text.matchAll(SHELF_PATH)) {
        const [head, tail] = ref.split(/\$\{[^}]*\}/);
        if (tail === undefined) refs.add(shelfPath(ref));
        // One ${…} in the path: every folder it could name.
        else if (head.endsWith('/') && fs.isDir(head)) for (const dir of fs.list(head, { depth: 1 })) refs.add(shelfPath(dir + tail));
      }
    }
    for (const specifier of specifiers) {
      const target = shelfPath(resolveMapped(specifier, mappings) || '');
      if (target && !fs.isDir(target)) add(target);
    }
    // Releases a game names by folder: its "three/…" imports may be resolved against them in code.
    const releases = new Set();
    for (const ref of refs) {
      if (!ref || ref === 'lib/vendor') continue;
      if (fs.isFile(ref)) {
        add(ref);
        continue;
      }
      if (!fs.isDir(ref)) {
        if (path.posix.extname(ref)) missing.add(ref);
        continue;
      }
      const root = shelfPackage(`${ref}/`);
      if (root?.startsWith(`${VENDOR}three/`)) releases.add(root);
      const inside = fs.list(ref);
      // A small folder named outright (a Draco or Basis decoder path, say) is loaded file by file at run time.
      if (inside.length <= maxFolderFiles) inside.forEach(add);
      else if (!root?.startsWith(`${VENDOR}three/`)) skipped.add(`${ref}/`);
    }
    for (const root of releases) {
      for (const specifier of specifiers) {
        const target = threeBare(root, specifier);
        if (target && fs.isFile(target)) add(target);
      }
    }
  }

  const packages = new Set();
  while (queue.length) {
    const file = queue.shift();
    const root = shelfPackage(file);
    if (root) packages.add(root);
    for (const specifier of moduleSpecifiers(fs.read(file))) {
      if (/^\.\.?\//.test(specifier)) add(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
      else if (specifier.startsWith('/')) {
        if (shelfPath(specifier)) add(shelfPath(specifier));
      } else if (root?.startsWith(`${VENDOR}three/`)) {
        const target = threeBare(root, specifier);
        if (target) add(target);
      }
    }
  }
  // Every release a game touches ships its builds whole (a dozen files) and every package its licence.
  for (const root of packages) {
    if (root.startsWith(`${VENDOR}three/`) && fs.isDir(`${root}build`)) fs.list(`${root}build`).forEach(add);
    if (fs.isFile(`${root}LICENSE`)) add(`${root}LICENSE`);
  }
  return { files, missing, skipped };
}

/** How a file is published: whole, or as parts each under Cloudflare's per-file limit. */
export function partSizes(bytes, { limit = MAX_ASSET_BYTES, part = PART_BYTES } = {}) {
  if (bytes <= limit) return null;
  const sizes = [];
  for (let left = bytes; left > 0; left -= part) sizes.push(Math.min(part, left));
  return sizes;
}

/** Cache rules for Cloudflare's _headers file, the same ones vercel.json gave Vercel. */
export const HEADERS = `/data/games.json
  Cache-Control: public, max-age=0, must-revalidate
/assets/*
  Cache-Control: public, max-age=0, must-revalidate
/lib/kit/*
  Cache-Control: public, max-age=0, must-revalidate
/lib/hub/*
  Cache-Control: public, max-age=0, must-revalidate
/lib/three/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=604800
/lib/rapier/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=604800
/lib/vendor/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
/games/*
  Cache-Control: public, max-age=600, stale-while-revalidate=604800
/covers/*
  Cache-Control: public, max-age=600, stale-while-revalidate=604800
`;
