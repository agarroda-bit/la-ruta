// Capturas y pruebas rápidas con Chromium headless.
// Uso:
//   node herramientas/captura.mjs --page "?etapa=phuket" --port 5201 --width 390 --height 844 --touch \
//     --shots '[{"wait":3000,"out":"pruebas/capturas/tmp/a.png"}]'
// Cada shot admite:
//   eval: JS en la página · log: expresión a imprimir · wait: ms · out: png
//   keys: [{"key":"KeyW","ms":2000}]               (teclado)
//   tap: [x,y] o "selector"                         (toque real)
//   touch: [{"x":..,"y":..,"ms":1500,"dx":0,"dy":0}] (dedos mantenidos a la vez, con arrastre opcional)
//   click: "selector"
// --dist: sirve dist/ (vite preview) en vez del servidor de desarrollo. --gpu: GPU real (Metal).
// --cpu 4: limita la CPU ×4 (para medir fps de móvil).
import { createServer, preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const port = Number(args.port || 5199);
const page = args.page || '';
const shots = JSON.parse(args.shots || '[{"wait":3000,"out":"pruebas/capturas/tmp/captura.png"}]');
const width = Number(args.width || 1440), height = Number(args.height || 900);
const touch = !!args.touch;

const server = args.dist
  ? await preview({ preview: { port, strictPort: false }, logLevel: 'error' })
  : await createServer({ server: { port, strictPort: false }, cacheDir: `node_modules/.vite-captura-${port}`, logLevel: 'error', clearScreen: false });
if (!args.dist) await server.listen();
const realPort = args.dist ? server.httpServer.address().port : server.config.server.port;
const url = `http://localhost:${realPort}/${page}`;
const browser = await chromium.launch(args.gpu
  ? { channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }
  : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
if (args.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(args.cpu) });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (args.verbose) console.log('[consola]', m.type(), m.text()); });
p.on('pageerror', (e) => errors.push(String(e.stack || e)));
console.log('Abriendo', url);
await p.goto(url, { waitUntil: 'load', timeout: 120000 });

async function touchHold(list) {
  // varios dedos a la vez (CDP): bajan juntos, se arrastran y se levantan al acabar su tiempo
  const t0 = Date.now();
  const pts = list.map((f, i) => ({ ...f, id: i, cx: f.x, cy: f.y, up: false }));
  const tp = () => pts.filter((f) => !f.up).map((f) => ({ x: f.cx, y: f.cy, id: f.id }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp() });
  while (pts.some((f) => !f.up)) {
    await p.waitForTimeout(33);
    const el = Date.now() - t0;
    let ended = false;
    for (const f of pts) {
      if (f.up) continue;
      const k = Math.min(1, el / Math.max(1, f.ms ?? 500));
      f.cx = f.x + (f.dx || 0) * Math.min(1, k * 4); f.cy = f.y + (f.dy || 0) * Math.min(1, k * 4);
      if (el >= (f.ms ?? 500)) { f.up = true; ended = true; }
    }
    const rest = tp();
    if (ended) await cdp.send('Input.dispatchTouchEvent', { type: rest.length ? 'touchMove' : 'touchEnd', touchPoints: rest });
    else await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: rest });
  }
}

for (const s of shots) {
  if (s.eval) { try { await p.evaluate(s.eval); } catch (e) { errors.push('eval: ' + e.message); } }
  if (s.click) { try { await p.click(s.click, { timeout: 8000 }); } catch (e) { errors.push('click: ' + e.message); } }
  if (s.tap) {
    try {
      if (typeof s.tap === 'string') { const b = await p.locator(s.tap).first().boundingBox({ timeout: 8000 }); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
      else await p.touchscreen.tap(s.tap[0], s.tap[1]);
    } catch (e) { errors.push('tap: ' + e.message); }
  }
  if (s.keys) for (const k of s.keys) { await p.keyboard.down(k.key); await p.waitForTimeout(k.ms ?? 500); await p.keyboard.up(k.key); }
  if (s.touch) await touchHold(s.touch);
  if (s.wait) await p.waitForTimeout(s.wait);
  if (s.log) { try { console.log('[log]', JSON.stringify(await p.evaluate(s.log))); } catch (e) { errors.push('log: ' + e.message); } }
  if (s.out) { mkdirSync(dirname(s.out), { recursive: true }); await p.screenshot({ path: s.out }); console.log('Captura:', s.out); }
}
await browser.close();
await (args.dist ? server.close() : server.close());
const real = errors.filter((e) => !/AudioContext|autoplay/i.test(e));
if (real.length) { console.log('ERRORES DE CONSOLA (' + real.length + '):'); for (const e of real.slice(0, 30)) console.log(' -', e.slice(0, 500)); if (!args['allow-errors']) process.exit(1); }
else console.log('Sin errores de consola.');
