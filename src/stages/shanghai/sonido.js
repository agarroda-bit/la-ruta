// Zumbido del maglev: dos osciladores filtrados que suben con la velocidad. Se cuelga del
// bus de efectos del núcleo (sin tocar src/audio) y se crea en cuanto el audio está listo.
export function makeHum(audio) {
  try {
    const ac = audio.ctx;
    if (!ac || !audio.sfxBus) return null;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'sine';
    f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 4;
    g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g).connect(audio.sfxBus);
    o1.start(); o2.start();
    return {
      set(k, vol) {
        const t = ac.currentTime;
        o1.frequency.setTargetAtTime(38 + k * 150, t, 0.12);
        o2.frequency.setTargetAtTime(90 + k * 520, t, 0.12);
        f.frequency.setTargetAtTime(260 + k * 2200, t, 0.12);
        g.gain.setTargetAtTime(vol, t, 0.12);
      },
      stop() {
        try { g.gain.setTargetAtTime(0, ac.currentTime, 0.08); } catch (e) { /* nada */ }
        setTimeout(() => { try { o1.stop(); o2.stop(); } catch (e) { /* nada */ } }, 400);
      },
    };
  } catch (e) { return null; }
}
