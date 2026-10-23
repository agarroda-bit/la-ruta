// Efectos de sonido y bucles 100 % sintetizados.
//   EFECTOS[nombre](ctx, out, { vol, pitch }, noise)  → suena una vez (todo planificado con el reloj de audio)
//   LOOPS[nombre](ctx, out, noise) → { set({ rate, vol }), stop() }
//     rate 0..1 (puede pasar de 1), vol ≈ 0.1-0.3 normal (por defecto 0.15), 1 = muy fuerte.
// Niveles: cada efecto está calibrado para un pico de ≈ -6 dBFS con vol 1 (los de interfaz, más bajos).
import { muestra, calentar, PROTEGIDAS } from './muestras.js';

// ---------------- utilidades ----------------
const G = (c, v, out) => { const g = c.createGain(); g.gain.value = v; if (out) g.connect(out); return g; };
function F(c, type, f, q, out) { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q; if (out) n.connect(out); return n; }
// envolvente: sube en a, cae exponencial durante d
function env(param, t, a, peak, d) {
  param.setValueAtTime(0.0001, t);
  if (a > 0) param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); else param.setValueAtTime(peak, t);
  param.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function osc(c, type, f, t, dur, out) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(out); o.start(t); o.stop(t + dur + 0.05); return o; }
function nz(c, noise, t, dur, out) { const s = c.createBufferSource(); s.buffer = noise; s.loop = true; s.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; }
// tono con envolvente
function tono(c, out, t, { f, f2, type = 'sine', a = 0.003, d = 0.15, v = 0.3, glide }) {
  const g = G(c, 0, out); env(g.gain, t, a, v, d);
  const o = osc(c, type, f, t, a + d, g);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (glide || a + d));
  return o;
}
// ruido filtrado con envolvente; sweep opcional [f0, f1]
function soplo(c, out, noise, t, { type = 'bandpass', f = 1000, f2, q = 1, a = 0.003, d = 0.2, v = 0.3, glide }) {
  const g = G(c, 0, out); env(g.gain, t, a, v, d);
  const fl = F(c, type, f, q, g);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + (glide || a + d));
  nz(c, noise, t, a + d, fl);
  return fl;
}
function buf(c, out, b, t, v = 1, rate = 1) {
  if (!b) return;
  const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  const g = G(c, v, out); s.connect(g); s.start(t); return s;
}
// eco corto (espacio) creado al vuelo para efectos grandes
function eco(c, out, t, dur, { time = 0.13, fb = 0.35, lp = 2500, v = 0.5 } = {}) {
  const i = G(c, 1), d = c.createDelay(1), f = F(c, 'lowpass', lp), g = G(c, fb), o = G(c, v, out);
  d.delayTime.value = time; i.connect(d); d.connect(f).connect(g).connect(d); f.connect(o);
  setTimeout(() => { try { i.disconnect(); o.disconnect(); g.disconnect(); } catch (e) { /* */ } }, (t - c.currentTime + dur + 2) * 1000);
  return i;
}
const SEMI = (n) => Math.pow(2, n / 12);

