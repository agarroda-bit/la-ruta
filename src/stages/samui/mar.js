// Mar de Koh Samui. Un solo draw:
//  · malla polar que sigue a la barca (densa cerca, gruesa lejos = LOD gratis)
//  · 4 olas de Gerstner en el vértice + hasta 4 "crestas grandes" (las rampas para saltar)
//  · color por profundidad (mapa de bajíos pintado en canvas), espuma en crestas, orillas y rampas,
//    cáusticas en los bajíos, reflejo del cielo (Fresnel), brillos del sol y sombra falsa de la barca.
// heightAt(x, z) repite la misma fórmula en JS para que la barca cabecee con las olas de verdad.
import * as THREE from 'three';

const G = 9.8;
// [ángulo, empinamiento, longitud de onda (m)]
const WAVE_DEF = [[0.35, 0.13, 24], [1.35, 0.11, 14], [-0.8, 0.09, 8.5], [2.5, 0.07, 5]];
export const MAX_BIG = 4;
// forma de las crestas grandes (m)
export const BIG = { front: 3.4, back: 6.0, half: 26, edge: 10 };

const VERT = /* glsl */`
uniform float uTime;
uniform vec4 uW[4];        // dx, dz, empinamiento, k
uniform vec4 uBigA[4];     // cx, cz, dx, dz
uniform float uBigAmp[4];
uniform vec3 uCam;
varying vec3 vW;
varying vec3 vN;
varying float vH;
varying float vBig;
float bigH(vec2 p, out float crest){
  float h = 0.0; crest = 0.0;
  for (int i = 0; i < 4; i++) {
    float amp = uBigAmp[i];
    if (amp < 0.001) continue;
    vec4 a = uBigA[i];
    vec2 rel = p - a.xy;
    float al = dot(rel, a.zw);
    float la = dot(rel, vec2(-a.w, a.z));
    float w = al > 0.0 ? ${BIG.front.toFixed(2)} : ${BIG.back.toFixed(2)};
    float g = exp(-al * al / (w * w));
    float lf = 1.0 - smoothstep(${(BIG.half - BIG.edge).toFixed(1)}, ${BIG.half.toFixed(1)}, abs(la));
    h += amp * g * lf;
    crest = max(crest, g * lf * step(-1.2, al) * step(al, 2.4) * clamp(amp, 0.0, 1.0));
  }
  return h;
}
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 p = wp.xz;
  float dist = length(p - uCam.xz);
  vec3 disp = vec3(0.0);
  vec3 tang = vec3(1.0, 0.0, 0.0);
  vec3 bin = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < 4; i++) {
    vec4 w = uW[i];
    float k = w.w;
    float F = 6.2832 / k * 24.0;
    float s = w.z * (1.0 - smoothstep(F * 0.55, F, dist));
    float c = sqrt(${G.toFixed(1)} / k);
    float f = k * (dot(w.xy, p) - c * uTime);
    float a = s / k;
    float sf = sin(f), cf = cos(f);
    tang += vec3(-w.x * w.x * s * sf, w.x * s * cf, -w.x * w.y * s * sf);
    bin += vec3(-w.x * w.y * s * sf, w.y * s * cf, -w.y * w.y * s * sf);
    disp += vec3(w.x * a * cf, a * sf, w.y * a * cf);
  }
  vec3 n = normalize(cross(bin, tang));
  float cr;
  float bh = bigH(p, cr);
  float c2;
  float e = 0.7;
  float bx = (bigH(p + vec2(e, 0.0), c2) - bh) / e;
  float bz = (bigH(p + vec2(0.0, e), c2) - bh) / e;
  n = normalize(vec3(n.x / n.y - bx, 1.0, n.z / n.y - bz));
  wp.xyz += disp;
  wp.y += bh;
  vW = wp.xyz;
  vN = n;
  vH = disp.y;
  vBig = cr;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform sampler2D uMap;
uniform vec3 uMapRect;     // x0, z0, tamaño
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uDeep, uMid, uShallow, uSand, uZenith, uHorizon, uFog;
uniform vec2 uFogRange;
uniform vec4 uBoat;        // x, z, yaw, intensidad
varying vec3 vW;
varying vec3 vN;
varying float vH;
varying float vBig;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float caustic(vec2 p, float t){
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 3; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 3.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}
void main(){
  vec2 q = vW.xz;
  float t = uTime;
  vec3 toCam = cameraPosition - vW;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 uv = (q - uMapRect.xy) / uMapRect.z;
  vec4 m = texture2D(uMap, uv);
  float shallow = m.r, ring = m.g, sand = m.b;

  // rizos finos (normal de detalle) que se apagan con la distancia
  float near = 1.0 - smoothstep(30.0, 160.0, dist);
  vec2 gr = vec2(0.0);
  gr += vec2(0.8, 0.6) * cos(dot(q, vec2(0.8, 0.6)) * 1.9 + t * 2.3);
  gr += vec2(-0.5, 0.86) * cos(dot(q, vec2(-0.5, 0.86)) * 2.7 - t * 2.9) * 0.7;
  gr += vec2(0.95, -0.3) * cos(dot(q, vec2(0.95, -0.3)) * 4.1 + t * 3.7) * 0.45;
  #ifndef LOW
  float nA = vnoise(q * 0.9 + vec2(t * 0.35, t * 0.2));
  float nB = vnoise(q * 0.9 + vec2(0.37, 0.0) + vec2(t * 0.35, t * 0.2));
  float nC = vnoise(q * 0.9 + vec2(0.0, 0.37) + vec2(t * 0.35, t * 0.2));
  gr += vec2(nB - nA, nC - nA) * 6.0;
  #endif
  vec3 N = normalize(vN + vec3(gr.x, 0.0, gr.y) * 0.06 * near);

  // color del agua según profundidad
  vec3 water = mix(uDeep, uMid, smoothstep(0.0, 0.45, shallow));
  water = mix(water, uShallow, smoothstep(0.4, 0.85, shallow));
  water = mix(water, uSand, smoothstep(0.15, 0.9, sand) * 0.7);
  // luz que atraviesa las crestas (falso "subsurface")
  float sss = clamp(vH * 0.9 + 0.35, 0.0, 1.0) * pow(clamp(dot(V, -vec3(uSun.x, 0.0, uSun.z)) * 0.5 + 0.5, 0.0, 1.0), 2.0);
  water += vec3(0.02, 0.22, 0.2) * sss * (1.0 - shallow * 0.6);
  water *= 0.88 + 0.24 * clamp(vH + 0.5, 0.0, 1.0);
  // cáusticas en los bajíos
  #ifndef LOW
  if (shallow > 0.25 && dist < 140.0) {
    float c = caustic(q * 0.22 + vec2(17.0, 3.0), t * 0.6);
    water += vec3(0.75, 1.0, 0.95) * c * smoothstep(0.25, 0.8, shallow) * 0.45 * (1.0 - smoothstep(60.0, 140.0, dist));
  }
  #endif

  // reflejo del cielo + sol
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, clamp(R.y * 1.8, 0.0, 1.0));
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 col = mix(water, sky, fres * 0.75 * (1.0 - shallow * 0.45));
  float sd = max(dot(R, uSun), 0.0);
  col += uSunCol * (pow(sd, 600.0) * 9.0 + pow(sd, 60.0) * 0.35);
  // destellos sueltos (purpurina del sol)
  vec2 cell = floor(q * 2.5);
  float sp = hash(cell + floor(t * 5.0));
  float dot_ = 1.0 - smoothstep(0.05, 0.14, length(fract(q * 2.5) - 0.5));
  col += uSunCol * step(0.97, sp) * dot_ * pow(sd, 6.0) * 3.0 * near;

  // espuma (estilo dibujo: bordes nítidos)
  float fN = vnoise(q * 0.55 + vec2(t * 0.12, -t * 0.08)) * 0.6 + vnoise(q * 1.7 - vec2(t * 0.2, t * 0.1)) * 0.4;
  float lace = vnoise(q * 2.6 + vec2(t * 0.3, 0.0));
  float crest = smoothstep(0.74, 0.84, vH * 0.85 + fN * 0.3 + lace * 0.25 - 0.1);
  float band = sin(shallow * 22.0 - t * 2.2 + fN * 4.0) * 0.5 + 0.5;
  float shore = ring * smoothstep(0.55, 0.75, fN * 0.6 + band * 0.5 + lace * 0.25) + smoothstep(0.88, 0.99, ring);
  float big = smoothstep(0.55, 0.9, vBig) * smoothstep(0.45, 0.6, fN * 0.6 + lace * 0.5);
  float foam = clamp(crest * 0.75 + shore + big, 0.0, 1.0);
  foam = smoothstep(0.3, 0.55, foam);
  col = mix(col, vec3(0.93, 0.99, 1.0) * (0.85 + 0.15 * max(dot(N, uSun), 0.0)), foam * 0.92);

  // sombra falsa de la barca
  if (uBoat.w > 0.0) {
    vec2 d = q - uBoat.xy;
    float cs = cos(uBoat.z), sn = sin(uBoat.z);
    vec2 l = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
    float e = length(vec2(l.x / 1.25, l.y / 4.2));
    col *= 1.0 - (1.0 - smoothstep(0.55, 1.05, e)) * 0.32 * uBoat.w;
  }

  // bruma tropical
  col = mix(col, uFog, smoothstep(uFogRange.x, uFogRange.y, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function polarGrid(segs, rings, maxR) {
  const a = maxR / (Math.pow(1.065, rings) - 1);
  const pos = [0, 0, 0];
  for (let i = 1; i <= rings; i++) {
    const r = a * (Math.pow(1.065, i) - 1);
    for (let j = 0; j < segs; j++) {
      const ang = (j / segs) * Math.PI * 2 + (i % 2) * (Math.PI / segs);
      pos.push(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    }
  }
  const idx = [];
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) {
    const r0 = 1 + (i - 1) * segs, r1 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      const a0 = r0 + j, a1 = r0 + j1, b0 = r1 + j, b1 = r1 + j1;
      if (i % 2) { idx.push(a0, b1, b0, a0, a1, b1); } else { idx.push(a0, a1, b0, a1, b1, b0); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), maxR);
  return g;
}

export function createSea({ quality = 'alta', mapTex, mapRect, colors, sunDir, fog }) {
  const waves = WAVE_DEF.map(([ang, s, l]) => { const k = (2 * Math.PI) / l; return { dx: Math.cos(ang), dz: Math.sin(ang), s, k, c: Math.sqrt(G / k), F: l * 24 }; });
  const segs = quality === 'baja' ? 96 : quality === 'media' ? 128 : 168;
  const rings = quality === 'baja' ? 72 : 92;
  const geo = polarGrid(segs, rings, 1500);
  const big = Array.from({ length: MAX_BIG }, () => ({ cx: 0, cz: 0, dx: 1, dz: 0, amp: 0 }));
  const C = (c) => new THREE.Color(c);
  const uniforms = {
    uTime: { value: 0 },
    uW: { value: waves.map((w) => new THREE.Vector4(w.dx, w.dz, w.s, w.k)) },
    uBigA: { value: big.map(() => new THREE.Vector4()) },
    uBigAmp: { value: big.map(() => 0) },
    uCam: { value: new THREE.Vector3() },
    uMap: { value: mapTex },
    uMapRect: { value: new THREE.Vector3(mapRect.x0, mapRect.z0, mapRect.size) },
    uSun: { value: sunDir.clone().normalize() },
    uSunCol: { value: C(colors.sun) },
    uDeep: { value: C(colors.deep) }, uMid: { value: C(colors.mid) }, uShallow: { value: C(colors.shallow) }, uSand: { value: C(colors.sand) },
    uZenith: { value: C(colors.zenith) }, uHorizon: { value: C(colors.horizon) }, uFog: { value: C(fog.color) },
    uFogRange: { value: new THREE.Vector2(fog.near, fog.far) },
    uBoat: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, defines: quality === 'baja' ? { LOW: 1 } : {} });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  let time = 0, camX = 0, camZ = 0;
  function gerstner(x, z, out) {
    let ox = 0, oy = 0, oz = 0;
    const dist = Math.hypot(x - camX, z - camZ);
    for (const w of waves) {
      const fade = 1 - smooth(w.F * 0.55, w.F, dist);
      const s = w.s * fade, a = s / w.k;
      const f = w.k * (w.dx * x + w.dz * z - w.c * time);
      const cf = Math.cos(f);
      ox += w.dx * a * cf; oy += a * Math.sin(f); oz += w.dz * a * cf;
    }
    out.x = ox; out.y = oy; out.z = oz;
    return out;
  }
  const tmp = { x: 0, y: 0, z: 0 };
  function bigAt(x, z) {
    let h = 0;
    for (const b of big) {
      if (b.amp < 0.001) continue;
      const rx = x - b.cx, rz = z - b.cz;
      const al = rx * b.dx + rz * b.dz, la = -rx * b.dz + rz * b.dx;
      const w = al > 0 ? BIG.front : BIG.back;
      h += b.amp * Math.exp(-(al * al) / (w * w)) * (1 - smooth(BIG.half - BIG.edge, BIG.half, Math.abs(la)));
    }
    return h;
  }
  // altura del agua en (x, z): invertimos el desplazamiento horizontal de Gerstner con dos pasadas
  function heightAt(x, z) {
    let px = x, pz = z;
    for (let i = 0; i < 2; i++) { gerstner(px, pz, tmp); px = x - tmp.x; pz = z - tmp.z; }
    gerstner(px, pz, tmp);
    return tmp.y + bigAt(x, z);
  }
  return {
    mesh, material: mat, big, waves, heightAt, bigAt,
    get time() { return time; },
    update(t, center, cam, boat) {
      time = t; camX = cam.x; camZ = cam.z;
      uniforms.uTime.value = t;
      uniforms.uCam.value.copy(cam);
      // la malla sigue a la barca, ajustada a una rejilla para que no "nade"
      mesh.position.set(Math.round(center.x / 2) * 2, 0, Math.round(center.z / 2) * 2);
      for (let i = 0; i < MAX_BIG; i++) {
        const b = big[i];
        uniforms.uBigA.value[i].set(b.cx, b.cz, b.dx, b.dz);
        uniforms.uBigAmp.value[i] = b.amp;
      }
      if (boat) uniforms.uBoat.value.set(boat.x, boat.z, boat.yaw, boat.k);
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// Estela: tira de espuma que sale de la hélice y se abre en V con la edad.
export function createWake(maxPts = 70) {
  const n = maxPts;
  const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), str = new Float32Array(n * 2);
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('str', new THREE.BufferAttribute(str, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'attribute float str; varying vec2 vUv; varying float vS; varying vec3 vW; void main(){ vUv = uv; vS = str; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vS; varying vec3 vW;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      void main(){
        float age = vUv.y; float side = abs(vUv.x);
        float n = vn(vW.xz * 0.9 + vec2(uTime * 0.4, 0.0)) * 0.6 + vn(vW.xz * 2.3 - uTime * 0.3) * 0.4;
        float lace = smoothstep(0.48, 0.68, n + (1.0 - age) * 0.12 - age * 0.1);
        float edge = smoothstep(0.68, 0.86, side) * (1.0 - smoothstep(0.9, 1.0, side));
        float core = (1.0 - smoothstep(0.0, 0.38, side)) * (1.0 - smoothstep(0.0, 0.4, age));
        float a = (edge * 0.95 + core * 0.7) * lace * pow(1.0 - age, 1.3) * vS * smoothstep(0.0, 0.05, age);
        if (a < 0.02) discard;
        gl_FragColor = vec4(vec3(0.96, 1.0, 1.0), min(1.0, a) * 0.85);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const pts = []; // { x, z, t, s }
  let last = null;
  return {
    mesh,
    // añade un punto si nos hemos movido; s = intensidad (0 en el aire)
    push(x, z, t, s) {
      if (last && Math.hypot(x - last.x, z - last.z) < 0.9) { last.s = Math.max(last.s * 0.9, s); return; }
      last = { x, z, t, s };
      pts.unshift(last);
      if (pts.length > n) pts.pop();
    },
    update(t, heightAt, life = 3.2) {
      mat.uniforms.uTime.value = t;
      const m = pts.length;
      for (let i = 0; i < n; i++) {
        const p = pts[Math.min(i, m - 1)];
        if (!p) { str[i * 2] = str[i * 2 + 1] = 0; continue; }
        const q = pts[Math.min(i + 1, m - 1)] || p, o = pts[Math.max(i - 1, 0)] || p;
        let dx = o.x - q.x, dz = o.z - q.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const age = Math.min(1, (t - p.t) / life);
        const hw = 0.7 + age * 7.5;
        const y = heightAt(p.x, p.z) + 0.07;
        pos[i * 6] = p.x - dz * hw; pos[i * 6 + 1] = y; pos[i * 6 + 2] = p.z + dx * hw;
        pos[i * 6 + 3] = p.x + dz * hw; pos[i * 6 + 4] = y; pos[i * 6 + 5] = p.z - dx * hw;
        uv[i * 4] = -1; uv[i * 4 + 1] = age; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = age;
        const k = i >= m - 1 ? 0 : p.s;
        str[i * 2] = str[i * 2 + 1] = k;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.uv.needsUpdate = true; geo.attributes.str.needsUpdate = true;
    },
    reset() { pts.length = 0; last = null; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// Cielo tropical: degradado, halo del sol y franja de calima en el horizonte.
export function createSky({ zenith, horizon, haze, sunDir, sunCol }) {
  const geo = new THREE.SphereGeometry(1800, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uZ: { value: new THREE.Color(zenith) }, uH: { value: new THREE.Color(horizon) }, uHaze: { value: new THREE.Color(haze) }, uSun: { value: sunDir.clone().normalize() }, uSunCol: { value: new THREE.Color(sunCol) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uZ; uniform vec3 uH; uniform vec3 uHaze; uniform vec3 uSun; uniform vec3 uSunCol; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = mix(uH, uZ, pow(clamp(h, 0.0, 1.0), 0.55));
        c = mix(c, uHaze, (1.0 - smoothstep(0.0, 0.12, abs(h))) * 0.85);
        float s = max(dot(normalize(vP), uSun), 0.0);
        c += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}
