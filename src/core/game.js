// Director de partida: lista de etapas, arrancar una etapa, pausa, resultados,
// pegatinas y fantasmas. Las etapas solo hablan con el "ctx" que se les pasa.
import * as THREE from 'three';
import { engine } from './engine.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { hud, dialog, countdown, shout, toast, confetti, screen, button, h, esc, countUp, starsHTML, uiRoot } from './ui.js';
import { makeRng, dailySeed, hashString, ddmm, todayKey, fmtTime, wait, vibrate } from './util.js';
import { makeCharacter } from './chars.js';
import { PEGATINAS } from './pegatinas.js';
import { stickerSVG } from './pegatinas-svg.js';

export const STAGES = [
  { id: 'phuket', num: 1, name: 'Phuket', sub: 'Scooter al atardecer', vehicle: 'Scooter', color: '#ff7f50', load: () => import('../stages/phuket/index.js') },
  { id: 'samui', num: 2, name: 'Koh Samui', sub: 'Barca de cola larga', vehicle: 'Barca', color: '#1fc8c8', load: () => import('../stages/samui/index.js') },
  { id: 'bangkok', num: 3, name: 'Bangkok', sub: 'Tuk-tuk de noche', vehicle: 'Tuk-tuk', color: '#ff3fa4', load: () => import('../stages/bangkok/index.js') },
  { id: 'muaythai', num: 4, name: 'Muay Thai', sub: 'El combate', vehicle: 'Guantes', color: '#e63946', load: () => import('../stages/muaythai/index.js') },
  { id: 'macao', num: 5, name: 'Macao', sub: 'Persecución de neón', vehicle: 'Coche', color: '#9b5de5', load: () => import('../stages/macao/index.js') },
  { id: 'shanghai', num: 6, name: 'Shanghái', sub: 'Final en el tren bala', vehicle: 'Maglev', color: '#4cc9f0', load: () => import('../stages/shanghai/index.js') },
];

export function isUnlocked(id) {
  if (new URLSearchParams(location.search).has('todo')) return true;
  const i = STAGES.findIndex((s) => s.id === id);
  if (i <= 0) return true;
  const prev = save.data.stages[STAGES[i - 1].id];
  return !!(prev && prev.stars > 0);
}

// ───────── pegatinas ─────────
export function unlockSticker(id) {
  if (save.data.stickers[id]) return false;
  const p = PEGATINAS.find((x) => x.id === id);
  if (!p) return false;
  save.data.stickers[id] = todayKey();
  save.touch();
  audio.sfx('sticker');
  toast(`<div class="peg-mini">${stickerSVG(p, 56)}</div><div><b>¡Pegatina!</b><br>${esc(p.name)}</div>`, 2600, 'aviso-peg');
  return true;
}

// ───────── fantasmas ─────────
// Graba la pose de un objeto cada 0,1 s. Se guarda solo si la vuelta es la mejor.
class GhostRecorder {
  constructor() { this.frames = []; this.t = 0; this.obj = null; this.acc = 0; }
  track(obj) { this.obj = obj; this.frames = []; this.t = 0; this.acc = 0.1; }
  update(dt) {
    if (!this.obj) return;
    this.t += dt; this.acc += dt;
    if (this.acc >= 0.1 && this.frames.length < 6000) {
      this.acc = 0;
      const o = this.obj;
      this.frames.push([+this.t.toFixed(2), +o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2), +o.rotation.y.toFixed(3), +o.rotation.z.toFixed(3)]);
    }
  }
}
class GhostPlayer {
  constructor(frames, mesh) { this.f = frames; this.mesh = mesh; this.i = 0; }
  update(t) {
    const f = this.f; if (!f || f.length < 2) return;
    while (this.i < f.length - 2 && f[this.i + 1][0] < t) this.i++;
    const a = f[this.i], b = f[this.i + 1];
    const k = Math.max(0, Math.min(1, (t - a[0]) / Math.max(0.001, b[0] - a[0])));
    this.mesh.position.set(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
    let dr = b[4] - a[4]; if (dr > Math.PI) dr -= Math.PI * 2; if (dr < -Math.PI) dr += Math.PI * 2;
    this.mesh.rotation.y = a[4] + dr * k; this.mesh.rotation.z = a[5] + (b[5] - a[5]) * k;
    this.mesh.visible = t <= f[f.length - 1][0] + 0.5;
  }
}
// Material translúcido para el fantasma
export function ghostify(obj, color = '#9ad7ff') {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false });
  obj.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; } });
  return obj;
}

