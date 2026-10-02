export function predict(point, weights) {
  return weights[0] * point.x + weights[1] * point.z + weights[2] >= 0 ? 1 : -1;
}
export function perceptronEpoch(points, weights, rate = 0.16) {
  const w = [...weights];
  let mistakes = 0;
  for (const p of points) {
    if (predict(p, w) !== p.label) {
      w[0] += rate * p.label * p.x;
      w[1] += rate * p.label * p.z;
      w[2] += rate * p.label;
      mistakes++;
    }
  }
  return { weights: w, mistakes };
}
export function dataset(xor = false) {
  if (xor) return [-1, 1].flatMap((x) => [-1, 1].map((z) => ({ x: x * 1.35, z: z * 1.35, label: x === z ? -1 : 1 })));
  return Array.from({ length: 24 }, (_, i) => {
    const label = i < 12 ? 1 : -1;
    return { x: label * (0.35 + (i % 4) * 0.4), z: ((Math.floor(i / 4) % 3) - 1) * 0.95 + Math.sin(i * 2.4) * 0.2, label };
  });
}
export const IMAGE = Array.from({ length: 7 }, (_, y) =>
  Array.from({ length: 7 }, (_, x) => (x >= 2 && x <= 4 && y >= 1 && y <= 5 ? 1 : 0)),
);
export const KERNELS = {
  vertical: [
    [-1, 0, 1],
    [-1, 0, 1],
    [-1, 0, 1],
  ],
  horizontal: [
    [-1, -1, -1],
    [0, 0, 0],
    [1, 1, 1],
  ],
  blur: [
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
  ],
};
export function convolution(image, kernel) {
  const rows = image.length - kernel.length + 1,
    cols = image[0].length - kernel[0].length + 1;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      kernel.reduce((sum, row, y) => sum + row.reduce((a, w, x) => a + w * image[r + y][c + x], 0), 0),
    ),
  );
}
export function attentionWeights(query, keys, temperature = 1, mask = () => false) {
  const logits = keys.map((k, i) =>
      mask(i) ? -Infinity : k.reduce((a, v, j) => a + v * query[j], 0) / Math.sqrt(query.length) / temperature,
    ),
    max = Math.max(...logits);
  if (!Number.isFinite(max)) return logits.map(() => 0);
  const exp = logits.map((v) => Math.exp(v - max)),
    total = exp.reduce((a, b) => a + b, 0);
  return exp.map((e) => e / total);
}
export function weightedValue(weights, values) {
  return values[0].map((_, j) => weights.reduce((sum, w, i) => sum + w * values[i][j], 0));
}
/* ---- Notebook 04: gradient descent on a squared-error surface (ADALINE, backpropagation). */
export const REGRESSION = { xs: [-1, -0.6, -0.2, 0.2, 0.6, 1], ys: [-0.42, -0.21, 0.18, 0.41, 0.83, 1.02] };
export function mseLoss(w, b, data = REGRESSION) {
  let sum = 0;
  for (let i = 0; i < data.xs.length; i++) {
    const e = w * data.xs[i] + b - data.ys[i];
    sum += e * e;
  }
  return sum / data.xs.length;
}
export function mseGradient(w, b, data = REGRESSION) {
  let gw = 0,
    gb = 0;
  for (let i = 0; i < data.xs.length; i++) {
    const e = w * data.xs[i] + b - data.ys[i];
    gw += e * data.xs[i];
    gb += e;
  }
  const n = data.xs.length;
  return { w: (2 * gw) / n, b: (2 * gb) / n };
}
/** The exact least-squares optimum, for the marker at the bottom of the valley. */
export function leastSquares(data = REGRESSION) {
  const n = data.xs.length,
    mx = data.xs.reduce((a, v) => a + v, 0) / n,
    my = data.ys.reduce((a, v) => a + v, 0) / n;
  let sxy = 0,
    sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (data.xs[i] - mx) * (data.ys[i] - my);
    sxx += (data.xs[i] - mx) ** 2;
  }
  const w = sxy / sxx;
  return { w, b: my - w * mx };
}
export function descend(w, b, rate, data = REGRESSION) {
  const g = mseGradient(w, b, data);
  return { w: w - rate * g.w, b: b - rate * g.b };
}

/* ---- Notebook 05: tabular Q-learning in a five-by-five grid world (Q-learning, learning from preferences). */
export const GRIDWORLD = {
  size: 5,
  start: [0, 4],
  goal: [4, 0],
  pits: [
    [2, 2],
    [3, 1],
    [1, 3],
  ],
  stepReward: -0.04,
  maxSteps: 50,
};
/** Actions: 0 up (toward row 0), 1 right, 2 down, 3 left. */
export const MOVES = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export const makeQ = (size = GRIDWORLD.size) => Array.from({ length: size * size }, () => [0, 0, 0, 0]);
const cellOf = ([c, r], size) => r * size + c;
export function cellKind(c, r, world = GRIDWORLD) {
  if (c === world.goal[0] && r === world.goal[1]) return "goal";
  if (world.pits.some(([pc, pr]) => pc === c && pr === r)) return "pit";
  return "floor";
}
export function greedy(values, rng = null) {
  const best = Math.max(...values);
  const ties = [];
  values.forEach((v, i) => {
    if (v >= best - 1e-9) ties.push(i);
  });
  return ties.length > 1 && rng ? ties[Math.floor(rng() * ties.length)] : ties[0];
}
/** One episode of epsilon-greedy Q-learning. Mutates Q; returns the path walked and the return earned. */
export function qEpisode(Q, { alpha = 0.5, gamma = 0.9, epsilon = 0.2 } = {}, rng = Math.random, world = GRIDWORLD) {
  let pos = [...world.start];
  const path = [[...pos]];
  let ret = 0,
    outcome = "timeout";
  for (let step = 0; step < world.maxSteps; step++) {
    const s = cellOf(pos, world.size);
    const a = rng() < epsilon ? Math.floor(rng() * 4) : greedy(Q[s], rng);
    const next = [
      Math.max(0, Math.min(world.size - 1, pos[0] + MOVES[a][0])),
      Math.max(0, Math.min(world.size - 1, pos[1] + MOVES[a][1])),
    ];
    const kind = cellKind(next[0], next[1], world);
    const reward = kind === "goal" ? 1 : kind === "pit" ? -1 : world.stepReward;
    const s2 = cellOf(next, world.size);
    const target = kind === "floor" ? reward + gamma * Math.max(...Q[s2]) : reward;
    Q[s][a] += alpha * (target - Q[s][a]);
    ret += reward;
    pos = next;
    path.push([...pos]);
    if (kind !== "floor") {
      outcome = kind;
      break;
    }
  }
  return { path, ret, outcome };
}
/** A small deterministic generator so a notebook replays the same way after Reset. */
export function seededRandom(seed = 7) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
