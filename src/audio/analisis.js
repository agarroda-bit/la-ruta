// Herramientas de revisión (solo pruebas; se carga bajo demanda desde window.__audioDemo).
// Renderiza pistas/efectos/bucles con OfflineAudioContext y mide nivel (LUFS BS.1770 aprox.), pico y coste.
import { PISTAS } from './pistas.js';
import { EFECTOS, LOOPS } from './efectos.js';
import { Secuenciador, validar } from './secuenciador.js';

const SR = 48000;
function ruido(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export async function renderPista(id, secs = 30, { intensity = 0 } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
  const bus = ctx.createGain(); bus.connect(ctx.destination);
  const seq = new Secuenciador(ctx, bus, PISTAS[id], ruido(ctx));
  seq.setIntensity(intensity, true); seq.Is = intensity;
  const a = performance.now(); seq.start(); seq.programar(secs); const tSched = performance.now() - a;
  const b = performance.now(); const buf = await ctx.startRendering(); const tRender = performance.now() - b;
  return { buf, tSched, tRender };
}
export async function renderEfecto(nombre, secs = 2.5, opts = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
  const n = ruido(ctx);
  // OfflineAudioContext arranca en t=0: los efectos usan ctx.currentTime, así que basta con llamarlos
  EFECTOS[nombre](ctx, ctx.destination, { vol: 1, pitch: 1, ...opts }, n);
  return ctx.startRendering();
}
export async function renderLoop(nombre, secs = 4, set = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
  const l = LOOPS[nombre](ctx, ctx.destination, ruido(ctx));
  l.set(set);
  return ctx.startRendering();
}

// ---- medidas ----
function kfiltro(x) { // ponderación K a 48 kHz (BS.1770)
  const y = new Float32Array(x.length);
  const st = (inp, out, b0, b1, b2, a1, a2) => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < inp.length; i++) { const v = b0 * inp[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = inp[i]; y2 = y1; y1 = v; out[i] = v; } };
  st(x, y, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585);
  st(y, y, 1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621);
  return y;
}
export function medir(buf) {
  const chs = [];
  let pico = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pico) pico = v; } chs.push(kfiltro(d)); }
  const blk = Math.floor(0.4 * SR), hop = Math.floor(0.1 * SR), L = [];
  for (let s = 0; s + blk <= chs[0].length; s += hop) {
    let z = 0;
    for (const k of chs) { let acc = 0; for (let i = s; i < s + blk; i++) acc += k[i] * k[i]; z += acc / blk; }
    L.push(z);
  }
  const lu = (z) => -0.691 + 10 * Math.log10(z || 1e-12);
  const abs = L.filter((z) => lu(z) > -70);
  const media = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const rel = lu(media(abs)) - 10;
  const ok = abs.filter((z) => lu(z) > rel);
  return { lufs: +lu(media(ok)).toFixed(1), momMax: +lu(Math.max(...L, 1e-12)).toFixed(1), pico: +(20 * Math.log10(pico || 1e-9)).toFixed(1) };
}

export async function analizar({ secs = 40, pistas = Object.keys(PISTAS), efectos = true, bucles = true } = {}) {
  const r = { pistas: {}, efectos: {}, bucles: {}, avisos: {} };
  for (const id of pistas) {
    const av = validar(PISTAS[id]); if (av.length) r.avisos[id] = av;
    const capas = Object.values(PISTAS[id].inst).some((i) => i.min || i.max || i.iv) || PISTAS[id].accel;
    for (const I of capas ? [0, 1] : [0]) {
      const { buf, tSched, tRender } = await renderPista(id, secs, { intensity: I });
      r.pistas[id + (capas ? '@' + I : '')] = { ...medir(buf), render_ms: Math.round(tRender), sched_ms: Math.round(tSched), xTiempoReal: +(secs * 1000 / tRender).toFixed(1) };
    }
  }
  if (efectos) for (const n of Object.keys(EFECTOS)) { const b = await renderEfecto(n); const m = medir(b); r.efectos[n] = { pico: m.pico, momMax: m.momMax }; }
  if (bucles) for (const n of Object.keys(LOOPS)) { const b = await renderLoop(n, 4, { rate: 0.5, vol: 0.15 }); r.bucles[n] = medir(b); }
  return r;
}

// Reparto de energía por bandas (dB relativos al total): detecta mezclas con demasiado grave o chillonas
export function bandas(buf) {
  const sr = buf.sampleRate, d = buf.getChannelData(0), n = d.length;
  const bq = (tipo, f, q) => { const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q); let b; if (tipo === 'lp') b = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2]; else b = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2]; const a0 = 1 + al; return [b[0] / a0, b[1] / a0, b[2] / a0, -2 * cs / a0, (1 - al) / a0]; };
  const fil = (x, c) => { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
  const e = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return s / x.length; };
  const tot = e(d), cortes = [120, 500, 2000, 6000], out = {};
  let prev = d;
  const nombres = ['<120', '120-500', '500-2k', '2k-6k', '>6k'];
  for (let i = 0; i < cortes.length; i++) { const lo = fil(fil(prev, bq('lp', cortes[i], 0.707)), bq('lp', cortes[i], 0.707)); const hi = new Float32Array(n); for (let k = 0; k < n; k++) hi[k] = prev[k] - lo[k]; out[nombres[i]] = +(10 * Math.log10(e(lo) / tot)).toFixed(1); prev = hi; }
  out['>6k'] = +(10 * Math.log10(e(prev) / tot)).toFixed(1);
  return out;
}

// WAV de 16 bits (por si quieres escucharlo fuera del juego)
export function wav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const datos = []; for (let c = 0; c < ch; c++) datos.push(buf.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, datos[c][i])); v.setInt16(o, s * 32767, true); o += 2; }
  return ab;
}
