// Obstáculos (trenes de mercancías de frente, obras, puertas de túnel, drones de reparto)
// y orbes de energía. El trazado sale del rng con semilla (los retos diarios cambian).
import * as THREE from 'three';
import { flat, glow, canvasTexture } from '../../core/util.js';
import { DECK, LANES, Z } from './escenario.js';

export const FREIGHT_LEN = 38; // tramo (en metros del jugador) en el que el mercancías ocupa su vía
const FREIGHT_K = 0.6;          // el mercancías avanza hacia ti al 60 % de tu velocidad

export function generar(rng) {
  const hazards = [], orbs = [];
  const H = (type, s, lanes, extra = {}) => { const h = { type, s, lanes, len: type === 'tren' ? FREIGHT_LEN : 0, done: false, hit: false, ...extra }; hazards.push(h); return h; };
  // carril suelto con querencia por el central (el que pisa quien no toca nada)
  const lane1 = () => (rng.chance(0.5) ? 1 : rng.pick([0, 2]));
  const others = (l) => [0, 1, 2].filter((x) => x !== l);
  const CLIMAX_TRENES = Z.RIVER + 650, CLIMAX_PUERTAS = Z.BUND - 520;
  let s = 340, prevFree = 1, n = 0, doneTrains = false, doneGates = false;
  while (s < Z.BUND - 60) {
    const zone = s < Z.CITY ? 0 : s < Z.RIVER ? 1 : 2;
    let blocked = [], gap, trainLen = 0;
    if (zone === 2 && !doneTrains && s >= CLIMAX_TRENES) {
      // clímax 1: tres mercancías de frente seguidos, cada uno por un carril
      doneTrains = true;
      const seq = rng.chance(0.5) ? [1, 0, 2] : [1, 2, 0];
      seq.forEach((l, i) => H('tren', s + i * 105, [l], i === 0 ? { anuncio: '¡TRES TRENES DE FRENTE!' } : {}));
      for (let i = 0; i < 3; i++) { const g = rng.pick(others(seq[i]).filter((x) => i === 2 || x !== seq[i + 1]).concat(others(seq[i]))); for (let k = 1; k <= 3; k++) orbs.push({ s: s + i * 105 - k * 8 + 4, lane: g }); }
      prevFree = 1; s += 2 * 105 + FREIGHT_LEN + 95; n++; continue;
    }
    if (zone === 2 && !doneGates && s >= CLIMAX_PUERTAS) {
      // clímax 2: puertas en zigzag
      doneGates = true;
      const open = rng.chance(0.5) ? [0, 2, 0] : [2, 0, 2];
      open.forEach((o, i) => { H('puerta', s + i * 100, others(o), i === 0 ? { anuncio: '¡PUERTAS EN ZIGZAG!' } : {}); for (let k = 1; k <= 3; k++) orbs.push({ s: s + i * 100 - k * 8, lane: o }); });
      prevFree = open[2]; s += 2 * 100 + 110; n++; continue;
    }
    let types = zone === 0 ? (s < 800 ? ['obras', 'dron'] : ['obras', 'dron', 'tren', 'obras', 'dron'])
      : zone === 1 ? ['obras2', 'combo', 'tren', 'puerta', 'dron', 'combo', 'trenobras']
        : ['obras2', 'combo', 'tren', 'puerta', 'trenobras', 'combo', 'puerta'];
    if (n === 0) types = ['obras'];
    if (n === 2) types = ['tren'];
    const type = rng.pick(types);
    if (type === 'obras' || type === 'dron') { blocked = [lane1()]; H(type, s, blocked); }
    else if (type === 'tren') { blocked = [lane1()]; H('tren', s, blocked); trainLen = FREIGHT_LEN; }
    else if (type === 'obras2' || type === 'puerta') { const o = rng.int(0, 2); blocked = others(o); H(type === 'puerta' ? 'puerta' : 'obras', s, blocked); }
    else if (type === 'combo') { const o = rng.int(0, 2); blocked = others(o); H('obras', s, [blocked[0]]); H('dron', s, [blocked[1]]); }
    else if (type === 'trenobras') { const o = rng.int(0, 2); blocked = others(o); const [a, b2] = rng.chance(0.5) ? blocked : [blocked[1], blocked[0]]; H('tren', s, [a]); H('obras', s, [b2]); trainLen = FREIGHT_LEN; }
    const free = [0, 1, 2].filter((l) => !blocked.includes(l));
    // orbes guía en un carril libre (el más cercano al anterior)
    const guide = free.reduce((a2, b2) => (Math.abs(b2 - prevFree) < Math.abs(a2 - prevFree) ? b2 : a2));
    for (let k = 4; k >= 1; k--) orbs.push({ s: s - k * 7, lane: guide });
    if (trainLen) for (let k = 1; k <= 3; k++) orbs.push({ s: s + k * 9, lane: guide });
    gap = zone === 0 ? rng.range(150, 195) : zone === 1 ? rng.range(108, 142) : rng.range(96, 126);
    gap += trainLen;
    // cadena de orbes en el hueco hasta el siguiente: recta o en zigzag
    const from = s + (trainLen ? trainLen + 26 : 24), to = s + gap - 40;
    let lane = guide, k = 0;
    const zig = rng.chance(0.65), step = rng.int(2, 4), chain = rng.chance(0.75);
    for (let os = from; chain && os < to; os += 8) {
      orbs.push({ s: os, lane });
      k++;
      if (zig && k % step === 0) { const d = lane === 0 ? 1 : lane === 2 ? -1 : (rng.chance(0.5) ? 1 : -1); lane += d; }
    }
    prevFree = chain ? lane : guide;
    s += gap; n++;
  }
  // tramo final hacia el Bund: un arco de orbes de premio
  for (let k = 0; k < 18; k++) orbs.push({ s: Z.BUND - 30 + k * 8, lane: [1, 1, 0, 0, 1, 2, 2, 1][k % 8] });
  hazards.sort((a2, b2) => a2.s - b2.s);
  // quita orbes que caigan encima de un obstáculo de su carril
  const clean = orbs.filter((o) => !hazards.some((h) => h.lanes.includes(o.lane) && o.s > h.s - 12 && o.s < h.s + (h.len || 0) + 10));
  clean.sort((a2, b2) => a2.s - b2.s);
  for (const o of clean) o.got = false;
  return { hazards, orbs: clean };
}

