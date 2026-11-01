const CACHE_NAME = 'atc-static-v1';
const OFFLINE_URL = '/offline.html';
const STATIC_PREFIX = '/_next/static/';
const STATIC_FILES = new Set(['/manifest.webmanifest', '/icon-192.png', '/icon-512.png']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('atc-static-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/health' || url.pathname.startsWith('/health/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.match(OFFLINE_URL)) ??
        new Response('Offline. Reconnect to load the trading workspace.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );
    return;
  }

  const isStatic = url.pathname.startsWith(STATIC_PREFIX) || STATIC_FILES.has(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }),
  );
});
