import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {findClients} from '../../../scripts/lib/hub-client.mjs';

test('one-file export boots without external assets and keeps local races and attract mode', () => {
  const dir = mkdtempSync(join(tmpdir(), 'five-finger-export-'));
  try {
    const file = join(dir, 'game.html');
    execFileSync(process.execPath, [new URL('../tools/bundle.mjs', import.meta.url).pathname, file]);
    const html = readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="(?!data:)/i);
    assert.equal(findClients(html).filter(c => c.pristine).length, 1);
    assert.match(html, /MIT License/);
    const context = vm.createContext({console});
    let count = 0;
    for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (match[1].includes('application/json')) { JSON.parse(match[2]); continue; }
      vm.runInContext(match[2], context); count++;
    }
    assert.equal(count, 15);
    const app = context.Drive.app, game = app.game;
    assert.equal(app.hub, null); assert.equal(app.mode, 'title');
    app.localRace(2); app.party.start(); game.advance(1 / 120);
    assert.equal(app.mode, 'play'); assert.equal(app.session.definition.id, 'meter');
    assert.notEqual(app.session.save.store, app.storage);
    app.title(); game.advance(0);
    for (let i = 0; i < 1201; i++) game.advance(1 / 120);
    assert.equal(app.mode, 'demo'); assert.equal(game.errors.length, 0);
    game.dispose();
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
