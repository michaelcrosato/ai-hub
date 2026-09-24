#!/usr/bin/env node
/**
 * ingest.mjs — bring a pile of games into games/ in one go.
 *
 * Dropping files into games/ by hand still works; this is for the day you have
 * four hundred of them in assorted folders and zips. It
 *
 *   - copies single-file games, keeping each file's own modified date as the
 *     date it joined the wall (so "Newest" means something on day one)
 *   - skips byte-identical copies of a game already on the wall
 *   - unpacks zips: a finished build (dist/, build/, or a plain index.html) is
 *     unpacked into a folder of its own; a package that still needs building is
 *     reported rather than half-imported
 *   - rewrites `/assets/…` style references in unpacked pages to relative ones,
 *     because inside the hub they would resolve against the hub, not the game
 *   - never copies secrets or clutter: .env files, keys, .git, node_modules
 *   - keeps each zip that carried more than what was unpacked in sources/,
 *     which is committed but never deployed
 *
 * Usage:  node scripts/ingest.mjs <file|folder|zip>... [options]
 *   --into <name>     put everything in a collection folder, games/<name>/
 *   --keep-folders    mirror the source folder layout (top folder = collection)
 *   --dry-run         show what would happen, write nothing
 */

import { readdir, stat, readFile, writeFile, mkdir, mkdtemp, rm, utimes, copyFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { scan, pool, mb, ROOT, GAMES_DIR, ADDED_FILE } from './scan.mjs';
import { openZip } from './lib/zip.mjs';
import { isJunk, isSecret, isContainer, HTML, chooseWebRoot, packageName, UNINFORMATIVE_NAME } from './lib/intake.mjs';
import { INDEX_FILE } from './lib/layout.mjs';
import { parseHead, splitTitle, slugify, parseVersion, relativizeRefs } from './lib/parse.mjs';

const SOURCES_DIR = path.join(ROOT, 'sources');
const MAX_SOURCE_BYTES = 95 * 1024 * 1024;
const BUILT_DIR = /^(dist|build|out|www|public_html)$/i;

/* --- arguments ------------------------------------------------------------ */

const argv = process.argv.slice(2);
const opts = { into: '', keepFolders: false, dryRun: false };
const inputs = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--into') opts.into = argv[++i] || '';
  else if (arg === '--keep-folders') opts.keepFolders = true;
  else if (arg === '--dry-run' || arg === '-n') opts.dryRun = true;
  else if (arg === '--help' || arg === '-h') usage(0);
  else if (arg.startsWith('-')) usage(1, `Unknown option ${arg}`);
  else inputs.push(path.resolve(arg));
}
if (!inputs.length) usage(1);
opts.into = opts.into.replace(/^[._/\\]+|[/\\]+$/g, '');

function usage(code, problem) {
  if (problem) console.error(`\n  ${problem}`);
  console.log(`
  pnpm ingest <file|folder|zip>... [--into <collection>] [--keep-folders] [--dry-run]

  Brings .html games, project folders and .zip packages into games/.
  Start with --dry-run to see the plan; nothing is written until you drop it.
`);
  process.exit(code);
}

/* --- bookkeeping ---------------------------------------------------------- */

