// ETAPA 5 · MACAO — Persecución de neón.
// {0} y {1} van en un cochecito alquilado hacia el muelle del ferry. El Taxista Zhou (simpático,
// cabezota) cree que le habéis quitado el último cliente y os persigue para llegar antes.
// Carrera A→B: puentes con saltos, casco antiguo con 4 atajos (callejones, escaleras, mercado),
// derrapes que cargan el turbo, chispas al rozar las vallas, retrovisor con el taxi.
import * as THREE from 'three';
import { Road } from '../../core/carretera.js';
import { Particles } from '../../core/engine.js';
import { makeSky, damp, clamp, fmtTime, disposeTree, angleDiff } from '../../core/util.js';
import { buildLayout } from './trazado.js';
import { buildWorld } from './mundo.js';
import { makeCar, makeTaxi, makeBuses } from './vehiculos.js';
import { asphaltTex, cobbleTex } from './texturas.js';
import { makeMacaoUI, ZHOU } from './hud-macao.js';

const CAR_HALF = 0.95;
const G = 26;
const CRUISE = 27, TURBO_V = 41, MINI_V = 34;
const ZHOU_LOOK = { skin: '#e0ac7e', hair: '#2b1a12', shirt: '#ffffff', pattern: 3, shorts: '#2e2a4a', cap: '#5a189a', glasses: true, hairStyle: 3 };

