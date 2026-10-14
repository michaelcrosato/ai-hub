# AI Hub

An arcade wall for games built by AI models. Games can be single HTML pages
or project folders with their own code and assets; the hub finds them, dresses
them, and gets out of the way. Shared engines live in `lib/`.

**Live:** <https://crosato-arcade.vercel.app> — public, no sign-in. This repo
stays private; only the built site is reachable.

---

## Adding a game

Put the `.html` file in `games/`. That is the whole procedure.

```
games/Whatever_You_Called_It.html
```

Push it, and Vercel rebuilds the wall. No code to touch, no list to edit, no
naming rules to remember — mixed case, spaces, underscores and hyphens are all
fine.

```bash
git add games/ && git commit -m "Add Whatever You Called It" && git push
```

### Where the game's details come from

Nothing is typed in by hand. On every build, `scripts/scan.mjs` reads just the
`<head>` of each file for catalogue metadata (the audio inventory also reads source text and asset paths):

| From the game | Becomes |
|---|---|
| `<title>Undertow — Seven Guardians Below</title>` | Name **Undertow**, tagline **Seven Guardians Below** |
| `<meta name="description">` | The blurb in the drawer |
| `<meta name="theme-color">` | That cabinet's marquee colour and the light it throws |
| `<link rel="icon" href="data:…">` | The emblem on its screen (a relative path works in a project folder) |
| `<meta property="og:image">` | Its cover art, in a project folder that ships the image |
| file size, the date first added to the hub | The File size rail, the Newest sort |

A game with none of these still works — it gets its filename as a name and a
colour derived from its slug.

### Several builds of one game

Two ways, whichever suits the moment:

```
games/Void-Explorer-v0.4.html      ← same folder, version in the name
games/Void-Explorer-v0.5.html         v0.5 becomes current, v0.4 moves to history

games/void-explorer/v0.4.html      ← or a folder per game, files named as versions
games/void-explorer/v0.5.html
```

One tile either way, showing the newest build, with the older ones a click away
in its drawer.

A version is only recognised when it is unmistakable: `-v2`, `-v0.4`, `-1.2`.
A bare trailing number is left alone, so `snake-2.html` stays its own game
rather than quietly becoming build 2 of `snake`. Hiding a game by accident is
worse than showing one tile too many.

### The library's naming convention

Any name works, but the library names its files by source, so `games/` sorts
into families:

```
games/Out-Run-SUPER-RUNOUT-The-coast-is-calling-2026-09-11-model-unknown.html
      source  title                             made       model
```

The source is the classic a game riffs on, or `original` when there is none;
`model-unknown` is used until the model is known (`GPT-6-Astra-Pro`). A
filename cannot say where the source ends and the title begins (`Out-Run` or
`Out-Run-SUPER`?), so the wall's Original and Inspired split reads the catalogue's `source`
field instead (see *Extra metadata*), and the filename only sorts the folder.

The scan reads the pattern. The date and model say when and by what a file was
made, not which game it is, so they stay out of the slug
(`out-run-super-runout-the-coast-is-calling`), and the date becomes the day the
game joined the wall. A later file with the same source and title —
`…-2026-10-02-model-unknown.html` — is a newer build of that game: one tile,
the newest in front, the older file in its drawer. To keep only the newest,
delete the older file.

### Folders: collections and projects

A folder under `games/` is one of three things, decided by what is in it:

```
games/claude/snake.html            a folder of games is a COLLECTION: every file
games/claude/tetris.html           is its own tile, and a Collection rail appears

games/orbit/index.html             a folder with an index.html is a PROJECT:
games/orbit/game.js                one game whose page loads its own files.
games/orbit/sprites/hero.png       Nothing else inside it becomes a tile.

games/void-explorer/v0.5.html      files named only as versions are BUILDS
                                   of the game the folder names (above)
```

Collections nest projects too (`games/claude/orbit/index.html`), and a project
can be versioned by its folder name (`games/orbit-v2/index.html`). Only the
top-level folder names the collection. A project can point at its own favicon
and `og:image` with relative paths, and the wall uses them.

## Importing a lot at once

For a big pile — loose `.html` files, project folders, `.zip` packages, any mix
of them in any folder layout — use `pnpm ingest` instead of copying by hand:

