# AI Hub Session Protocol v1

An **AI Hub session** is up to four players, each on their own device,
playing rounds of games one after another. The hub runs everything around a
round: the invite, the lobby, the seats and names, the network, the clock, the
scoreboard and the results. This page defines how a game takes part in a
round, and how the copies of a game send data to each other.

**https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/README.md**

The hub tests every game when it joins the library, with the same test
described in *Test it*, and keeps a game that fails it out of sessions.

- Client: https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/session.js
- Harness: https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/harness.html

To ask an agent for it, add this to the game's prompt:

> This game must support AI Hub sessions. Follow
> https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/README.md
> (AI Hub Session Protocol v1) and pass the harness's automatic check.

---

## Modes

A game declares one mode.

| Mode | What each copy runs | What the copies send each other |
|---|---|---|
| `parallel` | its own copy of the round | nothing |
| `ghost` | its own copy of the round | each copy's own player: where it is and what it is doing |
| `shared-world` | one world for all players, run by the host's copy | what each player does, to the host; the world, from the host |

- **Parallel**: every player plays their own copy of the round, from the same
  start. Each copy reports its score to the hub.
- **Ghost**: as parallel, and each copy also shows the other players'
  characters where they are, when they are in the same area of the game.
  Those characters do not affect anything in the copy that shows them.
- **Shared world**: all players play in one world. The host's copy runs that
  world; the other copies send it what their own player does, and show the
  world the host sends them.

Games tagged with the older modes keep working: `race` is played as ghost,
`co-op` and `versus` as shared world.

---

## A round

1. The hub loads the game on every player's device, and the players get 10
   to 30 seconds with the game's card: what the game is, how to win, the
   controls. The card is the hub's, from the game's tags, or the game's own
   (*The card*).
2. The game connects and calls `ready()`.
3. The round starts on the hub's clock, on every device at once.
4. The game reports how it goes.
5. The round ends when every player has a result, when the host of a shared
   world finishes it, or when the hub calls time. The hub shows the results
   over the game, then removes it.

### Tags

In the game's `<head>`:

```html
<meta name="hub:session" content="1">
<meta name="hub:session-players" content="MIN-MAX">
<meta name="hub:session-mode" content="MODE">
<meta name="hub:session-goal" content="GOAL">
<meta name="hub:session-howto" content="CONTROLS">
```

- `hub:session-players`: the smallest and largest number of players the game
  takes in a session. The hub deals the game only when the number of players
  is in that range.
- `hub:session-mode`: `parallel`, `ghost` or `shared-world`.
- `hub:session-goal` and `hub:session-howto`: how to win and the game's
  controls, shown on the hub's card.

Optional:

- `hub:session-minutes`: how many minutes a round of the game takes. The hub
  shows it and uses it to decide when to call time.
- `hub:webgpu` with `required`: the game cannot run without WebGPU. The hub
  then deals it only when every player's browser has WebGPU.

### The client

[session.js](https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/session.js)
is pasted into the game unmodified, as the first script in `<head>`, right
after `<meta charset>`. In a session it:

- seeds `Math.random`, in parallel and ghost, before any of the game's own
  scripts run, so it gives the same numbers on every copy;
- gives the game an empty `localStorage` and `sessionStorage` of its own, so
  nothing stored on the device carries into the round, and nothing the round
  stores reaches the device's own storage;
- hands `requestFullscreen()` and `exitFullscreen()` to the hub, which takes
  its whole page fullscreen; `document.fullscreenElement` and
  `fullscreenchange` follow the hub's page.

The hub replaces an unmodified copy of the client with each new version. An
edited copy is not replaced.

### Joining

- `AIHub.active` is `true` from the first line when the hub opened the page.
- In a session, the game opens straight into the round: no title screen,
  menus or prompts before it, other than its own card (*The card*).
- `AIHub.connect({ mode, seats: [min, max] })` returns a promise of the
  round's `info`, or of `null` when there is no hub after all; with `null`
  the game runs as it does on its own.
