// Secuenciador de La Ruta: planificación con "lookahead" sobre el reloj de WebAudio
// (setInterval solo despierta; los tiempos reales son los del AudioContext, así que
// el ritmo no se tuerce aunque el hilo principal vaya cargado).
//
// Una pista (ver pistas.js) es:
//   { bpm, gain, swing, accel, duck, reverb, delay:{t,fb,v},
//     inst: { nombre: { t:'tipo', v, pan, rev, dly, oct, min, max, iv, ... } },
//     sec:  { A: { bars, chords:'Am F C G', p:{ nombre: patrón }, fill:{ nombre: patrón } } },
//     order: ['I','A','B',...], loop: índice al que vuelve }
// Patrones:
//   batería  'x...o...g...'  (x fuerte, o medio, g fantasma; tom: h/m/l; klong: d/t/k; ching: x abre / o cierra)
//   tonales  'a4:2 c5 . e5:4 -'   nota[:pasos], '.' silencio, '-' alarga, '~a4' entra deslizando
//            'r..f.o..'           relativo al acorde: r raíz, f quinta, o octava, t tercera
//            '0123'               índice de nota del acorde (arpegio)
//            'x---'               acorde entero (pads)
// Capas por intensidad: inst.min / inst.max (se abre/cierra la capa), inst.iv (sube volumen con la intensidad),
// def.accel (el tempo sube con la intensidad: bpm × (1 + accel·I)).
import { muestra, hz, tieneMuestra, liberar } from './muestras.js';

