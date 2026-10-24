// Escenario de la final: cielo de noche, campos de arroz, ciudad, río, el Bund dorado
// y el skyline al otro lado del agua. Casi todo se dibuja con dos shaders propios
// (suelo y edificios con ventanas calculadas) y mallas instanciadas que se reciclan.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flat, glow, makeSky, canvasTexture, makeRng, smoothstep } from '../../core/util.js';

export const DECK = 8;
export const LANES = [-3.6, 0, 3.6];
export const Z = { CITY: 1900, CORE: 2700, RIVER: 4300, BUND: 6000, L: 6600 };
export const SHORE = 23;
export const PROM = { x: 20.6, s: Z.L + 60 }; // donde miran los fuegos
export const FAR_BANK = 345; // orilla de enfrente
// Encuadre final: desde el paseo, mirando al otro lado del río. at(prof, lateral) da puntos del skyline.
export const VIEW = (() => {
  const C = new THREE.Vector3(PROM.x - 8.5, 0, -PROM.s + 3.6);
  const D = new THREE.Vector3(0.9, 0, -0.44).normalize();
  const R = new THREE.Vector3(-D.z, 0, D.x);
  return { C, D, R, at: (depth, lat, y = 0) => C.clone().addScaledVector(D, depth).addScaledVector(R, lat).setY(y) };
})();

// ───────── shader de edificios ─────────
const BVS = `
uniform vec3 uColor;
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vD;
void main(){
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
  m = m * instanceMatrix;
  #endif
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(m) * normal);
  #ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
  #else
  vC = uColor;
  #endif
  vec4 mv = viewMatrix * w;
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const BFS = `
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float uFogAmt;
uniform float uTime; uniform float uRefl; uniform float uGold; uniform float uBand; uniform float uLit;
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vD;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec3 n = normalize(vN);
  float y = abs(vW.y);
  vec3 col;
  if (abs(n.y) > 0.7) {
    col = vC * 0.16 + uGold * vec3(0.25, 0.16, 0.06);
  } else {
    float u = abs(n.x) > abs(n.z) ? vW.z : vW.x;
    vec2 g = vec2(u / 2.4, y / 3.1);
    vec2 cell = floor(g); vec2 f = fract(g);
    // ventanas con antialias: cuando una ventana ocupa menos de ~2 píxeles se funde con su media
    vec2 fw = fwidth(g);
    float aa = smoothstep(0.18, 0.5, max(fw.x, fw.y));
    vec2 e = clamp(fw * 1.5, 0.001, 0.2);
    float win = smoothstep(0.2 - e.x, 0.2 + e.x, f.x) * (1.0 - smoothstep(0.8 - e.x, 0.8 + e.x, f.x)) * smoothstep(0.22 - e.y, 0.22 + e.y, f.y) * (1.0 - smoothstep(0.78 - e.y, 0.78 + e.y, f.y));
    float sd = h21(cell + vC.rg * 37.0);
    float lit = step(1.0 - uLit, sd);
    vec3 wc = mix(vec3(1.0, 0.78, 0.45), vec3(0.62, 0.84, 1.0), step(0.72, h21(cell.yx + 7.7)));
    wc *= 0.75 + 0.8 * sd;
    float shade = 0.3 + 0.2 * abs(n.x) + 0.06 * n.z;
    col = vC * shade;
    vec3 nearC = mix(col, wc, win * lit);
    // de lejos: brillo medio de la fachada, con franjas suaves por plantas
    float band = 0.75 + 0.25 * sin(y * 0.35 + vC.b * 20.0);
    vec3 farC = mix(col, vec3(1.0, 0.82, 0.55), 0.36 * uLit * band);
    col = mix(nearC, farC, aa);
    col += uGold * vec3(1.0, 0.6, 0.22) * (0.18 + 1.1 * exp(-y * 0.08));
    if (uBand > 0.0) col += uBand * vec3(0.3, 0.65, 1.0) * smoothstep(0.55, 1.0, sin(y * 0.05 - uTime * 1.4));
  }
  if (uRefl > 0.5) col *= 0.42;
  col = mix(col, fogColor, smoothstep(fogNear, fogFar, vD) * uFogAmt);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ───────── shader del suelo ─────────
