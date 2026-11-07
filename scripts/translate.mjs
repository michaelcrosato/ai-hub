/**
 * translate.mjs — translates the hub's lines (assets/lang/en.js) into its
 * languages with the `claude` CLI, following "Translating" in
 * lib/hub/languages.md.
 *
 *   node scripts/translate.mjs [--catalogue] [--model claude-haiku-5-5] [--effort medium]
 *        [--langs fr,ru] [--jobs 4] [--force] [--dry-run]
 *        [--out assets/lang] [--sources scripts/lang-sources]
 *
 * With --catalogue it translates the catalogue instead: each game's
 * description, controls and session text, and the genre, type and tag names,
 * from data/games.json into data/lang/<code>.json. Game titles stay as
 * written.
 *
 * Only new or changed lines are sent: scripts/lang-sources/<code>.json keeps,
 * for each line, a fingerprint of the English it was translated from (with
 * its note and max), and the terms chosen for that language, so later runs
 * keep using them. Each line's translation is checked; one that fails the
 * checks is asked for again once, then left out, and the hub shows the
 * English line. Every call's usage, cost and time goes to
 * .cache/translate/runs.jsonl, and the run ends with a table of them.
 *
 * The CLI runs without tools, MCP servers, settings or skills, in a temporary
 * folder, so a call carries little besides the lines. It uses the CLI's own
 * sign-in, so runs count against that plan.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { englishLines, checkTranslation, pluralForms, singleNumberForms, formNumbers } from './lib/languages.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SET1 = ['zh-Hans', 'hi', 'es-419', 'ar', 'fr', 'bn', 'pt-BR', 'ru', 'id'];

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);
const MODEL = flag('model', 'claude-haiku-5-5');
const EFFORT = flag('effort', 'medium');
const LANGS = flag('langs', SET1.join(',')).split(',').filter(Boolean);
const JOBS = Number(flag('jobs', 4));
const CHUNK = Number(flag('chunk', 6000));   // characters of English per call
const CATALOGUE = has('catalogue');
const OUT = join(ROOT, flag('out', CATALOGUE ? 'data/lang' : 'assets/lang'));
const SOURCES = join(ROOT, flag('sources', 'scripts/lang-sources'));
const LOG = join(ROOT, '.cache/translate/runs.jsonl');

const source = await englishLines(ROOT);
const english = (code) => new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
const fingerprint = (id) => createHash('sha256').update(JSON.stringify([source.lines[id], source.notes?.[id] ?? null, source.max?.[id] ?? null])).digest('hex').slice(0, 10);
const readJson = (path, fallback) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } };

const SYSTEM = `You are a literary translator working on the words of a website. You translate faithfully, the way a novel or an indie film is translated: you keep the author's meaning, voice and tone, and change only what the language requires (grammar, word order, punctuation, number formats). You never rewrite, add, explain or soften. You reply with JSON only.

The author's brief:
${source.brief}`;

const TERMS = ['Wall', 'Couch', 'Catalogue', 'Atlas', 'Timeline', 'Deck', 'Friends', 'session', 'host', 'round', 'build', 'cabinet', 'game', 'player', 'sign in', 'library'];

// ---------------------------------------------------------------------------

/** One call to the claude CLI: the reply's text, usage, cost and time. */
const WORK = mkdtempSync(join(tmpdir(), 'translate-'));
function ask(prompt) {
  const cli = ['-p', '--model', MODEL, '--effort', EFFORT, '--output-format', 'json', '--tools', '', '--system-prompt', SYSTEM,
    '--no-session-persistence', '--strict-mcp-config', '--disable-slash-commands', '--setting-sources', ''];
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('claude', cli, { cwd: WORK, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      let reply = null;
      try { reply = JSON.parse(out); } catch {}
      resolve({ ok: code === 0 && reply && !reply.is_error, text: reply?.result ?? '', reply, err: err.slice(0, 500), wall: Date.now() - started });
    });
    child.stdin.end(prompt);
  });
}

/** The first JSON object in a reply. */
function parseObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

function record(kind, code, lines, res) {
  const u = res.reply?.usage || {};
  const entry = {
    at: new Date().toISOString(), kind, model: MODEL, effort: EFFORT, code, lines,
    input: u.input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, output: u.output_tokens || 0,
    cost: res.reply?.total_cost_usd || 0, ms: res.reply?.duration_ms || res.wall, apiMs: res.reply?.duration_api_ms || 0, ok: res.ok,
  };
  mkdirSync(join(ROOT, '.cache/translate'), { recursive: true });
  appendFileSync(LOG, JSON.stringify(entry) + '\n');
  return entry;
}

