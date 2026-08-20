/**
 * sw.js — Service Worker: שמירת קבצי האפליקציה במטמון לעבודה במצב לא מקוון.
 * החישובים כולם מקומיים, כך שהאפליקציה עובדת מלאה גם ללא אינטרנט.
 */
var CACHE_NAME = 'zmanim-cache-v14';
var ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './css/style.css?v=14',
  './css/dashboard.css?v=14',
  './js/solar.js?v=14',
  './js/engine.js?v=14',
  './js/methods.js?v=14',
  './js/cities.js?v=14',
  './js/hebrew.js?v=14',
  './js/parasha.js?v=14',
  './js/app.js?v=14',
  './js/dashboard.js?v=14',
  './manifest.webmanifest',
  './icon.svg'
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
