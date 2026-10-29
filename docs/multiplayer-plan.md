# AI Hub multiplayer: the plan

Version 3 · Oct 29, 2026. Version 2 (Oct 28) was the owner's manifesto. This
version is that plan after an audit against the code, a census of all 1,831
entries in the library, the cc-matrix repository and outside facts, and with
the first stage built. The protocol itself, the one thing a game builder
needs, is [`lib/hub/README.md`](../lib/hub/README.md), served at
<https://crosato-arcade.vercel.app/lib/hub/README.md>. What the hub does
around a round is [`session-hub.md`](session-hub.md).

## The short version

Every game on the hub should be playable with friends, at the level of
"together" it can honestly support. The cheapest level, **side by side**,
reaches almost the whole library: everyone plays their own copy of the same
game at the same time, from the same start, and the hub shows who is ahead.
A shared course (**race**) and a shared world (**versus**, **co-op**) are
the best party games and cost more work, so new games build them where the
genre suits.

The audit kept version 2's chassis and changed its armour:

- **Kept**: the hub owns everything around a round; one network; friends
  only, no talking in games; one point for every player beaten; side by side
  as the new baseline, added to the library by a tool and a cheap model; the
  host's copy runs every shared world, each copy owning its own player.
- **Changed**: watching stays on state, as version 2 decided, but asks no
  game for a new ability. A watcher of a shared world or a race is a copy
  with no player of its own, drawn from the traffic every copy already gets;
  side by side, the live scoreboard is the view. That cuts the hardest,
  costliest per-game ability (snapshot, restore, mirror) out of the roadmap.
  The dedicated-server rules shrink to two lines of guidance.
- **Cut**: new names for things the hub already does (a list of modes per
  game, an end-type meta, `authority` and `role`), and every step that needed
  cc-matrix to change. cc-matrix is handed the protocol's address and nothing
  else.
- **Added**: what the plan was missing to work on day one: checks that fit
  each kind of game; progress carried on the free peer-to-peer links; a fair
  start the client enforces (saved data hidden in a session); a client that
  never needs re-pasting for most new features, plus a script that upgrades
  every pasted copy; a retrofit runner with spend caps that puts back every
  game it cannot wire; a deal that plays one build of each title and only
  games every seat can run; and a database change so side-by-side rounds are
  kept.
- **Next, first**: *Again*. Most of the library is shooters and action games
  with lives, so in a one-run round the first player out waits for minutes.
  The hub should let them start a fresh attempt and count their best, before
  the first retrofitted wave is dealt.

Client 1.3.0, everything under *Now* below, is built and tested in this
change.

---

## Part 1. The principles

1. **Friends, not strangers.** Sessions are for people who invited each other
   with a link. No matchmaking, no public lobbies, no rankings against
   strangers.
2. **No talking in the game.** No chat, voice, emotes, pings or custom names.
   Friends talk where they already do. The hub shows only the names it
   generates.
3. **Every game can be played together, at its honest level.** A game with a
   score or a finish gets side by side; a racer a shared track; a fighting
   game real versus. A game declares the one level it plays best, and nothing
   fakes a level it can't support.
4. **The hub owns everything around a round; the game owns only the round.**
   Invite, lobby, seats, names, network, clock, card, scoreboard, results,
   history: the hub's. A game plays one round and reports how it went.
5. **Put the intelligence in the hub, keep the game's contract small and
   stable.** Whatever the hub can do without touching a game (the scoreboard,
   the deal, *Again*, awards, build battles) it does itself, once.
   Games do only what only they know: when they are ready, when play starts,
   their score and their end. That is what makes thousands of games
   affordable to keep current.
6. **Every mode, one network.** A game talks only through `AIHub.send` and
   never opens a connection of its own. Control goes through the session's
   Supabase channel; anything periodic (game traffic, progress) goes over the
   players' direct peer-to-peer links.
7. **State, not video.** Every player runs their own copy, moves their own
   player instantly and never waits on the network. A watcher runs a copy
   too, with no player of its own; side by side, the hub's scoreboard is the
   view.
