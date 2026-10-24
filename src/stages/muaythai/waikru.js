// Wai kru: el baile ritual para honrar al maestro, como minijuego de ritmo.
// Los símbolos bajan por tres carriles y se tocan al llegar a su círculo, a tiempo
// con la música (pi, tambores y ching). Precisión → bonus de energía en el combate.
import { partituraWaiKru } from './sonido.js';
import { KEY_HINT } from './interfaz.js';

export const BPM = 96;
const SPB = 60 / BPM;
const LEAD_BEATS = 4;
const END_BEAT = 40;
const LEAD = 1.55;          // segundos que tarda un símbolo en bajar
const W_PERFECT = 0.075, W_GOOD = 0.155;

export function crearPartitura(rng) {
  const notes = [];
  let last = -1, rep = 0;
  const pickLane = (b) => {
    let l = b % 4 === 0 && rng() < 0.6 ? 1 : rng.int(0, 2);
    if (l === last) { rep++; if (rep >= 2) l = (l + rng.int(1, 2)) % 3; } else rep = 0;
    if (l !== last) rep = 0;
    last = l; return l;
  };
  for (let b = LEAD_BEATS; b < END_BEAT; b++) {
    if (b < 20) { if (b % 4 === 3) continue; notes.push({ t: b * SPB, lane: pickLane(b) }); }
    else {
      notes.push({ t: b * SPB, lane: pickLane(b) });
      if (b % 2 === 1 && b < END_BEAT - 1 && rng() < 0.35) notes.push({ t: (b + 0.5) * SPB, lane: pickLane(b + 1) });
    }
  }
  return notes;
}

export class WaiKru {
  constructor({ rng, players, sonido, capa, onJudge, ai = null, solo = false }) {
    this.solo = solo;
    this.chart = crearPartitura(rng);
    this.players = players;
    this.p = [];
    for (let i = 0; i < 2; i++) {
      this.p.push({ notes: this.chart.map((n) => ({ ...n, j: null })), perfect: 0, good: 0, miss: 0, combo: 0, best: 0, flashes: [0, 0, 0], last: '' });
    }
    this.music = partituraWaiKru(BPM, END_BEAT + 4);
    this.mi = 0;
    this.clock = -0.4;
    this.sonido = sonido; this.capa = capa; this.onJudge = onJudge;
    this.ai = ai; // { p: 1, skill: 0.8, rng }
    this.duration = (END_BEAT + 2) * SPB;
    this.done = false;
    this.lanes = [[], []];
    this.keyboard = false;
  }
  get total() { return this.chart.length; }
  precision(i) { const s = this.p[i]; return this.total ? (s.perfect + s.good * 0.7) / this.total : 0; }
  perfecto(i) { const s = this.p[i]; return s.miss === 0 && s.perfect + s.good === this.total; }

  // presses: [[bool,bool,bool], [bool,bool,bool]] pulsaciones de este frame por jugador y carril
  update(realDt, presses) {
    if (this.done) return;
    this.clock += realDt;
    const c = this.clock;
    // música con un pelín de anticipación, enganchada a nuestro reloj
    if (this.sonido.ok) {
      const now = this.sonido.now();
      while (this.mi < this.music.length && this.music[this.mi].t < c + 0.12) {
        const e = this.music[this.mi++];
        const at = now + Math.max(0, e.t - c);
        if (e.t < c - 0.05) continue;
        if (e.k === 'ching') this.sonido.ching(at); else if (e.k === 'chap') this.sonido.chap(at);
        else if (e.k === 'drum') this.sonido.drum(at, e.f); else if (e.k === 'slap') this.sonido.slap(at);
        else if (e.k === 'pi') this.sonido.pi(at, e.n, e.len); else if (e.k === 'gong') this.sonido.gong(at, e.n);
      }
    } else {
      while (this.mi < this.music.length && this.music[this.mi].t < c) this.mi++;
    }
    for (let i = 0; i < this.players; i++) {
      const s = this.p[i];
      for (let l = 0; l < 3; l++) s.flashes[l] = Math.max(0, s.flashes[l] - realDt * 3);
      let pr = presses[i] || [];
      if (this.ai && this.ai.p === i) pr = this._aiPress(s, c);
      for (let l = 0; l < 3; l++) if (pr[l]) this._press(i, l, c);
      for (const n of s.notes) {
        if (n.j) continue;
        if (c - n.t > W_GOOD) { n.j = 'fallo'; s.miss++; s.combo = 0; this.onJudge && this.onJudge(i, n.lane, 'fallo'); }
        else if (n.t > c + 0.5) break;
      }
    }
    if (c >= this.duration) this.done = true;
  }

  _aiPress(s, c) {
    const out = [false, false, false];
    for (const n of s.notes) {
      if (n.j) continue;
      if (n.t > c + 0.1) break;
      if (n._ai === undefined) n._ai = this.ai.rng() < this.ai.skill ? (this.ai.rng() - 0.5) * 0.09 : 9;
      if (c >= n.t + n._ai) out[n.lane] = true;
    }
    return out;
  }

  _press(i, lane, c) {
    const s = this.p[i];
    let best = null, bd = Infinity;
    for (const n of s.notes) {
      if (n.j || n.lane !== lane) continue;
      const d = Math.abs(n.t - c);
      if (d < bd) { bd = d; best = n; }
      if (n.t > c + W_GOOD) break;
    }
    s.flashes[lane] = 1;
    if (!best || bd > W_GOOD) { this.sonido.tap(false); return; }
    best.j = bd <= W_PERFECT ? 'perfecto' : 'bien';
    if (best.j === 'perfecto') s.perfect++; else s.good++;
    s.combo++; s.best = Math.max(s.best, s.combo);
    this.sonido.tap(true);
    this.onJudge && this.onJudge(i, lane, best.j);
  }