const report = {
  pages: [],
  projects: [],
  duplicates: [],
  renamed: [],
  needsBuild: [],
  failed: [],
  sources: [],
  leftovers: [],
  secrets: [],
  ignored: 0,
};
const hashes = new Map(); // sha1 of a page → where it lives in games/
// games/-relative paths already used, lowercased: two files that differ only
// in case would collide the moment the repo is checked out on Windows or macOS.
const claimed = new Set();
const addedDates = {};

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
const posix = (...parts) => parts.filter(Boolean).join('/');
const clean = (name) => String(name).replace(/^[._]+/, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'game';
const home = (abs) => abs.replace(process.env.HOME || '\0', '~');
// Paths in the report are shown from the folder each input sits in, so
// `claude/snake.html` rather than the whole road to it.
let base = process.cwd();
const shown = (abs) => {
  const rel = path.relative(base, abs).split(path.sep).join('/');
  return rel && !rel.startsWith('..') ? rel : home(abs);
};

const claim = (rel) => {
  const parts = rel.toLowerCase().split('/');
  for (let i = 1; i <= parts.length; i++) claimed.add(parts.slice(0, i).join('/'));
};

const taken = (rel) => claimed.has(rel.toLowerCase());

/** A free spot in games/: the name as given, then qualified by where it came
 *  from, then numbered. Nothing already on the wall is ever overwritten. */
function freePath(dir, name, qualifier) {
  const ext = path.extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  const tries = [name];
  const q = slugify(qualifier);
  if (q && q !== slugify(stem)) tries.push(`${stem}-${q}${ext}`);
  for (let n = 2; n < 1000; n++) tries.push(`${stem}-${n}${ext}`);
  for (const candidate of tries) {
    const rel = posix(dir, candidate);
    if (!taken(rel)) return { rel, renamed: candidate !== name };
  }
  throw new Error(`no free name for ${name}`);
}

async function put(rel, data, modified) {
  claim(rel);
  if (opts.dryRun) return;
  const abs = path.join(GAMES_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  if (modified) await utimes(abs, modified, modified).catch(() => {});
}

const titleOf = (buf) => parseHead(buf.subarray(0, 256 * 1024).toString('utf8')).title;

/* --- what is already on the wall ----------------------------------------- */

async function listTree(dir, base = dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).split(path.sep).join('/');
    if (isJunk(rel)) continue;
    if (entry.isDirectory()) out.push(...(await listTree(abs, base)));
    else if (entry.isFile()) out.push({ abs, rel });
  }
  return out;
}

/**
 * Pages already on the wall, grouped by size. Two files can only be identical
 * if they are the same length, so a page is hashed only when something of its
 * exact size arrives — not all 900 MB of the wall on every run.
 */
const unhashed = new Map(); // byte length → [{ abs, rel }]

async function learnExisting() {
  const everything = await listTree(GAMES_DIR);
  for (const f of everything) claim(f.rel);
  const pages = everything.filter((f) => HTML.test(f.rel));
  await pool(pages, 16, async (f) => {
    const { size } = await stat(f.abs);
    if (!unhashed.has(size)) unhashed.set(size, []);
    unhashed.get(size).push(f);
  });
  return pages.length;
}

/** Where an identical page already lives, if anywhere, plus this page's hash. */
async function duplicateOf(data) {
  const hash = sha1(data);
  const sameSize = unhashed.get(data.length);
  if (sameSize) {
    unhashed.delete(data.length);
    for (const f of sameSize) hashes.set(sha1(await readFile(f.abs)), f.rel);
  }
  return { hash, same: hashes.get(hash) || null };
}

/* --- single pages ---------------------------------------------------------- */

async function importPage({ data, name, modified, from, subdir, qualifier }) {
  const { hash, same } = await duplicateOf(data);
  if (same) {
    report.duplicates.push({ from, same });
    return;
  }
  // `index(3).html` says nothing about the game; its title, or else its
  // folder, does. The name chosen here becomes the game's slug for good.
  let fileName = clean(name);
  const ext = path.extname(name).toLowerCase();
  if (UNINFORMATIVE_NAME.test(fileName.slice(0, -ext.length || undefined))) {
    const titled = slugify(splitTitle(titleOf(data)).name);
    fileName = (titled || clean(qualifier || 'game')) + ext;
  }

  const dir = posix(opts.into, subdir);
  // `snake/v2.html` means build v2 of snake. Landing somewhere other than a
  // folder called snake, it has to say so in its own name.
  const version = parseVersion(fileName.replace(/\.[^.]+$/, ''));
  if (version.version && !version.base && qualifier && slugify(dir.split('/').pop() || '') !== slugify(qualifier)) {
    fileName = `${clean(qualifier)}-${fileName}`;
  }

  const { rel, renamed } = freePath(dir, fileName, qualifier);
  if (renamed) report.renamed.push({ from, rel });
  await put(rel, data, modified);
  hashes.set(hash, rel);
  if (modified) addedDates[rel] = modified.toISOString();
  report.pages.push({ from, rel, bytes: data.length, title: titleOf(data) });
}

/* --- projects: a folder of files with an index.html ----------------------- */

const safeDecode = (p) => {
  try {
    return decodeURI(p);
  } catch {
    return p;
  }
};

