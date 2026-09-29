/**
 * audio.js — the game's sound, synthesized on WebAudio.
 *
 * The original shipped silent. Every effect here is built from oscillators
 * and one shared noise buffer, so there is nothing to download or decode.
 * The AudioContext is created on the first key, click or tap (browsers
 * refuse sound before a gesture), suspended while the tab is hidden or the
 * kit's settings panel is open, and its level follows the game's own
 * Sound effects setting.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** How each weapon sounds: oscillator shape, pitch sweep, length, noise share. */
const SHOTS = {
  pulse: { type: 'square', f0: 920, f1: 380, dur: 0.075, vol: 0.16 },
  laser: { type: 'sawtooth', f0: 1650, f1: 980, dur: 0.05, vol: 0.09 },
  autocannon: { type: 'square', f0: 240, f1: 90, dur: 0.07, vol: 0.14, noise: 0.22, cut: 1600 },
  scatter: { type: 'square', f0: 300, f1: 120, dur: 0.1, vol: 0.1, noise: 0.3, cut: 2600 },
  rail: { type: 'sawtooth', f0: 260, f1: 48, dur: 0.32, vol: 0.2, noise: 0.24, cut: 5200 },
  beam: { type: 'sine', f0: 560, f1: 1320, dur: 0.2, vol: 0.14 },
  plasma: { type: 'triangle', f0: 340, f1: 140, dur: 0.16, vol: 0.18 },
  ion: { type: 'square', f0: 480, f1: 760, dur: 0.09, vol: 0.1 },
  flak: { type: 'square', f0: 700, f1: 420, dur: 0.035, vol: 0.07, noise: 0.12, cut: 3000 },
  miningLaser: { type: 'sawtooth', f0: 820, f1: 760, dur: 0.06, vol: 0.06 },
  lance: { type: 'sine', f0: 180, f1: 900, dur: 0.34, vol: 0.18 },
};

export class Sfx {
  /** @param {() => object} getSettings the career settings (sfxVolume 0..1) */
  constructor(getSettings) {
    this.getSettings = getSettings;
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.lastAt = new Map();
    this.voices = 0;
    this.appliedVolume = -1;
    this.paused = false;
    this.loop = null;
    const unlock = () => this.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => this.#applySuspend());
  }

  /** Create or wake the context; called from gestures. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      // A gentle compressor glues overlapping effects and keeps a big fight from clipping.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      this.master.connect(comp).connect(ctx.destination);
      const n = Math.floor(ctx.sampleRate * 2);
      this.noiseBuffer = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < n; i += 1) data[i] = Math.random() * 2 - 1;
      this.#volume();
    }
    // Created (or woken) inside a gesture; still honour a pause that is already in force.
    this.#applySuspend();
  }

  /** The kit's settings panel (or anything else) pausing the whole game. */
  setPaused(on) {
    this.paused = !!on;
    this.#applySuspend();
  }

  #applySuspend() {
    if (!this.ctx) return;
    const off = this.paused || document.hidden;
    if (off && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    else if (!off && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  #volume() {
    const v = clamp(Number(this.getSettings()?.sfxVolume ?? 0.7), 0, 1);
    if (v === this.appliedVolume) return;
    this.appliedVolume = v;
    // A squared curve: the slider's lower half stays usable for quiet play.
    this.master.gain.setTargetAtTime(v * v * 0.95, this.ctx.currentTime, 0.03);
  }

  /** Is it worth making a sound now (context running, not throttled, voices free)? */
  #ready(key, gap = 0) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return false;
    this.#volume();
    if (this.appliedVolume <= 0) return false;
    if (this.voices > 30) return false;
    if (gap > 0) {
      const now = ctx.currentTime;
      if (now - (this.lastAt.get(key) ?? -1) < gap) return false;
      this.lastAt.set(key, now);
    }
    return true;
  }

  #out(pan) {
    if (!pan || !this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(this.master);
    return p;
  }

