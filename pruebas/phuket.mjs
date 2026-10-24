// Prueba de principio a fin de la ETAPA 1 · PHUKET.
// Juega la carrera entera con un "piloto automático" que lee window.__ruta.etapa:
//   1) móvil 390×844 con toques reales (CDP Input.dispatchTouchEvent: joystick + botón TURBO)
//   2) escritorio 1440×900 con teclado (flechas + Shift), y luego "Repetir" para ver el fantasma.
// Debe llegar a la pantalla de resultados (.resultados) sin errores de consola.
// Uso: node pruebas/phuket.mjs --port 5311 [--solo movil|teclado] [--cpu 4] [--sin-gpu]
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const port = Number(args.port || 5311);
const solo = args.solo || '';
const OUT = 'pruebas/capturas';
mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port, strictPort: false, hmr: false, watch: null }, cacheDir: `node_modules/.vite-phuket-${port}`, logLevel: 'error', clearScreen: false });
await server.listen();
const realPort = server.config.server.port;
const browser = await chromium.launch(args['sin-gpu']
  ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }
  : { channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let fallos = 0;

// Decide hacia dónde ir: evita obstáculos y busca cocos
function piloto(e) {
  const cands = [-4.3, -3, -1.5, 0, 1.5, 3, 4.3];
  let best = e.d, bc = Infinity;
  let peligro = false;
  for (const c of cands) {
    let cost = Math.abs(c - e.d) * 0.12;
    for (const h of e.ahead) {
      const ds = h.s - e.s;
      if (ds < -1 || ds > 34) continue;
      const band = (h.t === 'mono' ? 3.2 : h.t === 'gallina' ? 2.4 : 0.9) + (h.r || 0.8);
      if (Math.abs(c - h.d) < band) cost += 12 * (1 - ds / 40);
      if (ds < 22 && Math.abs(e.d - h.d) < band) peligro = true;
    }
    for (const k of e.cocosAhead) {
      const ds = k.s - e.s;
      if (ds > 30 || k.y > 1.6) continue;
      if (Math.abs(c - k.d) < 1.0) cost -= 1.4 * (1 - ds / 34);
    }
    if (cost < bc) { bc = cost; best = c; }
  }
  const steer = clamp((best - e.d) * 0.55 - e.rel * 1.2, -1, 1);
  const boost = e.turbo > 0.2 && !peligro;
  return { steer, boost, target: best };
}

async function jugar(modo) {
  const movil = modo === 'movil';
  const ctx = await browser.newContext(movil
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  if (args.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(args.cpu) });
  const errores = [];
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push(String(e.stack || e)));
  const tag = movil ? 'movil' : 'escritorio';
  console.log(`\n▶ ${tag}: abriendo http://localhost:${realPort}/?etapa=phuket`);
  await p.goto(`http://localhost:${realPort}/?etapa=phuket`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__ruta && window.__ruta.etapa && window.__ruta.etapa.fase, null, { timeout: 60000 });
  const estado = () => p.evaluate(() => window.__ruta && window.__ruta.etapa);

  // diálogos de la intro: tocar SALTAR (toque real o Escape)
  await sleep(1500);
  await p.screenshot({ path: `${OUT}/phuket-${tag}-1-intro.png` });
  for (let i = 0; i < 20; i++) {
    const e = await estado();
    if (e.fase !== 'intro') break;
    const b = await p.locator('.dlg-saltar').first().boundingBox().catch(() => null);
    if (b) { if (movil) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
    await sleep(400);
  }
  await p.waitForFunction(() => window.__ruta.etapa.fase === 'carrera', null, { timeout: 15000 });
  console.log('  carrera empezada');

  // controles
  const dedos = new Map(); // id → {x, y}
  const enviar = async (tipo) => {
    const tp = [...dedos.entries()].map(([id, q]) => ({ x: q.x, y: q.y, id }));
    if (tipo === 'touchEnd' || !tp.length) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tp });
  };
  let boostBox = null;
  if (movil) {
    const b = await p.locator('.btn-tactil[data-id="boost"]').boundingBox();
    boostBox = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    dedos.set(0, { x: 95, y: 700 }); await enviar('touchStart');
  }
  const teclas = new Set();
  const tecla = async (k, on) => { if (on && !teclas.has(k)) { teclas.add(k); await p.keyboard.down(k); } else if (!on && teclas.has(k)) { teclas.delete(k); await p.keyboard.up(k); } };

  const fps = [];
  const fotos = [[0.08, '2-salida'], [0.4, '3-acantilado'], [0.7, '4-pueblo'], [0.8, '4b-mercado'], [0.988, '4c-arco']];
  let ultimaFps = 0, t0 = Date.now(), e;
  let giroIzqOk = null;
  while (true) {
    e = await estado();
    if (!e) { await sleep(50); continue; }
    if (e.fase !== 'carrera') break;
    if (Date.now() - t0 > 240000) { console.log('  ✗ tiempo de prueba agotado'); break; }
    const c = piloto(e);
    // comprobación del signo del giro al principio: izquierda = d baja
    if (giroIzqOk === null && e.t > 0.3 && e.t < 2) {
      giroIzqOk = 'midiendo';
      const d0 = e.d;
      if (movil) { dedos.get(0).x = 95 - 56; await enviar('touchMove'); } else { await tecla('ArrowRight', false); await tecla('ArrowLeft', true); }
      await sleep(450);
      const d1 = (await estado()).d;
      if (movil) { dedos.get(0).x = 95; await enviar('touchMove'); } else await tecla('ArrowLeft', false);
      giroIzqOk = d1 < d0 - 0.5;
      console.log(`  giro a la izquierda: d ${d0} → ${d1} ${giroIzqOk ? '✓' : '✗ AL REVÉS'}`);
      continue;
    }
    if (movil) {
      const j = dedos.get(0);
      const nx = 95 + c.steer * 56;
      let tipo = null;
      if (Math.abs(nx - j.x) > 2) { j.x = nx; tipo = 'touchMove'; }
      if (c.boost && !dedos.has(1)) { dedos.set(1, { ...boostBox }); tipo = 'touchStart'; }
      else if (!c.boost && dedos.has(1)) { dedos.delete(1); tipo = 'touchMove'; }
      if (tipo) await enviar(tipo);
    } else {
      const dz = 0.25;
      await tecla('ArrowRight', c.steer > dz);
      await tecla('ArrowLeft', c.steer < -dz);
      await tecla('ShiftLeft', c.boost);
    }
    if (fotos.length && e.progreso >= fotos[0][0]) { const [, n] = fotos.shift(); await p.screenshot({ path: `${OUT}/phuket-${tag}-${n}.png` }); }
    if (Date.now() - ultimaFps > 2000) { ultimaFps = Date.now(); fps.push(await p.evaluate(() => window.__ruta.engine.fps)); }
    await sleep(25);
  }
  if (movil) { dedos.clear(); await enviar('touchEnd'); }
  for (const k of [...teclas]) await tecla(k, false);
  console.log(`  meta: ${e.gana ? 'GANA' : 'pierde'} · t=${e.t}s · sobran ${e.restante}s · cocos ${e.cocos}/${e.totalCocos} · choques ${e.choques} (monos ${e.monos})`);
  await sleep(1800);
  await p.screenshot({ path: `${OUT}/phuket-${tag}-5-llegada.png` });
  let ok = true;
  try { await p.waitForSelector('.resultados', { timeout: 12000 }); } catch (err) { ok = false; console.log('  ✗ no aparece .resultados'); }
  await sleep(2200);
  const res = await p.evaluate(() => { const r = document.querySelector('.resultados'); return r ? { estrellas: r.querySelectorAll('.estrella.si').length, titulo: r.querySelector('h2').textContent, texto: r.querySelector('.res-stats').innerText.replace(/\n/g, ' ') } : null; });
  await p.screenshot({ path: `${OUT}/phuket-${tag}-6-resultados.png` });
  if (res) console.log(`  resultados: "${res.titulo}" · ${res.estrellas}★ · ${res.texto}`);
  const media = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
  console.log(`  fps medio ${media.toFixed(1)} · mínimo ${fps.length ? Math.min(...fps).toFixed(1) : '-'}`);

  // escritorio: repetir y comprobar que sale el fantasma
  if (!movil && ok && e.gana) {
    const rep = p.locator('.res-botones button', { hasText: 'Repetir' });
    await rep.click();
    await p.waitForFunction(() => window.__ruta.etapa && window.__ruta.etapa.fase === 'intro', null, { timeout: 20000 }).catch(() => {});
    for (let i = 0; i < 10; i++) { if ((await estado()).fase !== 'intro') break; await p.click('.dlg-saltar', { timeout: 1000 }).catch(() => {}); await sleep(300); }
    await p.waitForFunction(() => window.__ruta.etapa.fase === 'carrera', null, { timeout: 15000 }).catch(() => {});
    await tecla('ShiftLeft', true); await sleep(3500); await tecla('ShiftLeft', false);
    const fantasma = await p.evaluate(() => { let n = 0; window.__ruta.game.current.inst.scene.traverse((o) => { if (o.isMesh && o.material && o.material.opacity === 0.38) n++; }); return n; });
    await p.screenshot({ path: `${OUT}/phuket-${tag}-7-fantasma.png` });
    console.log(`  fantasma en la repetición: ${fantasma > 0 ? '✓' : '✗'} (${fantasma} mallas)`);
    if (!fantasma) ok = false;
  }
  const reales = errores.filter((x) => !/AudioContext|autoplay/i.test(x));
  if (reales.length) { console.log(`  ✗ ERRORES DE CONSOLA (${reales.length}):`); reales.slice(0, 15).forEach((x) => console.log('   -', x.slice(0, 400))); ok = false; }
  else console.log('  sin errores de consola ✓');
  if (giroIzqOk !== true) ok = false;
  await ctx.close();
  if (!ok) fallos++;
  return { ok, e, res };
}

try {
  if (!solo || solo === 'movil') await jugar('movil');
  if (!solo || solo === 'teclado') await jugar('teclado');
} finally {
  await browser.close();
  await server.close();
}
console.log(fallos ? `\n✗ PRUEBA FALLIDA (${fallos})` : '\n✓ PRUEBA SUPERADA');
process.exit(fallos ? 1 : 0);
