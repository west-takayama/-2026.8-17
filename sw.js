/* ===========================================================================
   sw.js — 圏外でも開けるようにするだけのもの
   ---------------------------------------------------------------------------
   方針は「まずネットワーク、だめならキャッシュ」。
   こうしておくと、更新が自動で反映されつつ、電波がなくても起動する。
   記録そのものは localStorage にあるので、ここが消えてもデータは失われない。
   =========================================================================== */
var CACHE = 'tsukuyomi-shell-v4';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/style.css',
  './assets/icon.svg',
  './src/moon.js',
  './src/store.js',
  './src/ui.js',
  './src/coach.js',
  './src/seeds.js',
  './src/resonance.js',
  './src/analysis.js',
  './src/echo-view.js',
  './src/views/sync.js',
  './src/views/today.js',
  './src/views/wishes.js',
  './src/views/wish-detail.js',
  './src/views/questions.js',
  './src/views/notices.js',
  './src/views/moon-view.js',
  './src/views/ritual.js',
  './src/views/insight.js',
  './src/views/settings.js',
  './src/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                             .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;

  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
