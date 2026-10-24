// ETAPA 3 · BANGKOK — Tuk-tuk de noche.
// Modo taxi por una ciudad de neón: recoges turistas españoles, los llevas a tiempo,
// derrapas para cargar el turbo y cobras propinas en baht. Un turno de 2:30.
import * as THREE from 'three';
import { Particles } from '../../core/engine.js';
import { makeSky, damp, clamp, angleDiff, disposeTree, makeRng, gradientTexture } from '../../core/util.js';
import { buildCity, minimapCanvas, LANDMARKS, sidePoint, N, CELL, ROAD, HALF, EDGE, line, mid } from './ciudad.js';
import { buildTukTuk, createTraffic, Trail, bake } from './vehiculos.js';
import { TURISTAS, COMPI, VENDEDORES, POLICIA, portrait, fill } from './turistas.js';
import { createHud } from './hud.js';
import { createRain } from './lluvia.js';

const SHIFT = 150;          // duración del turno (s)
const dec = (v) => v.toFixed(1).replace('.', ',');
const R_TUK = 1.3;          // radio de choque del tuk-tuk
const STOP_R = 5.2;         // radio del círculo de parada
const MAX_V = 19.5, TURBO_V = 32;

export default {
  id: 'bangkok',
  music: 'bangkok',
  ghost: false,
  controls: {
    joystick: 'steer',
    buttons: [
      { id: 'drift', label: 'DERRAPE', keys: ['Space'], pad: [1, 5], color: '#00b8d4', size: 'big', pos: { right: 18, bottom: 26 } },
      { id: 'turbo', label: 'TURBO', keys: ['ShiftLeft', 'ShiftRight', 'KeyX'], pad: [0, 2], color: '#ff3fa4', pos: { right: 34, bottom: 152 } },
      { id: 'brake', label: 'FRENO', keys: ['KeyS', 'ArrowDown'], pad: [6, 3], color: '#5a4a8a', size: 'small', pos: { right: 140, bottom: 22 } },
    ],
  },
  intro: [
    { who: 0, text: '¡Bangkok de noche! Esto parece una máquina de pinball gigante.' },
    { who: 1, text: 'El señor Somchai nos deja su tuk-tuk si le hacemos el turno de noche. Llevar turistas españoles.' },
    { who: 'Señor Somchai', text: 'Mi tuk-tuk es mi vida. Llegad a tiempo y habrá propinas. ¡Y no me lo rayéis!' },
    { who: 0, text: 'El tuk-tuk acelera solo. Derrapa en las curvas para cargar turbo y frena dentro del círculo para que suban.' },
  ],

  async create(ctx) {
    const { rng, input, audio, engine } = ctx;
    try { await Promise.race([document.fonts.load('40px Bungee'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* sin fuente */ }
    const q = engine.q;
    const wet = ctx.save.data.settings.rain !== false;
    const names = ctx.names;
    const trafficRng = makeRng((ctx.seed ^ 0x5bd1e995) >>> 0);
    const gameRng = makeRng((ctx.seed ^ 0x9e3779b9) >>> 0); // turistas: igual en cualquier calidad gráfica

    // ───────── escena ─────────
    const scene = new THREE.Scene();
    const sky = makeSky('#05021a', '#4a1d63', '#1a0b2e'); scene.add(sky);
    const fogFar = 330 * q.drawDistance + 60;
    scene.fog = new THREE.Fog('#2c1244', 45, fogFar);
    const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 900);
    const hemi = new THREE.HemisphereLight('#8a6cff', '#ff4fa3', 0.95); scene.add(hemi);
    const moon = new THREE.DirectionalLight('#a9c4ff', 1.0);
    moon.castShadow = !!q.shadows;
    moon.shadow.mapSize.set(q.shadowSize || 1024, q.shadowSize || 1024);
    Object.assign(moon.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 160 });
    moon.shadow.bias = -0.0008;
    scene.add(moon, moon.target);

    const city = buildCity(scene, rng, { quality: q.particles, wet });
    const mm = minimapCanvas();
    const blob = city.blob;

    // ───────── tuk-tuk ─────────
    const tuk = buildTukTuk(ctx, blob);
    scene.add(tuk.group);
    const nCars = Math.round(26 * (q.particles >= 1 ? 1 : q.particles >= 0.7 ? 0.8 : 0.55));
    const traffic = createTraffic(scene, makeRng((ctx.seed ^ 0x27d4eb2f) >>> 0), blob, nCars, { x: mid(2), z: line(4), r: 30 });
    const sparks = new Particles(scene, 520, { size: 0.32, additive: true });
    const spray = new Particles(scene, 420, { size: 0.12 });
    const trailL = new Trail(scene, '#ff3fa4'), trailR = new Trail(scene, '#ff3fa4');
    const rain = createRain(scene, Math.round(1700 * q.particles));
    rain.mesh.visible = wet;
    let wetNow = wet;

    // flecha guía 3D sobre el tuk-tuk
    const sh = new THREE.Shape();
    sh.moveTo(0, 1.2); sh.lineTo(1.0, -0.2); sh.lineTo(0.42, -0.2); sh.lineTo(0.42, -1.0); sh.lineTo(-0.42, -1.0); sh.lineTo(-0.42, -0.2); sh.lineTo(-1.0, -0.2); sh.closePath();
    const arrowGeo = new THREE.ShapeGeometry(sh); arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#ff3fa4', side: THREE.DoubleSide, toneMapped: false, transparent: true, opacity: 0.95, depthTest: false });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat); arrow.renderOrder = 10; arrow.scale.setScalar(0.85); scene.add(arrow);
    const qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), camRight = new THREE.Vector3();
    let arrowYaw = 0;
    const arrowHalo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: blob, color: '#ff3fa4', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
    arrowHalo.rotation.x = -Math.PI / 2; arrowHalo.renderOrder = 9; arrow.add(arrowHalo);

    // columna de luz + anillo del objetivo
    const colTex = gradientTexture([[0, '#000000'], [0.7, '#555555'], [1, '#ffffff']]);
    const colMat = new THREE.MeshBasicMaterial({ map: colTex, color: '#ff3fa4', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 70, 16, 1, true), colMat); column.position.y = 35; scene.add(column);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ff3fa4', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const ringGeo = new THREE.RingGeometry(STOP_R - 0.7, STOP_R, 40); ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = 0.06; scene.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(STOP_R, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blob, color: '#ff3fa4', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    disc.position.y = 0.05; scene.add(disc);
    const setTargetColor = (c) => { colMat.color.set(c); ringMat.color.set(c); disc.material.color.set(c); arrowMat.color.set(c); arrowHalo.material.color.set(c); };

    // ───────── locales simpáticos ─────────
    const locals = [];
    // policía de tráfico que baila en su peana (esquina del cruce central)
    const copLook = { skin: '#c68a5e', hair: '#1a1210', hairStyle: 3, shirt: '#8a6a44', pattern: 0, shorts: '#4a3a2a', glasses: true, cap: '#5a4026' };
    const cop = ctx.makeCharacter(copLook);
    cop.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const copPos = new THREE.Vector3(line(4) + 8.4, 0, line(4) + 8.4);
    const podium = new THREE.Group();
    const pod1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.9, 10), new THREE.MeshLambertMaterial({ color: '#f2f2f2' }));
    pod1.position.y = 0.7; podium.add(pod1);
    const podStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.95, 0.18, 10), new THREE.MeshBasicMaterial({ color: '#ff3a3a', toneMapped: false }));
    podStripe.position.y = 0.75; podium.add(podStripe);
    podium.position.copy(copPos); scene.add(podium);
    cop.group.position.set(copPos.x, 1.15, copPos.z); cop.group.rotation.y = -Math.PI * 0.75; scene.add(cop.group);
    locals.push({ kind: 'poli', obj: cop.group, head: 2.9, cd: 0 });
    // vendedoras con carrito
    const vendors = [];
    const makeVendor = (look, x0, x1, z, color) => {
      const g = new THREE.Group();
      const cartM = new THREE.MeshLambertMaterial({ color, flatShading: true });
      const cart = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.9), cartM); cart.position.set(0, 0.85, 0.9); g.add(cart);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.0), new THREE.MeshLambertMaterial({ color: '#d8d8e8' })); top.position.set(0, 1.34, 0.9); g.add(top);
      for (const s of [-0.6, 0.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#222' })); w.position.set(s, 0.3, 0.9); g.add(w); }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), new THREE.MeshLambertMaterial({ color: '#ddd' })); pole.position.set(0, 2.0, 0.9); g.add(pole);
      const umb = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 8), new THREE.MeshLambertMaterial({ color: '#ff3fa4', flatShading: true })); umb.position.set(0, 2.8, 0.9); g.add(umb);
      const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshBasicMaterial({ color: '#ffe1a0', toneMapped: false })); bulb.position.set(0, 2.4, 0.9); g.add(bulb);
      const ch = ctx.makeCharacter(look); ch.pose('walk', 0.3);
      const body = bake(ch); g.add(body);
      g.position.set(x0, 0.25, z); scene.add(g);
      const v = { g, x0, x1, z, dir: 1, sp: 1.2, body };
      vendors.push(v);
      locals.push({ kind: 'vende', obj: g, head: 2.2, cd: 2 });
      return v;
    };
    makeVendor({ skin: '#a86b43', hair: '#1a1210', hairStyle: 2, shirt: '#ffd166', pattern: 1, shorts: '#7b5cff', cap: '' }, line(2) + 9, line(3) - 9, line(4) + 8.3, '#2a9d8f');
    makeVendor({ skin: '#c68a5e', hair: '#2b1a12', hairStyle: 4, shirt: '#ff6f61', pattern: 2, shorts: '#2e4a7d', cap: '#ffb703' }, line(1) + 9, line(2) - 9, line(2) - 8.3, '#e76f51');

    // ───────── turistas ─────────
    const first = TURISTAS.slice(0, 6), extra = TURISTAS.slice(6);
    const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(gameRng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
    const order = [...shuffle(first), ...shuffle(extra)];
    for (const t of TURISTAS) t.portrait = t.portrait || portrait(t);
    const compiImg = portrait({ bg: '#36c2b4', looks: [ctx.looks[1]] });

    // ───────── estado ─────────
    const startX = mid(2), startZ = line(4) - 3.5;
    const st = {
      phase: 'intro', t: 0, left: SHIFT, money: 0, delivered: 0, failed: 0, crashes: 0, near: 0,
      brakeUsed: false, driftT: 0, driftGap: 0, driftBest: 0, bestMargin: 0,
      x: startX, z: startZ, yaw: Math.PI / 2, vx: 0, vz: 0, speed: 0, steerVis: 0,
      turbo: 1, boostT: 0, wasDrift: false, idx: 0, cur: null, mode: 'pick', target: null, field: null,
      tripLeft: 0, tripMax: 1, tripCrash: 0, boardT: 0, chatT: 6, chatI: 0, compiCd: 0, crashCd: 0, hintDone: {},
      waiting: [], seated: [], leaving: [], path: [], guide: [0, 0], endT: 0, flash: 0, nextFlash: 10 + Math.random() * 12,
      lastPhrase: '', finished: false, stars: 0, rush: false, rushIdx: 2 + Math.floor(gameRng() * 3), lanterns: 0, camLift: 0, arrowWant: false,
    };
    const E = { fase: 'intro', modo: 'pick', turista: '', entregados: 0, fallidos: 0, dinero: 0, tiempo: SHIFT, viaje: 0, viajeMax: 0, jugador: { x: 0, z: 0, yaw: 0, v: 0 }, guia: { x: 0, z: 0 }, objetivo: { x: 0, z: 0 }, turbo: 1, derrape: 0, choques: 0, terminado: false, estrellas: 0, frenado: false };
    window.__ruta = window.__ruta || {};
    window.__ruta.etapa = E;
    // solo para pruebas/capturas: mover el tuk-tuk
    E.debug = () => ({ sparks: sparks.life.filter((l) => l > 0).length, spray: spray.life.filter((l) => l > 0).length, boost: st.boostT, max: sparks.max, vis: sparks.points.visible, inScene: !!sparks.points.parent });
    E.teleport = (x, z, yaw = st.yaw) => { st.x = x; st.z = z; st.yaw = yaw; st.vx = Math.sin(yaw) * 10; st.vz = Math.cos(yaw) * 10; camYaw = yaw; camera.position.set(x - Math.sin(yaw) * 7, 3.2, z - Math.cos(yaw) * 7); };

    const hudB = createHud(ctx, mm);
    const engineSnd = audio.loop('engine');
    const rainSnd = audio.loop('rain');
    const crowdSnd = audio.loop('crowd');

    // ───────── navegación por la cuadrícula ─────────
    const nid = (i, j) => i * (N + 1) + j;
    const npos = (i, j) => [line(i), line(j)];
    const NEI = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const inGrid = (i, j) => i >= 0 && j >= 0 && i <= N && j <= N;
    function makeField(tg) {
      const dist = new Float32Array((N + 1) * (N + 1)).fill(1e9), done = new Uint8Array(dist.length);
      const [ai, aj] = tg.edge.a, [bi, bj] = tg.edge.b;
      dist[nid(ai, aj)] = tg.edge.f * CELL; dist[nid(bi, bj)] = (1 - tg.edge.f) * CELL;
      for (let it = 0; it < dist.length; it++) {
        let best = -1, bd = 1e9;
        for (let k = 0; k < dist.length; k++) if (!done[k] && dist[k] < bd) { bd = dist[k]; best = k; }
        if (best < 0) break;
        done[best] = 1;
        const i = Math.floor(best / (N + 1)), j = best % (N + 1);
        for (const [di, dj] of NEI) { const a = i + di, b = j + dj; if (!inGrid(a, b)) continue; const k = nid(a, b); if (dist[k] > bd + CELL) dist[k] = bd + CELL; }
      }
      return dist;
    }
    function locate(x, z) {
      const i = clamp(Math.round((x + HALF) / CELL), 0, N), j = clamp(Math.round((z + HALF) / CELL), 0, N);
      const onV = Math.abs(x - line(i)) < ROAD / 2 + 0.6, onH = Math.abs(z - line(j)) < ROAD / 2 + 0.6;
      if (onV && onH) return { node: [i, j] };
      if (onV) { const j0 = clamp(Math.floor((z + HALF) / CELL), 0, N - 1); return { a: [i, j0], b: [i, j0 + 1], t: (z - line(j0)) / CELL }; }
      if (onH) { const i0 = clamp(Math.floor((x + HALF) / CELL), 0, N - 1); return { a: [i0, j], b: [i0 + 1, j], t: (x - line(i0)) / CELL }; }
      return { node: [i, j] };
    }
    const sameNode = (p, q2) => p[0] === q2[0] && p[1] === q2[1];
    function routeFrom(x, z) {
      const tg = st.target, field = st.field;
      if (!tg) return [];
      const T = [tg.x, tg.z], ea = tg.edge.a, eb = tg.edge.b;
      const L = locate(x, z);
      const path = [];
      let cur;
      if (L.node) {
        cur = L.node;
        if (sameNode(cur, ea) || sameNode(cur, eb)) return [T];
      } else {
        if ((sameNode(L.a, ea) && sameNode(L.b, eb)) || (sameNode(L.a, eb) && sameNode(L.b, ea))) return [T];
        const da = L.t * CELL + field[nid(...L.a)], db = (1 - L.t) * CELL + field[nid(...L.b)];
        cur = da <= db ? L.a : L.b;
        path.push(npos(...cur));
      }
      for (let k = 0; k < 24; k++) {
        if (sameNode(cur, ea) || sameNode(cur, eb)) { path.push(T); break; }
        let best = null, bd = 1e9;
        for (const [di, dj] of NEI) { const a = cur[0] + di, b = cur[1] + dj; if (!inGrid(a, b)) continue; const d = field[nid(a, b)]; if (d < bd) { bd = d; best = [a, b]; } }
        if (!best) break;
        cur = best; path.push(npos(...cur));
      }
      return path;
    }
    const pathLen = (x, z, path) => { let d = 0, px = x, pz = z; for (const [a, b] of path) { d += Math.abs(a - px) + Math.abs(b - pz); px = a; pz = b; } return d; };

    // ───────── turistas: aparecer, subir, bajar ─────────
    function randomCurb(minD, maxD, avoid) {
      for (let tries = 0; tries < 80; tries++) {
        const r = gameRng, side = 'nswe'[Math.floor(r() * 4)];
        let i, j;
        if (side === 'n') { i = Math.floor(r() * N); j = Math.floor(r() * (N + 1)); }
        else if (side === 's') { i = Math.floor(r() * N); j = Math.floor(r() * (N + 1)) - 1; }
        else if (side === 'w') { i = Math.floor(r() * (N + 1)); j = Math.floor(r() * N); }
        else { i = Math.floor(r() * (N + 1)) - 1; j = Math.floor(r() * N); }
        const p = sidePoint(i, j, side, 0.3 + r() * 0.4);
        const d = Math.hypot(p.x - st.x, p.z - st.z);
        if (d < minD || d > maxD) continue;
        if (avoid && Math.hypot(p.x - avoid.x, p.z - avoid.z) < 70) continue;
        if (Math.hypot(p.x - copPos.x, p.z - copPos.z) < 12) continue;
        return p;
      }
      return sidePoint(3, 3, 'n', 0.5);
    }
    const destOf = (t) => { const l = LANDMARKS[t.dest]; return { ...sidePoint(l.block[0], l.block[1], l.side, 0.5), name: l.name, color: l.color }; };
    const looksOf = (t) => (t.couple || t.group ? t.looks.slice(0, 2) : [t.looks[0]]);

    function clearChars(list) { for (const c of list) { if (c.obj.parent) c.obj.parent.remove(c.obj); disposeTree(c.obj); } list.length = 0; }
    function spawnTourist() {
      if (st.idx >= order.length) return false;
      const t = order[st.idx++];
      st.cur = t; st.mode = 'pick';
      st.rush = st.idx === st.rushIdx; // un cliente por turno va con PRISA y paga doble
      hudB.rush(st.rush);
      const dest = destOf(t);
      const p = randomCurb(st.idx === 1 ? 35 : 45, st.idx === 1 ? 85 : 135, dest);
      st.pick = p; st.dest = dest;
      setTarget(p, '#ff3fa4');
      // personajes esperando en la acera
      const looks = looksOf(t);
      looks.forEach((lk, k) => {
        const ch = ctx.makeCharacter(lk, { scale: t.big ? 1.12 : 1 });
        ch.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
        const off = (k - (looks.length - 1) / 2) * 1.1;
        const ox = Math.cos(p.face) * off, oz = -Math.sin(p.face) * off;
        ch.group.position.set(p.sx + ox, 0.25, p.sz + oz); ch.group.rotation.y = p.face;
        scene.add(ch.group);
        st.waiting.push({ ch, obj: ch.group, ph: k * 0.7 });
      });
      tuk.setBusy(false);
      hudB.card(t, 'pick');
      if (!st.hintDone.pick) { st.hintDone.pick = true; st.pendingHint = 'Sigue la flecha rosa y para dentro del círculo: el cliente sube solo.'; }
      return true;
    }
    function setTarget(p, color) {
      st.target = p; st.field = makeField(p);
      column.position.set(p.x, 35, p.z); ring.position.set(p.x, 0.06, p.z); disc.position.set(p.x, 0.05, p.z);
      setTargetColor(color);
      st.path = routeFrom(st.x, st.z);
    }
    function say(t, text, ms = 3600) { st.lastPhrase = fill(text, names); hudB.say(t.portrait, t.name, st.lastPhrase, ms); }
    function compiSay(list, force = false) {
      if (!force && (st.compiCd > 0 || hudB.talking)) return;
      st.compiCd = 4;
      hudB.say(compiImg, names[1], fill(list[Math.floor(Math.random() * list.length)], names), 2400, true);
    }

    function beginBoard() {
      st.phase = 'board'; st.boardT = 0; st.vx = st.vz = 0; st.speed = 0;
      audio.sfx('bell'); ctx.vibrate(25);
      if (st.mode === 'pick') {
        ctx.shout('¡SUBE!', { size: 'peque', color: '#ff3fa4' });
        st.jumpers = st.waiting.map((w, k) => ({ ...w, from: w.obj.position.clone(), seat: k }));
        st.waiting = [];
      } else {
        st.jumpers = [];
        const t = st.cur;
        clearChars(st.seated);
        tuk.body.updateMatrixWorld(true);
        const looks = looksOf(t);
        looks.forEach((lk, k) => {
          const ch = ctx.makeCharacter(lk, { scale: t.big ? 1.12 : 1 });
          ch.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
          const seat = tuk.seats[k];
          const wp = new THREE.Vector3(seat[0], seat[1], seat[2]).applyMatrix4(tuk.body.matrixWorld);
          ch.group.position.copy(wp); scene.add(ch.group);
          const off = (k - (looks.length - 1) / 2) * 1.1, d = st.dest;
          st.jumpers.push({ ch, obj: ch.group, from: wp, to: new THREE.Vector3(d.sx + Math.cos(d.face) * off, 0.25, d.sz - Math.sin(d.face) * off), out: true, face: d.face });
        });
      }
    }
    function endBoard() {
      st.phase = 'drive';
      const t = st.cur;
      if (st.mode === 'pick') {
        for (const j of st.jumpers) { scene.remove(j.obj); disposeTree(j.obj); }
        st.jumpers = [];
        const looks = looksOf(t);
        looks.forEach((lk, k) => {
          const ch = ctx.makeCharacter(lk); ch.pose('sit');
          if (k === 0 && !t.couple && !t.group) ch.rig.armR.shoulder.rotation.z = -2.4; // saluda
          const m = bake(ch);
          const s = tuk.seats[k];
          m.position.set(s[0], s[1], s[2]); m.scale.setScalar(t.big ? 0.95 : 0.85);
          tuk.body.add(m);
          st.seated.push({ obj: m });
        });
        st.mode = 'ride';
        setTarget(st.dest, '#00e5ff');
        const len = pathLen(st.x, st.z, st.path);
        st.tripMax = Math.round((len / 11.5 + 8) * (st.rush ? 0.85 : 1)); st.tripLeft = st.tripMax; st.tripCrash = 0;
        if (st.rush) { hudB.banner('⚡ ¡CON PRISA! PAGA DOBLE', '#ffd23f'); audio.sfx('horn'); engine.shake(0.2); }
        st.tripLen = len;
        tuk.setBusy(true);
        hudB.card(t, 'ride', st.dest.name, st.tripLeft, st.tripMax);
        say(t, t.pick[0], 4200);
        st.chatT = 7.5; st.chatI = 0;
        if (!st.hintDone.drift) { st.hintDone.drift = true; st.pendingHint = input.lastDevice === 'touch' ? 'Mantén DERRAPE al girar: carga el TURBO.' : 'ESPACIO para derrapar (carga el turbo) · SHIFT para el TURBO.'; st.hintDelay = 4.3; }
      } else {
        // cobrar
        const margin = Math.max(0, st.tripLeft);
        const fare = 60 + Math.round(st.tripLen * 0.25);
        const tip = Math.max(0, Math.round(margin * 6) - st.tripCrash * 8);
        const rating = margin >= 12 ? 3 : margin >= 5 ? 2 : 1;
        const mult = st.rush ? 2 : 1;
        st.money += (fare + tip) * mult; st.delivered++;
        st.bestMargin = Math.max(st.bestMargin, margin);
        audio.sfx('coin'); setTimeout(() => audio.sfx('coin', { pitch: 1.2 }), 120); setTimeout(() => audio.sfx('star', { pitch: 1 + rating * 0.15 }), 260);
        hudB.cobro((fare + tip) * mult, rating, st.rush ? '¡PRISA! ×2' : (tip > 0 ? `propina ${tip} ฿` : 'sin propina'));
        const wp = tuk.group.position.clone(); wp.y = 1.5;
        sparks.emit(40, wp, { colors: ['#ffd23f', '#fff3b0', '#5dff9b'], vel: { x: 0, y: 6, z: 0 }, velSpread: 6, life: 1.0, gravity: -9, size: 0.4 });
        if (rating === 3) engine.slowmo(0.5, 0.35);
        say(t, t.drop[0], 3800);
        if (margin > 20) ctx.sticker('propina');
        if (st.delivered === 5) ctx.sticker('taxista');
        st.rush = false; hudB.rush(false);
        st.leaving.push(...st.jumpers.map((j) => ({ obj: j.obj, ch: j.ch, life: 3.5 })));
        st.jumpers = [];
        st.cur = null; st.target = null; st.path = [];
        tuk.setBusy(false);
        if (!spawnTourist()) endShift(true);
      }
    }
    function touristLeaves() {
      const t = st.cur;
      say(t, t.late, 3500);
      audio.sfx('lose', { vol: 0.5 });
      ctx.shout('¡SE BAJA!', { size: 'peque', color: '#ff5c5c' });
      clearChars(st.seated);
      looksOf(t).forEach((lk, k) => {
        const ch = ctx.makeCharacter(lk);
        ch.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
        ch.group.position.set(st.x + Math.cos(st.yaw) * (1.5 + k), 0, st.z - Math.sin(st.yaw) * (1.5 + k));
        ch.group.rotation.y = st.yaw + Math.PI / 2;
        scene.add(ch.group);
        st.leaving.push({ obj: ch.group, ch, life: 2.5, run: true });
      });
      st.failed++; st.rush = false; hudB.rush(false);
      st.cur = null; st.target = null; st.path = [];
      tuk.setBusy(false);
      if (!spawnTourist()) endShift(true);
    }
    function endShift(early) {
      if (st.phase === 'end') return;
      st.phase = 'end'; st.endT = 0;
      if (early && st.left > 0) { const bonus = Math.round(st.left * 2); st.money += bonus; ctx.toast(`¡Todos los turistas! Bonus +${bonus} ฿`, 2600); }
      ctx.shout('¡FIN DEL TURNO!', { color: '#ff3fa4', ms: 1800 });
      audio.sfx('bell'); engine.slowmo(1.2, 0.3);
      if (st.cur && st.mode === 'ride') hudB.say(st.cur.portrait, st.cur.name, '¿Ya? ¡Pero si casi llegábamos!', 2500);
      hudB.card(null);
    }
    function finish() {
      if (st.finished) return; st.finished = true;
      const d = st.delivered, win = d >= 3;
      const stars = !win ? 0 : 1 + (d >= 5 ? 1 : 0) + (d >= 7 || (d >= 6 && st.money >= 1600) ? 1 : 0);
      st.stars = stars;
      if (win && !st.brakeUsed) ctx.sticker('sin-frenar');
      E.terminado = true; E.estrellas = stars;
      ctx.finish({
        win, stars, time: SHIFT - st.left, score: st.money + d * 50,
        stats: [['Turistas', `${d}`], ['Baht', `${st.money} ฿`], ['Tiempo sobrante', `${dec(st.bestMargin)} s`], ['Mejor derrape', `${dec(st.driftBest)} s`], ['Choques', st.crashes], ['Farolillos', st.lanterns]],
        moreStats: { turistas: d },
        shareText: `${d} turistas y ${st.money} ฿ en el tuk-tuk de Bangkok`,
        title: win ? (stars === 3 ? '¡Taxista del año!' : '¡Turno completado!') : 'Somchai no está contento…',
        lines: [stars === 0 ? '1★: entrega 3 turistas' : stars === 1 ? '2★: entrega 5 turistas' : stars === 2 ? '3★: 7 turistas (o 6 y 1600 ฿)' : '¡Tres estrellas! Taxista de leyenda.', win ? `Somchai: «${stars === 3 ? 'Mi tuk-tuk nunca había ido tan rápido. ¡Os lo regalo! Es broma.' : 'Buen turno. El tuk-tuk sigue entero… casi.'}»` : 'Somchai: «Mañana lo intentamos otra vez, ¿vale?»'],
        delay: 300,
      });
    }

    // primer turista ya esperando durante la intro
    spawnTourist();

    // ───────── choques ─────────
    function impact(nx, nz, depth, hard, cx, cz) {
      st.x += nx * depth; st.z += nz * depth;
      const vn = st.vx * nx + st.vz * nz;
      if (vn < 0) {
        const e = hard ? 0.35 : 0.55;
        st.vx -= (1 + e) * vn * nx; st.vz -= (1 + e) * vn * nz;
        st.vx *= 0.9; st.vz *= 0.9;
        const imp = -vn;
        if (imp > 4.5) {
          const p = new THREE.Vector3(cx, 0.9, cz);
          sparks.emit(Math.min(30, 6 + imp * 1.4), p, { colors: ['#fff3b0', '#ffd23f', '#ff9f1c', '#ffffff'], vel: { x: nx * 5, y: 3, z: nz * 5 }, velSpread: 7, life: 0.45, gravity: -14, size: 0.25 });
          engine.shake(Math.min(0.7, imp * 0.04));
          audio.sfx('crash', { vol: Math.min(1, imp / 18) });
          ctx.vibrate(Math.min(60, imp * 4));
          if (imp > 8 && st.crashCd <= 0) {
            st.crashes++; st.crashCd = 1; if (st.mode === 'ride' && st.cur) st.tripCrash++;
            compiSay(COMPI.crash);
            if (imp > 13) ctx.shout('¡PUM!', { size: 'peque', color: '#ffd23f' });
          }
        }
      }
    }
    const colliders = city.colliders;
    function collideWorld() {
      const r = R_TUK;
      if (st.x < -EDGE + r) impact(1, 0, -EDGE + r - st.x, true, -EDGE, st.z);
      if (st.x > EDGE - r) impact(-1, 0, st.x - (EDGE - r), true, EDGE, st.z);
      if (st.z < -EDGE + r) impact(0, 1, -EDGE + r - st.z, true, st.x, -EDGE);
      if (st.z > EDGE - r) impact(0, -1, st.z - (EDGE - r), true, st.x, EDGE);
      const bi = Math.floor((st.x + HALF) / CELL), bj = Math.floor((st.z + HALF) / CELL);
      for (let a = bi - 1; a <= bi + 1; a++) for (let b = bj - 1; b <= bj + 1; b++) {
        if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const c = colliders[a * N + b];
        const cx = clamp(st.x, c.x0, c.x1), cz = clamp(st.z, c.z0, c.z1);
        const dx = st.x - cx, dz = st.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); impact(dx / d, dz / d, r - d, true, cx, cz); }
        else {
          // dentro de la manzana: salir por el lado más cercano
          const opts = [[st.x - c.x0, -1, 0], [c.x1 - st.x, 1, 0], [st.z - c.z0, 0, -1], [c.z1 - st.z, 0, 1]].sort((p1, p2) => p1[0] - p2[0]);
          const [dd, nx, nz] = opts[0]; impact(nx, nz, dd + r, true, st.x, st.z);
        }
      }
    }
    const onCarHit = (car, nx, nz, depth) => {
      const before = Math.hypot(st.vx, st.vz);
      impact(nx, nz, depth, false, st.x - nx * R_TUK, st.z - nz * R_TUK);
      st.vx += Math.sin(car.yaw) * car.speed * 0.25; st.vz += Math.cos(car.yaw) * car.speed * 0.25;
      if (car.stun <= 0 && before > 3) { car.stun = 1.3; if (Math.random() < 0.7) audio.sfx('horn', { vol: 0.5, pitch: car.t.len < 3 ? 1.3 : 1 }); }
    };
    const onNear = () => {
      if (st.phase !== 'drive' || st.speed < 14) return;
      st.near++; st.money += 5;
      hudB.plus('+5 ฿ ¡por los pelos!');
      audio.sfx('whoosh', { vol: 0.6 });
      if (Math.random() < 0.35) compiSay(COMPI.near);
    };
    const pushOnly = (c, nx, nz, d) => { st.x += nx * d; st.z += nz * d; };

    // ───────── cámara ─────────
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), lookCur = new THREE.Vector3(st.x, 1, st.z);
    let camYaw = st.yaw;
    camera.position.set(st.x - Math.sin(st.yaw) * 95, 58, st.z - Math.cos(st.yaw) * 95);
    const inBlock = (x, z, pad) => {
      const bi = Math.floor((x + HALF) / CELL), bj = Math.floor((z + HALF) / CELL);
      if (bi < 0 || bj < 0 || bi >= N || bj >= N) return false;
      const c = colliders[bi * N + bj];
      return x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad;
    };
    const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpColor = new THREE.Color();

    // ───────── farolillos de la suerte: flotan sobre las calles, +10 ฿ y algo de turbo ─────────
    const NL = 30;
    const lanGeo = new THREE.SphereGeometry(0.42, 8, 6); lanGeo.scale(1, 1.3, 1);
    const lanMesh = new THREE.InstancedMesh(lanGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), NL);
    const lanHalo = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: blob, color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), NL);
    lanMesh.frustumCulled = lanHalo.frustumCulled = false;
    scene.add(lanMesh, lanHalo);
    const lans = [];
    for (let k = 0; k < NL; k++) {
      let x, z;
      do {
        const vert = gameRng() < 0.5, kk = Math.floor(gameRng() * (N + 1)), ss = Math.floor(gameRng() * N);
        const u = line(ss) + CELL * (0.2 + gameRng() * 0.6), off = (gameRng() - 0.5) * 8;
        x = vert ? line(kk) + off : u; z = vert ? u : line(kk) + off;
      } while (Math.hypot(x - startX, z - startZ) < 25);
      lans.push({ x, z, on: true, t: 0, ph: k * 1.3 });
      const c = new THREE.Color(k % 3 === 0 ? '#ff3b3b' : '#ffcf3a');
      lanMesh.setColorAt(k, c); lanHalo.setColorAt(k, c.clone().multiplyScalar(0.7));
    }
    const lanObj = new THREE.Object3D();
    function updateLanterns(dt) {
      for (let k = 0; k < NL; k++) {
        const l = lans[k];
        if (l.on) {
          if (st.phase === 'drive' && Math.abs(l.x - st.x) < 2.6 && Math.abs(l.z - st.z) < 2.6 && Math.hypot(l.x - st.x, l.z - st.z) < 2.6) {
            l.on = false; l.t = 20;
            st.money += 10; st.lanterns++; st.turbo = Math.min(1, st.turbo + 0.12);
            sparks.emit(18, tmpV.set(l.x, 1.6, l.z), { colors: ['#ffcf3a', '#ff3b3b', '#fff3b0'], vel: { x: 0, y: 4, z: 0 }, velSpread: 6, life: 0.7, gravity: -6, size: 0.35 });
            audio.sfx('coin', { pitch: 1.3 + (st.lanterns % 4) * 0.08 });
            hudB.plus('+10 ฿ 🏮');
          }
        } else { l.t -= dt; if (l.t <= 0 && Math.hypot(l.x - st.x, l.z - st.z) > 35) l.on = true; }
        const sc = l.on ? 1 : 0;
        lanObj.position.set(l.x, 1.7 + Math.sin(time * 2 + l.ph) * 0.2, l.z); lanObj.rotation.set(0, time + l.ph, 0); lanObj.scale.setScalar(sc); lanObj.updateMatrix();
        lanMesh.setMatrixAt(k, lanObj.matrix);
        lanObj.quaternion.copy(camera.quaternion); lanObj.updateMatrix();
        lanHalo.setMatrixAt(k, lanObj.matrix);
      }
      lanMesh.instanceMatrix.needsUpdate = true; lanHalo.instanceMatrix.needsUpdate = true;
    }

    // ───────── bucle ─────────
    let time = 0;
    const inst = {
      scene, camera,
      async start() {
        await ctx.intro();
        st.phase = 'drive';
        compiSay(['¡Vamos, {0}! ¡Primer cliente!'], true);
      },
      update(dt, realDt) {
        time += dt;
        const rdt = realDt || dt;
        const inp = input;
        hudB.tick(rdt);
        sparks.update(dt); spray.update(dt);
        city.update(dt, time);
        updateLanterns(dt);
        if (st.compiCd > 0) st.compiCd -= dt;
        if (st.crashCd > 0) st.crashCd -= dt;
        if (st.pendingHint && st.phase === 'drive') { st.hintDelay = (st.hintDelay || 0.8) - dt; if (st.hintDelay <= 0) { hudB.hint(st.pendingHint, 4200); st.pendingHint = null; st.hintDelay = 0; } }

        // ── conducir ──
        const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), sx = Math.cos(st.yaw), sz = -Math.sin(st.yaw);
        let vf = st.vx * fx + st.vz * fz, vs = st.vx * sx + st.vz * sz;
        let steer = 0, drifting = false, sliding = false;
        const tg = st.target;
        const dTarget = tg ? Math.hypot(tg.x - st.x, tg.z - st.z) : 1e9;
        if (st.phase === 'drive') {
          st.t += dt; st.left = SHIFT - st.t;
          steer = clamp(inp.x, -1, 1);
          const braking = inp.down('brake') || inp.y < -0.3;
          const driftBtn = inp.down('drift');
          if (braking && !st.brakeUsed) st.brakeUsed = true;
          if (inp.pressed('turbo')) {
            if (st.turbo >= 0.33) {
              st.turbo -= 0.33; st.boostT = Math.min(3, Math.max(0, st.boostT) + 1.3);
              audio.sfx('boost'); engine.shake(0.25); ctx.vibrate(30);
              ctx.shout('¡TURBO!', { size: 'peque', color: '#ff3fa4', ms: 700 });
              compiSay(COMPI.turbo);
            } else { audio.sfx('click', { pitch: 0.6 }); hudB.hint(input.lastDevice === 'touch' ? '¡Sin turbo! Derrapa para cargarlo.' : '¡Sin turbo! Derrapa (ESPACIO) para cargarlo.', 1800); }
          }
          st.boostT = Math.max(0, st.boostT - dt);
          const boosting = st.boostT > 0;
          const inStop = tg && dTarget < STOP_R && (!boosting || Math.abs(vf) < 20);
          if (tg && dTarget < STOP_R && !inStop && !st.slowWarn) { st.slowWarn = true; compiSay(COMPI.slow, true); }
          if (dTarget > STOP_R + 3) st.slowWarn = false;
          const maxF = boosting ? TURBO_V : MAX_V;
          if (inStop) { vf *= Math.exp(-5.5 * dt); vs *= Math.exp(-5.5 * dt); }
          else if (braking) { if (vf > 0.5) vf = Math.max(0, vf - 28 * dt); else vf = Math.max(-7, vf - 9 * dt); }
          else {
            const a = boosting ? 32 : vf < 8 ? 13 : 7.5;
            if (vf < maxF) vf = Math.min(maxF, vf + a * dt); else vf = damp(vf, maxF, 1.4, dt);
          }
          drifting = driftBtn && Math.abs(vf) > 7 && !inStop;
          vs *= Math.exp(-(drifting ? 1.3 : 9.5) * dt);
          if (drifting) vf *= Math.exp(-0.1 * dt);
          if (drifting && !st.wasDrift) { st.yaw -= steer * 0.12; audio.sfx('whoosh', { vol: 0.4, pitch: 0.7 }); }
          const sp = Math.abs(vf);
          const steerK = (0.35 + 0.65 * clamp(sp / 6, 0, 1)) * (drifting ? 2.75 : 2.05) * (sp > 24 ? 0.82 : 1); // gira cerrado aunque vaya despacio
          st.vx = fx * vf + sx * vs; st.vz = fz * vf + sz * vs;
          st.yaw -= steer * steerK * dt * (vf < -0.3 ? -1 : 1);
          // derrape: carga turbo y cuenta para la pegatina
          sliding = drifting && Math.abs(vs) > 2.2;
          if (sliding) {
            st.driftT += dt; st.driftGap = 0;
            st.turbo = Math.min(1, st.turbo + dt * 0.3);
            st.driftBest = Math.max(st.driftBest, st.driftT);
            if (st.driftT >= 3 && !st.driftSt) { st.driftSt = true; ctx.sticker('derrape'); ctx.shout('¡REY DEL DERRAPE!', { size: 'peque', color: '#00e5ff' }); }
            if (st.driftT > 1.2 && !st.driftSaid) { st.driftSaid = true; compiSay(COMPI.drift); }
          } else if (st.driftT > 0) {
            st.driftGap += dt;
            if (st.driftGap > 0.3 || !driftBtn) {
              if (st.driftT > 0.9) {
                st.boostT = Math.max(st.boostT, 0.45 + Math.min(st.driftT, 2.5) * 0.3);
                audio.sfx('boost', { vol: 0.6, pitch: 1.3 });
                ctx.shout(st.driftT > 2 ? '¡SUPER MINI TURBO!' : '¡MINI TURBO!', { size: 'peque', color: st.driftT > 2 ? '#ff3fa4' : '#00e5ff', ms: 700 });
              }
              st.driftT = 0; st.driftGap = 0; st.driftSaid = false;
            }
          }
          st.wasDrift = drifting;
          st.x += st.vx * dt; st.z += st.vz * dt;
          collideWorld();
          st.speed = Math.hypot(st.vx, st.vz);
          if (inStop && st.speed < 1.4) beginBoard();
          // viaje: reloj del turista
          if (st.phase === 'drive' && st.mode === 'ride' && st.cur) {
            st.tripLeft -= dt;
            if (st.tripLeft < 6 && !st.hurrySaid) { st.hurrySaid = true; compiSay(COMPI.hurry, true); }
            if (st.tripLeft <= 0) { st.hurrySaid = false; touristLeaves(); }
            else {
              st.chatT -= dt;
              if (st.chatT <= 0 && !hudB.talking) { st.chatT = 8 + Math.random() * 3; const t = st.cur; say(t, t.ride[st.chatI++ % t.ride.length], 3400); }
            }
          } else st.hurrySaid = false;
          if (st.left <= 0) endShift(false);
        } else if (st.phase === 'board') {
          st.boardT += dt;
          const k = clamp(st.boardT / 0.85, 0, 1);
          tuk.body.updateMatrixWorld(true);
          for (const j of st.jumpers || []) {
            const to = j.out ? j.to : tmpV2.set(...tuk.seats[j.seat]).applyMatrix4(tuk.body.matrixWorld);
            j.obj.position.lerpVectors(j.from, to, k); j.obj.position.y += Math.sin(k * Math.PI) * 1.6;
            j.ch.pose(k < 1 ? 'cheer' : 'idle', time);
            j.obj.rotation.y = j.out && k >= 1 ? j.face : st.yaw;
            if (!j.out) j.obj.scale.setScalar(1 - k * 0.15);
          }
          st.vx *= Math.exp(-8 * dt); st.vz *= Math.exp(-8 * dt);
          if (st.boardT > 1.15) endBoard();
        } else if (st.phase === 'end') {
          st.endT += rdt;
          st.vx *= Math.exp(-2 * dt); st.vz *= Math.exp(-2 * dt);
          st.x += st.vx * dt; st.z += st.vz * dt; collideWorld();
          st.speed = Math.hypot(st.vx, st.vz);
          if (st.endT > 2.4) finish();
        }

        // tráfico (sigue circulando en la intro y al final)
        traffic.update(dt, { x: st.x, z: st.z, speed: st.speed }, trafficRng, st.phase === 'drive' ? onCarHit : pushOnly, onNear);
        for (const c of traffic.cars) if (c.honked) { c.honked = false; if (Math.hypot(c.x - st.x, c.z - st.z) < 25) audio.sfx('horn', { vol: 0.35, pitch: c.t.len < 3 ? 1.35 : 1 }); }

        // ── el tuk-tuk en pantalla ──
        tuk.group.position.set(st.x, 0, st.z);
        tuk.group.rotation.y = st.yaw;
        st.steerVis = damp(st.steerVis, steer, 10, dt);
        const lat = clamp(vs * 0.03, -0.18, 0.18);
        tuk.body.rotation.z = damp(tuk.body.rotation.z, -st.steerVis * 0.07 * clamp(st.speed / 15, 0, 1) + lat, 8, dt);
        const pitchT = st.boostT > 1.0 ? -0.08 : (inp.down('brake') && st.phase === 'drive' && vf > 2 ? 0.05 : 0);
        tuk.body.rotation.x = damp(tuk.body.rotation.x, pitchT, 6, dt);
        tuk.body.position.y = Math.abs(Math.sin(time * 18)) * 0.015 * clamp(st.speed / 10, 0, 1);
        tuk.front.rotation.y = st.steerVis * 0.45;
        for (const w of tuk.wheels) w.rotation.x += vf * dt / 0.32;
        // compi: mira alrededor y levanta los brazos con el turbo
        if (st.boostT > 0 && st.phase === 'drive') tuk.compi.pose('cheer', time);
        else { tuk.compi.pose('sit', time); tuk.compi.rig.head.rotation.y = Math.sin(time * 0.6) * 0.5 + st.steerVis * -0.4; }
        tuk.under.material.opacity = 0.75 + Math.sin(time * 5) * 0.15;

        // estelas, chispas, agua
        const boosting = st.boostT > 0;
        const rx = st.x - fx * 1.45, rz = st.z - fz * 1.45;
        const col = boosting ? '#ff3fa4' : '#00e5ff';
        trailL.color.set(col); trailR.color.set(col);
        tmpV.set(rx + sx * 0.7, 0.8, rz + sz * 0.7); trailL.push(tmpV, boosting ? 1 : sliding ? 0.75 : 0);
        tmpV.set(rx - sx * 0.7, 0.8, rz - sz * 0.7); trailR.push(tmpV, boosting ? 1 : sliding ? 0.75 : 0);
        if (sliding) {
          const c = st.driftT > 2 ? ['#ff3fa4', '#ffd1ec'] : st.driftT > 1 ? ['#00e5ff', '#c9f7ff'] : ['#fff3b0', '#ffd23f'];
          for (const s of [-1, 1]) sparks.emit(2, tmpV.set(rx + sx * 0.75 * s, 0.2, rz + sz * 0.75 * s), { colors: c, vel: { x: -fx * 3, y: 2.5, z: -fz * 3 }, velSpread: 3, life: 0.35, gravity: -10, size: 0.22 });
          spray.emit(1, tmpV.set(rx, 0.3, rz), { color: wetNow ? '#b9c6e8' : '#8a849a', vel: { x: 0, y: 1, z: 0 }, velSpread: 1.5, life: 0.7, gravity: 0.5, size: 0.7 });
        }
        if (boosting) sparks.emit(2, tmpV.set(rx, 0.7, rz), { colors: ['#ff3fa4', '#00e5ff', '#ffffff'], vel: { x: -fx * 6, y: 0.5, z: -fz * 6 }, velSpread: 1.5, life: 0.3, gravity: 0, size: 0.35 });
        if (wetNow && st.speed > 7 && Math.random() < 0.45) for (const s of [-1, 1]) spray.emit(1, tmpV.set(rx + sx * 0.75 * s, 0.15, rz + sz * 0.75 * s), { color: '#9fb0d8', vel: { x: -fx * 2, y: 2.2, z: -fz * 2 }, velSpread: 1.2, life: 0.35, gravity: -9, size: 0.09 });
        if (wetNow && Math.random() < 0.9 * q.particles) {
          const a = Math.random() * 6.28, rr = 3 + Math.random() * 22;
          spray.emit(1, tmpV.set(st.x + Math.cos(a) * rr + fx * 10, 0.08, st.z + Math.sin(a) * rr + fz * 10), { color: '#dfe8ff', vel: { x: 0, y: 1.6, z: 0 }, velSpread: 1.2, life: 0.25, gravity: -9, size: 0.12 });
        }

        // ── objetivo, ruta y flecha ──
        if (st.target && st.phase !== 'end') {
          if (!(st._rt > 0)) { st.path = routeFrom(st.x, st.z); st._rt = 0.15; } else st._rt -= dt;
          const p0 = st.path[0] || [st.target.x, st.target.z];
          const close = Math.hypot(p0[0] - st.x, p0[1] - st.z) < 11 && st.path.length > 1;
          const g = close ? st.path[1] : p0;
          st.guide = g;
          const bearing = Math.atan2(g[0] - st.x, g[1] - st.z);
          st.arrowWant = st.phase === 'drive' || st.phase === 'board';
          arrow.position.set(st.x + fx * 2.6, 3.3 + Math.sin(time * 4) * 0.12, st.z + fz * 2.6);
          arrowYaw += angleDiff(arrowYaw, bearing) * Math.min(1, dt * 10);
          // inclinada hacia la cámara (sobre su eje derecho): se lee igual apunte adelante o a un lado
          camRight.set(-Math.cos(camYaw), 0, Math.sin(camYaw));
          arrow.quaternion.copy(qTilt.setFromAxisAngle(camRight, 0.8)).multiply(qYaw.setFromAxisAngle(UP, arrowYaw));
          const pulse = 1 + Math.sin(time * 6) * 0.08;
          ring.scale.set(pulse, 1, pulse); ring.rotation.y += dt;
          column.visible = ring.visible = disc.visible = true;
          colMat.opacity = clamp((dTarget - 7) / 22, 0, 1); // se desvanece al llegar (la cámara se mete dentro)
          disc.material.opacity = 0.5 * clamp(dTarget / 8, 0.25, 1);
        } else { st.arrowWant = false; column.visible = ring.visible = disc.visible = false; }
        // turistas esperando: saludan
        for (const w of st.waiting) {
          w.ch.pose(dTarget < 25 ? 'cheer' : 'wave', time + w.ph);
          if (dTarget < 30) w.obj.rotation.y = Math.atan2(st.x - w.obj.position.x, st.z - w.obj.position.z);
        }
        for (let k = st.leaving.length - 1; k >= 0; k--) {
          const l = st.leaving[k]; l.life -= dt;
          if (l.run) { l.ch.pose('run', time); l.obj.position.x += Math.sin(l.obj.rotation.y) * 4 * dt; l.obj.position.z += Math.cos(l.obj.rotation.y) * 4 * dt; }
          else l.ch.pose(l.life > 1.5 ? 'cheer' : 'wave', time);
          if (l.life < 0.4) l.obj.scale.setScalar(Math.max(0.01, l.life / 0.4));
          if (l.life <= 0) { scene.remove(l.obj); disposeTree(l.obj); st.leaving.splice(k, 1); }
        }

        // ── locales ──
        const cr = cop.rig;
        cop.pose('idle', time);
        const beat = time * 7;
        cr.armL.shoulder.rotation.z = 1.4 + Math.sin(beat) * 1.0; cr.armR.shoulder.rotation.z = -1.4 + Math.sin(beat + Math.PI) * 1.0;
        cr.armL.elbow.rotation.z = Math.sin(beat * 2) * 0.6; cr.armR.elbow.rotation.z = -Math.sin(beat * 2) * 0.6;
        cr.hips.position.y = 0.82 + Math.abs(Math.sin(beat)) * 0.06; cr.root.rotation.y = Math.sin(time * 1.3) * 0.9;
        cr.hips.rotation.z = Math.sin(beat) * 0.12; cr.head.rotation.z = Math.sin(beat) * 0.15;
        for (const v of vendors) {
          v.g.position.x += v.dir * v.sp * dt;
          if (v.g.position.x > v.x1) v.dir = -1;
          if (v.g.position.x < v.x0) v.dir = 1;
          v.g.rotation.y = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          v.body.position.y = Math.abs(Math.sin(time * 6)) * 0.05;
        }
        // gritos sobre la cabeza del local más cercano
        let lc = null, ld = 26;
        for (const l of locals) { l.cd -= dt; const d = l.obj.position.distanceTo(tuk.group.position); if (d < ld) { ld = d; lc = l; } }
        if (lc && lc.cd <= 0 && !hudB.localOn && st.phase !== 'intro') {
          lc.cd = 6 + Math.random() * 4; st.localTarget = lc;
          if (lc.kind === 'poli') { hudB.local(POLICIA[Math.floor(Math.random() * POLICIA.length)], 'poli'); if (Math.random() < 0.5) compiSay(COMPI.police); }
          else hudB.local(VENDEDORES[Math.floor(Math.random() * VENDEDORES.length)]);
        }
        if (st.localTarget && hudB.localOn) {
          tmpV.copy(st.localTarget.obj.position); tmpV.y += st.localTarget.head + 0.3; tmpV.project(camera);
          const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
          hudB.localPos((tmpV.x * 0.5 + 0.5) * innerWidth, (-tmpV.y * 0.5 + 0.5) * innerHeight, vis);
        }

        // ── cámara ──
        if (st.phase === 'intro') {
          // grúa: baja por la avenida desde lo alto hasta detrás del tuk-tuk
          const k = clamp(time / 7, 0, 1), e = 1 - Math.pow(1 - k, 3);
          const bx = -Math.sin(st.yaw), bz = -Math.cos(st.yaw);
          const dist = 95 - e * 86, h = 58 - e * 53.5;
          camPos.set(st.x + bx * dist + Math.sin(time * 0.4) * (1 - e) * 4, h, st.z + bz * dist);
          camera.position.lerp(camPos, 1 - Math.exp(-dt * 3));
          lookCur.lerp(tmpV.set(st.x - bx * (1 - e) * 30, 1.5, st.z - bz * (1 - e) * 30), 1 - Math.exp(-dt * 4));
          camera.lookAt(lookCur);
          camYaw = st.yaw;
        } else if (st.phase === 'end') {
          const et = Math.min(st.endT, 2.6), a = camYaw + Math.PI + et * 0.5;
          camPos.set(st.x + Math.sin(a) * (9 + et * 2), 4 + et * 2.2, st.z + Math.cos(a) * (9 + et * 2));
          camera.position.lerp(camPos, 1 - Math.exp(-dt * 3));
          lookCur.lerp(tmpV.set(st.x, 1.2, st.z), 1 - Math.exp(-dt * 6));
          camera.lookAt(lookCur);
        } else {
          // sigue al tuk-tuk con algo de retraso (en el derrape se nota el ángulo)
          const velYaw = st.speed > 4 ? Math.atan2(st.vx, st.vz) : st.yaw;
          const want = st.speed > 4 && Math.abs(angleDiff(st.yaw, velYaw)) < 1.2 ? st.yaw + angleDiff(st.yaw, velYaw) * 0.45 : st.yaw;
          camYaw += angleDiff(camYaw, want) * Math.min(1, dt * (st.phase === 'board' ? 2 : 4.2));
          const tall = innerWidth < innerHeight; // en vertical el campo horizontal es estrecho: más lejos
          const back = (tall ? 8.8 : 6.6) + Math.min(st.speed, 32) * 0.07, up = (tall ? 3.8 : 3.1) + Math.min(st.speed, 32) * 0.02;
          let bx = -Math.sin(camYaw) * back, bz = -Math.cos(camYaw) * back;
          // que la cámara no se meta dentro de los edificios
          // si hay un muro entre cámara y tuk-tuk, la cámara SUBE (casi no se acerca)
          let blocked = 0;
          for (let s2 = 1; s2 <= 8; s2++) { const k = s2 / 8; if (inBlock(st.x + bx * k, st.z + bz * k, 0.4)) { blocked = 1 - (s2 - 1) / 8; break; } }
          st.camLift = damp(st.camLift, blocked, blocked > st.camLift ? 10 : 3, dt);
          const keep = 1;
          bx *= keep; bz *= keep;
          camPos.set(st.x + bx, up + st.camLift * 7, st.z + bz);
          camera.position.lerp(camPos, 1 - Math.exp(-dt * 8));
          // distancia mínima: nunca encima del tuk-tuk
          const hx = camera.position.x - st.x, hz = camera.position.z - st.z, hd = Math.hypot(hx, hz), minD = tall ? 8 : 6.2;
          if (hd < minD) { const ux = hd > 0.01 ? hx / hd : -Math.sin(camYaw), uz = hd > 0.01 ? hz / hd : -Math.cos(camYaw); camera.position.x = st.x + ux * minD; camera.position.z = st.z + uz * minD; }
          camLook.set(st.x + Math.sin(camYaw) * 5, 1.55, st.z + Math.cos(camYaw) * 5);
          lookCur.lerp(camLook, 1 - Math.exp(-dt * 12));
          camera.lookAt(lookCur);
        }
        const fovT = 64 + Math.min(st.speed, 34) * 0.32 + (st.boostT > 0 ? 7 : 0);
        camera.fov = damp(camera.fov, fovT, 4, dt); camera.updateProjectionMatrix();
        moon.position.set(st.x - 30, 60, st.z - 18); moon.target.position.set(st.x, 0, st.z);
        sky.position.copy(camera.position);

        // ── lluvia y relámpagos ──
        const wantWet = ctx.save.data.settings.rain !== false; // se puede cambiar en pausa
        if (wantWet !== wetNow) { wetNow = wantWet; rain.mesh.visible = wetNow; city.setWet(wetNow); }
        if (wetNow) {
          rain.update(time, camera.position);
          st.nextFlash -= dt;
          if (st.nextFlash <= 0) { st.nextFlash = 14 + Math.random() * 18; st.flash = 1; setTimeout(() => audio.sfx('firework', { pitch: 0.35, vol: 0.55 }), 500); }
        }
        if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 3.5);
        hemi.intensity = 0.95 + st.flash * 2.2;
        sky.material.uniforms.top.value.set('#05021a').lerp(tmpColor.set('#9a8cff'), st.flash * 0.6);

        // ── sonido ──
        engineSnd.set({ rate: clamp(st.speed / 28, 0, 1.3) + (st.boostT > 0 ? 0.3 : 0), vol: st.phase === 'drive' ? 0.09 : 0.04 });
        rainSnd.set({ vol: wetNow ? 0.11 : 0 });
        const dm = Math.hypot(st.x - mid(2), st.z - mid(4));
        crowdSnd.set({ vol: clamp(1 - dm / 50, 0, 1) * 0.12 });
        audio.intensity(st.boostT > 0 ? 1 : 0.5);

        // ── HUD ──
        hudB.clock(st.left);
        hudB.money(st.money, st.delivered);
        hudB.turbo(st.turbo);
        if (st.cur && st.phase !== 'end') hudB.card(st.cur, st.mode, st.dest.name, st.tripLeft, st.tripMax);
        if (!(st._mt > 0)) {
          st._mt = 1 / 30;
          const tgt = st.target ? [st.target.x, st.target.z] : null;
          hudB.map(st.x, st.z, camYaw, st.path, tgt, st.mode === 'ride' ? '#00e5ff' : '#ff3fa4', q.particles >= 0.7 ? traffic.cars : null);
        } else st._mt -= rdt;

        // estado para pruebas
        E.fase = st.phase; E.modo = st.mode; E.turista = st.cur ? st.cur.id : '';
        E.entregados = st.delivered; E.fallidos = st.failed; E.dinero = st.money; E.tiempo = st.left;
        E.viaje = st.tripLeft; E.viajeMax = st.tripMax; E.turbo = st.turbo; E.derrape = st.driftT; E.choques = st.crashes; E.frenado = st.brakeUsed;
        E.jugador.x = st.x; E.jugador.z = st.z; E.jugador.yaw = st.yaw; E.jugador.v = st.speed;
        E.guia.x = st.guide[0]; E.guia.z = st.guide[1];
        if (st.target) { E.objetivo.x = st.target.x; E.objetivo.z = st.target.z; }
      },
      render(renderer) {
        arrow.visible = st.arrowWant && !engine.paused; // ni en pausa ni en el modo foto
        renderer.render(scene, camera);
      },
      dispose() {
        engineSnd.stop(); rainSnd.stop(); crowdSnd.stop();
        hudB.dispose(); tuk.dispose();
        rain.dispose();
        sparks.dispose(); spray.dispose();
        disposeTree(scene);
        E.terminado = true;
      },
    };
    return inst;
  },
};
