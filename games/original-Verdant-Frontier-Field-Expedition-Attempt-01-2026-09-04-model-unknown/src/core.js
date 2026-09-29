import { DEFAULTS, WORLD, CAIRNS } from './config.js';
import { COMMISSION_IDS } from './commissions.js';

export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); return () => this.listeners.get(type)?.delete(listener); }
  emit(type, detail) { for (const listener of this.listeners.get(type) || []) listener(detail); }
}

const CAIRN_IDS = new Set(CAIRNS.map(c => c.id));
export const BEACON_LIMIT = 32;
export const BEACON_LIMIT_KIT = 48;

export class SaveSystem {
  constructor(bus, key = 'verdant-frontier-v1') { this.bus = bus; this.key = key; this.available = true; }
  read() {
    try {
      const value = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (!value || value.version !== 1 || value.seed !== WORLD.seed) return null;
      return this.validate(value);
    } catch { return null; }
  }
  validate(value) {
    if (!value || typeof value !== 'object' || value.version !== 1 || value.seed !== WORLD.seed) throw new Error('This save does not match this world.');
    const p = value.player;
    if (!p || ![p.x, p.y, p.z, p.yaw, p.pitch].every(Number.isFinite) || Math.abs(p.x) > WORLD.halfSize || Math.abs(p.z) > WORLD.halfSize) throw new Error('The save position is not valid.');
    const raw = value.settings || {}, settings = { ...DEFAULTS };
    for (const [key, min, max] of [['fov', 65, 110], ['time', 0, 24], ['daySpeed', 0, 4]]) if (Number.isFinite(raw[key])) settings[key] = Math.max(min, Math.min(max, raw[key]));
    for (const key of ['sound', 'headBob', 'fog']) if (typeof raw[key] === 'boolean') settings[key] = raw[key];
    const s = value.survey || {};
    const records = Array.isArray(s.records) ? s.records.filter(r => r && typeof r.id === 'string' && typeof r.name === 'string' && ['flora', 'fauna', 'terrain', 'water'].includes(r.category) && [r.x, r.z, r.height].every(Number.isFinite)).slice(0, 1000) : [];
    for (const r of records) if (r.hour !== undefined && !Number.isFinite(r.hour)) delete r.hour;
    const beacons = Array.isArray(s.beacons) ? s.beacons.filter(b => b && typeof b.id === 'string' && [b.x, b.z].every(Number.isFinite) && Math.abs(b.x) <= WORLD.halfSize && Math.abs(b.z) <= WORLD.halfSize).slice(0, BEACON_LIMIT_KIT) : [];
    const visited = Array.isArray(s.visited) ? s.visited.filter(b => Number.isInteger(b) && b >= 0 && b < 7) : [];
    const landmarks = Array.isArray(s.landmarks) ? s.landmarks.filter(id => CAIRN_IDS.has(id)) : [];
    const completed = Array.isArray(s.completed) ? s.completed.filter(id => COMMISSION_IDS.includes(id)) : [];
    const maxAltitude = Number.isFinite(s.maxAltitude) ? Math.max(0, Math.min(5000, s.maxAltitude)) : 0;
    return {
      version: 1, seed: WORLD.seed,
      player: { x: p.x, y: Math.max(-50, Math.min(4000, p.y)), z: p.z, yaw: p.yaw, pitch: Math.max(-1.5, Math.min(1.5, p.pitch)) },
      settings,
      survey: { records, beacons, visited, landmarks, completed, maxAltitude, finished: s.finished === true },
      distance: Number.isFinite(value.distance) ? Math.max(0, value.distance) : 0,
      playTime: Number.isFinite(value.playTime) ? Math.max(0, value.playTime) : 0
    };
  }
  write(data, announce = false) {
    try { localStorage.setItem(this.key, JSON.stringify(data)); this.available = true; if (announce) this.bus.emit('notice', 'Expedition saved on this device.'); return true; }
    catch { this.available = false; if (announce) this.bus.emit('notice', 'Device storage is not available. Export a save from Settings.'); return false; }
  }
  clear() { try { localStorage.removeItem(this.key); return true; } catch { return false; } }
  download(data, name, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

/**
 * All sound is synthesised. The context is created on the first "Enter
 * expedition" click (a user gesture), so it always unlocks; nothing is decoded
 * up front.
 */
export class AudioSystem {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.master = null; this.wind = null; this.stepTimer = 0; this.ambientTimer = 2; this.wanted = false;
  }
  start() {
    this.wanted = true;
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.settings.sound ? 0.10 : 0; this.master.connect(this.ctx.destination);
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate), d = buffer.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { last = (last + (Math.random() * 2 - 1) * 0.04) / 1.02; d[i] = last; }
      const src = this.ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
      this.windFilter = this.ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 420;
      this.wind = this.ctx.createGain(); this.wind.gain.value = 0.38;
      src.connect(this.windFilter).connect(this.wind).connect(this.master); src.start();
    } catch { this.ctx = null; }
  }
  tone(frequency = 700, duration = 0.12, volume = 0.3, type = 'sine', delay = 0) {
    if (!this.ctx || !this.settings.sound || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), now = this.ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now); osc.frequency.exponentialRampToValueAtTime(frequency * 0.6, now + duration);
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime); gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.master); osc.start(now); osc.stop(now + duration + 0.02);
  }
  /** A short rising sweep, like a small songbird. */
  chirp(base = 2600, delay = 0, volume = 0.05) {
    if (!this.ctx || !this.settings.sound || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), now = this.ctx.currentTime + delay;
    osc.frequency.setValueAtTime(base, now); osc.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.07); osc.frequency.exponentialRampToValueAtTime(base * 1.1, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + 0.015); gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.13);
    osc.connect(gain).connect(this.master); osc.start(now); osc.stop(now + 0.15);
  }
  /** Three rising notes: a commission or landmark was completed. */
  fanfare(big = false) {
    const notes = big ? [523, 659, 784, 1047] : [587, 740, 880];
    notes.forEach((f, i) => this.tone(f, 0.32, 0.22, 'triangle', i * 0.11));
  }
  /**
   * Footsteps plus a light ambience: birds by day in green country, crickets
   * at night, and wind that rises with altitude.
   */
  update(dt, { speed, grounded, swimming, altitude, day, lush, underwater }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    // The mix follows the player a few times a second (not every frame, which floods the automation timeline).
    this.mixTimer = (this.mixTimer || 0) - dt;
    if (this.mixTimer <= 0) {
      this.mixTimer = 0.2; const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.settings.sound ? 0.10 : 0, now, 0.1);
      const windy = Math.min(1, Math.max(0, (altitude - 300) / 900));
      this.wind.gain.setTargetAtTime(underwater ? 0.12 : 0.30 + windy * 0.45, now, 0.5);
      this.windFilter.frequency.setTargetAtTime(underwater ? 180 : 380 + windy * 520, now, 0.5);
    }
    this.stepTimer -= dt;
    if (speed > 1 && grounded && this.stepTimer < 0) { this.stepTimer = Math.max(0.2, 0.52 - speed * 0.018); this.tone(swimming ? 190 : 65, 0.07, swimming ? 0.15 : 0.3); }
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 2.5 + Math.random() * 5;
      if (underwater || !lush) return;
      if (day > 0.6) { const b = 2200 + Math.random() * 1600, n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) this.chirp(b * (1 + (Math.random() - 0.5) * 0.08), i * 0.16, 0.035 + Math.random() * 0.03); }
      else if (day < 0.15) { for (let i = 0; i < 6; i++) this.tone(4300 + Math.random() * 200, 0.035, 0.028, 'square', i * 0.07); }
    }
  }
  pause() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.wanted) this.start(); }
  dispose() { this.ctx?.close(); }
}
