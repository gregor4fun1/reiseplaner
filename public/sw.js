// Netz zuerst, bei fehlender Verbindung der zuletzt geladene Stand.
const CACHE = 'reiseplaner-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Kartenkacheln und Ortssuche werden nicht gespeichert.
  if (e.request.method !== 'GET' || (u.origin !== location.origin && u.host !== 'unpkg.com') || u.pathname.endsWith('/geocode')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || Response.error()))
  );
});
