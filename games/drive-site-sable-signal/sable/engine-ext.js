/* Sable Signal: continuous projectile collision above the supplied engine.
 * This keeps E.Bullets.fire(), its pool, and its renderer. MIT.
 */
(function (E) {
  'use strict';
  function segmentBox(ax, ay, bx, by, x0, y0, x1, y1) {
    let lo = 0, hi = 1;
    const dx = bx - ax, dy = by - ay;
    for (const [a, d, min, max] of [[ax, dx, x0, x1], [ay, dy, y0, y1]]) {
      if (Math.abs(d) < 1e-9) { if (a < min || a > max) return Infinity; }
      else { let p = (min - a) / d, q = (max - a) / d; if (p > q) [p, q] = [q, p]; lo = Math.max(lo, p); hi = Math.min(hi, q); if (lo > hi) return Infinity; }
    }
    return lo;
  }
  function segmentCircle(ax, ay, bx, by, cx, cy, radius) {
    const dx = bx - ax, dy = by - ay, ox = ax - cx, oy = ay - cy;
    const c = ox * ox + oy * oy - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy;
    if (a < 1e-12) return Infinity;
    const b = ox * dx + oy * dy, d = b * b - a * c;
    if (d < 0) return Infinity;
    const t = (-b - Math.sqrt(d)) / a;
    return t >= 0 && t <= 1 ? t : Infinity;
  }
  function rayMap(map, ax, ay, bx, by, radius = 0) {
    const T = map.T; let nearest = Infinity;
    const x0 = Math.floor((Math.min(ax, bx) - radius) / T), x1 = Math.floor((Math.max(ax, bx) + radius) / T);
    const y0 = Math.floor((Math.min(ay, by) - radius) / T), y1 = Math.floor((Math.max(ay, by) + radius) / T);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (map.walkable(x, y)) continue;
      nearest = Math.min(nearest, segmentBox(ax, ay, bx, by, x * T - radius, y * T - radius, (x + 1) * T + radius, (y + 1) * T + radius));
    }
    return nearest;
  }
  class SweptBullets extends E.Bullets {
    updateCombat(dt, map, targets, hit, wall, enemyScale = 1) {
      for (const b of this.list) {
        if (b.dead) continue;
        const step = dt * (b.team === 'enemy' ? enemyScale : 1);
        b.t += step;
        if (b.t >= b.life) { b.dead = true; if (b.kind === 'throw') wall(b); continue; }
        const ax = b.x, ay = b.y, bx = ax + b.vx * step, by = ay + b.vy * step;
        b.px = ax; b.py = ay;
        let first = rayMap(map, ax, ay, bx, by, b.r), actor = null;
        for (const target of targets) {
          if (!target.alive || target.team === b.team || target === b.owner) continue;
          const t = segmentCircle(ax, ay, bx, by, target.x, target.y, b.r + target.r);
          if (t < first) { first = t; actor = target; }
        }
        if (first <= 1) {
          b.x = ax + (bx - ax) * Math.max(0, first - .002); b.y = ay + (by - ay) * Math.max(0, first - .002);
          b.dead = true; if (actor) hit(b, actor); else wall(b);
        } else { b.x = bx; b.y = by; }
      }
      this.list = this.list.filter(b => !b.dead);
    }
  }
  E.Sweep = { segmentBox, segmentCircle, rayMap };
  E.SweptBullets = SweptBullets;
})(My3D2dge);
