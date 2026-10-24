// Piezas de interfaz propias de Koh Samui (sin tocar el núcleo): estilos del marcador,
// destello de "foto mental" y polaroid con la captura real de la cala.
const CSS = `
.tema-samui .hud-item { background: rgba(4, 52, 66, .72); border-color: rgba(160, 255, 240, .35); }
.sm-turbo { display: flex; align-items: center; gap: 5px; font-family: var(--titulo); font-size: 13px; letter-spacing: .5px; }
.sm-turbo i { display: block; width: 22px; height: 12px; border-radius: 4px; background: rgba(255,255,255,.18); border: 2px solid rgba(255,255,255,.45); position: relative; overflow: hidden; }
.sm-turbo i b { position: absolute; inset: 0; background: linear-gradient(90deg, #ffb703, #ff6f61); transform-origin: left; }
.sm-turbo.lleno i { box-shadow: 0 0 8px #ffb703; }
.sm-turbo.activo { color: #ffd23f; }
.sm-calas { font-family: var(--titulo); font-size: 13px; letter-spacing: .5px; } .sm-calas small { font-size: 13px; margin-left: 3px; }
.sm-hint { position: fixed; left: 50%; top: calc(112px + var(--safe-t)); transform: translateX(-50%); width: max-content; max-width: min(92vw, 520px); background: rgba(255,248,236,.95); color: #1a1036; border: 3px solid #1a1036; border-radius: 14px; padding: 7px 14px; font-size: 15px; line-height: 1.25; text-align: center; z-index: 5; pointer-events: none; box-shadow: 0 4px 0 rgba(26,16,54,.9); animation: smhint .3s ease-out; }
@keyframes smhint { from { transform: translate(-50%, -12px); opacity: 0; } }
@media (min-width: 900px) { .sm-hint { top: calc(70px + var(--safe-t)); } }
.sm-calas .si { filter: none; } .sm-calas .no { filter: grayscale(1) brightness(.75); opacity: .55; }
.sm-flash { position: fixed; inset: 0; background: #fff; pointer-events: none; z-index: 6; animation: smflash .6s ease-out forwards; }
@keyframes smflash { 0% { opacity: .95; } 100% { opacity: 0; } }
.sm-polaroid { position: fixed; left: 50%; top: calc(64px + var(--safe-t)); width: 150px; margin-left: -75px; background: #fffdf6; padding: 8px 8px 0; border-radius: 4px; box-shadow: 0 10px 28px rgba(0,0,0,.35); pointer-events: none; z-index: 6; animation: smpola 3.2s ease-in-out forwards; color: #1a1036; text-align: center; }
.sm-polaroid img { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 2px; background: #9de3e0; }
.sm-polaroid div { font-family: var(--texto); font-weight: 800; font-size: 15px; padding: 6px 0 8px; line-height: 1.1; }
.sm-polaroid small { display: block; font-weight: 500; font-size: 12px; opacity: .7; }
@media (max-width: 600px) { .sm-polaroid { width: 112px; margin-left: -56px; padding: 5px 5px 0; } .sm-polaroid div { font-size: 12px; padding: 4px 0 5px; } .sm-polaroid small { font-size: 10px; } }
.sm-tb { display: flex; gap: 3px; justify-content: center; margin-top: 6px; }
.sm-tb i { display: block; position: relative; width: 17px; height: 8px; border-radius: 3px; background: rgba(0,0,0,.35); overflow: hidden; }
.sm-tb b { position: absolute; inset: 0; background: #fff; transform-origin: left; }
.btn-tactil.sm-vacio { filter: grayscale(.9) brightness(.85); opacity: .55; }
.btn-tactil.sm-activo { box-shadow: 0 0 22px #ffd23f, 0 5px 0 var(--tinta); }
.sm-ptr { position: fixed; left: 0; top: 0; z-index: 3; pointer-events: none; color: #ffe14d; font-family: var(--titulo); text-align: center; transform: translate(-50%, -50%); text-shadow: 0 2px 0 #1a1036, 0 0 6px rgba(0,0,0,.4); display: none; }
.sm-ptr i { display: block; font-style: normal; font-size: 34px; line-height: 1; -webkit-text-stroke: 2px #1a1036; }
.sm-ptr b { display: block; font-size: 13px; color: #fff; }
.sm-turbo-box { position: fixed; right: calc(18px + var(--safe-r)); bottom: calc(146px + var(--safe-b)); z-index: 4; pointer-events: none; background: rgba(4, 52, 66, .72); border: 2px solid rgba(160, 255, 240, .35); border-radius: 12px; padding: 5px 10px; color: #fff; }
@keyframes smpola { 0% { transform: translateY(-160%) rotate(-12deg); } 14% { transform: translateY(0) rotate(4deg); } 82% { transform: translateY(0) rotate(4deg); opacity: 1; } 100% { transform: translateY(-30px) rotate(-6deg) scale(.7); opacity: 0; } }
.sm-viñeta { position: fixed; inset: 0; pointer-events: none; z-index: 1; box-shadow: inset 0 0 120px rgba(255, 190, 60, 0); transition: box-shadow .25s; }
.sm-viñeta.turbo { box-shadow: inset 0 0 110px rgba(255, 170, 40, .55); }
`;

