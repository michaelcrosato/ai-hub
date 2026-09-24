/**
 * zip.mjs — just enough of the zip format to unpack a project someone sent
 * you, with Node built-ins only. Reads stored and deflated entries, zip64
 * archives (source packages that still carry node_modules easily pass 65,535
 * entries), and refuses anything it cannot read faithfully rather than
 * guessing: encrypted entries, exotic compression, and paths that would land
 * outside the folder they are unpacked into.
 *
 * APPNOTE.TXT is the reference: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 */

import { inflateRawSync } from 'node:zlib';
import * as zlib from 'node:zlib';

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const MAX_COMMENT = 0xffff;

const u16 = (buf, at) => buf.readUInt16LE(at);
const u32 = (buf, at) => buf.readUInt32LE(at);
const u64 = (buf, at) => {
  const value = buf.readBigUInt64LE(at);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('zip entry too large');
  return Number(value);
};

function findEndOfCentralDirectory(buf) {
  const stop = Math.max(0, buf.length - 22 - MAX_COMMENT);
  for (let at = buf.length - 22; at >= stop; at--) {
    if (u32(buf, at) === SIG_EOCD) return at;
  }
  throw new Error('not a zip file (no end-of-central-directory record)');
}

/** MS-DOS date and time, as stored in every zip header, to a Date. */
function dosDate(date, time) {
  const year = 1980 + (date >> 9);
  const month = ((date >> 5) & 0xf) - 1;
  const day = date & 0x1f;
  const d = new Date(year, month, day, time >> 11, (time >> 5) & 0x3f, (time & 0x1f) * 2);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalise an entry name to a safe relative posix path, or null if it could
 * escape the directory it is unpacked into. Windows tools sometimes write
 * backslashes, and a hostile archive can carry `../` or an absolute path.
 */
export function safeEntryPath(name) {
  const parts = [];
  for (const part of String(name).replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' || part.includes('\0')) return null;
    parts.push(part);
  }
  if (!parts.length) return null;
  if (/^[a-z]:$/i.test(parts[0])) return null;
  return parts.join('/');
}

/**
 * @param {Buffer} buf the whole archive
 * @returns {{ entries: Array<{ name: string, path: string|null, dir: boolean, size: number, modified: Date|null }>, read: (entry) => Buffer }}
 */
export function openZip(buf) {
  const eocd = findEndOfCentralDirectory(buf);
  let count = u16(buf, eocd + 10);
  let cdSize = u32(buf, eocd + 12);
  let cdOffset = u32(buf, eocd + 16);

  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (locator < 0 || u32(buf, locator) !== SIG_EOCD64_LOCATOR) throw new Error('zip64 locator missing');
    const at = u64(buf, locator + 8);
    if (u32(buf, at) !== SIG_EOCD64) throw new Error('zip64 end record missing');
    count = u64(buf, at + 32);
    cdSize = u64(buf, at + 40);
    cdOffset = u64(buf, at + 48);
  }

  const entries = [];
  let at = cdOffset;
  for (let i = 0; i < count; i++) {
    if (u32(buf, at) !== SIG_CENTRAL) throw new Error(`corrupt central directory at entry ${i}`);
    const flags = u16(buf, at + 8);
    const method = u16(buf, at + 10);
    const time = u16(buf, at + 12);
    const date = u16(buf, at + 14);
    const crc = u32(buf, at + 16);
    let compressed = u32(buf, at + 20);
    let size = u32(buf, at + 24);
    const nameLength = u16(buf, at + 28);
    const extraLength = u16(buf, at + 30);
    const commentLength = u16(buf, at + 32);
    let offset = u32(buf, at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLength);

    // Zip64 extra field: only the values whose 32-bit slot is saturated are
    // present, in this fixed order.
    let extra = at + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = u16(buf, extra);
      const length = u16(buf, extra + 2);
      if (id === 0x0001) {
        let p = extra + 4;
        if (size === 0xffffffff) {
          size = u64(buf, p);
          p += 8;
        }
        if (compressed === 0xffffffff) {
          compressed = u64(buf, p);
          p += 8;
        }
        if (offset === 0xffffffff) offset = u64(buf, p);
      }
      extra += 4 + length;
    }

    entries.push({
      name,
      path: safeEntryPath(name),
      dir: name.endsWith('/') || name.endsWith('\\'),
      size,
      modified: dosDate(date, time),
      _: { flags, method, crc, compressed, offset },
    });
    at = extraEnd + commentLength;
  }

  function read(entry) {
    const { flags, method, crc, compressed, offset } = entry._;
    if (flags & 0x1) throw new Error(`${entry.name}: encrypted entries are not supported`);
    if (u32(buf, offset) !== SIG_LOCAL) throw new Error(`${entry.name}: local header missing`);
    const start = offset + 30 + u16(buf, offset + 26) + u16(buf, offset + 28);
    const raw = buf.subarray(start, start + compressed);

    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = inflateRawSync(raw);
    else throw new Error(`${entry.name}: compression method ${method} is not supported`);

    if (data.length !== entry.size) throw new Error(`${entry.name}: size mismatch`);
    if (typeof zlib.crc32 === 'function' && zlib.crc32(data) >>> 0 !== crc) {
      throw new Error(`${entry.name}: checksum mismatch`);
    }
    return data;
  }

  return { entries, read };
}
