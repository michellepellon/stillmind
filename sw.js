const CACHE_NAME = 'stillmind-v1';
const OFFLINE_PAGE = '/offline.html';
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/router.js',
    '/manifest.json',
    '/shared/styles/base.css',
    '/shared/styles/theme.css',
    '/shared/styles/utils.css',
    '/shared/styles/splash.css',
    '/features/today/today.js',
    '/features/today/today.css',
    '/features/write/write.js',
    '/features/write/write.css',
    '/features/history/history.js',
    '/features/history/history.css',
    '/features/entry/entry.js',
    '/features/entry/entry.css',
    '/features/settings/settings.js',
    '/features/settings/settings.css',
    '/core/db.js',
    '/shared/utils/entry.js',
    '/core/offline.js',
    '/shared/styles/offline.css',
    '/shared/utils/performance.js',
    '/shared/utils/interactions.js',
    '/shared/styles/interactions.css',
    '/shared/styles/typography.css',
    '/shared/styles/touch.css',
    '/shared/styles/critical.css'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[Service Worker] Skip waiting');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Claiming all clients');
                return self.clients.claim();
            })
    );
});

// Handle message events from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Skip waiting on message');
        self.skipWaiting();
    }
});

// Fetch event - cache-first strategy for static assets, network-first for API
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle start_url for offline
    if (url.pathname === '/' && url.search.includes('utm_source=pwa')) {
        event.respondWith(
            caches.match('/')
                .then((response) => response || fetch(request))
        );
        return;
    }
    
    // API calls - network first
    if (url.pathname.startsWith('/api/')) {
        console.log('[Service Worker] Network first for:', request.url);
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone the response before caching
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    return response;
                })
                .catch(() => {
                    // Fall back to cache if network fails
                    return caches.match(request);
                })
        );
        return;
    }
    
    // Static assets - cache first
    console.log('[Service Worker] Cache first for:', request.url);
    event.respondWith(
        caches.match(request)
            .then((response) => {
                if (response) {
                    console.log('[Service Worker] Found in cache:', request.url);
                    return response;
                }
                
                console.log('[Service Worker] Not in cache, fetching:', request.url);
                return fetch(request)
                    .then((response) => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response before caching
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        
                        return response;
                    });
            })
            .catch(() => {
                // Offline fallback
                console.log('[Service Worker] Offline, no cache available for:', request.url);
                
                // For navigation requests, return the app shell
                if (request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                
                // For other requests, return appropriate offline response
                return new Response('Offline - Resource not available', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/plain'
                    })
                });
            })
    );
});

// Background sync for offline requests
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Sync event:', event.tag);
    
    if (event.tag === 'sync-entries') {
        event.waitUntil(syncEntries());
    }
});

// Sync entries when back online
async function syncEntries() {
    console.log('[Service Worker] Syncing entries...');
    
    try {
        // Get all clients
        const clients = await self.clients.matchAll();
        
        // Notify clients to sync
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_ENTRIES',
                timestamp: Date.now()
            });
        });
        
        return true;
    } catch (error) {
        console.error('[Service Worker] Sync failed:', error);
        throw error;
    }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-entries-periodic') {
        console.log('[Service Worker] Periodic sync triggered');
        event.waitUntil(syncEntries());
    }
});