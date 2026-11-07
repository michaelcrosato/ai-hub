/**
 * lang.js — the hub in its players' languages, following lib/hub/languages.md
 * (AI Hub Languages v1), adapted for the hub.
 *
 * One language per page load, the first of: ?lang= (test languages too), the
 * player's choice from the Language menu (kept on this device), the browser's
 * languages, English. English lines are /assets/lang/en.js. A translation is
 * /assets/lang/<code>.json, fetched before any module that imports this one
 * runs, so t() works anywhere, at the top of a module too.
 *
 * Critical (lib/hub/languages.md): a missing, empty or broken translation
 * shows the English line.
 */

import SOURCE from '../lang/en.js';

/** The languages the hub has, English first: one for each assets/lang/<code>.json. */
export const LANGUAGES = ['en'];
/** The test languages, chosen only by ?lang=. */
export const FAKE = ['en-XA', 'zh-XC', 'ar-XB'];
const RTL = /^(ar|fa|ur|he|ps|sd|ug|yi|ckb|dv)\b/i;
const KEY = 'ai-hub:lang';

const own = (o, k) => (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const usable = (v) =>
  (typeof v === 'string' && v !== '') ||
  (!!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.values(v).every((s) => typeof s === 'string'));
const valid = (code) => { try { return Intl.getCanonicalLocales(code).length === 1; } catch { return false; } };
const asked = () => { try { return new URLSearchParams(globalThis.location?.search || '').get('lang'); } catch { return null; } };
const saved = () => { try { return globalThis.localStorage?.getItem(KEY) || null; } catch { return null; } };

/** The language to show: ?lang=, then the saved choice, the browser's languages, English. */
export function pickLanguage(
  available,
  { asked: a = asked(), saved: s = saved(), browser = globalThis.navigator?.languages || [] } = {},
) {
  if (FAKE.includes(a)) return a;
  const parts = (code) => { try { const l = new Intl.Locale(code).maximize(); return [l.language, l.script]; } catch { return []; } };
  for (const want of [a, s, ...browser].filter(Boolean)) {
    const [language, script] = parts(want);
    if (!language) continue;
    const hit = available.find((x) => x.toLowerCase() === want.toLowerCase())   // in full
      || available.find((x) => parts(x)[0] === language && parts(x)[1] === script) // same language and writing
      || available.find((x) => parts(x)[0] === language);                         // same language
    if (hit) return hit;
  }
  return SOURCE.language;
}

export const lang = pickLanguage(LANGUAGES);
export const dir = RTL.test(lang) ? 'rtl' : 'ltr';
if (globalThis.document) {
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;   // the hub's layout is built to mirror
}
const table = await load(lang);

async function load(code) {
  if (code === SOURCE.language || FAKE.includes(code) || !globalThis.document) return {};
  try {
    const res = await fetch(new URL(`../lang/${code}.json`, import.meta.url));
    const data = res.ok ? await res.json() : null;
    const lines = own(data, 'lines');
    return lines && typeof lines === 'object' ? lines : {};
  } catch {
    return {};
  }
}

/** The language a game opens in: ?lang= (test languages too), the menu's choice, the browser's first language. */
export function gameLanguage() {
  return [asked(), saved(), globalThis.navigator?.languages?.[0], lang].find((code) => code && valid(code));
}

/**
 * A game's address with the player's language: the hub adds ?lang= every
 * time it opens or links to a game, sessions included (lib/hub/languages.md).
 */
export function withLanguage(address) {
  const code = gameLanguage();
  const [path, hash] = String(address).split('#');
  if (!code || /[?&]lang=/.test(path)) return address;
  return `${path}${path.includes('?') ? '&' : '?'}lang=${encodeURIComponent(code)}${hash === undefined ? '' : `#${hash}`}`;
}

/** For the Language menu: a language's name in that language. */
export function languageName(code) {
  let name = code;
  try { name = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code; } catch {}
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}

/** The Language menu's choice: kept on this device, then the page loads again in it. */
export function chooseLanguage(code) {
  try { localStorage.setItem(KEY, code); } catch {}
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
    location.replace(url);
  } else {
    location.reload();
  }
}

/** True when en.js has this line. */
export const has = (id) => usable(own(SOURCE.lines, id));

/**
 * A line in the player's language, its {blanks} filled from `values`. A line
 * with plural forms picks one by {count}; "zero" is the line for exactly none.
 * A missing, empty or broken translation shows the English line.
 */
export function t(id, values = {}) {
  const translated = usable(own(table, id));
  const textLang = translated ? lang : SOURCE.language;   // the language the line's text is in
  let line = translated ? own(table, id) : own(SOURCE.lines, id);
  if (!usable(line)) return id;
  if (typeof line === 'object') {
    const n = Number(values.count ?? 0);
    line = (n === 0 && line.zero) || line[plural(textLang, n)] || line.other || Object.values(line)[0];
  }
  if (FAKE.includes(lang)) line = fake(line, own(SOURCE.max, id));
  line = line.replace(/\{(\w+)\}/g, (tag, name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) return tag;
    const v = values[name];
    const text = typeof v === 'number' ? number(v, undefined, textLang) : String(v);
    return dir === 'rtl' ? '\u2068' + text + '\u2069' : text;   // isolated, so a Latin name or a number can't scramble the line
  });
  if (!translated && !FAKE.includes(lang) && dir === 'rtl') line = '\u2068' + line + '\u2069';
  return line;
}

