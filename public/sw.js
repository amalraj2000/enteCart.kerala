/* enteCart.kerala service worker.
 *
 * Deliberately conservative — this is a shop with logins and payments:
 *  • PUBLIC pages (home, product, info pages) are network-first: always fresh when online; the last copy you opened is shown when offline.
 *    Private pages (account, orders, cart, checkout, admin) are NEVER stored; offline they show the friendly /offline page.
 *  • /api/* (login, cart, orders, payments, admin…) is never touched, except product photos (/api/images/…), which are immutable.
 *  • Static, versioned files are cached: /_next/static/*, /icons/*, and product photos.
 *  • Updates: a new version waits until the page asks for it (SKIP_WAITING) so the "Update available" banner can show.
 *  • Push notifications (order / review updates) are shown from the `push` event.
 * Bump VERSION to drop all old caches.
 */
const VERSION = "v3";
const STATIC = `ek-static-${VERSION}`;
const IMAGES = `ek-img-${VERSION}`;
const PAGES = `ek-pages-${VERSION}`;
const OFFLINE = "/offline";
const MAX_IMAGES = 120;
const MAX_PAGES = 40;
const PUBLIC_PAGE = /^\/($|product\/[^/]+$|about$|contact$|faq$|shipping-cancellation$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC)
      .then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"]))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ek-") && k !== STATIC && k !== IMAGES && k !== PAGES).map((k) => caches.delete(k))))
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

async function pageNetworkFirst(req, path) {
  const cacheable = PUBLIC_PAGE.test(path);
  try {
    const res = await fetch(req);
    if (cacheable && res.ok && res.status === 200 && res.type === "basic" && !res.redirected) {
      const cache = await caches.open(PAGES);
      await cache.put(req.url, res.clone());
      const keys = await cache.keys();
      if (keys.length > MAX_PAGES) await Promise.all(keys.slice(0, keys.length - MAX_PAGES).map((k) => cache.delete(k)));
    }
    return res;
  } catch {
    if (cacheable) { const hit = await caches.match(req.url, { cacheName: PAGES }); if (hit) return hit; }
    return (await caches.match(OFFLINE)) || Response.error();
  }
}

self.addEventListener("message", (event) => { if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : "" }; }
  const url = typeof d.url === "string" && d.url.startsWith("/") && !d.url.startsWith("//") ? d.url : "/";
  event.waitUntil(self.registration.showNotification(d.title || "enteCart", {
    body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: d.tag || undefined, data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) { if ("navigate" in c) c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;

  if (req.mode === "navigate") {
    event.respondWith(pageNetworkFirst(req, p));
    return;
  }
  if (p.startsWith("/_next/static/") || p.startsWith("/icons/")) {
    event.respondWith(cacheFirst(STATIC, req));
  } else if (p.startsWith("/api/images/")) {
    event.respondWith(cacheFirst(IMAGES, req, MAX_IMAGES));
  }
  // everything else (all other /api/*, admin, etc.): not handled → goes straight to the network
});
