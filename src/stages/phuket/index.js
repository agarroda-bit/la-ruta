// ETAPA 1 · PHUKET — Scooter al atardecer.
// Carrera por la carretera de la costa hasta la villa del cumpleaños antes de que se
// ponga el sol. El sol ES el reloj. Mar siempre a la izquierda, selva a la derecha.
// Archivos: mundo.js (trazado, terreno, mar, cielo, decorado), modelos.js (low-poly),
// capa.js (burbujas, números flotantes, CSS), sonidos.js (efectos propios).
import * as THREE from 'three';
import { Particles } from '../../core/engine.js';
import { damp, clamp, lerp, smoothstep, fmtTime, disposeTree } from '../../core/util.js';
import { makeWorld, zoneType, S0, HALF, WALL } from './mundo.js';
import { Kit, G, T, matLit, scooterKit, wheelGeo, personKit, monkeyKit, dogBodyKit, dogHeadKit, chickenKit, localScooterKit, LOADS, cocoGeo, cartKit, tuktukKit } from './modelos.js';
import { makeSfx } from './sonidos.js';
import { makeCapa } from './capa.js';

const LG = 3200;           // metros de salida a meta
const TIME_LIMIT = 117;    // segundos de sol
const T_MARGEN = 16;       // margen para la 2ª estrella (y la 3ª con cocos)
const COCO_3 = 0.65;       // fracción de cocos para la 3ª estrella
const MK0 = S0 + 0.775 * LG, MK_GATES = 7, MK_GAP = 22, MK1 = MK0 + MK_GATES * MK_GAP; // mercado nocturno
const V_BASE = 26, V_TURBO = 37, V_FRENO = 7, V_ARENA = 16;

const SKY = [
  { k: 0.0, top: '#ff9a62', hor: '#ffd58a', sun: '#fff3c8', glow: '#ffbf6e', cloud: '#ffa08a', light: '#ffd9a0', li: 2.7, hs: '#ffe6c8', hg: '#6f7d5a', hi: 1.25, fog: '#ffcf96', sea: '#17a3b8' },
  { k: 0.45, top: '#ff7a62', hor: '#ffb070', sun: '#ffe08a', glow: '#ffa060', cloud: '#ff7f86', light: '#ffb57a', li: 2.3, hs: '#ffc8a8', hg: '#6a5e6a', hi: 1.12, fog: '#ffab80', sea: '#178fae' },
  { k: 0.8, top: '#7a45a8', hor: '#ff8a72', sun: '#ffb070', glow: '#ff7a5c', cloud: '#e0608a', light: '#ff9070', li: 1.6, hs: '#d494c4', hg: '#463e66', hi: 0.98, fog: '#f0849a', sea: '#2a6a9e' },
  { k: 1.0, top: '#2c2366', hor: '#d9607e', sun: '#ff6a4a', glow: '#d0506a', cloud: '#8a4a8a', light: '#b06ad9', li: 0.75, hs: '#8a6ab9', hg: '#2a2448', hi: 0.8, fog: '#9a5a8a', sea: '#22406f' },
];

const GRITOS = {
  carro: ['¡CUIDADO CON EL PAD THAI!', '¡MI CURRY!', '¡QUE VUELAN LOS MANGOS!'],
  tuktuk: ['¡TUK-TUK SIN INTERMITENTE!', '¡PI-PIII!'],
  mono: ['¡PERDÓN, SEÑOR MONO!', '¡EL MONO TIENE PREFERENCIA!', '¡MONO A BORDO!'],
  perro: ['¡GUAU! ¡QUE ESTABA DURMIENDO!', '¡PERRITO, PERDONA!', '¡SIESTA INTERRUMPIDA!'],
  gallina: ['¡COC-COCOOO!', '¡LLUEVEN PLUMAS!', '¡GALLINA EN FUGA!'],
  moto: ['¡PERDONA, VECINO!', '¡UY, QUE TE ROZO!', '¡SAWADEE… Y PERDÓN!'],
};

