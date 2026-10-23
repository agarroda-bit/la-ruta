// Prueba de principio a fin de la ETAPA 3 · BANGKOK (tuk-tuk de noche).
// Juega un turno entero con toques reales en 390×844 (CDP Input.dispatchTouchEvent: joystick +
// botones DERRAPE / TURBO / FRENO) y otro con teclado en 1440×900. Debe llegar a .resultados sin errores.
// Uso: node pruebas/bangkok.mjs --port 5321 [--solo tactil|teclado] [--cpu 4] [--sin-capturas] [--sin-lluvia]
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const port = Number(args.port || 5321);
const passes = args.solo ? [args.solo] : ['tactil', 'teclado'];
const shots = !args['sin-capturas'];
mkdirSync('pruebas/capturas', { recursive: true });

const server = await createServer({ server: { port, strictPort: false, hmr: false, watch: { ignored: ['**/*'] } }, cacheDir: `node_modules/.vite-captura-${port}`, logLevel: 'error', clearScreen: false });
await server.listen();
const base = `http://localhost:${server.config.server.port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const angleDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
let failed = false;

for (const pass of passes) {
  const touch = pass === 'tactil';
  const W = touch ? 390 : 1440, H = touch ? 844 : 900;
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const bctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await bctx.newPage();
  const cdp = await bctx.newCDPSession(page);
  if (args.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(args.cpu) });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  if (args['sin-lluvia']) await page.addInitScript(() => { try { const k = 'laruta.partida.v1'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.settings = { ...(d.settings || {}), rain: false }; localStorage.setItem(k, JSON.stringify(d)); } catch (e) { /* nada */ } });
  console.log(`\n=== Pasada ${pass} (${W}×${H}) ===`);
  // primera carga: Vite puede optimizar dependencias y recargar la página; esperamos a que se asiente
  await page.goto(base + '?etapa=bangkok', { waitUntil: 'load', timeout: 120000 });
  for (let k = 0; k < 3; k++) {
    try { await page.waitForFunction(() => window.__ruta && window.__ruta.etapa && window.__ruta.etapa.fase, null, { timeout: 60000 }); await sleep(1500); await page.evaluate(() => 1); break; } catch (e) { await sleep(1500); }
  }
  await page.waitForFunction(() => window.__ruta && window.__ruta.etapa && window.__ruta.etapa.fase, null, { timeout: 120000 });
  const tag = touch ? 'movil' : 'escritorio';
  if (shots) { await sleep(2500); await page.screenshot({ path: `pruebas/capturas/bangkok-${tag}-intro.png` }); }
  // saltar diálogos y esperar a la cuenta atrás
  for (let k = 0; k < 120; k++) {
    const f = await page.evaluate(() => { document.querySelectorAll('.dlg-saltar').forEach((b) => b.click()); return window.__ruta.etapa.fase; });
    if (f === 'drive') break;
    await sleep(250);
  }

  // ── mandos ──
  const rect = async (id) => page.evaluate((i) => { const r = document.querySelector(`.btn-tactil[data-id="${i}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  const btn = touch ? { drift: await rect('drift'), turbo: await rect('turbo'), brake: await rect('brake') } : null;
  const JOY = [95, H - 190];
  const fingers = new Map(); // id → {x,y}
  const pts = () => [...fingers.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id }));
  const tDown = async (id, x, y) => { fingers.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts() }); };
  const tMove = async (id, x, y) => { fingers.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts() }); };
  // soltar un dedo: en CDP, touchEnd lleva SOLO el dedo que se levanta (los demás siguen apoyados)
  const tUp = async (id) => { const f = fingers.get(id); if (!f) return; fingers.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: f.x, y: f.y, id }] }); };
  const keys = new Set();
  const key = async (k, on) => { if (on && !keys.has(k)) { keys.add(k); await page.keyboard.down(k); } else if (!on && keys.has(k)) { keys.delete(k); await page.keyboard.up(k); } };
  // Chrome empareja los dedos soltados por su posición en la lista: el joystick es siempre el dedo 0
  // y los botones usan un único dedo que va el último (así soltarlo nunca descoloca al joystick).
  const KEYS = { drift: 'Space', turbo: 'ShiftLeft', brake: 'ArrowDown' };
  let slot = null;
  const hold = async (b, on) => {
    if (touch) {
      if (on && slot !== b) { if (slot) await tUp(1); if (!fingers.has(0)) await tDown(0, JOY[0], JOY[1]); slot = b; await tDown(1, ...btn[b]); }
      else if (!on && slot === b) { slot = null; await tUp(1); }
    } else await key(KEYS[b], on);
  };
  const steerTo = async (s) => {
    if (touch) {
      if (!fingers.has(0)) await tDown(0, JOY[0], JOY[1]);
      await tMove(0, JOY[0] + s * 52, JOY[1]);
    } else {
      await key('ArrowRight', s > 0.25); await key('ArrowLeft', s < -0.25);
    }
  };

  // ── bucle de conducción ──
  const t0 = Date.now();
  let stuck = 0, reverseT = 0, last = null, fps = [], shotAction = false, shotRide = false, lastLog = 0, turboT = 0, lastDelivered = 0;
  let res = null;
  while (Date.now() - t0 < 240000) {
    const s = await page.evaluate(() => ({ ...window.__ruta.etapa, inp: [window.__ruta.input.x.toFixed(2), window.__ruta.input.down('brake'), window.__ruta.input.down('drift'), window.__ruta.input.down('turbo')].join(','), jugador: { ...window.__ruta.etapa.jugador }, guia: { ...window.__ruta.etapa.guia }, fps: window.__ruta.engine.fps, res: !!document.querySelector('.resultados') }));
    if (s.res) { res = s; break; }
    const now = Date.now();
    if (s.fase !== 'drive') { await steerTo(0); await hold('drift', false); await sleep(60); continue; }
    fps.push(s.fps);
    const p = s.jugador, bearing = Math.atan2(s.guia.x - p.x, s.guia.z - p.z);
    const diff = angleDiff(p.yaw, bearing);
    const dist = Math.hypot(s.guia.x - p.x, s.guia.z - p.z);
    // atasco: marcha atrás un momento
    if (p.v < 2.5) stuck += 1; else stuck = 0;
    if (stuck > 25 && reverseT <= 0) { reverseT = 14; if (args.debug) console.log('  atasco', p.x.toFixed(1), p.z.toFixed(1), p.yaw.toFixed(2), 'guia', s.guia.x.toFixed(1), s.guia.z.toFixed(1), 'diff', diff.toFixed(2), 'inp', s.inp, [...fingers.keys()].join('|')); }
    if (reverseT > 0) {
      reverseT--;
      await hold('drift', false); await hold('brake', true); await steerTo(diff > 0 ? 1 : -1);
      if (reverseT === 0) { await hold('brake', false); stuck = 0; }
      await sleep(50); continue;
    }
    const steer = Math.max(-1, Math.min(1, -diff * 2.6));
    await steerTo(steer);
    await hold('drift', Math.abs(diff) > 0.55 && p.v > 9 && dist < 25);
    // turbo en recta si hay carga
    if (s.turbo >= 0.34 && Math.abs(diff) < 0.12 && dist > 30 && now - turboT > 2500) { turboT = now; await hold('turbo', true); await sleep(60); await hold('turbo', false); }
    if (shots && !shotAction && s.tiempo < 135) { shotAction = true; await page.screenshot({ path: `pruebas/capturas/bangkok-${tag}-accion.png` }); }
    if (shots && !shotRide && s.modo === 'ride' && s.viaje < s.viajeMax - 4) { shotRide = true; await page.screenshot({ path: `pruebas/capturas/bangkok-${tag}-viaje.png` }); }
    if (s.entregados !== lastDelivered) { lastDelivered = s.entregados; console.log(`  entregado #${s.entregados} · ${s.dinero} ฿ · quedan ${s.tiempo.toFixed(0)} s`); }
    if (now - lastLog > 15000) { lastLog = now; console.log(`  t=${(150 - s.tiempo).toFixed(0)}s modo=${s.modo} turista=${s.turista} v=${p.v.toFixed(1)} fps=${s.fps.toFixed(0)} entregados=${s.entregados} fallidos=${s.fallidos}`); }
    last = s;
    await sleep(45);
  }
  for (const id of [...fingers.keys()]) await tUp(id);
  for (const k of [...keys]) await key(k, false);
  await sleep(2600);
  if (shots) await page.screenshot({ path: `pruebas/capturas/bangkok-${tag}-final.png` });
  const avg = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
  const min = fps.length ? Math.min(...fps.slice(20)) : 0;
  const final = await page.evaluate(() => ({ ...window.__ruta.etapa, txt: (document.querySelector('.resultados') || {}).innerText || '' }));
  console.log(`  Resultado: ${res ? 'PANTALLA DE RESULTADOS' : 'NO LLEGÓ'} · entregados ${final.entregados} · fallidos ${final.fallidos} · ${final.dinero} ฿ · estrellas ${final.estrellas} · choques ${final.choques}`);
  console.log(`  fps medio ${avg.toFixed(1)} · mínimo ${min.toFixed(1)}`);
  // Repetir: la etapa se vuelve a montar sin errores (dispose + create)
  if (res) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('.resultados button')].find((x) => /Repetir/.test(x.textContent)); if (b) b.click(); });
    let ok = false;
    for (let k = 0; k < 60 && !ok; k++) { await sleep(250); ok = await page.evaluate(() => !document.querySelector('.resultados') && window.__ruta.etapa && !window.__ruta.etapa.terminado && window.__ruta.etapa.tiempo === 150); }
    console.log(`  Repetir: ${ok ? 'ok' : 'NO VUELVE A EMPEZAR'}`);
    if (!ok) failed = true;
  }
  const real = errors.filter((e) => !/AudioContext|autoplay/i.test(e));
  if (real.length) { console.log('  ERRORES DE CONSOLA:'); for (const e of real.slice(0, 20)) console.log('   -', e.slice(0, 400)); }
  if (!res || real.length) failed = true;
  await browser.close();
}
await server.close();
console.log(failed ? '\nPRUEBA FALLIDA' : '\nPRUEBA SUPERADA');
process.exit(failed ? 1 : 0);
