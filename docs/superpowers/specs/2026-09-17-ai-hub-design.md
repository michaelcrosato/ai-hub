# AI Hub — design

**Date:** 2026-09-17
**Status:** approved, implementing

## Problem

Michael has 100+ games built by assorted AI models under assorted harnesses. Each is
a single self-contained HTML file. They are scattered, unbrowsable, and unshareable.
He wants one place to explore them, and to hand the link to friends and family.

The overriding constraint, in his words: *"it has to be easy to iterate or flexible
more so than anything else."* Adding game #101 must require no code change.

## Decisions

| Question | Decision |
|---|---|
| Access | Public Vercel URL. Repo stays private. No auth to explain to family. |
| Metadata | Auto-only. Nothing to hand-maintain. Overrides stay *possible*, never required. |
| Cover art | Procedural marquee per game, generated from its own `theme-color`. Optional Playwright screenshots, opt-in. Optional hand-drawn override. |
| Deploy | Vercel CLI, linked to the GitHub repo for push-to-deploy. |
| Game coupling | None at the file level. The hub reads each game's `<head>` at build time and never writes to it. |

## Architecture

Static site. **Zero npm dependencies** — `scan.mjs` uses only Node built-ins, the
front end is native ES modules with no bundler. `pnpm install` is a no-op; there is
nothing to keep up to date and nothing to break on a `pnpm audit`.

```
games/          DROP ZONE. *.html, any naming. Folders: see "Revision: 400 games" below.
covers/         Optional <slug>.png|jpg|webp — overrides the procedural art.
data/
  overrides.json  Optional hand-edited metadata. Wins over scraped values.
  added.json      Auto-maintained first-seen dates (mtime is useless post-clone).
  games.json      GENERATED. Gitignored. Rebuilt on every Vercel build.
assets/css|js/  The hub itself.
scripts/        scan.mjs (build), dev.mjs (local server), shots.mjs (optional).
index.html      The only page.
```

### scan.mjs — the one thing that makes it dynamic

Runs as the Vercel build command. For each `games/**/*.html`:

1. Derive `family` + `version` from the path.
2. Read the first 256 KB, slice to `</head>`, parse it.
3. `stat()` for byte size; resolve a first-seen date.
4. Merge `data/overrides.json[slug]` on top.
5. Group builds by family, mark the highest version `current`.
6. Write `data/games.json`.

**Head parsing must be order-agnostic.** `undertow.html` writes
`<meta content="..." name="description"/>` — attribute order reversed versus the
other three. A naive `name="description"[^>]*content="..."` regex silently drops it.
Parse each `<meta>` tag's attributes into a map, then look up by name. This is the
single most likely thing to break on a library of files written by different models,
so it is covered by tests.

**Version detection is deliberately conservative.** A trailing version is only
recognised as `-v0.4` (explicit `v`) or `-1.2` (dotted). A bare `-2` is NOT a
version, so `snake-2.html` stays its own game rather than becoming build 2 of
`snake`. False negatives are cheap (two tiles instead of one); false positives hide
a game.

**Title splitting.** Every sample title is `Name <sep> Tagline`. Split once on the
first `—  –  ·  :  |  /  -` and the left side becomes the display name, the right
the tagline, verbatim. "Little Orbit · The Coffee Post — A Comfortable Walk" becomes
name "Little Orbit", tagline "The Coffee Post — A Comfortable Walk".

### Facets are derived, not declared

The filter rails are built from whatever fields actually carry values across the
library. With auto-only metadata that yields Sort, Search, Favorites, Recently
played, and two derived rails (Weight from file size, Era from date). The day an
override sets `model` on five games, a Model rail appears by itself. No code change
in either direction. This is how "auto-only now" and "flexible forever" coexist.

### The player — connectivity without touching a game file

Games are served from the hub's own origin, so `iframe.contentDocument` is fully
reachable. The hub attaches a `keydown` listener to the game's document and mutates
nothing inside it. Verified against all four sample games: no frame-busting, no
pointer lock, one `requestFullscreen` (covered by `allow="fullscreen"`).

The hub is a single page; launching a game never unloads it. Scroll position,
search text and filters survive a play session because they were never torn down.

Exits: corner tab · browser Back · backtick · hold Esc ~700 ms. All four sample
games bind Escape themselves, so a *tap* is never intercepted and never
`preventDefault`ed — only a sustained hold counts, with a radial progress ring.

Failure path: if a game breaks framed, one click reopens it standalone and the
preference is remembered for that game.

## Testing

`node --test` over `scripts/`. The parser is pure and tested: reversed meta
attribute order, HTML entity decoding, version detection true/false positives,
title splitting, slug collisions, family grouping. The UI is verified by driving
the real site in a browser.

## Deliberately not built

Score reporting, save-state sync, per-game telemetry, comments, ratings, accounts,
a database. The hub boots a game and gets out of the way.

## Revision: 400 games (2026-09-23)

The library is growing from four games to roughly 400 projects in one import:
~370 single HTML files and ~25 zipped source packages. Reviewing the hub
against that scale found these problems. Each one was fixed.

| Problem at scale | Decision |
|---|---|
| Any subfolder was "one game, many builds", so `games/claude/*.html` would collapse 100 games into one tile | A folder names a game only when its files are bare versions (`v0.5.html`) or it holds an `index.html`. Any other folder is a **collection**: one tile per file, plus a derived `collection` field and rail. |
| Multi-file projects (unpacked zips) had no representation, and every page inside one would become a tile | A folder with `index.html` is a **project**: one game, entry `index.html`, nothing inside it scanned further. Relative favicons and `og:image` resolve against it. |
| Vite/webpack output uses root-absolute paths (`/assets/…`), which resolve against the hub | `pnpm ingest` rewrites them to relative on unpack. The scan warns about any project that still has them. |
| Committing imports gives every game the same git date, and a first-seen date recorded in `added.json` was overwritten by the commit date | Recorded dates now win over git. Ingest records each file's own mtime. |
| No bulk path from a pile of files and zips to `games/` | `scripts/ingest.mjs`: dedupe by hash, never overwrite, case-insensitive clash detection, zip unpacking via a built-in reader (`lib/zip.mjs`, zip64 aware), a junk/secret filter, and `sources/` for packages that carry more than a build (committed, `.vercelignore`d). |
| Every string field became a rail; a field of unique values would render 400 chips | A rail with more than 8 values needs shared values and at most 75% distinct values. It shows its top 8 and folds the rest behind "+N more". |
| Load-more sentinel could get pinned by scroll anchoring, stopping the wall at 72 tiles after a jump to the bottom | Sentinel is `overflow-anchor: none`, and the observer is re-armed after each batch. |
| The dev server re-read 400 heads on every refresh | Parsed heads are cached per file (size + mtime). Heads are read 64 KB first, up to 512 KB only when needed. |
| Oversized inline favicons would bloat the manifest every visitor downloads | Inline icons over 32 KB are dropped (reported), and builds no longer duplicate head data. |
| Browsing 400 tiles | "Surprise me" (random from the current filter), a remembered compact density, a two-row control strip, and accent-insensitive search across every field. |
