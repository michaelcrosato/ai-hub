/**
 * physics.js — Rapier 0.20.0, loaded once, SIMD build where the browser has
 * wasm SIMD (every current desktop and phone browser), plain build otherwise.
 *
 * Conventions every game follows, so physics code can move between games:
 *   - Units are meters, seconds, kilograms; gravity is -9.81 on Y.
 *   - A game built at another scale sets world.lengthUnit (1 = meters). That
 *     also lifts Rapier's 400 units/s linear speed cap for big-unit worlds.
 *   - Angular speed is capped at 45° per step (47 rad/s at 60 Hz). Cars use
 *     the raycast vehicle controller, not jointed wheel bodies, and bullets
 *     are ray or shape casts, not fast rigid bodies.
 *   - Bodies sleep after 0.5 s of rest; wake them when you move them by hand.
 *   - Step on a fixed clock (fixedStep below), render with the remainder.
 */

/** wasm-feature-detect's SIMD probe: a tiny module using one v128 instruction. */
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

export function simdSupported() {
  try {
    return typeof WebAssembly === 'object' && WebAssembly.validate(SIMD_PROBE);
  } catch {
    return false;
  }
}

let loading = null;
export const physicsInfo = { simd: false, version: '0.20.0' };

/** @returns {Promise<typeof import('../rapier/rapier.mjs')>} the RAPIER namespace, initialised */
export function loadRapier() {
  loading ??= (async () => {
    physicsInfo.simd = simdSupported();
    const url = new URL(physicsInfo.simd ? '../rapier/rapier-simd.mjs' : '../rapier/rapier.mjs', import.meta.url);
    const RAPIER = await import(url.href);
    await RAPIER.init();
    return RAPIER;
  })();
  return loading;
}

/** A world with the shared conventions applied. */
export function createWorld(RAPIER, { gravity = -9.81, lengthUnit = 1, hz = 60 } = {}) {
  const g = typeof gravity === 'number' ? { x: 0, y: gravity, z: 0 } : gravity;
  const world = new RAPIER.World(g);
  world.timestep = 1 / hz;
  if (lengthUnit !== 1) world.lengthUnit = lengthUnit;
  return world;
}

/**
 * Fixed-step accumulator. advance(dt, step) runs step(h) as many times as the
 * elapsed time needs (at most maxSteps, so a stall cannot spiral) and returns
 * the leftover fraction 0..1 for interpolating what you draw.
 */
export function fixedStep(hz = 60, maxSteps = 5) {
  const h = 1 / hz;
  let acc = 0;
  return {
    dt: h,
    advance(dt, step) {
      acc = Math.min(acc + Math.max(0, dt), h * maxSteps);
      while (acc >= h) {
        step(h);
        acc -= h;
      }
      return acc / h;
    },
    reset() {
      acc = 0;
    },
  };
}
