# AI Hub Languages v1

A game that follows this page can be played in the player's own language.

- The game is built in one language, as now.
- Translation is a separate step after the game's text is final. It can be a
  later stage of the build pipeline, or the hub when the game joins the
  library. That step picks the model, and different models suit different
  languages.
- The translation goes into the game's page, in a block of its own, without
  changing the game's code.

The voices in these games are chirps rather than speech, so nothing is dubbed:
the chirps follow the translated text.

The page has two parts. *Building* is what a game does while it is made, so
that any translation step can work with it. *Translating* is how that step
works.

**https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/languages.md**

To ask a build agent for it, add this to the game's prompt:

> Make the game ready for translation. Follow
> https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/languages.md
> (AI Hub Languages v1). Don't translate unless this prompt asks for translations.

To ask an agent to translate a game:

> Translate this game into these languages: (codes). Follow *Translating* in
> https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/languages.md
> (AI Hub Languages v1).

Most of this page is guidance, written as problems and what to do about them:
use judgment where a game needs something different. Some things have one way,
which the page gives:
- the two blocks, where they go, and how they are written;
- the language codes;
- the tags;
- the order a language is chosen in;
- the test languages.

The two rules marked **Critical** are the ones where breaking them breaks a
game.

---

## In short

1. Keep the words players read in the `game-lines` block, each line under an id.
2. Write whole sentences with `{blanks}`, not sentences glued from pieces.
3. Show lines as text, and let text draw, wrap and run right to left in other
   writing systems.
4. Let the typewriter and the chirps follow the translated text.
5. Write the list of names and the translator's brief.
6. Test with the three test languages.
7. When a translation is missing or broken, show the original line
   (**Critical**).

---

# Building

## The line list

### Problem: words scattered through the code

A translator can't find words spread across thousands of lines of code, and a
script can't pull them out reliably.

**Do:** keep the words players read in one JSON block, with the id
`game-lines`.
- **Where:** in the page's `<head>`, after the session client if the game has
  one. A folder project puts it in the page that starts the game.
- **How:** write it into the HTML file itself, not with a script at run time,
  so that tools can read it without running the game.

```html
<script type="application/json" id="game-lines">
{
  "version": 1,
  "language": "en",
  "lines": {
    "menu.start": "Start",
    "hud.lives": { "zero": "No lives left", "one": "{count} life left", "other": "{count} lives left" },
    "pip.relay": "{player}, the relay is dark. Stay on my wing."
  },
  "notes": {
    "pip.relay": "Pip, the cheerful wingman, on the radio. {player} is the player's call sign."
  },
  "max": { "menu.start": 12 },
  "names": ["Pip", "Meridian", "Lynx"],
  "brief": "The translator's brief: see below."
}
</script>
```

| Field | What it holds |
|---|---|
| `version` | `1`, the version of this page the block follows |
| `language` | the game's own language, as a code from *Languages* |
| `lines` | the lines, each under its id |
| `notes` | context for a line that needs it: who speaks it, to whom, where it shows |
| `max` | for a line with little room, such as a button or a HUD label: its width, counted as below |
| `names` | the proper names of people, places and invented things, as written |
| `brief` | the translator's brief |
| `wordPlay` | `true` for a game whose play is the words themselves (see *Games built on words*) |

- **Ids** match `^[a-z0-9_]+(\.[a-z0-9_]+)*$` and say where the line is used:
  `menu.start`, `pip.relay`, `item.sword.name`. Keep an id once the game is
  published, because translations are filed under it.
- **A line** is plain text with `{tags}`, without HTML. Use `\n` between
  paragraphs and let the game wrap the rest.
- **Width, for `max`:** count whole letters, with a Chinese, Japanese or Korean
  character counting as two. Tags count nothing. `width()` in the example does
  this.
- **Writing a block:** in both blocks, write `<` as `<`. A line containing
  `</script>` would otherwise end the block early and spill into the page.
  `JSON.stringify(data).replace(/</g, '\\u003c')` does it.
- **What goes in:** menus, labels, help, dialogue, item names and
  descriptions, messages, endings.
- **What stays out:**
  - debug and console text, error codes, file names;
  - the word lists a game plays with;
  - anything players type, such as names and chat.
- **Developer text** that shows in the game, such as the About/Credits
  feedback cc-matrix asks for, goes under ids that start with `dev.`.
  Translation skips those.

### Problem: sentences glued from pieces

