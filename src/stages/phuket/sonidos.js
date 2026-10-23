// Efectos de sonido propios de Phuket (sintetizados con WebAudio, sin archivos).
// Van por el bus de efectos del juego (respetan el volumen de Ajustes).
export function makeSfx(audio) {
  const ok = () => audio.ctx && audio.ctx.state === 'running' && audio.sfxBus;
  const vol = () => 1;

  function tone(f, f2, d, v, type = 'sine', delay = 0) {
    if (!ok()) return;
    const c = audio.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * vol(), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(audio.sfxBus);
    o.start(t); o.stop(t + d + 0.03);
  }
  function noise(freq, d, v, type = 'bandpass', q = 1, delay = 0, freq2 = null) {
    if (!ok() || !audio._noise) return;
    const c = audio.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = audio._noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + d);
    const g = c.createGain();
    g.gain.setValueAtTime(v * vol(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(audio.sfxBus);
    s.start(t, Math.random()); s.stop(t + d + 0.03);
  }

  return {
    // coco: "plin" que sube un semitono por cada coco de la racha
    coco(n = 0) {
      const f = 660 * Math.pow(2, Math.min(n, 16) / 12);
      tone(f, f * 1.02, 0.12, 0.22, 'triangle');
      tone(f * 1.5, f * 1.5, 0.16, 0.12, 'sine', 0.05);
      noise(3000, 0.04, 0.15, 'highpass');
    },
    combo(m) { [0, 4, 7, 12].forEach((s, i) => tone(523 * Math.pow(2, (s + m * 2) / 12), null, 0.14, 0.16, 'square', i * 0.06)); },
    mono() { [0, 0.12, 0.22].forEach((d, i) => tone(700 + i * 160, 1300 + i * 200, 0.1, 0.16, 'square', d)); },
    guau() { tone(320, 170, 0.14, 0.22, 'sawtooth'); noise(500, 0.12, 0.2, 'bandpass', 2); tone(300, 160, 0.16, 0.2, 'sawtooth', 0.2); noise(480, 0.14, 0.18, 'bandpass', 2, 0.2); },
    coc() { [0, 0.08, 0.22].forEach((d) => tone(950, 650, 0.06, 0.14, 'square', d)); },
    boing() { tone(160, 520, 0.22, 0.2, 'sine'); tone(240, 700, 0.18, 0.08, 'triangle', 0.02); },
    plof() { noise(380, 0.18, 0.4, 'lowpass'); tone(130, 55, 0.14, 0.3, 'sine'); },
    chof() { noise(1400, 0.45, 0.45, 'bandpass', 0.8, 0, 500); noise(4000, 0.25, 0.2, 'highpass'); },
    derrape() { noise(1700, 0.35, 0.18, 'bandpass', 4); },
    chispas() { noise(5000, 0.12, 0.25, 'highpass'); },
    claxon(p = 1) { tone(380 * p, null, 0.16, 0.12, 'square'); tone(478 * p, null, 0.16, 0.09, 'square'); tone(380 * p, null, 0.14, 0.1, 'square', 0.2); tone(478 * p, null, 0.14, 0.08, 'square', 0.2); },
    ay() { tone(950, 280, 0.32, 0.2, 'triangle'); tone(1400, 500, 0.22, 0.08, 'sine', 0.05); },
    frenazo() { noise(2400, 0.4, 0.22, 'bandpass', 6, 0, 1200); },
    plink(i = 0) { tone(1400 + (i % 5) * 180, null, 0.09, 0.07, 'sine'); },
    silbido() { tone(500, 1700, 0.7, 0.07, 'sine'); },
    turbo() { noise(900, 0.6, 0.35, 'bandpass', 1.5, 0, 3200); tone(110, 220, 0.5, 0.15, 'sawtooth'); },
    fiesta() { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(523 * Math.pow(2, s / 12), null, 0.16, 0.14, 'triangle', i * 0.09)); },
  };
}
