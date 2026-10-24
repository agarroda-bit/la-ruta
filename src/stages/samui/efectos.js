// Piezas de interfaz propias de Koh Samui (sin tocar el núcleo): estilos del marcador,
// destello de "foto mental" y polaroid con la captura real de la cala.
const CSS = `
.tema-samui .hud-item { background: rgba(4, 52, 66, .72); border-color: rgba(160, 255, 240, .35); }
.sm-turbo { display: flex; align-items: center; gap: 5px; font-family: var(--titulo); font-size: 13px; letter-spacing: .5px; }
.sm-turbo i { display: block; width: 22px; height: 12px; border-radius: 4px; background: rgba(255,255,255,.18); border: 2px solid rgba(255,255,255,.45); position: relative; overflow: hidden; }
.sm-turbo i b { position: absolute; inset: 0; background: linear-gradient(90deg, #ffb703, #ff6f61); transform-origin: left; }
.sm-turbo.lleno i { box-shadow: 0 0 8px #ffb703; }
.sm-turbo.activo { color: #ffd23f; }
.sm-calas { font-size: 17px; }
.sm-calas .si { filter: none; } .sm-calas .no { filter: grayscale(1) brightness(.75); opacity: .55; }
.sm-flash { position: fixed; inset: 0; background: #fff; pointer-events: none; z-index: 6; animation: smflash .6s ease-out forwards; }
@keyframes smflash { 0% { opacity: .95; } 100% { opacity: 0; } }
.sm-polaroid { position: fixed; right: calc(14px + var(--safe-r)); top: 26%; width: min(46vw, 210px); background: #fffdf6; padding: 8px 8px 0; border-radius: 4px; box-shadow: 0 10px 28px rgba(0,0,0,.35); pointer-events: none; z-index: 6; animation: smpola 3.2s ease-in-out forwards; color: #1a1036; text-align: center; }
.sm-polaroid img { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 2px; background: #9de3e0; }
.sm-polaroid div { font-family: var(--texto); font-weight: 800; font-size: 15px; padding: 6px 0 8px; line-height: 1.1; }
.sm-polaroid small { display: block; font-weight: 500; font-size: 12px; opacity: .7; }
@media (max-width: 600px) { .sm-polaroid { top: 50%; width: 44vw; } }
.sm-turbo-box { position: fixed; right: calc(18px + var(--safe-r)); bottom: calc(146px + var(--safe-b)); z-index: 4; pointer-events: none; background: rgba(4, 52, 66, .72); border: 2px solid rgba(160, 255, 240, .35); border-radius: 12px; padding: 5px 10px; color: #fff; }
@keyframes smpola { 0% { transform: translateX(140%) rotate(16deg); } 14% { transform: translateX(0) rotate(5deg); } 80% { transform: translateX(0) rotate(5deg); opacity: 1; } 100% { transform: translateX(-30%) translateY(-40px) rotate(-8deg) scale(.6); opacity: 0; } }
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
  return {
    turboMeter(html, touch) { tbox.style.display = ''; if (tbox._h !== html) { tbox.innerHTML = html; tbox._h = html; } tbox.style.cssText = touch ? '' : 'bottom:calc(18px + var(--safe-b));right:auto;left:calc(18px + var(--safe-l));transform:scale(1.25);transform-origin:left bottom'; },
    hideMeter() { tbox.style.display = 'none'; },
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
    dispose() { style.remove(); vig.remove(); tbox.remove(); for (const e of live) e.remove(); live.clear(); },
  };
}