`"You have " + lives + " lives"` can't be translated. Other languages put the
number somewhere else, change the word next to it, or need a different
sentence.

**Do:** write one whole sentence per line, with named blanks in curly braces,
filled when the line is shown: `"{count} lives left"`.

**Plural forms:** a line where a number counts something, as in "3 lives",
gets plural forms.
- The forms are named as `Intl.PluralRules` names them: `one`, `two`, `few`,
  `many`, `other`. English needs `one` and `other`, and each translation adds
  the forms its language needs.
- `zero` can be added in any language, as the line for exactly none: "No lives
  left".
- The blank named `{count}` picks the form.
- A line that only shows a number, such as "Wave {wave}" or "HP {hp}/{max}",
  is a plain line.
- A line with two counted things becomes two lines.
- **Ordinals** (1st, 2nd, 3rd) differ in every language. Give each position its
  own line, or word it with the plain number: "Place {place}".

**Numbers that aren't amounts:** pass a year, a code or a room number as text,
so it isn't grouped like an amount (Year 1.200).

**Tags:** text in curly braces is a tag. It can be:
- a blank, such as `{player}`;
- engine markup, such as `{c=#ffd36a}gold{/c}` or `{w=.5}`;
- a control (see *Controls*).

Translations copy each tag exactly, character for character, and may move it
within its line.

### Problem: names built from parts

A roguelike that builds "Flaming Sword of Doom" from three parts has the same
problem. Other languages order the parts differently, and in French, Spanish or
Russian the adjective changes with the noun.

**Do:** put the parts in the list, along with a line that joins them:
`"item.name": "{prefix} {base} {suffix}"`. A translation can then reorder the
parts. Some joined names will still read a little stiffly in some languages,
and that is acceptable.

### Problem: grammar that depends on who

In many languages a sentence changes with who speaks and who listens. "You are
tired" is *fatigué* or *fatiguée* in French, and Spanish, German and Japanese
choose between a formal and a familiar "you".

**Do:**
- Say in a line's note, or in the brief, who speaks the line and to whom.
- Say whether the player character is a man, a woman, or chosen by the player.
- Prefer lines that don't depend on a value the game only knows while it runs.

### Problem: words drawn into art

Words painted into a sprite or a texture can't be translated.

**Do:** draw the words players need to read as text from the list, over the
art. Words that are only decoration, such as a shop sign in the background,
can stay in the art.

---

## Drawing text

### Problem: lines put in as HTML

A line put on screen with `innerHTML` can add elements, or a script, to the
page.

**Do:** put lines on screen as text: `textContent`, or canvas `fillText`. HTML
written in the page, such as `<button data-line="menu.start">Start</button>`,
gets its line from `fillPage()` in the example.

### Problem: a font with only Latin letters

A pixel or bitmap font usually has the Latin alphabet and little else. Russian,
Chinese, Hindi and Arabic text then shows as `?` or as empty boxes, and so do
the special letters of Polish, Turkish, Vietnamese, Hausa and Yoruba.

**Do:** draw the characters your font lacks with the device's own font.
- Phones and computers come with fonts for the major writing systems.
- HTML text and canvas `fillText` fall back to them by themselves.
- A game that draws letters from its own glyph table hands each run of the
  characters it lacks to the device's font, drawn in one call. Arabic and
  Hindi letters join only when they are drawn together.
- Chinese, Japanese and Korean characters need about 12 pixels of height to be
  readable.
- Thai, Hindi, Vietnamese and Yoruba put marks above and below their letters,
  so leave room for them above and below the line.
- Don't bundle large fonts into the game.

### Problem: 3D text made from a font file

3D text built from a font file, such as Three.js `TextGeometry` or a bitmap
font atlas, has only the letters the file was made with.

**Do:** in a 3D game, draw the HUD and menus as HTML over the canvas. Draw
labels in the world as canvas textures with `fillText`, so the device's fonts
work there too.

### Problem: lines that break only at spaces

Chinese, Japanese and Thai don't put spaces between words, so a wrap that waits
for a space runs off the end of the box.

**Do:** find break points with `Intl.Segmenter` (granularity `word`), and keep
punctuation with the word before it. HTML text wraps correctly by itself.

### Problem: boxes sized for English

A German line is often a third longer than the English one, and a Chinese line
is often half as long.

**Do:** let text boxes grow, wrap or scroll. Where space is tight, give the
line a `max`.

### Problem: right-to-left languages

