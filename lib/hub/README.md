# AI Hub Session Protocol v1

How a browser game joins an **AI Hub session**: up to four friends, each on
their own device, playing one round of your game together while the hub picks
the games, keeps time and keeps score. This file is everything a game needs.
Give it to the agent building the game.

- Spec: `https://crosato-arcade.vercel.app/lib/hub/README.md` (this file)
- Client: `https://crosato-arcade.vercel.app/lib/hub/session.js` (also in Appendix C)
- Test harness: `https://crosato-arcade.vercel.app/lib/hub/harness.html`
- Examples: `lib/hub/examples/arena.html` (versus) and `lib/hub/examples/race.html` (race with ghosts)

The hub owns the session: the lobby, the invite, the network, the clock, the
roster and the scoreboard. A game only plays one round and reports how it went.
It never opens a connection of its own in a session, and it never offers its
players a way to talk to each other.

---

## The checklist

Every new game must:

1. **Declare it** in `<head>` with the `hub:session` metas, including how to
   win and the controls in a line each (§2).
2. **Paste in `session.js` unmodified** (§3). It defines `window.AIHub`.
3. **Play normally on its own.** Only a page opened by the hub (`?aihub=1`
   in a frame) is in session mode. Outside a session the game is exactly what
   it would be without this protocol, including any multiplayer of its own.
4. **In session mode, skip the title screen, menus, in-game lobbies and room
   codes**, call `AIHub.connect()`, and build the match from its `players` (§4–5).
5. **Load fast, then ready up with a gesture**: the hub loads you under the
   last round's results, so show the ready prompt within a few seconds; ask for
   any key, button, click or tap, and call `AIHub.ready()` from that input
   handler (§6).
6. **Start on the shared clock**: play begins when `AIHub.time() >= 0` (§7).
7. **Network only through the hub**: `AIHub.send()` and the `message` event,
   JSON only, at most 16 KB a message and 20 messages a second (§8).
8. **Put everyone in one world**: the host runs a shared world (versus, co-op),
   or every copy drives its own player on one shared course where the others
   are solid rivals you can bump into (race). Smoothness comes first: each copy
   owns its own player, so its controls never wait for the network (§9).
9. **Report once, with the highlights**: a racer calls `AIHub.result()` for
   itself; the host of a shared world calls `AIHub.finish()` with the
   standings; both may add stats and awards; on `time-up`, within 5 seconds
   (§10).
10. **Handle a player leaving at any moment** (§11).
11. **On `end`, stop sending and go quiet.** No replay loop, no menu (§10).
12. **Never pause the shared game**: not for a menu, a lost focus or a hidden
    tab. Advance by elapsed time (§12).
13. **No communication between players** of any kind: no chat, voice, emotes,
    text pings, drawings or custom names. Show only the names the hub gives,
    as text (§12).
14. **No interruptions**: no `alert`, `confirm`, `prompt`, popups, new tabs or
    navigation, and no saved unlocks or upgrades that carry into a round (§12).
15. **Work with 2, 3 and 4 players**, one per device, and with 1 when the game
    has rivals or a clock to beat; keyboard and gamepad, and touch where the
    game allows it; rounds of about 2–8 minutes; ready within 20 seconds on
    broadband (§12).
16. **Pass the harness** at 2, 3 and 4 players on a bad network, with a player
    leaving and a time-up, and with the host leaving (§14).

To ask an agent for it, add this to the game's prompt:

> This game must support AI Hub sessions (online play for 1–4 players). Follow
> https://crosato-arcade.vercel.app/lib/hub/README.md (AI Hub Session Protocol
> v1): add the hub:session meta tags, paste session.js in unmodified, implement
> hub mode (connect → ready → start → play → result/finish → end) with the mode
> you choose (versus or co-op in a host-run world, or race on a shared course
> with solid rivals), report stats and awards, and test it in harness.html with
> 1, 2, 3 and 4 players. The game must still play normally on its own.

§15 sets out what the hub does around a round (scoring, awards, the session's
formats, the transitions), so a game can fit in.

---

## 1. How a round goes

