# AI Hub Session Protocol v1

How a browser game joins an **AI Hub session**: up to four friends, each on
their own device, playing one round of your game together while the hub deals
the games, keeps the clock and keeps score. This page is everything a game
needs. Give its address to the agent building the game:

**https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/README.md**

The hub owns everything around a round: the invite, the lobby, the seats and
names, the network, the clock, the scoreboard and the results. A game plays
one round and reports how it went. The hub checks every game when it joins
the library, with the same test you can run yourself (*Test it*), and keeps a
game that fails it out of sessions.

- Client: https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/session.js (also in the appendix)
- Harness: https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/harness.html (run from a folder of your own: *Test it*)
- Examples, one per mode: [parallel.html](https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/examples/parallel.html) (side by side),
  [race.html](https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/examples/race.html) (race),
  [arena.html](https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/examples/arena.html) (versus)

---

## Start here: pick one mode

A game declares the one way it plays best together:

| Your game | Mode | What the players see |
|---|---|---|
| Plays alone at heart, with a score or a finish line | `parallel` | their own copy of the game, started the same for everyone; the hub shows who is ahead |
| A course everyone runs at once | `race` | their own player on one shared course, the others in it as rivals |
| One world everyone shares | `versus` or `co-op` | one world, run by the host's copy (or a server), every player in it |

**Side by side** (`parallel`) is the minimum, and every game with a score or
a finish can do it: read *Side by side* and *Rules*. Race, versus and co-op
take more work and make the best party games: read *Side by side* first, then
*Playing together*.

To ask an agent for it, add this to the game's prompt:

> This game must support AI Hub sessions. Follow
> https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/README.md
> (AI Hub Session Protocol v1): pick the mode the game plays best together (side by side,
> race, versus or co-op), add the hub:session meta tags, paste session.js in
> unmodified as the first script in <head>, implement session mode, report
> progress and a result (in versus or co-op, run the shared world even when
> the host is a server with no player of its own), play fully with keyboard
> and mouse and with a standard gamepad, open settings with Esc or Options,
> register AIHub.probe, and pass the harness's automatic check. The game must
> still play normally on its own.

---

## Side by side

Everyone plays their own copy of the game, from the same start, on the same
clock. Nothing passes between the copies: each tells the hub its score as it
goes, and the hub draws the scoreboard and ranks the round. A game needs no
networking for this.

### The seven steps

1. **Declare it** in `<head>`:

   ```html
   <meta name="hub:session" content="1">
   <meta name="hub:session-players" content="1-4">
   <meta name="hub:session-mode" content="parallel">
   <meta name="hub:session-minutes" content="4">
   <meta name="hub:session-goal" content="Most points before time runs out">
   <meta name="hub:session-howto" content="Move ← →, jump Space or Cross">
   ```

   `minutes` is a typical round; the hub calls time at one and a half times
   it, never past 15 minutes. `goal` (how to win, at most 60 characters) and
   `howto` (the controls, at most 80) are shown on the hub's card before your
   game starts: write them for someone who has never seen it.

2. **Paste the client** (`session.js`, the appendix) unmodified, as the
   **first script in `<head>`**, right after `<meta charset>`. Side by side,
   it seeds `Math.random` before any of your own code runs, so every copy
   builds the same start.

3. **In a session, skip the title.** `AIHub.active` is true from the first
   line when the hub opened the page. Then skip the title screen, attract
   mode and menus, connect, build the run, and say you are ready, with no
   prompt of your own:

   ```js
   if (AIHub.active) {
     const info = await AIHub.connect({ mode: 'parallel', seats: [1, 4] });
     if (info) { buildRun(); AIHub.ready(); }      // null: no hub after all, play normally
   } else {
     showTitleScreen();                             // the game as it always was
   }
   ```

4. **Start on the clock.** Play begins when `AIHub.time() >= 0`; it is
   negative during the 3-2-1 that follows the `start` event. Take your run's
   time from it too.

5. **Report progress** whenever the score changes:
   `AIHub.progress({ score, label })`. `score` is a number where higher is
   ahead (points, distance, laps done); `label` is short text for the
   scoreboard, at most 24 characters ("Lap 2 of 3", "Floor 4"). Call it as
   often as you like: the client passes the latest on about once a second.

6. **Report the result once**, when your run ends:
   `AIHub.result({ time })` for a finish (milliseconds of `AIHub.time()`,
   lower wins) or `AIHub.result({ score })` (higher wins), optionally with
   stats and awards (*Results*). On the `time-up` event, report your score
   at once if the run is still going. A run that reports nothing is ranked by
   its last progress.

7. **On `end`, go quiet**: stop input and sound and leave the final screen.
   No "play again".

Everything else stays as it was: outside a session the game plays exactly as
before. A skeleton:

```js
let run = null;
if (AIHub.active) {
  AIHub.connect({ mode: 'parallel', seats: [1, 4] }).then((info) => {
    if (!info) return showTitleScreen();
    run = newRun();                      // Math.random is already seeded: same start everywhere
    AIHub.on('time-up', () => run.over || finish());
    AIHub.on('end', () => { run.stopped = true; stopSound(); });
    AIHub.ready();
  });
} else showTitleScreen();

function frame() {
  if (run && !run.stopped && AIHub.time() >= 0) {
    step(run);                           // the game's own loop
    AIHub.progress({ score: run.score, label: `Wave ${run.wave}` });
    if (run.lives === 0 && !run.over) finish();
  }
  requestAnimationFrame(frame);
}
function finish() { run.over = true; AIHub.result({ score: run.score }); }
```

**Starfall** ([parallel.html](https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/examples/parallel.html))
is the whole pattern in a small game.

### What side by side allows

