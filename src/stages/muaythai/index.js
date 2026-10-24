// ETAPA 4 · MUAY THAI — El combate en el estadio de Bangkok.
// Menú (1 o 2 jugadores) → wai kru (minijuego de ritmo) → 3 asaltos → saludo final.
import * as THREE from 'three';
import { Particles } from '../../core/engine.js';
import { disposeTree, makeRng } from '../../core/util.js';
import { uiRoot, esc } from '../../core/ui.js';
import { crearEstadio, RING_Y } from './estadio.js';
import { Animator, equipar, flash, POSES, ease } from './luchador.js';
import { Fighter, Fight, RivalAI } from './combate.js';
import { WaiKru, BPM } from './waikru.js';
import { crearSonido } from './sonido.js';
import { computeLayout, crearCapa, menuJugadores } from './interfaz.js';

const RIVAL_LOOK = { skin: '#b9804f', hair: '#14100c', hairStyle: 3, shirt: '#1d4ed8', pattern: 0, shorts: '#1d4ed8', glasses: false, cap: '', bag: false };
const REF_LOOK = { skin: '#d9a06e', hair: '#3a3a3a', hairStyle: 3, shirt: '#ffffff', pattern: 0, shorts: '#15151a', glasses: false, cap: '', bag: false };
const ROUNDS = 3, ROUND_T = 40;
const RED = '#c1121f', BLUE = '#1d4ed8';

const INTRO_1P = [
  { who: 'Somchai', text: '¡Sawasdee krap! Soy Somchai, «el Bambú». Me doblo, pero no me rompo.' },
  { who: 0, text: 'Encantado. Yo también me doblo… lo de no romperme ya lo veremos.' },
  { who: 1, text: 'Primero el wai kru, {0}: el baile para honrar a tu maestro. Toca al ritmo del ching.' },
  { who: 'Somchai', text: 'Un consejo: antes de mis golpes gordos, brillo. Mi abuela dice que avisar es de buena educación.' },
  { who: 0, text: '¿Y si bloqueo o esquivo justo a tiempo?' },
  { who: 'Somchai', text: 'Contraataque crítico. Pero eso no se lo cuentes a nadie, ¿eh?' },
];
const INTRO_2P = [
  { who: 1, text: '{0}, esto va en serio: tú en la esquina roja, yo en la azul. El móvil en medio.' },
  { who: 0, text: 'Lo que pasa en el ring de Bangkok se queda en el avión.' },
  { who: 'Árbitro', text: 'Primero el wai kru, los dos a la vez. Cada uno toca en su mitad.' },
  { who: 'Árbitro', text: 'Luego: puño, patada, rodilla y bloqueo. Doble toque en bloqueo para esquivar. ¡Respeto ante todo!' },
];
const TIPS = [
  '«Cuando brille, espera… y <b>bloquea justo antes</b> del golpe.»',
  '«Las patadas cansan. Vigila la <b>barra verde</b> de aguante.»',
  '«Tras un contraataque, <b>¡suelta la patada!</b> Hace el doble.»',
];

