#!/usr/bin/env node
/**
 * dev.mjs — a dependency-free static server for local iteration.
 *
 * The one thing it adds over any other static server: it re-runs the scan on
 * every request for /data/games.json. Drop a file into games/, hit refresh,
 * and it is on the wall. No restart, no build step, no watcher.
 *
 * Usage:  pnpm dev  [--port 4173] [--open]
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan } from './scan.mjs';
import { staticHandler } from './lib/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at !== -1 && argv[at + 1] ? argv[at + 1] : fallback;
};
const START_PORT = Number(flag('port', process.env.PORT || 4173));
// Bound to loopback by default, and deliberately so: a wildcard bind on
// Windows quietly *succeeds* while another server already holds
// 127.0.0.1:<port>, and every request then goes to that other server instead.
// Binding the specific address makes the clash a real EADDRINUSE we can retry.
const HOST = flag('host', '127.0.0.1');
const OPEN = argv.includes('--open');

// Always-fresh manifest: this is what makes "drop a file in, refresh" work.
const server = createServer(staticHandler(ROOT, { manifest: () => scan({ quiet: true }) }));

function listen(port, attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 12) return listen(port + 1, attempt + 1);
    throw err;
  });
  server.listen(port, HOST, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n  ai-hub dev  ${url}`);
    console.log(`  games/      re-scanned on every refresh\n`);
    if (OPEN) {
      const cmd =
        process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
        : process.platform === 'darwin' ? ['open', [url]]
        : ['xdg-open', [url]];
      spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
    }
  });
}

listen(START_PORT);
