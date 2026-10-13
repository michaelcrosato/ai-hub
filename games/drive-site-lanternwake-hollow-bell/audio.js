/* Lanternwake: The Hollow Bell — original procedural score and sound.
 * Creates an AudioContext only after unlock(), normally from a pointer/keyboard gesture.
 * update(dt, { combat, intensity, paused, restored, totalSeals }) changes score layers.
 * All music and effects are synthesized locally. No external sample or melody is used.
 */
(function () {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const SCENES = {
    village: { bpm: 88, roots: [50, 55, 47, 57], thirds: [4, 4, 3, 4], major: true, tone: 2400, activity: .25,
      motif: [14, 9, 7, 2, 4, 7, 9, null, 7, 4, 2, 0, 2, 7, 4, null] },
    garden: { bpm: 98, roots: [50, 55, 47, 57], thirds: [4, 4, 3, 4], major: true, tone: 3200, activity: .48,
      motif: [7, 9, 14, null, 9, 7, 4, 2, 4, 7, 9, null, 7, 4, 2, null] },
    ruins: { bpm: 82, roots: [50, 46, 53, 48], thirds: [3, 4, 4, 4], major: false, tone: 1500, activity: .36,
      motif: [12, 7, 5, null, 3, 5, 7, null, 10, 7, 5, 3, 5, 2, 0, null] },
    boss: { bpm: 126, roots: [38, 46, 41, 45], thirds: [3, 4, 4, 4], major: false, tone: 2500, activity: 1,
      motif: [12, null, 7, 12, 15, null, 14, 7, 12, 10, 7, null, 5, 7, 2, null] },
    ending: { bpm: 84, roots: [50, 55, 59, 57], thirds: [4, 4, 3, 4], major: true, tone: 3600, activity: .28,
      motif: [14, 9, 7, 4, 2, 7, 9, null, 14, 16, 14, 9, 7, 4, 2, null] }
  };

  class LanternAudio {
    constructor(engine) {
      this.engine = engine;
      this.ctx = null;
      this.enabled = true;
      this.volume = .62;
      this.scene = 'village';
      this.ready = false;
      this.failed = null;
      this.unlocked = false;
      this.combat = 0;
      this.restoration = 0;
      this.paused = false;
      this._voices = new Set();
      this._lastSfx = new Map();
      this._step = 0;
      this._next = 0;
      this._timer = null;
      this._disposed = false;
      this._hidden = document.hidden;
      this._oldBuses = new Set();
      this._gesture = () => { if (this.enabled) this.unlock(); };
      this._visibility = () => {
        this._hidden = document.hidden;
        if (!this.ctx || !this.unlocked) return;
        if (this._hidden) {
          this.ready = false;
          this.ctx.suspend().catch(() => {});
        } else if (this.enabled) this._resume();
      };
      window.addEventListener('pointerdown', this._gesture, { capture: true, passive: true });
      window.addEventListener('keydown', this._gesture, { capture: true, passive: true });
      document.addEventListener('visibilitychange', this._visibility);
    }

    async unlock() {
      if (this._disposed || !this.enabled) return false;
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) { this.failed = 'Web Audio is unavailable.'; return false; }
          const c = this.ctx = new AC({ latencyHint: 'interactive' });
          this.master = c.createGain();
          this.master.gain.value = this.volume;
          this.compressor = c.createDynamicsCompressor();
          this.compressor.threshold.value = -15;
          this.compressor.knee.value = 20;
          this.compressor.ratio.value = 3;
          this.compressor.attack.value = .005;
          this.compressor.release.value = .2;
          this.master.connect(this.compressor);
          this.compressor.connect(c.destination);
          this.musicBus = c.createGain();
          this.musicBus.gain.value = .30;
          this.sfxBus = c.createGain();
          this.sfxBus.gain.value = .76;
          this.musicBus.connect(this.master);
          this.sfxBus.connect(this.master);
          this.delay = c.createDelay(1);
          this.delay.delayTime.value = .27;
          this.feedback = c.createGain();
          this.feedback.gain.value = .20;
          this.delayWet = c.createGain();
          this.delayWet.gain.value = .12;
          this.delayFilter = c.createBiquadFilter();
          this.delayFilter.type = 'lowpass';
          this.delayFilter.frequency.value = 2300;
          this.musicBus.connect(this.delay);
          this.delay.connect(this.delayFilter);
          this.delayFilter.connect(this.feedback);
          this.feedback.connect(this.delay);
          this.delayFilter.connect(this.delayWet);
          this.delayWet.connect(this.master);
          this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
          const noiseData = this.noise.getChannelData(0);
          let state = 82741;
          for (let i = 0; i < noiseData.length; i++) {
            state = (1664525 * state + 1013904223) >>> 0;
            noiseData[i] = state / 2147483648 - 1;
          }
          c.addEventListener('statechange', () => { this.ready = c.state === 'running' && this.enabled && !this._hidden; });
          this._newSceneBus(false);
          this._timer = window.setInterval(() => this._schedule(), 35);
        } catch (e) {
          this.failed = String(e.message || e);
          const incomplete = this.ctx;
          this.ctx = null;
          if (incomplete && incomplete.state !== 'closed') incomplete.close().catch(() => {});
          return false;
        }
      }
      this.unlocked = true;
      return this._resume();
    }

    async _resume() {
      if (!this.ctx || this._disposed || !this.enabled || this._hidden) return false;
      try {
        await this.ctx.resume();
        this.ready = this.ctx.state === 'running';
        if (this.ready && this._next < this.ctx.currentTime) this._next = this.ctx.currentTime + .045;
        return this.ready;
      } catch (_) { this.ready = false; return false; }
    }

    setEnabled(enabled) {
      this.enabled = !!enabled;
      if (!this.ctx) return this.enabled;
      this._masterLevel();
      if (this.enabled && this.unlocked) this._resume();
      else {
        this.ready = false;
        this.ctx.suspend().catch(() => {});
      }
      return this.enabled;
    }

    setVolume(volume) {
      if (!Number.isFinite(Number(volume))) return this.volume;
      this.volume = clamp(Number(volume), 0, 1);
      this._masterLevel();
      return this.volume;
    }

    _masterLevel() {
      if (!this.ctx || !this.master) return;
      this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, .04);
    }

    setScene(scene) {
      if (!SCENES[scene] || scene === this.scene) return;
      this.scene = scene;
      this._step = 0;
      this._next = this.ctx ? this.ctx.currentTime + .06 : 0;
      if (this.ctx) this._newSceneBus(true);
    }

    _newSceneBus(fade) {
      const c = this.ctx;
      if (!c) return;
      const now = c.currentTime;
      if (this.sceneBus) {
        const old = this.sceneBus;
        old.gain.cancelScheduledValues(now);
        old.gain.setValueAtTime(Math.max(.001, old.gain.value), now);
        old.gain.exponentialRampToValueAtTime(.001, now + .7);
        this._oldBuses.add(old);
        window.setTimeout(() => { try { old.disconnect(); } catch (_) { /* disposed */ } this._oldBuses.delete(old); }, 3500);
      }
      const bus = this.sceneBus = c.createGain();
      bus.gain.setValueAtTime(fade ? .001 : .85, now);
      if (fade) bus.gain.linearRampToValueAtTime(.85, now + 1.1);
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = SCENES[this.scene].tone;
      filter.Q.value = .35;
      bus.connect(filter);
      filter.connect(this.musicBus);
      this.sceneFilter = filter;
    }

    _voice(midi, when, duration, volume, wave = 'triangle', bus = this.sceneBus, options = {}) {
      const c = this.ctx;
      if (!c || !bus || this._voices.size > 100 || !Number.isFinite(midi)) return;
      const start = Math.max(c.currentTime, when);
      const end = start + Math.max(.025, duration);
      const oscillator = c.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(options.frequency || freq(midi), start);
      if (options.to) oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, options.to), end);
      if (options.detune) oscillator.detune.value = options.detune;
      const gain = c.createGain();
      const peak = Math.max(.0001, volume);
      const attack = Math.min(options.attack || .012, duration * .3);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + attack);
      if (options.sustain) gain.gain.setValueAtTime(peak * .68, start + duration * .6);
      gain.gain.exponentialRampToValueAtTime(.0001, end);
      oscillator.connect(gain);
      gain.connect(bus);
      this._voices.add(oscillator);
      oscillator.onended = () => { this._voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(end + .04);
    }

    _noise(when, duration, volume, cutoff, bus = this.sfxBus, highpass = false) {
      const c = this.ctx;
      if (!c || !this.noise || this._voices.size > 100) return;
      const start = Math.max(c.currentTime, when), end = start + duration;
      const source = c.createBufferSource();
      source.buffer = this.noise;
      const filter = c.createBiquadFilter();
      filter.type = highpass ? 'highpass' : 'bandpass';
      filter.frequency.setValueAtTime(cutoff, start);
      filter.Q.value = .75;
      const gain = c.createGain();
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(Math.max(.0001, volume), start + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, end);
      source.connect(filter); filter.connect(gain); gain.connect(bus);
      this._voices.add(source);
      source.onended = () => { this._voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
      source.start(start, (this._step % 7) * .08);
      source.stop(end + .025);
    }

    _schedule() {
      const c = this.ctx;
      if (!c || this._disposed || !this.enabled || c.state !== 'running' || this._hidden) return;
      if (!this._next || this._next < c.currentTime - .2) this._next = c.currentTime + .05;
      const scene = SCENES[this.scene];
      const stepTime = 60 / scene.bpm / 2;
      let guard = 0;
      while (this._next < c.currentTime + .14 && guard++ < 8) {
        this._scoreStep(this._step++, this._next, stepTime, scene);
        this._next += stepTime;
      }
    }

    _scoreStep(index, time, eighth, scene) {
      const beat = index % 8;
      const bar = Math.floor(index / 8);
      const root = scene.roots[bar % scene.roots.length];
      const boss = this.scene === 'boss';
      const third = scene.thirds[bar % scene.thirds.length];
      const chord = [0, third, 7, scene.major ? 14 : 10];
      const tension = boss ? 1 : this.combat;
      const bus = this.sceneBus;

      // Long, soft voices make a small room around the dry lead.
      if (beat === 0) {
        for (const offset of chord.slice(0, 3)) {
          this._voice(root + offset + (boss ? 12 : 0), time, eighth * 7.6, .035, 'sine', bus, { attack: .16, sustain: true });
        }
        this._voice(root - 12, time, eighth * (boss ? 1.7 : 4.5), boss ? .14 : .085, 'triangle', bus, { attack: .018 });
      }
      if (beat === 4) this._voice(root - 5, time, eighth * 2.7, .055 + tension * .04, 'triangle', bus);
      if (boss && (beat === 2 || beat === 6)) this._voice(root - 12, time, eighth * .9, .11, 'triangle', bus);

      const arp = chord[[0, 2, 1, 3, 2, 1, 3, 2][beat]];
      if (beat % 2 === 0 || scene.activity > .4) {
        this._voice(root + arp + 12, time + .008, eighth * 1.1, .053 + this.restoration * .023,
          'triangle', bus, { attack: .014 });
        if (this.restoration > .5 && beat === 6) this._voice(root + arp + 24, time, eighth * 1.8, .018, 'sine', bus);
      }
      const melody = scene.motif[index % scene.motif.length];
      const phraseRest = !boss && bar % 8 === 7 && beat > 3;
      if (melody !== null && !phraseRest && (beat % 2 === 0 || boss || bar % 2 === 1)) {
        const key = 62;
        const octave = this.scene === 'ending' && bar % 8 >= 4 ? 12 : 0;
        this._voice(key + melody + octave, time, eighth * (beat % 2 ? 1.6 : 2.1), boss ? .066 : .075,
          'triangle', bus, { attack: .025 });
        this._voice(key + melody + octave, time + .009, eighth * 2.2, .014, 'sine', bus, { detune: 3.5, attack: .045 });
      }
      if (tension > .12) {
        if (beat === 0 || beat === 4) this._voice(35, time, .19, .15 * tension, 'sine', bus, { frequency: 125, to: 42, attack: .004 });
        if (beat === 2 || beat === 6) this._noise(time, .095, .05 * tension, 1200, bus);
        if (boss || beat % 2 === 1) this._noise(time, .028, .022 * tension, 5600, bus, true);
      }
    }

    sfx(name) {
      if (!this.ctx || !this.ready || !this.enabled || this._disposed) return;
      const aliases = { sword: 'slash', attack: 'slash', hit: 'impact', shoot: 'cast', coin: 'collect', gem: 'collect',
        damage: 'hurt', death: 'hurt', release: 'restore', rescued: 'restore', victory: 'bosswin',
        confirm: 'select', interact: 'select', open: 'select', error: 'deny', heal: 'restore', levelup: 'restore' };
      name = aliases[name] || name;
      const now = this.ctx.currentTime + .006;
      const rate = name === 'slash' ? .085 : name === 'impact' ? .04 : .055;
      if (now - (this._lastSfx.get(name) ?? -10) < rate) return;
      this._lastSfx.set(name, now);
      const tone = (m, delay, dur, vol, wave = 'triangle', opts) => this._voice(m, now + delay, dur, vol, wave, this.sfxBus, opts || {});
      switch (name) {
        case 'slash':
          this._noise(now, .12, .15, 2300);
          tone(66, 0, .1, .09, 'triangle', { frequency: 620, to: 120 });
          break;
        case 'impact':
          this._noise(now, .11, .18, 950);
          tone(39, 0, .11, .17, 'sine', { frequency: 180, to: 47 });
          tone(79, .008, .08, .035, 'triangle');
          break;
        case 'dash':
          this._noise(now, .21, .09, 3800);
          tone(45, 0, .15, .07, 'sine', { frequency: 100, to: 460 });
          break;
        case 'collect':
          tone(86, 0, .1, .11, 'sine'); tone(93, .07, .19, .085, 'triangle');
          break;
        case 'hurt':
          tone(47, 0, .2, .14, 'triangle', { to: 72 });
          tone(48, .015, .15, .07, 'sawtooth', { to: 60 });
          this._noise(now, .15, .09, 520);
          break;
        case 'seal':
          [62, 69, 74, 78, 81, 86].forEach((m, i) => tone(m, i * .085, .65, .1 - i * .009, 'sine'));
          tone(38, 0, .6, .13, 'triangle');
          this._noise(now, .5, .055, 1200);
          break;
        case 'restore':
          [62, 66, 69, 74, 78, 81].forEach((m, i) => tone(m, i * .12, .85, .09, 'sine'));
          [50, 57, 62].forEach(m => tone(m, .5, 1.5, .055, 'triangle', { attack: .06, sustain: true }));
          break;
        case 'cast':
          tone(62, 0, .34, .12, 'sine', { frequency: 220, to: 1100 });
          tone(81, .05, .3, .055, 'triangle');
          this._noise(now, .24, .065, 4700);
          break;
        case 'bosswin':
          [62, 66, 69, 74, 73, 69, 74, 78, 81, 86].forEach((m, i) => tone(m, i * .14, .8, .11, 'triangle', { attack: .02 }));
          [50, 57, 62, 66].forEach(m => tone(m, 1.0, 2.5, .055, 'sine', { attack: .07, sustain: true }));
          break;
        case 'checkpoint':
          [62, 69, 74].forEach((m, i) => tone(m, i * .10, .65, .085, 'sine'));
          break;
        case 'select':
          tone(74, 0, .09, .075, 'sine'); tone(81, .04, .12, .045, 'sine');
          break;
        case 'deny':
          tone(43, 0, .12, .08, 'triangle'); tone(42, .09, .14, .06, 'triangle');
          break;
        case 'pause':
          tone(69, 0, .16, .08, 'sine'); tone(62, .085, .25, .055, 'sine');
          break;
        case 'bell':
          [62, 74, 81, 90].forEach((m, i) => tone(m, .01 * i, 2.2 - i * .25, .105 / (i + 1), 'sine'));
          break;
        default: break;
      }
    }

    update(dt, world = {}) {
      const target = clamp(Number(world.intensity ?? (world.combat ? 1 : 0)) || 0, 0, 1);
      this.combat += (target - this.combat) * (1 - Math.exp(-Math.max(0, dt || 0) * 2));
      const restored = Number(world.restored) || 0;
      this.restoration = clamp(restored / Math.max(1, Number(world.totalSeals) || 8), 0, 1);
      const paused = !!world.paused;
      if (this.ctx && paused !== this.paused) this.musicBus.gain.setTargetAtTime(paused ? .11 : .30, this.ctx.currentTime, .18);
      this.paused = paused;
      if (this.ctx && this.enabled && !this._hidden && this.ctx.state === 'running') this._schedule();
    }

    async dispose() {
      this._disposed = true;
      window.removeEventListener('pointerdown', this._gesture, true);
      window.removeEventListener('keydown', this._gesture, true);
      document.removeEventListener('visibilitychange', this._visibility);
      if (this._timer) window.clearInterval(this._timer);
      for (const voice of this._voices) { try { voice.stop(); } catch (_) { /* voice already stopped */ } }
      this._voices.clear();
      for (const bus of this._oldBuses) { try { bus.disconnect(); } catch (_) { /* no connection */ } }
      this._oldBuses.clear();
      if (this.ctx && this.ctx.state !== 'closed') { try { await this.ctx.close(); } catch (_) { /* browser closed it */ } }
      this.ready = false;
    }
  }

  window.LanternAudio = LanternAudio;
})();
