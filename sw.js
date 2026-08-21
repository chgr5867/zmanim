/**
 * sw.js — Service Worker: שמירת קבצי האפליקציה במטמון לעבודה במצב לא מקוון.
 * החישובים כולם מקומיים, כך שהאפליקציה עובדת מלאה גם ללא אינטרנט.
 */
var CACHE_NAME = 'zmanim-cache-v28';
var ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './css/style.css?v=28',
  './css/dashboard.css?v=28',
  './js/solar.js?v=28',
  './js/engine.js?v=28',
  './js/methods.js?v=28',
  './js/cities.js?v=28',
  './js/hebrew.js?v=28',
  './js/parasha.js?v=28',
  './js/common.js?v=28',
  './js/app.js?v=28',
  './js/dashboard.js?v=28',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './fonts/heebo-hebrew.woff2',
  './fonts/heebo-latin.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var fetched = fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || fetched;
    })
  );
});
