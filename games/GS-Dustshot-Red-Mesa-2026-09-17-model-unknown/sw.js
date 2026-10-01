// The first version of Dustshot registered a cache-first service worker here, which could keep
// returning players on an old build forever. This replacement clears that cache, unregisters
// itself and reloads open tabs onto the network copy. The game no longer registers a worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('dustshot-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: 'window' });
    for (const tab of tabs) tab.navigate(tab.url).catch(() => {});
  })());
});
