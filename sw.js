// The service worker (v1-10 decision 3): a classic script with no imports,
// registered from src/app.js. It caches the app's files under a name that
// follows their bytes, answers the page's requests for them from that cache,
// and deletes its own older caches. It never touches localStorage, so an
// update cannot lose data. With neither skipWaiting nor clients.claim, a new
// version installs while the old one runs and takes over once every window
// of the old one has closed (P3, P5): one page is served by one version from
// its first request to its last.

// Written by `node scripts/cache-name.js --write` (`just fix`), never by
// hand: the digest of the files FILES names (decision 4).
const VERSION = "cfcee80d17b6";
// The registration's scope keeps a copy of the app under another path of the
// same origin to its own caches.
const PREFIX = `steady-state ${self.registration.scope} `;
const CACHE = `${PREFIX}${VERSION}`;
// Every file the page reaches: ./ and index.html, the two URLs the app opens
// at; index.html's links and scripts; the manifest's icons; and every module
// src/app.js reaches through static imports (check 3).
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "src/app.js",
  "src/backup.js",
  "src/chart.js",
  "src/controller.js",
  "src/device.js",
  "src/i18n.js",
  "src/intake.js",
  "src/journal.js",
  "src/pk.js",
  "src/settings.js",
  "src/store.js",
  "src/summary.js",
  "src/ui-backup.js",
  "src/ui-dom.js",
  "src/ui-menu.js",
  "src/ui-notices.js",
  "src/ui.js",
  "vendor/chart.js-4.5.1/chart.umd.min.js",
  "vendor/hammerjs-2.0.8/hammer.min.js",
  "vendor/chartjs-plugin-zoom-2.2.0/chartjs-plugin-zoom.min.js",
];

// `cache: "reload"` keeps the browser's HTTP cache out, where a host's
// max-age could put the old version's file under the new version's name,
// and `?v=` makes each URL new to every cache on the way, a CDN's included.
// A failed fetch fails the install, and the old version stays.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          FILES.map(
            (path) => new Request(`${path}?v=${VERSION}`, { cache: "reload" }),
          ),
        ),
      ),
  );
});

// Every cache of this copy but the one this version filled.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(PREFIX) && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
});

// A same-origin GET, from this version's cache, where `ignoreSearch` finds
// styles.css in its styles.css?v=… entry; the network when it holds nothing.
// Nothing is added at run time, and any other request passes through.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(request, { ignoreSearch: true }))
      .then((cached) => cached ?? fetch(request)),
  );
});
