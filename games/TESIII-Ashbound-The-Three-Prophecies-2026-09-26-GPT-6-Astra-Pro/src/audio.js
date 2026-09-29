import { resourceJSON, resourceBuffer } from './resources.js';
/** One manifest owns every sound. Missing audio must not stop the game. */
export class AudioBus {
  constructor() {
    this.buffers = new Map();
    this.manifest = null;
    this.music = null;
    this.last = {};
    this.enabled = false;
    this.loading = null;
    this.requestedMusic = 'explore';
    this.options = { volume: 0.55, musicVolume: 0.28, sfxVolume: 0.8, mute: false };
  }
  async init() {
    this.manifest = await resourceJSON('audio/manifest.json');
  }
  async unlock() {
    if (!this.context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is not available in this browser.');
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.update(this.options);
    }
    // Resume during the user gesture, before decoding promises lose that gesture.
    const resumed = this.context.resume();
    if (this.enabled) {
      await resumed;
      return;
    }
    // Each sound becomes playable as soon as it has decoded, so short effects
    // do not wait for the two long music loops to download.
    this.enabled = true;
    this.loading ??= Promise.all(
      Object.entries(this.manifest.assets).map(async ([key, entry]) => {
        try {
          const bytes = await resourceBuffer(entry.path);
          this.buffers.set(key, await this.context.decodeAudioData(bytes));
          if (key === this.requestedMusic) this.playMusic(key);
        } catch (e) {
          console.warn('Audio asset unavailable:', key, e.message);
        }
      }),
    );
    await resumed;
  }
  /** The kit pauses the loop while its settings panel is open; hold the sound there too. */
  suspend(on) {
    if (!this.context) return;
    if (on) this.context.suspend().catch(() => {});
    else this.context.resume().catch(() => {});
  }
  update(options) {
    this.options = { ...this.options, ...options };
    if (this.master)
      this.master.gain.setTargetAtTime(this.options.mute ? 0 : this.options.volume, this.context.currentTime, 0.08);
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.options.musicVolume, this.context.currentTime, 0.25);
  }
  play(key, volume = 1, rate = 1) {
    if (!this.enabled || !this.buffers.has(key) || this.options.mute) return;
    if (this.context.currentTime - (this.last[key] ?? -9) < 0.045) return;
    this.last[key] = this.context.currentTime;
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = this.buffers.get(key);
    source.playbackRate.value = rate;
    gain.gain.value = volume * this.options.sfxVolume;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }
  playMusic(key) {
    this.requestedMusic = key;
    if (!this.context || !this.buffers.has(key) || this.musicKey === key) return;
    this.music?.stop();
    this.music?.disconnect();
    this.musicGain?.disconnect();
    this.musicKey = key;
    this.music = this.context.createBufferSource();
    this.music.loop = true;
    this.music.buffer = this.buffers.get(key);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = this.options.musicVolume;
    this.music.connect(this.musicGain);
    this.musicGain.connect(this.master);
    this.music.start();
  }
}