```bash
pnpm ingest ~/exports --dry-run          # see the plan; nothing is written
pnpm ingest ~/exports                    # everything lands flat in games/
pnpm ingest ~/exports --keep-folders     # its top-level folders become collections
pnpm ingest ~/opus-games --into claude   # all of it into games/claude/
```

For versioned provenance, full dependency fingerprints, and machine-readable plans,
see [Import registry and structured plans](docs/import-registry.md).


What it does, so you do not have to:

- **Dates.** `data/added.json` records when each entry joined the hub, so
  *Newest first* shows the latest imports. Original source timestamps are
  preserved separately in `data/source-dates.json` and the import registry;
  importing an older game today does not bury it behind earlier imports.
- **Duplicates.** A page byte-identical to one already on the wall is skipped
  and reported. Running the same import twice changes nothing.
- **Clashes.** Nothing is ever overwritten. A second `snake.html` becomes
  `snake-<its folder>.html`. Names that differ only in case count as a clash,
  because they would collide on a Windows or macOS checkout.
- **Zips.** A package holding a finished game — a plain `index.html`, or a
  `dist/`/`build/` folder next to its source — is unpacked into a project
  folder. A zip of several single-file games becomes a collection. A package
  that is only source (a `package.json`, an `index.html` pointing at
  `/src/main.ts`) is reported as needing a build, not half-imported.
- **Root paths.** Bundlers write `src="/assets/index-3f2a.js"`, which inside the
  hub would point at the hub, not the game. Unpacked pages get those rewritten
  to relative paths. Anything it cannot fix (a bundle that builds URLs at
  runtime) is listed so you know which to rebuild with a relative base.
- **Secrets and clutter.** `.env` files, keys, `.git`, `node_modules` and
  `__MACOSX` are never copied into `games/`, which is public.
- **Source.** Opaque archives stay at their original input location. The importer
  does not copy them into the repository or deployment. Keep your originals;
  a successful runtime import is not a backup of source files or private data.

Afterwards it rescans and lists titles shared by more than one tile — often
the same game saved under different filenames. Those are never merged for you;
move them into one folder as `v1.html`, `v2.html` if they are builds of one game.

Before publishing a library import, check its genre, shelf (`Game`, `Tech demo`
or `Tool`), and any claimed source inspiration against the actual runtime.
Capture and inspect a real screenshot strip at `covers/<slug>/0.jpg`, `1.jpg`
and `2.jpg`: a title or initial view, followed by two useful game or tool views.
Use the shared 640×480 JPEG quality 58 format. Loading, blank and error screens
do not count as screenshots; keep uncertain model details unset.

When an import's identity is uncertain, set `"unsure": true` and a `reviewNote`
in its `data/overrides.json` entry. It appears on the **Unsure** shelf on the
wall and in the Couch, with its own screenshots and URL for comparison. Its
genre and type stay intact. Remove `unsure` once the identity is resolved.

**Local engine dependencies.** The importer also recognizes Three.js and
Rapier references from jsDelivr, unpkg, esm.sh, Skypack and JSPM, and rewrites
them to the exact version on the local library shelf. It handles both inline
HTML and separate JavaScript modules, adds the import maps needed by addons,
and leaves embedded engines and supplied local mappings alone. Unmapped bare
`three` and `@dimforge/rapier…` imports use the game's detected version, or the
latest version on the shelf when none is specified.
Unsupported versions or missing package files are reported and their references
are preserved. Games copied by hand must supply their own correct import map;
use `pnpm ingest` to apply the localization automatically.

The shelf includes all 13 Three.js releases from `0.180.0` through `0.186.1`
and all 12 official Rapier variants at `0.19.3`, `0.20.0` and `0.21.0`: 2D/3D,
standard/SIMD/deterministic, each with ordinary and compatibility packages.
See `lib/vendor/README.md` for paths, import maps and verification commands.

**Size.** GitHub refuses any single file over 100 MB and warns above 50 MB;
the scan flags both. Inputs or expanded packages over 95 MiB are reported and skipped. For the whole wall,
a library of ~400 games at ~2.5 MB each (~900 MB) packs to roughly 500 MB in
git, under GitHub's 1 GB recommendation and 2 GB push limit. Deploy it by
pushing: Vercel builds from the repo with room to spare, whereas `vercel
deploy` from the folder is capped at 100 MB of uploads on the Hobby plan.
Replaced builds stay in git history, so the repo grows with every update.