8. **Smooth beats strict.** No anti-cheat among friends. Each device moves
   its own player at once; in head-to-head play, the player who gets hit
   decides.
9. **Party pace.** Rounds of 2–8 minutes, capped at 15; about fifteen seconds
   from one game's end to the next game's start. Nobody watches a loading
   bar.
10. **Every round ranks.** One point for every player beaten, whatever the
    game, so a session can mix Solitaire and a kart racer.
11. **A fair start.** Same seed, same rules, same limit; nothing saved on a
    device carries into a round. Side by side, the same seed gives the same
    start, not the same whole game, and the protocol says so.
12. **Runs where your friends are.** Any modern browser, keyboard and mouse
    or a controller. WebGPU may make a game look better; a game that truly
    needs it says so, and the hub deals it only when every player's browser
    has it.
13. **Standardize the plumbing, keep the feel.** The hub changes games to
    standardize them (client, metas, libraries, controls) and leaves their
    creative decisions alone.
14. **Additive forever, upgraded by script.** New features only add; a game
    built for an older client keeps working. Mechanical changes reach every
    game by a deterministic script, never by a model.
15. **Nothing goes into the protocol until the hub runs it and the check
    tests it.** The protocol is the factory's only interface: every line in
    it costs agents' attention, and an untested rule is only prose.

---

## Part 2. The five decisions of Oct 28, revisited

| # | Version 2 | Now | Why |
|---|---|---|---|
| 1 | Every mode, one network | **Kept** | Games still speak only through `AIHub.send`. Progress (new) rides the peer links, as game traffic does. |
| 2 | The hub may change games to standardize them | **Kept, made cheap** | A pasted client is now upgraded by script (`scripts/hub-client.mjs`), verified by hash, never by a model; and 1.3.0 passes on any field or event a newer hub adds, so most future features need no re-paste at all. |
| 3 | Watching runs on state, not video | **Kept, without the per-game ability** | Video would need the hub to reach into the game's frame: a capture cannot be handed across frames (tested: `DataCloneError`), so it would tie every game to the hub's origin. It misses the HUDs that most canvas games draw in page elements, and the playing machine pays for the encoding (25–43 ms a 720p frame in software, measured here). State costs a shared world or a race nothing new: a copy with no player of its own draws everything from the snapshots and samples every copy already gets. Side by side shares nothing to draw, so there the live scoreboard is the view, and *Again* keeps everyone playing. What is cut is snapshot, restore and mirror as a per-game ability. |
| 4 | The host is the server, built so a dedicated server can take over later | **Kept for play; the server rules deferred** | The host's copy runs every shared world, unchanged. The four server rules cost every shared-world game work that nothing can test (no harness runs a world without a player of its own), for a headless-browser server the budget won't run. Two of them stay as one line of guidance each: keep the shared world in plain data apart from drawing; gameplay never reads back from the GPU. |
| 5 | Side by side reaches the library through a tool and a cheap model | **Kept, run by the hub** | cc-matrix is out of scope, so `scripts/retrofit.mjs` runs it: tool step, model, checks, a retry, the next model, a ledger of cost and pass rate. |

Decision 4 is the owner's to take back: the audit's case is above and in the
evidence at the end. (The audit first leaned to video for watching; the
platform evidence above turned that around.)

---

## Part 3. Modes

Version 2's six formats collapse into four modes a game can declare, plus
features of the hub that need nothing from a game.

| Version 2 | Now |
|---|---|
| 0 Watch | Side by side: the live scoreboard (*Now*). Shared worlds and races: a copy with no player of its own, fed the same traffic (*Later*) |
| 1 Side by side | Mode `parallel`, client 1.3.0 (*Now*) |
| 2 Ghosts | Mode `race`; ghosts or solid rivals is a drawing choice the game makes |
| 3 Together | Modes `versus` and `co-op`: the host's copy runs the world |
| 4 Natural multiplayer | Whichever of the three a game plays best |
| 5 Couch and remote couch | Couch co-op on one screen stays each game's own (up to four controllers), unchanged. Remote couch co-op is **pinned**: friends far away would need the host's screen streamed to them as video |

