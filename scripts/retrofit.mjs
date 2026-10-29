#!/usr/bin/env node
/**
 * retrofit.mjs — bring existing games to side by side, a game at a time.
 *
 *   node scripts/retrofit.mjs pick [--wave 1] [--limit N]
 *       which games to do: one build of each title, readable code first
 *   node scripts/retrofit.mjs prepare <games…> [--minutes 4]
 *       the tool step alone: the session client and the side-by-side metas,
 *       first in <head> (scripts/lib/retrofit.mjs)
 *   node scripts/retrofit.mjs check <games…>
 *       what each page still lacks, read from its text
 *   node scripts/retrofit.mjs run <games…> --agent "<command>" [--agent "<next tier>"…]
 *       [--jobs 2] [--budget 150] [--max-cost 1] [--timeout 20] [--browser-args "<flags>"] [--again] [--dry-run]
 *       the whole pipeline, for each game:
 *
 *   1. Can this machine's browser draw the game at all (hub-check --draws-only)?
 *      If not (a WebGPU-only game without WebGPU), no model is spent on it.
 *      --browser-args passes flags to every check's Chromium; on a machine with
 *      no GPU, SwiftShader gives WebGPU games a software adapter:
 *        --browser-args "--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --use-angle=swiftshader"
 *   2. The tool step, then the agent with the prompt in lib/hub/retrofit.md, on
 *      its stdin (or as a file, in place of {prompt-file}). It works on a copy
 *      of the game in a folder of its own, outside the repository, so it can
 *      touch nothing else and two jobs never meet; what it changed is copied
 *      back for the checks. For example
 *        --agent "claude -p --model claude-haiku-5-5 --max-turns 30 --permission-mode acceptEdits --output-format json"
 *   3. The static check, a diff budget, then hub-check --retrofit against the
 *      original. Each tier gets two tries, the second told what the first's
 *      checks found; past --max-cost dollars for one game it stops.
 *   4. A game that passes keeps its changes, for review. Every other game is
 *      put back exactly as it was, so it never declares a session it cannot
 *      play, and gets a sessionNote in data/overrides.json saying why (unfit,
 *      failed, or this browser cannot draw it), which later runs skip unless
 *      --again.
 *
 * Every try is a line in .cache/retrofit.jsonl, with the agent's cost when it
 * prints one as JSON: run a pilot of about thirty varied games, read the pass
 * rate and cost per game, play a few that passed, then do the rest in waves.
 * Nothing is committed: commit what passed in batches of about fifty.
 */

import { spawn } from 'node:child_process';
import { appendFile, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkRetrofit, prepareSideBySide, changedLines } from './lib/retrofit.mjs';
import { normalize, sessionOf } from '../assets/js/manifest.js';
import { lineageKey } from '../assets/js/session/pick.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = path.join(ROOT, '.cache', 'retrofit.jsonl');
const OVERRIDES = path.join(ROOT, 'data', 'overrides.json');
/** The original beside the game while it is checked: a leading _ keeps the scan from ever listing it. */
const BEFORE = '_before-retrofit.';
const backupOf = (target) => path.join(path.dirname(target), BEFORE + path.basename(target));
const NOTE = 'side by side:';

const argv = process.argv.slice(2);
const command = argv.shift();
const values = (name) => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));
const value = (name, fallback) => values(name)[0] ?? fallback;
const flag = (name) => argv.includes(`--${name}`);
const named = new Set(['--agent', '--jobs', '--minutes', '--timeout', '--budget', '--max-cost', '--wave', '--limit', '--browser-args']);
const targets = argv.filter((a, i) => !a.startsWith('--') && !named.has(argv[i - 1]));

const run = (cmd, args, { input, timeoutMs = 0, shell = false, cwd = ROOT } = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGTERM'), timeoutMs) : null;
    const done = (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, out, err });
    };
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    // A command that exits without reading its input, or never starts, is a failed try, not a crash.
    child.stdin.on('error', () => {});
    child.on('error', (e) => {
      err += e.message;
      done(-1);
    });
    child.on('close', done);
    child.stdin.end(input ?? '');
  });

