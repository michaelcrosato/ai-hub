// Each experience owns a scope. Cleanup is idempotent and continues after an individual failure.
export class Scope {
  cleanups = [];
  disposed = false;
  abort = new AbortController();
  own(cleanup) {
    if (typeof cleanup !== 'function') throw Error('Cleanup must be a function.');
    if (this.disposed) cleanup();
    else this.cleanups.push(cleanup);
    return cleanup;
  }
  on(target, event, callback, options = {}) {
    target.addEventListener(event, callback, { ...options, signal: this.abort.signal });
    return callback;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    const errors = [];
    for (const f of this.cleanups.reverse())
      try {
        f();
      } catch (e) {
        errors.push(e);
      }
    this.cleanups = [];
    if (errors.length) console.error('Resource cleanup errors:', errors);
  }
}
