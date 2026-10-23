// MACAO · el mundo: agua, puentes con luces ámbar, casco antiguo con fachadas pastel,
// neones inventados (y sus reflejos en el asfalto mojado), la torre al fondo, la fachada
// de iglesia en ruinas, el mercado cubierto, las escaleras y el muelle con el ferry.
// Todo lo repetido va en InstancedMesh o geometrías fusionadas por material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flat, glow, canvasTexture } from '../../core/util.js';
import { facadeTex, signAtlas, SIGNS, SIGN_ID, softRectTex, calcadaTex, crateTex, stripeTex } from './texturas.js';

const UP = new THREE.Vector3(0, 1, 0);
export const SIDEWALK = { main: 2.2, short: 1.4 };
const WATER_Y = -3;

export function buildWorld({ scene, rng, main, kindAt, shortcuts, events, q, makeCharacter, finishS }) {
  const roads = [{ road: main, main: true, sw: SIDEWALK.main }, ...shortcuts.map((sc) => ({ road: sc.road, sc, sw: SIDEWALK.short }))];
  const anim = []; // funciones update(t)
  const geoBins = new Map(); // material → geometrías para fusionar
  const addGeo = (mat, geo) => { if (!geoBins.has(mat)) geoBins.set(mat, []); geoBins.get(mat).push(geo); };
  const tmp = new THREE.Object3D();
  const v3 = new THREE.Vector3();

  // ¿El punto cae dentro de la calzada de alguna carretera (salvo "skip")?
  function inCorridor(x, z, margin, skip = null) {
    for (const R of roads) {
      if (R === skip) continue;
      const qq = R.road.locate({ x, z }, -1);
      if (qq.s < 0.4 || qq.s > R.road.length - 0.4) continue;
      if (Math.abs(qq.lateral) < R.road.width / 2 + margin) return true;
    }
    return false;
  }
  const excl = []; // zonas sin edificios {x,z,r}
  const inExcl = (x, z) => excl.some((e) => (x - e.x) ** 2 + (z - e.z) ** 2 < e.r * e.r);
  const isLand = (R, s) => !R.main || kindAt(s) !== 'bridge';

  // ── materiales ──
  const calc = calcadaTex(); calc.wrapS = calc.wrapT = THREE.RepeatWrapping;
  const M = {
    sidewalk: new THREE.MeshStandardMaterial({ map: calc, roughness: 0.6, side: THREE.DoubleSide }),
    curb: flat('#8f8494', { side: THREE.DoubleSide }),
    rail: flat('#5d5470', { side: THREE.DoubleSide }),
    deck: flat('#3b3350', { side: THREE.DoubleSide }),
    strip: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb703').multiplyScalar(1.5), toneMapped: false, side: THREE.DoubleSide }),
    iron: flat('#1b1622', { side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ map: stripeTex('#9a6fd0', '#7a4fb0'), emissive: '#3a1a5a', roughness: 0.8, side: THREE.DoubleSide, flatShading: true }),
  };

  // ── cintas a lo largo de una carretera (aceras, vallas, barandillas) ──
  function ribbon(road, a, b, mask, mat, vScale = 4) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= road.n; i++) {
      const p = road.pts[i], nr = road.nors[i];
      pos.push(p.x + nr.x * a[0], p.y + a[1], p.z + nr.z * a[0], p.x + nr.x * b[0], p.y + b[1], p.z + nr.z * b[0]);
      const v = road.dist[i] / vScale; uv.push(0, v, 1, v);
      if (i < road.n && mask[i] && mask[i + 1]) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    addGeo(mat, g);
  }
  // máscara: tramo libre de otras calzadas a ese lateral
  function maskFor(R, lat, pred) {
    const m = new Array(R.road.n + 1);
    for (let i = 0; i <= R.road.n; i++) {
      const p = R.road.pts[i], nr = R.road.nors[i];
      m[i] = pred(R.road.dist[i]) && !inCorridor(p.x + nr.x * lat, p.z + nr.z * lat, 0.3, R);
    }
    return m;
  }

  // ── agua y tierra ──
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: '#170c2e', roughness: 0.22, metalness: 0.55 }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; water.receiveShadow = true; scene.add(water);
  // islas de tierra por cada tramo que no es puente
  const runs = []; let cur = null;
  for (let i = 0; i <= main.n; i++) {
    const k = kindAt(main.dist[i]); const land = k !== 'bridge';
    if (land && !cur) { cur = { minx: Infinity, maxx: -Infinity, minz: Infinity, maxz: -Infinity }; runs.push(cur); }
    if (!land) cur = null;
    if (cur) { const p = main.pts[i]; cur.minx = Math.min(cur.minx, p.x); cur.maxx = Math.max(cur.maxx, p.x); cur.minz = Math.min(cur.minz, p.z); cur.maxz = Math.max(cur.maxz, p.z); }
  }
  const landMat = flat('#3b2f48'), wallMat = flat('#5a4a62');
  for (const r of runs) {
    const m = 34, w = r.maxx - r.minx + m * 2, d = r.maxz - r.minz + m * 2;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), landMat); top.rotation.x = -Math.PI / 2; top.position.set((r.minx + r.maxx) / 2, -0.03, (r.minz + r.maxz) / 2); top.receiveShadow = true; scene.add(top);
    const side = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), wallMat); side.position.set(top.position.x, -1.56, top.position.z); scene.add(side);
  }

  // ── carretera principal: aceras en tierra, barandillas en los puentes ──
  const w2 = main.width / 2;
  const R0 = roads[0];
  for (const s of [-1, 1]) {
    const landMask = maskFor(R0, s * (w2 + 0.8), (d) => kindAt(d) !== 'bridge' && !(s === 1 && kindAt(d) === 'pier'));
    ribbon(main, [s * w2, 0.16], [s * (w2 + SIDEWALK.main), 0.16], landMask, M.sidewalk, 3);
    ribbon(main, [s * w2, 0.0], [s * w2, 0.16], landMask, M.curb);
    const bridgeMask = maskFor(R0, s * (w2 + 0.4), (d) => kindAt(d) === 'bridge' || (s === 1 && kindAt(d) === 'pier'));
    ribbon(main, [s * (w2 + 0.4), 0], [s * (w2 + 0.4), 1.0], bridgeMask, M.rail);
    ribbon(main, [s * (w2 + 0.2), 1.02], [s * (w2 + 0.6), 1.02], bridgeMask, M.strip);
    const deckMask = maskFor(R0, 0, (d) => kindAt(d) === 'bridge');
    ribbon(main, [s * (w2 + 0.6), 1.0], [s * (w2 + 0.6), -1.4], deckMask, M.deck);
    if (s === 1) ribbon(main, [-(w2 + 0.6), -1.4], [w2 + 0.6, -1.4], deckMask, M.deck);
  }
  // atajos: aceras estrechas
  for (const R of roads.slice(1)) {
    const hw = R.road.width / 2;
    for (const s of [-1, 1]) {
      const mk = maskFor(R, s * (hw + 0.7), () => true);
      ribbon(R.road, [s * hw, 0.16], [s * (hw + R.sw), 0.16], mk, M.sidewalk, 3);
      ribbon(R.road, [s * hw, 0.0], [s * hw, 0.16], mk, M.curb);
    }
  }

  // ── pilares de los puentes y farolas ──
  const pillars = [], lamps = [], pools = [], reflections = [];
  for (let s = 0; s < main.length; s += 34) {
    if (kindAt(s) !== 'bridge') continue;
    const a = main.at(s); if (a.p.y < 1.2) continue;
    pillars.push({ p: a.p, t: a.t, h: a.p.y - 1.4 - WATER_Y });
  }
  let side = 1;
  for (let s = 8; s < main.length; s += 22) {
    const k = kindAt(s); side = -side;
    const a = main.at(s);
    if (k === 'bridge') {
      for (const sd of [-1, 1]) {
        const p = a.p.clone().addScaledVector(a.n, sd * (w2 + 0.4));
        lamps.push({ p, t: a.t, n: a.n.clone().multiplyScalar(-sd), h: 6.5, bridge: true });
        reflections.push({ p: new THREE.Vector3(p.x + a.n.x * sd * 3, WATER_Y + 0.03, p.z + a.n.z * sd * 3), t: a.t });
      }
    } else {
      const p = a.p.clone().addScaledVector(a.n, side * (w2 + SIDEWALK.main - 0.5));
      if (inCorridor(p.x, p.z, 0.2, R0)) continue;
      lamps.push({ p, t: a.t, n: a.n.clone().multiplyScalar(-side), h: 4.6 });
    }
  }
  for (const R of roads.slice(1)) {
    for (let s = 6; s < R.road.length - 4; s += 14) {
      const a = R.road.at(s), sd = (s / 14) % 2 < 1 ? 1 : -1;
      const p = a.p.clone().addScaledVector(a.n, sd * (R.road.width / 2 + R.sw - 0.4));
      lamps.push({ p, t: a.t, n: a.n.clone().multiplyScalar(-sd), h: 4.2 });
    }
  }
  {
    const geo = new THREE.BoxGeometry(3.2, 1, 2.2); geo.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(geo, flat('#4a4060'), pillars.length);
    pillars.forEach((pl, i) => { tmp.position.set(pl.p.x, WATER_Y, pl.p.z); tmp.rotation.set(0, Math.atan2(pl.t.x, pl.t.z), 0); tmp.scale.set(1, pl.h, 1); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); });
    scene.add(im);
  }
  {
    // farola de forja: poste + brazo (fusionados) y farol luminoso
    const post = new THREE.CylinderGeometry(0.09, 0.14, 1, 6); post.translate(0, 0.5, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.2); arm.translate(0, 0.98, 0.6);
    const pg = mergeGeometries([post.toNonIndexed(), arm.toNonIndexed()]);
    const ims = new THREE.InstancedMesh(pg, flat('#1c1726'), lamps.length);
    const head = new THREE.CylinderGeometry(0.11, 0.17, 0.3, 6);
    const imh = new THREE.InstancedMesh(head, glow('#ffc062', 1.8), lamps.length);
    const poolMat = new THREE.MeshBasicMaterial({ map: softRectTex(), color: '#ff9f40', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const imp = new THREE.InstancedMesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), poolMat, lamps.length);
    lamps.forEach((l, i) => {
      const yaw = Math.atan2(l.n.x, l.n.z);
      tmp.position.copy(l.p); tmp.rotation.set(0, yaw, 0); tmp.scale.set(1, l.h, 1); tmp.updateMatrix(); ims.setMatrixAt(i, tmp.matrix);
      tmp.scale.set(1, 1, 1); tmp.position.copy(l.p).addScaledVector(l.n, 1.15); tmp.position.y += l.h * 0.98 - 0.25; tmp.updateMatrix(); imh.setMatrixAt(i, tmp.matrix);
      tmp.position.copy(l.p).addScaledVector(l.n, 1.6); tmp.position.y = l.p.y + 0.05; tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); imp.setMatrixAt(i, tmp.matrix);
    });
    imp.renderOrder = 1;
    scene.add(ims, imh, imp);
    // reflejos de las farolas del puente en el agua
    const refMat = new THREE.MeshBasicMaterial({ map: softRectTex(), color: '#ffae42', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const imr = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 16).rotateX(-Math.PI / 2), refMat, reflections.length);
    reflections.forEach((r, i) => { tmp.position.copy(r.p); tmp.rotation.set(0, Math.atan2(r.t.x, r.t.z) + Math.PI / 2, 0); tmp.updateMatrix(); imr.setMatrixAt(i, tmp.matrix); });
    scene.add(imr);
    anim.push((t) => { refMat.opacity = 0.42 + Math.sin(t * 2.3) * 0.1; });
  }

  // ── neones: atlas único, quads fusionados ──
  const atlas = signAtlas();
  const soft = softRectTex();
  const S = { steady: { pos: [], uv: [] }, flick: { pos: [], uv: [] }, halo: { pos: [], uv: [], col: [] }, refl: { pos: [], uv: [], col: [] } };
  const backs = [];
  function quad(bin, c, right, up, w, h, uvr, col) {
    const hw = w / 2, hh = h / 2;
    const P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, -hh], [hw, hh], [-hw, hh]];
    const U = [[uvr[0], uvr[1]], [uvr[2], uvr[1]], [uvr[2], uvr[3]], [uvr[0], uvr[1]], [uvr[2], uvr[3]], [uvr[0], uvr[3]]];
    for (let k = 0; k < 6; k++) {
      bin.pos.push(c.x + right.x * P[k][0] + up.x * P[k][1], c.y + right.y * P[k][0] + up.y * P[k][1], c.z + right.z * P[k][0] + up.z * P[k][1]);
      bin.uv.push(U[k][0], U[k][1]);
      if (bin.col) bin.col.push(col.r, col.g, col.b);
    }
  }
  const col = new THREE.Color();
  // cartel que mira a quien viene (normal = -t). right = derecha de la pantalla del conductor.
  function sign(id, center, t, nRight, w, h, { flicker = false, reflect = null, back = true, both = false } = {}) {
    quad(flicker ? S.flick : S.steady, center, nRight, UP, w, h, atlas.uv(id));
    if (both) quad(S.steady, center.clone().addScaledVector(t, 0.26), nRight.clone().multiplyScalar(-1), UP, w, h, atlas.uv(id));
    col.set(SIGNS[id][1]);
    const hc = center.clone().addScaledVector(t, 0.06);
    quad(S.halo, hc, nRight, UP, w * 1.35, h * 1.8, [0, 0, 1, 1], col);
    if (back) backs.push({ p: center.clone().addScaledVector(t, 0.12), t, w, h });
    if (reflect) {
      const rc = reflect.clone();
      const fwd = t.clone().multiplyScalar(-1);
      quad(S.refl, rc, nRight, fwd, Math.min(w * 0.7, 3), 8, [0, 0, 1, 1], col.clone().multiplyScalar(0.85));
    }
  }

  // ── edificios ──
  const variants = [0, 1, 2].map((k) => facadeTex(k + 1));
  const facadeMats = variants.map((v) => new THREE.MeshStandardMaterial({ map: v.map, emissiveMap: v.emissive, emissive: '#ffffff', emissiveIntensity: 0.95, roughness: 0.9 }));
  const roofMat = flat('#2c2238');
  const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
  const buildings = [[], [], []];
  const pastel = ['#f7c6d9', '#ffe5a3', '#c9e4de', '#f9d5a7', '#d7c4f2', '#bfe0f5', '#f2b5a6', '#fff1c1'];

  // la fachada de iglesia en ruinas (sin nombre), en lo alto de una escalinata
  const ig = events.find((e) => e.name === 'iglesia');
  if (ig) {
    const s0 = main.locate(ig, -1).s + 30;
    const a = main.at(s0);
    let best = null;
    for (const sd of [1, -1]) {
      const c = a.p.clone().addScaledVector(a.n, sd * (w2 + 17));
      let free = true;
      for (let dx = -12; dx <= 12; dx += 4) for (let dz = -10; dz <= 10; dz += 4) if (inCorridor(c.x + dx, c.z + dz, 0.5)) free = false;
      if (free) { best = { c, sd }; break; }
    }
    if (best) {
      excl.push({ x: best.c.x, z: best.c.z, r: 19 });
      const g = buildChurch();
      g.position.copy(best.c); g.position.y = 0;
      g.rotation.y = Math.atan2(-a.n.x * best.sd, -a.n.z * best.sd);
      scene.add(g);
    }
  }
  // muelle: terminal + ferry a la derecha
  const pierStart = (() => { for (let s = main.length; s > 0; s -= 2) if (kindAt(s) !== 'pier') return s + 2; return main.length - 140; })();
  {
    const a = main.at(finishS + 6);
    excl.push({ x: a.p.x + a.n.x * 20, z: a.p.z + a.n.z * 20, r: 30 });
    const ferry = buildFerry();
    ferry.position.copy(a.p).addScaledVector(a.n, w2 + 9); ferry.position.y = WATER_Y;
    ferry.rotation.y = Math.atan2(a.t.x, a.t.z);
    scene.add(ferry);
    anim.push((t) => { ferry.position.y = WATER_Y + Math.sin(t * 0.8) * 0.15; ferry.rotation.z = Math.sin(t * 0.6) * 0.01; });
    // fin de la calzada: bolardos
    const e = main.at(main.length - 1);
    for (let k = -2; k <= 2; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1, 6), flat('#ffb703')); b.position.copy(e.p).addScaledVector(e.n, k * 2.2); b.position.y = 0.5; scene.add(b); }
  }

  for (const R of roads) {
    const hw = R.road.width / 2, off = hw + R.sw + 4.5;
    for (const sd of [-1, 1]) {
      let s = R.main ? 0 : 2;
      while (s < R.road.length) {
        const wB = rng.range(7, 11);
        const sc = s + wB / 2;
        s += wB + 0.4;
        if (sc >= R.road.length) break;
        if (!isLand(R, sc)) continue;
        const kind = R.main ? kindAt(sc) : 'short';
        if (kind === 'pier' && sd === 1) continue;
        if (R.main && sc < 18) continue;
        const a = R.road.at(sc);
        const c = a.p.clone().addScaledVector(a.n, sd * off);
        const corners = [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        let ok = true;
        for (const [u, v] of corners) {
          const x = c.x + a.t.x * u * wB / 2 + a.n.x * v * 4.2, z = c.z + a.t.z * u * wB / 2 + a.n.z * v * 4.2;
          if (inCorridor(x, z, R.sw - 0.1) || inExcl(x, z)) { ok = false; break; }
        }
        if (!ok) continue;
        const hB = kind === 'pier' ? rng.range(7, 9) : rng.range(9, 17);
        const vi = Math.floor(rng() * 3);
        buildings[vi].push({ c, yaw: Math.atan2(a.t.x, a.t.z), w: wB, h: hB, color: pastel[Math.floor(rng() * pastel.length)] });
        // neón en banderola (sobresale de la fachada hacia la calle)
        const prob = R.main ? (kind === 'city' ? 0.55 : 0.6) : 0.85;
        if (rng() < prob) {
          const id = Math.floor(rng() * 12);
          const facadeLat = hw + R.sw;
          const sw = R.main ? 3.2 : 2.6;
          const sc2 = sc - wB * 0.3;
          const b = R.road.at(sc2);
          const center = b.p.clone().addScaledVector(b.n, sd * (facadeLat - sw / 2 - 0.1));
          center.y = b.p.y + rng.range(4.3, 6.6);
          const refl = b.p.clone().addScaledVector(b.n, sd * Math.min(hw - 0.6, facadeLat - sw / 2)).addScaledVector(b.t, -3.5);
          refl.y = b.p.y + 0.05;
          sign(id, center, b.t, b.n, sw, sw / 3.2, { flicker: rng() < 0.18, reflect: refl });
        }
      }
    }
  }
  // pancartas de neón cruzando la calle principal del casco antiguo
  for (let s = 40; s < main.length; s += 95) {
    if (kindAt(s) !== 'city') continue;
    const a = main.at(s);
    const c = a.p.clone(); c.y += 6.8;
    const refl = a.p.clone().addScaledVector(a.t, -5); refl.y += 0.05;
    sign(Math.floor(rng() * 12), c, a.t, a.n, 8.4, 8.4 / 3.2, { reflect: refl, both: true });
    for (const sd of [-1, 1]) { const p = a.p.clone().addScaledVector(a.n, sd * 4.6); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8, 0.25), M.iron); pole.position.set(p.x, p.y + 4, p.z); scene.add(pole); }
  }
  // salida y meta
  for (const [sPos, id] of [[44, SIGN_ID.salida], [finishS, SIGN_ID.meta]]) {
    const a = main.at(sPos);
    const c = a.p.clone(); c.y += 6.4;
    sign(id, c, a.t, a.n, 9, 9 / 3.2, { reflect: a.p.clone().addScaledVector(a.t, -5).setY(a.p.y + 0.05), both: true });
    for (const sd of [-1, 1]) { const p = a.p.clone().addScaledVector(a.n, sd * (w2 + 0.3)); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8, 0.35), flat('#2a1d40')); pole.position.set(p.x, p.y + 4, p.z); scene.add(pole); }
  }
  // saltos del puente: cartel + flechas en el suelo
  const chevrons = []; // {p, yaw, group, k}
  events.filter((e) => e.name === 'salto').forEach((e, gi) => {
    const s0 = main.locate(e, -1).s;
    const a = main.at(s0 - 12);
    const c = a.p.clone(); c.y += 6.2;
    sign(SIGN_ID.salto, c, a.t, a.n, 6, 6 / 3.2, { reflect: null, back: true });
    for (const sd of [-1, 1]) { const p = a.p.clone().addScaledVector(a.n, sd * (w2 + 0.3)); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.5, 0.3), flat('#2a1d40')); pole.position.set(p.x, p.y + 3.7, p.z); scene.add(pole); }
    for (let k = 0; k < 5; k++) { const b = main.at(s0 - 8 + k * 4.5); chevrons.push({ p: b.p.clone().setY(b.p.y + 0.06), yaw: Math.atan2(b.t.x, b.t.z), group: 100 + gi, k, scale: 2.2, color: '#ffb703' }); }
  });
  // atajos: arco "¡ATAJO!" y flechas parpadeantes
  shortcuts.forEach((sc, gi) => {
    const r = sc.road;
    const a = r.at(3.5);
    const c = a.p.clone(); c.y += 4.6;
    sign(SIGN_ID.atajo, c, a.t, a.n, 5.8, 5.8 / 3.2, { reflect: a.p.clone().addScaledVector(a.t, -4).setY(a.p.y + 0.05) });
    for (const sd of [-1, 1]) { const p = a.p.clone().addScaledVector(a.n, sd * (r.width / 2 + 0.2)); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.6, 0.25), M.iron); pole.position.set(p.x, p.y + 2.8, p.z); scene.add(pole); }
    for (let k = 0; k < 7; k++) { const b = r.at(5 + k * 4); chevrons.push({ p: b.p.clone().setY(b.p.y + 0.07), yaw: Math.atan2(b.t.x, b.t.z), group: gi, k, scale: 1.6, color: '#ff4fd8' }); }
    // en la principal, justo antes del desvío: flechas rectas hacia el atajo
    for (let k = 0; k < 4; k++) { const b = main.at(sc.sA - 22 + k * 5); chevrons.push({ p: b.p.clone().setY(b.p.y + 0.07), yaw: Math.atan2(b.t.x, b.t.z), group: gi, k: k - 4, scale: 1.3, color: '#ff4fd8' }); }
  });

  // ── mercado cubierto, escaleras y callejones ──
  const crates = [];
  const vendors = [];
  shortcuts.forEach((sc) => {
    const r = sc.road, hw = r.width / 2;
    if (sc.type === 'mercado') {
      const mk = new Array(r.n + 1).fill(true).map((_, i) => r.dist[i] > 7 && r.dist[i] < r.length - 5);
      ribbon(r, [-(hw + 2.2), 5.4], [hw + 2.2, 5.4], mk, M.roof, 2);
      ribbon(r, [-(hw + 2.2), 5.4], [-(hw + 2.2), 3.6], mk, M.roof, 2);
      ribbon(r, [hw + 2.2, 5.4], [hw + 2.2, 3.6], mk, M.roof, 2);
      const posts = [], stalls = [], lanterns = [];
      for (let s = 8; s < r.length - 5; s += 6) {
        const a = r.at(s);
        for (const sd of [-1, 1]) {
          posts.push(a.p.clone().addScaledVector(a.n, sd * (hw + 1.9)));
          if ((s / 6) % 2 < 1) stalls.push({ p: a.p.clone().addScaledVector(a.n, sd * (hw + 0.85)), t: a.t, sd });
        }
        lanterns.push(a.p.clone().setY(a.p.y + 4.4));
      }
      const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 5.4, 0.22).translate(0, 2.7, 0), M.iron, posts.length);
      posts.forEach((p, i) => { tmp.position.copy(p); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); pm.setMatrixAt(i, tmp.matrix); });
      const sm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.9, 2.6).translate(0, 0.45, 0), flat('#7a4a2a'), stalls.length);
      const fruitM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0), flat('#ff8c1a'), stalls.length * 3);
      const aw = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.08, 2.8), new THREE.MeshStandardMaterial({ map: stripeTex('#ffb703', '#7b2cbf'), roughness: 0.8 }), stalls.length);
      const fc = ['#ff8c1a', '#e63946', '#8ac926', '#ffd166'];
      stalls.forEach((st, i) => {
        const yaw = Math.atan2(st.t.x, st.t.z);
        tmp.position.copy(st.p); tmp.rotation.set(0, yaw, 0); tmp.updateMatrix(); sm.setMatrixAt(i, tmp.matrix);
        tmp.position.copy(st.p); tmp.position.y += 2.5; tmp.rotation.set(0, yaw, st.sd * 0.35); tmp.updateMatrix(); aw.setMatrixAt(i, tmp.matrix);
        for (let k = 0; k < 3; k++) { tmp.position.copy(st.p).addScaledVector(st.t, (k - 1) * 0.8); tmp.position.y += 1.1; tmp.rotation.set(0, k, 0); tmp.updateMatrix(); fruitM.setMatrixAt(i * 3 + k, tmp.matrix); fruitM.setColorAt(i * 3 + k, col.set(fc[(i + k) % 4])); }
      });
      const lm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 8), glow('#ff5a4f', 1.6), lanterns.length);
      lanterns.forEach((p, i) => { tmp.position.copy(p); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); lm.setMatrixAt(i, tmp.matrix); });
      scene.add(pm, sm, aw, fruitM, lm);
      // cajas de fruta en el camino (se rompen sin hacer daño a nadie)
      for (let s = 12; s < r.length - 8; s += rng.range(5, 8)) {
        const a = r.at(s), lat = rng.range(-hw + 0.9, hw - 0.9);
        crates.push({ p: a.p.clone().addScaledVector(a.n, lat).setY(a.p.y + 0.45), yaw: rng() * 3, alive: true });
      }
      // dos tenderos simpáticos que saludan
      if (makeCharacter) {
        const looks = [{ skin: '#e8b48a', hair: '#1a1210', shirt: '#ffd166', pattern: 3, shorts: '#3a2a4a', hairStyle: 2, cap: null }, { skin: '#c68a5e', hair: '#5a3a1e', shirt: '#36c2b4', pattern: 0, shorts: '#2e4a7d', hairStyle: 3, cap: '#e63946' }];
        [0.35, 0.7].forEach((u, k) => {
          const a = r.at(r.length * u), sd = k ? 1 : -1;
          const ch = makeCharacter(looks[k]); ch.group.position.copy(a.p).addScaledVector(a.n, sd * (hw + 1.5)); ch.group.position.y = 0.16;
          ch.group.rotation.y = Math.atan2(-a.n.x * sd, -a.n.z * sd);
          scene.add(ch.group); vendors.push(ch);
        });
      }
    } else if (sc.type === 'escaleras') {
      const steps = [];
      for (let s = 0; s < r.length; s += 0.8) {
        const a = r.at(s), b = r.at(s + 0.8);
        if (Math.abs(b.p.y - a.p.y) < 0.02 && a.p.y < 0.05) continue;
        steps.push({ p: a.p, yaw: Math.atan2(a.t.x, a.t.z), top: Math.max(a.p.y, b.p.y) });
      }
      const st = new THREE.InstancedMesh(new THREE.BoxGeometry(r.width + 0.2, 0.4, 0.82).translate(0, -0.2, 0), flat('#b8a7a0'), steps.length);
      steps.forEach((p, i) => { tmp.position.set(p.p.x, p.top + 0.03, p.p.z); tmp.rotation.set(0, p.yaw, 0); tmp.updateMatrix(); st.setMatrixAt(i, tmp.matrix); });
      st.receiveShadow = true; scene.add(st);
      const full = new Array(r.n + 1).fill(true).map((_, i) => r.pts[i].y > 0.05);
      for (const sd of [-1, 1]) ribbon(r, [sd * (hw + 0.1), 0.2], [sd * (hw + 0.1), 1.2], full, M.iron);
    } else {
      // callejón: farolillos colgando
      const ls = [];
      for (let s = 8; s < r.length - 4; s += 3.5) { const a = r.at(s); ls.push({ p: a.p.clone().addScaledVector(a.n, ((s / 3.5) % 2 < 1 ? 1 : -1) * 1.6).setY(a.p.y + 4.8), c: (s / 3.5) % 3 < 1 ? '#ff5a4f' : '#ffb703' }); }
      const lm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.34, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), ls.length);
      ls.forEach((l, i) => { tmp.position.copy(l.p); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); lm.setMatrixAt(i, tmp.matrix); lm.setColorAt(i, col.set(l.c).multiplyScalar(1.15)); });
      scene.add(lm);
    }
  });
  let crateMesh = null;
  if (crates.length) {
    crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ map: crateTex(), roughness: 0.9 }), crates.length);
    crates.forEach((c, i) => { tmp.position.copy(c.p); tmp.rotation.set(0, c.yaw, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); crateMesh.setMatrixAt(i, tmp.matrix); });
    crateMesh.castShadow = true; scene.add(crateMesh);
  }

  // edificios instanciados
  buildings.forEach((list, vi) => {
    if (!list.length) return;
    const fm = facadeMats[vi];
    const im = new THREE.InstancedMesh(bGeo, [fm, fm, roofMat, roofMat, fm, fm], list.length);
    list.forEach((b, i) => { tmp.position.copy(b.c); tmp.position.y = 0; tmp.rotation.set(0, b.yaw, 0); tmp.scale.set(8.8, b.h, b.w); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); im.setColorAt(i, col.set(b.color)); });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
  });
  // traseras de los carteles
  if (backs.length) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.14), flat('#1a0f2b'), backs.length);
    backs.forEach((b, i) => { tmp.position.copy(b.p); tmp.rotation.set(0, Math.atan2(b.t.x, b.t.z), 0); tmp.scale.set(b.w * 1.04, b.h * 1.08, 1); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); });
    scene.add(im);
  }
  // fusiona los quads de neón
  const mkGeo = (bin) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bin.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(bin.uv, 2)); if (bin.col) g.setAttribute('color', new THREE.Float32BufferAttribute(bin.col, 3)); return g; };
  const signMat = new THREE.MeshBasicMaterial({ map: atlas.tex, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) });
  const flickMat = signMat.clone();
  if (S.steady.pos.length) scene.add(new THREE.Mesh(mkGeo(S.steady), signMat));
  if (S.flick.pos.length) scene.add(new THREE.Mesh(mkGeo(S.flick), flickMat));
  const haloMat = new THREE.MeshBasicMaterial({ map: soft, vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = new THREE.Mesh(mkGeo(S.halo), haloMat); halo.renderOrder = 3; scene.add(halo);
  const reflMat = new THREE.MeshBasicMaterial({ map: soft, vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  if (S.refl.pos.length) { const rm = new THREE.Mesh(mkGeo(S.refl), reflMat); rm.renderOrder = 1; scene.add(rm); }
  anim.push((t) => {
    const f = Math.sin(t * 23) > 0.3 || Math.sin(t * 3.1) > -0.6 ? 1.25 : 0.25;
    flickMat.color.setScalar(f);
    reflMat.opacity = 0.5 + Math.sin(t * 1.7) * 0.05;
  });

  // flechas de neón (instanciadas, encendido en secuencia)
  let chevMesh = null;
  if (chevrons.length) {
    const sh = new THREE.Shape([[-1, 0.4], [0, -0.6], [1, 0.4], [0.55, 0.4], [0, -0.15], [-0.55, 0.4]].map(([x, y]) => new THREE.Vector2(x, y)));
    const cg = new THREE.ShapeGeometry(sh); cg.rotateX(-Math.PI / 2);
    chevMesh = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false }), chevrons.length);
    chevrons.forEach((c, i) => { tmp.position.copy(c.p); tmp.rotation.set(0, c.yaw, 0); tmp.scale.setScalar(c.scale); tmp.updateMatrix(); chevMesh.setMatrixAt(i, tmp.matrix); chevMesh.setColorAt(i, col.set(c.color)); });
    chevMesh.renderOrder = 2; scene.add(chevMesh);
    const base = chevrons.map((c) => new THREE.Color(c.color));
    anim.push((t) => {
      chevrons.forEach((c, i) => {
        const ph = ((t * 3 - c.k * 0.35) % 1.2 + 1.2) % 1.2;
        const k = ph < 0.35 ? 1.8 : 0.25;
        col.copy(base[i]).multiplyScalar(k); chevMesh.setColorAt(i, col);
      });
      chevMesh.instanceColor.needsUpdate = true;
    });
  }

  // fusiona cintas por material
  for (const [mat, list] of geoBins) {
    const g = mergeGeometries(list, false);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
  }

  // ── la torre al fondo (siempre visible), skyline lejano, estrellas y luna ──
  const end = main.at(main.length);
  const towerPos = end.p.clone().addScaledVector(end.t, 420).addScaledVector(end.n, -240);
  const tower = buildTower(); tower.group.position.set(towerPos.x, WATER_Y, towerPos.z); tower.group.scale.setScalar(1.45); scene.add(tower.group);
  anim.push(tower.update);
  // skyline
  {
    const n = 140, center = main.at(main.length * 0.55).p;
    const skyTex = canvasTexture(64, 256, (c, W, H) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      for (let y = 6; y < H; y += 10) for (let x = 4; x < W; x += 10) if (Math.random() < 0.35) { c.fillStyle = Math.random() < 0.7 ? '#ffb347' : '#c77dff'; c.fillRect(x, y, 5, 5); }
    });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#241638', emissive: '#ffffff', emissiveMap: skyTex, emissiveIntensity: 0.8, fog: false }), n);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rng() * 0.04, r = rng.range(2300, 2900);
      tmp.position.set(center.x + Math.cos(ang) * r, WATER_Y, center.z + Math.sin(ang) * r);
      tmp.rotation.set(0, rng() * 3, 0); tmp.scale.set(rng.range(50, 130), rng.range(70, 320), rng.range(50, 110)); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix);
    }
    im.frustumCulled = false; scene.add(im);
  }
  {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.08; pos[i * 3] = Math.cos(a) * Math.cos(e) * 850; pos[i * 3 + 1] = Math.sin(e) * 850; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 850; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#f3e8ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    stars.frustumCulled = false; stars.userData.followCamera = true; scene.add(stars);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(30, 24), new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false }));
    moon.position.set(-420, 380, -560); moon.lookAt(0, 0, 0); moon.userData.followCamera = true; scene.add(moon);
    anim.followers = [stars, moon];
  }

  return {
    update(t) { for (const f of anim) f(t); for (const v of vendors) v.pose('wave', t); },
    crates, crateMesh,
    hideCrate(i) { tmp.position.set(0, -50, 0); tmp.scale.setScalar(0.001); tmp.updateMatrix(); crateMesh.setMatrixAt(i, tmp.matrix); crateMesh.instanceMatrix.needsUpdate = true; },
    followers: anim.followers,
    towerPos, pierStart,
    stats: { buildings: buildings.reduce((a, l) => a + l.length, 0), lamps: lamps.length, signs: backs.length },
  };
}

