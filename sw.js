// Service worker: makes the game load and play offline.
// Bump VERSION on every release so installed copies pick up the new files.
const VERSION = 'ci-v0.7.0';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/config.js',
  'js/sim.js',
  'js/render.js',
  'js/hero.js',
  'js/audio.js',
  'js/lyre.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin files: cache first, refreshed in the background.
// Google Fonts: same idea, kept in the cache once seen so text keeps its face offline.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  event.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const network = fetch(req)
        .then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
        .catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('index.html');
      return new Response('', { status: 504 });
    }),
  );
});