const LOOKAHEAD = 0.16, TICK_MS = 40;
const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
export function nota(s) {
  const m = /^([a-g])([#b]?)(-?\d)$/.exec(s);
  if (!m) return null;
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const CH = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7],
  add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  dim: [0, 3, 6], 5: [0, 7, 12], '7sus4': [0, 5, 7, 10], 9: [0, 4, 7, 10, 14],
};
export function acorde(sym) {
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
  if (!m || !(m[3] in CH)) { console.warn('acorde raro', sym); return { r: 0, iv: [0, 4, 7], bajo: 0 }; }
  const acc = (a) => (a === '#' ? 1 : a === 'b' ? -1 : 0);
  const r = (PC[m[1].toLowerCase()] + acc(m[2]) + 12) % 12;
  const bajo = m[4] ? (PC[m[4].toLowerCase()] + acc(m[5]) + 12) % 12 : r;
  return { r, iv: CH[m[3]], bajo };
}

const DRUMS = new Set(['kick', 'snare', 'clap', 'hat', 'ohat', 'shaker', 'rim', 'crash', 'tom', 'klong', 'taiko', 'ching', 'gong', 'tamtam', 'boom']);
const TONALES = new Set(['phin', 'guzheng', 'ranat', 'khong', 'campana', 'steel', 'arp', 'keys']);
const MAXV = { phin: 6, guzheng: 8, ranat: 8, khong: 6, campana: 6, steel: 6, arp: 6, keys: 10, crash: 2, gong: 2, tamtam: 2, boom: 2, ohat: 2, ching: 3 };

// Presets de sintes monofónicos en vivo (osciladores persistentes: baratísimos)
const MONO = {
  bass: { waves: [['sawtooth', 0, 0.55], ['sine', -1200, 0.9]], lp: [520, 4], env: { a: 0.003, r: 0.035, sus: 0.85 }, fenv: { amt: 3.2, dec: 0.09 }, glide: 0.002 },
  sub: { waves: [['sine', 0, 1], ['triangle', 0, 0.25]], lp: [400, 0.7], env: { a: 0.006, r: 0.06, sus: 0.95 }, glide: 0.002 },
  reese: { waves: [['sawtooth', -14, 0.5], ['sawtooth', 14, 0.5], ['sine', -1200, 0.8]], lp: [700, 2.5], env: { a: 0.004, r: 0.05, sus: 0.9 }, fenv: { amt: 2.2, dec: 0.12 }, glide: 0.01 },
  lead: { waves: [['sawtooth', -7, 0.5], ['square', 7, 0.35]], lp: [2600, 1.4], env: { a: 0.008, r: 0.12, sus: 0.75 }, fenv: { amt: 1.8, dec: 0.22 }, glide: 0.012, vib: [5.3, 14, 0.22] },
  brass: { waves: [['sawtooth', -6, 0.5], ['sawtooth', 6, 0.5], ['sawtooth', -1200, 0.3]], lp: [1300, 1.6], env: { a: 0.035, r: 0.16, sus: 0.85 }, fenv: { amt: 2.2, dec: 0.25 }, glide: 0.012, vib: [5, 9, 0.3] },
  pijava: { waves: [['sawtooth', 0, 0.8], ['square', 3, 0.25]], hp: 380, lp: [4200, 0.7], formants: [[780, 4, 1], [1420, 6, 0.85], [2750, 7, 0.38], [3600, 8, 0.14]], dry: 0.08, env: { a: 0.02, r: 0.07, sus: 0.9 }, glide: 0.032, vib: [6.3, 30, 0.07], scoop: -90, breath: 0.08 },
  erhu: { waves: [['sawtooth', 0, 0.7], ['sawtooth', 5, 0.35]], hp: 250, lp: [3000, 0.8], formants: [[1050, 2.5, 0.7], [2300, 3, 0.35]], dry: 0.55, env: { a: 0.06, r: 0.2, sus: 0.9 }, glide: 0.04, vib: [5.7, 24, 0.16], scoop: -130, breath: 0.03 },
  flauta: { waves: [['triangle', 0, 1], ['sine', 1200, 0.18]], lp: [3800, 0.7], env: { a: 0.035, r: 0.14, sus: 0.85 }, glide: 0.02, vib: [5, 12, 0.2], scoop: -40, breath: 0.12 },
  khaen: { waves: [['square', -4, 0.4], ['square', 4, 0.4], ['sawtooth', 1200, 0.15]], lp: [1700, 1], formants: [[650, 3, 0.6], [1500, 4, 0.4]], dry: 0.5, env: { a: 0.06, r: 0.2, sus: 0.9 }, glide: 0.04, vib: [4.5, 6, 0.3], breath: 0.05 },
};

// ---------------- mesa común: reverb (convolver con impulso generado una vez) + pegamento ----------------
const mesas = new WeakMap();
function mesa(ctx, out) {
  let porOut = mesas.get(ctx);
  if (!porOut) { porOut = new Map(); mesas.set(ctx, porOut); }
  let m = porOut.get(out);
  if (m) return m;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18; glue.ratio.value = 2.5; glue.knee.value = 10; glue.attack.value = 0.012; glue.release.value = 0.22;
  const makeup = ctx.createGain(); makeup.gain.value = 1.0;
  // limitador final: ninguna pista pasa de ≈ -1 dBFS
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12;
  glue.connect(makeup).connect(lim).connect(out);
  const conv = ctx.createConvolver();
  conv.buffer = impulso(ctx, 1.6);
  const ret = ctx.createGain(); ret.gain.value = 0.9;
  conv.connect(ret).connect(glue);
  m = { in: glue, rev: conv };
  porOut.set(out, m);
  return m;
}
function impulso(ctx, secs) {
  const sr = ctx.sampleRate, n = Math.floor(secs * sr), b = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let s = (ch + 1) * 12345, lp = 0;
    const pre = Math.floor(0.012 * sr);
    for (let i = pre; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const t = (i - pre) / sr, x = (s / 4294967296) * 2 - 1;
      const k = 0.08 + 0.85 * Math.exp(-t / 0.5); // se oscurece con el tiempo
      lp += (x - lp) * k;
      d[i] = lp * Math.exp(-t / 0.34) * (t < 0.004 ? t / 0.004 : 1);
    }
  }
  return b;
}