// ---------------- efectos ----------------
export const EFECTOS = {
  // interfaz
  click: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; tono(c, out, t, { f: 1900 * p, f2: 1200 * p, type: 'triangle', d: 0.035, v: 0.22 * v }); soplo(c, out, n, t, { type: 'highpass', f: 5000, d: 0.012, v: 0.08 * v }); },
  'swoosh-ui': (c, out, o, n) => { const t = c.currentTime; soplo(c, out, n, t, { f: 700 * o.pitch, f2: 3200 * o.pitch, q: 1.6, a: 0.05, d: 0.12, v: 0.16 * o.vol }); },
  error: (c, out, o) => { const t = c.currentTime, v = o.vol, p = o.pitch; for (const k of [0, 0.13]) { const lp = F(c, 'lowpass', 1400, 1, out); tono(c, lp, t + k, { f: 165 * p, type: 'square', a: 0.005, d: 0.1, v: 0.22 * v }); tono(c, lp, t + k, { f: 175 * p, type: 'sawtooth', a: 0.005, d: 0.1, v: 0.12 * v }); } },
  unlock: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; [72, 76, 79, 84, 88].forEach((m, i) => buf(c, out, muestra(c, 'campana', m), t + i * 0.06, 0.18 * v, p)); soplo(c, out, n, t, { type: 'highpass', f: 3000, f2: 9000, a: 0.15, d: 0.5, v: 0.06 * v }); tono(c, out, t + 0.3, { f: 523 * p, type: 'triangle', a: 0.02, d: 0.6, v: 0.12 * v }); },
  countdown: (c, out, o) => { const t = c.currentTime; const lp = F(c, 'lowpass', 3500, 0.7, out); tono(c, lp, t, { f: 880 * o.pitch, type: 'square', a: 0.004, d: 0.14, v: 0.2 * o.vol }); tono(c, out, t, { f: 1760 * o.pitch, a: 0.004, d: 0.1, v: 0.08 * o.vol }); },
  go: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; const lp = F(c, 'lowpass', 4000, 0.7, out); for (const f of [880, 1109, 1319, 1760]) tono(c, lp, t, { f: f * p, type: 'square', a: 0.004, d: 0.45, v: 0.07 * v }); soplo(c, out, n, t, { f: 1500, f2: 6000, a: 0.01, d: 0.3, v: 0.08 * v }); },

  // monedas y premios
  coin: (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; const lp = F(c, 'lowpass', 6000, 0.7, out); tono(c, lp, t, { f: 988 * p, type: 'square', a: 0.002, d: 0.06, v: 0.13 * v }); tono(c, lp, t + 0.06, { f: 1319 * p, type: 'square', a: 0.002, d: 0.22, v: 0.13 * v }); tono(c, out, t + 0.06, { f: 2638 * p, a: 0.002, d: 0.15, v: 0.05 * v }); },
  'coin-combo': (c, out, o) => { // pitch sube con el combo: pásale 1, 1.12, 1.25...
    const t = c.currentTime, p = o.pitch, v = o.vol; const lp = F(c, 'lowpass', 7000, 0.7, out);
    [0, 4, 7].forEach((s, i) => tono(c, lp, t + i * 0.045, { f: 784 * p * SEMI(s), type: i === 2 ? 'square' : 'triangle', a: 0.002, d: i === 2 ? 0.25 : 0.07, v: 0.14 * v }));
    buf(c, out, muestra(c, 'campana', 91), t + 0.09, 0.1 * v, p);
  },
  cash: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { f: 3000, q: 3, d: 0.03, v: 0.25 * v }); tono(c, out, t + 0.02, { f: 180, f2: 90, d: 0.06, v: 0.2 * v });
    buf(c, out, muestra(c, 'campana', 96), t + 0.08, 0.2 * v, p); buf(c, out, muestra(c, 'campana', 100), t + 0.15, 0.18 * v, p);
    for (let i = 0; i < 6; i++) tono(c, out, t + 0.1 + Math.random() * 0.25, { f: (3000 + Math.random() * 3000) * p, d: 0.05, v: 0.04 * v }); },
  pickup: (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; tono(c, out, t, { f: 420 * p, f2: 1250 * p, type: 'triangle', a: 0.004, d: 0.13, v: 0.22 * v, glide: 0.1 }); tono(c, out, t + 0.03, { f: 840 * p, f2: 2500 * p, a: 0.004, d: 0.1, v: 0.07 * v, glide: 0.08 }); },
  star: (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; tono(c, out, t, { f: 660 * p, f2: 1320 * p, type: 'triangle', a: 0.005, d: 0.3, v: 0.18 * v, glide: 0.12 });
    [84, 88, 91].forEach((m, i) => buf(c, out, muestra(c, 'campana', m), t + 0.06 + i * 0.05, 0.12 * v, p)); },
  sticker: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { f: 2500, f2: 6000, q: 2, d: 0.08, v: 0.1 * v });
    tono(c, out, t + 0.08, { f: 380 * p, f2: 950 * p, a: 0.003, d: 0.09, v: 0.25 * v, glide: 0.05 });
    [79, 83, 86, 91].forEach((m, i) => buf(c, out, muestra(c, 'campana', m), t + 0.14 + i * 0.06, 0.12 * v, p)); },
  ding: (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; buf(c, out, muestra(c, 'khong', 88), t, 0.32 * v, p); buf(c, out, muestra(c, 'campana', 95), t + 0.09, 0.16 * v, p); },
  bell: (c, out, o) => { const t = c.currentTime; buf(c, out, muestra(c, 'campana', 86), t, 0.35 * o.vol, o.pitch); },
  photo: (c, out, o, n) => { const t = c.currentTime, v = o.vol; soplo(c, out, n, t, { type: 'highpass', f: 3500, d: 0.02, v: 0.35 * v }); tono(c, out, t, { f: 1200, f2: 600, d: 0.02, v: 0.1 * v });
    soplo(c, out, n, t + 0.07, { type: 'bandpass', f: 2500, q: 2, d: 0.035, v: 0.3 * v }); soplo(c, out, n, t + 0.1, { f: 900, f2: 1500, q: 4, a: 0.02, d: 0.12, v: 0.05 * v }); },
  win: (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; const lp = F(c, 'lowpass', 5000, 0.7, out);
    [60, 64, 67, 72].forEach((m, i) => { const f = 440 * SEMI(m - 69) * p; tono(c, lp, t + i * 0.1, { f, type: 'square', a: 0.004, d: 0.14, v: 0.09 * v }); tono(c, lp, t + i * 0.1, { f: f * 2, type: 'triangle', a: 0.004, d: 0.12, v: 0.06 * v }); });
    for (const m of [72, 76, 79, 84]) { const o2 = tono(c, lp, t + 0.42, { f: 440 * SEMI(m - 69) * p, type: 'sawtooth', a: 0.02, d: 0.9, v: 0.045 * v }); const l = c.createOscillator(), lg = G(c, 12); l.frequency.value = 5.5; l.connect(lg).connect(o2.detune); l.start(t + 0.5); l.stop(t + 1.4); }
    buf(c, out, muestra(c, 'ching', 0), t + 0.42, 0.25 * v); },
  lose: (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; const lp = F(c, 'lowpass', 1200, 2, out);
    [67, 66, 65].forEach((m, i) => tono(c, lp, t + i * 0.28, { f: 440 * SEMI(m - 69) * p, type: 'sawtooth', a: 0.02, d: 0.24, v: 0.22 * v }));
    const last = tono(c, lp, t + 0.84, { f: 440 * SEMI(64 - 69) * p, type: 'sawtooth', a: 0.02, d: 0.8, v: 0.22 * v }); const l = c.createOscillator(), lg = G(c, 30); l.frequency.value = 6; l.connect(lg).connect(last.detune); l.start(t + 0.9); l.stop(t + 1.7); },
  firework: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol;
    tono(c, out, t, { f: 900 * p, f2: 2800 * p, a: 0.01, d: 0.28, v: 0.05 * v, glide: 0.28 });
    const b = t + 0.3; soplo(c, out, n, b, { type: 'lowpass', f: 900, f2: 200, a: 0.004, d: 0.7, v: 0.55 * v }); tono(c, out, b, { f: 110, f2: 40, d: 0.4, v: 0.4 * v });
    for (let i = 0; i < 14; i++) soplo(c, out, n, b + 0.15 + Math.random() * 0.7, { type: 'highpass', f: 3000 + Math.random() * 4000, d: 0.015, v: (0.1 + Math.random() * 0.12) * v }); },
  gong: (c, out, o) => { const t = c.currentTime; buf(c, out, muestra(c, 'gong', 40), t, 0.55 * o.vol, o.pitch); buf(c, out, muestra(c, 'tamtam', 0), t, 0.18 * o.vol, o.pitch); },

  // movimiento
  whoosh: (c, out, o, n) => { const t = c.currentTime, p = o.pitch; const f = soplo(c, out, n, t, { f: 400 * p, f2: 2200 * p, q: 2, a: 0.12, d: 0.22, v: 0.4 * o.vol, glide: 0.14 }); f.frequency.exponentialRampToValueAtTime(600 * p, t + 0.34); },
  boost: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { f: 600 * p, f2: 4200 * p, q: 1.4, a: 0.05, d: 0.5, v: 0.35 * v, glide: 0.4 });
    const lp = F(c, 'lowpass', 2000, 2, out); tono(c, lp, t, { f: 110 * p, f2: 440 * p, type: 'sawtooth', a: 0.04, d: 0.45, v: 0.2 * v, glide: 0.4 }); },
  'wave-jump': (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { type: 'lowpass', f: 600 * p, f2: 3500 * p, q: 0.8, a: 0.05, d: 0.3, v: 0.32 * v, glide: 0.2 });
    for (let i = 0; i < 4; i++) tono(c, out, t + 0.05 + Math.random() * 0.2, { f: (500 + Math.random() * 600) * p, f2: (1200 + Math.random() * 800) * p, d: 0.05, v: 0.05 * v }); },
  splash: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { type: 'lowpass', f: 3500 * p, f2: 400 * p, q: 0.7, a: 0.005, d: 0.6, v: 0.5 * v, glide: 0.5 }); tono(c, out, t, { f: 120, f2: 50, d: 0.15, v: 0.25 * v });
    for (let i = 0; i < 7; i++) tono(c, out, t + 0.08 + Math.random() * 0.45, { f: (300 + Math.random() * 600) * p, f2: (900 + Math.random() * 900) * p, d: 0.04, v: 0.06 * v }); },
  drift: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; const bp = F(c, 'bandpass', 1800 * p, 9, out); const g = G(c, 0, bp); env(g.gain, t, 0.04, 0.6 * v, 0.45);
    nz(c, n, t, 0.5, g); const s = tono(c, F(c, 'bandpass', 1500 * p, 4, out), t, { f: 920 * p, f2: 760 * p, type: 'sawtooth', a: 0.04, d: 0.45, v: 0.06 * v }); const l = c.createOscillator(), lg = G(c, 40); l.frequency.value = 23; l.connect(lg).connect(s.detune); l.start(t); l.stop(t + 0.55); },
  skid: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { f: 2200 * p, f2: 900 * p, q: 7, a: 0.02, d: 0.8, v: 0.55 * v });
    soplo(c, out, n, t, { type: 'lowpass', f: 700, d: 0.7, v: 0.2 * v }); },
  crash: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { type: 'lowpass', f: 1400 * p, f2: 300, q: 0.7, a: 0.003, d: 0.6, v: 0.6 * v }); tono(c, out, t, { f: 95 * p, f2: 38, d: 0.3, v: 0.5 * v });
    for (const f of [420, 610, 890]) tono(c, F(c, 'bandpass', f * 2 * p, 3, out), t + 0.01, { f: f * p, type: 'square', d: 0.25, v: 0.12 * v });
    for (let i = 0; i < 6; i++) tono(c, out, t + 0.05 + Math.random() * 0.35, { f: (3000 + Math.random() * 4000) * p, d: 0.06, v: 0.05 * v }); },
  hit: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { type: 'lowpass', f: 2200 * p, d: 0.1, v: 0.45 * v }); tono(c, out, t, { f: 150 * p, f2: 50, d: 0.15, v: 0.55 * v }); },

  // combate
  punch: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { f: 1300 * p, q: 1.2, d: 0.06, v: 0.5 * v }); soplo(c, out, n, t, { type: 'highpass', f: 3500, d: 0.02, v: 0.25 * v }); tono(c, out, t, { f: 120 * p, f2: 55, d: 0.13, v: 0.6 * v }); },
  kick: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { f: 600 * p, f2: 2400 * p, q: 2, a: 0.06, d: 0.05, v: 0.22 * v });
    const h = t + 0.1; soplo(c, out, n, h, { type: 'lowpass', f: 1800 * p, d: 0.12, v: 0.5 * v }); tono(c, out, h, { f: 95 * p, f2: 42, d: 0.2, v: 0.7 * v }); soplo(c, out, n, h, { type: 'highpass', f: 3000, d: 0.025, v: 0.25 * v }); },
  block: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; soplo(c, out, n, t, { type: 'lowpass', f: 600 * p, d: 0.09, v: 0.5 * v }); tono(c, out, t, { f: 220 * p, f2: 160 * p, type: 'triangle', d: 0.07, v: 0.3 * v }); buf(c, out, muestra(c, 'klongt', 0), t, 0.3 * v, p); },
  ko: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; const e = eco(c, out, t, 1.5, { time: 0.16, fb: 0.4, v: 0.4 });
    buf(c, out, muestra(c, 'boom', 0), t, 0.7 * v, p); soplo(c, out, n, t, { type: 'lowpass', f: 2500, f2: 300, d: 0.5, v: 0.5 * v }); soplo(c, e, n, t, { type: 'lowpass', f: 2500, d: 0.2, v: 0.4 * v });
    buf(c, out, muestra(c, 'gong', 43), t + 0.05, 0.4 * v, p); buf(c, e, muestra(c, 'chap', 0), t + 0.05, 0.3 * v); },

  // público
  'crowd-cheer': (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol, D = 1.8;
    const g = G(c, 0, out); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.25); g.gain.setTargetAtTime(0.0001, t + 0.6, 0.45);
    const src = nz(c, n, t, D + 0.5, G(c, 1));
    for (const [f, q, a] of [[520, 3, 1], [1050, 3, 0.8], [1750, 4, 0.55], [2700, 5, 0.35]]) { const bp = F(c, 'bandpass', f * p, q); const ga = G(c, a * 1.4, g); src.connect(bp).connect(ga);
      const l = c.createOscillator(), lg = G(c, a * 0.5); l.frequency.value = 3 + Math.random() * 5; l.connect(lg).connect(ga.gain); l.start(t); l.stop(t + D + 0.5); }
    for (let i = 0; i < 3; i++) { const s = t + 0.1 + Math.random() * 0.6; tono(c, out, s, { f: 2000 * p, f2: 3000 * p, a: 0.05, d: 0.35, v: 0.04 * v, glide: 0.2 }); }
    for (let i = 0; i < 12; i++) soplo(c, out, n, t + Math.random() * 1.2, { f: 1300 + Math.random() * 800, q: 1.5, d: 0.03, v: 0.08 * v }); },
  'crowd-ooh': (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol, D = 1.3;
    const g = G(c, 0, out); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.3); g.gain.setTargetAtTime(0.0001, t + 0.7, 0.25);
    const f1 = F(c, 'bandpass', 430, 3), f2 = F(c, 'bandpass', 820, 4), sum = G(c, 1, g); f1.connect(sum); f2.connect(G(c, 0.6, sum));
    for (const [f, d] of [[170, -12], [205, 8], [245, -5], [290, 14], [330, 0]]) { const os = osc(c, 'sawtooth', f * p, t, D, f1); os.connect(f2); os.detune.value = d; os.frequency.setValueAtTime(f * p * 1.06, t); os.frequency.exponentialRampToValueAtTime(f * p * 0.92, t + 0.5); os.frequency.exponentialRampToValueAtTime(f * p * 0.97, t + D); } },

  // vehículos y animales
  horn: (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; const lp = F(c, 'lowpass', 2200, 1, out);
    for (const f of [415, 523]) { const s = tono(c, lp, t, { f: f * p, type: 'square', a: 0.01, d: 0.32, v: 0.14 * v }); s.frequency.setValueAtTime(f * p, t + 0.25); s.frequency.linearRampToValueAtTime(f * p * 0.97, t + 0.33); } },
  'bike-horn': (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; const bp = F(c, 'bandpass', 1100, 2, out); // bocina de pera: "¡mec!"
    const s = tono(c, bp, t, { f: 380 * p, type: 'sawtooth', a: 0.01, d: 0.18, v: 0.6 * v }); s.frequency.linearRampToValueAtTime(470 * p, t + 0.04); s.frequency.linearRampToValueAtTime(400 * p, t + 0.18); },
  'tuk-horn': (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; const bp = F(c, 'bandpass', 1300, 3, out); // "mic-mic" agudo y nasal
    for (const k of [0, 0.15]) { tono(c, bp, t + k, { f: 620 * p, type: 'square', a: 0.005, d: 0.1, v: 0.35 * v }); tono(c, bp, t + k, { f: 745 * p, type: 'square', a: 0.005, d: 0.1, v: 0.25 * v }); } },
  'boat-horn': (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol, e = eco(c, out, t, 1.6, { time: 0.22, fb: 0.35, lp: 900, v: 0.5 }); const lp = F(c, 'lowpass', 650, 1.5, out); lp.connect(e);
    for (const [f, ty] of [[110, 'sawtooth'], [111.5, 'square'], [55, 'sine']]) { const g = G(c, 0, lp); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28 * v, t + 0.12); g.gain.setValueAtTime(0.28 * v, t + 1.0); g.gain.linearRampToValueAtTime(0, t + 1.3); osc(c, ty, f * p, t, 1.3, g); } },
  'train-horn': (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol, e = eco(c, out, t, 1.4, { time: 0.18, fb: 0.3, lp: 1500, v: 0.4 }); const lp = F(c, 'lowpass', 1600, 1, out); lp.connect(e);
    for (const f of [311, 370, 466]) { const g = G(c, 0, lp); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11 * v, t + 0.06); g.gain.setValueAtTime(0.11 * v, t + 0.8); g.gain.linearRampToValueAtTime(0, t + 1.0); osc(c, 'sawtooth', f * p, t, 1.0, g); } },
  monkey: (c, out, o) => { const t = c.currentTime, p = o.pitch, v = o.vol; // "uh-uh-aa-aa"
    const f1 = F(c, 'bandpass', 900, 3, out), f2 = F(c, 'bandpass', 1700, 4, out);
    [[480, 650, 0], [500, 700, 0.11], [700, 1050, 0.24], [720, 1100, 0.36]].forEach(([a, b, k]) => { const g = G(c, 0); g.connect(f1); g.connect(f2); env(g.gain, t + k, 0.015, 0.7 * v, 0.08);
      const s = osc(c, 'sawtooth', a * p, t + k, 0.1, g); s.frequency.exponentialRampToValueAtTime(b * p, t + k + 0.06); }); },
  dog: (c, out, o, n) => { const t = c.currentTime, p = o.pitch, v = o.vol; const f1 = F(c, 'bandpass', 650, 2, out), f2 = F(c, 'bandpass', 1300, 3, out);
    const g = G(c, 0); g.connect(f1); g.connect(f2); env(g.gain, t, 0.01, 0.9 * v, 0.16);
    const s = osc(c, 'sawtooth', 330 * p, t, 0.18, g); s.frequency.exponentialRampToValueAtTime(190 * p, t + 0.16);
    soplo(c, out, n, t, { f: 900, q: 1, d: 0.1, v: 0.15 * v }); },
  'rain-drop': (c, out, o) => { const t = c.currentTime, p = o.pitch * (0.8 + Math.random() * 0.5), v = o.vol; tono(c, out, t, { f: 1400 * p, f2: 500 * p, a: 0.001, d: 0.05, v: 0.2 * v, glide: 0.03 }); },
};

