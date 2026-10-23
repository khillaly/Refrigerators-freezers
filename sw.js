// sw.js — CHUB Equipment Fleet PM (merged + fixed)
// v6 — Adds Firebase + Firestore protection and keeps Google Sheets protection.

const CACHE_NAME = 'chub-ref-cache-v7'; // 🔼 bumped to v7 to force update

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './chub-logo.png',
    './icon-192.png',
    './icon-512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/forge/1.3.1/forge.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// 1. Install — cache the app files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Service Worker v6: caching assets');
                return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                    // Some CDN assets might fail (offline first run) — do not block install
                    console.warn('⚠️ Some assets failed to cache:', err);
                });
            })
    );
    self.skipWaiting(); // take over immediately
});

// 2. Activate — delete old caches (this clears v5 and earlier)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Fetch — cache-first for assets, NEVER cache live API calls
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // ⛔ Do NOT cache live Google Sheets calls (old protection — kept)
    if (url.includes('script.google.com')) {
        return;
    }

    // ⛔ Do NOT cache Firebase / Firestore / Auth / Storage calls (NEW — important)
    if (
        url.includes('firebaseio.com') ||
        url.includes('firestore.googleapis.com') ||
        url.includes('firebaseapp.com') ||
        url.includes('identitytoolkit.googleapis.com') ||
        url.includes('securetoken.googleapis.com') ||
        url.includes('gstatic.com/firebasejs') ||
        url.includes('googleapis.com')
    ) {
        return; // Let the network handle it directly
    }

    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // 🌟 FIX: Ignore chrome-extension:// and other weird protocols
    if (!url.startsWith('http')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response; // cache hit

                // Network fallback
                return fetch(event.request).then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }
                    // Dynamically cache new same-origin assets
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                }).catch(() => {
                    // Offline fallback: only for HTML navigation
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
