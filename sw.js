const CACHE = 'family-finance-v75';
const SHELL = [
  '.', 'index.html', 'css/app.css',
  'js/config.js', 'js/utils.js', 'js/auth.js', 'js/api.js',
  'js/store.js', 'js/router.js', 'js/app.js',
  'pages/dashboard.js', 'pages/entry.js', 'pages/ledger.js',
  'pages/projects.js', 'pages/investments.js', 'pages/settings.js',
  'pages/billing.js',
  'icons/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // 只快取自家的 http(s) GET 請求；外掛(chrome-extension://)、非 GET、外部 API 一律不碰
  if (e.request.method !== 'GET') return;
  if (!url.startsWith('http')) return;
  if (url.includes('googleapis.com') || url.includes('accounts.google.com')) return;
  if (!url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      // 立即 clone：res 會被回傳給頁面消耗，延後到 caches.open resolve 後再 clone 會失敗
      const copy = res.ok ? res.clone() : null;
      if (copy) caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