// ───────── partida ─────────
let current = null; // { def, mod, inst, ctx }
export const game = { onExit: null, onFinish: null, get current() { return current; } };

export async function playStage(id, { mode = 'normal', ghostOf = null } = {}) {
  const def = STAGES.find((s) => s.id === id);
  if (!def) return;
  audio.unlock();
  await curtain(true, def);
  if (current) teardown();
  const mod = (await def.load()).default;
  const seed = mode === 'reto' ? dailySeed(id) : hashString('la-ruta:' + id);
  const rng = makeRng(seed);
  const st = save.stage(id);
  const ghostRec = new GhostRecorder();
  let ghostPlayers = [];
  let raceT = 0, racing = false, finished = false;

  // fantasma disponible: el mío, o el de mi compi (modo pasar el móvil), o el del reto de hoy
  let ghostData = null, ghostLabel = '';
  if (mod.ghost) {
    if (mode === 'compi' && st.ghostCompi) { ghostData = st.ghostCompi.frames; ghostLabel = st.ghostCompi.name; }
    else if (mode === 'reto') { const d = save.data.daily[todayKey() + ':' + id + ':ghost']; if (d) { ghostData = d; ghostLabel = 'Tu mejor de hoy'; } }
    else if (st.ghost && mode !== 'sin-fantasma') { ghostData = st.ghost; ghostLabel = 'Tu mejor vuelta'; }
  }

  const ctx = {
    THREE, engine, input, audio, save, hud, rng, seed, mode, def,
    names: save.data.names, looks: save.data.looks,
    makeCharacter,
    dialog: (lines) => dialog(lines),
    shout, toast, confetti, countdown, wait, vibrate,
    sticker: unlockSticker,
    stat: (k, n = 1) => save.addStat(k, n),
    best: st,
    // intro estándar: tarjeta con el nombre de la etapa + diálogo (solo completo la 1ª vez) + cuenta atrás
    async intro(lines = mod.intro || [], { count = true, go } = {}) {
      const seen = save.data.seenDialogs[id];
      if (lines.length && (!seen || mode === 'normal')) {
        await dialog(seen ? lines.slice(0, 2) : lines);
        save.data.seenDialogs[id] = true; save.touch();
      }
      if (count) await countdown(go);
    },
    // Para etapas de carrera: empieza el reloj del fantasma
    raceStart(trackObj) {
      racing = true; raceT = 0;
      if (trackObj) ghostRec.track(trackObj);
    },
    get raceTime() { return raceT; },
    ghost: {
      get data() { return ghostData; },
      get label() { return ghostLabel; },
      // mesh: un objeto 3D ya añadido a la escena (se vuelve translúcido)
      spawn(mesh, color) { if (!ghostData) return null; ghostify(mesh, color); const gp = new GhostPlayer(ghostData, mesh); ghostPlayers.push(gp); return gp; },
    },
    // result = { win, stars(0-3), score, time, stats:[['Cocos', 12]], lines:['texto'], moreStats:{cocos:12} }
    finish(result) {
      if (finished) return; finished = true; racing = false;
      onFinish(def, mod, result, ghostRec, mode, ghostData);
    },
    exit: () => exitToMap(),
  };

  hud.mount('tema-' + id);
  input.configure(mod.controls || { joystick: false, buttons: [] });
  input.showTouch();
  pauseButton(true);
  input.onPause = () => togglePause();
  let inst;
  try {
    inst = await mod.create(ctx);
  } catch (e) {
    console.error(e);
    toast('Esta etapa aún está en obras 🚧', 3000);
    await curtain(false); teardown(); exitToMap(); return;
  }
  const controller = {
    scene: inst.scene, camera: inst.camera,
    update(dt, realDt) {
      if (racing) { raceT += dt; ghostRec.update(dt); for (const g of ghostPlayers) g.update(raceT); }
      inst.update(dt, realDt);
    },
    render: inst.render ? (r, d) => inst.render(r, d) : null,
    resize: inst.resize ? (w, hh) => inst.resize(w, hh) : null,
  };
  engine.setController(controller);
  current = { def, mod, inst, ctx, mode };
  game.lastStage = id;
  save.data.stats.partidas++; st.plays = (st.plays || 0) + 1; save.touch();
  if (mod.music) audio.music(mod.music); else audio.music(id);
  if (mode === 'reto') unlockSticker('reto');
  if (mode === 'compi') unlockSticker('compi');
  await curtain(false, def);
  if (inst.start) inst.start();
}

