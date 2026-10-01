/** Local synthesis only. No downloaded audio, microphones, or network speech. */
export class AudioSystem {
  constructor() { this.context = null; this.enabled = true; this.volume = 0.26; this.voice = false; this.lastIndicator = -1; this.suspended = false; }
  /** Call from a user gesture (Begin / Continue): browsers only allow audio after one. */
  async start() {
    if (!this.context) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const c = (this.context = new C()); this.master = c.createGain(); this.master.gain.value = this.volume; this.master.connect(c.destination);
      this.motor = c.createOscillator(); this.motor.type = 'sine'; this.motorGain = c.createGain(); this.motorGain.gain.value = 0; this.motor.connect(this.motorGain).connect(this.master); this.motor.start();
      const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
      this.noiseBuffer = buffer; this.noise = c.createBufferSource(); this.noise.buffer = buffer; this.noise.loop = true;
      this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 700; this.roadGain = c.createGain(); this.roadGain.gain.value = 0;
      this.noise.connect(this.filter).connect(this.roadGain).connect(this.master); this.noise.start();
      // Rain on the roof: the same noise, high-passed, only in the rain.
      this.rainFilter = c.createBiquadFilter(); this.rainFilter.type = 'highpass'; this.rainFilter.frequency.value = 2600; this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
      this.noise.connect(this.rainFilter).connect(this.rainGain).connect(this.master);
    }
    if (this.context.state === 'suspended' && !this.suspended) { try { await this.context.resume(); } catch { /* resumes on the next gesture */ } }
  }
  /** The kit's settings panel (or the tab losing focus) pauses the game: silence the engine hum too. */
  setSuspended(on) {
    this.suspended = on; if (!this.context) return;
    if (on) { this.context.suspend?.().catch(() => {}); if (window.speechSynthesis) speechSynthesis.cancel(); } else this.context.resume?.().catch(() => {});
  }
  tone(freq = 650, duration = 0.12, volume = 0.12, type = 'sine', delay = 0) {
    if (!this.context || !this.enabled) return; const c = this.context, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(volume, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + duration + 0.025);
  }
  hiss(volume = 0.14, length = 0.6) {
    if (!this.context || !this.enabled) return; const c = this.context, s = c.createBufferSource(); s.buffer = this.noiseBuffer;
    const f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 1500; g.gain.setValueAtTime(volume, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + length);
    s.connect(f).connect(g).connect(this.master); s.start(); s.stop(c.currentTime + length + 0.05);
  }
  thud(strength = 0.5) {
    if (!this.context || !this.enabled) return; const c = this.context, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * strength + 0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.4); this.hiss(0.08 * strength, 0.25);
  }
  event(e) {
    if (e.type === 'stop-request') { this.tone(880, 0.28, 0.15); this.tone(660, 0.36, 0.1, 'sine', 0.19); }
    else if (e.type === 'boarded') this.tone(1030, 0.1, 0.07);
    else if (e.type === 'door' || e.type === 'air') this.hiss();
    else if (e.type === 'horn') { this.tone(220, 0.37, 0.16, 'triangle'); this.tone(277, 0.37, 0.12, 'triangle'); }
    else if (e.type === 'switch') this.tone(310, 0.025, 0.035, 'square');
    else if (e.type === 'violation') this.tone(190, 0.15, 0.05);
    else if (e.type === 'impact') this.thud(e.strength ?? 0.5);
    else if (e.type === 'arrival') this.tone(523, 0.09, 0.05, 'sine');
    if (this.voice && !this.suspended && ['passenger', 'announcement', 'ambient', 'interaction'].includes(e.type) && e.message && window.speechSynthesis) {
      const voices = speechSynthesis.getVoices(), local = voices.find((v) => v.localService && v.lang.startsWith('en'));
      if (local) { const u = new SpeechSynthesisUtterance(e.message); u.voice = local; u.rate = 0.94; u.volume = 0.45; speechSynthesis.speak(u); }
    }
  }
  update(sim, weather) {
    if (!this.context || this.suspended) return; const c = this.context, b = sim.bus, active = this.enabled && !sim.paused;
    this.master.gain.setTargetAtTime(active ? this.volume : 0, c.currentTime, 0.12);
    this.motor.frequency.setTargetAtTime(65 + Math.abs(b.v) * 14, c.currentTime, 0.09);
    this.motorGain.gain.setTargetAtTime(b.engine ? 0.016 + b.throttle * 0.014 : 0, c.currentTime, 0.15);
    this.roadGain.gain.setTargetAtTime(Math.min(0.28, Math.abs(b.v) * 0.009), c.currentTime, 0.1);
    this.rainGain.gain.setTargetAtTime(weather === 'rain' ? 0.05 : 0, c.currentTime, 0.4);
    const tick = Math.floor(sim.time * 2.6);
    if (active && (b.indicator || b.hazards) && tick !== this.lastIndicator) { this.tone(tick % 2 ? 540 : 620, 0.035, 0.055, 'triangle'); this.lastIndicator = tick; }
  }
}