- **Pausing.** Nothing is shared, so a menu may pause your own run. The
  hub's clock keeps going.
- **No networking at all.** Don't call `send()`; there is nobody to send to.
- **The same start, not the same game.** The seeded `Math.random` makes the
  first board, deal or level the same on every copy. Draws during play
  (particles, AI jitter) depend on frame rate and quality settings, so they
  drift apart. If your game deals pieces, cards or levels from one function,
  draw them from `AIHub.rng('deal')` instead: that stream stays the same all
  round. Leave every other random call alone.

### A long game

A round lasts 2–8 minutes and never more than 15. A long game needs a slice
that fits, with a number to rank by: "finish all 7 jobs", "most floors in
5 minutes", "% of the map explored". A game with no score and no finish (a
toy, a sandbox, a tool) is not a session game.

---

## Rules

For every mode.

- **No communication between players.** No chat, voice, emotes, stickers,
  pings carrying text, drawings shown to others, or custom names, in a
  session or out of it. Players talk in an app of their own. Names come from
  the hub and are shown as text.
- **No interruptions.** No `alert`, `confirm` or `prompt`; no `window.open`,
  new tabs or navigating away; pointer lock and fullscreen only from a
  player's gesture. In a session the hub owns fullscreen: the client hands
  your `requestFullscreen()` and `exitFullscreen()` to it, and the hub's
  whole page goes fullscreen, so its scoreboard and cards stay over your
  game. `document.fullscreenElement` and `fullscreenchange` follow the hub's
  page, so a fullscreen toggle works as it always did.
- **A fair start.** Nothing saved on the device changes a session round: no
  unlocks, upgrades, levels or handicaps carried over. The client sees to it:
  in a session the game gets an empty `localStorage` and `sessionStorage` of
  its own, so every round starts as a first launch, and nothing the round
  saves touches the player's own saves. Settings start at their defaults.
- **Load fast.** The hub loads your game under the last round's results and
  its own card; be ready within about 20 seconds on broadband, and keep the
  page under about 25 MB. Fetch what can wait (music, later levels) after
  `ready()`.
- **Runs where your friends are.** WebGPU may make a game look better; give
  it a WebGL 2 fallback so everyone can play. A game that cannot play without
  WebGPU declares `<meta name="hub:webgpu" content="required">`, and the hub
  deals it only when every player's browser has WebGPU. Call
  `AIHub.fail('why')` only when nothing works.
- **Network only through the hub.** In a session: no WebSocket, WebRTC,
  `fetch` to a game server or public broker. Loading your own files is fine.
- **Outside a session, nothing changes.** Everything on this page applies
  only in session mode, except the controls and the settings menu below.

### Controls

Every new session game plays fully with **keyboard and mouse**, and fully
with a **controller**: a PS5 DualSense, or any pad the browser reports in its
standard mapping. Fully means its menus, its settings and play, in a session
and out of it. Touch is optional.

| DualSense | Standard index | Use it for |
|---|---|---|
| Cross | button 0 | confirm in menus; the main action (jump, accelerate, fire) |
| Circle | button 1 | back in menus |
| Square, Triangle | buttons 2, 3 | secondary actions |
| L1, R1 | buttons 4, 5 | |
| L2, R2 | buttons 6, 7 (also analogue `value`) | brake and gas, aim and fire |
| Create | button 8 | nothing on its own (below) |
| Options | button 9 | open and close the settings or pause menu |
| L3, R3 | buttons 10, 11 | |
| D-pad | buttons 12–15 (up, down, left, right) | menus; movement where it fits |
| Left stick | axes 0, 1 | move, steer |
| Right stick | axes 2, 3 | camera, aim |

- Read `navigator.getGamepads()` every frame, take the first connected pad,
  and treat a button as pressed on the frame it goes down. Pads appear after
  their first press: nothing needs one plugged in at load.
- **Create + Options is the hub's.** Held together for a second it opens the
  hub's corner bar. Ignore Options while Create is held.

### The settings menu

**Esc** or **Options** opens your game's settings over the game, and the same
key (or Circle) closes it. Only settings that change this device belong in it
(volume, quality, controls); "Quit" or "Restart" do nothing in a session.
In a shared world (race, versus, co-op) the menu never pauses: the host keeps
simulating, every copy keeps sending, and the player with the menu open just
idles. Side by side, and out of a session, it may pause.

### The probe

The harness can only check what it can see, so a game tells it where it is.
Register one function, in a session and out of it:

```js
AIHub.probe(() => ({
  scene: 'play',          // 'title' | 'menu' | 'ready' | 'play' | 'over'
  menu: settingsOpen,     // is the settings menu open?
  world: simSeconds,      // any number that rises while the world runs
  input: { x, y, fire },  // the local controls as the game read them this frame
}));
```

### An existing game, upgraded

An existing game brought to side by side (the hub upgrades its library this
way) changes only what the seven steps need, and keeps its controls, menus
and feel exactly as they were. The controller, the settings menu and the
probe are then welcome but not required, and the hub's check compares the
game on its own with the original instead.

---

## Playing together

Race, versus and co-op: everyone plays in one place, the same track, the same
pitch, the same park, and they can touch. Do the seven steps of *Side by
side* first, with three differences: declare your own mode
(`hub:session-mode`), connect with it, and don't expect `Math.random` to be
seeded (it isn't, outside side by side: ids made from it must differ between
copies). Then:

- **Seats.** `hub:session-players` must cover 2, 3 and 4. Start it at 1 when
  one player still gets a real game (computer rivals, a clock or score to
  beat).
- **Never pause the shared world**, not for a menu, a lost focus or a hidden
  tab. Advance by elapsed time, cap the catch-up after a stall (a few steps
  at most), and have non-host copies snap to the host's next snapshot.
