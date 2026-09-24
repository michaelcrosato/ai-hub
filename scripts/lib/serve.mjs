/**
 * serve.mjs — the static file handler behind `pnpm dev` and `pnpm shots`.
 *
 * Multi-file projects load more than HTML and images: WebAssembly (which the
 * browser refuses to stream-compile without the right type), audio, models
 * and fonts. Everything here is served no-store, since it is only ever local.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

const send = (res, status, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

function streamFile(res, file, info) {
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
  if (info) headers['Content-Length'] = info.size;
  res.writeHead(200, headers);
  const stream = createReadStream(file);
  stream.on('error', () => res.end());
  stream.pipe(res);
}

/**
 * @param {string} root  directory to serve
 * @param {{ manifest?: () => Promise<object> }} [opts]
 *   manifest — answers /data/games.json freshly on every request
 */
export function staticHandler(root, { manifest } = {}) {
  return async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, 'Bad request');
    }

    if (manifest && pathname === '/data/games.json') {
      try {
        return send(res, 200, JSON.stringify(await manifest()), MIME['.json']);
      } catch (err) {
        console.error('scan failed:', err);
        return send(res, 500, JSON.stringify({ error: String(err) }), MIME['.json']);
      }
    }

    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) return send(res, 403, 'Forbidden');

    let info;
    try {
      info = await stat(file);
    } catch {
      // Unknown path with no extension: let the hash router sort it out.
      if (!path.extname(rel)) return streamFile(res, path.join(root, 'index.html'));
      return send(res, 404, `Not found: ${pathname}`);
    }
    if (info.isDirectory()) {
      const index = path.join(file, 'index.html');
      const indexInfo = await stat(index).catch(() => null);
      return indexInfo ? streamFile(res, index, indexInfo) : send(res, 404, `Not found: ${pathname}`);
    }
    return streamFile(res, file, info);
  };
}
