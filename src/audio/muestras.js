// Muestras sintetizadas UNA vez (en JS, sin archivos) y guardadas en AudioBuffers.
// Reproducir un AudioBuffer es lo más barato que hay en WebAudio (1 nodo por golpe),
// así que todo lo percusivo o punteado (batería, phin, guzheng, ranat, khong wong,
// ching, campanillas, gong...) sale de aquí. Lo sostenido (bajo, pads, lead, pi java,
// erhu) se toca en vivo en el secuenciador porque necesita vibrato y filtros.
//
//   muestra(ctx, 'kick')            → AudioBuffer (caché por contexto)
//   muestra(ctx, 'phin', 64)        → nota MIDI 64 del phin (Karplus-Strong)
//
// Las notas tonales se generan a la mitad de la frecuencia de muestreo del contexto
// (24 kHz en un iPhone) para gastar la mitad de memoria; todas caben en ~5-10 MB.

const TAU = Math.PI * 2;
const caches = new WeakMap();

export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function muestra(ctx, tipo, nota = 0) {
  let c = caches.get(ctx);
  if (!c) { c = new Map(); caches.set(ctx, c); }
  const key = tipo + ':' + nota;
  let b = c.get(key);
  if (!b) {
    const gen = GEN[tipo];
    if (!gen) return null;
    b = gen(ctx, nota);
    c.set(key, b);
  }
  return b;
}
export const hayMuestra = (tipo) => !!GEN[tipo];
// Bytes que ocupan las muestras generadas en este contexto
export function memoria(ctx) {
  const c = caches.get(ctx), tipos = {}; let n = 0, k = 0;
  if (c) for (const [key, b] of c) { const by = b.length * b.numberOfChannels * 4, t = key.split(':')[0]; n += by; k++; tipos[t] = +((tipos[t] || 0) + by / 1048576).toFixed(2); }
  return { muestras: k, MB: +(n / 1048576).toFixed(1), tipos };
}
// Suelta las muestras tonales que la pista nueva no usa (se regeneran si vuelven a hacer falta)
const LIBERABLES = new Set(['phin', 'guzheng', 'ranat', 'steel', 'arp', 'keys', 'khong', 'campana']);
export const PROTEGIDAS = new Set(); // las que usan los efectos: no se sueltan nunca
export function liberar(ctx, necesarias) {
  const c = caches.get(ctx); if (!c) return;
  for (const k of [...c.keys()]) if (LIBERABLES.has(k.split(':')[0]) && !necesarias.has(k) && !PROTEGIDAS.has(k)) c.delete(k);
}
export const tieneMuestra = (ctx, tipo, nota = 0) => { const c = caches.get(ctx); return !!(c && c.has(tipo + ':' + nota)); };
// Genera una lista de muestras en rodajas de ≤ presupuesto ms (sin tirones en el hilo principal)
export function calentar(ctx, lista, presupuesto = 4, pausa = 60) {
  let i = 0;
  const paso = () => {
    const a = performance.now();
    while (i < lista.length && performance.now() - a < presupuesto) { const [t, n] = lista[i++]; muestra(ctx, t, n); }
    if (i < lista.length) setTimeout(paso, pausa);
  };
  setTimeout(paso, pausa);
}

