# Handoff: the hub's languages

Written 2026-11-07 for the next agent session. Give the hub itself, not the
games, its players' languages, following the ideas in
[`lib/hub/languages.md`](lib/hub/languages.md), and measure what the work
costs. Nothing is built yet. When it is done and measured, delete this file.

### Decided

- **Languages:** the standard's first set besides English: `zh-Hans`, `hi`,
  `es-419`, `ar`, `fr`, `bn`, `pt-BR`, `ru`, `id`. The second set comes later.
- **Translation models:** Haiku 5.5 and Sonnet 5.5, both at medium effort,
  never Opus. Translate through the `claude` CLI, as `scripts/retrofit.mjs`
  runs agents (the repo has no dependencies): `claude -p --model
  claude-haiku-5-5 --effort medium --output-format json`, with `--tools ""`
  and a short `--system-prompt`. Run both models on the same lines and
  compare.
- **Game titles** (name and tagline) stay as written. The description,
  controls, session goal and how-to are translated. Tags and genres are hub
  lines.
- **The privacy page** is translated, with the English version as the
  reference.
- **The language choice** is kept per device in `localStorage`. The browser's
  language is the default.

### How

- **`assets/js/lang.js`:** adapts the tested example in `lib/hub/languages.md`.
  - It picks the language: a saved choice, then the browser's, then `en`.
    `?lang=` overrides, test languages included.
  - It has `t()`, with plural forms, `zero`, isolates and the fallback.
  - It has `Intl` helpers bound to the chosen language, and `languageName()`.
  - It sets `lang` and `dir` on `<html>`. The hub's layout is ours, so it
    mirrors.
- **English lines** go in a JS module, `assets/lang/en.js`. That way the Node
  tests and English players need no fetch.
- **Translations** go in `assets/lang/<code>.json`, fetched with a top-level
  await only for other languages.
- **HTML in the ten pages** gets its line through `data-line` attributes.
- **The language menu** goes in every view's top corner, next to Sign in, and
  in the Couch's settings.
- **Games:** `?lang=` is added where `assets/js/ui/player.js` builds a game's
  address. Every game opens there, sessions included.
- **The catalogue text** goes in `data/lang/<code>.json`, by game slug,
  committed like `overrides.json`. Only the chosen language is loaded. Search
  covers the translated text and the original titles. Check that the release
  uploads it.
- **Scale:** about 670 sentences and 240 short labels across 77 modules and 10
  pages.
  - Eight `Intl` calls are fixed to `'en'`: `session/pick.js`,
    `catalogue/order.js`, `catalogue/tally.js`, `couch/facts.js`, and four in
    `explore/timeline.js`.
  - 22 `localeCompare` sorts need the chosen language.
- **Right to left:** 169 left/right rules in 20 stylesheets become logical
  (start/end) properties.
- **Tools:**
  - `scripts/translate.mjs` sends only new or changed lines, found by a
    fingerprint per line that the script computes, and records each run's
    usage, cost and time from the CLI's JSON.
  - A check script applies the standard's checks: it blocks bad structure and
    flags gaps, length, writing system and names. It runs in `pnpm test`.
- **Screenshots:** Playwright shoots every view in `en-XA`, `zh-XC`, `ar-XB`
  and the nine languages.
- **Docs:** update the README's Languages section, and add a rule to
  `CLAUDE.md`: hub text goes through `t()` and `en.js`, and `translate.mjs`
  runs after text changes.

### Measure, per phase, and report at the end

- **The agent's own work:**
  - tokens, summed from `message.usage` in the session's transcript,
    `~/.claude/projects/-home-micha-dev-ai-hub/<session>.jsonl`, one count per
    `message.id`;
  - the API-equivalent cost at Opus 5.5 prices: $4 per million input tokens,
    $20 output, $0.20 cache reads, $8 one-hour cache writes;
  - wall time;
  - plan usage before and after, from the session tool `get_usage`.
- **Translation:** tokens, cost and time per model and per language. The
  tokens per language show how much each writing system costs.
- **Size:**
  - hub JS, CSS and HTML bytes before and after, raw and gzipped;
  - the size of each language file;
  - the extra download for an English player and for a player in another
    language.
- **Load:** page-load time in English and in a translated language.
- **Quality and scope:**
  - lines moved and files touched;
  - tests before (388) and after;
  - problems the test languages found;
  - check results and coverage;
  - a back-translation of a few key screens.

### Watch

- **The weekly limit** was at 90% on 2026-11-07, reset 2026-11-08 19:00 UTC.
  Take a `get_usage` reading at the start and between phases.
- **Commit and push** each working phase to main, so main stays a working
  wall, and check the Workers Builds result.
- **The cc-matrix line** for the standard is Michael's to hand over; leave
  cc-matrix alone.