  #track(src, nodes) {
    this.voices += 1;
    src.onended = () => {
      this.voices -= 1;
      for (const n of nodes) n.disconnect();
    };
  }

  /** One oscillator with a pitch sweep and a fast-attack, exponential-decay envelope. */
  #tone(type, f0, f1, dur, vol, { delay = 0, pan = 0, attack = 0.004 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const out = this.#out(pan);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.#track(osc, out === this.master ? [osc, g] : [osc, g, out]);
  }

  /** Filtered noise: explosions, cannon cracks, whooshes. */
  #hiss(dur, vol, { filter = 'lowpass', f0 = 2000, f1 = f0, q = 0.8, delay = 0, pan = 0, attack = 0.004 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    // Looping, so long swells never run off the end of the buffer (duration still stops it).
    src.loop = true;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(Math.max(30, f0), t);
    biquad.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const out = this.#out(pan);
    src.connect(biquad).connect(g).connect(out);
    const offset = Math.random() * 0.5;
    src.start(t, offset, dur + 0.05);
    this.#track(src, out === this.master ? [src, biquad, g] : [src, biquad, g, out]);
  }

  /* ------------------------------------------------------------ flight */

  /**
   * A weapon firing. NPC shots pass a gain (distance falloff) and a pan so a
   * busy lane stays readable; they share one throttle so a swarm cannot flood it.
   */
  shot(weaponId, { gain = 1, pan = 0, npc = false } = {}) {
    if (gain < 0.04) return;
    // Rocket racks and torpedoes leave the tube with a whoosh, not a zap.
    if (weaponId === 'rocket' || weaponId === 'torpedo') {
      this.launch({ gain: gain * (npc ? 0.6 : 1), pan });
      return;
    }
    if (!this.#ready(npc ? 'npc-shot' : `shot:${weaponId}`, npc ? 0.045 : 0.035)) return;
    const s = SHOTS[weaponId] ?? SHOTS.pulse;
    const v = s.vol * gain * (npc ? 0.5 : 1);
    const jitter = 0.94 + Math.random() * 0.12;
    this.#tone(s.type, s.f0 * jitter, s.f1 * jitter, s.dur, v, { pan });
    if (s.noise) this.#hiss(s.dur * 1.2, v * s.noise * 4, { filter: 'lowpass', f0: s.cut, f1: s.cut * 0.3, pan });
  }

  /** A Starbreaker or rocket leaving the rack. */
  launch({ gain = 1, pan = 0 } = {}) {
    if (!this.#ready('launch', 0.08)) return;
    this.#hiss(0.55, 0.22 * gain, { filter: 'bandpass', f0: 600, f1: 2600, q: 1.4, pan, attack: 0.03 });
    this.#tone('sawtooth', 120, 60, 0.25, 0.1 * gain, { pan });
  }

  /** The player's own hull taking a hit: shields ping, armor clanks, hull crunches. */
  hit(layer) {
    if (!this.#ready(`hit:${layer}`, 0.07)) return;
    if (layer === 'shield') {
      this.#tone('sine', 1400, 700, 0.14, 0.16);
      this.#tone('triangle', 2100, 1500, 0.08, 0.06, { delay: 0.01 });
    } else if (layer === 'armor') {
      this.#tone('square', 330, 180, 0.09, 0.12);
      this.#hiss(0.12, 0.16, { filter: 'bandpass', f0: 2400, f1: 900, q: 3 });
    } else {
      this.#hiss(0.3, 0.3, { filter: 'lowpass', f0: 900, f1: 120 });
      this.#tone('sine', 90, 42, 0.26, 0.28);
    }
  }

  /** Your bolt connected. */
  confirm(layer = 'hull') {
    if (!this.#ready('confirm', 0.055)) return;
    const f = layer === 'shield' ? 2300 : layer === 'armor' ? 1500 : 1100;
    this.#tone('triangle', f, f * 0.8, 0.045, 0.07);
  }

  /** An explosion; size 0.5 (drone) … 3 (the Warden). */
  explode(size = 1, { gain = 1, pan = 0 } = {}) {
    if (gain < 0.05 || !this.#ready('explode', 0.05)) return;
    const s = clamp(size, 0.3, 3);
    this.#hiss(0.5 + s * 0.35, 0.34 * gain * Math.min(1.4, 0.6 + s * 0.3), { filter: 'lowpass', f0: 2600 / Math.sqrt(s), f1: 90, pan, attack: 0.006 });
    this.#tone('sine', 110 / Math.sqrt(s), 32, 0.45 + s * 0.3, 0.32 * gain, { pan });
    if (s >= 2) this.#hiss(1.6, 0.2 * gain, { filter: 'bandpass', f0: 400, f1: 60, q: 0.7, delay: 0.12, pan });
  }

  pickup(kind) {
    if (!this.#ready('pickup', 0.06)) return;
    if (kind === 'credits') {
      this.#tone('triangle', 1318, 1318, 0.09, 0.1);
      this.#tone('triangle', 1976, 1976, 0.14, 0.09, { delay: 0.07 });
    } else {
      this.#tone('sine', 660, 990, 0.12, 0.1);
    }
  }

  lock() {
    if (!this.#ready('lock', 0.05)) return;
    this.#tone('square', 1760, 1760, 0.04, 0.05);
    this.#tone('square', 2350, 2350, 0.05, 0.05, { delay: 0.06 });
  }

  scan() {
    if (!this.#ready('scan', 0.2)) return;
    this.#tone('sine', 300, 2400, 0.5, 0.1, { attack: 0.05 });
    this.#tone('sine', 2400, 2400, 0.18, 0.05, { delay: 0.48 });
  }

  /** Discovery catalogued, contract complete, anything clearly good. */
  chime() {
    if (!this.#ready('chime', 0.25)) return;
    [784, 988, 1175, 1568].forEach((f, i) => this.#tone('triangle', f, f, 0.32, 0.075, { delay: i * 0.07 }));
  }

  deny() {
    if (!this.#ready('deny', 0.18)) return;
    this.#tone('square', 180, 150, 0.1, 0.07);
    this.#tone('square', 150, 120, 0.12, 0.07, { delay: 0.11 });
  }

  alarm() {
    if (!this.#ready('alarm', 1.4)) return;
    this.#tone('square', 880, 880, 0.14, 0.06);
    this.#tone('square', 660, 660, 0.14, 0.06, { delay: 0.18 });
  }

  shieldDown() {
    if (!this.#ready('shieldDown', 0.8)) return;
    this.#tone('sawtooth', 900, 140, 0.4, 0.1);
  }

  repair() {
    if (!this.#ready('repair', 0.3)) return;
    [523, 659, 784].forEach((f, i) => this.#tone('sine', f, f * 1.01, 0.22, 0.08, { delay: i * 0.09 }));
    this.#hiss(0.6, 0.05, { filter: 'highpass', f0: 3000, f1: 6000, attack: 0.1 });
  }

  ecm() {
    if (!this.#ready('ecm', 0.3)) return;
    this.#hiss(0.45, 0.16, { filter: 'bandpass', f0: 5000, f1: 700, q: 4 });
    this.#tone('square', 200, 1200, 0.3, 0.05);
  }

  dock() {
    if (!this.#ready('dock', 0.5)) return;
    this.#hiss(0.5, 0.1, { filter: 'lowpass', f0: 1200, f1: 200, attack: 0.05 });
    [392, 523, 659].forEach((f, i) => this.#tone('sine', f, f, 0.4, 0.07, { delay: 0.25 + i * 0.1 }));
  }

  undock() {
    if (!this.#ready('undock', 0.5)) return;
    [659, 523].forEach((f, i) => this.#tone('sine', f, f, 0.3, 0.06, { delay: i * 0.1 }));
    this.#hiss(0.7, 0.12, { filter: 'bandpass', f0: 300, f1: 1800, q: 1, attack: 0.2, delay: 0.1 });
  }

  jump() {
    if (!this.#ready('jump', 0.8)) return;
    this.#hiss(1.1, 0.24, { filter: 'bandpass', f0: 200, f1: 5000, q: 1.2, attack: 0.5 });
    this.#tone('sawtooth', 60, 480, 1.0, 0.1, { attack: 0.6 });
    this.#tone('sine', 900, 60, 0.7, 0.14, { delay: 1.0 });
  }

  respawn() {
    if (!this.#ready('respawn', 1)) return;
    this.#tone('sine', 220, 880, 0.8, 0.12, { attack: 0.2 });
    this.#tone('triangle', 330, 1320, 0.8, 0.06, { attack: 0.25, delay: 0.05 });
  }

  /** Menu buttons. */
  ui() {
    if (!this.#ready('ui', 0.04)) return;
    this.#tone('sine', 1200, 1000, 0.035, 0.045);
  }

  /** A notification arriving. */
  toast(tone) {
    if (tone === 'danger') {
      if (!this.#ready('toast-danger', 0.6)) return;
      this.#tone('square', 520, 520, 0.09, 0.05);
      this.#tone('square', 390, 390, 0.12, 0.05, { delay: 0.1 });
    } else if (tone === 'good') {
      if (!this.#ready('toast-good', 0.35)) return;
      this.#tone('triangle', 988, 988, 0.08, 0.05);
      this.#tone('triangle', 1318, 1318, 0.12, 0.05, { delay: 0.07 });
    }
  }

  /** The Quiet Warden: 'wake', 'volley', 'lance', 'phase', 'motes'. */
  warden(kind, { gain = 1, pan = 0 } = {}) {
    if (!this.#ready(`warden:${kind}`, 0.2)) return;
    if (kind === 'wake') {
      [55, 82.4, 110, 164.8].forEach((f, i) => this.#tone('sawtooth', f, f * 1.003, 3.2, 0.07, { attack: 1.4, delay: i * 0.18 }));
      this.#hiss(3, 0.1, { filter: 'bandpass', f0: 120, f1: 1800, q: 2, attack: 1.8 });
    } else if (kind === 'volley') {
      this.#tone('sine', 220, 110, 0.35, 0.16 * gain, { pan });
      this.#tone('triangle', 660, 330, 0.3, 0.07 * gain, { pan, delay: 0.02 });
    } else if (kind === 'lance') {
      this.shot('lance', { gain, pan });
    } else if (kind === 'phase') {
      [110, 138.6, 164.8, 220].forEach((f, i) => this.#tone('sawtooth', f, f * 0.5, 1.4, 0.07, { delay: i * 0.05 }));
      this.#hiss(1.2, 0.14, { filter: 'lowpass', f0: 3000, f1: 100 });
    } else if (kind === 'motes') {
      [1400, 1760, 2100].forEach((f, i) => this.#tone('sine', f, f * 0.7, 0.2, 0.05 * gain, { pan, delay: i * 0.06 }));
    }
  }

  /**
   * The engine: a low hum that rises with speed, plus a rushing band of
   * noise while boosting. Call every frame in flight; (0, false) silences it.
   */
  setThrust(speed01, boosting) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.loop) {
      if (speed01 <= 0.01 && !boosting) return;
      const hum = ctx.createOscillator();
      hum.type = 'triangle';
      hum.frequency.value = 52;
      const humGain = ctx.createGain();
      humGain.gain.value = 0;
      hum.connect(humGain).connect(this.master);
      const rush = ctx.createBufferSource();
      rush.buffer = this.noiseBuffer;
      rush.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 700;
      band.Q.value = 0.9;
      const rushGain = ctx.createGain();
      rushGain.gain.value = 0;
      rush.connect(band).connect(rushGain).connect(this.master);
      hum.start();
      rush.start();
      this.loop = { hum, humGain, rush, band, rushGain, speed: -1, boosting: null };
    }
    const l = this.loop;
    const s = Math.round(clamp(speed01, 0, 1) * 40) / 40;
    if (s !== l.speed) {
      l.speed = s;
      const t = ctx.currentTime;
      l.hum.frequency.setTargetAtTime(46 + s * 44, t, 0.12);
      l.humGain.gain.setTargetAtTime(s * 0.035, t, 0.12);
    }
    if (boosting !== l.boosting) {
      l.boosting = boosting;
      const t = ctx.currentTime;
      l.rushGain.gain.setTargetAtTime(boosting ? 0.07 : 0, t, boosting ? 0.06 : 0.18);
      l.band.frequency.setTargetAtTime(boosting ? 1400 : 700, t, 0.2);
    }
  }
}