```
hub                                   your game (one copy per player)
───                                   ───────────────────────────────
loads the game with ?aihub=1  ──────▶ AIHub.connect()         says hello
welcome: me, host, players, seed ───▶ build the match, load everything
                                      "Press any key when ready"
                              ◀────── AIHub.ready()           (from the key press)
everyone ready (or 45 s gone)
start: in 3 s                 ──────▶ countdown; play when AIHub.time() >= 0
                                      AIHub.send() ⇄ 'message' between copies
                              ◀────── leave: a player is gone (any time)
time-up (at the round's limit) ─────▶ report now
                              ◀────── AIHub.result()  (race: every copy, about itself)
                              ◀────── AIHub.finish()  (versus, co-op: the host's copy)
end: finished + standings     ──────▶ stop sending, go quiet
results screen, next game
```

One frame is one round. The next round, even of the same game, is a fresh page.

## 2. Declaring support

```html
<meta name="hub:session" content="1">             <!-- this protocol, version 1 -->
<meta name="hub:session-players" content="1-4">   <!-- seats in a session; must cover 2, 3 and 4 -->
<meta name="hub:session-mode" content="race">     <!-- versus | co-op | race -->
<meta name="hub:session-minutes" content="4">     <!-- a typical round, in minutes -->
<meta name="hub:session-goal" content="First over the line after 3 laps">   <!-- how to win, ≤ 60 characters -->
<meta name="hub:session-howto" content="Steer ← →, gas ↑, brake ↓, item Space"> <!-- the controls, ≤ 80 characters -->
```

- `hub:session-mode` is the main way the game plays in a session. `versus` and
  `co-op` run one shared world on the host's copy; `race` gives every copy its
  own player on a shared course. Teams are versus with tied places (§10).
- `hub:session-players` starts at 1 when one player still gets a real game:
  computer rivals, or a clock or score to beat. It must cover 2, 3 and 4.
- `hub:session-goal` and `hub:session-howto` are shown on the card that
  introduces your game between rounds, while it loads underneath (§15). Write
  them for someone who has never seen the game: what wins, and which keys do
  what. Plain text.
- `hub:session-minutes` sets the round's hard limit: one and a half times it,
  and never more than 15 minutes. At the limit the hub calls time.
- `hub:players` keeps its old meaning, the seats when the game is played on its
  own. Don't change it to describe sessions.

The hub only picks games that carry `hub:session` for its Random Mode.

## 3. The client

Paste `session.js` into the page, unmodified, in a classic `<script>` near the
top of `<head>`, before any script that uses it:

```html
<script>
/*! aihub-session 1.1.0 — AI Hub Session Protocol v1 client. Paste it into your game unmodified. */
(function (root) { … })(…);
</script>
```

Take it from Appendix C or from `/lib/hub/session.js`. Pasting it keeps a
single-file game whole: it still runs from a file, from another site, or from
the hub. A project folder may instead ship it as its own file and load it with a
relative path. Never load it from the hub's URL, and never edit it: the banner
names its version and the hub checks it.

It has no dependencies, sets one global, `AIHub`, and does nothing at all
unless the page is in session mode.

## 4. Session mode or not

```js
const info = await AIHub.connect({ mode: 'versus', seats: [2, 4] });
if (!info) {
  startNormally();   // no hub: the game as it always was
} else {
  startSession(info);
}
```

- `AIHub.active` is true from the first line of the page when the hub opened it
  (`?aihub=1` inside a frame), so a game can skip its title screen before
  anything draws.
- `connect()` says hello to the hub and resolves with the round once the hub
  answers. If no hub answers within 10 seconds, it resolves `null`, `active`
  turns false, and the game should simply play as normal.
- Pass the same `mode` and `seats` as the metas; the harness checks they agree.

In session mode, go straight to the match: no title screen, no main menu, no
mode select, no in-game lobby, no room code, no "invite a friend", no settings
that change the rules. The hub already chose the game, the players and the
rules. Local settings that change only this device (volume, quality, controls)
may stay, in a menu that does not pause anything (§12).

## 5. Players, names, colours and the seed

`info` (also on `AIHub`):

