// Entrada unificada: táctil (joystick virtual + botones grandes), teclado y mando (Gamepad API).
// Cada etapa declara su esquema de controles con input.configure(layout) y lee:
//   input.x, input.y            ejes del jugador 1 (-1..1; y>0 = adelante/arriba)
//   input.down('a')             botón mantenido
//   input.pressed('a')          botón pulsado en este frame (se limpia en endFrame)
//   input.p(1).down('a')        lo mismo para el jugador 2 (modo 2 jugadores)
//
// layout = {
//   joystick: 'steer' | 'move' | false,   // steer = solo eje X (volante), move = X e Y
//   players: 1 | 2,
//   buttons: [{ id, label, keys: ['Space'], keys2: ['Enter'], pad: [0], player: 0, color, size, pos: {right,bottom} }],
//   split: false,                           // 2 jugadores: mitad izquierda J1, mitad derecha J2
//   splitAxis: 'x' | 'y',                   // por dónde se parte la pantalla
// }
import { clamp } from './util.js';

const AXIS_KEYS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'] },
];
const DEFAULT_PAD = { a: [0], b: [1], c: [2], d: [3], boost: [5, 7], pause: [9], left: [4], right: [5] };

function makePlayer() {
  return {
    x: 0, y: 0,
    _touchX: 0, _touchY: 0, _padX: 0, _padY: 0, _keyX: 0, _keyY: 0,
    btn: new Map(), // id → { down, pressed, released, src:Set }
    down(id) { const b = this.btn.get(id); return !!(b && b.down); },
    pressed(id) { const b = this.btn.get(id); return !!(b && b.pressed); },
    released(id) { const b = this.btn.get(id); return !!(b && b.released); },
  };
}

function setBtn(pl, id, src, on) {
  let b = pl.btn.get(id);
  if (!b) { b = { down: false, pressed: false, released: false, src: new Set() }; pl.btn.set(id, b); }
  const was = b.down;
  if (on) b.src.add(src); else b.src.delete(src);
  b.down = b.src.size > 0;
  if (b.down && !was) b.pressed = true;
  if (!b.down && was) b.released = true;
}

class Input {
  constructor() {
    this.players = [makePlayer(), makePlayer()];
    this.layout = { joystick: false, buttons: [], players: 1 };
    this.keys = new Set();
    this.lastDevice = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
    this.enabled = true;
    this.onPause = null; // lo pone el juego
    this.listeners = new Set();
    this.root = null;
    this._ptr = new Map(); // pointerId → { kind:'joy'|'btn', player, btnId, ox, oy }
    this._bindKeys();
  }

  get x() { return this.players[0].x; }
  get y() { return this.players[0].y; }
  p(i) { return this.players[i] || this.players[0]; }
  down(id) { return this.players[0].down(id); }
  pressed(id) { return this.players[0].pressed(id); }
  released(id) { return this.players[0].released(id); }
  anyPressed() { return this.players.some((p) => [...p.btn.values()].some((b) => b.pressed)); }