**One mode per game.** A list of modes per game would mean a code path and a
conformance run per mode in every game, for a choice the hub never needs to
make. The lobby needs no new picker either: the deal alternates between the
side-by-side games and the ones played together, so a dozen shared worlds are
not buried under hundreds of side-by-side games.

**Side by side, in seven steps** (the protocol has them in full): declare the
metas, paste the client first in `<head>`, skip the title in a session and
connect, start on the clock, report progress, report the result once, go
quiet at the end. Pausing is allowed (nothing is shared); there is no
networking at all. Saved data never carries in: in a session the client
gives the game an empty storage of its own, so a high score, an unlock or a
setting from earlier play changes nobody's start, and the real saves are
left alone. `Math.random` is seeded by the hub before the game's
scripts run, so every copy builds the same start; draws during play drift
with frame rate and quality, and a game that deals pieces or levels from one
function can draw them from `AIHub.rng('deal')` to keep them the same all
round. Seeding stays off in every other mode, where identical streams would
make ids collide between copies.

**Ending** needs no new meta: a finish reports a time, a run reports a score,
and the hub ranks finishers by time, then everyone by score. A run that never
reports is ranked by its last progress. A score game that wants a fixed
length ends its own run on the shared clock, as Urethane Switchyard already
does.

---

## Part 4. Bringing the library in, and keeping it current

### What the library is

| | |
|---|---|
| Entries | 1,831: 1,775 games, 31 tech demos, 24 tools |
| Games with a score or a finish (keyword census) | 1,654 |
| Code a model must read, own code without bundled three.js | median ~38K tokens, 90th percentile ~87K |
| Games whose own code is minified | 653 (harder to wire; expect lower pass rates) |
| Games that require WebGPU (fallback disabled or hard-gated) | 602 |
| Runs of one source, Star Fox 64 | 678 of the 1,831 |
| A build's own stated cost (869 files say) | median $2.25, 90th percentile $11.51 |

### The pipeline

`scripts/retrofit.mjs`, on the owner's machine, with any agent CLI and
Playwright. Nothing here needs cc-matrix.

0. **Pick** (`retrofit.mjs pick`): one build of each title, the one with
   readable code that runs without WebGPU and has the least code to read. Of
   the 493 titles not yet in sessions, 228 have such a build: wave 1. The
   rest wait for the tracks under *Later*.
1. **Can this browser run it?** (`hub-check --draws-only`) A page that
   cannot run here is noted and skipped, with no model spent on it: a
   WebGPU-only game in a browser without WebGPU is caught even when its title
   screen shows (it asked for an adapter, got none, and drew nothing with
   WebGL or a 2D canvas). On a machine without a GPU, SwiftShader gives such games a
   software adapter (`--browser-args`, tested here).
2. **Tool, no model** (`retrofit.mjs prepare`): the client and the
   side-by-side metas go first in `<head>`, after `<meta charset>`, before
   every script. Dry-run over the whole library: 1,825 pages prepared, every
   one with the client before its first script and its own bytes untouched.
3. **Model** (the prompt in [`lib/hub/retrofit.md`](../lib/hub/retrofit.md),
   which quotes the protocol's side-by-side section word for word, about
   2,000 tokens in all): find the score and the end, fill the goal and
   controls lines, wire connect, ready, start, progress, result and end;
   nothing else. A game with no score and no finish is declared unfit and
   left alone.
4. **Check, no model**: the page's static check (one pristine client before
   every script, the metas, the calls) and a budget of 150 changed lines,
   then `hub-check --retrofit`: two players with one leaving, no traffic,
   progress and a seeded start expected; and the game on its own compared
   with the original (still draws, no new errors, client inactive,
   `Math.random` untouched). The full controller and settings-menu checks
   stay for new games: an old game keeps the controls it had.
5. **Retry and escalate**: a second try told what the check found, then the
   next model up; past `--max-cost` dollars for one game (default $1) it
   stops. A game none of them can wire is put back byte for byte, with a
   `sessionNote` in `data/overrides.json` saying why (unfit, failed, or not
   drawable here), so later runs skip it.
