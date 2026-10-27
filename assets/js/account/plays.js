/**
 * account/plays.js — how long each game was really played, for signed-in
 * players, on every device.
 *
 * A play starts when a game opens in the player and stops when it closes.
 * Only time with the page in view counts. Progress is written ahead to this
 * device every few seconds, sent every minute and when the game closes, and
 * anything a closed tab could not send goes on the next page load. The
 * database caps a play at the time that really passed (track_play).
 */

const PENDING_KEY = 'ai-hub:plays-pending';
const TICK_MS = 5_000;
const SEND_EVERY_MS = 60_000;

/**
 * The bookkeeping, apart from the browser so it can be tested:
 * `now()` in ms, `visible()`, `load()`/`save(list)` for the write-ahead, and
 * `send(play)` resolving true once the database has it.
 */
export function createTracker({ now, visible, load, save, send, newId }) {
  let open = null;
  let lastSent = 0;

  const pending = () => load() || [];
  const keep = (list) => save(list.slice(-50));

  function tick() {
    if (!open) return;
    const t = now();
    if (visible()) open.activeMs += Math.max(0, Math.min(t - open.tickAt, TICK_MS * 2));
    open.tickAt = t;
    keep([...pending().filter((p) => p.id !== open.id), snapshot(open)]);
  }

  const snapshot = (play) => ({
    id: play.id,
    slug: play.slug,
    build: play.build,
    view: play.view,
    sessionId: play.sessionId,
    startedAt: play.startedAt,
    activeSeconds: Math.floor(play.activeMs / 1000),
    open: play === open,
  });

  async function flush() {
    const list = pending();
    if (!list.length) return;
    const done = new Set();
    for (const play of list) {
      if (await send(play)) done.add(play.id);
    }
    // A play still open stays in the list (its next snapshot replaces it).
    keep(pending().filter((p) => !(done.has(p.id) && !p.open)));
  }

  return {
    start({ slug, build = null, view = null, sessionId = null }) {
      this.stop();
      const t = now();
      open = { id: newId(), slug, build, view, sessionId, startedAt: new Date(t).toISOString(), activeMs: 0, tickAt: t };
      tick();
    },
    tick() {
      tick();
      if (open && now() - lastSent >= SEND_EVERY_MS) {
        lastSent = now();
        return flush();
      }
      return null;
    },
    /** End the open play; the seconds it was in view. */
    stop() {
      if (!open) return 0;
      tick();
      const seconds = Math.floor(open.activeMs / 1000);
      const closed = { ...snapshot(open), open: false };
      open = null;
      keep([...pending().filter((p) => p.id !== closed.id), closed]);
      flush();
      return seconds;
    },
    flush,
    get open() {
      return open ? snapshot(open) : null;
    },
  };
}

/* --- in the browser --------------------------------------------------------- */

let tracker = null;

function browserTracker() {
  if (tracker) return tracker;
  const storage = (() => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  })();
  tracker = createTracker({
    now: () => Date.now(),
    visible: () => document.visibilityState === 'visible',
    load: () => {
      try {
        return JSON.parse(storage?.getItem(PENDING_KEY) || '[]');
      } catch {
        return [];
      }
    },
    save: (list) => {
      try {
        if (list.length) storage?.setItem(PENDING_KEY, JSON.stringify(list));
        else storage?.removeItem(PENDING_KEY);
      } catch {
        /* storage full or blocked: the play is lost, nothing else */
      }
    },
    send: sendPlay,
    newId: () => crypto.randomUUID(),
  });
  setInterval(() => tracker.tick(), TICK_MS);
  addEventListener('pagehide', () => tracker.tick());
  // Whatever an earlier page could not send.
  setTimeout(() => tracker.flush(), 3_000);
  return tracker;
}

async function sendPlay(play) {
  const { hasSession, attempt } = await import('./cloud.js');
  if (!hasSession()) return false;
  const { currentUser } = await import('./auth.js');
  const user = await currentUser();
  if (!user || user.guest) return true; // nobody to record it for: drop it
  const ok = await attempt(
    (sb) =>
      sb.rpc('track_play', {
        p_id: play.id,
        p_slug: play.slug,
        p_build: play.build,
        p_view: play.view,
        p_started_at: play.startedAt,
        p_active_seconds: play.activeSeconds,
        p_session_id: play.sessionId,
      }),
    false
  );
  return ok !== false;
}

/** A game opened in the player. Recorded only for a device that is signed in. */
export async function startPlay(details) {
  const { hasSession } = await import('./cloud.js');
  if (!hasSession()) return;
  browserTracker().start({ view: location.pathname.split('/')[1] || 'wall', ...details });
}

/** The game closed: the seconds it was played in view. */
export function stopPlay() {
  return tracker ? tracker.stop() : 0;
}
