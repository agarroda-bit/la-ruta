// Prueba de principio a fin de la ETAPA 5 · MACAO (persecución de neón).
// 1) Móvil 390×844 con toques reales (joystick + DERRAPE + TURBO por CDP, multitoque).
// 2) Escritorio 1440×900 con teclado.
// Un "piloto" lee window.__ruta.etapa (guia/curva) y conduce. Tiene que llegar a .resultados sin errores.
// Uso: node pruebas/macao.mjs --port 5371 [--solo movil|escritorio] [--atajos no] [--cpu 4] [--capturas]
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const port = Number(args.port || 5371);
const atajos = args.atajos !== 'no';
const shots = args.capturas === 'true';
mkdirSync('pruebas/capturas', { recursive: true });

const server = await createServer({ server: { port, strictPort: false, hmr: false, watch: { ignored: ['**/*'] } }, cacheDir: `node_modules/.vite-captura-${port}`, logLevel: 'error', clearScreen: false, optimizeDeps: { entries: ['index.html', 'src/**/*.js'] } });
await server.listen();
const realPort = server.config.server.port;
const url = `http://localhost:${realPort}/?etapa=macao`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

let fallos = 0;
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fallos++; };

async function pasada(nombre, { width, height, touch }) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (args.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(args.cpu) });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  await page.addInitScript((a) => { window.__macaoBot = { atajos: a }; }, atajos);
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__ruta && window.__ruta.etapa && 'running' in window.__ruta.etapa, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  if (shots) await page.screenshot({ path: `pruebas/capturas/macao-${nombre}-inicio.png` });
  // saltar diálogos (con toque real en móvil)
  for (let k = 0; k < 3; k++) {
    const b = page.locator('.dlg-saltar').first();
    if (await b.count()) {
      if (touch) { const bb = await b.boundingBox(); if (bb) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
      else await b.click();
    }
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => window.__ruta && window.__ruta.etapa && window.__ruta.etapa.running, null, { timeout: 20000 });

  // posiciones de los botones táctiles
  const btn = {};
  if (touch) {
    for (const id of ['boost', 'drift', 'brake']) {
      const bb = await page.locator(`.btn-tactil[data-id="${id}"]`).boundingBox();
      btn[id] = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
    }
  }
  // dedos activos (CDP): 0 = joystick, 1 = derrape, 2 = turbo
  const fingers = new Map();
  let anyDown = false;
  const send = async (type) => {
    const pts = [...fingers.entries()].map(([id, f]) => ({ x: f.x, y: f.y, id }));
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : pts });
  };
  const fingerDown = async (id, x, y) => { fingers.set(id, { x, y }); await send(anyDown ? 'touchStart' : 'touchStart'); anyDown = true; };
  const fingerMove = async (id, x, y) => { const f = fingers.get(id); if (!f || !touch) return; f.x = x; f.y = y; await send('touchMove'); };
  // soltar un dedo: touchEnd con SOLO ese punto (touchMove sin él no lo suelta en Chromium)
  const fingerUp = async (id) => { const f = fingers.get(id); if (!f) return; fingers.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: f.x, y: f.y, id }] }); if (!fingers.size) anyDown = false; };

  const joy = { x: 95, y: height - 170 };
  const keys = new Set();
  const key = async (k, on) => { if (on && !keys.has(k)) { keys.add(k); await page.keyboard.down(k); } else if (!on && keys.has(k)) { keys.delete(k); await page.keyboard.up(k); } };

  if (touch) { await fingerDown(0, joy.x, joy.y); }
  const t0 = Date.now();
  let last = null, turboTaps = 0, drifts = 0, shotMid = false, shotSc = false, shotBridge = false, maxT = 0;
  let driftHold = 0, last2 = 0, qual = '', ticks = 0;
  const fpsList = [];
  const shotTipos = new Set();
  while (Date.now() - t0 < 300000) {
    const st = await page.evaluate(() => ({ ...window.__ruta.etapa, fps: window.__ruta.engine.fps, q: window.__ruta.engine.qualityName }));
    if (st.running && st.t > 4) { fpsList.push(st.fps); qual = st.q; }
    last = st;
    ticks++;
    if (st.done) break;
    if (!st.running) { await page.waitForTimeout(80); continue; }
    maxT = st.t;
    if (args.traza && Math.floor(st.t / 5) !== Math.floor((last2 || 0) / 5)) console.log(`  t=${st.t.toFixed(0)} prog=${st.prog.toFixed(0)} taxi=${st.taxiS.toFixed(0)} v=${st.speed.toFixed(1)} vt=${st.taxiV.toFixed(1)} gap=${st.gap.toFixed(0)} ${st.kind} road=${st.road}`);
    last2 = st.t;
    const g = st.guia || 0, curva = st.curva || 0;
    const steer = Math.max(-1, Math.min(1, g * 3.2));
    const wantDrift = (curva > 0.85 && st.speed > 16) || driftHold > 0;
    if (wantDrift && driftHold <= 0) { driftHold = 6; drifts++; }
    driftHold--;
    const wantTurbo = st.turbo >= 1 && !st.boost && curva < 0.35 && Math.abs(g) < 0.2;
    if (touch) {
      await fingerMove(0, joy.x + steer * 52, joy.y);
      if (wantDrift && !fingers.has(1)) await fingerDown(1, btn.drift.x, btn.drift.y);
      if (!wantDrift && fingers.has(1)) await fingerUp(1);
      const wantBrake = curva > 1.25 && st.speed > 22;
      if (wantBrake && !fingers.has(3)) await fingerDown(3, btn.brake.x, btn.brake.y);
      if (!wantBrake && fingers.has(3)) await fingerUp(3);
      if (fingers.has(2)) await fingerUp(2);
      else if (wantTurbo) { await fingerDown(2, btn.boost.x, btn.boost.y); turboTaps++; }
    } else {
      await key('ArrowRight', steer > 0.18); await key('ArrowLeft', steer < -0.18);
      await key('Space', wantDrift);
      await key('KeyS', curva > 1.25 && st.speed > 22);
      if (keys.has('ShiftLeft')) await key('ShiftLeft', false);
      else if (wantTurbo) { await key('ShiftLeft', true); turboTaps++; }
    }
    if (shots && !shotBridge && st.kind === 'bridge' && st.t > 8) { shotBridge = true; await page.screenshot({ path: `pruebas/capturas/macao-${nombre}-puente.png` }); }
    if (shots && st.onShortcut && !shotTipos.has(st.tipo)) { for (const k of [...keys]) await key(k, false); await fingerMove(0, joy.x, joy.y); shotTipos.add(st.tipo); await page.waitForTimeout(st.tipo === 'escaleras' ? 900 : 600); await page.screenshot({ path: `pruebas/capturas/macao-${nombre}-${st.tipo}.png` }); }
    if (shots && !shotMid && st.kind === 'city' && st.progress > 0.42 && !st.onShortcut) { shotMid = true; await page.screenshot({ path: `pruebas/capturas/macao-${nombre}-casco.png` }); }
    await page.waitForTimeout(45);
  }
  for (const id of [...fingers.keys()].reverse()) await fingerUp(id);
  for (const k of [...keys]) await key(k, false);
  const tickMs = (Date.now() - t0) / Math.max(1, ticks);
  const fps = fpsList.length ? fpsList.reduce((a, b) => a + b, 0) / fpsList.length : 0;
  const fpsMin = fpsList.length ? Math.min(...fpsList) : 0;
  await page.waitForTimeout(1500);
  if (shots) await page.screenshot({ path: `pruebas/capturas/macao-${nombre}-llegada.png` });
  const res = await page.waitForSelector('.resultados', { timeout: 20000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(2000);
  const stars = await page.locator('.resultados .estrella.si').count();
  if (shots) await page.screenshot({ path: `pruebas/capturas/macao-${nombre}-final.png` });
  // revancha contra el fantasma (si se ha ganado, debe aparecer)
  if (last.win && args.fantasma !== 'no') {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__ruta && window.__ruta.etapa && 'running' in window.__ruta.etapa, null, { timeout: 60000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelectorAll('.dlg-saltar').forEach((b) => b.click()));
    await page.waitForFunction(() => window.__ruta.etapa && window.__ruta.etapa.running, null, { timeout: 20000 });
    await page.waitForTimeout(2500);
    const g = await page.evaluate(() => window.__ruta.etapa.fantasma);
    ok(g === true, `${nombre}: la revancha trae el fantasma de la mejor vuelta`);
    if (shots) await page.screenshot({ path: `pruebas/capturas/macao-${nombre}-fantasma.png` });
  }
  const real = errors.filter((e) => !/AudioContext|autoplay/i.test(e));
  console.log(`[${nombre}] ${last.win ? 'GANA' : 'PIERDE'} · ${maxT.toFixed(1)} s · ventaja ${(last.lead || 0).toFixed(1)} s · atajos ${last.shortcuts} · estrellas ${stars} · saltos ${last.jumps} · chispas máx ${last.maxCombo} · choques ${last.crashes} · turbos ${turboTaps} · derrapes ${drifts} · fps media ${fps.toFixed(0)} (mín ${fpsMin.toFixed(0)}, calidad ${qual}) · ciclo del piloto ${tickMs.toFixed(0)} ms`);
  ok(res, `${nombre}: llega a la pantalla de resultados`);
  ok(last.done, `${nombre}: la carrera termina`);
  ok(real.length === 0, `${nombre}: sin errores de consola${real.length ? ' → ' + real.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
  return last;
}

try {
  if (args.solo !== 'escritorio') await pasada('390', { width: 390, height: 844, touch: true });
  if (args.solo !== 'movil') await pasada('1440', { width: 1440, height: 900, touch: false });
} catch (e) { console.log('✘ excepción:', e.message); fallos++; }
await browser.close();
await server.close();
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
