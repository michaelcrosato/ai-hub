/**
 * session/mesh.js — game traffic straight between the players' browsers.
 *
 * Every pair of players has one WebRTC connection with two data channels,
 * agreed in advance so neither side has to announce them: `r` (id 0) is
 * reliable and ordered, `u` (id 1) may drop or reorder and never retries, for
 * state that is sent again a moment later anyway. The player whose key sorts
 * first makes the offer, so two never cross. Offers, answers and candidates
 * travel through `signal(to, data)`; the session's channel carries them.
 *
 * A connection that fails is retried a few times. If it never opens, the
 * pair simply can't trade game traffic, and the round goes on without it.
 */

const RETRIES = 3;
const RETRY_MS = 3_000;
/** Past this much queued, unreliable sends are skipped instead of piling up. */
const BUFFER_LIMIT = 1 << 20;

export function createMesh({ me, iceServers = [], relayOnly = false, signal, onMessage, onChange = () => {}, RTC = globalThis.RTCPeerConnection }) {
  const peers = new Map();
  let closed = false;

  const offerer = (key) => me < key;

  function peer(key) {
    let p = peers.get(key);
    if (p) return p;
    const pc = new RTC({ iceServers, iceTransportPolicy: relayOnly ? 'relay' : 'all' });
    const r = pc.createDataChannel('r', { negotiated: true, id: 0, ordered: true });
    const u = pc.createDataChannel('u', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
    p = { key, pc, r, u, queued: [], remote: false, tries: 0, state: 'connecting' };
    peers.set(key, p);
    for (const channel of [r, u]) {
      channel.onmessage = ({ data }) => {
        let env;
        try {
          env = JSON.parse(data);
        } catch {
          return;
        }
        onMessage(key, env);
      };
    }
    r.onopen = () => setState(p, 'open');
    r.onclose = () => p.state === 'open' && setState(p, 'closed');
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) signal(key, { candidate: candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') retry(p);
    };
    return p;
  }

  function setState(p, state) {
    if (p.state === state) return;
    p.state = state;
    onChange(p.key, state);
  }

  async function offer(p) {
    try {
      const description = await p.pc.createOffer();
      await p.pc.setLocalDescription(description);
      signal(p.key, { sdp: p.pc.localDescription.toJSON() });
    } catch (error) {
      console.warn('[mesh] offer failed', error);
    }
  }

  function retry(p) {
    const tries = (p.tries || 0) + 1;
    drop(p.key, false);
    if (closed || tries > RETRIES) {
      onChange(p.key, 'failed');
      return;
    }
    setTimeout(() => {
      if (closed || peers.has(p.key)) return;
      const next = peer(p.key);
      next.tries = tries;
      if (offerer(p.key)) offer(next);
    }, RETRY_MS);
  }

  function drop(key, tell = true) {
    const p = peers.get(key);
    if (!p) return;
    peers.delete(key);
    try {
      p.pc.close();
    } catch {
      /* already closed */
    }
    if (tell) onChange(key, 'closed');
  }

  return {
    /** Start (or keep) a connection to another player. */
    connect(key) {
      if (closed || key === me || peers.has(key)) return;
      const p = peer(key);
      if (offerer(key)) offer(p);
    },
    /** An offer, answer or candidate from `from`, via the session's channel. */
    async signal(from, data) {
      if (closed || !data) return;
      const p = peer(from);
      try {
        if (data.sdp) {
          await p.pc.setRemoteDescription(data.sdp);
          p.remote = true;
          for (const candidate of p.queued.splice(0)) await p.pc.addIceCandidate(candidate);
          if (data.sdp.type === 'offer') {
            await p.pc.setLocalDescription(await p.pc.createAnswer());
            signal(from, { sdp: p.pc.localDescription.toJSON() });
          }
        } else if (data.candidate) {
          if (p.remote) await p.pc.addIceCandidate(data.candidate);
          else p.queued.push(data.candidate);
        }
      } catch (error) {
        console.warn('[mesh] signal failed', error);
      }
    },
    /** True when it went; false when there is no open connection to `to`. */
    send(to, env, { reliable = true } = {}) {
      const p = peers.get(to);
      const channel = p && (reliable ? p.r : p.u);
      if (!channel || channel.readyState !== 'open') return false;
      if (!reliable && channel.bufferedAmount > BUFFER_LIMIT) return false;
      channel.send(JSON.stringify(env));
      return true;
    },
    state: (key) => peers.get(key)?.state ?? 'none',
    drop,
    /** How each connection runs: 'direct' or 'relay', from the browser's own stats. */
    async route(key) {
      const p = peers.get(key);
      if (!p) return null;
      const stats = await p.pc.getStats();
      for (const s of stats.values()) {
        if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') {
          const local = stats.get(s.localCandidateId);
          return local?.candidateType === 'relay' ? 'relay' : 'direct';
        }
      }
      return null;
    },
    close() {
      closed = true;
      for (const key of [...peers.keys()]) drop(key, false);
    },
  };
}
