// Sonido propio de la etapa con WebAudio: música del wai kru (pi, tambores klong,
// ching-chap y gong), campana del asalto y golpes con cuerpo.
// Usa el contexto y el bus de efectos del núcleo (audio.ctx / audio.sfxBus).

const PENTA = [0, 2, 4, 7, 9]; // escala pentatónica
const midiF = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function crearSonido(audio) {
  const ok = () => !!(audio.ctx && audio.ctx.state === 'running' && audio.sfxBus);
  const c = () => audio.ctx;
  const bus = () => audio.sfxBus;

  function env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function osc(type, f, t, d, peak, { f2 = null, a = 0.004, dest = null } = {}) {
    const o = c().createOscillator(), g = c().createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    env(g, t, peak, a, d);
    o.connect(g).connect(dest || bus()); o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function noise(t, d, peak, freq, type = 'bandpass', q = 1) {
    const s = c().createBufferSource(); s.buffer = audio._noise;
    const f = c().createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c().createGain(); env(g, t, peak, 0.002, d);
    s.connect(f).connect(g).connect(bus()); s.start(t, Math.random() * 1.5); s.stop(t + d + 0.05);
  }

  const S = {
    get ok() { return ok(); },
    now: () => (ok() ? c().currentTime : 0),
    // ching (abierto, largo) y chap (cerrado, seco)
    ching(t, vol = 1) { for (const [f, v] of [[2630, 0.09], [3950, 0.06], [5270, 0.035]]) osc('sine', f, t, 0.9, v * vol); },
    chap(t, vol = 1) { noise(t, 0.06, 0.18 * vol, 6000, 'highpass'); osc('sine', 2630, t, 0.06, 0.05 * vol); },
    drum(t, f = 92, vol = 1) { osc('sine', f * 1.7, t, 0.32, 0.55 * vol, { f2: f }); noise(t, 0.05, 0.12 * vol, 300, 'lowpass'); },
    slap(t, vol = 1) { noise(t, 0.08, 0.3 * vol, 1100, 'bandpass', 2); osc('triangle', 260, t, 0.07, 0.12 * vol, { f2: 180 }); },
    gong(t, n, vol = 1) { const f = midiF(n); osc('sine', f, t, 0.5, 0.11 * vol); osc('sine', f * 2.76, t, 0.2, 0.03 * vol); },
    // pi: lengüeta nasal con vibrato
    pi(t, n, len, vol = 1) {
      const ac = c();
      const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      const lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; const fr = midiF(n);
      o.frequency.setValueAtTime(fr * 0.985, t); o.frequency.linearRampToValueAtTime(fr, t + 0.05);
      o2.frequency.value = fr * 1.003;
      lfo.frequency.value = 5.8; lg.gain.value = fr * 0.012; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.1;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07 * vol, t + 0.03);
      g.gain.setValueAtTime(0.07 * vol, t + Math.max(0.04, len - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
      const g2 = ac.createGain(); g2.gain.value = 0.4;
      o.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(bus());
      for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + len + 0.1); }
    },
    // campana del asalto: tres toques metálicos
    bell(times = 3) {
      if (!ok()) return; const t0 = c().currentTime;
      for (let i = 0; i < times; i++) { const t = t0 + i * 0.22; osc('sine', 1650, t, 1.1, 0.16); osc('sine', 2480, t, 0.6, 0.07); osc('triangle', 830, t, 0.5, 0.05); }
    },
    // golpes
    hit(kind = 'jab', crit = false) {
      if (!ok()) return; const t = c().currentTime;
      const heavy = kind === 'kick' || kind === 'knee';
      noise(t, heavy ? 0.16 : 0.1, heavy ? 0.75 : 0.55, heavy ? 700 : 1300, 'lowpass');
      osc('sine', heavy ? 120 : 170, t, heavy ? 0.22 : 0.13, heavy ? 0.8 : 0.55, { f2: heavy ? 42 : 60 });
      if (crit) { osc('square', 880, t, 0.18, 0.08, { f2: 1760 }); noise(t, 0.35, 0.4, 2500, 'bandpass', 0.7); }
    },
    block() { if (!ok()) return; const t = c().currentTime; noise(t, 0.09, 0.45, 500, 'lowpass'); osc('sine', 110, t, 0.1, 0.4, { f2: 70 }); },
    whoosh(kind = 'jab') { if (!ok()) return; const t = c().currentTime; const heavy = kind === 'kick'; noise(t, heavy ? 0.28 : 0.14, heavy ? 0.28 : 0.16, heavy ? 900 : 1700, 'bandpass', 1.4); },
    perfect() { if (!ok()) return; const t = c().currentTime; [1047, 1568, 2093].forEach((f, i) => osc('triangle', f, t + i * 0.05, 0.25, 0.09)); },
    tell(kind) { if (!ok()) return; const t = c().currentTime; osc('triangle', kind === 'kick' ? 330 : 520, t, 0.25, 0.08, { f2: kind === 'kick' ? 660 : 900 }); },
    ko() { if (!ok()) return; const t = c().currentTime; noise(t, 0.9, 0.7, 400, 'lowpass'); osc('sine', 90, t, 0.8, 0.8, { f2: 30 }); },
    tap(good) { if (!ok()) return; const t = c().currentTime; if (good) S.gong(t, 76 + (Math.random() * 3 | 0) * 2, 0.9); else noise(t, 0.08, 0.2, 400, 'lowpass'); },
  };
  return S;
}

// Partitura del wai kru: devuelve los eventos de música (t en segundos)
export function partituraWaiKru(bpm, beats) {
  const spb = 60 / bpm, ev = [];
  // melodía del pi: frases pentatónicas que suben y bajan (base Re4 = 62)
  const phrase = [0, 1, 2, 3, 2, 1, 2, 4, 3, 2, 1, 0, 1, 2, 1, 0];
  const root = 62;
  for (let b = 0; b < beats; b++) {
    const t = b * spb;
    ev.push({ t, k: b % 2 === 0 ? 'ching' : 'chap' });
    const bar = b % 4;
    if (bar === 0) ev.push({ t, k: 'drum', f: 88 });
    if (bar === 2) ev.push({ t, k: 'drum', f: 104 });
    if (bar === 3) ev.push({ t: t + spb / 2, k: 'slap' });
    if (b >= 2) {
      const i = (b - 2) % phrase.length;
      const deg = phrase[i] + (Math.floor((b - 2) / phrase.length) % 2) * 1;
      const oct = Math.floor(deg / 5), n = root + PENTA[deg % 5] + oct * 12;
      ev.push({ t, k: 'pi', n, len: spb * 0.95 });
      if (b > 16 && b % 2 === 1) ev.push({ t: t + spb / 2, k: 'pi', n: n + (PENTA[(deg + 1) % 5] - PENTA[deg % 5] + 12) % 12, len: spb * 0.45 });
    }
    if (b % 8 === 7) ev.push({ t, k: 'gong', n: 74 });
  }
  return ev.sort((a, b) => a.t - b.t);
}
