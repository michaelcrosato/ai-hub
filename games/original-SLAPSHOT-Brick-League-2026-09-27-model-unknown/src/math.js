export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const length = (v) => Math.hypot(v.x, v.z);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const normal = (x, z) => { const l = Math.hypot(x, z); return l > 1e-8 ? { x: x / l, z: z / l } : { x: 0, z: 0 }; };
export const approach = (value, target, delta) => value < target ? Math.min(target, value + delta) : Math.max(target, value - delta);
export const other = (team) => team === 0 ? 1 : 0;
export const timeLabel = (t) => `${Math.floor(Math.max(0, t) / 60)}:${Math.floor(Math.max(0, t) % 60).toString().padStart(2, '0')}`;
/** Seeded PRNG: match simulations and regression tests are reproducible. */
export class Random {
    state;
    constructor(seed = 20260927) { this.state = seed >>> 0; }
    next() { let t = this.state += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    between(a, b) { return a + (b - a) * this.next(); }
}
export const RINK = Object.freeze({ halfLength: 30.5, halfWidth: 13, corner: 8.5, blue: 7.62, goal: 26.85, goalHalf: 1.52, goalHeight: 1.22, faceoff: 20.72, dotZ: 6.7, puckRadius: .17 });
/** Returns the closest valid point in the rounded NHL-size rink. */
export function inRink(x, z, margin = .45) {
    const a = RINK.halfLength - margin, b = RINK.halfWidth - margin, r = RINK.corner;
    x = clamp(x, -a, a);
    z = clamp(z, -b, b);
    const cx = a - r, cz = b - r, dx = Math.abs(x) - cx, dz = Math.abs(z) - cz;
    if (dx > 0 && dz > 0 && Math.hypot(dx, dz) > r) {
        const n = normal(dx, dz);
        x = Math.sign(x) * (cx + n.x * r);
        z = Math.sign(z) * (cz + n.z * r);
    }
    return { x, z };
}
export function segmentGoal(a, b, dir) {
    const line = (RINK.goal + RINK.puckRadius) * dir;
    if (a.x * dir >= line * dir || b.x * dir < line * dir)
        return false;
    const t = (line - a.x) / (b.x - a.x);
    const z = lerp(a.z, b.z, t), y = lerp(a.y, b.y, t);
    return Math.abs(z) < RINK.goalHalf - RINK.puckRadius && y < RINK.goalHeight - .08 && y >= 0;
}
/** Portrait view rotates the rink so skaters remain readable on touchscreens. */
export const portraitView = (width, height) => width < 650 && height > width * 1.3;
export const viewYaw = (width, height) => portraitView(width, height) ? 1.25 : .23;