// Calibración de nivel (medida offline con analisis.js: momentáneo máx. ≈ -30 interfaz, -20/-24 golpes, -12/-15 grandes momentos)
const NIVEL = {
  click: 1.5, 'swoosh-ui': 4, whoosh: 2, 'wave-jump': 2, boost: 1.4, drift: 2.5, skid: 1.8, 'tuk-horn': 2.2, 'bike-horn': 1.6, 'rain-drop': 1.4,
  'boat-horn': 0.4, 'crowd-ooh': 0.5, ko: 0.6, gong: 0.8, ding: 0.85, 'train-horn': 0.8, punch: 0.8, kick: 0.8, dog: 0.8,
};
for (const [k, m] of Object.entries(NIVEL)) { const f = EFECTOS[k]; EFECTOS[k] = (c, out, o, n) => f(c, out, { ...o, vol: o.vol * m }, n); }

// Muestras que usan los efectos: se generan en segundo plano al desbloquear el audio
export function precalentarEfectos(ctx) {
  const lista = [['campana', 86], ['khong', 88], ['campana', 95], ['campana', 91], ['ching', 0], ['chap', 0], ['klongt', 0], ['boom', 0], ['gong', 40], ['gong', 43], ['tamtam', 0],
    ...[72, 76, 79, 83, 84, 86, 88, 96, 100].map((m) => ['campana', m])];
  for (const [t, n] of lista) PROTEGIDAS.add(t + ':' + n);
  calentar(ctx, lista, 4, 80);
}

