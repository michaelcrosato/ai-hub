/**
 * bridge.js — the hub's end of one game frame in a session.
 *
 * A game speaks the AI Hub Session Protocol over postMessage (lib/hub/README.md).
 * The bridge checks every message, enforces the limits, and routes it: control
 * messages (hello, ready, result, finish, error) to whoever coordinates the
 * round (lib/hub/round.js), game traffic straight to the other players. What
 * comes back from the network is checked again before it reaches the game,
 * and anything from another round is dropped, so a slow packet can never land
 * in the next game.
 *
 * The network is anything with `send(toKey, envelope, {reliable})`: the
 * simulated one below (harness, tests), a BroadcastChannel between tabs, or a
 * WebRTC mesh. Envelopes:
 *   {k:'c', r, m}       to the coordinator: a message from this game
 *   {k:'h', r, m}       from the coordinator: welcome, start, leave, time-up, end
 *   {k:'g', r, f, d}    game traffic from player id f
 */

export const LIMITS = Object.freeze({
  maxBytes: 16_384,
  ratePerS: 20,
  burst: 40,
  queueMessages: 64,
  queueBytes: 262_144,
});

const FROM_GAME = new Set(['hello', 'ready', 'send', 'result', 'finish', 'error']);

/**
 * @param {object} o
 * @param {string} o.key              this player's key in the session
 * @param {number} o.round
 * @param {string} o.coordinator      key of whoever runs round.js
 * @param {(msg:object) => void} o.post            to the game frame
 * @param {{send:Function}} o.net
 * @param {{now:()=>number}} [o.clock]             the coordinator's time, as seen here
 * @param {(issue:{key:string, problem:string}) => void} [o.onIssue]
 */
export function createBridge({ key, round, coordinator, post, net, clock = Date, onIssue = () => {} }) {
  let welcomed = false;
  let ended = false;
  let helloSent = false;
  let me = null;
  let keys = [];
  const gone = new Set();
  const queue = [];
  let queuedBytes = 0;
  let tokens = LIMITS.burst;
  let refilled = clock.now();
  const issues = [];
  const stats = { sent: 0, received: 0, bytesSent: 0, dropped: 0 };

  const toGame = (msg) => post({ aihub: 1, ...msg });
  const toHub = (m) => net.send(coordinator, { k: 'c', r: round, m }, { reliable: true });
  const issue = (problem) => {
    const entry = { key, problem };
    issues.push(entry);
    onIssue(entry);
  };

  function fromGame(msg) {
    if (!msg || msg.aihub !== 1) return;
    if (!FROM_GAME.has(msg.type)) return issue(`unknown message type ${JSON.stringify(msg.type)}`);
    if (ended && msg.type !== 'error') return;
    switch (msg.type) {
      case 'hello':
        if (helloSent) return;
        helloSent = true;
        return toHub({ type: 'hello', v: msg.v, client: String(msg.client || ''), mode: msg.mode ?? null, seats: msg.seats ?? null });
      case 'ready':
        if (!welcomed) return issue('ready before welcome');
        return toHub({ type: 'ready' });
      case 'result':
        if (!welcomed) return issue('result before welcome');
        return toHub({ type: 'result', time: msg.time, score: msg.score, stats: msg.stats, awards: msg.awards });
      case 'finish':
        if (!welcomed) return issue('finish before welcome');
        return toHub({ type: 'finish', standings: msg.standings, scores: msg.scores, won: msg.won, stats: msg.stats, awards: msg.awards });
      case 'error':
        return toHub({ type: 'error', message: String(msg.message || '').slice(0, 500), fatal: msg.fatal === true });
      case 'send':
        return sendGame(msg);
    }
  }

  function sendGame(msg) {
    if (!welcomed) return issue('send before welcome');
    let text;
    try {
      text = JSON.stringify(msg.data);
    } catch {
      return issue('send: data is not JSON');
    }
    if (text === undefined) return issue('send: no data');
    if (text.length > LIMITS.maxBytes) {
      stats.dropped++;
      return issue(`send: ${text.length} bytes is over the ${LIMITS.maxBytes}-byte limit`);
    }
    const now = clock.now();
    tokens = Math.min(LIMITS.burst, tokens + ((now - refilled) / 1000) * LIMITS.ratePerS);
    refilled = now;
    if (tokens < 1) {
      stats.dropped++;
      return issue(`send: over ${LIMITS.ratePerS} messages a second`);
    }
    tokens -= 1;
    let targets;
    if (msg.to === undefined || msg.to === null) {
      targets = keys.filter((k, id) => id !== me && !gone.has(id));
    } else {
      if (!Number.isInteger(msg.to) || msg.to < 0 || msg.to >= keys.length || msg.to === me) {
        return issue(`send: no player ${JSON.stringify(msg.to)} to send to`);
      }
      if (gone.has(msg.to)) return;
      targets = [keys[msg.to]];
    }
    const reliable = msg.reliable !== false;
    const envelope = { k: 'g', r: round, f: me, d: JSON.parse(text) };
    for (const target of targets) net.send(target, envelope, { reliable });
    stats.sent++;
    stats.bytesSent += text.length;
  }

  function deliverGame(fromKey, env) {
    if (ended || gone.has(env.f)) return;
    if (keys[env.f] !== fromKey) return issue(`traffic from ${fromKey} claims to be player ${env.f}`);
    stats.received++;
    toGame({ type: 'message', from: env.f, data: env.d });
  }

  function fromNet(fromKey, env) {
    if (!env || env.r !== round) return;
    if (env.k === 'g') {
      if (welcomed) return deliverGame(fromKey, env);
      const size = JSON.stringify(env.d ?? null).length;
      if (queue.length >= LIMITS.queueMessages || queuedBytes + size > LIMITS.queueBytes) {
        stats.dropped++;
        return;
      }
      queue.push([fromKey, env]);
      queuedBytes += size;
      return;
    }
    if (env.k !== 'h' || fromKey !== coordinator || !env.m) return;
    const m = env.m;
    switch (m.type) {
      case 'welcome': {
        if (welcomed) return;
        welcomed = true;
        me = m.me;
        keys = Array.isArray(m.keys) ? m.keys : [];
        const { keys: _keys, round: _round, ...rest } = m;
        toGame({ ...rest, round });
        for (const [k, e] of queue.splice(0)) deliverGame(k, e);
        queuedBytes = 0;
        return;
      }
      case 'start':
        return toGame({ type: 'start', in: Math.round(m.at - clock.now()) });
      case 'leave':
        gone.add(m.id);
        return toGame({ type: 'leave', id: m.id, reason: m.reason });
      case 'time-up':
        return toGame({ type: 'time-up', graceMs: m.graceMs });
      case 'end':
        ended = true;
        return toGame({ type: 'end', reason: m.reason, ...(m.standings ? { standings: m.standings } : {}) });
    }
  }

  return {
    key,
    round,
    fromGame,
    fromNet,
    /** The page holding this frame was hidden or shown: the coordinator watches the host's. */
    visibility(hidden) {
      if (helloSent && !ended) toHub({ type: 'vis', hidden: !!hidden });
    },
    issues,
    stats,
    get me() {
      return me;
    },
    get ended() {
      return ended;
    },
  };
}

