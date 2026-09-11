/* HITOKOTO entry-20260911: preserve existing installed app identity and shared articles. */
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
  document.documentElement.dataset.appEntry = 'companion';
  window.location.replace(`/companion.html${url.search}`);
})();
