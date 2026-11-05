# AI Hub sessions

How the hub runs a session today, and why. A session is up to four friends,
each on their own device, playing rounds of games one after another. A game
plays only its round; the hub does everything around it.

What a game must do is [the protocol](../lib/hub/README.md), served at
<https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/README.md>.
It is the only thing a game builder is given (cc-matrix is handed that address
and nothing else), and its links point at GitHub so they outlast any change of
host. This page does not repeat it; it is for whoever changes the hub.

| What | Where |
|---|---|
| The client every session game pastes | `lib/hub/session.js` |
| One round, and the hub's end of one game frame | `lib/hub/round.js`, `lib/hub/bridge.js` |
| The harness and the three reference games | `lib/hub/harness.html`, `lib/hub/examples/` |
| The session page (`/session`), and the Friends view that leads to it | `assets/js/session/`, `assets/js/friends/` |
| Seats, rounds and channel access; TURN credentials | `supabase/migrations/` (checked by `supabase/tests/rls.sql`), `supabase/functions/turn/` |
| Checks and tools | `scripts/hub-check.mjs`, `scripts/hub-client.mjs`, `scripts/retrofit.mjs`, `lib/hub/retrofit.md` |

## Principles

The owner's intent; the rest of this page follows from it.

- **Friends, not strangers**: sessions are for people who invited each other
  with a link. No matchmaking, public lobbies or rankings against strangers.
- **No talking in games**: no chat, voice, emotes, pings or typed names.
  Names come from the hub (`names.js`), so none can carry a message.
- **Every game at its honest level**: a game with a score or a finish can play
  in parallel, one with a hero as ghost, one with online play of its own as a
  shared world. A game declares the one mode it plays best.
- **The hub owns everything around a round** (invite, lobby, seats, names,
  network, clock, card, scoreboard, results, history) and does it once, for
  every game. A game does only what only it knows: when it is ready, when play
  starts, its score and its end. That keeps thousands of games affordable to
  keep current.
- **One network, state not video**: a game talks only through `AIHub.send`;
  every player runs their own copy and moves their own player without waiting
  on the network.
- **Smooth beats strict**: no anti-cheat among friends.
- **Party pace**: a few seconds of results, a short card, the next round,
  already loaded.
- **Every round ranks**: one point for every player beaten, whatever the game,
  so a session can mix Solitaire and a kart racer.
- **A fair start**: the same seed, rules and time limit for everyone, and
  nothing saved on a device carries into a round.
- **Runs where your friends are**: any modern browser. A game that needs
  WebGPU says so, and is dealt only when every seat has it.
- **Standardize the plumbing, keep the feel**: the hub changes a game's client,
  metas and session wiring, never its creative decisions.
- **Additive forever, upgraded by script**: within protocol 1 changes only add;
  mechanical changes reach the games by a script, never by a model.
- **The protocol is the interface, and only that**: nothing goes in until the
  hub runs it and the check tests it, and it holds no example values or
  advice, since an agent takes any hint as the way to build a game.

## Modes

