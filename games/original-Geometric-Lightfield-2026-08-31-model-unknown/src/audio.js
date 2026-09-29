// Procedural sound for the house, built on first use from one noise buffer and a
// few oscillators: wind outside, room tone inside, TV static, fridge hum, the hall
// bulb's buzz and the helicopter rotor, each placed by distance and stereo pan,
// muffled through walls. One-shots cover switches, footsteps, carrying and rounds.
// Nothing is allocated per frame; voices are long-lived and only their gains move.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class HouseAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = {};
    this.muted = false;
    this.paused = false;
    this.ducked = false;
    this.spot = { gain: 0, pan: 0 };
  }

  /** Call from any user gesture; the first call builds the graph. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    this.build();
    if (this.paused) this.ctx.suspend().catch(() => {});
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.targetMaster();
    this.master.connect(ctx.destination);

    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    const noiseSource = () => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.start(0, Math.random() * 2);
      return s;
    };
    const filter = (type, frequency, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = q;
      return f;
    };
    const osc = (type, frequency) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = frequency;
      o.start();
      return o;
    };
    const voice = (input, pannable = true) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      input.connect(gain);
      let pan = null;
      if (pannable && ctx.createStereoPanner) {
        pan = ctx.createStereoPanner();
        gain.connect(pan);
        pan.connect(this.master);
      } else {
        gain.connect(this.master);
      }
      return { gain, pan };
    };

    // Wind: band-passed noise with slow gusts moving the band.
    const windBand = filter('bandpass', 380, 0.6);
    noiseSource().connect(windBand);
    const gust = osc('sine', 0.07);
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 160;
    gust.connect(gustDepth).connect(windBand.frequency);
    this.voices.wind = voice(windBand, false);

    const roomLow = filter('lowpass', 140);
    noiseSource().connect(roomLow);
    this.voices.room = voice(roomLow, false);

    const staticBand = filter('bandpass', 3800, 0.7);
    noiseSource().connect(staticBand);
    this.voices.tv = voice(staticBand);

    const humLow = filter('lowpass', 260);
    osc('sawtooth', 50).connect(humLow);
    const second = ctx.createGain();
    second.gain.value = 0.5;
    osc('sine', 100).connect(second).connect(humLow);
    this.voices.fridge = voice(humLow);

    const buzzLow = filter('lowpass', 700);
    osc('square', 120).connect(buzzLow);
    this.voices.buzz = voice(buzzLow);

    // Rotor: low noise amplitude-modulated at the blade rate.
    const rotorLow = filter('lowpass', 300);
    const chop = ctx.createGain();
    chop.gain.value = 0.55;
    noiseSource().connect(rotorLow).connect(chop);
    const blade = osc('sine', 11.5);
    const bladeDepth = ctx.createGain();
    bladeDepth.gain.value = 0.45;
    blade.connect(bladeDepth).connect(chop.gain);
    this.voices.heli = voice(chop);
  }

  targetMaster() {
    return this.muted ? 0 : this.ducked ? 0.28 : 0.7;
  }

  setMuted(muted) {
    this.muted = muted;
    this.applyMaster();
  }

  /** Quieter behind a menu. */
  setDucked(ducked) {
    this.ducked = ducked;
    this.applyMaster();
  }

  applyMaster() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.targetMaster(), this.ctx.currentTime, 0.08);
  }

  /** The kit's settings panel or a hidden tab: stop the audio clock entirely. */
  setPaused(paused) {
    this.paused = paused;
    if (!this.ctx) return;
    if (paused) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  /** Distance falloff and stereo pan for a source, relative to the listener. */
  place(listener, x, y, z, reference, sameRoom) {
    const dx = x - listener.x;
    const dy = y - listener.y;
    const dz = z - listener.z;
    const d = Math.hypot(dx, dy, dz);
    let g = 1 / (1 + (d / reference) ** 2);
    if (!sameRoom) g *= 0.3;
    this.spot.gain = g;
    this.spot.pan = d > 0.05 ? clamp((dx * listener.rightX + dz * listener.rightZ) / d, -1, 1) * 0.8 : 0;
    return this.spot;
  }

  setVoice(name, gain, pan = 0) {
    const v = this.voices[name];
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.gain.gain.setTargetAtTime(gain, t, 0.12);
    if (v.pan) v.pan.pan.setTargetAtTime(pan, t, 0.12);
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  // ---- one-shots

  envelope(node, peak, attack, decay, when = 0) {
    const t = this.ctx.currentTime + when;
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return t + attack + decay + 0.05;
  }

  output(pan) {
    const g = this.ctx.createGain();
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.master);
    } else {
      g.connect(this.master);
    }
    return g;
  }

  tone(type, from, to, peak, attack, decay, pan = 0, when = 0) {
    if (!this.ready) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.ctx.currentTime + when;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = this.output(pan);
    o.connect(g);
    const end = this.envelope(g, peak, attack, decay, when);
    o.start(t);
    o.stop(end);
  }

  burst(type, frequency, peak, decay, pan = 0, q = 0.8) {
    if (!this.ready) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    const g = this.output(pan);
    s.connect(f).connect(g);
    const end = this.envelope(g, peak, 0.004, decay);
    s.start(this.ctx.currentTime, Math.random() * 1.5);
    s.stop(end);
  }

  switchClick(on, gain = 1, pan = 0) {
    this.burst('highpass', 2400, 0.22 * gain, 0.03, pan);
    this.tone('square', on ? 1500 : 1100, on ? 1900 : 800, 0.05 * gain, 0.002, 0.04, pan);
  }

  flashlightClick(on) {
    this.tone('square', on ? 2200 : 1700, on ? 2600 : 1300, 0.05, 0.002, 0.03);
    this.burst('highpass', 3000, 0.12, 0.02);
  }

  step(indoors, speed) {
    const peak = clamp(0.05 + speed * 0.012, 0.05, 0.16);
    if (indoors) this.burst('lowpass', 900 + Math.random() * 300, peak, 0.07);
    else this.burst('bandpass', 1500 + Math.random() * 600, peak * 0.8, 0.09, 0, 0.6);
  }

  thud(strength = 1, pan = 0) {
    this.tone('sine', 110, 42, 0.32 * strength, 0.004, 0.18, pan);
    this.burst('lowpass', 400, 0.14 * strength, 0.08, pan);
  }

  tick(gain, pan) {
    if (gain < 0.01) return;
    this.tone('square', 2600, 2600, 0.04 * gain, 0.001, 0.012, pan);
  }

  relay(gain, pan) {
    this.thud(0.5 * gain, pan);
    this.switchClick(true, 0.7 * gain, pan);
    this.burst('bandpass', 5200, 0.05 * gain, 0.35, pan, 2);
  }

  chime() {
    this.tone('sine', 660, 660, 0.12, 0.01, 0.35);
    this.tone('sine', 990, 990, 0.1, 0.01, 0.5, 0, 0.09);
  }

  fanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.01, 0.7, 0, i * 0.12));
  }
}