/**
 * @param files  [{ rel, read: () => Promise<Buffer>|Buffer, modified }] relative to the project root
 * @param entry  the page to serve as index.html, when it is named something else
 */
async function importProject({ name, files, from, subdir, entry = null }) {
  const target = (rel) => (entry && rel === entry ? 'index.html' : rel);
  const present = new Set(files.map((f) => target(f.rel)));
  const keep = (p) => present.has(p) || present.has(safeDecode(p));

  // Rewrite pages first: the entry's final bytes are what a re-import is
  // compared against, so running the same import twice is harmless.
  const pages = new Map();
  let fixed = 0;
  for (const f of files) {
    const rel = target(f.rel);
    if (!HTML.test(rel)) continue;
    const before = (await f.read()).toString('utf8');
    const after = relativizeRefs(before, keep, rel.split('/').length - 1);
    if (after !== before) fixed++;
    pages.set(f.rel, Buffer.from(after, 'utf8'));
  }
  const entryKey = entry || files.find((f) => INDEX_FILE.test(f.rel))?.rel;
  const entryData = pages.get(entryKey);
  const { hash, same } = await duplicateOf(entryData);
  if (same) {
    report.duplicates.push({ from, same });
    return;
  }

  const { rel: dir, renamed } = freePath(posix(opts.into, subdir), clean(name), '');
  if (renamed) report.renamed.push({ from, rel: `${dir}/` });
  claim(dir);

  let bytes = 0;
  const leftovers = [];
  for (const f of files) {
    const data = pages.get(f.rel) ?? (await f.read());
    bytes += data.length;
    const rel = target(f.rel);
    // Bundles that build URLs at runtime cannot be fixed by rewriting a page.
    if (/\.(m?js|css)$/i.test(rel) && /["'`(]\/(assets|static|build|_app)\//.test(data.toString('latin1'))) {
      leftovers.push(rel);
    }
    await put(posix(dir, rel), data, f.modified);
  }
  const entryModified = files.find((f) => f.rel === entryKey)?.modified;
  hashes.set(hash, `${dir}/index.html`);
  if (entryModified) addedDates[`${dir}/index.html`] = entryModified.toISOString();
  report.projects.push({ from, rel: `${dir}/`, files: files.length, bytes, fixed, title: titleOf(entryData) });
  if (leftovers.length) report.leftovers.push({ rel: `${dir}/`, files: leftovers });
}

/* --- zips ------------------------------------------------------------------ */

async function importZip(abs, subdir) {
  const from = shown(abs);
  let zip;
  const buf = await readFile(abs);
  try {
    zip = openZip(buf);
  } catch (error) {
    report.failed.push({ from, why: error.message });
    return;
  }

  const entries = zip.entries.filter((e) => !e.dir && e.path && !isJunk(e.path));
  if (isContainer(path.basename(abs), entries.map((e) => e.path))) return importContainer(zip, entries, subdir);
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const read = (p) => zip.read(byPath.get(p));
  const stem = packageName(path.basename(abs, path.extname(abs)));

  let verdict;
  try {
    verdict = chooseWebRoot([...byPath.keys()], (p) => read(p).toString('utf8'));
  } catch (error) {
    report.failed.push({ from, why: error.message });
    return;
  }

  const under = (root) =>
    entries
      .filter((e) => !root || e.path.startsWith(root + '/'))
      .map((e) => ({ rel: root ? e.path.slice(root.length + 1) : e.path, read: () => zip.read(e), modified: e.modified }));

  let unpacked = 0;
  try {
    if (verdict.kind === 'projects') {
      for (const root of verdict.roots) {
        const leaf = root.split('/').pop();
        const name =
          verdict.roots.length === 1 || !leaf || BUILT_DIR.test(leaf) ? stem : `${stem}-${leaf}`;
        const files = under(root);
        unpacked += files.length;
        await importProject({ name, files, from, subdir });
      }
    } else if (verdict.kind === 'page') {
      const files = under(verdict.root);
      unpacked = files.length;
      const entry = verdict.root ? verdict.entry.slice(verdict.root.length + 1) : verdict.entry;
      await importProject({ name: stem, files, from, subdir, entry });
    } else if (verdict.kind === 'loose') {
      // A zip of several single-file games becomes a collection named after it.
      const folder = verdict.files.length > 1 ? posix(subdir, clean(stem)) : subdir;
      for (const p of verdict.files) {
        const e = byPath.get(p);
        await importPage({ data: read(p), name: path.posix.basename(p), modified: e.modified, from: `${from} › ${p}`, subdir: folder, qualifier: stem });
      }
      return; // nothing but pages, all of them now in games/
    } else if (verdict.kind === 'needs-build') {
      report.needsBuild.push({ from, root: verdict.root });
    } else {
      report.failed.push({ from, why: 'no .html page inside' });
      return;
    }
  } catch (error) {
    report.failed.push({ from, why: error.message });
  }

  // Keep the package when it held more than was unpacked: its source.
  if (unpacked < entries.length) {
    const kept = await keepSource(abs, buf.length, from);
    const secrets = zip.entries.filter((e) => !e.dir && e.path && isSecret(e.path)).map((e) => e.path);
    if (kept && secrets.length) report.secrets.push({ rel: kept, files: secrets });
  }
}

/**
 * Unpack a folder-of-games zip somewhere temporary and walk it as the folder
 * it was. A single wrapping folder (Drive puts everything in `files/`) is
 * stepped into, so it does not become a collection of its own.
 */
async function importContainer(zip, entries, subdir) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'ai-hub-ingest-'));
  const savedBase = base;
  try {
    for (const e of entries) {
      const out = path.join(temp, e.path);
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, zip.read(e));
      if (e.modified) await utimes(out, e.modified, e.modified).catch(() => {});
    }
    const tops = new Set(entries.map((e) => e.path.split('/')[0]));
    const single = tops.size === 1 && entries.every((e) => e.path.includes('/'));
    const root = single ? path.join(temp, [...tops][0]) : temp;
    base = temp;
    await importDir(root, root, subdir);
  } finally {
    base = savedBase;
    await rm(temp, { recursive: true, force: true });
  }
}

