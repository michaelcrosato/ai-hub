/**
 * frames.js — which still of a captured strip a cabinet shows.
 *
 * Frame 0 is the title screen. A cycle alternates that frame with each later
 * one (title, next, title, next, …), so the title is shown first and on at
 * least half of the ticks — at least as often as any other frame in the strip.
 * No DOM: the cabinet and the node tests both call this.
 */

/** How long one cabinet holds a frame before the next tick. */
export const FRAME_MS = 2500;

/**
 * Address to show for `tick`, or null when the strip is empty.
 * Tick 0, and every even tick, is the title. Odd ticks walk the rest.
 */
export function frameAt(frames, tick) {
  const list = Array.isArray(frames) ? frames.filter((url) => typeof url === 'string' && url) : [];
  if (!list.length) return null;
  const t = Math.max(0, Math.floor(Number(tick) || 0));
  if (list.length === 1 || t % 2 === 0) return list[0];
  return list[1 + (Math.floor(t / 2) % (list.length - 1))];
}

/** Ticks until the pattern repeats. A single frame never rotates. */
export function frameCycleLength(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 1) return 1;
  return 2 * (n - 1);
}
