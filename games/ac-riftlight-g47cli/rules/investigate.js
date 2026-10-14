// Investigations, routes, and the hunted pursuit. The page and the tests share this.

import { isBehind, tryBlade, yawForward, BLADE_RANGE } from './blade.js';
import { createMemory, markTargetDead, reachEscape, restartMemory } from './mission.js';

export const HUNTED_AT = 70;

/** Walk `route` (at least two points) at `speed` in points per second. */
export function advanceRoute(route, time, speed = 0.55) {
  if (!route || route.length === 0) return { x: 0, y: 0, z: 0, yaw: 0, moving: false };
  if (route.length === 1) {
    const p = route[0];
    return { x: p[0], y: p[1] ?? 0, z: p[2], yaw: 0, moving: false };
  }
  const span = route.length;
  const u = ((time * speed) % span + span) % span;
  const i = Math.floor(u) % route.length;
  const j = (i + 1) % route.length;
  const f = u - Math.floor(u);
  const a = route[i];
  const b = route[j];
  const x = a[0] + (b[0] - a[0]) * f;
  const y = (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * f;
  const z = a[2] + (b[2] - a[2]) * f;
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  return { x, y, z, yaw: Math.atan2(dx, dz), moving: Math.hypot(dx, dz) > 0.05 };
}

/**
 * Listening fills only while low, inside the spot, and not being chased.
 * Leaving, high profile, or a chase clears the progress. Finishing is not itself a raise.
 */
export function stepEavesdrop(progress, { dt = 0, lowProfile, inSpot, chasing, done, need = 2.2 }) {
  if (done) return { progress: 0, complete: false };
  if (!lowProfile || !inSpot || chasing) return { progress: 0, complete: false };
  const next = progress + dt;
  if (next >= need) return { progress: need, complete: true };
  return { progress: next, complete: false };
}

/** A purse only from behind a carrier who is actually walking. The front fails. */
export function tryPickpocket({ lowProfile, behind, moving, inRange }) {
  const ok = !!(lowProfile && behind && moving && inRange);
  return { ok, flag: ok ? 'pickpocket' : null };
}

/** Questioning the ally is its own low-profile action. */
export function tryInterrogation({ lowProfile, inRange, pressed }) {
  const ok = !!(lowProfile && inRange && pressed);
  return { ok, flag: ok ? 'interrogation' : null };
}

/** Eavesdrop and pickpocket do not raise the meter. Interrogation does. */
export function intelPulse(kind) {
  return kind === 'interrogation' ? 22 : 0;
}

/**
 * Apply one completed investigation. Awareness rises only for interrogation.
 * `reveal` is mission.revealIntel, so this file does not import it in a cycle.
 */
export function finishInvestigation(memory, awareness, kind, reveal) {
  const next = reveal(memory, kind);
  const bumped = Math.min(100, Math.max(0, awareness + intelPulse(kind)));
  return { memory: next, awareness: bumped };
}

/** Hidden blade against a body that may have moved. */
export function bladeAt(actor, player, flags) {
  const dx = player.x - actor.x;
  const dy = player.y - actor.y;
  const dz = player.z - actor.z;
  const horizontal = Math.hypot(dx, dz);
  const facing = yawForward(actor.yaw ?? 0);
  const behind = isBehind(facing.x, facing.z, dx, dz);
  const fromAbove = player.y > actor.y + 1 && horizontal <= BLADE_RANGE && (flags.airborne || flags.highProfile);
  const inRange = horizontal <= BLADE_RANGE && Math.abs(dy) < 1.6;
  return tryBlade({
    inRange,
    lowProfile: !!flags.lowProfile,
    behind,
    blended: !!flags.blended,
    fromAbove,
  });
}

/**
 * A clean, witnessed kill forces a chase. An unseen kill does not.
 * A spoiled kill is not the escape, so it does not force one either.
 */
export function resolveKill(memory, { seen }) {
  const next = markTargetDead(memory);
  const clean = next.targetDead && !next.spoiled;
  return { memory: next, forceChase: !!(clean && seen) };
}

export function chaseAfterKill(guards, { forceChase, seenId }) {
  if (!forceChase) return guards.map((g) => ({ ...g, forced: false }));
  let used = false;
  return guards.map((g) => {
    if (used || g.dead) return { ...g, forced: false };
    if (seenId && g.id !== seenId) return { ...g, forced: false };
    used = true;
    return { ...g, mode: 'chase', broken: false, forced: true };
  });
}

export function searcherActive(awareness) {
  return awareness >= HUNTED_AT;
}

/** Opening of a restarted attempt: locked, no intel, the mark alive, guards on patrol. */
export function restartRoster(district) {
  const route = district.target.route;
  const home = route?.[0] ?? district.target.at;
  return {
    memory: restartMemory(),
    markAlive: true,
    markAt: home,
    guards: district.guards.map((g) => ({
      id: g.id,
      mode: 'patrol',
      x: g.at[0],
      y: g.at[1],
      z: g.at[2],
    })),
  };
}

export function gateAfter(memory) {
  return reachEscape(memory);
}

export { createMemory };
