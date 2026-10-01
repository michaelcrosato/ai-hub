/** Best times per episode, kept in this browser (separate from the run, so a new run keeps them). */
const KEY = 'strata.best.v1';

function read() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
        return raw && typeof raw === 'object' ? raw : {};
    }
    catch {
        return {};
    }
}

export function bestTime(id) {
    const v = read()[id];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** Record a finish. Returns { best, isNew } (best is the record after this run). */
export function submitTime(id, seconds) {
    const all = read(), old = bestTime(id);
    if (!(seconds > 0) || !Number.isFinite(seconds))
        return { best: old, isNew: false };
    if (old !== null && old <= seconds)
        return { best: old, isNew: false };
    all[id] = Math.round(seconds * 100) / 100;
    try {
        localStorage.setItem(KEY, JSON.stringify(all));
    }
    catch {
        /* the record still shows for this run */
    }
    return { best: all[id], isNew: true };
}

export function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0)
        return '--:--';
    const m = Math.floor(seconds / 60), s = seconds - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