export function mountFx() {
  const ui = document.getElementById('ui') || document.body;
  const style = document.createElement('style'); style.id = 'samui-css'; style.textContent = CSS;
  document.head.appendChild(style);
  const vig = document.createElement('div'); vig.className = 'sm-viñeta'; vig.style.pointerEvents = 'none';
  ui.appendChild(vig);
  const live = new Set();
  const add = (el, ms) => { el.style.pointerEvents = 'none'; ui.appendChild(el); live.add(el); setTimeout(() => { el.remove(); live.delete(el); }, ms); return el; };
  const tbox = document.createElement('div'); tbox.className = 'sm-turbo-box'; ui.appendChild(tbox);
  const ptr = document.createElement('div'); ptr.className = 'sm-ptr'; ptr.innerHTML = '<i>➤</i><b></b>'; ui.appendChild(ptr);
  const pI = ptr.querySelector('i'), pB = ptr.querySelector('b');
  let tb = null;
  return {
    // flecha a la siguiente boya: encima si se ve; en el borde si está fuera de pantalla
    pointer(show, x, y, on, ang, dist) {
      if (!show) { ptr.style.display = 'none'; return; }
      ptr.style.display = 'block';
      ptr.style.left = x + 'px'; ptr.style.top = y + 'px';
      pI.style.transform = `rotate(${on ? 90 : ang}deg)`;
      const t = dist + ' m'; if (pB.textContent !== t) pB.textContent = t;
    },
    turboButton(v, active, running) {
      if (!tb || !tb.isConnected) {
        tb = document.querySelector('.btn-tactil[data-id="boost"]');
        if (!tb) return;
        tb.querySelector('span').innerHTML = 'TURBO<div class="sm-tb"><i><b></b></i><i><b></b></i><i><b></b></i></div>';
        tb._bs = [...tb.querySelectorAll('.sm-tb b')];
      }
      tb._bs.forEach((b, i) => { b.style.transform = `scaleX(${Math.max(0, Math.min(1, v * 3 - i)).toFixed(2)})`; });
      tb.classList.toggle('sm-vacio', v < 0.33 && !active);
      tb.classList.toggle('sm-activo', active && running);
    },
    turboMeter(html, touch) { tbox.style.display = ''; if (tbox._h !== html) { tbox.innerHTML = html; tbox._h = html; } tbox.style.cssText = touch ? '' : 'bottom:calc(18px + var(--safe-b));right:auto;left:calc(18px + var(--safe-l));transform:scale(1.25);transform-origin:left bottom'; },
    hideMeter() { tbox.style.display = 'none'; },
    hint(html, ms = 2400) {
      if (this._hint) this._hint.remove();
      const d = document.createElement('div'); d.className = 'sm-hint'; d.innerHTML = html; this._hint = d; add(d, ms);
    },
    turbo(on) { vig.classList.toggle('turbo', !!on); },
    flash() { const d = document.createElement('div'); d.className = 'sm-flash'; add(d, 700); },
    polaroid(canvas, title, sub) {
      const d = document.createElement('div'); d.className = 'sm-polaroid';
      let src = '';
      try {
        // recorte cuadrado y pequeño para que no pese
        const s = Math.min(canvas.width, canvas.height), c = document.createElement('canvas'); c.width = c.height = 220;
        c.getContext('2d').drawImage(canvas, (canvas.width - s) / 2, (canvas.height - s) / 2 * 0.8, s, s, 0, 0, 220, 220);
        src = c.toDataURL('image/jpeg', 0.8);
      } catch (e) { src = ''; }
      d.innerHTML = `${src ? `<img src="${src}" alt="">` : '<img alt="">'}<div>${title}<small>${sub}</small></div>`;
      add(d, 3300);
    },
    dispose() { style.remove(); vig.remove(); tbox.remove(); ptr.remove(); for (const e of live) e.remove(); live.clear(); },
  };
}
