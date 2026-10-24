// Generado por herramientas/sw-lista.mjs — no editar a mano.
const CACHE = 'la-ruta-9ae651ba11';
const FILES = ["./","./assets/analisis-1FF1k-Aa.js","./assets/baloo-2-latin-500-normal-BSdEhq8m.woff","./assets/baloo-2-latin-500-normal-CmLZ27r7.woff2","./assets/baloo-2-latin-700-normal-CqTg7A15.woff2","./assets/baloo-2-latin-700-normal-Ld3Zm3l2.woff","./assets/baloo-2-latin-800-normal-B8BXfZF7.woff","./assets/baloo-2-latin-800-normal-BbF3Etk1.woff2","./assets/bungee-latin-400-normal-DA8IEVW_.woff","./assets/bungee-latin-400-normal-Dfnurram.woff2","./assets/carretera-DNWJCBWD.js","./assets/final-Cp3MlXBc.js","./assets/foto-BXUs_12R.js","./assets/index-BWIG21_K.css","./assets/index-BdnwVkxk.js","./assets/index-C6_aGqG8.js","./assets/index-CFU5AlOD.js","./assets/index-CxycZQxy.js","./assets/index-D53o2w-4.js","./assets/index-DDjQ8TDe.js","./assets/index-lU2VBRZu.js","./icons/icono-180.png","./icons/icono-192.png","./icons/icono-512.png","./icons/icono.svg","./index.html","./manifest.json"];
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
