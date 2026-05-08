const CACHE_NAME = 'cloudsea-v1.2.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/bundle.js',
  '/js/storage.js',
  '/js/services-core.js',
  '/js/favorites-core.js',
  '/js/search-history-core.js',
  '/js/feedback-core.js',
  '/js/adapters/web-http.js',
  '/js/adapters/web-storage.js',
  '/js/adapters/web-ui.js',
  '/js/services.js',
  '/js/fusion.js',
  '/js/feedback.js',
  '/js/search-history.js',
  '/js/favorites.js',
  '/js/app.js',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // API requests: network first, cache fallback
  if (url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  // Static assets: cache first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
