/**
 * Decide which gpt-matrix run directories are packaged games, and the
 * catalogue name and overrides for each one.
 *
 * A packaged game is the single HTML file directly inside `workspace/`.
 * Probes, templates, shells, nested project pages, and `original-artifacts`
 * copies are not games. The filename is
 * `GameTitle-SOURCE-model-effort-YYYYMMDD-HHMM.html`. The `YYYYMMDD-HHMM`
 * stamp on a shared package name is a batch label, not the run's time.
 * No I/O: callers pass the file list, the page text, and the run record.
 */

import { createHash } from 'node:crypto';

import { splitTitle, parseHead } from './parse.mjs';

export const contentHash = (text) => createHash('sha256').update(text).digest('hex');

const ROOT_HTML = /^workspace\/[^/]+\.html?$/i;
const NOT_A_GAME = /(^|\/)([^/]*(?:probe|template|shell)[^/]*|hub-report\.json)$/i;

const SERIES_OF = [
  [/^star fox\b/i, 'Star Fox'],
  [/^grand theft auto\b/i, 'Grand Theft Auto'],
  [/^the legend of zelda\b/i, 'The Legend of Zelda'],
  [/^mario kart\b/i, 'Mario Kart'],
  [/^super mario\b/i, 'Super Mario'],
  [/^anno\b/i, 'Anno'],
  [/^mechwarrior\b/i, 'MechWarrior'],
  [/^metal gear\b/i, 'Metal Gear'],
  [/^final fantasy\b/i, 'Final Fantasy'],
  [/^dragon quest\b/i, 'Dragon Quest'],
  [/^wave race\b/i, 'Wave Race'],
  [/^f-zero\b/i, 'F-Zero'],
  [/^crash bandicoot\b/i, 'Crash Bandicoot'],
];

const GENRE_OF = [
  [/^star fox\b/i, 'Shooter'],
  [/^grand theft auto\b/i, 'Action'],
  [/^(mario kart|wave race|f-zero|daytona|wipeout|crazy taxi)\b/i, 'Racing'],
  [/^(the legend of zelda|final fantasy|dragon quest|chrono trigger|arc the lad)\b/i, 'RPG'],
  [/^(anno|civilization|age of empires)\b/i, 'Strategy'],
  [/^(street fighter|tekken|virtua fighter|soulcalibur)\b/i, 'Fighting'],
  [/^(pilotwings|ace combat)\b/i, 'Flight'],
  [/^(simcity|the sims|harvest moon|animal crossing)\b/i, 'Life Sim'],
  [/^(tetris|portal)\b/i, 'Puzzle'],
  [/^(resident evil|silent hill|dino crisis)\b/i, 'Horror'],
  [/^(super mario|crash bandicoot|sonic)\b/i, 'Platformer'],
];

const GENRE_WORD = {
  Shooter: 'shooter',
  Action: 'action',
  Racing: 'racing',
  RPG: 'role-playing',
  Strategy: 'strategy',
  Flight: 'flight',
  Platformer: 'platformer',
  Adventure: 'adventure',
  Puzzle: 'puzzle',
  Sports: 'sports',
  Simulation: 'simulation',
  'Life Sim': 'life simulation',
  Horror: 'horror',
  Fighting: 'fighting',
  Stealth: 'stealth',
  'Tech Demo': 'tech demo',
};

const MODEL_IN_NAME = /-(gpt-6\.1-sol|gpt-6-astra|gpt-6-sol|gpt-6)-(max-ultra|xhigh|ultra|high|medium|low|max|unknown)-\d{8}-\d{4}\.html?$/i;
const CLOCK = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;

/** The packaged page, or null when the run has none. */
export function packagedGamePath(files) {
  const pages = (files || []).filter((file) => ROOT_HTML.test(file) && !NOT_A_GAME.test(file));
  if (pages.length !== 1) return null;
  return pages[0];
}

export function fileToken(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^A-Za-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `gpt-6-1-sol` and `claude-sonnet-5-5` keep a dotted version, as the wall's filenames do. */
export function modelSlug(value) {
  let slug = String(value ?? '').trim().toLowerCase().split('/').pop();
  if (!slug || slug === 'unknown' || slug === '(none)') return '';
  slug = slug.replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  slug = slug.replace(/(\d)-(\d)(?=-|$)/g, '$1.$2');
  return slug;
}

export function effortSlug(value) {
  const slug = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9.]+/g, '');
  if (!slug || slug === 'unknown' || slug === 'none') return '';
  return slug;
}

export function displayModel(value) {
  const slug = modelSlug(value);
  if (!slug) return '';
  if (slug.startsWith('gpt-')) {
    const rest = slug.slice(4).split('-').filter(Boolean);
    const version = rest.shift() || '';
    const tail = rest.map(capitalize).join(' ');
    return tail ? `GPT-${version} ${tail}` : `GPT-${version}`;
  }
  return slug.split('-').filter(Boolean).map((part) => (/^\d/.test(part) ? part : capitalize(part))).join(' ');
}

