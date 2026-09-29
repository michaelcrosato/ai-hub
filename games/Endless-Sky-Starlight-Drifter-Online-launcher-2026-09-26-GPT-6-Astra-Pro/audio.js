/**
 * Every audio file, role, and gain is declared in one swappable manifest
 * (audio/manifest.json). Nothing is fetched or decoded until the first click,
 * tap or key press; effects decode first, then the 48-second music loop.
 */
const MANIFEST_URL = new URL('./audio/manifest.json', import.meta.url);

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.buffers = new Map();
    this.manifest = null;
    this.loading = null;
    this.musicSource = null;
    this.desired = false;
    this.failures = [];
    this.holds = new Set(); // reasons the context is suspended: 'hidden', 'menu'
    this.lastPlayed = new Map();
  }
  async unlock() {
    this.desired = true;
    if (!this.context) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.context = new C();
      this.master = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.context.destination);
      this.apply();
    }
    if (this.context.state === 'suspended' && !this.holds.size) await this.context.resume().catch(() => {});
    if (!this.loading) this.loading = this.load();
    await this.loading;
    this.startMusic();
  }
  async load() {
    try {
      const response = await fetch(MANIFEST_URL);
      if (!response.ok) throw new Error(`Audio manifest: HTTP ${response.status}`);
      this.manifest = await response.json();
      const decode = async ([id, asset]) => {
        try {
          const r = await fetch(new URL(asset.file, MANIFEST_URL));
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const buffer = await this.context.decodeAudioData(await r.arrayBuffer());
          this.buffers.set(id, buffer);
        } catch (err) {
          this.failures.push(id);
          console.warn('Audio unavailable:', id, err.message);
        }
      };
      const entries = Object.entries(this.manifest.assets);
      await Promise.all(entries.filter(([id]) => id !== 'music').map(decode));
      const music = entries.find(([id]) => id === 'music');
      if (music) {
        await decode(music);
        this.startMusic();
      }
    } catch (err) {
      this.failures.push('manifest');
      console.warn(err.message);
    }
  }
  apply(settings = this.settings) {
    this.settings = settings;
    if (!this.context) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : Number(settings.volume ?? 0.6), now, 0.03);
    this.musicGain.gain.setTargetAtTime(Number(settings.music ?? 0.35), now, 0.08);
    this.sfxGain.gain.setTargetAtTime(0.65, now, 0.03);
  }
  startMusic() {
    if (!this.desired || this.musicSource || !this.buffers.has('music') || !this.context) return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get('music');
    source.loop = true;
    const gain = this.context.createGain();
    gain.gain.value = this.manifest.assets.music.gain ?? 0.7;
    source.connect(gain);
    gain.connect(this.musicGain);
    source.start();
    this.musicSource = source;
  }
  /** Play an effect. `vary` detunes it slightly so rapid repeats (lasers) do not sound mechanical. */
  play(id, { vary = 0, gain = 1, minGap = 0.025 } = {}) {
    if (!this.context || this.context.state !== 'running') return;
    const buffer = this.buffers.get(id);
    if (!buffer) return;
    // Several hits in one physics step would stack into one loud click.
    const now = this.context.currentTime;
    if (now - (this.lastPlayed.get(id) ?? -1) < minGap) return;
    this.lastPlayed.set(id, now);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    if (vary) source.playbackRate.value = 1 + (Math.random() * 2 - 1) * vary;
    const g = this.context.createGain();
    g.gain.value = (this.manifest.assets[id]?.gain ?? 0.7) * gain;
    source.connect(g);
    g.connect(this.sfxGain);
    source.start();
    source.onended = () => {
      source.disconnect();
      g.disconnect();
    };
  }
  /** A short synthesized two-tone alert (low hull, boss arrival) that needs no file. */
  alert(high = 880, low = 587, length = 0.12) {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (now - (this.lastPlayed.get('alert') ?? -1) < 0.6) return;
    this.lastPlayed.set('alert', now);
    const osc = this.context.createOscillator();
    const g = this.context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(high, now);
    osc.frequency.setValueAtTime(low, now + length);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    g.gain.setValueAtTime(0.16, now + length * 2 - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + length * 2);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + length * 2 + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
  /** Suspend for a reason ('hidden', 'menu'); audio resumes when every reason is gone. */
  hold(reason, on) {
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    if (!this.context) return;
    if (this.holds.size) this.context.suspend().catch(() => {});
    else if (this.desired) this.context.resume().catch(() => {});
  }
  dispose() {
    try {
      this.musicSource?.stop();
      this.context?.close();
    } catch {}
    this.buffers.clear();
  }
}
