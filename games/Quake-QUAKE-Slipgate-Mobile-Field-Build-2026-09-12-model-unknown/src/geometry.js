// Plain-array geometry: the world builder, the models and the BSP reader all produce this,
// and view.js turns it into three.js buffers.
import { normalize, cross, sub, transformPoint, compose } from './math.js';

export function geometry() {
  return { positions: [], normals: [], uvs: [], colors: [] };
}

export function triangle(g, a, b, c, uv = [[0, 0], [1, 0], [1, 1]], color = [1, 1, 1], normal) {
  const n = normal || normalize(cross(sub(b, a), sub(c, a)));
  const pts = [a, b, c];
  for (let i = 0; i < 3; i++) {
    g.positions.push(pts[i][0], pts[i][1], pts[i][2]);
    g.normals.push(n[0], n[1], n[2]);
    g.uvs.push(uv[i][0], uv[i][1]);
    g.colors.push(color[0], color[1], color[2]);
  }
}

export function quad(g, a, b, c, d, uvScale = [1, 1], color = [1, 1, 1]) {
  const u = uvScale[0];
  const v = uvScale[1];
  triangle(g, a, b, c, [[0, 0], [u, 0], [u, v]], color);
  triangle(g, a, c, d, [[0, 0], [u, v], [0, v]], color);
}

export function boxGeometry(size = [1, 1, 1]) {
  const g = geometry();
  const [x, y, z] = size.map((v) => v / 2);
  quad(g, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [size[0] / 3, size[1] / 3]);
  quad(g, [x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [size[0] / 3, size[1] / 3]);
  quad(g, [x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [size[2] / 3, size[1] / 3]);
  quad(g, [-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [size[2] / 3, size[1] / 3]);
  quad(g, [-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [size[0] / 3, size[2] / 3]);
  quad(g, [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [size[0] / 3, size[2] / 3]);
  return g;
}

/** r at the bottom (-h/2), r2 at the top (+h/2). */
export function cylinderGeometry(r = 1, h = 1, segments = 12, r2 = r) {
  const g = geometry();
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    const p = [Math.cos(a) * r, -h / 2, Math.sin(a) * r];
    const q = [Math.cos(b) * r, -h / 2, Math.sin(b) * r];
    const s = [Math.cos(a) * r2, h / 2, Math.sin(a) * r2];
    const t = [Math.cos(b) * r2, h / 2, Math.sin(b) * r2];
    quad(g, q, p, s, t);
    triangle(g, [0, h / 2, 0], t, s);
    triangle(g, [0, -h / 2, 0], p, q);
  }
  return g;
}

export function octahedronGeometry(r = 1) {
  const g = geometry();
  const v = [[r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r]];
  for (let i = 0; i < 4; i++) {
    triangle(g, [0, r, 0], v[(i + 1) % 4], v[i]);
    triangle(g, [0, -r, 0], v[i], v[(i + 1) % 4]);
  }
  return g;
}

export function ringGeometry(r = 2, t = 0.2, segments = 40) {
  const g = geometry();
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    quad(
      g,
      [Math.cos(a) * (r - t), Math.sin(a) * (r - t), 0],
      [Math.cos(a) * (r + t), Math.sin(a) * (r + t), 0],
      [Math.cos(b) * (r + t), Math.sin(b) * (r + t), 0],
      [Math.cos(b) * (r - t), Math.sin(b) * (r - t), 0]
    );
  }
  return g;
}

export function appendGeometry(target, source, pos = [0, 0, 0], rot = [0, 0, 0], color = [1, 1, 1], s = [1, 1, 1]) {
  const m = compose(pos, rot, s);
  const n = compose([0, 0, 0], rot, s.map((x) => 1 / x));
  const P = source.positions;
  const N = source.normals;
  const C = source.colors;
  for (let i = 0; i < P.length; i += 3) {
    const p = transformPoint(m, [P[i], P[i + 1], P[i + 2]]);
    const q = normalize(transformPoint(n, [N[i], N[i + 1], N[i + 2]]));
    target.positions.push(p[0], p[1], p[2]);
    target.normals.push(q[0], q[1], q[2]);
    target.colors.push(C[i] * color[0], C[i + 1] * color[1], C[i + 2] * color[2]);
  }
  for (let i = 0; i < source.uvs.length; i++) target.uvs.push(source.uvs[i]);
  return target;
}

export function mergeParts(parts) {
  const g = geometry();
  for (const p of parts) appendGeometry(g, p.g, p.pos, p.rot, p.color, p.scale);
  return g;
}
