// The session client pasted into games: found, recognised as a release, and
// upgraded only when it is exactly one (scripts/lib/hub-client.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { RELEASES, CLIENT_END, compareVersions, describeClient, findClients, upgradeText } from './lib/hub-client.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const page = (client) => `<!doctype html><html><head>\n<script>\n${client}\n</script>\n</head><body></body></html>\n`;

test('the client in lib/hub/session.js is a registered release', async () => {
  const current = describeClient(await read('lib/hub/session.js'));
  assert.equal(RELEASES[current.version], current.hash, `add ${current.version}: '${current.hash}' to RELEASES`);
});

test('the reference games carry the current client, unmodified', async () => {
  const current = describeClient(await read('lib/hub/session.js'));
  for (const path of ['lib/hub/examples/arena.html', 'lib/hub/examples/race.html']) {
    const copies = findClients(await read(path));
    assert.equal(copies.length, 1, path);
    assert.equal(copies[0].version, current.version, path);
    assert.ok(copies[0].pristine, `${path}: paste lib/hub/session.js again`);
  }
});

test('a pasted copy is pristine only when it is exactly its release', async () => {
  const client = (await read('lib/hub/session.js')).trimEnd();
  const [same] = findClients(page(client));
  assert.ok(same.pristine);
  const [crlf] = findClients(page(client).replace(/\n/g, '\r\n'));
  assert.ok(crlf.pristine, 'line endings aside');
  const [edited] = findClients(page(client.replace("'use strict';", "'use strict'; var edited = true;")));
  assert.equal(edited.pristine, false);
  const [cut] = findClients(page(client.replace(CLIENT_END, '')));
  assert.equal(cut.complete, false);
  assert.equal(cut.pristine, false);
});

test('an upgrade replaces only pristine older copies, and keeps the line endings', async () => {
  const source = await read('lib/hub/session.js');
  const real = describeClient(source);
  // Pretend a newer release is out: the real client is then the old one.
  const newer = { version: '9.0.0', text: real.text.replace(/aihub-session \d+\.\d+\.\d+/, 'aihub-session 9.0.0'), hash: 'x' };
  const old = page(real.text);
  const up = upgradeText(old, newer);
  assert.equal(up.changed, true);
  assert.deepEqual(up.copies, [{ version: real.version, action: 'upgraded' }]);
  assert.ok(up.text.includes('aihub-session 9.0.0'));
  assert.ok(up.text.startsWith('<!doctype html><html><head>\n<script>\n'), 'nothing around the client moves');
  assert.ok(up.text.endsWith('\n</script>\n</head><body></body></html>\n'));

  const crlf = upgradeText(old.replace(/\n/g, '\r\n'), newer);
  assert.equal(crlf.changed, true);
  assert.ok(!/[^\r]\n/.test(crlf.text), 'a CRLF file stays CRLF');

  const edited = upgradeText(page(real.text.replace("'use strict';", "'use strict'; var mine = 1;")), newer);
  assert.equal(edited.changed, false);
  assert.deepEqual(edited.copies, [{ version: real.version, action: 'edited' }]);

  const same = upgradeText(old, real);
  assert.equal(same.changed, false);
  assert.deepEqual(same.copies, [{ version: real.version, action: 'kept' }]);
});

test('versions compare by number, not as text', () => {
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
  assert.ok(compareVersions('1.2.0', '1.3.0') < 0);
  assert.equal(compareVersions('1.2.0', '1.2.0'), 0);
});