- **Handle a player leaving at any moment** (*Leaving*).
- **Own your player.** Every copy moves its own player the moment its input
  happens and never waits for the network to do so. Friends invited each
  other, so a copy is trusted with its own player: what decides the design is
  how it feels, not cheating.

### The players and the seed

`info` (also on `AIHub` after `connect()`):

| Field | |
|---|---|
| `me` | your player id |
| `host` | the id of the copy that runs a shared world; any seat, never assume `0` |
| `isHost` | `me === host` |
| `players` | `[{ id, name, color }]`, ids `0..N-1` in seat order |
| `mode` | `parallel`, `race`, `versus` or `co-op` |
| `seed` | an unsigned 32-bit number, the same for every copy |
| `limitMs` | the round's hard limit after the start |
| `round` | the round number in the session |
| `splash` | `true` when the hub shows its card and collects ready (every round the hub runs) |
| `server` | `true` only on a copy that hosts a shared world with no player of its own (a server; `me` is not among `players`) |

- **Ids** are small integers, the same on every copy. Index arrays by them;
  spawn points and starting order follow them.
- **Names** are the hub's nicknames ("Teal Otter"): letters and spaces, at
  most 16 characters. Draw them on a canvas or set `textContent`; never put
  them into HTML.
- **Colours** follow the seat: red, blue, green, yellow (`#e8443a`,
  `#3b82f6`, `#22c55e`, `#f5b700`). Tint each player with theirs.
- **The seed** builds the same content on every copy: `AIHub.rng(label)`
  gives a generator of numbers in `[0, 1)`, a separate stream per label, so
  `rng('course')` and `rng('items')` never disturb each other. Build content
  from integers it gives you; never assume two devices run the same physics
  or floating-point maths to the same result.

### Sending and receiving

```js
AIHub.send({ t: 'me', at: AIHub.time(), x: 412, y: 96 }, { to: AIHub.host, reliable: false }); // to one player
AIHub.send({ t: 'pick', id: 2, star: 7 });                                                     // to everyone else
AIHub.on('message', (data, from) => { … });                                                   // from is a player id
```

- **JSON only**, at most **16 KB** a message.
- **At most 20 messages a second**, with bursts up to 40. Every `send()`
  counts once, to everyone or to one player, so send a snapshot to everyone
  in one message rather than one per player. Snapshots at about **15 a
  second** leave room for events; 20 a second plus events overflows.
- **Keep state small.** An unreliable message is lost whole if any of its
  packets is (about 1,200 bytes each): keep a state message under about
  1 KB where you can and under 4 KB always. Send arrays of rounded numbers,
  not objects with long keys.
- **Reliable** (the default) messages arrive in the order each sender sent
  them; `reliable: false` ones may be lost or reordered. Use them for state
  that is resent anyway. Stamp state with `AIHub.time()` and ignore anything
  older than what you have applied.
- **Latency is 30–250 ms** each way and varies. Never wait for a message to
  take a step (no lockstep). Interpolate the others; predict your own.
- You never receive your own messages. Anything sent before another copy has
  loaded is queued for it.

### Versus and co-op: the host runs the world

The host's copy (`AIHub.isHost`) runs the one true simulation of everything
shared: the ball, computer players, enemies, pickups, the score, the
mission, the match clock.

- Every other copy moves **its own player** locally and sends its state to
  the host about 15 times a second, `reliable: false`, small:
  `{ t: 'me', at: AIHub.time(), x, y, vx, vy, facing, action }`. Actions
  that touch shared things (a kick, a shot, a door) ride in it, or go as a
  reliable event when they must not be lost.
- The host takes those players where they say they are, steps the world, and
  sends one **snapshot** to everyone about 15 times a second, unreliable:
  every player, every moving shared thing, the score.
- One-off **events** that must not be lost (a goal, a knockout, a mission
  step, the match ending) go reliable.
- The other copies draw everything but their own player from the snapshots,
  interpolated about two snapshots behind (*Interpolating*); slow bodies may
  simply ease toward the newest, as the example does. If the host has to
  overrule a player (a tackle, a spawn), it says so with an event and that
  copy blends to it over a few frames.
- Where a non-host player is about to touch a shared thing (a ball at their
  feet), let that copy predict the contact and send it; the host accepts it
  unless someone else got there first.
- Keep the shared world in plain data, apart from what you draw: the
  snapshot you send is then that data. Gameplay never reads anything back
  from the GPU.
- When the match is decided, the host calls `finish()` and sends a last
  reliable event so the others show the result at once.
- **The host may be a server.** The hub can host a shared world on a copy
  with no player of its own: there `AIHub.server` is true and `AIHub.me` is
  not among `AIHub.players`. It runs and sends the world like any host,
  moves nobody, takes no input, and may skip drawing. So never let the
  host's simulation assume a local player, a camera or input; the check runs
  one round hosted this way.

[arena.html](https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/examples/arena.html)
is the plain form of this pattern.

### Race: a shared course with solid rivals

Every copy builds the same course from the seed and simulates only its own
player, so nobody's controls ever wait. The others are rivals on that course,
solid and in their colours.

- Each copy sends its **state** about 15 times a second, unreliable:
  `{ t: 'p', at: AIHub.time(), x, y, z, vx, vy, vz, yaw, … }`, with whatever
  else draws it and its progress along the course.
- Draw the others interpolated about two samples behind; extrapolate from the
  last velocity for at most about 200 ms when samples are late, then hold.
- **Contact**: each copy resolves collisions for its own player only, against
  the others predicted to *now* (last sample plus velocity × age). Push your
  own player out and trade velocity as if the other had your mass; both
  copies do the same, so the bump is mutual. Never move another player's body.
