/* Adventure Quest service worker
 * - precaches the app shell + offline fallback
 * - cache-first for static assets and fonts
 * - stale-while-revalidate for photos
 * - network-first (offline fallback) for navigations
 * API mutations are NOT handled here: the app queues them in IndexedDB
 * (see lib/offline/sync.ts), which works on every platform including iOS
 * where the Background Sync API is unavailable.
 */
const VERSION = "aq-v1";
const SHELL = ["/", "/offline", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // navigations: network first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("/offline"))
        )
    );
    return;
  }

  // static assets & fonts: cache first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // photos from Supabase storage: stale-while-revalidate
  if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/")) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const refresh = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
  }
});
