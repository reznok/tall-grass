/* TALL GRASS — service worker
 * Network-first with cache fallback: always fresh when online, fully playable offline.
 * Requests revalidate with the server (cache: 'no-cache') so the browser's heuristic HTTP cache
 * can't hand back stale JS. Bump CACHE whenever the CORE list changes; old caches are deleted
 * on activate.
 */
var CACHE = 'tallgrass-v4';
var CORE = [
  './', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './css/style.css',
  './js/numbers.js', './js/sprite.js', './js/audio.js',
  './js/data/sprites_a.js', './js/data/sprites_b.js', './js/data/sprites_c.js',
  './js/data/pokemon.js', './js/data/routes.js', './js/data/producers.js',
  './js/data/upgrades.js', './js/data/gyms.js', './js/data/story.js', './js/data/glitch.js',
  './js/engine.js', './js/systems/glitch.js', './js/systems/sram.js', './js/systems/gags.js',
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
  // navigations go through untouched (re-initialising them would break redirects)
  var net = req.mode === 'navigate' ? fetch(req) : fetch(req, { cache: 'no-cache' });
  e.respondWith(
    net.then(function (res) {
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
