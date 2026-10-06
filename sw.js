const CACHE = 'streaks-v21';
const THREE_CACHE = 'streaks-three-0.170.0';           // pinned version, so cache-first is safe
const THREE_PREFIX = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const MOVES = ['hpush', 'vpush', 'squat', 'hinge', 'row', 'core'];   // moves that have pose files (hamcurl and calf have none yet)
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/data.js', 'js/logic.js', 'js/store.js',
  'js/game/engine.js', 'js/game/sprites.js', 'js/game/scene.js', 'js/game/view.js',
  'js/form/viewer.js', 'js/form/skeleton.js', 'js/form/cues-common.js', 'js/form/pending.js',
  ...MOVES.flatMap((m) => [`js/form/poses/${m}.js`, `js/form/poses/${m}.gen.js`]),   // not-yet-authored moves 404 and are skipped
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(FILES.map((f) => c.add(new Request(f, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== THREE_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.startsWith(THREE_PREFIX)) {
    // three.js from the CDN: cache on first use, then serve from cache (the URL is version-pinned, so it never changes).
    e.respondWith(caches.open(THREE_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (new URL(req.url).origin !== self.location.origin) return;
  // Network first so updates show on the next open; cache keeps it working offline.
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