function teardown() {
  if (!current) return;
  try { current.inst.dispose && current.inst.dispose(); } catch (e) { console.warn(e); }
  audio.stopLoops();
  engine.setController(null);
  engine.paused = false;
  hud.clear();
  input.clear();
  input.onPause = null;
  pauseButton(false);
  document.querySelectorAll('.dialogo, .grito, .panel-pausa, .resultados').forEach((e) => e.remove());
  current = null;
}

export async function exitToMap() {
  await curtain(true);
  teardown();
  if (game.onExit) await game.onExit();
  await curtain(false);
}

// ───────── telón de transición ─────────
let curtainEl;
export function curtain(on, def) {
  if (!curtainEl) { curtainEl = h('div', 'telon'); uiRoot().appendChild(curtainEl); }
  if (on) {
    curtainEl.innerHTML = def ? `<div class="telon-num">ETAPA ${def.num}</div><div class="telon-nombre">${esc(def.name)}</div><div class="telon-sub">${esc(def.sub)}</div>` : '<div class="telon-tuk">🛺</div>';
    if (def) curtainEl.style.setProperty('--c', def.color); else curtainEl.style.removeProperty('--c');
  }
  curtainEl.classList.toggle('on', on);
  return wait(on ? 450 : 350);
}

// ───────── pausa ─────────
let pauseBtn;
function pauseButton(show) {
  if (!pauseBtn) {
    pauseBtn = h('button', 'btn-pausa no-ctrl', 'II');
    pauseBtn.setAttribute('aria-label', 'Pausa');
    pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
    uiRoot().appendChild(pauseBtn);
  }
  pauseBtn.style.display = show ? '' : 'none';
}

export function togglePause(force) {
  if (!current) return;
  const on = force ?? !engine.paused;
  if (on === engine.paused) return;
  engine.paused = on;
  document.querySelectorAll('.panel-pausa').forEach((e) => e.remove());
  if (!on) { input.showTouch(); return; }
  input.hideTouch();
  const p = h('div', 'panel panel-pausa no-ctrl');
  p.innerHTML = `<h2>Pausa</h2><div class="pausa-etapa">${esc(current.def.name)} · ${esc(current.def.sub)}</div>`;
  const list = h('div', 'pausa-botones');
  list.append(
    button('▶ Seguir', () => togglePause(false), 'grande'),
    button('↻ Reiniciar', () => { const { def, mode } = current; togglePause(false); playStage(def.id, { mode }); }),
    button('📷 Modo foto', () => openPhoto()),
    button('⚙ Ajustes', () => openSettings()),
    button('🗺 Salir al mapa', () => { togglePause(false); exitToMap(); }),
  );
  p.appendChild(list);
  uiRoot().appendChild(p);
}

async function openPhoto() {
  const m = await import('./foto.js');
  m.openPhotoMode(current);
}

