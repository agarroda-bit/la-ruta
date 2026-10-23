// Tras el build: escribe dist/sw.js con la lista de TODOS los archivos para guardarlos
// en la primera visita (así el juego funciona en el avión sin internet).
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
walk('dist');
const list = files.map((f) => relative('dist', f).split('\\').join('/')).filter((f) => f !== 'sw.js' && !f.endsWith('.map') && f !== 'version.txt' && f !== '.nojekyll');
const hash = createHash('sha1');
for (const f of list.sort()) hash.update(f).update(readFileSync(join('dist', f)));
const version = hash.digest('hex').slice(0, 10);
const sw = `// Generado por herramientas/sw-lista.mjs — no editar a mano.
const CACHE = 'la-ruta-${version}';
const FILES = ${JSON.stringify(['./', ...list.map((f) => './' + f)], null, 0)};
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
    e.respondWith(caches.match('./index.html', { cacheName: CACHE }).then((r) => r || caches.match('./')).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
`;
writeFileSync('dist/sw.js', sw);
console.log(`sw.js: ${list.length} archivos en caché (${version})`);
