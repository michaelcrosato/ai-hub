import { test } from 'node:test';
import assert from 'node:assert/strict';

import { run, stopAll } from './lib/run.mjs';

const posix = { skip: process.platform === 'win32' && 'needs /bin/sh' };
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test('collects what a command prints, its exit code, and feeds it its input', async () => {
  const r = await run(process.execPath, ['-e', 'process.stdin.pipe(process.stdout); console.error("note"); process.on("exit", () => (process.exitCode = 3))'], { input: 'hello' });
  assert.equal(r.out, 'hello');
  assert.match(r.err, /note/);
  assert.equal(r.code, 3);
  assert.equal(r.timedOut, false);
});

test('a command that cannot start is a failed run, not a crash', async () => {
  const r = await run('/no/such/command-anywhere');
  assert.equal(r.code, -1);
  assert.match(r.err, /ENOENT/);
});

test('a timeout stops the shell and what it started, at once', posix, async () => {
  const started = Date.now();
  const r = await run('sleep 30 & echo $!; wait', [], { shell: true, timeoutMs: 200 });
  assert.ok(Date.now() - started < 5000, 'returned well before the command would have ended');
  assert.equal(r.timedOut, true);
  const pid = Number(r.out.trim());
  assert.ok(pid > 0, 'the shell printed the pid of what it started');
  assert.equal(alive(pid), false, 'what the shell started was stopped too');
});

test('a command that ignores SIGTERM is killed after the grace period', posix, async () => {
  const started = Date.now();
  const r = await run('trap "" TERM; sleep 30 & echo $!; wait', [], { shell: true, timeoutMs: 200, graceMs: 300 });
  assert.ok(Date.now() - started < 5000);
  assert.equal(r.timedOut, true);
  assert.equal(alive(Number(r.out.trim())), false);
});

test('stopAll stops what is still running', posix, async () => {
  const pending = run('sleep 30 & echo $!; wait', [], { shell: true });
  await new Promise((resolve) => setTimeout(resolve, 200));
  stopAll('SIGTERM');
  const r = await pending;
  assert.equal(r.timedOut, false);
  assert.equal(alive(Number(r.out.trim())), false);
});
