import { GENERATOR_VERSION, DIFFICULTIES, difficultyOf, MAX_ALARM, MAX_DECOYS } from './config.js';
import { clamp, finiteV3 } from './math.js';

/** The rules of one run: phase, timers, resources, what was found. */
export class Session {
  constructor(difficulty = 'standard') {
    this.difficulty = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'standard';
    const d = difficultyOf(this.difficulty);
    this.rules = d;
    this.phase = 'scavenge';
    this.time = 0;
    this.alarmTime = d.alarm;
    this.alarmLeft = d.alarm;
    this.battery = 100;
    this.stamina = 100;
    this.decoys = d.decoys;
    this.collected = new Set();
    this.explored = new Set();
    this.logs = [];
    this.stats = { spotted: 0, thrown: 0 };
  }
  collect(id) {
    if (!/^fuse:[0-2]$/.test(id) || this.phase !== 'scavenge' || this.collected.has(id)) return false;
    this.collected.add(id);
    return true;
  }
  startPower() {
    if (this.collected.size !== 3 || this.phase !== 'scavenge') return false;
    this.phase = 'powering';
    this.alarmLeft = this.alarmTime;
    return true;
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0 || this.phase === 'lost' || this.phase === 'won') return;
    this.time += dt;
    if (this.phase === 'powering') {
      this.alarmLeft = Math.max(0, this.alarmLeft - dt);
      if (this.alarmLeft === 0) this.phase = 'escape';
    }
  }
  restore(save) {
    this.phase = save.phase;
    this.time = save.time;
    this.alarmLeft = Math.min(save.alarmLeft, this.alarmTime);
    this.battery = save.battery;
    this.stamina = save.stamina;
    this.decoys = Math.min(save.decoys, this.rules.decoys);
    this.collected.clear();
    save.collected.forEach((id) => this.collected.add(id));
    this.explored.clear();
    save.explored.forEach((id) => this.explored.add(id));
    this.logs = [...save.logs];
    this.stats = { ...this.stats, ...save.stats };
  }
}

export function parseSave(text) {
  if (!text || text.length > 2000000) return null;
  try {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object') return null;
    if (s.version !== 1 || s.generator !== GENERATOR_VERSION || typeof s.seed !== 'string' || s.seed.length > 80 || ![3, 5, 7].includes(s.size) || !finiteV3(s.player)) return null;
    if (!['scavenge', 'powering', 'escape'].includes(s.phase)) return null;
    if (![s.time, s.alarmLeft, s.battery, s.stamina, s.decoys, s.yaw, s.pitch].every(Number.isFinite)) return null;
    if (!Array.isArray(s.collected) || s.collected.length > 3 || s.collected.some((id) => !/^fuse:[0-2]$/.test(id)) || new Set(s.collected).size !== s.collected.length) return null;
    if ((s.phase === 'powering' || s.phase === 'escape') && s.collected.length !== 3) return null;
    if (s.player.some((n) => Math.abs(n) > 500) || s.time < 0 || s.time > 604800) return null;
    // Saves from before difficulties existed are standard runs.
    s.difficulty = typeof s.difficulty === 'string' && Object.hasOwn(DIFFICULTIES, s.difficulty) ? s.difficulty : 'standard';
    s.alarmLeft = clamp(s.alarmLeft, 0, MAX_ALARM);
    s.battery = clamp(s.battery, 0, 100);
    s.stamina = clamp(s.stamina, 0, 100);
    s.decoys = clamp(Math.floor(s.decoys), 0, MAX_DECOYS);
    s.pitch = clamp(s.pitch, -85, 85);
    s.yaw = ((s.yaw % 360) + 360) % 360;
    if (!s.doors || typeof s.doors !== 'object' || Array.isArray(s.doors) || Object.keys(s.doors).length > 1000) return null;
    s.doors = Object.fromEntries(Object.entries(s.doors).filter(([key, val]) => key.startsWith('b:') && typeof val === 'boolean'));
    if (!s.props || typeof s.props !== 'object' || Array.isArray(s.props) || Object.keys(s.props).length > 2000) return null;
    s.props = Object.fromEntries(
      Object.entries(s.props).filter(([, p]) => p && finiteV3(p.position) && p.position.every((n) => Math.abs(n) < 500) && Array.isArray(p.rotation) && p.rotation.length === 4 && p.rotation.every(Number.isFinite))
    );
    s.explored = Array.isArray(s.explored) ? s.explored.filter((id) => typeof id === 'string' && id.startsWith('b:')).slice(0, 49) : [];
    s.logs = Array.isArray(s.logs) ? [...new Set(s.logs.filter((id) => typeof id === 'string' && /^log:[0-9]$/.test(id)))].slice(0, 10) : [];
    const st = s.stats && typeof s.stats === 'object' ? s.stats : {};
    s.stats = {
      spotted: Number.isFinite(st.spotted) ? clamp(Math.floor(st.spotted), 0, 9999) : 0,
      thrown: Number.isFinite(st.thrown) ? clamp(Math.floor(st.thrown), 0, 99) : 0,
    };
    return s;
  } catch {
    return null;
  }
}