function capitalize(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
}

export function sourceTitle(raw) {
  if (!raw) return '';
  const text = String(raw).replace(/\s+/g, ' ').trim();
  // The notes often continue past the title: "StarFox 64 (spiritual inspiration…".
  if (/star\s*fox\s*64/i.test(text)) return 'Star Fox 64';
  if (/star\s*fox\b/i.test(text)) return 'Star Fox';
  const cut = text.split(/\s+(?:an original|original|spiritual)\b/i)[0];
  return cut.split(/[.;(]|\s[—–-]\s/)[0].trim().replace(/[.\s—–-]+$/, '');
}

export function seriesFor(source) {
  if (!source) return '';
  for (const [pattern, series] of SERIES_OF) {
    if (pattern.test(source) && series.toLowerCase() !== source.toLowerCase()) return series;
  }
  return '';
}

export function genreFor(source) {
  if (!source) return 'Action';
  for (const [pattern, genre] of GENRE_OF) if (pattern.test(source)) return genre;
  return 'Action';
}

function zoneOffsetMs(timeZone, epochMs) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(new Date(epochMs))
    .find((item) => item.type === 'timeZoneName');
  const match = part?.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * ((+match[2]) * 60 + (+match[3] || 0)) * 60 * 1000;
}

/** A clock reading in America/Vancouver, or in UTC when the line says UTC and not Vancouver. */
export function parseSourceClock(line) {
  if (!line) return null;
  const match = String(line).match(CLOCK);
  if (!match) return null;
  const year = +match[1];
  const month = +match[2];
  const day = +match[3];
  const hour = +match[4];
  const minute = +match[5];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const saysUtc = /\bUTC\b/i.test(line) && !/Vancouver|PDT|PST/i.test(line);
  if (saysUtc) return new Date(Date.UTC(year, month - 1, day, hour, minute));
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = zoneOffsetMs('America/Vancouver', utcGuess - zoneOffsetMs('America/Vancouver', utcGuess));
  return new Date(utcGuess - offset);
}

