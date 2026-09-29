/**
 * Authored procedural audio. Every sound is a short oscillator phrase, so the
 * game loads no audio files and nothing from other sites. The first build
 * streamed PS1 placeholder tracks from an external archive; those are gone,
 * and the procedural phrases that were their fallback now play everywhere.
 */
const SOUNDS = {
  select: { notes: [[620, 0.025], [920, 0.035]], gain: 0.12 },
  move: { notes: [[190, 0.035]], gain: 0.12 },
  hit: { notes: [[120, 0.045], [65, 0.09]], gain: 0.12, wave: 'triangle' },
  spell: { notes: [[330, 0.06], [440, 0.06], [660, 0.12]], gain: 0.12 },
  heal: { notes: [[440, 0.05], [550, 0.07], [880, 0.12]], gain: 0.12 },
  error: { notes: [[180, 0.07], [140, 0.09]], gain: 0.12 },
  chime: { notes: [[523, 0.09], [659, 0.09], [784, 0.15]], gain: 0.12 },
  ambient: { notes: [[146.83, 1.6], [220, 1.6], [174.61, 1.6], [130.81, 1.6]], gain: 0.045, music: true },
};
/** Jingles that used to be recorded placeholders. */
const JINGLES = { learn: 'chime', level: 'chime', reward: 'chime', job: 'chime' };
/** Music cues: looping cues repeat the ambient phrase, the two fanfares play once. */
const ONE_SHOT = { victory: 'chime', defeat: 'ambient' };

export class AudioManager {
  constructor(options) {
    this.options = options;
    this.unlocked = false;
    this.paused = false;
    this.key = null;
    document.addEventListener('visibilitychange', () => this.#suspend(document.hidden));
  }
  unlock() {
    if (this.unlocked) {
      if (!this.paused && !document.hidden) this.context?.resume();
      return;
    }
    this.unlocked = true;
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      /* no Web Audio */
    }
    if (this.key) this.playMusic(this.key, true);
  }
  configure(options) {
    this.options = options;
  }
  /** The game loop paused (settings panel) or resumed. */
  setPaused(on) {
    this.paused = on;
    this.#suspend(on || document.hidden);
  }
  #suspend(on) {
    if (!this.context) return;
    if (on) this.context.suspend();
    else if (this.unlocked && !this.paused) this.context.resume();
  }
  synth(key) {
    if (!this.context || this.options.mute || !this.unlocked) return;
    const a = SOUNDS[key];
    if (!a) return;
    const level = (a.gain || 0.08) * this.options.volume * (a.music ? this.options.music : this.options.sfx);
    if (level <= 0) return;
    let at = this.context.currentTime;
    for (const [hz, seconds] of a.notes) {
      const osc = this.context.createOscillator(),
        gain = this.context.createGain();
      osc.type = a.wave || 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
      osc.connect(gain).connect(this.context.destination);
      osc.start(at);
      osc.stop(at + seconds + 0.02);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      at += seconds;
    }
  }
  play(key) {
    if (!this.unlocked || this.options.mute) return;
    this.synth(JINGLES[key] || key);
  }
  playMusic(key, force = false) {
    if (this.key === key && !force) return;
    this.key = key;
    clearInterval(this.ambient);
    if (!this.unlocked) return;
    if (ONE_SHOT[key]) {
      this.synth(ONE_SHOT[key]);
      return;
    }
    this.ambient = setInterval(() => {
      if (!this.paused && !document.hidden) this.synth('ambient');
    }, 6800);
    this.synth('ambient');
  }
  dispose() {
    clearInterval(this.ambient);
    this.context?.close();
  }
}
