const CACHE_NAME = 'videolog-v0.6.8';
const VERSION = '0.6.8';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './favicon.svg',
    `./src/js/app.js?v=${VERSION}`,
    `./src/js/storage.js?v=${VERSION}`,
    `./src/js/packs.js?v=${VERSION}`,
    `./src/js/browser.js?v=${VERSION}`,
    `./src/js/cloud.js?v=${VERSION}`,
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
    event.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Append a cache-busting query param to ensure we fetch fresh files from the network during install
            const cacheBustedRequests = ASSETS_TO_CACHE.map(url => {
                return new Request(url, { cache: 'reload' });
            });
            return cache.addAll(cacheBustedRequests);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strict Network-First strategy
    if (event.request.method === 'GET') {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }) // Force network fetch without HTTP cache
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
    }
});
