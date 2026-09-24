import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import * as zlib from 'node:zlib';

import { openZip, safeEntryPath } from './lib/zip.mjs';

/** A minimal zip writer, just for fixtures: stored or deflated entries. */
function makeZip(files, { comment = '' } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data, deflate = true } of files) {
    const raw = Buffer.from(data);
    const body = deflate ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = typeof zlib.crc32 === 'function' ? zlib.crc32(raw) >>> 0 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE((2024 - 1980) << 9 | 5 << 5 | 17, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE((2024 - 1980) << 9 | 5 << 5 | 17, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const commentBuf = Buffer.from(comment);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(commentBuf.length, 20);
  return Buffer.concat([...locals, cd, end, commentBuf]);
}

test('reads stored and deflated entries, names and dates', () => {
  const zip = openZip(
    makeZip(
      [
        { name: 'orbit/index.html', data: '<title>Orbit</title>'.repeat(50) },
        { name: 'orbit/sprites/', data: '', deflate: false },
        { name: 'orbit/game.js', data: 'console.log(1)', deflate: false },
      ],
      { comment: 'made by a test' }
    )
  );
  assert.deepEqual(
    zip.entries.map((e) => [e.path, e.dir]),
    [
      ['orbit/index.html', false],
      ['orbit/sprites', true],
      ['orbit/game.js', false],
    ]
  );
  assert.equal(zip.read(zip.entries[0]).toString(), '<title>Orbit</title>'.repeat(50));
  assert.equal(zip.read(zip.entries[2]).toString(), 'console.log(1)');
  assert.equal(zip.entries[0].modified.getFullYear(), 2024);
});

test('a corrupted entry is refused rather than half-read', () => {
  const buf = makeZip([{ name: 'a.html', data: 'hello world', deflate: false }]);
  buf[30 + 'a.html'.length] ^= 0xff; // flip a byte of the stored body
  const zip = openZip(buf);
  if (typeof zlib.crc32 === 'function') assert.throws(() => zip.read(zip.entries[0]), /checksum/);
});

test('not a zip is a clear error', () => {
  assert.throws(() => openZip(Buffer.from('definitely not a zip file, just some text')), /not a zip/);
});

test('entry paths cannot escape the folder they are unpacked into', () => {
  assert.equal(safeEntryPath('../../etc/passwd'), null);
  assert.equal(safeEntryPath('a/../../b'), null);
  assert.equal(safeEntryPath('C:/Windows/x'), null);
  assert.equal(safeEntryPath('/abs/path.html'), 'abs/path.html');
  assert.equal(safeEntryPath('win\\style\\index.html'), 'win/style/index.html');
  assert.equal(safeEntryPath('./a/./b.html'), 'a/b.html');
});
