// Efectos de sonido sintetizados (provisional; los amplía el agente de audio).
function tone(ctx, out, { f = 440, f2 = null, type = 'sine', d = 0.15, v = 0.3 }, o) {
  const t = ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f * o.pitch, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2 * o.pitch, t + d);
  g.gain.setValueAtTime(v * o.vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  osc.connect(g).connect(out); osc.start(t); osc.stop(t + d + 0.02);
}
function noiseHit(ctx, out, noise, { freq = 1000, d = 0.2, v = 0.4, type = 'lowpass' }, o) {
  const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.setValueAtTime(v * o.vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + d + 0.02);
}
export const EFECTOS = {
  click: (c, out, o) => tone(c, out, { f: 900, d: 0.05, v: 0.2, type: 'triangle' }, o),
  coin: (c, out, o) => { tone(c, out, { f: 988, d: 0.08, v: 0.2, type: 'square' }, o); setTimeout(() => tone(c, out, { f: 1319, d: 0.2, v: 0.2, type: 'square' }, o), 70); },
  boost: (c, out, o, n) => noiseHit(c, out, n, { freq: 2500, d: 0.5, v: 0.4, type: 'bandpass' }, o),
  crash: (c, out, o, n) => noiseHit(c, out, n, { freq: 600, d: 0.4, v: 0.7 }, o),
  hit: (c, out, o, n) => { noiseHit(c, out, n, { freq: 1500, d: 0.12, v: 0.7 }, o); tone(c, out, { f: 140, f2: 50, d: 0.15, v: 0.6 }, o); },
  whoosh: (c, out, o, n) => noiseHit(c, out, n, { freq: 1200, d: 0.25, v: 0.3, type: 'bandpass' }, o),
  star: (c, out, o) => tone(c, out, { f: 660, f2: 1320, d: 0.3, v: 0.25, type: 'triangle' }, o),
  win: (c, out, o) => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(c, out, { f, d: 0.3, v: 0.25, type: 'triangle' }, o), i * 110)),
  lose: (c, out, o) => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(c, out, { f, d: 0.35, v: 0.25, type: 'triangle' }, o), i * 160)),
  countdown: (c, out, o) => tone(c, out, { f: 660, d: 0.15, v: 0.3, type: 'square' }, o),
  go: (c, out, o) => tone(c, out, { f: 1320, d: 0.4, v: 0.3, type: 'square' }, o),
  sticker: (c, out, o) => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(c, out, { f, d: 0.18, v: 0.2, type: 'sine' }, o), i * 70)),
  splash: (c, out, o, n) => noiseHit(c, out, n, { freq: 900, d: 0.5, v: 0.5 }, o),
  horn: (c, out, o) => { tone(c, out, { f: 420, d: 0.3, v: 0.2, type: 'square' }, o); tone(c, out, { f: 530, d: 0.3, v: 0.15, type: 'square' }, o); },
  bell: (c, out, o) => tone(c, out, { f: 1200, d: 1.2, v: 0.25, type: 'sine' }, o),
  firework: (c, out, o, n) => noiseHit(c, out, n, { freq: 400, d: 0.9, v: 0.6 }, o),
  photo: (c, out, o, n) => noiseHit(c, out, n, { freq: 4000, d: 0.08, v: 0.5, type: 'highpass' }, o),
};
export const LOOPS = {
  engine: (ctx, out) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 60; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
    o.connect(f).connect(g).connect(out); o.start();
    return {
      set({ rate = 0.5, vol = 0.12 } = {}) { o.frequency.setTargetAtTime(50 + rate * 140, ctx.currentTime, 0.05); g.gain.setTargetAtTime(vol, ctx.currentTime, 0.05); },
      stop() { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => { try { o.stop(); } catch (e) {} }, 300); },
    };
  },
};
for (const k of ['rain', 'waves', 'crowd', 'wind', 'train']) LOOPS[k] = (ctx, out, noise) => {
  const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = k === 'rain' ? 'highpass' : 'lowpass'; f.frequency.value = k === 'rain' ? 3000 : 500;
  const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(out); s.start();
  return {
    set({ vol = 0.15 } = {}) { g.gain.setTargetAtTime(vol, ctx.currentTime, 0.2); },
    stop() { g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); setTimeout(() => { try { s.stop(); } catch (e) {} }, 400); },
  };
};