async function keepSource(abs, bytes, from) {
  if (bytes > MAX_SOURCE_BYTES) {
    report.sources.push({ from, rel: null, why: `${mb(bytes)} is over GitHub's limit — keep it somewhere else` });
    return null;
  }
  const name = clean(path.basename(abs));
  let rel = name;
  for (let n = 2; await stat(path.join(SOURCES_DIR, rel)).then(() => true, () => false); n++) {
    const same = sha1(await readFile(path.join(SOURCES_DIR, rel))) === sha1(await readFile(abs));
    if (same) return null;
    rel = name.replace(/(\.zip)?$/i, `-${n}$1`);
  }
  if (!opts.dryRun) {
    await mkdir(SOURCES_DIR, { recursive: true });
    await copyFile(abs, path.join(SOURCES_DIR, rel));
  }
  report.sources.push({ from, rel: `sources/${rel}` });
  return `sources/${rel}`;
}

/* --- folders --------------------------------------------------------------- */

/** `orbit/dist` is orbit; `orbit/v2` is orbit-v2, which the scan reads as build 2 of orbit. */
const nameForDir = (abs) => {
  const leaf = path.basename(abs);
  const parent = path.basename(path.dirname(abs));
  if (BUILT_DIR.test(leaf)) return parent;
  const version = parseVersion(leaf);
  return version.version && !version.base ? `${parent}-${leaf}` : leaf;
};

async function importDirAsProject(abs, verdict, subdir) {
  const all = await listTree(abs);
  const from = shown(abs);
  const files = (root) =>
    all
      .filter((f) => !root || f.rel.startsWith(root + '/'))
      .map((f) => ({
        rel: root ? f.rel.slice(root.length + 1) : f.rel,
        read: () => readFile(f.abs),
        modified: null,
        abs: f.abs,
      }));
  const withDates = async (list) => {
    for (const f of list) f.modified = (await stat(f.abs)).mtime;
    return list;
  };

  if (verdict.kind === 'projects') {
    for (const root of verdict.roots) {
      const leaf = root.split('/').pop();
      const name = verdict.roots.length === 1 || !leaf || BUILT_DIR.test(leaf) ? nameForDir(abs) : leaf;
      await importProject({ name, files: await withDates(files(root)), from: root ? `${from}/${root}` : from, subdir });
    }
  } else if (verdict.kind === 'page') {
    const entry = verdict.root ? verdict.entry.slice(verdict.root.length + 1) : verdict.entry;
    await importProject({ name: nameForDir(abs), files: await withDates(files(verdict.root)), from, subdir, entry });
  } else if (verdict.kind === 'needs-build') {
    report.needsBuild.push({ from, root: verdict.root });
  }
}