- **The victim decides.** Anything that hits another player (a thrown item, a
  shove, a spin-out) is a reliable event to that player's copy:
  `{ t: 'hit', kind, at }`. Their copy applies it and tells everyone.
- **Shared pickups** (item boxes, coins) exist on every copy, built from the
  seed. Taking one sends a reliable `{ t: 'take', id, at }`; everyone removes
  it. If two take the same one, the earlier `at` keeps it (then the lower
  id), and the other copy quietly undoes its pickup. Respawns follow the
  clock: `at + delay` everywhere.
- **Scripted enemies** (waves, a train on a timetable) run on every copy from
  the seed and `AIHub.time()`. A kill is a claim like a pickup.
- **Computer rivals** are run by the lowest id still in the round and sent
  like a player; when that player leaves, the next lowest carries on.
- Each copy reports its own result: `AIHub.result({ time })` at the finish,
  with a reliable `{ t: 'done' }` so the others can show it; on `time-up`,
  `AIHub.result({ score: distance })`.

A race survives any player leaving, its host included. Ghosts (rivals you
pass through) are right only where contact makes no sense, as in time trials:
[race.html](https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/examples/race.html).

### Interpolating

Keep each remote body's samples, stamped with the sender's `AIHub.time()`.
Draw it about two send intervals in the past (100 ms at 20 a second, about
150 ms at 12–15): find the two samples around that moment and blend between
them, positions linearly and angles the short way round. The clock is shared,
so no copy has to guess another's delay. Snap instead of blending after a
teleport (a respawn), which the sender marks. Within a few body lengths of
your own player, draw fast bodies nearer to *now* (the last sample carried
forward by its velocity), blending back with distance: what you see is then
what you hit.

### Ending a shared world

Only the host calls

```js
AIHub.finish({
  standings: [[2], [0, 3], [1]],    // best first; ties share a group
  scores: { 0: 1200, 1: 300, 2: 2500, 3: 1200 },   // optional, shown on the scoreboard
  won: true,                         // co-op only: did the team win?
});
```

- `standings` lists every player still in the round exactly once. Players who
  left may be placed or left out; anyone left out goes last.
- Teams are tied groups: `[[0, 2], [1, 3]]`. A co-op game may rank players
  by contribution, or put everyone in one group.
- On `time-up` the host finishes at once with the standings as they are. A
  versus or co-op round with no `finish` within 5 seconds is void: nobody
  scores.

### Leaving

```js
AIHub.on('leave', ({ id, reason }) => removePlayer(id));
```

A player can leave at any moment: they closed the tab, lost their connection
(`disconnected`), weren't ready (`not-ready`) or were removed (`kicked`).
It is final for the round: remove or freeze their player and carry on.

- In versus, when only one player is left, the host finishes at once.
- If the **host** of a versus or co-op round leaves, isn't ready, or has its
  tab hidden for more than 20 seconds, the round is void.
- A race or side-by-side round goes on when a player leaves.
- If the game cannot run at all here (no WebGL, a failed load), call
  `AIHub.fail('why')`: from the host of a shared world it voids the round,
  from anyone else it counts as leaving.

### Games with multiplayer of their own

A game may keep its own multiplayer, started from its own menu, outside
sessions. Write the netcode once against a small interface and give it two
adapters:

```js
// what the netcode uses: { me, isHost, players, send(data, {to, reliable}), onMessage(fn), onLeave(fn) }
function hubNet(info) {
  return {
    me: info.me, isHost: info.isHost, players: info.players,
    send: (data, opts) => AIHub.send(data, opts),
    onMessage: (fn) => AIHub.on('message', fn),
    onLeave: (fn) => AIHub.on('leave', ({ id }) => fn(id)),
  };
}
// …and peerNet(), the game's own: PeerJS, a room code, its own lobby.
```

In a session the game's own lobby, room codes and broker are never shown or
used.

---

## Results

`result()` (side by side, race) and `finish()` (versus, co-op) may carry the
round's highlights, which the hub shows on the results and keeps:

```js
AIHub.result({                        // about yourself
  time: 95230,
  stats: { laps: 3, 'best lap': '30.11 s', bumps: 7 },
  awards: [{ title: 'Fastest lap', detail: '30.11 s' }],
});
AIHub.finish({                        // the host, for everyone
  standings: [[0, 2], [1, 3]],
  stats: { 0: { goals: 3, saves: 1 }, 1: { goals: 1 } },
  awards: [{ id: 0, title: 'Hat-trick', detail: '3 goals' }],
});
```

- `stats`: up to 6 per player, the numbers someone would ask about
  afterwards. Names are plain text up to 16 characters; values are finite
  numbers or text up to 16 characters (format times yourself: `'30.11 s'`).
- `awards`: up to 3 per player per round, `title` up to 24 characters and an
  optional `detail` up to 40. An award is a moment worth a cheer; give them
  for doing something, never for coming last.
- Anything over these limits is cut. Places and points come only from the
  standings, `time` and `score`: each player scores one point for every
  player they beat, so every round counts the same whatever the game.

`end` is the last message of a round:

```js
AIHub.on('end', ({ reason, standings }) => { … });
```

| reason | |
|---|---|
| `finished` | the round counted; `standings` is the final order |
| `void` | it didn't count (no result, a fatal error, skipped) |
| `host-left` | the host of a shared world left |
| `sat-out` | this player missed the ready deadline |
| `session-ended` | the session closed |

After `end`, stop sending, fade the audio and show the final state. The hub
shows its results over your frame and then removes it.

---

## Ready, start and the clock

**Under the hub's card** (`info.splash` is `true`: every round the hub runs)
the hub shows your game's name, `goal` and `howto` with a 10-second countdown
and two buttons, *Ready* and *I need more time*, while your game loads
underneath. The players answer it, not your game:

