const CACHE_NAME = 'soundwave-v1';

// Add the static assets you want to load instantly (even offline)
const STATIC_ASSETS = [
  '/',
  'index.html',
  'manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Bebas+Neue&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
];

// 1. Install Event: Cache static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. Activate Event: Clean up old caches if the version changes
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Serve from cache, fall back to network
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // By-pass caching for Supabase API calls and audio blobs/files
  if (
    url.hostname.includes('supabase.co') || 
    url.protocol === 'blob:' ||
    event.request.headers.get('range') // Skip caching for audio streaming chunks
  ) {
    return;
  }

  // Stale-While-Revalidate strategy for UI assets
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Only cache valid responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.log('Network failure, serving cached content if available.', err);
      });

      return cachedResponse || fetchPromise;
    })
  );
});