Arabic, Urdu, Persian and Hebrew run right to left. Setting `dir="rtl"` on the
page's `<html>` mirrors the HTML layout. It also moves canvas text that is
drawn at a fixed position with the default alignment: text meant to start at
x = 20 ends there instead, off the left edge.

**Do:** set the direction where text is drawn.
- **HTML:** `el.dir = dir` on the elements that hold lines.
- **Canvas:** `ctx.direction = dir`, with `ctx.textAlign` set explicitly. In a
  right-to-left text box, lines start at the box's right edge.
- **The whole page:** set `dir` on `<html>` only in a layout built to mirror.
- **Menus** may mirror. The game world stays as it is: a car still drives to
  the right.
- **Filled-in values:** in right-to-left languages, the example's `t()` wraps
  each filled-in value, such as a Latin name or a number, in the Unicode
  isolates U+2068 and U+2069, so it can't scramble the sentence around it.
  These characters take no space.

### Problem: capitals

`'i'.toUpperCase()` gives `I`, but in Turkish the capital of i is İ. Many
scripts have no capitals at all.

**Do:** use `toLocaleUpperCase(lang)` where the game shows text in capitals.

---

## Typewriter text and chirps

### Problem: the typewriter splits letters

Hindi, Bengali and Thai letters are built from several parts. A typewriter that
adds one character at a time shows half-built letters. Arabic letters change
shape as their neighbours appear.

**Do:** reveal whole letters, cut with `Intl.Segmenter` (granularity
`grapheme`), and reveal Arabic-script text a word at a time.
- `pieces()` in the example does both, and keeps each tag as a single step
  that takes no time.
- Draw the revealed part as one string each frame, not piece by piece, so the
  letters join.
- Effects on single letters, such as a wave or a shake, suit scripts whose
  letters don't join. In Arabic script, apply them to whole words.

### Problem: timing tied to the English text

A translated line can be much longer or shorter than the original, so a fixed
speed in letters per second changes the scene's rhythm.

**Do:** reveal a translated line over the time the original would take: the
original's letter count divided by the game's letters per second. The author's
pauses, cutscenes and radio chatter then keep their timing.

### Problem: chirps tied to English letters

Some voices pick a vowel sound from the English letter and a click for anything
else, so on 你好 or Привет they go silent or only click.

**Do:** drive the chirps from the reveal, by syllable rather than by letter:

| Writing | One chirp for |
|---|---|
| Chinese characters, Japanese kana, Korean Hangul | each character |
| Latin, Cyrillic, Greek and other alphabets | about every two or three letters |
| Hindi, Bengali, Thai and other scripts with built letters | each whole letter |
| Arabic script | one or two per word, as the word appears |

- Don't chirp on spaces or punctuation, including 。，！？ and ،.
- Pause briefly at the end of a sentence. Any character matching
  `/\p{Sentence_Terminal}/u` ends one: `. ! ? 。 ！ ？ । ؟ ۔ ።`
- Take the chirp's sound from the character's code and the speaker's voice,
  not from a table of English letters. Map the code into the voice's range:
  `code % 12`, for example, picks one of twelve pitches.

---

## Numbers, dates and controls

- **Numbers and dates:** format them in the player's language with
  `Intl.NumberFormat` and `Intl.DateTimeFormat`. 12,500 in English is 12.500 in
  German and 12 500 in French.
- **Units, money and times:** these stay as written. A translation doesn't
  convert miles or dollars.
- **Lists and sorting:** join a list of names with `Intl.ListFormat`, and sort
  names with `localeCompare(other, lang)`.
- **Controls:** don't write key or button names into sentences ("Press W to
  jump").
  - Use a control tag, `{key:jump}`. The game fills it with the key, gamepad
    symbol or on-screen button that does the action on the device in use; the
    example's `t()` asks the game's `controlLabel()`.
  - A line whose wording changes with the device ("Tap to jump" on a phone)
    gets a line for each device: `help.jump.keys`, `help.jump.touch`.
- **Keys:** read keys by `event.code` (the key's place, `KeyW`), not
  `event.key` (its letter, `w`), so WASD works on a Russian or Arabic
  keyboard. On a French keyboard, for example, the key in W's place is
  labelled Z.

## Multiplayer, the hub and saves

- **Between copies:** the copies of a game send each other ids and numbers,
  not sentences, so each player sees their own language.
- **To the hub:** progress labels, stats and awards go to the hub as text, as
  the session protocol says. Send them in the player's language.
- **The hub's own text:** the session card (`hub:session-goal`,
  `hub:session-howto`) and the catalogue are the hub's to translate.