- Show no ready prompt of your own: no "press any key", no "click to start".
- Call `AIHub.ready()` as soon as the round can start. It means *loaded*.
- Then wait for `start`. Create or resume your `AudioContext` on `start`, and
  again on the player's first input.

The round starts when the card's countdown ends or everyone pressed Ready,
and every game has said `ready`. A game still loading then gets 20 more
seconds; after that its player sits the round out (`end` with `sat-out`).

**Without the card** (`info.splash` is `false`: an older hub, or the
harness with `&splash=0`): once loaded, show the roster and one line, *Press
any key, click or tap when you are ready*, and call `AIHub.ready()` from that
input's handler.

`start` arrives when everyone is ready; play begins three seconds later.
`AIHub.time()` is the same timeline on every device, give or take about
15 ms: negative during the countdown, `-Infinity` before `start`. No input
counts before 0. Stamp anything you compare across players with it.

---

## Test it

The harness plays the hub: it loads your game 1–4 times on a simulated
network and runs the same checks the hub runs when your game joins the
library. Serve it next to your game from one folder:

```bash
curl -fsSO https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/harness.html
curl -fsSO https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/bridge.js
curl -fsSO https://raw.githubusercontent.com/michaelcrosato/ai-hub/main/lib/hub/round.js
python3 -m http.server 8000
```

Then open:

- Side by side: `http://localhost:8000/harness.html?game=mygame.html&players=2&auto=1`
- Race, versus, co-op: `…&players=4&latency=150&jitter=50&loss=5&auto=1`, and
  again with `&scenario=host-leave`; versus and co-op once more with
  `&players=2&scenario=server`

The checklist on the right fills in as it runs; the result is in
`window.__hubCheck` (`{ done, pass, checks }`), and
`document.body.dataset.complete` becomes `"true"` at the end, for a headless
browser to wait on. **A game passes when `window.__hubCheck.pass` is true**:

- **Side by side**: at 1 and 2 players, and with a player leaving. Checked:
  the metas; hello and ready under the card with no key press; the round
  starts; `Math.random` seeded the same on every copy; progress from every
  copy; no game traffic; a valid result, and every copy told it ended; no
  protocol problems, errors, dialogs, popups or sockets; and, when the game
  probes, the keyboard, a pad and the settings menu.
- **Race, versus, co-op**: at 2, 3 and 4 players on a bad network, with a
  player leaving and a time-up, and with the host leaving. Checked as above,
  plus game traffic both ways and a world that keeps moving while the menu is
  open. Versus and co-op also play one round hosted by a copy with no player
  of its own, which must run the world and finish the round.

Click a player's frame to control that player. **New round**, **Time up**,
**Remove player** and **Hide host tab** walk through the cases by hand;
`&limit=20` shortens the round to 20 seconds and `&seed=7` fixes the seed.
The game must be served from the harness's own origin.

In the AI Hub repository, `node scripts/hub-check.mjs <game>` runs all of it
with Playwright, with an emulated DualSense in every frame, and then plays the
game on its own: the controller alone and the keyboard alone, from its title
to play, opening and closing its menu.

---

## Reference

### Metas

| Meta | |
|---|---|
| `hub:session` | `1`: this protocol |
| `hub:session-players` | the seats in a session, `1-4` or `2-4`; must cover 2, 3 and 4 |
| `hub:session-mode` | `parallel`, `race`, `versus` or `co-op` |
| `hub:session-minutes` | a typical round, in minutes; the limit is 1.5 × it, at most 15 |
| `hub:session-goal` | how to win, at most 60 characters |
| `hub:session-howto` | the controls, at most 80 characters |
| `hub:webgpu` | `required` when the game cannot play without WebGPU; it is then dealt only when every player's browser has it |

`hub:players` keeps its own meaning: the seats when the game is played on its
own.

### API

| | |
|---|---|
| `AIHub.active` | `true` in session mode, from the first line |
| `AIHub.connect({ mode, seats })` | → `Promise<info \| null>`; `null` means play normally |
| `AIHub.me`, `.host`, `.isHost`, `.players`, `.mode`, `.seed`, `.limitMs`, `.round`, `.splash`, `.server` | the round, after `connect()` |
| `AIHub.seeded` | `true` when the hub seeded `Math.random` (side by side) |
| `AIHub.ready()` | once: as soon as loaded under the card, otherwise from the ready gesture |
| `AIHub.on(event, fn)` | returns a function that removes the handler |
| `AIHub.time()` | ms since the start; negative during the countdown; `-Infinity` before `start` |
| `AIHub.rng(label)` | a seeded generator of numbers in `[0, 1)`, one stream per label |
| `AIHub.progress({ score, label })` | side by side and race: your standing, as often as you like; the hub hears it about once a second |
| `AIHub.result({ time \| score, stats?, awards? })` | side by side and race: once, about yourself |
| `AIHub.finish({ standings, scores?, won?, stats?, awards? })` | versus and co-op: the host, once |
| `AIHub.send(data, { to, reliable })` | race, versus, co-op; `to` one player id, or everyone else; returns `false` when dropped |
| `AIHub.fail(message)` | the game cannot run here |
| `AIHub.probe(fn)` | for the harness: `fn()` returns `{ scene, menu, world, input }`, in a session or out |
| `AIHub.inspect()` | what the probe returns, as JSON, or `null` |

| Event | Arguments |
|---|---|
| `start` | `{ in }`: milliseconds until play begins |
| `message` | `data, from` |
| `leave` | `{ id, reason }`: `left`, `disconnected`, `not-ready` or `kicked` |
| `time-up` | `{ graceMs }`: report within this long |
| `end` | `{ reason, standings }` |

