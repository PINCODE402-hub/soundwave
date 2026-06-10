const CACHE_NAME = 'soundwave-v2';

const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './favicon.ico',
  './apple-touch-icon.png',
  './web-app-manifest-192x192.png',
  './web-app-manifest-512x512.png'
];

// INSTALL - Use a resilient loop
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Opened cache, starting asset installation...');
      
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          // This prevents one missing file from breaking the whole install
          console.warn(`Failed to cache: ${url} - This file is missing or blocked.`);
        }
      }
    })
  );
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', event => {

  // Handle page navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put('./index.html', copy));

          return response;
        })
        .catch(() => caches.match('./index.html'))
    );

    return;
  }

  const url = new URL(event.request.url);

  // Skip Supabase and streamed audio requests
  if (
    url.hostname.includes('supabase.co') ||
    url.protocol === 'blob:' ||
    event.request.headers.get('range')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {

      const fetchPromise = fetch(event.request)
        .then(networkResponse => {

          if (
            networkResponse &&
            networkResponse.status === 200
          ) {
            const responseToCache =
              networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache =>
                cache.put(
                  event.request,
                  responseToCache
                )
              );
          }

          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