| Field | |
|---|---|
| `me` | your player id |
| `host` | the id of the copy that runs a shared world |
| `isHost` | `me === host` |
| `players` | `[{ id, name, color }]`, ids `0..N-1` in seat order |
| `mode` | `versus`, `co-op` or `race` |
| `seed` | an unsigned 32-bit number, the same for every copy |
| `limitMs` | the round's hard limit after the start |
| `round` | the round number in the session |

- **Ids** are small integers, `0` to `N-1`, the same on every copy. Index arrays
  by them; spawn points and starting order follow them.
- **Names** are the hub's generated nicknames ("Teal Otter"): letters and
  spaces, at most 16 characters. Show them as text: draw them on a canvas or
  set `textContent`. Never put them into HTML.
- **Colours** follow the seat: red, blue, green, yellow (`#e8443a`,
  `#3b82f6`, `#22c55e`, `#f5b700`). Tint each player with theirs, so the
  scoreboard and the game agree on who is who.
- **The seed** is for building the same content on every copy: levels,
  courses, spawn tables. `AIHub.rng(label)` gives a generator (numbers in
  `[0, 1)`) seeded from it, a separate stream per label, so `rng('course')`
  and `rng('items')` never disturb each other. Build content from integers it
  gives you; never assume two devices run the same physics or floating-point
  maths to the same result.

## 6. Ready

When the game has loaded everything, show the roster and one line: *Press any
key, click or tap when you are ready*. Call `AIHub.ready()` from that input's
handler, and in the same handler create or resume your `AudioContext`.

The gesture is required, not decoration. Safari only unlocks audio for a page
that the player touched, gamepads stay invisible until a button is pressed,
and the frame needs focus for the keyboard. Accept any key, any gamepad button,
a click and a tap.

Everyone has 45 seconds from the start of the round. A player who isn't ready
sits the round out: their game receives `end` with reason `sat-out`, and the
others receive `leave`.

**Load fast.** The hub opens your page while the last round's results are still
on screen, and lifts them about eight seconds later: whatever loads in that
time costs nobody anything. Show the ready prompt as soon as the match can
start, and fetch anything that can wait (music, distant scenery, later levels)
after it. A party game lives on its pace: nobody should look at a loading bar.

## 7. Start and the shared clock

`start` arrives when everyone is ready; play begins three seconds later.

```js
AIHub.on('start', () => (phase = 'countdown'));
// every frame:
const t = AIHub.time();          // ms since the start: negative during the countdown
if (t < 0) drawCountdown(Math.ceil(-t / 1000));
else play();
```

`AIHub.time()` is the same timeline on every device, give or take about 15 ms.
Stamp anything you compare across players with it: ghost samples, finishing
times, the moment something happened. Before `start` it is `-Infinity`. No
player input counts before 0.

## 8. Sending and receiving

```js
AIHub.send({ t: 'in', x: 1, y: 0 }, { to: AIHub.host, reliable: false }); // to one player
AIHub.send({ t: 'pick', star: 7 });                                        // to everyone else
AIHub.on('message', (data, from) => { … });                                // from is a player id
```

- **JSON only**: plain objects, arrays, strings, numbers, booleans. At most
  **16 KB** a message once serialized.
- **At most 20 messages a second** per player, with bursts up to 40. Bundle state
  into one snapshot rather than sending one message per object. Over the limit,
  messages are dropped and the console says so.
- **Reliable** (the default) messages arrive in the order each sender sent them.
  `reliable: false` messages may be lost or arrive out of order. Use them for
  state that is resent anyway, like positions at 10–20 Hz.
- **Latency is 30–250 ms** each way and varies. Never wait for a message to
  take a step (no lockstep). Interpolate other players, and predict your own.
- You never receive your own messages. Messages may be sent from the welcome
  until the end. Anything sent before another copy has loaded is queued for it.
- Nothing else goes over the network in a session: no WebSocket, WebRTC,
  `fetch` to a game server, or public broker. Loading your own assets is fine.

## 9. Playing together

Everyone plays in one world: the same pitch, the same track, the same park,
and they can touch. What decides the design is how it feels, not cheating:
sessions are friends who invited each other, so a copy may be trusted with
its own player. The rule that makes it smooth is **own your player**: every
copy moves its own player the moment its input happens and never waits for
the network to do so. What differs is who runs everything else.

