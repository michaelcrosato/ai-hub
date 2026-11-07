import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// lib/hub/languages.md hands agents its example code and two JSON blocks to copy, so the
// tests run the code exactly as the page prints it.
const page = await readFile(new URL('../lib/hub/languages.md', import.meta.url), 'utf8');
const code = page.match(/```js\n([\s\S]*?)```/)[1];

const SOURCE = {
  version: 1,
  language: 'en',
  lines: {
    'menu.start': 'Start',
    'hud.lives': { zero: 'No lives left', one: '{count} life left', other: '{count} lives left' },
    'pip.relay': '{c=#ffd36a}{player}{/c}, the relay is dark. Stay on my wing.',
    score: 'Score {points}',
    'jump.help': 'Press {key:jump} to jump',
    constructor: 'Build',
    story: 'First paragraph here.\nSecond one.',
    'hud.hp': 'HP',
    year: 'Year {year}',
  },
  max: { 'hud.hp': 4, 'menu.start': 12 },
};
const TRANSLATIONS = {
  'es-419': { by: 'test', lines: { 'menu.start': 'Empezar', 'hud.lives': { zero: 'Sin vidas', one: 'Te queda {count} vida', other: 'Te quedan {count} vidas' } } },
  'zh-Hans': { by: 'test', lines: { 'menu.start': '开始' } },
  'zh-Hant': { by: 'test', lines: { 'menu.start': '開始' } },
  ar: { by: 'test', lines: { 'hud.lives': { zero: 'لا أرواح', one: 'روح واحدة', two: 'روحان', few: '{count} أرواح', many: '{count} روحًا', other: '{count} روح' }, 'pip.relay': '{c=#ffd36a}{player}{/c}، المرحّل مظلم.' } },
  ru: { by: 'test', names: { Pip: 'Пип' }, lines: { score: 'Счёт {points}', 'menu.start': 5, year: '' } },
};
const ISOLATE = (s) => '⁨' + s + '⁩';

/** The example running in a page with the given address, browser languages, storage and blocks. */
function game({ search = '', langs = ['en-US'], saved = null, source = SOURCE, translations = TRANSLATIONS, raw = {}, blockedStorage = false, segmenter = true, elements = [] } = {}) {
  const html = { lang: '' };
  const stored = {};
  const intl = segmenter ? Intl : Object.assign(Object.create(Intl), { Segmenter: undefined });
  const context = {
    document: {
      getElementById: (id) => {
        if (id in raw) return { textContent: raw[id] };
        if (id === 'game-lines') return { textContent: JSON.stringify(source) };
        if (id === 'game-translations' && translations) return { textContent: JSON.stringify(translations) };
        return null;
      },
      documentElement: html,
      querySelectorAll: () => elements,
    },
    location: { pathname: '/games/Star-Lynx.html', search, reload: () => { context.reloaded = true; } },
    navigator: { languages: langs },
    localStorage: {
      getItem: () => { if (blockedStorage) throw new Error('blocked'); return saved; },
      setItem: (key, value) => { if (blockedStorage) throw new Error('blocked'); stored[key] = value; },
    },
    URLSearchParams, Intl: intl, JSON, Array, Object, Math, String,
  };
  vm.createContext(context);
  vm.runInContext(`${code}\n;globalThis.api = { t, pieces, width, languageName, chooseLanguage, fillPage, lang, dir, setLabel: (f) => { controlLabel = f; } };`, context);
  return { ...context.api, html, stored, context };
}

test('the page\'s JSON blocks parse', () => {
  const blocks = [...page.matchAll(/```html\n<script type="application\/json" id="([\w-]+)">\n([\s\S]*?)<\/script>\n```/g)];
  assert.deepEqual(blocks.map((b) => b[1]), ['game-lines', 'game-translations']);
  for (const [, , json] of blocks) assert.doesNotThrow(() => JSON.parse(json));
});

