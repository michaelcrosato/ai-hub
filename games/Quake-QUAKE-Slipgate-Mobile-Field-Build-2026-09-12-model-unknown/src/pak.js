/** Bounded Quake PACK directory reader. Assets stay in local browser memory. */
export class Pak {
  constructor(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12) throw Error('The PAK header is missing.');
    if (buffer.byteLength > 384 * 1024 * 1024) throw Error('The PAK file is larger than 384 MB.');
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    const text = new TextDecoder('ascii');
    if (text.decode(this.bytes.subarray(0, 4)) !== 'PACK') throw Error('This file is not a Quake PACK archive.');
    const offset = this.view.getInt32(4, true);
    const size = this.view.getInt32(8, true);
    if (offset < 12 || size < 0 || size % 64 || offset + size > buffer.byteLength || size / 64 > 65536) throw Error('The PAK directory is not valid.');
    this.files = new Map();
    for (let p = offset; p < offset + size; p += 64) {
      const raw = this.bytes.subarray(p, p + 56);
      const end = raw.indexOf(0);
      const name = text.decode(raw.subarray(0, end < 0 ? 56 : end)).replaceAll('\\', '/').toLowerCase();
      if (!name || name.startsWith('/') || /^[a-z]:/.test(name) || name.split('/').some((s) => s === '..' || s === '.' || s === '') || /[\x00-\x1f]/.test(name)) {
        throw Error('The PAK contains an unsafe path.');
      }
      const start = this.view.getInt32(p + 56, true);
      const length = this.view.getInt32(p + 60, true);
      if (start < 12 || length < 0 || start + length > buffer.byteLength) throw Error(`The entry ${name} is outside the archive.`);
      if (this.files.has(name)) throw Error(`The PAK contains a duplicate entry: ${name}`);
      this.files.set(name, { offset: start, length });
    }
  }

  get(name) {
    const entry = this.files.get(name.toLowerCase());
    return entry ? this.bytes.subarray(entry.offset, entry.offset + entry.length) : null;
  }

  maps() {
    return [...this.files.keys()].filter((n) => /^maps\/[^/]+\.bsp$/.test(n)).sort();
  }
}

export function parseEntities(text) {
  const result = [];
  text = text.replace(/\/\/[^\n\r]*/g, '');
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}]/g) || [];
  let entity = null;
  const decode = (s) => s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{') {
      entity = {};
      continue;
    }
    if (token === '}') {
      if (entity) result.push(entity);
      entity = null;
      continue;
    }
    if (entity && token.startsWith('"') && tokens[i + 1]?.startsWith('"')) entity[decode(token)] = decode(tokens[++i]);
  }
  return result;
}