/**
 * A folder is either one project (it has an index.html, or a package.json, or
 * is a single page with the files it loads) or a container of games, which is
 * walked. The one ambiguity — an index.html sitting among a dozen unrelated
 * games, as in a folder someone made a listing page for — is settled by what
 * else is there: pages with no scripts or styles beside them are loose games.
 */
async function importDir(abs, rootInput, under = '') {
  const relFromInput = path.relative(rootInput, abs).split(path.sep).join('/');
  const subdir = posix(under, opts.keepFolders ? relFromInput : '');
  // Where this folder lands if it turns out to be one project: beside its siblings.
  const parentSubdir = posix(under, opts.keepFolders ? path.posix.dirname(relFromInput).replace(/^\.$/, '') : '');
  let entries;
  try {
    entries = (await readdir(abs, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    report.failed.push({ from: shown(abs), why: error.message });
    return;
  }
  entries = entries.filter((e) => !isJunk(e.name) && !e.name.startsWith('.'));
  const files = entries.filter((e) => e.isFile());
  const pagesHere = files.filter((e) => HTML.test(e.name));
  const assetsHere = files.some((e) => /\.(m?js|css|wasm)$/i.test(e.name));
  const hasIndex = pagesHere.some((e) => INDEX_FILE.test(e.name));
  const hasPackage = files.some((e) => e.name === 'package.json');
  const listingPage = hasIndex && !hasPackage && !assetsHere && pagesHere.length >= 4;

  if ((hasIndex && !listingPage) || hasPackage) {
    const tree = await listTree(abs);
    const verdict = chooseWebRoot(tree.map((f) => f.rel), (p) => readFileSync(path.join(abs, p), 'utf8'));
    return importDirAsProject(abs, verdict, parentSubdir);
  }

  // One page plus the images and scripts it loads, without an index.html.
  if (pagesHere.length === 1 && !listingPage) {
    const tree = await listTree(abs);
    if (tree.filter((f) => HTML.test(f.rel)).length === 1) {
      const verdict = chooseWebRoot(tree.map((f) => f.rel), (p) => readFileSync(path.join(abs, p), 'utf8'));
      if (verdict.kind === 'page') return importDirAsProject(abs, verdict, parentSubdir);
    }
  }

  for (const entry of entries) {
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) {
      await importDir(child, rootInput, under);
    } else if (HTML.test(entry.name)) {
      const info = await stat(child);
      await importPage({
        data: await readFile(child),
        name: entry.name,
        modified: info.mtime,
        from: shown(child),
        subdir,
        // The folder that was handed in (Drive's `files/`, ~/Downloads) says
        // nothing about any one game in it; a clash there just gets numbered.
        qualifier: abs === rootInput ? '' : path.basename(abs),
      });
    } else if (/\.zip$/i.test(entry.name)) {
      await importZip(child, subdir);
    } else {
      report.ignored++;
    }
  }
}

/* --- go -------------------------------------------------------------------- */

const alreadyThere = await learnExisting();

for (const input of inputs) {
  if (input === GAMES_DIR || input.startsWith(GAMES_DIR + path.sep)) {
    usage(1, `${home(input)} is already inside games/ — the wall picks it up by itself.`);
  }
  base = path.dirname(input);
  let info;
  try {
    info = await stat(input);
  } catch {
    report.failed.push({ from: home(input), why: 'not found' });
    continue;
  }
  if (info.isDirectory()) await importDir(input, input);
  else if (/\.zip$/i.test(input)) await importZip(input, '');
  else if (HTML.test(input)) {
    await importPage({ data: await readFile(input), name: path.basename(input), modified: info.mtime, from: shown(input), subdir: '', qualifier: path.basename(path.dirname(input)) });
  } else report.failed.push({ from: shown(input), why: 'not an .html, .zip or folder' });
}

if (!opts.dryRun && Object.keys(addedDates).length) {
  let added = {};
  try {
    added = JSON.parse(await readFile(ADDED_FILE, 'utf8'));
  } catch {
    /* first run */
  }
  Object.assign(added, addedDates);
  const sorted = Object.fromEntries(Object.entries(added).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(ADDED_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

printReport();

if (!opts.dryRun && (report.pages.length || report.projects.length)) {
  const manifest = await scan({ quiet: false });
  sameNames(manifest);
  console.log('  Look it over with `pnpm dev`, then commit games/, data/added.json and sources/.\n');
}

function printReport() {
  const r = report;
  const bytes = [...r.pages, ...r.projects].reduce((n, x) => n + x.bytes, 0);
  const verb = opts.dryRun ? 'would import' : 'imported';
  console.log(
    `\n  import  ${verb} ${r.pages.length} page${r.pages.length === 1 ? '' : 's'} and ${r.projects.length} project${r.projects.length === 1 ? '' : 's'} (${mb(bytes)})` +
      `  ·  ${alreadyThere} pages were already on the wall\n`
  );

  const section = (title, rows) => {
    if (!rows.length) return;
    console.log(`  ${title}`);
    for (const row of rows.slice(0, 40)) console.log(`    ${row}`);
    if (rows.length > 40) console.log(`    … and ${rows.length - 40} more`);
    console.log('');
  };

  section('projects unpacked', r.projects.map((p) => `games/${p.rel}  ${p.files} files${p.fixed ? `, ${p.fixed} page${p.fixed === 1 ? '' : 's'} given relative paths` : ''}  ← ${p.from}`));
  section('skipped, already on the wall (identical bytes)', r.duplicates.map((d) => `${d.from}  = games/${d.same}`));
  section('renamed so nothing is overwritten', r.renamed.map((x) => `${x.from}  → games/${x.rel}`));
  section(
    'need a build before they can be played — build them, then import the output folder',
    r.needsBuild.map((x) => `${x.from}  (source ${x.root ? `in ${x.root}/` : 'at its top level'})`)
  );
  if (r.needsBuild.length) {
    console.log('    To play one: unpack it, run `npm install && npm run build` (for Vite, `npm run build -- --base ./`),');
    console.log('    then `pnpm ingest <its dist or build folder>`. Its source zip is already kept in sources/.\n');
  }
  section(
    'may still request files from the site root at runtime — rebuild with a relative base if they load blank',
    r.leftovers.map((x) => `games/${x.rel}  ${x.files.slice(0, 3).join(', ')}${x.files.length > 3 ? ', …' : ''}`)
  );
  section('source packages kept (committed, never deployed)', r.sources.map((s) => (s.rel ? `${s.rel}  ← ${s.from}` : `${s.from}  — ${s.why}`)));
  section(
    'kept packages that contain what look like secrets — the repo is private, but rotate any live keys or delete them from the zip before committing',
    r.secrets.map((x) => `${x.rel}  ${x.files.slice(0, 4).join(', ')}${x.files.length > 4 ? ', …' : ''}`)
  );
  section('could not import', r.failed.map((f) => `${f.from}  — ${f.why}`));
  if (r.ignored) console.log(`  ${r.ignored} other file${r.ignored === 1 ? '' : 's'} (not .html or .zip) left where they were.\n`);
}

/** Separate tiles that share a title are often builds of one game under
 *  different filenames. Worth a look; never merged automatically. */
function sameNames(manifest) {
  const byName = new Map();
  for (const game of manifest.games) {
    const key = slugify(game.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(game);
  }
  const groups = [...byName.values()].filter((g) => g.length > 1);
  if (!groups.length) return;
  console.log(`  ${groups.length} title${groups.length === 1 ? ' is' : 's are'} shared by more than one tile. If any are builds of one game,`);
  console.log('  move them into one folder as v1.html, v2.html… and they become one tile:');
  for (const group of groups.slice(0, 15)) {
    console.log(`    "${group[0].name}"  ${group.map((g) => g.builds[0].file).join('  ·  ')}`);
  }
  if (groups.length > 15) console.log(`    … and ${groups.length - 15} more`);
  console.log('');
}