// ---------------- compilación de patrones ----------------
function tokens(pat) {
  if (typeof pat !== 'string') return [];
  return /[\s:]/.test(pat.trim()) ? pat.trim().split(/\s+/) : pat.split('');
}
function golpe(tipo, ch, inst) {
  const up = ch !== ch.toLowerCase(), c = ch.toLowerCase();
  if (tipo === 'tom') return 'hml'.includes(c) ? { n: 'tom' + c, v: up ? 1 : 0.85 } : null;
  if (tipo === 'klong') return 'dtk'.includes(c) ? { n: 'klong' + c, v: up ? 1 : 0.72 } : null;
  if (tipo === 'ching') return c === 'x' ? { n: 'ching', v: 1 } : c === 'o' ? { n: 'chap', v: 0.9 } : null;
  const v = c === 'x' ? 1 : c === 'o' ? 0.62 : c === 'g' ? 0.3 : 0;
  if (!v) return null;
  return { n: tipo, v, nota: tipo === 'gong' ? (inst.nota || 40) : 0 };
}
function wrapPC(pc, lo) { let m = lo + ((pc - lo) % 12 + 12) % 12; return m; }
function compilaSeccion(def, nombre, sec) {
  const steps = sec.bars * 16;
  const ct = (sec.chords || 'C').trim().split(/\s+/);
  const acordes = new Array(steps);
  for (let b = 0; b < sec.bars; b++) {
    const partes = ct[b % ct.length].split(',');
    const L = 16 / partes.length;
    partes.forEach((p, i) => { const a = acorde(p); for (let s = 0; s < L; s++) acordes[b * 16 + i * L + s] = a; });
  }
  const ev = {};
  const pon = (name, pat, desde, hasta) => {
    const inst = def.inst[name];
    if (!inst) { console.warn('instrumento sin definir', name, 'en', nombre); return; }
    const lista = ev[name] || (ev[name] = []);
    for (let i = lista.length - 1; i >= 0; i--) if (lista[i].s >= desde && lista[i].s < hasta) lista.splice(i, 1);
    const tipo = inst.t;
    if (pat === 1 || pat === true) { // pad: acorde en cada cambio
      let s = desde;
      while (s < hasta) { let e = s + 1; while (e < hasta && acordes[e] === acordes[s]) e++; lista.push(evAcorde(inst, acordes[s], s, e - s, 0.85)); s = e; }
      return;
    }
    const tk = tokens(pat);
    if (!tk.length) return;
    // expande duraciones a una línea de pasos
    const linea = [];
    for (const t of tk) {
      const [cab, dur] = t.split(':');
      const d = dur ? Math.max(1, Math.round(+dur)) : 1;
      linea.push(cab);
      for (let i = 1; i < d; i++) linea.push(cab === '.' ? '.' : '-');
    }
    if (steps % linea.length && (hasta - desde) % linea.length) console.warn(`patrón de ${linea.length} pasos no encaja en ${nombre}.${name} (${hasta - desde})`);
    for (let s = desde, i = 0; s < hasta; s++, i++) {
      const c = linea[i % linea.length];
      if (c === '.' || c === '-') continue;
      let d = 1; while (s + d < hasta && linea[(i + d) % linea.length] === '-') d++;
      if (DRUMS.has(tipo)) {
        if (tipo === 'gong' || tipo === 'tamtam' || tipo === 'boom' || tipo === 'crash') { if (c.toLowerCase() === 'x' || c === 'o') lista.push({ s, d, n: tipo, v: c === 'o' ? 0.6 : 1, nota: inst.nota || 40 }); continue; }
        const g = golpe(tipo, c, inst);
        if (g) lista.push({ s, d, n: g.n, v: g.v, nota: g.nota });
        continue;
      }
      if (tipo === 'olas' || tipo === 'riser') { lista.push({ s, d, n: 0, v: c === 'o' ? 0.6 : 1 }); continue; }
      const a = acordes[s];
      let slide = false, cc = c, v = 0.85;
      if (cc[0] === '~') { slide = true; cc = cc.slice(1); }
      if (cc[cc.length - 1] === '!') { v = 1; cc = cc.slice(0, -1); }
      if (cc.length > 1 && cc[cc.length - 1] === '?') { v = 0.55; cc = cc.slice(0, -1); }
      if (cc === 'x' || cc === 'X') { lista.push(evAcorde(inst, a, s, d, cc === 'X' ? 1 : 0.85)); continue; }
      let m = null;
      const oct = inst.oct ?? 4;
      if (cc.length > 1) m = nota(cc);
      else if (/[0-9]/.test(cc)) {
        const k = +cc, n = a.iv.length; let base = 12 * (oct + 1) + a.r; if (a.r >= 7) base -= 12;
        m = base + a.iv[k % n] + 12 * Math.floor(k / n);
      } else if ('rfot'.includes(cc)) {
        let base = 12 * (oct + 1) + a.bajo; if (a.bajo > 6) base -= 12;
        if (cc === 'f') base = 12 * (oct + 1) + a.r - (a.r > 6 ? 12 : 0) + 7;
        else if (cc === 'o') base += 12;
        else if (cc === 't') base = 12 * (oct + 1) + a.r - (a.r > 6 ? 12 : 0) + a.iv[1];
        m = base;
      }
      if (m == null) { console.warn('nota rara', c, 'en', nombre, name); continue; }
      lista.push({ s, d, n: m + (inst.tr || 0), v, sl: slide });
    }
  };
  for (const [name, pat] of Object.entries(sec.p || {})) pon(name, pat, 0, steps);
  if (sec.fill) for (const [name, pat] of Object.entries(sec.fill)) pon(name, pat, Math.max(0, steps - 16), steps);
  // índice por paso
  const porPaso = {};
  for (const [name, lista] of Object.entries(ev)) {
    const arr = new Array(steps);
    for (const e of lista) (arr[e.s] || (arr[e.s] = [])).push(e);
    porPaso[name] = arr;
  }
  return { steps, ev: porPaso };
}
function evAcorde(inst, a, s, d, v) {
  const lo = 12 * ((inst.oct ?? 4) + 1) - 4;
  const notas = [...new Set(a.iv.map((i) => wrapPC(a.r + i, lo)))].sort((x, y) => x - y);
  return { s, d, n: notas, v };
}