### Versus and co-op: the host runs the world

The host's copy (`AIHub.isHost`) runs the one true simulation of everything
shared: the ball, computer players, enemies, pickups, the score, the mission,
the clock of the match.

- Every other copy moves **its own player** locally and sends its state to the
  host 15–20 times a second, `reliable: false`, small:
  `{ t: 'me', at: AIHub.time(), x, y, vx, vy, facing, action }`. Actions that
  touch shared things (a kick, a shot, a door) are part of it, or a reliable
  event when they must not be lost.
- The host takes those players where they say they are, steps the world, and
  sends a **snapshot** 10–20 times a second, `reliable: false`: every player,
  every moving shared thing, the score, in one message.
- One-off **events** that must not be lost (a goal, a knockout, a mission step,
  the match ending) go `reliable: true`.
- The other copies draw everything but their own player from the snapshots,
  about 100 ms behind, interpolated (below). Their own player is drawn from
  their own simulation; if the host has to overrule it (a tackle, a spawn), it
  says so with an event and the copy blends to it over a few frames.
- Where a shared thing is about to be touched by a non-host player (a ball at
  their feet), let that copy predict the contact and send it; the host accepts
  it unless someone else got there first. Players feel their own touch, not the
  round trip.
- When the match is decided, the host calls `finish()` (§10) and sends a last
  reliable event so the others show the result at once.

`examples/arena.html` is the plain form of this pattern in about 250 lines.

### Race: a shared course with solid rivals

Every copy builds the same course from the seed and simulates only its own
player, so nobody's controls ever wait. The others are real rivals on that
course, solid and in their colours, and you can bump into them.

- Each copy sends its **state** 15–20 times a second, `reliable: false`:
  `{ t: 'p', at: AIHub.time(), x, y, z, vx, vy, vz, yaw, … }`, with whatever
  else draws it (lean, wheel spin, an animation, a held item) and its progress
  along the course.
- Draw the others **interpolated** about 100 ms behind their latest samples;
  extrapolate from the last velocity for at most about 200 ms when samples are
  late, then hold.
- **Contact**: each copy resolves collisions for its own player only, against
  the others' bodies predicted to *now* (last sample plus velocity × age).
  Push your own player out and trade velocity as if the other had your mass;
  both copies do the same, so the bump is mutual. Never move another player's
  body yourself.
- **The victim decides.** Anything that hits another player (a thrown item, a
  shove, a tackle, a spin-out) is a reliable event to that player's copy:
  `{ t: 'hit', kind, at }`. Their copy applies it to its own player and tells
  everyone what happened. The thrower's copy draws its projectile until the
  victim confirms or it misses.
- **Shared pickups** (item boxes, coins, boosts) exist on every copy, built
  from the seed. Taking one sends a reliable `{ t: 'take', id, at }`; everyone
  removes it. If two players take the same one, the earlier `at` keeps it (then
  the lower id) and the other copy quietly undoes its pickup. Respawns follow
  the clock: `at + delay` everywhere.
- **Scripted enemies** (waves in a shooter, a train on a timetable) run on
  every copy from the seed and `AIHub.time()`. A kill is a claim like a pickup.
- **Computer rivals** are run by the lowest id still in the round and sent like
  a player; when that player leaves, the next lowest carries on from the last
  state it saw.
- When a player finishes, their copy calls `AIHub.result({ time: AIHub.time() })`
  and sends a reliable `{ t: 'done' }` so the others can show it.
- On `time-up`, every copy that has not finished reports its progress:
  `AIHub.result({ score: distance })`. A score game (tricks, kills) reports
  its score whenever its run is over.

Race order is decided by the hub: finishers by time, then the rest by score,
then anyone who reported nothing. A race survives its host leaving, because
nothing in it belongs to the host. `examples/race.html` is the plain form of
this pattern; its rivals are ghosts, which is right only where contact makes
no sense.

### Interpolating, in short