// ---------------------------------------------------------------------------

/** The plural forms a language uses, with the numbers each covers, for the prompt. */
function formsText(code) {
  const numbers = formNumbers(code, 120);
  const single = singleNumberForms(code);
  const forms = pluralForms(code).map((f) => {
    const list = numbers[f] || [];
    const shown = list.length > 6 ? `${list.slice(0, 6).join(', ')}…` : list.join(', ') || 'large numbers';
    return single.has(f) ? `${f} (${shown}: may leave out {count})` : `${f} (${shown}: keeps {count})`;
  });
  const zeroHelps = pluralForms(code).some((f) => !single.has(f) && singleNumberForms(code, { zero: true }).has(f));
  return forms.join(', ') + (zeroHelps ? `. You may add "zero" (the line for none); "one" then means only 1 and may leave out {count}` : '');
}

/** The terms for a language, chosen once and kept, so a word means one thing everywhere. */
async function chooseTerms(code, state) {
  if (state.terms && state.you) return [];
  const prompt = `You will translate this website into ${english(code)} (${code}). First choose how to say its key terms, so each always has the same name, and which form of "you" to use for the player (see the brief).

Terms: ${TERMS.map((t) => JSON.stringify(t)).join(', ')}

Reply with one JSON object: {"you": "<the form of you, as a word in ${english(code)}>", "terms": {"<term>": "<translation>", ...}}`;
  const res = await ask(prompt);
  const entry = record('terms', code, TERMS.length, res);
  const reply = parseObject(res.text);
  if (reply && typeof reply.you === 'string' && reply.terms && typeof reply.terms === 'object') {
    state.you = reply.you;
    state.terms = reply.terms;
  } else {
    console.error(`  ${code}: no usable terms (${res.err || res.text.slice(0, 200)})`);
  }
  return [entry];
}

function linesPrompt(code, state, ids, problems = null) {
  const items = Object.fromEntries(ids.map((id) => {
    const item = { text: source.lines[id] };
    if (source.notes?.[id]) item.note = source.notes[id];
    if (source.max?.[id]) item.max = source.max[id];
    return [id, item];
  }));
  const terms = Object.entries(state.terms || {}).map(([a, b]) => `${a} → ${b}`).join('; ');
  return `Translate these lines of the website into ${english(code)} (${code}).

- Keep each line's meaning, voice and tone. Address the player as "${state.you || 'you'}" throughout.
- Copy every tag in curly braces exactly, character for character, such as {count} or {name}. You may move a tag within its line. Don't translate inside braces and don't add tags.
- These names stay exactly as written, in Latin letters: ${(source.names || []).join(', ')}. Game titles stay as written too.
- A line whose "text" is an object of plural forms becomes an object with exactly the forms ${english(code)} uses: ${formsText(code)}. Keep "zero" when the original has it. Each form is a whole line.
- "max" is the room a short label has, counted in letters (a Chinese, Japanese or Korean character counts two): keep within it.
- "note" explains a line for you; don't translate notes.
- Use these terms: ${terms || '(none chosen)'}.
${problems ? `\nAn earlier translation of these lines failed these checks; fix them:\n${problems.map((p) => `- ${p}`).join('\n')}\n` : ''}
Lines:
${JSON.stringify(items, null, 1)}

Reply with one JSON object: {"lines": {"<id>": "<translation>" or {<plural forms>}, ...}} with every id above.`;
}

/** Ids in chunks of about CHUNK characters of English. */
function chunks(ids) {
  const out = [];
  let cur = [];
  let size = 0;
  for (const id of ids) {
    const n = JSON.stringify(source.lines[id]).length + (source.notes?.[id]?.length || 0);
    if (cur.length && size + n > CHUNK) { out.push(cur); cur = []; size = 0; }
    cur.push(id);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function translateChunk(code, state, ids) {
  const entries = [];
  const good = {};
  let todo = ids;
  let problems = null;
  for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
    const res = await ask(linesPrompt(code, state, todo, problems));
    entries.push(record(attempt ? 'retry' : 'lines', code, todo.length, res));
    const reply = parseObject(res.text);
    const lines = reply && reply.lines && typeof reply.lines === 'object' ? reply.lines : {};
    const asked = Object.fromEntries(todo.filter((id) => id in lines).map((id) => [id, lines[id]]));
    const { blocking, bad } = checkTranslation(source, code, asked);
    for (const [id, value] of Object.entries(asked)) if (!bad.has(id)) good[id] = value;
    todo = todo.filter((id) => !(id in good));
    problems = [...blocking, ...todo.filter((id) => !(id in asked)).map((id) => `${id}: missing from the reply`)];
    if (!res.ok) console.error(`  ${code}: call failed: ${res.err || res.text.slice(0, 200)}`);
  }
  return { good, failed: todo, entries };
}

async function pool(tasks, n) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }));
  return results;
}

