// ====================================================================
//  Service Worker – PWA layer  (Phase 7)
//  File name: sw.js   ← register from main.js
//  Strategy
//  • precache immutable assets (HTML shell, CSS, JS, logos)
//  • cache‑first for GET /assets/*  (static)
//  • network‑first for navigation + API POST fallback
//  • push handler stub (for future status updates)
//  • versioned cache to enable atomic rollouts
// ====================================================================

const VERSION = '2025‑07‑07‑v1';
const STATIC_CACHE = `static‑${VERSION}`;
const RUNTIME_CACHE = `runtime‑${VERSION}`;

// ⬇ Add files you want available offline (built via your CI)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/form-secure.js',
  '/assets/hero.webp',
  '/assets/mobile.webp',
  '/favicon.ico',
];

/* ------------------------ Install ----------------------------------- */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

/* ------------------------ Activate ---------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== STATIC_CACHE && key !== RUNTIME_CACHE) ? caches.delete(key) : null))
    )
  );
  self.clients.claim();
});

/* ------------------------ Fetch handler ----------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Precaution: skip non‑GET requests (except navigation fallback)
  if (request.method !== 'GET') return;

  // 1 ▸ cache‑first for immutable assets (starts with /assets or in PRECACHE)
  if (url.origin === location.origin && (url.pathname.startsWith('/assets') || PRECACHE_URLS.includes(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 2 ▸ navigation (HTML) – network‑first then offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 3 ▸ all other GET requests – stale‑while‑revalidate
  event.respondWith(staleWhileRevalidate(request));
});

/* ------------------------ Strategies -------------------------------- */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  return cached || fetch(request);
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    return cache.match(request) || caches.match('/offline.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    })
    .catch(() => {});
  return cached || fetchPromise;
}

/* ------------------------ Push notifications ------------------------ */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Gabriel Remote Assistants';
  const options = {
    body: data.body || 'New update available.',
    icon: '/assets/icon-192.png',
    badge: '/assets/badge.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data);
    })
  );
});
