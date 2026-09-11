const CACHE_NAME = 'hitokoto-shell-20260911-entry-v1';
const SHELL = ['/', '/?view=nhk', '/companion.html', '/app-entry.js', '/manifest.webmanifest', '/icon.svg'];
function shellKey(url) {
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const shared = ['share_target', 'url', 'text', 'title'].some(key => url.searchParams.has(key));
    return url.searchParams.get('view') === 'nhk' || shared ? '/?view=nhk' : '/';
  }
  if (url.pathname === '/companion.html' || url.pathname === '/explore.html') return url.pathname;
  return null;
}
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key !== CACHE_NAME && (key.startsWith('hitokoto-shell-') || key.startsWith('nihongo-explore-isolated-')))
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    const key = shellKey(url);
    if (!key) return;
    const response = (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const online = await fetch(request, {cache: 'no-store'});
        if (online.ok && online.headers.get('content-type')?.includes('text/html')) await cache.put(key, online.clone()).catch(() => {});
        return online;
      } catch {
        return (await cache.match(key)) || new Response('此页面暂无离线副本，请联网后重试。', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }
    })();
    event.respondWith(response);
    return;
  }
  // Only release-owned static resources. API/audio, cookies, IndexedDB and localStorage are untouched.
  const meta = ['/manifest.webmanifest', '/app-entry.js'].includes(url.pathname);
  const asset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/art/') || url.pathname === '/icon.svg';
  if (!meta && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (asset) {const cached = await cache.match(request);if (cached) return cached;}
    try {
      const online = await fetch(request, meta ? {cache:'no-store'} : undefined);
      if (online.ok && online.type !== 'opaque') await cache.put(request, online.clone()).catch(() => {});
      return online;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