test('a missing, broken, empty or odd translation shows the original line (Critical)', () => {
  assert.equal(game({ translations: null, langs: ['es-MX'] }).t('menu.start'), 'Start');
  const broken = game({ raw: { 'game-translations': '{"es-419": {"lines": ' }, langs: ['es-MX'] });
  assert.equal(broken.lang, 'en');
  const ru = game({ langs: ['ru'] });
  assert.equal(ru.t('menu.start'), 'Start', 'a number in place of text');
  assert.equal(ru.t('year', { year: '1200' }), 'Year 1200', 'an empty line');
  assert.equal(ru.t('constructor'), 'Build', 'an id that names an object property');
  assert.equal(game({ langs: ['ru'], translations: { ru: { lines: { 'hud.lives': { one: 5 } } } } }).t('hud.lives', { count: 3 }), '3 lives left');
});

test('plural forms follow the language the text is in, and zero is the line for none', () => {
  const ru = game({ langs: ['ru'] });
  assert.equal(ru.t('hud.lives', { count: 21 }), '21 lives left');
  assert.equal(ru.t('hud.lives', { count: 0 }), 'No lives left');
  const es = game({ langs: ['es-MX'] });
  assert.equal(es.lang, 'es-419');
  assert.equal(es.t('hud.lives', { count: 0 }), 'Sin vidas');
  assert.equal(es.t('hud.lives', { count: 1 }), 'Te queda 1 vida');
  const ar = game({ search: '?lang=ar' });
  assert.equal(ar.t('hud.lives', { count: 2 }), 'روحان');
  assert.equal(ar.t('hud.lives', { count: 11 }), ISOLATE('11') + ' روحًا');
});

test('a language matches in full, then by writing system, then by language', () => {
  assert.equal(game({ langs: ['zh-TW'] }).lang, 'zh-Hant');
  assert.equal(game({ langs: ['zh-CN'] }).lang, 'zh-Hans');
  assert.equal(game({ langs: ['zh-HK'], translations: { 'zh-Hans': TRANSLATIONS['zh-Hans'] } }).lang, 'zh-Hans');
  assert.equal(game({ langs: ['pt-PT'], translations: { 'pt-BR': { lines: {} } } }).lang, 'pt-BR');
  assert.equal(game({ search: '?lang=x-long', langs: ['fr'] }).lang, 'en');
  assert.equal(game({ saved: 'ru', langs: ['es-MX'] }).lang, 'ru');
  assert.equal(game({ blockedStorage: true, langs: ['pt-BR'] }).lang, 'en');
  assert.equal(game({ langs: ['ar-EG'], translations: null }).lang, 'en', 'a browser never lands in a test language');
});

test('the Language menu saves the choice, restarts, and names each language in its own language', () => {
  const g = game();
  g.chooseLanguage('es-419');
  assert.equal(g.stored['lang:/games/Star-Lynx.html'], 'es-419');
  assert.equal(g.context.reloaded, true);
  assert.deepEqual(['es-419', 'zh-Hant', 'ru', 'am'].map(g.languageName), ['Español latinoamericano', '繁體中文', 'Русский', 'አማርኛ']);
});

test('blanks, controls and markup', () => {
  const g = game();
  g.setLabel((action) => (action === 'jump' ? 'Ⓐ' : '?'));
  assert.equal(g.t('jump.help'), 'Press Ⓐ to jump');
  assert.equal(g.t('year', { year: '1200' }), 'Year 1200');
  assert.equal(g.t('score', { points: 1200 }), 'Score 1,200');
  assert.equal(g.t('score'), 'Score {points}');
  assert.equal(g.t('pip.relay', { player: 'Lynx' }), '{c=#ffd36a}Lynx{/c}, the relay is dark. Stay on my wing.');
  assert.equal(game({ saved: 'ru' }).t('score', { points: 12500 }).replace(/\s/g, ' '), 'Счёт 12 500');
});