export default {
  id: 'macao',
  music: 'macao',
  ghost: true,
  controls: {
    joystick: 'steer',
    buttons: [
      { id: 'boost', label: 'TURBO', keys: ['ShiftLeft', 'ShiftRight', 'KeyX'], pad: [0, 5], color: '#ffb703', size: 'big', pos: { right: 22, bottom: 30 } },
      { id: 'drift', label: 'DERRAPE', keys: ['Space', 'KeyZ', 'KeyC'], pad: [2, 4], color: '#9b5de5', pos: { right: 140, bottom: 26 } },
      { id: 'brake', label: 'FRENO', keys: ['KeyS', 'ArrowDown'], pad: [1, 6], color: '#3a86ff', size: 'small', pos: { right: 44, bottom: 152 } },
    ],
  },
  intro: [
    { who: 1, text: 'Coche alquilado, mapa en el móvil y el último ferry en nada. Todo controlado.' },
    { who: 'Taxista Zhou', text: '¡Eh, vosotros! ¡Ese señor de la maleta iba a subir a MI taxi!' },
    { who: 0, text: 'Pero si solo le hemos preguntado la hora…' },
    { who: 'Taxista Zhou', text: '¡Pues ahora llego antes que vosotros al muelle! ¡Por orgullo profesional!' },
    { who: 1, text: '{0}, pisa. Y si ves flechas rosas de neón… es un atajo.' },
  ],

  async create(ctx) {
    const { rng, engine } = ctx;
    const q = engine.q;
    const scene = new THREE.Scene();
    const sky = makeSky('#0e0424', '#4a1f6e', '#25103f');
    scene.add(sky);
    scene.fog = new THREE.Fog('#2c1548', 60, 480 * (q.drawDistance || 1));
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4200);
    const mirrorCam = new THREE.PerspectiveCamera(48, 3, 0.5, 220);
    const hemi = new THREE.HemisphereLight('#c0aaff', '#40245a', 1.35); scene.add(hemi);
    const moon = new THREE.DirectionalLight('#d4c4ff', 1.15); moon.castShadow = true;
    moon.shadow.mapSize.set(q.shadowSize || 1024, q.shadowSize || 1024);
    Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
    moon.shadow.bias = -0.0008;
    scene.add(moon, moon.target);

    // ── trazado ──
    const L0 = buildLayout(rng);
    const toV = (p) => new THREE.Vector3(p.x, p.y, p.z);
    const main = new Road(L0.pts.map(toV), { width: 10, shoulder: 0, texture: asphaltTex() });
    main.asphalt.material.roughness = 0.38; main.asphalt.material.metalness = 0.25;
    scene.add(main.mesh);
    const ratio = L0.total / main.length;
    const kinds = L0.pts.map((p) => p.kind), kS = L0.pts.map((p) => p.s);
    const kindAt = (s) => {
      const t = s * ratio; let lo = 0, hi = kS.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (kS[m] < t) lo = m + 1; else hi = m; }
      return kinds[lo];
    };
    const cob = cobbleTex();
    const shortcuts = L0.shortcuts.map((sc) => {
      const road = new Road(sc.pts.map(toV), { width: 6, shoulder: 0, texture: cob });
      road.asphalt.material.roughness = 0.5; road.asphalt.material.metalness = 0.15;
      road.asphalt.position.y = 0.01;
      scene.add(road.mesh);
      return { road, type: sc.type, sA: main.locate(sc.a, -1).s, sB: main.locate(sc.b, -1).s, len: road.length };
    });
    const finishS = main.length - 24;
    const world = buildWorld({ scene, rng, main, kindAt, shortcuts, events: L0.events, q, makeCharacter: ctx.makeCharacter, finishS });
    const roads = [{ road: main, main: true }, ...shortcuts.map((sc) => ({ road: sc.road, sc }))];

    // velocidad máxima del taxi según la curva que viene
    const vCurve = new Float32Array(main.n + 1);
    for (let i = 0; i <= main.n; i++) {
      const a = main.tans[Math.max(0, i - 2)], b = main.tans[Math.min(main.n, i + 2)];
      const ang = Math.acos(clamp(a.dot(b), -1, 1));
      const ds = main.dist[Math.min(main.n, i + 2)] - main.dist[Math.max(0, i - 2)];
      const r = ang > 1e-4 ? ds / ang : 1e4;
      vCurve[i] = Math.min(45, Math.sqrt(46 * r));
    }
    const vAhead = new Float32Array(main.n + 1);
    for (let i = 0; i <= main.n; i++) { let m = 99; for (let k = 0; k < 9 && i + k <= main.n; k++) m = Math.min(m, vCurve[i + k]); vAhead[i] = m; }
    const idxAt = (s) => clamp(Math.round((s / main.length) * main.n), 0, main.n);

    // ── vehículos ──
    const car = makeCar({ people: [ctx.looks[0], ctx.looks[1]], makeCharacter: ctx.makeCharacter });
    scene.add(car.group);
    const taxi = makeTaxi({ makeCharacter: ctx.makeCharacter, look: ZHOU_LOOK });
    scene.add(taxi.group);
    let ghostCar = null;
    if (ctx.ghost.data) { ghostCar = makeCar({ color: '#bde0fe', lights: false }); scene.add(ghostCar.group); ctx.ghost.spawn(ghostCar.group); }

    const buses = [];
    for (let s = 230; s < finishS - 160; s += rng.range(150, 220)) buses.push({ s, lat: rng() < 0.7 ? -2.5 : 2.5, v: rng.range(8, 11), passed: false, hitCD: 0 });
    const busMesh = makeBuses(scene, buses.length);

    const fxA = new Particles(scene, 1100, { additive: true, size: 0.32 });
    const fx = new Particles(scene, 300, { size: 0.5 });
    const ui = makeMacaoUI(ctx.hud);

    // ── estado ──
    const st = {
      running: false, done: false, win: false, t: 0, endT: 0, finishCalled: false,
      road: 0, hint: -1, qs: 0, lat: 0, prog: 30,
      yaw: 0, velYaw: 0, speed: 0, y: 0, vy: 0, air: false, airT: 0, camY: 0,
      boostT: 0, miniT: 0, turbo: 1, drifting: false, driftT: 0, driftDir: 0,
      scrape: false, scrapeOff: 1, combo: 0, lastScrape: -99, maxCombo: 0, scrapes: 0,
      shortcuts: 0, scDone: new Set(), crates: 0, jumps: 0, crashes: 0, nearMiss: 0, invuln: 0,
      cheerT: 0, brakeK: 0, lead: 0, drifts: 0, hintShown: false, wheelSpin: 0,
    };
    // primer intento (sin estrellas aún): Zhou va algo más tranquilo
    const firstTry = !(ctx.best && ctx.best.stars > 0);
    const zhouBase = firstTry ? 27.7 : 28.6, zhouRubber = firstTry ? 2.6 : 3.4;
    const tx = { s: 10, lat: 2.5, v: 0, y: 0, vy: 0, air: false, yaw: 0, latV: 0, honkT: 3, talkT: 6, mode: 'chase', wasAhead: false, bumpCD: 0, wheelSpin: 0, finished: false };
    {
      const a = main.at(st.prog);
      car.group.position.copy(a.p).addScaledVector(a.n, -2.5);
      st.yaw = st.velYaw = Math.atan2(a.t.x, a.t.z); st.lat = -2.5; st.qs = st.prog;
      car.group.rotation.y = st.yaw;
    }
    const snd = { engine: ctx.audio.loop('engine'), taxi: ctx.audio.loop('engine'), waves: ctx.audio.loop('waves'), screech: screechLoop(ctx.audio) };
    const pos = car.group.position;
    const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), size2 = new THREE.Vector2();
    const fwd = new THREE.Vector3();
    // gritos y burbuja nunca a la vez: el grito corta la burbuja y la siguiente frase espera a que acabe el grito
    let lastShout = -9, pendingSay = null;
    const say = (list) => {
      const t = Array.isArray(list) ? list[Math.floor(Math.random() * list.length)] : list;
      tx.talkT = 7 + Math.random() * 4;
      if (performance.now() - lastShout < 1150) pendingSay = t; else ui.say(t);
    };
    const shout = (txt, o) => { lastShout = performance.now(); ui.hideBubble(); ctx.shout(txt, o); };

    // ── ayudas ──
    function routePoint(d) {
      const preferSc = !(window.__macaoBot && window.__macaoBot.atajos === false);
      const R = roads[st.road];
      if (R.main) {
        const s = st.qs + d;
        if (preferSc) for (const sc of shortcuts) {
          if (st.qs > sc.sA - 40 && st.qs < sc.sA + 30 && s > sc.sA) {
            const qs = sc.road.locate(pos, -1);
            if (Math.abs(qs.lateral) < 7) return sc.road.at(Math.min(qs.s + d, sc.len)).p;
          }
        }
        return main.at(s).p;
      }
      const s = st.qs + d;
      if (s <= R.road.length) return R.road.at(s).p;
      return main.at(R.sc.sB + (s - R.road.length)).p;
    }
    function locateBest() {
      // carretera en la que estoy: la actual si voy bien centrado; si no, la que me quede más centrada
      const cur = roads[st.road];
      const qc = cur.road.locate(pos, cur.main && st.hint >= 0 ? st.hint : -1);
      const lim = (R, qq) => R.road.width / 2 + (R.main ? (kindAt(qq.s) === 'bridge' ? 0.3 : 1.0) : 0.6);
      const valid = (R, qq) => R.main || (qq.s > 0.05 && qq.s < R.road.length - 0.05);
      let best = st.road, bq = qc, br = valid(cur, qc) ? Math.abs(qc.lateral) / lim(cur, qc) : 9;
      if (br > 0.75) {
        roads.forEach((R, i) => {
          if (i === st.road) return;
          const qq = R.road.locate(pos, -1);
          if (!valid(R, qq)) return;
          const r = Math.abs(qq.lateral) / lim(R, qq);
          if (r < br - 0.05) { best = i; bq = qq; br = r; }
        });
      }
      if (best !== st.road) onSwitch(st.road, best, qc);
      st.road = best;
      if (roads[best].main) st.hint = bq.i;
      return { R: roads[best], qq: bq, lim: lim(roads[best], bq) };
    }
    function onSwitch(from, to, qFrom) {
      const F = roads[from];
      if (!F.main && qFrom.s > F.road.length * 0.75 && !st.scDone.has(from)) {
        st.scDone.add(from); st.shortcuts++;
        ctx.audio.sfx('coin', { pitch: 1.2 }); ctx.audio.sfx('star');
        shout(`¡ATAJO! ${st.shortcuts}`, { size: 'peque', color: '#ff70d8' });
        st.turbo = Math.min(3, st.turbo + 0.6); st.cheerT = 1.4; ctx.vibrate(30);
        if (st.shortcuts >= 3) ctx.sticker('atajo');
        if (Math.random() < 0.8) say(ZHOU.shortcut);
      }
    }
    function vertical(o, groundY, dt) {
      const prevGround = o._g ?? groundY; o._g = groundY;
      o.vy -= G * dt; o.y += o.vy * dt;
      let landed = 0;
      if (o.y <= groundY) {
        if (o.air) landed = o.airT || 0;
        o.y = groundY; o.vy = Math.max(o.vy, dt > 0 ? Math.min(12, (groundY - prevGround) / dt) : 0); o.air = false; o.airT = 0;
      } else if (o.y - groundY > 0.12) { o.air = true; o.airT = (o.airT || 0) + dt; }
      return landed;
    }
    function scrapeEvent(where, side) {
      if (st.scrapeOff > 0.25) {
        st.combo = st.t - st.lastScrape < 5 ? st.combo + 1 : 1;
        st.scrapes++; st.lastScrape = st.t;
        st.maxCombo = Math.max(st.maxCombo, st.combo);
        st.turbo = Math.min(3, st.turbo + 0.12);
        ctx.audio.sfx('hit', { vol: 0.35, pitch: 1.6 + Math.min(st.combo, 10) * 0.05 });
        if (st.combo >= 2) { ctx.hud.set('combo', `✦ CHISPAS ×${st.combo}`, 'izq'); ctx.hud.pop('combo'); }
        if (st.combo === 5) shout('¡CHISPAS ×5!', { size: 'peque', color: '#ffd166' });
        if (st.combo >= 10) { if (st.combo === 10) shout('¡LLUVIA DE CHISPAS!', { size: 'peque', color: '#ffd166' }); ctx.sticker('chispas'); }
      }
      st.scrapeOff = 0; st.scrape = true;
      if (st.frame % 2 === 0) fxA.emit(2, where, { colors: ['#fff3b0', '#ffd166', '#ff9f1c', '#ffffff'], vel: { x: side.x * 2 - fwd.x * 3, y: 2.5, z: side.z * 2 - fwd.z * 3 }, velSpread: 2.5, life: 0.3, size: 0.14, gravity: -14 });
    }
    function crash(msg) {
      st.crashes++; st.combo = 0; ctx.hud.remove('combo');
      ctx.engine.shake(0.7); ctx.audio.sfx('crash'); ctx.vibrate(70);
      shout(msg, { size: 'peque', color: '#ff6f61' });
      st.invuln = 0.8;
    }

    // una sola fórmula de ventaja (segundos que tardaría el taxi en llegar a donde estoy)
    function leadNow() { return (Math.min(st.prog, finishS) - tx.s) / Math.max(tx.v, 12); }
    function updateHud() {
      const gap = st.prog - tx.s;
      const lead = st.done ? st.lead : leadNow();
      let text, alert = false;
      if (!st.running && !st.done) text = '¡A POR EL FERRY!';
      else if (st.done) { text = st.win ? `VENTAJA +${st.lead.toFixed(1)} s` : '¡EL TAXI LLEGA ANTES!'; alert = !st.win; }
      else if (gap < 0) { text = '¡TE HA ADELANTADO!'; alert = true; }
      else if (gap < 16) { text = '¡TE ALCANZA!'; alert = true; }
      else text = `VENTAJA +${lead.toFixed(1)} s`;
      if (st.done && st.hudFrozen) return;
      if (st.done) st.hudFrozen = true;
      ui.route(clamp(st.prog / finishS, 0, 1), clamp(tx.s / finishS, 0, 1), text, alert);
      ui.turbo(st.turbo);
      ctx.hud.set('tiempo', `⏱ ${fmtTime(st.t)}`, 'izq');
      ctx.hud.set('atajos', `↱ ${st.shortcuts}/4`, 'izq');
      if (st.combo >= 2 && st.t - st.lastScrape > 5) { st.combo = 0; ctx.hud.remove('combo'); }
    }
    updateHud();

    const state = window.__ruta ? (window.__ruta.etapa = {}) : {};
    // solo para pruebas: teletransporte a un atajo (tipo) o a un punto de la principal (s)
    state.ir = (tipo, u = 0.3) => {
      const k = roads.findIndex((R) => (R.sc ? R.sc.type : 'principal') === tipo);
      const R = roads[Math.max(0, k)];
      const a = R.road.at(R.main ? u : R.road.length * u);
      pos.copy(a.p); st.y = a.p.y; st._g = a.p.y; st.vy = 0; st.yaw = st.velYaw = camYaw = Math.atan2(a.t.x, a.t.z); st.road = Math.max(0, k); st.hint = -1;
      camera.position.set(pos.x - a.t.x * 7, pos.y + 2.7, pos.z - a.t.z * 7);
    };
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    let camYaw = st.yaw, introT = 0;
    camera.position.copy(pos).add(new THREE.Vector3(6, 3, -8));

    const inst = {
      scene, camera,
      async start() {
        await ctx.intro();
        st.running = true;
        ctx.raceStart(car.group);
        tx.v = 6;
        say(ZHOU.start);
        ctx.audio.sfx('horn');
        const touch = ctx.input.lastDevice === 'touch';
        ctx.toast(touch ? 'Mantén <b>DERRAPE</b> en las curvas: carga el <b>TURBO</b>' : '<b>Espacio</b> derrape · <b>Shift</b> turbo · <b>S</b> freno', 3200);
      },
      update(dt, realDt) {
        const t = engine.elapsed;
        world.update(t, dt);
        fxA.update(dt); fx.update(dt);
        const inp = ctx.input;
        st.invuln -= dt; st.scrapeOff += dt; st.cheerT -= dt; st.frame = (st.frame || 0) + 1;
        fwd.set(Math.sin(st.velYaw), 0, Math.cos(st.velYaw));

        // ── coche del jugador ──
        let steer = 0, braking = false, drifting = false;
        if (st.running && !st.done) {
          st.t += dt;
          // volante suavizado (el teclado es todo o nada; el joystick casi no lo nota)
          st.steerS = damp(st.steerS || 0, inp.x, Math.abs(inp.x) < Math.abs(st.steerS || 0) ? 14 : 8, dt);
          steer = st.steerS;
          braking = inp.down('brake') || inp.y < -0.5;
          const wantDrift = inp.down('drift') && st.speed > 12 && !braking;
          if (wantDrift && !st.drifting) { st.driftDir = Math.sign(steer) || Math.sign(angleDiff(st.velYaw, st.yaw)) * -1 || 0; st.driftT = 0; ctx.audio.sfx('whoosh', { vol: 0.5 }); }
          if (!wantDrift && st.drifting) {
            if (st.driftT > 0.15) st.drifts++;
            if (st.driftT > 0.9) { st.miniT = 0.9; ctx.audio.sfx('boost', { vol: 0.6 }); shout('¡MINI TURBO!', { size: 'peque', color: '#c77dff' }); ctx.engine.shake(0.2); }
          }
          st.drifting = drifting = wantDrift;
          if (inp.pressed('boost')) {
            if (st.turbo >= 1 && st.boostT <= 0) {
              st.turbo -= 1; st.boostT = 1.7; ctx.audio.sfx('boost'); shout('¡TURBO!', { size: 'peque', color: '#ffb703' }); ctx.engine.shake(0.35); ctx.vibrate(40); st.cheerT = 1;
            } else if (st.turbo < 1) ctx.audio.sfx('click', { vol: 0.5, pitch: 0.6 });
          }
        } else if (st.done) braking = true;
        st.boostT -= dt; st.miniT -= dt;
        let maxV = st.boostT > 0 ? TURBO_V : st.miniT > 0 ? MINI_V : CRUISE;
        let target = maxV;
        if (drifting) target = maxV * 0.88;
        if (braking) target = st.done ? 0 : 9;
        if (!st.running && !st.done) target = 0;
        const rate = target > st.speed ? (st.boostT > 0 ? 2.6 : 0.75) : braking ? (st.done ? 2.6 : 2.4) : 1.2;
        st.speed = damp(st.speed, target, rate, dt);
        // giro
        const sp = clamp(st.speed / 10, 0.25, 1);
        if (drifting) {
          st.driftT += dt;
          const eff = clamp(steer + st.driftDir * 0.4, -1, 1);
          st.yaw -= eff * 2.6 * sp * dt;
          st.turbo = Math.min(3, st.turbo + dt * 0.36);
        } else st.yaw -= steer * 2.15 * sp * dt;
        if (st.done) { const qq = main.locate(pos, st.hint); st.yaw += angleDiff(st.yaw, Math.atan2(qq.t.x, qq.t.z)) * (1 - Math.exp(-dt * 2)); }
        const grip = drifting ? 3.4 : 10;
        st.velYaw += angleDiff(st.velYaw, st.yaw) * (1 - Math.exp(-grip * dt));
        fwd.set(Math.sin(st.velYaw), 0, Math.cos(st.velYaw));
        pos.addScaledVector(fwd, st.speed * dt);

        // carretera y paredes
        const { R, qq, lim } = locateBest();
        st.qs = qq.s; st.lat = qq.lateral;
        if (R.main && qq.s > main.length - 4) st.speed = Math.min(st.speed, 2);
        st.prog = R.main ? qq.s : R.sc.sA + (qq.s / R.road.length) * (R.sc.sB - R.sc.sA);
        const half = lim - CAR_HALF;
        st.scrape = false;
        if (Math.abs(qq.lateral) > half) {
          const sgn = Math.sign(qq.lateral);
          pos.addScaledVector(qq.n, -sgn * (Math.abs(qq.lateral) - half));
          st.lat = sgn * half;
          const tanYaw = Math.atan2(qq.t.x, qq.t.z);
          const rel = angleDiff(tanYaw, st.velYaw);
          const into = Math.sin(rel) * -sgn; // >0 si voy contra la pared
          const impact = Math.max(0, into) * st.speed;
          if (impact > 11 && st.invuln <= 0) { st.speed *= 0.55; crash('¡PUM!'); }
          else st.speed *= 1 - 0.3 * dt;
          st.velYaw += angleDiff(st.velYaw, tanYaw) * Math.min(1, 6 * dt + (impact > 11 ? 0.6 : 0));
          st.yaw += angleDiff(st.yaw, tanYaw) * Math.min(1, 3 * dt);
          if (st.running && !st.done) {
            tmpV.copy(pos).addScaledVector(qq.n, sgn * CAR_HALF); tmpV.y = st.y + 0.45;
            scrapeEvent(tmpV, qq.n.clone().multiplyScalar(-sgn));
          }
        }
        // altura (saltos de los puentes y escaleras)
        const ground = qq.y + (R.sc && R.sc.type === 'escaleras' && qq.y > 0.05 ? Math.abs(Math.sin(qq.s * 4)) * 0.06 : 0);
        const landed = vertical(st, ground, dt);
        if (landed > 0.45 && st.running) {
          st.jumps++; ctx.engine.shake(0.45 + landed * 0.3); ctx.audio.sfx('crash', { vol: 0.5, pitch: 1.3 }); ctx.vibrate(40);
          shout(landed > 0.9 ? `¡VUELO DE ${landed.toFixed(1)} s!` : '¡QUÉ BOTE!', { size: 'peque', color: '#ffd166' });
          st.turbo = Math.min(3, st.turbo + 0.3); st.cheerT = 1.2;
          fxA.emit(16, tmpV.copy(pos).setY(st.y + 0.1), { colors: ['#ffd166', '#ff9f1c', '#fff'], velSpread: 7, vel: { x: 0, y: 2, z: 0 }, life: 0.5, size: 0.25, gravity: -12 });
          if (Math.random() < 0.35) say(ZHOU.jump);
        }
        if (st.air && st.airT > 0.35 && st.airT < 0.37 && st.vy < 2 && st.running) engine.slowmo(0.35, 0.45);
        pos.y = st.y;
        car.group.rotation.y = st.yaw;
        const slip = angleDiff(st.velYaw, st.yaw);
        car.group.rotation.z = damp(car.group.rotation.z, -steer * 0.05 + slip * 0.12, 8, dt);
        car.group.rotation.x = damp(car.group.rotation.x, st.air ? clamp(-st.vy * 0.03, -0.25, 0.25) : 0, 6, dt);
        st.wheelSpin += st.speed * dt / 0.36;
        car.wheels.forEach((w, i) => { w.rotation.x = st.wheelSpin; if (i < 2) w.rotation.y = steer * 0.4; });
        if (st.cheerT > 0) car.copilot.pose('cheer', t); else car.copilot.pose('sit', t);
        st.brakeK = damp(st.brakeK, braking || drifting ? 1 : 0, 12, dt);
        car.setBrake(st.brakeK);

        // efectos del coche
        const right = tmpV2.set(-Math.cos(st.yaw), 0, Math.sin(st.yaw)); // derecha del coche
        const back = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
        // derrape: chispitas pegadas a las ruedas traseras, muy cortas (nada de estela que llene la pantalla)
        if (drifting && Math.abs(slip) > 0.12 && !st.air && st.frame % 3 === 0) {
          const charged = st.driftT > 0.9;
          const s = st.frame % 6 === 0 ? -1 : 1;
          fxA.emit(1, tmpV.copy(pos).addScaledVector(right, s * 0.86).addScaledVector(back, 1.2).setY(st.y + 0.06), { colors: charged ? ['#c77dff', '#ffffff'] : ['#ffd166', '#ff9f1c'], vel: { x: 0, y: 0.8, z: 0 }, velSpread: 0.8, life: 0.12, size: 0.09, gravity: -10, spread: 0.1 });
        }
        if (st.boostT > 0 || st.miniT > 0) {
          if (st.frame % 2 === 0) fxA.emit(1, tmpV.copy(pos).addScaledVector(back, 2).addScaledVector(right, 0.5).setY(st.y + 0.42), { colors: ['#ffb703', '#c77dff'], vel: { x: back.x * 3, y: 0.3, z: back.z * 3 }, velSpread: 0.6, life: 0.14, size: 0.16, gravity: 0 });
          if (st.boostT > 0) for (let k = 0; k < 2; k++) {
            const side = (Math.random() - 0.5) * 12;
            fxA.emit(1, tmpV.copy(pos).addScaledVector(fwd, 10 + Math.random() * 6).addScaledVector(right, side).setY(st.y + 0.5 + Math.random() * 3.5), { color: Math.random() < 0.5 ? '#ffffff' : '#e0aaff', vel: { x: -fwd.x * 45, y: 0, z: -fwd.z * 45 }, velSpread: 0, life: 0.22, size: 0.14, gravity: 0 });
          }
        }

        // cajas de fruta del mercado
        if (R.sc && R.sc.type === 'mercado') {
          world.crates.forEach((c, i) => {
            if (!c.alive) return;
            if ((c.p.x - pos.x) ** 2 + (c.p.z - pos.z) ** 2 < 1.9) {
              c.alive = false; world.hideCrate(i); st.crates++;
              st.speed *= 0.95;
              world.throwFruit(c.p, fwd, st.speed);
              fx.emit(5, c.p, { colors: ['#ffb347', '#ff6b6b'], vel: { x: fwd.x * 3, y: 3, z: fwd.z * 3 }, velSpread: 3, life: 0.5, size: 0.18, gravity: -12 });
              ctx.audio.sfx('hit', { vol: 0.5, pitch: 1.4 }); ctx.engine.shake(0.15);
              if (st.crates % 3 === 1) shout('¡FRUTA AL AIRE!', { size: 'peque', color: '#8ac926' });
            }
          });
        }

        // ── autobuses lentos ──
        const onMain = R.main;
        buses.forEach((b, i) => {
          if (st.running) b.s += b.v * dt;
          if (b.s > finishS - 60) { b.gone = true; busMesh.set(i, tmpV.set(0, -60, 0), 0); return; }
          const a = main.at(b.s);
          const bp = tmpV.copy(a.p).addScaledVector(a.n, b.lat);
          busMesh.set(i, bp, Math.atan2(a.t.x, a.t.z));
          b.hitCD -= dt;
          if (onMain && st.running && !st.done) {
            const ds = st.prog - b.s, dl = st.lat - b.lat;
            if (Math.abs(ds) < 6.6 && Math.abs(dl) < 2.2 && b.hitCD <= 0 && st.y < 3.3 + qq.y) {
              b.hitCD = 1;
              if (ds < -2.5) { st.speed = Math.min(st.speed, b.v * 0.6); pos.addScaledVector(a.t, -0.8); crash('¡AY, EL BUS!'); if (Math.random() < 0.6) say(ZHOU.crash); }
              else { const sg = Math.sign(dl) || 1; pos.addScaledVector(a.n, sg * (2.2 - Math.abs(dl))); st.speed *= 0.85; tmpV.copy(pos).setY(st.y + 0.6); scrapeEvent(tmpV, a.n.clone().multiplyScalar(sg)); }
            }
            if (!b.passed && ds > 6.6) {
              b.passed = true;
              if (Math.abs(dl) < 3.4 && b.hitCD <= 0) { st.nearMiss++; st.turbo = Math.min(3, st.turbo + 0.15); shout('¡POR LOS PELOS!', { size: 'peque', color: '#7df9d3' }); ctx.audio.sfx('whoosh'); }
            }
            if (ds < 0) b.passed = false;
          }
        });
        busMesh.commit();

        // ── taxi del Taxista Zhou ──
        updateTaxi(dt, onMain);

        // ── carrera: meta ──
        if (st.running && !st.done) {
          if (!st.hintShown && shortcuts[0] && shortcuts[0].sA - st.prog < 110 && st.prog < shortcuts[0].sA) {
            st.hintShown = true;
          }
          // aviso de atajo ~2 s antes de cada entrada
          let warn = null;
          if (R.main) for (let k = 0; k < shortcuts.length; k++) { const d = shortcuts[k].sA - st.qs; if (d > -3 && d < Math.max(30, st.speed * 2.3) && !st.scDone.has(k + 1)) { warn = k; break; } }
          if (warn !== st.warn) {
            st.warn = warn;
            ui.warn(warn != null);
            if (warn != null) ctx.audio.sfx('bell', { vol: 0.35, pitch: 1.4 });
          }
          if (st.prog >= finishS) finishRace(true);
          else if (tx.s >= finishS) finishRace(false);
        }
        if (st.done) {
          st.endT += realDt;
          if (st.win && st.endT < 4 && Math.random() < realDt * 3.4) fireworks();
          if (st.endT > 2.6 && !st.finishCalled) { st.finishCalled = true; callFinish(); }
        }

        // sonido
        snd.engine.set({ rate: st.speed / 36 + (st.boostT > 0 ? 0.25 : 0), vol: st.running || st.done ? 0.11 : 0.04 });
        const dTaxi = car.group.position.distanceTo(taxi.group.position);
        snd.taxi.set({ rate: tx.v / 38 + 0.05, vol: clamp(0.09 - dTaxi * 0.0015, 0, 0.09) });
        snd.waves.set({ vol: kindAt(st.prog) === 'bridge' ? 0.07 : 0.015 });
        snd.screech.set(drifting && !st.air ? 0.05 + Math.min(0.06, Math.abs(slip) * 0.1) : st.scrape ? 0.035 : 0);
        ctx.audio.intensity(st.boostT > 0 ? 1 : clamp(st.speed / 40, 0, 0.8));

        // ── cámara ──
        if (!st.running && !st.done) {
          introT += realDt;
          const a = st.yaw + Math.sin(introT * 0.35) * 0.45;
          const dd = 9 - Math.min(2, introT * 0.2);
          camPos.set(pos.x + Math.sin(a) * dd, pos.y + 2.6 + Math.sin(introT * 0.4) * 0.5, pos.z + Math.cos(a) * dd);
          camera.position.lerp(camPos, 1 - Math.exp(-realDt * 3));
          camera.lookAt(pos.x - Math.sin(st.yaw) * 4, pos.y + 1.2, pos.z - Math.cos(st.yaw) * 4);
          camYaw = st.yaw;
        } else if (st.done && st.endT > 0.4) {
          // llegada: cámara delante del coche, en el lado de tierra, mirando al coche con el ferry y los fuegos detrás
          const a = main.at(Math.min(main.length, finishS + 10));
          const focus = st.win ? pos : taxi.group.position;
          const portrait = innerHeight > innerWidth;
          const dd = portrait ? 15 : 12;
          camPos.copy(focus).addScaledVector(a.t, dd).addScaledVector(a.n, -5.5); camPos.y = focus.y + (portrait ? 3.2 : 2.8);
          camera.position.lerp(camPos, 1 - Math.exp(-realDt * 2.2));
          camLook.copy(focus).addScaledVector(a.n, 3.5).addScaledVector(a.t, -3); camLook.y = focus.y + (portrait ? 5.5 : 3.2);
          camera.lookAt(camLook);
        } else {
          camYaw += angleDiff(camYaw, st.yaw + slip * 0.45) * (1 - Math.exp(-dt * 5));
          const cb = tmpV.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
          st.camY = damp(st.camY, st.y, st.air ? 3 : 9, dt);
          const dist = 6.6 + st.speed * 0.055 + (st.boostT > 0 ? 1.1 : 0);
          camPos.set(pos.x + cb.x * dist, st.camY + 2.7, pos.z + cb.z * dist);
          camera.position.lerp(camPos, 1 - Math.exp(-dt * 7));
          camLook.set(pos.x - cb.x * 7, st.camY + 1.3, pos.z - cb.z * 7);
          camera.lookAt(camLook);
        }
        camera.fov = damp(camera.fov, 62 + st.speed * 0.32 + (st.boostT > 0 ? 7 : 0), 3, realDt); camera.updateProjectionMatrix();
        for (const f of world.followers || []) { if (!f.userData.off) f.userData.off = f.position.clone(); f.position.copy(camera.position).add(f.userData.off); }
        sky.position.copy(camera.position);
        moon.target.position.copy(pos); moon.position.copy(pos).add(tmpV.set(-30, 60, 25));

        // retrovisor: solo cuando el taxi va cerca por detrás
        const gap = st.prog - tx.s;
        let mirrorOn = st.running && !st.done && gap > 2 && gap < 55 && engine.qualityName !== 'baja' && !engine.battery;
        if (mirrorOn) {
          const r = ui.mirrorRect;
          mirrorCam.aspect = r.w / r.h; mirrorCam.updateProjectionMatrix();
          const yb = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
          mirrorCam.position.set(pos.x + yb.x * 2.3, st.y + 1.35, pos.z + yb.z * 2.3);
          mirrorCam.lookAt(pos.x + yb.x * 30, st.y + 0.6, pos.z + yb.z * 30);
          mirrorCam.updateMatrixWorld();
          tmpV.copy(taxi.group.position); tmpV.y += 1; tmpV.project(mirrorCam);
          mirrorOn = tmpV.z < 1 && Math.abs(tmpV.x) < 0.9 && Math.abs(tmpV.y) < 0.95;
        }
        // histéresis: que no parpadee
        st.mirrorT = mirrorOn ? 0.6 : (st.mirrorT || 0) - realDt;
        mirrorOn = st.mirrorT > 0 && st.running && !st.done;
        st.mirror = mirrorOn;
        ui.showMirror(mirrorOn);
        // burbuja del taxista
        if (pendingSay && performance.now() - lastShout > 1150) { ui.say(pendingSay); pendingSay = null; }
        ui.bubbleStrip(mirrorOn, realDt);

        updateHud();
        Object.assign(state, {
          running: st.running, done: st.done, win: st.win, t: st.t, prog: st.prog, finish: finishS, progress: st.prog / finishS,
          speed: st.speed, lateral: st.lat, road: st.road, onShortcut: st.road > 0, shortcuts: st.shortcuts, turbo: st.turbo,
          boost: st.boostT > 0, drifting, combo: st.combo, maxCombo: st.maxCombo, scrapes: st.scrapes, jumps: st.jumps, crashes: st.crashes,
          taxiS: tx.s, taxiV: tx.v, gap, lead: st.done ? st.lead : leadNow(), air: st.air, mirror: mirrorOn, crates: st.crates,
          fantasma: !!ghostCar, atajosS: shortcuts.map((sc) => sc.sA), aviso: st.warn != null, kind: kindAt(st.prog), tipo: roads[st.road].sc ? roads[st.road].sc.type : 'principal',
        });
        if (window.__macaoBot) {
          const look = routePoint(9 + st.speed * 0.32);
          const dx = look.x - pos.x, dz = look.z - pos.z;
          state.guia = -angleDiff(st.yaw, Math.atan2(dx, dz));
          const far = routePoint(30 + st.speed * 0.6);
          state.curva = Math.abs(angleDiff(st.yaw, Math.atan2(far.x - pos.x, far.z - pos.z)));
        }
      },
      render(renderer) {
        const size = renderer.getSize(size2);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, size.x, size.y);
        renderer.render(scene, camera);
        if (st.mirror) {
          const r = ui.mirrorRect;
          const y = size.y - r.y - r.h;
          renderer.setScissorTest(true);
          renderer.setScissor(r.x, y, r.w, r.h); renderer.setViewport(r.x, y, r.w, r.h);
          scene.fog.far *= 0.5;
          renderer.render(scene, mirrorCam);
          scene.fog.far *= 2;
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, size.x, size.y);
        }
      },
      dispose() {
        for (const k in snd) snd[k].stop();
        ui.dispose();
        fxA.dispose(); fx.dispose();
        disposeTree(scene);
      },
    };

    function updateTaxi(dt, playerOnMain) {
      const running = st.running && !st.done;
      const gap = st.prog - tx.s;
      // velocidad: curva que viene + goma elástica suave
      let target = zhouBase + clamp((gap - 22) * 0.04, -2.6, zhouRubber);
      if (!running) target = st.done ? (tx.finished ? 0 : 24) : 0;
      target = Math.min(target, vAhead[idxAt(tx.s)]);
      // autobuses delante en su carril
      let latT = -2.4;
      for (const b of buses) {
        if (b.gone) continue;
        const d = b.s - tx.s;
        if (d > -6 && d < 32 && Math.abs(b.lat - tx.lat) < 2.8) { latT = b.lat > 0 ? -2.6 : 2.6; if (d < 9 && Math.abs(b.lat - tx.lat) < 2.2) target = Math.min(target, b.v); }
      }
      if (running && playerOnMain) {
        if (gap > -2 && gap < 14) { latT = st.lat > 0 ? -2.8 : 2.8; tx.honkT -= dt; if (tx.honkT <= 0) { ctx.audio.sfx('horn', { pitch: 1.1 }); tx.honkT = 2.5 + Math.random() * 2; if (!ui.talking) say(ZHOU.chase); } }
        else if (gap <= -2 && gap > -24) { latT = clamp(st.lat, -3.2, 3.2); target = Math.min(target, 27.5); } // te cierra
      }
      tx.v = damp(tx.v, target, target > tx.v ? 0.7 : 1.6, dt);
      tx.s += tx.v * dt;
      if (tx.s >= finishS) tx.finished = true;
      tx.s = Math.min(tx.s, main.length - 6);
      const prevLat = tx.lat;
      tx.lat = clamp(damp(tx.lat, latT, 1.4, dt), -3.8, 3.8);
      tx.latV = dt > 0 ? (tx.lat - prevLat) / dt : 0;
      // choque suave con el jugador
      tx.bumpCD -= dt;
      if (running && playerOnMain) {
        const ds = st.prog - tx.s, dl = st.lat - tx.lat;
        if (Math.abs(ds) < 4.1 && Math.abs(dl) < 1.95 && Math.abs(st.y - tx.y) < 1.5) {
          const qq = main.at(tx.s);
          if (Math.abs(dl) > 0.6 || Math.abs(ds) < 2) {
            const sg = Math.sign(dl) || 1, corr = 1.95 - Math.abs(dl);
            pos.addScaledVector(qq.n, sg * corr * 0.6); tx.lat -= sg * corr * 0.4;
          } else if (ds < 0) { st.speed = Math.min(st.speed, tx.v - 1); pos.addScaledVector(qq.t, -0.3); }
          else { tx.v = Math.min(tx.v, st.speed - 1); tx.s -= 0.3; }
          if (tx.bumpCD <= 0) {
            tx.bumpCD = 0.8; ctx.audio.sfx('hit', { vol: 0.6 }); ctx.engine.shake(0.25); ctx.vibrate(25);
            tmpV.copy(pos).lerp(taxi.group.position, 0.5); tmpV.y += 0.6;
            scrapeEvent(tmpV, qq.n.clone().multiplyScalar(Math.sign(dl) || 1));
            if (Math.random() < 0.7) say(ZHOU.bump);
          }
        }
      }
      // adelantamientos y charla
      if (running) {
        const ahead = tx.s > st.prog;
        if (ahead && !tx.wasAhead) { say(ZHOU.pass); ctx.audio.sfx('horn', { pitch: 1.25 }); shout('¡TE ADELANTA!', { size: 'peque', color: '#ffb703' }); }
        if (!ahead && tx.wasAhead && st.t > 3) { say(ZHOU.passed); shout('¡ADELANTADO!', { size: 'peque', color: '#c77dff' }); st.cheerT = 1.2; }
        tx.wasAhead = ahead;
        tx.talkT -= dt;
        if (tx.talkT <= 0) { if (gap > 130) say(ZHOU.far); else if (gap < 60) say(ZHOU.chase); else tx.talkT = 3; }
      }
      const a = main.at(tx.s);
      vertical(tx, a.p.y, dt);
      taxi.group.position.copy(a.p).addScaledVector(a.n, tx.lat); taxi.group.position.y = tx.y;
      taxi.group.rotation.y = Math.atan2(a.t.x, a.t.z) - tx.latV * 0.04;
      taxi.group.rotation.x = damp(taxi.group.rotation.x, tx.air ? clamp(-tx.vy * 0.03, -0.25, 0.25) : 0, 6, dt);
      tx.wheelSpin += tx.v * dt / 0.36;
      taxi.wheels.forEach((w) => { w.rotation.x = tx.wheelSpin; });
    }

    function fireworks() {
      const a = main.at(finishS + 10);
      const p = (st.win ? pos : taxi.group.position).clone().addScaledVector(a.t, -(18 + Math.random() * 30)).addScaledVector(a.n, 4 + Math.random() * 26);
      p.y += 16 + Math.random() * 18;
      const cols = [['#c77dff', '#e0aaff', '#ffffff'], ['#ffb703', '#ffd166', '#ffffff'], ['#ff70a6', '#ffb703', '#c77dff']][Math.floor(Math.random() * 3)];
      fxA.emit(110, p, { colors: cols, velSpread: 30, vel: { x: 0, y: 1, z: 0 }, life: 1.7, size: 1.35, gravity: -4, spread: 1 });
      fxA.emit(30, p, { color: '#ffffff', velSpread: 12, vel: { x: 0, y: 0, z: 0 }, life: 0.6, size: 1.6, gravity: 0, spread: 2 });
      ctx.audio.sfx('firework', { vol: 0.6 });
    }

    function finishRace(win) {
      st.done = true; st.win = win; st.running = false; st.endT = 0;
      st.drifting = false; st.boostT = 0;
      st.lead = win ? Math.max(0, leadNow()) : 0;
      ctx.input.hideTouch(); ui.warn(false);
      ui.showMirror(false);
      if (win) {
        engine.slowmo(1.1, 0.3);
        shout('¡AL FERRY!', { color: '#ffd166' });
        ctx.audio.sfx('horn', { pitch: 0.7 });
        ctx.sticker('macao');
        st.cheerT = 4;
        setTimeout(() => say(ZHOU.win), 700);
        fireworks(); fireworks();
      } else {
        shout('¡EL TAXI LLEGA ANTES!', { size: 'peque', color: '#ffb703' });
        say(ZHOU.lose);
      }
    }
    function callFinish() {
      const win = st.win;
      const lead = st.lead;
      const stars = !win ? 0 : 1 + (lead >= 3 ? 1 : 0) + (lead >= 9 && st.shortcuts >= 3 ? 1 : 0);
      const score = Math.round((win ? 1500 : 300 * (st.prog / finishS)) + lead * 120 + st.shortcuts * 300 + st.drifts * 40 + st.crates * 25 + st.jumps * 60 + st.nearMiss * 80);
      ctx.finish({
        win, stars, score, time: st.t, delay: 200,
        stats: [['Tiempo', fmtTime(st.t)], ['Ventaja', win ? `${lead.toFixed(1)} s` : '—'], ['Atajos', `${st.shortcuts}/4`], ['Saltos', st.jumps], ['Derrapes', st.drifts], ['Por los pelos', st.nearMiss]],
        moreStats: { atajos: st.shortcuts, chispas: st.scrapes },
        shareText: win ? `${lead.toFixed(1)} s de ventaja al taxi en Macao` : 'una persecución de neón en Macao',
        title: win ? (stars === 3 ? '¡Escapada de neón!' : '¡Llegáis al ferry!') : 'El Taxista Zhou gana…',
        lines: win ? [`Taxista Zhou: «${ZHOU.win}»`] : [`Taxista Zhou: «${ZHOU.lose}»`, 'Truco: las flechas rosas son atajos.'],
      });
    }
    return inst;
  },
};

// Chirrido de ruedas propio (ruido filtrado) sobre el bus de efectos del juego
function screechLoop(audio) {
  const c = audio.ctx;
  if (!c || !audio._noise || !audio.sfxBus) return { set() {}, stop() {} };
  try {
    const s = c.createBufferSource(); s.buffer = audio._noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2300; f.Q.value = 5;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(audio.sfxBus); s.start();
    let last = -1;
    return {
      set(v) { if (Math.abs(v - last) < 0.004) return; last = v; g.gain.setTargetAtTime(v, c.currentTime, 0.05); f.frequency.setTargetAtTime(2100 + Math.random() * 700, c.currentTime, 0.05); },
      stop() { g.gain.setTargetAtTime(0, c.currentTime, 0.05); setTimeout(() => { try { s.stop(); } catch (e) { /* ya parado */ } }, 300); },
    };
  } catch (e) { return { set() {}, stop() {} }; }
}
