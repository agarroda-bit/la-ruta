// ETAPA 6 · SHANGHÁI — Final en el tren bala.
// Maglev a 430 km/h por un viaducto de noche: campo → ciudad → río → el Bund.
// Cambia de vía, esquiva, coge energía, turbo con escudo y llegada con fuegos artificiales.
import * as THREE from 'three';
import { Particles } from '../../core/engine.js';
import { damp, clamp, fmtTime, disposeTree, smoothstep } from '../../core/util.js';
import { makeWorld, DECK, LANES, Z, PROM, VIEW } from './escenario.js';
import { makeTrain, CAR1, GAP } from './tren.js';
import { generar, buildHazards, animateHazards, makeOrbs, ULTIMO } from './peligros.js';
import { Fireworks } from './fuegos.js';
import { injectStyle, makeHud } from './estilo.js';
import { makeHum } from './sonido.js';

const KMH = 6;                 // 1 m/s del juego = 6 km/h en el velocímetro
const BRAKE_AT = Z.L - 220;    // aquí empieza a frenar solo en la estación
const ORB_E = 1 / 26;          // energía por orbe
const TRAMOS = [[0, 'CAMPO'], [Z.CITY, 'CIUDAD'], [Z.RIVER, 'RÍO'], [Z.BUND - 100, 'EL BUND']];
const NOMBRE = { tren: '¡TREN DE FRENTE!', obras: 'OBRAS', puerta: 'PUERTA', dron: 'DRON' };