test('right to left: values isolated, original lines keep their direction, <html> keeps its dir', () => {
  const ar = game({ search: '?lang=ar' });
  assert.equal(ar.dir, 'rtl');
  assert.equal(ar.html.lang, 'ar');
  assert.equal(ar.html.dir, undefined);
  assert.equal(ar.t('pip.relay', { player: 'Lynx_1' }), '{c=#ffd36a}' + ISOLATE('Lynx_1') + '{/c}، المرحّل مظلم.');
  assert.equal(ar.t('menu.start'), ISOLATE('Start'));
});

test('HTML in the page gets its line', () => {
  const elements = [{ dataset: { line: 'menu.start' }, textContent: 'Start', dir: '' }];
  game({ langs: ['zh-TW'], elements }).fillPage();
  assert.equal(elements[0].textContent, '開始');
  assert.equal(elements[0].dir, 'ltr');
});

test('typewriter pieces: tags are single steps, built letters stay whole, Arabic goes by word', () => {
  const g = game();
  assert.deepEqual([...g.pieces('{c=#fff}Hi{/c}')], ['{c=#fff}', 'H', 'i', '{/c}']);
  assert.deepEqual([...g.pieces('क्षमा')], ['क्ष', 'मा']);
  assert.deepEqual([...g.pieces('hi👋🏽')], ['h', 'i', '👋🏽']);
  assert.deepEqual([...game({ search: '?lang=ar' }).pieces('روح {w=.5}واحدة')], ['روح', ' ', '{w=.5}', 'واحدة']);
  const old = game({ segmenter: false });
  assert.deepEqual([...old.pieces('{c=#fff}ab')], ['{c=#fff}', 'a', 'b']);
});

test('width counts whole letters, wide characters as two, tags as nothing', () => {
  const g = game();
  assert.equal(g.width('Start'), 5);
  assert.equal(g.width('开始'), 4);
  assert.equal(g.width('क्षमा'), 2);
  assert.equal(g.width('{count} lives'), 6);
});

test('test languages come from the game\'s own lines, before blanks are filled', () => {
  const xa = game({ search: '?lang=en-XA', langs: ['ar-EG'] });
  assert.equal(xa.lang, 'en-XA');
  const relay = xa.t('pip.relay', { player: 'Alice' });
  assert.ok(relay.startsWith('[{c=#ffd36a}Alice{/c}, thé réláy'), relay);
  assert.ok(relay.endsWith('·]'), relay);
  assert.ok(xa.t('story').split('\n').every((p) => p.startsWith('[') && p.endsWith('·]')));
  assert.equal(xa.t('hud.hp'), '[HP]');
  assert.equal(xa.width(xa.t('menu.start')), 12);

  const xc = game({ search: '?lang=zh-XC' }).t('pip.relay', { player: 'Lynx' });
  assert.ok(xc.startsWith('{c=#ffd36a}Lynx{/c}'), xc);
  assert.ok(!/[A-Za-z ]/.test(xc.replace(/\{[^}]*\}|Lynx/g, '')), xc);

  const hindi = { language: 'hi', lines: { 'menu.start': 'खेल शुरू करें' } };
  assert.match(game({ search: '?lang=zh-XC', source: hindi, translations: null }).t('menu.start'), /^[一-鿿]+$/);
  assert.match(game({ search: '?lang=ar-XB', source: hindi, translations: null }).t('menu.start'), /^[؀-ۿ ]+$/);

  const xb = game({ search: '?lang=ar-XB' });
  assert.equal(xb.dir, 'rtl');
  assert.match(xb.t('menu.start'), /^[؀-ۿ]+$/);
});

test('a block written with < as \\u003c reads back the same and cannot end its script element', () => {
  const data = { ar: { lines: { x: 'before </script><b>after' } } };
  const written = JSON.stringify(data).replace(/</g, '\\u003c');
  assert.ok(!written.includes('</'));
  assert.deepEqual(JSON.parse(written), data);
});
