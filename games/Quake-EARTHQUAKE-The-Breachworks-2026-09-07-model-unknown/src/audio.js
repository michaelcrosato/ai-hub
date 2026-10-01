// audio.js: every sound is made with Web Audio. No samples, streams or files.
// The context is created on the first gesture, suspended while the game is paused,
// and sounds are skipped while it is not running (so nothing piles up during a pause).

import { clamp } from './geo.js';

export function createAudio(options, ear) {
  let ctx = null, master = null, noiseBuffer = null;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = options.muted ? 0 : options.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // The ambient bed: three low drones and filtered wind.
      const ambient = ctx.createGain();
      ambient.gain.value = 0.12;
      ambient.connect(master);
      for (const f of [36.7, 55, 73.6]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.value = 0.13;
        o.connect(g);
        g.connect(ambient);
        o.start();
      }
      const wind = ctx.createBufferSource();
      wind.buffer = noiseBuffer;
      wind.loop = true;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 240;
      const wg = ctx.createGain();
      wg.gain.value = 0.15;
      wind.connect(low);
      low.connect(wg);
      wg.connect(ambient);
      wind.start();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) {
      console.warn('Audio unavailable', e);
      ctx = null;
    }
  }

  const live = () => !!ctx && ctx.state === 'running';

  function route(node, vol, pan = 0) {
    const gain = ctx.createGain();
    gain.gain.value = vol;
    node.connect(gain);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      gain.connect(p);
      p.connect(master);
    } else gain.connect(master);
    return gain;
  }
  function tone(freq, end, dur, vol = 0.2, type = 'triangle', delay = 0, pan = 0) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(10, freq), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, end), t + dur);
    const g = route(o, 0, pan);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  function noise(dur, freq, vol = 0.3, delay = 0, pan = 0, kind = 'lowpass') {
    const t = ctx.currentTime + delay, s = ctx.createBufferSource();
    s.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = kind;
    f.frequency.value = freq;
    f.Q.value = 0.6;
    s.connect(f);
    const g = route(f, 0, pan);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.start(t, Math.random() * 0.7);
    s.stop(t + dur + 0.03);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  function sfx(name, pos = null, volume = 1) {
    if (!live()) return;
    let pan = 0, v = volume;
    const e = pos && ear();
    if (e) {
      const dx = pos[0] - e.x, dz = pos[2] - e.z, dist = Math.hypot(dx, dz);
      v *= Math.min(1, 8 / (dist + 1));
      pan = clamp((dx * Math.cos(e.yaw) - dz * Math.sin(e.yaw)) / (dist || 1), -1, 1) * 0.8;
    }
    switch (name) {
      case 'shotgun': noise(0.23, 1700, 0.6 * v, 0, pan); noise(0.1, 7500, 0.22 * v, 0, pan, 'highpass'); tone(140, 38, 0.17, 0.4 * v, 'triangle', 0, pan); noise(0.07, 1700, 0.12 * v, 0.31, pan, 'bandpass'); tone(730, 470, 0.035, 0.05 * v, 'square', 0.39, pan); break;
      case 'nailgun': noise(0.075, 4400, 0.32 * v, 0, pan, 'highpass'); tone(245, 95, 0.065, 0.16 * v, 'sawtooth', 0, pan); break;
      case 'rocket': noise(0.5, 470, 0.7 * v, 0, pan); tone(230, 38, 0.22, 0.4 * v, 'sawtooth', 0, pan); break;
      case 'explosion': noise(0.85, 600, 0.8 * v, 0, pan); noise(0.18, 2100, 0.36 * v, 0, pan); tone(83, 24, 0.65, 0.65 * v, 'triangle', 0, pan); break;
      case 'axe': noise(0.16, 1100, 0.2 * v, 0, pan, 'bandpass'); tone(130, 55, 0.1, 0.13 * v, 'triangle', 0, pan); break;
      case 'hit': noise(0.1, 900, 0.23 * v, 0, pan); tone(82, 42, 0.1, 0.11 * v, 'triangle', 0, pan); break;
      case 'hurt': tone(145, 70, 0.22, 0.17 * v, 'sawtooth', 0, pan); noise(0.17, 410, 0.18 * v, 0, pan); break;
      case 'jump': tone(138, 83, 0.12, 0.07 * v, 'triangle', 0, pan); break;
      case 'land': noise(0.12, 250, 0.24 * v, 0, pan); tone(68, 39, 0.1, 0.13 * v, 'sine', 0, pan); break;
      case 'step': noise(0.055, 650, 0.11 * v, 0, pan); tone(95, 55, 0.042, 0.043 * v, 'triangle', 0, pan); break;
      case 'pickup': tone(520, 680, 0.09, 0.11 * v, 'triangle', 0, pan); tone(780, 920, 0.16, 0.09 * v, 'triangle', 0.08, pan); break;
      case 'key':
      case 'secret': for (let i = 0; i < 4; i++) tone([220, 330, 440, 660][i], [221, 331, 441, 661][i], 0.6, 0.12 * v, 'sine', i * 0.11, pan); noise(0.5, 1500, 0.1 * v, 0, pan); break;
      case 'gate': noise(1.5, 230, 0.33 * v, 0, pan); tone(45, 70, 1.4, 0.16 * v, 'sawtooth', 0, pan); noise(0.25, 500, 0.3 * v, 1.2, pan); break;
      case 'switch': tone(125, 42, 0.24, 0.2 * v, 'square', 0, pan); noise(0.35, 700, 0.2 * v, 0, pan); tone(330, 440, 0.5, 0.12 * v, 'triangle', 0.18, pan); break;
      case 'alert': tone(85, 45, 0.5, 0.15 * v, 'sawtooth', 0, pan); noise(0.3, 380, 0.2 * v, 0, pan); break;
      case 'death': tone(120, 27, 0.62, 0.2 * v, 'sawtooth', 0, pan); noise(0.37, 460, 0.22 * v, 0, pan); break;
      case 'portal': for (let i = 0; i < 5; i++) tone(90 + i * 53, 260 + i * 90, 1.2, 0.11 * v, 'sine', i * 0.14, pan); break;
      case 'click': tone(370, 270, 0.045, 0.08 * v, 'square', 0, pan); break;
      // New for the Smeltery: the Hexer's hex and blink, and the Smelter King's slag bombs.
      case 'hex': tone(520, 260, 0.35, 0.12 * v, 'sine', 0, pan); tone(780, 390, 0.3, 0.08 * v, 'triangle', 0.05, pan); break;
      case 'blink': tone(300, 900, 0.18, 0.1 * v, 'sine', 0, pan); noise(0.2, 3000, 0.08 * v, 0, pan, 'highpass'); break;
      case 'sizzle': noise(0.3, 2600, 0.12 * v, 0, pan, 'highpass'); tone(90, 60, 0.2, 0.06 * v, 'sawtooth', 0, pan); break;
    }
  }

  function setVolume() {
    if (master) master.gain.setTargetAtTime(options.muted ? 0 : options.volume, ctx.currentTime, 0.03);
  }

  return {
    init,
    sfx,
    setVolume,
    /** Pause the whole mix (game paused, tab hidden, kit menu open). */
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    get started() {
      return !!ctx;
    },
  };
}
