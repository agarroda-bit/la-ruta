// Generado por herramientas/sw-lista.mjs — no editar a mano.
const CACHE = 'la-ruta-5a3b23abcf';
const FILES = ["./","./assets/analisis-Bixf-dM4.js","./assets/baloo-2-latin-500-normal-BSdEhq8m.woff","./assets/baloo-2-latin-500-normal-CmLZ27r7.woff2","./assets/baloo-2-latin-700-normal-CqTg7A15.woff2","./assets/baloo-2-latin-700-normal-Ld3Zm3l2.woff","./assets/baloo-2-latin-800-normal-B8BXfZF7.woff","./assets/baloo-2-latin-800-normal-BbF3Etk1.woff2","./assets/bungee-latin-400-normal-DA8IEVW_.woff","./assets/bungee-latin-400-normal-Dfnurram.woff2","./assets/carretera-dKatZ7QC.js","./assets/final-Dli8zdlU.js","./assets/foto-BRRPysTo.js","./assets/index-B3erwEBU.js","./assets/index-BK6RoS8e.js","./assets/index-BWKdevPS.js","./assets/index-COj4POhO.js","./assets/index-Cax546kY.js","./assets/index-Cjar1aoL.css","./assets/index-Cy0bZRyh.js","./assets/index-z1eQYB7x.js","./icons/icono-180.png","./icons/icono-192.png","./icons/icono-512.png","./icons/icono.svg","./index.html","./manifest.json"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('la-ruta-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // páginas: el index guardado (con o sin ?etapa=...)
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { cacheName: CACHE, ignoreVary: true }).then((r) => r || caches.match('./', { ignoreVary: true })).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
