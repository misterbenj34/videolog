const CACHE_NAME = 'videolog-v0.6.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './favicon.svg',
    './src/js/app.js',
    './src/js/storage.js',
    './src/js/packs.js',
    './src/js/browser.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
    event.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
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

    // Network-first strategy for absolute certainty during rapid deployment.
    // It guarantees you always get the latest code if online.
    if (event.request.method === 'GET') {
        event.respondWith(
            fetch(event.request)
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
