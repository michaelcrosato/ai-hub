/**
 * DEAD HORIZON: 1899 - Procedural Western Audio & Dynamic Soundtrack
 * Uses Web Audio API synth to generate authentic acoustic guitars, whistling,
 * harmonica, Ennio Morricone horns, galloping rhythms, gunshots, and ricochets.
 */

export class WesternAudio {
  constructor(engineAudio) {
    this.ea = engineAudio;
    this.ctx = null;
    this.currentTrack = null;
    this.musicTimer = null;
    this.step = 0;
    this.muted = false;
    this.volume = 0.8;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- SOUND EFFECTS ---
  playSfx(name, opts = {}) {
    this.init();
    if (this.muted || !this.ctx) return;

    const t = this.ctx.currentTime;
    const vol = (opts.vol || 1.0) * this.volume;

    switch (name) {
      case 'gunshot_revolver': {
        // Sharp explosion + metallic hammer snap + acoustic reverb
        this._noiseBurst(t, 0.18, vol * 0.9, 1200, 150);
        this._tone(t, 'square', 180, 40, 0.08, vol * 0.4);
        this._tone(t + 0.04, 'sine', 70, 30, 0.25, vol * 0.5);
        break;
      }
      case 'gunshot_repeater': {
        this._noiseBurst(t, 0.22, vol * 0.95, 1600, 200);
        this._tone(t, 'triangle', 220, 50, 0.12, vol * 0.5);
        break;
      }
      case 'gunshot_shotgun': {
        this._noiseBurst(t, 0.35, vol * 1.2, 800, 80);
        this._tone(t, 'sawtooth', 120, 30, 0.3, vol * 0.7);
        break;
      }
      case 'gunshot_rifle': {
        this._noiseBurst(t, 0.28, vol * 1.0, 2200, 180);
        this._tone(t, 'sine', 90, 40, 0.2, vol * 0.6);
        // distant echo
        this._noiseBurst(t + 0.12, 0.2, vol * 0.3, 1000, 200);
        break;
      }
      case 'ricochet': {
        // High rising whistle drop
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1800, t);
        o.frequency.exponentialRampToValueAtTime(3600, t + 0.06);
        o.frequency.exponentialRampToValueAtTime(400, t + 0.22);
        g.gain.setValueAtTime(vol * 0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.25);
        break;
      }
      case 'hammer_cock': {
        this._noiseBurst(t, 0.03, vol * 0.3, 3000, 1800);
        this._noiseBurst(t + 0.05, 0.04, vol * 0.4, 4000, 2200);
        break;
      }
      case 'lever_action': {
        this._noiseBurst(t, 0.06, vol * 0.4, 2500, 1200);
        this._noiseBurst(t + 0.1, 0.08, vol * 0.5, 3500, 1600);
        break;
      }
      case 'deadeye_enter': {
        // Heartbeat thud + high ringing time dilation
        this._tone(t, 'sine', 60, 25, 0.4, vol * 1.0);
        this._tone(t + 0.12, 'sine', 70, 30, 0.3, vol * 0.8);
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(950, t);
        o.frequency.linearRampToValueAtTime(1200, t + 0.5);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.6);
        break;
      }
      case 'deadeye_tag': {
        // Sharp metallic lock-on ping
        this._tone(t, 'triangle', 880, 880, 0.08, vol * 0.5);
        this._tone(t + 0.02, 'sine', 1320, 1320, 0.1, vol * 0.6);
        break;
      }
      case 'deadeye_exit': {
        this._tone(t, 'sine', 200, 50, 0.35, vol * 0.6);
        break;
      }
      case 'horse_gallop': {
        this._noiseBurst(t, 0.05, vol * 0.35, 450, 120);
        this._noiseBurst(t + 0.08, 0.04, vol * 0.25, 500, 150);
        break;
      }
      case 'horse_whinny': {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(320, t);
        o.frequency.linearRampToValueAtTime(540, t + 0.15);
        o.frequency.linearRampToValueAtTime(420, t + 0.3);
        o.frequency.linearRampToValueAtTime(600, t + 0.45);
        o.frequency.linearRampToValueAtTime(250, t + 0.7);
        g.gain.setValueAtTime(vol * 0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.75);
        break;
      }
      case 'whistle_call': {
        // Two-note human whistle to call horse
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1100, t);
        o.frequency.linearRampToValueAtTime(1350, t + 0.18);
        o.frequency.setValueAtTime(1350, t + 0.22);
        o.frequency.linearRampToValueAtTime(1750, t + 0.45);
        g.gain.setValueAtTime(vol * 0.4, t);
        g.gain.setValueAtTime(vol * 0.4, t + 0.42);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + 0.55);
        break;
      }
      case 'coin':
      case 'cash_register': {
        this._tone(t, 'sine', 1400, 1400, 0.1, vol * 0.4);
        this._tone(t + 0.08, 'sine', 2100, 2100, 0.2, vol * 0.5);
        break;
      }
      case 'punch': {
        this._noiseBurst(t, 0.08, vol * 0.6, 600, 100);
        this._tone(t, 'triangle', 110, 40, 0.12, vol * 0.5);
        break;
      }
      case 'eagle_eye': {
        this._tone(t, 'sine', 550, 880, 0.4, vol * 0.3);
        break;
      }
      default:
        if (this.ea && this.ea.sfx) this.ea.sfx(name);
        break;
    }
  }

  _tone(start, type, f0, f1, dur, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(start); o.stop(start + dur);
  }

  _noiseBurst(start, dur, vol, hi, lo) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(hi, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, lo), start + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    noise.start(start);
  }

  // --- PROCEDURAL DYNAMIC WESTERN SOUNDTRACK ---
  playMusic(theme) {
    this.init();
    if (this.currentTrack === theme) return;
    this.stopMusic();
    this.currentTrack = theme;
    if (!theme || this.muted || !this.ctx) return;

    this.step = 0;
    const bpm = (theme === 'shootout' ? 132 : (theme === 'saloon' ? 120 : 88));
    const stepInterval = (60 / bpm) / 2 * 1000;

    const playStep = () => {
      if (!this.ctx || this.muted || this.currentTrack !== theme) return;
      this._renderMusicStep(theme, this.step);
      this.step++;
      this.musicTimer = setTimeout(playStep, stepInterval);
    };
    playStep();
  }

  stopMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentTrack = null;
  }

  _renderMusicStep(theme, step) {
    const t = this.ctx.currentTime;
    const vol = this.volume * 0.4;
    const bar = Math.floor(step / 8);
    const beat = step % 8;

    if (theme === 'exploration') {
      // "Frontier Horizon" - Campfire fingerpicked acoustic guitar in D Minor / Pentatonic
      const guitarScale = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66]; // D3, F3, G3, A3, C4, D4
      if (beat === 0 || beat === 4) {
        // Deep bass root
        const root = (bar % 4 === 3 ? 130.81 : (bar % 4 === 2 ? 110.00 : 146.83));
        this._tone(t, 'triangle', root, root, 0.45, vol * 0.6);
      }
      if (beat === 1 || beat === 3 || beat === 5 || beat === 7) {
        const note = guitarScale[(step * 3) % guitarScale.length];
        this._tone(t, 'sine', note, note, 0.28, vol * 0.45);
      }
      // Mournful whistle motif every 16 steps
      if (step % 16 === 0) {
        this._tone(t + 0.1, 'sine', 587.33, 587.33, 0.6, vol * 0.5); // D5
      } else if (step % 16 === 4) {
        this._tone(t + 0.1, 'sine', 659.25, 698.46, 0.5, vol * 0.5); // E5 to F5
      } else if (step % 16 === 8) {
        this._tone(t + 0.1, 'sine', 587.33, 523.25, 0.7, vol * 0.5); // D5 to C5
      }
    } else if (theme === 'shootout') {
      // "High Noon Shootout" - Galloping percussion, tense brass stabs, driving bass
      // Gallop rhythm on every 16th
      this._noiseBurst(t, 0.04, (beat % 2 === 0 ? vol * 0.5 : vol * 0.25), 300, 80);
      if (beat === 0 || beat === 4) {
        this._tone(t, 'sawtooth', 73.42, 60, 0.18, vol * 0.8); // D2 bass hit
      }
      // Tense brass stabs on beats 2 and 6
      if (beat === 2 || beat === 6) {
        this._tone(t, 'sawtooth', 293.66, 293.66, 0.12, vol * 0.45);
        this._tone(t, 'sawtooth', 440.00, 440.00, 0.12, vol * 0.4);
      }
    } else if (theme === 'redemption') {
      // "Sunset Redemption" - Warm church organ and Ennio Morricone acoustic chords
      const chords = [
        [146.83, 220.00, 293.66, 349.23], // Dm
        [174.61, 261.63, 349.23, 440.00], // F
        [130.81, 196.00, 261.63, 329.63], // C
        [146.83, 220.00, 293.66, 440.00]  // D
      ];
      const chord = chords[bar % 4];
      if (beat === 0) {
        for (const f of chord) {
          this._tone(t, 'sine', f, f, 1.2, vol * 0.35);
        }
      }
      if (beat === 4) {
        // High emotional melody tone
        const melody = [587.33, 698.46, 659.25, 880.00][bar % 4];
        this._tone(t, 'triangle', melody, melody * 0.98, 0.9, vol * 0.5);
      }
    } else if (theme === 'saloon') {
      // "Saloon Ragtime" - Upbeat syncopated honky-tonk piano
      const bass = (beat === 0 || beat === 4 ? 130.81 : 196.00);
      this._tone(t, 'square', bass, bass, 0.1, vol * 0.4);
      if (beat === 2 || beat === 6) {
        this._tone(t, 'triangle', 261.63, 261.63, 0.12, vol * 0.4);
        this._tone(t, 'triangle', 329.63, 329.63, 0.12, vol * 0.4);
      }
      if (beat === 3 || beat === 7) {
        this._tone(t, 'triangle', 392.00, 392.00, 0.08, vol * 0.35);
      }
    }
  }
}