export function openSettings() {
  const s = save.data.settings;
  const p = h('div', 'panel panel-ajustes no-ctrl');
  const q = (v, l) => `<button class="opcion ${s.quality === v ? 'on' : ''}" data-q="${v}">${l}</button>`;
  p.innerHTML = `<h2>Ajustes</h2>
    <label>Música <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"></label>
    <label>Efectos <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx"></label>
    <div class="aj-fila"><span>Calidad</span><div class="opciones">${q('auto', 'Auto')}${q('baja', 'Baja')}${q('media', 'Media')}${q('alta', 'Alta')}</div></div>
    <label class="aj-check"><input type="checkbox" data-k="battery" ${s.battery ? 'checked' : ''}> ✈ Modo avión / ahorro de batería <small>(30 fps, sin sombras)</small></label>
    <label class="aj-check"><input type="checkbox" data-k="vibration" ${s.vibration ? 'checked' : ''}> Vibración</label>
    <label class="aj-check"><input type="checkbox" data-k="rain" ${s.rain ? 'checked' : ''}> Lluvia de monzón en Bangkok</label>
    <div class="aj-fps">Calidad actual: <b>${engine.qualityName}</b> · ${Math.round(engine.fps)} fps</div>`;
  p.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => {
    s[r.dataset.k] = +r.value; audio.setVolumes(s.music, s.sfx); save.touch();
  }));
  p.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => {
    s[c.dataset.k] = c.checked; save.touch();
    if (c.dataset.k === 'battery') engine.applyQuality();
  }));
  p.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    engine.setQuality(b.dataset.q);
    p.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  p.appendChild(button('Listo', () => p.remove(), 'grande'));
  uiRoot().appendChild(p);
}

