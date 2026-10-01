export const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const radians = (degrees) => degrees * Math.PI / 180;
export const degrees = (radians) => radians * 180 / Math.PI;
export const tuple = (v) => [v.x, v.y, v.z];
export const vector = (v) => ({ x: v[0], y: v[1], z: v[2] });
export function moveToward(current, target, amount) {
    return current + clamp(target - current, -amount, amount);
}
/** Deterministic decoration. Do not use Math.random for level generation. */
export function random(seed) {
    return () => {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
