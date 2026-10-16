// Greywater offline cache, version fded80a19c. The page itself is fetched fresh when there is a network (so updates arrive), from the cache when not.
const V = 'greywater-fded80a19c', FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('greywater-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const q = e.request; if (q.method !== 'GET') return;
  if (q.mode === 'navigate') { e.respondWith(fetch(q).then(r => { const c = r.clone(); caches.open(V).then(k => k.put('index.html', c)); return r; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(q, { ignoreSearch: true }).then(r => r || fetch(q)));
});