export default {
  id: 'phuket',
  music: 'phuket',
  ghost: true,
  controls: {
    joystick: 'steer',
    buttons: [
      { id: 'boost', label: 'TURBO', keys: ['ShiftLeft', 'ShiftRight', 'KeyX'], pad: [0, 7, 5], color: '#ff9f1c', size: 'big', pos: { right: 22, bottom: 40 } },
      { id: 'brake', label: 'FRENO', keys: ['Space', 'KeyZ'], pad: [1, 6, 4], color: '#3a86ff', hidden: true },
    ],
  },
  intro: [
    { who: 0, text: '¡Phuket! Treinta grados a la sombra… y no hay sombra.' },
    { who: 1, text: 'La villa del cumple está al final de la costa. ¡Hay que llegar antes de que se ponga el sol!' },
    { who: 0, text: 'Coge cocos por el camino. Y ojo con los monos: no respetan ni los pasos de cebra.' },
  ],

  async create(ctx) {
    const { rng, input: inp, engine, audio } = ctx;
    try {
      await Promise.race([
        Promise.all([document.fonts.load("64px 'Bungee'"), document.fonts.load("800 40px 'Baloo 2'")]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (e) { /* sin fuentes: se usan las del sistema */ }

    const scene = new THREE.Scene();
    const world = makeWorld(ctx, LG, { market: [MK0 - 6, MK1 + 4] });
    const { F, W, SF, dynamic: dyn } = world;
    scene.add(world.scene, world.sky);
    scene.fog = new THREE.Fog('#ffcf96', 140, 1150);
    scene.background = new THREE.Color('#ffcf96');
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 2400);

    const hemi = new THREE.HemisphereLight('#ffe6c8', '#6f7d5a', 1.25); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffd9a0', 2.7);
    sun.castShadow = true;
    const sz = Math.min(2048, (engine.q && engine.q.shadowSize) || 1024);
    sun.shadow.mapSize.set(sz, sz);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 240 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    const sfx = makeSfx(audio);
    const capa = makeCapa(ctx, camera);
    const fx = new Particles(scene, 700, { size: 0.35 });
    const fxAdd = new Particles(scene, 500, { size: 0.55, additive: true });
    const lit = matLit();
    const fr = world.mkFrame(), fr2 = world.mkFrame();
    const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);

    // ───────── scooter + piloto ({0}) + compi de paquete ({1}) ─────────
    const bike = new THREE.Group(); bike.rotation.order = 'YXZ';
    const inner = new THREE.Group(); bike.add(inner);
    { const k = new Kit(); scooterKit(k, '#2ec4b6', '#fff8ec', true); const m = k.mesh(lit); inner.add(m); }
    const headMat = new THREE.MeshBasicMaterial({ color: '#7a7060', toneMapped: false });
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.04), headMat); headlight.position.set(0, 1.15, 0.73); inner.add(headlight);
    const tailMat = new THREE.MeshBasicMaterial({ color: '#802030', toneMapped: false });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.03), tailMat); tail.position.set(0, 0.6, -0.885); inner.add(tail);
    const wg = wheelGeo();
    const wheels = [0.62, -0.6].map((z) => { const w = new THREE.Mesh(wg, lit); w.position.set(0, 0.27, z); inner.add(w); return w; });
    const rider = ctx.makeCharacter(ctx.looks[0]); rider.group.position.set(0, 0.37, -0.16); inner.add(rider.group);
    const pass = ctx.makeCharacter(ctx.looks[1]); pass.group.position.set(0, 0.42, -0.64); inner.add(pass.group);
    const extras = (ch) => {
      const hair = ch.rig.head.children.find((o) => o.isGroup && o.children.some((m) => m.material === ch.mats.hair));
      const piv = new THREE.Group(); piv.position.set(0, 0.42, -0.15); ch.rig.torso.add(piv);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.025), ch.mats.shirt); flap.position.y = -0.15; flap.castShadow = true; piv.add(flap);
      return { hair, piv };
    };
    const exR = extras(rider), exP = extras(pass);
    scene.add(bike);
    bike.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1a1036', transparent: true, opacity: 0.38, depthWrite: false }));
    blob.scale.set(0.62, 1, 1.25); blob.renderOrder = 1; scene.add(blob);
    const headPos = (ch, out = new THREE.Vector3()) => { ch.rig.head.getWorldPosition(out); out.y += 0.55; return out; };
    const anchor0 = () => headPos(rider, V3), anchor1 = () => headPos(pass, V3);

    // fantasma: una copia del scooter con dos siluetas
    let ghostG = null;
    if (ctx.ghost.data) {
      const k = new Kit(); scooterKit(k, '#ffffff', '#ffffff', false);
      k.push(T({ y: 0.3, z: -0.2 })); personKit(k, { sit: true }); k.pop();
      k.push(T({ y: 0.36, z: -0.66 })); personKit(k, { sit: true }); k.pop();
      ghostG = new THREE.Group(); ghostG.rotation.order = 'YXZ'; ghostG.add(k.mesh(lit));
      scene.add(ghostG);
      ctx.ghost.spawn(ghostG, '#9ad7ff');
    }

    // ───────── obstáculos y cocos (todo con rng con semilla) ─────────
    const haz = [];
    const cocoSpots = [];
    const lane = () => rng.pick([-3, 0, 3]);
    const cocoLine = (s, d, n, gap = 6) => { for (let i = 0; i < n; i++) cocoSpots.push({ s: s + i * gap, d, y: 1.0 }); };
    const cocoSlalom = (s, n) => { const ph = rng() * 6; for (let i = 0; i < n; i++) cocoSpots.push({ s: s + i * 6, d: Math.sin(ph + i * 0.65) * 3.2, y: 1.0 }); };
    const cocoArc = (s, d) => { for (let i = 0; i < 5; i++) { const x = (i + 0.5) / 5; cocoSpots.push({ s: s + 3 + x * 15, d, y: 1.0 + 4 * 1.25 * x * (1 - x) }); } };
    const cocoPattern = (s) => { const r = rng(); if (r < 0.45) cocoLine(s, lane(), rng.int(4, 5)); else if (r < 0.8) cocoSlalom(s, rng.int(5, 6)); else { cocoLine(s, -3, 3, 7); cocoLine(s + 21, 3, 3, 7); } };
    const addMonkey = (s, coco) => haz.push({ type: 'mono', s, side: rng.chance(0.5) ? 1 : -1, d: 0, state: 'espera', ph: 0, trig: rng.range(1.1, 1.6), pause: rng.chance(0.45), coco, minDD: 99, rs: 0.45, rd: 0.45 });
    const addDog = (s, d) => haz.push({ type: 'perro', s, d, rs: 0.75, rd: 0.6, state: 'tumbado', yaw: rng.range(-1.2, 1.2) });
    const addChickens = (s) => { const c = lane(); for (let i = 0; i < 3; i++) haz.push({ type: 'gallina', s: s + i * 3.2, dc: c + rng.range(-1, 1), d: c, amp: rng.range(1.5, 3.2), sp: rng.range(1.2, 2.2), ph: rng() * 6, rs: 0.35, rd: 0.35, state: 'pica' }); };
    const addScooter = (s, oncoming) => haz.push({ type: 'moto', s, s0: s, d: oncoming ? 2.7 : -2.6, d0: oncoming ? 2.7 : -2.6, v: oncoming ? -rng.range(10, 13) : rng.range(12.5, 15.5), active: false, load: rng.pick(LOADS), rs: 1.05, rd: 0.55, greeted: false, bump: 0, state: 'va' });
    const addPuddle = (s, d) => haz.push({ type: 'charco', s, d, r: rng.range(1.5, 2.3), rs: 0, rd: 0 });
    const addBump = (s) => haz.push({ type: 'baden', s, d: 0, rs: 0.5, rd: 6 });

    cocoLine(S0 + 30, 0, 6);
    let first = true;
    for (let s = S0 + 110; s < SF - 110; s += rng.range(52, 74)) {
      const u = (s - S0) / LG, zt = zoneType(u), r = rng();
      if (s > MK0 - 60 && s < MK1 + 50) continue;
      if (zt === 'acantilado') {
        if (r < 0.42) { const coco = first || rng.chance(0.4); first = false; addMonkey(s, coco); cocoLine(s - 14, rng.pick([-3.2, 3.2]), 3); }
        else if (r < 0.56) { addBump(s); cocoArc(s, lane()); }
        else if (r < 0.66) { addPuddle(s, lane()); cocoLine(s - 8, rng.pick([-3.4, 3.4]), 3); }
        else if (r < 0.8) addScooter(s + 60, rng.chance(0.4));
        else cocoPattern(s);
      } else if (zt === 'pueblo') {
        if (u > 0.68 && r < 0.3) { addMonkey(s, rng.chance(0.5)); if (rng.chance(0.5)) addChickens(s + 30); }
        else if (r < 0.2) { addChickens(s); }
        else if (r < 0.37) { const d = lane(); addDog(s, d); cocoLine(s - 10, d === 0 ? rng.pick([-3, 3]) : -d, 3); }
        else if (r < 0.52) addScooter(s + 50, rng.chance(0.45));
        else if (r < 0.62) { addBump(s); cocoArc(s, lane()); }
        else cocoPattern(s);
      } else if (zt === 'playa') {
        if (r < 0.2) { const d = lane(); addPuddle(s, d); if (rng.chance(0.5)) addPuddle(s + 7, rng.pick([-3, 0, 3].filter((x) => x !== d))); }
        else if (r < 0.36) addScooter(s + 60, rng.chance(0.35));
        else if (r < 0.46) { const d = lane(); addDog(s, d); cocoLine(s - 10, d === 0 ? 3 : -d, 3); }
        else if (r < 0.56) { addBump(s); cocoArc(s, lane()); }
        else cocoPattern(s);
      } else {
        if (r < 0.2) addChickens(s); else cocoPattern(s);
      }
    }
    // mercado nocturno: puertas de carritos que tapan dos carriles; el hueco tiene un coco dorado
    const GAPS = [0, 3, -3, 0, -3, 3, 0];
    for (let i = 0; i < MK_GATES; i++) {
      const gs = MK0 + 10 + i * MK_GAP, gap = GAPS[i % GAPS.length];
      for (const d of [-3.4, 0, 3.4]) if (Math.abs(d - gap * 1.13) > 1) haz.push({ type: 'carro', s: gs + rng.range(-1, 1), d, rs: 0.6, rd: 0.95, state: 'quieto' });
      cocoSpots.push({ s: gs, d: gap * 1.13, y: 1.0, gold: true });
      cocoSpots.push({ s: gs - 6, d: gap * 1.13, y: 1.0 });
    }
    haz.push({ type: 'tuktuk', s: MK1 + 30, side: 1, d: 10, state: 'espera', ph: 0, rs: 1.3, rd: 0.95 });
    cocoLine(MK1 + 50, 0, 5);
    // los cocos no pueden caer encima de un charco o de un perro
    const cocos = cocoSpots.filter((c) => c.s < SF - 10 && !haz.some((h) => (h.type === 'charco' || h.type === 'perro') && Math.abs(h.s - c.s) < 3 && Math.abs(h.d - c.d) < 2));
    const totalCocos = cocos.length;

    // mallas de obstáculos
    const kitMesh = (fn) => { const k = new Kit(); fn(k); const m = k.mesh(lit); m.castShadow = true; return m; };
    const monkeyG = (() => { const k = new Kit(); monkeyKit(k); return k.geometry(); })();
    const chickG = [(() => { const k = new Kit(); chickenKit(k, '#fff8ec'); return k.geometry(); })(), (() => { const k = new Kit(); chickenKit(k, '#b5651d'); return k.geometry(); })()];
    const dogCols = [['#d9a066', '#fff1dc', '#8a5a2b'], ['#3a2e2a', '#e8dcc8', '#2a1d18'], ['#e8dcc8', '#ffffff', '#c9a27e']];
    const cocoGeom = cocoGeo();
    const puddleKit = new Kit(), bumpKit = new Kit();
    for (const h of haz) {
      if (h.type === 'mono') {
        h.mesh = new THREE.Group();
        const body = new THREE.Mesh(monkeyG, lit); body.castShadow = true; h.mesh.add(body); h.body = body;
        if (h.coco) { const c = new THREE.Mesh(cocoGeom, lit); c.scale.setScalar(0.75); c.position.set(0, 0.62, 0.32); h.mesh.add(c); h.cocoMesh = c; }
        h.d = h.side * 8.8;
      } else if (h.type === 'perro') {
        const [c1, c2, c3] = rng.pick(dogCols);
        h.mesh = new THREE.Group();
        h.mesh.add(kitMesh((k) => dogBodyKit(k, c1, c2)));
        h.head = new THREE.Group(); h.head.position.set(0, 0.28, 0.62); h.mesh.add(h.head);
        h.head.add(kitMesh((k) => dogHeadKit(k, c1, c3)));
      } else if (h.type === 'gallina') {
        h.mesh = new THREE.Mesh(chickG[rng.chance(0.6) ? 0 : 1], lit); h.mesh.castShadow = true;
      } else if (h.type === 'moto') {
        h.mesh = new THREE.Group(); h.mesh.rotation.order = 'YXZ';
        h.mesh.add(kitMesh((k) => localScooterKit(k, rng, h.load)));
        const w1 = new THREE.Mesh(wg, lit); w1.position.set(0, 0.27, 0.62); const w2 = w1.clone(); w2.position.z = -0.6; h.mesh.add(w1, w2); h.wheels = [w1, w2];
        h.arm = new THREE.Group(); h.arm.position.set(-0.27, 1.38, -0.2); h.mesh.add(h.arm);
        h.arm.add(kitMesh((k) => k.add(G.box, '#ffd166', { y: -0.24, sx: 0.11, sy: 0.48, sz: 0.12 })));
      } else if (h.type === 'carro') {
        h.mesh = kitMesh((k) => cartKit(k, rng));
      } else if (h.type === 'tuktuk') {
        h.mesh = kitMesh((k) => tuktukKit(k));
      } else if (h.type === 'charco') {
        const p = W(h.s, h.d); F(h.s, fr);
        const yaw = Math.atan2(fr.t.x, fr.t.z);
        puddleKit.add(G.cyl10, '#7fb7d6', { x: p.x, y: p.y + 0.035, z: p.z, sx: h.r * 2, sy: 0.02, sz: h.r * 2.6, ry: yaw });
        puddleKit.add(G.cyl10, '#a8d8ef', { x: p.x + 0.3, y: p.y + 0.045, z: p.z, sx: h.r * 1.0, sy: 0.02, sz: h.r * 1.2, ry: yaw });
      } else if (h.type === 'baden') {
        F(h.s, fr);
        const yaw = Math.atan2(fr.t.x, fr.t.z);
        for (let i = 0; i < 10; i++) {
          const d = -4.5 + i;
          const p = V.copy(fr.p).addScaledVector(fr.n, d + 0.5);
          bumpKit.add(G.box, i % 2 ? '#1a1036' : '#ffd166', { x: p.x, y: p.y + 0.08, z: p.z, sx: 1, sy: 0.16, sz: 0.9, ry: yaw, order: 'YXZ' });
        }
      }
      if (h.mesh) { scene.add(h.mesh); h.mesh.visible = false; }
    }
    if (!puddleKit.empty) { const pm = puddleKit.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.4, flatShading: true })); pm.receiveShadow = true; scene.add(pm); }
    if (!bumpKit.empty) { const bm = bumpKit.mesh(lit); bm.receiveShadow = true; scene.add(bm); }

    // cocos: un InstancedMesh
    const cocoIM = new THREE.InstancedMesh(cocoGeom, lit, Math.max(1, cocos.length));
    const goldGeom = (() => { const k = new Kit(); k.add(G.ico1, '#ffc93c', { sx: 0.8, sy: 0.88, sz: 0.8 }); k.add(G.ico0, '#fff3b0', { y: 0.15, z: 0.25, sx: 0.34, sy: 0.34, sz: 0.2 }); k.add(G.cyl5, '#ff4fa3', { x: 0.06, y: 0.62, sx: 0.07, sy: 0.6, sz: 0.07, rz: -0.25 }); return k.geometry(); })();
    const goldIM = new THREE.InstancedMesh(goldGeom, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.25, metalness: 0.6, emissive: '#7a4a00', emissiveIntensity: 0.9 }), Math.max(1, cocos.filter((c) => c.gold).length));
    const tmpO = new THREE.Object3D();
    let ni = 0, gi = 0;
    cocos.forEach((c) => { c.p = W(c.s, c.d, c.y); c.taken = false; c.im = c.gold ? goldIM : cocoIM; c.i = c.gold ? gi++ : ni++; tmpO.position.copy(c.p); tmpO.updateMatrix(); c.im.setMatrixAt(c.i, tmpO.matrix); });
    cocos.forEach((c, i) => { c.hi = i; });
    for (const im of [cocoIM, goldIM]) { im.computeBoundingSphere(); im.frustumCulled = false; scene.add(im); }
    // halo bajo cada coco cercano (para verlos de lejos)
    const halo = new THREE.InstancedMesh(new THREE.RingGeometry(0.45, 0.7, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), Math.max(1, cocos.length));
    cocos.forEach((c, i) => { const p = W(c.s, c.d, 0.06); tmpO.position.copy(p); tmpO.rotation.set(0, 0, 0); tmpO.scale.setScalar(c.y > 1.2 ? 0.001 : 1); tmpO.updateMatrix(); halo.setMatrixAt(i, tmpO.matrix); if (c.gold) halo.setColorAt(i, new THREE.Color('#ffb703')); else halo.setColorAt(i, new THREE.Color('#ffffff')); });
    halo.frustumCulled = false; scene.add(halo);

    // ───────── estado ─────────
    const st = {
      phase: 'intro', s: S0, d: -1.5, v: 0, rel: 0, drift: 0, driftT: 0, y: 0, vy: 0, air: 0, slide: 0, slideV: 0,
      fuel: 1, boosting: false, boostLock: false, inv: 0, wob: 0, squash: 0, cheer: 0, scream: 0, lean: 0, steerVis: 0,
      t: 0, cocos: 0, combo: 0, comboT: 0, bestCombo: 0, mult: 1, score: 0, crashes: 0, monkeyHits: 0, wallT: 0,
      finT: 0, win: false, done: false, kVis: 0, time: 0, finished: false, monkeySeen: false, sticker1: false,
    };
    const talks = [
      { when: () => st.t > 5, who: 1, text: '¿Llevas crema? Me estoy dorando como un pollo a l\'ast.' },
      { when: () => st.monkeySeen, who: 0, text: '¡Ese mono lleva un coco! ¡Es NUESTRO coco!' },
      { when: () => (st.s - S0) / LG > 0.52, who: 0, text: 'Aún me pica el pad thai de ayer.' },
      { when: () => (st.s - S0) / LG > 0.55, who: 1, text: 'Pediste «poco picante». Aquí eso es lava.' },
      { when: () => (st.s - S0) / LG > 0.76, who: 1, text: 'Tengo un jet lag que no sé si es martes o Bangkok.' },
      { when: () => TIME_LIMIT - st.t < 20 && (st.s - S0) / LG < 0.95, who: 1, text: '¡Que se pone el sol! ¡TURBO, TURBO!' },
    ];
    let disposed = false;
    const engineSnd = audio.loop('scooter');
    const wavesSnd = audio.loop('waves');
    const startF = F(st.s, world.mkFrame());

    // cámara inicial
    camera.position.copy(startF.p).addScaledVector(startF.t, 9).addScaledVector(startF.n, -5).add(V.set(0, 2.5, 0));
    const camLook = new THREE.Vector3().copy(startF.p).add(V.set(0, 1.2, 0));
    let camOrbit = 0;

    // HUD
    const isTouch = () => inp.lastDevice === 'touch';
    const solEl = ctx.hud.set('sol', '<div class="pk-sol-cielo"><i></i></div><span>0:00.0</span>', 'centro');
    const solI = solEl.querySelector('i'), solSpan = solEl.querySelector('span');
    const hudZoom = () => { if (!ctx.hud.el) return; const z = innerWidth >= 700 ? clamp(innerHeight / 560, 1, 2.2) : 1; ctx.hud.el.style.setProperty('--pk-z', z.toFixed(2)); };
    const updateHud = () => {
      hudZoom();
      const left = Math.max(0, TIME_LIMIT - st.t);
      const k = clamp(st.t / TIME_LIMIT, 0, 1);
      solI.style.setProperty('--k', k.toFixed(3));
      const txt = fmtTime(left); if (solSpan.textContent !== txt) solSpan.textContent = txt;
      solEl.classList.toggle('prisa', left < 15 && st.phase === 'carrera');
      ctx.hud.set('cocos', `🥥 ${st.cocos}<small style="opacity:.6;font-size:.7em">/${totalCocos}</small>`, 'izq');
      if (st.mult > 1) { const e = ctx.hud.set('combo', `RACHA x${st.mult}`, 'izq'); e.classList.toggle('x3', st.mult >= 3); } else ctx.hud.remove('combo');
      ctx.hud.bar('prog', clamp((st.s - S0) / LG, 0, 1), 'VILLA 🏡', 'centro', '#ff6f61');
      const btn = document.querySelector('.controles .btn-tactil[data-id="boost"]');
      if (btn) { btn.style.setProperty('--turbo', st.fuel.toFixed(3));  btn.classList.toggle('vacio', st.fuel < 0.12); btn.classList.toggle('lleno', st.fuel > 0.98 && st.phase === 'carrera'); }
      if (!isTouch()) ctx.hud.bar('turbo', st.fuel, 'TURBO (Shift)', 'abajo', '#ff9f1c'); else ctx.hud.remove('turbo');
    };
    updateHud();

    // ───────── utilidades de juego ─────────
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    let lastShout = -9, lastPrio = 0;
    const grito = (text, opts = {}, prio = 1) => {
      if (st.time - lastShout < 1.1 && prio <= lastPrio) return;
      lastShout = st.time; lastPrio = prio;
      if (st.phase === 'carrera') document.querySelectorAll('.grito').forEach((e) => e.remove());
      ctx.shout(text, opts);
    };
    const bikeDir = new THREE.Vector3();
    function crash(kind, h) {
      if (st.inv > 0) return;
      st.inv = 1.15; st.crashes++;
      if (st.combo >= 3) capa.num('racha rota', V.copy(bike.position).setY(bike.position.y + 2.2), 'mal');
      st.combo = 0; st.mult = 1;
      const keep = { mono: 0.4, perro: 0.42, moto: 0.36, gallina: 0.62, carro: 0.45, tuktuk: 0.35 }[kind] ?? 0.5;
      st.v *= keep; st.wob = 0.8; st.rel *= -0.4; st.scream = 0.9;
      engine.shake(kind === 'gallina' ? 0.3 : 0.6); ctx.vibrate(kind === 'gallina' ? 30 : 70);
      audio.sfx('hit'); sfx.ay(); sfx.frenazo();
      grito(pick(GRITOS[kind]), { size: 'peque', color: '#ff6f61' }, 3);
      const hp = h.mesh ? h.mesh.position : bike.position;
      if (kind === 'mono') {
        st.monkeyHits++; h.state = 'vuela'; h.vy = 7; h.vd = (h.d > st.d ? 1 : -1) * 7; h.spin = 0;
        audio.sfx('monkey'); sfx.mono(); engine.slowmo(0.35, 0.3);
        fx.emit(8, hp, { colors: ['#8d6346', '#d9b48f'], vel: { x: 0, y: 4, z: 0 }, velSpread: 5, life: 0.7 });
      } else if (kind === 'perro') {
        h.state = 'huye'; h.vd = h.d >= st.d ? 1 : -1; audio.sfx('dog'); sfx.guau();
      } else if (kind === 'gallina') {
        h.state = 'vuela'; h.vy = 6; h.vd = (h.d >= st.d ? 1 : -1) * 4; sfx.coc();
        fx.emit(14, V.copy(hp).setY(hp.y + 0.5), { colors: ['#ffffff', '#fff8ec', '#ffe8c8'], vel: { x: 0, y: 3, z: 0 }, velSpread: 6, life: 1.4, gravity: -1.5, size: 0.3 });
      } else if (kind === 'carro') {
        h.state = 'golpe'; h.wob = 0.6; audio.sfx('crash', { vol: 0.5 });
        fx.emit(10, V.copy(hp).setY(hp.y + 1.3), { colors: ['#ffb703', '#e63946', '#8ac926'], vel: { x: 0, y: 4, z: 0 }, velSpread: 4, life: 0.8, size: 0.3 });
      } else if (kind === 'tuktuk') {
        audio.sfx('tuk-horn');
      } else if (kind === 'moto') {
        h.bump = 1; audio.sfx('bike-horn'); capa.num('¡Mai pen rai!', V.copy(hp).setY(hp.y + 2.4));
      }
      fxAdd.emit(4, V.copy(bike.position).setY(bike.position.y + 1.2), { colors: ['#ffffff'], vel: { x: 0, y: 3, z: 0 }, velSpread: 5, life: 0.3, size: 0.3 });
    }
    function takeCoco(c, bonus = false) {
      c.taken = true;
      tmpO.position.set(0, -999, 0); tmpO.scale.setScalar(0.001); tmpO.updateMatrix();
      c.im.setMatrixAt(c.i, tmpO.matrix); c.im.instanceMatrix.needsUpdate = true;
      halo.setMatrixAt(c.hi, tmpO.matrix); halo.instanceMatrix.needsUpdate = true;
      gainCoco(c.p, bonus, c.gold);
    }
    function gainCoco(pos, bonus = false, gold = false) {
      st.cocos++;
      st.combo = st.comboT > 0 ? st.combo + 1 : 1; st.comboT = 1.7;
      st.bestCombo = Math.max(st.bestCombo, st.combo);
      const newMult = st.combo >= 15 ? 4 : st.combo >= 10 ? 3 : st.combo >= 5 ? 2 : 1;
      if (newMult > st.mult) { if (newMult >= 3) grito(`RACHA x${newMult}`, { size: 'peque', color: newMult === 4 ? '#2ec4b6' : '#ff4fa3', ms: 900 }, 2); sfx.combo(newMult); }
      st.mult = newMult;
      const pts = (gold ? 50 : 10) * st.mult + (bonus ? 20 : 0);
      st.score += pts;
      st.fuel = Math.min(1, st.fuel + (gold ? 0.2 : 0.07));
      if (gold) { sfx.combo(4); capa.num(`¡DORADO! +${pts}`, pos, 'grande'); fxAdd.emit(8, pos, { colors: ['#ffd166', '#fff3b0', '#ffb703'], vel: { x: 0, y: 3, z: 0 }, velSpread: 4, life: 0.5, size: 0.4 }); }
      else if (bonus) capa.num(`¡COCO RECUPERADO! +${pts}`, pos, 'grande'); else capa.sum(pts, bike.position, st.mult);
      audio.sfx('coin-combo', { pitch: Math.pow(2, Math.min(st.combo - 1, 14) / 12), vol: 0.8 });
      sfx.coco(st.combo - 1);
      fxAdd.emit(4, pos, { colors: ['#fff3b0', '#ffd166'], vel: { x: 0, y: 2.5, z: 0 }, velSpread: 3, life: 0.35, size: 0.35 });
      fx.emit(2, pos, { colors: ['#6ab04c', '#8fd16a'], vel: { x: 0, y: 3, z: 0 }, velSpread: 3, life: 0.5, size: 0.22 });
      ctx.hud.pop('cocos');
      st.cheer = 0.5;
      if (!st.sticker1) { st.sticker1 = true; ctx.sticker('primer-coco'); }
    }

    // ───────── carrera ─────────
    function stepRace(dt) {
      st.t += dt;
      const steer = clamp(inp.x, -1, 1);
      const braking = inp.down('brake') || inp.y < -0.4;
      const wantBoost = inp.down('boost') && !braking;
      if (!wantBoost) st.boostLock = false;
      const canBoost = wantBoost && !st.boostLock && st.fuel > 0.01;
      if (canBoost && !st.boosting) { sfx.turbo(); audio.sfx('boost');  }
      st.boosting = canBoost;
      if (st.boosting) { st.fuel -= dt / 2.6; if (st.fuel <= 0) { st.fuel = 0; st.boostLock = true; st.boosting = false; } }
      else st.fuel = Math.min(1, st.fuel + dt / 13);
      if (st.fuel >= 1 && !st.fullNotified) { st.fullNotified = true; sfx.plink(3); } if (st.fuel < 0.95) st.fullNotified = false;
      audio.intensity(st.boosting ? 1 : 0.4);

      const offroad = Math.abs(st.d) > HALF + 0.3;
      let target = braking ? V_FRENO : st.boosting ? V_TURBO : V_BASE;
      if (offroad && !st.boosting) target = Math.min(target, V_ARENA);
      if (offroad && st.boosting) target = Math.min(target, V_BASE);
      const up = st.v < target;
      st.v = damp(st.v, target, up ? (st.boosting ? 1.5 : 0.75) : braking ? 2.6 : 0.8, dt);

      const air = st.y > 0.05;
      const grip = air ? 0.25 : st.slide > 0 ? 0.3 : 1;
      st.rel = damp(st.rel, steer * 0.44, 7 * grip, dt);
      // derrape suave
      if (Math.abs(steer) > 0.7 && st.v > 18 && !air && st.slide <= 0) {
        st.driftT += dt; st.drift = damp(st.drift, Math.sign(steer) * 0.3, 4, dt);
        if (Math.random() < 0.25) fx.emit(1, V.copy(bike.position).addScaledVector(bikeDir, -0.7).setY(bike.position.y + 0.15), { color: '#e8dcd0', vel: { x: 0, y: 1.2, z: 0 }, velSpread: 1, life: 0.6, gravity: 0.5, size: 0.5 });
        if (st.driftT > 0.3 && Math.floor(st.driftT * 3) !== Math.floor((st.driftT - dt) * 3)) audio.sfx('drift', { vol: 0.5 });
      } else {
        if (st.driftT > 1.0 && st.slide <= 0) { st.v += 5; st.fuel = Math.min(1, st.fuel + 0.15); grito('¡DERRAPE!', { size: 'peque', color: '#2ec4b6' }); audio.sfx('boost', { vol: 0.6 }); }
        st.driftT = 0; st.drift = damp(st.drift, 0, 6, dt);
      }
      F(st.s, fr);
      const push = -1.1 * fr.curv * st.v * st.v * (air ? 0.5 : 1);
      st.d += (st.v * Math.sin(st.rel) + push + st.slideV) * dt;
      st.s += st.v * Math.cos(st.rel) * dt;
      if (st.slide > 0) { st.slide -= dt; st.slideV = damp(st.slideV, 0, 2.5, dt); } else st.slideV = 0;
      // bordes: barandilla del mar y talud de la montaña
      const lim = WALL - 0.45;
      st.wallT -= dt;
      if (Math.abs(st.d) > lim) {
        const sgn = Math.sign(st.d);
        st.d = sgn * lim;
        if (Math.sign(st.rel) === sgn) st.rel *= -0.35;
        if (st.wallT <= 0) {
          st.wallT = 0.5; st.v *= 0.88; engine.shake(0.18); sfx.chispas();
          fxAdd.emit(4, V.copy(bike.position).addScaledVector(fr.n, sgn * 0.5).setY(bike.position.y + 0.5), { colors: ['#ffd166', '#ffffff'], vel: { x: 0, y: 2, z: 0 }, velSpread: 3, life: 0.22, size: 0.2 });
        }
      }
      if (offroad && !air && Math.random() < 0.25) fx.emit(1, V.copy(bike.position).setY(bike.position.y + 0.2), { color: '#e0c08a', vel: { x: 0, y: 1.5, z: 0 }, velSpread: 2, life: 0.6, size: 0.55 });
      // salto
      if (air || st.vy > 0) {
        st.air += dt; st.y += st.vy * dt; st.vy -= 20 * dt;
        if (st.y <= 0) {
          if (st.air > 0.3) { st.squash = 1; sfx.plof(); engine.shake(0.15); fx.emit(10, V.copy(bike.position), { color: '#e8d8c0', vel: { x: 0, y: 1.5, z: 0 }, velSpread: 4, life: 0.5, size: 0.5 }); }
          st.y = 0; st.vy = 0; st.air = 0;
        }
      }
      st.inv -= dt; st.wob = Math.max(0, st.wob - dt);
      st.comboT -= dt; if (st.comboT <= 0 && st.combo > 0) { st.combo = 0; st.mult = 1; }

      // cocos
      for (const c of cocos) {
        if (c.taken || Math.abs(c.s - st.s) > 2.2) continue;
        if (Math.abs(c.d - st.d) < 1.35 && Math.abs(c.y - (st.y + 1.0)) < 1.15) takeCoco(c);
      }
      // obstáculos
      for (const h of haz) {
        const ds = h.s - st.s;
        if (ds < -3 || ds > 3) {
          if (h.type === 'mono' && h.coco && !h.checked && ds < -3) { h.checked = true; if (h.minDD < 3.4 && h.state !== 'vuela' && h.cocoMesh && h.cocoMesh.visible) { h.cocoMesh.visible = false; gainCoco(V.copy(h.mesh.position).setY(h.mesh.position.y + 1), true); sfx.mono(); } }
          continue;
        }
        const dd = h.d - st.d;
        if (h.type === 'baden') {
          if (!h.done && ds < 0.3 && st.y < 0.2) { h.done = true; st.vy = 6.4 + (st.boosting ? 2.2 : 0) + st.v * 0.04; sfx.boing(); }
          continue;
        }
        if (h.type === 'charco') {
          if (!h.done && ds * ds / (h.r * h.r * 1.3) + dd * dd / (h.r * h.r) < 1 && st.y < 0.3) {
            h.done = true; st.slide = 0.9; st.slideV = (h.s % 2 > 1 ? 1 : -1) * 3.2; st.vy = 2.4;
            audio.sfx('splash'); sfx.chof(); engine.shake(0.12);
            fx.emit(14, V.copy(bike.position).setY(bike.position.y + 0.2), { colors: ['#bfe9ff', '#ffffff', '#7fb7d6'], vel: { x: 0, y: 4.5, z: 0 }, velSpread: 5, life: 0.7, size: 0.35, gravity: -12 });
            grito(pick(['¡AQUAPLANING!', '¡QUE PATINO!', '¡CHOF!']), { size: 'peque', color: '#7fd3ff' }, 1);
          }
          continue;
        }
        if (h.type === 'mono' && h.coco && Math.abs(ds) < 1.5) h.minDD = Math.min(h.minDD, Math.abs(dd));
        if (h.state === 'vuela' || h.state === 'huye') continue;
        if (st.y > 0.9 && h.type !== 'moto' && h.type !== 'carro' && h.type !== 'tuktuk') continue; // lo saltas por encima
        if (Math.abs(ds) < 0.9 + h.rs && Math.abs(dd) < 0.42 + h.rd) crash(h.type, h);
        else if (h.type === 'moto' && !h.greeted && Math.abs(ds) < 4 && Math.abs(dd) < 3.8) {
          h.greeted = true; h.wave = 1.6; audio.sfx('bike-horn', { pitch: 1.2, vol: 0.6 });
          if (Math.random() < 0.6) capa.num(pick(['¡Sawadee!', '¡Hola, farang!', '¡Buen viaje!', '¡Feliz cumple!']), V.copy(h.mesh.position).setY(h.mesh.position.y + 2.6));
        }
      }
      // mercado nocturno
      if (!st.mkIn && st.s > MK0 - 35) { st.mkIn = true; st.mkCrash = st.crashes; grito('¡MERCADO NOCTURNO!', { color: '#ffd166' }, 4); capa.say(0, '¡Zigzag entre los carritos! ¡Los cocos dorados valen x5!', anchor0, 2600); audio.sfx('crowd-ooh', { vol: 0.6 }); }
      if (st.mkIn && !st.mkOut && st.s > MK1 + 4) {
        st.mkOut = true;
        if (st.crashes === st.mkCrash) { st.score += 300; grito('¡ENHEBRADO PERFECTO! +300', { color: '#2ec4b6' }, 4); audio.sfx('crowd-cheer', { vol: 0.7 }); sfx.fiesta(); st.fuel = 1; }
        else grito('¡FUERA DEL MERCADO!', { size: 'peque', color: '#ffd166' }, 3);
      }
      // diálogos
      for (const tk of talks) if (!tk.done && tk.when()) { tk.done = true; capa.say(tk.who, tk.text, tk.who === 0 ? anchor0 : anchor1, 2800); break; }

      // turbo: estela, líneas de aire
      if (st.boosting) {
        const rear = V.copy(bike.position).addScaledVector(bikeDir, -0.95).setY(bike.position.y + 0.4);
        if (Math.random() < 0.5) fxAdd.emit(1, rear, { colors: ['#ffd166', '#ffb36b'], vel: { x: bikeDir.x * 14, y: 0.4, z: bikeDir.z * 14 }, velSpread: 0.6, life: 0.2, size: 0.22, gravity: 0 });
        if (Math.random() < 0.35) {
          F(st.s + 16, fr2);
          const p = V2.copy(fr2.p).addScaledVector(fr2.n, st.d + (Math.random() - 0.5) * 12).setY(fr2.p.y + 0.5 + Math.random() * 3.5);
          fxAdd.emit(1, p, { color: '#fff8ec', vel: { x: -fr2.t.x * 45, y: 0, z: -fr2.t.z * 45 }, velSpread: 0, life: 0.45, size: 0.18, gravity: 0 });
        }
      }

      if (st.s >= SF) finishRace(true);
      else if (st.t >= TIME_LIMIT) finishRace(false);
    }

    function finishRace(win) {
      if (st.done) return;
      st.done = true; st.win = win; st.phase = 'fin'; st.finT = 0; st.boosting = false;
      capa.clear();
      audio.intensity(win ? 1 : 0.2);
      if (win) {
        ctx.shout('¡LLEGAMOS!', { color: '#ffd166', ms: 1600 });
        sfx.fiesta(); audio.sfx('crowd-cheer'); ctx.confetti(160);
        setTimeout(() => { if (!disposed) capa.say(1, '¡Feliz cumple! ¡Y con sol y todo!', anchor1, 2400); }, 900);
      } else {
        ctx.shout('SE PUSO EL SOL…', { color: '#c58ac9', ms: 1600 });
        audio.sfx('lose');
        setTimeout(() => { if (!disposed) capa.say(0, 'Bueno… la tarta de noche también sabe bien.', anchor0, 2400); }, 700);
      }
    }
    function sendResults() {
      if (st.finished) return; st.finished = true;
      const left = Math.max(0, TIME_LIMIT - st.t);
      const win = st.win;
      const frac = st.cocos / Math.max(1, totalCocos);
      const stars = !win ? 0 : 1 + (left >= T_MARGEN ? 1 : 0) + (left >= T_MARGEN && frac >= COCO_3 ? 1 : 0);
      const score = st.score + (win ? Math.round(left * 25) + (st.crashes === 0 ? 300 : 0) : 0);
      if (win && st.monkeyHits === 0) ctx.sticker('sin-monos');
      if (win && left >= 20) ctx.sticker('atardecer');
      if (st.cocos >= 40) ctx.sticker('cocotero');
      const lines = [];
      if (win && stars < 3) lines.push(left < T_MARGEN ? `Para la 2ª estrella: llega con ${T_MARGEN} s de sol.` : `Para la 3ª: ${Math.ceil(COCO_3 * totalCocos)} cocos y ${T_MARGEN} s de sol.`);
      if (!win) lines.push('Usa el TURBO en las rectas y esquiva a los monos.');
      ctx.finish({
        win, stars, score, time: st.t, delay: 200,
        title: win ? (stars === 3 ? '¡Fiesta perfecta!' : '¡Llegáis a la fiesta!') : 'Se puso el sol…',
        stats: [['Cocos', `${st.cocos}/${totalCocos}`], ['Tiempo', fmtTime(st.t)], ['Sol de sobra', win ? fmtTime(left) : '—'], ['Mejor racha', `${st.bestCombo}`], ['Sustos con monos', `${st.monkeyHits}`]],
        moreStats: { cocos: st.cocos },
        shareText: win ? `${st.cocos} cocos y ${fmtTime(st.t)} hasta la villa en Phuket` : `${st.cocos} cocos en Phuket`,
        lines,
      });
    }

    // ───────── animación de obstáculos ─────────
    function updateHazards(dt) {
      const tt = st.time;
      for (const h of haz) {
        if (!h.mesh) continue;
        const ds = h.s - st.s;
        const vis = ds > -40 && ds < 330;
        h.mesh.visible = vis;
        if (h.type === 'moto') {
          if (!h.active && st.phase === 'carrera' && st.s > h.s0 - (h.v < 0 ? 300 : 170)) h.active = true;
          if (h.active) { h.s += h.v * dt; h.d = h.d0 + Math.sin(tt * 0.8 + h.s0) * 0.35; }
          if (!vis && !h.active) continue;
          W(h.s, h.d, 0, h.mesh.position);
          F(h.s, fr2);
          const dir = h.v >= 0 ? 1 : -1;
          h.mesh.rotation.y = Math.atan2(fr2.t.x * dir, fr2.t.z * dir);
          h.bump = Math.max(0, h.bump - dt);
          h.mesh.rotation.z = Math.sin(tt * 1.6 + h.s0) * 0.06 + Math.sin(tt * 30) * 0.25 * h.bump;
          for (const w of h.wheels) w.rotation.x += (Math.abs(h.v) * dt) / 0.27;
          h.wave = Math.max(0, (h.wave || 0) - dt);
          h.arm.rotation.z = h.wave > 0 ? 2.6 + Math.sin(tt * 14) * 0.4 : 0.1; h.arm.rotation.x = h.wave > 0 ? 0 : -1.2;
          continue;
        }
        if (!vis) continue;
        if (h.type === 'carro') { if (!h.placed) { h.placed = true; W(h.s, h.d, 0, h.mesh.position); h.mesh.rotation.y = world.yawAt(h.s, -1, 0) + (h.d - 0.5) * 0.15; } if (h.state === 'golpe') { h.mesh.rotation.z = Math.sin(tt * 30) * 0.15 * Math.max(0, h.wob -= dt); } continue; }
        if (h.type === 'tuktuk') {
          if (h.state === 'espera' && st.phase === 'carrera' && ds < st.v * 1.9 + 4) { h.state = 'cruza'; audio.sfx('tuk-horn'); capa.num('¡PI-PIIII!', V.copy(h.mesh.position).setY(h.mesh.position.y + 3)); }
          if (h.state === 'cruza') { h.d -= 8.5 * dt; if (h.d < -12) h.state = 'fuera'; }
          W(h.s, h.d, h.state === 'cruza' ? Math.abs(Math.sin(tt * 16)) * 0.05 : 0, h.mesh.position);
          h.mesh.rotation.y = world.yawAt(h.s, 0, -1);
          continue;
        }
        if (h.type === 'mono') {
          if (h.state === 'espera') {
            if (st.phase === 'carrera' && ds < st.v * h.trig + 6) { h.state = 'cruza'; h.ph = 0; if (h.coco) st.monkeySeen = true; audio.sfx('monkey', { vol: 0.6 }); }
            W(h.s, h.d, 0, h.mesh.position);
            h.mesh.rotation.y = world.yawAt(h.s, -1, -h.side * 0.5);
            h.body.position.y = Math.abs(Math.sin(tt * 3 + h.s)) * 0.06;
          } else if (h.state === 'cruza' || h.state === 'sentado') {
            if (h.state === 'cruza') {
              h.ph += dt / 2.5;
              let k = h.ph;
              if (h.pause) k = h.ph < 0.42 ? h.ph : h.ph < 0.62 ? 0.42 : h.ph - 0.2;
              k = clamp(k / (h.pause ? 0.8 : 1), 0, 1);
              h.d = lerp(h.side * 8.8, -h.side * 8.8, k);
              if (h.ph >= (h.pause ? 1.0 : 1.0)) h.state = 'sentado';
              const moving = !(h.pause && h.ph >= 0.42 && h.ph < 0.62);
              h.body.position.y = moving ? Math.abs(Math.sin(h.ph * 30)) * 0.4 : 0;
              h.mesh.rotation.y = moving ? world.yawAt(h.s, 0, -h.side) : world.yawAt(h.s, -1, 0);
            } else { h.body.position.y = 0; h.mesh.rotation.y = world.yawAt(h.s, -1, h.side * 0.6); }
            W(h.s, h.d, 0, h.mesh.position);
          } else if (h.state === 'vuela') {
            h.vy -= 18 * dt; h.d += h.vd * dt; h.mesh.position.y += h.vy * dt; h.spin += dt * 12;
            h.body.rotation.x = h.spin;
            F(h.s, fr2); const ground = world.profile(h.s, h.d, fr2.p.y);
            h.mesh.position.x = fr2.p.x + fr2.n.x * h.d; h.mesh.position.z = fr2.p.z + fr2.n.z * h.d;
            if (Math.abs(h.d) > 8.6) h.vd = 0;
            if (h.mesh.position.y < ground && h.vy < 0) { h.mesh.position.y = ground; h.state = 'sentado'; h.body.rotation.x = 0; }
          }
        } else if (h.type === 'perro') {
          if (h.state === 'tumbado') {
            W(h.s, h.d, 0, h.mesh.position);
            h.mesh.rotation.y = world.yawAt(h.s, 0, 1) + h.yaw;
            const near = ds < 30 && ds > -5;
            h.head.rotation.x = damp(h.head.rotation.x, near ? -0.35 : 0.45, 4, dt);
            h.head.rotation.y = near ? Math.sin(tt * 2) * 0.3 : 0;
            if (near && !h.woof && ds < 22) { h.woof = true; if (Math.random() < 0.5) audio.sfx('dog', { vol: 0.4 }); }
          } else if (h.state === 'huye') {
            h.d += h.vd * 7 * dt;
            if (Math.abs(h.d) > 10) { h.d = Math.sign(h.d) * 10; h.state = 'lejos'; }
            W(h.s, h.d, Math.abs(Math.sin(tt * 14)) * 0.25, h.mesh.position);
            h.mesh.rotation.y = world.yawAt(h.s, 0, h.vd);
            h.head.rotation.x = -0.4;
          }
        } else if (h.type === 'gallina') {
          if (h.state === 'pica') {
            const prev = h.d;
            h.d = h.dc + Math.sin(tt * h.sp + h.ph) * h.amp;
            W(h.s, h.d, Math.abs(Math.sin(tt * 9 + h.ph)) * 0.12, h.mesh.position);
            h.mesh.rotation.y = world.yawAt(h.s, 0, h.d > prev ? 1 : -1);
            h.mesh.rotation.x = Math.sin(tt * 7 + h.ph) > 0.85 ? 0.5 : 0;
          } else if (h.state === 'vuela') {
            h.vy -= 9 * dt; h.d += h.vd * dt; h.mesh.position.y += h.vy * dt;
            F(h.s, fr2); h.mesh.position.x = fr2.p.x + fr2.n.x * h.d; h.mesh.position.z = fr2.p.z + fr2.n.z * h.d;
            h.mesh.rotation.z = Math.sin(tt * 30) * 0.4;
            if (h.vy < -6) h.mesh.visible = false, h.state = 'fuera';
          } else h.mesh.visible = false;
        }
      }
    }

    // ───────── personajes ─────────
    function poseRiders(dt) {
      const t = st.time, vK = clamp(st.v / 30, 0, 1.2);
      const party = st.phase === 'fin' && st.win && st.finT > 0.4;
      rider.pose('ride', t);
      const rr = rider.rig;
      rr.torso.rotation.z = -st.lean * 0.3;
      rr.head.rotation.y = -st.steerVis * 0.35;
      if (st.scream > 0) { rr.head.rotation.x = -0.3; rr.torso.rotation.x = 0.05; }
      if (party) { rider.pose('sit', t); rr.armL.shoulder.rotation.z = 2.6 + Math.sin(t * 9) * 0.25; rr.armR.shoulder.rotation.z = -2.6 - Math.sin(t * 9) * 0.25; rr.hips.position.y = 0.5 + Math.max(0, Math.sin(t * 9)) * 0.08; }
      pass.pose('sit', t);
      const pr = pass.rig;
      pr.armL.shoulder.rotation.x = -0.95; pr.armR.shoulder.rotation.x = -0.95;
      pr.armL.elbow.rotation.x = -0.7; pr.armR.elbow.rotation.x = -0.7;
      pr.torso.rotation.x = 0.15; pr.torso.rotation.z = -st.lean * 0.4;
      pr.head.rotation.y = Math.sin(t * 0.6) * 0.4;
      if (st.phase === 'intro' || st.phase === 'cuenta') { pr.armR.shoulder.rotation.set(0, 0, -2.5); pr.armR.elbow.rotation.set(0, 0, Math.sin(t * 8) * 0.5); pr.head.rotation.y = 0.5; }
      if (st.cheer > 0) { pr.armR.shoulder.rotation.set(0, 0, -2.7); pr.armR.elbow.rotation.set(0, 0, 0); }
      if (st.scream > 0 || party) {
        pr.armL.shoulder.rotation.set(0, 0, 2.6 + Math.sin(t * 11) * 0.2); pr.armR.shoulder.rotation.set(0, 0, -2.6 - Math.sin(t * 11) * 0.2);
        pr.armL.elbow.rotation.set(0, 0, 0); pr.armR.elbow.rotation.set(0, 0, 0); pr.head.rotation.x = -0.25;
      }
      for (const [ex, ph] of [[exR, 0], [exP, 1.7]]) {
        if (ex.hair) ex.hair.rotation.x = -0.1 * vK + Math.sin(t * 26 + ph) * 0.05 * vK;
        ex.piv.rotation.x = 0.55 * vK + Math.sin(t * 31 + ph) * 0.28 * vK;
      }
    }

    // ───────── mundo: sol, cielo, luces ─────────
    const cA = new THREE.Color(), cB = new THREE.Color();
    function mixPal(k, key) {
      let i = 0; while (i < SKY.length - 2 && SKY[i + 1].k < k) i++;
      const a = SKY[i], b = SKY[i + 1], f = clamp((k - a.k) / (b.k - a.k), 0, 1);
      if (typeof a[key] === 'number') return lerp(a[key], b[key], f);
      return cA.set(a[key]).lerp(cB.set(b[key]), f);
    }
    const sunDir = new THREE.Vector3();
    const bulbCol = new THREE.Color();
    let lastGlow = -1;
    function updateWorld(dt) {
      const kTime = clamp(st.t / TIME_LIMIT, 0, 1);
      st.kVis = st.phase === 'fin' ? damp(st.kVis, st.win ? Math.max(kTime, 0.86) : 1, 0.8, dt) : kTime;
      const k = st.kVis;
      const elev = lerp(0.3, -0.05, k);
      sunDir.set(-0.3 * Math.cos(elev), Math.sin(elev), -0.954 * Math.cos(elev)).normalize();
      const su = world.skyMat.uniforms;
      su.top.value.copy(mixPal(k, 'top')); su.hor.value.copy(mixPal(k, 'hor')); su.sunCol.value.copy(mixPal(k, 'sun'));
      su.glowCol.value.copy(mixPal(k, 'glow')); su.cloudCol.value.copy(mixPal(k, 'cloud')); su.sunDir.value.copy(sunDir); su.time.value = st.time;
      const fogC = mixPal(k, 'fog'); scene.fog.color.copy(fogC); scene.background.copy(fogC);
      const se = world.seaMat.uniforms;
      se.time.value = st.time; se.sunDir.value.copy(sunDir); se.deep.value.copy(mixPal(k, 'sea')); se.horizon.value.copy(mixPal(k, 'hor')); se.sunCol.value.copy(mixPal(k, 'sun'));
      sun.color.copy(mixPal(k, 'light')); sun.intensity = mixPal(k, 'li');
      hemi.color.copy(mixPal(k, 'hs')); hemi.groundColor.copy(mixPal(k, 'hg')); hemi.intensity = mixPal(k, 'hi');
      st.fill = damp(st.fill || 0, st.phase === 'fin' && st.win ? 1 : 0, 1.5, dt);
      if (st.fill > 0.01) { hemi.intensity += st.fill * 1.1; hemi.color.lerp(cB.set('#ffd9b0'), st.fill * 0.6); hemi.groundColor.lerp(cB.set('#c87a8a'), st.fill * 0.6); sun.intensity += st.fill * 0.6; }
      const ld = V.copy(sunDir); ld.y = Math.max(ld.y, 0.85); ld.normalize();
      sun.target.position.copy(bike.position);
      sun.position.copy(bike.position).addScaledVector(ld, 110);
      world.sky.position.copy(camera.position);
      // luces: guirnaldas que se encienden al caer el sol (y en el 2º pueblo, al llegar)
      const u = (st.s - S0) / LG;
      const night = smoothstep(0.3, 0.72, k);
      let dirty = false;
      for (const sg of dyn.bulbStrings) {
        const late = (sg.s - S0) / LG > 0.66;
        const tgt = Math.max(night, late && st.s > sg.s - 130 ? 1 : 0, (sg.s - S0) / LG > 0.88 ? 1 : 0, sg.market ? 1 : 0);
        const before = sg.on;
        sg.on = damp(sg.on, tgt, 3, dt);
        if (Math.abs(sg.on - before) > 0.004) dirty = true;
        if (before < 0.5 && sg.on >= 0.5 && Math.abs(sg.s - st.s) < 120) sfx.plink(Math.floor(sg.s));
      }
      if (dirty || lastGlow < 0) {
        dyn.bulbList.forEach((b, i) => { const on = dyn.bulbStrings[b.string].on; bulbCol.set(on > 0.05 ? b.c : '#5a5060').multiplyScalar(lerp(0.35, 2.2, on)); dyn.bulbs.setColorAt(i, bulbCol); });
        dyn.bulbs.instanceColor.needsUpdate = true;
      }
      const g = Math.max(smoothstep(0.25, 0.7, k), u > 0.86 ? 1 : 0, st.phase === 'fin' ? 1 : 0);
      if (Math.abs(g - lastGlow) > 0.003) { dyn.glowMat.color.setScalar(lerp(0.45, 1.9, g)); lastGlow = g; }
      if (dyn.poolMat) dyn.poolMat.emissiveIntensity = lerp(0.35, 1.6, g);
      headMat.color.set('#fff3c4').multiplyScalar(lerp(0.5, 2.4, night));
      tailMat.color.set('#ff3048').multiplyScalar(lerp(0.5, 1.8, night) + (inp.down('brake') ? 1 : 0));
      // barcas que se mecen
      for (const b of dyn.boats) { if (Math.abs(b.s - st.s) > 500) continue; b.m.position.y = b.y0 + Math.sin(st.time * 1.3 + b.ph) * 0.12; b.m.rotation.z = Math.sin(st.time * 1.1 + b.ph) * 0.06; b.m.rotation.x = Math.sin(st.time * 0.9 + b.ph * 2) * 0.04; }
      // bailarines
      const nearVilla = st.s > SF - 300;
      if (nearVilla) for (const dn of dyn.dancers) {
        const tt = st.time * dn.sp + dn.ph;
        dn.g.position.y = 0.1 + Math.abs(Math.sin(tt)) * (st.phase === 'fin' ? 0.35 : 0.15);
        dn.g.rotation.z = Math.sin(tt * 0.5) * 0.12;
        dn.arms[0].rotation.z = 2.4 + Math.sin(tt) * 0.5; dn.arms[1].rotation.z = -2.4 + Math.sin(tt + 1) * 0.5;
      }
      world.setVisible(st.s);
    }

    // ───────── cámara ─────────
    function updateCamera(dt) {
      const portrait = camera.aspect < 0.85;
      const boostK = st.boosting ? 1 : 0;
      st.boostCam = damp(st.boostCam || 0, boostK, 3, dt);
      const bk = st.boostCam;
      if (st.phase === 'intro' || st.phase === 'cuenta') {
        const a = st.time * 0.12;
        const cp = V.copy(bike.position).addScaledVector(fr.t, 6.5 + Math.sin(a) * 1.5).addScaledVector(fr.n, -4.2 + Math.cos(a) * 1.2);
        cp.y = bike.position.y + 2.0;
        if (st.phase === 'cuenta') { F(st.s - (portrait ? 8.5 : 7), fr2); V2.copy(fr2.p).addScaledVector(fr2.n, st.d * 0.7); V2.y += portrait ? 3.8 : 3.1; cp.copy(V2); }
        camera.position.lerp(cp, 1 - Math.exp(-dt * (st.phase === 'cuenta' ? 2.5 : 3)));
        const lk = st.phase === 'cuenta' ? (F(st.s + 10, fr2), V2.copy(fr2.p).addScaledVector(fr2.n, st.d * 0.8).add(V3.set(0, 1.3, 0))) : V2.copy(bike.position).add(V3.set(0, 1.1, 0));
        camLook.lerp(lk, 1 - Math.exp(-dt * 4));
        camera.lookAt(camLook);
        camera.fov = damp(camera.fov, portrait ? 74 : 56, 3, dt);
      } else if (st.phase === 'fin') {
        // cámara centrada en los dos protagonistas, de frente, con la fiesta detrás
        F(st.s, fr2);
        const center = V2.copy(bike.position).add(V3.set(0, 1.25, 0)).addScaledVector(fr2.n, -0.6);
        if (camOrbit === 0) camOrbit = 0.75;
        camOrbit = Math.max(-0.35, camOrbit - dt * 0.22);
        const r = portrait ? 7.8 : 6.2;
        const cp = V.copy(center).addScaledVector(fr2.t, Math.cos(camOrbit) * r).addScaledVector(fr2.n, Math.sin(camOrbit) * r);
        cp.y = center.y + 1.6 + Math.sin(st.finT * 0.6) * 0.3;
        camera.position.lerp(cp, 1 - Math.exp(-dt * (st.finT < 1.2 ? 1.6 : 2.5)));
        camLook.lerp(center, 1 - Math.exp(-dt * 3));
        camera.lookAt(camLook);
        camera.fov = damp(camera.fov, portrait ? 72 : 58, 2, dt);
      } else {
        const back = (portrait ? 7.6 : 6.8) + st.v * 0.04 + bk * 1.4;
        F(st.s - back, fr2);
        const cp = V.copy(fr2.p).addScaledVector(fr2.n, st.d * 0.72);
        cp.y = fr2.p.y + (portrait ? 3.5 : 3.0) + st.y * 0.55 + bk * 0.25;
        camera.position.lerp(cp, 1 - Math.exp(-dt * 9));
        F(st.s + 11, fr2);
        const lk = V2.copy(fr2.p).addScaledVector(fr2.n, st.d * 0.82); lk.y = fr2.p.y + 1.3 + st.y * 0.4;
        camLook.lerp(lk, 1 - Math.exp(-dt * 10));
        camera.lookAt(camLook);
        const base = portrait ? 74 : 58;
        camera.fov = damp(camera.fov, base + (st.v - V_BASE) * 0.35 + bk * 11, 4, dt);
      }
      camera.updateProjectionMatrix();
    }

    // ───────── bucle ─────────
    let fireT = 0;
    function update(dt, realDt) {
      if (disposed) return;
      try {
        st.time += dt;
        fx.update(dt); fxAdd.update(dt);
        if (st.phase === 'carrera') stepRace(dt);
        else if (st.phase === 'fin') {
          st.finT += dt;
          st.v = damp(st.v, 0, st.win ? 1.4 : 1.8, dt);
          st.rel = damp(st.rel, 0, 3, dt); st.drift = damp(st.drift, 0, 3, dt);
          F(st.s, fr);
          const dPrev = st.d;
          if (st.win) st.d = damp(st.d, -11.5, 1.5, dt);
          st.s += st.v * dt;
          st.rel = clamp(Math.atan2((st.d - dPrev) / Math.max(dt, 1e-4), Math.max(st.v, 2)) / 0.55, -1.6, 1.6);
          if (st.y > 0 || st.vy > 0) { st.y += st.vy * dt; st.vy -= 20 * dt; if (st.y < 0) { st.y = 0; st.vy = 0; } }
          if (st.win) {
            fireT -= dt;
            if (fireT <= 0 && st.finT < 9) {
              fireT = 0.45 + Math.random() * 0.4;
              F(SF + rng.range(-20, 50), fr2);
              const p = V.copy(fr2.p).addScaledVector(fr2.n, -60 - Math.random() * 60); p.y = 28 + Math.random() * 18;
              const cols = pick([['#ffd166', '#ff9f1c'], ['#ff4fa3', '#ffffff'], ['#2ec4b6', '#a8f0e8'], ['#ff6f61', '#ffd166']]);
              fxAdd.emit(70, p, { colors: cols, vel: { x: 0, y: 0, z: 0 }, velSpread: 26, life: 1.4, size: 1.6, gravity: -3, spread: 1 });
              audio.sfx('firework', { vol: 0.5 });
            }
          }
          if (st.finT > (st.win ? 3.4 : 2.6)) sendResults();
        } else {
          // intro / cuenta atrás: parado con el motor al ralentí
          F(st.s, fr);
        }
        // colocar el scooter
        F(st.s, fr);
        const a = st.rel * 0.55 + st.drift;
        bikeDir.copy(fr.t).multiplyScalar(Math.cos(a)).addScaledVector(fr.n, Math.sin(a)); bikeDir.y = 0; bikeDir.normalize();
        bike.position.copy(fr.p).addScaledVector(fr.n, st.d); bike.position.y = fr.p.y + st.y;
        st.steerVis = damp(st.steerVis, st.phase === 'carrera' ? inp.x : 0, 8, dt);
        const wob = st.wob > 0 ? Math.sin(st.time * 28) * 0.25 * st.wob : 0;
        st.lean = damp(st.lean, st.steerVis * 0.42 * clamp(st.v / 18, 0, 1) + st.drift * 0.5 + wob, 8, dt);
        bike.rotation.y = Math.atan2(bikeDir.x, bikeDir.z);
        bike.rotation.z = st.lean;
        bike.rotation.x = -Math.asin(clamp(fr.t.y, -0.5, 0.5)) - clamp(st.vy * 0.025, -0.15, 0.15);
        blob.position.set(bike.position.x, fr.p.y + 0.06, bike.position.z); blob.rotation.y = bike.rotation.y;
        { const k = 1 / (1 + st.y * 0.6); blob.scale.set(0.62 * k, 1, 1.25 * k); blob.material.opacity = 0.38 * k; }
        st.squash = Math.max(0, st.squash - dt * 4);
        inner.scale.set(1 + st.squash * 0.08, 1 - st.squash * 0.14, 1);
        inner.position.y = st.phase === 'carrera' ? Math.sin(st.time * 40) * 0.008 * clamp(st.v / 20, 0, 1) : Math.sin(st.time * 18) * 0.01;
        bike.visible = !(st.inv > 0 && st.phase === 'carrera' && Math.floor(st.time * 14) % 2 === 0 && st.inv < 0.9);
        for (const w of wheels) w.rotation.x += (st.v * dt) / 0.27;
        st.cheer = Math.max(0, st.cheer - dt); st.scream = Math.max(0, st.scream - dt);
        poseRiders(dt);
        updateHazards(dt);
        // cocos que giran y flotan (solo los cercanos)
        let any = false;
        for (const c of cocos) {
          if (c.taken || c.s < st.s - 5 || c.s > st.s + 160) continue;
          tmpO.position.copy(c.p); tmpO.position.y += Math.sin(st.time * 3 + c.s) * 0.12;
          tmpO.rotation.set(0, st.time * 2.2 + c.s, 0.25); tmpO.scale.setScalar(1.05); tmpO.updateMatrix();
          c.im.setMatrixAt(c.i, tmpO.matrix); any = true;
        }
        if (any) { cocoIM.instanceMatrix.needsUpdate = true; goldIM.instanceMatrix.needsUpdate = true; }
        updateWorld(dt);
        updateCamera(dt);
        engineSnd.set({ rate: clamp(0.2 + st.v / 34 + (st.boosting ? 0.25 : 0), 0, 1.6), vol: st.phase === 'carrera' || st.phase === 'fin' ? 0.32 : 0.14 });
        wavesSnd.set({ rate: 0.4, vol: 0.18 });
        capa.update(realDt || dt);
        updateHud();
        const ahead = [];
        for (const h of haz) { const ds = h.s - st.s; if (ds > -2 && ds < 70 && h.type !== 'baden' && h.state !== 'vuela' && h.state !== 'huye' && h.state !== 'fuera' && h.state !== 'lejos' && !(h.type === 'charco' && h.done)) ahead.push({ t: h.type, s: +h.s.toFixed(1), d: +h.d.toFixed(2), r: h.type === 'charco' ? h.r : h.rd + 0.45, v: h.v || 0 }); }
        const cocosAhead = [];
        for (const c of cocos) { const ds = c.s - st.s; if (!c.taken && ds > 0 && ds < 45) cocosAhead.push({ s: +c.s.toFixed(1), d: c.d, y: +c.y.toFixed(2) }); }
        window.__ruta.etapa = {
          id: 'phuket', fase: st.phase, s: +st.s.toFixed(2), d: +st.d.toFixed(2), v: +st.v.toFixed(2), rel: +st.rel.toFixed(3), y: +st.y.toFixed(2),
          inicio: S0, meta: SF, progreso: +clamp((st.s - S0) / LG, 0, 1).toFixed(3), t: +st.t.toFixed(2), limite: TIME_LIMIT, restante: +(TIME_LIMIT - st.t).toFixed(2),
          cocos: st.cocos, totalCocos, racha: st.combo, turbo: +st.fuel.toFixed(2), turboActivo: st.boosting, choques: st.crashes, monos: st.monkeyHits,
          terminado: st.done, gana: st.win, resultados: st.finished, ahead, cocosAhead,
        };
      } catch (e) {
        if (!st.errLogged) { st.errLogged = true; console.error('phuket update', e); }
      }
    }

    return {
      scene, camera,
      async start() {
        st.phase = 'intro';
        await ctx.intro(undefined, { count: false });
        if (disposed) return;
        st.phase = 'cuenta';
        const tip = isTouch() ? 'Acelera solo · <b>joystick</b> para girar · <b>TURBO</b> para volar' : 'Acelera solo · <b>← →</b> girar · <b>Shift</b> turbo · <b>Espacio</b> frena';
        ctx.toast(tip, 3200);
        if (ctx.ghost.data) setTimeout(() => { if (!disposed) ctx.toast(`👻 Corres contra: ${ctx.ghost.label}`, 2200); }, 3300);
        await ctx.countdown();
        if (disposed) return;
        st.phase = 'carrera'; st.v = 10;
        ctx.raceStart(bike);
      },
      update,
      dispose() {
        disposed = true;
        try { engineSnd.stop(); wavesSnd.stop(); } catch (e) { /* nada */ }
        capa.dispose();
        fx.dispose(); fxAdd.dispose();
        disposeTree(scene);
      },
    };
  },
};
