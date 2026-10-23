// Interfaz de la etapa: estilos propios, disposición de botones (1 y 2 jugadores,
// vertical y apaisado), marcador del combate, menú de inicio y textos flotantes.
import { esc } from '../../core/ui.js';

const CSS = `
.mt-capa { position: fixed; inset: 0; pointer-events: none; z-index: 2; font-family: var(--titulo); }
.mt-region { position: absolute; transform-origin: 50% 50%; pointer-events: none; }
.mt-region.rot { transform: rotate(180deg); }
.mt-marcador { position: absolute; left: 10px; right: 10px; top: calc(8px + var(--safe-t)); display: flex; gap: 8px; align-items: flex-start; max-width: 860px; margin: 0 auto; }
.mt-leyenda { position: absolute; left: 50%; bottom: calc(12px + var(--safe-b)); transform: translateX(-50%); font-family: var(--texto); font-weight: 800; font-size: 14px; color: #fff; background: rgba(26,16,54,.72); border: 2px solid rgba(255,207,63,.6); border-radius: 12px; padding: 4px 12px; white-space: nowrap; display: none; }
.mt-leyenda b { color: #ffcf3f; font-family: var(--titulo); font-weight: 400; font-size: 12px; margin-left: 8px; }
.mt-leyenda b:first-child { margin-left: 0; }
.mt-capa.teclado .mt-leyenda { display: block; }
.mt-region.mitad .mt-leyenda { bottom: 8px; font-size: 12px; }
.mt-capa.p1 .mt-marcador { right: calc(68px + var(--safe-r)); left: calc(10px + var(--safe-l)); }
.mt-region.mitad .mt-marcador { top: 6px; right: 10px; left: 10px; }
.mt-lado { flex: 1; min-width: 0; }
.mt-lado.der { text-align: right; }
.mt-nombre { font-size: 13px; color: #fff; -webkit-text-stroke: 1px #1a1036; text-shadow: 0 2px 0 #1a1036; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mt-nombre small { font-family: var(--texto); font-weight: 800; font-size: 10px; padding: 0 6px; border-radius: 6px; margin: 0 4px; -webkit-text-stroke: 0; text-shadow: none; vertical-align: 2px; }
.mt-lado.rojo .mt-nombre small { background: #c1121f; }
.mt-lado.azul .mt-nombre small { background: #1d4ed8; }
.mt-vida { position: relative; height: 16px; background: #2a0d12; border: 3px solid #1a1036; border-radius: 9px; overflow: hidden; box-shadow: 0 3px 0 #1a1036; margin-top: 2px; }
.mt-vida i, .mt-vida b, .mt-vida u { position: absolute; top: 0; bottom: 0; left: 0; width: 100%; transform-origin: left; }
.mt-lado.der .mt-vida i, .mt-lado.der .mt-vida b, .mt-lado.der .mt-vida u { transform-origin: right; }
.mt-vida u { background: #fff3c4; transition: transform .5s .25s; }
.mt-vida i { background: linear-gradient(#ffd94a, #f0a500); }
.mt-lado.rojo .mt-vida i { background: linear-gradient(#ff5a5f, #c1121f); }
.mt-lado.azul .mt-vida i { background: linear-gradient(#5b8cff, #1d4ed8); }
.mt-vida b { background: repeating-linear-gradient(90deg, #ffd94a 0 6px, #ffb703 6px 12px); opacity: .95; }
.mt-aguante { height: 6px; margin-top: 4px; background: rgba(26,16,54,.6); border-radius: 4px; overflow: hidden; }
.mt-aguante i { display: block; height: 100%; background: #8ef0c4; transform-origin: left; }
.mt-lado.der .mt-aguante i { transform-origin: right; }
.mt-aguante.bajo i { background: #ff9f1c; animation: mtlatido .5s infinite; }
.mt-centro { text-align: center; min-width: 64px; color: #fff; }
.mt-asalto { font-size: 10px; letter-spacing: 1px; color: #ffcf3f; -webkit-text-stroke: .5px #1a1036; }
.mt-reloj { font-size: 24px; line-height: 1; -webkit-text-stroke: 2px #1a1036; text-shadow: 0 3px 0 #1a1036; }
.mt-reloj.poco { color: #ff6f61; animation: mtlatido .5s infinite; }
.mt-contra { position: absolute; left: 50%; top: calc(64px + var(--safe-t)); transform: translateX(-50%); font-size: 12px; color: #1a1036; background: #ffcf3f; border: 3px solid #1a1036; border-radius: 99px; padding: 2px 10px; opacity: 0; transition: opacity .15s; white-space: nowrap; }
.mt-contra.on { opacity: 1; animation: mtlatido .3s infinite; }
.mt-pop { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; font-size: 30px; color: #ffcf3f; -webkit-text-stroke: 2px #1a1036; text-shadow: 0 4px 0 #1a1036; animation: mtpop .9s ease-out forwards; pointer-events: none; }
.mt-pop.peque { font-size: 19px; }
.mt-pop.grande { font-size: 54px; -webkit-text-stroke: 3px #1a1036; }
.mt-pop.rot { animation-name: mtpoprot; }
@keyframes mtpop { 0% { transform: translate(-50%,-50%) scale(.3); opacity: 0; } 18% { transform: translate(-50%,-50%) scale(1.2); opacity: 1; } 30% { transform: translate(-50%,-50%) scale(1); } 75% { opacity: 1; } 100% { transform: translate(-50%,-110%) scale(1); opacity: 0; } }
@keyframes mtpoprot { 0% { transform: translate(-50%,-50%) rotate(180deg) scale(.3); opacity: 0; } 18% { transform: translate(-50%,-50%) rotate(180deg) scale(1.2); opacity: 1; } 30% { transform: translate(-50%,-50%) rotate(180deg) scale(1); } 75% { opacity: 1; } 100% { transform: translate(-50%,10%) rotate(180deg) scale(1); opacity: 0; } }
@keyframes mtlatido { 50% { transform: scale(1.08); } }
.mt-contra.on { animation: none; }
.mt-flash { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 4; transition: opacity .25s; }
.mt-vineta { position: fixed; inset: 0; pointer-events: none; z-index: 1; background: radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(40,8,0,.55) 100%); }
.mt-lienzo { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
.mt-menu { position: fixed; inset: 0; z-index: 8; display: flex; align-items: center; justify-content: center; padding: 16px; background: radial-gradient(ellipse at 50% 30%, rgba(255,190,80,.15), rgba(20,6,2,.7)); pointer-events: auto; }
.mt-menu .panel { text-align: center; border-top: 12px solid #c1121f; max-width: 440px; }
.mt-menu h2 { margin-bottom: 2px; }
.mt-menu .mt-sub { font-weight: 800; opacity: .7; margin-bottom: 14px; }
.mt-menu .mt-ops { display: grid; gap: 10px; }
.mt-menu .boton { display: block; width: 100%; text-align: left; padding: 12px 16px; }
.mt-menu .boton b { display: block; font-size: 20px; }
.mt-menu .boton span { display: block; font-family: var(--texto); font-weight: 700; font-size: 14px; letter-spacing: 0; opacity: .85; }
.mt-menu .boton.dos { background: #1d4ed8; color: #fff; }
.mt-menu .boton.uno { background: #c1121f; color: #fff; }
.mt-menu .mt-teclas { font-family: var(--texto); font-size: 12px; font-weight: 700; opacity: .6; margin-top: 10px; }
.mt-ayuda { position: absolute; left: 50%; transform: translateX(-50%); background: rgba(26,16,54,.82); color: #fff; border: 2px solid #ffcf3f; border-radius: 14px; padding: 6px 12px; font-family: var(--texto); font-weight: 800; font-size: 15px; text-align: center; max-width: 92%; white-space: normal; line-height: 1.15; opacity: 0; transition: opacity .3s; }
.mt-ayuda.on { opacity: 1; }
.mt-ayuda b { color: #ffcf3f; }
.controles.mt-ctrl .btn-tactil { margin: 0; font-size: 13px; border-width: 4px; }
.controles.mt-ctrl .btn-tactil[data-id="l0"] span, .controles.mt-ctrl .btn-tactil[data-id="l2"] span { font-size: 30px; font-family: system-ui, sans-serif; }
.controles.mt-ctrl .btn-tactil[data-id="l1"] span { font-size: 18px; }
`;

