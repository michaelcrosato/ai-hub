/** Short synthesised cues: every sound is an oscillator sweep, so nothing is downloaded. */
const SOUNDS = {
  attack: { frequency: 170, duration: 0.06, type: "sawtooth", slide: -50 },
  hit: { frequency: 95, duration: 0.08, type: "square", slide: -30 },
  loot: { frequency: 520, duration: 0.12, type: "sine", slide: 180 },
  quest: { frequency: 360, duration: 0.18, type: "triangle", slide: 120 },
  level: { frequency: 440, duration: 0.35, type: "sine", slide: 440 },
  hurt: { frequency: 120, duration: 0.11, type: "sawtooth", slide: -70 },
  heal: { frequency: 330, duration: 0.22, type: "sine", slide: 220 },
  click: { frequency: 260, duration: 0.035, type: "triangle", slide: 20 },
  // Added cues: weapon swing, dodge roll, a failed action, the forge, trials, boss rage and a fall.
  swing: { frequency: 210, duration: 0.05, type: "triangle", slide: -90, gain: 0.35 },
  dodge: { frequency: 300, duration: 0.09, type: "triangle", slide: -170 },
  deny: { frequency: 180, duration: 0.07, type: "square", slide: -25, gain: 0.45 },
  forge: { frequency: 640, duration: 0.16, type: "square", slide: -260, gain: 0.55 },
  trial: { frequency: 280, duration: 0.3, type: "triangle", slide: 300 },
  boss: { frequency: 110, duration: 0.45, type: "sawtooth", slide: -60 },
  death: { frequency: 240, duration: 0.7, type: "sine", slide: -170 },
};

export class AudioSystem {
  context;
  master;
  volume = 0.45;
  paused = false;
  lastPlayed = new Map();

  setVolume(e) {
    this.volume = Math.max(0, Math.min(1, e));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.volume * 0.22, this.context.currentTime, 0.02);
    }
  }

  /** Create the context on a user gesture and resume it if the browser suspended it. True once audio runs. */
  unlock() {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume * 0.22;
        this.master.connect(this.context.destination);
      } catch {
        return false;
      }
    }
    if (this.context.state === "suspended" && !this.paused) this.context.resume().catch(() => {});
    return this.context.state === "running";
  }

  /** Silence everything while the game is paused (the kit's settings panel, a hidden tab). */
  setPaused(on) {
    this.paused = on;
    if (!this.context || this.context.state === "closed") return;
    if (on) this.context.suspend().catch(() => {});
    else this.context.resume().catch(() => {});
  }

  destroy() {
    if (this.context && this.context.state !== "closed") {
      this.context.close();
    }
    this.context = undefined;
    this.master = undefined;
  }

  play(name) {
    if (!this.context || !this.master || this.volume <= 0 || this.context.state !== "running") {
      return;
    }
    const n = SOUNDS[name];
    if (!n) return;
    const i = this.context.currentTime;
    // An area attack can hit many foes in one step; one cue per 35 ms is plenty.
    if (i - (this.lastPlayed.get(name) ?? -1) < 0.035) return;
    this.lastPlayed.set(name, i);
    const r = this.context.createOscillator();
    const a = this.context.createGain();
    r.type = n.type;
    r.frequency.setValueAtTime(n.frequency, i);
    r.frequency.exponentialRampToValueAtTime(Math.max(35, n.frequency + n.slide), i + n.duration);
    a.gain.setValueAtTime(0.0001, i);
    a.gain.exponentialRampToValueAtTime(0.8 * (n.gain ?? 1), i + 0.008);
    a.gain.exponentialRampToValueAtTime(0.0001, i + n.duration);
    r.connect(a);
    a.connect(this.master);
    r.start(i);
    r.stop(i + n.duration + 0.02);
  }
}
