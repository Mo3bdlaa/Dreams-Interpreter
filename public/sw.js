// Minimal service worker: network-first for pages & static assets with an
// offline cache fallback. API/auth/streaming requests are never cached.
const CACHE = "moabbir-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never touch dynamic/auth/streaming endpoints.
  if (url.pathname.startsWith("/api/")) return;

  const cacheable =
    req.mode === "navigate" ||
    ["style", "script", "image", "font"].includes(req.destination);

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && cacheable) cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = await cache.match("/");
          if (shell) return shell;
        }
        throw e;
      }
    })(),
  );
});