// ---------------------------------------------------------------------------

async function translateLines() {
  const ids = Object.keys(source.lines).filter((id) => !id.startsWith('dev.'));
  const plan = LANGS.map((code) => {
    const file = join(OUT, `${code}.json`);
    const state = readJson(join(SOURCES, `${code}.json`), { lines: {} });
    const current = readJson(file, { lines: {} });
    const usable = (id) => id in (current.lines || {}) && checkTranslation(source, code, { [id]: current.lines[id] }).blocking.length === 0;
    const todo = ids.filter((id) => has('force') || state.lines?.[id] !== fingerprint(id) || !usable(id));
    return { code, file, state, current, todo };
  });

  for (const p of plan) console.log(`${p.code}: ${p.todo.length} of ${ids.length} lines to translate, ${chunks(p.todo).length} calls`);
  if (has('dry-run')) return;

  await pool(plan.map((p) => async () => {
    if (!p.todo.length) return;
    log.push(...(await chooseTerms(p.code, p.state)));
    const results = await pool(chunks(p.todo).map((part) => () => translateChunk(p.code, p.state, part)), 3);
    const lines = { ...(p.current.lines || {}) };
    for (const id of Object.keys(lines)) if (!(id in source.lines)) delete lines[id];
    const sources = { ...(p.state.lines || {}) };
    for (const id of Object.keys(sources)) if (!(id in source.lines)) delete sources[id];
    const failed = [];
    for (const r of results) {
      log.push(...r.entries);
      for (const [id, value] of Object.entries(r.good)) { lines[id] = value; sources[id] = fingerprint(id); }
      failed.push(...r.failed);
    }
    const ordered = Object.fromEntries(ids.filter((id) => id in lines).map((id) => [id, lines[id]]));
    const by = [...new Set([...(String(p.current.by || '').split(', ').filter(Boolean)), MODEL])];
    mkdirSync(OUT, { recursive: true });
    mkdirSync(SOURCES, { recursive: true });
    writeFileSync(p.file, JSON.stringify({ by: by.join(', '), lines: ordered }, null, 1) + '\n');
    writeFileSync(join(SOURCES, `${p.code}.json`), JSON.stringify({ model: MODEL, you: p.state.you, terms: p.state.terms, lines: sources }, null, 1) + '\n');
    const { flags } = checkTranslation(source, p.code, ordered);
    console.log(`${p.code}: ${Object.keys(ordered).length}/${ids.length} lines${failed.length ? `, ${failed.length} left in English: ${failed.slice(0, 8).join(', ')}` : ''}${flags.length ? `, ${flags.length} flags` : ''}`);
  }), JOBS);
}

// ---------------------------------------------------------------------------
// The catalogue: games' own words and the names of genres, types and tags.

const FIELDS = ['description', 'controls', 'sessionGoal', 'sessionHowto', 'howto', 'goal'];
const KINDS = { genre: (g) => [g.genre], type: (g) => [g.type], tag: (g) => g.tags };

const CATALOGUE_RULES = (code) => `- Keep each text's meaning, tone and details. Don't shorten, summarise or add.
- Game titles, and the names of characters, places and things in the games, stay exactly as written, in Latin letters, the way the games show them.
- Names of keys and buttons stay as written (W, A, S, D, Space, Shift, Esc, Enter, the arrow keys, Cross, Square, L1, R2, the left stick); translate the words around them.
- AI model names stay as written.
- Write in ${english(code)} throughout.`;

