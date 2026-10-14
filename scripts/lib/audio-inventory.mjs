/** Static review evidence, never a license decision. No network requests. */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const TEXT = /\.(?:html?|[cm]?js|json|md|txt|css|svg|tsx?|jsx)$/i;
const formatOf = value => /\.(mp3|wav)(?:[?#].*)?$/i.exec(value)?.[1].toLowerCase();
const hash = text => createHash('sha256').update(text).digest('hex');
const mimeFormat = mime => /^(?:audio\/(?:mpeg|x-mpeg|mp3|x-mp3|mpeg3|x-mpeg-3))$/i.test(mime) ? 'mp3'
  : /^(?:audio\/(?:wav|wave|x-wav|x-pn-wav|vnd.wave))$/i.test(mime) ? 'wav' : null;
const cache = new Map();
async function read(abs) {
  const s = await stat(abs), stamp = `${s.size}:${s.mtimeMs}`;
  if (cache.get(abs)?.stamp === stamp) return cache.get(abs).text;
  const text = await readFile(abs, 'utf8');
  if (s.size < 256 * 1024) cache.set(abs, { stamp, text });
  return text;
}

export function placeholderEvidence(text, file) {
  const out = [];
  if (!/place[ -]?holder/i.test(text)) return out;
  // A structured soundtrack manifest can state its purpose without repeating
  // “music”. Require both a music source and looping tracks in that case.
  const soundtrackManifest = /manifest\.json$/i.test(file) && /["']source["']\s*:\s*["'][^"']*\/music\//i.test(text) && /["']loop["']\s*:\s*true/i.test(text);
  // Keep offsets/lines while removing URL vocabulary and separating HTML blocks.
  const prose = text.replace(/https?:\/\/[^\s<>"']+/gi, s => ' '.repeat(s.length))
    .replace(/<\/?[a-z][a-z0-9-]*(?:\s+[^<>]*?)?\/?>/gi, s => /<\/?(?:p|li|tr|h[1-6]|div|br)\b/i.test(s)
      ? ';' + ' '.repeat(s.length - 1) : ' '.repeat(s.length));
  const boundary = /[\n.!?;]|\b(?:but|however|whereas)\b/i;
  for (const match of prose.matchAll(/\bplace[ -]?holders?\b/gi)) {
    const before = prose.slice(Math.max(0, match.index - 240), match.index).split(boundary).pop();
    const after = prose.slice(match.index + match[0].length, match.index + match[0].length + 240).split(boundary)[0];
    const clause = before + match[0] + after;
    if (!/\b(?:music|soundtrack|bgm|background track)\b/i.test(clause) && !soundtrackManifest) continue;
    if (/\b(?:no|not|never|without|isn't|aren't|removed|replaced|replace|replaces)\b[^.!?;]{0,55}\bplace[ -]?holders?\b|\bplace[ -]?holders?\b[^.!?;]{0,45}\b(?:removed|replaced|not used)\b/i.test(clause)) continue;
    if (/\b(?:art|images?|sprites?|textures?|visuals?|sound effects?|sfx|voice)\b\s+(?:are\s+)?place[ -]?holders?\b|\bplace[ -]?holders?\s+(?:art|images?|sprites?|textures?|visuals?|sound effects?|sfx|voice)\b/i.test(clause)) continue;
    out.push({ path: `games/${file}`, line: text.slice(0, match.index).split('\n').length, excerpt: clause.replace(/[A-Za-z0-9+/=]{60,}/g, '[embedded payload]').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 360) });
  }
  return out;
}

export async function scanAudio(entry, root) {
  const assets = new Map(), evidence = [], visited = new Set();
  const projectDir = entry.project ? path.posix.dirname(entry.rel) : null;
  const inside = rel => rel !== '..' && !rel.startsWith('../') && !path.isAbsolute(rel);
  async function resolve(ref, source) {
    let clean;
    try { clean = decodeURIComponent(ref.split(/[?#]/)[0]); } catch { return null; }
    const candidates = clean.startsWith('/games/') ? [clean.slice(7)] : clean.startsWith('/') ? []
      : [path.posix.join(path.posix.dirname(source), clean), ...(projectDir ? [path.posix.join(projectDir, clean)] : [])];
    for (const rel of candidates.map(x => path.posix.normalize(x))) {
      if (!inside(rel)) continue;
      try { if ((await stat(path.join(root, rel))).isFile()) return rel; } catch { /* unresolved literal */ }
    }
    return null;
  }
  function add(id, format, kind, source) {
    if (!assets.has(id)) assets.set(id, { id, format, kind, source: `games/${source}` });
  }
  async function inspect(rel) {
    if (visited.has(rel)) return;
    visited.add(rel);
    const format = formatOf(rel);
    if (format) { add(`games/${rel}`, format, 'local', rel); return; }
    if (!TEXT.test(rel)) return;
    const text = await read(path.join(root, rel));
    evidence.push(...placeholderEvidence(text, rel));
    for (const m of text.replace(/\\\//g, '/').matchAll(/data:(audio\/[\w.+-]+)((?:;[\w=.+-]+)*),([a-z0-9+/=%\s.-]+)/gi)) {
      const f = mimeFormat(m[1]);
      if (f) add(`inline:${hash(m[3].replace(/\s/g, ''))}`, f, 'inline', rel);
    }
    // Parse inert JSON only; never evaluate scripts or infer audio from a MIME
    // label alone. Validate field types, base64 encoding and matching signatures.
    const jsonSources = /\.json$/i.test(rel) ? [text] : [];
    for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/\btype\s*=\s*(?:"application\/json"|'application\/json'|application\/json(?=\s|$))/i.test(m[1])) jsonSources.push(m[2]);
    }
    for (const json of jsonSources) {
      let parsed;
      try { parsed = JSON.parse(json); } catch { continue; }
      const pending = [parsed];
      while (pending.length) {
        const value = pending.pop();
        if (!value || typeof value !== 'object') continue;
        for (const child of Object.values(value)) if (child && typeof child === 'object') pending.push(child);
        if (typeof value.mime !== 'string' || typeof value.data !== 'string') continue;
        const f = mimeFormat(value.mime), payload = value.data.replace(/\s/g, '');
        if (!f || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) continue;
        const bytes = Buffer.from(payload, 'base64');
        const actual = bytes.subarray(0, 3).toString() === 'ID3' ? 'mp3'
          : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE' ? 'wav' : null;
        if (f === actual) add(`inline:${hash(payload)}`, f, 'inline', rel);
      }
    }
    // Recognizable raw base64 passed to atob: only ID3 MP3 or RIFF/WAVE
    // signatures, not arbitrary blobs or MIME labels alone.
    for (const m of text.matchAll(/\batob\(\s*["'`]([a-z0-9+/=\s]+)["'`]\s*\)/gi)) {
      const payload = m[1].replace(/\s/g, '');
      const bytes = Buffer.from(payload, 'base64');
      const f = bytes.subarray(0, 3).toString() === 'ID3' ? 'mp3'
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE' ? 'wav' : null;
      if (f) add(`inline:${hash(payload)}`, f, 'inline', rel);
    }
    // Quoted literals include URLs in JS, HTML, CSS and JSON. Ignore templates
    // with substitutions; reconstructing runtime expressions is out of scope.
    function* references() {
      yield* text.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*([^\s"'`=<>]+)/gi);
      yield* text.matchAll(/["'`]([^"'`\r\n<>]{1,2048})["'`]/g);
      yield* text.matchAll(/(https?:\/\/[^\s"'`<>()\\]{1,2048}\.(?:mp3|wav)(?=[?#\s"'`<>()]|$)(?:[?#][^\s"'`<>()\\]*)?)/gi);
      yield* text.matchAll(/(?:\b(?:src|href)\s*=\s*|\burl\(\s*)([^\s"'`<>()]+\.(?:mp3|wav)(?=[?#\s"'`<>()]|$)(?:[?#][^\s"'`<>()]*)?)/gi);
    }
    for (const m of references()) {
      const ref = m[1].replace(/\\\//g, '/');
      if (/\$\{|^data:/i.test(ref)) continue;
      const f = formatOf(ref);
      if (/^(?:https?:)?\/\//i.test(ref)) {
        if (f) {
          try {
            const url = new URL(ref.startsWith('//') ? `https:${ref}` : ref);
            url.hash = ''; url.search = '';
            add(url.href, f, 'remote', rel);
          } catch { /* malformed or opaque URL */ }
        }
      // Loose HTML pages are separate games, not literal dependencies. Project
      // pages are still inventoried by walk() within their own directory.
      } else if (f || (TEXT.test(ref.split(/[?#]/)[0]) && !/\.html?$/i.test(ref.split(/[?#]/)[0]))) {
        const target = await resolve(ref, rel);
        if (target) await inspect(target);
      }
    }
  }
  async function walk(dir) {
    for (const e of (await readdir(path.join(root, dir), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name, 'en'))) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) await walk(rel);
      else if (e.isFile()) await inspect(rel);
    }
  }
  if (projectDir) await walk(projectDir); else await inspect(entry.rel);
  return mergeAudio([{ assets: [...assets.values()], evidence }]);
}

export function mergeAudio(inventories) {
  const assets = [...new Map(inventories.flatMap(x => x.assets).map(x => [x.id, x])).values()].sort((a,b) => a.id.localeCompare(b.id, 'en'));
  const evidence = [...new Map(inventories.flatMap(x => x.evidence).map(x => [`${x.path}:${x.line}:${x.excerpt}`, x])).values()].sort((a,b) => a.path.localeCompare(b.path, 'en') || a.line-b.line);
  return { formats: [...new Set(assets.map(x => x.format))].sort(), counts: Object.fromEntries(['mp3','wav'].map(f => [f, assets.filter(x => x.format === f).length])), assets, evidence };
}
