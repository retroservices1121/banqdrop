// banqdrop service worker. App-shell caching for installability + offline launch.
// Network-first for navigations (so the app stays fresh), cache-first for static
// assets. API requests are never cached (money data must be live).
const CACHE = "banqdrop-v1";
const SHELL = ["/", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache money data

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // static assets: cache-first
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
  }
});

// Show pushes (deposit landed, etc.) once a push service is wired server-side.
self.addEventListener("push", (e) => {
  const data = (() => {
    try {
      return e.data ? e.data.json() : {};
    } catch {
      return { body: e.data ? e.data.text() : "" };
    }
  })();
  e.waitUntil(
    self.registration.showNotification(data.title || "banqdrop", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    })
  );
});
