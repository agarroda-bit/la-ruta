// Prueba de principio a fin de la ETAPA 4 · MUAY THAI.
//   node pruebas/muaythai.mjs --port 5331 [--solo tactil|teclado|duelo] [--sin-gpu]
// Pasadas:
//   1) tactil  · 390×844 con toques reales (CDP): menú → wai kru a ritmo → combate 1 jugador → resultados
//   2) teclado · 1440×900 con teclado: lo mismo
//   3) duelo   · 390×844, 2 jugadores: wai kru y combate con DOS dedos a la vez → resultados
// Sale con código 1 si alguna pasada no llega a .resultados o hay errores de consola.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => { if (v.startsWith('--')) acc.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']); return acc; }, []));
const port = Number(args.port || 5331);
const OUT = 'pruebas/capturas';
mkdirSync(OUT, { recursive: true });

// Si otra etapa está a medio reescribir (sin index.js), la sustituimos por una "en obras" solo en esta prueba
const obras = {
  name: 'etapas-en-obras',
  resolveId(src, importer) {
    const m = /\.\.\/stages\/([a-z]+)\/index\.js$/.exec(src);
    if (m && importer && !existsSync(resolve(dirname(importer), src))) return '\0obras:' + m[1];
    return null;
  },
  load(id) { if (id.startsWith('\0obras:')) return `export default { id: '${id.slice(7)}', controls: { joystick: false, buttons: [] }, async create() { throw new Error('en obras'); } };`; return null; },
};
const server = await createServer({ plugins: [obras], server: { port, strictPort: false, hmr: false, watch: null }, cacheDir: `node_modules/.vite-prueba-${port}`, logLevel: 'error', clearScreen: false });
await server.listen();
const realPort = server.config.server.port;
const base = `http://localhost:${realPort}/`;
const browser = await chromium.launch(args['sin-gpu']
  ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }
  : { channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[muaythai]', ...a);
const results = [];

async function newPage({ width, height, touch }) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  // partida limpia, con nombres puestos
  await ctx.addInitScript(() => { try { localStorage.setItem('laruta.partida.v1', JSON.stringify({ names: ['Rodri', 'Pau'], namesSet: true })); } catch (e) { /* nada */ } });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e.stack || e)));
  return { ctx, p, cdp, errors };
}

// Gestor de dedos: varios toques a la vez por CDP (Input.dispatchTouchEvent)
function fingers(cdp) {
  const act = new Map(); let nextId = 1;
  const pts = () => [...act.values()].map((f) => ({ x: f.x, y: f.y, id: f.id }));
  return {
    async down(list) { // list: [{x,y,ms}]
      for (const f of list) { const id = nextId++; act.set(id, { ...f, id, until: Date.now() + (f.ms ?? 80) }); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts() });
    },
    async tick() {
      const now = Date.now(); let changed = false;
      for (const [id, f] of act) if (now >= f.until) { act.delete(id); changed = true; }
      if (!changed) return;
      if (act.size) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts() });
      else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async releaseAll() { if (!act.size) return; act.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    get count() { return act.size; },
  };
}