Keep each remote body's samples, stamped with the sender's `AIHub.time()`.
Draw it at `AIHub.time() - 100`: find the two samples around that moment and
blend between them (positions linearly, angles the short way round). The
clock is shared, so no copy has to guess another's delay. Snap instead of
blending after a teleport (a respawn, a reset), which the sender marks.

## 10. Ending a round

**Race**: every copy calls `AIHub.result({ time })` (milliseconds, lower is
better) or `AIHub.result({ score })` (higher is better), once, about itself.

**Versus and co-op**: only the host calls

```js
AIHub.finish({
  standings: [[2], [0, 3], [1]],    // best first; ties share a group
  scores: { 0: 1200, 1: 300, 2: 2500, 3: 1200 },   // optional, shown on the scoreboard
  won: true,                         // co-op only: did the team win?
});
```

- `standings` lists every player still in the round exactly once. Players who
  left may be placed or left out; the hub puts anyone left out last.
- Teams are tied groups: `[[0, 2], [1, 3]]`.
- A co-op game may rank players by contribution, or put everyone in one group.

**Stats and awards** (optional, both modes) are the highlights the hub shows
on the results and keeps for the session (§15):

```js
// race: about yourself
AIHub.result({
  time: 95230,
  stats: { laps: 3, 'best lap': '30.11 s', bumps: 7 },
  awards: [{ title: 'Fastest lap', detail: '30.11 s' }],
});
// versus, co-op: the host, for everyone
AIHub.finish({
  standings: [[0, 2], [1, 3]],
  stats: { 0: { goals: 3, saves: 1 }, 1: { goals: 1 } },
  awards: [{ id: 0, title: 'Hat-trick', detail: '3 goals' }],
});
```

- `stats`: up to 6 per player, the numbers someone would ask about afterwards.
  Names are plain text up to 16 characters; values are finite numbers or text
  up to 16 characters (format times yourself: `'30.11 s'`).
- `awards`: up to 3 per player per round, `title` up to 24 characters and an
  optional `detail` up to 40. An award is a moment worth a cheer: fastest lap,
  hat-trick, biggest combo, untouchable, last-gasp winner, most knockouts.
  Give them for doing something, never for coming last.
- Anything over these limits is cut by the hub. They change nothing about the
  standings: places and points come only from `standings`, `time` and `score`.

**time-up**: at the round's limit, or when the session host ends the round,
every copy receives `time-up`. The game then has 5 seconds to report: the host
finishes with the standings as they are, racers report their score. A versus
or co-op round with no `finish` by then is void: nobody scores.

**end**: the last message of a round.

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

After `end`, stop sending, fade the audio and show the final state. Don't offer
"play again" or a menu: the hub shows the scoreboard over the frame and then
removes it.

The scoreboard gives each player one point for every player they beat. Players
who left count as beaten, and tied players share a place. A first place is a
win; in co-op it counts only when `won` is true.

## 11. Leaving and failing

```js
AIHub.on('leave', ({ id, reason }) => removePlayer(id));
```

A player can leave at any time, before or after the start: they closed the
tab, lost their connection (`disconnected`), weren't ready (`not-ready`), or
were removed (`kicked`). It is final for the round. Remove or freeze their
player and carry on.

- In **versus**, when only one player is left, the host finishes at once.
- If the **host** of a versus or co-op round leaves, isn't ready, or has its
  tab hidden for more than 20 seconds, the round is void. The other copies get
  `end` with `host-left` or `void`.
- If the game cannot run at all here (no WebGL, a failed load), call
  `AIHub.fail('why')`. From the host of a shared world it voids the round;
  from anyone else it counts as leaving.

## 12. Rules

- **No communication between players.** No text chat, voice, emotes, stickers,
  quick-chat, pings carrying text, drawings shown to others, or custom names,
  in a session or out of it. Players talk in an app of their own choosing; the
  game only carries gameplay. Names come from the hub and are shown as text.
- **Never pause the shared game.** A local menu opens over a running game. A
  hidden tab or lost focus only makes the local player idle. Advance by elapsed
  time, cap the catch-up after a stall (a few steps at most), and have
  non-host copies snap to the host's next snapshot.