const rel = (file) => path.relative(ROOT, file);
const isProject = (page) => path.basename(page) === 'index.html';
const TEXT = /\.(html?|m?js|css|json|txt|md)$/i;
/** A new file a try may add to a project: code, not an agent's notes. */
const CODE = /\.(html?|m?js|css)$/i;
const exists = (file) => stat(file).then(() => true, () => false);

async function catalogue() {
  try {
    return JSON.parse(await readFile(path.join(ROOT, 'data/games.json'), 'utf8')).games;
  } catch {
    throw new Error('data/games.json is missing: run pnpm scan first');
  }
}

/** A game argument as its page on disk: a path under the repository, or a slug from data/games.json. */
async function resolveGame(arg) {
  const direct = path.resolve(ROOT, arg);
  try {
    const s = await stat(direct);
    return s.isDirectory() ? path.join(direct, 'index.html') : direct;
  } catch {
    const game = (await catalogue()).find((g) => g.slug === arg);
    if (!game) throw new Error(`${arg}: no such file and no such slug`);
    return path.join(ROOT, decodeURI(game.path).slice(1));
  }
}

/**
 * Every text file in a project folder, by path: what a try may change, and what
 * a reset puts back. Hidden files and folders (an agent's own notes) are not
 * the game's.
 */
async function textFiles(dir, out = new Map()) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await textFiles(full, out);
    else if (TEXT.test(entry.name)) out.set(full, await readFile(full, 'utf8'));
  }
  return out;
}

/** The page, and for a project folder every script it ships: the text the static check reads. */
async function gameText(page) {
  if (!isProject(page)) return readFile(page, 'utf8');
  const files = await textFiles(path.dirname(page));
  return [files.get(page) ?? '', ...[...files].filter(([f]) => f !== page && /\.m?js$/i.test(f)).map(([, t]) => t)].join('\n');
}

/** The agent's cost and words, when it printed JSON (as `claude -p --output-format json` does). */
function readReply(out) {
  try {
    const json = JSON.parse(out.trim());
    const cost = json.total_cost_usd ?? json.cost_usd ?? json.usage?.cost ?? null;
    return { cost: Number.isFinite(cost) ? cost : null, text: String(json.result ?? json.text ?? out) };
  } catch {
    return { cost: null, text: out };
  }
}

async function hubCheck(args) {
  const browser = value('browser-args', null);
  const { out } = await run(process.execPath, [path.join(ROOT, 'scripts/hub-check.mjs'), ...args, ...(browser ? ['--browser-args', browser] : []), '--json']);
  try {
    const report = JSON.parse(out.slice(out.indexOf('{')));
    const failed = report.runs.flatMap((r) => r.checks.filter((c) => !c.pass).map((c) => `${r.players} players ${r.scenario}: ${c.name}${c.detail ? ` (${c.detail})` : ''}`));
    return { pass: report.pass, failed };
  } catch {
    return { pass: false, failed: [`hub-check did not report: ${out.slice(-300)}`] };
  }
}

/* --- notes in data/overrides.json: one at a time, whatever --jobs says ------- */

let writing = Promise.resolve();
function noteGame(page, note) {
  writing = writing.then(async () => {
    const wanted = `/${rel(page)}`;
    const game = (await catalogue()).find((g) => decodeURI(g.path) === wanted);
    if (!game) return;
    const overrides = JSON.parse(await readFile(OVERRIDES, 'utf8'));
    const entry = { ...(overrides[game.slug] || {}) };
    if (note) entry.sessionNote = `${NOTE} ${note}`.slice(0, 240);
    else if (String(entry.sessionNote || '').startsWith(NOTE)) delete entry.sessionNote;
    if (Object.keys(entry).length) overrides[game.slug] = entry;
    else delete overrides[game.slug];
    // Written whole, then moved into place: a reader never sees half a file.
    const next = `${OVERRIDES}.${process.pid}.tmp`;
    await writeFile(next, `${JSON.stringify(overrides, null, 2)}\n`);
    await rename(next, OVERRIDES);
  });
  return writing;
}