// ---------------- bucles ----------------
// base: todos los bucles devuelven set/stop y se calibran para que vol 0.15 ≈ presencia normal
function bucle(c, out, build, defaults = { rate: 0.5, vol: 0.15 }) {
  const master = G(c, 0, out), nodos = [], timers = [];
  const api = build(master, nodos, timers);
  let vivo = true;
  const set = (o = {}) => {
    if (!vivo) return;
    const rate = Math.max(0, Math.min(2, o.rate ?? api.rate ?? defaults.rate));
    const vol = Math.max(0, Math.min(1.5, o.vol ?? api.vol ?? defaults.vol));
    api.rate = rate; api.vol = vol;
    master.gain.setTargetAtTime(vol * (api.k || 1), c.currentTime, 0.06);
    api.set && api.set(rate, vol);
  };
  set(defaults);
  return {
    set,
    stop() {
      if (!vivo) return; vivo = false;
      const t = c.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(0, t, 0.05);
      for (const x of timers) clearInterval(x);
      setTimeout(() => { for (const n of nodos) { try { n.stop(); } catch (e) { /* */ } } try { master.disconnect(); } catch (e) { /* */ } }, 400);
    },
  };
}
const lfo = (c, nodos, f, depth, param, type = 'sine') => { const l = c.createOscillator(); l.type = type; l.frequency.value = f; const g = G(c, depth); l.connect(g).connect(param); l.start(); nodos.push(l); return { l, g }; };
const fuente = (c, nodos, type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); nodos.push(o); return o; };
const ruidoLoop = (c, nodos, noise) => { const s = c.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, Math.random() * 1.5); nodos.push(s); return s; };
const shaper = (c, k = 2) => { const w = c.createWaveShaper(), n = 256, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(k * x) / Math.tanh(k); } w.curve = cv; return w; };