export function filenameStamp(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}${get('month')}${get('day')}`,
    time: `${get('hour').padStart(2, '0')}${get('minute').padStart(2, '0')}`,
  };
}

export function destinationName({ name, tagline, source, model, effort, when }) {
  const stamp = filenameStamp(when);
  const parts = [fileToken(name)];
  if (tagline) parts.push(fileToken(tagline));
  parts.push(fileToken(source || 'original'));
  parts.push(modelSlug(model) || 'unknown');
  parts.push(effortSlug(effort) || 'unknown');
  parts.push(stamp.date, stamp.time);
  return `${parts.filter(Boolean).join('-')}.html`;
}

function preambleOf(text) {
  const cut = String(text || '').search(/<!doctype\b|<html\b/i);
  return (cut === -1 ? String(text || '').slice(0, 24000) : String(text || '').slice(0, cut)).slice(0, 24000);
}

function labeled(preamble, name) {
  const match = preamble.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : '';
}

function modelFromLine(line) {
  const match = String(line || '').match(/gpt-6\.1-sol|gpt-6-astra|gpt-6-sol|gpt-6|claude-[a-z0-9.-]+|grok-[a-z0-9.-]+|gemini-[a-z0-9.-]+|muse-[a-z0-9.-]+/i);
  return match ? match[0] : '';
}

function effortFromLine(line) {
  const text = String(line || '');
  const match = text.match(/reasoning(?:\s+effort)?\s*[:=]?\s*(max-ultra|xhigh|ultra|high|medium|low|max|1\.00)\b/i)
    || text.match(/\b(max-ultra|xhigh|ultra|high|medium|low|max|1\.00)\s+reasoning\b/i);
  return match ? match[1] : '';
}

function fromPackageName(fileName) {
  const match = String(fileName || '').match(MODEL_IN_NAME);
  return {
    model: match ? match[1] : '',
    effort: match && match[2].toLowerCase() !== 'unknown' ? match[2] : '',
  };
}

/** Model documentation is not a game. `sourceUrl` on these pages points at it. */
function isModelDoc(value) {
  return /developers\.openai\.com\/api\/docs\/models|platform\.openai\.com\/docs\/models/i.test(String(value || ''));
}

/**
 * The classic a page names in `"sourceGame": "..."`. A trailing backslash is
 * a packaging glitch, not part of the title. Model-doc URLs are not read.
 */
export function sourceGameOf(text) {
  const re = /"sourceGame"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  for (const match of String(text || '').matchAll(re)) {
    let value = '';
    try {
      value = JSON.parse(`"${match[1]}"`);
    } catch {
      value = match[1];
    }
    value = String(value).replace(/\\+\s*$/g, '').replace(/\s+/g, ' ').trim();
    if (value && !isModelDoc(value)) return value;
  }
  return '';
}

/** Star Fox spelling from the notes, otherwise the title as the page wrote it. */
export function namedInspiration(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text || isModelDoc(text)) return '';
  if (/star\s*fox\s*64/i.test(text)) return 'Star Fox 64';
  if (/star\s*fox\b/i.test(text)) return 'Star Fox';
  return text;
}

const MODEL_SUFFIX = /-(gpt-6\.1-sol|gpt-6-astra|gpt-6-sol|gpt-6)-(?:max-ultra|xhigh|ultra|high|medium|low|max|unknown)-\d{8}-\d{4}$/i;

/**
 * Classic left in a packaged name after the page's own title:
 * `Coast-Cadet-Top-Skater-1997-gpt-6.1-sol-….html` → `Top Skater (1997)`.
 * Used only when the page names no inspiration.
 */
export function classicFromPackage(fileName, name, tagline) {
  const stem = String(fileName || '').replace(/\.html?$/i, '');
  const modelAt = stem.search(MODEL_SUFFIX);
  let rest = modelAt >= 0 ? stem.slice(0, modelAt) : stem;
  for (const token of [fileToken(name), fileToken(tagline)].filter(Boolean)) {
    const lower = rest.toLowerCase();
    const needle = token.toLowerCase();
    if (lower === needle) return '';
    if (lower.startsWith(`${needle}-`)) rest = rest.slice(token.length + 1);
  }
  if (!rest) return '';
  let text = rest.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/\bXBOX 360$/i, '(XBOX 360)');
  const year = text.match(/^(.*\S)\s+((?:19|20)\d{2})$/);
  if (year) text = `${year[1]} (${year[2]})`;
  return namedInspiration(text);
}

/**
 * Head of the page, plus any later `sourceGame` field and a Controls line.
 * Exit interviews sit past the first 80 KB on a few packaged files.
 */
export function matrixPageText(buf) {
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf ?? ''));
  const headEnd = Math.min(data.length, 80_000);
  const parts = [data.subarray(0, headEnd).toString('utf8')];
  const pushAt = (at, len) => {
    if (at < headEnd) return;
    parts.push(data.subarray(at, Math.min(data.length, at + len)).toString('utf8'));
  };
  pushAt(data.indexOf('Controls:'), 500);
  const needle = Buffer.from('"sourceGame"');
  let from = 0;
  while (from < data.length) {
    const at = data.indexOf(needle, from);
    if (at < 0) break;
    pushAt(at, 400);
    from = at + needle.length;
  }
  return parts.join('\n');
}

export function controlsOf(text) {
  const plain = String(text || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const match = plain.match(/\bControls:\s*((?:left stick|WASD|Arrow keys|Mouse|Keyboard|Gamepad)[^<\n]{6,220})/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function usableDescription(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length < 20 || value.length > 500) return '';
  if (/[{};]|=>|\bfunction\b|\bconst\b/.test(value)) return '';
  return value;
}

export function tagsFor(source, text) {
  const blob = `${source || ''}\n${String(text || '').slice(0, 24000)}`.toLowerCase();
  const tags = [];
  const add = (tag) => {
    if (tags.length < 5 && !tags.includes(tag)) tags.push(tag);
  };
  if (/webgpu|webgl|three\.js|\bthree\b/.test(blob)) add('3d');
  else add('2d');
  add('arcade');
  if (/star fox|space|starfighter|squadron|lylat|orbit/.test(blob)) add('space');
  if (/low-poly|low poly/.test(blob)) add('low-poly');
  if (/procedural/.test(blob)) add('procedural');
  if (/\bboss\b/.test(blob)) add('boss fights');
  if (/touch/.test(blob)) add('touch');
  if (/gamepad|controller/.test(blob)) add('gamepad');
  if (/vehicle|kart|driving|racing/.test(blob)) add('vehicles');
  if (tags.length < 2) add('exploration');
  return tags.slice(0, 5);
}

function describe(facts) {
  const page = usableDescription(facts.description);
  if (page) return page;
  const who = facts.tagline ? `${facts.name} — ${facts.tagline}` : facts.name;
  const kind = GENRE_WORD[facts.genre] || 'action';
  return facts.source ? `${who} is an original ${kind} game inspired by ${facts.source}.` : `${who} is an original ${kind} game.`;
}

function runClock(finalization) {
  const started = finalization?.metrics?.startedAt || finalization?.startedAt;
  const parsed = started ? new Date(started) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * @returns {{ action: 'import'|'skip'|'unchanged', reason: string, runId: string, packagedPath?: string, packagedName?: string, contentHash?: string, destination?: string, sourceDate?: string, dateBasis?: string, overrides?: object }}
 */
export function planMatrixRun(run) {
  const runId = String(run?.runId || '');
  const packagedPath = packagedGamePath(run?.files || []);
  if (!packagedPath) {
    return { action: 'skip', reason: 'no packaged game html', runId };
  }
  const pageText = String(run.pageText || '');
  const hash = run.contentHash || contentHash(pageText);
  const packagedName = packagedPath.slice(packagedPath.lastIndexOf('/') + 1);
  const preamble = preambleOf(pageText);
  const head = parseHead(pageText);
  const split = splitTitle(head.title);
  const name = split.name || fileToken(packagedName) || 'Untitled';
  const tagline = split.tagline || '';
  const packed = fromPackageName(packagedName);
  const requestedModel = run.finalization?.metrics?.requestedModel || run.finalization?.requestedModel || '';
  const requestedEffort = run.finalization?.metrics?.effort || run.finalization?.effort || '';
  const model = modelSlug(requestedModel) || modelSlug(modelFromLine(labeled(preamble, 'Model'))) || modelSlug(packed.model);
  const effort = effortSlug(requestedEffort) || effortSlug(effortFromLine(labeled(preamble, 'Model'))) || effortSlug(packed.effort);
  // sourceGame, then a Source note, then the classic in the packaged filename.
  // A model-doc sourceUrl is never the inspiration.
  const source = namedInspiration(sourceGameOf(pageText))
    || sourceTitle(labeled(preamble, 'Source'))
    || classicFromPackage(packagedName, name, tagline);
  const started = runClock(run.finalization);
  const noted = parseSourceClock(labeled(preamble, 'Date'));
  const modified = run.modifiedAt ? new Date(run.modifiedAt) : null;
  let when = null;
  let dateBasis = '';
  if (started) {
    when = started;
    dateBasis = 'run startedAt';
  } else if (noted) {
    when = noted;
    dateBasis = 'page source notes';
  } else if (modified && Number.isFinite(modified.getTime())) {
    when = modified;
    dateBasis = 'source file modification time';
  }
  if (!when) {
    return { action: 'skip', reason: 'no per-run time', runId, packagedPath, packagedName, contentHash: hash };
  }
  const genre = genreFor(source);
  const series = seriesFor(source);
  const controls = controlsOf(pageText);
  const facts = { name, tagline, description: head.description, source, genre };
  const overrides = {
    name,
    ...(tagline ? { tagline } : {}),
    description: describe(facts),
    type: 'Game',
    genre,
    ...(source ? { source } : {}),
    ...(series ? { series } : {}),
    ...(displayModel(model) ? { model: displayModel(model) } : {}),
    ...(effort ? { effort } : {}),
    ...(controls ? { controls } : {}),
    tags: tagsFor(source, `${preamble}\n${pageText.slice(0, 8000)}`),
  };
  return {
    action: 'import',
    reason: 'packaged workspace html',
    runId,
    packagedPath,
    packagedName,
    contentHash: hash,
    destination: destinationName({ name, tagline, source, model, effort, when }),
    sourceDate: when.toISOString(),
    dateBasis,
    overrides,
  };
}

/**
 * Apply duplicate detection and clash suffixes. Two runs that packaged the
 * same filename with different bytes stay two entries; the scan numbers their
 * names apart (scripts/lib/names.mjs).
 * `installed` entries are `{ sha256, destination }` for pages already on the wall.
 */
export function finalizeMatrixPlans(plans, installed = []) {
  const byHash = new Map();
  for (const entry of installed) {
    if (entry?.sha256 && entry.destination && !byHash.has(entry.sha256)) byHash.set(entry.sha256, entry.destination);
  }
  const usedDestinations = new Set();
  const finished = [];
  for (const plan of plans) {
    if (plan.action !== 'import') {
      finished.push(plan);
      continue;
    }
    const existing = byHash.get(plan.contentHash);
    if (existing) {
      finished.push({
        ...plan,
        action: 'unchanged',
        reason: 'byte-identical to an installed game',
        destination: existing,
        overrides: undefined,
      });
      continue;
    }
    let destination = plan.destination;
    if (usedDestinations.has(destination.toLowerCase())) {
      const stem = destination.replace(/\.html?$/i, '');
      let n = 2;
      while (usedDestinations.has(`${stem}-${n}.html`.toLowerCase())) n += 1;
      destination = `${stem}-${n}.html`;
    }
    usedDestinations.add(destination.toLowerCase());
    byHash.set(plan.contentHash, destination);
    finished.push({
      ...plan,
      destination,
      ...(destination !== plan.destination ? { renamed: true } : {}),
    });
  }
  return finished;
}

export function planMatrixBatch(runs, { installed = [] } = {}) {
  return finalizeMatrixPlans((runs || []).map((run) => planMatrixRun(run)), installed);
}
