/** All audio paths live in audio/manifest.json next to the game. This manager has
 * no hard-coded audio filenames and no voice synthesis or remote tracking. */
const MANIFEST_URL = new URL('../audio/manifest.json', import.meta.url);

export class AudioBus {
  constructor(settings) {
    this.settings = settings;
    this.manifest = null;
    this.base = MANIFEST_URL;
    this.buffers = new Map();
    this.pending = new Map();
    this.last = new Map();
    this.voices = new Set();
    this.context = null;
    this.master = null;
    this.musicElement = null;
    this.musicId = null;
    this.loading = null;
    this.unlocking = null;
    this.unlocked = false;
    this.holds = new Set();
    this.status = 'Not started';
  }
  async load() {
    const response = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Audio manifest HTTP ${response.status}`);
    this.manifest = await response.json();
    return this.manifest;
  }
  /**
   * Start the audio context inside a user gesture; sound effects decode in the background after that.
   * Every call resumes the context again: a first attempt outside a real gesture (a controller press)
   * leaves it suspended, and the old code then never retried because it waited on that first attempt.
   */
  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return Promise.resolve();
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      if (!this.holds.size && this.context.state !== 'running') this.context.resume().catch(() => {});
    } catch (error) {
      this.status = `Audio unavailable: ${error.message}`;
      return Promise.resolve();
    }
    if (this.unlocked) return Promise.resolve();
    if (this.unlocking) return this.unlocking;
    this.unlocking = (async () => {
      try {
        if (!this.loading) this.loading = this.load();
        await this.loading;
        this.unlocked = true;
        this.update();
        this.status = 'Original placeholder audio';
        // Music asked for before the manifest arrived starts now, not after every effect has decoded.
        if (this.musicId && !this.musicElement) {
          const id = this.musicId;
          this.musicId = null;
          this.music(id);
        }
        await Promise.all(Object.entries(this.manifest.assets).filter(([, a]) => a.category === 'sfx').map(([id]) => this.buffer(id).catch(() => null)));
      } catch (error) {
        this.loading = null;
        this.status = `Audio unavailable: ${error.message}`;
        console.warn(this.status);
      } finally {
        this.unlocking = null;
      }
    })();
    return this.unlocking;
  }
  buffer(id) {
    if (this.buffers.has(id)) return Promise.resolve(this.buffers.get(id));
    if (this.pending.has(id)) return this.pending.get(id);
    const a = this.manifest?.assets[id];
    if (!a || !this.context) return Promise.resolve(null);
    const job = (async () => {
      for (const path of [a.url, a.fallback].filter(Boolean)) {
        try {
          const r = await fetch(new URL(path, this.base), { signal: AbortSignal.timeout(10000) });
          if (!r.ok) continue;
          const decoded = await this.context.decodeAudioData(await r.arrayBuffer());
          this.buffers.set(id, decoded);
          return decoded;
        } catch {
          /* Try the manifest fallback. */
        }
      }
      return null;
    })();
    this.pending.set(id, job);
    job.finally(() => this.pending.delete(id));
    return job;
  }
  play(id, { volume = 1, pan = 0, rate = 1 } = {}) {
    if (!this.unlocked || this.settings.muted || !this.context || this.holds.size) return;
    const a = this.manifest?.assets[id];
    if (!a) return;
    const now = this.context.currentTime;
    if (now - (this.last.get(id) ?? -100) < (a.cooldown ?? 0.08) || this.voices.size >= 24) return;
    this.last.set(id, now);
    const buffer = this.buffers.get(id);
    if (!buffer) {
      this.buffer(id).catch(() => {});
      return;
    }
    const s = this.context.createBufferSource();
    const g = this.context.createGain();
    const p = this.context.createStereoPanner();
    s.buffer = buffer;
    s.playbackRate.value = rate;
    g.gain.value = (a.gain ?? 1) * volume;
    p.pan.value = Math.max(-1, Math.min(1, pan));
    s.connect(g);
    g.connect(p);
    p.connect(this.master);
    this.voices.add(s);
    s.onended = () => {
      s.disconnect();
      g.disconnect();
      p.disconnect();
      this.voices.delete(s);
    };
    s.start();
  }
  music(id) {
    if (this.musicId === id && this.musicElement) {
      this.update();
      if (!this.holds.size && this.musicElement.paused) this.musicElement.play().catch(() => {});
      return;
    }
    this.musicId = id;
    this.musicElement?.pause();
    this.musicElement = null;
    const a = this.manifest?.assets[id];
    if (!a || !this.unlocked) return;
    const element = new Audio(new URL(a.url, this.base).href);
    element.loop = a.loop !== false;
    element.preload = 'auto';
    this.musicElement = element;
    this.update();
    element.addEventListener('error', () => {
      if (a.fallback && !element.dataset.fallback) {
        element.dataset.fallback = '1';
        element.src = new URL(a.fallback, this.base).href;
        if (!this.holds.size) element.play().catch(() => {});
      }
    });
    if (!this.holds.size) element.play().catch(() => {});
  }
  update() {
    const v = this.settings.muted ? 0 : this.settings.volume;
    if (this.master) this.master.gain.setTargetAtTime(v, this.context.currentTime, 0.04);
    if (this.musicElement) this.musicElement.volume = Math.max(0, Math.min(1, v * this.settings.music * (this.manifest?.assets[this.musicId]?.gain ?? 1)));
  }
  /**
   * Hold (silence) or release the audio for one reason: 'hidden' for a background tab,
   * 'kit' while the shared settings panel is open. Audio resumes when no reason is left.
   */
  hold(reason, on) {
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    if (this.holds.size) {
      this.musicElement?.pause();
      this.context?.suspend().catch(() => {});
    } else if (this.unlocked) {
      this.context?.resume().catch(() => {});
      this.musicElement?.play().catch(() => {});
    }
  }
}
