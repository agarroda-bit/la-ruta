// Capa de interfaz propia de Phuket: números flotantes, burbujas de diálogo sobre los
// personajes, reloj de sol del marcador y anillo de turbo en el botón táctil.
import * as THREE from 'three';

const CSS = `
#ui > .pk-capa, .pk-capa { position: fixed; inset: 0; pointer-events: none !important; z-index: 4; overflow: hidden; }
.pk-num { position: absolute; font-family: var(--titulo); font-size: 24px; color: #fff8ec; -webkit-text-stroke: 2px #1a1036; paint-order: stroke fill; text-shadow: 0 3px 0 #1a1036; white-space: nowrap; animation: pknum .95s ease-out forwards; }
.pk-num.grande { font-size: 30px; color: #ffd166; }
.pk-num.mal { color: #ff6f61; font-size: 20px; }
@keyframes pknum { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.5); } 18% { opacity: 1; transform: translate(-50%, -70%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -230%) scale(1); } }
.pk-burbuja { position: absolute; left: 0; top: 0; max-width: min(250px, 62vw); background: #fff8ec; color: #1a1036; border: 3px solid #1a1036; border-radius: 14px; padding: 3px 10px 6px; font-weight: 700; font-size: 15px; line-height: 1.18; box-shadow: 0 3px 0 #1a1036; transition: opacity .25s; will-change: transform; }
.pk-burbuja b { display: block; font-family: var(--titulo); font-weight: 400; font-size: 11px; color: #ff6f61; letter-spacing: .5px; }
.pk-burbuja.der b { color: #1b998b; }
.pk-burbuja.local b { color: #7b5cff; }
.pk-burbuja.fuera { opacity: 0; }
.pk-burbuja::after { content: ''; position: absolute; bottom: -11px; left: 22px; border: 8px solid transparent; border-top: 9px solid #1a1036; border-bottom: 0; }
.pk-burbuja.der::after { left: auto; right: 22px; }
.hud-item.hud-sol { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 8px; }
.pk-sol-cielo { position: relative; width: 46px; height: 25px; overflow: hidden; border-radius: 25px 25px 0 0; background: linear-gradient(#ffb36b, #ff6f61); border-bottom: 3px solid #2ec4b6; }
.pk-sol-cielo i { position: absolute; left: 50%; top: 4px; width: 19px; height: 19px; margin-left: -9.5px; border-radius: 50%; background: #ffe066; box-shadow: 0 0 10px 3px rgba(255,209,102,.8); transform: translateY(calc(var(--k, 0) * 24px)); }
.hud-sol.prisa { animation: pkprisa .5s infinite alternate; }
@keyframes pkprisa { to { background: rgba(230,57,70,.85); } }
.hud-sol span { font-size: 20px; min-width: 58px; }
.hud-item.hud-cocos { font-size: 20px; }
.hud-item.hud-combo { background: #ffd166; color: #1a1036; border-color: #1a1036; font-size: 16px; padding: 2px 10px; }
.hud-item.hud-combo.x3 { background: #ff4fa3; color: #fff; }
.hud-prog .barra-in { background: linear-gradient(90deg, #ffd166, #ff6f61) !important; }
.controles .btn-tactil[data-id="boost"]::before { content: ''; position: absolute; inset: -10px; border-radius: 50%; background: conic-gradient(#ffd166 calc(var(--turbo, 1) * 360deg), rgba(26,16,54,.35) 0); -webkit-mask: radial-gradient(circle, transparent 60%, #000 62%); mask: radial-gradient(circle, transparent 60%, #000 62%); }
.controles .btn-tactil[data-id="boost"].vacio { filter: grayscale(.8); opacity: .6; }
.controles .btn-tactil[data-id="boost"].lleno { animation: pklleno .7s infinite alternate; }
@keyframes pklleno { to { box-shadow: 0 5px 0 #1a1036, 0 0 22px 6px rgba(255,209,102,.8); } }
@media (max-width: 420px) { .hud-sol span { font-size: 17px; min-width: 50px; } .hud-item.hud-cocos { font-size: 17px; } .hud-barra.hud-prog { min-width: 130px; } }
`;

export function makeCapa(ctx, camera) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.getElementById('ui') || document.body;
  const capa = document.createElement('div'); capa.className = 'pk-capa no-ctrl';
  root.appendChild(capa);
  const v = new THREE.Vector3();
  const toScreen = (p) => { v.copy(p).project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, ok: v.z < 1 }; };
  const fill = (s) => s.replace(/\{0\}/g, ctx.names[0]).replace(/\{1\}/g, ctx.names[1]);

  function num(text, worldPos, cls = '') {
    const sp = toScreen(worldPos); if (!sp.ok) return;
    const e = document.createElement('div'); e.className = 'pk-num ' + cls; e.textContent = text;
    e.style.left = sp.x + 'px'; e.style.top = sp.y + 'px';
    capa.appendChild(e); setTimeout(() => e.remove(), 1000);
  }

  // burbujas: una a la vez, ancladas a un objeto 3D
  const queue = []; let cur = null;
  function say(who, text, anchor, ms = 2600) {
    if (queue.length > 2) return;
    queue.push({ who, text, anchor, ms });
  }
  function update(dt) {
    if (!cur && queue.length) {
      const q = queue.shift();
      const e = document.createElement('div');
      const name = typeof q.who === 'number' ? ctx.names[q.who] : q.who;
      e.className = 'pk-burbuja' + (q.who === 1 ? ' der' : '') + (typeof q.who === 'string' ? ' local' : '');
      e.innerHTML = `<b></b><span></span>`;
      e.querySelector('b').textContent = name; e.querySelector('span').textContent = fill(q.text);
      capa.appendChild(e);
      cur = { ...q, e, t: 0 };
      try { ctx.audio.sfx('click', { vol: 0.5, pitch: q.who === 1 ? 0.8 : 1.25 }); } catch (err) { /* nada */ }
    }
    if (cur) {
      cur.t += dt;
      const wp = typeof cur.anchor === 'function' ? cur.anchor() : cur.anchor;
      const sp = toScreen(wp);
      const w = cur.e.offsetWidth, h = cur.e.offsetHeight;
      let x = cur.who === 1 ? sp.x - w + 30 : sp.x - 30;
      x = Math.max(8, Math.min(innerWidth - w - 8, x));
      const y = Math.max(70, sp.y - h - 14);
      cur.e.style.transform = `translate(${x}px, ${y}px)`;
      if (cur.t > cur.ms / 1000) { const e = cur.e; e.classList.add('fuera'); setTimeout(() => e.remove(), 300); cur = null; }
    }
  }
  function clear() { queue.length = 0; if (cur) { cur.e.remove(); cur = null; } }
  function dispose() { clear(); capa.remove(); style.remove(); }
  return { num, say, update, clear, dispose, toScreen, el: capa };
}