## Running it locally

```bash
pnpm dev          # http://localhost:4173
```

There is no build step and no `node_modules` — `pnpm install` has nothing to
install. The dev server re-scans `games/` on every refresh, so dropping a file
in and hitting reload is the whole loop. (It remembers each file's parsed head
until the file changes, so that stays instant at four hundred games.)

```bash
pnpm test         # parsers, layout rules, zip reading, search and filters, Couch and Catalogue logic
pnpm scan         # rebuild data/games.json by hand; --list prints every game
pnpm dev --host 0.0.0.0   # reach it from your phone on the same wifi
```

The scan's output is worth a glance after a big import. Past forty games it
prints a summary instead of every title, followed by anything that needs you:
files too large for GitHub, projects that still load files from the site root,
project folders whose extra pages might really be separate games.

## Playing

Clicking a cabinet runs the game **inside** the hub, so leaving it puts you back
on the wall with your scroll position, search and filters exactly as you left
them. Nothing is written into a game file to make that work — the hub only
attaches listeners to the game's document, which it is allowed to do because
the games are served from the same origin.

The bar in the corner has three buttons: **←** back to the wall, **🎲** roll
another random game from what the wall was showing, and **✕**. A tap of ✕
folds the bar down to just the ✕ (tap again to bring it back); holding it
removes the bar entirely until the hub is reloaded. The browser's Back button
always works too. The hub claims no keys while a game runs, so every key
belongs to the game.

If a game misbehaves in a frame, *Open on its own page* in its Details drawer
runs it in a plain tab.

Under the sign, the big buttons. **Games** (the default) has a row to itself.
Under it, five across: **All**, **Original** and **Inspired** (every game is
one or the other: an original has no `source`, an inspired one riffs on a
classic; from the other shelf they go back to Games), **Tech demos & tools**
(demos, tools and websites, the other shelf),
and **Surprise me**, which plays a random game from whatever the search and
filters are showing. The shelf comes from each game's `type` in
`data/overrides.json`; anything not catalogued counts as a game. The search
box sits in the sign's top corner.

Under those, a sticky toolbar of five dropdowns: **Genre**, **Players**,
**Filters**, **Sort** and **View**. Filters holds every other filter (Model,
Tags, File size, and whatever field the games carry next); it opens downwards
and each filter's values fly out to the right (in place on a phone). Choices
apply as you tap and a menu stays open, so you can tick several: several in
one filter widen the wall (Racing or Flight), different filters narrow it.
Players is *Single player* or *Multiplayer*, and Multiplayer opens head counts
(*4 players* finds every game that seats four). Whatever is filtering the wall
shows under the toolbar as chips with a ×, plus *Clear all*. Nothing shows a
count: an option that would empty the wall is greyed out instead. The filters
are worked out per shelf, and their order lives in `ORDER` in
`assets/js/manifest.js`.

### Sources and stacks

Many games are attempts at the same classic: nine at Dragon Quest, seven at
Final Fantasy Tactics. **View** decides how the wall stacks, remembered per
device. *Stack by source* is the default: each series is one stacked cabinet,
and originals that share a name (six Stratas) stack together. Open a series and
each game in it is a stack. Open one of those and every attempt is laid out. A
series with only one game skips the middle step, and a stack of one is just the
game. Each step is a link, so Back climbs out again. The trail at the top of the
wall shows where you are, and each game's drawer links to *All N attempts* at
the same game.

View can instead stack by **Genre**, **Players** or **Model** (pressing such a
stack filters the wall to it; games with no value for it follow the stacks),
or not at all. View also sets the size: *One per row* (the default: a wide
cabinet with its whole blurb beside the screen) or *Three per row*. A phone
shows one per row either way.

## Two more ways in: the Couch and the Catalogue

The wall is one way into the library. The switch in the corner of every view
(**Wall · Couch · Catalogue**) leads to two more, built over the same games
and the same memory of this device: a game starred in one is starred in all,
and a game played anywhere counts everywhere. An open game travels with you
when you switch, and so does a search, as far as it is plain words. Hidden
games stay hidden in all three.

### The Couch — `/couch`

