/** Explicit ownership. Cleanup is idempotent, in reverse order, and best effort. */
export class Scope {
    abort = new AbortController();
    callbacks = [];
    get disposed() { return this.abort.signal.aborted; }
    own(cleanup) {
        if (this.disposed) {
            cleanup();
            return () => { };
        }
        let active = true;
        const once = () => { if (active) {
            active = false;
            cleanup();
        } };
        this.callbacks.push(once);
        return once;
    }
    listen(target, type, listener, options = {}) {
        if (this.disposed)
            return;
        target.addEventListener(type, listener, { ...options, signal: this.abort.signal });
    }
    dispose() {
        if (this.disposed)
            return;
        this.abort.abort();
        const errors = [];
        for (const cleanup of this.callbacks.reverse())
            try {
                cleanup();
            }
            catch (error) {
                errors.push(error);
            }
        this.callbacks = [];
        if (errors.length)
            throw new AggregateError(errors, 'Some episode resources could not be released.');
    }
}
