// Arranque de La Ruta: portada → nombres → mapa del viaje → etapas.
import '@fontsource/bungee/latin-400.css';
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import './estilos.css';
import { engine } from './core/engine.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { save } from './core/save.js';
import { initUI, screen, button, h, esc, toast, starsHTML, $ } from './core/ui.js';
import { STAGES, playStage, isUnlocked, game, unlockSticker, openSettings, curtain } from './core/game.js';
import { createMap3D } from './screens/mapa3d.js';
import { openEditor } from './screens/personajes.js';
import { openAlbum } from './screens/album.js';
import { openCredits } from './screens/creditos.js';
import { todayKey, ddmm } from './core/util.js';

const VERSION = import.meta.env.VITE_VERSION || 'dev';
const params = new URLSearchParams(location.search);

initUI(document.getElementById('ui'));
input.attach(document.getElementById('ui'));
engine.init(document.getElementById('juego'));
audio.setVolumes(save.data.settings.music, save.data.settings.sfx);

const map = createMap3D();
let mapUI = null;

// Para pruebas automáticas (Playwright)
window.__ruta = { engine, input, audio, save, game, playStage, map, STAGES, version: VERSION };

function hideLoader() { const l = document.getElementById('carga'); if (l) { l.classList.add('fuera'); setTimeout(() => l.remove(), 600); } }

// ───────── portada ─────────
function showPortada() {
  engine.setController(map);
  map.setMode('portada');
  audio.music('mapa');
  const s = screen('portada', `
    <div class="portada-titulo"><span class="pt-la">LA</span><span class="pt-ruta">RUTA</span></div>
    <div class="portada-sub">Phuket · Koh Samui · Bangkok · Macao · Shanghái</div>
    <div class="portada-toca">Toca para empezar</div>
    <div class="portada-version">v ${esc(VERSION)}</div>`);
  const go = async () => {
    off();
    audio.unlock(); audio.music('mapa'); audio.sfx('go');
    await s.close();
    if (!save.data.namesSet) showNames(); else showMap();
  };
  s.addEventListener('pointerup', go);
  const offAny = input.onAny((k, id) => { if (k === 'pad' || id === 'Enter' || id === 'Space') go(); });
  const off = () => { s.removeEventListener('pointerup', go); offAny(); };
}

// ───────── nombres ─────────
function showNames() {
  const [n1, n2] = save.data.names;
  const s = screen('nombres', `
    <div class="panel panel-nombres">
      <h2>Antes de despegar</h2>
      <label>¿Cómo te llamas?<input id="nom1" maxlength="14" value="${esc(n1)}" autocomplete="off" enterkeyhint="next"></label>
      <label>¿Y tu compi de viaje?<input id="nom2" maxlength="14" value="${esc(n2)}" autocomplete="off" enterkeyhint="done"></label>
      <div class="nom-botones"></div>
    </div>`);
  const ok = async (edit) => {
    const a = $('#nom1', s).value.trim() || 'Rodri', b = $('#nom2', s).value.trim() || 'el Compi';
    save.data.names[0] = a; save.data.names[1] = b; save.data.namesSet = true; save.flush();
    unlockSticker('despegue');
    await s.close();
    if (edit) openEditor({ onClose: showMap }); else showMap();
  };
  $('.nom-botones', s).append(button('🎨 Elegir look', () => ok(true)), button('¡Vamos! ✈', () => ok(false), 'grande'));
  $('#nom2', s).addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(false); });
}

// ───────── mapa del viaje ─────────
function nextStage() {
  for (const st of STAGES) if (!((save.data.stages[st.id] || {}).stars > 0)) return st.id;
  return STAGES[STAGES.length - 1].id;
}

