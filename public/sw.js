/*
 * StockRoute service worker. One installable app for every role.
 *
 * - /sales (salesman app): network first, cached copy when offline → works fully offline
 * - "/" opened offline: the cached sales app (the installed app's start page)
 * - other pages (admin, warehouse, delivery): always live; when offline, a friendly /offline page
 * - /_next/static/*: cache first (content-hashed file names)
 * - icons, manifest: stale-while-revalidate
 * - APIs and everything else: network only, never cached
 *
 * Bump VERSION to drop old caches after a big change.
 */
const VERSION = "v2";
const PAGES = `sr-pages-${VERSION}`;
const ASSETS = `sr-assets-${VERSION}`;
const APP_SHELL = "/sales";
const OFFLINE = "/offline";

async function cachePage(cache, path) {
  try {
    const res = await fetch(path, { credentials: "same-origin", cache: "no-store" });
    if (res.ok && !res.redirected) await cache.put(path, res);
  } catch {
    /* offline during install: cached on a later visit */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      await Promise.all([cachePage(cache, APP_SHELL), cachePage(cache, OFFLINE)]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, ASSETS]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    const isSales = url.pathname === "/sales" || url.pathname === "/";
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await Promise.race([fetch(req), timeout(isSales ? 6000 : 15000)]);
          // Keep the latest real sales app page (not a redirect to login)
          if (res.ok && !res.redirected && new URL(res.url).pathname === APP_SHELL) {
            await cache.put(APP_SHELL, res.clone());
          }
          return res;
        } catch {
          if (isSales) {
            const shell = await cache.match(APP_SHELL);
            if (shell) return shell;
          }
          const offline = await cache.match(OFFLINE);
          return offline || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })(),
    );
    return;
  }

  // Build assets: immutable, cache first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Icons & manifest: serve cached, refresh in background
  if (url.pathname.startsWith("/pwa-icon/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      })(),
    );
  }
});