- **What players type:** player names and anything else players type show as
  written. Let players type in an HTML input, so that their keyboard's input
  methods for Chinese, Japanese or Arabic work.
- **Saves:** keep ids and values in a save, not finished sentences, so a saved
  game shows in the language of the moment.

## Games built on words

Word puzzles, typing games, anagrams, rhymes and quizzes about a language can't
be translated faithfully, because the play is the words.
- Set `"wordPlay": true` in the line list.
- The hub shows the game as playing in its own language.
- The word lists stay out of the line list. Its menus and messages can still be
  translated.

In a game that can otherwise be translated, a puzzle whose answer players type
checks the answer against a line from the list. That way the answer is
translated along with the clue.

## The list of names and the brief

The translation step uses a model that hasn't seen the game. The list of names
and the brief are what the author tells it, the way a novelist answers their
translator's questions.

- **`names`:** proper names only, as written: Pip, Vex, Meridian.
  - A title, or a name made of ordinary words (Captain, The Wanderer), stays
    off the list and is translated.
  - A word left off the list is translated like any other word.
- **`brief`:** a few paragraphs covering:
  - what the game is, its tone and its setting;
  - each character's voice: how they talk, formal or casual;
  - the player character: a man, a woman, chosen by the player, or unknown;
  - the jokes and wordplay, explained: what is funny and why;
  - anything else a translator would want to ask.

A line that needs its own context gets a note: who speaks it, to whom, and
where it shows.

---

## Choosing the language

The game shows the first of these it has:

1. the `lang` in the page's address (`?lang=es-419`), which the hub adds every
   time it opens the game, sessions included;
2. the player's choice from the game's Language menu, saved under `lang:`
   followed by the page's path;
3. the browser's languages (`navigator.languages`);
4. the game's own language.

**Matching:** a code matches in this order:
1. in full;
2. the same language in the same writing system;
3. the same language.

A browser set to `zh-TW` gets `zh-Hant` before `zh-Hans`, `es-MX` gets
`es-419`, and `pt-PT` gets `pt-BR`.

**The Language menu:**
- It sits on the title screen, where a restart costs nothing.
- It lists the languages the game has, each in its own language, as
  `languageName()` in the example gives them: Español latinoamericano, 繁體中文.
- It appears when the address has no `lang`, because otherwise the hub's own
  menu is in charge. In a hub session the page doesn't reload.
- A choice restarts the game in that language.

The game sets `lang` on the page's `<html>`; direction is set where text is
drawn (see *Right-to-left languages*).

**Critical:** if the `game-translations` block is missing or broken, or a line
in it is missing, empty or not text, the game shows the original line and
carries on. A missing translation doesn't stop the game or leave a gap where a
line belongs.

## Testing with three test languages

The game makes three test languages when the address asks for one, as in
`?lang=en-XA`. It makes them from its own lines, in whatever language the game
is written in, before the blanks are filled. There are three because each one
catches a different problem, so a failure points at its cause.

| Code | What it is | What it shows |
|---|---|---|
| `en-XA` | the lines with accents, in brackets, each paragraph about 40% longer, or exactly `max` wide when the line has one: `[Stáy óñ my wíñg ······]` | plain text on screen is a line missing from the list; a missing `]` is a box that cuts text off |
| `zh-XC` | the lines in Chinese characters, without spaces | `?` or empty boxes mean a font without a fallback; text running off means a wrap that waits for spaces |
| `ar-XB` | the lines in Arabic letters, right to left | text or menus that don't run right to left |

- The codes follow the pattern Android uses for its test languages. Browsers'
  language functions accept them, while made-up codes such as `x-long` make
  them fail.
- A browser's own language setting doesn't select a test language; the
  address does.
- The hub will run the three when a game joins the library, as it runs the
  session test.

## Example

This is for a game without an engine that does this. An engine that follows
this page offers the same through its own functions.

