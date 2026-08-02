// Caches the whole app shell for offline use. Network-first: when you have
// a connection, always fetch the latest version and refresh the cache with
// it — only fall back to the cached copy when there's genuinely no network.
// This means updates show up immediately on next open, no manual cache
// version bump needed each time the app changes.
const CACHE_NAME = "nutrition-tracker-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
