// Line-of-sight chase. Sight starts it. It ends only after sight has already
// been broken and the player then hides. Hiding on the same step the sight
// breaks does not end it yet. Hiding while still seen does not end it.

/**
 * @param {{ mode?: string, broken?: boolean }} guard
 * @param {{ los?: boolean, hiding?: boolean }} sense
 * @returns {{ mode: 'patrol' | 'chase', broken: boolean }}
 */
export function stepGuard(guard, sense) {
  const mode = guard.mode === 'chase' ? 'chase' : 'patrol';
  const broken = guard.broken === true;
  const los = sense.los === true;
  const hiding = sense.hiding === true;
  if (mode !== 'chase') {
    if (los) return { mode: 'chase', broken: false };
    return { mode: 'patrol', broken: false };
  }
  if (los) return { mode: 'chase', broken: false };
  if (broken && hiding) return { mode: 'patrol', broken: false };
  return { mode: 'chase', broken: true };
}

/**
 * Line of sight for one guard.
 * A chase uses the ray alone. Hiding or blending does not count as broken sight.
 * A chase starts from a ray only when the player is exposed and not concealed.
 */
export function guardLos({ chasing, geometric, exposed, hiding, blended }) {
  if (chasing) return geometric === true;
  return geometric === true && exposed === true && hiding !== true && blended !== true;
}