```js
const block = (id) => { try { return JSON.parse(document.getElementById(id).textContent); } catch { return null; } };
const own = (o, k) => (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const SOURCE = block('game-lines') || { language: 'en', lines: {} };
const TRANSLATIONS = block('game-translations') || {};   // added later by a translation step; often absent
const FAKE = ['en-XA', 'zh-XC', 'ar-XB'];                // test languages, chosen only by ?lang=
const RTL = /^(ar|fa|ur|he|ps|sd|ug|yi|ckb|dv)\b/i;       // written right to left
const JOINED = /^(ar|fa|ur|ps|sd|ug|ckb)\b/i;             // Arabic script: letters join, so a typewriter reveals words

const lang = pickLanguage([SOURCE.language, ...Object.keys(TRANSLATIONS)]);
const dir = RTL.test(lang) ? 'rtl' : 'ltr';               // set where text is drawn: el.dir, ctx.direction
const table = own(own(TRANSLATIONS, lang), 'lines') || {};
document.documentElement.lang = lang;

/** The game's own: the key, gamepad symbol or on-screen button that does this action on the device in use. */
let controlLabel = (action) => action;

/** The language to show: the hub's ?lang=, then the player's saved choice, the browser's languages, the game's own. */
function pickLanguage(available) {
  const asked = new URLSearchParams(location.search).get('lang');
  if (FAKE.includes(asked)) return asked;
  let saved = null;
  try { saved = localStorage.getItem('lang:' + location.pathname); } catch {}
  const parts = (code) => { try { const l = new Intl.Locale(code).maximize(); return [l.language, l.script]; } catch { return []; } };
  for (const want of [asked, saved, ...(navigator.languages || [])].filter(Boolean)) {
    const [language, script] = parts(want);
    const hit = available.find((a) => a.toLowerCase() === want.toLowerCase())             // in full
      || available.find((a) => parts(a)[0] === language && parts(a)[1] === script)       // same language and writing
      || available.find((a) => parts(a)[0] === language);                                // same language
    if (hit) return hit;
  }
  return SOURCE.language;
}

/** For the Language menu: a language's name in that language. */
function languageName(code) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}

/** The Language menu, on the title screen when the address has no ?lang=: saves the choice and restarts in it. */
function chooseLanguage(code) {
  try { localStorage.setItem('lang:' + location.pathname, code); } catch {}
  location.reload();
}

/** A line in the player's language, its tags filled. A missing, empty or broken translation shows the original line. */
function t(id, values = {}) {
  const usable = (v) => (typeof v === 'string' && v !== '') || (!!v && typeof v === 'object' && Object.values(v).every((s) => typeof s === 'string'));
  const translated = usable(own(table, id));
  const textLang = translated ? lang : SOURCE.language;     // the language the line's text is in
  let line = translated ? own(table, id) : own(SOURCE.lines, id);
  if (!usable(line)) return id;
  if (typeof line === 'object') {   // plural forms, picked by {count}; "zero" is the line for exactly none
    const n = values.count ?? 0;
    line = (n === 0 && line.zero) || line[new Intl.PluralRules(textLang).select(n)] || line.other || Object.values(line)[0];
  }
  if (FAKE.includes(lang)) line = fake(line, own(SOURCE.max, id));
  line = line.replace(/\{key:(\w+)\}/g, (tag, action) => controlLabel(action)).replace(/\{(\w+)\}/g, (tag, name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) return tag;
    const v = values[name], text = typeof v === 'number' ? new Intl.NumberFormat(textLang).format(v) : String(v);
    return dir === 'rtl' ? '⁨' + text + '⁩' : text;   // isolated, so a Latin name or a number can't scramble the line
  });
  if (!translated && !FAKE.includes(lang) && RTL.test(SOURCE.language) !== (dir === 'rtl')) line = '⁨' + line + '⁩';
  return line;
}

/** HTML written in the page, such as <button data-line="menu.start">Start</button>, gets its line. Call it once the page has loaded. */
function fillPage() {
  for (const el of document.querySelectorAll('[data-line]')) { el.textContent = t(el.dataset.line); el.dir = dir; }
}

/** What a typewriter reveals one step at a time: whole letters (whole words in Arabic script). A {tag} is one step that takes no time. */
function pieces(line) {
  const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(lang, { granularity: JOINED.test(lang) ? 'word' : 'grapheme' }) : null;
  return line.split(/(\{[^{}]*\})/).flatMap((part, i) => (i % 2 ? [part] : seg ? [...seg.segment(part)].map((s) => s.segment) : Array.from(part))).filter((p) => p !== '');
}

/** A line's width for max: whole letters, a Chinese, Japanese or Korean character counting two; tags count nothing. */
function width(line) {
  const text = line.replace(/\{[^{}]*\}/g, '');
  const letters = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment) : Array.from(text);
  return letters.reduce((n, g) => n + (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/u.test(g) ? 2 : 1), 0);
}

/** A test language made from a line before its blanks are filled: accented and longer (en-XA), Chinese characters (zh-XC), right-to-left letters (ar-XB). */
function fake(line, max) {
  const HAN = '的一是不了人我在有他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对';
  const ARABIC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
  const ACCENT = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', n: 'ñ', c: 'ç', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', N: 'Ñ' };
  const out = line.split(/(\{[^{}]*\})/).map((part, i) => {
    if (i % 2) return part;   // a tag stays as it is
    if (lang === 'zh-XC') return part
      .replace(/[\p{L}\p{M}]+/gu, (w) => Array.from({ length: Math.ceil([...w].length / 2) }, (_, k) => HAN[(w.codePointAt(k) * 7 + k) % HAN.length]).join(''))
      .replace(/[,.!?:;]/g, (p) => '，。！？：；'[',.!?:;'.indexOf(p)]).replace(/[ \t]+/g, '');
    if (lang === 'ar-XB') return part.replace(/\p{L}\p{M}*/gu, (c) => ARABIC[c.codePointAt(0) % ARABIC.length]);
    return part.replace(/[aeiounc]/gi, (c) => ACCENT[c] || c);
  }).join('');
  if (lang !== 'en-XA') return out;
  if (max) return '[' + out + '·'.repeat(Math.max(0, max - width(out) - 2)) + ']';   // exactly max wide, to test the room the author gave
  return out.split('\n').map((p) => '[' + p + ' ' + '·'.repeat(Math.ceil(width(p) * 0.4)) + ']').join('\n');
}
```

