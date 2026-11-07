# The hub in ten languages: what it took

On 2026-11-07 the hub itself (not the games) was given its players'
languages, following [`lib/hub/languages.md`](../lib/hub/languages.md), and the
work was measured as it went. This is the record, for the next language, the
games, and the cc-matrix translation stage.

## In short

- **Languages:** the interface in English plus the standard's first set
  (Simplified Chinese, Hindi, Latin American Spanish, Arabic, French, Bengali,
  Brazilian Portuguese, Russian, Indonesian); the catalogue's words in the
  same nine.
- **Wall time:** 1 hour 33 minutes (01:39 to 03:12 UTC) from the goal to the last push, in six phases.
- **The agent's own work:** 251 calls by the main session (Opus 5.5) and 200 by eight Sonnet 5.5 agents; 122.9M tokens of cached context read, 591K written; $60.15 at API prices ($49.56 main, $10.59 agents). Re-reading the growing context on every call is most of it.
- **Translation:** $14.59 at API prices for everything the CLI translated: the hub's lines by both models ($8.96), the catalogue by Haiku ($4.04), a Sonnet catalogue sample ($1.58) and back-translation ($0.002).
- **Plan usage:** the weekly limit (all models) went from 90% to 93%, so the whole build took about three points of the week (the reading moves in whole points).
- **Download:** an English player fetches 41 KB more (gzipped) on a first
  visit. A player in another language fetches those 41 KB, plus its translation of the hub's lines (median 20 KB gzipped) and of the catalogue (median 187 KB gzipped) on the pages that show games.
- **Load time:** unchanged in English (within the noise of five loads); in
  another language pages are ready a median 47 ms later than in English.

## Phases

