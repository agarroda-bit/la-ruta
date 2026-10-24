// MACAO · piezas de interfaz propias: estilos, retrovisor, burbujas del Taxista Zhou,
// barra de ruta con los dos coches y carga de turbo. Todo vive dentro de #ui y se quita al salir.
const CSS = `
.mc-ruta{min-width:190px;padding:5px 12px 7px !important}
.mc-linea{position:relative;height:9px;border-radius:99px;background:rgba(255,255,255,.18);margin:5px 10px 5px 4px}
.mc-linea .mc-hecho{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#7b2cbf,#c77dff)}
.mc-linea i{position:absolute;top:50%;width:17px;height:17px;border-radius:50%;transform:translate(-50%,-50%);border:3px solid #1a1036}
.mc-linea .mc-yo{background:#c77dff;z-index:2}.mc-linea .mc-taxi{background:#ffb703}
.mc-linea .mc-meta{position:absolute;right:-14px;top:50%;transform:translateY(-50%);font-size:13px;line-height:1}
.mc-gap{font-size:13px;text-align:center;letter-spacing:1px;color:#ffd166}
.mc-gap.alerta{color:#ff6fb5;animation:mcLat .35s infinite alternate}
@keyframes mcLat{to{transform:scale(1.1)}}
.mc-turbo{display:flex;gap:5px;align-items:center;font-size:13px}
.mc-turbo i{width:15px;height:22px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden;position:relative;border:2px solid rgba(255,255,255,.4)}
.mc-turbo i b{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(#ffd166,#c77dff)}
.mc-turbo i.lleno{border-color:#ffd166;box-shadow:0 0 8px #ffb703}
.mc-espejo{position:fixed;border:3px solid #1a1036;border-radius:14px;box-shadow:0 0 0 2px rgba(199,125,255,.75),0 4px 0 #1a1036,0 0 18px rgba(155,93,229,.6);z-index:1;transition:opacity .25s}
.mc-espejo span{position:absolute;left:50%;bottom:-12px;transform:translateX(-50%);font:10px Bungee,sans-serif;background:#1a1036;color:#ffd166;padding:1px 7px;border-radius:7px;white-space:nowrap}
.mc-bur{position:fixed;z-index:4;max-width:230px;background:#fff8ec;color:#1a1036;border:3px solid #1a1036;border-radius:16px 16px 16px 4px;padding:4px 10px 6px;font:700 14px/1.15 'Baloo 2',sans-serif;box-shadow:0 4px 0 #1a1036;transition:opacity .2s;white-space:normal}
.mc-bur b{display:block;font:10px Bungee,sans-serif;color:#9b5de5;letter-spacing:.5px}
.mc-oculto{opacity:0 !important}
.mc-aviso{font-size:17px;color:#fff;background:linear-gradient(90deg,#ff4fd8,#9b5de5);padding:5px 14px;border-radius:12px;border:3px solid #1a1036;box-shadow:0 0 14px #ff4fd8;animation:mcLat .3s infinite alternate;letter-spacing:.5px}
.mc-avisobox{white-space:nowrap;position:fixed;left:50%;transform:translateX(-50%);z-index:3;font-family:Bungee,sans-serif;transition:opacity .15s}
@media (max-width:430px){.mc-aviso{font-size:13px;padding:4px 10px}}
.hud.tema-macao .hud-item{background:rgba(26,8,50,.96);border-color:rgba(199,125,255,.45)}
@media (max-width:430px){.mc-ruta{min-width:150px}.hud.tema-macao .hud-izq .hud-item{font-size:15px;padding:4px 9px}.mc-gap{font-size:11px}}
`;

