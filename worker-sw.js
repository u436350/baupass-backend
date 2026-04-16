const CACHE_NAME = "baupass-worker-v7";
const STATIC_FILES = [
  "/worker.html",
  "/worker.css",
  "/worker-app.js",
  "/worker-manifest.json",
  "/worker-icon-192.png",
  "/worker-icon-512.png",
  "/worker-icon-192.svg",
  "/worker-icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET") {
    return;
  }
  // API-Requests: Network first, fallback zu Cache (optional)
  if (requestUrl.pathname.startsWith("/api/worker-app/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Optional: Response cachen
          return response;
        })
        .catch(() => new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "Content-Type": "application/json" } }))
    );
    return;
  }
  // Statische Kern-Dateien: Network first fuer schnelle Updates.
  if (STATIC_FILES.includes(requestUrl.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Sonstige statische Dateien: Cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request);
    })
  );
});