The hub as a console's home screen, for a TV and a controller. One game at a
time fills the screen: its stills cross-fade behind everything, tinted with
its own colours, and its name, blurb, facts and keys sit over them. Under it
run the rails: *Jump back in*, *Your favourites*, *Fresh on the wall*, one per
genre, one for each series with three or more games (*Inspired by Final
Fantasy*) and each model that made three or more, *Originals*, *Play together*
and *Tech demos & tools*. Until you touch anything, the hero is *Today's
spotlight*, a pick that changes with the date.

| | Keyboard | Controller |
|---|---|---|
| Move | arrows; Home/End, PageUp/PageDown | D-pad or left stick |
| Play | Enter | A |
| More info | I | Y |
| Favourite | F | X |
| Back | Esc or Backspace | B |
| Previous / next rail | ↑ / ↓ | LB / RB |
| Search | / or S | View |
| Surprise me | R | Menu |

*More info* opens the game's own page: its stills as a gallery, its controls
turned into keycaps, its facts and builds, and two rails, *Other attempts at …*
and *More like this*. Search is a TV search screen with an on-screen keyboard
the pad can drive; on a keyboard, just type. A mouse and a touch screen work
too: point or tap to pick, click or tap again to play.

While a game runs the Couch claims nothing, keys and buttons alike. With no
mouse to reach the bar in the corner, **hold View and Menu together for a
second** to come back. Left alone for a minute, the home screen drifts through
random games, like a console's attract mode.

### The Catalogue — `/catalogue`

The hub as a reading room: every game a record, on paper instead of in a dark
room, to query, sort, chart, compare and export. Across the top, figures for
whatever is selected: how many records, how big, original against inspired,
models named, the newest addition, games with several builds.

The query is the whole selection, and it lives in the address, so any state of
the catalogue is a link. Bare words search everything, as on the wall; fields
narrow it down:

```
genre:racing   genre:"life sim"   model:gpt   source:"metal slug"   series:"final fantasy"
tag:pixel   type:demo   origin:original   players:2   players:multi
size:<500kb   size:1mb..4mb   added:>2026-09-20   added:2026-09-01..2026-09-15   added:<7d
builds:>1   is:fav   is:played   is:new   has:model

-genre:shooter              a minus leaves matches out
genre:racing genre:flight   one field twice: either
genre:rpg tag:3d            two fields: both
```

You rarely need to type it. Every facet on the left is a small bar chart, with
the whole library ghosted behind your selection, and clicking a bar adds its
term (shift-click leaves that value out). Drag across *Added over time* to
take a span of days; click a bin of *File size* for a range of sizes. Each
term shows as a chip under the query, with a ×, and `?` lists the syntax by
example.