A game declares one mode in `hub:session-mode` ([what each means for the
game](../lib/hub/README.md#modes)). On the hub's side:

| Mode | Each copy runs | The deal's deck | `Math.random` seeded | Who reports |
|---|---|---|---|---|
| `parallel` | its own world | own worlds | yes | every copy: `progress`, then `result` |
| `ghost` | its own world | own worlds | yes | every copy: `progress`, then `result` |
| `shared-world` | the host's world | shared worlds | no | the host's copy: `finish` |

- **Older tags** (`modeOf` in `round.js`): a game still tagged `race` plays as
  ghost but keeps the unseeded start it was built for, and the check asks no
  progress of it.
- **One mode per game**, and no new names for what the hub already does (no
  `hub:session-modes`, `hub:session-end`, `authority` or `role`): a list of
  modes would cost a code path and a conformance run per mode in every game,
  for a choice the hub never needs to make.
- **The seed**: for a game tagged parallel or ghost the round's address
  carries it (`?aihub=1&aihub-seed=…`), and the client seeds `Math.random`
  before the game's own scripts run, so every copy builds the same start.
  Draws during play drift with frame rate; a game that deals from one function
  can use `AIHub.rng('deal')`. Shared worlds are not seeded: identical streams
  would give two copies' objects the same ids. Each round's seed comes from
  the session's seed and the round number.
- **No end meta**: a finish reports a time and a run a score, and the round
  ranks them ([Scoring](../lib/hub/README.md#scoring)). A score game that
  wants a fixed length ends its own run on the shared clock.
- **The limit**: time is called at 1.5 × `hub:session-minutes`, at most 15
  minutes, and at 15 minutes for a game that gives no length (`limitFor`).
  After `time-up` a game has 5 seconds to report.
- **Couch co-op** on one screen stays each game's own; the Friends view lists
  such games beside the session ones.

## A session

### Hosting, seats and names

- The host signs in with Google and gets an invite link, `/session#<code>`
  (ten letters and digits, no look-alikes). Friends open it, pick a name and
  play as guests, on anonymous Supabase accounts. A game's page in the Friends
  view hosts `/session?first=<slug>`, a session that opens with that game.
- Four seats. A late arrival plays from the next round. A newer tab of the
  same account makes the older one step aside. The host can remove a player
  for the rest of the session, and the database bars them from coming back.
- The host is the seated tab with the lowest seat. It holds the session's
  state (the seed, the rounds played, the table, its own choices), deals, runs
  each round's coordinator (`round.js`), and broadcasts the whole state on
  every change and every second, so a tab that joins late, or takes over when
  the host leaves, knows everything. In a shared world its copy runs the world.
  Online, a tab that takes over also takes the host's place in the database
  (`claim_session_host`, migration 0011), so it can remove a player and end
  the session.
- **Relay only**, in the lobby, sends all of a device's connections through
  the TURN relay, so the others never see its IP address.

### The deal

**Up next** comes first: the host's picks (`state.queue`, at most twelve), in
order, from every game that every seat's browser can run and that seats the
players present or will once more sit down (a pick waits for them). Its card
reads *The host's pick*, and Random Mode skips its title for that cycle.

Then **Random Mode** (`pick.js`) deals every game that declares `hub:session`
`1`, seats the players present, sits on the Games shelf and is not restricted,
unless its `data/overrides.json` entry says `"session": "0"`.

- **Two decks.** Parallel and ghost games far outnumber the shared worlds, so
  the deal alternates the two decks while both have games, starting with a
  shared world. One shuffle would bury the shared worlds.
- **Titles, not builds.** A deck deals one build of each title (`lineageKey`:
  the same source, or for an original the same name), chosen at random, so a
  source with hundreds of runs is one game. Each deck is shuffled from the
  session's seed and played through before a title comes round again.
- **The seats' browsers.** Each seat's presence says whether it has a real
  WebGPU adapter (not a software one) and whether it has only a touch screen.
  A game with `hub:webgpu` `required` is dealt only when every seat has
  WebGPU; while a seat is touch-only, Random Mode keeps to games tagged
  `touch`, if any fit.
- **Filters**, set in the lobby, narrow Random Mode in six rows: the mode; the
  length from `hub:session-minutes` (short up to 3 minutes, medium 4 to 6,
  long 7 or more or none given); `genre`; `model`; `effort`; and the UTC month
  `added`. A row's values are alternatives, rows narrow together, an empty row
  keeps every game, and a game with nothing in a chosen row is left out. Each
  value shows how many titles it alone would leave; one that would leave none
  can't be chosen. They ride in the state, so a new host deals with them too.
- The lobby counts titles by the same rules. When nothing fits, the session
  goes back to the lobby with a notice. The reference games join the pool
  with `?examples=1`, and on their own while no library game supports
  sessions.

### Between rounds

1. **Results**, for 5 seconds, the moment a round ends, over the game: places,
   points, stats and awards, the table moving. The next game is dealt at once
   and loads underneath.
2. **The card**: a spin through the deck lands on the next game and shows its
   name, mode, `hub:session-goal` and `hub:session-howto`, with a countdown
   that starts the round by itself (10, 20 or 30 seconds, set by the host in
   the lobby; 20 by default).
   - **Ready** (Enter, or Cross): when every player in the round is ready, the
     round starts at once.
   - **I need more time** (Triangle) adds 10 seconds and tells the others *A
     player needs more time*, never who. While more than half the players are
     asking, the countdown holds. Pressing it again, or Ready, takes it back.
   - **The game's own card**: a game that connects with `card: true` is the
     card, in its own style. The hub's card steps aside once that game calls
     `ready()`; the page then sends it `card` on every change and every
     second, and takes its `answer` as that seat's press.
   - A game whose client is older than 1.2.0 shows its own ready prompt once
     the card lifts.
3. **Start**: the 3-2-1 begins once every game has loaded. A game still loading
   gets 20 seconds more; then its player sits the round out.

During a round the host's corner bar has *End round* (calls time) and the dice
(skips the game); its close button ends Random Mode, back to the lobby, while
a guest's leaves the session. Over the results the host has *Next game now*,
*Back to the lobby* (where the timer and the filters change) and *End the
session*.

### Points, awards and formats

- **One point for every player beaten.** A player who left or sat out without
  reporting counts as beaten; one who reported and then left keeps their
  place; tied players share a place. A round of four is worth three points to
  its winner, whatever the game.
- **First place is a win**; in a team result (a shared world's `finish` with
  `won`) only when the team won, shown as the team's result without medals.
- The **table** orders players by points, then wins, then the better average
  place (`score.js`).
- **Game awards** and stats come from `result()` or `finish()`, trimmed to six
  stats and three awards a player; the session counts the awards.
- **Session awards**, when a session ends: **Showstopper** (most game awards),
  **Hot streak** (most wins in a row, at least two) and **Steady hand** (best
  average place). Ties share one; one that every player would share is not
  given.

| Format, picked before the first round | Ends | Winner |
|---|---|---|
| **Party** (default) | after 8 played rounds | most points, after each session award adds 3 bonus points, so the last word is never certain |
| **Sprint** | after 5 played rounds | most points |
| **First to 12** | when someone has 12 points after a round | that player |
| **Endless** | when the host ends it | most points |

Ties go to more wins, then the better average place, and otherwise stay ties.
The final screen shows a podium, the session awards and every round's winner.

### The live scoreboard

Parallel and ghost games report `AIHub.progress`. The client passes the latest
on at most once a second; the bridge gives it to its own page and, over the
mesh (`{k:'p'}`, unreliable), to every other player's page, never to a game or
to Supabase. The board sits over the game at the top right in the order the
round will rank it (`liveOrder`). It folds to one button, remembered per
device (`localStorage['ai-hub:board']`), never takes the game's focus, and
leaves with the corner bar. The host's page feeds each player's last progress
to the round (`round.progress`), which ranks by it a player who never reports.

### What is kept

Online, the host writes every round with `record_round` (the first write
wins): the game, its mode, whether it was played, void or skipped and why, and
for a played round each player's place, points, win, stats and awards. A
signed-in player keeps the history of every session they sat in; a guest sees
a session only while seated, and a guest account unused for 30 days is deleted
with its rows (a daily `pg_cron` job). An open session with no activity for a
day is ended (hourly, migration 0005). A round's mode may be any short
lowercase word (migration 0008), so a new mode needs no migration.

## How a round travels

### Between a game and its page

Messages are posted between the game's frame and its page as
`{ aihub: 1, type, … }`. The page takes them only from its own frame's window;
the client answers only its parent, and after the welcome posts only to the
welcome's origin.

| From | `type` | Fields | Rule |
|---|---|---|---|
| game | `hello` | `v: 1, client, mode, seats, card` | every 500 ms until welcomed; after 10 s the game plays alone |
| hub | `welcome` | `me, host, players, mode, seed, limitMs, round, splash?, limits, server?` | once; a client of 1.3.0 or later keeps any field the hub adds |
| game | `ready` | | once, when loaded |
| hub | `card` | `left, paused, starting, ready, asking, asked` | to a game that connected with `card: true`, from its `ready` until `start` |
| game | `answer` | `answer`: `ready` or `more` | on its own card, until `start` |
| hub | `start` | `in` | milliseconds until play begins |
| game | `send` | `data, to?, reliable` | after the welcome, until `end`, within `limits` |
| hub | `message` | `from, data` | |
| game | `progress` | `score, label?` | parallel and ghost; at most once a second, and the bridge drops one within 250 ms of the last |
| hub | `leave` | `id, reason` | final for the round |
| game | `result` | `time` or `score`, `stats?`, `awards?` | parallel and ghost; once |
| game | `finish` | `standings, scores?, won?, stats?, awards?` | shared world; the host; once |
| hub | `time-up` | `graceMs` | at the limit |
| hub | `end` | `reason, standings?` | last |
| game | `error` | `message, fatal` | `AIHub.fail()` |
| game | `fullscreen` | `on` | the game asked to go in or out: the page itself goes, so its board and cards stay over the game |
| hub | `fullscreen` | `on` | the page went in or out: the client keeps `document.fullscreenElement` right and fires `fullscreenchange` |

### Between the players' pages

| Envelope | What | Travels over |
|---|---|---|
| `{k:'c', r, m}` | to the round's coordinator: a game's `hello`, `ready`, `result`, `finish` or `error`, and whether its page is hidden (`vis`, watched for a shared world's host) | Supabase Realtime |
| `{k:'h', r, m}` | from the coordinator to a game: `welcome`, `start`, `leave`, `time-up`, `end` | Supabase Realtime |
| `{k:'s', t, …}` | the host's session state (on every change and every second), the round's status, a seat's press on the card, the host removing a player | Supabase Realtime |
| `{k:'g', r, f, d}` | game traffic: reliable on data channel `r`, else on `u` | the mesh |
| `{k:'p', r, f, d}` | a player's progress, for the scoreboards | the mesh, unreliable |
| `{k:'t', q}`, `{k:'t', a}` | clock requests to the host, and its answers | the mesh |

Presence (each tab's seat, name, WebGPU and touch flags) and WebRTC signalling
also use the session's Realtime channel. A bridge drops anything from another
round, so a slow packet never lands in the next game. Between tabs of one
browser (`?transport=local`) the same envelopes go over a BroadcastChannel
(`local.js`).

### The network, and what it costs

- **Supabase Realtime** carries presence, round control and signalling on the
  session's private channel (`session:<id>`, seated members only). It bills
  each broadcast once sent and once per receiver; the free plan has 2 million
  messages a month, 100 a second (past that, clients are disconnected) and 200
  connections. An open four-player session costs about 240 messages a minute,
  nearly all of it the host's state each second, so the free month covers
  roughly 140 hours of four-player play. **Nothing periodic goes there.**
- **The mesh** (`mesh.js`): one WebRTC connection for each pair of players,
  with two data channels agreed in advance, `r` (reliable and ordered) and `u`
  (may drop or reorder, never retries), for game traffic, progress and clock
  samples; free on a direct link. A connection that fails, or has not opened
  after 12 seconds, is retried up to three times through the TURN relay only.
  A pair that never connects trades no game traffic; the round goes on.
- **TURN**: Cloudflare's relay, for browsers that can't connect directly. The
  `turn` Edge Function hands out four-hour credentials to a caller seated in
  an open session (`has_live_seat`, migration 0012, asked with the caller's
  own token); anyone else gets STUN only, as does every caller when the
  function lacks its secrets. The first 1,000 GB a month are free, shared
  with Cloudflare's SFU, then $0.05 a GB (only what the relay sends is billed).
- **The clock** (`clock.js`): each player takes five samples of the host's
  time over the mesh and keeps the offset from the shortest round trip, again
  every 30 seconds. Rounds start and are timed on the host's clock.
- **Limits**: the protocol's (16 KB a message, 20 a second, bursts of 40, a
  `send()` counting once whether to one player or all) are enforced by the
  client and again by the bridge, and ride in the welcome, so a client of
  1.3.0 or later follows whatever the hub enforces. Traffic that arrives
  before a game's welcome waits for it, up to 64 messages or 256 KB.

## Bringing the library to sessions

Parallel is the baseline: every game with a score or a finish can do it, with
no networking. The hub brings existing games to it itself, with a tool and a
cheap model, and nothing waits on the game factory. `scripts/retrofit.mjs`
runs on the owner's machine with any agent CLI and Playwright (commands in
[the README](../README.md#bringing-the-library-to-sessions)):

1. **Pick** (`pick [--wave 1]`): one build of each title not yet in sessions,
   readable code and no WebGPU first, then the least code. Wave 1 is the
   titles whose pick is readable and needs no WebGPU.
2. **Can this browser run it?** (`hub-check --draws-only`) If not, as for a
   WebGPU-only game without an adapter, it is noted and no model is spent.
   SwiftShader's flags, through `--browser-args`, give such games an adapter.
3. **Tool** (`prepare`): the client and the parallel metas go before every
   script, after `<meta charset>` when it comes first (the charset must sit in
   the first 1,024 bytes; the client is about 17 KB).
4. **Model**: the prompt in [`lib/hub/retrofit.md`](../lib/hub/retrofit.md),
   which quotes the protocol from *Modes* to *Rules*, wires the score, the end,
   up to six stats the game already keeps and the session calls in a copy of
   the game outside the repository. A game with no score and no finish is
   declared unfit.
5. **Check**: the static check (`check`), at most 150 changed lines, then
   `hub-check --retrofit` against the original.
6. **Retry and escalate**: a second try told what failed, then the next agent,
   until `--max-cost` dollars (default 1). When the cheapest agent's try
   changed nothing, the next agent takes over at once. A pass keeps its
   changes for review; any other game is put back byte for byte, with a
   `sessionNote` in `data/overrides.json` that later runs skip unless
   `--again`. Each try is a line in `.cache/retrofit.jsonl`.

**What it costs.** The pilot (every seventh game of `pick --wave 1`; Claude
Haiku 5.5, then Sonnet 5.5; `--max-cost 1`) passed 26 of 32 games, 24 of them
on Haiku; 2 were unfit and 4 gave up. It cost $16.96 in all, $0.39 a game
(median). The cheapest tier's pass rate decides the bill, and `--max-cost`
bounds the worst case. What passes is reviewed, a few are played, and it goes
in by batches of about fifty.

### Keeping games current

- **Client upgrades by script.** `node scripts/hub-client.mjs` lists every
  pasted client by version; `--write [paths…]` replaces each unmodified older
  copy, a batch at a time. Unmodified means its text hashes to a release in
  `RELEASES` (`scripts/lib/hub-client.mjs`); an edited copy is reported and
  left alone. A new client needs its hash there and a fresh copy in the
  reference games (`scripts/hub-client.test.mjs` checks both). Only pasted
  copies are seen: a game that loads the client from a URL (a few use
  jsDelivr's copy of `main`) is not upgraded, and fails `hub-check`.
- **A forward-compatible client.** Since 1.3.0 the client keeps every welcome
  field, passes on events it has never heard of, forwards whole outcomes for
  the hub to check and trim, and takes its limits from the welcome. Only a new
  method needs a new client.
- **Checks at the door.** `hub-check --record` writes the verdict into
  `data/overrides.json`: a failing game gets `"session": "0"` and a
  `sessionNote` until it passes again. A shared world's server run is
  reported, not held against it.

## Trying and testing

- `pnpm test` covers the client, round, bridge, deal, scores, names, mesh, both
  transports and the tools' pure parts, with no browser.
- `node scripts/hub-check.mjs <game>` runs the harness
  ([*Test it*](../lib/hub/README.md#test-it)) with Playwright: parallel at 1
  and 2 players, ghost and shared world at 2, 3 and 4 on a poor network (150 ±
  50 ms, 5% loss), a host leaving, a shared world hosted by a copy with no
  player, then the game on its own. The report is `.cache/hub-check.json`.
- `node scripts/session-browser.mjs` plays whole sessions in four tabs, then a
  round between two browser contexts over the real mesh.
- In one browser: `pnpm dev`, then `/session?transport=local&examples=1#try`
  in up to four tabs. The host's address shortens things, in seconds:
  `&limit=` (a round), `&results=`, `&splash=` (the card) and `&grace=` (a
  slow game's wait). `&as=1` to `&as=4` fixes a tab's seat.

## Known limits, and what is next

### Limits

- **The round lives in the host's tab.** If that tab goes, a shared world is
  void. A parallel or ghost round is scored by the next host from the last
  status it holds (each player's result, else their last progress; the old
  host last unless they had reported), and counts like any played round. Next:
  the new host resumes the round (seats, start time, results) and re-points
  the bridges.
- **A presence blip counts as leaving.** A player whose Realtime connection
  drops for a moment (a phone screen, a Wi-Fi change) is marked out at once,
  and their healthy mesh links are torn down. Next: about 15 seconds' grace,
  with an explicit goodbye from a player who really leaves.
- **Seats trust each other.** A Realtime envelope carries a sender key the
  sender writes, presence carries the seat each tab claims, and `record_round`
  checks only that the caller is seated (not that it is the host, that rounds
  come in order or that the session is open; `scores` has no size cap). Any
  seated player may also claim the host's place in the database, as the page
  does at a handover. A seated player's modified page could pose as the host,
  and as the database's host remove the others or end the session. One
  defence is in place: a dealt round names its game by slug, and each seat
  loads that game from its own library, never a path from the network.
- **TURN credentials for any seated player.** The `turn` function serves only
  a caller seated in an open session, but with no rate limit, so someone who
  signs in with Google and hosts a session of their own can still take
  credentials; relayed traffic past the free allowance is billed. Until
  2026-11-05 it served anyone, even a call with no sign-in.
- **The check at the door is by hand.** The protocol says the hub tests every
  game when it joins the library. `ingest.mjs` parses every new page (a page
  whose scripts cannot parse is listed), but it does not run `hub-check`: a
  new session game is dealt untested until `hub-check --record` runs on it.
  On 2026-11-05 every session game was checked once, at two players and with
  the host leaving, and the eleven that failed only in ways slow software
  rendering can cause were checked again on a machine with a GPU. 35 are kept
  out (a WebRTC connection of their own, malformed metas, an edited or missing
  client, a wrong result, a copy that never reports its progress) and 311 are
  dealt. Next: run it at import.
- **A sleeping database.** The free Supabase project pauses after a quiet week.
  Hosting or joining then tells the player the server cannot be reached
  (`plainProblem` in `session/net.js`) until the owner resumes the project
  from the dashboard. Next: perhaps a daily keep-alive.
- **A dropped peer link freezes that player's row** on the scoreboard. Next:
  mark the player instead.
- **No server yet, by choice.** The host's copy runs every shared world. The
  games are made ready for a server now, since each game's own part is what
  multiplies: a shared world must run when its host is a copy with no player
  of its own (`AIHub.server`), and the harness and `hub-check` play one such
  round for every shared world (`createRound({ serverKey })`: one more copy,
  never ranked, whose leaving voids the round). The session page never asks
  for one.
- **Four seats**, held by the database (slot 0–3, place 1–4, points 0–3), the
  four seat colours and `SEATS` in `app.js`. The network has no such limit.
- **Same origin.** Games run on the hub's origin, so a game can read the
  signed-in player's Supabase token (`localStorage['ai-hub:auth']`; row-level
  security confines the damage to that player's own rows). Four features reach
  into the game's frame: the card's controller, Create + Options, the Couch's
  controller and the corner bar's wake-on-mouse. New features reach a game
  only through the client, so they add nothing to a move to another origin.

### Next

- **Again**: parallel as "best attempt in the window". A player whose run ends
  early starts a fresh one on the same seed (the hub reloads their frame), and
  their best counts. Most of the library's games are shooters and action
  games, where a run can end long before the round and the first player out
  waits. No game changes; it comes before the rest of wave 1 is dealt.
- **Hub awards for parallel rounds** (a personal best, the most attempts, a
  win on the first try), so no retrofit has to make any.
- **The rest of wave 1**, in batches of about fifty. The pilot's two fixes are
  in: the cheapest tier hands over when its agent changed nothing, and the
  prompt asks for up to six stats (the pilot's games report none, so their
  rounds have no highlights).

### Later

- **Dedicated servers**: a browser with no screen that opens the game page and
  joins as a seat with no player (no incoming connections, so any machine or
  container service will do), a database change so it can join without a
  seat, and the lobby's switch.
- **Watching** shared worlds and ghost races, as a seat with no player fed the
  traffic every copy already gets; with a watcher present every link would go
  through the relay, so nobody learns another's address.
- **Games on their own origin**, once the four features above stop reaching
  into frames.
- **WebGPU and minified builds**: a tool, no model, that turns three.js's
  WebGL 2 fallback back on in a session; then a model that reads minified
  code, or another build of the title.
- **More than four players**, parallel first (up to eight): schema and
  seat-colour changes, not network ones.
- **Build battle**: one source's builds, dealt blind, a vote, the reveal.
- **The deal learns**: a build skipped or voided twice and never played leaves
  the deal (from `session_rounds`); a build `hub-check --draws-only` finds
  needs WebGPU unsaid gets `"webgpu": "required"` in `data/overrides.json`.

### Not doing, and pinned

- **No video, anywhere.** It would tie every game to the hub's origin (a
  capture cannot be handed from a frame to another frame or worker), miss the
  HUDs many games draw in page elements, and make the playing machine pay to
  encode. State costs nothing new: in parallel and ghost the scoreboard is the
  view, and a shared world's watcher would be a copy fed the traffic every
  copy already gets. So no game is asked to snapshot, restore or mirror.
- **Not doing**: late joins and mid-round reconnects (a late player plays from
  the next round); a Discord Activity (Discord's proxy carries no WebRTC, so
  the one network cannot run there, and an invite link shared where friends
  already talk gets most of the benefit).
- **Pinned** until the owner wants it: remote couch co-op, friends far away
  playing a game made for one screen on the host's screen. It needs that
  screen streamed to them as video, with their controllers sent back.
