/**
 * session/local.js — a session between tabs of one browser, over a
 * BroadcastChannel: for trying games on one machine and for the browser tests.
 *
 * It is the same shape the network transport will have: who is here
 * (presence), and envelopes to one member or all of them. Presence is a
 * heartbeat; a tab that stops beating for HERE_TIMEOUT_MS has left.
 */

const BEAT_MS = 1_000;
const HERE_TIMEOUT_MS = 3_500;

export function createLocalNet({ code, key, Channel = globalThis.BroadcastChannel }) {
  const channel = new Channel(`aihub-session:${code}`);
  const others = new Map(); // key -> { member, seen }
  const memberFns = new Set();
  const messageFns = new Set();
  let me = { key, slot: null, name: null, joinedAt: Date.now(), status: 'joining' };
  let closed = false;

  const post = (msg) => {
    if (!closed) channel.postMessage(msg);
  };
  const announce = () => post({ kind: 'here', member: me });
  const changed = () => {
    const list = members();
    for (const fn of memberFns) fn(list);
  };

  channel.onmessage = ({ data }) => {
    if (!data || closed) return;
    if (data.kind === 'here' && data.member?.key && data.member.key !== key) {
      const known = others.get(data.member.key);
      others.set(data.member.key, { member: data.member, seen: Date.now() });
      if (!known || JSON.stringify(known.member) !== JSON.stringify(data.member)) changed();
    } else if (data.kind === 'bye' && others.delete(data.key)) {
      changed();
    } else if (data.kind === 'who') {
      announce();
    } else if (data.kind === 'msg' && data.from !== key && (data.to === key || data.to === null)) {
      for (const fn of messageFns) fn(data.from, data.env);
    }
  };

  const beat = setInterval(() => {
    announce();
    const now = Date.now();
    let gone = false;
    for (const [k, entry] of others) {
      if (now - entry.seen > HERE_TIMEOUT_MS) {
        others.delete(k);
        gone = true;
      }
    }
    if (gone) changed();
  }, BEAT_MS);

  const bye = () => net.close();
  addEventListener('pagehide', bye);

  function members() {
    return [me, ...[...others.values()].map((e) => e.member)];
  }

  const net = {
    key,
    members,
    me: () => me,
    /** Change what the others see of this tab: slot, name, status. */
    update(fields) {
      me = { ...me, ...fields };
      announce();
      changed();
    },
    onMembers(fn) {
      memberFns.add(fn);
      return () => memberFns.delete(fn);
    },
    /** To one member (this tab included), or to every other member when `to` is null. */
    send(to, env) {
      if (closed) return;
      if (to === key) {
        const copy = JSON.parse(JSON.stringify(env));
        setTimeout(() => messageFns.forEach((fn) => fn(key, copy)));
        return;
      }
      post({ kind: 'msg', from: key, to, env });
    },
    broadcast(env) {
      post({ kind: 'msg', from: key, to: null, env });
    },
    onMessage(fn) {
      messageFns.add(fn);
      return () => messageFns.delete(fn);
    },
    close() {
      if (closed) return;
      post({ kind: 'bye', key });
      closed = true;
      clearInterval(beat);
      removeEventListener('pagehide', bye);
      channel.close();
    },
  };

  post({ kind: 'who' });
  announce();
  return net;
}