- `AIHub.ready()` is called once, when the game has loaded and the round can
  start, with no key press: the players answer the card.
- The round starts when the card's countdown ends or every player pressed
  Ready, and every game has called `ready()`. A game still loading then gets
  20 more seconds; after that its player sits the round out.

`info` (also on `AIHub` after `connect()`):

| Field | |
|---|---|
| `me` | this copy's player id |
| `players` | `[{ id, name, color }]`, ids `0..N-1` in seat order |
| `host`, `isHost` | the id of the copy that runs a shared world, and whether it is this one |
| `server` | `true` only on a copy that hosts a shared world with no player of its own |
| `mode`, `round`, `limitMs` | the mode, the round number, and the round's hard limit after the start |
| `seed` | a number, the same on every copy, behind `AIHub.rng(label)` |

Names come from the hub and are never inserted into the page as HTML. Colours
follow the seat: `#e8443a`, `#3b82f6`, `#22c55e`, `#f5b700`.

### The card

Before every round the players get 10 to 30 seconds to learn what comes
next and say when they are ready. By default the hub shows its own card over
the game. A game can make the card its own, as part of the game:

```js
AIHub.connect({ mode, seats, card: true });
```

The hub's card then steps aside when the game calls `ready()`, and the game's
screen is the card until `start`. How it looks and sounds is the game's: its
title, its music, its world, the players lining up. Introduce the game the way
it deserves.

While it is on, the card shows:

- the game's name;
- the players, each in their colour, and which of them are ready;
- how to win the round;
- the controls this player will use;
- the time left, from the `card` event.

And it takes two answers, from the keyboard, a controller, or a tap or click
on the card:

- **Ready**: Enter, Cross (button 0), or a tap on Ready:
  `AIHub.answer('ready')`.
- **More time**: Triangle (button 3), a key the card names, or a tap on More
  time: `AIHub.answer('more')`. Answering `more` again takes it back.

Nothing done on the card changes the round. It has no menus, settings or
choices, and play begins only at `start`. In parallel and ghost it draws no
numbers from `Math.random`, which would change the round's start: use
`AIHub.rng('card')`.

`card` arrives whenever it changes, and every second while the countdown runs:

| Field | |
|---|---|
| `left` | milliseconds until the round starts by itself; `null` while paused or starting |
| `paused` | `true` while most players asked for more time |
| `starting` | `true` once the countdown is over or everyone is ready: `start` follows when every game has loaded |
| `ready` | the ids of the players who are ready |
| `asking` | how many players asked for more time (never who) |
| `asked` | `true` when this player asked for more time |

### The start

`start` arrives when the round starts. Play begins three seconds later, when
`AIHub.time()` reaches 0. `AIHub.time()` is the same timeline on every device,
give or take about 15 ms: negative during the countdown, `-Infinity` before
`start`.

### Reporting

- `AIHub.progress({ score, label })`, in parallel and ghost: the player's
  standing during the round. `score` is a number, higher is ahead; `label` is
  text for the hub's scoreboard. The hub takes the latest about once a second.
- `AIHub.result({ time })` or `AIHub.result({ score })`, in parallel and
  ghost, once, when the player's round is over. `time` is milliseconds of
  `AIHub.time()`, lower wins; `score` is a number, higher wins.
- `AIHub.finish({ standings, scores, won })`, in a shared world, called once,
  by the host only:
  - `standings`: arrays of player ids, best first; players in the same array
    tie. It lists every player still in the round once; anyone left out is
    placed last.
  - `scores` (optional): `{ id: number }`, shown on the scoreboard.
  - `won` (optional): `true` or `false` when the round is a team result.

### Time-up and the end

- The hub may call time while the round is still going. On `time-up`, the
  game reports within `graceMs`: a `result()` in parallel and ghost, a
  `finish()` from the host in a shared world. A shared world with no
  `finish()` by then is void.