Events that arrive before a handler is attached are kept and delivered, in
order, when the first one is. Any field or event a newer hub adds reaches the
game through this client unchanged: the welcome's fields land on `AIHub` and
`info`, and an event this client does not know arrives at `on()` as one
object.

### What the hub does around your round

Each player scores one point for every player they beat, so every round of
four is worth three points to its winner, whatever the game. Between rounds
the hub shows the results over your frame, then its card for the next game
while that game loads: about fifteen seconds from one round's end to the next
one's start. Side-by-side and race games show on a live scoreboard from their
progress. The hub deals games from two decks, side by side and played
together, in turn, so the few shared worlds come round as often as the many
side-by-side games.

### Versions

This is protocol **1**, client **1.3.0**. 1.1.0 added stats and awards;
1.2.0 the card (`splash`), `probe()` and `inspect()`; 1.3.0 side by side
(`parallel`, `progress()`, the seeded `Math.random`), a storage of the
game's own in a session, fullscreen handed to the hub, and made the client
pass on any welcome field or event a newer hub adds. Games on older clients
keep working. Changes within version 1 only add; a change that would break a
game becomes protocol 2, with its own `hub:session` value.

The hub replaces an unmodified older client in its games with the current one
by a script, so paste the client exactly as it is: an edited copy is never
upgraded.

---

## Appendix: session.js

