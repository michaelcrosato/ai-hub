/**
 * session/clock.js — one time for the whole session: the host's.
 *
 * Each player asks the host the time a few times over the mesh. A sample is
 * [sent, host's time, received]; the host's clock read halfway through the
 * round trip, so the shortest round trip gives the best estimate. Rounds are
 * then started and timed on the host's clock (lib/hub/round.js gives games a
 * start in milliseconds from now, worked out with this offset).
 */

/** Milliseconds to add to this device's clock to read the host's, from [sent, host, received] samples. */
export function offsetFrom(samples) {
  let best = null;
  for (const [sent, host, received] of samples) {
    const rtt = received - sent;
    if (rtt < 0) continue;
    if (!best || rtt < best.rtt) best = { rtt, offset: host - (sent + received) / 2 };
  }
  return best;
}

/**
 * A clock that follows the host. `ask(hostKey)` sends one time request and
 * resolves with a sample, or null when nothing came back.
 */
export function createClock({ ask, now = () => Date.now(), every = 30_000, samples = 5 }) {
  let offset = 0;
  let rtt = null;
  let host = null;
  let timer = 0;

  async function sync() {
    if (!host) return;
    const got = [];
    for (let i = 0; i < samples; i++) {
      const sample = await ask(host);
      if (sample) got.push(sample);
    }
    const best = offsetFrom(got);
    if (best) ({ offset, rtt } = best);
  }

  return {
    now: () => now() + offset,
    get offset() {
      return offset;
    },
    get rtt() {
      return rtt;
    },
    /** Whose clock this follows: the host's key, or null on the host itself. */
    get following() {
      return host;
    },
    /** Follow this host, or be the clock (the host itself). */
    follow(hostKey, isMe) {
      clearInterval(timer);
      host = isMe ? null : hostKey;
      if (isMe) offset = 0;
      if (host) {
        sync();
        timer = setInterval(sync, every);
      }
    },
    /** Ask again now: the connection to the host just opened. */
    sync,
    stop() {
      clearInterval(timer);
    },
  };
}
