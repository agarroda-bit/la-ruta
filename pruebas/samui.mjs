// Prueba de principio a fin de la ETAPA 2 · KOH SAMUI.
//  1. Móvil 390×844 con toques reales (CDP): joystick con un dedo, FRENO y TURBO con otros.
//  2. Escritorio 1440×900 con teclado (flechas, Espacio, Shift).
// En los dos casos el "piloto" de la etapa (window.__ruta.etapa.pilot) dice hacia dónde ir; la
// prueba lo convierte en toques/teclas reales. Debe llegar a .resultados sin errores de consola.
// Uso: node pruebas/samui.mjs --port 5361 [--solo movil|teclado] [--cpu 4] [--capturas]
import { mkdirSync } from 'node:fs';
import { parseArgs, startServer, openPage, realErrors } from './samui-comun.mjs';

const args = parseArgs();
const { server, port } = await startServer(Number(args.port || 5361));
const OUT = 'pruebas/capturas';
mkdirSync(OUT + '/tmp/samui', { recursive: true });
let fallos = 0;
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fallos++; };

async function pasada(modo) {
  const movil = modo === 'movil';
  const W = movil ? 390 : 1440, H = movil ? 844 : 900, tag = movil ? '390' : '1440';
  const o = await openPage({ port, width: W, height: H, touch: movil, cpu: Number(args.cpu || 0) });
  const p = o.page;
  const shot = async (name) => { const f = `${args.capturas ? OUT : OUT + '/tmp/samui'}/samui-${name}-${tag}.png`; await p.screenshot({ path: f }); console.log('  captura', f); };
  try {
    await p.waitForFunction(() => window.__ruta && window.__ruta.etapa && window.__ruta.etapa.id === 'samui', null, { timeout: 60000 });
    await p.waitForSelector('.dialogo', { timeout: 20000 });
    await p.waitForTimeout(600);
    await shot('dialogo');
    // saltar el diálogo con un toque / clic real
    const b = await p.locator('.dlg-saltar').first().boundingBox();
    if (movil) await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await p.waitForFunction(() => window.__ruta.etapa.running, null, { timeout: 15000 });
    ok(true, `${modo}: la carrera empieza`);
    await p.waitForTimeout(1200);
    await shot('inicio');
    const btn = async (id) => { const r = await p.locator(`.btn-tactil[data-id="${id}"]`).boundingBox(); return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; };
    const boostXY = movil ? await btn('boost') : null, brakeXY = null; // FRENO solo en teclado/mando
    if (movil) ok(!!boostXY && !(await p.locator('.btn-tactil[data-id="b"]').count()), 'botón TURBO visible y FRENO fuera de la pantalla táctil');
    const JX = 95, JY = H - 170;
    let giantShot = false, dolShot = false, keySteer = null, keyAcc = 0, braking = false, turboUp = 0, lastCalas = 0, airShot = false, turboShot = false, calaShots = 0, t0 = Date.now();
    let fpsMin = 999, fpsSum = 0, fpsN = 0;
    if (movil) { await o.touch.down(1, JX, JY); await p.waitForTimeout(60); await o.touch.move(1, JX + 1, JY); }
    while (Date.now() - t0 < 300000) {
      const e = await p.evaluate(() => { const e = window.__ruta.etapa; return e ? { ...e.pilot, giant: e.giantDist < 38, dol: e.dolphinsOn, done: e.done, running: e.running, calas: e.calas, air: e.air, turboT: e.turbo, fps: window.__ruta.engine.fps, t: e.t, s: e.s, L: e.L } : null; });
      if (!e || e.done) break;
      if (e.t > 3) { fpsMin = Math.min(fpsMin, e.fps); fpsSum += e.fps; fpsN++; }
      if (movil) {
        await o.touch.move(1, JX + Math.max(-1, Math.min(1, e.steer * 1.3)) * 56, JY);
        if (brakeXY && e.brake && !braking) { braking = true; await o.touch.down(2, ...brakeXY); }
        if (!e.brake && braking) { braking = false; await o.touch.up(2); }
        if (turboUp && Date.now() > turboUp) { turboUp = 0; await o.touch.up(3); }
        else if (e.turbo && !turboUp) { await o.touch.down(3, boostXY[0], boostXY[1]); turboUp = Date.now() + 120; }
      } else {
        // modulación sigma-delta: teclas a pulsos para girar "a medias"
        keyAcc += e.steer;
        let want = null;
        if (keyAcc > 0.5) { want = 'ArrowRight'; keyAcc -= 1; } else if (keyAcc < -0.5) { want = 'ArrowLeft'; keyAcc += 1; }
        keyAcc = Math.max(-1.5, Math.min(1.5, keyAcc));
        if (want !== keySteer) { if (keySteer) await p.keyboard.up(keySteer); if (want) await p.keyboard.down(want); keySteer = want; }
        if (e.brake && !braking) { braking = true; await p.keyboard.down('Space'); }
        if (!e.brake && braking) { braking = false; await p.keyboard.up('Space'); }
        if (e.turbo) { await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(40); await p.keyboard.up('ShiftLeft'); if (!turboShot) { turboShot = true; await p.waitForTimeout(250); await shot('turbo'); } }
      }
      if (e.giant && !giantShot) { giantShot = true; await p.waitForTimeout(100); await shot('gigante'); }
      if (e.dol && !dolShot) { dolShot = true; await p.waitForTimeout(1200); await shot('delfines'); if (args.track) console.log('  delfines', await p.evaluate(() => JSON.stringify([window.__ruta.etapa.dolDbg, Math.round(window.__ruta.etapa.x), Math.round(window.__ruta.etapa.z), Math.round(window.__ruta.etapa.s)]))); }
      if (e.air && !airShot) { airShot = true; await p.waitForTimeout(120); await shot('salto'); }
      if (e.calas > lastCalas) { lastCalas = e.calas; calaShots++; await p.waitForTimeout(700); await shot('cala' + calaShots); }
      await p.waitForTimeout(40);
    }
    if (movil) { await o.touch.up(1); await o.touch.up(2); await o.touch.up(3); } else if (keySteer) await p.keyboard.up(keySteer);
    await p.waitForSelector('.resultados', { timeout: 30000 });
    await p.waitForTimeout(2600);
    await shot('final');
    const r = await p.evaluate(() => { const e = window.__ruta.etapa; return { win: e.win, stars: e.stars, t: e.t, calas: e.calas, olas: e.olas, gates: e.gatesOk + '/' + e.gates, rocas: e.rockHits, barcas: e.boatHits, good: e.goodTime, delfines: e.dolphins, gigante: e.giant, combo: e.combo, hits: JSON.stringify(e.hitLog), track: JSON.stringify(e.track) }; });
    const tr = r.track; delete r.track; if (args.track) { console.log('  recorrido', tr); console.log('  eventos', await p.evaluate(() => JSON.stringify(window.__ruta.etapa.ev))); }
    ok(true, `${modo}: resultados visibles · ${JSON.stringify(r)}`);
    ok(r.win, `${modo}: etapa ganada (${r.stars} estrellas)`);
    if (fpsN) console.log(`  fps medios ${(fpsSum / fpsN).toFixed(1)}, mínimo ${fpsMin.toFixed(1)}`);
    // repetir: ahora corre el fantasma de la vuelta anterior
    if (!movil) {
      await p.locator('.resultados .boton', { hasText: 'Repetir' }).first().click();
      await p.waitForSelector('.dialogo', { timeout: 20000 });
      await p.waitForTimeout(500);
      await p.locator('.dlg-saltar').first().click();
      await p.waitForFunction(() => window.__ruta.etapa && window.__ruta.etapa.running, null, { timeout: 15000 });
      await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(60); await p.keyboard.up('ShiftLeft');
      await p.waitForTimeout(3500);
      const g = await p.evaluate(() => !!window.__ruta.game.current.ctx.ghost.data);
      ok(g, 'teclado: al repetir sale el fantasma de la mejor vuelta');
      await shot('fantasma');
    }
  } catch (err) {
    ok(false, `${modo}: excepción ${err.message}`);
    await shot('error').catch(() => {});
  }
  const real = realErrors(o.errors);
  ok(real.length === 0, `${modo}: consola sin errores` + (real.length ? ': ' + real.slice(0, 5).join(' | ') : ''));
  await o.browser.close();
}

if (args.solo !== 'teclado') await pasada('movil');
if (args.solo !== 'movil') await pasada('teclado');
await server.close();
console.log(fallos ? `FALLOS: ${fallos}` : 'TODO OK');
process.exit(fallos ? 1 : 0);
