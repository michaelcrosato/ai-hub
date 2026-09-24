export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
  }

  async start() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.12;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (!this.musicTimer) this.startMusic();
  }

  setMuted(value) {
    this.muted = value;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(value ? 0 : 0.42, this.ctx.currentTime, 0.02);
  }

  toggleMuted() { this.setMuted(!this.muted); return this.muted; }

  tone(freq, duration = 0.09, { type = 'square', volume = 0.12, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain); gain.connect(this.master);
    osc.start(now); osc.stop(now + duration + 0.02);
  }

  sfx(name) {
    const t = (f, d, o) => this.tone(f, d, o);
    switch (name) {
      case 'jump': t(310, .09, { type:'square', volume:.07, slide:130 }); break;
      case 'pogo': t(190, .075, { type:'triangle', volume:.09, slide:210 }); break;
      case 'coin': t(760, .06, { type:'square', volume:.055, slide:180 }); break;
      case 'gem': t(540, .12, { type:'triangle', volume:.08, slide:420 }); t(980,.08,{type:'square',volume:.04,delay:.05}); break;
      case 'relic': [392,523,659,784].forEach((f,i)=>t(f,.16,{type:'triangle',volume:.07,delay:i*.07})); break;
      case 'enemy': t(260,.07,{type:'sawtooth',volume:.07,slide:-120}); break;
      case 'hurt': t(170,.14,{type:'sawtooth',volume:.11,slide:-90}); break;
      case 'break': t(125,.09,{type:'square',volume:.10,slide:-55}); t(82,.12,{type:'sawtooth',volume:.06,delay:.04}); break;
      case 'bossTell': t(120,.18,{type:'square',volume:.06,slide:70}); break;
      case 'bossStart': t(92,.35,{type:'sawtooth',volume:.09,slide:38}); break;
      case 'bossHit': t(115,.12,{type:'square',volume:.12,slide:-25}); t(310,.07,{type:'triangle',volume:.05,delay:.03}); break;
      case 'bossDown': [220,174,146,110].forEach((f,i)=>t(f,.22,{type:'sawtooth',volume:.08,delay:i*.07,slide:-20})); break;
      case 'upgrade': [440,554,659].forEach((f,i)=>t(f,.15,{type:'triangle',volume:.065,delay:i*.08})); break;
      case 'level': [523,659,784,1046].forEach((f,i)=>t(f,.15,{type:'square',volume:.05,delay:i*.055})); break;
      case 'crown': [330,494,659,988].forEach((f,i)=>t(f,.18,{type:'triangle',volume:.07,delay:i*.08})); break;
      case 'fail': t(220,.22,{type:'sawtooth',volume:.08,slide:-120}); break;
      case 'win': [392,494,587,784,988].forEach((f,i)=>t(f,.20,{type:'triangle',volume:.07,delay:i*.09})); break;
    }
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // Original short arpeggio pattern. It evokes cartridge-era adventure without copying a source melody.
    const notes = [196, 247, 294, 392, 294, 247, 220, 277, 330, 440, 330, 277, 174, 220, 262, 349, 262, 220, 196, 247, 330, 392, 330, 247];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || document.hidden) return;
      const f = notes[this.step++ % notes.length];
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(gain); gain.connect(this.musicGain);
      osc.start(now); osc.stop(now + 0.15);
    }, 168);
  }

  destroy() {
    clearInterval(this.musicTimer); this.musicTimer = null;
    this.ctx?.close(); this.ctx = null;
  }
}