/**
 * t() for a sentence with elements in it: values that are DOM nodes go in
 * where their {blank} is. Returns children for h(): strings and nodes.
 */
export function tx(id, values = {}) {
  const isNode = (v) => typeof Node !== 'undefined' && v instanceof Node;
  const text = {};
  for (const [k, v] of Object.entries(values)) if (!isNode(v)) text[k] = v;
  return t(id, text)
    .split(/(\{\w+\})/)
    .flatMap((part, i) => {
      const node = i % 2 ? own(values, part.slice(1, -1)) : undefined;
      if (!isNode(node)) return part ? [part] : [];
      return dir === 'rtl' ? ['\u2068', node, '\u2069'] : [node];
    });
}

/** HTML in a page gets its lines: data-line for the text, data-line-title and the like for attributes. */
const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt', 'content'];
export function fillPage(root = document) {
  for (const el of root.querySelectorAll('[data-line]')) el.textContent = t(el.dataset.line);
  for (const name of ATTRIBUTES) {
    for (const el of root.querySelectorAll(`[data-line-${name}]`)) el.setAttribute(name, t(el.getAttribute(`data-line-${name}`)));
  }
}

// Formats in the chosen language. Each Intl object is made once.
const made = new Map();
const intl = (Kind, options, code = lang) => {
  const key = `${Kind.name}|${code}|${JSON.stringify(options ?? {})}`;
  if (!made.has(key)) made.set(key, new Kind(code, options));
  return made.get(key);
};
const plural = (code, n) => intl(Intl.PluralRules, undefined, code).select(n);

/** 12,500 · 12.500 · 12 500, as the language writes it. */
export const number = (n, options, code = lang) => intl(Intl.NumberFormat, options, code).format(n);
/** A date or time; `when` is a Date, a time in ms, or an ISO string. */
export const date = (when, options) => intl(Intl.DateTimeFormat, options).format(typeof when === 'string' ? Date.parse(when) : when);
/** "3 days ago", "yesterday". */
export const ago = (value, unit, options = { numeric: 'auto' }) => intl(Intl.RelativeTimeFormat, options).format(value, unit);
/** "A, B and C" (type 'conjunction') or "A, B or C" ('disjunction'). */
export const list = (items, type = 'conjunction') => intl(Intl.ListFormat, { type }).format(items);
/** For sort(): names in the language's order. */
export const compare = (a, b) => intl(Intl.Collator).compare(a, b);
/** Capitals as the language writes them (Turkish i is İ). */
export const upper = (text) => String(text).toLocaleUpperCase(lang);
/** "3 h 5 min"; `parts` as for Intl.DurationFormat: { hours, minutes, seconds }. */
export function duration(parts, style = 'narrow') {
  if (typeof Intl.DurationFormat === 'function') return intl(Intl.DurationFormat, { style }).format(parts);
  return Object.entries(parts).filter(([, n]) => n).map(([unit, n]) => number(n, { style: 'unit', unit: unit.replace(/s$/, ''), unitDisplay: style })).join(' ');
}
/** 512 B, 40 kB, 1.5 MB in the language's own units. */
export function bytes(n) {
  if (!n) return '';
  const [value, unit] = n < 1024 ? [n, 'byte'] : n < 1024 * 1024 ? [Math.round(n / 1024), 'kilobyte'] : [n / (1024 * 1024), 'megabyte'];
  const digits = unit === 'megabyte' && value < 10 ? 1 : 0;
  return number(value, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** A line's width for max: whole letters, a Chinese, Japanese or Korean character counting two; tags count nothing. */
export function width(line) {
  const text = String(line).replace(/\{[^{}]*\}/g, '');
  const letters = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment)
    : Array.from(text);
  return letters.reduce((n, g) => n + (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u.test(g) ? 2 : 1), 0);
}

/** A test language made from a line before its blanks are filled (lib/hub/languages.md, "Testing"). */
export function fake(line, max, code = lang) {
  const HAN = '的一是不了人我在有他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对';
  const ARABIC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
  const ACCENT = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', n: 'ñ', c: 'ç', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', N: 'Ñ' };
  const out = line.split(/(\{[^{}]*\})/).map((part, i) => {
    if (i % 2) return part;   // a tag stays as it is
    if (code === 'zh-XC') return part
      .replace(/[\p{L}\p{M}]+/gu, (w) => Array.from({ length: Math.ceil([...w].length / 2) }, (_, k) => HAN[(w.codePointAt(k) * 7 + k) % HAN.length]).join(''))
      .replace(/[,.!?:;]/g, (p) => '，。！？：；'[',.!?:;'.indexOf(p)]).replace(/[ \t]+/g, '');
    if (code === 'ar-XB') return part.replace(/\p{L}\p{M}*/gu, (c) => ARABIC[c.codePointAt(0) % ARABIC.length]);
    return part.replace(/[aeiounc]/gi, (c) => ACCENT[c] || c);
  }).join('');
  if (code !== 'en-XA') return out;
  if (max) return '[' + out + '·'.repeat(Math.max(0, max - width(out) - 2)) + ']';   // exactly max wide
  return out.split('\n').map((p) => '[' + p + ' ' + '·'.repeat(Math.ceil(width(p) * 0.4)) + ']').join('\n');
}
