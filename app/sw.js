const CACHE_NAME = "dilmurod-finance-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/db.js",
  "./js/seed.js",
  "./js/utils.js",
  "./js/ui.js",
  "./js/pages/dashboard.js",
  "./js/pages/cashPosition.js",
  "./js/pages/cashFlow.js",
  "./js/pages/pnl.js",
  "./js/pages/balanceSheet.js",
  "./js/pages/goals.js",
  "./js/pages/targets.js",
  "./js/pages/specifications.js",
  "./js/pages/creditRating.js",
  "./js/pages/settings.js",
  "./js/pages/transactionForm.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
