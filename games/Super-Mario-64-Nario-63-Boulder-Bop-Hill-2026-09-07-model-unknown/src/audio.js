/* audio.js — the level music and the procedural sound effects.
 *
 * The music now streams from music.mp3 next to the game (it used to sit in
 * the page as 8.6 MB of base64) and only starts loading when play begins.
 * Effects are the original oscillator recipes, plus a few new ones for the
 * blue coin switch, the summit race and the hundred-coin star.
 */

export class AudioEngine {
  constructor(musicUrl) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);
    this.fxGain = this.ctx.createGain();
    this.fxGain.gain.value = 0.5;
    this.fxGain.connect(this.master);
    this.musicElement = new Audio();
    this.musicElement.loop = true;
    this.musicElement.preload = 'auto';
    this.musicElement.setAttribute('playsinline', '');
    this.musicElement.src = musicUrl;
    this.musicSource = this.ctx.createMediaElementSource(this.musicElement);
    this.musicSource.connect(this.musicGain);
    this.musicPending = false;
    this.musicBlocked = false;
    this.musicErrorShown = false;
    this.onError = null;
    this.levels = { master: -1, music: -1 };
    const real = new Float32Array([0, 1, 0.42, 0.24, 0.09, 0.06, 0.035]), imag = new Float32Array(7);
    this.wave = this.ctx.createPeriodicWave(real, imag);
  }

  resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') this.ctx.resume().catch(() => {});
    this.musicBlocked = false;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  startMusic() {
    const el = this.musicElement;
    if (!this.ctx || document.hidden || !el.paused || this.musicPending || this.musicBlocked) return;
    this.musicPending = true;
    const failed = (error) => {
      this.musicPending = false;
      if (error && error.name === 'AbortError') return;
      this.musicBlocked = true;
      if (error && error.name !== 'NotAllowedError' && !this.musicErrorShown) {
        this.musicErrorShown = true;
        this.onError?.('Music could not play. Try another browser.');
      }
    };
    try {
      Promise.resolve(el.play()).then(() => (this.musicPending = false), failed);
    } catch (error) {
      failed(error);
    }
  }

  /** Called every frame: fades only when a level actually changes. */
  update({ started, muted, music, quiet }) {
    if (!this.ctx) return;
    const hidden = document.hidden;
    const t = this.ctx.currentTime;
    const master = muted || hidden ? 0 : 0.55;
    const mus = music ? (quiet ? 0.26 : 0.65) : 0;
    if (master !== this.levels.master) {
      this.levels.master = master;
      this.master.gain.setTargetAtTime(master, t, 0.04);
    }
    if (mus !== this.levels.music) {
      this.levels.music = mus;
      this.musicGain.gain.setTargetAtTime(mus, t, 0.1);
    }
    const el = this.musicElement;
    if (hidden || !music || !started) {
      if (!el.paused) el.pause();
    } else this.startMusic();
  }

  tone(freq, time, dur, vol = 0.15, type = 'sine', dest = this.fxGain, slide = 0) {
    if (!this.ctx || !freq) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    if (type === 'lead') o.setPeriodicWave(this.wave);
    else o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, freq + slide), time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), time + 0.009);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(dest);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  fx(name, extra = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, d = this.fxGain;
    const note = (n) => 440 * 2 ** ((n - 69) / 12);
    switch (name) {
      case 'jump': this.tone(300 + extra * 90, t, 0.16, 0.24, 'sine', d, 360); this.tone(150, t, 0.1, 0.09, 'triangle', d, 100); break;
      case 'coin': this.tone(988, t, 0.11, 0.16, 'sine'); this.tone(1480, t + 0.065, 0.22, 0.14, 'sine'); break;
      case 'red': for (let i = 0; i < 3; i++) this.tone(660 * Math.pow(1.26, i + extra * 0.11), t + i * 0.055, 0.21, 0.14, 'sine'); break;
      case 'blue': for (let i = 0; i < 4; i++) this.tone(784 * Math.pow(1.19, i), t + i * 0.045, 0.2, 0.13, 'sine'); break;
      case 'land': this.tone(90, t, 0.075, 0.2, 'triangle', d, -50); break;
      case 'pound': this.tone(130, t, 0.3, 0.35, 'triangle', d, -95); this.tone(55, t, 0.25, 0.25, 'sine'); break;
      case 'attack': this.tone(340, t, 0.13, 0.12, 'triangle', d, -240); break;
      case 'hurt': this.tone(310, t, 0.3, 0.2, 'sawtooth', d, -235); break;
      case 'break': for (let i = 0; i < 3; i++) this.tone(160 + i * 87, t + i * 0.025, 0.15, 0.13, 'square', d, -100); break;
      case 'cannon': this.tone(75, t, 0.55, 0.5, 'sawtooth', d, -45); this.tone(170, t + 0.08, 0.5, 0.16, 'sine', d, 550); break;
      case 'flag': for (let i = 0; i < 4; i++) this.tone([523, 659, 784, 1047][i], t + i * 0.08, 0.25, 0.15, 'lead'); break;
      case 'star': for (const [i, n] of [72, 76, 79, 84, 79, 84, 88].entries()) this.tone(note(n), t + i * 0.12, i === 6 ? 0.7 : 0.23, 0.24, 'lead'); break;
      case 'boss': this.tone(80, t, 0.2, 0.3, 'square', d, 60); break;
      case 'click': this.tone(660, t, 0.08, 0.13, 'sine'); break;
      case 'switch': this.tone(220, t, 0.12, 0.3, 'square', d, -80); for (let i = 0; i < 5; i++) this.tone(note(72 + i * 4), t + 0.1 + i * 0.06, 0.16, 0.12, 'lead'); break;
      case 'tick': this.tone(extra ? 1320 : 990, t, 0.05, 0.1, 'square'); break;
      case 'count': this.tone(extra ? 1047 : 523, t, extra ? 0.45 : 0.18, 0.2, 'lead'); break;
      case 'lose': for (const [i, n] of [67, 64, 60].entries()) this.tone(note(n), t + i * 0.16, 0.3, 0.18, 'triangle'); break;
      case 'hundred': for (const [i, n] of [76, 79, 84, 88, 91].entries()) this.tone(note(n), t + i * 0.08, 0.32, 0.2, 'lead'); break;
    }
  }
}
