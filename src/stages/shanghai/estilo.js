// Estilos y marcador propios de Shanghái (se inyectan una vez; todo cuelga de .tema-shanghai
// o de elementos de esta etapa, así no pisa a nadie).
const CSS = `
.tema-shanghai .hud-item { background: rgba(6, 12, 38, .74); border-color: rgba(76, 201, 240, .45); }
.tema-shanghai .hud-abajo { bottom: calc(14px + var(--safe-b)); }
.tema-shanghai .hud-velo { padding: 2px 10px 6px; border-radius: 18px; }
.sh-velo { position: relative; width: 128px; height: 74px; }
.sh-velo svg { position: absolute; left: 0; top: 0; width: 128px; height: 70px; overflow: visible; }
.sh-velo .arco-bg { fill: none; stroke: rgba(255,255,255,.14); stroke-width: 9; stroke-linecap: round; }
.sh-velo .arco { fill: none; stroke: #4cc9f0; stroke-width: 9; stroke-linecap: round; stroke-dasharray: 164; stroke-dashoffset: 164; filter: drop-shadow(0 0 5px #4cc9f0); transition: stroke .2s; }
.sh-velo.turbo .arco { stroke: #ff4fa3; filter: drop-shadow(0 0 7px #ff4fa3); }
.sh-num { position: absolute; left: 0; right: 0; top: 24px; text-align: center; font-family: var(--titulo); font-size: 34px; line-height: 1; color: #fff; text-shadow: 0 0 12px #4cc9f0, 0 3px 0 #1a1036; }
.sh-kmh { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-family: var(--texto); font-weight: 800; font-size: 12px; letter-spacing: 2px; opacity: .8; }
.sh-velo.max .sh-num { color: #ffd1ec; text-shadow: 0 0 16px #ff4fa3, 0 3px 0 #1a1036; animation: shlatido .18s infinite alternate; }
@keyframes shlatido { to { transform: scale(1.12); } }
.tema-shanghai .hud-energia .barra-lbl { font-size: 12px; }
.tema-shanghai .hud-energia.lleno { animation: shlleno .4s infinite alternate; border-color: #ff4fa3; }
@keyframes shlleno { to { box-shadow: 0 0 18px #ff4fa3; } }
.sh-orb { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, #5ef0ff 40%, #1f7bff); box-shadow: 0 0 8px #5ef0ff; vertical-align: -1px; margin-right: 4px; }
.sh-choques { display: flex; gap: 4px; align-items: center; }
.sh-choques i { width: 18px; height: 12px; border-radius: 6px 10px 3px 3px; background: #eef2f8; box-shadow: inset 0 -4px 0 #1f6feb; display: inline-block; }
.sh-choques i.roto { background: #4a2030; box-shadow: none; opacity: .6; }
.tema-shanghai .hud-ruta { min-width: 0; width: 160px; padding: 2px 10px 6px; }
.tema-shanghai .hud-energia { width: 160px; min-width: 0; }
.tema-shanghai .hud-izq .hud-item { padding: 4px 10px; }
.tema-shanghai .hud-ruta .barra-lbl { font-size: 11px; }
.tema-shanghai .hud-aviso { position: absolute; top: 108px; left: 50%; transform: translateX(-50%); background: rgba(190, 16, 40, .88); border-color: #ffb3c0; animation: shparpadeo .3s infinite alternate; font-size: 15px; }
@keyframes shparpadeo { to { background: rgba(120, 6, 24, .88); } }
.sh-carriles { display: inline-flex; gap: 7px; margin-left: 6px; font-family: var(--texto); font-weight: 800; }
.sh-carriles b { width: 22px; text-align: center; font-size: 18px; line-height: 1; }
.sh-carriles b.x { color: #fff; text-shadow: 0 0 6px #fff; }
.sh-carriles b.ok { color: #7cff6b; }
.sh-tip { position: fixed; left: 50%; top: calc(170px + var(--safe-t)); transform: translateX(-50%); background: rgba(255,79,163,.92); color: #fff; font-family: var(--texto); font-weight: 800; font-size: 16px; padding: 7px 16px; border-radius: 14px; border: 2px solid #fff; white-space: nowrap; animation: shbanner .4s cubic-bezier(.2,1.5,.4,1) both; box-shadow: 0 0 18px #ff4fa3; }
.sh-carriles i { width: 13px; height: 18px; border-radius: 4px; background: rgba(255,255,255,.3); display: inline-block; }
.sh-carriles i.x { background: #ff2d55; box-shadow: 0 0 8px #ff8099; }
.sh-carriles i.yo { outline: 2px solid #4cc9f0; }
.sh-flash { position: fixed; inset: 0; pointer-events: none; animation: shflash .5s ease-out forwards; }
@keyframes shflash { from { opacity: .55; } to { opacity: 0; } }
.sh-lineas { position: fixed; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(76,201,240,.18) 80%, rgba(255,79,163,.28) 100%); transition: opacity .3s; }
.sh-fundido { position: fixed; inset: 0; background: #02040d; opacity: 0; transition: opacity .4s; pointer-events: none; }
.sh-fundido.on { opacity: 1; }
.sh-banner { position: fixed; left: 50%; top: 44%; transform: translate(-50%, -50%); width: 100%; padding: 16px 4% 14px; background: linear-gradient(180deg, rgba(4,6,20,0) 0%, rgba(4,6,20,.72) 18%, rgba(4,6,20,.72) 82%, rgba(4,6,20,0) 100%); text-align: center; font-family: var(--titulo); font-size: clamp(26px, 7.4vw, 56px); line-height: 1.08; color: #fff; -webkit-text-stroke: 2px #1a1036; text-shadow: 0 4px 0 #1a1036, 0 0 26px #ff4fa3; pointer-events: none; animation: shbanner 1s cubic-bezier(.2,1.5,.4,1) both; }
.sh-banner small { display: block; font-family: var(--texto); font-weight: 800; font-size: .42em; -webkit-text-stroke: 0; letter-spacing: 3px; color: #ffd166; text-shadow: 0 2px 0 #1a1036, 0 0 10px #000; margin-top: 10px; }
@keyframes shbanner { from { transform: translate(-50%, -50%) scale(.3); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
.controles .btn-tactil[data-id="izq"] span, .controles .btn-tactil[data-id="der"] span { font-size: 40px; line-height: .8; }
.controles .btn-tactil[data-id="boost"].listo { animation: shturbo .45s infinite alternate; }
@keyframes shturbo { to { transform: scale(1.12); box-shadow: 0 0 26px #ff4fa3, 0 5px 0 #1a1036; } }
.controles .btn-tactil[data-id="boost"] { width: 74px; height: 74px; font-size: 13px; }
.controles .btn-tactil[data-id="boost"].vacio { filter: saturate(.35) brightness(.8); opacity: .45; }
.hud.sh-ultimo::after { content: ''; position: fixed; inset: 0; pointer-events: none; box-shadow: inset 0 0 90px rgba(255, 176, 0, .45); animation: shultimo .5s infinite alternate; }
@keyframes shultimo { from { opacity: .45; } to { opacity: 1; } }
.tema-shanghai.sh-ultimo .hud-ruta { border-color: #ffd166; }
`;