async function noted(page) {
  const overrides = JSON.parse(await readFile(OVERRIDES, 'utf8'));
  const game = (await catalogue()).find((g) => decodeURI(g.path) === `/${rel(page)}`);
  const note = game && overrides[game.slug]?.sessionNote;
  return note && String(note).startsWith(NOTE) ? note : null;
}

/* --- one game ---------------------------------------------------------------- */

/** What to undo if the run is stopped (Ctrl-C, a kill): each game in hand puts itself back. */
const inHand = new Set();
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    stopping = true;
    console.log(`\n${signal}: putting back the ${inHand.size} game${inHand.size === 1 ? '' : 's'} in hand`);
    await Promise.all([...inHand].map((undo) => undo().catch(() => {})));
    process.exit(130);
  });
}

/** A run cut short before it could clean up left the original beside the game: put the game back from it. */
async function recover(page) {
  const project = isProject(page);
  const home = path.dirname(page);
  const backup = project ? backupOf(home) : backupOf(page);
  if (!(await exists(backup))) return;
  if (project) {
    const kept = await textFiles(backup);
    for (const file of (await textFiles(home)).keys()) if (!kept.has(path.join(backup, path.relative(home, file)))) await rm(file, { force: true });
    await cp(backup, home, { recursive: true, force: true });
  } else {
    await cp(backup, page);
  }
  await rm(backup, { recursive: true, force: true });
  console.log(`restored ${rel(page)}: an earlier run was cut short`);
}

