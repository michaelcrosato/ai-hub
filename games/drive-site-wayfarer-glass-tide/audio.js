/*
 * Wayfarer: The Glass Tide — original score and sound design.
 *
 * The score uses 32-bar forms, written for this game. The village, coast and
 * title share a theme; the receiver and combat have separate themes. All sound
 * is made in Web Audio. There are no samples, downloads or speech services.
 *
 * Usage: const sound = new WayfarerSound(game);
 * In a user gesture: sound.unlock();
 * Then: sound.setMode('field'); sound.sfx('pickup');
 */
(function (global) {
  'use strict';

  const HOLD = -1;
  const REST = 0;
  const MAX_VOICES = 80;
  const VALID_MODES = new Set(['village', 'field', 'ruins', 'battle', 'boss', 'victory', 'title']);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const pitch = name => {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return REST;
    return (Number(m[3]) + 1) * 12 + ({C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[m[1]])
      + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
  const phrase = rows => rows.map(row => row.trim().split(/\s+/).map(v => v === '-' ? HOLD : v === '.' ? REST : pitch(v)));
  const chord = (root, notes) => ({ root: pitch(root), notes: notes.split(' ').map(pitch) });

  // Eight eighth-note positions per bar. A dash sustains the previous note.
  // Section A is a quiet question; section B rises and then returns to the coast.
  const COAST = phrase([
    'D5 - A4 F#4 E5 - F#5 -',
    'E5 - C#5 B4 A4 - E4 -',
    'B4 - - A4 F#4 - D4 -',
    'D5 - F#5 - F#5 E5 D5 -',
    'B4 - G4 E4 F#4 - A4 -',
    'A4 - F#4 - D5 - F#5 -',
    'G5 - F#5 E5 D5 - B4 -',
    'C#5 - E5 - A4 - . .',
    'F#5 - A5 - F#5 E5 D5 -',
    'E5 - C#5 A4 C#5 - E5 -',
    'G5 - - F#5 D5 - B4 -',
    'F#5 - E5 - D5 - A4 -',
    'B4 D5 E5 - D5 - B4 -',
    'D5 - B4 - A4 G4 F#4 -',
    'E4 - A4 - D5 - E5 -',
    'C#5 - A4 - - - . .',
    'A4 - D5 - F#5 - E5 D5',
    'E5 - A5 - E5 C#5 B4 A4',
    'F#5 - D5 - B4 - A4 F#4',
    'G4 - B4 - D5 E5 F#5 -',
    'E5 - G5 F#5 E5 - B4 -',
    'F#5 - A5 - F#5 - D5 -',
    'G5 - F#5 - D5 - B4 A4',
    'C#5 E5 A5 - G5 E5 C#5 -',
    'B5 - A5 F#5 D5 - F#5 -',
    'A5 - E5 - C#5 A4 F#4 -',
    'B4 D5 G5 - F#5 - E5 D5',
    'F#5 - E5 D5 A4 - D5 -',
    'E5 - D5 B4 G4 - B4 -',
    'D5 - G5 - F#5 E5 D5 -',
    'E5 - C#5 - A4 - E5 -',
    'D5 - - - - - . .'
  ]);
  const COAST_CHORDS = [
    chord('D3', 'D4 F#4 A4 C#5'), chord('C#3', 'C#4 E4 A4 B4'),
    chord('B2', 'B3 D4 F#4 A4'), chord('G2', 'G3 B3 D4 F#4'),
    chord('E2', 'G3 B3 D4 F#4'), chord('F#2', 'A3 D4 F#4 A4'),
    chord('G2', 'A3 B3 D4 F#4'), chord('A2', 'A3 C#4 E4 G4'),
    chord('B2', 'B3 D4 F#4 A4'), chord('F#2', 'A3 C#4 E4 A4'),
    chord('G2', 'G3 B3 D4 F#4'), chord('D3', 'D4 F#4 A4 C#5'),
    chord('E2', 'G3 B3 D4 F#4'), chord('G2', 'G3 B3 D4 F#4'),
    chord('A2', 'A3 D4 E4 A4'), chord('A2', 'A3 C#4 E4 G4')
  ];
  const RECEIVER = phrase([
    'F#4 - - - B4 - A4 -', 'F#4 - E4 - D4 - - -',
    'G4 - - - B4 - D5 -', 'C#5 - A#4 - F#4 - . .',
    'E4 - B4 - G4 - - -', 'A4 - - - E5 - C#5 -',
    'D5 - C#5 - B4 - A4 -', 'F#4 - - - - - . .',
    'B4 - D5 - F#5 - - -', 'E5 - - D5 C#5 - A4 -',
    'B4 - D5 - G5 - F#5 -', 'E5 - C#5 - A#4 - - -',
    'B4 - G4 - E4 - B4 -', 'A4 - C#5 - E5 - - -',
    'D5 - F#5 - C#5 - A#4 -', 'B4 - - - - - . .',
    'B4 - - F#4 A4 - B4 -', 'D5 - A4 - F#4 - . .',
    'B4 - G4 - D5 - B4 -', 'C#5 - - A#4 F#4 - . .',
    'G4 - B4 - E5 - D5 -', 'C#5 - E5 - A4 - - -',
    'F#5 - D5 - C#5 - A4 -', 'B4 - - - F#4 - . .',
    'D5 - F#5 - A5 - F#5 -', 'E5 - C#5 - A4 - C#5 -',
    'D5 - G5 - F#5 - D5 -', 'C#5 - - A#4 F#4 - - -',
    'B4 - E5 - D5 - B4 -', 'C#5 - A4 - E4 - A4 -',
    'D5 - C#5 - A#4 - F#4 -', 'B4 - - - - - . .'
  ]);
  const MINOR_CHORDS = [
    chord('B2', 'B3 D4 F#4 A4'), chord('D3', 'A3 D4 F#4 A4'),
    chord('G2', 'G3 B3 D4 F#4'), chord('F#2', 'A#3 C#4 F#4 A#4'),
    chord('E2', 'G3 B3 D4 F#4'), chord('A2', 'A3 C#4 E4 B4'),
    chord('D3', 'A3 D4 F#4 A4'), chord('B2', 'B3 D4 F#4 A4'),
    chord('B2', 'B3 D4 F#4 A4'), chord('F#2', 'A3 C#4 E4 A4'),
    chord('G2', 'G3 B3 D4 F#4'), chord('F#2', 'A#3 C#4 E4 F#4'),
    chord('E2', 'G3 B3 D4 F#4'), chord('A2', 'A3 C#4 E4 A4'),
    chord('F#2', 'A#3 C#4 E4 F#4'), chord('B2', 'B3 D4 F#4 A4')
  ];
  const COMBAT = phrase([
    'B4 B4 D5 F#5 E5 D5 B4 A4', 'G4 B4 D5 F#5 G5 F#5 D5 B4',
    'F#5 - E5 D5 A4 D5 E5 F#5', 'E5 C#5 A4 E4 A4 C#5 E5 -',
    'E5 D5 B4 G4 F#4 G4 B4 D5', 'C#5 A4 F#4 A4 C#5 E5 F#5 -',
    'G5 F#5 D5 B4 A4 B4 D5 F#5', 'F#5 E5 C#5 A#4 F#4 - A#4 C#5',
    'B5 - A5 F#5 E5 F#5 A5 B5', 'A5 G5 F#5 D5 B4 D5 F#5 G5',
    'A5 F#5 E5 D5 F#5 A5 F#5 -', 'E5 A4 C#5 E5 G5 E5 C#5 A4',
    'B4 E5 G5 F#5 E5 D5 B4 G4', 'A4 C#5 F#5 E5 C#5 A4 F#4 -',
    'G4 B4 D5 G5 F#5 D5 B4 D5', 'C#5 A#4 F#4 A#4 C#5 F#5 A#5 -',
    'F#5 B4 D5 F#5 A5 F#5 E5 D5', 'B4 D5 G5 F#5 D5 B4 G4 -',
    'A4 D5 F#5 A5 F#5 E5 D5 A4', 'C#5 E5 A5 G5 E5 C#5 A4 -',
    'G5 E5 D5 B4 G4 B4 D5 E5', 'F#5 E5 C#5 A4 F#4 A4 C#5 -',
    'B4 D5 G5 - F#5 E5 D5 B4', 'A#4 C#5 E5 F#5 C#5 A#4 F#4 -',
    'D5 F#5 B5 A5 F#5 D5 F#5 -', 'G5 F#5 D5 B4 G4 B4 D5 G5',
    'F#5 A5 D6 - A5 F#5 E5 D5', 'E5 C#5 A4 C#5 E5 G5 E5 -',
    'E5 G5 B5 A5 G5 E5 D5 B4', 'C#5 F#5 A5 - F#5 E5 C#5 A4',
    'B4 D5 F#5 G5 F#5 D5 B4 -', 'A#4 C#5 E5 F#5 A#5 F#5 C#5 -'
  ]);
  const COMBAT_CHORDS = [
    chord('B2', 'B3 D4 F#4 A4'), chord('G2', 'G3 B3 D4 F#4'),
    chord('D3', 'A3 D4 F#4 A4'), chord('A2', 'A3 C#4 E4 G4'),
    chord('E2', 'G3 B3 D4 E4'), chord('F#2', 'A3 C#4 E4 F#4'),
    chord('G2', 'G3 B3 D4 F#4'), chord('F#2', 'A#3 C#4 E4 F#4')
  ];
  const RETURN = phrase([
    'D5 - F#5 - A5 - B5 A5', 'E5 - A5 - E5 C#5 B4 A4',
    'F#5 - D5 - B4 D5 F#5 -', 'G5 - F#5 E5 D5 - B4 -',
    'E5 - G5 - F#5 E5 D5 B4', 'D5 - F#5 - A5 - F#5 -',
    'B4 - D5 - G5 - F#5 E5', 'E5 - C#5 - A4 - . .',
    'B5 - A5 F#5 D5 - F#5 -', 'A5 - E5 - C#5 - A4 -',
    'B4 D5 G5 - F#5 - E5 D5', 'F#5 - E5 - D5 - A4 -',
    'E5 - B4 - G4 - B4 -', 'D5 - G5 - F#5 E5 D5 -',
    'E5 - C#5 - A4 - E5 -', 'D5 - - - - - . .'
  ]);
  const PROFILES = {
    title:   { bpm: 76, melody: COAST, chords: COAST_CHORDS, lead: 'flute', pad: .016, pluck: .020, bass: .043, melodyGain: .060, air: .009 },
    village: { bpm: 88, melody: COAST, chords: COAST_CHORDS, lead: 'flute', pad: .014, pluck: .028, bass: .050, melodyGain: .061, air: .006 },
    field:   { bpm: 108, melody: COAST, chords: COAST_CHORDS, lead: 'reed', pad: .013, pluck: .029, bass: .054, melodyGain: .058, air: .014 },
    ruins:   { bpm: 72, melody: RECEIVER, chords: MINOR_CHORDS, lead: 'bell', pad: .020, pluck: .016, bass: .044, melodyGain: .045, air: .010 },
    battle:  { bpm: 140, melody: COMBAT, chords: COMBAT_CHORDS, lead: 'reed', pad: .009, pluck: .023, bass: .072, melodyGain: .059, air: 0, combat: true },
    boss:    { bpm: 152, melody: COMBAT, chords: COMBAT_CHORDS, lead: 'reed', pad: .013, pluck: .026, bass: .079, melodyGain: .065, air: .006, combat: true, transpose: -2 },
    victory: { bpm: 100, melody: RETURN, chords: COAST_CHORDS, lead: 'bell', pad: .016, pluck: .029, bass: .055, melodyGain: .052, air: .004 }
  };
  const SFX_GAPS = { attack: .06, art: .12, hit: .055, hurt: .16, dodge: .12, heal: .25,
    pickup: .07, menu: .045, confirm: .08, relay: .4, levelup: .65, link: .4, defeat: 1, boss: 1 };

  class WayfarerSound {
    constructor(game) {
      this.game = game || null;
      this.ctx = null;
      this.mode = 'title';
      this.volume = .72;
      this.muted = false;
      this.failed = null;
      this._unlocked = false;
      this._suspended = false;
      this._destroyed = false;
      this._hidden = typeof document !== 'undefined' && document.hidden;
      this._timer = null;
      this._voices = new Set();
      this._last = Object.create(null);
      this._bar = 0;
      this._step = 0;
      this._next = 0;
      this._seed = 0x734a31;
      this._onVisibility = () => {
        this._hidden = document.hidden;
        if (this._hidden) this._haltContext();
        else if (!this._suspended && this._unlocked) this._runContext();
      };
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVisibility);
    }

    get ready() { return !!this.ctx && this.ctx.state === 'running' && !this._suspended && !this._hidden; }

    // Call directly in the same event handler as a Play click, key, or touch.
    // No context is created by setMode(), sfx(), resume(), or the constructor.
    unlock() {
      if (this._destroyed) return Promise.resolve(false);
      if (!this.ctx && !this._init()) return Promise.resolve(false);
      this._unlocked = true;
      this._suspended = false;
      return this._runContext();
    }

    setMode(mode) {
      if (!VALID_MODES.has(mode) || mode === this.mode) return this.mode;
      this.mode = mode;
      this._bar = 0;
      this._step = 0;
      if (this.ctx) {
        this._stopChannel('music', .12);
        this._next = this.ctx.currentTime + .15;
        if (this.ready && !this.muted) this._startTimer();
      }
      return this.mode;
    }

    setMuted(value) {
      this.muted = !!value;
      this._levels();
      if (this.muted) {
        this._clearTimer();
        this._stopChannel(null, .035);
      } else if (this.ready) {
        this._next = this.ctx.currentTime + .055;
        this._startTimer();
      }
      return this.muted;
    }

    setVolume(value) {
      const v = Number(value);
      if (Number.isFinite(v)) this.volume = clamp(v, 0, 1);
      this._levels();
      return this.volume;
    }

    suspend() {
      this._suspended = true;
      return this._haltContext();
    }

    resume() {
      this._suspended = false;
      if (!this.ctx || !this._unlocked || this._destroyed) return Promise.resolve(false);
      return this._runContext();
    }

    _random() {
      this._seed = (Math.imul(1664525, this._seed) + 1013904223) >>> 0;
      return this._seed / 4294967296;
    }

    _init() {
      if (this.ctx || this._destroyed) return !!this.ctx;
      try {
        const Context = global.AudioContext || global.webkitAudioContext;
        if (!Context) { this.failed = 'Web Audio is not available.'; return false; }
        const c = new Context({ latencyHint: 'interactive' });
        this.ctx = c;
        this.master = c.createGain();
        this.musicBus = c.createGain();
        this.sfxBus = c.createGain();
        this.musicBus.gain.value = .72;
        this.sfxBus.gain.value = .8;
        this.master.gain.value = this.muted ? 0 : this.volume;
        const compressor = this.compressor = c.createDynamicsCompressor();
        compressor.threshold.value = -17;
        compressor.knee.value = 18;
        compressor.ratio.value = 3;
        compressor.attack.value = .006;
        compressor.release.value = .22;
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(compressor);
        compressor.connect(c.destination);

        this.noise = c.createBuffer(1, Math.ceil(c.sampleRate * 2), c.sampleRate);
        const noiseData = this.noise.getChannelData(0);
        let smooth = 0;
        for (let i = 0; i < noiseData.length; i++) {
          // A little low-frequency energy makes wind and drums less brittle.
          const white = this._random() * 2 - 1;
          smooth = smooth * .985 + white * .015;
          noiseData[i] = white * .72 + smooth * 2.4;
        }
        const impulse = c.createBuffer(2, Math.ceil(c.sampleRate * 1.15), c.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
          const data = impulse.getChannelData(channel);
          let tail = 0;
          for (let i = 0; i < data.length; i++) {
            tail = .58 * tail + .42 * (this._random() * 2 - 1);
            data[i] = tail * Math.pow(1 - i / data.length, 2.8) * .48;
          }
        }
        this.reverb = c.createConvolver();
        this.reverb.buffer = impulse;
        this.wet = c.createGain();
        this.wet.gain.value = .20;
        this.reverb.connect(this.wet);
        this.wet.connect(this.master);
        this.musicSend = c.createGain();
        this.musicSend.gain.value = .25;
        this.musicBus.connect(this.musicSend);
        this.musicSend.connect(this.reverb);
        this.sfxSend = c.createGain();
        this.sfxSend.gain.value = .12;
        this.sfxBus.connect(this.sfxSend);
        this.sfxSend.connect(this.reverb);

        this.waves = {};
        for (const [name, harmonics] of Object.entries({
          flute: [0, 1, .08, .12, .025, .018],
          reed: [0, 1, .22, .18, .055, .035, .015],
          pluck: [0, 1, .32, .14, .06, .018],
          pad: [0, 1, .10, .075, .018]
        })) {
          this.waves[name] = c.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
        }
        this._onState = () => {
          if (c.state !== 'running') this._clearTimer();
          else if (!this._suspended && !this._hidden && !this.muted && this._unlocked) this._startTimer();
        };
        c.addEventListener('statechange', this._onState);
        return true;
      } catch (error) {
        this.failed = error && error.message ? error.message : String(error);
        if (this.ctx) { try { this.ctx.close(); } catch (_) { /* no context to close */ } }
        this.ctx = null;
        return false;
      }
    }

    _levels() {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, .025);
    }

    _runContext() {
      const c = this.ctx;
      if (!c || this._destroyed || this._hidden || this._suspended) return Promise.resolve(false);
      // resume() is issued synchronously so the caller's user activation applies.
      let resumed;
      try { resumed = c.state === 'running' ? Promise.resolve() : c.resume(); }
      catch (_) { return Promise.resolve(false); }
      return Promise.resolve(resumed).then(() => {
        if (!this.ready) return false;
        this._levels();
        // A repeated unlock gesture must not move the musical clock forward.
        // The statechange event may already have restarted the scheduler.
        if (!this._timer) {
          this._next = c.currentTime + .06;
          if (!this.muted) this._startTimer();
        }
        return true;
      }).catch(() => false);
    }

    _haltContext() {
      this._clearTimer();
      this._stopChannel(null, 0);
      this._next = 0;
      const c = this.ctx;
      if (!c || c.state === 'closed') return Promise.resolve(false);
      try { return Promise.resolve(c.suspend()).then(() => true).catch(() => false); }
      catch (_) { return Promise.resolve(false); }
    }

    _startTimer() {
      if (this._timer || !this.ready || this.muted || this._destroyed) return;
      if (!this._next || this._next < this.ctx.currentTime) this._next = this.ctx.currentTime + .055;
      this._schedule();
      this._timer = global.setInterval(() => this._schedule(), 25);
    }

    _clearTimer() {
      if (this._timer !== null) global.clearInterval(this._timer);
      this._timer = null;
    }

    _schedule() {
      if (!this.ready || this.muted || this._destroyed) return;
      const c = this.ctx;
      if (this._next < c.currentTime - .12) this._next = c.currentTime + .035;
      let guard = 0;
      while (this._next < c.currentTime + .16 && guard++ < 24) {
        const profile = PROFILES[this.mode];
        const eighth = 30 / profile.bpm;
        this._musicStep(profile, this._bar, this._step, this._next, eighth);
        this._next += eighth;
        this._step++;
        if (this._step === 8) { this._step = 0; this._bar = (this._bar + 1) % 32; }
      }
    }

    _musicStep(p, bar, step, t, eighth) {
      const transpose = p.transpose || 0;
      const finalCadence = (bar === 31 && p.chords === COAST_CHORDS)
        || (this.mode === 'victory' && bar % 16 === 15);
      const harmony = finalCadence ? COAST_CHORDS[0] : p.chords[bar % p.chords.length];
      const notes = harmony.notes;
      const section = Math.floor(bar / 8);
      const row = p.melody[bar % p.melody.length];
      const note = row[step];
      const gentle = this.mode === 'title' || this.mode === 'ruins';
      const push = 1 + .055 * (section % 2);

      if (step === 0) {
        for (let i = 0; i < notes.length; i++) {
          this._tone(notes[i] + transpose, t + i * .014, eighth * 8.8, p.pad * push,
            { channel: 'music', wave: 'pad', attack: gentle ? .33 : .16, release: .45,
              sustain: true, cutoff: this.mode === 'ruins' ? 1300 : 1750, pan: (i - 1.5) * .20, detune: (i % 2 ? 2 : -2) });
        }
        if (p.air && bar % 2 === 0) {
          this._noise(t, eighth * 16, p.air, { channel: 'music', frequency: this.mode === 'ruins' ? 440 : 290,
            filter: 'lowpass', attack: .55, release: .6, pan: Math.sin(bar) * .25 });
        }
      }

      if (note > 0) {
        let count = 1;
        while (step + count < 8 && row[step + count] === HOLD) count++;
        this._tone(note + transpose, t, count * eighth * .92, p.melodyGain * push,
          { channel: 'music', wave: p.lead, attack: p.lead === 'bell' ? .008 : .032,
            release: p.lead === 'bell' ? .32 : .10, sustain: p.lead !== 'bell',
            cutoff: p.combat ? 3100 : 2700, pan: -.08 });
        // A quiet delayed answer adds space without a feedback loop.
        if ((gentle && step % 4 === 0) || (this.mode === 'victory' && count >= 2)) {
          this._tone(note + transpose, t + eighth * 1.5, count * eighth * .64, p.melodyGain * .15,
            { channel: 'music', wave: 'bell', attack: .012, release: .2, cutoff: 1900, pan: .34 });
        }
      }

      const arpPositions = gentle ? [0, 3, 5, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
      if (arpPositions.includes(step) && !(this.mode === 'title' && section === 0 && step === 7)) {
        const order = section % 2 ? [0, 2, 3, 1, 2, 1, 3, 2] : [0, 1, 2, 3, 2, 1, 3, 1];
        const upper = this.mode === 'ruins' || (this.mode === 'title' && section >= 2) ? 12 : 0;
        this._tone(notes[order[step]] + transpose + upper, t + .012, eighth * .74, p.pluck * (step % 2 ? .78 : 1),
          { channel: 'music', wave: 'pluck', attack: .006, release: .14, cutoff: gentle ? 2000 : 3000,
            pan: step % 2 ? .30 : -.30 });
      }

      if (p.combat ? step % 2 === 0 || step === 7 : step === 0 || step === 4) {
        const bassNote = harmony.root + transpose + (step === 4 ? 7 : step === 7 ? 12 : 0);
        this._tone(bassNote, t, eighth * (p.combat ? 1.45 : 3.1), p.bass,
          { channel: 'music', wave: 'triangle', attack: .018, release: .13, sustain: true, cutoff: 720, pan: 0 });
      }

      if (p.combat) {
        if (step === 0 || step === 4 || (this.mode === 'boss' && step === 3)) this._drum('kick', t, .12);
        if (step === 2 || step === 6) this._drum('snare', t, .049);
        this._drum('hat', t, step % 2 ? .016 : .024);
        if (bar % 8 === 7 && step >= 5) this._drum('tom', t, .062, 7 - step);
      } else if (this.mode === 'field' || this.mode === 'victory') {
        if (step === 0 || step === 4) this._drum('kick', t, .039);
        if (step === 2 || step === 6) this._drum('rim', t, .023);
        if (step % 2 === 1 && section > 0) this._drum('hat', t, .009);
      } else if (this.mode === 'village' && (step === 2 || step === 6)) {
        this._drum('rim', t, .016);
      }
    }

    _drum(kind, t, gain, shift = 0) {
      if (kind === 'kick') {
        this._tone(43, t, .17, gain, { channel: 'music', wave: 'sine', freq: 108, to: 43, attack: .003, release: .07 });
      } else if (kind === 'snare') {
        this._noise(t, .13, gain, { channel: 'music', frequency: 1650, filter: 'bandpass', q: .55, attack: .002 });
        this._tone(48, t, .09, gain * .64, { channel: 'music', wave: 'triangle', freq: 175, to: 112, attack: .003 });
      } else if (kind === 'hat') {
        this._noise(t, .035, gain, { channel: 'music', frequency: 5800, filter: 'highpass', attack: .002 });
      } else if (kind === 'rim') {
        this._tone(78, t, .033, gain, { channel: 'music', wave: 'sine', freq: 735, to: 420, attack: .002 });
        this._noise(t, .029, gain * .48, { channel: 'music', frequency: 2100, filter: 'bandpass', attack: .002 });
      } else if (kind === 'tom') {
        this._tone(46 + shift * 3, t, .19, gain, { channel: 'music', wave: 'triangle', to: hz(37 + shift * 3), attack: .003 });
      }
    }

    _envelope(gainNode, t, duration, level, options) {
      const attack = Math.min(duration * .40, Math.max(.002, options.attack || .006));
      const release = Math.max(.008, options.release || .045);
      const end = t + Math.max(.025, duration);
      const g = gainNode.gain;
      g.setValueAtTime(.00001, t);
      g.linearRampToValueAtTime(Math.max(.00002, level), t + attack);
      if (options.sustain) {
        const hold = Math.max(t + attack, end - Math.min(release, duration * .38));
        g.setValueAtTime(Math.max(.00002, level * .8), hold);
        g.exponentialRampToValueAtTime(.00001, end + release);
      } else {
        g.exponentialRampToValueAtTime(.00001, end + release);
      }
      return end + release + .025;
    }

    _attach(source, nodes, gain, t, end, channel, level) {
      if (this._voices.size >= MAX_VOICES) {
        const expendable = Array.from(this._voices).find(v => v.channel === 'music') || this._voices.values().next().value;
        if (expendable) this._dispose(expendable);
      }
      const voice = { source, nodes, gain, start: t, end, channel: channel || 'sfx', level, dead: false };
      this._voices.add(voice);
      source.onended = () => this._dispose(voice, true);
      source.start(t);
      source.stop(end);
      return voice;
    }

    _tone(midi, when, duration, level, options = {}) {
      const c = this.ctx;
      if (!c || this._destroyed || this.muted || this._suspended || this._hidden) return;
      const t = Math.max(c.currentTime + .001, when);
      const source = c.createOscillator();
      const gain = c.createGain();
      const filter = c.createBiquadFilter();
      const nodes = [source, gain, filter];
      const wave = options.wave || 'sine';
      if (this.waves[wave]) source.setPeriodicWave(this.waves[wave]);
      else source.type = wave === 'bell' ? 'sine' : wave;
      source.frequency.setValueAtTime(Math.max(25, options.freq || hz(midi)), t);
      if (options.to) source.frequency.exponentialRampToValueAtTime(Math.max(25, options.to), t + Math.max(.015, duration * .85));
      source.detune.value = options.detune || 0;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(options.cutoff || 3800, t);
      filter.Q.value = .55;
      source.connect(filter);
      filter.connect(gain);
      const destination = options.channel === 'music' ? this.musicBus : this.sfxBus;
      if (typeof c.createStereoPanner === 'function' && options.pan) {
        const pan = c.createStereoPanner();
        pan.pan.value = clamp(options.pan, -1, 1);
        gain.connect(pan);
        pan.connect(destination);
        nodes.push(pan);
      } else gain.connect(destination);
      const end = this._envelope(gain, t, duration, level, options);
      this._attach(source, nodes, gain, t, end, options.channel, level);
      if (wave === 'bell') {
        this._tone(midi + 12, t + .004, duration * .68, level * .16,
          { ...options, wave: 'sine', attack: .004, release: .13, cutoff: 2600 });
      }
    }

    _noise(when, duration, level, options = {}) {
      const c = this.ctx;
      if (!c || this._destroyed || this.muted || this._suspended || this._hidden) return;
      const t = Math.max(c.currentTime + .001, when);
      const source = c.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const gain = c.createGain();
      const filter = c.createBiquadFilter();
      const nodes = [source, gain, filter];
      filter.type = options.filter || 'bandpass';
      filter.frequency.setValueAtTime(options.frequency || 1000, t);
      filter.Q.value = options.q || .7;
      if (options.to) filter.frequency.exponentialRampToValueAtTime(Math.max(30, options.to), t + Math.max(.02, duration));
      source.connect(filter);
      filter.connect(gain);
      const destination = options.channel === 'music' ? this.musicBus : this.sfxBus;
      if (typeof c.createStereoPanner === 'function' && options.pan) {
        const pan = c.createStereoPanner();
        pan.pan.value = clamp(options.pan, -1, 1);
        gain.connect(pan);
        pan.connect(destination);
        nodes.push(pan);
      } else gain.connect(destination);
      const end = this._envelope(gain, t, duration, level, options);
      this._attach(source, nodes, gain, t, end, options.channel, level);
    }

    _dispose(voice, ended = false) {
      if (!voice || voice.dead) return;
      voice.dead = true;
      voice.source.onended = null;
      if (!ended) { try { voice.source.stop(); } catch (_) { /* already stopped */ } }
      for (const node of voice.nodes) { try { node.disconnect(); } catch (_) { /* already disconnected */ } }
      this._voices.delete(voice);
    }

    _stopChannel(channel, fade) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (const voice of Array.from(this._voices)) {
        if (channel && voice.channel !== channel) continue;
        if (!fade || voice.start > t) { this._dispose(voice); continue; }
        try {
          const g = voice.gain.gain;
          if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(t);
          else { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(.00001, voice.level * .5), t); }
          g.exponentialRampToValueAtTime(.00001, t + fade);
          voice.source.stop(t + fade + .015);
        } catch (_) { this._dispose(voice); }
      }
    }

    sfx(name) {
      if (!this.ready || this.muted || this._destroyed || !Object.prototype.hasOwnProperty.call(SFX_GAPS, name)) return false;
      const t = this.ctx.currentTime + .008;
      if (t - (this._last[name] === undefined ? -100 : this._last[name]) < SFX_GAPS[name]) return false;
      this._last[name] = t;
      const tone = (note, delay, duration, gain, opts = {}) => this._tone(typeof note === 'string' ? pitch(note) : note, t + delay, duration, gain, opts);
      const noise = (delay, duration, gain, opts) => this._noise(t + delay, duration, gain, opts);
      const run = (notes, spacing, gain, duration = .28, wave = 'bell') => notes.forEach((note, i) => tone(note, i * spacing, duration, gain * (1 - i * .035), { wave, cutoff: 3000 }));
      switch (name) {
        case 'attack':
          noise(0, .13, .095, { frequency: 1450, to: 480, q: .6, attack: .012 });
          tone(57, 0, .085, .038, { wave: 'triangle', freq: 230, to: 125, cutoff: 1200 });
          break;
        case 'art':
          run(['D4', 'F#4', 'A4', 'D5', 'E5'], .037, .077, .27, 'pluck');
          noise(.02, .27, .055, { frequency: 750, to: 2400, attack: .09, q: .45 });
          break;
        case 'hit':
          tone(43, 0, .085, .15, { freq: 155, to: 58, wave: 'sine', attack: .002 });
          noise(0, .065, .105, { frequency: 820, to: 330, attack: .002, q: .5 });
          break;
        case 'hurt':
          tone(48, 0, .22, .12, { freq: 190, to: 84, wave: 'triangle', attack: .004, cutoff: 950 });
          noise(0, .16, .075, { frequency: 540, to: 260, attack: .003, q: .6 });
          break;
        case 'dodge':
          noise(0, .14, .075, { frequency: 600, to: 2400, attack: .015, q: .55, pan: .2 });
          break;
        case 'heal':
          run(['D5', 'F#5', 'A5', 'D6'], .085, .069, .58);
          tone('D4', 0, .65, .034, { wave: 'pad', attack: .16, sustain: true, release: .25 });
          break;
        case 'pickup':
          run(['D5', 'A5'], .075, .058, .26);
          break;
        case 'menu':
          tone('A4', 0, .046, .046, { wave: 'pluck', cutoff: 1700, attack: .003, release: .018 });
          break;
        case 'confirm':
          run(['D5', 'F#5', 'A5'], .047, .048, .17, 'pluck');
          break;
        case 'relay':
          ['D4', 'F#4', 'A4', 'E5'].forEach((note, i) => tone(note, i * .08, .82, .043, { wave: 'pad', attack: .15, release: .3, sustain: true, pan: (i - 1.5) * .2 }));
          tone('D2', 0, .78, .058, { wave: 'sine', freq: 73.42, to: 146.83, attack: .14 });
          run(['A4', 'D5', 'E5', 'A5'], .16, .043, .45);
          break;
        case 'levelup':
          run(['D5', 'F#5', 'A5', 'B5', 'A5', 'D6'], .105, .062, .45);
          tone('D3', 0, .7, .075, { wave: 'triangle', attack: .018, release: .18 });
          break;
        case 'link':
          run(['B4', 'D5', 'F#5', 'A5', 'D6'], .061, .07, .42);
          tone('B3', 0, .62, .048, { wave: 'pad', attack: .07, release: .18 });
          break;
        case 'defeat':
          run(['B4', 'A4', 'F#4', 'D4', 'B3'], .16, .063, .43, 'flute');
          break;
        case 'boss':
          tone('A1', 0, .9, .13, { wave: 'sine', freq: 76, to: 38, attack: .06, release: .2 });
          noise(0, .9, .125, { frequency: 210, to: 80, filter: 'lowpass', attack: .13, release: .2 });
          ['A3', 'C4', 'E4'].forEach((note, i) => tone(note, .11 + i * .06, .75, .033, { wave: 'pad', attack: .18, release: .25 }));
          break;
        default: return false;
      }
      return true;
    }

    // Optional cleanup for a complete game restart or a removed canvas.
    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      this._clearTimer();
      this._stopChannel(null, 0);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVisibility);
      if (this.ctx) {
        if (this._onState) this.ctx.removeEventListener('statechange', this._onState);
        for (const key of ['musicBus', 'sfxBus', 'musicSend', 'sfxSend', 'reverb', 'wet', 'master', 'compressor']) {
          try { if (this[key]) this[key].disconnect(); } catch (_) { /* already disconnected */ }
        }
        try { const closed = this.ctx.close(); if (closed && closed.catch) closed.catch(() => {}); } catch (_) { /* already closed */ }
      }
    }
  }

  global.WayfarerSound = WayfarerSound;
})(window);
