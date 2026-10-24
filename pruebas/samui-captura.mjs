// Capturas rápidas de Koh Samui (como herramientas/captura.mjs, con el servidor de pruebas propio).
// node pruebas/samui-captura.mjs --port 5362 [--width 390 --height 844 --touch] [--cpu 4] --shots '[...]'
// shots: eval, log, wait, out, keys [{key,ms}], hold [{key,ms}] (varias teclas a la vez)
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs, startServer, openPage, realErrors } from './samui-comun.mjs';

const args = parseArgs();
const { server, port } = await startServer(Number(args.port || 5362));
const o = await openPage({ port, page: args.page || '?etapa=samui', width: Number(args.width || 1440), height: Number(args.height || 900), touch: !!args.touch, cpu: Number(args.cpu || 0), verbose: !!args.verbose });
const p = o.page;
const shots = JSON.parse(args.shots || '[{"wait":3000,"out":"pruebas/capturas/tmp/samui/c.png"}]');
for (const s of shots) {
  if (s.eval) { try { await p.evaluate(s.eval); } catch (e) { o.errors.push('eval: ' + e.message); } }
  if (s.keys) for (const k of s.keys) { await p.keyboard.down(k.key); await p.waitForTimeout(k.ms ?? 500); await p.keyboard.up(k.key); }
  if (s.hold) { for (const k of s.hold) await p.keyboard.down(k.key); await p.waitForTimeout(Math.max(...s.hold.map((k) => k.ms))); for (const k of s.hold) await p.keyboard.up(k.key); }
  if (s.wait) await p.waitForTimeout(s.wait);
  if (s.log) { try { console.log('[log]', JSON.stringify(await p.evaluate(s.log))); } catch (e) { o.errors.push('log: ' + e.message); } }
  if (s.out) { mkdirSync(dirname(s.out), { recursive: true }); await p.screenshot({ path: s.out }); console.log('Captura:', s.out); }
}
await o.browser.close();
await server.close();
const real = realErrors(o.errors);
if (real.length) { console.log('ERRORES (' + real.length + '):'); for (const e of real.slice(0, 20)) console.log(' -', e.slice(0, 600)); process.exit(1); }
console.log('Sin errores de consola.');
