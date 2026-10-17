// Engine extension: shape collision, visibility and AI navigation share the same solid geometry.
const E = globalThis.My3D2dge;
export class DistrictMap extends E.TileMap {
  ray(a, b, o = {}) {
    let result = super.ray(a, b, o);
    const z0 = (a.z || 0) + (o.eye || 0),
      z1 = (b.z || 0) + (o.target || 0);
    for (const s of this.solids || []) {
      const local = (p) => [
        (p.x - s.x) * s.c + (p.y - s.y) * s.s,
        -(p.x - s.x) * s.s + (p.y - s.y) * s.c,
      ];
      const aa = local(a),
        bb = local(b);
      // An interactable can be queried at its own center (terminals/vehicles).
      if (Math.abs(bb[0]) <= s.hx && Math.abs(bb[1]) <= s.hy) continue;
      const origin = [aa[0], aa[1], z0],
        delta = [bb[0] - aa[0], bb[1] - aa[1], z1 - z0];
      const lo = [-s.hx, -s.hy, s.z],
        hi = [s.hx, s.hy, s.top];
      let enter = 0,
        leave = 1;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(delta[k]) < 1e-8) {
          if (origin[k] < lo[k] || origin[k] > hi[k]) {
            enter = 2;
            break;
          }
        } else {
          let t0 = (lo[k] - origin[k]) / delta[k],
            t1 = (hi[k] - origin[k]) / delta[k];
          if (t0 > t1) [t0, t1] = [t1, t0];
          enter = Math.max(enter, t0);
          leave = Math.min(leave, t1);
        }
      }
      if (enter <= leave && enter < result.t)
        result = {
          clear: false,
          t: enter,
          x: a.x + (b.x - a.x) * enter,
          y: a.y + (b.y - a.y) * enter,
          z: z0 + (z1 - z0) * enter,
          shape: s.shape,
        };
    }
    return result;
  }
}
export class DistrictNavigation extends E.FlowField {
  _top(cx, cy) {
    const height = super._top(cx, cy);
    if (height !== 0) return height;
    const [x, y] = this.map.center(cx, cy);
    return this.map.heightAt(x, y) > 2 ? NaN : 0;
  }
}
