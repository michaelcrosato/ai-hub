# AI Hub sessions: the hub's side

What the hub does around a round, and how a round travels between the
devices. Games never need this page: the protocol a game follows is
`lib/hub/README.md` (served at
<https://crosato-arcade.vercel.app/lib/hub/README.md>), and that is the only
thing the game factory is given. This page is for whoever changes the hub:
`lib/hub/` (client, bridge, round, harness) and `assets/js/session/` (the
session page).

## Around a round

A game only plays its round. Everything around it belongs to the hub and is
the same for every game, so players learn it once.

### Points and wins

- Each round, a player scores **one point for every player they beat**. A
  player who left or sat out without reporting counts as beaten; one who
  reported and then left keeps their place. Tied players share a place. Every
  round of four is worth three points to its winner, whatever the game.
- **First place is a win**; in co-op only when the team won (`won: true`).
- The **table** orders players by points, then wins, then the better average
  place (`assets/js/session/score.js`).

### Awards

- **Game awards** come from a game's `result()` or `finish()`. The hub shows
  them on the results, in the player's colour, and counts them for the
  session.
- **Session awards** are the hub's, given when a session ends:
  **Showstopper** (most game awards), **Hot streak** (most wins in a row, at
  least two) and **Steady hand** (best average place).

### Ways to win a session

The host picks a format in the lobby:

| Format | Ends | Winner |
|---|---|---|
| **Party** (default) | after 8 rounds | most points, after the three session awards add **3 bonus points** each, so the last word is never certain |
| **Sprint** | after 5 rounds | most points |
| **First to 12** | when someone has 12 points after a round | that player |
| **Endless** | when the host ends it | most points |

Ties go to more wins, then the better average place, and otherwise stay ties.

### The deal

Random Mode deals every game that declares `hub:session`, seats the players
present and sits on the Games shelf (`assets/js/session/pick.js`). A game
whose `data/overrides.json` entry says `"session": "0"` is never dealt:
`scripts/hub-check.mjs --record` writes that, with a `sessionNote`, for a game
that fails the check, and takes it off again when the game passes.

Side-by-side games (`parallel`) far outnumber the ones played together (race,
versus, co-op), so the deal keeps them as two decks and alternates between
them while both have games, starting with one played together. Each deck is
shuffled from the session's seed and played through before any of its games
comes round again.

Within a deck the deal counts titles, not builds: one build of each title
(`lineageKey`: the same source, or for an original the same name), chosen at
random, so a source with hundreds of runs is one game among the others.

The seats' browsers decide too. Each seat says in its presence whether it has
a WebGPU adapter (a real one, not a software fallback) and whether it has
nothing but a touch screen. A game declaring `hub:webgpu` `required` is dealt
only when every seat has WebGPU; when a seat is touch-only, the deal keeps to
games tagged `touch` while any fit. The lobby's count of games uses the same
rules.

### Between rounds

Fast is the point. From one round's last whistle to the next round's
countdown takes about fifteen seconds, less when everyone presses Ready:

1. **Results**, the moment a round ends, over the game: places, points, stats
   and awards, and the table moving (about 5 seconds).
2. **The card** (the splash): a quick spin through the deck lands on the next
   game and shows its name, its mode, `hub:session-goal` and
   `hub:session-howto`, with a 10-second countdown that starts the round by
   itself. The next game has been loading underneath since the results
   appeared.
   - **Ready** (Enter, or Cross on a controller): when every player has
     pressed it, the round starts at once.
   - **I need more time** (Triangle): adds 10 seconds, and tells the others
     *A player needs more time* without saying who. While more than half the
     players are asking, the countdown holds until fewer than half are.
     Pressing it again, or Ready, takes it back.
3. **Start**: the card lifts and the 3-2-1 begins as soon as every game has
   loaded; a game still loading gets up to 20 seconds more, then its player
   sits the round out.

The host can jump ahead (**Next game now**), skip a game, or end the session.
At the end, a final screen crowns the winner with the session awards and the
round-by-round story.

### The live scoreboard

Games in side by side and race report `AIHub.progress({ score, label })`.
The client passes the latest on at most once a second; each player's bridge
hands it to its own page and sends it to every other player's page over the
mesh, unreliable (`{k:'p'}`). It never reaches a game and never touches
Supabase. The board sits over the game at the top right, clear of the corner
bar, ordered as the round will rank it (finishers by time, then everyone by
score); it folds to one button, remembered per device
(`localStorage['ai-hub:board']`), and leaves with the corner bar.

The host's page also feeds each player's last progress to the round
(`round.progress(id, score)`): a player still in a race or side-by-side round
who never reports a result is ranked by it.

### What is kept

Every played round is recorded online: the game, its mode, and each player's
place, points, win, stats and awards. A signed-in player keeps that history
across sessions; a guest's goes with the guest after 30 days unused. Modes are
any short lowercase word since migration 0008, so a new mode needs no
migration.

## How a round travels

### Between a game and its page

Every message is posted between the game's frame and the page holding it, as
`{ aihub: 1, type, … }`. The page accepts a message only from its own frame's
window; the client answers only its parent, and after the welcome posts only
to the welcome's origin.

| From | type | Fields | Rule |
|---|---|---|---|
| game | `hello` | `v: 1, client, mode, seats` | every 500 ms until welcomed; after 10 s the game plays alone |
| hub | `welcome` | `me, host, players, mode, seed, limitMs, round, splash?, limits` | once; a 1.3.0 client keeps any field the hub adds |
| game | `ready` | | once: loaded (`splash`), or within 45 s of the round's start from a gesture |
| hub | `start` | `in` | milliseconds until play begins |
| game | `send` | `data, to?, reliable` | after welcome, until end; within `limits` |
| hub | `message` | `from, data` | |
| game | `progress` | `score, label?` | side by side and race; about once a second (the page drops any closer than half a second) |
| hub | `leave` | `id, reason` | final for the round |
| game | `result` | `time` or `score`, `stats?`, `awards?` | side by side and race; once |
| game | `finish` | `standings, scores?, won?, stats?, awards?` | versus, co-op; the host; once |
| hub | `time-up` | `graceMs` | at the limit: 1.5 × `hub:session-minutes`, at most 15 minutes |
| hub | `end` | `reason, standings?` | last |
| game | `error` | `message, fatal` | `AIHub.fail()` |
| game | `fullscreen` | `on` | whenever the game calls `requestFullscreen()` or `exitFullscreen()` in a session: the page puts itself in fullscreen, so its board and cards stay over the game |

Side by side, the page's address carries the round's seed
(`?aihub=1&aihub-seed=…`), and the client seeds `Math.random` with it before
the game's own scripts run.

### Between the players' pages

| Envelope | What | Travels over |
|---|---|---|
| `{k:'c', r, m}` | a game's message for the round's coordinator | Supabase Realtime |
| `{k:'h', r, m}` | the coordinator to a game: welcome, start, leave, time-up, end | Supabase Realtime |
| `{k:'s', …}` | the session's state (every change, and every second), the round's status, splash presses | Supabase Realtime |
| `{k:'g', r, f, d}` | game traffic | the WebRTC mesh |
| `{k:'p', r, f, d}` | a player's progress, for the scoreboards | the WebRTC mesh |
| `{k:'t', …}` | clock requests to the host | the WebRTC mesh |

The rule: only presence, round control and signalling use Supabase, whose
Free plan counts each broadcast once sent and once per receiver (2 million a
month, 100 a second). Anything periodic goes over the mesh, which costs
nothing on a direct link and little through the TURN relay. A 4-player
session costs about 240 Realtime messages a minute today, almost all of it the
host's state broadcast every second.

### Known limits, and what is next

- **The round lives in the session host's tab.** If that tab leaves, a shared
  world (versus, co-op) is void. A race or side-by-side round is scored by
  the next host from the last status every tab holds: each player's result,
  or else their last progress, with the old host last; it counts toward the
  format like any played round. The next step is for the new host to resume
  such a round instead (seats, start time, results), re-point the bridges and
  re-send any result.
- **A presence blip counts as leaving.** A player whose Realtime connection
  drops for a moment (a phone screen, a Wi-Fi change) is marked out at once
  and their mesh links are torn down, even while their data channels are
  healthy. A grace of about 15 seconds before marking them out, with an
  explicit goodbye for a player who really leaves, fixes it.
- **Four seats.** The database (slot 0–3, place 1–4, points 0–3), the seat
  colours and `SEATS` in app.js hold it at four; the mesh and a host-run world
  would carry six to eight.
- **Same origin.** Games run on the hub's origin, so a game can read the
  signed-in player's Supabase token (row-level security confines the damage),
  and the corner bar, the card's controller and the harness reach into the
  frame. Moving games to their own origin means moving those at once. New
  features reach a game only through the client and `postMessage`
  (progress, the seed, the empty storage, fullscreen), so they add nothing to
  that move.