export function injectCSS() {
  if (document.getElementById('mt-css')) return;
  const s = document.createElement('style'); s.id = 'mt-css'; s.textContent = CSS; document.head.appendChild(s);
}

// ───────── disposición ─────────
const COL = { punch: '#e63946', kick: '#f77f00', knee: '#d4a017', block: '#4361ee', dodge: '#2ec4b6', l0: '#d4a017', l1: '#e63946', l2: '#d4a017' };
const LBL = { punch: 'PUÑO', kick: 'PATADA', knee: 'RODILLA<br>CODO', block: 'BLOQUEO', dodge: 'ESQUIVA', l0: '◀', l1: 'WAI', l2: '▶' };
// teclas: keys = jugador 1 (y 1 jugador), keys2 = jugador 2 (en 1 jugador también valen)
const KEYS = {
  punch: [['KeyA', 'KeyF'], ['ArrowLeft', 'KeyJ']],
  kick: [['KeyS', 'KeyG'], ['ArrowDown', 'KeyK']],
  knee: [['KeyD', 'KeyH'], ['ArrowRight', 'KeyL']],
  block: [['KeyW', 'Space'], ['ArrowUp', 'Semicolon']],
  dodge: [['KeyQ', 'KeyE', 'ShiftLeft'], ['ShiftRight', 'KeyO', 'KeyI']],
  l0: [['KeyA', 'KeyF'], ['ArrowLeft', 'KeyJ']],
  l1: [['KeyS', 'KeyG', 'KeyW', 'Space'], ['ArrowDown', 'ArrowUp', 'KeyK']],
  l2: [['KeyD', 'KeyH'], ['ArrowRight', 'KeyL']],
};
const PAD = { punch: [2], kick: [3], knee: [1], block: [4, 6], dodge: [0, 5], l0: [2, 14], l1: [0, 3, 12, 13], l2: [1, 15] };
export const KEY_HINT = { 0: { punch: 'A', kick: 'S', knee: 'D', block: 'W', dodge: 'Q', l0: 'A', l1: 'S', l2: 'D' }, 1: { punch: '←', kick: '↓', knee: '→', block: '↑', dodge: '⇧', l0: '←', l1: '↓', l2: '→' }, solo: { punch: 'J', kick: 'K', knee: 'L', block: 'ESPACIO', dodge: '⇧', l0: '←', l1: '↓', l2: '→' } };

