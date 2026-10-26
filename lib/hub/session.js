/*! aihub-session 1.0.0 — AI Hub Session Protocol v1 client. Paste it into your game unmodified. */
(function (root) {
  'use strict';
  if (root.AIHub) return;

  var VERSION = '1.0.0';
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

  /** Race mode: report your own outcome once, {time: ms} (lower wins) or {score: n} (higher wins). */
  hub.result = function (outcome) {
    if (!welcomed || ended || reported) return;
    outcome = outcome || {};
    var fields = {};
    if (isFinite(outcome.time)) fields.time = Number(outcome.time);
    else if (isFinite(outcome.score)) fields.score = Number(outcome.score);
    else return warn('result needs a finite time or score');
    reported = true;
    post('result', fields);
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
    post('finish', fields);
  };

  /** The game cannot run here (no WebGL, failed load): the hub skips it. */
  hub.fail = function (message) {
    if (!hub.active) return;
    post('error', { message: String(message || 'error').slice(0, 500), fatal: true });
  };

  root.AIHub = hub;
})(typeof window !== 'undefined' ? window : globalThis);