  // estado para las pruebas: próximos símbolos de cada jugador
  snapshot() {
    const c = this.clock;
    return {
      clock: +c.toFixed(3), at: performance.now(), duration: +this.duration.toFixed(2), done: this.done, total: this.total,
      players: this.p.slice(0, this.players).map((s, i) => ({
        perfect: s.perfect, good: s.good, miss: s.miss, combo: s.combo, precision: +this.precision(i).toFixed(3),
        next: s.notes.filter((n) => !n.j).slice(0, 3).map((n) => ({ lane: n.lane, dt: +(n.t - c).toFixed(3) })),
      })),
    };
  }

  draw(canvas, lanes, { keyboard = false, humans = [0] } = {}) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (this.done) return;
    const c = this.clock;
    for (const i of humans) {
      const L = lanes[i]; if (!L || !L.length) continue;
      const s = this.p[i];
      const hint = KEY_HINT[this.solo ? 'solo' : i];
      for (let l = 0; l < 3; l++) {
        const ln = L[l];
        const dist = Math.abs(ln.y - ln.top);
        const R = ln.r || 30;
        // carril que acaba en el botón
        const yEnd = ln.y - ln.dir * (R + 8);
        const x0 = ln.x - R * 0.8, y0 = Math.min(ln.top, yEnd), hh = Math.abs(yEnd - ln.top);
        const gr = g.createLinearGradient(0, ln.top, 0, yEnd);
        gr.addColorStop(0, 'rgba(26,16,54,0)'); gr.addColorStop(1, 'rgba(26,16,54,0.5)');
        g.fillStyle = gr; g.fillRect(x0, y0, R * 1.6, hh);
        g.fillStyle = 'rgba(255,207,63,0.3)'; g.fillRect(x0, y0, 2, hh); g.fillRect(x0 + R * 1.6 - 2, y0, 2, hh);
        // diana = anillo dorado alrededor del botón
        const f = s.flashes[l];
        if (keyboard) {
          g.fillStyle = 'rgba(26,16,54,0.6)'; g.beginPath(); g.arc(ln.x, ln.y, R, 0, Math.PI * 2); g.fill();
          this._glyph(g, l, ln.x, ln.y, R * 0.5, ln.rot, 'rgba(255,207,63,0.7)');
        }
        g.lineWidth = 5 + f * 3; g.strokeStyle = `rgba(255,207,63,${0.8 + f * 0.2})`;
        g.beginPath(); g.arc(ln.x, ln.y, R + 5 + f * 8, 0, Math.PI * 2); g.stroke();
        if (keyboard) {
          g.save(); g.translate(ln.x, ln.y + (ln.rot ? -1 : 1) * (R + 20)); if (ln.rot) g.rotate(Math.PI);
          g.font = '800 19px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = '#fff'; g.fillText(hint['l' + l], 0, 0); g.restore();
        }
      }
      // símbolos
      for (const n of s.notes) {
        const dt = n.t - c;
        if (dt > LEAD) break;
        const ln = L[n.lane];
        const dist = Math.abs(ln.y - ln.top);
        const R = (ln.r || 30) * 0.95;
        if (n.j && n.j !== 'fallo') continue;
        if (n.j === 'fallo' && dt < -0.35) continue;
        const k = dt / LEAD;
        const y = ln.y - ln.dir * k * dist;
        const a = n.j === 'fallo' ? Math.max(0, 1 + dt * 3) * 0.6 : Math.min(1, (1 - k) * 4);
        g.globalAlpha = a;
        g.fillStyle = n.j === 'fallo' ? '#6b5a5a' : '#ffcf3f';
        g.strokeStyle = '#1a1036'; g.lineWidth = 4;
        g.beginPath(); g.arc(ln.x, y, R * 0.82, 0, Math.PI * 2); g.fill(); g.stroke();
        this._glyph(g, n.lane, ln.x, y, R * 0.5, ln.rot, '#9d0208');
        g.globalAlpha = 1;
      }
      // combo y progreso
      const l1 = L[1];
      const ty = l1.top + (l1.rot ? 18 : -18);
      g.save(); g.translate(l1.x, ty); if (l1.rot) g.rotate(Math.PI);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '20px Bungee, system-ui, sans-serif';
      g.lineWidth = 4; g.strokeStyle = '#1a1036'; g.fillStyle = '#ffcf3f';
      const txt = s.combo >= 3 ? `COMBO ${s.combo}` : 'WAI KRU';
      g.strokeText(txt, 0, 0); g.fillText(txt, 0, 0);
      const pw = 150, prog = Math.max(0, Math.min(1, c / this.duration));
      g.fillStyle = 'rgba(26,16,54,0.7)'; g.fillRect(-pw / 2, 16, pw, 6);
      g.fillStyle = '#ffcf3f'; g.fillRect(-pw / 2, 16, pw * prog, 6);
      g.restore();
    }
  }

  _glyph(g, lane, x, y, r, rot, color) {
    g.save(); g.translate(x, y); if (rot) g.rotate(Math.PI);
    g.fillStyle = color;
    if (lane === 0 || lane === 2) {
      const s = lane === 0 ? -1 : 1;
      g.beginPath(); g.moveTo(s * r, 0); g.lineTo(-s * r * 0.6, -r * 0.85); g.lineTo(-s * r * 0.6, r * 0.85); g.closePath(); g.fill();
    } else {
      // loto: manos juntas (wai)
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(k * r * 0.5, r * 0.1 - Math.abs(k) * -r * 0.15, r * 0.32, r * 0.8, k * 0.5, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }
}