// motor con explosiones: oscilador de "combustión" + modulación de amplitud a ritmo de pistón
function motor(c, out, noise, { f0, f1, cut0, cut1, wave = 'sawtooth', sub = 0.5, am = 0.5, ruidoV = 0.15, k = 1, q = 2, drive = 2 }) {
  return bucle(c, out, (m, nodos) => {
    const sh = shaper(c, drive), lp = F(c, 'lowpass', cut0, q), amG = G(c, 1 - am * 0.5);
    sh.connect(lp).connect(amG).connect(m);
    const a = fuente(c, nodos, wave, f0), b = fuente(c, nodos, 'square', f0 / 2);
    a.connect(G(c, 0.6, sh)); b.connect(G(c, sub * 0.5, sh));
    const pist = fuente(c, nodos, 'sine', f0 / 2); const pg = G(c, am * 0.5); pist.connect(pg).connect(amG.gain);
    const nzs = ruidoLoop(c, nodos, noise), nf = F(c, 'bandpass', 400, 0.8), ng = G(c, ruidoV); nzs.connect(nf).connect(ng).connect(amG);
    return { k, set(rate) { const now = c.currentTime, f = f0 + (f1 - f0) * rate;
      a.frequency.setTargetAtTime(f, now, 0.06); b.frequency.setTargetAtTime(f / 2, now, 0.06); pist.frequency.setTargetAtTime(f / 2, now, 0.06);
      lp.frequency.setTargetAtTime(cut0 + (cut1 - cut0) * Math.min(1.5, rate), now, 0.08); nf.frequency.setTargetAtTime(300 + 900 * rate, now, 0.1); } };
  });
}

