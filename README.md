# AI Hub

An arcade wall for games built by AI models. Games can be single HTML pages
or project folders with their own code and assets; the hub finds them, dresses
them, and gets out of the way. Shared engines live in `lib/`.

**Live:** <https://crosato-arcade.michael-crosato.workers.dev>, public, no
sign-in needed. Every push to `main` republishes it on Cloudflare Workers
(see [Publishing](#publishing)).

---

## Adding a game

Put the `.html` file in `games/`. That is the whole procedure.

```
games/Whatever_You_Called_It.html
```

Reload the wall on `pnpm dev` and it is there; push to `main` and the public
site has it a few minutes later. No code to touch, no list to edit, no naming
rules to remember: mixed case, spaces, underscores and hyphens are all fine.

```bash
git add games/ && git commit -m "Add Whatever You Called It" && git push
```

### Where the game's details come from

Nothing is typed in by hand. On every build, `scripts/scan.mjs` reads just the
`<head>` of each file for catalogue metadata (the audio inventory also reads
source text and asset paths):

| From the game | Becomes |
|---|---|
| `<title>Undertow — Seven Guardians Below</title>` | Name **Undertow**, tagline **Seven Guardians Below** |
| `<meta name="description">` | The blurb in the drawer |
| `<meta name="theme-color">` | That cabinet's marquee colour and the light it throws |
| `<link rel="icon" href="data:…">` | The emblem on its screen (a relative path works in a project folder) |
| `<meta property="og:image">` | Its cover art, in a project folder that ships the image |
| file size, the date first added to the hub | The File size rail, the Newest sort |

A game with none of these still works: it gets its filename as a name and a
colour derived from its slug.

### Names on the wall

No two entries show the same name. When names collide (case and accents
ignored), the entry added to the hub first keeps the plain name and later ones
are numbered in the order they were added: **Ashbound**, **Ashbound (2)**,
**Ashbound (3)**. The scan does it on every build, so a duplicate needs no
manual work, and nothing in the game file or the catalogue changes. Search
still finds each by its plain name, and attempts at one original still stack
under it. `pnpm test` fails if two entries ever show the same name.

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

Any name works, but the library names its files so that `games/` sorts into
families. The older entries put the source first:

```
games/Out-Run-SUPER-RUNOUT-The-coast-is-calling-2026-09-11-model-unknown.html
      source  title                             made       model
```

The source is the classic a game riffs on, or `original` when there is none;
`model-unknown` stands until the model is known (`GPT-6-Astra-Pro`). The date
and model say when and by what a file was made, not which game it is, so they
stay out of the slug (`out-run-super-runout-the-coast-is-calling`), and the
date becomes the game's source date. A later file with the same source and
title (`…-2026-10-02-model-unknown.html`) is a newer build of that game: one
tile, the newest in front, the older file in its drawer. To keep only the
newest, delete the older file. A filename cannot say where the source ends and
the title begins (`Out-Run` or `Out-Run-SUPER`?), so the wall's Original and
Inspired split reads the catalogue's `source` field instead (see
[Extra metadata](#extra-metadata)).

Entries imported since 2026-10-19 put the title first:
`GameTitle-SOURCE-model-effort-YYYYMMDD-HHMM.html`. Their title, inspiration,
model and effort are also recorded in `data/overrides.json`, so the filename is
never the display title, and the source-first grouping above does not apply to
them: two runs that differ in their bytes are two entries, numbered apart on
the wall (see [Names on the wall](#names-on-the-wall)).

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
and `og:image` with relative paths, and the wall uses them. A name starting
with `_` or `.` is skipped by the scan.

A game that should not be on the wall is deleted; git history keeps it. One
that should stay in the catalogue but off the wall is marked `restricted` (see
[Extra metadata](#extra-metadata)).

## Importing a lot at once

For a big pile (loose `.html` files, project folders, `.zip` packages, any mix
of them in any folder layout) use `pnpm ingest` instead of copying by hand:

```bash
pnpm ingest ~/exports --dry-run          # see the plan; nothing is written
pnpm ingest ~/exports                    # everything lands flat in games/
pnpm ingest ~/exports --keep-folders     # its top-level folders become collections
pnpm ingest ~/opus-games --into claude   # all of it into games/claude/
```

Machine-readable plans, provenance and the fingerprints that recognise a
package seen before are in [the import registry](docs/import-registry.md).
Where the library came from, batch by batch, is in
[the library's history](docs/library-history.md).

What it does, so you do not have to:

- **Dates.** `data/added.json` records when each entry joined the hub, so
  *Newest first* shows the latest imports. The game's own date is kept
  separately, in `data/source-dates.json` and the import registry, and orders
  its builds; importing an older game today does not bury it behind earlier
  imports.
- **Duplicates.** A page byte-identical to one already on the wall is skipped
  and reported. Running the same import twice changes nothing.
- **Clashes.** Nothing is ever overwritten. A second `snake.html` becomes
  `snake-<its folder>.html`. Names that differ only in case count as a clash,
  because they would collide on a Windows or macOS checkout.
- **Zips.** A package holding a finished game (a plain `index.html`, or a
  `dist/`/`build/` folder next to its source) is unpacked into a project
  folder. A zip of several single-file games becomes a collection. A package
  that is only source (a `package.json`, an `index.html` pointing at
  `/src/main.ts`) is reported as needing a build, not half-imported.
- **Root paths.** Bundlers write `src="/assets/index-3f2a.js"`, which inside the
  hub would point at the hub, not the game. Unpacked pages get those rewritten
  to relative paths. Anything it cannot fix (a bundle that builds URLs at
  runtime) is listed so you know which to rebuild with a relative base.
- **Engines.** Three.js and Rapier loaded from jsDelivr, unpkg, esm.sh,
  Skypack or JSPM are rewritten to the exact version on the local shelf,
  `lib/vendor/`, in inline HTML and in separate modules alike, with the import
  maps that addons need. Bare `three` and `@dimforge/rapier…` imports with no
  mapping get the game's detected version, or the newest on the shelf.
  Embedded engines and a game's own local mappings are left alone; an
  unsupported version or a missing package file is reported and its reference
  kept. A game copied in by hand must bring its own correct import map. The
  shelf holds every Three.js release from 0.180.0 to 0.186.1 and every official
  Rapier package at 0.19.3, 0.20.0 and 0.21.0, plus a few older pins; see
  [lib/vendor/README.md](lib/vendor/README.md).
- **Secrets and clutter.** `.env` files, private keys and other credentials
  (`.aws/`, `.ssh/`, `.git-credentials`, `.netrc`, `credentials.json`…),
  `.git`, `node_modules` and `__MACOSX` are never copied into `games/`, which
  is public, and a symbolic link is never followed. The report names what was
  left out, so a live key that came along can be rotated.
- **Originals.** Archives and source that hold no runnable game stay where
  they were; nothing is copied into the repository for safekeeping. Keep your
  originals: an import is not a backup.

Afterwards it rescans and lists titles shared by more than one tile, often the
same game saved under different filenames. Those are never merged for you;
move them into one folder as `v1.html`, `v2.html` if they are builds of one
game.

### Before publishing an import

Check each game's genre, shelf (`Game`, `Tech demo` or `Tool`) and any claimed
source against the game actually running. Capture a real screenshot strip at
`covers/<slug>/0.jpg`, `1.jpg` and `2.jpg`: a title or opening view, then two
useful game or tool views, each 640×480 JPEG at quality 58. Loading, blank and
error screens do not count. Leave details you are unsure of unset; when a
package does not say which version made it, Gemini means Gemini 4 Argon and
Muse means Muse Wonder 1.

Only when it is unclear whether an import is a game at all, or which game it
is, set `"unsure": true` and a `reviewNote` in its `data/overrides.json` entry.
It then sits on the **Unsure** shelf, on the wall and in the Couch, with its
own screenshots and URL for comparison, until the identity is settled and
`unsure` comes off. Its genre and type stay intact, and the shelf hides when it
is empty.

### Size

GitHub refuses any single file over 100 MB and warns above 50 MB; the scan
flags both, and the importer skips inputs or expanded packages over 95 MiB.
Cloudflare serves files up to 25 MiB, so publishing splits anything larger
into parts (see [Publishing](#publishing)). Replaced builds stay in git
history, so the repository only grows: today `games/` is about 3 GB on disk
and the packed history about 1.5 GB, inside GitHub's 2 GB limit per push and
its 5 GB recommendation for a repository.

## Running it locally

```bash
pnpm dev          # http://localhost:7417
```

There is no build step and no `node_modules`: `pnpm install` has nothing to
install. The dev server re-scans `games/` on every refresh, so dropping a file
in and hitting reload is the whole loop. The first scan reads every game in
full, about half a minute at two thousand games; it starts with the server, and
a page opened sooner waits for it. After that the server remembers what it read
from each game (its head, and the audio inventory with every path that
inventory looked at) until any of it changes, and a rescan takes under a
second.

```bash
pnpm test                 # parsers, layout rules, zip reading, search and filters, every view's logic, sessions
pnpm scan                 # rebuild data/games.json by hand; --list prints every game
pnpm dev --host 0.0.0.0   # reach it from your phone on the same wifi
pnpm release --local      # the published site, staged and served by Cloudflare's runtime on port 8787
```

The scan's output is worth a glance after a big import. Past forty games it
prints a summary instead of every title, followed by anything that needs you:
files too large for GitHub, projects that still load files from the site root,
project folders whose extra pages might really be separate games.

### Checks

`pnpm test` runs in about half a minute; run it before every commit. The
browser checks need Playwright, which the hub does not install: add it for the
session (`pnpm add -D playwright && pnpm exec playwright install chromium`)
and leave `package.json` as it was.

```bash
node scripts/explore-browser.mjs              # Atlas, Timeline and Deck, on pnpm dev or a site URL
node scripts/audio-review-browser.mjs         # the dev settings' audio review, likewise
node scripts/session-browser.mjs              # a whole session in four tabs, then two browsers over WebRTC
node scripts/hub-check.mjs games/mygame.html  # one game against the session protocol
node scripts/fill.mjs                         # which games fill the window, and which sit in a box
```

The first two check the server at `http://127.0.0.1:7417` unless given the
live site's address; the others start a server of their own. For 3D games,
`node scripts/audit3d.mjs` checks the shared kit's static rules in seconds,
and `scripts/check3d.py`, `sweep3d.py` and `matrix3d.py` run them in headless
browsers (see [lib/kit/README.md](lib/kit/README.md)). `pnpm libraries:check`
verifies the library shelf.

## Playing

Clicking a cabinet runs the game **inside** the hub, so leaving it puts you back
on the wall with your scroll position, search and filters exactly as you left
them. Nothing is written into a game file to make that work: the hub only
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

Under the sign, the big buttons. **Games** (the default) leads the first row,
with **Play with friends** beside it, the way into the Friends view (see
*Friends* below). Under them, five across: **All**, **Original** and
**Inspired** (every game is one or the other: an original has no `source`, an
inspired one riffs on a classic; from the other shelf they go back to Games),
**Tech demos & tools** (demos, tools and websites, the other shelf), and
**Surprise me**, which plays a random game from whatever the search and
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

## Seven ways into the library

The wall is one way into the library. The switch in the corner of every view
(**Wall · Friends · Couch · Catalogue · Atlas · Timeline · Deck**) leads to six
more, built over the same games and the same memory of this device: a game
starred in one is starred in all, and a game played anywhere counts everywhere.
An open game travels with you when you switch, and so does a search, as far as
it is plain words. Games kept off the wall stay off in all seven.

Playing with friends is never more than a glance away. Beside the account
control in every view's corner sits the one light button, **Play with
friends**, to the Friends view. Every game that plays in a session says so
where you would play it: *With friends* on its cabinet, *Play with friends*
under Play in its details (the wall, the Atlas, the Timeline, the Catalogue's
record), on the Couch's hero and game page, and on the Deck's card. Each of
them opens the game's page in the Friends view.

### Friends — `/friends`

The hub as a game-night console, for playing with other people:

- **The party.** *Host a game night* (Google sign-in, then the session's
  lobby with an invite link), *Got an invite?* (paste the link, the code, or
  a message with the link in it; it finds the ten-character code), and *Try a
  session on this computer*, in up to four tabs with the hub's practice games.
- **Made for game night**: the games built for sessions by hand (Blaze Cup,
  Merry-Go-Kart 64, Grand Theft Motto III, Arwingdings, Brine Line 64,
  Urethane, Slick & Skid; `SPOTLIGHT` in `assets/js/friends/together.js`),
  else the newest shared worlds.
- **How a session works**, in three steps, and the **ways to win**.
- **Games to play together**: every game that plays in a session, filed by
  how it plays (*One world for everyone*, a shared world; *Race each other's
  ghosts*, ghost; *Same start, side by side*, parallel) and *Couch co-op*,
  the games that seat several players on one screen by themselves (their
  `players`). The toolbar narrows them by the party's size (2, 3, 4), the way
  it plays, a session round's length and a search; each choice shows how
  many games it leaves. A browser with no WebGPU is told how many of them need
  it, and those cards say so.
- **A game's page** (`/friends#/g/<slug>`): how it plays together, its goal,
  controls, seats and round length, and the ways to start it: *Host with this
  game* (a session that opens with it, then deals the rest), *Try it on this
  computer*, and *Practise alone* in the hub's player. A couch co-op game has
  *Play on this screen*.

### The Couch — `/couch`

The hub as a console's home screen, for a TV and a controller. One game at a
time fills the screen: its stills cross-fade behind everything, tinted with
its own colours, and its name, blurb, facts and keys sit over them. Under it
run the rails: *Jump back in*, *Your favourites*, *Fresh on the wall*, *Play
with friends* (the games that play in a session), one per genre, one for each
series with three or more games (*Inspired by Final Fantasy*) and each model
that made three or more, *Originals*, *Couch co-op* (several players on this
screen) and *Tech demos & tools*. Until you touch anything, the hero is
*Today's spotlight*, a pick that changes with the date.

| | Keyboard | Controller |
|---|---|---|
| Move | arrows; Home/End, PageUp/PageDown | D-pad or left stick |
| Play | Enter | A |
| More info | I | Y |
| Favourite | F | X |
| With friends (a game that plays in a session) | P | the hero's button |
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
builds:>1   is:fav   is:played   is:new   has:model   has:session

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

### The Atlas — `/atlas`, the Timeline — `/timeline`, the Deck — `/deck`

- **The Atlas** is a transit map of the library's genres. Pick a district,
  then browse its departure board to find a game. Map and board pages keep
  large districts manageable, with every entry reachable. Each departure has
  artwork, Play, Details and a favourite control. The selected district lives
  in the URL.
- **The Timeline** is a journal of the library as it grows. Select a month or
  a day, switch between newest and oldest, and browse entries grouped by the
  date they arrived on the hub (not the date the game was made). Load more to
  continue through large days; entries without dates have their own section.
  Date and order selections can be shared as links.
- **The Deck** deals one shuffled game at a time, with artwork and a short
  description. Play it, save it as a favourite, or skip to the next card.
  Previous retraces your picks; finishing the deck offers a fresh deal. The
  seed and current card live in the URL, so reopening a link restores the same
  order. **Unplayed only** uses this device's play history.

All three include text search, Games / All entries / Tech demos & tools /
Unsure shelves, favourites, details with older builds, and the shared player.
Press **/** to search and **Escape** to close details. The player's back button
returns to the current selection. Search, shelf and favourites changes reset
the view's narrower selection; **Reset selection** clears it all.

## Playing together: AI Hub sessions

Every game can be played with up to three friends, each on their own device,
through an **AI Hub session**: the hub deals the games, keeps the clock,
carries the network traffic and keeps score. There is no chat and no way for
players to message each other; they talk in an app of their own.

What a game must do is the **AI Hub Session Protocol**,
[`lib/hub/README.md`](lib/hub/README.md), also at
<https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/README.md>.
That page is the whole interface, the one thing handed to whichever agent
builds a game, so it holds only the interface and the hub's facts: no example
values, suggested numbers or design advice, since an agent takes any of those
as the way to build the game. A game declares one of three modes:

- **Parallel**: everyone plays their own copy, from the same start, on the
  same clock, and the hub draws a live scoreboard from each copy's progress.
  Every game with a score or a finish can do it, with no networking, and it is
  how the existing library joins sessions.
- **Ghost**: parallel, and each copy also shows the other players' characters
  while they are in the same area of the game, without them touching its
  world.
- **Shared world**: one world for everyone, run by the host's copy.

Games tagged with the older modes keep working: `race` plays as ghost, `co-op`
and `versus` as a shared world. In short, a game carries the `hub:session`
metas in its head and the small `session.js` client, pasted in unmodified as
its first script, and reports each round with its stats and awards; outside a
session it plays exactly as it always would. Everything the hub does around a
round (points, awards, formats, the deal, the scoreboard, what travels where,
and why it is built that way) is in [`docs/session-hub.md`](docs/session-hub.md).

A game that declares it shows a *Hub session* line in its details
(`1–4 players · Parallel · about 4 min`), and the Catalogue finds them all
with `has:session`. Those fields never become rails, and a parallel game is
not a multiplayer game on the wall: each player plays alone. Games built for
sessions include **Blaze Cup** (a shared world, in teams), **Arwingdings**,
**Merry-Go-Kart 64**, **Brine Line 64** and **Urethane Switchyard** (tagged
race, so played as ghost), and **Grand Theft Motto III** (a shared world: the
whole campaign, together).

### Testing a game

The harness loads 1–4 copies of a game next to each other on a simulated
network:

```
pnpm dev
http://localhost:7417/lib/hub/harness.html?game=/games/mygame.html&players=4&latency=150&jitter=50&loss=5
```

`node scripts/hub-check.mjs games/mygame.html` runs the automatic conformance
checks with Playwright: a parallel game at 1 and 2 players, a ghost game or a
shared world at 2, 3 and 4 on a bad network (within the seats it declares),
each with a player leaving, then the game on its own. `--record` writes the
verdict into `data/overrides.json`, where a failing game gets `"session": "0"`
and is never dealt. The three examples in `lib/hub/examples/` (**Starfall**,
parallel; **Comet Dash**, ghost; **Star Arena**, a shared world) are the hub's
reference games and pass it; the protocol page does not link them, so no agent
copies them.

### Bringing the library to sessions

Two scripts keep thousands of games on the protocol without editing them by
hand:

```bash
node scripts/hub-client.mjs                         # which client every game carries
node scripts/hub-client.mjs --write games/claude    # upgrade the unmodified ones, a batch at a time
```

A pasted client is replaced only when it is exactly a released one (its hash
is in `scripts/lib/hub-client.mjs`), so an edited copy is listed and left
alone. Clients only add, so an older one keeps working; upgrade when games
should use something new.

```bash
mkdir -p .cache
node scripts/retrofit.mjs pick --wave 1 > .cache/wave1.txt   # one build of each title: readable, no WebGPU needed; smallest first
awk 'NR % 7 == 0' .cache/wave1.txt > .cache/pilot.txt        # a pilot of about thirty, small to large
node scripts/retrofit.mjs run $(cat .cache/pilot.txt) --jobs 2 \
  --agent "claude -p --model claude-haiku-5-5 --max-turns 30 --permission-mode acceptEdits --output-format json" \
  --agent "claude -p --model claude-sonnet-5-5 --max-turns 30 --permission-mode acceptEdits --output-format json"
```

`retrofit.mjs` brings an existing game to parallel, game by game:

- It first asks whether this browser can run the game at all
  (`hub-check --draws-only`), and spends nothing on one it can't: a WebGPU-only
  game in a browser without WebGPU, even when its title screen shows. On a
  machine without a GPU, `--browser-args` with SwiftShader's flags (in
  `scripts/hub-check.mjs`) gives such games a software adapter.
- A tool step puts the client and the metas first in its head (`prepare`).
- A model, cheapest first, wires the score, the end and the session steps from
  the prompt in [`lib/hub/retrofit.md`](lib/hub/retrofit.md), which quotes the
  protocol from *Modes* to *Rules*, word for word. It works on a copy of the game in
  a folder of its own, so it can change nothing else and two jobs never meet.
- The static check (`check`), a budget of 150 changed lines, and
  `hub-check --retrofit` judge it: two players with one leaving, then the game
  on its own compared with the original.
- Each model gets a second try with what failed, then the next one does, up to
  `--max-cost` dollars a game.
- A game that passes keeps its changes for you to review. Any other is put back
  exactly as it was, with a `sessionNote` in `data/overrides.json` saying why,
  so later runs skip it (`--again` retries).

Every try lands in `.cache/retrofit.jsonl` with its cost when the agent prints
one. Run a pilot of about thirty varied games, read the pass rate and cost per
game, play a few that passed, then do the rest in waves. Nothing is committed
for you: commit what passed in batches of about fifty.

### A session — `/session`

Players pick a generated name and take one of four seats; the host picks how
to win (**Party**: 8 rounds and three bonus awards worth 3 points each;
**Sprint**: 5 rounds; **First to 12**; **Endless**) and starts.

- **Up next** holds the host's own picks: *Pick the games* opens every game the
  players present can play, searchable and by mode, and each tap adds one to
  the end of the list or takes it off, up to twelve. They play first, in that
  order. A session hosted from a game's page in the Friends view
  (`/session?first=<slug>`) opens with that game on the list.
- After the picks, **Random Mode** deals every game that declares
  `hub:session` and seats everyone, in an order fixed by the session's seed,
  none twice until all have been played. In the lobby, before the first round
  or after *Back to the lobby*, the host can narrow the deal by mode, round
  length, genre, model, effort and month added; each choice shows how many
  games it leaves.
- The moment a round ends, the results land over it while the next game loads
  underneath; a card then shows the next game, how to win it and its controls,
  for the 10, 20 or 30 seconds the host chose, and lifts on its ready prompt.
  The table: one point for every player beaten, then wins, then average place.
  When the format says so, a final screen crowns the winner with a podium and
  the session awards.
- The seated tab with the lowest seat hosts; if it leaves, the next seat takes
  over.

**Across devices**, the host signs in with Google, picks a name, and gets an
invite link, `/session#<code>`. Friends open it and play as guests, no account
needed (behind the scenes each guest gets an anonymous account). Each seat
shows its connection, and the host can remove a player. Every round is saved.
Presence, round control and the WebRTC handshake go over the session's private
Supabase Realtime channel; game traffic goes straight between the players'
browsers, through a Cloudflare TURN relay where they cannot connect directly.
**Relay only** in the lobby sends all of a player's connections through the
relay, so the others never see that device's IP address. A session nobody
ended is closed after a day without activity.

**Between tabs of one browser**, no accounts, which is how to try games on one
machine:

```
pnpm dev
http://localhost:7417/session?transport=local&examples=1#try      (open it in up to four tabs)
```

`examples=1` adds the reference games to the deal. The host's address can
shorten things for testing, in seconds: `&limit=20` (a round's limit),
`&results=5` (the results card), `&splash=5` (the card's countdown) and
`&grace=10` (how long a round waits for a slow game to load).

## Signing in, votes and play time

Nobody needs an account to play. **Sign in** (top corner of every view) uses
Google, and is only for:

- 👍 or 👎 on a game: in its details, or offered after you close a game you
  played for half a minute;
- your play history on every device: which games, and for how long they were
  open in front of you;
- hosting a session.

The hub asks Google for nothing but who you are, and shows nobody your Google
name or photo. The account menu has *Play with friends* (the Friends view),
*Privacy*, *Sign out* and *Delete my data*. What is stored is on
[`/privacy/`](https://crosato-arcade.michael-crosato.workers.dev/privacy/).

How it's built:

- The accounts live in the Supabase project `ai-hub` (ref
  `ncbiljxbxfrotlszdghi`). `supabase/migrations/` holds the tables, and the
  row-level security that decides who may read or change each row. Every
  write goes through a function that checks who is asking.
  `supabase/tests/rls.sql` checks all of it in one self-cleaning run of the
  SQL editor.
- The `turn` Edge Function (`supabase/functions/turn/`) hands signed-in players
  short-lived Cloudflare TURN credentials. It answers the live site and local
  dev only. Supabase is changed from its dashboard: migrations in the SQL
  editor, the function in the Edge Functions editor.
- The page code is in `assets/js/account/`. It loads the vendored supabase-js
  only for a signed-in device.
- Google sends you back to `/auth/` on the address you signed in from, which
  must be on the project's redirect list (Authentication → URL Configuration):
  the live site and the dev server, `http://localhost:7417` and
  `http://127.0.0.1:7417`. A sign-in is kept in that address's browser storage.
- If Supabase is unreachable or paused, sign-in hides and everything else
  works as before. The free project pauses after about a week without use;
  resume it from the Supabase dashboard.

Known limits:

- Games run on the hub's own origin, so a game could read the signed-in
  user's Supabase token. Row-level security confines the damage to that
  user's own votes, plays and sessions, and Google's tokens are not kept.
  The real fix is serving games from a separate custom domain.
- Peer-to-peer play shows players' IP addresses to each other (`/privacy/`
  says so), unless a player turns on **Relay only** in the lobby.

## Optional extras

None of this is needed. All of it is ignored if absent.

**Hand-made cover art.** For a game with no screenshot strip, drop
`covers/<slug>.png` (or `.jpg`, `.webp`) and it replaces the generated art.
Slugs are listed in `data/games.json`. A strip, `covers/<slug>/0.jpg` to
`2.jpg`, always wins.

**Real screenshots.** `pnpm shots` opens each game without a cover, waits for
its title screen and saves one. It needs Playwright (see [Checks](#checks)):

```bash
pnpm shots                # four at a time; --jobs 8 for more, --only <slug> for one
```

A project with its own `og:image` already has a cover and is skipped.

### Extra metadata

`data/overrides.json`, keyed by slug, wins over anything scraped:

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
Genre, Collection, Type and Players follow it when they exist; the rest follow
by how many games carry them.

`"restricted": true` keeps a game in the catalogue but off the wall, where
only dev settings can bring it back; it is used for the companionship-business
sims.

### Dev settings

There is no button for them. **Shift + F2** opens them on a keyboard; on a
phone, tap the "AI Hub" title five times quickly. A PIN is asked first (any of
0000, 1111, 1234, 8888, 9999) and stays unlocked for that browser tab until
you press Lock. Inside:

- **Show all content**: restricted games appear, flagged *Hidden*, and the
  sign shows a reminder while it is on
- **Show slugs and file sizes on cabinets**
- **Open every game in a plain tab**, for a game that misbehaves in the frame
- **This device**: forget play history, favourites, or plain-tab choices
- **Library**: counts per shelf, how many are kept off the wall, size, when
  the catalogue was built
- **Audio source review**, below

This is a lock for a shared screen, not security: the PINs live in the page's
JavaScript, and every game is a public file.

### Audio source review

In the Wall's dev settings, **Audio source review** finds games by the audio
they ship: **Contains MP3**, **Contains WAV**, or **MP3 or WAV (either)**, and
**Explicit placeholder music** on top of that, narrowed by a search over
titles, tags and evidence. **Reset audio filters** clears them. Counts are
catalogue records across every shelf, restricted ones included, not stacks;
the review changes nothing on the wall. Expand a result for its source paths,
line numbers and short matching excerpts. `MP3`, `WAV` and `placeholder music`
are also searchable in the ordinary wall, Couch and Catalogue search.

The scan, the dev server and the importer rebuild the inventory. A project
owns its folder's assets and source text; a loose page follows the local code,
data and audio files it names literally; a game's builds are combined, and
repeated paths, inline payloads and remote URLs are counted once. Remote audio
is never downloaded. Placeholder music means an explicit statement near the
reference that the music, soundtrack or BGM is a placeholder, or a soundtrack
manifest that says so; negations and art, sound-effect or voice placeholders
are left out.

It is a static, English-text review aid, not a licence check: it can miss
unusual wording, other languages, assets nobody references, paths built at
run time, archives, synthesised audio and external code, and the absence of a
tag proves nothing. Provenance and licence statements are the source's claims.
With the dev server running and Playwright installed,
`node scripts/audio-review-browser.mjs` checks the panel and its counts.

## How it is put together

```
games/            the drop zone
covers/           screenshot strips (covers/<slug>/0–2.jpg) and hand-made covers
data/
  overrides.json  the catalogue: metadata by slug
  added.json      first-seen dates, maintained automatically
  source-dates.json  the games' own dates, used to order builds
  import-registry.json  fingerprints and provenance of imported packages
  games.json      generated by every scan; gitignored, never edited
couch/            the Couch: a page of its own, over the same library
catalogue/        the Catalogue, likewise
atlas/            the Atlas: genre districts and departure boards
timeline/         the Timeline: a journal of arrivals
deck/             the Deck: one shuffled discovery at a time
friends/          the Friends view: host or join, and every game that plays together
session/          a session: friends, the host's picks, Random Mode and the table
auth/             where Google sends you back after signing in
privacy/          what is stored, and how to delete it
assets/js/        native ES modules, no bundler
  color.js        theme-color → cabinet lighting, via OKLCH
  art.js          the six procedural screen patterns
  filter.js       search, facets, sorting, sources and stacks (pure, tested)
  library.js      the games every view starts from, less any kept off the wall
  similar.js      other attempts, and "more like this" (pure, tested)
  ui/grid.js      the wall, rendered in batches as you scroll
  ui/player.js    the framed player and the ways out of it, for every view
  ui/views.js     the switch between all seven selection interfaces
  ui/friends.js   Play with friends: the four-seat emblem, the corner button, a game's link
  friends/        the Friends view; together.js is what plays together, and how (pure, tested)
  explore/        Atlas, Timeline, Deck and their shared search/player shell
  couch/          rails, pad and keys, the game page, search (logic tested)
  catalogue/      the query language, tallies, table, record card, compare
  session/        seats, names, the host's picks (chooser.js), Random Mode, scoring; local, Realtime and WebRTC transports
  account/        sign-in, votes, play time, the account menu
assets/vendor/    supabase-js, pinned and checked
cloudflare/       the Worker and its Wrangler config
supabase/         migrations, RLS tests and the turn Edge Function (deployed to Supabase, not with the site)
docs/             how sessions work, the import registry, the library's history
scripts/
  scan.mjs        the build: walks games/, writes games.json
  ingest.mjs      bulk import of pages, folders and zips
  dev.mjs         local server, re-scans on every request
  release.mjs     publish to Cloudflare: only what the site serves, shelf trimmed to what games load
  shots.mjs       optional cover screenshots
  lib/layout.mjs  what a path is: game, build, project, collection
  lib/intake.mjs  what a package holds, and what never to import
  lib/zip.mjs     a small zip reader, so the project stays dependency-free
  audit3d.mjs     static rules every 3D game must pass (seconds)
  hub-check.mjs   a game against the session protocol, for its mode; --record keeps the verdict
  hub-client.mjs  every game's pasted session client, upgraded by script
  retrofit.mjs    an existing game brought to parallel: tool, model, checks
  session-browser.mjs  a whole session in four tabs, end to end
  explore-browser.mjs, audio-review-browser.mjs, fill.mjs  browser checks
  vendor-libraries.mjs, check-libraries.mjs  refresh and verify the library shelf
  check3d.py      one 3D game in headless browsers, WebGL2 and WebGPU
  sweep3d.py      check3d over many games, grouped by error signature
  matrix3d.py     quality settings, a quality switch, and window sizes
lib/
  three/          three.js r186, the one copy every 3D game on the kit imports
  rapier/         Rapier 0.20 physics
  kit/            the shared 3D kit: boot, input, touch, post, physics
  hub/            the AI Hub Session Protocol: spec, client, harness, examples
  vendor/         versioned Three.js and Rapier packages for imported games
```

The games on the shared kit run on the same stack: three.js r186 with
`WebGPURenderer` (WebGL2 when WebGPU is missing), loaded once from `lib/three`
through an import map, and the kit in `lib/kit` for boot, quality tiers and
keyboard, gamepad and touch input. `lib/kit/README.md` is the guide for porting
or fixing a game, including the traps found so far; `lib/README.md` covers
upgrading three.js and Rapier and the local patches to re-apply. Imported games
can instead keep their original engine version and renderer through
`lib/vendor/`; those packages do not replace the patched shared stack.

### Publishing

The site is a Cloudflare Worker, `crosato-arcade`, serving static files at
<https://crosato-arcade.michael-crosato.workers.dev>. There is no framework and
nothing is compiled.

**Every push to `main` republishes it.** Workers Builds, Cloudflare's Git
integration, is connected to this repository (Cloudflare dashboard → Workers &
Pages → `crosato-arcade` → Settings → Build). On each push to `main` it clones
the repository and runs `node scripts/release.mjs` as the deploy command; the
whole build takes about five minutes, and GitHub shows its result as the check
*Workers Builds: crosato-arcade* on the commit. The build command is empty,
other branches do not build, and the free plan includes 3,000 build minutes a
month.

`pnpm release` is the same deploy run from your own machine (after
`npx wrangler login`). It rescans, then stages only what the site serves into
`.cache/release/site` as hard links: no `docs/`, `scripts/`, `supabase/` or
other repository files, and the library shelf cut to the files games actually
load (about 14,700 files in all, under the free plan's 20,000 per version). It
splits any file over Cloudflare's 25 MiB limit into parts that
`cloudflare/worker.js` streams back whole, writes the cache rules into a
`_headers` file, and deploys with Wrangler, which uploads only the files
Cloudflare does not already have. The catalogue and the hub's own code always
revalidate; games, covers and engines may be served a little stale while the
fresh copy loads. `--dry-run` stages and reports; `--local` serves the staged
site with Cloudflare's runtime on port 8787.

The Worker itself runs only for a path with no file behind it: a folder, which
gets its `index.html`, and a split file, which it streams back from its parts.

### A note on colour

Games ship theme colours meant to sit *behind* a game, not to light a dark
room: Undertow's is `#050c12`, Little Orbit's is `#efe2c9`. Used as-is, half the
wall would be invisible and the other half would glare. Each one is taken into
OKLCH, its hue kept, and its lightness and chroma pushed into a band that reads
as a lit marquee. Only a game whose colour is a true grey has no hue to keep;
that one gets a stable hue hashed from its slug.

The rest of the interface has no colour of its own on purpose. Every saturated
pixel on the wall belongs to a game.
