/* CADify service worker — offline app shell.
   Bumps: change CACHE to invalidate on deploy. */
const CACHE = 'cadify-v2';
// Cache only files that actually exist in this repository. The self-contained
// index.html carries the embedded calculators; missing standalone paths used
// to make cache.addAll reject the whole install batch.
const SHELL = [
  './',
  './index.html',
  './CADify.html',
  './cadify-bridge.js',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache Firebase / BOM / Stripe calls — always go to network.
  if (/googleapis|firebaseio|firestore|gstatic|stripe|bom\.gov\.au|allorigins|corsproxy/.test(url.host)) return;
  // App shell: cache-first with background refresh.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
