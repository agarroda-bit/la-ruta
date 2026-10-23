// Reglas del combate: luchadores, golpes, bloqueo, esquiva, contraataque crítico
// y la IA de Somchai «el Bambú» con sus patrones telegrafiados.
import { POSES, moveKeys, ease } from './luchador.js';

export const MOVES = {
  jab: { startup: 0.11, active: 0.05, recover: 0.17, dmg: 4, cost: 4, reach: 1.6, lunge: 0.1, kind: 'jab' },
  cross: { startup: 0.15, active: 0.05, recover: 0.24, dmg: 7, cost: 6, reach: 1.65, lunge: 0.14, kind: 'cross' },
  kick: { startup: 0.3, active: 0.08, recover: 0.36, dmg: 13, cost: 13, reach: 1.85, lunge: 0.1, kind: 'kick', heavy: true },
  knee: { startup: 0.2, active: 0.06, recover: 0.3, dmg: 10, cost: 10, reach: 1.35, lunge: 0.38, kind: 'knee', heavy: true },
  elbow: { startup: 0.15, active: 0.05, recover: 0.28, dmg: 9, cost: 8, reach: 1.3, lunge: 0.34, kind: 'elbow' },
  // versiones de los patrones del rival
  kickBig: { startup: 0.34, active: 0.08, recover: 0.4, dmg: 15, cost: 8, reach: 1.9, lunge: 0.12, kind: 'kick', heavy: true, pose: 'kick' },
  kneeC: { startup: 0.2, active: 0.06, recover: 0.22, dmg: 8, cost: 4, reach: 1.45, lunge: 0.42, kind: 'knee', heavy: true, clinch: true, pose: 'knee' },
  elbowF: { startup: 0.13, active: 0.05, recover: 0.3, dmg: 11, cost: 4, reach: 1.4, lunge: 0.4, kind: 'elbow', pose: 'elbow' },
  jabR: { startup: 0.12, active: 0.05, recover: 0.12, dmg: 4, cost: 2, reach: 1.6, lunge: 0.1, kind: 'jab', pose: 'jab' },
  crossR: { startup: 0.15, active: 0.05, recover: 0.22, dmg: 6, cost: 3, reach: 1.65, lunge: 0.14, kind: 'cross', pose: 'cross' },
};
const DODGE_DUR = 0.42, DODGE_PERFECT = 0.3, BLOCK_PERFECT = 0.22;
export const RING_LIMIT = 2.85;

export class Fighter {
  constructor({ idx, ch, gear, anim, name, hp = 100 }) {
    Object.assign(this, { idx, ch, gear, anim, name });
    this.hp = hp; this.hpMax = hp; this.st = 100; this.stMax = 100;
    this.x = idx === 0 ? -0.66 : 0.66; this.vx = 0;
    this.action = null; this.blocking = false; this.blockAge = 9; this.dodgeAge = 9; this.dodgeCd = 0;
    this.stun = 0; this.crit = 0; this.hitT = 0; this.tell = null; this.armor = false; this.ko = false;
    this.lastPunch = { t: -9, k: '' }; this.lastKnee = { t: -9, k: '' }; this.lastBlockPress = -9; this.buffer = null;
    this.stats = { thrown: 0, landed: 0, blocked: 0, perfect: 0, dmg: 0, points: 0, crits: 0, evaded: 0, taken: 0 };
    this.time = 0; this.freeze = false; this.celebrate = null;
  }
  get dir() { return this.idx === 0 ? 1 : -1; }
  get free() { return !this.ko && !this.action && this.stun <= 0 && this.hitT <= 0.1 && this.dodgeAge > DODGE_DUR && !this.tell && !this.freeze; }
  get dodging() { return this.dodgeAge <= DODGE_DUR; }