// ---------------- canales ----------------
class Canal {
  constructor(seq, name, inst) {
    const c = seq.ctx;
    this.seq = seq; this.name = name; this.inst = inst; this.tipo = inst.t;
    this.in = c.createGain(); this.in.gain.value = inst.v ?? 0.5;
    this.gate = c.createGain(); this.gate.gain.value = 1;
    let n = this.in;
    if (inst.pan) { const p = c.createStereoPanner(); p.pan.value = inst.pan; n.connect(p); n = p; }
    n.connect(this.gate);
    const sc = inst.sc ?? (this.tipo === 'kick');
    this.sc = sc;
    this.gate.connect((inst.duck ?? !sc) ? seq.duck : seq.mix);
    if (inst.rev) { const r = c.createGain(); r.gain.value = inst.rev; this.gate.connect(r).connect(seq.revBus); }
    if (inst.dly) { const r = c.createGain(); r.gain.value = inst.dly; this.gate.connect(r).connect(seq.dlyIn); }
    this.voces = [];
    this.on = true; this.offAt = -1;
    if (MONO[this.tipo]) this.mono = new Mono(seq, this, { ...MONO[this.tipo], ...(inst.preset || {}) });
    if (this.tipo === 'pad') this.pad = new Pad(seq, this, inst);
  }
  roba(t) {
    const max = this.inst.voces || MAXV[this.tipo] || 0;
    if (!max) return;
    const ahora = this.seq.ctx.currentTime;
    this.voces = this.voces.filter((v) => v.fin > ahora);
    while (this.voces.length >= max) {
      const v = this.voces.shift();
      try { v.g.gain.setTargetAtTime(0, t, 0.012); v.src.stop(t + 0.08); } catch (e) { /* ya parada */ }
    }
  }
  buffer(buf, t, vel, rate = 1, slide = false) {
    if (!buf) return;
    const c = this.seq.ctx;
    this.roba(t);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vel;
    if (rate !== 1 || slide) {
      if (slide) { src.playbackRate.setValueAtTime(rate * 0.89, t); src.playbackRate.setTargetAtTime(rate, t + 0.01, 0.035); }
      else src.playbackRate.value = rate;
    }
    src.connect(g).connect(this.in);
    src.start(t);
    const fin = t + buf.duration / rate;
    if (MAXV[this.tipo] || this.inst.voces) this.voces.push({ src, g, fin });
    return src;
  }
  toca(e, t, spb) {
    const c = this.seq.ctx, tipo = this.tipo, inst = this.inst;
    const hum = 1 + (Math.random() - 0.5) * 0.08;
    if (this.sc) this.seq.bombeo(t);
    if (DRUMS.has(tipo)) {
      const rate = (tipo === 'hat' || tipo === 'shaker' || tipo === 'ohat') ? 1 + (Math.random() - 0.5) * 0.03 : (inst.rate || 1);
      this.buffer(muestra(c, e.n, e.nota || 0), t, e.v * hum, rate);
      return;
    }
    if (TONALES.has(tipo)) {
      const v = e.v * hum;
      if (inst.kro && e.d >= 3) { // ranat: trémolo "kro" en notas largas
        const paso = spb / 2, n = Math.floor(e.d * 2);
        for (let i = 0; i < n; i++) this.buffer(muestra(c, tipo, e.n), t + i * paso, v * (i ? 0.6 + 0.1 * Math.sin(i) : 1));
      } else this.buffer(muestra(c, tipo, e.n), t, v, 1, e.sl);
      if (inst.oct8) this.buffer(muestra(c, tipo, e.n + 12), t, v * inst.oct8);
      return;
    }
    if (this.mono) { this.mono.nota(t, e.d * spb, e.n, e.v * hum, e.sl); return; }
    if (this.pad) { this.pad.acorde(t, e.d * spb, e.n, e.v); return; }
    if (tipo === 'olas') return this.ola(t, e.d * spb, e.v);
    if (tipo === 'riser') return this.riser(t, e.d * spb, e.v);
  }
  ruidoSrc(t, dur) {
    const c = this.seq.ctx, s = c.createBufferSource();
    s.buffer = this.seq.noise; s.loop = true;
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return s;
  }
  ola(t, dur, v) {
    const c = this.seq.ctx, s = this.ruidoSrc(t, dur), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 0.4;
    const pico = t + dur * 0.38;
    f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(this.inst.cut || 1800, pico); f.frequency.exponentialRampToValueAtTime(300, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, pico); g.gain.setTargetAtTime(0, pico, dur * 0.22);
    s.connect(f).connect(g).connect(this.in);
  }
  riser(t, dur, v) {
    const c = this.seq.ctx, s = this.ruidoSrc(t, dur), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.Q.value = 1.8;
    f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(7500, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.95); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(this.in);
  }
  start(t) { if (this.mono) this.mono.start(t); if (this.pad) this.pad.start(t); }
  stop(t) { if (this.mono) this.mono.stop(t); if (this.pad) this.pad.stop(t); for (const v of this.voces) { try { v.src.stop(t); } catch (e) { /* */ } } }
}