async function btnCenters(p) {
  return p.evaluate(() => {
    const out = {};
    document.querySelectorAll('.controles .btn-tactil').forEach((b) => { const r = b.getBoundingClientRect(); out[b.dataset.id + ':' + b.dataset.player] = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
    return out;
  });
}
// estado de la etapa; en el wai kru, "edad" = ms desde el fotograma que lo escribió
const state = (p) => p.evaluate(() => { const e = window.__ruta && window.__ruta.etapa; if (!e) return null; const o = JSON.parse(JSON.stringify(e)); if (o.waikru) o.waikru.age = performance.now() - o.waikru.at; return o; });
const hasResults = (p) => p.evaluate(() => !!document.querySelector('.resultados'));

async function tapSel(p, sel) {
  const b = await p.locator(sel).first().boundingBox({ timeout: 15000 });
  await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

// ───────── wai kru con toques ─────────
async function waiKruTouch(p, F, players) {
  let shot = false;
  const t0 = Date.now();
  const done = new Set();
  const pending = [];
  const fire = async () => {
    const now = Date.now();
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].at <= now) { const g = pending.splice(i, 1)[0]; await F.down(g.list); }
    await F.tick();
  };
  let busy = false;
  const ticker = setInterval(() => { if (busy) return; busy = true; fire().catch(() => {}).finally(() => { busy = false; }); }, 4);
  while (Date.now() - t0 < 40000) {
    const tq = Date.now();
    const e = await state(p);
    if (!e || e.phase !== 'waikru' || !e.waikru) { if (e && e.phase !== 'waikru' && e.phase !== 'intro' && e.phase !== 'menu') break; await sleep(16); continue; }
    const B = await btnCenters(p);
    const rtt = Date.now() - tq;
    // los símbolos que llegan en <0,4 s se programan a su hora (compensando la latencia)
    const byT = new Map();
    e.waikru.players.forEach((pl, i) => {
      if (i >= players) return;
      for (const n of pl.next) {
        const key = i + ':' + Math.round((e.waikru.clock + n.dt) * 100);
        if (n.dt < 0.4 && n.dt > -0.05 && !done.has(key)) {
          const b = B['l' + n.lane + ':' + i];
          if (!b) continue;
          done.add(key);
          const tk = Math.round((e.waikru.clock + n.dt) * 100);
          if (!byT.has(tk)) byT.set(tk, { at: tq + rtt / 2 + n.dt * 1000 - e.waikru.age - 12, list: [] });
          byT.get(tk).list.push({ x: b.x, y: b.y, ms: 60 });
        }
      }
    });
    for (const g of byT.values()) pending.push(g);
    if (!shot && e.waikru.clock > 9) { shot = true; await p.screenshot({ path: `${OUT}/muaythai-${players === 2 ? 'duelo' : 'wai'}-390.png` }); }
    await sleep(30);
  }
  clearInterval(ticker);
  while (busy) await sleep(5);
  await sleep(100);
  await F.releaseAll();
}

// ───────── combate con toques (1 jugador) ─────────
async function fight1PTouch(p, F) {
  const t0 = Date.now();
  let lastAtk = 0, n = 0, shots = 0, blockUntil = 0;
  while (Date.now() - t0 < 300000) {
    if (await hasResults(p)) return true;
    const e = await state(p);
    await F.tick();
    if (!e || !e.fighters || e.fighters.length < 2 || e.phase !== 'ronda') { await sleep(30); continue; }
    const [me, foe] = e.fighters;
    const B = await btnCenters(p);
    const now = Date.now();
    const incoming = foe.impactIn !== null && foe.impactIn < 0.17 && foe.impactIn > 0;
    if (incoming && now > blockUntil && F.count === 0) {
      if ((foe.action === 'kickBig' || foe.action === 'kneeC') && B['dodge:0']) await F.down([{ ...B['dodge:0'], ms: 70 }]);
      else await F.down([{ ...B['block:0'], ms: 260 }]);
      blockUntil = now + 300;
    } else if (now > blockUntil && F.count === 0 && !foe.tell && (!foe.action || me.crit > 0) && now - lastAtk > 260) {
      const id = me.crit > 0 ? 'kick' : ['punch', 'kick', 'punch', 'knee'][n % 4]; // variar: Somchai lee los golpes repetidos
      if (me.st > 14 || me.crit > 0) { await F.down([{ ...B[id + ':0'], ms: 60 }]); n++; lastAtk = now; }
    }
    if (shots === 0 && me.stats.thrown > 6) { shots++; await p.screenshot({ path: `${OUT}/muaythai-combate-390.png` }); }
    if (shots === 1 && foe.tell) { shots++; await p.screenshot({ path: `${OUT}/muaythai-aviso-390.png` }); }
    await sleep(12);
  }
  return false;
}

// ───────── pasada 1: táctil 390×844 ─────────
async function pasadaTactil() {
  const { ctx, p, cdp, errors } = await newPage({ width: 390, height: 844, touch: true });
  const F = fingers(cdp);
  await p.goto(base + '?etapa=muaythai', { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('.mt-menu', { timeout: 30000 });
  await sleep(1200);
  await p.screenshot({ path: `${OUT}/muaythai-menu-390.png` });
  await tapSel(p, '.mt-menu .boton.uno');
  await p.waitForSelector('.dlg-saltar', { timeout: 15000 });
  await tapSel(p, '.dlg-saltar');
  await waiKruTouch(p, F, 1);
  const e1 = await state(p);
  log('táctil · wai kru precisión', e1.waiPrec[0]);
  const ok = await fight1PTouch(p, F);
  await sleep(1800);
  const e = await state(p);
  await p.screenshot({ path: `${OUT}/muaythai-final-390.png` });
  log('táctil · resultado', JSON.stringify(e && e.result), 'golpes', e && e.fighters[0].stats.landed, 'bloqueos', e && e.fighters[0].stats.blocked);
  results.push({ name: 'táctil 390×844 (1 jugador)', ok: ok && !!(e && e.result) && e1.waiPrec[0] > 0.3, errors: errors.filter(real), extra: e && e.result });
  await ctx.close();
}

// ───────── pasada 2: teclado 1440×900 ─────────
async function pasadaTeclado() {
  const { ctx, p, errors } = await newPage({ width: 1440, height: 900, touch: false });
  await p.goto(base + '?etapa=muaythai', { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('.mt-menu', { timeout: 30000 });
  await sleep(1000);
  await p.keyboard.press('Digit1');
  // diálogo: Enter avanza (cada línea: completar texto + pasar)
  for (let i = 0; i < 30; i++) { if (!(await p.$('.dialogo'))) break; await p.keyboard.press('Enter'); await sleep(90); }
  // wai kru con flechas
  const keys = ['ArrowLeft', 'ArrowDown', 'ArrowRight'];
  const done = new Set(); let shot = false;
  const t0 = Date.now();
  const timersK = [];
  while (Date.now() - t0 < 40000) {
    const tq = Date.now();
    const e = await state(p);
    if (!e) { await sleep(16); continue; }
    if (e.phase !== 'waikru' && e.phase !== 'intro' && e.phase !== 'menu') break;
    const rtt = Date.now() - tq;
    if (e.waikru) for (const n of e.waikru.players[0].next) {
      const key = Math.round((e.waikru.clock + n.dt) * 100);
      if (n.dt < 0.4 && n.dt > -0.05 && !done.has(key)) {
        done.add(key);
        const delay = Math.max(0, tq + rtt / 2 + n.dt * 1000 - e.waikru.age - 12 - Date.now());
        timersK.push(setTimeout(() => { p.keyboard.press(keys[n.lane]).catch(() => {}); }, delay));
      }
    }
    if (!shot && e.waikru && e.waikru.clock > 12) { shot = true; await p.screenshot({ path: `${OUT}/muaythai-wai-1440.png` }); }
    await sleep(30);
  }
  timersK.forEach(clearTimeout);
  const e1 = await state(p);
  log('teclado · wai kru precisión', e1.waiPrec[0]);
  // combate: J puño, K patada, L rodilla, Espacio bloqueo, Shift esquiva
  let lastAtk = 0, n = 0, shots = 0, blockUp = 0, ok = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 300000) {
    if (await hasResults(p)) { ok = true; break; }
    const e = await state(p);
    const now = Date.now();
    if (blockUp && now > blockUp) { await p.keyboard.up('Space'); blockUp = 0; }
    if (!e || !e.fighters || e.fighters.length < 2 || e.phase !== 'ronda') { await sleep(30); continue; }
    const [me, foe] = e.fighters;
    const incoming = foe.impactIn !== null && foe.impactIn < 0.16 && foe.impactIn > 0;
    if (incoming && !blockUp) {
      if (foe.action === 'kickBig' || foe.action === 'kneeC') await p.keyboard.press('ShiftLeft');
      else { await p.keyboard.down('Space'); blockUp = now + 260; }
    } else if (!blockUp && !foe.tell && (!foe.action || me.crit > 0) && now - lastAtk > 250 && (me.st > 14 || me.crit > 0)) {
      const k = me.crit > 0 ? 'KeyK' : ['KeyJ', 'KeyK', 'KeyJ', 'KeyL'][n % 4];
      await p.keyboard.press(k); n++; lastAtk = now;
    }
    if (shots === 0 && me.stats.thrown > 8) { shots++; await p.screenshot({ path: `${OUT}/muaythai-combate-1440.png` }); }
    if (shots === 1 && foe.tell) { shots++; await p.screenshot({ path: `${OUT}/muaythai-aviso-1440.png` }); }
    await sleep(10);
  }
  await sleep(1800);
  const e = await state(p);
  await p.screenshot({ path: `${OUT}/muaythai-final-1440.png` });
  log('teclado · resultado', JSON.stringify(e && e.result), JSON.stringify(e && e.fighters.map((f) => f.stats)));
  results.push({ name: 'teclado 1440×900 (1 jugador)', ok: ok && !!(e && e.result) && e1.waiPrec[0] > 0.3, errors: errors.filter(real), extra: e && e.result });
  await ctx.close();
}

// ───────── pasada 3: dos jugadores en el mismo móvil ─────────
async function pasadaDuelo() {
  const { ctx, p, cdp, errors } = await newPage({ width: 390, height: 844, touch: true });
  const F = fingers(cdp);
  await p.goto(base + '?etapa=muaythai', { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('.mt-menu', { timeout: 30000 });
  await sleep(800);
  await tapSel(p, '.mt-menu .boton.dos');
  await p.waitForSelector('.dlg-saltar', { timeout: 15000 });
  await tapSel(p, '.dlg-saltar');
  await waiKruTouch(p, F, 2);
  const e1 = await state(p);
  log('duelo · wai kru precisión', JSON.stringify(e1.waiPrec));
  // esperar al primer asalto
  for (let i = 0; i < 300; i++) { const e = await state(p); if (e && e.phase === 'ronda') break; await sleep(30); }
  // dos pulgares a la vez: puño de los dos en el mismo instante
  let B = await btnCenters(p);
  const before = (await state(p)).fighters.map((f) => f.stats.thrown);
  await F.down([{ ...B['punch:0'], ms: 90 }, { ...B['punch:1'], ms: 90 }]);
  await sleep(140); await F.tick();
  const after = (await state(p)).fighters.map((f) => f.stats.thrown);
  const simul = after[0] > before[0] && after[1] > before[1];
  log('duelo · dos toques simultáneos', JSON.stringify({ before, after, simul }));
  await sleep(300);
  await p.screenshot({ path: `${OUT}/muaythai-duelo-combate-390.png` });
  // resto del combate: los dos atacan a la vez (a veces bloquean)
  const ids = ['punch', 'punch', 'kick', 'knee', 'punch', 'block'];
  let k = 0, ok = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 300000) {
    if (await hasResults(p)) { ok = true; break; }
    await F.tick();
    const e = await state(p);
    if (!e || e.phase !== 'ronda') { await sleep(40); continue; }
    if (F.count === 0) {
      B = await btnCenters(p);
      const a = ids[k % ids.length], b = ids[(k + 2) % ids.length];
      const list = [];
      if (B[a + ':0']) list.push({ ...B[a + ':0'], ms: a === 'block' ? 200 : 60 });
      if (B[b + ':1']) list.push({ ...B[b + ':1'], ms: b === 'block' ? 200 : 60 });
      if (list.length) await F.down(list);
      k++;
    }
    await sleep(110);
  }
  await sleep(1800);
  const e = await state(p);
  const title = await p.evaluate(() => { const h = document.querySelector('.resultados h2'); return h ? h.textContent : ''; });
  await p.screenshot({ path: `${OUT}/muaythai-duelo-final-390.png` });
  log('duelo · resultado', JSON.stringify(e && e.result), 'título', title);
  results.push({ name: 'duelo 390×844 (2 jugadores, dos dedos)', ok: ok && simul && /Gana|Empate/.test(title) && e1.waiPrec[0] > 0.3 && e1.waiPrec[1] > 0.3, errors: errors.filter(real), extra: { simul, title } });
  await ctx.close();
}

// ───────── pasada 4: machacar PUÑO no debe ganar (Somchai lee el spam) ─────────
async function pasadaSpam() {
  const { ctx, p, cdp, errors } = await newPage({ width: 390, height: 844, touch: true });
  const F = fingers(cdp);
  await p.goto(base + '?etapa=muaythai&mtsalto', { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('.mt-menu', { timeout: 30000 });
  await sleep(800);
  await tapSel(p, '.mt-menu .boton.uno');
  for (let i = 0; i < 300; i++) { const e = await state(p); if (e && e.phase === 'ronda') break; await sleep(30); }
  const B = await btnCenters(p);
  const t0 = Date.now();
  while (Date.now() - t0 < 41000) {
    const e = await state(p);
    if (!e || e.phase !== 'ronda') break;
    await F.down([{ ...B['punch:0'], ms: 60 }]); await sleep(80); await F.tick(); await sleep(220);
  }
  const e = await state(p);
  const [me, foe] = e.fighters;
  log('spam · tras el asalto 1', JSON.stringify({ fase: e.phase, ronda: e.round, yo: me.hp, somchai: foe.hp, golpes: me.stats.landed, contras: foe.stats.perfect }));
  results.push({ name: 'machacar puño no gana en el asalto 1', ok: !foe.ko && foe.hp > 40 && foe.stats.perfect >= 2, errors: errors.filter(real) });
  await ctx.close();
}

function real(e) { return !/AudioContext|autoplay/i.test(e); }

try {
  const solo = args.solo;
  if (!solo || solo === 'tactil') await pasadaTactil();
  if (!solo || solo === 'teclado') await pasadaTeclado();
  if (!solo || solo === 'duelo') await pasadaDuelo();
  if (!solo || solo === 'spam') await pasadaSpam();
} catch (e) {
  console.error(e);
  results.push({ name: 'excepción', ok: false, errors: [String(e.stack || e)] });
}
await browser.close();
await server.close();
let fail = false;
for (const r of results) {
  const okAll = r.ok && !r.errors.length;
  if (!okAll) fail = true;
  console.log(`${okAll ? 'OK  ' : 'FALLO'} · ${r.name}${r.errors.length ? ` · ${r.errors.length} errores de consola` : ''}`);
  for (const er of r.errors.slice(0, 10)) console.log('    -', er.slice(0, 400));
}
process.exit(fail ? 1 : 0);