The table sorts by any column and groups by genre, lineage, model or week
added. **↑ ↓** (or **j k**) move through it, **Enter** plays, **Space** marks a
record, **F** favourites, **O** opens a game on its own page, **/** writes a
query. Beside the table sits the record card: the game's stills and colours,
every fact it carries (each one a link that queries it), its lineage, meaning
every attempt at the same game in the order they arrived, then similar games
and builds. Mark two to four records and **Compare** lines them up side by
side, differences picked out. **Export** downloads the selection as CSV or
copies it as a Markdown table.

## Optional extras

None of this is needed. All of it is ignored if absent.

**Hand-made cover art** — drop `covers/<slug>.png` (or `.jpg`, `.webp`) and it
replaces the generated art for that game. Slugs are listed in `data/games.json`.

**Real screenshots** — `pnpm shots` opens each game, waits for its title screen
and saves a cover. Needs Playwright, which is not installed by default:

```bash
pnpm add -D playwright && pnpm exec playwright install chromium
pnpm shots                # four at a time; --jobs 8 for more, --only <slug> for one
```

A project with its own `og:image` already has a cover and is skipped.

**Extra metadata** — `data/overrides.json`, keyed by slug, wins over anything
scraped:

```json
{
  "undertow": {
    "model": "Claude Opus 5",
    "harness": "Claude Code",
    "status": "polished",
    "tags": ["pixel-art", "dungeon"]
  }
}
```

Here is the part worth knowing: **the filter rails are not declared anywhere.**
They are read off whatever the games actually carry. Fill in `model` on a few
games and a Model rail appears on the wall by itself; remove them and it goes.
Any field works, including ones invented on the spot. A game can also carry its
own, with `<meta name="hub:model" content="…">` in its head. A field whose
values are nearly all different (a build id, a URL) is searchable but never
becomes a rail. Every field is searchable. `harness` is searched and shown in
the drawer but never gets a rail, and neither do `source` and `series`, which
have Original, Inspired and the stacks.

`collection` comes from the folder a game sits in, but it is an ordinary field:
an override, or a `hub:collection` meta, replaces it.

The library's own catalogue uses these fields, all in `data/overrides.json`:

| Field | What it is | On the wall |
|---|---|---|
| `genre` | one of a fixed list (Racing, Platformer, Life Sim, Tech Demo…) | the Genre rail, and the cabinet's panel |
| `type` | `Game`, `Tech demo` or `Tool` | the shelf: games, or tech demos & tools |
| `tags` | 2–5 from a fixed vocabulary (`3d`, `retro`, `co-op`, `touch`…) | the Tags rail |
| `players` | `1–2`, `1–4`… only when a game has co-op or versus | the Players rail: *Single player*, or *Multiplayer*, which drops a menu of head counts (*4 players* finds every game that seats four). A game with no `players` is single player |
| `source` | the classic a game riffs on, as it is titled (`Dragon Quest IX`); none for an original | Original or Inspired, the stacks, the drawer, and search |
| `series` | the franchise, only when it is not the source itself (`Dragon Quest` for `Dragon Quest IX`) | the stacks |
| `controls` | a one-line summary | the drawer |
| `description` | one or two plain sentences | the drawer |

Every game with the same `source` must have the same `series`; `pnpm test`
checks. A game can name its own source with `<meta name="hub:source">`
(`hub:inspired-by`, the older name, still works). Source leads the rail strip.
Genre, Collection, Type and Players follow it when they exist; the
rest follow by how many games carry them. `docs/curation-2026-09-24.md`
records how the library was curated: which file of each game was kept, and
which older iterations it replaced. `docs/curation-2026-09-28.md` records the
import from the source-named GPT-games folder and maps the old slugs to the
current ones; `docs/curation-2026-09-28-new-ai-stuff.md` records the smaller
import that followed it.

Setting `"hidden": true` drops a game from the catalogue entirely.
`"restricted": true` keeps it in the catalogue but off the wall, where only dev
settings can bring it back — used for the companionship-business sims.

### Dev settings

There is no button for them. **Shift + F2** opens them on a keyboard; on a
phone, tap the "AI Hub" title five times quickly. A PIN is asked first (any of
0000, 1111, 1234, 8888, 9999) and stays unlocked for that browser tab until
you press Lock. Inside:

- **Show all content** — restricted games appear, flagged *Hidden*, and the
  sign shows a reminder while it is on
- **Show slugs and file sizes on cabinets**
- **Open every game in a plain tab** — for a game that misbehaves in the frame
- **This device** — forget play history, favourites, or plain-tab choices
- **Library** — counts per shelf, how many are hidden, size, when the
  catalogue was built

This is a lock for a shared screen, not security: the PINs live in the page's
JavaScript, and every game is a public file.

## How it is put together

```
games/            the drop zone
covers/           optional art, by slug
sources/          historical source packages; new imports leave originals at input
data/
  overrides.json  optional metadata, by slug
  added.json      first-seen dates, maintained automatically
  source-dates.json original source dates, used to order builds
  games.json      generated every build; gitignored, never edited
couch/            the Couch: a page of its own, over the same library
catalogue/        the Catalogue, likewise
assets/js/        native ES modules, no bundler
  color.js        theme-color → cabinet lighting, via OKLCH
  art.js          the six procedural screen patterns
  filter.js       search, facets, sorting, sources and stacks (pure, tested)
  library.js      the games every view starts from, less any hidden ones
  similar.js      other attempts, and "more like this" (pure, tested)
  ui/grid.js      the wall, rendered in batches as you scroll
  ui/player.js    the framed player and the ways out of it, for every view
  ui/views.js     the switch between the Wall, the Couch and the Catalogue
  couch/          rails, pad and keys, the game page, search (logic tested)
  catalogue/      the query language, tallies, table, record card, compare
scripts/
  scan.mjs        the build; walks games/, writes games.json
  ingest.mjs      bulk import of pages, folders and zips
  dev.mjs         local server, re-scans on every request
  shots.mjs       optional screenshots
  lib/layout.mjs  what a path is: game, build, project, collection
  lib/intake.mjs  what a package holds, and what never to import
  lib/zip.mjs     a small zip reader, so the project stays dependency-free
  audit3d.mjs     static rules every 3D game must pass (seconds)
  check3d.py      one 3D game in headless browsers, WebGL2 and WebGPU
  sweep3d.py      check3d over many games, grouped by error signature
  matrix3d.py     quality settings, a quality switch, and window sizes
lib/
  three/          three.js r186, the one copy every 3D game imports
  rapier/         Rapier 0.20 physics
  kit/            the shared 3D kit: boot, input, touch, post, physics
  vendor/         versioned Three.js and Rapier packages for imported games
```

The games on the shared kit run on the same stack: three.js r186 with `WebGPURenderer`
(WebGL2 when WebGPU is missing), loaded once from `lib/three` through an
import map, and the kit in `lib/kit` for boot, quality tiers and keyboard,
gamepad and touch input. `lib/kit/README.md` is the guide for porting or
fixing a game, including the traps found so far; `lib/README.md` covers
upgrading three.js and Rapier and the local patches to re-apply.

Imported games can instead keep their original engine version and renderer
through `lib/vendor/`. Those packages do not replace the patched shared stack.

Vercel runs `node scripts/scan.mjs` as the build command and serves the
repository. There is no framework and nothing is compiled.

### A note on colour

Games ship theme colours meant to sit *behind* a game, not to light a dark
room: Undertow's is `#050c12`, Little Orbit's is `#efe2c9`. Used as-is, half the
wall would be invisible and the other half would glare. Each one is taken into
OKLCH, its hue kept, and its lightness and chroma pushed into a band that reads
as a lit marquee. Only a game whose colour is a true grey has no hue to keep;
that one gets a stable hue hashed from its slug.

The rest of the interface has no colour of its own on purpose. Every saturated
pixel on the wall belongs to a game.

### Audio source review

On the **Wall**, open Dev settings with **Shift + F2** (not Ctrl + F2), or
five taps within 2.5 seconds on “AI Hub”. The existing PIN flow is unchanged: `0000`,
`1111`, `1234`, `8888`, or `9999`; unlock lasts for the tab until **Lock**.
Under **Audio source review**, select **Contains MP3**, **Contains WAV**, or
**MP3 or WAV (either)**. Tick **Explicit placeholder music** to intersect that
condition with the format selection, and type a title, tag or evidence phrase
in the review search. **Reset audio filters** clears all three controls.
The counts refer to individual catalogue records, across shelves, not stacks.
This review includes restricted catalogue records inside the unlocked panel;
it does not change wall visibility or the Show all content setting.

Expand a result for source paths, line numbers and short matching excerpts.
The inventory lists local files, inline payload identities and remote references;
remote audio is never downloaded by the scanner. `MP3`, `WAV`, and
`placeholder music` are generated in `audioTags` and are also searchable in the
ordinary wall, Couch and Catalogue search. Audio formats include voice and sound
effects, and are independent of placeholder music. Original-audio, provenance
and license statements are source claims, not automatic clearance or infringement
findings.

The normal scan/build, dev refresh and importer regenerate this inventory.
Project records own their folder's assets and source text; loose HTML records
follow resolvable literal local code/data/audio references, without assigning
unrelated files from their collection. Retained builds are combined per game.
Repeated local paths, inline payloads and remote URLs (ignoring query/fragment)
are deduplicated. Counts measure distinct reference identities, not tracks:
a remote source and its local copy remain separate identities; query-dependent
remote resources may be combined. Case of extensions and MIME aliases is ignored,
but filesystem path case is preserved.

This is a static English-text review aid. It recognizes explicit nearby music /
soundtrack / BGM placeholder statements, plus structured soundtrack-manifest
purpose evidence. It excludes detected negations and art/SFX/voice placeholders.
It may miss statements with unusual wording, other languages or distant context.
Text is read from HTML, JS/TS, JSON, Markdown, plain text, CSS and SVG. Unreferenced
loose assets, dynamically assembled paths, opaque encodings, archives, nonliteral
fetches, Web Audio synthesis and external code are outside its coverage. Absence
of a tag is not evidence of absence of audio or of license clearance.

Regression checks: `npm test`, `npm run build`, and (with optional Playwright
installed and the dev server running) `node scripts/audio-review-browser.mjs`.
Pass a site URL to the latter to verify deployed counts and controls.