- `end` is the last message of a round. After it, the game takes no input and
  sends nothing, and its sound stops. The hub shows its results over the
  game, then removes it.

| `end` reason | |
|---|---|
| `finished` | the round counted; `standings` is the final order |
| `void` | it didn't count (no result, a fatal error, skipped) |
| `host-left` | the host of a shared world left |
| `sat-out` | this player missed the ready deadline |
| `session-ended` | the session closed |

### Leaving

- `leave` arrives with `{ id, reason }` when a player leaves: `left`,
  `disconnected`, `not-ready` or `kicked`. It is final for the round.
- A parallel or ghost round goes on whoever leaves, the host included.
- A shared-world round is void when its host leaves, isn't ready, or has its
  tab hidden for more than 20 seconds.
- `AIHub.fail(message)`: the game cannot run in this browser. From the host
  of a shared world it voids the round; from any other copy it counts as
  that player leaving.

### Scoring

- Parallel and ghost: players with a `time` rank first, lowest first; then
  the rest by `score`. A player with no result is ranked by their last
  progress.
- Shared world: the host's `standings`. With `won`, the results show a team
  result instead of medals.
- Each player gets one point for every player they beat.

`result()` and `finish()` may also carry `stats` and `awards`, shown with the
results:

- in `result()`: `stats` is `{ name: value }` and `awards` is
  `[{ title, detail }]`, for this player;
- in `finish()`: `stats` is `{ id: { name: value } }` and `awards` is
  `[{ id, title, detail }]`, for each player.

Places and points come only from the standings, `time` and `score`.

---

## Sending data between copies

### Parallel

The copies send nothing to each other. `send()` is not used.

### Ghost

Each copy sends its own player's position and what the player is doing to
the other copies with `send()`. Each copy shows the other players' characters
only while they are in the same area of the game as its own player, and those
characters do not affect its world. `Math.random` is seeded as in parallel.

### Shared world

- The host's copy (`AIHub.isHost`) runs the world. The other copies send the
  host what their own player does, and show the world the host sends them.
- The hub can run the host's copy with no player of its own: `AIHub.server`
  is `true` and `AIHub.me` is not among `AIHub.players`. The host's copy runs
  the world in that case too, with no local player, camera or input.
- `Math.random` is not seeded. `AIHub.rng(label)` gives the same numbers on
  every copy.

### `send()` and `message`

- `AIHub.send(data, { to, reliable })` sends `data` to every other copy, or
  to the one player `to`. It returns `false` when the message is dropped.
- `AIHub.on('message', (data, from) => …)` receives it; `from` is the
  sender's player id. A copy never receives its own messages. Messages sent
  before another copy has loaded are queued for it.
- `data` is JSON, at most 16 KB.
- At most 20 messages a second leave each copy, with bursts up to 40; the
  client drops the rest.
- Reliable messages (the default) arrive in the order they were sent.
  Messages sent with `reliable: false` may be lost or arrive out of order. An
  unreliable message larger than about 1,200 bytes travels as several packets
  and is lost whole if any of them is.

---

## Rules

In a session:

- **Network only through the hub.** No WebSocket, WebRTC, or `fetch` to a
  game server or public broker. Loading the game's own files is fine.
- **No communication between players.** No chat, voice, emotes or custom
  names. Names come from the hub.
- **The page stays.** No `alert`, `confirm` or `prompt`; no `window.open`,
  new tabs or navigating away. Quitting, restarting or returning to a title
  screen does nothing; the hub starts and ends rounds.
- **Create + Options is the hub's.** On a controller, holding the two
  together opens the hub's corner bar; the game ignores Options while Create
  is held.

Everything on this page applies only in a session (`AIHub.active`). Outside
one, the game is not affected.

---

## Test it

The harness plays the hub: it loads the game 1–4 times on a simulated network
and runs the checks the hub runs when a game joins the library. Serve it next
to the game:

```bash
curl -fsSO https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/harness.html
curl -fsSO https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/bridge.js
curl -fsSO https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/round.js
python3 -m http.server 8000
```

Then open `http://localhost:8000/harness.html?game=GAME.html&players=2&auto=1`.
The hub's own test also runs ghost and shared-world games with
`&players=4&latency=150&jitter=50&loss=5&auto=1`, again with
`&scenario=host-leave`, and shared worlds once more with
`&players=2&scenario=server`.

The checklist fills in as it runs. **A game passes when
`window.__hubCheck.pass` is true**; `document.body.dataset.complete` becomes
`"true"` at the end. It checks:

- the tags, `connect()`, `ready()` with no key press, and the start;
- with the game's own card, that Enter answers Ready;
- parallel and ghost: `Math.random` the same on every copy, and progress from
  every copy; parallel sends nothing, ghost sends;
- shared world: traffic both ways, and a round hosted by a copy with no
  player of its own;
- a player leaving, the host leaving, time-up, a valid result, and every copy
  told the round ended;
- no protocol problems, errors, dialogs, popups or sockets.

**New round**, **Time up**, **Remove player** and **Hide host tab** run the
cases by hand; clicking a player's frame gives it the keyboard and mouse.
`&limit=` sets the round's length in seconds and `&seed=` fixes the seed. The
game is served from the harness's own origin.

In the AI Hub repository, `node scripts/hub-check.mjs <game>` runs the same
checks with Playwright, then opens the game outside a session to see it still
runs there.

---

## Reference

### Tags

| Tag | |
|---|---|
| `hub:session` | `1`: this protocol |
| `hub:session-players` | `MIN-MAX`: the number of players the game takes in a session |
| `hub:session-mode` | `parallel`, `ghost` or `shared-world` |
| `hub:session-goal` | how to win, shown on the hub's card |
| `hub:session-howto` | the controls, shown on the hub's card |
| `hub:session-minutes` | optional: how many minutes a round takes |
| `hub:webgpu` | optional: `required` when the game cannot run without WebGPU |

### API

| | |
|---|---|
| `AIHub.active` | `true` in a session, from the first line |
| `AIHub.connect({ mode, seats, card? })` | → `Promise<info \| null>`; `null`: no hub. `card: true`: the game shows its own card |
| `AIHub.ready()` | once, when the round can start |
| `AIHub.answer('ready' \| 'more')` | on the game's own card, before `start` |
| `AIHub.time()` | milliseconds since play began: negative in the countdown, `-Infinity` before `start` |
| `AIHub.on(event, fn)` | returns a function that removes the handler |
| `AIHub.progress({ score, label })` | parallel and ghost |
| `AIHub.result({ time \| score, stats?, awards? })` | parallel and ghost, once |
| `AIHub.finish({ standings, scores?, won?, stats?, awards? })` | shared world, the host, once |
| `AIHub.send(data, { to, reliable })` | ghost and shared world |
| `AIHub.rng(label)` | a generator of numbers in `[0, 1)`, the same on every copy, one stream per label |
| `AIHub.seeded` | `true` when the client seeded `Math.random` |
| `AIHub.fail(message)` | the game cannot run in this browser |

`AIHub.probe()` and `AIHub.inspect()` exist for older games; the hub does not
read them.

| Event | Arguments |
|---|---|
| `card` | `{ left, paused, starting, ready, asking, asked }`, with the game's own card |
| `start` | `{ in }`: milliseconds until play begins |
| `message` | `data, from` |
| `leave` | `{ id, reason }` |
| `time-up` | `{ graceMs }` |
| `end` | `{ reason, standings }` |

Events that arrive before a handler is attached are kept, and delivered in
order when the first handler is attached. Fields and events a newer hub adds
reach the game through the client unchanged.

### Versions

This is protocol **1**, client **1.4.0**. Changes within version 1 only add:
games on older clients keep working. A change that would break a game becomes
protocol 2, with its own `hub:session` value.
