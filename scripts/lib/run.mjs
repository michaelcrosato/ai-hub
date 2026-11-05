/**
 * run.mjs — run a command, collect what it prints, and on a timeout stop it
 * and everything it started.
 *
 * Under `shell: true` the command is a child of /bin/sh, and a model's agent
 * starts processes of its own. Killing the child stops only the shell: the
 * rest runs on, holds the output pipes open, and the caller waits as long as
 * they run. So each command gets a process group of its own (POSIX), and a
 * timeout signals the whole group: SIGTERM, then SIGKILL after a grace period.
 * A group of its own also misses the terminal's Ctrl-C, so a caller that is
 * stopped stops what is still running with stopAll().
 */

import { spawn } from 'node:child_process';

const GROUPS = process.platform !== 'win32';
const running = new Set();

/** Signal every command still running. */
export function stopAll(signal = 'SIGTERM') {
  for (const stop of running) stop(signal);
}

/**
 * @param {string} cmd
 * @param {string[]} [args]
 * @param {{ input?: string, timeoutMs?: number, graceMs?: number, shell?: boolean, cwd?: string }} [options]
 * @returns {Promise<{ code: number|null, out: string, err: string, timedOut: boolean }>}
 */
export function run(cmd, args = [], { input, timeoutMs = 0, graceMs = 10_000, shell = false, cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell, detached: GROUPS, stdio: ['pipe', 'pipe', 'pipe'] });
    const stop = (signal) => {
      try {
        if (GROUPS) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        // gone already
      }
    };
    running.add(stop);
    let out = '';
    let err = '';
    let timedOut = false;
    let finished = false;
    const timers = [];
    const done = (code) => {
      if (finished) return;
      finished = true;
      running.delete(stop);
      for (const timer of timers) clearTimeout(timer);
      resolve({ code, out, err, timedOut });
    };
    if (timeoutMs) {
      timers.push(
        setTimeout(() => {
          timedOut = true;
          stop('SIGTERM');
          timers.push(setTimeout(() => stop('SIGKILL'), graceMs));
          // A process that left the group can still hold the pipes open: stop waiting for it.
          timers.push(
            setTimeout(() => {
              child.stdout.destroy();
              child.stderr.destroy();
              done(null);
            }, graceMs + 2000)
          );
        }, timeoutMs)
      );
    }
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    // A command that exits without reading its input, or never starts, is a failed try, not a crash.
    child.stdin.on('error', () => {});
    child.on('error', (e) => {
      err += e.message;
      done(-1);
    });
    child.on('close', done);
    child.stdin.end(input ?? '');
  });
}
