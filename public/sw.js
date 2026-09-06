const CACHE_NAME = 'nihongo-explore-isolated-20260906-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .finally(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Keep the independent game shell out of the NHK homepage cache.
    const shellKey = url.pathname === '/explore.html' ? '/explore.html' : '/';
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then(cache => cache.put(shellKey, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => (await caches.match(shellKey)) || new Response(
          'This page is not available offline. Please reconnect. / 暂无此页面的离线副本，请联网后重试。',
          {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}},
        )),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request)),
  );
});
