#!/usr/bin/env node
/**
 * audit3d.mjs — the static rules every 3D game on the shared stack follows.
 *
 * No browser, no dependencies; the whole wall takes a couple of seconds. Run it
 * after touching a 3D game (any model, any tool): a "fix" that sneaks an old
 * renderer or a CDN copy of three.js back in fails here.
 *
 *   node scripts/audit3d.mjs                  every game that loads the kit
 *   node scripts/audit3d.mjs games/Foo.html   just these games (files or project folders)
 *   node scripts/audit3d.mjs --json           machine-readable report
 *
 * Exit code 1 when any game breaks a rule. Warnings never fail the run.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(ROOT, 'games');

/** Rules that fail the audit. Patterns run on code with comments stripped. */
export const RULES = [
  { id: 'import-map', must: true, test: (t) => /"three\/webgpu"\s*:\s*"\/lib\/three\/three\.webgpu\.js"/.test(t), msg: 'the standard import map ("three/webgpu" → /lib/three/three.webgpu.js) is missing' },
  { id: 'kit-map', must: true, test: (t) => /"kit\/"\s*:\s*"\/lib\/kit\/"/.test(t), msg: 'the import map has no "kit/" → /lib/kit/ entry' },
  { id: 'kit-boot', must: true, test: (t) => /kit\/boot\.js/.test(t), msg: 'the game does not boot through kit/boot.js' },
  { id: 'webgl-renderer', test: (t) => /new\s+(?:THREE\.)?WebGLRenderer\b/.test(t), msg: 'creates a WebGLRenderer (use kit.renderer)' },
  { id: 'shader-material', test: (t) => /new\s+(?:THREE\.)?(?:Raw)?ShaderMaterial\b/.test(t), msg: 'uses ShaderMaterial/RawShaderMaterial (use a node material with TSL)' },
  { id: 'effect-composer', test: (t) => /\bEffectComposer\b/.test(t), msg: 'uses EffectComposer (use kit/post.js or RenderPipeline)' },
  { id: 'on-before-compile', test: (t) => /\bonBeforeCompile\b/.test(t), msg: 'patches shaders with onBeforeCompile (use node slots)' },
  { id: 'cdn-three', test: (t) => /(?:cdn\.jsdelivr\.net|unpkg\.com|esm\.sh|cdnjs\.cloudflare\.com|cdn\.skypack\.dev|ga\.jspm\.io)\/[^"'\s]*three/i.test(t), msg: 'loads three.js from a CDN' },
  { id: 'data-url-module', test: (t) => /data:text\/javascript;base64,/.test(t), msg: 'inlines a module as a data: URL (a copy of three.js or a bundle)' },
  { id: 'embedded-three', test: (t) => /\bREVISION\s*=\s*["']1\d\d["']/.test(t), msg: 'embeds its own copy of three.js' },
  { id: 'shadow-map-dispose', test: (t) => /shadow\.map\s*(?:\?\.)?\s*\.?\s*dispose\s*\(|shadow\.map\s*=\s*null/.test(t), msg: 'disposes or nulls light.shadow.map (breaks r186; use kit.shadow)' },
  { id: 'line-loop', test: (t) => /new\s+(?:THREE\.)?LineLoop\b/.test(t), msg: 'uses THREE.LineLoop, which WebGPURenderer does not draw (repeat the first point on a Line)' },
  { id: 'other-engine', test: (t) => /\bBABYLON\.|\bnew\s+pc\.Application\b|playcanvas-stable|babylon\.js['"]/i.test(t), msg: 'still loads Babylon.js or PlayCanvas' },
];

/** Worth a look, never fatal. */
export const WARNINGS = [
  { id: 'raw-webgl-context', test: (t) => /getContext\(\s*['"](?:webgl2?|experimental-webgl)['"]/.test(t), msg: 'asks a canvas for a WebGL context itself (fine for a 2D overlay test, suspicious otherwise)' },
  { id: 'points-material', test: (t) => /\bPointsMaterial\b/.test(t), msg: 'uses PointsMaterial: sizes above 1 px draw as 1 px on WebGPU (kit/points.js)' },
  { id: 'raf-loop', test: (t) => /requestAnimationFrame\s*\(\s*(?:loop|animate|tick|frame|update|render)\b/.test(t) && !/\bkit\.start\s*\(/.test(t), msg: 'runs its own requestAnimationFrame loop (the kit loop is kit.start)' },
];

/** Remove comments so documentation that mentions an old API doesn't trip a rule. */
export function stripComments(src) {
  return String(src)
    // A block comment starts where code can: not inside "audio/*" or a glob string.
    .replace(/(^|[\s;{}(),])\/\*[\s\S]*?\*\//g, '$1 ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

/** Audit one game's combined source text. */
export function auditText(text) {
  const code = stripComments(text);
  const errors = [];
  const warnings = [];
  for (const r of RULES) {
    // Required pieces count wherever they appear; banned ones only in live code.
    const hit = r.must ? r.test(text) : r.test(code);
    if (r.must ? !hit : hit) errors.push({ id: r.id, msg: r.msg });
  }
  for (const w of WARNINGS) if (w.test(code)) warnings.push({ id: w.id, msg: w.msg });
  return { errors, warnings };
}

async function filesOf(entry) {
  const abs = path.resolve(ROOT, entry);
  const info = await stat(abs);
  if (info.isFile()) return [abs];
  const out = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (/\.(html?|m?js)$/i.test(e.name)) out.push(p);
    }
  };
  await walk(abs);
  return out;
}

/** Every game (single file or project folder) that loads the kit. */
async function kitGames() {
  const found = [];
  for (const e of await readdir(GAMES, { withFileTypes: true })) {
    const p = path.join(GAMES, e.name);
    if (e.isFile() && /\.html?$/i.test(e.name)) {
      const t = await readFile(p, 'utf8');
      if (t.includes('/lib/kit/')) found.push(path.relative(ROOT, p));
    } else if (e.isDirectory()) {
      const idx = path.join(p, 'index.html');
      try {
        const t = await readFile(idx, 'utf8');
        if (t.includes('/lib/kit/')) found.push(path.relative(ROOT, p));
      } catch {
        /* a collection folder, not a project */
      }
    }
  }
  return found.sort();
}

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const targets = argv.filter((a) => !a.startsWith('--'));
  const games = targets.length ? targets.map((t) => (/(^|\/)index\.html?$/i.test(t) ? path.dirname(t) : t)) : await kitGames();
  const report = [];
  for (const g of games) {
    const files = await filesOf(g);
    const text = (await Promise.all(files.map((f) => readFile(f, 'utf8')))).join('\n');
    report.push({ game: g, ...auditText(text) });
  }
  const failing = report.filter((r) => r.errors.length);
  if (json) {
    console.log(JSON.stringify({ games: report.length, failing: failing.length, report }, null, 2));
  } else {
    for (const r of failing) {
      console.log(`✗ ${r.game}`);
      for (const e of r.errors) console.log(`    ${e.id}: ${e.msg}`);
    }
    const warned = report.filter((r) => r.warnings.length);
    console.log(`\n${report.length} game(s) audited, ${failing.length} breaking a rule, ${warned.length} with warnings${warned.length ? ' (--json lists them)' : ''}.`);
  }
  process.exit(failing.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
