// assets/js/lang.js and assets/lang/en.js: the language choice, the fallback,
// plural forms, isolates, the test languages, and en.js against the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { englishLines, usedLines, sourceProblems, checkTranslation } from './lib/languages.mjs';
import { readdirSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LANG = new URL('../assets/js/lang.js', import.meta.url).href;

/**
 * lang.js evaluated afresh in a page at `search`, with `respond` answering the
 * translation fetch. The copy lists the first set of languages, as the hub
 * will once their translations exist.
 */
const SET1 = ['en', 'zh-Hans', 'hi', 'es-419', 'ar', 'fr', 'bn', 'pt-BR', 'ru', 'id'];
const original = readFileSync(new URL(LANG), 'utf8');
const copy = original
  .replace("import SOURCE from '../lang/en.js';", `import SOURCE from ${JSON.stringify(new URL('../assets/lang/en.js', import.meta.url).href)};`)
  .replace(/export const LANGUAGES = \[[^\]]*\];/, `export const LANGUAGES = ${JSON.stringify(SET1)};`);
assert.ok(copy.includes('assets/lang/en.js') && copy.includes('"pt-BR"'), 'lang.js still imports en.js and lists LANGUAGES the way this test expects');
const DIR = mkdtempSync(join(tmpdir(), 'hub-lang-'));
let fresh = 0;
async function page(search, respond = () => ({ ok: false }), { saved = null } = {}) {
  const fetched = [];
  const html = { lang: '', dir: '' };
  globalThis.document = { documentElement: html };
  globalThis.location = { search, href: `http://hub.test/${search}` };
  globalThis.localStorage = { getItem: () => saved, setItem() {} };
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    const r = respond(String(url));
    return { ok: r.ok !== false, json: async () => (typeof r.body === 'function' ? r.body() : r.body) };
  };
  try {
    const file = join(DIR, `lang-${++fresh}.mjs`);
    writeFileSync(file, copy);
    const mod = await import(pathToFileURL(file).href);
    return { ...mod, fetched, html };
  } finally {
    delete globalThis.document;
    delete globalThis.location;
    delete globalThis.localStorage;
    delete globalThis.fetch;
  }
}
const translation = (lines) => () => ({ body: { by: 'test', lines } });

test('without a page, the hub is in English and fetches nothing', async () => {
  const { lang, dir, t } = await import(`${LANG}?page=node`);
  assert.equal(lang, 'en');
  assert.equal(dir, 'ltr');
  assert.equal(t('lang.menu'), 'Language');
  assert.equal(t('no.such.line'), 'no.such.line');
});

test('?lang= picks a translation, fetched from assets/lang', async () => {
  const p = await page('?lang=fr', translation({ 'lang.menu': 'Langue' }));
  assert.equal(p.lang, 'fr');
  assert.equal(p.html.lang, 'fr');
  assert.match(p.fetched[0], /\/lang\/fr\.json$/);
  assert.equal(p.t('lang.menu'), 'Langue');
});

test('Critical: a missing, empty, broken or unreadable translation shows the English line', async () => {
  const p = await page('?lang=fr', translation({ 'lang.menu': '', 'lang.test': 42, 'lang.menu_hint': { one: 7 } }));
  assert.equal(p.t('lang.menu'), 'Language');
  assert.equal(p.t('lang.test'), 'Test language');
  assert.equal(p.t('lang.menu_hint'), 'Show the hub in another language');
  for (const respond of [() => ({ ok: false }), () => ({ body: () => { throw new SyntaxError('bad json'); } }), () => ({ body: null }), () => ({ body: { lines: 'nope' } })]) {
    const q = await page('?lang=fr', respond);
    assert.equal(q.t('lang.menu'), 'Language');
  }
});

test('plural forms follow the language of the text shown, and zero is the line for none', async () => {
  const forms = { zero: 'нет', one: '{count} строка', few: '{count} строки', many: '{count} строк', other: '{count} строки' };
  const p = await page('?lang=ru', translation({ 'lang.menu': forms }));
  assert.equal(p.t('lang.menu', { count: 0 }), 'нет');
  assert.equal(p.t('lang.menu', { count: 1 }), '1 строка');
  assert.equal(p.t('lang.menu', { count: 3 }), '3 строки');
  assert.equal(p.t('lang.menu', { count: 5 }), '5 строк');
  assert.equal(p.t('lang.menu', { count: 21 }), '21 строка');
  assert.equal(p.t('lang.menu', { count: 1235 }), '1\u00a0235 строк');
});

