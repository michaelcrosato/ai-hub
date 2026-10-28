/**
 * session/net.js — a session across devices, with the same shape as
 * session/local.js: who is here, and envelopes to one member or all.
 *
 * Presence, round control and WebRTC signalling go over a relay: the
 * session's private Supabase Realtime channel (supabaseRelay below), or a
 * test relay in the browser tests. Game traffic ({k:'g'}) and clock requests
 * ({k:'t'}) go straight between browsers over the mesh (session/mesh.js), so
 * a busy game costs Realtime nothing.
 */

import { createMesh } from './mesh.js';
import { createClock } from './clock.js';

const ASK_TIMEOUT_MS = 2_000;

/**
 * @param relay  { track(meta), onPresence(fn(list)), send(event, payload), on(event, fn), close() }
 */
export function createRelayNet({ key, relay, iceServers = [], relayOnly = false }) {
  let me = { key, slot: null, name: null, joinedAt: Date.now(), status: 'joining' };
  let others = [];
  const memberFns = new Set();
  const messageFns = new Set();
  const asks = new Map();
  let asked = 0;
  let closed = false;

  const emit = (from, env) => messageFns.forEach((fn) => fn(from, env));
  const changed = () => memberFns.forEach((fn) => fn(members()));
  const members = () => [me, ...others];

  const mesh = createMesh({
    me: key,
    iceServers,
    relayOnly,
    signal: (to, data) => relay.send('rtc', { from: key, to, data }),
    onMessage: (from, env) => {
      if (env?.k === 't') return answerTime(from, env);
      emit(from, env);
    },
    onChange: (other, state) => {
      if (state === 'open' && other === clock.following) clock.sync();
      changed();
    },
  });

  /** A time request carries an id; the answer echoes it with the host's clock. */
  function answerTime(from, env) {
    if (env.q !== undefined) mesh.send(from, { k: 't', a: [env.q, Date.now()] });
    else if (Array.isArray(env.a)) {
      const [id, host] = env.a;
      const pending = asks.get(id);
      if (pending) {
        asks.delete(id);
        pending([pending.sent, host, Date.now()]);
      }
    }
  }

  const clock = createClock({
    ask: (host) =>
      new Promise((resolve) => {
        const id = ++asked;
        const done = (sample) => resolve(sample);
        done.sent = Date.now();
        asks.set(id, done);
        if (!mesh.send(host, { k: 't', q: id })) {
          asks.delete(id);
          return resolve(null);
        }
        setTimeout(() => asks.delete(id) && resolve(null), ASK_TIMEOUT_MS);
      }),
  });

  relay.onPresence((list) => {
    others = list.filter((m) => m.key !== key);
    mesh.keep(others.map((m) => m.key));
    for (const m of others) if (Number.isInteger(m.slot)) mesh.connect(m.key);
    changed();
  });
  relay.on('env', ({ from, to, env }) => {
    if (from !== key && (to === key || to === null)) emit(from, env);
  });
  relay.on('rtc', ({ from, to, data }) => {
    if (to === key) mesh.signal(from, data);
  });

  return {
    key,
    members,
    me: () => me,
    clock,
    link: (other) => mesh.state(other),
    route: (other) => mesh.route(other),
    update(fields) {
      me = { ...me, ...fields };
      relay.track(me);
      changed();
    },
    onMembers(fn) {
      memberFns.add(fn);
      return () => memberFns.delete(fn);
    },
    send(to, env, { reliable = true } = {}) {
      if (closed) return;
      if (to === key) {
        const copy = JSON.parse(JSON.stringify(env));
        setTimeout(() => emit(key, copy));
        return;
      }
      if (env?.k === 'g') mesh.send(to, env, { reliable });
      else relay.send('env', { from: key, to, env });
    },
    broadcast(env) {
      if (!closed) relay.send('env', { from: key, to: null, env });
    },
    onMessage(fn) {
      messageFns.add(fn);
      return () => messageFns.delete(fn);
    },
    close() {
      if (closed) return;
      closed = true;
      clock.stop();
      mesh.close();
      relay.close();
    },
  };
}

/** The relay over the session's private Realtime channel. */
export async function supabaseRelay(sb, sessionId, key) {
  await sb.realtime.setAuth();
  const channel = sb.channel(`session:${sessionId}`, {
    config: { private: true, broadcast: { self: false, ack: false }, presence: { key } },
  });
  const handlers = new Map();
  let presenceFn = () => {};
  const list = () =>
    Object.entries(channel.presenceState()).map(([k, metas]) => ({ ...metas[metas.length - 1], key: k }));
  channel.on('presence', { event: 'sync' }, () => presenceFn(list()));
  for (const event of ['env', 'rtc']) {
    channel.on('broadcast', { event }, ({ payload }) => handlers.get(event)?.(payload));
  }
  await new Promise((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(error || new Error(status));
    });
  });
  return {
    track: (meta) => channel.track(meta),
    onPresence: (fn) => {
      presenceFn = fn;
      fn(list());
    },
    send: (event, payload) => channel.send({ type: 'broadcast', event, payload }),
    on: (event, fn) => handlers.set(event, fn),
    close: () => {
      channel.untrack();
      sb.removeChannel(channel);
    },
  };
}
