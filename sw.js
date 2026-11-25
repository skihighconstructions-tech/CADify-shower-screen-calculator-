/* CADify offline support.
   Online pages are network-first so installed iPhone apps do not show stale headers. */
const CACHE = 'cadify-v11-startup-animation';
const SHELL = [
  './',
  './index.html',
  './CADify.html',
  './cadify-bridge.js',
  './manifest.webmanifest',
  './cadify-logo-v2-180.png',
  './cadify-logo-v2-192.png',
  './cadify-logo-v2-512.png',
  './calculators/aluminium-screen.html',
  './calculators/aluminium-balustrade.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(SHELL.map(path => cache.add(path).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith('cadify-') && key !== CACHE)
        .map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isDocument = req.mode === 'navigate' || req.destination === 'document' || /\.html$/i.test(url.pathname);
  if (isDocument) {
    // Always try the published HTML first, including calculator iframes.
    // Use the last cached copy only when offline.
    event.respondWith(
      fetch(req).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)));
        }
        return response;
      }).catch(() =>
        caches.match(req, {ignoreSearch:true}).then(hit =>
          hit || (url.pathname.endsWith('/') ? caches.match('./index.html') : null)
          || Response.error()
        )
      )
    );
    return;
  }

  // The existing image/JS assets can work offline; refresh them in the background.
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)));
        }
        return response;
      });
      if (hit) {
        event.waitUntil(network.catch(() => null));
        return hit;
      }
      return network.catch(() => Response.error());
    })
  );
});