test('right to left: the page mirrors, filled values and English fallbacks are isolated', async () => {
  const p = await page('?lang=ar', translation({ 'lang.menu': 'اللغة {name}' }));
  assert.equal(p.dir, 'rtl');
  assert.equal(p.html.dir, 'rtl');
  assert.equal(p.t('lang.menu', { name: 'Pip' }), 'اللغة \u2068Pip\u2069');
  assert.equal(p.t('lang.test'), '\u2068Test language\u2069');
});

test('the test languages come from the address only, and fetch nothing', async () => {
  const xa = await page('?lang=en-XA');
  assert.equal(xa.lang, 'en-XA');
  assert.deepEqual(xa.fetched, []);
  assert.match(xa.t('lang.menu'), /^\[Lá.*\]$/);
  assert.equal(xa.width(xa.t('lang.menu')), 14, 'a line with max is exactly that wide');
  const xb = await page('?lang=ar-XB');
  assert.equal(xb.dir, 'rtl');
  assert.match(xb.t('lang.test'), /^[؀-ۿ ]+$/);
  const xc = await page('?lang=zh-XC');
  assert.match(xc.t('lang.test'), /^\p{Script=Han}+$/u);
  const saved = await page('', () => ({ ok: false }), { saved: 'en-XA' });
  assert.equal(saved.lang, 'en', 'a saved test language is not a choice');
});

test('matching: in full, then the same language and writing, then the same language', async () => {
  const { pickLanguage } = await import(`${LANG}?page=node`);
  const pick = (browser, extra = {}) => pickLanguage(SET1, { asked: null, saved: null, browser, ...extra });
  assert.equal(pick(['es-MX']), 'es-419');
  assert.equal(pick(['pt-PT']), 'pt-BR');
  assert.equal(pick(['zh-TW']), 'zh-Hans', 'the hub has only Simplified Chinese');
  assert.equal(pick(['zh-CN']), 'zh-Hans');
  assert.equal(pick(['fr-CA', 'en']), 'fr');
  assert.equal(pick(['de-DE', 'ru']), 'ru', 'a language the hub lacks is passed over');
  assert.equal(pick(['x-long!!', 'hi-IN']), 'hi', 'a broken code is passed over');
  assert.equal(pick(['ja']), 'en');
  assert.equal(pick(['fr'], { saved: 'bn' }), 'bn', 'the saved choice comes before the browser');
  assert.equal(pick(['fr'], { saved: 'bn', asked: 'id' }), 'id', 'the address comes first');
});

test('formats follow the language', async () => {
  const { number, bytes, duration, list, compare, languageName } = await import(`${LANG}?page=node`);
  assert.equal(number(12500), '12,500');
  assert.equal(bytes(40 * 1024), '40 kB');
  assert.equal(bytes(1.5 * 1024 * 1024), '1.5 MB');
  assert.equal(duration({ hours: 3, minutes: 5 }), '3h 5m');
  assert.equal(list(['A', 'B', 'C']), 'A, B, and C');
  assert.deepEqual(['b', 'a', 'C'].sort(compare), ['a', 'b', 'C']);
  assert.equal(languageName('es-419'), 'Español latinoamericano');
  assert.equal(languageName('zh-Hans'), '简体中文');
});

test('tx puts elements where their blanks are, isolated in right-to-left languages', async () => {
  class Node {}
  globalThis.Node = Node;
  try {
    const link = new Node();
    const fr = await page('?lang=fr', translation({ 'lang.menu': 'Voir {name} ou {count}' }));
    assert.deepEqual(fr.tx('lang.menu', { name: link, count: 2 }), ['Voir ', link, ' ou 2']);
    const ar = await page('?lang=ar', translation({ 'lang.menu': 'انظر {name}' }));
    assert.deepEqual(ar.tx('lang.menu', { name: link }), ['انظر ', '\u2068', link, '\u2069']);
  } finally {
    delete globalThis.Node;
  }
});

test('en.js is well formed', async () => {
  assert.deepEqual(sourceProblems(await englishLines(ROOT)), []);
});

test('every line the code uses is in en.js, and every line in en.js is used', async () => {
  const source = await englishLines(ROOT);
  const { used } = usedLines(ROOT);
  const missing = [...used].filter(([id]) => !(id in source.lines)).map(([id, where]) => `${id} (${where[0]})`);
  assert.deepEqual(missing, [], 'lines the code uses that en.js lacks');
  const unused = Object.keys(source.lines).filter((id) => !used.has(id));
  assert.deepEqual(unused, [], 'lines in en.js nothing uses');
});