```js
/*! aihub-session 1.3.0 — AI Hub Session Protocol v1 client. Paste it into your game unmodified. */
(function (root) {
  'use strict';
  if (root.AIHub) return;

  var VERSION = '1.3.0';
  var HELLO_EVERY_MS = 500;
  var HELLO_TIMEOUT_MS = 10000;
  var PROGRESS_EVERY_MS = 1000;
  /** The hub's welcome may change these; a newer hub never needs a newer copy of this file for it. */
  var limits = { maxBytes: 16384, ratePerS: 20, burst: 40 };

  var framed = false;
  try {
    framed = root.parent && root.parent !== root;
  } catch (e) {
    framed = true;
  }
  var search = String(root.location && root.location.search);
  var flagged = /[?&]aihub=/.test(search);
  var seedArg = /[?&]aihub-seed=(\d+)/.exec(search);

  var hub = {
    version: VERSION,
    protocol: 1,
    /** True when the hub launched this page for a session (?aihub=1 inside a frame). */
    active: !!(flagged && framed),
    me: null,
    host: null,
    isHost: false,
    players: [],
    mode: null,
    seed: 0,
    limitMs: 0,
    round: 0,
    /** True when the hub shows the round's splash and collects every player's ready: call ready() once loaded, with no prompt. */
    splash: false,
    /** True when the hub seeded Math.random for this round (side by side): every copy draws the same numbers. */
    seeded: false,
  };

  /** A storage that lives and dies with the page: the Storage methods, and items as properties too. */
  function memoryStorage() {
    var data = Object.create(null);
    var api = {
      getItem: function (k) {
        k = String(k);
        return k in data ? data[k] : null;
      },
      setItem: function (k, v) {
        data[String(k)] = String(v);
      },
      removeItem: function (k) {
        delete data[String(k)];
      },
      clear: function () {
        for (var k in data) delete data[k];
      },
      key: function (i) {
        var keys = Object.keys(data);
        return i >= 0 && i < keys.length ? keys[i] : null;
      },
    };
    if (typeof Proxy !== 'function') return api;
    return new Proxy(api, {
      get: function (t, k) {
        if (k === 'length') return Object.keys(data).length;
        if (typeof k === 'symbol' || k in t) return t[k];
        return k in data ? data[k] : undefined;
      },
      set: function (t, k, v) {
        if (typeof k !== 'symbol') data[k] = String(v);
        return true;
      },
      has: function (t, k) {
        return k in data || k in t;
      },
      deleteProperty: function (t, k) {
        delete data[k];
        return true;
      },
      ownKeys: function () {
        return Object.keys(data);
      },
      getOwnPropertyDescriptor: function (t, k) {
        return k in data ? { value: data[k], writable: true, enumerable: true, configurable: true } : undefined;
      },
    });
  }

  /** mulberry32: numbers in [0, 1), the same sequence everywhere for the same 32-bit start. */
  function generator(a) {
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A fair start: in a session the game gets an empty storage of its own, so
  // every round starts as a first launch (no saved unlocks, upgrades or runs),
  // and nothing the round saves touches the player's own saves.
  if (hub.active) {
    for (var s = 0, stores = ['localStorage', 'sessionStorage']; s < stores.length; s++) {
      try {
        Object.defineProperty(root, stores[s], { configurable: true, value: memoryStorage() });
      } catch (e) {
        warn('could not give the game a fresh ' + stores[s]);
      }
    }
  }

  // Side by side: before any of the game's own scripts run, Math.random becomes
  // a generator seeded by the hub, so every copy builds the same start.
  var realRandom = Math.random;
  var seededRandom = null;
  if (hub.active && seedArg) {
    Math.random = seededRandom = generator(Number(seedArg[1]) >>> 0);
    hub.seeded = true;
  }

  // In a session the hub owns fullscreen: a game that asks for it gets the
  // hub's whole page, so the scoreboard and the hub's cards stay on top. The
  // hub says when its page goes in and out, so the game's own toggle and its
  // fullscreenchange listeners work as they always did.
  var fullscreenOn = false;
  if (hub.active && root.Element && root.document) {
    var asks = function (on) {
      return function () {
        post('fullscreen', { on: on });
        return Promise.resolve();
      };
    };
    var proto = root.Element.prototype;
    proto.requestFullscreen = proto.webkitRequestFullscreen = asks(true);
    root.document.exitFullscreen = root.document.webkitExitFullscreen = asks(false);
    var shown = function () {
      return fullscreenOn ? root.document.documentElement || null : null;
    };
    try {
      Object.defineProperty(root.document, 'fullscreenElement', { configurable: true, get: shown });
      Object.defineProperty(root.document, 'webkitFullscreenElement', { configurable: true, get: shown });
    } catch (e) {}
  }

  /**
   * No hub after all: play on, with Math.random the page's own again. The
   * empty storage stays: the game has read it already, and what it writes
   * must never land on the player's real saves.
   */
  function standAlone() {
    hub.active = false;
    if (seededRandom && Math.random === seededRandom) Math.random = realRandom;
    hub.seeded = false;
  }

  var origin = '*';
  var welcomed = false;
  var ended = false;
  var connecting = null;
  var goAt = null;
  var sentReady = false;
  var reported = false;
  var handlers = {};
  var pending = {};
  var tokens = limits.burst;
  var refilled = now();
  var probeFn = null;
  var lastProgress = -Infinity;
  var nextProgress = null;
  var progressTimer = null;

  function now() {
    return root.performance && root.performance.now ? root.performance.now() : Date.now();
  }

  function warn(text) {
    if (root.console) root.console.warn('[AIHub] ' + text);
  }

  function own(o, k) {
    return Object.prototype.hasOwnProperty.call(o, k);
  }

  /** This client's own fields, which no welcome may overwrite. */
  var KEEP = { aihub: 1, type: 1, version: 1, protocol: 1, active: 1, seeded: 1 };

  /** A plain JSON copy, or undefined when it is not JSON. */
  function json(value) {
    try {
      var text = JSON.stringify(value);
      return text === undefined ? undefined : JSON.parse(text);
    } catch (e) {
      return undefined;
    }
  }

  function post(type, fields) {
    var msg = { aihub: 1, type: type };
    for (var key in fields) if (own(fields, key)) msg[key] = fields[key];
    try {
      root.parent.postMessage(msg, origin);
    } catch (e) {
      warn('could not reach the hub: ' + e.message);
    }
  }

  function emit(type, args) {
    var list = handlers[type];
    if (!list || !list.length || pending[type]) {
      (pending[type] = pending[type] || []).push(args);
      return;
    }
    for (var i = 0; i < list.length; i++) {
      try {
        list[i].apply(null, args);
      } catch (e) {
        setTimeout(function () {
          throw e;
        });
      }
    }
  }

  function onMessage(event) {
    if (event.source !== root.parent) return;
    var m = event.data;
    if (!m || m.aihub !== 1 || typeof m.type !== 'string') return;
    if (m.type === 'welcome') {
      if (welcomed) return;
      welcomed = true;
      origin = event.origin && event.origin !== 'null' ? event.origin : '*';
      // Every field the hub sends is kept, so a newer hub can add one without a newer client.
      for (var key in m) {
        if (!own(m, key) || KEEP[key] || typeof hub[key] === 'function') continue;
        hub[key] = m[key];
      }
      hub.players = (m.players || []).slice();
      hub.seed = m.seed >>> 0;
      hub.isHost = m.me === m.host;
      hub.splash = m.splash === true;
      if (m.limits) {
        for (var l in limits) if (own(limits, l) && Number(m.limits[l]) > 0) limits[l] = Number(m.limits[l]);
        tokens = limits.burst;
      }
      if (connecting) connecting.resolve(info());
      return;
    }
    if (m.type === 'fullscreen') {
      fullscreenOn = m.on === true;
      try {
        root.document.dispatchEvent(new root.Event('fullscreenchange'));
      } catch (e) {}
      return;
    }
    if (!welcomed || ended) return;
    if (m.type === 'start') {
      goAt = now() + Number(m.in || 0);
      emit('start', [{ in: Number(m.in || 0) }]);
    } else if (m.type === 'message') {
      emit('message', [m.data, m.from]);
    } else if (m.type === 'leave') {
      hub.players = hub.players.filter(function (p) {
        return p.id !== m.id;
      });
      emit('leave', [{ id: m.id, reason: m.reason }]);
    } else if (m.type === 'time-up') {
      emit('time-up', [{ graceMs: m.graceMs }]);
    } else if (m.type === 'end') {
      ended = true;
      if (progressTimer) clearTimeout(progressTimer);
      emit('end', [{ reason: m.reason, standings: m.standings || null }]);
    } else {
      // An event this client has never heard of: hand it on as it came.
      var detail = {};
      for (var k in m) if (own(m, k) && k !== 'aihub' && k !== 'type') detail[k] = m[k];
      emit(m.type, [detail]);
    }
  }

  function info() {
    var out = {};
    for (var key in hub) if (own(hub, key) && typeof hub[key] !== 'function' && !KEEP[key]) out[key] = hub[key];
    out.players = hub.players.slice();
    return out;
  }

  /** Join the session. Resolves with the round's info, or null when there is no hub: play normally. */
  hub.connect = function (opts) {
    if (connecting) return connecting.promise;
    var done;
    var promise = new Promise(function (resolve) {
      done = resolve;
    });
    connecting = { promise: promise, resolve: done };
    if (!hub.active) {
      done(null);
      return promise;
    }
    opts = opts || {};
    root.addEventListener('message', onMessage);
    var started = now();
    var hello = function () {
      if (welcomed) return;
      if (now() - started > HELLO_TIMEOUT_MS) {
        standAlone();
        warn('no hub answered; playing normally');
        done(null);
        return;
      }
      post('hello', { v: 1, client: VERSION, mode: opts.mode || null, seats: opts.seats || null });
      setTimeout(hello, HELLO_EVERY_MS);
    };
    hello();
    return promise;
  };

  /** Everything is loaded: at once when info.splash, otherwise from the player's ready gesture. */
  hub.ready = function () {
    if (!welcomed || sentReady || ended) return;
    sentReady = true;
    post('ready', {});
  };

  hub.on = function (type, fn) {
    (handlers[type] = handlers[type] || []).push(fn);
    if (pending[type] && !pending[type].flushing) {
      pending[type].flushing = true;
      setTimeout(function () {
        var queued = pending[type];
        delete pending[type];
        for (var i = 0; i < queued.length; i++) emit(type, queued[i]);
      });
    }
    return function () {
      var list = handlers[type] || [];
      var at = list.indexOf(fn);
      if (at !== -1) list.splice(at, 1);
    };
  };

  /** Send JSON data to every other player, or to one with {to: id}. {reliable: false} may drop or reorder. */
  hub.send = function (data, opts) {
    if (!welcomed || ended) return false;
    opts = opts || {};
    var text;
    try {
      text = JSON.stringify(data);
    } catch (e) {
      warn('send: data is not JSON');
      return false;
    }
    if (text === undefined) return false;
    if (text.length > limits.maxBytes) {
      warn('send: message over ' + limits.maxBytes + ' bytes dropped');
      return false;
    }
    var t = now();
    tokens = Math.min(limits.burst, tokens + ((t - refilled) / 1000) * limits.ratePerS);
    refilled = t;
    if (tokens < 1) {
      warn('send: over ' + limits.ratePerS + ' messages a second, dropped');
      return false;
    }
    tokens -= 1;
    var fields = { data: JSON.parse(text), reliable: opts.reliable !== false };
    if (opts.to !== undefined && opts.to !== null) fields.to = opts.to;
    post('send', fields);
    return true;
  };

  /** Milliseconds since the synchronized start: negative during the countdown, -Infinity before start. */
  hub.time = function () {
    return goAt === null ? -Infinity : now() - goAt;
  };

  /** A seeded random number generator (0 ≤ n < 1), the same sequence on every device for the same label. */
  hub.rng = function (label) {
    var h = 2166136261;
    var s = String(label === undefined ? '' : label);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return generator((hub.seed ^ h) >>> 0);
  };

  /** A number the hub can rank: finite, given as a number or as text. Not null, '' or true, which JSON or Number would make 0. */
  function finite(v) {
    return (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && isFinite(v);
  }

  /**
   * The whole outcome as plain JSON, field by field: the hub checks and trims
   * it, so new optional fields need no new client. A field that is not JSON
   * (a cycle, a BigInt) is left out, not the whole outcome.
   */
  function outcomeOf(outcome) {
    if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) {
      warn('the outcome is not a plain object');
      return null;
    }
    var copy = {};
    for (var key in outcome) {
      if (!own(outcome, key)) continue;
      var value = json(outcome[key]);
      if (value !== undefined) copy[key] = value;
      else if (outcome[key] !== undefined) warn('the outcome\'s ' + key + ' is not JSON: left out');
    }
    return copy;
  }

  /** Race and side by side: report your own outcome once, {time: ms} (lower wins) or {score: n} (higher wins), with optional stats and awards. */
  hub.result = function (outcome) {
    if (!welcomed || ended || reported) return;
    var fields = outcomeOf(outcome);
    if (!fields) return;
    var given = outcome || {};
    delete fields.time;
    delete fields.score;
    if (finite(given.time)) fields.time = Number(given.time);
    if (finite(given.score)) fields.score = Number(given.score);
    if (!own(fields, 'time') && !own(fields, 'score')) return warn('result needs a finite time or score');
    reported = true;
    if (progressTimer) clearTimeout(progressTimer);
    post('result', fields);
  };

  /** Versus and co-op: the host reports the standings once, best first, ties grouped: [[2], [0, 3], [1]]. */
  hub.finish = function (outcome) {
    if (!welcomed || ended || reported) return;
    if (!hub.isHost) return warn('finish is for the host only');
    var fields = outcomeOf(outcome);
    if (!fields) return;
    if (!Array.isArray(fields.standings)) return warn('finish needs standings');
    reported = true;
    post('finish', fields);
  };

  function sendProgress() {
    progressTimer = null;
    if (!nextProgress || ended || reported) return;
    lastProgress = now();
    post('progress', nextProgress);
    nextProgress = null;
  }

  /** Your standing during play, for the hub's scoreboard: {score, label}. Call it as often as you like; the hub hears it about once a second. */
  hub.progress = function (p) {
    if (!welcomed || ended || reported || !p || !finite(p.score)) return;
    nextProgress = { score: Number(p.score) };
    if (p.label != null) nextProgress.label = String(p.label).slice(0, 24);
    var wait = lastProgress + PROGRESS_EVERY_MS - now();
    if (wait <= 0) sendProgress();
    else if (!progressTimer) progressTimer = setTimeout(sendProgress, wait);
  };

  /** For the harness, in or out of a session: fn() → { scene, menu, world, input }, read with inspect(). */
  hub.probe = function (fn) {
    probeFn = typeof fn === 'function' ? fn : null;
  };

  hub.inspect = function () {
    if (!probeFn) return null;
    try {
      return JSON.parse(JSON.stringify(probeFn()));
    } catch (e) {
      return { error: String((e && e.message) || e) };
    }
  };

  /** The game cannot run here (no WebGL, failed load): the hub skips it. */
  hub.fail = function (message) {
    if (!hub.active) return;
    post('error', { message: String(message || 'error').slice(0, 500), fatal: true });
  };

  root.AIHub = hub;
})(typeof window !== 'undefined' ? window : globalThis);
```
