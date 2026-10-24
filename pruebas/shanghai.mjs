// Prueba de principio a fin de la ETAPA 6 · SHANGHÁI.
// Juega la etapa entera dos veces: con toques reales en 390×844 (botones ◀ ▶ y TURBO por CDP)
// y con teclado en 1440×900. Debe llegar a .resultados sin errores de consola.
// Uso: node pruebas/shanghai.mjs --port 5381 [--solo toque|teclado] [--cpu 4] [--sin-capturas] [--reaccion 280]
// --reaccion: el bot decide con lo que vio hace N ms (simula reflejos humanos; no exige ganar)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const port = Number(args.port || 5381);
const shots = !args['sin-capturas'];
const REAC = Number(args.reaccion || 0);
const DIR = 'pruebas/capturas';
mkdirSync(DIR, { recursive: true });

const server = await createServer({ server: { port, strictPort: false, hmr: false, watch: { ignored: ['**/*'] } }, cacheDir: `node_modules/.vite-captura-${port}`, logLevel: 'error', clearScreen: false });
await server.listen();
const realPort = server.config.server.port;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pass(name, { width, height, touch }) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  if (args.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(args.cpu) });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e.stack || e)));
  const tag = touch ? '390' : '1440';
  const shot = async (n) => { if (shots) await p.screenshot({ path: `${DIR}/shanghai-${n}-${tag}.png` }); };
  // la primera carga puede recargar la página si Vite optimiza dependencias: esperamos al diálogo estable
  await p.goto(`http://localhost:${realPort}/?etapa=shanghai`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('.dlg-saltar', { timeout: 60000 });
  await sleep(2500);
  if (!(await p.$('.dlg-saltar'))) await p.waitForSelector('.dlg-saltar', { timeout: 60000 });
  await shot('intro');
  if (touch) { const b = await p.locator('.dlg-saltar').boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  else await p.click('.dlg-saltar');

  const press = async (id) => {
    if (touch) {
      const r = await p.evaluate((i) => { const e = document.querySelector(`.btn-tactil[data-id="${i}"]`); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
      if (!r) return;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 7 }] });
      await sleep(45);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      const key = id === 'izq' ? 'ArrowLeft' : id === 'der' ? 'ArrowRight' : 'ShiftLeft';
      await p.keyboard.down(key); await sleep(45); await p.keyboard.up(key);
    }
  };

  const t0 = Date.now();
  const fps = [];
  const done = new Set();
  let last = null, lastMove = 0, turbos = 0, swipeUsed = false;
  const hist = [];
  while (Date.now() - t0 < 300000) {
    let st = null;
    try {
      if (await p.$('.resultados')) break;
      st = await p.evaluate(() => window.__ruta && window.__ruta.etapa ? { ...window.__ruta.etapa, fps: window.__ruta.engine.fps } : null);
    } catch (e) { errors.push('navegación inesperada: ' + e.message); await sleep(500); continue; }
    if (!st || !st.fase) { await sleep(100); continue; }
    if (last && st.choques > last.choques && args.verbose) console.log('   choque', JSON.stringify(st.ultimoChoque));
    last = st;
    if (REAC) {
      hist.push({ t: Date.now(), st: { s: st.s, peligros: st.peligros, orbesCerca: st.orbesCerca } });
      while (hist.length > 1 && hist[1].t <= Date.now() - REAC) hist.shift();
      const old = hist[0].st;
      // ve el mundo de hace REAC ms, pero sabe en qué carril está ahora
      st.peligros = old.peligros.map((h) => ({ ...h, d: h.d - (st.s - old.s) }));
      st.orbesCerca = old.orbesCerca.map((o) => ({ ...o, d: o.d - (st.s - old.s) }));
    }
    if (st.fase === 'carrera') {
      fps.push(st.fps);
      // elige el carril más seguro: castiga carriles con obstáculo cerca y premia orbes
      const score = [0, 0, 0];
      const ups = st.kmh / 6;
      const near = st.peligros.filter((h) => h.d > -(h.len || 0) - 1 && h.d < Math.max(45, ups * (h.tipo === 'tren' ? 2.6 : (REAC ? 1.9 : 1.25)))).slice(0, 2);
      for (const h of near) for (const l of h.carriles) score[l] -= 1000 - Math.max(0, h.d);
      for (const o of st.orbesCerca) if (o.d > 0 && o.d < 70) score[o.carril] += 6 - o.d / 20;
      for (let l = 0; l < 3; l++) score[l] -= Math.abs(l - st.carril) * 2;
      // no cruzar por un carril bloqueado inminente
      let best = score.indexOf(Math.max(...score));
      if (Math.abs(best - st.carril) === 2 && near.some((h) => h.carriles.includes(1) && h.d < 25 && h.d > -(h.len || 0))) best = st.carril;
      if (best !== st.carril && Date.now() - lastMove > 170) {
        lastMove = Date.now();
        // en táctil, alterna botones y deslizar (joystick) para probar los dos
        if (touch && !swipeUsed && near.length === 0) {
          swipeUsed = true;
          const dx = best > st.carril ? 90 : -90;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 500, id: 3 }] });
          for (let k = 1; k <= 4; k++) { await sleep(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120 + (dx * k) / 4, y: 500, id: 3 }] }); }
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else await press(best > st.carril ? 'der' : 'izq');
      }
      if (st.energia >= 1 && !st.turbo) { await press('boost'); turbos++; }
      if (!done.has('accion') && st.s > 900) { done.add('accion'); await shot('accion'); }
      if (!done.has('turbo') && st.turbo && st.kmh > 400) { done.add('turbo'); await shot('turbo'); }
      if (!done.has('ciudad') && st.s > 3300) { done.add('ciudad'); await shot('ciudad'); }
      if (!done.has('rio') && st.s > 5300) { done.add('rio'); await shot('rio'); }
    }
    if (st.fase === 'llegada' && !done.has('llegada') && st.s > 6450) { done.add('llegada'); await shot('llegada'); }
    if (st.fase === 'final' && !done.has('fuegos')) { done.add('fuegos'); await sleep(3600); await shot('fuegos'); }
    await sleep(touch ? 40 : 30);
  }
  const ok = !!(await p.$('.resultados'));
  if (ok) { await sleep(2600); await shot('resultados'); }
  const fin = await p.evaluate(() => window.__ruta.etapa);
  const avg = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
  const real = errors.filter((e) => !/AudioContext|autoplay/i.test(e));
  console.log(`[${name}] resultados=${ok} gano=${fin.gano} estrellas=${fin.estrellas} orbes=${fin.orbes}/${fin.orbesTotal} choques=${fin.choques} punta=${fin.maxKmh} t=${fin.t}s turbos=${turbos} fps≈${avg.toFixed(1)} (mín ${fps.length ? Math.min(...fps).toFixed(1) : '-'}) errores=${real.length}`);
  for (const e of real.slice(0, 10)) console.log('   -', e.slice(0, 300));
  await ctx.close();
  return ok && real.length === 0 && (fin.gano || REAC > 0);
}

let allOk = true;
try {
  if (args.solo !== 'teclado') allOk = (await pass('toque 390×844', { width: 390, height: 844, touch: true })) && allOk;
  if (args.solo !== 'toque') allOk = (await pass('teclado 1440×900', { width: 1440, height: 900, touch: false })) && allOk;
} finally {
  await browser.close();
  await server.close();
}
console.log(allOk ? 'PRUEBA SHANGHÁI: OK' : 'PRUEBA SHANGHÁI: FALLO');
process.exit(allOk ? 0 : 1);