- **Using it:** show text with `t('hud.lives', { count: 3 })`, and step a
  typewriter through `pieces(t(id, values))`.
- **Controls:** replace `controlLabel` with the game's own.

---

# Translating

This part is for the step that adds translations. That step can be a later
stage of the build pipeline, the hub when a game joins, or the build itself
when its prompt asks for translations.

## The aim

- **Quality:** the best translation the model can make. The floor is a
  translation a native speaker can play and follow without confusion.
- **Consistency comes before polish.** A name, a term and the game's form of
  "you" stay the same throughout the game.

## Faithful, not adapted

Translate the way a novel or an indie film is translated:

- **Keep the line:** its meaning, voice and tone. Don't rewrite it, swap in a
  local joke, or soften it.
- **Wordplay:** a joke whose wordplay can't survive keeps its meaning.
- **Same strength:** swearing, slang and cultural references stay as strong as
  in the original. Units and money stay as written.
- **What the language requires changes:** grammar, word order, punctuation
  and number formats.
- **Forms of "you":** the game addresses the player with one form of "you" per
  language. Characters address each other as their relationship calls for.

## Names

- **In languages written in the Latin alphabet,** the names on the list stay as
  written.
- **In other alphabets,** they are spelled by sound, as published translations
  do: Harry Potter is Гарри Поттер in Russian. Each spelling is recorded in the
  translation's `names` and used for that name throughout.
- **Endings:** a name takes the endings its language's grammar requires, so
  Russian writes Пип, Пипа, Пипу.
- **Words not on the list** are translated like any other word.

## How

1. Translate a language's whole list in one go when it fits, so terms stay
   consistent. For a long game, translate in parts, carrying the names and the
   terms already chosen from one part to the next.
2. Copy each tag exactly, character for character, and keep paired tags such
   as `{c=…}` and `{/c}` in their order. A tag may move within its line.
3. Give each line with plural forms the forms its language needs:
   `new Intl.PluralRules(code).resolvedOptions().pluralCategories` lists them.
   - Keep `zero` when the original has it.
   - A form may leave out `{count}` when it only ever means one number. Arabic
     `two` is always 2, but Russian `one` also covers 21, so it keeps
     `{count}`.
4. When a blank holds a name or a noun, word the line so the blank can stay as
   it is. A filled-in name can't take a Russian case ending.
5. Keep within `max`.
6. Skip the lines whose ids start with `dev.`.

## The block

```html
<script type="application/json" id="game-translations">
{
  "es-419": {
    "by": "the model or person that translated it",
    "lines": {
      "menu.start": "Empezar",
      "hud.lives": { "zero": "Sin vidas", "one": "Te queda {count} vida", "other": "Te quedan {count} vidas" }
    }
  },
  "ru": {
    "by": "the model or person that translated it",
    "names": { "Pip": "Пип", "Meridian": "Меридиан", "Lynx": "Линкс" },
    "lines": { "menu.start": "Начать" }
  }
}
</script>
```

