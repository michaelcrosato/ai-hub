/* Sham-mue — generated music, harbour ambience and sound effects (Web Audio).
   Unchanged tunes and effects; noise bursts now reuse cached buffers instead of building a new
   buffer for every footstep, speech voices load when the browser announces them, and the
   context suspends while the game is paused. */

const COMBAT = [50, 57, 60, 57, 53, 60, 62, 60, 48, 55, 58, 55, 50, 57, 62, 57];
const ROAM = [62, 69, 72, 74, 69, 65, 67, 69, 62, 65, 69, 67, 65, 60, 62, 0, 65, 69, 74, 77, 74, 72, 69, 67, 62, 65, 60, 62, 0, 57, 60, 62];

export class HarbourSound {
  constructor() { this.ctx = null; this.muted = false; this.volume = .55; this.voice = false; this.nextNote = 0; this.note = 0; this.noiseCache = new Map(); this.voices = []; this.paused = false; }
  init() {
    if (this.ctx) { if (!this.paused) this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.volume; this.master.connect(c.destination);
      this.music = c.createGain(); this.music.gain.value = .65; this.music.connect(this.master);
      this.fx = c.createGain(); this.fx.gain.value = .8; this.fx.connect(this.master);
      const length = Math.floor(c.sampleRate * 2.8), buffer = c.createBuffer(2, length, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const a = buffer.getChannelData(ch); for (let i = 0; i < length; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3) * .33; }
      this.reverb = c.createConvolver(); this.reverb.buffer = buffer; const wet = c.createGain(); wet.gain.value = .3; this.reverb.connect(wet); wet.connect(this.music);
      const wind = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), data = wind.getChannelData(0); let v = 0;
      for (let i = 0; i < data.length; i++) { v = (v + (Math.random() * 2 - 1) * .025) * .997; data[i] = v; }
      const src = c.createBufferSource(); src.buffer = wind; src.loop = true; const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 500;
      const vol = c.createGain(); vol.gain.value = .13; src.connect(filter); filter.connect(vol); vol.connect(this.master); src.start(); this.wind = vol;
      this.engine = c.createOscillator(); this.engine.type = 'sawtooth'; this.engine.frequency.value = 40; const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 160;
      this.engineGain = c.createGain(); this.engineGain.gain.value = 0; this.engine.connect(ef); ef.connect(this.engineGain); this.engineGain.connect(this.fx); this.engine.start();
      this.nextNote = c.currentTime + .2; this.nextGull = c.currentTime + 9;
      if (this.paused) c.suspend().catch(() => {});
    } catch (e) { console.warn('Audio is not available:', e.message); this.ctx = null; }
    if (window.speechSynthesis && !this.voiceHook) {
      this.voiceHook = true;
      const load = () => { try { this.voices = speechSynthesis.getVoices().filter(v => v.localService && v.lang.startsWith('en')); } catch (e) { this.voices = []; } };
      load(); speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }
  /** Pause with the game (the kit menu, a hidden tab). */
  setPaused(p) { this.paused = p; if (!this.ctx) return; (p ? this.ctx.suspend() : this.ctx.resume()).catch(() => {}); if (p) this.stopSpeech(); }
  setMute(v) { this.muted = v; if (this.ctx) this.master.gain.setTargetAtTime(v ? 0 : this.volume, this.ctx.currentTime, .1); if (v && window.speechSynthesis) speechSynthesis.cancel(); }
  setVolume(v) { this.volume = v; if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, .1); }
  tone(freq, t, dur = .3, vol = .1, type = 'sine', dest = null) {
    if (!this.ctx || this.muted) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest || this.fx); o.start(t); o.stop(t + dur + .03);
  }
  pluck(midi, t, vol = .14) { const f = 440 * Math.pow(2, (midi - 69) / 12); this.tone(f, t, 2, vol, 'triangle', this.music); this.tone(f * 2, t, .8, vol * .15, 'sine', this.reverb); this.tone(f, t, 2.5, vol * .36, 'sine', this.reverb); }
  noiseBuffer(dur) {
    const key = Math.round(dur * 100); let n = this.noiseCache.get(key);
    if (!n) { const c = this.ctx; n = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate); const a = n.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 2); this.noiseCache.set(key, n); }
    return n;
  }
  noise(dur = .15, vol = .15, cut = 900) {
    if (!this.ctx || this.muted) return; const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuffer(dur);
    const g = c.createGain(); g.gain.value = vol; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; s.connect(f); f.connect(g); g.connect(this.fx); s.start();
  }
  sfx(name) {
    if (!this.ctx || this.muted) return; const t = this.ctx.currentTime;
    switch (name) {
      case 'click': this.tone(690, t, .08, .035, 'triangle'); break;
      case 'note': [62, 69, 74].forEach((n, i) => this.pluck(n, t + i * .16, .09)); break;
      case 'success': [65, 69, 72, 77].forEach((n, i) => this.pluck(n, t + i * .12, .12)); break;
      case 'fail': this.tone(170, t, .4, .1, 'triangle'); this.tone(120, t + .13, .4, .1, 'triangle'); break;
      case 'step': this.noise(.09, .08, 620); this.tone(72, t, .08, .035, 'sine'); break;
      case 'punch': this.noise(.14, .28, 600); this.tone(95, t, .12, .08, 'sine'); break;
      case 'swing': this.noise(.12, .065, 1700); break;
      case 'kick': this.noise(.18, .38, 680); this.tone(68, t, .18, .12); break;
      case 'block': this.noise(.09, .15, 2200); this.tone(340, t, .15, .05, 'triangle'); break;
      case 'load': this.noise(.35, .18, 680); this.tone(150, t, .2, .08, 'square'); this.tone(200, t + .15, .15, .05, 'square'); break;
      case 'soda': this.noise(.7, .12, 4700); this.tone(980, t, .06, .04, 'triangle'); break;
      case 'coin': this.tone(1700, t, .16, .06); this.tone(2300, t + .06, .25, .035); break;
      case 'meow': this.slide(700, 1050, t, .18, .07); this.slide(1050, 640, t + .16, .25, .06); break;
      case 'qte': this.tone(800, t, .12, .08, 'triangle'); this.tone(1000, t + .08, .2, .055, 'triangle'); break;
      case 'dart': this.noise(.06, .22, 800); this.tone(150, t, .12, .055); break;
      // New for the yard run and the sparring match.
      case 'count': this.tone(620, t, .18, .07, 'triangle'); break;
      case 'go': this.tone(930, t, .35, .08, 'triangle'); this.tone(1240, t + .05, .3, .04, 'sine'); break;
      case 'gate': this.tone(1320, t, .12, .05, 'triangle'); this.tone(1760, t + .07, .18, .04, 'triangle'); break;
      case 'thud': this.noise(.2, .3, 380); this.tone(58, t, .2, .1); break;
      case 'charge': this.noise(.3, .12, 420); this.slide(180, 90, t, .35, .06); break;
    }
  }
  slide(from, to, t, d, vol = .05) {
    if (!this.ctx || this.muted) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .025); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(this.fx); o.start(t); o.stop(t + d + .03);
  }
  speak(text, name) {
    if (!this.voice || this.muted || !window.speechSynthesis) return; speechSynthesis.cancel();
    const local = this.voices.length ? this.voices : speechSynthesis.getVoices().filter(v => v.localService && v.lang.startsWith('en'));
    if (!local.length) return;
    const u = new SpeechSynthesisUtterance(text); u.voice = local[name === 'Hana' ? Math.min(1, local.length - 1) : 0]; u.rate = .84; u.pitch = name === 'Jun' ? .82 : name === 'Hana' ? 1.12 : .94; u.volume = this.volume * .9;
    try { speechSynthesis.speak(u); } catch (e) { /* no voice today */ }
  }
  stopSpeech() { if (window.speechSynthesis) speechSynthesis.cancel(); }
  update(mode, speed, rain) {
    if (!this.ctx || this.paused) return; const c = this.ctx, t = c.currentTime;
    this.engineGain.gain.setTargetAtTime(mode === 'forklift' ? .025 + Math.abs(speed) * .013 : 0, t, .1); this.engine.frequency.setTargetAtTime(32 + Math.abs(speed) * 17, t, .12); this.wind.gain.setTargetAtTime(.11 + rain * .12, t, .5);
    if (t > this.nextGull) { if (mode !== 'combat') { this.slide(940, 1440, t, .22, .018); this.slide(1440, 890, t + .2, .32, .021); this.slide(1100, 1380, t + .75, .18, .014); } this.nextGull = t + 15 + Math.random() * 20; }
    const combat = mode === 'combat' || mode === 'qte';
    const motif = combat ? COMBAT : ROAM;
    if (t > this.nextNote + .5) this.nextNote = t + .05;
    while (this.nextNote < t + .14) {
      const n = motif[this.note % motif.length]; if (n) this.pluck(n, this.nextNote, combat ? .055 : .075);
      if (this.note % 8 === 0) { const bass = [38, 41, 36, 38][Math.floor(this.note / 8) % 4]; this.tone(440 * Math.pow(2, (bass - 69) / 12), this.nextNote, 5, .065, 'sine', this.music); this.tone(440 * Math.pow(2, (bass + 7 - 69) / 12), this.nextNote, 4, .025, 'sine', this.reverb); }
      this.note++; this.nextNote += combat ? .31 : .65;
    }
  }
}