function btn(id, player, cx, cy, size, rot = false) {
  const pos = { left: Math.round(cx - size / 2), top: Math.round(cy - size / 2), width: Math.round(size), height: Math.round(size), bottom: 'auto', right: 'auto' };
  if (rot) pos.rotate = '180deg';
  return { id, label: LBL[id], keys: KEYS[id][0], keys2: KEYS[id][1], pad: PAD[id], color: player === 1 ? (id === 'punch' ? '#3a86ff' : COL[id]) : COL[id], player, pos, _cx: cx, _cy: cy, _size: size };
}

// Devuelve { controls (para input.configure), regions, lanes, portrait }
export function computeLayout({ players, phase, W, H }) {
  const portrait = H > W;
  const B = Math.round(Math.max(60, Math.min(86, Math.min(W, H) * (portrait ? 0.2 : 0.19))));
  const sb = 26; // margen inferior
  const buttons = [];
  const lanes = [[], []];
  let regions;
  if (players === 1) {
    regions = [{ x: 0, y: 0, w: W, h: H, rot: false, pl: 0 }];
    if (phase === 'waikru') {
      const sp = Math.min(W * 0.29, 130), cy = H - sb - B * 0.6;
      for (let i = 0; i < 3; i++) { const cx = W / 2 + (i - 1) * sp; buttons.push(btn('l' + i, 0, cx, cy, B * 1.1)); lanes[0].push({ x: cx, y: cy - B * 1.02, dir: 1, rot: false, top: H * (portrait ? 0.3 : 0.2) }); }
    } else {
      const big = B * 1.22;
      const by = H - sb - big / 2;
      buttons.push(btn('block', 0, 18 + big / 2, by, big));
      const px = W - 18 - big / 2;
      buttons.push(btn('punch', 0, px, by, big));
      buttons.push(btn('kick', 0, px - big / 2 - 12 - B / 2, H - 20 - B / 2, B));
      buttons.push(btn('knee', 0, px + (big - B) / 2 - 4, by - big / 2 - 14 - B / 2, B));
      buttons.push(btn('dodge', 0, px - big / 2 - 12 - B / 2, H - 20 - B - 14 - B * 0.42, B * 0.84));
    }
  } else if (!portrait) {
    // apaisado: mitad izquierda = jugador 1, mitad derecha = jugador 2
    regions = [{ x: 0, y: 0, w: W, h: H, rot: false, pl: -1 }];
    const half = W / 2;
    if (phase === 'waikru') {
      const sp = Math.min(half * 0.28, 112), cy = H - sb - B * 0.55;
      for (let p = 0; p < 2; p++) for (let i = 0; i < 3; i++) {
        const cx = half * p + half / 2 + (i - 1) * sp;
        buttons.push(btn('l' + i, p, cx, cy, B));
        lanes[p].push({ x: cx, y: cy - B * 1.05, dir: 1, rot: false, top: 70 });
      }
    } else {
      const g = 12, y1 = H - sb - B / 2, y2 = y1 - B - g;
      const m = 18 + B / 2;
      // jugador 1 (pulgar izquierdo): bloqueo fuera, puño dentro
      buttons.push(btn('block', 0, m, y1, B), btn('punch', 0, m + B + g, y1, B), btn('knee', 0, m, y2, B), btn('kick', 0, m + B + g, y2, B));
      buttons.push(btn('block', 1, W - m, y1, B), btn('punch', 1, W - m - B - g, y1, B), btn('knee', 1, W - m, y2, B), btn('kick', 1, W - m - B - g, y2, B));
    }
  } else {
    // vertical: abajo = jugador 1, arriba = jugador 2 (girado 180°)
    regions = [{ x: 0, y: H / 2, w: W, h: H / 2, rot: false, pl: 0 }, { x: 0, y: 0, w: W, h: H / 2, rot: true, pl: 1 }];
    const yb = H - 30 - B / 2, yt = 66 + B / 2;
    if (phase === 'waikru') {
      const sp = Math.min(W * 0.29, 120);
      for (let i = 0; i < 3; i++) {
        const cx = W / 2 + (i - 1) * sp;
        buttons.push(btn('l' + i, 0, cx, yb, B));
        lanes[0].push({ x: cx, y: yb - B * 1.05, dir: 1, rot: false, top: H / 2 + 60 });
        const cx2 = W - cx;
        buttons.push(btn('l' + i, 1, cx2, yt, B, true));
        lanes[1].push({ x: cx2, y: yt + B * 1.05, dir: -1, rot: true, top: H / 2 - 60 });
      }
    } else {
      const order = ['punch', 'kick', 'knee', 'block'];
      const sp = W / 4;
      order.forEach((id, i) => {
        const cx = sp * (i + 0.5);
        buttons.push(btn(id, 0, W - cx, yb, Math.min(B, sp - 12)));
        buttons.push(btn(id, 1, cx, yt, Math.min(B, sp - 12), true));
      });
    }
  }
  return {
    portrait, B, regions, lanes,
    controls: { joystick: false, players, split: players === 2, splitAxis: portrait ? 'y' : 'x', buttons },
  };
}