- **Where:** in the page's `<head>`, right after the `game-lines` block, with
  one entry per language code. Write `<` as `<`, as in `game-lines`.
- **Each entry has:**
  - `by`;
  - `names`, for languages in other alphabets;
  - `lines`.
- **Adding a language:** a step that adds a language adds its entry and leaves
  the others as they are.

**Critical:** translating changes nothing in the page except the
`game-translations` block.

## Checks

A translation is kept when:

- the block is valid JSON, and each line is text or plural forms of text;
- its ids are ones the original has, apart from `dev.` lines;
- each line has the original's tags, copied exactly, with paired tags in
  order, and `{count}` left out only where step 3 allows it;
- each line with plural forms has the forms its language needs.

These are flagged for a look, not rejected:

- **Missing lines:** the game shows the original for them, and the step fills
  them in when it can.
- **Names:** spellings that differ from `names`. Endings can make them
  differ.
- **Writing system:** text that isn't in the language's writing system.
- **Length:** a line wider than its `max`, or much longer or shorter than the
  original.

lib/hub will get a script that runs these checks.

---

## Languages

Use these codes. The first set is the ten most spoken languages in the world.

| Code | Language | Writing | Notes |
|---|---|---|---|
| `en` | English | Latin | most games' own language |
| `zh-Hans` | Chinese, Simplified | Chinese characters | no spaces |
| `hi` | Hindi | Devanagari | built letters |
| `es-419` | Spanish, Latin America | Latin | read in Spain too |
| `ar` | Arabic, Modern Standard | Arabic | right to left, joined letters |
| `fr` | French | Latin | also West and Central Africa |
| `bn` | Bengali | Bengali | built letters |
| `pt-BR` | Portuguese, Brazil | Latin | read in Portugal, Angola, Mozambique |
| `ru` | Russian | Cyrillic | |
| `id` | Indonesian | Latin | |

The second set adds languages chosen for size, for players (Japanese, German,
Korean), for readers of Traditional Chinese, and to reach Africa.

| Code | Language | Writing | Notes |
|---|---|---|---|
| `ja` | Japanese | Chinese characters and kana | no spaces |
| `de` | German | Latin | long words |
| `ko` | Korean | Hangul | |
| `zh-Hant` | Chinese, Traditional | Chinese characters | Taiwan, Hong Kong |
| `ur` | Urdu | Arabic | right to left |
| `tr` | Turkish | Latin | ı İ ğ ş |
| `vi` | Vietnamese | Latin | stacked accents |
| `sw` | Swahili | Latin | East Africa |
| `ha` | Hausa | Latin | West Africa; ɓ ɗ ƙ |
| `am` | Amharic | Ethiopic | Ethiopia |
| `yo` | Yoruba | Latin | West Africa; tone marks |

- **South America:** Latin American Spanish and Brazilian Portuguese. Quechua
  and Guarani could follow.
- **Africa:** English, French, Arabic and Portuguese are official languages in
  most African countries. Swahili, Hausa, Amharic and Yoruba reach the largest
  groups those miss, and Ethiopia in particular has none of the first set.
- **Choosing a model:** models translate Swahili, Hausa, Amharic and Yoruba less
  reliably than Spanish or French. For those, choose a model that does them
  well and check its work more closely.

---

## For engines

An engine can do most of this once, for the games built on it:

- reading the two blocks, and `t(id, values)`: blanks, control tags, plural
  forms, number formats, and the fallback to the original line;
- choosing the language, and the Language menu;
- handing the characters its fonts lack to the device's font a run at a time,
  wrapping with `Intl.Segmenter`, and right-to-left text;
- a typewriter that reveals whole letters, draws the revealed part in one
  call, keeps the original timing and chirps by syllable;
- the three test languages.

Readable text in the player's language comes before a strict pixel style. An
engine whose look rules out `fillText` still draws other writing systems with
the device's font.

Some engines can't reach the device's fonts, such as Unity and Godot web
builds. They bundle fonts for the languages they ship, cut down to the
characters used.

Engines with their own translation system, such as Godot's `tr()` with CSV or
PO files or Unity Localization, can use it as long as the two blocks convert to
and from it.