async function showMap(focusId) {
  input.clear();
  engine.setController(map);
  map.setMode('mapa');
  map.setProgress(STAGES.filter((s) => (save.data.stages[s.id] || {}).stars > 0).map((s) => s.id));
  audio.music('mapa');
  let sel = focusId || nextStage();
  map.placePlane(sel);
  map.focusStage(sel);
  if (mapUI) mapUI.remove();
  const total = save.totalStars();
  const ui = h('div', 'mapa-ui');
  ui.innerHTML = `
    <div class="mapa-top no-ctrl">
      <div class="mapa-logo">LA RUTA</div>
      <div class="mapa-estrellas">★ ${total}/${STAGES.length * 3}</div>
      <div class="mapa-acciones"></div>
    </div>
    <div class="mapa-etiquetas"></div>
    <div class="mapa-abajo no-ctrl">
      <div class="mapa-cartas"></div>
    </div>`;
  document.getElementById('ui').appendChild(ui);
  mapUI = ui;
  const acc = $('.mapa-acciones', ui);
  acc.append(
    button('🎨', () => { closeMap(); openEditor({ onClose: () => showMap(sel) }); }, 'icono'),
    button('🏅', () => { closeMap(); openAlbum({ onClose: () => showMap(sel) }); }, 'icono'),
    button('⚙', () => openSettings(), 'icono'),
    button('ℹ', () => { closeMap(); openCredits({ onClose: () => showMap(sel) }); }, 'icono'),
  );
  acc.children[0].title = 'Personajes'; acc.children[1].title = 'Pegatinas'; acc.children[2].title = 'Ajustes'; acc.children[3].title = 'Créditos';

  const cards = $('.mapa-cartas', ui);
  const labels = $('.mapa-etiquetas', ui);
  const labelEls = {};
  for (const st of STAGES) {
    const d = save.data.stages[st.id] || {};
    const open = isUnlocked(st.id);
    const c = h('div', 'carta' + (open ? '' : ' cerrada'));
    c.dataset.id = st.id;
    c.style.setProperty('--c', st.color);
    const daily = save.data.daily[todayKey() + ':' + st.id];
    c.innerHTML = `
      <div class="carta-num">${st.num}</div>
      <div class="carta-nombre">${esc(st.name)}</div>
      <div class="carta-sub">${esc(st.sub)}</div>
      <div class="carta-estrellas">${starsHTML(d.stars || 0)}</div>
      ${open ? '' : '<div class="carta-candado">🔒</div>'}
      <div class="carta-botones"></div>`;
    if (open) {
      const b = $('.carta-botones', c);
      b.append(button('JUGAR ▶', () => startStage(st.id), 'jugar'));
      if (d.stars > 0) b.append(button(`Reto ${ddmm()}${daily ? ' · ' + daily : ''}`, () => startStage(st.id, 'reto'), 'reto'));
    }
    c.addEventListener('click', () => select(st.id));
    cards.appendChild(c);
    const lb = h('div', 'etiqueta' + (open ? '' : ' cerrada'), `<span>${st.num}</span>${esc(st.name)}`);
    lb.addEventListener('click', () => select(st.id));
    labels.appendChild(lb);
    labelEls[st.id] = lb;
  }
  function select(id) {
    if (sel === id) return;
    sel = id;
    audio.sfx('whoosh');
    map.flyTo(id);
    for (const c of cards.children) c.classList.toggle('sel', c.dataset.id === id);
    const el = cards.querySelector(`[data-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  for (const c of cards.children) c.classList.toggle('sel', c.dataset.id === sel);
  requestAnimationFrame(() => { const el = cards.querySelector(`[data-id="${sel}"]`); if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' }); });
  // al deslizar las cartas, el mapa sigue a la carta del centro
  let scrollT;
  cards.addEventListener('scroll', () => {
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      const mid = cards.getBoundingClientRect().left + cards.clientWidth / 2;
      let best = null, bd = Infinity;
      for (const c of cards.children) { const r = c.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = c; } }
      if (best && best.dataset.id !== sel) select(best.dataset.id);
    }, 120);
  }, { passive: true });
  // mando / teclado en el mapa
  const offKeys = input.onAny((kind, id) => {
    if (!mapUI) return;
    const i = STAGES.findIndex((s) => s.id === sel);
    if (id === 'ArrowRight' || id === 'KeyD') select(STAGES[Math.min(STAGES.length - 1, i + 1)].id);
    if (id === 'ArrowLeft' || id === 'KeyA') select(STAGES[Math.max(0, i - 1)].id);
    if ((id === 'Enter' || id === 'Space') && isUnlocked(sel)) startStage(sel);
  });
  let padPrev = {};
  const padT = setInterval(() => {
    let gp; try { gp = [...navigator.getGamepads()].find(Boolean); } catch (e) { gp = null; }
    if (!gp || !mapUI) return;
    const now = { l: gp.axes[0] < -0.5 || gp.buttons[14]?.pressed, r: gp.axes[0] > 0.5 || gp.buttons[15]?.pressed, a: gp.buttons[0]?.pressed };
    const i = STAGES.findIndex((s) => s.id === sel);
    if (now.r && !padPrev.r) select(STAGES[Math.min(STAGES.length - 1, i + 1)].id);
    if (now.l && !padPrev.l) select(STAGES[Math.max(0, i - 1)].id);
    if (now.a && !padPrev.a && isUnlocked(sel)) startStage(sel);
    padPrev = now;
  }, 60);
  // etiquetas que siguen a las paradas en pantalla
  const follow = () => {
    for (const st of STAGES) {
      const p = map.screenPos(st.id), el = labelEls[st.id];
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      el.classList.toggle('sel', st.id === sel);
    }
  };
  engine.onFrame.add(follow);
  ui._cleanup = () => { engine.onFrame.delete(follow); offKeys(); clearInterval(padT); };
}

function closeMap() { if (mapUI) { mapUI._cleanup(); mapUI.remove(); mapUI = null; } }

async function startStage(id, mode = 'normal') {
  if (map.focusStage) map.focusStage(id);
  map.zoomIn();
  if (mapUI) mapUI.classList.add('saliendo');
  audio.sfx('whoosh');
  await new Promise((r) => setTimeout(r, 550));
  closeMap();
  await playStage(id, { mode });
}

game.onExit = async () => { showMap(game.lastStage); };
game.onFirstClear = (id) => { game.lastStage = STAGES[Math.min(STAGES.length - 1, STAGES.findIndex((s) => s.id === id) + 1)].id; };

// ───────── arranque ─────────
hideLoader();
if (params.get('etapa')) {
  // atajo para pruebas: ?etapa=phuket
  save.data.namesSet = true;
  playStage(params.get('etapa'), { mode: params.get('modo') || 'normal' });
} else if (params.has('mapa')) {
  showMap();
} else {
  showPortada();
}

// PWA: service worker que lo guarda todo para jugar sin internet
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