// ---------- utilidades de síntesis "a mano" ----------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}
function nuevo(ctx, secs, sr) {
  const n = Math.max(32, Math.ceil(secs * sr));
  const b = ctx.createBuffer(1, n, sr);
  return [b, b.getChannelData(0), sr];
}
function finales(d, sr, fadeIn = 0.0008, fadeOut = 0.03) {
  const a = Math.max(1, Math.floor(fadeIn * sr)), z = Math.max(1, Math.floor(fadeOut * sr)), n = d.length;
  for (let i = 0; i < a && i < n; i++) d[i] *= i / a;
  for (let i = 0; i < z && i < n; i++) d[n - 1 - i] *= i / z;
}
function normaliza(d, pico = 0.9) {
  let m = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > m) m = v; }
  if (m > 0) { const k = pico / m; for (let i = 0; i < d.length; i++) d[i] *= k; }
}
// Biquad RBJ en JS (para filtrar al generar, no en tiempo real)
function biquad(tipo, f, q, sr, db = 0) {
  const w = TAU * Math.min(f, sr * 0.49) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), A = Math.pow(10, db / 40);
  let b0, b1, b2, a0, a1, a2;
  if (tipo === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (tipo === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (tipo === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; } // peaking
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function filtra(d, c) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const [b0, b1, b2, a1, a2] = c;
  for (let i = 0; i < d.length; i++) {
    const x = d[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
  }
  return d;
}
function ruido(n, seed, f) { const r = rng(seed); const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = r(); if (f) for (const c of f) filtra(a, c); return a; }

// Suma parciales senoidales que decaen (osciladores recursivos: sin Math.sin por muestra)
// parts: [{ f, a, tau, d? (desafinado para batido) }]
function aditivo(d, sr, parts, desde = 0) {
  const n = d.length;
  for (const p of parts) {
    if (p.f <= 0 || p.f >= sr * 0.45) continue;
    const w = TAU * p.f / sr, c = 2 * Math.cos(w), k = Math.exp(-1 / (p.tau * sr));
    let y1 = Math.sin(-w), y2 = Math.sin(-2 * w), env = p.a;
    for (let i = desde; i < n; i++) {
      const y = c * y1 - y2; y2 = y1; y1 = y;
      d[i] += y * env; env *= k;
      if (env < 1e-5) break;
    }
  }
}

// ---------- batería (a la frecuencia del contexto) ----------
function kick(ctx) {
  const [b, d, sr] = nuevo(ctx, 0.5, ctx.sampleRate);
  const r = rng(7); let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const f = 44 + 120 * Math.exp(-t / 0.028) + 60 * Math.exp(-t / 0.004);
    ph += TAU * f / sr;
    const amp = Math.exp(-t / 0.15) * Math.min(1, t / 0.0015);
    const click = t < 0.003 ? r() * 0.5 * (1 - t / 0.003) : 0;
    d[i] = Math.tanh(1.8 * Math.sin(ph) * amp) + click;
  }
  finales(d, sr, 0.0005, 0.06); normaliza(d, 0.95); return b;
}
function snare(ctx) {
  const [b, d, sr] = nuevo(ctx, 0.36, ctx.sampleRate);
  const nz = ruido(d.length, 11, [biquad('hp', 1400, 0.7, sr), biquad('pk', 4200, 1, sr, 4)]);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    p1 += TAU * (185 + 40 * Math.exp(-t / 0.01)) / sr; p2 += TAU * 330 / sr;
    const tono = Math.sin(p1) * Math.exp(-t / 0.05) * 0.8 + Math.sin(p2) * Math.exp(-t / 0.025) * 0.35;
    d[i] = Math.tanh(1.4 * (tono + nz[i] * Math.exp(-t / 0.085) * 1.1));
  }
  finales(d, sr); normaliza(d, 0.9); return b;
}
function clap(ctx) {
  const [b, d, sr] = nuevo(ctx, 0.4, ctx.sampleRate);
  const nz = ruido(d.length, 13, [biquad('bp', 1150, 1.1, sr), biquad('hp', 600, 0.7, sr)]);
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    let e = 0;
    for (const o of [0, 0.010, 0.021]) if (t >= o) e = Math.max(e, Math.exp(-(t - o) / 0.0045));
    if (t >= 0.03) e = Math.max(e, 0.75 * Math.exp(-(t - 0.03) / 0.09));
    d[i] = nz[i] * e;
  }
  finales(d, sr); normaliza(d, 0.9); return b;
}
function metal(n, sr, base = 1, seed = 3) { // 6 cuadradas inarmónicas tipo 808
  const fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * base);
  const a = new Float32Array(n), ph = fr.map(() => 0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < 6; k++) { ph[k] += fr[k] / sr; s += (ph[k] % 1) < 0.5 ? 1 : -1; }
    a[i] = s / 6;
  }
  const nz = ruido(n, seed);
  for (let i = 0; i < n; i++) a[i] = a[i] * 0.7 + nz[i] * 0.5;
  return a;
}
function hat(ctx, abierto) {
  const sr = ctx.sampleRate, secs = abierto ? 0.5 : 0.09;
  const [b, d] = nuevo(ctx, secs, sr);
  const m = metal(d.length, sr, 1.6, abierto ? 17 : 19);
  filtra(m, biquad('hp', 7200, 0.8, sr)); filtra(m, biquad('hp', 7200, 0.8, sr)); filtra(m, biquad('pk', 10000, 1, sr, 3));
  const tau = abierto ? 0.16 : 0.018;
  for (let i = 0; i < d.length; i++) d[i] = m[i] * Math.exp(-i / sr / tau);
  finales(d, sr, 0.0005, abierto ? 0.08 : 0.02); normaliza(d, 0.8); return b;
}
function shaker(ctx) {
  const [b, d, sr] = nuevo(ctx, 0.11, ctx.sampleRate);
  const nz = ruido(d.length, 23, [biquad('bp', 6500, 0.9, sr), biquad('hp', 3500, 0.7, sr)]);
  for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = nz[i] * Math.min(1, t / 0.014) * Math.exp(-Math.max(0, t - 0.014) / 0.028); }
  finales(d, sr); normaliza(d, 0.75); return b;
}
function rim(ctx) {
  const [b, d, sr] = nuevo(ctx, 0.06, ctx.sampleRate);
  const nz = ruido(d.length, 29, [biquad('bp', 2600, 2, sr)]);
  aditivo(d, sr, [{ f: 1720, a: 0.8, tau: 0.008 }, { f: 820, a: 0.5, tau: 0.012 }]);
  for (let i = 0; i < d.length; i++) d[i] += nz[i] * Math.exp(-i / sr / 0.004) * 0.8;
  finales(d, sr); normaliza(d, 0.8); return b;
}
function crash(ctx) {
  const sr = ctx.sampleRate / 2; // 24 kHz basta para un plato en el altavoz de un móvil
  const [b, d] = nuevo(ctx, 1.8, sr);
  const m = metal(d.length, sr, 2.3, 31);
  filtra(m, biquad('hp', 3800, 0.7, sr)); filtra(m, biquad('pk', 7000, 0.8, sr, 5));
  for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = m[i] * Math.exp(-t / 0.55) * Math.min(1, t / 0.002); }
  finales(d, sr, 0.0005, 0.2); normaliza(d, 0.8); return b;
}
function tom(ctx, f, tau, secs = 0.7, ruidoA = 0.25) {
  const [b, d, sr] = nuevo(ctx, secs, ctx.sampleRate);
  const nz = ruido(d.length, 37, [biquad('lp', f * 6, 0.7, sr)]);
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    ph += TAU * f * (1 + 0.6 * Math.exp(-t / 0.035)) / sr;
    d[i] = Math.tanh(1.3 * Math.sin(ph) * Math.exp(-t / tau)) + nz[i] * Math.exp(-t / 0.03) * ruidoA;
  }
  finales(d, sr, 0.0005, 0.08); normaliza(d, 0.9); return b;
}
// Tambores tailandeses (klong / glong khaek): d = golpe grave, t = medio, k = palmada seca
function klong(ctx, cual) {
  const [b, d, sr] = nuevo(ctx, cual === 'd' ? 0.5 : 0.18, ctx.sampleRate);
  if (cual === 'd') {
    const nz = ruido(d.length, 41, [biquad('lp', 500, 0.7, sr)]); let ph = 0;
    for (let i = 0; i < d.length; i++) { const t = i / sr; ph += TAU * (92 + 30 * Math.exp(-t / 0.02) - 6 * (1 - Math.exp(-t / 0.15))) / sr; d[i] = Math.sin(ph) * Math.exp(-t / 0.17) + nz[i] * Math.exp(-t / 0.02) * 0.6; }
  } else if (cual === 't') {
    const nz = ruido(d.length, 43, [biquad('bp', 1200, 1.5, sr)]);
    aditivo(d, sr, [{ f: 265, a: 1, tau: 0.06 }, { f: 590, a: 0.35, tau: 0.03 }]);
    for (let i = 0; i < d.length; i++) d[i] += nz[i] * Math.exp(-i / sr / 0.01) * 0.6;
  } else {
    const nz = ruido(d.length, 47, [biquad('bp', 950, 2.2, sr), biquad('pk', 3000, 1, sr, 5)]);
    aditivo(d, sr, [{ f: 430, a: 0.6, tau: 0.025 }]);
    for (let i = 0; i < d.length; i++) d[i] += nz[i] * Math.exp(-i / sr / 0.022) * 1.4;
  }
  finales(d, sr, 0.0005, 0.03); normaliza(d, 0.9); return b;
}
// Ching (platillos pequeños): 'x' = ching abierto, 'o' = chap cerrado
const CHING_P = [2093, 2361, 3150, 3527, 4710, 5430, 6612, 7940];
function ching(ctx, cerrado) {
  const sr = ctx.sampleRate;
  const [b, d] = nuevo(ctx, cerrado ? 0.14 : 1.3, sr);
  aditivo(d, sr, CHING_P.map((f, i) => ({ f, a: 1 / (1 + i * 0.35), tau: cerrado ? 0.03 : 0.55 - i * 0.045 })));
  aditivo(d, sr, CHING_P.slice(0, 4).map((f, i) => ({ f: f * 1.0045, a: 0.5 / (1 + i), tau: cerrado ? 0.03 : 0.5 })));
  const nz = ruido(d.length, 53, [biquad('hp', 4500, 0.7, sr)]);
  for (let i = 0; i < d.length; i++) d[i] += nz[i] * Math.exp(-i / sr / (cerrado ? 0.018 : 0.004)) * (cerrado ? 1.2 : 0.8);
  finales(d, sr, 0.0003, cerrado ? 0.02 : 0.15); normaliza(d, 0.8); return b;
}
// Gong grave (khong mong): golpe de mazo blando, zumbido que sube un pelín
function gong(ctx, nota) {
  const sr = ctx.sampleRate / 2, f = hz(nota || 40);
  const [b, d] = nuevo(ctx, 3.8, sr);
  const parts = [[1, 1, 3.2], [2.0, 0.42, 2.2], [2.93, 0.3, 1.5], [4.12, 0.2, 1.0], [5.3, 0.12, 0.7], [6.7, 0.07, 0.5]];
  // fundamental con subida de tono (shimmer)
  let ph = 0, ph2 = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    ph += TAU * f * (1 + 0.012 * (1 - Math.exp(-t / 0.3))) / sr; ph2 += TAU * f * 1.006 / sr;
    d[i] = (Math.sin(ph) + 0.4 * Math.sin(ph2)) * Math.exp(-t / 3.2);
  }
  aditivo(d, sr, parts.slice(1).map(([r, a, tau]) => ({ f: f * r, a, tau })));
  const nz = ruido(d.length, 59, [biquad('lp', 900, 0.7, sr)]);
  for (let i = 0; i < d.length; i++) d[i] = d[i] * Math.min(1, i / sr / 0.012) + nz[i] * Math.exp(-i / sr / 0.03) * 0.5;
  finales(d, sr, 0.001, 0.4); normaliza(d, 0.85); return b;
}
// Tam-tam chino: crece (swell) y luego se apaga largo
function tamtam(ctx) {
  const sr = ctx.sampleRate / 2;
  const [b, d] = nuevo(ctx, 3.2, sr);
  const capas = [190, 420, 760, 1500].map((f, i) => filtra(ruido(d.length, 61 + i), biquad('bp', f, 7, sr)));
  for (let i = 0; i < d.length; i++) {
    const t = i / sr; let s = 0;
    for (let k = 0; k < capas.length; k++) s += capas[k][i] * (k < 2 ? 1 : 0.7);
    d[i] = s * Math.min(1, 0.25 + t / 0.35) * Math.exp(-t / 1.2);
  }
  aditivo(d, sr, [{ f: 98, a: 0.6, tau: 1.8 }, { f: 147, a: 0.3, tau: 1.2 }]);
  finales(d, sr, 0.001, 0.5); normaliza(d, 0.8); return b;
}
// Impacto grave cinematográfico
function boom(ctx) {
  const sr = ctx.sampleRate / 2;
  const [b, d] = nuevo(ctx, 2.2, sr);
  const nz = ruido(d.length, 67, [biquad('lp', 300, 0.7, sr)]); let ph = 0;
  for (let i = 0; i < d.length; i++) { const t = i / sr; ph += TAU * (32 + 60 * Math.exp(-t / 0.12)) / sr; d[i] = Math.tanh(1.5 * Math.sin(ph) * Math.exp(-t / 0.7)) + nz[i] * Math.exp(-t / 0.25) * 0.7; }
  finales(d, sr, 0.0008, 0.3); normaliza(d, 0.9); return b;
}