export const LOOPS = {
  engine: (c, out, n) => motor(c, out, n, { f0: 48, f1: 190, cut0: 500, cut1: 2400, k: 0.9 }),
  car: (c, out, n) => motor(c, out, n, { f0: 40, f1: 170, cut0: 420, cut1: 1800, sub: 0.7, am: 0.25, ruidoV: 0.08, k: 0.9, q: 1.2, drive: 1.5 }),
  scooter: (c, out, n) => motor(c, out, n, { f0: 95, f1: 340, cut0: 900, cut1: 3500, wave: 'square', sub: 0.3, am: 0.7, ruidoV: 0.2, k: 0.55, q: 3, drive: 3 }),
  tuktuk: (c, out, n) => bucle(c, out, (m, nodos) => { // "pat-pat-pat" de dos tiempos
    const lp = F(c, 'lowpass', 380, 3), sh = shaper(c, 4), amG = G(c, 0);
    sh.connect(lp).connect(amG).connect(m);
    const a = fuente(c, nodos, 'sawtooth', 70); a.connect(G(c, 0.6, sh));
    const nzs = ruidoLoop(c, nodos, n), nf = F(c, 'bandpass', 700, 1.5); nzs.connect(nf).connect(G(c, 0.5, sh));
    const pulso = fuente(c, nodos, 'square', 22), pg = G(c, 0.5); pulso.connect(pg).connect(amG.gain); amG.gain.value = 0.5;
    const rattle = fuente(c, nodos, 'square', 9), rg = G(c, 0.12); rattle.connect(rg).connect(amG.gain);
    return { k: 0.8, set(rate) { const now = c.currentTime; pulso.frequency.setTargetAtTime(16 + 34 * rate, now, 0.08); a.frequency.setTargetAtTime(60 + 80 * rate, now, 0.08); lp.frequency.setTargetAtTime(320 + 700 * rate, now, 0.1); } };
  }),
  boat: (c, out, n) => bucle(c, out, (m, nodos) => { // motor de cola larga + agua
    const lp = F(c, 'lowpass', 450, 2), sh = shaper(c, 3), amG = G(c, 0.7); sh.connect(lp).connect(amG).connect(m);
    const a = fuente(c, nodos, 'sawtooth', 45); a.connect(G(c, 0.6, sh)); const b = fuente(c, nodos, 'square', 22.6); b.connect(G(c, 0.3, sh));
    const p = fuente(c, nodos, 'sine', 11); p.connect(G(c, 0.3)).connect(amG.gain);
    const w = ruidoLoop(c, nodos, n), wf = F(c, 'lowpass', 900, 0.5), wg = G(c, 0.35); w.connect(wf).connect(wg).connect(m); lfo(c, nodos, 0.3, 0.15, wg.gain);
    return { k: 0.8, set(rate) { const now = c.currentTime; a.frequency.setTargetAtTime(40 + 70 * rate, now, 0.1); b.frequency.setTargetAtTime(20 + 35 * rate, now, 0.1); p.frequency.setTargetAtTime(10 + 18 * rate, now, 0.1);
      lp.frequency.setTargetAtTime(380 + 900 * rate, now, 0.1); wf.frequency.setTargetAtTime(600 + 1400 * rate, now, 0.2); } };
  }),
  train: (c, out, n) => bucle(c, out, (m, nodos) => { // maglev: zumbido + silbido que suben con rate, viento
    const hum = G(c, 0.5, m), lp = F(c, 'lowpass', 1200, 0.7, hum);
    const h1 = fuente(c, nodos, 'triangle', 90), h2 = fuente(c, nodos, 'sine', 180), h3 = fuente(c, nodos, 'sine', 271);
    h1.connect(G(c, 0.6, lp)); h2.connect(G(c, 0.3, lp)); h3.connect(G(c, 0.12, lp));
    const wh = fuente(c, nodos, 'sine', 1800), whg = G(c, 0.02, m); wh.connect(whg); lfo(c, nodos, 0.4, 6, wh.detune);
    const w = ruidoLoop(c, nodos, n), wf = F(c, 'bandpass', 600, 0.6), wg = G(c, 0.2, m); w.connect(wf).connect(wg);
    return { set(rate) { const now = c.currentTime, r = Math.min(1.5, rate);
      h1.frequency.setTargetAtTime(70 + 300 * r, now, 0.15); h2.frequency.setTargetAtTime(140 + 600 * r, now, 0.15); h3.frequency.setTargetAtTime(211 + 900 * r, now, 0.15);
      wh.frequency.setTargetAtTime(1500 + 3200 * r, now, 0.2); whg.gain.setTargetAtTime(0.01 + 0.05 * r, now, 0.2);
      wf.frequency.setTargetAtTime(500 + 2500 * r, now, 0.2); wg.gain.setTargetAtTime(0.08 + 0.6 * r, now, 0.2); }, k: 1.4 };
  }),
  rain: (c, out, n) => bucle(c, out, (m, nodos, timers) => {
    const s = ruidoLoop(c, nodos, n), hp = F(c, 'highpass', 1200, 0.5), lp = F(c, 'lowpass', 8000, 0.5); s.connect(hp).connect(lp).connect(G(c, 0.7, m));
    const s2 = ruidoLoop(c, nodos, n), lp2 = F(c, 'lowpass', 500, 0.5); s2.connect(lp2).connect(G(c, 0.35, m));
    const api = { k: 0.6, set(rate) { lp.frequency.setTargetAtTime(5000 + 5000 * rate, c.currentTime, 0.2); } };
    timers.push(setInterval(() => { if (c.state !== 'running') return; const t = c.currentTime; for (let i = 0; i < 3 + 6 * (api.rate || 0.5); i++) { const f = 1800 + Math.random() * 2500; tono(c, m, t + Math.random() * 0.2, { f, f2: f * 0.5, a: 0.001, d: 0.03, v: 0.05 + Math.random() * 0.06, glide: 0.02 }); } }, 200));
    return api;
  }),
  waves: (c, out, n) => bucle(c, out, (m, nodos) => { // dos capas de olas desfasadas (sin temporizadores)
    const r = {};
    for (const [fr, ph, cut] of [[0.11, 0, 900], [0.075, 0.5, 1400]]) {
      const s = ruidoLoop(c, nodos, n), lp = F(c, 'lowpass', cut, 0.4), g = G(c, 0.35); s.connect(lp).connect(g).connect(m);
      lfo(c, nodos, fr, 0.33, g.gain); lfo(c, nodos, fr, cut * 0.6, lp.frequency);
      r[ph] = lp;
    }
    return { k: 1.4, set(rate) { /* rate = mar más bravo */ r[0].Q.value = 0.4 + rate * 0.3; } };
  }),
  crowd: (c, out, n) => bucle(c, out, (m, nodos, timers) => { // murmullo que se enciende con vol (público que reacciona)
    const s = ruidoLoop(c, nodos, n), sum = G(c, 1, m), bands = [];
    for (const [f, q, a] of [[480, 2.5, 1], [1000, 3, 0.7], [1700, 3.5, 0.45], [2600, 4, 0.25]]) {
      const bp = F(c, 'bandpass', f, q), g = G(c, a); s.connect(bp).connect(g).connect(sum); lfo(c, nodos, 0.5 + Math.random() * 2, a * 0.25, g.gain); bands.push([bp, f, g, a]);
    }
    const api = { k: 1.9, set(rate, vol) { const e = Math.min(1, vol * 2.5); const now = c.currentTime; // más fuerte = más brillante (gritos)
      for (const [bp, f, g, a] of bands) { bp.frequency.setTargetAtTime(f * (1 + 0.35 * e), now, 0.2); if (f > 1500) g.gain.setTargetAtTime(a * (0.4 + e), now, 0.2); } } };
    timers.push(setInterval(() => { if (c.state !== 'running' || (api.vol || 0) < 0.25) return; const t = c.currentTime; // silbidos y palmas sueltas cuando se anima
      if (Math.random() < 0.35) tono(c, m, t + Math.random() * 0.3, { f: 1900 + Math.random() * 600, f2: 2800, a: 0.04, d: 0.25, v: 0.05, glide: 0.15 });
      for (let i = 0; i < 4; i++) soplo(c, m, n, t + Math.random() * 0.4, { f: 1400 + Math.random() * 600, q: 1.5, d: 0.025, v: 0.08 }); }, 400));
    return api;
  }),
  wind: (c, out, n) => bucle(c, out, (m, nodos) => {
    const s = ruidoLoop(c, nodos, n), bp = F(c, 'bandpass', 600, 1.4), g = G(c, 0.7); s.connect(bp).connect(g).connect(m);
    lfo(c, nodos, 0.07, 280, bp.frequency); lfo(c, nodos, 0.13, 0.3, g.gain);
    const s2 = ruidoLoop(c, nodos, n), bp2 = F(c, 'bandpass', 1500, 4), g2 = G(c, 0.15); s2.connect(bp2).connect(g2).connect(m); lfo(c, nodos, 0.05, 500, bp2.frequency);
    return { k: 1.6, set(rate) { const now = c.currentTime; bp.frequency.setTargetAtTime(450 + 700 * rate, now, 0.3); bp2.frequency.setTargetAtTime(1200 + 1500 * rate, now, 0.3); } };
  }),
  night: (c, out, n) => bucle(c, out, (m, nodos, timers) => { // grillos + ciudad lejana
    for (const [f, rate, chirp, pan] of [[4300, 32, 1.1, -0.5], [4750, 27, 0.8, 0.5]]) {
      const car = fuente(c, nodos, 'sine', f), g1 = G(c, 0), g2 = G(c, 0), p = c.createStereoPanner(); p.pan.value = pan;
      car.connect(g1).connect(g2).connect(p).connect(m);
      lfo(c, nodos, rate, 0.5, g1.gain, 'square'); g1.gain.value = 0.5;
      const sh = shaper(c, 6), l = fuente(c, nodos, 'sine', chirp), lg = G(c, 1); l.connect(lg).connect(sh); const sg = G(c, 0.06); sh.connect(sg).connect(g2.gain); g2.gain.value = 0.06;
    }
    const city = ruidoLoop(c, nodos, n), lp = F(c, 'lowpass', 280, 0.6), cg = G(c, 0.5); city.connect(lp).connect(cg).connect(m); lfo(c, nodos, 0.05, 0.15, cg.gain);
    timers.push(setInterval(() => { if (c.state !== 'running' || Math.random() > 0.15) return; const t = c.currentTime, lp2 = F(c, 'lowpass', 900, 1, m); // bocina lejana
      tono(c, lp2, t, { f: 380 + Math.random() * 120, type: 'square', a: 0.02, d: 0.3, v: 0.025 }); }, 1500));
    return { k: 2.4 };
  }),
  market: (c, out, n) => bucle(c, out, (m, nodos, timers) => { // murmullo de mercado: charla + cacharros
    const s = ruidoLoop(c, nodos, n), sum = G(c, 1, m);
    for (const [f, q, a, sil] of [[500, 3, 1, 4.1], [900, 4, 0.7, 5.3], [1400, 4, 0.5, 3.4], [2200, 5, 0.25, 6.2]]) {
      const bp = F(c, 'bandpass', f, q), g = G(c, a * 0.6); s.connect(bp).connect(g).connect(sum); lfo(c, nodos, sil, a * 0.45, g.gain); lfo(c, nodos, 0.2 + Math.random() * 0.3, f * 0.15, bp.frequency);
    }
    timers.push(setInterval(() => { if (c.state !== 'running') return; const t = c.currentTime;
      if (Math.random() < 0.5) tono(c, m, t + Math.random() * 0.3, { f: 2000 + Math.random() * 2500, a: 0.001, d: 0.12, v: 0.03 }); // cacharro
      if (Math.random() < 0.12) { const bp = F(c, 'bandpass', 1000, 3, m), f = 220 + Math.random() * 150, o2 = tono(c, bp, t, { f, type: 'sawtooth', a: 0.05, d: 0.5, v: 0.05 }); o2.frequency.linearRampToValueAtTime(f * 1.25, t + 0.15); o2.frequency.linearRampToValueAtTime(f * 0.9, t + 0.5); } // pregón lejano
    }, 500));
    return { k: 2.3 };
  }),
};
