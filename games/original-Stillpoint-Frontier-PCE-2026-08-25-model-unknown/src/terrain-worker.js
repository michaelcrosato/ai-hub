/**
 * terrain-worker.js — builds terrain chunks and the horizon ring off the main
 * thread. Workers do not see the page's import map, so this file (and
 * terrain.js) only use relative imports and no three.js.
 */
import { TerrainField, buildChunkTerrain, buildChunkProps, buildDistantTerrain } from './terrain.js';

let field = null;

const collect = (mesh, transfer) => {
  if (!mesh) return;
  transfer.push(mesh.positions.buffer, mesh.normals.buffer);
  if (mesh.colors) transfer.push(mesh.colors.buffer);
};

self.onmessage = (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === 'init') {
      field = new TerrainField(msg.options);
      return;
    }
    if (!field) throw new Error('Terrain worker used before init.');
    if (msg.type === 'chunk') {
      const terrain = buildChunkTerrain(field, msg.x, msg.z);
      const props = buildChunkProps(field, msg.x, msg.z);
      const transfer = [];
      collect(terrain, transfer);
      collect(props.rocks, transfer);
      collect(props.foliage, transfer);
      self.postMessage({ type: 'chunk', key: msg.key, x: msg.x, z: msg.z, terrain, rocks: props.rocks, foliage: props.foliage }, transfer);
    } else if (msg.type === 'distant') {
      const mesh = buildDistantTerrain(field, msg.centerX, msg.centerZ, msg.inner, msg.outer);
      const transfer = [];
      collect(mesh, transfer);
      self.postMessage({ type: 'distant', seq: msg.seq, centerX: msg.centerX, centerZ: msg.centerZ, mesh }, transfer);
    }
  } catch (err) {
    self.postMessage({ type: 'error', request: msg.type, key: msg.key ?? null, seq: msg.seq ?? null, message: String(err?.message || err) });
  }
};