test('the checks block a changed tag, missing plural forms and a lost {count}, and flag the rest', () => {
  const source = {
    names: ['AI Hub'],
    lines: {
      'a.open': 'Open {game}',
      'a.count': { one: '{count} game', other: '{count} games' },
      'a.none': { zero: 'No games', one: '{count} game', other: '{count} games' },
      'a.hub': 'Welcome to AI Hub',
    },
    max: { 'a.open': 10 },
  };
  const ru = checkTranslation(source, 'ru', {
    'a.open': 'Открыть {gam}',
    'a.count': { one: 'Одна игра', few: '{count} игры', many: '{count} игр', other: '{count} игры' },
    'a.none': { one: '{count} игра', few: '{count} игры', many: '{count} игр', other: '{count} игры' },
    'a.hub': 'Добро пожаловать в Эй-Ай Хаб',
  });
  assert.deepEqual([...ru.bad].sort(), ['a.count', 'a.none', 'a.open'], 'a changed tag; Russian "one" is also 21, so it keeps {count}; the original has "zero"');
  assert.ok(ru.flags.some((f) => f.startsWith('a.hub: AI Hub')), 'a name not as written is flagged');
  const ar = checkTranslation(source, 'ar', {
    'a.count': { zero: 'لا ألعاب', one: 'لعبة واحدة', two: 'لعبتان', few: '{count} ألعاب', many: '{count} لعبة', other: '{count} لعبة' },
  });
  assert.deepEqual([...ar.bad], [], 'Arabic zero, one and two only ever mean one number');
  assert.ok(ar.flags.some((f) => f.startsWith('a.open: missing')), 'a missing line is flagged, not blocked');
  const fr = checkTranslation(source, 'fr', { 'a.open': 'Ouvrir le jeu {game}', 'a.hub': 'Bienvenue sur AI Hub', 'a.count': { one: '{count} jeu', many: '{count} de jeux', other: '{count} jeux' } });
  assert.deepEqual([...fr.bad], []);
  assert.ok(fr.flags.some((f) => f.includes('max 10')), 'a label wider than its max is flagged');
});

test('each translation in assets/lang passes the checks, and LANGUAGES lists exactly those', async () => {
  const source = await englishLines(ROOT);
  const files = readdirSync(new URL('../assets/lang', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  const listed = JSON.parse(original.match(/export const LANGUAGES = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
  assert.deepEqual(listed.slice(1).sort(), files, 'LANGUAGES in lang.js lists English and each assets/lang/<code>.json');
  for (const code of files) {
    const data = JSON.parse(readFileSync(new URL(`../assets/lang/${code}.json`, import.meta.url), 'utf8'));
    assert.equal(typeof data.by, 'string', `${code}: "by" says who translated it`);
    const { blocking, flags } = checkTranslation(source, code, data.lines);
    assert.deepEqual(blocking, [], `${code}: lines that fail the checks`);
    if (flags.length) console.log(`${code}: ${flags.length} lines to look at, such as ${flags.slice(0, 3).join('; ')}`);
  }
});

test('each catalogue translation in data/lang is well formed and belongs to a listed language', () => {
  const dir = new URL('../data/lang/', import.meta.url);
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.json')); } catch {}
  const listed = JSON.parse(original.match(/export const LANGUAGES = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
  for (const file of files) {
    const code = file.slice(0, -5);
    assert.ok(listed.includes(code) && code !== 'en', `${code}: a catalogue translation for a language the hub lists`);
    const data = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    assert.equal(typeof data.by, 'string', `${code}: "by" says who translated it`);
    assert.ok(data.games && typeof data.games === 'object', `${code}: games`);
    for (const [slug, texts] of Object.entries(data.games)) {
      for (const [field, text] of Object.entries(texts)) {
        assert.ok(['description', 'controls', 'sessionGoal', 'sessionHowto', 'howto', 'goal'].includes(field), `${code}: ${slug}.${field} is a catalogue text`);
        assert.ok(typeof text === 'string' && text.trim(), `${code}: ${slug}.${field} is text`);
      }
    }
    for (const [kind, map] of Object.entries(data.terms || {})) {
      assert.ok(['genre', 'type', 'tag'].includes(kind), `${code}: terms.${kind}`);
      for (const text of Object.values(map)) assert.ok(typeof text === 'string' && text.trim(), `${code}: a ${kind} term is text`);
    }
  }
});