class Mono {
  constructor(seq, canal, p) {
    const c = seq.ctx;
    this.c = c; this.p = p; this.canal = canal; this.finPrev = -1;
    this.env = c.createGain(); this.env.gain.value = 0;
    this.pre = c.createGain(); this.pre.gain.value = 1;
    this.oscs = p.waves.map(([type, det, g]) => {
      const o = c.createOscillator(); o.type = type; o.detune.value = det; o._det = det; o.frequency.value = 220;
      const og = c.createGain(); og.gain.value = g; o.connect(og).connect(this.pre);
      return o;
    });
    let n = this.pre;
    if (p.hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = p.hp; h.Q.value = 0.7; n.connect(h); n = h; }
    if (p.formants) {
      const suma = c.createGain(); suma.gain.value = 1;
      for (const [f, q, g] of p.formants) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const gg = c.createGain(); gg.gain.value = g * q * 0.5; n.connect(bp).connect(gg).connect(suma); }
      if (p.dry) { const dg = c.createGain(); dg.gain.value = p.dry; n.connect(dg).connect(suma); }
      n = suma;
    }
    if (p.lp) { const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = (canal.inst.cut || p.lp[0]); l.Q.value = p.lp[1]; n.connect(l); n = l; this.lp = l; this.cut = canal.inst.cut || p.lp[0]; }
    n.connect(this.env);
    if (p.breath) {
      const s = c.createBufferSource(); s.buffer = seq.noise; s.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8;
      const g = c.createGain(); g.gain.value = p.breath;
      s.connect(bp).connect(g).connect(this.env); this.breath = s;
    }
    if (p.vib) {
      const lfo = c.createOscillator(); lfo.frequency.value = p.vib[0];
      this.vibG = c.createGain(); this.vibG.gain.value = 0;
      lfo.connect(this.vibG); for (const o of this.oscs) this.vibG.connect(o.detune);
      this.lfo = lfo;
    }
    this.env.connect(canal.in);
  }
  start(t) { for (const o of this.oscs) o.start(t); if (this.lfo) this.lfo.start(t); if (this.breath) this.breath.start(t, Math.random()); }
  stop(t) { for (const o of this.oscs) o.stop(t); if (this.lfo) this.lfo.stop(t); if (this.breath) this.breath.stop(t); }
  nota(t, dur, m, vel, slide) {
    const p = this.p, f = hz(m), e = p.env, legato = t - this.finPrev < 0.02;
    for (const o of this.oscs) {
      if (legato || slide) o.frequency.setTargetAtTime(f, t, p.glide);
      else o.frequency.setValueAtTime(f, t);
      if (p.scoop || slide) {
        const base = o._det; // detune propio (estático) del oscilador
        o.detune.setValueAtTime(base + (slide ? -200 : p.scoop), t); o.detune.setTargetAtTime(base, t + 0.005, slide ? 0.05 : 0.03);
      }
    }
    const g = this.env.gain;
    g.setTargetAtTime(vel, t, e.a / 2.5);
    g.setTargetAtTime(vel * e.sus, t + e.a, 0.25);
    const fin = t + Math.max(0.03, dur - 0.012);
    g.setTargetAtTime(0, fin, e.r / 3);
    this.finPrev = fin + 0.012;
    if (this.lp && p.fenv) {
      const lp = this.lp.frequency;
      lp.setTargetAtTime(Math.min(16000, this.cut * p.fenv.amt * (0.6 + vel * 0.5)), t, 0.004);
      lp.setTargetAtTime(this.cut, t + 0.012, p.fenv.dec);
    }
    if (this.vibG) {
      this.vibG.gain.setTargetAtTime(0, t, 0.01);
      if (dur > p.vib[2]) this.vibG.gain.setTargetAtTime(p.vib[1], t + p.vib[2], 0.12);
    }
  }
}

