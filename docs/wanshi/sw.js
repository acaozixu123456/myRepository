// 万世洞天的离线缓存。改动任何文件后把版本号加一，手机上下次打开会换成新版本。
const CACHE = 'wanshi-v5';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'data.js',
  'core.js',
  'war.js',
  'painter.js',
  'audio.js',
  'warui.js',
  'ui.js',
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
      .then(keys => Promise.all(keys.filter(k => k.startsWith('wanshi-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 先上网取最新版本，3 秒没回应或者没网就用缓存，保证地铁里也能打开
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    network.catch(() => {});
    const timeout = new Promise(resolve => setTimeout(resolve, 3000));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch (e) { /* 没网，下面用缓存 */ }
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || network;
  })());
});