| Phase | What | Wall time |
|---|---|---|
| 1 | `lang.js` (the standard's example, adapted), `en.js`, the Language menu, 11 tests | 19 min |
| 2 | 1,280 lines moved into `en.js` by seven Sonnet 5.5 agents in parallel, one area each; whole sentences, plural forms, `Intl` formats | 18 min |
| 3 | right to left: logical CSS in 19 stylesheets, Couch rails, submenus | 3 min |
| 4 | `translate.mjs`, the standard's checks, the catalogue's words through `shown()` (one more agent) | 9 min |
| 5 | both models on every line in nine languages, compared, the better kept per language | 8 min |
| 6 | the catalogue (2,153 games) in nine languages, screenshots, docs, this report | 35 min |

| Phase | Who | Calls | Cache reads | Cache writes | Output | API-price cost |
|---|---|---|---|---|---|---|
| 1 lang.js, en.js, menu | main opus-5-5 | 52 | 9.7M | 137K | 97K | $6.92 |
| 2-3 text into en.js; mirroring | main opus-5-5 | 77 | 25.8M | 154K | 105K | $13.65 |
| 2-3 text into en.js; mirroring | agents sonnet-5-5 | 170 | 22.4M | 1.0M | 228K | $9.33 |
| 4-5 tools, checks, translations | main opus-5-5 | 64 | 29.1M | 119K | 82K | $14.22 |
| 4-5 tools, checks, translations | agents sonnet-5-5 | 30 | 3.5M | 149K | 18K | $1.26 |
| 6 catalogue, QA, docs, report | main opus-5-5 | 58 | 32.4M | 77K | 60K | $14.77 |
| All | | 451 | 122.9M | 1.7M | 591K | $60.15 |

## Translation

Every line was translated twice, by Haiku 5.5 and by Sonnet 5.5, both at
medium effort, through the `claude` CLI with no tools, MCP servers, settings or
skills (941 tokens of overhead a call, against 5,230 with the defaults).
Costs are what the CLI reports, at API prices; the runs themselves were on the
plan.

**The hub's 1,280 lines, all nine languages:**

| | Haiku 5.5 | Sonnet 5.5 |
|---|---|---|
| Calls (with retries) | 158 (39 retries) | 126 (9 retries) |
| Output tokens | 916,608 | 540,669 |
| Cost | $0.62 | $8.35 |
| Time, all languages at once | 6.7 min | 6.2 min |

Haiku writes about 1.7 times as many tokens (more thinking at medium effort)
and still costs about a thirteenth. It needed far more second tries: the
checks sent back lines that lost a `{count}` or a plural form, mostly in
Spanish (12 retries), Arabic (9) and Portuguese (8).

**Per language** (output tokens show what a writing system costs):

| Language | Haiku output | Haiku cost | Sonnet output | Sonnet cost | Kept | Catalogue (Haiku) output | Catalogue cost |
|---|---|---|---|---|---|---|---|
| zh-Hans | 80K | $0.056 | 50K | $0.816 | Haiku | 639K | $0.39 |
| hi | 93K | $0.063 | 55K | $0.887 | Sonnet | 821K | $0.48 |
| es-419 | 98K | $0.070 | 59K | $0.909 | Sonnet | 703K | $0.42 |
| ar | 150K | $0.095 | 78K | $1.121 | Sonnet | 861K | $0.50 |
| fr | 97K | $0.066 | 63K | $0.959 | Sonnet | 742K | $0.44 |
| bn | 111K | $0.072 | 67K | $1.003 | Sonnet | 964K | $0.55 |
| pt-BR | 97K | $0.068 | 59K | $0.915 | Haiku | 685K | $0.41 |
| ru | 109K | $0.071 | 63K | $0.952 | Sonnet | 681K | $0.41 |
| id | 80K | $0.056 | 47K | $0.785 | Haiku | 698K | $0.42 |

**Chosen per language,** after reading samples side by side and counting
what the checks flag:

| Language | Model | Why |
|---|---|---|
| Chinese | Haiku | Sonnet wrote half-width `, : !` in 120 of 1,281 lines, Haiku in none |
| Portuguese, Indonesian | Haiku | as good; Portuguese labels fit better (3 over their room, against 10) |
| Hindi | Sonnet | the loanwords players use (सेशन, टेबल); Haiku writes formal Sanskritised Hindi (सत्र, मेज़) |
| French | Sonnet | 2 labels over their room, against Haiku's 14 |
| Spanish, Arabic, Russian, Bengali | Sonnet | a little more natural ("acceder a tu cuenta" where Haiku wrote "contactar tu cuenta") |

Both models were passable or better everywhere; the differences are small.
Where a chosen model left a line in English (4 lines), the other model's
checked line filled it. `scripts/lang-sources/` keeps each language's model,
so later runs use it.

**The catalogue** (391,000 characters a language: descriptions, controls,
session goal and how-to, plus 19 genres, 4 types and 70 tags) went to Haiku
5.5 in all nine languages: 6.8M output tokens and $4.04 for all nine, in 31 minutes of wall time: two processes, 9 and then 18 calls at once. A 60-game sample by Sonnet 5.5 cost
$1.58 for nine languages, which puts the whole catalogue at about $56 with
Sonnet. Sonnet's catalogue prose is smoother, most of all in Hindi; Haiku's is
plain and faithful, keeps game titles as written (1,190 of 1,190 in Chinese,
1,189 of 1,190 in Hindi) and writes Chinese punctuation correctly. One command
upgrades a language later:
`node scripts/translate.mjs --catalogue --model claude-sonnet-5-5 --force --langs hi`.

## Quality

- **Checks:** every committed line passes the standard's checks. Flagged for a
  look, not blocked: lines with no letters of the language (units, key names,
  "RPG": as intended), and a few labels one or two letters over their `max`.
- **Back-translation** of seven key lines (the Wall's sign, sign-in, the
  Couch, a session status, the Friends page, the privacy page's opening) from
  Arabic, Hindi, Chinese and Bengali by Haiku came back with the meaning
  intact. The drifts: Chinese "Hosting" (a status) came back as "Create room"
  (an action), Chinese "the hub deals the games" as "deals the cards", Bengali
  "private arcade" as "personal arcade".
- **Known small faults:** a Russian sentence that ends with a date gets two
  full stops ("…2026 г.."), because Russian dates end with "г."; Haiku
  translated a subtitle inside one Chinese description.

## Size

| | Before | After | Change |
|---|---|---|---|
| Hub JavaScript (raw / gzipped) | 643,684 / 226,426 B | 688,855 / 235,636 B | +7% / +4% |
| Stylesheets | 249,120 / 63,526 B | 253,049 / 64,365 B | +1.6% / +1.3% |
| Pages (HTML) | 31,518 / 12,334 B | 34,556 / 12,604 B | +10% / +2% |
| `assets/lang/en.js` | none | 153,525 / 34,268 B | new |

`en.js` is lines 17 KB gzipped, translator's notes and brief 14 KB, `max`
widths 3 KB. The notes are only for translators; moving them to a file the
hub doesn't load would save 14 KB per first visit, at the price of keeping a
line and its note in two places. Translations of the hub's lines are 19 to 23
KB gzipped each:

| Language | Hub lines (raw / gzipped) | Catalogue (raw / gzipped) |
|---|---|---|
| zh-Hans | 71 / 19 KB | 600 / 187 KB |
| hi | 114 / 21 KB | 1064 / 211 KB |
| es-419 | 81 / 19 KB | 657 / 177 KB |
| ar | 104 / 22 KB | 790 / 193 KB |
| fr | 81 / 20 KB | 677 / 183 KB |
| bn | 116 / 21 KB | 1115 / 213 KB |
| pt-BR | 80 / 19 KB | 642 / 175 KB |
| ru | 105 / 22 KB | 904 / 211 KB |
| id | 72 / 18 KB | 651 / 168 KB |

## Load time

The same machine, the hub's own static handler with gzip, Chromium,
median of five loads; "ready" is when a page's first real content appears (a
cabinet, a catalogue row, a Couch tile).

| Page | Ready, before (en) | Ready, after (en) | Ready, after (other languages) | Transfer before (en) | after (en) | after (other) |
|---|---|---|---|---|---|---|
| `/` | 228 ms | 210 ms | 281 ms | 3564 KB | 3606 KB | 3823 KB |
| `/catalogue/` | 415 ms | 418 ms | 514 ms | 1851 KB | 1862 KB | 2079 KB |
| `/couch/` | 253 ms | 209 ms | 273 ms | 980 KB | 1021 KB | 1238 KB |
| `/atlas/` | 173 ms | 167 ms | 212 ms | 875 KB | 916 KB | 1133 KB |
| `/timeline/` | 174 ms | 177 ms | 219 ms | 1440 KB | 1481 KB | 1698 KB |
| `/deck/` | 173 ms | 172 ms | 216 ms | 704 KB | 746 KB | 962 KB |
| `/friends/` | 219 ms | 251 ms | 300 ms | 2007 KB | 2048 KB | 2265 KB |
| `/session/` | 58 ms | 73 ms | 57 ms | 715 KB | 756 KB | 973 KB |
| `/privacy/` | 9 ms | 7 ms | 8 ms | 2 KB | 43 KB | 65 KB |
| `/auth/` | 7 ms | 6 ms | 8 ms | 6 KB | 45 KB | 66 KB |

On the live site (Cloudflare, three loads each from this machine) English pages were ready in 0.4 to 1.3 s (the Wall in 676 ms, the catalogue in 1,273 ms). Pages in Hindi, Spanish and Chinese transferred about 200 KB more, the catalogue's translation, compressed by the CDN. Their times came out faster than English only because the English run had warmed the CDN's cache, so the table above, on one machine, is the comparison.

## Scope

- **Lines:** 1,280 in `en.js`, 67 with plural forms, 642 notes, 458 `max`.
- **Files:** 56 of the hub's 81 scripts, all 10 pages and 19 of 20 stylesheets
  changed; 4 new scripts (`lang.js`, `ui/language.js`, `privacy.js`,
  `auth.js`).
- **Tests:** 388 before, 405 after.
- **Stays English, on purpose:** game titles, player nicknames, model names,
  the developer panel.

## What the test languages found

`?lang=en-XA` (accented, bracketed, 40% longer), `zh-XC` and `ar-XB`, run on
every view, found and fixed:

- the catalogue's masthead and the session header hiding longer text under
  their neighbours;
- Couch rails that wouldn't scroll right to left (`scrollLeft` runs negative
  there) and arrow keys that stepped the wrong way in a mirrored row;