class Pad {
  constructor(seq, canal, inst) {
    const c = seq.ctx;
    this.c = c; this.inst = inst; this.canal = canal;
    this.f = c.createBiquadFilter(); this.f.type = 'lowpass'; this.f.frequency.value = inst.cut || 1600; this.f.Q.value = 0.6;
    // chorus: dos retardos modulados, uno a cada lado
    const dry = c.createGain(); dry.gain.value = 0.7; this.f.connect(dry).connect(canal.in);
    this.lfos = [];
    for (const [d, r, pan] of [[0.012, 0.31, -0.7], [0.019, 0.43, 0.7]]) {
      const dl = c.createDelay(0.05); dl.delayTime.value = d;
      const lfo = c.createOscillator(); lfo.frequency.value = r; const lg = c.createGain(); lg.gain.value = 0.0025;
      lfo.connect(lg).connect(dl.delayTime);
      const p = c.createStereoPanner(); p.pan.value = pan; const g = c.createGain(); g.gain.value = 0.55;
      this.f.connect(dl).connect(g).connect(p).connect(canal.in);
      this.lfos.push(lfo);
    }
    this.vivas = [];
  }
  start(t) { for (const l of this.lfos) l.start(t); }
  stop(t) { for (const l of this.lfos) l.stop(t); for (const v of this.vivas) for (const o of v) { try { o.stop(t); } catch (e) { /* */ } } }
  acorde(t, dur, notas, vel) {
    const c = this.c, a = this.inst.a ?? 0.35, r = this.inst.r ?? 0.9, w = this.inst.wave || 'sawtooth';
    const ahora = c.currentTime;
    this.vivas = this.vivas.filter((v) => v.fin > ahora);
    const nv = (vel / Math.sqrt(notas.length)) * 0.6;
    for (const m of notas) {
      const g = c.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(nv, t + a); g.gain.setTargetAtTime(0, t + dur, r / 3);
      const os = [];
      for (const det of [-9, 9]) { const o = c.createOscillator(); o.type = w; o.frequency.value = hz(m); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + r * 2.5); os.push(o); }
      os.fin = t + dur + r * 2.5;
      g.connect(this.f);
      this.vivas.push(os);
    }
  }
}