/**
 * Wire a bridge to an iframe: only messages from that frame's window count.
 * Returns a function that unhooks it.
 */
export function attachFrame(frame, onMessage) {
  const listener = (event) => {
    if (event.source !== frame.contentWindow) return;
    if (!event.data || event.data.aihub !== 1) return;
    onMessage(event.data);
  };
  addEventListener('message', listener);
  return () => removeEventListener('message', listener);
}

/** Post to a frame. The games may be served from anywhere, and nothing here is secret. */
export const postTo = (frame) => (msg) => frame.contentWindow?.postMessage(msg, '*');

/**
 * A simulated network for the harness and tests: one-way latency with jitter,
 * and loss for unreliable messages. Reliable messages stay in order per pair,
 * as a WebRTC ordered channel would keep them.
 */
export function createLocalNetwork({ latency = 0, jitter = 0, loss = 0, random = Math.random, clock = globalThis } = {}) {
  const endpoints = new Map();
  const pairs = new Map(); // "from\0to" -> reliable messages waiting, in send order
  const now = () => (clock.performance?.now ? clock.performance.now() : Date.now());
  const settings = { latency, jitter, loss };

  const deliver = (from, to, target, copy) => {
    if (endpoints.get(to) === target) for (const fn of target.listeners) fn(from, copy);
  };

  /** Reliable traffic leaves each pair's queue strictly in order, never before its time. */
  function drain(pair) {
    const q = pairs.get(pair);
    q.timer = null;
    while (q.items.length && q.items[0].at <= now() + 0.5) {
      const { from, to, target, copy } = q.items.shift();
      deliver(from, to, target, copy);
    }
    if (q.items.length) q.timer = clock.setTimeout(() => drain(pair), Math.max(1, Math.ceil(q.items[0].at - now())));
  }

  function endpoint(key) {
    const listeners = new Set();
    const self = {
      key,
      send(to, env, { reliable = true } = {}) {
        const target = endpoints.get(to);
        if (!target || !endpoints.has(key)) return;
        if (!reliable && random() < settings.loss) return;
        const copy = JSON.parse(JSON.stringify(env));
        const delay = to === key ? 0 : Math.max(0, settings.latency + (random() * 2 - 1) * settings.jitter);
        if (!reliable) {
          clock.setTimeout(() => deliver(key, to, target, copy), delay);
          return;
        }
        const pair = `${key}\u0000${to}`;
        if (!pairs.has(pair)) pairs.set(pair, { items: [], timer: null });
        const q = pairs.get(pair);
        const last = q.items.at(-1)?.at ?? 0;
        q.items.push({ at: Math.max(now() + delay, last), from: key, to, target, copy });
        if (!q.timer) q.timer = clock.setTimeout(() => drain(pair), Math.ceil(delay));
      },
      onMessage(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      close() {
        endpoints.delete(key);
      },
      listeners,
    };
    endpoints.set(key, self);
    return self;
  }

  return { endpoint, settings };
}
