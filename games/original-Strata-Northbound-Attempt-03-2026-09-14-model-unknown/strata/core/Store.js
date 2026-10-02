/**
 * Browser storage with an in-memory fallback. Every game on the wall shares one origin, and other
 * Strata builds used the same 'strata.v2.' keys, so this player keeps its settings, checkpoint,
 * unlocked chapters and records under its own prefix.
 */
const PREFIX = 'strata.northbound03.';
export class Store {
  available = true;
  memory = new Map();
  get(key, fallback = null) {
    try {
      const s = localStorage.getItem(PREFIX + key);
      if (s) return JSON.parse(s);
    } catch {
      this.available = false;
    }
    return this.memory.has(key) ? structuredClone(this.memory.get(key)) : fallback;
  }
  set(key, value) {
    this.memory.set(key, structuredClone(value));
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }
  remove(key) {
    this.memory.delete(key);
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      this.available = false;
    }
  }
}
