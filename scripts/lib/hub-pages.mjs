/**
 * Decide which cc-hub and gpt-hub pages are new games, and the catalogue
 * name for each one. No I/O: callers pass the path, the page text, and the
 * hashes already on the wall.
 *
 * A new file is named GameTitle-SOURCE-model-effort-YYYYMMDD-HHMM.html.
 * An explicit date in the filename or the source notes is kept. A missing
 * time uses the source file's modification time in America/Vancouver and is
 * not a claimed generation time. Templates, shells, tests, probes, and
 * build-tree copies of a page already imported are not games.
 */

import { parseHead, splitTitle } from './parse.mjs';
import {
  controlsOf,
  destinationName,
  displayModel,
  effortSlug,
  filenameStamp,
  genreFor,
  modelSlug,
  parseSourceClock,
  seriesFor,
  sourceTitle,
  tagsFor,
} from './matrix-runs.mjs';

const REJECTED = /(^|\/)([^/]*\b(?:template|shell|probe)\b[^/]*|[^/]*\.test\.html|[^/]*-test\.html|[^/]*\.probe\.html)$/i;
const FILE_TAIL = /-(gpt-6\.1-sol|gpt-6-astra|gpt-6-sol|gpt-6|claude-[a-z0-9.]+|gemini-[a-z0-9.]+|grok-[a-z0-9.]+|muse-[a-z0-9.]+)(?:-(max-ultra|xhigh|ultra|high|medium|low|max))?-(\d{8})(?:-(\d{4}))?\.html$/i;
const DATE_TAIL = /-(\d{8})(?:-(\d{4}))?\.html$/i;
const CLOCK = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/;

const EXTRA_GENRE = [
  [/batman|arkham/i, 'Action'],
  [/tony hawk|pro skater|\bthps\b/i, 'Sports'],
  [/metal gear/i, 'Stealth'],
  [/wave race|stunt race|wipeout|f-zero|mario kart/i, 'Racing'],
  [/harvest moon|animal crossing/i, 'Life Sim'],
  [/eye of the beholder|dungeon/i, 'RPG'],
];

function basename(file) {
  const text = String(file || '').split(/[/\\]/).pop();
  return text || '';
}

function labeled(text, name) {
  const match = String(text || '').slice(0, 16000).match(new RegExp(`(?:^|\\n|\\s)${name}\\s*:\\s*([^\\n<]{1,300})`, 'i'));
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function modelFromLine(line) {
  const match = String(line || '').match(/gpt-6\.1-sol|gpt-6-astra|gpt-6-sol|gpt-6|claude-[a-z0-9.-]+|grok-[a-z0-9.-]+|gemini-[a-z0-9.-]+|muse-[a-z0-9.-]+/i);
  return match ? match[0] : '';
}

function effortFromLine(line) {
  const text = String(line || '');
  const match = text.match(/\b(max-ultra|xhigh|ultra|high|medium|low|max)\b/i);
  return match ? match[1] : '';
}

function stampFromDigits(date, time) {
  if (!/^\d{8}$/.test(date || '')) return null;
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);
  const clock = /^\d{4}$/.test(time || '') ? ` ${time.slice(0, 2)}:${time.slice(2)}` : '';
  return parseSourceClock(`${year}-${month}-${day}${clock}`);
}

function mtimeParts(modifiedAt) {
  const date = modifiedAt ? new Date(modifiedAt) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  return { date, stamp: filenameStamp(date) };
}

function usableDescription(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length < 20 || value.length > 500) return '';
  if (/[{};]|=>|\bfunction\b|\bconst\b/.test(value)) return '';
  return value;
}

function describe(facts) {
  const page = usableDescription(facts.description);
  if (page) return page;
  const who = facts.tagline ? `${facts.name} — ${facts.tagline}` : facts.name;
  const kind = {
    Shooter: 'shooter', Action: 'action', Racing: 'racing', RPG: 'role-playing',
    Strategy: 'strategy', Flight: 'flight', Platformer: 'platformer', Sports: 'sports',
    Stealth: 'stealth', Horror: 'horror', 'Life Sim': 'life simulation', Puzzle: 'puzzle',
  }[facts.genre] || 'action';
  return facts.source ? `${who} is an original ${kind} game inspired by ${facts.source}.` : `${who} is an original ${kind} game.`;
}

function genreOf(source, fileName) {
  const named = genreFor(source);
  if (named !== 'Action') return named;
  const blob = `${source || ''} ${fileName || ''}`;
  for (const [pattern, genre] of EXTRA_GENRE) if (pattern.test(blob)) return genre;
  return named;
}

function destinationExists(record, installed) {
  const wanted = String(record?.destination || '').split(/[/\\]/).pop();
  if (!wanted) return false;
  return (installed || []).some((entry) => String(entry.destination || '').endsWith(wanted));
}

function intakeFor(sourcePath, intake) {
  const name = basename(sourcePath);
  return (intake || []).find((row) => row.sourceFile === name || String(sourcePath).endsWith(`/${row.sourceFile}`)) || null;
}

/**
 * @returns {{ action: 'import'|'unchanged'|'skip', reason: string, sourcePath: string, sha256?: string, destination?: string, sourceDate?: string, dateBasis?: string, timeBasis?: string, overrides?: object }}
 */
