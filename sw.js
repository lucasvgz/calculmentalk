/* sw.js — service worker : met tous les fichiers en cache pour le mode hors ligne.
 * ⚠ À CHAQUE MISE À JOUR de l'appli : incrémente CACHE_VERSION, sinon le téléphone garde l'ancienne version. */
var CACHE_VERSION = 'v4';
var CACHE_NAME = 'calcul-mental-' + CACHE_VERSION;

var FICHIERS = ['./', './index.html', './manifest.json', './style.css', './app.js', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(FICHIERS); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Supprime les anciens caches quand CACHE_VERSION change.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.filter(function (n) { return n !== CACHE_NAME; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Cache d'abord, réseau en secours.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (reponse) {
      return reponse || fetch(event.request);
    })
  );
});
