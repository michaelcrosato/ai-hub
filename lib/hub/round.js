/**
 * round.js — one round of an AI Hub session, run by the hub that coordinates
 * it (the harness page, or the session host's tab).
 *
 * It never touches the network or a frame itself: every message for a game
 * goes out through `deliver(key, msg)`, and everything the games report comes
 * in through `receive(key, msg)` and `leave(key, reason)`. The clock is
 * injected, so `scripts/hub.test.mjs` can walk a round through every timeout
 * without waiting for one.
 *
 * Players are known by `key` (whatever the session calls them); games see
 * contiguous ids 0..N-1 in slot order.
 */

export const TIMINGS = Object.freeze({
  helloMs: 10_000,
  readyMs: 45_000,
  countdownMs: 3_000,
  graceMs: 5_000,
  hiddenMs: 20_000,
  maxRoundMs: 15 * 60_000,
});

/** P1 red, P2 blue, P3 green, P4 yellow: the colour follows the seat. */
export const SLOT_COLORS = Object.freeze(['#e8443a', '#3b82f6', '#22c55e', '#f5b700']);

export const MODES = Object.freeze(['versus', 'co-op', 'race']);

const REAL_CLOCK = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle),
};

/** A round's hard cap: half again its declared length, never past 15 minutes. */
export function limitFor(minutes, { maxRoundMs = TIMINGS.maxRoundMs } = {}) {
  const typical = Number(minutes) > 0 ? Number(minutes) : 5;
  return Math.min(maxRoundMs, Math.round(typical * 1.5 * 60_000));
}

/**
 * Race order: finishers by time, then the rest by score, then anyone who
 * reported nothing, tied last. Equal times or scores share a place.
 */
export function rankRace(results, ids) {
  const timed = [];
  const scored = [];
  const silent = [];
  for (const id of ids) {
    const r = results.get(id);
    if (r && Number.isFinite(r.time)) timed.push([id, r.time]);
    else if (r && Number.isFinite(r.score)) scored.push([id, r.score]);
    else silent.push(id);
  }
  const groups = (list, order) => {
    list.sort((a, b) => order * (a[1] - b[1]) || a[0] - b[0]);
    const out = [];
    for (const [id, value] of list) {
      const last = out[out.length - 1];
      if (last && last.value === value) last.ids.push(id);
      else out.push({ value, ids: [id] });
    }
    return out.map((g) => g.ids);
  };
  return [...groups(timed, 1), ...groups(scored, -1), ...(silent.length ? [silent] : [])];
}

/**
 * Check a host's standings: groups of ids, best first, every present player
 * exactly once. Players already gone may be placed or left out; whoever is
 * left out lands in a last group of their own.
 */
export function checkStandings(standings, presentIds, allIds) {
  if (!Array.isArray(standings)) return { ok: false, problem: 'standings is not an array' };
  const all = new Set(allIds);
  const seen = new Set();
  const groups = [];
  for (const group of standings) {
    const ids = Array.isArray(group) ? group : [group];
    const kept = [];
    for (const id of ids) {
      if (!Number.isInteger(id) || !all.has(id)) return { ok: false, problem: `unknown player id ${JSON.stringify(id)}` };
      if (seen.has(id)) return { ok: false, problem: `player ${id} is placed twice` };
      seen.add(id);
      kept.push(id);
    }
    if (kept.length) groups.push(kept);
  }
  const missing = presentIds.filter((id) => !seen.has(id));
  if (missing.length) return { ok: false, problem: `standings leave out player${missing.length > 1 ? 's' : ''} ${missing.join(', ')}` };
  const absent = allIds.filter((id) => !seen.has(id));
  if (absent.length) groups.push(absent);
  return { ok: true, standings: groups };
}

/**
 * @param {object} o
 * @param {number} o.round            round number, carried on every message
 * @param {{key:string, slot:number, name:string}[]} o.players
 * @param {string} o.hostKey          whose game runs the shared world (versus, co-op)
 * @param {string|null} o.mode        versus | co-op | race; null takes the first hello's
 * @param {number} o.seed
 * @param {number} o.limitMs
 * @param {{now:()=>number, setTimeout:Function, clearTimeout:Function}} [o.clock]
 * @param {(key:string, msg:object) => void} o.deliver
 * @param {(status:object) => void} [o.onStatus]
 * @param {(record:object) => void} [o.onEnd]
 */