export function planHubPage(input) {
  const sourcePath = String(input?.sourcePath || '');
  const sha = String(input?.sha256 || '');
  const installed = input?.installed || [];
  const intake = input?.intake || [];
  if (REJECTED.test(sourcePath) || /\b(?:template|shell|probe)\b/i.test(basename(sourcePath))) {
    return { action: 'skip', reason: 'template, shell, test, or probe', sourcePath };
  }
  const sameBytes = installed.find((entry) => entry.sha256 && entry.sha256 === sha);
  if (sameBytes) {
    return { action: 'unchanged', reason: 'byte-identical to an installed game', sourcePath, sha256: sha, destination: sameBytes.destination };
  }
  const record = intakeFor(sourcePath, intake);
  if (record && sha && sha === record.sourceSha256 && destinationExists(record, installed)) {
    return { action: 'unchanged', reason: 'recorded by the 2026-10-19 intake', sourcePath, sha256: sha, destination: record.destination };
  }
  const copied = intake.find((row) => row.sourceSha256 && row.sourceSha256 === sha && destinationExists(row, installed));
  if (copied) {
    return { action: 'skip', reason: 'build-tree copy of an already imported page', sourcePath, sha256: sha, destination: copied.destination };
  }

  const pageText = String(input?.pageText || '');
  const fileName = basename(sourcePath);
  const head = parseHead(pageText);
  const split = splitTitle(head.title);
  const notedTitle = labeled(pageText, 'Title');
  const name = (split.name && !/^index$/i.test(split.name) ? split.name : '') || notedTitle || fileName.replace(/\.html$/i, '');
  const tagline = split.tagline || '';
  const tail = fileName.match(FILE_TAIL);
  const dateTail = fileName.match(DATE_TAIL);
  const model = modelSlug(tail?.[1]) || modelSlug(modelFromLine(labeled(pageText, 'Model') || labeled(pageText, 'Model and Effort Level')));
  const effort = effortSlug(tail?.[2]) || effortSlug(effortFromLine(labeled(pageText, 'Model') || labeled(pageText, 'Model and Effort Level') || labeled(pageText, 'Effort')));
  let source = sourceTitle(labeled(pageText, 'SOURCE') || labeled(pageText, 'Source') || labeled(pageText, 'Inspiration'));
  if (!source && /star\s*fox/i.test(fileName)) source = 'Star Fox 64';
  if (/cyberpunk\s*2077/i.test(source)) source = 'Cyberpunk 2077';
  const fileDate = tail?.[3] || dateTail?.[1] || '';
  const fileTime = tail?.[4] || dateTail?.[2] || '';
  const noted = parseSourceClock(labeled(pageText, 'Date') || labeled(pageText, "Today's Date and time") || labeled(pageText, 'Initial Date'));
  const notedStamp = noted ? filenameStamp(noted) : null;
  const modified = mtimeParts(input?.modifiedAt);
  const date = fileDate || notedStamp?.date || modified?.stamp.date || '';
  const notedTime = notedStamp && (!fileDate || notedStamp.date === fileDate) ? notedStamp.time : '';
  const time = fileTime || notedTime || modified?.stamp.time || '';
  const when = stampFromDigits(date, time || '0000');
  if (!when || !time) {
    return { action: 'skip', reason: 'no source date', sourcePath, sha256: sha };
  }
  let dateBasis = 'source file modification time';
  let timeBasis = 'source file modification time';
  if (fileDate) dateBasis = 'source filename';
  else if (notedStamp) dateBasis = 'page source notes';
  if (fileTime) timeBasis = 'source filename';
  else if (!fileDate && notedStamp?.time) timeBasis = 'page source notes';
  else timeBasis = 'source file modification time';
  const genre = genreOf(source, fileName);
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
    tags: tagsFor(source, pageText.slice(0, 8000)),
  };
  return {
    action: 'import',
    reason: 'new packaged page',
    sourcePath,
    sha256: sha,
    destination: destinationName({ name, tagline, source, model, effort, when }),
    sourceDate: when.toISOString(),
    dateBasis,
    timeBasis,
    overrides,
  };
}

/** Keep the first plan for a hash, and give a clashing destination a distinct name. */
export function settleHubPlans(plans, occupied = []) {
  const used = new Set((occupied || []).map((name) => String(name).split(/[/\\]/).pop().toLowerCase()));
  const seenHash = new Set();
  return plans.map((plan) => {
    if (plan.action !== 'import') return plan;
    if (plan.sha256 && seenHash.has(plan.sha256)) {
      return { ...plan, action: 'unchanged', reason: 'duplicate of another page in this batch', overrides: undefined };
    }
    if (plan.sha256) seenHash.add(plan.sha256);
    let destination = plan.destination;
    const stem = destination.replace(/\.html$/i, '');
    let n = 2;
    while (used.has(destination.toLowerCase())) {
      destination = `${stem}-${n}.html`;
      n += 1;
    }
    used.add(destination.toLowerCase());
    return destination === plan.destination ? plan : { ...plan, destination, renamed: true };
  });
}