6. **Record**: every try in `.cache/retrofit.jsonl`, with its cost when the
   agent prints one. Nothing is committed for the owner: what passed is
   reviewed, a few are played, and it goes in by batches of about fifty.

**Pilot first**: about thirty varied wave-1 games (2D and 3D, single file and
project folder, small and large), plus five minified and five WebGPU-only
games to size the later tracks. Read the pass rate, the cost per game and the
minutes per game; play a few that passed; then the rest of wave 1 in batches.

### What it costs

The pilot sets the real figure; this is the estimate it replaces. List
prices per million tokens (Anthropic, Oct 2026):

| Model | Input | Output | Cache read | Cache write (1 h) |
|---|---|---|---|---|
| Claude Haiku 5.5 | $0.10 | $0.50 | $0.01 | $0.20 |
| Claude Sonnet 5.5 | $2 | $10 | $0.10 | $4 |
| Claude Opus 5.5 | $4 | $20 | $0.20 | $8 |

Haiku 5.5's prices are for prompts up to 100K tokens; past that they are five
times as much. (Anthropic's pricing page, read Oct 29, 2026. The Batch API
halves these, but an agent's turns cannot be batched.) A one-line
`claude -p` call to Haiku 5.5, made here, was billed exactly at these rates
(its own prompt: 12,478 tokens written to the cache, 26,159 read: $0.0028).

One try with `claude -p` re-reads its whole context from the cache on each
of about fifteen turns. That context is the CLI's own prompt (about 39K
tokens, measured here, where many tools are loaded), the retrofit prompt
(about 2K), and the game's code (median about 38K tokens). So a try reads
about 1M tokens from the cache, writes about 90K to it and produces about
15K. That is roughly:

| Per try | Median game | Large game (90th percentile) |
|---|---|---|
| Haiku 5.5 | about $0.04 | about $0.25 (past 100K tokens) |
| Sonnet 5.5 | about $0.60 | about $0.90 |
| Opus 5.5 | about $1.25 | about $1.75 |

So the pass rate of the cheapest tier decides the bill. If Haiku 5.5 wires
most games, wave 1 costs about $10–$30 and the whole library about $200. If
most need Sonnet 5.5, a game costs $0.70–$1.40. `--max-cost` bounds the worst
case either way: no new try starts once a game has cost $1 (the default),
so with Haiku then Sonnet a game costs at most about $1.40, and wave 1 at
most about $320. A run on a Claude subscription counts against the plan's
limits instead; the CLI still reports the list price, so the ledger stays
comparable.

Time costs more than tokens: an agent's try takes a few minutes and the
checks one to two more, so a machine running two at a time does a hundred
games or so a night.

### Keeping it current

- **Client upgrades by script.** `scripts/hub-client.mjs` lists every pasted
  client by version and replaces each unmodified older copy with the current
  one; an edited copy is reported and left alone. Batch by folder, then spot
  check with `hub-check`.
- **Forward-compatible client.** 1.3.0 keeps every welcome field, passes on
  any event a newer hub sends, forwards whole outcomes for the hub to check,
  and takes its limits from the welcome. Only a new method needs a new client.
- **Checks at the door.** `hub-check --record` writes the verdict into
  `data/overrides.json`; a failing game gets `"session": "0"` and is never
  dealt until it passes again.

---

## Part 5. The network and its costs

- **Supabase Realtime** carries presence, round control and signalling. Its
  Free plan counts each broadcast once sent and once per receiver: 2 million
  a month with no overage, 100 a second per project (clients past it are
  disconnected), 200 connections at once. A 4-player session costs about 240
  messages a minute today, almost all of it the host's state broadcast every
  second: roughly 150 Party sessions a month. **Nothing periodic goes
  there**: progress through the coordinator would have added 12 to 28
  messages a second per session. A Free project also pauses after a week
  with little database activity and is woken by hand; Pro ($25 a month)
  never pauses.
