# AI Hub

An arcade wall for games built by AI models. Every game is one self-contained
HTML file; the hub finds them, dresses them, and gets out of the way.

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
`<head>` of each file:

| From the game | Becomes |
|---|---|
| `<title>Undertow — Seven Guardians Below</title>` | Name **Undertow**, tagline **Seven Guardians Below** |
| `<meta name="description">` | The blurb in the drawer |
| `<meta name="theme-color">` | That cabinet's marquee colour and the light it throws |
| `<link rel="icon" href="data:…">` | The emblem on its screen (a relative path works in a project folder) |
| `<meta property="og:image">` | Its cover art, in a project folder that ships the image |
| file size, the date in its name (or the date first seen) | The Weight rail, the Newest sort |

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
`model-unknown` is used until the model is known (`GPT-6-Astra-Pro`).

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

What it does, so you do not have to:

- **Dates.** Each file keeps its own modified date as the day it joined the
  wall, recorded in `data/added.json`, so *Newest first* is meaningful on day
  one instead of four hundred games sharing one commit time.
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
- **Source.** A zip that carried more than was unpacked — its source, or
  source with no build — is kept in `sources/`. That folder is committed with
  the (private) repo but never deployed. If a kept zip holds a `.env` or a key,
  the report says so; rotate the key or strip it from the zip before committing.

Afterwards it rescans and lists titles shared by more than one tile — often
the same game saved under different filenames. Those are never merged for you;
move them into one folder as `v1.html`, `v2.html` if they are builds of one game.

**Size.** GitHub refuses any single file over 100 MB and warns above 50 MB;
the scan flags both. A source zip over 95 MB is not kept. For the whole wall,
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
pnpm test         # the parsers, the layout rules, zip reading, search and filters
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

Ways out: the corner tab, the browser's Back button, the `` ` `` key, or holding
**Esc** for about a second. A *tap* of Esc is never intercepted, so a game's own
pause menu still works.

If a game misbehaves in a frame, the ↗ button in the corner reopens it in a
plain tab and remembers that choice for that game.

The wall is split into three shelves, picked with the big buttons under the
sign: **Games** (the default), **Tech demos**, and **Tools & websites**. The
shelf comes from each game's `type` in `data/overrides.json`; anything not
catalogued counts as a game. The filter rails under them are worked out per
shelf.

On a big wall: **Surprise me** plays a random game from whatever the search and
filters are showing, and the grid button beside the sort switches to a compact
wall with twice the cabinets per row (remembered per device). A rail with many
values shows the most common eight and folds the rest behind *+N more*.

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
becomes a rail. Every field is searchable.

`collection` comes from the folder a game sits in, but it is an ordinary field:
an override, or a `hub:collection` meta, replaces it.

The library's own catalogue uses these fields, all in `data/overrides.json`:

| Field | What it is | On the wall |
|---|---|---|
| `genre` | one of a fixed list (Racing, Platformer, Life Sim, Tech Demo…) | the Genre rail, and the cabinet's panel |
| `type` | `Game`, `Tech demo` or `Tool` | the Type rail, so demos and map viewers can be filtered out |
| `tags` | 2–5 from a fixed vocabulary (`3d`, `retro`, `co-op`, `touch`…) | the Tags rail |
| `players` | `1–2`, `1–4`… only when a game has co-op or versus | the Players rail |
| `inspiredBy` | the classic a game riffs on | the drawer, and search |
| `controls` | a one-line summary | the drawer |
| `description` | one or two plain sentences | the drawer |

Genre, Collection, Type and Players lead the rail strip when they exist; the
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
sources/          source packages kept by `pnpm ingest`; committed, never deployed
data/
  overrides.json  optional metadata, by slug
  added.json      first-seen dates, maintained automatically
  games.json      generated every build; gitignored, never edited
assets/js/        native ES modules, no bundler
  color.js        theme-color → cabinet lighting, via OKLCH
  art.js          the six procedural screen patterns
  filter.js       search, facets, sorting (pure, tested)
  ui/grid.js      the wall, rendered in batches as you scroll
  ui/player.js    the framed player and the ways out of it
scripts/
  scan.mjs        the build; walks games/, writes games.json
  ingest.mjs      bulk import of pages, folders and zips
  dev.mjs         local server, re-scans on every request
  shots.mjs       optional screenshots
  lib/layout.mjs  what a path is: game, build, project, collection
  lib/intake.mjs  what a package holds, and what never to import
  lib/zip.mjs     a small zip reader, so the project stays dependency-free
```

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
