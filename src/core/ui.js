// Interfaz en DOM encima del canvas: pantallas, marcador (HUD), diálogos, cuenta atrás,
// resultados con estrellas, avisos de pegatinas y confeti.
import { audio } from './audio.js';
import { save } from './save.js';
import { wait, vibrate } from './util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export function h(tag, cls = '', html = '') { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let root;
export function initUI(el) { root = el; }
export const uiRoot = () => root;

// Pantalla a pantalla completa (menús). Devuelve el elemento; close() la quita con animación.
export function screen(cls, html) {
  const s = h('div', 'pantalla ' + cls, html);
  root.appendChild(s);
  requestAnimationFrame(() => s.classList.add('entra'));
  s.close = () => new Promise((r) => { s.classList.remove('entra'); s.classList.add('sale'); setTimeout(() => { s.remove(); r(); }, 320); });
  return s;
}

// Botón con sonido de clic y área grande
export function button(label, onClick, cls = '') {
  const b = h('button', 'boton ' + cls, label);
  b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.sfx('click'); onClick && onClick(e); });
  return b;
}

// ───────── HUD ─────────
// hud.set('cocos', '🥥 12'), hud.bar('sol', 0.6, 'SOL'), hud.clear()
export const hud = {
  el: null,
  items: new Map(),
  mount(theme = '') {
    this.clear();
    this.el = h('div', 'hud ' + theme);
    this.el.innerHTML = '<div class="hud-izq"></div><div class="hud-centro"></div><div class="hud-der"></div><div class="hud-abajo"></div>';
    root.appendChild(this.el);
    return this.el;
  },
  // pos: 'izq' | 'centro' | 'der' | 'abajo'
  set(id, html, pos = 'izq') {
    if (!this.el) return;
    let e = this.items.get(id);
    if (!e) { e = h('div', 'hud-item hud-' + id); this.el.querySelector('.hud-' + pos).appendChild(e); this.items.set(id, e); }
    if (e._html !== html) { e.innerHTML = html; e._html = html; }
    return e;
  },
  pop(id) { const e = this.items.get(id); if (e) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); } },
  bar(id, v, label = '', pos = 'centro', color = '') {
    let e = this.items.get(id);
    if (!e) {
      e = this.set(id, `<div class="barra-lbl">${label}</div><div class="barra"><div class="barra-in"></div></div>`, pos);
      e.classList.add('hud-barra');
      if (color) e.style.setProperty('--c', color);
    }
    e.querySelector('.barra-in').style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`;
    return e;
  },
  remove(id) { const e = this.items.get(id); if (e) { e.remove(); this.items.delete(id); } },
  clear() { if (this.el) this.el.remove(); this.el = null; this.items.clear(); },
};

// Texto grande que aparece en el centro y se va ("¡TURBO!", "+100", "¡KO!")
export function shout(text, { color = '', size = '', ms = 1100, cls = '' } = {}) {
  // un solo grito a la vez: el nuevo sustituye al anterior (los de la cuenta atrás van aparte)
  if (!cls.includes('cuenta')) root.querySelectorAll('.grito:not(.cuenta)').forEach((g) => g.remove());
  const e = h('div', 'grito ' + cls + (size ? ' ' + size : ''), text);
  if (color) e.style.color = color;
  root.appendChild(e);
  setTimeout(() => e.remove(), ms);
}

// Mensaje pequeño flotante abajo
export function toast(html, ms = 2200, cls = '') {
  const e = h('div', 'aviso ' + cls, html);
  root.appendChild(e);
  requestAnimationFrame(() => e.classList.add('entra'));
  setTimeout(() => { e.classList.remove('entra'); setTimeout(() => e.remove(), 400); }, ms);
}

// Cuenta atrás 3-2-1-¡YA!
export async function countdown(go = '¡YA!') {
  for (const n of ['3', '2', '1']) { audio.sfx('countdown'); shout(n, { cls: 'cuenta', ms: 800 }); await wait(750); }
  audio.sfx('go'); shout(go, { cls: 'cuenta ya', ms: 900 });
  vibrate(30);
}

// ───────── diálogos ─────────
// lines: [{ who: 0|1|'Nombre', text: 'Hola {0}' }]. {0} y {1} se cambian por los nombres.
// Se pueden saltar: tocar avanza, botón SALTAR termina.
export function dialog(lines, { names = save.data.names, portraits = null, pos = '' } = {}) {
  return new Promise((resolve) => {
    if (!lines || !lines.length) return resolve();
    const box = h('div', 'dialogo no-ctrl' + (pos ? ' ' + pos : ''));
    document.body.classList.add('con-dialogo');
    box.innerHTML = '<div class="dlg-burbuja"><div class="dlg-quien"></div><div class="dlg-texto"></div><div class="dlg-sig">▶</div></div><button class="dlg-saltar">SALTAR ⏭</button>';
    root.appendChild(box);
    let i = 0, typing = null, full = '';
    const fill = (s) => s.replace(/\{0\}/g, names[0]).replace(/\{1\}/g, names[1]);
    const show = () => {
      const l = lines[i];
      const who = typeof l.who === 'number' ? names[l.who] : l.who;
      box.querySelector('.dlg-quien').textContent = who;
      box.classList.toggle('der', l.who === 1 || l.side === 'der');
      box.classList.toggle('local', typeof l.who === 'string');
      full = fill(l.text);
      const t = box.querySelector('.dlg-texto');
      let k = 0; t.textContent = '';
      clearInterval(typing);
      typing = setInterval(() => { k += 2; t.textContent = full.slice(0, k); if (k >= full.length) { clearInterval(typing); typing = null; } }, 22);
      audio.sfx('click', { vol: 0.4, pitch: l.who === 1 ? 0.8 : 1.2 });
    };
    const done = () => { clearInterval(typing); off(); document.body.classList.remove('con-dialogo'); box.classList.add('sale'); setTimeout(() => box.remove(), 250); resolve(); };
    const next = () => {
      if (typing) { clearInterval(typing); typing = null; box.querySelector('.dlg-texto').textContent = full; return; }
      i++; if (i >= lines.length) done(); else show();
    };
    box.addEventListener('pointerdown', (e) => { if (e.target.closest('.dlg-saltar')) return; e.preventDefault(); next(); });
    box.querySelector('.dlg-saltar').addEventListener('click', (e) => { e.stopPropagation(); done(); });
    const onKey = (e) => { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); next(); } if (e.code === 'Escape') done(); };
    addEventListener('keydown', onKey);
    // mando: A avanza
    let padWas = true;
    const padTimer = setInterval(() => {
      let pads = []; try { pads = [...navigator.getGamepads()].filter(Boolean); } catch (e) { /* nada */ }
      const a = pads.some((p) => p.buttons[0] && p.buttons[0].pressed);
      if (a && !padWas) next();
      padWas = a;
    }, 50);
    const off = () => { removeEventListener('keydown', onKey); clearInterval(padTimer); };
    show();
  });
}

// ───────── confeti (canvas 2D encima) ─────────
export function confetti(n = 140, colors = ['#ff6f61', '#ffd166', '#36c2b4', '#7b5cff', '#ffffff', '#ff9f1c']) {
  const c = h('canvas', 'confeti');
  c.width = innerWidth * Math.min(2, devicePixelRatio); c.height = innerHeight * Math.min(2, devicePixelRatio);
  root.appendChild(c);
  const g = c.getContext('2d'), s = c.width / innerWidth;
  const ps = Array.from({ length: n }, () => ({
    x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 900, vy: -300 - Math.random() * 700,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, col: colors[Math.floor(Math.random() * colors.length)],
  }));
  let last = performance.now(), life = 3.2;
  const step = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t; life -= dt;
    g.clearRect(0, 0, c.width, c.height);
    for (const p of ps) {
      p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      g.save(); g.translate(p.x * s, p.y * s); g.rotate(p.r); g.fillStyle = p.col; g.globalAlpha = Math.min(1, life);
      g.fillRect((-p.w / 2) * s, (-p.h / 2) * s * Math.abs(Math.cos(p.r * 2)), p.w * s, p.h * s); g.restore();
    }
    if (life > 0) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

// Contador que sube (para resultados)
export function countUp(el, to, ms = 900, fmt = (v) => Math.round(v)) {
  const start = performance.now();
  return new Promise((r) => {
    const f = (t) => {
      const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(to * e);
      if (k < 1) requestAnimationFrame(f); else r();
    };
    requestAnimationFrame(f);
  });
}

export function starsHTML(n, max = 3) {
  let s = '';
  for (let i = 0; i < max; i++) s += `<span class="estrella ${i < n ? 'si' : ''}">★</span>`;
  return s;
}