  // intención de este frame: { punch, kick, knee, block, dodge, move }
  applyIntent(it, fight) {
    if (this.ko || this.freeze) { this.blocking = false; return; }
    const wasBlock = this.blocking;
    if (it.blockPress) {
      if (this.time - this.lastBlockPress < 0.28) it.dodge = true;
      this.lastBlockPress = this.time;
    }
    const canAct = this.stun <= 0 && this.hitT <= 0.1 && !this.tell;
    if (canAct && it.dodge && this.dodgeCd <= 0 && !this.action && this.st >= 4) {
      this.dodgeAge = 0; this.dodgeCd = 0.62; this.st -= 6; this.blocking = false;
      this.anim.stop();
      fight.emit('dodge', { f: this });
      return;
    }
    let want = it.move || null;
    if (!want) {
      if (it.punch) { want = this.time - this.lastPunch.t < 0.6 && this.lastPunch.k === 'jab' ? 'cross' : 'jab'; }
      else if (it.kick) want = 'kick';
      else if (it.knee) { want = this.time - this.lastKnee.t < 0.6 && this.lastKnee.k === 'knee' ? 'elbow' : 'knee'; }
    }
    if (want) {
      if (canAct && !this.action && !this.dodging) this.startMove(want, fight);
      else this.buffer = { m: want, t: 0.22 };
    }
    this.blocking = canAct && !!it.block && !this.action && !this.dodging;
    if (this.blocking && !wasBlock) this.blockAge = 0;
  }

  startMove(name, fight) {
    const mv = MOVES[name];
    if (!mv) return;
    if (name === 'jab' || name === 'cross') this.lastPunch = { t: this.time, k: name };
    if (name === 'knee' || name === 'elbow') this.lastKnee = { t: this.time, k: name };
    const weak = this.st < mv.cost;
    this.st = Math.max(0, this.st - mv.cost);
    const speed = weak ? 0.8 : 1;
    this.action = { name, mv, t: 0, hit: false, weak, speed };
    this.blocking = false; this.buffer = null;
    this.stats.thrown++;
    this.anim.play(moveKeys(mv.pose || name, mv), { speed });
    fight.emit('start', { f: this, mv });
  }

  update(dt, fight) {
    this.time += dt;
    this.stun = Math.max(0, this.stun - dt);
    this.crit = Math.max(0, this.crit - dt);
    this.hitT = Math.max(0, this.hitT - dt);
    this.dodgeAge += dt; this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.blockAge += dt;
    if (this.buffer) { this.buffer.t -= dt; if (this.buffer.t <= 0) this.buffer = null; else if (this.free) this.startMove(this.buffer.m, fight); }
    if (this.tell) {
      this.tell.t += dt;
      const k = Math.min(1, this.tell.t / this.tell.dur);
      const pulse = 0.55 + 0.45 * Math.sin(this.tell.t * 22);
      for (const a of this.tell.auras) this.gear.setAura(a, (0.35 + 0.65 * k) * pulse);
      if (this.tell.t >= this.tell.dur) { const t = this.tell; this.tell = null; this.armor = false; this.gear.clearAuras(); if (t.onEnd) t.onEnd(); }
    }
    const a = this.action;
    if (a) {
      const st = a.mv.startup / a.speed;
      const prev = a.t; a.t += dt;
      if (a.t < st) this.x += this.dir * a.mv.lunge * (dt / st);
      if (!a.hit && prev < st && a.t >= st) { a.hit = true; fight.resolve(this, a); }
      if (this.action && a.t >= (a.mv.startup + a.mv.active + a.mv.recover) / a.speed) this.action = null;
    }
    // aguante
    const regen = this.action ? 0 : this.blocking ? 6 : this.dodging ? 4 : 17;
    this.st = Math.min(this.stMax, this.st + regen * dt);
    // empujón
    this.x += this.vx * dt; this.vx *= Math.exp(-dt * 7);
    this.updateAnim(dt);
  }

