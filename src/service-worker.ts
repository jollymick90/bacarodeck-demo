/// <reference lib="webworker" />
import { build, version } from '$service-worker';
const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `bacarodeck-${version}`;
const shell = '/offline-shell';
const assets = [
  ...build,
  '/offline.html',
  '/bacarotech-logo.png',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest'
];
async function prepare() {
  const cache = await caches.open(cacheName);
  // The shell is public and contains no server-rendered workspace content.
  // Never cache authenticated API responses.
  for (const path of [...assets, shell]) {
    if (!(await cache.match(path))) {
      const response = await fetch(path, { credentials: 'omit', cache: 'reload' });
      if (!response.ok) throw new Error('Risorse offline non disponibili. Riprova online.');
      await cache.put(path, response);
    }
  }
}
worker.addEventListener('install', (event) => {
  event.waitUntil(prepare());
});
worker.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await worker.clients.claim();
      // Activation only follows a complete install; keep old resources until then.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('bacarodeck-') && k !== cacheName)
          .map((k) => caches.delete(k))
      );
    })()
  );
});
worker.addEventListener('message', (event) => {
  if (event.data?.type !== 'PREPARE_OFFLINE') return;
  event.waitUntil(
    prepare().then(
      () => event.ports[0]?.postMessage({ ready: true }),
      (error) =>
        event.ports[0]?.postMessage({ ready: false, error: String(error.message || error) })
    )
  );
});
worker.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== worker.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(
        async () =>
          (await (await caches.open(cacheName)).match(shell)) ||
          (await caches.match('/offline.html')) ||
          Response.error()
      )
    );
  } else if (assets.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(cacheName)
        .then(async (cache) => (await cache.match(event.request)) || fetch(event.request))
    );
  }
});
