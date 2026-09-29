/* A local audio engine. Notes use Web Audio's clock, not animation-frame timing.
   Speech uses only an installed, local English voice. No voice data is sent by this app. */

export const noteHz = (name) => {
  const match = /^([A-G])(#?)(\d)$/.exec(name);
  if (!match) return 440;
  const step = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] + (match[2] ? 1 : 0);
  return 440 * 2 ** (((+match[3] + 1) * 12 + step - 69) / 12);
};

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.38;
    this.muted = false;
    this.playing = false;
    this.song = null;
    this.position = 0;
    this.rate = 1;
    this.nodes = new Set();
    this.queueIndex = 0;
    this.uiIndex = -1;
    this.voice = null;
    this.voiceAvailable = false;
    this.generation = 0;
    this.refreshVoices = this.refreshVoices.bind(this);
    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', this.refreshVoices);
      this.refreshVoices();
    }
  }

  refreshVoices() {
    const voices = 'speechSynthesis' in window ? speechSynthesis.getVoices().filter((v) => v.localService && /^en[-_]/i.test(v.lang)) : [];
    this.voice = voices.find((v) => v.lang === 'en-CA') || voices.find((v) => v.lang === 'en-US') || voices[0] || null;
    this.voiceAvailable = Boolean(this.voice);
  }

  async unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Audio is not available in this browser.');
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -12;
      this.limiter.knee.value = 16;
      this.limiter.ratio.value = 6;
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      this.master.gain.value = this.muted ? 0 : this.volume;
    }
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') await this.ctx.resume();
  }

  setVolume(volume, muted = this.muted) {
    this.volume = Math.max(0, Math.min(0.7, Number(volume) || 0));
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
    if (this.voiceAudio) this.voiceAudio.volume = muted ? 0 : this.volume;
    if (muted && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  tone(pitch, when, duration = 0.5, soft = false, level = 1) {
    if (!this.ctx) return;
    const freq = typeof pitch === 'number' ? pitch : noteHz(pitch);
    // A soft, tuned wooden-bar timbre: fundamental and one quiet overtone.
    [1, 2.76].forEach((multiple, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * multiple;
      const amplitude = (soft ? 0.12 : 0.27) * (i ? 0.09 : 1) * level;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(amplitude, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.08, duration));
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(when);
      osc.stop(when + Math.max(0.08, duration) + 0.04);
      this.nodes.add(osc);
      osc.onended = () => {
        this.nodes.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  async chime(index = 0) {
    try {
      await this.unlock();
      this.tone([261.63, 293.66, 329.63, 392, 440, 523.25][index % 6], this.ctx.currentTime + 0.01, 0.48, true);
    } catch (_) {}
  }

  /** A soft rising arpeggio for finished moments (all apples counted, a song sung). */
  async sparkle() {
    try {
      await this.unlock();
      const t = this.ctx.currentTime + 0.03;
      ['C5', 'E5', 'G5', 'C6'].forEach((note, i) => this.tone(note, t + i * 0.095, 0.55, true, 0.95));
    } catch (_) {}
  }

  speak(text) {
    this.refreshVoices();
    if (this.muted || !this.voice || !('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice;
    utterance.lang = this.voice.lang;
    utterance.rate = 0.82;
    utterance.pitch = 1.06;
    utterance.volume = this.volume;
    speechSynthesis.speak(utterance);
    return true;
  }

  clearNodes() {
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch (_) {}
    }
    this.nodes.clear();
  }

  async play(song, { rate = 1, offset = 0, onNote = () => {}, onProgress = () => {}, onEnd = () => {}, recording = null, vocalBuffer = null, voiceLabel = null } = {}) {
    this.stop();
    const generation = this.generation;
    await this.unlock();
    if (generation !== this.generation) return false;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.song = song;
    this.rate = rate;
    this.position = offset;
    this.startOffset = offset;
    this.onNote = onNote;
    this.onProgress = onProgress;
    this.onEnd = onEnd;
    this.noteEvents = song.events.map((e) => ({ ...e, time: (e.beat * 60) / song.bpm / rate, duration: (e.beats * 60) / song.bpm / rate }));
    this.duration = song.duration / rate;
    this.queueIndex = this.noteEvents.findIndex((e) => e.time + e.duration > offset);
    if (this.queueIndex < 0) this.queueIndex = 0;
    this.uiIndex = -1;
    this.playing = true;
    this.accompaniment = vocalBuffer ? 0.16 : recording ? 0.28 : 1;
    this.voiceLabel = voiceLabel;
    this.origin = this.ctx.currentTime + 0.08 - offset;
    // Singing and music start on one sample clock. The voice buffer was made
    // at this pace. Slower playback does not lower the singer's pitch.
    if (vocalBuffer) {
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = vocalBuffer;
      gain.gain.value = 1.35;
      source.connect(gain);
      gain.connect(this.master);
      source.start(this.origin + offset, Math.min(offset, vocalBuffer.duration));
      this.nodes.add(source);
      this.vocalSource = source;
      source.onended = () => {
        this.nodes.delete(source);
        source.disconnect();
        gain.disconnect();
        if (this.vocalSource === source) this.vocalSource = null;
      };
    }
    // Saved parent recordings use the same score and pace. They do not leave this device.
    if (recording) {
      this.voiceURL = URL.createObjectURL(recording.blob);
      this.voiceAudio = new Audio(this.voiceURL);
      this.voiceAudio.volume = this.muted ? 0 : this.volume;
      this.voiceAudio.playbackRate = rate / (recording.rate || 1);
      this.voiceAudio.preservesPitch = true;
      this.voiceAudio.currentTime = (offset * rate) / (recording.rate || 1);
      this.voiceStart = setTimeout(() => this.voiceAudio?.play().catch(() => {}), 80);
    }
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    return true;
  }

  tick() {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    // Use the output timestamp for the word display when it is available.
    // Note scheduling continues to use the audio render clock.
    const stamp = this.ctx.getOutputTimestamp?.();
    const audible = stamp?.performanceTime > 0 ? Math.min(now, stamp.contextTime + Math.max(0, (performance.now() - stamp.performanceTime) / 1000)) : now;
    this.position = Math.max(this.startOffset, audible - this.origin);
    while (this.queueIndex < this.noteEvents.length && this.origin + this.noteEvents[this.queueIndex].time < now + 0.12) {
      const e = this.noteEvents[this.queueIndex++];
      const when = Math.max(now + 0.003, this.origin + e.time, this.origin + this.startOffset);
      const remaining = Math.max(0.02, this.origin + e.time + e.duration - when);
      if (e.time + e.duration > this.position) {
        this.tone(e.pitch, when, Math.min(remaining * 0.86, 1.6), false, this.accompaniment);
        if (e.word === 0 && e.beat % 4 === 0) this.tone(noteHz(e.pitch) / 2, when, Math.min(remaining, 1.3), true, this.accompaniment);
      }
    }
    // The note list is in time order: walk forward from the last shown note.
    let current = Math.max(-1, Math.min(this.uiIndex, this.noteEvents.length - 1));
    if (current >= 0 && this.noteEvents[current].time > this.position) current = -1;
    while (current + 1 < this.noteEvents.length && this.noteEvents[current + 1].time <= this.position) current++;
    if (current !== this.uiIndex && current >= 0) {
      this.uiIndex = current;
      this.onNote(this.noteEvents[current], current);
    }
    this.onProgress(Math.min(1, this.position / this.duration));
    if (this.position >= this.duration + 0.35) {
      const done = this.onEnd;
      this.stop();
      done();
    }
  }

  pause() {
    if (!this.playing) return this.position;
    const pos = this.position;
    this.stop();
    this.position = pos;
    return pos;
  }

  stop() {
    this.generation++;
    clearInterval(this.timer);
    clearTimeout(this.voiceStart);
    this.playing = false;
    this.clearNodes();
    this.vocalSource = null;
    if (this.voiceAudio) {
      this.voiceAudio.pause();
      this.voiceAudio = null;
    }
    if (this.voiceURL) {
      URL.revokeObjectURL(this.voiceURL);
      this.voiceURL = null;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}

export class RecordingStore {
  async db() {
    if (this.connection) return this.connection;
    this.connection = await new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('Local storage is not available.'));
      const request = indexedDB.open('little-world-voice', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('songs');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.connection;
  }
  async get(key) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const r = db.transaction('songs').objectStore('songs').get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }
  async put(key, value) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      tx.objectStore('songs').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Storage is full.'));
    });
  }
  async remove(key) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      tx.objectStore('songs').delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
}