  updateAnim(dt) {
    if (this.ko) { this.anim.update(dt, this.time); return; }
    const t = this.time;
    if (this.celebrate) this.anim.base = this.celebrate;
    else if (this.stun > 0) this.anim.base = (tt) => ({ ...POSES.stun, ry: Math.sin(tt * 7) * 0.25, rz: Math.sin(tt * 5) * 0.08, nz: Math.sin(tt * 6) * 0.2 });
    else if (this.dodging) this.anim.base = () => POSES.dodge;
    else if (this.blocking) this.anim.base = () => POSES.block;
    else if (this.tell) { const p = POSES[this.tell.pose] || POSES.guard; this.anim.base = (tt) => ({ ...p, hy: p.hy + Math.sin(tt * 14) * 0.012 }); }
    else this.anim.base = (tt) => ({ ...POSES.guard, hy: POSES.guard.hy + Math.sin(tt * 5.5) * 0.022, ty: POSES.guard.ty + Math.sin(tt * 2.7) * 0.06, nx: POSES.guard.nx + Math.sin(tt * 5.5) * 0.03 });
    this.anim.rate = this.dodging ? 26 : this.blocking ? 24 : 14;
    this.anim.update(dt, t);
  }

  setTell(pat, dur, onEnd) {
    this.tell = { pat: pat.id, pose: pat.pose, auras: pat.auras, t: 0, dur, onEnd };
    this.armor = true; this.blocking = false;
  }
  cancelTell() { if (this.tell) { this.tell = null; this.armor = false; this.gear.clearAuras(); } }

  knockout() {
    this.ko = true; this.action = null; this.blocking = false; this.cancelTell();
    this.anim.play([[0.25, POSES.koKnees, ease.out], [0.7, POSES.ko, ease.in]]);
    this.anim.base = () => POSES.ko;
  }
  getUp(onDone) {
    this.anim.play([[0.5, POSES.koKnees, ease.inOut], [1.1, POSES.guard, ease.out]], { onEnd: onDone });
    this.ko = false;
  }
}

// ───────── combate ─────────
export class Fight {
  constructor(f0, f1) {
    this.f = [f0, f1];
    this.handlers = {};
    this.paused = false;
  }
  on(ev, fn) { this.handlers[ev] = fn; }
  emit(ev, data) { const h = this.handlers[ev]; if (h) h(data); }
  other(f) { return f === this.f[0] ? this.f[1] : this.f[0]; }

  update(dt) {
    const [a, b] = this.f;
    a.update(dt, this); b.update(dt, this);
    // separación: buscan su distancia, no se cruzan y vuelven al centro
    const D = 1.32;
    const dist = b.x - a.x;
    const canMove = (f) => !f.action && !f.ko && f.hitT <= 0 && !f.freeze;
    if (dist > D + 0.02) {
      const sp = 1.7 * dt * Math.min(1, (dist - D) * 2);
      if (canMove(a)) a.x += sp; if (canMove(b)) b.x -= sp;
    } else if (dist < D - 0.12) {
      const sp = 1.2 * dt;
      if (canMove(a) && !a.dodging) a.x -= sp; if (canMove(b) && !b.dodging) b.x += sp;
    }
    if (b.x - a.x < 0.72) { const m = (a.x + b.x) / 2; a.x = m - 0.36; b.x = m + 0.36; }
    const mid = (a.x + b.x) / 2;
    const pull = -mid * Math.min(1, dt * 0.6);
    if (!a.ko && !b.ko) { a.x += pull; b.x += pull; }
    a.x = Math.max(-RING_LIMIT, Math.min(RING_LIMIT, a.x));
    b.x = Math.max(-RING_LIMIT, Math.min(RING_LIMIT, b.x));
  }

