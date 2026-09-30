export class Store {
  available = true;
  memory = new Map();
  get(key, fallback = null) {
    try {
      const s = localStorage.getItem(`strata.v2.${key}`);
      if (s) return JSON.parse(s);
    } catch {
      this.available = false;
    }
    return this.memory.has(key) ? structuredClone(this.memory.get(key)) : fallback;
  }
  set(key, value) {
    this.memory.set(key, structuredClone(value));
    try {
      localStorage.setItem(`strata.v2.${key}`, JSON.stringify(value));
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }
  remove(key) {
    this.memory.delete(key);
    try {
      localStorage.removeItem(`strata.v2.${key}`);
    } catch {
      this.available = false;
    }
  }
}
