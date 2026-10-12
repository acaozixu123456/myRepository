// 改动任何文件后把版本号加一，手机上下次打开会自动更新缓存
const CACHE = 'meditation-v1';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 先用缓存，保证没网也能秒开；同时在后台取最新版本更新缓存
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const network = fetch(event.request)
        .then(res => {
          if (res.ok && new URL(event.request.url).origin === location.origin) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