  resolve(att, act) {
    const def = this.other(att);
    const mv = act.mv;
    const dist = Math.abs(att.x - def.x);
    const info = { a: att, d: def, mv, act };
    if (def.ko || dist > mv.reach) { this.emit('miss', info); return; }
    if (def.dodging && def.dodgeAge <= DODGE_DUR - 0.04) {
      def.stats.evaded++;
      if (def.dodgeAge <= DODGE_PERFECT) { this.counter(att, def, info); this.emit('evade', { ...info, perfect: true }); }
      else this.emit('evade', { ...info, perfect: false });
      return;
    }
    let dmg = mv.dmg * (act.weak ? 0.55 : 1);
    if (def.blocking && def.stun <= 0) {
      if (def.st <= 1) {
        dmg *= 0.6; this.applyHit(att, def, dmg, info, true);
        return;
      }
      const chip = dmg * (mv.clinch ? 0.5 : 0.14);
      def.hp = Math.max(0, def.hp - chip);
      def.st = Math.max(0, def.st - dmg * 0.75);
      def.stats.blocked++;
      def.vx += att.dir * (mv.heavy ? 1.6 : 0.8);
      const perfect = def.blockAge <= BLOCK_PERFECT;
      if (perfect) { def.stats.perfect++; this.counter(att, def, info); }
      def.anim.kick({ tx: -0.12, nx: -0.12, pz: -0.05 });
      this.emit('block', { ...info, perfect, chip });
      if (def.hp <= 0) this.ko(att, def, info);
      return;
    }
    this.applyHit(att, def, dmg, info, false);
  }

  applyHit(att, def, dmg, info, guardBreak) {
    const crit = att.crit > 0;
    if (crit) { dmg *= 2.0; att.crit = 0; att.stats.crits++; }
    if (def.stun > 0 && !crit) dmg *= 1.25;
    dmg = Math.round(dmg * 10) / 10;
    def.hp = Math.max(0, def.hp - dmg);
    att.stats.landed++; att.stats.dmg += dmg; att.stats.points += dmg * (info.mv.heavy ? 1.3 : 1) * (crit ? 1.2 : 1);
    def.stats.taken += dmg;
    const heavy = info.mv.heavy || crit;
    def.vx += att.dir * (heavy ? 2.6 : 1.3);
    if (!def.armor) {
      def.hitT = heavy ? 0.42 : 0.26;
      if (def.action) { def.action = null; def.anim.stop(); }
      def.blocking = false;
    }
    const s = heavy ? 1.6 : 1;
    const k = info.mv.kind;
    def.anim.kick(k === 'kick' ? { tz: 0.35 * s * -att.dir * def.dir, tx: -0.2 * s, nx: -0.25 * s, nz: 0.3 * s, pz: -0.14 * s }
      : k === 'knee' ? { tx: 0.45 * s, nx: 0.3 * s, pz: -0.12 * s }
        : { nx: -0.5 * s, tx: -0.22 * s, ny: (k === 'jab' ? -0.3 : 0.35) * s, pz: -0.1 * s });
    this.emit('hit', { ...info, dmg, crit, guardBreak, heavy });
    if (def.hp <= 0) this.ko(att, def, info);
  }

  counter(att, def, info) {
    att.stun = 0.85; att.action = null; att.anim.stop(); att.cancelTell(); att.buffer = null;
    def.crit = 1.25;
    if (att.ai) att.ai.interrupt();
    this.emit('perfect', info);
  }

  ko(att, def, info) {
    if (def.ko) return;
    def.knockout();
    att.action = null;
    this.emit('ko', { ...info, winner: att, loser: def });
  }
}

// ───────── IA: Somchai «el Bambú» ─────────
export const PATTERNS = {
  rafaga: { id: 'rafaga', name: 'Ráfaga del Bambú', tell: 0.8, pose: 'tellRafaga', auras: ['gloveL', 'gloveR'], seq: [['jabR', 0], ['jabR', 0.06], ['crossR', 0.08]], hint: '<b>Guantes dorados</b>: ¡ráfaga! Bloquea justo antes del golpe.' },
  elefante: { id: 'elefante', name: 'Patada del Elefante', tell: 0.95, pose: 'tellKick', auras: ['legR', 'thighR'], seq: [['kickBig', 0]], hint: '<b>Pierna en llamas</b>: patadón. ¡Esquiva en el último momento!' },
  clinch: { id: 'clinch', name: 'Abrazo de la Abuela', tell: 0.85, pose: 'tellClinch', auras: ['thighR', 'gloveL', 'gloveR'], seq: [['kneeC', 0], ['kneeC', 0.12]], hint: '<b>Brazos abiertos</b>: rodillazos. ¡Esquívalos o te pilla!' },
  codo: { id: 'codo', name: 'Codo Relámpago', tell: 0.55, pose: 'tellElbow', auras: ['armR'], seq: [['elbowF', 0]], minRound: 2, hint: '<b>Codo rojo</b>: llega rapidísimo. ¡Bloquea ya!' },
};

