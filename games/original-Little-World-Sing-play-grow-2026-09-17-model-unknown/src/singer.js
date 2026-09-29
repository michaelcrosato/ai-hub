/* The singer uses local audio buffers for playback. Built-in singing tracks
   (made from the Flite SLT voice and score-driven pitch shaping) are MP3 files
   next to the game, fetched only when a song is chosen and decoded only when
   it plays. Playback never waits for a model or uses the microphone.

   Earlier versions could prepare "neural" singing with a downloaded speech
   model. That download is gone (the game loads nothing from other sites), but
   songs already saved on this device still play, and can be removed. */

const VERSION = 2;
/** Built-in singing tracks shipped with the game: `${song}-${pace}-${zed|zee}`. */
const TRACKS = new Set([
  'twinkle-1-zed', 'twinkle-0.85-zed',
  'abc-1-zed', 'abc-1-zee', 'abc-0.85-zed', 'abc-0.85-zee',
  'row-1-zed', 'row-0.85-zed',
  'farm-1-zed', 'farm-0.85-zed',
]);
const trackURL = (key) => new URL(`../audio/${key}.mp3`, import.meta.url).href;

class VoiceStore {
  async db() {
    if (this.connection) return this.connection;
    this.connection = await new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(Error('Local song storage is not available.'));
      const request = indexedDB.open('little-world-singing', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('tracks');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.connection;
  }
  async get(key) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const r = db.transaction('tracks').objectStore('tracks').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async keys() {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const r = db.transaction('tracks').objectStore('tracks').getAllKeys();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async clear() {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction('tracks', 'readwrite');
      t.objectStore('tracks').clear();
      t.oncomplete = () => resolve();
      t.onerror = t.onabort = () => reject(t.error || Error('Saved songs could not be removed.'));
    });
  }
}

export const MUSIC_ONLY = 'Music only · you sing';

export class Singer {
  constructor({ onChange = () => {} } = {}) {
    this.store = new VoiceStore();
    this.buffers = new Map();
    this.bytes = new Map();
    this.ready = new Set();
    this.onChange = onChange;
    this.scan().catch(() => {});
  }

  get saved() {
    return this.ready.size;
  }

  async scan() {
    this.ready = new Set(await this.store.keys());
    this.onChange();
  }

  key(song, pace, z) {
    return `${song.id}-${pace}-${song.id === 'abc' ? z : 'zed'}`;
  }

  /** Is there any singing voice for this song (saved neural or built-in)? */
  has(song, pace, z, source = 'auto') {
    const key = this.key(song, pace, z);
    return (source !== 'builtin' && this.ready.has(key)) || TRACKS.has(key);
  }

  name(song, pace, z, source = 'auto') {
    const key = this.key(song, pace, z);
    if (source !== 'builtin' && this.ready.has(key)) return 'Neural singing';
    return TRACKS.has(key) ? 'Built-in singing' : MUSIC_ONLY;
  }

  #fetch(key) {
    const request = fetch(trackURL(key)).then((r) => {
      if (!r.ok) throw Error('The singing voice could not load. Check the connection, or choose Music only.');
      return r.arrayBuffer();
    });
    request.catch(() => {}); // a failed prefetch is retried when the song plays
    return request;
  }

  /** Start downloading a song's built-in track (bytes only) so Play starts quickly. */
  prefetch(song, pace, z) {
    const key = this.key(song, pace, z);
    if (!TRACKS.has(key) || this.bytes.has(key) || this.buffers.has('built:' + key)) return;
    if (this.bytes.size >= 3) this.bytes.delete(this.bytes.keys().next().value);
    this.bytes.set(key, this.#fetch(key));
  }

  /** The decoded singing for a song, or null when the song has no singing track. */
  async getBuffer(song, pace, z, ctx, source = 'auto') {
    const key = this.key(song, pace, z);
    let saved = null;
    if (source !== 'builtin' && this.ready.has(key)) {
      try {
        saved = await this.store.get(key);
      } catch (_) {}
    }
    const useSaved = saved?.version === VERSION && saved.pcm instanceof Float32Array && saved.sampleRate === 24000;
    if (!useSaved && !TRACKS.has(key)) return null;
    const cacheKey = (useSaved ? 'neural:' : 'built:') + key;
    const label = useSaved ? 'Neural singing' : 'Built-in singing';
    if (this.buffers.has(cacheKey)) return { buffer: this.buffers.get(cacheKey), label };
    let buffer;
    if (useSaved) {
      buffer = ctx.createBuffer(1, saved.pcm.length, saved.sampleRate);
      buffer.copyToChannel(saved.pcm, 0);
    } else {
      let data;
      const pending = this.bytes.get(key);
      this.bytes.delete(key); // decodeAudioData detaches the bytes: never reuse them
      try {
        data = await (pending || this.#fetch(key));
      } catch (_) {
        data = await this.#fetch(key);
      }
      buffer = await ctx.decodeAudioData(data);
    }
    const expected = song.duration / pace;
    if (buffer.duration < expected - 0.08 || buffer.duration > expected + 0.6) throw Error('This voice track does not match the song.');
    if (this.buffers.size >= 4) this.buffers.delete(this.buffers.keys().next().value);
    this.buffers.set(cacheKey, buffer);
    return { buffer, label };
  }

  async remove() {
    await this.store.clear();
    this.ready.clear();
    for (const key of [...this.buffers.keys()]) if (key.startsWith('neural:')) this.buffers.delete(key);
    this.onChange();
  }

  get debug() {
    return { saved: this.ready.size, bufferCount: this.buffers.size, prefetched: this.bytes.size };
  }
}
