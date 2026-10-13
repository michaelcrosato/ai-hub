/*
 * FrontierAudio — original procedural sound for a frontier game.
 * No recordings, external files, music quotations, timers, or autoplay.
 * Call start() from a player gesture. Call update() during active play.
 */
(function (root) {
  'use strict';

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));
  const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);

  class FrontierAudio {
    constructor(game) {
      this.game = game || null;
      this.enabled = true;
      this.volume = 0.6;
      this.musicMode = 'calm';
      this.available = !!(root.AudioContext || root.webkitAudioContext);
      this.started = false;
      this.ctx = null;
      this._master = null;
      this._voices = new Set();
      this._buffers = new Map();
      this._seed = 0x2ce7a941;
      this._time = 0;
      this._windIn = 0;
      this._waterIn = 0;
      this._birdIn = 4;
      this._droneIn = 1;
      this._noteIn = 1.6;
      this._stepIn = 0.12;
      this._hoof = 0;
      this._phrase = 0;
      this._note = 0;
      this._focus = false;
      this._quiet = false;
      this._lastSfx = Object.create(null);
      this._state = {};
    }

    // Only this method creates or resumes an AudioContext.
    async start() {
      if (!this.enabled || !this.available) return false;
      try {
        if (!this.ctx) {
          const Context = root.AudioContext || root.webkitAudioContext;
          this.ctx = new Context({ latencyHint: 'interactive' });
          this._master = this.ctx.createGain();
          this._master.gain.value = this.volume * 0.52;
          const limiter = this.ctx.createDynamicsCompressor();
          limiter.threshold.value = -15;
          limiter.knee.value = 16;
          limiter.ratio.value = 5;
          limiter.attack.value = 0.004;
          limiter.release.value = 0.16;
          this._master.connect(limiter);
          limiter.connect(this.ctx.destination);
          this._limiter = limiter;
          this._makeNoise();
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.started = this.ctx.state === 'running';
        return this.started;
      } catch (_) {
        this.available = false;
        this.started = false;
        return false;
      }
    }

    enable(value) {
      this.enabled = !!value;
      this._setMaster();
      if (!this.enabled) this._stopVoices();
      return this.enabled;
    }

    setVolume(value) {
      this.volume = clamp(value, 0, 1);
      this._setMaster();
      return this.volume;
    }

    setMusicMode(mode) {
      const next = mode === 'tension' ? 'tension' : 'calm';
      if (next !== this.musicMode) {
        this.musicMode = next;
        this._note = 0;
        this._noteIn = Math.min(this._noteIn, 0.35);
        this._droneIn = Math.min(this._droneIn, 0.4);
      }
    }

    _setMaster() {
      if (!this.ctx || !this._master) return;
      const t = this.ctx.currentTime;
      const gain = this.enabled ? this.volume * 0.52 * (this._quiet ? 0.18 : 1) : 0;
      this._master.gain.cancelScheduledValues(t);
      this._master.gain.setTargetAtTime(gain, t, 0.045);
    }

    _random() {
      this._seed ^= this._seed << 13;
      this._seed ^= this._seed >>> 17;
      this._seed ^= this._seed << 5;
      return (this._seed >>> 0) / 4294967296;
    }

    _ready() {
      return this.enabled && this.started && this.ctx && this.ctx.state === 'running';
    }

    _makeNoise() {
      const rate = this.ctx.sampleRate;
      this._noise = this.ctx.createBuffer(1, rate * 3, rate);
      this._wind = this.ctx.createBuffer(1, rate * 3, rate);
      const dry = this._noise.getChannelData(0);
      const soft = this._wind.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < dry.length; i++) {
        const white = this._random() * 2 - 1;
        dry[i] = white;
        brown = (brown + 0.027 * white) / 1.027;
        soft[i] = brown * 4;
      }
    }

    // Every voice has a scheduled end and disconnects the full node chain.
    _voice(source, duration, volume, opts) {
      if (!this._ready() || this._voices.size >= 72) return null;
      const o = opts || {};
      const now = this.ctx.currentTime;
      const when = now + Math.max(0, Number(o.delay) || 0);
      const length = Math.max(0.018, duration);
      const end = when + length;
      const env = this.ctx.createGain();
      const nodes = [source, env];
      let tail = source;
      if (o.filter) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = o.filter;
        filter.frequency.value = clamp(o.cutoff || 1600, 30, 16000);
        filter.Q.value = clamp(o.q == null ? 0.65 : o.q, 0.01, 12);
        if (o.endCutoff) filter.frequency.exponentialRampToValueAtTime(o.endCutoff, end);
        tail.connect(filter);
        tail = filter;
        nodes.push(filter);
      }
      tail.connect(env);
      tail = env;
      if (this.ctx.createStereoPanner && o.pan) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = clamp(o.pan, -1, 1);
        tail.connect(panner);
        tail = panner;
        nodes.push(panner);
      }
      tail.connect(this._master);
      const peak = Math.max(0.00002, clamp(volume, 0, 1));
      const attack = Math.min(length * 0.35, Math.max(0.001, o.attack || 0.003));
      const release = Math.min(length * 0.55, Math.max(0.008, o.release || length * 0.75));
      env.gain.setValueAtTime(0.00001, when);
      env.gain.linearRampToValueAtTime(peak, when + attack);
      if (o.sustain) {
        env.gain.setValueAtTime(peak, Math.max(when + attack, end - release));
      }
      env.gain.exponentialRampToValueAtTime(0.00001, end);
      const voice = { source, env, nodes };
      this._voices.add(voice);
      source.onended = () => {
        this._voices.delete(voice);
        for (const node of nodes) {
          try { node.disconnect(); } catch (_) { /* Already detached. */ }
        }
        source.onended = null;
      };
      if (source.buffer) {
        const available = Math.max(0, source.buffer.duration - length - 0.01);
        source.start(when, o.offset == null ? this._random() * available : o.offset);
      } else source.start(when);
      source.stop(end + 0.025);
      return voice;
    }

    _noiseHit(duration, gain, opts) {
      if (!this._ready()) return;
      const source = this.ctx.createBufferSource();
      source.buffer = opts && opts.soft ? this._wind : this._noise;
      return this._voice(source, duration, gain, opts);
    }

    _tone(hz, duration, gain, opts) {
      if (!this._ready()) return;
      const o = opts || {};
      const source = this.ctx.createOscillator();
      source.type = o.type || 'sine';
      const when = this.ctx.currentTime + (o.delay || 0);
      source.frequency.setValueAtTime(hz, when);
      if (o.to) source.frequency.exponentialRampToValueAtTime(o.to, when + duration * 0.8);
      return this._voice(source, duration, gain, o);
    }

    _pluckBuffer(note) {
      if (this._buffers.has(note)) return this._buffers.get(note);
      const rate = 22050;
      const duration = 2.15;
      const hz = midiHz(note);
      const period = Math.max(4, Math.round(rate / hz - 0.5));
      const ring = new Float32Array(period);
      for (let i = 0; i < period; i++) ring[i] = (this._random() * 2 - 1) * 0.62;
      const buffer = this.ctx.createBuffer(1, Math.ceil(rate * duration), rate);
      const data = buffer.getChannelData(0);
      let cursor = 0;
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        const sample = ring[cursor];
        ring[cursor] = (sample + ring[(cursor + 1) % period]) * 0.4986;
        cursor = (cursor + 1) % period;
        const age = i / rate;
        previous += (sample - previous) * 0.68;
        const body = Math.sin(age * hz * Math.PI * 2) * Math.exp(-age * 5) * 0.12;
        data[i] = (previous + body) * Math.exp(-age * 0.7) * Math.min(1, age * 800);
      }
      this._buffers.set(note, buffer);
      return buffer;
    }

    _pluck(note, gain, delay, pan) {
      if (!this._ready()) return;
      const source = this.ctx.createBufferSource();
      source.buffer = this._pluckBuffer(note);
      this._voice(source, 2.12, gain, {
        offset: 0, delay: delay || 0, pan: pan || 0,
        filter: 'lowpass', cutoff: 2700, endCutoff: 650,
        attack: 0.002, release: 1.8
      });
    }

    _bird() {
      const pan = this._random() * 1.5 - 0.75;
      const pitch = 1650 + this._random() * 500;
      for (let i = 0; i < 3; i++) {
        this._tone(pitch + i * 130, 0.14, 0.018, {
          delay: i * 0.19, to: pitch + 550, pan, attack: 0.045
        });
      }
    }

    _footstep(mounted, water, speed) {
      const pan = this._hoof % 2 ? 0.10 : -0.10;
      this._hoof++;
      if (mounted) {
        const volume = 0.11 + clamp(speed / 18, 0, 1) * 0.045;
        this._tone(105 + this._random() * 22, 0.065, volume, { to: 55, pan });
        this._noiseHit(0.058, 0.075, { filter: 'bandpass', cutoff: 1050, q: 0.45, pan });
        this._tone(150, 0.045, volume * 0.50, { delay: 0.065, to: 70, pan: -pan });
        this._noiseHit(0.08, 0.035, { delay: 0.052, filter: 'lowpass', cutoff: 1700, pan: -pan });
      } else {
        this._noiseHit(0.17, 0.065, { filter: 'bandpass', cutoff: 630, q: 0.4, pan, attack: 0.012 });
        this._tone(70, 0.095, 0.040, { to: 42, pan });
      }
      if (water) this._noiseHit(0.27, mounted ? 0.11 : 0.06, {
        filter: 'bandpass', cutoff: 1700, q: 0.3, pan, attack: 0.022
      });
    }

    _music() {
      // Short original note cells. D minor pentatonic; no quoted tune.
      const cells = [
        [50, 57, 53, 60, 55, 57],
        [50, 55, 62, 57, 53, 55],
        [53, 60, 57, 55, 50, 57]
      ];
      const tension = this.musicMode === 'tension';
      const cell = cells[this._phrase % cells.length];
      const note = tension ? [50, 57, 50, 55, 53, 57][this._note] : cell[this._note];
      this._pluck(note, tension ? 0.13 : 0.19, 0, this._note % 2 ? 0.16 : -0.16);
      if (this._note === 0) this._pluck(38, tension ? 0.16 : 0.14, 0.02, -0.05);
      this._note++;
      if (this._note >= cell.length) {
        this._note = 0;
        this._phrase++;
        this._noteIn = tension ? 1.1 : 3.5 + this._random() * 2.8;
      } else this._noteIn = tension ? 0.56 + this._random() * 0.17 : 0.82 + this._random() * 0.6;
    }

    update(realDt, state) {
      if (!this._ready()) return;
      const dt = clamp(realDt, 0, 0.12);
      if (!dt) return;
      const s = state || {};
      this._state = s;
      const quiet = ['paused', 'pause', 'menu', 'loading'].includes(s.mode);
      if (quiet !== this._quiet) {
        this._quiet = quiet;
        this._setMaster();
      }
      if (quiet) return;
      this._time += dt;
      if (s.mode === 'calm' || s.mode === 'tension') this.setMusicMode(s.mode);
      else this.setMusicMode(s.combat ? 'tension' : 'calm');
      const focus = !!s.focus;
      if (focus && !this._focus) this.sfx('focus');
      this._focus = focus;
      const water = s.water === true || Number(s.water) > 0.25;
      const settlement = /town|camp|depot|settlement|station/i.test(String(s.region || ''));

      this._windIn -= dt;
      if (this._windIn <= 0) {
        this._windIn = 1.45;
        const swell = 0.037 + (Math.sin(this._time * 0.19) + 1) * 0.01;
        this._noiseHit(2.65, swell * (settlement ? 0.65 : 1), {
          soft: true, filter: 'lowpass', cutoff: 720 + this._random() * 350,
          attack: 0.7, release: 1.0, sustain: true, pan: this._random() * 0.4 - 0.2
        });
      }
      this._waterIn -= dt;
      if (water && this._waterIn <= 0) {
        this._waterIn = 0.85;
        this._noiseHit(1.4, 0.018, { filter: 'bandpass', cutoff: 1450, q: 0.3, attack: 0.3, sustain: true });
      }
      this._birdIn -= dt;
      if (this._birdIn <= 0) {
        this._birdIn = 8 + this._random() * 13;
        if (!s.combat && !settlement) this._bird();
      }
      this._droneIn -= dt;
      if (this._droneIn <= 0) {
        this._droneIn = 3.2;
        this._tone(73.416, 3.6, this.musicMode === 'tension' ? 0.027 : 0.016, {
          attack: 0.8, release: 1.1, sustain: true, pan: -0.12
        });
        this._tone(110.01, 3.5, 0.009, { attack: 0.95, release: 1, sustain: true, pan: 0.12 });
      }
      this._noteIn -= dt;
      if (this._noteIn <= 0 && !focus) this._music();
      if (s.moving) {
        this._stepIn -= dt;
        if (this._stepIn <= 0) {
          const speed = Math.abs(Number(s.speed) || (s.mounted ? 6 : 2));
          this._footstep(!!s.mounted, water, speed);
          this._stepIn = s.mounted
            ? clamp(0.68 - speed * 0.028, 0.22, 0.58)
            : clamp(0.62 - speed * 0.056, 0.25, 0.59);
        }
      } else this._stepIn = 0.07;
    }

    sfx(name, opts) {
      if (!this._ready()) return false;
      const o = opts || {};
      const volume = o.volume == null ? 1 : clamp(o.volume, 0, 2);
      const pan = clamp(o.pan || 0, -1, 1);
      const key = String(name || '').toLowerCase();
      const t = this.ctx.currentTime;
      if (this._lastSfx[key] != null && t - this._lastSfx[key] < 0.038) return false;
      this._lastSfx[key] = t;
      const tone = (hz, dur, gain, extra) => this._tone(hz, dur, gain * volume, Object.assign({ pan }, extra));
      const noise = (dur, gain, extra) => this._noiseHit(dur, gain * volume, Object.assign({ pan }, extra));

      switch (key) {
        case 'shot': case 'shoot': case 'gunshot': case 'revolver': case 'gun':
          noise(0.072, 0.43, { filter: 'highpass', cutoff: 650, attack: 0.001 });
          noise(0.27, 0.15, { filter: 'lowpass', cutoff: 900, attack: 0.001 });
          tone(160, 0.13, 0.19, { to: 48, attack: 0.001 });
          noise(0.18, 0.034, { delay: 0.14, filter: 'bandpass', cutoff: 650, pan: -pan });
          break;
        case 'reload':
          [0, 0.12, 0.34, 0.54].forEach((delay, i) => {
            noise(0.045, i === 3 ? 0.1 : 0.065, { delay, filter: 'bandpass', cutoff: 1500 + i * 300, q: 1.5 });
            tone(920 + i * 110, 0.034, 0.028, { delay, to: 520 });
          });
          break;
        case 'whistle': case 'call':
          tone(1100, 0.24, 0.085, { to: 1720, attack: 0.05 });
          tone(1710, 0.37, 0.08, { delay: 0.26, to: 1380, attack: 0.04 });
          break;
        case 'bell': case 'alarm':
          [1, 2.71, 4.11].forEach((ratio, i) => {
            tone(610 * ratio, 2.3 - i * 0.45, 0.14 / (i + 1), { attack: 0.001 });
          });
          break;
        case 'pickup': case 'collect': case 'interact':
          noise(0.12, 0.035, { filter: 'lowpass', cutoff: 900, attack: 0.02 });
          this._pluck(57, 0.18 * volume, 0, pan);
          this._pluck(62, 0.12 * volume, 0.1, pan);
          break;
        case 'heal': case 'eat': case 'feed': case 'care':
          noise(0.35, 0.028, { filter: 'lowpass', cutoff: 450, attack: 0.09 });
          this._pluck(50, 0.2 * volume, 0, pan);
          this._pluck(57, 0.12 * volume, 0.2, pan);
          break;
        case 'denied': case 'empty': case 'dryfire':
          noise(0.044, 0.11, { filter: 'bandpass', cutoff: 1450, q: 1.9 });
          tone(190, 0.06, 0.044, { to: 130 });
          break;
        case 'focus':
          noise(0.5, 0.04, { soft: true, filter: 'bandpass', cutoff: 480, q: 0.5, attack: 0.12 });
          tone(147, 0.65, 0.055, { to: 73.4, attack: 0.12 });
          break;
        case 'hit': case 'impact':
          noise(0.10, 0.13, { filter: 'lowpass', cutoff: 650 });
          tone(90, 0.07, 0.11, { to: 45 });
          break;
        case 'hurt': case 'damage':
          noise(0.19, 0.14, { filter: 'lowpass', cutoff: 480, attack: 0.008 });
          tone(65, 0.26, 0.10, { to: 42, attack: 0.015 });
          break;
        case 'step': case 'footstep':
          this._footstep(false, !!o.water, o.speed || 2);
          break;
        case 'hoof': case 'horse':
          this._footstep(true, !!o.water, o.speed || 7);
          break;
        case 'win': case 'success': case 'victory': case 'complete':
          [50, 57, 62, 65].forEach((note, i) => this._pluck(note, (0.24 - i * 0.025) * volume, i * 0.22, pan));
          break;
        case 'death': case 'fail':
          this._pluck(50, 0.17 * volume, 0, pan);
          this._pluck(41, 0.15 * volume, 0.23, pan);
          tone(73.4, 1.4, 0.05, { to: 55, attack: 0.1 });
          break;
        case 'click': case 'ui':
          noise(0.03, 0.045, { filter: 'bandpass', cutoff: 1050 });
          break;
        default:
          return false;
      }
      return true;
    }

    _stopVoices() {
      for (const voice of this._voices) {
        try { voice.source.stop(); } catch (_) { /* Already stopped. */ }
        for (const node of voice.nodes) {
          try { node.disconnect(); } catch (_) { /* Already detached. */ }
        }
        voice.source.onended = null;
      }
      this._voices.clear();
    }

    // Optional host cleanup. No timers or event listeners need removal.
    dispose() {
      this._stopVoices();
      this.started = false;
      this._buffers.clear();
      if (this.ctx) {
        try {
          const closing = this.ctx.close();
          if (closing && closing.catch) closing.catch(() => {});
        } catch (_) { /* Audio was unavailable or already closed. */ }
      }
      this.ctx = null;
      this._master = null;
      this._limiter = null;
    }
  }

  root.FrontierAudio = FrontierAudio;
})(typeof window !== 'undefined' ? window : globalThis);