export class RivalAI {
  constructor(f, foe, rng, fight) {
    Object.assign(this, { f, foe, rng, fight });
    f.ai = this;
    this.round = 1;
    this.decide = 1.0; this.patCd = 2.2; this.queue = []; this.qDelay = 0; this.blockFor = 0;
    this.lastPat = ''; this.seen = new Set(); this.reacted = null;
    this.onTell = null; this.current = null;
  }
  get speed() { return this.round === 1 ? 1 : this.round === 2 ? 0.86 : 0.74; }
  interrupt() { this.queue = []; this.current = null; this.blockFor = 0; }

  intent(dt) {
    const it = { block: false };
    const f = this.f, foe = this.foe;
    if (f.ko || foe.ko || f.freeze) return it;
    this.decide -= dt; this.patCd -= dt; this.blockFor -= dt;
    // ejecutar la secuencia del patrón
    if (this.queue.length) {
      this.qDelay -= dt;
      if (f.free && this.qDelay <= 0) {
        const [m] = this.queue.shift();
        it.move = m;
        this.qDelay = this.queue.length ? this.queue[0][1] : 0;
        if (!this.queue.length) this.current = null;
      }
      return it;
    }
    if (f.tell) return it;
    // reacción a los golpes del jugador
    const fa = foe.action;
    if (fa && fa !== this.reacted && fa.t > 0.1 && !fa.hit) {
      this.reacted = fa;
      const pb = [0, 0.35, 0.45, 0.55][this.round] || 0.55;
      const r = this.rng();
      if (fa.mv.kind === 'kick' && r < pb * 0.45 && f.dodgeCd <= 0) it.dodge = true;
      else if (r < pb) this.blockFor = 0.45 + this.rng() * 0.3;
    }
    if (this.blockFor > 0) { it.block = true; return it; }
    if (this.decide > 0 || !f.free) return it;
    // decidir
    if (this.patCd <= 0 && foe.hp > 0) {
      const list = Object.values(PATTERNS).filter((p) => (p.minRound || 1) <= this.round && p.id !== this.lastPat);
      let pat = list[Math.floor(this.rng() * list.length)];
      // los dos primeros siempre en el mismo orden: se aprenden
      if (!this.seen.has('rafaga')) pat = PATTERNS.rafaga; else if (!this.seen.has('elefante')) pat = PATTERNS.elefante;
      this.startPattern(pat);
      return it;
    }
    const r = this.rng();
    if (r < 0.32) { it.move = 'jabR'; if (this.rng() < 0.4) this.queue.push(['crossR', 0.1]), this.qDelay = 0.1; }
    else if (r < 0.48) this.blockFor = 0.5 + this.rng() * 0.4;
    this.decide = (0.45 + this.rng() * 0.5) * this.speed;
    return it;
  }

  startPattern(pat) {
    this.lastPat = pat.id;
    const first = !this.seen.has(pat.id);
    this.seen.add(pat.id);
    this.current = pat;
    const dur = pat.tell * this.speed * (first ? 1.25 : 1);
    this.f.setTell(pat, dur, () => {
      this.queue = pat.seq.map((s) => [...s]);
      this.qDelay = 0;
    });
    this.patCd = (3.4 + this.rng() * 1.4) * this.speed;
    this.decide = 0.6;
    if (this.onTell) this.onTell(pat, first, dur);
  }
}