export default {
  id: 'shanghai',
  music: 'shanghai',
  ghost: false,
  controls: {
    joystick: false, // el deslizamiento lo detecta la etapa (sin aro en pantalla)
    buttons: [
      { id: 'boost', label: 'TURBO', keys: ['ShiftLeft', 'ShiftRight', 'Space', 'KeyW', 'ArrowUp'], pad: [0, 5, 7], color: '#ff4fa3', pos: { right: 30, bottom: 136 } },
      { id: 'izq', label: '◀', keys: [], pad: [], color: '#4361ee', size: 'big', pos: { left: 16, bottom: 30 } },
      { id: 'der', label: '▶', keys: [], pad: [], color: '#4361ee', size: 'big', pos: { right: 16, bottom: 30 } },
    ],
  },
  intro: [
    { who: 0, text: '¡430 km/h! Este tren va más rápido que el wifi del hostal.' },
    { who: 1, text: 'Los fuegos del Bund empiezan en dos minutos. Ni uno más, {0}.' },
    { who: 'Maquinista Wei', text: 'Si viene un mercancías de frente, cambiad de vía. Yo lo hago siempre.' },
    { who: 'Maquinista Wei', text: 'Coged energía azul y pulsad TURBO: el escudo aguanta un golpe.' },
    { who: 0, text: '¿Y si chocamos?' },
    { who: 'Maquinista Wei', text: 'Frenazo en seco. Tres frenazos y los fuegos los veis por la tele.' },
  ],

  async create(ctx) {
    injectStyle();
    const { rng, engine, input, audio } = ctx;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 2600);
    const portrait = () => innerWidth / innerHeight < 0.8;
    const world = makeWorld(scene, ctx);
    const train = makeTrain(ctx);
    scene.add(train.group);
    const { hazards, orbs } = generar(rng);
    buildHazards(scene, hazards);
    const orbMesh = makeOrbs(scene, orbs);
    const sparks = new Particles(scene, 900, { additive: true, size: 0.5 });
    const hud = makeHud(ctx);
    const ORB_TOTAL = orbs.reduce((a, o) => a + o.v, 0);
    const st = {
      fase: 'intro', s: 0, L: Z.L, v: 0, kmh: 0, lane: 1, x: 0, energy: 0, turbo: false, orbs: 0, crashes: 0, lost: 0,
      t: 0, invul: 0, maxKmh: 0, tramo: 'CAMPO', tramoI: 0, combo: 0, comboT: -9, laneT: -9, score: 0, ft: 0,
      win: false, done: false, stars: 0, nearMiss: 0, shieldHits: 0, danos: 0, shieldHP: 0,
    };
    const fw = new Fireworks(scene, {
      quality: engine.q.particles,
      onBurst: (p, sc, c) => {
        const d = camera.position.distanceTo(p);
        world.flash(c, clamp(180 / Math.max(60, d), 0.05, 1) * (sc || 1));
        if (d > 1600) return;
        const delay = Math.min(900, d * 1.3);
        setTimeout(() => audio.sfx('firework', { pitch: 0.55 + Math.random() * 0.6, vol: clamp(240 / d, 0.12, 1) }), delay);
      },
    });

    // líneas de velocidad (estelas de aire que pasan zumbando)
    const NL = Math.round(120 * Math.max(0.5, engine.q.particles));
    const lpos = new Float32Array(NL * 6), lcol = new Float32Array(NL * 6);
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    lgeo.setAttribute('color', new THREE.BufferAttribute(lcol, 3));
    const lmat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const speedLines = new THREE.LineSegments(lgeo, lmat);
    speedLines.frustumCulled = false; scene.add(speedLines);
    const ld = [];
    const spawnLine = (l, s0) => {
      l.x = (Math.random() - 0.5) * 34; l.y = DECK - 3 + Math.random() * 16;
      if (Math.abs(l.x) < 6 && l.y < DECK + 5) l.y += 7;
      l.s = s0 + Math.random() * 260;
      l.c = Math.random() < 0.3 ? [1, 0.5, 0.8] : [0.6, 0.9, 1];
    };
    for (let i = 0; i < NL; i++) { const l = {}; spawnLine(l, 20); ld.push(l); }

    // atajo de pruebas: ?etapa=shanghai&desde=6000 empieza más adelante
    const desde = clamp(Number(new URLSearchParams(location.search).get('desde')) || 0, 0, BRAKE_AT - 50);
    if (desde) { st.s = desde; for (const h of hazards) if (h.s < desde + 60) h.done = true; for (const o of orbs) if (o.s < desde) o.got = true; }
    // estado para pruebas
    const etapa = { id: 'shanghai' };
    window.__ruta = window.__ruta || {};
    window.__ruta.etapa = etapa;
    window.__ruta.shPlan = () => ({ hazards: hazards.map((h) => ({ t: h.type, s: h.s, l: h.lanes, len: h.len })), orbs: orbs.map((o) => ({ s: o.s, l: o.lane, v: o.v })) });

    // cámara de la intro: delante del morro, mirando a la cabina
    camera.position.set(6, DECK + 3, -10);
    camera.lookAt(0, DECK + 1.8, 4);
    let tipsShown = 0, car2x = 0, prevX = 0, axisArmed = true, hum = null, trainSnd = null, warnedFull = false, firstWarn = false;
    let maglevDone = false, introA = 0, lastNoE = -9, oi = orbs.findIndex((o) => !o.got) < 0 ? orbs.length : orbs.findIndex((o) => !o.got), warnedId = null, lastNear = -9, failed = false;
    const camV = new THREE.Vector3(), lookV = new THREE.Vector3(), lookCur = new THREE.Vector3(0, DECK + 1.8, 4), tmpV = new THREE.Vector3();
    let errLogged = false;

    const turboBtn = () => (input.btnEls || []).find((b) => b.id === 'boost');
    const overlap = (lanes, w = 2.55) => lanes.some((l) => Math.abs(LANES[l] - st.x) < w);
    const nose = () => tmpV.set(st.x, DECK + 1.2, -st.s - 0.5);

    function changeLane(dir) {
      const nl = clamp(st.lane + dir, 0, 2);
      if (nl === st.lane) { engine.shake(0.08); audio.sfx('hit', { vol: 0.15, pitch: 1.8 }); return; }
      st.lane = nl; st.laneT = st.t;
      audio.sfx('whoosh', { pitch: 1.25 + dir * 0.08, vol: 0.55 });
      sparks.emit(8, tmpV.set(st.x - dir * 1.4, DECK + 0.4, -st.s - 4), { colors: ['#4cc9f0', '#ffffff'], vel: { x: -dir * 3, y: 1, z: -st.v * 0.8 }, velSpread: 3, life: 0.4, gravity: 0, size: 0.35 });
    }

    function tryTurbo() {
      if (st.turbo || st.fase !== 'carrera') return;
      if (st.energy < 0.999) {
        if (st.t - lastNoE > 1.5) { lastNoE = st.t; ctx.shout('¡Falta energía!', { size: 'peque', color: '#4cc9f0', ms: 800 }); audio.sfx('click', { pitch: 0.5 }); }
        return;
      }
      st.turbo = true; st.shieldHP = 1; train.shield.visible = true; hideEnergyTip();
      audio.sfx('boost'); audio.sfx('whoosh', { pitch: 0.6 });
      ctx.shout('¡TURBO!', { color: '#ff4fa3' });
      engine.shake(0.35); hud.flash('rgba(255,79,163,.35)'); ctx.vibrate(40);
    }

    function smash(h) {
      const p = nose();
      if (h.type === 'dron') h.falling = true;
      else if (h.type === 'obras') { h.smashed = true; sparks.emit(40, p, { colors: ['#ff7b00', '#ffffff', '#ffae00'], vel: { x: 0, y: 6, z: -st.v * 0.7 }, velSpread: 12, life: 1, gravity: -16, size: 0.6 }); }
      else if (h.type === 'puerta') { for (const sh of h.parts.shutters) if (Math.abs(sh.position.x - st.x) < 2.7) sh.visible = false; }
    }

    function hit(h) {
      if (h.hit) return;
      if (st.turbo && st.shieldHP > 0) {
        h.hit = true; st.shieldHits++; st.shieldHP = 0; train.shield.visible = false; st.invul = 0.6;
        smash(h);
        sparks.emit(50, nose(), { colors: ['#4cc9f0', '#ffffff', '#b388ff'], vel: { x: 0, y: 3, z: -st.v * 0.6 }, velSpread: 14, life: 0.7, gravity: -6 });
        ctx.shout('¡ESCUDO ROTO!', { size: 'peque', color: '#4cc9f0' });
        audio.sfx('hit', { pitch: 1.5 }); engine.shake(0.45); ctx.vibrate(30);
        return;
      }
      if (st.invul > 0) return;
      h.hit = true;
      st.ultimo = { tipo: h.type, carriles: h.lanes, carril: st.lane, x: Math.round(st.x * 10) / 10, s: Math.round(st.s), hs: Math.round(h.s) };
      st.crashes++; st.danos++; st.lost += 0.34; st.energy = Math.max(0, st.energy - 0.34); st.v *= 0.28; st.invul = 1.8; st.combo = 0;
      if (st.turbo) { st.turbo = false; train.shield.visible = false; }
      smash(h);
      sparks.emit(70, nose(), { colors: ['#ffd166', '#ff7b00', '#ffffff'], vel: { x: 0, y: 4, z: -st.v * 0.6 }, velSpread: 11, life: 0.9, gravity: -14, size: 0.55 });
      engine.shake(1.1); engine.slowmo(0.5, 0.3); ctx.vibrate(140);
      audio.sfx('crash'); audio.sfx('hit');
      hud.flash('rgba(255,30,60,.55)');
      if (st.danos >= 3) { lose(); return; }
      ctx.shout(st.danos === 1 ? '¡FRENAZO!' : '¡ÚLTIMO AVISO!', { color: '#ff2d55' });
    }

    let tipEl = null, tipT = 0;
    function showEnergyTip() {
      hideEnergyTip();
      tipEl = document.createElement('div'); tipEl.className = 'sh-tip';
      tipEl.innerHTML = '⚡ ¡Turbo listo! Pulsa <b>TURBO</b>';
      ctx.hud.el.appendChild(tipEl); tipT = 2.4;
    }
    function hideEnergyTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }

    // deslizar en la mitad izquierda = cambiar de vía (sin dibujar joystick)
    const swipe = { id: null, x: 0, y: 0 };
    const onBtn = (x, y) => [...document.querySelectorAll('.controles .btn-tactil')].some((b) => { const r = b.getBoundingClientRect(); return r.width && x > r.left - 14 && x < r.right + 14 && y > r.top - 14 && y < r.bottom + 14; });
    const pDown = (e) => {
      if (e.pointerType === 'mouse' || swipe.id !== null || st.fase !== 'carrera' || engine.paused) return;
      if (e.target.closest && e.target.closest('.no-ctrl, button, .panel, .dialogo')) return;
      if (e.clientX > innerWidth * 0.62 || onBtn(e.clientX, e.clientY)) return;
      swipe.id = e.pointerId; swipe.x = e.clientX; swipe.y = e.clientY;
    };
    const pMove = (e) => {
      if (e.pointerId !== swipe.id) return;
      const dx = e.clientX - swipe.x;
      if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(e.clientY - swipe.y) * 0.8) { changeLane(Math.sign(dx)); swipe.x = e.clientX; swipe.y = e.clientY; }
    };
    const pUp = (e) => { if (e.pointerId === swipe.id) swipe.id = null; };
    addEventListener('pointerdown', pDown, true); addEventListener('pointermove', pMove, true);
    addEventListener('pointerup', pUp, true); addEventListener('pointercancel', pUp, true);

    function nearMiss(h) {
      if (st.t - st.laneT > 0.5 || st.t - lastNear < 2) return;
      if (!h.lanes.some((l) => Math.abs(LANES[l] - st.x) < 4.3)) return;
      lastNear = st.t; st.nearMiss++;
      ctx.shout('¡POR LOS PELOS!', { size: 'peque', color: '#ffd166', ms: 800 });
      engine.slowmo(0.28, 0.45); audio.sfx('whoosh', { pitch: 0.7, vol: 0.8 });
    }

    function collect(o) {
      o.got = true; st.orbs += o.v;
      if (o.gold) ctx.hud.pop('orbes');
      if (!st.turbo) st.energy = Math.min(1, st.energy + ORB_E);
      st.combo = st.t - st.comboT < 0.7 ? st.combo + 1 : 1; st.comboT = st.t;
      audio.sfx('coin', { pitch: (o.gold ? 1.3 : 1) + Math.min(14, st.combo) * 0.05, vol: o.gold ? 0.8 : 0.55 });
      sparks.emit(10, tmpV.set(LANES[o.lane], DECK + 1.7, -o.s), { colors: o.gold ? ['#ffd166', '#ffffff', '#ffb000'] : ['#5ef0ff', '#ffffff', '#2fa8ff'], vel: { x: (st.x - LANES[o.lane]) * 7, y: 2, z: -st.v * 0.92 }, velSpread: 4, life: 0.5, gravity: 0, size: 0.4 });
      ctx.hud.pop('orbes');
      if (st.combo >= 10 && st.combo % 10 === 0) ctx.shout(`¡CADENA x${st.combo}!`, { size: 'peque', color: '#5ef0ff', ms: 800 });
      if (st.energy >= 0.999 && !warnedFull && !st.turbo) { warnedFull = true; if (tipsShown++ < 2) showEnergyTip(); audio.sfx('star'); }
    }

    function lose() {
      st.fase = 'perdido'; st.ft = 0; st.turbo = false; train.shield.visible = false; failed = true;
      ctx.shout('¡TERCER FRENAZO!', { color: '#ff2d55' });
      hud.aviso(null);
    }

    function endRace(win) {
      if (st.done) return;
      st.done = true; st.win = win;
      const total = ORB_TOTAL;
      const s2 = st.crashes <= 1, s3 = st.crashes <= 1 && st.orbs >= Math.ceil(total * 0.85);
      st.stars = win ? 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0) : 0;
      const score = Math.round(win ? st.orbs * 6 + st.nearMiss * 40 + st.shieldHits * 40 + 2000 + (3 - st.crashes) * 700 + Math.max(0, 140 - st.t) * 20 : st.orbs * 3 + st.s / 20);
      const stats = [['Orbes', `${st.orbs}/${total}`], ['Choques', `${st.crashes}/3`], ['Punta', `${Math.round(st.maxKmh)} km/h`], ['Tiempo', fmtTime(st.t)]];
      if (st.shieldHits) stats.push(['Escudazos', st.shieldHits]);
      ctx.finish(win ? {
        win: true, stars: st.stars, score, time: st.t, stats,
        moreStats: { energia: st.orbs },
        shareText: `${st.orbs} orbes a ${Math.round(st.maxKmh)} km/h en el tren bala de Shanghái`,
        title: '¡Shanghái!',
        lines: [st.stars === 3 ? 'Puntuales, cargados de energía y sin un rasguño.' : st.crashes ? 'Algún frenazo, pero los fuegos os esperaron.' : 'Sin chocar ni una vez. ¡Maquinistas de honor!']
          .concat(st.stars < 3 ? [`3★: como mucho 1 choque y 85\u00a0% de orbes (llevas ${st.crashes} ${st.crashes === 1 ? "choque" : "choques"} y ${Math.floor((100 * st.orbs) / total)}\u00a0%)`] : []),
        delay: 250,
      } : {
        win: false, stars: 0, score, time: st.t, stats,
        moreStats: { energia: st.orbs },
        title: 'Llegáis tarde…',
        lines: ['Los fuegos han empezado sin vosotros.', 'El maquinista Wei os invita a un bollo para consolaros.'],
      });
    }

    function startFinale() {
      st.fase = 'final'; st.ft = 0; st.v = 0;
      hud.aviso(null);
      const f = document.createElement('div'); f.className = 'sh-fundido'; ctx.hud.el.appendChild(f);
      requestAnimationFrame(() => f.classList.add('on'));
      st.fadeEl = f;
    }

    function setupFinale() {
      st.finSetup = true;
      train.chars.forEach((c, i) => {
        scene.add(c.group);
        c.group.scale.setScalar(1);
        c.group.position.set(PROM.x, 1.2, -(PROM.s + i * 1.4));
        c.group.rotation.set(0, Math.PI / 2 + (i ? -0.25 : 0.25), 0);
        c.group.visible = true;
      });
      const fc = VIEW.at(285, 0);
      fw.setShow({ x: fc.x, z: fc.z, w: 150, d: 260, minH: 110, maxH: 210, rate: 2.6, scale: 1.2 });
      fw.salvo(5);
      if (st.fadeEl) st.fadeEl.classList.remove('on');
      input.hideTouch();
      for (const id of ['velo', 'energia', 'orbes', 'ruta', 'choques', 'aviso']) ctx.hud.remove(id);
      hud.fx.style.opacity = '0';
      camera.fov = portrait() ? 74 : 58; camera.updateProjectionMatrix();
    }

    function finaleCamera(dt) {
      const k = smoothstep(0, 9, st.ft);
      camV.copy(VIEW.C).addScaledVector(VIEW.D, -k * 2).setY(3.0 + k * 2.6);
      lookV.copy(VIEW.at(400, -10, portrait() ? 128 : 84));
      camera.position.copy(camV);
      camera.lookAt(lookV);
      void dt;
    }

    function setHudWarning() {
      if (st.fase !== 'carrera') { if (warnedId !== null) { hud.aviso(null); warnedId = null; } return; }
      let best = null;
      for (const h of hazards) {
        const d = h.s - st.s;
        if (d > 520) break;
        if (h.hit || h.smashed) continue;
        if (h.type === 'tren' ? d < -h.len : d < 0) continue;
        if (d < Math.max(120, st.v * (h.type === 'tren' ? 3.2 : 2.4))) { best = h; break; }
      }
      if (!best) { if (warnedId !== null) { hud.aviso(null); warnedId = null; } return; }
      const lanesB = new Set(best.lanes);
      for (const h of hazards) if (h !== best && !h.hit && Math.abs(h.s - best.s) < 6) h.lanes.forEach((l) => lanesB.add(l));
      const html = `⚠ ${NOMBRE[best.type]} <span class="sh-carriles">${[0, 1, 2].map((l) => (lanesB.has(l) ? '<b class="x">✕</b>' : `<b class="ok">${l === st.lane ? '◉' : '●'}</b>`)).join('')}</span>`;
      hud.aviso(html);
      if (warnedId !== best) {
        warnedId = best;
        const an = hazards.find((h) => h.anuncio && !h.anunciado && h.s - st.s < 420 && h.s > st.s);
        if (an) { an.anunciado = true; ctx.shout(an.anuncio, { size: 'peque', cls: 'sh-clim', ms: 1800 }); audio.sfx('horn', { pitch: 0.8 }); }
        if (best.type === 'tren') audio.sfx('horn', { pitch: 0.55, vol: 0.9 });
        else audio.sfx('countdown', { pitch: 0.7, vol: 0.35 });
        if (!firstWarn) { firstWarn = true; ctx.shout('◀ ▶ ¡CAMBIA DE VÍA!', { size: 'peque', color: '#ffd166', ms: 1400 }); }
      }
    }

    function updateRace(dt) {
      st.t += dt;
      // entrada
      const ax = input.x;
      let dir = 0;
      if (axisArmed && Math.abs(ax) > 0.55) { dir = Math.sign(ax); axisArmed = false; }
      if (!axisArmed && Math.abs(ax) < 0.3) axisArmed = true;
      if (input.pressed('izq')) dir = -1;
      if (input.pressed('der')) dir = 1;
      if (dir) changeLane(dir);
      if (input.pressed('boost')) tryTurbo();
      if (st.energy < 0.5) warnedFull = false;
      // velocidad
      const prog = st.s / Z.L;
      const cruise = (240 + 140 * smoothstep(0, 0.92, prog)) / KMH;
      const target = st.turbo ? 430 / KMH : cruise;
      if (st.v < target) st.v = Math.min(target, st.v + (st.turbo ? 24 : 8.5) * dt);
      else st.v = Math.max(target, st.v - 10 * dt);
      if (st.turbo) {
        st.energy -= dt * 0.2;
        if (st.energy <= 0) { st.energy = 0; st.turbo = false; train.shield.visible = false; audio.sfx('whoosh', { pitch: 0.5, vol: 0.4 }); }
      }
      const prevS = st.s;
      st.s += st.v * dt;
      // obstáculos
      for (const h of hazards) {
        const d = h.s - st.s;
        if (d > 60) break;
        if (h.done) continue;
        if (h.type === 'tren') {
          if (st.s >= h.s - 1 && st.s <= h.s + h.len && overlap(h.lanes, 2.6)) hit(h);
          if (st.s > h.s + h.len) { h.done = true; if (!h.hit) nearMiss(h); }
        } else if (prevS < h.s && st.s >= h.s) {
          h.done = true;
          if (h.type === 'dron' ? overlap(h.lanes, 2.3) : overlap(h.lanes)) hit(h); else nearMiss(h);
        }
        if (st.fase !== 'carrera') return;
      }
      // orbes
      while (oi < orbs.length && orbs[oi].s <= st.s + 0.8) {
        const o = orbs[oi];
        if (!o.got && o.s > prevS - 3 && Math.abs(LANES[o.lane] - st.x) < 1.8) collect(o);
        oi++;
      }
      // tramos
      let ti = 0; for (let i = 0; i < TRAMOS.length; i++) if (st.s >= TRAMOS[i][0]) ti = i;
      if (ti !== st.tramoI) {
        st.tramoI = ti; st.tramo = TRAMOS[ti][1];
        if ((ti === 1 || ti === 2) && st.danos > 0) { st.danos--; setTimeout(() => { ctx.shout('🔧 ¡TREN REPARADO!', { size: 'peque', color: '#7cff6b', ms: 1300 }); audio.sfx('star'); }, 1600); }
        ctx.shout(ti === 3 ? '¡EL BUND!' : `TRAMO ${ti + 1} · ${st.tramo}`, { size: 'peque', color: '#ffd166', ms: 1500 });
        audio.sfx('bell', { vol: 0.6 });
        if (ti === 3) { const fc = VIEW.at(285, 0); fw.setShow({ x: fc.x, z: fc.z, w: 150, d: 300, minH: 120, maxH: 230, rate: 0.9, scale: 1 }); }
      }
      if (ti === 2 && st.s > Z.BUND - 700 && !fw.show) { const fc = VIEW.at(285, 0); fw.setShow({ x: fc.x, z: fc.z, w: 150, d: 300, minH: 120, maxH: 230, rate: 0.35, scale: 1 }); }
      if (!st.ultimo2 && st.s >= ULTIMO) {
        st.ultimo2 = true; st.tramo = 'ÚLTIMO TRAMO';
        if (st.danos > 0) { st.danos--; setTimeout(() => ctx.shout('🔧 ¡TREN REPARADO!', { size: 'peque', color: '#7cff6b', ms: 1200 }), 3800); }
        ctx.shout('¡ÚLTIMO TRAMO!', { cls: 'sh-clim', ms: 1800 });
        ctx.hud.el.classList.add('sh-ultimo');
        audio.sfx('horn', { pitch: 1.2 }); audio.sfx('bell'); engine.shake(0.3); hud.flash('rgba(255,209,102,.35)');
        setTimeout(() => { if (st.fase === 'carrera') ctx.shout('ORBES DORADOS x3', { size: 'peque', cls: 'sh-clim', ms: 1500 }); }, 2000);
      }
      if (st.ultimo2 && st.s >= Z.BUND - 60) { st.ultimo2 = false; ctx.hud.el.classList.remove('sh-ultimo'); }
      // chispas mientras frena en seco
      if (st.invul > 1.2) sparks.emit(3, tmpV.set(st.x + (Math.random() - 0.5) * 2.6, DECK + 0.3, -st.s - Math.random() * 20), { colors: ['#ffd166', '#ff7b00'], vel: { x: 0, y: 3, z: -st.v * 0.9 }, velSpread: 4, life: 0.5, gravity: -10, size: 0.35 });
      if (st.s >= BRAKE_AT) {
        st.fase = 'llegada'; st.turbo = false; train.shield.visible = false;
        if (ctx.cinematic) ctx.cinematic(true);
        hideEnergyTip();
        st.brakeV = Math.max(st.v, 30); st.brakeD = Z.L - st.s;
        ctx.shout('¡ESTACIÓN BUND!', { color: '#ffd166' });
        audio.sfx('bell'); fw.setShow({ ...fw.show, rate: 1.4 });
      }
    }

    function updateTrain(dt, t) {
      st.x = damp(st.x, LANES[st.lane], 11, dt);
      const vx = (st.x - prevX) / Math.max(dt, 1e-4); prevX = st.x;
      car2x = damp(car2x, st.x, 6.5, dt);
      const hover = Math.sin(t * 3.1) * 0.05 + (st.v > 1 ? Math.sin(t * 37) * 0.012 * (st.kmh / 430) : 0);
      train.lead.position.set(st.x, DECK + 0.55 + hover, -st.s);
      train.lead.rotation.set(0, clamp(vx * 0.012, -0.12, 0.12), clamp(-vx * 0.008, -0.1, 0.1));
      train.car2.position.set(car2x, DECK + 0.55 + hover, -st.s + CAR1 + GAP);
      train.car2.rotation.set(0, Math.atan2(st.x - car2x, CAR1) * 0.9, clamp(-(st.x - car2x) * 0.04, -0.08, 0.08));
      const vis = st.invul <= 0 || Math.sin(t * 42) > -0.2;
      train.lead.visible = train.car2.visible = vis;
      train.shieldMat.uniforms.uTime.value = t;
      train.shieldMat.uniforms.uOp.value = st.turbo ? 0.65 + 0.25 * Math.sin(t * 20) : 0;
      train.beam.material.opacity = 0.45 + 0.1 * Math.sin(t * 13);
      return vx;
    }

    function updateCamera(dt, vx, t) {
      const pr = portrait();
      if (st.fase === 'intro') {
        introA += dt * 0.3;
        const a = 0.55 + Math.sin(introA) * 0.35;
        camV.set(st.x + Math.sin(a) * 8.5, DECK + 3.3, -st.s - Math.cos(a) * 8.5 - 0.5);
        camera.position.lerp(camV, 1 - Math.exp(-dt * 3));
        lookV.set(st.x, DECK + 1.9, -st.s + 4.5);
        lookCur.lerp(lookV, 1 - Math.exp(-dt * 4));
        camera.lookAt(lookCur);
        camera.fov = damp(camera.fov, pr ? 62 : 48, 3, dt);
        camera.updateProjectionMatrix();
        return;
      }
      if (st.fase === 'final') { finaleCamera(dt); return; }
      const sF = clamp((st.kmh - 150) / 280, 0, 1);
      const back = pr ? 36 : 56, up = pr ? 12.5 : 8.2;
      const k = st.fase === 'cuenta' ? 1 - Math.exp(-dt * 2.2) : 1 - Math.exp(-dt * 7);
      if (st.fase === 'llegada') {
        // entrando en la estación: la cámara se acerca y baja bajo los arcos de luz
        const kk = smoothstep(BRAKE_AT, Z.L - 20, st.s);
        camV.set(st.x * 0.55 + kk * 2.5, DECK + up - kk * 3.2, -st.s + back - kk * 22);
        lookV.set(st.x * 0.8, DECK + 1.2 + kk * 1.5, -st.s - 40);
      } else {
        camV.set(st.x * 0.55, DECK + up, -st.s + back + st.v * 0.05);
        lookV.set(st.x * 0.8, DECK + (pr ? 0 : 1.2), -st.s - (pr ? 45 : 40));
      }
      camera.position.x += (camV.x - camera.position.x) * k;
      camera.position.y += (camV.y - camera.position.y) * k;
      camera.position.z = st.fase === 'cuenta' ? camera.position.z + (camV.z - camera.position.z) * k : damp(camera.position.z, camV.z, 12, dt);
      // vibración del tren a toda pastilla
      camera.position.x += (Math.sin(t * 47) + Math.sin(t * 31.3)) * 0.03 * sF;
      camera.position.y += (Math.sin(t * 53.7) + Math.sin(t * 23.1)) * 0.03 * sF;
      lookCur.lerp(lookV, st.fase === 'cuenta' ? k : 1 - Math.exp(-dt * 10));
      camera.lookAt(lookCur);
      camera.rotateZ(clamp(-vx * 0.0035, -0.06, 0.06));
      const fov = (pr ? 60 : 52) + sF * 12 + (st.turbo ? 7 : 0);
      camera.fov = damp(camera.fov, fov, 3, dt);
      camera.updateProjectionMatrix();
    }

    function updateSpeedLines() {
      const len = 2 + st.v * 0.22;
      for (let i = 0; i < NL; i++) {
        const l = ld[i];
        if (l.s < st.s - 60) spawnLine(l, st.s + 160);
        const o = i * 6;
        lpos[o] = l.x; lpos[o + 1] = l.y; lpos[o + 2] = -l.s;
        lpos[o + 3] = l.x; lpos[o + 4] = l.y; lpos[o + 5] = -l.s + len;
        lcol[o] = l.c[0]; lcol[o + 1] = l.c[1]; lcol[o + 2] = l.c[2];
        lcol[o + 3] = 0; lcol[o + 4] = 0; lcol[o + 5] = 0;
      }
      lgeo.attributes.position.needsUpdate = true; lgeo.attributes.color.needsUpdate = true;
      lmat.opacity = (st.fase === 'carrera' ? clamp((st.kmh - 240) / 160, 0, 1) * 0.75 : 0) + (st.turbo ? 0.25 : 0);
    }

    function updateAudio() {
      if (!hum && audio.ready) { hum = makeHum(audio); trainSnd = audio.loop('train'); }
      const k = st.kmh / 430;
      const on = st.fase === 'carrera' || st.fase === 'llegada' || st.fase === 'perdido';
      if (hum) hum.set(k, on ? 0.04 + k * 0.08 : 0);
      if (trainSnd) trainSnd.set({ rate: k, vol: on ? 0.03 + k * 0.13 : 0 });
      audio.intensity(st.turbo || st.ultimo2 ? 1 : k * 0.8);
    }

    function publish() {
      const peligros = [];
      for (const h of hazards) {
        const d = h.s - st.s;
        if (d > 420) break;
        if (d < -(h.len || 0) - 1 || h.smashed) continue;
        if (h.done && h.type !== 'tren') continue;
        peligros.push({ tipo: h.type, d: Math.round(d * 10) / 10, carriles: h.lanes, len: h.len || 0 });
      }
      const orbesCerca = [];
      for (let i = oi; i < orbs.length && orbs[i].s - st.s < 220; i++) if (!orbs[i].got) orbesCerca.push({ d: Math.round((orbs[i].s - st.s) * 10) / 10, carril: orbs[i].lane });
      Object.assign(etapa, {
        fase: st.fase, s: Math.round(st.s), L: Z.L, progreso: Math.min(1, st.s / Z.L), carril: st.lane, x: st.x, kmh: Math.round(st.kmh),
        energia: Math.round(st.energy * 100) / 100, turbo: st.turbo, orbes: st.orbs, orbesTotal: ORB_TOTAL, choques: st.crashes, danos: st.danos, ultimoChoque: st.ultimo || null,
        terminado: st.done, gano: st.win, estrellas: st.stars, maxKmh: Math.round(st.maxKmh), t: Math.round(st.t * 10) / 10,
        peligros, orbesCerca,
      });
    }

    const inst = {
      scene, camera,
      async start() {
        await ctx.intro(undefined, { count: false });
        st.fase = 'cuenta';
        await ctx.countdown('¡VÁMONOS!');
        st.fase = 'carrera';
        ctx.raceStart();
        for (const c of train.chars) c.group.visible = false;
        setTimeout(() => { if (st.fase === 'carrera' && st.tramoI === 0) ctx.shout('TRAMO 1 · CAMPO', { size: 'peque', color: '#ffd166', ms: 1500 }); }, 1000);
      },
      update(dt, realDt) {
        try {
          const t = ctx.engine.elapsed;
          if (st.fase === 'carrera') updateRace(dt);
          else if (st.fase === 'llegada') {
            const d = Math.max(0, Z.L - st.s);
            st.v = Math.min(st.v, st.brakeV * Math.pow(d / st.brakeD, 0.45));
            st.s = Math.min(Z.L, st.s + Math.max(st.v, d > 0.4 ? 1.5 : 0) * dt);
            if (Z.L - st.s < 0.4) { st.s = Z.L; startFinale(); }
          } else if (st.fase === 'perdido') {
            st.ft += dt;
            st.v = damp(st.v, 0, 2.2, dt);
            st.s += st.v * dt;
            if (st.v > 2) sparks.emit(4, tmpV.set(st.x + (Math.random() - 0.5) * 2.6, DECK + 0.3, -st.s - Math.random() * 20), { colors: ['#ffd166', '#ff7b00', '#fff'], vel: { x: 0, y: 3, z: -st.v * 0.9 }, velSpread: 5, life: 0.6, gravity: -10, size: 0.4 });
            if (st.ft > 2 && !st.done) endRace(false);
          } else if (st.fase === 'final') {
            st.ft += dt;
            if (st.ft > 0.45 && !st.finSetup) setupFinale();
            if (st.finSetup) {
              train.chars.forEach((c, i) => c.pose(st.ft > 2.2 ? (i === 0 ? 'cheer' : (Math.sin(st.ft * 0.8) > 0 ? 'cheer' : 'wave')) : 'idle', st.ft + i * 0.4));
              if (st.ft > 2.2 && !st.banner) {
                st.banner = true;
                const n = ctx.names;
                const b = document.createElement('div'); b.className = 'sh-banner';
                const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
                b.innerHTML = `¡Lo habéis conseguido, ${esc(n[0])} y ${esc(n[1])}!<small>SHANGHÁI · FIN DE LA RUTA</small>`;
                ctx.hud.el.appendChild(b);
                setTimeout(() => b.remove(), 4300);
                audio.sfx('star'); audio.sfx('bell');
                fw.salvo(4);
              }
              if (st.ft > 5 && !st.bigOne) { st.bigOne = true; fw.salvo(9); engine.shake(0.3); }
              if (st.ft > 6.7 && !st.stickerDone) { st.stickerDone = true; ctx.sticker('fuegos'); }
              if (st.ft > 8 && !st.done) endRace(true);
            }
          }
          st.invul = Math.max(0, st.invul - dt);
          st.kmh = st.v * KMH;
          if (st.kmh > st.maxKmh) st.maxKmh = st.kmh;
          if (!maglevDone && st.kmh >= 429.5) { maglevDone = true; ctx.sticker('maglev'); ctx.shout('¡430 KM/H!', { color: '#ff4fa3' }); engine.shake(0.4); }
          const vx = updateTrain(dt, t);
          updateCamera(dt, vx, t);
          world.update(st.s, camera, dt, st.x);
          animateHazards(hazards, st.s, t, dt);
          orbMesh.update(st.s, t);
          sparks.update(dt);
          updateSpeedLines();
          fw.update(dt, engine.renderer ? engine.renderer.domElement.height / 2 : innerHeight);
          setHudWarning();
          if (!st.finSetup) hud.update(st, ORB_TOTAL);
          if (tipEl) { tipT -= realDt; if (tipT <= 0 || st.turbo || st.energy < 0.999 || st.fase !== 'carrera') hideEnergyTip(); }
          const tb = turboBtn();
          if (tb) { const ready = st.energy >= 0.999 && !st.turbo && st.fase === 'carrera'; tb.el.classList.toggle('listo', ready); tb.el.classList.toggle('vacio', !ready && !st.turbo); }
          updateAudio();
          publish();
        } catch (e) {
          if (!errLogged) { errLogged = true; console.error('shanghai update', e); }
        }
      },
      dispose() {
        removeEventListener('pointerdown', pDown, true); removeEventListener('pointermove', pMove, true);
        removeEventListener('pointerup', pUp, true); removeEventListener('pointercancel', pUp, true);
        hideEnergyTip();
        if (hum) hum.stop();
        if (trainSnd) trainSnd.stop();
        fw.dispose(); sparks.dispose(); world.dispose();
        lgeo.dispose(); lmat.dispose();
        disposeTree(scene);
        document.querySelectorAll('.sh-banner, .sh-fundido').forEach((e) => e.remove());
        void failed;
      },
    };
    publish();
    hud.update(st, ORB_TOTAL);
    return inst;
  },
};
