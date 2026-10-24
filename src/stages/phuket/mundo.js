// Mundo de Phuket: trazado de la carretera de la costa, terreno (playa / acantilado /
// selva), mar que sigue a la carretera, cielo del atardecer y decorado.
// Coordenadas de carretera: s = metros recorridos, d = desvío lateral (+ = derecha).
// El mar está SIEMPRE a la izquierda (d < 0) y la montaña a la derecha.
import * as THREE from 'three';
import { Road } from '../../core/carretera.js';
import { clamp, smoothstep, lerp } from '../../core/util.js';
import { Kit, G, T, matLit, matGlow, palmGeo, bushGeo, treeGeo, rockGeo, stallKit, hutKit, boatKit, karstKit, signMesh, bannerMesh, garland, personKit, SKINS } from './modelos.js';

export const HALF = 5;      // media calzada
export const EDGE = 7;      // fin del arcén
export const WALL = 7.7;    // tope lateral (barandilla / talud)
export const S0 = 80;       // salida (s)

// ───────── zonas a lo largo de la etapa (u = 0..1 de salida a meta) ─────────
// [u, elevación, ancho de playa, altura del talud, llano a la derecha, altura de los montes]
const ZK = [
  [-0.2, 1.2, 24, 1.5, 12, 18],
  [0.12, 1.2, 24, 1.5, 12, 18],
  [0.17, 1.8, 9, 0.5, 26, 14],
  [0.28, 1.8, 9, 0.5, 26, 14],
  [0.345, 9.5, 0, 12, 1, 30],
  [0.42, 12.5, 0, 16, 1, 36],
  [0.48, 9, 0, 11, 1, 30],
  [0.545, 1.2, 26, 2, 10, 20],
  [0.66, 1.2, 26, 2, 10, 20],
  [0.71, 1.8, 10, 0.5, 28, 14],
  [0.85, 1.8, 10, 0.5, 28, 14],
  [0.9, 1.4, 30, 2, 14, 22],
  [1.5, 1.4, 30, 2, 14, 22],
];
export function zoneType(u) {
  if (u < 0.145) return 'playa';
  if (u < 0.31) return 'pueblo';
  if (u < 0.515) return 'acantilado';
  if (u < 0.685) return 'playa';
  if (u < 0.875) return 'pueblo';
  return 'villa';
}

