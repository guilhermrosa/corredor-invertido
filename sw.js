// Service worker: makes the game load and play offline.
// The version lives in js/version.js; changing it there makes installed copies pick up the new files
// (the browser checks imported scripts for changes too).
importScripts('js/version.js');
const VERSION = 'ci-v' + self.APP_VERSION;
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
  'js/stats.js',
  'js/tutorial.js',
  'js/fx.js',
  'js/achievements.js',
  'js/version.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never stores stale files
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin files: network first (revalidated, so updates show on the next open),
// falling back to the cached copy when offline or when the network takes over 3 s.
// Google Fonts: cached copy first, refreshed in the background.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  event.respondWith(caches.open(VERSION).then(async cache => {
    const fromCache = () => cache.match(req, { ignoreSearch: sameOrigin })
      .then(r => r || (req.mode === 'navigate' ? cache.match('index.html') : null));
    if (isFont) {
      const cached = await cache.match(req);
      const network = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      return (await network) || new Response('', { status: 504 });
    }
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise(resolve => setTimeout(resolve, 3000, null));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
      return (await fromCache()) || (await network);
    } catch (e) {
      return (await fromCache()) || new Response('', { status: 504 });
    }
  }));
});
