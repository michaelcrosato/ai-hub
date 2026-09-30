// Small local primitives. No remote models or textures are required by the experiences.
function triangle(
  out,
  a,
  b,
  c,
  normal = null,
  uvs = [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
) {
  const u = b.map((v, i) => v - a[i]),
    v = c.map((x, i) => x - a[i]);
  const n = normal || [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(...n) || 1;
  for (const [i, p] of [a, b, c].entries()) out.push(...p, ...n.map((x) => x / len), ...uvs[i]);
}
export function geometry(type) {
  const a = [];
  if (type === 'shard') {
    triangle(a, [-0.5, -0.5, 0], [0.5, -0.28, 0], [0.14, 0.5, 0]);
  } else if (type === 'box' || type === 'plane') {
    const faces = [
      [
        [0.5, -0.5, -0.5],
        [0.5, 0.5, -0.5],
        [0.5, 0.5, 0.5],
        [0.5, -0.5, 0.5],
      ],
      [
        [-0.5, -0.5, 0.5],
        [-0.5, 0.5, 0.5],
        [-0.5, 0.5, -0.5],
        [-0.5, -0.5, -0.5],
      ],
      [
        [-0.5, 0.5, -0.5],
        [-0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5],
        [0.5, 0.5, -0.5],
      ],
      [
        [-0.5, -0.5, 0.5],
        [-0.5, -0.5, -0.5],
        [0.5, -0.5, -0.5],
        [0.5, -0.5, 0.5],
      ],
      [
        [-0.5, -0.5, 0.5],
        [0.5, -0.5, 0.5],
        [0.5, 0.5, 0.5],
        [-0.5, 0.5, 0.5],
      ],
      [
        [0.5, -0.5, -0.5],
        [-0.5, -0.5, -0.5],
        [-0.5, 0.5, -0.5],
        [0.5, 0.5, -0.5],
      ],
    ];
    for (const q of type === 'plane' ? [faces[4]] : faces) {
      triangle(a, q[0], q[1], q[2]);
      triangle(a, q[0], q[2], q[3], null, [
        [0, 0],
        [1, 1],
        [0, 1],
      ]);
    }
  } else if (type === 'cylinder' || type === 'cone' || type === 'ring') {
    const n = type === 'ring' ? 32 : 10,
      top = type === 'cone' ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2,
        u = ((i + 1) / n) * Math.PI * 2,
        p = [Math.cos(t), -0.5, Math.sin(t)],
        q = [Math.cos(u), -0.5, Math.sin(u)],
        r = [top * Math.cos(u), 0.5, top * Math.sin(u)],
        s = [top * Math.cos(t), 0.5, top * Math.sin(t)];
      if (type === 'ring') {
        const inner = 0.9;
        triangle(a, [p[0], p[2], 0], [q[0], q[2], 0], [q[0] * inner, q[2] * inner, 0], [0, 0, 1]);
        triangle(a, [p[0], p[2], 0], [q[0] * inner, q[2] * inner, 0], [p[0] * inner, p[2] * inner, 0], [0, 0, 1]);
      } else {
        triangle(a, p, r, q);
        triangle(a, p, s, r);
        triangle(a, [0, -0.5, 0], p, q, [0, -1, 0]);
        if (top) triangle(a, [0, 0.5, 0], r, s, [0, 1, 0]);
      }
    }
  } else {
    const rings = type === 'rock' ? 3 : 7,
      segments = type === 'rock' ? 7 : 12;
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segments; i++) {
        const p = (ii, jj) => {
          const t = (ii / segments) * 2 * Math.PI,
            f = (jj / rings) * Math.PI;
          return [Math.sin(f) * Math.cos(t), Math.cos(f), Math.sin(f) * Math.sin(t)];
        };
        // Wound counter-clockwise from outside, so the face normals point out of the shape.
        // (The first release wound these inward, which lit rocks, heads and foliage from the wrong side.)
        triangle(a, p(i, j), p(i + 1, j + 1), p(i, j + 1));
        triangle(a, p(i, j), p(i + 1, j), p(i + 1, j + 1));
      }
  }
  return new Float32Array(a);
}

/** Split the interleaved [position, normal, uv] stream into separate arrays for three.js. */
export function splitGeometry(type) {
  const data = geometry(type),
    n = data.length / 8,
    position = new Float32Array(n * 3),
    normal = new Float32Array(n * 3),
    uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const o = i * 8;
    position[i * 3] = data[o];
    position[i * 3 + 1] = data[o + 1];
    position[i * 3 + 2] = data[o + 2];
    normal[i * 3] = data[o + 3];
    normal[i * 3 + 1] = data[o + 4];
    normal[i * 3 + 2] = data[o + 5];
    uv[i * 2] = data[o + 6];
    uv[i * 2 + 1] = data[o + 7];
  }
  return { position, normal, uv, count: n };
}
