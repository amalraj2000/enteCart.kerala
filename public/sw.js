/* enteCart.kerala service worker.
 *
 * Deliberately conservative — this is a shop with logins and payments:
 *  • HTML pages are NEVER stored: always fetched fresh (so nobody sees a stale price/stock or another person's page);
 *    if the network is down, a friendly /offline page is shown instead.
 *  • /api/* (login, cart, orders, payments, admin…) is never touched, except product photos (/api/images/…), which are immutable.
 *  • Only static, versioned files are cached: /_next/static/*, /icons/*, and product photos.
 * Bump VERSION to drop all old caches.
 */
const VERSION = "v1";
const STATIC = `ek-static-${VERSION}`;
const IMAGES = `ek-img-${VERSION}`;
const OFFLINE = "/offline";
const MAX_IMAGES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC)
      .then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ek-") && k !== STATIC && k !== IMAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(cacheName, req, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200 && res.type === "basic") {
    cache.put(req, res.clone());
    if (max) { // keep the photo cache from growing forever: drop the oldest
      const keys = await cache.keys();
      if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
    }
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE).then((r) => r || Response.error())));
    return;
  }
  if (p.startsWith("/_next/static/") || p.startsWith("/icons/")) {
    event.respondWith(cacheFirst(STATIC, req));
  } else if (p.startsWith("/api/images/")) {
    event.respondWith(cacheFirst(IMAGES, req, MAX_IMAGES));
  }
  // everything else (all other /api/*, admin, etc.): not handled → goes straight to the network
});
