export const AudioEngine = class {
  ctx = null;
  master;
  sfxBus;
  musicBus;
  crowdBus;
  crowdFilter;
  noise;
  crowdLevel = 0.25;
  crowdTarget = 0.25;
  musicTimer = null;
  musicStep = 0;
  musicNext = 0;
  musicSong = null;
  musicOn = true;
  sfxOn = true;
  announcerOn = true;
  voice = null;
  lastSpeak = 0;
  held = false; // true while the kit's settings panel (or a hidden tab) has the game paused
  unlock() {
    if (this.ctx) {
      this.ctx.state === `suspended` && !this.held && this.ctx.resume();
      return;
    }
    let e = window.AudioContext || window.webkitAudioContext;
    if (!e) return;
    let t = new e();
    this.ctx = t;
    this.master = t.createGain();
    this.master.gain.value = 0.8;
    let n = t.createDynamicsCompressor();
    n.threshold.value = -14;
    n.ratio.value = 4;
    this.master.connect(n).connect(t.destination);
    this.sfxBus = t.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = t.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
    this.musicBus.connect(this.master);
    this.crowdBus = t.createGain();
    this.crowdBus.gain.value = 0;
    this.crowdBus.connect(this.master);
    let r = t.sampleRate * 2;
    this.noise = t.createBuffer(1, r, t.sampleRate);
    let i = this.noise.getChannelData(0),
      a = 0,
      o = 0;
    for (let e = 0; e < r; e++) {
      let t = Math.random() * 2 - 1;
      a = 0.99765 * a + t * 0.099046;
      o = 0.963 * o + t * 0.2965538;
      i[e] = (a + o + t * 0.1848) * 0.35;
    }
    let s = t.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    this.crowdFilter = t.createBiquadFilter();
    this.crowdFilter.type = `bandpass`;
    this.crowdFilter.frequency.value = 900;
    this.crowdFilter.Q.value = 0.6;
    let c = t.createOscillator();
    c.frequency.value = 0.23;
    let l = t.createGain();
    l.gain.value = 250;
    c.connect(l).connect(this.crowdFilter.frequency);
    c.start();
    s.connect(this.crowdFilter).connect(this.crowdBus);
    s.start();
    let u = () => {
      let e = window.speechSynthesis?.getVoices() ?? [];
      this.voice =
        e.find((e) => /en-US/i.test(e.lang) && /male|david|guy|alex|fred/i.test(e.name)) ??
        e.find((e) => /en/i.test(e.lang)) ??
        null;
    };
    `speechSynthesis` in window && (u(), (window.speechSynthesis.onvoiceschanged = u));
    setInterval(() => this.tickCrowd(), 50);
    // A song requested before the first gesture (the title theme) starts now instead of never.
    if (this.musicSong && this.musicTimer === null) {
      const song = this.musicSong;
      this.musicSong = null;
      this.playMusic(song);
    }
  }
  tickCrowd() {
    this.ctx &&
      ((this.crowdLevel += (this.crowdTarget - this.crowdLevel) * 0.08),
      (this.crowdTarget += (0.22 - this.crowdTarget) * 0.02),
      this.crowdBus.gain.setTargetAtTime(this.sfxOn ? this.crowdLevel * 0.55 : 0, this.ctx.currentTime, 0.05),
      (this.crowdFilter.Q.value = 0.5 + this.crowdLevel * 0.4));
  }
  crowd(e) {
    this.crowdTarget = Math.max(this.crowdTarget, e);
  }
  /** Pause everything that makes sound (kit.onPause): the synth graph and the announcer. */
  hold(on) {
    this.held = on;
    const speech = `speechSynthesis` in window ? window.speechSynthesis : null;
    if (on) {
      this.ctx?.state === `running` && this.ctx.suspend();
      speech?.pause();
    } else {
      this.ctx?.state === `suspended` && this.ctx.resume();
      speech?.resume();
    }
  }
  setVolumes(e, t, n) {
    // Switching the announcer off also stops a line that is already being read.
    !n && this.announcerOn && `speechSynthesis` in window && window.speechSynthesis.cancel();
    this.musicOn = e;
    this.sfxOn = t;
    this.announcerOn = n;
    this.ctx && this.musicBus.gain.setTargetAtTime(e ? 0.32 : 0, this.ctx.currentTime, 0.1);
  }
  env(e, t, n, r, i) {
    e.gain.setValueAtTime(1e-4, t);
    e.gain.exponentialRampToValueAtTime(r, t + n);
    e.gain.exponentialRampToValueAtTime(1e-4, t + n + i);
  }
  osc(e, t, n, r, i, a, o) {
    let s = this.ctx,
      c = s.createOscillator();
    c.type = e;
    c.frequency.setValueAtTime(t, r);
    n !== t && c.frequency.exponentialRampToValueAtTime(Math.max(1, n), r + i);
    let l = s.createGain();
    return (
      this.env(l, r, 0.005, a, i),
      c.connect(l).connect(o ?? this.sfxBus),
      c.start(r),
      c.stop(r + i + 0.05),
      c
    );
  }
  noiseBurst(e, t, n, r, i, a = 1, o, s) {
    let c = this.ctx,
      l = c.createBufferSource();
    l.buffer = this.noise;
    let u = c.createBiquadFilter();
    u.type = r;
    u.frequency.setValueAtTime(i, e);
    o && u.frequency.exponentialRampToValueAtTime(o, e + t);
    u.Q.value = a;
    let d = c.createGain();
    this.env(d, e, 0.004, n, t);
    l.connect(u)
      .connect(d)
      .connect(s ?? this.sfxBus);
    l.start(e, Math.random() * 1.5);
    l.stop(e + t + 0.05);
  }
  play(e, t = 1) {
    if (!this.ctx || !this.sfxOn) return;
    let n = this.ctx.currentTime + 0.001,
      r = t;
    switch (e) {
      case `whistle`: {
        let e = this.ctx;
        for (let t of [2750, 3180]) {
          let r = e.createOscillator();
          r.frequency.value = t;
          let i = e.createOscillator();
          i.frequency.value = 38;
          let a = e.createGain();
          a.gain.value = 120;
          i.connect(a).connect(r.frequency);
          let o = e.createGain();
          o.gain.setValueAtTime(1e-4, n);
          o.gain.exponentialRampToValueAtTime(0.09, n + 0.02);
          o.gain.setValueAtTime(0.09, n + 0.42);
          o.gain.exponentialRampToValueAtTime(1e-4, n + 0.55);
          r.connect(o).connect(this.sfxBus);
          r.start(n);
          i.start(n);
          r.stop(n + 0.6);
          i.stop(n + 0.6);
        }
        break;
      }
      case `hit`:
        this.osc(`sine`, 140, 45, n, 0.18, 0.5 * r);
        this.noiseBurst(n, 0.12, 0.5 * r, `lowpass`, 1400);
        break;
      case `bighit`:
        this.osc(`sine`, 110, 30, n, 0.45, 0.9);
        this.osc(`square`, 90, 40, n, 0.2, 0.25);
        this.noiseBurst(n, 0.35, 0.9, `lowpass`, 2600, 1, 300);
        this.noiseBurst(n + 0.02, 0.2, 0.4, `highpass`, 3e3);
        break;
      case `thud`:
        this.osc(`sine`, 90, 40, n, 0.15, 0.35 * r);
        break;
      case `kick`:
        this.osc(`sine`, 180, 60, n, 0.14, 0.7);
        this.noiseBurst(n, 0.05, 0.6, `bandpass`, 1800, 2);
        break;
      case `catch`:
        this.osc(`triangle`, 420, 260, n, 0.08, 0.35);
        this.noiseBurst(n, 0.05, 0.25, `bandpass`, 1200, 3);
        break;
      case `throw`:
        this.noiseBurst(n, 0.35, 0.25, `bandpass`, 600, 4, 2500);
        break;
      case `swoosh`:
        this.noiseBurst(n, 0.3, 0.3, `bandpass`, 3e3, 2, 500);
        break;
      case `spin`:
        this.noiseBurst(n, 0.3, 0.3, `bandpass`, 900, 5, 3500);
        this.osc(`triangle`, 300, 900, n, 0.25, 0.12);
        break;
      case `blip`:
        this.osc(`square`, 880, 880, n, 0.05, 0.12);
        break;
      case `tick`:
        this.osc(`square`, 1500, 1500, n, 0.03, 0.08);
        break;
      case `select`:
        [523, 659, 784, 1047].forEach((e, t) => this.osc(`square`, e, e, n + t * 0.05, 0.08, 0.13));
        break;
      case `back`:
        this.osc(`square`, 440, 220, n, 0.12, 0.12);
        break;
      case `coin`:
        this.osc(`square`, 988, 988, n, 0.07, 0.15);
        this.osc(`square`, 1319, 1319, n + 0.07, 0.3, 0.15);
        break;
      case `flag`:
        this.osc(`sawtooth`, 700, 500, n, 0.25, 0.15);
        this.osc(`sawtooth`, 700, 500, n + 0.3, 0.25, 0.15);
        break;
      case `doink`:
        this.osc(`sine`, 1250, 1210, n, 0.9, 0.4);
        this.osc(`sine`, 2890, 2850, n, 0.6, 0.18);
        break;
      case `buzzer`:
        this.osc(`sawtooth`, 110, 110, n, 1.1, 0.35);
        this.osc(`sawtooth`, 116, 116, n, 1.1, 0.35);
        break;
      case `fumble`:
        this.osc(`square`, 600, 150, n, 0.4, 0.2);
        break;
      case `fire`:
        for (let e = 0; e < 6; e++)
          this.noiseBurst(n + e * 0.06, 0.08, 0.3, `highpass`, 2e3 + Math.random() * 3e3);
        this.osc(`sawtooth`, 200, 800, n, 0.5, 0.15);
        break;
      case `firework`:
        this.osc(`sine`, 300 + Math.random() * 200, 60, n, 0.5, 0.4);
        this.noiseBurst(n, 0.8, 0.45, `lowpass`, 3e3, 1, 200);
        break;
      case `horn`:
        for (let e of [233, 294, 349]) {
          this.osc(`sawtooth`, e, e * 0.98, n, 1.2, 0.12);
          this.osc(`sawtooth`, e * 1.006, e * 0.985, n, 1.2, 0.1);
        }
        break;
      case `td`:
        for (let [e, t] of [
          [392, 0],
          [523, 0.12],
          [659, 0.24],
          [784, 0.36],
          [659, 0.54],
          [784, 0.66],
        ]) {
          this.osc(`sawtooth`, e, e, n + t, 0.22, 0.14);
          this.osc(`square`, e / 2, e / 2, n + t, 0.22, 0.08);
        }
        this.osc(`sawtooth`, 1047, 1047, n + 0.8, 0.9, 0.14);
        this.osc(`sawtooth`, 784, 784, n + 0.8, 0.9, 0.12);
        this.osc(`sawtooth`, 523, 523, n + 0.8, 0.9, 0.12);
    }
  }
  playMusic(e) {
    e !== this.musicSong &&
      ((this.musicSong = e),
      this.musicTimer !== null && (clearInterval(this.musicTimer), (this.musicTimer = null)),
      e &&
        this.ctx &&
        ((this.musicStep = 0),
        (this.musicNext = this.ctx.currentTime + 0.05),
        (this.musicTimer = window.setInterval(() => this.scheduleMusic(), 25))));
  }
  scheduleMusic() {
    if (!this.ctx || !this.musicSong) return;
    let e = 60 / (this.musicSong === `title` ? 148 : 132) / 4;
    for (; this.musicNext < this.ctx.currentTime + 0.12; ) {
      this.musicNote(this.musicStep, this.musicNext, e);
      this.musicNext += e;
      this.musicStep++;
    }
  }
  musicNote(e, t, n) {
    let r = this.musicBus,
      i = Math.floor(e / 16) % 4,
      a = e % 16,
      o = this.musicSong === `title`,
      s = (o ? [40, 36, 38, 35] : [45, 41, 43, 40])[i],
      c = (e) => 440 * 2 ** ((e - 69) / 12);
    if (
      (a % 4 == 0 && this.osc(`sine`, 150, 40, t, 0.16, 0.55, r),
      a % 8 == 4 && this.noiseBurst(t, 0.12, 0.35, `highpass`, 1500, 0.7, undefined, r),
      a % 2 == 1 && this.noiseBurst(t, 0.03, 0.12, `highpass`, 7e3, 1, undefined, r),
      a % 2 == 0)
    ) {
      let e = s + (a === 6 || a === 14 ? 12 : 0);
      this.osc(`sawtooth`, c(e), c(e), t, n * 1.6, 0.16, r);
    }
    if (a === 0 || a === 3 || a === 6 || a === 10)
      for (let e of [0, 7, 12]) this.osc(`square`, c(s + 24 + e), c(s + 24 + e), t, n * 2.2, 0.035, r);
    let l = (
      i % 2 == 0
        ? [12, -1, 15, -1, 17, 19, -1, 17, 15, -1, 12, -1, 10, 12, -1, -1]
        : [19, -1, 17, 15, -1, 12, 15, -1, 17, -1, 19, 22, -1, 19, -1, -1]
    )[a];
    if (l >= 0 && (o || i >= 2)) {
      let e = (o ? 64 : 69) + l - 12;
      this.osc(`square`, c(e), c(e), t, n * 1.8, 0.05, r);
      this.osc(`triangle`, c(e + 12), c(e + 12), t, n * 1.4, 0.03, r);
    }
  }
  say(e, t = {}) {
    if (!this.announcerOn || !(`speechSynthesis` in window)) return;
    let n = performance.now(),
      r = window.speechSynthesis;
    if (!t.priority && r.speaking && n - this.lastSpeak < 2500) return;
    t.priority && r.cancel();
    let i = new SpeechSynthesisUtterance(e);
    this.voice && (i.voice = this.voice);
    i.pitch = t.pitch ?? 0.75;
    i.rate = t.rate ?? 1.12;
    i.volume = 1;
    r.speak(i);
    this.lastSpeak = n;
  }
};
