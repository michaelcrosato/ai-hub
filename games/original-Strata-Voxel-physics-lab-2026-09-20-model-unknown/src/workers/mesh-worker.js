import { runJob, transferBuffers } from './jobs.js';
self.onmessage = ({ data: { id, type, payload } }) => {
  try {
    const value = runJob(type, payload);
    self.postMessage({ id, value }, transferBuffers(value));
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
};
