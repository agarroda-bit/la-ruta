// Prueba general sobre dist/ (lo que se publica):
//  1. Móvil 390×844 con toques: portada → nombres → mapa. Guardado tras recargar.
//  2. PWA: el service worker guarda todo; se corta la red, se recarga y se juega una etapa.
// Uso: npm test   (o node herramientas/pruebas.mjs --port 5390 [--etapa phuket] [--gpu])
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const port = Number(args.port || 5390);
const etapa = args.etapa || 'phuket';
mkdirSync('pruebas/capturas', { recursive: true });

const server = await preview({ preview: { port, strictPort: true }, logLevel: 'error' });
const url = `http://localhost:${port}/`;
const browser = await chromium.launch(args.swiftshader
  ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
  : { channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.stack || e)));
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) fallos++; };
let fallos = 0;
const tapSel = async (sel) => { const b = await page.locator(sel).first().boundingBox({ timeout: 10000 }); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };

try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'pruebas/capturas/general-portada-390.png' });
  await tapSel('.portada');
  await page.waitForTimeout(800);
  await page.locator('#nom1').fill('Rodri');
  await page.locator('#nom2').fill('Pau');
  await tapSel('.nom-botones .boton.grande');
  await page.waitForTimeout(2500);
  ok(await page.locator('.mapa-ui').count() === 1, 'mapa visible tras poner nombres');
  await page.screenshot({ path: 'pruebas/capturas/general-mapa-390.png' });

  // service worker listo y controlando
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const sw = await page.evaluate(() => !!navigator.serviceWorker.controller);
  ok(sw, 'service worker controla la página');
  const cached = await page.evaluate(async () => { const ks = await caches.keys(); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return n; });
  ok(cached > 10, `archivos en caché: ${cached}`);

  // guardado: tras recargar, los nombres siguen
  const names = await page.evaluate(() => JSON.parse(localStorage.getItem('laruta.partida.v1')).names);
  ok(names[0] === 'Rodri' && names[1] === 'Pau', 'nombres guardados tras recargar: ' + names.join(' / '));

  // sin red
  await ctx.setOffline(true);
  await page.goto(url + '?etapa=' + etapa, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelectorAll('.dlg-saltar').forEach((b) => b.click()));
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelectorAll('.dlg-saltar').forEach((b) => b.click()));
  await page.waitForTimeout(4500);
  const playing = await page.evaluate(() => !!(window.__ruta && window.__ruta.game.current));
  ok(playing, `sin red: la etapa ${etapa} arranca`);
  // jugamos un rato con el turbo (toques reales)
  for (let i = 0; i < 6; i++) { await page.touchscreen.tap(330, 760); await page.waitForTimeout(700); }
  await page.screenshot({ path: `pruebas/capturas/general-sinred-${etapa}-390.png` });
  if (args.full) {
    // espera a que la etapa termine sola (si la etapa tiene piloto automático de pruebas)
    await page.waitForSelector('.resultados', { timeout: 300000 });
    ok(true, 'sin red: etapa terminada y resultados visibles');
  }
  await ctx.setOffline(false);
} catch (e) {
  ok(false, 'excepción: ' + e.message);
}
const real = errors.filter((e) => !/AudioContext|autoplay|net::ERR_INTERNET_DISCONNECTED/i.test(e));
ok(real.length === 0, 'consola sin errores' + (real.length ? ': ' + real.slice(0, 5).join(' | ') : ''));
await browser.close();
server.httpServer.close();
console.log(fallos ? `FALLOS: ${fallos}` : 'TODO OK');
process.exit(fallos ? 1 : 0);
