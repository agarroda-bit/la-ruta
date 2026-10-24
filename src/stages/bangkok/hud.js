// HUD propio de Bangkok: minimapa que gira con el tuk-tuk, reloj, baht, carta del turista,
// bocadillos de diálogo (sin parar el juego) y gritos de los locales sobre su cabeza.
import { esc } from '../../core/ui.js';

const CSS = `
.bkk { position: absolute; inset: 0; pointer-events: none; font-family: var(--titulo); color: #fff; }
.bkk-mapa { position: absolute; top: calc(10px + var(--safe-t)); left: calc(10px + var(--safe-l)); width: 118px; height: 118px; border-radius: 50%;
  border: 3px solid #00e5ff; box-shadow: 0 0 16px rgba(0,229,255,.55), 0 4px 0 #1a1036; background: #1a1030; overflow: hidden; }
.bkk-mapa canvas { width: 100%; height: 100%; display: block; }
.bkk-pips { position: absolute; top: calc(134px + var(--safe-t)); left: calc(10px + var(--safe-l)); width: 118px; display: flex; gap: 4px; align-items: center; font-size: 10px; letter-spacing: .5px; }
.bkk-pips i { flex: 1; height: 10px; border-radius: 6px; background: rgba(26,16,54,.75); border: 2px solid #ff3fa4; overflow: hidden; position: relative; }
.bkk-pips i b { position: absolute; inset: 0; background: linear-gradient(90deg, #ff3fa4, #ffd1ec); transform-origin: left; transform: scaleX(0); box-shadow: 0 0 8px #ff3fa4; }
.bkk-pips span { color: #ffd1ec; text-shadow: 0 0 6px #ff3fa4; margin-right: 2px; }
.bkk-reloj { position: absolute; top: calc(8px + var(--safe-t)); left: 50%; transform: translateX(-50%); text-align: center; line-height: 1; }
.bkk-reloj b { display: block; font-size: 30px; color: #fff; text-shadow: 0 0 10px #ff3fa4, 0 0 2px #ff3fa4, 0 3px 0 #1a1036; }
.bkk-reloj small { font-size: 10px; letter-spacing: 2px; color: #ffb3e0; }
@media (max-width: 480px) { .bkk-reloj small { letter-spacing: 1px; } .bkk-reloj small::after { content: ''; } }
.bkk-reloj.aviso b { color: #ff5c5c; animation: bkkLate .5s infinite alternate; }
@keyframes bkkLate { to { transform: scale(1.12); } }
.bkk-dinero { position: absolute; top: calc(12px + var(--safe-t)); right: calc(70px + var(--safe-r)); text-align: right; line-height: 1.05; }
.bkk-dinero b { font-size: clamp(20px, min(3.6vh, 5.6vw), 38px); color: #5dff9b; text-shadow: 0 0 8px rgba(93,255,155,.7), 0 3px 0 #1a1036; }
.bkk-dinero small { display: block; font-size: clamp(10px, min(1.8vh, 2.8vw), 17px); color: #c9f7ff; margin-top: 2px; }
.bkk-plus { position: absolute; top: calc(12px + var(--safe-t) + clamp(40px, 6.5vh, 70px)); right: calc(70px + var(--safe-r)); font-size: clamp(14px, 2.2vh, 22px); color: #ffd23f;
  text-shadow: 0 2px 0 #1a1036, 0 0 8px rgba(255,210,63,.7); opacity: 0; }
.bkk-plus.on { animation: bkkPlus .9s ease-out; }
@keyframes bkkPlus { 0% { opacity: 0; transform: translateY(8px); } 20% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-14px); } }
.bkk-cobro { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; opacity: 0; }
.bkk-cobro.on { animation: bkkCobro 2.2s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes bkkCobro { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.5); } 12% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); } 20% { transform: translate(-50%, -50%) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -62%); } }
.bkk-cobro .k-num { font-size: clamp(46px, 8vh, 84px); line-height: 1; color: #5dff9b; -webkit-text-stroke: 3px #1a1036; text-shadow: 0 5px 0 #1a1036, 0 0 22px rgba(93,255,155,.6); }
.bkk-cobro .k-est { margin-top: 10px; font-size: clamp(30px, 5vh, 50px); line-height: 1; color: #ffd23f; -webkit-text-stroke: 2px #1a1036; text-shadow: 0 4px 0 #1a1036; letter-spacing: 4px; }
.bkk-cobro .k-est i { font-style: normal; color: #4a3f66; }
.bkk-cobro .k-sub { display: inline-block; margin-top: 8px; background: #1a1036; color: #fff; border-radius: 99px; padding: 3px 12px; font-size: clamp(12px, 1.8vh, 17px); }
.bkk-banner { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%); white-space: nowrap; font-size: clamp(20px, 3.6vh, 36px); color: #ffd23f; background: #1a1036;
  border: 3px solid #ffd23f; border-radius: 16px; padding: 6px 16px; box-shadow: 0 0 20px rgba(255,210,63,.6), 0 5px 0 #000; opacity: 0; }
.bkk-banner.on { animation: bkkCobro 2.4s cubic-bezier(.2,1.4,.4,1) both; }
.bkk-carta .c-prisa { display: none; font-size: 11px; color: #1a1036; background: #ffd23f; border-radius: 99px; padding: 1px 7px; margin-left: 4px; }
.bkk-carta.rush .c-prisa { display: inline-block; animation: bkkLate .5s infinite alternate; }
.bkk-carta.rush { border-color: #ffd23f; box-shadow: 0 0 18px rgba(255,210,63,.7), 0 4px 0 #1a1036; }
.bkk-dinero.pop b { animation: bkkPop .35s; display: inline-block; }
@keyframes bkkPop { 40% { transform: scale(1.4); } }
.bkk-carta { position: absolute; top: calc(66px + var(--safe-t)); right: calc(10px + var(--safe-r)); width: min(270px, calc(100vw - 150px));
  display: flex; gap: 8px; align-items: center; background: rgba(20,8,40,.84); border: 2px solid #ff3fa4; border-radius: 16px; padding: 5px 8px 5px 5px;
  box-shadow: 0 0 14px rgba(255,63,164,.45), 0 4px 0 #1a1036; transition: border-color .2s, transform .2s; }
.bkk-carta.ride { border-color: #00e5ff; box-shadow: 0 0 14px rgba(0,229,255,.45), 0 4px 0 #1a1036; }
.bkk-carta.oculta { transform: translateX(120%); }
.bkk-carta img { width: 48px; height: 48px; border-radius: 50%; flex: none; }
.bkk-carta .c-txt { flex: 1; min-width: 0; }
.bkk-carta .c-nom { font-size: 12px; color: #ffd1ec; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bkk-carta .c-dest { font-family: var(--texto); font-weight: 800; font-size: 14px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bkk-carta .c-barra { height: 7px; border-radius: 6px; background: rgba(255,255,255,.15); margin-top: 3px; overflow: hidden; }
.bkk-carta .c-barra i { display: block; height: 100%; background: #00e5ff; transform-origin: left; box-shadow: 0 0 6px currentColor; }
.bkk-carta .c-seg { font-size: 15px; color: #00e5ff; min-width: 34px; text-align: right; }
.bkk-carta.prisa .c-seg { color: #ff5c5c; animation: bkkLate .4s infinite alternate; }
.bkk-burbuja { position: absolute; top: calc(132px + var(--safe-t)); right: calc(10px + var(--safe-r)); max-width: min(300px, calc(100vw - 150px));
  display: flex; gap: 6px; align-items: flex-start; background: #fff8ec; color: #1a1036; border: 3px solid #1a1036; border-radius: 16px 4px 16px 16px;
  padding: 5px 10px 6px 5px; box-shadow: 0 4px 0 #1a1036; font-family: var(--texto); font-weight: 800; font-size: 14px; line-height: 1.15;
  opacity: 0; transform: translateY(-8px) scale(.95); transition: opacity .18s, transform .18s; }
.bkk-burbuja.on { opacity: 1; transform: none; }
.bkk-burbuja img { width: 30px; height: 30px; border-radius: 50%; flex: none; }
.bkk-burbuja .b-quien { display: block; font-family: var(--titulo); font-size: 10px; color: #ff2e88; }
.bkk-burbuja.compi .b-quien { color: #0aa6b8; }
.bkk-local { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); background: #ffd23f; color: #1a1036; border: 2px solid #1a1036; border-radius: 12px;
  padding: 3px 8px; font-family: var(--texto); font-weight: 800; font-size: 13px; white-space: nowrap; box-shadow: 0 3px 0 #1a1036; opacity: 0; transition: opacity .2s; }
.bkk-local.on { opacity: 1; }
.bkk-local.poli { background: #9fe8ff; }
.bkk-pista { position: absolute; left: 50%; bottom: calc(150px + var(--safe-b)); transform: translateX(-50%); background: rgba(20,8,40,.8); border: 2px solid #00e5ff;
  border-radius: 14px; padding: 6px 12px; font-family: var(--texto); font-weight: 800; font-size: 15px; text-align: center; max-width: 86vw; opacity: 0; transition: opacity .3s; }
.bkk-pista.on { opacity: 1; }
@media (max-width: 600px) { .bkk-pista { bottom: calc(262px + var(--safe-b)); font-size: 14px; } .bkk-burbuja { font-size: 13px; } }
.btn-tactil[data-id="turbo"] { background: conic-gradient(#ff3fa4 calc(var(--carga, 0) * 1%), #5a2a55 0) !important; }
.btn-tactil[data-id="drift"] { box-shadow: 0 5px 0 var(--tinta), 0 0 18px rgba(0,229,255,.6); }
.tema-bangkok .grito { text-shadow: 0 0 14px #ff3fa4, 0 4px 0 #1a1036; }
@media (min-width: 900px) and (min-height: 700px) {
  .bkk-carta .c-nom { font-size: 15px; }
  .bkk-carta .c-seg { font-size: 20px; }
  .bkk-pips { font-size: 13px; }
  .bkk-pips i { height: 13px; }
  .bkk-reloj small { font-size: 13px; }
}
@media (min-width: 900px) {
  .bkk-mapa { width: 170px; height: 170px; }
  .bkk-pips { top: calc(186px + var(--safe-t)); width: 170px; }
  .bkk-reloj b { font-size: 40px; }
  .bkk-carta { width: 330px; top: calc(70px + var(--safe-t)); }
  .bkk-carta img { width: 58px; height: 58px; }
  .bkk-carta .c-dest { font-size: 17px; }
  .bkk-burbuja { top: calc(146px + var(--safe-t)); font-size: 17px; max-width: 360px; }
}
`;