const laneX = (l) => LANES[l];

function stripes(c1, c2) {
  return canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h);
    g.fillStyle = c2;
    for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
  });
}

function chevronTex() {
  const t = canvasTexture(64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,40,70,0.35)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,90,110,1)';
    for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(4, y + 10); g.lineTo(w / 2, y + 40); g.lineTo(w - 4, y + 10); g.lineTo(w - 4, y + 26); g.lineTo(w / 2, y + 56); g.lineTo(4, y + 26); g.closePath(); g.fill(); }
  }, { repeat: [1, 6] });
  return t;
}

function flareTex() {
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,240,200,0.7)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, h / 2 - 2, w, 4);
  });
}

export function buildHazards(scene, hazards) {
  const M = {
    works: new THREE.MeshStandardMaterial({ map: stripes('#ff7b00', '#ffffff'), flatShading: true, roughness: 0.7 }),
    shutter: new THREE.MeshStandardMaterial({ map: stripes('#e01e37', '#ffe14d'), flatShading: true, roughness: 0.6, emissive: '#400008' }),
    cone: flat('#ff6a00'), coneW: flat('#f2f2f2'), dark: flat('#22283a'), concrete: flat('#4a5370'), tunnel: new THREE.MeshStandardMaterial({ color: '#1b2238', flatShading: true, side: THREE.BackSide }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae00').multiplyScalar(3), toneMapped: false }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1e3c').multiplyScalar(3), toneMapped: false }),
    green: glow('#3dff7a', 3), white: glow('#fff6dc', 3), ring: glow('#ffd27a', 2),
    warn: new THREE.MeshBasicMaterial({ color: '#ff1e3c', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    beam: new THREE.MeshBasicMaterial({ color: '#ff2340', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    rotor: new THREE.MeshBasicMaterial({ color: '#aab4cc', transparent: true, opacity: 0.35, depthWrite: false }),
    box: flat('#c8955a'), tape: flat('#3a86ff'),
    wagon: ['#2d6a4f', '#1d3557', '#e09f3e', '#6a4c93'].map((c) => flat(c)), loco: flat('#d62839'),
    chev: new THREE.MeshBasicMaterial({ map: chevronTex(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    flare: new THREE.SpriteMaterial({ map: flareTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }),
  };
  const G = {
    barrier: new THREE.BoxGeometry(3.0, 1.0, 0.25), leg: new THREE.BoxGeometry(0.15, 1.0, 0.15), cone: new THREE.ConeGeometry(0.36, 1.0, 8), coneBand: new THREE.CylinderGeometry(0.2, 0.26, 0.18, 8),
    lamp: new THREE.SphereGeometry(0.2, 8, 6), shutter: new THREE.BoxGeometry(3.3, 5.0, 0.35),
  };
  for (const h of hazards) {
    const g = new THREE.Group();
    g.position.set(0, 0, -h.s);
    h.obj = g; h.parts = {};
    if (h.type === 'obras') {
      h.parts.lamps = [];
      for (const l of h.lanes) {
        const x = laneX(l);
        const b = new THREE.Mesh(G.barrier, M.works); b.position.set(x, DECK + 1.2, 0); b.castShadow = true; g.add(b);
        for (const s of [-1, 1]) { const lg = new THREE.Mesh(G.leg, M.dark); lg.position.set(x + 1.2 * s, DECK + 0.5, 0); g.add(lg); }
        for (let c = -1; c <= 1; c++) {
          const cn = new THREE.Mesh(G.cone, M.cone); cn.position.set(x + c * 1.1, DECK + 0.5, 3 + Math.abs(c) * 1.2); g.add(cn);
          const bd = new THREE.Mesh(G.coneBand, M.coneW); bd.position.set(x + c * 1.1, DECK + 0.62, 3 + Math.abs(c) * 1.2); g.add(bd);
        }
        for (const s of [-1, 1]) { const lp = new THREE.Mesh(G.lamp, M.amber); lp.position.set(x + 1.1 * s, DECK + 1.95, 0); g.add(lp); h.parts.lamps.push(lp); }
      }
    } else if (h.type === 'puerta') {
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 10, 3), M.concrete); p.position.set(7.3 * s, DECK + 5, 0); g.add(p); }
      const lin = new THREE.Mesh(new THREE.BoxGeometry(16.2, 2.4, 3), M.concrete); lin.position.set(0, DECK + 9.2, 0); g.add(lin);
      const tube = new THREE.CylinderGeometry(7.8, 7.8, 90, 10, 1, true, 0, Math.PI); tube.rotateX(Math.PI / 2); tube.rotateZ(Math.PI / 2);
      const tm = new THREE.Mesh(tube, M.tunnel); tm.position.set(0, DECK, -46.5); g.add(tm);
      const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(7.6, 0.16, 4, 14, Math.PI), M.ring, 9);
      const o = new THREE.Object3D();
      for (let i = 0; i < 9; i++) { o.position.set(0, DECK, -6 - i * 10); o.updateMatrix(); rings.setMatrixAt(i, o.matrix); }
      g.add(rings);
      h.parts.shutters = []; h.parts.xs = [];
      for (let l = 0; l < 3; l++) {
        const x = laneX(l);
        if (h.lanes.includes(l)) {
          const sh = new THREE.Mesh(G.shutter, M.shutter); sh.position.set(x, DECK + 8.5, 0.4); g.add(sh); h.parts.shutters.push(sh);
          const xg = new THREE.Group();
          for (const r of [0.8, -0.8]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 0.1), M.red); bar.rotation.z = r; xg.add(bar); }
          xg.position.set(x, DECK + 9.3, 1.6); g.add(xg); h.parts.xs.push(xg);
        } else {
          const ar = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 3), M.green); ar.rotation.z = Math.PI; ar.position.set(x, DECK + 9.3, 1.6); g.add(ar);
          h.parts.arrow = ar;
        }
      }
    } else if (h.type === 'dron') {
      const d = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), M.dark); d.add(body);
      for (const r of [Math.PI / 4, -Math.PI / 4]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.2), M.dark); arm.rotation.y = r; d.add(arm); }
      h.parts.rotors = [];
      for (const [x, z] of [[1.27, 1.27], [-1.27, 1.27], [1.27, -1.27], [-1.27, -1.27]]) { const ro = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.04, 10), M.rotor); ro.position.set(x, 0.18, z); d.add(ro); h.parts.rotors.push(ro); }
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), M.box); box.position.y = -0.95; d.add(box);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.92, 0.2), M.tape); tape.position.y = -0.95; d.add(tape);
      const nl = new THREE.Mesh(G.lamp, M.red); nl.position.set(-0.8, 0, 0.8); d.add(nl);
      const nr = new THREE.Mesh(G.lamp, M.green); nr.position.set(0.8, 0, 0.8); d.add(nr);
      const laser = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 10, 1, true), M.beam); laser.position.y = -2.4; d.add(laser);
      d.scale.setScalar(1.25);
      g.add(d); h.parts.drone = d;
      const tgt = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 20), M.red); tgt.rotation.x = -Math.PI / 2; tgt.position.set(laxe(h), DECK + 0.4, 0); g.add(tgt); h.parts.target = tgt;
      h.side = h.lanes[0] === 0 ? -1 : h.lanes[0] === 2 ? 1 : (h.s % 2 ? 1 : -1);
    } else if (h.type === 'tren') {
      const f = new THREE.Group();
      const loco = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.5, 12), M.loco); loco.position.set(0, 1.9, -6); loco.castShadow = true; f.add(loco);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.6, 1.6), M.dark); nose.position.set(0, 2.9, 0.1); f.add(nose);
      for (let w = 0; w < 4; w++) { const wg = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.0, 12.5), M.wagon[w % 4]); wg.position.set(0, 1.7, -13 - w * 13.2 - 6); f.add(wg); }
      for (const s of [-1, 1]) { const hl = new THREE.Mesh(G.lamp, M.white); hl.position.set(0.9 * s, 1.0, 0.1); f.add(hl); }
      const fl = new THREE.Sprite(M.flare); fl.scale.set(16, 16, 1); fl.position.set(0, 1.2, 0.6); f.add(fl);
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(6, 40), new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      bm.rotation.x = -Math.PI / 2; bm.position.set(0, -0.35, 20); f.add(bm);
      f.position.set(laneX(h.lanes[0]), DECK + 0.4, 0);
      g.add(f); h.parts.train = f;
      // franja roja de aviso en su vía
      const warn = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1), M.warn); warn.rotation.x = -Math.PI / 2; warn.position.set(laneX(h.lanes[0]), DECK + 0.42, 0);
      scene.add(warn); h.parts.warn = warn; warn.visible = false;
    }
    if (h.type !== 'tren') {
      h.parts.marks = [];
      for (const l of h.lanes) {
        const mk = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 54), M.chev); mk.rotation.x = -Math.PI / 2; mk.position.set(laneX(l), DECK + 0.4, 30); g.add(mk); h.parts.marks.push(mk);
      }
    }
    g.visible = false;
    scene.add(g);
  }
  return { M, G };
}
function laxe(h) { return laneX(h.lanes[0]); }

