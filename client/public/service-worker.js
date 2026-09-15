const STATIC_CACHE = "rsc-helferplanung-pwa-v2";
const PWA_ASSETS = [
  "/manifest.json",
  "/icons/rsc-helferplanung-192.png",
  "/icons/rsc-helferplanung-512.png",
  "/icons/rsc-helferplanung-maskable-512.png",
  "/icons/shortcut-einsatzplan-192.png",
  "/icons/shortcut-helferkartei-192.png",
  "/icons/shortcut-orga-chat-192.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(PWA_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith("rsc-helferplanung-") && key !== STATIC_CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Es werden ausschließlich Manifest und Icons zwischengespeichert. Planungs-
// und Anmeldedaten bleiben immer netzwerkbasiert und damit aktuell geschützt.
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!PWA_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then(cached => cached ?? fetch(event.request))
  );
});