function catalogueChunks(items) {
  const out = [];
  let cur = [];
  let size = 0;
  for (const item of items) {
    const n = Object.values(item.texts).join('').length;
    if (cur.length && size + n > CHUNK * 1.5) { out.push(cur); cur = []; size = 0; }
    cur.push(item);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** A translated game text is kept when it is non-empty text that isn't the English left as it was. */
function usableText(english, text) {
  return typeof text === 'string' && text.trim() !== '' && (english.length < 40 || text.trim() !== english.trim());
}

async function translateGames(code, items) {
  const entries = [];
  const good = {};
  let todo = items;
  for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
    const asked = Object.fromEntries(todo.map((item) => [item.slug, { title: item.title, ...item.texts }]));
    const prompt = `Translate these entries of the arcade's catalogue into ${english(code)} (${code}). Each entry is one game: its title (for context; it stays as written) and its texts: description, controls, sessionGoal (what wins when friends play it together), sessionHowto (how to play it together), howto, goal.

${CATALOGUE_RULES(code)}

Entries:
${JSON.stringify(asked, null, 1)}

Reply with one JSON object: {"games": {"<slug>": {"<text name>": "<translation>", ...}, ...}} with every entry and every text above, and no title.`;
    const res = await ask(prompt);
    entries.push(record(attempt ? 'retry' : 'games', code, todo.length, res));
    const reply = parseObject(res.text);
    const games = reply && reply.games && typeof reply.games === 'object' ? reply.games : {};
    for (const item of todo) {
      const got = games[item.slug];
      if (!got || typeof got !== 'object') continue;
      for (const [field, text] of Object.entries(item.texts)) {
        if (usableText(text, got[field])) (good[item.slug] ??= {})[field] = got[field].trim();
      }
    }
    todo = todo
      .map((item) => ({ ...item, texts: Object.fromEntries(Object.entries(item.texts).filter(([field]) => !good[item.slug]?.[field])) }))
      .filter((item) => Object.keys(item.texts).length);
    if (!res.ok) console.error(`  ${code}: call failed: ${res.err || res.text.slice(0, 200)}`);
  }
  return { good, failed: todo.flatMap((item) => Object.keys(item.texts).map((f) => `${item.slug}.${f}`)), entries };
}

async function translateTerms(code, terms) {
  const prompt = `Translate these names used to sort the arcade's games into ${english(code)} (${code}): genres, types of entry, and tags. Keep each one short, as a label; give each its usual name in ${english(code)}, and keep a name that players of ${english(code)} use as it is (such as "RPG" or "3d" where that is usual). The same word in two lists gets the same translation.

${JSON.stringify(terms, null, 1)}

Reply with one JSON object of the same shape: {"genre": {"<English>": "<translation>"}, "type": {...}, "tag": {...}}.`;
  const res = await ask(prompt);
  const entry = record('terms', code, Object.values(terms).reduce((n, list) => n + list.length, 0), res);
  const reply = parseObject(res.text) || {};
  const out = {};
  for (const [kind, list] of Object.entries(terms)) {
    for (const value of list) {
      const text = reply[kind]?.[value];
      if (typeof text === 'string' && text.trim()) (out[kind] ??= {})[value] = text.trim();
    }
  }
  return { terms: out, entries: [entry] };
}

async function translateCatalogue() {
  const { scan } = await import('./scan.mjs');
  await scan({ quiet: true });
  const games = JSON.parse(readFileSync(join(ROOT, 'data/games.json'), 'utf8')).games;
  const items = games
    .map((g) => ({ slug: g.slug, title: g.name, texts: Object.fromEntries(FIELDS.filter((f) => typeof g[f] === 'string' && g[f].trim()).map((f) => [f, g[f].trim()])) }))
    .filter((item) => Object.keys(item.texts).length);
  const vocabulary = Object.fromEntries(Object.entries(KINDS).map(([kind, read]) => [kind, [...new Set(games.flatMap((g) => (read(g) || []).filter((v) => typeof v === 'string' && v.trim())))].sort()]));
  const print = (n) => (n / 1000).toFixed(0) + 'k';
  const plan = LANGS.map((code) => {
    const file = join(OUT, `${code}.json`);
    const stateFile = join(SOURCES, `${code}.catalogue.json`);
    const state = readJson(stateFile, { games: {}, terms: {} });
    const current = readJson(file, { games: {}, terms: {} });
    const fp = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);
    const todo = items
      .map((item) => ({ ...item, texts: Object.fromEntries(Object.entries(item.texts).filter(([field, text]) => has('force') || state.games?.[item.slug]?.[field] !== fp(text) || !current.games?.[item.slug]?.[field])) }))
      .filter((item) => Object.keys(item.texts).length);
    const terms = Object.fromEntries(Object.entries(vocabulary).map(([kind, list]) => [kind, list.filter((v) => has('force') || !current.terms?.[kind]?.[v])]));
    return { code, file, stateFile, state, current, todo, terms, fp };
  });
  for (const p of plan) {
    const chars = p.todo.reduce((n, item) => n + Object.values(item.texts).join('').length, 0);
    console.log(`${p.code}: ${p.todo.length} of ${items.length} games (${print(chars)} characters) and ${Object.values(p.terms).flat().length} terms to translate, ${catalogueChunks(p.todo).length + 1} calls`);
  }
  if (has('dry-run')) return;

  await pool(plan.map((p) => async () => {
    const results = await pool(catalogueChunks(p.todo).map((part) => () => translateGames(p.code, part)), 3);
    const termResult = Object.values(p.terms).some((list) => list.length) ? await translateTerms(p.code, p.terms) : { terms: {}, entries: [] };
    const out = { games: { ...(p.current.games || {}) }, terms: { ...(p.current.terms || {}) } };
    const state = { games: { ...(p.state.games || {}) } };
    const failed = [];
    for (const r of results) {
      log.push(...r.entries);
      failed.push(...r.failed);
      for (const [slug, texts] of Object.entries(r.good)) {
        out.games[slug] = { ...(out.games[slug] || {}), ...texts };
        const english = items.find((item) => item.slug === slug).texts;
        state.games[slug] = { ...(state.games[slug] || {}) };
        for (const field of Object.keys(texts)) state.games[slug][field] = p.fp(english[field]);
      }
    }
    log.push(...termResult.entries);
    for (const [kind, map] of Object.entries(termResult.terms)) out.terms[kind] = { ...(out.terms[kind] || {}), ...map };
    // Games and texts that left the catalogue leave the translation too.
    const live = new Map(items.map((item) => [item.slug, item.texts]));
    for (const slug of Object.keys(out.games)) {
      if (!live.has(slug)) { delete out.games[slug]; delete state.games[slug]; continue; }
      for (const field of Object.keys(out.games[slug])) if (!(field in live.get(slug))) delete out.games[slug][field];
    }
    const by = [...new Set([...String(p.current.by || '').split(', ').filter(Boolean), MODEL])];
    mkdirSync(OUT, { recursive: true });
    mkdirSync(SOURCES, { recursive: true });
    const sortedGames = Object.fromEntries(items.filter((item) => out.games[item.slug]).map((item) => [item.slug, out.games[item.slug]]));
    writeFileSync(p.file, JSON.stringify({ by: by.join(', '), games: sortedGames, terms: out.terms }) + '\n');
    writeFileSync(p.stateFile, JSON.stringify({ model: MODEL, games: state.games }, null, 1) + '\n');
    const texts = Object.values(sortedGames).reduce((n, g) => n + Object.keys(g).length, 0);
    console.log(`${p.code}: ${Object.keys(sortedGames).length} games, ${texts} texts, ${Object.values(out.terms).reduce((n, m) => n + Object.keys(m).length, 0)} terms${failed.length ? `, ${failed.length} texts left in English` : ''}`);
  }), JOBS);
}

