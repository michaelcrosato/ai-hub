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
