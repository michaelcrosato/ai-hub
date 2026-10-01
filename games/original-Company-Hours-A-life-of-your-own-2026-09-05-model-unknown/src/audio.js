/* Company Hours — original synthesized tones. Sound is opt-in (Settings), the context is made
   on the gesture that turns it on, resumed on the next gesture if a browser suspended it,
   and held silent while the game is paused or hidden. */

export class Soundscape {
  constructor() {
    this.enabled = false;
    this.volume = 0.25;
    this.context = null;
    this.gain = null;
    this.nextChord = 0;
    this.chord = 0;
    this.held = false;
  }
  async enable(value, volume = 0.25) {
    this.enabled = value;
    this.volume = volume;
    if (!value) {
      this.context?.suspend().catch(() => {});
      return;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.context ??= new C();
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    this.gain.gain.value = volume * 0.22;
    if (!this.held) await this.context.resume();
  }
  /** Call from any user gesture: browsers may start (or leave) the context suspended. */
  unlock() {
    if (this.enabled && !this.held && this.context && this.context.state !== 'running') this.context.resume().catch(() => {});
  }
  /** Silence everything while the game is paused by the settings panel or a hidden tab. */
  hold(on) {
    this.held = !!on;
    if (!this.context) return;
    if (this.held) this.context.suspend().catch(() => {});
    else if (this.enabled) this.context.resume().catch(() => {});
  }
  setVolume(value) {
    this.volume = value;
    if (this.gain) this.gain.gain.setTargetAtTime(value * 0.22, this.context.currentTime, 0.1);
  }
  get ready() {
    return this.enabled && !!this.context && this.context.state === 'running';
  }
  note(frequency, start, length = 1, amplitude = 0.15, type = 'sine') {
    if (!this.ready) return;
    const c = this.context;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = frequency;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(amplitude, start + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, start + length);
    o.connect(g);
    g.connect(this.gain);
    o.start(start);
    o.stop(start + length + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  cue(ok = true) {
    if (!this.ready) return;
    const t = this.context.currentTime;
    this.note(ok ? 523.25 : 246.94, t, 0.28, 0.32);
    if (ok) this.note(659.25, t + 0.07, 0.38, 0.2);
  }
  /** A soft click for opening menus and moving between buttons. */
  tick() {
    if (!this.ready) return;
    this.note(880, this.context.currentTime, 0.09, 0.07, 'triangle');
  }
  /** A rising arpeggio: a new morning, a milestone, a lovely date. */
  chime(big = false) {
    if (!this.ready) return;
    const t = this.context.currentTime;
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [587.33, 739.99, 880];
    notes.forEach((f, i) => this.note(f, t + i * 0.11, big ? 1.4 : 0.9, 0.18));
  }
  update(playing) {
    if (!playing || !this.ready) return;
    const t = this.context.currentTime;
    if (t < this.nextChord) return;
    this.nextChord = t + 7;
    const chords = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];
    chords[this.chord++ % 4].forEach((f, i) => this.note(f / 2, t + i * 0.18, 4.5, 0.1));
  }
}
