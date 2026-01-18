const CACHE_NAME = 'dmk-pwa-v1';
const MEDIA_ASSETS = [
  '/media/splash.gif',
  '/media/homehero.jpg',
  '/media/categorieshero.jpg',
  '/media/icon.png'
];

const STATIC_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('DMK: Pre-caching critical assets');
      return cache.addAll([...STATIC_URLS, ...MEDIA_ASSETS]);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Cache First for assets, Network First for others
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip Supabase and internal API calls
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
    return;
  }

  // Handle Media Assets - Cache First
  if (url.pathname.startsWith('/media/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Trigger a background update for heros
          if (url.pathname.includes('hero.jpg')) {
            updateAsset(event.request);
          }
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          return putInCache(event.request, response);
        });
      })
    );
    return;
  }

  // Handle GitHub Assets - Stale While Revalidate
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            putInCache(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Standard static assets - Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          putInCache(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Helper to put item in cache
async function putInCache(request, response) {
  if (response.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

// Background update logic for assets
async function updateAsset(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
  } catch (error) {
    console.log('Silent update failed:', error);
  }
}
