const CACHE = 'family-finance-v15';
const SHELL = [
  '.', 'index.html', 'css/app.css',
  'js/config.js', 'js/utils.js', 'js/auth.js', 'js/api.js',
  'js/store.js', 'js/router.js', 'js/app.js',
  'pages/dashboard.js', 'pages/entry.js', 'pages/ledger.js',
  'pages/projects.js', 'pages/investments.js', 'pages/settings.js',
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
  if (url.includes('googleapis.com') || url.includes('accounts.google.com')) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }))
  );
});
