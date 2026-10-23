// Sonido 100 % generado con WebAudio (sin archivos de audio).
// API estable que usan las etapas:
//   audio.unlock()                      en el primer toque (iOS lo exige)
//   audio.music(id) / audio.stopMusic() pistas en src/audio/pistas.js
//   audio.sfx(nombre, { vol, pitch })   efectos en src/audio/efectos.js
//   audio.loop(nombre) → { set({ rate, vol }), stop() }   motores, lluvia, olas, público
//   audio.setVolumes(music, sfx)
import { PISTAS } from '../audio/pistas.js';
import { EFECTOS, LOOPS } from '../audio/efectos.js';
import { Secuenciador } from '../audio/secuenciador.js';

class Audio {
  constructor() {
    this.ctx = null;
    this.vol = { music: 0.7, sfx: 0.9 };
    this.current = null;
    this.currentId = null;
    this.loops = new Set();
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain(); this.master.gain.value = 1;
        // compresor suave para que nada sature en el altavoz del móvil
        this.comp = this.ctx.createDynamicsCompressor();
        this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.005; this.comp.release.value = 0.2;
        this.master.connect(this.comp).connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.vol.music * 0.55; this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
        this._noise = makeNoise(this.ctx);
        if (this._pendingMusic) { const id = this._pendingMusic; this._pendingMusic = null; this.music(id); }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* sin audio */ }
  }

  get ready() { return !!this.ctx; }

  setVolumes(music, sfx) {
    this.vol.music = music; this.vol.sfx = sfx;
    if (this.ctx) {
      this.musicBus.gain.setTargetAtTime(music * 0.55, this.ctx.currentTime, 0.05);
      this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    }
  }

  music(id) {
    if (this.currentId === id && this.current) return;
    if (!this.ctx) { this._pendingMusic = id; return; }
    this.stopMusic(0.8);
    const def = PISTAS[id];
    if (!def) return;
    this.currentId = id;
    try { this.current = new Secuenciador(this.ctx, this.musicBus, def, this._noise); this.current.start(); } catch (e) { console.warn('música', e); }
  }

  stopMusic(fade = 0.6) {
    this._pendingMusic = null;
    if (this.current) { const c = this.current; c.stop(fade); }
    this.current = null; this.currentId = null;
  }

  // Intensidad musical 0..1 (las pistas pueden abrir capas: p. ej. al ir con turbo)
  intensity(v) { if (this.current && this.current.setIntensity) this.current.setIntensity(v); }

  sfx(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const f = EFECTOS[name];
    if (!f) return;
    try { f(this.ctx, this.sfxBus, { vol: 1, pitch: 1, ...opts }, this._noise); } catch (e) { /* nada */ }
  }

  loop(name) {
    const dummy = { set() {}, stop() {} };
    if (!this.ctx) return dummy;
    const f = LOOPS[name];
    if (!f) return dummy;
    try {
      const l = f(this.ctx, this.sfxBus, this._noise);
      const self = this;
      const wrapped = { set: (o) => l.set(o), stop: () => { self.loops.delete(wrapped); l.stop(); } };
      this.loops.add(wrapped);
      return wrapped;
    } catch (e) { return dummy; }
  }

  stopLoops() { for (const l of [...this.loops]) l.stop(); }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}

function makeNoise(ctx) {
  const len = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export const audio = new Audio();
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });
