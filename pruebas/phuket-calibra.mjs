// Calibración de dificultad (solo para ajustar el límite de sol): piloto automático DENTRO de la
// página, sin latencia. No sustituye a pruebas/phuket.mjs (que usa toques y teclas reales).
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const port = 5314;
const server = await createServer({ server: { port, hmr: false, watch: null }, cacheDir: `node_modules/.vite-phuket-${port}`, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`http://localhost:${server.config.server.port}/?etapa=phuket`);
await p.waitForFunction(() => window.__ruta?.etapa?.fase === 'intro', null, { timeout: 60000 });
await p.waitForTimeout(800);
await p.click('.dlg-saltar');
const nivel = process.argv[2] || 'bueno';
await p.evaluate((nivel) => {
  const inp = window.__ruta.input;
  const set = (code, on) => { if (on && !inp.keys.has(code)) { inp.keys.add(code); inp._keysToButtons(code, true); } else if (!on && inp.keys.has(code)) { inp.keys.delete(code); inp._keysToButtons(code, false); } };
  const loop = () => {
    const e = window.__ruta.etapa;
    if (e && e.fase === 'carrera') {
      const cands = [-4.3, -3, -1.5, 0, 1.5, 3, 4.3]; let best = e.d, bc = 1e9, peligro = false;
      for (const c of cands) {
        let cost = Math.abs(c - e.d) * 0.12;
        for (const h of e.ahead) { const ds = h.s - e.s; if (ds < -1 || ds > 34) continue; const band = (h.t === 'mono' ? 3.2 : h.t === 'gallina' ? 2.4 : 0.9) + (h.r || 0.8); if (Math.abs(c - h.d) < band) cost += 12 * (1 - ds / 40); if (ds < 22 && Math.abs(e.d - h.d) < band) peligro = true; }
        if (nivel === 'bueno') for (const k of e.cocosAhead) { const ds = k.s - e.s; if (ds > 30 || k.y > 1.6) continue; if (Math.abs(c - k.d) < 1) cost -= 1.4 * (1 - ds / 34); }
        if (cost < bc) { bc = cost; best = c; }
      }
      const st = (best - e.d) * 0.55 - e.rel * 1.2;
      set('ArrowRight', st > 0.25); set('ArrowLeft', st < -0.25);
      set('ShiftLeft', nivel === 'bueno' ? e.turbo > 0.2 && !peligro : e.turbo > 0.99);
    }
    if (!e || !e.terminado) requestAnimationFrame(loop);
  };
  loop();
}, nivel);
await p.waitForFunction(() => window.__ruta.etapa.terminado, null, { timeout: 240000 });
console.log(nivel, JSON.stringify((({ t, restante, cocos, totalCocos, choques, gana }) => ({ t, restante, cocos, totalCocos, choques, gana }))(await p.evaluate(() => window.__ruta.etapa))));
await browser.close(); await server.close();