- **No interruptions.** No `alert`, `confirm` or `prompt`; no `window.open`,
  new tabs or navigating the page away; pointer lock and fullscreen only from a
  player's gesture.
- **A fair start.** Nothing saved on the device changes a session round:
  no unlocks, upgrades, levels or handicaps carried over. Settings that change
  only how it looks, sounds or is controlled may be kept.
- **Player counts.** Work with 2, 3 and 4 players. One player is optional
  (against the clock or computer rivals) and the harness allows it; declare it
  with `hub:session-players` `1-4`.
- **One player per device**, on the device's usual controls: keyboard and mouse,
  gamepad, and touch where the game allows it.
- **Bounded and light.** Aim for rounds of 2–8 minutes. Everyone waits for the
  slowest loader, so be ready within 20 seconds on broadband and keep the page
  under about 25 MB.
- **Normal mode is untouched.** Everything above applies only in session mode.

## 13. Games with multiplayer of their own

A game may keep its own multiplayer, started from its own menu, outside
sessions. The hub's is then usually the same netcode on a different pipe.
Write the netcode once against a small interface, and give it two adapters:

```js
// what the netcode uses
// { me, isHost, players, send(data, {to, reliable}), onMessage(fn), onLeave(fn) }

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
used, and its chat (if it has any) must not exist in either mode.

## 14. Testing with the harness

`harness.html` plays the hub: it loads your game 1–4 times side by side on a
simulated network. Copy `harness.html`, `bridge.js` and `round.js` from
`/lib/hub/` into a folder served next to your game (any static server, for
example `npx serve` or `python3 -m http.server`), then open

```
harness.html?game=mygame.html&players=4&latency=150&jitter=50&loss=5
```

- Click a player's frame to control that player.
- **New round**, **Time up**, **Remove player** and **Hide host tab** walk
  through the cases in §10–11. The log shows every protocol message, and each
  frame's bar shows its state and messages sent and received.
- `&limit=20` shortens the round's limit to 20 seconds; `&seed=7` fixes the seed.

**Conformance run:** add `&auto=1`. The harness presses keys and taps inside
each frame (the game must be served from the same origin), plays for a few
seconds with random input, removes a player when there are three or more,
calls time, and checks:

- the head metas, and that hello agrees with them;
- every copy says hello, and readies on a key press or a tap;
- game traffic flows both ways;
- the round ends with a valid result, and every copy is told;
- no protocol problems (oversized or too many messages, bad standings);
- no errors, dialogs, popups or sockets.

`&scenario=host-leave` removes the host instead. The results are in
`window.__hubCheck` (`{ done, pass, checks: [{ name, pass, detail }] }`), and
`document.body.dataset.complete` becomes `"true"` when it finishes, for a
headless browser to wait on. A game is ready when the run passes at 2, 3 and 4
players with `latency=150&jitter=50&loss=5`, and with `scenario=host-leave`.

In the AI Hub repository, `node scripts/hub-check.mjs <game path>` runs all of
these with Playwright, and also catches dialogs or sockets opened before the
page finished loading.

## 15. Around a round: what the hub does

A game only plays its round. Everything around it belongs to the hub, and is
the same for every game, so players learn it once.

### Points and wins

- Each round, a player scores **one point for every player they beat**. Players
  who left or sat out count as beaten; tied players share a place. Every round
  of four is worth three points to its winner, whatever the game.
- **First place is a win**; in co-op only when the team won (`won: true`).
- The **table** orders players by points, then wins, then the better average
  place.

### Awards

- **Game awards** come from your `result()` or `finish()` (§10). The hub shows
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

### Between rounds

Fast is the point. From one round's last whistle to the next round's
countdown takes about ten seconds, plus however long the slowest player takes
to press a key:

1. **Results**, the moment a round ends, over the game: places, points, your
   stats and awards, and the table moving (about 5 seconds).
2. **Next up**: a quick spin through the deck lands on the next game and shows
   its name, its mode, `hub:session-goal` and `hub:session-howto` (about 3
   seconds). The next game has been loading underneath since the results
   appeared.
3. **Ready**: the card lifts on your ready prompt; everyone presses a key, and
   the 3-2-1 begins.

The host can jump ahead (**Next game now**), skip a game, or end the session.
At the end, a final screen crowns the winner with the session awards and the
round-by-round story.

### What is kept

Every played round is recorded: the game, its mode, and each player's place,
points, win, stats and awards. A signed-in player keeps that history across
sessions; a guest's goes with the guest after 30 days unused.

## 16. Games on the shared 3D kit

In session mode the kit (`lib/kit/`) keeps running while its settings menu is
open, and `kit.pause(true)` is ignored with a warning. Don't rely on pausing.

## 17. Versions

This is protocol **1**, client **1.1.0**. Client 1.1.0 added `stats` and
`awards` to `result()` and `finish()`; games on 1.0.0 keep working and simply
report none. Changes within version 1 only add:
new optional fields and events that older games can ignore. A change that
would break a game becomes protocol 2, with its own `hub:session` value, and
the hub keeps running version 1 games.

---

## Appendix A. API

| | |
|---|---|
| `AIHub.active` | `true` in session mode |
| `AIHub.connect({ mode, seats })` | → `Promise<info \| null>`; `null` means play normally |
| `AIHub.me`, `.host`, `.isHost`, `.players`, `.mode`, `.seed`, `.limitMs`, `.round` | the round, after `connect()` |
| `AIHub.ready()` | from the ready gesture's handler; once |
| `AIHub.on(event, fn)` | returns a function that removes the handler |
| `AIHub.send(data, { to, reliable })` | `to` a player id, or everyone else when omitted; `reliable` defaults to `true`; returns `false` when dropped |
| `AIHub.time()` | ms since the start; negative during the countdown; `-Infinity` before `start` |
| `AIHub.rng(label)` | a seeded generator of numbers in `[0, 1)` |
| `AIHub.result({ time \| score, stats?, awards? })` | race; once, about yourself |
| `AIHub.finish({ standings, scores?, won?, stats?, awards? })` | versus, co-op; the host only; once |
| `AIHub.fail(message)` | the game cannot run here |

| Event | Arguments |
|---|---|
| `start` | `{ in }`: milliseconds until play begins |
| `message` | `data, from` |
| `leave` | `{ id, reason }`: `left`, `disconnected`, `not-ready` or `kicked` |
| `time-up` | `{ graceMs }`: report within this long |
| `end` | `{ reason, standings }` |

Events that arrive before a handler is attached are kept and delivered, in
order, when the first one is.

## Appendix B. The messages on the wire

For hub implementers; games use the client. Every message is posted between
the game's frame and the page holding it, as `{ aihub: 1, type, … }`.

| From | type | Fields | Rule |
|---|---|---|---|
| game | `hello` | `v: 1, client, mode, seats` | every 500 ms until welcomed; after 10 s the game plays alone |
| hub | `welcome` | `me, host, players, mode, seed, limitMs, round` | once |
| game | `ready` | | once, within 45 s of the round's start |
| hub | `start` | `in` | milliseconds until play begins |
| game | `send` | `data, to?, reliable` | after welcome, until end; ≤ 16 KB; ≤ 20/s, bursts of 40 |
| hub | `message` | `from, data` | |
| hub | `leave` | `id, reason` | final for the round |
| game | `result` | `time` or `score`, `stats?`, `awards?` | race; once |
| game | `finish` | `standings, scores?, won?, stats?, awards?` | versus, co-op; the host; once |
| hub | `time-up` | `graceMs` | at the limit: 1.5 × `hub:session-minutes`, at most 15 minutes |
| hub | `end` | `reason, standings?` | last |
| game | `error` | `message, fatal` | `AIHub.fail()` |

The hub accepts a message only from its own frame's window. The client answers
only its parent, and after the welcome posts only to the welcome's origin.

## Appendix C. session.js

```js
/*! aihub-session 1.1.0 — AI Hub Session Protocol v1 client. Paste it into your game unmodified. */
(function (root) {
  'use strict';
  if (root.AIHub) return;

  var VERSION = '1.1.0';
  var HELLO_EVERY_MS = 500;
  var HELLO_TIMEOUT_MS = 10000;
  var MAX_BYTES = 16384;
  var RATE_PER_S = 20;
  var BURST = 40;

  var framed = false;
  try {
    framed = root.parent && root.parent !== root;
  } catch (e) {
    framed = true;
  }
  var flagged = /[?&]aihub=/.test(String(root.location && root.location.search));

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
  };

  var origin = '*';
  var welcomed = false;
  var ended = false;
  var connecting = null;
  var goAt = null;
  var sentReady = false;
  var reported = false;
  var handlers = {};
  var pending = {};
  var tokens = BURST;
  var refilled = now();

  function now() {
    return root.performance && root.performance.now ? root.performance.now() : Date.now();
  }

  function warn(text) {
    if (root.console) root.console.warn('[AIHub] ' + text);
  }

  function post(type, fields) {
    var msg = { aihub: 1, type: type };
    for (var key in fields) if (Object.prototype.hasOwnProperty.call(fields, key)) msg[key] = fields[key];
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
      hub.me = m.me;
      hub.host = m.host;
      hub.isHost = m.me === m.host;
      hub.players = (m.players || []).slice();
      hub.mode = m.mode;
      hub.seed = m.seed >>> 0;
      hub.limitMs = m.limitMs;
      hub.round = m.round;
      if (connecting) connecting.resolve(info());
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
      emit('end', [{ reason: m.reason, standings: m.standings || null }]);
    }
  }

  function info() {
    return {
      me: hub.me,
      host: hub.host,
      isHost: hub.isHost,
      players: hub.players.slice(),
      mode: hub.mode,
      seed: hub.seed,
      limitMs: hub.limitMs,
      round: hub.round,
    };
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
        hub.active = false;
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

  /** Everything is loaded and the player pressed something: call from that input handler. */
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
    if (text.length > MAX_BYTES) {
      warn('send: message over ' + MAX_BYTES + ' bytes dropped');
      return false;
    }
    var t = now();
    tokens = Math.min(BURST, tokens + ((t - refilled) / 1000) * RATE_PER_S);
    refilled = t;
    if (tokens < 1) {
      warn('send: over ' + RATE_PER_S + ' messages a second, dropped');
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
    var a = (hub.seed ^ h) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** Copy the optional highlights (stats, awards) as plain JSON; the hub checks and trims them. */
  function highlights(outcome, fields) {
    for (var i = 0, keys = ['stats', 'awards']; i < keys.length; i++) {
      if (outcome[keys[i]] == null) continue;
      try {
        fields[keys[i]] = JSON.parse(JSON.stringify(outcome[keys[i]]));
      } catch (e) {
        warn(keys[i] + ' is not JSON, left out');
      }
    }
    return fields;
  }

  /** Race mode: report your own outcome once, {time: ms} (lower wins) or {score: n} (higher wins), with optional stats and awards. */
  hub.result = function (outcome) {
    if (!welcomed || ended || reported) return;
    outcome = outcome || {};
    var fields = {};
    if (isFinite(outcome.time)) fields.time = Number(outcome.time);
    else if (isFinite(outcome.score)) fields.score = Number(outcome.score);
    else return warn('result needs a finite time or score');
    reported = true;
    post('result', highlights(outcome, fields));
  };

  /** Versus and co-op: the host reports the standings once, best first, ties grouped: [[2], [0, 3], [1]]. */
  hub.finish = function (outcome) {
    if (!welcomed || ended || reported) return;
    if (!hub.isHost) return warn('finish is for the host only');
    outcome = outcome || {};
    if (!Array.isArray(outcome.standings)) return warn('finish needs standings');
    reported = true;
    var fields = { standings: outcome.standings };
    if (outcome.scores) fields.scores = outcome.scores;
    if (typeof outcome.won === 'boolean') fields.won = outcome.won;
    post('finish', highlights(outcome, fields));
  };

  /** The game cannot run here (no WebGL, failed load): the hub skips it. */
  hub.fail = function (message) {
    if (!hub.active) return;
    post('error', { message: String(message || 'error').slice(0, 500), fatal: true });
  };

  root.AIHub = hub;
})(typeof window !== 'undefined' ? window : globalThis);
```
