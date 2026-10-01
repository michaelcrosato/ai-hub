// TeaKen sound: a synthesised 138 BPM arcade track, impact sounds, and the
// original announcer recordings (voice/*.wav, fetched and decoded only after
// the first click, tap or key press unlocks audio).

const VOICES = ['round1', 'round2', 'final', 'fight', 'ko', 'win', 'lose', 'next', 'perfect', 'select', 'draw', 'champion'];
const VOICE_DIR = new URL('../voice/', import.meta.url);

export class AudioEngine {
  /**
   * @param {object} settings  the game's settings object (sound, music)
   * @param {() => {screen: string, phase: string}} state  for the music's intensity
   */
  constructor(settings, state) {
    this.settings = settings;
    this.state = state;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.voices = {};
    this.next = 0;
    this.step = 0;
    this.noise = null;
    this.ready = false;
    this.loading = null;
    this.held = false; // suspended by the game (pause, hidden tab)
  }

  /** Create the context on the first gesture; later calls resume it. Resolves once the voices are in. */
  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.held) await this.ctx.resume().catch(() => {});
      if (this.loading) await this.loading;
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      this.master.gain.value = this.settings.sound ? 0.64 : 0;
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      this.master.connect(compressor);
      compressor.connect(c.destination);
      this.musicGain = c.createGain();
      this.musicGain.gain.value = this.settings.music ? 0.34 : 0;
      this.musicGain.connect(this.master);
      this.noise = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.next = c.currentTime + 0.1;
      this.ready = true;
      this.loading = Promise.all(
        VOICES.map((name) =>
          fetch(new URL(`${name}.wav`, VOICE_DIR))
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
            .then((bytes) => c.decodeAudioData(bytes))
            .then((buffer) => (this.voices[name] = buffer))
            .catch(() => {})
        )
      );
      if (this.held) c.suspend().catch(() => {});
      else await c.resume().catch(() => {});
      await this.loading;
    } catch (e) {
      console.warn('Sound is not available:', e.message);
    }
  }

  /** Pause or resume all sound (game pause, settings panel, hidden tab). */
  hold(on) {
    this.held = !!on;
    if (!this.ctx) return;
    if (on && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    else if (!on && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  set() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.sound ? 0.64 : 0, t, 0.03);
    this.musicGain.gain.setTargetAtTime(this.settings.music ? 0.34 : 0, t, 0.08);
  }

  tone(freq, dur, vol = 0.2, type = 'sine', to = 0, time = null, dest = null) {
    if (!this.ready) return;
    const c = this.ctx, t = time ?? c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(15, to), t + dur);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.015);
  }

  noiseHit(dur, vol, freq = 2000, time = null, dest = null) {
    if (!this.ready) return;
    const c = this.ctx, t = time ?? c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    f.type = 'lowpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.master);
    s.start(t, Math.random() * 0.3);
    s.stop(t + dur + 0.01);
  }

  menu(ok = false) {
    this.tone(ok ? 880 : 600, 0.09, 0.09, 'square', ok ? 1320 : 810);
    this.tone(ok ? 220 : 330, 0.13, 0.08, 'triangle');
  }
  swing(heavy = false) {
    this.noiseHit(heavy ? 0.15 : 0.09, 0.11, heavy ? 1600 : 3300);
  }
  hit(heavy = false, counter = false) {
    this.tone(heavy ? 113 : 160, heavy ? 0.22 : 0.12, heavy ? 0.6 : 0.39, 'sine', 40);
    this.noiseHit(heavy ? 0.14 : 0.085, heavy ? 0.4 : 0.28, heavy ? 2500 : 3900);
    if (counter) this.tone(620, 0.19, 0.13, 'sawtooth', 110);
    this.tone(heavy ? 62 : 83, 0.11, 0.18, 'triangle', 32);
  }
  block() {
    this.noiseHit(0.055, 0.15, 6000);
    this.tone(1250, 0.09, 0.09, 'square', 620);
    this.tone(1970, 0.06, 0.04, 'sine');
  }
  /** A deep temple gong for the final stage and the champion. */
  gong() {
    this.tone(98, 2.4, 0.3, 'sine', 92);
    this.tone(147, 1.8, 0.12, 'triangle', 140);
    this.tone(233, 1.2, 0.05, 'sine', 228);
    this.noiseHit(0.3, 0.12, 900);
  }

  say(key) {
    if (!this.ready) return;
    const buf = this.voices[key];
    if (buf) {
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
      s.buffer = buf;
      g.gain.value = 0.85;
      s.connect(g);
      g.connect(this.master);
      s.start();
    } else {
      this.tone(180, 0.18, 0.17, 'sawtooth', 100);
      this.tone(360, 0.2, 0.08, 'square', 200);
    }
  }

  tick() {
    if (!this.ready || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.next < now - 0.2) this.next = now + 0.035;
    const beat = 60 / 138 / 4;
    while (this.next < now + 0.12) {
      this.musicStep(this.step++, this.next);
      this.next += beat;
    }
  }

  musicStep(n, t) {
    if (!this.settings.music) return;
    const st = this.state();
    const d = this.musicGain, s = n % 16, bar = Math.floor(n / 16) % 8, active = st.screen === 'fight' && st.phase === 'fight', v = active ? 1 : 0.6;
    if (s % 4 === 0 || (s === 14 && bar % 2)) {
      this.tone(130, 0.19, 0.65 * v, 'sine', 43, t, d);
      this.noiseHit(0.018, 0.12 * v, 2500, t, d);
    }
    if (s === 4 || s === 12) {
      this.noiseHit(0.12, 0.22 * v, 5100, t, d);
      this.tone(186, 0.1, 0.12 * v, 'triangle', 90, t, d);
    }
    if (s % 2 === 0 || (active && s === 15)) this.noiseHit(s === 14 ? 0.09 : 0.026, 0.055 * v, 9000, t, d);
    const bass = [0, 0, 12, 0, 0, 7, 0, 10, 0, 0, 12, 0, 3, 0, 7, 10], root = [38, 38, 41, 36, 38, 38, 43, 36][bar];
    if (s % 2 === 0 || s === 7 || s === 15) {
      const note = root + bass[s];
      this.tone(440 * Math.pow(2, (note - 69) / 12), 0.14, 0.19 * v, 'sawtooth', 0, t, d);
      this.tone(440 * Math.pow(2, (note - 81) / 12), 0.18, 0.2 * v, 'sine', 0, t, d);
    }
    if (s % 4 === 2) {
      const seq = [0, 7, 12, 15, 12, 7, 3, 10], note = 62 + seq[(Math.floor(n / 4) + bar) % 8] + (bar === 3 ? -2 : 0);
      this.tone(440 * Math.pow(2, (note - 69) / 12), 0.19, 0.044 * v, 'triangle', 0, t, d);
      this.tone(440 * Math.pow(2, (note - 69) / 12), 0.16, 0.018 * v, 'sine', 0, t + 0.19, d);
    }
    if (s === 0 && bar % 2 === 0) for (const note of [root + 24, root + 31, root + 34]) this.tone(440 * Math.pow(2, (note - 69) / 12), 1.5, 0.022 * v, 'triangle', 0, t, d);
  }
}