async function retrofitOne(arg, agents, prompt) {
  const page = await resolveGame(arg);
  await recover(page);
  const originalText = await readFile(page, 'utf8');
  const client = await readFile(path.join(ROOT, 'lib/hub/session.js'), 'utf8');
  const prepared = prepareSideBySide(originalText, { client, minutes: Number(value('minutes', 4)) });
  const today = new Date().toISOString().slice(0, 10);
  const log = async (entry) => {
    await mkdir(path.dirname(LEDGER), { recursive: true });
    await appendFile(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), game: rel(page), ...entry })}\n`);
  };
  if (prepared.skipped) {
    await log({ outcome: 'skipped', reason: prepared.skipped });
    return { game: rel(page), outcome: 'skipped', reason: prepared.skipped };
  }
  const already = !flag('again') && (await noted(page));
  if (already) return { game: rel(page), outcome: 'skipped', reason: `noted before (${already}); --again to retry` };
  if (flag('dry-run')) return { game: rel(page), outcome: 'dry-run', tiers: agents.length };

  // A page this browser cannot run cannot be checked here: spend nothing on it.
  const draws = await hubCheck([`/${rel(page)}`, '--draws-only']);
  if (!draws.pass) {
    await log({ outcome: 'environment', failed: draws.failed });
    await noteGame(page, `cannot be checked here, the page does not run in this browser (${today}); try a browser with WebGPU`);
    return { game: rel(page), outcome: 'environment', reason: 'the page does not run in this browser' };
  }

  // The game's own files as they were: its page, or for a project every text file in its folder.
  const project = isProject(page);
  const home = path.dirname(page);
  const before = project ? await textFiles(home) : new Map([[page, originalText]]);
  // The original, served beside the game for hub-check's comparison: the page, or the whole
  // project folder, so the original page loads the original scripts.
  const backup = project ? backupOf(home) : backupOf(page);
  const original = project ? path.join(backup, 'index.html') : backup;
  /** Put the game back as it was, dropping any new text file a try left in its folder. */
  const resetGame = async () => {
    if (project) for (const file of (await textFiles(home)).keys()) if (!before.has(file)) await rm(file, { force: true });
    for (const [file, text] of before) await writeFile(file, text);
  };
  // The agent's copy of the game, in a folder of its own outside the repository.
  const work = await mkdtemp(path.join(os.tmpdir(), 'aihub-retrofit-'));
  const workPage = path.join(work, path.basename(page));
  const freshCopy = async () => {
    await rm(work, { recursive: true, force: true });
    await mkdir(work, { recursive: true });
    if (project) await cp(home, work, { recursive: true });
    await writeFile(workPage, prepared.text);
  };
  const budget = Number(value('budget', 150));
  const maxCost = Number(value('max-cost', 1));
  let spent = 0;
  let lastFailed = [];
  let kept = false;
  let tries = 0;
  let agentDown = 0;
  let agentError = '';
  const undo = async () => {
    if (!kept) await resetGame();
    await rm(backup, { recursive: true, force: true });
    await rm(work, { recursive: true, force: true });
    await rm(`${work}.prompt.md`, { force: true });
  };
  inHand.add(undo);

  try {
    if (project) await cp(home, backup, { recursive: true });
    else await writeFile(backup, originalText);
    for (const [tier, agent] of agents.entries()) {
      let notes = '';
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (spent >= maxCost) {
          await log({ outcome: 'over-budget', spent });
          await noteGame(page, `stopped at $${spent.toFixed(2)} without a pass (${today}): ${lastFailed.slice(0, 2).join('; ')}`);
          return { game: rel(page), outcome: 'gave-up', reason: `spent $${spent.toFixed(2)}` };
        }
        await resetGame();
        await freshCopy();
        const text = prompt
          .replaceAll('{{file}}', path.basename(page))
          .replaceAll('{{notes}}', notes ? `The last try failed these checks; fix them:\n${notes}` : '');
        const started = Date.now();
        let reply;
        const timeoutMs = Number(value('timeout', 20)) * 60_000;
        if (agent.includes('{prompt-file}')) {
          const file = `${work}.prompt.md`;
          await writeFile(file, text);
          reply = await run(agent.replaceAll('{prompt-file}', JSON.stringify(file)), [], { shell: true, timeoutMs, cwd: work });
          await rm(file, { force: true });
        } else {
          reply = await run(agent, [], { shell: true, input: text, timeoutMs, cwd: work });
        }
        if (stopping) return { game: rel(page), outcome: 'stopped' };
        tries++;
        const { cost, text: words } = readReply(reply.out);
        spent += cost ?? 0;
        const seconds = Math.round((Date.now() - started) / 1000);
        const unfit = words.match(/NOT SIDE BY SIDE:\s*(.+)/)?.[1]?.trim();
        if (unfit) {
          await log({ outcome: 'unfit', tier, attempt, agent, seconds, cost, reason: unfit.slice(0, 300) });
          await noteGame(page, `unfit (${today}): ${unfit}`);
          return { game: rel(page), outcome: 'unfit', reason: unfit };
        }
        // The try's page, and every file it changed (or new code it added), copied back into the game for the checks.
        const after = project ? await textFiles(work) : new Map(await readFile(workPage, 'utf8').then((t) => [[workPage, t]], () => []));
        let changed = 0;
        for (const [file, t] of after) {
          const target = path.join(home, path.relative(work, file));
          const was = target === page ? prepared.text : before.get(target);
          if (was === undefined && !CODE.test(file)) continue;
          if (t !== was) changed += changedLines(was ?? '', t);
          else if (target !== page) continue;
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, t);
        }
        const down = reply.code !== 0 && !changed;
        if (down) {
          agentDown++;
          agentError = `the agent exited with ${reply.code} and changed nothing${reply.err.trim() ? `: ${reply.err.trim().slice(-200)}` : ''}`;
        }
        const problems = [
          ...(down ? [agentError] : []),
          ...(after.has(workPage) ? [] : ['the try deleted the page']),
          ...checkRetrofit(await gameText(page)),
          ...(changed > budget ? [`changed ${changed} lines, more than the ${budget} allowed: change only what the steps need`] : []),
        ];
        const checked = problems.length ? { pass: false, failed: problems } : await hubCheck([`/${rel(page)}`, '--retrofit', '--original', `/${rel(original)}`]);
        await log({ outcome: checked.pass ? 'pass' : 'fail', tier, attempt, agent, seconds, cost, changed, exit: reply.code, failed: checked.failed.slice(0, 12) });
        if (checked.pass) {
          kept = true;
          await noteGame(page, null);
          return { game: rel(page), outcome: 'pass', tier, attempt, changed };
        }
        lastFailed = checked.failed;
        notes = checked.failed.slice(0, 12).map((f) => `- ${f}`).join('\n');
      }
    }
    // An agent that never ran (not installed, signed out, rate-limited) says nothing about the game: no note.
    if (tries && agentDown === tries) {
      await log({ outcome: 'agent', reason: agentError });
      return { game: rel(page), outcome: 'agent', reason: agentError };
    }
    await log({ outcome: 'gave-up', tiers: agents.length, spent });
    await noteGame(page, `failed every tier (${today}): ${lastFailed.slice(0, 2).join('; ')}`);
    return { game: rel(page), outcome: 'gave-up' };
  } finally {
    // Whatever happened, a game that did not pass is exactly as it was, and nothing is left behind.
    inHand.delete(undo);
    await undo();
  }
}

/* --- which games first ------------------------------------------------------- */

/** Code shipped minified: long lines dense with code, not data. */
const looksMinified = (text) =>
  text.split('\n').some((line) => line.length > 2000 && !/base64,|^\s*["'{[]/.test(line) && (line.match(/function|=>|return|const |let /g) || []).length > 40);
/** No way to run without WebGPU: three's WebGL fallback switched off, a throw on any other backend, or raw WebGPU only. */
const needsWebGPU = (text) =>
  /_getFallback\s*=\s*null/.test(text) || /isWebGPUBackend[^;]{0,120}throw/.test(text) || (/navigator\.gpu/.test(text) && !/WebGLRenderer|getContext\(\s*["']webgl/.test(text));
const scored = (text) => /\bscore\b|\blives\b|game ?over|gameOver|you win|victory|finish line|\blap\b|level complete/i.test(text);

async function pick() {
  const overrides = JSON.parse(await readFile(OVERRIDES, 'utf8'));
  const note = (g) => String(overrides[g.slug]?.sessionNote || '');
  const games = (await catalogue()).map(normalize).filter((g) => (g.type ?? 'Game') === 'Game' && !overrides[g.slug]?.hidden && !overrides[g.slug]?.restricted);
  // Titles first, as the deal counts them (lineageKey): a title with a build in sessions is
  // done, and one found unfit (no score, no finish) stays so, whichever build was tried.
  const lineages = new Map();
  for (const g of games) {
    const k = lineageKey(g);
    if (!lineages.has(k)) lineages.set(k, []);
    lineages.get(k).push(g);
  }
  for (const [k, builds] of lineages) if (builds.some((g) => sessionOf(g) || note(g).startsWith(`${NOTE} unfit`))) lineages.delete(k);
  const wave1 = value('wave', null) === '1';
  const out = [];
  for (const builds of lineages.values()) {
    const rated = [];
    // A build already tried (failed, or not runnable here) waits for --again; another build of its title may go first.
    for (const g of builds.filter((b) => !note(b).startsWith(NOTE))) {
      const page = path.join(ROOT, decodeURI(g.path).slice(1));
      const text = await gameText(page).catch(() => '');
      const r = { page, size: text.length, minified: looksMinified(text), webgpu: needsWebGPU(text), scored: scored(text) };
      if (r.scored) rated.push(r);
    }
    // The build to do first: readable, runs without WebGPU, then the least code to read.
    rated.sort((a, b) => a.minified - b.minified || a.webgpu - b.webgpu || a.size - b.size);
    const best = rated[0];
    if (!best || (wave1 && (best.minified || best.webgpu))) continue;
    out.push(best);
  }
  out.sort((a, b) => a.size - b.size);
  const limit = Number(value('limit', 0)) || out.length;
  for (const r of out.slice(0, limit)) console.log(rel(r.page));
  console.error(`${Math.min(limit, out.length)} of ${out.length} titles${wave1 ? ' in wave 1 (readable, no WebGPU needed)' : ''}, from ${lineages.size} titles not yet in sessions; ${out.filter((r) => r.minified).length} minified, ${out.filter((r) => r.webgpu).length} need WebGPU`);
}

/* --- main -------------------------------------------------------------------- */

async function main() {
  if (command === 'pick') return pick();
  if (!['prepare', 'check', 'run'].includes(command) || !targets.length) {
    console.log('Usage: node scripts/retrofit.mjs pick [--wave 1] [--limit N]\n       node scripts/retrofit.mjs prepare|check|run <games…> [--agent "<command>"…] [--jobs N] [--budget 150] [--max-cost 1] [--minutes 4] [--timeout 20] [--browser-args "<flags>"] [--again] [--dry-run]');
    process.exit(2);
  }
  if (command === 'prepare') {
    const client = await readFile(path.join(ROOT, 'lib/hub/session.js'), 'utf8');
    for (const arg of targets) {
      const page = await resolveGame(arg);
      const out = prepareSideBySide(await readFile(page, 'utf8'), { client, minutes: Number(value('minutes', 4)) });
      if (out.skipped) console.log(`skipped  ${rel(page)}: ${out.skipped}`);
      else {
        await writeFile(page, out.text);
        console.log(`prepared ${rel(page)}`);
      }
    }
    return;
  }
  if (command === 'check') {
    let bad = 0;
    for (const arg of targets) {
      const page = await resolveGame(arg);
      const problems = checkRetrofit(await gameText(page));
      if (problems.length) bad++;
      console.log(`${problems.length ? 'TODO' : 'OK  '}  ${rel(page)}${problems.length ? `\n        ${problems.join('\n        ')}` : ''}`);
    }
    process.exit(bad ? 1 : 0);
  }
  const agents = values('agent');
  if (!agents.length && !flag('dry-run')) {
    console.log('run needs at least one --agent "<command>", cheapest first');
    process.exit(2);
  }
  const readme = await readFile(path.join(ROOT, 'lib/hub/README.md'), 'utf8');
  const contract = readme.slice(readme.indexOf('## Side by side'), readme.indexOf('\n## Rules')).trim();
  const prompt = (await readFile(path.join(ROOT, 'lib/hub/retrofit.md'), 'utf8'))
    .split('\n---\n')
    .slice(1)
    .join('\n---\n')
    .trim()
    .replaceAll('{{contract}}', contract)
    .replaceAll('{{budget}}', String(Number(value('budget', 150))));
  const queue = [...targets];
  const results = [];
  let agentStreak = 0;
  const worker = async () => {
    for (let arg = queue.shift(); arg; arg = queue.shift()) {
      const result = await retrofitOne(arg, agents, prompt).catch((e) => ({ game: arg, outcome: 'error', reason: e.message }));
      results.push(result);
      agentStreak = result.outcome === 'agent' ? agentStreak + 1 : 0;
      if (agentStreak >= 3 && queue.length) {
        console.log(`The agent failed to run on three games in a row, so the run stops here (${queue.length} left): check the --agent command works on its own.`);
        queue.length = 0;
      }
      console.log(`${result.outcome.toUpperCase().padEnd(11)} ${result.game}${result.reason ? `: ${result.reason}` : ''}${result.tier !== undefined ? ` (tier ${result.tier + 1}, try ${result.attempt}, ${result.changed} lines)` : ''}`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Number(value('jobs', 1))) }, worker));
  const count = (o) => results.filter((r) => r.outcome === o).length;
  console.log(
    `\n${count('pass')} passed, ${count('unfit')} unfit, ${count('gave-up')} gave up, ${count('environment')} not runnable here, ${count('agent')} where the agent did not run, ${count('skipped')} skipped, ${count('error')} errors — every try is in .cache/retrofit.jsonl`
  );
}

await main();