- **The peer links** (WebRTC data channels) carry game traffic, progress and
  clock samples: free when direct. About 10–25% of connections need
  Cloudflare's TURN relay, which is free for the first 1,000 GB a month and
  $0.05/GB after; a session's game traffic is kilobytes a second.
- **Rates.** 20 messages a second per copy, bursts of 40, and every `send()`
  counts once whether to one player or all. Measured: 20 snapshots a second
  plus one event a second starts dropping after 38 s; 15 a second plus five
  events never does. The protocol now says 15, broadcast once, and keeps a
  state message under about 1 KB (it is lost whole if any of its ~1,200-byte
  packets is).

---

## Part 6. The roadmap

**Now: client 1.3.0, in this change**

- Mode `parallel` (side by side): the client seeds `Math.random` from the
  address, `AIHub.progress()`, the round ranks it like a race, the harness and
  `hub-check` check it, and a reference game (**Starfall**) passes them.
- A fair start the client enforces: in a session the game gets an empty
  storage of its own, so saved scores, unlocks and settings never carry into
  a round (about 1,400 games use `localStorage`), and the real saves are
  untouched.
- The live scoreboard over the game, from progress carried on the peer links:
  folded with a tap, remembered per device, and it never keeps the game's
  focus.
- Rounds keep their result: a player who reported and then left keeps their
  place; a player who never reports is ranked by their last progress; when
  the session host leaves a race or side-by-side round, the new host scores
  it from the last status every tab holds instead of voiding it.
- The deal: side-by-side games alternate with games played together; one
  build of each title until every title has had its turn (678 builds are Star
  Fox 64); a game that needs WebGPU only when every seat has it (a real
  adapter, measured at join); touch-tagged games, while any fit, when a seat
  has nothing but a touch screen.
- Fullscreen belongs to the hub in a session: a game's `requestFullscreen()`
  puts the hub's whole page in fullscreen, so the scoreboard and the cards
  stay over the game (817 game pages ask for fullscreen).
- The protocol rewritten as the factory's interface: a one-screen start, side
  by side as a short self-contained level, the shared-world patterns with
  measured budgets, a paste-ready self-test, absolute links.
- Tools: `hub-client.mjs`; `retrofit.mjs` (pick, prepare, check, run: each
  agent on its own copy of the game, spend capped, every failure put back);
  `hub-check --retrofit`, `--draws-only` (which knows a WebGPU-only game this
  browser cannot run), `--record` and `--browser-args`.
- Migration 0008: a round's mode may be any short word (applied from the
  owner's computer with 0007).
- The versus example owns its player, as the protocol says: a key press moves
  a non-host's player on the next frame (about 17 ms), where it used to wait
  a median of 420 ms for the host.

**Next: the hub alone, no game changes**

- **Again**, first, before the first retrofitted wave is dealt. Side by side
  becomes "best attempt in the window": a player whose run ends early starts
  a fresh one (the hub reloads their frame on the same seed) and their best
  counts. 44% of the library's games are shooters and 22% action games,
  mostly with lives; in a one-run round the first player out waits for
  minutes.
- **Hub awards** for side-by-side rounds (a personal best, the most
  attempts, a win on the first try), so no retrofit has to make any.
- Rounds that survive the session host leaving: the new host resumes the
  round rather than scoring it at once, and a grace of about 15 seconds
  before a vanished player is marked out, so a Realtime blip neither costs a
  round nor tears down a healthy link.
- **Build battle**: one source's builds, dealt blind, a vote, the reveal.
  The catalogue already records each build's source, model and effort, so it
  needs no run ids.
- **The deal learns**: a build skipped or voided twice and never played
  leaves the deal by itself, read from `session_rounds` with no user data;
  the share of dealt rounds actually played is the measure of the whole
  thing. And builds that need WebGPU but don't say so are found by
  `hub-check` in a browser without it (they ask for an adapter, get none and
  draw nothing with WebGL or 2D) and marked in `data/overrides.json`.