export function createRound({
  round,
  players,
  hostKey,
  mode = null,
  seed,
  limitMs,
  clock = REAL_CLOCK,
  deliver,
  onStatus = () => {},
  onEnd = () => {},
  timings = TIMINGS,
}) {
  const t = { ...TIMINGS, ...timings };
  const seats = [...players]
    .sort((a, b) => a.slot - b.slot)
    .map((p, id) => ({
      id,
      key: p.key,
      slot: p.slot,
      name: p.name,
      color: SLOT_COLORS[p.slot % SLOT_COLORS.length],
      hello: false,
      ready: false,
      out: null,
      result: null,
      caps: null,
      hidden: null,
    }));
  const byKey = new Map(seats.map((s) => [s.key, s]));
  const ids = seats.map((s) => s.id);
  const host = byKey.get(hostKey) || seats[0];
  const timers = new Set();
  const issues = [];
  let phase = 'loading';
  let goAt = null;
  let record = null;

  const later = (ms, fn) => {
    const handle = clock.setTimeout(() => {
      timers.delete(handle);
      fn();
    }, Math.max(0, ms));
    timers.add(handle);
    return handle;
  };
  const cancel = (handle) => {
    if (handle == null) return;
    clock.clearTimeout(handle);
    timers.delete(handle);
  };

  const present = () => seats.filter((s) => !s.out);
  const needsHost = () => mode !== 'race';
  const send = (seat, msg) => deliver(seat.key, { round, ...msg });
  const toPresent = (msg, except = null) => {
    for (const s of present()) if (s !== except && s.hello) send(s, msg);
  };
  const issue = (seat, problem) => {
    issues.push({ key: seat?.key ?? null, id: seat?.id ?? null, problem });
    status();
  };

  function status() {
    onStatus({
      round,
      phase,
      mode,
      host: host.id,
      goAt,
      players: seats.map((s) => ({
        id: s.id,
        key: s.key,
        slot: s.slot,
        name: s.name,
        color: s.color,
        hello: s.hello,
        ready: s.ready,
        out: s.out,
        result: s.result,
      })),
      issues: issues.slice(),
    });
  }

  function welcome(seat) {
    send(seat, {
      type: 'welcome',
      me: seat.id,
      host: host.id,
      players: seats.map((s) => ({ id: s.id, name: s.name, color: s.color })),
      keys: seats.map((s) => s.key),
      mode,
      seed: seed >>> 0,
      limitMs,
    });
    for (const s of seats) if (s.out) send(seat, { type: 'leave', id: s.id, reason: s.out });
  }

  function markOut(seat, reason) {
    if (seat.out || phase === 'ended') return;
    seat.out = reason;
    cancel(seat.hidden);
    seat.hidden = null;
    toPresent({ type: 'leave', id: seat.id, reason });
    // A player who sat out is still at the hub: tell their game it is over for them.
    if (reason === 'not-ready' && seat.hello) send(seat, { type: 'end', reason: 'sat-out' });
  }

  function settle() {
    if (phase === 'ended') return;
    const left = present();
    if (!left.length) return finishVoid('no-players');
    if (needsHost() && host.out) {
      return finishVoid(host.out === 'not-ready' ? 'host-not-ready' : 'host-left', phase === 'loading' ? 'void' : 'host-left');
    }
    if (phase === 'loading') {
      if (left.every((s) => s.ready)) begin();
      return;
    }
    if (mode === 'race' && left.every((s) => s.result)) finishRace();
  }

  function begin() {
    phase = 'countdown';
    goAt = clock.now() + t.countdownMs;
    toPresent({ type: 'start', at: goAt });
    later(t.countdownMs, () => {
      if (phase === 'countdown') {
        phase = 'playing';
        status();
      }
    });
    later(t.countdownMs + limitMs, timeUp);
    status();
  }

  function timeUp() {
    if (phase === 'ended' || phase === 'grace') return;
    phase = 'grace';
    toPresent({ type: 'time-up', graceMs: t.graceMs });
    later(t.graceMs, () => {
      if (phase === 'ended') return;
      if (mode === 'race') finishRace();
      else finishVoid('no-result');
    });
    status();
  }

  function finishRace() {
    const results = new Map(seats.filter((s) => s.result).map((s) => [s.id, s.result]));
    const ranked = rankRace(results, present().map((s) => s.id));
    const gone = seats.filter((s) => s.out).map((s) => s.id);
    const scores = {};
    for (const [id, r] of results) scores[id] = Number.isFinite(r.time) ? r.time : r.score;
    finishPlayed(gone.length ? [...ranked, gone] : ranked, { scores, results: Object.fromEntries(results) });
  }

  function finishPlayed(standings, extra = {}) {
    end({ status: 'played', reason: 'finished', endReason: 'finished', standings, ...extra });
  }

  function finishVoid(reason, endReason = 'void') {
    end({ status: 'void', reason, endReason, standings: null });
  }

  function end(outcome) {
    if (phase === 'ended') return;
    phase = 'ended';
    for (const handle of timers) clock.clearTimeout(handle);
    timers.clear();
    const msg = { type: 'end', reason: outcome.endReason };
    if (outcome.standings) msg.standings = outcome.standings;
    toPresent(msg);
    record = {
      round,
      mode,
      hostId: host.id,
      ...outcome,
      players: seats.map((s) => ({ id: s.id, key: s.key, slot: s.slot, name: s.name, color: s.color, out: s.out })),
      issues: issues.slice(),
    };
    status();
    onEnd(record);
  }

  function receive(key, msg) {
    const seat = byKey.get(key);
    if (!seat || !msg || typeof msg.type !== 'string' || phase === 'ended' || seat.out) return;
    switch (msg.type) {
      case 'hello': {
        if (seat.hello) return;
        seat.hello = true;
        seat.caps = { v: msg.v, client: msg.client, mode: msg.mode ?? null, seats: msg.seats ?? null };
        if (msg.v !== 1) issue(seat, `hello speaks protocol ${JSON.stringify(msg.v)}, not 1`);
        if (!mode && MODES.includes(msg.mode)) mode = msg.mode;
        else if (msg.mode && msg.mode !== mode) issue(seat, `hello says mode ${msg.mode}, the round is ${mode}`);
        welcome(seat);
        status();
        return;
      }
      case 'ready':
        if (!seat.hello || seat.ready || phase !== 'loading') return;
        seat.ready = true;
        status();
        return settle();
      case 'result': {
        if (mode !== 'race') return issue(seat, `result is for race mode; this round is ${mode}`);
        if (phase === 'loading') return issue(seat, 'result before start');
        if (seat.result) return;
        const time = Number(msg.time);
        const score = Number(msg.score);
        if (msg.time !== undefined && Number.isFinite(time)) seat.result = { time };
        else if (msg.score !== undefined && Number.isFinite(score)) seat.result = { score };
        else return issue(seat, 'result needs a finite time or score');
        status();
        return settle();
      }
      case 'finish': {
        if (mode === 'race') return issue(seat, 'finish is for versus and co-op; race games report result');
        if (seat !== host) return issue(seat, 'finish from a player who is not the host');
        if (phase === 'loading') return issue(seat, 'finish before start');
        const checked = checkStandings(msg.standings, present().map((s) => s.id), ids);
        if (!checked.ok) return issue(seat, `finish ignored: ${checked.problem}`);
        const scores = msg.scores && typeof msg.scores === 'object' ? msg.scores : undefined;
        return finishPlayed(checked.standings, { scores, won: mode === 'co-op' ? msg.won === true : undefined });
      }
      case 'error':
        issue(seat, `game error: ${String(msg.message || '').slice(0, 200)}`);
        if (msg.fatal) {
          if (needsHost() && seat === host) return finishVoid('host-error');
          markOut(seat, 'disconnected');
          status();
          settle();
        }
        return;
      case 'vis':
        if (seat !== host || !needsHost()) return;
        if (msg.hidden && seat.hidden == null && phase !== 'loading') {
          seat.hidden = later(t.hiddenMs, () => finishVoid('host-hidden'));
        } else if (!msg.hidden) {
          cancel(seat.hidden);
          seat.hidden = null;
        }
        return;
      default:
        return issue(seat, `unknown message type ${JSON.stringify(msg.type)}`);
    }
  }

  function leave(key, reason = 'left') {
    const seat = byKey.get(key);
    if (!seat || seat.out || phase === 'ended') return;
    markOut(seat, reason);
    status();
    settle();
  }

  function startRound() {
    later(t.helloMs, () => {
      for (const s of seats) if (!s.hello && !s.out) markOut(s, 'not-ready');
      status();
      settle();
    });
    later(t.readyMs, () => {
      if (phase !== 'loading') return;
      for (const s of seats) if (!s.ready && !s.out) markOut(s, 'not-ready');
      status();
      settle();
    });
    status();
  }

  startRound();

  return {
    receive,
    leave,
    /** Call time now, as the cap would: the host pressed "End round". */
    timeUp() {
      if (phase === 'countdown' || phase === 'playing') timeUp();
    },
    /** End the round now: the session ended, or the host skipped this game. */
    abort(reason = 'skipped') {
      finishVoid(reason, reason === 'session-ended' ? 'session-ended' : 'void');
    },
    get phase() {
      return phase;
    },
    get record() {
      return record;
    },
    get mode() {
      return mode;
    },
    seats: () => seats.map((s) => ({ ...s, hidden: undefined })),
  };
}
