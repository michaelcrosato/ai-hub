import { PALETTE } from './palette.js';
import { index3 } from './world.js';
import { LIMITS } from '../engine/config.js';

/** Six-neighbour connectivity. It models attachment, not material stress. */
export function findUnsupported({ data, dims, origin }, options = {}) {
  const [nx, ny, nz] = dims, length = data.length;
  if (!length) return [];
  const maxCells = options.maxCells ?? LIMITS.maxFragmentCells;
  const maxSpan = options.maxSpan ?? LIMITS.maxFragmentSpan;
  if (maxCells < 1 || maxSpan < 1) throw new RangeError('Fragment limits must be positive.');
  const state = new Uint8Array(length), queue = new Uint32Array(length), plane = nx * ny;
  const neighbours = i => {
    const x = i % nx, y = Math.floor(i / nx) % ny, z = Math.floor(i / plane), result = [];
    if (x) result.push(i - 1); if (x + 1 < nx) result.push(i + 1);
    if (y) result.push(i - nx); if (y + 1 < ny) result.push(i + nx);
    if (z) result.push(i - plane); if (z + 1 < nz) result.push(i + plane);
    return result;
  };
  const decode = i => [i % nx, Math.floor(i / nx) % ny, Math.floor(i / plane)];
  let head = 0, tail = 0;
  // Foundation cells are the only anchors. A floating chunk is not an anchor.
  for (let i = 0; i < length; i++) if (data[i] && PALETTE[data[i]]?.anchor) {
    state[i] = 1; queue[tail++] = i;
  }
  while (head < tail) for (const n of neighbours(queue[head++])) if (data[n] && !state[n]) {
    state[n] = 1; queue[tail++] = n;
  }
  const fragments = [];
  for (let seed = 0; seed < length; seed++) {
    if (!data[seed] || state[seed]) continue;
    head = 0; tail = 1; queue[0] = seed; state[seed] = 2;
    const min = decode(seed), max = min.slice();
    while (head < tail) {
      const i = queue[head++];
      for (const n of neighbours(i)) {
        if (!data[n] || state[n] || tail >= maxCells) continue;
        const p = decode(n);
        if (p.some((v, d) => Math.max(max[d], v) - Math.min(min[d], v) + 1 > maxSpan)) continue;
        p.forEach((v, d) => { min[d] = Math.min(min[d], v); max[d] = Math.max(max[d], v); });
        state[n] = 2; queue[tail++] = n;
      }
    }
    const size = max.map((v, d) => v - min[d] + 1), cells = new Uint8Array(size[0] * size[1] * size[2]);
    for (let i = 0; i < tail; i++) {
      const p = decode(queue[i]);
      cells[index3(p[0] - min[0], p[1] - min[1], p[2] - min[2], size[0], size[1])] = data[queue[i]];
    }
    fragments.push({ origin: min.map((v, d) => v + origin[d]), dims: size, data: cells, count: tail });
  }
  return fragments;
}