- **What the platform needs**: TURN credentials only for a player seated in
  a live session (today any signed-in account, anonymous ones included, can
  mint them, and relayed traffic past 1,000 GB a month is billed); a plain
  message when the free Supabase project is asleep after a quiet week,
  instead of a raw error, and perhaps a daily keep-alive; the scoreboard
  marking a player whose peer link is down rather than freezing their row.
- **The retrofit pilot**, then wave 1 in batches.

**Later**

- **Watching** shared worlds and races: a seat with no player of its own,
  whose copy draws the world from the snapshots and samples every copy
  already gets. Watchers are member rows without a seat, and once one is
  present every link is relayed, so nobody on the channel learns another's
  address.
- **Games on their own origin.** Every game shares the hub's origin today,
  so any game can read a signed-in player's token and the hub's storage
  (`localStorage['ai-hub:auth']`). Serving the frames from a second hostname
  of the same deployment fixes that, once four features stop reaching into
  frames (the splash's pad buttons, Create + Options, the Couch's pad
  reading, the bar's wake-on-mouse). New features already reach games only
  through the client: progress, the seed, the empty storage, fullscreen.
- The WebGPU track: a tool, no model, turns three.js's WebGL 2 fallback back
  on in session mode, so most WebGPU-only builds can be dealt to any group.
  Then the minified track: a model that reads minified code, or a build of
  the same title that isn't minified.
- More than four players: side by side shares nothing, so up to eight there
  first. Both that and watcher seats are schema and seat-colour changes
  (slot 0–3, place 1–4, points 0–3), not network ones.

**Not doing**

- Snapshot, restore and mirror as a game ability; late joins and mid-round
  reconnects (a late player plays from the next round).
- A dedicated server.
- `hub:session-modes`, `hub:session-end`, `authority`, `isAuthority`, `role`.
- A feedback loop into cc-matrix: per-game session data is too thin and too
  confounded to rank models with; build battles compare them directly.
- Video of a game's canvas for watching (see decision 3).
- A Discord Activity: Discord's proxy carries no WebRTC, so the one network
  cannot run there. An invite link that unfolds into a card where friends
  already talk gets most of the benefit.

**Pinned** (parked until the owner wants it)

- Remote couch co-op: friends far away playing a game made for one screen, on
  the host's screen. It needs that screen streamed to them as video, with
  their controllers sent back, so it waits for a decision to stream video.
  Couch co-op in one room is the game's own and is unaffected.

---

## Part 7. cc-matrix

Nothing changes in cc-matrix. It is handed
<https://crosato-arcade.vercel.app/lib/hub/README.md>, and the protocol's
own one-paragraph ask (in *Start here*) is the line to add to a prompt.
Version 2's Appendix A is dropped: one source of truth, which the hub checks.

Things in cc-matrix's own prompt that meet the protocol, for the owner when
next editing it:

- **"WebGPU, no fallback"** (its tech stack) meets "give it a WebGL 2
  fallback". Either drop "no fallback", or let such games declare
  `hub:webgpu` `required`; the hub then deals them only to groups whose
  browsers all have WebGPU.
- **Attract mode after 10 s idle** on the title screen: in a session there is
  no title screen, so it never starts there. No conflict.
- **Testing "efficient"**: the agent can still run the harness from the
  protocol's *Test it*; the hub checks every game at import either way.
- **Up to four players locally, controller first**: welcome. Couch co-op in
  one room is the game's own; remote couch co-op is pinned.

If cc-matrix builds are imported, the hub's importer (`import-matrix-runs.mjs`,
written for gpt-matrix's layout) needs to learn cc-matrix's `runs/<id>/work/`
layout: an ai-hub change, made when the first cc-matrix builds come in.

---

## Part 8. Open decisions

| # | Decision | Recommendation |
|---|---|---|
| 1 | Accept decision 4 as changed (the dedicated-server rules deferred), and decision 3 kept without snapshot, restore and mirror? | Yes |
| 2 | Side by side as "best attempt in the window", with *Again* | Yes: next, before the first retrofitted wave is dealt; no game changes |
| 3 | WebGPU-only games: drop "no fallback" in cc-matrix, or rely on `hub:webgpu`? | Both work; dropping it lets every friend play every new game |
| 4 | Retrofit tiers and cap | Haiku 5.5, then Sonnet 5.5, $1 a game; confirm after the pilot |
| 5 | Which builds first | One build of each title, readable and without WebGPU: wave 1, 228 games (`pick --wave 1`) |
| 6 | Phones | Built the cheap way: a seat with only a touch screen is dealt touch-tagged games while any fit; no work per game |
| 7 | Live scoreboard on or off by default | On, folded with a tap, remembered per device (built) |
| 8 | Controller required for side-by-side retrofits | No: an old game keeps its own controls; new games use the full standard |
| 9 | More than four players | Side by side first, up to eight, later |

---

## Appendix. Evidence

Measured or read in this audit (Oct 29, 2026):

- **Video, for and against**: a capture cannot be handed to another frame or
  worker (`DataCloneError`; Chrome lists transferable tracks as "no active
  development"); the hub page can capture a same-origin frame's canvas only
  by reaching into it. Element and Region Capture are Chrome-only and prompt
  every time. A game-like 720p stream sat at libwebrtc's default 2.0–2.5 Mbps
  (about 1.1 GB a viewer-hour), and software VP8 took 25–43 ms a frame on 4
  cores. The capture itself works: a same-origin frame's WebGL2 canvas (no
  `preserveDrawingBuffer`) → `captureStream(15)` → a real `RTCPeerConnection`
  pair gave 39 frames decoded in 2.5 s, VP8, correct pixels.
- **WebGPU**: about 83–86% of users have a working adapter (Linux 18%,
  Firefox 61%, Android 75%); WebGL 2 reaches 97%. three.js r186's
  WebGPURenderer falls back to WebGL 2 by itself unless a game switches that
  off, as 520 library games do. This container's Chromium has `navigator.gpu`
  but no adapter; SwiftShader's flags give it one.
- **Rate simulation** with the real client: as in Part 5; per-player sends of
  20 snapshots a second to three players lose 60%.
- **Realtime**: 205 broadcasts in an 80 s, 2-round, 4-player local session
  (89 state, 41 status, 24 signalling), billed ×4.
- **hub-check**: 70–74 s for a light 2D game, 245 s for a 3D session game
  (4 cores). A game with no traffic failed exactly the two traffic checks;
  without a probe, four.
- **Census** (all 1,831 entries): as in Part 4; plus 1,540 entry files call
  `Math.random`, 356 use three's `generateUUID` and 151 make ids from
  `Math.random` (why seeding stays side-by-side only); 1,043 put
  `<meta charset>` where a client inserted at the very top of `<head>` would
  push it past byte 1,024 (why it goes after the charset).
- **cc-matrix**: 25 runs (22 Star Fox 64, 3 Mario Kart 64), $105.81 reported
  spend (Claude Code and Grok only), none on the hub, none using the network;
  13 of 17 "WebGPU, no fallback" builds show a WebGPU-required message.
- **Fullscreen**: in Chromium, a click inside a same-origin game frame lets
  the hub page take fullscreen when the frame asks by message, and the frame
  hears it back.
- **Database**: `session_rounds.mode` allowed only versus, co-op and race, so
  a side-by-side round would not have been saved; 0008 was checked on
  Postgres 16 against 0002's table.
- **The versus example, rewritten to own its player**: bots through the
  harness at 150 ± 50 ms and 5% loss, with the host on each seat in turn: a
  key press moves a non-host's player on the next frame (about 17 ms), where
  the old file's median was 420 ms; a still player stays put through 20
  snapshots; two players claiming one star are settled the same everywhere.
- **The retrofit runner**, end to end with a stand-in agent: a pass keeps its
  changes; an unfit game and one that fails every tier are put back byte for
  byte. `pick --wave 1`: 228 of 493 titles not yet in sessions, in 25 s.
- **Bugs found and fixed on the way**: a racer who finished and then left was
  ranked last; a result with `time: null` counted as a 0 ms finish (now
  refused by the client and by the round); the versus example forwarded
  input against its own spec, and its host stopped sending on the winning
  frame, so the others saw the winner one point short.