// Anima los obstáculos cercanos. sp = posición del jugador, t = tiempo.
export function animateHazards(hazards, sp, t, dt) {
  for (const h of hazards) {
    const d = h.s - sp;
    const near = d < 700 && d > -(h.len || 0) - 160;
    h.obj.visible = near && !h.smashed;
    if (h.parts.warn) h.parts.warn.visible = false;
    if (!near) continue;
    if (h.parts.marks) { const on = !h.done && d < 330 && Math.sin(t * 14 + h.s) > -0.35; for (const m of h.parts.marks) m.visible = on; }
    if (h.type === 'obras') {
      const on = Math.sin(t * 10 + h.s) > 0;
      for (const [i, l] of h.parts.lamps.entries()) l.visible = (i % 2 === 0) === on;
    } else if (h.type === 'puerta') {
      const k = Math.min(1, Math.max(0, (330 - d) / 200)); // se cierran al acercarte
      for (const sh of h.parts.shutters) sh.position.y = DECK + 8.5 - k * 5.9;
      const on = Math.sin(t * 12) > 0;
      for (const x of h.parts.xs) x.visible = on;
      if (h.parts.arrow) h.parts.arrow.position.y = DECK + 9.3 + Math.sin(t * 8) * 0.25;
    } else if (h.type === 'dron') {
      const k = Math.min(1, Math.max(0, (340 - d) / 220));
      const e = 1 - Math.pow(1 - k, 3);
      const dr = h.parts.drone;
      dr.position.set(laxe(h) + h.side * 30 * (1 - e), DECK + 2.9 + (1 - e) * 10 + Math.sin(t * 5 + h.s) * 0.15, 0);
      dr.rotation.z = -h.side * (1 - e) * 0.5 + Math.sin(t * 3) * 0.05;
      for (const r of h.parts.rotors) r.rotation.y += dt * 40;
      h.parts.target.visible = Math.sin(t * 14) > -0.3;
      h.parts.target.scale.setScalar(1 + 0.15 * Math.sin(t * 9));
      if (h.falling) { h.fallV = (h.fallV || 0) + 30 * dt; dr.position.y = Math.max(DECK + 0.6, DECK + 2.9 - (h.fallY = (h.fallY || 0) + h.fallV * dt)); dr.rotation.x += dt * 4; }
    } else if (h.type === 'tren') {
      // delante de ti viene hacia ti; os cruzáis justo en h.s
      const front = h.s + d * FREIGHT_K;
      h.parts.train.position.z = -(front - h.s);
      h.front = front;
      if (d > 0 && d < 520 && !h.hit) {
        const w = h.parts.warn;
        const a = sp + 12, b = front;
        if (b > a) { w.visible = Math.sin(t * 16) > -0.2; w.scale.set(1, b - a, 1); w.position.z = -(a + b) / 2; }
      }
    }
  }
}

