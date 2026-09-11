from pathlib import Path
import json
ROOT=Path('.')
def replace(name, old, new):
 p=ROOT/name;s=p.read_text();assert s.count(old)==1,(name,old[:70]);p.write_text(s.replace(old,new,1))
def put(name,s):
 p=ROOT/name;assert not p.exists(),name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
if Path('public/app-entry.js').exists():
 raise SystemExit('Entry patch already present; refuse a second application.')
put('public/app-entry.js',r'''/* HITOKOTO entry-20260911: preserve existing installed app identity and shared articles. */
(() => {
  const url = new URL(window.location.href);
  if (!['/', '/index.html'].includes(url.pathname)) return;
  const shared = ['share_target', 'url', 'text', 'title'].some(key => url.searchParams.has(key));
  // Legacy share shortcuts still launch '/'. Keep their payload and make later reloads stay in NHK.
  if (url.searchParams.get('view') === 'nhk' || shared || url.hash) {
    if (url.searchParams.get('view') !== 'nhk') {
      url.searchParams.set('view', 'nhk');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    document.title = 'NHK精读 · HITOKOTO';
    return;
  }
  // A fixed same-origin destination; no return URL, storage deletion or microphone access.
  window.location.replace(`/companion.html${url.search}`);
})();
''')
put('src/appWorker.ts',r'''/** Update the app shell without reloading an active conversation or touching study storage. */
let installed = false;
export function registerAppWorker(): void {
  if (installed || !('serviceWorker' in navigator)) return;
  installed = true;
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'});
      let lastCheck = Date.now();
      void registration.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastCheck > 60000) {
          lastCheck = Date.now();
          void registration.update().catch(() => {});
        }
      });
      // Never reload on controllerchange: the learner may be speaking or editing an article.
    } catch { /* Network or private-browsing restrictions must not prevent opening the app. */ }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => {void register();}, {once: true});
}
''')
replace('src/main.tsx',"import {recoverStudyRestore} from './nhkBackup';","import {registerAppWorker} from './appWorker';\nimport {recoverStudyRestore} from './nhkBackup';")
replace('src/main.tsx',"if ('serviceWorker' in navigator) {\n  window.addEventListener('load', () => {\n    void navigator.serviceWorker.register('/sw.js').catch(() => {});\n  }, {once: true});\n}","registerAppWorker();")
replace('src/companion/main.tsx',"import React from 'react';","import {registerAppWorker} from '../appWorker';\nimport React from 'react';")
replace('src/companion/main.tsx',"createRoot(document.getElementById('companion-root')!)", "registerAppWorker();\ncreateRoot(document.getElementById('companion-root')!)")
replace('index.html','    <title>NHK精读</title>','    <title>HITOKOTO · 日语陪聊与 NHK 学习</title>\n    <script src="/app-entry.js"></script>')
replace('index.html','name="theme-color" content="#f8f9f5"','name="theme-color" content="#060914"')
replace('index.html','name="apple-mobile-web-app-title" content="NHK精读"','name="apple-mobile-web-app-title" content="HITOKOTO"')
replace('companion.html','<title>HITOKOTO · 日语，慢慢聊</title>', '<meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><meta name="apple-mobile-web-app-title" content="HITOKOTO"/><link rel="manifest" href="/manifest.webmanifest"/><link rel="icon" href="/icon.svg" type="image/svg+xml"/><title>HITOKOTO · 日语，慢慢聊</title>')
p=ROOT/'src/companion/CompanionApp.tsx';s=p.read_text();assert s.count('href="/"')==3;s=s.replace('href="/"','href="/?view=nhk"');s=s.replace('data-ui-release="neon-20260911"','data-ui-release="neon-20260911" data-entry-release="entry-20260911"');p.write_text(s)
replace('src/App.tsx','        <NhkMorningPage />','        <nav aria-label="应用入口" style={{padding:"8px 18px",fontSize:13}}><a href="/companion.html" style={{color:"#245342"}}>← HITOKOTO 日语陪聊</a></nav>\n        <NhkMorningPage />')
p=ROOT/'public/manifest.webmanifest';m=json.loads(p.read_text());assert m['id']=='/' and m['start_url']=='/';m.update(name='HITOKOTO · 日语学习',short_name='HITOKOTO',description='轻松聊日语，保留你的 NHK 文章、收藏和练习记录。',background_color='#060914',theme_color='#060914');m['share_target']['action']='/?view=nhk&share_target=1';p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
p=ROOT/'public/sw.js';assert 'nihongo-explore-isolated-20260906-v1' in p.read_text();p.write_text(r'''const CACHE_NAME = 'hitokoto-shell-20260911-entry-v1';
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
        if (online.ok && online.headers.get('content-type')?.includes('text/html')) await cache.put(key, online.clone());
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
      if (online.ok && online.type !== 'opaque') await cache.put(request, online.clone());
      return online;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
''')
p=ROOT/'vercel.json';v=json.loads(p.read_text());assert 'headers' not in v;v['headers']=[{'source':path,'headers':[{'key':'Cache-Control','value':'no-store, max-age=0'}]} for path in ['/','/index.html','/companion.html','/app-entry.js','/sw.js','/manifest.webmanifest']];p.write_text(json.dumps(v,indent=2)+'\n')
for name,old,new in [
 ('scripts/nhk-calm-browser.mjs',"const base = process.env.NHK_TEST_BASE || 'http://127.0.0.1:5173';","const base = (()=>{const u=new URL(process.env.NHK_TEST_BASE || 'http://127.0.0.1:5173');u.searchParams.set('view','nhk');return u.href;})();"),
 ('scripts/nhk-reliability-browser.mjs',"const base=process.env.NHK_BASE_URL || 'http://127.0.0.1:5173';","const base=(()=>{const u=new URL(process.env.NHK_BASE_URL || 'http://127.0.0.1:5173');u.searchParams.set('view','nhk');return u.href;})();")]:replace(name,old,new)
print('ENTRY_REPAIR_APPLIED. Source, preservation, actual app launch and offline shell tests are required.')