export function makeMacaoUI(hud) {
  const root = document.getElementById('ui') || document.body;
  const style = document.createElement('style'); style.id = 'mc-css'; style.textContent = CSS; document.head.appendChild(style);
  const el = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; e.style.pointerEvents = 'none'; root.appendChild(e); return e; };

  const mirror = el('mc-espejo mc-oculto', '<span>RETROVISOR</span>');
  const bubble = el('mc-bur mc-oculto', '<b>TAXISTA ZHOU</b><span></span>');
  const bubbleTxt = bubble.querySelector('span');
  const warnEl = el('mc-avisobox mc-oculto', '<div class="mc-aviso">↱ ¡ATAJO! SIGUE RECTO</div>');

  const ruta = hud.set('ruta', '<div class="mc-linea"><div class="mc-hecho"></div><i class="mc-taxi"></i><i class="mc-yo"></i><span class="mc-meta">⚓</span></div><div class="mc-gap">¡A POR EL FERRY!</div>', 'centro');
  ruta.classList.add('mc-ruta');
  const yo = ruta.querySelector('.mc-yo'), tx = ruta.querySelector('.mc-taxi'), hecho = ruta.querySelector('.mc-hecho'), gapEl = ruta.querySelector('.mc-gap');
  hud.set('tiempo', '⏱ 0:00.0', 'izq'); hud.set('atajos', '↱ 0/4', 'izq');
  const turbo = hud.set('turbo', '<div class="mc-turbo">TURBO <i><b></b></i><i><b></b></i><i><b></b></i></div>', 'izq');
  const pips = [...turbo.querySelectorAll('i')];

  let mirrorRect = { x: 0, y: 0, w: 0, h: 0 };
  // centrado bajo la barra de progreso y sin pisar la columna izquierda del HUD (crono, atajos, turbo)
  function layout() {
    const W = innerWidth;
    const w = Math.round(Math.min(W * 0.52, 300)), h = Math.round(w * 0.34);
    const x0 = Math.round((W - w) / 2);
    let y = (ruta.getBoundingClientRect().bottom || 70) + 12;
    const izq = ruta.closest('.hud') && ruta.closest('.hud').querySelector('.hud-izq');
    if (izq) { const r = izq.getBoundingClientRect(); if (r.right > x0 - 6) y = Math.max(y, r.bottom + 12); }
    warnEl.style.top = Math.round(Math.max(innerHeight * 0.27, y + h + 22)) + 'px';
    y = Math.round(y); mirrorRect = { x: x0, y, w, h };
    Object.assign(mirror.style, { left: mirrorRect.x - 3 + 'px', top: y - 3 + 'px', width: w + 6 + 'px', height: h + 6 + 'px' });
  }
  layout();
  addEventListener('resize', layout);

  let bubbleT = 0, lastGap = '', lastCls = '';
  return {
    get mirrorRect() { return mirrorRect; },
    warn(on) { if (on) layout(); warnEl.classList.toggle('mc-oculto', !on); },
    showMirror(on) { if (on && mirror.classList.contains('mc-oculto')) layout(); mirror.classList.toggle('mc-oculto', !on); },
    route(pYo, pTaxi, gapText, alert) {
      yo.style.left = (pYo * 100).toFixed(1) + '%';
      tx.style.left = (pTaxi * 100).toFixed(1) + '%';
      hecho.style.width = (pYo * 100).toFixed(1) + '%';
      if (gapText !== lastGap) { gapEl.textContent = gapText; lastGap = gapText; }
      const cls = alert ? 'mc-gap alerta' : 'mc-gap';
      if (cls !== lastCls) { gapEl.className = cls; lastCls = cls; }
    },
    turbo(v) {
      pips.forEach((p, i) => { const f = Math.max(0, Math.min(1, v - i)); p.firstChild.style.height = (f * 100).toFixed(0) + '%'; p.classList.toggle('lleno', f >= 1); });
    },
    say(text, secs = 2.6) { bubbleTxt.textContent = text; bubbleT = secs; bubble.classList.remove('mc-oculto'); },
    get talking() { return bubbleT > 0; },
    // x,y en píxeles de pantalla (o null para esconder)
    hideBubble() { bubbleT = 0; bubble.classList.add('mc-oculto'); },
    // franja propia de la burbuja: a la izquierda, bajo la columna del HUD o bajo el retrovisor
    bubbleStrip(mirrorOn, dt) {
      const izq = ruta.closest('.hud') && ruta.closest('.hud').querySelector('.hud-izq');
      let y = izq ? izq.getBoundingClientRect().bottom + 10 : 140;
      if (mirrorOn) y = Math.max(y, mirrorRect.y + mirrorRect.h + 20);
      if (!warnEl.classList.contains('mc-oculto')) { bubbleT -= dt; bubble.classList.add('mc-oculto'); return; }
      this.bubbleAt(12, y, dt, true);
    },
    bubbleAt(x, y, dt, exact) {
      bubbleT -= dt;
      if (bubbleT <= 0 || x == null) { bubble.classList.add('mc-oculto'); return; }
      bubble.classList.remove('mc-oculto');
      const bw = bubble.offsetWidth || 180;
      const cx = exact ? x : Math.max(8, Math.min(innerWidth - bw - 8, x - bw * 0.2));
      bubble.style.left = cx + 'px'; bubble.style.top = Math.max(70, y) + 'px';
    },
    dispose() { removeEventListener('resize', layout); style.remove(); mirror.remove(); warnEl.remove(); bubble.remove(); },
  };
}

// Frases del Taxista Zhou (simpático, cabezota, nunca faltón)
export const ZHOU = {
  start: ['¡Ese cliente era MÍO! ¡Nos vemos en el muelle!'],
  chase: ['¡Pi-pííí! ¡Que os veo!', '¡Conduzco por aquí desde antes de que hubiera semáforos!', '¡Mi taxi tiene 600.000 km y está como nuevo!', '¡Ese señor me había hecho así con la mano!', '¡No es personal! ...Bueno, un poquito sí.', '¡Mi abuela adelanta más rápido! ¡Y va en bici!'],
  pass: ['¡Paso, paso! ¡Profesional al volante!', '¡Adiós, turistas!', '¡Os guardo una tarta de nata en el muelle!'],
  passed: ['¡Eh! ¡Eso no se hace!', '¿Ese carnet venía en una caja de cereales?', '¡Vale! ¡Ahora me enfado de broma!'],
  shortcut: ['¡¿Por ahí se puede?!', '¡Atajo! ¡Eso es trampa! ...Me lo apunto.', '¡Ni yo conocía ese callejón!'],
  bump: ['¡Mi retrovisor!', '¡Cuidado con la pintura, que es nueva!', '¡Uy! ¡Sin tocar, sin tocar!'],
  crash: ['¡Ja! ¡El autobús siempre gana!', '¡Despacito, que el muelle no se mueve!'],
  far: ['¡Esperad! ¡Esperaaad!', '¡Esto no queda así! ¡Bueno, sí, pero no!'],
  jump: ['¡¿Estáis volando?!', '¡Eso en mi pueblo es un avión!'],
  win: 'Vale, vale... ¡El ferry de mañana es mío!',
  lose: '¡Cliente miiiío! ¡Os invito a una tarta de nata!',
};
