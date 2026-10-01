// tile-worker.js — builds terrain tiles off the main thread. A module worker that
// shares worldgen.js with the main thread, so there is one copy of the terrain code.
import { generateTile, TILE_BUFFERS } from './worldgen.js';

let templates = null;

self.onmessage = (event) => {
  const msg = event.data;
  if (msg.templates) {
    templates = msg.templates;
    return;
  }
  const task = msg.task;
  try {
    const data = generateTile(msg.job, templates);
    self.postMessage({ task, data }, TILE_BUFFERS.map((k) => data[k].buffer));
  } catch (error) {
    self.postMessage({ task, error: String(error?.message || error) });
  }
};