// ───────── capa de interfaz ─────────
export function crearCapa(hudEl) {
  injectCSS();
  const capa = document.createElement('div'); capa.className = 'mt-capa';
  const lienzo = document.createElement('canvas'); lienzo.className = 'mt-lienzo';
  const flashEl = document.createElement('div'); flashEl.className = 'mt-flash';
  const vin = document.createElement('div'); vin.className = 'mt-vineta';
  (hudEl || document.body).append(vin, lienzo, capa, flashEl);
  const api = {
    capa, lienzo, regions: [], hud: [],
    flash(v = 0.8, color = '#ffffff') {
      flashEl.style.transition = 'none'; flashEl.style.background = color; flashEl.style.opacity = String(v);
      void flashEl.offsetWidth; flashEl.style.transition = 'opacity .35s'; flashEl.style.opacity = '0';
    },
    // regiones: crea un contenedor por región (girado si toca)
    setRegions(regions, players) {
      capa.innerHTML = ''; api.regions = regions.map((r) => {
        const e = document.createElement('div');
        e.className = 'mt-region' + (r.rot ? ' rot' : '') + (regions.length > 1 ? ' mitad' : '');
        Object.assign(e.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        capa.appendChild(e);
        return { ...r, el: e };
      });
      capa.classList.toggle('p1', regions.length === 1);
      api.players = players;
      api.hud = [];
    },
    // marcador del combate en cada región
    buildHud(names, cornerOf) {
      api.hud = api.regions.map((r) => {
        const me = r.pl >= 0 ? r.pl : 0, other = 1 - me;
        const left = r.pl === 1 ? 1 : 0, right = 1 - left;
        const side = (p, cls) => `<div class="mt-lado ${cls} ${cornerOf[p]}"><div class="mt-nombre">${cls === 'der' ? '' : `<small>${cornerOf[p] === 'rojo' ? 'ROJA' : 'AZUL'}</small>`}${esc(names[p])}${cls === 'der' ? `<small>${cornerOf[p] === 'rojo' ? 'ROJA' : 'AZUL'}</small>` : ''}</div><div class="mt-vida"><u></u><i></i><b></b></div><div class="mt-aguante"><i></i></div></div>`;
        const wrap = document.createElement('div'); wrap.className = 'mt-marcador';
        wrap.innerHTML = side(left, 'izq') + '<div class="mt-centro"><div class="mt-asalto">ASALTO 1</div><div class="mt-reloj">0:40</div></div>' + side(right, 'der');
        const contra = document.createElement('div'); contra.className = 'mt-contra'; contra.textContent = '¡CONTRAATAQUE!';
        const ley = document.createElement('div'); ley.className = 'mt-leyenda'; ley.dataset.pl = String(r.pl);
        r.el.append(wrap, contra, ley);
        const q = (p) => wrap.querySelector(`.mt-lado.${p === left ? 'izq' : 'der'}`);
        const els = [0, 1].map((p) => ({ u: q(p).querySelector('.mt-vida u'), i: q(p).querySelector('.mt-vida i'), b: q(p).querySelector('.mt-vida b'), ag: q(p).querySelector('.mt-aguante'), agi: q(p).querySelector('.mt-aguante i') }));
        void other;
        return { r, els, asalto: wrap.querySelector('.mt-asalto'), reloj: wrap.querySelector('.mt-reloj'), contra, me, cache: {} };
      });
    },
    // leyenda de teclas/mando (solo si no se juega con el dedo)
    setDevice(dev, players) {
      if (api._dev === dev + players) return; api._dev = dev + players;
      capa.classList.toggle('teclado', dev !== 'touch');
      const K = dev === 'pad'
        ? [['X', 'puño'], ['Y', 'patada'], ['B', 'rodilla/codo'], ['LB', 'bloqueo'], ['A', 'esquiva']]
        : players === 2 ? null : [['J', 'puño'], ['K', 'patada'], ['L', 'rodilla/codo'], ['ESPACIO', 'bloqueo'], ['⇧', 'esquiva']];
      const K2 = [[['A'], ['S'], ['D'], ['W'], ['Q']], [['←'], ['↓'], ['→'], ['↑'], ['⇧ der.']]];
      capa.querySelectorAll('.mt-leyenda').forEach((e) => {
        if (K) e.innerHTML = K.map(([k, v]) => `<b>${k}</b> ${v}`).join(' ');
        else e.innerHTML = [0, 1].map((p) => `${p === 0 ? 'Rojo' : 'Azul'}: ` + ['puño', 'patada', 'rodilla', 'bloqueo', 'esquiva'].map((v, i) => `<b>${K2[p][i]}</b> ${v}`).join(' ')).join(' &nbsp;·&nbsp; ');
      });
    },
    updateHud(fs, ronda, rondas, tiempo) {
      for (const h of api.hud) {
        fs.forEach((f, p) => {
          const e = h.els[p];
          const base = Math.max(0, f.hp / f.hpMax);
          const kv = `${base.toFixed(3)}|${(f.st / f.stMax).toFixed(2)}`;
          if (h.cache[p] === kv) return; h.cache[p] = kv;
          e.i.style.transform = `scaleX(${base})`; e.u.style.transform = `scaleX(${base})`;
          e.b.style.transform = 'scaleX(0)';
          e.agi.style.transform = `scaleX(${Math.max(0, f.st / f.stMax)})`;
          e.ag.classList.toggle('bajo', f.st < 20);
        });
        const txt = `ASALTO ${ronda}/${rondas}`;
        if (h.asalto._t !== txt) { h.asalto.textContent = txt; h.asalto._t = txt; }
        const s = Math.max(0, Math.ceil(tiempo));
        const tt = `0:${String(s).padStart(2, '0')}`;
        if (h.reloj._t !== tt) { h.reloj.textContent = tt; h.reloj._t = tt; h.reloj.classList.toggle('poco', s <= 5); }
        const crit = fs[h.me] && fs[h.me].crit > 0;
        if (h.contra._on !== crit) { h.contra.classList.toggle('on', crit); h.contra._on = crit; }
      }
    },
    // texto flotante: en la región del jugador p (o en todas si p es null)
    pop(text, { p = null, color = '', size = '', y = 0.36, x = 0.5 } = {}) {
      for (const r of api.regions) {
        if (p !== null && r.pl >= 0 && r.pl !== p) continue;
        let xx = x;
        if (r.pl === -1 && p !== null) xx = p === 0 ? 0.27 : 0.73;
        const e = document.createElement('div');
        e.className = 'mt-pop' + (size ? ' ' + size : '');
        e.innerHTML = text;
        if (color) e.style.color = color;
        e.style.left = (xx * 100) + '%'; e.style.top = (y * 100) + '%';
        r.el.appendChild(e);
        setTimeout(() => e.remove(), 950);
      }
    },
    ayuda(html, ms = 2600, { p = null, y = 0.62 } = {}) {
      for (const r of api.regions) {
        if (p !== null && r.pl >= 0 && r.pl !== p) continue;
        const e = document.createElement('div'); e.className = 'mt-ayuda'; e.innerHTML = html; e.style.top = (y * 100) + '%';
        if (r.pl === -1 && p !== null) e.style.left = p === 0 ? '25%' : '75%';
        r.el.appendChild(e);
        requestAnimationFrame(() => e.classList.add('on'));
        setTimeout(() => { e.classList.remove('on'); setTimeout(() => e.remove(), 350); }, ms);
      }
    },
    dispose() { vin.remove(); lienzo.remove(); capa.remove(); flashEl.remove(); },
  };
  return api;
}

// ───────── menú de inicio de la etapa ─────────
export function menuJugadores(root, names, { onPick, input }) {
  injectCSS();
  const m = document.createElement('div'); m.className = 'mt-menu no-ctrl';
  m.innerHTML = `<div class="panel"><h2>El combate</h2><div class="mt-sub">Estadio de Bangkok · Muay Thai</div>
    <div class="mt-ops">
      <button class="boton uno" data-n="1"><b>1 JUGADOR</b><span>${esc(names[0])} contra Somchai «el Bambú»</span></button>
      <button class="boton dos" data-n="2"><b>2 JUGADORES</b><span>${esc(names[0])} contra ${esc(names[1])} en el mismo móvil</span></button>
    </div><div class="mt-teclas">Teclado: 1 o 2 · Mando: A o Y</div></div>`;
  root.appendChild(m);
  let done = false;
  const pick = (n) => { if (done) return; done = true; off(); m.remove(); onPick(n); };
  m.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); pick(+b.dataset.n); }));
  const onKey = (e) => { if (e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'Enter') pick(1); if (e.code === 'Digit2' || e.code === 'Numpad2') pick(2); };
  addEventListener('keydown', onKey);
  let padWas = true;
  const timer = setInterval(() => {
    let pads = []; try { pads = [...navigator.getGamepads()].filter(Boolean); } catch (e) { /* nada */ }
    const a = pads.some((p) => p.buttons[0] && p.buttons[0].pressed), y = pads.some((p) => p.buttons[3] && p.buttons[3].pressed);
    if (!padWas && a) pick(1); else if (!padWas && y) pick(2);
    padWas = a || y;
  }, 60);
  const off = () => { removeEventListener('keydown', onKey); clearInterval(timer); };
  void input;
  return { el: m, close: () => { done = true; off(); m.remove(); } };
}
