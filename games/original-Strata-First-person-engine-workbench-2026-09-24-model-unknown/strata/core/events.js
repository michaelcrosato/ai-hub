/** Typed, synchronous engine events. Snapshot listeners so removal is safe during dispatch. */
export class Events {
    listeners = new Map();
    on(type, callback) {
        let set = this.listeners.get(type);
        if (!set)
            this.listeners.set(type, set = new Set());
        set.add(callback);
        return () => { set.delete(callback); };
    }
    emit(type, value) {
        for (const callback of [...(this.listeners.get(type) ?? [])])
            callback(value);
    }
    clear() { this.listeners.clear(); }
}
/** Level signals are queued. A bad feedback loop cannot overflow the call stack. */
export class Signals {
    queue = [];
    listeners = new Map();
    values = new Map();
    on(channel, callback) {
        let set = this.listeners.get(channel);
        if (!set)
            this.listeners.set(channel, set = new Set());
        set.add(callback);
        return () => { set.delete(callback); };
    }
    send(channel, value = true, source = 'level') {
        if (!channel.trim())
            return;
        if (this.queue.length >= 4096)
            throw new Error('Signal queue limit exceeded. Check the level rules.');
        this.queue.push({ channel, value, source });
    }
    flush(limit = 256) {
        let count = 0;
        while (this.queue.length) {
            if (count >= limit) {
                this.queue.length = 0;
                throw new Error('Signal limit exceeded. Check for a cycle or too many events.');
            }
            const signal = this.queue.shift();
            this.values.set(signal.channel, signal.value);
            for (const listener of [...(this.listeners.get(signal.channel) ?? [])])
                listener(signal);
            count++;
        }
        return count;
    }
    clear() { this.queue.length = 0; this.listeners.clear(); this.values.clear(); }
}