- submenus checking for room on the wrong side;
- a size split on a space ("3.2 GB" → number and unit), which breaks in
  languages that write no space: now `Intl`'s `formatToParts`;
- seat counts on the catalogue's chart labels printed raw;
- the Couch clock wrapping ("6:47 / pm") in languages with a twelve-hour
  clock;
- with the catalogue's words faked too, every place that still printed raw
  game data.

## For the standard, the games and cc-matrix

- **Tool input is JSON.** A `⁨` typed into a file edit arrives as the
  invisible character itself. That is how the published standard lost its
  `<` note (fixed). Agents writing escapes need `\\u`.
- **The `{count}` rule works, and models stumble on it.** French, Portuguese,
  Hindi and Bengali "one" also covers 0, so it must keep `{count}`, unless the
  translation adds a "zero" form, after which "one" means only 1. Telling the
  model which numbers each form covers cut the failures.
- **Different models suit different languages** held up: Haiku for Chinese
  punctuation and tight labels, Sonnet for the register of Hindi.
- **Parallel agents work for the move into a line table** when each owns its
  files and its own fragment of lines; a test that every line used exists
  (and every line exists for a use) caught what they missed.
- **Passable is cheap.** The whole hub in nine languages costs under a dollar
  with Haiku; the work is in moving the text out of the code, not in
  translating it.
