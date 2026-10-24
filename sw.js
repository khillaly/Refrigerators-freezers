// sw.js — CHUB Equipment Fleet PM (merged + FCM push notifications)
// v8 — Adds Firebase Cloud Messaging for background notifications.

// ─── 1. FIREBASE MESSAGING IMPORTS (Must be at the top) ───
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase inside the Service Worker
const firebaseConfig = {
    apiKey: "AIzaSyAK-hbd1QQbREBdI3sFHexX14TcyFalRyA",
    authDomain: "chub-equipment-maintenance.firebaseapp.com",
    projectId: "chub-equipment-maintenance",
    storageBucket: "chub-equipment-maintenance.firebasestorage.app",
    messagingSenderId: "680949913078",
    appId: "1:680949913078:web:f354a5b8ce2e6db4de23d7"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages (when the app is closed or in another tab)
messaging.onBackgroundMessage(function(payload) {
    console.log('📩 Received background message ', payload);
    
    const notificationTitle = payload.notification?.title || 'CHUB Maintenance';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new update.',
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: { url: payload.data?.click_action || './' },
        actions: [
            { action: 'open', title: 'Open App' },
            { action: 'close', title: 'Dismiss' }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'close') return;

    const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// ─── 2. YOUR EXISTING CACHING LOGIC ───

const CACHE_NAME = 'chub-ref-cache-v8'; // 🔼 bumped to v8

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

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Service Worker v8: caching assets');
                return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                    console.warn('⚠️ Some assets failed to cache:', err);
                });
            })
    );
    self.skipWaiting();
});

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

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // ⛔ Do NOT cache live API calls
    if (
        url.includes('script.google.com') ||
        url.includes('firebaseio.com') ||
        url.includes('firestore.googleapis.com') ||
        url.includes('firebaseapp.com') ||
        url.includes('identitytoolkit.googleapis.com') ||
        url.includes('securetoken.googleapis.com') ||
        url.includes('gstatic.com/firebasejs') ||
        url.includes('googleapis.com') ||
        url.includes('fcm.googleapis.com') // Added FCM
    ) {
        return; 
    }

    if (event.request.method !== 'GET') return;
    if (!url.startsWith('http')) return; 

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response; 

                return fetch(event.request).then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                }).catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