export function makeWorld(ctx, Lg, opts = {}) {
  const MK = opts.market || [-1, -1];
  const inMarket = (s) => s > MK[0] - 12 && s < MK[1] + 12;
  const { rng } = ctx;
  const SF = S0 + Lg;
  const zone = (s) => {
    const u = (s - S0) / Lg;
    let i = 0; while (i < ZK.length - 2 && ZK[i + 1][0] < u) i++;
    const a = ZK[i], b = ZK[i + 1];
    const k = smoothstep(a[0], b[0], u);
    return { u, elev: lerp(a[1], b[1], k), beach: lerp(a[2], b[2], k), cliff: lerp(a[3], b[3], k), flat: lerp(a[4], b[4], k), hill: lerp(a[5], b[5], k) };
  };

  // ───────── trazado ─────────
  const seg = 40, post = 340;
  const total = S0 + Lg + post;
  const nP = Math.ceil(total / seg) + 1;
  const pa = rng() * 6, pb = rng() * 6;
  const pts = [];
  let x = 0, z = 0;
  for (let i = 0; i < nP; i++) {
    const s = i * seg, u = (s - S0) / Lg;
    let h = 0.42 * Math.sin(i * 0.27 + pa) + 0.2 * Math.sin(i * 0.61 + pb);
    if (s < S0 + 60) h *= 0.25;
    if (u > 0.88) h *= 0.2;
    h = clamp(h, -0.55, 0.55);
    pts.push(new THREE.Vector3(x, zone(s).elev, z));
    x += Math.sin(h) * seg; z -= Math.cos(h) * seg;
  }
  const road = new Road(pts, { width: HALF * 2, shoulder: 0 });
  road.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  const L = road.length;
  const N = road.n;
  // rumbo y curvatura en cada muestra (rumbo 0 = hacia -Z, + = hacia la derecha)
  const head = road.tans.map((t) => Math.atan2(t.x, -t.z));
  const curv = head.map((_, i) => {
    const a = head[Math.max(0, i - 3)], b = head[Math.min(N, i + 3)];
    const ds = road.dist[Math.min(N, i + 3)] - road.dist[Math.max(0, i - 3)];
    return (b - a) / (ds || 1);
  });

  // marco sin reservar memoria: F(s, out) → out.p, out.t, out.n, out.curv, out.head
  const mkFrame = () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), curv: 0, head: 0 });
  function F(s, o = mkFrame()) {
    s = clamp(s, 0, L);
    const f = (s / L) * N, i = Math.min(N - 1, Math.floor(f)), k = f - i;
    o.p.copy(road.pts[i]).lerp(road.pts[i + 1], k);
    o.t.copy(road.tans[i]).lerp(road.tans[i + 1], k).normalize();
    o.n.copy(road.nors[i]).lerp(road.nors[i + 1], k); o.n.y = 0; o.n.normalize();
    o.curv = curv[i] + (curv[i + 1] - curv[i]) * k;
    o.head = head[i] + (head[i + 1] - head[i]) * k;
    return o;
  }
  const _f = mkFrame();
  // punto del mundo a partir de (s, d, altura sobre el terreno)
  function W(s, d, up = 0, out = new THREE.Vector3()) {
    F(s, _f);
    const y = profile(s, d, _f.p.y);
    return out.copy(_f.p).addScaledVector(_f.n, d).setY(y + up);
  }
  // giro (rotation.y) para mirar en la dirección (dirT a lo largo, dirN lateral)
  function yawAt(s, dirT = 1, dirN = 0) {
    F(s, _f);
    const dx = _f.t.x * dirT + _f.n.x * dirN, dz = _f.t.z * dirT + _f.n.z * dirN;
    return Math.atan2(dx, dz);
  }

  // villa: explanada a la izquierda alrededor de la meta
  const deckW = (s) => smoothstep(SF - 45, SF - 28, s) * (1 - smoothstep(SF + 62, SF + 80, s));
  const nz = (a, b) => Math.sin(a * 0.051 + b * 0.13) * 0.5 + Math.sin(a * 0.017 - b * 0.071 + 1.3) * 0.8 + Math.sin(a * 0.11 + b * 0.031 + 4.1) * 0.3;

  // ───────── perfil del terreno: altura en (s, d) ─────────
  function profile(s, d, Y, zz = null) {
    const z = zz || zone(s);
    if (Math.abs(d) <= EDGE) return Y;
    if (d < 0) {
      const x = -d - EDGE;
      const bw = Math.max(1, z.beach);
      let beachY = Y - (Y + 0.6) * smoothstep(0.6, bw, x);
      if (x > bw) beachY = -0.6 - (x - bw) * 0.2;
      const rockY = x < 1.0 ? Y : Y * (1 - smoothstep(1.0, 6.5, x)) - 4.5 * smoothstep(3, 15, x) + nz(s, d) * 1.3 * smoothstep(1, 4, x);
      let y = lerp(rockY, beachY, smoothstep(3, 12, z.beach));
      const dw = deckW(s);
      if (dw > 0) { const deckY = x < 34 ? Y - 0.25 : Y - 0.25 - (x - 34) * 0.7; y = lerp(y, deckY, dw); }
      return Math.max(y, -7);
    }
    const x = d - EDGE;
    let y = Y + Math.min(x, 1) * 0.12;
    if (x > z.flat) y = Math.max(y, Y + z.hill * (1 - Math.exp(-(x - z.flat) / 20)) + nz(s, d) * (2 + 0.07 * (x - z.flat)));
    if (z.cliff > 1) y = Math.max(y, Y + z.cliff * smoothstep(0.6, 3.2, x) + (x > 3 ? nz(s * 1.7, d) * 1.5 : 0));
    if (x > 118) y = lerp(y, -4, smoothstep(118, 128, x));
    return y;
  }

  const scene = new THREE.Group();
  const lit = matLit();
  const glowMat = matGlow();
  const dynamic = { boats: [], glowMat, poolMat: null, dancers: [], lanterns: [], bulbs: null, bulbStrings: [], signs: [] };

  // ───────── terreno (cintas a lo largo de la carretera, troceadas) ─────────
  const LEFT = [-5, -EDGE, -7.8, -9, -11, -14, -18, -24, -31, -40, -52, -70];
  const RIGHT = [5, EDGE, 7.8, 9, 10.5, 13, 17, 23, 31, 42, 56, 74, 95, 118, 135];
  const CH = 420; // metros por trozo
  const nCh = Math.ceil(L / CH);
  const chunks = [];
  for (let c = 0; c < nCh; c++) chunks.push({ s0: c * CH, s1: (c + 1) * CH, group: new THREE.Group(), kit: new Kit(), glow: new Kit(), palms: [], bushes: [], trees: [], rocks: [] });
  const chunkAt = (s) => chunks[clamp(Math.floor(s / CH), 0, nCh - 1)];

  const C = {
    sand: new THREE.Color('#f2cc8f'), wet: new THREE.Color('#d9a46c'), rock: new THREE.Color('#b07866'), rock2: new THREE.Color('#9a6a60'),
    grass: new THREE.Color('#9cc65b'), dirt: new THREE.Color('#d8b27a'), jungle: [new THREE.Color('#4c9a48'), new THREE.Color('#3f8a42'), new THREE.Color('#5aa84f')], shoulder: new THREE.Color('#d9b382'), deck: new THREE.Color('#c58b5a'),
  };
  const STEP = 5;
  const rows = [];
  for (let s = 0; s <= L + 0.01; s += STEP) {
    F(s, _f);
    const zz = zone(s);
    const Y = _f.p.y;
    const make = (d) => { const y = profile(s, d, Y, zz) - (Math.abs(d) <= EDGE ? 0.03 : 0); return new THREE.Vector3(_f.p.x + _f.n.x * d, y, _f.p.z + _f.n.z * d); };
    rows.push({ s, Y, zz, L: LEFT.map(make), R: RIGHT.map(make) });
  }
  const tri = [];
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
  function pushTri(kitArr, A, B, Cc, colFn) {
    _a.subVectors(B, A); _b.subVectors(Cc, A); _n.crossVectors(_a, _b);
    if (_n.y < 0) { const t = B; B = Cc; Cc = t; _n.negate(); }
    _n.normalize();
    const cy = (A.y + B.y + Cc.y) / 3;
    const col = colFn(cy, _n.y, A, B, Cc);
    kitArr.p.push(A.x, A.y, A.z, B.x, B.y, B.z, Cc.x, Cc.y, Cc.z);
    kitArr.c.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
  }
  const terrainKits = chunks.map(() => new Kit());
  for (let i = 0; i < rows.length - 1; i++) {
    const r0 = rows[i], r1 = rows[i + 1];
    const kit = terrainKits[clamp(Math.floor(r0.s / CH), 0, nCh - 1)];
    const Y = r0.Y, beachy = r0.zz.beach > 6, dw = deckW(r0.s);
    for (let j = 0; j < LEFT.length - 1; j++) {
      const shoulder = j === 0;
      const colFn = (cy, ny) => {
        if (shoulder) return C.shoulder;
        if (dw > 0.5 && j < 9 && cy > Y - 0.6) return C.deck;
        if (cy < 0.2) return C.wet;
        if (ny < 0.72) return (i + j) % 2 ? C.rock : C.rock2;
        return beachy ? C.sand : (ny < 0.9 ? C.rock : C.grass);
      };
      pushTri(kit, r0.L[j], r0.L[j + 1], r1.L[j], colFn);
      pushTri(kit, r0.L[j + 1], r1.L[j + 1], r1.L[j], colFn);
    }
    for (let j = 0; j < RIGHT.length - 1; j++) {
      const shoulder = j === 0;
      const colFn = (cy, ny) => {
        if (shoulder) return C.shoulder;
        if (ny < 0.6) return (i + j) % 2 ? C.rock : C.rock2;
        if (cy - Y < 1.2 && RIGHT[j] < EDGE + r0.zz.flat) return (i + j) % 3 ? C.grass : C.dirt;
        return C.jungle[(i * 7 + j * 3) % 3];
      };
      pushTri(kit, r0.R[j], r0.R[j + 1], r1.R[j], colFn);
      pushTri(kit, r0.R[j + 1], r1.R[j + 1], r1.R[j], colFn);
    }
  }
  terrainKits.forEach((k, c) => { const m = k.mesh(lit); m.receiveShadow = true; chunks[c].group.add(m); });

  // ───────── asfalto propio (textura cálida con líneas) ─────────
  const roadTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#4b4150'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,${200 + Math.random() * 55},${180 + Math.random() * 60},${Math.random() * 0.07})`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
    g.fillStyle = '#fff3e0'; g.fillRect(4, 0, 4, 256); g.fillRect(120, 0, 4, 256);
    g.fillStyle = '#ffc94a'; g.fillRect(61, 0, 6, 130);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  })();
  {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = road.pts[i], nr = road.nors[i];
      pos.push(p.x - nr.x * HALF, p.y + 0.02, p.z - nr.z * HALF, p.x + nr.x * HALF, p.y + 0.02, p.z + nr.z * HALF);
      const v = road.dist[i] / 12; uv.push(0, v, 1, v);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    // asegurar que mira hacia arriba
    if (g.attributes.normal.getY(0) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.82 }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ───────── mar (cinta enorme a la izquierda) con brillo del sol ─────────
  const seaMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, sunDir: { value: new THREE.Vector3(-0.5, 0.2, -0.8).normalize() },
      deep: { value: new THREE.Color('#1aa0b5') }, horizon: { value: new THREE.Color('#ffc58a') }, sunCol: { value: new THREE.Color('#fff0c0') },
    }]),
    vertexShader: `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float time; uniform vec3 sunDir; uniform vec3 deep; uniform vec3 horizon; uniform vec3 sunCol;
      varying vec3 vW;
      #include <fog_pars_fragment>
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec2 p = vW.xz;
        float a1 = p.x*0.09 + time*0.8, a2 = p.y*0.07 - time*0.6, a3 = (p.x+p.y)*0.23 + time*1.6, a4 = (p.x-p.y)*0.41 - time*2.1;
        vec2 grad = vec2(cos(a1)*0.09*0.5 + cos(a3)*0.23*0.25 + cos(a4)*0.41*0.12, cos(a2)*0.07*0.5 + cos(a3)*0.23*0.25 - cos(a4)*0.41*0.12);
        vec3 N = normalize(vec3(-grad.x*2.2, 1.0, -grad.y*2.2));
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, N);
        float sd = max(dot(R, normalize(sunDir)), 0.0);
        float spec = pow(sd, 90.0) * 2.4 + pow(sd, 10.0) * 0.35;
        float fres = pow(1.0 - max(V.y, 0.0), 4.0);
        vec3 col = mix(deep, horizon, fres * 0.55);
        col += sunCol * spec;
        float sp = step(0.985, h21(floor(p*1.3) + floor(time*3.0))) * pow(sd, 6.0);
        col += sunCol * sp * 1.5;
        float stripes = smoothstep(0.92, 1.0, sin(a1*2.0 + a2*1.5)) * 0.08;
        col += vec3(stripes);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  {
    const SEA = [-5, -22, -60, -140, -320, -700, -1600];
    const pos = [];
    const sStep = 12;
    let prev = null;
    for (let s = -40; s <= L + 400; s += sStep) {
      F(clamp(s, 0, L), _f);
      const ext = s < 0 ? s : s > L ? s - L : 0;
      const row = SEA.map((d) => new THREE.Vector3(_f.p.x + _f.n.x * d + _f.t.x * ext, 0, _f.p.z + _f.n.z * d + _f.t.z * ext));
      if (prev) for (let j = 0; j < SEA.length - 1; j++) {
        const A = prev[j], B = prev[j + 1], Cc = row[j], D = row[j + 1];
        pos.push(A.x, 0, A.z, Cc.x, 0, Cc.z, B.x, 0, B.z, B.x, 0, B.z, Cc.x, 0, Cc.z, D.x, 0, D.z);
      }
      prev = row;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const sea = new THREE.Mesh(g, seaMat); sea.frustumCulled = false; sea.renderOrder = -1;
    seaMat.side = THREE.DoubleSide;
    scene.add(sea);
  }
  // suelo de seguridad bajo todo
  {
    const g = new THREE.PlaneGeometry(8000, 8000); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#2f6b3a' }));
    F(L / 2, _f); m.position.set(_f.p.x, -2.5, _f.p.z);
    scene.add(m);
  }

  // ───────── cielo del atardecer con sol enorme ─────────
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#ff9e6d') }, hor: { value: new THREE.Color('#ffd27f') }, sunDir: { value: new THREE.Vector3(-0.5, 0.25, -0.8).normalize() },
      sunCol: { value: new THREE.Color('#fff1c1') }, glowCol: { value: new THREE.Color('#ffb36b') }, cloudCol: { value: new THREE.Color('#ff8f80') }, time: { value: 0 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 glowCol; uniform vec3 cloudCol; uniform float time;
      varying vec3 vP;
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 sd = normalize(sunDir);
        float cs = max(dot(d, sd), 0.0);
        vec3 c = mix(hor, top, pow(clamp(h, 0.0, 1.0), 0.55));
        c = mix(c, hor * 0.9, clamp(-h * 4.0, 0.0, 1.0));
        c += glowCol * (pow(cs, 6.0) * 0.6 + pow(cs, 30.0) * 0.7) * (1.0 - clamp(h, 0.0, 1.0));
        // nubes alargadas
        float az = atan(d.x, d.z);
        float band = smoothstep(0.02, 0.07, h) * (1.0 - smoothstep(0.16, 0.34, h));
        float cl = sin(az * 9.0 + h * 60.0 + time * 0.02) * 0.5 + sin(az * 23.0 - h * 30.0 + 2.0) * 0.35 + sin(az * 4.0 + 1.3) * 0.4;
        float cloud = smoothstep(0.35, 0.75, cl) * band;
        c = mix(c, cloudCol + glowCol * pow(cs, 6.0) * 0.6, cloud * 0.7);
        // disco del sol
        float disc = smoothstep(0.9966, 0.9973, cs);
        c = mix(c, sunCol * 1.25, disc);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 32, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;

  // ───────── decorado ─────────
  const palmG = palmGeo(), bushG = bushGeo(), treeG = treeGeo(), rockG = rockGeo();
  const tmp = new THREE.Object3D();
  const addInst = (list, s, d, scale = 1, ry = null, tilt = 0, color = null, up = 0) => {
    const p = W(s, d, up);
    tmp.position.copy(p); tmp.rotation.set(0, ry ?? rng() * 6.28, tilt); tmp.scale.setScalar(scale); tmp.updateMatrix();
    list.push({ m: tmp.matrix.clone(), c: color });
  };
  const jungleCols = ['#4c9a48', '#3f8a42', '#5aa84f', '#6ab04c', '#2f7a3c', '#7fbf5a'];
  const flowerCols = ['#ff6fb5', '#ffb703', '#ff6f61'];
  // vegetación y rocas cada pocos metros
  for (let s = 10; s < L - 5; s += 4) {
    const z = zone(s), u = z.u, ch = chunkAt(s);
    const zt = zoneType(u);
    // selva/monte a la derecha
    if (rng() < 0.85) { const d = EDGE + Math.max(z.flat, 2) + rng.range(1, 70); addInst(ch.bushes, s, d, rng.range(0.7, 1.6), null, 0, rng.chance(0.06) ? rng.pick(flowerCols) : rng.pick(jungleCols)); }
    if (rng() < 0.45) { const d = EDGE + Math.max(z.flat, 3) + rng.range(3, 90); addInst(ch.trees, s, d, rng.range(0.8, 1.5), null, 0, rng.pick(jungleCols)); }
    if (z.cliff > 6 && rng() < 0.35) addInst(ch.rocks, s, EDGE + rng.range(1.2, 4), rng.range(0.6, 1.5), null, 0, rng.pick(['#b07866', '#9a6a60', '#c08870']), -0.2);
    // palmeras
    if (z.beach > 6 && rng() < 0.32) addInst(ch.palms, s, -EDGE - rng.range(2, Math.max(3, z.beach - 3)), rng.range(0.8, 1.25), rng() * 6.28, rng.range(-0.12, 0.12));
    if (rng() < (zt === 'acantilado' ? 0.04 : 0.14)) addInst(ch.palms, s, EDGE + rng.range(2.5, Math.max(4, z.flat + 6)), rng.range(0.8, 1.3), rng() * 6.28, rng.range(-0.1, 0.1));
    // rocas en la orilla del acantilado
    if (z.beach < 4 && rng() < 0.3) addInst(ch.rocks, s, -EDGE - rng.range(8, 18), rng.range(1.2, 3), null, 0, rng.pick(['#9a6a60', '#b07866']), -0.5);
    if (z.beach > 8 && rng() < 0.04) addInst(ch.rocks, s, -EDGE - z.beach - rng.range(-2, 4), rng.range(0.8, 1.8), null, 0, '#a37a6a', -0.3);
  }
  // barandilla blanca y roja en el lado del mar (siempre)
  {
    const postG = new THREE.CylinderGeometry(0.09, 0.09, 1, 5); postG.translate(0, 0.5, 0);
    const posts = [];
    for (let s = 4; s < SF + 70; s += 4.5) { if (deckW(s) > 0.2 || inMarket(s)) continue; const p = W(s, -WALL - 0.15); tmp.position.copy(p); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 0.9, 1); tmp.updateMatrix(); posts.push(tmp.matrix.clone()); }
    const im = new THREE.InstancedMesh(postG, new THREE.MeshStandardMaterial({ color: '#fff8ec', flatShading: true, roughness: 0.6 }), posts.length);
    posts.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    scene.add(im);
    // cinta de la barandilla (franja roja/blanca)
    const pos = [], col = [];
    const cA = new THREE.Color('#e63946'), cB = new THREE.Color('#fff8ec');
    let prev = null;
    for (let s = 4; s < SF + 70; s += 3) {
      const dw = deckW(s);
      const p = W(s, -WALL - 0.12); const y0 = p.y + 0.55, y1 = p.y + 0.8;
      const cur = { a: new THREE.Vector3(p.x, y0, p.z), b: new THREE.Vector3(p.x, y1, p.z), skip: dw > 0.2 || inMarket(s) };
      if (prev && !cur.skip && !prev.skip) {
        const c = Math.floor(s / 3) % 2 ? cA : cB;
        pos.push(prev.a.x, prev.a.y, prev.a.z, cur.a.x, cur.a.y, cur.a.z, prev.b.x, prev.b.y, prev.b.z, prev.b.x, prev.b.y, prev.b.z, cur.a.x, cur.a.y, cur.a.z, cur.b.x, cur.b.y, cur.b.z);
        for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
      }
      prev = cur;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const rail = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }));
    scene.add(rail);
  }

  // colocar un modelo del kit en (s, d) mirando a la carretera (face: 'road' | 'along' | ángulo)
  function place(kit, s, d, face = 'road', up = 0) {
    const p = W(s, d, up);
    let ry;
    if (face === 'road') ry = yawAt(s, 0, d > 0 ? -1 : 1);
    else if (face === 'oncoming') ry = yawAt(s, -1, d > 0 ? -0.6 : 0.6);
    else if (face === 'along') ry = yawAt(s, 1, 0);
    else ry = face;
    kit.push(T({ x: p.x, y: p.y, z: p.z, ry }));
    return () => kit.pop();
  }

  // casetas y puestos en los pueblos
  const STALL_COLS = [['#ff6f61', '#fff8ec'], ['#2ec4b6', '#fff8ec'], ['#ffb703', '#ff4fa3'], ['#7b5cff', '#ffd166'], ['#ef476f', '#ffd166']];
  const bulbList = []; // {p, c, string}
  const strings = [];
  const BULB = ['#ffd166', '#ff6f61', '#2ec4b6', '#ff4fa3', '#fff3c4', '#8ac926'];
  function addGarland(k, a, b, n, sag, sOn, market = false) {
    const id = strings.length; strings.push({ s: sOn, on: 0, market });
    for (const p of garland(k, a, b, n, sag)) bulbList.push({ p, c: BULB[bulbList.length % BULB.length], string: id });
  }
  const stallSpots = [];
  for (let s = S0 + 30; s < SF - 20; s += 14) {
    const u = (s - S0) / Lg, zt = zoneType(u), z = zone(s), ch = chunkAt(s);
    if (inMarket(s)) continue;
    if (zt === 'pueblo') {
      if (rng() < 0.55) { const d = EDGE + rng.range(4.5, Math.max(6, z.flat - 4)); const end = place(ch.kit, s, d, 'road'); hutKit(ch.kit, rng); end(); }
      if (rng() < 0.3) { const d = -EDGE - rng.range(4, 7); const end = place(ch.kit, s, d, 'road'); hutKit(ch.kit, rng); end(); }
      if (rng() < 0.36) stallSpots.push({ s: s + 6, d: EDGE + 2.0, side: 1 });
      else if (rng() < 0.12) stallSpots.push({ s: s + 6, d: -EDGE - 2.2, side: -1 });
    } else if (zt === 'playa' && rng() < 0.12) {
      // chiringuito de playa
      const d = -EDGE - rng.range(3, 6); const end = place(ch.kit, s, d, 'road'); hutKit(ch.kit, rng); end();
    }
  }
  // puestos de fruta (con algunos carteles)
  for (const sp of stallSpots) {
    const ch = chunkAt(sp.s);
    const [c1, c2] = rng.pick(STALL_COLS);
    const end = place(ch.kit, sp.s, sp.d, 'road'); stallKit(ch.kit, rng, c1, c2); end();
    // guirnalda entre los postes del toldo
    const a = W(sp.s - 1.4, sp.d - sp.side * 0.6, 2.45), b = W(sp.s + 1.4, sp.d - sp.side * 0.6, 2.45);
    addGarland(ch.kit, a, b, 7, 0.25, sp.s);
  }
  // guirnaldas cruzando la carretera en los pueblos
  for (let s = S0 + 20; s < SF; s += 26) {
    const u = (s - S0) / Lg, zt = zoneType(u);
    if (inMarket(s) || (zt !== 'pueblo' && !(zt === 'villa' && s > SF - 140 && s < SF - 10))) continue;
    const ch = chunkAt(s);
    const pA = W(s, -WALL - 0.6), pB = W(s + 3, WALL + 0.6);
    for (const p of [pA, pB]) ch.kit.add(G.cyl5, '#6b4f3a', { x: p.x, y: p.y + 2.6, z: p.z, sx: 0.16, sy: 5.2, sz: 0.16 });
    addGarland(ch.kit, pA.clone().setY(pA.y + 5.1), pB.clone().setY(pB.y + 5.1), 18, 1.1, s);
  }

  // ───────── mercado nocturno: puestos a los dos lados, guirnaldas densas y pancarta ─────────
  if (MK[0] > 0) {
    for (let s = MK[0]; s < MK[1]; s += 9) {
      for (const side of [-1, 1]) {
        const ch = chunkAt(s);
        const d = side * 9.4;
        const [c1, c2] = rng.pick(STALL_COLS);
        const end = place(ch.kit, s + (side > 0 ? 0 : 4.5), d, 'road'); stallKit(ch.kit, rng, c1, c2); end();
      }
    }
    for (let s = MK[0] + 4; s < MK[1]; s += 11) {
      const ch = chunkAt(s);
      const pA = W(s, -8.2), pB = W(s + 2, 8.2);
      for (const p of [pA, pB]) ch.kit.add(G.cyl5, '#6b4f3a', { x: p.x, y: p.y + 2.4, z: p.z, sx: 0.14, sy: 4.8, sz: 0.14 });
      addGarland(ch.kit, pA.clone().setY(pA.y + 4.7), pB.clone().setY(pB.y + 4.7), 16, 0.9, s, true);
      if ((s - MK[0]) % 22 < 11) addGarland(ch.kit, pA.clone().setY(pA.y + 4.2), W(s + 11, -8.2, 4.2), 10, 0.6, s, true);
    }
    // pancarta de entrada (dos caras)
    const ch = chunkAt(MK[0]);
    F(MK[0] - 8, _f);
    const pA = W(MK[0] - 8, -7.2), pB = W(MK[0] - 8, 7.2);
    for (const p of [pA, pB]) ch.kit.add(G.box, '#e63946', { x: p.x, y: p.y + 3, z: p.z, sx: 0.5, sy: 6, sz: 0.5 });
    const ban = bannerMesh('MERCADO NOCTURNO', 13, 1.7);
    ban.position.copy(_f.p).setY(_f.p.y + 5.2);
    ban.rotation.y = Math.atan2(-_f.t.x, -_f.t.z);
    ch.group.add(ban);
    dynamic.marketBanner = ban;
  }

  // barcas de cola larga en el agua y islotes al fondo
  const boatPlaces = [];
  for (let s = S0 - 40; s < SF + 200; s += rng.range(55, 120)) {
    const z = zone(s);
    if (z.beach < 8 && rng() < 0.6) continue;
    boatPlaces.push({ s, d: -EDGE - Math.max(z.beach, 6) - rng.range(8, 50) });
  }
  for (const bp of boatPlaces) {
    const k = new Kit(); boatKit(k, rng);
    const m = k.mesh(lit); m.castShadow = false;
    const p = W(bp.s, bp.d); p.y = 0;
    m.position.copy(p); m.rotation.y = rng() * 6.28;
    const ph = rng() * 6;
    scene.add(m);
    dynamic.boats.push({ m, y0: -0.05, ph, s: bp.s });
  }
  {
    const k = new Kit();
    for (let i = 0; i < 26; i++) {
      const s = rng.range(-100, L + 300), d = -rng.range(140, 950);
      F(clamp(s, 0, L), _f);
      const px = _f.p.x + _f.n.x * d, pz = _f.p.z + _f.n.z * d;
      const far = -d;
      karstKit(k, rng, px, pz, rng.range(18, 42) * (far > 500 ? 1.8 : 1), rng.range(7, 16) * (far > 500 ? 1.6 : 1));
    }
    const m = k.mesh(lit); m.frustumCulled = false;
    scene.add(m);
  }

  // carteles con gracia
  const SIGNS = [
    { u: 0.05, side: 1, lines: ['¡OJO! MONOS', 'cruzan sin mirar (y sin carnet)'], bg: '#ffd166' },
    { u: 0.16, side: 1, lines: ['MANGO', '20 ฿ · el kilo de felicidad'], bg: '#fff8ec', accent: '#ffb703' },
    { u: 0.2, side: -1, lines: ['MASAJE DE PIES', '1ª sonrisa gratis'], bg: '#ffe0f0', accent: '#ff4fa3' },
    { u: 0.24, side: 1, lines: ['GASOLINA', 'en botella · 40 ฿'], bg: '#fff8ec', accent: '#2ec4b6' },
    { u: 0.29, side: 1, lines: ['VILLA DEL CUMPLE', '→ quedan 2 km'], bg: '#2ec4b6', fg: '#fff8ec', accent: '#ffd166' },
    { u: 0.36, side: 1, lines: ['CURVA BONITA', 'frena para la foto'], bg: '#ffd166' },
    { u: 0.46, side: 1, lines: ['PROHIBIDO', 'dar de comer a los monos (lo saben)'], bg: '#fff8ec', accent: '#e63946' },
    { u: 0.56, side: -1, lines: ['COCO FRESCO', 'más fresco que tú'], bg: '#e9ffd9', accent: '#6ab04c' },
    { u: 0.63, side: 1, lines: ['ALQUILER DE SCOOTERS', 'casco incluido, valentía no'], bg: '#fff8ec', accent: '#7b5cff' },
    { u: 0.72, side: 1, lines: ['PAD THAI', 'picante: poco · mucho · adiós'], bg: '#fff8ec', accent: '#ff6f61' },
    { u: 0.78, side: -1, lines: ['BATIDO DE MANGO', 'hecho con mango y cariño'], bg: '#ffd166', accent: '#ff6f61' },
    { u: 0.83, side: 1, lines: ['VILLA DEL CUMPLE', '→ 500 m · ¡huele a tarta!'], bg: '#ff6f61', fg: '#fff8ec', accent: '#ffd166' },
  ];
  for (const sg of SIGNS) {
    const s = S0 + sg.u * Lg, d = sg.side * (WALL + 1.6);
    const ch = chunkAt(s);
    const p = W(s, d);
    const m = signMesh(sg.lines, { bg: sg.bg, fg: sg.fg || '#1a1036', accent: sg.accent || '#ff6f61' });
    m.position.copy(p).setY(p.y + 2.4);
    m.rotation.y = yawAt(s, -1, sg.side > 0 ? -0.45 : 0.45);
    m.castShadow = true;
    ch.group.add(m);
    // patas
    const ry = m.rotation.y;
    for (const o of [-1.2, 1.2]) ch.kit.add(G.box, '#6b4f3a', { x: p.x + Math.cos(ry) * o, y: p.y + 0.9, z: p.z - Math.sin(ry) * o, sx: 0.14, sy: 1.9, sz: 0.14 });
    dynamic.signs.push(m);
  }

  // ───────── villa del cumpleaños (a la izquierda de la meta) ─────────
  const villa = new THREE.Group();
  {
    F(SF + 8, _f);
    const Y = _f.p.y;
    const X = _f.t.clone().setY(0).normalize(), Z = _f.n.clone(), Yv = new THREE.Vector3(0, 1, 0);
    const basis = new THREE.Matrix4().makeBasis(X, Yv, Z); basis.setPosition(_f.p.x, Y, _f.p.z);
    villa.matrixAutoUpdate = false; villa.matrix.copy(basis); villa.updateMatrixWorld(true);
    dynamic.villaBasis = basis;
    const k = new Kit(), gk = new Kit();
    // tarima de madera
    k.add(G.box, '#c58b5a', { x: 4, y: -0.1, z: -24, sx: 62, sy: 0.3, sz: 32 });
    for (let i = 0; i < 16; i++) k.add(G.box, i % 2 ? '#b97f4e' : '#cf9563', { x: -26 + i * 3.8 + 1.9, y: 0.06, z: -24, sx: 3.6, sy: 0.04, sz: 31.5 });
    // piscina
    k.add(G.box, '#fff8ec', { x: 2, y: 0.12, z: -19, sx: 18, sy: 0.2, sz: 9 });
    const poolMat = new THREE.MeshStandardMaterial({ color: '#30d5ff', emissive: '#18b8e8', emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.1 });
    const pool = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 7), poolMat); pool.position.set(2, 0.2, -19);
    villa.add(pool); dynamic.poolMat = poolMat;
    // casa con tejado tailandés
    k.add(G.box, '#fff8ec', { x: -8, y: 2.2, z: -34, sx: 16, sy: 4.4, sz: 8 });
    k.add(G.box, '#5a3a2a', { x: -8, y: 0.3, z: -29.8, sx: 17, sy: 0.6, sz: 0.6 });
    for (const s of [-1, 1]) {
      k.add(G.box, '#8c2f39', { x: -8, y: 5.6, z: -34 + s * 2.6, sx: 17.5, sy: 0.25, sz: 6.4, rx: s * 0.75 });
      k.add(G.box, '#b23a48', { x: -8, y: 7.3, z: -34 + s * 1.2, sx: 15, sy: 0.22, sz: 3.4, rx: s * 0.95 });
    }
    k.add(G.cone4, '#e9c46a', { x: -16.6, y: 8.6, z: -34, sx: 0.4, sy: 1.6, sz: 0.4 });
    k.add(G.cone4, '#e9c46a', { x: 0.6, y: 8.6, z: -34, sx: 0.4, sy: 1.6, sz: 0.4 });
    for (let i = 0; i < 4; i++) gk.add(G.box, '#ffd27a', { x: -14 + i * 4, y: 2.2, z: -29.95, sx: 2.2, sy: 2.4, sz: 0.06 });
    // mesa con tarta
    k.add(G.box, '#fff8ec', { x: 12, y: 0.9, z: -24, sx: 4, sy: 0.1, sz: 1.6 });
    for (const x of [10.3, 13.7]) k.add(G.box, '#6b4f3a', { x, y: 0.45, z: -24, sx: 0.12, sy: 0.9, sz: 1.2 });
    k.add(G.cyl10, '#ffafcc', { x: 12, y: 1.15, z: -24, sx: 0.9, sy: 0.4, sz: 0.9 });
    k.add(G.cyl10, '#fff8ec', { x: 12, y: 1.45, z: -24, sx: 0.65, sy: 0.25, sz: 0.65 });
    for (let i = 0; i < 5; i++) gk.add(G.box, '#ffd166', { x: 12 + Math.cos(i * 1.26) * 0.22, y: 1.7, z: -24 + Math.sin(i * 1.26) * 0.22, sx: 0.05, sy: 0.2, sz: 0.05 });
    // tumbonas
    for (let i = 0; i < 3; i++) { k.add(G.box, '#ffffff', { x: -3 + i * 4, y: 0.4, z: -13.2, sx: 1, sy: 0.12, sz: 2.2, rx: 0.12 }); k.add(G.box, rng.pick(['#ff6f61', '#2ec4b6', '#ffd166']), { x: -3 + i * 4, y: 0.5, z: -13.2, sx: 0.95, sy: 0.08, sz: 2.0, rx: 0.12 }); }
    // altavoces
    for (const x of [-16, 22]) { k.add(G.box, '#2b2d42', { x, y: 1.0, z: -26, sx: 1, sy: 2, sz: 1 }); gk.add(G.cyl10, '#ff4fa3', { x, y: 1.4, z: -25.48, sx: 0.6, sy: 0.04, sz: 0.6, rx: Math.PI / 2 }); }
    // farolillos en hilos
    const LANT = ['#ff6f61', '#ffd166', '#ff4fa3', '#2ec4b6', '#ffb703'];
    for (let r = 0; r < 4; r++) {
      const a = new THREE.Vector3(-20, 5, -12 - r * 5), b = new THREE.Vector3(26, 5, -12 - r * 5);
      for (const p of [a, b]) k.add(G.cyl5, '#6b4f3a', { x: p.x, y: 2.5, z: p.z, sx: 0.14, sy: 5, sz: 0.14 });
      garland(k, a, b, 14, 1.2).forEach((p, i) => {
        gk.add(G.ico0, LANT[(i + r) % LANT.length], { x: p.x, y: p.y - 0.25, z: p.z, sx: 0.5, sy: 0.6, sz: 0.5 });
        k.add(G.box, '#2b2d42', { x: p.x, y: p.y - 0.62, z: p.z, sx: 0.2, sy: 0.06, sz: 0.2 });
      });
    }
    // arco de meta sobre la carretera
    for (const zz of [-6.5, 6.5]) { k.add(G.box, '#fff8ec', { x: -8, y: 3, z: zz, sx: 0.5, sy: 6, sz: 0.5 }); k.add(G.ico0, '#ff6f61', { x: -8, y: 6.2, z: zz, s: 0.9 }); }
    for (let i = 0; i < 16; i++) k.add(G.tri, LANT[i % LANT.length], { x: -8, y: 4.4, z: -6 + i * 0.8, sx: 0.6, sy: 0.7, sz: 1, ry: Math.PI / 2 });
    const banner = bannerMesh('¡FELIZ CUMPLE!', 12, 1.8);
    banner.position.set(-8, 5.4, 0); banner.rotation.y = -Math.PI / 2;
    villa.add(banner);
    // bailarines (siluetas que bailan)
    const DC = ['#ff6f61', '#2ec4b6', '#ffd166', '#ff4fa3', '#7b5cff', '#8ac926', '#fff8ec', '#ff9f1c', '#3a86ff'];
    const DS = ['#e8b48a', '#c68a5e', '#a86b43', '#f6d3b3', '#7a4a2c'];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const kb = new Kit();
      personKit(kb, { shirt: DC[i % DC.length], skin: DS[i % DS.length], hair: ['#1a1210', '#5a3a1e', '#c9a15a'][i % 3], pants: ['#2e4a7d', '#fff8ec', '#1b998b'][i % 3], arms: false, hat: i % 3 === 0 ? 'paja' : null });
      const body = kb.mesh(lit); body.castShadow = true; g.add(body);
      const arms = [];
      for (const s of [-1, 1]) {
        const piv = new THREE.Group(); piv.position.set(0.27 * s, 1.38, 0);
        const ka = new Kit(); ka.add(G.box, DC[i % DC.length], { y: -0.18, sx: 0.11, sy: 0.36, sz: 0.12 }); ka.add(G.ico0, DS[i % DS.length], { y: -0.42, s: 0.13 });
        piv.add(ka.mesh(lit)); g.add(piv); arms.push(piv);
      }
      const ang = (i / 9) * Math.PI * 2;
      const cx = 2 + Math.cos(ang) * (i % 2 ? 11 : 8.5), cz = -19 + Math.sin(ang) * (i % 2 ? 7 : 5.5);
      g.position.set(cx, 0.1, cz); g.rotation.y = Math.atan2(2 - cx, -19 - cz);
      villa.add(g);
      dynamic.dancers.push({ g, arms, ph: rng() * 6, sp: rng.range(5, 8), x: cx, z: cz });
    }
    const vm = k.mesh(lit); vm.castShadow = true; vm.receiveShadow = true; villa.add(vm);
    villa.add(gk.mesh(glowMat));
    // palmeras de la villa
    const vp = [[-22, -14], [26, -16], [-22, -38], [24, -36], [-26, -26]];
    for (const [px, pz] of vp) {
      const pm = new THREE.Mesh(palmG, lit); pm.position.set(px, 0, pz); pm.rotation.y = rng() * 6; pm.scale.setScalar(1.1); pm.castShadow = true; villa.add(pm);
    }
  }
  scene.add(villa);

  // ───────── construir trozos ─────────
  const instMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  for (const ch of chunks) {
    if (!ch.kit.empty) { const m = ch.kit.mesh(lit); m.castShadow = true; m.receiveShadow = true; ch.group.add(m); }
    if (!ch.glow.empty) ch.group.add(ch.glow.mesh(glowMat));
    const mk = (list, geo, cast) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, instMat, list.length);
      const col = new THREE.Color();
      list.forEach((o, i) => { im.setMatrixAt(i, o.m); im.setColorAt(i, col.set(o.c || '#ffffff')); });
      im.castShadow = cast; im.receiveShadow = false;
      im.computeBoundingSphere();
      ch.group.add(im);
    };
    mk(ch.palms, palmG, true); mk(ch.bushes, bushG, false); mk(ch.trees, treeG, true); mk(ch.rocks, rockG, false);
    scene.add(ch.group);
  }
  // bombillas de guirnalda (un InstancedMesh para todas)
  {
    const g = new THREE.IcosahedronGeometry(0.13, 0);
    const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, bulbList.length));
    const c = new THREE.Color();
    bulbList.forEach((b, i) => { tmp.position.copy(b.p); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(1); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); im.setColorAt(i, c.set('#5a5060')); });
    im.computeBoundingSphere();
    scene.add(im);
    dynamic.bulbs = im; dynamic.bulbList = bulbList; dynamic.bulbStrings = strings;
  }

  function setVisible(s) {
    for (const ch of chunks) ch.group.visible = ch.s1 > s - 120 && ch.s0 < s + 900;
  }

  return { scene, sky, skyMat, seaMat, road, L, SF, F, W, yawAt, profile, zone, dynamic, setVisible, mkFrame, deckW, villa };
}