export default {
  id: 'muaythai',
  music: 'muaythai',
  controls: { joystick: false, buttons: [] },
  intro: INTRO_1P,

  async create(ctx) {
    const { engine, input, audio } = ctx;
    const names = ctx.names;
    const scene = new THREE.Scene();
    const cam0 = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 120);
    const cam1 = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 120);
    const estadio = crearEstadio(scene, { q: engine.q, battery: engine.battery });
    const sonido = crearSonido(audio);
    const fx = new Particles(scene, 500, { size: 0.12 });
    const capa = crearCapa(ctx.hud.el);
    let disposed = false;

    // ───── personajes ─────
    const mkFighter = (idx, look, color, name, shortsCol) => {
      const ch = ctx.makeCharacter(look);
      const gear = equipar(ch, { color, shorts: shortsCol || color });
      const anim = new Animator(ch);
      scene.add(ch.group);
      const f = new Fighter({ idx, ch, gear, anim, name });
      return f;
    };
    const fighters = [mkFighter(0, ctx.looks[0], RED, names[0])];
    const ref = ctx.makeCharacter(REF_LOOK);
    equipar(ref, { ref: true, shirtless: false });
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: '#111', flatShading: true }));
    tie.position.set(0, 0.42, 0.17); ref.rig.torso.add(tie);
    const refAnim = new Animator(ref); refAnim.base = () => POSES.refIdle;
    scene.add(ref.group);
    const refSt = { x: 0, z: -1.7, face: 0, mode: 'idle' };
    let compi = null, compiAnim = null;

    // efectos de impacto: anillos que se abren mirando a cámara
    const ringGeo = new THREE.RingGeometry(0.1, 0.16, 24);
    const rings = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 10; scene.add(m); rings.push({ m, t: 1, s: 1 });
    }
    const burst = (p, { color = '#fff2b0', size = 1 } = {}) => {
      const r = rings.find((x) => x.t >= 1) || rings[0];
      r.t = 0; r.s = size; r.m.position.copy(p); r.m.material.color.set(color); r.m.visible = true;
    };

    // ───── estado ─────
    const st = {
      phase: 'menu', players: 0, round: 0, tRound: ROUND_T, time: 0, hitstop: 0, excite: 0.25,
      ko: null, result: null, camMode: 'menu', split: false, flashT: [0, 0], L: null, layoutPhase: 'none',
      waiBonus: [0, 0], waiMiss: [0, 0], waiHintT: [-9, -9], waiPerfect: [false, false], waiPrec: [0, 0], lastW: innerWidth, lastH: innerHeight,
    };
    let wk = null, fight = null, ai = null;
    const timers = [];
    const sleep = (s) => new Promise((r) => timers.push({ t: s, r }));
    const until = (fn) => new Promise((r) => timers.push({ fn, r }));
    const corner = ['rojo', 'azul'];
    const fname = () => [names[0], st.players === 2 ? names[1] : 'Somchai'];

    const rig0 = { cam: cam0, pos: new THREE.Vector3(9, 4, 9), look: new THREE.Vector3(0, 1.5, 0), flip: false, init: false };
    const rig1 = { cam: cam1, pos: new THREE.Vector3(-9, 4, -9), look: new THREE.Vector3(0, 1.5, 0), flip: true, init: false };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    function buildP1(n) {
      if (n === 1) {
        fighters[1] = mkFighter(1, RIVAL_LOOK, BLUE, 'Somchai');
        // el compi, en la esquina roja con la toalla
        compi = ctx.makeCharacter({ ...ctx.looks[1], bag: false });
        compi.group.position.set(-3.95, RING_Y, -2.7); compi.group.rotation.y = Math.PI / 2 - 0.4;
        const towel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true }));
        towel.position.set(0, 0.47, 0.05); towel.rotation.z = 0.1; compi.rig.torso.add(towel);
        compiAnim = new Animator(compi); compiAnim.base = (t) => ({ ...POSES.neutral, hy: 0.82 + Math.abs(Math.sin(t * 3)) * 0.02 });
        scene.add(compi.group);
      } else {
        fighters[1] = mkFighter(1, ctx.looks[1], BLUE, names[1]);
      }
      fighters[0].x = -1.75; fighters[1].x = 1.75;
      fighters[0].hp = fighters[0].hpMax = 100; fighters[1].hp = fighters[1].hpMax = n === 1 ? 160 : 100;
    }

    // ───── disposición (botones, regiones, marcador) ─────
    function applyLayout(phase) {
      st.layoutPhase = phase;
      const W = innerWidth, H = innerHeight;
      st.lastW = W; st.lastH = H;
      if (phase === 'none' || !st.players) {
        input.configure({ joystick: false, buttons: [] });
        st.L = null; st.split = false;
        capa.setRegions([{ x: 0, y: 0, w: W, h: H, rot: false, pl: 0 }], 1);
        return;
      }
      const L = computeLayout({ players: st.players, phase: phase === 'fin' ? 'fight' : phase, W, H });
      if (phase === 'fin') L.controls.buttons = [];
      st.L = L;
      st.split = st.players === 2 && L.portrait;
      input.configure(L.controls);
      if (input.touchEl) input.touchEl.classList.add('mt-ctrl');
      capa.setRegions(L.regions, st.players);
      if (st.split) {
        const d = document.createElement('div');
        Object.assign(d.style, { position: 'absolute', left: 0, right: 0, top: (H / 2 - 2) + 'px', height: '4px', background: 'linear-gradient(90deg,#c1121f,#ffcf3f,#1d4ed8)', boxShadow: '0 0 8px rgba(0,0,0,.6)' });
        capa.capa.appendChild(d);
      }
      if (phase === 'fight') { capa.buildHud(fname(), corner); capa._dev = null; }
    }

    // ───── cámaras ─────
    function camGoal(rig, i) {
      const f0 = fighters[0], f1 = fighters[1] || fighters[0];
      const t = st.time;
      const portraitCam = st.players === 1 ? innerHeight > innerWidth : st.split;
      const m = st.camMode;
      if (m === 'menu' || !fighters[1]) {
        const a = t * 0.12 + 0.6;
        return { pos: V(Math.sin(a) * 9.5, RING_Y + 3.4, Math.cos(a) * 9.5), look: V(0, RING_Y + 0.9, 0), fov: portraitCam ? 62 : 48 };
      }
      if (m === 'intro') {
        const a = t * 0.15 + 0.9;
        return { pos: V(Math.sin(a) * 6, RING_Y + 2.2, Math.cos(a) * 6), look: V(0, RING_Y + 1.0, 0), fov: portraitCam ? 64 : 46 };
      }
      const f = i === 1 ? f1 : f0, o = i === 1 ? f0 : f1;
      const side = i === 1 ? -1 : 1;
      if (m === 'waikru') {
        if (st.players === 2 && !st.split) return { pos: V(0, RING_Y + 2.6, 5.6), look: V(0, RING_Y + 0.55, 0), fov: 44 };
        const a = Math.sin(t * 0.22) * 0.3 + 0.9;
        const r = portraitCam ? 4.1 : 3.6;
        const dx = f.dir * Math.cos(a) * r, dz = side * Math.sin(a) * r;
        return { pos: V(f.x + dx, RING_Y + (portraitCam ? 2.3 : 1.7), dz), look: V(f.x + f.dir * 0.2, RING_Y + (portraitCam ? 0.2 : 0.55), 0), fov: portraitCam ? 62 : 48 };
      }
      if (m === 'ko' && st.ko) {
        const L = st.ko.loser, W = st.ko.winner;
        const mid = (L.x + W.x) / 2;
        return { pos: V(mid + L.dir * 0.5, RING_Y + 1.75, 2.9), look: V(L.x - L.dir * 0.4, RING_Y + 0.55, 0), fov: 52, k: 2.2 };
      }
      if (m === 'final') {
        const a = t * 0.22;
        const mid = (f0.x + f1.x) / 2;
        return { pos: V(mid + Math.sin(a) * 2.6, RING_Y + 1.9, 0.6 + Math.abs(Math.cos(a)) * 2.4), look: V(mid, RING_Y + 0.95, 0), fov: portraitCam ? 64 : 50 };
      }
      // combate
      if (st.players === 2 && !st.split) {
        const mid = (f0.x + f1.x) / 2, sep = Math.abs(f1.x - f0.x);
        const asp = innerWidth / innerHeight;
        const dist = 3.6 + sep * 0.6 + (asp < 1.5 ? 1.2 : 0);
        return { pos: V(mid, RING_Y + 2.15, dist), look: V(mid, RING_Y + 0.8, 0), fov: 44 };
      }
      // por encima del hombro: el propio luchador a la izquierda, el rival en el centro
      return {
        pos: V(f.x - f.dir * (portraitCam ? 2.7 : 2.3), RING_Y + (portraitCam ? 2.75 : 2.3), side * (portraitCam ? 1.45 : 1.35)),
        look: V(o.x + f.dir * 0.05, RING_Y + (portraitCam ? 0.85 : 0.95), side * -0.2),
        fov: portraitCam ? 56 : 50,
      };
    }
    function updateCam(rig, i, dt) {
      const g = camGoal(rig, i);
      const k = g.k || 4.5;
      if (!rig.init) { rig.pos.copy(g.pos); rig.look.copy(g.look); rig.init = true; }
      const a = 1 - Math.exp(-k * dt);
      rig.pos.lerp(g.pos, a); rig.look.lerp(g.look, a);
      rig.cam.fov += (g.fov - rig.cam.fov) * a;
      rig.cam.position.copy(rig.pos);
      rig.cam.up.set(0, 1, 0);
      rig.cam.lookAt(rig.look);
      if (rig.flip && st.split) rig.cam.rotateZ(Math.PI);
    }

    // ───── efectos al golpear ─────
    const hitPoint = (att, def, kind) => V(def.x - att.dir * 0.22, RING_Y + (kind === 'kick' ? 1.25 : kind === 'knee' ? 1.05 : 1.55), 0);
    // grito grande: en pantalla partida sale en cada mitad (girado para el de arriba)
    function grito(text, { color = '#ffcf3f', ms = 1100, size = '' } = {}) {
      if (st.split) capa.pop(text, { size: size === 'peque' ? '' : 'grande', color, y: 0.5, ms });
      else ctx.shout(text, { color, ms, size });
    }
    const humanIdx = () => (st.players === 2 ? [0, 1] : [0]);
    const isHuman = (f) => st.players === 2 || f.idx === 0;
    function wireFight() {
      fight.on('start', ({ mv }) => sonido.whoosh(mv.kind));
      fight.on('dodge', ({ f }) => { sonido.whoosh('jab'); if (isHuman(f)) capa.pop('esquiva', { p: f.idx, size: 'peque', color: '#8ef0c4', y: 0.42 }); });
      fight.on('hit', ({ a, d, mv, crit, heavy, dmg }) => {
        st.hitstop = crit ? 0.12 : heavy ? 0.08 : 0.06;
        engine.shake(crit ? 0.9 : heavy ? 0.5 : 0.22);
        st.flashT[d.idx] = crit ? 0.2 : 0.11;
        const p = hitPoint(a, d, mv.kind);
        burst(p, { color: crit ? '#ffb703' : '#fff2b0', size: crit ? 2.2 : heavy ? 1.5 : 1 });
        fx.emit(crit ? 22 : heavy ? 14 : 8, V(d.x, RING_Y + 1.5, 0), { colors: ['#e8f7ff', '#ffffff', '#bfe6ff'], vel: { x: a.dir * 2.2, y: 2.2, z: 0 }, velSpread: 2.6, life: 0.6, size: 0.08, gravity: -9 });
        sonido.hit(mv.kind, crit);
        st.excite = Math.min(1, st.excite + (crit ? 0.5 : heavy ? 0.25 : 0.08));
        ctx.vibrate(crit ? 60 : heavy ? 35 : 12);
        if (crit) { capa.pop('¡CRÍTICO!', { size: 'grande', color: '#ffb703', y: 0.3 }); capa.flash(0.35, '#ffd27a'); }
        else if (heavy && dmg >= 10) capa.pop(mv.kind === 'kick' ? '¡PATADÓN!' : '¡RODILLAZO!', { p: a.idx, size: '', y: 0.3 });
        else if (mv.kind === 'elbow') capa.pop('¡CODAZO!', { p: a.idx, size: 'peque', y: 0.32 });
        if (st.players === 1 && d.idx === 0) capa.flash(heavy ? 0.24 : 0.12, '#ff9a3c');
        if (compi && a.idx === 0 && (crit || heavy)) { compiAnim.play([[0.15, POSES.cheer2], [0.6, POSES.cheer], [0.9, POSES.neutral]]); }
      });
      fight.on('block', ({ d, perfect, mv }) => {
        sonido.block();
        fx.emit(5, V(d.x, RING_Y + 1.45, 0), { colors: ['#ffffff', '#c8d7ff'], velSpread: 1.5, life: 0.3, size: 0.06 });
        if (!perfect && isHuman(d)) capa.pop('bloqueo', { p: d.idx, size: 'peque', color: '#9fb4ff', y: 0.42 });
        if (isHuman(d) && d.stats.blocked >= 15) ctx.sticker('muralla');
        void mv;
      });
      fight.on('evade', ({ d, perfect }) => { if (!perfect && isHuman(d)) capa.pop('¡esquiva!', { p: d.idx, size: 'peque', color: '#8ef0c4', y: 0.42 }); });
      fight.on('perfect', ({ a, d }) => {
        sonido.perfect();
        engine.slowmo(0.4, 0.35);
        capa.pop('¡CONTRAATAQUE!', { p: isHuman(d) ? d.idx : null, size: '', color: '#ffcf3f', y: 0.28 });
        if (isHuman(d)) capa.flash(0.25, '#ffe9a0');
        fx.emit(16, V(a.x, RING_Y + 1.6, 0), { colors: ['#ffd23f', '#fff3b0'], velSpread: 3, life: 0.6, size: 0.07, gravity: -2 });
        st.excite = Math.min(1, st.excite + 0.3);
      });
      fight.on('ko', ({ winner, loser }) => {
        st.ko = { winner, loser, round: st.round };
        engine.slowmo(1.8, 0.2);
        engine.shake(1.3);
        capa.flash(0.9, '#ffffff');
        sonido.ko();
        grito('¡KO!', { color: '#ffcf3f', ms: 1800 });
        st.excite = 1; st.camMode = 'ko';
        ctx.vibrate(120);
      });
      if (ai) {
        ai.onRead = () => {
          capa.pop('¡TE HA LEÍDO!', { size: '', color: '#7aa7ff', y: 0.26 });
          if (ai.reads <= 2) capa.ayuda('Somchai lee los golpes repetidos: <b>¡varía!</b>', 2400, { y: innerHeight > innerWidth ? 0.2 : 0.3 });
        };
        ai.onTell = (pat, first) => {
          sonido.tell(pat.id === 'elefante' ? 'kick' : 'x');
          const por = innerHeight > innerWidth;
          capa.pop(pat.name.toUpperCase(), { size: 'mt-aviso', y: por ? 0.15 : 0.22 });
          if (first) capa.ayuda(pat.hint, 3000, { y: por ? 0.2 : 0.3 });
        };
      }
    }

    // ───── wai kru ─────
    const WAI_GESTURE = [POSES.ramL, POSES.ramWai, POSES.ramR];
    function waiJudge(i, lane, res) {
      const f = fighters[i]; if (!f) return;
      if (res === 'fallo') {
        f.anim.kick({ rz: 0.12, nz: 0.35, tx: 0.2 });
        st.waiMiss[i] = (st.waiMiss[i] || 0) + 1;
        if (isHuman(f) && st.waiMiss[i] >= 3 && st.time - (st.waiHintT[i] || -9) > 3) {
          st.waiHintT[i] = st.time; st.waiMiss[i] = 0;
          capa.ayuda('¡Toca el botón cuando el símbolo llegue a su <b>círculo</b>!', 2900, { p: st.players === 2 ? i : null, y: st.players === 2 ? 0.16 : 0.1 });
        }
        if (isHuman(f)) capa.pop('¡uy!', { p: i, size: 'peque', color: '#c9b8b8', y: 0.4 });
        return;
      }
      st.waiMiss[i] = 0;
      f.anim.play([[0.1, WAI_GESTURE[lane], ease.out], [0.36, WAI_GESTURE[lane], ease.lin], [0.56, POSES.ram, ease.inOut]]);
      fx.emit(res === 'perfecto' ? 8 : 4, V(f.x, RING_Y + 1.4, 0), { colors: ['#ffd23f', '#fff3b0', '#ffb703'], velSpread: 1.6, life: 0.7, size: 0.07, gravity: -1.5 });
      if (isHuman(f)) capa.pop(res === 'perfecto' ? '¡PERFECTO!' : '¡BIEN!', { p: i, size: 'peque', color: res === 'perfecto' ? '#ffcf3f' : '#ffffff', y: st.players === 2 ? 0.3 : 0.24 });
      st.excite = Math.min(1, st.excite + 0.03);
    }

    async function waiKruPhase() {
      st.phase = 'waikru'; st.camMode = 'waikru';
      audio.stopMusic(0.6);
      estadio.playing = 1;
      applyLayout('waikru');
      wk = new WaiKru({
        rng: ctx.rng, players: 2, sonido, capa, onJudge: waiJudge, solo: st.players === 1,
        ai: st.players === 1 ? { p: 1, skill: 0.85, rng: makeRng(ctx.seed ^ 0x5eed) } : null,
      });
      capa.ayuda(st.players === 1 ? 'Toca cuando el símbolo llegue a su <b>círculo</b>. ¡Al ritmo del ching!' : 'Cada uno en su mitad: toca cuando el símbolo llegue al <b>círculo</b>.', 3800, { y: st.players === 2 ? 0.16 : 0.1 });
      grito('WAI KRU', { color: '#ffcf3f', ms: 1400 });
      await until(() => wk.done || disposed);
      if (disposed) return;
      capa.lienzo.getContext('2d').clearRect(0, 0, capa.lienzo.width, capa.lienzo.height);
      st.phase = 'saludo';
      applyLayout('fin');
      for (const i of humanIdx()) {
        st.waiPrec[i] = wk.precision(i);
        st.waiBonus[i] = Math.round(20 * st.waiPrec[i]);
        st.waiPerfect[i] = wk.perfecto(i);
        const f = fighters[i];
        f.hp = f.hpMax = 100 + st.waiBonus[i];
        capa.pop(st.waiPerfect[i] ? `¡PERFECTO! +${st.waiBonus[i]}` : `+${st.waiBonus[i]} ENERGÍA`, { p: i, size: '', color: '#ffcf3f', y: 0.45 });
        if (st.waiPerfect[i]) ctx.sticker('wai-kru');
      }
      if (st.players === 1) { const f = fighters[1]; f.hp = f.hpMax = 160; }
      for (const f of fighters) f.anim.play([[0.5, POSES.waiDeep, ease.inOut], [1.4, POSES.waiDeep, ease.lin], [2.0, POSES.guard, ease.inOut]]);
      await sleep(1.4);
      // el maestro (el compi) quita el mongkol
      for (const f of fighters) { f.gear.mongkol.visible = false; fx.emit(14, V(f.x, RING_Y + 1.85, 0), { colors: ['#ffffff', '#ffd23f'], velSpread: 1.5, life: 0.8, size: 0.07, gravity: 1 }); }
      capa.ayuda('Fuera el mongkol: ¡a luchar!', 1500, { y: 0.24 });
      estadio.playing = 0.45;
      audio.music('muaythai');
      await sleep(1.2);
    }

    // ───── combate ─────
    async function fightPhase() {
      const [f0, f1] = fighters;
      fight = new Fight(f0, f1);
      if (st.players === 1) ai = new RivalAI(f1, f0, ctx.rng, fight);
      wireFight();
      st.crowd = audio.loop('crowd'); st.crowd.set({ vol: 0.08 });
      for (let r = 1; r <= ROUNDS; r++) {
        st.round = r; if (ai) ai.round = r;
        st.phase = 'presenta'; st.camMode = 'fight'; st.tRound = ROUND_T;
        for (const f of fighters) { f.freeze = true; f.action = null; f.blocking = false; }
        refSt.mode = 'stop';
        applyLayout('fight');
        capa.updateHud(fighters, r, ROUNDS, st.tRound);
        grito(r === ROUNDS ? 'ÚLTIMO ASALTO' : `ASALTO ${r}`, { color: '#ffcf3f', ms: 1300 });
        sonido.bell(1);
        await sleep(1.3); if (disposed) return;
        grito('¡A LUCHAR!', { color: '#ffffff', ms: 900 });
        refSt.mode = 'idle';
        for (const f of fighters) f.freeze = false;
        st.phase = 'ronda';
        await until(() => st.tRound <= 0 || st.ko || disposed);
        if (disposed) return;
        if (st.ko) break;
        sonido.bell(3);
        st.phase = 'descanso';
        for (const f of fighters) { f.freeze = true; f.action = null; f.blocking = false; f.cancelTell(); }
        if (ai) ai.interrupt();
        capa.pop('¡CAMPANA!', { size: '', y: 0.3 });
        if (r < ROUNDS) {
          await sleep(0.8);
          for (const f of fighters) { f.hp = Math.min(f.hpMax, f.hp + 10); f.st = f.stMax; }
          if (st.players === 1) capa.ayuda(`<b>${esc(names[1])}:</b> ${TIPS[(r - 1) % TIPS.length]}`, 2600, { y: 0.55 });
          else capa.ayuda('Descanso: ¡agua y a por el siguiente!', 2200, { y: 0.5 });
          await sleep(2.6); if (disposed) return;
        }
      }
      await endPhase();
    }

    async function endPhase() {
      const [f0, f1] = fighters;
      st.phase = 'final';
      applyLayout('fin');
      for (const f of fighters) { f.freeze = true; f.cancelTell(); }
      let winner, loser, draw = false;
      const ko = st.ko;
      if (ko) {
        winner = ko.winner; loser = ko.loser;
        refSt.mode = 'wave';
        await sleep(2.4); if (disposed) return;
      } else {
        st.camMode = 'final';
        grito('DECISIÓN…', { size: 'peque', color: '#ffffff', ms: 1500 });
        await sleep(1.6); if (disposed) return;
        const p0 = f0.stats.points, p1 = f1.stats.points;
        if (Math.abs(p0 - p1) < 0.5 && Math.abs(f0.hp - f1.hp) < 1) draw = true;
        winner = p0 > p1 || (Math.abs(p0 - p1) < 0.5 && f0.hp >= f1.hp) ? f0 : f1;
        loser = winner === f0 ? f1 : f0;
      }
      st.camMode = 'final';
      refSt.mode = draw ? 'stop' : 'raise';
      refSt.winner = winner;
      const wname = winner.idx === 0 ? fname()[0] : fname()[1];
      grito(draw ? '¡EMPATE!' : `¡GANA ${wname.toUpperCase()}!`, { color: winner.idx === 0 ? '#ff6f61' : '#7aa7ff', ms: 2200, size: 'peque' });
      winner.celebrate = (t) => ({ ...POSES.cheer, hy: 0.82 + Math.max(0, Math.sin(t * 9)) * 0.08, lsz: 2.6 + Math.sin(t * 9) * 0.2, rsz: -2.6 - Math.sin(t * 9) * 0.2 });
      if (draw) loser.celebrate = winner.celebrate;
      st.excite = 1;
      if (compi && winner.idx === 0) compiAnim.base = (t) => ({ ...POSES.cheer, hy: 0.82 + Math.max(0, Math.sin(t * 9)) * 0.1 });
      if (ko) { await new Promise((r) => loser.getUp(r)); st.ko = null; }
      await sleep(1.6); if (disposed) return;
      // respeto: se saludan con un wai
      winner.celebrate = null; loser.celebrate = null;
      for (const f of fighters) { f.ko = false; f.anim.play([[0.5, POSES.waiDeep, ease.inOut], [2.0, POSES.waiDeep, ease.lin]]); }
      refSt.mode = 'idle';
      capa.ayuda('Se saludan con un <b>wai</b>. Respeto.', 2000, { y: 0.24 });
      await sleep(1.8); if (disposed) return;
      finishGame(winner, ko, draw);
    }

    function somchaiDice(win, wp, s) {
      if (win && wp >= 0.9) return 'Somchai: «¡Mi abuela dice que tienes muy buen wai!»';
      if (win && wp >= 0.5) return 'Somchai: «Buen combate. El wai, con un poco más de ritmo, ¡de diez!»';
      if (win) return 'Somchai: «Ganas tú… pero el wai kru se baila, ¿eh? ¡Mi abuela se ha tapado los ojos!»';
      if (s.crits === 0) return 'Somchai: «Fíjate cuando brillo y bloquea justo antes. ¡La próxima me ganas!»';
      return 'Somchai: «¡Casi! Ya me lees los golpes. La revancha, mañana.»';
    }
    function finishGame(winner, ko, draw) {
      const [f0, f1] = fighters;
      if (st.players === 2) {
        ctx.sticker('duelo');
        const wn = winner.idx === 0 ? names[0] : names[1];
        st.result = { winner: draw ? -1 : winner.idx, ko: !!ko };
        const p0 = Math.round(f0.stats.points * 10), p1 = Math.round(f1.stats.points * 10);
        const vs = (x, y) => `${x} – ${y}`;
        ctx.finish({
          win: true, stars: 0, duel: true, noRecord: true,
          score: Math.max(p0, p1) + (ko ? 1000 : 0),
          title: draw ? '¡Empate!' : `¡Gana ${wn}!`,
          stats: [
            ['Golpes', vs(f0.stats.landed, f1.stats.landed)],
            ['Bloqueos', vs(f0.stats.blocked, f1.stats.blocked)],
            ['Wai kru %', vs(Math.round(st.waiPrec[0] * 100), Math.round(st.waiPrec[1] * 100))],
            ['Puntos', vs(p0, p1)],
          ],
          moreStats: { golpes: f0.stats.landed + f1.stats.landed },
          lines: [
            `Rojo: ${names[0]}  ·  Azul: ${names[1]}`,
            draw ? 'Empate a los puntos: ¡revancha en el siguiente vuelo!' : `${winner.idx === 0 ? 'Esquina roja' : 'Esquina azul'}: ${wn} gana ${ko ? `por KO en el ${ko.round}.º asalto` : 'a los puntos'}.`,
            'Duelo en el avión: no cuenta para la ruta, pero sí para presumir.',
          ],
          shareText: draw ? `empate a guantazos con ${names[1]} en Bangkok` : `${wn} ganó el duelo de Muay Thai en Bangkok`,
        });
        return;
      }
      const win = winner === f0;
      const holgado = win && (f0.hp / f0.hpMax >= 0.5 || f0.stats.points >= f1.stats.points * 1.6);
      let stars = 0;
      // 3ª estrella: KO o victoria holgada, y además leer el combate (wai kru ≥70 %, contraataques o bloqueos)
      const lectura = st.waiPrec[0] >= 0.7 || f0.stats.crits >= 2 || f0.stats.blocked >= 8;
      if (win) stars = (ko || holgado) ? (lectura ? 3 : 2) : 1;
      if (win && ko && ko.round === 1) ctx.sticker('ko-1');
      const score = Math.round(f0.stats.points * 10 + f0.hp * 5 + (win ? 1000 : 0) + (win && ko ? 1500 : 0) + st.waiPrec[0] * 1000);
      st.result = { win, stars, ko: !!ko, score };
      ctx.finish({
        win, stars, score,
        title: win ? (ko ? '¡KO! ¡Qué combate!' : '¡Ganas a los puntos!') : (ko ? 'Somchai gana esta vez' : 'Somchai gana a los puntos'),
        stats: [
          ['Final', win ? (ko ? `KO (${ko.round}.º)` : 'Puntos') : 'Derrota'],
          ['Golpes', `${f0.stats.landed}/${f0.stats.thrown}`],
          ['Bloqueos', `${f0.stats.blocked}`],
          ['Contraataques', `${f0.stats.crits}`],
          ['Wai kru', `${Math.round(st.waiPrec[0] * 100)} %`],
          ['Vida', `${Math.round(f0.hp)}`],
        ],
        moreStats: { golpes: f0.stats.landed },
        lines: [somchaiDice(win, st.waiPrec[0], f0.stats)],
        shareText: win ? (ko ? `KO a Somchai en el asalto ${ko.round} en Bangkok` : `gané a Somchai a los puntos en Bangkok`) : `${score} puntos contra Somchai en Bangkok`,
      });
    }

    // ───── bucle ─────
    // en 1 jugador, tu luchador (de espaldas a cámara) se vuelve semitransparente para no tapar
    function setGhost(f, v) {
      if (f._ghost === v) return; f._ghost = v;
      f.ch.group.traverse((o) => {
        if (!o.isMesh || o.material.blending === THREE.AdditiveBlending) return;
        const m = o.material; m.transparent = v < 1; m.opacity = v; m.needsUpdate = true;
      });
    }
    const f0x = () => fighters[0].x, f1x = () => fighters[1].x;
    function placeFighter(f) {
      f.ch.group.position.set(f.x, RING_Y, 0);
      f.ch.group.rotation.y = f.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    function idleAnim(f, dt) {
      const t = st.time;
      if (st.phase === 'waikru' && wk) {
        const beat = wk.clock / (60 / BPM);
        if (beat < 4) f.anim.base = () => (Math.floor(beat) % 2 === 0 ? POSES.kneelBow : POSES.kneel);
        else f.anim.base = (tt) => ({ ...POSES.ram, hy: POSES.ram.hy + Math.sin(beat * Math.PI) * 0.02, ty: Math.sin(beat * Math.PI * 0.5) * 0.25, rhx: POSES.ram.rhx + Math.sin(tt * 2) * 0.1 });
        f.anim.rate = 7;
      } else if (st.phase === 'menu' || st.phase === 'intro' || st.phase === 'saludo') {
        f.anim.base = (tt) => ({ ...POSES.guard, hy: POSES.guard.hy + Math.sin(tt * 4) * 0.015 });
        f.anim.rate = 8;
      }
      f.anim.update(dt, t);
    }
    function humanIntent(i) {
      const p = input.p(i);
      return { punch: p.pressed('punch'), kick: p.pressed('kick'), knee: p.pressed('knee'), block: p.down('block'), blockPress: p.pressed('block'), dodge: p.pressed('dodge') };
    }

    const inst = {
      scene, camera: cam0,
      async start() {
        st.phase = 'menu';
        const n = await new Promise((r) => { st.menu = menuJugadores(uiRoot(), names, { onPick: r, input }); });
        if (disposed) return;
        st.players = n;
        buildP1(n);
        st.phase = 'intro'; st.camMode = 'intro';
        applyLayout('none');
        const salto = new URLSearchParams(location.search).has('mtsalto'); // solo para desarrollo
        if (!salto) {
          await ctx.intro(n === 1 ? INTRO_1P : INTRO_2P, { count: false });
          if (disposed) return;
          await waiKruPhase();
        } else { for (const f of fighters) f.gear.mongkol.visible = false; audio.music('muaythai'); }
        if (disposed) return;
        await fightPhase();
      },
      update(dt, realDt) {
        if (disposed) return;
        st.time += realDt;
        for (let i = timers.length - 1; i >= 0; i--) {
          const tm = timers[i];
          if (tm.fn ? tm.fn() : (tm.t -= realDt) <= 0) { timers.splice(i, 1); tm.r(); }
        }
        if (innerWidth !== st.lastW || innerHeight !== st.lastH) applyLayout(st.layoutPhase);
        let fdt = dt;
        if (st.hitstop > 0) { st.hitstop -= realDt; fdt = 0; }
        if (st.phase === 'waikru' && wk) {
          const pr = [0, 1].map((i) => { const p = input.p(i); return [p.pressed('l0'), p.pressed('l1'), p.pressed('l2')]; });
          wk.update(realDt, pr);
        }
        if (fight && (st.phase === 'ronda' || st.phase === 'presenta' || st.phase === 'descanso' || st.phase === 'final')) {
          const live = st.phase === 'ronda' && !st.ko;
          for (let i = 0; i < 2; i++) {
            const f = fighters[i];
            let it = { block: false };
            if (live) {
              if (st.players === 2 || i === 0) it = humanIntent(i);
              else if (ai) it = ai.intent(fdt);
            }
            f.applyIntent(it, fight);
          }
          fight.update(fdt);
          if (st.phase === 'final' && !st.ko) { const m = (f0x() + f1x()) / 2; fighters[0].x += (m - 0.75 - fighters[0].x) * Math.min(1, realDt * 2); fighters[1].x += (m + 0.75 - fighters[1].x) * Math.min(1, realDt * 2); }
          if (live) st.tRound -= dt;
          if (st.phase !== 'final') { capa.updateHud(fighters, st.round, ROUNDS, st.tRound); capa.setDevice(input.lastDevice, st.players); }
        } else {
          for (const f of fighters) if (f) idleAnim(f, fdt);
        }
        for (const f of fighters) if (f) placeFighter(f);
        if (st.players === 1 && fighters[0]) setGhost(fighters[0], st.camMode === 'fight' && innerHeight > innerWidth ? 0.55 : 1);
        // destellos
        for (let i = 0; i < fighters.length; i++) {
          const f = fighters[i]; if (!f) continue;
          if (st.flashT[i] > 0) { st.flashT[i] -= realDt; flash(f.ch, f.gear, Math.max(0, st.flashT[i]) * 9, '#ffffff'); if (st.flashT[i] <= 0) flash(f.ch, f.gear, 0); }
          if (f.crit > 0) {
            const v = 0.6 + Math.sin(st.time * 20) * 0.4;
            f.gear.gloveMat.emissive.set('#ffb703'); f.gear.gloveMat.emissiveIntensity = 0.8 + v * 0.6;
            if (!f.tell) { f.gear.setAura('gloveL', v * 0.8, '#ffd23f'); f.gear.setAura('gloveR', v * 0.8, '#ffd23f'); }
          } else if (f._critWas) { f.gear.gloveMat.emissiveIntensity = 0; if (!f.tell) f.gear.clearAuras(); }
          f._critWas = f.crit > 0;
        }
        // árbitro
        const f0 = fighters[0], f1 = fighters[1];
        if (f1) {
          const mid = (f0.x + f1.x) / 2;
          let tx = mid, tz = -2.3;
          if (refSt.mode === 'stop') { tz = -0.55; refAnim.base = () => POSES.refStop; }
          else if (refSt.mode === 'wave') { tz = -0.9; tx = st.ko ? st.ko.loser.x - st.ko.loser.dir * 0.6 : mid; refAnim.base = (t) => ({ ...POSES.refWave, lsz: 1.6 + Math.sin(t * 9) * 0.7, rsz: -1.6 - Math.sin(t * 9) * 0.7 }); }
          else if (refSt.mode === 'raise' && refSt.winner) { tz = -0.55; tx = refSt.winner.x - refSt.winner.dir * 0.05 + (refSt.winner.idx === 0 ? 0.42 : -0.42); refAnim.base = () => (refSt.winner.idx === 0 ? { ...POSES.refRaiseR, rsz: 0.2, rex: -0.4, lsz: 2.9, lex: -0.05 } : POSES.refRaiseR); }
          else refAnim.base = (t) => ({ ...POSES.refIdle, hy: 0.8 + Math.sin(t * 3) * 0.01 });
          const k = 1 - Math.exp(-3 * realDt);
          refSt.x += (tx - refSt.x) * k; refSt.z += (tz - refSt.z) * k;
          ref.group.position.set(refSt.x, RING_Y, refSt.z);
          ref.group.rotation.y = 0;
        } else ref.group.position.set(0, RING_Y, -1.6);
        refAnim.update(realDt, st.time);
        if (compi) compiAnim.update(realDt, st.time);
        // cámaras
        updateCam(rig0, 0, realDt);
        if (st.split) updateCam(rig1, 1, realDt);
        // ambiente
        st.excite = Math.max(0.2, st.excite - realDt * 0.25);
        estadio.update(realDt, st.phase === 'waikru' ? 0.35 : st.excite);
        if (st.crowd) st.crowd.set({ vol: 0.05 + st.excite * 0.12 });
        audio.intensity(st.excite);
        fx.update(dt);
        for (const r of rings) {
          if (r.t >= 1) continue;
          r.t += realDt / 0.22;
          const k = Math.min(1, r.t);
          r.m.scale.setScalar(r.s * (1 + k * 4));
          r.m.material.opacity = (1 - k) * 0.9;
          r.m.quaternion.copy(cam0.quaternion);
          if (r.t >= 1) r.m.visible = false;
        }
        // lienzo del wai kru
        if (st.phase === 'waikru' && wk && st.L) wk.draw(capa.lienzo, st.L.lanes, { keyboard: input.lastDevice !== 'touch', humans: humanIdx() });
        expose();
      },
      render(renderer) {
        const W = innerWidth, H = innerHeight;
        if (st.split) {
          const sh = engine.shakeAmt > 0.001 ? engine.shakeAmt : 0;
          const ox = (Math.random() - 0.5) * sh * 0.6, oy = (Math.random() - 0.5) * sh * 0.6;
          renderer.setScissorTest(true);
          cam0.aspect = W / (H / 2); cam0.updateProjectionMatrix();
          renderer.setViewport(0, 0, W, H / 2); renderer.setScissor(0, 0, W, H / 2);
          renderer.render(scene, cam0);
          cam1.aspect = W / (H / 2); cam1.updateProjectionMatrix();
          cam1.position.x += ox; cam1.position.y += oy;
          renderer.setViewport(0, H / 2, W, H / 2); renderer.setScissor(0, H / 2, W, H / 2);
          renderer.render(scene, cam1);
          cam1.position.x -= ox; cam1.position.y -= oy;
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, W, H);
        } else {
          cam0.aspect = W / H; cam0.updateProjectionMatrix();
          renderer.render(scene, cam0);
        }
      },
      resize() { /* la disposición se recalcula en update */ },
      dispose() {
        disposed = true;
        for (const tm of timers) tm.r();
        timers.length = 0;
        if (st.menu) st.menu.close();
        if (st.crowd) st.crowd.stop();
        capa.dispose();
        fx.dispose();
        disposeTree(scene);
        if (window.__ruta) window.__ruta.etapa = null;
      },
    };

    function expose() {
      if (!window.__ruta) return;
      const fs = fighters.filter(Boolean).map((f) => ({
        hp: +f.hp.toFixed(1), hpMax: f.hpMax, st: Math.round(f.st), x: +f.x.toFixed(2), action: f.action ? f.action.name : null,
        actionT: f.action ? +f.action.t.toFixed(3) : 0, impactIn: f.action && !f.action.hit ? +((f.action.mv.startup / f.action.speed) - f.action.t).toFixed(3) : null,
        blocking: f.blocking, dodging: f.dodging, stun: +f.stun.toFixed(2), crit: +f.crit.toFixed(2), ko: f.ko, tell: f.tell ? { pat: f.tell.pat, left: +(f.tell.dur - f.tell.t).toFixed(3) } : null,
        stats: { ...f.stats },
      }));
      window.__ruta.etapa = {
        id: 'muaythai', phase: st.phase, players: st.players, round: st.round, tRound: +st.tRound.toFixed(2),
        fighters: fs, queue: ai && ai.queue.length ? ai.queue.map((q) => q[0]) : [],
        waikru: wk && st.phase === 'waikru' ? wk.snapshot() : null,
        waiPrec: st.waiPrec, waiPerfect: st.waiPerfect, split: st.split,
        result: st.result, finished: !!st.result,
      };
    }

    applyLayout('none');
    if (new URLSearchParams(location.search).has('mtsalto')) window.__mtDebug = { fighters, POSES, st, ref };
    return inst;
  },
};
