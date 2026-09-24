import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  try {
    const raw = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = raw === '/' ? '/index.html' : raw;
    const file = normalize(join(root, rel));
    if (!file.startsWith(root)) throw new Error('bad path');
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not file');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Runeclash running at http://127.0.0.1:${port}`);
});