export function injectStyle() {
  if (document.getElementById('estilo-shanghai')) return;
  const s = document.createElement('style');
  s.id = 'estilo-shanghai';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// Marcador: velocímetro grande abajo, energía arriba, orbes y ruta a la izquierda, choques a la derecha
export function makeHud(ctx) {
  const { hud } = ctx;
  const veloEl = hud.set('velo', `<div class="sh-velo"><svg viewBox="0 0 128 70"><path class="arco-bg" d="M12 64 A52 52 0 0 1 116 64"/><path class="arco" d="M12 64 A52 52 0 0 1 116 64"/></svg><div class="sh-num">0</div><div class="sh-kmh">KM/H</div></div>`, 'abajo');
  const velo = veloEl.querySelector('.sh-velo'), num = veloEl.querySelector('.sh-num'), arco = veloEl.querySelector('.arco');
  const energia = hud.bar('energia', 0, '⚡ ENERGÍA', 'centro', '#4cc9f0');
  const eLbl = energia.querySelector('.barra-lbl');
  let lastK = -1, lastLbl = '', lastTurbo = null, lastMax = null;
  const fx = document.createElement('div'); fx.className = 'sh-lineas'; hud.el.appendChild(fx);
  return {
    fx,
    update(st, total) {
      const k = Math.round(st.kmh);
      if (k !== lastK) { num.textContent = k; arco.style.strokeDashoffset = String(164 * (1 - Math.min(1, st.kmh / 430))); lastK = k; }
      const max = st.kmh >= 429.5;
      if (max !== lastMax) { velo.classList.toggle('max', max); lastMax = max; }
      if (st.turbo !== lastTurbo) { velo.classList.toggle('turbo', st.turbo); lastTurbo = st.turbo; }
      hud.bar('energia', st.energy);
      const lbl = st.turbo ? '⚡ ¡TURBO!' : st.energy >= 0.999 ? '⚡ ¡TURBO LISTO!' : '⚡ ENERGÍA';
      if (lbl !== lastLbl) { eLbl.textContent = lbl; energia.classList.toggle('lleno', st.energy >= 0.999 && !st.turbo); lastLbl = lbl; }
      hud.set('orbes', `<span class="sh-orb"></span>${st.orbs}`, 'izq');
      hud.bar('ruta', st.s / st.L, st.tramo, 'centro', '#ffd166');
      const rb = hud.items.get('ruta'); if (rb) { const l = rb.querySelector('.barra-lbl'); if (l && l.textContent !== st.tramo) l.textContent = st.tramo; }
      hud.set('choques', `<div class="sh-choques">${[0, 1, 2].map((i) => `<i class="${i >= 3 - st.danos ? 'roto' : ''}"></i>`).join('')}</div>`, 'izq');
      fx.style.opacity = String(st.turbo ? 1 : Math.max(0, (st.kmh - 330) / 200));
    },
    aviso(html) {
      if (html) hud.set('aviso', html, 'centro');
      else hud.remove('aviso');
    },
    flash(color) { const f = document.createElement('div'); f.className = 'sh-flash'; f.style.background = color; hud.el.appendChild(f); setTimeout(() => f.remove(), 520); },
  };
}
