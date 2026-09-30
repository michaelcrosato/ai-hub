/**
 * audio.js — a quiet synthesized soundscape: a low city drone, rain that
 * follows the weather, short interface tones and a reminder chime. Nothing
 * is downloaded. The AudioContext is created when the player turns sound on,
 * and any later tap, click or key press unlocks it if the browser held it back.
 */

export class AmbientAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.rainGain = null;
    this.enabled = false;
    this.raining = false;
    this.paused = false;
    // A context started without a gesture (a controller press, a restored
    // setting) stays suspended: the next tap, click or key lets it play.
    const unlock = () => {
      if (this.enabled && !this.paused && this.context?.state === 'suspended')
        this.context.resume().catch(() => {});
    };
    addEventListener('pointerdown', unlock, true);
    addEventListener('keydown', unlock, true);
  }

  /** Start (or resume) the ambience. Call from a user gesture. */
  async start() {
    this.enabled = true;
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error('Web Audio is not available');
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);

      const drone = this.context.createBiquadFilter();
      drone.type = 'lowpass';
      drone.frequency.value = 360;
      drone.Q.value = 0.7;
      drone.connect(this.master);
      [55, 82.5].forEach((frequency, i) => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = frequency;
        gain.gain.value = i === 0 ? 0.05 : 0.018;
        osc.connect(gain).connect(drone);
        osc.start();
      });

      // Two seconds of looped noise through a band-pass: soft rain on glass.
      const length = this.context.sampleRate * 2;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = this.context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const band = this.context.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1800;
      band.Q.value = 0.5;
      this.rainGain = this.context.createGain();
      this.rainGain.gain.value = 0;
      noise.connect(band).connect(this.rainGain).connect(this.master);
      noise.start();
    }
    this.master.gain.setTargetAtTime(0.05, this.context.currentTime, 0.08);
    this.setRain(this.raining);
    // Not awaited: without a user gesture (a controller press, a restored setting) the
    // browser holds resume() back, and the unlock listener finishes the job on the next
    // tap or key. Awaiting it here would leave the caller hanging until then.
    if (this.context.state === 'suspended' && !this.paused) this.context.resume().catch(() => {});
  }

  stop() {
    this.enabled = false;
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
  }

  /** Pause everything while the game is paused or hidden. */
  suspend(on) {
    this.paused = !!on;
    if (!this.context) return;
    if (on) this.context.suspend().catch(() => {});
    else if (this.enabled) this.context.resume().catch(() => {});
  }

  setRain(on) {
    this.raining = !!on;
    if (!this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(this.raining ? 0.22 : 0, this.context.currentTime, 1.2);
  }

  get running() {
    return this.enabled && this.context?.state === 'running';
  }

  /** A short interface tone: 'soft', 'success' or 'danger'. */
  blip(kind = 'soft') {
    if (!this.running) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = kind === 'success' ? 'sine' : kind === 'danger' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(kind === 'success' ? 520 : kind === 'danger' ? 180 : 330, now);
    osc.frequency.exponentialRampToValueAtTime(
      kind === 'success' ? 780 : kind === 'danger' ? 120 : 410,
      now + 0.12,
    );
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** A two-note bell for reminders (a booking is close). */
  chime() {
    if (!this.running) return;
    const now = this.context.currentTime;
    [659.25, 987.77].forEach((frequency, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const t = now + i * 0.14;
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  }
}

export const audio = new AmbientAudio();
