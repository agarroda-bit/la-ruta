// Secuenciador mínimo (provisional): lo amplía el agente de audio.
// def = { bpm, steps, tracks: [{ type:'kick'|'hat'|'snare'|'bass'|'lead'|'pad', notes:[...] }] }
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
export class Secuenciador {
  constructor(ctx, out, def, noise) {
    this.ctx = ctx; this.def = def; this.noise = noise;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(out);
    this.step = 0; this.next = 0; this.timer = null;
  }
  start() {
    const t = this.ctx.currentTime;
    this.out.gain.setValueAtTime(0, t); this.out.gain.linearRampToValueAtTime(1, t + 1.2);
    this.next = t + 0.1;
    this.timer = setInterval(() => this.tick(), 50);
  }
  tick() {
    const spb = 60 / this.def.bpm / 4;
    while (this.next < this.ctx.currentTime + 0.2) {
      for (const tr of this.def.tracks) {
        const n = tr.notes[this.step % tr.notes.length];
        if (n != null && n !== 0) this.play(tr, n, this.next, spb);
      }
      this.step++; this.next += spb;
    }
  }
  play(tr, n, t, spb) {
    const c = this.ctx;
    if (tr.type === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.3);
    } else if (tr.type === 'hat' || tr.type === 'snare') {
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = tr.type === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = tr.type === 'hat' ? 7000 : 1800;
      const g = c.createGain(); const d = tr.type === 'hat' ? 0.05 : 0.18;
      g.gain.setValueAtTime(tr.type === 'hat' ? 0.25 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + d + 0.02);
    } else {
      const o = c.createOscillator(), g = c.createGain();
      o.type = tr.type === 'bass' ? 'triangle' : tr.type === 'pad' ? 'sine' : 'square';
      o.frequency.value = midi(n);
      const len = spb * (tr.len || 1), v = tr.vol || (tr.type === 'lead' ? 0.12 : 0.3);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      o.connect(g).connect(this.out); o.start(t); o.stop(t + len + 0.05);
    }
  }
  setIntensity() {}
  stop(fade = 0.6) {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(this.out.gain.value, t); this.out.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { clearInterval(this.timer); this.out.disconnect(); }, fade * 1000 + 100);
  }
}
