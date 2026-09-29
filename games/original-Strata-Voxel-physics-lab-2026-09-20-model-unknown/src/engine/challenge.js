const BEST_KEY = 'strata:lamp-hunt:v1';

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Lamp hunt: put out every amber emitter in the area with as few tool uses as possible.
 * The clock starts on the first tool use and only runs while the lab is live.
 * Best results are kept per area (fewest actions, then fastest time).
 */
export class LampHunt {
  constructor(storage) {
    this.storage = storage;
    try { this.best = JSON.parse(storage?.getItem(BEST_KEY) || '{}') || {}; } catch { this.best = {}; }
    this.reset(null, 0);
  }
  reset(area, total) {
    this.area = area; this.total = total; this.lit = total; this.actions = 0; this.seconds = 0;
    this.started = false; this.done = false; this.newBest = false;
  }
  get active() { return this.total > 0 && !this.done; }
  action() { if (!this.active) return; this.started = true; this.actions++; }
  tick(dt) { if (this.started && !this.done) this.seconds += dt; }
  /** Report the lamps still lit. Returns true once, when the last one goes out. */
  update(lit) {
    this.lit = lit;
    if (this.done || !this.total || lit > 0) return false;
    this.done = true;
    const previous = this.best[this.area];
    this.newBest = !previous || this.actions < previous.actions || (this.actions === previous.actions && this.seconds < previous.seconds);
    if (this.newBest) {
      this.best[this.area] = { actions: this.actions, seconds: Math.round(this.seconds * 10) / 10, date: new Date().toISOString().slice(0, 10) };
      try { this.storage?.setItem(BEST_KEY, JSON.stringify(this.best)); } catch { /* private mode */ }
    }
    return true;
  }
  bestFor(area = this.area) { return this.best[area] || null; }
  bestText(area = this.area) {
    const best = this.bestFor(area);
    return best ? `${best.actions} action${best.actions === 1 ? '' : 's'} · ${formatTime(best.seconds)}` : '—';
  }
}
