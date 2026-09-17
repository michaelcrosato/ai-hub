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
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan } from './scan.mjs';

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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const send = (res, status, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

const server = createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }

  // Always-fresh manifest: this is what makes "drop a file in, refresh" work.
  if (pathname === '/data/games.json') {
    try {
      const manifest = await scan({ quiet: true });
      return send(res, 200, JSON.stringify(manifest), MIME['.json']);
    } catch (err) {
      console.error('scan failed:', err);
      return send(res, 500, JSON.stringify({ error: String(err) }), MIME['.json']);
    }
  }

  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  let info;
  try {
    info = await stat(file);
  } catch {
    // Unknown path with no extension: let the hash router sort it out.
    if (!path.extname(rel)) return streamFile(res, path.join(ROOT, 'index.html'));
    return send(res, 404, `Not found: ${pathname}`);
  }
  if (info.isDirectory()) return streamFile(res, path.join(file, 'index.html'));
  return streamFile(res, file, info);
});

function streamFile(res, file, info) {
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
  if (info) headers['Content-Length'] = info.size;
  res.writeHead(200, headers);
  const stream = createReadStream(file);
  stream.on('error', () => res.end());
  stream.pipe(res);
}

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