// Torre muy alta con mirador iluminado (inventada, sin nombre)
function buildTower() {
  const g = new THREE.Group();
  const m = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: e || '#000', flatShading: true, roughness: 0.6, fog: false });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(26, 32, 30, 8), m('#4a3a66', '#1a0f2e')); base.position.y = 15; g.add(base);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 230, 8), m('#d9d0ec', '#2a1a48')); shaft.position.y = 140; g.add(shaft);
  // aristas iluminadas
  for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.9, 228, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb703').multiplyScalar(1.3), toneMapped: false, fog: false })); const a = (k / 4) * Math.PI * 2; st.position.set(Math.cos(a) * 7.4, 140, Math.sin(a) * 7.4); g.add(st); }
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(22, 17, 18, 16), m('#3a2a5c', '#120a22')); pod.position.y = 250; g.add(pod);
  const win = new THREE.Mesh(new THREE.CylinderGeometry(22.4, 21.2, 5, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c77dff').multiplyScalar(1.4), toneMapped: false, fog: false }));
  win.position.y = 253; g.add(win);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(23.5, 23.5, 1.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb703').multiplyScalar(1.5), toneMapped: false, fog: false, side: THREE.DoubleSide }));
  ring.position.y = 245; g.add(ring);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 14, 10, 12), m('#d9d0ec', '#2a1a48')); top.position.y = 264; g.add(top);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 80, 6), m('#e8e2f2', '#3a2a5c')); spire.position.y = 309; g.add(spire);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2d55', toneMapped: false, fog: false })); blink.position.y = 350; g.add(blink);
  const haloTex = softRectTex();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshBasicMaterial({ map: haloTex, color: '#9b5de5', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.position.y = 252; g.add(halo);
  return {
    group: g,
    update(t) { blink.visible = Math.sin(t * 4) > 0; win.material.color.setHSL(0.76 + Math.sin(t * 0.5) * 0.05, 0.9, 0.62).multiplyScalar(1.3); },
    halo,
  };
}

// Fachada de iglesia en ruinas, iluminada desde abajo (genérica)
function buildChurch() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#e9cf9f', emissive: '#5a3a12', emissiveIntensity: 0.9, flatShading: true, roughness: 0.9 });
  const holeMat = new THREE.MeshBasicMaterial({ color: '#2a1850' });
  const parts = [], holes = [];
  const tiers = [[26, 11, 0], [23, 9, 11], [17, 8, 20], [10, 7, 28]];
  tiers.forEach(([w, h, y], ti) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.6), stone); b.position.set(0, y + h / 2 + 3, 0); parts.push(b);
    const cols = ti < 3 ? 6 - ti : 2;
    for (let k = 0; k < cols; k++) { const x = -w / 2 + 1 + (k * (w - 2)) / (cols - 1); const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, h - 0.6, 0.6), stone); c.position.set(x, y + h / 2 + 3, 1.0); parts.push(c); }
    const nh = ti === 3 ? 1 : 3;
    for (let k = 0; k < nh; k++) { const x = nh === 1 ? 0 : (k - 1) * (w / 3.4); const hm = new THREE.Mesh(new THREE.PlaneGeometry(ti ? 2.2 : 3.6, ti ? 3.6 : 6.5), holeMat); hm.position.set(x, y + 3 + (ti ? h / 2 : 3.6), 0.82); holes.push(hm); }
  });
  const ped = new THREE.Mesh(new THREE.ConeGeometry(6.5, 5, 3), stone); ped.rotation.z = Math.PI; ped.rotation.y = Math.PI / 2; ped.scale.set(1, 1, 0.25); ped.position.set(0, 3 + 35 + 2, 0); ped.rotation.set(0, 0, 0); parts.push(ped);
  // escalinata
  for (let k = 0; k < 10; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(30 - k * 0.6, 0.3 * (k + 1), 1.2), flat('#b8a7a0')); st.position.set(0, 0.15 * (k + 1), 13 - k * 1.2); parts.push(st); }
  const base = new THREE.Mesh(new THREE.BoxGeometry(28, 3, 2.5), stone); base.position.set(0, 1.5, 0.2); parts.push(base);
  for (const p of parts) { p.castShadow = true; p.receiveShadow = true; g.add(p); }
  for (const h of holes) g.add(h);
  // foco cálido al pie
  const glowMat = new THREE.MeshBasicMaterial({ map: softRectTex(), color: '#ffae42', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), glowMat); gl.position.set(0, 9, 1.4); g.add(gl);
  return g;
}

// Ferry blanco con franja morada y ventanas encendidas
function buildFerry() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 38), flat('#f4f0ff')); hull.position.y = 2; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(4.5, 8, 4), flat('#f4f0ff')); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.55); bow.position.set(0, 2, 22); g.add(bow);
  const band = new THREE.Mesh(new THREE.BoxGeometry(9.1, 0.8, 38.1), flat('#7b2cbf')); band.position.y = 3.2; g.add(band);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.6, 3, 26), flat('#ffffff')); deck.position.set(0, 5.5, -2); g.add(deck);
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 14), flat('#ffffff')); deck2.position.set(0, 8.2, -4); g.add(deck2);
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd38a').multiplyScalar(1.2), toneMapped: false });
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.9, 24), winMat); w1.position.set(0, 5.8, -2); g.add(w1);
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.8, 12), winMat); w2.position.set(0, 8.4, -4); g.add(w2);
  const fun = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 4, 8), flat('#ffb703')); fun.position.set(0, 11, -8); g.add(fun);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
