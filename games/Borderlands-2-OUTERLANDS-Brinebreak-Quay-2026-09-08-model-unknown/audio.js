// OUTERLANDS: all audio is synthesized locally. No recordings, streams, or speech service.
// Created on the first gesture (browsers block audio before one); the noise buffer is
// only built then, so nothing is decoded at load.

export function createAudio(settings, toast) {
  const audio = {
    ctx: null,
    master: null,
    sfx: null,
    musicBus: null,
    muted: false,
    nextBeat: 0,
    step: 0,
    suspendedByKit: false,
    init() {
      if (this.ctx) {
        if (!this.suspendedByKit) this.ctx.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = settings.volume;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 16;
        comp.ratio.value = 5;
        comp.attack.value = 0.003;
        comp.release.value = 0.15;
        this.master.connect(comp);
        comp.connect(c.destination);
        this.sfx = c.createGain();
        this.sfx.gain.value = 0.8;
        this.sfx.connect(this.master);
        this.musicBus = c.createGain();
        this.musicBus.gain.value = settings.music * 0.32;
        this.musicBus.connect(this.master);
        this.noiseBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
        const n = this.noiseBuf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < n.length; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          n[i] = w * 0.65 + last * 3.5;
        }
        const wind = c.createBufferSource();
        wind.buffer = this.noiseBuf;
        wind.loop = true;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        const g = c.createGain();
        g.gain.value = 0.09;
        wind.connect(f);
        f.connect(g);
        g.connect(this.master);
        wind.start();
        this.nextBeat = c.currentTime + 0.15;
        c.resume().catch(() => {});
      } catch (e) {
        console.warn('Audio unavailable:', e.message);
      }
    },
    /** The kit's settings panel or a lost tab pauses everything, audio included. */
    setPaused(paused) {
      this.suspendedByKit = paused;
      if (!this.ctx) return;
      if (paused) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    },
    tone(freq, to, duration, vol = 0.2, type = 'sine', when = 0, bus = null) {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = when || c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, freq), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      o.connect(g);
      g.connect(bus || this.sfx);
      o.start(t);
      o.stop(t + duration + 0.02);
    },
    noise(duration, vol, freq = 1600, when = 0, bus = null, type = 'lowpass') {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = when || c.currentTime;
      const s = c.createBufferSource();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      s.buffer = this.noiseBuf;
      f.type = type;
      f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      s.connect(f);
      f.connect(g);
      g.connect(bus || this.sfx);
      s.start(t, Math.random() * 1.5, duration);
      s.stop(t + duration + 0.01);
    },
    play(name, vol = 1) {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      switch (name) {
        case 'rifle':
          this.noise(0.14, 0.48 * vol, 4700);
          this.tone(155, 43, 0.15, 0.35 * vol, 'triangle');
          this.tone(720, 95, 0.065, 0.13 * vol, 'sawtooth');
          break;
        case 'shotgun':
          this.noise(0.32, 0.95 * vol, 3000);
          this.tone(112, 27, 0.28, 0.7 * vol, 'triangle');
          this.tone(430, 65, 0.1, 0.24 * vol, 'sawtooth');
          this.noise(0.07, 0.12 * vol, 4500, t + 0.18);
          break;
        case 'pistol':
          this.noise(0.13, 0.5 * vol, 5600);
          this.tone(195, 46, 0.16, 0.38 * vol, 'triangle');
          this.tone(910, 180, 0.035, 0.18 * vol, 'square');
          break;
        case 'enemy':
          this.noise(0.08, 0.21 * vol, 2300);
          this.tone(240, 60, 0.1, 0.12 * vol, 'triangle');
          break;
        case 'hit':
          this.noise(0.055, 0.18 * vol, 5000);
          this.tone(700, 350, 0.06, 0.075 * vol, 'triangle');
          break;
        case 'crit':
          this.tone(1450, 960, 0.12, 0.15 * vol, 'triangle');
          this.tone(2100, 1400, 0.08, 0.06 * vol, 'sine');
          break;
        case 'kill':
          this.tone(480, 720, 0.11, 0.1 * vol, 'square');
          this.tone(860, 1050, 0.1, 0.075 * vol, 'triangle', t + 0.06);
          break;
        case 'explode':
          this.noise(0.65, 0.9 * vol, 1100);
          this.tone(90, 23, 0.55, 0.85 * vol, 'sine');
          this.noise(0.22, 0.35 * vol, 3400);
          break;
        case 'arc':
          this.tone(80, 980, 0.3, 0.25 * vol, 'sawtooth');
          this.noise(0.65, 0.3 * vol, 3200);
          this.tone(880, 90, 0.48, 0.25 * vol, 'triangle', t + 0.18);
          break;
        case 'shield':
          this.tone(860, 110, 0.25, 0.21 * vol, 'sawtooth');
          this.noise(0.23, 0.21 * vol, 6200);
          break;
        case 'hurt':
          this.tone(130, 45, 0.17, 0.24 * vol, 'triangle');
          this.noise(0.08, 0.2 * vol, 900);
          break;
        case 'reload':
          this.noise(0.07, 0.22 * vol, 2700);
          this.tone(330, 170, 0.07, 0.07 * vol, 'square');
          break;
        case 'cock':
          this.noise(0.06, 0.3 * vol, 4200);
          this.noise(0.065, 0.16 * vol, 2700, t + 0.07);
          break;
        case 'empty':
          this.tone(1300, 550, 0.035, 0.06 * vol, 'square');
          break;
        case 'foot':
          this.noise(0.09, 0.095 * vol, 1400);
          this.tone(90, 60, 0.065, 0.025 * vol, 'triangle');
          break;
        case 'land':
          this.noise(0.16, 0.25 * vol, 1100);
          this.tone(95, 40, 0.13, 0.11 * vol, 'sine');
          break;
        case 'jump':
          this.noise(0.1, 0.08 * vol, 1600);
          break;
        case 'pickup':
          this.tone(620, 800, 0.085, 0.1 * vol, 'triangle');
          this.tone(1080, 1350, 0.11, 0.07 * vol, 'triangle', t + 0.06);
          break;
        case 'loot':
          for (let i = 0; i < 5; i++) this.tone([330, 440, 550, 660, 880][i], [330, 440, 550, 660, 880][i], 0.34, 0.13 * vol, 'triangle', t + i * 0.09);
          break;
        case 'relay':
          this.tone(90, 460, 0.6, 0.2 * vol, 'sawtooth');
          for (let i = 0; i < 3; i++) this.tone(440 + i * 220, 440 + i * 220, 0.17, 0.14 * vol, 'triangle', t + 0.3 + i * 0.12);
          break;
        case 'radio':
          this.tone(1100, 1600, 0.07, 0.065 * vol, 'sine');
          this.noise(0.13, 0.08 * vol, 2100);
          break;
        case 'level':
          for (let i = 0; i < 5; i++) this.tone(330 * Math.pow(1.26, i), 330 * Math.pow(1.26, i), 0.25, 0.15 * vol, 'triangle', t + i * 0.08);
          break;
        case 'down':
          this.tone(250, 40, 0.8, 0.32 * vol, 'sawtooth');
          break;
        case 'win':
          for (let i = 0; i < 8; i++) this.tone([220, 330, 440, 550, 660, 550, 660, 880][i], [220, 330, 440, 550, 660, 550, 660, 880][i], 0.6, 0.2 * vol, 'triangle', t + i * 0.14);
          break;
        case 'ui':
          this.tone(540, 720, 0.06, 0.09 * vol, 'triangle');
          break;
        case 'melee':
          this.noise(0.16, 0.25 * vol, 1100);
          this.tone(150, 55, 0.13, 0.15 * vol, 'triangle');
          break;
        case 'lob': // Slush Lobber mortar thump
          this.tone(210, 70, 0.22, 0.2 * vol, 'triangle');
          this.noise(0.2, 0.18 * vol, 1500);
          this.tone(900, 1400, 0.12, 0.05 * vol, 'sine', t + 0.05);
          break;
        case 'charge': // Knuckles Brine winds up a charge
          this.tone(60, 240, 0.5, 0.3 * vol, 'sawtooth');
          this.noise(0.5, 0.28 * vol, 900);
          break;
        case 'bounty':
          for (let i = 0; i < 4; i++) this.tone([392, 523, 659, 784][i], [392, 523, 659, 784][i], 0.3, 0.14 * vol, 'square', t + i * 0.1);
          break;
      }
    },
    tick(active, combat) {
      if (!this.ctx) return;
      const c = this.ctx;
      this.master.gain.setTargetAtTime(this.muted ? 0 : settings.volume * (active ? 1 : 0.45), c.currentTime, 0.08);
      this.musicBus.gain.setTargetAtTime(settings.music * 0.37, c.currentTime, 0.2);
      if (!active || settings.music === 0 || c.state !== 'running') {
        this.nextBeat = c.currentTime + 0.1;
        return;
      }
      if (this.nextBeat < c.currentTime - 0.4) this.nextBeat = c.currentTime + 0.03;
      while (this.nextBeat < c.currentTime + 0.12) {
        const t = this.nextBeat;
        const k = this.step % 16;
        const bar = Math.floor(this.step / 16) % 4;
        const root = [55, 65.406, 49, 58.27][bar];
        const bus = this.musicBus;
        this.tone(root, root, 0.22, combat ? 0.43 : 0.28, 'sawtooth', t, bus);
        if (k % 4 === 0) {
          this.tone(140, 38, 0.2, 0.76, 'sine', t, bus);
          this.noise(0.05, 0.2, 650, t, bus);
        }
        if (k % 8 === 4) {
          this.noise(0.13, 0.36, 2600, t, bus);
          this.tone(180, 80, 0.08, 0.2, 'triangle', t, bus);
        }
        if (combat || k % 2 === 0) this.noise(0.035, k % 2 ? 0.06 : 0.1, 7300, t, bus, 'highpass');
        if ([0, 3, 6, 8, 10, 14].includes(k)) {
          const note = root * (k === 14 ? 3 : k === 6 ? 2.667 : 2);
          this.tone(note, note * 0.98, 0.15, combat ? 0.27 : 0.12, 'sawtooth', t, bus);
          this.tone(note * 1.5, note * 1.48, 0.14, combat ? 0.11 : 0.04, 'triangle', t, bus);
        }
        if (k === 0) this.tone(root * 4, root * 4, 1.7, 0.04, 'triangle', t, bus);
        this.step++;
        this.nextBeat += 60 / 112 / 4;
      }
    },
    toggle() {
      this.muted = !this.muted;
      toast(this.muted ? 'SOUND OFF' : 'SOUND ON', 1.5);
    },
  };
  return audio;
}
