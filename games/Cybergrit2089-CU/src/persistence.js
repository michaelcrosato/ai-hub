import { ID } from "./data.js";
import { LEVELS } from "./level.js";
const VERSION = 1;
export class SaveStore {
  constructor(storage) {
    this.error = null;
    try {
      this.storage = storage ?? globalThis.localStorage;
    } catch {
      this.storage = null;
      this.error = "Storage is unavailable. This run continues without saving.";
    }
  }
  read() {
    try {
      const raw = this.storage?.getItem(ID + ":save");
      if (!raw) return null;
      const d = JSON.parse(raw);
      const level = LEVELS[d.level];
      if (
        d.version !== VERSION ||
        !level ||
        !d.player ||
        !Array.isArray(d.enemies) ||
        !Number.isInteger(d.stage) ||
        d.stage < 0 ||
        d.stage >= level.objectives.length
      )
        return null;
      const p = d.player,
        within = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
      if (![p.x, p.y, p.hp, p.ram, p.credits].every(Number.isFinite))
        return null;
      if (
        d.player.x < 16 ||
        d.player.x > (level.width - 1) * 16 ||
        d.player.y < 16 ||
        d.player.y > (level.height - 1) * 16 ||
        d.player.hp <= 0
      )
        return null;
      if (
        !within(p.maxHp, 100, 135) ||
        p.hp > p.maxHp ||
        !within(p.maxRam, 6, 9) ||
        !within(p.ram, 0, p.maxRam) ||
        !within(p.credits, 0, 999999) ||
        !within(p.meds, 0, 99) ||
        !within(p.reserve, 0, 500)
      )
        return null;
      if (
        !["needle", "scatter"].includes(p.weapon) ||
        !p.ammo ||
        !within(p.ammo.needle, 0, 12) ||
        !within(p.ammo.scatter, 0, 6)
      )
        return null;
      if (
        !Array.isArray(p.upgrades) ||
        new Set(p.upgrades).size !== p.upgrades.length ||
        p.upgrades.some((x) => !["ram", "reflex", "dermal"].includes(x))
      )
        return null;
      const ids = level.enemies.map((e) => e.id);
      if (
        d.enemies.length !== ids.length ||
        new Set(d.enemies.map((e) => e.id)).size !== ids.length ||
        d.enemies.some(
          (e) =>
            !ids.includes(e.id) ||
            !within(e.x, 16, (level.width - 1) * 16) ||
            !within(e.y, 16, (level.height - 1) * 16) ||
            !within(
              e.hp,
              0,
              level.enemies.find((v) => v.id === e.id)?.kind === "boss"
                ? 300
                : 68,
            ) ||
            typeof e.dead !== "boolean" ||
            e.dead !== (e.hp === 0),
        )
      )
        return null;
      if (
        !d.flags ||
        typeof d.flags !== "object" ||
        Object.values(d.flags).some((v) => typeof v !== "boolean") ||
        !within(d.elapsed, 0, 1e8)
      )
        return null;
      if (d.stage === 4 && !["broadcast", "sell", "erase"].includes(d.ending))
        return null;
      return d;
    } catch {
      this.error = "Save unavailable";
      return null;
    }
  }
  write(data) {
    try {
      this.storage?.setItem(
        ID + ":save",
        JSON.stringify({ ...data, version: VERSION }),
      );
      return !!this.storage;
    } catch {
      this.error = "Storage is unavailable. This run continues without saving.";
      return false;
    }
  }
  clear() {
    try {
      this.storage?.removeItem(ID + ":save");
    } catch {
      /* A blocked store must never stop gameplay. */
    }
  }
  best(result) {
    try {
      const key = ID + ":record",
        old = JSON.parse(this.storage?.getItem(key) || "null");
      if (!old || result.score > old.score)
        this.storage?.setItem(key, JSON.stringify(result));
    } catch {
      /* Optional records. */
    }
  }
}
export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.history = [];
  }
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }
  emit(type, detail = {}) {
    this.history.push({ type, ...detail });
    if (this.history.length > 160) this.history.shift();
    for (const fn of this.listeners.get(type) || []) fn(detail);
  }
}
