/**
 * worker.js — Cloudflare serves every published file at its exact path
 * without running this. It runs only for a path with no file behind it:
 *
 * - a folder (/, /session, /catalogue/): its index.html, at that address,
 *   the way the dev server answers it;
 * - a file over Cloudflare's 25 MiB limit, published as numbered parts
 *   (game.html.part0, game.html.part1, …; see scripts/release.mjs): the parts
 *   streamed back as the one file the path names.
 */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};
const CACHE = 'public, max-age=600, stale-while-revalidate=604800';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);

    const ext = /\.[^/]*$/.exec(url.pathname)?.[0].toLowerCase();
    if (!ext) {
      const index = await env.ASSETS.fetch(new Request(new URL(url.pathname.replace(/\/?$/, '/index.html'), url), request));
      return index.status === 404 ? env.ASSETS.fetch(request) : index;
    }

    const part = (i) => env.ASSETS.fetch(new URL(`${url.pathname}.part${i}`, url));
    const first = await part(0);
    if (!first.ok) return env.ASSETS.fetch(request);
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': CACHE };
    if (request.method === 'HEAD') return new Response(null, { headers });

    const { readable, writable } = new TransformStream();
    ctx.waitUntil(
      (async () => {
        let res = first;
        for (let i = 1; res.ok; i++) {
          await res.body.pipeTo(writable, { preventClose: true });
          res = await part(i);
        }
        await writable.close();
      })().catch((err) => writable.abort(err)),
    );
    return new Response(readable, { headers });
  },
};
