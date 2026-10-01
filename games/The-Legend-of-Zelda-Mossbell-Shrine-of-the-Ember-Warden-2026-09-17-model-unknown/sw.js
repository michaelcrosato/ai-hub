// Earlier builds of Mossbell cached themselves with a cache-first service worker,
// which kept returning players on old files. The game no longer registers one.
// This replacement only cleans up for browsers that still have the old worker:
// it deletes the old caches, unregisters itself and reloads open pages once.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('mossbell-shell')).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const pages = await self.clients.matchAll({ type: 'window' });
      for (const page of pages) page.navigate(page.url).catch(() => {});
    })()
  );
});