const started = Date.now();
const log = [];
if (CATALOGUE) await translateCatalogue();
else await translateLines();

// The run's table: per language, calls, tokens, cost and time.
const sum = {};
for (const e of log) {
  const s = (sum[e.code] ??= { calls: 0, lines: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, cost: 0, ms: 0 });
  s.calls++; s.lines += e.kind === 'lines' ? e.lines : 0; s.input += e.input; s.cacheWrite += e.cacheWrite; s.cacheRead += e.cacheRead; s.output += e.output; s.cost += e.cost; s.ms += e.ms;
}
const rows = Object.entries(sum);
if (rows.length) {
  console.log(`\n${MODEL} at ${EFFORT} effort, ${((Date.now() - started) / 1000).toFixed(0)} s in all`);
  console.log('lang      calls  lines   input  c.write  c.read  output    cost   call-s');
  for (const [code, s] of rows) {
    console.log(`${code.padEnd(9)} ${String(s.calls).padStart(5)} ${String(s.lines).padStart(6)} ${String(s.input).padStart(7)} ${String(s.cacheWrite).padStart(8)} ${String(s.cacheRead).padStart(7)} ${String(s.output).padStart(7)} ${('$' + s.cost.toFixed(3)).padStart(8)} ${(s.ms / 1000).toFixed(0).padStart(7)}`);
  }
  const total = rows.reduce((t, [, s]) => ({ cost: t.cost + s.cost, output: t.output + s.output }), { cost: 0, output: 0 });
  console.log(`total: $${total.cost.toFixed(3)}, ${total.output} output tokens`);
}