// ───────── resultados ─────────
async function onFinish(def, mod, r, ghostRec, mode, ghostData) {
  const id = def.id;
  const st = save.stage(id);
  const stars = Math.max(0, Math.min(3, r.stars | 0));
  const newBest = (r.score || 0) > (st.best || 0);
  const newTime = r.win && r.time && r.time < (st.bestTime || Infinity);
  const firstClear = r.win && !(st.stars > 0);
  if (mode !== 'compi') {
    st.stars = Math.max(st.stars || 0, stars);
    if (newBest) st.best = r.score;
    if (newTime) st.bestTime = r.time;
  }
  // fantasma: guardamos la mejor vuelta ganada
  let ghostMsg = '';
  if (mod.ghost && r.win && ghostRec.frames.length > 5) {
    const myTime = r.time ?? ghostRec.t;
    if (mode === 'reto') {
      const k = todayKey() + ':' + id + ':ghost';
      const prevT = save.data.daily[k + 'T'] ?? Infinity;
      if (myTime < prevT) { save.data.daily[k] = ghostRec.frames; save.data.daily[k + 'T'] = myTime; }
    } else if (mode === 'compi') {
      ghostMsg = st.ghostCompi && myTime < st.ghostCompi.time ? `¡Has ganado al fantasma de ${esc(st.ghostCompi.name)}!` : '';
    } else {
      if (ghostData && myTime < (st.ghostTime ?? Infinity)) { unlockSticker('fantasma'); ghostMsg = '¡Has ganado a tu fantasma!'; }
      if (myTime < (st.ghostTime ?? Infinity)) { st.ghost = ghostRec.frames; st.ghostTime = myTime; }
    }
    r._frames = ghostRec.frames; r._time = myTime;
  }
  if (r.moreStats) for (const [k, v] of Object.entries(r.moreStats)) save.addStat(k, v);
  if (mode === 'reto') {
    const k = todayKey() + ':' + id;
    if ((r.score || 0) > (save.data.daily[k] || 0)) save.data.daily[k] = r.score || 0;
  }
  // logros globales
  if (STAGES.every((s) => (save.data.stages[s.id] || {}).stars > 0)) unlockSticker('ruta-completa');
  if (STAGES.every((s) => (save.data.stages[s.id] || {}).stars >= 3)) unlockSticker('tres-estrellas');
  save.flush();

  await wait(r.delay ?? 600);
  input.hideTouch();
  pauseButton(false);
  audio.sfx(r.win ? 'win' : 'lose');
  if (r.win) confetti();
  const idx = STAGES.findIndex((s) => s.id === id);
  const next = STAGES[idx + 1];
  const el = h('div', 'panel resultados no-ctrl' + (r.win ? ' gana' : ' pierde'));
  el.style.setProperty('--c', def.color);
  const title = r.title || (r.win ? '¡Etapa superada!' : 'Casi…');
  el.innerHTML = `
    <div class="res-etapa">ETAPA ${def.num} · ${esc(def.name.toUpperCase())}${mode === 'reto' ? ' · RETO ' + ddmm() : ''}</div>
    <h2>${esc(title)}</h2>
    <div class="res-estrellas">${starsHTML(0)}</div>
    <div class="res-puntos"><span class="res-num">0</span><small>puntos</small></div>
    ${newBest && r.win ? '<div class="res-record">¡NUEVO RÉCORD!</div>' : ''}
    ${ghostMsg ? `<div class="res-record">${ghostMsg}</div>` : ''}
    <div class="res-stats">${(r.stats || []).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    ${(r.lines || []).map((l) => `<p class="res-linea">${esc(l)}</p>`).join('')}
    <div class="res-botones"></div>`;
  uiRoot().appendChild(el);
  const bx = el.querySelector('.res-botones');
  bx.append(button('↻ Repetir', () => playStage(id, { mode })));
  if (next && r.win && mode === 'normal' && isUnlocked(next.id)) bx.append(button(`Siguiente: ${next.name} ▶`, () => playStage(next.id), 'grande'));
  bx.append(button('🗺 Mapa', () => exitToMap()));
  if (mod.ghost && r.win && r._frames && mode !== 'compi') {
    bx.append(button('📱 Pasa el móvil', () => {
      const name = save.data.names[1];
      st.ghostCompi = { frames: r._frames, time: r._time, name: save.data.names[0] };
      save.flush();
      toast(`Ahora juega ${esc(name)} contra el fantasma de ${esc(save.data.names[0])}`, 2500);
      playStage(id, { mode: 'compi' });
    }));
  }
  if (mode === 'reto' || r.win) {
    bx.append(button('💬 Compartir', () => share(def, r, mode)));
  }
  const finale = () => import('../screens/final.js').then((m) => { teardown(); m.openFinale(STAGES, { onClose: () => game.onExit && game.onExit() }); });
  if (id === 'shanghai' && r.win) bx.append(button('🎬 Créditos finales', finale, 'grande'));
  // animación: estrellas una a una y puntos que suben
  const starEls = el.querySelectorAll('.estrella');
  countUp(el.querySelector('.res-num'), r.score || 0, 1000);
  for (let i = 0; i < stars; i++) {
    await wait(380);
    starEls[i].classList.add('si', 'pum');
    audio.sfx('star', { pitch: 1 + i * 0.25 });
    vibrate(20);
  }
  if (firstClear && game.onFirstClear) game.onFirstClear(id);
  // la primera vez que se acaba el viaje, los créditos salen solos
  if (firstClear && id === 'shanghai') { await wait(3500); if (document.body.contains(el)) finale(); }
}

export function share(def, r, mode) {
  const url = 'https://agarroda-bit.github.io/la-ruta/';
  const what = r.shareText || `${r.score} puntos en ${def.name}`;
  const text = mode === 'reto'
    ? `He hecho ${what} en La Ruta (reto del ${ddmm()}). ¿Me superas? ${url}`
    : `He hecho ${what} en La Ruta. ¿Me superas? ${url}`;
  const wa = 'https://wa.me/?text=' + encodeURIComponent(text);
  // sin internet no se puede enviar: copiamos el texto para pegarlo luego
  if (!navigator.onLine) {
    try { navigator.clipboard.writeText(text); } catch (e) { /* nada */ }
    toast('Sin conexión: texto copiado para enviarlo luego 📋', 2800);
    return;
  }
  window.open(wa, '_blank');
}