  // Avisos de "se ha pulsado algo" para menús (onAny(fn) → quitar)
  onAny(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(kind, id) { for (const f of this.listeners) f(kind, id); }

  configure(layout = {}) {
    this.layout = { joystick: false, buttons: [], players: 1, split: false, splitAxis: 'x', ...layout };
    for (const p of this.players) { p.btn.clear(); p.x = p.y = p._touchX = p._touchY = 0; }
    this._ptr.clear();
    this._buildTouchUI();
  }

  clear() { this.configure({ joystick: false, buttons: [] }); this.hideTouch(); }

  attach(root) {
    this.root = root;
    root.addEventListener('pointerdown', (e) => this._pdown(e), { passive: false });
    addEventListener('pointermove', (e) => this._pmove(e), { passive: false });
    addEventListener('pointerup', (e) => this._pup(e));
    addEventListener('pointercancel', (e) => this._pup(e));
    addEventListener('gamepadconnected', () => { this.lastDevice = 'pad'; this._refreshVisibility(); });
  }

  // ───────── teclado ─────────
  _bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.lastDevice !== 'keyboard') { this.lastDevice = 'keyboard'; this._refreshVisibility(); }
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.onPause) this.onPause();
      this._keysToButtons(e.code, true);
      this._emit('key', e.code);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this._keysToButtons(e.code, false); });
    addEventListener('blur', () => { for (const k of [...this.keys]) this._keysToButtons(k, false); this.keys.clear(); });
  }

  _keysToButtons(code, on) {
    const two = this.layout.players === 2;
    for (const b of this.layout.buttons) {
      const pl = b.player ?? 0;
      if (two) {
        // 2 jugadores con teclado: keys = J1, keys2 = J2 (los botones de cada jugador están duplicados)
        if (pl === 0 && (b.keys || []).includes(code)) setBtn(this.players[0], b.id, 'k:' + code, on);
        if (pl === 1 && (b.keys2 || b.keys || []).includes(code)) setBtn(this.players[1], b.id, 'k:' + code, on);
      } else {
        if ((b.keys || []).includes(code) || (b.keys2 || []).includes(code)) setBtn(this.players[0], b.id, 'k:' + code, on);
      }
    }
  }

  _keyAxes() {
    const two = this.layout.players === 2;
    const k = (list) => list.some((c) => this.keys.has(c));
    for (let i = 0; i < 2; i++) {
      const sets = two ? [AXIS_KEYS[i]] : AXIS_KEYS;
      let x = 0, y = 0;
      for (const s of sets) { x += (k(s.right) ? 1 : 0) - (k(s.left) ? 1 : 0); y += (k(s.up) ? 1 : 0) - (k(s.down) ? 1 : 0); }
      this.players[i]._keyX = clamp(x, -1, 1); this.players[i]._keyY = clamp(y, -1, 1);
    }
  }

  // ───────── mando ─────────
  _pollPads() {
    let pads = [];
    try { pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; } catch (e) { pads = []; }
    for (let i = 0; i < 2; i++) {
      const pl = this.players[i], gp = pads[i];
      pl._padX = 0; pl._padY = 0;
      if (!gp) { for (const b of this.layout.buttons) setBtn(pl, b.id, 'pad', false); continue; }
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      const pressedB = (n) => !!(gp.buttons[n] && (gp.buttons[n].pressed || gp.buttons[n].value > 0.4));
      let x = dz(gp.axes[0] || 0), y = -dz(gp.axes[1] || 0);
      if (pressedB(14)) x = -1; if (pressedB(15)) x = 1; if (pressedB(12)) y = 1; if (pressedB(13)) y = -1;
      // gatillos: RT acelera, LT frena (útil en las etapas de conducir)
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0;
      if (this.layout.joystick === 'steer' && (rt > 0.1 || lt > 0.1)) y = rt - lt;
      pl._padX = clamp(x, -1, 1); pl._padY = clamp(y, -1, 1);
      let any = Math.abs(x) + Math.abs(y) > 0.3;
      for (const b of this.layout.buttons) {
        if ((b.player ?? 0) !== i && this.layout.players === 2) continue;
        const map = b.pad || DEFAULT_PAD[b.id] || [];
        const on = map.some(pressedB);
        any ||= on;
        setBtn(pl, b.id, 'pad', on);
      }
      if (pressedB(9) && !this._padPause) { this._padPause = true; if (this.onPause) this.onPause(); }
      if (!pressedB(9)) this._padPause = false;
      if (any && this.lastDevice !== 'pad') { this.lastDevice = 'pad'; this._refreshVisibility(); }
      if (any) this._emit('pad', i);
    }
  }

  // Se llama al principio de cada frame
  update() {
    this._keyAxes();
    this._pollPads();
    for (const p of this.players) {
      const tx = Math.abs(p._touchX) > Math.abs(p._padX) ? p._touchX : p._padX;
      const ty = Math.abs(p._touchY) > Math.abs(p._padY) ? p._touchY : p._padY;
      p.x = clamp(p._keyX || tx, -1, 1);
      p.y = clamp(p._keyY || ty, -1, 1);
      if (this.layout.joystick === 'steer' && !p._keyY && !p._padY) p.y = 0;
    }
  }

  // Se llama al final de cada frame
  endFrame() {
    for (const p of this.players) for (const b of p.btn.values()) { b.pressed = false; b.released = false; }
  }

  // ───────── táctil ─────────
  _buildTouchUI() {
    if (!this.root) return;
    if (this.touchEl) this.touchEl.remove();
    const el = document.createElement('div');
    el.className = 'controles' + (this.layout.split ? ' split split-' + this.layout.splitAxis : '');
    this.touchEl = el;
    this.btnEls = [];
    if (this.layout.joystick) {
      for (let i = 0; i < (this.layout.split ? 2 : 1); i++) {
        const j = document.createElement('div');
        j.className = 'joy joy-' + i;
        j.innerHTML = '<div class="joy-base"></div><div class="joy-knob"></div>';
        el.appendChild(j);
        this.players[i].joyEl = j;
      }
    }
    const perPlayer = [[], []];
    for (const b of this.layout.buttons) if (!b.hidden) perPlayer[b.player ?? 0].push(b);
    perPlayer.forEach((list, pi) => {
      list.forEach((b, i) => {
        const d = document.createElement('div');
        d.className = 'btn-tactil' + (b.size === 'big' ? ' big' : b.size === 'small' ? ' small' : '');
        d.dataset.id = b.id; d.dataset.player = String(pi);
        d.innerHTML = `<span>${b.label || b.id}</span>`;
        if (b.color) d.style.setProperty('--c', b.color);
        const pos = b.pos || autoPos(i, list.length, this.layout.split ? pi : -1, this.layout.splitAxis);
        for (const [k, v] of Object.entries(pos)) d.style[k] = typeof v === 'number' ? v + 'px' : v;
        el.appendChild(d);
        this.btnEls.push({ el: d, id: b.id, player: pi });
      });
    });
    this.root.appendChild(el);
    this._refreshVisibility();
  }

  showTouch() { if (this.touchEl) this.touchEl.classList.remove('oculto'); }
  hideTouch() { if (this.touchEl) this.touchEl.classList.add('oculto'); }
  _refreshVisibility() {
    if (!this.touchEl) return;
    const show = this.lastDevice === 'touch' || this.forceTouch;
    this.touchEl.classList.toggle('sin-tactil', !show);
  }

  _hitButton(x, y) {
    let best = null, bd = Infinity;
    for (const b of this.btnEls || []) {
      const r = b.el.getBoundingClientRect();
      const pad = 14;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (d < bd) { bd = d; best = b; }
      }
    }
    return best;
  }

  _zonePlayer(x, y) {
    if (!this.layout.split) return 0;
    return this.layout.splitAxis === 'y' ? (y > innerHeight / 2 ? 0 : 1) : (x < innerWidth / 2 ? 0 : 1);
  }

  _pdown(e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      if (this.lastDevice !== 'touch') { this.lastDevice = 'touch'; this._refreshVisibility(); }
    }
    if (!this.enabled || !this.touchEl || this.touchEl.classList.contains('oculto')) return;
    if (e.target.closest && e.target.closest('.no-ctrl, button, input, .panel')) return;
    if (e.pointerType === 'mouse' && this.lastDevice !== 'touch' && !this.forceTouch) return;
    const hit = this._hitButton(e.clientX, e.clientY);
    if (hit) {
      e.preventDefault();
      this._ptr.set(e.pointerId, { kind: 'btn', player: hit.player, btnId: hit.id, el: hit.el });
      setBtn(this.players[hit.player], hit.id, 'p' + e.pointerId, true);
      hit.el.classList.add('on');
      this._emit('touch', hit.id);
      return;
    }
    if (this.layout.joystick) {
      const pi = this._zonePlayer(e.clientX, e.clientY);
      const pl = this.players[pi];
      // en 1 jugador el joystick vive en la mitad izquierda; si tocas la derecha sin botón, no hace nada
      if (!this.layout.split && e.clientX > innerWidth * 0.55) return;
      if ([...this._ptr.values()].some((p) => p.kind === 'joy' && p.player === pi)) return;
      e.preventDefault();
      this._ptr.set(e.pointerId, { kind: 'joy', player: pi, ox: e.clientX, oy: e.clientY });
      if (pl.joyEl) {
        pl.joyEl.style.left = e.clientX + 'px'; pl.joyEl.style.top = e.clientY + 'px';
        pl.joyEl.classList.add('on');
        pl.joyEl.querySelector('.joy-knob').style.transform = 'translate(-50%,-50%)';
      }
      this._emit('touch', 'joy');
    }
  }

  _pmove(e) {
    const p = this._ptr.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.kind === 'joy') {
      const pl = this.players[p.player];
      const R = 56;
      let dx = e.clientX - p.ox, dy = e.clientY - p.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        // la base sigue al dedo si se pasa (más cómodo con el pulgar)
        p.ox += (dx / len) * (len - R); p.oy += (dy / len) * (len - R);
        dx = e.clientX - p.ox; dy = e.clientY - p.oy;
        if (pl.joyEl) { pl.joyEl.style.left = p.ox + 'px'; pl.joyEl.style.top = p.oy + 'px'; }
      }
      pl._touchX = clamp(dx / R, -1, 1);
      pl._touchY = clamp(-dy / R, -1, 1);
      if (pl.joyEl) pl.joyEl.querySelector('.joy-knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else {
      // deslizar el pulgar de un botón a otro
      const hit = this._hitButton(e.clientX, e.clientY);
      if (hit && (hit.id !== p.btnId || hit.player !== p.player)) {
        setBtn(this.players[p.player], p.btnId, 'p' + e.pointerId, false);
        p.el.classList.remove('on');
        p.btnId = hit.id; p.player = hit.player; p.el = hit.el;
        setBtn(this.players[p.player], p.btnId, 'p' + e.pointerId, true);
        hit.el.classList.add('on');
      }
    }
  }

  _pup(e) {
    const p = this._ptr.get(e.pointerId);
    if (!p) return;
    this._ptr.delete(e.pointerId);
    if (p.kind === 'joy') {
      const pl = this.players[p.player];
      pl._touchX = 0; pl._touchY = 0;
      if (pl.joyEl) pl.joyEl.classList.remove('on');
    } else {
      setBtn(this.players[p.player], p.btnId, 'p' + e.pointerId, false);
      p.el.classList.remove('on');
    }
  }
}

// Coloca los botones en abanico en la esquina inferior derecha (o en la mitad de cada jugador).
function autoPos(i, n, splitPlayer, axis) {
  const slots = [
    { right: 24, bottom: 34 },
    { right: 128, bottom: 22 },
    { right: 36, bottom: 140 },
    { right: 140, bottom: 122 },
    { right: 232, bottom: 26 },
  ];
  const s = { ...(slots[i] || { right: 24 + i * 100, bottom: 240 }) };
  if (splitPlayer === 0 && axis === 'x') return { left: `calc(50% - ${s.right + 96}px)`, bottom: s.bottom };
  if (splitPlayer === 1 && axis === 'x') return s;
  if (splitPlayer === 0 && axis === 'y') return { right: s.right, bottom: s.bottom };
  if (splitPlayer === 1 && axis === 'y') return { left: s.right, top: s.bottom, transform: 'rotate(180deg)' };
  return s;
}

export const input = new Input();
