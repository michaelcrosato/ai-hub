// The part of a side-by-side retrofit that needs no model (scripts/lib/retrofit.mjs):
// the client and the metas go in first, and nothing else in the page moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { prepareSideBySide, checkRetrofit } from './lib/retrofit.mjs';
import { findClients } from './lib/hub-client.mjs';

const client = await readFile(new URL('../lib/hub/session.js', import.meta.url), 'utf8');

const PAGE = `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Snake — Eat the dots</title>
<script type="importmap">{"imports":{}}</script>
<script>let score = 0;</script>
</head><body><canvas></canvas><script type="module">start();</script></body></html>
`;

test('the client and the metas go in right after <meta charset>, before every script, and nothing else moves', () => {
  const { text, at } = prepareSideBySide(PAGE, { client });
  assert.equal(text.slice(0, at), PAGE.slice(0, at));
  assert.ok(text.endsWith(PAGE.slice(at)), 'everything after the insertion point is untouched');
  assert.ok(PAGE.slice(0, at).endsWith('<meta charset="utf-8">'));
  const [copy] = findClients(text);
  assert.ok(copy.pristine);
  assert.ok(copy.start < text.indexOf('<script type="importmap">'));
  assert.match(text, /<meta name="hub:session-mode" content="parallel">/);
  assert.match(text, /<meta name="hub:session-minutes" content="4">/);
});

test('with a script before the charset, or no charset, the block goes before the first script; with no head, after <html>', () => {
  const early = '<html><head><script>var a = Math.random();</script><meta charset="utf-8"></head></html>';
  const { text } = prepareSideBySide(early, { client });
  assert.ok(findClients(text)[0].start < text.indexOf('var a'));
  const bare = '<!doctype html><html><body><p>hi</p></body></html>';
  const out = prepareSideBySide(bare, { client });
  assert.ok(out.text.startsWith('<!doctype html><html>\n<meta name="hub:session"'));
});

test('a CRLF page stays CRLF', () => {
  const { text } = prepareSideBySide(PAGE.replace(/\n/g, '\r\n'), { client });
  assert.ok(!/[^\r]\n/.test(text));
  assert.ok(findClients(text)[0].pristine);
});

test('a page that already declares a session, or carries a client, is left alone', () => {
  assert.match(prepareSideBySide('<head><meta name="hub:session" content="1"></head>', { client }).skipped, /already declares/);
  assert.match(prepareSideBySide(`<head><script>${client}</script></head>`, { client }).skipped, /already carries/);
});

test('the static check names what the model still has to do, and nothing once it is done', () => {
  const { text } = prepareSideBySide(PAGE, { client });
  assert.deepEqual(checkRetrofit(text), [
    'hub:session-goal is empty',
    'hub:session-howto is empty',
    'no call to AIHub.connect',
    'no call to AIHub.ready',
    'no call to AIHub.result',
  ]);
  const done = text
    .replace('name="hub:session-goal" content=""', 'name="hub:session-goal" content="Eat the most dots in four minutes"')
    .replace('name="hub:session-howto" content=""', 'name="hub:session-howto" content="Turn with the arrow keys"')
    .replace('let score = 0;', 'let score = 0; AIHub.connect({ mode: "parallel" }).then(() => AIHub.ready()); onOver(() => AIHub.result({ score }));');
  assert.deepEqual(checkRetrofit(done), []);
  const edited = done.replace("'use strict';", "'use strict'; var hacked = 1;");
  assert.ok(checkRetrofit(edited).includes('the session client was edited'));
  const late = done.replace('<script type="importmap">', '<script>var first = 1;</script><script type="importmap">').replace(/<meta charset="utf-8">\n/, '<script>var x;</script><meta charset="utf-8">\n');
  assert.ok(checkRetrofit(late).includes('a script runs before the session client'));
});
