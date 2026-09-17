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
| `<link rel="icon" href="data:…">` | The emblem on its screen |
| file size, first commit date | The Weight rail, the Newest sort |

A game with none of these still works — it gets its filename as a name and a
colour derived from its slug.

### Several builds of one game

Two ways, whichever suits the moment:

```
games/Void-Explorer-v0.4.html      ← same folder, version in the name
games/Void-Explorer-v0.5.html         v0.5 becomes current, v0.4 moves to history

games/void-explorer/v0.4.html      ← or a folder per game
games/void-explorer/v0.5.html
```

One tile either way, showing the newest build, with the older ones a click away
in its drawer.

A version is only recognised when it is unmistakable: `-v2`, `-v0.4`, `-1.2`.
A bare trailing number is left alone, so `snake-2.html` stays its own game
rather than quietly becoming build 2 of `snake`. Hiding a game by accident is
worse than showing one tile too many.

## Running it locally

```bash
pnpm dev          # http://localhost:4173
```

There is no build step and no `node_modules` — `pnpm install` has nothing to
install. The dev server re-scans `games/` on every refresh, so dropping a file
in and hitting reload is the whole loop.

```bash
pnpm test         # the head parser, which is where the sharp edges are
pnpm scan         # rebuild data/games.json by hand
pnpm dev --host 0.0.0.0   # reach it from your phone on the same wifi
```

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

## Optional extras

None of this is needed. All of it is ignored if absent.

**Hand-made cover art** — drop `covers/<slug>.png` (or `.jpg`, `.webp`) and it
replaces the generated art for that game. Slugs are listed in `data/games.json`.

**Real screenshots** — `pnpm shots` opens each game, waits for its title screen
and saves a cover. Needs Playwright, which is not installed by default:

```bash
pnpm add -D playwright && pnpm exec playwright install chromium
pnpm shots
```

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
own, with `<meta name="hub:model" content="…">` in its head.

Setting `"hidden": true` keeps a game in the repo but off the wall.

## How it is put together

```
games/            the drop zone
covers/           optional art, by slug
data/
  overrides.json  optional metadata, by slug
  added.json      first-seen dates, maintained automatically
  games.json      generated every build; gitignored, never edited
assets/js/        native ES modules, no bundler
  color.js        theme-color → cabinet lighting, via OKLCH
  art.js          the six procedural screen patterns
  filter.js       search, facets, sorting (pure, tested)
  ui/player.js    the framed player and the ways out of it
scripts/
  scan.mjs        the build; walks games/, writes games.json
  dev.mjs         local server, re-scans on every request
  shots.mjs       optional screenshots
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