/** Exact support across sparse chunks. Empty space between islands needs no buffer. */
export function findUnsupportedSparse(snapshot, options = {}) {
  const { chunkSize: n, chunks } = snapshot;
  if (!Number.isInteger(n) || n < 1 || n > 64 || !Array.isArray(chunks)) throw new TypeError('Invalid sparse snapshot.');
  const volume = n ** 3, plane = n * n, length = chunks.length * volume;
  if (length > 0x7fffffff) throw new RangeError('Sparse support IDs exceed the signed 32-bit range.');
  const maxCells = options.maxCells ?? LIMITS.maxFragmentCells, maxSpan = options.maxSpan ?? LIMITS.maxFragmentSpan;
  if (!Number.isInteger(maxCells) || maxCells < 1 || !Number.isInteger(maxSpan) || maxSpan < 1)
    throw new RangeError('Fragment limits must be positive integers.');
  if (!chunks.length) return [];
  const lookup = new Map(); let occupied = 0;
  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    if (!(chunk.data instanceof Uint8Array) || chunk.data.length !== volume ||
      !Array.isArray(chunk.coord) || chunk.coord.length !== 3 || !chunk.coord.every(Number.isSafeInteger))
      throw new TypeError('Invalid support chunk.');
    const key = chunk.coord.join(',');
    if (lookup.has(key)) throw new TypeError('Duplicate support chunk.');
    lookup.set(key, c);
    for (const value of chunk.data) if (value) occupied++;
  }
  if (!occupied) return [];
  // Queue entries are integer IDs. No per-cell coordinate objects are retained.
  const states = chunks.map(() => new Uint8Array(volume)), queue = new Uint32Array(occupied);
  const adjacency = new Int32Array(chunks.length * 6).fill(-1);
  const directions = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
  chunks.forEach((chunk, c) => directions.forEach((offset, side) => {
    const coord = chunk.coord.map((value, d) => value + offset[d]);
    adjacency[c * 6 + side] = lookup.get(coord.join(',')) ?? -1;
  }));
  const neighbours = new Int32Array(6);
  function getNeighbours(id) {
    const c = Math.floor(id / volume), i = id % volume;
    const x = i % n, y = Math.floor(i / n) % n, z = Math.floor(i / plane), base = c * 6;
    neighbours[0] = x ? id - 1 : adjacency[base] < 0 ? -1 : adjacency[base] * volume + i + n - 1;
    neighbours[1] = x + 1 < n ? id + 1 : adjacency[base + 1] < 0 ? -1 : adjacency[base + 1] * volume + i - n + 1;
    neighbours[2] = y ? id - n : adjacency[base + 2] < 0 ? -1 : adjacency[base + 2] * volume + i + n * (n - 1);
    neighbours[3] = y + 1 < n ? id + n : adjacency[base + 3] < 0 ? -1 : adjacency[base + 3] * volume + i - n * (n - 1);
    neighbours[4] = z ? id - plane : adjacency[base + 4] < 0 ? -1 : adjacency[base + 4] * volume + i + plane * (n - 1);
    neighbours[5] = z + 1 < n ? id + plane : adjacency[base + 5] < 0 ? -1 : adjacency[base + 5] * volume + i - plane * (n - 1);
  }
  function decode(id) {
    const c = Math.floor(id / volume), i = id % volume, coord = chunks[c].coord;
    return [coord[0] * n + i % n, coord[1] * n + Math.floor(i / n) % n, coord[2] * n + Math.floor(i / plane)];
  }
  let head = 0, tail = 0;
  for (let c = 0; c < chunks.length; c++) for (let i = 0; i < volume; i++) {
    if (PALETTE[chunks[c].data[i]]?.anchor) { states[c][i] = 1; queue[tail++] = c * volume + i; }
  }
  while (head < tail) {
    getNeighbours(queue[head++]);
    for (const id of neighbours) {
      if (id < 0) continue;
      const c = Math.floor(id / volume), i = id % volume;
      if (chunks[c].data[i] && !states[c][i]) { states[c][i] = 1; queue[tail++] = id; }
    }
  }
  const fragments = [];
  for (let c = 0; c < chunks.length; c++) for (let i = 0; i < volume; i++) {
    if (!chunks[c].data[i] || states[c][i]) continue;
    const seed = c * volume + i, min = decode(seed), max = min.slice();
    head = 0; tail = 1; queue[0] = seed; states[c][i] = 2;
    while (head < tail) {
      getNeighbours(queue[head++]);
      for (const id of neighbours) {
        if (id < 0 || tail >= maxCells) continue;
        const nc = Math.floor(id / volume), ni = id % volume;
        if (!chunks[nc].data[ni] || states[nc][ni]) continue;
        const p = decode(id);
        if (p.some((value, d) => Math.max(max[d], value) - Math.min(min[d], value) + 1 > maxSpan)) continue;
        p.forEach((value, d) => { min[d] = Math.min(min[d], value); max[d] = Math.max(max[d], value); });
        states[nc][ni] = 2; queue[tail++] = id;
      }
    }
    const dims = max.map((value, d) => value - min[d] + 1), data = new Uint8Array(dims[0] * dims[1] * dims[2]);
    for (let j = 0; j < tail; j++) {
      const id = queue[j], p = decode(id);
      data[index3(p[0] - min[0], p[1] - min[1], p[2] - min[2], dims[0], dims[1])] = chunks[Math.floor(id / volume)].data[id % volume];
    }
    fragments.push({ origin: min, dims, data, count: tail });
  }
  return fragments;
}
