const CACHE = 'dustshot-red-mesa-v1';
const LOCAL = [
  './', './index.html', './src/style.css', './src/main.js', './src/sim.js', './src/render.js', './src/input.js', './src/audio.js', './src/fallback2d.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(LOCAL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
    return response;
  }).catch(err => event.request.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(err))));
});
