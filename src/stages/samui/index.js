// ETAPA 2 · KOH SAMUI — Barca de cola larga.
// Circuito de boyas entre torres de roca caliza. Las olas grandes son rampas: cógelas rectas
// y con velocidad, cae limpio y ganas turbo. Tres calas escondidas detrás de rocas y arcos.
import * as THREE from 'three';
import { Particles } from '../../core/engine.js';
import { damp, clamp, fmtTime, disposeTree, angleDiff, makeRng } from '../../core/util.js';
import { createSea, createWake, createSky, MAX_BIG, BIG } from './mar.js';
import { buildWorld, CHANNEL, CALA_R } from './mundo.js';
import { buildBoat } from './barca.js';
import { mountFx } from './efectos.js';

const CRUISE = 21, TURBO_V = 33, BRAKE_V = 7, GRAV = 26;
const TIME_LIMIT = 240;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = {
  deep: '#0b5f86', mid: '#12b4c2', shallow: '#3fe2cb', sand: '#58dcc8',
  zenith: '#1d7fd6', horizon: '#9fe3f0', haze: '#c4eef2', sun: '#fff1d0',
};

export default {
  id: 'samui',
  music: 'samui',
  ghost: true,
  controls: {
    joystick: 'steer',
    buttons: [
      { id: 'boost', label: 'TURBO', keys: ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyW', 'ArrowUp'], pad: [0, 5, 7], color: '#ff9f1c', size: 'big' },
      { id: 'b', label: 'FRENO', keys: ['Space', 'KeyS', 'ArrowDown', 'KeyZ'], pad: [1, 6, 4], color: '#2ec4b6' },
    ],
  },
  intro: [
    { who: 'Nok, la de las barcas', text: 'Os dejo mi barca. Se llama Bonita. Tratádmela bien, que es de la familia.' },
    { who: 0, text: 'Tranquila, Nok. Yo he llevado un patín en la Barceloneta.' },
    { who: 1, text: 'Hay que pasar por todas las boyas. Y dicen que entre las rocas hay tres calas escondidas.' },
    { who: 'Nok, la de las barcas', text: 'Las olas grandes son rampas: cogedlas rectas y caed planos. Así gana turbo Bonita.' },
    { who: 0, text: '¿Rampas? Esto ya me gusta más.' },
  ],

  async create(ctx) {
    const { engine, audio, hud, input } = ctx;
    const q = engine.q, qName = engine.qualityName;
    const vr = makeRng((ctx.seed ^ 0x5a17) >>> 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 4000);
    const fog = { color: COLORS.haze, near: 140, far: 1100 * (q.drawDistance || 1) };
    scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
    scene.background = new THREE.Color(COLORS.haze);

    // luz: sol de tarde por delante (brillos en el agua hacia donde vamos)
    const sunDir = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();
    const hemi = new THREE.HemisphereLight('#d8f6ff', '#2f7f6a', 1.25); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff0d6', 2.6);
    sun.castShadow = !!q.shadows;
    sun.shadow.mapSize.set(q.shadowSize || 1024, q.shadowSize || 1024);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 260 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
    scene.add(sun, sun.target);

    const world = buildWorld({ scene, rng: ctx.rng, vr, quality: qName, makeCharacter: ctx.makeCharacter });
    const { path, gates, calas, L } = world;
    const sky = createSky({ zenith: COLORS.zenith, horizon: COLORS.horizon, haze: COLORS.haze, sunDir, sunCol: '#ffe9b8' });
    scene.add(sky);
    const sea = createSea({ quality: qName, mapTex: world.mapTex, mapRect: world.mapRect, colors: COLORS, sunDir, fog });
    scene.add(sea.mesh);
    const wake = createWake(qName === 'baja' ? 45 : 70);
    scene.add(wake.mesh);
    const fx = new Particles(scene, 700, { size: 0.38 });
    const sparkle = new Particles(scene, 260, { size: 0.5, additive: true });
    const ui = mountFx();

    // barca + tripulación
    const boat = buildBoat({ stripe: '#1fb5e6', wood: '#a0643a' });
    scene.add(boat.group);
    boat.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const driver = ctx.makeCharacter(ctx.looks[0]);
    driver.group.position.set(0.15, -0.28, -2.45); driver.group.scale.setScalar(0.95);
    boat.pitch.add(driver.group);
    const mate = ctx.makeCharacter(ctx.looks[1]);
    mate.group.position.set(0, -0.2, 2.15); mate.group.scale.setScalar(0.95);
    boat.pitch.add(mate.group);
    const propW = new THREE.Vector3(), tmpV = new THREE.Vector3();

    // fantasma
    let ghostBoat = null;
    if (ctx.ghost.data) { ghostBoat = buildBoat({ simple: true }); scene.add(ghostBoat.group); }

    // ───────── estado ─────────
    const start = path.at(8);
    const st = {
      t: 0, running: false, done: false, win: false, stars: 0,
      x: start.x, z: start.z, y: 0, yaw: Math.atan2(start.tx, start.tz), velYaw: 0, yawRate: 0, speed: 0, steer: 0,
      vy: 0, air: false, airT: 0, roll: 0, pitch: 0,
      turbo: 0.34, turboT: 0, gate: 0, gatesOk: 0, gatesMiss: 0, calas: 0, olas: 0, limpias: 0,
      rockHits: 0, boatHits: 0, penalty: 0, s: 8, iPath: 4, lat: 0, hitCd: 0, noTurboCd: 0,
      hinted: new Set(), hitLog: [], finishT: 0, pointAt: null, cheerT: 0,
    };
    st.velYaw = st.yaw;
    // tiempo "bueno" para las estrellas: recorrido + desvíos de las calas a buen ritmo
    const goodTime = Math.round(L / 19.6 + 9);

    // ───────── olas grandes (series que llegan por el canal) ─────────
    const series = [];
    for (let s = 150; s < L - 90; s += ctx.rng.range(115, 160)) {
      if (calas.some((c) => Math.abs(c.s - s) < 70)) continue;
      series.push({ s, n: ctx.rng.chance(0.4) ? 2 : 3, spawned: false });
    }
    const ridges = sea.big.map((b) => ({ b, active: false, age: 0, target: 0, prevAl: 0, done: false, dying: false }));
    function spawnSeries(se) {
      const free = ridges.filter((r) => !r.active);
      if (free.length < se.n) return false;
      for (let k = 0; k < se.n; k++) {
        const r = free[k], s = se.s + k * 17, a = path.at(s);
        Object.assign(r.b, { cx: a.x, cz: a.z, dx: -a.tx, dz: -a.tz, amp: 0 });
        Object.assign(r, { active: true, age: -k * 0.25, target: 1.35 + ctx.rng.range(-0.1, 0.15), prevAl: 999, done: false, dying: false });
      }
      se.spawned = true;
      if (!st.waveHint) { st.waveHint = true; ctx.shout('🌊 ¡OLAS!', { size: 'peque', color: '#7cf5e6' }); ctx.toast('Cógelas <b>rectas</b> y con velocidad: ¡a volar! Cae recto y ganas turbo ⚡', 2600); }
      else audio.sfx('whoosh', { vol: 0.5 });
      return true;
    }

    // ───────── piloto automático (solo para las pruebas: lee el estado, no toca nada) ─────────
    const wps = [];
    {
      const gl = [{ s: 0, off: 0 }, ...gates.map((g) => ({ s: g.s, off: g.off })), { s: L, off: 0 }];
      const latAt = (s) => { for (let i = 0; i < gl.length - 1; i++) if (s <= gl[i + 1].s) { const k = (s - gl[i].s) / Math.max(1, gl[i + 1].s - gl[i].s); return gl[i].off + (gl[i + 1].off - gl[i].off) * k; } return 0; };
      for (let s = 14; s <= L; s += 10) {
        if (calas.some((c) => Math.abs(c.s - s) < 36)) continue;
        const a = path.at(s), lat = latAt(s);
        wps.push({ x: a.x + a.nx * lat, z: a.z + a.nz * lat, s, cala: -1 });
      }
      for (const c of calas) {
        const a0 = path.at(c.s - 40), a1 = path.at(c.s + 40);
        const pts = [
          [a0.x + a0.nx * c.side * 10, a0.z + a0.nz * c.side * 10],
          [c.x + c.entry.x * (CALA_R + 9), c.z + c.entry.z * (CALA_R + 9)],
          [c.x + c.entry.x * (CALA_R - 4), c.z + c.entry.z * (CALA_R - 4)],
          [c.x, c.z],
          [c.x + c.exit.x * (CALA_R - 4), c.z + c.exit.z * (CALA_R - 4)],
          [c.x + c.exit.x * (CALA_R + 9), c.z + c.exit.z * (CALA_R + 9)],
          [a1.x + a1.nx * c.side * 10, a1.z + a1.nz * c.side * 10],
        ];
        const idx = wps.findIndex((w) => w.s > c.s);
        wps.splice(idx < 0 ? wps.length : idx, 0, ...pts.map(([x, z], k) => ({ x, z, s: c.s - 40 + k * 13, cala: c.idx })));
      }
    }
    let wpI = 0;
    const pilot = { steer: 0, turbo: false, brake: false };
    function runPilot() {
      while (wpI < wps.length - 1) {
        const w = wps[wpI];
        const d = Math.hypot(w.x - st.x, w.z - st.z);
        const behind = (w.x - st.x) * Math.sin(st.yaw) + (w.z - st.z) * Math.cos(st.yaw) < 0;
        if (d < (w.cala >= 0 ? 9 : 12) || (w.cala < 0 && w.s < st.s - 3) || (w.cala >= 0 && behind && d < 18)) wpI++; else break;
      }
      let w = wps[wpI];
      // perdido lejos del recorrido (y no en una cala): vuelve al centro del canal
      if (w.cala < 0 && Math.abs(st.lat) > 40) { const a = path.at(st.s + 25); w = { x: a.x, z: a.z, s: st.s + 25, cala: -1 }; }
      const desired = Math.atan2(w.x - st.x, w.z - st.z);
      const diff = angleDiff(st.yaw, desired);
      let steer = clamp(-diff * 2.4, -1, 1);
      const fx_ = Math.sin(st.yaw), fz_ = Math.cos(st.yaw);
      let blocked = false;
      const seen = new Set();
      const wSide = -(w.x - st.x) * fz_ + (w.z - st.z) * fx_;
      for (const p of [[st.x, st.z], [st.x + fx_ * 18, st.z + fz_ * 18], [st.x + fx_ * 32, st.z + fz_ * 32]]) for (const o of world.near(p[0], p[1])) {
        if (seen.has(o)) continue; seen.add(o);
        const rx = o.x - st.x, rz = o.z - st.z, ahead = rx * fx_ + rz * fz_, side = -rx * fz_ + rz * fx_;
        if (ahead > -2 && ahead < 30 && Math.abs(side) < o.r + 3.4) {
          const wd = Math.hypot(w.x - o.x, w.z - o.z);
          if (wd > o.r + 2) {
            // pasa por el lado que deja libre el obstáculo, preferiblemente hacia el objetivo
            let dir = side > 0 ? -1 : 1;
            if (Math.abs(side) < o.r * 0.5) dir = wSide > side ? 1 : -1;
            steer += dir * 1.6 * (1 - Math.max(0, ahead) / 34); blocked = true;
          }
        }
      }
      for (const bt of world.boats) {
        const rx = bt.x - st.x, rz = bt.z - st.z, ahead = rx * fx_ + rz * fz_, side = -rx * fz_ + rz * fx_;
        if (ahead > 0 && ahead < 24 && Math.abs(side) < 6) { steer += (side > 0 ? -1 : 1) * 1.2; blocked = true; }
      }
      pilot.steer = clamp(steer, -1, 1);
      pilot.brake = Math.abs(diff) > 1.1 && st.speed > 12;
      pilot.turbo = st.turbo >= 0.33 && st.turboT <= 0 && Math.abs(diff) < 0.12 && !blocked && w.cala < 0 && !st.air;
    }

    // ───────── HUD ─────────
    const turboHTML = () => {
      const segs = [0, 1, 2].map((i) => `<i><b style="transform:scaleX(${clamp(st.turbo * 3 - i, 0, 1).toFixed(2)})"></b></i>`).join('');
      return `<div class="sm-turbo ${st.turbo >= 0.33 ? 'lleno' : ''} ${st.turboT > 0 ? 'activo' : ''}"><span>TURBO</span>${segs}</div>`;
    };
    const updateHud = () => {
      const touchUI = input.lastDevice === 'touch' || input.forceTouch;
      if (st.running) ui.turboMeter(turboHTML(), touchUI); else ui.hideMeter();
      hud.set('calas', `<span class="sm-calas">${calas.map((c) => `<span class="${c.found ? 'si' : 'no'}">${c.emoji}</span>`).join(' ')}</span>`, 'izq');
      hud.set('olas', `🚩 ${st.gate}/${gates.length} <span style="opacity:.5">·</span> 🌊 ${st.olas}`, 'izq');
      hud.set('tiempo', `⏱ ${fmtTime(st.t + st.penalty)}`, 'centro');
    };
    updateHud();

    // sonido (los bucles se crean cuando el audio ya está desbloqueado)
    let sndEngine = null, sndWaves = null, sndWind = null;
    const ensureSound = () => { if (!sndEngine && audio.ready) { sndEngine = audio.loop('engine'); sndWaves = audio.loop('waves'); sndWind = audio.loop('wind'); } };

    // ───────── cámara ─────────
    const cam = { yaw: st.yaw, orbit: 0, orbitT: 0, orbitSide: 1, finishA: 0 };
    camera.position.set(st.x - Math.sin(st.yaw) * 12, 5, st.z - Math.cos(st.yaw) * 12);
    camera.lookAt(st.x, 1, st.z);

    const etapa = {
      id: 'samui', get t() { return st.t; }, get s() { return st.s; }, L, get progress() { return st.s / L; },
      get gate() { return st.gate; }, gates: gates.length, get gatesOk() { return st.gatesOk; },
      get calas() { return st.calas; }, get olas() { return st.olas; }, get speed() { return st.speed; }, get turbo() { return st.turbo; },
      get air() { return st.air; }, get running() { return st.running; }, get done() { return st.done; }, get win() { return st.win; }, get stars() { return st.stars; },
      get x() { return st.x; }, get z() { return st.z; }, get yaw() { return st.yaw; }, get rockHits() { return st.rockHits; }, get boatHits() { return st.boatHits; },
      goodTime, pilot, debugCam: null, get hitLog() { return st.hitLog; },
      debugInfo: () => ({ calas: calas.map((c) => ({ x: c.x, z: c.z, s: c.s, back: c.back, entry: c.entry })), gates: gates.map((g) => ({ x: g.x, z: g.z })), start: { x: start.x, z: start.z }, monkey: world.monkeyRock, boats: world.boats.map((b) => ({ x: b.x, z: b.z })), anchored: world.anchored.map((b) => ({ x: b.x, z: b.z })) }),
    };
    window.__ruta.etapa = etapa;

    // ───────── eventos ─────────
    function splash(x, y, z, n = 24, power = 4) {
      fx.emit(n, { x, y: y + 0.2, z }, { spread: 1.6, vel: { x: 0, y: power, z: 0 }, velSpread: power * 0.9, colors: ['#ffffff', '#e8fbff', '#bff3ff'], life: 0.9, size: 0.6, gravity: -14 });
    }
    function hit(kind, nx, nz) {
      if (st.hitCd > 0) return;
      st.hitCd = 0.6;
      if (st.hitLog.length < 40) st.hitLog.push([Math.round(st.s), Math.round(st.lat), kind, wpI]);
      engine.shake(0.55); ctx.vibrate(50);
      audio.sfx('crash');
      splash(st.x + nx * -1.5, st.y, st.z + nz * -1.5, 30, 5);
      if (kind === 'barca') { st.boatHits++; audio.sfx('horn'); ctx.shout('¡Perdón!', { size: 'peque', color: '#ffd23f' }); }
      else { st.rockHits++; ctx.shout(st.rockHits === 1 ? '¡PUM! Pobre Bonita' : '¡PUM!', { size: 'peque', color: '#ff6f61' }); }
    }
    function collideCircle(cx, cz, cr, ox, oz, orr, kind) {
      const dx = cx - ox, dz = cz - oz, d = Math.hypot(dx, dz), min = cr + orr;
      if (d >= min || d < 0.0001) return false;
      const nx = dx / d, nz = dz / d, push = min - d;
      st.x += nx * push; st.z += nz * push;
      let vx = Math.sin(st.velYaw) * st.speed, vz = Math.cos(st.velYaw) * st.speed;
      const vn = vx * nx + vz * nz;
      if (vn < 0) {
        vx -= 1.6 * vn * nx; vz -= 1.6 * vn * nz;
        const sp = Math.hypot(vx, vz);
        const hard = -vn / Math.max(1, st.speed);
        st.speed = sp * (hard > 0.45 ? 0.45 : 0.8);
        if (sp > 0.5) { st.velYaw = Math.atan2(vx, vz); st.yaw += angleDiff(st.yaw, st.velYaw) * 0.5; }
        if (hard > 0.25 || kind === 'barca') hit(kind, nx, nz);
      }
      return true;
    }
    function discover(c) {
      c.found = true; st.calas++;
      engine.slowmo(1.5, 0.28);
      cam.orbitT = 1.6; cam.orbitSide = Math.sign(angleDiff(st.yaw, Math.atan2(c.x - st.x, c.z - st.z))) || 1;
      audio.sfx('star'); audio.sfx('sticker');
      ctx.vibrate(40);
      ctx.shout(`${c.emoji} ¡CALA ${st.calas}/3!`, { color: '#7cf5e6' });
      for (let i = 0; i < 4; i++) sparkle.emit(14, { x: st.x + (Math.random() - 0.5) * 8, y: 2 + Math.random() * 3, z: st.z + (Math.random() - 0.5) * 8 }, { colors: ['#fff6a8', '#ffd23f', '#7cf5e6', '#ffffff'], vel: { x: 0, y: 3, z: 0 }, velSpread: 4, life: 1.4, gravity: -2, size: 0.6 });
      st.cheerT = 1.8;
      setTimeout(() => {
        if (st.disposed) return;
        audio.sfx('photo'); ui.flash();
        engine.snapshot().then((cv) => { if (!st.disposed) ui.polaroid(cv, c.name, 'Foto mental 📸'); });
      }, 420);
      if (st.calas === 3) { setTimeout(() => { if (!st.disposed) { ctx.shout('¡LAS TRES CALAS!', { color: '#ffd23f' }); ctx.sticker('calas'); } }, 1500); }
      updateHud(); hud.pop('calas');
    }
    function land() {
      st.air = false;
      const clean = st.airT > 0.28 && Math.abs(st.steer) < 0.5;
      splash(st.x, st.y, st.z, clean ? 30 : 44, clean ? 4 : 6);
      audio.sfx('splash');
      if (clean) {
        st.limpias++;
        st.turbo = Math.min(1, st.turbo + 0.34);
        engine.shake(0.22);
        ctx.shout(st.turbo >= 0.99 ? '¡LIMPIO! TURBO A TOPE' : '¡LIMPIO! +TURBO', { size: 'peque', color: '#ffd23f' });
        audio.sfx('coin', { pitch: 1.1 });
        
      } else {
        st.turbo = Math.min(1, st.turbo + 0.1);
        st.speed *= 0.78;
        engine.shake(0.45);
        ctx.shout('¡PLOF!', { size: 'peque', color: '#9ad7ff' });
      }
      st.pitch = clean ? -0.05 : -0.18;
    }
    function launch(power) {
      st.air = true; st.airT = 0; st.vy = power;
      st.olas++;
      audio.sfx('whoosh');
      splash(st.x, st.y, st.z, 16, 3);
      if (st.olas === 10) { ctx.sticker('surfista'); ctx.shout('¡SURFISTA!', { color: '#7cf5e6' }); }
      hud.pop('olas');
    }

    const inst = {
      scene, camera,
      async start() {
        ensureSound();
        await ctx.intro();
        ensureSound();
        st.running = true;
        ctx.raceStart(boat.group);
        if (ghostBoat && ctx.ghost.spawn(ghostBoat.group, '#9ad7ff')) ctx.toast(`👻 Fantasma: ${esc(ctx.ghost.label || 'tu mejor vuelta')}`, 1800);
        audio.sfx('horn');
      },
      update(dt, realDt) {
        try { step(dt, realDt); } catch (e) { if (!st._err) { st._err = true; console.warn('samui', e); } }
      },
      dispose() {
        st.disposed = true;
        for (const s of [sndEngine, sndWaves, sndWind]) if (s) s.stop();
        ui.dispose(); world.dispose(); sea.dispose(); wake.dispose(); fx.dispose(); sparkle.dispose();
        disposeTree(scene);
        if (window.__ruta && window.__ruta.etapa === etapa) window.__ruta.etapa = null;
      },
    };

    let tAll = 0;
    function step(dt, realDt) {
      tAll += dt;
      ensureSound();
      fx.update(dt); sparkle.update(dt);
      const playing = st.running && !st.done;
      runPilot();

      // ── control ──
      let steerIn = 0, braking = false;
      if (playing) {
        st.t += dt;
        steerIn = input.x;
        braking = input.down('b') || input.y < -0.3;
        if (input.pressed('boost')) {
          if (st.turbo >= 0.33) {
            st.turbo -= 0.333; st.turboT = Math.min(3.2, Math.max(st.turboT, 0) + 1.8);
            audio.sfx('boost'); engine.shake(0.25); ctx.vibrate(25);
            ctx.shout('¡TURBO!', { size: 'peque' });
            fx.emit(20, { x: st.x, y: st.y + 0.5, z: st.z }, { colors: ['#ffffff', '#ffe08a'], vel: { x: 0, y: 3, z: 0 }, velSpread: 5, life: 0.6 });
          } else if (st.noTurboCd <= 0) {
            st.noTurboCd = 1.2; audio.sfx('click', { pitch: 0.6 });
            ctx.toast('Sin turbo: salta olas y cae recto ⚡', 1600);
          }
        }
      }
      st.noTurboCd -= dt; st.hitCd -= dt;
      if (st.turboT > 0) st.turboT -= dt;
      const turboOn = st.turboT > 0;
      ui.turbo(turboOn && playing);
      st.steer = damp(st.steer, steerIn, 10, dt);

      // ── velocidad y giro ──
      let target = 0;
      if (playing) target = braking ? BRAKE_V : turboOn ? TURBO_V : CRUISE;
      else if (st.done) target = 0;
      const k = braking ? 2.6 : turboOn ? 2.4 : st.speed < target ? 0.9 : 0.6;
      if (!st.air) st.speed = damp(st.speed, target, k, dt);
      const turnK = clamp(st.speed / 13, 0.35, 1.1) * (st.air ? 0.3 : 1) * (braking ? 1.25 : 1);
      st.yawRate = damp(st.yawRate, -st.steer * 1.55 * turnK, 5, dt);
      st.yaw += st.yawRate * dt;
      st.velYaw += angleDiff(st.velYaw, st.yaw) * (1 - Math.exp(-(st.air ? 0.6 : 3.4) * dt));
      const vx = Math.sin(st.velYaw), vz = Math.cos(st.velYaw);
      st.x += vx * st.speed * dt; st.z += vz * st.speed * dt;
      const fxv = Math.sin(st.yaw), fzv = Math.cos(st.yaw);

      // ── colisiones ──
      const seen = new Set();
      for (const off of [2.3, -1.6]) {
        const px = st.x + fxv * off, pz = st.z + fzv * off;
        for (const o of world.near(px, pz)) {
          if (seen.has(o)) continue;
          if (collideCircle(st.x + fxv * off, st.z + fzv * off, 1.15, o.x, o.z, o.r, o.kind)) seen.add(o);
        }
      }
      for (const bt of world.boats) {
        for (const off of [2.3, -1.6]) collideCircle(st.x + fxv * off, st.z + fzv * off, 1.15, bt.x, bt.z, bt.r, 'barca');
      }
      // posición en el recorrido
      const prevS = st.s;
      const loc = path.locate(st.x, st.z, st.iPath);
      st.iPath = loc.i; st.s = loc.s; st.lat = loc.lat;
      if (Math.abs(loc.lat) > 120) {
        const a = path.at(st.s); const push = (Math.abs(loc.lat) - 120) * 0.2;
        st.x -= a.nx * Math.sign(loc.lat) * push; st.z -= a.nz * Math.sign(loc.lat) * push;
        if (st.noTurboCd <= 0) { st.noTurboCd = 2; ctx.toast('¡Por ahí es mar abierto! Vuelve a las boyas', 1600); }
      }

      // ── olas grandes ──
      for (const se of series) if (!se.spawned && st.s > se.s - 170 && st.s < se.s + 20) spawnSeries(se);
      for (const r of ridges) {
        if (!r.active) continue;
        r.age += dt;
        const b = r.b;
        if (r.age > 0) { b.cx += b.dx * 3.2 * dt; b.cz += b.dz * 3.2 * dt; }
        const rx = st.x - b.cx, rz = st.z - b.cz;
        const al = rx * b.dx + rz * b.dz, la = -rx * b.dz + rz * b.dx;
        if (al < -40 || r.age > 34) r.dying = true;
        b.amp = r.dying ? Math.max(0, b.amp - dt * 1.2) : damp(b.amp, r.age > 0 ? r.target : 0, 1.6, dt);
        if (r.dying && b.amp <= 0.001) { r.active = false; b.amp = 0; continue; }
        // cruzar la cresta (de delante hacia atrás)
        if (!r.done && r.prevAl > 0 && r.prevAl < 50 && al <= 0 && Math.abs(la) < BIG.half - 3 && !st.air && b.amp > 0.6 && playing) {
          r.done = true;
          const cosA = -(fxv * b.dx + fzv * b.dz);
          if (st.speed > 13 && cosA > 0.8) launch(4 + st.speed * 0.27);
          else if (st.speed > 6) {
            st.air = true; st.airT = 0; st.vy = 2.6; st.speed *= 0.85;
            splash(st.x, st.y, st.z, 14, 3);
            if (cosA <= 0.8) ctx.shout('¡Recta, recta!', { size: 'peque', color: '#9ad7ff' });
          }
        }
        r.prevAl = al;
      }

      // ── altura, cabeceo y balanceo con el mar de verdad ──
      const h = sea.heightAt(st.x, st.z);
      if (st.air) {
        st.airT += dt;
        st.vy -= GRAV * dt;
        st.y += st.vy * dt;
        st.pitch = damp(st.pitch, clamp(Math.atan2(st.vy, Math.max(8, st.speed)) * 1.3, -0.45, 0.55), 6, dt);
        st.roll = damp(st.roll, st.steer * 0.35, 4, dt);
        if (st.y <= h && st.vy < 0) { st.y = h; land(); }
      } else {
        const L2 = 2.6, W2 = 0.85;
        const hb = sea.heightAt(st.x + fxv * L2, st.z + fzv * L2), hs = sea.heightAt(st.x - fxv * L2, st.z - fzv * L2);
        const lx = fzv, lz = -fxv; // izquierda (+X local)
        const hl = sea.heightAt(st.x + lx * W2, st.z + lz * W2), hr = sea.heightAt(st.x - lx * W2, st.z - lz * W2);
        st.y = damp(st.y, (h + hb + hs) / 3 - 0.02, 14, dt);
        st.pitch = damp(st.pitch, Math.atan2(hb - hs, L2 * 2) - st.speed * 0.004, 7, dt);
        st.roll = damp(st.roll, Math.atan2(hl - hr, W2 * 2) * 0.7 + st.steer * 0.16 * clamp(st.speed / 20, 0, 1), 6, dt);
      }
      boat.group.position.set(st.x, st.y, st.z);
      boat.group.rotation.set(0, st.yaw, st.roll);
      boat.pitch.rotation.x = -st.pitch;
      boat.animate(tAll, st.steer, (0.3 + st.speed * 0.06) * (st.air ? 1.6 : 1), st.speed);

      // tripulación
      driver.pose('sit', tAll);
      driver.rig.armR.shoulder.rotation.x = -1.05; driver.rig.armR.elbow.rotation.x = -0.4; driver.rig.armR.shoulder.rotation.z = 0.15 - st.steer * 0.25;
      driver.rig.torso.rotation.y = -st.steer * 0.25;
      let near = null, nd = Infinity;
      for (const c of calas) { if (c.found) continue; const d = Math.hypot(c.x - st.x, c.z - st.z); if (d < nd) { nd = d; near = c; } }
      if (st.cheerT > 0 || st.air || (st.done && st.win)) {
        st.cheerT -= dt;
        mate.pose('cheer', tAll);
        if (st.air) driver.rig.armL.shoulder.rotation.z = 2.4;
      } else {
        mate.pose('idle', tAll);
        const r = mate.rig;
        r.legL.knee.rotation.x = r.legR.knee.rotation.x = 0.25 + Math.sin(tAll * 3) * 0.05;
        r.legL.hip.rotation.x = r.legR.hip.rotation.x = -0.2;
        let tx = null;
        if (near && nd < 125) tx = Math.atan2(near.x - st.x, near.z - st.z);
        else if (gates[st.gate]) tx = Math.atan2(gates[st.gate].x - st.x, gates[st.gate].z - st.z);
        if (tx !== null) {
          const rel = clamp(angleDiff(st.yaw, tx), -1.4, 1.4);
          r.torso.rotation.y = rel * 0.7; r.head.rotation.y = rel * 0.3;
          r.armR.shoulder.rotation.x = near && nd < 125 ? -1.55 : -0.2;
          r.armR.shoulder.rotation.z = near && nd < 125 ? -0.25 : -0.1;
          r.armL.shoulder.rotation.z = 0.5;
        }
      }
      // pista de cala cercana
      if (playing && near && nd < 100 && !st.hinted.has(near.idx)) {
        st.hinted.add(near.idx);
        const frases = ['¡Gaviotas dando vueltas! Ahí detrás hay algo…', '¿Eso de ahí es un arco? ¡Pasa por debajo!', '¡Mira esas rocas! Seguro que esconden una cala.'];
        ctx.toast(`<b>${esc(ctx.names[1])}:</b> ${frases[near.idx % 3]}`, 2400);
        audio.sfx('bell', { vol: 0.4 });
      }
      for (const c of calas) if (!c.found && playing && Math.hypot(c.x - st.x, c.z - st.z) < 13) discover(c);

      // ── puertas ──
      if (playing) {
        const g = gates[st.gate];
        if (g && st.s >= g.s && prevS < g.s + 30) {
          const off = st.lat - g.off;
          if (Math.abs(off) <= g.half + 1 || g.finish) {
            g.state = 1; st.gatesOk++;
            audio.sfx('coin', { pitch: 1 + (st.gatesOk % 6) * 0.06 });
            for (const sgn of [-1, 1]) sparkle.emit(10, { x: g.x + g.nx * sgn * g.half, y: 2.5, z: g.z + g.nz * sgn * g.half }, { colors: ['#3ddc84', '#fff6a8', '#ffffff'], vel: { x: 0, y: 3, z: 0 }, velSpread: 3, life: 0.9, gravity: -3 });
          } else {
            g.state = 2; st.gatesMiss++; st.penalty += 2;
            audio.sfx('hit'); ctx.vibrate(30);
            ctx.shout('¡Boya fallada! +2 s', { size: 'peque', color: '#ff6f61' });
          }
          st.gate++;
          hud.pop('olas');
          if (g.finish) finish(true);
        }
        if (st.t + st.penalty >= TIME_LIMIT && !st.done) finish(false);
      }

      // ── estela, espuma y salpicaduras ──
      boat.propTip.getWorldPosition(propW);
      const onWater = !st.air && st.speed > 1;
      wake.push(st.x - fxv * 3.3, st.z - fzv * 3.3, tAll, onWater ? clamp(st.speed / 18, 0.25, 1) : 0);
      wake.update(tAll, sea.heightAt);
      if (onWater) {
        const ph = sea.heightAt(propW.x, propW.z);
        const n = turboOn ? 3 : st.speed > 8 ? 1 : (Math.random() < 0.4 ? 1 : 0);
        if (n) fx.emit(n, { x: propW.x, y: ph + 0.1, z: propW.z }, { spread: 0.4, vel: { x: -fxv * (turboOn ? 6 : 3), y: turboOn ? 6 : 3.5, z: -fzv * (turboOn ? 6 : 3) }, velSpread: 1.6, colors: ['#ffffff', '#dff8ff'], life: 0.55, size: 0.3, gravity: -12 });
        if (st.speed > 16 && Math.random() < 0.6) {
          const sd = Math.random() < 0.5 ? -1 : 1;
          tmpV.set(st.x + fxv * 2.4 + fzv * sd * 0.8, h + 0.1, st.z + fzv * 2.4 - fxv * sd * 0.8);
          fx.emit(1, tmpV, { spread: 0.3, vel: { x: fzv * sd * 3, y: 2.5, z: -fxv * sd * 3 }, velSpread: 1, color: '#ffffff', life: 0.45, size: 0.28, gravity: -10 });
        }
      }

      // ── cámara ──
      if (cam.orbitT > 0) cam.orbitT -= realDt;
      cam.orbit = damp(cam.orbit, cam.orbitT > 0 ? 1 : 0, 3, realDt);
      cam.yaw += angleDiff(cam.yaw, st.yaw * 0.6 + (st.yaw + angleDiff(st.yaw, st.velYaw)) * 0.4) * (1 - Math.exp(-4 * dt));
      let cy = cam.yaw + cam.orbit * cam.orbitSide * 1.25;
      let dist = 7.6 + st.speed * 0.075 + cam.orbit * 2.5, hgt = 3.2 + cam.orbit * 1.5 - (st.air ? 0.5 : 0);
      if (!st.running && !st.done) { cy = st.yaw + 2.3 + tAll * 0.12; dist = 11; hgt = 3.2; }
      if (st.done) { cam.finishA += dt * 0.3; cy = st.yaw + Math.PI * 0.75 + cam.finishA; dist = 12; hgt = 4.2; }
      let cx = st.x - Math.sin(cy) * dist, cz = st.z - Math.cos(cy) * dist;
      // que la cámara no se meta dentro de las rocas
      for (const o of world.near(cx, cz)) {
        const dx = cx - o.x, dz = cz - o.z, d = Math.hypot(dx, dz), m = o.r * 1.12 + 1.5;
        if (d < m && d > 0.01) { cx = o.x + (dx / d) * m; cz = o.z + (dz / d) * m; }
      }
      const camH = Math.max(sea.heightAt(cx, cz) + 2.2, sea.heightAt(cx + Math.sin(cy) * 3, cz + Math.cos(cy) * 3) + 1.8, st.y * 0.5 + hgt);
      tmpV.set(cx, camH, cz);
      camera.position.lerp(tmpV, 1 - Math.exp(-6 * dt));
      camera.lookAt(st.x + fxv * 5 * (1 - cam.orbit), st.y + 1.3, st.z + fzv * 5 * (1 - cam.orbit));
      if (etapa.debugCam) { const d = etapa.debugCam; camera.position.set(d.x, d.y, d.z); camera.lookAt(d.lx, d.ly, d.lz); }
      const fov = 60 + st.speed * 0.38 + (turboOn ? 6 : 0);
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix(); }

      // sol con sombra que sigue a la barca
      sun.target.position.set(st.x, 0, st.z);
      sun.position.set(st.x + sunDir.x * 120, sunDir.y * 120, st.z + sunDir.z * 120);
      sky.position.copy(camera.position);
      sea.update(tAll, { x: st.x + fxv * 10, z: st.z + fzv * 10 }, camera.position, { x: st.x, z: st.z, yaw: st.yaw, k: st.air ? clamp(1 - (st.y - h) / 4, 0, 1) * 0.8 : 1 });
      world.update(tAll, st.t, sea, { x: st.x, z: st.z }, st.gate);

      // sonido
      if (sndEngine) sndEngine.set({ rate: 0.35 + st.speed / 30 + (st.air ? 0.4 : 0), vol: st.running ? 0.11 : 0.05 });
      if (sndWaves) sndWaves.set({ vol: 0.1 });
      if (sndWind) sndWind.set({ vol: clamp(st.speed / 40, 0, 0.12) });
      audio.intensity(turboOn ? 1 : 0.4);
      if (playing) updateHud();
    }

    function finish(win) {
      if (st.done) return;
      st.done = true; st.running = false; st.win = win;
      ui.hideMeter(); ui.turbo(false);
      const time = st.t + st.penalty;
      const goodT = time <= goodTime;
      const stars = !win ? 0 : goodT && st.calas === 3 ? 3 : goodT || st.calas >= 2 ? 2 : 1;
      st.stars = stars;
      if (win && st.rockHits === 0) ctx.sticker('sin-rozar');
      if (win) audio.sfx('firework');
      const lines = [];
      if (win && stars < 3) lines.push(`Para 3 estrellas: menos de ${fmtTime(goodTime)} y las 3 calas.`);
      else if (win && st.rockHits === 0) lines.push('Bonita vuelve sin un rasguño. Nok estará orgullosa.');
      else if (win) lines.push('Bonita vuelve con algún rasguño… Ni una palabra a Nok.');
      const score = !win ? st.gatesOk * 30 + st.calas * 300 : Math.max(0, Math.round((goodTime * 1.6 - time) * 30)) + st.calas * 500 + st.olas * 60 + st.limpias * 40 + st.gatesOk * 30 - st.rockHits * 40;
      ctx.finish({
        win, stars, time, score: Math.max(0, score),
        stats: [['Tiempo', fmtTime(time)], ['Calas', `${st.calas}/3`], ['Olas saltadas', `${st.olas}`], ['Boyas', `${st.gatesOk}/${gates.length}`], ['Choques', `${st.rockHits + st.boatHits}`]],
        moreStats: { olas: st.olas },
        shareText: `${fmtTime(time)}, ${st.calas}/3 calas y ${st.olas} olas saltadas en Koh Samui`,
        title: win ? (st.calas === 3 ? '¡Exploradores de calas!' : '¡Bonita llega a puerto!') : 'Se os hizo de noche…',
        lines,
        delay: 1400,
      });
    }

    return inst;
  },
};
