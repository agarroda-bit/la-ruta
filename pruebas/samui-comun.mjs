// Utilidades comunes de las pruebas de Koh Samui (servidor de Vite propio + Chromium con GPU real).
// Si otra etapa está a medias (falta su index.js), se sustituye por un módulo "en obras" SOLO en
// el servidor de pruebas, para que el import dinámico de game.js no rompa la página.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const STUB = "export default { id: 'obras', controls: { joystick: false, buttons: [] }, async create() { throw new Error('en obras'); } };";

function stubMissingStages() {
  return {
    name: 'samui-stub-etapas',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !/stages\/[a-z]+\/index\.js$/.test(source)) return null;
      const full = resolve(dirname(importer.split('?')[0]), source);
      if (existsSync(full)) return null;
      return '\0samui-stub:' + source;
    },
    load(id) { return id.startsWith('\0samui-stub:') ? STUB : null; },
  };
}

export const parseArgs = () => Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));

export async function startServer(port) {
  const server = await createServer({ server: { port, strictPort: false, hmr: false, watch: null }, cacheDir: `node_modules/.vite-captura-${port}`, logLevel: 'error', clearScreen: false, plugins: [stubMissingStages()] });
  await server.listen();
  return { server, port: server.config.server.port };
}

export async function openPage({ port, page = '?etapa=samui', width = 390, height = 844, touch = true, cpu = 0, gpu = true, verbose = false }) {
  const browser = await chromium.launch(gpu
    ? { channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }
    : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  if (cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(cpu) });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (verbose && m.type() !== 'debug') console.log('[consola]', m.type(), m.text()); });
  p.on('pageerror', (e) => errors.push(String(e.stack || e)));
  await p.goto(`http://localhost:${port}/${page}`, { waitUntil: 'load', timeout: 120000 });
  // dedos táctiles mantenidos (CDP): fingers = Map id → {x, y}
  const fingers = new Map();
  const list = () => [...fingers.entries()].map(([id, f]) => ({ x: f.x, y: f.y, id }));
  const touchApi = {
    async down(id, x, y) { fingers.set(id, { x, y }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: list() }); },
    async move(id, x, y) { const f = fingers.get(id); if (!f) return; f.x = x; f.y = y; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: list() }); },
    async up(id) { const f = fingers.get(id); if (!f) return; fingers.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: f.x, y: f.y, id }] }); },
    has: (id) => fingers.has(id),
  };
  return { browser, ctx, page: p, cdp, errors, touch: touchApi };
}

export const realErrors = (errors) => errors.filter((e) => !/AudioContext|autoplay/i.test(e));