// ---------- instrumentos tonales (a media frecuencia) ----------
// Karplus-Strong con retardo fraccional (paso todo) → afinación exacta en notas agudas
function cuerda(ctx, nota, { t60 = 1.4, brillo = 0.7, pos = 0.18, secs = 1.6, cuerpo = [], seed = 71, doble = 0 }) {
  const sr = ctx.sampleRate / 2, f = hz(nota);
  const [b, d] = nuevo(ctx, secs, sr);
  const toca = (fr, amp, sd) => {
    const P = sr / fr, Lt = P - 0.5, L = Math.max(2, Math.floor(Lt - 0.1)), dfr = Lt - L, C = (1 - dfr) / (1 + dfr);
    const dl = new Float32Array(L);
    // excitación: ruido suavizado + peine (posición de la púa)
    const r = rng(sd); let lp = 0; const a = 1 - brillo * 0.85;
    for (let i = 0; i < L; i++) { lp += (r() - lp) * (1 - a); dl[i] = lp; }
    const pk = Math.max(1, Math.floor(L * pos)), ex = Float32Array.from(dl);
    for (let i = 0; i < L; i++) dl[i] = ex[i] - 0.9 * ex[(i + pk) % L];
    const g = Math.exp(Math.log(0.001) * P / (sr * t60));
    let idx = 0, prev = 0, x1 = 0, y1 = 0;
    for (let n = 0; n < d.length; n++) {
      const out = dl[idx];
      const avg = 0.5 * (out + prev) * g; prev = out;
      const ap = C * avg + x1 - C * y1; x1 = avg; y1 = ap;
      dl[idx] = ap; idx++; if (idx >= L) idx = 0;
      d[n] += out * amp;
    }
  };
  toca(f, 1, seed + nota);
  if (doble) toca(f * (1 + doble), 0.6, seed + nota + 99); // 2ª cuerda casi al unísono (phin de 2 cuerdas)
  for (const [ff, q, db] of cuerpo) filtra(d, biquad('pk', ff, q, sr, db));
  filtra(d, biquad('hp', 70, 0.7, sr));
  finales(d, sr, 0.0004, 0.12); normaliza(d, 0.85); return b;
}
function ranat(ctx, nota) { // xilófono tailandés: madera dura, parcial 3.9×, golpe de mazo
  const sr = ctx.sampleRate / 2, f = hz(nota);
  const [b, d] = nuevo(ctx, 0.75, sr);
  aditivo(d, sr, [{ f, a: 1, tau: 0.3 }, { f: f * 1.003, a: 0.25, tau: 0.25 }, { f: f * 3.93, a: 0.38, tau: 0.08 }, { f: f * 9.1, a: 0.12, tau: 0.025 }]);
  const nz = ruido(d.length, 73, [biquad('bp', 2400, 1.2, sr)]);
  for (let i = 0; i < d.length; i++) d[i] += nz[i] * Math.exp(-i / sr / 0.003) * 0.5;
  finales(d, sr, 0.0003, 0.08); normaliza(d, 0.85); return b;
}
function khong(ctx, nota) { // khong wong: gong pequeño afinado, brillante con zumbido
  const sr = ctx.sampleRate / 2, f = hz(nota);
  const [b, d] = nuevo(ctx, 1.8, sr);
  aditivo(d, sr, [{ f, a: 1, tau: 1.2 }, { f: f * 1.0042, a: 0.4, tau: 1.0 }, { f: f * 2.0, a: 0.4, tau: 0.6 }, { f: f * 3.01, a: 0.28, tau: 0.35 }, { f: f * 4.16, a: 0.14, tau: 0.2 }, { f: f * 5.43, a: 0.08, tau: 0.12 }]);
  const nz = ruido(d.length, 79, [biquad('lp', 3000, 0.7, sr)]);
  for (let i = 0; i < d.length; i++) d[i] = d[i] * Math.min(1, i / sr / 0.002) + nz[i] * Math.exp(-i / sr / 0.004) * 0.35;
  finales(d, sr, 0.0003, 0.2); normaliza(d, 0.85); return b;
}
function campana(ctx, nota) { // campanillas
  const sr = ctx.sampleRate / 2, f = hz(nota);
  const [b, d] = nuevo(ctx, 1.25, sr);
  aditivo(d, sr, [{ f, a: 1, tau: 0.8 }, { f: f * 1.002, a: 0.3, tau: 1.3 }, { f: f * 2.76, a: 0.45, tau: 0.7 }, { f: f * 5.4, a: 0.2, tau: 0.35 }, { f: f * 8.93, a: 0.1, tau: 0.2 }]);
  finales(d, sr, 0.0008, 0.2); normaliza(d, 0.8); return b;
}
function steel(ctx, nota) { // steel drum tropical
  const sr = ctx.sampleRate / 2, f = hz(nota);
  const [b, d] = nuevo(ctx, 1.2, sr);
  aditivo(d, sr, [{ f, a: 1, tau: 0.6 }, { f: f * 2.0, a: 0.7, tau: 0.35 }, { f: f * 3.0, a: 0.3, tau: 0.22 }, { f: f * 4.02, a: 0.15, tau: 0.12 }, { f: f * 1.5, a: 0.1, tau: 0.2 }]);
  for (let i = 0; i < d.length; i++) d[i] *= Math.min(1, i / sr / 0.004);
  finales(d, sr, 0.0003, 0.1); normaliza(d, 0.85); return b;
}
function pluckSynth(ctx, nota) { // arpegiador: sierra cuyo brillo se cierra (como un filtro con envolvente)
  const sr = ctx.sampleRate / 2, f = hz(nota);
  const [b, d] = nuevo(ctx, 0.7, sr);
  const parts = [];
  for (let k = 1; k <= 40; k++) { if (f * k > sr * 0.45) break; parts.push({ f: f * k * (k === 2 ? 1.001 : 1), a: 1 / k, tau: 0.4 / (1 + 0.32 * (k - 1)) }); }
  aditivo(d, sr, parts);
  for (let i = 0; i < d.length; i++) d[i] *= Math.min(1, i / sr / 0.002);
  finales(d, sr, 0.0003, 0.1); normaliza(d, 0.8); return b;
}
function keys(ctx, nota) { // piano eléctrico suave (inarmonicidad + dos cuerdas)
  const sr = ctx.sampleRate / 2, f = hz(nota);
  const [b, d] = nuevo(ctx, 2.1, sr);
  const parts = [], B = 0.0003;
  for (let k = 1; k <= 10; k++) {
    const fk = k * f * Math.sqrt(1 + B * k * k); if (fk > sr * 0.45) break;
    const a = Math.pow(k, -1.4) * (k === 1 ? 1 : 0.8), tau = 2.4 / (1 + 0.45 * (k - 1));
    parts.push({ f: fk, a, tau }, { f: fk * 1.0006, a: a * 0.6, tau });
  }
  parts.push({ f: f * 7.1, a: 0.05, tau: 0.05 }); // golpe de "tine"
  aditivo(d, sr, parts);
  for (let i = 0; i < d.length; i++) d[i] *= Math.min(1, i / sr / 0.003);
  finales(d, sr, 0.0003, 0.25); normaliza(d, 0.8); return b;
}

const GEN = {
  kick, snare, clap, rim, shaker, crash,
  hat: (c) => hat(c, false), ohat: (c) => hat(c, true),
  tomh: (c) => tom(c, 210, 0.16), tomm: (c) => tom(c, 145, 0.2), toml: (c) => tom(c, 98, 0.26),
  taiko: (c) => tom(c, 64, 0.42, 1.4, 0.5),
  klongd: (c) => klong(c, 'd'), klongt: (c) => klong(c, 't'), klongk: (c) => klong(c, 'k'),
  ching: (c) => ching(c, false), chap: (c) => ching(c, true),
  gong, tamtam, boom,
  phin: (c, n) => cuerda(c, n, { t60: 1.3, brillo: 0.8, pos: 0.16, secs: 1.5, doble: 0.0025, cuerpo: [[420, 1.4, 4], [2700, 1.2, 4]] }),
  guzheng: (c, n) => cuerda(c, n, { t60: 2.2, brillo: 0.6, pos: 0.11, secs: 2.1, cuerpo: [[300, 1, 3], [1800, 1.5, 2]], seed: 83 }),
  ranat, khong, campana, steel, arp: pluckSynth, keys,
};
