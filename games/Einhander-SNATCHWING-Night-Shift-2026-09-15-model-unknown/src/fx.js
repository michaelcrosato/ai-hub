// GPU effects: every glow, tracer, spark, ring, beam and rain streak the old Canvas2D
// overlay drew, now drawn by three.js as instanced quads. One quad shape per instance:
//   0 solid (lines, debris; optional dashes along its length)
//   1 glow  (the original radial sprite: 0.9 → 0.5 → 0.16 → 0 alpha)
//   2 ring  (a disc, a ring stroke, or a dashed ring; anti-aliased with fwidth)
//   3 cone  (a searchlight wedge that fades from its apex)
// Batches share two materials (normal and additive blending), so the whole layer
// compiles two shader programs. Effects draw over the scene without depth testing,
// exactly like the overlay canvas did, in batch order (renderOrder).

import * as THREE from 'three/webgpu';
import { attribute, positionLocal, uv, vec3, vec4, float, cos, sin, mix, smoothstep, fwidth, fract, floor, step, abs, atan } from 'three/tsl';
import { rgb, TAU } from './util.js';

const GLOW = 1;
const RING = 2;
const CONE = 3;

export function fxMaterial(additive) {
  const m = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  m.fog = false;
  m.name = additive ? 'fx-add' : 'fx';
  const A = attribute('iA', 'vec4'); // x, y, z, rotation
  const B = attribute('iB', 'vec4'); // width, height, shape, param
  const K = attribute('iC', 'vec4'); // r, g, b, alpha
  const q = positionLocal.xy.mul(B.xy);
  const cs = cos(A.w);
  const sn = sin(A.w);
  m.positionNode = vec3(A.x.add(q.x.mul(cs)).sub(q.y.mul(sn)), A.y.add(q.x.mul(sn)).add(q.y.mul(cs)), A.z);

  const t = uv();
  const p = t.sub(0.5);
  const d = p.length().mul(2); // 0 at the centre, 1 at the quad's inscribed circle
  const shape = B.z;
  const param = B.w;

  // Everything below is branch-free (step/mix weights, no select): in r186 select() emits
  // real if/else blocks, and WGSL rejects fwidth inside control flow that depends on a
  // varying, so the whole layer would fail to compile on WebGPU.
  const on = (edge, x) => step(edge, x); // 1 when x >= edge

  // Solid quad, dashed when param > 0 (param = dash periods along its length, 11 on / 8 off).
  const dashX = mix(float(1), step(fract(t.x.mul(param)), float(11 / 19)), on(0.5, param));
  // The original glow sprite's gradient stops (0.9, 0.5, 0.16, 0 at d = 0, .15, .4, 1) as a
  // sum of clamped segments: each one sits at its end value outside its own range.
  const seg = (a, b, d0, d1) => mix(float(a), float(b), d.sub(d0).div(d1 - d0).clamp(0, 1));
  const glow = seg(0.9, 0.5, 0, 0.15).add(seg(0.5, 0.16, 0.15, 0.4)).add(seg(0.16, 0, 0.4, 1)).sub(0.66);
  // Ring: param = dashes + inner radius fraction (inner 0 = filled disc).
  const aa = fwidth(d).max(0.0005);
  const inner = fract(param);
  const dashes = floor(param);
  const outerA = float(1).sub(smoothstep(float(1).sub(aa), float(1), d));
  const innerA = mix(float(1), smoothstep(inner.sub(aa), inner, d), on(0.001, inner));
  const ang = atan(p.y, p.x).div(TAU).add(0.5);
  const dashR = mix(float(1), step(fract(ang.mul(dashes)), float(0.55)), on(0.5, dashes));
  const ring = outerA.mul(innerA).mul(dashR);
  // Cone: apex at v = 0, widening to the full quad width at v = 1.
  const cone = step(abs(t.x.sub(0.5)).mul(2), t.y).mul(float(1).sub(t.y));

  // Shape weights: exactly one of these is 1 for shape 0, 1, 2 or 3.
  const w0 = float(1).sub(on(0.5, shape));
  const w1 = on(0.5, shape).sub(on(1.5, shape));
  const w2 = on(1.5, shape).sub(on(2.5, shape));
  const w3 = on(2.5, shape);
  const shapeA = dashX.mul(w0).add(glow.mul(w1)).add(ring.mul(w2)).add(cone.mul(w3));
  m.colorNode = vec4(K.xyz, K.w.mul(shapeA));
  return m;
}

/** A growable list of effect quads drawn as one instanced mesh. */
export class FxBatch {
  constructor(material, capacity, renderOrder) {
    this.cap = capacity;
    this.n = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const make = (name) => {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      attr.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, attr);
      return attr;
    };
    this.A = make('iA');
    this.B = make('iB');
    this.K = make('iC');
    this.a = this.A.array;
    this.b = this.B.array;
    this.k = this.K.array;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.count = 0;
    this.mesh.name = 'fx';
  }
  begin() {
    this.n = 0;
  }
  push(x, y, z, rot, w, h, shape, param, color, alpha) {
    if (this.n >= this.cap || !(alpha > 0.002) || !(w > 0) || !(h > 0)) return;
    const i = this.n * 4;
    const c = rgb(color);
    this.a[i] = x;
    this.a[i + 1] = y;
    this.a[i + 2] = z;
    this.a[i + 3] = rot;
    this.b[i] = w;
    this.b[i + 1] = h;
    this.b[i + 2] = shape;
    this.b[i + 3] = param;
    this.k[i] = c[0];
    this.k[i + 1] = c[1];
    this.k[i + 2] = c[2];
    this.k[i + 3] = Math.min(1, alpha);
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    if (!this.n) return;
    for (const attr of [this.A, this.B, this.K]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.n * 4);
      attr.needsUpdate = true;
    }
  }

  // ---- shapes (sizes in world units)
  glow(x, y, z, r, color, alpha = 1) {
    if (r > 0) this.push(x, y, z, 0, r * 2, r * 2, GLOW, 0, color, alpha);
  }
  /** A tracer or stroke from (x1, y1) to (x2, y2), `width` wide. dashes = dash periods along it. */
  line(x1, y1, x2, y2, z, width, color, alpha = 1, dashes = 0) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-5) return;
    this.push((x1 + x2) / 2, (y1 + y2) / 2, z, Math.atan2(dy, dx), len, width, 0, dashes, color, alpha);
  }
  rect(x, y, z, w, h, rot, color, alpha = 1) {
    this.push(x, y, z, rot, w, h, 0, 0, color, alpha);
  }
  disc(x, y, z, r, color, alpha = 1) {
    if (r > 0) this.push(x, y, z, 0, r * 2, r * 2, RING, 0, color, alpha);
  }
  /** A ring stroke of radius r and stroke width `width`; dashes > 0 breaks it into dashes. */
  ring(x, y, z, r, width, color, alpha = 1, dashes = 0) {
    const outer = r + width / 2;
    if (!(outer > 0)) return;
    const inner = Math.min(0.995, Math.max(0.002, (r - width / 2) / outer));
    this.push(x, y, z, 0, outer * 2, outer * 2, RING, Math.round(dashes) + inner, color, alpha);
  }
  /** A searchlight wedge from apex (ax, ay) to a far edge centred on (bx, by), `half` wide each side. */
  cone(ax, ay, bx, by, z, half, color, alpha = 1) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-5) return;
    this.push((ax + bx) / 2, (ay + by) / 2, z, Math.atan2(dy, dx) - Math.PI / 2, half * 2, len, CONE, 0, color, alpha);
  }
}
