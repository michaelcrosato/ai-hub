// Social stealth. Exposure raises the meter. Unseen, quiet time lets it fall.
// Blend and hiding never add to it. A guard, and anyone off the street, is not crowd cover.

export const AWARENESS_MAX = 100;
export const HUNTED_AT = 70;
export const ALERT_AT = 40;

/** True when this person can hide the player inside a street crowd. */
export function isBlendCover(person) {
  if (!person || person.elevated) return false;
  if (person.role === 'guard') return false;
  return person.role === 'civilian';
}

/**
 * One awareness step.
 * High profile, climbing in view, and fighting add.
 * Blend and hiding do not add. Unseen time with none of those three subtracts.
 */
export function stepAwareness(value, ev) {
  const dt = ev.dt ?? 0;
  const conspicuous = !!(ev.highProfile || ev.climbingInView || ev.fighting);
  let next = value;
  if (ev.highProfile) next += 28 * dt;
  if (ev.climbingInView) next += 42 * dt;
  if (ev.fighting) next += 60 * dt;
  if (!conspicuous && (ev.unseen || ev.blended || ev.hiding)) next -= 14 * dt;
  if (next > AWARENESS_MAX) next = AWARENESS_MAX;
  if (next < 0) next = 0;
  return next;
}

/** Word for the HUD. The meter itself is what status() prints. */
export function awarenessLabel(value) {
  if (value >= HUNTED_AT) return 'HUNTED';
  if (value >= ALERT_AT) return 'ALERT';
  if (value >= 12) return 'WARY';
  return 'ANON';
}
