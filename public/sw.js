// ── Firebase Cloud Messaging — Background messages ────────────────────────────
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: 'AIzaSyC-Cnw4wf15uKVQ6Vt8diX-WNrYeX7b_LQ',
    authDomain: 'gen-lang-client-0739219145.firebaseapp.com',
    projectId: 'gen-lang-client-0739219145',
    storageBucket: 'gen-lang-client-0739219145.firebasestorage.app',
    messagingSenderId: '47402822818',
    appId: '1:47402822818:web:de31d0864916143d0a3bfb',
  });
  const fcmMessaging = firebase.messaging();
  fcmMessaging.onBackgroundMessage(function (payload) {
    const title = (payload.notification && payload.notification.title) || 'Rena';
    const body  = (payload.notification && payload.notification.body)  || '';
    const data  = payload.data || {};
    return self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag || 'rena-fcm',
      data,
      vibrate: [200, 100, 200],
    });
  });
} catch (_fcmErr) {
  // FCM unavailable (offline / CSP) — web-push still works
}

// ── Cache names (bump version to force refresh) ───────────────────────────────
const SHELL_CACHE   = 'rena-shell-v4';      // App shell: JS, CSS, fonts
const IMAGE_CACHE   = 'rena-images-v4';     // Local + Firebase Storage images
const OFFLINE_URL   = '/';

// Assets pre-cached at install time
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const CURRENT_CACHES = [SHELL_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => !CURRENT_CACHES.includes(n))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|otf)(\?.*)?$/.test(url.pathname);
}

function isImageAsset(url) {
  // Local images or Firebase Storage images
  return (
    /\.(png|svg|ico|webp|jpg|jpeg|gif|avif)(\?.*)?$/.test(url.pathname) ||
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('storage.googleapis.com')
  );
}

// ── Fetch: route requests to the right strategy ───────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept API calls or HMR websockets
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/@')) return;
  if (event.request.headers.get('accept')?.includes('text/event-stream')) return;

  // ── 1. App shell (JS/CSS/fonts): Cache-first, fallback to network ──────────
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => Response.error());
      })
    );
    return;
  }

  // ── 2. Images: Stale-while-revalidate ─────────────────────────────────────
  //    Serve cached copy instantly, update cache in the background
  if (isImageAsset(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached || Response.error());

          // Return cached immediately if available; otherwise wait for network
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // ── 3. Navigation (HTML): Network-first, fallback to cached shell ─────────
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then((r) => r || Response.error())
        )
    );
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Rena', body: 'Nouvelle notification', icon: '/icon.svg', badge: '/icon.svg', tag: 'rena-notif' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon.svg',
      badge: data.badge || '/icon.svg',
      tag: data.tag || 'rena-notif',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
