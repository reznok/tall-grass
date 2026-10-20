/* TALL GRASS — service worker
 * Network-first with cache fallback: always fresh when online, fully playable offline.
 */
var CACHE = 'tallgrass-v1';
var CORE = [
  './', './index.html', './manifest.json', './icon.svg', './css/style.css',
  './js/numbers.js', './js/sprite.js', './js/audio.js',
  './js/data/sprites_a.js', './js/data/sprites_b.js', './js/data/sprites_c.js',
  './js/data/pokemon.js', './js/data/routes.js', './js/data/producers.js',
  './js/data/upgrades.js', './js/data/gyms.js', './js/data/story.js',
  './js/engine.js', './js/systems/glitch.js', './js/systems/sram.js',
  './js/ui.js', './js/main.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // add individually so one missing optional file (systems/*) doesn't fail the install
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () { return null; }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts etc. go straight to network
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
