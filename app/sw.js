// Both copies of this app are served from the same origin, and Cache Storage
// is shared across an origin: caches.keys() lists the OTHER copy's caches too.
// Everything here is therefore scoped by this prefix, or each copy's worker
// would delete the other's cache on activation and break its offline use.
const CACHE_PREFIX = "dilmurod-finance-";
const CACHE_NAME = CACHE_PREFIX + "v25";
const ASSETS = [
  "./",
  "./index.html",
  "./personal.html",
  "./manifest.json",
  "./personal.webmanifest",
  "./css/style.css",
  "./css/personal.css",
  "./js/app.js",
  "./js/personal.js",
  "./js/db.js",
  "./js/seed.js",
  "./js/utils.js",
  "./js/i18n.js",
  "./js/locales/en.js",
  "./js/locales/ru.js",
  "./js/locales/uz.js",
  "./js/ui.js",
  "./js/ai.js",
  "./js/insights.js",
  "./js/planner.js",
  "./js/fx.js",
  "./js/pages/fx.js",
  "./js/pages/planner.js",
  "./js/pages/insights.js",
  "./js/pages/assistant.js",
  "./js/pages/search.js",
  "./js/pages/dashboard.js",
  "./js/pages/cashPosition.js",
  "./js/pages/cashFlow.js",
  "./js/pages/accCashFlow.js",
  "./js/pages/pnl.js",
  "./js/pages/balanceSheet.js",
  "./js/pages/goals.js",
  "./js/pages/targets.js",
  "./js/pages/specifications.js",
  "./js/pages/creditRating.js",
  "./js/pages/settings.js",
  "./js/pages/help.js",
  "./js/pages/transactionForm.js",
  "./icons/icon-192.png",
  "./icons/personal-192.png",
  "./icons/personal-512.png",
  "./icons/personal-maskable-512.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // "reload" makes each of these go to the server rather than the
      // browser's own HTTP cache, so a new version is never seeded with the
      // previous version's files.
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const stale = keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME);
    await Promise.all(stale.map((k) => caches.delete(k)));
    await self.clients.claim();

    // Any page open at this moment was built from the previous version's
    // files, so it is still showing the old app even though the new one is
    // now installed. Reload those pages from here.
    //
    // This has to be driven by the worker rather than by the page, because
    // the page running right now IS the old version -- whatever update
    // handling the new release adds is not in it yet. Without this, a new
    // version only became visible on the SECOND reopen, which is
    // indistinguishable from the update never having arrived.
    //
    // Only when something was actually replaced: on a first install there is
    // nothing stale on screen, and reloading would be pointless. Activation
    // happens once per version, so this cannot loop.
    if (!stale.length) return;
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      // Never touch a page belonging to the other copy of the app.
      if (!client.url.startsWith(self.registration.scope)) continue;
      if ("navigate" in client) {
        try { await client.navigate(client.url); } catch (e) { /* page went away */ }
      }
    }
  })());
});

// Anything that makes up the app itself, as opposed to its artwork.
const CODE = /\.(?:html|js|css|webmanifest|json)$/;

function isCode(url) {
  return url.pathname.endsWith("/") || CODE.test(url.pathname);
}

// A slow network should not hold the app shut. If the request has not come
// back by this point, answer from the cache instead and move on.
const NETWORK_TIMEOUT_MS = 3000;

function withTimeout(promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS);
    promise.then(
      (response) => { clearTimeout(timer); resolve(response); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// Fetch straight from the server, bypassing the browser's own HTTP cache.
//
// Without this the worker can be handed the very file it is trying to
// replace: GitHub Pages serves these with a max-age, so for several minutes
// after a deploy a plain fetch() is answered from the HTTP cache and never
// reaches the server. Going network-first is pointless if the "network" is
// really just another cache.
//
// Rebuilt from the URL rather than from the request, because a navigation
// request cannot be copied into a new Request. These are all same-origin
// GETs for static files, so nothing is lost.
function fetchFresh(request) {
  const direct = new Request(request.url, { cache: "no-store", credentials: "same-origin" });
  const network = fetch(direct);
  // The timeout below decides what THIS load is answered with, but it does
  // not abandon the request. Whatever it eventually returns is still written
  // to the cache, so a load that fell back to a stale copy over a slow
  // connection is the only one that does: the next open already has the new
  // file waiting, rather than racing the same timeout again.
  network.then((response) => keep(request, response)).catch(() => {});
  return withTimeout(network);
}

function keep(request, response) {
  if (response && response.status === 200 && response.type === "basic") {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The app's own code is fetched from the network first, and only falls back
  // to the cache when the network cannot answer.
  //
  // It used to be the other way around: the cache was served immediately and
  // refreshed in the background. That meant every update was one open behind
  // -- the screen you were looking at had been built from the PREVIOUS
  // version's files, and the new ones only appeared the next time the app was
  // opened. A fix could be deployed and still look missing. Going to the
  // network first means an online open is always the current version, while
  // the cache continues to cover being offline.
  if (isCode(url)) {
    event.respondWith(
      fetchFresh(request)
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // An offline navigation to a page that was never cached still has
          // to render something.
          if (request.mode === "navigate") {
            const shell = await caches.match("./index.html");
            if (shell) return shell;
          }
          return Response.error();
        })
    );
    return;
  }

  // Icons and artwork do not change between versions, so the cache answers
  // straight away and the network only tops it up.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => keep(request, response))
        .catch(() => cached);
      return cached || network;
    })
  );
});
