// Sonido 100 % generado con WebAudio (sin archivos de audio).
// API estable que usan las etapas:
//   audio.unlock()                      en el primer toque (iOS lo exige)
//   audio.music(id) / audio.stopMusic() pistas en src/audio/pistas.js
//   audio.sfx(nombre, { vol, pitch })   efectos en src/audio/efectos.js
//   audio.loop(nombre) → { set({ rate, vol }), stop() }   motores, lluvia, olas, público
//   audio.setVolumes(music, sfx)
import { PISTAS } from '../audio/pistas.js';
import { EFECTOS, LOOPS, precalentarEfectos } from '../audio/efectos.js';
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
      // iPhone: que suene aunque el interruptor de silencio esté puesto (Safari 16.4+)
      try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* nada */ }
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain(); this.master.gain.value = 1;
        // compresor suave para que nada sature en el altavoz del móvil
        this.comp = this.ctx.createDynamicsCompressor();
        // casi limitador: solo actúa en picos (música + muchos efectos a la vez)
        this.comp.threshold.value = -8; this.comp.knee.value = 6; this.comp.ratio.value = 12; this.comp.attack.value = 0.003; this.comp.release.value = 0.25;
        this.master.connect(this.comp).connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.vol.music * 0.55; this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
        this._noise = makeNoise(this.ctx);
        try { precalentarEfectos(this.ctx); } catch (e) { /* */ }
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
    // anti-ametralladora: el mismo efecto como mucho cada 30 ms, y no más de 24 efectos sonando
    const now = performance.now();
    this._ult = this._ult || {};
    if (now - (this._ult[name] || 0) < 30) return;
    this._vivos = (this._vivos || []).filter((t) => t > now);
    if (this._vivos.length >= 24) return;
    this._ult[name] = now; this._vivos.push(now + 900);
    try { f(this.ctx, this.sfxBus, { vol: 1, pitch: 1, ...opts }, this._noise); } catch (e) { /* nada */ }
  }

  // Pulso de la música actual (para minijuegos de ritmo): { bpm, beat (pulsos desde que empezó), t0, now }
  beatInfo() { return this.current && this.current.info ? this.current.info() : null; }

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
// Ayudas de prueba (no las usa el juego): (await __audioDemo.analisis()).analizar() mide niveles offline
if (typeof window !== 'undefined') {
  window.__audioDemo = {
    audio,
    pistas: () => Object.keys(PISTAS), efectos: () => Object.keys(EFECTOS), bucles: () => Object.keys(LOOPS),
    stats: () => (audio.current ? audio.current.stats : null),
    analisis: () => import('../audio/analisis.js'),
  };
}
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });
