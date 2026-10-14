// Hidden blade and the counter window. The game decides the flags
// (range, behind, blend, from above). This module only resolves them.

export const BLADE_RANGE = 1.45;
export const MELEE_RANGE = 1.7;

export const STRIKE = {
  windup: 0.5,
  windowEnd: 0.82,
  recover: 1.35,
  damage: 1,
};

/** @param {number} t seconds into a strike */
export function strikePhase(t) {
  if (t < STRIKE.windup) return 'windup';
  if (t < STRIKE.windowEnd) return 'window';
  if (t < STRIKE.recover) return 'recover';
  return 'done';
}

/**
 * Low profile kills from behind or from inside a blend, in range.
 * A position above the target (aerial or high profile) also kills, in range.
 * Out of range, or a low-profile approach that is neither behind nor blended, does not.
 */
export function tryBlade(q) {
  if (!q.inRange) return { dead: false, reason: 'range' };
  if (q.lowProfile && (q.behind || q.blended)) return { dead: true, kind: 'low' };
  if (q.fromAbove) return { dead: true, kind: 'air' };
  return { dead: false, reason: 'angle' };
}

/**
 * Counter inside the window: no damage, and a punish.
 * The same input outside the window does not counter: the hit's damage stands.
 * `phase` 'window' or `inWindow: true` is the window.
 */
export function resolveCounter(q) {
  const damage = q.damage ?? STRIKE.damage;
  const inWindow = q.inWindow === true || q.phase === 'window';
  if (q.pressed && inWindow) return { damage: 0, punish: true, countered: true };
  return { damage, punish: false, countered: false };
}

/**
 * One step of a guard's strike.
 * A press outside the window does not counter and does not itself deal damage.
 * The strike keeps going. Damage lands once, when the window elapses with no punish.
 * @returns {{ kind: 'punish' | 'hit' | 'continue', damage: number }}
 */
export function resolveStrikeStep({ before, phase, pressed }) {
  if (pressed && phase === 'window') {
    const result = resolveCounter({ pressed: true, phase: 'window' });
    return { kind: 'punish', damage: result.damage };
  }
  if (before === 'window' && phase !== 'window' && phase !== 'windup') {
    const result = resolveCounter({ pressed: false, phase: 'recover' });
    return { kind: 'hit', damage: result.damage };
  }
  return { kind: 'continue', damage: 0 };
}

/** @returns {{ health: number, loss: boolean }} */
export function applyHealth(health, damage) {
  const next = Math.max(0, health - damage);
  return { health: next, loss: next <= 0 };
}

/** Player is behind the target when they stand against its forward. */
export function isBehind(forwardX, forwardZ, toPlayerX, toPlayerZ) {
  const fl = Math.hypot(forwardX, forwardZ);
  const pl = Math.hypot(toPlayerX, toPlayerZ);
  if (fl < 1e-6 || pl < 1e-6) return false;
  const dot = (forwardX / fl) * (toPlayerX / pl) + (forwardZ / fl) * (toPlayerZ / pl);
  return dot < -0.35;
}

/** Yaw 0 faces +Z, matching PlatformerCharacter.facing. */
export function yawForward(yaw) {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}