export function createHud(ctx, mm) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'bkk bkk-hud';
  root.innerHTML = `
    <div class="bkk-mapa"><canvas></canvas></div>
    <div class="bkk-pips"><span>TURBO</span><i><b></b></i><i><b></b></i><i><b></b></i></div>
    <div class="bkk-reloj"><b>2:30</b><small>TURNO</small></div>
    <div class="bkk-dinero"><b>0 ฿</b><small>🛺 0 entregados</small></div>
    <div class="bkk-carta oculta"><img alt=""><div class="c-txt"><div class="c-nom"></div><span class="c-prisa">⚡ PRISA ×2</span><div class="c-dest"></div><div class="c-barra"><i></i></div></div><div class="c-seg"></div></div>
    <div class="bkk-burbuja"><img alt=""><div><span class="b-quien"></span><span class="b-txt"></span></div></div>
    <div class="bkk-local"></div>
    <div class="bkk-plus"></div>
    <div class="bkk-cobro"><div class="k-num"></div><div class="k-est"></div><div class="k-sub"></div></div>
    <div class="bkk-banner"></div>
    <div class="bkk-pista"></div>`;
  (ctx.hud.el || document.body).appendChild(root);
  const $ = (s) => root.querySelector(s);
  const cv = $('.bkk-mapa canvas'), g = cv.getContext('2d');
  const reloj = $('.bkk-reloj'), dinero = $('.bkk-dinero'), carta = $('.bkk-carta'), burbuja = $('.bkk-burbuja'), local = $('.bkk-local'), pista = $('.bkk-pista');
  const pips = [...root.querySelectorAll('.bkk-pips b')];
  let sayT = 0, localT = 0, pistaT = 0, lastClock = '', lastMoney = -1, cardKey = '';
  let turboBtn = null;

  const api = {
    root,
    clock(sec) {
      const s = Math.max(0, Math.ceil(sec)), txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (txt !== lastClock) { reloj.firstElementChild.textContent = txt; lastClock = txt; reloj.classList.toggle('aviso', s <= 15); }
    },
    money(n, count) {
      if (n === lastMoney && count === api._c) return;
      const up = n > lastMoney && lastMoney >= 0;
      lastMoney = n; api._c = count;
      dinero.innerHTML = `<b>${n} ฿</b><small>🛺 ${count} entregado${count === 1 ? '' : 's'}</small>`;
      if (up) { dinero.classList.remove('pop'); void dinero.offsetWidth; dinero.classList.add('pop'); }
    },
    turbo(v) {
      for (let i = 0; i < 3; i++) pips[i].style.transform = `scaleX(${Math.max(0, Math.min(1, v * 3 - i))})`;
      if (!turboBtn || !turboBtn.isConnected) turboBtn = document.querySelector('.btn-tactil[data-id="turbo"]');
      if (turboBtn) turboBtn.style.setProperty('--carga', String(Math.round(v * 100)));
    },
    card(t, mode, destName, left, max) {
      if (!t) { carta.classList.add('oculta'); cardKey = ''; return; }
      const key = t.id + mode;
      if (key !== cardKey) {
        cardKey = key;
        carta.classList.remove('oculta');
        carta.classList.toggle('ride', mode === 'ride');
        carta.querySelector('img').src = t.portrait;
        carta.querySelector('.c-nom').textContent = mode === 'ride' ? t.name : `${t.name} · de ${t.from}`;
        carta.querySelector('.c-dest').textContent = mode === 'ride' ? `→ ${destName}` : '📍 Te espera: recógelo';
        carta.querySelector('.c-barra').style.display = mode === 'ride' ? '' : 'none';
        carta.querySelector('.c-seg').style.display = mode === 'ride' ? '' : 'none';
      }
      if (mode === 'ride') {
        const k = Math.max(0, left / max);
        const bar = carta.querySelector('.c-barra i');
        bar.style.transform = `scaleX(${k})`;
        bar.style.background = k > 0.5 ? '#00e5ff' : k > 0.25 ? '#ffd23f' : '#ff5c5c';
        const s = Math.max(0, Math.ceil(left));
        const seg = carta.querySelector('.c-seg');
        if (seg._v !== s) { seg.textContent = s + 's'; seg._v = s; }
        carta.classList.toggle('prisa', left < 6);
      } else carta.classList.remove('prisa');
    },
    say(img, who, text, ms = 3200, isCompi = false) {
      burbuja.querySelector('img').src = img || '';
      burbuja.querySelector('img').style.display = img ? '' : 'none';
      burbuja.querySelector('.b-quien').textContent = who;
      burbuja.querySelector('.b-txt').textContent = text;
      burbuja.classList.toggle('compi', isCompi);
      burbuja.classList.add('on');
      sayT = ms / 1000;
    },
    get talking() { return sayT > 0; },
    local(text, cls = '') { local.textContent = text; local.className = 'bkk-local on ' + cls; localT = 2.6; },
    localPos(x, y, vis) { local.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; if (!vis) local.classList.remove('on'); },
    get localOn() { return localT > 0; },
    rush(on) { carta.classList.toggle('rush', !!on); },
    plus(text) { const e = root.querySelector('.bkk-plus'); e.textContent = text; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); },
    cobro(amount, rating, sub) {
      const e = root.querySelector('.bkk-cobro');
      e.querySelector('.k-num').textContent = `+${amount} ฿`;
      e.querySelector('.k-est').innerHTML = '★'.repeat(rating) + '<i>' + '★'.repeat(3 - rating) + '</i>';
      e.querySelector('.k-sub').textContent = sub;
      e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
    },
    banner(text, color = '#ffd23f') { const e = root.querySelector('.bkk-banner'); e.textContent = text; e.style.color = color; e.style.borderColor = color; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); },
    hint(text, ms = 3000) { pista.innerHTML = esc(text); pista.classList.add('on'); pistaT = ms / 1000; },
    tick(dt) {
      if (sayT > 0) { sayT -= dt; if (sayT <= 0) burbuja.classList.remove('on'); }
      if (localT > 0) { localT -= dt; if (localT <= 0) local.classList.remove('on'); }
      if (pistaT > 0) { pistaT -= dt; if (pistaT <= 0) pista.classList.remove('on'); }
    },
    // minimapa: route = [[x,z],...] desde el jugador hasta el objetivo
    map(px, pz, yaw, route, target, color, cars) {
      const W = cv.clientWidth || 118, dpr = Math.min(2, devicePixelRatio || 1), size = Math.round(W * dpr);
      if (cv.width !== size) { cv.width = size; cv.height = size; }
      const view = 62; // radio visible en unidades del mundo
      const sc = (size / 2) / (view * mm.S);
      const th = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
      const X = (x) => (x + mm.R) * mm.S;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, size, size);
      g.save();
      g.translate(size / 2, size / 2); g.rotate(th); g.scale(sc, sc); g.translate(-X(px), -X(pz));
      g.drawImage(mm.canvas, 0, 0);
      if (cars) { g.fillStyle = 'rgba(255,255,255,.55)'; for (const c of cars) { g.fillRect(X(c.x) - 2, X(c.z) - 2, 4, 4); } }
      if (route && route.length) {
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.strokeStyle = color; g.globalAlpha = 0.35; g.lineWidth = 14; g.beginPath(); g.moveTo(X(px), X(pz));
        for (const [x, z] of route) g.lineTo(X(x), X(z)); g.stroke();
        g.globalAlpha = 1; g.lineWidth = 6; g.stroke();
      }
      if (target) {
        const pulse = 9 + Math.sin(performance.now() / 150) * 3;
        g.fillStyle = color; g.beginPath(); g.arc(X(target[0]), X(target[1]), pulse, 0, 7); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      }
      g.restore();
      // objetivo fuera del mapa: flecha en el borde
      if (target) {
        const dx = target[0] - px, dz = target[1] - pz, d = Math.hypot(dx, dz);
        if (d > view * 0.92) {
          const rx = dx * Math.cos(th) - dz * Math.sin(th), ry = dx * Math.sin(th) + dz * Math.cos(th);
          const a = Math.atan2(ry, rx), r = size / 2 - 10 * dpr;
          g.save(); g.translate(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r); g.rotate(a);
          g.fillStyle = color; g.strokeStyle = '#1a1036'; g.lineWidth = 2 * dpr;
          g.beginPath(); g.moveTo(8 * dpr, 0); g.lineTo(-6 * dpr, -7 * dpr); g.lineTo(-6 * dpr, 7 * dpr); g.closePath(); g.fill(); g.stroke(); g.restore();
        }
      }
      // el jugador: flecha fija hacia arriba
      g.save(); g.translate(size / 2, size / 2);
      g.fillStyle = '#fff'; g.strokeStyle = '#ff2e88'; g.lineWidth = 3 * dpr;
      g.beginPath(); g.moveTo(0, -11 * dpr); g.lineTo(8 * dpr, 9 * dpr); g.lineTo(0, 4 * dpr); g.lineTo(-8 * dpr, 9 * dpr); g.closePath(); g.stroke(); g.fill();
      g.restore();
    },
    dispose() { style.remove(); root.remove(); },
  };
  return api;
}