// ───────── orbes ─────────
export function makeOrbs(scene, orbs) {
  const n = orbs.length;
  const core = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5ef0ff').multiplyScalar(2.2), toneMapped: false }), n);
  const halo = new THREE.InstancedMesh(new THREE.SphereGeometry(1.15, 10, 8), new THREE.MeshBasicMaterial({ color: '#2fa8ff', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), n);
  core.frustumCulled = halo.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) { core.setMatrixAt(i, zero); halo.setMatrixAt(i, zero); }
  scene.add(core, halo);
  const o3 = new THREE.Object3D();
  let first = 0;
  return {
    core, halo,
    update(sp, t) {
      while (first < n && orbs[first].s < sp - 30) { core.setMatrixAt(first, zero); halo.setMatrixAt(first, zero); first++; }
      for (let i = first; i < n; i++) {
        const o = orbs[i];
        if (o.s > sp + 520) break;
        if (o.got) { core.setMatrixAt(i, zero); halo.setMatrixAt(i, zero); continue; }
        o3.position.set(LANES[o.lane], DECK + 1.7 + Math.sin(t * 4 + o.s * 0.3) * 0.25, -o.s);
        o3.rotation.set(t * 2 + o.s, t * 3, 0); o3.scale.setScalar(1);
        o3.updateMatrix(); core.setMatrixAt(i, o3.matrix);
        o3.rotation.set(0, 0, 0); o3.scale.setScalar(0.9 + 0.12 * Math.sin(t * 8 + o.s)); o3.updateMatrix(); halo.setMatrixAt(i, o3.matrix);
      }
      core.instanceMatrix.needsUpdate = true; halo.instanceMatrix.needsUpdate = true;
    },
  };
}
