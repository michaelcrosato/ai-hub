// terrain-worker.js — builds terrain tiles off the main thread (a module worker).
import { TerrainField, buildChunk } from './terrain.js';

let field = null;

self.onmessage = ({ data }) => {
  const { id, seed, cx, cz, segments, props } = data;
  try {
    if (!field || field.seed !== seed) field = new TerrainField(seed);
    const tile = buildChunk(field, cx, cz, segments, props);
    self.postMessage({ id, data: tile }, [tile.positions.buffer, tile.colors.buffer, tile.normals.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