const GVS = `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`;
const GFS = `
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float uTime; uniform vec4 uZ; uniform vec3 uMoon;
varying vec3 vW; varying float vD;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  float s = -vW.z, x = vW.x, ax = abs(x);
  float kCity = smoothstep(uZ.x - 250.0, uZ.x + 80.0, s);
  float kCore = smoothstep(uZ.y - 200.0, uZ.y + 200.0, s);
  float kRiver = smoothstep(uZ.z - 160.0, uZ.z + 40.0, s);
  // campos de arroz con agua y la luna reflejada
  // reflejo del cielo y de la luna sobre agua con ondas
  vec3 V = normalize(vW - cameraPosition);
  vec3 Nw = normalize(vec3(sin(x * 1.3 + s * 0.7 + uTime * 1.1) * 0.035 + sin(x * 0.37 - s * 0.21) * 0.02, 1.0, sin(x * 0.6 - s * 1.4 + uTime * 1.4) * 0.035));
  vec3 Rf = reflect(V, Nw);
  float md = max(dot(Rf, uMoon), 0.0);
  vec3 moonRef = vec3(1.0, 0.94, 0.78) * (pow(md, 260.0) * 2.4 + pow(md, 18.0) * 0.18);
  vec3 skyRef = mix(vec3(0.015, 0.03, 0.09), vec3(0.04, 0.08, 0.2), clamp(1.0 - Rf.y * 2.5, 0.0, 1.0));
  // arrozales: parcelas de tamaño irregular, diques torcidos
  vec2 qq = vec2(x + sin(s * 0.019) * 7.0 + sin(s * 0.061) * 2.5, s + sin(x * 0.027) * 5.0);
  float rowH = 10.0 + 6.0 * h21(vec2(floor(qq.y / 16.0), 2.0));
  vec2 c = vec2(qq.x / (14.0 + 8.0 * h21(vec2(floor(qq.y / rowH), 9.0))), qq.y / rowH);
  vec2 ci = floor(c); vec2 cf = fract(c);
  float r = h21(ci);
  float dw = 0.035 + 0.05 * h21(ci + 3.0);
  float paddy = smoothstep(dw, dw + 0.02, cf.x) * (1.0 - smoothstep(1.0 - dw - 0.02, 1.0 - dw, cf.x)) * smoothstep(dw * 1.4, dw * 1.4 + 0.03, cf.y) * (1.0 - smoothstep(1.0 - dw * 1.4 - 0.03, 1.0 - dw * 1.4, cf.y));
  vec3 water = skyRef * (0.8 + 0.4 * r) + moonRef;
  float tuft = step(0.55, h21(floor(vec2(x, s) * 1.3))) * 0.5;
  vec3 rice = vec3(0.06, 0.16, 0.05) * (0.7 + 0.5 * r + tuft) + moonRef * 0.15;
  vec3 cellC = mix(water, rice, step(0.74, r));
  vec3 campo = mix(vec3(0.09, 0.1, 0.05) * (0.8 + 0.4 * h21(ci + 5.0)), cellC, paddy);
  float fl = step(0.987, h21(ci + 11.0)) * (1.0 - smoothstep(0.0, 0.13, length(cf - 0.5)));
  campo += fl * vec3(1.0, 0.7, 0.35) * 2.0;
  // ciudad: calles y farolas
  vec2 b = vec2(x / 36.0, s / 28.0); vec2 bi = floor(b); vec2 bf = fract(b);
  float st = 1.0 - step(0.07, bf.x) * step(bf.x, 0.93) * step(0.09, bf.y) * step(bf.y, 0.91);
  float lamps = st * step(0.55, fract((bf.x + bf.y) * 9.0));
  vec3 city = vec3(0.04, 0.045, 0.08) + h21(bi) * vec3(0.03);
  city += st * mix(vec3(0.1, 0.07, 0.05), vec3(0.55, 0.34, 0.12), kCore) * 0.7 + lamps * vec3(0.5, 0.3, 0.1) * kCore;
  // autopistas bajo el viaducto
  float hw = step(9.0, ax) * step(ax, 17.0);
  float sub = fract(ax / 2.0);
  float laneId = floor(ax / 2.0);
  float dir = sign(x);
  float period = 8.0 + 7.0 * h21(vec2(laneId, dir + 3.0));
  float ph = fract((s + dir * uTime * (22.0 + 10.0 * h21(vec2(dir + 5.0, laneId)))) / period);
  float car = step(0.8, ph) * step(0.25, sub) * step(sub, 0.75);
  vec3 carC = dir > 0.0 ? vec3(1.0, 0.95, 0.8) * 2.4 : vec3(1.0, 0.12, 0.06) * 2.4;
  vec3 road = vec3(0.035, 0.035, 0.055) + step(0.95, fract(ax / 4.0)) * 0.1 + car * carC;
  city = mix(city, road, hw * kCity);
  vec3 col = mix(campo, city, kCity);
  // río a la derecha
  float isW = step(${SHORE.toFixed(1)}, x) * step(x, ${FAR_BANK.toFixed(1)}) * kRiver;
  float rip = pow(0.5 + 0.5 * sin(s * 0.7 + sin(x * 0.06 + uTime * 0.7) * 2.5 + uTime * 1.2), 16.0);
  vec3 rc = mix(vec3(1.0, 0.32, 0.68), vec3(0.3, 0.8, 1.0), 0.5 + 0.5 * sin(x * 0.02 + s * 0.004));
  rc = mix(rc, vec3(1.0, 0.72, 0.32), 0.5 * step(0.0, sin(s * 0.013 + x * 0.01)));
  vec3 wcol = vec3(0.008, 0.022, 0.055) + skyRef * 0.35 + moonRef * 0.8 + rip * rc * 0.45;
  float prom = (1.0 - smoothstep(0.0, 1.0, abs(x - ${SHORE.toFixed(1)}))) * kRiver;
  col = mix(col, wcol, isW);
  col += prom * vec3(1.0, 0.72, 0.38) * 0.9;
  col = mix(col, fogColor, smoothstep(fogNear, fogFar, vD));
  gl_FragColor = vec4(col, mix(1.0, 0.7, isW));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeWorld(scene, ctx) {
  const q = ctx.engine.q;
  const vr = makeRng(20261024); // aleatorio solo visual (no toca la partida)
  const F = {
    fogColor: { value: new THREE.Color('#111d4a') }, fogNear: { value: 90 }, fogFar: { value: 620 * q.drawDistance + 120 },
    uTime: { value: 0 },
  };
  scene.fog = new THREE.Fog(F.fogColor.value, F.fogNear.value, F.fogFar.value);
  const disposables = [];
  const bMat = (o = {}) => new THREE.ShaderMaterial({
    uniforms: { fogColor: F.fogColor, fogNear: F.fogNear, fogFar: F.fogFar, uTime: F.uTime,
      uFogAmt: { value: o.fogAmt ?? 1 }, uRefl: { value: o.refl ? 1 : 0 }, uGold: { value: o.gold || 0 }, uBand: { value: o.band || 0 },
      uLit: { value: o.lit ?? 0.42 }, uColor: { value: new THREE.Color(o.color || '#2a3350') } },
    vertexShader: BVS, fragmentShader: BFS, side: o.refl ? THREE.DoubleSide : THREE.FrontSide,
  });

  // ───────── cielo, estrellas, luna, montes ─────────
  const sky = makeSky('#03061a', '#16285e', '#0a1233', 1200);
  scene.add(sky);
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 700; i++) {
    const a = vr() * Math.PI * 2, y = 0.08 + Math.pow(vr(), 0.7) * 0.92, r = Math.sqrt(1 - y * y);
    sp.push(Math.cos(a) * r * 1000, y * 1000, Math.sin(a) * r * 1000);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#d6e4ff', size: 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  stars.renderOrder = -9; stars.frustumCulled = false; scene.add(stars);
  const moonDir = new THREE.Vector3(-0.42, 0.3, -0.86).normalize();
  const moon = new THREE.Mesh(new THREE.CircleGeometry(20, 24), new THREE.MeshBasicMaterial({ color: '#fff4d8', fog: false, toneMapped: false }));
  const haloTex = canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,245,220,0.8)'); gr.addColorStop(0.25, 'rgba(180,200,255,0.25)'); gr.addColorStop(1, 'rgba(120,150,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  halo.scale.set(220, 220, 1);
  moon.renderOrder = -8; halo.renderOrder = -7;
  scene.add(moon, halo);
  // montes del campo (silueta lejana que sigue a la cámara)
  const hp = [], N = 96, R = 900;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const h0 = 30 + 70 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37)) + vr() * 15, h1 = 30 + 70 * Math.abs(Math.sin((i + 1) * 0.9) * Math.cos((i + 1) * 0.37)) + vr() * 15;
    const A = [Math.cos(a0) * R, -20, Math.sin(a0) * R], B = [Math.cos(a1) * R, -20, Math.sin(a1) * R];
    const C = [Math.cos(a1) * R, h1, Math.sin(a1) * R], D = [Math.cos(a0) * R, h0, Math.sin(a0) * R];
    hp.push(...A, ...B, ...C, ...A, ...C, ...D);
  }
  const hillGeo = new THREE.BufferGeometry(); hillGeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  const hills = new THREE.Mesh(hillGeo, new THREE.MeshBasicMaterial({ color: '#0a1330', fog: false, side: THREE.DoubleSide }));
  hills.renderOrder = -6; hills.frustumCulled = false; scene.add(hills);

  // ───────── suelo (un plano y un shader) ─────────
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { fogColor: F.fogColor, fogNear: F.fogNear, fogFar: F.fogFar, uTime: F.uTime, uZ: { value: new THREE.Vector4(Z.CITY, Z.CORE, Z.RIVER, Z.BUND) }, uMoon: { value: moonDir } },
    vertexShader: GVS, fragmentShader: GFS, transparent: true,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.renderOrder = -1; ground.frustumCulled = false;
  scene.add(ground);

  // ───────── viaducto (piezas periódicas que avanzan a saltos) ─────────
  const viaduct = new THREE.Group(); scene.add(viaduct);
  const VLEN = 1000;
  const deckMat = flat('#4a5576');
  const deck = new THREE.Mesh(new THREE.BoxGeometry(13.2, 1.4, VLEN), deckMat);
  deck.position.set(0, DECK - 0.7, -VLEN / 2 + 100); deck.receiveShadow = true; viaduct.add(deck);
  const beams = [];
  for (const x of LANES) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, VLEN)); m.position.set(x, DECK + 0.17, -VLEN / 2 + 100); beams.push(m); }
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, VLEN)); m.position.set(6.4 * s, DECK + 0.55, -VLEN / 2 + 100); beams.push(m); }
  const beamMesh = mergeMeshes(beams, flat('#56648a')); beamMesh.receiveShadow = true; viaduct.add(beamMesh);
  const lines = [];
  for (const x of LANES) for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, VLEN)); m.position.set(x + 1.03 * s, DECK + 0.3, -VLEN / 2 + 100); lines.push(m); }
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, VLEN)); m.position.set(6.15 * s, DECK + 1.0, -VLEN / 2 + 100); lines.push(m); }
  const lineMesh = mergeMeshes(lines, glow('#3fb8ff', 1.8)); viaduct.add(lineMesh);
  // marcas de luz cada 6 m sobre las guías (dan la sensación de velocidad)
  const MK = 6, nMk = Math.floor(VLEN / MK);
  const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.1, 1.3), glow('#9fe8ff', 2.2), nMk * 4);
  const tmp = new THREE.Object3D();
  let mi = 0;
  for (let i = 0; i < nMk; i++) for (const x of [LANES[0] - 1.03, LANES[1] - 1.03, LANES[1] + 1.03, LANES[2] + 1.03]) {
    tmp.position.set(x, DECK + 0.36, 100 - i * MK); tmp.updateMatrix(); marks.setMatrixAt(mi++, tmp.matrix);
  }
  marks.frustumCulled = false; scene.add(marks);
  // pilares
  const PL = 32, nPl = Math.ceil(VLEN / PL);
  const pilGeo = mergeGeometries([
    new THREE.BoxGeometry(2.6, DECK - 1.4, 2.2).translate(0, (DECK - 1.4) / 2, 0),
    new THREE.BoxGeometry(9, 1.0, 2.6).translate(0, DECK - 1.9, 0),
  ]);
  const pillars = new THREE.InstancedMesh(pilGeo, flat('#262f4a'), nPl);
  for (let i = 0; i < nPl; i++) { tmp.position.set(0, 0, 100 - i * PL); tmp.updateMatrix(); pillars.setMatrixAt(i, tmp.matrix); }
  pillars.frustumCulled = false; scene.add(pillars);
  // farolas del viaducto
  const LP = 24, nLp = Math.ceil(VLEN / LP);
  const postGeo = mergeGeometries([
    new THREE.BoxGeometry(0.18, 4.2, 0.18).translate(0, 2.1, 0),
    new THREE.BoxGeometry(1.4, 0.14, 0.18).translate(-0.6, 4.2, 0),
  ]);
  const posts = new THREE.InstancedMesh(postGeo, flat('#1c2236'), nLp * 2);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.12, 0.35), glow('#ffe2a8', 2.4), nLp * 2);
  for (let i = 0; i < nLp; i++) for (const s of [-1, 1]) {
    const k = i * 2 + (s > 0 ? 1 : 0);
    tmp.position.set(6.4 * s, DECK + 1.1, 100 - i * LP - (s > 0 ? LP / 2 : 0)); tmp.rotation.set(0, s > 0 ? 0 : Math.PI, 0); tmp.updateMatrix(); posts.setMatrixAt(k, tmp.matrix);
    tmp.position.x -= 1.2 * s; tmp.position.y += 4.2; tmp.updateMatrix(); heads.setMatrixAt(k, tmp.matrix);
  }
  tmp.rotation.set(0, 0, 0);
  posts.frustumCulled = heads.frustumCulled = false; scene.add(posts, heads);

  // ───────── edificios reciclables ─────────
  const NB = Math.round(36 * (0.6 + 0.4 * q.drawDistance));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const bldMat = bMat({ lit: 0.42 });
  const total = NB * 4;
  const blds = new THREE.InstancedMesh(boxGeo, bldMat, total);
  const bldRefl = new THREE.InstancedMesh(boxGeo, bMat({ refl: true }), total);
  const tops = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2030').multiplyScalar(2.5), toneMapped: false }), total);
  const col = new THREE.Color();
  for (let i = 0; i < total; i++) { blds.setColorAt(i, col.set('#223')); }
  bldRefl.instanceMatrix = blds.instanceMatrix; bldRefl.instanceColor = blds.instanceColor;
  bldRefl.scale.y = -1;
  blds.frustumCulled = bldRefl.frustumCulled = tops.frustumCulled = false;
  scene.add(blds, bldRefl, tops);
  const PALS = {
    campo: ['#5a4a38', '#4a4236', '#3e4656'],
    sub: ['#2c3448', '#36324a', '#2a3a44', '#3b3a48'],
    core: ['#1d2a4a', '#2a2050', '#163848', '#33284a', '#22304e', '#3a3f5c'],
    far: ['#1d2a4a', '#2a2050', '#163848', '#3a3f5c'],
  };
  const pick = (a) => a[Math.floor(vr() * a.length)];
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // cada "fila" (lado × hilera) lleva su cursor; un edificio que queda atrás salta delante
  const rows = [];
  for (const side of [-1, 1]) for (const row of [0, 1]) rows.push({ side, row, cursor: -150, items: [] });
  let bi = 0;
  for (const r of rows) for (let k = 0; k < NB; k++) r.items.push({ i: bi++, s: -1e9, end: -1e9 });
  function design(s, side, row) {
    // devuelve { x, w, h, d, gap, color } o null (hueco)
    const river = s > Z.RIVER - 60, bund = s > Z.BUND - 80 && s < Z.L + 260;
    if (s < Z.CITY - 120) {
      if (vr() < 0.45) return { empty: true, gap: 20 + vr() * 50 };
      const w = 5 + vr() * 5;
      return { x: side * (row ? 90 + vr() * 220 : 26 + vr() * 60), w, h: 3 + vr() * 4, d: 5 + vr() * 4, gap: 30 + vr() * 70, color: pick(PALS.campo), lit: false };
    }
    if (side > 0 && river) {
      if (row === 0) return { empty: true, gap: 60 };
      const nearSky = s > Z.L - 420 && s < Z.L + 520;
      return { x: nearSky ? 780 + vr() * 220 : FAR_BANK + 25 + vr() * 300, w: 22 + vr() * 26, h: 70 + vr() * 150, d: 22 + vr() * 20, gap: 4 + vr() * 24, color: pick(PALS.far), lit: true };
    }
    if (side < 0 && bund && row === 0) return { empty: true, gap: 40 };
    if (s < Z.CORE) {
      return row === 0
        ? { x: side * (24 + vr() * 16), w: 8 + vr() * 8, h: 8 + vr() * 22, d: 8 + vr() * 10, gap: 6 + vr() * 14, color: pick(PALS.sub), lit: true }
        : { x: side * (48 + vr() * 80), w: 12 + vr() * 12, h: 14 + vr() * 34, d: 12 + vr() * 10, gap: 6 + vr() * 20, color: pick(PALS.sub), lit: true };
    }
    const hm = river ? 0.55 : 1;
    return row === 0
      ? { x: side * (24 + vr() * 10), w: 10 + vr() * 12, h: (30 + vr() * 90) * hm, d: 10 + vr() * 12, gap: 3 + vr() * 9, color: pick(PALS.core), lit: true }
      : { x: side * (44 + vr() * 110), w: 16 + vr() * 16, h: (50 + vr() * 120) * hm, d: 14 + vr() * 16, gap: 4 + vr() * 14, color: pick(PALS.core), lit: true };
  }
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3();
  function place(r, it) {
    const d = design(r.cursor, r.side, r.row);
    if (d.empty) {
      it.s = r.cursor; it.end = r.cursor + d.gap; r.cursor += d.gap;
      blds.setMatrixAt(it.i, zero); tops.setMatrixAt(it.i, zero); return;
    }
    const cz = r.cursor + d.d / 2;
    m4.compose(v3.set(d.x, 0, -cz), q4.identity(), s3.set(d.w, d.h, d.d));
    blds.setMatrixAt(it.i, m4);
    blds.setColorAt(it.i, col.set(d.color));
    if (d.h > 55) { m4.compose(v3.set(d.x, d.h + 0.6, -cz), q4, s3.set(1.1, 1.1, 1.1)); tops.setMatrixAt(it.i, m4); } else tops.setMatrixAt(it.i, zero);
    it.s = r.cursor; it.end = r.cursor + d.d; r.cursor += d.d + d.gap;
  }
  function recycle(spos, force) {
    let changed = false;
    for (const r of rows) {
      for (const it of r.items) {
        if (force || it.end < spos - 70) { place(r, it); changed = true; }
      }
    }
    if (changed) { blds.instanceMatrix.needsUpdate = true; blds.instanceColor.needsUpdate = true; tops.instanceMatrix.needsUpdate = true; }
  }

  // ───────── barcos del río ─────────
  const NBo = 16;
  const hull = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 1.2, 14).translate(0, 0.4, 0), flat('#121828'), NBo);
  const cabin = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 1.1, 8.5).translate(0, 1.55, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), NBo);
  const boatCols = ['#ff4fa3', '#4cc9f0', '#ffd166', '#b388ff', '#7cff6b'];
  const boats = [];
  for (let i = 0; i < NBo; i++) {
    boats.push({ s: Z.RIVER + vr() * 1800, x: 60 + vr() * 300, v: (vr() < 0.5 ? -1 : 1) * (5 + vr() * 8) });
    cabin.setColorAt(i, col.set(pick(boatCols)).multiplyScalar(2.2));
  }
  hull.frustumCulled = cabin.frustumCulled = false; scene.add(hull, cabin);

  // ───────── estación de salida en el campo ─────────
  const startSt = new THREE.Group(); scene.add(startSt);
  for (const s of [-1, 1]) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 60), flat('#4a5470')); plat.position.set(8.4 * s, DECK + 0.2, -10); plat.receiveShadow = true; startSt.add(plat);
    for (let k = 0; k < 4; k++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), flat('#1c2236')); lamp.position.set(9.4 * s, DECK + 2.3, 10 - k * 14); startSt.add(lamp);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glow('#ffe2a8', 2.5)); hd.position.set(9.4 * s, DECK + 3.9, 10 - k * 14); startSt.add(hd);
    }
  }
  startSt.add(signMesh('ARROZAL · SALIDA', 14, 1.9, '#ffd166', [0, DECK + 9.5, -60], 0));
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10.4, 0.5), flat('#2b3552')); c.position.set(7.4 * s, DECK + 4.7, -60); startSt.add(c); }

  // ───────── el Bund: edificios de época iluminados en dorado ─────────
  const bund = new THREE.Group(); scene.add(bund);
  const bundMat = bMat({ gold: 1, lit: 0.62 });
  const bundBoxes = [], roofs = [], tmpO = new THREE.Object3D();
  const goldRoof = new THREE.MeshStandardMaterial({ color: '#d9a441', emissive: '#7a4a12', emissiveIntensity: 1.2, flatShading: true, roughness: 0.5, metalness: 0.4 });
  let bs = Z.BUND + 30;
  const bundCols = ['#8a7350', '#7d6a4f', '#94805e', '#6f6048'];
  let bk = 0;
  while (bs < Z.L + 220) {
    const w = 18 + vr() * 14, d = 15 + vr() * 6, h = 16 + vr() * 14;
    const x = -14 - d / 2, cz = -(bs + w / 2);
    bundBoxes.push({ x, cz, w, h, d, c: bundCols[bk % 4] });
    // cornisa
    roofs.push(new THREE.BoxGeometry(d + 1.2, 1.0, w + 1.2).translate(x, h + 0.5, cz));
    const kind = bk % 4;
    if (kind === 0) roofs.push(new THREE.SphereGeometry(Math.min(w, d) * 0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h + 1, cz));
    else if (kind === 1) { roofs.push(new THREE.BoxGeometry(6, 10, 6).translate(x + d * 0.2, h + 6, cz)); roofs.push(new THREE.ConeGeometry(4.6, 6, 4).rotateY(Math.PI / 4).translate(x + d * 0.2, h + 14, cz)); }
    else if (kind === 2) roofs.push(new THREE.ConeGeometry(Math.min(w, d) * 0.62, 5, 4).rotateY(Math.PI / 4).translate(x, h + 3.5, cz));
    else { for (let c = -2; c <= 2; c++) roofs.push(new THREE.BoxGeometry(1.0, 6, 1.0).translate(x + d / 2 + 0.6, h - 3, cz + c * w * 0.18)); }
    if (kind === 1) {
      const clock = new THREE.Mesh(new THREE.CircleGeometry(1.8, 16), glow('#fff1c8', 2)); clock.position.set(x + d * 0.2 + 3.05, h + 7, cz); clock.rotation.y = Math.PI / 2; bund.add(clock);
    }
    bs += w + 1.5 + vr() * 3; bk++;
  }
  const bundInst = new THREE.InstancedMesh(boxGeo, bundMat, bundBoxes.length);
  bundBoxes.forEach((b, i) => { m4.compose(v3.set(b.x, 0, b.cz), q4.identity(), s3.set(b.d, b.h, b.w)); bundInst.setMatrixAt(i, m4); bundInst.setColorAt(i, col.set(b.c)); });
  bund.add(bundInst);
  bund.add(new THREE.Mesh(mergeGeometries(roofs.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g; })), goldRoof));

  // ───────── estación final y paseo del río ─────────
  const station = new THREE.Group(); scene.add(station);
  const SLEN = 150, sCz = -(Z.L - 45);
  const arch = new THREE.CylinderGeometry(10.5, 10.5, SLEN, 14, 1, true, 0, Math.PI); arch.rotateX(Math.PI / 2); arch.rotateZ(Math.PI / 2);
  const archMesh = new THREE.Mesh(arch, new THREE.MeshStandardMaterial({ color: '#1a2a52', roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  archMesh.position.set(0, DECK, sCz); station.add(archMesh);
  const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(10.5, 0.22, 4, 18, Math.PI), glow('#ffd27a', 2.2), Math.ceil(SLEN / 10) + 1);
  for (let i = 0; i <= SLEN / 10; i++) { tmp.position.set(0, DECK, sCz + SLEN / 2 - i * 10); tmp.updateMatrix(); ribs.setMatrixAt(i, tmp.matrix); }
  station.add(ribs);
  for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, SLEN), flat('#59627e')); pl.position.set(8.4 * s, DECK + 0.2, sCz); station.add(pl); }
  station.add(signMesh('SHANGHÁI · BUND', 22, 3.4, '#4cc9f0', [0, DECK + 13.2, sCz + SLEN / 2], 0, '#ff4fa3'));
  // paseo junto al agua
  const prom = new THREE.Group(); scene.add(prom);
  const PLEN = 700, pCz = -(Z.L + 40);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, PLEN), flat('#6b6f80')); slab.position.set(SHORE - 3, 0.6, pCz); slab.receiveShadow = true; prom.add(slab);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, PLEN), flat('#c8ccd8')); rail.position.set(SHORE - 0.3, 2.25, pCz); prom.add(rail);
  const nRp = Math.floor(PLEN / 2.5);
  const railPosts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.05, 0.1), flat('#c8ccd8'), nRp);
  for (let i = 0; i < nRp; i++) { tmp.position.set(SHORE - 0.3, 1.7, pCz + PLEN / 2 - i * 2.5); tmp.updateMatrix(); railPosts.setMatrixAt(i, tmp.matrix); }
  prom.add(railPosts);
  const nPL = Math.floor(PLEN / 16);
  const pLamp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 4, 0.16).translate(0, 2, 0), flat('#1c2236'), nPL);
  const pHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), glow('#ffe2a8', 2.6), nPL);
  for (let i = 0; i < nPL; i++) {
    tmp.position.set(SHORE - 5.2, 1.2, pCz + PLEN / 2 - i * 16);
    if (Math.abs(tmp.position.z - VIEW.C.z) < 26) tmp.position.y = -50; tmp.updateMatrix(); pLamp.setMatrixAt(i, tmp.matrix);
    tmp.position.y += 4.2; tmp.updateMatrix(); pHead.setMatrixAt(i, tmp.matrix);
  }
  prom.add(pLamp, pHead);

  // ───────── skyline al otro lado del río (inspirado, sin nombres) ─────────
  const skyline = new THREE.Group(); scene.add(skyline);
  const skyMats = [];
  const sMat = (o) => { const m = bMat({ fogAmt: 0.22, ...o }); skyMats.push(m); return m; };
  // 1) torre en espiral, la más alta
  {
    const g = new THREE.CylinderGeometry(1, 1, 1, 6, 28, false).translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), k = 1 - y * 0.55, a = y * 1.7;
      const x = p.getX(i) * k, z = p.getZ(i) * k;
      p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a));
    }
    g.scale(26, 340, 26);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, sMat({ color: '#4a7cab', band: 1.3, lit: 0.62 }));
    const P = VIEW.at(580, 115); m.position.copy(P); skyline.add(m);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(4, 18, 6), glow('#7fd6ff', 2)); crown.position.copy(P).setY(348); skyline.add(crown);
  }
  // 2) torre "abrebotellas": trapecio con un hueco arriba
  {
    const sh = new THREE.Shape();
    sh.moveTo(-26, 0); sh.lineTo(26, 0); sh.lineTo(15, 300); sh.lineTo(-15, 300); sh.closePath();
    const hole = new THREE.Path(); hole.moveTo(-11, 252); hole.lineTo(11, 252); hole.lineTo(9, 286); hole.lineTo(-9, 286); hole.closePath();
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 24, bevelEnabled: false }); g.translate(0, 0, -12);
    const bo = new THREE.Group();
    bo.add(new THREE.Mesh(g, sMat({ color: '#38506e', lit: 0.55 })));
    const edge = new THREE.Mesh(new THREE.BoxGeometry(31, 1.4, 25), glow('#9ff0ff', 2.4)); edge.position.y = 300.7; bo.add(edge);
    const holeGlow = new THREE.Mesh(new THREE.BoxGeometry(22, 0.8, 25), glow('#9ff0ff', 2)); holeGlow.position.y = 252; bo.add(holeGlow);
    bo.rotation.y = Math.atan2(-VIEW.D.x, -VIEW.D.z);
    bo.position.copy(VIEW.at(530, 40)); skyline.add(bo);
  }
  // 3) torre de las esferas rosas
  {
    const tv = new THREE.Group();
    const legM = flat('#c9cfe0');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 110, 6), legM);
      leg.position.set(Math.cos(a) * 14, 52, Math.sin(a) * 14); leg.rotation.set(Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14); tv.add(leg);
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 260, 8), legM); shaft.position.y = 130; tv.add(shaft);
    const pink = new THREE.MeshStandardMaterial({ color: '#ff7ab8', emissive: '#ff2f8f', emissiveIntensity: 1.1, flatShading: true, roughness: 0.4, metalness: 0.3 });
    const s1 = new THREE.Mesh(new THREE.IcosahedronGeometry(26, 1), pink); s1.position.y = 92; tv.add(s1);
    const s2 = new THREE.Mesh(new THREE.IcosahedronGeometry(14, 1), pink); s2.position.y = 220; tv.add(s2);
    const s3m = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 0), pink); s3m.position.y = 262; tv.add(s3m);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 50, 5), legM); spire.position.y = 290; tv.add(spire);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.5, 6, 4), glow('#ff3060', 3)); tip.position.y = 316; tv.add(tip);
    for (const yy of [30, 150, 182]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(yy === 30 ? 18 : 9, 0.6, 4, 20), glow('#ffd1ec', 2)); ring.rotation.x = Math.PI / 2; ring.position.y = yy; tv.add(ring); }
    tv.position.copy(VIEW.at(455, -120)); skyline.add(tv);
  }
  // 4) torre escalonada tipo pagoda
  {
    const parts = [];
    let w = 34, y = 0;
    for (let t = 0; t < 14; t++) { const hh = t < 4 ? 40 : 15; parts.push(new THREE.BoxGeometry(w, hh, w).translate(0, y + hh / 2, 0)); y += hh; w *= t < 4 ? 0.92 : 0.88; }
    const g = mergeGeometries(parts.map((gg) => gg.toNonIndexed()));
    const P = VIEW.at(495, -35);
    const m = new THREE.Mesh(g, sMat({ color: '#4a4258', gold: 0.35, lit: 0.6 })); m.position.copy(P); skyline.add(m);
    const sp2 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 50, 6), glow('#ffd27a', 2)); sp2.position.copy(P).setY(y + 25); skyline.add(sp2);
  }
  // 5) torres de relleno
  const fill = [];
  const marks2 = [[455, -120], [495, -35], [530, 40], [580, 115]];
  for (let tries = 0; fill.length < 26 && tries < 400; tries++) {
    const dp = 470 + vr() * 300, lat = -300 + vr() * 600;
    const P = VIEW.at(dp, lat);
    if (P.x < FAR_BANK + 20) continue;
    if (marks2.some(([a, b]) => Math.abs(b - lat) < 34 && Math.abs(a - dp) < 70)) continue;
    fill.push({ x: P.x, z: P.z, w: 16 + vr() * 20, h: 45 + vr() * (dp > 600 ? 170 : 110), d: 16 + vr() * 20, c: pick(PALS.far) });
  }
  const fillMesh = new THREE.InstancedMesh(boxGeo, sMat({ lit: 0.48 }), fill.length);
  fill.forEach((b, i) => { m4.compose(v3.set(b.x, 0, b.z), q4.identity(), s3.set(b.w, b.h, b.d)); fillMesh.setMatrixAt(i, m4); fillMesh.setColorAt(i, col.set(b.c)); });
  skyline.add(fillMesh);
  // reflejo en el agua: el mismo skyline boca abajo, más apagado
  const skyRefl = skyline.clone(true);
  skyRefl.scale.y = -1;
  skyRefl.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.isShaderMaterial) { const m = o.material.clone(); m.uniforms = { ...o.material.uniforms, uRefl: { value: 1 }, fogColor: F.fogColor, fogNear: F.fogNear, fogFar: F.fogFar, uTime: F.uTime }; m.side = THREE.DoubleSide; o.material = m; disposables.push(m); }
    else { const m = o.material.clone(); m.side = THREE.DoubleSide; if (m.color) m.color.multiplyScalar(0.4); if (m.emissive) m.emissive.multiplyScalar(0.4); o.material = m; disposables.push(m); }
  });
  scene.add(skyRefl);
  // el Bund también se refleja un poco (está lejos del agua: solo el skyline cuenta de verdad)

  // ───────── luces ─────────
  const hemi = new THREE.HemisphereLight('#8fa6ff', '#1a2040', 1.7); scene.add(hemi);
  const moonL = new THREE.DirectionalLight('#d4ddff', 2.6);
  moonL.castShadow = !!q.shadows;
  moonL.shadow.mapSize.set(q.shadowSize || 1024, q.shadowSize || 1024);
  Object.assign(moonL.shadow.camera, { left: -26, right: 26, top: 30, bottom: -30, near: 1, far: 140 });
  moonL.shadow.bias = -0.0008;
  scene.add(moonL, moonL.target);
  let flashK = 0; const flashC = new THREE.Color('#ffffff'), hemiBase = new THREE.Color('#8fa6ff');

  recycle(0, true);

  const snap = (v, p) => Math.floor(v / p) * p;
  return {
    F, hemi, moonL, skyline, sky,
    flash(colr, k = 1) { flashK = Math.min(1.6, flashK + k); if (colr) flashC.copy(colr); },
    update(spos, camera, dt, trainX) {
      F.uTime.value += dt;
      // cosas que siguen a la cámara
      sky.position.copy(camera.position); stars.position.copy(camera.position);
      moon.position.copy(camera.position).addScaledVector(moonDir, 800); moon.lookAt(camera.position);
      halo.position.copy(moon.position);
      const kCity = smoothstep(Z.CITY - 300, Z.CITY + 300, spos);
      hills.position.set(camera.position.x, -kCity * 140, camera.position.z);
      hills.visible = kCity < 0.99;
      ground.position.set(camera.position.x, 0, camera.position.z);
      // piezas periódicas
      const base = -snap(spos, 96);
      viaduct.position.z = base;
      marks.position.z = -snap(spos, MK);
      pillars.position.z = -snap(spos, PL);
      posts.position.z = heads.position.z = -snap(spos, LP);
      recycle(spos, false);
      // cielo: la ciudad lo tiñe de naranja; en el río se abre la niebla para ver el skyline
      const kRiver = smoothstep(Z.RIVER - 400, Z.BUND, spos);
      sky.material.uniforms.mid.value.set('#16285e').lerp(new THREE.Color('#3a2c5a'), kCity * 0.6);
      F.fogFar.value = (620 * q.drawDistance + 120) * (1 + kRiver * 0.9);
      F.fogNear.value = 90 + kRiver * 110;
      scene.fog.near = F.fogNear.value; scene.fog.far = F.fogFar.value;
      // barcos
      for (let i = 0; i < boats.length; i++) {
        const b = boats[i];
        b.s += b.v * dt;
        if (b.s < spos - 200) b.s += 2000; else if (b.s > spos + 1800) b.s -= 2000;
        if (b.s < Z.RIVER + 20) { hull.setMatrixAt(i, zero); cabin.setMatrixAt(i, zero); continue; }
        m4.compose(v3.set(b.x, 0, -b.s), q4.identity(), s3.set(1, 1, 1));
        hull.setMatrixAt(i, m4); cabin.setMatrixAt(i, m4);
      }
      hull.instanceMatrix.needsUpdate = true; cabin.instanceMatrix.needsUpdate = true;
      // destellos de los fuegos
      flashK *= Math.exp(-dt * 6);
      hemi.color.copy(hemiBase).lerp(flashC, Math.min(1, flashK * 0.6));
      hemi.intensity = 1.7 + flashK * 1.4;
      tops.material.color.setRGB(2.5, 0.2, 0.3).multiplyScalar(0.25 + 0.75 * (Math.sin(F.uTime.value * 3) > 0.3 ? 1 : 0));
      // sombra de la luna siguiendo al tren
      moonL.target.position.set(trainX, DECK, -spos + 10);
      moonL.position.set(trainX - 30, DECK + 60, -spos - 40);
    },
    dispose() { for (const m of disposables) m.dispose(); },
  };
}

// Letrero de neón con canvas
export function signMesh(text, w, h, color, pos, rotY = 0, color2 = null) {
  const tex = canvasTexture(1024, Math.round(1024 * h / w), (g, W, H) => {
    g.fillStyle = 'rgba(6,10,30,0.92)'; g.fillRect(0, 0, W, H);
    g.strokeStyle = color2 || color; g.lineWidth = H * 0.06; g.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12);
    g.font = `800 ${Math.round(H * 0.56)}px Bungee, 'Baloo 2', system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = H * 0.18; g.fillStyle = '#ffffff';
    g.fillText(text, W / 2, H * 0.54);
    g.shadowBlur = H * 0.08; g.fillStyle = color; g.globalAlpha = 0.55; g.fillText(text, W / 2, H * 0.54);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  m.position.set(pos[0], pos[1], pos[2]); m.rotation.y = rotY;
  return m;
}

function mergeMeshes(meshes, material) {
  const geos = meshes.map((m) => { m.updateMatrix(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g; });
  return new THREE.Mesh(mergeGeometries(geos, false), material);
}