// ---------------- el secuenciador ----------------
export class Secuenciador {
  constructor(ctx, out, def, noise) {
    this.ctx = ctx; this.def = def; this.noise = noise;
    this.offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    const m = mesa(ctx, out);
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(m.in);
    this.revBus = ctx.createGain(); this.revBus.gain.value = 0; this.revBus.connect(m.rev);
    this.mix = ctx.createGain(); this.mix.connect(this.out);
    this.duck = ctx.createGain(); this.duck.connect(this.mix);
    this.revSend = def.reverb ?? 0.3;
    // eco ping-pong a tempo
    const dd = def.delay || {};
    const T = Math.min(1.9, (dd.t ?? 0.75) * 60 / def.bpm);
    this.dlyIn = ctx.createGain();
    const dl = ctx.createDelay(2), dr = ctx.createDelay(2), lp = ctx.createBiquadFilter(), fb = ctx.createGain(), mg = ctx.createChannelMerger(2), dout = ctx.createGain();
    dl.delayTime.value = T; dr.delayTime.value = T; lp.type = 'lowpass'; lp.frequency.value = 3200; fb.gain.value = dd.fb ?? 0.38; dout.gain.value = dd.v ?? 0.5;
    this.dlyIn.connect(dl); dl.connect(dr); dr.connect(lp).connect(fb).connect(dl);
    dl.connect(mg, 0, 0); dr.connect(mg, 0, 1); mg.connect(dout).connect(this.duck);
    this.canales = Object.entries(def.inst).map(([n, inst]) => new Canal(this, n, inst));
    this.porNombre = Object.fromEntries(this.canales.map((c) => [c.name, c]));
    this.secs = {};
    for (const [n, s] of Object.entries(def.sec)) this.secs[n] = compilaSeccion(def, n, s);
    this.order = def.order; this.loopAt = def.loop ?? 0;
    this.I = 0; this.Is = 0;
    this.stats = { ticks: 0, total: 0, max: 0, calentar: 0 };
    // muestras que hará falta generar, en orden de aparición (se generan poco a poco en tick())
    this.pend = [];
    if (!this.offline) {
      const vistas = new Set();
      let pasoGlobal = 0; this.pendInicio = 0;
      const pon = (t, n) => { const k = t + ':' + n; if (vistas.has(k)) return; vistas.add(k); if (!tieneMuestra(ctx, t, n)) { this.pend.push([t, n]); if (pasoGlobal < 48) this.pendInicio++; } };
      for (const o of [...new Set(this.order)]) {
        const sec = this.secs[o];
        for (let st = 0; st < sec.steps; st++, pasoGlobal++) for (const ch of this.canales) {
          const evs = sec.ev[ch.name] && sec.ev[ch.name][st]; if (!evs) continue;
          for (const e of evs) {
            if (DRUMS.has(ch.tipo)) pon(e.n, e.nota || 0);
            else if (TONALES.has(ch.tipo)) { pon(ch.tipo, e.n); if (ch.inst.oct8) pon(ch.tipo, e.n + 12); }
          }
        }
      }
      liberar(ctx, vistas);
    }
    this.marcas = [];
    this.setIntensity(0, true);
  }
  start() {
    // antes de sonar, genera (en rodajas de ≤4 ms, sin tirones) las muestras de los primeros compases
    if (!this.offline && this.pendInicio > 0) {
      const paso = () => {
        if (this.parado) return;
        const b = performance.now();
        while (this.pendInicio > 0 && this.pend.length && performance.now() - b < 4) { const [t, n] = this.pend.shift(); muestra(this.ctx, t, n); this.pendInicio--; }
        this.stats.calentar += performance.now() - b;
        if (this.pendInicio > 0 && this.pend.length) setTimeout(paso, 0); else this._arranca();
      };
      paso();
      return;
    }
    this._arranca();
  }
  _arranca() {
    if (this.parado) return;
    const c = this.ctx, t = c.currentTime + 0.06;
    this.t0 = t; this.next = t; this.oi = 0; this.ls = 0; this.paso = 0;
    const g = (this.def.gain ?? 1);
    this.out.gain.setValueAtTime(0, c.currentTime); this.out.gain.linearRampToValueAtTime(g, t + 0.25);
    this.revBus.gain.setValueAtTime(0, c.currentTime); this.revBus.gain.linearRampToValueAtTime(g * this.revSend, t + 0.25);
    for (const ch of this.canales) ch.start(t);
    if (!this.offline) { this.timer = setInterval(() => this.tick(), TICK_MS); this.tick(); }
  }
  tick() {
    const a = performance.now();
    this.programar(this.ctx.currentTime + LOOKAHEAD);
    const d = performance.now() - a;
    this.stats.ticks++; this.stats.total += d; if (d > this.stats.max) this.stats.max = d;
    if (this.pend.length) { // precálculo de muestras con presupuesto fijo por tick
      const b = performance.now();
      while (this.pend.length && performance.now() - b < 4) { const [t, n] = this.pend.shift(); muestra(this.ctx, t, n); }
      this.stats.calentar += performance.now() - b;
    }
  }
  bpmActual() { return this.def.bpm * (1 + (this.def.accel || 0) * this.Is); }
  programar(hasta) {
    while (this.next < hasta) {
      const t = this.next;
      this.Is += (this.I - this.Is) * 0.06;
      const spb = 60 / this.bpmActual() / 4;
      const sec = this.secs[this.order[this.oi]];
      const sw = (this.paso % 2) ? (this.def.swing || 0) * spb : 0;
      for (const ch of this.canales) {
        const arr = sec.ev[ch.name];
        if (!arr) continue;
        const evs = arr[this.ls];
        if (!evs) continue;
        if (!ch.on && t - ch.offAt > 1.5) continue;
        for (const e of evs) ch.toca(e, t + sw, spb);
      }
      this.marcas.push([t, this.paso, spb]); if (this.marcas.length > 32) this.marcas.shift();
      this.paso++; this.ls++;
      if (this.ls >= sec.steps) { this.ls = 0; this.oi++; if (this.oi >= this.order.length) this.oi = this.loopAt; }
      this.next += spb;
    }
  }
  // Sidechain suave: el bombo hunde un poco todo lo demás
  bombeo(t) {
    const d = this.def.duck ?? 0.3;
    if (!d) return;
    const g = this.duck.gain;
    g.setTargetAtTime(1 - d, t, 0.004);
    g.setTargetAtTime(1, t + 0.03, 0.09);
  }
  setIntensity(v, inicial = false) {
    v = Math.max(0, Math.min(1, +v || 0));
    this.I = v;
    const now = this.ctx.currentTime;
    for (const ch of this.canales) {
      const inst = ch.inst;
      const on = v >= (inst.min ?? 0) - 1e-6 && v <= (inst.max ?? 1) + 1e-6;
      const nivel = on ? (inst.iv ? 1 - inst.iv + inst.iv * v : 1) : 0;
      if (inicial) ch.gate.gain.value = nivel;
      else ch.gate.gain.setTargetAtTime(nivel, now, on ? 0.35 : 0.5);
      if (ch.on && !on) ch.offAt = now;
      ch.on = on;
      if (ch.pad && inst.icut) ch.pad.f.frequency.setTargetAtTime((inst.cut || 1600) * (1 + inst.icut * v), now, 0.5);
    }
  }
  // Para minijuegos de ritmo: tiempo de pulso actual
  info() {
    const now = this.ctx.currentTime;
    let m = this.marcas[0];
    for (const x of this.marcas) if (x[0] <= now) m = x;
    if (!m) return { bpm: this.def.bpm, beat: 0, t0: this.t0 };
    const beat = (m[1] + (now - m[0]) / m[2]) / 4;
    return { bpm: this.bpmActual(), beat, t0: this.t0, now };
  }
  stop(fade = 0.6) {
    const c = this.ctx, t = c.currentTime;
    this.parado = true;
    for (const g of [this.out.gain, this.revBus.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade); }
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.next = Infinity;
    const fin = t + fade + 0.05;
    if (this.t0 != null) for (const ch of this.canales) { try { ch.stop(fin); } catch (e) { /* */ } }
    setTimeout(() => { try { this.out.disconnect(); this.revBus.disconnect(); } catch (e) { /* */ } }, (fade + 2.6) * 1000);
  }
}

// Comprueba una pista (para pruebas): devuelve avisos
export function validar(def) {
  const avisos = [];
  const w = console.warn; console.warn = (...a) => avisos.push(a.join(' '));
  try { for (const [n, s] of Object.entries(def.sec)) compilaSeccion(def, n, s); for (const o of def.order) if (!def.sec[o]) avisos.push('sección inexistente ' + o); }
  finally { console.warn = w; }
  return avisos;
}
