/* Nacre audio. Original music and sound design. No external audio files. */
(function (root) {
  'use strict';

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const MELODY = [
    62, 0, 69, 0, 72, 74, 0, 69, 67, 0, 65, 0, 64, 0, 62, 0,
    62, 0, 65, 69, 72, 0, 76, 0, 74, 72, 69, 0, 67, 0, 64, 0,
    65, 0, 69, 0, 72, 0, 74, 72, 69, 0, 67, 0, 65, 64, 62, 0,
    64, 0, 67, 69, 71, 0, 74, 0, 69, 67, 64, 0, 62, 0, 0, 0
  ];
  const BASS = [50, 48, 43, 50, 53, 48, 43, 50];
  const RATES = {
    step: .17, jump: .12, land: .12, climb: .18, blade: .1,
    parry: .1, hurt: .16, smoke: .3, clue: .5, alarm: 1.8, win: 2
  };

  class NacreAudio {
    constructor(game) {
      this.game = game || null;
      this.engine = game && game.audio;
      this.context = null;
      this.started = false;
      this.wanted = false;
      this.muted = false;
      this.volume = this.engine && Number.isFinite(this.engine.volume) ? this.engine.volume : .7;
      this.failed = null;
      this.danger = 0;
      this.mode = 'title';
      this.clock = 0;
      this.step = 0;
      this.nextNote = 0;
      this.nextMix = 0;
      this._voices = new Set();
      this._streams = [];
      this._cache = new Map();
      this._last = Object.create(null);
      this._seed = 94137;
      this._hidden = !!(root.document && root.document.hidden);
      this._paused = false;
      this._gestureArmed = false;
      this._gesture = event => {
        if (event.isTrusted === false || !this.wanted) return;
        this._startFromGesture();
      };
      this._visibility = () => {
        this._hidden = !!root.document.hidden;
        this.nextNote = 0;
        this._mix(true);
      };
      if (root.document) root.document.addEventListener('visibilitychange', this._visibility);
    }

    // Call from the start button. A call without a gesture waits for one.
    start() {
      this.wanted = true;
      const activation = root.navigator && root.navigator.userActivation;
      if (activation && activation.isActive) return this._startFromGesture();
      if (this.started && this.context && this.context.state === 'running') return true;
      this._armGesture();
      return false;
    }

    _armGesture() {
      if (this._gestureArmed || !root.addEventListener) return;
      this._gestureArmed = true;
      root.addEventListener('pointerdown', this._gesture, true);
      root.addEventListener('keydown', this._gesture, true);
    }

    _removeGesture() {
      if (!this._gestureArmed) return;
      this._gestureArmed = false;
      root.removeEventListener('pointerdown', this._gesture, true);
      root.removeEventListener('keydown', this._gesture, true);
    }

    _startFromGesture() {
      try {
        if (!this.context) {
          // The supplied engine owns one context and its sound buses.
          const engine = this.engine;
          if (engine && typeof engine._init === 'function') this.context = engine._init();
          if (!this.context) {
            const AudioContext = root.AudioContext || root.webkitAudioContext;
            if (!AudioContext) throw new Error('Web Audio is unavailable.');
            this.context = new AudioContext();
            this._ownContext = true;
          }
        }
        const context = this.context;
        if (context.state === 'closed') return false;
        if (context.state === 'suspended') {
          const pending = context.resume();
          if (pending && pending.catch) pending.catch(() => this._armGesture());
        }
        if (!this.started) this._build();
        this.started = true;
        this.failed = null;
        this.nextNote = context.currentTime + .08;
        this._mix(true);
        this._removeGesture();
        return true;
      } catch (error) {
        this.failed = error && error.message ? error.message : String(error);
        return false;
      }
    }

    _random() {
      this._seed = (Math.imul(this._seed, 1664525) + 1013904223) | 0;
      return (this._seed >>> 0) / 4294967296;
    }

    _build() {
      const c = this.context;
      this.music = c.createGain();
      this.effects = c.createGain();
      this.music.gain.value = this.effects.gain.value = 0;
      const engine = this._ownContext ? null : this.engine;
      this.music.connect(engine && engine.musBus ? engine.musBus : c.destination);
      this.effects.connect(engine && engine.sfxBus ? engine.sfxBus : c.destination);
      const noise = this.noise = c.createBuffer(1, Math.ceil(c.sampleRate * 3), c.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = this._random() * 2 - 1;
      this.sea = this._ambient('lowpass', 410, .045, 0);
      this.wind = this._ambient('bandpass', 1180, .014, .7);
      this.step = 0;
    }

    _ambient(type, frequency, volume, offset) {
      const c = this.context, source = c.createBufferSource();
      const filter = c.createBiquadFilter(), gain = c.createGain();
      source.buffer = this.noise;
      source.loop = true;
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = .45;
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.music);
      source.start(c.currentTime, offset);
      this._streams.push({ source, filter, gain });
      return { source, filter, gain };
    }

    _target(parameter, value, seconds = .1) {
      if (!parameter || !this.context) return;
      const now = this.context.currentTime;
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(value, now, Math.max(.01, seconds));
    }

    _mix(force = false) {
      if (!this.context || !this.music) return;
      const now = this.context.currentTime;
      if (!force && now < this.nextMix) return;
      this.nextMix = now + .1;
      const silent = this.muted || this._hidden || this._paused;
      const volume = this._ownContext ? this.volume : 1;
      this._target(this.music.gain, silent ? 0 : .52 * volume, .07);
      this._target(this.effects.gain, silent ? 0 : .68 * volume, .04);
      if (this.sea) {
        this._target(this.sea.gain.gain, .033 + .015 * (.5 + .5 * Math.sin(this.clock * .39)), .7);
        this._target(this.sea.filter.frequency, 360 + 150 * (.5 + .5 * Math.sin(this.clock * .17)), .8);
        this._target(this.wind.gain.gain, .008 + .007 * (.5 + .5 * Math.sin(this.clock * .23 + 2)), .8);
      }
    }

    // Call once per frame, including paused frames. No interval is required.
    update(dt, state = {}) {
      dt = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
      this.clock += dt;
      this.mode = state.mode === undefined ? this.mode : String(state.mode).toLowerCase();
      const wasPaused = this._paused;
      this._paused = !!(this.game && this.game.paused) || ['pause', 'paused', 'hidden', 'stopped'].includes(this.mode);
      const target = Number.isFinite(state.danger) ? clamp(state.danger, 0, 1) : 0;
      this.danger += (target - this.danger) * (1 - Math.exp(-dt * 2.5));
      if (wasPaused !== this._paused) this.nextNote = 0;
      if (!this.started || !this.context) return;
      this._mix(wasPaused !== this._paused);
      if (this.context.state !== 'running' || this.muted || this._hidden || this._paused) {
        this.nextNote = 0;
        return;
      }
      const now = this.context.currentTime;
      if (!this.nextNote || this.nextNote < now - .3) this.nextNote = now + .04;
      // Three steps is a hard limit after a long frame.
      for (let count = 0; count < 3 && this.nextNote < now + .13; count++) {
        this._score(this.step++, this.nextNote);
        this.nextNote += 60 / 92 / 2;
      }
    }

    _score(step, when) {
      const index = step % MELODY.length, note = MELODY[index];
      const d = this.danger, calm = 1 - d * .65;
      if (note) this._pluck(note, when, .23 * calm, Math.sin(index * 1.7) * .23, this.music);
      if (index % 8 === 0) this._pluck(BASS[index / 8], when, .30, -.14, this.music);
      if (index % 16 === 12 && d < .4) this._pluck(69, when + .025, .075, .28, this.music);
      if (d > .08 && step % 2 === 0) this._drum(when, (.07 + d * .20) * (step % 8 === 0 ? 1 : .68), this.music);
      if (d > .55 && step % 8 === 5) this._noiseBurst(when, .065, .09 * d, 1400, 700, 'bandpass', this.music);
    }

    _string(midi) {
      if (this._cache.has(midi)) return this._cache.get(midi);
      const c = this.context, frequency = hz(midi), length = Math.ceil(c.sampleRate * 2.5);
      const buffer = c.createBuffer(1, length, c.sampleRate), out = buffer.getChannelData(0);
      const period = Math.max(8, Math.round(c.sampleRate / frequency));
      const line = new Float32Array(period);
      for (let i = 0; i < period; i++) line[i] = (this._random() * 2 - 1) * .8;
      let cursor = 0;
      for (let i = 0; i < length; i++) {
        const next = (cursor + 1) % period;
        const value = .4991 * (line[cursor] + line[next]);
        out[i] = value;
        line[cursor] = value;
        cursor = next;
      }
      if (this._cache.size >= 24) this._cache.delete(this._cache.keys().next().value);
      this._cache.set(midi, buffer);
      return buffer;
    }

    _track(source, nodes, end) {
      this._voices.add(source);
      source.onended = () => {
        this._voices.delete(source);
        for (const node of nodes) { try { node.disconnect(); } catch (_) { /* Already stopped. */ } }
      };
      source.stop(end + .025);
    }

    _pluck(midi, when, volume, pan, bus) {
      if (this._voices.size >= 48) return;
      const c = this.context, source = c.createBufferSource(), gain = c.createGain();
      source.buffer = this._string(midi);
      when = Math.max(when, c.currentTime + .002);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(volume, when + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, when + 2.2);
      source.connect(gain);
      const nodes = [source, gain];
      if (c.createStereoPanner) {
        const panner = c.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(bus);
        nodes.push(panner);
      } else gain.connect(bus);
      source.start(when);
      this._track(source, nodes, when + 2.25);
    }

    _tone(when, duration, frequency, to, volume, type, bus) {
      if (this._voices.size >= 48) return;
      const c = this.context, source = c.createOscillator(), gain = c.createGain();
      when = Math.max(when, c.currentTime + .002);
      source.type = type || 'sine';
      source.frequency.setValueAtTime(frequency, when);
      if (to) source.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + duration);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(Math.max(.0002, volume), when + .003);
      gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
      source.connect(gain);
      gain.connect(bus);
      source.start(when);
      this._track(source, [source, gain], when + duration);
    }

    _noiseBurst(when, duration, volume, frequency, to, type, bus) {
      if (this._voices.size >= 48) return;
      const c = this.context, source = c.createBufferSource();
      const filter = c.createBiquadFilter(), gain = c.createGain();
      when = Math.max(when, c.currentTime + .002);
      source.buffer = this.noise;
      source.loop = true;
      filter.type = type || 'lowpass';
      filter.Q.value = .75;
      filter.frequency.setValueAtTime(frequency, when);
      if (to) filter.frequency.exponentialRampToValueAtTime(to, when + duration);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(Math.max(.0002, volume), when + .005);
      gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      source.start(when, this._random() * 1.5);
      this._track(source, [source, filter, gain], when + duration);
    }

    _drum(when, volume, bus) {
      this._tone(when, .19, 142, 61, volume, 'sine', bus);
      this._noiseBurst(when, .055, volume * .30, 1250, 480, 'lowpass', bus);
    }

    _bell(when, frequency, volume, duration = .8) {
      for (const part of [[1, 1], [2.71, .24], [4.08, .08]]) {
        this._tone(when, duration / Math.sqrt(part[0]), frequency * part[0], 0, volume * part[1], 'sine', this.effects);
      }
    }

    event(name) {
      if (!this.started || !this.context || this.context.state !== 'running' || this.muted || this._paused || this._hidden) return false;
      if (!(name in RATES)) return false;
      const t = this.context.currentTime + .008;
      if (this._last[name] !== undefined && t - this._last[name] < RATES[name]) return false;
      this._last[name] = t;
      const bus = this.effects;
      switch (name) {
        case 'step': this._noiseBurst(t, .045, .11, 750 + this._random() * 450, 230, 'lowpass', bus); break;
        case 'jump': this._noiseBurst(t, .13, .08, 1600, 420, 'bandpass', bus); break;
        case 'land': this._drum(t, .19, bus); break;
        case 'climb': this._noiseBurst(t, .09, .09, 1100, 370, 'bandpass', bus); break;
        case 'blade': this._noiseBurst(t, .17, .23, 3600, 800, 'bandpass', bus); break;
        case 'parry': this._bell(t, 1280, .13, .4); this._noiseBurst(t, .04, .18, 5200, 1600, 'highpass', bus); break;
        case 'hurt': this._tone(t, .22, 116, 54, .21, 'triangle', bus); this._noiseBurst(t, .11, .15, 860, 220, 'lowpass', bus); break;
        case 'smoke': this._noiseBurst(t, .8, .32, 1900, 230, 'lowpass', bus); break;
        case 'clue': this._bell(t, hz(74), .12); this._bell(t + .16, hz(81), .085, .95); break;
        case 'alarm': this._bell(t, hz(50), .20, 1.1); this._bell(t + .25, hz(57), .14, 1); break;
        case 'win':
          [74, 77, 81, 86].forEach((note, i) => {
            this._bell(t + i * .17, hz(note), i === 3 ? .12 : .09, 1.1);
          });
          break;
      }
      return true;
    }

    setMuted(value) {
      this.muted = !!value;
      if (this.engine && typeof this.engine.mute === 'function') this.engine.mute(this.muted);
      this.nextNote = 0;
      this._mix(true);
      return this.muted;
    }

    setVolume(value) {
      if (!Number.isFinite(Number(value))) return this.volume;
      this.volume = clamp(Number(value), 0, 1);
      if (this.engine && typeof this.engine.setVolume === 'function') this.engine.setVolume(this.volume);
      this._mix(true);
      return this.volume;
    }

    stop() {
      this.wanted = false;
      this.started = false;
      this._removeGesture();
      for (const source of this._voices) { try { source.stop(); } catch (_) { /* Already stopped. */ } }
      this._voices.clear();
      for (const stream of this._streams) {
        try { stream.source.stop(); } catch (_) { /* Already stopped. */ }
        for (const node of [stream.source, stream.filter, stream.gain]) { try { node.disconnect(); } catch (_) { /* Already stopped. */ } }
      }
      this._streams.length = 0;
      for (const bus of [this.music, this.effects]) if (bus) { try { bus.disconnect(); } catch (_) { /* Already stopped. */ } }
      this.music = this.effects = this.sea = this.wind = null;
      this._cache.clear();
      this._last = Object.create(null);
      this.step = 0;
      this.nextNote = 0;
      this.danger = 0;
      // Keep the engine context available for the rest of the game.
      if (this._ownContext && this.context && this.context.state === 'running') this.context.suspend().catch(() => {});
    }
  }

  root.NacreAudio = NacreAudio;
})(typeof window !== 'undefined' ? window : globalThis);
