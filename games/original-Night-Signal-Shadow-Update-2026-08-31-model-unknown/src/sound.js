import { clamp, dot, sub } from './math.js';
import { Random } from './random.js';

const CAPTIONS = {
  step: 'Footsteps', door: 'A door moves', radio: 'A radio plays', breath: 'Breathing', crank: 'A handle turns',
  enemy: 'A low pulse', alarm: 'The exit alarm', pickup: 'Fuse collected', glass: 'Glass breaks',
};
const TONES = new Set(['radio', 'enemy', 'alarm', 'pickup']);
const QUIET_CAPTIONS = new Set(['step', 'crank', 'breath', 'pickup']);

/**
 * Every sound is synthesised (oscillators and one noise buffer), positioned
 * with HRTF at the place the sound appears to come from after doors and
 * windows. The context starts on the first gesture.
 */
export class Sound {
  constructor(settings, caption) {
    this.settings = settings;
    this.caption = caption;
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.noise = null;
    this.active = 0;
    this.sources = new Set();
    this.listenerPosition = [0, 0, 0];
    this.listenerForward = [0, 0, -1];
  }
  async unlock() {
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error('No Web Audio here.');
      const c = (this.context = new Ctx());
      this.master = c.createGain();
      this.compressor = c.createDynamicsCompressor();
      this.master.connect(this.compressor);
      this.compressor.connect(c.destination);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = this.noise.getChannelData(0);
      const rng = new Random('audio-noise');
      for (let i = 0; i < data.length; i++) data[i] = rng.range(-1, 1);
      this.apply(this.settings);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  apply(s) {
    this.settings = s;
    if (this.master && this.context) this.master.gain.setTargetAtTime(s.volume, this.context.currentTime, 0.03);
    if (this.compressor) {
      this.compressor.threshold.value = s.range === 'night' ? -35 : -10;
      this.compressor.ratio.value = s.range === 'night' ? 8 : 3;
      this.compressor.knee.value = 18;
    }
  }
  listener(position, forward) {
    this.listenerPosition = position;
    this.listenerForward = forward;
    if (!this.context || this.context.state !== 'running') return;
    const l = this.context.listener;
    const t = this.context.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(position[0], t);
      l.positionY.setValueAtTime(position[1], t);
      l.positionZ.setValueAtTime(position[2], t);
      l.forwardX.setValueAtTime(forward[0], t);
      l.forwardY.setValueAtTime(forward[1], t);
      l.forwardZ.setValueAtTime(forward[2], t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      // Older Safari: the deprecated setters.
      l.setPosition?.(position[0], position[1], position[2]);
      l.setOrientation?.(forward[0], forward[1], forward[2], 0, 1, 0);
    }
  }
  play(heard) {
    const e = heard.event;
    if (heard.level < 8) return;
    if (this.settings.captions && !QUIET_CAPTIONS.has(e.kind) && e.source !== 'player') {
      const label = e.kind === 'impact' ? (e.surface === 'glass' ? 'Glass hits a surface' : 'Metal strikes a surface') : e.kind === 'enemy' && e.surface === 'blind' ? 'A dry clicking' : CAPTIONS[e.kind];
      const delta = sub(heard.apparentPosition, this.listenerPosition);
      const side = dot(delta, [-this.listenerForward[2], 0, this.listenerForward[0]]);
      const front = dot(delta, this.listenerForward);
      const where = delta[1] > 2 ? 'above' : delta[1] < -2 ? 'below' : Math.abs(side) > 2 ? (side > 0 ? 'right' : 'left') : Math.abs(front) > 2 ? (front > 0 ? 'ahead' : 'behind') : 'nearby';
      if (label) this.caption(`${label} — ${where}`);
    }
    if (!this.context || !this.master || this.context.state !== 'running' || this.active >= 24 || this.settings.volume === 0) return;
    const c = this.context;
    const t = c.currentTime + Math.min(0.3, heard.delay);
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    const panner = c.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.rolloffFactor = 0;
    if (panner.positionX) {
      panner.positionX.value = heard.apparentPosition[0];
      panner.positionY.value = heard.apparentPosition[1];
      panner.positionZ.value = heard.apparentPosition[2];
    } else panner.setPosition?.(heard.apparentPosition[0], heard.apparentPosition[1], heard.apparentPosition[2]);
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(heard.lowpass, e.kind === 'step' ? 1700 : 12000);
    gain.connect(filter);
    filter.connect(panner);
    panner.connect(this.master);
    const amp = clamp(Math.pow(10, (heard.level - 65) / 25), 0.004, 0.65);
    let source;
    let duration = 0.22;
    if (TONES.has(e.kind)) {
      const osc = c.createOscillator();
      osc.type = e.kind === 'pickup' ? 'sine' : 'triangle';
      const f = e.kind === 'enemy' ? (e.surface === 'blind' ? 36 : 48) : e.kind === 'alarm' ? 340 : e.kind === 'radio' ? 210 : 680;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(e.kind === 'alarm' ? 520 : e.kind === 'pickup' ? 980 : f * 0.74, t + 0.35);
      duration = e.kind === 'enemy' ? 0.85 : e.kind === 'alarm' ? 0.75 : 0.45;
      osc.connect(gain);
      source = osc;
    } else {
      const buffer = c.createBufferSource();
      buffer.buffer = this.noise;
      buffer.playbackRate.value = e.kind === 'door' ? 0.35 : e.kind === 'breath' ? 0.4 : e.kind === 'crank' ? 0.7 : 1;
      duration = e.kind === 'door' ? 0.5 : e.kind === 'breath' ? 0.55 : e.kind === 'glass' ? 0.6 : 0.18;
      if (e.kind === 'step') filter.frequency.value = Math.min(filter.frequency.value, e.surface === 'carpet' ? 450 : e.surface === 'metal' ? 3500 : 1300);
      buffer.connect(gain);
      source = buffer;
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, amp), t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    this.active++;
    this.sources.add(source);
    source.onended = () => {
      this.active--;
      this.sources.delete(source);
      source.disconnect();
      gain.disconnect();
      filter.disconnect();
      panner.disconnect();
    };
    source.start(t);
    source.stop(t + duration + 0.02);
  }
  pause() {
    if (this.context && this.context.state === 'running') this.context.suspend().catch(() => {});
  }
  stopAll() {
    for (const s of [...this.sources]) {
      try {
        s.stop();
      } catch {
        /* The source can already be stopped. */
      }
    }
  }
}
