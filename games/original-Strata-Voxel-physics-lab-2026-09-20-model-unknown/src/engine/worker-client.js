import { runJob, transferBuffers } from '../workers/jobs.js';
/** One worker limits transient memory on phones. Each request has a timeout. */
export class WorkerClient {
  constructor() {
    this.pending = new Map(); this.nextId = 1; this.worker = null; this.failed = null;
    try {
      this.worker = new Worker(new URL('../workers/mesh-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        const request = this.pending.get(data.id); if (!request) return;
        clearTimeout(request.timer); this.pending.delete(data.id);
        if (data.error) request.reject(new Error(data.error)); else request.resolve(data.value);
      };
      this.worker.onerror = event => this.fail(new Error(event.message || 'Mesh worker failed.'));
      this.worker.onmessageerror = () => this.fail(new Error('Mesh worker returned invalid data.'));
    } catch { this.worker = null; }
  }
  run(type, payload) {
    if (this.failed) return Promise.reject(this.failed);
    if (!this.worker) return new Promise((resolve, reject) => setTimeout(() => {
      try { resolve(runJob(type, payload)); } catch (e) { reject(e); }
    }, 0));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => this.fail(new Error('Mesh worker timed out. Reload the scene.')), 60_000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type, payload }, transferBuffers(payload));
    });
  }
  fail(error) {
    this.failed = error;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear(); this.worker?.terminate(); this.worker = null;
  }
  dispose() { this.fail(new Error('Worker closed.')); }
}
